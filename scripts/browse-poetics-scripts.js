#!/usr/bin/env node
/**
 * Browser for generated poetics teaching scripts.
 *
 * Reads the poetics sidecar tables, not evaluation_results. Use
 * scripts/ingest-poetics-artifacts.js first when a new artifact root is added.
 */

import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openPoeticsStore, upsertPoeticsLabel } from '../services/poeticsStore.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

function parseArgs(argv) {
  const args = {
    dbPath: null,
    port: 3466,
    host: '127.0.0.1',
    open: true,
    runId: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--db') args.dbPath = path.resolve(argv[++i]);
    else if (token === '--port') args.port = Number.parseInt(argv[++i], 10);
    else if (token === '--host') args.host = argv[++i];
    else if (token === '--run-id') args.runId = argv[++i];
    else if (token === '--no-open') args.open = false;
    else if (token === '--help' || token === '-h') {
      console.log(`Usage:
  node scripts/browse-poetics-scripts.js [--port 3466] [--host 127.0.0.1]
      [--run-id ID] [--db FILE] [--no-open]`);
      process.exit(0);
    } else {
      throw new Error(`unknown arg: ${token}`);
    }
  }
  if (!Number.isInteger(args.port) || args.port < 1) throw new Error('--port must be a positive integer');
  return args;
}

