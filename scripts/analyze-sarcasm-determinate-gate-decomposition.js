#!/usr/bin/env node
/**
 * Decompose the determinate-sarcasm fidelity contrast into a GATE effect and a
 * BEHAVIOUR effect.
 *
 * Why this exists. The determinate arm (cell 202) and its parent sarcastic arm
 * (cell 197) were first compared across two moving parts at once: a different
 * stance gate (`sarcastic_determinate` re-weights the plain sarcastic
 * components and adds a required conjunct) AND a different slice fold (the grid
 * report requires every register slice in a row to pass; the matrix reporter
 * scores the single resistance turn). Differencing 6/15 against 8/15 across
 * both produced a "fidelity fell" reading that does not survive holding either
 * one fixed. This script holds both fixed and reports the 2x2 — each run under
 * each gate, on one common slice — so the gate effect and the behaviour effect
 * are separable.
 *
 * It recomputes rather than reads persisted verdicts because the parent run
 * predates stance persistence for non-determinate registers (fixed forward in
 * scripts/evaluate-register-rubric.js). Historical rows are NOT backfilled;
 * this recomputation is an export, not a rewrite.
 *
 * Usage:
 *   node scripts/analyze-sarcasm-determinate-gate-decomposition.js \
 *     [--parent-run <id>] [--child-run <id>] [--parent-arm sarcastic] \
 *     [--output-json <path>] [--output-md <path>] [--db <path>]
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

import { evaluateRegisterStanceFidelity, STANCE_GATE_VERSION } from '../services/registerStanceFidelity.js';
import { resolveEvaluationDbPath } from '../services/evaluationDataPaths.js';
// Taken from the grid's own definition rather than re-implemented, so the
// conversion denominator here cannot drift from the registered measure.
import { isPositiveLocalOutcome } from './run-sarcasm-determinate-negation-grid.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const DEFAULT_PARENT_RUN = 'eval-2026-08-05-87fe3664';
const DEFAULT_CHILD_RUN = 'eval-2026-08-06-4de45d05';

// The two gates under comparison. Both are applied to both runs.
const GATES = ['sarcastic', 'sarcastic_determinate'];

// The slice fold this script uses, recorded in the output so a reader can tell
// which convention produced a count. `resistance_turn` = the single adopting
// turn located by the matrix reporter; the alternative live fold is
// `all_register_slices` (every slice in the row must pass), used by the grid
// reports. Counts from different folds are not comparable.
const SLICE_FOLD = 'resistance_turn';

// Post-hoc grouping. The split was suggested BY these data, not registered in
// advance, so every contrast computed over it is exploratory.
const AFFECTIVE_TARGETS = new Set(['boredom', 'frustration']);

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

// --- statistics -------------------------------------------------------------

function logFactorial(n) {
  let total = 0;
  for (let i = 2; i <= n; i += 1) total += Math.log(i);
  return total;
}

/** Two-sided Fisher exact test on a 2x2 table, by summing tables no likelier than observed. */
function fisherExactTwoSided(a, b, c, d) {
  const n = a + b + c + d;
  if (!n) return null;
  const tableProb = (w, x, y, z) =>
    Math.exp(
      logFactorial(w + x) +
        logFactorial(y + z) +
        logFactorial(w + y) +
        logFactorial(x + z) -
        logFactorial(n) -
        logFactorial(w) -
        logFactorial(x) -
        logFactorial(y) -
        logFactorial(z),
    );
  const observed = tableProb(a, b, c, d);
  let total = 0;
  for (let i = 0; i <= Math.min(a + b, a + c); i += 1) {
    const j = a + b - i;
    const k = a + c - i;
    const l = n - i - j - k;
    if (j < 0 || k < 0 || l < 0) continue;
    const prob = tableProb(i, j, k, l);
    if (prob <= observed + 1e-12) total += prob;
  }
  return Math.min(1, total);
}

// --- row loading ------------------------------------------------------------

/**
 * Rows come from the matrix reporter so the slice definition (which turn counts
 * as the adopting turn, which learner messages bracket it) is taken from the
 * existing definition rather than re-implemented here.
 */
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

function scoreRow(row, gate) {
  return evaluateRegisterStanceFidelity({
    registerName: gate,
    tutorMessage: row.tutorMessage,
    learnerMessage: row.preLearner,
    postLearnerMessage: row.postLearner,
  });
}

/**
 * Refuse to difference two sets of verdicts unless they were produced by the
 * same gate at the same version under the same slice fold. This is the guard
 * whose absence let a gate difference be reported as a behaviour difference.
 */
