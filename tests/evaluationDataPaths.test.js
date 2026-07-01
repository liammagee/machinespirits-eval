import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  resolveConfiguredEvaluationDbPath,
  resolveConfiguredTutorDialoguesDir,
  resolveEvaluationDbPath,
  resolveEvaluationLogsRoot,
  resolveTutorDialoguesDir,
} from '../services/evaluationDataPaths.js';

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

test('evaluation DB path honors explicit and EVAL_DB_PATH overrides', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-path-root-'));
  const dataHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-path-home-'));
  const explicitDb = path.join(root, 'explicit.db');
  const envDb = path.join(root, 'env.db');

  withEnv({ MS_DATA_HOME: dataHome, EVAL_DB_PATH: envDb }, () => {
    assert.equal(resolveEvaluationDbPath(root), envDb);
    assert.equal(resolveEvaluationDbPath(root, explicitDb), explicitDb);
  });
});

test('evaluation DB path falls back to canonical data home before repo data', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-path-root-'));
  const dataHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-path-home-'));
  const dataHomeDb = path.join(dataHome, 'evaluations.db');
  fs.writeFileSync(dataHomeDb, '');

  withEnv({ MS_DATA_HOME: dataHome, EVAL_DB_PATH: null }, () => {
    assert.equal(resolveEvaluationDbPath(root), dataHomeDb);
    assert.equal(resolveConfiguredEvaluationDbPath(root, 'data/evaluations.db'), dataHomeDb);
    assert.equal(resolveConfiguredEvaluationDbPath(root, 'custom/evaluations.db'), path.join(root, 'custom/evaluations.db'));
  });
});

test('evaluation DB path falls back to repo data when no canonical DB exists', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-path-root-'));
  const missingDataHome = path.join(root, 'missing-home');

  withEnv({ MS_DATA_HOME: missingDataHome, EVAL_DB_PATH: null }, () => {
    assert.equal(resolveEvaluationDbPath(root), path.join(root, 'data', 'evaluations.db'));
  });
});

test('logs root follows explicit, env, canonical data home, then repo fallback', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-path-root-'));
  const dataHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-path-home-'));
  const envLogs = path.join(root, 'env-logs');
  const explicitLogs = path.join(root, 'explicit-logs');

  withEnv({ MS_DATA_HOME: dataHome, EVAL_LOGS_DIR: envLogs }, () => {
    assert.equal(resolveEvaluationLogsRoot(root), envLogs);
    assert.equal(resolveEvaluationLogsRoot(root, explicitLogs), explicitLogs);
    assert.equal(resolveTutorDialoguesDir(root), path.join(envLogs, 'tutor-dialogues'));
  });

  withEnv({ MS_DATA_HOME: dataHome, EVAL_LOGS_DIR: null }, () => {
    assert.equal(resolveEvaluationLogsRoot(root), path.join(dataHome, 'logs'));
  });

  withEnv({ MS_DATA_HOME: path.join(root, 'missing-home'), EVAL_LOGS_DIR: null }, () => {
    assert.equal(resolveEvaluationLogsRoot(root), path.join(root, 'logs'));
  });
});

test('configured log paths preserve explicit evidence paths and avoid double tutor-dialogues suffix', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-path-root-'));
  const dataHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-path-home-'));

  withEnv({ MS_DATA_HOME: dataHome, EVAL_LOGS_DIR: null }, () => {
    assert.equal(resolveConfiguredTutorDialoguesDir(root, 'custom/logs'), path.join(root, 'custom', 'logs'));
    assert.equal(resolveTutorDialoguesDir(root, path.join(root, 'logs', 'tutor-dialogues')), path.join(root, 'logs', 'tutor-dialogues'));
  });
});
