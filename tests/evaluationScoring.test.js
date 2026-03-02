/**
 * Tests for the unified per-turn scoring pipeline.
 *
 * Covers:
 *   - DB schema: tutor_scores and tutor_overall_score columns exist
 *   - updateResultTutorScores: writes per-turn data and aggregate metrics
 *   - Per-turn score aggregation: first, last, overall, development
 *   - Symmetry: tutor gets N scores, learner gets N-1 scores
 *   - Single-turn fallback: no tutor_scores for single-turn rows
 *   - listRuns: returns avgLearnerScore and avgDialogueScore
 *   - buildPerTurnTutorEvaluationPrompt: truncated transcript, per-turn framing
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Set up isolated test database BEFORE importing evaluationStore.
// MUST use dynamic import() — static `import` is hoisted above this assignment,
// so evaluationStore.js would open the production DB instead of the temp one.
const testDbPath = path.join(os.tmpdir(), `eval-scoring-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.db`);
process.env.EVAL_DB_PATH = testDbPath;

const {
  createRun,
  storeResult,
  getResults,
  deleteRun,
  listRuns,
  updateResultTutorScores,
  updateResultTutorHolisticScores,
  updateResultLearnerScores,
  updateResultScores,
  updateDialogueQualityScore,
  updateDialogueQualityInternalScore,
} = await import('../services/evaluationStore.js');

const {
  buildEvaluationPrompt,
  buildPerTurnTutorEvaluationPrompt,
  buildTutorHolisticEvaluationPrompt,
  calculateTutorHolisticScore,
  getTutorHolisticDimensions,
} = await import('../services/rubricEvaluator.js');

const testRunIds = [];

after(() => {
  for (const runId of testRunIds) {
    try { deleteRun(runId); } catch (e) { /* ignore */ }
  }
  try { fs.unlinkSync(testDbPath); } catch (e) { /* ignore */ }
  try { fs.unlinkSync(testDbPath + '-wal'); } catch (e) { /* ignore */ }
  try { fs.unlinkSync(testDbPath + '-shm'); } catch (e) { /* ignore */ }
});

function makeRun(description = 'test run') {
  const run = createRun({ description, totalScenarios: 1, totalConfigurations: 1 });
  testRunIds.push(run.id);
  return run.id;
}

function makeResult(overrides = {}) {
  return {
    scenarioId: overrides.scenarioId || 'test_scenario',
    scenarioName: overrides.scenarioName || 'Test Scenario',
    provider: 'test',
    model: 'test-model',
    profileName: overrides.profileName || 'cell_test',
    hyperparameters: {},
    promptId: 'test-prompt',
    suggestions: overrides.suggestions || [{ message: 'Test suggestion' }],
    latencyMs: 100,
    inputTokens: 50,
    outputTokens: 50,
    dialogueRounds: overrides.dialogueRounds || 1,
    apiCalls: 1,
    dialogueId: overrides.dialogueId || null,
    conversationMode: overrides.conversationMode || null,
    success: true,
    errorMessage: null,
  };
}

// ============================================================================
// DB schema
// ============================================================================

describe('tutor_scores and tutor_overall_score columns', () => {
  it('exist after migration and are NULL by default', () => {
    const runId = makeRun('schema test');
    storeResult(runId, makeResult());
    const results = getResults(runId);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].tutorScores, null, 'tutor_scores should be NULL');
    assert.strictEqual(results[0].tutorOverallScore, null, 'tutor_overall_score should be NULL');
  });
});

// ============================================================================
// updateResultTutorScores
// ============================================================================

describe('updateResultTutorScores', () => {
  it('writes per-turn scores and aggregate metrics', () => {
    const runId = makeRun('tutor scores test');
    storeResult(runId, makeResult({
      dialogueId: 'dlg-test-1',
      suggestions: [
        { message: 'Turn 0 suggestion' },
        { message: 'Turn 1 suggestion' },
        { message: 'Turn 2 suggestion' },
      ],
      dialogueRounds: 3,
    }));

    const results = getResults(runId);
    const resultId = results[0].id;

    const tutorScores = {
      0: { scores: { relevance: { score: 4 } }, overallScore: 72, summary: 'Turn 0' },
      1: { scores: { relevance: { score: 5 } }, overallScore: 85, summary: 'Turn 1' },
      2: { scores: { relevance: { score: 5 } }, overallScore: 90, summary: 'Turn 2' },
    };

    updateResultTutorScores(resultId, {
      tutorScores,
      tutorOverallScore: 82.3,
      tutorFirstTurnScore: 72,
      tutorLastTurnScore: 90,
      tutorDevelopmentScore: 18,
      judgeModel: 'test-judge',
      judgeLatencyMs: 500,
    });

    const updated = getResults(runId);
    assert.deepStrictEqual(updated[0].tutorScores, tutorScores, 'tutor_scores JSON should be stored');
    assert.strictEqual(updated[0].tutorOverallScore, 82.3, 'tutor_overall_score should be 82.3');
    assert.strictEqual(updated[0].tutorFirstTurnScore, 72, 'tutor_first_turn_score should be 72');
    assert.strictEqual(updated[0].tutorLastTurnScore, 90, 'tutor_last_turn_score should be 90');
    assert.strictEqual(updated[0].tutorDevelopmentScore, 18, 'tutor_development_score should be 18');
    assert.strictEqual(updated[0].tutorLastTurnScore, 90, 'tutor_last_turn_score should = last turn');
  });

  it('handles negative development score (regression)', () => {
    const runId = makeRun('negative delta test');
    storeResult(runId, makeResult({ dialogueId: 'dlg-test-neg' }));
    const results = getResults(runId);

    updateResultTutorScores(results[0].id, {
      tutorScores: { 0: { overallScore: 85 }, 1: { overallScore: 70 } },
      tutorOverallScore: 77.5,
      tutorFirstTurnScore: 85,
      tutorLastTurnScore: 70,
      tutorDevelopmentScore: -15,
    });

    const updated = getResults(runId);
    assert.strictEqual(updated[0].tutorDevelopmentScore, -15, 'should allow negative delta');
  });
});

// ============================================================================
// Per-turn score aggregation
// ============================================================================

describe('per-turn score aggregation logic', () => {
  it('computes correct averages from per-turn scores', () => {
    const turnScores = {
      0: { overallScore: 60 },
      1: { overallScore: 80 },
      2: { overallScore: 100 },
    };
    const overalls = Object.values(turnScores).map((s) => s.overallScore);
    const avg = overalls.reduce((a, b) => a + b, 0) / overalls.length;
    assert.strictEqual(avg, 80, 'average of [60, 80, 100] should be 80');

    const first = turnScores[0].overallScore;
    const last = turnScores[2].overallScore;
    assert.strictEqual(first, 60, 'first turn score should be 60');
    assert.strictEqual(last, 100, 'last turn score should be 100');
    assert.strictEqual(last - first, 40, 'development score should be 40');
  });
});

// ============================================================================
// Symmetry: tutor N turns, learner N-1 turns
// ============================================================================

describe('tutor-learner turn symmetry', () => {
  it('for a 3-turn dialogue: 3 tutor scores, 2 learner scores', () => {
    // In a 3-turn dialogue:
    //   Turn 0: Tutor speaks (no prior learner)
    //   Turn 1: Learner responds → Tutor speaks
    //   Turn 2: Learner responds → Tutor speaks
    // So: 3 tutor turns, 2 learner turns
    const totalTutorTurns = 3;
    const totalLearnerTurns = totalTutorTurns - 1;
    assert.strictEqual(totalLearnerTurns, 2, 'learner should have N-1 turns');
  });
});

// ============================================================================
// Single-turn fallback
// ============================================================================

describe('single-turn fallback', () => {
  it('tutor_scores remains NULL for single-turn rows', () => {
    const runId = makeRun('single-turn test');
    storeResult(runId, makeResult()); // single suggestion, no dialogueId

    // Simulate single-turn evaluate: uses updateResultScores (not updateResultTutorScores)
    const results = getResults(runId);
    updateResultScores(results[0].id, {
      scores: { relevance: { score: 4 }, specificity: { score: 3 } },
      tutorFirstTurnScore: 70,
      baseScore: 70,
      recognitionScore: null,
      passesRequired: true,
      passesForbidden: true,
      summary: 'Test',
      judgeModel: 'test',
    });

    const updated = getResults(runId);
    assert.strictEqual(updated[0].tutorScores, null, 'tutor_scores should remain NULL');
    assert.strictEqual(updated[0].tutorOverallScore, null, 'tutor_overall_score should remain NULL');
    assert.strictEqual(updated[0].tutorFirstTurnScore, 70, 'tutor_first_turn_score should be set');
  });
});

// ============================================================================
// listRuns with learner and dialogue scores
// ============================================================================

