import { createHash } from 'node:crypto';

export const ADAPTIVE_STATE_PRECOMPUTED_LANE_REPORT_V2_SCHEMA =
  'machinespirits.adaptive-state-precomputed-lane-report.v2';
export const ADAPTIVE_STATE_VALIDITY_DECISION_V2_SCHEMA = 'machinespirits.adaptive-state-validity-decision.v2';

const VERDICTS = Object.freeze([
  'invalid_instrument',
  'no_sensor',
  'lean_dag_only',
  'dag_trajectory',
  'field_trajectory',
]);
const TARGETS = Object.freeze(['next_dag_event_family', 'next_proof_trajectory']);
const REPRESENTATIONS = Object.freeze([
  'no_state',
  'lean_dag',
  'dag_trajectory',
  'field_trajectory',
  'dag_scramble',
  'dag_stale',
  'field_scramble',
  'field_stale',
  'oracle',
]);
const CANDIDATES = Object.freeze(['lean_dag', 'dag_trajectory', 'field_trajectory']);
const METRICS = Object.freeze(['log_loss', 'brier_score']);
const LANE_LEVELS = Object.freeze({
  world_transfer: Object.freeze(['marrick', 'hethel', 'ravensmark']),
  generator_transfer: Object.freeze(['durable_state', 'dag_dropout']),
  realizer_transfer: Object.freeze(['codex_terra', 'claude_sonnet']),
});
const HASH_PATTERN = /^[0-9a-f]{64}$/u;

const EXPECTED_FIXED_HEAD_CONTRACT = Object.freeze({
  feature_encoding: 'training_fold_numeric_zscore_and_categorical_one_hot',
  categorical_vocabulary: 'training_fold_only',
  categorical_unknown_token: '__unknown__',
  categorical_missing_token: '__missing__',
  numeric_missing_indicators: true,
  regularization: Object.freeze({ kind: 'l2', lambda: 1, scaling: 'lambda_over_training_rows' }),
  solver: Object.freeze({
    id: 'deterministic_batch_gradient_descent',
    learning_rate: 0.05,
    maximum_iterations: 2000,
    convergence_tolerance: 1e-5,
    convergence_criterion: 'absolute_objective_delta',
  }),
  probability_clip: 1e-12,
});
const EXPECTED_SENSITIVITY_HEAD_CONTRACT = Object.freeze({ gate_eligible: false, neighbors: 7 });
const EXPECTED_UNCERTAINTY_CONTRACT = Object.freeze({
  method: 'paired_cluster_bootstrap',
  cluster: 'latent_dialogue',
  iterations: 5000,
  seed: 20260711,
  confidence_level: 0.95,
  interval: 'two_sided_percentile',
  minimum_probability_of_improvement: 0.95,
});
const EXPECTED_CALIBRATION_CONTRACT = Object.freeze({
  method: 'equal_width_top_label_ece',
  bins: 10,
  empty_bins: 'exclude',
  minimum_predictions: 20,
});
const EXPECTED_POWER_CONTRACT = Object.freeze({
  method: 'seeded_cluster_monte_carlo_fixed_effect',
  seed: 20260712,
  simulations: 5000,
  minimum_power: 0.8,
  candidate_seeds_per_cell: Object.freeze([6, 8]),
  pilot_inputs: 'pooled_label_frequencies_and_nuisance_variance_only',
  observed_candidate_effects_forbidden: true,
});
const EXPECTED_DECISION_CONTRACT = Object.freeze({
  report_schema: ADAPTIVE_STATE_PRECOMPUTED_LANE_REPORT_V2_SCHEMA,
  confirmation_stage: 's2_confirmation',
  require_complete_crossed_matrix: true,
  delta_direction: 'baseline_loss_minus_candidate_loss',
  primary_lane: 'world_transfer',
  superiority: Object.freeze({
    confidence_interval_lower_strictly_greater_than: 0,
    probability_of_improvement_at_least: 0.95,
  }),
  practical_significance: Object.freeze({
    required_for: Object.freeze(['candidate_over_no_state', 'incremental_richness']),
  }),
  noninferiority: Object.freeze({ confidence_interval_lower_at_least_negative_margin: true }),
  multiplicity: Object.freeze({
    method: 'closed_sequential_hierarchy',
    familywise_alpha: 0.05,
    co_primary_adequacy_rule: 'both_targets_required',
    promotion_order: Object.freeze(['lean_dag', 'dag_trajectory', 'field_trajectory']),
  }),
  calibration: Object.freeze({
    oracle_max_ece: 0.1,
    candidate_max_ece: 0.2,
    minimum_predictions: 20,
  }),
  level_rules: Object.freeze({
    minimum_improving_worlds: 2,
    required_improving_generators: 2,
    required_improving_realizers: 2,
    point_improvement_requires_both_metrics_and_targets: true,
    transfer_noninferiority_requires_every_level: true,
  }),
  matched_controls: Object.freeze({
    dag_trajectory: Object.freeze(['dag_scramble', 'dag_stale']),
    field_trajectory: Object.freeze(['field_scramble', 'field_stale']),
  }),
  richness: Object.freeze({
    minimum_superior_targets: 1,
    remaining_targets_must_be_noninferior: true,
    sequential: true,
  }),
});

