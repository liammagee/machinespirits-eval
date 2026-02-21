/**
 * Tests for evaluationRunner — ensures factorial cell configurations
 * are properly resolved and passed to the tutor API.
 *
 * These tests verify that:
 * 1. Multi-agent cells enable dialogue with correct round counts
 * 2. Recognition cells use recognition-enhanced prompts (mapped to 'recognition' profile)
 * 3. Single-agent cells disable dialogue
 * 4. Profile remapping preserves dialogue and recognition settings
 * 5. Conversation history for learner LLM preserves both tutor AND learner roles
 *
 * Tests the exported resolveEvalProfile() and flattenConversationHistory()
 * functions directly, avoiding the need to mock ESM modules or make real API calls.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveEvalProfile, flattenConversationHistory } from '../services/evaluationRunner.js';

describe('resolveEvalProfile', () => {
  // --- Recognition + Multi-agent cells (dialogue ON, recognition ON) ---

  it('cell_7 (recog+multi+unified) enables dialogue with 2 rounds', () => {
    const result = resolveEvalProfile('cell_7_recog_multi_unified');
    assert.strictEqual(result.useDialogue, true, 'dialogue should be enabled');
    assert.strictEqual(result.maxRounds, 2, 'should use 2 dialogue rounds');
  });

  it('cell_7 maps to recognition profile for prompts', () => {
    const result = resolveEvalProfile('cell_7_recog_multi_unified');
    assert.strictEqual(result.resolvedProfileName, 'recognition', 'should map to recognition profile');
    assert.strictEqual(result.recognitionMode, true, 'recognition mode should be on');
  });

  it('cell_8 (recog+multi+psycho) enables dialogue with recognition prompts', () => {
    const result = resolveEvalProfile('cell_8_recog_multi_psycho');
    assert.strictEqual(result.useDialogue, true, 'dialogue should be enabled');
    assert.strictEqual(result.maxRounds, 2, 'should use 2 dialogue rounds');
    assert.strictEqual(result.resolvedProfileName, 'recognition', 'should map to recognition profile');
    assert.strictEqual(result.recognitionMode, true);
  });

  // --- Base + Multi-agent cells (dialogue ON, recognition OFF) ---

  it('cell_3 (base+multi+unified) enables dialogue but uses standard prompts', () => {
    const result = resolveEvalProfile('cell_3_base_multi_unified');
    assert.strictEqual(result.useDialogue, true, 'dialogue should be enabled');
    assert.strictEqual(result.maxRounds, 2, 'should use 2 dialogue rounds');
    assert.strictEqual(result.resolvedProfileName, 'budget', 'should map to budget (no recognition)');
    assert.strictEqual(result.recognitionMode, false);
  });

  it('cell_4 (base+multi+psycho) enables dialogue but uses standard prompts', () => {
    const result = resolveEvalProfile('cell_4_base_multi_psycho');
    assert.strictEqual(result.useDialogue, true, 'dialogue should be enabled');
    assert.strictEqual(result.maxRounds, 2, 'should use 2 dialogue rounds');
    assert.strictEqual(result.resolvedProfileName, 'budget', 'should map to budget (no recognition)');
  });

  // --- Recognition + Single-agent cells (dialogue OFF, recognition ON) ---

  it('cell_5 (recog+single+unified) disables dialogue but uses recognition prompts', () => {
    const result = resolveEvalProfile('cell_5_recog_single_unified');
    assert.strictEqual(result.useDialogue, false, 'dialogue should be disabled');
    assert.strictEqual(result.maxRounds, 0, 'should have 0 rounds');
    assert.strictEqual(result.resolvedProfileName, 'recognition', 'should map to recognition profile');
    assert.strictEqual(result.recognitionMode, true);
  });

  it('cell_6 (recog+single+psycho) disables dialogue but uses recognition prompts', () => {
    const result = resolveEvalProfile('cell_6_recog_single_psycho');
    assert.strictEqual(result.useDialogue, false, 'dialogue should be disabled');
    assert.strictEqual(result.maxRounds, 0, 'should have 0 rounds');
    assert.strictEqual(result.resolvedProfileName, 'recognition', 'should map to recognition profile');
  });

  // --- Base + Single-agent cells (dialogue OFF, recognition OFF) ---

  it('cell_1 (base+single+unified) disables dialogue', () => {
    const result = resolveEvalProfile('cell_1_base_single_unified');
    assert.strictEqual(result.useDialogue, false, 'dialogue should be disabled');
    assert.strictEqual(result.maxRounds, 0, 'should have 0 rounds');
  });

  it('cell_1 maps to budget profile for prompts', () => {
    const result = resolveEvalProfile('cell_1_base_single_unified');
    assert.strictEqual(result.resolvedProfileName, 'budget', 'should map to budget profile');
    assert.strictEqual(result.recognitionMode, false);
  });

  it('cell_2 (base+single+psycho) disables dialogue, uses budget prompts', () => {
    const result = resolveEvalProfile('cell_2_base_single_psycho');
    assert.strictEqual(result.useDialogue, false, 'dialogue should be disabled');
    assert.strictEqual(result.maxRounds, 0, 'should have 0 rounds');
    assert.strictEqual(result.resolvedProfileName, 'budget', 'should map to budget profile');
  });

  // --- Cross-cutting: all multi-agent cells enable dialogue ---

  it('all multi-agent cells enable dialogue with 2 rounds', () => {
    const multiCells = [
      'cell_3_base_multi_unified',
      'cell_4_base_multi_psycho',
      'cell_7_recog_multi_unified',
      'cell_8_recog_multi_psycho',
    ];
    for (const cell of multiCells) {
      const result = resolveEvalProfile(cell);
      assert.strictEqual(result.useDialogue, true, `${cell} should enable dialogue`);
      assert.strictEqual(result.maxRounds, 2, `${cell} should have 2 rounds`);
    }
  });

  it('all single-agent cells disable dialogue', () => {
    const singleCells = [
      'cell_1_base_single_unified',
      'cell_2_base_single_psycho',
      'cell_5_recog_single_unified',
      'cell_6_recog_single_psycho',
    ];
    for (const cell of singleCells) {
      const result = resolveEvalProfile(cell);
      assert.strictEqual(result.useDialogue, false, `${cell} should disable dialogue`);
      assert.strictEqual(result.maxRounds, 0, `${cell} should have 0 rounds`);
    }
  });

  // --- Cross-cutting: recognition mode matches cell naming ---

  it('all recog cells enable recognition mode', () => {
    const recogCells = [
      'cell_5_recog_single_unified',
      'cell_6_recog_single_psycho',
      'cell_7_recog_multi_unified',
      'cell_8_recog_multi_psycho',
    ];
    for (const cell of recogCells) {
      const result = resolveEvalProfile(cell);
      assert.strictEqual(result.recognitionMode, true, `${cell} should have recognition mode`);
      assert.strictEqual(result.resolvedProfileName, 'recognition', `${cell} should map to recognition`);
    }
  });

  it('all base cells disable recognition mode', () => {
    const baseCells = [
      'cell_1_base_single_unified',
      'cell_2_base_single_psycho',
      'cell_3_base_multi_unified',
      'cell_4_base_multi_psycho',
    ];
    for (const cell of baseCells) {
      const result = resolveEvalProfile(cell);
      assert.strictEqual(result.recognitionMode, false, `${cell} should not have recognition mode`);
      assert.strictEqual(result.resolvedProfileName, 'budget', `${cell} should map to budget`);
    }
  });

  // --- Legacy profile names ---

  it('legacy recognition profile maps to recognition', () => {
    const result = resolveEvalProfile('recognition');
    assert.strictEqual(result.resolvedProfileName, 'recognition');
  });

  it('legacy single_baseline profile maps to budget', () => {
    const result = resolveEvalProfile('single_baseline');
    assert.strictEqual(result.resolvedProfileName, 'budget');
  });

  // --- Superego bootstrap trigger: budget profile + dialogue ON ---

  it('cell_3/4 (base+multi) resolve to budget with dialogue=true (superego bootstrap trigger)', () => {
    for (const cell of ['cell_3_base_multi_unified', 'cell_4_base_multi_psycho']) {
      const result = resolveEvalProfile(cell);
      assert.strictEqual(result.resolvedProfileName, 'budget', `${cell} should map to budget`);
      assert.strictEqual(result.useDialogue, true, `${cell} should have dialogue enabled`);
    }
  });

  it('cell_1/2 (base+single) resolve to budget with dialogue=false (no superego bootstrap)', () => {
    for (const cell of ['cell_1_base_single_unified', 'cell_2_base_single_psycho']) {
      const result = resolveEvalProfile(cell);
      assert.strictEqual(result.resolvedProfileName, 'budget', `${cell} should map to budget`);
      assert.strictEqual(result.useDialogue, false, `${cell} should have dialogue disabled`);
    }
  });

  // --- Non-eval profiles pass through unchanged ---

  it('tutor-core profile "budget" passes through unchanged', () => {
    const result = resolveEvalProfile('budget');
    assert.strictEqual(result.resolvedProfileName, 'budget');
  });

  it('unknown profile passes through unchanged', () => {
    const result = resolveEvalProfile('some_custom_profile');
    assert.strictEqual(result.resolvedProfileName, 'some_custom_profile');
    assert.strictEqual(result.useDialogue, false, 'unknown profile defaults to no dialogue');
    assert.strictEqual(result.maxRounds, 0, 'unknown profile defaults to 0 rounds');
  });
});

// ============================================================================
// flattenConversationHistory — regression prevention for multi-turn learner bug
//
// BUG CONTEXT: Prior to the fix, conversationHistory.map() was used instead of
// .flatMap(), which collapsed each paired exchange (tutor + learner) into a
// single entry — always choosing learner when present.  The learner LLM then
// saw only its own monologue and looped.  These tests ensure .flatMap() behavior
// is preserved: every exchange expands into separate tutor and learner entries.
// ============================================================================

describe('flattenConversationHistory', () => {
  it('produces alternating tutor/learner roles from paired exchanges', () => {
    const history = [
      { suggestion: { message: 'Hello student' }, learnerMessage: 'Hi tutor' },
      { suggestion: { message: 'What do you know?' }, learnerMessage: 'Not much yet' },
    ];
    const flat = flattenConversationHistory(history);
    assert.deepStrictEqual(flat, [
      { role: 'tutor', content: 'Hello student' },
      { role: 'learner', content: 'Hi tutor' },
      { role: 'tutor', content: 'What do you know?' },
      { role: 'learner', content: 'Not much yet' },
    ]);
  });

  it('includes tutor entry even when learnerMessage is absent (first exchange)', () => {
    // The first exchange may not yet have a learner reply
    const history = [
      { suggestion: { message: 'Welcome!' } },
    ];
    const flat = flattenConversationHistory(history);
    assert.deepStrictEqual(flat, [
      { role: 'tutor', content: 'Welcome!' },
    ]);
  });

  it('handles mixed complete and incomplete exchanges', () => {
    const history = [
      { suggestion: { message: 'Turn 1' }, learnerMessage: 'Reply 1' },
      { suggestion: { message: 'Turn 2' }, learnerMessage: 'Reply 2' },
      { suggestion: { message: 'Turn 3' } }, // no learner reply yet
    ];
    const flat = flattenConversationHistory(history);
    assert.strictEqual(flat.length, 5, 'should have 5 entries (3 tutor + 2 learner)');
    assert.strictEqual(flat[0].role, 'tutor');
    assert.strictEqual(flat[1].role, 'learner');
    assert.strictEqual(flat[2].role, 'tutor');
    assert.strictEqual(flat[3].role, 'learner');
    assert.strictEqual(flat[4].role, 'tutor');
  });

  it('REGRESSION: does NOT collapse paired entries into single role', () => {
    // This is the exact pattern that caused the bug: 3 complete exchanges
    // should produce 6 entries (3 tutor + 3 learner), NOT 3 entries.
    const history = [
      { suggestion: { message: 'T1' }, learnerMessage: 'L1' },
      { suggestion: { message: 'T2' }, learnerMessage: 'L2' },
      { suggestion: { message: 'T3' }, learnerMessage: 'L3' },
    ];
    const flat = flattenConversationHistory(history);
    assert.strictEqual(flat.length, 6, 'REGRESSION: must produce 6 entries, not 3');
    // Verify BOTH roles are present
    const tutorEntries = flat.filter((e) => e.role === 'tutor');
    const learnerEntries = flat.filter((e) => e.role === 'learner');
    assert.strictEqual(tutorEntries.length, 3, 'REGRESSION: tutor messages must not be dropped');
    assert.strictEqual(learnerEntries.length, 3, 'REGRESSION: learner messages must not be dropped');
  });

  it('REGRESSION: tutor content comes from suggestion.message, not learnerMessage', () => {
    // Verify tutor entries get their content from the right field
    const history = [
      { suggestion: { message: 'tutor says this' }, learnerMessage: 'learner says that' },
    ];
    const flat = flattenConversationHistory(history);
    assert.strictEqual(flat[0].content, 'tutor says this', 'tutor content must come from suggestion.message');
    assert.strictEqual(flat[1].content, 'learner says that', 'learner content must come from learnerMessage');
  });

  it('handles null/undefined input gracefully', () => {
    assert.deepStrictEqual(flattenConversationHistory(null), []);
    assert.deepStrictEqual(flattenConversationHistory(undefined), []);
    assert.deepStrictEqual(flattenConversationHistory([]), []);
  });

  it('handles entries with empty suggestion message', () => {
    const history = [
      { suggestion: {}, learnerMessage: 'A reply' },
    ];
    const flat = flattenConversationHistory(history);
    assert.strictEqual(flat[0].content, '', 'empty suggestion.message should default to empty string');
    assert.strictEqual(flat[1].content, 'A reply');
  });
});
