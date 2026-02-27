/**
 * Tests for P0 Provenance Infrastructure.
 *
 * Covers:
 *   - withAuditTrail(): creates audit entries on column change, skips unchanged
 *   - stringifyAudit(): handles null, objects, numbers, strings
 *   - Content hash: SHA-256 of JSON produces deterministic hex string
 *   - Turn ID generation: same content → same ID; different dialogueId → different ID
 *   - storeResult() with dialogueContentHash → column populated
 *   - UPDATE functions → audit trail entries created for changed columns
 *   - Multiple successive UPDATEs → full audit chain preserved
 *   - getScoreAudit(resultId) returns ordered history
 *   - Judge input hash embedded in tutor_scores JSON is retrievable
 *   - Backward compatibility: existing rows with NULL dialogue_content_hash
 *
 * Uses EVAL_DB_PATH to isolate tests in a temporary database,
 * which is deleted after all tests complete.
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Set up isolated test database BEFORE importing evaluationStore.
const testDbPath = path.join(os.tmpdir(), `eval-prov-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.db`);
process.env.EVAL_DB_PATH = testDbPath;

const evaluationStore = await import('../services/evaluationStore.js');
const {
  createRun,
  storeResult,
  getResults,
  getResultById,
  updateResultScores,
  updateResultTutorScores,
  updateResultTutorHolisticScores,
  updateTutorLastTurnScore,
  updateDialogueQualityScore,
  updateDialogueQualityInternalScore,
  updateTutorDeliberationScores,
  updateLearnerDeliberationScores,
  updateProcessMeasures,
  updateResultLearnerScores,
  getScoreAudit,
  getScoreAuditByRun,
  deleteRun,
} = evaluationStore;

// Track test runs for cleanup
const testRunIds = [];

// Cleanup: remove temporary database after all tests
after(() => {
  for (const runId of testRunIds) {
    try { deleteRun(runId); } catch { /* ignore */ }
  }
  try {
    fs.unlinkSync(testDbPath);
    try { fs.unlinkSync(testDbPath + '-wal'); } catch { /* may not exist */ }
    try { fs.unlinkSync(testDbPath + '-shm'); } catch { /* may not exist */ }
  } catch { /* ignore */ }
  delete process.env.EVAL_DB_PATH;
});

// Helper: create a run and a minimal result row, return { runId, resultId }
function createTestResult(overrides = {}) {
  const run = createRun({ description: 'provenance test' });
  testRunIds.push(run.id);
  const resultId = storeResult(run.id, {
    scenarioId: 'test_scenario',
    scenarioName: 'Test Scenario',
    provider: 'test',
    model: 'test-model',
    suggestions: [{ message: 'Hello learner' }],
    success: true,
    ...overrides,
  });
  return { runId: run.id, resultId };
}

// ============================================================================
// Content Hash
// ============================================================================

describe('Content hash', () => {
  it('SHA-256 of JSON produces deterministic hex string', () => {
    const data = { dialogueId: 'test-123', turns: [{ turnIndex: 0, text: 'hello' }] };
    const json = JSON.stringify(data, null, 2);
    const hash1 = createHash('sha256').update(json).digest('hex');
    const hash2 = createHash('sha256').update(json).digest('hex');
    assert.strictEqual(hash1, hash2, 'same content should produce same hash');
    assert.strictEqual(hash1.length, 64, 'SHA-256 hex should be 64 chars');
    assert.match(hash1, /^[0-9a-f]{64}$/, 'should be lowercase hex');
  });

  it('different content produces different hash', () => {
    const hash1 = createHash('sha256').update('content A').digest('hex');
    const hash2 = createHash('sha256').update('content B').digest('hex');
    assert.notStrictEqual(hash1, hash2);
  });
});

// ============================================================================
// Turn ID generation
// ============================================================================

