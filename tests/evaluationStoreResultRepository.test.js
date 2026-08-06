import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

import { migrateEvaluationDatabase } from '../services/evaluationStore/migrations.js';
import { createResultRepository } from '../services/evaluationStore/resultRepository.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXED_NOW = Date.parse('2026-08-06T05:30:00.000Z');

function expectedTestsForRun(run) {
  if (Number.isInteger(run?.totalTests) && run.totalTests > 0) return run.totalTests;
  return (run?.totalScenarios || 0) * (run?.totalConfigurations || 0) * (Number(run?.metadata?.runsPerConfig) || 1);
}

function createHarness() {
  const db = new Database(':memory:');
  migrateEvaluationDatabase(db);

  const getRun = (runId) => {
    const row = db.prepare('SELECT * FROM evaluation_runs WHERE id = ?').get(runId);
    if (!row) return null;
    return {
      id: row.id,
      createdAt: row.created_at,
      description: row.description,
      totalScenarios: row.total_scenarios,
      totalConfigurations: row.total_configurations,
      totalTests: row.total_tests,
      status: row.status,
      metadata: JSON.parse(row.metadata || '{}'),
      gitCommit: row.git_commit,
      packageVersion: row.package_version,
    };
  };

  const repository = createResultRepository({
    db,
    getTutorRubricVersion: () => '2.2',
    getRun,
    expectedTestsForRun,
    now: () => FIXED_NOW,
  });

  const seedRun = (id = 'eval-source') => {
    db.prepare(
      `INSERT INTO evaluation_runs (
        id, created_at, description, total_scenarios, total_configurations,
        total_tests, metadata, status, git_commit, package_version
      ) VALUES (?, ?, ?, 1, 1, 2, ?, 'running', 'source-sha', '0.7.0')`,
    ).run(id, '2026-08-06T05:00:00.000Z', 'source run', JSON.stringify({ runsPerConfig: 2 }));
    return id;
  };

  return { db, repository, getRun, seedRun };
}

function richGeneration(overrides = {}) {
  return {
    scenarioId: 'scenario-a',
    scenarioName: 'Scenario A',
    scenarioType: 'suggestion',
    provider: 'test-provider',
    model: 'test-model',
    profileName: 'cell_a',
    hyperparameters: { temperature: 0.2 },
    promptId: 'prompt-a',
    egoModel: 'test.ego',
    superegoModel: 'test.superego',
    suggestions: [{ message: 'Preserve this response.' }],
    rawResponse: '{"raw":true}',
    latencyMs: 12,
    inputTokens: 10,
    outputTokens: 20,
    cost: 0.01,
    dialogueRounds: 2,
    deliberationRounds: 1,
    apiCalls: 3,
    dialogueId: 'dialogue-a',
    attemptIndex: 0,
    factors: { recognition: true, multi_agent_tutor: true, multi_agent_learner: false },
    learnerArchitecture: 'ego_superego',
    scoringMethod: 'generation',
    conversationMode: 'messages',
    dialogueContentHash: 'dialogue-hash',
    configHash: 'config-hash',
    tutorEgoPromptVersion: 'ego-v1',
    tutorSuperegoPromptVersion: 'superego-v1',
    learnerPromptVersion: 'learner-v1',
    promptContentHash: 'prompt-hash',
    learnerId: 'learner-a',
    idConstructionTrace: [{ turn: 0, construction: { register: 'witness' } }],
    tutorFirstTurnScore: 81,
    scores: { relevance: 4 },
    passesRequired: true,
    passesForbidden: true,
    success: true,
    ...overrides,
  };
}

