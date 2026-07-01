import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const exec = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, '..', 'scripts', 'report-charisma-desire-heldout-quality-gate.js');

describe('charisma desire held-out quality gate', () => {
  it('validates the no-paid held-out gate design', async () => {
    const { stdout } = await exec('node', [SCRIPT, '--check'], {
      timeout: 15000,
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    });

    assert.match(stdout, /Scenario set: charisma_desire_heldout_quality_gate/);
    assert.match(stdout, /Status: PASS/);
    assert.match(stdout, /Gate decision: PENDING_NO_RUNS/);
    assert.match(stdout, /Held-out scenarios: 5/);
    assert.match(stdout, /Isolation arms: 6/);
    assert.match(stdout, /Planned rows: 50/);
    assert.match(stdout, /cell_193_id_director_charisma_resistance_boredom_stake_breakthrough_dynamic_verified/);
    assert.match(stdout, /cell_195_id_director_charisma_resistance_boredom_stake_scripted_control_verified/);
  });

  it('documents the guarded held-out run commands and bounded claim boundary', async () => {
    const { stdout } = await exec('node', [SCRIPT], {
      timeout: 15000,
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    });

    assert.match(stdout, /Status: PASS/);

    const reportPath = path.resolve(__dirname, '..', 'exports', 'charisma-desire-heldout-quality-gate-summary.md');
    const report = await import('node:fs/promises').then((fs) => fs.readFile(reportPath, 'utf8'));
    assert.match(report, /OPENROUTER_API_TIMEOUT_MS=480000/);
    assert.match(report, /EVAL_CAPTURE_API_PAYLOADS=false/);
    assert.match(report, /--scenario-set heldout/);
    assert.match(report, /no runtime policy promotion/i);
    assert.match(report, /no human-learning claim/i);
  });
});
