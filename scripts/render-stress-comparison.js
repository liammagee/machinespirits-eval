/**
 * Render a side-by-side stress-bench comparison (Markdown + swimlane HTML).
 *
 * Standard transcript-row format (one JSON array per column, one row per
 * planted moment):
 *   { d, turn, pressure, dose?, learner?, reply?, tag, why?, hit }
 * Rows missing learner/reply text are filled from the run's dialogue logs
 * when --traces is given for that column. Standing rulings are explicit
 * inputs, never baked in: an overrides file maps "<label>:<d>:<turn>" to a
 * ruled true/false that replaces the raw hit.
 *
 * Usage:
 *   node scripts/render-stress-comparison.js \
 *     --col bare --tags exports/r1-bare-rows.json [--traces exports/tutor-stub-outcome/r1-bare/traces/<world>] \
 *     --col "full stack" --tags exports/fullstack-tags.json \
 *     [--ruled exports/rulings.json] [--title "..."] \
 *     --out-md exports/comparison.md --out-html exports/comparison.html
 *
 * The HTML is self-contained (techne.css inlined) and follows the techne
 * class vocabulary; the swimlane grid is doc-local CSS per the convention.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DRAMATIC_DIALOGUE_INTERCHANGE_SCHEMA,
  renderDramaticDialogueFragment,
  renderDramaticDialogueStyles,
} from '../services/dramaticDialogueRenderer.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TECHNE_CSS = path.join(ROOT, 'notes', 'poetics', 'assets', 'techne.css');

function parseArgs(argv) {
  const cols = [];
  const opts = { title: 'Stress-bench comparison', ruled: null, outMd: null, outHtml: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--col') cols.push({ label: argv[++i], tags: null, traces: null });
    else if (a === '--tags') cols[cols.length - 1].tags = argv[++i];
    else if (a === '--traces') cols[cols.length - 1].traces = argv[++i];
    else if (a === '--ruled') opts.ruled = argv[++i];
    else if (a === '--title') opts.title = argv[++i];
    else if (a === '--out-md') opts.outMd = argv[++i];
    else if (a === '--out-html') opts.outHtml = argv[++i];
    else throw new Error(`unknown flag ${a}`);
  }
  if (cols.length < 2) throw new Error('need at least two --col columns');
  for (const c of cols) if (!c.tags) throw new Error(`column ${c.label} has no --tags`);
  if (!opts.outMd && !opts.outHtml) throw new Error('need --out-md and/or --out-html');
  return { cols, opts };
}

function loadTurnTexts(tracesRoot) {
  const texts = new Map();
  if (!tracesRoot || !fs.existsSync(tracesRoot)) return texts;
  const dirs = fs.readdirSync(tracesRoot).filter((x) => fs.statSync(path.join(tracesRoot, x)).isDirectory());
  for (const d of dirs) {
    const dir = path.join(tracesRoot, d);
    const fl = fs.readdirSync(dir).find((x) => x.endsWith('.jsonl'));
    if (!fl) continue;
    const events = fs
      .readFileSync(path.join(dir, fl), 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    for (const e of events) {
      if (e.type !== 'turn_complete') continue;
      texts.set(`${d}:${e.turn}`, {
        learner: String(e.turnRecord?.learner || ''),
        reply: String(e.turnRecord?.tutor || ''),
      });
    }
  }
  return texts;
}

function loadColumn(col, ruled) {
  const rows = JSON.parse(fs.readFileSync(col.tags, 'utf8'));
  const texts = loadTurnTexts(col.traces);
  for (const r of rows) {
    const t = texts.get(`${r.d}:${r.turn}`);
    if (t) {
      if (!r.learner) r.learner = t.learner;
      if (!r.reply) r.reply = t.reply;
    }
    const override = ruled?.[`${col.label}:${r.d}:${r.turn}`];
    r.ruled = override !== undefined;
    r.verdict = override !== undefined ? override : Boolean(r.hit);
    r.overridden = override !== undefined && override !== Boolean(r.hit);
  }
  return rows;
}

const clean = (s) =>
  String(s || '')
    .replace(/\s+/g, ' ')
    .trim();
const esc = (s) => clean(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function momentKeys(columns) {
  const keys = [];
  const seen = new Set();
  for (const { rows } of columns) {
    for (const r of rows) {
      const k = `${r.d}:${r.turn}`;
      if (!seen.has(k)) {
        seen.add(k);
        keys.push({ k, d: r.d, turn: r.turn, pressure: r.pressure });
      }
    }
  }
  return keys.sort((a, b) => (a.d === b.d ? a.turn - b.turn : a.d.localeCompare(b.d)));
}

function tally(rows) {
  const byClass = new Map();
  for (const r of rows) {
    const t = byClass.get(r.pressure) || [0, 0];
    t[1] += 1;
    if (r.verdict) t[0] += 1;
    byClass.set(r.pressure, t);
  }
  const total = [rows.filter((r) => r.verdict).length, rows.length];
  return { byClass, total };
}

function renderMd(columns, opts) {
  const lines = [`# ${opts.title}`, ''];
  const classes = [...new Set(columns.flatMap(({ rows }) => rows.map((r) => r.pressure)))];
  lines.push(`| class | ${columns.map((c) => c.col.label).join(' | ')} |`);
  lines.push(`|---|${columns.map(() => '---').join('|')}|`);
  const tallies = columns.map(({ rows }) => tally(rows));
  for (const cls of classes) {
    lines.push(`| ${cls} | ${tallies.map((t) => (t.byClass.get(cls) || [0, 0]).join('/')).join(' | ')} |`);
  }
  lines.push(`| **total** | ${tallies.map((t) => `**${t.total.join('/')}**`).join(' | ')} |`, '');
  for (const m of momentKeys(columns)) {
    const first = columns.flatMap(({ rows }) => rows).find((r) => `${r.d}:${r.turn}` === m.k);
    lines.push(`## ${m.d} t${m.turn} — ${m.pressure}`, '', `LEARNER: ${clean(first?.learner)}`, '');
    for (const { col, rows } of columns) {
      const r = rows.find((x) => `${x.d}:${x.turn}` === m.k);
      if (!r) continue;
      const mark = r.verdict ? 'pass' : 'miss';
      const ruledNote = r.ruled ? ' (ruled)' : '';
      lines.push(`**${col.label}** — ${r.tag}, ${mark}${ruledNote}${r.dose ? `, dose ${r.dose}` : ''}:`, '');
      lines.push(`> ${clean(r.reply)}`, '');
    }
  }
  return `${lines.join('\n')}\n`;
}

function renderHtml(columns, opts) {
  const css = fs.readFileSync(TECHNE_CSS, 'utf8');
  const tallies = columns.map(({ rows }) => tally(rows));
  const classes = [...new Set(columns.flatMap(({ rows }) => rows.map((r) => r.pressure)))];
  const scoreRow = (cls) =>
    `<tr><td>${esc(cls)}</td>${tallies
      .map((t) => `<td>${(t.byClass.get(cls) || [0, 0]).join('/')}</td>`)
      .join('')}</tr>`;
  const sections = momentKeys(columns)
    .map((m, i) => {
      const dialogue = buildStressComparisonDramaticDialogue(columns, m);
      return `<section class="s" id="m${i}">
        <div class="diag"><div class="ml"><h2 class="s__num">${String(i + 1).padStart(2, '0')}<span class="glyph">·</span></h2></div>
        <div class="body">
          <p class="s__kicker">${esc(m.d)} · turn ${m.turn}</p>
          <h2 class="s__h">${esc(m.pressure)}</h2>
          ${renderDramaticDialogueFragment(dialogue)}
        </div></div>
      </section>`;
    })
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<title>${esc(opts.title)}</title>
<style>${css}${renderDramaticDialogueStyles()}</style>
</head>
<body>
<main>
<section class="hero">
  <div class="hero__rune"><span>§</span> Generated comparison · ${new Date().toISOString().slice(0, 10)}</div>
  <h1 class="hero__h1">${esc(opts.title)}</h1>
  <p class="hero__subtitle">One tagger, rulings applied as explicit overrides; every lane is the tutor's delivered reply at the planted moment.</p>
  <table class="scoreboard"><thead><tr><th>class</th>${columns.map((c) => `<th>${esc(c.col.label)}</th>`).join('')}</tr></thead>
  <tbody>${classes.map(scoreRow).join('')}<tr><td><strong>total</strong></td>${tallies.map((t) => `<td><strong>${t.total.join('/')}</strong></td>`).join('')}</tr></tbody></table>
</section>
<div class="shell">
${sections}
</div>
</main>
</body>
</html>
`;
}

export function buildStressComparisonDramaticDialogue(columns, moment) {
  const first = columns.flatMap(({ rows }) => rows).find((row) => `${row.d}:${row.turn}` === moment.k);
  const arms = columns.map(({ col }, index) => ({ id: `arm-${index}`, label: col.label, baseline: index === 0 }));
  return {
    schema: DRAMATIC_DIALOGUE_INTERCHANGE_SCHEMA,
    id: `stress-${moment.d}-${moment.turn}`,
    label: `${moment.pressure} stress comparison`,
    layout: 'shared-learner',
    arms,
    turns: [
      {
        id: moment.k,
        turn: moment.turn,
        messages: [
          {
            id: `${moment.k}__learner`,
            speaker: 'learner',
            turn: moment.turn,
            arm: null,
            text: clean(first?.learner),
            delivery: { label: 'the learner', status: 'shared', tone: 'muted' },
          },
          ...columns.flatMap(({ rows }, index) => {
            const row = rows.find((entry) => `${entry.d}:${entry.turn}` === moment.k);
            if (!row) return [];
            return [
              {
                id: `${moment.k}__arm-${index}`,
                speaker: 'tutor',
                turn: moment.turn,
                arm: `arm-${index}`,
                text: clean(row.reply),
                verdict: { label: row.verdict ? 'pass' : 'miss', status: row.verdict ? 'pass' : 'fail' },
                ruling:
                  row.ruled || row.overridden
                    ? { label: 'ruled', status: row.verdict ? 'pass' : 'fail', tone: 'ink' }
                    : undefined,
                labels: [
                  { label: row.tag, status: 'tagged', tone: 'ink', kind: 'tag', group: 'evidence' },
                  ...(row.dose
                    ? [{ label: `dose ${row.dose}`, status: 'dose', tone: 'warning', kind: 'dose', group: 'evidence' }]
                    : []),
                ],
                details: row.why
                  ? [{ summary: 'why', group: 'evidence', entries: [{ label: 'tagger note', text: clean(row.why) }] }]
                  : [],
                provenance: { sourceId: `${moment.k}__${columns[index].col.label}`, quoteExact: true },
              },
            ];
          }),
        ],
        emptyLanes: columns.flatMap(({ rows }, index) =>
          rows.some((entry) => `${entry.d}:${entry.turn}` === moment.k) ? [] : [{ arm: `arm-${index}`, label: '—' }],
        ),
      },
    ],
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { cols, opts } = parseArgs(process.argv);
  const ruled = opts.ruled ? JSON.parse(fs.readFileSync(opts.ruled, 'utf8')) : null;
  const columns = cols.map((col) => ({ col, rows: loadColumn(col, ruled) }));
  if (opts.outMd) {
    fs.writeFileSync(opts.outMd, renderMd(columns, opts));
    console.log(`wrote ${opts.outMd}`);
  }
  if (opts.outHtml) {
    fs.writeFileSync(opts.outHtml, renderHtml(columns, opts));
    console.log(`wrote ${opts.outHtml}`);
  }
}
