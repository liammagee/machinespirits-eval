import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

import {
  adaptiveStateStateBlindBaselineContractSha256,
  adaptiveStateStage0PredictionMetrics,
  ADAPTIVE_STATE_STATE_BLIND_BASELINE_CONTRACT,
  auditAdaptiveStateStage0Dataset,
  buildAdaptiveStateOutOfFoldStateBlindBaselines,
  buildAdaptiveStateStage0Report,
  buildAdaptiveStateStage0SplitManifest,
  fitAdaptiveStateStage0Head,
  fitAdaptiveStateTrainingFoldClassPrior,
  predictAdaptiveStateTrainingFoldClassPrior,
  predictAdaptiveStateStage0Head,
  predictAdaptiveStateUniformBaseline,
} from '../services/adaptiveTutor/stateBenchmarkStage0Analysis.js';
import {
  buildAdaptiveStateStage0Dataset,
  validateAdaptiveStateStage0DatasetContentSha256,
} from '../services/adaptiveTutor/stateBenchmarkStage0Executor.js';
import { buildAdaptiveStateCriticalPathPlan } from '../services/adaptiveTutor/stateBenchmarkV2.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function stage0Fixture() {
  const config = yaml.parse(fs.readFileSync(path.join(ROOT, 'config', 'adaptive-state-benchmark-v2.yaml'), 'utf8'));
  const plan = buildAdaptiveStateCriticalPathPlan(config, {
    stage: 's0_contract',
    label: 'stage0-integration-test',
  });
  const dataset = buildAdaptiveStateStage0Dataset({ plan, config, repoRoot: ROOT });
  const replayed = buildAdaptiveStateStage0Dataset({ plan, config, repoRoot: ROOT });
  const replay = {
    schema: 'machinespirits.adaptive-state-stage0-replay.v2',
    passed: replayed.content_sha256 === dataset.content_sha256,
    first_sha256: dataset.content_sha256,
    replay_sha256: replayed.content_sha256,
  };
  const splitManifest = buildAdaptiveStateStage0SplitManifest(dataset.rows, config);
  return { config, plan, dataset, replay, splitManifest };
}

function trainingRows() {
  const actions = ['diagnose_with_discriminating_question', 'minimal_hint', 'request_evidence'];
  return Array.from({ length: 90 }, (_, index) => {
    const action = actions[index % actions.length];
    return {
      id: `row-${index}`,
      groups: { dialogue_id: `dialogue-${Math.floor(index / 6)}` },
      action: { id: action },
      representations: {
        no_state: {
          common: {
            turn: (index % 6) + 1,
            task: {
              knowledge_component: `component-${index % 3}`,
              prerequisite_count: 2,
              item_difficulty: 0.5,
              item_discrimination: 1,
            },
          },
        },
      },
      targets: {
        next_dag_event_family:
          action === 'request_evidence' ? 'derive' : action === 'minimal_hint' ? 'adopt' : 'none',
      },
    };
  });
}

test('Stage-0 fixed head is deterministic and learns the common action signal', () => {
  const rows = trainingRows();
  const options = {
    target: 'next_dag_event_family',
    labels: ['retract', 'derive', 'adopt', 'none'],
    convergenceTolerance: 1e-6,
  };
  const first = fitAdaptiveStateStage0Head(rows, options);
  const second = fitAdaptiveStateStage0Head(rows, options);
  assert.deepEqual(second, first);
  const predictions = predictAdaptiveStateStage0Head(first, rows);
  const metrics = adaptiveStateStage0PredictionMetrics(predictions, options.labels);
  assert.ok(metrics.log_loss < 0.2);
  assert.ok(metrics.brier_score < 0.05);
  assert.equal(metrics.predictions, rows.length);
});