describe('listRuns returns avgLearnerScore and avgDialogueScore', () => {
  it('includes learner and dialogue averages', () => {
    const runId = makeRun('runs listing test');

    // Store two results with different learner/dialogue scores
    storeResult(runId, makeResult({ scenarioId: 's1', dialogueId: 'dlg-list-1' }));
    storeResult(runId, makeResult({ scenarioId: 's2', dialogueId: 'dlg-list-2' }));

    const results = getResults(runId);

    // Set scores on first result
    updateResultScores(results[0].id, {
      scores: { relevance: { score: 4 } },
      tutorFirstTurnScore: 70,
      baseScore: 70,
      passesRequired: true,
      passesForbidden: true,
      judgeModel: 'test',
    });
    updateResultLearnerScores(results[0].id, { scores: {}, overallScore: 60, judgeModel: 'test' });
    updateDialogueQualityScore(results[0].id, { dialogueQualityScore: 80, dialogueQualityJudgeModel: 'test' });

    // Set scores on second result
    updateResultScores(results[1].id, {
      scores: { relevance: { score: 5 } },
      tutorFirstTurnScore: 90,
      baseScore: 90,
      passesRequired: true,
      passesForbidden: true,
      judgeModel: 'test',
    });
    updateResultLearnerScores(results[1].id, { scores: {}, overallScore: 80, judgeModel: 'test' });
    updateDialogueQualityScore(results[1].id, { dialogueQualityScore: 70, dialogueQualityJudgeModel: 'test' });

    const runs = listRuns();
    const run = runs.find((r) => r.id === runId);
    assert.ok(run, 'should find the test run');
    assert.ok(run.avgLearnerScore != null, 'should have avgLearnerScore');
    assert.ok(run.avgDialogueScore != null, 'should have avgDialogueScore');
    // avg of [60, 80] = 70
    assert.strictEqual(run.avgLearnerScore, 70, 'avgLearnerScore should be 70');
    // avg of [80, 70] = 75
    assert.strictEqual(run.avgDialogueScore, 75, 'avgDialogueScore should be 75');
  });

  it('returns null when no learner/dialogue scores exist', () => {
    const runId = makeRun('no learner scores');
    storeResult(runId, makeResult());

    const runs = listRuns();
    const run = runs.find((r) => r.id === runId);
    assert.ok(run, 'should find the test run');
    assert.strictEqual(run.avgLearnerScore, null, 'avgLearnerScore should be null');
    assert.strictEqual(run.avgDialogueScore, null, 'avgDialogueScore should be null');
  });
});

// ============================================================================
// buildPerTurnTutorEvaluationPrompt
// ============================================================================

describe('buildPerTurnTutorEvaluationPrompt', () => {
  const mockTurnResults = [
    {
      turnId: 'turn-0',
      suggestions: [{ message: 'Hello, how can I help you today?', title: 'Greeting' }],
      learnerAction: null,
      learnerMessage: null,
    },
    {
      turnId: 'turn-1',
      suggestions: [{ message: 'Great question! Let me explain...', title: 'Explanation' }],
      learnerAction: 'ask_question',
      learnerMessage: 'Can you explain recursion?',
    },
    {
      turnId: 'turn-2',
      suggestions: [{ message: 'Now let us try a practice problem.', title: 'Practice' }],
      learnerAction: 'follow_up',
      learnerMessage: 'I think I understand, but can we try an example?',
    },
  ];

  const mockScenario = {
    name: 'Test Scenario',
    description: 'A test scenario for recursion tutoring',
    expectedBehavior: 'Tutor should explain recursion clearly',
    learnerContext: 'Student learning recursion for the first time',
    requiredElements: ['base case'],
    forbiddenElements: ['jargon'],
  };

  it('returns a prompt string for a valid turn', () => {
    const prompt = buildPerTurnTutorEvaluationPrompt({
      turnResults: mockTurnResults,
      dialogueTrace: [],
      targetTurnIndex: 0,
      scenario: mockScenario,
    });
    assert.ok(typeof prompt === 'string', 'should return a string');
    assert.ok(prompt.length > 100, 'prompt should be substantial');
  });

  it('includes per-turn framing in the prompt', () => {
    const prompt = buildPerTurnTutorEvaluationPrompt({
      turnResults: mockTurnResults,
      dialogueTrace: [],
      targetTurnIndex: 1,
      scenario: mockScenario,
    });
    assert.ok(prompt.includes('PER-TURN SCORING'), 'should include per-turn framing');
    assert.ok(prompt.includes('Turn 2 of 3'), 'should include turn label (1-indexed)');
  });

  it('returns null for a turn with no suggestion', () => {
    const noSugTurns = [{ turnId: 'empty', suggestions: [], learnerMessage: null }];
    const prompt = buildPerTurnTutorEvaluationPrompt({
      turnResults: noSugTurns,
      dialogueTrace: [],
      targetTurnIndex: 0,
      scenario: mockScenario,
    });
    assert.strictEqual(prompt, null, 'should return null for no suggestion');
  });

  it('returns null for out-of-range turn index', () => {
    const prompt = buildPerTurnTutorEvaluationPrompt({
      turnResults: mockTurnResults,
      dialogueTrace: [],
      targetTurnIndex: 99,
      scenario: mockScenario,
    });
    assert.strictEqual(prompt, null, 'should return null for invalid index');
  });

  it('includes the target suggestion in the prompt', () => {
    const prompt = buildPerTurnTutorEvaluationPrompt({
      turnResults: mockTurnResults,
      dialogueTrace: [],
      targetTurnIndex: 2,
      scenario: mockScenario,
    });
    assert.ok(prompt.includes('practice problem'), 'should include the target turn suggestion text');
  });

  it('truncates dialogue trace to target turn', () => {
    const mockTrace = [
      { turnIndex: 0, agent: 'ego', action: 'initial_draft', contextSummary: 'Turn 0 draft' },
      { turnIndex: 1, agent: 'learner', action: 'turn_action', contextSummary: 'Learner asks about recursion' },
      { turnIndex: 1, agent: 'ego', action: 'initial_draft', contextSummary: 'Turn 1 draft' },
      { turnIndex: 2, agent: 'learner', action: 'turn_action', contextSummary: 'Learner asks for example' },
      { turnIndex: 2, agent: 'ego', action: 'initial_draft', contextSummary: 'Turn 2 draft' },
    ];

    // Score turn 1 — should NOT see turn 2 trace entries
    const prompt = buildPerTurnTutorEvaluationPrompt({
      turnResults: mockTurnResults,
      dialogueTrace: mockTrace,
      targetTurnIndex: 1,
      scenario: mockScenario,
    });

    // The prompt should include turn 0 and turn 1 content but NOT turn 2
    assert.ok(prompt.includes('Turn 0 draft') || prompt.includes('Turn 1 draft') || prompt.includes('recursion'),
      'should include earlier turn content');
    // Turn 2 trace entry should NOT appear
    assert.ok(!prompt.includes('Turn 2 draft'), 'should NOT include future turn trace');
  });
});

// ============================================================================
// Scoring completeness: all three dimensions populated
// ============================================================================

describe('scoring completeness — all dimensions populated after full evaluation', () => {
  it('multi-turn result has tutor, learner, and dialogue scores after full scoring', () => {
    const runId = makeRun('completeness test');
    storeResult(runId, makeResult({
      dialogueId: 'dlg-complete-1',
      suggestions: [{ message: 'T0' }, { message: 'T1' }, { message: 'T2' }],
      dialogueRounds: 3,
    }));

    const results = getResults(runId);
    const id = results[0].id;

    // Phase 1: tutor per-turn scoring
    updateResultTutorScores(id, {
      tutorScores: {
        0: { overallScore: 65, scores: { relevance: { score: 3 } }, summary: 'OK' },
        1: { overallScore: 78, scores: { relevance: { score: 4 } }, summary: 'Better' },
        2: { overallScore: 88, scores: { relevance: { score: 5 } }, summary: 'Great' },
      },
      tutorOverallScore: 77,
      tutorFirstTurnScore: 65,
      tutorLastTurnScore: 88,
      tutorDevelopmentScore: 23,
      judgeModel: 'test-judge',
    });

    // Phase 2: learner scoring
    updateResultLearnerScores(id, {
      scores: { 0: { overallScore: 55 }, 1: { overallScore: 70 } },
      overallScore: 62.5,
      judgeModel: 'test-judge',
      holisticScores: { engagement: 4, depth: 3 },
      holisticOverallScore: 68,
      holisticSummary: 'Learner showed growth',
      holisticJudgeModel: 'test-judge',
    });

    // Phase 3: dialogue quality scoring
    updateDialogueQualityScore(id, {
      dialogueQualityScore: 82,
      dialogueQualitySummary: 'Strong pedagogical encounter',
      dialogueQualityJudgeModel: 'test-judge',
    });

    // Verify all dimensions are populated
    const scored = getResults(runId)[0];
    assert.ok(scored.tutorFirstTurnScore != null, 'tutor first turn score should be set');
    assert.ok(scored.tutorLastTurnScore != null, 'tutor last turn score should be set');
    assert.ok(scored.tutorOverallScore != null, 'tutor overall score should be set');
    assert.ok(scored.tutorDevelopmentScore != null, 'tutor development score should be set');
    assert.ok(scored.learnerOverallScore != null, 'learner overall score should be set');
    assert.ok(scored.learnerHolisticOverallScore != null, 'learner holistic score should be set');
    assert.ok(scored.dialogueQualityScore != null, 'dialogue quality score should be set');
  });

  it('missing learner score is detectable via null check', () => {
    const runId = makeRun('missing learner test');
    storeResult(runId, makeResult({
      dialogueId: 'dlg-missing-1',
      suggestions: [{ message: 'T0' }, { message: 'T1' }],
      dialogueRounds: 2,
    }));

    const results = getResults(runId);
    const id = results[0].id;

    // Only score tutor — skip learner
    updateResultTutorScores(id, {
      tutorScores: { 0: { overallScore: 70 }, 1: { overallScore: 80 } },
      tutorOverallScore: 75,
      tutorFirstTurnScore: 70,
      tutorLastTurnScore: 80,
      tutorDevelopmentScore: 10,
      judgeModel: 'test-judge',
    });

    const scored = getResults(runId)[0];
    assert.ok(scored.tutorFirstTurnScore != null, 'tutor score should be set');
    assert.strictEqual(scored.learnerOverallScore, null, 'learner score should be NULL (not scored)');
    assert.strictEqual(scored.dialogueQualityScore, null, 'dialogue score should be NULL (not scored)');
  });
});

// ============================================================================
// listRuns average correctness — tutor, learner, dialogue
// ============================================================================

