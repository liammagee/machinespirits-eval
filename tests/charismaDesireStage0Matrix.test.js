import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const exec = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, '..', 'scripts', 'report-charisma-desire-stage0-matrix.js');

describe('charisma desire Stage 0 matrix sanity', () => {
  it('validates the frozen no-paid pilot grid', async () => {
    const { stdout } = await exec('node', [SCRIPT, '--check'], {
      timeout: 15000,
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    });

    assert.match(stdout, /Status: PASS/);
    assert.match(stdout, /Total planned rows: 72/);
  });
});