function sortForCanonicalJson(value) {
  if (Array.isArray(value)) return value.map(sortForCanonicalJson);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortForCanonicalJson(value[key])]),
  );
}

function canonicalJson(value) {
  return JSON.stringify(sortForCanonicalJson(value));
}

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function assertExact(actual, expected, path) {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new Error(`stateValidityMetricsV2: ${path} differs from the frozen v2 contract`);
  }
}

function assertObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`stateValidityMetricsV2: ${path} must be an object`);
  }
  return value;
}

function assertArray(value, path) {
  if (!Array.isArray(value)) throw new Error(`stateValidityMetricsV2: ${path} must be an array`);
  return value;
}

function assertFinite(value, path) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) throw new Error(`stateValidityMetricsV2: ${path} must be finite`);
  return numeric;
}

function assertInteger(value, path, minimum = 0) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < minimum) {
    throw new Error(`stateValidityMetricsV2: ${path} must be an integer >= ${minimum}`);
  }
  return numeric;
}

function assertHash(value, path) {
  if (!HASH_PATTERN.test(String(value || ''))) {
    throw new Error(`stateValidityMetricsV2: ${path} must be a lowercase SHA-256 digest`);
  }
  return String(value);
}

function ids(rows, path) {
  return assertArray(rows, path).map((row, index) => {
    const id = String(row?.id || '');
    if (!id) throw new Error(`stateValidityMetricsV2: ${path}[${index}].id is required`);
    return id;
  });
}

/**
 * Extract and fail-closed validate every setting that can affect the v2
 * decision. The code deliberately rejects drift under the same v2 schema;
 * changing one of these values requires a new schema/version and evaluator.
 */