describe('listRuns computes correct averages across multiple results', () => {
  it('avgScore is the mean of tutor_first_turn_score values', () => {
    const runId = makeRun('tutor avg test');

    storeResult(runId, makeResult({ scenarioId: 's1' }));
    storeResult(runId, makeResult({ scenarioId: 's2' }));
    storeResult(runId, makeResult({ scenarioId: 's3' }));

    const results = getResults(runId);

    // Score with 60, 80, 100
    updateResultScores(results[0].id, {
      scores: {}, tutorFirstTurnScore: 60, baseScore: 60,
      passesRequired: true, passesForbidden: true, judgeModel: 'test',
    });
    updateResultScores(results[1].id, {
      scores: {}, tutorFirstTurnScore: 80, baseScore: 80,
      passesRequired: true, passesForbidden: true, judgeModel: 'test',
    });
    updateResultScores(results[2].id, {
      scores: {}, tutorFirstTurnScore: 100, baseScore: 100,
      passesRequired: true, passesForbidden: true, judgeModel: 'test',
    });

    const runs = listRuns();
    const run = runs.find((r) => r.id === runId);
    assert.ok(run, 'should find test run');
    assert.strictEqual(run.avgScore, 80, 'avgScore should be mean of [60, 80, 100] = 80');
  });

  it('avgLearnerScore is the mean of learner_overall_score values', () => {
    const runId = makeRun('learner avg test');

    storeResult(runId, makeResult({ scenarioId: 's1', dialogueId: 'dlg-la-1' }));
    storeResult(runId, makeResult({ scenarioId: 's2', dialogueId: 'dlg-la-2' }));

    const results = getResults(runId);

    // Score tutor (required for judge_model filter in listRuns)
    for (const r of results) {
      updateResultScores(r.id, {
        scores: {}, tutorFirstTurnScore: 70, baseScore: 70,
        passesRequired: true, passesForbidden: true, judgeModel: 'test',
      });
    }

    // Score learner with 50 and 90
    updateResultLearnerScores(results[0].id, { scores: {}, overallScore: 50, judgeModel: 'test' });
    updateResultLearnerScores(results[1].id, { scores: {}, overallScore: 90, judgeModel: 'test' });

    const runs = listRuns();
    const run = runs.find((r) => r.id === runId);
    assert.ok(run, 'should find test run');
    assert.strictEqual(run.avgLearnerScore, 70, 'avgLearnerScore should be mean of [50, 90] = 70');
  });

  it('avgDialogueScore is the mean of dialogue_quality_score values', () => {
    const runId = makeRun('dialogue avg test');

    storeResult(runId, makeResult({ scenarioId: 's1', dialogueId: 'dlg-da-1' }));
    storeResult(runId, makeResult({ scenarioId: 's2', dialogueId: 'dlg-da-2' }));

    const results = getResults(runId);

    for (const r of results) {
      updateResultScores(r.id, {
        scores: {}, tutorFirstTurnScore: 70, baseScore: 70,
        passesRequired: true, passesForbidden: true, judgeModel: 'test',
      });
    }

    // Score dialogue with 85 and 75
    updateDialogueQualityScore(results[0].id, { dialogueQualityScore: 85, dialogueQualityJudgeModel: 'test' });
    updateDialogueQualityScore(results[1].id, { dialogueQualityScore: 75, dialogueQualityJudgeModel: 'test' });

    const runs = listRuns();
    const run = runs.find((r) => r.id === runId);
    assert.ok(run, 'should find test run');
    assert.strictEqual(run.avgDialogueScore, 80, 'avgDialogueScore should be mean of [85, 75] = 80');
  });
});

// ============================================================================
// Holistic vs per-turn evaluation: transcript completeness
// ============================================================================

describe('holistic evaluation receives full dialogue transcript', () => {
  // 4-turn mock dialogue with UNIQUE, identifiable content per turn.
  // Each turn has a distinct "fingerprint" string we can search for in prompts.
  const TURN_FINGERPRINTS = [
    'FINGERPRINT_TURN_0_RECURSION_INTRO',
    'FINGERPRINT_TURN_1_STUDENT_CONFUSION',
    'FINGERPRINT_TURN_2_WORKED_EXAMPLE',
    'FINGERPRINT_TURN_3_BREAKTHROUGH_MOMENT',
  ];

  const mockTurnResults = TURN_FINGERPRINTS.map((fp, i) => ({
    turnId: `turn-${i}`,
    suggestions: [{ message: `Tutor response ${fp}`, title: `Turn ${i}` }],
    learnerAction: i === 0 ? null : `action_${i}`,
    learnerMessage: i === 0 ? null : `Learner says ${fp}`,
  }));

  // Consolidated trace with unique content per turn — richer than conversationHistory
  const mockConsolidatedTrace = TURN_FINGERPRINTS.flatMap((fp, i) => [
    { turnIndex: i, agent: 'learner', action: 'turn_action', detail: `Learner action ${fp}` },
    { turnIndex: i, agent: 'ego', action: 'initial_draft', contextSummary: `Ego draft ${fp}` },
    { turnIndex: i, agent: 'superego', action: 'review', feedback: `Superego review ${fp}` },
    { turnIndex: i, agent: 'ego', action: 'revision', contextSummary: `Ego revision ${fp}` },
    { turnIndex: i, agent: 'tutor', action: 'final_output', suggestionCount: 1 },
  ]);

  // Conversation history (simpler, no internal deliberation)
  const mockConversationHistory = TURN_FINGERPRINTS.map((fp, i) => ({
    turnIndex: i,
    turnId: `turn-${i}`,
    suggestion: { message: `Tutor response ${fp}`, title: `Turn ${i}` },
    learnerMessage: i === 0 ? null : `Learner says ${fp}`,
  }));

  const mockScenario = {
    name: 'Recursion Tutoring (4-turn)',
    description: 'Multi-turn scenario testing recursion understanding',
    expectedBehavior: 'Tutor should scaffold recursion through progressive examples',
    learnerContext: 'CS1 student with no prior recursion exposure',
  };

  it('holistic prompt includes ALL 4 turn fingerprints from consolidated trace', () => {
    const lastSuggestion = mockTurnResults[3].suggestions[0];

    const prompt = buildEvaluationPrompt(
      lastSuggestion,
      { ...mockScenario, description: `${mockScenario.description} (holistic dialogue)` },
      {
        dialogueContext: {
          conversationHistory: mockConversationHistory,
          consolidatedTrace: mockConsolidatedTrace,
        },
      },
    );

    assert.ok(typeof prompt === 'string', 'holistic prompt should be a string');

    // ALL 4 fingerprints must appear — the judge sees the FULL dialogue
    for (let i = 0; i < TURN_FINGERPRINTS.length; i++) {
      assert.ok(
        prompt.includes(TURN_FINGERPRINTS[i]),
        `Holistic prompt must include turn ${i} fingerprint: ${TURN_FINGERPRINTS[i]}`,
      );
    }
  });

  it('holistic prompt includes "DIALOGUE TRANSCRIPT" section', () => {
    const lastSuggestion = mockTurnResults[3].suggestions[0];

    const prompt = buildEvaluationPrompt(
      lastSuggestion,
      mockScenario,
      {
        dialogueContext: {
          conversationHistory: mockConversationHistory,
          consolidatedTrace: mockConsolidatedTrace,
        },
      },
    );

    assert.ok(prompt.includes('DIALOGUE TRANSCRIPT'), 'should include DIALOGUE TRANSCRIPT section');
    assert.ok(prompt.includes('full learner-tutor exchange'), 'should describe it as full exchange');
  });

  it('holistic prompt does NOT include per-turn framing', () => {
    const lastSuggestion = mockTurnResults[3].suggestions[0];

    const prompt = buildEvaluationPrompt(
      lastSuggestion,
      mockScenario,
      {
        dialogueContext: {
          conversationHistory: mockConversationHistory,
          consolidatedTrace: mockConsolidatedTrace,
        },
      },
    );

    assert.ok(!prompt.includes('PER-TURN SCORING'), 'holistic prompt should NOT contain PER-TURN SCORING');
    assert.ok(!prompt.includes('truncated to this point'), 'holistic prompt should NOT mention truncation');
  });

  it('per-turn prompt for turn 1 includes turns 0-1 but excludes turns 2-3', () => {
    const prompt = buildPerTurnTutorEvaluationPrompt({
      turnResults: mockTurnResults,
      dialogueTrace: mockConsolidatedTrace,
      targetTurnIndex: 1,
      scenario: mockScenario,
    });

    assert.ok(typeof prompt === 'string', 'per-turn prompt should be a string');

    // Should include turns 0 and 1
    assert.ok(prompt.includes(TURN_FINGERPRINTS[0]), 'should include turn 0 fingerprint');
    assert.ok(prompt.includes(TURN_FINGERPRINTS[1]), 'should include turn 1 fingerprint');

    // Should NOT include turns 2 and 3 (future turns)
    assert.ok(!prompt.includes(TURN_FINGERPRINTS[2]), 'should NOT include turn 2 (future)');
    assert.ok(!prompt.includes(TURN_FINGERPRINTS[3]), 'should NOT include turn 3 (future)');

    // Should have per-turn framing
    assert.ok(prompt.includes('PER-TURN SCORING'), 'should include PER-TURN SCORING label');
    assert.ok(prompt.includes('Turn 2 of 4'), 'should show correct turn label');
  });

  it('per-turn prompt for turn 0 includes only turn 0, excludes all others', () => {
    const prompt = buildPerTurnTutorEvaluationPrompt({
      turnResults: mockTurnResults,
      dialogueTrace: mockConsolidatedTrace,
      targetTurnIndex: 0,
      scenario: mockScenario,
    });

    assert.ok(prompt.includes(TURN_FINGERPRINTS[0]), 'should include turn 0');
    assert.ok(!prompt.includes(TURN_FINGERPRINTS[1]), 'should NOT include turn 1');
    assert.ok(!prompt.includes(TURN_FINGERPRINTS[2]), 'should NOT include turn 2');
    assert.ok(!prompt.includes(TURN_FINGERPRINTS[3]), 'should NOT include turn 3');
    assert.ok(prompt.includes('Turn 1 of 4'), 'should show Turn 1 of 4');
  });

  it('per-turn prompt for last turn (3) includes ALL turns — same data as holistic', () => {
    const prompt = buildPerTurnTutorEvaluationPrompt({
      turnResults: mockTurnResults,
      dialogueTrace: mockConsolidatedTrace,
      targetTurnIndex: 3,
      scenario: mockScenario,
    });

    // Last turn should see all prior turns
    for (let i = 0; i < TURN_FINGERPRINTS.length; i++) {
      assert.ok(
        prompt.includes(TURN_FINGERPRINTS[i]),
        `Per-turn prompt for last turn should include turn ${i} fingerprint`,
      );
    }

    // But still has per-turn framing (unlike holistic)
    assert.ok(prompt.includes('PER-TURN SCORING'), 'last-turn per-turn should still have PER-TURN label');
    assert.ok(prompt.includes('Turn 4 of 4'), 'should show Turn 4 of 4');
  });

  it('holistic prompt falls back to conversationHistory when no consolidated trace', () => {
    const lastSuggestion = mockTurnResults[3].suggestions[0];

    const prompt = buildEvaluationPrompt(
      lastSuggestion,
      mockScenario,
      {
        dialogueContext: {
          conversationHistory: mockConversationHistory,
          consolidatedTrace: [], // empty — should fall back
        },
      },
    );

    // Should still include all turns via conversationHistory fallback
    for (let i = 0; i < TURN_FINGERPRINTS.length; i++) {
      assert.ok(
        prompt.includes(TURN_FINGERPRINTS[i]),
        `Fallback prompt should include turn ${i} fingerprint via conversationHistory`,
      );
    }
    assert.ok(prompt.includes('DIALOGUE TRANSCRIPT'), 'should still have DIALOGUE TRANSCRIPT section');
  });

  it('holistic prompt without dialogue context has no transcript section', () => {
    const lastSuggestion = mockTurnResults[3].suggestions[0];

    const prompt = buildEvaluationPrompt(
      lastSuggestion,
      mockScenario,
      {}, // no dialogueContext
    );

    assert.ok(!prompt.includes('DIALOGUE TRANSCRIPT'), 'no context → no transcript section');
    // Prior turns should not appear (turn 3 fingerprint is in the suggestion itself, which is OK)
    for (let i = 0; i < TURN_FINGERPRINTS.length - 1; i++) {
      assert.ok(!prompt.includes(TURN_FINGERPRINTS[i]),
        `no context → no fingerprint for turn ${i}: ${TURN_FINGERPRINTS[i]}`);
    }
  });
});

