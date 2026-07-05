#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

function parseArgs(argv) {
  const args = {
    transcript: null,
    full: null,
    key: null,
    out: null,
    publicOut: null,
    title: 'Light Drama Dialog',
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--transcript') args.transcript = path.resolve(argv[++i]);
    else if (token === '--full') args.full = path.resolve(argv[++i]);
    else if (token === '--key') args.key = path.resolve(argv[++i]);
    else if (token === '--out') args.out = path.resolve(argv[++i]);
    else if (token === '--public-out') args.publicOut = path.resolve(argv[++i]);
    else if (token === '--title') args.title = argv[++i];
    else throw new Error(`unknown arg: ${token}`);
  }

  if (!args.transcript) throw new Error('--transcript is required');
  if (!args.out) throw new Error('--out is required');
  return args;
}

function rel(filePath) {
  return path.relative(ROOT, filePath);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function readKey(keyPath) {
  if (!keyPath || !fs.existsSync(keyPath)) return null;
  return yaml.parse(fs.readFileSync(keyPath, 'utf8')) || null;
}

function readDirectorSceneCard(fullPath) {
  if (!fullPath || !fs.existsSync(fullPath)) return null;
  const text = fs.readFileSync(fullPath, 'utf8');
  const match = text.match(/## Director Scene Card\s*```yaml\s*([\s\S]*?)\s*```/u);
  if (!match) return null;
  try {
    return yaml.parse(match[1]) || null;
  } catch (_err) {
    return null;
  }
}

function cleanPublicText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\bW_[A-Z0-9_]+\b/g, '')
    .replace(/\bsha256:[a-f0-9]{16,}\b/gi, '')
    .replace(/\b[A-Z0-9]+-MIS-[A-Z0-9_-]+\b/gi, '')
    .trim();
}

function stripBracketAside(value) {
  return cleanPublicText(value)
    .replace(/^\[(.*)\]$/u, '$1')
    .trim();
}