export function adaptiveStateValidityV2Contract(config) {
  assertObject(config, 'config');
  if (config.schema !== 'machinespirits.adaptive-state-benchmark-config.v2' || String(config.version) !== '2.0') {
    throw new Error('stateValidityMetricsV2: config must use the frozen adaptive-state v2 schema and version');
  }
  assertExact(ids(config.critical_path?.worlds, 'critical_path.worlds'), LANE_LEVELS.world_transfer, 'world ids');
  assertExact(
    ids(config.critical_path?.latent_generators, 'critical_path.latent_generators'),
    LANE_LEVELS.generator_transfer,
    'latent-generator ids',
  );
  assertExact(
    ids(config.critical_path?.language_realizers, 'critical_path.language_realizers'),
    LANE_LEVELS.realizer_transfer,
    'language-realizer ids',
  );
  assertExact(
    config.critical_path?.action_schedule,
    [
      'diagnose_with_discriminating_question',
      'minimal_hint',
      'request_evidence',
      'request_evidence',
      'minimal_hint',
      'diagnose_with_discriminating_question',
    ],
    'critical_path.action_schedule',
  );
  assertExact(
    config.critical_path?.dialogue,
    {
      bootstrap_public_observations: 1,
      learner_turns: 7,
      scored_transitions: 6,
      one_realizer_call_per_turn: true,
      future_state_hidden_from_realizer: true,
    },
    'critical_path.dialogue',
  );
  assertExact(config.representations?.nested_candidates, ['no_state', ...CANDIDATES], 'nested candidates');
  assertExact(
    [
      ...(config.representations?.nested_candidates || []),
      ...(config.representations?.matched_controls || []),
      ...(config.representations?.upper_bound_only || []),
    ],
    REPRESENTATIONS,
    'representation set',
  );
  assertExact(ids(config.targets?.co_primary, 'targets.co_primary'), TARGETS, 'co-primary targets');
  assertExact(config.analysis?.fixed_head, 'l2_multinomial_logistic', 'analysis.fixed_head');
  assertExact(config.analysis?.fixed_head_contract, EXPECTED_FIXED_HEAD_CONTRACT, 'analysis.fixed_head_contract');
  assertExact(config.analysis?.sensitivity_head, 'mixed_feature_knn', 'analysis.sensitivity_head');
  assertExact(
    config.analysis?.sensitivity_head_contract,
    EXPECTED_SENSITIVITY_HEAD_CONTRACT,
    'analysis.sensitivity_head_contract',
  );
  assertExact(
    config.analysis?.split_lanes,
    [
      { id: 'world_transfer', method: 'leave_one_world_out', folds: 3, primary: true },
      { id: 'generator_transfer', method: 'leave_one_generator_out', folds: 2, primary: false },
      { id: 'realizer_transfer', method: 'leave_one_realizer_out', folds: 2, primary: false },
    ],
    'analysis.split_lanes',
  );
  assertExact(config.analysis?.uncertainty, EXPECTED_UNCERTAINTY_CONTRACT, 'analysis.uncertainty');
  assertExact(
    config.analysis?.metrics,
    {
      primary: ['multiclass_log_loss', 'multiclass_brier_score'],
      calibration: 'expected_calibration_error',
    },
    'analysis.metrics',
  );
  assertExact(config.analysis?.calibration_contract, EXPECTED_CALIBRATION_CONTRACT, 'analysis.calibration_contract');
  assertExact(config.analysis?.power_contract, EXPECTED_POWER_CONTRACT, 'analysis.power_contract');
  assertExact(config.minimum_useful_effects, { log_loss_nats: 0.05, brier_score: 0.02 }, 'minimum useful effects');
  assertExact(config.gate?.decision_contract, EXPECTED_DECISION_CONTRACT, 'gate.decision_contract');
  assertExact(config.gate?.noninferiority_margins, { log_loss_nats: 0.02, brier_score: 0.01 }, 'margins');
  assertExact(config.gate?.valid_verdicts, VERDICTS, 'valid verdicts');
  assertExact(config.stages?.s2_confirmation?.seeds_per_cell_options, [6, 8], 'confirmation sample sizes');
  assertExact(config.stages?.s2_confirmation?.max_seeds_per_cell, 8, 'confirmation maximum sample size');
  assertExact(
    config.complexity_cap,
    {
      no_policy_sweep: true,
      no_profile_sweep: true,
      no_judge_model_sweep: true,
      no_target_expansion_before_confirmation: true,
      maximum_confirmation_seeds_per_cell: 8,
    },
    'complexity cap',
  );

  return {
    schema: 'machinespirits.adaptive-state-validity-statistical-contract.v2',
    version: '2.0',
    axes: clone(LANE_LEVELS),
    targets: [...TARGETS],
    representations: [...REPRESENTATIONS],
    actionSchedule: [...config.critical_path.action_schedule],
    dialogue: clone(config.critical_path.dialogue),
    head: { id: config.analysis.fixed_head, ...clone(config.analysis.fixed_head_contract) },
    sensitivityHead: { id: config.analysis.sensitivity_head, ...clone(config.analysis.sensitivity_head_contract) },
    lanes: clone(config.analysis.split_lanes),
    uncertainty: clone(config.analysis.uncertainty),
    metrics: clone(config.analysis.metrics),
    calibration: clone(config.analysis.calibration_contract),
    power: clone(config.analysis.power_contract),
    minimumUsefulEffects: {
      log_loss: Number(config.minimum_useful_effects.log_loss_nats),
      brier_score: Number(config.minimum_useful_effects.brier_score),
    },
    noninferiorityMargins: {
      log_loss: Number(config.gate.noninferiority_margins.log_loss_nats),
      brier_score: Number(config.gate.noninferiority_margins.brier_score),
    },
    decision: clone(config.gate.decision_contract),
    confirmationSeedsPerCell: [...config.stages.s2_confirmation.seeds_per_cell_options],
    complexityCap: clone(config.complexity_cap),
    verdicts: [...VERDICTS],
  };
}

export function adaptiveStateValidityV2ContractSha256(config) {
  return sha256(canonicalJson(adaptiveStateValidityV2Contract(config)));
}

function reportContent(report) {
  return {
    schema: report.schema,
    version: report.version,
    contract_sha256: report.contract_sha256,
    stage: report.stage,
    status: report.status,
    provenance: report.provenance,
    protocol: report.protocol,
    coverage: report.coverage,
    comparisons: report.comparisons,
    calibration: report.calibration,
  };
}

function expectedGroupsForLaneLevel(contract, seedsPerCell, lane, level) {
  if (level === 'pooled') return 12 * seedsPerCell;
  if (!contract.axes[lane]?.includes(level)) {
    throw new Error(`stateValidityMetricsV2: ${lane}/${level} is not a frozen lane level`);
  }
  if (lane === 'world_transfer') {
    return contract.axes.generator_transfer.length * contract.axes.realizer_transfer.length * seedsPerCell;
  }
  if (lane === 'generator_transfer') {
    return contract.axes.world_transfer.length * contract.axes.realizer_transfer.length * seedsPerCell;
  }
  if (lane === 'realizer_transfer') {
    return contract.axes.world_transfer.length * contract.axes.generator_transfer.length * seedsPerCell;
  }
  throw new Error(`stateValidityMetricsV2: unsupported lane ${lane}`);
}