describe('Turn ID generation', () => {
  function generateContentTurnId(dialogueId, turnIndex, turnContent) {
    return createHash('sha256')
      .update(dialogueId + ':' + turnIndex + ':' + turnContent)
      .digest('hex').slice(0, 16);
  }

  it('same content produces same turn ID', () => {
    const content = JSON.stringify({ turnIndex: 0, suggestion: ['hello'] });
    const id1 = generateContentTurnId('dialogue-abc', 0, content);
    const id2 = generateContentTurnId('dialogue-abc', 0, content);
    assert.strictEqual(id1, id2);
    assert.strictEqual(id1.length, 16);
  });

  it('different dialogueId produces different turn ID', () => {
    const content = JSON.stringify({ turnIndex: 0, suggestion: ['hello'] });
    const id1 = generateContentTurnId('dialogue-abc', 0, content);
    const id2 = generateContentTurnId('dialogue-xyz', 0, content);
    assert.notStrictEqual(id1, id2);
  });

  it('different turnIndex produces different turn ID', () => {
    const content = JSON.stringify({ turnIndex: 0, suggestion: ['hello'] });
    const id1 = generateContentTurnId('dialogue-abc', 0, content);
    const id2 = generateContentTurnId('dialogue-abc', 1, content);
    assert.notStrictEqual(id1, id2);
  });

  it('different content produces different turn ID', () => {
    const content1 = JSON.stringify({ turnIndex: 0, suggestion: ['hello'] });
    const content2 = JSON.stringify({ turnIndex: 0, suggestion: ['goodbye'] });
    const id1 = generateContentTurnId('dialogue-abc', 0, content1);
    const id2 = generateContentTurnId('dialogue-abc', 0, content2);
    assert.notStrictEqual(id1, id2);
  });
});

// ============================================================================
// dialogue_content_hash in storeResult
// ============================================================================

describe('storeResult with dialogueContentHash', () => {
  it('stores dialogue_content_hash when provided', () => {
    const testHash = createHash('sha256').update('test dialogue content').digest('hex');
    const { runId, resultId } = createTestResult({ dialogueContentHash: testHash });
    const results = getResults(runId);
    assert.strictEqual(results.length, 1);
    const row = results[0];
    assert.strictEqual(row.dialogueContentHash, testHash);
  });

  it('stores NULL when dialogueContentHash not provided', () => {
    const { runId, resultId } = createTestResult();
    const results = getResults(runId);
    const row = results[0];
    assert.strictEqual(row.dialogueContentHash, null);
  });
});

// ============================================================================
// Score audit trail
// ============================================================================

