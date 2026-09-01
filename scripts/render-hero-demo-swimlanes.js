#!/usr/bin/env node
/**
 * Render the hero-demo with/without recordings as swimlanes — the poetics
 * browser's lane grammar (tutor lane · time spine with beads · learner lane,
 * see renderSwimlane() in scripts/browse-poetics-scripts.js), one swimlane
 * per tutor, side by side — and splice them into the tabbed demo note
 * between <!--SWIM:<key>--> … <!--/SWIM:<key>--> markers. The interchange
 * each swimlane is built from is validated by the shared dramatic-dialogue
 * renderer's strict schema and written beside the traces.
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
  validateDramaticDialogueInterchange,
  DRAMATIC_DIALOGUE_INTERCHANGE_SCHEMA,
} from '../services/dramaticDialogueRenderer.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNS = path.join(ROOT, 'notes', 'poetics', 'hero-demo-runs');
const NOTE = path.join(ROOT, 'notes', 'poetics', '2026-09-01-adaptive-tutor-demo-app.html');

const WORLDS = [
  {
    key: 'rowan',
    dir: 'world-030',
    label: 'Rowan Flat — the plain tutor and the adaptive tutor, one full session each',
  },
  {
    key: 'ghost',
    dir: 'world-035',
    label: "The Nine O'Clock Ghost — the plain tutor and the adaptive tutor, one full night each",
  },
  {
    key: 'fraction',
    dir: 'world-037',
    label: 'Half Plus a Third — the plain tutor and the adaptive tutor, one full lesson each',
  },
];
const ARMS = [
  {
    id: 'plain',
    file: 'butler-d1',
    label: 'Plain tutor',
    baseline: true,
    summary: 'No adaptive stack: no state detector, no move cards.',
  },
  {
    id: 'adaptive',
    file: 'v3-d1',
    label: 'Adaptive tutor',
    baseline: false,
    summary: 'Full stack: state detector, move cards, delivery record.',
  },
];
const STATE_WORDS = {
  jumping_ahead: 'deadline demand',
  irritated: 'mockery',
  lost: 'lost thread',
  frustrated: 'grievance',
  forgetting: 'false memory',
  opposed: 'fused stake',
  flat: 'switched off',
  bored: 'switched off',
};

function readTrace(dir, base) {
  for (const ext of ['.jsonl.gz', '.jsonl']) {
    const file = path.join(dir, base + ext);
    if (!fs.existsSync(file)) continue;
    const raw = ext.endsWith('.gz')
      ? zlib.gunzipSync(fs.readFileSync(file)).toString('utf8')
      : fs.readFileSync(file, 'utf8');
    const turns = new Map();
    const detected = new Map();
    const planted = new Map();
    let runEnd = null;
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
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
      if (!row) {
        emptyLanes.push({ arm: arm.id, label: 'dialogue ended' });
        continue;
      }
      const learnerLabels = [];
      const plant = trace.planted.get(n);
      if (plant)
        learnerLabels.push({
          label: `planted: ${STATE_WORDS[plant] || plant}`,
          tone: 'warning',
          kind: 'planted',
          group: 'state',
        });
      messages.push({
        id: `${world.key}-${arm.id}-t${n}-learner`,
        speaker: 'learner',
        turn: n,
        arm: arm.id,
        text: row.learner,
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
        id: `${world.key}-${arm.id}-t${n}-tutor`,
        speaker: 'tutor',
        turn: n,
        arm: arm.id,
        text: row.tutor,
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

const SWIM_STYLES = `
  /* swimlane grammar — copied from the poetics browser (scripts/browse-poetics-scripts.js) */
  .swim-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 1.4rem; align-items: start; }
  .swim-pair[data-view="plain"] .swim-arm--adaptive, .swim-pair[data-view="adaptive"] .swim-arm--plain { display: none; }
  .swim-pair[data-view="plain"], .swim-pair[data-view="adaptive"] { grid-template-columns: 1fr; }
  @media (max-width: 1100px) { .swim-pair { grid-template-columns: 1fr; } }
  .swim-view { display: flex; gap: 0.4rem; margin: 0 0 0.9rem; }
  .swim-view button { border: 1px solid var(--rule); background: var(--paper); color: var(--ink-2); padding: 0.4rem 0.8rem; cursor: pointer; font: 700 0.68rem/1 "JetBrains Mono", monospace; letter-spacing: 0.06em; text-transform: uppercase; }
  .swim-view button[aria-pressed="true"] { background: var(--moss-deep); color: var(--paper); border-color: var(--moss-deep); }
  .swim-arm__title { margin: 0 0 0.6rem; font: 700 0.72rem/1.4 "JetBrains Mono", monospace; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-2); }
  .swim-arm--plain .swim-arm__title { color: var(--brick-d); }
  .swim-arm--adaptive .swim-arm__title { color: var(--moss-deep); }
  .swim-arm__title small { display: block; margin-top: 0.2rem; color: var(--ink-3); font-weight: 400; letter-spacing: 0.03em; text-transform: none; }
  .swimlane { max-width: 80rem; margin: 0 auto; display: flex; flex-direction: column; gap: 4px; }
  .swim-head { display: grid; grid-template-columns: 1fr 44px 1fr; gap: 14px; position: sticky; top: 5.9rem; z-index: 1; background: var(--paper-2); padding-bottom: 4px; }
  .swim-label { font: 700 10.5px/1 "JetBrains Mono", monospace; letter-spacing: 0.2em; text-transform: uppercase; padding: 6px 10px; border-bottom: 2px solid var(--rule); }
  .swim-label.tutor { color: var(--moss-deep); border-bottom-color: var(--moss-deep); }
  .swim-label.learner { color: var(--ochre-d); border-bottom-color: var(--ochre-d); text-align: right; }
  .swim-label.spine { border-bottom: 0; }
  .swim-row { display: grid; grid-template-columns: 1fr 44px 1fr; gap: 14px; align-items: stretch; scroll-margin-top: 8.5rem; }
  .swim-row .swim-lane { min-width: 0; align-self: start; }
  .swim-row .swim-lane.empty { border: 0; }
  .swim-row.is-linked .scene-card { outline: 2px solid var(--ochre); outline-offset: 3px; }
  .swim-spine { position: relative; min-height: 30px; }
  .swim-spine::before { content: ""; position: absolute; left: 50%; top: -4px; bottom: -4px; width: 2px; transform: translateX(-50%); background: var(--rule); }
  .swim-bead { position: relative; z-index: 1; display: block; width: 24px; height: 24px; margin: 4px auto 0; border-radius: 50%; background: var(--paper); border: 1.5px solid var(--rule); color: var(--ink-3); font: 600 10px/22px "JetBrains Mono", monospace; text-align: center; }
  .swim-row[data-side="tutor"] .swim-bead { border-color: var(--moss); color: var(--moss-deep); }
  .swim-row[data-side="learner"] .swim-bead { border-color: var(--ochre); color: var(--ochre-d); }
  .swimlane .scene-card { margin: 0; }
  .scene-card { border: 1px solid var(--rule); background: var(--paper-4); padding: 12px 14px; position: relative; font-size: 0.86rem; line-height: 1.55; }
  .scene-card.tutor { border-left: 4px solid var(--moss-deep); }
  .scene-card.learner { border-left: 4px solid var(--ochre-d); }
  .scene-head { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; margin-bottom: 8px; flex-wrap: wrap; }
  .speaker { font-family: "JetBrains Mono", monospace; font-size: 10.5px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--ink); }
  .turn-num { font-family: "JetBrains Mono", monospace; color: var(--ink-3); font-size: 10.5px; letter-spacing: 0.08em; font-variant-numeric: tabular-nums; }
  .scene-card .swim-speech { margin: 0; }
  .swim-pill { display: inline-block; margin-left: 0.4rem; padding: 0 0.4rem; border: 1px solid var(--rule); font: 700 9.5px/1.7 "JetBrains Mono", monospace; letter-spacing: 0.06em; text-transform: uppercase; }
  .swim-pill--planted { border-color: var(--ochre); color: var(--ochre-d); }
  .swim-pill--detected { border-color: var(--moss); color: var(--moss-deep); }
  @media (max-width: 760px) { .swim-head, .swim-row { grid-template-columns: 1fr; gap: 6px; } .swim-spine, .swim-label.spine { display: none; } .swim-row .swim-lane.empty { display: none; } .swim-label.learner { text-align: left; } }
