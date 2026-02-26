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
  updateTutorLastTurnScore,
  updateDialogueQualityScore,
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