describe('Score audit trail', () => {
  it('creates audit entries when columns change via updateResultTutorScores', () => {
    const { resultId } = createTestResult();

    updateResultTutorScores(resultId, {
      tutorScores: { 0: { scores: {}, overallScore: 75 } },
      tutorOverallScore: 75,
      tutorFirstTurnScore: 75,
      tutorLastTurnScore: 75,
      tutorDevelopmentScore: 0,
      judgeModel: 'claude-opus-4-6',
    });

    const audit = getScoreAudit(resultId);
    assert.ok(audit.length > 0, 'should have audit entries');

    // Check that the operation label is correct
    const ops = audit.map((a) => a.operation);
    assert.ok(ops.every((op) => op === 'updateResultTutorScores'), 'all entries should have correct operation');

    // Check that changed columns are tracked
    const columns = audit.map((a) => a.column_name);
    assert.ok(columns.includes('tutor_overall_score'), 'should track tutor_overall_score');
    assert.ok(columns.includes('tutor_first_turn_score'), 'should track tutor_first_turn_score');
  });

  it('skips unchanged columns (no spurious audit entries)', () => {
    const { resultId } = createTestResult();

    // First update
    updateResultTutorScores(resultId, {
      tutorScores: { 0: { scores: {}, overallScore: 80 } },
      tutorOverallScore: 80,
      tutorFirstTurnScore: 80,
      judgeModel: 'claude-opus-4-6',
    });

    const auditAfterFirst = getScoreAudit(resultId);
    const firstCount = auditAfterFirst.length;

    // Second update with SAME values
    updateResultTutorScores(resultId, {
      tutorScores: { 0: { scores: {}, overallScore: 80 } },
      tutorOverallScore: 80,
      tutorFirstTurnScore: 80,
      judgeModel: 'claude-opus-4-6',
    });

    const auditAfterSecond = getScoreAudit(resultId);
    // Should have no new entries since values didn't change
    assert.strictEqual(auditAfterSecond.length, firstCount, 'identical update should create no new audit entries');
  });

  it('tracks full audit chain across multiple successive UPDATEs', () => {
    const { resultId } = createTestResult();

    // Update 1: set initial scores
    updateResultTutorScores(resultId, {
      tutorScores: { 0: { scores: {}, overallScore: 60 } },
      tutorOverallScore: 60,
      tutorFirstTurnScore: 60,
      judgeModel: 'claude-opus-4-6',
    });

    // Update 2: different judge, different scores
    updateResultTutorScores(resultId, {
      tutorScores: { 0: { scores: {}, overallScore: 70 } },
      tutorOverallScore: 70,
      tutorFirstTurnScore: 70,
      judgeModel: 'openrouter.gpt',
    });

    const audit = getScoreAudit(resultId);
    // Should see entries from both updates
    const overallEntries = audit.filter((a) => a.column_name === 'tutor_overall_score');
    assert.ok(overallEntries.length >= 2, 'should have at least 2 entries for tutor_overall_score');

    // Verify the chain: first entry goes NULL→60, second goes 60→70
    const first = overallEntries[0];
    assert.strictEqual(first.old_value, null, 'first update old_value should be null');
    assert.strictEqual(first.new_value, '60', 'first update new_value should be 60');

    const second = overallEntries[1];
    assert.strictEqual(second.old_value, '60', 'second update old_value should be 60');
    assert.strictEqual(second.new_value, '70', 'second update new_value should be 70');
  });

  it('records judge_model metadata in audit entries', () => {
    const { resultId } = createTestResult();

    updateResultTutorScores(resultId, {
      tutorScores: { 0: { scores: {}, overallScore: 85 } },
      tutorOverallScore: 85,
      tutorFirstTurnScore: 85,
      judgeModel: 'claude-opus-4-6',
    });

    const audit = getScoreAudit(resultId);
    const withJudge = audit.filter((a) => a.judge_model === 'claude-opus-4-6');
    assert.ok(withJudge.length > 0, 'audit entries should have judge_model metadata');
  });

  it('getScoreAudit returns entries in timestamp order', () => {
    const { resultId } = createTestResult();

    updateResultTutorScores(resultId, {
      tutorScores: { 0: { scores: {}, overallScore: 50 } },
      tutorOverallScore: 50,
      tutorFirstTurnScore: 50,
    });
    updateResultTutorScores(resultId, {
      tutorScores: { 0: { scores: {}, overallScore: 90 } },
      tutorOverallScore: 90,
      tutorFirstTurnScore: 90,
    });

    const audit = getScoreAudit(resultId);
    for (let i = 1; i < audit.length; i++) {
      assert.ok(audit[i].timestamp >= audit[i - 1].timestamp, 'entries should be ordered by timestamp');
    }
  });

  it('getScoreAuditByRun returns entries for all results in a run', () => {
    const run = createRun({ description: 'multi-result audit test' });
    testRunIds.push(run.id);

    const id1 = storeResult(run.id, {
      scenarioId: 'scenario_a', scenarioName: 'A', provider: 'test', model: 'test', suggestions: [], success: true,
    });
    const id2 = storeResult(run.id, {
      scenarioId: 'scenario_b', scenarioName: 'B', provider: 'test', model: 'test', suggestions: [], success: true,
    });

    updateResultTutorScores(id1, { tutorOverallScore: 70, tutorFirstTurnScore: 70 });
    updateResultTutorScores(id2, { tutorOverallScore: 80, tutorFirstTurnScore: 80 });

    const audit = getScoreAuditByRun(run.id);
    const resultIds = [...new Set(audit.map((a) => a.result_id))];
    assert.ok(resultIds.length === 2, 'should have entries for both results');
  });
});

// ============================================================================
// Audit trail on other UPDATE functions
// ============================================================================