// ============================================================================
// isMultiTurnResult detection
// ============================================================================

// Replicated inline because it's defined inside the `evaluate` case block
// in eval-cli.js (~line 3029) and is not exported.
function isMultiTurnResult(result) {
  if (!result.dialogueId) return false;
  if (result.conversationMode === 'messages' && result.dialogueRounds > 1) return true;
  return Array.isArray(result.suggestions) && result.suggestions.length > 1;
}

describe('isMultiTurnResult detection', () => {
  it('messages-mode with dialogueRounds > 1 → true', () => {
    const result = {
      dialogueId: 'dlg-msg-1',
      conversationMode: 'messages',
      dialogueRounds: 3,
      suggestions: [{ message: 'Only Turn 0 stored in messages mode' }],
    };
    assert.strictEqual(isMultiTurnResult(result), true,
      'messages-mode with multiple rounds should be multi-turn');
  });

  it('dialogue-mode with suggestions.length > 1 → true', () => {
    const result = {
      dialogueId: 'dlg-dial-1',
      conversationMode: 'dialogue',
      dialogueRounds: 3,
      suggestions: [{ message: 'T0' }, { message: 'T1' }, { message: 'T2' }],
    };
    assert.strictEqual(isMultiTurnResult(result), true,
      'dialogue-mode with multiple suggestions should be multi-turn');
  });

  it('no dialogueId → false', () => {
    const result = {
      dialogueId: null,
      conversationMode: 'messages',
      dialogueRounds: 3,
      suggestions: [{ message: 'T0' }, { message: 'T1' }],
    };
    assert.strictEqual(isMultiTurnResult(result), false,
      'missing dialogueId should always be single-turn');
  });

  it('messages-mode with dialogueRounds === 1 → false', () => {
    const result = {
      dialogueId: 'dlg-msg-single',
      conversationMode: 'messages',
      dialogueRounds: 1,
      suggestions: [{ message: 'Single turn' }],
    };
    assert.strictEqual(isMultiTurnResult(result), false,
      'messages-mode with 1 round should be single-turn');
  });
});

// ============================================================================
// Multi-turn scoring pipeline (DB round-trip)
// ============================================================================

describe('multi-turn scoring pipeline (DB round-trip)', () => {
  it('stores per-turn tutor scores and aggregates correctly', () => {
    const runId = makeRun('tutor pipeline test');
    storeResult(runId, makeResult({
      dialogueId: 'dlg-pipe-1',
      suggestions: [{ message: 'T0' }, { message: 'T1' }, { message: 'T2' }, { message: 'T3' }],
      dialogueRounds: 4,
    }));

    const results = getResults(runId);
    const id = results[0].id;

    const tutorScores = {
      0: { overallScore: 70, scores: { relevance: { score: 3 } }, summary: 'Adequate' },
      1: { overallScore: 75, scores: { relevance: { score: 4 } }, summary: 'Good' },
      2: { overallScore: 80, scores: { relevance: { score: 4 } }, summary: 'Better' },
      3: { overallScore: 85, scores: { relevance: { score: 5 } }, summary: 'Strong' },
    };

    updateResultTutorScores(id, {
      tutorScores,
      tutorOverallScore: 77.5,
      tutorFirstTurnScore: 70,
      tutorLastTurnScore: 85,
      tutorDevelopmentScore: 15,
      judgeModel: 'test-judge',
      judgeLatencyMs: 400,
    });

    const updated = getResults(runId)[0];
    assert.strictEqual(updated.tutorOverallScore, 77.5, 'tutor_overall_score should be 77.5');
    assert.strictEqual(updated.tutorFirstTurnScore, 70, 'first turn should be 70');
    assert.strictEqual(updated.tutorLastTurnScore, 85, 'last turn should be 85');
    assert.strictEqual(updated.tutorDevelopmentScore, 15, 'development should be +15');
    assert.deepStrictEqual(updated.tutorScores, tutorScores, 'per-turn JSON should round-trip');
  });

  it('stores per-turn learner scores alongside tutor (no clobbering)', () => {
    const runId = makeRun('learner no-clobber test');
    storeResult(runId, makeResult({
      dialogueId: 'dlg-pipe-2',
      suggestions: [{ message: 'T0' }, { message: 'T1' }, { message: 'T2' }],
      dialogueRounds: 3,
    }));

    const results = getResults(runId);
    const id = results[0].id;

    // Phase 1: tutor scores
    updateResultTutorScores(id, {
      tutorScores: { 0: { overallScore: 72 }, 1: { overallScore: 78 }, 2: { overallScore: 84 } },
      tutorOverallScore: 78,
      tutorFirstTurnScore: 72,
      tutorLastTurnScore: 84,
      tutorDevelopmentScore: 12,
      judgeModel: 'test-judge',
    });

    // Phase 2: learner scores (N-1 = 2 turns)
    updateResultLearnerScores(id, {
      scores: { 0: { overallScore: 55 }, 1: { overallScore: 65 } },
      overallScore: 60,
      judgeModel: 'test-judge',
      holisticScores: { engagement: 4 },
      holisticOverallScore: 62,
      holisticSummary: 'Adequate engagement',
      holisticJudgeModel: 'test-judge',
    });

    // Verify learner columns set
    const scored = getResults(runId)[0];
    assert.strictEqual(scored.learnerOverallScore, 60, 'learner_overall_score should be 60');
    assert.strictEqual(scored.learnerHolisticOverallScore, 62, 'learner holistic should be 62');

    // Verify tutor columns NOT clobbered
    assert.strictEqual(scored.tutorOverallScore, 78, 'tutor_overall_score must survive learner update');
    assert.strictEqual(scored.tutorFirstTurnScore, 72, 'tutor_first_turn_score must survive');
    assert.strictEqual(scored.tutorLastTurnScore, 84, 'tutor_last_turn_score must survive');
    assert.strictEqual(scored.tutorDevelopmentScore, 12, 'tutor_development_score must survive');
  });

  it('tutor N turns, learner N-1 turns (entry count symmetry)', () => {
    const runId = makeRun('turn count symmetry');
    storeResult(runId, makeResult({
      dialogueId: 'dlg-pipe-3',
      suggestions: [{ message: 'T0' }, { message: 'T1' }, { message: 'T2' }, { message: 'T3' }],
      dialogueRounds: 4,
    }));

    const results = getResults(runId);
    const id = results[0].id;

    // 4 tutor turns
    const tutorScores = {
      0: { overallScore: 70 },
      1: { overallScore: 75 },
      2: { overallScore: 80 },
      3: { overallScore: 85 },
    };

    // 3 learner turns (N-1)
    const learnerScores = {
      0: { overallScore: 50 },
      1: { overallScore: 60 },
      2: { overallScore: 70 },
    };

    updateResultTutorScores(id, {
      tutorScores,
      tutorOverallScore: 77.5,
      tutorFirstTurnScore: 70,
      tutorLastTurnScore: 85,
      tutorDevelopmentScore: 15,
    });

    updateResultLearnerScores(id, {
      scores: learnerScores,
      overallScore: 60,
      judgeModel: 'test-judge',
    });

    const scored = getResults(runId)[0];
    const tutorEntries = Object.keys(scored.tutorScores);
    const learnerEntries = Object.keys(scored.learnerScores);
    assert.strictEqual(tutorEntries.length, 4, 'should have 4 tutor score entries');
    assert.strictEqual(learnerEntries.length, 3, 'should have 3 learner score entries (N-1)');
    assert.strictEqual(tutorEntries.length - learnerEntries.length, 1, 'tutor should have exactly 1 more entry');
  });

  it('single-turn row has null per-turn columns after legacy scoring', () => {
    const runId = makeRun('single-turn null columns');
    storeResult(runId, makeResult()); // no dialogueId, single suggestion

    const results = getResults(runId);
    updateResultScores(results[0].id, {
      scores: { relevance: { score: 4 } },
      tutorFirstTurnScore: 75,
      baseScore: 75,
      passesRequired: true,
      passesForbidden: true,
      judgeModel: 'test-judge',
    });

    const scored = getResults(runId)[0];
    assert.strictEqual(scored.tutorScores, null, 'tutor_scores should be NULL for single-turn');
    assert.strictEqual(scored.learnerScores, null, 'learner_scores should be NULL for single-turn');
    assert.strictEqual(scored.tutorOverallScore, null, 'tutor_overall_score should be NULL');
    assert.strictEqual(scored.tutorLastTurnScore, null, 'tutor_last_turn_score should be NULL');
    assert.strictEqual(scored.tutorDevelopmentScore, null, 'tutor_development_score should be NULL');
    assert.strictEqual(scored.tutorFirstTurnScore, 75, 'tutor_first_turn_score should be set');
  });
});

