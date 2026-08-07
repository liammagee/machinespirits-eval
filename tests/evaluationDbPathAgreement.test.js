/**
 * The writer and the readers must open the same database file.
 *
 * The failure this pins is silent by construction. A run launched from a git
 * worktree wrote `<worktree>/data/evaluations.db`, because that was the store's
 * own rule, while every analysis script opened the shared archive, because that
 * was theirs. Nothing errored: the run finished, the report said it found no
 * rows, and fourteen paid rows sat in a file nobody looked at.
 *
 * So this does not compare two strings. It runs the real writer and a real
 * reader from a fake worktree root and asks the reader for the row the writer
 * just wrote — which is the only question that was ever at stake.
 *
 * The logs root, at the end of the file, had the same split one level down: a
 * relative `EVAL_LOGS_DIR` meant `<rootDir>/x` to a reader and `x` under the
 * working directory to the store.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import { openEvaluationDatabase } from '../services/evaluationStore/connection.js';
import { createEvaluationStore } from '../services/evaluationStore/createEvaluationStore.js';
import { createEvaluationScriptContext } from '../services/evaluationStore/scriptContext.js';
import { openEvaluationDbReadonly } from '../services/evaluationDbReadonly.js';

const tempDirs = [];

after(() => {
  for (const tempDir of tempDirs) fs.rmSync(tempDir, { recursive: true, force: true });
});

function tempDir(label) {
  const created = fs.mkdtempSync(path.join(os.tmpdir(), `db-path-agreement-${label}-`));
  tempDirs.push(created);
  return created;
}

/**
 * The readers take their environment from `process.env`, so the scenario has to
 * be staged there rather than injected. Set a var to null to unset it — which
 * is how EVAL_DB_PATH gets out of the way, since the hermetic runner sets it
 * for every test and it would otherwise decide the answer on its own.
 */