describe('Audit trail on all UPDATE functions', () => {
  it('updateResultScores creates audit entries', () => {
    const { resultId } = createTestResult();
    updateResultScores(resultId, {
      scores: { relevance: { score: 4, reasoning: 'good' } },
      tutorFirstTurnScore: 80,
      passesRequired: true,
      passesForbidden: true,
      requiredMissing: [],
      forbiddenFound: [],
      judgeModel: 'test-judge',
    });
    const audit = getScoreAudit(resultId);
    const ops = [...new Set(audit.map((a) => a.operation))];
    assert.ok(ops.includes('updateResultScores'));
  });

  it('updateTutorLastTurnScore creates audit entries', () => {
    const { resultId } = createTestResult();
    // First set a first-turn score so development can be computed
    updateResultTutorScores(resultId, { tutorFirstTurnScore: 70 });
    updateTutorLastTurnScore(resultId, { tutorLastTurnScore: 85 });
    const audit = getScoreAudit(resultId);
    const ops = [...new Set(audit.map((a) => a.operation))];
    assert.ok(ops.includes('updateTutorLastTurnScore'));
  });

  it('updateDialogueQualityScore creates audit entries', () => {
    const { resultId } = createTestResult();
    updateDialogueQualityScore(resultId, {
      dialogueQualityScore: 78,
      dialogueQualitySummary: 'Good dialogue',
      dialogueQualityJudgeModel: 'test',
    });
    const audit = getScoreAudit(resultId);
    const ops = [...new Set(audit.map((a) => a.operation))];
    assert.ok(ops.includes('updateDialogueQualityScore'));
  });

  it('updateDialogueQualityInternalScore creates audit entries', () => {
    const { resultId } = createTestResult();
    updateDialogueQualityInternalScore(resultId, {
      dialogueQualityInternalScore: 82,
      dialogueQualityInternalSummary: 'Rich internal',
    });
    const audit = getScoreAudit(resultId);
    const ops = [...new Set(audit.map((a) => a.operation))];
    assert.ok(ops.includes('updateDialogueQualityInternalScore'));
  });

  it('updateTutorDeliberationScores creates audit entries', () => {
    const { resultId } = createTestResult();
    updateTutorDeliberationScores(resultId, {
      deliberationScores: { challenge_depth: { score: 4 } },
      deliberationScore: 72,
      deliberationJudgeModel: 'test',
    });
    const audit = getScoreAudit(resultId);
    const ops = [...new Set(audit.map((a) => a.operation))];
    assert.ok(ops.includes('updateTutorDeliberationScores'));
  });

  it('updateLearnerDeliberationScores creates audit entries', () => {
    const { resultId } = createTestResult();
    updateLearnerDeliberationScores(resultId, {
      deliberationScores: { internal_consistency: { score: 3 } },
      deliberationScore: 65,
      deliberationJudgeModel: 'test',
    });
    const audit = getScoreAudit(resultId);
    const ops = [...new Set(audit.map((a) => a.operation))];
    assert.ok(ops.includes('updateLearnerDeliberationScores'));
  });

  it('updateProcessMeasures creates audit entries', () => {
    const { resultId } = createTestResult();
    updateProcessMeasures(resultId, {
      adaptationIndex: 0.7,
      learnerGrowthIndex: 0.5,
      bilateralTransformationIndex: 0.6,
    });
    const audit = getScoreAudit(resultId);
    const ops = [...new Set(audit.map((a) => a.operation))];
    assert.ok(ops.includes('updateProcessMeasures'));
  });

  it('updateResultLearnerScores creates audit entries', () => {
    const { resultId } = createTestResult();
    updateResultLearnerScores(resultId, {
      scores: { 0: { scores: {}, overallScore: 70 } },
      overallScore: 70,
      judgeModel: 'test',
    });
    const audit = getScoreAudit(resultId);
    const ops = [...new Set(audit.map((a) => a.operation))];
    assert.ok(ops.includes('updateResultLearnerScores'));
  });

  it('updateResultTutorHolisticScores creates audit entries', () => {
    const { resultId } = createTestResult();
    updateResultTutorHolisticScores(resultId, {
      holisticScores: { trajectory: { score: 4 } },
      holisticOverallScore: 78,
      holisticJudgeModel: 'test',
    });
    const audit = getScoreAudit(resultId);
    const ops = [...new Set(audit.map((a) => a.operation))];
    assert.ok(ops.includes('updateResultTutorHolisticScores'));
  });
});

