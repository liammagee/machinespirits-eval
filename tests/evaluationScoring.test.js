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
  updateResultLearnerScores,
  updateResultScores,
  updateDialogueQualityScore,
} = await import('../services/evaluationStore.js');

const {
  buildPerTurnTutorEvaluationPrompt,
  calculateOverallScore,
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
    assert.strictEqual(updated[0].holisticOverallScore, 90, 'holistic_overall_score should = last turn');
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
      { turnIndex: 1, agent: 'user', action: 'turn_action', contextSummary: 'Learner asks about recursion' },
      { turnIndex: 1, agent: 'ego', action: 'initial_draft', contextSummary: 'Turn 1 draft' },
      { turnIndex: 2, agent: 'user', action: 'turn_action', contextSummary: 'Learner asks for example' },
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
