import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

import { openEvaluationDatabase, resolveEvaluationDatabasePath } from '../services/evaluationStore/connection.js';
import { migrateEvaluationDatabase } from '../services/evaluationStore/migrations.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempDirs = [];

after(() => {
  for (const tempDir of tempDirs) fs.rmSync(tempDir, { recursive: true, force: true });
});

function tempDatabasePath(label) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `evaluation-store-${label}-`));
  tempDirs.push(tempDir);
  return path.join(tempDir, 'missing-parent', 'evaluations.db');
}

function schemaSnapshot(db) {
  return db
    .prepare(
      `SELECT type, name, tbl_name AS tableName, sql
       FROM sqlite_master
       WHERE name NOT LIKE 'sqlite_%'
       ORDER BY type, name`,
    )
    .all();
}

describe('evaluation-store connection owner', () => {
  it('resolves EVAL_DB_PATH, then the shared archive, then the repository default', () => {
    const archive = '/data-home/evaluations.db';
    const env = { MS_DATA_HOME: '/data-home' };
    const archivePresent = { existsSync: (candidate) => candidate === archive };
    const archiveAbsent = { existsSync: () => false };

    assert.equal(
      resolveEvaluationDatabasePath({
        rootDir: '/repo',
        env: { ...env, EVAL_DB_PATH: '/isolated/evaluations.db' },
        fileSystem: archivePresent,
      }),
      '/isolated/evaluations.db',
    );
    // The rule the readers use, now the writer's too: a run launched from a
    // worktree lands in the archive the analysis scripts open, not in a fresh
    // database beside its own checkout that nothing else would ever read.
    assert.equal(
      resolveEvaluationDatabasePath({ rootDir: '/worktree', env, fileSystem: archivePresent }),
      archive,
      'a worktree run must not write beside its own checkout',
    );
    assert.equal(
      resolveEvaluationDatabasePath({ rootDir: '/repo', env, fileSystem: archiveAbsent }),
      '/repo/data/evaluations.db',
    );
    assert.throws(() => resolveEvaluationDatabasePath({ env: {} }), /rootDir is required when EVAL_DB_PATH is not set/);
  });

  it('creates a missing parent and opens the database in WAL mode', () => {
    const databasePath = tempDatabasePath('connection');
    const db = openEvaluationDatabase({ env: { EVAL_DB_PATH: databasePath } });

    assert.equal(fs.existsSync(databasePath), true);
    assert.equal(db.pragma('journal_mode', { simple: true }), 'wal');
    db.close();
  });
});

describe('evaluation-store migration owner', () => {
  it('installs the complete schema idempotently', () => {
    const databasePath = tempDatabasePath('migration');
    const db = openEvaluationDatabase({ env: { EVAL_DB_PATH: databasePath } });

    migrateEvaluationDatabase(db);
    const first = schemaSnapshot(db);
    migrateEvaluationDatabase(db);
    const second = schemaSnapshot(db);

    assert.deepEqual(second, first);
    assert.deepEqual(
      first.filter((entry) => entry.type === 'table').map((entry) => entry.name),
      ['evaluation_results', 'evaluation_runs', 'interaction_evaluations', 'score_audit'],
    );
    db.close();
  });

  it('retypes a legacy TEXT score_audit.result_id and keeps its rows', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE score_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        result_id TEXT NOT NULL,
        column_name TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        operation TEXT NOT NULL,
        judge_model TEXT,
        rubric_version TEXT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO score_audit (id, result_id, column_name, new_value, operation, timestamp)
      VALUES (7, '4711', 'tutor_overall_score', '82', 'updateResultTutorScores', '2026-08-07T00:00:00Z');
    `);

    migrateEvaluationDatabase(db);

    const declaredType = db
      .prepare('PRAGMA table_info(score_audit)')
      .all()
      .find((column) => column.name === 'result_id').type;
    const row = db.prepare('SELECT id, result_id AS resultId, typeof(result_id) AS storage FROM score_audit').get();
    assert.equal(declaredType, 'INTEGER');
    // Stored as a number now, so a Map keyed by evaluation_results.id finds it.
    assert.deepEqual(row, { id: 7, resultId: 4711, storage: 'integer' });
    assert.equal(
      db.prepare(`SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'idx_score_audit_result'`).get().n,
      1,
      'the rebuild must leave the index it dropped',
    );
    db.close();
  });

  it('preserves the evaluator_model rename and first-turn-score backfill', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE evaluation_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT,
        scenario_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        profile_name TEXT,
        created_at DATETIME,
        overall_score REAL,
        evaluator_model TEXT
      );
      INSERT INTO evaluation_results (
        run_id, scenario_id, provider, model, profile_name,
        created_at, overall_score, evaluator_model
      ) VALUES (
        'legacy-run', 'legacy-scenario', 'test', 'test-model', 'cell_legacy',
        datetime('now'), 77, 'legacy-judge'
      );
    `);

    migrateEvaluationDatabase(db);

    const columns = db
      .prepare('PRAGMA table_info(evaluation_results)')
      .all()
      .map((column) => column.name);
    const row = db
      .prepare('SELECT judge_model AS judgeModel, tutor_first_turn_score AS firstTurn FROM evaluation_results')
      .get();
    assert.equal(columns.includes('evaluator_model'), false);
    assert.equal(columns.includes('judge_model'), true);
    assert.deepEqual(row, { judgeModel: 'legacy-judge', firstTurn: 77 });
    db.close();
  });

  it('moves bootstrap into the explicit factory and leaves the facade lazy', () => {
    const facade = fs.readFileSync(path.join(ROOT_DIR, 'services', 'evaluationStore.js'), 'utf8');
    const factory = fs.readFileSync(
      path.join(ROOT_DIR, 'services', 'evaluationStore', 'createEvaluationStore.js'),
      'utf8',
    );
    const lifecycle = fs.readFileSync(path.join(ROOT_DIR, 'services', 'evaluationStore', 'lifecycle.js'), 'utf8');
    const connection = fs.readFileSync(path.join(ROOT_DIR, 'services', 'evaluationStore', 'connection.js'), 'utf8');
    const migrations = fs.readFileSync(path.join(ROOT_DIR, 'services', 'evaluationStore', 'migrations.js'), 'utf8');

    assert.match(factory, /openEvaluationDatabase\(\{/);
    assert.match(factory, /migrateEvaluationDatabase\(db\)/);
    assert.match(lifecycle, /getDefaultEvaluationStore/);
    assert.match(facade, /getDefaultEvaluationStore\(\)\[operation\]/);
    assert.doesNotMatch(
      facade,
      /openEvaluationDatabase|migrateEvaluationDatabase|new Database|ALTER TABLE|CREATE TABLE/,
    );
    assert.equal(connection.split('\n').length - 1 <= 100, true);
    assert.equal(migrations.split('\n').length - 1 <= 500, true);
    assert.equal(factory.split('\n').length - 1 <= 240, true);
    assert.equal(lifecycle.split('\n').length - 1 <= 120, true);
    assert.equal(facade.split('\n').length - 1 <= 170, true);
  });
});
