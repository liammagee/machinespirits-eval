/**
 * Tests for pure helper functions in learnerTutorInteractionEngine.
 *
 * Tests only the exported utility functions that have no LLM dependencies.
 * The full runInteraction() and generateLearnerResponse() flows require
 * LLM calls and are better tested via integration tests.
 *
 * Also includes source-scanning regression tests that verify the learner
 * ego revision prompt does not leak internal architecture terminology
 * (e.g. "SUPEREGO", "EGO:") into the learner's external-facing messages.
 *
 * Uses node:test (built-in, no dependencies required).
 * Run: node --test services/__tests__/learnerTutorInteractionEngine.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  detectEmotionalState,
  detectUnderstandingLevel,
  detectTutorStrategy,
  extractTutorMessage,
  extractExternalSection,
  generateLearnerResponse,
  sanitizeLearnerReusableText,
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
      'socratic_questioning',
    );
  });

  it('detects socratic_questioning with "how might"', () => {
    assert.strictEqual(
      detectTutorStrategy('How might this concept relate to your experience?'),
      'socratic_questioning',
    );
  });

  it('detects concrete_examples', () => {
    assert.strictEqual(detectTutorStrategy('For example, imagine you are building a bridge.'), 'concrete_examples');
  });

  it('detects concrete_examples with "like when"', () => {
    assert.strictEqual(
      detectTutorStrategy('It is like when you first learned to ride a bicycle.'),
      'concrete_examples',
    );
  });

  it('detects scaffolding', () => {
    assert.strictEqual(detectTutorStrategy('Let me break this down. First, we look at the thesis.'), 'scaffolding');
  });

  it('detects validation', () => {
    assert.strictEqual(detectTutorStrategy("You're right, that is an important insight."), 'validation');
  });

  it('detects validation with "good observation"', () => {
    assert.strictEqual(detectTutorStrategy('Good observation! That connection is key.'), 'validation');
  });

  it('detects gentle_correction', () => {
    assert.strictEqual(
      detectTutorStrategy('Actually, there is an important distinction between these concepts.'),
      'gentle_correction',
    );
  });

  it('detects intellectual_challenge', () => {
    assert.strictEqual(
      detectTutorStrategy('Consider what would happen in the opposite case.'),
      'intellectual_challenge',
    );
  });

  it('returns direct_explanation as default', () => {
    assert.strictEqual(
      detectTutorStrategy('Dialectics is a philosophical framework developed by Hegel.'),
      'direct_explanation',
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
      'Hello, let me help you understand this concept.',
    );
  });

  it('extracts message from JSON array (tutor suggestion format)', () => {
    const json = JSON.stringify([{ message: 'This is the tutor response.' }]);
    assert.strictEqual(extractTutorMessage(json), 'This is the tutor response.');
  });

  it('extracts message from single JSON object', () => {
    const json = JSON.stringify({ message: 'A single suggestion.' });
    assert.strictEqual(extractTutorMessage(json), 'A single suggestion.');
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
// learner output sanitization
// ============================================================================

describe('learner output sanitization', () => {
  it('extractExternalSection strips think blocks from visible learner text', () => {
    const raw = '<think>hidden chain</think> Visible learner reply.';
    assert.strictEqual(extractExternalSection(raw), 'Visible learner reply.');
  });

  it('extractExternalSection supports legacy INTERNAL/EXTERNAL format after think stripping', () => {
    const raw = '<think>draft plan</think>\n[INTERNAL]: private thoughts\n\n[EXTERNAL]: What the tutor should see';
    assert.strictEqual(extractExternalSection(raw), 'What the tutor should see');
  });

  it('extractExternalSection drops INTERNAL-only leakage', () => {
    const raw = '[INTERNAL]: private thoughts only';
    assert.strictEqual(extractExternalSection(raw), '');
  });

  it('sanitizeLearnerReusableText strips think blocks for history reuse', () => {
    assert.strictEqual(sanitizeLearnerReusableText('<think>hidden</think> Keep this part.'), 'Keep this part.');
  });

  it('generateLearnerResponse strips think blocks before reusing learner history', async () => {
    const replies = [
      { content: '<think>private opener</think> I think I partly get it.' },
      { content: '<think>private critique</think> Ask for a concrete example.' },
      { content: '<think>final hidden</think> Could you give me a concrete example?' },
    ];
    let callIndex = 0;
    const llmCalls = [];

    const llmCall = async (model, systemPrompt, messages, opts) => {
      llmCalls.push({ model, systemPrompt, messages, opts });
      return {
        ...replies[callIndex++],
        usage: { inputTokens: 10, outputTokens: 5 },
      };
    };

    const result = await generateLearnerResponse({
      tutorMessage: '<think>hidden tutor chain</think> Dialectics transforms both sides through contradiction.',
      topic: 'Dialectics',
      learnerProfile: 'ego_superego',
      personaId: 'eager_novice',
      conversationMode: 'messages',
      conversationHistory: [
        { role: 'learner', content: '<think>old learner chain</think> I thought it was a compromise.' },
        { role: 'tutor', content: '<think>old tutor chain</think> It is more transformative than that.' },
      ],
      llmCall,
    });

    assert.strictEqual(result.externalMessage, 'Could you give me a concrete example?');

    const egoInitial = result.internalDeliberation.find((entry) => entry.role === 'ego_initial');
    const egoRevision = result.internalDeliberation.find((entry) => entry.role === 'ego_revision');

    assert.ok(egoInitial?.inputMessages, 'ego initial should capture the sanitized external history');
    assert.ok(egoRevision?.inputMessages, 'ego revision should capture the sanitized reuse chain');

    const serializedInitialHistory = JSON.stringify(egoInitial.inputMessages);
    const serializedRevisionHistory = JSON.stringify(egoRevision.inputMessages);

    assert.ok(!serializedInitialHistory.includes('<think>'));
    assert.ok(!serializedRevisionHistory.includes('<think>'));
    assert.ok(serializedInitialHistory.includes('I thought it was a compromise.'));
    assert.ok(serializedInitialHistory.includes('It is more transformative than that.'));
    assert.ok(serializedRevisionHistory.includes('I think I partly get it.'));
    assert.ok(serializedRevisionHistory.includes('Ask for a concrete example.'));

    const serializedPrompts = JSON.stringify(
      llmCalls.map((call) => ({
        systemPrompt: call.systemPrompt,
        messages: call.messages,
      })),
    );
    assert.ok(!serializedPrompts.includes('hidden tutor chain'));
    assert.ok(!serializedPrompts.includes('old learner chain'));
    assert.ok(!serializedPrompts.includes('old tutor chain'));
    assert.ok(!serializedPrompts.includes('private opener'));
    assert.ok(!serializedPrompts.includes('private critique'));
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

// ============================================================================
// REGRESSION: Learner prompt must not leak architecture terminology
//
// BUG CONTEXT: The ego revision prompt used to format internal deliberation as
// "EGO: <text>" and "SUPEREGO: <text>", which leaked into the learner's
// external messages (e.g. "I hear the Superego", "The Superego is right").
// The fix replaced these with neutral labels ("Your initial reaction was",
// "Internal review feedback") and added an anti-leakage instruction.
//
// These tests scan the source code to ensure architecture terms never appear
// in prompt-construction strings.  This is a static analysis / architectural
// fitness function — it catches regression without needing LLM calls.
// ============================================================================

describe('learner prompt leakage prevention', () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const sourcePath = resolve(__dirname, '..', 'learnerTutorInteractionEngine.js');
  const source = readFileSync(sourcePath, 'utf-8');

  // Extract only the prompt-construction regions (ego revision contexts).
  // These are the template literals/strings that become the LLM system prompt.
  // We look for the egoRevisionContext variable assignments.
  const egoRevisionBlocks = [];
  const lines = source.split('\n');
  let capturing = false;
  let currentBlock = '';
  for (const line of lines) {
    if (line.includes('egoRevisionContext') && (line.includes('+=') || line.includes('= `'))) {
      capturing = true;
      currentBlock = '';
    }
    if (capturing) {
      currentBlock += line + '\n';
      // End capture when we see a line ending with `;` (statement end)
      if (line.trimEnd().endsWith('`;') || line.trimEnd().endsWith("';") || line.trimEnd().endsWith('";')) {
        egoRevisionBlocks.push(currentBlock);
        capturing = false;
      }
    }
  }

  it('finds ego revision prompt blocks in source (sanity check)', () => {
    assert.ok(
      egoRevisionBlocks.length >= 2,
      `Expected at least 2 egoRevisionContext blocks, found ${egoRevisionBlocks.length}. ` +
        'If the variable was renamed, update this test.',
    );
  });

  it('ego revision prompts do not contain "SUPEREGO" as a label', () => {
    for (const block of egoRevisionBlocks) {
      // Allow the word in comments or variable names, but not as a prompt label
      // like "The SUPEREGO's critique" or "SUPEREGO: ..."
      assert.ok(
        !/(?:The |the )SUPEREGO/.test(block) && !/SUPEREGO['"]?s?\s*(critique|feedback|review)/.test(block),
        'REGRESSION: ego revision prompt must not expose "SUPEREGO" label to learner.\n' +
          'Found in block:\n' +
          block.substring(0, 200),
      );
    }
  });

  it('ego revision prompts do not format deliberation with "EGO:" or "SUPEREGO:" labels', () => {
    for (const block of egoRevisionBlocks) {
      // Check for patterns like `${d.role.toUpperCase()}: ${d.content}` which
      // produce literal "EGO: ..." and "SUPEREGO: ..." in the prompt
      assert.ok(
        !block.includes('.toUpperCase()'),
        'REGRESSION: ego revision prompt must not use .toUpperCase() to format role labels.\n' +
          'This produces literal "EGO:" and "SUPEREGO:" in the prompt that leak into learner messages.\n' +
          'Found in block:\n' +
          block.substring(0, 200),
      );
    }
  });

  it('ego revision prompts contain anti-leakage instruction', () => {
    // At least one ego revision block should contain an instruction not to
    // reference the internal review process
    const hasAntiLeakage = egoRevisionBlocks.some(
      (block) =>
        /Do NOT include internal thoughts/.test(block) ||
        /references to any review process/.test(block) ||
        /meta-commentary/.test(block),
    );
    assert.ok(
      hasAntiLeakage,
      'REGRESSION: ego revision prompt must include anti-leakage instruction ' +
        '(e.g. "Do NOT include internal thoughts, meta-commentary, or references to any review process").',
    );
  });

  it('ego revision prompts use neutral labels for deliberation', () => {
    // Check that the neutral labels are present
    const hasNeutralLabels = egoRevisionBlocks.some(
      (block) => block.includes('Your initial reaction was') && block.includes('Internal review feedback'),
    );
    assert.ok(
      hasNeutralLabels,
      'REGRESSION: ego revision prompt should use neutral labels like ' +
        '"Your initial reaction was" and "Internal review feedback" instead of architecture terms.',
    );
  });
});
