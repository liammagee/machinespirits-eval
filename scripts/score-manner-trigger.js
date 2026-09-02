/**
 * Manner-trigger scorecard — offline replay of a trigger version over
 * recorded dialogues (card: workplan/items/manner-trigger-tuning.md;
 * cross-world replay: workplan/items/state-detection-without-word-lists.md).
 *
 * No model calls, no new runs: the trigger is text-in, so any version can be
 * replayed over any recorded learner turns. Two dialogue sets:
 *
 * - BENCH set (traces containing `learner_stress_plant` events): planted
 *   turns are labeled gold. Metrics: per-plant classification recall (the
 *   classifier read pressure at a should-fire plant), kind recall (it read
 *   the RIGHT pressure kind for the planted state), arming recall (the
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
 * no-fire = bored, lost. The expected KIND per state is the shared
 * TUTOR_STUB_PLANT_STATE_TO_PRESSURE map (same one the v6 trainer labels with).
 *
 * Usage:
 *   node scripts/score-manner-trigger.js [--trigger config/manner-trigger/v2.json] [--json]
 *     [--trace <file.jsonl>]...     extra bench traces (explicit files; label = parentDir/basename)
 *     [--bench-dir <dir>]...        extra bench dirs (every .jsonl under them, not just the first)
 *     [--tiers all|patterns+bags|patterns]
 *                                   strip the world-bound tiers off a cascade artifact before replay
 *     [--per-plant]                 print one row per planted turn, with the quiet detector
 *                                   (qd-v2) replayed beside the trigger the way the live path composes them
 *     [--no-defaults]               skip the default bench/calm/organic dirs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  advanceTutorStubMannerSwitch,
  compileTutorStubTriggerArtifact,
  createTutorStubMannerSwitchState,
  TUTOR_STUB_PLANT_STATE_TO_PRESSURE,
} from '../services/tutorStubMannerSwitch.js';
import {
  createTutorStubQuietDetectorState,
  detectTutorStubQuietState,
  TUTOR_STUB_QUIET_DETECTOR_VERSION,
} from '../services/tutorStubQuietDetector.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SHOULD_FIRE = new Set(['jumping_ahead', 'irritated', 'frustrated', 'opposed', 'forgetting']);
const SHOULD_NOT_FIRE = new Set(['bored', 'lost']);
const NO_FIRE_READS = new Set(['neutral', 'concession']);

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

function isTraceFile(name) {
  return name.endsWith('.jsonl') && !name.includes('summary');
}

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
      else if (isTraceFile(entry.name)) return path.join(dir, entry.name);
    }
  }
  return null;
}

function findAllTraces(dirRel) {
  const base = path.resolve(ROOT, dirRel);
  const out = [];
  const stack = [base];
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) stack.push(path.join(dir, entry.name));
      else if (isTraceFile(entry.name)) out.push(path.join(dir, entry.name));
    }
  }
  return out.sort();
}

function traceLabel(tracePath) {
  return `${path.basename(path.dirname(tracePath))}/${path.basename(tracePath, '.jsonl')}`;
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
  const plants = ev
    .filter((e) => e.type === 'learner_stress_plant')
    .map((e) => ({ turn: e.turn, state: e.state, rightRepair: e.rightRepair || null }));
  // What the live run recorded, when it ran a trigger — lets a replay be
  // checked against the recording turn by turn.
  const live = {};
  for (const e of ev) {
    if (e.type === 'tutor_manner_switch')
      live[e.turn] = { ...(live[e.turn] || {}), pressure: e.pressure, version: e.triggerVersion };
    if (e.type === 'tutor_quiet_detect') live[e.turn] = { ...(live[e.turn] || {}), quiet: e.quietType ?? null };
  }
  return { turns, plants, live };
}

function replayTrigger(dialogue, trigger) {
  const state = createTutorStubMannerSwitchState(trigger);
  const quiet = createTutorStubQuietDetectorState();
  const rows = [];
  for (const turn of dialogue.turns) {
    advanceTutorStubMannerSwitch(state, { learnerText: turn.learner, turn: turn.turn });
    // Live composition: the quiet detector runs on the same learner line and
    // stands aside whenever the pressure trigger has classified the turn.
    const quietRead = detectTutorStubQuietState(quiet, turn.learner, { pressure: state.lastAdvance.pressure });
    rows.push({ turn: turn.turn, ...state.lastAdvance, quiet: quietRead.type });
  }
  return rows;
}

function plantVerdict(plant, read) {
  const fired = Boolean(read) && !NO_FIRE_READS.has(read);
  if (SHOULD_FIRE.has(plant.state)) {
    const expected = TUTOR_STUB_PLANT_STATE_TO_PRESSURE[plant.state] || null;
    if (!fired) return { expected, fired, verdict: 'silent' };
    return { expected, fired, verdict: read === expected ? 'right' : 'wrong-kind' };
  }
  if (SHOULD_NOT_FIRE.has(plant.state)) return { expected: null, fired, verdict: fired ? 'wrong-fire' : 'quiet-ok' };
  return { expected: null, fired, verdict: 'unscored' };
}

function scoreDialogue(dialogue, trigger) {
  const rows = replayTrigger(dialogue, trigger);
  const rowByTurn = Object.fromEntries(rows.map((row) => [row.turn, row]));
  const armedTurns = rows.filter((row) => row.manner === 'schoolmaster').map((row) => row.turn);
  const armedWindows = rows.filter((row) => row.changed && row.manner === 'schoolmaster').length;

  const plantScores = dialogue.plants.map((plant) => {
    const row = rowByTurn[plant.turn] || {};
    const next = rowByTurn[plant.turn + 1] || {};
    const classified = row.pressure && !NO_FIRE_READS.has(row.pressure);
    const armed = row.manner === 'schoolmaster' || next.manner === 'schoolmaster';
    const live = dialogue.live[plant.turn] || null;
    return {
      ...plant,
      classified: Boolean(classified),
      armed,
      pressure: row.pressure,
      quiet: row.quiet ?? null,
      livePressure: live?.pressure ?? null,
      liveQuiet: live?.quiet ?? null,
      liveVersion: live?.version ?? null,
      ...plantVerdict(plant, row.pressure),
    };
  });

  return { rows, armedTurns, armedWindows, plantScores };
}

function emptyTally() {
  return { shouldFire: 0, classified: 0, rightKind: 0, armed: 0, quiet: 0, wrongFire: 0, wrongArm: 0, misses: [] };
}

function tally(bench, plantScores, dialogue, label) {
  for (const plant of plantScores) {
    if (SHOULD_FIRE.has(plant.state)) {
      bench.shouldFire += 1;
      if (plant.classified) bench.classified += 1;
      if (plant.verdict === 'right') bench.rightKind += 1;
      if (plant.armed) bench.armed += 1;
      if (!plant.classified) {
        const text = dialogue.turns.find((turn) => turn.turn === plant.turn)?.learner || '';
        bench.misses.push({
          arm: label,
          turn: plant.turn,
          state: plant.state,
          read: plant.pressure,
          text: text.slice(0, 110),
        });
      }
    } else if (SHOULD_NOT_FIRE.has(plant.state)) {
      bench.quiet += 1;
      // Two readings of "fired at a quiet plant": the per-turn classification
      // (what the v3+ move cards act on — matches the per-plant verdict) and
      // the legacy manner accumulator (armed at, or one turn after, the plant).
      if (plant.classified) bench.wrongFire += 1;
      if (plant.armed) bench.wrongArm += 1;
    }
  }
}

function summarize(bench) {
  return {
    shouldFirePlants: bench.shouldFire,
    classificationRecall: `${bench.classified}/${bench.shouldFire}`,
    kindRecall: `${bench.rightKind}/${bench.shouldFire}`,
    armingRecall: `${bench.armed}/${bench.shouldFire}`,
    quietPlants: bench.quiet,
    wrongFiresAtQuietPlants: bench.wrongFire,
    wrongArmsAtQuietPlants: bench.wrongArm,
  };
}

function stripTiers(artifact, tiers) {
  if (tiers === 'all') return artifact;
  const copy = { ...artifact };
  delete copy.classifier;
  if (tiers === 'patterns') delete copy.bags;
  copy.version = `${artifact.version || 'unversioned'}:${tiers}`;
  return copy;
}

function collectFlag(args, name) {
  const out = [];
  for (let i = 0; i < args.length; i++) if (args[i] === name && args[i + 1]) out.push(args[++i]);
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const KNOWN = new Set(['--trigger', '--json', '--trace', '--bench-dir', '--tiers', '--per-plant', '--no-defaults']);
  const VALUED = new Set(['--trigger', '--trace', '--bench-dir', '--tiers']);
  for (let i = 0; i < args.length; i++) {
    if (!KNOWN.has(args[i])) throw new Error(`unknown argument: ${JSON.stringify(args[i])}`);
    if (VALUED.has(args[i])) i += 1;
  }
  const triggerArg = args.includes('--trigger') ? args[args.indexOf('--trigger') + 1] : null;
  const tiers = args.includes('--tiers') ? args[args.indexOf('--tiers') + 1] : 'all';
  if (!['all', 'patterns+bags', 'patterns'].includes(tiers))
    throw new Error(`--tiers must be all|patterns+bags|patterns, got ${tiers}`);
  if (tiers !== 'all' && !triggerArg) throw new Error('--tiers needs --trigger (the builtin v1 has patterns only)');
  const trigger = triggerArg
    ? compileTutorStubTriggerArtifact(
        stripTiers(JSON.parse(fs.readFileSync(path.resolve(ROOT, triggerArg), 'utf8')), tiers),
      )
    : null;
  const label = trigger?.version || 'v1-builtin';
  const perPlant = args.includes('--per-plant');
  const useDefaults = !args.includes('--no-defaults');

  // Bench traces: default dirs (first trace each, as always) plus explicit
  // files and extra dirs (every trace). Extra sets are grouped by parent dir.
  const benchTraces = [];
  if (useDefaults) {
    for (const dirRel of BENCH_DIRS) {
      const tracePath = findTrace(dirRel);
      if (tracePath) benchTraces.push({ set: 'default', label: path.basename(dirRel), tracePath });
    }
  }
  const defaultBenchMissing = useDefaults && benchTraces.length === 0;
  for (const file of collectFlag(args, '--trace')) {
    const tracePath = path.resolve(ROOT, file);
    if (!fs.existsSync(tracePath)) throw new Error(`--trace not found: ${file}`);
    benchTraces.push({ set: path.basename(path.dirname(tracePath)), label: traceLabel(tracePath), tracePath });
  }
  for (const dirRel of collectFlag(args, '--bench-dir')) {
    for (const tracePath of findAllTraces(dirRel))
      benchTraces.push({ set: path.basename(path.dirname(tracePath)), label: traceLabel(tracePath), tracePath });
  }

  const bench = emptyTally();
  const sets = {};
  const plantRows = [];
  for (const { set, label: armLabel, tracePath } of benchTraces) {
    const dialogue = loadDialogue(tracePath);
    if (!dialogue.plants.length) continue;
    const { plantScores } = scoreDialogue(dialogue, trigger);
    tally(bench, plantScores, dialogue, armLabel);
    sets[set] = sets[set] || emptyTally();
    tally(sets[set], plantScores, dialogue, armLabel);
    for (const plant of plantScores) {
      const text = dialogue.turns.find((turn) => turn.turn === plant.turn)?.learner || '';
      plantRows.push({ set, arm: armLabel, ...plant, text: text.slice(0, 120) });
    }
  }

  let calmDialogues = 0;
  let calmWindows = 0;
  let organicDialogues = 0;
  let organicWindows = 0;
  if (useDefaults) {
    for (const dirRel of CALM_DIRS) {
      const tracePath = findTrace(dirRel);
      if (!tracePath) continue;
      const dialogue = loadDialogue(tracePath);
      calmDialogues += 1;
      calmWindows += scoreDialogue(dialogue, trigger).armedWindows;
    }
    for (const dirRel of ORGANIC_DIRS) {
      const tracePath = findTrace(dirRel);
      if (!tracePath) continue;
      const dialogue = loadDialogue(tracePath);
      if (dialogue.plants.length) continue; // safety: only unplanted dialogues supply the base rate
      organicDialogues += 1;
      organicWindows += scoreDialogue(dialogue, trigger).armedWindows;
    }
  }

  const report = {
    schema: 'machinespirits.tutor-stub.manner-trigger-scorecard.v2',
    triggerVersion: label,
    tiers,
    quietDetectorVersion: TUTOR_STUB_QUIET_DETECTOR_VERSION,
    defaultBenchMissing,
    bench: { ...summarize(bench), misses: bench.misses },
    sets: Object.fromEntries(Object.entries(sets).map(([name, t]) => [name, summarize(t)])),
    perPlant: perPlant ? plantRows : undefined,
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
  console.log(`trigger ${label}` + (tiers !== 'all' ? ` (tiers: ${tiers})` : ''));
  if (defaultBenchMissing)
    console.log('(default bench dirs not present on this machine — bench rows come from --trace/--bench-dir only)');
  console.log(
    `BENCH  classification recall ${report.bench.classificationRecall} · kind recall ${report.bench.kindRecall} · arming recall ${report.bench.armingRecall} · wrong-fires at quiet plants ${bench.wrongFire}/${bench.quiet} (legacy arming ${bench.wrongArm}/${bench.quiet})`,
  );
  for (const [name, s] of Object.entries(report.sets)) {
    if (Object.keys(report.sets).length < 2) break;
    console.log(
      `  ${name.padEnd(12)} fired ${s.classificationRecall} · right kind ${s.kindRecall} · wrong-fires at quiet ${s.wrongFiresAtQuietPlants}/${s.quietPlants}`,
    );
  }
  console.log(
    `CALM  ${calmDialogues} dialogues · false alarms/dialogue ${report.calm.falseAlarmsPerDialogue} (the gate metric)`,
  );
  console.log(
    `ORGANIC (pressing persona)  ${organicDialogues} dialogues · arming/dialogue ${report.organic.organicArmingPerDialogue} (informational — her pressure is real)`,
  );
  if (perPlant) {
    console.log(
      `\nper plant (quiet detector ${TUTOR_STUB_QUIET_DETECTOR_VERSION} replayed beside the trigger; live = what the recording's own run read):`,
    );
    for (const row of plantRows) {
      const live = row.liveVersion ? ` live=${row.livePressure}/${row.liveQuiet ?? '-'}` : '';
      console.log(
        `  ${row.arm.padEnd(18)} t${String(row.turn).padEnd(2)} ${row.state.padEnd(13)} want=${String(row.expected ?? '-').padEnd(13)} read=${String(row.pressure).padEnd(13)} quiet=${String(row.quiet ?? '-').padEnd(15)} ${row.verdict.padEnd(10)}${live}`,
      );
    }
  } else if (bench.misses.length) {
    console.log('\nmisses:');
    for (const miss of bench.misses)
      console.log(`  [${miss.arm} t${miss.turn} ${miss.state}, read=${miss.read}] ${miss.text}`);
  }
}

main();