function withEnv(overrides, fn) {
  const previous = {};
  for (const key of Object.keys(overrides)) {
    previous[key] = process.env[key];
    if (overrides[key] == null) delete process.env[key];
    else process.env[key] = overrides[key];
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

/** A data home holding a real archive, as a developer machine has. */
function seedArchive(label) {
  const dataHome = tempDir(label);
  const archive = path.join(dataHome, 'evaluations.db');
  openEvaluationDatabase({ env: { EVAL_DB_PATH: archive } }).close();
  return { dataHome, archive };
}

describe('evaluation database path agreement', () => {
  it('lands a worktree run in the archive its readers open', () => {
    const { dataHome, archive } = seedArchive('home');
    const worktree = tempDir('worktree');
    const shadow = path.join(worktree, 'data', 'evaluations.db');

    withEnv({ MS_DATA_HOME: dataHome, EVAL_DB_PATH: null, EVAL_LOGS_DIR: path.join(worktree, 'logs') }, () => {
      const store = createEvaluationStore({ rootDir: worktree });
      const run = store.createRun({ description: 'run launched from a worktree' });
      store.storeResult(run.id, { scenarioId: 'stuck_student', provider: 'dry-run', model: 'mock' });
      store.close();

      const { db, dbPath, reason } = openEvaluationDbReadonly(worktree);
      assert.equal(reason, null);
      assert.equal(dbPath, archive, 'the reader must open the archive');
      try {
        const found = db.prepare('SELECT COUNT(*) AS rows FROM evaluation_results WHERE run_id = ?').get(run.id);
        assert.equal(found.rows, 1, 'the reader must find the row the writer just wrote');
      } finally {
        db.close();
      }

      // The whole defect in one assertion: the run must not have minted a
      // database beside its own checkout, because nothing would ever read it.
      assert.equal(fs.existsSync(shadow), false, `a worktree-local database was created at ${shadow}`);
    });
  });

  it('agrees on the repository-local database when no archive exists', () => {
    const worktree = tempDir('no-archive');
    const local = path.join(worktree, 'data', 'evaluations.db');

    withEnv(
      {
        MS_DATA_HOME: path.join(worktree, 'absent-data-home'),
        EVAL_DB_PATH: null,
        EVAL_LOGS_DIR: path.join(worktree, 'logs'),
      },
      () => {
        const store = createEvaluationStore({ rootDir: worktree });
        const run = store.createRun({ description: 'run with no archive in reach' });
        store.close();

        const { db, dbPath } = openEvaluationDbReadonly(worktree);
        assert.equal(dbPath, local, 'both sides fall back to the repository-local file');
        try {
          assert.ok(db.prepare('SELECT id FROM evaluation_runs WHERE id = ?').get(run.id));
        } finally {
          db.close();
        }
      },
    );
  });

  it('gives operational scripts the same file the store writes', () => {
    const { dataHome, archive } = seedArchive('script-home');
    const worktree = tempDir('script-worktree');

    withEnv({ MS_DATA_HOME: dataHome, EVAL_DB_PATH: null, EVAL_LOGS_DIR: path.join(worktree, 'logs') }, () => {
      const context = createEvaluationScriptContext({ rootDir: worktree });
      assert.equal(context.databasePath, archive);
      assert.equal(openEvaluationDbReadonly(worktree).dbPath, archive);
    });
  });

  it('lets EVAL_DB_PATH override both sides together', () => {
    const { dataHome } = seedArchive('override-home');
    const worktree = tempDir('override-worktree');
    const isolated = path.join(tempDir('override-isolated'), 'experiment.db');

    withEnv(
      {
        MS_DATA_HOME: dataHome,
        EVAL_DB_PATH: isolated,
        EVAL_LOGS_DIR: path.join(worktree, 'logs'),
      },
      () => {
        const store = createEvaluationStore({ rootDir: worktree });
        const run = store.createRun({ description: 'explicitly isolated run' });
        store.close();

        const { db, dbPath } = openEvaluationDbReadonly(worktree);
        assert.equal(dbPath, isolated, 'an explicit path still selects an isolated database');
        try {
          assert.ok(db.prepare('SELECT id FROM evaluation_runs WHERE id = ?').get(run.id));
        } finally {
          db.close();
        }
      },
    );
  });
});

describe('evaluation logs root agreement', () => {
  it('reads a relative EVAL_LOGS_DIR against the checkout, not the working directory', () => {
    const worktree = tempDir('logs-worktree');
    const anchored = path.join(worktree, 'run-logs');
    const dialogueId = 'dialogue-logs-agreement';
    fs.mkdirSync(path.join(anchored, 'tutor-dialogues'), { recursive: true });
    fs.writeFileSync(path.join(anchored, 'tutor-dialogues', `${dialogueId}.json`), JSON.stringify({ dialogueId }));

    withEnv(
      {
        MS_DATA_HOME: path.join(worktree, 'absent-data-home'),
        EVAL_DB_PATH: path.join(worktree, 'data', 'evaluations.db'),
        EVAL_LOGS_DIR: 'run-logs',
      },
      () => {
        const context = createEvaluationScriptContext({ rootDir: worktree });
        assert.equal(context.logsRoot, anchored, 'a relative setting belongs to the checkout it was set for');

        // The store used to return the setting untouched, so it looked under
        // whatever directory the command happened to be launched from and found
        // nothing there. Asking it for a log a reader can see settles it.
        const store = createEvaluationStore({ rootDir: worktree });
        try {
          assert.deepEqual(store.loadDialogueLog(dialogueId), { dialogueId }, 'the store must look where readers do');
        } finally {
          store.close();
        }
      },
    );
  });

  it('keeps a handed-over run folder reading its own logs', () => {
    const dataHome = tempDir('folder-home');
    const handedOver = tempDir('handed-over-run');
    fs.mkdirSync(path.join(handedOver, 'logs', 'tutor-dialogues'), { recursive: true });

    withEnv({ MS_DATA_HOME: dataHome, EVAL_DB_PATH: null, EVAL_LOGS_DIR: null }, () => {
      // No package.json, no services/ — a run shared as a folder, not a
      // checkout. Its own logs win over an archive it was never part of, and
      // now the store agrees with the readers about that too.
      assert.equal(createEvaluationScriptContext({ rootDir: handedOver }).logsRoot, path.join(handedOver, 'logs'));
    });
  });
});
