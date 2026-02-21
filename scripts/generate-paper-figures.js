#!/usr/bin/env node

/**
 * Generate Paper Figures
 *
 * Produces print-ready HTML figures from evaluation dialogues:
 *   1. Light-themed sequence diagrams (SVG) for bilateral multi-turn dialogues
 *   2. Transcript excerpt panels for single-turn or multi-turn dialogues
 *   3. Side-by-side comparison panels (base vs recognition)
 *
 * Usage:
 *   node scripts/generate-paper-figures.js <dialogueId> [options]
 *   node scripts/generate-paper-figures.js --compare <id1> <id2> [options]
 *   node scripts/generate-paper-figures.js --run <runId> --scenario <id> [options]
 *
 * Options:
 *   --output <dir>     Output directory (default: exports/paper-figures)
 *   --format <type>    Output format: html, png, both (default: both)
 *   --width <px>       Figure width (default: 1000)
 *   --open             Open first figure in browser
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import Database from 'better-sqlite3';

const DB_PATH = path.join(import.meta.dirname, '..', 'data', 'evaluations.db');
const LOGS_DIR = path.join(import.meta.dirname, '..', 'logs', 'tutor-dialogues');
const DEFAULT_OUTPUT = path.join(import.meta.dirname, '..', 'exports', 'paper-figures');

// ── CLI parsing ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage:
  generate-paper-figures.js <dialogueId>                    Single dialogue figure
  generate-paper-figures.js --compare <id1> <id2>           Side-by-side comparison
  generate-paper-figures.js --run <runId> --scenario <id>   All dialogues for scenario in run

Options:
  --output <dir>     Output directory (default: exports/paper-figures)
  --format <type>    html, png, both (default: both)
  --width <px>       Figure width (default: 1000)
  --open             Open in browser
  --transcript-only  Skip sequence diagram, only render transcript
  `);
  process.exit(0);
}

function getOption(name) {
  const idx = args.indexOf('--' + name);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
}
function getFlag(name) {
  return args.includes('--' + name);
}

const outputDir = getOption('output') || DEFAULT_OUTPUT;
const format = getOption('format') || 'both';
const figWidth = parseInt(getOption('width') || '1000');
const shouldOpen = getFlag('open');
const transcriptOnly = getFlag('transcript-only');
const isCompare = getFlag('compare');
const runFilter = getOption('run');
const scenarioFilter = getOption('scenario');

fs.mkdirSync(outputDir, { recursive: true });
const db = new Database(DB_PATH, { readonly: true });

// ── Data loading ─────────────────────────────────────────────────────────────

function loadDialogue(dialogueId) {
  const row = db
    .prepare(
      `
    SELECT id, run_id, profile_name, scenario_id, dialogue_id,
      overall_score, judge_model, ego_model, superego_model,
      score_relevance, score_specificity, score_pedagogical,
      score_personalization, score_actionability, score_tone,
      scores_with_reasoning, qualitative_assessment, suggestions
    FROM evaluation_results
    WHERE dialogue_id = ? AND judge_model = 'claude-opus-4.6'
    ORDER BY overall_score DESC LIMIT 1
  `,
    )
    .get(dialogueId);

  if (!row) {
    console.error(`No scored dialogue found: ${dialogueId}`);
    return null;
  }

  // Load trace from log file
  const logFiles = fs.readdirSync(LOGS_DIR).filter((f) => f.includes(dialogueId));
  let trace = [];
  let log = {};
  if (logFiles.length > 0) {
    log = JSON.parse(fs.readFileSync(path.join(LOGS_DIR, logFiles[0]), 'utf8'));
    trace = log.consolidatedTrace || log.dialogueTrace || [];
  }

  // Detect multi-turn: look for turn_action events (learner followups)
  const isMultiTurn = trace.some((e) => e.agent === 'user' && e.action === 'turn_action');

  return { row, trace, log, isMultiTurn };
}

function loadByRunScenario(runId, scenarioId) {
  const rows = db
    .prepare(
      `
    SELECT dialogue_id FROM evaluation_results
    WHERE run_id = ? AND scenario_id LIKE ? AND judge_model = 'claude-opus-4.6'
      AND overall_score IS NOT NULL
    ORDER BY overall_score DESC
  `,
    )
    .all(runId, '%' + scenarioId + '%');
  return rows.map((r) => r.dialogue_id);
}

// ── HTML helpers ─────────────────────────────────────────────────────────────

function esc(text) {
  if (!text) return '';
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function shortModel(m) {
  if (!m) return '—';
  return String(m)
    .replace(/^openrouter\./, '')
    .split('/')
    .pop()
    .split(':')[0];
}

function scenarioLabel(id) {
  return (id || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function scoreColor(s) {
  if (s >= 85) return '#1b5e20';
  if (s >= 70) return '#e65100';
  return '#b71c1c';
}

function conditionLabel(profile) {
  if (/recog/i.test(profile)) return 'Recognition';
  if (/naive/i.test(profile)) return 'Naive';
  if (/enhanced/i.test(profile)) return 'Enhanced';
  if (/placebo/i.test(profile)) return 'Placebo';
  return 'Base';
}

// ── Sequence diagram SVG (light theme) ───────────────────────────────────────

function buildSequenceSvg(trace, meta) {
  const actors = [
    { id: 'learner_superego', label: 'L.Superego', color: '#fce4ec', textColor: '#c62828', stroke: '#ef5350' },
    { id: 'learner_ego', label: 'L.Ego', color: '#f3e5f5', textColor: '#6a1b9a', stroke: '#ab47bc' },
    { id: 'tutor_ego', label: 'T.Ego', color: '#e3f2fd', textColor: '#1565c0', stroke: '#42a5f5' },
    { id: 'tutor_superego', label: 'T.Superego', color: '#e8f5e9', textColor: '#2e7d32', stroke: '#66bb6a' },
  ];
  const colMap = {};
  actors.forEach((a, i) => {
    colMap[a.id] = i;
  });

  const steps = traceToSteps(trace);
  if (steps.length === 0) return { svg: '', steps };

  const colWidth = 130;
  const rowHeight = 34;
  const headerHeight = 48;
  const padding = 16;
  const svgWidth = colWidth * actors.length + padding * 2;
  const svgHeight = headerHeight + steps.length * rowHeight + 20;

  let svg = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="font-family:'Helvetica Neue',Arial,sans-serif">`;
  svg += `<rect width="${svgWidth}" height="${svgHeight}" fill="white"/>`;

  // Column headers
  actors.forEach((a, i) => {
    const x = padding + i * colWidth;
    const cx = x + colWidth / 2;
    svg += `<rect x="${x + 6}" y="4" width="${colWidth - 12}" height="34" rx="4" fill="${a.color}" stroke="${a.stroke}" stroke-width="1"/>`;
    svg += `<text x="${cx}" y="20" text-anchor="middle" font-size="10" font-weight="600" fill="${a.textColor}">${a.label}</text>`;
    svg += `<text x="${cx}" y="32" text-anchor="middle" font-size="7.5" fill="${a.textColor}" opacity="0.6">${shortModel(a.id.startsWith('learner') ? meta.learnerModel : a.id === 'tutor_ego' ? meta.egoModel : meta.superegoModel)}</text>`;
    svg += `<line x1="${cx}" y1="${headerHeight}" x2="${cx}" y2="${svgHeight - 10}" stroke="#ddd" stroke-width="1" stroke-dasharray="3,3"/>`;
  });

  // Turn separators
  let prevTurn = '';
  steps.forEach((s, i) => {
    if (s.label.startsWith('Turn ') || s.label === 'Initial query') {
      const num = s.label === 'Initial query' ? 1 : parseInt(s.label.replace('Turn ', ''));
      if (num !== prevTurn) {
        const y = headerHeight + i * rowHeight;
        svg += `<line x1="${padding}" y1="${y}" x2="${svgWidth - padding}" y2="${y}" stroke="#e0e0e0" stroke-width="0.5"/>`;
        svg += `<text x="${svgWidth - padding + 3}" y="${y + 10}" font-size="8" fill="#999" font-weight="600">T${num}</text>`;
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
    if (step.type === 'front' || step.type === 'response') {
      color = '#78909c';
    } else {
      color = actors[fromCol].stroke;
    }

    const sw = step.type === 'front' || step.type === 'response' ? 2 : 1;
    const tipOff = isLR ? -5 : 5;

    svg += `<line x1="${fromX}" y1="${y}" x2="${toX + tipOff}" y2="${y}" stroke="${color}" stroke-width="${sw}"/>`;
    if (isLR) {
      svg += `<polygon points="${toX - 5},${y - 3} ${toX},${y} ${toX - 5},${y + 3}" fill="${color}"/>`;
    } else {
      svg += `<polygon points="${toX + 5},${y - 3} ${toX},${y} ${toX + 5},${y + 3}" fill="${color}"/>`;
    }

    const labelX = (fromX + toX) / 2;
    let labelColor = '#666';
    if (step.approved === true) labelColor = '#2e7d32';
    if (step.approved === false) labelColor = '#e65100';

    svg += `<text x="${labelX}" y="${y - 5}" text-anchor="middle" font-size="8.5" font-weight="500" fill="${labelColor}">${esc(step.label)}</text>`;
  });

  svg += '</svg>';
  return { svg, steps };
}

// ── Trace parser (shared with render-sequence-diagram.js) ────────────────────

function extractLearnerQuery(entry) {
  const raw = entry.rawContext || '';
  const match =
    raw.match(/Learner Messages?:\s*(.+?)(?:\n<\/|$)/s) || raw.match(/Recent Chat History\n-\s*User:\s*"(.+?)"/s);
  return match ? match[1].trim() : null;
}

function fullContent(entry) {
  if (entry.agent === 'superego' && entry.action === 'review') {
    return entry.feedback || entry.verdict?.feedback || '';
  }
  if (entry.suggestions?.length > 0) {
    return entry.suggestions.map((s) => s.message || s.text || s.title || '').join('\n\n');
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
  const learnerBlockStarts = new Set();
  trace.forEach((e, i) => {
    if (e.agent === 'learner_ego_initial') learnerBlockStarts.add(i);
  });
  let needsResponseArrow = false;

  for (let i = 0; i < trace.length; i++) {
    const e = trace[i];
    const { agent, action } = e;

    if (learnerBlockStarts.has(i) && needsResponseArrow) {
      let responseContent = '';
      for (let j = i - 1; j >= 0; j--) {
        const prev = trace[j];
        if (
          prev.agent === 'ego' &&
          (prev.action === 'generate' || prev.action === 'revise' || prev.action === 'incorporate-feedback')
        ) {
          responseContent = fullContent(prev);
          break;
        }
      }
      steps.push({
        from: 'tutor_ego',
        to: 'learner_ego',
        label: 'Response',
        fullDetail: responseContent,
        type: 'response',
        speaker: 'TUTOR EGO',
      });
      needsResponseArrow = false;
    }

    if (agent === 'system' || (agent === 'user' && action === 'final_output') || agent === 'learner_synthesis')
      continue;

    if (agent === 'user' && action === 'context_input') {
      dialogueTurn++;
      if (dialogueTurn === 1) {
        const query = extractLearnerQuery(e);
        const full = query || '(scenario prompt)';
        steps.push({
          from: 'learner_ego',
          to: 'tutor_ego',
          label: 'Initial query',
          fullDetail: full,
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
        if (trace[j].agent === 'superego' && trace[j].action === 'review') {
          superegoFollows = true;
          break;
        }
        if (learnerBlockStarts.has(j) || (trace[j].agent === 'user' && trace[j].action === 'context_input')) break;
      }
      if (action !== 'generate' && !superegoFollows) {
        steps.push({
          from: 'tutor_ego',
          to: 'learner_ego',
          label: 'Response',
          fullDetail: full,
          type: 'response',
          speaker: 'TUTOR EGO',
        });
        needsResponseArrow = false;
      } else {
        const label = action === 'generate' ? 'Draft' : 'Revised';
        steps.push({
          from: 'tutor_ego',
          to: 'tutor_superego',
          label,
          fullDetail: full,
          type: 'back',
          speaker: action === 'generate' ? 'TUTOR EGO (draft)' : 'TUTOR EGO (revised)',
        });
      }
      continue;
    }

    if (agent === 'superego' && action === 'review') {
      const approved = e.approved;
      const full = fullContent(e);
      steps.push({
        from: approved ? 'tutor_superego' : 'tutor_superego',
        to: 'tutor_ego',
        label: approved ? 'Approved \u2713' : 'Revise \u21BB',
        fullDetail: full,
        type: 'back',
        approved,
        speaker: 'SUPEREGO',
      });
      if (approved) {
        let responseContent = '';
        for (let j = i - 1; j >= 0; j--) {
          const prev = trace[j];
          if (
            prev.agent === 'ego' &&
            (prev.action === 'generate' || prev.action === 'revise' || prev.action === 'incorporate-feedback')
          ) {
            responseContent = fullContent(prev);
            break;
          }
        }
        steps.push({
          from: 'tutor_ego',
          to: 'learner_ego',
          label: 'Response',
          fullDetail: responseContent,
          type: 'response',
          speaker: 'TUTOR EGO',
        });
        needsResponseArrow = false;
      }
      continue;
    }

    if (agent === 'learner_ego_initial' && action === 'deliberation') {
      steps.push({
        from: 'learner_ego',
        to: 'learner_superego',
        label: 'Reaction',
        fullDetail: fullContent(e),
        type: 'back',
        speaker: 'LEARNER EGO',
      });
      continue;
    }
    if (agent === 'learner_superego' && action === 'deliberation') {
      steps.push({
        from: 'learner_superego',
        to: 'learner_ego',
        label: 'Critique',
        fullDetail: fullContent(e),
        type: 'back',
        speaker: 'LEARNER SUPEREGO',
      });
      continue;
    }
    if (agent === 'learner_ego_revision') continue;
    if (agent === 'user' && action === 'turn_action') {
      steps.push({
        from: 'learner_ego',
        to: 'tutor_ego',
        label: 'Turn ' + (dialogueTurn + 1),
        fullDetail: fullContent(e),
        type: 'front',
        speaker: 'LEARNER',
      });
      needsResponseArrow = true;
      continue;
    }
  }
  return steps;
}

// ── Single-turn transcript panel ─────────────────────────────────────────────

function buildSingleTurnHtml(data) {
  const { row } = data;
  let suggestions = [];
  try {
    suggestions = JSON.parse(row.suggestions || '[]');
  } catch {
    /* ignored */
  }

  const cond = conditionLabel(row.profile_name);
  const score = row.overall_score?.toFixed(1) || '--';

  let scoresHtml = '';
  try {
    const scores = JSON.parse(row.scores_with_reasoning || '{}');
    for (const [dim, info] of Object.entries(scores)) {
      const label = dim.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      const s = info.score || 0;
      const barColor = s >= 4 ? '#4caf50' : s >= 3 ? '#ff9800' : '#f44336';
      scoresHtml += `<div class="score-row">
        <span class="score-dim">${label}</span>
        <span class="score-val" style="color:${barColor}">${s}/5</span>
        <div class="score-bar"><div class="score-fill" style="width:${(s / 5) * 100}%;background:${barColor}"></div></div>
      </div>`;
    }
  } catch {
    /* ignored */
  }

  const suggestion = suggestions[0] || {};
  const messageHtml = esc(suggestion.message || '(no suggestion)');
  const titleHtml = esc(suggestion.title || '');
  const typeHtml = esc(suggestion.type || '');
  const reasoningHtml = esc(suggestion.reasoning || '');

  return `<div class="panel">
    <div class="panel-header">
      <div class="panel-title">
        <span class="cond-badge ${cond.toLowerCase()}">${cond}</span>
        <span class="scenario-name">${scenarioLabel(row.scenario_id)}</span>
      </div>
      <div class="panel-score" style="background:${scoreColor(parseFloat(score))}">${score}</div>
    </div>
    <div class="panel-meta">
      <span>Cell: ${esc(row.profile_name)}</span>
      <span>Model: ${shortModel(row.ego_model)}</span>
    </div>
    <div class="suggestion">
      <div class="sugg-header">
        <span class="sugg-type">${typeHtml}</span>
        <span class="sugg-title">${titleHtml}</span>
      </div>
      <div class="sugg-message">${messageHtml}</div>
      ${reasoningHtml ? `<div class="sugg-reasoning"><em>Reasoning:</em> ${reasoningHtml}</div>` : ''}
    </div>
    ${scoresHtml ? `<div class="scores">${scoresHtml}</div>` : ''}
  </div>`;
}

