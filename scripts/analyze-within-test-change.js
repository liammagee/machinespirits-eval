#!/usr/bin/env node
/**
 * Symmetric within-test change analysis for multi-turn dialogues.
 *
 * Goal:
 * - Measure first-to-last change with identical trajectory metrics on tutor and learner sides.
 * - Keep the method symmetric: same metric definitions, same aggregation, same ANOVA path.
 *
 * Methods:
 * 1) Rubric trajectories (0-100)
 *    - Tutor: derived from per-turn tutor rubric scores in evaluation_results.tutor_scores,
 *      falling back to dialogue log turnResults/dimensionTrajectories.
 *    - Learner: derived from per-turn learner rubric scores in evaluation_results.learner_scores.
 *
 * 2) Text-proxy trajectories (0-100)
 *    - Tutor + Learner: same lexical/discourse complexity scoring function per turn.
 *    - Useful for runs where tutor per-turn rubric traces are missing.
 *
 * Usage:
 *   node scripts/analyze-within-test-change.js <runId> [<runId> ...]
 *   node scripts/analyze-within-test-change.js --db data/evaluations.db <runId>
 *   node scripts/analyze-within-test-change.js <runId> --json exports/within-test-change.json
 *   node scripts/analyze-within-test-change.js <runId> --dry-run
 *   node scripts/analyze-within-test-change.js <runId> --smoke-test
 *   node scripts/analyze-within-test-change.js <runId> --metric-version within-test-v3
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import Database from 'better-sqlite3';
import { runThreeWayANOVA } from '../services/anovaStats.js';
import { calculateLearnerOverallScore } from '../services/learnerRubricEvaluator.js';
import { calculateOverallScore } from '../services/rubricEvaluator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const rawArgs = process.argv.slice(2);

function parseCliArgs(argv) {
  const valueOptions = new Set(['db', 'logs', 'json', 'limit', 'metric-version']);
  const options = {};
  const flags = new Set();
  const runIds = [];

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      runIds.push(token);
      continue;
    }

    const key = token.slice(2);
    if (valueOptions.has(key)) {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        options[key] = next;
        i++;
      } else {
        options[key] = null;
      }
      continue;
    }
    flags.add(key);
  }

  return { options, flags, runIds };
}

const cli = parseCliArgs(rawArgs);
const runIdsFromArgs = cli.runIds;

function getOption(name, defaultValue = null) {
  const value = cli.options[name];
  return value == null ? defaultValue : value;
}

function hasFlag(name) {
  return cli.flags.has(name);
}

const dbPath = getOption('db', process.env.EVAL_DB_PATH || path.join(ROOT_DIR, 'data', 'evaluations.db'));
const logsDir = getOption('logs', path.join(ROOT_DIR, 'logs', 'tutor-dialogues'));
const jsonOutPath = getOption('json');
const metricVersion = getOption('metric-version', 'within-test-v2-aligned-proxy');

const smokeTestMode = hasFlag('smoke-test');
const dryRunMode = hasFlag('dry-run') || smokeTestMode;
const explicitPersist = hasFlag('persist');
const explicitNoPersist = hasFlag('no-persist');
const persistEnabled = dryRunMode ? false : explicitPersist ? true : explicitNoPersist ? false : true;

const limitRaw = getOption('limit', null);
const parsedLimit = limitRaw == null ? null : Number.parseInt(limitRaw, 10);
const rowLimit = smokeTestMode
  ? Number.isFinite(parsedLimit) && parsedLimit > 0
    ? parsedLimit
    : 5
  : Number.isFinite(parsedLimit) && parsedLimit > 0
    ? parsedLimit
    : null;

const db = new Database(dbPath, { readonly: !persistEnabled });

function mean(arr) {
  if (!arr || arr.length === 0) return null;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

function std(arr) {
  if (!arr || arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1));
}

function safeNumber(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function pFmt(p) {
  if (p == null || !Number.isFinite(p)) return 'n/a';
  if (p < 0.001) return '<.001';
  return p.toFixed(3);
}

function pctFmt(v) {
  if (v == null || !Number.isFinite(v)) return 'n/a';
  return `${(v * 100).toFixed(1)}%`;
}

function numFmt(v, digits = 2) {
  if (v == null || !Number.isFinite(v)) return 'n/a';
  return v.toFixed(digits);
}

function resolveRunIds() {
  if (runIdsFromArgs.length > 0) return runIdsFromArgs;
  try {
    const latest = db
      .prepare(
        `
      SELECT run_id, MAX(created_at) as latest_at
      FROM evaluation_results
      WHERE success = 1 AND dialogue_id IS NOT NULL
      GROUP BY run_id
      ORDER BY latest_at DESC
      LIMIT 1
    `,
      )
      .get();
    if (!latest?.run_id) return [];
    return [latest.run_id];
  } catch (err) {
    if (err.message.includes('no such table')) return [];
    throw err;
  }
}

function parseJson(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function stableStringify(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return 'null';
}

function hashObject(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

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
  };
}

function loadDialogueLog(dialogueId, cache) {
  if (!dialogueId) return null;
  if (cache.has(dialogueId)) return cache.get(dialogueId);
  const logPath = path.join(logsDir, `${dialogueId}.json`);
  if (!fs.existsSync(logPath)) {
    cache.set(dialogueId, null);
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
    cache.set(dialogueId, parsed);
    return parsed;
  } catch {
    cache.set(dialogueId, null);
    return null;
  }
}

function cleanText(v) {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractTutorTurnTextMap(row, log) {
  const byTurn = new Map();

  const turnResults = Array.isArray(log?.turnResults) ? log.turnResults : [];
  for (let i = 0; i < turnResults.length; i++) {
    const tr = turnResults[i];
    const idx = Number.isFinite(tr?.turnIndex) ? tr.turnIndex : i;
    const suggestion = tr?.suggestions?.[0];
    const text = cleanText(
      typeof suggestion === 'string'
        ? suggestion
        : suggestion?.message || suggestion?.text || suggestion?.detail || suggestion?.contextSummary,
    );
    if (text) byTurn.set(idx, text);
  }
  if (byTurn.size > 0) return byTurn;

  const fromRow = parseJson(row.suggestions, []);
  for (let i = 0; i < fromRow.length; i++) {
    const s = fromRow[i];
    const text = cleanText(typeof s === 'string' ? s : s?.message || s?.text || s?.detail || s?.contextSummary);
    if (text) byTurn.set(i, text);
  }
  if (byTurn.size > 0) return byTurn;

  const logSuggestions = Array.isArray(log?.suggestions) ? log.suggestions : [];
  for (let i = 0; i < logSuggestions.length; i++) {
    const s = logSuggestions[i];
    const text = cleanText(typeof s === 'string' ? s : s?.message || s?.text || s?.detail || s?.contextSummary);
    if (text) byTurn.set(i, text);
  }
  return byTurn;
}

function extractLearnerTurnTextMap(log) {
  const byTurn = new Map();
  const trace = Array.isArray(log?.dialogueTrace) ? log.dialogueTrace : [];

  // Prefer synthesized learner responses when present.
  const synthResponses = trace.filter((e) => e?.agent === 'learner' && e?.action === 'final_output');
  for (const e of synthResponses) {
    const idx = Number.isFinite(e?.turnIndex) ? e.turnIndex : null;
    if (idx == null) continue;
    const text = cleanText(e?.detail || e?.contextSummary || e?.message);
    if (text) byTurn.set(idx, text);
  }

  // Fill gaps from user turn actions.
  const userActions = trace.filter(
    (e) => (e?.agent === 'learner' || e?.agent === 'user') && e?.action === 'turn_action',
  );
  for (const e of userActions) {
    const idx = Number.isFinite(e?.turnIndex) ? e.turnIndex : null;
    if (idx == null || byTurn.has(idx)) continue;
    const text = cleanText(e?.detail || e?.contextSummary || e?.message);
    if (text) byTurn.set(idx, text);
  }

  const turnResults = Array.isArray(log?.turnResults) ? log.turnResults : [];
  for (let i = 0; i < turnResults.length; i++) {
    const tr = turnResults[i];
    const idx = Number.isFinite(tr?.turnIndex) ? tr.turnIndex : i;
    if (byTurn.has(idx)) continue;
    const text = cleanText(tr?.learnerMessage || tr?.learnerAction || tr?.learnerResponse);
    if (text) byTurn.set(idx, text);
  }
  return byTurn;
}

function orderedTextsByTurn(turnMap) {
  return [...turnMap.entries()].sort((a, b) => a[0] - b[0]).map(([, text]) => text);
}

function extractProxySequences(row, log) {
  const tutorByTurn = extractTutorTurnTextMap(row, log);
  const learnerByTurn = extractLearnerTurnTextMap(log);
  const sharedTurns = [...tutorByTurn.keys()].filter((k) => learnerByTurn.has(k)).sort((a, b) => a - b);

  if (sharedTurns.length >= 2) {
    return {
      tutorSeq: sharedTurns.map((k) => computeMessageComplexity100(tutorByTurn.get(k))).filter((x) => x != null),
      learnerSeq: sharedTurns.map((k) => computeMessageComplexity100(learnerByTurn.get(k))).filter((x) => x != null),
      alignedTurns: true,
      sharedTurnCount: sharedTurns.length,
    };
  }

  return {
    tutorSeq: orderedTextsByTurn(tutorByTurn)
      .map(computeMessageComplexity100)
      .filter((x) => x != null),
    learnerSeq: orderedTextsByTurn(learnerByTurn)
      .map(computeMessageComplexity100)
      .filter((x) => x != null),
    alignedTurns: false,
    sharedTurnCount: 0,
  };
}

function computeMessageComplexity100(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase();

  const words = lower
    .replace(/[^a-z0-9?\s'-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 0;

  const questionCount = (text.match(/\?/g) || []).length;
  const connectives = ['because', 'therefore', 'however', 'although', 'if', 'then', 'so', 'but', 'while', 'yet'];
  const revisionMarkers = [
    'wait',
    'actually',
    'i was wrong',
    'i see',
    'oh',
    'hmm',
    'let me think',
    'on second thought',
  ];
  const referenceMarkers = ['earlier', 'before', 'you said', 'you mentioned', 'we discussed', 'last turn'];

  const connectiveHits = connectives.filter((m) => lower.includes(m)).length;
  const revisionHits = revisionMarkers.filter((m) => lower.includes(m)).length;
  const referenceHits = referenceMarkers.filter((m) => lower.includes(m)).length;

  const wordScore = Math.min(1, words.length / 80); // depth / elaboration
  const questionScore = Math.min(1, questionCount / 3); // inquiry
  const connectiveScore = Math.min(1, connectiveHits / 4); // reasoning links
  const revisionScore = Math.min(1, revisionHits / 3); // change markers
  const referenceScore = Math.min(1, referenceHits / 3); // cross-turn integration

  const weighted =
    wordScore * 0.3 + questionScore * 0.15 + connectiveScore * 0.2 + revisionScore * 0.2 + referenceScore * 0.15;
  return weighted * 100;
}

function normalizeRubricScore(v) {
  if (!Number.isFinite(v)) return null;
  // If score looks like 1-5 rubric value, convert to 0-100
  if (v >= 1 && v <= 5) return ((v - 1) / 4) * 100;
  // Otherwise assume already 0-100 style
  return v;
}

function extractTutorRubricSequence(row, log) {
  // Primary source: DB tutor_scores JSON (per-turn judge scores, mirrors learner extraction)
  const parsed = parseJson(row?.tutor_scores, null);
  if (parsed && typeof parsed === 'object') {
    const turns = Object.values(parsed)
      .filter((x) => x && typeof x === 'object')
      .map((x) => {
        const overall = safeNumber(x.overallScore);
        if (overall != null) return { turnIndex: x.turnIndex ?? null, score: overall };

        if (x.scores && typeof x.scores === 'object') {
          const computed = calculateOverallScore(x.scores);
          if (Number.isFinite(computed)) return { turnIndex: x.turnIndex ?? null, score: computed };
        }
        return null;
      })
      .filter(Boolean);

    if (turns.length >= 2) {
      turns.sort((a, b) => {
        if (a.turnIndex == null && b.turnIndex == null) return 0;
        if (a.turnIndex == null) return 1;
        if (b.turnIndex == null) return -1;
        return a.turnIndex - b.turnIndex;
      });
      return turns.map((t) => t.score);
    }
  }

  // Fallback: dialogue log turnResults (generation-time scores)
  if (!log) return null;

  const turnScoreSeq = (log.turnResults || []).map((t) => safeNumber(t?.turnScore)).filter((x) => x != null);
  if (turnScoreSeq.length >= 2) {
    return turnScoreSeq.map((x) => Math.max(0, Math.min(100, x)));
  }

  const trajectories = log?.transformationAnalysis?.turnProgression?.dimensionTrajectories;
  if (!trajectories || typeof trajectories !== 'object') return null;

  const dimKeys = Object.keys(trajectories).filter((k) => Array.isArray(trajectories[k]));
  if (dimKeys.length === 0) return null;
  const maxTurns = Math.max(...dimKeys.map((k) => trajectories[k].length));

  const seq = [];
  for (let i = 0; i < maxTurns; i++) {
    const vals = [];
    for (const d of dimKeys) {
      const v = safeNumber(trajectories[d][i]);
      if (v != null) vals.push(normalizeRubricScore(v));
    }
    if (vals.length > 0) seq.push(mean(vals));
  }
  return seq.length >= 2 ? seq : null;
}

function isMultiAgentLearner(row, log) {
  const arch = String(row.learner_architecture || log?.learnerArchitecture || '').toLowerCase();
  return arch.includes('ego_superego') || arch.includes('psycho') || arch === 'multi_agent';
}

function extractLearnerRubricSequence(row, log) {
  const parsed = parseJson(row.learner_scores, null);
  if (!parsed || typeof parsed !== 'object') return null;
  const multiAgent = isMultiAgentLearner(row, log);

  const turns = Object.values(parsed)
    .filter((x) => x && typeof x === 'object')
    .map((x) => {
      const overall = safeNumber(x.overallScore);
      if (overall != null) return { turnIndex: x.turnIndex ?? null, score: overall };

      if (x.scores && typeof x.scores === 'object') {
        const computed = calculateLearnerOverallScore(x.scores, multiAgent);
        if (Number.isFinite(computed)) return { turnIndex: x.turnIndex ?? null, score: computed };
      }
      return null;
    })
    .filter(Boolean);

  if (turns.length < 2) return null;
  turns.sort((a, b) => {
    if (a.turnIndex == null && b.turnIndex == null) return 0;
    if (a.turnIndex == null) return 1;
    if (b.turnIndex == null) return -1;
    return a.turnIndex - b.turnIndex;
  });
  return turns.map((t) => t.score);
}

function computeSlopePerTurn(seq) {
  const n = seq.length;
  if (n < 2) return null;
  const meanX = (n - 1) / 2;
  const meanY = mean(seq);
  let cov = 0;
  let varX = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - meanX;
    cov += dx * (seq[i] - meanY);
    varX += dx * dx;
  }
  if (varX === 0) return null;
  return cov / varX;
}

function computeTrajectoryMetrics(seq) {
  if (!Array.isArray(seq) || seq.length < 2) return null;
  const cleaned = seq.map((x) => safeNumber(x)).filter((x) => x != null);
  if (cleaned.length < 2) return null;

  const first = cleaned[0];
  const last = cleaned[cleaned.length - 1];
  const deltaPts = last - first;
  const deltaRel = first !== 0 ? deltaPts / first : null;
  const slopePerTurn = computeSlopePerTurn(cleaned);
  const meanScore = mean(cleaned);
  const aucGain = meanScore - first;
  const diffs = cleaned.slice(1).map((v, i) => v - cleaned[i]);
  const volatility = std(diffs);
  const monotonicity = diffs.length > 0 ? diffs.filter((d) => d > 0).length / diffs.length : null;

  return {
    turnCount: cleaned.length,
    first,
    last,
    deltaPts,
    deltaRel,
    slopePerTurn,
    meanScore,
    aucGain,
    volatility,
    monotonicity,
  };
}

function summarizeRecords(records) {
  if (!records || records.length === 0) return null;
  const pick = (k) => records.map((r) => r[k]).filter((x) => Number.isFinite(x));
  return {
    n: records.length,
    meanTurns: mean(pick('turnCount')),
    first: mean(pick('first')),
    last: mean(pick('last')),
    deltaPts: mean(pick('deltaPts')),
    deltaPtsSd: std(pick('deltaPts')),
    deltaRel: mean(pick('deltaRel')),
    slopePerTurn: mean(pick('slopePerTurn')),
    aucGain: mean(pick('aucGain')),
    volatility: mean(pick('volatility')),
    monotonicity: mean(pick('monotonicity')),
  };
}

function buildAnovaCells(records, metricKey) {
  const cells = {};
  for (const r of records) {
    const v = r[metricKey];
    if (!Number.isFinite(v)) continue;
    if (!cells[r.cellKey]) cells[r.cellKey] = [];
    cells[r.cellKey].push(v);
  }
  return cells;
}

function runAnova(records, metricKey = 'deltaPts') {
  const cells = buildAnovaCells(records, metricKey);
  const n = Object.values(cells).reduce((s, arr) => s + arr.length, 0);
  if (n < 8) return { error: `Insufficient data for ANOVA (${n} observations)` };
  return runThreeWayANOVA(cells);
}

function printSideSummary(label, records) {
  const s = summarizeRecords(records);
  if (!s) {
    console.log(`  ${label.padEnd(12)} n=0`);
    return;
  }
  console.log(
    `  ${label.padEnd(12)} n=${String(s.n).padStart(4)} | turns=${numFmt(s.meanTurns, 2).padStart(5)} | first=${numFmt(s.first, 1).padStart(6)} | last=${numFmt(s.last, 1).padStart(6)} | delta=${numFmt(s.deltaPts, 1).padStart(6)} (sd=${numFmt(s.deltaPtsSd, 1)}) | slope=${numFmt(s.slopePerTurn, 2).padStart(6)} | aucGain=${numFmt(s.aucGain, 1).padStart(6)} | mono=${pctFmt(s.monotonicity).padStart(7)}`,
  );
}

function printAnovaSummary(title, anova) {
  if (!anova || typeof anova.error === 'string') {
    const err = typeof anova?.error === 'string' ? anova.error : 'not available';
    console.log(`    ${title}: ${err}`);
    return;
  }
  if (!anova.mainEffects) {
    console.log(`    ${title}: malformed ANOVA output`);
    return;
  }
  const me = anova.mainEffects;
  console.log(
    `    ${title}: A(recognition) F=${numFmt(me.recognition.F, 2)} p=${pFmt(me.recognition.p)}, B(tutor-arch) F=${numFmt(me.tutor.F, 2)} p=${pFmt(me.tutor.p)}, C(learner-arch) F=${numFmt(me.learner.F, 2)} p=${pFmt(me.learner.p)}`,
  );
}

function intersectionCount(recordsA, recordsB) {
  const a = new Set(recordsA.map((r) => r.dialogueId));
  const b = new Set(recordsB.map((r) => r.dialogueId));
  let count = 0;
  for (const id of a) {
    if (b.has(id)) count++;
  }
  return count;
}

function sqlNumber(v) {
  return Number.isFinite(v) ? v : null;
}

function buildSourceHash(row, log, factors) {
  return hashObject({
    runId: row.run_id,
    dialogueId: row.dialogue_id,
    scenarioId: row.scenario_id,
    profileName: row.profile_name,
    factors,
    learnerArchitecture: row.learner_architecture,
    suggestions: row.suggestions,
    learnerScores: row.learner_scores,
    dialogueLog: log,
  });
}

function buildPersistRecord(baseMeta, method, side, metrics, sourceHash, extraMeta = null) {
  return {
    runId: baseMeta.runId,
    dialogueId: baseMeta.dialogueId,
    scenarioId: baseMeta.scenarioId,
    profileName: baseMeta.profileName,
    cellKey: baseMeta.cellKey,
    method,
    side,
    metricVersion,
    sourceHash,
    turnCount: Number.isFinite(metrics.turnCount) ? Math.trunc(metrics.turnCount) : null,
    first: sqlNumber(metrics.first),
    last: sqlNumber(metrics.last),
    deltaPts: sqlNumber(metrics.deltaPts),
    deltaRel: sqlNumber(metrics.deltaRel),
    slopePerTurn: sqlNumber(metrics.slopePerTurn),
    meanScore: sqlNumber(metrics.meanScore),
    aucGain: sqlNumber(metrics.aucGain),
    volatility: sqlNumber(metrics.volatility),
    monotonicity: sqlNumber(metrics.monotonicity),
    metaJson: extraMeta ? JSON.stringify(extraMeta) : null,
  };
}

const WITHIN_TEST_METRICS_TABLE = 'within_test_change_metrics';

function hasWithinTestMetricsTable() {
  const row = db
    .prepare(
      `
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name = ?
    `,
    )
    .get(WITHIN_TEST_METRICS_TABLE);
  return Boolean(row?.name);
}

function ensureWithinTestMetricsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${WITHIN_TEST_METRICS_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      dialogue_id TEXT NOT NULL,
      scenario_id TEXT,
      profile_name TEXT,
      method TEXT NOT NULL,
      side TEXT NOT NULL,
      metric_version TEXT NOT NULL,
      source_hash TEXT NOT NULL,
      cell_key TEXT,
      turn_count INTEGER,
      first_score REAL,
      last_score REAL,
      delta_pts REAL,
      delta_rel REAL,
      slope_per_turn REAL,
      mean_score REAL,
      auc_gain REAL,
      volatility REAL,
      monotonicity REAL,
      meta_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(run_id, dialogue_id, method, side, metric_version)
    );
    CREATE INDEX IF NOT EXISTS idx_wtcm_run_method_side
      ON ${WITHIN_TEST_METRICS_TABLE} (run_id, method, side);
  `);
}

function persistWithinTestMetrics(records, { persist }) {
  const summary = {
    mode: persist ? 'persist' : 'dry-run',
    total: records.length,
    tableExists: false,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    wouldInsert: 0,
    wouldUpdate: 0,
  };

  if (records.length === 0) return summary;

  let tableExists = hasWithinTestMetricsTable();
  summary.tableExists = tableExists;

  if (persist && !tableExists) {
    ensureWithinTestMetricsTable();
    tableExists = true;
    summary.tableExists = true;
  }

  if (!tableExists) {
    summary.wouldInsert = records.length;
    return summary;
  }

  const selectStmt = db.prepare(`
    SELECT source_hash
    FROM ${WITHIN_TEST_METRICS_TABLE}
    WHERE run_id = @runId
      AND dialogue_id = @dialogueId
      AND method = @method
      AND side = @side
      AND metric_version = @metricVersion
  `);

  const insertStmt = db.prepare(`
    INSERT INTO ${WITHIN_TEST_METRICS_TABLE} (
      run_id, dialogue_id, scenario_id, profile_name,
      method, side, metric_version, source_hash, cell_key,
      turn_count, first_score, last_score, delta_pts, delta_rel,
      slope_per_turn, mean_score, auc_gain, volatility, monotonicity,
      meta_json, created_at, updated_at
    ) VALUES (
      @runId, @dialogueId, @scenarioId, @profileName,
      @method, @side, @metricVersion, @sourceHash, @cellKey,
      @turnCount, @first, @last, @deltaPts, @deltaRel,
      @slopePerTurn, @meanScore, @aucGain, @volatility, @monotonicity,
      @metaJson, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `);

  const updateStmt = db.prepare(`
    UPDATE ${WITHIN_TEST_METRICS_TABLE}
    SET
      scenario_id = @scenarioId,
      profile_name = @profileName,
      source_hash = @sourceHash,
      cell_key = @cellKey,
      turn_count = @turnCount,
      first_score = @first,
      last_score = @last,
      delta_pts = @deltaPts,
      delta_rel = @deltaRel,
      slope_per_turn = @slopePerTurn,
      mean_score = @meanScore,
      auc_gain = @aucGain,
      volatility = @volatility,
      monotonicity = @monotonicity,
      meta_json = @metaJson,
      updated_at = CURRENT_TIMESTAMP
    WHERE run_id = @runId
      AND dialogue_id = @dialogueId
      AND method = @method
      AND side = @side
      AND metric_version = @metricVersion
  `);

  const execute = () => {
    for (const record of records) {
      const existing = selectStmt.get(record);
      if (!existing) {
        if (persist) {
          insertStmt.run(record);
          summary.inserted++;
        } else {
          summary.wouldInsert++;
        }
        continue;
      }

      if (existing.source_hash === record.sourceHash) {
        summary.unchanged++;
        continue;
      }

      if (persist) {
        updateStmt.run(record);
        summary.updated++;
      } else {
        summary.wouldUpdate++;
      }
    }
  };

  if (persist) {
    const txn = db.transaction(execute);
    txn();
  } else {
    execute();
  }

  return summary;
}

const runIds = resolveRunIds();
if (runIds.length === 0) {
  console.log('No multi-turn runs found (no rows with dialogue_id).');
  process.exit(0);
}

const placeholders = runIds.map(() => '?').join(', ');
const fetchedRows = db
  .prepare(
    `
      SELECT
        id,
        run_id,
        scenario_id,
        profile_name,
        dialogue_id,
        suggestions,
        tutor_scores,
        learner_scores,
        factor_recognition,
        factor_multi_agent_tutor,
        factor_multi_agent_learner,
        learner_architecture
      FROM evaluation_results
      WHERE success = 1
        AND dialogue_id IS NOT NULL
        AND run_id IN (${placeholders})
      ORDER BY created_at
    `,
  )
  .all(...runIds);

const rows = rowLimit != null ? fetchedRows.slice(0, rowLimit) : fetchedRows;

if (rows.length === 0) {
  console.log(`No multi-turn rows found for run(s): ${runIds.join(', ')}`);
  process.exit(0);
}

const logCache = new Map();
let missingLogCount = 0;
let proxyAlignedRows = 0;
let proxyFallbackRows = 0;

const recordsByMethod = {
  tutor_rubric: [],
  learner_rubric: [],
  tutor_proxy: [],
  learner_proxy: [],
};
const persistRecords = [];

for (const row of rows) {
  const factors = resolveFactors(row);
  const log = loadDialogueLog(row.dialogue_id, logCache);
  if (!log) missingLogCount++;

  const baseMeta = {
    runId: row.run_id,
    dialogueId: row.dialogue_id,
    scenarioId: row.scenario_id,
    profileName: row.profile_name,
    cellKey: factors.cellKey,
  };
  const sourceHash = buildSourceHash(row, log, factors);

  const tutorRubricSeq = extractTutorRubricSequence(row, log);
  const tutorRubricMetrics = computeTrajectoryMetrics(tutorRubricSeq);
  if (tutorRubricMetrics) {
    recordsByMethod.tutor_rubric.push({ ...baseMeta, ...tutorRubricMetrics });
    persistRecords.push(buildPersistRecord(baseMeta, 'rubric', 'tutor', tutorRubricMetrics, sourceHash));
  }

  const learnerRubricSeq = extractLearnerRubricSequence(row, log);
  const learnerRubricMetrics = computeTrajectoryMetrics(learnerRubricSeq);
  if (learnerRubricMetrics) {
    recordsByMethod.learner_rubric.push({ ...baseMeta, ...learnerRubricMetrics });
    persistRecords.push(buildPersistRecord(baseMeta, 'rubric', 'learner', learnerRubricMetrics, sourceHash));
  }

  const proxySeqs = extractProxySequences(row, log);
  if (proxySeqs.alignedTurns) proxyAlignedRows++;
  else proxyFallbackRows++;

  const tutorProxyMetrics = computeTrajectoryMetrics(proxySeqs.tutorSeq);
  if (tutorProxyMetrics) {
    recordsByMethod.tutor_proxy.push({ ...baseMeta, ...tutorProxyMetrics });
    persistRecords.push(
      buildPersistRecord(baseMeta, 'proxy', 'tutor', tutorProxyMetrics, sourceHash, {
        alignedTurns: proxySeqs.alignedTurns,
        sharedTurnCount: proxySeqs.sharedTurnCount,
      }),
    );
  }

  const learnerProxyMetrics = computeTrajectoryMetrics(proxySeqs.learnerSeq);
  if (learnerProxyMetrics) {
    recordsByMethod.learner_proxy.push({ ...baseMeta, ...learnerProxyMetrics });
    persistRecords.push(
      buildPersistRecord(baseMeta, 'proxy', 'learner', learnerProxyMetrics, sourceHash, {
        alignedTurns: proxySeqs.alignedTurns,
        sharedTurnCount: proxySeqs.sharedTurnCount,
      }),
    );
  }
}

const persistenceSummary =
  persistEnabled || dryRunMode ? persistWithinTestMetrics(persistRecords, { persist: persistEnabled }) : null;

const headerRuns = runIds.join(', ');
console.log('='.repeat(88));
console.log('Within-Test Change Analysis (Symmetric Tutor/Learner Methods)');
console.log('='.repeat(88));
console.log(`Runs: ${headerRuns}`);
console.log(`Metric version: ${metricVersion}`);
console.log(
  `Mode: ${dryRunMode ? (smokeTestMode ? 'smoke-test (dry-run)' : 'dry-run') : persistEnabled ? 'persist' : 'analysis-only'}`,
);
if (rowLimit != null) {
  console.log(`Row limit: ${rowLimit}${smokeTestMode ? ' (smoke-test default)' : ''}`);
}
console.log(`Rows: ${rows.length} multi-turn dialogue rows`);
if (rowLimit != null && fetchedRows.length > rows.length) {
  console.log(`Rows skipped by limit: ${fetchedRows.length - rows.length}`);
}
console.log(`Logs directory: ${logsDir}`);
console.log(`Missing dialogue logs: ${missingLogCount}`);
console.log('');

const methods = [
  {
    key: 'rubric',
    tutorKey: 'tutor_rubric',
    learnerKey: 'learner_rubric',
    label: 'Method A: Rubric Trajectories (0-100)',
  },
  {
    key: 'proxy',
    tutorKey: 'tutor_proxy',
    learnerKey: 'learner_proxy',
    label: 'Method B: Text-Proxy Trajectories (0-100, aligned turns when available)',
  },
];

for (const m of methods) {
  const tutorRecords = recordsByMethod[m.tutorKey];
  const learnerRecords = recordsByMethod[m.learnerKey];
  const overlap = intersectionCount(tutorRecords, learnerRecords);

  console.log('-'.repeat(88));
  console.log(m.label);
  console.log('-'.repeat(88));
  console.log(`  Coverage: tutor=${tutorRecords.length}, learner=${learnerRecords.length}, paired=${overlap}`);
  if (m.key === 'proxy') {
    console.log(`  Turn alignment rows: aligned=${proxyAlignedRows}, fallback=${proxyFallbackRows}`);
  }
  printSideSummary('Tutor', tutorRecords);
  printSideSummary('Learner', learnerRecords);

  const tutorAnovaDelta = runAnova(tutorRecords, 'deltaPts');
  const learnerAnovaDelta = runAnova(learnerRecords, 'deltaPts');
  const tutorAnovaSlope = runAnova(tutorRecords, 'slopePerTurn');
  const learnerAnovaSlope = runAnova(learnerRecords, 'slopePerTurn');

  console.log('  ANOVA (metric = first→last delta):');
  printAnovaSummary('Tutor', tutorAnovaDelta);
  printAnovaSummary('Learner', learnerAnovaDelta);
  console.log('  ANOVA (metric = slope per turn):');
  printAnovaSummary('Tutor', tutorAnovaSlope);
  printAnovaSummary('Learner', learnerAnovaSlope);
  console.log('');
}

const tutorRubricCoverage = rows.length > 0 ? recordsByMethod.tutor_rubric.length / rows.length : 0;
if (tutorRubricCoverage < 0.5) {
  console.log('Note: Tutor rubric-trajectory coverage is low.');
  console.log(
    '  This usually means runs were generated with --skip-rubric and only final/holistic tutor scores exist.',
  );
  console.log('  Use Method B for full symmetric coverage, or add per-turn tutor re-scoring in a follow-up pass.');
  console.log('');
}

if (persistenceSummary) {
  console.log('-'.repeat(88));
  console.log('Derived Metric Persistence');
  console.log('-'.repeat(88));
  console.log(`  Target table: ${WITHIN_TEST_METRICS_TABLE}`);
  if (persistEnabled) {
    console.log(
      `  Persisted: inserted=${persistenceSummary.inserted}, updated=${persistenceSummary.updated}, unchanged=${persistenceSummary.unchanged}`,
    );
  } else {
    if (!persistenceSummary.tableExists) {
      console.log('  Dry-run: table does not exist yet; all rows would be inserted on persist.');
    }
    console.log(
      `  Dry-run plan: wouldInsert=${persistenceSummary.wouldInsert}, wouldUpdate=${persistenceSummary.wouldUpdate}, unchanged=${persistenceSummary.unchanged}`,
    );
  }
  console.log(`  Records examined: ${persistenceSummary.total}`);
  console.log('');
}

if (jsonOutPath) {
  const payload = {
    runs: runIds,
    generatedAt: new Date().toISOString(),
    metricVersion,
    mode: dryRunMode ? (smokeTestMode ? 'smoke-test' : 'dry-run') : persistEnabled ? 'persist' : 'analysis-only',
    rowsTotal: rows.length,
    missingLogs: missingLogCount,
    persistence: persistenceSummary,
    summaries: {
      rubric: {
        tutor: summarizeRecords(recordsByMethod.tutor_rubric),
        learner: summarizeRecords(recordsByMethod.learner_rubric),
      },
      proxy: {
        tutor: summarizeRecords(recordsByMethod.tutor_proxy),
        learner: summarizeRecords(recordsByMethod.learner_proxy),
      },
    },
    records: recordsByMethod,
  };
  fs.writeFileSync(jsonOutPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote JSON output: ${jsonOutPath}`);
}
