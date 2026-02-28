#!/usr/bin/env node

/**
 * Rubric Calibration Script
 *
 * Compares rubric versions by analyzing how dimension consolidation affects
 * overall scores. Supports two modes:
 *
 *   --synthetic (default): Maps v2.1 dimension scores to v2.2 consolidated
 *     dimensions using the known mapping, recomputes overall scores, and
 *     correlates. ZERO API cost.
 *
 *   --live: Actually re-scores transcripts with the v2.2 rubric via the
 *     AI judge. Expensive but produces true v2.2 scores.
 *
 * Usage:
 *   node scripts/calibrate-rubric.js                              # synthetic, all data
 *   node scripts/calibrate-rubric.js --run-id <id>                # specific run
 *   node scripts/calibrate-rubric.js --judge claude               # filter by judge
 *   node scripts/calibrate-rubric.js --sample 50                  # limit sample size
 *   node scripts/calibrate-rubric.js --from-version 2.1 --to-version 2.2
 *   node scripts/calibrate-rubric.js --export calibration.csv     # export results
 *   node scripts/calibrate-rubric.js --verbose                    # show per-row detail
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT_DIR, 'data', 'evaluations.db');
const CONFIG_DIR = path.join(ROOT_DIR, 'config');

// ── CLI args ──
const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
}
const runId = getArg('run-id');
const judgeFilter = getArg('judge');
const sampleSize = parseInt(getArg('sample') || '0', 10) || 0;
const fromVersion = getArg('from-version') || '2.1';
const toVersion = getArg('to-version') || '2.2';
const exportPath = getArg('export');
const verbose = args.includes('--verbose');
const liveMode = args.includes('--live');

// ── ANSI colors ──
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

// ── Statistics ──

function mean(arr) {
  if (arr.length === 0) return NaN;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function standardDeviation(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((acc, val) => acc + (val - m) ** 2, 0) / (arr.length - 1));
}

function pearsonCorrelation(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 3) return { r: NaN, n, p: NaN };

  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));

  let sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }

  if (sumX2 === 0 || sumY2 === 0) return { r: NaN, n, p: NaN };
  const r = sumXY / Math.sqrt(sumX2 * sumY2);

  // t-test for significance
  if (Math.abs(r) >= 1) return { r, n, p: 0 };
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  const _df = n - 2;
  const z = Math.abs(t);
  const p1 = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  const t1 = 1 / (1 + 0.2316419 * z);
  const poly = t1 * (0.319381530 + t1 * (-0.356563782 + t1 * (1.781477937 + t1 * (-1.821255978 + 1.330274429 * t1))));
  const p = 2 * p1 * poly;

  return { r, n, p };
}

function meanAbsoluteError(x, y) {
  const n = Math.min(x.length, y.length);
  if (n === 0) return NaN;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.abs(x[i] - y[i]);
  return sum / n;
}

function formatR(r) {
  if (isNaN(r)) return '  —  ';
  return (r >= 0 ? '+' : '') + r.toFixed(3);
}

function formatP(p) {
  if (isNaN(p)) return '—';
  if (p < 0.001) return '<.001';
  return p.toFixed(3);
}

// ── Rubric loading ──

function loadRubric(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return yaml.parse(raw);
}

function getRubricFiles(version) {
  const suffix = version === '2.1' ? '' : `-v${version}`;
  return {
    tutor: path.join(CONFIG_DIR, `evaluation-rubric${suffix}.yaml`),
    learner: path.join(CONFIG_DIR, `evaluation-rubric-learner${suffix}.yaml`),
    tutorHolistic: path.join(CONFIG_DIR, `evaluation-rubric-tutor-holistic${suffix}.yaml`),
    dialogue: path.join(CONFIG_DIR, `evaluation-rubric-dialogue${suffix}.yaml`),
    deliberation: path.join(CONFIG_DIR, `evaluation-rubric-deliberation${suffix}.yaml`),
  };
}

// ── Dimension mapping (v2.1 → v2.2) ──
// Maps old dimension keys to new consolidated keys.
// Used in synthetic mode to remap existing scores.

const TUTOR_DIM_MAP = {
  // v2.1 key → v2.2 key
  relevance: 'perception_quality',
  personalization: 'perception_quality',
  memory_integration: 'perception_quality',
  pedagogical_soundness: 'pedagogical_craft',
  pedagogical: 'pedagogical_craft',  // normalized key
  specificity: 'pedagogical_craft',
  actionability: 'pedagogical_craft',
  dialectical_responsiveness: 'elicitation_quality',
  productive_struggle: 'elicitation_quality',
  tutor_adaptation: 'adaptive_responsiveness',
  mutual_recognition: 'recognition_quality',
  transformative_potential: 'productive_difficulty',
  // productive_struggle also maps to productive_difficulty (split mapping)
  epistemic_honesty: 'epistemic_integrity',
  tone: 'epistemic_integrity',
  learner_growth: null,  // REMOVED in v2.2
};

// For split mappings (productive_struggle → both elicitation AND productive_difficulty),
// use a secondary map. The primary map takes precedence; the secondary provides the
// "other half" of the split.
const _TUTOR_DIM_SECONDARY = {
  productive_struggle: 'productive_difficulty',
  dialectical_responsiveness: 'adaptive_responsiveness',
};

const LEARNER_DIM_MAP = {
  conceptual_engagement: 'engagement_quality',
  question_quality: 'engagement_quality',
  learner_authenticity: 'learner_authenticity',
  revision_signals: 'revision_signals',
  conceptual_progression: 'conceptual_progression',
  metacognitive_development: 'metacognitive_awareness',
  persona_consistency: null,  // REMOVED in v2.2
};

const TUTOR_HOLISTIC_DIM_MAP = {
  scaffolding_arc: 'pedagogical_arc',
  conceptual_coherence: 'pedagogical_arc',
  adaptive_responsiveness: 'adaptive_trajectory',
  recognition_depth: 'adaptive_trajectory',
  pedagogical_closure: 'pedagogical_closure',
  productive_challenge: null,  // REMOVED in v2.2
};

/**
 * Remap v2.1 dimension scores to v2.2 consolidated dimensions.
 * For consolidated dims, takes the weighted average of contributing v2.1 dims.
 */
