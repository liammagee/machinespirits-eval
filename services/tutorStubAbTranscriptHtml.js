/**
 * Swimlane diff for the instrumentation A/B.
 *
 * The existing transcript swimlane puts one tutor and one learner either side
 * of a spine. Here the learner is shared — the same frozen utterance drives
 * every arm — so the learner takes the spine row and the arms take parallel
 * lanes beneath it. Each non-baseline lane is word-diffed against the baseline
 * lane, so the visual question ("what did all that instrumentation buy?") is
 * answerable by looking rather than by reading two transcripts in sequence.
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  MACHINE_SPIRITS_HOUSE_STYLE_SCHEMA,
  renderMachineSpiritsHouseBackdrop,
  renderMachineSpiritsHouseStyleTag,
} from './machineSpiritsHouseStyle.js';

export const TUTOR_STUB_AB_TRANSCRIPT_HTML_SCHEMA = 'machinespirits.tutor-stub.ab-transcript-html.v1';

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/gu,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );
}

function plainLabel(value) {
  return String(value ?? '')
    .replace(/[_-]+/gu, ' ')
    .trim();
}

function tokenize(text) {
  return String(text || '')
    .split(/(\s+)/u)
    .filter((token) => token.length > 0);
}

function normalizeToken(token) {
  return token.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/**
 * Word-level diff against the baseline lane.
 *
 * Comparison is on the normalized token (case and punctuation folded) so that
 * re-punctuation does not paint a whole sentence as new, but the rendered token
 * is the arm's own text. Whitespace is carried through unmarked.
 */
function diffTokens(baseText, armText) {
  const base = tokenize(baseText)
    .filter((token) => token.trim().length > 0)
    .map(normalizeToken);
  const arm = tokenize(armText);
  const armWords = arm.map((token, index) => ({ token, index })).filter((entry) => entry.token.trim().length > 0);
  const armKeys = armWords.map((entry) => normalizeToken(entry.token));
  const rows = base.length;
  const cols = armKeys.length;
  const table = Array.from({ length: rows + 1 }, () => new Uint32Array(cols + 1));
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      table[i][j] = base[i] === armKeys[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const shared = new Set();
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (base[i] === armKeys[j]) {
      shared.add(armWords[j].index);
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) i += 1;
    else j += 1;
  }
  return arm.map((token, index) => ({
    token,
    status: token.trim().length === 0 ? 'space' : shared.has(index) ? 'same' : 'added',
  }));
}

function renderDiffSpeech(baseText, armText) {
  if (!baseText) return escapeHtml(armText || '');
  return diffTokens(baseText, armText)
    .map((entry) =>
      entry.status === 'added' ? `<mark class="ab-added">${escapeHtml(entry.token)}</mark>` : escapeHtml(entry.token),
    )
    .join('');
}

function verdictChip(result) {
  if (!result) return '<span class="ab-chip ab-chip--missing">no result</span>';
  if (result.status === 'blocked') {
    return `<span class="ab-chip ab-chip--blocked" title="${escapeHtml(result.error?.message || '')}">blocked</span>`;
  }
  const safety = result.safetyFailure ? '<span class="ab-chip ab-chip--safety">safety failure</span>' : '';
  const verdict =
    result.status === 'pass'
      ? '<span class="ab-chip ab-chip--pass">rubric pass</span>'
      : '<span class="ab-chip ab-chip--fail">rubric fail</span>';
  return `${verdict}${safety}`;
}

function clusterChips(result) {
  const hard = new Set(result?.hardFailureClusters || []);
  return (result?.failureClusters || [])
    .map(
      (cluster) =>
        `<span class="ab-chip ab-chip--cluster${hard.has(cluster) ? ' ab-chip--hard' : ''}">${escapeHtml(plainLabel(cluster))}</span>`,
    )
    .join('');
}

function featurePills(arm) {
  const pills = arm.features.map((feature) => `<span class="ab-pill">${escapeHtml(plainLabel(feature))}</span>`);
  // A control carries no instrumentation feature but is not the bare tutor, so
  // it gets its own pill rather than being drawn as an empty lane.
  if (arm.genericPlan) pills.push('<span class="ab-pill ab-pill--off">generic plan</span>');
  if (arm.lengthTargetChars) {
    pills.push(`<span class="ab-pill ab-pill--off">length ${arm.lengthTargetChars}</span>`);
  }
  if (!pills.length) return '<span class="ab-pill ab-pill--off">no instrumentation</span>';
  return pills.join('');
}

