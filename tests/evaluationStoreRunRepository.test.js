import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

import { migrateEvaluationDatabase } from '../services/evaluationStore/migrations.js';
import { createRunRepository } from '../services/evaluationStore/runRepository.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXED_NOW = Date.parse('2026-08-06T02:00:00.000Z');

function generationIdentity(result) {
  const pair = `${result.profileName || ''}:${result.scenarioId || ''}`;
  if (result.attemptIndex != null) return `${pair}:attempt:${result.attemptIndex}`;
  return `${pair}:legacy:${result.dialogueId || result.rawResponse || 'same'}`;
}

function uniqueGenerationResults(results) {
  const unique = new Map();
  for (const result of results) {
    if (result.success === false || result.success === 0) continue;
    const identity = generationIdentity(result);
    if (!unique.has(identity)) unique.set(identity, result);
  }
  return [...unique.values()];
}

function expectedTestsForRun(run) {
  if (Number.isInteger(run?.totalTests) && run.totalTests > 0) return run.totalTests;
  return (run?.totalScenarios || 0) * (run?.totalConfigurations || 0) * (Number(run?.metadata?.runsPerConfig) || 1);
}

function createHarness(overrides = {}) {
  const db = new Database(':memory:');
  migrateEvaluationDatabase(db);
  const resultsByRun = new Map();
  const manifests = [];
  let runNumber = 0;
  const repository = createRunRepository({
    db,
    generateRunId: () => `eval-fixed-${++runNumber}`,
    getResults: (runId) => resultsByRun.get(runId) || [],
    generationIdentity,
    uniqueGenerationResults,
    expectedTestsForRun,
    writeRunManifest: (...args) => manifests.push(args),
    isPidAlive: () => false,
    now: () => FIXED_NOW,
    logger: { log() {} },
    ...overrides,
  });
  return { db, repository, resultsByRun, manifests };
}

