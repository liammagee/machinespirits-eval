import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PILOT_STORE_URL = pathToFileURL(path.join(ROOT, 'services', 'pilotStore.js')).href;

test('importing pilotStore does not create the canonical database', () => {
  const dataHome = fs.mkdtempSync(path.join(os.tmpdir(), 'pilot-store-import-'));
  const env = { ...process.env, MS_DATA_HOME: dataHome };
  delete env.EVAL_DB_PATH;
  try {
    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '--eval', `await import(${JSON.stringify(PILOT_STORE_URL)})`],
      {
        cwd: ROOT,
        env,
        encoding: 'utf8',
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(path.join(dataHome, 'evaluations.db')), false);
  } finally {
    fs.rmSync(dataHome, { recursive: true, force: true });
  }
});
