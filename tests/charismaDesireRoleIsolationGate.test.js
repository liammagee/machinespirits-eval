import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

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
});