function decodeJson(value, fallback = null) {
  if (value == null || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function resolveArtifact(relPath) {
  if (!relPath) return null;
  const abs = path.resolve(ROOT, relPath);
  if (!abs.startsWith(`${ROOT}${path.sep}`)) throw new Error(`artifact escapes repo root: ${relPath}`);
  return abs;
}

function readArtifact(relPath, maxChars = 90000) {
  const abs = resolveArtifact(relPath);
  if (!abs || !fs.existsSync(abs)) return null;
  const text = fs.readFileSync(abs, 'utf8');
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n\n[truncated]` : text;
}

function listRuns(db) {
  return db
    .prepare(
      `
      SELECT
        r.id,
        r.source_root AS sourceRoot,
        r.batch_id AS batchId,
        r.generator,
        r.git_commit AS gitCommit,
        COUNT(DISTINCT i.id) AS itemCount,
        COUNT(DISTINCT s.id) AS scoreCount,
        COUNT(DISTINCT l.id) AS labelCount,
        MAX(r.created_at) AS createdAt
      FROM poetics_runs r
      LEFT JOIN poetics_items i ON i.run_id = r.id
      LEFT JOIN poetics_scores s ON s.item_id = i.id
      LEFT JOIN poetics_labels l ON l.item_id = i.id
      GROUP BY r.id
      ORDER BY r.created_at DESC, r.id DESC
    `,
    )
    .all();
}

function listItems(db, filters = {}) {
  const where = [];
  const params = {};
  if (filters.runId) {
    where.push('i.run_id = @runId');
    params.runId = filters.runId;
  }
  if (filters.arm) {
    where.push('i.arm = @arm');
    params.arm = filters.arm;
  }
  if (filters.role) {
    if (filters.role === 'target') where.push("i.unit_id LIKE 'target-%'");
    else {
      where.push('i.control_role = @role');
      params.role = filters.role;
    }
  }
  if (filters.q) {
    where.push(
      `(i.id LIKE @q OR i.tid LIKE @q OR i.drama_id LIKE @q OR i.discipline LIKE @q OR i.unit_id LIKE @q OR i.intended_lean LIKE @q)`,
    );
    params.q = `%${filters.q}%`;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return db
    .prepare(
      `
      SELECT
        i.id,
        i.run_id AS runId,
        i.unit_id AS unitId,
        i.repeat,
        i.arm,
        i.tid,
        i.drama_id AS dramaId,
        i.discipline,
        i.condition_name AS conditionName,
        i.intended_lean AS intendedLean,
        i.control_family AS controlFamily,
        i.control_role AS controlRole,
        i.sample_path AS samplePath,
        i.full_transcript_path AS fullTranscriptPath,
        GROUP_CONCAT(DISTINCT s.critic_model || '=' || COALESCE(s.form_class, '')) AS criticForms,
        COUNT(DISTINCT s.id) AS scoreCount,
        COUNT(DISTINCT l.id) AS labelCount
      FROM poetics_items i
      LEFT JOIN poetics_scores s ON s.item_id = i.id
      LEFT JOIN poetics_labels l ON l.item_id = i.id
      ${whereSql}
      GROUP BY i.id
      ORDER BY i.run_id DESC, i.repeat, i.unit_id, i.arm, i.tid
      LIMIT 800
    `,
    )
    .all(params)
    .filter((row) => {
      if (!filters.form && !filters.critic) return true;
      const forms = parseCriticForms(row.criticForms);
      return forms.some((entry) => {
        if (filters.form && entry.form !== filters.form) return false;
        if (filters.critic && !entry.critic.includes(filters.critic)) return false;
        return true;
      });
    })
    .map((row, index) => {
      const hydrated = { ...row, criticForms: parseCriticForms(row.criticForms) };
      return filters.blind ? blindItem(hydrated, index) : hydrated;
    });
}

function blindItem(row, index = 0) {
  return {
    id: row.id,
    blindId: `S${String(index + 1).padStart(3, '0')}`,
    runId: row.runId,
    tid: row.tid,
    labelCount: row.labelCount,
  };
}

function parseCriticForms(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .filter(Boolean)
    .map((entry) => {
      const i = entry.indexOf('=');
      return { critic: entry.slice(0, i), form: entry.slice(i + 1) };
    });
}

function getItem(db, id) {
  const item = db
    .prepare(
      `
      SELECT
        i.*,
        r.source_root AS source_root,
        r.batch_id AS batch_id
      FROM poetics_items i
      JOIN poetics_runs r ON r.id = i.run_id
      WHERE i.id = ?
    `,
    )
    .get(id);
  if (!item) return null;
  const scores = db
    .prepare(
      `
      SELECT critic_model, score_file, form_class, recontextualization, stated_insight,
        rupture, global_coherence, pivot_learner_turn, recohered_earlier,
        stated_insight_evidence, flags, metadata
      FROM poetics_scores
      WHERE item_id = ?
      ORDER BY critic_model
    `,
    )
    .all(id)
    .map((row) => ({
      ...row,
      flags: decodeJson(row.flags, []),
      metadata: decodeJson(row.metadata, {}),
    }));
  const labels = db
    .prepare(
      `
      SELECT labeller_id, perspective, label_file, form_class, pivot_learner_turn,
        rationale, metadata, labelled_at
      FROM poetics_labels
      WHERE item_id = ?
      ORDER BY perspective, labeller_id
    `,
    )
    .all(id)
    .map((row) => ({ ...row, metadata: decodeJson(row.metadata, {}) }));
  return {
    item: {
      id: item.id,
      runId: item.run_id,
      unitId: item.unit_id,
      repeat: item.repeat,
      arm: item.arm,
      tid: item.tid,
      dramaId: item.drama_id,
      discipline: item.discipline,
      conditionName: item.condition_name,
      intendedLean: item.intended_lean,
      controlFamily: item.control_family,
      controlRole: item.control_role,
      samplePath: item.sample_path,
      fullTranscriptPath: item.full_transcript_path,
      keyPath: item.key_path,
      sourceRoot: item.source_root,
      batchId: item.batch_id,
      qualityStatus: item.quality_status,
      qualityWarnings: decodeJson(item.quality_warnings, []),
      metadata: decodeJson(item.metadata, {}),
    },
    scores,
    labels,
    sampleText: readArtifact(item.sample_path) || '',
    fullTranscriptText: readArtifact(item.full_transcript_path) || '',
  };
}

function getBlindItem(db, id, { labellerId = null } = {}) {
  const detail = getItem(db, id);
  if (!detail) return null;
  const ownLabel = labellerId
    ? detail.labels.find((label) => label.labeller_id === labellerId && label.perspective === 'human-browser') || null
    : null;
  return {
    item: {
      id: detail.item.id,
      runId: detail.item.runId,
      tid: detail.item.tid,
    },
    label: ownLabel,
    sampleText: detail.sampleText,
  };
}

const LABEL_FORMS = new Set(['recognition', 'trap', 'flat']);

function normalizeLabellerId(value) {
  return String(value || '')
    .trim()
    .replace(/[^\w-]/g, '');
}

function saveBrowserLabel(db, input) {
  const itemId = String(input.itemId || '').trim();
  const labellerId = normalizeLabellerId(input.labellerId);
  const formClass = String(input.formClass || '').trim();
  if (!itemId) throw new Error('missing itemId');
  if (!labellerId) throw new Error('missing labellerId');
  if (!LABEL_FORMS.has(formClass)) throw new Error('formClass must be recognition|trap|flat');
  const item = db.prepare('SELECT id, run_id FROM poetics_items WHERE id = ?').get(itemId);
  if (!item) throw new Error(`unknown itemId: ${itemId}`);
  const pivot =
    input.pivotLearnerTurn == null || input.pivotLearnerTurn === ''
      ? null
      : Number.parseInt(input.pivotLearnerTurn, 10);
  if (pivot != null && (!Number.isInteger(pivot) || pivot < 1)) throw new Error('pivotLearnerTurn must be positive');
  upsertPoeticsLabel(db, {
    itemId,
    labellerId,
    perspective: 'human-browser',
    labelFile: `browser:${item.run_id}:${labellerId}`,
    formClass,
    pivotLearnerTurn: pivot,
    rationale: input.rationale || null,
    labelledAt: new Date().toISOString(),
    metadata: {
      rubricVersion: 'phase2-form-3way-v1',
      interface: 'poetics-browser',
      blind: true,
    },
  });
  return getBlindItem(db, itemId, { labellerId });
}

function createPoeticsBrowserApp({ dbPath = null } = {}) {
  const db = openPoeticsStore(dbPath || undefined);
  const app = express();
  app.use(express.json({ limit: '64kb' }));
  app.locals.db = db;
  app.get('/favicon.ico', (_req, res) => res.status(204).end());
  app.get('/api/runs', (_req, res) => res.json({ runs: listRuns(db) }));
  app.get('/api/items', (req, res) => {
    res.json({
      items: listItems(db, {
        runId: req.query.runId || null,
        q: req.query.q || null,
        arm: req.query.arm || null,
        role: req.query.role || null,
        form: req.query.form || null,
        critic: req.query.critic || null,
        blind: req.query.blind === '1',
      }),
    });
  });
  app.get('/api/item', (req, res) => {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'missing id' });
    const item =
      req.query.blind === '1'
        ? getBlindItem(db, id, { labellerId: normalizeLabellerId(req.query.labeller || '') })
        : getItem(db, id);
    if (!item) return res.status(404).json({ error: 'not found' });
    return res.json(item);
  });
  app.post('/api/labels', (req, res) => {
    try {
      const detail = saveBrowserLabel(db, req.body || {});
      return res.json({ ok: true, detail });
    } catch (error) {
      return res.status(400).json({ error: error.message || String(error) });
    }
  });
  app.get('/', (_req, res) => res.type('html').send(renderBrowserHtml()));
  return app;
}

function renderBrowserHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Poetics Script Browser</title>
<style>
:root {
  color-scheme: light;
  --bg: #f7f7f5;
  --panel: #ffffff;
  --ink: #1d2428;
  --muted: #69757c;
  --line: #d9dedc;
  --accent: #235c55;
  --accent-soft: #e1efeb;
  --warn: #8b4a16;
  --trap: #7a2f3b;
  --flat: #4b5c6b;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: var(--bg);
  color: var(--ink);
}
button, input, select {
  font: inherit;
}
.app {
  display: grid;
  grid-template-columns: minmax(300px, 34vw) 1fr;
  min-height: 100vh;
}
.sidebar {
  border-right: 1px solid var(--line);
  background: var(--panel);
  min-width: 0;
  display: grid;
  grid-template-rows: auto auto 1fr;
}
.mast {
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--line);
}
h1 {
  font-size: 16px;
  margin: 0 0 4px;
  letter-spacing: 0;
}
.sub {
  color: var(--muted);
  font-size: 12px;
}
.filters {
  display: grid;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line);
}
.filters select, .filters input {
  width: 100%;
  border: 1px solid var(--line);
  background: #fff;
  min-height: 34px;
  padding: 6px 8px;
}
.filter-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.items {
  overflow: auto;
}
.item {
  width: 100%;
  border: 0;
  border-bottom: 1px solid var(--line);
  background: transparent;
  text-align: left;
  padding: 10px 14px;
  display: grid;
  gap: 5px;
  cursor: pointer;
}
.item:hover, .item.active {
  background: var(--accent-soft);
}
.item-main {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-weight: 650;
  font-size: 13px;
}
.item-meta, .chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  color: var(--muted);
  font-size: 11px;
}
.chip {
  border: 1px solid var(--line);
  padding: 2px 5px;
  background: #fff;
}
.chip.recognition { color: var(--accent); border-color: #8ab9ae; }
.chip.trap { color: var(--trap); border-color: #d19aa5; }
.chip.flat { color: var(--flat); border-color: #aeb8c1; }
.main {
  min-width: 0;
  display: grid;
  grid-template-rows: auto auto 1fr;
}
.detail-head {
  padding: 14px 18px;
  border-bottom: 1px solid var(--line);
  background: #fbfbfa;
}
.detail-title {
  display: flex;
  gap: 12px;
  align-items: baseline;
  justify-content: space-between;
}
.detail-title h2 {
  font-size: 17px;
  margin: 0;
}
.tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
}
.tab {
  border: 0;
  border-right: 1px solid var(--line);
  padding: 9px 14px;
  background: transparent;
  cursor: pointer;
}
.tab.active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 650;
}
.pane {
  overflow: auto;
  padding: 16px 18px 26px;
}
pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  line-height: 1.45;
  font-size: 13px;
  margin: 0;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
th, td {
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
  padding: 8px 6px;
}
th {
  color: var(--muted);
  font-size: 12px;
  font-weight: 650;
}
.empty {
  color: var(--muted);
  padding: 20px;
}
.blind .score-only,
.blind .tab[data-tab="full"],
.blind .tab[data-tab="scores"],
.blind .tab[data-tab="meta"] {
  display: none;
}
.label-panel {
  border-top: 1px solid var(--line);
  margin-top: 16px;
  padding-top: 14px;
  display: grid;
  gap: 10px;
  max-width: 780px;
}
.label-rubric {
  border: 1px solid var(--line);
  background: #fff;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.45;
}
.label-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.label-choice {
  border: 1px solid var(--line);
  background: #fff;
  padding: 8px 10px;
  cursor: pointer;
}
.label-choice.active {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 650;
}
.label-fields {
  display: grid;
  grid-template-columns: 180px 1fr auto;
  gap: 8px;
  align-items: end;
}
.label-fields input,
.label-fields textarea {
  width: 100%;
  border: 1px solid var(--line);
  background: #fff;
  padding: 7px 8px;
}
.label-fields textarea {
  min-height: 38px;
  resize: vertical;
}
@media (max-width: 860px) {
  .app { grid-template-columns: 1fr; grid-template-rows: 46vh 54vh; }
  .sidebar { border-right: 0; border-bottom: 1px solid var(--line); }
  .label-fields { grid-template-columns: 1fr; }
}
</style>
</head>
<body>
<div id="app" class="app">
  <aside class="sidebar">
    <div class="mast">
      <h1 id="appTitle">Poetics Script Browser</h1>
      <div id="appSub" class="sub">Generated public scripts, full traces, critic scores, and labels-as-perspective.</div>
    </div>
    <div class="filters">
      <select id="runSelect"></select>
      <input id="searchInput" placeholder="Filter by T id, drama id, unit, discipline">
      <input id="labellerInput" class="blind-only" placeholder="Labeller id">
      <div class="filter-row score-only">
        <select id="roleSelect">
          <option value="">all roles</option>
          <option value="target">target</option>
          <option value="flat_control">flat controls</option>
          <option value="boundary_trap_control">boundary traps</option>
          <option value="hard_trap_control">hard traps</option>
        </select>
        <select id="formSelect">
          <option value="">all forms</option>
          <option value="recognition">recognition</option>
          <option value="trap">trap</option>
          <option value="flat">flat</option>
        </select>
      </div>
    </div>
    <div id="items" class="items"></div>
  </aside>
  <main class="main">
    <div id="detailHead" class="detail-head">
      <div class="detail-title">
        <h2>Select a script</h2>
        <span class="sub">Sidecar DB</span>
      </div>
    </div>
    <div class="tabs">
      <button class="tab active" data-tab="sample">Public</button>
      <button class="tab" data-tab="full">Full</button>
      <button class="tab" data-tab="scores">Scores</button>
      <button class="tab" data-tab="meta">Meta</button>
    </div>
    <div id="pane" class="pane"><div class="empty">No script selected.</div></div>
  </main>
</div>
<script>
const state = { runs: [], items: [], selected: null, detail: null, tab: 'sample', blind: false, labeller: '', selectedLabel: null };
const el = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json()).error || await res.text());
  return res.json();
}

function formChip(entry) {
  const short = entry.critic.split('/').pop().replace(/-.+$/, '');
  return '<span class="chip ' + esc(entry.form) + '">' + esc(short + ': ' + entry.form) + '</span>';
}

function renderRuns() {
  const select = el('runSelect');
  select.innerHTML = state.runs.map((run, idx) =>
    '<option value="' + esc(run.id) + '"' + (idx === 0 ? ' selected' : '') + '>' +
    esc(run.id + ' · ' + run.itemCount + ' items · ' + run.scoreCount + ' scores') + '</option>'
  ).join('');
}

function renderItems() {
  const root = el('items');
  if (!state.items.length) {
    root.innerHTML = '<div class="empty">No scripts match the current filters.</div>';
    return;
  }
  root.innerHTML = state.items.map((item) => {
    const active = state.selected === item.id ? ' active' : '';
    if (state.blind) {
      return '<button class="item' + active + '" data-id="' + esc(item.id) + '">' +
        '<div class="item-main"><span>' + esc(item.blindId || item.tid || 'script') + '</span><span>' + esc(item.tid || '') + '</span></div>' +
        '<div class="item-meta"><span>public transcript</span><span>' + esc(item.labelCount ? 'labelled' : 'unlabelled') + '</span></div>' +
        '</button>';
    }
    const role = item.controlRole || (item.unitId || '').replace(/-.+$/, '');
    return '<button class="item' + active + '" data-id="' + esc(item.id) + '">' +
      '<div class="item-main"><span>' + esc(item.tid + ' · ' + (item.dramaId || '')) + '</span><span>' + esc(item.arm || '') + '</span></div>' +
      '<div class="item-meta"><span>' + esc(item.repeat || '') + '</span><span>' + esc(role || '') + '</span><span>' + esc(item.discipline || '') + '</span></div>' +
      '<div class="chips">' + item.criticForms.map(formChip).join('') + '</div>' +
      '</button>';
  }).join('');
  root.querySelectorAll('.item').forEach((button) => button.addEventListener('click', () => selectItem(button.dataset.id)));
}

function renderDetailHead() {
  const detail = state.detail;
  if (!detail) return;
  const item = detail.item;
  if (state.blind) {
    el('detailHead').innerHTML = '<div class="detail-title"><h2>' +
      esc(item.tid || 'Script') +
      '</h2><span class="sub">blind human scoring</span></div>';
    return;
  }
  el('detailHead').innerHTML = '<div class="detail-title"><h2>' +
    esc(item.tid + ' · ' + (item.dramaId || item.unitId)) +
    '</h2><span class="sub">' + esc([item.runId, item.repeat, item.arm].filter(Boolean).join(' / ')) + '</span></div>' +
    '<div class="chips" style="margin-top:8px">' +
    [item.discipline, item.conditionName, item.intendedLean, item.controlRole, item.controlFamily].filter(Boolean).map((v) => '<span class="chip">' + esc(v) + '</span>').join('') +
    '</div>';
}

function renderPane() {
  const detail = state.detail;
  if (!detail) return;
  const pane = el('pane');
  if (state.blind) {
    const current = detail.label || {};
    state.selectedLabel = state.selectedLabel || current.form_class || null;
    pane.innerHTML = '<pre>' + esc(detail.sampleText || 'No public sample found.') + '</pre>' + renderLabelPanel(current);
    wireLabelPanel();
  } else if (state.tab === 'sample') {
    pane.innerHTML = '<pre>' + esc(detail.sampleText || 'No public sample found.') + '</pre>';
  } else if (state.tab === 'full') {
    pane.innerHTML = '<pre>' + esc(detail.fullTranscriptText || 'No full transcript found.') + '</pre>';
  } else if (state.tab === 'scores') {
    pane.innerHTML = '<table><thead><tr><th>Critic</th><th>Form</th><th>Recon</th><th>Insight</th><th>Pivot</th><th>Evidence</th></tr></thead><tbody>' +
      detail.scores.map((s) => '<tr><td>' + esc(s.critic_model) + '</td><td>' + esc(s.form_class) + '</td><td>' +
      esc(s.recontextualization) + '</td><td>' + esc(s.stated_insight) + '</td><td>' + esc(s.pivot_learner_turn) +
      '</td><td>' + esc([s.recohered_earlier, s.stated_insight_evidence].filter(Boolean).join(' / ')) + '</td></tr>').join('') +
      '</tbody></table>';
  } else {
    pane.innerHTML = '<pre>' + esc(JSON.stringify({ item: detail.item, labels: detail.labels }, null, 2)) + '</pre>';
  }
}

function renderLabelPanel(current) {
  const selected = state.selectedLabel || current.form_class || '';
  const button = (form, label) =>
    '<button class="label-choice' + (selected === form ? ' active' : '') + '" data-label="' + form + '">' + label + '</button>';
  return '<div class="label-panel">' +
    '<div class="label-rubric">' +
    '<strong>Form label.</strong> Recognition means a later learner turn re-reads the learner\\'s own earlier turn. ' +
    'Trap means no re-reading, but an insight declaration. Flat means neither.' +
    '</div>' +
    '<div class="label-buttons">' +
    button('recognition', 'Recognition') + button('trap', 'Trap') + button('flat', 'Flat') +
    '</div>' +
    '<div class="label-fields">' +
    '<label><span class="sub">Pivot learner turn</span><input id="pivotInput" type="number" min="1" value="' + esc(current.pivot_learner_turn || '') + '"></label>' +
    '<label><span class="sub">Rationale</span><textarea id="rationaleInput">' + esc(current.rationale || '') + '</textarea></label>' +
    '<button id="saveLabel">Save Label</button>' +
    '</div>' +
    '<div id="labelStatus" class="sub">' + (current.form_class ? 'Current label: ' + esc(current.form_class) : 'No label saved yet.') + '</div>' +
    '</div>';
}

function wireLabelPanel() {
  document.querySelectorAll('.label-choice').forEach((button) => button.addEventListener('click', () => {
    state.selectedLabel = button.dataset.label;
    renderPane();
  }));
  const save = el('saveLabel');
  if (!save) return;
  save.addEventListener('click', async () => {
    const status = el('labelStatus');
    if (!state.selectedLabel) {
      status.textContent = 'Choose recognition, trap, or flat before saving.';
      return;
    }
    if (!state.labeller) {
      status.textContent = 'Enter a labeller id in the sidebar.';
      return;
    }
    status.textContent = 'Saving...';
    try {
      const saved = await postJson('/api/labels', {
        itemId: state.detail.item.id,
        labellerId: state.labeller,
        formClass: state.selectedLabel,
        pivotLearnerTurn: el('pivotInput').value,
        rationale: el('rationaleInput').value,
      });
      state.detail = saved.detail;
      status.textContent = 'Saved.';
      renderPane();
      await loadItems();
    } catch (err) {
      status.textContent = err.message;
    }
  });
}

async function loadItems() {
  const params = new URLSearchParams();
  if (el('runSelect').value) params.set('runId', el('runSelect').value);
  if (el('searchInput').value) params.set('q', el('searchInput').value);
  if (state.blind) {
    params.set('blind', '1');
  } else {
    if (el('roleSelect').value) params.set('role', el('roleSelect').value);
    if (el('formSelect').value) params.set('form', el('formSelect').value);
  }
  const data = await getJson('/api/items?' + params.toString());
  state.items = data.items;
  renderItems();
  if (!state.selected && state.items[0]) await selectItem(state.items[0].id);
}

async function selectItem(id) {
  state.selected = id;
  state.selectedLabel = null;
  const params = new URLSearchParams({ id });
  if (state.blind) {
    params.set('blind', '1');
    if (state.labeller) params.set('labeller', state.labeller);
  }
  state.detail = await getJson('/api/item?' + params.toString());
  renderItems();
  renderDetailHead();
  renderPane();
}

async function init() {
  const runs = await getJson('/api/runs');
  state.runs = runs.runs;
  const url = new URL(window.location.href);
  state.blind = url.searchParams.get('mode') === 'label' || url.searchParams.get('blind') === '1';
  state.labeller = (url.searchParams.get('labeller') || '').replace(/[^\\w-]/g, '');
  document.body.classList.toggle('blind', state.blind);
  if (state.blind) {
    el('appTitle').textContent = 'Poetics Human Scoring';
    el('appSub').textContent = 'Blind public-script labelling. Critic scores and held-out keys are hidden.';
    el('searchInput').placeholder = 'Filter by neutral script id';
    el('labellerInput').value = state.labeller;
  } else {
    el('labellerInput').style.display = 'none';
  }
  renderRuns();
  const runId = url.searchParams.get('runId');
  if (runId) el('runSelect').value = runId;
  await loadItems();
  ['runSelect', 'roleSelect', 'formSelect'].forEach((id) => el(id).addEventListener('change', () => { state.selected = null; loadItems(); }));
  el('labellerInput').addEventListener('input', () => { state.labeller = el('labellerInput').value.replace(/[^\\w-]/g, ''); if (state.selected) selectItem(state.selected); });
  el('searchInput').addEventListener('input', () => { clearTimeout(window.__q); window.__q = setTimeout(() => { state.selected = null; loadItems(); }, 160); });
  document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
    state.tab = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
    renderPane();
  }));
}
init().catch((err) => { el('items').innerHTML = '<div class="empty">' + esc(err.message) + '</div>'; });
</script>
</body>
</html>`;
}

function launchUrl(args) {
  const params = new URLSearchParams();
  if (args.runId) params.set('runId', args.runId);
  const query = params.toString();
  return `http://${args.host}:${args.port}${query ? `/?${query}` : ''}`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const app = createPoeticsBrowserApp({ dbPath: args.dbPath });
  const server = app.listen(args.port, args.host, () => {
    const url = launchUrl(args);
    console.log(`poetics script browser: ${url}`);
    if (args.open) exec(`open ${JSON.stringify(url)}`);
  });
  const close = () => {
    app.locals.db?.close();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
}

if (path.resolve(process.argv[1] || '') === __filename) {
  try {
    main();
  } catch (err) {
    console.error(err?.stack || String(err));
    process.exit(1);
  }
}

export { createPoeticsBrowserApp, getBlindItem, getItem, listItems, listRuns, renderBrowserHtml, saveBrowserLabel };
