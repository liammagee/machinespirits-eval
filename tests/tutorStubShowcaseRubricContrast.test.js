import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildShowcaseRubricContrast,
  showcaseDimensionProfiles,
  __testing,
} from '../services/tutorStubShowcaseRubricContrast.js';

const { pearson, standardDeviation, describeSpread, axisScale, MIN_OBSERVATIONS } = __testing;

function v22Row(overrides = {}) {
  return {
    dialogueId: 'alpha__bare__m',
    scenarioId: 'alpha',
    armId: 'bare',
    baseline: true,
    turnLabel: 'first',
    turnIndex: 1,
    success: true,
    overallScore: 40,
    scores: {
      perception_quality: { score: 3 },
      pedagogical_craft: { score: 2 },
      elicitation_quality: { score: 4 },
    },
    ...overrides,
  };
}

/**
 * A minimal overlay with both tutor-rubric sides populated. Only the fields the
 * contrast module reads are present, deliberately: a fixture that mirrored the
 * whole artefact would pass even if the module started depending on something
 * the artefact does not guarantee.
 */
function overlayWith({ v22Rows = [], v30Rows = [], dimensionScales = null } = {}) {
  const side = (rows, rubricVersion) => ({
    rubricVersion,
    judge: 'claude-code.sonnet',
    turnsScored: 'first-last',
    limitation: null,
    dimensionScales,
    byTurn: Object.fromEntries(rows.map((row) => [`${row.dialogueId}#${row.turnIndex}`, row])),
  });
  return {
    prBenchmark: null,
    tutorV22: v22Rows.length ? side(v22Rows, '2.2') : null,
    tutorV30: v30Rows.length ? side(v30Rows, '3.0') : null,
  };
}

test('standardDeviation divides by n, not n-1', () => {
  // The scored turns are every turn the judge was asked about, not a sample of
  // some larger pool, so the population divisor is the correct one. Values
  // 2/4/4/4/5/5/7/9 have population sd exactly 2 and sample sd ~2.138.
  assert.equal(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9]), 2);
});

test('standardDeviation of a constant series is 0, and of an empty one is null', () => {
  assert.equal(standardDeviation([3, 3, 3]), 0);
  assert.equal(standardDeviation([]), null);
});

test('pearson returns null rather than 0 when a side has no variance', () => {
  // 0 would read as "these dimensions are unrelated"; the truth is that the
  // question cannot be asked of a dimension every turn scored identically.
  assert.equal(pearson([1, 1, 1, 1], [1, 2, 3, 4]), null);
  assert.equal(pearson([1, 2, 3, 4], [1, 2, 3, 4]), 1);
  assert.equal(Number(pearson([1, 2, 3, 4], [4, 3, 2, 1]).toFixed(6)), -1);
});

test('pearson deletes pairwise, and needs MIN_OBSERVATIONS complete pairs', () => {
  assert.equal(pearson([1, 2, null, 4], [1, 2, 3, 4]), 1);
  assert.equal(pearson([1, 2], [1, 2]), null);
  assert.equal(MIN_OBSERVATIONS, 3);
});

test('describeSpread counts distinct verdicts after rounding, not before', () => {
  // Two composites that differ in the fourth decimal are one verdict a reader
  // could act on, rendered twice. Counting before rounding would report an
  // instrument as finer than anything it can actually express.
  const spread = describeSpread([50, 50.0001, 60]);
  assert.equal(spread.distinct, 2);
  assert.equal(spread.n, 3);
  assert.equal(spread.min, 50);
  assert.equal(spread.max, 60);
});

test('axisScale prefers the declared scale over any inference, and says which it used', () => {
  const declared = axisScale({ dimensionScales: { craft: { min: 0, max: 4 } } }, 'craft', [1, 2, 3]);
  assert.deepEqual(declared, { min: 0, max: 4, declared: true });
});

test('axisScale infers 1-10 only when a value exceeds 5', () => {
  assert.deepEqual(axisScale({}, 'quality', [1, 3, 5]), { min: 1, max: 5, declared: false });
  assert.deepEqual(axisScale({}, 'quality', [1, 3, 8]), { min: 1, max: 10, declared: false });
});

test('buildShowcaseRubricContrast is null without a scored side', () => {
  assert.equal(buildShowcaseRubricContrast(null), null);
  assert.equal(buildShowcaseRubricContrast(overlayWith({})), null);
});

test('buildShowcaseRubricContrast reports spread, redundancy and the small-sample warning', () => {
  const rows = [40, 45, 55, 60, 62, 70].map((overallScore, index) =>
    v22Row({
      dialogueId: `alpha__bare__m`,
      turnIndex: index + 1,
      overallScore,
      scores: {
        perception_quality: { score: 1 + index * 0.5 },
        pedagogical_craft: { score: 1 + index * 0.5 },
        elicitation_quality: { score: 5 - index * 0.5 },
      },
    }),
  );
  const contrast = buildShowcaseRubricContrast(overlayWith({ v22Rows: rows }));

  assert.equal(contrast.versions.length, 1);
  const v22 = contrast.versions[0];
  assert.equal(v22.version, '2.2');
  assert.equal(v22.composite.n, 6);
  assert.equal(v22.dimensionCount, 3);
  // One summary per dimension, each carrying its own spread — the per-dimension
  // table on the page reads straight off these.
  assert.deepEqual(
    v22.dimensions.map((entry) => entry.key),
    ['perception_quality', 'pedagogical_craft', 'elicitation_quality'],
  );
  // Two dimensions move together exactly and the third moves exactly against
  // them, so every pair is |r| = 1 and all three count as strong.
  assert.equal(v22.redundancy.pairs, 3);
  assert.equal(v22.redundancy.meanAbsR, 1);
  assert.equal(v22.redundancy.strongPairs, 3);
  // Six turns is well under the threshold, so the page is obliged to caveat.
  assert.ok(contrast.sampleWarning);
});