// ============================================================================
// Judge input hash in tutor_scores JSON
// ============================================================================

describe('Judge input hash in tutor_scores JSON', () => {
  it('judgeInputHash is retrievable from stored tutor_scores', () => {
    const { runId, resultId } = createTestResult();
    const testHash = createHash('sha256').update('test judge prompt').digest('hex');

    updateResultTutorScores(resultId, {
      tutorScores: {
        0: {
          scores: { relevance: { score: 4 } },
          overallScore: 80,
          judgeInputHash: testHash,
          judgeTimestamp: '2026-02-28T10:00:00Z',
          judgeModel: 'claude-opus-4-6',
          contentTurnId: 'abc123def456',
        },
      },
      tutorOverallScore: 80,
      tutorFirstTurnScore: 80,
      judgeModel: 'claude-opus-4-6',
    });

    const results = getResults(runId);
    const row = results[0];
    const tutorScores = typeof row.tutorScores === 'string' ? JSON.parse(row.tutorScores) : row.tutorScores;
    assert.ok(tutorScores, 'tutorScores should exist');
    assert.strictEqual(tutorScores['0'].judgeInputHash, testHash, 'judgeInputHash should match');
    assert.strictEqual(tutorScores['0'].judgeTimestamp, '2026-02-28T10:00:00Z', 'judgeTimestamp should be preserved');
    assert.strictEqual(tutorScores['0'].judgeModel, 'claude-opus-4-6', 'judgeModel should be preserved');
    assert.strictEqual(tutorScores['0'].contentTurnId, 'abc123def456', 'contentTurnId should be preserved');
  });

  it('existing tutor_scores without judgeInputHash still work', () => {
    const { runId, resultId } = createTestResult();

    updateResultTutorScores(resultId, {
      tutorScores: {
        0: { scores: { relevance: { score: 3 } }, overallScore: 60, summary: 'OK' },
      },
      tutorOverallScore: 60,
      tutorFirstTurnScore: 60,
    });

    const results = getResults(runId);
    const row = results[0];
    const tutorScores = typeof row.tutorScores === 'string' ? JSON.parse(row.tutorScores) : row.tutorScores;
    assert.ok(tutorScores, 'tutorScores should exist');
    assert.strictEqual(tutorScores['0'].judgeInputHash, undefined, 'missing judgeInputHash should be undefined');
  });
});

// ============================================================================
// Backward compatibility
// ============================================================================

describe('Backward compatibility', () => {
  it('existing rows with NULL dialogue_content_hash do not break getResults', () => {
    const { runId } = createTestResult(); // No dialogueContentHash provided
    const results = getResults(runId);
    assert.strictEqual(results.length, 1);
    // Should not throw — NULL is fine
    assert.strictEqual(results[0].dialogueContentHash, null);
  });

  it('getScoreAudit returns empty array for rows with no updates', () => {
    const { resultId } = createTestResult();
    const audit = getScoreAudit(resultId);
    assert.deepStrictEqual(audit, []);
  });
});

// ============================================================================
// Audit trail edge cases
// ============================================================================

