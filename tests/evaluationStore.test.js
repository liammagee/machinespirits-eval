/**
 * Tests for evaluationStore — database CRUD operations.
 *
 * Covers:
 *   - createRun / getRun — creating and retrieving evaluation runs
 *   - updateRun / completeRun — updating run status
 *   - storeResult / getResults — storing and retrieving individual results
 *   - parseResultRow — JSON parsing and field mapping from DB rows
 *   - deleteRun — cleanup
 *
 * Uses EVAL_DB_PATH to isolate tests in a temporary database,
 * which is deleted after all tests complete.
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Set up isolated test database BEFORE importing evaluationStore.
// MUST use dynamic import() — static `import` is hoisted above this assignment,
// so evaluationStore.js would open the production DB instead of the temp one.
const testDbPath = path.join(os.tmpdir(), `eval-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.db`);
process.env.EVAL_DB_PATH = testDbPath;

const {
  createRun,
  getRun,
  updateRun,
  completeRun,
  storeResult,
  getResults,
  getRunStats,
  deleteRun,
  listRuns,
  updateResultLearnerScores,
  updateResultScores,
  updateResultTutorScores,
  updateResultTutorHolisticScores,
  updateTutorLastTurnScore,
  updateDialogueQualityScore,
  updateDialogueQualityInternalScore,
} = await import('../services/evaluationStore.js');

// Track test runs for cleanup (still useful for in-test isolation)
const testRunIds = [];

// Cleanup: remove temporary database after all tests
after(() => {
  for (const runId of testRunIds) {
    try {
      deleteRun(runId);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
  // Remove temp DB files
  try {
    fs.unlinkSync(testDbPath);
    // SQLite WAL/SHM files
    try {
      fs.unlinkSync(testDbPath + '-wal');
    } catch (e) {
      /* may not exist */
    }
    try {
      fs.unlinkSync(testDbPath + '-shm');
    } catch (e) {
      /* may not exist */
    }
  } catch (e) {
    // Ignore cleanup errors
  }
  // Restore env
  delete process.env.EVAL_DB_PATH;
});

// ============================================================================
// createRun / getRun
// ============================================================================

describe('createRun', () => {
  it('creates a run and returns an object with id', () => {
    const run = createRun({ description: 'test run' });
    testRunIds.push(run.id);

    assert.ok(run.id, 'should have an id');
    assert.ok(run.id.startsWith('eval-'), 'id should start with eval-');
    assert.strictEqual(run.description, 'test run');
    assert.strictEqual(run.status, 'running');
  });

  it('creates a run with metadata', () => {
    const run = createRun({
      description: 'metadata test',
      totalScenarios: 5,
      totalConfigurations: 3,
      metadata: { profiles: ['cell_1', 'cell_5'], judgeModel: 'test-model' },
    });
    testRunIds.push(run.id);

    assert.strictEqual(run.totalScenarios, 5);
    assert.strictEqual(run.totalConfigurations, 3);
  });

  it('generates unique IDs for each run', () => {
    const run1 = createRun({ description: 'unique test 1' });
    const run2 = createRun({ description: 'unique test 2' });
    testRunIds.push(run1.id, run2.id);

    assert.notStrictEqual(run1.id, run2.id);
  });
});

describe('getRun', () => {
  it('retrieves a created run by ID', () => {
    const created = createRun({ description: 'getRun test' });
    testRunIds.push(created.id);

    const retrieved = getRun(created.id);
    assert.ok(retrieved, 'should find the run');
    assert.strictEqual(retrieved.id, created.id);
    assert.strictEqual(retrieved.description, 'getRun test');
    assert.strictEqual(retrieved.status, 'running');
  });

  it('returns null for non-existent run', () => {
    const result = getRun('non-existent-run-id-12345');
    assert.strictEqual(result, null);
  });

  it('parses metadata JSON correctly', () => {
    const run = createRun({
      description: 'metadata parse test',
      metadata: { profiles: ['cell_1'], judgeModel: 'test-judge' },
    });
    testRunIds.push(run.id);

    const retrieved = getRun(run.id);
    assert.deepStrictEqual(retrieved.metadata.profiles, ['cell_1']);
    assert.strictEqual(retrieved.metadata.judgeModel, 'test-judge');
  });

  it('returns default empty metadata for run without metadata', () => {
    const run = createRun({ description: 'no metadata' });
    testRunIds.push(run.id);

    const retrieved = getRun(run.id);
    assert.ok(typeof retrieved.metadata === 'object');
  });
});

// ============================================================================
// updateRun
// ============================================================================

describe('updateRun', () => {
  it('updates run status to completed', () => {
    const run = createRun({ description: 'update test' });
    testRunIds.push(run.id);

    updateRun(run.id, { status: 'completed' });
    const updated = getRun(run.id);
    assert.strictEqual(updated.status, 'completed');
    assert.ok(updated.completedAt, 'should have completedAt timestamp');
  });

  it('updates run status and total tests', () => {
    const run = createRun({ description: 'total tests update' });
    testRunIds.push(run.id);

    updateRun(run.id, { status: 'running', totalTests: 42 });
    const updated = getRun(run.id);
    assert.strictEqual(updated.totalTests, 42);
  });

  it('merges metadata on update', () => {
    const run = createRun({
      description: 'metadata merge',
      metadata: { original: true },
    });
    testRunIds.push(run.id);

    updateRun(run.id, { metadata: { added: 'value' } });
    const updated = getRun(run.id);
    assert.strictEqual(updated.metadata.original, true, 'should keep original');
    assert.strictEqual(updated.metadata.added, 'value', 'should add new key');
  });
});

// ============================================================================
// storeResult / getResults
// ============================================================================

