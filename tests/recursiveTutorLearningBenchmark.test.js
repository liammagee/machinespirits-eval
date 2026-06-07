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

const loadUnderdeterminedFixture = () =>
  yaml.parse(fs.readFileSync('config/recursive-tutor-learning/underdetermined-transfer-families.yaml', 'utf8'));

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

test('underdetermined transfer fixture passes static validation', () => {
  const config = loadUnderdeterminedFixture();
  const validation = validateBenchmarkConfig(config);
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.issues, []);
});

test('underdetermined transfer validation requires selected repair to be plausible', () => {
  const config = loadUnderdeterminedFixture();
  config.families[0].transfer_design.policy_selected_repair = 'not_in_public_options';
  const validation = validateBenchmarkConfig(config);
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some((issue) => issue.code === 'policy_selected_repair_not_in_plausible_repairs'));
});

test('underdetermined transfer validation requires held-out policy correctness metadata', () => {
  const config = loadUnderdeterminedFixture();
  delete config.families[0].heldout_siblings[0].policy_correctness;
  const validation = validateBenchmarkConfig(config);
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some((issue) => issue.code === 'policy_correctness_missing_target_aliases'));
  assert.ok(validation.issues.some((issue) => issue.code === 'policy_correctness_missing_selected_repair_markers'));
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
    assert.match(family.attempt1_replay_command_text, /--out-dir/);
    assert.ok(family.heldout.length >= 1);
    assert.match(family.heldout[0].baseline_replay_command_text, /heldout-baseline-replay/);
    assert.match(family.heldout[0].baseline_replay_command_text, /--generator none/);
    assert.match(family.heldout[0].revised_replay_command_text, /--policy-memory/);
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

test('materializeAttemptChain preserves family-specific learner followup and transfer design', () => {
  const config = loadUnderdeterminedFixture();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'a18-under-transfer-'));
  const outDir = path.join(tmp, 'out');
  const plan = materializeAttemptChain(config, { outDir, force: false });
  const family = plan.families[0];
  const transcript = fs.readFileSync(family.training_transcript, 'utf8');
  const policyTemplate = JSON.parse(fs.readFileSync(family.policy_revision_template, 'utf8'));

  assert.match(transcript, /now I have three possible clues/);
  assert.match(transcript, /"policy_selected_repair": "selector_tab_test"/);
  assert.equal(policyTemplate.transfer_design.policy_selected_repair, 'selector_tab_test');
  assert.equal(policyTemplate.plausible_repairs.length, 4);
});

test('underdetermined fixture includes a second non-selector transfer family', () => {
  const config = loadUnderdeterminedFixture();
  const family = config.families.find((entry) => entry.family_id === 'notch_rotation_priority');
  assert.ok(family);
  assert.equal(family.transfer_design.policy_selected_repair, 'rotation_fit_test');
  assert.equal(family.heldout_siblings.length, 2);
  assert.ok(family.plausible_repairs.some((repair) => repair.repair_id === 'rotation_fit_test'));
});

test('underdetermined fixture includes the A18.12 less self-solving repair family', () => {
  const config = loadUnderdeterminedFixture();
  const family = config.families.find((entry) => entry.family_id === 'bead_predecessor_priority');
  assert.ok(family);
  assert.equal(family.transfer_design.policy_selected_repair, 'predecessor_alias_test');
  assert.equal(family.heldout_siblings.length, 2);
  assert.ok(family.plausible_repairs.some((repair) => repair.repair_id === 'predecessor_alias_test'));
  for (const sibling of family.heldout_siblings) {
    assert.ok(sibling.plausible_public_repairs.includes('color_match_test'));
    assert.ok(sibling.plausible_public_repairs.includes('predecessor_alias_test'));
  }
});
