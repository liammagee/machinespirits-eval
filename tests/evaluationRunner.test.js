/**
 * Tests for evaluationRunner — ensures factorial cell configurations
 * are properly resolved and passed to the tutor API.
 *
 * These tests verify that:
 * 1. Multi-agent cells enable dialogue with correct round counts
 * 2. Recognition cells use recognition-enhanced prompts (mapped to 'recognition' profile)
 * 3. Single-agent cells disable dialogue
 * 4. Profile remapping preserves dialogue and recognition settings
 *
 * Tests the exported resolveEvalProfile() function directly, avoiding the
 * need to mock ESM modules or make real API calls.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveEvalProfile } from '../services/evaluationRunner.js';

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
