/**
 * Showcase transcript surface.
 *
 * The frozen A/B can put the learner on a shared spine because every arm
 * answers the same utterance. Here it cannot: each arm has its own learner
 * talking to its own tutor, so there is no shared row to hang them from.
 * Instead each arm gets a full-height column and the columns are aligned by
 * turn index, so turn 4 sits beside turn 4 while each column stays a readable
 * conversation top to bottom.
 *
 * The page leads with the benchmark strip rather than the transcripts, because
 * the interesting claim is not "the instrumented reply is longer" — it is what
 * the instrumentation cost and what it caught.
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  MACHINE_SPIRITS_HOUSE_STYLE_SCHEMA,
  renderMachineSpiritsHouseBackdrop,
  renderMachineSpiritsHouseStyleTag,
} from './machineSpiritsHouseStyle.js';

export const TUTOR_STUB_SHOWCASE_HTML_SCHEMA = 'machinespirits.tutor-stub.showcase-html.v1';

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/gu,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );
}

function seconds(ms) {
  if (!Number.isFinite(ms)) return '—';
  return `${Math.round(ms / 1000)}s`;
}

function benchmarkTable(report) {
  const rows = report.summary.arms
    .map((arm) => {
      const resolved = `${arm.grounded}/${arm.dialogues}`;
      return `<tr${arm.baseline ? ' class="sc-baseline-row"' : ''}>
        <td>${escapeHtml(arm.label)}${arm.baseline ? ' <span class="sc-tag">baseline</span>' : ''}</td>
        <td class="sc-num">${resolved}</td>
        <td class="sc-num">${arm.meanTurns ?? '—'}</td>
        <td class="sc-num">${arm.meanModelCalls ?? '—'}</td>
        <td class="sc-num">${arm.meanSecondsPerTurn ?? '—'}s</td>
        <td class="sc-num">${arm.totalTokens ? arm.totalTokens.toLocaleString('en-US') : '—'}</td>
        <td class="sc-num">${arm.auditsRun}</td>
        <td class="sc-num">${arm.auditsFailed}</td>
        <td class="sc-num">${arm.repairs}</td>
      </tr>`;
    })
    .join('');
  return `<table class="sc-table">
    <thead><tr>
      <th>Arm</th><th class="sc-num">Resolved</th><th class="sc-num">Turns</th><th class="sc-num">Calls</th>
      <th class="sc-num">Per turn</th><th class="sc-num">Tokens</th><th class="sc-num">Guards run</th>
      <th class="sc-num">Guard fails</th><th class="sc-num">Repairs</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function armLegend(report) {
  return report.plan.arms
    .map(
      (arm) => `<div class="sc-legend-item">
        <h3>${escapeHtml(arm.label)}${arm.baseline ? ' <span class="sc-tag">baseline</span>' : ''}</h3>
        <p class="sc-note">${escapeHtml(arm.summary)}</p>
        <div class="sc-pills">${
          arm.flags.length
            ? arm.flags
                .filter((flag) => flag.startsWith('--'))
                .map((flag) => `<span class="sc-pill">${escapeHtml(flag)}</span>`)
                .join('')
            : '<span class="sc-pill sc-pill--off">no tutor-side flags</span>'
        }</div>
      </div>`,
    )
    .join('');
}

function auditChips(turn) {
  const failed = turn.tutor.audits.filter((audit) => !audit.ok);
  const chips = [];
  if (turn.tutor.repaired) chips.push('<span class="sc-chip sc-chip--repair">first draft repaired</span>');
  for (const audit of failed) {
    chips.push(`<span class="sc-chip sc-chip--fail">${escapeHtml(audit.key.replace(/^tutor/u, ''))}</span>`);
  }
  if (!failed.length && turn.tutor.audits.length) {
    chips.push(`<span class="sc-chip sc-chip--pass">${turn.tutor.audits.length} guards ok</span>`);
  }
  if (!turn.tutor.audits.length) chips.push('<span class="sc-chip sc-chip--none">no guards ran</span>');
  if (turn.closure.deterministic) chips.push('<span class="sc-chip sc-chip--closed">closed</span>');
  return `<div class="sc-card-foot">${chips.join('')}</div>`;
}

function turnCell(result, index) {
  if (!result?.dialogue) return '<div class="sc-cell sc-cell--absent"><p class="sc-empty">—</p></div>';
  const turn = result.dialogue.turns[index];
  if (!turn) {
    return `<div class="sc-cell sc-cell--absent"><p class="sc-empty">this dialogue ended at turn ${result.dialogue.turnCount}</p></div>`;
  }
  return `<div class="sc-cell">
    <div class="sc-bubble sc-bubble--learner">
      <div class="sc-card-head"><span>learner</span><span>${turn.learner.latencyMs ? seconds(turn.learner.latencyMs) : ''}</span></div>
      <div class="sc-speech">${escapeHtml(turn.learner.text)}</div>
    </div>
    <div class="sc-bubble sc-bubble--tutor">
      <div class="sc-card-head"><span class="sc-arm-name">tutor</span><span>${turn.tutor.latencyMs ? seconds(turn.tutor.latencyMs) : ''}</span></div>
      <div class="sc-speech">${escapeHtml(turn.tutor.text)}</div>
      ${auditChips(turn)}
    </div>
  </div>`;
}

function scenarioSection(report, scenarioId) {
  const rows = report.results.filter((result) => result.scenarioId === scenarioId && result.dialogue);
  if (!rows.length) return '';
  const ordered = report.plan.arms.map((arm) => rows.find((row) => row.armId === arm.id) || null).filter(Boolean);
  const maxTurns = Math.max(...ordered.map((row) => row.dialogue.turnCount));
  const head = ordered
    .map((row) => {
      const closure = row.dialogue.closure.grounded
        ? `<span class="sc-chip sc-chip--pass">resolved at turn ${row.dialogue.closure.completedAtTurn}</span>`
        : `<span class="sc-chip sc-chip--none">unresolved · ${escapeHtml(row.dialogue.stopReason)}</span>`;
      return `<div class="sc-column-head">
        <h3>${escapeHtml(row.armLabel)}</h3>
        <p class="sc-meta">${row.dialogue.turnCount} turns · ${row.dialogue.modelCalls} calls · ${seconds(row.wallClockMs)} · <code>${escapeHtml(row.provider)}.${escapeHtml(row.model)}</code></p>
        <div class="sc-card-foot">${closure}${row.dialogue.repairs ? `<span class="sc-chip sc-chip--repair">${row.dialogue.repairs} repair(s)</span>` : ''}</div>
      </div>`;
    })
    .join('');

  const openings = ordered
    .map(
      (row) => `<div class="sc-cell">
        <div class="sc-bubble sc-bubble--tutor">
          <div class="sc-card-head"><span class="sc-arm-name">tutor opens</span><span></span></div>
          <div class="sc-speech">${escapeHtml(row.dialogue.openingText)}</div>
        </div>
      </div>`,
    )
    .join('');

  const turnRows = Array.from({ length: maxTurns }, (_unused, index) => {
    const cells = ordered.map((row) => turnCell(row, index)).join('');
    return `<div class="sc-turn">
      <div class="sc-turn-gutter"><span class="sc-turn-badge">${index + 1}</span></div>
      <div class="sc-columns" style="--sc-column-count: ${ordered.length}">${cells}</div>
    </div>`;
  }).join('');

  return `<section class="sc-scenario">
    <header class="sc-scenario-head">
      <h2>${escapeHtml(rows[0].scenarioLabel)}</h2>
      <p class="sc-note">${escapeHtml(rows[0].scenarioSummary || '')}</p>
      <p class="sc-meta">world <code>${escapeHtml(rows[0].world)}</code> · learner <code>${escapeHtml(report.plan.learner.provider)}.${escapeHtml(report.plan.learner.model)}</code> profile <code>${escapeHtml(report.plan.learner.profile)}</code></p>
    </header>
    <div class="sc-turn sc-turn--head">
      <div class="sc-turn-gutter"></div>
      <div class="sc-columns" style="--sc-column-count: ${ordered.length}">${head}</div>
    </div>
    <div class="sc-turn">
      <div class="sc-turn-gutter"><span class="sc-turn-badge sc-turn-badge--open">0</span></div>
      <div class="sc-columns" style="--sc-column-count: ${ordered.length}">${openings}</div>
    </div>
    ${turnRows}
  </section>`;
}

export function renderTutorStubShowcaseHtml(report) {
  const scenarioIds = [...new Set(report.results.filter((row) => row.dialogue).map((row) => row.scenarioId))];
  const sections = scenarioIds.map((id) => scenarioSection(report, id)).join('');
  return `<!doctype html>
<html lang="en" data-machine-spirits-house-style="${MACHINE_SPIRITS_HOUSE_STYLE_SCHEMA}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Tutor instrumentation showcase</title>
${renderMachineSpiritsHouseStyleTag()}
<style>
  body { margin: 0; font-family: var(--ms-font-reading); color: var(--ms-text); }
  .sc-wrap { position: relative; z-index: 1; max-width: 1500px; margin: 0 auto; padding: 32px 24px 96px; }
  h1 { font-family: var(--ms-font-sans); font-size: 28px; margin: 0 0 4px; }
  h2 { font-family: var(--ms-font-sans); font-size: 20px; margin: 0 0 4px; }
  h3 { font-family: var(--ms-font-sans); font-size: 15px; margin: 0 0 6px; }
  .sc-note, .sc-meta { color: var(--ms-text-muted); font-size: 13px; margin: 0 0 4px; }
  .sc-meta code { font-family: var(--ms-font-mono); font-size: 12px; }
  .sc-panel { background: var(--ms-surface); border: 1px solid var(--ms-border); padding: 16px 18px; margin: 0 0 24px; }
  .sc-masthead { padding: 20px 18px 16px; }
  .sc-masthead .sc-note { max-width: 80ch; }
  .sc-closing { background: var(--ms-surface); border: 1px solid var(--ms-border); padding: 14px 18px; max-width: none; }
  .sc-table { width: 100%; border-collapse: collapse; font-size: 13px; font-family: var(--ms-font-sans); }
  .sc-table th, .sc-table td { border-bottom: 1px solid var(--ms-border-subtle); padding: 6px 8px; text-align: left; }
  .sc-table th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ms-text-muted); }
  .sc-num { text-align: right; font-family: var(--ms-font-mono); }
  .sc-baseline-row td { background: var(--ms-paper-2); }
  .sc-legend { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
  .sc-pills { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
  .sc-pill { font: 11px/1.6 var(--ms-font-mono); background: var(--ms-paper-3); border: 1px solid var(--ms-border-subtle); padding: 0 6px; }
  .sc-pill--off { background: transparent; color: var(--ms-text-muted); font-style: italic; }
  .sc-tag { font: 10px/1.6 var(--ms-font-mono); text-transform: uppercase; letter-spacing: 0.08em; border: 1px solid var(--ms-border); padding: 0 4px; }
  .sc-scenario { margin: 0 0 48px; }
  .sc-scenario-head { background: var(--ms-surface); border: 1px solid var(--ms-border); padding: 14px 18px; margin: 0 0 16px; }
  .sc-turn { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 12px; align-items: start; border-top: 1px solid var(--ms-border-subtle); padding: 14px 0; }
  .sc-turn--head { border-top: none; padding-top: 0; }
  .sc-turn-gutter { display: flex; justify-content: center; padding-top: 4px; }
  .sc-turn-badge { display: block; width: 34px; height: 34px; background: var(--ms-ink); color: var(--ms-white); font: 700 12px/34px var(--ms-font-mono); text-align: center; }
  .sc-turn-badge--open { background: var(--ms-ochre); }
  .sc-columns { display: grid; grid-template-columns: repeat(var(--sc-column-count), minmax(0, 1fr)); gap: 14px; }
  .sc-column-head { background: var(--ms-surface); border: 1px solid var(--ms-border); padding: 12px 14px; }
  .sc-cell { display: flex; flex-direction: column; gap: 8px; }
  .sc-cell--absent { justify-content: center; }
  .sc-bubble { background: var(--ms-surface-elevated); border: 1px solid var(--ms-border); padding: 12px 14px; box-sizing: border-box; }
  .sc-bubble--learner { background: var(--ms-paper-2); border-left: 3px solid var(--ms-ochre); }
  .sc-bubble--tutor { border-left: 3px solid var(--ms-border); }
  .sc-card-head { display: flex; justify-content: space-between; gap: 8px; font: 11px/1.6 var(--ms-font-mono); color: var(--ms-text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
  .sc-arm-name { color: var(--ms-text); font-weight: 700; }
  .sc-speech { font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
  .sc-empty { color: var(--ms-text-muted); font-size: 13px; font-style: italic; margin: 0; }
  .sc-card-foot { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px; }
  .sc-chip { font: 10px/1.8 var(--ms-font-mono); text-transform: uppercase; letter-spacing: 0.05em; padding: 0 6px; border: 1px solid var(--ms-border); }
  .sc-chip--pass { background: var(--ms-moss); color: var(--ms-white); border-color: var(--ms-moss-deep); }
  .sc-chip--fail { background: var(--ms-red); color: var(--ms-white); border-color: var(--ms-red-dark); }
  .sc-chip--repair { background: var(--ms-ochre); color: var(--ms-black); border-color: var(--ms-ochre); }
  .sc-chip--closed { background: var(--ms-ink); color: var(--ms-white); border-color: var(--ms-ink); }
  .sc-chip--none { background: var(--ms-paper-3); color: var(--ms-text-muted); }
  body[data-sc-guards='off'] .sc-card-foot { display: none; }
  @media (max-width: 960px) {
    .sc-columns { grid-template-columns: 1fr; }
    .sc-turn { grid-template-columns: 1fr; }
  }
</style>
</head>
<body data-sc-guards="on">
${renderMachineSpiritsHouseBackdrop()}
<div class="sc-wrap">
  <div class="sc-panel sc-masthead">
    <h1>Tutor instrumentation showcase</h1>
    <p class="sc-note">Two tutors, two free-running conversations with an automated learner, each run to its own end. The learner model, learner profile, world, and turn cap are identical on every arm; only the tutor-side machinery differs. Because each arm's learner is answering that arm's tutor, the transcripts diverge after the first exchange — read this as two demonstrations side by side, not as a controlled contrast.</p>
    <p class="sc-meta">status <code>${escapeHtml(report.status)}</code> · preset <code>${escapeHtml(report.plan.preset)}</code> · ${report.summary.completed}/${report.plan.plannedDialogues} dialogues · commit <code>${escapeHtml(report.metadata?.gitSha || 'unknown')}</code></p>
  </div>

  <div class="sc-panel">
    <div class="sc-controls"><label><input type="checkbox" id="sc-toggle-guards" checked /> show guard outcomes on every turn</label></div>
  </div>

  <div class="sc-panel"><h2>Arms</h2><div class="sc-legend">${armLegend(report)}</div></div>

  <div class="sc-panel">
    <h2>Benchmark</h2>
    <p class="sc-note">"Guards run" is coverage, not merit — a tutor with no guards configured cannot fail one, so a low failure count on the bare arm mostly means nothing checked it. A repair is a first draft that failed its guards and was regenerated before the learner ever saw it.</p>
    ${benchmarkTable(report)}
  </div>

  ${sections}

  <p class="sc-note sc-closing">These are demonstrations of system behaviour, not evidence about human learning. The learner is an LLM playing a role, the resolution verdict is the tutor stub's own closure lifecycle, and the two arms held nothing constant after the first exchange. For a comparison that does hold the dialogue fixed, see the frozen instrumentation A/B.</p>
</div>
<script>
  (function () {
    document.getElementById('sc-toggle-guards').addEventListener('change', function (event) {
      document.body.dataset.scGuards = event.target.checked ? 'on' : 'off';
    });
  })();
</script>
</body>
</html>`;
}

export function writeTutorStubShowcaseHtml({ report, outPath } = {}) {
  const target = path.resolve(outPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, renderTutorStubShowcaseHtml(report), 'utf8');
  return target;
}
