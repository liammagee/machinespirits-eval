#!/usr/bin/env node
/**
 * Does the mood floor reproduce?
 *
 * Why this exists. The determinate-negation grid reported that cell 202 held
 * the sarcastic manner 0 times in 6 against mood targets, against 5/6 in the
 * parent arm. That contrast (two-sided Fisher p = 0.015) is the entire premise
 * of the precondition follow-up: a mood supplies no claim to negate, so the
 * contract cannot be satisfied and the manner is dropped.
 *
 * The precondition run happens to contain a clean replication of the very cell
 * that produced the 0/6 — same cell, same two plain mood scenarios, run one day
 * later. Nobody looked, because that run registered its counts on the other
 * gate. This script looks.
 *
 * It also re-reads the precondition run's own arms on the PLAIN gate, which is
 * the gate the motivating pattern was measured on. That run registered its
 * primary measure on `sarcastic_determinate`, whose named-target-claim
 * component is both cell 202's treatment and the same note's separate
 * manipulation check — so the primary measure and the check were reading one
 * component, and neither read the thing the premise is about.
 *
 * Recomputation, not rewriting: the stance gate reads message text, so every
 * count here is derived from dialogue content and nothing is written back to
 * any row. This is an export.
 *
 * Usage:
 *   node scripts/analyze-sarcasm-mood-floor-replication.js \
 *     [--first-run <id>] [--second-run <id>] \
 *     [--output-json <path>] [--output-md <path>] [--db <path>]
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

import { evaluateRegisterStanceFidelity, STANCE_GATE_VERSION } from '../services/registerStanceFidelity.js';
import { resolveEvaluationDbPath } from '../services/evaluationDataPaths.js';
import { openEvaluationDbReadonly } from '../services/evaluationDbReadonly.js';
import { fisherExactTwoSided } from '../services/fisherExact.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The run that produced the 0/6, and the run that repeated the same conditions.
const DEFAULT_FIRST_RUN = 'eval-2026-08-06-4de45d05';
const DEFAULT_SECOND_RUN = 'eval-2026-08-07-e3dffab2';

const CELL_202_PREFIX = 'cell_202_';

/**
 * The plain gate, and only the plain gate. `sarcastic_determinate` requires a
 * named target claim, which IS cell 202's treatment — a gate that requires the
 * treatment cannot be used to ask whether the manner survived it.
 */
const GATE = 'sarcastic';

const SLICE_FOLD = 'resistance_turn';

/** The two mood scenarios, in the plain form both runs share. */
const PLAIN_MOOD_SCENARIOS = [
  'charisma_desire_resistance_breakthrough_boredom',
  'charisma_desire_resistance_breakthrough_frustration',
];

/** The claim-bearing variants the precondition run added on top. */
const CLAIMED_MOOD_SCENARIOS = PLAIN_MOOD_SCENARIOS.map((id) => `${id}_claimed`);

function parseArgs(argv) {
  const flags = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      i += 1;
    } else {
      flags[key] = true;
    }
  }
  return flags;
}

function loadRunRows({ runId, workDir, dbPath }) {
  const jsonPath = path.join(workDir, `${runId}.json`);
  const env = { ...process.env };
  if (dbPath) env.EVAL_DB_PATH = dbPath;
  const result = spawnSync(
    process.execPath,
    [
      'scripts/report-charisma-desire-breakthrough-matrix.js',
      '--run-id',
      runId,
      '--output-json',
      jsonPath,
      '--output-md',
      path.join(workDir, `${runId}.md`),
    ],
    { cwd: ROOT, env, stdio: 'ignore' },
  );
  if (result.status !== 0) throw new Error(`matrix reporter exited ${result.status} for ${runId}`);
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8')).analyses || [];
}

function scoreRow(row, gate = GATE) {
  return evaluateRegisterStanceFidelity({
    registerName: gate,
    tutorMessage: row.tutorMessage,
    learnerMessage: row.preLearner,
    postLearnerMessage: row.postLearner,
  });
}

