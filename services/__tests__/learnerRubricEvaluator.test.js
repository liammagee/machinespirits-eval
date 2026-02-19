/**
 * Tests for learnerRubricEvaluator — learner-side scoring.
 *
 * Uses node:test (built-in, no dependencies required).
 * Run: node --test services/__tests__/learnerRubricEvaluator.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  loadLearnerRubric,
  getLearnerDimensions,
  calculateLearnerOverallScore,
  buildLearnerEvaluationPrompt,
} from '../learnerRubricEvaluator.js';

// ============================================================================
// loadLearnerRubric
// ============================================================================

describe('loadLearnerRubric', () => {
  it('loads and parses the learner rubric YAML', () => {
    const rubric = loadLearnerRubric({ forceReload: true });
    assert.ok(rubric, 'should return parsed rubric');
    assert.ok(rubric.dimensions, 'should have dimensions');
    assert.ok(rubric.name, 'should have name');
  });

  it('returns cached result on second call', () => {
    const first = loadLearnerRubric({ forceReload: true });
    const second = loadLearnerRubric();
    assert.strictEqual(first, second, 'should return same cached reference');
  });

  it('contains all 6 expected dimensions', () => {
    const rubric = loadLearnerRubric({ forceReload: true });
    const keys = Object.keys(rubric.dimensions);
    assert.ok(keys.includes('learner_authenticity'));
    assert.ok(keys.includes('question_quality'));
    assert.ok(keys.includes('conceptual_engagement'));
    assert.ok(keys.includes('revision_signals'));
    assert.ok(keys.includes('deliberation_depth'));
    assert.ok(keys.includes('persona_consistency'));
    assert.strictEqual(keys.length, 6);
  });

  it('each dimension has name, weight, description, and criteria', () => {
    const rubric = loadLearnerRubric({ forceReload: true });
    for (const [key, dim] of Object.entries(rubric.dimensions)) {
      assert.ok(dim.name, `${key} should have name`);
      assert.ok(typeof dim.weight === 'number', `${key} should have numeric weight`);
      assert.ok(dim.description, `${key} should have description`);
      assert.ok(dim.criteria, `${key} should have criteria`);
    }
  });

  it('weights sum to 1.0', () => {
    const rubric = loadLearnerRubric({ forceReload: true });
    const totalWeight = Object.values(rubric.dimensions).reduce((sum, dim) => sum + dim.weight, 0);
    assert.ok(Math.abs(totalWeight - 1.0) < 0.001, `weights should sum to 1.0, got ${totalWeight}`);
  });
});

// ============================================================================
// getLearnerDimensions
// ============================================================================

describe('getLearnerDimensions', () => {
  it('returns all 6 dimensions for multi-agent learners', () => {
    const dims = getLearnerDimensions({ isMultiAgent: true });
    assert.strictEqual(Object.keys(dims).length, 6);
    assert.ok('deliberation_depth' in dims);
  });

  it('returns 5 dimensions for single-agent learners (excludes deliberation_depth)', () => {
    const dims = getLearnerDimensions({ isMultiAgent: false });
    assert.strictEqual(Object.keys(dims).length, 5);
    assert.ok(!('deliberation_depth' in dims));
  });

  it('defaults to single-agent when no options provided', () => {
    const dims = getLearnerDimensions();
    assert.strictEqual(Object.keys(dims).length, 5);
    assert.ok(!('deliberation_depth' in dims));
  });

  it('does not mutate the cached rubric', () => {
    // Get single-agent dims (which deletes deliberation_depth from a copy)
    getLearnerDimensions({ isMultiAgent: false });
    // Then get multi-agent — should still have all 6
    const multiDims = getLearnerDimensions({ isMultiAgent: true });
    assert.strictEqual(Object.keys(multiDims).length, 6);
    assert.ok('deliberation_depth' in multiDims);
  });
});

// ============================================================================
// calculateLearnerOverallScore
// ============================================================================

describe('calculateLearnerOverallScore', () => {
  // Rubric weights are 0.20, 0.20, 0.20, 0.15, 0.15, 0.10 — these don't sum
  // to exactly 1.0 in IEEE 754, so use approximate comparison for score results.
  const approxEqual = (actual, expected, msg) => {
    assert.ok(Math.abs(actual - expected) < 0.01, `${msg || 'approxEqual'}: expected ~${expected}, got ${actual}`);
  };

  it('returns ~100 when all scores are 5 (multi-agent)', () => {
    const scores = {
      learner_authenticity: { score: 5, reasoning: 'test' },
      question_quality: { score: 5, reasoning: 'test' },
      conceptual_engagement: { score: 5, reasoning: 'test' },
      revision_signals: { score: 5, reasoning: 'test' },
      deliberation_depth: { score: 5, reasoning: 'test' },
      persona_consistency: { score: 5, reasoning: 'test' },
    };
    const result = calculateLearnerOverallScore(scores, true);
    approxEqual(result, 100);
  });

  it('returns 0 when all scores are 1 (multi-agent)', () => {
    const scores = {
      learner_authenticity: { score: 1, reasoning: 'test' },
      question_quality: { score: 1, reasoning: 'test' },
      conceptual_engagement: { score: 1, reasoning: 'test' },
      revision_signals: { score: 1, reasoning: 'test' },
      deliberation_depth: { score: 1, reasoning: 'test' },
      persona_consistency: { score: 1, reasoning: 'test' },
    };
    const result = calculateLearnerOverallScore(scores, true);
    approxEqual(result, 0);
  });

  it('returns ~50 when all scores are 3 (midpoint)', () => {
    const scores = {
      learner_authenticity: { score: 3, reasoning: 'test' },
      question_quality: { score: 3, reasoning: 'test' },
      conceptual_engagement: { score: 3, reasoning: 'test' },
      revision_signals: { score: 3, reasoning: 'test' },
      deliberation_depth: { score: 3, reasoning: 'test' },
      persona_consistency: { score: 3, reasoning: 'test' },
    };
    const result = calculateLearnerOverallScore(scores, true);
    approxEqual(result, 50);
  });

  it('returns ~100 when all scores are 5 (single-agent, no deliberation_depth)', () => {
    const scores = {
      learner_authenticity: { score: 5, reasoning: 'test' },
      question_quality: { score: 5, reasoning: 'test' },
      conceptual_engagement: { score: 5, reasoning: 'test' },
      revision_signals: { score: 5, reasoning: 'test' },
      persona_consistency: { score: 5, reasoning: 'test' },
    };
    const result = calculateLearnerOverallScore(scores, false);
    approxEqual(result, 100);
  });

  it('ignores deliberation_depth for single-agent even if provided', () => {
    const scores = {
      learner_authenticity: { score: 5, reasoning: 'test' },
      question_quality: { score: 5, reasoning: 'test' },
      conceptual_engagement: { score: 5, reasoning: 'test' },
      revision_signals: { score: 5, reasoning: 'test' },
      persona_consistency: { score: 5, reasoning: 'test' },
      deliberation_depth: { score: 1, reasoning: 'should be ignored' },
    };
    // Single-agent: deliberation_depth excluded, so all 5s → ~100
    const result = calculateLearnerOverallScore(scores, false);
    approxEqual(result, 100);
  });

  it('handles plain number scores (not {score, reasoning} objects)', () => {
    const scores = {
      learner_authenticity: 4,
      question_quality: 4,
      conceptual_engagement: 4,
      revision_signals: 4,
      persona_consistency: 4,
    };
    const result = calculateLearnerOverallScore(scores, false);
    approxEqual(result, 75); // (4-1)/4 * 100 = 75
  });

  it('returns 0 when no scores provided', () => {
    const result = calculateLearnerOverallScore({}, false);
    assert.strictEqual(result, 0);
  });

  it('skips invalid scores (out of 1-5 range)', () => {
    const scores = {
      learner_authenticity: { score: 0, reasoning: 'invalid' },
      question_quality: { score: 6, reasoning: 'invalid' },
      conceptual_engagement: { score: 3, reasoning: 'valid' },
      revision_signals: { score: 3, reasoning: 'valid' },
      persona_consistency: { score: 3, reasoning: 'valid' },
    };
    const result = calculateLearnerOverallScore(scores, false);
    // Only the three valid scores (all 3s) count → ~50
    approxEqual(result, 50);
  });

  it('correctly applies weights for mixed scores', () => {
    // Multi-agent: weights are 0.20, 0.20, 0.20, 0.15, 0.15, 0.10
    const scores = {
      learner_authenticity: { score: 5, reasoning: '' }, // 0.20
      question_quality: { score: 5, reasoning: '' }, // 0.20
      conceptual_engagement: { score: 5, reasoning: '' }, // 0.20
      revision_signals: { score: 1, reasoning: '' }, // 0.15
      deliberation_depth: { score: 1, reasoning: '' }, // 0.15
      persona_consistency: { score: 1, reasoning: '' }, // 0.10
    };
    // weighted avg = (5*0.20 + 5*0.20 + 5*0.20 + 1*0.15 + 1*0.15 + 1*0.10) / 1.0
    //             = 3.4
    // overall = (3.4 - 1) / 4 * 100 = 60
    const result = calculateLearnerOverallScore(scores, true);
    approxEqual(result, 60);
  });
});

// ============================================================================
// buildLearnerEvaluationPrompt
// ============================================================================

describe('buildLearnerEvaluationPrompt', () => {
  const sampleTurns = [
    {
      turnNumber: 0,
      phase: 'learner',
      externalMessage: 'I do not understand dialectics at all.',
    },
    {
      turnNumber: 1,
      phase: 'tutor',
      externalMessage: 'Let me explain — dialectics is about transformation through contradiction.',
    },
    {
      turnNumber: 1,
      phase: 'learner',
      externalMessage: 'Oh wait, so it is not just about arguing?',
      internalDeliberation: [
        { role: 'ego_initial', content: 'This is confusing but interesting.' },
        { role: 'superego', content: 'Push deeper — what exactly changed in your understanding?' },
        { role: 'ego_revision', content: 'I think I was wrong about dialectics being just arguments.' },
      ],
    },
  ];

  it('builds a prompt string containing key sections', () => {
    const prompt = buildLearnerEvaluationPrompt({
      turns: sampleTurns,
      targetTurnIndex: 2,
      personaId: 'productive_struggler',
      personaDescription: 'A student who struggles productively',
      learnerArchitecture: 'multi_agent',
      scenarioName: 'Misconception Correction',
      topic: 'Hegelian dialectics',
    });

    assert.ok(typeof prompt === 'string');
    assert.ok(prompt.includes('EVALUATION RUBRIC'));
    assert.ok(prompt.includes('LEARNER CONTEXT'));
    assert.ok(prompt.includes('DIALOGUE HISTORY'));
    assert.ok(prompt.includes('LEARNER TURN TO EVALUATE'));
    assert.ok(prompt.includes('productive_struggler'));
    assert.ok(prompt.includes('Misconception Correction'));
    assert.ok(prompt.includes('Hegelian dialectics'));
  });

  it('includes all 6 dimension keys for multi-agent', () => {
    const prompt = buildLearnerEvaluationPrompt({
      turns: sampleTurns,
      targetTurnIndex: 2,
      learnerArchitecture: 'multi_agent',
    });

    assert.ok(prompt.includes('learner_authenticity'));
    assert.ok(prompt.includes('question_quality'));
    assert.ok(prompt.includes('conceptual_engagement'));
    assert.ok(prompt.includes('revision_signals'));
    assert.ok(prompt.includes('deliberation_depth'));
    assert.ok(prompt.includes('persona_consistency'));
  });

  it('excludes deliberation_depth for unified learner', () => {
    const prompt = buildLearnerEvaluationPrompt({
      turns: sampleTurns,
      targetTurnIndex: 2,
      learnerArchitecture: 'unified',
    });

    // The dimension key should NOT appear in the JSON example section
    assert.ok(prompt.includes('learner_authenticity'));
    assert.ok(prompt.includes('OMIT the deliberation_depth dimension'));
  });

  it('includes internal deliberation section for multi-agent learners', () => {
    const prompt = buildLearnerEvaluationPrompt({
      turns: sampleTurns,
      targetTurnIndex: 2,
      learnerArchitecture: 'multi_agent',
    });

    assert.ok(prompt.includes('Internal deliberation'));
    assert.ok(prompt.includes('Ego (initial reaction)'));
    assert.ok(prompt.includes('Superego (critique)'));
    assert.ok(prompt.includes('Ego (revision'));
  });

  it('truncates transcript at targetTurnIndex (no future turns)', () => {
    const extraTurns = [
      ...sampleTurns,
      {
        turnNumber: 2,
        phase: 'tutor',
        externalMessage: 'THIS SHOULD NOT APPEAR IN PROMPT',
      },
    ];

    const prompt = buildLearnerEvaluationPrompt({
      turns: extraTurns,
      targetTurnIndex: 2, // Evaluate the learner turn at index 2
      learnerArchitecture: 'unified',
    });

    assert.ok(!prompt.includes('THIS SHOULD NOT APPEAR IN PROMPT'));
  });

  it('handles missing externalMessage gracefully', () => {
    const turns = [{ turnNumber: 0, phase: 'learner', externalMessage: null }];

    const prompt = buildLearnerEvaluationPrompt({
      turns,
      targetTurnIndex: 0,
      learnerArchitecture: 'unified',
    });

    assert.ok(prompt.includes('(no message)'));
  });

  it('recognizes psychodynamic as multi-agent', () => {
    const prompt = buildLearnerEvaluationPrompt({
      turns: sampleTurns,
      targetTurnIndex: 2,
      learnerArchitecture: 'psychodynamic',
    });

    assert.ok(prompt.includes('deliberation_depth'));
    assert.ok(prompt.includes('Score ALL dimensions including deliberation_depth'));
  });
});
