#!/usr/bin/env node
/**
 * Side-by-side of learner-state readers over the same recorded traces
 * (card: workplan/items/state-detection-followups-hold-and-cues.md).
 *
 * Readers: any number of label files written by label-learner-state-model.js
 * (one model call per turn) plus, optionally, a form-state detector artifact
 * replayed with no call. Every reader is scored against the planted state the
 * same way the labeller's --score mode does, then readers are compared pairwise
 * (agreement, Cohen's kappa over the eight states, shared off-plant fires).
 *
 *   node scripts/compare-learner-state-labels.js --bench-dir <dir> \
 *        --labels sonnet=exports/.../labels-a.jsonl --labels opus=exports/.../labels-b.jsonl \
 *        [--state-detector config/manner-trigger/form-v3.json] [--json]
 *
 * Label rows are joined to trace turns by world, dialogue variant and turn
 * number (the label files may name the traces by another path), and the
 * learner text must match, so a stale label file fails loudly.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { TUTOR_STUB_PLANT_STATE_TO_PRESSURE } from '../services/tutorStubMannerSwitch.js';
import { compileTutorStubFormDetector, readTutorStubFormState } from '../services/tutorStubFormStateDetector.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRESSURE = new Set(Object.keys(TUTOR_STUB_PLANT_STATE_TO_PRESSURE));
const QUIET = new Set(['bored', 'lost']);

function collectFlag(args, name) {
  const out = [];
  for (let i = 0; i < args.length; i++) if (args[i] === name && args[i + 1]) out.push(args[++i]);
  return out;
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

/** world + dialogue variant from any trace path: "world-036/v3-d1" and ".../world-036-v3-d1.jsonl" both give "036:v3-d1". */
export function traceKey(tracePath) {
  const p = String(tracePath).replace(/\\/g, '/');
  const world = p.match(/(?:world-|hero-)(\d{3})/)?.[1];
  const base = path.basename(p, '.jsonl').replace(/^world-\d{3}-/, '');
  if (!world) throw new Error(`no world number in trace path ${tracePath}`);
  return `${world}:${base}`;
}