/**
 * The fields that have to agree before a difference between two runs can be
 * read as sampling rather than as a configuration change.
 */
const PROVENANCE_FIELDS = [
  'profile_name',
  'config_hash',
  'prompt_content_hash',
  'ego_model',
  'superego_model',
  'judge_model',
];

/**
 * A between-run comparison is only a replication if the two runs were asked for
 * the same thing. Rather than assert that in prose, read it: the distinct value
 * of each provenance field over each run's rows, compared. Any disagreement is
 * pushed into errors, so the report fails closed instead of presenting a
 * configuration change as a sampling difference.
 */
export function compareProvenance({ dbPath, runs, scenarios }) {
  // The root argument comes first; passing the options object in its place
  // resolves to the production database and quietly ignores --db.
  const { db, reason } = openEvaluationDbReadonly(ROOT, { explicitPath: dbPath });
  if (!db) throw new Error(`cannot read provenance from ${dbPath}: ${reason}`);
  const observed = new Map();
  try {
    const placeholders = scenarios.map(() => '?').join(',');
    const statement = db.prepare(
      `SELECT DISTINCT ${PROVENANCE_FIELDS.join(', ')} FROM evaluation_results
       WHERE run_id = ? AND profile_name LIKE '${CELL_202_PREFIX}%' AND scenario_id IN (${placeholders})`,
    );
    for (const runId of runs) observed.set(runId, statement.all(runId, ...scenarios));
  } finally {
    db.close();
  }

  const mismatches = [];
  const matched = [];
  for (const field of PROVENANCE_FIELDS) {
    const perRun = runs.map((runId) => [...new Set(observed.get(runId).map((row) => row[field]))].sort().join('|'));
    if (perRun.some((value) => value !== perRun[0])) {
      mismatches.push(`${field}: ${perRun.map((value, i) => `${runs[i]}=${value || '(none)'}`).join(' vs ')}`);
    } else {
      matched.push(`${field} \`${perRun[0]}\``);
    }
  }
  return { matched, mismatches };
}

function summarize(rows) {
  const scored = rows.map((row) => {
    const verdict = scoreRow(row);
    const determinate = scoreRow(row, 'sarcastic_determinate');
    return {
      rowId: row.rowId,
      scenarioId: row.scenarioId,
      targetSignal: row.targetSignal,
      passed: verdict.passed,
      score: verdict.score,
      missing: verdict.missing,
      markerPresent: !verdict.missing.includes('register_marker'),
      passedDeterminate: determinate.passed,
      namedTargetClaim: determinate.namedTargetClaim?.named === true,
    };
  });
  return {
    gate: GATE,
    gateVersion: STANCE_GATE_VERSION,
    fold: SLICE_FOLD,
    n: scored.length,
    held: scored.filter((row) => row.passed).length,
    heldDeterminate: scored.filter((row) => row.passedDeterminate).length,
    named: scored.filter((row) => row.namedTargetClaim).length,
    markerPresent: scored.filter((row) => row.markerPresent).length,
    rows: scored,
  };
}

function fisher(left, right, field = 'held') {
  return fisherExactTwoSided(left[field], left.n - left[field], right[field], right.n - right[field]);
}

function fraction(summary, field = 'held') {
  return `${summary[field]}/${summary.n}`;
}

