#!/usr/bin/env node
/**
 * Summarize multiple tutor-stub auto-eval summaries as a cross-run field.
 *
 * Reads namespaced tutor-stub tables in data/evaluations.db when available,
 * plus local auto-eval JSON summaries or the ignored tutor-stub auto-eval
 * ledger, and emits a compact Markdown or JSON report.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import Database from 'better-sqlite3';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DB = process.env.EVAL_DB_PATH || path.join(ROOT, 'data', 'evaluations.db');
const DEFAULT_LEDGER = '.tutor-stub-auto-eval/ledger.jsonl';
const DEFAULT_SEARCH_DIR = '.tutor-stub-auto-eval';
const MAX_REGISTER_TYPES = 9;

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    db: { type: 'string', default: DEFAULT_DB },
    ledger: { type: 'string', default: DEFAULT_LEDGER },
    dir: { type: 'string', default: DEFAULT_SEARCH_DIR },
    latest: { type: 'string', default: '12' },
    policies: { type: 'string', default: '' },
    'baseline-policy': { type: 'string', default: 'bland' },
    out: { type: 'string', default: '' },
    json: { type: 'boolean', default: false },
    qa: { type: 'boolean', default: false },
    'include-dry-run': { type: 'boolean', default: false },
    'no-db': { type: 'boolean', default: false },
    'no-ledger': { type: 'boolean', default: false },
    'no-dir': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function usage() {
  console.log(`Usage:
  node scripts/analyze-tutor-stub-auto-evals.js [auto-eval.json ...] [options]

Options:
  --db <path>           evaluation DB with tutor_stub_* tables
                        (default: EVAL_DB_PATH or data/evaluations.db)
  --ledger <path>       ledger JSONL to read when no files are supplied
                        (default: ${DEFAULT_LEDGER})
  --dir <path>          fallback discovery dir when no ledger exists
                        (default: ${DEFAULT_SEARCH_DIR})
  --latest <n>          keep the latest n evals after sorting (default: 12)
  --policies <csv>      limit policy field rows
  --baseline-policy <p> policy used for QA deltas (default: bland)
  --out <path>          write report to path instead of stdout
  --json                emit JSON instead of Markdown
  --qa                  include QA policy-by-learner robustness tables
  --include-dry-run     keep dry-run evals
  --no-db               skip tutor_stub_* SQL tables
  --no-ledger           ignore ledger and auto-discover summaries
  --no-dir              skip auto-discovery from --dir
`);
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function relativePath(value) {
  if (!value) return null;
  return path.relative(ROOT, resolvePath(value));
}

function parsePositiveInt(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function csv(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizePolicyName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/-/gu, '_');
}

function clamp01(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function round(value, digits = 3) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Number(numeric.toFixed(digits));
}

function mean(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  if (!finite.length) return null;
  return round(finite.reduce((sum, value) => sum + value, 0) / finite.length);
}

function min(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  if (!finite.length) return null;
  return round(Math.min(...finite));
}

function max(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  if (!finite.length) return null;
  return round(Math.max(...finite));
}

function stddev(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  if (finite.length < 2) return 0;
  const avg = finite.reduce((sum, value) => sum + value, 0) / finite.length;
  const variance = finite.reduce((sum, value) => sum + (value - avg) ** 2, 0) / finite.length;
  return round(Math.sqrt(variance));
}

function parseJson(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function sumCounts(...countsObjects) {
  const out = {};
  for (const counts of countsObjects) {
    for (const [key, value] of Object.entries(counts || {})) {
      out[key] = (out[key] || 0) + Number(value || 0);
    }
  }
  return Object.fromEntries(Object.entries(out).filter(([, value]) => value > 0));
}

function entropyFromCounts(counts = {}) {
  const total = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
  if (!total) return 0;
  let entropy = 0;
  for (const count of Object.values(counts)) {
    const p = Number(count || 0) / total;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return round(entropy);
}

function topCounts(counts = {}, limit = 5) {
  return Object.entries(counts)
    .sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, value]) => `${key}:${value}`)
    .join(', ');
}

function normalizeAggregates(aggregates = {}) {
  const byPolicy = aggregates.byPolicy || {};
  const policyRegisterCounts = sumCounts(...Object.values(byPolicy).map((row) => row.registerCounts || {}));
  const registerCounts = Object.keys(aggregates.registerCounts || {}).length
    ? aggregates.registerCounts
    : policyRegisterCounts;
  const registerEntropy = Number.isFinite(Number(aggregates.registerEntropy))
    ? Number(aggregates.registerEntropy)
    : entropyFromCounts(registerCounts);
  return {
    rows: Number(aggregates.rows || 0),
    completed: Number(aggregates.completed ?? aggregates.rows ?? 0),
    ok: Number(aggregates.ok || 0),
    failed: Number(aggregates.failed || 0),
    dryRun: Number(aggregates.dryRun || 0),
    grounded: Number(aggregates.grounded || 0),
    groundedRate: Number(aggregates.groundedRate || 0),
    meanTurns: Number(aggregates.meanTurns || 0),
    meanCoverage: Number(aggregates.meanCoverage || 0),
    meanMissing: Number(aggregates.meanMissing || 0),
    registerCounts,
    registerEntropy,
    leakCount: Number(aggregates.leakCount || 0),
    errorCount: Number(aggregates.errorCount || 0),
    byPolicy,
  };
}

function summaryFromFile(filePath) {
  const resolved = resolvePath(filePath);
  const summary = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  return {
    source: 'file',
    runId: path.basename(resolved, '.json'),
    startedAt: summary.startedAt || null,
    completedAt: summary.completedAt || null,
    recordedAt: summary.completedAt || summary.startedAt || fs.statSync(resolved).mtime.toISOString(),
    report: {
      json: relativePath(resolved),
      html: summary.report?.html
        ? relativePath(summary.report.html)
        : relativePath(resolved.replace(/\.json$/u, '.html')),
    },
    config: summary.config || {},
    totals: normalizeAggregates(summary.aggregates || {}),
  };
}

function dbTableExists(db, tableName) {
  return Boolean(
    db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name = ?").get(tableName),
  );
}

function dbRowsForRun(db, runId) {
  if (!dbTableExists(db, 'tutor_stub_eval_rows')) return [];
  return db
    .prepare(
      `SELECT
        policy, run_index, status, turn_count, grounded_closure,
        best_path_coverage, missing_premise_count, register_counts_json,
        leak_count, error_count, register_entropy
       FROM tutor_stub_eval_rows
       WHERE eval_run_id = ?`,
    )
    .all(runId);
}

function summarizeDbBucket(rows) {
  const liveRows = rows.filter((row) => row.status !== 'dry_run');
  const okRows = liveRows.filter((row) => row.status === 'ok');
  const registerCounts = sumCounts(...okRows.map((row) => parseJson(row.register_counts_json, {})));
  return {
    rows: rows.length,
    completed: liveRows.length,
    ok: okRows.length,
    failed: liveRows.filter((row) => row.status === 'failed').length,
    dryRun: rows.filter((row) => row.status === 'dry_run').length,
    grounded: okRows.filter((row) => row.grounded_closure === 1).length,
    groundedRate: okRows.length ? okRows.filter((row) => row.grounded_closure === 1).length / okRows.length : 0,
    meanTurns: mean(okRows.map((row) => row.turn_count)) ?? 0,
    meanCoverage: mean(okRows.map((row) => row.best_path_coverage)) ?? 0,
    meanMissing: mean(okRows.map((row) => row.missing_premise_count)) ?? 0,
    registerCounts,
    registerEntropy: entropyFromCounts(registerCounts),
    leakCount: okRows.reduce((sum, row) => sum + Number(row.leak_count || 0), 0),
    errorCount: okRows.reduce((sum, row) => sum + Number(row.error_count || 0), 0),
  };
}

function dbAggregatesForRun(db, runId) {
  const rows = dbRowsForRun(db, runId);
  const byPolicyRows = new Map();
  for (const row of rows) {
    const policy = row.policy || 'unknown';
    if (!byPolicyRows.has(policy)) byPolicyRows.set(policy, []);
    byPolicyRows.get(policy).push(row);
  }
  const totals = summarizeDbBucket(rows);
  totals.byPolicy = Object.fromEntries(
    [...byPolicyRows.entries()].map(([policy, policyRows]) => [policy, summarizeDbBucket(policyRows)]),
  );
  return totals;
}

function summaryFromDbRun(row, db) {
  const config = {
    ...parseJson(row.config_json, {}),
  };
  if (!Array.isArray(config.policies)) config.policies = parseJson(row.policies_json, []);
  if (!config.world) config.world = row.world || null;
  if (!config.model) config.model = row.model || null;
  if (!config.analysisModel) config.analysisModel = row.analysis_model || null;
  if (!config.autoLearnerModel) config.autoLearnerModel = row.auto_learner_model || null;
  if (!config.autoLearnerProfileId) config.autoLearnerProfileId = row.auto_learner_profile_id || null;
  const aggregateJson = parseJson(row.aggregates_json, null);
  const totals = aggregateJson?.byPolicy ? aggregateJson : dbAggregatesForRun(db, row.id);
  return {
    source: 'db',
    runId: row.source_run_id || row.id,
    startedAt: row.started_at || null,
    completedAt: row.completed_at || null,
    recordedAt: row.completed_at || row.started_at || row.ingested_at || null,
    report: {
      json: row.summary_path || null,
      html: row.html_path || null,
    },
    config,
    totals: normalizeAggregates(totals),
  };
}

function readDbSummaries(dbPath) {
  const resolved = resolvePath(dbPath);
  if (!fs.existsSync(resolved)) return [];
  let db;
  try {
    db = new Database(resolved, { readonly: true, fileMustExist: true });
    if (!dbTableExists(db, 'tutor_stub_eval_runs')) return [];
    return db
      .prepare(
        `SELECT *
         FROM tutor_stub_eval_runs
         ORDER BY COALESCE(completed_at, started_at, ingested_at, id) DESC`,
      )
      .all()
      .map((row) => summaryFromDbRun(row, db));
  } catch {
    return [];
  } finally {
    if (db) db.close();
  }
}

function summaryFromLedgerEntry(entry) {
  const byPolicy = Object.fromEntries(
    Object.entries(entry.byPolicy || {}).map(([policy, row]) => [
      policy,
      {
        ...row,
        registerCounts: row.registerCounts || {},
      },
    ]),
  );
  return {
    source: 'ledger',
    runId: entry.runId || path.basename(entry.report?.json || 'auto-eval', '.json'),
    startedAt: entry.startedAt || null,
    completedAt: entry.completedAt || null,
    recordedAt: entry.recordedAt || entry.completedAt || entry.startedAt || null,
    report: entry.report || {},
    config: entry.config || {},
    totals: normalizeAggregates({
      ...(entry.totals || {}),
      byPolicy,
    }),
  };
}

function timestampFromRunId(runId) {
  const match = String(runId || '').match(/auto-eval-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/u);
  if (!match) return null;
  return match[1].replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/u, 'T$1:$2:$3.$4Z');
}

function readLedger(ledgerPath) {
  const resolved = resolvePath(ledgerPath);
  if (!fs.existsSync(resolved)) return [];
  return fs
    .readFileSync(resolved, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return summaryFromLedgerEntry(JSON.parse(line));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function discoverSummaries(dir) {
  const root = resolvePath(dir);
  if (!fs.existsSync(root)) return [];
  const out = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(next);
      } else if (/auto-eval-.*\.json$/u.test(entry.name)) {
        out.push(next);
      }
    }
  }
  walk(root);
  return out.map(summaryFromFile);
}

function dedupeSummaries(summaries) {
  const byRunId = new Map();
  for (const summary of summaries) {
    const key = summary.runId || summary.report?.json;
    if (!key || byRunId.has(key)) continue;
    byRunId.set(key, summary);
  }
  return [...byRunId.values()];
}

function sourceBreakdown(summaries) {
  const out = {};
  for (const summary of summaries) {
    const source = summary.source || 'unknown';
    out[source] = (out[source] || 0) + 1;
  }
  return out;
}

function evalTime(summary) {
  const stamp =
    summary.completedAt || summary.startedAt || timestampFromRunId(summary.runId) || summary.recordedAt || '';
  const millis = Date.parse(stamp);
  return Number.isFinite(millis) ? millis : 0;
}

function failureRate(totals) {
  const rows = Number(totals.rows || 0);
  return rows ? clamp01(Number(totals.failed || 0) / rows) : 0;
}

function effectiveClosure(totals) {
  const rows = Number(totals.rows || 0);
  return rows ? clamp01(Number(totals.grounded || 0) / rows) : 0;
}

function runFieldPoint(summary, totals = summary.totals) {
  const rows = Number(totals.rows || 0);
  const ok = Number(totals.ok || 0);
  const meanTurns = Number(totals.meanTurns || 0);
  const totalTurns = ok * meanTurns;
  const registerEntropy = Number.isFinite(Number(totals.registerEntropy))
    ? Number(totals.registerEntropy)
    : entropyFromCounts(totals.registerCounts);
  const point = {
    reliability: rows ? clamp01(ok / rows) : 0,
    effectiveClosure: effectiveClosure(totals),
    closureWhenCompleted: ok ? clamp01(Number(totals.grounded || 0) / ok) : 0,
    coverage: clamp01(totals.meanCoverage || 0),
    turnEfficiency: clamp01(1 - meanTurns / 120),
    registerDiversity: clamp01(registerEntropy / Math.log2(MAX_REGISTER_TYPES)),
    leakDiscipline: clamp01(1 - Number(totals.leakCount || 0) / Math.max(1, totalTurns)),
    failureRate: failureRate(totals),
    meanTurns: round(meanTurns),
    registerEntropy: round(registerEntropy),
  };
  // Outcome-only composite: every term is a channel the register policy does
  // not control by construction. registerDiversity is EXCLUDED — it is a
  // direct readout of the policy under test (zero for bland by definition),
  // so any composite that includes it manufactures an adaptive-vs-bland gap
  // even when all outcome channels are tied at ceiling. Policy comparisons
  // must use this score.
  point.outcomeScore = round(
    0.26 * point.reliability +
      0.26 * point.effectiveClosure +
      0.18 * point.coverage +
      0.16 * point.turnEfficiency +
      0.14 * point.leakDiscipline,
  );
  // Legacy process composite (includes registerDiversity). Kept only for
  // trend continuity in cross-run trajectories; never use it to rank policies.
  point.score = round(
    0.22 * point.reliability +
      0.22 * point.effectiveClosure +
      0.16 * point.coverage +
      0.14 * point.turnEfficiency +
      0.14 * point.registerDiversity +
      0.12 * point.leakDiscipline,
  );
  return point;
}

function movementLabel(deltaScore) {
  if (deltaScore === null) return 'baseline';
  if (deltaScore >= 0.05) return 'improved';
  if (deltaScore <= -0.05) return 'weakened';
  return 'mostly flat';
}

function buildRunTrajectory(summaries) {
  return summaries.map((summary, index) => {
    const field = runFieldPoint(summary);
    const previous = index > 0 ? runFieldPoint(summaries[index - 1]) : null;
    // Movement is labeled from the outcome-only delta; the process delta
    // (incl. registerDiversity) rides along for trend continuity.
    const deltaScore = previous ? round(field.outcomeScore - previous.outcomeScore) : null;
    const deltaProcessScore = previous ? round(field.score - previous.score) : null;
    return {
      runId: summary.runId,
      recordedAt: summary.recordedAt,
      report: summary.report,
      policies: summary.config?.policies || Object.keys(summary.totals.byPolicy || {}),
      totals: {
        rows: summary.totals.rows,
        ok: summary.totals.ok,
        failed: summary.totals.failed,
        grounded: summary.totals.grounded,
        meanTurns: summary.totals.meanTurns,
      },
      field,
      movement: {
        label: movementLabel(deltaScore),
        deltaScore,
        deltaProcessScore,
        deltaReliability: previous ? round(field.reliability - previous.reliability) : null,
        deltaClosure: previous ? round(field.effectiveClosure - previous.effectiveClosure) : null,
        deltaTurns: previous ? round(field.meanTurns - previous.meanTurns) : null,
        deltaDiversity: previous ? round(field.registerDiversity - previous.registerDiversity) : null,
      },
    };
  });
}

function policyFieldRows(summaries, selectedPolicies) {
  const wanted = selectedPolicies.length ? new Set(selectedPolicies) : null;
  const rows = [];
  for (const summary of summaries) {
    const learnerProfile = summary.config?.autoLearnerProfileId || summary.config?.autoLearnerProfile || 'unknown';
    for (const [policy, policyTotals] of Object.entries(summary.totals.byPolicy || {})) {
      if (wanted && !wanted.has(policy)) continue;
      const normalizedTotals = normalizeAggregates({ ...policyTotals, byPolicy: {} });
      rows.push({
        runId: summary.runId,
        recordedAt: summary.recordedAt,
        learnerProfile,
        world: summary.config?.world || null,
        policy,
        totals: {
          rows: normalizedTotals.rows,
          ok: normalizedTotals.ok,
          failed: normalizedTotals.failed,
          grounded: normalizedTotals.grounded,
          meanTurns: normalizedTotals.meanTurns,
          meanCoverage: normalizedTotals.meanCoverage,
          meanMissing: normalizedTotals.meanMissing,
          registerCounts: normalizedTotals.registerCounts,
          registerEntropy: normalizedTotals.registerEntropy,
        },
        field: runFieldPoint(summary, normalizedTotals),
      });
    }
  }
  return rows;
}

function sortPolicyNames(policies) {
  const preferred = [
    'bland',
    'random',
    'dynamic',
    'state',
    'field',
    'trajectory',
    'dynamical_system',
    'empirical_dynamical_system',
    'continuous_dynamical_system',
    'continuous_empirical_dynamical_system',
    'negative',
  ];
  return policies.slice().sort((left, right) => {
    const leftIndex = preferred.indexOf(left);
    const rightIndex = preferred.indexOf(right);
    const leftRank = leftIndex === -1 ? preferred.length : leftIndex;
    const rightRank = rightIndex === -1 ? preferred.length : rightIndex;
    return leftRank - rightRank || left.localeCompare(right);
  });
}

function cellSummary(rows) {
  const totalsRows = rows.map((row) => row.totals || {});
  const fields = rows.map((row) => row.field || {});
  const score = mean(fields.map((field) => field.score));
  return {
    observations: rows.length,
    score,
    outcomeScore: mean(fields.map((field) => field.outcomeScore)),
    reliability: mean(fields.map((field) => field.reliability)),
    effectiveClosure: mean(fields.map((field) => field.effectiveClosure)),
    coverage: mean(fields.map((field) => field.coverage)),
    meanTurns: mean(totalsRows.map((totals) => totals.meanTurns)),
    meanMissing: mean(totalsRows.map((totals) => totals.meanMissing)),
    failureRate: mean(fields.map((field) => field.failureRate)),
    registerDiversity: mean(fields.map((field) => field.registerDiversity)),
  };
}

function summarizePolicyRobustness(cells, learnerProfiles, baselinePolicy) {
  const byPolicy = new Map();
  for (const cell of cells) {
    if (!byPolicy.has(cell.policy)) byPolicy.set(cell.policy, []);
    byPolicy.get(cell.policy).push(cell);
  }
  return sortPolicyNames([...byPolicy.keys()])
    .map((policy) => {
      const policyCells = byPolicy.get(policy) || [];
      // Policy ranking, spreads, and the robustness verdict all run on the
      // outcome-only score; the process score (incl. registerDiversity) is
      // carried as a clearly-labeled side channel.
      const outcomeScores = policyCells.map((cell) => cell.outcomeScore);
      const processScores = policyCells.map((cell) => cell.score);
      const deltas = policyCells.map((cell) => cell.deltaVsBaseline).filter((value) => value !== null);
      const observedLearners = policyCells.filter((cell) => cell.observations > 0).length;
      const learnerCoverage = learnerProfiles.length ? round(observedLearners / learnerProfiles.length) : 0;
      const worstScore = min(outcomeScores);
      const meanScore = mean(outcomeScores);
      return {
        policy,
        baselinePolicy,
        observedLearners,
        learnerCoverage,
        observations: policyCells.reduce((sum, cell) => sum + Number(cell.observations || 0), 0),
        meanScore,
        worstScore,
        bestScore: max(outcomeScores),
        scoreStddev: stddev(outcomeScores),
        meanProcessScore: mean(processScores),
        worstProcessScore: min(processScores),
        meanRegisterDiversity: mean(policyCells.map((cell) => cell.registerDiversity)),
        meanDeltaVsBaseline: deltas.length ? mean(deltas) : null,
        worstDeltaVsBaseline: deltas.length ? min(deltas) : null,
        meanEffectiveClosure: mean(policyCells.map((cell) => cell.effectiveClosure)),
        worstEffectiveClosure: min(policyCells.map((cell) => cell.effectiveClosure)),
        meanCoverage: mean(policyCells.map((cell) => cell.coverage)),
        meanTurns: mean(policyCells.map((cell) => cell.meanTurns)),
        meanFailureRate: mean(policyCells.map((cell) => cell.failureRate)),
        qaInterpretation:
          learnerCoverage < 1
            ? 'incomplete learner coverage'
            : worstScore !== null && meanScore !== null && meanScore - worstScore >= 0.12
              ? 'learner-sensitive'
              : 'robust across observed learners',
      };
    })
    .sort((left, right) => {
      const worstDelta = Number(right.worstScore ?? -Infinity) - Number(left.worstScore ?? -Infinity);
      if (worstDelta) return worstDelta;
      const meanDelta = Number(right.meanScore ?? -Infinity) - Number(left.meanScore ?? -Infinity);
      if (meanDelta) return meanDelta;
      return left.policy.localeCompare(right.policy);
    });
}

function buildQaMatrix(policyRows, { baselinePolicy = 'bland' } = {}) {
  const learnerProfiles = Array.from(new Set(policyRows.map((row) => row.learnerProfile || 'unknown'))).sort((a, b) =>
    a.localeCompare(b),
  );
  const policies = sortPolicyNames(Array.from(new Set(policyRows.map((row) => row.policy))));
  const rowsByLearnerPolicy = new Map();
  for (const row of policyRows) {
    const key = `${row.learnerProfile || 'unknown'}\u0000${row.policy}`;
    if (!rowsByLearnerPolicy.has(key)) rowsByLearnerPolicy.set(key, []);
    rowsByLearnerPolicy.get(key).push(row);
  }
  const baselineByLearner = new Map();
  const cells = [];
  for (const learnerProfile of learnerProfiles) {
    const baselineRows = rowsByLearnerPolicy.get(`${learnerProfile}\u0000${baselinePolicy}`) || [];
    const baseline = baselineRows.length ? cellSummary(baselineRows) : null;
    if (baseline) baselineByLearner.set(learnerProfile, baseline);
    for (const policy of policies) {
      const rows = rowsByLearnerPolicy.get(`${learnerProfile}\u0000${policy}`) || [];
      if (!rows.length) continue;
      const cell = {
        learnerProfile,
        policy,
        ...cellSummary(rows),
      };
      const learnerBaseline = baselineByLearner.get(learnerProfile);
      // Headline delta is OUTCOME-only. The legacy process delta (which
      // includes registerDiversity) is kept under an explicit name so no
      // report can silently present it as a policy effect.
      cell.deltaVsBaseline =
        learnerBaseline && cell.outcomeScore !== null && learnerBaseline.outcomeScore !== null
          ? round(cell.outcomeScore - learnerBaseline.outcomeScore)
          : null;
      cell.processScoreDeltaVsBaseline =
        learnerBaseline && cell.score !== null && learnerBaseline.score !== null
          ? round(cell.score - learnerBaseline.score)
          : null;
      cells.push(cell);
    }
  }
  return {
    schema: 'machinespirits.tutor-stub.qa-matrix.v1',
    baselinePolicy,
    learnerProfiles,
    policies,
    cells,
    policyRobustness: summarizePolicyRobustness(cells, learnerProfiles, baselinePolicy),
    notes: [
      'QA robustness aggregates policy rows by automated learner profile before ranking policies.',
      `Delta columns compare each policy against ${baselinePolicy} within the same learner profile when that baseline is present.`,
      'Worst score is intentionally prominent: a policy that only works for diligent learners should not outrank one that holds up across harder learner profiles.',
      'Scores and deltas here are OUTCOME-only (reliability, closure, coverage, turn efficiency, leak discipline). Register diversity is reported separately and never enters policy rankings: it is a direct readout of the policy under test and would manufacture an adaptive-vs-bland gap at outcome ceiling.',
    ],
  };
}

function summarizePolicies(policyRows) {
  const byPolicy = new Map();
  for (const row of policyRows) {
    if (!byPolicy.has(row.policy)) byPolicy.set(row.policy, []);
    byPolicy.get(row.policy).push(row);
  }
  return [...byPolicy.entries()]
    .map(([policy, rows]) => {
      const sorted = rows.slice().sort((a, b) => Date.parse(a.recordedAt || '') - Date.parse(b.recordedAt || ''));
      const first = sorted[0];
      const last = sorted.at(-1);
      return {
        policy,
        observations: rows.length,
        meanOutcomeScore: mean(rows.map((row) => row.field.outcomeScore)),
        latestOutcomeScore: last?.field.outcomeScore ?? null,
        meanScore: mean(rows.map((row) => row.field.score)),
        meanReliability: mean(rows.map((row) => row.field.reliability)),
        meanEffectiveClosure: mean(rows.map((row) => row.field.effectiveClosure)),
        meanTurns: mean(rows.map((row) => row.totals.meanTurns)),
        meanRegisterDiversity: mean(rows.map((row) => row.field.registerDiversity)),
        latestScore: last?.field.score ?? null,
        scoreDelta: first && last && first !== last ? round(last.field.score - first.field.score) : null,
        latestRegisters: last?.totals.registerCounts || {},
      };
    })
    .sort(
      (a, b) =>
        Number(b.latestOutcomeScore ?? b.meanOutcomeScore ?? 0) -
        Number(a.latestOutcomeScore ?? a.meanOutcomeScore ?? 0),
    );
}

function buildReport(summaries) {
  const selectedPolicies = csv(args.policies);
  const filtered = summaries
    .filter((summary) => args['include-dry-run'] || !summary.config?.dryRun)
    .sort((a, b) => evalTime(a) - evalTime(b))
    .slice(-parsePositiveInt(args.latest, '--latest'));
  const trajectory = buildRunTrajectory(filtered);
  const policies = policyFieldRows(filtered, selectedPolicies);
  const policySummary = summarizePolicies(policies);
  const qaMatrix = buildQaMatrix(policies, { baselinePolicy: normalizePolicyName(args['baseline-policy']) || 'bland' });
  const latest = trajectory.at(-1) || null;
  return {
    schema: 'machinespirits.tutor-stub.cross-run-field.v1',
    generatedAt: new Date().toISOString(),
    sourceCount: summaries.length,
    sources: sourceBreakdown(summaries),
    evalCount: filtered.length,
    latest: latest
      ? {
          runId: latest.runId,
          field: latest.field,
          totals: latest.totals,
        }
      : null,
    trajectory,
    policySummary,
    qaMatrix,
    notes: [
      'Policy comparisons use the OUTCOME-only score (reliability, effective closure, coverage, turn efficiency, leak discipline). The process score additionally includes register diversity — a channel the policy under test controls directly — and must never be used to rank policies.',
      'Cross-run field axes differ from dialogue fields: reliability, effective closure, coverage, turn efficiency, register diversity, and leak discipline.',
      'Effective closure counts grounded runs over all rows, so technical failures lower the field point.',
      'Register diversity uses entropy normalized against the v2 all-register palette size.',
      'SQL-backed summaries use tutor_stub_* tables when available; local JSON summaries and ledger entries are still accepted.',
      'QA robustness compares policies across automated learner profiles when summaries include multiple learner profiles.',
    ],
  };
}

function signed(value) {
  if (value === null || value === undefined) return 'n/a';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'n/a';
  return `${numeric >= 0 ? '+' : ''}${numeric}`;
}

function markdownTable(rows, columns) {
  const header = `| ${columns.map((column) => column.label).join(' | ')} |`;
  const sep = `|${columns.map(() => '---').join('|')}|`;
  const body = rows.map((row) => `| ${columns.map((column) => column.value(row)).join(' | ')} |`);
  return [header, sep, ...body].join('\n');
}

function renderMarkdown(report) {
  const lines = [
    '# Tutor Stub Cross-Run Field',
    '',
    `Generated: ${report.generatedAt}`,
    `Evals: ${report.evalCount} shown (${report.sourceCount} source entr${report.sourceCount === 1 ? 'y' : 'ies'})`,
    `Sources: ${Object.entries(report.sources || {})
      .map(([source, count]) => `${source}:${count}`)
      .join(', ')}`,
    '',
  ];
  if (report.latest) {
    lines.push(
      `Latest field: outcome score ${report.latest.field.outcomeScore}; process score ${report.latest.field.score}; reliability ${report.latest.field.reliability}; effective closure ${report.latest.field.effectiveClosure}; diversity ${report.latest.field.registerDiversity}`,
      '',
    );
  }

  lines.push('## Run Trajectory', '');
  lines.push(
    markdownTable(report.trajectory, [
      { label: 'Run', value: (row) => row.runId },
      { label: 'OK/Failed', value: (row) => `${row.totals.ok}/${row.totals.failed}` },
      { label: 'Grounded', value: (row) => row.totals.grounded },
      { label: 'Mean Turns', value: (row) => row.totals.meanTurns },
      { label: 'Outcome Score', value: (row) => row.field.outcomeScore },
      { label: 'Movement', value: (row) => `${row.movement.label} (${signed(row.movement.deltaScore)})` },
      {
        label: 'Reports',
        value: (row) =>
          [row.report.html ? `[html](${row.report.html})` : '', row.report.json ? `[json](${row.report.json})` : '']
            .filter(Boolean)
            .join(' '),
      },
    ]),
  );
  lines.push('', '## Policy Field', '');
  lines.push(
    markdownTable(report.policySummary, [
      { label: 'Policy', value: (row) => row.policy },
      { label: 'Obs', value: (row) => row.observations },
      { label: 'Outcome Score', value: (row) => row.latestOutcomeScore ?? row.meanOutcomeScore ?? 'n/a' },
      { label: 'Mean Outcome', value: (row) => row.meanOutcomeScore ?? 'n/a' },
      { label: 'Reliability', value: (row) => row.meanReliability ?? 'n/a' },
      { label: 'Effective Closure', value: (row) => row.meanEffectiveClosure ?? 'n/a' },
      { label: 'Mean Turns', value: (row) => row.meanTurns ?? 'n/a' },
      { label: 'Diversity (process)', value: (row) => row.meanRegisterDiversity ?? 'n/a' },
      { label: 'Process Score', value: (row) => row.meanScore ?? 'n/a' },
      { label: 'Latest Registers', value: (row) => topCounts(row.latestRegisters) || 'none' },
    ]),
  );
  const showQa = args.qa || (report.qaMatrix?.learnerProfiles?.length || 0) > 1;
  if (showQa && report.qaMatrix?.policyRobustness?.length) {
    lines.push('', '## QA Policy Robustness', '');
    lines.push(
      markdownTable(report.qaMatrix.policyRobustness, [
        { label: 'Policy', value: (row) => row.policy },
        { label: 'Learners', value: (row) => `${row.observedLearners}/${report.qaMatrix.learnerProfiles.length}` },
        { label: 'Worst Outcome', value: (row) => row.worstScore ?? 'n/a' },
        { label: 'Mean Outcome', value: (row) => row.meanScore ?? 'n/a' },
        { label: `Mean Delta vs ${report.qaMatrix.baselinePolicy}`, value: (row) => signed(row.meanDeltaVsBaseline) },
        { label: `Worst Delta vs ${report.qaMatrix.baselinePolicy}`, value: (row) => signed(row.worstDeltaVsBaseline) },
        { label: 'Closure', value: (row) => row.meanEffectiveClosure ?? 'n/a' },
        { label: 'Coverage', value: (row) => row.meanCoverage ?? 'n/a' },
        { label: 'Turns', value: (row) => row.meanTurns ?? 'n/a' },
        { label: 'Failures', value: (row) => row.meanFailureRate ?? 'n/a' },
        { label: 'Diversity (process)', value: (row) => row.meanRegisterDiversity ?? 'n/a' },
        { label: 'QA Read', value: (row) => row.qaInterpretation },
      ]),
    );
    lines.push('', '## QA Learner Matrix', '');
    lines.push(
      markdownTable(
        report.qaMatrix.learnerProfiles.map((learnerProfile) => ({ learnerProfile })),
        [
          { label: 'Learner', value: (row) => row.learnerProfile },
          ...report.qaMatrix.policies.map((policy) => ({
            label: policy,
            value: (row) => {
              const cell = report.qaMatrix.cells.find(
                (candidate) => candidate.learnerProfile === row.learnerProfile && candidate.policy === policy,
              );
              if (!cell) return 'n/a';
              const delta = cell.deltaVsBaseline === null ? '' : ` (${signed(cell.deltaVsBaseline)})`;
              return `${cell.outcomeScore ?? 'n/a'}${delta}`;
            },
          })),
        ],
      ),
    );
    lines.push(
      '',
      'Matrix cells show the OUTCOME-only QA score, with parenthesized same-learner outcome delta against the configured baseline when available. Register diversity is reported separately and never enters these cells.',
      '',
    );
  }
  lines.push('', '## Notes', '');
  for (const note of report.notes) lines.push(`- ${note}`);
  for (const note of report.qaMatrix?.notes || []) lines.push(`- ${note}`);
  lines.push('');
  return lines.join('\n');
}

function loadInputs() {
  if (positionals.length) return positionals.map(summaryFromFile);
  const dbRows = args['no-db'] ? [] : readDbSummaries(args.db);
  const ledgerRows = args['no-ledger'] ? [] : readLedger(args.ledger);
  const dirRows = args['no-dir'] ? [] : discoverSummaries(args.dir);
  return dedupeSummaries([...dbRows, ...ledgerRows, ...dirRows]);
}

function main() {
  if (args.help) {
    usage();
    return;
  }
  const summaries = loadInputs();
  if (!summaries.length) {
    throw new Error('No tutor-stub auto-eval summaries found. Pass JSON files, --ledger, or --dir.');
  }
  const report = buildReport(summaries);
  const rendered = args.json ? `${JSON.stringify(report, null, 2)}\n` : renderMarkdown(report);
  if (args.out) {
    const outPath = resolvePath(args.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, rendered);
    console.log(`[cross-run-field] wrote ${outPath}`);
  } else {
    process.stdout.write(rendered);
  }
}

try {
  main();
} catch (error) {
  console.error(`[cross-run-field] error: ${error.message}`);
  process.exit(1);
}
