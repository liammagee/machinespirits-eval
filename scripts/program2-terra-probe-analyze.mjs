#!/usr/bin/env node
// Program-2 terra cross-family composer probe — deterministic comparison.
// (Offline exploratory probe, 2026-07-21; no prereg bar, no H-W claim.
// Companion to scripts/program2-coupling-probe.mjs --composer codex.gpt-5.6-terra.)
//
// Reads three grade-file reports produced by program2-floor-grader.mjs
// --grade-file (frozen machinery):
//   --mini    mini-solo graded rows (tuned instruct greedy, heldout n=58)
//   --sonnet  Phase 4 sonnet delivered file regraded (reference 0.293/0.448)
//   --terra   terra delivered file graded
//
// Computes, per family, the three Phase-4 constructions (byte-identical
// arithmetic, validated against the phase4 manifest before first use):
//   deliveredRate   — grade of the containment-battery delivered file
//                     (sonnet reference: composedAlone 0.293)
//   failClosed      — per-moment union: composed-row compliant OR mini
//                     compliant (sonnet reference: couplingFailClosed
//                     0.448, rescued 2)
//   v1Battery       — deterministic rescore under the live Phase-5 battery
//                     (containment AND exactly one question in the composed
//                     turn, else mini fallback) — secondary, symmetric
// plus containment behavior (bySource) and component-failure tables.
import fs from 'node:fs';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    mini: { type: 'string' },
    sonnet: { type: 'string' },
    terra: { type: 'string' },
    json: { type: 'string' },
  },
});
for (const k of ['mini', 'sonnet', 'terra']) {
  if (!args[k]) {
    console.error(`--${k} <grade-file-report.json> required`);
    process.exit(1);
  }
}

const load = (p) => JSON.parse(fs.readFileSync(p, 'utf8')).rows;
const miniRows = load(args.mini);
const miniCompliant = new Map(miniRows.map((r) => [r.turnId, r.compliant]));
const miniRate = miniRows.filter((r) => r.compliant).length / miniRows.length;

function familyReport(rows) {
  const n = rows.length;
  const bySource = {};
  for (const r of rows) bySource[r.source] = (bySource[r.source] || 0) + 1;
  const deliveredCompliant = rows.filter((r) => r.compliant).length;
  let union = 0;
  let rescued = 0;
  let v1 = 0;
  for (const r of rows) {
    const composedCompliant = r.source === 'composed' && r.compliant;
    const mini = miniCompliant.get(r.turnId);
    if (mini || composedCompliant) union += 1;
    if (!mini && composedCompliant) rescued += 1;
    // v1 battery: deliver the composed turn only if containment held AND it
    // carries exactly one question; otherwise the mini fallback.
    const oneQuestion = r.source === 'composed' && r.components?.exactly_one_question === true;
    v1 += (r.source === 'composed' && oneQuestion ? r.compliant : mini) ? 1 : 0;
  }
  const componentFailures = Object.fromEntries(
    ['exactly_one_question', 'warrant_cue', 'no_new_premise', 'guards_passed'].map((c) => [
      c,
      rows.filter((r) => r.components && r.components[c] === false).length,
    ]),
  );
  const composedRows = rows.filter((r) => r.source === 'composed');
  const composedComponentFailures = Object.fromEntries(
    ['exactly_one_question', 'warrant_cue', 'no_new_premise', 'guards_passed'].map((c) => [
      c,
      composedRows.filter((r) => r.components && r.components[c] === false).length,
    ]),
  );
  return {
    n,
    bySource,
    deliveredRate: deliveredCompliant / n,
    deliveredCompliant,
    failClosed: union / n,
    failClosedCompliant: union,
    rescued,
    v1Battery: v1 / n,
    v1BatteryCompliant: v1,
    componentFailures,
    composedN: composedRows.length,
    composedComponentFailures,
  };
}

const report = {
  schema: 'machinespirits.program2.terra-probe-comparison.v1',
  generatedAt: new Date().toISOString(),
  miniSolo: { rate: miniRate, compliant: miniRows.filter((r) => r.compliant).length, n: miniRows.length },
  sonnet: familyReport(load(args.sonnet)),
  terra: familyReport(load(args.terra)),
};
console.log(JSON.stringify(report, null, 2));
if (args.json) fs.writeFileSync(args.json, JSON.stringify(report, null, 2));
