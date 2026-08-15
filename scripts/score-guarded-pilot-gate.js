#!/usr/bin/env node
/**
 * Score the guarded-learner outcome pilot against its registered gate.
 *
 * Registration: docs/adaptation-refinement/relay/110-registration-guarded-pilot.md §4.
 * Reading of the slots: docs/adaptation-refinement/relay/112-guarded-pilot-reseal.md —
 * slots (a) and (b) read the live warrant-gate trace, slot (c) reads the frozen readers.
 *
 * Zero model calls. Reads a finished run directory and writes a report.
 *
 * Usage:
 *   node scripts/score-guarded-pilot-gate.js --run <run-dir> [--out <file>] [--json]
 *
 * Exit codes: 0 every slot PASS, 1 any slot FAIL or UNMEASURED, 2 bad input.
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { readGateDecisions, resolveDefensiveActEventFiles } from './report-adaptive-warrant-defensive-acts.js';

export const GUARDED_PILOT_GATE_SCHEMA = 'machinespirits.adaptation-refinement.guarded-pilot-gate-report.v1';

/** The shape the registration fixes: 3 arms x 2 worlds x 3 seeds, 8 turns each. */
export const GUARDED_PILOT_SHAPE = Object.freeze({
  dialogues: 18,
  turns_per_dialogue: 8,
  turns_total: 144,
  gated_dialogues: 6,
  presence_readers: ['presence-reader-a', 'presence-reader-b'],
});

/** The sensor's registered threshold: 3 consecutive defended over-claim turns. */
export const DEFENSIVE_STRETCH_TURNS = 3;
const DEFENDED_SIGNAL = 'defended_overclaim';
const SUSTAINED_BASIS_PREFIX = 'sustained_defended_overclaim';
const CHALLENGE_FAMILY = 'challenge_resistance';
const READER_OVERCLAIM_ACT = 'learner_overclaim_assertion';

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/** `outcome-pilot-04-world_102_marigold_archive_box-s515-gated` -> `gated`. */
export function conditionOfDialogueId(dialogueId) {
  const withoutSeed = String(dialogueId).replace(/^.*-s\d+-/u, '');
  return withoutSeed || null;
}

/**
 * One dialogue's gate trace: the per-turn decision, whether the gate's wanted
 * family was applied, and what actually reached the learner.
 */
export function readDialogueGateTrace(dialogueDir) {
  const files = resolveDefensiveActEventFiles(dialogueDir).filter((file) => !path.basename(file).startsWith('run-'));
  if (!files.length) return null;
  const file = files[files.length - 1];
  const decisions = readGateDecisions(file);
  const enforcement = new Map();
  const delivered = new Map();
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    const turn = row?.turn ?? null;
    if (turn === null) continue;
    if (row.type === 'tutor_warrant_gate_final_authority' && row.enforcement) enforcement.set(turn, row.enforcement);
    if (row.type === 'tutor_warrant_gate_outcome' && row.outcome) delivered.set(turn, row.outcome);
  }
  const turns = decisions.map((decision) => {
    const turn = decision.turn;
    const outcome = delivered.get(turn) || null;
    const text = typeof outcome?.tutor_text === 'string' ? outcome.tutor_text.trim() : '';
    return {
      turn,
      mode: decision.mode ?? null,
      signal: decision.learner_signal?.primary ?? null,
      extraction_status: decision.learner_signal?.extraction_status ?? null,
      warrant_basis: decision.warrant_basis ?? null,
      decision_kind: decision.decision_kind ?? null,
      revision_warranted: decision.revision_warranted === true,
      policy_action_family: decision.policy?.family ?? null,
      enforcement_logged: enforcement.has(turn),
      enforcement_applied: enforcement.get(turn)?.applied === true,
      desired_action_family: enforcement.get(turn)?.desired_action_family ?? null,
      delivered_action_family: outcome?.action_family ?? null,
      delivered_text_present: text.length > 0,
      delivered_text_chars: text.length,
    };
  });
  return { dialogue_id: path.basename(dialogueDir), trace_file: file, turns };
}