// ── Multi-turn transcript panel ──────────────────────────────────────────────

function buildMultiTurnHtml(data) {
  const { row, trace } = data;
  const steps = traceToSteps(trace);
  const cond = conditionLabel(row.profile_name);
  const score = row.overall_score?.toFixed(1) || '--';

  // Select key moments: initial query, responses, learner turns
  const keySteps = steps.filter(
    (s) =>
      s.type === 'front' ||
      s.type === 'response' ||
      s.approved === false ||
      s.speaker === 'LEARNER EGO' ||
      s.speaker === 'LEARNER SUPEREGO',
  );

  const speakerColors = {
    'TUTOR EGO': '#1565c0',
    'TUTOR EGO (draft)': '#1565c0',
    'TUTOR EGO (revised)': '#1565c0',
    SUPEREGO: '#2e7d32',
    'LEARNER EGO': '#6a1b9a',
    'LEARNER SUPEREGO': '#c62828',
    LEARNER: '#455a64',
  };

  let excerptHtml = '';
  const maxExcerpts = 8;
  const selected = keySteps.slice(0, maxExcerpts);
  for (const step of selected) {
    const color = speakerColors[step.speaker] || '#666';
    const content = (step.fullDetail || '').substring(0, 300) + ((step.fullDetail || '').length > 300 ? '...' : '');
    excerptHtml += `<div class="excerpt">
      <div class="excerpt-speaker" style="color:${color}">${esc(step.speaker)} <span class="excerpt-label">${esc(step.label)}</span></div>
      <div class="excerpt-content">${esc(content)}</div>
    </div>`;
  }

  return `<div class="panel">
    <div class="panel-header">
      <div class="panel-title">
        <span class="cond-badge ${cond.toLowerCase()}">${cond}</span>
        <span class="scenario-name">${scenarioLabel(row.scenario_id)}</span>
        <span class="turn-count">${data.log.totalTurns || '?'} turns</span>
      </div>
      <div class="panel-score" style="background:${scoreColor(parseFloat(score))}">${score}</div>
    </div>
    <div class="panel-meta">
      <span>Cell: ${esc(row.profile_name)}</span>
      <span>Ego: ${shortModel(row.ego_model)}</span>
      ${row.superego_model ? `<span>Superego: ${shortModel(row.superego_model)}</span>` : ''}
    </div>
    <div class="excerpts">${excerptHtml}</div>
  </div>`;
}

