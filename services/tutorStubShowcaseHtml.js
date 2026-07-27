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
import {
  loadShowcaseScoreOverlay,
  showcaseLabelArmCounts,
  showcaseTurnScores,
  showcaseV22ArmMeans,
  showcaseV30ArmMeans,
} from './tutorStubShowcaseScoreOverlay.js';

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

function formatScore(value) {
  return Number.isFinite(value) ? value.toFixed(1) : '—';
}

/**
 * Per-arm score cells for the benchmark table, keyed by arm id. Built once for
 * the whole run so the headline table carries quality beside cost instead of
 * making a reader scroll to a separate section to find out whether the extra
 * calls bought anything.
 */
function armScoreCells(overlay) {
  const cells = new Map();
  if (!overlay) return cells;
  for (const arm of showcaseV22ArmMeans(overlay)) {
    cells.set(arm.armId, { ...(cells.get(arm.armId) || {}), first: arm.first, last: arm.last, scored: arm.scored });
  }
  for (const arm of showcaseLabelArmCounts(overlay)) {
    cells.set(arm.armId, { ...(cells.get(arm.armId) || {}), verdict: arm.verdict, labelled: arm.turnsScored });
  }
  return cells;
}

function benchmarkTable(report, overlay) {
  const scored = armScoreCells(overlay);
  const hasV22 = Boolean(overlay?.tutorV22);
  const hasLabels = Boolean(overlay?.prBenchmark);
  const rows = report.summary.arms
    .map((arm) => {
      const resolved = arm.closureMeasurable
        ? `${arm.grounded}/${arm.closureMeasurable}`
        : '<span class="sc-na" title="closure lifecycle bypassed on this arm">n/a</span>';
      const coverage = arm.meanGuardCoverage === null ? '—' : `${Math.round(arm.meanGuardCoverage * 100)}%`;
      const scores = scored.get(arm.id) || {};
      // "not scored" rather than an em dash on the whole cell: an arm nobody
      // paid a judge for must not read like an arm that scored nothing.
      const unscored = '<span class="sc-na" title="no judge has scored this arm">not scored</span>';
      const v22Cells = hasV22
        ? `<td class="sc-num">${scores.scored ? formatScore(scores.first) : unscored}</td>
           <td class="sc-num">${scores.scored ? formatScore(scores.last) : unscored}</td>`
        : '';
      const labelCell = hasLabels
        ? `<td class="sc-num">${
            scores.labelled
              ? `<span title="pass / fail / unsure over the three axes in force">${scores.verdict.pass}/${scores.verdict.fail}/${scores.verdict.unsure}</span>`
              : unscored
          }</td>`
        : '';
      return `<tr${arm.baseline ? ' class="sc-baseline-row"' : ''}>
        <td>${escapeHtml(arm.label)}${arm.baseline ? ' <span class="sc-tag">baseline</span>' : ''}</td>
        <td class="sc-num">${resolved}</td>
        ${v22Cells}${labelCell}
        <td class="sc-num">${arm.meanTurns ?? '—'}</td>
        <td class="sc-num">${arm.meanModelCalls ?? '—'}</td>
        <td class="sc-num">${arm.meanSecondsPerTurn ?? '—'}s</td>
        <td class="sc-num">${arm.totalTokens ? arm.totalTokens.toLocaleString('en-US') : '—'}</td>
        <td class="sc-num">${coverage}</td>
        <td class="sc-num">${arm.guardOutcomes.accepted}</td>
        <td class="sc-num">${arm.guardOutcomes.repaired}</td>
        <td class="sc-num">${arm.guardOutcomes.fallback}</td>
      </tr>`;
    })
    .join('');
  const scoreHeads =
    (hasV22 ? '<th class="sc-num sc-th-score">Rubric first</th><th class="sc-num sc-th-score">Rubric last</th>' : '') +
    (hasLabels ? '<th class="sc-num sc-th-score">Labels</th>' : '');
  // The headline columns stay on v2.2 alone. A second rubric version cannot share
  // a column pair without becoming one number, so v3.0 is named here and read in
  // its own block below rather than folded in beside the cost figures.
  const v30Note = overlay?.tutorV30
    ? ` A v3.0 pass was also run; it is kept out of this table and reported on its own in
      <a href="#sc-scoring">Rubric scoring</a>, because two rubric versions sharing one column pair would read as
      one measure.`
    : '';
  const scoreNote =
    hasV22 || hasLabels
      ? `<p class="sc-note"><strong>Rubric first/last</strong> are v2.2 overall scores (0–100) for the opening and
      closing turn${hasLabels ? '; <strong>Labels</strong> is pass/fail/unsure over the three PR-benchmark axes in force on every turn' : ''}.
      These instruments are not commensurable and nothing here averages across them — see
      <a href="#sc-scoring">Rubric scoring</a> for what each one asks and what it withholds.${v30Note}</p>`
      : '';
  return `<table class="sc-table">
    <thead><tr>
      <th>Arm</th><th class="sc-num">Resolved</th>${scoreHeads}<th class="sc-num">Turns</th><th class="sc-num">Calls</th>
      <th class="sc-num">Per turn</th><th class="sc-num">Tokens</th><th class="sc-num">Guard coverage</th>
      <th class="sc-num">Accepted</th><th class="sc-num">Repaired</th><th class="sc-num">Fallback</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${scoreNote}
  <p class="sc-note">Guard coverage is the share of the eight per-turn guards the stub itself
  reports as enabled. The last three columns are what those guards did with each first
  draft: <strong>accepted</strong> nothing to fix; <strong>repaired</strong> the draft failed
  and the tutor spoke again, with the learner seeing only the second draft;
  <strong>fallback</strong> the draft failed and a deterministic line went out instead — a cost
  of the guard stack, not a win. <strong>Resolved</strong> is <em>n/a</em> where the closure
  lifecycle was bypassed: that arm has no resolution verdict rather than a negative one.</p>`;
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
  const guards = turn.tutor.guards;
  const chips = [];
  if (guards.outcomeClass === 'repaired') {
    chips.push('<span class="sc-chip sc-chip--repair">first draft repaired</span>');
  } else if (guards.outcomeClass === 'fallback') {
    chips.push('<span class="sc-chip sc-chip--fallback">draft rejected · fallback line</span>');
  }
  for (const audit of failed) {
    chips.push(`<span class="sc-chip sc-chip--fail">${escapeHtml(audit.key.replace(/^tutor/u, ''))}</span>`);
  }
  // Guard chips report what the stub says was *enabled* this turn, not how many
  // audit records exist — an audit record is written either way, so counting
  // records would show the same number on an arm that runs no guards at all.
  if (!guards.recorded) chips.push('<span class="sc-chip sc-chip--none">no guards ran</span>');
  else if (!failed.length && guards.outcomeClass === 'accepted') {
    chips.push(`<span class="sc-chip sc-chip--pass">${guards.enabled.length} guards ok</span>`);
  }
  if (turn.closure.deterministic) chips.push('<span class="sc-chip sc-chip--closed">closed</span>');
  return `<div class="sc-card-foot">${chips.join('')}</div>`;
}