function remapDimensions(oldScores, dimMap, oldRubric, newRubric) {
  if (!oldScores || typeof oldScores !== 'object') return null;

  const oldDims = oldRubric?.dimensions || {};
  const _newDims = newRubric?.dimensions || {};

  // Collect old scores grouped by new dim
  const groups = {};
  for (const [oldKey, newKey] of Object.entries(dimMap)) {
    if (!newKey) continue;  // REMOVED dimension
    const scoreEntry = oldScores[oldKey];
    if (!scoreEntry) continue;

    const score = typeof scoreEntry === 'object' ? scoreEntry.score : scoreEntry;
    if (typeof score !== 'number' || score < 1 || score > 5) continue;

    const oldWeight = oldDims[oldKey]?.weight || 0;
    if (!groups[newKey]) groups[newKey] = { weightedSum: 0, totalWeight: 0 };
    groups[newKey].weightedSum += score * oldWeight;
    groups[newKey].totalWeight += oldWeight;
  }

  // Compute weighted average per new dim
  const newScores = {};
  for (const [newKey, group] of Object.entries(groups)) {
    if (group.totalWeight > 0) {
      newScores[newKey] = {
        score: group.weightedSum / group.totalWeight,
        reasoning: '(synthetic: weighted average of contributing v2.1 dims)',
      };
    }
  }

  return newScores;
}

/**
 * Compute overall score from dimension scores using rubric weights.
 */
function computeOverall(scores, rubric) {
  const dims = rubric?.dimensions || {};
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [key, dim] of Object.entries(dims)) {
    const entry = scores[key];
    if (!entry) continue;
    const score = typeof entry === 'object' ? entry.score : entry;
    if (typeof score !== 'number') continue;

    weightedSum += score * (dim.weight || 0);
    totalWeight += dim.weight || 0;
  }

  if (totalWeight === 0) return NaN;
  return ((weightedSum / totalWeight) - 1) / 4 * 100;
}

/**
 * Flatten per-turn scores into a single dimension map by averaging across turns.
 *
 * DB format:  { "0": { scores: { dim: {score, reasoning} }, ... }, "1": ... }
 * Output:     { dim: { score: avgAcrossTurns } }
 *
 * Also handles already-flat format (returns as-is) for backward compat.
 */
