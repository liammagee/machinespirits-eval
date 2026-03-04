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
  buildLearnerHolisticEvaluationPrompt,
  buildBatchedLearnerPrompt,
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

  it('contains all 5 expected dimensions (v2.2 consolidation)', () => {
    const rubric = loadLearnerRubric({ forceReload: true });
    const keys = Object.keys(rubric.dimensions);
    assert.ok(keys.includes('engagement_quality'));
    assert.ok(keys.includes('learner_authenticity'));
    assert.ok(keys.includes('revision_signals'));
    assert.ok(keys.includes('conceptual_progression'));
    assert.ok(keys.includes('metacognitive_awareness'));
    // Removed in v2.2
    assert.ok(!keys.includes('question_quality'), 'question_quality removed in v2.2');
    assert.ok(!keys.includes('conceptual_engagement'), 'conceptual_engagement removed in v2.2');
    assert.ok(!keys.includes('persona_consistency'), 'persona_consistency removed in v2.2');
    assert.ok(!keys.includes('metacognitive_development'), 'metacognitive_development renamed in v2.2');
    assert.ok(!keys.includes('deliberation_depth'), 'deliberation_depth should not be in learner rubric');
    assert.strictEqual(keys.length, 5);
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
  it('returns 5 dimensions for all architectures (v2.2 consolidation)', () => {
    const multiDims = getLearnerDimensions({ isMultiAgent: true });
    const singleDims = getLearnerDimensions({ isMultiAgent: false });
    assert.strictEqual(Object.keys(multiDims).length, 5);
    assert.strictEqual(Object.keys(singleDims).length, 5);
    assert.ok(!('deliberation_depth' in multiDims));
    assert.ok(!('deliberation_depth' in singleDims));
    assert.ok('engagement_quality' in multiDims);
    assert.ok('conceptual_progression' in multiDims);
    assert.ok('metacognitive_awareness' in multiDims);
  });

  it('returns same dimensions regardless of isMultiAgent flag', () => {
    const multi = getLearnerDimensions({ isMultiAgent: true });
    const single = getLearnerDimensions({ isMultiAgent: false });
    assert.deepStrictEqual(Object.keys(multi), Object.keys(single));
  });

  it('defaults to 5 dimensions when no options provided', () => {
    const dims = getLearnerDimensions();
    assert.strictEqual(Object.keys(dims).length, 5);
    assert.ok(!('deliberation_depth' in dims));
  });

  it('does not mutate the cached rubric', () => {
    getLearnerDimensions({ isMultiAgent: false });
    const multiDims = getLearnerDimensions({ isMultiAgent: true });
    assert.strictEqual(Object.keys(multiDims).length, 5);
    assert.ok('learner_authenticity' in multiDims);
  });
});

// ============================================================================
// calculateLearnerOverallScore
// ============================================================================

