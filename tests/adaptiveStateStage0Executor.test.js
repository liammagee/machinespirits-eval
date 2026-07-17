import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { hashCanonicalJson, hashFile, verifyExperimentRun } from '../services/experimentRunArtifacts.js';
import { adaptiveStateLearnerKernel } from '../services/adaptiveTutor/learnerKernels/index.js';
import { loadAdaptiveStateStage0Dataset } from '../services/adaptiveTutor/stateBenchmarkStage0Executor.js';
import { validateAdaptiveStateStage0ReportContentSha256 } from '../services/adaptiveTutor/stateBenchmarkStage0Analysis.js';

const ROOT = path.resolve('.');

test('zero-call Stage-0 executor seals the 24-dialogue/144-transition analyzer input', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptive-state-stage0-'));
  const label = 'stage0-executor-unit';
  const runDir = path.join(out, label);
  try {
    const stdout = execFileSync(
      process.execPath,
      ['scripts/execute-adaptive-state-benchmark-v2-s0.js', '--out', out, '--label', label, '--run-seed', '1701'],
      { cwd: ROOT, encoding: 'utf8' },
    );
    assert.match(stdout, /pass: 24 dialogues, 144 transitions, 0 model calls/u);
    const verification = verifyExperimentRun(runDir);
    assert.equal(verification.ok, true, verification.errors.join('\n'));
    assert.equal(verification.seal.status, 'complete');
    assert.equal(verification.seal.metadata.executedModelCalls, 0);

    const dataset = loadAdaptiveStateStage0Dataset(runDir);
    assert.equal(dataset.dialogues.length, 24);
    assert.equal(dataset.rows.length, 144);
    assert.equal(dataset.model_call_count, 0);
    assert.equal(dataset.deterministic_realizer_call_count, 168);
    assert.ok(
      dataset.dialogues.every((dialogue) =>
        dialogue.observations
          .filter((observation) => observation.turn > 0)
          .every((observation) => observation.semantic_fidelity?.status === 'pass'),
      ),
    );
    assert.ok(
      dataset.rows.every((row) => row.representations.no_state.common.turn >= 1 && row.provenance.model_calls === 0),
    );
    assert.ok(
      dataset.dialogues.every((dialogue) =>
        dialogue.observations
          .filter((observation) => observation.turn > 0)
          .every(
            (observation) =>
              observation.semantic_fidelity?.status === 'pass' &&
              observation.provenance?.source === 'adaptive_state_stage0_exact_public_event_projection' &&
              observation.provenance?.kernel_derived_classifier === false,
          ),
      ),
    );
    assert.ok(dataset.rows.every((row) => Number(row.controls.scramble_donor_seed) !== Number(row.groups.seed)));

    const byPair = new Map();
    for (const dialogue of dataset.dialogues) {
      const values = byPair.get(dialogue.latent_pair_id) || [];
      values.push(dialogue);
      byPair.set(dialogue.latent_pair_id, values);
    }
    assert.equal(byPair.size, 12);
    for (const dialogues of byPair.values()) {
      assert.equal(dialogues.length, 2);
      assert.deepEqual(dialogues[0].target_sequence, dialogues[1].target_sequence);
      assert.notEqual(dialogues[0].realizer_id, dialogues[1].realizer_id);
    }

    const report = JSON.parse(fs.readFileSync(path.join(runDir, 'stage0-contract-report.json'), 'utf8'));
    assert.doesNotThrow(() => validateAdaptiveStateStage0ReportContentSha256(report));
    assert.equal(report.status, 'pass');
    assert.equal(report.confirmation_eligible, false);
    assert.equal(report.s2_validity_verdict, null);
    assert.deepEqual(report.stop_reasons, []);
    assert.equal(report.protocol.fixed_head.regularization.scaling, 'lambda_over_training_rows');
    assert.equal(report.protocol.fixed_head.solver.convergence_criterion, 'absolute_objective_delta');
    assert.equal(report.protocol.fixed_head.all_folds_converged, true);
    assert.ok(Object.values(report.instrument).every((row) => row.oracle_beats_no_state_on_both_metrics === true));

    const plan = verification.plan;
    const boundSources = new Set(
      ['durable_state', 'dag_dropout'].flatMap((id) => adaptiveStateLearnerKernel(id).metadata.source_files),
    );
    assert.ok(boundSources.has('services/adaptiveTutor/learnerKernels/contract.js'));
    assert.ok(boundSources.has('services/adaptiveTutor/learnerKernels/worldAdapter.js'));
    const expectedPolicyHash = hashCanonicalJson(
      [...boundSources].sort().map((file) => ({ path: file, sha256: hashFile(path.join(ROOT, file)) })),
    );
    assert.equal(plan.hashes.policy, expectedPolicyHash);

    const tampered = JSON.parse(fs.readFileSync(path.join(runDir, 'dataset-manifest.json'), 'utf8'));
    tampered.dataset_content_sha256 = '0'.repeat(64);
    fs.writeFileSync(path.join(runDir, 'dataset-manifest.json'), `${JSON.stringify(tampered, null, 2)}\n`);
    assert.throws(() => loadAdaptiveStateStage0Dataset(runDir), /dataset content SHA-256 mismatch/u);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});