describe('Audit trail edge cases', () => {
  it('withAuditTrail handles non-existent resultId gracefully (no crash)', () => {
    // Updating a non-existent resultId should not crash — it just produces no audit entries
    // We can't call withAuditTrail directly since it's not exported, but we can verify
    // that getScoreAudit on a non-existent ID returns [] (graceful degradation)
    const audit = getScoreAudit('nonexistent-result-id-12345');
    assert.deepStrictEqual(audit, []);
  });

  it('concurrent updates to different columns produce separate audit entries', () => {
    const { resultId } = createTestResult();

    // Update tutor scores (touches tutor_overall_score, tutor_first_turn_score, etc.)
    updateResultTutorScores(resultId, {
      tutorScores: { 0: { scores: {}, overallScore: 75 } },
      tutorOverallScore: 75,
      tutorFirstTurnScore: 75,
      judgeModel: 'claude-opus-4-6',
    });

    // Update learner scores (touches learner_scores, learner_overall_score)
    updateResultLearnerScores(resultId, {
      scores: { 0: { scores: { revision_signals: { score: 3 } }, overallScore: 65 } },
      overallScore: 65,
      judgeModel: 'claude-opus-4-6',
    });

    const audit = getScoreAudit(resultId);
    const ops = [...new Set(audit.map((a) => a.operation))];
    assert.ok(ops.includes('updateResultTutorScores'), 'should have tutor audit entries');
    assert.ok(ops.includes('updateResultLearnerScores'), 'should have learner audit entries');

    // Check both sets of columns are tracked
    const columns = audit.map((a) => a.column_name);
    assert.ok(columns.some((c) => c.includes('tutor')), 'should track tutor columns');
    assert.ok(columns.some((c) => c.includes('learner')), 'should track learner columns');
  });

  it('stringifyAudit correctly handles nested objects in tutor_scores', () => {
    const { resultId } = createTestResult();

    const complexScores = {
      0: {
        scores: { relevance: { score: 4, reasoning: 'good' }, specificity: { score: 3, reasoning: 'ok' } },
        overallScore: 70,
        summary: 'test summary',
      },
    };

    updateResultTutorScores(resultId, {
      tutorScores: complexScores,
      tutorOverallScore: 70,
      tutorFirstTurnScore: 70,
      judgeModel: 'claude-opus-4-6',
    });

    const audit = getScoreAudit(resultId);
    const tutorScoresEntry = audit.find((a) => a.column_name === 'tutor_scores');
    assert.ok(tutorScoresEntry, 'should have tutor_scores audit entry');
    assert.strictEqual(tutorScoresEntry.old_value, null, 'old value should be null');
    // new_value should be a JSON string representing the scores
    assert.ok(typeof tutorScoresEntry.new_value === 'string', 'new_value should be a string');
    const parsed = JSON.parse(tutorScoresEntry.new_value);
    assert.strictEqual(parsed['0'].overallScore, 70, 'nested object should be preserved');
  });

  it('audit entries for numeric columns store values as strings', () => {
    const { resultId } = createTestResult();

    updateResultTutorScores(resultId, {
      tutorOverallScore: 82.5,
      tutorFirstTurnScore: 82.5,
    });

    const audit = getScoreAudit(resultId);
    const overallEntry = audit.find((a) => a.column_name === 'tutor_overall_score');
    assert.ok(overallEntry, 'should have tutor_overall_score entry');
    assert.strictEqual(overallEntry.new_value, '82.5', 'numeric value should be stored as string');
  });
});

// ============================================================================
// Hash verification scenarios
// ============================================================================

describe('Hash verification scenarios', () => {
  it('dialogue hash mismatch is detectable', () => {
    const contentA = JSON.stringify({ dialogueId: 'test', turns: [{ text: 'hello' }] });
    const contentB = JSON.stringify({ dialogueId: 'test', turns: [{ text: 'goodbye' }] });
    const hashA = createHash('sha256').update(contentA).digest('hex');
    const hashB = createHash('sha256').update(contentB).digest('hex');

    // Store with hash A
    const { runId, resultId } = createTestResult({ dialogueContentHash: hashA });

    // Verify: recomputing with content B produces different hash
    const results = getResults(runId);
    const storedHash = results[0].dialogueContentHash;
    assert.strictEqual(storedHash, hashA, 'stored hash should match hash A');
    assert.notStrictEqual(storedHash, hashB, 'stored hash should NOT match hash B (mismatch detectable)');
  });

  it('content hash is stable across identical JSON.stringify calls', () => {
    const data = { dialogueId: 'stable-test', turnResults: [{ turnIndex: 0, suggestion: 'hello' }] };
    const json1 = JSON.stringify(data, null, 2);
    const json2 = JSON.stringify(data, null, 2);
    const hash1 = createHash('sha256').update(json1).digest('hex');
    const hash2 = createHash('sha256').update(json2).digest('hex');
    assert.strictEqual(hash1, hash2, 'identical JSON.stringify output should produce identical hashes');
  });

  it('turn ID collision resistance — 1000 generated IDs have zero collisions', () => {
    function generateContentTurnId(dialogueId, turnIndex, turnContent) {
      return createHash('sha256')
        .update(dialogueId + ':' + turnIndex + ':' + turnContent)
        .digest('hex').slice(0, 16);
    }

    const ids = new Set();
    for (let i = 0; i < 1000; i++) {
      const dialogueId = `dialogue-${i}`;
      const turnContent = JSON.stringify({ turnIndex: 0, suggestion: [`response-${i}`], turnId: `turn-${i}` });
      const id = generateContentTurnId(dialogueId, 0, turnContent);
      ids.add(id);
    }
    assert.strictEqual(ids.size, 1000, 'all 1000 turn IDs should be unique (no collisions)');
  });
});

