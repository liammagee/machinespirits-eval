#!/usr/bin/env node
/**
 * The guarded pilot's primary conduct endpoint, measured and never gated.
 *
 * Registration: docs/adaptation-refinement/relay/110-registration-guarded-pilot.md §3.1
 *   "For each delivered challenge in the gated arm, did the learner make a
 *    bounded evidence move on that turn or the next? Scored from the transcript
 *    by the readers."
 * Plan wording (2026-08-15_guarded-learner-extension-plan.md §3):
 *   "After a delivered challenge, does the learner produce or accept a public
 *    evidence check within two turns, instead of dismissing or re-asserting?"
 *
 * Zero model calls. Reads a finished run.
 *
 * The registration names no act list for "a public evidence check", so this
 * reports a narrow and a wide reading side by side and says which acts each
 * one holds. Fixing the list is work for the main-block registration.
 *
 * Usage:
 *   node scripts/score-guarded-pilot-primary-endpoint.js --run <run-dir> [--out <file>] [--json]
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { GUARDED_PILOT_SHAPE, readDialogueGateTrace, conditionOfDialogueId } from './score-guarded-pilot-gate.js';

export const GUARDED_PILOT_PRIMARY_SCHEMA = 'machinespirits.adaptation-refinement.guarded-pilot-primary-endpoint.v1';

/** The learner turns that count: the turn after the challenge, and the one after that. */
export const RESPONSE_WINDOW_TURNS = 2;

/**
 * Narrow reading — the learner runs a public check, directs one, or takes a
 * result into the record. `learner_evidence_demand` is deliberately absent: by
 * the v3.3 preference rule it is the same request worn as a defensive move.
 */
export const EVIDENCE_ACTS_NARROW = Object.freeze([
  'learner_proposed_test',
  'tutor_directed_public_result_request',
  'learner_record_entry_request',
]);

/** Wide reading — adds analytic work and criterion questions. */
export const EVIDENCE_ACTS_WIDE = Object.freeze([
  ...EVIDENCE_ACTS_NARROW,
  'analytic_contribution',
  'criterion_question',
]);

/** The opposite conduct the endpoint contrasts with. */
export const HOLDING_OUT_ACTS = Object.freeze([
  'learner_overclaim_assertion',
  'learner_evidence_dismissal',
  'learner_evidence_demand',
]);

const CHALLENGE_FAMILY = 'challenge_resistance';
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/** Acts each presence reader named, keyed `dialogue#turn`. */
export function readPresenceActs(runDir) {
  const key = readJson(path.join(runDir, 'annotation-key.private.json'));
  const at = new Map(key.cases.map((row) => [row.sample_id, `${row.job_id}#${row.turn}`]));
  const byReader = new Map();
  for (const readerId of GUARDED_PILOT_SHAPE.presence_readers) {
    const cells = new Map();
    for (const row of readJson(path.join(runDir, `${readerId}.assembled.json`)).cases || []) {
      const where = at.get(row.sample_id);
      if (!where) continue;
      cells.set(where, new Set((row.events || []).map((event) => event.speech_act)));
    }
    byReader.set(readerId, cells);
  }
  return byReader;
}

/** Every challenge that reached the learner, with the turns that may answer it. */
export function findDeliveredChallenges(dialogues) {
  const rows = [];
  for (const dialogue of dialogues) {
    const horizon = Math.max(...dialogue.turns.map((turn) => turn.turn));
    for (const turn of dialogue.turns) {
      if (turn.mode !== 'active') continue;
      if (turn.delivered_action_family !== CHALLENGE_FAMILY || !turn.delivered_text_present) continue;
      const window = [];
      for (let step = 1; step <= RESPONSE_WINDOW_TURNS; step += 1) {
        if (turn.turn + step <= horizon) window.push(turn.turn + step);
      }
      rows.push({
        dialogue_id: dialogue.dialogue_id,
        condition: dialogue.condition,
        turn: turn.turn,
        warrant_basis: turn.warrant_basis,
        response_turns: window,
        censored: window.length < RESPONSE_WINDOW_TURNS,
      });
    }
  }
  return rows;
}

/** The gate's own reading: did its challenge contract close on the next turn? */
export function readContractOutcome(dialogue, challengeTurn) {
  const next = dialogue.turns.find((turn) => turn.turn === challengeTurn + 1);
  const basis = String(next?.warrant_basis || '');
  return {
    turn: next?.turn ?? null,
    warrant_basis: basis || null,
    contract_met: basis.startsWith(`contract_success:${CHALLENGE_FAMILY}`),
  };
}

function readingFor(acts, evidenceActs) {
  return {
    evidence: [...acts].filter((act) => evidenceActs.includes(act)),
    holding_out: [...acts].filter((act) => HOLDING_OUT_ACTS.includes(act)),
  };
}

