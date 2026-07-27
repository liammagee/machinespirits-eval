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
import { radarUnavailableReason, renderShowcaseRadarSvg } from './tutorStubShowcaseRadar.js';
import { buildShowcaseRubricContrast, showcaseDimensionProfiles } from './tutorStubShowcaseRubricContrast.js';
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

/**
 * A table in its own horizontally-scrollable box.
 *
 * Wide tables are the one thing on this page that cannot be made to fit: a
 * per-dimension row has as many columns as the rubric has dimensions, and at
 * magnification — or on a phone — that is wider than the viewport whatever the
 * type size. Left alone the table pushes the whole document sideways, so every
 * paragraph on the page gets a horizontal scrollbar it does not need. Boxing each
 * table keeps the overflow local to the thing that overflows.
 */
function scrollTable(html) {
  return `<div class="sc-table-scroll" tabindex="0" role="group" aria-label="scrollable table">${html}</div>`;
}

/**
 * A stable, URL-safe anchor for a scenario section, so the nav can link to it and
 * a reader can send someone a link to one transcript rather than to the page.
 */
function scenarioAnchor(scenarioId) {
  return `sc-scenario-${String(scenarioId).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function formatR(value) {
  return Number.isFinite(value) ? value.toFixed(2) : '—';
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
  // The widest table on the page — eleven columns before any score column is
  // added — so it is the one that most needs its overflow kept to itself.
  const table = `<table class="sc-table">
    <thead><tr>
      <th>Arm</th><th class="sc-num">Resolved</th>${scoreHeads}<th class="sc-num">Turns</th><th class="sc-num">Calls</th>
      <th class="sc-num">Per turn</th><th class="sc-num">Tokens</th><th class="sc-num">Guard coverage</th>
      <th class="sc-num">Accepted</th><th class="sc-num">Repaired</th><th class="sc-num">Fallback</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
  return `${scrollTable(table)}
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
  // Which arm this cell belongs to, repeated on every cell.
  //
  // Side by side the column position carries that, so the label is hidden and
  // the grid reads as it always did. The moment the columns stack — because the
  // reader asked for it, or because the viewport is too narrow to hold two — the
  // position stops carrying anything and an unlabelled run of turns is just a
  // conversation with no indication of whose it is.
  const armTag = `<p class="sc-cell-arm">${escapeHtml(result?.armLabel || result?.armId || 'arm')}</p>`;
  if (!result?.dialogue) return `<div class="sc-cell sc-cell--absent">${armTag}<p class="sc-empty">—</p></div>`;
  const turn = result.dialogue.turns[index];
  if (!turn) {
    return `<div class="sc-cell sc-cell--absent">${armTag}<p class="sc-empty">this dialogue ended at turn ${result.dialogue.turnCount}</p></div>`;
  }
  return `<div class="sc-cell">
    ${armTag}
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
      ${scrollTable(`<table class="sc-table">
        <thead><tr><th>Arm</th><th class="sc-num">Turns</th>${axisIds.map((axisId) => `<th class="sc-num">${escapeHtml(axisId)}</th>`).join('')}<th class="sc-num">In force</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`)}
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
      ${scrollTable(`<table class="sc-table">
        <thead><tr><th>Arm</th><th class="sc-num">Scored</th><th class="sc-num">First</th><th class="sc-num">Last</th><th class="sc-num">All</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`)}
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
      ${scrollTable(`<table class="sc-table">
        <thead><tr><th>Arm</th><th class="sc-num">Scored</th><th class="sc-num">First</th><th class="sc-num">Last</th><th class="sc-num">All</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`)}
      <p class="sc-note"><strong>v3.0 is here as a contrast instrument, not as a second opinion on the arms.</strong>
      A v2.2 PCA found one dominant factor, so v3.0 stops decomposing and asks a judge for that factor directly: a
      single 1–10 <code>overall_pedagogical_quality</code> dimension (weight 0.85) beside 1–5
      <code>content_accuracy</code> (0.15), each normalised on its own scale before weighting. Content accuracy is
      dropped outright on a turn that makes no assessable factual claim and the remaining weight is renormalised, so
      two turns in this table can rest on different effective compositions.</p>
      <p class="sc-note"><strong>These numbers are not comparable with the v2.2 numbers above.</strong> Different
      dimensions, different scales, different aggregate. Nothing on this page averages one version with the other, and
      a v3.0 score belongs in a table beside a v2.2 score only as two separately labelled readings of the same turn.
      The useful question is not which arm each version prefers but where the two versions part company on the same
      turn, which is what <a href="#sc-contrast">Instrument contrast</a> below reports.</p>
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
 * Prose for the spread table, derived from the table rather than written beside
 * it. A hand-written reading is correct for the run it was written against and
 * quietly wrong for every run after, and this page is regenerated from whatever
 * artefacts are on disk.
 */
function discriminationReading(versions) {
  if (versions.length < 2) return '';
  const [a, b] = [...versions].sort((x, y) => (y.composite.sd ?? 0) - (x.composite.sd ?? 0));
  const wider = `v${escapeHtml(a.version)}`;
  const narrower = `v${escapeHtml(b.version)}`;
  // Resolution and spread are different properties and they can point opposite
  // ways: stretching the same ordering over a longer scale widens the spread
  // without distinguishing one further turn.
  const coarser = a.composite.distinct < b.composite.distinct;
  const equal = a.composite.distinct === b.composite.distinct;
  if (equal) {
    return (
      `${wider} spreads the same turns further apart than ${narrower} but resolves the same number of distinct ` +
      'verdicts, so the extra spread is scale, not discrimination.'
    );
  }
  if (coarser) {
    return (
      `${wider} spreads the turns further apart (sd ${a.composite.sd?.toFixed(1)} against ` +
      `${b.composite.sd?.toFixed(1)}) yet separates fewer of them — ${a.composite.distinct} distinct verdicts across ` +
      `${a.composite.n} turns against ${narrower}'s ${b.composite.distinct} across ${b.composite.n}. A wider spread ` +
      'on a longer scale is not a finer instrument: it is the same ordering stretched.'
    );
  }
  return (
    `${wider} both spreads the turns further apart and separates more of them ` +
    `(${a.composite.distinct} distinct verdicts against ${narrower}'s ${b.composite.distinct}).`
  );
}

/**
 * Per-dimension bars, for a version whose dimension count is below the radar's
 * floor. A two-dimension rubric still has a profile worth seeing; what it does
 * not have is a shape, and drawing one anyway would invite a comparison against
 * the eight-sided figure beside it that means nothing. Bars carry the same
 * information with no geometry to over-read: each track runs the dimension's own
 * declared floor to ceiling, so a 1-10 dimension and a 1-5 one are directly
 * comparable as fractions of their own range without being plotted as if they
 * shared a scale.
 */
function dimensionBars(profile) {
  const rows = profile.axes.map((axis, index) => {
    const bars = profile.series
      .map((entry) => {
        const value = entry.values[index];
        if (!Number.isFinite(value)) {
          return `<div class="sc-bar-row"><span class="sc-bar-arm">${escapeHtml(entry.label)}</span><span class="sc-na">not scored</span></div>`;
        }
        const span = axis.max - axis.min;
        const width = span > 0 ? Math.max(0, Math.min(1, (value - axis.min) / span)) * 100 : 0;
        return `<div class="sc-bar-row"><span class="sc-bar-arm">${escapeHtml(entry.label)}</span>
          <span class="sc-bar-track"><span class="sc-bar-fill" style="width: ${width.toFixed(1)}%; background: var(--${entry.tone})"></span></span>
          <span class="sc-bar-value">${value.toFixed(2)}</span></div>`;
      })
      .join('');
    return `<div class="sc-bar-group"><h5>${escapeHtml(axis.key)} <span class="sc-bar-scale">${axis.min}–${axis.max}</span></h5>${bars}</div>`;
  });
  return `<div class="sc-bars">${rows.join('')}</div>`;
}

/**
 * Radar plus legend for one rubric version, or the reason there isn't one.
 *
 * The chart is the only thing on the page that shows a rubric's dimensions
 * against each other rather than one at a time, which is exactly what the
 * composite hides: two arms can land four points apart overall while agreeing
 * exactly on most of the dimensions the composite is built from.
 */
function dimensionProfileBlock(overlay, version) {
  const profile = showcaseDimensionProfiles(overlay, { version });
  if (!profile) return '';
  const svg = renderShowcaseRadarSvg({
    axes: profile.axes,
    series: profile.series,
    title: `v${profile.version} dimension profile by arm`,
  });

  const legend = profile.series
    .map(
      (entry) =>
        `<span class="sc-radar-key"><span class="sc-radar-swatch" style="background: var(--${entry.tone})"></span>` +
        `${escapeHtml(entry.label)}${entry.baseline ? ' <em>(baseline)</em>' : ''} · ${entry.turns} turns</span>`,
    )
    .join('');

  // Axes on which every arm landed in the same place. Computed rather than
  // eyeballed off the chart: "the shapes look alike" is an impression, "five of
  // eight dimensions are identical" is a number, and it is the number that tells
  // a reader how much of the composite gap rests on how little.
  const flat = profile.axes.filter((_axis, index) => {
    const values = profile.series.map((entry) => entry.values[index]).filter((value) => Number.isFinite(value));
    return values.length === profile.series.length && new Set(values.map((value) => value.toFixed(2))).size === 1;
  });
  const movers = profile.axes
    .map((axis, index) => {
      const values = profile.series.map((entry) => entry.values[index]).filter((value) => Number.isFinite(value));
      if (values.length < 2) return null;
      return { key: axis.key, spread: Math.max(...values) - Math.min(...values) };
    })
    .filter(Boolean)
    .sort((x, y) => y.spread - x.spread);

  const shapeNote =
    profile.series.length > 1 && flat.length
      ? `<p class="sc-note"><strong>${flat.length} of the ${profile.axes.length} dimensions land on the same mean for
        every arm.</strong> The arms differ most on <code>${escapeHtml(movers[0].key)}</code>
        (${movers[0].spread.toFixed(2)} apart on a ${profile.axes[0].min}–${profile.axes[0].max} scale). Whatever gap
        the composite reports is carried by a minority of the dimensions it averages.</p>`
      : '';

  const scaleNote = profile.scalesDeclared
    ? ''
    : `<p class="sc-note">Each dimension is drawn from its own floor to its own ceiling, so dimensions on different
      scales are comparable as fractions of their range rather than plotted as if they shared one. This artefact
      predates the scorer recording its declared scales, so each range was inferred from the scores — a dimension with
      any value above 5 is read as 1–10, everything else as 1–5. Artefacts scored from now on carry the declared range
      instead.</p>`;

  return `<div class="sc-profile">
    <h4>v${escapeHtml(profile.version)} — ${profile.axes.length} dimensions</h4>
    ${
      svg
        ? `<div class="sc-radar-frame">${svg}</div><div class="sc-radar-legend">${legend}</div>`
        : `<p class="sc-note sc-na">${escapeHtml(radarUnavailableReason(profile.axes.length))}</p>${dimensionBars(profile)}`
    }
    ${shapeNote}
    ${scaleNote}
  </div>`;
}

/**
 * The instrument-contrast panel: which rubric separates these turns, how much
 * each one repeats itself, where the two disagree, and what neither of them
 * measures.
 *
 * This exists because the scoring panel above answers "may I pool these
 * versions?" (no) and leaves the reader with the question they actually have
 * next, which is whether the newer instrument is better. Nothing here is a claim
 * about rubric quality in general: it is a description of how the two behaved on
 * this run's turns, at this run's n, and the panel says so before the first
 * number.
 */
function rubricContrastPanel(overlay) {
  const contrast = buildShowcaseRubricContrast(overlay);
  if (!contrast) return '';

  const spreadRows = contrast.versions
    .map(
      (version) => `<tr><td>v${escapeHtml(version.version)}</td>
        <td class="sc-num">${version.dimensionCount}</td>
        <td class="sc-num">${version.composite.n}</td>
        <td class="sc-num">${formatScore(version.composite.sd)}</td>
        <td class="sc-num">${formatScore(version.composite.min)}–${formatScore(version.composite.max)}</td>
        <td class="sc-num">${version.composite.distinct}</td></tr>`,
    )
    .join('');

  const redundancyRows = contrast.versions
    .filter((version) => version.redundancy)
    .map(
      (version) => `<tr><td>v${escapeHtml(version.version)}</td>
        <td class="sc-num">${version.redundancy.pairs}</td>
        <td class="sc-num">${formatR(version.redundancy.meanAbsR)}</td>
        <td class="sc-num">${version.redundancy.strongPairs}</td>
        <td><code>${escapeHtml(version.redundancy.strongest.a)}</code> ~ <code>${escapeHtml(version.redundancy.strongest.b)}</code> ${formatR(version.redundancy.strongest.r)}</td>
        <td><code>${escapeHtml(version.redundancy.weakest.a)}</code> ~ <code>${escapeHtml(version.redundancy.weakest.b)}</code> ${formatR(version.redundancy.weakest.r)}</td></tr>`,
    )
    .join('');

  const redundancyBlock = redundancyRows
    ? `<h3>How much does a version repeat itself?</h3>
      <p class="sc-note">Correlation between every pair of a version's own dimensions, across the scored turns. This is
      the empirical claim the v3.0 redesign rests on — that v2.2's dimensions are largely one judgment scored eight
      times — so it is reported from this run's data rather than cited from the redesign's own rationale.</p>
      ${scrollTable(`<table class="sc-table">
        <thead><tr><th>Rubric</th><th class="sc-num">Pairs</th><th class="sc-num">Mean |r|</th><th class="sc-num">|r| ≥ 0.8</th><th>Most alike</th><th>Least alike</th></tr></thead>
        <tbody>${redundancyRows}</tbody>
      </table>`)}`
    : '';

  const agreement = contrast.agreement;
  const agreementBlock = agreement
    ? `<h3>Where the versions part company</h3>
      <p class="sc-note">Across the ${agreement.n} turns both versions scored, their composites correlate at
      <strong>r = ${formatR(agreement.r)}</strong>. That is a statement about <em>ordering only</em> — the scales
      differ, so the two numbers for one turn are never expected to match, and the difference between them is not an
      error on either side. The turns below are where the two instruments disagree most about the same tutor move, and
      they are worth reading rather than averaging.</p>
      ${scrollTable(`<table class="sc-table">
        <thead><tr><th>Dialogue</th><th>Turn</th><th class="sc-num">v2.2</th><th class="sc-num">v3.0</th><th class="sc-num">Gap</th></tr></thead>
        <tbody>${agreement.divergences
          .slice(0, 4)
          .map(
            (row) => `<tr${row.baseline ? ' class="sc-baseline-row"' : ''}><td>${escapeHtml(row.dialogueId)}</td>
            <td>${escapeHtml(row.turnLabel)} (t${row.turnIndex})</td>
            <td class="sc-num">${formatScore(row.left)}</td>
            <td class="sc-num">${formatScore(row.right)}</td>
            <td class="sc-num">${row.gap > 0 ? '+' : ''}${formatScore(row.gap)}</td></tr>`,
          )
          .join('')}</tbody>
      </table>`)}
      <p class="sc-note">The gaps run one way. A turn that closes a dialogue with a correct conclusion loses points on
      several v2.2 dimensions at once — <code>elicitation_quality</code> and <code>productive_difficulty</code> both pay
      for leaving a question live — and because those dimensions move together the penalty compounds. v3.0 folds them
      into one judgment, so the same turn is marked down once. Neither reading is the right one; they are answers to
      different questions, and the split is the reason the two are kept apart.</p>`
    : '';

  const profiles = contrast.versions.map((version) => dimensionProfileBlock(overlay, version.version)).join('');

  return `<div class="sc-panel" id="sc-contrast">
    <h2>Instrument contrast</h2>
    <p class="sc-note">The panel above keeps the rubric versions apart. This one asks what each of them is actually
    doing to these turns: how far apart it pushes them, how many distinct verdicts it can express, how much its own
    dimensions repeat each other, and where the two versions read the same tutor move differently.</p>
    ${contrast.sampleWarning ? `<p class="sc-note sc-caveat"><strong>Small sample.</strong> ${escapeHtml(contrast.sampleWarning)}</p>` : ''}

    <h3>Which instrument separates the turns?</h3>
    ${scrollTable(`<table class="sc-table">
      <thead><tr><th>Rubric</th><th class="sc-num">Dimensions</th><th class="sc-num">Turns</th><th class="sc-num">Spread (sd)</th><th class="sc-num">Range</th><th class="sc-num">Distinct verdicts</th></tr></thead>
      <tbody>${spreadRows}</tbody>
    </table>`)}
    <p class="sc-note">${discriminationReading(contrast.versions)}</p>
    ${redundancyBlock}
    ${agreementBlock}

    <h3>Dimension profile</h3>
    <p class="sc-note">Each arm's mean score on every dimension of a version, on one chart. Read the <em>shape</em>,
    not the area: a radar's enclosed area changes when the dimensions are reordered, so a bigger shape is not a better
    tutor. What the chart is for is the thing the composite hides — which axes move together, and which one moves
    alone.</p>
    <div class="sc-profiles">${profiles}</div>

    <h3>What none of this measures</h3>
    <p class="sc-note"><strong>Every number on this page is scored one turn at a time.</strong> Whether the dialogue as
    a whole holds together — whether it has a shape, whether anything reverses, whether the close is earned rather than
    merely reached — is a different unit of analysis and no per-turn rubric can reach it. This repo does carry a
    whole-transcript instrument: <code>config/evaluation-rubric-poetics.yaml</code> takes the dialogue as a miniature
    plot and scores six Aristotelian dimensions over it, with an evidence gate that clamps any high score lacking a
    verbatim quote.</p>
    <p class="sc-note">It is deliberately not shown here. That instrument was validated on canonical literary drama and
    then tested for transfer to tutor–learner transcripts against independent human labels. It failed: weighted κ ≈ 0.04
    against a pre-registered bar of 0.60, by over-attributing recognition to turns that merely use recognition
    vocabulary. An instrument that has failed its transfer gate on exactly this kind of material would add a number to
    this page without adding a measurement, and the pre-registered failure is the more useful thing to report.</p>
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
        <p class="sc-cell-arm">${escapeHtml(row.armLabel)}</p>
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

  return `<section class="sc-scenario" id="${scenarioAnchor(scenarioId)}">
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

/**
 * The jump menu. Every anchor it offers is generated from something that is
 * actually on the page — a scenario link is derived from the same id the section
 * is rendered with, and the scoring links appear only when there is an overlay to
 * link to — so the menu cannot promise a section the page does not have.
 */
function pageNav(report, scenarioIds, overlay) {
  const analysis = [
    { href: '#sc-arms', label: 'Arms' },
    { href: '#sc-benchmark', label: 'Benchmark' },
    ...(overlay
      ? [
          { href: '#sc-scoring', label: 'Rubric scoring' },
          { href: '#sc-contrast', label: 'Instrument contrast' },
        ]
      : []),
  ];
  const scenarios = scenarioIds.map((id) => ({
    href: `#${scenarioAnchor(id)}`,
    label: report.results.find((row) => row.scenarioId === id)?.scenarioLabel || id,
  }));
  const link = (entry) => `<a class="sc-nav-link" href="${escapeHtml(entry.href)}">${escapeHtml(entry.label)}</a>`;
  return `<nav class="sc-nav" aria-label="page sections">
    <div class="sc-nav-inner">
      <a class="sc-nav-home" href="#sc-top">Showcase</a>
      <div class="sc-nav-group">
        <span class="sc-nav-label">Analysis</span>${analysis.map(link).join('')}
      </div>
      <div class="sc-nav-group">
        <span class="sc-nav-label">Transcripts</span>${scenarios.map(link).join('')}
      </div>
      <div class="sc-nav-tools">
        <button type="button" class="sc-nav-button" id="sc-toggle-text" aria-pressed="false"
          title="step the whole page up one type size, and back">Larger text</button>
        <button type="button" class="sc-nav-button" id="sc-toggle-stack" aria-pressed="false"
          title="stack the arms one above the other instead of side by side">Stack arms</button>
      </div>
    </div>
  </nav>`;
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
  /*
   * Every size on this page is in rem, and the root font size is a percentage of
   * whatever the reader's browser is set to rather than a pinned pixel count. So
   * a reader who has raised their default type size, or who zooms, gets a page
   * that grows as one piece — type, padding, gutters, chart — instead of larger
   * text inside boxes that stayed the same. The --sc-scale variable is the
   * "Larger text" control in the nav, applied at the root so it reaches
   * everything below it. (No backticks anywhere in this block: the whole page is
   * one template literal, and a backtick in a CSS comment ends it.)
   */
  :root { --sc-scale: 1; }
  html[data-sc-text='large'] { --sc-scale: 1.15; }
  html[data-sc-text='larger'] { --sc-scale: 1.32; }
  html { font-size: calc(100% * var(--sc-scale)); scroll-behavior: smooth; }
  body { margin: 0; font-family: var(--ms-font-reading); color: var(--ms-text); }
  .sc-wrap { position: relative; z-index: 1; max-width: 96rem; margin: 0 auto; padding: 1.5rem 1.25rem 6rem; }
  h1 { font-family: var(--ms-font-sans); font-size: 1.75rem; line-height: 1.2; margin: 0 0 0.25rem; }
  h2 { font-family: var(--ms-font-sans); font-size: 1.3rem; line-height: 1.25; margin: 0 0 0.25rem; }
  h3 { font-family: var(--ms-font-sans); font-size: 1.05rem; line-height: 1.3; margin: 1.1rem 0 0.4rem; }
  h4 { font-family: var(--ms-font-sans); font-size: 0.95rem; line-height: 1.3; margin: 0 0 0.5rem; }
  .sc-panel > h2:first-child, .sc-scenario-head h2 { margin-top: 0; }
  .sc-note, .sc-meta { color: var(--ms-text-muted); font-size: 0.875rem; line-height: 1.55; margin: 0 0 0.35rem; }
  /* A measure, not a full-width line. Prose set across a 1500px panel is the
   * single biggest reason this page was hard to read before magnification came
   * into it at all. */
  .sc-note { max-width: 82ch; }
  .sc-meta code, .sc-note code { font-family: var(--ms-font-mono); font-size: 0.8rem; }
  .sc-caveat { border-left: 3px solid var(--ms-ochre); padding-left: 0.7rem; }
  .sc-panel { background: var(--ms-surface); border: 1px solid var(--ms-border); padding: 1rem 1.15rem; margin: 0 0 1.5rem; scroll-margin-top: 5.5rem; }
  .sc-masthead { padding: 1.25rem 1.15rem 1rem; }
  .sc-closing { background: var(--ms-surface); border: 1px solid var(--ms-border); padding: 0.9rem 1.15rem; }
  /* Wide tables scroll inside their own box so the page body never does. */
  .sc-table-scroll { overflow-x: auto; margin: 0 0 0.5rem; }
  .sc-table-scroll:focus-visible { outline: 2px solid var(--ms-ochre); outline-offset: 2px; }
  .sc-table { width: 100%; min-width: 32rem; border-collapse: collapse; font-size: 0.875rem; font-family: var(--ms-font-sans); }
  .sc-table th, .sc-table td { border-bottom: 1px solid var(--ms-border-subtle); padding: 0.4rem 0.5rem; text-align: left; }
  .sc-table th { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ms-text-muted); }
  .sc-num { text-align: right; font-family: var(--ms-font-mono); white-space: nowrap; }
  .sc-baseline-row td { background: var(--ms-paper-2); }
  .sc-legend { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr)); gap: 1rem; }
  .sc-pills { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.4rem; }
  .sc-pill { font: 0.75rem/1.7 var(--ms-font-mono); background: var(--ms-paper-3); border: 1px solid var(--ms-border-subtle); padding: 0 0.4rem; }
  .sc-pill--off { background: transparent; color: var(--ms-text-muted); font-style: italic; }
  .sc-tag { font: 0.68rem/1.6 var(--ms-font-mono); text-transform: uppercase; letter-spacing: 0.08em; border: 1px solid var(--ms-border); padding: 0 0.25rem; }
  .sc-scenario { margin: 0 0 3rem; scroll-margin-top: 5.5rem; }
  .sc-scenario-head { background: var(--ms-surface); border: 1px solid var(--ms-border); padding: 0.9rem 1.15rem; margin: 0 0 1rem; }
  .sc-turn { display: grid; grid-template-columns: 2.75rem minmax(0, 1fr); gap: 0.75rem; align-items: start; border-top: 1px solid var(--ms-border-subtle); padding: 0.9rem 0; }
  .sc-turn--head { border-top: none; padding-top: 0; }
  .sc-turn-gutter { display: flex; justify-content: center; padding-top: 0.25rem; }
  .sc-turn-badge { display: block; width: 2.1rem; height: 2.1rem; background: var(--ms-ink); color: var(--ms-white); font: 700 0.75rem/2.1rem var(--ms-font-mono); text-align: center; }
  .sc-turn-badge--open { background: var(--ms-ochre); }
  .sc-columns { display: grid; grid-template-columns: repeat(var(--sc-column-count), minmax(0, 1fr)); gap: 0.9rem; }
  .sc-column-head { background: var(--ms-surface); border: 1px solid var(--ms-border); padding: 0.75rem 0.9rem; }
  .sc-cell { display: flex; flex-direction: column; gap: 0.5rem; }
  .sc-cell--absent { justify-content: center; }
  /* Shown only once the columns stack — see the stacking rules at the foot. */
  .sc-cell-arm { display: none; font: 700 0.72rem/1.6 var(--ms-font-mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--ms-text-muted); margin: 0; }
  .sc-bubble { background: var(--ms-surface-elevated); border: 1px solid var(--ms-border); padding: 0.75rem 0.9rem; box-sizing: border-box; }
  .sc-bubble--learner { background: var(--ms-paper-2); border-left: 3px solid var(--ms-ochre); }
  .sc-bubble--tutor { border-left: 3px solid var(--ms-border); }
  .sc-card-head { display: flex; justify-content: space-between; gap: 0.5rem; font: 0.72rem/1.6 var(--ms-font-mono); color: var(--ms-text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
  .sc-arm-name { color: var(--ms-text); font-weight: 700; }
  .sc-speech { font-size: 0.95rem; line-height: 1.65; white-space: pre-wrap; overflow-wrap: anywhere; }
  .sc-empty { color: var(--ms-text-muted); font-size: 0.875rem; font-style: italic; margin: 0; }
  .sc-card-foot { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.6rem; }
  .sc-chip { font: 0.7rem/1.8 var(--ms-font-mono); text-transform: uppercase; letter-spacing: 0.05em; padding: 0 0.4rem; border: 1px solid var(--ms-border); }
  .sc-chip--pass { background: var(--ms-moss); color: var(--ms-white); border-color: var(--ms-moss-deep); }
  .sc-chip--fail { background: var(--ms-red); color: var(--ms-white); border-color: var(--ms-red-dark); }
  .sc-chip--repair { background: var(--ms-ochre); color: var(--ms-black); border-color: var(--ms-ochre); }
  .sc-chip--closed { background: var(--ms-ink); color: var(--ms-white); border-color: var(--ms-ink); }
  .sc-chip--none { background: var(--ms-paper-3); color: var(--ms-text-muted); }
  .sc-chip--fallback { background: var(--ms-brick); color: var(--ms-white); border-color: var(--ms-brick-dark); }
  .sc-chip--unsure { background: var(--ms-ochre); color: var(--ms-black); border-color: var(--ms-ochre); }
  .sc-chip--score { background: var(--ms-ink); color: var(--ms-white); border-color: var(--ms-ink); }
  .sc-na { color: var(--ms-text-muted); font-style: italic; }
  .sc-scores { border-top: 1px solid var(--ms-border-subtle); margin-top: 0.6rem; padding-top: 0.5rem; }
  .sc-score-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem; margin-bottom: 0.25rem; }
  .sc-score-tag { font: 0.7rem/1.8 var(--ms-font-mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--ms-text-muted); margin-right: 0.15rem; }
  .sc-th-score { background: var(--ms-paper-2); }
  .sc-head-scores { display: flex; flex-wrap: wrap; gap: 0.25rem 0.9rem; margin-top: 0.4rem; padding-top: 0.4rem; border-top: 1px solid var(--ms-border-subtle); }
  .sc-headscore { font: 0.78rem/1.5 var(--ms-font-mono); color: var(--ms-text); }
  body[data-sc-scores='off'] .sc-head-scores { display: none; }
  .sc-why { margin-top: 0.25rem; }
  .sc-why summary { font: 0.7rem/1.8 var(--ms-font-mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--ms-text-muted); cursor: pointer; }
  .sc-why p { font-size: 0.82rem; line-height: 1.55; margin: 0.4rem 0 0; color: var(--ms-text-muted); }
  .sc-why strong { color: var(--ms-text); }
  .sc-score-panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 24rem), 1fr)); gap: 1.1rem; }
  .sc-score-panel { border: 1px solid var(--ms-border-subtle); padding: 0.75rem 0.9rem; background: var(--ms-paper-2); }
  .sc-withheld { margin: 0.4rem 0 0; padding-left: 1.1rem; }
  .sc-withheld li { margin-bottom: 0.25rem; }
  body[data-sc-guards='off'] .sc-card-foot { display: none; }
  body[data-sc-scores='off'] .sc-scores { display: none; }

  /* ── jump menu ─────────────────────────────────────────────────────────── */
  .sc-nav { position: sticky; top: 0; z-index: 20; background: var(--ms-surface); border-bottom: 1px solid var(--ms-border); }
  .sc-nav-inner { display: flex; align-items: center; gap: 0.5rem 1rem; flex-wrap: wrap; max-width: 96rem; margin: 0 auto; padding: 0.5rem 1.25rem; }
  .sc-nav-home { font: 700 0.8rem/1.6 var(--ms-font-sans); text-transform: uppercase; letter-spacing: 0.08em; color: var(--ms-text); text-decoration: none; }
  .sc-nav-group { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; min-width: 0; }
  .sc-nav-label { font: 0.66rem/1.6 var(--ms-font-mono); text-transform: uppercase; letter-spacing: 0.08em; color: var(--ms-text-muted); }
  .sc-nav-link { font: 0.78rem/1.6 var(--ms-font-sans); color: var(--ms-text); text-decoration: none; border: 1px solid var(--ms-border-subtle); padding: 0.1rem 0.45rem; white-space: nowrap; }
  .sc-nav-link:hover, .sc-nav-link:focus-visible { border-color: var(--ms-ochre); }
  .sc-nav-link[aria-current='true'] { background: var(--ms-ink); color: var(--ms-white); border-color: var(--ms-ink); }
  .sc-nav-tools { display: flex; gap: 0.35rem; margin-left: auto; }
  .sc-nav-button { font: 0.75rem/1.6 var(--ms-font-sans); color: var(--ms-text); background: transparent; border: 1px solid var(--ms-border-subtle); padding: 0.1rem 0.45rem; cursor: pointer; white-space: nowrap; }
  .sc-nav-button[aria-pressed='true'] { background: var(--ms-ochre); border-color: var(--ms-ochre); color: var(--ms-black); }
  .sc-controls { display: flex; flex-wrap: wrap; gap: 0.5rem 1.25rem; font-size: 0.875rem; }

  /* ── dimension profiles ────────────────────────────────────────────────── */
  .sc-profiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 21rem), 1fr)); gap: 1.1rem; }
  .sc-profile { border: 1px solid var(--ms-border-subtle); background: var(--ms-paper-2); padding: 0.75rem 0.9rem; }
  .sc-radar-frame { display: flex; justify-content: center; }
  .sc-radar { width: 100%; max-width: 22rem; height: auto; }
  .sc-radar-axis { font: 0.62rem/1.2 var(--ms-font-mono); fill: var(--ms-text-muted); }
  .sc-radar-legend { display: flex; flex-wrap: wrap; gap: 0.25rem 0.9rem; margin: 0.4rem 0 0.5rem; font: 0.75rem/1.7 var(--ms-font-mono); color: var(--ms-text-muted); }
  .sc-radar-key { display: inline-flex; align-items: center; gap: 0.35rem; }
  .sc-radar-swatch { display: inline-block; width: 0.7rem; height: 0.7rem; border: 1px solid var(--ms-border); }
  .sc-bars { margin-top: 0.5rem; }
  .sc-bar-group { margin-bottom: 0.8rem; }
  .sc-bar-group h5 { font: 700 0.78rem/1.6 var(--ms-font-mono); margin: 0 0 0.25rem; color: var(--ms-text); }
  .sc-bar-scale { font-weight: 400; color: var(--ms-text-muted); }
  .sc-bar-row { display: grid; grid-template-columns: 7rem 1fr 3rem; align-items: center; gap: 0.5rem; margin-bottom: 0.2rem; font: 0.75rem/1.7 var(--ms-font-mono); }
  .sc-bar-arm { color: var(--ms-text-muted); overflow-wrap: anywhere; }
  .sc-bar-track { height: 0.6rem; background: var(--ms-paper); border: 1px solid var(--ms-border-subtle); }
  .sc-bar-fill { display: block; height: 100%; }
  .sc-bar-value { text-align: right; color: var(--ms-text); }

  /*
   * Stacking, from two directions. The reader can ask for it with the nav
   * button at any width, and it happens on its own once the viewport can no
   * longer hold two readable columns. Browser zoom shrinks the CSS viewport, so
   * the media query is what catches a reader who magnified rather than clicked.
   * The breakpoint sits well above the old 960px: two 480px columns of
   * transcript is technically side by side and not actually readable.
   */
  body[data-sc-stack='on'] .sc-columns { grid-template-columns: 1fr; }
  body[data-sc-stack='on'] .sc-cell-arm { display: block; }
  @media (max-width: 1180px) {
    .sc-columns { grid-template-columns: 1fr; }
    .sc-cell-arm { display: block; }
  }
  @media (max-width: 720px) {
    .sc-wrap { padding: 1rem 0.75rem 4rem; }
    .sc-turn { grid-template-columns: 1fr; }
    .sc-nav-inner { padding: 0.5rem 0.75rem; }
    .sc-nav-tools { margin-left: 0; }
  }
  @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