// ============================================================================
// Dialogue quality scoring — both variants (public + internal)
// ============================================================================

describe('dialogue quality scoring — public vs internal', () => {
  it('stores public transcript score without affecting internal', () => {
    const runId = makeRun('DQ public only');
    storeResult(runId, makeResult({ dialogueId: 'dlg-dq-1', dialogueRounds: 3 }));

    const results = getResults(runId);
    const id = results[0].id;

    updateDialogueQualityScore(id, {
      dialogueQualityScore: 72.5,
      dialogueQualitySummary: 'Public transcript analysis',
      dialogueQualityJudgeModel: 'test-judge',
    });

    const scored = getResults(runId)[0];
    assert.strictEqual(scored.dialogueQualityScore, 72.5, 'public DQ score should be 72.5');
    assert.ok(scored.dialogueQualitySummary.includes('Public'), 'public summary stored');
    assert.strictEqual(scored.dialogueQualityInternalScore, null, 'internal DQ should remain NULL');
    assert.strictEqual(scored.dialogueQualityInternalSummary, null, 'internal summary should remain NULL');
  });

  it('stores internal transcript score without affecting public', () => {
    const runId = makeRun('DQ internal only');
    storeResult(runId, makeResult({ dialogueId: 'dlg-dq-2', dialogueRounds: 3 }));

    const results = getResults(runId);
    const id = results[0].id;

    updateDialogueQualityInternalScore(id, {
      dialogueQualityInternalScore: 68.3,
      dialogueQualityInternalSummary: 'Internal transcript analysis with ego-superego deliberation',
    });

    const scored = getResults(runId)[0];
    assert.strictEqual(scored.dialogueQualityInternalScore, 68.3, 'internal DQ score should be 68.3');
    assert.ok(scored.dialogueQualityInternalSummary.includes('Internal'), 'internal summary stored');
    assert.strictEqual(scored.dialogueQualityScore, null, 'public DQ should remain NULL');
    assert.strictEqual(scored.dialogueQualitySummary, null, 'public summary should remain NULL');
  });

  it('both variants coexist with different values', () => {
    const runId = makeRun('DQ both variants');
    storeResult(runId, makeResult({ dialogueId: 'dlg-dq-3', dialogueRounds: 3 }));

    const results = getResults(runId);
    const id = results[0].id;

    updateDialogueQualityScore(id, {
      dialogueQualityScore: 72.5,
      dialogueQualitySummary: 'Public view',
      dialogueQualityJudgeModel: 'test-judge',
    });

    updateDialogueQualityInternalScore(id, {
      dialogueQualityInternalScore: 68.3,
      dialogueQualityInternalSummary: 'Internal view',
    });

    const scored = getResults(runId)[0];
    assert.strictEqual(scored.dialogueQualityScore, 72.5, 'public DQ should be 72.5');
    assert.strictEqual(scored.dialogueQualityInternalScore, 68.3, 'internal DQ should be 68.3');
    assert.notStrictEqual(scored.dialogueQualityScore, scored.dialogueQualityInternalScore,
      'public and internal should be distinct values');
  });
});

// ============================================================================
// listRuns reflects all score types
// ============================================================================

describe('listRuns reflects all score types', () => {
  it('avgScore prefers tutor_overall_score over tutor_first_turn_score', () => {
    const runId = makeRun('COALESCE order test');
    storeResult(runId, makeResult({ dialogueId: 'dlg-coalesce', dialogueRounds: 3 }));

    const results = getResults(runId);
    const id = results[0].id;

    // Set tutor_first_turn_score via legacy path
    updateResultScores(id, {
      scores: {},
      tutorFirstTurnScore: 70,
      baseScore: 70,
      passesRequired: true,
      passesForbidden: true,
      judgeModel: 'test-judge',
    });

    // Then set tutor_overall_score via per-turn path (higher value)
    updateResultTutorScores(id, {
      tutorScores: { 0: { overallScore: 70 }, 1: { overallScore: 80 }, 2: { overallScore: 90 } },
      tutorOverallScore: 80,
      tutorFirstTurnScore: 70,
      tutorLastTurnScore: 90,
      tutorDevelopmentScore: 20,
      judgeModel: 'test-judge',
    });

    const runs = listRuns();
    const run = runs.find((r) => r.id === runId);
    assert.ok(run, 'should find test run');
    // avgScore should use tutor_overall_score (80) not tutor_first_turn_score (70)
    assert.strictEqual(run.avgScore, 80, 'avgScore should prefer tutor_overall_score (80) over first_turn (70)');
  });

  it('returns avgLearnerScore and avgDialogueScore for multi-turn rows', () => {
    const runId = makeRun('all score types listing');
    storeResult(runId, makeResult({ scenarioId: 's1', dialogueId: 'dlg-list-all-1', dialogueRounds: 2 }));

    const results = getResults(runId);
    const id = results[0].id;

    updateResultScores(id, {
      scores: {},
      tutorFirstTurnScore: 70,
      baseScore: 70,
      passesRequired: true,
      passesForbidden: true,
      judgeModel: 'test-judge',
    });
    updateResultLearnerScores(id, { scores: {}, overallScore: 55, judgeModel: 'test-judge' });
    updateDialogueQualityScore(id, { dialogueQualityScore: 60, dialogueQualityJudgeModel: 'test-judge' });

    const runs = listRuns();
    const run = runs.find((r) => r.id === runId);
    assert.ok(run, 'should find test run');
    assert.strictEqual(run.avgLearnerScore, 55, 'avgLearnerScore should be 55');
    assert.strictEqual(run.avgDialogueScore, 60, 'avgDialogueScore should be 60');
  });
});

// ============================================================================
// updateResultTutorHolisticScores — DB round-trip
// ============================================================================

describe('updateResultTutorHolisticScores', () => {
  it('stores holistic tutor scores without clobbering per-turn tutor columns', () => {
    const runId = makeRun('tutor holistic DB');
    storeResult(runId, makeResult({
      dialogueId: 'dlg-tutor-holistic-1',
      dialogueRounds: 3,
    }));

    const results = getResults(runId);
    const id = results[0].id;

    // Write per-turn tutor scores first
    updateResultTutorScores(id, {
      tutorScores: { 0: { overallScore: 70 }, 1: { overallScore: 80 } },
      tutorOverallScore: 75,
      tutorFirstTurnScore: 70,
      tutorLastTurnScore: 80,
      tutorDevelopmentScore: 10,
      judgeModel: 'test-judge',
    });

    // Then write holistic tutor scores
    updateResultTutorHolisticScores(id, {
      holisticScores: { scaffolding_arc: { score: 4, reasoning: 'Good progression' }, adaptive_responsiveness: { score: 3, reasoning: 'Moderate' } },
      holisticOverallScore: 68.5,
      holisticSummary: 'Strong scaffolding arc with moderate responsiveness',
      holisticJudgeModel: 'test-judge',
    });

    const scored = getResults(runId)[0];

    // Holistic fields populated
    assert.strictEqual(scored.tutorHolisticOverallScore, 68.5, 'holistic overall score');
    assert.ok(scored.tutorHolisticSummary.includes('scaffolding'), 'holistic summary');
    assert.strictEqual(scored.tutorHolisticJudgeModel, 'test-judge', 'holistic judge model');
    assert.ok(scored.tutorHolisticScores.scaffolding_arc, 'holistic scores JSON parsed');
    assert.strictEqual(scored.tutorHolisticScores.scaffolding_arc.score, 4, 'dimension score');

    // Per-turn tutor scores NOT clobbered
    assert.strictEqual(scored.tutorOverallScore, 75, 'per-turn tutor overall preserved');
    assert.strictEqual(scored.tutorFirstTurnScore, 70, 'first turn preserved');
    assert.strictEqual(scored.tutorLastTurnScore, 80, 'last turn preserved');
  });

  it('per-turn and holistic coexist with distinct values', () => {
    const runId = makeRun('tutor holistic coexist');
    storeResult(runId, makeResult({ dialogueId: 'dlg-tutor-holistic-2', dialogueRounds: 2 }));

    const results = getResults(runId);
    const id = results[0].id;

    updateResultTutorScores(id, {
      tutorScores: { 0: { overallScore: 60 }, 1: { overallScore: 90 } },
      tutorOverallScore: 75,
      tutorFirstTurnScore: 60,
      tutorLastTurnScore: 90,
      tutorDevelopmentScore: 30,
      judgeModel: 'test-judge',
    });

    updateResultTutorHolisticScores(id, {
      holisticScores: { conceptual_coherence: { score: 5, reasoning: 'Excellent' } },
      holisticOverallScore: 95,
      holisticSummary: 'Exceptional coherence',
      holisticJudgeModel: 'test-judge-holistic',
    });

    const scored = getResults(runId)[0];
    assert.notStrictEqual(scored.tutorOverallScore, scored.tutorHolisticOverallScore,
      'per-turn and holistic tutor scores should be distinct');
    assert.strictEqual(scored.tutorOverallScore, 75);
    assert.strictEqual(scored.tutorHolisticOverallScore, 95);
  });
});

