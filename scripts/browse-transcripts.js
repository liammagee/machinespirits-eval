#!/usr/bin/env node

/**
 * Transcript Browser
 *
 * Interactive web app for browsing evaluation runs, scenarios, and dialogue
 * transcripts with sequence diagram + transcript split-pane view.
 *
 * Usage:
 *   node scripts/browse-transcripts.js [--port 3456] [--no-open] [--run <runId>|--run-id <runId>] [--scenario <scenario_id>] [--dialogue <dialogueId>|--dialogue-id <dialogueId>] [--theme light|dark]
 *   or open /?run=<runId>&scenario=<scenario_id> (or &dialogue=<dialogueId>)
 */

import express from 'express';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { exec } from 'child_process';
import { projectTranscriptArtifacts } from '../services/transcriptProjection.js';

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
const initialRunQuery = getOption('run') || getOption('run-id');
const initialScenarioQuery = getOption('scenario');
const initialDialogueQuery = getOption('dialogue') || getOption('dialogue-id');
const initialThemeQuery = getOption('theme');

function buildLaunchUrl(port) {
  const params = new URLSearchParams();
  if (initialRunQuery) params.set('run', initialRunQuery);
  if (initialScenarioQuery) params.set('scenario', initialScenarioQuery);
  if (initialDialogueQuery) params.set('dialogue', initialDialogueQuery);
  if (initialThemeQuery === 'light' || initialThemeQuery === 'dark') {
    params.set('theme', initialThemeQuery);
  }
  const query = params.toString();
  return `http://localhost:${port}${query ? `/?${query}` : ''}`;
}

const db = new Database(DB_PATH, { readonly: true });
const app = express();
app.get('/favicon.ico', (_req, res) => res.status(204).end());

// ── Learner config cache ────────────────────────────────────────────────────

let learnerConfig = null;
try {
  learnerConfig = YAML.parse(fs.readFileSync(LEARNER_CONFIG, 'utf8'));
} catch {
  /* ignored */
}

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
    const m =
      (prof.unified_learner.provider ? prof.unified_learner.provider + '.' : '') + (prof.unified_learner.model || '');
    return { ego: m, superego: m };
  }
  return { ego: '?', superego: '?' };
}

// ── API endpoints ───────────────────────────────────────────────────────────