describe('calculateLearnerOverallScore', () => {
  const approxEqual = (actual, expected, msg) => {
    assert.ok(Math.abs(actual - expected) < 0.01, `${msg || 'approxEqual'}: expected ~${expected}, got ${actual}`);
  };

  it('returns ~100 when all scores are 5', () => {
    const scores = {
      engagement_quality: { score: 5, reasoning: 'test' },
      learner_authenticity: { score: 5, reasoning: 'test' },
      revision_signals: { score: 5, reasoning: 'test' },
      conceptual_progression: { score: 5, reasoning: 'test' },
      metacognitive_awareness: { score: 5, reasoning: 'test' },
    };
    const result = calculateLearnerOverallScore(scores, true);
    approxEqual(result, 100);
  });

  it('returns 0 when all scores are 1', () => {
    const scores = {
      engagement_quality: { score: 1, reasoning: 'test' },
      learner_authenticity: { score: 1, reasoning: 'test' },
      revision_signals: { score: 1, reasoning: 'test' },
      conceptual_progression: { score: 1, reasoning: 'test' },
      metacognitive_awareness: { score: 1, reasoning: 'test' },
    };
    const result = calculateLearnerOverallScore(scores, true);
    approxEqual(result, 0);
  });

  it('returns ~50 when all scores are 3 (midpoint)', () => {
    const scores = {
      engagement_quality: { score: 3, reasoning: 'test' },
      learner_authenticity: { score: 3, reasoning: 'test' },
      revision_signals: { score: 3, reasoning: 'test' },
      conceptual_progression: { score: 3, reasoning: 'test' },
      metacognitive_awareness: { score: 3, reasoning: 'test' },
    };
    const result = calculateLearnerOverallScore(scores, true);
    approxEqual(result, 50);
  });

  it('returns same result for multi-agent and single-agent (same dimensions now)', () => {
    const scores = {
      engagement_quality: { score: 4, reasoning: 'test' },
      learner_authenticity: { score: 4, reasoning: 'test' },
      revision_signals: { score: 4, reasoning: 'test' },
      conceptual_progression: { score: 4, reasoning: 'test' },
      metacognitive_awareness: { score: 4, reasoning: 'test' },
    };
    const multiResult = calculateLearnerOverallScore(scores, true);
    const singleResult = calculateLearnerOverallScore(scores, false);
    approxEqual(multiResult, singleResult, 'same scores should produce same result');
    approxEqual(multiResult, 75); // (4-1)/4 * 100 = 75
  });

  it('ignores deliberation_depth if provided (no longer in rubric)', () => {
    const scores = {
      engagement_quality: { score: 5, reasoning: 'test' },
      learner_authenticity: { score: 5, reasoning: 'test' },
      revision_signals: { score: 5, reasoning: 'test' },
      conceptual_progression: { score: 5, reasoning: 'test' },
      metacognitive_awareness: { score: 5, reasoning: 'test' },
      deliberation_depth: { score: 1, reasoning: 'should be ignored' },
    };
    // deliberation_depth not in rubric dims, so it's skipped → all 5s → ~100
    const result = calculateLearnerOverallScore(scores, false);
    approxEqual(result, 100);
  });

  it('handles plain number scores (not {score, reasoning} objects)', () => {
    const scores = {
      engagement_quality: 4,
      learner_authenticity: 4,
      revision_signals: 4,
      conceptual_progression: 4,
      metacognitive_awareness: 4,
    };
    const result = calculateLearnerOverallScore(scores, false);
    approxEqual(result, 75); // (4-1)/4 * 100 = 75
  });

  it('returns null when no scores provided', () => {
    const result = calculateLearnerOverallScore({}, false);
    assert.strictEqual(result, null);
  });

  it('skips invalid scores (out of 1-5 range)', () => {
    const scores = {
      engagement_quality: { score: 0, reasoning: 'invalid' },
      learner_authenticity: { score: 6, reasoning: 'invalid' },
      revision_signals: { score: 3, reasoning: 'valid' },
      conceptual_progression: { score: 3, reasoning: 'valid' },
      metacognitive_awareness: { score: 3, reasoning: 'valid' },
    };
    const result = calculateLearnerOverallScore(scores, false);
    // Only the three valid scores (all 3s) count → ~50
    approxEqual(result, 50);
  });

  it('correctly applies weights for mixed scores', () => {
    // v2.2 weights: engagement_quality=0.25, learner_authenticity=0.25,
    //               revision_signals=0.20, conceptual_progression=0.20,
    //               metacognitive_awareness=0.10
    const scores = {
      engagement_quality: { score: 5, reasoning: '' }, // 0.25
      learner_authenticity: { score: 5, reasoning: '' }, // 0.25
      revision_signals: { score: 1, reasoning: '' }, // 0.20
      conceptual_progression: { score: 5, reasoning: '' }, // 0.20
      metacognitive_awareness: { score: 5, reasoning: '' }, // 0.10
    };
    // High dims (0.25+0.25+0.20+0.10 = 0.80): score 5
    // Low dims (0.20): score 1
    // weighted avg = (5*0.80 + 1*0.20) / 1.0 = 4.20
    // overall = (4.20 - 1) / 4 * 100 = 80
    const result = calculateLearnerOverallScore(scores, true);
    approxEqual(result, 80);
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

  it('includes all 5 v2.2 dimension keys', () => {
    const prompt = buildLearnerEvaluationPrompt({
      turns: sampleTurns,
      targetTurnIndex: 2,
      learnerArchitecture: 'multi_agent',
    });

    assert.ok(prompt.includes('engagement_quality'));
    assert.ok(prompt.includes('learner_authenticity'));
    assert.ok(prompt.includes('revision_signals'));
    assert.ok(prompt.includes('conceptual_progression'));
    assert.ok(prompt.includes('metacognitive_awareness'));
    // Removed v2.1 dimensions should not appear as dimension keys in the prompt
    // Note: metacognitive_development may appear in calibration prose (not as a key)
    assert.ok(!prompt.includes('key: question_quality'));
    assert.ok(!prompt.includes('key: conceptual_engagement'));
    assert.ok(!prompt.includes('key: persona_consistency'));
    assert.ok(!prompt.includes('key: metacognitive_development'));
    // deliberation_depth moved to dedicated deliberation rubric
    assert.ok(!prompt.includes('deliberation_depth'));
  });

  it('same dimensions for unified learner (no conditional dimension)', () => {
    const prompt = buildLearnerEvaluationPrompt({
      turns: sampleTurns,
      targetTurnIndex: 2,
      learnerArchitecture: 'unified',
    });

    assert.ok(prompt.includes('engagement_quality'));
    assert.ok(prompt.includes('learner_authenticity'));
    assert.ok(!prompt.includes('deliberation_depth'));
    assert.ok(!prompt.includes('OMIT'));
  });

  it('does not include internal deliberation (scored separately in deliberation rubric)', () => {
    const prompt = buildLearnerEvaluationPrompt({
      turns: sampleTurns,
      targetTurnIndex: 2,
      learnerArchitecture: 'multi_agent',
    });

    // No deliberation content rendered in transcript (ego/superego traces)
    assert.ok(!prompt.includes('Ego (initial reaction)'));
    assert.ok(!prompt.includes('Superego (critique)'));
    assert.ok(!prompt.includes('Ego (revision)'));
    assert.ok(prompt.includes('external message only'));
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

  it('strips think blocks from learner prompts before scoring', () => {
    const turns = [
      {
        turnNumber: 0,
        phase: 'learner',
        externalMessage: '<think>private chain</think> Visible learner opener.',
      },
      {
        turnNumber: 1,
        phase: 'tutor',
        externalMessage: '<think>private tutor chain</think> Visible tutor reply.',
      },
      {
        turnNumber: 1,
        phase: 'learner',
        externalMessage: '<think>private learner chain</think> Visible learner follow-up.',
      },
    ];

    const prompt = buildLearnerEvaluationPrompt({
      turns,
      targetTurnIndex: 2,
      learnerArchitecture: 'unified',
    });

    assert.ok(prompt.includes('Visible learner opener.'));
    assert.ok(prompt.includes('Visible tutor reply.'));
    assert.ok(prompt.includes('Visible learner follow-up.'));
    assert.ok(!prompt.includes('<think>'));
    assert.ok(!prompt.includes('private chain'));
    assert.ok(!prompt.includes('private tutor chain'));
    assert.ok(!prompt.includes('private learner chain'));
  });

  it('recognizes psychodynamic as multi-agent (same 5 dimensions)', () => {
    const prompt = buildLearnerEvaluationPrompt({
      turns: sampleTurns,
      targetTurnIndex: 2,
      learnerArchitecture: 'psychodynamic',
    });

    // psychodynamic is treated as multi-agent — same 5 dims, no deliberation_depth
    assert.ok(prompt.includes('engagement_quality'));
    assert.ok(prompt.includes('learner_authenticity'));
    assert.ok(prompt.includes('metacognitive_awareness'));
    assert.ok(!prompt.includes('deliberation_depth'));
  });
});

// ============================================================================
// buildLearnerHolisticEvaluationPrompt
// ============================================================================

describe('buildLearnerHolisticEvaluationPrompt', () => {
  const sampleTurns = [
    {
      turnNumber: 0,
      phase: 'tutor',
      externalMessage: 'Let us examine what dialectics means in this text.',
    },
    {
      turnNumber: 1,
      phase: 'learner',
      externalMessage: 'I thought it just meant arguing two sides.',
      internalDeliberation: [
        { role: 'ego_initial', content: 'I am still thinking in debate terms.' },
        { role: 'superego', content: 'You are flattening the concept; push on transformation.' },
        { role: 'ego_revision', content: 'Maybe the point is that both sides change.' },
      ],
    },
    {
      turnNumber: 1,
      phase: 'tutor',
      externalMessage: 'Good. How would that change your original view?',
    },
  ];

  it('includes public transcript and trajectory framing', () => {
    const prompt = buildLearnerHolisticEvaluationPrompt({
      turns: sampleTurns,
      personaId: 'productive_struggler',
      learnerArchitecture: 'multi_agent',
      scenarioName: 'Misconception Correction',
      topic: 'Dialectics',
    });

    assert.ok(prompt.includes('PUBLIC DIALOGUE TRANSCRIPT'));
    assert.ok(prompt.includes('ACROSS THE ENTIRE DIALOGUE'));
    assert.ok(prompt.includes('productive_struggler'));
    assert.ok(prompt.includes('Misconception Correction'));
    assert.ok(prompt.includes('Dialectics'));
  });

  it('does not include deliberation_depth or internal traces (scored separately)', () => {
    const prompt = buildLearnerHolisticEvaluationPrompt({
      turns: sampleTurns,
      learnerArchitecture: 'multi_agent',
    });

    assert.ok(!prompt.includes('deliberation_depth'));
    assert.ok(!prompt.includes('Internal deliberation:'));
    assert.ok(!prompt.includes('Superego (critique)'));
    assert.ok(prompt.includes('external messages only'));
  });

  it('strips think blocks from holistic learner prompts', () => {
    const prompt = buildLearnerHolisticEvaluationPrompt({
      turns: [
        {
          turnNumber: 0,
          phase: 'tutor',
          externalMessage: '<think>private tutor chain</think> Visible tutor message.',
        },
        {
          turnNumber: 1,
          phase: 'learner',
          externalMessage: '<think>private learner chain</think> Visible learner message.',
        },
      ],
      learnerArchitecture: 'unified',
    });

    assert.ok(prompt.includes('Visible tutor message.'));
    assert.ok(prompt.includes('Visible learner message.'));
    assert.ok(!prompt.includes('<think>'));
    assert.ok(!prompt.includes('private tutor chain'));
    assert.ok(!prompt.includes('private learner chain'));
  });

  it('same dimensions for unified learners (no conditional dimension)', () => {
    const prompt = buildLearnerHolisticEvaluationPrompt({
      turns: sampleTurns,
      learnerArchitecture: 'unified',
    });

    assert.ok(!prompt.includes('deliberation_depth'));
    assert.ok(!prompt.includes('OMIT'));
  });
});

// ============================================================================
// Example score variation (regression: uniform examples cause Codex echo)
// ============================================================================

describe('example score variation in prompts', () => {
  const sampleTurns = [
    {
      turnNumber: 1,
      externalMessage: 'I think I understand the concept.',
      internalDeliberation: null,
    },
    {
      turnNumber: 2,
      externalMessage: 'Can you explain the relationship between X and Y?',
      internalDeliberation: null,
    },
  ];

  it('buildLearnerEvaluationPrompt uses non-numeric placeholder scores', () => {
    const prompt = buildLearnerEvaluationPrompt({
      targetTurnIndex: 0,
      turns: sampleTurns,
      learnerArchitecture: 'unified',
    });
    assert.ok(prompt.includes('"score": 0'), 'should use 0 as placeholder score (outside valid 1-5 range)');
    assert.ok(!prompt.includes('"Brief reason"'), 'should not use old "Brief reason" placeholder');
  });

  it('buildLearnerHolisticEvaluationPrompt uses non-numeric placeholder scores', () => {
    const prompt = buildLearnerHolisticEvaluationPrompt({
      turns: sampleTurns,
      learnerArchitecture: 'unified',
    });
    assert.ok(prompt.includes('"score": 0'), 'should use 0 as placeholder score (outside valid 1-5 range)');
    assert.ok(!prompt.includes('"Brief reason"'), 'should not use old "Brief reason" placeholder');
  });

  it('buildBatchedLearnerPrompt uses non-numeric placeholder scores', () => {
    const prompt = buildBatchedLearnerPrompt({
      turns: sampleTurns,
      learnerTurnTargets: [{ lt: 0, targetIdx: 0 }],
      learnerArchitecture: 'unified',
    });
    assert.ok(prompt.includes('"score": 0'), 'should use 0 as placeholder score (outside valid 1-5 range)');
  });
});