describe('storeResult', () => {
  it('stores a result and returns a row ID', () => {
    const run = createRun({ description: 'storeResult test' });
    testRunIds.push(run.id);

    const rowId = storeResult(run.id, {
      scenarioId: 'test-scenario',
      scenarioName: 'Test Scenario',
      provider: 'test-provider',
      model: 'test-model',
      profileName: 'cell_1_base_single_unified',
      suggestions: [{ title: 'Test', message: 'Hello' }],
      tutorFirstTurnScore: 75.5,
      baseScore: 80.0,
      recognitionScore: 60.0,
      scores: { relevance: 4, specificity: 3, pedagogical: 4, personalization: 3, actionability: 5, tone: 4 },
      passesRequired: true,
      passesForbidden: true,
      requiredMissing: [],
      forbiddenFound: [],
      judgeModel: 'test-judge/model',
      success: true,
      latencyMs: 1234,
      inputTokens: 100,
      outputTokens: 200,
    });

    assert.ok(rowId > 0, 'should return a positive row ID');
  });

  it('stores a failed result', () => {
    const run = createRun({ description: 'failed result test' });
    testRunIds.push(run.id);

    const rowId = storeResult(run.id, {
      scenarioId: 'test-fail',
      scenarioName: 'Fail Scenario',
      provider: 'test-provider',
      model: 'test-model',
      profileName: 'cell_1_base_single_unified',
      success: false,
      errorMessage: 'API timeout',
      tutorFirstTurnScore: null,
    });

    assert.ok(rowId > 0);
  });

  it('stores result with factor tags', () => {
    const run = createRun({ description: 'factor tags test' });
    testRunIds.push(run.id);

    const rowId = storeResult(run.id, {
      scenarioId: 'test-factors',
      scenarioName: 'Factor Test',
      provider: 'test-provider',
      model: 'test-model',
      profileName: 'cell_7_recog_multi_unified',
      tutorFirstTurnScore: 85,
      factors: {
        recognition: true,
        multi_agent_tutor: true,
        multi_agent_learner: false,
      },
      success: true,
    });

    assert.ok(rowId > 0);
  });
});

describe('getResults', () => {
  it('retrieves results for a run', () => {
    const run = createRun({ description: 'getResults test' });
    testRunIds.push(run.id);

    storeResult(run.id, {
      scenarioId: 'scenario-a',
      scenarioName: 'Scenario A',
      provider: 'test-provider',
      model: 'test-model',
      profileName: 'cell_1_base_single_unified',
      tutorFirstTurnScore: 70,
      success: true,
    });

    storeResult(run.id, {
      scenarioId: 'scenario-b',
      scenarioName: 'Scenario B',
      provider: 'test-provider',
      model: 'test-model',
      profileName: 'cell_1_base_single_unified',
      tutorFirstTurnScore: 85,
      success: true,
    });

    const results = getResults(run.id);
    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].scenarioId, 'scenario-a');
    assert.strictEqual(results[1].scenarioId, 'scenario-b');
  });

  it('filters by scenarioId', () => {
    const run = createRun({ description: 'filter test' });
    testRunIds.push(run.id);

    storeResult(run.id, {
      scenarioId: 'target',
      scenarioName: 'Target',
      provider: 'test-provider',
      model: 'test-model',
      profileName: 'cell_1',
      tutorFirstTurnScore: 90,
      success: true,
    });

    storeResult(run.id, {
      scenarioId: 'other',
      scenarioName: 'Other',
      provider: 'test-provider',
      model: 'test-model',
      profileName: 'cell_1',
      tutorFirstTurnScore: 60,
      success: true,
    });

    const results = getResults(run.id, { scenarioId: 'target' });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].scenarioId, 'target');
    assert.strictEqual(results[0].tutorFirstTurnScore, 90);
  });

  it('returns empty array for run with no results', () => {
    const run = createRun({ description: 'empty results test' });
    testRunIds.push(run.id);

    const results = getResults(run.id);
    assert.deepStrictEqual(results, []);
  });
});

describe('updateResultLearnerScores', () => {
  it('stores learner turn and learner holistic scores on evaluation_results rows', () => {
    const run = createRun({ description: 'learner score update test' });
    testRunIds.push(run.id);

    const rowId = storeResult(run.id, {
      scenarioId: 'learner-score-test',
      scenarioName: 'Learner Score Test',
      provider: 'test-provider',
      model: 'test-model',
      profileName: 'cell_3_base_multi_unified',
      tutorFirstTurnScore: 78,
      success: true,
      dialogueId: 'dialogue-test-123',
    });

    updateResultLearnerScores(rowId, {
      scores: {
        0: {
          turnIndex: 1,
          overallScore: 70,
          scores: {
            learner_authenticity: { score: 4, reasoning: 'test' },
          },
        },
      },
      overallScore: 70,
      judgeModel: 'claude-code/test-judge',
      holisticScores: {
        learner_authenticity: { score: 4, reasoning: 'test' },
        question_quality: { score: 3, reasoning: 'test' },
      },
      holisticOverallScore: 72,
      holisticSummary: 'Learner improves across turns.',
      holisticJudgeModel: 'claude-code/test-judge',
    });

    const results = getResults(run.id);
    assert.strictEqual(results.length, 1);
    const r = results[0];

    assert.strictEqual(r.learnerOverallScore, 70);
    assert.strictEqual(r.learnerJudgeModel, 'claude-code/test-judge');
    assert.ok(r.learnerScores, 'should have learnerScores JSON');
    assert.strictEqual(r.learnerScores['0'].overallScore, 70);

    assert.strictEqual(r.learnerHolisticOverallScore, 72);
    assert.strictEqual(r.learnerHolisticSummary, 'Learner improves across turns.');
    assert.strictEqual(r.learnerHolisticJudgeModel, 'claude-code/test-judge');
    assert.ok(r.learnerHolisticScores, 'should have learnerHolisticScores JSON');
    assert.strictEqual(r.learnerHolisticScores.learner_authenticity.score, 4);
  });
});

// ============================================================================
// parseResultRow (tested indirectly through getResults)
// ============================================================================