const LABEL_CHIP_CLASS = { pass: 'sc-chip--pass', fail: 'sc-chip--fail', unsure: 'sc-chip--unsure' };

function labelChip(text, label, title) {
  const cls = LABEL_CHIP_CLASS[label] || 'sc-chip--none';
  return `<span class="sc-chip ${cls}" title="${escapeHtml(title || '')}">${escapeHtml(text)}</span>`;
}

/**
 * One tutor-rubric row for one turn. Version-agnostic: the tag carries whichever
 * version wrote the artefact, so two rubric versions sit as two labelled rows and
 * a reader cannot mistake one for the other. The judge reasoning is prefixed with
 * the version too, because `content_accuracy` exists in both v2.2 and v3.0 and
 * two unprefixed entries for it would read as one dimension scored twice.
 *
 * A dimension the judge marked not applicable renders `n/a`, never its maximum —
 * the distinction the rubric itself insists on.
 */
function tutorScoreRow(side, scored, fallbackVersion) {
  const version = side.rubricVersion || fallbackVersion;
  const why = [];
  let chip;
  if (scored?.success && Number.isFinite(scored.overallScore)) {
    chip =
      `<span class="sc-chip sc-chip--score" title="Weighted across the v${escapeHtml(version)} dimensions on this ` +
      `turn alone, each normalised on its own scale.">${scored.overallScore.toFixed(1)} / 100</span>`;
    for (const [key, value] of Object.entries(scored.scores || {})) {
      const shown = value?.not_applicable === true ? 'n/a' : String(value?.score);
      why.push(
        `<p><strong>v${escapeHtml(version)} ${escapeHtml(key)} — ${escapeHtml(shown)}.</strong> ` +
          `${escapeHtml(value?.reasoning || '')}</p>`,
      );
    }
  } else {
    chip =
      `<span class="sc-chip sc-chip--none" title="v${escapeHtml(version)} was run over ` +
      `${escapeHtml(side.turnsScored || 'selected turns')}, not every turn.">not scored</span>`;
  }
  return {
    html: `<div class="sc-score-row"><span class="sc-score-tag">tutor v${escapeHtml(version)}</span>${chip}</div>`,
    why,
  };
}

