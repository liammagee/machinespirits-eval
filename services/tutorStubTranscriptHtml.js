import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const TUTOR_STUB_TRANSCRIPT_HTML_SCHEMA = 'machinespirits.tutor-stub.transcript-html.v1';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/gu, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function safeJson(value) {
  return JSON.stringify(value ?? null, null, 2).replace(/<\//gu, '<\\/');
}

function oneLine(value) {
  return String(value ?? '').replace(/\s+/gu, ' ').trim();
}

function flattenSettings(value, prefix = '', rows = []) {
  if (value === null || value === undefined || typeof value !== 'object') {
    rows.push([prefix || 'value', value]);
    return rows;
  }
  if (Array.isArray(value)) {
    rows.push([prefix || 'value', value.join(', ')]);
    return rows;
  }
  for (const [key, child] of Object.entries(value)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) flattenSettings(child, next, rows);
    else rows.push([next, Array.isArray(child) ? child.join(', ') : child]);
  }
  return rows;
}

function transcriptMessages(snapshot) {
  if (Array.isArray(snapshot.history) && snapshot.history.length) return snapshot.history;
  const messages = [];
  if (snapshot.opening) messages.push({ role: 'assistant', content: snapshot.opening, kind: 'opening' });
  for (const turn of snapshot.turns || []) {
    messages.push({ role: 'user', content: turn.learner, turn: turn.turn });
    messages.push({ role: 'assistant', content: turn.tutor, turn: turn.turn });
  }
  return messages;
}

function rawView(snapshot) {
  const text = transcriptMessages(snapshot)
    .map((message, index) => {
      const speaker = message.role === 'assistant' ? 'TUTOR' : 'LEARNER';
      const marker = message.kind === 'opening' ? 'OPENING' : `MESSAGE ${index + 1}`;
      return `[${marker}] ${speaker}\n${message.content || ''}`;
    })
    .join('\n\n');
  return `<pre class="raw-transcript">${escapeHtml(text || '(No public transcript yet.)')}</pre>`;
}

function stageCard(snapshot) {
  const stage = snapshot.directorContext?.stageNotes || snapshot.settings?.world?.opening || '';
  if (!stage) return '';
  return `<article class="speech-card stage"><div class="speaker">Stage</div><div class="speech">${escapeHtml(stage)}</div></article>`;
}

function registerPills(turn) {
  const selection = turn.registerSelection || {};
  const configuration = turn.responseConfiguration || selection.response_configuration || {};
  const learnerAdvance = turn.learnerAdvance || turn.tutorLearnerDagUpdate?.advance || null;
  const values = [
    ['policy', selection.policy],
    ['active', selection.activated_policy],
    ['stance', selection.engagement_stance || selection.selected_register],
    ['action', configuration.action_family],
    ['audience', configuration.audience_register],
    ['language', configuration.lexical_accessibility],
    ['scene', configuration.scene_immersion],
    ['pace', learnerAdvance?.accelerated ? `${learnerAdvance.pace} (${learnerAdvance.supportedMoveCount} moves)` : null],
  ];
  return `<div class="pills">${values
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => `<span>${escapeHtml(label)}: ${escapeHtml(value)}</span>`)
    .join('')}</div>`;
}

function speechCard(role, text, turn, { opening = false } = {}) {
  return `<article class="speech-card ${escapeHtml(role)}">
    <div class="speech-head"><span class="speaker">${escapeHtml(role)}</span><span>${opening ? 'opening' : `turn ${escapeHtml(turn)}`}</span></div>
    <div class="speech">${escapeHtml(text || '')}</div>
  </article>`;
}

function scriptView(snapshot) {
  const blocks = [stageCard(snapshot)];
  if (snapshot.opening) blocks.push(speechCard('tutor', snapshot.opening, 0, { opening: true }));
  for (const turn of snapshot.turns || []) {
    blocks.push(speechCard('learner', turn.learner, turn.turn));
    blocks.push(`${speechCard('tutor', turn.tutor, turn.turn)}${registerPills(turn)}`);
  }
  if (blocks.filter(Boolean).length === 0) return '<div class="empty">No public transcript yet.</div>';
  return `<div class="script-view">${blocks.filter(Boolean).join('')}</div>`;
}