function validateProtocol(protocol, contract, seedsPerCell) {
  assertObject(protocol, 'report.protocol');
  assertExact(
    protocol.fixed_head,
    {
      id: contract.head.id,
      feature_encoding: contract.head.feature_encoding,
      categorical_vocabulary: contract.head.categorical_vocabulary,
      regularization_kind: contract.head.regularization.kind,
      regularization_lambda: contract.head.regularization.lambda,
      regularization_scaling: contract.head.regularization.scaling,
      solver_id: contract.head.solver.id,
      convergence_criterion: contract.head.solver.convergence_criterion,
      all_folds_converged: true,
      nonfinite_probability_count: 0,
    },
    'report.protocol.fixed_head',
  );
  assertExact(protocol.sensitivity_head_gate_eligible, false, 'report.protocol.sensitivity_head_gate_eligible');
  assertExact(
    protocol.bootstrap,
    {
      method: contract.uncertainty.method,
      cluster: contract.uncertainty.cluster,
      iterations: contract.uncertainty.iterations,
      seed: contract.uncertainty.seed,
      confidence_level: contract.uncertainty.confidence_level,
      interval: contract.uncertainty.interval,
    },
    'report.protocol.bootstrap',
  );
  assertExact(
    protocol.calibration,
    {
      method: contract.calibration.method,
      bins: contract.calibration.bins,
      empty_bins: contract.calibration.empty_bins,
    },
    'report.protocol.calibration',
  );
  assertExact(
    protocol.split_integrity,
    {
      rows_counted_once_per_lane: true,
      adjacent_turn_split_count: 0,
      latent_dialogue_split_count: 0,
    },
    'report.protocol.split_integrity',
  );
  assertExact(
    protocol.control_integrity,
    {
      all_required_donors_present: true,
      donor_same_dialogue_count: 0,
      donor_turn_mismatch_count: 0,
      common_support_mismatch_count: 0,
    },
    'report.protocol.control_integrity',
  );
  const power = assertObject(protocol.power, 'report.protocol.power');
  assertExact(
    {
      method: power.method,
      seed: power.seed,
      simulations: power.simulations,
      minimum_power: power.minimum_power,
      selected_seeds_per_cell: power.selected_seeds_per_cell,
      pilot_inputs: power.pilot_inputs,
      observed_candidate_effects_used: power.observed_candidate_effects_used,
    },
    {
      method: contract.power.method,
      seed: contract.power.seed,
      simulations: contract.power.simulations,
      minimum_power: contract.power.minimum_power,
      selected_seeds_per_cell: seedsPerCell,
      pilot_inputs: contract.power.pilot_inputs,
      observed_candidate_effects_used: false,
    },
    'report.protocol.power decision',
  );
  assertExact(
    Object.keys(assertObject(power.achieved_power, 'report.protocol.power.achieved_power')).sort(),
    [...TARGETS].sort(),
    'power target keys',
  );
  for (const target of TARGETS) {
    const metrics = assertObject(power.achieved_power[target], `report.protocol.power.achieved_power.${target}`);
    assertExact(Object.keys(metrics).sort(), [...METRICS].sort(), `power metric keys for ${target}`);
    for (const metric of METRICS) {
      const achieved = assertFinite(metrics[metric], `report.protocol.power.achieved_power.${target}.${metric}`);
      if (achieved < contract.power.minimum_power || achieved > 1) {
        throw new Error(
          `stateValidityMetricsV2: power for ${target}/${metric} must be in [${contract.power.minimum_power}, 1]`,
        );
      }
    }
  }
}

export function adaptiveStateValidityV2ReportContentSha256(report) {
  return sha256(canonicalJson(reportContent(report)));
}

function comparisonKey({ lane, level, target, candidate, baseline }) {
  return [lane, level, target, candidate, baseline].join('|');
}

function calibrationKey({ lane, level, target, representation }) {
  return [lane, level, target, representation].join('|');
}

