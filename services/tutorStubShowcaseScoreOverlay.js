/**
 * Score overlay for the showcase transcript page.
 *
 * Scoring is a later pass than rendering: `transcripts.html` is written when the
 * run finishes, and `rubric-v2.2.json` / `rubric-pr-benchmark-1.0.json` land
 * beside it whenever someone pays for a judge. So the overlay is built from
 * whichever artefacts exist at render time, and a page with no artefacts renders
 * exactly as it did before there was any scoring at all.
 *
 * Two instruments, never merged. The v2.2 tutor rubric scores a single turn 0–100
 * across eight dimensions; the PR-benchmark rubric labels a turn pass/fail/unsure
 * on the three of its seven axes that transfer to a free-running dialogue. There
 * is no defensible way to average them, so they stay in separate groups with
 * separate names, and the PR-benchmark composite keeps the name
 * `transferableVerdict` it was given rather than borrowing `overall_delivery`.
 *
 * Three absences are distinguished, because collapsing them is how a scoring
 * surface starts lying:
 *
 *   not asked   — the axis was withheld (no case criterion, no authored contract).
 *                 Four of seven PR-benchmark axes are permanently in this state.
 *   not scored  — the instrument was run but not on this turn. v2.2 defaults to
 *                 first and last only, so most turns have no v2.2 row.
 *   failed      — the judge was asked and could not produce a verdict.
 *
 * A blank cell means one of those three, and the page has to say which.
 */

import fs from 'node:fs';
import path from 'node:path';

export const TUTOR_STUB_SHOWCASE_OVERLAY_SCHEMA = 'machinespirits.tutor-stub.showcase-score-overlay.v1';

/**
 * One slot per artefact filename. v3.0 gets its own slot rather than sharing a
 * generic "tutor rubric" one, because a shared slot would show whichever version
 * happened to be scored last under a single heading — the mixing v3.0's own
 * header forbids. A separate slot forces the page to name the version.
 */
export const SHOWCASE_OVERLAY_ARTIFACTS = Object.freeze({
  prBenchmark: 'rubric-pr-benchmark-1.0.json',
  tutorV22: 'rubric-v2.2.json',
  tutorV30: 'rubric-v3.0.json',
});

function turnKey(dialogueId, turnIndex) {
  return `${dialogueId}#${turnIndex}`;
}

function indexRows(rows) {
  const byTurn = {};
  for (const row of rows || []) {
    if (!row?.dialogueId || !Number.isFinite(row.turnIndex)) continue;
    byTurn[turnKey(row.dialogueId, row.turnIndex)] = row;
  }
  return byTurn;
}

/**
 * Tutor-rubric side, shared by every rubric version. The versions differ in what
 * they ask a judge, not in the shape of a scored turn, so one reader serves them
 * all and a further version costs a filename rather than a parallel code path.
 *
 * `turns` is the scoring script's own selector ("first-last" by default). The
 * page needs it to explain why turn 5 has no score.
 */
function tutorRubricSide(payload) {
  if (!payload) return null;
  return {
    rubricVersion: payload.rubricVersion || null,
    judge: payload.judge || null,
    turnsScored: payload.turns || null,
    limitation: payload.limitation || null,
    byTurn: indexRows(payload.rows),
  };
}

/**
 * Build the overlay from already-parsed artefact payloads. Pure: no fs, no
 * paths. Any side may be absent, and an overlay with none is `null` so the
 * renderer can fall through to its unscored shape rather than drawing an empty
 * scoring panel.
 */
export function buildShowcaseScoreOverlay({ prBenchmark = null, tutorV22 = null, tutorV30 = null } = {}) {
  if (!prBenchmark && !tutorV22 && !tutorV30) return null;
  const overlay = {
    schema: TUTOR_STUB_SHOWCASE_OVERLAY_SCHEMA,
    prBenchmark: null,
    tutorV22: null,
    tutorV30: null,
  };

  if (prBenchmark) {
    overlay.prBenchmark = {
      rubricId: prBenchmark.rubric?.id || 'tutor-pr-benchmark-turn-rubric',
      rubricVersion: prBenchmark.rubric?.version || null,
      judge: prBenchmark.judge || null,
      // Carried so the page can name the withheld axes on the page itself. A
      // reader who only sees three green chips would otherwise reasonably
      // assume three axes is all the instrument has.
      axesAsked: prBenchmark.axesAsked || [],
      axesUnavailable: prBenchmark.axesUnavailable || [],
      axisIds: (prBenchmark.axesAsked || []).map((entry) => entry.axisId),
      limitations: prBenchmark.limitations || [],
      summary: prBenchmark.summary || [],
      byTurn: indexRows(prBenchmark.rows),
    };
  }

  overlay.tutorV22 = tutorRubricSide(tutorV22);
  overlay.tutorV30 = tutorRubricSide(tutorV30);

  return overlay;
}

/**
 * Read whichever score artefacts sit beside a run's `report.json`. Missing files
 * are not an error — the common case is a run that has been rendered but never
 * scored. A file that exists but does not parse IS an error: silently rendering
 * an unscored page over a corrupt artefact would hide the problem behind a page
 * that looks finished.
 */