</style>
</head>
<body data-sc-guards="on" data-sc-scores="on" data-sc-stack="off">
${renderMachineSpiritsHouseBackdrop()}
${pageNav(report, scenarioIds, overlay)}
<div class="sc-wrap">
  <div class="sc-panel sc-masthead" id="sc-top">
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

  <div class="sc-panel" id="sc-arms"><h2>Arms</h2><div class="sc-legend">${armLegend(report)}</div></div>

  <div class="sc-panel" id="sc-benchmark">
    <h2>Benchmark</h2>
    <p class="sc-note">"Guards run" is coverage, not merit — a tutor with no guards configured cannot fail one, so a low failure count on the bare arm mostly means nothing checked it. A repair is a first draft that failed its guards and was regenerated before the learner ever saw it.</p>
    ${benchmarkTable(report, overlay)}
  </div>

  ${scorePanel(overlay)}

  ${rubricContrastPanel(overlay)}

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

    /*
     * Type size cycles through three steps rather than toggling two, because the
     * reader who needs this needs a range: one step for a long read, two for
     * someone who would otherwise reach for browser zoom. The value lands on
     * <html> and drives the root font size, so every rem on the page follows it
     * together. Browser zoom still works and composes with this.
     */
    var textSteps = ['', 'large', 'larger'];
    var textLabels = ['Larger text', 'Larger text · 1', 'Larger text · 2'];
    var textStep = 0;
    var text = document.getElementById('sc-toggle-text');
    text.addEventListener('click', function () {
      textStep = (textStep + 1) % textSteps.length;
      if (textSteps[textStep]) document.documentElement.dataset.scText = textSteps[textStep];
      else delete document.documentElement.dataset.scText;
      text.textContent = textLabels[textStep];
      text.setAttribute('aria-pressed', textStep === 0 ? 'false' : 'true');
    });

    var stack = document.getElementById('sc-toggle-stack');
    stack.addEventListener('click', function () {
      var on = document.body.dataset.scStack !== 'on';
      document.body.dataset.scStack = on ? 'on' : 'off';
      stack.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    /*
     * Mark the section being read in the jump menu. Guarded on
     * IntersectionObserver so an older browser loses the highlight and keeps a
     * working menu. rootMargin pins the "current" band just under the sticky bar
     * rather than at the viewport middle, so the highlight changes when a heading
     * reaches the top — which is where the reader is looking.
     */
    if (window.IntersectionObserver) {
      var links = {};
      var nav = document.querySelectorAll('.sc-nav-link');
      for (var i = 0; i < nav.length; i += 1) links[nav[i].getAttribute('href').slice(1)] = nav[i];
      var targets = [];
      for (var id in links) {
        var node = document.getElementById(id);
        if (node) targets.push(node);
      }
      var visible = {};
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            visible[entry.target.id] = entry.isIntersecting;
          });
          var current = null;
          targets.forEach(function (target) {
            if (!current && visible[target.id]) current = target.id;
          });
          for (var key in links) links[key].setAttribute('aria-current', key === current ? 'true' : 'false');
        },
        // px, not rem: rootMargin rejects rem outright, so this is one place the
        // page cannot follow --sc-scale. 72px clears the bar at every step.
        { rootMargin: '-72px 0px -70% 0px' },
      );
      targets.forEach(function (target) {
        observer.observe(target);
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