/**
 * Rubric labels for one turn, rendered as clearly separate rows because they come
 * from instruments that measure different things. Nothing here is summed across
 * them, and that includes the two tutor-rubric versions.
 */
function scoreBlock(overlay, dialogueId, turnIndex) {
  if (!overlay) return '';
  const { prBenchmark, tutorV22, tutorV30 } = showcaseTurnScores(overlay, dialogueId, turnIndex);
  const rows = [];
  const why = [];

  if (overlay.prBenchmark) {
    const chips = [];
    if (prBenchmark?.success && prBenchmark.axes) {
      for (const axisId of overlay.prBenchmark.axisIds) {
        const axis = prBenchmark.axes[axisId];
        if (!axis) continue;
        chips.push(labelChip(`${axisId.replace('learner_', '')} ${axis.label}`, axis.label, axis.rationale));
        why.push(
          `<p><strong>${escapeHtml(axisId)} — ${escapeHtml(axis.label)}.</strong> ${escapeHtml(axis.rationale || '')}</p>`,
        );
      }
      if (prBenchmark.machineSafetyLabel) {
        chips.push(
          labelChip(
            `leak audit ${prBenchmark.machineSafetyLabel}`,
            prBenchmark.machineSafetyLabel,
            'Machine channel: tutorLeakAudit. Asks whether private state escaped, which is a different question from whether the turn’s support is public.',
          ),
        );
      }
    } else {
      // A turn the judge could not label is not a turn that passed.
      chips.push(labelChip('not scored', null, prBenchmark?.error || 'no judge verdict for this turn'));
    }
    rows.push(
      `<div class="sc-score-row"><span class="sc-score-tag" title="Three of seven axes; four were withheld — see the rubric panel above.">pr-bench ${escapeHtml(overlay.prBenchmark.rubricVersion || '1.0')}</span>${chips.join('')}</div>`,
    );
  }

  // Most turns have no tutor-rubric score at all: the scoring pass defaults to
  // first and last only. `tutorScoreRow` says so on the turn, which keeps an
  // unscored turn from reading as an unblemished one.
  for (const [side, scored, fallbackVersion] of [
    [overlay.tutorV22, tutorV22, '2.2'],
    [overlay.tutorV30, tutorV30, '3.0'],
  ]) {
    if (!side) continue;
    const built = tutorScoreRow(side, scored, fallbackVersion);
    rows.push(built.html);
    why.push(...built.why);
  }

  const detail = why.length
    ? `<details class="sc-why"><summary>judge reasoning</summary>${why.join('')}</details>`
    : '';
  return `<div class="sc-scores">${rows.join('')}${detail}</div>`;
}

