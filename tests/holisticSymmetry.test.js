/**
 * TuH / LrH bilateral symmetry — scoring function and prompt consistency.
 *
 * Verifies that the tutor holistic and learner holistic scoring infrastructure
 * follows the same structural patterns, even though they evaluate different
 * aspects of the dialogue (tutor pedagogy vs learner engagement).
 *
 * Per CLAUDE.md: "Always aim for absolute symmetry between tutor and learner
 * trace labels, scoring pipelines, and data structures."
 *
 * The symmetry principle applies to:
 *   - Score formula: both use weighted (1-5) → 0-100 conversion
 *   - Dimension structure: weights summing to 1.0
 *   - Prompt contract: same JSON format, same 1-5 scale, same evaluation framing
 *   - Agent targeting: each prompt evaluates only its own agent
 *
 * Note: Since v2.2, tutor holistic has 3 arc-focused dims (no conditional dimension),
 * learner has 5 ICAP-anchored dims. Neither has conditional dimensions.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateTutorHolisticScore,
  getTutorHolisticDimensions,
  buildTutorHolisticEvaluationPrompt,
} from '../services/rubricEvaluator.js';

import {
  calculateLearnerOverallScore,
  getLearnerDimensions,
  buildLearnerHolisticEvaluationPrompt,
} from '../services/learnerRubricEvaluator.js';

// Helper: assert approximate equality (floating point safe)
function assertApprox(actual, expected, msg) {
  assert.ok(Math.abs(actual - expected) < 0.01, `${msg}: expected ~${expected}, got ${actual}`);
}

describe('TuH / LrH holistic scoring symmetry', () => {
  // ── Both use the same weighted-average formula: (1-5 scale) → 0-100 ───

  it('tutor holistic scorer uses weighted (1-5) → 0-100 formula', () => {
    const dims = getTutorHolisticDimensions({ hasRecognition: true });

    const allMax = {};
    for (const key of Object.keys(dims)) allMax[key] = { score: 5, reasoning: 'perfect' };
    assertApprox(calculateTutorHolisticScore(allMax, true), 100, 'all-5 should be 100');

    const allMin = {};
    for (const key of Object.keys(dims)) allMin[key] = { score: 1, reasoning: 'worst' };
    assertApprox(calculateTutorHolisticScore(allMin, true), 0, 'all-1 should be 0');

    const allMid = {};
    for (const key of Object.keys(dims)) allMid[key] = { score: 3, reasoning: 'average' };
    assertApprox(calculateTutorHolisticScore(allMid, true), 50, 'all-3 should be 50');
  });

  it('learner holistic scorer uses the same weighted (1-5) → 0-100 formula', () => {
    const dims = getLearnerDimensions({ isMultiAgent: true });

    const allMax = {};
    for (const key of Object.keys(dims)) allMax[key] = { score: 5, reasoning: 'perfect' };
    assertApprox(calculateLearnerOverallScore(allMax, true), 100, 'all-5 should be 100');

    const allMin = {};
    for (const key of Object.keys(dims)) allMin[key] = { score: 1, reasoning: 'worst' };
    assertApprox(calculateLearnerOverallScore(allMin, true), 0, 'all-1 should be 0');

    const allMid = {};
    for (const key of Object.keys(dims)) allMid[key] = { score: 3, reasoning: 'average' };
    assertApprox(calculateLearnerOverallScore(allMid, true), 50, 'all-3 should be 50');
  });

  // ── Both have a conditional dimension gated by a factor ───────────────

  it('v2.2 tutor holistic returns same 3 dims regardless of hasRecognition', () => {
    const withRecog = getTutorHolisticDimensions({ hasRecognition: true });
    const withoutRecog = getTutorHolisticDimensions({ hasRecognition: false });

    assert.deepStrictEqual(
      Object.keys(withRecog),
      Object.keys(withoutRecog),
      'v2.2 has no conditional dimensions — same keys for base and recognition',
    );
    assert.ok('pedagogical_arc' in withRecog, 'has pedagogical_arc');
    assert.ok('adaptive_trajectory' in withRecog, 'has adaptive_trajectory');
    assert.ok('pedagogical_closure' in withRecog, 'has pedagogical_closure');
    assert.strictEqual(Object.keys(withRecog).length, 3, '3 dimensions total');
  });

  it('v2.2 learner dimensions are uniform across architectures (5 ICAP-anchored dims)', () => {
    const withMulti = getLearnerDimensions({ isMultiAgent: true });
    const withoutMulti = getLearnerDimensions({ isMultiAgent: false });

    // Same dimensions for both architectures
    assert.deepStrictEqual(
      Object.keys(withMulti),
      Object.keys(withoutMulti),
      'same dimensions for multi-agent and unified',
    );
    assert.ok('engagement_quality' in withMulti, 'has engagement_quality');
    assert.ok('learner_authenticity' in withMulti, 'has learner_authenticity');
    assert.ok('revision_signals' in withMulti, 'has revision_signals');
    assert.ok('conceptual_progression' in withMulti, 'has conceptual_progression');
    assert.ok('metacognitive_awareness' in withMulti, 'has metacognitive_awareness');
  });

  // ── Both dimension sets have the same number of dimensions ────────────

  it('tutor and learner holistic have expected v2.2 dimension counts', () => {
    const tutorRecog = getTutorHolisticDimensions({ hasRecognition: true });
    const tutorBase = getTutorHolisticDimensions({ hasRecognition: false });
    const learnerMulti = getLearnerDimensions({ isMultiAgent: true });
    const learnerUnified = getLearnerDimensions({ isMultiAgent: false });

    // Tutor holistic: always 3 dims in v2.2 (no conditional)
    assert.strictEqual(
      Object.keys(tutorRecog).length,
      3,
      `tutor recog should have 3 dims, got ${Object.keys(tutorRecog).length}`,
    );
    assert.strictEqual(
      Object.keys(tutorBase).length,
      3,
      `tutor base should have 3 dims, got ${Object.keys(tutorBase).length}`,
    );
    // Learner: always 5 dims in v2.2 (no conditional)
    assert.strictEqual(
      Object.keys(learnerMulti).length,
      5,
      `learner multi should have 5 dims, got ${Object.keys(learnerMulti).length}`,
    );
    assert.strictEqual(
      Object.keys(learnerUnified).length,
      5,
      `learner unified should have 5 dims, got ${Object.keys(learnerUnified).length}`,
    );
    // v2.2: no conditional dimensions — both variants identical
    assert.deepStrictEqual(Object.keys(tutorRecog), Object.keys(tutorBase), 'tutor dims identical for recog and base');
    assert.deepStrictEqual(
      Object.keys(learnerMulti),
      Object.keys(learnerUnified),
      'learner dims identical for multi and unified',
    );
  });

  // ── Both dimension sets have weights summing to 1.0 ───────────────────

  it('tutor holistic dimension weights sum to 1.0', () => {
    const dims = getTutorHolisticDimensions({ hasRecognition: true });
    const totalWeight = Object.values(dims).reduce((sum, d) => sum + d.weight, 0);
    assert.ok(Math.abs(totalWeight - 1.0) < 0.001, `tutor holistic weights should sum to 1.0, got ${totalWeight}`);
  });

  it('learner holistic dimension weights sum to 1.0', () => {
    const dims = getLearnerDimensions({ isMultiAgent: true });
    const totalWeight = Object.values(dims).reduce((sum, d) => sum + d.weight, 0);
    assert.ok(Math.abs(totalWeight - 1.0) < 0.001, `learner holistic weights should sum to 1.0, got ${totalWeight}`);
  });

  // ── Both prompts use the same 1-5 scoring scale and JSON format ───────

  it('tutor holistic prompt requests 1-5 scores in JSON format', () => {
    const prompt = buildTutorHolisticEvaluationPrompt({
      turns: [{ tutorMessage: 'Hello', learnerMessage: 'Hi' }],
      scenarioName: 'Test',
    });
    assert.ok(prompt.includes('Score each dimension from 1-5'), 'should use 1-5 scale');
    assert.ok(prompt.includes('"score": 3'), 'should show JSON example with sample score field');
    assert.ok(prompt.includes('"reasoning"'), 'should request reasoning');
    assert.ok(prompt.includes('"summary"'), 'should request summary');
    assert.ok(prompt.includes('ACROSS THE ENTIRE DIALOGUE'), 'should frame as whole-dialogue assessment');
  });

  it('learner holistic prompt requests 1-5 scores in the same JSON format', () => {
    const prompt = buildLearnerHolisticEvaluationPrompt({
      turns: [{ tutorMessage: 'Hello', learnerMessage: 'Hi' }],
      scenarioName: 'Test',
    });
    assert.ok(prompt.includes('Score each dimension from 1-5'), 'should use same 1-5 scale');
    assert.ok(prompt.includes('"score"'), 'should show same JSON example with score field');
    assert.ok(prompt.includes('"reasoning"'), 'should request reasoning');
    assert.ok(prompt.includes('"summary"'), 'should request summary');
    assert.ok(prompt.includes('ACROSS THE ENTIRE DIALOGUE'), 'should frame as whole-dialogue assessment');
  });

  // ── Each holistic prompt evaluates only its own agent ──────────────────

  it('tutor holistic prompt evaluates the TUTOR, not the learner', () => {
    const prompt = buildTutorHolisticEvaluationPrompt({
      turns: [{ tutorMessage: 'Hello', learnerMessage: 'Hi' }],
      scenarioName: 'Test',
    });
    assert.ok(prompt.includes("evaluate the TUTOR's quality"), 'should target tutor');
    assert.ok(prompt.includes('NOT evaluating individual turns'), 'should not evaluate turns');
  });

  it('learner holistic prompt evaluates the LEARNER, not the tutor', () => {
    const prompt = buildLearnerHolisticEvaluationPrompt({
      turns: [{ tutorMessage: 'Hello', learnerMessage: 'Hi' }],
      scenarioName: 'Test',
    });
    assert.ok(prompt.includes("evaluate the LEARNER's quality"), 'should target learner');
    assert.ok(prompt.includes('NOT evaluating the tutor'), 'should not evaluate tutor');
  });
});
