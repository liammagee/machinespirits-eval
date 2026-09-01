#!/usr/bin/env node
/**
 * Render the hero-demo with/without recordings as parallel swimlanes through
 * the shared dramatic-dialogue renderer, and splice the fragments into the
 * tabbed demo note between <!--SWIM:<key>--> … <!--/SWIM:<key>--> markers.
 *
 * Inputs: notes/poetics/hero-demo-runs/<world>/{butler,v3}-d1.jsonl(.gz)
 * Outputs: notes/poetics/hero-demo-runs/<world>/interchange.json (the strict
 *          interchange the fragment was rendered from) and the spliced note.
 *
 * Usage: node scripts/render-hero-demo-swimlanes.js [--check]
 *   --check  render and compare; exit 1 if the note is stale, write nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import {
  renderDramaticDialogueFragment,
  renderDramaticDialogueStyles,
  DRAMATIC_DIALOGUE_INTERCHANGE_SCHEMA,
} from '../services/dramaticDialogueRenderer.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNS = path.join(ROOT, 'notes', 'poetics', 'hero-demo-runs');
const NOTE = path.join(ROOT, 'notes', 'poetics', '2026-09-01-adaptive-tutor-demo-app.html');

const WORLDS = [
  { key: 'rowan', dir: 'world-030', label: 'Rowan Flat — the plain tutor and the adaptive tutor, one full session each' },
  { key: 'ghost', dir: 'world-035', label: 'The Nine O\'Clock Ghost — the plain tutor and the adaptive tutor, one full night each' },
  { key: 'fraction', dir: 'world-037', label: 'Half Plus a Third — the plain tutor and the adaptive tutor, one full lesson each' },
];
const ARMS = [
  { id: 'plain', file: 'butler-d1', label: 'Plain tutor', baseline: true, summary: 'No adaptive stack: no state detector, no move cards.' },
  { id: 'adaptive', file: 'v3-d1', label: 'Adaptive tutor', baseline: false, summary: 'Full stack: state detector, move cards, delivery record.' },
];
const STATE_WORDS = {
  jumping_ahead: 'deadline demand', irritated: 'mockery', lost: 'lost thread', frustrated: 'grievance',
  forgetting: 'false memory', opposed: 'fused stake', flat: 'switched off', bored: 'switched off',
};

function readTrace(dir, base) {
  for (const ext of ['.jsonl.gz', '.jsonl']) {
    const file = path.join(dir, base + ext);
    if (!fs.existsSync(file)) continue;
    const raw = ext.endsWith('.gz') ? zlib.gunzipSync(fs.readFileSync(file)).toString('utf8') : fs.readFileSync(file, 'utf8');
    const turns = new Map();
    const detected = new Map();
    const planted = new Map();
    let runEnd = null;
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      let event;
      try { event = JSON.parse(line); } catch { continue; }
      if (event.type === 'turn_complete' && event.turnRecord) {
        const r = event.turnRecord;
        turns.set(r.turn, { turn: r.turn, learner: r.learner ?? '', tutor: r.tutor ?? '' });
      } else if (event.type === 'tutor_manner_switch') {
        detected.set(event.turn, event.pressure);
      } else if (event.type === 'learner_stress_plant') {
        planted.set(event.turn, event.state);
      } else if (event.type === 'run_end') {
        runEnd = event;
      }
    }
    return { file: path.relative(ROOT, file), turns, detected, planted, runEnd };
  }
  return null;
}

function buildInterchange(world) {
  const dir = path.join(RUNS, world.dir);
  const traces = ARMS.map((arm) => ({ arm, trace: readTrace(dir, arm.file) }));
  if (traces.some((t) => !t.trace)) return null;
  const maxTurn = Math.max(...traces.map((t) => Math.max(...t.trace.turns.keys())));
  const turns = [];
  for (let n = 1; n <= maxTurn; n += 1) {
    const messages = [];
    const emptyLanes = [];
    for (const { arm, trace } of traces) {
      const row = trace.turns.get(n);
      if (!row) { emptyLanes.push({ arm: arm.id, label: 'dialogue ended' }); continue; }
      const learnerLabels = [];
      const plant = trace.planted.get(n);
      if (plant) learnerLabels.push({ label: `planted: ${STATE_WORDS[plant] || plant}`, tone: 'warning', kind: 'planted', group: 'state' });
      messages.push({
        id: `${world.key}-${arm.id}-t${n}-learner`, speaker: 'learner', turn: n, arm: arm.id, text: row.learner,
        delivery: { label: `turn ${n}`, status: 'recorded', tone: 'muted' },
        labels: learnerLabels.length ? learnerLabels : undefined,
        provenance: { sourcePath: trace.file, locator: `turn ${n} learner`, quoteExact: true },
      });
      const tutorLabels = [];
      const reading = trace.detected.get(n);
      if (arm.id === 'adaptive' && reading && reading !== 'neutral') {
        tutorLabels.push({ label: `detected: ${reading}`, tone: 'info', kind: 'detected', group: 'state' });
      }
      messages.push({
        id: `${world.key}-${arm.id}-t${n}-tutor`, speaker: 'tutor', turn: n, arm: arm.id, text: row.tutor,
        delivery: { label: 'delivered', status: 'recorded', tone: 'muted' },
        labels: tutorLabels.length ? tutorLabels : undefined,
        provenance: { sourcePath: trace.file, locator: `turn ${n} tutor`, quoteExact: true },
      });
    }
    const turn = { id: `${world.key}-t${n}`, turn: n, messages };
    if (emptyLanes.length) turn.emptyLanes = emptyLanes;
    turns.push(turn);
  }
  return {
    schema: DRAMATIC_DIALOGUE_INTERCHANGE_SCHEMA,
    id: `hero-demo-${world.dir}`,
    label: world.label,
    layout: 'parallel',
    arms: ARMS.map(({ id, label, baseline, summary }) => ({ id, label, baseline, summary })),
    turns,
    provenance: {
      sourcePath: path.relative(ROOT, dir),
      note: 'One free-running dialogue per arm, Claude Sonnet on both seats, same planted stress schedule. Illustration, not measurement: no ruling is supplied and none is implied.',
    },
  };
}

function splice(html, key, fragment) {
  const open = `<!--SWIM:${key}-->`;
  const close = `<!--/SWIM:${key}-->`;
  const start = html.indexOf(open);
  const end = html.indexOf(close);
  if (start < 0 || end < 0) throw new Error(`note is missing ${open} … ${close} markers`);
  return html.slice(0, start + open.length) + '\n' + fragment + '\n' + html.slice(end);
}

const check = process.argv.includes('--check');
let html = fs.readFileSync(NOTE, 'utf8');
const before = html;
html = splice(html, 'styles', `<style id="dd-styles">${renderDramaticDialogueStyles()}</style>`);
const report = [];
for (const world of WORLDS) {
  const dialogue = buildInterchange(world);
  if (!dialogue) { report.push(`${world.key}: no recordings under ${world.dir} — left as is`); continue; }
  const fragment = renderDramaticDialogueFragment(dialogue, { showArmHeads: true, showProvenance: false });
  html = splice(html, world.key, fragment);
  if (!check) fs.writeFileSync(path.join(RUNS, world.dir, 'interchange.json'), JSON.stringify(dialogue, null, 2) + '\n');
  report.push(`${world.key}: ${dialogue.turns.length} turns rendered from ${world.dir}`);
}
if (check) {
  console.log(report.join('\n'));
  if (html !== before) { console.error('note is stale: rerun without --check'); process.exit(1); }
  console.log('note is current');
} else {
  fs.writeFileSync(NOTE, html);
  console.log(report.join('\n'));
  console.log(`wrote ${path.relative(ROOT, NOTE)}`);
}