/** Runs of `DEFENSIVE_STRETCH_TURNS` or more consecutive defended over-claim turns. */
export function findDefensiveStretches(turns) {
  const stretches = [];
  let open = [];
  for (const turn of turns) {
    if (turn.signal === DEFENDED_SIGNAL) {
      open.push(turn.turn);
      continue;
    }
    if (open.length >= DEFENSIVE_STRETCH_TURNS) stretches.push([...open]);
    open = [];
  }
  if (open.length >= DEFENSIVE_STRETCH_TURNS) stretches.push([...open]);
  return stretches;
}

/**
 * Slot (a): in more than half the gated dialogues that carry a defensive
 * stretch, the sensor must arm on at least one such stretch.
 */
export function scoreSensorArmingSlot(dialogues) {
  const gated = dialogues.filter((d) => d.condition === 'gated');
  const rows = gated.map((dialogue) => {
    const stretches = findDefensiveStretches(dialogue.turns);
    const stretchTurns = new Set(stretches.flat());
    const armedTurns = dialogue.turns
      .filter((turn) => String(turn.warrant_basis || '').startsWith(SUSTAINED_BASIS_PREFIX))
      .map((turn) => turn.turn);
    const armedOnStretch = armedTurns.filter((turn) => stretchTurns.has(turn));
    return {
      dialogue_id: dialogue.dialogue_id,
      stretches,
      carries_stretch: stretches.length > 0,
      armed_turns: armedTurns,
      armed_on_stretch_turns: armedOnStretch,
      armed_on_stretch: armedOnStretch.length > 0,
    };
  });
  const denominator = rows.filter((row) => row.carries_stretch).length;
  const numerator = rows.filter((row) => row.carries_stretch && row.armed_on_stretch).length;
  const needed = Math.floor(denominator / 2) + 1;
  return {
    slot: 'a',
    name: 'the sensor arms when it should',
    gated_dialogues: gated.length,
    dialogues_carrying_a_stretch: denominator,
    dialogues_armed_on_a_stretch: numerator,
    majority_needed: needed,
    verdict: denominator === 0 ? 'UNMEASURED' : numerator >= needed ? 'PASS' : 'FAIL',
    unmeasured_reason: denominator === 0 ? 'no gated dialogue carries a defensive stretch' : null,
    rows,
  };
}

/**
 * Slot (b): every armed stretch the policy selects for a challenge must produce
 * a challenge that reaches the learner. The selection is read from the policy,
 * never from the enforcement — reading it from the enforcement would hide a
 * selection that produced no enforcement at all, which is the drop this slot is
 * for. Only live turns count: in `observe` mode the same gate runs as a shadow
 * and by design reaches nobody, so those selections are reported apart.
 */
export function scoreNoSilentDropsSlot(dialogues) {
  const selections = [];
  const shadow = [];
  for (const dialogue of dialogues) {
    for (const turn of dialogue.turns) {
      if (turn.policy_action_family !== CHALLENGE_FAMILY) continue;
      const row = {
        dialogue_id: dialogue.dialogue_id,
        condition: dialogue.condition,
        mode: turn.mode,
        turn: turn.turn,
        warrant_basis: turn.warrant_basis,
        enforcement_logged: turn.enforcement_logged,
        enforcement_applied: turn.enforcement_applied,
        delivered_action_family: turn.delivered_action_family,
        delivered_text_present: turn.delivered_text_present,
      };
      if (turn.mode !== 'active') {
        shadow.push(row);
        continue;
      }
      selections.push({
        ...row,
        dropped:
          !turn.enforcement_logged ||
          !turn.enforcement_applied ||
          turn.delivered_action_family !== CHALLENGE_FAMILY ||
          !turn.delivered_text_present,
      });
    }
  }
  const drops = selections.filter((row) => row.dropped);
  return {
    slot: 'b',
    name: 'no silent drops',
    challenges_selected: selections.length,
    challenges_delivered: selections.length - drops.length,
    silent_drops: drops.length,
    shadow_selections_not_gated: shadow.length,
    verdict: selections.length === 0 ? 'UNMEASURED' : drops.length === 0 ? 'PASS' : 'FAIL',
    unmeasured_reason: selections.length === 0 ? 'the policy never selected a challenge on a live turn' : null,
    shadow_rows: shadow,
    dropped_rows: drops,
    rows: selections,
  };
}

/**
 * Slot (c): reader coverage is complete under the declared recovery path — one
 * logged re-ask per refused turn, then the turn counts as unanalyzed and its
 * dialogue is flagged.
 */
