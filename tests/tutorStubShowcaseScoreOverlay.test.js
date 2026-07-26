import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildShowcaseScoreOverlay,
  loadShowcaseScoreOverlay,
  readShowcaseScoreArtifacts,
  showcaseLabelArmCounts,
  showcaseTurnScores,
  showcaseV22ArmMeans,
  SHOWCASE_OVERLAY_ARTIFACTS,
  TUTOR_STUB_SHOWCASE_OVERLAY_SCHEMA,
} from '../services/tutorStubShowcaseScoreOverlay.js';

function labelRow(overrides = {}) {
  return {
    dialogueId: 'alpha__bare__m',
    scenarioId: 'alpha',
    armId: 'bare',
    baseline: true,
    turnIndex: 1,
    success: true,
    axes: {
      safety: { label: 'pass' },
      learner_uptake: { label: 'pass' },
      handoff: { label: 'pass' },
    },
    transferableVerdict: 'pass',
    ...overrides,
  };
}

function v22Row(overrides = {}) {
  return {
    dialogueId: 'alpha__bare__m',
    scenarioId: 'alpha',
    armId: 'bare',
    baseline: true,
    turnIndex: 1,
    turnLabel: 'first',
    success: true,
    overallScore: 60,
    ...overrides,
  };
}

const PR_BENCHMARK = {
  rubric: { id: 'tutor-pr-benchmark-turn-rubric', version: '1.0' },
  judge: 'claude-code.sonnet',
  axesAsked: [{ axisId: 'safety' }, { axisId: 'learner_uptake' }, { axisId: 'handoff' }],
  axesUnavailable: [{ axisId: 'overall_delivery', reason: 'no case criterion in a free-running dialogue' }],
  rows: [
    labelRow(),
    labelRow({ turnIndex: 2, axes: { safety: { label: 'pass' } }, transferableVerdict: 'fail' }),
    labelRow({ scenarioId: 'beta', dialogueId: 'beta__bare__m', turnIndex: 1, transferableVerdict: 'unsure' }),
    labelRow({ armId: 'instrumented', baseline: false, dialogueId: 'alpha__inst__m', turnIndex: 1 }),
    labelRow({ armId: 'instrumented', baseline: false, dialogueId: 'alpha__inst__m', turnIndex: 2, success: false }),
  ],
};

const TUTOR_V22 = {
  rubricVersion: '2.2',
  judge: 'claude-code.sonnet',
  turns: 'first-last',
  limitation: 'Free-running showcase.',
  rows: [
    v22Row(),
    v22Row({ turnIndex: 4, turnLabel: 'last', overallScore: 20 }),
    v22Row({ scenarioId: 'beta', dialogueId: 'beta__bare__m', turnIndex: 1, overallScore: 80 }),
    v22Row({ armId: 'instrumented', baseline: false, dialogueId: 'alpha__inst__m', overallScore: 40 }),
  ],
};

test('an overlay with neither artefact is null so the page renders unscored', () => {
  assert.equal(buildShowcaseScoreOverlay(), null);
  assert.equal(buildShowcaseScoreOverlay({}), null);
  assert.equal(buildShowcaseScoreOverlay({ prBenchmark: null, tutorV22: null }), null);
});

test('either instrument alone builds an overlay carrying only that side', () => {
  const labelsOnly = buildShowcaseScoreOverlay({ prBenchmark: PR_BENCHMARK });
  assert.equal(labelsOnly.schema, TUTOR_STUB_SHOWCASE_OVERLAY_SCHEMA);
  assert.equal(labelsOnly.tutorV22, null);
  assert.deepEqual(labelsOnly.prBenchmark.axisIds, ['safety', 'learner_uptake', 'handoff']);

  const scoresOnly = buildShowcaseScoreOverlay({ tutorV22: TUTOR_V22 });
  assert.equal(scoresOnly.prBenchmark, null);
  assert.equal(scoresOnly.tutorV22.turnsScored, 'first-last');
});

test('the withheld axes survive into the overlay so the page can name them', () => {
  const overlay = buildShowcaseScoreOverlay({ prBenchmark: PR_BENCHMARK });
  assert.equal(overlay.prBenchmark.axesUnavailable[0].axisId, 'overall_delivery');
  assert.match(overlay.prBenchmark.axesUnavailable[0].reason, /no case criterion/u);
});

test('turn lookup keys on dialogue and turn, and reports absence rather than a clean result', () => {
  const overlay = buildShowcaseScoreOverlay({ prBenchmark: PR_BENCHMARK, tutorV22: TUTOR_V22 });
  const scored = showcaseTurnScores(overlay, 'alpha__bare__m', 1);
  assert.equal(scored.prBenchmark.transferableVerdict, 'pass');
  assert.equal(scored.tutorV22.overallScore, 60);

  // turn 2 was labelled but never given a v2.2 score: "not scored", not zero.
  const partial = showcaseTurnScores(overlay, 'alpha__bare__m', 2);
  assert.equal(partial.prBenchmark.transferableVerdict, 'fail');
  assert.equal(partial.tutorV22, null);

  assert.deepEqual(showcaseTurnScores(overlay, 'nope', 1), { prBenchmark: null, tutorV22: null });
  assert.deepEqual(showcaseTurnScores(null, 'alpha__bare__m', 1), { prBenchmark: null, tutorV22: null });
});