function validateMetric(metric, path) {
  assertObject(metric, path);
  const pointDelta = assertFinite(metric.point_delta, `${path}.point_delta`);
  const interval = assertObject(metric.confidence_interval, `${path}.confidence_interval`);
  const lower = assertFinite(interval.lower, `${path}.confidence_interval.lower`);
  const upper = assertFinite(interval.upper, `${path}.confidence_interval.upper`);
  if (lower > upper) throw new Error(`stateValidityMetricsV2: ${path} confidence interval is reversed`);
  const probability = assertFinite(metric.probability_of_improvement, `${path}.probability_of_improvement`);
  if (probability < 0 || probability > 1) {
    throw new Error(`stateValidityMetricsV2: ${path}.probability_of_improvement must be in [0, 1]`);
  }
  return { pointDelta, lower, upper, probability };
}

function validateReport(report, contract) {
  assertObject(report, 'report');
  if (report.schema !== ADAPTIVE_STATE_PRECOMPUTED_LANE_REPORT_V2_SCHEMA || String(report.version) !== '2.0') {
    throw new Error('stateValidityMetricsV2: report schema/version is not the frozen v2 precomputed-lane contract');
  }
  const expectedContractSha = sha256(canonicalJson(contract));
  if (report.contract_sha256 !== expectedContractSha) {
    throw new Error('stateValidityMetricsV2: report statistical contract hash does not match the supplied config');
  }
  if (report.stage !== contract.decision.confirmation_stage || report.status !== 'complete') {
    throw new Error('stateValidityMetricsV2: only a complete untouched confirmation report is gate-eligible');
  }
  assertHash(report.content_sha256, 'report.content_sha256');
  if (report.content_sha256 !== adaptiveStateValidityV2ReportContentSha256(report)) {
    throw new Error('stateValidityMetricsV2: report content hash mismatch');
  }
  for (const key of ['dataset_sha256', 'split_manifest_sha256', 'predictions_sha256', 'analyzer_sha256']) {
    assertHash(report.provenance?.[key], `report.provenance.${key}`);
  }

  const coverage = assertObject(report.coverage, 'report.coverage');
  assertExact(coverage.worlds, contract.axes.world_transfer, 'report.coverage.worlds');
  assertExact(coverage.latent_generators, contract.axes.generator_transfer, 'report.coverage.latent_generators');
  assertExact(coverage.realizers, contract.axes.realizer_transfer, 'report.coverage.realizers');
  assertExact(coverage.targets, contract.targets, 'report.coverage.targets');
  assertExact(coverage.representations, contract.representations, 'report.coverage.representations');
  const seedsPerCell = assertInteger(coverage.seeds_per_cell, 'report.coverage.seeds_per_cell', 1);
  if (!contract.confirmationSeedsPerCell.includes(seedsPerCell)) {
    throw new Error('stateValidityMetricsV2: report uses an unapproved confirmation sample size');
  }
  if (assertInteger(coverage.crossed_cells, 'report.coverage.crossed_cells', 1) !== 12) {
    throw new Error('stateValidityMetricsV2: report must contain exactly 12 crossed cells');
  }
  const expectedDialogues = 12 * seedsPerCell;
  if (assertInteger(coverage.latent_dialogues, 'report.coverage.latent_dialogues', 1) !== expectedDialogues) {
    throw new Error('stateValidityMetricsV2: latent-dialogue count does not match the crossed confirmation plan');
  }
  if (
    assertInteger(coverage.scored_transitions, 'report.coverage.scored_transitions', 1) !==
    expectedDialogues * contract.dialogue.scored_transitions
  ) {
    throw new Error('stateValidityMetricsV2: scored-transition count does not match the crossed confirmation plan');
  }
  if (assertInteger(coverage.failed_dialogues, 'report.coverage.failed_dialogues', 0) !== 0) {
    throw new Error('stateValidityMetricsV2: a confirmation report with failed dialogues is incomplete');
  }
  validateProtocol(report.protocol, contract, seedsPerCell);
  for (const lane of contract.lanes) {
    const reported = assertObject(coverage.lanes?.[lane.id], `report.coverage.lanes.${lane.id}`);
    assertExact(reported.levels, contract.axes[lane.id], `report.coverage.lanes.${lane.id}.levels`);
    if (assertInteger(reported.folds, `report.coverage.lanes.${lane.id}.folds`, 1) !== lane.folds) {
      throw new Error(`stateValidityMetricsV2: ${lane.id} fold count differs from the frozen contract`);
    }
  }

  const comparisons = new Map();
  for (const [index, comparison] of assertArray(report.comparisons, 'report.comparisons').entries()) {
    const path = `report.comparisons[${index}]`;
    assertObject(comparison, path);
    const levels = contract.axes[comparison.lane];
    if (!levels) throw new Error(`stateValidityMetricsV2: ${path}.lane is unknown`);
    if (comparison.level !== 'pooled' && !levels.includes(comparison.level)) {
      throw new Error(`stateValidityMetricsV2: ${path}.level is not declared for ${comparison.lane}`);
    }
    if (!contract.targets.includes(comparison.target)) {
      throw new Error(`stateValidityMetricsV2: ${path}.target is outside the frozen target set`);
    }
    if (
      !contract.representations.includes(comparison.candidate) ||
      !contract.representations.includes(comparison.baseline)
    ) {
      throw new Error(`stateValidityMetricsV2: ${path} uses an unknown representation`);
    }
    if (comparison.candidate === comparison.baseline) {
      throw new Error(`stateValidityMetricsV2: ${path} compares a representation with itself`);
    }
    const expectedGroups = expectedGroupsForLaneLevel(contract, seedsPerCell, comparison.lane, comparison.level);
    if (assertInteger(comparison.groups, `${path}.groups`, 2) !== expectedGroups) {
      throw new Error(`stateValidityMetricsV2: ${path}.groups does not match its lane-level support`);
    }
    if (
      assertInteger(comparison.predictions, `${path}.predictions`, contract.calibration.minimum_predictions) !==
      expectedGroups * contract.dialogue.scored_transitions
    ) {
      throw new Error(`stateValidityMetricsV2: ${path}.predictions does not match its lane-level support`);
    }
    assertHash(comparison.paired_support_sha256, `${path}.paired_support_sha256`);
    assertExact(
      Object.keys(assertObject(comparison.metrics, `${path}.metrics`)).sort(),
      [...METRICS].sort(),
      `${path}.metric keys`,
    );
    for (const metric of METRICS) validateMetric(comparison.metrics[metric], `${path}.metrics.${metric}`);
    const key = comparisonKey(comparison);
    if (comparisons.has(key)) throw new Error(`stateValidityMetricsV2: duplicate comparison ${key}`);
    comparisons.set(key, comparison);
  }

  const calibration = new Map();
  for (const [index, row] of assertArray(report.calibration, 'report.calibration').entries()) {
    const path = `report.calibration[${index}]`;
    assertObject(row, path);
    const levels = contract.axes[row.lane];
    if (!levels) throw new Error(`stateValidityMetricsV2: ${path}.lane is unknown`);
    if (row.level !== 'pooled' && !levels.includes(row.level)) {
      throw new Error(`stateValidityMetricsV2: ${path}.level is not declared for ${row.lane}`);
    }
    if (!contract.targets.includes(row.target) || !contract.representations.includes(row.representation)) {
      throw new Error(`stateValidityMetricsV2: ${path} is outside the frozen target/representation set`);
    }
    assertInteger(row.predictions, `${path}.predictions`, 1);
    const ece = assertFinite(row.ece, `${path}.ece`);
    if (ece < 0 || ece > 1) throw new Error(`stateValidityMetricsV2: ${path}.ece must be in [0, 1]`);
    const key = calibrationKey(row);
    if (calibration.has(key)) throw new Error(`stateValidityMetricsV2: duplicate calibration row ${key}`);
    const expectedPredictions =
      expectedGroupsForLaneLevel(contract, seedsPerCell, row.lane, row.level) * contract.dialogue.scored_transitions;
    if (Number(row.predictions) !== expectedPredictions) {
      throw new Error(`stateValidityMetricsV2: ${path}.predictions does not match its lane-level support`);
    }
    calibration.set(key, row);
  }
  return { comparisons, calibration };
}