// ── Full page wrapper ────────────────────────────────────────────────────────

function wrapPage(title, bodyHtml, svgHtml = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; background: white; color: #222; padding: 24px; max-width: ${figWidth}px; }
  h1 { font-size: 16px; font-weight: 700; margin-bottom: 16px; color: #111; border-bottom: 2px solid #111; padding-bottom: 8px; }

  .figure-row { display: flex; gap: 20px; margin-bottom: 24px; }
  .figure-row > * { flex: 1; min-width: 0; }
  .figure-single { margin-bottom: 24px; }

  .svg-container { margin-bottom: 20px; overflow-x: auto; }
  .svg-container svg { display: block; max-width: 100%; }

  .panel { border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; background: #fafafa; }
  .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .panel-title { display: flex; align-items: center; gap: 8px; }
  .panel-score { color: white; font-weight: 700; font-size: 16px; padding: 4px 12px; border-radius: 12px; }
  .panel-meta { font-size: 11px; color: #888; margin-bottom: 12px; display: flex; gap: 12px; }

  .cond-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  .cond-badge.recognition { background: #e8f5e9; color: #2e7d32; }
  .cond-badge.base { background: #fafafa; color: #666; border: 1px solid #ddd; }
  .cond-badge.naive { background: #fff3e0; color: #e65100; }

  .scenario-name { font-size: 14px; font-weight: 600; }
  .turn-count { font-size: 11px; color: #999; }

  .suggestion { margin-bottom: 12px; }
  .sugg-header { display: flex; gap: 8px; align-items: baseline; margin-bottom: 4px; }
  .sugg-type { font-size: 10px; font-weight: 600; color: #1565c0; text-transform: uppercase; background: #e3f2fd; padding: 1px 6px; border-radius: 4px; }
  .sugg-title { font-size: 13px; font-weight: 600; }
  .sugg-message { font-size: 12px; line-height: 1.6; color: #333; padding: 8px 12px; background: white; border: 1px solid #e8e8e8; border-radius: 6px; }
  .sugg-reasoning { font-size: 11px; color: #888; margin-top: 6px; padding: 6px 12px; background: #f5f5f5; border-radius: 4px; }

  .scores { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 8px; }
  .score-row { display: flex; align-items: center; gap: 6px; font-size: 10px; }
  .score-dim { width: 90px; color: #666; }
  .score-val { width: 28px; font-weight: 700; text-align: center; }
  .score-bar { flex: 1; height: 4px; background: #eee; border-radius: 2px; }
  .score-fill { height: 4px; border-radius: 2px; }

  .excerpts { display: flex; flex-direction: column; gap: 8px; }
  .excerpt { padding: 8px 12px; background: white; border: 1px solid #e8e8e8; border-radius: 6px; }
  .excerpt-speaker { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px; }
  .excerpt-label { font-weight: 400; color: #999; }
  .excerpt-content { font-size: 11px; line-height: 1.5; color: #444; }

  .caption { font-size: 11px; color: #666; margin-top: 8px; font-style: italic; }
</style>
</head>
<body>
<h1>${esc(title)}</h1>
${svgHtml ? `<div class="svg-container">${svgHtml}</div>` : ''}
${bodyHtml}
</body>
</html>`;
}

// ── PNG conversion ───────────────────────────────────────────────────────────

function htmlToPng(htmlPath, pngPath) {
  try {
    const absHtml = path.resolve(htmlPath);
    const absPng = path.resolve(pngPath);
    // Remove existing file first — capture-website-cli refuses to overwrite
    if (fs.existsSync(absPng)) fs.unlinkSync(absPng);
    execSync(
      `npx capture-website-cli "file://${absHtml}" --output "${absPng}" --width ${figWidth} --full-page --type png --scale-factor 2 --delay 0.5`,
      { stdio: 'pipe' },
    );
    return true;
  } catch (e) {
    console.error(`  ⚠ PNG conversion failed: ${e.message}`);
    return false;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

const rendered = [];

if (isCompare) {
  // Side-by-side comparison: --compare <id1> <id2>
  const ids = args.filter(
    (a) => !a.startsWith('--') && a !== getOption('output') && a !== getOption('format') && a !== getOption('width'),
  );
  if (ids.length < 2) {
    console.error('--compare requires two dialogue IDs');
    process.exit(1);
  }

  const d1 = loadDialogue(ids[0]);
  const d2 = loadDialogue(ids[1]);
  if (!d1 || !d2) process.exit(1);

  const isMultiTurn1 = d1.isMultiTurn;
  const isMultiTurn2 = d2.isMultiTurn;

  const title = `${scenarioLabel(d1.row.scenario_id)}: ${conditionLabel(d1.row.profile_name)} vs ${conditionLabel(d2.row.profile_name)}`;

  let svgHtml = '';
  if (!transcriptOnly && isMultiTurn1 && isMultiTurn2) {
    const svg1 = buildSequenceSvg(d1.trace, {
      egoModel: d1.row.ego_model,
      superegoModel: d1.row.superego_model,
      learnerModel: '',
    });
    const svg2 = buildSequenceSvg(d2.trace, {
      egoModel: d2.row.ego_model,
      superegoModel: d2.row.superego_model,
      learnerModel: '',
    });
    svgHtml = `<div class="figure-row"><div>${svg1.svg}</div><div>${svg2.svg}</div></div>`;
  }

  const panel1 = isMultiTurn1 ? buildMultiTurnHtml(d1) : buildSingleTurnHtml(d1);
  const panel2 = isMultiTurn2 ? buildMultiTurnHtml(d2) : buildSingleTurnHtml(d2);
  const bodyHtml = `<div class="figure-row">${panel1}${panel2}</div>`;

  const html = wrapPage(title, bodyHtml, svgHtml);
  const cond1 = conditionLabel(d1.row.profile_name).toLowerCase();
  const cond2 = conditionLabel(d2.row.profile_name).toLowerCase();
  const baseName = `compare-${d1.row.scenario_id}-${cond1}-vs-${cond2}`;
  const htmlPath = path.join(outputDir, `${baseName}.html`);
  fs.writeFileSync(htmlPath, html);
  rendered.push(htmlPath);
  console.log(`  ✓ ${baseName}.html`);

  if (format === 'png' || format === 'both') {
    const pngPath = path.join(outputDir, `${baseName}.png`);
    if (htmlToPng(htmlPath, pngPath)) {
      rendered.push(pngPath);
      console.log(`  ✓ ${baseName}.png`);
    }
  }
} else if (runFilter && scenarioFilter) {
  // All dialogues for a run+scenario
  const dialogueIds = loadByRunScenario(runFilter, scenarioFilter);
  console.log(`Found ${dialogueIds.length} dialogues for ${scenarioFilter} in ${runFilter}`);

  for (const did of dialogueIds) {
    const data = loadDialogue(did);
    if (!data) continue;

    const isMultiTurn = data.isMultiTurn;
    const title = `${scenarioLabel(data.row.scenario_id)} — ${conditionLabel(data.row.profile_name)} (${data.row.overall_score?.toFixed(1)})`;

    let svgHtml = '';
    if (!transcriptOnly && isMultiTurn) {
      const { svg } = buildSequenceSvg(data.trace, {
        egoModel: data.row.ego_model,
        superegoModel: data.row.superego_model,
        learnerModel: '',
      });
      svgHtml = svg;
    }

    const panel = isMultiTurn ? buildMultiTurnHtml(data) : buildSingleTurnHtml(data);
    const html = wrapPage(title, `<div class="figure-single">${panel}</div>`, svgHtml);

    const baseName = `figure-${data.row.profile_name}-${data.row.scenario_id}-${data.row.overall_score?.toFixed(0) || '0'}`;
    const htmlPath = path.join(outputDir, `${baseName}.html`);
    fs.writeFileSync(htmlPath, html);
    rendered.push(htmlPath);
    console.log(`  ✓ ${baseName}.html (score ${data.row.overall_score?.toFixed(1)})`);

    if (format === 'png' || format === 'both') {
      const pngPath = path.join(outputDir, `${baseName}.png`);
      if (htmlToPng(htmlPath, pngPath)) {
        rendered.push(pngPath);
        console.log(`  ✓ ${baseName}.png`);
      }
    }
  }
} else {
  // Single dialogue
  const dialogueId = args.find(
    (a) => !a.startsWith('--') && a !== getOption('output') && a !== getOption('format') && a !== getOption('width'),
  );
  if (!dialogueId) {
    console.error('Provide a dialogue ID, or use --compare or --run + --scenario');
    process.exit(1);
  }

  const data = loadDialogue(dialogueId);
  if (!data) process.exit(1);

  const isMultiTurn = data.isMultiTurn;
  const title = `${scenarioLabel(data.row.scenario_id)} — ${conditionLabel(data.row.profile_name)} (${data.row.overall_score?.toFixed(1)})`;

  let svgHtml = '';
  if (!transcriptOnly && isMultiTurn) {
    const { svg } = buildSequenceSvg(data.trace, {
      egoModel: data.row.ego_model,
      superegoModel: data.row.superego_model,
      learnerModel: '',
    });
    svgHtml = svg;
  }

  const panel = isMultiTurn ? buildMultiTurnHtml(data) : buildSingleTurnHtml(data);
  const html = wrapPage(title, `<div class="figure-single">${panel}</div>`, svgHtml);

  const baseName = `figure-${data.row.profile_name}-${data.row.scenario_id}-${data.row.overall_score?.toFixed(0) || '0'}`;
  const htmlPath = path.join(outputDir, `${baseName}.html`);
  fs.writeFileSync(htmlPath, html);
  rendered.push(htmlPath);
  console.log(`  ✓ ${baseName}.html`);

  if (format === 'png' || format === 'both') {
    const pngPath = path.join(outputDir, `${baseName}.png`);
    if (htmlToPng(htmlPath, pngPath)) {
      rendered.push(pngPath);
      console.log(`  ✓ ${baseName}.png`);
    }
  }
}

console.log(`\nRendered ${rendered.length} file(s) to ${outputDir}/`);

if (shouldOpen && rendered.length > 0) {
  const toOpen = rendered.find((f) => f.endsWith('.html')) || rendered[0];
  try {
    execSync(`open "${toOpen}"`);
  } catch {
    /* ignored */
  }
}

db.close();
