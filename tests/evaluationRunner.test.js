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
import {
  resolveEvalProfile,
  flattenConversationHistory,
  isTransientEvaluationError,
  getCliJudgeModelLabel,
  normalizeCliJudgeEvaluation,
  flattenNumericScores,
  parseCliJudgeJsonResponse,
} from '../services/evaluationRunner.js';

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

describe('getCliJudgeModelLabel', () => {
  it('formats codex CLI labels for preserve-history rejudge deduping', () => {
    assert.strictEqual(getCliJudgeModelLabel('codex', 'gpt-5'), 'codex-cli/gpt-5');
    assert.strictEqual(getCliJudgeModelLabel('codex'), 'codex-cli/auto');
  });

  it('formats gemini and claude CLI labels consistently', () => {
    assert.strictEqual(getCliJudgeModelLabel('gemini', 'gemini-2.5-pro'), 'gemini-cli/gemini-2.5-pro');
    assert.strictEqual(getCliJudgeModelLabel('gemini'), 'gemini-cli/auto');
    assert.strictEqual(getCliJudgeModelLabel('claude', 'claude-opus-4-6'), 'claude-code/claude-opus-4-6');
    assert.strictEqual(getCliJudgeModelLabel('claude'), 'claude-opus-4.6');
  });

  it('rejects unsupported CLI judges', () => {
    assert.throws(() => getCliJudgeModelLabel('foobar'), /Unsupported judge CLI/);
  });
});

describe('CLI judge normalization', () => {
  it('parses the final JSON block when CLI stdout echoes the prompt first', () => {
    const parsed = parseCliJudgeJsonResponse(`
[2026-03-04T05:31:25] User instructions:
\`\`\`json
{"type":"review","title":"Echoed prompt object"}
\`\`\`

[2026-03-04T05:31:39] codex
\`\`\`json
{"scores":{"perception_quality":{"score":4,"reasoning":"ok"}},"overall_score":80,"summary":"Final answer"}
\`\`\`
`);

    assert.deepStrictEqual(parsed, {
      scores: { perception_quality: { score: 4, reasoning: 'ok' } },
      overall_score: 80,
      summary: 'Final answer',
    });
  });

  it('accepts direct top-level dimension keys from CLI judges', () => {
    const result = normalizeCliJudgeEvaluation(
      {
        perception_quality: { score: 4, reasoning: 'Attends to learner state.' },
        pedagogical_craft: { score: 3, reasoning: 'Some scaffold.' },
        recognition_quality: { score: 2, reasoning: 'Limited agency.' },
        validation: {
          passes_required: false,
          required_missing: ['example'],
          passes_forbidden: true,
          forbidden_found: [],
        },
        overall_score: 61,
        summary: 'Adequate but limited.',
      },
      'codex-cli/auto',
      1200,
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.judgeModel, 'codex-cli/auto');
    assert.strictEqual(result.scores.perception_quality.score, 4);
    assert.strictEqual(result.scores.pedagogical_craft.score, 3);
    assert.strictEqual(result.scores.recognition_quality.score, 2);
    assert.strictEqual(result.passesRequired, false);
    assert.deepStrictEqual(result.requiredMissing, ['example']);
    assert.ok(result.overallScore != null, 'should compute or preserve an overall score');
  });

  it('fails clearly when parsed CLI JSON has no usable scores', () => {
    const result = normalizeCliJudgeEvaluation(
      {
        summary: 'Looks reasonable.',
        notes: ['no structured rubric provided'],
      },
      'codex-cli/auto',
      900,
    );

    assert.strictEqual(result.success, false);
    assert.match(result.error, /without usable scores or overall_score/i);
  });
});

describe('flattenNumericScores', () => {
  it('keeps dynamic rubric dimensions instead of only legacy ones', () => {
    assert.deepStrictEqual(
      flattenNumericScores({
        perception_quality: { score: 4, reasoning: 'ok' },
        pedagogical_craft: { score: '3', reasoning: 'ok' },
        recognition_quality: 2,
      }),
      {
        perception_quality: 4,
        pedagogical_craft: 3,
        recognition_quality: 2,
      },
    );
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
    const history = [{ suggestion: { message: 'Welcome!' } }];
    const flat = flattenConversationHistory(history);
    assert.deepStrictEqual(flat, [{ role: 'tutor', content: 'Welcome!' }]);
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
    const history = [{ suggestion: { message: 'tutor says this' }, learnerMessage: 'learner says that' }];
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
    const history = [{ suggestion: {}, learnerMessage: 'A reply' }];
    const flat = flattenConversationHistory(history);
    assert.strictEqual(flat[0].content, '', 'empty suggestion.message should default to empty string');
    assert.strictEqual(flat[1].content, 'A reply');
  });
});

