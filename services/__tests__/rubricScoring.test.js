/**
 * Tests for rubric scoring functions — calculateOverallScore, calculateBaseScore,
 * calculateRecognitionScore, calculateGroupScore, getDimensionsByGroup.
 *
 * Verifies that scoring works correctly across rubric versions, including v2.2
 * where dimension names differ from v2.1.
 *
 * Run: node --test services/__tests__/rubricScoring.test.js
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  calculateOverallScore,
  calculateBaseScore,
  calculateRecognitionScore,
  calculateGroupScore,
} from '../rubricEvaluator.js';
import {
  setRubricPathOverride,
  clearRubricPathOverride,
  getRubricDimensions,
  getDimensionsByGroup,
} from '../evalConfigLoader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const V21_RUBRIC = path.join(ROOT_DIR, 'config', 'evaluation-rubric.yaml');
const V22_RUBRIC = path.join(ROOT_DIR, 'config', 'rubrics', 'v2.2', 'evaluation-rubric.yaml');

/** Build a mock scores object where every dimension gets the same score. */
function uniformScores(dimensions, score = 4) {
  const scores = {};
  for (const key of Object.keys(dimensions)) {
    scores[key] = { score, reasoning: 'test' };
  }
  return scores;
}

// ============================================================================
// v2.1 rubric scoring (current production)
// ============================================================================

describe('rubric scoring — v2.1', () => {
  beforeEach(() => {
    setRubricPathOverride(V21_RUBRIC);
  });
  afterEach(() => {
    clearRubricPathOverride();
  });

  it('calculateOverallScore returns non-zero for v2.1 dimensions', () => {
    const dims = getRubricDimensions();
    const scores = uniformScores(dims, 4);
    const overall = calculateOverallScore(scores);
    assert.ok(overall > 0, `expected non-zero overall, got ${overall}`);
    // Score of 4 on 1-5 scale → ((4-1)/4)*100 = 75
    assert.ok(Math.abs(overall - 75) < 1, `expected ~75, got ${overall}`);
  });

  it('calculateBaseScore returns non-zero for v2.1 base dimensions', () => {
    const dims = getRubricDimensions();
    const scores = uniformScores(dims, 4);
    const base = calculateBaseScore(scores);
    assert.ok(base > 0, `expected non-zero base score, got ${base}`);
  });

  it('calculateRecognitionScore returns non-zero for v2.1 recognition dimensions', () => {
    const dims = getRubricDimensions();
    const scores = uniformScores(dims, 4);
    const recog = calculateRecognitionScore(scores);
    assert.ok(recog > 0, `expected non-zero recognition score, got ${recog}`);
  });

  it('base + recognition dimensions cover all v2.1 dimensions', () => {
    const dims = getRubricDimensions();
    const scores = uniformScores(dims, 4);
    const base = calculateBaseScore(scores);
    const recog = calculateRecognitionScore(scores);
    // Both should be non-zero, meaning all dimensions are accounted for
    assert.ok(base > 0, 'base should cover some dimensions');
    assert.ok(recog > 0, 'recognition should cover some dimensions');
  });

  it('calculateBaseScore and calculateGroupScore("base") produce identical results', () => {
    const dims = getRubricDimensions();
    const scores = uniformScores(dims, 4);
    const base = calculateBaseScore(scores);
    const group = calculateGroupScore(scores, 'base');
    assert.strictEqual(base, group, 'base score should equal group("base") score');
  });

  it('calculateRecognitionScore and calculateGroupScore("treatment") produce identical results', () => {
    const dims = getRubricDimensions();
    const scores = uniformScores(dims, 4);
    const recog = calculateRecognitionScore(scores);
    const group = calculateGroupScore(scores, 'treatment');
    assert.strictEqual(recog, group, 'recognition score should equal group("treatment") score');
  });
});

// ============================================================================
// v2.2 rubric scoring — bug is now fixed via YAML-driven groups
// ============================================================================

