import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const exec = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, '..', 'scripts', 'report-charisma-desire-breakthrough-probe.js');

describe('charisma desire resistance-breakthrough probe', () => {
  it('validates the scenario and reports no outcome claim without dynamic learner rows', async () => {
    const { stdout } = await exec('node', [SCRIPT, '--check'], {
      timeout: 15000,
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    });

    assert.match(stdout, /Scenario: charisma_desire_resistance_breakthrough_probe/);
    assert.match(stdout, /Status: (READY_NO_ROWS|ANALYZED_ROWS)/);
    assert.match(stdout, /Outcome-eligible dynamic learner rows:/);
  });

  it('reports READY_NO_ROWS against a schemaless DB (the stray zero-byte evaluations.db case)', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'breakthrough-probe-'));
    const dbPath = path.join(tmpDir, 'evaluations.db');
    new Database(dbPath).close(); // zero-byte, no schema — what a sqlite MCP server leaves behind

    const { stdout } = await exec('node', [SCRIPT, '--check'], {
      timeout: 15000,
      env: { ...process.env, NODE_NO_WARNINGS: '1', EVAL_DB_PATH: dbPath },
    });

    assert.match(stdout, /Status: READY_NO_ROWS/);
    assert.match(stdout, /Rows found: 0/);
  });
});