function flattenPerTurnScores(raw) {
  if (!raw || typeof raw !== 'object') return null;

  // Detect format: if keys are numeric strings with a .scores sub-object, it's per-turn
  const keys = Object.keys(raw);
  if (keys.length === 0) return null;

  const isPerTurn = keys.every(k => /^\d+$/.test(k)) && keys.some(k => raw[k]?.scores);
  if (!isPerTurn) {
    // Already flat — return as-is
    return raw;
  }

  // Accumulate scores per dimension across turns
  const accum = {};  // { dimKey: { sum: N, count: N } }
  for (const turnKey of keys) {
    const turnScores = raw[turnKey]?.scores;
    if (!turnScores || typeof turnScores !== 'object') continue;

    for (const [dim, entry] of Object.entries(turnScores)) {
      const score = typeof entry === 'object' ? entry.score : entry;
      if (typeof score !== 'number') continue;

      if (!accum[dim]) accum[dim] = { sum: 0, count: 0 };
      accum[dim].sum += score;
      accum[dim].count += 1;
    }
  }

  // Compute averages
  const flat = {};
  for (const [dim, { sum, count }] of Object.entries(accum)) {
    flat[dim] = { score: sum / count };
  }

  return Object.keys(flat).length > 0 ? flat : null;
}

// ── Database ──

const db = new Database(DB_PATH, { readonly: true });

function getCalibrationSample() {
  const conditions = ['dialogue_id IS NOT NULL'];
  const params = [];

  if (runId) {
    conditions.push('run_id = ?');
    params.push(runId);
  }
  if (judgeFilter) {
    conditions.push('judge_model LIKE ?');
    params.push(`%${judgeFilter}%`);
  }

  // Require tutor scores to exist (scored rows only)
  conditions.push('tutor_overall_score IS NOT NULL');

  let sql = `
    SELECT id, run_id, scenario_name, profile_name, judge_model,
           tutor_overall_score, tutor_first_turn_score,
           tutor_holistic_overall_score,
           learner_overall_score, learner_holistic_overall_score,
           dialogue_quality_score,
           tutor_scores, learner_scores,
           tutor_holistic_scores,
           tutor_rubric_version, learner_rubric_version
    FROM evaluation_results
    WHERE ${conditions.join(' AND ')}
    ORDER BY RANDOM()
  `;

  if (sampleSize > 0) {
    sql += ` LIMIT ${sampleSize}`;
  }

  return db.prepare(sql).all(...params);
}

// ── Synthetic calibration ──