describe('isTransientEvaluationError', () => {
  it('treats fetch-level transport failures as transient', () => {
    assert.strictEqual(isTransientEvaluationError('fetch failed'), true);
    assert.strictEqual(isTransientEvaluationError('TypeError: fetch failed'), true);
  });

  it('treats rate limits and timeout/network failures as transient', () => {
    assert.strictEqual(isTransientEvaluationError('429 Too Many Requests'), true);
    assert.strictEqual(isTransientEvaluationError('ETIMEDOUT while calling provider'), true);
    assert.strictEqual(isTransientEvaluationError('socket hang up'), true);
  });

  it('does not classify deterministic config errors as transient', () => {
    assert.strictEqual(isTransientEvaluationError('Scenario not found: bad_id'), false);
    assert.strictEqual(isTransientEvaluationError('Invalid profile configuration'), false);
  });
});

// --- storeRejudgment column propagation ---
import { storeRejudgment, getResultById, createRun, updateResultScores } from '../services/evaluationStore.js';

describe('storeRejudgment column propagation', () => {
  // Create a shared test run once
  let testRunId;

  function makeOriginalResult(overrides = {}) {
    return {
      runId: testRunId,
      scenarioId: 'test-scenario',
      scenarioName: 'Test Scenario',
      scenarioType: 'suggestion',
      provider: 'openrouter',
      model: 'test-model',
      profileName: 'cell_80_base_single_unified',
      hyperparameters: {},
      promptId: 'test-prompt',
      egoModel: 'test-ego',
      superegoModel: null,
      suggestions: ['suggestion1'],
      rawResponse: 'raw response text',
      latencyMs: 100,
      inputTokens: 50,
      outputTokens: 50,
      cost: 0.001,
      dialogueRounds: 3,
      deliberationRounds: null,
      apiCalls: 1,
      dialogueId: 'dlg-test',
      factorRecognition: 0,
      factorMultiAgentTutor: 0,
      factorMultiAgentLearner: 0,
      learnerArchitecture: 'unified',
      conversationMode: null,
      dialogueContentHash: null,
      configHash: null,
      tutorEgoPromptVersion: null,
      tutorSuperegoPromptVersion: null,
      learnerPromptVersion: null,
      promptContentHash: null,
      ...overrides,
    };
  }

  function makeEvaluation(overrides = {}) {
    return {
      overallScore: 4.0,
      tutorFirstTurnScore: 4.0,
      scores: { relevance: 4, specificity: 3 },
      baseScore: null,
      recognitionScore: null,
      passesRequired: true,
      passesForbidden: true,
      requiredMissing: [],
      forbiddenFound: [],
      judgeModel: 'test-judge',
      summary: 'Good response',
      judgeLatencyMs: 200,
      ...overrides,
    };
  }

  // Ensure a run exists for the test rows
  it('setup: create test run', () => {
    const run = createRun({ description: 'storeRejudgment propagation test' });
    testRunId = run.id;
    assert.ok(testRunId, 'test run should be created');
  });

  it('copies conversation_mode from original result', () => {
    const original = makeOriginalResult({ conversationMode: 'messages' });
    const newId = storeRejudgment(original, makeEvaluation());
    const stored = getResultById(newId);
    assert.strictEqual(stored.conversationMode, 'messages', 'conversation_mode should be propagated from original');
  });

  it('copies dialogue_content_hash from original result', () => {
    const hash = 'abc123def456';
    const original = makeOriginalResult({ dialogueContentHash: hash });
    const newId = storeRejudgment(original, makeEvaluation());
    const stored = getResultById(newId);
    assert.strictEqual(stored.dialogueContentHash, hash, 'dialogue_content_hash should be propagated from original');
  });

  it('copies config_hash from original result', () => {
    const hash = 'cfg-hash-789';
    const original = makeOriginalResult({ configHash: hash });
    const newId = storeRejudgment(original, makeEvaluation());
    const stored = getResultById(newId);
    assert.strictEqual(stored.configHash, hash, 'config_hash should be propagated from original');
  });

  it('handles null conversation_mode gracefully', () => {
    const original = makeOriginalResult({ conversationMode: null });
    const newId = storeRejudgment(original, makeEvaluation());
    const stored = getResultById(newId);
    assert.strictEqual(stored.conversationMode, null, 'null conversation_mode should be stored as null');
  });

  // --- Cross-judge safety invariants ---
  // These tests verify that rejudge operations cannot destroy scores from a different judge.

  it('storeRejudgment preserves original row when creating a new row', () => {
    // When rejudge creates a new row (correct path), the original must remain untouched
    const original = makeOriginalResult();
    // Create the "original" Sonnet-judged row
    const sonnetId = storeRejudgment(original, makeEvaluation({ judgeModel: 'claude-code/sonnet' }));

    // Now rejudge with codex — should create a NEW row
    const sonnetRow = getResultById(sonnetId);
    const codexId = storeRejudgment(sonnetRow, makeEvaluation({ judgeModel: 'codex-cli/auto' }));

    // Original Sonnet row still exists with its judge
    const originalAfter = getResultById(sonnetId);
    assert.ok(originalAfter, 'original row must still exist');
    assert.strictEqual(
      originalAfter.judgeModel,
      'claude-code/sonnet',
      'original row judge_model must not change after storeRejudgment',
    );

    // New row has the codex judge
    const codexRow = getResultById(codexId);
    assert.strictEqual(codexRow.judgeModel, 'codex-cli/auto', 'new rejudge row should have the target judge label');
    assert.notStrictEqual(sonnetId, codexId, 'rejudge must create a distinct row');
  });

  it('updateResultScores overwrites judge_model — this is the danger the guard prevents', () => {
    // This test documents the dangerous behavior: updateResultScores changes
    // judge_model in-place. The rejudgeRun() cross-judge guard prevents this
    // from being called on rows belonging to a different judge.
    const original = makeOriginalResult();
    const rowId = storeRejudgment(original, makeEvaluation({ judgeModel: 'claude-code/sonnet' }));

    // Simulate the dangerous overwrite path
    updateResultScores(rowId, makeEvaluation({ judgeModel: 'codex-cli/auto' }));
    const row = getResultById(rowId);
    assert.strictEqual(
      row.judgeModel,
      'codex-cli/auto',
      'updateResultScores DOES overwrite judge_model (this is why the guard exists)',
    );
  });

  it('getCliJudgeModelLabel returns distinct labels for each CLI backend', () => {
    // Different CLI judges must produce different labels so the guard can distinguish them
    const codex = getCliJudgeModelLabel('codex');
    const gemini = getCliJudgeModelLabel('gemini');
    const claude = getCliJudgeModelLabel('claude');
    assert.notStrictEqual(codex, gemini, 'codex and gemini labels must differ');
    assert.notStrictEqual(codex, claude, 'codex and claude labels must differ');
    assert.notStrictEqual(gemini, claude, 'gemini and claude labels must differ');
  });
});