export function scoreReaderCoverageSlot(runDir, expectedCases) {
  const channels = [
    { channel: 'presence', dir: 'presence-readers', run: 'semantic-reader-run.json' },
    { channel: 'decision', dir: 'decision-readers', run: 'decision-reader-run.json' },
  ];
  const rows = [];
  for (const { channel, dir, run } of channels) {
    const runPath = path.join(runDir, dir, run);
    if (!fs.existsSync(runPath)) {
      rows.push({ channel, present: false, status: null });
      continue;
    }
    const state = readJson(runPath);
    const batches = state.batches || [];
    rows.push({
      channel,
      present: true,
      status: state.status ?? null,
      calls_attempted: state.calls_attempted ?? null,
      calls_completed: state.calls_completed ?? null,
      complete_batches: batches.filter((row) => row.status === 'complete').length,
      incomplete_batches: batches.filter((row) => row.status !== 'complete').map((row) => row.batch_id),
      re_read_batches: [
        ...new Set(batches.map((row) => row.batch_id).filter((id, index, all) => all.indexOf(id) !== index)),
      ],
    });
  }
  const readers = [];
  for (const readerId of GUARDED_PILOT_SHAPE.presence_readers) {
    const file = path.join(runDir, `${readerId}.assembled.json`);
    if (!fs.existsSync(file)) {
      readers.push({ reader_id: readerId, present: false });
      continue;
    }
    const assembled = readJson(file);
    const cases = assembled.cases || [];
    readers.push({
      reader_id: readerId,
      present: true,
      cases: cases.length,
      rejected: cases.filter((row) => row.assembly_rejection).length,
      ambiguous: cases.filter((row) => row.genuinely_ambiguous).length,
      unanalyzed: cases.filter((row) => row.assembly_rejection || !Array.isArray(row.events)).length,
    });
  }
  const channelsOk = rows.every(
    (row) => row.present && row.status === 'complete' && row.incomplete_batches.length === 0,
  );
  const readersOk =
    readers.length === GUARDED_PILOT_SHAPE.presence_readers.length &&
    readers.every((row) => row.present && row.cases === expectedCases && row.rejected === 0 && row.unanalyzed === 0);
  return {
    slot: 'c',
    name: 'reader coverage is complete',
    expected_cases: expectedCases,
    verdict: channelsOk && readersOk ? 'PASS' : 'FAIL',
    channels: rows,
    readers,
  };
}

/**
 * Report-only cross-check: the same stretch count read from the frozen presence
 * readers instead of the live trace. Never a gate slot — the readers answer
 * about single turns, and relay 112 puts slots (a) and (b) on the live trace.
 */
export function readerStretchCrossCheck(runDir, dialogues) {
  const keyPath = path.join(runDir, 'annotation-key.private.json');
  if (!fs.existsSync(keyPath)) return { available: false, reason: 'no annotation key in the run' };
  const key = readJson(keyPath);
  const turnOf = new Map(key.cases.map((row) => [row.sample_id, { dialogue_id: row.job_id, turn: row.turn }]));
  const marked = new Map();
  for (const readerId of GUARDED_PILOT_SHAPE.presence_readers) {
    const file = path.join(runDir, `${readerId}.assembled.json`);
    if (!fs.existsSync(file)) return { available: false, reason: `no assembled file for ${readerId}` };
    for (const row of readJson(file).cases || []) {
      const at = turnOf.get(row.sample_id);
      if (!at) continue;
      const overclaims = (row.events || []).some((event) => event.speech_act === READER_OVERCLAIM_ACT);
      const cell = marked.get(`${at.dialogue_id}#${at.turn}`) || { readers: 0 };
      if (overclaims) cell.readers += 1;
      marked.set(`${at.dialogue_id}#${at.turn}`, cell);
    }
  }
  // Re-score slot (a) with the readers standing in for the live signal. The
  // sensor's arming turns stay as the gate recorded them; only the stretches
  // move. This says whether the verdict turns on which source is read.
  const summarize = (minReaders) => {
    const carrying = [];
    const armed = [];
    for (const dialogue of dialogues.filter((d) => d.condition === 'gated')) {
      const turns = dialogue.turns.map((turn) => ({
        turn: turn.turn,
        signal:
          (marked.get(`${dialogue.dialogue_id}#${turn.turn}`)?.readers || 0) >= minReaders ? DEFENDED_SIGNAL : null,
      }));
      const stretchTurns = new Set(findDefensiveStretches(turns).flat());
      if (!stretchTurns.size) continue;
      carrying.push(dialogue.dialogue_id);
      const armedOnStretch = dialogue.turns.some(
        (turn) => String(turn.warrant_basis || '').startsWith(SUSTAINED_BASIS_PREFIX) && stretchTurns.has(turn.turn),
      );
      if (armedOnStretch) armed.push(dialogue.dialogue_id);
    }
    const needed = Math.floor(carrying.length / 2) + 1;
    return {
      dialogues_carrying_a_stretch: carrying.length,
      dialogues_armed_on_a_stretch: armed.length,
      majority_needed: needed,
      verdict: carrying.length === 0 ? 'UNMEASURED' : armed.length >= needed ? 'PASS' : 'FAIL',
      carrying,
    };
  };
  const both = summarize(2);
  const either = summarize(1);
  return {
    available: true,
    note: 'report-only; the gate verdict uses the live trace per relay 112',
    slot_a_when_both_readers_mark_the_turn: both,
    slot_a_when_either_reader_marks_the_turn: either,
    verdict_turns_on_the_source: both.verdict !== either.verdict,
  };
}

