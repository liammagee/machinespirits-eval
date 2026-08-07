import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

import { migrateEvaluationDatabase } from '../services/evaluationStore/migrations.js';
import { createRunManifestWriter } from '../services/evaluationStore/runManifestWriter.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function seedRubricVersions(db, runId) {
  db.prepare(
    `INSERT INTO evaluation_runs (id, created_at, status, metadata)
     VALUES (?, '2026-08-07T00:00:00.000Z', 'completed', '{}')`,
  ).run(runId);
  const insert = db.prepare(
    `INSERT INTO evaluation_results (
      id, run_id, scenario_id, provider, model, success,
      tutor_rubric_version, created_at
    ) VALUES (?, ?, ?, 'test', 'test-model', 1, ?, '2026-08-07T01:00:00.000Z')`,
  );
  insert.run(1, runId, 'scenario-b', '2.2');
  insert.run(2, runId, 'scenario-a', '2.1');
  insert.run(3, runId, 'scenario-c', null);
}

function manifestResults() {
  return [
    {
      id: 1,
      dialogueId: 'dialogue-1',
      dialogueContentHash: 'dialogue-hash-1',
      configHash: 'config-z-old',
      profileName: 'profile-z',
      scenarioId: 'scenario-b',
      attemptIndex: 0,
      learnerId: 'learner-1',
      judgeModel: 'judge-b',
      promptContentHash: 'prompt-hash-1',
      tutorEgoPromptVersion: 'ego-v1',
      tutorSuperegoPromptVersion: 'superego-v1',
      learnerPromptVersion: 'learner-v1',
    },
    {
      id: 2,
      configHash: 'config-a',
      profileName: 'profile-a',
      scenarioId: 'scenario-a',
      attemptIndex: null,
      judgeModel: 'judge-a',
    },
    {
      id: 3,
      dialogueId: 'dialogue-3',
      configHash: 'config-z-new',
      profileName: 'profile-z',
      scenarioId: 'scenario-c',
      attemptIndex: 2,
    },
  ];
}