// --- Evaluate / Rejudge scoring parity ---
// These tests verify that the rejudge multi-turn pipeline (scoreMultiTurnRejudgment)
// produces the same DB columns as the evaluate multi-turn pipeline (evaluateMultiTurnResult).
// Both are tested by scanning the source code for DB write calls.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('evaluate / rejudge scoring parity', () => {
  // DB update functions that write score columns.
  // Both evaluate and rejudge must call the same set for multi-turn results.
  const MULTI_TURN_DB_WRITERS = [
    'updateResultTutorScores', // per-turn tutor scores JSON, first/last/dev
    'updateResultScores', // Turn 0 legacy columns (evaluate only calls this additionally)
    'updateResultLearnerScores', // per-turn + holistic learner scores
    'updateDialogueQualityScore', // dialogue quality (public)
    'updateDialogueQualityInternalScore', // dialogue quality (internal/full)
    'updateResultTutorHolisticScores', // tutor holistic scores
    // Deliberation is gated — both sides gate identically via hasTutorSuperego / isMultiAgent
    'updateTutorDeliberationScores',
    'updateLearnerDeliberationScores',
  ];

  function extractDbWriterCalls(source) {
    const writers = new Set();
    for (const fn of MULTI_TURN_DB_WRITERS) {
      if (source.includes(`evaluationStore.${fn}(`) || source.includes(`${fn}(`)) {
        writers.add(fn);
      }
    }
    return writers;
  }

  it('scoreMultiTurnRejudgment calls all required DB writers', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'services', 'evaluationRunner.js'), 'utf-8');

    // Extract the scoreMultiTurnRejudgment function body
    const fnStart = source.indexOf('async function scoreMultiTurnRejudgment(');
    assert.ok(fnStart > 0, 'scoreMultiTurnRejudgment must exist in evaluationRunner.js');

    // Find the end by matching braces (approximate — look for next top-level function)
    const fnEnd = source.indexOf('\nasync function ', fnStart + 10);
    const fnBody = fnEnd > 0 ? source.slice(fnStart, fnEnd) : source.slice(fnStart);

    const writers = extractDbWriterCalls(fnBody);

    // These writers MUST be present in scoreMultiTurnRejudgment
    const requiredWriters = [
      'updateResultTutorScores',
      'updateResultLearnerScores',
      'updateDialogueQualityScore',
      'updateDialogueQualityInternalScore',
      'updateResultTutorHolisticScores',
      'updateTutorDeliberationScores',
      'updateLearnerDeliberationScores',
    ];

    for (const writer of requiredWriters) {
      assert.ok(writers.has(writer), `scoreMultiTurnRejudgment must call evaluationStore.${writer}()`);
    }
  });

  it('evaluate multi-turn and rejudge multi-turn write the same score columns', () => {
    const evalCliSource = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'eval-cli.js'), 'utf-8');
    const runnerSource = fs.readFileSync(path.join(__dirname, '..', 'services', 'evaluationRunner.js'), 'utf-8');

    // Extract evaluateMultiTurnResult from eval-cli.js
    const evalStart = evalCliSource.indexOf('async function evaluateMultiTurnResult(');
    assert.ok(evalStart > 0, 'evaluateMultiTurnResult must exist in eval-cli.js');
    const evalEnd = evalCliSource.indexOf('\n        async function evaluateSingle', evalStart + 10);
    const evalBody =
      evalEnd > 0 ? evalCliSource.slice(evalStart, evalEnd) : evalCliSource.slice(evalStart, evalStart + 5000);

    // Extract scoreMultiTurnRejudgment from evaluationRunner.js
    const rejStart = runnerSource.indexOf('async function scoreMultiTurnRejudgment(');
    const rejEnd = runnerSource.indexOf('\nasync function ', rejStart + 10);
    const rejBody = rejEnd > 0 ? runnerSource.slice(rejStart, rejEnd) : runnerSource.slice(rejStart);

    const evalWriters = extractDbWriterCalls(evalBody);
    const rejWriters = extractDbWriterCalls(rejBody);

    // Rejudge must have AT LEAST every writer that evaluate has (except updateResultScores
    // which evaluate uses for legacy Turn 0 columns — rejudge handles this in the outer loop)
    const evalOnly = [...evalWriters].filter((w) => !rejWriters.has(w) && w !== 'updateResultScores');
    const rejOnly = [...rejWriters].filter((w) => !evalWriters.has(w));

    assert.deepStrictEqual(
      evalOnly,
      [],
      `These DB writers are in evaluate but missing from rejudge: ${evalOnly.join(', ')}`,
    );

    // It's OK if rejudge has extra writers, but flag for review
    if (rejOnly.length > 0) {
      // Not a failure, just informational
    }
  });

  it('required multi-turn columns are all written by updateResultTutorScores', () => {
    // Verify that updateResultTutorScores writes the key tutor columns
    const storeSource = fs.readFileSync(path.join(__dirname, '..', 'services', 'evaluationStore.js'), 'utf-8');

    const fnStart = storeSource.indexOf('export function updateResultTutorScores(');
    assert.ok(fnStart > 0, 'updateResultTutorScores must exist in evaluationStore.js');
    const fnEnd = storeSource.indexOf('\nexport function ', fnStart + 10);
    const fnBody = fnEnd > 0 ? storeSource.slice(fnStart, fnEnd) : storeSource.slice(fnStart, fnStart + 1000);

    const expectedColumns = [
      'tutor_scores',
      'tutor_first_turn_score',
      'tutor_last_turn_score',
      'tutor_development_score',
    ];
    for (const col of expectedColumns) {
      assert.ok(fnBody.includes(col), `updateResultTutorScores must write column '${col}'`);
    }
  });
});
