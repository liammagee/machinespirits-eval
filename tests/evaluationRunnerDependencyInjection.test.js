import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, describe, it } from 'node:test';

import Database from 'better-sqlite3';

import { createScoringCommandDependencies } from '../scripts/eval-cli/scoringCommandDependencies.js';
import { createEvaluationRunner } from '../services/evaluationRunner.js';
import { hasDefaultEvaluationStore } from '../services/evaluationStore/lifecycle.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempDirs = [];

after(() => {
  for (const tempDir of tempDirs) fs.rmSync(tempDir, { recursive: true, force: true });
});

function fakeStore() {
  const calls = [];
  const store = {
    getRun(runId) {
      calls.push(['getRun', runId]);
      if (runId === 'missing') return null;
      return {
        id: runId,
        createdAt: '2026-08-07T00:00:00.000Z',
        description: 'injected store',
        totalTests: 0,
        status: 'completed',
      };
    },
    getRunStats(runId) {
      calls.push(['getRunStats', runId]);
      return [];
    },
    getScenarioStats(runId) {
      calls.push(['getScenarioStats', runId]);
      return [];
    },
    getResults(runId) {
      calls.push(['getResults', runId]);
      return [];
    },
    getFactorialCellData() {
      return {};
    },
    loadDialogueLog(dialogueId) {
      calls.push(['loadDialogueLog', dialogueId]);
      return { dialogueId };
    },
  };
  return { calls, store };
}

describe('evaluation runner and CLI dependency injection', () => {
  it('binds runner reads and runtime owners to the supplied store without starting the default store', async () => {
    const { calls, store } = fakeStore();
    const runner = createEvaluationRunner({ evaluationStore: store });

    assert.equal(hasDefaultEvaluationStore(), false);
    assert.equal(runner.getRunResults('run-injected').run.description, 'injected store');
    assert.match(runner.generateReport('run-injected'), /injected store/u);
    await assert.rejects(runner.resumeEvaluation({ runId: 'missing' }), /Run not found: missing/u);
    assert.equal(hasDefaultEvaluationStore(), false);
    assert.deepEqual(calls.slice(0, 4), [
      ['getRun', 'run-injected'],
      ['getRunStats', 'run-injected'],
      ['getScenarioStats', 'run-injected'],
      ['getResults', 'run-injected'],
    ]);
  });

  it('builds scoring dependencies around the same runner and store', () => {
    const { calls, store } = fakeStore();
    const runner = createEvaluationRunner({ evaluationStore: store });
    const dependencies = createScoringCommandDependencies({ evaluationRunner: runner, evaluationStore: store });

    const resolved = dependencies.resolveEvaluationScenarioAndDialogueLog({
      scenarioId: 'unknown-scenario',
      dialogueId: 'dialogue-injected',
    });
    assert.equal(dependencies.evaluationRunner, runner);
    assert.equal(dependencies.evaluationStore, store);
    assert.equal(resolved.dialogueLog.dialogueId, 'dialogue-injected');
    assert.deepEqual(calls, [['loadDialogueLog', 'dialogue-injected']]);
  });

  it('fails closed when either host dependency is absent', () => {
    assert.throws(() => createEvaluationRunner(), /evaluationStore dependency is required/u);
    assert.throws(() => createScoringCommandDependencies(), /dependencies are required/u);
  });

  it('keeps help side-effect free and closes an explicitly owned CLI store after a command', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-cli-injection-'));
    tempDirs.push(tempDir);
    const databasePath = path.join(tempDir, 'data', 'evaluations.db');
    const env = {
      ...process.env,
      EVAL_DB_PATH: databasePath,
      EVAL_LOGS_DIR: path.join(tempDir, 'logs'),
      MS_DATA_HOME: path.join(tempDir, 'data-home'),
    };

    const help = execFileSync(process.execPath, ['scripts/eval-cli.js', '--help'], {
      cwd: ROOT_DIR,
      env,
      encoding: 'utf8',
    });
    assert.match(help, /Usage:/u);
    assert.equal(fs.existsSync(databasePath), false);

    const listing = execFileSync(process.execPath, ['scripts/eval-cli.js', 'list'], {
      cwd: ROOT_DIR,
      env,
      encoding: 'utf8',
    });
    assert.match(listing, /Factorial Cells/u);
    assert.equal(fs.existsSync(databasePath), true);

    const database = new Database(databasePath, { readonly: true });
    assert.equal(database.pragma('integrity_check', { simple: true }), 'ok');
    database.close();
  });
});