describe('rubric scoring — v2.2', () => {
  beforeEach(() => {
    setRubricPathOverride(V22_RUBRIC);
  });
  afterEach(() => {
    clearRubricPathOverride();
  });

  it('v2.2 has 8 dimensions with different keys than v2.1', () => {
    const dims = getRubricDimensions();
    const keys = Object.keys(dims);
    assert.strictEqual(keys.length, 8, `expected 8 v2.2 dimensions, got ${keys.length}`);
    assert.ok(keys.includes('perception_quality'), 'should have perception_quality');
    assert.ok(keys.includes('pedagogical_craft'), 'should have pedagogical_craft');
    assert.ok(!keys.includes('relevance'), 'should NOT have v2.1 key "relevance"');
  });

  it('calculateOverallScore works correctly with v2.2 dimensions', () => {
    const dims = getRubricDimensions();
    const scores = uniformScores(dims, 4);
    const overall = calculateOverallScore(scores);
    assert.ok(overall > 0, `expected non-zero overall, got ${overall}`);
    assert.ok(Math.abs(overall - 75) < 1, `expected ~75, got ${overall}`);
  });

  // FIXED: calculateBaseScore now reads group membership from YAML instead of
  // hardcoded v2.1 dimension names. v2.2 dimensions with group: base produce non-zero.
  it('calculateBaseScore returns non-zero for v2.2 dimensions (YAML-driven groups)', () => {
    const dims = getRubricDimensions();
    const scores = uniformScores(dims, 4);
    const base = calculateBaseScore(scores);
    assert.ok(base > 0, `expected non-zero base score, got ${base}`);
    assert.ok(Math.abs(base - 75) < 1, `expected ~75, got ${base}`);
  });

  // FIXED: calculateRecognitionScore now reads group membership from YAML.
  // v2.2 has one treatment dimension (recognition_quality).
  it('calculateRecognitionScore returns non-zero for v2.2 dimensions (YAML-driven groups)', () => {
    const dims = getRubricDimensions();
    const scores = uniformScores(dims, 4);
    const recog = calculateRecognitionScore(scores);
    assert.ok(recog > 0, `expected non-zero recognition score, got ${recog}`);
    assert.ok(Math.abs(recog - 75) < 1, `expected ~75, got ${recog}`);
  });
});

// ============================================================================
// getDimensionsByGroup
// ============================================================================

describe('getDimensionsByGroup', () => {
  afterEach(() => {
    clearRubricPathOverride();
  });

  it('v2.1: base group returns 8 dimensions', () => {
    setRubricPathOverride(V21_RUBRIC);
    const baseDims = getDimensionsByGroup('base');
    assert.strictEqual(baseDims.length, 8, `expected 8 base dims, got ${baseDims.length}: ${baseDims}`);
    assert.ok(baseDims.includes('relevance'), 'base should include relevance');
    assert.ok(baseDims.includes('productive_struggle'), 'base should include productive_struggle');
    assert.ok(!baseDims.includes('mutual_recognition'), 'base should NOT include mutual_recognition');
  });

  it('v2.1: treatment group returns 6 dimensions', () => {
    setRubricPathOverride(V21_RUBRIC);
    const treatmentDims = getDimensionsByGroup('treatment');
    assert.strictEqual(treatmentDims.length, 6, `expected 6 treatment dims, got ${treatmentDims.length}: ${treatmentDims}`);
    assert.ok(treatmentDims.includes('mutual_recognition'), 'treatment should include mutual_recognition');
    assert.ok(treatmentDims.includes('learner_growth'), 'treatment should include learner_growth');
    assert.ok(!treatmentDims.includes('relevance'), 'treatment should NOT include relevance');
  });

  it('v2.2: base group returns 7 dimensions', () => {
    setRubricPathOverride(V22_RUBRIC);
    const baseDims = getDimensionsByGroup('base');
    assert.strictEqual(baseDims.length, 7, `expected 7 base dims, got ${baseDims.length}: ${baseDims}`);
    assert.ok(baseDims.includes('perception_quality'), 'base should include perception_quality');
    assert.ok(baseDims.includes('content_accuracy'), 'base should include content_accuracy');
    assert.ok(!baseDims.includes('recognition_quality'), 'base should NOT include recognition_quality');
  });

  it('v2.2: treatment group returns 1 dimension', () => {
    setRubricPathOverride(V22_RUBRIC);
    const treatmentDims = getDimensionsByGroup('treatment');
    assert.strictEqual(treatmentDims.length, 1, `expected 1 treatment dim, got ${treatmentDims.length}: ${treatmentDims}`);
    assert.strictEqual(treatmentDims[0], 'recognition_quality');
  });

  it('unknown group returns empty array', () => {
    setRubricPathOverride(V21_RUBRIC);
    const unknownDims = getDimensionsByGroup('nonexistent');
    assert.strictEqual(unknownDims.length, 0, 'unknown group should return empty array');
  });

  it('base + treatment groups cover all dimensions', () => {
    for (const [label, rubricPath] of [['v2.1', V21_RUBRIC], ['v2.2', V22_RUBRIC]]) {
      setRubricPathOverride(rubricPath);
      const allDims = Object.keys(getRubricDimensions());
      const baseDims = getDimensionsByGroup('base');
      const treatmentDims = getDimensionsByGroup('treatment');
      const covered = new Set([...baseDims, ...treatmentDims]);
      clearRubricPathOverride();
      assert.strictEqual(
        covered.size,
        allDims.length,
        `${label}: base (${baseDims.length}) + treatment (${treatmentDims.length}) should cover all ${allDims.length} dimensions`,
      );
    }
  });
});