test('rows without a dialogue id or a finite turn index are dropped rather than keyed to undefined', () => {
  const overlay = buildShowcaseScoreOverlay({
    prBenchmark: { ...PR_BENCHMARK, rows: [labelRow({ dialogueId: null }), labelRow({ turnIndex: null })] },
  });
  assert.deepEqual(Object.keys(overlay.prBenchmark.byTurn), []);
});

test('per-arm v2.2 means split first from last and report null, not zero, where nothing was scored', () => {
  const overlay = buildShowcaseScoreOverlay({ tutorV22: TUTOR_V22 });
  const means = showcaseV22ArmMeans(overlay);
  const bare = means.find((arm) => arm.armId === 'bare');
  assert.equal(bare.scored, 3);
  assert.equal(bare.first, 70); // 60 and 80
  assert.equal(bare.last, 20);
  assert.equal(bare.baseline, true);

  const instrumented = means.find((arm) => arm.armId === 'instrumented');
  assert.equal(instrumented.first, 40);
  assert.equal(instrumented.last, null, 'an arm with no scored last turn has no last mean');
});

test('a failed v2.2 judge call is excluded from the mean instead of counting as a low score', () => {
  const overlay = buildShowcaseScoreOverlay({
    tutorV22: { ...TUTOR_V22, rows: [v22Row(), v22Row({ turnIndex: 9, success: false, overallScore: null })] },
  });
  const bare = showcaseV22ArmMeans(overlay).find((arm) => arm.armId === 'bare');
  assert.equal(bare.scored, 1);
  assert.equal(bare.all, 60);
});

test('per-arm label counts are derived from the rows and keep failures out of the verdict', () => {
  const overlay = buildShowcaseScoreOverlay({ prBenchmark: PR_BENCHMARK });
  const counts = showcaseLabelArmCounts(overlay);
  const bare = counts.find((arm) => arm.armId === 'bare');
  assert.equal(bare.turnsScored, 3);
  assert.equal(bare.turnsFailed, 0);
  assert.deepEqual(bare.verdict, { pass: 1, fail: 1, unsure: 1 });
  // The second bare turn carries no learner_uptake label at all: a missing label
  // is not an unsure verdict, so it lands in none of the three buckets.
  assert.deepEqual(bare.axes.learner_uptake, { pass: 2, fail: 0, unsure: 0 });
  assert.deepEqual(bare.axes.safety, { pass: 3, fail: 0, unsure: 0 });

  const instrumented = counts.find((arm) => arm.armId === 'instrumented');
  assert.equal(instrumented.turnsScored, 1);
  assert.equal(instrumented.turnsFailed, 1, 'a turn the judge could not label is not an unsure verdict');
  assert.deepEqual(instrumented.verdict, { pass: 1, fail: 0, unsure: 0 });
});

test('both aggregates narrow to one scenario, so a column head never shows a pooled number', () => {
  const overlay = buildShowcaseScoreOverlay({ prBenchmark: PR_BENCHMARK, tutorV22: TUTOR_V22 });

  const alpha = showcaseV22ArmMeans(overlay, { scenarioId: 'alpha' }).find((arm) => arm.armId === 'bare');
  assert.equal(alpha.first, 60, 'the alpha mean must exclude the beta turn the run-wide mean includes');
  assert.equal(alpha.last, 20);

  const beta = showcaseV22ArmMeans(overlay, { scenarioId: 'beta' }).find((arm) => arm.armId === 'bare');
  assert.equal(beta.first, 80);
  assert.equal(beta.last, null);

  const betaLabels = showcaseLabelArmCounts(overlay, { scenarioId: 'beta' });
  assert.equal(betaLabels.length, 1, 'only the arm that ran this scenario appears');
  assert.deepEqual(betaLabels[0].verdict, { pass: 0, fail: 0, unsure: 1 });
});

test('the aggregates are empty rather than throwing when their instrument is absent', () => {
  assert.deepEqual(showcaseV22ArmMeans(null), []);
  assert.deepEqual(showcaseLabelArmCounts(null), []);
  assert.deepEqual(showcaseV22ArmMeans(buildShowcaseScoreOverlay({ prBenchmark: PR_BENCHMARK })), []);
  assert.deepEqual(showcaseLabelArmCounts(buildShowcaseScoreOverlay({ tutorV22: TUTOR_V22 })), []);
});

test('a run directory with no score artefacts reads clean and yields no overlay', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-overlay-'));
  try {
    assert.deepEqual(readShowcaseScoreArtifacts(dir), {});
    assert.equal(loadShowcaseScoreOverlay(dir), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a corrupt artefact fails loudly instead of rendering a page that looks unscored', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-overlay-'));
  try {
    fs.writeFileSync(path.join(dir, SHOWCASE_OVERLAY_ARTIFACTS.tutorV22), '{ not json', 'utf8');
    assert.throws(() => readShowcaseScoreArtifacts(dir), /rubric-v2\.2\.json is present but unreadable/u);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a run directory with one artefact loads that side only', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-overlay-'));
  try {
    fs.writeFileSync(
      path.join(dir, SHOWCASE_OVERLAY_ARTIFACTS.prBenchmark),
      JSON.stringify(PR_BENCHMARK, null, 2),
      'utf8',
    );
    const overlay = loadShowcaseScoreOverlay(dir);
    assert.equal(overlay.tutorV22, null);
    assert.equal(overlay.prBenchmark.judge, 'claude-code.sonnet');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