function swimlaneView(snapshot) {
  const rows = [];
  if (snapshot.opening) {
    rows.push(`<div class="swim-row"><div class="lane tutor">${speechCard('tutor', snapshot.opening, 0, { opening: true })}</div><div class="spine"><b>0</b></div><div class="lane"></div></div>`);
  }
  for (const turn of snapshot.turns || []) {
    rows.push(`<div class="swim-row">
      <div class="lane tutor">${speechCard('tutor', turn.tutor, turn.turn)}${registerPills(turn)}</div>
      <div class="spine"><b>${escapeHtml(turn.turn)}</b></div>
      <div class="lane learner">${speechCard('learner', turn.learner, turn.turn)}</div>
    </div>`);
  }
  if (!rows.length) return '<div class="empty">No public transcript yet.</div>';
  return `<div class="swimlanes"><div class="swim-head"><span>tutor</span><i></i><span>learner</span></div>${rows.join('')}</div>`;
}

function promptBlock(title, prompt, meta = '') {
  return `<details class="prompt" open><summary>${escapeHtml(title)}${meta ? `<small>${escapeHtml(meta)}</small>` : ''}</summary><pre>${escapeHtml(prompt || '(not captured)')}</pre></details>`;
}

function promptsView(snapshot) {
  const tutor = snapshot.prompts?.tutor || {};
  const learner = snapshot.prompts?.learner || {};
  const tutorTurns = (tutor.turns || []).map((entry) => `<section class="prompt-pair">
    <h3>Tutor turn ${escapeHtml(entry.turn)}</h3>
    ${promptBlock('Effective system prompt', entry.systemPrompt, entry.role || '')}
    ${promptBlock('User prompt', entry.userPrompt, entry.repairAttempt ? `repair ${entry.repairAttempt}` : 'generation')}
    ${promptBlock('Message history', safeJson(entry.messageHistory || []))}
  </section>`).join('');
  const learnerHistory = (learner.history || []).map((entry) => `<section class="prompt-pair">
    <h3>Learner draft turn ${escapeHtml(entry.turn)}</h3>
    ${promptBlock('System prompt', entry.systemPrompt, entry.profileId || 'custom')}
    ${promptBlock('User prompt', entry.userPrompt, `request ${entry.requestId || 'n/a'}`)}
  </section>`).join('');
  return `<div class="prompt-grid">
    <section><h2>Tutor prompts</h2>${promptBlock('Base tutor system prompt', tutor.baseSystemPrompt)}${tutorTurns || '<p class="empty">No completed tutor-turn prompt snapshots yet.</p>'}</section>
    <section><h2>Learner prompts</h2>${promptBlock('Active learner system prompt', learner.activeSystemPrompt, learner.mode || '')}${promptBlock('Next learner user prompt', learner.nextUserPrompt)}${learnerHistory || '<p class="empty">No generated learner-prompt history yet.</p>'}</section>
  </div>`;
}