test('state-blind baselines use only training-fold counts with alpha=1 and an exact uniform distribution', () => {
  const labels = ['retract', 'derive', 'adopt', 'none'];
  const rows = trainingRows().slice(0, 6);
  for (const [index, row] of rows.entries()) {
    row.targets.next_dag_event_family = index < 4 ? 'adopt' : 'none';
  }
  const model = fitAdaptiveStateTrainingFoldClassPrior(rows, {
    target: 'next_dag_event_family',
    labels,
    contract: ADAPTIVE_STATE_STATE_BLIND_BASELINE_CONTRACT,
  });
  assert.deepEqual(model.counts, { retract: 0, derive: 0, adopt: 4, none: 2 });
  assert.deepEqual(model.probabilities, { retract: 0.1, derive: 0.1, adopt: 0.5, none: 0.3 });
  assert.ok(Object.values(model.probabilities).every((probability) => probability > 0));
  const testing = trainingRows().slice(6, 9);
  for (const row of testing) row.targets.next_dag_event_family = 'retract';
  const predictions = predictAdaptiveStateTrainingFoldClassPrior(model, testing);
  assert.deepEqual(predictions.map((row) => row.probabilities), Array(3).fill(model.probabilities));
  const uniform = predictAdaptiveStateUniformBaseline(testing, {
    target: 'next_dag_event_family',
    labels,
  });
  assert.ok(uniform.every((row) => labels.every((label) => row.probabilities[label] === 0.25)));
  assert.match(
    adaptiveStateStateBlindBaselineContractSha256(ADAPTIVE_STATE_STATE_BLIND_BASELINE_CONTRACT),
    /^[0-9a-f]{64}$/u,
  );
});

test('out-of-fold state-blind baselines bind each class prior to that fold training set', () => {
  const fixture = stage0Fixture();
  const blind = buildAdaptiveStateOutOfFoldStateBlindBaselines(fixture.dataset.rows, fixture.splitManifest, {
    target: 'next_dag_event_family',
    labels: ['retract', 'derive', 'adopt', 'none'],
    contract: fixture.config.analysis.state_blind_baseline_contract,
  });
  assert.equal(blind.class_prior.predictions.length, fixture.dataset.rows.length);
  assert.equal(new Set(blind.class_prior.predictions.map((row) => row.id)).size, fixture.dataset.rows.length);
  assert.equal(blind.class_prior.folds.length, 3);
  assert.ok(
    blind.class_prior.folds.every(
      (fold) => fold.training_rows === 96 && Object.values(fold.probabilities).every((value) => value > 0),
    ),
  );
  assert.ok(
    blind.uniform.predictions.every((row) => Object.values(row.probabilities).every((value) => value === 0.25)),
  );
});

test('Stage-0 executes the complete zero-call matrix and passes only its non-confirmatory contract gate', () => {
  const fixture = stage0Fixture();
  validateAdaptiveStateStage0DatasetContentSha256(fixture.dataset);
  assert.equal(fixture.dataset.dialogues.length, 24);
  assert.equal(fixture.dataset.rows.length, 144);
  assert.equal(fixture.dataset.model_call_count, 0);
  assert.equal(fixture.dataset.deterministic_realizer_call_count, 168);
  assert.equal(fixture.replay.passed, true);

  const audit = auditAdaptiveStateStage0Dataset(fixture.dataset, fixture.plan, fixture.config);
  assert.deepEqual(audit.failures, []);
  assert.equal(audit.passed, true);
  assert.deepEqual(audit.target_degeneracy, []);
  assert.deepEqual(audit.paired_realizer_target_drift, []);

  const report = buildAdaptiveStateStage0Report(fixture);
  assert.equal(report.status, 'pass');
  assert.equal(report.decision, 'advance_to_s1_technical_pilot');
  assert.equal(report.confirmation_eligible, false);
  assert.equal(report.s2_validity_verdict, null);
  assert.equal(report.protocol.gate_eligible, false);
  assert.deepEqual(report.stop_reasons, []);
  for (const row of Object.values(report.instrument)) {
    assert.equal(row.oracle_beats_no_state_on_both_metrics, true);
    assert.equal(row.oracle_beats_all_state_blind_baselines_on_both_metrics, true);
  }
  assert.equal(report.baseline_sanity.passed, true);
  assert.match(report.protocol.state_blind_baselines.contract_sha256, /^[0-9a-f]{64}$/u);
  assert.deepEqual(report.protocol.target_contracts, fixture.config.targets.co_primary);
});

test('Stage-0 content hash rejects post-seal dataset mutation', () => {
  const { dataset } = stage0Fixture();
  dataset.rows[0].targets.next_dag_event_family =
    dataset.rows[0].targets.next_dag_event_family === 'none' ? 'adopt' : 'none';
  assert.throws(
    () => validateAdaptiveStateStage0DatasetContentSha256(dataset),
    /dataset content SHA-256 mismatch/u,
  );
});