function renderMarkdown(data) {
  const lines = [];
  lines.push('# Does the mood floor reproduce?');
  lines.push('');
  lines.push(`Generated ${data.generatedAt}.`);
  lines.push('');
  lines.push(
    `Gate \`${GATE}@${data.gateVersion}\`, slice fold \`${SLICE_FOLD}\`. Counts under a different gate or ` +
      'fold are not comparable to these. The plain gate is used throughout because the determinate gate ' +
      "requires a named target claim, which is cell 202's own treatment.",
  );
  lines.push('');

  lines.push('## The replication');
  lines.push('');
  lines.push(
    'Cell 202, the two plain mood scenarios, two runs one day apart. Everything the provenance records ' +
      'is matched; the gate reads message text, so the judge cannot enter either.',
  );
  lines.push('');
  lines.push('| run | held the manner | named a claim | register marker present |');
  lines.push('| --- | --- | --- | --- |');
  for (const arm of data.replication.arms) {
    lines.push(
      `| \`${arm.runId}\` ${arm.note} | **${fraction(arm.summary)}** | ${fraction(arm.summary, 'named')} | ` +
        `${fraction(arm.summary, 'markerPresent')} |`,
    );
  }
  lines.push('');
  lines.push(
    `Two-sided Fisher exact on held-the-manner: **p = ${data.replication.p.toFixed(4)}**. ` +
      `Matched on: ${data.replication.matchedOn.join('; ')}.`,
  );
  lines.push('');
  lines.push(data.replication.reading);
  lines.push('');

  lines.push('## Why the failing rows failed');
  lines.push('');
  lines.push('| run | missing component | rows |');
  lines.push('| --- | --- | --- |');
  for (const arm of data.replication.arms) {
    const counts = new Map();
    for (const row of arm.summary.rows) {
      for (const missing of row.missing) counts.set(missing, (counts.get(missing) || 0) + 1);
    }
    if (!counts.size) lines.push(`| \`${arm.runId}\` | (none) | 0 |`);
    for (const [component, count] of [...counts].sort((a, b) => b[1] - a[1])) {
      lines.push(`| \`${arm.runId}\` | ${component} | ${count} |`);
    }
  }
  lines.push('');

  lines.push('## The precondition arms, re-read on the plain gate');
  lines.push('');
  lines.push(
    `Run \`${data.precondition.runId}\` registered its counts on the determinate gate. Read on the gate ` +
      'the motivating pattern was measured on:',
  );
  lines.push('');
  lines.push('| measure | plain mood | claim-bearing mood | p |');
  lines.push('| --- | --- | --- | --- |');
  for (const row of data.precondition.measures) {
    lines.push(`| ${row.label} | ${row.plain} | ${row.claimed} | ${row.p === null ? 'n/a' : row.p.toFixed(4)} |`);
  }
  lines.push('');
  lines.push(data.precondition.reading);
  lines.push('');

  if (data.errors.length) {
    lines.push('## Errors');
    lines.push('');
    for (const error of data.errors) lines.push(`- **${error}**`);
    lines.push('');
  }
  return lines.join('\n');
}