function analysisCard(turn) {
  const selection = turn.registerSelection || {};
  const classification = turn.classification || {};
  const configuration = turn.responseConfiguration || selection.response_configuration || {};
  const learnerAdvance = turn.learnerAdvance || turn.tutorLearnerDagUpdate?.advance || null;
  const summary = classification.turn?.summary || classification.overall?.summary || 'No plain summary captured.';
  const rationale =
    selection.register_reason ||
    selection.engagement_stance_reason ||
    selection.reason ||
    selection.rationale ||
    'No register-selection rationale captured.';
  return `<article class="analysis-card">
    <header><h3>Turn ${escapeHtml(turn.turn)}</h3><strong>${escapeHtml(selection.engagement_stance || selection.selected_register || 'no stance')}</strong></header>
    <p><b>Learner reading:</b> ${escapeHtml(summary)}</p>
    ${learnerAdvance?.accelerated ? `<p><b>Learning pace:</b> accelerating — ${escapeHtml(learnerAdvance.adoptedPremiseCount)} premises and ${escapeHtml(learnerAdvance.derivedFactCount)} supported inferences accepted together.</p>` : ''}
    <p><b>Selection rationale:</b> ${escapeHtml(rationale)}</p>
    ${registerPills(turn)}
    <details><summary>Full learner analysis</summary><pre>${escapeHtml(safeJson(classification))}</pre></details>
    <details><summary>Learner DAG analysis</summary><pre>${escapeHtml(safeJson(turn.tutorLearnerDagModel))}</pre></details>
    <details><summary>Register-selection input and result</summary><pre>${escapeHtml(safeJson({
      selection,
      responseConfiguration: configuration,
      previousRegisterEfficacy: turn.previousRegisterEfficacy || null,
      responseConfigurationAudit: turn.responseConfigurationAudit || null,
    }))}</pre></details>
  </article>`;
}

function analysisView(snapshot) {
  const turns = snapshot.turns || [];
  return turns.length
    ? `<div class="analysis-list">${turns.map(analysisCard).join('')}</div>`
    : '<div class="empty">No completed learner analysis or register selection yet.</div>';
}