function turnCell(result, index, overlay) {
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
      ${scoreBlock(overlay, result.id, turn.index)}
    </div>
  </div>`;
}

/**
 * Run-level scoring panel. Two sub-panels, never one table: the withheld axes
 * have to be named on the page, and the v2.2 caveat has to sit beside every v2.2
 * number it applies to.
 */
function scorePanel(overlay) {
  if (!overlay) return '';
  const blocks = [];

  if (overlay.prBenchmark) {
    const axisIds = overlay.prBenchmark.axisIds;
    const rows = showcaseLabelArmCounts(overlay)
      .map((arm) => {
        const cells = axisIds
          .map((axisId) => {
            const counts = arm.axes?.[axisId] || { pass: 0, fail: 0, unsure: 0 };
            return `<td class="sc-num">${counts.pass}/${counts.fail}/${counts.unsure}</td>`;
          })
          .join('');
        const failed = arm.turnsFailed
          ? ` <span class="sc-na" title="the judge was asked and produced no verdict">+${arm.turnsFailed} failed</span>`
          : '';
        return `<tr${arm.baseline ? ' class="sc-baseline-row"' : ''}><td>${escapeHtml(arm.armId)}</td>
          <td class="sc-num">${arm.turnsScored}${failed}</td>${cells}
          <td class="sc-num">${arm.verdict.pass}/${arm.verdict.fail}/${arm.verdict.unsure}</td></tr>`;
      })
      .join('');
    const withheld = overlay.prBenchmark.axesUnavailable
      .map((entry) => `<li><code>${escapeHtml(entry.axisId)}</code> — ${escapeHtml(entry.reason)}</li>`)
      .join('');
    blocks.push(`<div class="sc-score-panel">
      <h3>PR-benchmark labels — v${escapeHtml(overlay.prBenchmark.rubricVersion || '1.0')}</h3>
      <p class="sc-note">Judge <code>${escapeHtml(overlay.prBenchmark.judge || 'unknown')}</code>. Counts are pass/fail/unsure over every tutor turn.</p>
      <table class="sc-table">
        <thead><tr><th>Arm</th><th class="sc-num">Turns</th>${axisIds.map((axisId) => `<th class="sc-num">${escapeHtml(axisId)}</th>`).join('')}<th class="sc-num">In force</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="sc-note"><strong>Four of the seven axes were not asked, and an unasked axis is not a passed axis.</strong>
      This rubric scores a frozen candidate against a case criterion and a set of authored turn obligations; a
      free-running showcase turn has none of the three.</p>
      <ul class="sc-note sc-withheld">${withheld}</ul>
      <p class="sc-note">The last column is a verdict over the axes in force only — deliberately not the rubric's own
      <code>overall_delivery</code>, which is a composite over the full hard set against a criterion that does not
      exist here.</p>
    </div>`);
  }

  if (overlay.tutorV22) {
    const means = showcaseV22ArmMeans(overlay);
    const fmt = (value) => (Number.isFinite(value) ? value.toFixed(1) : '—');
    const rows = means
      .map(
        (arm) => `<tr${arm.baseline ? ' class="sc-baseline-row"' : ''}><td>${escapeHtml(arm.armId)}</td>
        <td class="sc-num">${arm.scored}</td><td class="sc-num">${fmt(arm.first)}</td>
        <td class="sc-num">${fmt(arm.last)}</td><td class="sc-num">${fmt(arm.all)}</td></tr>`,
      )
      .join('');
    blocks.push(`<div class="sc-score-panel">
      <h3>Tutor rubric — v${escapeHtml(overlay.tutorV22.rubricVersion || '2.2')}</h3>
      <p class="sc-note">Judge <code>${escapeHtml(overlay.tutorV22.judge || 'unknown')}</code>. Turns scored:
      <code>${escapeHtml(overlay.tutorV22.turnsScored || 'selected')}</code> — every other turn is marked
      <em>not scored</em> rather than left blank.</p>
      <table class="sc-table">
        <thead><tr><th>Arm</th><th class="sc-num">Scored</th><th class="sc-num">First</th><th class="sc-num">Last</th><th class="sc-num">All</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="sc-note"><strong>v2.2 scores one turn at a time and rewards opening inquiry up.</strong>
      <code>elicitation_quality</code> and <code>productive_difficulty</code> both pay for leaving a question live, so
      a turn that properly closes a dialogue scores low and a turn that keeps an unresolved thread going scores high.
      Read any number here beside the closure verdict in the benchmark table, not on its own.</p>
    </div>`);
  }

  if (overlay.tutorV30) {
    const rows = showcaseV30ArmMeans(overlay)
      .map(
        (arm) => `<tr${arm.baseline ? ' class="sc-baseline-row"' : ''}><td>${escapeHtml(arm.armId)}</td>
        <td class="sc-num">${arm.scored}</td><td class="sc-num">${formatScore(arm.first)}</td>
        <td class="sc-num">${formatScore(arm.last)}</td><td class="sc-num">${formatScore(arm.all)}</td></tr>`,
      )
      .join('');
    blocks.push(`<div class="sc-score-panel">
      <h3>Tutor rubric — v${escapeHtml(overlay.tutorV30.rubricVersion || '3.0')} <span class="sc-tag">calibration</span></h3>
      <p class="sc-note">Judge <code>${escapeHtml(overlay.tutorV30.judge || 'unknown')}</code>. Turns scored:
      <code>${escapeHtml(overlay.tutorV30.turnsScored || 'selected')}</code>.</p>
      <table class="sc-table">
        <thead><tr><th>Arm</th><th class="sc-num">Scored</th><th class="sc-num">First</th><th class="sc-num">Last</th><th class="sc-num">All</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="sc-note"><strong>v3.0 is a prospective instrument, not the active rubric.</strong> A v2.2 PCA found one
      dominant factor, so v3.0 scores that factor as a single 1–10 <code>overall_pedagogical_quality</code> dimension
      (weight 0.85) beside 1–5 <code>content_accuracy</code> (0.15), each normalised on its own scale before weighting.
      Content accuracy is dropped outright on a turn that makes no assessable factual claim and the remaining weight is
      renormalised, so two turns in this table can rest on different effective compositions.</p>
      <p class="sc-note"><strong>These numbers are not comparable with the v2.2 numbers above.</strong> Different
      dimensions, different scales, different aggregate. Nothing on this page averages one version with the other, and
      a v3.0 score belongs in a table beside a v2.2 score only as two separately labelled readings of the same turn.</p>
    </div>`);
  }

  // Counted rather than hardcoded: a page rendered with one artefact present used
  // to announce two instruments, and a page with three would have announced two
  // as well.
  const counted =
    blocks.length === 1
      ? 'One instrument.'
      : `${['Two', 'Three', 'Four'][blocks.length - 2] || blocks.length} instruments, kept apart. They are not views
        of one measure and nothing here averages across them.`;
  return `<div class="sc-panel" id="sc-scoring">
    <h2>Rubric scoring</h2>
    <p class="sc-note">${counted} Each saw only the public transcript: the proof DAG, release plan, scaffold and
    guard verdicts were withheld from the judge, so the instrumented arm is never scored on its own internal
    artefacts.</p>
    <div class="sc-score-panels">${blocks.join('')}</div>
  </div>`;
}

/**
 * The arm's own scores for this scenario, not the run-wide means. A side-by-side
 * whose columns carry a pooled number would invite the reader to compare this
 * scenario's transcript against an average that includes the other scenario.
 */
function scenarioHeadScores(overlay, scenarioId, armId) {
  if (!overlay) return '';
  const parts = [];
  // The same versions as the per-turn rows, in the same order and at the same
  // grain, so a column head cannot disagree with the turns beneath it about which
  // instruments ran. Each version keeps its own entry: a head that showed one
  // number for "the tutor rubric" would be the pooled reading this grain exists
  // to prevent.
  for (const [present, armMeans, version] of [
    [overlay.tutorV22, showcaseV22ArmMeans, '2.2'],
    [overlay.tutorV30, showcaseV30ArmMeans, '3.0'],
  ]) {
    if (!present) continue;
    const arm = armMeans(overlay, { scenarioId }).find((entry) => entry.armId === armId);
    parts.push(
      arm?.scored
        ? `<span class="sc-headscore"><span class="sc-score-tag">v${version}</span> ${formatScore(arm.first)} first · ${formatScore(arm.last)} last</span>`
        : `<span class="sc-headscore sc-na"><span class="sc-score-tag">v${version}</span> not scored</span>`,
    );
  }
  const labels = showcaseLabelArmCounts(overlay, { scenarioId }).find((arm) => arm.armId === armId);
  if (overlay.prBenchmark) {
    parts.push(
      labels?.turnsScored
        ? `<span class="sc-headscore" title="pass / fail / unsure over the three axes in force, on all ${labels.turnsScored} turns"><span class="sc-score-tag">labels</span> ${labels.verdict.pass}/${labels.verdict.fail}/${labels.verdict.unsure}</span>`
        : '<span class="sc-headscore sc-na"><span class="sc-score-tag">labels</span> not scored</span>',
    );
  }
  return `<div class="sc-head-scores">${parts.join('')}</div>`;
}

function scenarioSection(report, scenarioId, overlay) {
  const rows = report.results.filter((result) => result.scenarioId === scenarioId && result.dialogue);
  if (!rows.length) return '';
  const ordered = report.plan.arms.map((arm) => rows.find((row) => row.armId === arm.id) || null).filter(Boolean);
  const maxTurns = Math.max(...ordered.map((row) => row.dialogue.turnCount));
  const head = ordered
    .map((row) => {
      // Three-way, not two: an arm that never ran the closure lifecycle has no
      // verdict to report, and rendering it as "unresolved" would read as a
      // failure on a mechanism the arm does not carry.
      const closure = !row.dialogue.closure.available
        ? `<span class="sc-chip sc-chip--none" title="closure lifecycle bypassed on this arm">no closure verdict · ${escapeHtml(row.dialogue.stopReason)}</span>`
        : row.dialogue.closure.grounded
          ? `<span class="sc-chip sc-chip--pass">resolved at turn ${row.dialogue.closure.completedAtTurn}</span>`
          : `<span class="sc-chip sc-chip--none">unresolved · ${escapeHtml(row.dialogue.stopReason)}</span>`;
      const outcomes = row.dialogue.guardOutcomes;
      const repairChip = outcomes.repaired
        ? `<span class="sc-chip sc-chip--repair">${outcomes.repaired} repair(s)</span>`
        : '';
      const fallbackChip = outcomes.fallback
        ? `<span class="sc-chip sc-chip--fallback">${outcomes.fallback} fallback(s)</span>`
        : '';
      return `<div class="sc-column-head">
        <h3>${escapeHtml(row.armLabel)}</h3>
        <p class="sc-meta">${row.dialogue.turnCount} turns · ${row.dialogue.modelCalls} calls · ${seconds(row.wallClockMs)} · <code>${escapeHtml(row.provider)}.${escapeHtml(row.model)}</code></p>
        <div class="sc-card-foot">${closure}${repairChip}${fallbackChip}</div>
        ${scenarioHeadScores(overlay, scenarioId, row.armId)}
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
    const cells = ordered.map((row) => turnCell(row, index, overlay)).join('');
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

export function renderTutorStubShowcaseHtml(report, { overlay = null } = {}) {
  const scenarioIds = [...new Set(report.results.filter((row) => row.dialogue).map((row) => row.scenarioId))];
  const sections = scenarioIds.map((id) => scenarioSection(report, id, overlay)).join('');
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
  .sc-chip--fallback { background: var(--ms-brick); color: var(--ms-white); border-color: var(--ms-brick-dark); }
  .sc-chip--unsure { background: var(--ms-ochre); color: var(--ms-black); border-color: var(--ms-ochre); }
  .sc-chip--score { background: var(--ms-ink); color: var(--ms-white); border-color: var(--ms-ink); }
  .sc-na { color: var(--ms-text-muted); font-style: italic; }
  .sc-scores { border-top: 1px solid var(--ms-border-subtle); margin-top: 10px; padding-top: 8px; }
  .sc-score-row { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-bottom: 4px; }
  .sc-score-tag { font: 10px/1.8 var(--ms-font-mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--ms-text-muted); margin-right: 2px; }
  .sc-th-score { background: var(--ms-paper-2); }
  .sc-head-scores { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--ms-border-subtle); }
  .sc-headscore { font: 11px/1.5 var(--ms-font-mono); color: var(--ms-text); }
  body[data-sc-scores='off'] .sc-head-scores { display: none; }
  .sc-why { margin-top: 4px; }
  .sc-why summary { font: 10px/1.8 var(--ms-font-mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--ms-text-muted); cursor: pointer; }
  .sc-why p { font-size: 12px; line-height: 1.5; margin: 6px 0 0; color: var(--ms-text-muted); }
  .sc-why strong { color: var(--ms-text); }
  .sc-score-panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 18px; }
  .sc-score-panel { border: 1px solid var(--ms-border-subtle); padding: 12px 14px; background: var(--ms-paper-2); }
  .sc-withheld { margin: 6px 0 0; padding-left: 18px; }
  .sc-withheld li { margin-bottom: 4px; }
  body[data-sc-guards='off'] .sc-card-foot { display: none; }
  body[data-sc-scores='off'] .sc-scores { display: none; }
  @media (max-width: 960px) {
    .sc-columns { grid-template-columns: 1fr; }
    .sc-turn { grid-template-columns: 1fr; }
  }