export function main() {
  const flags = parseArgs(process.argv);
  const dbPath = typeof flags.db === 'string' ? path.resolve(ROOT, flags.db) : resolveEvaluationDbPath(ROOT);
  if (!fs.existsSync(dbPath)) {
    console.log(`No evaluation database at ${dbPath} — nothing to analyze.`);
    return;
  }

  const firstRun = typeof flags['first-run'] === 'string' ? flags['first-run'] : DEFAULT_FIRST_RUN;
  const secondRun = typeof flags['second-run'] === 'string' ? flags['second-run'] : DEFAULT_SECOND_RUN;

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mood-floor-'));
  let firstRows;
  let secondRows;
  try {
    firstRows = loadRunRows({ runId: firstRun, workDir, dbPath });
    secondRows = loadRunRows({ runId: secondRun, workDir, dbPath });
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }

  const cell202 = (rows, scenarios) =>
    rows.filter((row) => row.profileName?.startsWith(CELL_202_PREFIX) && scenarios.includes(row.scenarioId));

  const firstMood = cell202(firstRows, PLAIN_MOOD_SCENARIOS);
  const secondMood = cell202(secondRows, PLAIN_MOOD_SCENARIOS);
  const secondClaimed = cell202(secondRows, CLAIMED_MOOD_SCENARIOS);

  const errors = [];
  if (!firstMood.length) errors.push(`no cell 202 plain-mood rows in ${firstRun}`);
  if (!secondMood.length) errors.push(`no cell 202 plain-mood rows in ${secondRun}`);
  if (!secondClaimed.length) errors.push(`no cell 202 claim-bearing rows in ${secondRun}`);
  if (errors.length) {
    console.error(errors.map((error) => `ERROR: ${error}`).join('\n'));
    process.exitCode = 1;
    return;
  }

  const provenance = compareProvenance({
    dbPath,
    runs: [firstRun, secondRun],
    scenarios: PLAIN_MOOD_SCENARIOS,
  });
  for (const mismatch of provenance.mismatches) {
    errors.push(`the two runs are not matched — ${mismatch}; this is a configuration change, not a replication`);
  }

  const first = summarize(firstMood);
  const second = summarize(secondMood);
  const claimed = summarize(secondClaimed);

  const replicationP = fisher(first, second);
  const reading =
    first.held === second.held
      ? 'The two draws agree.'
      : `The same conditions gave ${fraction(first)} and ${fraction(second)}. The premise of the ` +
        'precondition follow-up is that the first of those is a floor produced by the contract. Two draws ' +
        'this far apart on byte-identical configuration say it is a draw, and that any effect smaller ' +
        'than this spread cannot be resolved at these row counts.';

  const measures = [
    ['held the manner (plain gate)', 'held'],
    ['held the manner (determinate gate — the registered measure)', 'heldDeterminate'],
    ['named a claim (the manipulation check)', 'named'],
    ['register marker present', 'markerPresent'],
  ].map(([label, field]) => ({
    label,
    plain: fraction(second, field),
    claimed: fraction(claimed, field),
    p: fisher(second, claimed, field),
  }));

  const manipulationWorked = claimed.named / claimed.n > second.named / second.n;
  const preconditionReading = manipulationWorked
    ? 'The manipulation raised how often the tutor named a claim, so the primary measure is readable.'
    : `The manipulation did not raise how often the tutor named a claim (${fraction(second, 'named')} plain ` +
      `against ${fraction(claimed, 'named')} claim-bearing). Under the run's own decision rule the primary ` +
      'measure is not to be read: the design assumed plain moods would supply nothing to name, and they ' +
      'supplied something in most rows, so the manipulation was pushed against a ceiling.';

  const data = {
    generatedAt: new Date().toISOString(),
    gate: GATE,
    gateVersion: STANCE_GATE_VERSION,
    fold: SLICE_FOLD,
    replication: {
      p: replicationP,
      matchedOn: [...provenance.matched, `gate \`${GATE}@${STANCE_GATE_VERSION}\``, `fold \`${SLICE_FOLD}\``],
      arms: [
        { runId: firstRun, note: '(determinate grid)', summary: first },
        { runId: secondRun, note: '(precondition run)', summary: second },
      ],
      reading,
    },
    precondition: {
      runId: secondRun,
      measures,
      manipulationWorked,
      reading: preconditionReading,
    },
    errors,
  };

  const jsonPath = path.resolve(
    ROOT,
    typeof flags['output-json'] === 'string' ? flags['output-json'] : 'exports/sarcasm-mood-floor-replication.json',
  );
  const mdPath = path.resolve(
    ROOT,
    typeof flags['output-md'] === 'string' ? flags['output-md'] : 'exports/sarcasm-mood-floor-replication.md',
  );
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.mkdirSync(path.dirname(mdPath), { recursive: true });
  fs.writeFileSync(jsonPath, `${JSON.stringify(data, null, 2)}\n`);
  fs.writeFileSync(mdPath, `${renderMarkdown(data)}\n`);

  console.log(renderMarkdown(data));
  console.log(`\nWrote ${path.relative(ROOT, jsonPath)} and ${path.relative(ROOT, mdPath)}`);
  if (errors.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

export default { main };
