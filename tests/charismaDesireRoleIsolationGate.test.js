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
const SCRIPT = path.resolve(__dirname, '..', 'scripts', 'report-charisma-desire-role-isolation-gate.js');

describe('charisma desire role-isolation gate', () => {
  it('validates the no-paid role-isolation design', async () => {
    const { stdout } = await exec('node', [SCRIPT, '--check'], {
      timeout: 15000,
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    });

    assert.match(stdout, /Scenario set: charisma_desire_role_isolation/);
    assert.match(stdout, /Status: PASS/);
    assert.match(stdout, /Controlled scenarios: 5/);
    assert.match(stdout, /Isolation arms: 6/);
    assert.match(stdout, /Planned rows: 50/);
    assert.match(stdout, /cell_195_id_director_charisma_resistance_boredom_stake_scripted_control_verified/);
  });

  it('documents an OpenRouter timeout guard for metered role-isolation arms', async () => {
    const exportsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'role-isolation-gate-exports-'));
    try {
      const { stdout } = await exec('node', [SCRIPT], {
        timeout: 15000,
        env: { ...process.env, NODE_NO_WARNINGS: '1', EVAL_EXPORTS_DIR: exportsDir },
      });

      assert.match(stdout, /Status: PASS/);

      const reportPath = path.join(exportsDir, 'charisma-desire-role-isolation-gate-summary.md');
      const report = await import('node:fs/promises').then((fs) => fs.readFile(reportPath, 'utf8'));
      assert.match(report, /OPENROUTER_API_TIMEOUT_MS=600000/);
      assert.match(report, /EVAL_CAPTURE_API_PAYLOADS=false/);
    } finally {
      fs.rmSync(exportsDir, { recursive: true, force: true });
    }
  });

  it('summarizes role-isolation progress from an explicit DB path', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'role-isolation-progress-'));
    const dbPath = path.join(tmpDir, 'evaluations.db');
    const db = new Database(dbPath);
    db.exec(`
      CREATE TABLE evaluation_runs (
        id TEXT PRIMARY KEY,
        description TEXT,
        total_tests INTEGER,
        status TEXT,
        created_at TEXT
      );
      CREATE TABLE evaluation_results (
        id TEXT,
        run_id TEXT,
        scenario_id TEXT,
        profile_name TEXT,
        success INTEGER
      );
    `);
    db.prepare(
      `INSERT INTO evaluation_runs (id, description, total_tests, status, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      'eval-progress-baseline',
      'Charisma desire role isolation: baseline_codex_tutor_codex_learner',
      10,
      'completed',
      '2026-07-01T00:00:00.000Z',
    );
    const insert = db.prepare(
      `INSERT INTO evaluation_results (id, run_id, scenario_id, profile_name, success)
       VALUES (?, ?, ?, ?, ?)`,
    );
    for (let i = 0; i < 10; i += 1) {
      insert.run(
        `row-${i}`,
        'eval-progress-baseline',
        `charisma_desire_resistance_breakthrough_${i % 2 ? 'boredom' : 'frustration'}`,
        'cell_193_id_director_charisma_resistance_boredom_stake_breakthrough_dynamic_verified',
        1,
      );
    }
    db.close();

    try {
      const { stdout } = await exec('node', [SCRIPT, '--check', '--progress', '--db', dbPath], {
        timeout: 15000,
        env: {
          ...process.env,
          NODE_NO_WARNINGS: '1',
        },
      });

      assert.match(stdout, /Status: PASS/);
      assert.match(stdout, /Progress rows: 10\/50/);
      assert.match(stdout, /Remaining rows: 40/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