function armLane(arm, result, baselineText, { baseline }) {
  const text = result?.candidate || '';
  const body = baseline || !text ? escapeHtml(text) : renderDiffSpeech(baselineText, text);
  const chars = text.length;
  const advisory = result?.projection?.advisoryChars ?? null;
  return `<div class="ab-lane" data-arm="${escapeHtml(arm.id)}" data-status="${escapeHtml(result?.status || 'missing')}">
    <article class="ab-card${baseline ? ' ab-card--baseline' : ''}">
      <header class="ab-card-head">
        <span class="ab-arm-name">${escapeHtml(arm.label)}</span>
        <span class="ab-metrics">${chars} chars${advisory === null ? '' : ` · ${advisory} advisory`}</span>
      </header>
      <div class="ab-speech">${body || '<em class="ab-empty">no candidate</em>'}</div>
      <footer class="ab-card-foot">${verdictChip(result)}${clusterChips(result)}</footer>
    </article>
  </div>`;
}

function turnRows(scenario, arms, resultsByKey, baselineArmId) {
  return scenario.turns
    .map((turn) => {
      const baselineResult = resultsByKey.get(`${turn.caseId}__${baselineArmId}`) || null;
      const baselineText = baselineResult?.candidate || '';
      const lanes = arms
        .map((arm) =>
          armLane(arm, resultsByKey.get(`${turn.caseId}__${arm.id}`) || null, baselineText, {
            baseline: arm.id === baselineArmId,
          }),
        )
        .join('');
      return `<section class="ab-turn" data-turn="${escapeHtml(turn.turn)}">
        <div class="ab-spine-row">
          <b class="ab-turn-badge">${escapeHtml(turn.turn)}</b>
          <article class="ab-card ab-card--learner">
            <header class="ab-card-head"><span class="ab-arm-name">learner (frozen)</span><span class="ab-metrics">identical for every arm</span></header>
            <div class="ab-speech">${escapeHtml(turn.learnerText || '')}</div>
          </article>
        </div>
        <div class="ab-lanes" style="--ab-lane-count: ${arms.length}">${lanes}</div>
      </section>`;
    })
    .join('');
}

function summaryTable(report) {
  const rows = report.summary.arms
    .map((arm) => {
      const rate = arm.passRate === null ? '—' : `${Math.round(arm.passRate * 100)}%`;
      const delta = arm.clusterDeltaTotal ?? 0;
      const versus = arm.baseline
        ? '—'
        : `<span class="ab-delta" data-sign="${delta < 0 ? 'down' : delta > 0 ? 'up' : 'flat'}">${delta > 0 ? '+' : ''}${delta}</span>`;
      return `<tr${arm.baseline ? ' class="ab-baseline-row"' : ''}>
        <td>${escapeHtml(arm.label)}${arm.baseline ? ' <span class="ab-tag">baseline</span>' : ''}</td>
        <td class="ab-num">${arm.totalClusters ?? '—'}</td>
        <td class="ab-num">${arm.totalHardClusters ?? '—'}</td>
        <td class="ab-num">${versus}</td>
        <td class="ab-num">${arm.pass}/${arm.scored}</td>
        <td class="ab-num">${rate}</td>
        <td class="ab-num">${arm.safetyFailures}</td>
        <td class="ab-num">${arm.meanAdvisoryChars ?? '—'}</td>
        <td class="ab-num">${arm.meanCandidateChars ?? '—'}</td>
        <td class="ab-num">${arm.meanLatencyMs === null ? '—' : `${arm.meanLatencyMs} ms`}</td>
      </tr>`;
    })
    .join('');
  return `<table class="ab-table">
    <thead><tr><th>Arm</th><th>Broken rules</th><th>Hard</th><th>Δ vs baseline</th><th>Pass</th><th>Rate</th><th>Safety</th><th>Advisory chars</th><th>Reply chars</th><th>Latency</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="ab-note">Broken rules are the headline. Pass is all-or-nothing per turn and can read 0/N for every arm at once; the broken-rule tallies say how far each arm is from clean.</p>`;
}

function clusterDeltaTable(report) {
  const blocks = report.summary.arms
    .filter((arm) => !arm.baseline && arm.clusterDeltas.length)
    .map((arm) => {
      const rows = arm.clusterDeltas
        .map(
          (entry) => `<tr>
            <td>${escapeHtml(plainLabel(entry.cluster))}</td>
            <td class="ab-num">${entry.baseline}</td>
            <td class="ab-num">${entry.arm}</td>
            <td class="ab-num ab-delta" data-sign="${entry.delta < 0 ? 'down' : entry.delta > 0 ? 'up' : 'flat'}">${entry.delta > 0 ? '+' : ''}${entry.delta}</td>
          </tr>`,
        )
        .join('');
      return `<div class="ab-delta-block">
        <h3>${escapeHtml(arm.label)} vs baseline</h3>
        <table class="ab-table"><thead><tr><th>Broken rule</th><th>Baseline</th><th>Arm</th><th>Δ</th></tr></thead><tbody>${rows}</tbody></table>
      </div>`;
    })
    .join('');
  return blocks || '<p class="ab-note">No broken rules were recorded on either side.</p>';
}

