import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const TUTOR_STUB_TRANSCRIPT_HTML_SCHEMA = 'machinespirits.tutor-stub.transcript-html.v1';

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/gu,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character],
  );
}

function plainLabel(value) {
  return String(value ?? '')
    .replace(/[_-]+/gu, ' ')
    .trim();
}

function safeJson(value) {
  return JSON.stringify(value ?? null, null, 2).replace(/<\//gu, '<\\/');
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
  const messages = [];
  if (snapshot.opening) {
    messages.push({ role: 'assistant', content: snapshot.opening, kind: 'opening' });
  }
  for (const turn of snapshot.turns || []) {
    messages.push({ role: 'user', content: turn.learner, turn: turn.turn, kind: 'learner' });
    messages.push({ role: 'assistant', content: turn.tutor, turn: turn.turn, kind: 'tutor_reply' });
  }
  return messages.length ? messages : Array.isArray(snapshot.history) ? snapshot.history : [];
}

function replayMessages(snapshot) {
  const source = Array.isArray(snapshot.history) ? snapshot.history : transcriptMessages(snapshot);
  return source
    .filter((message) => message?.role === 'user' || message?.role === 'assistant')
    .map((message) => ({ role: message.role, content: String(message.content || '') }));
}

function replayRequestDetails(snapshot) {
  const tutor = snapshot.settings?.tutor || {};
  const provider = String(tutor.provider || '').toLowerCase();
  const model = tutor.model || tutor.modelRef || 'replace-with-model-id';
  const messages = replayMessages(snapshot);
  const messageJson = JSON.stringify(messages, null, 2);

  if (provider === 'anthropic' || provider === 'claude-code') {
    return {
      provider,
      model,
      messages,
      transportNote:
        provider === 'claude-code'
          ? 'The original run used Claude Code. This standalone version sends the same public messages through the Anthropic Messages API and therefore needs an ANTHROPIC_API_KEY.'
          : 'This standalone version uses the Anthropic Messages API and needs an ANTHROPIC_API_KEY.',
      code: [
        `const messages = ${messageJson};`,
        '',
        "const response = await fetch('https://api.anthropic.com/v1/messages', {",
        "  method: 'POST',",
        '  headers: {',
        "    'content-type': 'application/json',",
        "    'anthropic-version': '2023-06-01',",
        "    'x-api-key': process.env.ANTHROPIC_API_KEY,",
        '  },',
        '  body: JSON.stringify({',
        `    model: ${JSON.stringify(model)},`,
        `    max_tokens: ${Number(tutor.maxTokens) || 4096},`,
        '    messages,',
        '  }),',
        '});',
        '',
        'if (!response.ok) {',
        '  throw new Error(`${response.status} ${await response.text()}`);',
        '}',
        'console.log(JSON.stringify(await response.json(), null, 2));',
      ].join('\n'),
    };
  }

  if (provider === 'openrouter') {
    return {
      provider,
      model,
      messages,
      transportNote: 'This standalone version uses the OpenRouter Chat Completions API and needs an OPENROUTER_API_KEY.',
      code: [
        `const messages = ${messageJson};`,
        '',
        "const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {",
        "  method: 'POST',",
        '  headers: {',
        "    'content-type': 'application/json',",
        "    authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,",
        '  },',
        `  body: JSON.stringify({ model: ${JSON.stringify(model)}, messages }),`,
        '});',
        '',
        'if (!response.ok) {',
        '  throw new Error(`${response.status} ${await response.text()}`);',
        '}',
        'console.log(JSON.stringify(await response.json(), null, 2));',
      ].join('\n'),
    };
  }

  return {
    provider: provider || 'openai',
    model,
    messages,
    transportNote:
      provider === 'codex'
        ? 'The original run used the Codex CLI. This standalone version sends the same public messages through the OpenAI Responses API and therefore needs an OPENAI_API_KEY plus API access to the selected model id.'
        : 'This standalone version uses the OpenAI Responses API and needs an OPENAI_API_KEY.',
    code: [
      `const messages = ${messageJson};`,
      '',
      "const response = await fetch('https://api.openai.com/v1/responses', {",
      "  method: 'POST',",
      '  headers: {',
      "    'content-type': 'application/json',",
      "    authorization: `Bearer ${process.env.OPENAI_API_KEY}`,",
      '  },',
      '  body: JSON.stringify({',
      `    model: ${JSON.stringify(model)},`,
      '    input: messages,',
      '  }),',
      '});',
      '',
      'if (!response.ok) {',
      '  throw new Error(`${response.status} ${await response.text()}`);',
      '}',
      'console.log(JSON.stringify(await response.json(), null, 2));',
    ].join('\n'),
  };
}

export function buildTutorStubReplayJavascript(snapshot = {}) {
  return replayRequestDetails(snapshot).code;
}

function replayView(snapshot) {
  const replay = replayRequestDetails(snapshot);
  return `<div class="replay-view" data-replay-message-count="${escapeHtml(replay.messages.length)}">
    <div class="replay-head"><div><h2>Public-message replay</h2><p>The <code>messages</code> array preserves the completed public user/assistant sequence exactly as stored. Director notes, hidden prompts, DAG state, analysis, and response checks are intentionally absent.</p></div><button type="button" class="copy-code" data-copy-target="replay-js-code">Copy JavaScript</button></div>
    <p class="replay-note"><b>Transport:</b> ${escapeHtml(replay.transportNote)}</p>
    <pre id="replay-js-code" class="replay-code"><code>${escapeHtml(replay.code)}</code></pre>
  </div>`;
}

function rawView(snapshot) {
  const text = transcriptMessages(snapshot)
    .map((message, index) => {
      const speaker = message.role === 'assistant' ? 'TUTOR' : 'LEARNER';
      const marker =
        message.kind === 'opening'
          ? 'OPENING · TUTOR'
          : message.kind === 'learner'
            ? `TURN ${message.turn} · LEARNER`
            : message.kind === 'tutor_reply'
              ? `TURN ${message.turn} · TUTOR REPLY`
              : `MESSAGE ${index + 1} · ${speaker}`;
      return `[${marker}]\n${message.content || ''}`;
    })
    .join('\n\n');
  return `<pre class="raw-transcript">${escapeHtml(text || '(No public transcript yet.)')}</pre>`;
}

function stageCard(snapshot) {
  const stage = snapshot.directorContext?.stageNotes || snapshot.settings?.world?.opening || '';
  if (!stage) return '';
  return `<article class="speech-card stage"><div class="speaker">Stage</div><div class="speech">${escapeHtml(stage)}</div></article>`;
}

function directorNotesView(snapshot) {
  const supplied = snapshot.directorNotes || {};
  const opening = supplied.opening || snapshot.directorContext || null;
  const releases = Array.isArray(supplied.releases) ? supplied.releases : [];
  if (!opening && !releases.length) {
    return '<aside class="director-ledger" data-director-notes><details open><summary>Director notes so far</summary><p class="empty">No director notes have been issued yet.</p></details></aside>';
  }
  const openingRows = opening
    ? [
        ['Stage', opening.stageNotes],
        ['Tutor', opening.tutorCharacter],
        ['Learner', opening.learnerCharacter],
        ['Voice', opening.registerNote],
      ]
        .filter(([, value]) => value)
        .map(
          ([label, value]) =>
            `<div class="director-note"><strong>${escapeHtml(label)}</strong><div>${escapeHtml(value)}</div></div>`,
        )
        .join('')
    : '';
  const releaseRows = releases
    .map(
      (release) =>
        `<div class="director-note release"><strong>Turn ${escapeHtml(release.turn)} · scene note</strong><div>${escapeHtml(release.surface || '')}</div></div>`,
    )
    .join('');
  const throughTurn = Number.isFinite(Number(supplied.throughTurn)) ? Number(supplied.throughTurn) : null;
  return `<aside class="director-ledger" data-director-notes><details open><summary>Director notes so far</summary>
    <p class="director-scope">Opening directions and released scene notes${throughTurn === null ? '' : throughTurn > 0 ? ` through completed turn ${escapeHtml(throughTurn)}` : ' through the opening'}. Future notes remain withheld.</p>
    ${openingRows ? `<section><h2>Opening directions</h2>${openingRows}</section>` : ''}
    ${releaseRows ? `<section><h2>Released scene notes</h2>${releaseRows}</section>` : ''}
  </details></aside>`;
}

function registerPills(turn) {
  const selection = turn.registerSelection || {};
  const configuration = turn.responseConfiguration || selection.response_configuration || {};
  const learnerAdvance = turn.learnerAdvance || turn.tutorLearnerDagUpdate?.advance || null;
  const values = [
    ['approach', selection.policy],
    ['selected by', selection.activated_policy],
    ['style', selection.engagement_stance || selection.selected_register],
    ['move', configuration.action_family],
    ['audience', configuration.audience_register],
    ['language', configuration.lexical_accessibility],
    ['scene', configuration.scene_immersion],
    ['part', configuration.actorial_part_label || configuration.actorial_part],
    [
      'learning pace',
      learnerAdvance?.accelerated ? `${learnerAdvance.pace} (${learnerAdvance.supportedMoveCount} moves)` : null,
    ],
    [
      'clue pace',
      turn.releasePacing
        ? `${turn.releasePacing.direction} ${turn.releasePacing.effectiveSpeed}x${
            turn.releasePacing.releasedNow?.length
              ? ` · ${turn.releasePacing.releasedNow.length} new clue${turn.releasePacing.releasedNow.length === 1 ? '' : 's'}`
              : ''
          }`
        : null,
    ],
  ];
  return `<div class="pills">${values
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => `<span>${escapeHtml(label)}: ${escapeHtml(plainLabel(value))}</span>`)
    .join('')}</div>`;
}

function speechCard(role, text, turn, { opening = false } = {}) {
  return `<article class="speech-card ${escapeHtml(role)}">
    <div class="speech-head"><span class="speaker">${escapeHtml(role)}</span><span>${opening ? 'opening' : `turn ${escapeHtml(turn)}`}</span></div>
    <div class="speech">${escapeHtml(text || '')}</div>
  </article>`;
}

function learnerTutorFeedbackBadge(turn) {
  const feedback = turn?.learnerInput?.tutorFeedback || null;
  if (!feedback?.requested) return '';
  const label =
    feedback.rating === 'up' ? '👍 helpful' : feedback.rating === 'down' ? '👎 not helpful' : 'not rated';
  return `<div class="turn-feedback" data-rating="${escapeHtml(feedback.rating || 'none')}">Previous tutor reply: ${escapeHtml(label)}</div>`;
}

function tutorSpeechCard(turn) {
  const composition = turn?.responseComposition || null;
  const uptake = String(composition?.uptake || '').trim();
  const development = String(composition?.development || '').trim();
  if (!uptake || !development || uptake === development) return speechCard('tutor', turn?.tutor, turn?.turn);
  return `<article class="speech-card tutor composed-response" data-response-composition="uptake-development">
    <div class="speech-head"><span class="speaker">tutor</span><span>turn ${escapeHtml(turn.turn)}</span></div>
    <div class="speech-beat"><small>responds</small><div class="speech">${escapeHtml(uptake)}</div></div>
    <div class="speech-beat"><small>develops</small><div class="speech">${escapeHtml(development)}</div></div>
  </article>`;
}

function scriptView(snapshot) {
  const blocks = [stageCard(snapshot)];
  if (snapshot.opening) blocks.push(speechCard('tutor', snapshot.opening, 0, { opening: true }));
  for (const turn of snapshot.turns || []) {
    blocks.push(`${speechCard('learner', turn.learner, turn.turn)}${learnerTutorFeedbackBadge(turn)}`);
    blocks.push(`${tutorSpeechCard(turn)}${registerPills(turn)}`);
  }
  if (blocks.filter(Boolean).length === 0) return '<div class="empty">No public transcript yet.</div>';
  return `<div class="script-view">${blocks.filter(Boolean).join('')}</div>`;
}

function swimlaneView(snapshot) {
  const rows = [];
  if (snapshot.opening) {
    rows.push(
      `<div class="swim-row opening-step" data-swim-role="opening"><div class="lane tutor">${speechCard('tutor', snapshot.opening, null, { opening: true })}</div><div class="spine"><b class="opening-badge">open</b></div><div class="lane"></div></div>`,
    );
  }
  for (const turn of snapshot.turns || []) {
    rows.push(`<div class="swim-row learner-step" data-swim-role="learner" data-turn="${escapeHtml(turn.turn)}">
      <div class="lane"></div>
      <div class="spine"><b>${escapeHtml(turn.turn)}</b></div>
      <div class="lane learner">${speechCard('learner', turn.learner, turn.turn)}${learnerTutorFeedbackBadge(turn)}</div>
    </div>
    <div class="swim-row tutor-step" data-swim-role="tutor-reply" data-turn="${escapeHtml(turn.turn)}">
      <div class="lane tutor">${tutorSpeechCard(turn)}${registerPills(turn)}</div>
      <div class="spine"><b class="reply-badge">↳</b></div>
      <div class="lane"></div>
    </div>`);
  }
  if (!rows.length) return '<div class="empty">No public transcript yet.</div>';
  return `<div class="swimlanes"><p class="swim-guide">Read top to bottom: opening, then learner turn 1, then the tutor reply. The opening is an unnumbered prelude.</p><div class="swim-head"><span>tutor</span><i></i><span>learner</span></div>${rows.join('')}</div>`;
}

function promptBlock(title, prompt, meta = '') {
  return `<details class="prompt" open><summary>${escapeHtml(title)}${meta ? `<small>${escapeHtml(meta)}</small>` : ''}</summary><pre>${escapeHtml(prompt || '(not captured)')}</pre></details>`;
}

function promptsView(snapshot) {
  const tutor = snapshot.prompts?.tutor || {};
  const learner = snapshot.prompts?.learner || {};
  const tutorTurns = (tutor.turns || [])
    .map(
      (entry) => `<section class="prompt-pair">
    <h3>Tutor turn ${escapeHtml(entry.turn)}</h3>
    ${promptBlock('Effective system prompt', entry.systemPrompt, entry.role || '')}
    ${promptBlock('User prompt', entry.userPrompt, entry.repairAttempt ? `repair ${entry.repairAttempt}` : 'generation')}
    ${promptBlock('Message history', safeJson(entry.messageHistory || []))}
  </section>`,
    )
    .join('');
  const learnerHistory = (learner.history || [])
    .map(
      (entry) => `<section class="prompt-pair">
    <h3>Learner draft turn ${escapeHtml(entry.turn)}</h3>
    ${promptBlock('System prompt', entry.systemPrompt, entry.profileId || 'custom')}
    ${promptBlock('User prompt', entry.userPrompt, `request ${entry.requestId || 'n/a'}`)}
  </section>`,
    )
    .join('');
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
  const releasePacing = turn.releasePacing || null;
  const summary = classification.turn?.summary || classification.overall?.summary || 'No plain summary captured.';
  const rationale =
    selection.register_reason ||
    selection.engagement_stance_reason ||
    selection.reason ||
    selection.rationale ||
    'No teaching-style rationale was captured.';
  return `<article class="analysis-card">
    <header><h3>Turn ${escapeHtml(turn.turn)}</h3><strong>${escapeHtml(selection.engagement_stance || selection.selected_register || 'no stance')}</strong></header>
    <p><b>Learner reading:</b> ${escapeHtml(summary)}</p>
    ${turn.learnerInput?.tutorFeedback?.requested ? `<p><b>Learner rating of the previous tutor reply:</b> ${escapeHtml(turn.learnerInput.tutorFeedback.rating === 'up' ? '👍 helpful' : turn.learnerInput.tutorFeedback.rating === 'down' ? '👎 not helpful' : 'not supplied')}</p>` : ''}
    ${learnerAdvance?.accelerated ? `<p><b>Learning pace:</b> accelerating — ${escapeHtml(learnerAdvance.adoptedPremiseCount)} premises and ${escapeHtml(learnerAdvance.derivedFactCount)} supported inferences accepted together.</p>` : ''}
    ${releasePacing?.signal?.direction && releasePacing.signal.direction !== 'steady' ? `<p><b>Clue pace:</b> ${escapeHtml(releasePacing.signal.reason)} Effective pace: ${escapeHtml(releasePacing.effectiveSpeed)}x.${releasePacing.releasedNow?.length ? ` ${escapeHtml(releasePacing.releasedNow.length)} new clue${releasePacing.releasedNow.length === 1 ? '' : 's'} entered this turn.` : ''}</p>` : ''}
    <p><b>Teaching-style rationale:</b> ${escapeHtml(rationale)}</p>
    ${turn.responseComposition ? `<p><b>Response shape:</b> ${turn.responseComposition.audit?.ok ? 'responds, then develops' : 'composition needs attention'} · one atomic tutor turn.</p>` : ''}
    ${registerPills(turn)}
    <details><summary>Full learner analysis</summary><pre>${escapeHtml(safeJson(classification))}</pre></details>
    <details><summary>DAG preflight and committed update</summary><pre>${escapeHtml(safeJson(turn.tutorLearnerDagUpdate || null))}</pre></details>
    <details><summary>Full reasoning-map analysis</summary><pre>${escapeHtml(safeJson(turn.tutorLearnerDagModel))}</pre></details>
    <details><summary>Teaching-style input and result</summary><pre>${escapeHtml(
      safeJson({
        selection,
        responseConfiguration: configuration,
        previousRegisterEfficacy: turn.previousRegisterEfficacy || null,
        responseConfigurationAudit: turn.responseConfigurationAudit || null,
        responseComposition: turn.responseComposition || null,
        releasePacing,
      }),
    )}</pre></details>
  </article>`;
}

function analysisView(snapshot) {
  const turns = snapshot.turns || [];
  return turns.length
    ? `<div class="analysis-list">${turns.map(analysisCard).join('')}</div>`
    : '<div class="empty">No completed learner analysis or teaching-style selection yet.</div>';
}

function settingsView(snapshot) {
  const rows = flattenSettings(snapshot.settings || {})
    .map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`)
    .join('');
  return `<div class="settings-grid"><section><h2>Selected settings and options</h2><table><tbody>${rows}</tbody></table></section><section><h2>Snapshot envelope</h2><pre>${escapeHtml(
    safeJson({
      schema: snapshot.schema,
      generatedAt: snapshot.generatedAt,
      runId: snapshot.runId,
      turns: (snapshot.turns || []).length,
    }),
  )}</pre></section></div>`;
}

export function renderTutorStubTranscriptHtml(snapshot = {}) {
  const title = snapshot.settings?.world?.title || snapshot.title || 'Tutor Stub Transcript';
  const completedTurns = (snapshot.turns || []).length;
  const completionLabel = completedTurns
    ? `${completedTurns} completed turn${completedTurns === 1 ? '' : 's'}`
    : 'opening only';
  const views = {
    raw: rawView(snapshot),
    script: scriptView(snapshot),
    swimlanes: swimlaneView(snapshot),
    analysis: analysisView(snapshot),
    prompts: promptsView(snapshot),
    settings: settingsView(snapshot),
    replay: replayView(snapshot),
  };
  const viewLabels = { replay: 'Replay JS' };
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} · transcript</title>
<style>
:root{--paper:#f5f0e6;--paper2:#fffaf0;--ink:#151515;--muted:#686159;--rule:#b8ad9d;--tutor:#285943;--learner:#a45a24;--accent:#b3261e}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.55 Georgia,serif}button,pre,table,.speaker,.eyebrow{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.shell{max-width:1280px;margin:auto;padding:28px}.hero{border-bottom:3px solid var(--ink);padding-bottom:18px}.eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}h1{font-size:clamp(28px,5vw,56px);line-height:1;margin:8px 0}.subtitle{color:var(--muted)}.director-ledger{margin:18px 0 0;border:2px solid var(--ink);background:#eee5d5}.director-ledger details{padding:12px 16px}.director-ledger summary{font:800 12px ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase}.director-ledger h2{font:800 11px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em;margin:14px 0 6px}.director-scope{color:var(--muted);margin:6px 0}.director-note{display:grid;grid-template-columns:90px minmax(0,1fr);gap:12px;padding:7px 0;border-top:1px solid var(--rule)}.director-note div{white-space:pre-wrap}.director-note.release{grid-template-columns:160px minmax(0,1fr)}.tabs{display:flex;flex-wrap:wrap;gap:0;margin:20px 0;border-bottom:2px solid var(--ink)}.tabs button{border:2px solid var(--ink);border-bottom:0;background:var(--paper2);padding:9px 14px;cursor:pointer;text-transform:uppercase;font-size:11px;font-weight:700}.tabs button+button{border-left:0}.tabs button.active{background:var(--ink);color:var(--paper2)}.view{display:none}.view.active{display:block}.raw-transcript,pre{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--paper2);border:1px solid var(--rule);padding:16px;max-height:70vh;overflow:auto;font-size:12px}.script-view,.analysis-list{display:grid;gap:12px}.speech-card{border:1px solid var(--rule);border-left:6px solid var(--ink);background:var(--paper2);padding:14px}.speech-card.tutor{border-left-color:var(--tutor)}.speech-card.learner{border-left-color:var(--learner)}.speech-card.stage{border-style:dashed;color:var(--muted);font-style:italic}.speech-head,.analysis-card header{display:flex;justify-content:space-between;gap:12px}.speaker{text-transform:uppercase;letter-spacing:.12em;font-size:11px;font-weight:800}.speech{white-space:pre-wrap}.turn-feedback{margin:-6px 0 8px 16px;color:var(--muted);font:700 10px ui-monospace,monospace;letter-spacing:.04em}.speech-beat{margin-top:12px;padding-top:10px;border-top:1px solid var(--rule)}.speech-beat small{display:block;margin-bottom:4px;color:var(--muted);font:700 10px ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase}.pills{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 14px}.pills span{border:1px solid var(--rule);background:var(--paper2);padding:2px 6px;font:10px ui-monospace,monospace}.swimlanes{display:grid;gap:10px}.swim-guide{margin:0 0 4px;padding:8px 10px;border-left:4px solid var(--ink);background:var(--paper2);color:var(--muted)}.swim-head,.swim-row{display:grid;grid-template-columns:minmax(0,1fr) 52px minmax(0,1fr);gap:12px}.swim-head{position:sticky;top:0;background:var(--paper);z-index:2;text-transform:uppercase;font:700 11px ui-monospace,monospace}.swim-head span:last-child{text-align:right}.lane{min-width:0}.lane .speech-card{height:100%}.spine{position:relative}.spine:before{content:"";position:absolute;left:50%;top:-12px;bottom:-12px;width:2px;background:var(--rule)}.spine b{position:relative;display:block;width:30px;height:30px;margin:4px auto;border-radius:50%;background:var(--ink);color:var(--paper);text-align:center;line-height:30px;font:700 11px/30px ui-monospace,monospace}.spine b.opening-badge{width:52px;border-radius:15px}.spine b.reply-badge{background:var(--paper);color:var(--ink);border:2px solid var(--ink);line-height:26px}.prompt-grid,.settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.prompt,.analysis-card,.settings-grid section{border:1px solid var(--rule);background:var(--paper2);padding:12px}.prompt summary,details summary{cursor:pointer;font-weight:700}.prompt summary small{float:right;color:var(--muted);font-weight:400}.prompt-pair{border-top:3px solid var(--ink);margin-top:18px}.analysis-card{border-left:6px solid var(--accent)}table{width:100%;border-collapse:collapse;font-size:12px}th,td{text-align:left;vertical-align:top;border-bottom:1px solid var(--rule);padding:7px}th{width:42%}.empty{padding:20px;border:1px dashed var(--rule);color:var(--muted)}@media(max-width:760px){.shell{padding:16px}.prompt-grid,.settings-grid{grid-template-columns:1fr}.director-note,.director-note.release{grid-template-columns:1fr}.swim-head,.swim-row{grid-template-columns:1fr}.spine,.swim-head i{display:none}.swim-head span:last-child{text-align:left}}
.replay-view{border:1px solid var(--rule);background:var(--paper2);padding:12px}.replay-head{display:flex;justify-content:space-between;gap:12px}.replay-head h2{margin-top:0}.replay-head p{margin-bottom:0;color:var(--muted);max-width:850px}.replay-note{padding:9px 12px;border-left:4px solid var(--tutor);background:var(--paper);color:var(--muted)}.copy-code{align-self:flex-start;border:2px solid var(--ink);background:var(--ink);color:var(--paper2);padding:8px 12px;cursor:pointer;font-weight:700;white-space:nowrap}.copy-code.copied{background:var(--tutor)}.replay-code{max-height:none}@media(max-width:760px){.replay-head{display:block}.copy-code{margin-top:12px}}
</style></head><body><main class="shell"><header class="hero"><div class="eyebrow">Tutor stub · live transcript snapshot</div><h1>${escapeHtml(title)}</h1><div class="subtitle">${escapeHtml(snapshot.settings?.world?.question || '')} · ${escapeHtml(completionLabel)} · updated ${escapeHtml(snapshot.generatedAt || '')}</div></header>
${directorNotesView(snapshot)}
<nav class="tabs" aria-label="Transcript views">${Object.keys(views)
    .map(
      (name, index) =>
        `<button type="button" data-view="${name}" class="${index === 0 ? 'active' : ''}">${viewLabels[name] || name}</button>`,
    )
    .join('')}</nav>
${Object.entries(views)
  .map(
    ([name, html], index) =>
      `<section class="view ${index === 0 ? 'active' : ''}" data-panel="${name}">${html}</section>`,
  )
  .join('')}
</main><script>document.querySelectorAll('[data-view]').forEach(function(button){button.addEventListener('click',function(){document.querySelectorAll('[data-view]').forEach(function(item){item.classList.remove('active')});document.querySelectorAll('[data-panel]').forEach(function(item){item.classList.remove('active')});button.classList.add('active');document.querySelector('[data-panel="'+button.dataset.view+'"]').classList.add('active')})});async function copyReplayText(text){if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(text);var area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();document.execCommand('copy');area.remove()}document.querySelectorAll('[data-copy-target]').forEach(function(button){button.addEventListener('click',async function(){var target=document.getElementById(button.dataset.copyTarget);if(!target)return;try{await copyReplayText(target.textContent);button.textContent='Copied';button.classList.add('copied');setTimeout(function(){button.textContent='Copy JavaScript';button.classList.remove('copied')},1400)}catch(error){button.textContent='Select code to copy'}})});</script></body></html>`;
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