describe('parseResultRow (via getResults)', () => {
  it('parses JSON fields correctly', () => {
    const run = createRun({ description: 'parseResultRow test' });
    testRunIds.push(run.id);

    storeResult(run.id, {
      scenarioId: 'parse-test',
      scenarioName: 'Parse Test',
      provider: 'test-provider',
      model: 'test-model',
      profileName: 'cell_5_recog_single_unified',
      hyperparameters: { temperature: 0.3, max_tokens: 2000 },
      suggestions: [{ title: 'Test', message: 'Hello world' }],
      tutorFirstTurnScore: 82,
      baseScore: 85,
      recognitionScore: 70,
      scores: { relevance: 4, specificity: 5, pedagogical: 4, personalization: 3, actionability: 5, tone: 4 },
      passesRequired: true,
      passesForbidden: false,
      requiredMissing: [],
      forbiddenFound: ['quiz'],
      judgeModel: 'openrouter/deepseek-chat',
      success: true,
      latencyMs: 5000,
      inputTokens: 500,
      outputTokens: 300,
      factors: {
        recognition: true,
        multi_agent_tutor: false,
        multi_agent_learner: false,
      },
    });

    const results = getResults(run.id);
    assert.strictEqual(results.length, 1);

    const r = results[0];
    assert.strictEqual(r.scenarioId, 'parse-test');
    assert.strictEqual(r.provider, 'test-provider');
    assert.strictEqual(r.model, 'test-model');
    assert.strictEqual(r.profileName, 'cell_5_recog_single_unified');
    assert.strictEqual(r.tutorFirstTurnScore, 82);
    assert.strictEqual(r.baseScore, 85);
    assert.strictEqual(r.recognitionScore, 70);
    assert.strictEqual(r.passesRequired, true);
    assert.strictEqual(r.passesForbidden, false);
    assert.deepStrictEqual(r.forbiddenFound, ['quiz']);
    assert.strictEqual(r.success, true);
    assert.strictEqual(r.latencyMs, 5000);

    // JSON fields
    assert.ok(r.hyperparameters, 'should have hyperparameters');
    assert.strictEqual(r.hyperparameters.temperature, 0.3);
    assert.ok(Array.isArray(r.suggestions), 'suggestions should be array');
    assert.strictEqual(r.suggestions[0].title, 'Test');

    // Factors
    assert.ok(r.factors, 'should have factors');
    assert.strictEqual(r.factors.recognition, true);
    assert.strictEqual(r.factors.multi_agent_tutor, false);
  });

  it('handles null/missing JSON fields gracefully', () => {
    const run = createRun({ description: 'null fields test' });
    testRunIds.push(run.id);

    storeResult(run.id, {
      scenarioId: 'null-test',
      scenarioName: 'Null Test',
      provider: 'test-provider',
      model: 'test-model',
      profileName: 'cell_1',
      success: true,
      tutorFirstTurnScore: null,
    });

    const results = getResults(run.id);
    const r = results[0];

    assert.ok(r.hyperparameters, 'should have default hyperparameters object');
    assert.ok(Array.isArray(r.suggestions), 'should have empty suggestions array');
    assert.ok(Array.isArray(r.requiredMissing), 'should have empty requiredMissing array');
    assert.ok(Array.isArray(r.forbiddenFound), 'should have empty forbiddenFound array');
    assert.strictEqual(r.tutorFirstTurnScore, null);
  });

  it('maps boolean fields correctly', () => {
    const run = createRun({ description: 'boolean fields test' });
    testRunIds.push(run.id);

    storeResult(run.id, {
      scenarioId: 'bool-test',
      scenarioName: 'Bool Test',
      provider: 'test-provider',
      model: 'test-model',
      profileName: 'cell_1',
      passesRequired: false,
      passesForbidden: true,
      success: false,
      errorMessage: 'test error',
    });

    const results = getResults(run.id);
    const r = results[0];
    assert.strictEqual(r.passesRequired, false);
    assert.strictEqual(r.passesForbidden, true);
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.errorMessage, 'test error');
  });
});

// ============================================================================
// completeRun
// ============================================================================

describe('completeRun', () => {
  it('marks a running run as completed', () => {
    const run = createRun({ description: 'complete test', totalScenarios: 2, totalConfigurations: 1 });
    testRunIds.push(run.id);

    storeResult(run.id, {
      scenarioId: 's1',
      scenarioName: 'S1',
      provider: 'test',
      model: 'test',
      profileName: 'cell_1',
      tutorFirstTurnScore: 80,
      success: true,
    });

    const result = completeRun(run.id);
    assert.strictEqual(result.status, 'completed');
    assert.strictEqual(result.resultsFound, 1);
    assert.ok(result.wasPartial, 'should be partial since only 1 of 2 expected');

    const updated = getRun(run.id);
    assert.strictEqual(updated.status, 'completed');
  });

  it('returns alreadyCompleted for completed run', () => {
    const run = createRun({ description: 'already complete' });
    testRunIds.push(run.id);
    updateRun(run.id, { status: 'completed' });

    const result = completeRun(run.id);
    assert.strictEqual(result.alreadyCompleted, true);
  });

  it('marks run as failed when no results exist', () => {
    const run = createRun({ description: 'no results' });
    testRunIds.push(run.id);

    const result = completeRun(run.id);
    assert.strictEqual(result.status, 'failed');
    assert.strictEqual(result.resultsFound, 0);
  });

  it('throws for non-existent run', () => {
    assert.throws(() => completeRun('non-existent-run-xyz'), /Run not found/);
  });
});

// ============================================================================
// deleteRun
// ============================================================================

describe('deleteRun', () => {
  it('removes run and its results', () => {
    const run = createRun({ description: 'delete test' });
    // Don't add to testRunIds since we delete it manually

    storeResult(run.id, {
      scenarioId: 'del-test',
      scenarioName: 'Delete Test',
      provider: 'test',
      model: 'test',
      profileName: 'cell_1',
      tutorFirstTurnScore: 50,
      success: true,
    });

    // Verify it exists
    assert.ok(getRun(run.id), 'run should exist before delete');
    assert.strictEqual(getResults(run.id).length, 1, 'should have 1 result');

    deleteRun(run.id);

    assert.strictEqual(getRun(run.id), null, 'run should be gone after delete');
    assert.strictEqual(getResults(run.id).length, 0, 'results should be gone after delete');
  });
});

// ============================================================================
// getRunStats
// ============================================================================

