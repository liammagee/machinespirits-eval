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
    out: { type: 'string', default: '' },
    json: { type: 'boolean', default: false },
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
  --out <path>          write report to path instead of stdout
  --json                emit JSON instead of Markdown
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
      html: summary.report?.html ? relativePath(summary.report.html) : relativePath(resolved.replace(/\.json$/u, '.html')),
    },
    config: summary.config || {},
    totals: normalizeAggregates(summary.aggregates || {}),
  };
}

function dbTableExists(db, tableName) {
  return Boolean(
    db
      .prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name = ?")
      .get(tableName),
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
    groundedRate: okRows.length
      ? okRows.filter((row) => row.grounded_closure === 1).length / okRows.length
      : 0,
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
  const stamp = summary.completedAt || summary.startedAt || timestampFromRunId(summary.runId) || summary.recordedAt || '';
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
    const deltaScore = previous ? round(field.score - previous.score) : null;
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
    for (const [policy, policyTotals] of Object.entries(summary.totals.byPolicy || {})) {
      if (wanted && !wanted.has(policy)) continue;
      const normalizedTotals = normalizeAggregates({ ...policyTotals, byPolicy: {} });
      rows.push({
        runId: summary.runId,
        recordedAt: summary.recordedAt,
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
    .sort((a, b) => Number(b.latestScore ?? b.meanScore ?? 0) - Number(a.latestScore ?? a.meanScore ?? 0));
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
    notes: [
      'Cross-run field axes differ from dialogue fields: reliability, effective closure, coverage, turn efficiency, register diversity, and leak discipline.',
      'Effective closure counts grounded runs over all rows, so technical failures lower the field point.',
      'Register diversity uses entropy normalized against the v2 all-register palette size.',
      'SQL-backed summaries use tutor_stub_* tables when available; local JSON summaries and ledger entries are still accepted.',
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
      `Latest field: score ${report.latest.field.score}; reliability ${report.latest.field.reliability}; effective closure ${report.latest.field.effectiveClosure}; diversity ${report.latest.field.registerDiversity}`,
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
      { label: 'Field Score', value: (row) => row.field.score },
      { label: 'Movement', value: (row) => `${row.movement.label} (${signed(row.movement.deltaScore)})` },
      { label: 'Reports', value: (row) => [row.report.html ? `[html](${row.report.html})` : '', row.report.json ? `[json](${row.report.json})` : ''].filter(Boolean).join(' ') },
    ]),
  );
  lines.push('', '## Policy Field', '');
  lines.push(
    markdownTable(report.policySummary, [
      { label: 'Policy', value: (row) => row.policy },
      { label: 'Obs', value: (row) => row.observations },
      { label: 'Latest Score', value: (row) => row.latestScore ?? 'n/a' },
      { label: 'Mean Score', value: (row) => row.meanScore ?? 'n/a' },
      { label: 'Score Delta', value: (row) => signed(row.scoreDelta) },
      { label: 'Reliability', value: (row) => row.meanReliability ?? 'n/a' },
      { label: 'Effective Closure', value: (row) => row.meanEffectiveClosure ?? 'n/a' },
      { label: 'Mean Turns', value: (row) => row.meanTurns ?? 'n/a' },
      { label: 'Diversity', value: (row) => row.meanRegisterDiversity ?? 'n/a' },
      { label: 'Latest Registers', value: (row) => topCounts(row.latestRegisters) || 'none' },
    ]),
  );
  lines.push('', '## Notes', '');
  for (const note of report.notes) lines.push(`- ${note}`);
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
