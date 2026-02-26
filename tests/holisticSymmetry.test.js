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
 *   - Dimension structure: same count, weights summing to 1.0, one conditional each
 *   - Prompt contract: same JSON format, same 1-5 scale, same evaluation framing
 *   - Agent targeting: each prompt evaluates only its own agent
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
  assert.ok(
    Math.abs(actual - expected) < 0.01,
    `${msg}: expected ~${expected}, got ${actual}`,
  );
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

  it('tutor holistic has a conditional dimension (recognition_depth) gated by hasRecognition', () => {
    const withRecog = getTutorHolisticDimensions({ hasRecognition: true });
    const withoutRecog = getTutorHolisticDimensions({ hasRecognition: false });

    assert.ok('recognition_depth' in withRecog, 'recognition_depth present when hasRecognition=true');
    assert.ok(!('recognition_depth' in withoutRecog), 'recognition_depth absent when hasRecognition=false');
    assert.ok('scaffolding_arc' in withRecog);
    assert.ok('scaffolding_arc' in withoutRecog);
  });

  it('learner holistic has a conditional dimension (deliberation_depth) gated by isMultiAgent', () => {
    const withMulti = getLearnerDimensions({ isMultiAgent: true });
    const withoutMulti = getLearnerDimensions({ isMultiAgent: false });

    assert.ok('deliberation_depth' in withMulti, 'deliberation_depth present when isMultiAgent=true');
    assert.ok(!('deliberation_depth' in withoutMulti), 'deliberation_depth absent when isMultiAgent=false');
    assert.ok('learner_authenticity' in withMulti);
    assert.ok('learner_authenticity' in withoutMulti);
  });

  // ── Both dimension sets have the same number of dimensions ────────────

  it('tutor and learner holistic have the same dimension count (full and reduced)', () => {
    const tutorFull = getTutorHolisticDimensions({ hasRecognition: true });
    const tutorReduced = getTutorHolisticDimensions({ hasRecognition: false });
    const learnerFull = getLearnerDimensions({ isMultiAgent: true });
    const learnerReduced = getLearnerDimensions({ isMultiAgent: false });

    assert.strictEqual(
      Object.keys(tutorFull).length,
      Object.keys(learnerFull).length,
      `full dimension count should match: tutor=${Object.keys(tutorFull).length}, learner=${Object.keys(learnerFull).length}`,
    );
    assert.strictEqual(
      Object.keys(tutorReduced).length,
      Object.keys(learnerReduced).length,
      `reduced dimension count should match: tutor=${Object.keys(tutorReduced).length}, learner=${Object.keys(learnerReduced).length}`,
    );
  });

  // ── Both dimension sets have weights summing to 1.0 ───────────────────

  it('tutor holistic dimension weights sum to 1.0', () => {
    const dims = getTutorHolisticDimensions({ hasRecognition: true });
    const totalWeight = Object.values(dims).reduce((sum, d) => sum + d.weight, 0);
    assert.ok(
      Math.abs(totalWeight - 1.0) < 0.001,
      `tutor holistic weights should sum to 1.0, got ${totalWeight}`,
    );
  });

  it('learner holistic dimension weights sum to 1.0', () => {
    const dims = getLearnerDimensions({ isMultiAgent: true });
    const totalWeight = Object.values(dims).reduce((sum, d) => sum + d.weight, 0);
    assert.ok(
      Math.abs(totalWeight - 1.0) < 0.001,
      `learner holistic weights should sum to 1.0, got ${totalWeight}`,
    );
  });

  // ── Both prompts use the same 1-5 scoring scale and JSON format ───────

  it('tutor holistic prompt requests 1-5 scores in JSON format', () => {
    const prompt = buildTutorHolisticEvaluationPrompt({
      turns: [{ tutorMessage: 'Hello', learnerMessage: 'Hi' }],
      scenarioName: 'Test',
    });
    assert.ok(prompt.includes('Score each dimension from 1-5'), 'should use 1-5 scale');
    assert.ok(prompt.includes('"score": 3'), 'should show JSON example with score field');
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
    assert.ok(prompt.includes('"score": 3'), 'should show same JSON example with score field');
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
