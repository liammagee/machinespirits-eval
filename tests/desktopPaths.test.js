// tests/desktopPaths.test.js — pure, runs under plain `node --test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { resolvePaths, serverEnv } from '../desktop/paths.js';

function fakeApp() {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-userdata-'));
  return { getPath: (name) => (name === 'userData' ? userData : userData) };
}

// Run with a clean env so defaults (not the ambient shell) are exercised.
function withCleanEnv(fn) {
  const saved = {};
  const keys = [
    'EVAL_DB_PATH',
    'EVAL_LOGS_DIR',
    'EVAL_EXPORTS_DIR',
    'AUTH_DB_PATH',
    'EVAL_WRITING_PAD_DIR',
    'TUTOR_CORE_LOG_DIR',
  ];
  for (const k of keys) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  try {
    return fn();
  } finally {
    for (const k of keys) if (saved[k] !== undefined) process.env[k] = saved[k];
  }
}

test('resolvePaths relocates every writable store under userData', () => {
  withCleanEnv(() => {
    const app = fakeApp();
    const p = resolvePaths(app, '/repo/root');
    for (const v of [p.dbPath, p.logsDir, p.exportsDir, p.authDbPath, p.writingPadDir, p.tutorCoreLogDir]) {
      assert.ok(v.startsWith(p.userData), `${v} should be under userData`);
    }
    assert.equal(p.appRoot, '/repo/root');
    // the directories were actually created
    assert.ok(fs.existsSync(p.logsDir) && fs.existsSync(p.exportsDir) && fs.existsSync(p.writingPadDir));
    assert.ok(fs.existsSync(path.dirname(p.dbPath)) && fs.existsSync(path.dirname(p.authDbPath)));
  });
});

test('serverEnv sets all relocation env vars + MS_APP_ROOT', () => {
  withCleanEnv(() => {
    const app = fakeApp();
    const env = serverEnv(resolvePaths(app, '/repo/root'));
    for (const k of [
      'EVAL_DB_PATH',
      'EVAL_LOGS_DIR',
      'EVAL_EXPORTS_DIR',
      'AUTH_DB_PATH',
      'EVAL_WRITING_PAD_DIR',
      'TUTOR_CORE_LOG_DIR',
      'MS_APP_ROOT',
    ]) {
      assert.ok(env[k], `serverEnv must set ${k}`);
    }
    assert.equal(env.MS_APP_ROOT, '/repo/root');
  });
});

test('explicit env overrides win over the userData defaults', () => {
  withCleanEnv(() => {
    process.env.EVAL_DB_PATH = '/tmp/custom/eval.db';
    const p = resolvePaths(fakeApp(), '/repo/root');
    assert.equal(p.dbPath, '/tmp/custom/eval.db');
  });
});