function armLegend(report) {
  return report.plan.arms
    .map(
      (arm) => `<div class="ab-legend-arm">
        <h3>${escapeHtml(arm.label)}${arm.baseline ? ' <span class="ab-tag">baseline</span>' : ''}</h3>
        <p>${escapeHtml(arm.summary)}</p>
        <div class="ab-pills">${featurePills(arm)}</div>
      </div>`,
    )
    .join('');
}

export function renderTutorStubAbTranscriptHtml(report) {
  const arms = report.plan.arms;
  const baselineArmId = report.summary.baselineArmId;
  const resultsByKey = new Map();
  for (const result of report.results) resultsByKey.set(`${result.caseId}__${result.armId}`, result);
  const scenarios = report.plan.scenarios
    .map(
      (scenario) => `<section class="ab-scenario">
        <header class="ab-scenario-head">
          <h2>${escapeHtml(scenario.label)}</h2>
          <p class="ab-note">${escapeHtml(scenario.criterion || '')}</p>
          <p class="ab-meta">world <code>${escapeHtml(scenario.worldId)}</code> · learner profile <code>${escapeHtml(scenario.learnerProfile || 'unknown')}</code> · ${scenario.turns.length} frozen turns</p>
        </header>
        ${turnRows(scenario, arms, resultsByKey, baselineArmId)}
      </section>`,
    )
    .join('');

  const called = report.results.filter((result) => result.called).length;
  return `<!doctype html>
<html lang="en" data-machine-spirits-house-style="${MACHINE_SPIRITS_HOUSE_STYLE_SCHEMA}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Tutor instrumentation A/B — swimlane diff</title>
${renderMachineSpiritsHouseStyleTag()}
<style>
  body { margin: 0; font-family: var(--ms-font-reading); color: var(--ms-text); }
  .ab-wrap { position: relative; z-index: 1; max-width: 1400px; margin: 0 auto; padding: 32px 24px 96px; }
  h1 { font-family: var(--ms-font-sans); font-size: 28px; margin: 0 0 4px; }
  h2 { font-family: var(--ms-font-sans); font-size: 20px; margin: 0 0 4px; }
  h3 { font-family: var(--ms-font-sans); font-size: 15px; margin: 0 0 6px; }
  .ab-note, .ab-meta { color: var(--ms-text-muted); font-size: 13px; margin: 0 0 4px; }
  .ab-meta code { font-family: var(--ms-font-mono); font-size: 12px; }
  .ab-panel { background: var(--ms-surface); border: 1px solid var(--ms-border); padding: 16px 18px; margin: 0 0 24px; }
  /* The house backdrop is dark; the masthead needs the same surface as every
     other panel or the title and standing caveat read as dark-on-dark. */
  .ab-masthead { padding: 20px 18px 16px; }
  .ab-masthead .ab-note { max-width: 80ch; }
  .ab-closing { background: var(--ms-surface); border: 1px solid var(--ms-border); padding: 14px 18px; max-width: none; }
  .ab-controls { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; font-size: 13px; font-family: var(--ms-font-sans); }
  .ab-controls label { display: inline-flex; gap: 6px; align-items: center; cursor: pointer; }
  .ab-table { width: 100%; border-collapse: collapse; font-size: 13px; font-family: var(--ms-font-sans); }
  .ab-table th, .ab-table td { border-bottom: 1px solid var(--ms-border-subtle); padding: 6px 8px; text-align: left; }
  .ab-table th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ms-text-muted); }
  .ab-num { text-align: right; font-family: var(--ms-font-mono); }
  .ab-baseline-row td { background: var(--ms-paper-2); }
  .ab-delta[data-sign='down'] { color: var(--ms-moss-deep); }
  .ab-delta[data-sign='up'] { color: var(--ms-red-dark); }
  .ab-delta-block { margin-top: 16px; }
  .ab-legend { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
  .ab-pills { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
  .ab-pill { font: 11px/1.6 var(--ms-font-mono); background: var(--ms-paper-3); border: 1px solid var(--ms-border-subtle); padding: 0 6px; }
  .ab-pill--off { background: transparent; color: var(--ms-text-muted); font-style: italic; }
  .ab-tag { font: 10px/1.6 var(--ms-font-mono); text-transform: uppercase; letter-spacing: 0.08em; border: 1px solid var(--ms-border); padding: 0 4px; }
  .ab-scenario { margin: 0 0 40px; }
  .ab-scenario-head { background: var(--ms-surface); border: 1px solid var(--ms-border); padding: 14px 18px; margin: 0 0 16px; }
  .ab-turn { border-top: 2px solid var(--ms-ink); padding: 16px 0 24px; }
  .ab-spine-row { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 12px; align-items: start; margin-bottom: 12px; }
  .ab-turn-badge { display: block; width: 34px; height: 34px; background: var(--ms-ink); color: var(--ms-white); font: 700 12px/34px var(--ms-font-mono); text-align: center; }
  .ab-lanes { display: grid; grid-template-columns: repeat(var(--ab-lane-count), minmax(0, 1fr)); gap: 12px; margin-left: 56px; }
  .ab-card { background: var(--ms-surface-elevated); border: 1px solid var(--ms-border); padding: 12px 14px; height: 100%; box-sizing: border-box; }
  .ab-card--learner { background: var(--ms-paper-2); border-left: 3px solid var(--ms-ochre); }
  .ab-card--baseline { border-left: 3px solid var(--ms-border); }
  .ab-card-head { display: flex; justify-content: space-between; gap: 8px; font: 11px/1.6 var(--ms-font-mono); color: var(--ms-text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
  .ab-arm-name { color: var(--ms-text); font-weight: 700; }
  .ab-speech { font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
  .ab-empty { color: var(--ms-text-muted); }
  .ab-card-foot { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px; }
  .ab-chip { font: 10px/1.8 var(--ms-font-mono); text-transform: uppercase; letter-spacing: 0.05em; padding: 0 6px; border: 1px solid var(--ms-border); }
  .ab-chip--pass { background: var(--ms-moss); color: var(--ms-white); border-color: var(--ms-moss-deep); }
  .ab-chip--fail { background: var(--ms-red); color: var(--ms-white); border-color: var(--ms-red-dark); }
  .ab-chip--safety { background: var(--ms-black); color: var(--ms-white); border-color: var(--ms-black); }
  .ab-chip--blocked, .ab-chip--missing { background: var(--ms-paper-3); color: var(--ms-text-muted); }
  .ab-chip--cluster { background: transparent; color: var(--ms-text-muted); }
  .ab-chip--hard { color: var(--ms-red-dark); border-color: var(--ms-red-dark); }
  mark.ab-added { background: rgba(var(--ms-red-rgb), 0.16); color: inherit; padding: 0 1px; }
  body[data-ab-diff='off'] mark.ab-added { background: transparent; }
  body[data-ab-clusters='off'] .ab-chip--cluster { display: none; }
  @media (max-width: 900px) {
    .ab-lanes { grid-template-columns: 1fr; margin-left: 0; }
    .ab-spine-row { grid-template-columns: 1fr; }
  }
</style>
</head>
<body data-ab-diff="on" data-ab-clusters="on">
${renderMachineSpiritsHouseBackdrop()}
<div class="ab-wrap">
  <div class="ab-panel ab-masthead">
    <h1>Tutor instrumentation A/B</h1>
    <p class="ab-note">Frozen replay of a recorded dialogue. Learner utterances, public prefix, world, and evidence state are identical across arms; only the private planner context the speaking tutor receives varies. Every arm is graded by the same pinned guard set.</p>
    <p class="ab-meta">status <code>${escapeHtml(report.status)}</code> · preset <code>${escapeHtml(report.plan.preset)}</code> · ${called}/${report.plan.maxCalls} calls · commit <code>${escapeHtml(report.metadata?.gitSha || 'unknown')}</code></p>
  </div>

  <div class="ab-panel">
    <div class="ab-controls">
      <label><input type="checkbox" id="ab-toggle-diff" checked /> highlight what the baseline did not say</label>
      <label><input type="checkbox" id="ab-toggle-clusters" checked /> show broken rules</label>
    </div>
  </div>

  <div class="ab-panel"><h2>Arms</h2><div class="ab-legend">${armLegend(report)}</div></div>
  <div class="ab-panel"><h2>Rubric outcome</h2>${summaryTable(report)}${clusterDeltaTable(report)}</div>

  ${scenarios}

  <p class="ab-note ab-closing">Turns after the first are counterfactual for every arm except the one that produced the recording: the frozen learner utterances were written in response to the recorded tutor, not to this arm's replies. Read each row as an independent same-context comparison, not as two free-running conversations.</p>
</div>
<script>
  (function () {
    var body = document.body;
    document.getElementById('ab-toggle-diff').addEventListener('change', function (event) {
      body.dataset.abDiff = event.target.checked ? 'on' : 'off';
    });
    document.getElementById('ab-toggle-clusters').addEventListener('change', function (event) {
      body.dataset.abClusters = event.target.checked ? 'on' : 'off';
    });
  })();
</script>
</body>
</html>`;
}

export function writeTutorStubAbTranscriptHtml({ report, outPath } = {}) {
  const target = path.resolve(outPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, renderTutorStubAbTranscriptHtml(report), 'utf8');
  return target;
}
