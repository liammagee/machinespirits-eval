#!/usr/bin/env node
/**
 * Train the form-feature learner-state detector (form-v1) and score it
 * leave-one-world-out. Offline: reads packed tutor-stub traces, no model calls.
 * Card: workplan/items/state-detection-without-word-lists.md, step 2 (b).
 *
 *   node scripts/train-form-state-detector.js \
 *     --train-dir <dir> [--train-dir <dir>]... \
 *     [--holdout-trace <file>]... [--holdout-dir <dir>]... \
 *     [--out config/manner-trigger/form-v1.json] \
 *     [--epochs 300] [--lr 0.05] [--l2 0.0005] [--threshold 0.5] [--neutral-weight 0.35] \
 *     [--seed 7] [--json] [--per-plant]
 *
 * Pool traces (--train-dir) supply training examples. Holdout traces are never
 * trained on. Every planted learner turn is one example labelled with its
 * planted state; every unplanted learner turn is a `neutral` example. World is
 * read from the first event carrying `worldId`.
 *
 * Folds: for each world W in pool ∪ holdout, train on pool minus W and test on
 * every trace of W. Then a final model on the whole pool is tested on the
 * holdout and written to --out with its provenance.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TUTOR_STUB_FORM_FEATURE_NAMES,
  TUTOR_STUB_FORM_FEATURE_VERSION,
  TUTOR_STUB_FORM_STATES,
  TUTOR_STUB_FORM_STATE_TO_PRESSURE,
  computeTutorStubFormFeatures,
  compileTutorStubFormDetector,
  predictTutorStubFormState,
} from '../services/tutorStubFormStateDetector.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRESSURE_STATES = new Set(Object.keys(TUTOR_STUB_FORM_STATE_TO_PRESSURE));
const QUIET_STATES = new Set(['bored', 'lost']);

function collectFlag(args, name) {
  const out = [];
  for (let i = 0; i < args.length; i++) if (args[i] === name && args[i + 1]) out.push(args[++i]);
  return out;
}

function numberFlag(args, name, fallback) {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  const v = Number(args[i + 1]);
  if (!Number.isFinite(v)) throw new Error(`${name} needs a number, got ${args[i + 1]}`);
  return v;
}

function findTraces(dir) {
  const out = [];
  const stack = [path.resolve(ROOT, dir)];
  while (stack.length) {
    const d = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.isDirectory()) stack.push(path.join(d, e.name));
      else if (e.name.endsWith('.jsonl') && !e.name.includes('summary')) out.push(path.join(d, e.name));
    }
  }
  return out.sort();
}

export function loadTraceExamples(tracePath) {
  const lines = fs.readFileSync(tracePath, 'utf8').split('\n').filter(Boolean);
  let world = null;
  const turns = [];
  const plants = {};
  for (const line of lines) {
    if (!world && line.includes('"worldId"')) {
      const m = line.match(/"worldId":\s*"([^"]+)"/);
      if (m) world = m[1];
    }
    if (!line.includes('"turn_complete"') && !line.includes('"learner_stress_plant"')) continue;
    const e = JSON.parse(line);
    if (e.type === 'turn_complete')
      turns.push({ turn: e.turn, learner: e.turnRecord?.learner || '', tutor: e.turnRecord?.tutor || '' });
    else if (e.type === 'learner_stress_plant') plants[e.turn] = e.state;
  }
  if (!world) {
    const m = tracePath.match(/world[_-]?(\d{3})/);
    world = m ? `world_${m[1]}` : 'unknown';
  }
  turns.sort((a, b) => a.turn - b.turn);
  const examples = [];
  const priorLearner = [];
  let lastTutor = '';
  for (const t of turns) {
    if (t.learner.trim()) {
      examples.push({
        trace: tracePath,
        world,
        turn: t.turn,
        state: plants[t.turn] || 'neutral',
        text: t.learner,
        features: computeTutorStubFormFeatures(t.learner, { tutorText: lastTutor, priorLearnerTexts: priorLearner }),
      });
      priorLearner.push(t.learner);
    }
    lastTutor = t.tutor;
  }
  return { world, plants: Object.keys(plants).length, examples };
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function trainWeights(examples, { epochs, lr, l2, neutralWeight, seed }) {
  const dim = TUTOR_STUB_FORM_FEATURE_NAMES.length;
  const rand = mulberry(seed);
  const order = examples.map((_, i) => i);
  const weights = {};
  for (const state of TUTOR_STUB_FORM_STATES) {
    const w = new Array(dim + 1).fill(0);
    for (let epoch = 0; epoch < epochs; epoch++) {
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      for (const idx of order) {
        const ex = examples[idx];
        const y = ex.state === state ? 1 : 0;
        const sampleWeight = ex.state === 'neutral' ? neutralWeight : 1;
        let z = w[dim];
        for (let k = 0; k < dim; k++) z += w[k] * ex.features[k];
        const p = 1 / (1 + Math.exp(-z));
        const g = (p - y) * sampleWeight;
        for (let k = 0; k < dim; k++) w[k] -= lr * (g * ex.features[k] + l2 * w[k]);
        w[dim] -= lr * g;
      }
    }
    weights[state] = w.map((v) => Number(v.toFixed(5)));
  }
  return weights;
}

function evaluate(detector, examples) {
  const tally = {
    shouldFire: 0,
    firedAsPressure: 0,
    rightKind: 0,
    quietPlants: 0,
    quietRight: 0,
    wrongFireAtQuiet: 0,
    neutralTurns: 0,
    neutralFalseAlarms: 0,
    confusion: {},
  };
  const rows = [];
  for (const ex of examples) {
    const read = predictTutorStubFormState(detector, ex.features);
    const pred = read.state;
    tally.confusion[ex.state] = tally.confusion[ex.state] || {};
    tally.confusion[ex.state][pred] = (tally.confusion[ex.state][pred] || 0) + 1;
    const predPressure = PRESSURE_STATES.has(pred);
    let verdict;
    if (PRESSURE_STATES.has(ex.state)) {
      tally.shouldFire += 1;
      if (predPressure) tally.firedAsPressure += 1;
      if (pred === ex.state) tally.rightKind += 1;
      verdict = pred === ex.state ? 'right' : predPressure ? 'wrong-kind' : 'silent';
    } else if (QUIET_STATES.has(ex.state)) {
      tally.quietPlants += 1;
      if (pred === ex.state) tally.quietRight += 1;
      if (predPressure) tally.wrongFireAtQuiet += 1;
      verdict = pred === ex.state ? 'quiet-right' : predPressure ? 'wrong-fire' : 'quiet-ok';
    } else {
      tally.neutralTurns += 1;
      if (pred !== 'neutral') tally.neutralFalseAlarms += 1;
      verdict = pred === 'neutral' ? 'neutral-ok' : 'false-alarm';
    }
    if (ex.state !== 'neutral')
      rows.push({
        trace: path.relative(ROOT, ex.trace),
        world: ex.world,
        turn: ex.turn,
        state: ex.state,
        read: pred,
        p: read.p ? Number(read.p.toFixed(2)) : null,
        verdict,
        text: ex.text.slice(0, 110),
      });
  }
  return { ...tally, rows };
}

function summary(t) {
  return {
    shouldFirePlants: t.shouldFire,
    firedAsPressure: `${t.firedAsPressure}/${t.shouldFire}`,
    rightKind: `${t.rightKind}/${t.shouldFire}`,
    quietPlants: t.quietPlants,
    quietRight: `${t.quietRight}/${t.quietPlants}`,
    wrongFiresAtQuiet: `${t.wrongFireAtQuiet}/${t.quietPlants}`,
    neutralTurns: t.neutralTurns,
    neutralFalseAlarms: `${t.neutralFalseAlarms}/${t.neutralTurns}`,
    confusion: t.confusion,
  };
}

function main() {
  const args = process.argv.slice(2);
  const KNOWN = new Set([
    '--train-dir',
    '--holdout-trace',
    '--holdout-dir',
    '--out',
    '--epochs',
    '--lr',
    '--l2',
    '--threshold',
    '--neutral-weight',
    '--seed',
    '--json',
    '--per-plant',
  ]);
  for (let i = 0; i < args.length; i++) {
    if (!KNOWN.has(args[i])) throw new Error(`unknown argument: ${JSON.stringify(args[i])}`);
    if (!['--json', '--per-plant'].includes(args[i])) i += 1;
  }
  const hyper = {
    epochs: numberFlag(args, '--epochs', 300),
    lr: numberFlag(args, '--lr', 0.05),
    l2: numberFlag(args, '--l2', 0.0005),
    neutralWeight: numberFlag(args, '--neutral-weight', 0.35),
    seed: numberFlag(args, '--seed', 7),
  };
  const threshold = numberFlag(args, '--threshold', 0.5);
  const outArg = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;

  const poolFiles = collectFlag(args, '--train-dir').flatMap(findTraces);
  if (!poolFiles.length) throw new Error('no training traces found under --train-dir');
  const holdoutFiles = [
    ...collectFlag(args, '--holdout-trace').map((f) => path.resolve(ROOT, f)),
    ...collectFlag(args, '--holdout-dir').flatMap(findTraces),
  ];
  for (const f of holdoutFiles) if (!fs.existsSync(f)) throw new Error(`holdout trace not found: ${f}`);

  const pool = poolFiles.map(loadTraceExamples).filter((t) => t.plants > 0);
  const holdout = holdoutFiles.map(loadTraceExamples).filter((t) => t.plants > 0);
  const poolExamples = pool.flatMap((t) => t.examples);
  const holdoutExamples = holdout.flatMap((t) => t.examples);
  const worlds = [...new Set([...pool, ...holdout].map((t) => t.world))].sort();

  const compile = (weights, version) =>
    compileTutorStubFormDetector({ version, featureVersion: TUTOR_STUB_FORM_FEATURE_VERSION, threshold, weights });

  const folds = {};
  for (const world of worlds) {
    const train = poolExamples.filter((ex) => ex.world !== world);
    const test = [...poolExamples, ...holdoutExamples].filter((ex) => ex.world === world);
    if (!train.length || !test.some((ex) => ex.state !== 'neutral')) continue;
    const detector = compile(trainWeights(train, hyper), `loo-${world}`);
    const result = evaluate(detector, test);
    folds[world] = {
      trainedOnWorlds: [...new Set(train.map((ex) => ex.world))].sort(),
      trainExamples: train.length,
      testTraces: new Set(test.map((ex) => ex.trace)).size,
      ...summary(result),
      rows: result.rows,
    };
  }

  const finalWeights = trainWeights(poolExamples, hyper);
  const finalDetector = compile(finalWeights, 'form-v1');
  const finalHoldout = holdoutExamples.length ? evaluate(finalDetector, holdoutExamples) : null;

  const artifact = {
    schema: 'machinespirits.tutor-stub.form-state-detector.v1',
    version: TUTOR_STUB_FORM_FEATURE_VERSION,
    featureVersion: TUTOR_STUB_FORM_FEATURE_VERSION,
    featureNames: TUTOR_STUB_FORM_FEATURE_NAMES,
    threshold,
    weights: finalWeights,
    trainedOn: {
      date: new Date().toISOString().slice(0, 10),
      worlds: [...new Set(pool.map((t) => t.world))].sort(),
      traces: pool.length,
      plantedTurns: poolExamples.filter((ex) => ex.state !== 'neutral').length,
      neutralTurns: poolExamples.filter((ex) => ex.state === 'neutral').length,
      hyper,
      leaveOneWorldOut: Object.fromEntries(
        Object.entries(folds).map(([w, f]) => [
          w,
          { firedAsPressure: f.firedAsPressure, rightKind: f.rightKind, wrongFiresAtQuiet: f.wrongFiresAtQuiet },
        ]),
      ),
    },
  };
  if (outArg) {
    const outPath = path.resolve(ROOT, outArg);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`);
  }

  const perPlant = args.includes('--per-plant');
  const report = {
    schema: 'machinespirits.tutor-stub.form-state-detector-report.v1',
    pool: { traces: pool.length, worlds: artifact.trainedOn.worlds, examples: poolExamples.length },
    holdout: { traces: holdout.length, worlds: [...new Set(holdout.map((t) => t.world))].sort() },
    hyper,
    threshold,
    folds: Object.fromEntries(Object.entries(folds).map(([w, f]) => [w, perPlant ? f : { ...f, rows: undefined }])),
    finalOnHoldout: finalHoldout ? { ...summary(finalHoldout), rows: perPlant ? finalHoldout.rows : undefined } : null,
    out: outArg || null,
  };
  if (args.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(
    `pool: ${pool.length} traces, worlds ${artifact.trainedOn.worlds.join(', ')}, ${artifact.trainedOn.plantedTurns} planted + ${artifact.trainedOn.neutralTurns} neutral turns`,
  );
  console.log(`holdout: ${holdout.length} traces, worlds ${report.holdout.worlds.join(', ') || '-'}`);
  console.log(`\nleave-one-world-out (train on pool minus world, test on every trace of that world):`);
  for (const [world, f] of Object.entries(folds)) {
    console.log(
      `  ${world.padEnd(28)} fired ${f.firedAsPressure.padEnd(8)} right kind ${f.rightKind.padEnd(8)} quiet right ${f.quietRight.padEnd(6)} wrong-fire at quiet ${f.wrongFiresAtQuiet.padEnd(6)} false alarms ${f.neutralFalseAlarms}   (trained on ${f.trainedOnWorlds.join(', ')})`,
    );
  }
  if (finalHoldout) {
    const s = summary(finalHoldout);
    console.log(
      `\nfinal (whole pool) on holdout: fired ${s.firedAsPressure} · right kind ${s.rightKind} · quiet right ${s.quietRight} · wrong-fire at quiet ${s.wrongFiresAtQuiet} · false alarms ${s.neutralFalseAlarms}`,
    );
    console.log('  confusion (planted state → read):');
    for (const [state, reads] of Object.entries(s.confusion)) {
      if (state === 'neutral') continue;
      console.log(
        `    ${state.padEnd(13)} ${Object.entries(reads)
          .sort((a, b) => b[1] - a[1])
          .map(([r, n]) => `${r} ${n}`)
          .join(', ')}`,
      );
    }
  }
  if (perPlant) {
    console.log('\nper plant (final model on holdout):');
    for (const row of finalHoldout?.rows || [])
      console.log(
        `  ${row.trace.slice(-28).padEnd(28)} t${String(row.turn).padEnd(2)} ${row.state.padEnd(13)} read=${row.read.padEnd(13)} p=${String(row.p ?? '-').padEnd(4)} ${row.verdict.padEnd(11)} ${row.text}`,
      );
  }
  if (outArg) console.log(`\nwrote ${outArg}`);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
