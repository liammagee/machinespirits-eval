/**
 * Tests for pure helper functions in learnerTutorInteractionEngine.
 *
 * Tests only the exported utility functions that have no LLM dependencies.
 * The full runInteraction() and generateLearnerResponse() flows require
 * LLM calls and are better tested via integration tests.
 *
 * Uses node:test (built-in, no dependencies required).
 * Run: node --test services/__tests__/learnerTutorInteractionEngine.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  detectEmotionalState,
  detectUnderstandingLevel,
  detectTutorStrategy,
  extractTutorMessage,
  calculateMemoryDelta,
  INTERACTION_OUTCOMES,
} from '../learnerTutorInteractionEngine.js';

// ============================================================================
// INTERACTION_OUTCOMES
// ============================================================================

describe('INTERACTION_OUTCOMES', () => {
  it('contains all expected outcome types', () => {
    assert.strictEqual(INTERACTION_OUTCOMES.BREAKTHROUGH, 'breakthrough');
    assert.strictEqual(INTERACTION_OUTCOMES.PRODUCTIVE_STRUGGLE, 'productive_struggle');
    assert.strictEqual(INTERACTION_OUTCOMES.MUTUAL_RECOGNITION, 'mutual_recognition');
    assert.strictEqual(INTERACTION_OUTCOMES.FRUSTRATION, 'frustration');
    assert.strictEqual(INTERACTION_OUTCOMES.DISENGAGEMENT, 'disengagement');
    assert.strictEqual(INTERACTION_OUTCOMES.SCAFFOLDING_NEEDED, 'scaffolding_needed');
    assert.strictEqual(INTERACTION_OUTCOMES.FADING_APPROPRIATE, 'fading_appropriate');
    assert.strictEqual(INTERACTION_OUTCOMES.TRANSFORMATION, 'transformation');
  });

  it('has exactly 8 outcomes', () => {
    assert.strictEqual(Object.keys(INTERACTION_OUTCOMES).length, 8);
  });
});

// ============================================================================
// detectEmotionalState
// ============================================================================

describe('detectEmotionalState', () => {
  it('detects frustrated state', () => {
    const delib = [{ role: 'ego', content: 'I am so frustrated, I want to give up on this confusing topic.' }];
    assert.strictEqual(detectEmotionalState(delib), 'frustrated');
  });

  it('detects engaged state from excitement', () => {
    const delib = [{ role: 'ego', content: 'This is really exciting and interesting!' }];
    assert.strictEqual(detectEmotionalState(delib), 'engaged');
  });

  it('detects engaged state from curiosity', () => {
    const delib = [{ role: 'ego', content: 'I am curious about how this works.' }];
    assert.strictEqual(detectEmotionalState(delib), 'engaged');
  });

  it('detects disengaged state', () => {
    const delib = [{ role: 'ego', content: 'I am bored with this, whatever.' }];
    assert.strictEqual(detectEmotionalState(delib), 'disengaged');
  });

  it('detects satisfied state', () => {
    const delib = [{ role: 'ego', content: 'I understand this concept now.' }];
    assert.strictEqual(detectEmotionalState(delib), 'satisfied');
  });

  it('detects confused state', () => {
    const delib = [{ role: 'ego', content: 'I am confused by the terminology.' }];
    assert.strictEqual(detectEmotionalState(delib), 'confused');
  });

  it('returns neutral when no signals found', () => {
    const delib = [{ role: 'ego', content: 'The topic at hand is dialectics.' }];
    assert.strictEqual(detectEmotionalState(delib), 'neutral');
  });

  it('combines text from multiple deliberation steps', () => {
    const delib = [
      { role: 'ego', content: 'Hmm let me think about this.' },
      { role: 'superego', content: 'This is really interesting, push deeper.' },
    ];
    // 'interesting' triggers engaged
    assert.strictEqual(detectEmotionalState(delib), 'engaged');
  });
});

// ============================================================================
// detectUnderstandingLevel
// ============================================================================

describe('detectUnderstandingLevel', () => {
  it('detects none level', () => {
    const delib = [{ role: 'ego', content: 'I am completely lost here, I have no idea what this means.' }];
    assert.strictEqual(detectUnderstandingLevel(delib), 'none');
  });

  it('detects partial level', () => {
    const delib = [{ role: 'ego', content: 'I am starting to see the pattern, maybe it works like this.' }];
    assert.strictEqual(detectUnderstandingLevel(delib), 'partial');
  });

  it('detects solid level with "makes sense"', () => {
    const delib = [{ role: 'ego', content: 'That makes sense now, I see how these ideas connect.' }];
    assert.strictEqual(detectUnderstandingLevel(delib), 'solid');
  });

  it('detects solid level with "i get it"', () => {
    const delib = [{ role: 'ego', content: 'Oh, i get it! The synthesis transforms both sides.' }];
    assert.strictEqual(detectUnderstandingLevel(delib), 'solid');
  });

  it('detects transforming level', () => {
    const delib = [{ role: 'ego', content: 'Wait, so that means the whole framework needs restructuring.' }];
    assert.strictEqual(detectUnderstandingLevel(delib), 'transforming');
  });

  it('returns developing by default', () => {
    const delib = [{ role: 'ego', content: 'I am working through the problem carefully.' }];
    assert.strictEqual(detectUnderstandingLevel(delib), 'developing');
  });
});

// ============================================================================
// detectTutorStrategy
// ============================================================================

describe('detectTutorStrategy', () => {
  it('detects socratic_questioning', () => {
    assert.strictEqual(
      detectTutorStrategy('What do you think would happen if we applied this differently?'),
      'socratic_questioning'
    );
  });

  it('detects socratic_questioning with "how might"', () => {
    assert.strictEqual(
      detectTutorStrategy('How might this concept relate to your experience?'),
      'socratic_questioning'
    );
  });

  it('detects concrete_examples', () => {
    assert.strictEqual(
      detectTutorStrategy('For example, imagine you are building a bridge.'),
      'concrete_examples'
    );
  });

  it('detects concrete_examples with "like when"', () => {
    assert.strictEqual(
      detectTutorStrategy('It is like when you first learned to ride a bicycle.'),
      'concrete_examples'
    );
  });

  it('detects scaffolding', () => {
    assert.strictEqual(
      detectTutorStrategy('Let me break this down. First, we look at the thesis.'),
      'scaffolding'
    );
  });

  it('detects validation', () => {
    assert.strictEqual(
      detectTutorStrategy("You're right, that is an important insight."),
      'validation'
    );
  });

  it('detects validation with "good observation"', () => {
    assert.strictEqual(
      detectTutorStrategy('Good observation! That connection is key.'),
      'validation'
    );
  });

  it('detects gentle_correction', () => {
    assert.strictEqual(
      detectTutorStrategy('Actually, there is an important distinction between these concepts.'),
      'gentle_correction'
    );
  });

  it('detects intellectual_challenge', () => {
    assert.strictEqual(
      detectTutorStrategy('Consider what would happen in the opposite case.'),
      'intellectual_challenge'
    );
  });

  it('returns direct_explanation as default', () => {
    assert.strictEqual(
      detectTutorStrategy('Dialectics is a philosophical framework developed by Hegel.'),
      'direct_explanation'
    );
  });
});

// ============================================================================
// extractTutorMessage
// ============================================================================

describe('extractTutorMessage', () => {
  it('returns plain text as-is', () => {
    assert.strictEqual(
      extractTutorMessage('Hello, let me help you understand this concept.'),
      'Hello, let me help you understand this concept.'
    );
  });

  it('extracts message from JSON array (tutor suggestion format)', () => {
    const json = JSON.stringify([{ message: 'This is the tutor response.' }]);
    assert.strictEqual(
      extractTutorMessage(json),
      'This is the tutor response.'
    );
  });

  it('extracts message from single JSON object', () => {
    const json = JSON.stringify({ message: 'A single suggestion.' });
    assert.strictEqual(
      extractTutorMessage(json),
      'A single suggestion.'
    );
  });

  it('returns empty string for null input', () => {
    assert.strictEqual(extractTutorMessage(null), '');
  });

  it('returns empty string for undefined input', () => {
    assert.strictEqual(extractTutorMessage(undefined), '');
  });

  it('returns empty string for empty string input', () => {
    assert.strictEqual(extractTutorMessage(''), '');
  });

  it('returns original text for invalid JSON that starts with [', () => {
    const text = '[not valid json at all';
    assert.strictEqual(extractTutorMessage(text), text);
  });

  it('returns original text for JSON array without message field', () => {
    const json = JSON.stringify([{ text: 'no message field' }]);
    assert.strictEqual(extractTutorMessage(json), json);
  });

  it('handles JSON with whitespace padding', () => {
    const json = '  ' + JSON.stringify([{ message: 'padded' }]) + '  ';
    assert.strictEqual(extractTutorMessage(json), 'padded');
  });
});

// ============================================================================
// calculateMemoryDelta
// ============================================================================

describe('calculateMemoryDelta', () => {
  it('returns noData when before is null', () => {
    const result = calculateMemoryDelta(null, { preconscious: {} });
    assert.deepStrictEqual(result, { noData: true });
  });

  it('returns noData when after is null', () => {
    const result = calculateMemoryDelta({ preconscious: {} }, null);
    assert.deepStrictEqual(result, { noData: true });
  });

  it('returns noData when both are null', () => {
    const result = calculateMemoryDelta(null, null);
    assert.deepStrictEqual(result, { noData: true });
  });

  it('calculates zero delta when nothing changed', () => {
    const state = {
      preconscious: { lessons: ['a', 'b'] },
      unconscious: { breakthroughs: ['x'], unresolvedTraumas: [] },
    };
    const result = calculateMemoryDelta(state, state);
    assert.deepStrictEqual(result, {
      newLessons: 0,
      newBreakthroughs: 0,
      newTraumas: 0,
    });
  });

  it('calculates positive deltas when items added', () => {
    const before = {
      preconscious: { lessons: ['a'] },
      unconscious: { breakthroughs: [], unresolvedTraumas: [] },
    };
    const after = {
      preconscious: { lessons: ['a', 'b', 'c'] },
      unconscious: { breakthroughs: ['x'], unresolvedTraumas: ['y'] },
    };
    const result = calculateMemoryDelta(before, after);
    assert.deepStrictEqual(result, {
      newLessons: 2,
      newBreakthroughs: 1,
      newTraumas: 1,
    });
  });

  it('handles missing nested properties gracefully', () => {
    const before = {};
    const after = {
      preconscious: { lessons: ['a'] },
      unconscious: { breakthroughs: ['b'] },
    };
    const result = calculateMemoryDelta(before, after);
    assert.deepStrictEqual(result, {
      newLessons: 1,
      newBreakthroughs: 1,
      newTraumas: 0,
    });
  });
});