function reason(code, fields = {}) {
  return { code, ...fields };
}

function comparisonFrom(index, lane, level, target, candidate, baseline) {
  const key = comparisonKey({ lane, level, target, candidate, baseline });
  const comparison = index.get(key);
  if (!comparison) throw new Error(`stateValidityMetricsV2: missing required comparison ${key}`);
  return comparison;
}

function calibrationFrom(index, target, representation) {
  const key = calibrationKey({
    lane: 'world_transfer',
    level: 'pooled',
    target,
    representation,
  });
  const row = index.get(key);
  if (!row) throw new Error(`stateValidityMetricsV2: missing required calibration row ${key}`);
  return row;
}

function metricResult(comparison, metricName) {
  const metric = comparison.metrics[metricName];
  return {
    pointDelta: Number(metric.point_delta),
    lower: Number(metric.confidence_interval.lower),
    upper: Number(metric.confidence_interval.upper),
    probability: Number(metric.probability_of_improvement),
  };
}

function superiorityFailures(comparison, contract, { practical = false, context }) {
  const failures = [];
  for (const metricName of METRICS) {
    const metric = metricResult(comparison, metricName);
    if (!(metric.lower > contract.decision.superiority.confidence_interval_lower_strictly_greater_than)) {
      failures.push(reason('superiority_interval_failed', { context, metric: metricName, observed: metric.lower }));
    }
    if (metric.probability < contract.decision.superiority.probability_of_improvement_at_least) {
      failures.push(
        reason('superiority_probability_failed', { context, metric: metricName, observed: metric.probability }),
      );
    }
    if (practical && metric.pointDelta < contract.minimumUsefulEffects[metricName]) {
      failures.push(
        reason('minimum_useful_effect_failed', {
          context,
          metric: metricName,
          observed: metric.pointDelta,
          required: contract.minimumUsefulEffects[metricName],
        }),
      );
    }
  }
  return failures;
}