</style>
</head>
<body data-sc-guards="on" data-sc-scores="on">
${renderMachineSpiritsHouseBackdrop()}
<div class="sc-wrap">
  <div class="sc-panel sc-masthead">
    <h1>Tutor instrumentation showcase</h1>
    <p class="sc-note">Two tutors, two free-running conversations with an automated learner, each run to its own end. The learner model, learner profile, world, and turn cap are identical on every arm; only the tutor-side machinery differs. Because each arm's learner is answering that arm's tutor, the transcripts diverge after the first exchange — read this as two demonstrations side by side, not as a controlled contrast.</p>
    <p class="sc-meta">status <code>${escapeHtml(report.status)}</code> · preset <code>${escapeHtml(report.plan.preset)}</code> · ${report.summary.completed}/${report.plan.plannedDialogues} dialogues · commit <code>${escapeHtml(report.metadata?.gitSha || 'unknown')}</code></p>
  </div>

  <div class="sc-panel">
    <div class="sc-controls"><label><input type="checkbox" id="sc-toggle-guards" checked /> show guard outcomes on every turn</label>${
      overlay
        ? '<label><input type="checkbox" id="sc-toggle-scores" checked /> show rubric labels on every turn</label>'
        : ''
    }</div>
  </div>

  <div class="sc-panel"><h2>Arms</h2><div class="sc-legend">${armLegend(report)}</div></div>

  <div class="sc-panel">
    <h2>Benchmark</h2>
    <p class="sc-note">"Guards run" is coverage, not merit — a tutor with no guards configured cannot fail one, so a low failure count on the bare arm mostly means nothing checked it. A repair is a first draft that failed its guards and was regenerated before the learner ever saw it.</p>
    ${benchmarkTable(report, overlay)}
  </div>

  ${scorePanel(overlay)}

  ${sections}

  <p class="sc-note sc-closing">These are demonstrations of system behaviour, not evidence about human learning. The learner is an LLM playing a role, the resolution verdict is the tutor stub's own closure lifecycle, and the two arms held nothing constant after the first exchange. For a comparison that does hold the dialogue fixed, see the frozen instrumentation A/B.</p>
