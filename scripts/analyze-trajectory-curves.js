#!/usr/bin/env node
/**
 * Per-dimension turn-by-turn trajectory analysis for Paper 2.0.
 *
 * Data availability (as of Feb 2026):
 *   - learner_scores per-turn JSON: ~943 multi-turn rows (rich per-dimension data)
 *   - tutor_scores per-turn JSON: ~56 rows (only recent Feb 26-27 runs)
 *   - scores_with_reasoning: ~8,730 rows (tutor per-dimension, but final suggestion only)
 *   - tutor_first_turn_score / overall_score: ~8,949 rows (single aggregate, not per-turn)
 *
 * Strategy: Focus learner trajectory analysis on the rich per-turn learner data.
 * For tutor trajectories, use tutor_scores where available, falling back to
 * first_turn/last_turn two-point slopes for the asymmetry comparison.
 * For tutor dimension-level analysis, use scores_with_reasoning (final suggestion only)
 * to compute cross-condition variance and calibration metrics.
 *
 * Key hypotheses tested:
 *   H1: Learner dimension slopes differ between recognition and baseline
 *   H2: Tutor-learner asymmetry (tutor development > learner development)
 *   H3: Calibration: tutor dimension variance is lower under recognition
 *   H4: Recognition learner trajectories show adaptation-sensitive dimension gains
 *
 * Usage:
 *   node scripts/analyze-trajectory-curves.js <runId> [<runId> ...]
 *   node scripts/analyze-trajectory-curves.js --all-multiturn
 *   node scripts/analyze-trajectory-curves.js <runId> --json exports/trajectory-curves.json
 *   node scripts/analyze-trajectory-curves.js <runId> --min-turns 3
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { parseEpochArg, getEpochFilter, printEpochBanner } from '../services/epochFilter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

// ── CLI parsing ──────────────────────────────────────────────────────

function parseCliArgs(argv) {
  const options = {};
  const flags = new Set();
  const runIds = [];
  const valueOpts = new Set(['db', 'json', 'min-turns', 'max-turn-position', 'epoch']);

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      runIds.push(token);
      continue;
    }
    const key = token.slice(2);
    if (valueOpts.has(key) && i + 1 < argv.length) {
      options[key] = argv[++i];
    } else {
      flags.add(key);
    }
  }
  return { options, flags, runIds };
}

const { options: cliOpts, flags: cliFlags, runIds: cliRunIds } = parseCliArgs(process.argv.slice(2));

const dbPath = cliOpts.db || path.join(ROOT_DIR, 'data', 'evaluations.db');
const jsonOut = cliOpts.json || null;
const minTurns = parseInt(cliOpts['min-turns'] || '3', 10);
const maxTurnPosition = parseInt(cliOpts['max-turn-position'] || '10', 10);
const allMultiturn = cliFlags.has('all-multiturn');
const _verbose = cliFlags.has('verbose');

if (!allMultiturn && cliRunIds.length === 0) {
  console.error('Usage: node scripts/analyze-trajectory-curves.js <runId...> | --all-multiturn');
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });

// ── Factor resolution (matches analyze-within-test-change.js) ────────

function inferFactorsFromProfile(profileName = '') {
  const p = String(profileName || '').toLowerCase();
  return {
    recognition: /(^|_)recog|recognition/.test(p),
    multiTutor: /(dialectical|ego_superego|adversary|advocate|suspicious|_multi_)/.test(p) && !/_single_/.test(p),
    multiLearner: /(psycho|ego_superego|multi_learner|dynamic)/.test(p),
  };
}

function resolveFactors(row) {
  const inferred = inferFactorsFromProfile(row.profile_name || '');
  const recognition = row.factor_recognition == null ? inferred.recognition : Boolean(row.factor_recognition);
  const multiTutor = row.factor_multi_agent_tutor == null ? inferred.multiTutor : Boolean(row.factor_multi_agent_tutor);
  const multiLearner =
    row.factor_multi_agent_learner == null ? inferred.multiLearner : Boolean(row.factor_multi_agent_learner);
  return {
    recognition,
    multiTutor,
    multiLearner,
    cellKey: `r${recognition ? 1 : 0}_t${multiTutor ? 1 : 0}_l${multiLearner ? 1 : 0}`,
    conditionLabel: recognition ? 'recognition' : 'baseline',
  };
}

// ── Stats helpers ────────────────────────────────────────────────────

function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN;
}
function std(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}
function cohensD(a, b) {
  if (a.length < 2 || b.length < 2) return NaN;
  const pooled = Math.sqrt(((a.length - 1) * std(a) ** 2 + (b.length - 1) * std(b) ** 2) / (a.length + b.length - 2));
  return pooled === 0 ? NaN : (mean(a) - mean(b)) / pooled;
}
function welchT(a, b) {
  const na = a.length,
    nb = b.length;
  if (na < 2 || nb < 2) return { t: NaN, df: NaN, p: NaN };
  const ma = mean(a),
    mb = mean(b);
  const va = std(a) ** 2,
    vb = std(b) ** 2;
  const se = Math.sqrt(va / na + vb / nb);
  if (se === 0) return { t: NaN, df: NaN, p: NaN };
  const t = (ma - mb) / se;
  const df = (va / na + vb / nb) ** 2 / ((va / na) ** 2 / (na - 1) + (vb / nb) ** 2 / (nb - 1));
  // Two-tailed p approximation via t-distribution
  const p = tDistPValue(Math.abs(t), df);
  return { t, df, p };
}
function tDistPValue(t, df) {
  // Approximation using the regularized incomplete beta function
  const x = df / (df + t * t);
  return betaIncomplete(df / 2, 0.5, x);
}
function betaIncomplete(a, b, x) {
  // Continued fraction approximation (Lentz's method)
  if (x === 0 || x === 1) return x === 0 ? 1 : 0;
  const lnBeta = lgamma(a) + lgamma(b) - lgamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a;
  let f = 1,
    c = 1,
    d = 0;
  for (let i = 0; i <= 200; i++) {
    const m = Math.floor(i / 2);
    let numerator;
    if (i === 0) {
      numerator = 1;
    } else if (i % 2 === 0) {
      numerator = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    } else {
      numerator = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    }
    d = 1 + numerator * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    d = 1 / d;
    c = 1 + numerator / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    f *= c * d;
    if (Math.abs(c * d - 1) < 1e-8) break;
  }
  const result = front * (f - 1);
  return x < (a + 1) / (a + b + 2) ? result : 1 - result;
}
function lgamma(x) {
  const c = [
    76.18009172947146, -86.50532032941676, 24.01409824083091, -1.231739572450155, 0.001208650973866179,
    -0.000005395239384953,
  ];
  let y = x,
    tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log((2.5066282746310007 * ser) / x);
}

function computeSlope(seq) {
  const n = seq.length;
  if (n < 2) return null;
  const meanX = (n - 1) / 2;
  const meanY = mean(seq);
  let cov = 0,
    varX = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - meanX;
    cov += dx * (seq[i] - meanY);
    varX += dx * dx;
  }
  return varX === 0 ? null : cov / varX;
}

// ── JSON parsing ─────────────────────────────────────────────────────

function parseJson(raw, fallback = null) {
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// ── Data extraction ──────────────────────────────────────────────────

function extractPerTurnDimensions(scoresJson, _side) {
  const parsed = parseJson(scoresJson);
  if (!parsed || typeof parsed !== 'object') return null;

  const turns = [];
  const keys = Object.keys(parsed)
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (keys.length < 2) return null;

  for (const turnIdx of keys) {
    if (turnIdx > maxTurnPosition) break;
    const turnData = parsed[String(turnIdx)];
    if (!turnData?.scores) continue;

    const dimensions = {};
    let hasAny = false;
    for (const [dim, entry] of Object.entries(turnData.scores)) {
      const score = typeof entry === 'number' ? entry : entry?.score;
      if (typeof score === 'number' && score >= 1 && score <= 5) {
        dimensions[dim] = score;
        hasAny = true;
      }
    }
    if (hasAny) {
      turns.push({
        turnIndex: turnIdx,
        overallScore: turnData.overallScore ?? null,
        dimensions,
      });
    }
  }

  return turns.length >= minTurns ? turns : null;
}

function _extractActionTypes(suggestionsJson) {
  const parsed = parseJson(suggestionsJson, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.map((s) => s?.actionType || s?.action_type || 'unknown');
}

// ── Query ────────────────────────────────────────────────────────────

function fetchMultiturnRows() {
  // Epoch filtering
  const epoch = parseEpochArg(process.argv);
  const epochFilter = getEpochFilter(epoch);
  printEpochBanner(epoch);

  let whereClause = `WHERE r.success = 1 AND r.dialogue_id IS NOT NULL ${epochFilter.and}`;
  const params = [];

  if (!allMultiturn && cliRunIds.length > 0) {
    whereClause += ` AND r.run_id IN (${cliRunIds.map(() => '?').join(',')})`;
    params.push(...cliRunIds);
  }

  const sql = `
    SELECT r.id, r.run_id, r.dialogue_id, r.scenario_id, r.scenario_name,
           r.profile_name, r.model, r.ego_model, r.superego_model,
           r.factor_recognition, r.factor_multi_agent_tutor, r.factor_multi_agent_learner,
           r.tutor_scores, r.learner_scores, r.suggestions,
           r.tutor_overall_score, r.tutor_first_turn_score, r.tutor_last_turn_score,
           r.tutor_development_score,
           r.learner_overall_score,
           r.overall_score,
           r.scores_with_reasoning
    FROM evaluation_results r
    ${whereClause}
    ORDER BY r.run_id, r.dialogue_id
  `;

  return db.prepare(sql).all(...params);
}

// ── Calibration analysis (tutor dimension variance) ──────────────────

function analyzeTutorCalibration(rows) {
  // Use scores_with_reasoning for per-dimension tutor data (available for most rows)
  const groups = { recognition: [], baseline: [] };

  for (const row of rows) {
    const swr = parseJson(row.scores_with_reasoning);
    if (!swr || typeof swr !== 'object') continue;

    const factors = resolveFactors(row);
    const condition = factors.recognition ? 'recognition' : 'baseline';

    const dimScores = {};
    for (const [dim, entry] of Object.entries(swr)) {
      const score = typeof entry === 'number' ? entry : entry?.score;
      if (typeof score === 'number' && score >= 1 && score <= 5) {
        dimScores[dim] = score;
      }
    }

    if (Object.keys(dimScores).length >= 6) {
      groups[condition].push({
        runId: row.run_id,
        dialogueId: row.dialogue_id,
        dimScores,
        overallScore: row.overall_score || row.tutor_first_turn_score,
        ...factors,
      });
    }
  }

  // Compute per-row dimension variance (calibration signal)
  const varianceByCondition = {};
  const dimensionStats = {};

  for (const [condition, entries] of Object.entries(groups)) {
    const variances = entries.map((e) => {
      const vals = Object.values(e.dimScores);
      return std(vals) ** 2; // variance across dimensions for this row
    });

    varianceByCondition[condition] = {
      n: variances.length,
      meanVariance: mean(variances),
      sdVariance: std(variances),
    };

    // Per-dimension means and SDs
    const allDims = new Set();
    entries.forEach((e) => Object.keys(e.dimScores).forEach((d) => allDims.add(d)));

    for (const dim of allDims) {
      if (!dimensionStats[dim]) dimensionStats[dim] = {};
      const scores = entries.map((e) => e.dimScores[dim]).filter((v) => v != null);
      dimensionStats[dim][condition] = {
        n: scores.length,
        mean: mean(scores),
        sd: std(scores),
      };
    }
  }

  // Cohen's d for variance reduction
  const recogVars = groups.recognition.map((e) => {
    const vals = Object.values(e.dimScores);
    return std(vals) ** 2;
  });
  const baseVars = groups.baseline.map((e) => {
    const vals = Object.values(e.dimScores);
    return std(vals) ** 2;
  });

  const varianceCohensD = recogVars.length >= 3 && baseVars.length >= 3 ? cohensD(recogVars, baseVars) : NaN;

  // Per-dimension discriminative power (which dims differ most between conditions?)
  const dimensionDiscrimination = {};
  for (const [dim, condData] of Object.entries(dimensionStats)) {
    if (condData.recognition && condData.baseline && condData.recognition.n >= 10 && condData.baseline.n >= 10) {
      const rScores = groups.recognition.map((e) => e.dimScores[dim]).filter((v) => v != null);
      const bScores = groups.baseline.map((e) => e.dimScores[dim]).filter((v) => v != null);
      dimensionDiscrimination[dim] = {
        recogMean: condData.recognition.mean,
        baseMean: condData.baseline.mean,
        delta: condData.recognition.mean - condData.baseline.mean,
        cohensD: cohensD(rScores, bScores),
        recogSd: condData.recognition.sd,
        baseSd: condData.baseline.sd,
        sdRatio: condData.baseline.sd > 0 ? condData.recognition.sd / condData.baseline.sd : NaN,
      };
    }
  }

  return { varianceByCondition, varianceCohensD, dimensionDiscrimination };
}

// ── Core analysis ────────────────────────────────────────────────────

function analyzeTrajectories(rows) {
  const dialogues = [];
  let skippedTooFewTurns = 0;

  for (const row of rows) {
    const factors = resolveFactors(row);
    const tutorTurns = extractPerTurnDimensions(row.tutor_scores, 'tutor');
    const learnerTurns = extractPerTurnDimensions(row.learner_scores, 'learner');

    if (!tutorTurns && !learnerTurns) {
      skippedTooFewTurns++;
      continue;
    }

    const entry = {
      runId: row.run_id,
      dialogueId: row.dialogue_id,
      scenarioId: row.scenario_id,
      profileName: row.profile_name,
      model: row.ego_model || row.model,
      ...factors,
    };

    if (tutorTurns) {
      entry.tutorTurns = tutorTurns;
      entry.tutorTurnCount = tutorTurns.length;
      entry.tutorDimensionSlopes = computeDimensionSlopes(tutorTurns);
      entry.tutorOverallSlope = computeSlope(tutorTurns.map((t) => t.overallScore).filter((v) => v != null));
    }

    if (learnerTurns) {
      entry.learnerTurns = learnerTurns;
      entry.learnerTurnCount = learnerTurns.length;
      entry.learnerDimensionSlopes = computeDimensionSlopes(learnerTurns);
      entry.learnerOverallSlope = computeSlope(learnerTurns.map((t) => t.overallScore).filter((v) => v != null));
    }

    dialogues.push(entry);
  }

  return { dialogues, skippedTooFewTurns };
}

function computeDimensionSlopes(turns) {
  const allDims = new Set();
  for (const t of turns) Object.keys(t.dimensions).forEach((d) => allDims.add(d));

  const slopes = {};
  for (const dim of allDims) {
    const seq = turns.map((t) => t.dimensions[dim]).filter((v) => v != null);
    if (seq.length >= 2) {
      slopes[dim] = computeSlope(seq);
    }
  }
  return slopes;
}

// ── Aggregation by condition ─────────────────────────────────────────

function buildMeanTrajectories(dialogues) {
  const groups = { recognition: [], baseline: [] };
  for (const d of dialogues) {
    groups[d.conditionLabel].push(d);
  }

  const result = {};
  for (const [condition, entries] of Object.entries(groups)) {
    result[condition] = {
      n: entries.length,
      tutor: buildMeanCurve(entries, 'tutorTurns'),
      learner: buildMeanCurve(entries, 'learnerTurns'),
    };
  }
  return result;
}

function buildMeanCurve(entries, turnsKey) {
  // Collect scores at each turn position across all dialogues
  const byPosition = new Map(); // turnIndex -> { overall: [], dims: { dim: [] } }

  for (const entry of entries) {
    const turns = entry[turnsKey];
    if (!turns) continue;
    for (const turn of turns) {
      if (!byPosition.has(turn.turnIndex)) {
        byPosition.set(turn.turnIndex, { overall: [], dims: {} });
      }
      const bucket = byPosition.get(turn.turnIndex);
      if (turn.overallScore != null) bucket.overall.push(turn.overallScore);
      for (const [dim, score] of Object.entries(turn.dimensions)) {
        if (!bucket.dims[dim]) bucket.dims[dim] = [];
        bucket.dims[dim].push(score);
      }
    }
  }

  const curve = [];
  for (const [turnIdx, bucket] of [...byPosition.entries()].sort((a, b) => a[0] - b[0])) {
    const point = {
      turn: turnIdx,
      n: bucket.overall.length,
      overallMean: mean(bucket.overall),
      overallSd: std(bucket.overall),
      dimensions: {},
    };
    for (const [dim, scores] of Object.entries(bucket.dims)) {
      point.dimensions[dim] = {
        mean: mean(scores),
        sd: std(scores),
        n: scores.length,
      };
    }
    curve.push(point);
  }
  return curve;
}

// ── Hypothesis tests ─────────────────────────────────────────────────

function runHypothesisTests(dialogues) {
  const recog = dialogues.filter((d) => d.recognition);
  const base = dialogues.filter((d) => !d.recognition);
  const tests = {};

  // H1: Per-dimension slope comparison (recognition vs baseline) — tutor side
  tests.H1_tutor_dimension_slopes = testDimensionSlopes(recog, base, 'tutorDimensionSlopes');

  // H1b: Per-dimension slope comparison — learner side
  tests.H1_learner_dimension_slopes = testDimensionSlopes(recog, base, 'learnerDimensionSlopes');

  // H2: Tutor-learner asymmetry (tutor slope - learner slope)
  tests.H2_tutor_learner_asymmetry = testAsymmetry(dialogues);

  // H4: Action type diversity
  // (Would need suggestions data per turn - placeholder)

  // Overall slope comparison
  tests.overall_slope = testOverallSlopes(recog, base);

  return tests;
}

function testDimensionSlopes(recog, base, slopeKey = 'tutorDimensionSlopes') {
  const allDims = new Set();
  for (const d of [...recog, ...base]) {
    if (d[slopeKey]) Object.keys(d[slopeKey]).forEach((k) => allDims.add(k));
  }

  const results = {};
  for (const dim of [...allDims].sort()) {
    const recogSlopes = recog.map((d) => d[slopeKey]?.[dim]).filter((v) => v != null);
    const baseSlopes = base.map((d) => d[slopeKey]?.[dim]).filter((v) => v != null);

    if (recogSlopes.length < 3 || baseSlopes.length < 3) continue;

    const d = cohensD(recogSlopes, baseSlopes);
    const t = welchT(recogSlopes, baseSlopes);

    results[dim] = {
      recogN: recogSlopes.length,
      baseN: baseSlopes.length,
      recogMeanSlope: mean(recogSlopes),
      baseMeanSlope: mean(baseSlopes),
      delta: mean(recogSlopes) - mean(baseSlopes),
      cohensD: d,
      welchT: t.t,
      df: t.df,
      pValue: t.p,
      significant: t.p < 0.05,
    };
  }
  return results;
}

function testOverallSlopes(recog, base) {
  const sides = ['tutor', 'learner'];
  const results = {};

  for (const side of sides) {
    const slopeKey = `${side}OverallSlope`;
    const recogSlopes = recog.map((d) => d[slopeKey]).filter((v) => v != null);
    const baseSlopes = base.map((d) => d[slopeKey]).filter((v) => v != null);

    if (recogSlopes.length < 3 || baseSlopes.length < 3) continue;

    results[side] = {
      recogN: recogSlopes.length,
      baseN: baseSlopes.length,
      recogMeanSlope: mean(recogSlopes),
      baseMeanSlope: mean(baseSlopes),
      delta: mean(recogSlopes) - mean(baseSlopes),
      cohensD: cohensD(recogSlopes, baseSlopes),
      welchT: welchT(recogSlopes, baseSlopes),
    };
  }
  return results;
}

function testAsymmetry(dialogues) {
  // For dialogues with both tutor and learner slopes, compute the gap
  const byCondition = { recognition: [], baseline: [] };

  for (const d of dialogues) {
    if (d.tutorOverallSlope == null || d.learnerOverallSlope == null) continue;
    const gap = d.tutorOverallSlope - d.learnerOverallSlope;
    byCondition[d.conditionLabel].push(gap);
  }

  const results = {};
  for (const [cond, gaps] of Object.entries(byCondition)) {
    if (gaps.length < 3) continue;
    const m = mean(gaps);
    const s = std(gaps);
    const se = s / Math.sqrt(gaps.length);
    results[cond] = {
      n: gaps.length,
      meanGap: m,
      sd: s,
      se,
      // One-sample t-test: is the gap > 0?
      tValue: se > 0 ? m / se : NaN,
      pValue: se > 0 ? tDistPValue(Math.abs(m / se), gaps.length - 1) : NaN,
      gapPositiveRate: gaps.filter((g) => g > 0).length / gaps.length,
    };
  }

  // Compare gap magnitude between conditions
  if (byCondition.recognition.length >= 3 && byCondition.baseline.length >= 3) {
    results.comparison = {
      recogMeanGap: mean(byCondition.recognition),
      baseMeanGap: mean(byCondition.baseline),
      gapDelta: mean(byCondition.recognition) - mean(byCondition.baseline),
      cohensD: cohensD(byCondition.recognition, byCondition.baseline),
      welchT: welchT(byCondition.recognition, byCondition.baseline),
    };
  }

  return results;
}

// ── Console output ───────────────────────────────────────────────────

function formatNumber(n, decimals = 2) {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toFixed(decimals);
}

function printCalibrationReport(calibration) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log('  CALIBRATION ANALYSIS (tutor dimension variance)');
  console.log(`${'═'.repeat(70)}`);

  for (const [cond, stats] of Object.entries(calibration.varianceByCondition)) {
    console.log(
      `  ${cond}: N=${stats.n}, mean dim-variance=${formatNumber(stats.meanVariance, 3)}, SD=${formatNumber(stats.sdVariance, 3)}`,
    );
  }
  console.log(
    `  Variance reduction d=${formatNumber(calibration.varianceCohensD)} (negative = recognition has lower variance)`,
  );

  console.log(`\n  Per-dimension discrimination (sorted by |d|):`);
  console.log(
    '  ' +
      'Dimension'.padEnd(30) +
      'Recog'.padStart(8) +
      'Base'.padStart(8) +
      'Delta'.padStart(8) +
      'd'.padStart(8) +
      'R_sd'.padStart(8) +
      'B_sd'.padStart(8) +
      'sdRatio'.padStart(9),
  );

  const sorted = Object.entries(calibration.dimensionDiscrimination).sort(
    (a, b) => Math.abs(b[1].cohensD) - Math.abs(a[1].cohensD),
  );

  for (const [dim, r] of sorted) {
    console.log(
      '  ' +
        dim.padEnd(30) +
        formatNumber(r.recogMean).padStart(8) +
        formatNumber(r.baseMean).padStart(8) +
        formatNumber(r.delta).padStart(8) +
        formatNumber(r.cohensD).padStart(8) +
        formatNumber(r.recogSd).padStart(8) +
        formatNumber(r.baseSd).padStart(8) +
        formatNumber(r.sdRatio).padStart(9),
    );
  }
}

function printReport(dialogues, meanTrajectories, hypothesisTests, skippedTooFewTurns) {
  const _totalRows = dialogues.length + skippedTooFewTurns;
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  TRAJECTORY CURVE ANALYSIS (Paper 2.0)`);
  console.log(`${'═'.repeat(70)}`);
  console.log(`  Dialogues analyzed: ${dialogues.length} (skipped ${skippedTooFewTurns} with <${minTurns} turns)`);
  console.log(
    `  Recognition: ${dialogues.filter((d) => d.recognition).length}  |  Baseline: ${dialogues.filter((d) => !d.recognition).length}`,
  );

  const runs = [...new Set(dialogues.map((d) => d.runId))];
  console.log(`  Runs: ${runs.length} (${runs.slice(0, 3).join(', ')}${runs.length > 3 ? '...' : ''})`);

  // Mean trajectories
  for (const [condition, data] of Object.entries(meanTrajectories)) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`  ${condition.toUpperCase()} (N=${data.n})`);

    for (const side of ['tutor', 'learner']) {
      const curve = data[side];
      if (!curve?.length) {
        console.log(`    ${side}: no data`);
        continue;
      }
      console.log(`    ${side} mean trajectory (overall 0-100):`);
      const line = curve.map((p) => `T${p.turn}=${formatNumber(p.overallMean, 1)}(n=${p.n})`).join('  ');
      console.log(`      ${line}`);
    }
  }

  // H1: Dimension slope comparison
  for (const [label, key] of [
    ['TUTOR', 'H1_tutor_dimension_slopes'],
    ['LEARNER', 'H1_learner_dimension_slopes'],
  ]) {
    const h1 = hypothesisTests[key];
    if (!h1 || Object.keys(h1).length === 0) {
      console.log(`\n${'─'.repeat(70)}`);
      console.log(`  H1: ${label} DIMENSION SLOPE COMPARISON — no data`);
      continue;
    }
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`  H1: ${label} DIMENSION SLOPE COMPARISON (recognition vs baseline)`);
    console.log(
      '  ' +
        'Dimension'.padEnd(30) +
        'RecogSlope'.padStart(12) +
        'BaseSlope'.padStart(12) +
        'Delta'.padStart(10) +
        'd'.padStart(8) +
        'p'.padStart(8) +
        'Sig'.padStart(6),
    );

    const dimsSorted = Object.entries(h1).sort((a, b) => Math.abs(b[1].cohensD) - Math.abs(a[1].cohensD));
    for (const [dim, r] of dimsSorted) {
      const sig = r.significant ? ' *' : '';
      console.log(
        '  ' +
          dim.padEnd(30) +
          formatNumber(r.recogMeanSlope, 3).padStart(12) +
          formatNumber(r.baseMeanSlope, 3).padStart(12) +
          formatNumber(r.delta, 3).padStart(10) +
          formatNumber(r.cohensD).padStart(8) +
          formatNumber(r.pValue, 3).padStart(8) +
          sig.padStart(6),
      );
    }
  }

  // H2: Tutor-learner asymmetry
  console.log(`\n${'─'.repeat(70)}`);
  console.log('  H2: TUTOR-LEARNER ASYMMETRY (tutor slope - learner slope > 0?)');
  const h2 = hypothesisTests.H2_tutor_learner_asymmetry;
  for (const [cond, r] of Object.entries(h2)) {
    if (cond === 'comparison') continue;
    console.log(
      `    ${cond}: N=${r.n}, mean gap=${formatNumber(r.meanGap, 3)}, t=${formatNumber(r.tValue)}, p=${formatNumber(r.pValue, 3)}, gap>0 rate=${formatNumber(r.gapPositiveRate * 100, 1)}%`,
    );
  }
  if (h2.comparison) {
    console.log(
      `    Comparison: recog gap=${formatNumber(h2.comparison.recogMeanGap, 3)} vs base gap=${formatNumber(h2.comparison.baseMeanGap, 3)}, d=${formatNumber(h2.comparison.cohensD)}`,
    );
  }

  // Overall slopes
  console.log(`\n${'─'.repeat(70)}`);
  console.log('  OVERALL SLOPE COMPARISON');
  const os = hypothesisTests.overall_slope;
  for (const [side, r] of Object.entries(os)) {
    console.log(
      `    ${side}: recog slope=${formatNumber(r.recogMeanSlope, 3)} (N=${r.recogN}), base slope=${formatNumber(r.baseMeanSlope, 3)} (N=${r.baseN}), d=${formatNumber(r.cohensD)}`,
    );
  }

  console.log(`\n${'═'.repeat(70)}\n`);
}

// ── Main ─────────────────────────────────────────────────────────────

function main() {
  const rows = fetchMultiturnRows();
  console.log(
    `Fetched ${rows.length} multi-turn rows from ${allMultiturn ? 'all runs' : cliRunIds.length + ' run(s)'}`,
  );

  // Calibration analysis (uses all rows with scores_with_reasoning)
  const calibration = analyzeTutorCalibration(rows);
  printCalibrationReport(calibration);

  // Trajectory analysis (uses rows with per-turn learner/tutor scores)
  const { dialogues, skippedTooFewTurns } = analyzeTrajectories(rows);
  console.log(`\nExtracted ${dialogues.length} dialogues with ${minTurns}+ turns (${skippedTooFewTurns} skipped)`);

  if (dialogues.length === 0) {
    console.log('No dialogues with sufficient turns found. Try --min-turns 2 or --all-multiturn.');
    process.exit(0);
  }

  const meanTrajectories = buildMeanTrajectories(dialogues);
  const hypothesisTests = runHypothesisTests(dialogues);

  printReport(dialogues, meanTrajectories, hypothesisTests, skippedTooFewTurns);

  if (jsonOut) {
    const output = {
      generatedAt: new Date().toISOString(),
      config: { minTurns, maxTurnPosition, runIds: allMultiturn ? 'all' : cliRunIds },
      summary: {
        totalDialogues: dialogues.length,
        recognitionN: dialogues.filter((d) => d.recognition).length,
        baselineN: dialogues.filter((d) => !d.recognition).length,
        runs: [...new Set(dialogues.map((d) => d.runId))],
      },
      calibration,
      meanTrajectories,
      hypothesisTests,
      dialogues: dialogues.map((d) => ({
        runId: d.runId,
        dialogueId: d.dialogueId,
        scenarioId: d.scenarioId,
        profileName: d.profileName,
        model: d.model,
        condition: d.conditionLabel,
        cellKey: d.cellKey,
        tutorTurnCount: d.tutorTurnCount || null,
        tutorOverallSlope: d.tutorOverallSlope ?? null,
        tutorDimensionSlopes: d.tutorDimensionSlopes || null,
        learnerTurnCount: d.learnerTurnCount || null,
        learnerOverallSlope: d.learnerOverallSlope ?? null,
        learnerDimensionSlopes: d.learnerDimensionSlopes || null,
      })),
    };

    const dir = path.dirname(jsonOut);
    if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(jsonOut, JSON.stringify(output, null, 2));
    console.log(`JSON output written to ${jsonOut}`);
  }
}

main();