function settingsView(snapshot) {
  const rows = flattenSettings(snapshot.settings || {}).map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`).join('');
  return `<div class="settings-grid"><section><h2>Selected settings and options</h2><table><tbody>${rows}</tbody></table></section><section><h2>Snapshot envelope</h2><pre>${escapeHtml(safeJson({
    schema: snapshot.schema,
    generatedAt: snapshot.generatedAt,
    runId: snapshot.runId,
    turns: (snapshot.turns || []).length,
  }))}</pre></section></div>`;
}

export function renderTutorStubTranscriptHtml(snapshot = {}) {
  const title = snapshot.settings?.world?.title || snapshot.title || 'Tutor Stub Transcript';
  const views = {
    raw: rawView(snapshot),
    script: scriptView(snapshot),
    swimlanes: swimlaneView(snapshot),
    analysis: analysisView(snapshot),
    prompts: promptsView(snapshot),
    settings: settingsView(snapshot),
  };
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} · transcript</title>
<style>
:root{--paper:#f5f0e6;--paper2:#fffaf0;--ink:#151515;--muted:#686159;--rule:#b8ad9d;--tutor:#285943;--learner:#a45a24;--accent:#b3261e}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.55 Georgia,serif}button,pre,table,.speaker,.eyebrow{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.shell{max-width:1280px;margin:auto;padding:28px}.hero{border-bottom:3px solid var(--ink);padding-bottom:18px}.eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}h1{font-size:clamp(28px,5vw,56px);line-height:1;margin:8px 0}.subtitle{color:var(--muted)}.tabs{display:flex;flex-wrap:wrap;gap:0;margin:20px 0;border-bottom:2px solid var(--ink)}.tabs button{border:2px solid var(--ink);border-bottom:0;background:var(--paper2);padding:9px 14px;cursor:pointer;text-transform:uppercase;font-size:11px;font-weight:700}.tabs button+button{border-left:0}.tabs button.active{background:var(--ink);color:var(--paper2)}.view{display:none}.view.active{display:block}.raw-transcript,pre{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--paper2);border:1px solid var(--rule);padding:16px;max-height:70vh;overflow:auto;font-size:12px}.script-view,.analysis-list{display:grid;gap:12px}.speech-card{border:1px solid var(--rule);border-left:6px solid var(--ink);background:var(--paper2);padding:14px}.speech-card.tutor{border-left-color:var(--tutor)}.speech-card.learner{border-left-color:var(--learner)}.speech-card.stage{border-style:dashed;color:var(--muted);font-style:italic}.speech-head,.analysis-card header{display:flex;justify-content:space-between;gap:12px}.speaker{text-transform:uppercase;letter-spacing:.12em;font-size:11px;font-weight:800}.speech{white-space:pre-wrap}.pills{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 14px}.pills span{border:1px solid var(--rule);background:var(--paper2);padding:2px 6px;font:10px ui-monospace,monospace}.swimlanes{display:grid;gap:10px}.swim-head,.swim-row{display:grid;grid-template-columns:minmax(0,1fr) 52px minmax(0,1fr);gap:12px}.swim-head{position:sticky;top:0;background:var(--paper);z-index:2;text-transform:uppercase;font:700 11px ui-monospace,monospace}.swim-head span:last-child{text-align:right}.lane{min-width:0}.lane .speech-card{height:100%}.spine{position:relative}.spine:before{content:"";position:absolute;left:50%;top:-12px;bottom:-12px;width:2px;background:var(--rule)}.spine b{position:relative;display:block;width:30px;height:30px;margin:4px auto;border-radius:50%;background:var(--ink);color:var(--paper);text-align:center;line-height:30px;font:700 11px/30px ui-monospace,monospace}.prompt-grid,.settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.prompt,.analysis-card,.settings-grid section{border:1px solid var(--rule);background:var(--paper2);padding:12px}.prompt summary,details summary{cursor:pointer;font-weight:700}.prompt summary small{float:right;color:var(--muted);font-weight:400}.prompt-pair{border-top:3px solid var(--ink);margin-top:18px}.analysis-card{border-left:6px solid var(--accent)}table{width:100%;border-collapse:collapse;font-size:12px}th,td{text-align:left;vertical-align:top;border-bottom:1px solid var(--rule);padding:7px}th{width:42%}.empty{padding:20px;border:1px dashed var(--rule);color:var(--muted)}@media(max-width:760px){.shell{padding:16px}.prompt-grid,.settings-grid{grid-template-columns:1fr}.swim-head,.swim-row{grid-template-columns:1fr}.spine,.swim-head i{display:none}.swim-head span:last-child{text-align:left}}
</style></head><body><main class="shell"><header class="hero"><div class="eyebrow">Tutor stub · live transcript snapshot</div><h1>${escapeHtml(title)}</h1><div class="subtitle">${escapeHtml(snapshot.settings?.world?.question || '')} · ${escapeHtml((snapshot.turns || []).length)} completed turns · updated ${escapeHtml(snapshot.generatedAt || '')}</div></header>
<nav class="tabs" aria-label="Transcript views">${Object.keys(views).map((name, index) => `<button type="button" data-view="${name}" class="${index === 0 ? 'active' : ''}">${name}</button>`).join('')}</nav>
${Object.entries(views).map(([name, html], index) => `<section class="view ${index === 0 ? 'active' : ''}" data-panel="${name}">${html}</section>`).join('')}
</main><script>document.querySelectorAll('[data-view]').forEach(function(button){button.addEventListener('click',function(){document.querySelectorAll('[data-view]').forEach(function(item){item.classList.remove('active')});document.querySelectorAll('[data-panel]').forEach(function(item){item.classList.remove('active')});button.classList.add('active');document.querySelector('[data-panel="'+button.dataset.view+'"]').classList.add('active')})});</script></body></html>`;
}

export function writeTutorStubTranscriptHtml({ snapshot, filePath }) {
  const absolute = path.resolve(filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, renderTutorStubTranscriptHtml(snapshot), 'utf8');
  return absolute;
}

export function launchTutorStubTranscriptHtml(filePath, { spawnImpl = spawn, platform = process.platform } = {}) {
  const absolute = path.resolve(filePath);
  const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '', absolute] : [absolute];
  const child = spawnImpl(command, args, { detached: true, stdio: 'ignore' });
  child.once?.('error', () => {});
  child.unref?.();
  return { command, args, filePath: absolute };
}