function personaLabel(value) {
  return cleanPublicText(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function learnerTraitLine({ item, sceneCard }) {
  const parts = [];
  if (item?.persona) parts.push(personaLabel(item.persona));
  const register = cleanPublicText(sceneCard?.register);
  const learnerMode = register.match(/learner'?s mode is ([^;.]+)/iu)?.[1];
  if (learnerMode) parts.push(cleanPublicText(learnerMode));
  const openingShape = cleanPublicText(item?.dramatic_shape).split('->')[0]?.trim();
  if (openingShape) parts.push(`initial stance: ${openingShape}`);
  return parts.length ? `Learner: ${parts.join('; ')}.` : null;
}

function characterText(value) {
  return cleanPublicText(value).replace(/^([^:]{1,80}):\s*/u, '$1; ');
}

function buildScenePreamble({ item, sceneCard }) {
  if (!sceneCard && !item) return null;
  const rows = [
    ['Opening', stripBracketAside(sceneCard?.scene_opening)],
    ['Setting', cleanPublicText(sceneCard?.scene_setting)],
    ['Relationship', cleanPublicText(sceneCard?.relationship)],
    ['Stakes', cleanPublicText(sceneCard?.stakes)],
    ['Tutor', characterText(item?.intended_tutor_character)],
    ['Learner', learnerTraitLine({ item, sceneCard })?.replace(/^Learner:\s*/u, '')],
    ['Register', cleanPublicText(sceneCard?.register)],
    ['Locale', cleanPublicText(sceneCard?.locale)],
  ].filter(([, value]) => value);
  if (!rows.length) return null;
  return { rows };
}

function parseTranscript(text) {
  const turns = [];
  let current = null;

  for (const line of String(text || '').split(/\r?\n/)) {
    const match = line.match(/^(STAGE|LEARNER|TUTOR):\s*(.*)$/);
    if (match) {
      if (current) turns.push(current);
      current = {
        role: match[1].toLowerCase(),
        text: match[2] || '',
      };
    } else if (current) {
      current.text += `${current.text ? '\n' : ''}${line}`;
    } else if (line.trim()) {
      turns.push({ role: 'note', text: line });
    }
  }

  if (current) turns.push(current);
  return turns.map((turn) => ({ ...turn, text: turn.text.trim() }));
}

function itemFromKey(key) {
  const items = key?.items && typeof key.items === 'object' ? Object.entries(key.items) : [];
  if (!items.length) return null;
  const [tid, item] = items[0];
  return { tid, ...(item || {}) };
}

function renderMetaRows(rows) {
  return rows
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(
      ([label, value]) => `
        <div class="meta-row">
          <dt>${escapeHtml(label)}</dt>
          <dd>${escapeHtml(value)}</dd>
        </div>`,
    )
    .join('');
}

function renderTurns(turns) {
  return turns
    .map((turn, index) => {
      const role = slug(turn.role) || 'note';
      const label = turn.role.toUpperCase();
      return `
        <article class="turn turn--${role}">
          <div class="turn__role">${escapeHtml(label)}</div>
          <div class="turn__body">${escapeHtml(turn.text)
            .replace(/\n{2,}/g, '\n\n')
            .replace(/\n/g, '<br>')}</div>
          <div class="turn__no">${String(index + 1).padStart(2, '0')}</div>
        </article>`;
    })
    .join('');
}

function renderScenePreamble(preamble) {
  if (!preamble?.rows?.length) return '';
  const sceneRows = preamble.rows
    .map(
      ([label, value]) => `
        <div class="scene-row">
          <dt>${escapeHtml(label)}</dt>
          <dd>${escapeHtml(value)}</dd>
        </div>`,
    )
    .join('');
  return `
        <section class="scene-panel" aria-label="Scene preamble">
          <h2>Scene</h2>
          <dl>${sceneRows}</dl>
        </section>`;
}

function formatStageBlock(values) {
  const text = values
    .map((value) => cleanPublicText(value).replace(/[[\]]/g, '').trim())
    .filter(Boolean)
    .map((value) => (/[.?!]$/u.test(value) ? value : `${value}.`))
    .join(' ');
  return text ? `STAGE: [${text}]` : '';
}

function renderExpandedPublicTranscript({ transcript, turns, preamble }) {
  if (!preamble?.rows?.length) return transcript;
  const stageLine = formatStageBlock(
    preamble.rows.map(([label, value]) => (label === 'Opening' ? value : `${label}: ${value}`)),
  );
  const firstStage = turns[0]?.role === 'stage' ? stripBracketAside(turns[0].text) : null;
  const opening = preamble.rows.find(([label]) => label === 'Opening')?.[1] || null;
  const body =
    firstStage && opening && cleanPublicText(firstStage) === cleanPublicText(opening)
      ? transcript.replace(/^STAGE:\s*\[[^\]]+\]\s*\n+/u, '')
      : transcript;
  return `${stageLine}\n\n${body.trim()}\n`;
}

function renderHtml({ title, transcriptPath, keyPath, key, item, turns, preamble }) {
  const metaRows = renderMetaRows([
    ['Mode', key?.mode],
    ['Diagnostic', key?.diagnostic_only ? 'yes' : null],
    ['TID', item?.tid],
    ['Drama', item?.drama_id],
    ['Discipline', item?.discipline],
    ['Condition', item?.condition],
    ['Tutor policy', item?.tutor_adaptation_policy || key?.tutor_adaptation_policy],
    ['Affective policy', item?.affective_adaptation_policy || key?.affective_adaptation_policy],
    ['Persona', item?.persona],
    ['Tutor profile', item?.tutor_profile],
    ['Learner profile', item?.learner_profile],
    ['Approach', [item?.pedagogical_approach, item?.dialogue_approach].filter(Boolean).join(' + ')],
    ['Generated', key?.generated],
  ]);
  const sourceRows = renderMetaRows([
    ['Transcript', rel(transcriptPath)],
    ['Key', keyPath ? rel(keyPath) : null],
  ]);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(title)}</title>
<style>
:root {
  --bg: #f6f2ea;
  --ink: #231f1b;
  --muted: #6f655c;
  --line: #d8cfc0;
  --stage: #4c5b52;
  --learner: #8b3f35;
  --tutor: #2f5d77;
  --note: #6b5a86;
  --panel: rgba(255,255,255,.58);
  --shadow: 0 18px 50px rgba(54,44,33,.12);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #161513;
    --ink: #eee6d8;
    --muted: #b9ac9a;
    --line: #403b34;
    --stage: #9ab3a4;
    --learner: #e18f82;
    --tutor: #8bbbd4;
    --note: #c2addf;
    --panel: rgba(255,255,255,.05);
    --shadow: 0 18px 50px rgba(0,0,0,.24);
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font: 17px/1.55 ui-serif, Georgia, Cambria, "Times New Roman", serif;
}
.page {
  width: min(1120px, calc(100vw - 36px));
  margin: 0 auto;
  padding: 42px 0 64px;
}
header {
  border-bottom: 1px solid var(--line);
  padding-bottom: 28px;
  margin-bottom: 28px;
}
.eyebrow {
  color: var(--muted);
  font: 700 12px/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: .08em;
  text-transform: uppercase;
}
h1 {
  margin: 10px 0 12px;
  max-width: 860px;
  font-size: clamp(2.2rem, 6vw, 5.4rem);
  line-height: .95;
  letter-spacing: 0;
}
.lede {
  max-width: 820px;
  color: var(--muted);
  font-size: 1.08rem;
}
.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 28px;
  align-items: start;
}
.dialog {
  display: grid;
  gap: 14px;
}
.turn {
  position: relative;
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr) 42px;
  gap: 16px;
  align-items: start;
  padding: 18px 18px 18px 0;
  border-top: 1px solid var(--line);
}
.turn__role {
  position: sticky;
  top: 12px;
  font: 800 12px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: .06em;
  text-align: right;
  padding-top: 6px;
}
.turn__body {
  white-space: normal;
  overflow-wrap: anywhere;
}
.turn__no {
  color: var(--muted);
  font: 600 12px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  text-align: right;
  padding-top: 6px;
}
.turn--stage .turn__role { color: var(--stage); }
.turn--learner .turn__role { color: var(--learner); }
.turn--tutor .turn__role { color: var(--tutor); }
.turn--note .turn__role { color: var(--note); }
aside {
  position: sticky;
  top: 18px;
  display: grid;
  gap: 16px;
}
.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
  padding: 18px;
}
.panel h2 {
  margin: 0 0 12px;
  font: 750 13px/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: .06em;
  text-transform: uppercase;
}
dl {
  margin: 0;
  display: grid;
  gap: 10px;
}
.meta-row {
  display: grid;
  gap: 2px;
}
dt {
  color: var(--muted);
  font: 700 11px/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  text-transform: uppercase;
}
dd {
  margin: 0;
  overflow-wrap: anywhere;
}
    .warning {
  color: var(--muted);
  font-size: .95rem;
}
.scene-panel {
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  padding: 20px 0;
  margin-bottom: 18px;
}
.scene-panel h2 {
  margin: 0 0 14px;
  color: var(--muted);
  font: 800 12px/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.scene-panel dl {
  display: grid;
  gap: 12px;
}
.scene-row {
  display: grid;
  grid-template-columns: 118px minmax(0, 1fr);
  gap: 20px;
}
@media (max-width: 820px) {
  .grid { grid-template-columns: 1fr; }
  aside { position: static; }
  .turn {
    grid-template-columns: 1fr 36px;
    padding: 16px 0;
  }
  .turn__role {
    position: static;
    grid-column: 1 / -1;
    text-align: left;
  }
  .scene-panel dl,
  .scene-row {
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>
</head>
<body>
  <main class="page">
    <header>
      <div class="eyebrow">Curriculum light drama · rendered dialog</div>
      <h1>${escapeHtml(title)}</h1>
      <p class="lede">${escapeHtml(item?.dramatic_shape || 'Public transcript rendered from a light drama run.')}</p>
    </header>
    <div class="grid">
      <section aria-label="Dialog transcript">
        ${renderScenePreamble(preamble)}
        <div class="dialog">
          ${renderTurns(turns)}
        </div>
      </section>
      <aside aria-label="Run metadata">
        <section class="panel">
          <h2>Run</h2>
          <dl>${metaRows}</dl>
        </section>
        <section class="panel">
          <h2>Sources</h2>
          <dl>${sourceRows}</dl>
        </section>
        ${
          key?.mode === 'mock'
            ? '<section class="panel warning">This is a mock transcript. It verifies wiring and layout, not semantic dialogue quality.</section>'
            : ''
        }
      </aside>
    </div>
  </main>
</body>
</html>
`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const transcript = fs.readFileSync(args.transcript, 'utf8');
  const key = readKey(args.key);
  const item = itemFromKey(key);
  const sceneCard = readDirectorSceneCard(args.full);
  const preamble = buildScenePreamble({ item, sceneCard });
  const turns = parseTranscript(transcript);

  if (!turns.length) throw new Error(`no transcript turns parsed from ${args.transcript}`);

  if (args.publicOut) {
    fs.mkdirSync(path.dirname(args.publicOut), { recursive: true });
    fs.writeFileSync(args.publicOut, renderExpandedPublicTranscript({ transcript, turns, preamble }), 'utf8');
  }

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(
    args.out,
    renderHtml({
      title: args.title,
      transcriptPath: args.transcript,
      keyPath: args.key,
      key,
      item,
      turns,
      preamble,
    }),
  );
  console.log(`wrote ${rel(args.out)} (${turns.length} turn blocks)`);
  if (args.publicOut) console.log(`wrote ${rel(args.publicOut)} (expanded public transcript)`);
}

main();