test('buildShowcaseRubricContrast pairs the versions turn by turn and sorts divergences', () => {
  const v22Rows = [
    v22Row({ turnIndex: 1, overallScore: 40 }),
    v22Row({ turnIndex: 2, overallScore: 50 }),
    v22Row({ turnIndex: 3, overallScore: 60 }),
  ];
  const v30Rows = [
    v22Row({ turnIndex: 1, overallScore: 45, scores: { overall_pedagogical_quality: { score: 5 } } }),
    v22Row({ turnIndex: 2, overallScore: 55, scores: { overall_pedagogical_quality: { score: 6 } } }),
    v22Row({ turnIndex: 3, overallScore: 70, scores: { overall_pedagogical_quality: { score: 8 } } }),
  ];
  const contrast = buildShowcaseRubricContrast(overlayWith({ v22Rows, v30Rows }));

  assert.equal(contrast.agreement.n, 3);
  // The two versions order these three turns the same way, which is what the
  // page reports as the general factor surviving the simplification.
  assert.ok(contrast.agreement.r > 0.9);
  // Biggest gap first, so a reader who reads one row reads the one that matters.
  assert.equal(contrast.agreement.divergences[0].turnIndex, 3);
  assert.equal(contrast.agreement.divergences[0].gap, 10);
});

test('showcaseDimensionProfiles reads dimension keys from the artefact, not from a rubric file', () => {
  // A later YAML edit that renames or drops a dimension must not relabel numbers
  // already written to disk, so the keys come from the scored rows themselves.
  const rows = [
    v22Row({ turnIndex: 1, scores: { legacy_dimension: { score: 4 }, perception_quality: { score: 2 } } }),
    v22Row({ turnIndex: 2, scores: { legacy_dimension: { score: 2 }, perception_quality: { score: 4 } } }),
  ];
  const profile = showcaseDimensionProfiles(overlayWith({ v22Rows: rows }), { version: '2.2' });
  assert.deepEqual(
    profile.axes.map((axis) => axis.key),
    ['legacy_dimension', 'perception_quality'],
  );
});

test('showcaseDimensionProfiles averages per arm and marks the baseline', () => {
  const rows = [
    v22Row({ turnIndex: 1, scores: { perception_quality: { score: 2 } } }),
    v22Row({ turnIndex: 2, scores: { perception_quality: { score: 4 } } }),
    v22Row({
      armId: 'instrumented',
      baseline: false,
      dialogueId: 'alpha__inst__m',
      turnIndex: 1,
      scores: { perception_quality: { score: 5 } },
    }),
  ];
  const profile = showcaseDimensionProfiles(overlayWith({ v22Rows: rows }), { version: '2.2' });

  const bare = profile.series.find((entry) => entry.id === 'bare');
  const instrumented = profile.series.find((entry) => entry.id === 'instrumented');
  assert.equal(bare.values[0], 3);
  assert.equal(bare.baseline, true);
  assert.equal(bare.turns, 2);
  assert.equal(instrumented.values[0], 5);
  assert.equal(instrumented.baseline, false);
  // Distinct tones, or the two profiles are indistinguishable once plotted.
  assert.notEqual(bare.tone, instrumented.tone);
});

test('showcaseDimensionProfiles reports a dimension no arm scored as null, not as zero', () => {
  const rows = [
    v22Row({ turnIndex: 1, scores: { perception_quality: { score: 3 }, content_accuracy: { score: 'n/a' } } }),
  ];
  const profile = showcaseDimensionProfiles(overlayWith({ v22Rows: rows }), { version: '2.2' });
  const accuracyIndex = profile.axes.findIndex((axis) => axis.key === 'content_accuracy');
  assert.equal(profile.series[0].values[accuracyIndex], null);
});

test('showcaseDimensionProfiles flags declared scales only when every axis has one', () => {
  const rows = [v22Row({ turnIndex: 1 })];
  assert.equal(showcaseDimensionProfiles(overlayWith({ v22Rows: rows }), { version: '2.2' }).scalesDeclared, false);

  // A partial declaration is not a declaration: if one axis still had to be
  // inferred, the page owes the reader the inference note.
  const partial = overlayWith({ v22Rows: rows, dimensionScales: { perception_quality: { min: 1, max: 5 } } });
  assert.equal(showcaseDimensionProfiles(partial, { version: '2.2' }).scalesDeclared, false);

  const full = overlayWith({
    v22Rows: rows,
    dimensionScales: {
      perception_quality: { min: 1, max: 5 },
      pedagogical_craft: { min: 1, max: 5 },
      elicitation_quality: { min: 1, max: 5 },
    },
  });
  assert.equal(showcaseDimensionProfiles(full, { version: '2.2' }).scalesDeclared, true);
});

test('showcaseDimensionProfiles is null for a version with no scored side', () => {
  assert.equal(showcaseDimensionProfiles(overlayWith({ v22Rows: [v22Row()] }), { version: '3.0' }), null);
  assert.equal(showcaseDimensionProfiles(null, { version: '2.2' }), null);
});
