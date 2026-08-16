#!/usr/bin/env node
/**
 * Registered re-analysis: warranted-shift rate by condition.
 *
 * Registration: docs/adaptation-refinement/relay/121-registration-warranted-shift-rate-reanalysis.md
 * (sealed 2026-08-16, direction from mechanism alone, no pilot pre-read).
 *
 * Regroups the stored decision-reader data of a finished run. For each
 * condition: consensus cases the readers judged warranted / all consensus
 * cases. Beside it, description only: case counts, non-consensus counts
 * (recomputed from the two reader assemblies), and a dialogue-grain
 * summary. Zero model calls. Reads stored artifacts, edits nothing.
 *
 * Usage:
 *   node scripts/score-warranted-shift-rate-reanalysis.js --run <run-dir> [--out <file>] [--json]
 *
 * Exit codes: 0 computed, 2 bad input. The registered prediction P-R1 is
 * directional and never gates; this script reports, the note interprets.
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

export const WARRANTED_SHIFT_REANALYSIS_SCHEMA =
  'machinespirits.adaptation-refinement.warranted-shift-rate-reanalysis.v1';

const READER_FIELD = 'commitment_transition_warranted';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Consensus cases live in the frozen score file's measure-1 case list. */
export function consensusCases(scoreFile) {
  const score = readJson(scoreFile);
  const m1 = score.measure_1_decision_correctness;
  if (!m1 || !Array.isArray(m1.cases)) {
    throw new Error(`no measure_1_decision_correctness.cases in ${scoreFile}`);
  }
  return { cases: m1.cases, totals: m1 };
}

/** Non-consensus counts come from the two assemblies joined on sample id,
 *  with each case's condition from the annotation key. */
export function nonConsensusByCondition(runDir) {
  const key = readJson(path.join(runDir, 'annotation-key.private.json'));
  const conditionOf = new Map(key.cases.map((c) => [c.sample_id, c.condition]));
  const a = readJson(path.join(runDir, 'decision-reader-a.assembled.json'));
  const b = readJson(path.join(runDir, 'decision-reader-b.assembled.json'));
  const bById = new Map(b.cases.map((c) => [c.sample_id, c[READER_FIELD]]));
  const counts = {};
  for (const c of a.cases) {
    const other = bById.get(c.sample_id);
    if (other === undefined) throw new Error(`reader b is missing ${c.sample_id}`);
    if (c[READER_FIELD] !== other) {
      const condition = conditionOf.get(c.sample_id);
      if (!condition) throw new Error(`no condition in the key for ${c.sample_id}`);
      counts[condition] = (counts[condition] ?? 0) + 1;
    }
  }
  return counts;
}

export function scoreRun(runDir) {
  const { cases, totals } = consensusCases(path.join(runDir, 'outcome-pilot-score.json'));
  const nonConsensus = nonConsensusByCondition(runDir);

  const byCondition = {};
  const byDialogue = new Map();
  for (const c of cases) {
    const cond = (byCondition[c.condition] ??= { consensus_cases: 0, warranted: 0 });
    cond.consensus_cases += 1;
    if (c.reader_consensus_decision === 'yes') cond.warranted += 1;
    const d = byDialogue.get(c.dialogue_id) ?? { condition: c.condition, consensus_cases: 0, warranted: 0 };
    d.consensus_cases += 1;
    if (c.reader_consensus_decision === 'yes') d.warranted += 1;
    byDialogue.set(c.dialogue_id, d);
  }
  for (const [condition, row] of Object.entries(byCondition)) {
    row.warranted_rate = row.warranted / row.consensus_cases;
    row.non_consensus_cases = nonConsensus[condition] ?? 0;
  }

  const dialogueGrain = {};
  for (const d of byDialogue.values()) {
    const g = (dialogueGrain[d.condition] ??= { dialogues: 0, fractions: [] });
    g.dialogues += 1;
    g.fractions.push(d.warranted / d.consensus_cases);
  }
  for (const g of Object.values(dialogueGrain)) {
    g.mean_warranted_fraction = g.fractions.reduce((s, f) => s + f, 0) / g.fractions.length;
    g.fractions = undefined;
  }

  const gated = byCondition.gated;
  const prediction = gated
    ? {
        registered: 'P-R1: gated warranted-shift rate exceeds bare and standing_permission',
        gated_exceeds_bare: gated.warranted_rate > (byCondition.bare?.warranted_rate ?? NaN),
        gated_exceeds_standing_permission:
          gated.warranted_rate > (byCondition.standing_permission?.warranted_rate ?? NaN),
      }
    : { registered: 'P-R1', error: 'no gated condition in the case list' };

  return {
    schema: WARRANTED_SHIFT_REANALYSIS_SCHEMA,
    registration: 'relay 121, sealed 2026-08-16',
    inferential_role: 'registered post-hoc re-analysis; labeled as such wherever it is cited',
    zero_model_calls: true,
    run_dir: path.resolve(runDir),
    source_totals: {
      total_cases: totals.total_cases,
      consensus_cases: totals.consensus_cases,
      non_consensus_cases: totals.non_consensus_cases,
    },
    by_condition: byCondition,
    dialogue_grain: dialogueGrain,
    prediction,
  };
}

function main() {
  const { values } = parseArgs({
    options: {
      run: { type: 'string' },
      out: { type: 'string' },
      json: { type: 'boolean', default: false },
    },
  });
  if (!values.run || !fs.existsSync(values.run)) {
    console.error('usage: score-warranted-shift-rate-reanalysis.js --run <run-dir> [--out <file>] [--json]');
    process.exit(2);
  }
  const report = scoreRun(values.run);
  const text = JSON.stringify(report, null, 2);
  if (values.out) fs.writeFileSync(values.out, `${text}\n`);
  if (values.json || !values.out) console.log(text);
  if (!values.json) {
    for (const [condition, row] of Object.entries(report.by_condition)) {
      console.error(
        `${condition}: ${row.warranted} / ${row.consensus_cases} warranted (${(row.warranted_rate * 100).toFixed(1)}%), ` +
          `${row.non_consensus_cases} non-consensus`,
      );
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main();
}
