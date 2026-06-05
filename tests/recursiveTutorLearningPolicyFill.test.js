import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import yaml from 'yaml';
import { materializeAttemptChain } from '../scripts/run-recursive-tutor-learning-benchmark.js';
import { fillRecursiveTutorPolicies } from '../scripts/fill-recursive-tutor-policy.js';

const loadFixture = () =>
  yaml.parse(fs.readFileSync('config/recursive-tutor-learning/pilot-families.yaml', 'utf8'));

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeAttempt1Survivor(family) {
  const itemDir = path.join(family.attempt1_replay_dir, 'training-seed.full');
  const revisionJson = path.join(itemDir, 'revision.json');
  writeJson(revisionJson, {
    revised_public_transcript: 'LEARNER and TUTOR public replay',
    move_ledger: [],
    tutor_learning_ledger: [
      {
        tutor_prior_strategy: 'repeat a visual comparison reminder',
        learner_resistance_as_feedback: {
          public_signal: 'learner still chooses the salient cue',
          evidence_quote: 'the pointed end feels like the active part',
          why_it_challenges_prior_strategy: 'comparison leaves salience intact',
        },
        tutor_diagnosis: 'the old cue must fail publicly before the criterion can be named',
        rejected_continuation: 'repeat look at both ends',
        revised_strategy: {
          strategy_name: 'pose_counterexample',
          new_public_test_or_device: 'cover one end at a time and test what each end proves',
          why_this_strategy_now: 'learner asked for a clearer public test',
        },
        strategic_timing: 'counterexample follows learner resistance',
        learner_feedback_on_revision: 'learner says the point alone cannot identify origin',
        recursive_update: 'future instruction should defeat the tempting visual cue first',
      },
    ],
    hidden_state_use_ledger: [],
    non_leakage_check: { passes: true, notes: [] },
    claim_boundary: 'counterfactual_revision_not_online_adaptation',
  });
  writeJson(path.join(family.attempt1_replay_dir, 'manifest.json'), {
    records: [
      {
        paths: { revisionJson },
        gate: {
          status: 'survivor',
          scores: {
            public_causal_bridge: { value: 0.9 },
            device_specificity: { value: 0.9 },
          },
          recursive_tutor_learning_gate: {
            scores: {
              tutor_learning_signal: { value: 0.9 },
              resistance_diagnosis: { value: 0.9 },
            },
          },
        },
      },
    ],
  });
}

test('policy fill promotes attempt-1 survivor ledger into finite policy fields', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'a18-policy-fill-'));
  const outDir = path.join(tmp, 'chain');
  const plan = materializeAttemptChain(loadFixture(), { outDir, force: false });
  const family = plan.families[0];
  writeAttempt1Survivor(family);

  const report = fillRecursiveTutorPolicies({ chainDir: outDir });
  assert.equal(report.status_counts.filled, 1);
  assert.equal(report.status_counts.skipped_missing_attempt1_replay, 2);

  const policy = JSON.parse(fs.readFileSync(family.policy_revision_template, 'utf8'));
  assert.equal(policy.status, 'filled_from_attempt1');
  assert.match(policy.diagnostic_trigger, /pointed end feels like the active part/);
  assert.match(policy.avoid_move, /repeat look at both ends/);
  assert.match(policy.preferred_move, /pose_counterexample/);
  assert.match(policy.material_constraint, /cover one end/);
  assert.match(policy.uptake_test, /point alone cannot identify origin/);
  assert.match(policy.transfer_warning, /obstruction_type=/);
  assert.match(policy.expiry_condition, /held-out sibling/);
});

test('policy fill skips revise_again attempt-1 artifacts by default', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'a18-policy-fill-skip-'));
  const outDir = path.join(tmp, 'chain');
  const plan = materializeAttemptChain(loadFixture(), { outDir, force: false });
  const family = plan.families[0];
  writeAttempt1Survivor(family);
  const manifestPath = path.join(family.attempt1_replay_dir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.records[0].gate.status = 'revise_again';
  writeJson(manifestPath, manifest);

  const report = fillRecursiveTutorPolicies({ chainDir: outDir });
  assert.equal(report.status_counts.skipped_attempt1_revise_again, 1);
  const policy = JSON.parse(fs.readFileSync(family.policy_revision_template, 'utf8'));
  assert.equal(policy.status, 'template_unfilled');
});