describe('evaluation-store result repository', () => {
  it('owns generation provenance, parsing, lookup, and filtered reads', () => {
    const { db, repository, seedRun } = createHarness();
    try {
      const runId = seedRun();
      const id = repository.storeResult(runId, richGeneration());
      const stored = repository.getResultById(id);

      assert.equal(stored.runId, runId);
      assert.equal(stored.attemptIndex, 0);
      assert.deepEqual(stored.hyperparameters, { temperature: 0.2 });
      assert.deepEqual(stored.factors, {
        recognition: true,
        multi_agent_tutor: true,
        multi_agent_learner: false,
      });
      assert.deepEqual(stored.idConstructionTrace, [{ turn: 0, construction: { register: 'witness' } }]);
      assert.equal(stored.createdAt, '2026-08-06T05:30:00.000Z');
      assert.deepEqual(repository.getResults(runId, { scenarioId: 'scenario-a', profileName: 'cell_a' }), [stored]);
      assert.deepEqual(repository.getResults(runId, { scenarioId: 'missing' }), []);
    } finally {
      db.close();
    }
  });

  it('preserves legacy parser fallbacks and aggregates structured tutor dimensions', () => {
    const { db, repository, seedRun } = createHarness();
    try {
      const runId = seedRun();
      const id = repository.storeResult(runId, richGeneration({ scores: null }));
      db.prepare(
        `UPDATE evaluation_results
         SET score_relevance = NULL,
             tutor_scores = ?,
             scores_with_reasoning = NULL
         WHERE id = ?`,
      ).run(
        JSON.stringify({
          0: { scores: { content_accuracy: { score: 3 }, pedagogical_quality: 4 } },
          1: { scores: { content_accuracy: { score: 5 }, pedagogical_quality: 2 } },
        }),
        id,
      );

      assert.deepEqual(repository.getResultById(id).scores, {
        content_accuracy: 4,
        pedagogical_quality: 3,
      });
    } finally {
      db.close();
    }
  });

  it('keeps rejudgments and rubric clones generation-identical but judgment-distinct', () => {
    const { db, repository, getRun, seedRun } = createHarness();
    try {
      const runId = seedRun();
      const sourceId = repository.storeResult(runId, richGeneration());
      const source = repository.getResultById(sourceId);
      const rejudgedId = repository.storeRejudgment(source, {
        tutorFirstTurnScore: 92,
        scores: { relevance: { score: 5, reasoning: 'same generation' } },
        passesRequired: true,
        passesForbidden: true,
        judgeModel: 'judge-b',
        summary: 'new judgment',
      });
      const rejudged = repository.getResultById(rejudgedId);

      assert.equal(repository.generationIdentity(source), repository.generationIdentity(rejudged));
      assert.equal(rejudged.scoringMethod, 'rubric');
      assert.equal(rejudged.tutorFirstTurnScore, 92);
      assert.equal(rejudged.judgeModel, 'judge-b');

      const firstClone = repository.cloneRowsForRubricVersion(runId, [source, rejudged], '3.0');
      assert.equal(firstClone.clonedIds.length, 1);
      assert.deepEqual(repository.cloneRowsForRubricVersion(runId, [source], '3.0').clonedIds, []);

      const derived = getRun(firstClone.derivedRunId);
      assert.equal(derived.totalTests, 2);
      assert.equal(derived.gitCommit, 'source-sha');
      assert.equal(derived.packageVersion, '0.7.0');
      assert.deepEqual(derived.metadata, {
        runsPerConfig: 2,
        sourceRunId: runId,
        rubricVersion: '3.0',
        derivedFrom: 'rubric-version-comparison',
      });
      const clone = repository.getResultById(firstClone.clonedIds[0]);
      assert.equal(clone.tutorFirstTurnScore, null);
      assert.equal(clone.dialogueContentHash, source.dialogueContentHash);
    } finally {
      db.close();
    }
  });

  it('keeps repeated attempts distinct while excluding failed generations from completion identity', () => {
    const { db, repository } = createHarness();
    try {
      const first = richGeneration({ attemptIndex: 0, dialogueId: null });
      const second = richGeneration({ attemptIndex: 1, dialogueId: null });
      const failed = richGeneration({ attemptIndex: 2, dialogueId: null, success: false });

      assert.notEqual(repository.generationIdentity(first), repository.generationIdentity(second));
      assert.deepEqual(repository.uniqueGenerationResults([first, first, second, failed]), [first, second]);
    } finally {
      db.close();
    }
  });

  it('leaves the facade as the compatibility/bootstrap owner with bounded modules', () => {
    const facade = fs.readFileSync(path.join(ROOT_DIR, 'services', 'evaluationStore.js'), 'utf8');
    const repository = fs.readFileSync(
      path.join(ROOT_DIR, 'services', 'evaluationStore', 'resultRepository.js'),
      'utf8',
    );

    assert.match(facade, /createResultRepository\(\{/);
    assert.doesNotMatch(facade, /GENERATION_PROVENANCE_COLUMNS|INSERT INTO evaluation_results/);
    assert.match(repository, /function storeRejudgment/);
    assert.match(repository, /function cloneRowsForRubricVersion/);
    assert.equal(facade.split('\n').length - 1 <= 1_900, true);
    assert.equal(repository.split('\n').length - 1 <= 650, true);
  });
});