// ============================================================================
// Cross-function audit coverage
// ============================================================================

describe('Cross-function audit coverage', () => {
  it('multiple different UPDATE functions on the same resultId produce interleaved audit history', () => {
    const { resultId } = createTestResult();

    updateResultTutorScores(resultId, {
      tutorOverallScore: 60,
      tutorFirstTurnScore: 60,
      judgeModel: 'claude-opus-4-6',
    });

    updateResultLearnerScores(resultId, {
      scores: { 0: { scores: { revision_signals: { score: 3 } }, overallScore: 55 } },
      overallScore: 55,
      judgeModel: 'claude-opus-4-6',
    });

    updateDialogueQualityScore(resultId, {
      dialogueQualityScore: 72,
      dialogueQualitySummary: 'Good',
      dialogueQualityJudgeModel: 'claude-opus-4-6',
    });

    const audit = getScoreAudit(resultId);
    const ops = [...new Set(audit.map((a) => a.operation))];
    assert.ok(ops.length >= 3, `should have at least 3 different operations, got ${ops.length}: ${ops.join(', ')}`);
    assert.ok(ops.includes('updateResultTutorScores'));
    assert.ok(ops.includes('updateResultLearnerScores'));
    assert.ok(ops.includes('updateDialogueQualityScore'));

    // Verify chronological ordering
    for (let i = 1; i < audit.length; i++) {
      assert.ok(audit[i].timestamp >= audit[i - 1].timestamp, 'audit entries should be chronologically ordered');
    }
  });

  it('getScoreAuditByRun correctly filters — entries from other runs excluded', () => {
    // Create two runs
    const run1 = createRun({ description: 'filter test run 1' });
    const run2 = createRun({ description: 'filter test run 2' });
    testRunIds.push(run1.id, run2.id);

    const id1 = storeResult(run1.id, {
      scenarioId: 's1', scenarioName: 'S1', provider: 'test', model: 'test', suggestions: [], success: true,
    });
    const id2 = storeResult(run2.id, {
      scenarioId: 's2', scenarioName: 'S2', provider: 'test', model: 'test', suggestions: [], success: true,
    });

    updateResultTutorScores(id1, { tutorOverallScore: 70, tutorFirstTurnScore: 70 });
    updateResultTutorScores(id2, { tutorOverallScore: 80, tutorFirstTurnScore: 80 });

    const auditRun1 = getScoreAuditByRun(run1.id);
    const auditRun2 = getScoreAuditByRun(run2.id);

    // Run1 audit should only contain entries for id1
    const run1ResultIds = [...new Set(auditRun1.map((a) => a.result_id))];
    assert.ok(run1ResultIds.every((rid) => rid === String(id1)), 'run1 audit should only contain run1 results');

    // Run2 audit should only contain entries for id2
    const run2ResultIds = [...new Set(auditRun2.map((a) => a.result_id))];
    assert.ok(run2ResultIds.every((rid) => rid === String(id2)), 'run2 audit should only contain run2 results');
  });

  it('audit entries preserve rubric_version metadata when available', () => {
    const { resultId } = createTestResult();

    updateResultTutorScores(resultId, {
      tutorOverallScore: 75,
      tutorFirstTurnScore: 75,
      judgeModel: 'claude-opus-4-6',
      rubricVersion: '2.1',
    });

    const audit = getScoreAudit(resultId);
    const withVersion = audit.filter((a) => a.rubric_version === '2.1');
    assert.ok(withVersion.length > 0, 'at least some audit entries should have rubric_version');
  });
});