describe('evaluation-store run-manifest writer', () => {
  it('writes the exact completion provenance projection with deterministic indexes', () => {
    const db = new Database(':memory:');
    migrateEvaluationDatabase(db);
    const logsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluation-run-manifest-'));
    const runId = 'eval-manifest';
    const results = manifestResults();
    const uniqueCalls = [];
    seedRubricVersions(db, runId);
    const writer = createRunManifestWriter({
      db,
      logsRoot,
      uniqueGenerationResults: (rows) => {
        uniqueCalls.push(rows);
        return [rows[0], rows[2]];
      },
      expectedTestsForRun: () => 6,
    });

    try {
      const returned = writer.writeRunManifest(
        runId,
        {
          createdAt: '2026-08-07T00:00:00.000Z',
          gitCommit: 'abc123',
          packageVersion: '0.7.0',
          description: 'manifest run',
        },
        results,
        '2026-08-07T02:00:00.000Z',
      );
      assert.equal(returned, undefined);
      assert.deepEqual(uniqueCalls, [results]);

      const expected = {
        run_id: runId,
        created_at: '2026-08-07T00:00:00.000Z',
        completed_at: '2026-08-07T02:00:00.000Z',
        git_commit: 'abc123',
        package_version: '0.7.0',
        description: 'manifest run',
        total_rows: 3,
        total_generations: 2,
        expected_tests: 6,
        profiles: ['profile-a', 'profile-z'],
        scenarios: ['scenario-a', 'scenario-b', 'scenario-c'],
        judge_models: ['judge-a', 'judge-b'],
        rubric_versions: ['2.1', '2.2'],
        config_hashes: { 'profile-z': 'config-z-new', 'profile-a': 'config-a' },
        rows: {
          1: {
            dialogueId: 'dialogue-1',
            dialogueContentHash: 'dialogue-hash-1',
            configHash: 'config-z-old',
            profileName: 'profile-z',
            scenarioId: 'scenario-b',
            attemptIndex: 0,
            learnerId: 'learner-1',
            judgeModel: 'judge-b',
            tutorRubricVersion: '2.2',
            promptContentHash: 'prompt-hash-1',
            tutorEgoPromptVersion: 'ego-v1',
            tutorSuperegoPromptVersion: 'superego-v1',
            learnerPromptVersion: 'learner-v1',
          },
          2: {
            dialogueId: null,
            dialogueContentHash: null,
            configHash: 'config-a',
            profileName: 'profile-a',
            scenarioId: 'scenario-a',
            attemptIndex: null,
            learnerId: null,
            judgeModel: 'judge-a',
            tutorRubricVersion: '2.1',
            promptContentHash: null,
            tutorEgoPromptVersion: null,
            tutorSuperegoPromptVersion: null,
            learnerPromptVersion: null,
          },
          3: {
            dialogueId: 'dialogue-3',
            dialogueContentHash: null,
            configHash: 'config-z-new',
            profileName: 'profile-z',
            scenarioId: 'scenario-c',
            attemptIndex: 2,
            learnerId: null,
            judgeModel: null,
            tutorRubricVersion: null,
            promptContentHash: null,
            tutorEgoPromptVersion: null,
            tutorSuperegoPromptVersion: null,
            learnerPromptVersion: null,
          },
        },
      };
      const manifestPath = path.join(logsRoot, 'run-manifests', `${runId}.json`);
      assert.equal(fs.existsSync(manifestPath), true);
      assert.equal(fs.readFileSync(manifestPath, 'utf-8'), JSON.stringify(expected, null, 2));
      assert.deepEqual(JSON.parse(fs.readFileSync(manifestPath, 'utf-8')), expected);
    } finally {
      db.close();
      fs.rmSync(logsRoot, { recursive: true, force: true });
    }
  });

  it('still writes a manifest with null row versions when the rubric query is unavailable', () => {
    const logsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluation-run-manifest-query-'));
    const writer = createRunManifestWriter({
      db: {
        prepare: () => {
          throw new Error('legacy schema');
        },
      },
      logsRoot,
      uniqueGenerationResults: (rows) => rows,
      expectedTestsForRun: () => 1,
    });
    try {
      writer.writeRunManifest(
        'eval-legacy',
        { createdAt: '2026-08-07T00:00:00.000Z' },
        [{ id: 9, profileName: 'profile-legacy', scenarioId: 'scenario-legacy' }],
        '2026-08-07T01:00:00.000Z',
      );
      const manifest = JSON.parse(fs.readFileSync(path.join(logsRoot, 'run-manifests', 'eval-legacy.json'), 'utf-8'));
      assert.deepEqual(manifest.rubric_versions, []);
      assert.equal(manifest.rows['9'].tutorRubricVersion, null);
      assert.equal(manifest.git_commit, null);
      assert.equal(manifest.package_version, null);
      assert.equal(manifest.description, null);
    } finally {
      fs.rmSync(logsRoot, { recursive: true, force: true });
    }
  });

  it('swallows directory and write failures so completion remains non-fatal', () => {
    const dependencies = {
      db: { prepare: () => ({ all: () => [] }) },
      logsRoot: '/logs',
      uniqueGenerationResults: (rows) => rows,
      expectedTestsForRun: () => 0,
    };
    const directoryFailure = createRunManifestWriter({
      ...dependencies,
      fileSystem: {
        existsSync: () => {
          throw new Error('directory unavailable');
        },
      },
    });
    const writeFailure = createRunManifestWriter({
      ...dependencies,
      fileSystem: {
        existsSync: () => true,
        writeFileSync: () => {
          throw new Error('disk full');
        },
      },
    });

    assert.doesNotThrow(() => directoryFailure.writeRunManifest('eval-a', {}, [], 'complete'));
    assert.doesNotThrow(() => writeFailure.writeRunManifest('eval-b', {}, [], 'complete'));
  });

  it('keeps manifest wiring inside the explicit factory with bounded owners', () => {
    const facade = fs.readFileSync(path.join(ROOT_DIR, 'services', 'evaluationStore.js'), 'utf-8');
    const factory = fs.readFileSync(
      path.join(ROOT_DIR, 'services', 'evaluationStore', 'createEvaluationStore.js'),
      'utf-8',
    );
    const writer = fs.readFileSync(path.join(ROOT_DIR, 'services', 'evaluationStore', 'runManifestWriter.js'), 'utf-8');
    const runRepository = fs.readFileSync(
      path.join(ROOT_DIR, 'services', 'evaluationStore', 'runRepository.js'),
      'utf-8',
    );

    assert.match(factory, /createRunManifestWriter\(\{/);
    assert.match(factory, /writeRunManifest: runManifestWriter\.writeRunManifest/);
    assert.doesNotMatch(facade, /function writeRunManifest\(|run-manifests|tutor_rubric_version FROM/);
    assert.match(writer, /function writeRunManifest\(/);
    assert.match(runRepository, /writeRunManifest\(runId, run, results, completedAt\)/);
    assert.equal(facade.split('\n').length - 1 <= 170, true);
    assert.equal(writer.split('\n').length - 1 <= 150, true);
  });
});
