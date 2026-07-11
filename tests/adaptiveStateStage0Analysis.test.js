import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

import {
  adaptiveStateStage0PredictionMetrics,
  auditAdaptiveStateStage0Dataset,
  buildAdaptiveStateStage0Report,
  buildAdaptiveStateStage0SplitManifest,
  fitAdaptiveStateStage0Head,
  predictAdaptiveStateStage0Head,
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
  }
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