describe('getRunStats', () => {
  it('returns aggregate statistics for a run', () => {
    const run = createRun({ description: 'stats test' });
    testRunIds.push(run.id);

    // Store multiple results
    for (let i = 0; i < 3; i++) {
      storeResult(run.id, {
        scenarioId: `stats-s${i}`,
        scenarioName: `Stats ${i}`,
        provider: 'test-provider',
        model: 'test-model',
        profileName: 'cell_1',
        tutorFirstTurnScore: 70 + i * 10,
        scores: { relevance: 3 + i, specificity: 4, pedagogical: 3, personalization: 3, actionability: 4, tone: 4 },
        passesRequired: true,
        passesForbidden: true,
        success: true,
        latencyMs: 1000 + i * 500,
        inputTokens: 100,
        outputTokens: 200,
      });
    }

    const stats = getRunStats(run.id);
    assert.ok(stats.length > 0, 'should have stats');

    const stat = stats[0];
    assert.strictEqual(stat.provider, 'test-provider');
    assert.strictEqual(stat.model, 'test-model');
    assert.strictEqual(stat.totalTests, 3);
    assert.strictEqual(stat.successfulTests, 3);
    assert.ok(stat.avgScore > 0, 'should have average score');
    assert.ok(stat.avgLatencyMs > 0, 'should have average latency');
  });

  it('returns empty array for run with no results', () => {
    const run = createRun({ description: 'empty stats' });
    testRunIds.push(run.id);

    const stats = getRunStats(run.id);
    assert.deepStrictEqual(stats, []);
  });
});

// ============================================================================
// listRuns
// ============================================================================

describe('listRuns', () => {
  it('lists runs including test runs', () => {
    const run = createRun({ description: 'listRuns test marker 9z8y7x' });
    testRunIds.push(run.id);

    const runs = listRuns();
    assert.ok(runs.length > 0, 'should have at least one run');

    const found = runs.find((r) => r.id === run.id);
    assert.ok(found, 'should find our test run');
    assert.strictEqual(found.description, 'listRuns test marker 9z8y7x');
  });

  it('returns runs with enriched fields', () => {
    const run = createRun({ description: 'enriched fields test' });
    testRunIds.push(run.id);

    storeResult(run.id, {
      scenarioId: 'enrich-test',
      scenarioName: 'Enrich Test',
      provider: 'test',
      model: 'test',
      profileName: 'cell_1',
      tutorFirstTurnScore: 75,
      success: true,
    });

    const runs = listRuns();
    const found = runs.find((r) => r.id === run.id);
    assert.ok(found, 'should find the run');
    assert.ok(found.completedResults >= 1, 'should count completed results');
    assert.ok(found.scenarioNames.includes('Enrich Test'), 'should include scenario name');
  });

  it('computes live elapsed duration for running runs even with stale completed_at', async () => {
    const run = createRun({ description: 'resume duration regression test' });
    testRunIds.push(run.id);

    // Simulate a previously completed run that was resumed.
    updateRun(run.id, { status: 'completed' });
    updateRun(run.id, { status: 'running' });

    const first = listRuns().find((r) => r.id === run.id);
    assert.ok(first, 'should find resumed run');
    assert.strictEqual(first.status, 'running');
    assert.ok(first.durationMs != null, 'running run should have elapsed duration');

    await new Promise((resolve) => setTimeout(resolve, 30));

    const second = listRuns().find((r) => r.id === run.id);
    assert.ok(second.durationMs > first.durationMs, 'elapsed duration should continue increasing while running');
  });
});

// ============================================================================
// Score update safety — prevent cross-judge overwrites and holistic clobbering
// ============================================================================

describe('updateTutorLastTurnScore', () => {
  it('writes tutor_last_turn_score and development delta without touching first-turn score or judge_model', () => {
    const run = createRun({ description: 'last-turn score safety test' });
    testRunIds.push(run.id);

    const resultId = storeResult(run.id, {
      scenarioId: 'test_scenario',
      scenarioName: 'Test',
      provider: 'test',
      model: 'test-model',
      profileName: 'cell_1',
      suggestions: [{ text: 'turn 0' }, { text: 'turn 1' }],
      dialogueId: 'dlg-test-1',
    });

    // Simulate initial judging (Turn 0 score)
    updateResultScores(resultId, {
      scores: { relevance: { score: 4, reasoning: null } },
      tutorFirstTurnScore: 75.0,
      baseScore: 70.0,
      judgeModel: 'claude-opus-4.6',
    });

    const before = getResults(run.id, {}).find((r) => r.id === resultId);
    assert.strictEqual(before.tutorFirstTurnScore, 75.0);
    assert.strictEqual(before.judgeModel, 'claude-opus-4.6');
    assert.strictEqual(before.tutorLastTurnScore, null);

    // Now use last-turn-only update (simulating --multiturn-only)
    updateTutorLastTurnScore(resultId, { tutorLastTurnScore: 85.0 });

    const after = getResults(run.id, {}).find((r) => r.id === resultId);
    assert.strictEqual(after.tutorFirstTurnScore, 75.0, 'tutor_first_turn_score must be preserved');
    assert.strictEqual(after.judgeModel, 'claude-opus-4.6', 'judge_model must be preserved');
    assert.strictEqual(after.tutorLastTurnScore, 85.0, 'tutor_last_turn_score should be updated');
    assert.strictEqual(after.tutorDevelopmentScore, 10.0, 'development score should be last - first');
  });
});

describe('updateResultScores cross-judge safety', () => {
  it('overwrites judge_model when updateResultScores is called', () => {
    const run = createRun({ description: 'cross-judge overwrite test' });
    testRunIds.push(run.id);

    const resultId = storeResult(run.id, {
      scenarioId: 'test_scenario',
      scenarioName: 'Test',
      provider: 'test',
      model: 'test-model',
      profileName: 'cell_1',
      suggestions: [{ text: 'response' }],
    });

    // Initial judge: GPT
    updateResultScores(resultId, {
      scores: { relevance: { score: 3, reasoning: null } },
      tutorFirstTurnScore: 65.0,
      baseScore: 60.0,
      judgeModel: 'gpt-5.2',
    });

    const before = getResults(run.id, {}).find((r) => r.id === resultId);
    assert.strictEqual(before.judgeModel, 'gpt-5.2');

    // Danger: updateResultScores with Opus overwrites the GPT label
    updateResultScores(resultId, {
      scores: { relevance: { score: 4, reasoning: null } },
      tutorFirstTurnScore: 80.0,
      baseScore: 75.0,
      judgeModel: 'claude-opus-4.6',
    });

    const after = getResults(run.id, {}).find((r) => r.id === resultId);
    assert.strictEqual(after.judgeModel, 'claude-opus-4.6', 'judge_model IS overwritten by updateResultScores — use --judge filter to prevent');
    assert.strictEqual(after.tutorFirstTurnScore, 80.0);
  });
});

