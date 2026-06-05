import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import yaml from 'yaml';
import { materializeAttemptChain } from '../scripts/run-recursive-tutor-learning-benchmark.js';
import { buildLocalGateReport } from '../scripts/report-recursive-tutor-learning-local-gate.js';

const loadFixture = () =>
  yaml.parse(fs.readFileSync('config/recursive-tutor-learning/pilot-families.yaml', 'utf8'));

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function replayManifest(status, scores = {}) {
  return {
    kind: 'discursive_replay_bundle',
    local_gate: { summary: { counts: { [status]: 1 } } },
    records: [
      {
        gate: {
          status,
          recursive_tutor_learning_gate: {
            scores: Object.fromEntries(Object.entries(scores).map(([key, value]) => [key, { value }])),
          },
          scores: {
            public_causal_bridge: { value: scores.public_causal_bridge ?? 0.9 },
            device_specificity: { value: scores.device_specificity ?? 0.9 },
            old_warrant_misclassification: { value: scores.old_warrant_misclassification ?? 0.9 },
          },
        },
        check: { scores },
      },
    ],
  };
}

const passingScores = {
  tutor_learning_signal: 0.9,
  resistance_diagnosis: 0.9,
  strategy_revision_accountability: 0.9,
  strategic_timing: 0.9,
  recursive_dyadic_update: 0.9,
  public_causal_bridge: 0.9,
  device_specificity: 0.9,
  old_warrant_misclassification: 0.9,
};

const failingScores = {
  tutor_learning_signal: 0.3,
  resistance_diagnosis: 0.3,
  strategy_revision_accountability: 0.3,
  strategic_timing: 0.3,
  recursive_dyadic_update: 0.3,
  public_causal_bridge: 0.9,
  device_specificity: 0.9,
  old_warrant_misclassification: 0.9,
};

function completePolicy(filePath) {
  writeJson(filePath, {
    family_id: 'x',
    status: 'filled',
    diagnostic_trigger: 'learner chose the salient mark',
    avoid_move: 'repeat the same compare-both-parts reminder',
    preferred_move: 'pose a public counterexample test',
    material_constraint: 'use two cases that share the salient mark but differ in the deciding mark',
    uptake_test: 'learner names the deciding mark and applies it',
    transfer_warning: 'do not transfer when the learner already uses the deciding mark',
    expiry_condition: 'retire after two correct held-out applications',
  });
}

test('local gate reports revise_again for a fresh materialized chain', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'a18-gate-fresh-'));
  const outDir = path.join(tmp, 'chain');
  materializeAttemptChain(loadFixture(), { outDir, force: false });
  const report = buildLocalGateReport({ chainDir: outDir });
  assert.equal(report.status_counts.revise_again, 3);
  assert.ok(report.families.every((family) => family.reasons.some((reason) => reason.code === 'missing_attempt1_replay')));
});

test('local gate reports clean_survivor when revised heldout passes and baseline fails', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'a18-gate-clean-'));
  const outDir = path.join(tmp, 'chain');
  const plan = materializeAttemptChain(loadFixture(), { outDir, force: false });
  const family = plan.families[0];
  completePolicy(family.policy_revision_template);
  writeJson(path.join(family.attempt1_replay_dir, 'manifest.json'), replayManifest('survivor', passingScores));
  writeJson(path.join(family.heldout[0].baseline_replay_dir, 'manifest.json'), replayManifest('revise_again', failingScores));
  writeJson(path.join(family.heldout[0].revised_replay_dir, 'manifest.json'), replayManifest('survivor', passingScores));
  const report = buildLocalGateReport({ chainDir: outDir });
  const row = report.families.find((entry) => entry.family_id === family.family_id);
  assert.equal(row.status, 'clean_survivor');
});

test('local gate reports no_headroom when baseline and revised both pass', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'a18-gate-headroom-'));
  const outDir = path.join(tmp, 'chain');
  const plan = materializeAttemptChain(loadFixture(), { outDir, force: false });
  const family = plan.families[0];
  completePolicy(family.policy_revision_template);
  writeJson(path.join(family.attempt1_replay_dir, 'manifest.json'), replayManifest('survivor', passingScores));
  writeJson(path.join(family.heldout[0].baseline_replay_dir, 'manifest.json'), replayManifest('survivor', passingScores));
  writeJson(path.join(family.heldout[0].revised_replay_dir, 'manifest.json'), replayManifest('survivor', passingScores));
  const report = buildLocalGateReport({ chainDir: outDir });
  const row = report.families.find((entry) => entry.family_id === family.family_id);
  assert.equal(row.status, 'no_headroom');
});

test('local gate ignores non-blocking info naturalness findings for coherence confound', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'a18-gate-info-naturalness-'));
  const outDir = path.join(tmp, 'chain');
  const plan = materializeAttemptChain(loadFixture(), { outDir, force: false });
  const family = plan.families[0];
  completePolicy(family.policy_revision_template);
  writeJson(path.join(family.attempt1_replay_dir, 'manifest.json'), replayManifest('survivor', passingScores));
  writeJson(path.join(family.heldout[0].baseline_replay_dir, 'manifest.json'), replayManifest('reject', failingScores));
  const revised = replayManifest('survivor', passingScores);
  revised.records[0].check.findings = [
    {
      severity: 'info',
      criterion: 'learner_self_reframe_naturalness',
      evidence: 'naturalness preserved',
      recommendation: 'none',
      blocking: false,
    },
  ];
  writeJson(path.join(family.heldout[0].revised_replay_dir, 'manifest.json'), revised);
  const report = buildLocalGateReport({ chainDir: outDir });
  const row = report.families.find((entry) => entry.family_id === family.family_id);
  assert.equal(row.status, 'clean_survivor');
});

test('local gate treats warning-level coherence findings as coherence confounds', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'a18-gate-coherence-warning-'));
  const outDir = path.join(tmp, 'chain');
  const plan = materializeAttemptChain(loadFixture(), { outDir, force: false });
  const family = plan.families[0];
  completePolicy(family.policy_revision_template);
  writeJson(path.join(family.attempt1_replay_dir, 'manifest.json'), replayManifest('survivor', passingScores));
  writeJson(path.join(family.heldout[0].baseline_replay_dir, 'manifest.json'), replayManifest('reject', failingScores));
  const revised = replayManifest('survivor', passingScores);
  revised.records[0].check.findings = [
    {
      severity: 'warning',
      criterion: 'coherence',
      evidence: 'revision repairs scores by making the scene less coherent',
      recommendation: 'revise before panel',
      blocking: false,
    },
  ];
  writeJson(path.join(family.heldout[0].revised_replay_dir, 'manifest.json'), revised);
  const report = buildLocalGateReport({ chainDir: outDir });
  const row = report.families.find((entry) => entry.family_id === family.family_id);
  assert.equal(row.status, 'coherence_confound');
});
