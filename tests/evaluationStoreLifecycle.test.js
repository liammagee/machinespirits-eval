import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

import { createEvaluationStore, resolveEvaluationLogsRoot } from '../services/evaluationStore/createEvaluationStore.js';
import {
  getDefaultEvaluationStore,
  hasDefaultEvaluationStore,
  startDefaultEvaluationStore,
  stopDefaultEvaluationStore,
} from '../services/evaluationStore/lifecycle.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const boundaryInventory = JSON.parse(
  fs.readFileSync(path.join(ROOT_DIR, 'config', 'evaluation-store-boundary-inventory.json'), 'utf8'),
);
const tempDirs = [];

afterEach(() => {
  stopDefaultEvaluationStore();
  while (tempDirs.length) fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
});

function tempPaths(label) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), `evaluation-store-lifecycle-${label}-`));
  tempDirs.push(rootDir);
  return {
    rootDir,
    databasePath: path.join(rootDir, 'data', 'evaluations.db'),
    logsRoot: path.join(rootDir, 'logs'),
  };
}

describe('explicit evaluation-store lifecycle', () => {
  it('owns, migrates, serves, and idempotently closes a newly opened database', () => {
    const paths = tempPaths('owned');
    const store = createEvaluationStore({
      rootDir: paths.rootDir,
      env: { EVAL_DB_PATH: paths.databasePath, EVAL_LOGS_DIR: paths.logsRoot },
      now: () => new Date('2026-08-07T00:00:00.000Z'),
      randomBytesFn: () => Buffer.from('01020304', 'hex'),
    });

    assert.equal(store.ownsDatabase, true);
    assert.equal(store.isOpen, true);
    assert.equal(fs.existsSync(paths.databasePath), true);
    for (const operation of boundaryInventory.exports.named) {
      assert.equal(typeof store[operation], 'function', `${operation} must be assembled by the explicit factory`);
    }
    const run = store.createRun({ description: 'explicit lifecycle' });
    assert.equal(run.id, 'eval-2026-08-07-01020304');
    assert.equal(store.getRun(run.id).description, 'explicit lifecycle');

    assert.equal(store.close(), true);
    assert.equal(store.close(), false);
    assert.equal(store.isOpen, false);
    assert.throws(() => store.listRuns(), /evaluation store is closed/u);
  });

  it('migrates but does not close a host-supplied connection', () => {
    const paths = tempPaths('external');
    fs.mkdirSync(path.dirname(paths.databasePath), { recursive: true });
    const db = new Database(paths.databasePath);
    const store = createEvaluationStore({
      rootDir: paths.rootDir,
      db,
      logsRoot: paths.logsRoot,
    });

    assert.equal(store.ownsDatabase, false);
    assert.equal(store.createRun({ description: 'mounted host' }).description, 'mounted host');
    assert.equal(store.close(), true);
    assert.equal(db.open, true);
    assert.throws(() => store.listRuns(), /evaluation store is closed/u);
    db.close();
  });

  it('starts one default store explicitly and retains a lazy legacy fallback', () => {
    const paths = tempPaths('default');
    assert.equal(hasDefaultEvaluationStore(), false);
    assert.equal(stopDefaultEvaluationStore(), false);

    const explicit = startDefaultEvaluationStore({
      rootDir: paths.rootDir,
      env: { EVAL_DB_PATH: paths.databasePath, EVAL_LOGS_DIR: paths.logsRoot },
    });
    assert.equal(hasDefaultEvaluationStore(), true);
    assert.equal(startDefaultEvaluationStore(), explicit);
    assert.equal(getDefaultEvaluationStore(), explicit);
    assert.equal(stopDefaultEvaluationStore(), true);
    assert.equal(explicit.isOpen, false);
    assert.equal(hasDefaultEvaluationStore(), false);

    const lazy = getDefaultEvaluationStore({
      rootDir: paths.rootDir,
      env: { EVAL_DB_PATH: paths.databasePath, EVAL_LOGS_DIR: paths.logsRoot },
    });
    assert.notEqual(lazy, explicit);
    assert.equal(lazy.ownsDatabase, true);
    assert.equal(lazy.isOpen, true);
  });

  it('preserves log-root precedence without creating directories', () => {
    const paths = tempPaths('logs');
    const dataHome = path.join(paths.rootDir, 'archive');
    assert.equal(
      resolveEvaluationLogsRoot({
        rootDir: paths.rootDir,
        env: { EVAL_LOGS_DIR: '/explicit/logs', MS_DATA_HOME: dataHome },
      }),
      '/explicit/logs',
    );
    assert.equal(
      resolveEvaluationLogsRoot({ rootDir: paths.rootDir, env: { MS_DATA_HOME: dataHome } }),
      path.join(paths.rootDir, 'logs'),
    );
    fs.mkdirSync(dataHome, { recursive: true });
    assert.equal(
      resolveEvaluationLogsRoot({ rootDir: paths.rootDir, env: { MS_DATA_HOME: dataHome } }),
      path.join(dataHome, 'logs'),
    );
  });

  it('mounts poetics eval surfaces around the host connection without opening a second one', async () => {
    const paths = tempPaths('poetics-host');
    const { createPoeticsBrowserApp } = await import('../scripts/browse-poetics-scripts.js');
    const app = createPoeticsBrowserApp({ dbPath: paths.databasePath, host: '127.0.0.1' });

    try {
      assert.equal(app.locals.evaluationStore.database, app.locals.db);
      assert.equal(app.locals.evaluationStore.ownsDatabase, false);
      assert.equal(app.locals.evaluationStore.isOpen, true);
      assert.equal(app.locals.evaluationStore.close(), true);
      assert.equal(app.locals.db.open, true);
    } finally {
      await app.locals.tutorStubSessionHost?.closeAll?.('test_cleanup');
      if (app.locals.db.open) app.locals.db.close();
    }
  });

  it('keeps application and migration hosts on explicit lifecycle calls', () => {
    const server = fs.readFileSync(path.join(ROOT_DIR, 'server.js'), 'utf8');
    const poetics = fs.readFileSync(path.join(ROOT_DIR, 'scripts', 'browse-poetics-scripts.js'), 'utf8');
    const grader = fs.readFileSync(path.join(ROOT_DIR, 'scripts', 'grade-adaptive-dialogue.js'), 'utf8');

    assert.ok(
      server.indexOf('app.locals.evaluationStore = startDefaultEvaluationStore') <
        server.indexOf('const server = app.listen'),
    );
    assert.match(poetics, /startDefaultEvaluationStore\(\{ rootDir: ROOT, db \}\)/u);
    assert.doesNotMatch(poetics, /openEvaluationDatabase/u);
    assert.match(grader, /openEvaluationDatabase\(\{ rootDir: REPO_ROOT \}\)/u);
    assert.match(grader, /migrateEvaluationDatabase\(db\)/u);
    assert.doesNotMatch(grader, /await import\(['"]\.\.\/services\/evaluationStore\.js['"]\)/u);
  });
});
