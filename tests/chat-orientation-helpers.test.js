/**
 * Unit tests for public/chat/orientation-helpers.js.
 *
 * The chat UI delegates effect-size binning, family grouping, the natural-
 * opposite default, vocabulary diffing, and tooltip formatting to this
 * module. The chat HTML loads it as `window.OH`; this test imports it
 * directly so we can lock the contract (and any future refactor will fail
 * loudly if the bin boundaries, family ordering, or default matchups
 * change).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  effectMagnitude,
  formatEffectSize,
  compareDefault,
  groupCellsByFamily,
  vocabularyDiff,
  orientationTooltip,
  FAMILIES,
  FAMILY_LABELS,
} from '../public/chat/orientation-helpers.js';

describe('orientation-helpers / effectMagnitude', () => {
  it('returns "unknown" for null, undefined, and NaN', () => {
    assert.equal(effectMagnitude(null), 'unknown');
    assert.equal(effectMagnitude(undefined), 'unknown');
    assert.equal(effectMagnitude(NaN), 'unknown');
  });

  it('bins per Cohen\'s conventions (positive)', () => {
    assert.equal(effectMagnitude(0), 'trivial');
    assert.equal(effectMagnitude(0.19), 'trivial');
    assert.equal(effectMagnitude(0.20), 'small');
    assert.equal(effectMagnitude(0.49), 'small');
    assert.equal(effectMagnitude(0.50), 'medium');
    assert.equal(effectMagnitude(0.79), 'medium');
    assert.equal(effectMagnitude(0.80), 'large');
    assert.equal(effectMagnitude(1.19), 'large');
    assert.equal(effectMagnitude(1.20), 'very-large');
    assert.equal(effectMagnitude(2.5), 'very-large');
  });

  it('uses absolute value for negative magnitudes', () => {
    assert.equal(effectMagnitude(-0.15), 'trivial');
    assert.equal(effectMagnitude(-0.35), 'small');
    assert.equal(effectMagnitude(-0.85), 'large');
    assert.equal(effectMagnitude(-1.5), 'very-large');
  });
});

describe('orientation-helpers / formatEffectSize', () => {
  it('returns empty string for null and NaN', () => {
    assert.equal(formatEffectSize(null), '');
    assert.equal(formatEffectSize(undefined), '');
    assert.equal(formatEffectSize(NaN), '');
  });

  it('prefixes positive values with +', () => {
    assert.equal(formatEffectSize(1.21), '+1.21');
    assert.equal(formatEffectSize(0.005), '+0.01');
  });

  it('uses U+2212 minus glyph for negatives (not hyphen)', () => {
    const out = formatEffectSize(-0.85);
    assert.equal(out, '−0.85');
    assert.equal(out.charCodeAt(0), 0x2212, 'must be U+2212 minus, not hyphen-minus');
  });

  it('renders zero with no sign', () => {
    assert.equal(formatEffectSize(0), '0.00');
  });

  it('rounds to two decimals', () => {
    assert.equal(formatEffectSize(1.234), '+1.23');
    assert.equal(formatEffectSize(-1.236), '−1.24');
  });
});

describe('orientation-helpers / compareDefault', () => {
  it('crosses transmission → recognition (cell_5)', () => {
    const out = compareDefault({ effectiveFamily: 'transmission', promptType: 'base' });
    assert.equal(out, 'cell_5_recog_single_unified');
  });

  it('crosses intersubjective → base (cell_1)', () => {
    const out = compareDefault({ effectiveFamily: 'intersubjective', promptType: 'recognition' });
    assert.equal(out, 'cell_1_base_single_unified');
  });

  it('matched_pedagogical pairs with matched_behaviorist (cell_96)', () => {
    const out = compareDefault({ effectiveFamily: 'intersubjective', promptType: 'matched_pedagogical' });
    assert.equal(out, 'cell_96_base_behaviorist_single_unified');
  });

  it('matched_behaviorist pairs with matched_pedagogical (cell_95)', () => {
    const out = compareDefault({ effectiveFamily: 'transmission', promptType: 'matched_behaviorist' });
    assert.equal(out, 'cell_95_base_matched_single_unified');
  });

  it('falls back to cell_5 for unknown / null orientations', () => {
    assert.equal(compareDefault(null), 'cell_5_recog_single_unified');
    assert.equal(compareDefault({}), 'cell_5_recog_single_unified');
    assert.equal(compareDefault({ effectiveFamily: 'something_else' }), 'cell_5_recog_single_unified');
  });

  it('matched_* prompt types take precedence over family (priority order)', () => {
    // matched_pedagogical lives in the intersubjective family but should
    // route to its named opposite, not the family default.
    const out = compareDefault({ effectiveFamily: 'intersubjective', promptType: 'matched_pedagogical' });
    assert.equal(out, 'cell_96_base_behaviorist_single_unified');
    assert.notEqual(out, 'cell_1_base_single_unified');
  });
});

describe('orientation-helpers / groupCellsByFamily', () => {
  const sample = [
    { name: 'cell_1', orientation: { effectiveFamily: 'transmission' } },
    { name: 'cell_5', orientation: { effectiveFamily: 'intersubjective' } },
    { name: 'cell_15', orientation: { effectiveFamily: 'neutral' } },
    { name: 'cell_22', orientation: { effectiveFamily: 'architectural_variant' } },
    { name: 'cell_orphan', orientation: null },
  ];

  it('orders families intersubjective → transmission → neutral → architectural_variant', () => {
    const groups = groupCellsByFamily(sample);
    assert.deepEqual(groups.map((g) => g.family), [
      'intersubjective',
      'transmission',
      'neutral',
      'architectural_variant',
    ]);
  });

  it('attaches non-empty human-readable labels to each group', () => {
    const groups = groupCellsByFamily(sample);
    for (const g of groups) {
      assert.equal(typeof g.label, 'string');
      assert.ok(g.label.length > 0, `family ${g.family} should have a non-empty label`);
    }
    // The three named families also get a parenthetical detail; the generic
    // architectural_variant catch-all is plain text and that is fine.
    const named = groups.filter((g) => g.family !== 'architectural_variant');
    for (const g of named) {
      assert.match(g.label, /\(.+\)/, `${g.family} label should include parenthetical detail`);
    }
  });

  it('places cells without orientation in architectural_variant', () => {
    const groups = groupCellsByFamily(sample);
    const av = groups.find((g) => g.family === 'architectural_variant');
    const names = av.cells.map((c) => c.name);
    assert.ok(names.includes('cell_orphan'));
    assert.ok(names.includes('cell_22'));
  });

  it('preserves input order within each group', () => {
    const cells = [
      { name: 'cell_3', orientation: { effectiveFamily: 'transmission' } },
      { name: 'cell_1', orientation: { effectiveFamily: 'transmission' } },
      { name: 'cell_2', orientation: { effectiveFamily: 'transmission' } },
    ];
    const groups = groupCellsByFamily(cells);
    assert.deepEqual(
      groups[0].cells.map((c) => c.name),
      ['cell_3', 'cell_1', 'cell_2'],
      'should not re-sort within group',
    );
  });

  it('omits empty families', () => {
    const groups = groupCellsByFamily([
      { name: 'cell_1', orientation: { effectiveFamily: 'transmission' } },
    ]);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].family, 'transmission');
  });

  it('handles null/empty input safely', () => {
    assert.deepEqual(groupCellsByFamily(null), []);
    assert.deepEqual(groupCellsByFamily([]), []);
  });
});

describe('orientation-helpers / vocabularyDiff', () => {
  it('splits into onlyA / onlyB / shared with correct contents', () => {
    const out = vocabularyDiff(['a', 'b', 'c'], ['b', 'c', 'd']);
    assert.deepEqual(out.onlyA, ['a']);
    assert.deepEqual(out.onlyB, ['d']);
    assert.deepEqual(out.shared, ['b', 'c']);
  });

  it('returns empty arrays for empty input', () => {
    assert.deepEqual(vocabularyDiff([], []), { onlyA: [], onlyB: [], shared: [] });
  });

  it('handles null safely on either side', () => {
    assert.deepEqual(vocabularyDiff(null, ['a']), { onlyA: [], onlyB: ['a'], shared: [] });
    assert.deepEqual(vocabularyDiff(['a'], null), { onlyA: ['a'], onlyB: [], shared: [] });
    assert.deepEqual(vocabularyDiff(null, null), { onlyA: [], onlyB: [], shared: [] });
  });

  it('preserves input order in each bucket', () => {
    const out = vocabularyDiff(['z', 'a', 'm'], ['m', 'a', 'q']);
    assert.deepEqual(out.onlyA, ['z']);
    assert.deepEqual(out.onlyB, ['q']);
    assert.deepEqual(out.shared, ['a', 'm']);  // input-A order preserved
  });
});

describe('orientation-helpers / orientationTooltip', () => {
  it('returns empty string for null/undefined orientation', () => {
    assert.equal(orientationTooltip(null), '');
    assert.equal(orientationTooltip(undefined), '');
  });

  it('emits one line per populated field', () => {
    const out = orientationTooltip({
      shortLabel: 'Test',
      lineage: 'L',
      viewOfLearner: 'V',
      roleOfTutor: 'R',
      keyMechanism: 'M',
    });
    assert.deepEqual(out.split('\n'), [
      'Test',
      'lineage: L',
      'learner: V',
      'tutor: R',
      'mechanism: M',
    ]);
  });

  it('appends formatted effect line when effectVsBase is set', () => {
    const out = orientationTooltip({
      shortLabel: 'Test',
      effectVsBase: 1.21,
    });
    assert.ok(out.includes('effect vs base: +1.21 (very-large)'),
      `tooltip should append effect-size line, got: ${JSON.stringify(out)}`);
  });

  it('omits effect line when effectVsBase is null', () => {
    const out = orientationTooltip({ shortLabel: 'Test', effectVsBase: null });
    assert.ok(!out.includes('effect vs base'), 'no effect line when null');
  });

  it('omits empty/falsy fields', () => {
    const out = orientationTooltip({ shortLabel: 'Test', viewOfLearner: '' });
    assert.equal(out, 'Test');
  });
});

describe('orientation-helpers / canonical exports', () => {
  it('FAMILIES is the ordered family-key list', () => {
    assert.deepEqual(FAMILIES, [
      'intersubjective',
      'transmission',
      'neutral',
      'architectural_variant',
    ]);
  });

  it('FAMILY_LABELS covers every FAMILIES key', () => {
    for (const fam of FAMILIES) {
      assert.ok(typeof FAMILY_LABELS[fam] === 'string' && FAMILY_LABELS[fam].length > 0,
        `missing FAMILY_LABELS["${fam}"]`);
    }
  });
});