function noninferiorityFailures(comparison, contract, context) {
  const failures = [];
  for (const metricName of METRICS) {
    const metric = metricResult(comparison, metricName);
    const threshold = -contract.noninferiorityMargins[metricName];
    if (metric.lower < threshold) {
      failures.push(
        reason('noninferiority_failed', { context, metric: metricName, observed: metric.lower, required: threshold }),
      );
    }
  }
  return failures;
}

function allPointDeltasPositive(comparisons) {
  return comparisons.every((comparison) => METRICS.every((metric) => metricResult(comparison, metric).pointDelta > 0));
}

function instrumentGate(indexes, contract) {
  const reasons = [];
  for (const target of contract.targets) {
    const comparison = comparisonFrom(indexes.comparisons, 'world_transfer', 'pooled', target, 'oracle', 'no_state');
    reasons.push(
      ...superiorityFailures(comparison, contract, {
        practical: false,
        context: `instrument:${target}:oracle_over_no_state`,
      }),
    );
    const calibration = calibrationFrom(indexes.calibration, target, 'oracle');
    if (calibration.predictions < contract.decision.calibration.minimum_predictions) {
      reasons.push(
        reason('oracle_calibration_support_failed', {
          target,
          observed: calibration.predictions,
          required: contract.decision.calibration.minimum_predictions,
        }),
      );
    }
    if (calibration.ece > contract.decision.calibration.oracle_max_ece) {
      reasons.push(
        reason('oracle_calibration_failed', {
          target,
          observed: calibration.ece,
          required: contract.decision.calibration.oracle_max_ece,
        }),
      );
    }
  }
  return { passed: reasons.length === 0, reasons };
}

function candidateAdequacy(candidate, indexes, contract) {
  const reasons = [];
  for (const target of contract.targets) {
    const comparison = comparisonFrom(indexes.comparisons, 'world_transfer', 'pooled', target, candidate, 'no_state');
    reasons.push(
      ...superiorityFailures(comparison, contract, {
        practical: true,
        context: `adequacy:${candidate}:${target}:over_no_state`,
      }),
    );
    const calibration = calibrationFrom(indexes.calibration, target, candidate);
    if (calibration.predictions < contract.decision.calibration.minimum_predictions) {
      reasons.push(
        reason('candidate_calibration_support_failed', {
          candidate,
          target,
          observed: calibration.predictions,
          required: contract.decision.calibration.minimum_predictions,
        }),
      );
    }
    if (calibration.ece > contract.decision.calibration.candidate_max_ece) {
      reasons.push(
        reason('candidate_calibration_failed', {
          candidate,
          target,
          observed: calibration.ece,
          required: contract.decision.calibration.candidate_max_ece,
        }),
      );
    }
  }

  for (const control of contract.decision.matched_controls[candidate] || []) {
    for (const target of contract.targets) {
      const comparison = comparisonFrom(indexes.comparisons, 'world_transfer', 'pooled', target, candidate, control);
      reasons.push(
        ...superiorityFailures(comparison, contract, {
          practical: false,
          context: `control:${candidate}:${target}:over_${control}`,
        }),
      );
    }
  }

  const improvingWorlds = contract.axes.world_transfer.filter((level) => {
    const rows = contract.targets.map((target) =>
      comparisonFrom(indexes.comparisons, 'world_transfer', level, target, candidate, 'no_state'),
    );
    return allPointDeltasPositive(rows);
  });
  if (improvingWorlds.length < contract.decision.level_rules.minimum_improving_worlds) {
    reasons.push(
      reason('world_point_improvement_failed', {
        candidate,
        improving: improvingWorlds,
        required: contract.decision.level_rules.minimum_improving_worlds,
      }),
    );
  }

  for (const lane of ['generator_transfer', 'realizer_transfer']) {
    const improving = [];
    for (const level of contract.axes[lane]) {
      const rows = contract.targets.map((target) =>
        comparisonFrom(indexes.comparisons, lane, level, target, candidate, 'no_state'),
      );
      if (allPointDeltasPositive(rows)) improving.push(level);
      for (const [targetIndex, comparison] of rows.entries()) {
        reasons.push(
          ...noninferiorityFailures(
            comparison,
            contract,
            `transfer:${candidate}:${lane}:${level}:${contract.targets[targetIndex]}`,
          ),
        );
      }
    }
    const required =
      lane === 'generator_transfer'
        ? contract.decision.level_rules.required_improving_generators
        : contract.decision.level_rules.required_improving_realizers;
    if (improving.length < required) {
      reasons.push(reason('transfer_point_improvement_failed', { candidate, lane, improving, required }));
    }
  }

  return { passed: reasons.length === 0, reasons, improvingWorlds };
}

