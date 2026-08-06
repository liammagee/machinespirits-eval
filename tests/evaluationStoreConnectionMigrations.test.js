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
  it('resolves EVAL_DB_PATH before the repository default', () => {
    assert.equal(
      resolveEvaluationDatabasePath({
        rootDir: '/repo',
        env: { EVAL_DB_PATH: '/isolated/evaluations.db' },
      }),
      '/isolated/evaluations.db',
    );
    assert.equal(resolveEvaluationDatabasePath({ rootDir: '/repo', env: {} }), '/repo/data/evaluations.db');
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

  it('keeps the facade as the only import-time bootstrap owner', () => {
    const facade = fs.readFileSync(path.join(ROOT_DIR, 'services', 'evaluationStore.js'), 'utf8');
    const connection = fs.readFileSync(path.join(ROOT_DIR, 'services', 'evaluationStore', 'connection.js'), 'utf8');
    const migrations = fs.readFileSync(path.join(ROOT_DIR, 'services', 'evaluationStore', 'migrations.js'), 'utf8');

    assert.match(facade, /openEvaluationDatabase\(\{ rootDir: ROOT_DIR \}\)/);
    assert.match(facade, /migrateEvaluationDatabase\(db\)/);
    assert.doesNotMatch(facade, /new Database|ALTER TABLE|CREATE TABLE/);
    assert.equal(connection.split('\n').length - 1 <= 100, true);
    assert.equal(migrations.split('\n').length - 1 <= 500, true);
    assert.equal(facade.split('\n').length - 1 <= 1_250, true);
  });
});