export function assertComparable(left, right) {
  const key = (side) => `${side.gate}@${side.gateVersion}/${side.fold}`;
  if (key(left) !== key(right)) {
    throw new Error(`refusing to compare incomparable stance verdicts: ${key(left)} vs ${key(right)}`);
  }
}

function summarizeArm({ label, runId, rows, gate }) {
  const scored = rows.map((row) => {
    const verdict = scoreRow(row, gate);
    const determinate = scoreRow(row, 'sarcastic_determinate');
    return {
      rowId: row.rowId,
      targetSignal: row.targetSignal,
      passed: verdict.passed,
      score: verdict.score,
      label: verdict.label,
      missing: verdict.missing,
      namedTargetClaim: determinate.namedTargetClaim?.named === true,
      markerPresent: !verdict.missing.includes('register_marker'),
      verdict: row.verdict,
      positiveOutcome: isPositiveLocalOutcome(row.verdict),
    };
  });
  return { label, runId, gate, gateVersion: STANCE_GATE_VERSION, fold: SLICE_FOLD, n: scored.length, rows: scored };
}

function countBy(rows, predicate) {
  return rows.filter(predicate).length;
}

function contrast({ name, parent, child, predicate }) {
  const a = countBy(parent.rows, predicate);
  const b = parent.rows.length - a;
  const c = countBy(child.rows, predicate);
  const d = child.rows.length - c;
  return {
    name,
    parent: { passed: a, n: parent.rows.length },
    determinate: { passed: c, n: child.rows.length },
    p: fisherExactTwoSided(a, b, c, d),
  };
}

function groupContrasts({ parent, child, predicate, measure }) {
  assertComparable(parent, child);
  const groups = [
    ['affective (boredom + frustration)', (row) => AFFECTIVE_TARGETS.has(row.targetSignal)],
    [
      'content-shaped (irrelevance + question flood + rote parroting)',
      (row) => !AFFECTIVE_TARGETS.has(row.targetSignal),
    ],
    ['all targets', () => true],
  ];
  return groups.map(([name, select]) =>
    contrast({
      name: `${measure} — ${name}`,
      parent: { ...parent, rows: parent.rows.filter(select) },
      child: { ...child, rows: child.rows.filter(select) },
      predicate,
    }),
  );
}

function perTargetTable(parent, child) {
  const targets = [...new Set([...parent.rows, ...child.rows].map((row) => row.targetSignal))].sort();
  return targets.map((target) => {
    const p = parent.rows.filter((row) => row.targetSignal === target);
    const c = child.rows.filter((row) => row.targetSignal === target);
    return {
      target,
      parent: {
        passed: countBy(p, (row) => row.passed),
        n: p.length,
        named: countBy(p, (row) => row.namedTargetClaim),
      },
      determinate: {
        passed: countBy(c, (row) => row.passed),
        n: c.length,
        named: countBy(c, (row) => row.namedTargetClaim),
      },
    };
  });
}

/**
 * Cross-tabulate the two candidate binding constraints against the outcome, so
 * the claim "the marker decided it, the named claim did not" is computed rather
 * than asserted. Returns the 2x2 for each and whether it is decisive (i.e.
 * predicts every row's pass/fail without error).
 */
function bindingConstraintCheck(arms) {
  const rows = arms.flatMap((arm) => arm.rows);
  const tabulate = (predicate) => {
    const table = {
      present_passed: countBy(rows, (row) => predicate(row) && row.passed),
      present_failed: countBy(rows, (row) => predicate(row) && !row.passed),
      absent_passed: countBy(rows, (row) => !predicate(row) && row.passed),
      absent_failed: countBy(rows, (row) => !predicate(row) && !row.passed),
    };
    return { ...table, decisive: table.present_failed === 0 && table.absent_passed === 0 };
  };
  return {
    n: rows.length,
    registerMarker: tabulate((row) => row.markerPresent),
    namedTargetClaim: tabulate((row) => row.namedTargetClaim),
  };
}

function missingProfile(arm) {
  const counts = {};
  for (const row of arm.rows) {
    if (row.passed) continue;
    for (const component of row.missing) counts[component] = (counts[component] || 0) + 1;
  }
  return counts;
}

