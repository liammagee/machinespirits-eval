import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import yaml from 'yaml';
import { hashCanonicalJson } from '../services/experimentRunArtifacts.js';

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
const STATE_BLIND_BASELINES = ['no_state', 'class_prior', 'uniform'];
const LANE_LEVELS = {
  world_transfer: ['marrick', 'hethel', 'ravensmark'],
  generator_transfer: ['durable_state', 'dag_dropout'],
  realizer_transfer: ['codex_terra', 'claude_sonnet'],
};
const FIXTURE_PROVENANCE = Object.freeze({
  dataset_sha256: digest('dataset'),
  split_manifest_sha256: digest('split-manifest'),
  predictions_sha256: digest('predictions'),
  analyzer_sha256: digest('analyzer'),
});

function config() {
  return yaml.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function digest(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function groupsFor(lane, level, seedsPerCell = 8) {
  if (level === 'pooled') return 6 * seedsPerCell;
  if (lane === 'world_transfer') return 2 * seedsPerCell;
  if (lane === 'generator_transfer') return 3 * seedsPerCell;
  if (lane === 'realizer_transfer') return 6 * seedsPerCell;
  throw new Error(`unknown fixture lane ${lane}`);
}

function predictionsFor(lane, level, seedsPerCell = 8) {
  if (level === 'pooled') return 12 * seedsPerCell * 6;
  if (lane === 'world_transfer') return 4 * seedsPerCell * 6;
  if (lane === 'generator_transfer') return 6 * seedsPerCell * 6;
  if (lane === 'realizer_transfer') return 6 * seedsPerCell * 6;
  throw new Error(`unknown fixture lane ${lane}`);
}

function supportFor(lane, level, target) {
  return digest(`support:${lane}|${level}|${target}`);
}

function supportBindingFor({ lane, level, target, pairedSupport }) {
  return hashCanonicalJson({
    lane,
    level,
    target,
    paired_support_sha256: pairedSupport,
    predictions_sha256: FIXTURE_PROVENANCE.predictions_sha256,
    split_manifest_sha256: FIXTURE_PROVENANCE.split_manifest_sha256,
  });
}

function comparison({ lane, level, target, candidate, baseline, logLoss = 0.08, brier = 0.04 }) {
  const groups = groupsFor(lane, level);
  const pairedSupport = supportFor(lane, level, target);
  return {
    lane,
    level,
    target,
    candidate,
    baseline,
    groups,
    predictions: predictionsFor(lane, level),
    paired_support_sha256: pairedSupport,
    support_binding_sha256: supportBindingFor({ lane, level, target, pairedSupport }),
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
    for (const baseline of STATE_BLIND_BASELINES) {
      comparisons.push(
        comparison({
          lane: 'world_transfer',
          level: 'pooled',
          target,
          candidate: 'oracle',
          baseline,
        }),
      );
    }
  }
  for (const candidate of CANDIDATES) {
    for (const target of TARGETS) {
      for (const baseline of STATE_BLIND_BASELINES) {
        comparisons.push(comparison({ lane: 'world_transfer', level: 'pooled', target, candidate, baseline }));
        for (const level of LANE_LEVELS.world_transfer) {
          comparisons.push(comparison({ lane: 'world_transfer', level, target, candidate, baseline }));
        }
        for (const lane of ['generator_transfer', 'realizer_transfer']) {
          for (const level of LANE_LEVELS[lane]) {
            comparisons.push(comparison({ lane, level, target, candidate, baseline }));
          }
        }
      }
    }
  }
  for (const [candidate, controls] of Object.entries({
    dag_trajectory: ['dag_stale'],
    field_trajectory: ['field_stale'],
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
        predictions: predictionsFor('world_transfer', 'pooled'),
        paired_support_sha256: supportFor('world_transfer', 'pooled', target),
        support_binding_sha256: supportBindingFor({
          lane: 'world_transfer',
          level: 'pooled',
          target,
          pairedSupport: supportFor('world_transfer', 'pooled', target),
        }),
        ece: representation === 'oracle' ? 0.05 : 0.1,
      });
    }
  }

  return sealReport({
    schema: ADAPTIVE_STATE_PRECOMPUTED_LANE_REPORT_V2_SCHEMA,
    version: '2.1',
    contract_sha256: adaptiveStateValidityV2ContractSha256(value),
    stage: 's2_confirmation',
    status: 'complete',
    provenance: { ...FIXTURE_PROVENANCE },
    protocol: {
      target_contracts: [
        {
          id: 'next_dag_event_family',
          labels: ['retract', 'derive', 'adopt', 'none'],
          owner: 'transition_harness',
        },
        {
          id: 'next_proof_trajectory',
          labels: ['advance', 'regress', 'stall'],
          owner: 'world_normalized_proof_distance_and_debt_harness',
        },
      ],
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
      state_blind_baselines: {
        ids: [...STATE_BLIND_BASELINES],
        contract: {
          class_prior: {
            training_scope: 'each_training_fold_only',
            smoothing: 'symmetric_dirichlet',
            alpha: 1,
            label_set: 'frozen_target_labels',
            absent_class_behavior: 'alpha_smoothed_nonzero',
            test_frequency_access: false,
          },
          uniform: {
            probability: 'one_over_frozen_label_count',
            label_set: 'frozen_target_labels',
          },
        },
      },
      sensitivity_head_gate_eligible: false,
      bootstrap: {
        method: 'paired_cluster_bootstrap',
        cluster: 'groups.latent_pair_id',
        estimand: 'conditional_paired_prediction_loss',
        refit_within_bootstrap: false,
        world_inference_scope: 'three_fixed_authored_worlds',
        population_world_generalization_claim: false,
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
        realized_dialogue_split_count: 0,
        latent_pair_atomic_lanes: ['world_transfer', 'generator_transfer'],
        realizer_lane_pairing: 'same_latent_pair_opposite_surface_in_train',
        realizer_lane_latent_pair_overlap_expected: true,
      },
      control_integrity: {
        all_required_donors_present: true,
        donor_same_dialogue_count: 0,
        donor_turn_mismatch_count: 0,
        common_support_mismatch_count: 0,
      },
      sample_size: {
        method: 'preregistered_bounded_maximum',
        seeds_per_cell: 8,
        power_claim: false,
        selection_uses_pilot_effects: false,
        imprecision_interpretation: 'sensor_not_validated_under_bounded_design',
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
      seeds_per_cell: 8,
      realized_dialogues: 96,
      independent_latent_clusters: 48,
      scored_transitions: 576,
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
  assert.equal(contract.paidExecution.per_dialogue.scored_cli_process_dispatches, 14);
  assert.equal(contract.paidExecution.provider_canaries.calls, 2);
  assert.equal(
    contract.paidExecution.public_turn_analyzer.sensor_profile,
    'canonical_policy_invariant_no_memory_no_register',
  );
  assert.equal(contract.paidExecution.public_turn_analyzer.live_default_equivalence_claimed, false);
  assert.deepEqual(contract.paidExecution.public_turn_analyzer.recovery_floor, {
    metric: 'exact_harness_event_family_recovery',
    overall_minimum: 0.8,
    each_generator_minimum: 0.65,
    each_realizer_minimum: 0.65,
    disagreements_relabel_or_exclude_rows: false,
  });
  assert.equal(contract.uncertainty.seed, 20260711);
  assert.equal(contract.uncertainty.cluster, 'groups.latent_pair_id');
  assert.deepEqual(contract.sampleSize, {
    method: 'preregistered_bounded_maximum',
    seeds_per_cell: 8,
    power_claim: false,
    selection_uses_pilot_effects: false,
    imprecision_interpretation: 'sensor_not_validated_under_bounded_design',
  });
  assert.deepEqual(contract.confirmationSeedsPerCell, [8]);
  assert.deepEqual(contract.decision.matched_controls, {
    dag_trajectory: ['dag_stale'],
    field_trajectory: ['field_stale'],
  });
  assert.deepEqual(contract.decision.state_blind_baselines, STATE_BLIND_BASELINES);
  assert.deepEqual(contract.targetContracts, config().targets.co_primary);
  assert.equal(contract.stateBlindBaselines.class_prior.alpha, 1);
  assert.equal(contract.stateBlindBaselines.class_prior.test_frequency_access, false);
  assert.deepEqual(contract.decision.descriptive_only_controls, [
    { id: 'dag_scramble', gate_eligible: false, reason: 'donor_linked_cross_cluster_dependence' },
    { id: 'field_scramble', gate_eligible: false, reason: 'donor_linked_cross_cluster_dependence' },
  ]);
  assert.equal(contract.uncertainty.refit_within_bootstrap, false);
  assert.equal(contract.uncertainty.population_world_generalization_claim, false);
  assert.match(adaptiveStateValidityV2ContractSha256(value), /^[0-9a-f]{64}$/u);

  const weakened = clone(value);
  weakened.analysis.fixed_head_contract.regularization.lambda = 0.5;
  assert.throws(() => adaptiveStateValidityV2Contract(weakened), /differs from the frozen v2 contract/u);

  const postHocSizing = clone(value);
  postHocSizing.analysis.sample_size_contract.selection_uses_pilot_effects = true;
  assert.throws(() => adaptiveStateValidityV2Contract(postHocSizing), /differs from the frozen v2 contract/u);

  const labelDrift = clone(value);
  labelDrift.targets.co_primary[0].labels = ['derive', 'retract', 'adopt', 'none'];
  assert.throws(() => adaptiveStateValidityV2Contract(labelDrift), /co-primary target contracts differs/u);
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

  const oneOfTwoRichness = clone(field);
  setNonSuperior(
    findComparison(oneOfTwoRichness, {
      target: TARGETS[0],
      candidate: 'field_trajectory',
      baseline: 'dag_trajectory',
    }),
  );
  sealReport(oneOfTwoRichness);
  assert.equal(
    evaluateAdaptiveStateValidityV2(oneOfTwoRichness, value).verdict,
    'dag_trajectory',
    'one-of-two unadjusted richness wins may not promote a rung under familywise alpha 0.05',
  );

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
  const noSensorDecision = evaluateAdaptiveStateValidityV2(noSensor, value);
  assert.equal(noSensorDecision.verdict, 'no_sensor');
  assert.equal(noSensorDecision.bounded_design_interpretation.status, 'sensor_not_validated_under_bounded_design');
  assert.equal(noSensorDecision.bounded_design_interpretation.null_effect_claim, false);

  const noLeanLeapfrog = clone(field);
  for (const target of TARGETS) {
    findComparison(noLeanLeapfrog, {
      target,
      candidate: 'lean_dag',
      baseline: 'no_state',
    }).metrics.log_loss.confidence_interval.lower = -0.01;
  }
  sealReport(noLeanLeapfrog);
  const noLeanLeapfrogDecision = evaluateAdaptiveStateValidityV2(noLeanLeapfrog, value);
  assert.equal(noLeanLeapfrogDecision.verdict, 'no_sensor', 'DAG trajectory may not leapfrog a failed lean-DAG rung');
  assert.equal(noLeanLeapfrogDecision.gates.adequacy.dag_trajectory.status, 'not_eligible');
  assert.equal(noLeanLeapfrogDecision.gates.adequacy.field_trajectory.status, 'not_eligible');
  assert.equal(noLeanLeapfrogDecision.gates.richness.dag_trajectory_over_lean_dag.status, 'not_eligible');
  assert.equal(noLeanLeapfrogDecision.gates.richness.field_trajectory_over_dag_trajectory.status, 'not_eligible');
  assert.ok(noLeanLeapfrogDecision.reasons.some((row) => /adequacy:lean_dag/u.test(row.context || '')));
  assert.ok(noLeanLeapfrogDecision.reasons.every((row) => !/dag_trajectory/u.test(row.context || '')));

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

test('candidate MUE applies to no-state but not the two auxiliary state-blind baselines', () => {
  const value = config();
  const report = passingReport(value);
  for (const target of TARGETS) {
    for (const baseline of ['class_prior', 'uniform']) {
      for (const candidate of CANDIDATES) {
        const row = findComparison(report, { target, candidate, baseline });
        row.metrics.log_loss = {
          point_delta: 0.01,
          confidence_interval: { lower: 0.001, upper: 0.019 },
          probability_of_improvement: 0.99,
        };
        row.metrics.brier_score = {
          point_delta: 0.005,
          confidence_interval: { lower: 0.001, upper: 0.009 },
          probability_of_improvement: 0.99,
        };
      }
    }
  }
  sealReport(report);
  assert.equal(evaluateAdaptiveStateValidityV2(report, value).verdict, 'field_trajectory');
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

  const falsePowerClaim = passingReport(value);
  falsePowerClaim.protocol.sample_size.power_claim = true;
  sealReport(falsePowerClaim);
  assert.throws(() => evaluateAdaptiveStateValidityV2(falsePowerClaim, value), /sample_size differs/u);

  const supportDrift = passingReport(value);
  supportDrift.comparisons[0].groups += 1;
  supportDrift.comparisons[0].predictions += 6;
  sealReport(supportDrift);
  assert.throws(() => evaluateAdaptiveStateValidityV2(supportDrift, value), /groups does not match/u);

  const inconsistentSupport = passingReport(value);
  inconsistentSupport.comparisons[1].paired_support_sha256 = digest('different-support');
  inconsistentSupport.comparisons[1].support_binding_sha256 = supportBindingFor({
    lane: inconsistentSupport.comparisons[1].lane,
    level: inconsistentSupport.comparisons[1].level,
    target: inconsistentSupport.comparisons[1].target,
    pairedSupport: inconsistentSupport.comparisons[1].paired_support_sha256,
  });
  sealReport(inconsistentSupport);
  assert.throws(
    () => evaluateAdaptiveStateValidityV2(inconsistentSupport, value),
    /do not share canonical paired support/u,
  );

  const unboundSupport = passingReport(value);
  unboundSupport.comparisons[0].support_binding_sha256 = digest('not-bound-to-artifacts');
  sealReport(unboundSupport);
  assert.throws(() => evaluateAdaptiveStateValidityV2(unboundSupport, value), /not bound to predictions\/splits/u);
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
