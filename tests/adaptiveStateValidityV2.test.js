import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import yaml from 'yaml';

import {
  ADAPTIVE_STATE_PRECOMPUTED_LANE_REPORT_V2_SCHEMA,
  adaptiveStateValidityV2Contract,
  adaptiveStateValidityV2ContractSha256,
  adaptiveStateValidityV2ReportContentSha256,
  evaluateAdaptiveStateValidityV2,
} from '../services/adaptiveTutor/stateValidityMetricsV2.js';

const ROOT = path.resolve('.');
const CONFIG_PATH = path.join(ROOT, 'config', 'adaptive-state-benchmark-v2.yaml');
const TARGETS = ['next_dag_event_family', 'next_proof_trajectory'];
const CANDIDATES = ['lean_dag', 'dag_trajectory', 'field_trajectory'];
const LANE_LEVELS = {
  world_transfer: ['marrick', 'hethel', 'ravensmark'],
  generator_transfer: ['durable_state', 'dag_dropout'],
  realizer_transfer: ['codex_terra', 'claude_sonnet'],
};

function config() {
  return yaml.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function digest(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function groupsFor(lane, level, seedsPerCell = 6) {
  if (level === 'pooled') return 12 * seedsPerCell;
  if (lane === 'world_transfer') return 4 * seedsPerCell;
  if (lane === 'generator_transfer' || lane === 'realizer_transfer') return 6 * seedsPerCell;
  throw new Error(`unknown fixture lane ${lane}`);
}

function comparison({ lane, level, target, candidate, baseline, logLoss = 0.08, brier = 0.04 }) {
  const key = [lane, level, target, candidate, baseline].join('|');
  const groups = groupsFor(lane, level);
  return {
    lane,
    level,
    target,
    candidate,
    baseline,
    groups,
    predictions: groups * 6,
    paired_support_sha256: digest(`support:${key}`),
    metrics: {
      log_loss: {
        point_delta: logLoss,
        confidence_interval: { lower: 0.03, upper: 0.13 },
        probability_of_improvement: 0.99,
      },
      brier_score: {
        point_delta: brier,
        confidence_interval: { lower: 0.015, upper: 0.065 },
        probability_of_improvement: 0.99,
      },
    },
  };
}

function setNonSuperior(row) {
  row.metrics.log_loss = {
    point_delta: 0,
    confidence_interval: { lower: -0.005, upper: 0.005 },
    probability_of_improvement: 0.5,
  };
  row.metrics.brier_score = {
    point_delta: 0,
    confidence_interval: { lower: -0.005, upper: 0.005 },
    probability_of_improvement: 0.5,
  };
}

function findComparison(report, { lane = 'world_transfer', level = 'pooled', target, candidate, baseline }) {
  const row = report.comparisons.find(
    (entry) =>
      entry.lane === lane &&
      entry.level === level &&
      entry.target === target &&
      entry.candidate === candidate &&
      entry.baseline === baseline,
  );
  assert.ok(row, `missing fixture comparison ${lane}|${level}|${target}|${candidate}|${baseline}`);
  return row;
}

function sealReport(report) {
  report.content_sha256 = adaptiveStateValidityV2ReportContentSha256(report);
  return report;
}

function passingReport(value = config()) {
  const comparisons = [];
  for (const target of TARGETS) {
    comparisons.push(
      comparison({
        lane: 'world_transfer',
        level: 'pooled',
        target,
        candidate: 'oracle',
        baseline: 'no_state',
      }),
    );
  }
  for (const candidate of CANDIDATES) {
    for (const target of TARGETS) {
      comparisons.push(
        comparison({ lane: 'world_transfer', level: 'pooled', target, candidate, baseline: 'no_state' }),
      );
      for (const level of LANE_LEVELS.world_transfer) {
        comparisons.push(comparison({ lane: 'world_transfer', level, target, candidate, baseline: 'no_state' }));
      }
      for (const lane of ['generator_transfer', 'realizer_transfer']) {
        for (const level of LANE_LEVELS[lane]) {
          comparisons.push(comparison({ lane, level, target, candidate, baseline: 'no_state' }));
        }
      }
    }
  }
  for (const [candidate, controls] of Object.entries({
    dag_trajectory: ['dag_scramble', 'dag_stale'],
    field_trajectory: ['field_scramble', 'field_stale'],
  })) {
    for (const control of controls) {
      for (const target of TARGETS) {
        comparisons.push(comparison({ lane: 'world_transfer', level: 'pooled', target, candidate, baseline: control }));
      }
    }
  }
  for (const [candidate, baseline] of [
    ['dag_trajectory', 'lean_dag'],
    ['field_trajectory', 'dag_trajectory'],
  ]) {
    for (const target of TARGETS) {
      comparisons.push(comparison({ lane: 'world_transfer', level: 'pooled', target, candidate, baseline }));
    }
  }

  const calibration = [];
  for (const representation of ['oracle', ...CANDIDATES]) {
    for (const target of TARGETS) {
      calibration.push({
        lane: 'world_transfer',
        level: 'pooled',
        target,
        representation,
        predictions: 432,
        ece: representation === 'oracle' ? 0.05 : 0.1,
      });
    }
  }

  return sealReport({
    schema: ADAPTIVE_STATE_PRECOMPUTED_LANE_REPORT_V2_SCHEMA,
    version: '2.0',
    contract_sha256: adaptiveStateValidityV2ContractSha256(value),
    stage: 's2_confirmation',
    status: 'complete',
    provenance: {
      dataset_sha256: digest('dataset'),
      split_manifest_sha256: digest('split-manifest'),
      predictions_sha256: digest('predictions'),
      analyzer_sha256: digest('analyzer'),
    },
    protocol: {
      fixed_head: {
        id: 'l2_multinomial_logistic',
        feature_encoding: 'training_fold_numeric_zscore_and_categorical_one_hot',
        categorical_vocabulary: 'training_fold_only',
        regularization_kind: 'l2',
        regularization_lambda: 1,
        regularization_scaling: 'lambda_over_training_rows',
        solver_id: 'deterministic_batch_gradient_descent',
        convergence_criterion: 'absolute_objective_delta',
        all_folds_converged: true,
        nonfinite_probability_count: 0,
      },
      sensitivity_head_gate_eligible: false,
      bootstrap: {
        method: 'paired_cluster_bootstrap',
        cluster: 'latent_dialogue',
        iterations: 5000,
        seed: 20260711,
        confidence_level: 0.95,
        interval: 'two_sided_percentile',
      },
      calibration: {
        method: 'equal_width_top_label_ece',
        bins: 10,
        empty_bins: 'exclude',
      },
      split_integrity: {
        rows_counted_once_per_lane: true,
        adjacent_turn_split_count: 0,
        latent_dialogue_split_count: 0,
      },
      control_integrity: {
        all_required_donors_present: true,
        donor_same_dialogue_count: 0,
        donor_turn_mismatch_count: 0,
        common_support_mismatch_count: 0,
      },
      power: {
        method: 'seeded_cluster_monte_carlo_fixed_effect',
        seed: 20260712,
        simulations: 5000,
        minimum_power: 0.8,
        selected_seeds_per_cell: 6,
        pilot_inputs: 'pooled_label_frequencies_and_nuisance_variance_only',
        observed_candidate_effects_used: false,
        achieved_power: {
          next_dag_event_family: { log_loss: 0.84, brier_score: 0.83 },
          next_proof_trajectory: { log_loss: 0.86, brier_score: 0.82 },
        },
      },
    },
    coverage: {
      worlds: [...LANE_LEVELS.world_transfer],
      latent_generators: [...LANE_LEVELS.generator_transfer],
      realizers: [...LANE_LEVELS.realizer_transfer],
      targets: [...TARGETS],
      representations: [
        'no_state',
        'lean_dag',
        'dag_trajectory',
        'field_trajectory',
        'dag_scramble',
        'dag_stale',
        'field_scramble',
        'field_stale',
        'oracle',
      ],
      crossed_cells: 12,
      seeds_per_cell: 6,
      latent_dialogues: 72,
      scored_transitions: 432,
      failed_dialogues: 0,
      lanes: {
        world_transfer: { levels: [...LANE_LEVELS.world_transfer], folds: 3 },
        generator_transfer: { levels: [...LANE_LEVELS.generator_transfer], folds: 2 },
        realizer_transfer: { levels: [...LANE_LEVELS.realizer_transfer], folds: 2 },
      },
    },
    comparisons,
    calibration,
    content_sha256: '',
  });
}

test('v2 statistical contract freezes every gate-relevant numeric and algorithmic setting', () => {
  const value = config();
  const contract = adaptiveStateValidityV2Contract(value);

  assert.equal(contract.head.regularization.lambda, 1);
  assert.equal(contract.head.regularization.scaling, 'lambda_over_training_rows');
  assert.equal(contract.head.solver.maximum_iterations, 2000);
  assert.equal(contract.head.solver.convergence_tolerance, 1e-5);
  assert.equal(contract.head.solver.convergence_criterion, 'absolute_objective_delta');
  assert.equal(contract.uncertainty.seed, 20260711);
  assert.equal(contract.power.seed, 20260712);
  assert.equal(contract.power.simulations, 5000);
  assert.deepEqual(contract.confirmationSeedsPerCell, [6, 8]);
  assert.match(adaptiveStateValidityV2ContractSha256(value), /^[0-9a-f]{64}$/u);

  const weakened = clone(value);
  weakened.analysis.fixed_head_contract.regularization.lambda = 0.5;
  assert.throws(() => adaptiveStateValidityV2Contract(weakened), /differs from the frozen v2 contract/u);

  const postHocPower = clone(value);
  postHocPower.analysis.power_contract.observed_candidate_effects_forbidden = false;
  assert.throws(() => adaptiveStateValidityV2Contract(postHocPower), /differs from the frozen v2 contract/u);
});

test('closed hierarchy returns each of the five and only the five preregistered verdicts', () => {
  const value = config();
  const field = passingReport(value);
  assert.equal(evaluateAdaptiveStateValidityV2(field, value).verdict, 'field_trajectory');

  const dag = clone(field);
  for (const target of TARGETS) {
    setNonSuperior(findComparison(dag, { target, candidate: 'field_trajectory', baseline: 'dag_trajectory' }));
  }
  sealReport(dag);
  assert.equal(evaluateAdaptiveStateValidityV2(dag, value).verdict, 'dag_trajectory');

  const lean = clone(field);
  for (const target of TARGETS) {
    setNonSuperior(findComparison(lean, { target, candidate: 'dag_trajectory', baseline: 'lean_dag' }));
  }
  sealReport(lean);
  assert.equal(evaluateAdaptiveStateValidityV2(lean, value).verdict, 'lean_dag_only');

  const noSensor = clone(field);
  for (const candidate of CANDIDATES) {
    for (const target of TARGETS) {
      const row = findComparison(noSensor, { target, candidate, baseline: 'no_state' });
      row.metrics.log_loss.confidence_interval.lower = -0.01;
      row.metrics.brier_score.confidence_interval.lower = -0.01;
    }
  }
  sealReport(noSensor);
  assert.equal(evaluateAdaptiveStateValidityV2(noSensor, value).verdict, 'no_sensor');

  const invalid = clone(field);
  const oracle = findComparison(invalid, {
    target: TARGETS[0],
    candidate: 'oracle',
    baseline: 'no_state',
  });
  oracle.metrics.log_loss.confidence_interval.lower = -0.01;
  sealReport(invalid);
  assert.equal(evaluateAdaptiveStateValidityV2(invalid, value).verdict, 'invalid_instrument');

  assert.deepEqual(
    new Set(
      [field, dag, lean, noSensor, invalid].map((report) => evaluateAdaptiveStateValidityV2(report, value).verdict),
    ),
    new Set(['invalid_instrument', 'no_sensor', 'lean_dag_only', 'dag_trajectory', 'field_trajectory']),
  );
});

test('matched controls and every transfer level are mandatory for rich-state promotion', () => {
  const value = config();
  const controlFailure = passingReport(value);
  findComparison(controlFailure, {
    target: TARGETS[0],
    candidate: 'dag_trajectory',
    baseline: 'dag_stale',
  }).metrics.log_loss.confidence_interval.lower = -0.01;
  sealReport(controlFailure);
  const controlDecision = evaluateAdaptiveStateValidityV2(controlFailure, value);
  assert.equal(controlDecision.verdict, 'lean_dag_only');
  assert.ok(
    controlDecision.gates.adequacy.dag_trajectory.reasons.some(
      (row) => row.code === 'superiority_interval_failed' && /over_dag_stale/u.test(row.context),
    ),
  );

  const transferFailure = passingReport(value);
  for (const target of TARGETS) {
    const row = findComparison(transferFailure, {
      lane: 'generator_transfer',
      level: 'durable_state',
      target,
      candidate: 'dag_trajectory',
      baseline: 'no_state',
    });
    row.metrics.log_loss.point_delta = -0.001;
  }
  sealReport(transferFailure);
  const transferDecision = evaluateAdaptiveStateValidityV2(transferFailure, value);
  assert.equal(transferDecision.verdict, 'lean_dag_only');
  assert.ok(
    transferDecision.gates.adequacy.dag_trajectory.reasons.some(
      (row) => row.code === 'transfer_point_improvement_failed' && row.lane === 'generator_transfer',
    ),
  );
});

test('underspecified, contract-drifted, and content-tampered reports fail closed', () => {
  const value = config();

  const missing = passingReport(value);
  missing.comparisons = missing.comparisons.filter(
    (row) =>
      !(
        row.lane === 'world_transfer' &&
        row.level === 'pooled' &&
        row.target === TARGETS[0] &&
        row.candidate === 'oracle' &&
        row.baseline === 'no_state'
      ),
  );
  sealReport(missing);
  assert.throws(() => evaluateAdaptiveStateValidityV2(missing, value), /missing required comparison/u);

  const wrongContract = passingReport(value);
  wrongContract.contract_sha256 = digest('different-contract');
  sealReport(wrongContract);
  assert.throws(() => evaluateAdaptiveStateValidityV2(wrongContract, value), /contract hash does not match/u);

  const tampered = passingReport(value);
  tampered.comparisons[0].metrics.log_loss.point_delta = 999;
  assert.throws(() => evaluateAdaptiveStateValidityV2(tampered, value), /content hash mismatch/u);

  const incomplete = passingReport(value);
  incomplete.coverage.failed_dialogues = 1;
  sealReport(incomplete);
  assert.throws(() => evaluateAdaptiveStateValidityV2(incomplete, value), /failed dialogues is incomplete/u);

  const nonconverged = passingReport(value);
  nonconverged.protocol.fixed_head.all_folds_converged = false;
  sealReport(nonconverged);
  assert.throws(() => evaluateAdaptiveStateValidityV2(nonconverged, value), /fixed_head differs/u);

  const underpowered = passingReport(value);
  underpowered.protocol.power.achieved_power.next_dag_event_family.log_loss = 0.79;
  sealReport(underpowered);
  assert.throws(() => evaluateAdaptiveStateValidityV2(underpowered, value), /power .* must be in \[0\.8, 1\]/u);

  const supportDrift = passingReport(value);
  supportDrift.comparisons[0].groups += 1;
  supportDrift.comparisons[0].predictions += 6;
  sealReport(supportDrift);
  assert.throws(() => evaluateAdaptiveStateValidityV2(supportDrift, value), /groups does not match/u);
});

test('decision output is byte-deterministic and carries machine-readable reasons', () => {
  const value = config();
  const report = passingReport(value);
  const first = evaluateAdaptiveStateValidityV2(report, value);
  const replay = evaluateAdaptiveStateValidityV2(clone(report), clone(value));

  assert.deepEqual(replay, first);
  assert.equal(first.selected_representation, 'field_trajectory');
  assert.deepEqual(first.reasons, [{ code: 'field_trajectory_adds_preregistered_incremental_value' }]);
  assert.match(first.contract_sha256, /^[0-9a-f]{64}$/u);
  assert.equal(first.report_content_sha256, report.content_sha256);
});