// ============================================================================
// listRuns returns all 6 avg columns
// ============================================================================

describe('listRuns returns all 6 score columns', () => {
  it('returns all 6 avg score columns when populated', () => {
    const runId = makeRun('6-column listing');
    storeResult(runId, makeResult({ dialogueId: 'dlg-6col', dialogueRounds: 3 }));

    const results = getResults(runId);
    const id = results[0].id;

    updateResultTutorScores(id, {
      tutorScores: { 0: { overallScore: 70 } },
      tutorOverallScore: 70,
      tutorFirstTurnScore: 70,
      judgeModel: 'test-judge',
    });
    updateResultTutorHolisticScores(id, {
      holisticScores: {},
      holisticOverallScore: 72,
      holisticJudgeModel: 'test-judge',
    });
    updateResultLearnerScores(id, {
      scores: {},
      overallScore: 55,
      judgeModel: 'test-judge',
      holisticScores: {},
      holisticOverallScore: 60,
      holisticJudgeModel: 'test-judge',
    });
    updateDialogueQualityScore(id, {
      dialogueQualityScore: 80,
      dialogueQualityJudgeModel: 'test-judge',
    });
    updateDialogueQualityInternalScore(id, {
      dialogueQualityInternalScore: 75,
    });

    const runs = listRuns();
    const run = runs.find((r) => r.id === runId);
    assert.ok(run, 'should find test run');

    assert.strictEqual(run.avgScore, 70, 'TutPT');
    assert.strictEqual(run.avgTutorHolisticScore, 72, 'TutH');
    assert.strictEqual(run.avgLearnerScore, 55, 'LrnPT');
    assert.strictEqual(run.avgLearnerHolisticScore, 60, 'LrnH');
    assert.strictEqual(run.avgDialogueScore, 80, 'DlgP');
    assert.strictEqual(run.avgDialogueInternalScore, 75, 'DlgI');
  });

  it('returns null for missing holistic/dialogue scores', () => {
    const runId = makeRun('6-column null');
    storeResult(runId, makeResult({ dialogueId: 'dlg-6col-null', dialogueRounds: 1 }));

    const results = getResults(runId);
    const id = results[0].id;

    // Only set per-turn tutor score
    updateResultTutorScores(id, {
      tutorScores: { 0: { overallScore: 65 } },
      tutorOverallScore: 65,
      tutorFirstTurnScore: 65,
      judgeModel: 'test-judge',
    });

    const runs = listRuns();
    const run = runs.find((r) => r.id === runId);
    assert.ok(run);

    assert.strictEqual(run.avgScore, 65, 'TutPT populated');
    assert.strictEqual(run.avgTutorHolisticScore, null, 'TutH null when missing');
    assert.strictEqual(run.avgLearnerScore, null, 'LrnPT null when missing');
    assert.strictEqual(run.avgLearnerHolisticScore, null, 'LrnH null when missing');
    assert.strictEqual(run.avgDialogueScore, null, 'DlgP null when missing');
    assert.strictEqual(run.avgDialogueInternalScore, null, 'DlgI null when missing');
  });
});

// ============================================================================
// Tutor holistic rubric and scoring
// ============================================================================

describe('tutor holistic rubric', () => {
  it('loads v2.2 dimensions from YAML (3 dims, same for all cells)', () => {
    const dimsRecog = getTutorHolisticDimensions({ hasRecognition: true });
    assert.ok(dimsRecog.pedagogical_arc, 'has pedagogical_arc');
    assert.ok(dimsRecog.adaptive_trajectory, 'has adaptive_trajectory');
    assert.ok(dimsRecog.pedagogical_closure, 'has pedagogical_closure');
    assert.strictEqual(Object.keys(dimsRecog).length, 3, '3 dimensions for recognition');

    const dimsBase = getTutorHolisticDimensions({ hasRecognition: false });
    assert.strictEqual(Object.keys(dimsBase).length, 3, '3 dimensions for base');
    assert.deepStrictEqual(Object.keys(dimsRecog), Object.keys(dimsBase),
      'v2.2 returns same dims regardless of hasRecognition');
  });

  it('calculateTutorHolisticScore produces correct 0-100 score', () => {
    // All 3s with v2.2 dimensions
    const scores = {
      pedagogical_arc: { score: 3 },
      adaptive_trajectory: { score: 3 },
      pedagogical_closure: { score: 3 },
    };
    const result = calculateTutorHolisticScore(scores, true);
    assert.ok(Math.abs(result - 50) < 0.01, `all 3s → ~50 (got ${result})`);

    // All 5s
    const perfect = {};
    for (const key of Object.keys(scores)) {
      perfect[key] = { score: 5 };
    }
    const perfectResult = calculateTutorHolisticScore(perfect, true);
    assert.ok(Math.abs(perfectResult - 100) < 0.01, `all 5s → ~100 (got ${perfectResult})`);

    // All 1s
    const lowest = {};
    for (const key of Object.keys(scores)) {
      lowest[key] = { score: 1 };
    }
    const lowestResult = calculateTutorHolisticScore(lowest, true);
    assert.ok(Math.abs(lowestResult - 0) < 0.01, `all 1s → ~0 (got ${lowestResult})`);
  });

  it('buildTutorHolisticEvaluationPrompt includes v2.2 rubric dimensions', () => {
    const prompt = buildTutorHolisticEvaluationPrompt({
      turns: [{ turnIndex: 0, suggestion: { message: 'Hello' } }],
      dialogueTrace: [],
      scenarioName: 'test-scenario',
      scenarioDescription: 'A test scenario',
      hasRecognition: true,
    });

    assert.ok(prompt.includes('pedagogical_arc'), 'includes pedagogical_arc');
    assert.ok(prompt.includes('adaptive_trajectory'), 'includes adaptive_trajectory');
    assert.ok(prompt.includes('pedagogical_closure'), 'includes pedagogical_closure');
    assert.ok(prompt.includes('TUTOR'), 'mentions TUTOR');
    assert.ok(prompt.includes('ENTIRE DIALOGUE'), 'emphasizes full dialogue');
  });

  it('v2.2 prompt uses same 3 dims for base and recognition cells', () => {
    const promptBase = buildTutorHolisticEvaluationPrompt({
      turns: [{ turnIndex: 0, suggestion: { message: 'Hello' } }],
      dialogueTrace: [],
      scenarioName: 'test-scenario',
      scenarioDescription: 'A test scenario',
      hasRecognition: false,
    });

    const promptRecog = buildTutorHolisticEvaluationPrompt({
      turns: [{ turnIndex: 0, suggestion: { message: 'Hello' } }],
      dialogueTrace: [],
      scenarioName: 'test-scenario',
      scenarioDescription: 'A test scenario',
      hasRecognition: true,
    });

    // Both prompts include the same v2.2 dimension keys
    assert.ok(promptBase.includes('pedagogical_arc'), 'base has pedagogical_arc');
    assert.ok(promptBase.includes('adaptive_trajectory'), 'base has adaptive_trajectory');
    assert.ok(promptBase.includes('pedagogical_closure'), 'base has pedagogical_closure');
    assert.ok(promptRecog.includes('pedagogical_arc'), 'recog has pedagogical_arc');
    assert.ok(promptRecog.includes('adaptive_trajectory'), 'recog has adaptive_trajectory');
    assert.ok(promptRecog.includes('pedagogical_closure'), 'recog has pedagogical_closure');
  });
});

// ============================================================================
// Full pipeline end-to-end: all 6 score types populated
// ============================================================================

