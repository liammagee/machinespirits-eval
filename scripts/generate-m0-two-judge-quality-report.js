#!/usr/bin/env node
/**
 * Generate the ignored M0 two-judge adaptive-quality report cited by
 * docs/research/paper-full-2.0.md §6.12.4.
 *
 * The adaptive grader has a single DB column family, so the recovery path keeps
 * the DB-side judge intact and reads the other judge from an external JSON file
 * produced by scripts/rejudge-adaptive-inter-rater.js.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { openEvaluationDbReadonly, describeMissingEvaluationDb } from '../services/evaluationDbReadonly.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

export const M0_RUNS = [
  {
    suite: 'cross-suite',
    arm: 'baseline',
    runId: 'eval-2026-06-20-af7c2353',
    profile: 'cell_136_plan2_closed_loop_crosssuite',
  },
  {
    suite: 'cross-suite',
    arm: 'treatment',
    runId: 'eval-2026-06-20-d51e169e',
    profile: 'cell_150_plan2_quality_repeat_contextual_crosssuite',
  },
  {
    suite: 'paired',
    arm: 'baseline',
    runId: 'eval-2026-06-20-1895cef5',
    profile: 'cell_151_plan2_pair_specificity_closed_loop',
  },
  {
    suite: 'paired',
    arm: 'treatment',
    runId: 'eval-2026-06-20-f027e982',
    profile: 'cell_152_plan2_pair_specificity_repeat_contextual',
  },
  {
    suite: 'cross-suite',
    arm: 'closure-off',
    runId: 'eval-2026-06-20-66a72c2a',
    profile: 'cell_155_plan2_closureoff_crosssuite',
  },
  {
    suite: 'paired',
    arm: 'closure-off',
    runId: 'eval-2026-06-20-607bcb75',
    profile: 'cell_156_plan2_closureoff_paired',
  },
  {
    suite: 'cross-suite',
    arm: 'state-scramble',
    runId: 'eval-2026-06-20-afe8f1dd',
    profile: 'cell_157_plan2_statescramble_crosssuite',
  },
  {
    suite: 'paired',
    arm: 'state-scramble',
    runId: 'eval-2026-06-20-48b46fdf',
    profile: 'cell_158_plan2_statescramble_paired',
  },
];

const DIMS = ['trigger_recognition', 'strategy_execution', 'strategy_quality', 'pedagogical_coherence'];

const DB_COLS = {
  trigger_recognition: 'adaptive_trigger_recognition',
  strategy_execution: 'adaptive_strategy_execution',
  strategy_quality: 'adaptive_strategy_quality',
  pedagogical_coherence: 'adaptive_pedagogical_coherence',
};

function parseArgs(argv) {
  const args = {
    db: null, // resolved via openEvaluationDbReadonly (EVAL_DB_PATH-aware)
    judgeJson: path.join(REPO_ROOT, 'exports', 'm0-adaptive-grades-judge2-codex.json'),
    out: path.join(REPO_ROOT, 'exports', 'm0-two-judge-quality.md'),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--db') args.db = argv[++i];
    else if (a === '--judge-json') args.judgeJson = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '-h' || a === '--help') {
      console.log(`Usage: node scripts/generate-m0-two-judge-quality-report.js [options]

Options:
  --db <path>          evaluation DB path (default: EVAL_DB_PATH-aware resolution)
  --judge-json <path>  external judge JSON from rejudge-adaptive-inter-rater.js
  --out <path>         markdown report path (default: exports/m0-two-judge-quality.md)`);
      process.exit(0);
    } else {
      throw new Error(`unknown flag: ${a}`);
    }
  }
  return args;
}

function mean(xs) {
  const ys = xs.filter((x) => Number.isFinite(x));
  return ys.length ? ys.reduce((s, x) => s + x, 0) / ys.length : null;
}

function fmt(x, digits = 2) {
  return Number.isFinite(x) ? x.toFixed(digits) : 'n/a';
}

function scoreSum(scores) {
  if (!scores || DIMS.some((d) => !Number.isFinite(scores[d]))) return null;
  return DIMS.reduce((sum, d) => sum + scores[d], 0);
}

function dbScores(row) {
  return Object.fromEntries(DIMS.map((d) => [d, row[DB_COLS[d]]]));
}

export function loadDbRows(dbPath, runs = M0_RUNS) {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  const runIds = runs.map((r) => r.runId);
  const sql = `
    SELECT id, run_id, profile_name, scenario_id, dialogue_id,
           adaptive_trigger_recognition, adaptive_strategy_execution,
           adaptive_strategy_quality, adaptive_pedagogical_coherence,
           adaptive_grader_judge_model, adaptive_grader_version
    FROM evaluation_results
    WHERE run_id IN (${runIds.map(() => '?').join(',')})
    ORDER BY profile_name, scenario_id, id`;
  const rows = db.prepare(sql).all(...runIds);
  db.close();
  return rows;
}

export function loadExternalJudge(judgeJsonPath) {
  const body = JSON.parse(fs.readFileSync(judgeJsonPath, 'utf-8'));
  return {
    label: body.judge || 'external-json',
    graderVersion: body.grader_version || null,
    rows: body.rows || {},
  };
}

export function buildM0QualitySummary(dbRows, externalJudge, runs = M0_RUNS) {
  const runMeta = new Map(runs.map((r) => [r.runId, r]));
  const rowRecords = [];
  const missingExternalRows = [];
  const dbJudgeLabels = new Set();
  const dbGraderVersions = new Set();

  for (const row of dbRows) {
    const meta = runMeta.get(row.run_id);
    if (!meta) continue;
    if (row.adaptive_grader_judge_model) dbJudgeLabels.add(row.adaptive_grader_judge_model);
    if (row.adaptive_grader_version) dbGraderVersions.add(row.adaptive_grader_version);

    const j1 = dbScores(row);
    const ext = externalJudge.rows[String(row.id)];
    if (!ext?.scores) {
      missingExternalRows.push(row.id);
      continue;
    }
    const j2 = Object.fromEntries(DIMS.map((d) => [d, ext.scores[d]]));
    rowRecords.push({
      id: row.id,
      suite: meta.suite,
      arm: meta.arm,
      runId: row.run_id,
      profile: row.profile_name,
      scenario: row.scenario_id,
      dbJudge: row.adaptive_grader_judge_model,
      externalJudge: ext.judge || externalJudge.label,
      j1,
      j2,
      j1Composite20: scoreSum(j1),
      j2Composite20: scoreSum(j2),
    });
  }

  const groups = [];
  for (const meta of runs) {
    const rows = rowRecords.filter((r) => r.runId === meta.runId);
    const dimensionMeans = (judgeKey) =>
      Object.fromEntries(DIMS.map((d) => [d, mean(rows.map((r) => r[judgeKey][d]))]));
    groups.push({
      ...meta,
      n: rows.length,
      dbComposite20: mean(rows.map((r) => r.j1Composite20)),
      externalComposite20: mean(rows.map((r) => r.j2Composite20)),
      dbDimensionMeans: dimensionMeans('j1'),
      externalDimensionMeans: dimensionMeans('j2'),
    });
  }

  const deltas = [];
  for (const suite of ['cross-suite', 'paired']) {
    const baseline = groups.find((g) => g.suite === suite && g.arm === 'baseline');
    const treatment = groups.find((g) => g.suite === suite && g.arm === 'treatment');
    const scramble = groups.find((g) => g.suite === suite && g.arm === 'state-scramble');
    const closureOff = groups.find((g) => g.suite === suite && g.arm === 'closure-off');
    if (baseline && treatment) {
      deltas.push({
        suite,
        contrast: 'treatment - baseline',
        dbDelta: treatment.dbComposite20 - baseline.dbComposite20,
        externalDelta: treatment.externalComposite20 - baseline.externalComposite20,
      });
    }
    if (treatment && scramble) {
      deltas.push({
        suite,
        contrast: 'treatment - state-scramble',
        dbDelta: treatment.dbComposite20 - scramble.dbComposite20,
        externalDelta: treatment.externalComposite20 - scramble.externalComposite20,
      });
    }
    if (treatment && closureOff) {
      deltas.push({
        suite,
        contrast: 'treatment - closure-off',
        dbDelta: treatment.dbComposite20 - closureOff.dbComposite20,
        externalDelta: treatment.externalComposite20 - closureOff.externalComposite20,
      });
    }
  }

  return {
    rows: rowRecords,
    groups,
    deltas,
    dbJudgeLabels: [...dbJudgeLabels].sort(),
    dbGraderVersions: [...dbGraderVersions].sort(),
    externalJudgeLabel: externalJudge.label,
    externalGraderVersion: externalJudge.graderVersion,
    missingExternalRows,
    expectedRows: dbRows.filter((row) => runMeta.has(row.run_id)).length,
  };
}

export function renderM0QualityReport(summary, options = {}) {
  const dbLabel = summary.dbJudgeLabels.join(', ') || 'unknown DB judge';
  const extLabel = summary.externalJudgeLabel || 'external-json';
  const generated = options.generatedAt || new Date().toISOString();
  const dbPath = options.dbPath ? path.relative(REPO_ROOT, options.dbPath) : 'unknown';
  const judgePath = options.judgeJsonPath ? path.relative(REPO_ROOT, options.judgeJsonPath) : null;

  const lines = [];
  lines.push('# M0 two-judge adaptive-quality reconstruction');
  lines.push('');
  lines.push(`Generated: ${generated}`);
  lines.push('');
  lines.push('## Source');
  lines.push('');
  lines.push(`- DB-side judge: \`${dbLabel}\`, grader v${summary.dbGraderVersions.join(', ') || 'unknown'}`);
  lines.push(
    `- External judge: \`${extLabel}\`${summary.externalGraderVersion ? `, grader v${summary.externalGraderVersion}` : ''}`,
  );
  lines.push(`- DB: \`${dbPath}\``);
  if (judgePath) lines.push(`- External judge rows: \`${judgePath}\``);
  lines.push(`- Paired rows: ${summary.rows.length} / ${summary.expectedRows}`);
  if (summary.missingExternalRows.length) {
    lines.push(`- Missing external rows: ${summary.missingExternalRows.join(', ')}`);
  }
  lines.push('');
  lines.push(
    'Recovery note: the original ignored export was not present in the worktree, private export store, or shared data store. This file is reconstructed from the shared evaluation DB plus the sidecar external-judge JSON so the Sonnet DB grades are not overwritten.',
  );
  lines.push('');

  lines.push('## Arm means');
  lines.push('');
  lines.push(
    '| Suite | Arm | Cell | Run | N | DB composite /20 | External composite /20 | Trigger DB/ext | Exec DB/ext | Quality DB/ext | Coherence DB/ext |',
  );
  lines.push('|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const group of summary.groups) {
    lines.push(
      `| ${group.suite} | ${group.arm} | \`${group.profile}\` | \`${group.runId}\` | ${group.n} | ${fmt(group.dbComposite20)} | ${fmt(group.externalComposite20)} | ${fmt(group.dbDimensionMeans.trigger_recognition)}/${fmt(group.externalDimensionMeans.trigger_recognition)} | ${fmt(group.dbDimensionMeans.strategy_execution)}/${fmt(group.externalDimensionMeans.strategy_execution)} | ${fmt(group.dbDimensionMeans.strategy_quality)}/${fmt(group.externalDimensionMeans.strategy_quality)} | ${fmt(group.dbDimensionMeans.pedagogical_coherence)}/${fmt(group.externalDimensionMeans.pedagogical_coherence)} |`,
    );
  }
  lines.push('');

  lines.push('## Contrasts');
  lines.push('');
  lines.push('| Suite | Contrast | DB delta /20 | External delta /20 |');
  lines.push('|---|---|---:|---:|');
  for (const delta of summary.deltas) {
    lines.push(`| ${delta.suite} | ${delta.contrast} | ${fmt(delta.dbDelta)} | ${fmt(delta.externalDelta)} |`);
  }
  lines.push('');

  lines.push('## Read');
  lines.push('');
  const crossTreatment = summary.groups.find((g) => g.suite === 'cross-suite' && g.arm === 'treatment');
  const crossBaseline = summary.groups.find((g) => g.suite === 'cross-suite' && g.arm === 'baseline');
  const crossScramble = summary.groups.find((g) => g.suite === 'cross-suite' && g.arm === 'state-scramble');
  const pairedTreatment = summary.groups.find((g) => g.suite === 'paired' && g.arm === 'treatment');
  const pairedBaseline = summary.groups.find((g) => g.suite === 'paired' && g.arm === 'baseline');
  const pairedScramble = summary.groups.find((g) => g.suite === 'paired' && g.arm === 'state-scramble');
  lines.push(
    `- Cross-suite: treatment ${fmt(crossTreatment?.dbComposite20)}/${fmt(crossTreatment?.externalComposite20)} vs baseline ${fmt(crossBaseline?.dbComposite20)}/${fmt(crossBaseline?.externalComposite20)} and state-scramble ${fmt(crossScramble?.dbComposite20)}/${fmt(crossScramble?.externalComposite20)} (DB/external composites).`,
  );
  lines.push(
    `- Paired: treatment ${fmt(pairedTreatment?.dbComposite20)}/${fmt(pairedTreatment?.externalComposite20)} vs baseline ${fmt(pairedBaseline?.dbComposite20)}/${fmt(pairedBaseline?.externalComposite20)} and state-scramble ${fmt(pairedScramble?.dbComposite20)}/${fmt(pairedScramble?.externalComposite20)} (DB/external composites).`,
  );
  lines.push(
    '- Interpret as a same-instrument quality corroboration of the state-scramble collapse, not as a new learning-outcome result or as a replacement for the strict-shift endpoint.',
  );
  lines.push('');
  return lines.join('\n');
}

export function generateReport({ dbPath, judgeJsonPath, outPath }) {
  const dbRows = loadDbRows(dbPath);
  const externalJudge = loadExternalJudge(judgeJsonPath);
  const summary = buildM0QualitySummary(dbRows, externalJudge);
  const report = renderM0QualityReport(summary, { dbPath, judgeJsonPath });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, report);
  return summary;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  // Resolve + sanity-check the DB via the shared read-path discipline, then
  // hand the resolved path to loadDbRows (which opens its own handle).
  const { db, dbPath, reason } = openEvaluationDbReadonly(REPO_ROOT, { explicitPath: args.db });
  if (!db) {
    console.log(describeMissingEvaluationDb(dbPath, reason));
    process.exit(0);
  }
  db.close();
  const summary = generateReport({
    dbPath,
    judgeJsonPath: path.resolve(args.judgeJson),
    outPath: path.resolve(args.out),
  });
  console.log(`wrote ${args.out}`);
  console.log(`paired rows: ${summary.rows.length}/${summary.expectedRows}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
  });
}
