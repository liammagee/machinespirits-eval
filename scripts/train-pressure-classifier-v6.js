/**
 * Stage-3 pressure classifier (card: paraphrase-robust-detection).
 *
 * The ladder's registered rung: logistic regression over CHEAP, world-neutral
 * features — v4 pattern hits, closed-class function-word cues (ultimatums,
 * deadlines, imperatives), style counts (questions, dashes, quoting, person
 * density) — trained on ONE world's recorded planted turns and evaluated on
 * the held-out world plus the re-phrasings no pattern edition has caught.
 * Leave-one-world-out is the evaluation standard (the v5 lesson: in-sample
 * catches are memorization until proven otherwise).
 *
 * Gate (ladder stage 3): beats the tuned patterns (v4) on held-out recall
 * without exceeding their calm false-alarm rate (1.80/dialogue).
 *
 * Usage: node scripts/train-pressure-classifier-v6.js [--json]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  classifyTutorStubLearnerPressure,
  compileTutorStubTriggerArtifact,
} from '../services/tutorStubMannerSwitch.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const STATE_TO_PRESSURE = {
  jumping_ahead: 'demand',
  irritated: 'mockery',
  frustrated: 'grievance',
  forgetting: 'settled_claim',
  opposed: 'stake',
};
const CLASSES = ['demand', 'mockery', 'grievance', 'settled_claim', 'stake', 'neutral'];

const TRAIN_DIRS = [
  'exports/tutor-stub-outcome/stage5-butler/traces/world_033_alder_row_redoubt',
  'exports/tutor-stub-outcome/stage5-switch/traces/world_033_alder_row_redoubt',
  'exports/tutor-stub-outcome/stage5v3-switch/traces/world_033_alder_row_redoubt',
  'exports/tutor-stub-outcome/r2-butler/traces/world_033_alder_row_redoubt',
  'exports/tutor-stub-outcome/r2-switch/traces/world_033_alder_row_redoubt',
  'exports/tutor-stub-outcome/r4-butler/traces/world_033_alder_row_redoubt',
  'exports/tutor-stub-outcome/r4-switch/traces/world_033_alder_row_redoubt',
  'exports/tutor-stub-outcome/q2-w033/traces/world_033_alder_row_redoubt',
];
const HELDOUT_DIRS = [
  'exports/tutor-stub-outcome/r1-bare/traces/world_030_rowan_flat',
  'exports/tutor-stub-outcome/r2-butler/traces/world_030_rowan_flat',
  'exports/tutor-stub-outcome/r2-switch/traces/world_030_rowan_flat',
  'exports/tutor-stub-outcome/q1-k3/traces/world_030_rowan_flat',
  'exports/tutor-stub-outcome/q2-k3/traces/world_030_rowan_flat',
  'exports/tutor-stub-outcome/v4live/traces/world_030_rowan_flat',
  'exports/tutor-stub-outcome/h1/traces/world_030_rowan_flat',
  'exports/tutor-stub-outcome/l2-k3/traces/world_030_rowan_flat',
  'exports/tutor-stub-outcome/srevisit-k3/traces/world_030_rowan_flat',
];
const CALM_DIRS = [0, 1, 2, 3, 4].map(
  (k) => `exports/tutor-stub-outcome/misconception-gate-1/traces/world_032_alder_row/d${k}`,
);

const v4 = compileTutorStubTriggerArtifact(
  JSON.parse(fs.readFileSync(path.join(ROOT, 'config/manner-trigger/v4.json'), 'utf8')),
);

const lc = (t) => String(t || '').toLowerCase();
function features(text, priorLens) {
  const t = lc(text);
  const words = t.split(/\s+/).filter(Boolean);
  const mean = priorLens.length ? priorLens.reduce((a, b) => a + b, 0) / priorLens.length : words.length;
  const hit = (kind) => (v4.patterns[kind] && v4.patterns[kind].test(text) ? 1 : 0);
  return [
    hit('mockery'),
    hit('demand'),
    hit('concession'),
    hit('defiance'),
    /unless|or i['’ ]|either way|last chance|only chance/.test(t) ? 1 : 0,
    /\b(eight|seven|thursday|tonight|minute|o.clock|deadline|meeting)\b|\d{1,2}[:.]\d{2}/.test(t) ? 1 : 0,
    /^(write|tell|give|show|say|answer|stop|look)\b/.test(t) ? 1 : 0,
    /[“”"'’]{1}[^“”"]{3,40}[“”"'’]{1}/.test(text) ? 1 : 0,
    (t.match(/\byou\b|\byour\b/g) || []).length / Math.max(6, words.length),
    (t.match(/\bi\b|\bmy\b|\bi['’]ve\b|\bi['’]m\b/g) || []).length / Math.max(6, words.length),
    (text.match(/\?/g) || []).length,
    (text.match(/—|–/g) || []).length,
    /\bagain\b|\bstill\b|\bcircles\b|\bthird time\b/.test(t) ? 1 : 0,
    /\bsound(s)? like\b|\bvoice\b|\bwords\b|\btalk\b/.test(t) ? 1 : 0,
    /\bcounted\b|\bpoint\b|\bworth\b|\bpaying\b|\bwasted\b/.test(t) ? 1 : 0,
    /\bwrote\b|\bnotebook\b|\bledger\b|\brecord\b|\bminutes\b/.test(t) ? 1 : 0,
    Math.min(2, words.length / Math.max(6, mean)),
    words.length > 30 ? 1 : 0,
  ];
}

function collect(dirs, world) {
  const rows = [];
  for (const rel of dirs) {
    const base = path.join(ROOT, rel);
    if (!fs.existsSync(base)) continue;
    const subs =
      fs.statSync(base).isDirectory() && !fs.readdirSync(base).some((x) => x.endsWith('.jsonl'))
        ? fs.readdirSync(base).map((d) => path.join(base, d))
        : [base];
    for (const dir of subs) {
      const fl = fs.readdirSync(dir).find((x) => x.endsWith('.jsonl'));
      if (!fl) continue;
      const ev = fs
        .readFileSync(path.join(dir, fl), 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l));
      const plants = new Map(ev.filter((e) => e.type === 'learner_stress_plant').map((e) => [e.turn, e.state]));
      const lens = [];
      for (const e of ev.filter((x) => x.type === 'turn_complete')) {
        const text = e.turnRecord?.learner || '';
        const state = plants.get(e.turn);
        const label = state ? STATE_TO_PRESSURE[state] || null : 'neutral';
        if (label) rows.push({ world, text, label, x: features(text, [...lens]) });
        lens.push(lc(text).split(/\s+/).filter(Boolean).length);
      }
    }
  }
  return rows;
}

// one-vs-rest logistic, deterministic
function train(rows) {
  const dim = rows[0].x.length;
  const models = {};
  for (const cls of CLASSES) {
    const w = new Array(dim + 1).fill(0);
    for (let epoch = 0; epoch < 200; epoch++) {
      for (const r of rows) {
        const y = r.label === cls ? 1 : 0;
        let z = w[dim];
        for (let i = 0; i < dim; i++) z += w[i] * r.x[i];
        const p = 1 / (1 + Math.exp(-z));
        const g = y - p;
        for (let i = 0; i < dim; i++) w[i] += 0.05 * g * r.x[i];
        w[dim] += 0.05 * g;
      }
    }
    models[cls] = w;
  }
  return models;
}
function predict(models, x, threshold = 0.5) {
  let best = null;
  for (const [cls, w] of Object.entries(models)) {
    if (cls === 'neutral') continue;
    let z = w[w.length - 1];
    for (let i = 0; i < x.length; i++) z += w[i] * x[i];
    const p = 1 / (1 + Math.exp(-z));
    if (p >= threshold && (!best || p > best.p)) best = { cls, p };
  }
  return best ? best.cls : 'neutral';
}

const trainRows = collect(TRAIN_DIRS, 'w033');
const heldRows = collect(HELDOUT_DIRS, 'w030');
const calmRows = collect(CALM_DIRS, 'w032');
console.log(
  `train ${trainRows.length} rows (${trainRows.filter((r) => r.label !== 'neutral').length} pressure); held-out ${heldRows.length}; calm ${calmRows.length}`,
);
const models = train(trainRows);

for (const threshold of [0.5, 0.6, 0.7]) {
  const heldPressure = heldRows.filter((r) => r.label !== 'neutral');
  const v6right = heldPressure.filter((r) => predict(models, r.x, threshold) === r.label).length;
  const v4right = heldPressure.filter((r) => classifyTutorStubLearnerPressure(r.text, v4.patterns) === r.label).length;
  const calmDialogues = 5;
  const calmAlarms = calmRows.filter(
    (r) => r.label === 'neutral' && predict(models, r.x, threshold) !== 'neutral',
  ).length;
  const heldNeutral = heldRows.filter((r) => r.label === 'neutral');
  const falseOnHeld = heldNeutral.filter((r) => predict(models, r.x, threshold) !== 'neutral').length;
  console.log(
    `threshold ${threshold}: held-out pressure recall v6 ${v6right}/${heldPressure.length} vs v4 ${v4right}/${heldPressure.length}; calm alarms ${(calmAlarms / calmDialogues).toFixed(2)}/dialogue (bar 1.80); held-out neutral false-fires ${falseOnHeld}/${heldNeutral.length}`,
  );
}
