#!/usr/bin/env node

/**
 * Render Sequence Diagram
 *
 * Generates standalone HTML files with SVG sequence diagrams showing
 * the message flow between tutor ego, tutor superego, learner ego,
 * and learner superego. Includes judge adjudication panel.
 *
 * Usage:
 *   node scripts/render-sequence-diagram.js <runId> [options]
 *
 * Options:
 *   --scenario <id>     Filter by scenario
 *   --profile <name>    Filter by profile name
 *   --dialogue <id>     Render a specific dialogue by ID
 *   --limit <N>         Max number of diagrams to render
 *   --output <dir>      Output directory (default: exports/)
 *   --open              Open first diagram in browser after rendering
 *
 * Examples:
 *   node scripts/render-sequence-diagram.js eval-2026-02-07-b6d75e87 --dialogue dialogue-1770448315802-zmvmm0
 *   node scripts/render-sequence-diagram.js eval-2026-02-07-b6d75e87 --profile cell_8_recog_multi_psycho --open
 *   node scripts/render-sequence-diagram.js eval-2026-02-07-b6d75e87 --scenario mutual_transformation_journey --limit 4
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import Database from 'better-sqlite3';
import YAML from 'yaml';

const DB_PATH = path.join(import.meta.dirname, '..', 'data', 'evaluations.db');
const LOGS_DIR = path.join(import.meta.dirname, '..', 'logs', 'tutor-dialogues');
const DEFAULT_OUTPUT = path.join(import.meta.dirname, '..', 'exports');

// ── CLI parsing ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: render-sequence-diagram.js <runId> [options]

Options:
  --scenario <id>     Filter by scenario
  --profile <name>    Filter by profile name
  --dialogue <id>     Render a specific dialogue by ID
  --limit <N>         Max number of diagrams (default: all)
  --output <dir>      Output directory (default: exports/)
  --open              Open first diagram in browser
  `);
  process.exit(0);
}

function getOption(name) {
  const idx = args.indexOf('--' + name);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
}
function getFlag(name) { return args.includes('--' + name); }

const runId = args.find(a => !a.startsWith('--') && a !== getOption('scenario') && a !== getOption('profile') && a !== getOption('dialogue') && a !== getOption('limit') && a !== getOption('output'));
const scenarioFilter = getOption('scenario');
const profileFilter = getOption('profile');
const dialogueFilter = getOption('dialogue');
const limit = getOption('limit') ? parseInt(getOption('limit')) : null;
const outputDir = getOption('output') || DEFAULT_OUTPUT;
const shouldOpen = getFlag('open');

if (!runId) {
  console.error('Error: run ID required');
  process.exit(1);
}

// ── DB queries ───────────────────────────────────────────────────────────────

const db = new Database(DB_PATH, { readonly: true });

let query = `SELECT id, profile_name, scenario_id, dialogue_id, overall_score, judge_model,
  ego_model, superego_model,
  score_relevance, score_specificity, score_pedagogical, score_personalization,
  score_actionability, score_tone, scores_with_reasoning, qualitative_assessment, qualitative_model
  FROM evaluation_results
  WHERE run_id = ? AND dialogue_id IS NOT NULL`;
const params = [runId];

if (dialogueFilter) { query += ' AND dialogue_id = ?'; params.push(dialogueFilter); }
if (scenarioFilter) { query += ' AND scenario_id LIKE ?'; params.push('%' + scenarioFilter + '%'); }
if (profileFilter) { query += ' AND profile_name LIKE ?'; params.push('%' + profileFilter + '%'); }

query += ' ORDER BY overall_score DESC';
if (limit) { query += ' LIMIT ?'; params.push(limit); }

const results = db.prepare(query).all(...params);

if (results.length === 0) {
  console.log('No multi-turn dialogues found matching filters.');
  process.exit(0);
}

console.log(`Found ${results.length} dialogue(s) to render.`);

// ── Trace → sequence steps ───────────────────────────────────────────────────

function shortModel(m) {
  if (!m) return '?';
  // Strip provider prefix and version suffixes: "openrouter.kimi-k2.5" → "kimi-k2.5", "moonshotai/kimi-k2.5" → "kimi-k2.5"
  return String(m).replace(/^openrouter\./, '').split('/').pop().split(':')[0];
}

function extractLearnerQuery(entry) {
  const raw = entry.rawContext || '';
  const match = raw.match(/Learner Messages?:\s*(.+?)(?:\n<\/|$)/s)
    || raw.match(/Recent Chat History\n-\s*User:\s*"(.+?)"/s);
  return match ? match[1].trim() : null;
}

function snippet(entry, maxLen = 90) {
  return fullContent(entry).substring(0, maxLen);
}

function fullContent(entry) {
  if (entry.agent === 'superego' && entry.action === 'review') {
    return entry.feedback || entry.verdict?.feedback || '';
  }
  if (entry.suggestions?.length > 0) {
    return entry.suggestions.map(s => s.message || s.text || s.title || '').join('\n\n');
  }
  if (entry.agent === 'user' && entry.action === 'context_input') {
    return extractLearnerQuery(entry) || '(scenario context)';
  }
  if (entry.agent === 'user' && entry.action === 'turn_action') {
    return entry.contextSummary || entry.detail || '';
  }
  return entry.detail || entry.contextSummary || '';
}

function traceToSteps(trace) {
  const steps = [];
  let dialogueTurn = 0;

  // Identify indices where learner blocks start, so we can insert "Response" arrows
  const learnerBlockStarts = new Set();
  trace.forEach((e, i) => {
    if (e.agent === 'learner_ego_initial') learnerBlockStarts.add(i);
  });

  // Track whether we've emitted a Response arrow for the current tutor block
  let needsResponseArrow = false;

  for (let i = 0; i < trace.length; i++) {
    const e = trace[i];
    const { agent, action } = e;

    // If we're entering a learner block and haven't sent a Response arrow yet
    if (learnerBlockStarts.has(i) && needsResponseArrow) {
      // Find the last tutor ego output to use as the response content
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

    // Context input
    if (agent === 'user' && action === 'context_input') {
      dialogueTurn++;
      if (dialogueTurn === 1) {
        const query = extractLearnerQuery(e);
        const full = query || '(scenario prompt)';
        steps.push({
          from: 'learner_ego', to: 'tutor_ego',
          label: 'Initial query',
          detail: full.substring(0, 120),
          fullDetail: full,
          type: 'front', speaker: 'LEARNER',
        });
      }
      needsResponseArrow = true;
      continue;
    }

    // Tutor ego generate/revise
    if (agent === 'ego' && (action === 'generate' || action === 'revise' || action === 'incorporate-feedback')) {
      const full = fullContent(e);

      // Look ahead: does a superego review follow before the next learner block?
      let superegoFollows = false;
      for (let j = i + 1; j < trace.length; j++) {
        if (trace[j].agent === 'superego' && trace[j].action === 'review') { superegoFollows = true; break; }
        if (learnerBlockStarts.has(j)) break; // hit learner block first — no review coming
        if (trace[j].agent === 'user' && trace[j].action === 'context_input') break;
      }

      if (action !== 'generate' && !superegoFollows) {
        // Final revision with no superego review — render as direct Response to learner
        steps.push({
          from: 'tutor_ego', to: 'learner_ego', label: 'Response',
          detail: '', fullDetail: full, type: 'response',
          latency: e.metrics?.latencyMs || null,
          speaker: 'TUTOR EGO', model: e.metrics?.model || null,
        });
        needsResponseArrow = false;
      } else {
        const label = action === 'generate' ? 'Draft' : 'Revised';
        steps.push({
          from: 'tutor_ego', to: 'tutor_superego', label,
          detail: snippet(e, 120), fullDetail: full, type: 'back',
          latency: e.metrics?.latencyMs || null,
          speaker: action === 'generate' ? 'TUTOR EGO (draft)' : 'TUTOR EGO (revised)',
          model: e.metrics?.model || null,
        });
      }
      continue;
    }

    // Tutor superego review
    if (agent === 'superego' && action === 'review') {
      const approved = e.approved;
      const full = fullContent(e);
      if (approved) {
        steps.push({
          from: 'tutor_superego', to: 'tutor_ego', label: 'Approved \u2713',
          detail: snippet(e, 120), fullDetail: full, type: 'back', approved: true,
          latency: e.metrics?.latencyMs || null,
          speaker: 'SUPEREGO', model: e.metrics?.model || null,
        });
        // Find the approved ego output for the response
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
        steps.push({
          from: 'tutor_superego', to: 'tutor_ego', label: 'Revise \u21BB',
          detail: snippet(e, 120), fullDetail: full, type: 'back', approved: false,
          latency: e.metrics?.latencyMs || null,
          speaker: 'SUPEREGO', model: e.metrics?.model || null,
        });
      }
      continue;
    }

    // Learner ego initial
    if (agent === 'learner_ego_initial' && action === 'deliberation') {
      const full = fullContent(e);
      steps.push({
        from: 'learner_ego', to: 'learner_superego', label: 'Reaction',
        detail: snippet(e, 120), fullDetail: full, type: 'back',
        speaker: 'LEARNER EGO',
      });
      continue;
    }

    // Learner superego
    if (agent === 'learner_superego' && action === 'deliberation') {
      const full = fullContent(e);
      steps.push({
        from: 'learner_superego', to: 'learner_ego', label: 'Critique',
        detail: snippet(e, 120), fullDetail: full, type: 'back',
        speaker: 'LEARNER SUPEREGO',
      });
      continue;
    }

    // Learner ego revision — skip, turn_action carries the final
    if (agent === 'learner_ego_revision') continue;

    // Turn action = learner's external message
    if (agent === 'user' && action === 'turn_action') {
      const full = fullContent(e);
      steps.push({
        from: 'learner_ego', to: 'tutor_ego',
        label: 'Turn ' + (dialogueTurn + 1),
        detail: snippet(e, 120), fullDetail: full, type: 'front',
        speaker: 'LEARNER',
      });
      needsResponseArrow = true;
      continue;
    }
  }

  return steps;
}

// ── HTML template ────────────────────────────────────────────────────────────

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateHtml(result, steps, trace, meta = {}) {
  const profile = result.profile_name;
  const scenario = result.scenario_id;
  const score = result.overall_score?.toFixed(1) || '--';

  let judgeScores = {};
  try { judgeScores = JSON.parse(result.scores_with_reasoning || '{}'); } catch {}
  let qualitative = {};
  try { qualitative = JSON.parse(result.qualitative_assessment || '{}'); } catch {}

  const isRecog = /recog/i.test(profile);
  const condLabel = isRecog ? 'Recognition' : 'Base';

  // ── Actors & SVG dimensions ──
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

  // ── Build SVG ──
  let svg = '';

  // Actor column headers with model subtitle
  actors.forEach((a, i) => {
    const x = padding + i * colWidth;
    const cx = x + colWidth / 2;
    svg += `<rect x="${x + 8}" y="4" width="${colWidth - 16}" height="40" rx="5" fill="${a.color}" stroke="${a.stroke}" stroke-width="1"/>`;
    svg += `<text x="${cx}" y="21" text-anchor="middle" font-size="11" font-weight="600" fill="${a.textColor}">${a.label}</text>`;
    svg += `<text x="${cx}" y="36" text-anchor="middle" font-size="8.5" fill="${a.textColor}" opacity="0.65">${a.model}</text>`;
    svg += `<line x1="${cx}" y1="${headerHeight}" x2="${cx}" y2="${svgHeight - 10}" stroke="#333" stroke-width="1" stroke-dasharray="3,3"/>`;
  });

  // Turn separator lines
  const turnBoundaries = [];
  let prevTurn = '';
  steps.forEach((s, i) => {
    if (s.label.startsWith('Turn ') || s.label === 'Initial query') {
      const num = s.label === 'Initial query' ? 1 : parseInt(s.label.replace('Turn ', ''));
      if (num !== prevTurn) { turnBoundaries.push({ index: i, turn: num }); prevTurn = num; }
    }
  });
  turnBoundaries.forEach(tb => {
    const y = headerHeight + tb.index * rowHeight;
    svg += `<line x1="${padding}" y1="${y}" x2="${svgWidth - padding}" y2="${y}" stroke="#444" stroke-width="0.5"/>`;
    svg += `<text x="${svgWidth - padding + 3}" y="${y + 12}" font-size="9" fill="#666" font-weight="600">T${tb.turn}</text>`;
  });

  // Arrow groups — each clickable
  steps.forEach((step, i) => {
    const fromCol = colMap[step.from];
    const toCol = colMap[step.to];
    if (fromCol === undefined || toCol === undefined) return;

    const fromX = padding + fromCol * colWidth + colWidth / 2;
    const toX = padding + toCol * colWidth + colWidth / 2;
    const y = headerHeight + i * rowHeight + rowHeight / 2;
    const isLR = fromX < toX;

    let color;
    const fromActor = actors[fromCol];
    if (step.type === 'front' || step.type === 'response') { color = '#78909c'; }
    else { color = fromActor.stroke; }

    const sw = (step.type === 'front' || step.type === 'response') ? 2.2 : 1.2;
    const tipOff = isLR ? -6 : 6;

    // Invisible wider hit area for clicking
    svg += `<g data-step="${i}" class="arrow-group" style="cursor:pointer" onclick="highlight(${i})">`;
    svg += `<line x1="${fromX}" y1="${y}" x2="${toX}" y2="${y}" stroke="transparent" stroke-width="20"/>`;
    svg += `<line x1="${fromX}" y1="${y}" x2="${toX + tipOff}" y2="${y}" stroke="${color}" stroke-width="${sw}" class="arrow-line"/>`;
    if (isLR) {
      svg += `<polygon points="${toX - 6},${y - 3.5} ${toX},${y} ${toX - 6},${y + 3.5}" fill="${color}"/>`;
    } else {
      svg += `<polygon points="${toX + 6},${y - 3.5} ${toX},${y} ${toX + 6},${y + 3.5}" fill="${color}"/>`;
    }

    const labelX = (fromX + toX) / 2;
    let labelColor = '#bbb';
    if (step.approved === true) labelColor = '#66bb6a';
    if (step.approved === false) labelColor = '#ff7043';

    svg += `<text x="${labelX}" y="${y - 6}" text-anchor="middle" font-size="9.5" font-weight="500" fill="${labelColor}">${escapeHtml(step.label)}</text>`;
    if (step.latency) {
      const lat = step.latency < 1000 ? step.latency + 'ms' : (step.latency / 1000).toFixed(1) + 's';
      svg += `<text x="${labelX}" y="${y + 13}" text-anchor="middle" font-size="8" fill="#555">${lat}</text>`;
    }
    svg += `</g>`;
  });

  // ── Build transcript entries ──
  const speakerColors = {
    'TUTOR EGO': '#42a5f5', 'TUTOR EGO (draft)': '#42a5f5', 'TUTOR EGO (revised)': '#42a5f5',
    'SUPEREGO': '#66bb6a', 'LEARNER EGO': '#ab47bc', 'LEARNER SUPEREGO': '#ef5350',
    'LEARNER': '#78909c',
  };

  let transcriptHtml = '';
  steps.forEach((step, i) => {
    const speaker = step.speaker || step.label;
    const color = speakerColors[speaker] || '#999';
    const content = step.fullDetail || step.detail || '';
    if (!content && step.type === 'response') return; // skip empty response arrows without content

    let badge = '';
    if (step.approved === true) badge = '<span class="badge approved">APPROVED</span>';
    else if (step.approved === false) badge = '<span class="badge revise">REVISE</span>';

    const modelStr = step.model ? `<span class="entry-model">${escapeHtml(String(step.model).split('/').pop().split(':')[0])}</span>` : '';

    transcriptHtml += `<div class="entry" id="entry-${i}" data-step="${i}" onclick="highlight(${i})">
  <div class="entry-speaker" style="color:${color}">${escapeHtml(speaker)} ${badge} ${modelStr}</div>
  <div class="entry-content">${escapeHtml(content)}</div>
</div>\n`;
  });

  // ── Judge table ──
  let judgeRows = '';
  for (const [dim, data] of Object.entries(judgeScores)) {
    const label = dim.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const sv = data.score || 0;
    const reasoning = escapeHtml(data.reasoning || '');
    const barW = (sv / 5) * 100;
    const barC = sv >= 4 ? '#4caf50' : sv >= 3 ? '#ff9800' : '#f44336';
    judgeRows += `<tr>
      <td class="jd">${label}</td><td class="js" style="color:${barC}">${sv}</td>
      <td class="jb"><div class="bar-bg"><div class="bar-fg" style="width:${barW}%;background:${barC}"></div></div></td>
      <td class="jr">${reasoning}</td></tr>`;
  }

  // ── Qualitative ──
  let qualHtml = '';
  const axes = [
    ['pedagogical_arc', 'Pedagogical Arc'], ['recognition_dynamics', 'Recognition Dynamics'],
    ['superego_effectiveness', 'Superego Effectiveness'], ['learner_trajectory', 'Learner Trajectory'],
    ['missed_opportunities', 'Missed Opportunities'], ['overall_narrative', 'Overall Narrative'],
  ];
  for (const [k, lab] of axes) {
    if (qualitative[k]) {
      qualHtml += `<div class="qual-item"><div class="qual-label">${lab}</div><div class="qual-text">${escapeHtml(qualitative[k])}</div></div>`;
    }
  }
  if (qualitative.key_turning_point) {
    const ktp = qualitative.key_turning_point;
    qualHtml += `<div class="qual-ktp"><div class="qual-label" style="color:#ffab40">Key Turning Point (Turn ${ktp.turn || '?'})</div><div class="qual-text">${escapeHtml(ktp.description || '')}</div></div>`;
  }
  if (qualitative.tags?.length) {
    qualHtml += `<div class="qual-tags">${qualitative.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(scenario)} — ${escapeHtml(profile)}</title>
<style>
  :root { --bg:#0d1117; --surface:#161b22; --border:#30363d; --text:#e6edf3; --muted:#8b949e; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'SF Mono','Fira Code','JetBrains Mono',monospace; background:var(--bg); color:var(--text); height:100vh; overflow:hidden; display:flex; flex-direction:column; }

  .top-bar { padding:12px 20px; border-bottom:1px solid var(--border); background:var(--surface); display:flex; align-items:center; justify-content:space-between; flex-shrink:0; gap:20px; }
  .top-bar h1 { font-size:14px; font-weight:600; margin-bottom:4px; }
  .top-bar .meta-grid { display:grid; grid-template-columns:auto auto auto; gap:2px 16px; font-size:11px; }
  .top-bar .meta-label { color:var(--muted); }
  .top-bar .meta-value { color:var(--text); font-weight:500; }
  .top-bar .meta-id { font-size:9px; color:#555; margin-top:3px; }
  .top-bar .score-badge { padding:3px 12px; border-radius:12px; font-weight:700; font-size:14px; color:#fff;
    background:${parseFloat(score) >= 90 ? '#1b5e20' : parseFloat(score) >= 70 ? '#e65100' : '#b71c1c'}; }

  .split { display:flex; flex:1; overflow:hidden; }

  /* Left: sequence diagram */
  .left-pane { width:50%; overflow:auto; border-right:1px solid var(--border); padding:12px; flex-shrink:0; }
  .left-pane svg { display:block; margin:0 auto; }
  svg text { font-family:'SF Mono','Fira Code',monospace; }
  .arrow-group:hover .arrow-line { stroke-width:3 !important; }
  .arrow-group.active .arrow-line { stroke-width:3.5 !important; filter:drop-shadow(0 0 4px currentColor); }
  .arrow-group.active text { font-weight:700 !important; }

  .legend { display:flex; gap:14px; justify-content:center; padding:8px; font-size:10px; color:var(--muted); flex-shrink:0; }
  .legend span { display:flex; align-items:center; gap:3px; }
  .legend .sw { width:12px; height:3px; border-radius:2px; }

  /* Right: transcript (scrolls independently) */
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

  /* Judge panel — collapsible below split */
  .judge-panel { flex-shrink:0; border-top:1px solid var(--border); background:var(--surface); }
  .judge-toggle { padding:10px 20px; cursor:pointer; font-size:11px; text-transform:uppercase; letter-spacing:1.5px; color:var(--muted); font-weight:600; list-style:none; user-select:none; }
  .judge-toggle::-webkit-details-marker { display:none; }
  .judge-toggle::before { content:'▸ '; }
  .judge-panel[open] .judge-toggle::before { content:'▾ '; }
  .judge-body { padding:4px 20px 16px; max-height:50vh; overflow-y:auto; }
  table { width:100%; border-collapse:collapse; font-size:11px; }
  tr { border-bottom:1px solid #1e1e1e; }
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
</style>
</head>
<body>

<div class="top-bar">
  <div>
    <h1>${escapeHtml(scenario?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '')}</h1>
    <div class="meta-grid">
      <span class="meta-label">Cell</span><span class="meta-value">${escapeHtml(profile)}</span><span class="meta-value">${condLabel}${meta.totalTurns ? ' · ' + meta.totalTurns + ' turns' : ''}</span>
      <span class="meta-label">Tutor</span><span class="meta-value">ego ${escapeHtml(shortModel(meta.egoModel))}</span><span class="meta-value">superego ${escapeHtml(shortModel(meta.superegoModel) || shortModel(meta.egoModel))}</span>
      <span class="meta-label">Learner</span><span class="meta-value">ego ${escapeHtml(shortModel(meta.learnerEgoModel))}</span><span class="meta-value">superego ${escapeHtml(shortModel(meta.learnerSuperegoModel))}</span>
      <span class="meta-label">Judge</span><span class="meta-value">${escapeHtml(shortModel(meta.judgeModel))}</span><span></span>
    </div>
    <div class="meta-id">${escapeHtml(meta.runId)} · ${escapeHtml(meta.dialogueId)}</div>
  </div>
  <span class="score-badge">${score}</span>
</div>

<div class="legend">
  <span><span class="sw" style="background:#78909c"></span> Front stage</span>
  <span><span class="sw" style="background:#ef5350"></span> L.Superego</span>
  <span><span class="sw" style="background:#ab47bc"></span> L.Ego</span>
  <span><span class="sw" style="background:#42a5f5"></span> T.Ego</span>
  <span><span class="sw" style="background:#66bb6a"></span> T.Superego</span>
</div>

<div class="split">
  <div class="left-pane">
    <svg width="${svgWidth + 20}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">${svg}</svg>
  </div>
  <div class="right-pane" id="transcript">
    ${transcriptHtml}
  </div>
</div>

${(judgeRows || qualHtml) ? `<details class="judge-panel">
<summary class="judge-toggle">Judge Adjudication &mdash; ${score}/100</summary>
<div class="judge-body">
  ${judgeRows ? `<table>${judgeRows}</table>` : ''}
  ${qualHtml ? `<div style="margin-top:16px">${qualHtml}</div>` : ''}
</div>
</details>` : ''}

<script>
let activeStep = -1;
function highlight(idx) {
  // Clear previous
  document.querySelectorAll('.arrow-group.active').forEach(g => g.classList.remove('active'));
  document.querySelectorAll('.entry.active').forEach(e => e.classList.remove('active'));

  // Activate
  const arrow = document.querySelector('.arrow-group[data-step="'+idx+'"]');
  const entry = document.getElementById('entry-' + idx);
  if (arrow) arrow.classList.add('active');
  if (entry) {
    entry.classList.add('active');
    entry.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  // Also scroll SVG to show the arrow
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

// Keyboard navigation
document.addEventListener('keydown', e => {
  const maxStep = document.querySelectorAll('.arrow-group').length - 1;
  if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); highlight(Math.min(activeStep + 1, maxStep)); }
  if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); highlight(Math.max(activeStep - 1, 0)); }
});
</script>
</body>
</html>`;
}

// ── Main loop ────────────────────────────────────────────────────────────────

fs.mkdirSync(outputDir, { recursive: true });
const rendered = [];

for (const result of results) {
  const dialogueId = result.dialogue_id;
  const logFiles = fs.readdirSync(LOGS_DIR).filter(f => f.includes(dialogueId));

  if (logFiles.length === 0) {
    console.log(`  ⚠ No log file for ${dialogueId}, skipping`);
    continue;
  }

  const logPath = path.join(LOGS_DIR, logFiles[0]);
  const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
  const trace = log.consolidatedTrace || log.dialogueTrace || [];

  if (trace.length === 0) {
    console.log(`  ⚠ Empty trace for ${dialogueId}, skipping`);
    continue;
  }

  const steps = traceToSteps(trace);
  if (steps.length === 0) {
    console.log(`  ⚠ No sequence steps for ${dialogueId}, skipping`);
    continue;
  }

  // Collect metadata from log + DB result for the header
  // Resolve learner models from config
  let learnerEgoModel = '', learnerSuperegoModel = '';
  try {
    const learnerYaml = YAML.parse(fs.readFileSync(path.join(process.cwd(), 'config/learner-agents.yaml'), 'utf8'));
    const arch = log.learnerArchitecture || 'unified';
    const prof = learnerYaml.profiles?.[arch];
    if (prof?.ego) {
      learnerEgoModel = (prof.ego.provider ? prof.ego.provider + '.' : '') + (prof.ego.model || '');
      learnerSuperegoModel = (prof.superego?.provider ? prof.superego.provider + '.' : '') + (prof.superego?.model || '');
    } else if (prof?.unified_learner) {
      learnerEgoModel = (prof.unified_learner.provider ? prof.unified_learner.provider + '.' : '') + (prof.unified_learner.model || '');
      learnerSuperegoModel = learnerEgoModel;
    }
  } catch {}

  const meta = {
    runId,
    egoModel: result.ego_model || log.model || '',
    superegoModel: result.superego_model || '',
    judgeModel: result.judge_model || '',
    learnerArch: log.learnerArchitecture || '',
    learnerEgoModel,
    learnerSuperegoModel,
    totalTurns: log.totalTurns || '',
    dialogueId: dialogueId,
  };

  const html = generateHtml(result, steps, trace, meta);
  const filename = `sequence-${result.profile_name}-${result.scenario_id}-${result.overall_score?.toFixed(0) || '0'}.html`;
  const outPath = path.join(outputDir, filename);

  fs.writeFileSync(outPath, html);
  rendered.push(outPath);
  console.log(`  ✓ ${filename} (${steps.length} steps, score ${result.overall_score?.toFixed(1)})`);
}

console.log(`\nRendered ${rendered.length} diagram(s) to ${outputDir}/`);

if (shouldOpen && rendered.length > 0) {
  try {
    execSync(`open "${rendered[0]}"`);
    console.log(`Opened: ${path.basename(rendered[0])}`);
  } catch { /* ignore */ }
}

db.close();