`;

const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

function sceneCard(type, message) {
  const pills = (message.labels || [])
    .map(
      (badge) =>
        `<span class="swim-pill swim-pill--${escapeHtml(badge.kind || 'label')}">${escapeHtml(badge.label)}</span>`,
    )
    .join('');
  return (
    `<section class="scene-card ${type}"><div class="scene-head"><span class="speaker">${type}${pills}</span>` +
    `<span class="turn-num">turn ${escapeHtml(message.turn)}</span></div><p class="swim-speech">${escapeHtml(message.text)}</p></section>`
  );
}

/** One arm as a swimlane: learner row (bead = turn number) then tutor row (bead ↳), per turn. */
function renderArmSwimlane(dialogue, armId) {
  const empty = '<div class="swim-lane empty" aria-hidden="true"></div>';
  const rows = [];
  for (const turn of dialogue.turns) {
    const learner = turn.messages.find((m) => m.arm === armId && m.speaker === 'learner');
    const tutor = turn.messages.find((m) => m.arm === armId && m.speaker === 'tutor');
    if (!learner && !tutor) continue;
    if (learner) {
      rows.push(
        `<div class="swim-row" data-side="learner" data-turn="${escapeHtml(turn.turn)}">${empty}` +
          `<div class="swim-spine"><span class="swim-bead">${escapeHtml(turn.turn)}</span></div>` +
          `<div class="swim-lane">${sceneCard('learner', learner)}</div></div>`,
      );
    }
    if (tutor) {
      rows.push(
        `<div class="swim-row" data-side="tutor" data-turn="${escapeHtml(turn.turn)}"><div class="swim-lane">${sceneCard('tutor', tutor)}</div>` +
          `<div class="swim-spine"><span class="swim-bead">&#8627;</span></div>${empty}</div>`,
      );
    }
  }
  return (
    '<div class="swimlane"><div class="swim-head"><span class="swim-label tutor">tutor</span>' +
    '<span class="swim-label spine" aria-hidden="true"></span><span class="swim-label learner">learner</span></div>' +
    rows.join('') +
    '</div>'
  );
}

