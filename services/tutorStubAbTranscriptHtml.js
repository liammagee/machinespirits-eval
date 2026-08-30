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
  DRAMATIC_DIALOGUE_INTERCHANGE_SCHEMA,
  renderDramaticDialogueFragment,
  renderDramaticDialogueStyles,
} from './dramaticDialogueRenderer.js';
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

function resultVerdict(result) {
  if (!result) return { label: 'no result', status: 'missing', tone: 'muted' };
  if (result.status === 'blocked') {
    return { label: 'blocked', status: 'blocked', title: result.error?.message || '', tone: 'muted' };
  }
  return result.status === 'pass' ? { label: 'rubric pass', status: 'pass' } : { label: 'rubric fail', status: 'fail' };
}

function resultLabels(result) {
  if (!result) return [];
  const hard = new Set(result.hardFailureClusters || []);
  return [
    ...(result.safetyFailure
      ? [{ label: 'safety failure', status: 'fail', tone: 'ink', kind: 'safety', group: 'safety' }]
      : []),
    ...(result.failureClusters || []).map((cluster) => ({
      label: plainLabel(cluster),
      status: hard.has(cluster) ? 'hard' : 'present',
      tone: hard.has(cluster) ? 'fail' : 'muted',
      kind: 'cluster',
      group: 'clusters',
    })),
  ];
}

/**
 * Adapt one frozen-learner scenario to the shared public dialogue contract.
 * The adapter copies authored and delivered strings without rewriting them and
 * supplies every verdict and label explicitly; the shared renderer infers none.
 */
export function buildTutorStubAbDramaticDialogue(report, scenario) {
  const resultsByKey = new Map(report.results.map((result) => [`${result.caseId}__${result.armId}`, result]));
  return {
    schema: DRAMATIC_DIALOGUE_INTERCHANGE_SCHEMA,
    id: `tutor-stub-ab-${scenario.id || scenario.worldId}`,
    label: `${scenario.label} frozen learner contrast`,
    layout: 'shared-learner',
    arms: report.plan.arms.map((arm) => ({
      id: arm.id,
      label: arm.label,
      baseline: Boolean(arm.baseline),
      summary: arm.summary || '',
    })),
    turns: scenario.turns.map((turn) => ({
      id: String(turn.caseId),
      turn: turn.turn,
      messages: [
        {
          id: `${turn.caseId}__learner`,
          speaker: 'learner',
          turn: turn.turn,
          arm: null,
          text: turn.learnerText || '',
          delivery: { label: 'identical for every arm', status: 'frozen', tone: 'muted' },
          provenance: { sourceId: String(turn.caseId), quoteExact: true },
        },
        ...report.plan.arms.map((arm) => {
          const result = resultsByKey.get(`${turn.caseId}__${arm.id}`) || null;
          const text = result?.candidate || '';
          const advisory = result?.projection?.advisoryChars ?? null;
          return {
            id: `${turn.caseId}__${arm.id}`,
            speaker: 'tutor',
            turn: turn.turn,
            arm: arm.id,
            text,
            delivery: {
              label: `${text.length} chars${advisory === null ? '' : ` · ${advisory} advisory`}`,
              status: result?.status || 'missing',
              tone: 'muted',
            },
            verdict: resultVerdict(result),
            labels: resultLabels(result),
            provenance: { sourceId: `${turn.caseId}__${arm.id}`, quoteExact: true },
          };
        }),
      ],
    })),
    provenance: {
      sourceId: report.plan.id || report.plan.preset,
      sourceHash: report.metadata?.gitSha || undefined,
      note: 'Frozen learner turns; tutor arms are independent counterfactual replies.',
    },
  };
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
  const baselineArmId = report.summary.baselineArmId;
  const scenarios = report.plan.scenarios
    .map(
      (scenario) => `<section class="ab-scenario">
        <header class="ab-scenario-head">
          <h2>${escapeHtml(scenario.label)}</h2>
          <p class="ab-note">${escapeHtml(scenario.criterion || '')}</p>
          <p class="ab-meta">world <code>${escapeHtml(scenario.worldId)}</code> · learner profile <code>${escapeHtml(scenario.learnerProfile || 'unknown')}</code> · ${scenario.turns.length} frozen turns</p>
        </header>
        ${renderDramaticDialogueFragment(buildTutorStubAbDramaticDialogue(report, scenario), {
          diffAgainstArm: baselineArmId,
        })}
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
  body[data-ab-clusters='off'] .dd__labels[data-dd-label-group='clusters'] { display: none; }
  ${renderDramaticDialogueStyles()}
</style>
</head>
<body data-ab-diff="on" data-ab-clusters="on" data-dd-diff="on">
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
      body.dataset.ddDiff = event.target.checked ? 'on' : 'off';
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