// ============================================================================
// updateTutorLastTurnScore
// ============================================================================

describe('updateTutorLastTurnScore', () => {
  it('stores tutor last-turn score and computes development delta', () => {
    const run = createRun({ description: 'tutor last turn test' });
    testRunIds.push(run.id);

    const rowId = storeResult(run.id, {
      scenarioId: 'multi-turn-test',
      scenarioName: 'Multi Turn Test',
      provider: 'test-provider',
      model: 'test-model',
      profileName: 'cell_60',
      suggestions: [{ title: 'Turn 0' }, { title: 'Turn 1' }, { title: 'Turn 2' }],
      tutorFirstTurnScore: 65.0, // tutor first-turn score
      success: true,
    });

    updateTutorLastTurnScore(rowId, {
      tutorLastTurnScore: 82.5,
    });

    const results = getResults(run.id);
    assert.strictEqual(results.length, 1);
    const r = results[0];

    assert.strictEqual(r.tutorLastTurnScore, 82.5, 'should store last-turn score');
    assert.strictEqual(r.tutorDevelopmentScore, 17.5, 'should compute development delta (82.5 - 65.0)');
    assert.strictEqual(r.tutorFirstTurnScore, 65.0, 'should NOT alter tutor_first_turn_score');
  });

  it('computes negative development delta when tutor regresses', () => {
    const run = createRun({ description: 'negative dev test' });
    testRunIds.push(run.id);

    const rowId = storeResult(run.id, {
      scenarioId: 'regress-test',
      scenarioName: 'Regress Test',
      provider: 'test-provider',
      model: 'test-model',
      profileName: 'cell_60',
      suggestions: [{ title: 'Turn 0' }, { title: 'Turn 1' }],
      tutorFirstTurnScore: 80.0,
      success: true,
    });

    updateTutorLastTurnScore(rowId, { tutorLastTurnScore: 70.0 });

    const r = getResults(run.id)[0];
    assert.strictEqual(r.tutorDevelopmentScore, -10.0, 'should be negative when tutor gets worse');
  });

  it('handles NULL tutor_first_turn_score (first-turn not yet scored)', () => {
    const run = createRun({ description: 'null first-turn test' });
    testRunIds.push(run.id);

    const rowId = storeResult(run.id, {
      scenarioId: 'null-first-turn',
      scenarioName: 'Null First Turn',
      provider: 'test-provider',
      model: 'test-model',
      profileName: 'cell_60',
      suggestions: [{ title: 'Turn 0' }, { title: 'Turn 1' }],
      tutorFirstTurnScore: null, // not yet scored
      success: true,
    });

    updateTutorLastTurnScore(rowId, { tutorLastTurnScore: 75.0 });

    const r = getResults(run.id)[0];
    assert.strictEqual(r.tutorLastTurnScore, 75.0, 'should store last-turn score');
    assert.strictEqual(r.tutorDevelopmentScore, null, 'delta should be NULL when first-turn is NULL');
  });
});

// ============================================================================
// updateDialogueQualityScore
// ============================================================================

describe('updateDialogueQualityScore', () => {
  it('stores dialogue quality score with summary and judge model', () => {
    const run = createRun({ description: 'dialogue quality test' });
    testRunIds.push(run.id);

    const rowId = storeResult(run.id, {
      scenarioId: 'dq-test',
      scenarioName: 'Dialogue Quality Test',
      provider: 'test-provider',
      model: 'test-model',
      profileName: 'cell_60',
      suggestions: [{ title: 'Turn 0' }, { title: 'Turn 1' }],
      tutorFirstTurnScore: 70.0,
      success: true,
    });

    updateDialogueQualityScore(rowId, {
      dialogueQualityScore: 78.5,
      dialogueQualitySummary: 'Good collaborative knowledge building with some missed connections.',
      dialogueQualityJudgeModel: 'claude-opus-4.6',
    });

    const r = getResults(run.id)[0];
    assert.strictEqual(r.dialogueQualityScore, 78.5, 'should store dialogue quality score');
    assert.strictEqual(r.dialogueQualitySummary, 'Good collaborative knowledge building with some missed connections.');
    assert.strictEqual(r.dialogueQualityJudgeModel, 'claude-opus-4.6');
    assert.strictEqual(r.tutorFirstTurnScore, 70.0, 'should NOT alter tutor_first_turn_score');
  });

  it('stores dialogue quality without summary', () => {
    const run = createRun({ description: 'dq minimal test' });
    testRunIds.push(run.id);

    const rowId = storeResult(run.id, {
      scenarioId: 'dq-minimal',
      scenarioName: 'DQ Minimal',
      provider: 'test-provider',
      model: 'test-model',
      profileName: 'cell_60',
      suggestions: [{ title: 'Turn 0' }],
      tutorFirstTurnScore: 80.0,
      success: true,
    });

    updateDialogueQualityScore(rowId, {
      dialogueQualityScore: 65.0,
    });

    const r = getResults(run.id)[0];
    assert.strictEqual(r.dialogueQualityScore, 65.0);
    assert.strictEqual(r.dialogueQualitySummary, null, 'summary should be null when not provided');
    assert.strictEqual(r.dialogueQualityJudgeModel, null, 'judge model should be null when not provided');
  });
});

// ============================================================================
// parseResultRow: new dialogue scoring columns
// ============================================================================

describe('parseResultRow — dialogue scoring columns', () => {
  it('returns NULL for new columns on single-turn rows (never populated)', () => {
    const run = createRun({ description: 'single-turn nulls test' });
    testRunIds.push(run.id);

    storeResult(run.id, {
      scenarioId: 'single-turn',
      scenarioName: 'Single Turn',
      provider: 'test-provider',
      model: 'test-model',
      profileName: 'cell_1',
      suggestions: [{ title: 'Only suggestion' }],
      tutorFirstTurnScore: 85.0,
      success: true,
    });

    const r = getResults(run.id)[0];
    assert.strictEqual(r.tutorLastTurnScore, null, 'should be NULL for single-turn');
    assert.strictEqual(r.tutorDevelopmentScore, null, 'should be NULL for single-turn');
    assert.strictEqual(r.dialogueQualityScore, null, 'should be NULL for single-turn');
    assert.strictEqual(r.dialogueQualitySummary, null, 'should be NULL for single-turn');
    assert.strictEqual(r.dialogueQualityJudgeModel, null, 'should be NULL for single-turn');
  });
});