export function readShowcaseScoreArtifacts(runDir) {
  const payloads = {};
  for (const [key, filename] of Object.entries(SHOWCASE_OVERLAY_ARTIFACTS)) {
    const target = path.join(runDir, filename);
    if (!fs.existsSync(target)) continue;
    try {
      payloads[key] = JSON.parse(fs.readFileSync(target, 'utf8'));
    } catch (error) {
      throw new Error(`showcase score artifact ${filename} is present but unreadable: ${error.message}`);
    }
  }
  return payloads;
}

export function loadShowcaseScoreOverlay(runDir) {
  return buildShowcaseScoreOverlay(readShowcaseScoreArtifacts(runDir));
}

/**
 * Both instruments for one turn. `null` on a side means that instrument has no
 * row for this turn, which the caller must render as "not scored" rather than as
 * a clean result.
 */
export function showcaseTurnScores(overlay, dialogueId, turnIndex) {
  if (!overlay) return { prBenchmark: null, tutorV22: null, tutorV30: null };
  const key = turnKey(dialogueId, turnIndex);
  return {
    prBenchmark: overlay.prBenchmark?.byTurn[key] || null,
    tutorV22: overlay.tutorV22?.byTurn[key] || null,
    tutorV30: overlay.tutorV30?.byTurn[key] || null,
  };
}

/**
 * Rows for one instrument, optionally narrowed to a single scenario. The same
 * accessor serves the whole-run tables and the per-scenario column heads, so a
 * scenario's numbers are the run's numbers restricted, never a second
 * calculation that could disagree with the first.
 */
function instrumentRows(side, { scenarioId = null } = {}) {
  const rows = Object.values(side?.byTurn || {});
  return scenarioId ? rows.filter((row) => row.scenarioId === scenarioId) : rows;
}

/**
 * Per-arm means for one tutor-rubric version, computed here rather than read
 * from the artefact so the page and the markdown report cannot drift apart.
 * `null` where an arm has no scored turn of that kind — not 0, which would plot
 * as a catastrophic score.
 *
 * Versions are averaged separately and never pooled: v2.2 and v3.0 put a turn on
 * different scales with different dimensions, so a mean across both would be a
 * number with no instrument behind it.
 */
function tutorArmMeans(side, options = {}) {
  if (!side) return [];
  const byArm = new Map();
  for (const row of instrumentRows(side, options)) {
    if (!row.success || !Number.isFinite(row.overallScore)) continue;
    if (!byArm.has(row.armId)) byArm.set(row.armId, []);
    byArm.get(row.armId).push(row);
  }
  const mean = (rows) => (rows.length ? rows.reduce((sum, row) => sum + row.overallScore, 0) / rows.length : null);
  return [...byArm.entries()].map(([armId, rows]) => ({
    armId,
    baseline: Boolean(rows[0]?.baseline),
    first: mean(rows.filter((row) => row.turnLabel === 'first')),
    last: mean(rows.filter((row) => row.turnLabel === 'last')),
    all: mean(rows),
    scored: rows.length,
  }));
}

export function showcaseV22ArmMeans(overlay, options = {}) {
  return tutorArmMeans(overlay?.tutorV22, options);
}

export function showcaseV30ArmMeans(overlay, options = {}) {
  return tutorArmMeans(overlay?.tutorV30, options);
}

/**
 * Per-arm PR-benchmark label counts, derived from the turn rows for the same
 * reason as the v2.2 means: the artefact ships its own `summary`, but reading
 * one number off the artefact and computing the neighbouring one would let the
 * two disagree after any change to either.
 *
 * `turnsFailed` is kept separate from the label counts. A turn the judge could
 * not label is not an unsure verdict — unsure is something the judge decided.
 */
export function showcaseLabelArmCounts(overlay, options = {}) {
  if (!overlay?.prBenchmark) return [];
  const axisIds = overlay.prBenchmark.axisIds;
  const byArm = new Map();
  for (const row of instrumentRows(overlay.prBenchmark, options)) {
    if (!byArm.has(row.armId)) {
      byArm.set(row.armId, {
        armId: row.armId,
        baseline: Boolean(row.baseline),
        turnsScored: 0,
        turnsFailed: 0,
        axes: Object.fromEntries(axisIds.map((axisId) => [axisId, { pass: 0, fail: 0, unsure: 0 }])),
        verdict: { pass: 0, fail: 0, unsure: 0 },
      });
    }
    const arm = byArm.get(row.armId);
    if (!row.success) {
      arm.turnsFailed += 1;
      continue;
    }
    arm.turnsScored += 1;
    for (const axisId of axisIds) {
      const label = row.axes?.[axisId]?.label;
      if (label && arm.axes[axisId][label] !== undefined) arm.axes[axisId][label] += 1;
    }
    if (row.transferableVerdict && arm.verdict[row.transferableVerdict] !== undefined) {
      arm.verdict[row.transferableVerdict] += 1;
    }
  }
  return [...byArm.values()];
}