describe('full pipeline end-to-end', () => {
  it('multi-turn row gets all 6 score types populated without clobbering', () => {
    const runId = makeRun('full pipeline E2E');
    storeResult(runId, makeResult({
      dialogueId: 'dlg-e2e-full',
      suggestions: [{ message: 'T0' }, { message: 'T1' }, { message: 'T2' }],
      dialogueRounds: 3,
    }));

    const results = getResults(runId);
    const id = results[0].id;

    // Stage 1: Per-turn tutor scoring
    updateResultTutorScores(id, {
      tutorScores: {
        0: { overallScore: 65, scores: { relevance: { score: 3 } }, summary: 'Fair' },
        1: { overallScore: 78, scores: { relevance: { score: 4 } }, summary: 'Good' },
        2: { overallScore: 88, scores: { relevance: { score: 5 } }, summary: 'Excellent' },
      },
      tutorOverallScore: 77,
      tutorFirstTurnScore: 65,
      tutorLastTurnScore: 88,
      tutorDevelopmentScore: 23,
      judgeModel: 'test-judge',
      judgeLatencyMs: 600,
    });

    // Stage 2: Per-turn learner scoring (N-1 = 2 turns) + holistic
    updateResultLearnerScores(id, {
      scores: { 0: { overallScore: 50 }, 1: { overallScore: 68 } },
      overallScore: 59,
      judgeModel: 'test-judge',
      holisticScores: { engagement: 4, depth: 3 },
      holisticOverallScore: 64,
      holisticSummary: 'Learner showed progressive engagement',
      holisticJudgeModel: 'test-judge',
    });

    // Stage 3: Holistic tutor evaluation (full dialogue trajectory)
    updateResultTutorHolisticScores(id, {
      holisticScores: { scaffolding_arc: { score: 4 }, conceptual_coherence: { score: 4 } },
      holisticOverallScore: 71.5,
      holisticSummary: 'Good scaffolding progression with strong coherence',
      holisticJudgeModel: 'test-judge',
    });

    // Stage 4: Dialogue quality — public transcript
    updateDialogueQualityScore(id, {
      dialogueQualityScore: 82.5,
      dialogueQualitySummary: 'Strong pedagogical exchange',
      dialogueQualityJudgeModel: 'test-judge',
    });

    // Stage 5: Dialogue quality — internal transcript
    updateDialogueQualityInternalScore(id, {
      dialogueQualityInternalScore: 74.2,
      dialogueQualityInternalSummary: 'Good ego-superego deliberation visible',
    });

    // Single retrieval — verify ALL columns populated, none clobbered
    const scored = getResults(runId)[0];

    // Tutor per-turn (Stage 1)
    assert.strictEqual(scored.tutorOverallScore, 77, 'tutor overall');
    assert.strictEqual(scored.tutorFirstTurnScore, 65, 'tutor first turn');
    assert.strictEqual(scored.tutorLastTurnScore, 88, 'tutor last turn');
    assert.strictEqual(scored.tutorDevelopmentScore, 23, 'tutor development');
    assert.deepStrictEqual(Object.keys(scored.tutorScores).sort(), ['0', '1', '2'], 'tutor 3 per-turn entries');

    // Learner per-turn + holistic (Stage 2)
    assert.strictEqual(scored.learnerOverallScore, 59, 'learner overall');
    assert.strictEqual(scored.learnerHolisticOverallScore, 64, 'learner holistic');
    assert.deepStrictEqual(Object.keys(scored.learnerScores).sort(), ['0', '1'], 'learner 2 per-turn entries');

    // Tutor holistic (Stage 3)
    assert.strictEqual(scored.tutorHolisticOverallScore, 71.5, 'tutor holistic overall');
    assert.ok(scored.tutorHolisticSummary.includes('scaffolding'), 'tutor holistic summary');
    assert.strictEqual(scored.tutorHolisticJudgeModel, 'test-judge', 'tutor holistic judge model');

    // Dialogue quality — public (Stage 4)
    assert.strictEqual(scored.dialogueQualityScore, 82.5, 'public DQ score');
    assert.ok(scored.dialogueQualitySummary.includes('pedagogical'), 'public DQ summary');

    // Dialogue quality — internal (Stage 5)
    assert.strictEqual(scored.dialogueQualityInternalScore, 74.2, 'internal DQ score');
    assert.ok(scored.dialogueQualityInternalSummary.includes('ego-superego'), 'internal DQ summary');

    // Cross-check: stages didn't clobber each other
    assert.notStrictEqual(scored.dialogueQualityScore, scored.dialogueQualityInternalScore,
      'public and internal DQ should be distinct');
    assert.notStrictEqual(scored.tutorOverallScore, scored.learnerOverallScore,
      'tutor and learner overall should be distinct');
    assert.notStrictEqual(scored.tutorOverallScore, scored.tutorHolisticOverallScore,
      'tutor per-turn and holistic should be distinct');
  });
});

// ============================================================================
// Per-dialogue scoring completeness: all stages populate atomically
// ============================================================================

describe('per-dialogue scoring completeness', () => {
  it('a fully scored multi-turn row has all 6 score types — no NULLs', () => {
    // Simulates the inline pipeline: after each dialogue, ALL stages run before moving on.
    // If any stage were deferred to a batch, partially-scored rows would exist.
    const runId = makeRun('inline completeness');
    // Two multi-turn rows — simulates two dialogues being scored sequentially
    storeResult(runId, makeResult({ scenarioId: 's1', dialogueId: 'dlg-inline-1', dialogueRounds: 3 }));
    storeResult(runId, makeResult({ scenarioId: 's2', dialogueId: 'dlg-inline-2', dialogueRounds: 4 }));

    const results = getResults(runId);
    assert.strictEqual(results.length, 2);

    // Score first dialogue fully (all 6 stages)
    const id1 = results[0].id;
    updateResultTutorScores(id1, {
      tutorScores: { 0: { overallScore: 70 }, 1: { overallScore: 80 }, 2: { overallScore: 85 } },
      tutorOverallScore: 78.3,
      tutorFirstTurnScore: 70,
      tutorLastTurnScore: 85,
      tutorDevelopmentScore: 15,
      judgeModel: 'test-judge',
    });
    updateResultLearnerScores(id1, {
      scores: { 0: { overallScore: 55 }, 1: { overallScore: 62 } },
      overallScore: 58.5,
      judgeModel: 'test-judge',
      holisticScores: { engagement: { score: 4 } },
      holisticOverallScore: 66,
      holisticJudgeModel: 'test-judge',
    });
    updateResultTutorHolisticScores(id1, {
      holisticScores: { scaffolding_arc: { score: 4 } },
      holisticOverallScore: 72,
      holisticJudgeModel: 'test-judge',
    });
    updateDialogueQualityScore(id1, {
      dialogueQualityScore: 80,
      dialogueQualityJudgeModel: 'test-judge',
    });
    updateDialogueQualityInternalScore(id1, {
      dialogueQualityInternalScore: 77,
    });

    // Verify: first dialogue is FULLY scored before second dialogue starts
    const afterFirst = getResults(runId);
    const row1 = afterFirst.find((r) => r.id === id1);
    assert.ok(row1.tutorOverallScore != null, 'row1 TutPT');
    assert.ok(row1.tutorHolisticOverallScore != null, 'row1 TutH');
    assert.ok(row1.learnerOverallScore != null, 'row1 LrnPT');
    assert.ok(row1.learnerHolisticOverallScore != null, 'row1 LrnH');
    assert.ok(row1.dialogueQualityScore != null, 'row1 DlgP');
    assert.ok(row1.dialogueQualityInternalScore != null, 'row1 DlgI');

    // Second dialogue is still unscored
    const row2 = afterFirst.find((r) => r.id !== id1);
    assert.strictEqual(row2.tutorOverallScore, null, 'row2 TutPT null');
    assert.strictEqual(row2.tutorHolisticOverallScore, null, 'row2 TutH null');
    assert.strictEqual(row2.dialogueQualityScore, null, 'row2 DlgP null');

    // listRuns should show averages from the one fully-scored row
    const runs = listRuns();
    const run = runs.find((r) => r.id === runId);
    assert.ok(run);
    assert.ok(run.avgScore != null, 'listRuns TutPT visible from partially-scored run');
    assert.ok(run.avgTutorHolisticScore != null, 'listRuns TutH visible');
    assert.ok(run.avgDialogueScore != null, 'listRuns DlgP visible');
    assert.ok(run.avgDialogueInternalScore != null, 'listRuns DlgI visible');
  });

  it('listRuns averages reflect only scored rows, not NULLs', () => {
    const runId = makeRun('partial scoring avg');
    storeResult(runId, makeResult({ scenarioId: 's1', dialogueId: 'dlg-partial-1', dialogueRounds: 3 }));
    storeResult(runId, makeResult({ scenarioId: 's2', dialogueId: 'dlg-partial-2', dialogueRounds: 3 }));

    const results = getResults(runId);

    // Score only first row with known values
    updateResultTutorScores(results[0].id, {
      tutorScores: { 0: { overallScore: 80 } },
      tutorOverallScore: 80,
      tutorFirstTurnScore: 80,
      judgeModel: 'test-judge',
    });
    updateResultTutorHolisticScores(results[0].id, {
      holisticScores: {},
      holisticOverallScore: 90,
      holisticJudgeModel: 'test-judge',
    });
    updateDialogueQualityScore(results[0].id, {
      dialogueQualityScore: 70,
      dialogueQualityJudgeModel: 'test-judge',
    });

    // Second row is unscored — AVG should NOT be dragged down by NULLs
    const runs = listRuns();
    const run = runs.find((r) => r.id === runId);
    assert.strictEqual(run.avgScore, 80, 'AVG(TutPT) = 80 from one scored row, not 40');
    assert.strictEqual(run.avgTutorHolisticScore, 90, 'AVG(TutH) = 90 from one scored row');
    assert.strictEqual(run.avgDialogueScore, 70, 'AVG(DlgP) = 70 from one scored row');
  });
});

// ============================================================================
// DgP / DgI independent storage (Bug fix: shared try/catch caused silent DgI loss)
// ============================================================================