</div>
<script>
  (function () {
    document.getElementById('sc-toggle-guards').addEventListener('change', function (event) {
      document.body.dataset.scGuards = event.target.checked ? 'on' : 'off';
    });
    var scores = document.getElementById('sc-toggle-scores');
    if (scores) {
      scores.addEventListener('change', function (event) {
        document.body.dataset.scScores = event.target.checked ? 'on' : 'off';
      });
    }
  })();
</script>
</body>
</html>`;
}

export function writeTutorStubShowcaseHtml({ report, outPath, overlay = null } = {}) {
  const target = path.resolve(outPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, renderTutorStubShowcaseHtml(report, { overlay }), 'utf8');
  return target;
}

/**
 * Re-render a run's `transcripts.html` against whatever score artefacts are now
 * beside it. Called by each scoring script on its way out, so the page picks up
 * a pass as soon as it lands and shows both instruments once both have run.
 *
 * Returns `null` when there is no page to refresh — a scoring pass pointed at a
 * report without a rendered transcript is not an error worth failing a paid run
 * over, and the caller reports it as a skip.
 */
export function refreshTutorStubShowcaseHtml({ report, runDir } = {}) {
  const target = path.join(runDir, 'transcripts.html');
  if (!fs.existsSync(target)) return null;
  const overlay = loadShowcaseScoreOverlay(runDir);
  return writeTutorStubShowcaseHtml({ report, outPath: target, overlay });
}