/** Every registered measure must be present, or the run is half-measured. */
export function checkShape(dialogues) {
  const problems = [];
  if (dialogues.length !== GUARDED_PILOT_SHAPE.dialogues) {
    problems.push(`expected ${GUARDED_PILOT_SHAPE.dialogues} dialogues, found ${dialogues.length}`);
  }
  const gated = dialogues.filter((d) => d.condition === 'gated').length;
  if (gated !== GUARDED_PILOT_SHAPE.gated_dialogues) {
    problems.push(`expected ${GUARDED_PILOT_SHAPE.gated_dialogues} gated dialogues, found ${gated}`);
  }
  let turnCount = 0;
  for (const dialogue of dialogues) {
    turnCount += dialogue.turns.length;
    if (dialogue.turns.length !== GUARDED_PILOT_SHAPE.turns_per_dialogue) {
      problems.push(
        `${dialogue.dialogue_id}: ${dialogue.turns.length} gate decisions, expected ${GUARDED_PILOT_SHAPE.turns_per_dialogue}`,
      );
    }
    for (const turn of dialogue.turns) {
      if (!turn.signal)
        problems.push(`${dialogue.dialogue_id} turn ${turn.turn}: no learner signal on the gate decision`);
      if (!turn.delivered_action_family)
        problems.push(`${dialogue.dialogue_id} turn ${turn.turn}: no delivered action family`);
    }
  }
  if (turnCount !== GUARDED_PILOT_SHAPE.turns_total) {
    problems.push(`expected ${GUARDED_PILOT_SHAPE.turns_total} scored turns, found ${turnCount}`);
  }
  return problems;
}

export function scoreGuardedPilotGate(runDir) {
  const resolved = path.resolve(runDir);
  const dialoguesDir = path.join(resolved, 'dialogues');
  if (!fs.existsSync(dialoguesDir)) throw new Error(`no dialogues directory under ${resolved}`);
  const dialogues = [];
  for (const name of fs.readdirSync(dialoguesDir).sort()) {
    const dir = path.join(dialoguesDir, name);
    if (!fs.statSync(dir).isDirectory()) continue;
    const trace = readDialogueGateTrace(dir);
    if (!trace) continue;
    dialogues.push({ ...trace, condition: conditionOfDialogueId(name) });
  }
  const shapeProblems = checkShape(dialogues);
  const slotA = scoreSensorArmingSlot(dialogues);
  const slotB = scoreNoSilentDropsSlot(dialogues);
  const slotC = scoreReaderCoverageSlot(resolved, GUARDED_PILOT_SHAPE.turns_total);
  const slots = [slotA, slotB, slotC];
  const verdict = shapeProblems.length
    ? 'UNMEASURED'
    : slots.some((slot) => slot.verdict === 'FAIL')
      ? 'FAIL'
      : slots.some((slot) => slot.verdict === 'UNMEASURED')
        ? 'UNMEASURED'
        : 'PASS';
  return {
    schema: GUARDED_PILOT_GATE_SCHEMA,
    run_dir: resolved,
    registration: 'docs/adaptation-refinement/relay/110-registration-guarded-pilot.md#4',
    slot_reading: 'docs/adaptation-refinement/relay/112-guarded-pilot-reseal.md',
    shape_problems: shapeProblems,
    verdict,
    licenses_main_block: verdict === 'PASS',
    slots,
    reader_cross_check: readerStretchCrossCheck(resolved, dialogues),
    dialogues: dialogues.map((d) => ({ dialogue_id: d.dialogue_id, condition: d.condition, turns: d.turns })),
  };
}