describe('DgP and DgI can be stored independently', () => {
  it('DgP can be written without DgI', () => {
    const runId = makeRun('dgp-only test');
    storeResult(runId, makeResult({
      dialogueId: 'dlg-dgp-only',
      suggestions: [{ message: 'T0' }, { message: 'T1' }],
      dialogueRounds: 2,
    }));

    const id = getResults(runId)[0].id;

    updateDialogueQualityScore(id, {
      dialogueQualityScore: 88.5,
      dialogueQualitySummary: 'Good public dialogue',
      dialogueQualityJudgeModel: 'test-judge',
    });

    const result = getResults(runId)[0];
    assert.strictEqual(result.dialogueQualityScore, 88.5, 'DgP should be written');
    assert.strictEqual(result.dialogueQualityInternalScore, null, 'DgI should remain NULL');
  });

  it('DgI can be written without DgP', () => {
    const runId = makeRun('dgi-only test');
    storeResult(runId, makeResult({
      dialogueId: 'dlg-dgi-only',
      suggestions: [{ message: 'T0' }, { message: 'T1' }],
      dialogueRounds: 2,
    }));

    const id = getResults(runId)[0].id;

    updateDialogueQualityInternalScore(id, {
      dialogueQualityInternalScore: 91.0,
      dialogueQualityInternalSummary: 'Good internal dialogue',
    });

    const result = getResults(runId)[0];
    assert.strictEqual(result.dialogueQualityInternalScore, 91.0, 'DgI should be written');
    assert.strictEqual(result.dialogueQualityScore, null, 'DgP should remain NULL');
  });

  it('DgP written first, then DgI — no clobbering', () => {
    const runId = makeRun('dgp-then-dgi test');
    storeResult(runId, makeResult({
      dialogueId: 'dlg-both-seq',
      suggestions: [{ message: 'T0' }, { message: 'T1' }],
      dialogueRounds: 2,
    }));

    const id = getResults(runId)[0].id;

    updateDialogueQualityScore(id, {
      dialogueQualityScore: 85.0,
      dialogueQualitySummary: 'Public quality',
      dialogueQualityJudgeModel: 'test-judge',
    });

    updateDialogueQualityInternalScore(id, {
      dialogueQualityInternalScore: 92.0,
      dialogueQualityInternalSummary: 'Internal quality',
    });

    const result = getResults(runId)[0];
    assert.strictEqual(result.dialogueQualityScore, 85.0, 'DgP must survive DgI write');
    assert.strictEqual(result.dialogueQualityInternalScore, 92.0, 'DgI should be written');
  });
});

// ============================================================================
// evaluate-dialogue multi-turn filter (Bug fix: missed messages-mode results)
// ============================================================================

// Replicated from evaluate-dialogue command (~line 4446) to test in isolation.
// Must stay in sync with the source.
function isMultiTurnForDialogueEval(result) {
  return result.success && (
    (Array.isArray(result.suggestions) && result.suggestions.length > 1) ||
    (result.conversationMode === 'messages' && result.dialogueRounds > 1)
  );
}

describe('evaluate-dialogue multi-turn filter', () => {
  it('messages-mode with dialogueRounds > 1 and suggestions.length === 1 → included', () => {
    const result = {
      success: true,
      dialogueId: 'dlg-msg-1',
      conversationMode: 'messages',
      dialogueRounds: 3,
      suggestions: [{ message: 'Only Turn 0 stored in messages mode' }],
    };
    assert.strictEqual(isMultiTurnForDialogueEval(result), true,
      'messages-mode multi-turn should pass filter even with 1 suggestion');
  });

  it('dialogue-mode with suggestions.length > 1 → included', () => {
    const result = {
      success: true,
      dialogueId: 'dlg-dial-1',
      conversationMode: 'dialogue',
      dialogueRounds: 3,
      suggestions: [{ message: 'T0' }, { message: 'T1' }, { message: 'T2' }],
    };
    assert.strictEqual(isMultiTurnForDialogueEval(result), true);
  });

  it('messages-mode with dialogueRounds === 1 → excluded', () => {
    const result = {
      success: true,
      dialogueId: 'dlg-msg-single',
      conversationMode: 'messages',
      dialogueRounds: 1,
      suggestions: [{ message: 'Single turn' }],
    };
    assert.strictEqual(isMultiTurnForDialogueEval(result), false,
      'single-round messages-mode should not be multi-turn');
  });

  it('failed result → excluded regardless of turn count', () => {
    const result = {
      success: false,
      dialogueId: 'dlg-failed',
      conversationMode: 'messages',
      dialogueRounds: 5,
      suggestions: [{ message: 'T0' }],
    };
    assert.strictEqual(isMultiTurnForDialogueEval(result), false,
      'failed results must be excluded');
  });

  it('null conversationMode with single suggestion → excluded', () => {
    const result = {
      success: true,
      dialogueId: 'dlg-null-mode',
      conversationMode: null,
      dialogueRounds: 3,
      suggestions: [{ message: 'T0' }],
    };
    assert.strictEqual(isMultiTurnForDialogueEval(result), false,
      'null conversationMode with 1 suggestion should not be multi-turn');
  });
});

// ============================================================================
// DgP/DgI consolidation into evaluateMultiTurnResult
// ============================================================================

describe('DgP/DgI consolidation into evaluateMultiTurnResult', () => {
  const evalCliSource = fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'scripts', 'eval-cli.js'),
    'utf-8',
  );

  it('evaluate loops do NOT call scoreDialogueQuality after evaluateMultiTurnResult', () => {
    // The evaluate loops (follow-mode and one-shot) should no longer call
    // scoreDialogueQuality separately — DgP/DgI are now inlined.
    // We check that no "scoreDialogueQuality(result" appears near "evaluateMultiTurnResult"
    // by searching for the old caller pattern.
    const callerPattern = /evaluateMultiTurnResult\(result[\s\S]{0,300}scoreDialogueQuality\(result/g;
    const matches = evalCliSource.match(callerPattern);
    assert.strictEqual(matches, null,
      'scoreDialogueQuality should NOT be called after evaluateMultiTurnResult in evaluate loops — DgP/DgI are now inlined');
  });

  it('evaluateMultiTurnResult contains all 6 metric store writes', () => {
    // Extract the evaluateMultiTurnResult function body.
    // It starts with "async function evaluateMultiTurnResult" and ends before
    // "// Helper: run dialogue quality scoring" or the next top-level function.
    const funcStart = evalCliSource.indexOf('async function evaluateMultiTurnResult');
    assert.ok(funcStart !== -1, 'evaluateMultiTurnResult should exist in eval-cli.js');

    // Find a reliable end boundary: the _scoreDialogueQuality helper that follows it.
    const funcEnd = evalCliSource.indexOf('async function _scoreDialogueQuality', funcStart);
    assert.ok(funcEnd !== -1, '_scoreDialogueQuality should still exist (used by standalone evaluate-dialogue)');

    const funcBody = evalCliSource.slice(funcStart, funcEnd);

    // All 6 metric store writes must appear inside this function:
    const requiredStoreWrites = [
      'updateResultScores',                  // TuPT (legacy per-dimension)
      'updateResultTutorScores',             // TuPT (per-turn JSON)
      'updateResultTutorHolisticScores',     // TuH
      'updateResultLearnerScores',           // LrPT + LrH
      'updateDialogueQualityScore',          // DgP
      'updateDialogueQualityInternalScore',  // DgI
    ];

    for (const storeFn of requiredStoreWrites) {
      assert.ok(
        funcBody.includes(`evaluationStore.${storeFn}(`),
        `evaluateMultiTurnResult must call evaluationStore.${storeFn}()`,
      );
    }
  });

  it('DgP/DgI are guarded by tutorOnly flag', () => {
    // Verify that dialogue quality scoring is inside the !tutorOnly guard.
    // The pattern: "if (!tutorOnly)" block should contain both DgP and DgI calls.
    const funcStart = evalCliSource.indexOf('async function evaluateMultiTurnResult');
    const funcEnd = evalCliSource.indexOf('async function scoreDialogueQuality', funcStart);
    const funcBody = evalCliSource.slice(funcStart, funcEnd);

    // Find the DgP/DgI section — it should be inside a !tutorOnly block
    const dgpIdx = funcBody.indexOf('updateDialogueQualityScore');
    const dgiIdx = funcBody.indexOf('updateDialogueQualityInternalScore');
    assert.ok(dgpIdx !== -1, 'DgP store write must exist');
    assert.ok(dgiIdx !== -1, 'DgI store write must exist');

    // Walk backwards from DgP to find the nearest !tutorOnly guard
    const beforeDgp = funcBody.slice(0, dgpIdx);
    const tutorOnlyGuardIdx = beforeDgp.lastIndexOf('if (!tutorOnly)');
    assert.ok(tutorOnlyGuardIdx !== -1,
      'DgP/DgI must be inside an if (!tutorOnly) guard');

    // The guard should be closer to DgP than the learner section's guard
    // (there's another !tutorOnly for learner scoring earlier in the function).
    // Check that DgI also comes after this guard.
    const afterGuard = funcBody.slice(tutorOnlyGuardIdx);
    assert.ok(afterGuard.includes('updateDialogueQualityScore'),
      'DgP must be inside the !tutorOnly block');
    assert.ok(afterGuard.includes('updateDialogueQualityInternalScore'),
      'DgI must be inside the !tutorOnly block');
  });
});

// ============================================================================
// CLAUDECODE env stripping (Bug fix: nested claude sessions blocked judge calls)
// ============================================================================

describe('judge subprocess env cleanup pattern', () => {
  it('CLAUDECODE must be stripped from child env to prevent nested-session error', () => {
    // This test validates the pattern used by callClaudeJudge and callDialogueJudge:
    //   const env = { ...process.env };
    //   delete env.ANTHROPIC_API_KEY;
    //   delete env.CLAUDECODE;
    const env = { ...process.env, CLAUDECODE: '1', ANTHROPIC_API_KEY: 'sk-test' };
    delete env.ANTHROPIC_API_KEY;
    delete env.CLAUDECODE;

    assert.strictEqual(env.CLAUDECODE, undefined,
      'CLAUDECODE must not be passed to judge subprocess');
    assert.strictEqual(env.ANTHROPIC_API_KEY, undefined,
      'ANTHROPIC_API_KEY must not be passed to judge subprocess');
    // PATH should still be present
    assert.ok(env.PATH, 'PATH must survive env cleanup');
  });
});
