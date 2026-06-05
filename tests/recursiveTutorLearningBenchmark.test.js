import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import yaml from 'yaml';
import {
  buildAttemptChainPlan,
  materializeAttemptChain,
  parseArgs,
  validateBenchmarkConfig,
} from '../scripts/run-recursive-tutor-learning-benchmark.js';

const loadFixture = () =>
  yaml.parse(fs.readFileSync('config/recursive-tutor-learning/pilot-families.yaml', 'utf8'));

test('parseArgs defaults to the pilot fixture and output directory', () => {
  const args = parseArgs([]);
  assert.match(args.config, /config\/recursive-tutor-learning\/pilot-families\.yaml$/);
  assert.match(args.outDir, /exports\/recursive-tutor-learning\/a18-pilot-local$/);
  assert.equal(args.dryRun, false);
});

test('pilot family fixture passes static validation', () => {
  const config = loadFixture();
  const validation = validateBenchmarkConfig(config);
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.issues, []);
});

test('static validation catches public shortcut leakage', () => {
  const config = loadFixture();
  config.families[0].training_seed.baseline_tutor_attempt += ' The tail ring decides.';
  const validation = validateBenchmarkConfig(config);
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some((issue) => issue.code === 'forbidden_shortcut_leak'));
});

test('attempt-chain plan includes training and held-out replay commands', () => {
  const config = loadFixture();
  const plan = buildAttemptChainPlan(config, { outDir: '/tmp/a18-plan' });
  assert.equal(plan.validation.valid, true);
  assert.equal(plan.families.length, 3);
  for (const family of plan.families) {
    assert.equal(family.local_gate_status, 'ready_for_attempt1');
    assert.match(family.attempt1_replay_command_text, /--recursive-tutor-learning-gate/);
    assert.ok(family.heldout.length >= 1);
    assert.match(family.heldout[0].replay_command_text, /--policy-memory/);
  }
});

test('materializeAttemptChain writes transcripts, templates, and commands', () => {
  const config = loadFixture();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'a18-recursive-'));
  const outDir = path.join(tmp, 'out');
  const plan = materializeAttemptChain(config, { outDir, force: false });
  assert.equal(plan.validation.valid, true);
  assert.ok(fs.existsSync(path.join(outDir, 'attempt-chain-plan.json')));
  assert.ok(fs.existsSync(path.join(outDir, 'static-validation.json')));
  assert.ok(fs.existsSync(path.join(outDir, 'next-commands.sh')));
  for (const family of plan.families) {
    assert.ok(fs.existsSync(family.training_transcript));
    assert.ok(fs.existsSync(family.policy_revision_template));
    assert.ok(fs.readFileSync(family.training_transcript, 'utf8').includes('## Held-Out A18 Metadata'));
    for (const sibling of family.heldout) assert.ok(fs.existsSync(sibling.transcript));
  }
});