function runSyntheticCalibration() {
  console.log(`${c.bold}${c.magenta}═══ Rubric Calibration: v${fromVersion} → v${toVersion} (synthetic) ═══${c.reset}\n`);

  // Load both rubric versions
  const oldFiles = getRubricFiles(fromVersion);
  const newFiles = getRubricFiles(toVersion);

  const oldTutorRubric = loadRubric(oldFiles.tutor);
  const newTutorRubric = loadRubric(newFiles.tutor);
  const oldLearnerRubric = loadRubric(oldFiles.learner);
  const newLearnerRubric = loadRubric(newFiles.learner);
  const oldHolisticRubric = loadRubric(oldFiles.tutorHolistic);
  const newHolisticRubric = loadRubric(newFiles.tutorHolistic);

  console.log(`  Old rubric: ${oldTutorRubric.name} v${oldTutorRubric.version} (${Object.keys(oldTutorRubric.dimensions).length} tutor dims)`);
  console.log(`  New rubric: ${newTutorRubric.name} v${newTutorRubric.version} (${Object.keys(newTutorRubric.dimensions).length} tutor dims)`);

  // Get calibration sample
  const rows = getCalibrationSample();
  console.log(`  Sample size: ${c.bold}${rows.length}${c.reset}\n`);

  if (rows.length === 0) {
    console.log(`  ${c.red}No scored multi-turn rows found. Run 'evaluate' first.${c.reset}`);
    return;
  }

  // ── Tutor per-turn calibration ──
  const tutorResults = [];
  const learnerResults = [];
  const holisticResults = [];
  const exportRows = [];

  for (const row of rows) {
    // Parse stored dimension scores
    let tutorScoresRaw;
    try {
      tutorScoresRaw = row.tutor_scores ? JSON.parse(row.tutor_scores) : null;
    } catch { tutorScoresRaw = null; }

    let learnerScoresRaw;
    try {
      learnerScoresRaw = row.learner_scores ? JSON.parse(row.learner_scores) : null;
    } catch { learnerScoresRaw = null; }

    let holisticScores;
    try {
      holisticScores = row.tutor_holistic_scores ? JSON.parse(row.tutor_holistic_scores) : null;
    } catch { holisticScores = null; }

    // Flatten per-turn scores to average across turns.
    // Format: { "0": { scores: { dim: {score, reasoning} } }, "1": { scores: ... } }
    // → { dim: { score: avg } }
    const tutorScores = flattenPerTurnScores(tutorScoresRaw);
    const learnerScores = flattenPerTurnScores(learnerScoresRaw);

    // Tutor per-turn
    if (tutorScores && Object.keys(tutorScores).length > 0) {
      const remapped = remapDimensions(tutorScores, TUTOR_DIM_MAP, oldTutorRubric, newTutorRubric);
      if (remapped) {
        const oldOverall = row.tutor_overall_score;
        const newOverall = computeOverall(remapped, newTutorRubric);

        if (!isNaN(newOverall)) {
          tutorResults.push({ id: row.id, oldOverall, newOverall, oldScores: tutorScores, newScores: remapped });
          exportRows.push({
            id: row.id, instrument: 'tutor_perturn', scenario: row.scenario_name,
            profile: row.profile_name, old_overall: oldOverall, new_overall: newOverall,
          });
        }
      }
    }

    // Learner per-turn
    if (learnerScores && Object.keys(learnerScores).length > 0 && row.learner_overall_score != null) {
      const remapped = remapDimensions(learnerScores, LEARNER_DIM_MAP, oldLearnerRubric, newLearnerRubric);
      if (remapped) {
        const oldOverall = row.learner_overall_score;
        const newOverall = computeOverall(remapped, newLearnerRubric);

        if (!isNaN(newOverall)) {
          learnerResults.push({ id: row.id, oldOverall, newOverall });
          exportRows.push({
            id: row.id, instrument: 'learner_perturn', scenario: row.scenario_name,
            profile: row.profile_name, old_overall: oldOverall, new_overall: newOverall,
          });
        }
      }
    }

    // Tutor holistic
    if (holisticScores && Object.keys(holisticScores).length > 0 && row.tutor_holistic_overall_score != null) {
      const remapped = remapDimensions(holisticScores, TUTOR_HOLISTIC_DIM_MAP, oldHolisticRubric, newHolisticRubric);
      if (remapped) {
        const oldOverall = row.tutor_holistic_overall_score;
        const newOverall = computeOverall(remapped, newHolisticRubric);

        if (!isNaN(newOverall)) {
          holisticResults.push({ id: row.id, oldOverall, newOverall });
          exportRows.push({
            id: row.id, instrument: 'tutor_holistic', scenario: row.scenario_name,
            profile: row.profile_name, old_overall: oldOverall, new_overall: newOverall,
          });
        }
      }
    }
  }

  // ── Report ──

  console.log(`${c.bold}${c.cyan}━━━ Tutor Per-Turn: v${fromVersion} → v${toVersion} ━━━${c.reset}`);
  reportCalibration(tutorResults, 'tutor');

  console.log(`\n${c.bold}${c.cyan}━━━ Learner Per-Turn: v${fromVersion} → v${toVersion} ━━━${c.reset}`);
  reportCalibration(learnerResults, 'learner');

  console.log(`\n${c.bold}${c.cyan}━━━ Tutor Holistic: v${fromVersion} → v${toVersion} ━━━${c.reset}`);
  reportCalibration(holisticResults, 'holistic');

  // ── Summary ──
  console.log(`\n${c.bold}${c.magenta}═══ Calibration Summary ═══${c.reset}\n`);

  const summaryRows = [
    ['Tutor per-turn', tutorResults],
    ['Learner per-turn', learnerResults],
    ['Tutor holistic', holisticResults],
  ];

  console.log(`  ${'Instrument'.padEnd(20)}  ${'N'.padStart(5)}  ${'r'.padStart(7)}  ${'MAE'.padStart(6)}  ${'Δ mean'.padStart(7)}  Verdict`);
  console.log(`  ${'─'.repeat(20)}  ${'─'.repeat(5)}  ${'─'.repeat(7)}  ${'─'.repeat(6)}  ${'─'.repeat(7)}  ${'─'.repeat(30)}`);

  for (const [label, results] of summaryRows) {
    if (results.length === 0) {
      console.log(`  ${label.padEnd(20)}  ${'0'.padStart(5)}  ${'—'.padStart(7)}  ${'—'.padStart(6)}  ${'—'.padStart(7)}  ${c.dim}no data${c.reset}`);
      continue;
    }

    const oldArr = results.map(r => r.oldOverall);
    const newArr = results.map(r => r.newOverall);
    const corr = pearsonCorrelation(oldArr, newArr);
    const mae = meanAbsoluteError(oldArr, newArr);
    const delta = mean(newArr) - mean(oldArr);

    const verdict = isNaN(corr.r) ? `${c.dim}insufficient data${c.reset}` :
      corr.r > 0.90 ? `${c.green}minimal information loss${c.reset}` :
      corr.r > 0.80 ? `${c.yellow}moderate information loss — investigate${c.reset}` :
      `${c.red}significant information loss — DO NOT ADOPT${c.reset}`;

    console.log(`  ${label.padEnd(20)}  ${String(results.length).padStart(5)}  ${formatR(corr.r).padStart(7)}  ${mae.toFixed(1).padStart(6)}  ${(delta >= 0 ? '+' : '') + delta.toFixed(1).padStart(6)}  ${verdict}`);
  }

  console.log(`\n  ${c.bold}Decision criteria:${c.reset}`);
  console.log(`    r > 0.90: Safe to adopt (minimal information loss)`);
  console.log(`    r = 0.80-0.90: Investigate which dimensions lost signal`);
  console.log(`    r < 0.80: Do NOT adopt — consolidation lost real signal\n`);

  // ── Export ──
  if (exportPath && exportRows.length > 0) {
    const header = 'id,instrument,scenario,profile,old_overall,new_overall';
    const csv = [header, ...exportRows.map(r =>
      `${r.id},${r.instrument},"${r.scenario}","${r.profile}",${r.old_overall.toFixed(1)},${r.new_overall.toFixed(1)}`,
    )].join('\n');
    fs.writeFileSync(exportPath, csv, 'utf-8');
    console.log(`  Exported ${exportRows.length} rows to ${exportPath}`);
  }
}