function loadTurns(tracePath) {
  const ev = fs
    .readFileSync(tracePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .filter((l) => l.includes('"turn_complete"') || l.includes('"learner_stress_plant"'))
    .map((l) => JSON.parse(l));
  const plants = Object.fromEntries(ev.filter((e) => e.type === 'learner_stress_plant').map((e) => [e.turn, e.state]));
  return ev
    .filter((e) => e.type === 'turn_complete')
    .sort((a, b) => a.turn - b.turn)
    .map((e) => ({
      turn: e.turn,
      learner: e.turnRecord?.learner || '',
      tutor: e.turnRecord?.tutor || '',
      planted: plants[e.turn] || null,
    }));
}

function readLabels(file) {
  const map = new Map();
  for (const line of fs.readFileSync(path.resolve(ROOT, file), 'utf8').split('\n').filter(Boolean)) {
    const r = JSON.parse(line);
    map.set(`${traceKey(r.trace)}#${r.turn}`, r);
  }
  return map;
}

export function verdict(planted, read) {
  const pressure = PRESSURE.has(read);
  if (PRESSURE.has(planted)) return read === planted ? 'right' : pressure ? 'wrong-kind' : 'silent';
  if (QUIET.has(planted)) return read === planted ? 'quiet-right' : pressure ? 'wrong-fire' : 'quiet-ok';
  return read === 'neutral' ? 'neutral-ok' : 'false-alarm';
}

export function scoreReader(rows, reader) {
  const t = {
    shouldFire: 0,
    rightKind: 0,
    quiet: 0,
    quietRight: 0,
    wrongFire: 0,
    unplanted: 0,
    fires: 0,
    unparsed: 0,
    fireStates: {},
  };
  for (const r of rows) {
    const read = r.reads[reader];
    if (read === 'unparsed') t.unparsed += 1;
    const v = verdict(r.planted || 'neutral', read);
    if (PRESSURE.has(r.planted)) {
      t.shouldFire += 1;
      if (v === 'right') t.rightKind += 1;
    } else if (QUIET.has(r.planted)) {
      t.quiet += 1;
      if (v === 'quiet-right') t.quietRight += 1;
      if (v === 'wrong-fire') t.wrongFire += 1;
    } else if (!r.planted) {
      t.unplanted += 1;
      if (v === 'false-alarm') {
        t.fires += 1;
        t.fireStates[read] = (t.fireStates[read] || 0) + 1;
      }
    }
  }
  return {
    rightKind: `${t.rightKind}/${t.shouldFire}`,
    quietRight: `${t.quietRight}/${t.quiet}`,
    wrongFireAtQuiet: `${t.wrongFire}/${t.quiet}`,
    firesOnUnplanted: `${t.fires}/${t.unplanted}`,
    fireStates: t.fireStates,
    unparsed: t.unparsed,
  };
}

export function kappa(pairs) {
  const n = pairs.length;
  if (!n) return null;
  let agree = 0;
  const ma = {};
  const mb = {};
  for (const [a, b] of pairs) {
    if (a === b) agree += 1;
    ma[a] = (ma[a] || 0) + 1;
    mb[b] = (mb[b] || 0) + 1;
  }
  const po = agree / n;
  let pe = 0;
  for (const s of new Set([...Object.keys(ma), ...Object.keys(mb)])) pe += ((ma[s] || 0) / n) * ((mb[s] || 0) / n);
  return { n, agree, po: Number(po.toFixed(3)), kappa: pe === 1 ? null : Number(((po - pe) / (1 - pe)).toFixed(3)) };
}

export function compareReaders(rows, readers) {
  const out = {};
  for (let i = 0; i < readers.length; i++)
    for (let j = i + 1; j < readers.length; j++) {
      const a = readers[i];
      const b = readers[j];
      const all = kappa(rows.map((r) => [r.reads[a], r.reads[b]]));
      const planted = kappa(rows.filter((r) => r.planted).map((r) => [r.reads[a], r.reads[b]]));
      const unplanted = rows.filter((r) => !r.planted);
      const sharedFires = unplanted.filter((r) => r.reads[a] !== 'neutral' && r.reads[b] !== 'neutral').length;
      const sameFire = unplanted.filter((r) => r.reads[a] !== 'neutral' && r.reads[a] === r.reads[b]).length;
      out[`${a} vs ${b}`] = { all, planted, unplantedBothFire: sharedFires, unplantedSameState: sameFire };
    }
  return out;
}

function perWorld(rows, readers) {
  const w = {};
  for (const r of rows) {
    if (!PRESSURE.has(r.planted)) continue;
    const key = r.key.split(':')[0];
    w[key] ||= Object.fromEntries(readers.map((x) => [x, 0]).concat([['plants', 0]]));
    w[key].plants += 1;
    for (const x of readers) if (r.reads[x] === r.planted) w[key][x] += 1;
  }
  return w;
}

function main() {
  const args = process.argv.slice(2);
  const files = collectFlag(args, '--bench-dir')
    .flatMap(findTraces)
    .concat(collectFlag(args, '--trace').map((f) => path.resolve(ROOT, f)));
  if (!files.length) throw new Error('give --bench-dir or --trace');
  const labelSpecs = collectFlag(args, '--labels').map((s) => {
    const i = s.indexOf('=');
    if (i < 0) throw new Error(`--labels wants name=file, got ${s}`);
    return { name: s.slice(0, i), map: readLabels(s.slice(i + 1)) };
  });
  const detectorArg = args.includes('--state-detector') ? args[args.indexOf('--state-detector') + 1] : null;
  const detector = detectorArg
    ? compileTutorStubFormDetector(JSON.parse(fs.readFileSync(path.resolve(ROOT, detectorArg), 'utf8')))
    : null;
  const readers = labelSpecs.map((l) => l.name).concat(detector ? [detector.version || 'form'] : []);

  const rows = [];
  const problems = [];
  for (const file of files) {
    const key = traceKey(file);
    const prior = [];
    let lastTutor = '';
    for (const t of loadTurns(file)) {
      if (t.learner.trim()) {
        const reads = {};
        for (const l of labelSpecs) {
          const r = l.map.get(`${key}#${t.turn}`);
          if (!r) problems.push(`${l.name}: no label for ${key} t${t.turn}`);
          else if (r.learner !== t.learner) problems.push(`${l.name}: learner text differs at ${key} t${t.turn}`);
          reads[l.name] = r ? r.read : 'missing';
        }
        if (detector) {
          const d = readTutorStubFormState(detector, t.learner, { tutorText: lastTutor, priorLearnerTexts: prior });
          reads[detector.version || 'form'] = d.state && d.state !== 'none' ? d.state : 'neutral';
        }
        rows.push({ key, turn: t.turn, planted: t.planted, learner: t.learner, reads });
        prior.push(t.learner);
      }
      lastTutor = t.tutor;
    }
  }

  const result = {
    traces: files.length,
    turns: rows.length,
    planted: rows.filter((r) => r.planted).length,
    problems,
    readers: Object.fromEntries(readers.map((x) => [x, scoreReader(rows, x)])),
    perWorldRightKind: perWorld(rows, readers),
    pairwise: compareReaders(rows, readers),
    disagreements: rows
      .filter((r) => r.planted && new Set(readers.map((x) => r.reads[x])).size > 1)
      .map((r) => ({ key: r.key, turn: r.turn, planted: r.planted, reads: r.reads, learner: r.learner.slice(0, 160) })),
  };
  if (args.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`${result.traces} traces, ${result.turns} learner turns, ${result.planted} planted`);
  if (problems.length) console.log(`PROBLEMS (${problems.length}):\n  ${problems.slice(0, 20).join('\n  ')}`);
  console.log(
    '\n| reader | right kind at pressure plants | quiet plants right | wrong-fire at quiet | fires on unplanted turns | unparsed |',
  );
  console.log('|---|---|---|---|---|---|');
  for (const [x, s] of Object.entries(result.readers))
    console.log(
      `| ${x} | ${s.rightKind} | ${s.quietRight} | ${s.wrongFireAtQuiet} | ${s.firesOnUnplanted} | ${s.unparsed} |`,
    );
  console.log('\noff-plant fire states:');
  for (const [x, s] of Object.entries(result.readers)) console.log(`  ${x}: ${JSON.stringify(s.fireStates)}`);
  console.log('\nper world, right kind:');
  console.log(`| world | plants | ${readers.join(' | ')} |`);
  console.log(`|---|---|${readers.map(() => '---').join('|')}|`);
  for (const [w, s] of Object.entries(result.perWorldRightKind).sort())
    console.log(`| ${w} | ${s.plants} | ${readers.map((x) => s[x]).join(' | ')} |`);
  console.log('\npairwise:');
  for (const [p, s] of Object.entries(result.pairwise)) console.log(`  ${p}: ${JSON.stringify(s)}`);
  console.log(`\nplanted turns where readers differ: ${result.disagreements.length}`);
  for (const d of result.disagreements)
    console.log(`  ${d.key} t${d.turn} planted=${d.planted} ${JSON.stringify(d.reads)} :: ${d.learner}`);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
