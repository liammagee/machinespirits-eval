#!/usr/bin/env node

/**
 * Transcript Browser
 *
 * Interactive web app for browsing evaluation runs, scenarios, and dialogue
 * transcripts with sequence diagram + transcript split-pane view.
 *
 * Usage:
 *   node scripts/browse-transcripts.js [--port 3456] [--no-open]
 */

import express from 'express';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { exec } from 'child_process';

const __dirname = import.meta.dirname;
const DB_PATH = path.join(__dirname, '..', 'data', 'evaluations.db');
const LOGS_DIR = path.join(__dirname, '..', 'logs', 'tutor-dialogues');
const LEARNER_CONFIG = path.join(__dirname, '..', 'config', 'learner-agents.yaml');

const args = process.argv.slice(2);
function getOption(name) {
  const idx = args.indexOf('--' + name);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
}

const PORT = parseInt(getOption('port') || '3456');
const shouldOpen = !args.includes('--no-open');

const db = new Database(DB_PATH, { readonly: true });
const app = express();

// ── Learner config cache ────────────────────────────────────────────────────

let learnerConfig = null;
try { learnerConfig = YAML.parse(fs.readFileSync(LEARNER_CONFIG, 'utf8')); } catch {}

function resolvelearnerModels(arch) {
  if (!learnerConfig) return { ego: '?', superego: '?' };
  const prof = learnerConfig.profiles?.[arch] || learnerConfig.profiles?.unified;
  if (prof?.ego) {
    return {
      ego: (prof.ego.provider ? prof.ego.provider + '.' : '') + (prof.ego.model || ''),
      superego: (prof.superego?.provider ? prof.superego.provider + '.' : '') + (prof.superego?.model || ''),
    };
  }
  if (prof?.unified_learner) {
    const m = (prof.unified_learner.provider ? prof.unified_learner.provider + '.' : '') + (prof.unified_learner.model || '');
    return { ego: m, superego: m };
  }
  return { ego: '?', superego: '?' };
}

// ── API endpoints ───────────────────────────────────────────────────────────

app.get('/api/runs', (req, res) => {
  const rows = db.prepare(`
    SELECT run_id,
      COUNT(*) as dialogue_count,
      MIN(overall_score) as min_score,
      MAX(overall_score) as max_score,
      GROUP_CONCAT(DISTINCT profile_name) as profiles,
      GROUP_CONCAT(DISTINCT ego_model) as ego_models,
      MIN(created_at) as first_created
    FROM evaluation_results
    WHERE dialogue_id IS NOT NULL AND overall_score IS NOT NULL
    GROUP BY run_id
    ORDER BY first_created DESC
  `).all();

  const runs = rows.map(r => {
    const profiles = (r.profiles || '').split(',');
    const cells = [...new Set(profiles.map(p => p.replace(/^cell_(\d+)_.*/, '$1')))].sort((a,b) => a-b);
    return {
      runId: r.run_id,
      date: r.run_id.replace(/^eval-/, '').replace(/-[a-f0-9]+$/, ''),
      dialogueCount: r.dialogue_count,
      cellRange: cells.length > 0 ? cells[0] + '-' + cells[cells.length - 1] : '',
      scoreRange: [r.min_score?.toFixed(0), r.max_score?.toFixed(0)].join('-'),
      egoModels: [...new Set((r.ego_models || '').split(','))].map(shortModel).join(', '),
    };
  });
  res.json(runs);
});

app.get('/api/runs/:runId', (req, res) => {
  const rows = db.prepare(`
    SELECT id, dialogue_id, profile_name, scenario_id, overall_score,
      ego_model, judge_model, learner_architecture, superego_model,
      factor_recognition
    FROM evaluation_results
    WHERE run_id = ? AND dialogue_id IS NOT NULL AND overall_score IS NOT NULL
    ORDER BY profile_name, scenario_id, overall_score DESC
  `).all(req.params.runId);

  const dialogues = rows.map(r => ({
    dialogueId: r.dialogue_id,
    profile: r.profile_name,
    scenario: r.scenario_id,
    score: r.overall_score,
    egoModel: r.ego_model,
    judgeModel: r.judge_model,
    isRecog: !!r.factor_recognition || /recog/i.test(r.profile_name),
    learnerArch: r.learner_architecture,
  }));
  res.json(dialogues);
});