function reportCalibration(results, label) {
  if (results.length === 0) {
    console.log(`  ${c.dim}No data${c.reset}`);
    return;
  }

  const oldArr = results.map(r => r.oldOverall);
  const newArr = results.map(r => r.newOverall);
  const corr = pearsonCorrelation(oldArr, newArr);
  const mae = meanAbsoluteError(oldArr, newArr);

  console.log(`  N = ${results.length}`);
  console.log(`  r(v${fromVersion}, v${toVersion}) = ${c.bold}${formatR(corr.r)}${c.reset}  p = ${formatP(corr.p)}`);
  console.log(`  MAE = ${mae.toFixed(1)} points (on 0-100 scale)`);
  console.log(`  Mean shift: v${fromVersion}=${mean(oldArr).toFixed(1)} → v${toVersion}=${mean(newArr).toFixed(1)} (Δ = ${(mean(newArr) - mean(oldArr) >= 0 ? '+' : '')}${(mean(newArr) - mean(oldArr)).toFixed(1)})`);
  console.log(`  SD: v${fromVersion}=${standardDeviation(oldArr).toFixed(1)} → v${toVersion}=${standardDeviation(newArr).toFixed(1)}`);

  // Per-dimension detail for tutor (the biggest change)
  if (verbose && label === 'tutor' && results.length > 0 && results[0].newScores) {
    console.log(`\n  ${c.bold}Per-dimension (v${toVersion}, synthetic):${c.reset}`);
    const allNewDims = new Set();
    for (const r of results) {
      for (const key of Object.keys(r.newScores)) allNewDims.add(key);
    }

    for (const dim of [...allNewDims].sort()) {
      const scores = results
        .filter(r => r.newScores[dim])
        .map(r => r.newScores[dim].score);
      if (scores.length > 0) {
        console.log(`    ${dim.padEnd(25)} mean=${mean(scores).toFixed(2)}  SD=${standardDeviation(scores).toFixed(2)}  N=${scores.length}`);
      }
    }
  }
}

// ── Main ──

if (liveMode) {
  console.log(`${c.red}Live mode (--live) not yet implemented. Use synthetic mode (default).${c.reset}`);
  console.log(`Live mode would re-score transcripts with v${toVersion} rubric via AI judge.`);
  process.exit(1);
}

runSyntheticCalibration();
db.close();
