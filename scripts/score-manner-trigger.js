/**
 * Manner-trigger scorecard — offline replay of a trigger version over
 * recorded dialogues (card: workplan/items/manner-trigger-tuning.md).
 *
 * No model calls, no new runs: the trigger is text-in, so any version can be
 * replayed over any recorded learner turns. Two dialogue sets:
 *
 * - BENCH set (traces containing `learner_stress_plant` events): planted
 *   turns are labeled gold. Metrics: per-plant classification recall (the
 *   classifier read pressure at a should-fire plant), arming recall (the
 *   card was on at, or within one turn after, a should-fire plant), and
 *   wrong-fire count at should-not-fire plants (bored, lost — the quiet
 *   repairs the schoolmaster must not answer).
 * - ORGANIC set (no plant events): supplies the live base rate. Metric:
 *   armed windows per dialogue (false alarms — every arming here is
 *   unoccasioned by construction, or at least unauditable).
 *
 * The should-fire mapping is scorer policy v0, recorded here rather than in
 * the ratified schedule because it is mechanical (pressure-shaped states
 * fire, quiet-repair states must not), not a new pedagogical judgment:
 * fire = jumping_ahead, irritated, frustrated, opposed, forgetting;
 * no-fire = bored, lost.
 *
 * Usage:
 *   node scripts/score-manner-trigger.js [--trigger config/manner-trigger/v2.json] [--json]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  advanceTutorStubMannerSwitch,
  compileTutorStubTriggerArtifact,
  createTutorStubMannerSwitchState,
} from '../services/tutorStubMannerSwitch.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SHOULD_FIRE = new Set(['jumping_ahead', 'irritated', 'frustrated', 'opposed', 'forgetting']);
const SHOULD_NOT_FIRE = new Set(['bored', 'lost']);

const BENCH_DIRS = [
  'exports/tutor-stub-outcome/exp-stressbench2-butler',
  'exports/tutor-stub-outcome/exp-stressbench2-book',
  'exports/tutor-stub-outcome/exp-stressbench2-switch',
];
// The contemporary record-keeper presses ORGANICALLY, so her unplanted
// dialogues are not a negative set — arming there is conduct, not noise
// (verified 2026-08-01: her organic firings are real mockery and demands).
// The false-alarm base rate comes from the CALM set: the diligent-profile
// dialogues, where pressure genuinely never occurs.
const CALM_DIRS = [
  'exports/tutor-stub-outcome/misconception-gate-1/traces/world_032_alder_row/d0',
  'exports/tutor-stub-outcome/misconception-gate-1/traces/world_032_alder_row/d1',
  'exports/tutor-stub-outcome/misconception-gate-1/traces/world_032_alder_row/d2',
  'exports/tutor-stub-outcome/misconception-gate-1/traces/world_032_alder_row/d3',
  'exports/tutor-stub-outcome/misconception-gate-1/traces/world_032_alder_row/d4',
];
const ORGANIC_DIRS = [
  'exports/tutor-stub-outcome/exp-custom-brief',
  'exports/tutor-stub-outcome/exp-shadow-butler',
  'exports/tutor-stub-outcome/exp-shadow-book',
  'exports/tutor-stub-outcome/exp-shadow-switch',
  'exports/tutor-stub-outcome/exp-sonnet-nobook',
  'exports/tutor-stub-outcome/exp-sonnet-unleashed',
  'exports/tutor-stub-outcome/exp-stance-haiku',
  'exports/tutor-stub-outcome/exp-stance-opus',
  'exports/tutor-stub-outcome/exp-stance-fable',
  'exports/tutor-stub-outcome/exp-stance-luna',
  'exports/tutor-stub-outcome/exp-stance-sol',
  'exports/tutor-stub-outcome/exp-tutor-stance',
  'exports/tutor-stub-outcome/exp-tutor-moves',
  'exports/tutor-stub-outcome/exp-tutor-stance-sonnet',
];

function findTrace(dirRel) {
  const base = path.resolve(ROOT, dirRel);
  const stack = [base];
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) stack.push(path.join(dir, entry.name));
      else if (entry.name.endsWith('.jsonl') && !entry.name.includes('summary')) return path.join(dir, entry.name);
    }
  }
  return null;
}

function loadDialogue(tracePath) {
  const ev = fs
    .readFileSync(tracePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const turns = ev
    .filter((e) => e.type === 'turn_complete')
    .map((e) => ({ turn: e.turn, learner: e.turnRecord?.learner || '' }));
  const plants = ev.filter((e) => e.type === 'learner_stress_plant').map((e) => ({ turn: e.turn, state: e.state }));
  return { turns, plants };
}

function replayTrigger(dialogue, trigger) {
  const state = createTutorStubMannerSwitchState(trigger);
  const rows = [];
  for (const turn of dialogue.turns) {
    advanceTutorStubMannerSwitch(state, { learnerText: turn.learner, turn: turn.turn });
    rows.push({ turn: turn.turn, ...state.lastAdvance });
  }
  return rows;
}

function scoreDialogue(dialogue, trigger) {
  const rows = replayTrigger(dialogue, trigger);
  const rowByTurn = Object.fromEntries(rows.map((row) => [row.turn, row]));
  const armedTurns = rows.filter((row) => row.manner === 'schoolmaster').map((row) => row.turn);
  const armedWindows = rows.filter((row) => row.changed && row.manner === 'schoolmaster').length;

  const plantScores = dialogue.plants.map((plant) => {
    const row = rowByTurn[plant.turn] || {};
    const next = rowByTurn[plant.turn + 1] || {};
    const classified = row.pressure && row.pressure !== 'neutral' && row.pressure !== 'concession';
    const armed = row.manner === 'schoolmaster' || next.manner === 'schoolmaster';
    return { ...plant, classified, armed, pressure: row.pressure };
  });

  return { rows, armedTurns, armedWindows, plantScores };
}

function main() {
  const args = process.argv.slice(2);
  const triggerArg = args.includes('--trigger') ? args[args.indexOf('--trigger') + 1] : null;
  const trigger = triggerArg
    ? compileTutorStubTriggerArtifact(JSON.parse(fs.readFileSync(path.resolve(ROOT, triggerArg), 'utf8')))
    : null;
  const label = trigger?.version || 'v1-builtin';

  const bench = { shouldFire: 0, classified: 0, armed: 0, quiet: 0, wrongFire: 0, misses: [] };
  for (const dirRel of BENCH_DIRS) {
    const tracePath = findTrace(dirRel);
    if (!tracePath) continue;
    const dialogue = loadDialogue(tracePath);
    const { plantScores } = scoreDialogue(dialogue, trigger);
    for (const plant of plantScores) {
      if (SHOULD_FIRE.has(plant.state)) {
        bench.shouldFire += 1;
        if (plant.classified) bench.classified += 1;
        if (plant.armed) bench.armed += 1;
        if (!plant.classified) {
          const text = dialogue.turns.find((turn) => turn.turn === plant.turn)?.learner || '';
          bench.misses.push({
            arm: path.basename(dirRel),
            turn: plant.turn,
            state: plant.state,
            read: plant.pressure,
            text: text.slice(0, 110),
          });
        }
      } else if (SHOULD_NOT_FIRE.has(plant.state)) {
        bench.quiet += 1;
        if (plant.armed) bench.wrongFire += 1;
      }
    }
  }

  let calmDialogues = 0;
  let calmWindows = 0;
  for (const dirRel of CALM_DIRS) {
    const tracePath = findTrace(dirRel);
    if (!tracePath) continue;
    const dialogue = loadDialogue(tracePath);
    calmDialogues += 1;
    calmWindows += scoreDialogue(dialogue, trigger).armedWindows;
  }

  let organicDialogues = 0;
  let organicWindows = 0;
  for (const dirRel of ORGANIC_DIRS) {
    const tracePath = findTrace(dirRel);
    if (!tracePath) continue;
    const dialogue = loadDialogue(tracePath);
    if (dialogue.plants.length) continue; // safety: only unplanted dialogues supply the base rate
    organicDialogues += 1;
    organicWindows += scoreDialogue(dialogue, trigger).armedWindows;
  }

  const report = {
    schema: 'machinespirits.tutor-stub.manner-trigger-scorecard.v1',
    triggerVersion: label,
    bench: {
      shouldFirePlants: bench.shouldFire,
      classificationRecall: `${bench.classified}/${bench.shouldFire}`,
      armingRecall: `${bench.armed}/${bench.shouldFire}`,
      quietPlants: bench.quiet,
      wrongFiresAtQuietPlants: bench.wrongFire,
      misses: bench.misses,
    },
    calm: {
      dialogues: calmDialogues,
      armedWindows: calmWindows,
      falseAlarmsPerDialogue: calmDialogues ? (calmWindows / calmDialogues).toFixed(2) : null,
    },
    organic: {
      dialogues: organicDialogues,
      armedWindows: organicWindows,
      organicArmingPerDialogue: organicDialogues ? (organicWindows / organicDialogues).toFixed(2) : null,
    },
  };
  if (args.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(`trigger ${label}`);
  console.log(
    `BENCH  classification recall ${report.bench.classificationRecall} · arming recall ${report.bench.armingRecall} · wrong-fires at quiet plants ${bench.wrongFire}/${bench.quiet}`,
  );
  console.log(
    `CALM  ${calmDialogues} dialogues · false alarms/dialogue ${report.calm.falseAlarmsPerDialogue} (the gate metric)`,
  );
  console.log(
    `ORGANIC (pressing persona)  ${organicDialogues} dialogues · arming/dialogue ${report.organic.organicArmingPerDialogue} (informational — her pressure is real)`,
  );
  if (bench.misses.length) {
    console.log('\nmisses:');
    for (const miss of bench.misses)
      console.log(`  [${miss.arm} t${miss.turn} ${miss.state}, read=${miss.read}] ${miss.text}`);
  }
}

main();