// ============================================================================
// listRuns metric semantics — verify the six compact-table columns measure
// what they claim to measure.
//
// Each evaluation_results row = one dialogue (one scenario × cell combination).
// "Per-turn" metrics score each turn individually, then average within a dialogue.
// "Holistic" metrics score the entire dialogue trajectory in a single judge call.
// The run-level AVG aggregates across dialogues for the compact runs table.
//
//   TuPT = AVG(tutor per-turn avg per dialogue)     — mean of per-turn tutor rubric scores
//   TuH  = AVG(tutor holistic per dialogue)         — mean of whole-dialogue tutor trajectory assessments
//   LrPT = AVG(learner per-turn avg per dialogue)   — mean of per-turn learner rubric scores
//   LrH  = AVG(learner holistic per dialogue)       — mean of whole-dialogue learner trajectory assessments
//   DgP  = AVG(dialogue quality public per dialogue) — mean of public (ego-only) dialogue quality scores
//   DgI  = AVG(dialogue quality internal per dialogue) — mean of full (ego+superego) dialogue quality scores
// ============================================================================

describe('listRuns metric semantics', () => {
  // Helper: create a run with N results (dialogues), each populated with specific metric values.
  // Each result represents one dialogue (scenario × cell). Returns the run id.
  function createScoredRun(description, results) {
    const run = createRun({ description });
    testRunIds.push(run.id);

    for (const r of results) {
      const resultId = storeResult(run.id, {
        scenarioId: r.scenarioId || 'scenario-1',
        scenarioName: r.scenarioName || 'Test Scenario',
        provider: 'test',
        model: 'test-model',
        profileName: r.profileName || 'cell_1',
        suggestions: r.suggestions || [{ text: 'suggestion' }],
        tutorFirstTurnScore: r.tutorFirstTurnScore ?? null,
        success: true,
        judgeModel: r.judgeModel || 'test-judge',
      });

      // TuPT: per-turn tutor scores → tutor_overall_score
      if (r.tutorOverallScore != null) {
        updateResultTutorScores(resultId, {
          tutorScores: r.tutorScores || { 0: { overallScore: r.tutorOverallScore } },
          tutorOverallScore: r.tutorOverallScore,
          tutorFirstTurnScore: r.tutorFirstTurnScore ?? r.tutorOverallScore,
          tutorLastTurnScore: r.tutorLastTurnScore ?? r.tutorOverallScore,
          tutorDevelopmentScore: r.tutorDevelopmentScore ?? 0,
        });
      }

      // TuH: holistic tutor trajectory score
      if (r.tutorHolisticScore != null) {
        updateResultTutorHolisticScores(resultId, {
          holisticScores: { trajectory: { score: r.tutorHolisticScore } },
          holisticOverallScore: r.tutorHolisticScore,
          holisticSummary: 'test holistic summary',
          holisticJudgeModel: 'test-judge',
        });
      }

      // LrPT + LrH: learner per-turn and holistic scores (both via same update fn)
      if (r.learnerOverallScore != null || r.learnerHolisticScore != null) {
        updateResultLearnerScores(resultId, {
          scores: r.learnerScores || { 0: { overallScore: r.learnerOverallScore || 0 } },
          overallScore: r.learnerOverallScore ?? null,
          judgeModel: 'test-judge',
          holisticScores: r.learnerHolisticScore != null
            ? { trajectory: { score: r.learnerHolisticScore } }
            : null,
          holisticOverallScore: r.learnerHolisticScore ?? null,
          holisticSummary: r.learnerHolisticScore != null ? 'learner holistic summary' : null,
          holisticJudgeModel: r.learnerHolisticScore != null ? 'test-judge' : null,
        });
      }

      // DgP: public dialogue quality (ego-only transcript)
      if (r.dialoguePublicScore != null) {
        updateDialogueQualityScore(resultId, {
          dialogueQualityScore: r.dialoguePublicScore,
          dialogueQualitySummary: 'public dialogue summary',
          dialogueQualityJudgeModel: 'test-judge',
        });
      }

      // DgI: internal dialogue quality (full ego+superego transcript)
      if (r.dialogueInternalScore != null) {
        updateDialogueQualityInternalScore(resultId, {
          dialogueQualityInternalScore: r.dialogueInternalScore,
          dialogueQualityInternalSummary: 'internal dialogue summary',
        });
      }
    }

    return run.id;
  }

  function findRun(runId) {
    return listRuns().find((r) => r.id === runId);
  }

  // ── TuPT: tutor per-turn average ──────────────────────────────────────
  // Each dialogue's tutor_overall_score = average of individual tutor turn rubric scores.
  // TuPT aggregates these per-dialogue averages across the run.

  it('TuPT averages per-dialogue tutor turn scores across all dialogues in the run', () => {
    const runId = createScoredRun('TuPT average test', [
      { tutorOverallScore: 80, tutorFirstTurnScore: 80 },  // dialogue 1: tutor avg = 80
      { tutorOverallScore: 60, tutorFirstTurnScore: 60 },  // dialogue 2: tutor avg = 60
    ]);
    const run = findRun(runId);
    assert.strictEqual(run.avgScore, 70.0, 'TuPT should be AVG across dialogues: (80 + 60) / 2 = 70');
  });

  it('TuPT falls back to tutor_first_turn_score when tutor_overall_score is NULL', () => {
    const runId = createScoredRun('TuPT fallback test', [
      { tutorFirstTurnScore: 90 },  // no tutorOverallScore → column is NULL
      { tutorFirstTurnScore: 70 },
    ]);
    const run = findRun(runId);
    assert.strictEqual(run.avgScore, 80.0, 'TuPT should fall back to AVG(tutor_first_turn_score) = 80');
  });

  // ── TuH: tutor holistic trajectory score ──────────────────────────────
  // Each dialogue gets a single holistic tutor score — one judge call that evaluates
  // the tutor's entire contribution across the dialogue, not an average of turn scores.
  // TuH aggregates these per-dialogue holistic scores across the run.

  it('TuH averages per-dialogue holistic tutor trajectory assessments across the run', () => {
    const runId = createScoredRun('TuH holistic test', [
      { tutorOverallScore: 80, tutorFirstTurnScore: 80, tutorHolisticScore: 90 },  // dialogue 1: holistic = 90
      { tutorOverallScore: 60, tutorFirstTurnScore: 60, tutorHolisticScore: 70 },  // dialogue 2: holistic = 70
    ]);
    const run = findRun(runId);
    assert.strictEqual(run.avgTutorHolisticScore, 80.0, 'TuH should be AVG across dialogues: (90 + 70) / 2 = 80');
  });

  it('TuH (holistic trajectory) is independent of TuPT (per-turn average)', () => {
    // Same per-turn average but different holistic trajectory scores — the metrics diverge
    const runId = createScoredRun('TuH independence test', [
      { tutorOverallScore: 50, tutorFirstTurnScore: 50, tutorHolisticScore: 95 },
      { tutorOverallScore: 50, tutorFirstTurnScore: 50, tutorHolisticScore: 85 },
    ]);
    const run = findRun(runId);
    assert.strictEqual(run.avgScore, 50.0, 'TuPT = 50 (per-turn rubric average)');
    assert.strictEqual(run.avgTutorHolisticScore, 90.0, 'TuH = 90 (whole-dialogue trajectory assessment)');
  });

  it('TuH falls back to tutor_last_turn_score when no holistic judge has run', () => {
    const runId = createScoredRun('TuH fallback test', [
      { tutorOverallScore: 70, tutorFirstTurnScore: 60, tutorLastTurnScore: 80 },
      { tutorOverallScore: 70, tutorFirstTurnScore: 60, tutorLastTurnScore: 90 },
    ]);
    const run = findRun(runId);
    assert.strictEqual(run.avgTutorHolisticScore, 85.0,
      'TuH should fall back to AVG(tutor_last_turn_score) = 85 when holistic is NULL');
  });

  // ── LrPT: learner per-turn average ────────────────────────────────────
  // Each dialogue's learner_overall_score = average of individual learner turn rubric scores.
  // LrPT aggregates these per-dialogue averages across the run.

  it('LrPT averages per-dialogue learner turn scores across all dialogues in the run', () => {
    const runId = createScoredRun('LrPT average test', [
      { tutorFirstTurnScore: 80, learnerOverallScore: 70 },  // dialogue 1: learner avg = 70
      { tutorFirstTurnScore: 80, learnerOverallScore: 50 },  // dialogue 2: learner avg = 50
    ]);
    const run = findRun(runId);
    assert.strictEqual(run.avgLearnerScore, 60.0, 'LrPT should be AVG across dialogues: (70 + 50) / 2 = 60');
  });

  it('LrPT and TuPT are independent — tutor and learner per-turn scores are separate axes', () => {
    const runId = createScoredRun('LrPT/TuPT independence', [
      { tutorOverallScore: 90, tutorFirstTurnScore: 90, learnerOverallScore: 40 },
      { tutorOverallScore: 80, tutorFirstTurnScore: 80, learnerOverallScore: 60 },
    ]);
    const run = findRun(runId);
    assert.strictEqual(run.avgScore, 85.0, 'TuPT = 85 (tutor axis)');
    assert.strictEqual(run.avgLearnerScore, 50.0, 'LrPT = 50 (learner axis, independent of tutor)');
  });

  // ── LrH: learner holistic trajectory score ────────────────────────────
  // Each dialogue gets a single holistic learner score — one judge call that evaluates
  // the learner's entire arc across the dialogue (engagement growth, deepening inquiry,
  // revision of misconceptions), not an average of turn scores.
  // LrH aggregates these per-dialogue holistic scores across the run.

  it('LrH averages per-dialogue holistic learner trajectory assessments across the run', () => {
    const runId = createScoredRun('LrH holistic test', [
      { tutorFirstTurnScore: 80, learnerOverallScore: 60, learnerHolisticScore: 75 },  // dialogue 1: holistic = 75
      { tutorFirstTurnScore: 80, learnerOverallScore: 60, learnerHolisticScore: 55 },  // dialogue 2: holistic = 55
    ]);
    const run = findRun(runId);
    assert.strictEqual(run.avgLearnerHolisticScore, 65.0, 'LrH should be AVG across dialogues: (75 + 55) / 2 = 65');
  });

  it('LrH (holistic trajectory) is independent of LrPT (per-turn average)', () => {
    // Same per-turn average but different holistic trajectory scores — the metrics diverge
    const runId = createScoredRun('LrH independence test', [
      { tutorFirstTurnScore: 80, learnerOverallScore: 40, learnerHolisticScore: 80 },
      { tutorFirstTurnScore: 80, learnerOverallScore: 40, learnerHolisticScore: 90 },
    ]);
    const run = findRun(runId);
    assert.strictEqual(run.avgLearnerScore, 40.0, 'LrPT = 40 (per-turn rubric average)');
    assert.strictEqual(run.avgLearnerHolisticScore, 85.0, 'LrH = 85 (whole-dialogue trajectory assessment)');
  });

  // ── DgP: public dialogue quality (ego-only transcript) ─────────────────
  // Each dialogue gets a DgP score from a judge that sees only the public transcript
  // (what tutor and learner actually said to each other — ego outputs only).
  // DgP aggregates these per-dialogue scores across the run.

  it('DgP averages per-dialogue public-transcript quality scores across the run', () => {
    const runId = createScoredRun('DgP public test', [
      { tutorFirstTurnScore: 80, dialoguePublicScore: 60 },  // dialogue 1: public quality = 60
      { tutorFirstTurnScore: 80, dialoguePublicScore: 80 },  // dialogue 2: public quality = 80
    ]);
    const run = findRun(runId);
    assert.strictEqual(run.avgDialogueScore, 70.0, 'DgP should be AVG across dialogues: (60 + 80) / 2 = 70');
  });

  // ── DgI: internal dialogue quality (ego+superego transcript) ──────────
  // Each dialogue gets a DgI score from a judge that sees the full trace including
  // internal superego deliberation, ego revision reasoning, and learner internal monologue.
  // DgI aggregates these per-dialogue scores across the run.

  it('DgI averages per-dialogue full-trace quality scores across the run', () => {
    const runId = createScoredRun('DgI internal test', [
      { tutorFirstTurnScore: 80, dialogueInternalScore: 55 },  // dialogue 1: full-trace quality = 55
      { tutorFirstTurnScore: 80, dialogueInternalScore: 75 },  // dialogue 2: full-trace quality = 75
    ]);
    const run = findRun(runId);
    assert.strictEqual(run.avgDialogueInternalScore, 65.0, 'DgI should be AVG across dialogues: (55 + 75) / 2 = 65');
  });

  // ── DgP vs DgI: public and internal transcripts can diverge ───────────

  it('DgP and DgI diverge because they judge different transcript views of the same dialogue', () => {
    // A dialogue can look polished externally (high DgP) while having poor internal
    // deliberation (low DgI), or vice versa.
    const runId = createScoredRun('DgP/DgI divergence test', [
      { tutorFirstTurnScore: 80, dialoguePublicScore: 90, dialogueInternalScore: 50 },
      { tutorFirstTurnScore: 80, dialoguePublicScore: 80, dialogueInternalScore: 40 },
    ]);
    const run = findRun(runId);
    assert.strictEqual(run.avgDialogueScore, 85.0, 'DgP = 85 (public ego-only transcript)');
    assert.strictEqual(run.avgDialogueInternalScore, 45.0, 'DgI = 45 (full ego+superego transcript)');
  });

  // ── All six metrics populated simultaneously ──────────────────────────
  // Each metric reads from a distinct DB column and is aggregated independently.
  // Two dialogues with known values verify all six columns are wired correctly.

  it('all six metrics are independent — each reads from its own DB column per dialogue', () => {
    const runId = createScoredRun('all-six-metrics test', [
      {   // dialogue 1
        tutorOverallScore: 80, tutorFirstTurnScore: 80,  // per-turn tutor avg
        tutorHolisticScore: 70,                          // whole-dialogue tutor trajectory
        learnerOverallScore: 60,                         // per-turn learner avg
        learnerHolisticScore: 50,                        // whole-dialogue learner trajectory
        dialoguePublicScore: 40,                         // public transcript quality
        dialogueInternalScore: 30,                       // full-trace transcript quality
      },
      {   // dialogue 2
        tutorOverallScore: 90, tutorFirstTurnScore: 90,
        tutorHolisticScore: 80,
        learnerOverallScore: 70, learnerHolisticScore: 60,
        dialoguePublicScore: 50, dialogueInternalScore: 40,
      },
    ]);
    const run = findRun(runId);
    assert.strictEqual(run.avgScore, 85.0, 'TuPT = (80+90)/2 — per-turn tutor avg across dialogues');
    assert.strictEqual(run.avgTutorHolisticScore, 75.0, 'TuH = (70+80)/2 — holistic tutor trajectory across dialogues');
    assert.strictEqual(run.avgLearnerScore, 65.0, 'LrPT = (60+70)/2 — per-turn learner avg across dialogues');
    assert.strictEqual(run.avgLearnerHolisticScore, 55.0, 'LrH = (50+60)/2 — holistic learner trajectory across dialogues');
    assert.strictEqual(run.avgDialogueScore, 45.0, 'DgP = (40+50)/2 — public dialogue quality across dialogues');
    assert.strictEqual(run.avgDialogueInternalScore, 35.0, 'DgI = (30+40)/2 — full-trace dialogue quality across dialogues');
  });

  // ── NULL metrics show as null, not zero ───────────────────────────────

  it('unpopulated metrics return null (not zero or NaN)', () => {
    const runId = createScoredRun('null-metrics test', [
      { tutorOverallScore: 75, tutorFirstTurnScore: 75 },
    ]);
    const run = findRun(runId);
    assert.strictEqual(run.avgScore, 75.0, 'TuPT should be populated');
    assert.strictEqual(run.avgLearnerScore, null, 'LrPT should be null when no learner scores');
    assert.strictEqual(run.avgLearnerHolisticScore, null, 'LrH should be null');
    assert.strictEqual(run.avgDialogueScore, null, 'DgP should be null');
    assert.strictEqual(run.avgDialogueInternalScore, null, 'DgI should be null');
  });

  // ── Primary judge filter: rejudged rows are excluded ──────────────────

  it('averages only the primary judge when multiple judges exist', () => {
    const run = createRun({ description: 'primary judge filter test' });
    testRunIds.push(run.id);

    // Result 1: primary judge (judge-A)
    const id1 = storeResult(run.id, {
      scenarioId: 'scenario-1', scenarioName: 'S1',
      provider: 'test', model: 'test', profileName: 'cell_1',
      suggestions: [{ text: 'first' }], tutorFirstTurnScore: 80,
      success: true, judgeModel: 'judge-A',
    });
    updateResultTutorScores(id1, {
      tutorScores: { 0: { overallScore: 80 } },
      tutorOverallScore: 80, tutorFirstTurnScore: 80,
      tutorLastTurnScore: 80, tutorDevelopmentScore: 0,
    });

    // Result 2: primary judge (judge-A)
    const id2 = storeResult(run.id, {
      scenarioId: 'scenario-2', scenarioName: 'S2',
      provider: 'test', model: 'test', profileName: 'cell_1',
      suggestions: [{ text: 'second' }], tutorFirstTurnScore: 60,
      success: true, judgeModel: 'judge-A',
    });
    updateResultTutorScores(id2, {
      tutorScores: { 0: { overallScore: 60 } },
      tutorOverallScore: 60, tutorFirstTurnScore: 60,
      tutorLastTurnScore: 60, tutorDevelopmentScore: 0,
    });

    // Result 3: rejudge row (judge-B) — should be EXCLUDED from average
    const id3 = storeResult(run.id, {
      scenarioId: 'scenario-1', scenarioName: 'S1',
      provider: 'test', model: 'test', profileName: 'cell_1',
      suggestions: [{ text: 'first' }], tutorFirstTurnScore: 99,
      success: true, judgeModel: 'judge-B',
    });
    updateResultTutorScores(id3, {
      tutorScores: { 0: { overallScore: 99 } },
      tutorOverallScore: 99, tutorFirstTurnScore: 99,
      tutorLastTurnScore: 99, tutorDevelopmentScore: 0,
    });

    const found = findRun(run.id);
    assert.strictEqual(found.avgScore, 70.0,
      'TuPT should average only judge-A rows (80, 60) = 70, excluding judge-B row (99)');
  });
});
