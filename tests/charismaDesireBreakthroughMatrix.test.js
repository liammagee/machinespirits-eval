import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const exec = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, '..', 'scripts', 'report-charisma-desire-breakthrough-matrix.js');

describe('charisma desire resistance-breakthrough matrix', () => {
  it('validates the controlled resistance-signal scenario grid', async () => {
    const { stdout } = await exec('node', [SCRIPT, '--check'], {
      timeout: 15000,
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    });

    assert.match(stdout, /Scenario set: charisma_desire_resistance_breakthrough_controlled/);
    assert.match(stdout, /Controlled scenarios: 5/);
    assert.match(stdout, /cell_188_id_director_charisma_resistance_owned_test_breakthrough_dynamic_verified/);
    assert.match(stdout, /cell_189_id_director_charisma_resistance_precision_breakthrough_dynamic_verified/);
    assert.match(stdout, /cell_190_id_director_charisma_resistance_generation_breakthrough_dynamic_verified/);
    assert.match(stdout, /cell_191_id_director_charisma_resistance_question_lock_breakthrough_dynamic_verified/);
    assert.match(stdout, /cell_192_id_director_charisma_resistance_commitment_probe_breakthrough_dynamic_verified/);
    assert.match(stdout, /cell_193_id_director_charisma_resistance_boredom_stake_breakthrough_dynamic_verified/);
    assert.match(stdout, /cell_194_id_director_charisma_resistance_glm_compact_breakthrough_dynamic_verified/);
    assert.match(stdout, /Question-flood gate: /);
    assert.match(stdout, /Status: (READY_NO_ROWS|ANALYZED_ROWS)/);
  });
});