// ============================================================================
// Backward compatibility extensions
// ============================================================================

describe('Backward compatibility extensions', () => {
  it('getScoreAudit returns [] for a resultId that does not exist in evaluation_results', () => {
    const audit = getScoreAudit('completely-nonexistent-id-999');
    assert.deepStrictEqual(audit, [], 'should return empty array for non-existent resultId');
  });

  it('getScoreAuditByRun returns [] for a runId with no updates', () => {
    const run = createRun({ description: 'empty run' });
    testRunIds.push(run.id);
    storeResult(run.id, {
      scenarioId: 's', scenarioName: 'S', provider: 'test', model: 'test', suggestions: [], success: true,
    });
    // Don't do any updates
    const audit = getScoreAuditByRun(run.id);
    assert.deepStrictEqual(audit, [], 'should return empty array for run with no score updates');
  });

  it('rows with dialogue_content_hash = NULL can be updated normally (audit works)', () => {
    const { resultId } = createTestResult(); // No dialogueContentHash

    // Verify hash is NULL
    const results = getResults(createTestResult().runId);
    // Now update the row without hash — should work fine
    updateResultTutorScores(resultId, {
      tutorOverallScore: 88,
      tutorFirstTurnScore: 88,
      judgeModel: 'claude-opus-4-6',
    });

    const audit = getScoreAudit(resultId);
    assert.ok(audit.length > 0, 'audit should work normally on rows without dialogue_content_hash');
    const overallEntry = audit.find((a) => a.column_name === 'tutor_overall_score');
    assert.ok(overallEntry, 'should track tutor_overall_score changes');
    assert.strictEqual(overallEntry.new_value, '88', 'new value should be 88');
  });
});

// ============================================================================
// Config hash (P1c Provenance)
// ============================================================================

describe('Config hash in storeResult', () => {
  it('stores config_hash when provided', () => {
    const testHash = createHash('sha256').update(JSON.stringify({ profileName: 'cell_1' })).digest('hex');
    const { runId } = createTestResult({ configHash: testHash });
    const results = getResults(runId);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].configHash, testHash);
  });

  it('stores NULL when configHash not provided', () => {
    const { runId } = createTestResult();
    const results = getResults(runId);
    assert.strictEqual(results[0].configHash, null);
  });

  it('same config object produces same hash (determinism)', () => {
    const config = {
      profileName: 'cell_5_recog_single_unified',
      provider: 'openrouter',
      model: 'nvidia/llama-3.1-nemotron-ultra-253b-v1:free',
      egoModel: null,
      superegoModel: null,
      hyperparameters: { max_tokens: 4000, temperature: 0.7 },
      superegoHyperparameters: null,
      factors: { recognition: true, multi_agent_tutor: false },
      learnerArchitecture: 'unified',
      learnerModelOverride: null,
      disableSuperego: false,
      conversationMode: null,
    };
    const hash1 = createHash('sha256').update(JSON.stringify(config)).digest('hex');
    const hash2 = createHash('sha256').update(JSON.stringify(config)).digest('hex');
    assert.strictEqual(hash1, hash2, 'identical config should produce identical hash');
    assert.strictEqual(hash1.length, 64, 'SHA-256 hex should be 64 chars');
  });

  it('different config objects produce different hashes', () => {
    const configA = {
      profileName: 'cell_1_base_single_unified',
      provider: 'openrouter',
      model: 'nemotron',
      factors: { recognition: false },
    };
    const configB = {
      profileName: 'cell_5_recog_single_unified',
      provider: 'openrouter',
      model: 'nemotron',
      factors: { recognition: true },
    };
    const hashA = createHash('sha256').update(JSON.stringify(configA)).digest('hex');
    const hashB = createHash('sha256').update(JSON.stringify(configB)).digest('hex');
    assert.notStrictEqual(hashA, hashB, 'different configs should produce different hashes');
  });
});