app.get('/api/runs', (req, res) => {
  const rows = db
    .prepare(
      `
    WITH latest AS (
      SELECT er.*
      FROM evaluation_results er
      JOIN (
        SELECT dialogue_id, MAX(id) AS max_id
        FROM evaluation_results
        WHERE dialogue_id IS NOT NULL
        GROUP BY dialogue_id
      ) ids ON ids.max_id = er.id
    )
    SELECT run_id,
      COUNT(*) as dialogue_count,
      MIN(tutor_first_turn_score) as min_score,
      MAX(tutor_first_turn_score) as max_score,
      GROUP_CONCAT(DISTINCT profile_name) as profiles,
      GROUP_CONCAT(DISTINCT ego_model) as ego_models,
      MIN(created_at) as first_created
    FROM latest
    GROUP BY run_id
    ORDER BY first_created DESC
  `,
    )
    .all();

  const runs = rows.map((r) => {
    const profiles = (r.profiles || '').split(',');
    const cells = [...new Set(profiles.map((p) => p.replace(/^cell_(\d+)_.*/, '$1')))].sort((a, b) => a - b);
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
  const rows = db
    .prepare(
      `
    SELECT er.id, er.dialogue_id, er.profile_name, er.scenario_id, er.tutor_first_turn_score,
      er.ego_model, er.judge_model, er.learner_architecture, er.superego_model,
      er.factor_recognition
    FROM evaluation_results er
    JOIN (
      SELECT dialogue_id, MAX(id) AS max_id
      FROM evaluation_results
      WHERE run_id = ? AND dialogue_id IS NOT NULL
      GROUP BY dialogue_id
    ) latest ON latest.max_id = er.id
    ORDER BY er.profile_name, er.scenario_id, er.tutor_first_turn_score DESC
  `,
    )
    .all(req.params.runId);

  const dialogues = rows.map((r) => ({
    dialogueId: r.dialogue_id,
    profile: r.profile_name,
    scenario: r.scenario_id,
    score: r.tutor_first_turn_score,
    egoModel: r.ego_model,
    judgeModel: r.judge_model,
    isRecog: !!r.factor_recognition || /recog/i.test(r.profile_name),
    learnerArch: r.learner_architecture,
  }));
  res.json(dialogues);
});

app.get('/api/dialogue/:dialogueId', (req, res) => {
  const row = db
    .prepare(
      `
    SELECT id, run_id, profile_name, scenario_id, dialogue_id, tutor_first_turn_score,
      ego_model, superego_model, judge_model, learner_architecture,
      score_relevance, score_specificity, score_pedagogical, score_personalization,
      score_actionability, score_tone, scores_with_reasoning,
      qualitative_assessment, qualitative_model, factor_recognition
    FROM evaluation_results
    WHERE dialogue_id = ?
    ORDER BY id DESC LIMIT 1
  `,
    )
    .get(req.params.dialogueId);

  if (!row) return res.status(404).json({ error: 'Dialogue not found' });

  // Load trace from log file
  let trace = [];
  let logMeta = {};
  let turnResults = [];
  let learnerContext = '';
  try {
    const files = fs.readdirSync(LOGS_DIR).filter((f) => f.includes(req.params.dialogueId));
    if (files.length > 0) {
      const log = JSON.parse(fs.readFileSync(path.join(LOGS_DIR, files[0]), 'utf8'));
      trace = log.consolidatedTrace || log.dialogueTrace || [];
      turnResults = log.turnResults || [];
      learnerContext = log.learnerContext || '';
      logMeta = {
        totalTurns: log.totalTurns,
        learnerArchitecture: log.learnerArchitecture,
      };
    }
  } catch {
    /* ignored */
  }

  const learnerModels = resolvelearnerModels(row.learner_architecture || logMeta.learnerArchitecture || 'unified');

  let judgeScores = {};
  try {
    judgeScores = JSON.parse(row.scores_with_reasoning || '{}');
  } catch {
    /* ignored */
  }
  let qualitative = {};
  try {
    qualitative = JSON.parse(row.qualitative_assessment || '{}');
  } catch {
    /* ignored */
  }

  const projection = projectTranscriptArtifacts({
    trace,
    turnResults,
    learnerContext,
    scenarioName: row.scenario_id || '',
    profileName: row.profile_name || '',
    totalTurns: logMeta.totalTurns || turnResults.length || 0,
    detail: 'play',
  });

  res.json({
    trace,
    projection: {
      steps: projection.steps,
      messageChain: projection.messageChain,
      judged: projection.judged,
      diagnostics: projection.diagnostics,
    },
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
      overall: row.tutor_first_turn_score,
      dimensions: judgeScores,
    },
    qualitative,
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function shortModel(m) {
  if (!m) return '?';
  return String(m)
    .replace(/^openrouter\./, '')
    .split('/')
    .pop()
    .split(':')[0];
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
  :root {
    --bg:#0d1117;
    --surface:#161b22;
    --surface-2:#11161d;
    --panel:#0f1621;
    --bg-alt:#0d1117;
    --border:#30363d;
    --border-soft:#263241;
    --text:#e6edf3;
    --text-soft:#c7d1db;
    --muted:#8b949e;
    --muted-soft:#6e7681;
    --muted-dim:#555;
    --accent:#58a6ff;
    --accent-soft:#90caf9;
    --hover:rgba(255,255,255,0.04);
    --selected:rgba(88,166,255,0.10);
    --info-bg:#1a237e;
    --tag-bg:#263238;
    --tag-fg:#80cbc4;
    --hint:#444;
    --table-rule:#1e1e1e;
    --bar-bg:#262626;
  }
  body.theme-light {
    --bg:#f7fafc;
    --surface:#ffffff;
    --surface-2:#f3f7fb;
    --panel:#f8fbff;
    --bg-alt:#ffffff;
    --border:#d0d7e2;
    --border-soft:#d8e0ea;
    --text:#102235;
    --text-soft:#24374a;
    --muted:#5f7388;
    --muted-soft:#6f8194;
    --muted-dim:#708091;
    --accent:#0f6ad6;
    --accent-soft:#0f6ad6;
    --hover:rgba(15,106,214,0.06);
    --selected:rgba(15,106,214,0.10);
    --info-bg:#e6f0ff;
    --tag-bg:#e7eff7;
    --tag-fg:#194d80;
    --hint:#6e8091;
    --table-rule:#d8e1ea;
    --bar-bg:#e4eaf1;
  }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'SF Mono','Fira Code','JetBrains Mono',monospace; background:var(--bg); color:var(--text); height:100vh; overflow:hidden; display:flex; }

  /* ── Sidebar ── */
  .sidebar { width:280px; flex-shrink:0; border-right:1px solid var(--border); display:flex; flex-direction:column; background:var(--surface); overflow:hidden; }
  .sidebar-header { padding:14px 16px 10px; border-bottom:1px solid var(--border); flex-shrink:0; }
  .sidebar-header h1 { font-size:13px; font-weight:700; letter-spacing:0.5px; margin-bottom:8px; }
  .filter-row { display:flex; gap:6px; margin-bottom:6px; }
  .filter-input { flex:1; background:var(--bg-alt); border:1px solid var(--border); border-radius:4px; padding:4px 8px; color:var(--text); font-size:11px; font-family:inherit; outline:none; }
  .filter-input:focus { border-color:var(--accent); }
  .filter-toggles { display:flex; gap:8px; font-size:10px; color:var(--muted); }
  .filter-toggles label { cursor:pointer; display:flex; align-items:center; gap:3px; }
  .filter-toggles input { accent-color:var(--accent); }
  .sidebar-list { flex:1; overflow-y:auto; padding:4px 0; }

  .run-item { padding:6px 16px; cursor:pointer; font-size:11px; border-bottom:1px solid var(--border-soft); }
  .run-item:hover { background:var(--hover); }
  .run-item.open { background:var(--selected); }
  .run-header { display:flex; justify-content:space-between; align-items:center; }
  .run-date { font-weight:600; color:var(--text); }
  .run-count { color:var(--muted); font-size:10px; }
  .run-models { font-size:9px; color:var(--muted-dim); margin-top:2px; }
  .run-children { padding-left:8px; display:none; }
  .run-item.open > .run-children { display:block; }

  .cell-group { margin:2px 0; }
  .cell-label { font-size:10px; font-weight:600; color:var(--muted); padding:4px 8px 2px; cursor:pointer; }
  .cell-label:hover { color:var(--text); }
  .cell-dialogues { display:none; }
  .cell-group.open > .cell-dialogues { display:block; }

  .dlg-item { padding:3px 8px 3px 16px; cursor:pointer; font-size:10px; display:flex; justify-content:space-between; align-items:center; border-radius:3px; }
  .dlg-item:hover { background:var(--hover); }
  .dlg-item.active { background:var(--selected); color:var(--text); }
  .dlg-scenario { color:var(--text-soft); flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .dlg-score { font-weight:700; margin-left:6px; padding:1px 5px; border-radius:8px; font-size:9px; }
  .score-high { background:rgba(76,175,80,0.2); color:#66bb6a; }
  .score-mid { background:rgba(255,152,0,0.2); color:#ffa726; }
  .score-low { background:rgba(244,67,54,0.2); color:#ef5350; }
  .score-na { background:rgba(96,125,139,0.2); color:#90a4ae; }
  .recog-dot { width:6px; height:6px; border-radius:50%; background:#7c4dff; display:inline-block; margin-right:4px; flex-shrink:0; }
  .base-dot { width:6px; height:6px; border-radius:50%; background:#555; display:inline-block; margin-right:4px; flex-shrink:0; }

  /* ── Main content ── */
  .main { flex:1; display:flex; flex-direction:column; overflow:hidden; }
  .top-bar { padding:10px 20px; border-bottom:1px solid var(--border); background:var(--surface); display:flex; align-items:center; justify-content:space-between; flex-shrink:0; gap:16px; min-height:60px; }
  .top-bar h2 { font-size:13px; font-weight:600; }
  .meta-grid { display:grid; grid-template-columns:auto auto auto; gap:1px 14px; font-size:10px; }
  .meta-label { color:var(--muted); }
  .meta-value { color:var(--text); font-weight:500; }
  .meta-id { font-size:9px; color:var(--muted-soft); margin-top:2px; }
  .score-badge { padding:3px 12px; border-radius:12px; font-weight:700; font-size:14px; color:#fff; }

  .legend { display:flex; gap:12px; justify-content:center; padding:6px; font-size:9px; color:var(--muted); flex-shrink:0; border-bottom:1px solid var(--border); }
  .legend span { display:flex; align-items:center; gap:3px; }
  .legend .sw { width:12px; height:3px; border-radius:2px; }
  .legend-toggle { cursor:pointer; border-radius:4px; padding:1px 4px; user-select:none; }
  .legend-toggle:hover { background:var(--hover); }
  .legend-toggle.off { opacity:0.45; text-decoration:line-through; }

  .view-controls { display:flex; align-items:center; gap:8px; padding:8px 16px; border-bottom:1px solid var(--border); background:var(--surface-2); }
  .view-label { color:var(--muted); font-size:10px; text-transform:uppercase; letter-spacing:1px; }
  .view-btn { background:var(--bg-alt); border:1px solid var(--border); color:var(--text); border-radius:4px; padding:4px 10px; font-size:10px; font-family:inherit; cursor:pointer; }
  .view-btn.active { border-color:var(--accent); background:rgba(88,166,255,0.12); }
  .view-btn:disabled { opacity:0.45; cursor:not-allowed; }
  .view-divider { width:1px; height:14px; background:var(--border-soft); margin:0 4px; }
  .view-check { display:flex; align-items:center; gap:4px; color:var(--muted); font-size:10px; cursor:pointer; user-select:none; }
  .view-check input { accent-color:var(--accent); }
  .theme-btn { min-width:72px; }
  .chain-filter { display:inline-flex; align-items:center; gap:4px; }
  .chain-filter .view-btn { padding:3px 8px; font-size:9px; }

  .split { display:flex; flex:1; overflow:hidden; }

  .left-pane { width:50%; overflow:auto; border-right:1px solid var(--border); padding:12px; flex-shrink:0; }
  .left-pane svg { display:block; margin:0 auto; }
  svg text { font-family:'SF Mono','Fira Code',monospace; }
  .arrow-group { cursor:pointer; }
  .arrow-group:hover .arrow-line { stroke-width:3 !important; }
  .arrow-group.active .arrow-line { stroke-width:3.5 !important; filter:drop-shadow(0 0 4px currentColor); }
  .arrow-group.active text { font-weight:700 !important; }
  .actor-header.clickable { cursor:pointer; }
  .actor-header.clickable:hover rect { filter:drop-shadow(0 0 2px rgba(88,166,255,0.55)); }
  .actor-header.off { opacity:0.45; }

  .right-pane { width:50%; overflow-y:auto; padding:12px 16px; }

  .entry { padding:10px 12px; margin:4px 0; border-radius:6px; border:1px solid transparent; cursor:pointer; transition:all 0.15s; }
  .entry:hover { background:var(--hover); border-color:var(--border); }
  .entry.active { background:rgba(88,166,255,0.08); border-color:#58a6ff; box-shadow:0 0 12px rgba(88,166,255,0.15); }
  .entry-speaker { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; display:flex; align-items:center; gap:6px; }
  .entry-model { font-weight:400; color:var(--muted); font-size:9px; }
  .entry-content { font-size:12px; line-height:1.6; color:var(--text-soft); white-space:pre-wrap; word-wrap:break-word; }
  .entry-subtitle { font-size:10px; color:var(--muted); margin-bottom:8px; }

  .chain-card { border:1px solid var(--border-soft); border-radius:7px; padding:10px 12px; margin:8px 0; background:var(--panel); }
  .chain-head { font-size:10px; color:var(--accent-soft); margin-bottom:8px; text-transform:uppercase; letter-spacing:0.4px; font-weight:600; }
  .chain-section { margin-top:8px; }
  .chain-title { font-size:10px; color:var(--accent-soft); font-weight:600; margin-bottom:3px; text-transform:uppercase; letter-spacing:0.4px; }
  .chain-line { margin:4px 0; }
  .chain-role { font-size:10px; color:var(--muted); font-weight:600; display:block; margin-bottom:2px; }
  .chain-text { font-size:11px; line-height:1.55; color:var(--text-soft); white-space:pre-wrap; word-wrap:break-word; background:var(--bg-alt); border:1px solid var(--border-soft); border-radius:5px; padding:8px; }
  .chain-muted { color:var(--muted-soft); }
  .chain-details { margin-top:8px; border:1px solid var(--border-soft); border-radius:5px; background:var(--surface-2); }
  .chain-details > summary { cursor:pointer; list-style:none; padding:7px 9px; font-size:10px; color:var(--muted); font-weight:600; text-transform:uppercase; letter-spacing:0.4px; }
  .chain-details > summary::-webkit-details-marker { display:none; }
  .chain-details > summary::before { content:'\\25B8 '; }
  .chain-details[open] > summary::before { content:'\\25BE '; }
  .chain-details .chain-line { margin:0; padding:0 9px 8px; }
  .channel-tag { display:inline-block; margin-left:6px; padding:1px 6px; border-radius:10px; border:1px solid var(--border-soft); color:var(--muted); font-size:9px; font-weight:600; text-transform:uppercase; letter-spacing:0.35px; }

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
  table.judge-table tr { border-bottom:1px solid var(--table-rule); }
  .jd { padding:5px 8px; font-weight:500; white-space:nowrap; color:var(--text-soft); }
  .js { padding:5px 6px; text-align:center; font-weight:700; }
  .jb { padding:5px 8px; }
  .jr { padding:5px 8px; color:var(--muted); font-size:10px; }
  .bar-bg { background:var(--bar-bg); border-radius:3px; height:5px; width:80px; }
  .bar-fg { border-radius:3px; height:5px; }

  .qual-item { margin-bottom:12px; }
  .qual-label { font-weight:600; color:var(--accent-soft); font-size:11px; margin-bottom:3px; }
  .qual-text { color:var(--text-soft); font-size:11px; line-height:1.6; }
  .qual-ktp { margin:12px 0; padding:10px; background:var(--info-bg); border-radius:6px; }
  .qual-tags { margin-top:8px; }
  .tag { display:inline-block; padding:2px 8px; margin:2px; border-radius:10px; font-size:10px; font-weight:600; background:var(--tag-bg); color:var(--tag-fg); }

  /* Empty state */
  .empty-state { display:flex; align-items:center; justify-content:center; flex:1; color:var(--muted); font-size:12px; flex-direction:column; gap:8px; }
  .empty-state .hint { font-size:10px; color:var(--hint); }

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

  <div class="view-controls" id="viewControls" style="display:none">
    <span class="view-label">View</span>
    <button class="view-btn active" id="viewTranscriptBtn" onclick="setViewMode('transcript')">Transcript</button>
    <button class="view-btn" id="viewMessageChainBtn" onclick="setViewMode('message-chain')">Message Chain</button>
    <span class="view-divider"></span>
    <label class="view-check"><input type="checkbox" id="toggleTutorInternal" checked onchange="setInternalVisibility('tutor', this.checked)">Tutor internals</label>
    <label class="view-check"><input type="checkbox" id="toggleLearnerInternal" checked onchange="setInternalVisibility('learner', this.checked)">Learner internals</label>
    <span class="view-divider" id="chainFilterDivider" style="display:none"></span>
    <span class="chain-filter" id="chainFilterGroup" style="display:none">
      <button class="view-btn" id="chainFilterAllBtn" onclick="setMessageChainChannelFilter('all')">All chains</button>
      <button class="view-btn" id="chainFilterFrontBtn" onclick="setMessageChainChannelFilter('tutor_learner')">Tutor↔Learner</button>
      <button class="view-btn" id="chainFilterTutorBtn" onclick="setMessageChainChannelFilter('tutor_ego_superego')">Tutor↔Superego</button>
      <button class="view-btn" id="chainFilterLearnerBtn" onclick="setMessageChainChannelFilter('learner_ego_superego')">Learner↔Superego</button>
    </span>
    <span class="view-divider"></span>
    <button class="view-btn theme-btn" id="themeToggleBtn" onclick="toggleTheme()">Light</button>
    <span class="view-label" id="viewHint"></span>
  </div>

  <div class="legend" id="legendBar" style="display:none">
    <span><span class="sw" style="background:#78909c"></span> Front stage</span>
    <span class="legend-toggle" id="legendLearnerSuperego" onclick="toggleLaneFromHeader('learner')" title="Toggle learner superego lane"><span class="sw" style="background:#ef5350"></span> L.Superego</span>
    <span><span class="sw" style="background:#ab47bc"></span> L.Ego</span>
    <span><span class="sw" style="background:#42a5f5"></span> T.Ego</span>
    <span class="legend-toggle" id="legendTutorSuperego" onclick="toggleLaneFromHeader('tutor')" title="Toggle tutor superego lane"><span class="sw" style="background:#66bb6a"></span> T.Superego</span>
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
let activeViewMode = 'transcript';
let currentDialogueData = null;
let currentSteps = [];
let visibleSteps = [];
let showTutorInternal = true;
let showLearnerInternal = true;
let messageChainChannelFilter = 'all';
let activeTheme = 'dark';
const query = new URLSearchParams(window.location.search);
const initialRunId = query.get('run');
const initialDialogueId = query.get('dialogue');
const initialScenario = query.get('scenario');
const initialTheme = query.get('theme');

// ── Helpers ──────────────────────────────────────────────────────────────────
function escapeHtml(t) {
  if (!t) return '';
  return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function shortModel(m) {
  if (!m) return '?';
  return String(m).replace(/^openrouter\\./, '').split('/').pop().split(':')[0];
}
function scoreClass(s) { return s == null || Number.isNaN(s) ? 'score-na' : s >= 85 ? 'score-high' : s >= 65 ? 'score-mid' : 'score-low'; }
function scoreBg(s) { return s == null || Number.isNaN(s) ? '#455a64' : s >= 90 ? '#1b5e20' : s >= 70 ? '#e65100' : '#b71c1c'; }
function channelLabel(channel) {
  if (channel === 'tutor_learner') return 'Tutor↔Learner';
  if (channel === 'tutor_ego_superego') return 'Tutor↔Superego';
  if (channel === 'learner_ego_superego') return 'Learner↔Superego';
  return 'Unknown';
}
function normalizeScenarioKey(v) {
  return String(v || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function findScenarioDialogue(items, scenarioQuery) {
  const wanted = normalizeScenarioKey(scenarioQuery);
  if (!wanted || !Array.isArray(items)) return null;
  const exact = items.find((d) => normalizeScenarioKey(d.scenario) === wanted);
  if (exact) return exact;
  return items.find((d) => normalizeScenarioKey(d.scenario).includes(wanted)) || null;
}

function loadSavedTheme() {
  if (initialTheme === 'light' || initialTheme === 'dark') return initialTheme;
  try {
    const stored = window.localStorage.getItem('transcriptBrowserTheme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // ignore storage failures
  }
  return 'dark';
}

function applyTheme(theme, persist = true) {
  activeTheme = theme === 'light' ? 'light' : 'dark';
  document.body.classList.toggle('theme-light', activeTheme === 'light');
  if (persist) {
    try {
      window.localStorage.setItem('transcriptBrowserTheme', activeTheme);
    } catch {
      // ignore storage failures
    }
  }
  syncThemeControl();
  if (currentDialogueData) {
    renderCurrentView();
  }
}

function syncThemeControl() {
  const btn = document.getElementById('themeToggleBtn');
  if (!btn) return;
  btn.textContent = activeTheme === 'light' ? 'Dark' : 'Light';
  btn.title = activeTheme === 'light' ? 'Switch to dark theme' : 'Switch to light theme';
}

function toggleTheme() {
  applyTheme(activeTheme === 'light' ? 'dark' : 'light');
}

function syncLegendToggles() {
  const learner = document.getElementById('legendLearnerSuperego');
  const tutor = document.getElementById('legendTutorSuperego');
  if (learner) learner.classList.toggle('off', !showLearnerInternal);
  if (tutor) tutor.classList.toggle('off', !showTutorInternal);
}

function syncMessageChainFilterControls(chain) {
  const group = document.getElementById('chainFilterGroup');
  const divider = document.getElementById('chainFilterDivider');
  const show = activeViewMode === 'message-chain';
  if (group) group.style.display = show ? 'inline-flex' : 'none';
  if (divider) divider.style.display = show ? 'block' : 'none';

  const counts = { tutor_learner: 0, tutor_ego_superego: 0, learner_ego_superego: 0, unknown: 0 };
  for (const ex of chain?.exchanges || []) {
    const key = ex.channel || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }

  const allCount = (chain?.exchanges || []).length;
  const specs = [
    { id: 'chainFilterAllBtn', channel: 'all', label: 'All chains', count: allCount },
    { id: 'chainFilterFrontBtn', channel: 'tutor_learner', label: channelLabel('tutor_learner'), count: counts.tutor_learner || 0 },
    { id: 'chainFilterTutorBtn', channel: 'tutor_ego_superego', label: channelLabel('tutor_ego_superego'), count: counts.tutor_ego_superego || 0 },
    { id: 'chainFilterLearnerBtn', channel: 'learner_ego_superego', label: channelLabel('learner_ego_superego'), count: counts.learner_ego_superego || 0 },
  ];

  for (const spec of specs) {
    const btn = document.getElementById(spec.id);
    if (!btn) continue;
    btn.textContent = spec.label + ' (' + spec.count + ')';
    btn.classList.toggle('active', messageChainChannelFilter === spec.channel);
  }
}

function setMessageChainChannelFilter(channel) {
  const allowed = new Set(['all', 'tutor_learner', 'tutor_ego_superego', 'learner_ego_superego']);
  messageChainChannelFilter = allowed.has(channel) ? channel : 'all';
  if (!currentDialogueData) return;
  renderCurrentView();
}

// ── Sidebar: load runs ──────────────────────────────────────────────────────
async function loadRuns() {
  const res = await fetch('/api/runs');
  allRuns = await res.json();
  renderSidebar();

  if (initialRunId && allRuns.some((r) => r.runId === initialRunId)) {
    await toggleRun(initialRunId, true);
    const items = runDialogues[initialRunId] || [];
    const target =
      (initialDialogueId ? items.find((d) => d.dialogueId === initialDialogueId) : null) ||
      (initialScenario ? findScenarioDialogue(items, initialScenario) : null) ||
      items[0];
    if (target?.dialogueId) {
      await loadDialogue(target.dialogueId);
    }
  }
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
    html += '<div class="run-header" onclick="toggleRun(&quot;' + escapeHtml(run.runId) + '&quot;)">';
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
    html += '<div class="cell-label" onclick="this.parentElement.classList.toggle(&quot;open&quot;)">';
    html += '<span class="' + (isRecog ? 'recog-dot' : 'base-dot') + '"></span>';
    html += escapeHtml(profile) + ' (' + items.length + ')';
    html += '</div>';
    html += '<div class="cell-dialogues">';
    for (const d of items) {
      const sc = d.score?.toFixed(0) || '--';
      const scn = d.scenario.replace(/_/g, ' ').substring(0, 25);
      const isActive = d.dialogueId === activeDialogueId;
      html += '<div class="dlg-item' + (isActive ? ' active' : '') + '" onclick="loadDialogue(&quot;' + escapeHtml(d.dialogueId) + '&quot;)">';
      html += '<span class="dlg-scenario">' + escapeHtml(scn) + '</span>';
      html += '<span class="dlg-score ' + scoreClass(d.score) + '">' + sc + '</span>';
      html += '</div>';
    }
    html += '</div></div>';
  }
  return html;
}

async function toggleRun(runId, forceOpen = false) {
  if (runDialogues[runId] && !forceOpen) {
    delete runDialogues[runId];
    renderSidebar();
    return;
  }
  if (runDialogues[runId] && forceOpen) {
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
  activeViewMode = 'transcript';

  // Update sidebar active state
  document.querySelectorAll('.dlg-item').forEach(el => el.classList.remove('active'));
  const clicked = document.querySelector('.dlg-item[onclick*="' + dialogueId + '"]');
  if (clicked) clicked.classList.add('active');

  const res = await fetch('/api/dialogue/' + encodeURIComponent(dialogueId));
  const data = await res.json();
  currentDialogueData = data;

  currentSteps = data.projection?.steps || [];
  data.messageChain = data.projection?.messageChain || { exchanges: [] };
  data.judged = data.projection?.judged || null;
  data.diagnostics = data.projection?.diagnostics || { effectCount: 0, effects: [] };
  totalSteps = 0;

  renderTopBar(data);
  renderViewControls(data);
  renderCurrentView();
  renderJudgePanel(data.scores, data.qualitative);

  document.getElementById('legendBar').style.display = 'flex';
  document.getElementById('splitPane').style.display = 'flex';
  document.getElementById('viewControls').style.display = 'flex';
}

// ── Top bar ─────────────────────────────────────────────────────────────────
function renderTopBar(data) {
  const m = data.metadata;
  const score = data.scores.overall?.toFixed(1) || '--';
  const condLabel = m.isRecog ? 'Recognition' : 'Base';
  const scenario = (m.scenario || '').replace(/_/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase());
  const chain = data.messageChain || { exchanges: [] };
  const captureCount = chain.exchanges.filter((e) => e.hasApiPayload).length;
  const diagCount = data.diagnostics?.effectCount || 0;
  const chainSummary =
    chain.exchanges.length > 0
      ? captureCount + '/' + chain.exchanges.length + ' message payloads'
      : 'No model exchanges detected';
  const projectionSummary = diagCount > 0 ? (diagCount + ' projection warning' + (diagCount === 1 ? '' : 's')) : 'projection clean';

  document.getElementById('topBar').innerHTML =
    '<div>' +
      '<h2>' + escapeHtml(scenario) + '</h2>' +
      '<div class="meta-grid">' +
        '<span class="meta-label">Cell</span><span class="meta-value">' + escapeHtml(m.profile) + '</span><span class="meta-value">' + condLabel + (m.totalTurns ? ' · ' + m.totalTurns + ' turns' : '') + '</span>' +
        '<span class="meta-label">Tutor</span><span class="meta-value">ego ' + escapeHtml(shortModel(m.egoModel)) + '</span><span class="meta-value">superego ' + escapeHtml(shortModel(m.superegoModel) || shortModel(m.egoModel)) + '</span>' +
        '<span class="meta-label">Learner</span><span class="meta-value">ego ' + escapeHtml(shortModel(m.learnerEgoModel)) + '</span><span class="meta-value">superego ' + escapeHtml(shortModel(m.learnerSuperegoModel)) + '</span>' +
        '<span class="meta-label">Judge</span><span class="meta-value">' + escapeHtml(shortModel(m.judgeModel)) + '</span><span class="meta-value">' + escapeHtml(chainSummary) + '</span>' +
        '<span class="meta-label">Trace</span><span class="meta-value">' + escapeHtml(projectionSummary) + '</span><span class="meta-value"></span>' +
      '</div>' +
      '<div class="meta-id">' + escapeHtml(m.runId) + ' · ' + escapeHtml(m.dialogueId) + '</div>' +
    '</div>' +
    '<span class="score-badge" style="background:' + scoreBg(parseFloat(score)) + '">' + score + '</span>';
}

function renderViewControls(data) {
  const chain = data.messageChain || { exchanges: [] };
  const hasRaw = chain.exchanges.some((e) => e.hasApiPayload);
  const transcriptBtn = document.getElementById('viewTranscriptBtn');
  const chainBtn = document.getElementById('viewMessageChainBtn');
  const tutorToggle = document.getElementById('toggleTutorInternal');
  const learnerToggle = document.getElementById('toggleLearnerInternal');
  const hint = document.getElementById('viewHint');

  transcriptBtn.classList.toggle('active', activeViewMode === 'transcript');
  chainBtn.classList.toggle('active', activeViewMode === 'message-chain');
  chainBtn.disabled = chain.exchanges.length === 0;
  if (tutorToggle) tutorToggle.checked = showTutorInternal;
  if (learnerToggle) learnerToggle.checked = showLearnerInternal;
  syncThemeControl();
  syncLegendToggles();
  syncMessageChainFilterControls(chain);

  if (activeViewMode === 'transcript') {
    hint.textContent = visibleSteps.length + ' step' + (visibleSteps.length === 1 ? '' : 's') + ' visible';
  } else if (chain.exchanges.length === 0) {
    hint.textContent = 'No model-call entries in this trace';
  } else if (!hasRaw) {
    hint.textContent = 'Message chain is semantic-only (raw payload capture unavailable)';
  } else {
    hint.textContent =
      'Message chain includes captured payloads' +
      (messageChainChannelFilter === 'all' ? '' : (' · filter: ' + channelLabel(messageChainChannelFilter)));
  }
}

function updateLayoutForViewMode() {
  const leftPane = document.getElementById('leftPane');
  const rightPane = document.getElementById('rightPane');
  const legend = document.getElementById('legendBar');
  if (activeViewMode === 'message-chain') {
    leftPane.style.display = 'none';
    leftPane.style.width = '0';
    rightPane.style.width = '100%';
    legend.style.display = 'none';
  } else {
    leftPane.style.display = 'block';
    leftPane.style.width = '50%';
    rightPane.style.width = '50%';
    legend.style.display = 'flex';
  }
}

function setViewMode(mode) {
  if (!currentDialogueData) return;
  activeViewMode = mode === 'message-chain' ? 'message-chain' : 'transcript';
  renderViewControls(currentDialogueData);
  renderCurrentView();
}

function setInternalVisibility(kind, checked) {
  if (kind === 'tutor') showTutorInternal = !!checked;
  if (kind === 'learner') showLearnerInternal = !!checked;
  if (!currentDialogueData) return;
  renderCurrentView();
}

function toggleLaneFromHeader(kind) {
  if (kind === 'tutor') {
    showTutorInternal = !showTutorInternal;
    const tutorToggle = document.getElementById('toggleTutorInternal');
    if (tutorToggle) tutorToggle.checked = showTutorInternal;
  }
  if (kind === 'learner') {
    showLearnerInternal = !showLearnerInternal;
    const learnerToggle = document.getElementById('toggleLearnerInternal');
    if (learnerToggle) learnerToggle.checked = showLearnerInternal;
  }
  if (!currentDialogueData) return;
  renderCurrentView();
}

function isTutorInternalStep(step) {
  if (!step) return false;
  return (
    (step.from === 'tutor_ego' && step.to === 'tutor_superego') ||
    (step.from === 'tutor_superego' && step.to === 'tutor_ego')
  );
}

function isLearnerInternalStep(step) {
  if (!step) return false;
  return (
    (step.from === 'learner_ego' && step.to === 'learner_superego') ||
    (step.from === 'learner_superego' && step.to === 'learner_ego')
  );
}

function getFilteredSteps(steps) {
  const all = Array.isArray(steps) ? steps : [];
  return all.filter((s) => {
    if (!showTutorInternal && isTutorInternalStep(s)) return false;
    if (!showLearnerInternal && isLearnerInternalStep(s)) return false;
    return true;
  });
}

function getFilteredMessageChainExchanges(exchanges) {
  const all = Array.isArray(exchanges) ? exchanges : [];
  return all.filter((ex) => {
    if (!showTutorInternal && ex.channel === 'tutor_ego_superego') return false;
    if (!showLearnerInternal && ex.channel === 'learner_ego_superego') return false;
    if (messageChainChannelFilter !== 'all' && ex.channel !== messageChainChannelFilter) return false;
    return true;
  });
}

function renderCurrentView() {
  if (!currentDialogueData) return;
  updateLayoutForViewMode();
  if (activeViewMode === 'message-chain') {
    totalSteps = 0;
    activeStep = -1;
    const filteredExchanges = getFilteredMessageChainExchanges(currentDialogueData.messageChain?.exchanges || []);
    renderMessageChain(currentDialogueData, filteredExchanges);
    renderViewControls(currentDialogueData);
    return;
  }
  visibleSteps = getFilteredSteps(currentSteps);
  totalSteps = visibleSteps.length;
  if (activeStep >= totalSteps) activeStep = totalSteps - 1;
  renderDiagram(visibleSteps, currentDialogueData.metadata);
  renderTranscript(visibleSteps);
  renderViewControls(currentDialogueData);
}

// ── Trace → Steps (ported from render-sequence-diagram.js) ──────────────────
function extractLearnerQuery(entry) {
  const raw = entry.rawContext || '';
  const learnerMsgRe = new RegExp('Learner Messages?:\\\\s*(.+?)(?:\\\\n</|$)', 's');
  const recentChatRe = new RegExp('Recent Chat History\\\\n-\\\\s*User:\\\\s*"(.+?)"', 's');
  const match = raw.match(learnerMsgRe) || raw.match(recentChatRe);
  return match ? match[1].trim() : null;
}

function extractLearnerFollowupFromContext(rawContext) {
  const raw = rawContext || '';
  if (!raw) return null;

  function normalizeSpaces(text) {
    return String(text || '')
      .replaceAll('\\n', ' ')
      .replaceAll('\\t', ' ')
      .replace(/ +/g, ' ')
      .trim();
  }

  const saidMarker = '**Learner said**:';
  const saidIndex = raw.indexOf(saidMarker);
  if (saidIndex >= 0) {
    let tail = raw.slice(saidIndex + saidMarker.length).trim();
    if (tail.startsWith('"')) {
      const closing = tail.indexOf('"', 1);
      if (closing > 1) return tail.slice(1, closing).trim();
    }

    let end = tail.length;
    const idxHeading = tail.indexOf('\\n###');
    const idxClose = tail.indexOf('\\n</');
    if (idxHeading >= 0 && idxHeading < end) end = idxHeading;
    if (idxClose >= 0 && idxClose < end) end = idxClose;
    return normalizeSpaces(tail.slice(0, end));
  }

  const actionMarker = '### Learner Action';
  const actionIndex = raw.indexOf(actionMarker);
  if (actionIndex >= 0) {
    let block = raw.slice(actionIndex);
    let end = block.length;
    const idxHeading = block.indexOf('\\n###', actionMarker.length);
    const idxClose = block.indexOf('\\n</');
    if (idxHeading >= 0 && idxHeading < end) end = idxHeading;
    if (idxClose >= 0 && idxClose < end) end = idxClose;
    return normalizeSpaces(block.slice(0, end));
  }

  return null;
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
  const hasTurnActions = trace.some((e) => e.agent === 'user' && e.action === 'turn_action');

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
      } else if (!hasTurnActions) {
        const followup = extractLearnerFollowupFromContext(e.rawContext) || extractLearnerQuery(e) || '(learner follow-up)';
        steps.push({
          from: 'learner_ego',
          to: 'tutor_ego',
          label: 'Turn ' + dialogueTurn,
          detail: followup.substring(0, 120),
          fullDetail: followup,
          type: 'front',
          speaker: 'LEARNER',
        });
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

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function extractContentField(content) {
  if (content == null) return null;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const parts = content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (typeof item?.text === 'string') return item.text;
        if (typeof item?.content === 'string') return item.content;
        return null;
      })
      .filter(Boolean);
    return parts.length > 0 ? parts.join('\\n') : null;
  }
  if (typeof content === 'object') {
    if (typeof content.text === 'string') return content.text;
    if (typeof content.content === 'string') return content.content;
  }
  return safeJson(content);
}

function extractSystemPromptFromRequestBody(body) {
  if (!body || typeof body !== 'object') return null;
  if (typeof body.system === 'string') return body.system;
  if (typeof body.systemInstruction === 'string') return body.systemInstruction;
  if (typeof body.systemInstruction?.text === 'string') return body.systemInstruction.text;
  if (Array.isArray(body.messages)) {
    const sys = body.messages
      .filter((m) => m?.role === 'system')
      .map((m) => extractContentField(m?.content))
      .filter(Boolean);
    if (sys.length > 0) return sys.join('\\n\\n');
  }
  return null;
}

function extractUserRequestFromRequestBody(body) {
  if (!body || typeof body !== 'object') return null;
  if (Array.isArray(body.messages)) {
    const users = body.messages
      .filter((m) => m?.role === 'user')
      .map((m) => extractContentField(m?.content))
      .filter(Boolean);
    if (users.length > 0) return users.join('\\n\\n');
  }
  if (Array.isArray(body.contents)) {
    const users = body.contents
      .map((c) => {
        if (Array.isArray(c?.parts)) {
          return c.parts.map((p) => p?.text).filter(Boolean).join('\\n');
        }
        return extractContentField(c?.content || c?.text || null);
      })
      .filter(Boolean);
    if (users.length > 0) return users.join('\\n\\n');
  }
  return null;
}

function extractResponseTextFromResponseBody(body) {
  if (body == null) return null;
  if (typeof body === 'string') return body;
  if (typeof body !== 'object') return safeJson(body);

  if (Array.isArray(body.choices) && body.choices.length > 0) {
    const first = body.choices[0];
    const content = first?.message?.content ?? first?.delta?.content ?? first?.text ?? null;
    const text = extractContentField(content);
    if (text) return text;
  }

  if (Array.isArray(body.content) && body.content.length > 0) {
    const text = extractContentField(body.content);
    if (text) return text;
  }

  if (typeof body.output_text === 'string') return body.output_text;
  if (body.candidates?.[0]?.content?.parts) {
    const parts = body.candidates[0].content.parts.map((p) => p?.text).filter(Boolean);
    if (parts.length > 0) return parts.join('\\n');
  }

  if (typeof body.text === 'string') return body.text;
  return safeJson(body);
}

function tryParseJsonString(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function extractPrimaryMessage(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    const parsed = tryParseJsonString(value);
    if (!parsed) return value;
    return extractPrimaryMessage(parsed);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return extractPrimaryMessage(value[0]);
  }
  if (typeof value === 'object') {
    if (typeof value.message === 'string') return value.message;
    if (typeof value.text === 'string') return value.text;
    if (typeof value.content === 'string') return value.content;
    if (typeof value.title === 'string') return value.title;
    if (Array.isArray(value.suggestions) && value.suggestions.length > 0) {
      const s = value.suggestions[0];
      if (typeof s?.message === 'string') return s.message;
      if (typeof s?.title === 'string') return s.title;
      return safeJson(s);
    }
    if (Array.isArray(value.output) && value.output.length > 0) {
      return extractPrimaryMessage(value.output[0]);
    }
  }
  return safeJson(value);
}

function isModelCallEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (entry.apiPayload || entry.api_payload) return true;
  const key = (entry.agent || '') + ':' + (entry.action || '');
  const candidates = new Set([
    'ego:generate',
    'ego:revise',
    'ego:generate_final',
    'ego:incorporate-feedback',
    'superego:review',
    'learner_ego_initial:deliberation',
    'learner_superego:deliberation',
    'learner_ego_revision:deliberation',
    'learner_synthesis:response',
  ]);
  return candidates.has(key);
}

function classifyChannel(entry) {
  const agent = entry?.agent || '';
  if (agent.startsWith('learner_')) return 'learner_ego_superego';
  if (agent === 'ego' || agent === 'superego') return 'tutor_ego_superego';
  if (agent === 'user') return 'tutor_learner';
  return 'unknown';
}

function buildMessageChain(trace) {
  const exchanges = [];
  if (!Array.isArray(trace)) return { exchanges };

  for (let i = 0; i < trace.length; i++) {
    const entry = trace[i];
    if (!isModelCallEntry(entry)) continue;

    const payload = entry?.apiPayload || entry?.api_payload || null;
    const requestBody = payload?.request?.body ?? null;
    const responseBody = payload?.response?.body ?? null;

    const semanticSystem = null;
    const semanticUser = entry.rawContext || entry.contextSummary || entry.detail || null;
    const semanticAssistant = fullContent(entry) || null;

    const rawSystem = extractSystemPromptFromRequestBody(requestBody);
    const rawUser = extractUserRequestFromRequestBody(requestBody);
    const rawAssistant = extractResponseTextFromResponseBody(responseBody);

    exchanges.push({
      sequence: exchanges.length + 1,
      traceIndex: i,
      agent: entry.agent || 'unknown',
      action: entry.action || 'unknown',
      channel: classifyChannel(entry),
      model: entry.metrics?.model || entry.model || null,
      provider: entry.provider || entry.metrics?.provider || null,
      latencyMs: entry.metrics?.latencyMs ?? entry.latencyMs ?? null,
      hasApiPayload: !!payload,
      semantic: {
        systemPrompt: extractPrimaryMessage(semanticSystem),
        userRequest: extractPrimaryMessage(semanticUser),
        assistantResponse: extractPrimaryMessage(semanticAssistant),
      },
      raw: {
        systemPrompt: extractPrimaryMessage(rawSystem),
        userRequest: extractPrimaryMessage(rawUser),
        assistantResponse: extractPrimaryMessage(rawAssistant),
      },
    });
  }

  return { exchanges };
}

// ── SVG diagram ─────────────────────────────────────────────────────────────
function renderDiagram(steps, meta) {
  const isLight = activeTheme === 'light';
  const lifelineColor = isLight ? '#a7b5c5' : '#333';
  const turnSeparatorColor = isLight ? '#c6d1de' : '#444';
  const turnTextColor = isLight ? '#7a8898' : '#666';
  const defaultLabelColor = isLight ? '#4f5f73' : '#bbb';
  const latencyColor = isLight ? '#7a8898' : '#555';

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
    const laneKind = a.id === 'learner_superego' ? 'learner' : (a.id === 'tutor_superego' ? 'tutor' : null);
    const laneEnabled = laneKind === 'learner' ? showLearnerInternal : (laneKind === 'tutor' ? showTutorInternal : true);
    const clickAttr = laneKind ? ' onclick="toggleLaneFromHeader(&quot;' + laneKind + '&quot;)"' : '';
    const headerClass = laneKind ? ('actor-header clickable' + (laneEnabled ? '' : ' off')) : 'actor-header';
    const hint = laneKind ? (laneEnabled ? 'click to hide' : 'click to show') : '';

    svg += '<g class="' + headerClass + '"' + clickAttr + '>';
    svg += '<rect x="' + (x+8) + '" y="4" width="' + (colWidth-16) + '" height="40" rx="5" fill="' + a.color + '" stroke="' + a.stroke + '" stroke-width="1"/>';
    svg += '<text x="' + cx + '" y="21" text-anchor="middle" font-size="11" font-weight="600" fill="' + a.textColor + '">' + a.label + '</text>';
    svg += '<text x="' + cx + '" y="36" text-anchor="middle" font-size="8.5" fill="' + a.textColor + '" opacity="0.65">' + a.model + '</text>';
    if (hint) {
      svg += '<text x="' + cx + '" y="47" text-anchor="middle" font-size="7.5" fill="' + a.textColor + '" opacity="0.6">' + hint + '</text>';
    }
    svg += '</g>';
    svg += '<line x1="' + cx + '" y1="' + headerHeight + '" x2="' + cx + '" y2="' + (svgHeight-10) + '" stroke="' + lifelineColor + '" stroke-width="1" stroke-dasharray="3,3"/>';
  });

  // Turn separators
  let prevTurn = '';
  steps.forEach((s, i) => {
    if (s.label.startsWith('Turn ') || s.label === 'Initial query') {
      const num = s.label === 'Initial query' ? 1 : parseInt(s.label.replace('Turn ', ''));
      if (num !== prevTurn) {
        const y = headerHeight + i * rowHeight;
        svg += '<line x1="' + padding + '" y1="' + y + '" x2="' + (svgWidth-padding) + '" y2="' + y + '" stroke="' + turnSeparatorColor + '" stroke-width="0.5"/>';
        svg += '<text x="' + (svgWidth-padding+3) + '" y="' + (y+12) + '" font-size="9" fill="' + turnTextColor + '" font-weight="600">T' + num + '</text>';
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
    let labelColor = defaultLabelColor;
    if (step.approved === true) labelColor = '#66bb6a';
    if (step.approved === false) labelColor = '#ff7043';

    svg += '<text x="' + labelX + '" y="' + (y-6) + '" text-anchor="middle" font-size="9.5" font-weight="500" fill="' + labelColor + '">' + escapeHtml(step.label) + '</text>';
    if (step.latency) {
      const lat = step.latency < 1000 ? step.latency + 'ms' : (step.latency / 1000).toFixed(1) + 's';
      svg += '<text x="' + labelX + '" y="' + (y+13) + '" text-anchor="middle" font-size="8" fill="' + latencyColor + '">' + lat + '</text>';
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

function clipText(text, maxChars) {
  if (!text) return '';
  const input = String(text);
  if (input.length <= maxChars) return input;
  return input.slice(0, maxChars) + ' ... [truncated ' + (input.length - maxChars) + ' chars]';
}

function renderTranscript(steps) {
  let html = '';
  html += renderProjectionDiagnosticsCard(currentDialogueData?.diagnostics);
  html += renderJudgeVisibilityCard(currentDialogueData?.judged);
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

function renderChainLine(role, text, opts = {}) {
  const maxChars = opts.maxChars || 2000;
  const body = text ? clipText(text, maxChars) : '(missing)';
  const mutedClass = text ? '' : ' chain-muted';
  return (
    '<div class="chain-line">' +
      '<span class="chain-role">' + role + '</span>' +
      '<div class="chain-text' + mutedClass + '">' + escapeHtml(body) + '</div>' +
    '</div>'
  );
}

function formatJsonForCard(value) {
  if (value == null) return null;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function toMessageStackLines(requestBody) {
  if (!requestBody || typeof requestBody !== 'object') return [];
  const lines = [];

  if (typeof requestBody.system === 'string') {
    lines.push({ role: 'Sys', text: requestBody.system });
  }
  if (typeof requestBody.systemInstruction === 'string') {
    lines.push({ role: 'Sys', text: requestBody.systemInstruction });
  }
  if (typeof requestBody.systemInstruction?.text === 'string') {
    lines.push({ role: 'Sys', text: requestBody.systemInstruction.text });
  }
  if (Array.isArray(requestBody.messages)) {
    for (const m of requestBody.messages) {
      const role = (m?.role || 'msg').toString();
      const content = extractContentField(m?.content);
      lines.push({ role: role === 'assistant' ? 'Assistant' : role === 'system' ? 'Sys' : 'User', text: content || safeJson(m) });
    }
  }
  if (Array.isArray(requestBody.contents)) {
    for (const c of requestBody.contents) {
      const role = (c?.role || 'user').toString();
      let text = null;
      if (Array.isArray(c?.parts)) {
        text = c.parts.map((p) => p?.text).filter(Boolean).join('\n');
      }
      if (!text) text = extractContentField(c?.content || c?.text || null);
      lines.push({ role: role === 'model' ? 'Assistant' : role === 'system' ? 'Sys' : 'User', text: text || safeJson(c) });
    }
  }
  return lines;
}

function getExchangeApiPayload(data, ex) {
  const trace = Array.isArray(data?.trace) ? data.trace : [];
  const entry = Number.isInteger(ex?.traceIndex) ? trace[ex.traceIndex] : null;
  return entry?.apiPayload || entry?.api_payload || null;
}

function renderProjectionDiagnosticsCard(diag) {
  if (!diag || !Array.isArray(diag.effects) || diag.effects.length === 0) return '';

  let html = '<div class="chain-card">';
  html += '<div class="chain-head">Projection Diagnostics</div>';
  html += '<div class="chain-line"><div class="chain-text">' + escapeHtml(diag.summary || '') + '</div></div>';
  for (const effect of diag.effects) {
    const sev = (effect.severity || 'info').toUpperCase();
    html += '<div class="chain-section">';
    html += '<div class="chain-title">' + escapeHtml(sev + ' · ' + (effect.id || 'effect')) + '</div>';
    html += '<div class="chain-line"><div class="chain-text">' + escapeHtml(effect.message || '') + '</div></div>';
    if (Array.isArray(effect.remedialSteps) && effect.remedialSteps.length > 0) {
      const remediation = effect.remedialSteps.map((s, i) => (i + 1) + '. ' + s).join('\\n');
      html += '<div class="chain-line">';
      html += '<span class="chain-role">Remediation</span>';
      html += '<div class="chain-text">' + escapeHtml(remediation) + '</div>';
      html += '</div>';
    }
    html += '</div>';
  }
  html += '</div>';
  return html;
}

function renderJudgeVisibilityCard(judged) {
  if (!judged) return '';
  let html = '<div class="chain-card">';
  html += '<div class="chain-head">What Is Being Judged</div>';
  html += '<div class="chain-section">';
  html += '<div class="chain-title">Public Transcript (dialogue_quality_score)</div>';
  html += renderChainLine('Transcript:', judged.publicTranscript || '(missing)', { maxChars: 5000 });
  html += '</div>';
  html += '<div class="chain-section">';
  html += '<div class="chain-title">Full Transcript (dialogue_quality_internal_score)</div>';
  html += renderChainLine('Transcript:', judged.fullTranscript || '(missing)', { maxChars: 5000 });
  html += '</div>';
  html += '</div>';
  return html;
}

function renderMessageChain(data, visibleExchanges = null) {
  const chain = data.messageChain || { exchanges: [] };
  const exchanges = Array.isArray(visibleExchanges) ? visibleExchanges : chain.exchanges || [];

  let html = '';
  html += renderProjectionDiagnosticsCard(data.diagnostics);
  html += renderJudgeVisibilityCard(data.judged);

  const counts = { tutor_learner: 0, tutor_ego_superego: 0, learner_ego_superego: 0, unknown: 0 };
  for (const ex of chain.exchanges || []) {
    const key = ex.channel || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }
  html += '<div class="chain-card">';
  html += '<div class="chain-head">API Message Chains</div>';
  const chainSummary =
    'Visible ' + exchanges.length + '/' + (chain.exchanges || []).length + ' exchanges · ' +
    channelLabel('tutor_learner') + ': ' + (counts.tutor_learner || 0) + ', ' +
    channelLabel('tutor_ego_superego') + ': ' + (counts.tutor_ego_superego || 0) + ', ' +
    channelLabel('learner_ego_superego') + ': ' + (counts.learner_ego_superego || 0);
  html += '<div class="chain-line"><div class="chain-text">' +
    escapeHtml(chainSummary) +
    '</div></div>';
  html += '<div class="chain-line"><div class="chain-text chain-muted">Use the channel buttons above to isolate one dialogue lane. Click a superego role label in the legend (L.Superego/T.Superego) to hide or show that lane.</div></div>';
  html += '</div>';

  if (exchanges.length === 0) {
    html += '<div class="entry">' +
      '<div class="entry-speaker">MESSAGE CHAIN</div>' +
      '<div class="entry-content">No message-chain entries visible for current filters.</div>' +
    '</div>';
    document.getElementById('rightPane').innerHTML = html;
    return;
  }

  exchanges.forEach((ex) => {
    const payload = getExchangeApiPayload(data, ex);
    const requestBody = payload?.request?.body ?? null;
    const responseBody = payload?.response?.body ?? null;
    const requestMeta = payload?.request
      ? (payload.request.method || 'POST') + ' ' + (payload.request.url || '(url unavailable)')
      : null;
    const responseMeta = payload?.response
      ? 'status=' + (payload.response.status ?? '?')
      : null;
    const messageStack = toMessageStackLines(requestBody);

    const model = ex.model ? shortModel(ex.model) : '?';
    const latency = ex.latencyMs == null ? '' : (ex.latencyMs < 1000 ? ex.latencyMs + 'ms' : (ex.latencyMs / 1000).toFixed(1) + 's');
    const head =
      '#' + ex.sequence +
      ' · ' + channelLabel(ex.channel) +
      ' · ' + ex.agent + '/' + ex.action +
      ' · model=' + model +
      (latency ? ' · ' + latency : '') +
      ' · payload=' + (ex.hasApiPayload ? 'captured' : 'missing');

    html += '<div class="chain-card">';
    html += '<div class="chain-head">' + escapeHtml(head) + '<span class="channel-tag">' + escapeHtml(ex.channel || 'unknown') + '</span></div>';

    html += '<div class="chain-section">';
    html += '<div class="chain-title">Semantic (Eval-Relevant)</div>';
    html += renderChainLine('Sys:', ex.semantic?.systemPrompt, { maxChars: 600 });
    html += renderChainLine('User:', ex.semantic?.userRequest, { maxChars: 1600 });
    html += renderChainLine('Assistant:', ex.semantic?.assistantResponse, { maxChars: 1600 });
    html += '</div>';

    html += '<div class="chain-section">';
    html += '<div class="chain-title">Raw API (Content Fields)</div>';
    if (ex.hasApiPayload) {
      if (requestMeta || responseMeta) {
        html += '<div class="chain-line"><div class="chain-text">' + escapeHtml([requestMeta, responseMeta].filter(Boolean).join(' · ')) + '</div></div>';
      }
      html += renderChainLine('Req Sys:', ex.raw?.systemPrompt, { maxChars: 1200 });
      html += renderChainLine('Req User:', ex.raw?.userRequest, { maxChars: 2000 });
      html += renderChainLine('Res Assistant:', ex.raw?.assistantResponse, { maxChars: 2000 });
    } else {
      html += '<div class="chain-line"><div class="chain-text chain-muted">Raw request/response payload was not captured for this exchange.</div></div>';
    }
    html += '</div>';

    html += '<div class="chain-section">';
    html += '<div class="chain-title">Raw API Message Stack</div>';
    if (ex.hasApiPayload && messageStack.length > 0) {
      for (const line of messageStack) {
        html += renderChainLine(line.role + ':', line.text, { maxChars: 200000 });
      }
    } else if (ex.hasApiPayload) {
      html += '<div class="chain-line"><div class="chain-text chain-muted">No request messages array detected in payload body.</div></div>';
    } else {
      html += '<div class="chain-line"><div class="chain-text chain-muted">Unavailable (payload missing).</div></div>';
    }
    html += '</div>';

    if (ex.hasApiPayload) {
      const reqJson = formatJsonForCard(requestBody);
      const resJson = formatJsonForCard(responseBody);
      html += '<details class="chain-details">';
      html += '<summary>Full request/response JSON</summary>';
      html += renderChainLine('Request JSON:', reqJson, { maxChars: 250000 });
      html += renderChainLine('Response JSON:', resJson, { maxChars: 250000 });
      html += '</details>';
    }

    html += '</div>';
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
applyTheme(loadSavedTheme(), false);
loadRuns();
</script>
</body>
</html>`;

// ── Start server ────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  const launchUrl = buildLaunchUrl(PORT);
  console.log(`Transcript Browser running at ${launchUrl}`);
  if (shouldOpen) {
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    exec(`${cmd} "${launchUrl}"`);
  }
});
