/**
 * Quiet-detector scorecard — offline replay over recorded bench dialogues
 * (Phase Q2, card: workplan/items/adaptation-plan-3-phase-q.md). No model
 * calls: the detector is text-in, so any version replays over any trace.
 *
 * Sets:
 * - BENCH (traces with `learner_stress_plant` events): quiet plants are the
 *   should-detect gold; pressure plants are should-not (the pressure
 *   trigger owns them — a quiet detection there is a wrong-fire).
 * - CALM (diligent-profile dialogues, no plants, no organic pressure):
 *   false-alarm base rate, same set the pressure trigger graduated on.
 *
 * Should-detect mapping is scorer policy v0, mechanical: per world, each
 * quiet plant carries the detector type its realize text embodies —
 * w033 t11 bored→flat, t13 lost→confused; w030 t6 lost→confused,
 * t10 opposed→quiet_defiance (its realize is the modal re-assertion the
 * pressure trigger measurably never hears: cards 0/5 across R2).
 *
 * Usage: node scripts/score-quiet-detector.js [--flat-ratio 0.45] [--json]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  classifyTutorStubLearnerPressure,
  compileTutorStubTriggerArtifact,
} from '../services/tutorStubMannerSwitch.js';
import { createTutorStubQuietDetectorState, detectTutorStubQuietState } from '../services/tutorStubQuietDetector.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SHOULD_DETECT = {
  world_033_alder_row_redoubt: { 11: 'flat', 13: 'confused' },
  world_030_rowan_flat: { 6: 'confused', 10: 'quiet_defiance' },
};

const BENCH_DIRS = [
  'exports/tutor-stub-outcome/r1-bare/traces/world_030_rowan_flat',
  'exports/tutor-stub-outcome/r2-butler/traces/world_030_rowan_flat',
  'exports/tutor-stub-outcome/r2-switch/traces/world_030_rowan_flat',
  'exports/tutor-stub-outcome/q1-k3/traces/world_030_rowan_flat',
  'exports/tutor-stub-outcome/r2-butler/traces/world_033_alder_row_redoubt',
  'exports/tutor-stub-outcome/r2-switch/traces/world_033_alder_row_redoubt',
  'exports/tutor-stub-outcome/r4-butler/traces/world_033_alder_row_redoubt',
  'exports/tutor-stub-outcome/r4-switch/traces/world_033_alder_row_redoubt',
];

const CALM_DIRS = [
  'exports/tutor-stub-outcome/misconception-gate-1/traces/world_032_alder_row/d0',
  'exports/tutor-stub-outcome/misconception-gate-1/traces/world_032_alder_row/d1',
  'exports/tutor-stub-outcome/misconception-gate-1/traces/world_032_alder_row/d2',
  'exports/tutor-stub-outcome/misconception-gate-1/traces/world_032_alder_row/d3',
  'exports/tutor-stub-outcome/misconception-gate-1/traces/world_032_alder_row/d4',
];

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const FLAT_RATIO = Number(flag('--flat-ratio', '0.45'));
const AS_JSON = args.includes('--json');

const trigger = compileTutorStubTriggerArtifact(
  JSON.parse(fs.readFileSync(path.join(ROOT, 'config/manner-trigger/v3.json'), 'utf8')),
);

function loadDialogues(dirRel) {
  const dir = path.join(ROOT, dirRel);
  if (!fs.existsSync(dir)) return [];
  const subdirs = fs.readdirSync(dir).filter((d) => fs.statSync(path.join(dir, d)).isDirectory());
  const targets = subdirs.length ? subdirs.map((d) => path.join(dir, d)) : [dir];
  return targets.flatMap((t) => {
    const fl = fs.readdirSync(t).find((x) => x.endsWith('.jsonl'));
    if (!fl) return [];
    const events = fs
      .readFileSync(path.join(t, fl), 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    return [{ dir: path.relative(ROOT, t), events }];
  });
}

function replayDialogue(events, world) {
  const state = createTutorStubQuietDetectorState({ flatRatio: FLAT_RATIO });
  const plants = new Map(events.filter((e) => e.type === 'learner_stress_plant').map((e) => [e.turn, e.state]));
  const rows = [];
  for (const e of events.filter((x) => x.type === 'turn_complete')) {
    const text = e.turnRecord?.learner || '';
    const pressure = classifyTutorStubLearnerPressure(text, trigger.patterns);
    const { type } = detectTutorStubQuietState(state, text, { pressure });
    const quietGold = SHOULD_DETECT[world]?.[e.turn] || null;
    rows.push({ turn: e.turn, detected: type, quietGold, plant: plants.get(e.turn) || null });
  }
  return rows;
}

const result = { flatRatio: FLAT_RATIO, bench: {}, calm: {} };
let sdAny = 0;
let sdRight = 0;
let sdN = 0;
let wrongAtPressure = 0;
let pressureN = 0;
const perType = {};

for (const dirRel of BENCH_DIRS) {
  const world = dirRel.includes('world_030') ? 'world_030_rowan_flat' : 'world_033_alder_row_redoubt';
  for (const { dir, events } of loadDialogues(dirRel)) {
    for (const r of replayDialogue(events, world)) {
      if (r.quietGold) {
        sdN += 1;
        perType[r.quietGold] = perType[r.quietGold] || { n: 0, any: 0, right: 0 };
        perType[r.quietGold].n += 1;
        if (r.detected) {
          sdAny += 1;
          perType[r.quietGold].any += 1;
        }
        if (r.detected === r.quietGold) {
          sdRight += 1;
          perType[r.quietGold].right += 1;
        }
      } else if (r.plant) {
        pressureN += 1;
        if (r.detected) wrongAtPressure += 1;
      }
    }
    void dir;
  }
}

let calmFirings = 0;
let calmDialogues = 0;
for (const dirRel of CALM_DIRS) {
  for (const { events } of loadDialogues(dirRel)) {
    calmDialogues += 1;
    for (const r of replayDialogue(events, 'world_032_alder_row')) {
      if (r.detected) calmFirings += 1;
    }
  }
}

result.bench = {
  shouldDetect: sdN,
  detectedAny: sdAny,
  detectedRightType: sdRight,
  perType,
  pressurePlants: pressureN,
  wrongFiresAtPressure: wrongAtPressure,
};
result.calm = {
  dialogues: calmDialogues,
  firings: calmFirings,
  perDialogue: calmDialogues ? calmFirings / calmDialogues : null,
};

if (AS_JSON) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`quiet-detector scorecard (flatRatio=${FLAT_RATIO}, trigger v3 guard)`);
  console.log(
    `should-detect: any ${sdAny}/${sdN}, right-type ${sdRight}/${sdN}` +
      Object.entries(perType)
        .map(([t, v]) => `\n  ${t}: any ${v.any}/${v.n}, right ${v.right}/${v.n}`)
        .join(''),
  );
  console.log(`wrong-fires at pressure plants: ${wrongAtPressure}/${pressureN}`);
  console.log(
    `calm false alarms: ${calmFirings} over ${calmDialogues} dialogues (${(calmFirings / Math.max(1, calmDialogues)).toFixed(2)}/dialogue)`,
  );
}