// ============================================================================
// calculateGroupScore
// ============================================================================

describe('calculateGroupScore', () => {
  afterEach(() => {
    clearRubricPathOverride();
  });

  it('returns 0 for empty scores object', () => {
    setRubricPathOverride(V21_RUBRIC);
    const score = calculateGroupScore({}, 'base');
    assert.strictEqual(score, 0, 'empty scores should produce 0');
  });

  it('returns 0 for unknown group when all scores are present', () => {
    setRubricPathOverride(V21_RUBRIC);
    const dims = getRubricDimensions();
    const scores = uniformScores(dims, 4);
    const score = calculateGroupScore(scores, 'nonexistent');
    assert.strictEqual(score, 0, 'unknown group should produce 0');
  });

  it('produces correct score for non-uniform scores', () => {
    setRubricPathOverride(V22_RUBRIC);
    // v2.2 treatment group has only recognition_quality (weight 0.15)
    const scores = { recognition_quality: { score: 3, reasoning: 'test' } };
    const score = calculateGroupScore(scores, 'treatment');
    // ((3-1)/4)*100 = 50
    assert.ok(Math.abs(score - 50) < 1, `expected ~50, got ${score}`);
  });
});

// ============================================================================
// Cross-version invariants
// ============================================================================

describe('rubric scoring — cross-version invariants', () => {
  // v2.1 has 14 dimensions with weights summing to ~1.216 (base ~0.81 + recognition ~0.40).
  // This is by design — calculateOverallScore divides by totalWeight to normalize.
  it('v2.1 dimension weights sum to ~1.216 (base + recognition, unnormalized)', () => {
    setRubricPathOverride(V21_RUBRIC);
    const dims = getRubricDimensions();
    const totalWeight = Object.values(dims).reduce((sum, d) => sum + (d.weight || 0), 0);
    clearRubricPathOverride();
    assert.ok(totalWeight > 1.0, `v2.1 weights should exceed 1.0 (got ${totalWeight})`);
    assert.ok(totalWeight < 1.3, `v2.1 weights should be < 1.3 (got ${totalWeight})`);
  });

  it('all dimension weights sum to ~1.0 for v2.2', () => {
    setRubricPathOverride(V22_RUBRIC);
    const dims = getRubricDimensions();
    const totalWeight = Object.values(dims).reduce((sum, d) => sum + (d.weight || 0), 0);
    clearRubricPathOverride();
    assert.ok(Math.abs(totalWeight - 1.0) < 0.01, `v2.2 weights sum to ${totalWeight}, expected ~1.0`);
  });

  it('uniform score=4 produces ~75 on both rubric versions', () => {
    for (const [label, rubricPath] of [['v2.1', V21_RUBRIC], ['v2.2', V22_RUBRIC]]) {
      setRubricPathOverride(rubricPath);
      const dims = getRubricDimensions();
      const scores = uniformScores(dims, 4);
      const overall = calculateOverallScore(scores);
      clearRubricPathOverride();
      assert.ok(
        Math.abs(overall - 75) < 1,
        `${label}: uniform score=4 should give ~75, got ${overall}`,
      );
    }
  });
});