export function scoreGuardedPilotPrimaryEndpoint(runDir) {
  const resolved = path.resolve(runDir);
  const dialoguesDir = path.join(resolved, 'dialogues');
  const dialogues = [];
  for (const name of fs.readdirSync(dialoguesDir).sort()) {
    const dir = path.join(dialoguesDir, name);
    if (!fs.statSync(dir).isDirectory()) continue;
    const trace = readDialogueGateTrace(dir);
    if (trace) dialogues.push({ ...trace, condition: conditionOfDialogueId(name) });
  }
  const byReader = readPresenceActs(resolved);
  const challenges = findDeliveredChallenges(dialogues).map((row) => {
    const dialogue = dialogues.find((entry) => entry.dialogue_id === row.dialogue_id);
    const readers = {};
    for (const [readerId, cells] of byReader) {
      const acts = new Set();
      for (const turn of row.response_turns)
        for (const act of cells.get(`${row.dialogue_id}#${turn}`) || []) acts.add(act);
      readers[readerId] = {
        acts: [...acts].sort(),
        narrow: readingFor(acts, EVIDENCE_ACTS_NARROW),
        wide: readingFor(acts, EVIDENCE_ACTS_WIDE),
      };
    }
    const votes = (width) => Object.values(readers).filter((row2) => row2[width].evidence.length > 0).length;
    return {
      ...row,
      gate_contract: readContractOutcome(dialogue, row.turn),
      readers,
      narrow_readers_seeing_evidence: votes('narrow'),
      wide_readers_seeing_evidence: votes('wide'),
    };
  });
  const rate = (hits, total) => (total ? Number((hits / total).toFixed(3)) : null);
  const total = challenges.length;
  const summary = {
    delivered_challenges: total,
    censored_windows: challenges.filter((row) => row.censored).length,
    gate_contract_met: challenges.filter((row) => row.gate_contract.contract_met).length,
    both_readers_narrow: challenges.filter((row) => row.narrow_readers_seeing_evidence === 2).length,
    either_reader_narrow: challenges.filter((row) => row.narrow_readers_seeing_evidence >= 1).length,
    both_readers_wide: challenges.filter((row) => row.wide_readers_seeing_evidence === 2).length,
    either_reader_wide: challenges.filter((row) => row.wide_readers_seeing_evidence >= 1).length,
  };
  // The other two arms deliver no challenge at all, so the endpoint has no
  // denominator there. Say so rather than reporting a zero.
  const armDenominators = {};
  for (const dialogue of dialogues) {
    const arm = (armDenominators[dialogue.condition] ||= { dialogues: 0, delivered_challenges: 0 });
    arm.dialogues += 1;
    arm.delivered_challenges += dialogue.turns.filter(
      (turn) => turn.mode === 'active' && turn.delivered_action_family === CHALLENGE_FAMILY,
    ).length;
  }
  return {
    schema: GUARDED_PILOT_PRIMARY_SCHEMA,
    run_dir: resolved,
    registration: 'docs/adaptation-refinement/relay/110-registration-guarded-pilot.md#3',
    measured_never_gated: true,
    act_list_not_registered: true,
    evidence_acts: { narrow: EVIDENCE_ACTS_NARROW, wide: EVIDENCE_ACTS_WIDE, holding_out: HOLDING_OUT_ACTS },
    summary: {
      ...summary,
      rates: {
        gate_contract_met: rate(summary.gate_contract_met, total),
        both_readers_narrow: rate(summary.both_readers_narrow, total),
        either_reader_narrow: rate(summary.either_reader_narrow, total),
        both_readers_wide: rate(summary.both_readers_wide, total),
        either_reader_wide: rate(summary.either_reader_wide, total),
      },
    },
    arms: armDenominators,
    challenges,
  };
}

function render(report) {
  const s = report.summary;
  const lines = [
    'guarded pilot — primary conduct endpoint (measured, never gated)',
    `run ${report.run_dir}`,
    '',
    `delivered challenges: ${s.delivered_challenges}; censored windows ${s.censored_windows}`,
    '',
    `gate contract met on the next turn : ${s.gate_contract_met}/${s.delivered_challenges}  (${s.rates.gate_contract_met})`,
    `both readers see an evidence check : ${s.both_readers_narrow}/${s.delivered_challenges}  (${s.rates.both_readers_narrow})  narrow`,
    `either reader sees one             : ${s.either_reader_narrow}/${s.delivered_challenges}  (${s.rates.either_reader_narrow})  narrow`,
    `both readers, wide reading         : ${s.both_readers_wide}/${s.delivered_challenges}  (${s.rates.both_readers_wide})`,
    `either reader, wide reading        : ${s.either_reader_wide}/${s.delivered_challenges}  (${s.rates.either_reader_wide})`,
    '',
    `narrow acts: ${report.evidence_acts.narrow.join(', ')}`,
    `wide adds  : ${report.evidence_acts.wide.filter((act) => !report.evidence_acts.narrow.includes(act)).join(', ')}`,
    '',
    'per challenge:',
  ];
  for (const row of report.challenges) {
    lines.push(
      `  ${row.dialogue_id.replace('outcome-pilot-', '')} turn ${row.turn} -> turns ${row.response_turns.join(',')}: ` +
        `gate ${row.gate_contract.contract_met ? 'met' : 'not met'}, readers ${row.narrow_readers_seeing_evidence}/2 narrow, ${row.wide_readers_seeing_evidence}/2 wide`,
    );
  }
  lines.push('', 'arms:');
  for (const [arm, row] of Object.entries(report.arms)) {
    lines.push(
      `  ${arm.padEnd(20)} ${row.dialogues} dialogues, ${row.delivered_challenges} delivered challenges` +
        (row.delivered_challenges ? '' : ' — no denominator, the endpoint cannot be read here'),
    );
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  const { values } = parseArgs({
    options: { run: { type: 'string' }, out: { type: 'string' }, json: { type: 'boolean' }, help: { type: 'boolean' } },
  });
  if (values.help || !values.run) {
    process.stdout.write(
      'Usage:\n  node scripts/score-guarded-pilot-primary-endpoint.js --run <run-dir> [--out <file>] [--json]\n',
    );
    process.exit(values.help ? 0 : 2);
  }
  const report = scoreGuardedPilotPrimaryEndpoint(values.run);
  if (values.out) {
    const resolved = path.resolve(values.out);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, `${JSON.stringify(report, null, 2)}\n`);
  }
  process.stdout.write(values.json ? `${JSON.stringify(report, null, 2)}\n` : render(report));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main();
}