app.get('/api/dialogue/:dialogueId', (req, res) => {
  const row = db.prepare(`
    SELECT id, run_id, profile_name, scenario_id, dialogue_id, overall_score,
      ego_model, superego_model, judge_model, learner_architecture,
      score_relevance, score_specificity, score_pedagogical, score_personalization,
      score_actionability, score_tone, scores_with_reasoning,
      qualitative_assessment, qualitative_model, factor_recognition
    FROM evaluation_results
    WHERE dialogue_id = ? AND overall_score IS NOT NULL
    ORDER BY id DESC LIMIT 1
  `).get(req.params.dialogueId);

  if (!row) return res.status(404).json({ error: 'Dialogue not found' });

  // Load trace from log file
  let trace = [];
  let logMeta = {};
  try {
    const files = fs.readdirSync(LOGS_DIR).filter(f => f.includes(req.params.dialogueId));
    if (files.length > 0) {
      const log = JSON.parse(fs.readFileSync(path.join(LOGS_DIR, files[0]), 'utf8'));
      trace = log.consolidatedTrace || log.dialogueTrace || [];
      logMeta = {
        totalTurns: log.totalTurns,
        learnerArchitecture: log.learnerArchitecture,
      };
    }
  } catch {}

  const learnerModels = resolvelearnerModels(row.learner_architecture || logMeta.learnerArchitecture || 'unified');

  let judgeScores = {};
  try { judgeScores = JSON.parse(row.scores_with_reasoning || '{}'); } catch {}
  let qualitative = {};
  try { qualitative = JSON.parse(row.qualitative_assessment || '{}'); } catch {}

  res.json({
    trace,
    metadata: {
      runId: row.run_id,
      dialogueId: row.dialogue_id,
      profile: row.profile_name,
      scenario: row.scenario_id,
      egoModel: row.ego_model,
      superegoModel: row.superego_model,
      judgeModel: row.judge_model,
      learnerArch: row.learner_architecture || logMeta.learnerArchitecture || '',
      learnerEgoModel: learnerModels.ego,
      learnerSuperegoModel: learnerModels.superego,
      totalTurns: logMeta.totalTurns || '',
      isRecog: !!row.factor_recognition || /recog/i.test(row.profile_name),
    },
    scores: {
      overall: row.overall_score,
      dimensions: judgeScores,
    },
    qualitative,
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function shortModel(m) {
  if (!m) return '?';
  return String(m).replace(/^openrouter\./, '').split('/').pop().split(':')[0];
}

// ── Serve inline HTML page ──────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.type('html').send(PAGE_HTML);
});

// ── Page HTML ───────────────────────────────────────────────────────────────

const PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Transcript Browser</title>
<style>
  :root { --bg:#0d1117; --surface:#161b22; --border:#30363d; --text:#e6edf3; --muted:#8b949e; --accent:#58a6ff; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'SF Mono','Fira Code','JetBrains Mono',monospace; background:var(--bg); color:var(--text); height:100vh; overflow:hidden; display:flex; }

  /* ── Sidebar ── */
  .sidebar { width:280px; flex-shrink:0; border-right:1px solid var(--border); display:flex; flex-direction:column; background:var(--surface); overflow:hidden; }
  .sidebar-header { padding:14px 16px 10px; border-bottom:1px solid var(--border); flex-shrink:0; }
  .sidebar-header h1 { font-size:13px; font-weight:700; letter-spacing:0.5px; margin-bottom:8px; }
  .filter-row { display:flex; gap:6px; margin-bottom:6px; }
  .filter-input { flex:1; background:#0d1117; border:1px solid var(--border); border-radius:4px; padding:4px 8px; color:var(--text); font-size:11px; font-family:inherit; outline:none; }
  .filter-input:focus { border-color:var(--accent); }
  .filter-toggles { display:flex; gap:8px; font-size:10px; color:var(--muted); }
  .filter-toggles label { cursor:pointer; display:flex; align-items:center; gap:3px; }
  .filter-toggles input { accent-color:var(--accent); }
  .sidebar-list { flex:1; overflow-y:auto; padding:4px 0; }

  .run-item { padding:6px 16px; cursor:pointer; font-size:11px; border-bottom:1px solid #1c2128; }
  .run-item:hover { background:rgba(255,255,255,0.03); }
  .run-item.open { background:rgba(88,166,255,0.06); }
  .run-header { display:flex; justify-content:space-between; align-items:center; }
  .run-date { font-weight:600; color:var(--text); }
  .run-count { color:var(--muted); font-size:10px; }
  .run-models { font-size:9px; color:#555; margin-top:2px; }
  .run-children { padding-left:8px; display:none; }
  .run-item.open > .run-children { display:block; }

  .cell-group { margin:2px 0; }
  .cell-label { font-size:10px; font-weight:600; color:var(--muted); padding:4px 8px 2px; cursor:pointer; }
  .cell-label:hover { color:var(--text); }
  .cell-dialogues { display:none; }
  .cell-group.open > .cell-dialogues { display:block; }

  .dlg-item { padding:3px 8px 3px 16px; cursor:pointer; font-size:10px; display:flex; justify-content:space-between; align-items:center; border-radius:3px; }
  .dlg-item:hover { background:rgba(255,255,255,0.04); }
  .dlg-item.active { background:rgba(88,166,255,0.12); color:#fff; }
  .dlg-scenario { color:#aaa; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .dlg-score { font-weight:700; margin-left:6px; padding:1px 5px; border-radius:8px; font-size:9px; }
  .score-high { background:rgba(76,175,80,0.2); color:#66bb6a; }
  .score-mid { background:rgba(255,152,0,0.2); color:#ffa726; }
  .score-low { background:rgba(244,67,54,0.2); color:#ef5350; }
  .recog-dot { width:6px; height:6px; border-radius:50%; background:#7c4dff; display:inline-block; margin-right:4px; flex-shrink:0; }
  .base-dot { width:6px; height:6px; border-radius:50%; background:#555; display:inline-block; margin-right:4px; flex-shrink:0; }

  /* ── Main content ── */
  .main { flex:1; display:flex; flex-direction:column; overflow:hidden; }
  .top-bar { padding:10px 20px; border-bottom:1px solid var(--border); background:var(--surface); display:flex; align-items:center; justify-content:space-between; flex-shrink:0; gap:16px; min-height:60px; }
  .top-bar h2 { font-size:13px; font-weight:600; }
  .meta-grid { display:grid; grid-template-columns:auto auto auto; gap:1px 14px; font-size:10px; }
  .meta-label { color:var(--muted); }
  .meta-value { color:var(--text); font-weight:500; }
  .meta-id { font-size:9px; color:#555; margin-top:2px; }
  .score-badge { padding:3px 12px; border-radius:12px; font-weight:700; font-size:14px; color:#fff; }

  .legend { display:flex; gap:12px; justify-content:center; padding:6px; font-size:9px; color:var(--muted); flex-shrink:0; border-bottom:1px solid var(--border); }
  .legend span { display:flex; align-items:center; gap:3px; }
  .legend .sw { width:12px; height:3px; border-radius:2px; }

  .split { display:flex; flex:1; overflow:hidden; }

  .left-pane { width:50%; overflow:auto; border-right:1px solid var(--border); padding:12px; flex-shrink:0; }
  .left-pane svg { display:block; margin:0 auto; }
  svg text { font-family:'SF Mono','Fira Code',monospace; }
  .arrow-group { cursor:pointer; }
  .arrow-group:hover .arrow-line { stroke-width:3 !important; }
  .arrow-group.active .arrow-line { stroke-width:3.5 !important; filter:drop-shadow(0 0 4px currentColor); }
  .arrow-group.active text { font-weight:700 !important; }

  .right-pane { width:50%; overflow-y:auto; padding:12px 16px; }

  .entry { padding:10px 12px; margin:4px 0; border-radius:6px; border:1px solid transparent; cursor:pointer; transition:all 0.15s; }
  .entry:hover { background:rgba(255,255,255,0.03); border-color:var(--border); }
  .entry.active { background:rgba(88,166,255,0.08); border-color:#58a6ff; box-shadow:0 0 12px rgba(88,166,255,0.15); }
  .entry-speaker { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; display:flex; align-items:center; gap:6px; }
  .entry-model { font-weight:400; color:var(--muted); font-size:9px; }
  .entry-content { font-size:12px; line-height:1.6; color:#ccc; white-space:pre-wrap; word-wrap:break-word; }

  .badge { font-size:9px; padding:1px 6px; border-radius:8px; font-weight:600; }
  .badge.approved { background:rgba(102,187,106,0.2); color:#66bb6a; }
  .badge.revise { background:rgba(255,112,67,0.2); color:#ff7043; }

  /* Judge panel */
  .judge-panel { flex-shrink:0; border-top:1px solid var(--border); background:var(--surface); }
  .judge-toggle { padding:10px 20px; cursor:pointer; font-size:11px; text-transform:uppercase; letter-spacing:1.5px; color:var(--muted); font-weight:600; list-style:none; user-select:none; }
  .judge-toggle::-webkit-details-marker { display:none; }
  .judge-toggle::before { content:'\\25B8 '; }
  .judge-panel[open] .judge-toggle::before { content:'\\25BE '; }
  .judge-body { padding:4px 20px 16px; max-height:45vh; overflow-y:auto; }
  table.judge-table { width:100%; border-collapse:collapse; font-size:11px; }
  table.judge-table tr { border-bottom:1px solid #1e1e1e; }
  .jd { padding:5px 8px; font-weight:500; white-space:nowrap; color:#ccc; }
  .js { padding:5px 6px; text-align:center; font-weight:700; }
  .jb { padding:5px 8px; }
  .jr { padding:5px 8px; color:var(--muted); font-size:10px; }
  .bar-bg { background:#262626; border-radius:3px; height:5px; width:80px; }
  .bar-fg { border-radius:3px; height:5px; }

  .qual-item { margin-bottom:12px; }
  .qual-label { font-weight:600; color:#90caf9; font-size:11px; margin-bottom:3px; }
  .qual-text { color:#aaa; font-size:11px; line-height:1.6; }
  .qual-ktp { margin:12px 0; padding:10px; background:#1a237e; border-radius:6px; }
  .qual-tags { margin-top:8px; }
  .tag { display:inline-block; padding:2px 8px; margin:2px; border-radius:10px; font-size:10px; font-weight:600; background:#263238; color:#80cbc4; }

  /* Empty state */
  .empty-state { display:flex; align-items:center; justify-content:center; flex:1; color:var(--muted); font-size:12px; flex-direction:column; gap:8px; }
  .empty-state .hint { font-size:10px; color:#444; }

  /* Loading */
  .loading { color:var(--muted); font-size:11px; padding:12px 16px; }
</style>
</head>
<body>

<div class="sidebar">
  <div class="sidebar-header">
    <h1>Transcript Browser</h1>
    <div class="filter-row">
      <input class="filter-input" id="searchFilter" type="text" placeholder="Filter runs/cells..." oninput="applyFilter()">
    </div>
    <div class="filter-toggles">
      <label><input type="radio" name="condFilter" value="all" checked onchange="applyFilter()"> All</label>
      <label><input type="radio" name="condFilter" value="recog" onchange="applyFilter()"> Recog</label>
      <label><input type="radio" name="condFilter" value="base" onchange="applyFilter()"> Base</label>
    </div>
  </div>
  <div class="sidebar-list" id="sidebarList">
    <div class="loading">Loading runs...</div>
  </div>
</div>

<div class="main">
  <div class="top-bar" id="topBar">
    <div class="empty-state">
      <div>Select a dialogue from the sidebar</div>
      <div class="hint">j/k or arrow keys to navigate steps</div>
    </div>
  </div>

  <div class="legend" id="legendBar" style="display:none">
    <span><span class="sw" style="background:#78909c"></span> Front stage</span>
    <span><span class="sw" style="background:#ef5350"></span> L.Superego</span>
    <span><span class="sw" style="background:#ab47bc"></span> L.Ego</span>
    <span><span class="sw" style="background:#42a5f5"></span> T.Ego</span>
    <span><span class="sw" style="background:#66bb6a"></span> T.Superego</span>
  </div>

  <div class="split" id="splitPane" style="display:none">
    <div class="left-pane" id="leftPane"></div>
    <div class="right-pane" id="rightPane"></div>
  </div>

  <div id="judgePanel"></div>
</div>

<script>
// ── State ────────────────────────────────────────────────────────────────────
let allRuns = [];
let runDialogues = {};  // runId → dialogue list
let activeDialogueId = null;
let activeStep = -1;
let totalSteps = 0;

// ── Helpers ──────────────────────────────────────────────────────────────────
function escapeHtml(t) {
  if (!t) return '';
  return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function shortModel(m) {
  if (!m) return '?';
  return String(m).replace(/^openrouter\\./, '').split('/').pop().split(':')[0];
}
function scoreClass(s) { return s >= 85 ? 'score-high' : s >= 65 ? 'score-mid' : 'score-low'; }
function scoreBg(s) { return s >= 90 ? '#1b5e20' : s >= 70 ? '#e65100' : '#b71c1c'; }

// ── Sidebar: load runs ──────────────────────────────────────────────────────
async function loadRuns() {
  const res = await fetch('/api/runs');
  allRuns = await res.json();
  renderSidebar();
}

function renderSidebar() {
  const list = document.getElementById('sidebarList');
  const search = (document.getElementById('searchFilter').value || '').toLowerCase();
  const cond = document.querySelector('input[name="condFilter"]:checked')?.value || 'all';

  let html = '';
  for (const run of allRuns) {
    const label = run.date + ' N=' + run.dialogueCount;
    if (search && !label.toLowerCase().includes(search) && !run.runId.toLowerCase().includes(search) && !run.egoModels.toLowerCase().includes(search)) {
      // Check if any loaded dialogues match
      const dlgs = runDialogues[run.runId];
      if (!dlgs || !dlgs.some(d => matchesFilter(d, search, cond))) continue;
    }
    const isOpen = runDialogues[run.runId] !== undefined;
    html += '<div class="run-item' + (isOpen ? ' open' : '') + '" data-run="' + escapeHtml(run.runId) + '">';
    html += '<div class="run-header" onclick="toggleRun(\\'' + escapeHtml(run.runId) + '\\')">';
    html += '<span class="run-date">' + escapeHtml(run.date) + '</span>';
    html += '<span class="run-count">N=' + run.dialogueCount + ' cells ' + escapeHtml(run.cellRange) + '</span>';
    html += '</div>';
    html += '<div class="run-models">' + escapeHtml(run.egoModels) + ' (' + escapeHtml(run.scoreRange) + ')</div>';
    html += '<div class="run-children" id="run-' + escapeHtml(run.runId) + '">';
    if (isOpen) html += renderRunChildren(run.runId, search, cond);
    html += '</div></div>';
  }
  if (!html) html = '<div class="loading">No matching runs</div>';
  list.innerHTML = html;
}

function matchesFilter(d, search, cond) {
  if (cond === 'recog' && !d.isRecog) return false;
  if (cond === 'base' && d.isRecog) return false;
  if (search && !d.profile.toLowerCase().includes(search) && !d.scenario.toLowerCase().includes(search)) return false;
  return true;
}

function renderRunChildren(runId, search, cond) {
  const dlgs = runDialogues[runId];
  if (!dlgs) return '';

  // Group by profile
  const byProfile = {};
  for (const d of dlgs) {
    if (!matchesFilter(d, search, cond)) continue;
    (byProfile[d.profile] = byProfile[d.profile] || []).push(d);
  }

  let html = '';
  for (const [profile, items] of Object.entries(byProfile)) {
    const isRecog = items[0]?.isRecog;
    const cellNum = profile.replace(/^cell_(\\d+)_.*/, '$1');
    html += '<div class="cell-group open">';
    html += '<div class="cell-label" onclick="this.parentElement.classList.toggle(\\'open\\')">';
    html += '<span class="' + (isRecog ? 'recog-dot' : 'base-dot') + '"></span>';
    html += escapeHtml(profile) + ' (' + items.length + ')';
    html += '</div>';
    html += '<div class="cell-dialogues">';
    for (const d of items) {
      const sc = d.score?.toFixed(0) || '--';
      const scn = d.scenario.replace(/_/g, ' ').substring(0, 25);
      const isActive = d.dialogueId === activeDialogueId;
      html += '<div class="dlg-item' + (isActive ? ' active' : '') + '" onclick="loadDialogue(\\'' + escapeHtml(d.dialogueId) + '\\')">';
      html += '<span class="dlg-scenario">' + escapeHtml(scn) + '</span>';
      html += '<span class="dlg-score ' + scoreClass(d.score) + '">' + sc + '</span>';
      html += '</div>';
    }
    html += '</div></div>';
  }
  return html;
}

async function toggleRun(runId) {
  if (runDialogues[runId]) {
    delete runDialogues[runId];
    renderSidebar();
    return;
  }
  const el = document.getElementById('run-' + runId);
  if (el) el.innerHTML = '<div class="loading">Loading...</div>';

  const res = await fetch('/api/runs/' + encodeURIComponent(runId));
  runDialogues[runId] = await res.json();
  renderSidebar();
}

function applyFilter() { renderSidebar(); }

// ── Load and render a dialogue ──────────────────────────────────────────────
async function loadDialogue(dialogueId) {
  activeDialogueId = dialogueId;
  activeStep = -1;

  // Update sidebar active state
  document.querySelectorAll('.dlg-item').forEach(el => el.classList.remove('active'));
  const clicked = document.querySelector('.dlg-item[onclick*="' + dialogueId + '"]');
  if (clicked) clicked.classList.add('active');

  const res = await fetch('/api/dialogue/' + encodeURIComponent(dialogueId));
  const data = await res.json();

  const steps = traceToSteps(data.trace);
  totalSteps = steps.length;

  renderTopBar(data);
  renderDiagram(steps, data.metadata);
  renderTranscript(steps);
  renderJudgePanel(data.scores, data.qualitative);

  document.getElementById('legendBar').style.display = 'flex';
  document.getElementById('splitPane').style.display = 'flex';
}

// ── Top bar ─────────────────────────────────────────────────────────────────
function renderTopBar(data) {
  const m = data.metadata;
  const score = data.scores.overall?.toFixed(1) || '--';
  const condLabel = m.isRecog ? 'Recognition' : 'Base';
  const scenario = (m.scenario || '').replace(/_/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase());

  document.getElementById('topBar').innerHTML =
    '<div>' +
      '<h2>' + escapeHtml(scenario) + '</h2>' +
      '<div class="meta-grid">' +
        '<span class="meta-label">Cell</span><span class="meta-value">' + escapeHtml(m.profile) + '</span><span class="meta-value">' + condLabel + (m.totalTurns ? ' · ' + m.totalTurns + ' turns' : '') + '</span>' +
        '<span class="meta-label">Tutor</span><span class="meta-value">ego ' + escapeHtml(shortModel(m.egoModel)) + '</span><span class="meta-value">superego ' + escapeHtml(shortModel(m.superegoModel) || shortModel(m.egoModel)) + '</span>' +
        '<span class="meta-label">Learner</span><span class="meta-value">ego ' + escapeHtml(shortModel(m.learnerEgoModel)) + '</span><span class="meta-value">superego ' + escapeHtml(shortModel(m.learnerSuperegoModel)) + '</span>' +
        '<span class="meta-label">Judge</span><span class="meta-value">' + escapeHtml(shortModel(m.judgeModel)) + '</span><span></span>' +
      '</div>' +
      '<div class="meta-id">' + escapeHtml(m.runId) + ' · ' + escapeHtml(m.dialogueId) + '</div>' +
    '</div>' +
    '<span class="score-badge" style="background:' + scoreBg(parseFloat(score)) + '">' + score + '</span>';
}

// ── Trace → Steps (ported from render-sequence-diagram.js) ──────────────────
function extractLearnerQuery(entry) {
  const raw = entry.rawContext || '';
  const match = raw.match(/Learner Messages?:\\s*(.+?)(?:\\n<\\/|$)/s)
    || raw.match(/Recent Chat History\\n-\\s*User:\\s*"(.+?)"/s);
  return match ? match[1].trim() : null;
}

function fullContent(entry) {
  if (entry.agent === 'superego' && entry.action === 'review') {
    return entry.feedback || entry.verdict?.feedback || '';
  }
  if (entry.suggestions?.length > 0) {
    return entry.suggestions.map(s => s.message || s.text || s.title || '').join('\\n\\n');
  }
  if (entry.agent === 'user' && entry.action === 'context_input') {
    return extractLearnerQuery(entry) || '(scenario context)';
  }
  if (entry.agent === 'user' && entry.action === 'turn_action') {
    return entry.contextSummary || entry.detail || '';
  }
  return entry.detail || entry.contextSummary || '';
}

function snippet(entry, maxLen) {
  return fullContent(entry).substring(0, maxLen || 90);
}

function traceToSteps(trace) {
  const steps = [];
  let dialogueTurn = 0;

  const learnerBlockStarts = new Set();
  trace.forEach((e, i) => { if (e.agent === 'learner_ego_initial') learnerBlockStarts.add(i); });

  let needsResponseArrow = false;

  for (let i = 0; i < trace.length; i++) {
    const e = trace[i];
    const { agent, action } = e;

    if (learnerBlockStarts.has(i) && needsResponseArrow) {
      let responseContent = '';
      for (let j = i - 1; j >= 0; j--) {
        const prev = trace[j];
        if (prev.agent === 'ego' && (prev.action === 'generate' || prev.action === 'revise' || prev.action === 'incorporate-feedback')) {
          responseContent = fullContent(prev);
          break;
        }
      }
      steps.push({ from: 'tutor_ego', to: 'learner_ego', label: 'Response', detail: '', fullDetail: responseContent, type: 'response', speaker: 'TUTOR EGO' });
      needsResponseArrow = false;
    }

    if (agent === 'system') continue;
    if (agent === 'user' && action === 'final_output') continue;
    if (agent === 'learner_synthesis') continue;

    if (agent === 'user' && action === 'context_input') {
      dialogueTurn++;
      if (dialogueTurn === 1) {
        const query = extractLearnerQuery(e);
        const full = query || '(scenario prompt)';
        steps.push({ from: 'learner_ego', to: 'tutor_ego', label: 'Initial query', detail: full.substring(0, 120), fullDetail: full, type: 'front', speaker: 'LEARNER' });
      }
      needsResponseArrow = true;
      continue;
    }

    if (agent === 'ego' && (action === 'generate' || action === 'revise' || action === 'incorporate-feedback')) {
      const full = fullContent(e);
      let superegoFollows = false;
      for (let j = i + 1; j < trace.length; j++) {
        if (trace[j].agent === 'superego' && trace[j].action === 'review') { superegoFollows = true; break; }
        if (learnerBlockStarts.has(j)) break;
        if (trace[j].agent === 'user' && trace[j].action === 'context_input') break;
      }

      if (action !== 'generate' && !superegoFollows) {
        steps.push({ from: 'tutor_ego', to: 'learner_ego', label: 'Response', detail: '', fullDetail: full, type: 'response', latency: e.metrics?.latencyMs || null, speaker: 'TUTOR EGO', model: e.metrics?.model || null });
        needsResponseArrow = false;
      } else {
        const label = action === 'generate' ? 'Draft' : 'Revised';
        steps.push({ from: 'tutor_ego', to: 'tutor_superego', label, detail: snippet(e, 120), fullDetail: full, type: 'back', latency: e.metrics?.latencyMs || null, speaker: action === 'generate' ? 'TUTOR EGO (draft)' : 'TUTOR EGO (revised)', model: e.metrics?.model || null });
      }
      continue;
    }

    if (agent === 'superego' && action === 'review') {
      const approved = e.approved;
      const full = fullContent(e);
      if (approved) {
        steps.push({ from: 'tutor_superego', to: 'tutor_ego', label: 'Approved \\u2713', detail: snippet(e, 120), fullDetail: full, type: 'back', approved: true, latency: e.metrics?.latencyMs || null, speaker: 'SUPEREGO', model: e.metrics?.model || null });
        let responseContent = '';
        for (let j = i - 1; j >= 0; j--) {
          const prev = trace[j];
          if (prev.agent === 'ego' && (prev.action === 'generate' || prev.action === 'revise' || prev.action === 'incorporate-feedback')) {
            responseContent = fullContent(prev);
            break;
          }
        }
        steps.push({ from: 'tutor_ego', to: 'learner_ego', label: 'Response', detail: '', fullDetail: responseContent, type: 'response', speaker: 'TUTOR EGO' });
        needsResponseArrow = false;
      } else {
        steps.push({ from: 'tutor_superego', to: 'tutor_ego', label: 'Revise \\u21BB', detail: snippet(e, 120), fullDetail: full, type: 'back', approved: false, latency: e.metrics?.latencyMs || null, speaker: 'SUPEREGO', model: e.metrics?.model || null });
      }
      continue;
    }

    if (agent === 'learner_ego_initial' && action === 'deliberation') {
      const full = fullContent(e);
      steps.push({ from: 'learner_ego', to: 'learner_superego', label: 'Reaction', detail: snippet(e, 120), fullDetail: full, type: 'back', speaker: 'LEARNER EGO' });
      continue;
    }

    if (agent === 'learner_superego' && action === 'deliberation') {
      const full = fullContent(e);
      steps.push({ from: 'learner_superego', to: 'learner_ego', label: 'Critique', detail: snippet(e, 120), fullDetail: full, type: 'back', speaker: 'LEARNER SUPEREGO' });
      continue;
    }

    if (agent === 'learner_ego_revision') continue;

    if (agent === 'user' && action === 'turn_action') {
      const full = fullContent(e);
      steps.push({ from: 'learner_ego', to: 'tutor_ego', label: 'Turn ' + (dialogueTurn + 1), detail: snippet(e, 120), fullDetail: full, type: 'front', speaker: 'LEARNER' });
      needsResponseArrow = true;
      continue;
    }
  }
  return steps;
}

// ── SVG diagram ─────────────────────────────────────────────────────────────
function renderDiagram(steps, meta) {
  const actors = [
    { id: 'learner_superego', label: 'L.Superego', model: shortModel(meta.learnerSuperegoModel), color: '#fce4ec', textColor: '#c62828', stroke: '#ef5350' },
    { id: 'learner_ego', label: 'L.Ego', model: shortModel(meta.learnerEgoModel), color: '#f3e5f5', textColor: '#6a1b9a', stroke: '#ab47bc' },
    { id: 'tutor_ego', label: 'T.Ego', model: shortModel(meta.egoModel), color: '#e3f2fd', textColor: '#1565c0', stroke: '#42a5f5' },
    { id: 'tutor_superego', label: 'T.Superego', model: shortModel(meta.superegoModel), color: '#e8f5e9', textColor: '#2e7d32', stroke: '#66bb6a' },
  ];
  const colMap = {};
  actors.forEach((a, i) => { colMap[a.id] = i; });

  const colWidth = 140;
  const rowHeight = 38;
  const headerHeight = 56;
  const padding = 20;
  const svgWidth = colWidth * actors.length + padding * 2;
  const svgHeight = headerHeight + steps.length * rowHeight + 30;

  let svg = '';

  // Actor headers
  actors.forEach((a, i) => {
    const x = padding + i * colWidth;
    const cx = x + colWidth / 2;
    svg += '<rect x="' + (x+8) + '" y="4" width="' + (colWidth-16) + '" height="40" rx="5" fill="' + a.color + '" stroke="' + a.stroke + '" stroke-width="1"/>';
    svg += '<text x="' + cx + '" y="21" text-anchor="middle" font-size="11" font-weight="600" fill="' + a.textColor + '">' + a.label + '</text>';
    svg += '<text x="' + cx + '" y="36" text-anchor="middle" font-size="8.5" fill="' + a.textColor + '" opacity="0.65">' + a.model + '</text>';
    svg += '<line x1="' + cx + '" y1="' + headerHeight + '" x2="' + cx + '" y2="' + (svgHeight-10) + '" stroke="#333" stroke-width="1" stroke-dasharray="3,3"/>';
  });

  // Turn separators
  let prevTurn = '';
  steps.forEach((s, i) => {
    if (s.label.startsWith('Turn ') || s.label === 'Initial query') {
      const num = s.label === 'Initial query' ? 1 : parseInt(s.label.replace('Turn ', ''));
      if (num !== prevTurn) {
        const y = headerHeight + i * rowHeight;
        svg += '<line x1="' + padding + '" y1="' + y + '" x2="' + (svgWidth-padding) + '" y2="' + y + '" stroke="#444" stroke-width="0.5"/>';
        svg += '<text x="' + (svgWidth-padding+3) + '" y="' + (y+12) + '" font-size="9" fill="#666" font-weight="600">T' + num + '</text>';
        prevTurn = num;
      }
    }
  });

  // Arrows
  steps.forEach((step, i) => {
    const fromCol = colMap[step.from];
    const toCol = colMap[step.to];
    if (fromCol === undefined || toCol === undefined) return;

    const fromX = padding + fromCol * colWidth + colWidth / 2;
    const toX = padding + toCol * colWidth + colWidth / 2;
    const y = headerHeight + i * rowHeight + rowHeight / 2;
    const isLR = fromX < toX;

    let color;
    if (step.type === 'front' || step.type === 'response') { color = '#78909c'; }
    else { color = actors[fromCol].stroke; }

    const sw = (step.type === 'front' || step.type === 'response') ? 2.2 : 1.2;
    const tipOff = isLR ? -6 : 6;

    svg += '<g data-step="' + i + '" class="arrow-group" onclick="highlight(' + i + ')">';
    svg += '<line x1="' + fromX + '" y1="' + y + '" x2="' + toX + '" y2="' + y + '" stroke="transparent" stroke-width="20"/>';
    svg += '<line x1="' + fromX + '" y1="' + y + '" x2="' + (toX+tipOff) + '" y2="' + y + '" stroke="' + color + '" stroke-width="' + sw + '" class="arrow-line"/>';

    if (isLR) {
      svg += '<polygon points="' + (toX-6) + ',' + (y-3.5) + ' ' + toX + ',' + y + ' ' + (toX-6) + ',' + (y+3.5) + '" fill="' + color + '"/>';
    } else {
      svg += '<polygon points="' + (toX+6) + ',' + (y-3.5) + ' ' + toX + ',' + y + ' ' + (toX+6) + ',' + (y+3.5) + '" fill="' + color + '"/>';
    }

    const labelX = (fromX + toX) / 2;
    let labelColor = '#bbb';
    if (step.approved === true) labelColor = '#66bb6a';
    if (step.approved === false) labelColor = '#ff7043';

    svg += '<text x="' + labelX + '" y="' + (y-6) + '" text-anchor="middle" font-size="9.5" font-weight="500" fill="' + labelColor + '">' + escapeHtml(step.label) + '</text>';
    if (step.latency) {
      const lat = step.latency < 1000 ? step.latency + 'ms' : (step.latency / 1000).toFixed(1) + 's';
      svg += '<text x="' + labelX + '" y="' + (y+13) + '" text-anchor="middle" font-size="8" fill="#555">' + lat + '</text>';
    }
    svg += '</g>';
  });

  document.getElementById('leftPane').innerHTML =
    '<svg width="' + (svgWidth+20) + '" height="' + svgHeight + '" xmlns="http://www.w3.org/2000/svg">' + svg + '</svg>';
}

// ── Transcript ──────────────────────────────────────────────────────────────
const speakerColors = {
  'TUTOR EGO': '#42a5f5', 'TUTOR EGO (draft)': '#42a5f5', 'TUTOR EGO (revised)': '#42a5f5',
  'SUPEREGO': '#66bb6a', 'LEARNER EGO': '#ab47bc', 'LEARNER SUPEREGO': '#ef5350',
  'LEARNER': '#78909c',
};

function renderTranscript(steps) {
  let html = '';
  steps.forEach((step, i) => {
    const speaker = step.speaker || step.label;
    const color = speakerColors[speaker] || '#999';
    const content = step.fullDetail || step.detail || '';
    if (!content && step.type === 'response') return;

    let badge = '';
    if (step.approved === true) badge = '<span class="badge approved">APPROVED</span>';
    else if (step.approved === false) badge = '<span class="badge revise">REVISE</span>';

    const modelStr = step.model ? '<span class="entry-model">' + escapeHtml(String(step.model).split('/').pop().split(':')[0]) + '</span>' : '';

    html += '<div class="entry" id="entry-' + i + '" data-step="' + i + '" onclick="highlight(' + i + ')">' +
      '<div class="entry-speaker" style="color:' + color + '">' + escapeHtml(speaker) + ' ' + badge + ' ' + modelStr + '</div>' +
      '<div class="entry-content">' + escapeHtml(content) + '</div>' +
    '</div>';
  });
  document.getElementById('rightPane').innerHTML = html;
}

// ── Judge panel ─────────────────────────────────────────────────────────────
function renderJudgePanel(scores, qualitative) {
  if (!scores?.dimensions && !qualitative) {
    document.getElementById('judgePanel').innerHTML = '';
    return;
  }

  let judgeRows = '';
  if (scores?.dimensions) {
    for (const [dim, data] of Object.entries(scores.dimensions)) {
      const label = dim.replace(/_/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase());
      const sv = data.score || 0;
      const reasoning = escapeHtml(data.reasoning || '');
      const barW = (sv / 5) * 100;
      const barC = sv >= 4 ? '#4caf50' : sv >= 3 ? '#ff9800' : '#f44336';
      judgeRows += '<tr><td class="jd">' + label + '</td><td class="js" style="color:' + barC + '">' + sv + '</td>' +
        '<td class="jb"><div class="bar-bg"><div class="bar-fg" style="width:' + barW + '%;background:' + barC + '"></div></div></td>' +
        '<td class="jr">' + reasoning + '</td></tr>';
    }
  }

  let qualHtml = '';
  const axes = [
    ['pedagogical_arc', 'Pedagogical Arc'], ['recognition_dynamics', 'Recognition Dynamics'],
    ['superego_effectiveness', 'Superego Effectiveness'], ['learner_trajectory', 'Learner Trajectory'],
    ['missed_opportunities', 'Missed Opportunities'], ['overall_narrative', 'Overall Narrative'],
  ];
  for (const [k, lab] of axes) {
    if (qualitative && qualitative[k]) {
      qualHtml += '<div class="qual-item"><div class="qual-label">' + lab + '</div><div class="qual-text">' + escapeHtml(qualitative[k]) + '</div></div>';
    }
  }
  if (qualitative?.key_turning_point) {
    const ktp = qualitative.key_turning_point;
    qualHtml += '<div class="qual-ktp"><div class="qual-label" style="color:#ffab40">Key Turning Point (Turn ' + (ktp.turn || '?') + ')</div><div class="qual-text">' + escapeHtml(ktp.description || '') + '</div></div>';
  }
  if (qualitative?.tags?.length) {
    qualHtml += '<div class="qual-tags">' + qualitative.tags.map(t => '<span class="tag">' + escapeHtml(t) + '</span>').join('') + '</div>';
  }

  const scoreStr = scores?.overall?.toFixed(1) || '--';
  document.getElementById('judgePanel').innerHTML =
    '<details class="judge-panel">' +
    '<summary class="judge-toggle">Judge Adjudication — ' + scoreStr + '/100</summary>' +
    '<div class="judge-body">' +
      (judgeRows ? '<table class="judge-table">' + judgeRows + '</table>' : '') +
      (qualHtml ? '<div style="margin-top:16px">' + qualHtml + '</div>' : '') +
    '</div></details>';
}

// ── Highlight / keyboard nav ────────────────────────────────────────────────
function highlight(idx) {
  document.querySelectorAll('.arrow-group.active').forEach(g => g.classList.remove('active'));
  document.querySelectorAll('.entry.active').forEach(e => e.classList.remove('active'));

  const arrow = document.querySelector('.arrow-group[data-step="' + idx + '"]');
  const entry = document.getElementById('entry-' + idx);
  if (arrow) arrow.classList.add('active');
  if (entry) {
    entry.classList.add('active');
    entry.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  if (arrow) {
    const rect = arrow.getBoundingClientRect();
    const pane = document.querySelector('.left-pane');
    const paneRect = pane.getBoundingClientRect();
    if (rect.top < paneRect.top + 60 || rect.bottom > paneRect.bottom - 20) {
      const y = pane.scrollTop + rect.top - paneRect.top - paneRect.height / 2;
      pane.scrollTo({ top: y, behavior: 'smooth' });
    }
  }
  activeStep = idx;
}

document.addEventListener('keydown', e => {
  if (!totalSteps) return;
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); highlight(Math.min(activeStep + 1, totalSteps - 1)); }
  if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); highlight(Math.max(activeStep - 1, 0)); }
});

// ── Init ────────────────────────────────────────────────────────────────────
loadRuns();
</script>
</body>
</html>`;

// ── Start server ────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Transcript Browser running at http://localhost:${PORT}`);
  if (shouldOpen) {
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    exec(`${cmd} http://localhost:${PORT}`);
  }
});