function renderSwimPair(dialogue) {
  const arms = dialogue.arms
    .map(
      (arm) =>
        `<div class="swim-arm swim-arm--${escapeHtml(arm.id)}"><p class="swim-arm__title">${escapeHtml(arm.label)}<small>${escapeHtml(arm.summary || '')}</small></p>${renderArmSwimlane(dialogue, arm.id)}</div>`,
    )
    .join('');
  return (
    `<div class="swim-view" role="group" aria-label="Choose which transcript to show">` +
    `<button type="button" data-swim-view="both" aria-pressed="true">Side by side</button>` +
    `<button type="button" data-swim-view="plain" aria-pressed="false">Plain tutor only</button>` +
    `<button type="button" data-swim-view="adaptive" aria-pressed="false">Adaptive tutor only</button></div>` +
    `<div class="swim-pair" data-view="both" data-dialogue-id="${escapeHtml(dialogue.id)}" aria-label="${escapeHtml(dialogue.label)}">${arms}</div>`
  );
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
html = splice(html, 'styles', `<style id="swim-styles">${SWIM_STYLES}</style>`);
const report = [];
for (const world of WORLDS) {
  const dialogue = buildInterchange(world);
  if (!dialogue) {
    report.push(`${world.key}: no recordings under ${world.dir} — left as is`);
    continue;
  }
  validateDramaticDialogueInterchange(dialogue);
  const fragment = renderSwimPair(dialogue);
  html = splice(html, world.key, fragment);
  if (!check)
    fs.writeFileSync(path.join(RUNS, world.dir, 'interchange.json'), JSON.stringify(dialogue, null, 2) + '\n');
  report.push(`${world.key}: ${dialogue.turns.length} turns rendered from ${world.dir}`);
}
if (check) {
  console.log(report.join('\n'));
  if (html !== before) {
    console.error('note is stale: rerun without --check');
    process.exit(1);
  }
  console.log('note is current');
} else {
  fs.writeFileSync(NOTE, html);
  console.log(report.join('\n'));
  console.log(`wrote ${path.relative(ROOT, NOTE)}`);
}