function render(report) {
  const lines = [`guarded pilot gate — ${report.verdict}`, `run ${report.run_dir}`, ''];
  if (report.shape_problems.length) {
    lines.push('shape problems (the run is half-measured):');
    for (const problem of report.shape_problems) lines.push(`  - ${problem}`);
    lines.push('');
  }
  const [a, b, c] = report.slots;
  lines.push(
    `(a) ${a.name}: ${a.verdict}`,
    `    ${a.dialogues_armed_on_a_stretch} of ${a.dialogues_carrying_a_stretch} gated dialogues with a defensive stretch armed on one; ${a.majority_needed} needed`,
  );
  for (const row of a.rows) {
    lines.push(
      `    ${row.dialogue_id}: stretches ${row.stretches.map((s) => s.join('-')).join(', ') || 'none'}; armed ${row.armed_on_stretch_turns.join(',') || 'none'}`,
    );
  }
  lines.push(
    '',
    `(b) ${b.name}: ${b.verdict}`,
    `    ${b.challenges_delivered} of ${b.challenges_selected} selected challenges reached the learner; ${b.silent_drops} dropped`,
    `    ${b.shadow_selections_not_gated} further selections were made in observe mode, where the gate reaches nobody by design`,
  );
  for (const row of b.dropped_rows) {
    lines.push(`    DROP ${row.dialogue_id} turn ${row.turn}: delivered ${row.delivered_action_family}`);
  }
  lines.push('', `(c) ${c.name}: ${c.verdict}`);
  for (const row of c.channels) {
    lines.push(
      `    ${row.channel}: status ${row.status}, ${row.complete_batches} complete batches, ${row.incomplete_batches.length} incomplete`,
    );
  }
  for (const row of c.readers) {
    lines.push(`    ${row.reader_id}: ${row.cases} cases, ${row.rejected} rejected, ${row.unanalyzed} unanalyzed`);
  }
  const cross = report.reader_cross_check;
  if (cross.available) {
    const line = (label, row) =>
      `    ${label}: ${row.verdict} — ${row.dialogues_armed_on_a_stretch} of ${row.dialogues_carrying_a_stretch}, ${row.majority_needed} needed`;
    lines.push(
      '',
      'slot (a) re-scored on the readers (report-only):',
      line('both readers mark the turn ', cross.slot_a_when_both_readers_mark_the_turn),
      line('either reader marks the turn', cross.slot_a_when_either_reader_marks_the_turn),
      `    the verdict ${cross.verdict_turns_on_the_source ? 'TURNS ON' : 'does not turn on'} which source is read`,
    );
  }
  lines.push('', report.licenses_main_block ? 'the main block is licensed' : 'the main block is NOT licensed');
  return `${lines.join('\n')}\n`;
}

function main() {
  let options;
  try {
    ({ values: options } = parseArgs({
      options: {
        run: { type: 'string' },
        out: { type: 'string' },
        json: { type: 'boolean' },
        help: { type: 'boolean' },
      },
    }));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(2);
  }
  if (options.help || !options.run) {
    process.stdout.write(
      'Usage:\n  node scripts/score-guarded-pilot-gate.js --run <run-dir> [--out <file>] [--json]\n',
    );
    process.exit(options.help ? 0 : 2);
  }
  let report;
  try {
    report = scoreGuardedPilotGate(options.run);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(2);
  }
  if (options.out) {
    fs.mkdirSync(path.dirname(path.resolve(options.out)), { recursive: true });
    fs.writeFileSync(path.resolve(options.out), `${JSON.stringify(report, null, 2)}\n`);
  }
  process.stdout.write(options.json ? `${JSON.stringify(report, null, 2)}\n` : render(report));
  process.exit(report.verdict === 'PASS' ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main();
}
