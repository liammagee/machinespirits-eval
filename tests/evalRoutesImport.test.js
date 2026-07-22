import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('importing evalRoutes does not keep a one-shot Node process alive', (t) => {
  const hermeticRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-routes-import-'));
  t.after(() => fs.rmSync(hermeticRoot, { recursive: true, force: true }));

  const result = spawnSync(process.execPath, ['--input-type=module', '-e', "await import('./routes/evalRoutes.js')"], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 2500,
    env: {
      ...process.env,
      EVAL_DB_PATH: path.join(hermeticRoot, 'evaluations.db'),
      EVAL_LOGS_DIR: path.join(hermeticRoot, 'logs'),
      EVAL_EXPORTS_DIR: path.join(hermeticRoot, 'exports'),
    },
  });

  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.signal, null, result.stderr);
  assert.equal(result.status, 0, result.stderr);
});