describe('evaluation-store run repository', () => {
  it('owns run CRUD and the enriched list projection behind one connection', () => {
    const { db, repository } = createHarness();
    try {
      const created = repository.createRun({
        description: 'repository run',
        totalScenarios: 1,
        totalConfigurations: 1,
        metadata: { gitCommit: 'abc123', packageVersion: '0.7.0', original: true },
      });
      repository.updateRun(created.id, { totalTests: 2, metadata: { added: true } });
      db.prepare(
        `INSERT INTO evaluation_results (
          run_id, scenario_id, scenario_name, provider, model, profile_name,
          ego_model, superego_model, success, tutor_first_turn_score,
          judge_model, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        created.id,
        'scenario-a',
        'Scenario A',
        'test',
        'test-model',
        'cell_a',
        'openrouter.ego-a',
        'openrouter.superego-a',
        1,
        80,
        'judge-a',
        '2026-08-06T01:59:00.000Z',
      );

      const stored = repository.getRun(created.id);
      assert.equal(stored.gitCommit, 'abc123');
      assert.equal(stored.packageVersion, '0.7.0');
      assert.deepEqual(stored.metadata, {
        gitCommit: 'abc123',
        packageVersion: '0.7.0',
        original: true,
        added: true,
      });

      const [listed] = repository.listRuns({ status: 'running', limit: 1 });
      assert.equal(listed.id, created.id);
      assert.equal(listed.completedResults, 1);
      assert.equal(listed.successfulResults, 1);
      assert.equal(listed.avgScore, 80);
      assert.equal(listed.progressPct, 50);
      assert.equal(listed.durationMs, 0);
      assert.deepEqual(listed.scenarioNames, ['Scenario A']);
      assert.deepEqual(listed.profileNames, ['cell_a']);
      assert.deepEqual(listed.models, ['ego-a', 'superego-a']);
      assert.match(listed.modelFingerprint, /^[0-9a-f]{6}$/);
    } finally {
      db.close();
    }
  });

  it('keeps completion and attempt-aware resume accounting on injected result projections', () => {
    const { db, repository, resultsByRun, manifests } = createHarness();
    try {
      const run = repository.createRun({
        description: 'attempt accounting',
        totalScenarios: 1,
        totalConfigurations: 1,
        metadata: { runsPerConfig: 3 },
      });
      repository.updateRun(run.id, { totalTests: 3 });
      const source = {
        profileName: 'cell_a',
        scenarioId: 'scenario-a',
        attemptIndex: 0,
        success: true,
        createdAt: '2026-08-06T01:58:00.000Z',
      };
      resultsByRun.set(run.id, [
        source,
        { ...source, judgeModel: 'second-judge' },
        {
          ...source,
          attemptIndex: 1,
          success: false,
          createdAt: '2026-08-06T01:59:00.000Z',
        },
      ]);

      const resume = repository.getIncompleteTests(run.id, ['cell_a'], [{ id: 'scenario-a', name: 'Scenario A' }]);
      assert.equal(resume.completed, 1);
      assert.deepEqual(
        resume.remainingTests.map((test) => test.attemptIndex),
        [1, 2],
      );

      const completion = repository.completeRun(run.id);
      assert.equal(completion.resultsFound, 1);
      assert.equal(completion.storedRows, 3);
      assert.equal(completion.expectedTests, 3);
      assert.equal(completion.wasPartial, true);
      assert.equal(repository.getRun(run.id).status, 'completed');
      assert.equal(manifests.length, 1);
      assert.equal(manifests[0][0], run.id);
    } finally {
      db.close();
    }
  });

  it('detects stale runs, skips live processes, and completes only dead owners', () => {
    const livePids = new Set([111]);
    const { db, repository } = createHarness({ isPidAlive: (pid) => (pid ? livePids.has(pid) : null) });
    try {
      const live = repository.createRun({ description: 'live', metadata: { pid: 111 } });
      const stale = repository.createRun({ description: 'stale', metadata: { pid: 222 } });
      db.prepare('UPDATE evaluation_runs SET created_at = ? WHERE id IN (?, ?)').run(
        '2026-08-06T00:00:00.000Z',
        live.id,
        stale.id,
      );

      const dryRun = repository.autoCompleteStaleRuns({ olderThanMinutes: 30, dryRun: true });
      assert.equal(dryRun.found, 2);
      assert.equal(dryRun.stale, 1);
      assert.equal(dryRun.skippedAlive, 1);
      assert.deepEqual(
        dryRun.runs.map((run) => run.id),
        [stale.id],
      );

      const completed = repository.autoCompleteStaleRuns({ olderThanMinutes: 30 });
      assert.equal(completed.completed, 1);
      assert.equal(repository.getRun(stale.id).status, 'failed');
      assert.equal(repository.getRun(live.id).status, 'running');
    } finally {
      db.close();
    }
  });

  it('owns aggregate deletion as one four-table transaction', () => {
    const { db, repository } = createHarness();
    try {
      const run = repository.createRun({ description: 'delete aggregate' });
      const resultInfo = db
        .prepare(
          `INSERT INTO evaluation_results (
            run_id, scenario_id, provider, model, success, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(run.id, 'scenario-a', 'test', 'test-model', 1, '2026-08-06T01:59:00.000Z');
      db.prepare(
        `INSERT INTO score_audit (result_id, column_name, operation)
         VALUES (?, 'tutor_first_turn_score', 'test')`,
      ).run(String(resultInfo.lastInsertRowid));
      db.prepare(
        `INSERT INTO interaction_evaluations (id, run_id, scenario_id)
         VALUES ('interaction-a', ?, 'scenario-a')`,
      ).run(run.id);

      assert.deepEqual(repository.deleteRun(run.id), {
        deletedAuditRows: 1,
        deletedResults: 1,
        deletedInteractionEvals: 1,
        deletedRuns: 1,
      });
      for (const table of ['score_audit', 'evaluation_results', 'interaction_evaluations', 'evaluation_runs']) {
        assert.equal(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count, 0);
      }
    } finally {
      db.close();
    }
  });

  it('leaves the facade as compatibility and bootstrap owner only', () => {
    const facade = fs.readFileSync(path.join(ROOT_DIR, 'services', 'evaluationStore.js'), 'utf8');
    const repository = fs.readFileSync(path.join(ROOT_DIR, 'services', 'evaluationStore', 'runRepository.js'), 'utf8');
    const resultRepository = fs.readFileSync(
      path.join(ROOT_DIR, 'services', 'evaluationStore', 'resultRepository.js'),
      'utf8',
    );

    assert.match(facade, /createRunRepository\(\{/);
    assert.doesNotMatch(facade, /SELECT \* FROM evaluation_runs|DELETE FROM evaluation_runs/);
    assert.match(resultRepository, /derivedRunId.*rubricVersion/s, 'derived-run cloning belongs to result persistence');
    assert.match(repository, /DELETE FROM interaction_evaluations WHERE run_id = \?/);
    assert.equal(facade.split('\n').length - 1 <= 975, true);
    assert.equal(repository.split('\n').length - 1 <= 550, true);
  });
});
