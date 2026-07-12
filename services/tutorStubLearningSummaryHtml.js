import fs from 'node:fs';
import path from 'node:path';

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
          row.coverage == null ? '' : `${percent(row.coverage)} coverage`,
        )}</em></summary>
        <div class="turn-body">
          <div class="speech learner"><b>Learner</b><p>${escapeHtml(row.learner)}</p></div>
          <div class="speech tutor"><b>Tutor</b><p>${escapeHtml(row.tutor)}</p></div>
          ${row.newEvidence?.length ? `<div class="movement"><b>New evidence held</b>${list(row.newEvidence, '')}</div>` : ''}
          ${row.newReasoning?.length ? `<div class="movement"><b>New reasoning voiced</b>${list(row.newReasoning, '')}</div>` : ''}
        </div>
      </details>`,
    )
    .join('');
}

export function renderTutorStubLearningSummaryHtml(summary = {}) {
  const title = summary.world?.title || summary.topic || 'Learning summary';
  const question = summary.world?.question || summary.question || '';
  const coverage = percent(summary.progress?.bestPathCoverage);
  const completed = summary.completion?.natural ? 'Natural close' : 'Session ended';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} · what we learned</title>
<style>
:root{--paper:#f4efe4;--card:#fffaf0;--ink:#191713;--muted:#70685d;--rule:#c8bcaa;--green:#285943;--orange:#a65424;--gold:#b98a29;--soft:#ebe2d2}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 Georgia,serif}.shell{max-width:1120px;margin:auto;padding:34px 24px 72px}.eyebrow,.metric span,.turn summary,.speech b,.meta,button{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.hero{border-top:8px solid var(--ink);border-bottom:2px solid var(--ink);padding:22px 0}.eyebrow{text-transform:uppercase;letter-spacing:.14em;font-size:11px;color:var(--green);font-weight:800}h1{font-size:clamp(34px,7vw,72px);line-height:.98;margin:12px 0}.question{max-width:820px;font-size:20px;font-style:italic;color:var(--muted)}.outcome{margin:20px 0;padding:16px 18px;background:var(--ink);color:var(--card);display:grid;grid-template-columns:auto 1fr;gap:14px}.outcome b{font:800 11px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.1em;color:#e4bb68}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0 28px}.metric{background:var(--card);border:1px solid var(--rule);padding:14px}.metric strong{display:block;font-size:28px;color:var(--green)}.metric span{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.card{background:var(--card);border:1px solid var(--rule);padding:18px}.card.wide{grid-column:1/-1}.card h2{font-size:22px;margin:0 0 10px}.card h3{font:700 11px ui-monospace,monospace;text-transform:uppercase;color:var(--muted)}.card p{margin:7px 0}.card ul{margin:8px 0;padding-left:21px}.empty{color:var(--muted);font-style:italic}.vocab{display:grid;grid-template-columns:1fr 1fr;gap:16px}.turn{border:1px solid var(--rule);background:var(--card);margin:8px 0}.turn summary{cursor:pointer;display:grid;grid-template-columns:70px 1fr auto;gap:12px;align-items:center;padding:11px 14px}.turn summary span{color:var(--orange);font-weight:800}.turn summary strong{font-size:12px}.turn summary em{font-size:10px;color:var(--muted);font-style:normal}.turn-body{border-top:1px solid var(--rule);padding:14px;display:grid;grid-template-columns:1fr 1fr;gap:12px}.speech{border-left:5px solid var(--orange);background:var(--soft);padding:10px 12px}.speech.tutor{border-left-color:var(--green)}.speech b{font-size:10px;text-transform:uppercase;letter-spacing:.1em}.speech p{margin:5px 0;white-space:pre-wrap}.movement{grid-column:1/-1;border-top:1px dashed var(--rule);padding-top:9px}.movement b{font:700 10px ui-monospace,monospace;text-transform:uppercase;color:var(--muted)}.movement ul{margin:5px 0}.meta{margin-top:24px;border-top:1px solid var(--rule);padding-top:12px;color:var(--muted);font-size:10px;overflow-wrap:anywhere}@media(max-width:760px){.shell{padding:20px 14px 50px}.metrics,.grid,.vocab,.turn-body{grid-template-columns:1fr}.card.wide{grid-column:auto}.turn summary{grid-template-columns:58px 1fr}.turn summary em{display:none}.outcome{grid-template-columns:1fr}}
</style></head><body><main class="shell">
<header class="hero"><div class="eyebrow">Tutor stub · what we learned</div><h1>${escapeHtml(title)}</h1><div class="question">${escapeHtml(
    question,
  )}</div></header>
<div class="outcome"><b>${escapeHtml(completed)}</b><span>${escapeHtml(summary.completion?.plainReason || summary.finalStatus || '')}</span></div>
<section class="metrics">
  <div class="metric"><strong>${escapeHtml(summary.turnCount || 0)}</strong><span>completed turns</span></div>
  <div class="metric"><strong>${escapeHtml(coverage)}</strong><span>proof-path coverage</span></div>
  <div class="metric"><strong>${escapeHtml(summary.evidenceHeld?.length || 0)}</strong><span>public evidence held</span></div>
  <div class="metric"><strong>${escapeHtml(summary.reasoningVoiced?.length || 0)}</strong><span>reasoning claims voiced</span></div>
</section>
<section class="grid">
  <article class="card"><h2>Learning arc</h2><p>${escapeHtml(summary.arc?.summary || 'The completed public turns are collected below.')}</p><p>${escapeHtml(
    summary.arc?.trajectory || '',
  )}</p>${summary.arc?.recurringPattern ? `<p><b>Recurring pattern:</b> ${escapeHtml(summary.arc.recurringPattern)}</p>` : ''}</article>
  <article class="card"><h2>Where this leaves you</h2><p>${escapeHtml(summary.progress?.plainStatus || summary.finalStatus || '')}</p><p><b>Next useful move:</b> ${escapeHtml(
    summary.nextStep || 'Carry the reasoning into another case.',
  )}</p></article>
  <article class="card"><h2>Reasoning you established</h2>${list(
    summary.reasoningVoiced,
    'No explicit derived conclusion was recorded yet; the journey below still shows the learner moves made.',
  )}</article>
  <article class="card"><h2>Evidence held by the end</h2>${list(
    summary.evidenceHeld,
    'No structured public evidence record was available.',
  )}</article>
  <article class="card wide"><h2>Language and clarification</h2>${vocabulary(summary)}</article>
  <article class="card wide"><h2>Still open</h2>${list(summary.openQuestions, 'Nothing remains open in the recorded inquiry.')}</article>
</section>
<section><h2>How the reasoning developed</h2>${journey(summary)}</section>
<footer class="meta">Generated ${escapeHtml(summary.generatedAt || '')} · reason ${escapeHtml(summary.reason || '')} · run ${escapeHtml(
    summary.runId || '',
  )}${summary.trace ? ` · trace ${escapeHtml(summary.trace)}` : ''}<br>${escapeHtml(
    summary.boundary || 'This report uses public dialogue evidence only.',
  )}</footer>
</main></body></html>`;
}

export function writeTutorStubLearningSummaryHtml({ summary, filePath }) {
  const absolute = path.resolve(filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, renderTutorStubLearningSummaryHtml(summary), 'utf8');
  return absolute;
}