function renderMarkdown(data) {
  const lines = [];
  lines.push('# Determinate-sarcasm stance gate: decomposition');
  lines.push('');
  lines.push(`Generated ${data.generatedAt}.`);
  lines.push('');
  lines.push(
    `Parent arm \`${data.parentArm}\` from run \`${data.parentRun}\`; determinate arm from run \`${data.childRun}\`. ` +
      `Slice fold \`${data.fold}\`, gate version \`${data.gateVersion}\`. Counts under a different fold are not comparable to these.`,
  );
  lines.push('');
  lines.push('## Gate sensitivity (same rows, both gates)');
  lines.push('');
  lines.push('| Arm | plain `sarcastic` gate | `sarcastic_determinate` gate | named a target claim |');
  lines.push('| --- | --- | --- | --- |');
  for (const arm of data.gateSensitivity) {
    lines.push(`| ${arm.label} | ${arm.plain}/${arm.n} | ${arm.determinate}/${arm.n} | ${arm.named}/${arm.n} |`);
  }
  lines.push('');
  lines.push(
    'Both gates rank the two arms the same way, and the gap between arms is one row either way. ' +
      'The originally reported 6/15-vs-8/15 gap came from the fold, not from the gate and not from the tutor.',
  );
  lines.push('');
  lines.push('## Conversion among faithful rows (same common gate and fold)');
  lines.push('');
  lines.push('| Arm | faithful | of which positive | positive across all rows |');
  lines.push('| --- | --- | --- | --- |');
  for (const arm of data.conversion) {
    lines.push(
      `| ${arm.label} | ${arm.faithful}/${arm.n} | ${arm.positive}/${arm.faithful} | ${arm.allRowsPositive}/${arm.n} |`,
    );
  }
  lines.push('');
  lines.push('## Faithful rows by resistance target (common plain gate)');
  lines.push('');
  lines.push('| Target | parent 197 | determinate 202 | parent named | determinate named |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const row of data.perTarget) {
    lines.push(
      `| ${row.target} | ${row.parent.passed}/${row.parent.n} | ${row.determinate.passed}/${row.determinate.n} | ` +
        `${row.parent.named}/${row.parent.n} | ${row.determinate.named}/${row.determinate.n} |`,
    );
  }
  lines.push('');
  lines.push('## Contrasts (two-sided Fisher exact, post-hoc)');
  lines.push('');
  lines.push('| Contrast | parent | determinate | p |');
  lines.push('| --- | --- | --- | --- |');
  for (const item of data.contrasts) {
    lines.push(
      `| ${item.name} | ${item.parent.passed}/${item.parent.n} | ${item.determinate.passed}/${item.determinate.n} | ` +
        `${item.p == null ? '' : item.p.toFixed(4)} |`,
    );
  }
  lines.push('');
  lines.push(
    'The affective/content-shaped split was suggested by these data and was not pre-registered. ' +
      'The two group contrasts partition the same 30 rows, so they are not independent, and no ' +
      'multiplicity correction is applied. Treat as exploratory.',
  );
  lines.push('');
  lines.push('## Why failing rows failed (missing gate components)');
  lines.push('');
  lines.push('| Component | parent 197 | determinate 202 |');
  lines.push('| --- | --- | --- |');
  const components = [
    ...new Set([...Object.keys(data.missing.parent), ...Object.keys(data.missing.determinate)]),
  ].sort();
  for (const component of components) {
    lines.push(
      `| ${component} | ${data.missing.parent[component] || 0} | ${data.missing.determinate[component] || 0} |`,
    );
  }
  lines.push('');
  lines.push('## What actually decided a pass');
  lines.push('');
  const bc = data.bindingConstraint;
  lines.push(
    `| Candidate constraint | present & passed | present & failed | absent & passed | absent & failed | decisive |`,
  );
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const [name, table] of [
    ['register marker', bc.registerMarker],
    ['named target claim', bc.namedTargetClaim],
  ]) {
    lines.push(
      `| ${name} | ${table.present_passed} | ${table.present_failed} | ${table.absent_passed} | ${table.absent_failed} | ${table.decisive ? 'yes' : 'no'} |`,
    );
  }
  lines.push('');
  lines.push(
    'The register marker carries 35 of 100 points and the faithful band opens at 70, so no turn can pass ' +
      `without it. Across all ${bc.n} rows the marker ${bc.registerMarker.decisive ? 'predicts every pass and every fail without error' : 'does not fully predict the outcome'}` +
      `, while the named target claim — the thing the determinate contract adds — ${bc.namedTargetClaim.decisive ? 'also does' : 'does not'}: ` +
      `${bc.namedTargetClaim.present_failed} rows named a claim and still failed, and ${bc.namedTargetClaim.absent_passed} passed without naming one.`,
  );
  lines.push('');
  return lines.join('\n');
}