function richnessGate(candidate, baseline, indexes, contract) {
  const reasons = [];
  const superiorTargets = [];
  for (const target of contract.targets) {
    const comparison = comparisonFrom(indexes.comparisons, 'world_transfer', 'pooled', target, candidate, baseline);
    const superiority = superiorityFailures(comparison, contract, {
      practical: true,
      context: `richness:${candidate}:${target}:over_${baseline}`,
    });
    if (!superiority.length) superiorTargets.push(target);
    const noninferiority = noninferiorityFailures(
      comparison,
      contract,
      `richness:${candidate}:${target}:over_${baseline}`,
    );
    if (noninferiority.length) reasons.push(...noninferiority);
  }
  if (superiorTargets.length < contract.decision.richness.minimum_superior_targets) {
    reasons.push(
      reason('richness_superior_target_count_failed', {
        candidate,
        baseline,
        superiorTargets,
        required: contract.decision.richness.minimum_superior_targets,
      }),
    );
  }
  return { passed: reasons.length === 0, reasons, superiorTargets };
}

/**
 * Apply the frozen v2 gate to a precomputed report. Structural omissions,
 * contract drift, and hash tampering throw. Scientifically valid negative
 * results return one of the five closed verdicts with deterministic reasons.
 */
export function evaluateAdaptiveStateValidityV2(report, config) {
  const contract = adaptiveStateValidityV2Contract(config);
  const contractSha256 = sha256(canonicalJson(contract));
  const indexes = validateReport(report, contract);
  const instrument = instrumentGate(indexes, contract);
  if (!instrument.passed) {
    return {
      schema: ADAPTIVE_STATE_VALIDITY_DECISION_V2_SCHEMA,
      verdict: 'invalid_instrument',
      selected_representation: null,
      reasons: instrument.reasons,
      contract_sha256: contractSha256,
      report_content_sha256: report.content_sha256,
      gates: { instrument },
    };
  }

  const lean = candidateAdequacy('lean_dag', indexes, contract);
  const dag = candidateAdequacy('dag_trajectory', indexes, contract);
  const field = candidateAdequacy('field_trajectory', indexes, contract);
  const dagRichness = richnessGate('dag_trajectory', 'lean_dag', indexes, contract);
  const fieldRichness = richnessGate('field_trajectory', 'dag_trajectory', indexes, contract);

  let verdict = 'no_sensor';
  let selectedRepresentation = null;
  let reasons = [reason('no_candidate_cleared_hierarchy')];
  if (lean.passed) {
    verdict = 'lean_dag_only';
    selectedRepresentation = 'lean_dag';
    reasons = [reason('lean_dag_is_simplest_adequate_rung')];
  }
  if (dag.passed && dagRichness.passed) {
    verdict = 'dag_trajectory';
    selectedRepresentation = 'dag_trajectory';
    reasons = [reason('dag_trajectory_adds_preregistered_incremental_value')];
  }
  if (verdict === 'dag_trajectory' && field.passed && fieldRichness.passed) {
    verdict = 'field_trajectory';
    selectedRepresentation = 'field_trajectory';
    reasons = [reason('field_trajectory_adds_preregistered_incremental_value')];
  }
  if (verdict === 'no_sensor') {
    reasons.push(...lean.reasons, ...dag.reasons, ...dagRichness.reasons);
  } else if (verdict === 'lean_dag_only') {
    reasons.push(...dag.reasons, ...dagRichness.reasons);
  } else if (verdict === 'dag_trajectory') {
    reasons.push(...field.reasons, ...fieldRichness.reasons);
  }

  return {
    schema: ADAPTIVE_STATE_VALIDITY_DECISION_V2_SCHEMA,
    verdict,
    selected_representation: selectedRepresentation,
    reasons,
    contract_sha256: contractSha256,
    report_content_sha256: report.content_sha256,
    gates: {
      instrument,
      adequacy: { lean_dag: lean, dag_trajectory: dag, field_trajectory: field },
      richness: { dag_trajectory_over_lean_dag: dagRichness, field_trajectory_over_dag_trajectory: fieldRichness },
    },
  };
}
