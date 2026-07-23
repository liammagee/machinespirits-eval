import fs from 'node:fs';
import path from 'node:path';

import {
  MACHINE_SPIRITS_HOUSE_STYLE_SCHEMA,
  renderMachineSpiritsHouseBackdrop,
  renderMachineSpiritsHouseStyleTag,
} from './machineSpiritsHouseStyle.js';
import { tutorStubLearnerResponseProvenanceLabel } from './tutorStubLearnerResponseProvenance.js';

export const TUTOR_STUB_LEARNING_SUMMARY_HTML_SCHEMA = 'machinespirits.tutor-stub.learning-summary-html.v1';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function percent(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${Math.round(numeric * 100)}%` : 'not measured';
}

function list(items, emptyText) {
  const rows = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!rows.length) return `<p class="empty">${escapeHtml(emptyText)}</p>`;
  return `<ul>${rows.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function vocabulary(summary) {
  const explained = summary.comprehension?.explainedTerms || [];
  const unresolved = summary.comprehension?.unresolvedTerms || [];
  if (!explained.length && !unresolved.length) {
    return '<p class="empty">No vocabulary clarification was recorded.</p>';
  }
  return `<div class="vocab">
    <div><h3>Explained</h3>${list(explained, 'None yet.')}</div>
    <div><h3>Still unresolved</h3>${list(unresolved, 'None.')}</div>
  </div>`;
}

function journey(summary) {
  const rows = summary.journey || [];
  if (!rows.length) return '<p class="empty">No completed turns were available.</p>';
  return rows
    .map(
      (row) => `<details class="turn"${row.turn === rows.length ? ' open' : ''}>
        <summary><span>Turn ${escapeHtml(row.turn)}</span><strong>${escapeHtml(row.reading || 'Public exchange')}</strong><em>${escapeHtml(
          row.coverage == null ? '' : `${percent(row.coverage)} of the reasoning path`,
        )}</em></summary>
        <div class="turn-body">
          <div class="speech learner"><b>Learner · ${escapeHtml(tutorStubLearnerResponseProvenanceLabel(row.learnerResponseProvenance))}</b><p>${escapeHtml(row.learner)}</p></div>
          <div class="speech tutor"><b>Tutor</b><p>${escapeHtml(row.tutor)}</p></div>
          ${row.newEvidence?.length ? `<div class="movement"><b>New evidence held</b>${list(row.newEvidence, '')}</div>` : ''}
          ${row.newReasoning?.length ? `<div class="movement"><b>New reasoning voiced</b>${list(row.newReasoning, '')}</div>` : ''}
          ${row.learnerAdvance?.accelerated ? `<div class="movement"><b>Several supported steps at once</b><p>${escapeHtml(row.learnerAdvance.supportedMoveCount)} reasoning moves were accepted together (${escapeHtml(row.learnerAdvance.adoptedPremiseCount)} evidence items, ${escapeHtml(row.learnerAdvance.derivedFactCount)} inferences).</p></div>` : ''}
          ${row.releasePacing?.signal?.direction && row.releasePacing.signal.direction !== 'steady' ? `<div class="movement"><b>Clue pace changed</b><p>${escapeHtml(row.releasePacing.signal.reason)} Effective pace: ${escapeHtml(row.releasePacing.effectiveSpeed)}x.${row.releasePacing.releasedNow?.length ? ` ${escapeHtml(row.releasePacing.releasedNow.length)} new clue${row.releasePacing.releasedNow.length === 1 ? ' was' : 's were'} brought into the dialogue.` : ''}</p></div>` : ''}
        </div>
      </details>`,
    )
    .join('');
}

function tuningSummary(summary) {
  const tuning = summary.tuning;
  if (!tuning) return '';
  const candidates = Array.isArray(tuning.candidates) ? tuning.candidates : [];
  return `<article class="card wide ms-panel"><h2>Tutor learning from this session</h2>
    <p><b>Named tutor:</b> ${escapeHtml(tuning.activeRef || tuning.tutorId || 'not recorded')} · tuning ${escapeHtml(tuning.mode || 'off')}.</p>
    <p>${escapeHtml(tuning.sessionFeedbackCount || 0)} rated-response observation${Number(tuning.sessionFeedbackCount) === 1 ? '' : 's'} and ${escapeHtml(candidates.length)} reviewable candidate${candidates.length === 1 ? '' : 's'} are attached to this tutor partition.</p>
    ${candidates.length ? `<ul>${candidates.map((candidate) => `<li><b>${escapeHtml(candidate.id)}</b> · ${escapeHtml(String(candidate.status || '').replaceAll('_', ' '))} · ${escapeHtml(candidate.evidence?.reasonLabel || candidate.evidence?.reason || 'manual review')}</li>`).join('')}</ul>` : '<p class="empty">No durable tutor change was proposed.</p>'}
    <p><b>Promotion boundary:</b> ${escapeHtml(tuning.promotionPolicy || 'Candidates require explicit review and promotion.')}</p>
  </article>`;
}

export function renderTutorStubLearningSummaryHtml(summary = {}) {
  const title = summary.world?.title || summary.topic || 'Learning summary';
  const question = summary.world?.question || summary.question || '';
  const coverage = percent(summary.progress?.bestPathCoverage);
  const completed = summary.completion?.natural ? 'Natural close' : 'Session ended';
  const learnerProvenance = summary.learnerResponseProvenance?.counts || {};
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(title)} · what we learned</title>
${renderMachineSpiritsHouseStyleTag()}
<style data-tutor-stub-learning-summary-style="${TUTOR_STUB_LEARNING_SUMMARY_HTML_SCHEMA}">
:root {
  --summary-paper: var(--ms-paper-3);
  --summary-card: var(--ms-surface-elevated);
  --summary-ink: var(--ms-text);
  --summary-muted: var(--ms-text-muted);
  --summary-rule: var(--ms-border);
  --summary-tutor: var(--ms-moss-deep);
  --summary-learner: #8c5f1f;
  --summary-accent: var(--ms-red);
}
body.learning-summary-page { background: var(--ms-off-white); font: 15px/1.58 var(--ms-font-sans); }
.shell { max-width: 1280px; margin: auto; padding: clamp(18px, 3vw, 42px); }
.hero { position: relative; overflow: hidden; margin-bottom: 22px; padding: clamp(24px, 5vw, 58px); border-top: 12px solid var(--summary-accent); }
.hero::after { content: ""; position: absolute; right: -7%; bottom: 13%; width: 42%; height: 7px; background: var(--summary-accent); opacity: .72; transform: rotate(var(--ms-slash-angle)); }
.hero .eyebrow, .hero h1, .hero .question { position: relative; z-index: 1; }
.hero h1 { max-width: 1050px; margin: 18px 0 22px; text-transform: uppercase; }
.question { max-width: 920px; color: var(--summary-muted); font: 700 12px/1.65 var(--ms-font-mono); letter-spacing: .04em; }
.outcome { display: grid; grid-template-columns: minmax(150px, auto) minmax(0, 1fr); gap: 16px; margin: 22px 0; padding: 18px 20px; border-left: 10px solid var(--summary-accent); background: var(--ms-black); color: var(--ms-white); }
.outcome b, .metric span, .turn summary, .speech b, .movement b, .colophon { font-family: var(--ms-font-mono); }
.outcome b { align-self: start; color: #ff7b86; font-size: 10px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
.metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 0 0 28px; }
.metric { min-width: 0; padding: 18px; border-top: 7px solid var(--summary-accent); }
.metric strong { display: block; color: var(--summary-ink); font-size: clamp(27px, 4vw, 44px); font-weight: 900; letter-spacing: -.04em; line-height: 1; overflow-wrap: anywhere; }
.metric span { display: block; margin-top: 10px; color: var(--summary-muted); font-size: 9px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
.learning-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.card { min-width: 0; padding: 22px; }
.card.wide { grid-column: 1 / -1; }
.card h2, .journey-section > h2 { margin: 0 0 14px; font-size: clamp(24px, 3vw, 36px); font-weight: 900; letter-spacing: -.035em; line-height: 1; }
.card h3 { margin: 0 0 8px; color: var(--summary-muted); font: 800 10px var(--ms-font-mono); letter-spacing: .16em; text-transform: uppercase; }
.card p { margin: 8px 0; max-width: 78ch; }
.card ul { margin: 9px 0; padding-left: 22px; }
.card li + li { margin-top: 7px; }
.empty { color: var(--summary-muted); font-style: italic; }
.vocab { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.journey-section { margin-top: 38px; }
.journey-section > h2 { padding: 0 0 14px; border-bottom: 6px solid var(--summary-ink); }
.turn { margin: 12px 0; border: 2px solid var(--summary-ink); background: var(--summary-card); box-shadow: 5px 5px 0 var(--ms-border-subtle); }
.turn summary { display: grid; grid-template-columns: 82px minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 14px 16px; cursor: pointer; }
.turn summary:focus-visible { outline: 4px solid var(--summary-accent); outline-offset: 3px; }
.turn summary span { color: var(--summary-accent); font-size: 10px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
.turn summary strong { font-size: 12px; }
.turn summary em { color: var(--summary-muted); font-size: 10px; font-style: normal; }
.turn-body { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; padding: 16px; border-top: 2px solid var(--summary-ink); }
.speech { min-width: 0; padding: 13px 15px; border: 2px solid var(--summary-ink); border-left: 8px solid var(--summary-learner); background: var(--summary-paper); }
.speech.tutor { border-left-color: var(--summary-tutor); }
.speech b { font-size: 9px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
.speech p { margin: 7px 0 0; font-family: var(--ms-font-reading); font-size: 16px; white-space: pre-wrap; }
.movement { grid-column: 1 / -1; padding: 12px 14px; border: 2px dashed var(--summary-ink); background: var(--summary-card); }
.movement b { color: var(--summary-muted); font-size: 9px; letter-spacing: .13em; text-transform: uppercase; }
.movement ul { margin: 7px 0; }
.colophon { margin: 38px 0 8px; padding: 14px 0 0; border-top: 3px solid var(--summary-ink); color: var(--summary-muted); font-size: 10px; letter-spacing: .08em; overflow-wrap: anywhere; text-transform: uppercase; }
.colophon p { margin: 6px 0; max-width: 100ch; }
@media (max-width: 760px) {
  .shell { padding: 16px; }
  .hero { padding: 24px 18px 30px; }
  .hero h1 { margin-top: 14px; }
  .outcome, .metrics, .learning-grid, .vocab, .turn-body { grid-template-columns: 1fr; }
  .card.wide { grid-column: auto; }
  .turn summary { grid-template-columns: 68px minmax(0, 1fr); }
  .turn summary em { display: none; }
}
@media print {
  .hero, .metric, .card, .turn { box-shadow: none; }
  .turn { break-inside: avoid; }
}
</style></head><body class="ms-house-style learning-summary-page">
${renderMachineSpiritsHouseBackdrop()}
<main class="ms-page shell">
<header class="hero ms-panel"><div class="eyebrow ms-kicker">Tutor stub · what we learned</div><h1 class="ms-display">${escapeHtml(title)}</h1><div class="question">${escapeHtml(
    question,
  )}</div></header>
<div class="outcome ms-panel"><b>${escapeHtml(completed)}</b><span>${escapeHtml(summary.completion?.plainReason || summary.finalStatus || '')}</span></div>
<section class="metrics">
  <div class="metric ms-panel"><strong>${escapeHtml(summary.turnCount || 0)}</strong><span>completed turns</span></div>
  <div class="metric ms-panel"><strong>${escapeHtml(coverage)}</strong><span>reasoning path complete</span></div>
  <div class="metric ms-panel"><strong>${escapeHtml(summary.evidenceHeld?.length || 0)}</strong><span>public evidence held</span></div>
  <div class="metric ms-panel"><strong>${escapeHtml(summary.reasoningVoiced?.length || 0)}</strong><span>reasoning claims voiced</span></div>
</section>
<section class="learning-grid">
  <article class="card ms-panel"><h2>Learning arc</h2><p>${escapeHtml(summary.arc?.summary || 'The completed public turns are collected below.')}</p><p>${escapeHtml(
    summary.arc?.trajectory || '',
  )}</p>${summary.progress?.acceleratedTurnCount ? `<p><b>Turns with several supported steps:</b> ${escapeHtml(summary.progress.acceleratedTurnCount)}; longest accepted span ${escapeHtml(summary.progress.maxSupportedMoves)} reasoning moves.</p>` : ''}${summary.releasePacing ? `<p><b>Clue pace:</b> ${escapeHtml(summary.releasePacing.baseSpeed)}x base; ${escapeHtml(summary.releasePacing.counts?.accelerationSignals || 0)} requests to move faster and ${escapeHtml(summary.releasePacing.counts?.decelerationSignals || 0)} requests to slow down.</p>` : ''}${summary.arc?.recurringPattern ? `<p><b>Recurring pattern:</b> ${escapeHtml(summary.arc.recurringPattern)}</p>` : ''}</article>
  <article class="card ms-panel"><h2>Where this leaves you</h2><p>${escapeHtml(summary.progress?.plainStatus || summary.finalStatus || '')}</p><p><b>Next useful move:</b> ${escapeHtml(
    summary.nextStep || 'Carry the reasoning into another case.',
  )}</p></article>
  <article class="card ms-panel"><h2>Reasoning you established</h2>${list(
    summary.reasoningVoiced,
    'No explicit derived conclusion was recorded yet; the journey below still shows the learner moves made.',
  )}</article>
  <article class="card ms-panel"><h2>Evidence held by the end</h2>${list(
    summary.evidenceHeld,
    'No structured public evidence record was available.',
  )}</article>
  <article class="card wide ms-panel"><h2>Language and clarification</h2>${vocabulary(summary)}</article>
  <article class="card wide ms-panel"><h2>Still open</h2>${list(summary.openQuestions, 'Nothing remains open in the recorded inquiry.')}</article>
  <article class="card wide ms-panel"><h2>Learner response authorship</h2><p>${escapeHtml(learnerProvenance.human || 0)} human-authored · ${escapeHtml(learnerProvenance.ai || 0)} AI-authored · ${escapeHtml(learnerProvenance.hybrid || 0)} human-edited AI · ${escapeHtml(learnerProvenance.unknown || 0)} legacy or unknown.</p></article>
  ${tuningSummary(summary)}
</section>
<section class="journey-section"><h2>How the reasoning developed</h2>${journey(summary)}</section>
<footer class="colophon"><p>Generated ${escapeHtml(summary.generatedAt || '')} · ${escapeHtml(summary.completion?.plainReason || 'session ended')} · run ${escapeHtml(
    summary.runId || '',
  )}${summary.trace ? ` · trace ${escapeHtml(summary.trace)}` : ''}</p><p>${escapeHtml(
    summary.boundary || 'This report uses public dialogue evidence only.',
  )}</p><p>Machine Spirits house style · ${MACHINE_SPIRITS_HOUSE_STYLE_SCHEMA} · self-contained learning summary</p></footer>
</main></body></html>`;
}

export function writeTutorStubLearningSummaryHtml({ summary, filePath }) {
  const absolute = path.resolve(filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, renderTutorStubLearningSummaryHtml(summary), 'utf8');
  return absolute;
}