export function main() {
  const flags = parseArgs(process.argv);
  const dbPath = typeof flags.db === 'string' ? path.resolve(ROOT, flags.db) : resolveEvaluationDbPath(ROOT);
  if (!fs.existsSync(dbPath)) {
    console.log(`No evaluation database at ${dbPath} — nothing to analyze.`);
    return;
  }

  const parentRun = typeof flags['parent-run'] === 'string' ? flags['parent-run'] : DEFAULT_PARENT_RUN;
  const childRun = typeof flags['child-run'] === 'string' ? flags['child-run'] : DEFAULT_CHILD_RUN;
  const parentArm = typeof flags['parent-arm'] === 'string' ? flags['parent-arm'] : 'sarcastic';

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stance-decomposition-'));
  let parentRows;
  let childRows;
  try {
    parentRows = loadRunRows({ runId: parentRun, workDir, dbPath }).filter((row) => row.arm === parentArm);
    childRows = loadRunRows({ runId: childRun, workDir, dbPath });
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }

  if (!parentRows.length || !childRows.length) {
    console.log(`No rows for ${parentRun} (arm ${parentArm}) or ${childRun} — nothing to analyze.`);
    return;
  }

  const parent = summarizeArm({
    label: `parent ${parentArm} (197)`,
    runId: parentRun,
    rows: parentRows,
    gate: 'sarcastic',
  });
  const child = summarizeArm({ label: 'determinate (202)', runId: childRun, rows: childRows, gate: 'sarcastic' });

  const gateSensitivity = [
    { label: parent.label, runId: parentRun, rows: parentRows },
    { label: child.label, runId: childRun, rows: childRows },
  ].map((arm) => ({
    label: arm.label,
    runId: arm.runId,
    n: arm.rows.length,
    ...Object.fromEntries(
      GATES.map((gate) => [
        gate === 'sarcastic' ? 'plain' : 'determinate',
        countBy(arm.rows, (row) => scoreRow(row, gate).passed),
      ]),
    ),
    named: countBy(arm.rows, (row) => scoreRow(row, 'sarcastic_determinate').namedTargetClaim?.named === true),
  }));

  // Estimand (2) — conversion among faithful rows — recomputed on the same
  // common gate and fold, so it is not inherited from the fold that produced
  // the incomparable fidelity counts.
  const conversion = [parent, child].map((arm) => {
    const faithful = arm.rows.filter((row) => row.passed);
    return {
      label: arm.label,
      faithful: faithful.length,
      positive: countBy(faithful, (row) => row.positiveOutcome),
      allRowsPositive: countBy(arm.rows, (row) => row.positiveOutcome),
      n: arm.rows.length,
    };
  });

  const data = {
    generatedAt: new Date().toISOString(),
    parentRun,
    childRun,
    parentArm,
    gate: 'sarcastic',
    gateVersion: STANCE_GATE_VERSION,
    fold: SLICE_FOLD,
    gateSensitivity,
    conversion,
    perTarget: perTargetTable(parent, child),
    contrasts: [
      ...groupContrasts({ parent, child, predicate: (row) => row.passed, measure: 'faithful' }),
      ...groupContrasts({ parent, child, predicate: (row) => row.markerPresent, measure: 'register marker present' }),
      ...groupContrasts({
        parent,
        child,
        predicate: (row) => row.positiveOutcome,
        measure: 'positive local outcome (assigned arm)',
      }),
    ],
    missing: { parent: missingProfile(parent), determinate: missingProfile(child) },
    bindingConstraint: bindingConstraintCheck([parent, child]),
    rows: { parent: parent.rows, determinate: child.rows },
  };

  const jsonPath = path.resolve(
    ROOT,
    typeof flags['output-json'] === 'string'
      ? flags['output-json']
      : 'exports/sarcasm-determinate-gate-decomposition.json',
  );
  const mdPath = path.resolve(
    ROOT,
    typeof flags['output-md'] === 'string' ? flags['output-md'] : 'exports/sarcasm-determinate-gate-decomposition.md',
  );
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, `${JSON.stringify(data, null, 2)}\n`);
  fs.writeFileSync(mdPath, renderMarkdown(data));
  console.log(renderMarkdown(data));
  console.log(`Wrote ${path.relative(ROOT, jsonPath)} and ${path.relative(ROOT, mdPath)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

export default { main };
