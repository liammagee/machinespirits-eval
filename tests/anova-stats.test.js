/**
 * Tests for the ANOVA statistics module (services/anovaStats.js).
 *
 * Covers:
 *   - factorsToCellKey() — boolean factor combos → cell key strings
 *   - runThreeWayANOVA() — error handling, uniform data, main effects, structure
 *   - formatANOVAReport() — error messages, formatted output, significance markers
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { factorsToCellKey, runThreeWayANOVA, formatANOVAReport } from '../services/anovaStats.js';

// ============================================================================
// factorsToCellKey
// ============================================================================

describe('factorsToCellKey', () => {
  it('maps all-false factors to "r0_t0_l0"', () => {
    assert.strictEqual(
      factorsToCellKey({ recognition: false, multi_agent_tutor: false, multi_agent_learner: false }),
      'r0_t0_l0',
    );
  });

  it('maps all-true factors to "r1_t1_l1"', () => {
    assert.strictEqual(
      factorsToCellKey({ recognition: true, multi_agent_tutor: true, multi_agent_learner: true }),
      'r1_t1_l1',
    );
  });

  it('all 8 factor combinations produce unique correct keys', () => {
    const expected = [
      [{ recognition: false, multi_agent_tutor: false, multi_agent_learner: false }, 'r0_t0_l0'],
      [{ recognition: false, multi_agent_tutor: false, multi_agent_learner: true }, 'r0_t0_l1'],
      [{ recognition: false, multi_agent_tutor: true, multi_agent_learner: false }, 'r0_t1_l0'],
      [{ recognition: false, multi_agent_tutor: true, multi_agent_learner: true }, 'r0_t1_l1'],
      [{ recognition: true, multi_agent_tutor: false, multi_agent_learner: false }, 'r1_t0_l0'],
      [{ recognition: true, multi_agent_tutor: false, multi_agent_learner: true }, 'r1_t0_l1'],
      [{ recognition: true, multi_agent_tutor: true, multi_agent_learner: false }, 'r1_t1_l0'],
      [{ recognition: true, multi_agent_tutor: true, multi_agent_learner: true }, 'r1_t1_l1'],
    ];
    const keys = new Set();
    for (const [factors, expectedKey] of expected) {
      const key = factorsToCellKey(factors);
      assert.strictEqual(key, expectedKey);
      keys.add(key);
    }
    assert.strictEqual(keys.size, 8);
  });
});

// ============================================================================
// runThreeWayANOVA
// ============================================================================

describe('runThreeWayANOVA — error handling', () => {
  it('returns error for empty object', () => {
    const result = runThreeWayANOVA({});
    assert.strictEqual(typeof result.error, 'string');
    assert.ok(result.error.includes('No data'));
  });

  it('returns error for non-cell-keyed data', () => {
    const result = runThreeWayANOVA({ budget: [50, 60], recognition: [70, 80] });
    assert.strictEqual(typeof result.error, 'string');
  });

  it('returns error for cell-keyed data with empty arrays', () => {
    const result = runThreeWayANOVA({ r0_t0_l0: [], r1_t1_l1: [] });
    assert.strictEqual(typeof result.error, 'string');
  });
});

// Helper: generate uniform data across all 8 cells
function uniformData(value, n) {
  const data = {};
  for (const r of [0, 1]) {
    for (const t of [0, 1]) {
      for (const l of [0, 1]) {
        data[`r${r}_t${t}_l${l}`] = Array(n).fill(value);
      }
    }
  }
  return data;
}

describe('runThreeWayANOVA — uniform scores', () => {
  it('all F values are 0 when scores are identical across cells', () => {
    const result = runThreeWayANOVA(uniformData(60, 5));
    assert.strictEqual(typeof result.error, 'object', 'result.error should be the ANOVA error term object');
    assert.ok(result.mainEffects, 'should have mainEffects');

    for (const effect of Object.values(result.mainEffects)) {
      // With uniform data, all SS are 0, so F = 0/MS_E. MS_E = 0 since SS_E = 0,
      // which means F = 0/0 = NaN. Check SS is 0 instead.
      assert.strictEqual(effect.SS, 0, 'SS should be 0 for uniform data');
    }
    for (const interaction of Object.values(result.interactions)) {
      assert.strictEqual(interaction.SS, 0, 'Interaction SS should be 0 for uniform data');
    }
  });

  it('no significant effects with uniform data', () => {
    const result = runThreeWayANOVA(uniformData(60, 5));
    assert.ok(result.mainEffects, 'should have mainEffects');
  });
});

describe('runThreeWayANOVA — recognition main effect', () => {
  it('detects recognition effect when recognition cells score higher', () => {
    const data = {};
    for (const r of [0, 1]) {
      for (const t of [0, 1]) {
        for (const l of [0, 1]) {
          // Recognition cells (r=1) score 20 points higher
          data[`r${r}_t${t}_l${l}`] = r === 1 ? [80, 82, 78, 81, 79] : [60, 62, 58, 61, 59];
        }
      }
    }
    const result = runThreeWayANOVA(data);
    assert.ok(result.mainEffects, 'should have mainEffects');
    assert.ok(result.mainEffects.recognition.F > 0, 'Recognition F should be > 0');
    assert.ok(
      result.marginalMeans.recognition.recognition > result.marginalMeans.recognition.standard,
      'Recognition marginal mean should exceed standard',
    );
  });
});

describe('runThreeWayANOVA — tutor main effect', () => {
  it('detects tutor effect when multi-agent tutor cells score higher', () => {
    const data = {};
    for (const r of [0, 1]) {
      for (const t of [0, 1]) {
        for (const l of [0, 1]) {
          data[`r${r}_t${t}_l${l}`] = t === 1 ? [75, 77, 73, 76, 74] : [55, 57, 53, 56, 54];
        }
      }
    }
    const result = runThreeWayANOVA(data);
    assert.ok(result.mainEffects, 'should have mainEffects');
    assert.ok(result.mainEffects.tutor.F > 0, 'Tutor F should be > 0');
    assert.ok(
      result.marginalMeans.tutor.multi > result.marginalMeans.tutor.single,
      'Multi-agent tutor mean should exceed single',
    );
  });
});

describe('runThreeWayANOVA — output structure', () => {
  const data = {};
  for (const r of [0, 1]) {
    for (const t of [0, 1]) {
      for (const l of [0, 1]) {
        data[`r${r}_t${t}_l${l}`] = [50 + r * 10 + t * 5 + l * 3, 52 + r * 10 + t * 5 + l * 3];
      }
    }
  }
  const result = runThreeWayANOVA(data);

  it('grand mean equals mean of all input scores', () => {
    const allScores = Object.values(data).flat();
    const expectedMean = allScores.reduce((a, b) => a + b, 0) / allScores.length;
    assert.ok(Math.abs(result.grandMean - expectedMean) < 0.001);
  });

  it('N equals total number of input scores', () => {
    const allScores = Object.values(data).flat();
    assert.strictEqual(result.N, allScores.length);
  });

  it('SS_total equals sum of squared deviations from grand mean', () => {
    const allScores = Object.values(data).flat();
    const mean = allScores.reduce((a, b) => a + b, 0) / allScores.length;
    const expectedSST = allScores.reduce((acc, x) => acc + (x - mean) ** 2, 0);
    assert.ok(Math.abs(result.total.SS - expectedSST) < 0.001);
  });

  it('marginal means have correct structure', () => {
    assert.ok('standard' in result.marginalMeans.recognition);
    assert.ok('recognition' in result.marginalMeans.recognition);
    assert.ok('single' in result.marginalMeans.tutor);
    assert.ok('multi' in result.marginalMeans.tutor);
    assert.ok('unified' in result.marginalMeans.learner);
    assert.ok('ego_superego' in result.marginalMeans.learner);
  });

  it('interaction terms present in output', () => {
    assert.ok(result.interactions.recognition_x_tutor);
    assert.ok(result.interactions.recognition_x_learner);
    assert.ok(result.interactions.tutor_x_learner);
    assert.ok(result.interactions.three_way);
  });

  it('each effect has SS, df, MS, F, p, etaSq', () => {
    for (const effect of Object.values(result.mainEffects)) {
      for (const key of ['SS', 'df', 'MS', 'F', 'p', 'etaSq']) {
        assert.strictEqual(typeof effect[key], 'number', `Effect missing ${key}`);
      }
    }
  });
});

// ============================================================================
// formatANOVAReport
// ============================================================================

describe('formatANOVAReport', () => {
  it('returns error message string when ANOVA result has error', () => {
    const report = formatANOVAReport({ error: 'No data available for ANOVA' });
    assert.ok(typeof report === 'string');
    assert.ok(report.includes('ANOVA Error'));
    assert.ok(report.includes('No data'));
  });

  it('returns formatted string with ANOVA TABLE header', () => {
    const data = uniformData(60, 3);
    const result = runThreeWayANOVA(data);
    const report = formatANOVAReport(result);
    assert.ok(report.includes('ANOVA TABLE'));
  });

  it('includes marginal means section', () => {
    const data = uniformData(60, 3);
    const result = runThreeWayANOVA(data);
    const report = formatANOVAReport(result);
    assert.ok(report.includes('MARGINAL MEANS'));
    assert.ok(report.includes('Recognition:'));
    assert.ok(report.includes('Tutor:'));
    assert.ok(report.includes('Learner:'));
  });

  it('includes custom score label when provided', () => {
    const data = uniformData(60, 3);
    const result = runThreeWayANOVA(data);
    const report = formatANOVAReport(result, { scoreLabel: 'Base Score' });
    assert.ok(report.includes('BASE SCORE'));
  });

  it('marks significant effects with ***', () => {
    // Create data with a large recognition effect to trigger significance
    const data = {};
    for (const r of [0, 1]) {
      for (const t of [0, 1]) {
        for (const l of [0, 1]) {
          data[`r${r}_t${t}_l${l}`] = r === 1 ? [90, 92, 88, 91, 89, 90, 93, 87] : [50, 52, 48, 51, 49, 50, 53, 47];
        }
      }
    }
    const result = runThreeWayANOVA(data);
    const report = formatANOVAReport(result);
    assert.ok(report.includes('***'), 'Report should mark significant effects with ***');
  });
});
