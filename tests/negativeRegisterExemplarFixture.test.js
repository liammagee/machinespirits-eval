import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, '..', 'scripts', 'run-negative-register-exemplar-test.js');

test('negative-register exemplar runner validates fixture in check mode without judge calls', async () => {
  const { stdout } = await exec('node', [SCRIPT, '--check'], {
    timeout: 15000,
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  });

  assert.match(stdout, /Fixture: config\/register-exemplars\/corrosive-sarcasm.yaml/);
  assert.match(stdout, /Exemplars: 5/);
  assert.match(stdout, /Known corrosive: 3/);
  assert.match(stdout, /corrosive_boredom_person_attack: stance=invalid_person_attack/);
  assert.match(stdout, /warm_sarcasm_in_costume_control: stance=faithful/);
});
