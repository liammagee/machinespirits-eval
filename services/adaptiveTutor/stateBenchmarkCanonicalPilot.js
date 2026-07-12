import { createHash } from 'node:crypto';

import { hashCanonicalJson } from '../experimentRunArtifacts.js';
import {
  adaptiveStateStage0PredictionMetrics,
  auditAdaptiveStateStage0Dataset,
  buildAdaptiveStateOutOfFoldStateBlindBaselines,
  fitAdaptiveStateStage0Head,
  predictAdaptiveStateStage0Head,
  validateAdaptiveStateStage0SplitManifestContentSha256,
} from './stateBenchmarkStage0Analysis.js';
import { validateAdaptiveStateStage0DatasetContentSha256 } from './stateBenchmarkStage0Executor.js';

export const ADAPTIVE_STATE_CANONICAL_PILOT_PREDICTIONS_SCHEMA =
  'machinespirits.adaptive-state-canonical-pilot-predictions.v2.3';
export const ADAPTIVE_STATE_CANONICAL_PILOT_REPORT_SCHEMA =
  'machinespirits.adaptive-state-canonical-pilot-report.v2.3';

const TARGET_LABELS = Object.freeze({
  next_dag_event_family: Object.freeze(['retract', 'derive', 'adopt', 'none']),
  next_proof_trajectory: Object.freeze(['advance', 'regress', 'stall']),
});
const TARGETS = Object.freeze(Object.keys(TARGET_LABELS));
const LANES = Object.freeze(['world_transfer', 'generator_transfer', 'realizer_transfer']);
const LANE_AXIS = Object.freeze({
  world_transfer: 'world_id',
  generator_transfer: 'generator_id',
  realizer_transfer: 'realizer_id',
});
const CANDIDATES = Object.freeze(['lean_dag', 'dag_trajectory', 'field_trajectory']);
const FITTED_REPRESENTATIONS = Object.freeze([
  'no_state',
  ...CANDIDATES,
  'dag_stale',
  'field_stale',
]);
const BASELINES = Object.freeze(['no_state', 'class_prior', 'uniform']);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function stable(values) {
  return [...values].sort((left, right) => String(left).localeCompare(String(right)));
}

function mean(values) {
  return values.reduce((sum, value) => sum + Number(value), 0) / values.length;
}

function percentile(sorted, probability) {
  if (!sorted.length) throw new Error('stateBenchmarkCanonicalPilot: percentile needs values');
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function deterministicSeed(baseSeed, material) {
  const digest = createHash('sha256').update(`${baseSeed}:${material}`).digest('hex');
  return Number.parseInt(digest.slice(0, 8), 16) >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizedProbabilities(probabilities, labels) {
  const values = Object.fromEntries(labels.map((label) => [label, Math.max(0, Number(probabilities?.[label] || 0))]));
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) throw new Error('stateBenchmarkCanonicalPilot: prediction has no probability mass');
  return Object.fromEntries(labels.map((label) => [label, values[label] / total]));
}

function predictionLosses(prediction, labels) {
  const probabilities = normalizedProbabilities(prediction.probabilities, labels);
  return {
    log_loss: -Math.log(Math.max(1e-12, Number(probabilities[prediction.truth] || 0))),
    brier_score: labels.reduce(
      (sum, label) => sum + (Number(probabilities[label]) - (label === prediction.truth ? 1 : 0)) ** 2,
      0,
    ),
  };
}

export function validateAdaptiveStateCanonicalPilotContract(pilotConfig) {
  const contract = pilotConfig?.stage_contract?.s1_canonical_sensor_pilot?.decision_contract;
  const expected = {
    decision_scope: 'directional_screen_only',
    may_name_validated_winner: false,
    may_open_policy_optimization: false,
    may_automatically_launch_confirmation: false,
    fixed_head: 'inherit_adaptive_state_benchmark_v2_1',
    split_lanes: [...LANES],
    primary_lane: 'world_transfer',
    targets: [...TARGETS],
    candidates: [...CANDIDATES],
    state_blind_baselines: [...BASELINES],
    matched_controls: { dag_trajectory: 'dag_stale', field_trajectory: 'field_stale' },
    paired_cluster_bootstrap: {
      cluster: 'groups.latent_pair_id',
      refit_within_bootstrap: false,
      iterations: 5000,
      seed: 20260712,
      confidence_level: 0.95,
    },
    pooled_candidate_over_no_state: {
      minimum_log_loss_delta: 0.05,
      minimum_brier_score_delta: 0.02,
      minimum_probability_of_improvement: 0.8,
      both_metrics_and_targets_required: true,
    },
    pooled_candidate_over_other_state_blind_baselines: {
      minimum_point_delta: 0,
      both_metrics_and_targets_required: true,
    },
    transfer_screen: {
      minimum_point_improving_worlds: 2,
      minimum_point_improving_generators: 1,
      minimum_point_improving_realizers: 1,
      all_levels_noninferior: true,
      noninferiority_margins: { log_loss: 0.02, brier_score: 0.01 },
    },
    calibration: { oracle_max_ece: 0.1, candidate_max_ece: 0.25 },
    richer_rung_increment: {
      minimum_log_loss_delta: 0.05,
      minimum_brier_score_delta: 0.02,
      minimum_probability_of_improvement: 0.8,
      matched_stale_point_delta_strictly_greater_than: 0,
      both_metrics_and_targets_required: true,
    },
    pass: 'authorize_v2_3_canonical_s2_implementation',
    stop: 'do_not_run_canonical_s2',
  };
  if (hashCanonicalJson(contract) !== hashCanonicalJson(expected)) {
    throw new Error('stateBenchmarkCanonicalPilot: v2.3 pilot decision contract drifted');
  }
  return clone(contract);
}

function headOptions(baseConfig, representation, target) {
  const contract = baseConfig.analysis.fixed_head_contract;
  return {
    representation,
    target,
    labels: TARGET_LABELS[target],
    lambda: contract.regularization.lambda,
    regularizationScaling: contract.regularization.scaling,
    learningRate: contract.solver.learning_rate,
    maximumIterations: contract.solver.maximum_iterations,
    convergenceTolerance: contract.solver.convergence_tolerance,
    convergenceCriterion: contract.solver.convergence_criterion,
    probabilityClip: contract.probability_clip,
  };
}

function predictionRow(row, lane, target, representation, prediction) {
  return {
    lane,
    target,
    representation,
    id: row.id,
    groups: clone(row.groups),
    truth: prediction.truth,
    probabilities: clone(prediction.probabilities),
  };
}

export function buildAdaptiveStateCanonicalPilotPredictions({ dataset, splitManifest, baseConfig } = {}) {
  validateAdaptiveStateStage0DatasetContentSha256(dataset);
  validateAdaptiveStateStage0SplitManifestContentSha256(splitManifest);
  const byId = new Map(dataset.rows.map((row) => [row.id, row]));
  const predictions = [];
  const models = [];
  for (const lane of LANES) {
    const laneManifest = splitManifest.lanes.find((row) => row.id === lane);
    if (!laneManifest) throw new Error(`stateBenchmarkCanonicalPilot: missing ${lane} split`);
    for (const target of TARGETS) {
      for (const representation of FITTED_REPRESENTATIONS) {
        for (const fold of laneManifest.folds) {
          const training = fold.train_ids.map((id) => byId.get(id));
          const testing = fold.test_ids.map((id) => byId.get(id));
          if (training.some((row) => !row) || testing.some((row) => !row)) {
            throw new Error(`stateBenchmarkCanonicalPilot: ${fold.id} references an unknown row`);
          }
          const model = fitAdaptiveStateStage0Head(
            training,
            headOptions(baseConfig, representation, target),
          );
          models.push({
            lane,
            fold: fold.id,
            target,
            representation,
            converged: model.converged,
            iterations: model.iterations,
            objective: model.objective,
            features: model.encoder.featureNames.length,
          });
          const predicted = predictAdaptiveStateStage0Head(model, testing);
          predictions.push(
            ...predicted.map((row) => predictionRow(byId.get(row.id), lane, target, representation, row)),
          );
        }
      }
      const stateBlind = buildAdaptiveStateOutOfFoldStateBlindBaselines(dataset.rows, splitManifest, {
        laneId: lane,
        target,
        labels: TARGET_LABELS[target],
        contract: baseConfig.analysis.state_blind_baseline_contract,
      });
      for (const [representation, rows] of [
        ['class_prior', stateBlind.class_prior.predictions],
        ['uniform', stateBlind.uniform.predictions],
      ]) {
        predictions.push(
          ...rows.map((row) => predictionRow(byId.get(row.id), lane, target, representation, row)),
        );
      }
      predictions.push(
        ...dataset.rows.map((row) =>
          predictionRow(row, lane, target, 'oracle', {
            truth: String(row.targets[target]),
            probabilities: row.representations.oracle.additional_state.distributions[target],
          }),
        ),
      );
    }
  }
  const expected = LANES.length * TARGETS.length * (FITTED_REPRESENTATIONS.length + 3) * dataset.rows.length;
  if (predictions.length !== expected) {
    throw new Error(`stateBenchmarkCanonicalPilot: expected ${expected} predictions, got ${predictions.length}`);
  }
  const result = {
    schema: ADAPTIVE_STATE_CANONICAL_PILOT_PREDICTIONS_SCHEMA,
    version: '2.3',
    stage: 's1_canonical_sensor_pilot',
    model_calls: 0,
    rows: predictions,
    models,
  };
  result.content_sha256 = hashCanonicalJson(result);
  validateAdaptiveStateCanonicalPilotPredictions(result);
  return result;
}

export function validateAdaptiveStateCanonicalPilotPredictions(predictions) {
  const content = { ...predictions };
  delete content.content_sha256;
  if (
    predictions?.schema !== ADAPTIVE_STATE_CANONICAL_PILOT_PREDICTIONS_SCHEMA ||
    predictions.version !== '2.3' ||
    predictions.stage !== 's1_canonical_sensor_pilot' ||
    predictions.model_calls !== 0 ||
    predictions.content_sha256 !== hashCanonicalJson(content)
  ) {
    throw new Error('stateBenchmarkCanonicalPilot: predictions contract or content hash is invalid');
  }
  return true;
}

function bootstrapMetric(deltasByCluster, { iterations, seed, confidenceLevel, material }) {
  const clusters = stable(deltasByCluster.keys());
  if (clusters.length < 2) throw new Error('stateBenchmarkCanonicalPilot: paired bootstrap needs two clusters');
  const point = mean(clusters.flatMap((cluster) => deltasByCluster.get(cluster)));
  const summaries = new Map(
    clusters.map((cluster) => {
      const values = deltasByCluster.get(cluster);
      return [cluster, { sum: values.reduce((total, value) => total + value, 0), count: values.length }];
    }),
  );
  const random = mulberry32(deterministicSeed(seed, material));
  const draws = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let sampledSum = 0;
    let sampledCount = 0;
    for (let index = 0; index < clusters.length; index += 1) {
      const cluster = clusters[Math.floor(random() * clusters.length)];
      const summary = summaries.get(cluster);
      sampledSum += summary.sum;
      sampledCount += summary.count;
    }
    draws.push(sampledSum / sampledCount);
  }
  draws.sort((left, right) => left - right);
  const alpha = (1 - confidenceLevel) / 2;
  return {
    point_delta: point,
    confidence_interval: {
      lower: percentile(draws, alpha),
      upper: percentile(draws, 1 - alpha),
    },
    probability_of_improvement: draws.filter((value) => value > 0).length / draws.length,
  };
}

function predictionsIndex(predictions) {
  const index = new Map();
  for (const row of predictions.rows) {
    index.set(`${row.lane}|${row.target}|${row.representation}|${row.id}`, row);
  }
  return index;
}

function comparisonFor({ dataset, predictions, lane, level, target, candidate, baseline, contract }) {
  const axis = LANE_AXIS[lane];
  const sourceRows = dataset.rows.filter((row) => level === 'pooled' || row.groups[axis] === level);
  const index = predictionsIndex(predictions);
  const support = sourceRows.map((row) => ({ id: row.id, cluster: row.groups.latent_pair_id }));
  const metrics = {};
  for (const metric of ['log_loss', 'brier_score']) {
    const deltasByCluster = new Map();
    for (const row of sourceRows) {
      const candidatePrediction = index.get(`${lane}|${target}|${candidate}|${row.id}`);
      const baselinePrediction = index.get(`${lane}|${target}|${baseline}|${row.id}`);
      if (!candidatePrediction || !baselinePrediction) {
        throw new Error('stateBenchmarkCanonicalPilot: missing paired prediction');
      }
      const candidateLoss = predictionLosses(candidatePrediction, TARGET_LABELS[target])[metric];
      const baselineLoss = predictionLosses(baselinePrediction, TARGET_LABELS[target])[metric];
      const values = deltasByCluster.get(row.groups.latent_pair_id) || [];
      values.push(baselineLoss - candidateLoss);
      deltasByCluster.set(row.groups.latent_pair_id, values);
    }
    metrics[metric] = bootstrapMetric(deltasByCluster, {
      iterations: contract.paired_cluster_bootstrap.iterations,
      seed: contract.paired_cluster_bootstrap.seed,
      confidenceLevel: contract.paired_cluster_bootstrap.confidence_level,
      material: `${lane}|${level}|${target}|${candidate}|${baseline}|${metric}`,
    });
  }
  return {
    lane,
    level,
    target,
    candidate,
    baseline,
    groups: new Set(sourceRows.map((row) => row.groups.latent_pair_id)).size,
    predictions: sourceRows.length,
    paired_support_sha256: hashCanonicalJson(support),
    metrics,
  };
}

function buildComparisons(dataset, predictions, splitManifest, contract) {
  const comparisons = [];
  for (const lane of LANES) {
    const levels = ['pooled', ...splitManifest.lanes.find((row) => row.id === lane).folds.map((fold) => fold.level)];
    for (const level of levels) {
      for (const target of TARGETS) {
        for (const candidate of CANDIDATES) {
          for (const baseline of BASELINES) {
            comparisons.push(
              comparisonFor({ dataset, predictions, lane, level, target, candidate, baseline, contract }),
            );
          }
        }
      }
    }
  }
  for (const target of TARGETS) {
    for (const baseline of BASELINES) {
      comparisons.push(
        comparisonFor({
          dataset,
          predictions,
          lane: 'world_transfer',
          level: 'pooled',
          target,
          candidate: 'oracle',
          baseline,
          contract,
        }),
      );
    }
    for (const [candidate, baseline] of [
      ['dag_trajectory', 'lean_dag'],
      ['field_trajectory', 'dag_trajectory'],
      ['dag_trajectory', 'dag_stale'],
      ['field_trajectory', 'field_stale'],
    ]) {
      comparisons.push(
        comparisonFor({
          dataset,
          predictions,
          lane: 'world_transfer',
          level: 'pooled',
          target,
          candidate,
          baseline,
          contract,
        }),
      );
    }
  }
  return comparisons;
}

function buildCalibration(predictions) {
  const rows = [];
  for (const target of TARGETS) {
    for (const representation of ['oracle', ...CANDIDATES]) {
      const subset = predictions.rows.filter(
        (row) =>
          row.lane === 'world_transfer' && row.target === target && row.representation === representation,
      );
      const metrics = adaptiveStateStage0PredictionMetrics(subset, TARGET_LABELS[target]);
      rows.push({ target, representation, predictions: metrics.predictions, ece: metrics.ece });
    }
  }
  return rows;
}

function findComparison(comparisons, { lane = 'world_transfer', level = 'pooled', target, candidate, baseline }) {
  const row = comparisons.find(
    (item) =>
      item.lane === lane &&
      item.level === level &&
      item.target === target &&
      item.candidate === candidate &&
      item.baseline === baseline,
  );
  if (!row) throw new Error(`stateBenchmarkCanonicalPilot: missing comparison ${lane}|${level}|${target}|${candidate}|${baseline}`);
  return row;
}

function metricRows(comparison) {
  return Object.entries(comparison.metrics).map(([metric, value]) => ({ metric, ...value }));
}

function candidateAdequacy(candidate, comparisons, calibration, contract) {
  const reasons = [];
  for (const target of TARGETS) {
    const noState = findComparison(comparisons, { target, candidate, baseline: 'no_state' });
    for (const metric of metricRows(noState)) {
      const minimum =
        metric.metric === 'log_loss'
          ? contract.pooled_candidate_over_no_state.minimum_log_loss_delta
          : contract.pooled_candidate_over_no_state.minimum_brier_score_delta;
      if (metric.point_delta < minimum) reasons.push(`pooled_${target}_${metric.metric}_below_minimum`);
      if (
        metric.probability_of_improvement <
        contract.pooled_candidate_over_no_state.minimum_probability_of_improvement
      ) {
        reasons.push(`pooled_${target}_${metric.metric}_probability_below_minimum`);
      }
    }
    for (const baseline of ['class_prior', 'uniform']) {
      const comparison = findComparison(comparisons, { target, candidate, baseline });
      for (const metric of metricRows(comparison)) {
        if (!(metric.point_delta > contract.pooled_candidate_over_other_state_blind_baselines.minimum_point_delta)) {
          reasons.push(`pooled_${target}_${metric.metric}_not_better_than_${baseline}`);
        }
      }
    }
  }
  const improving = {};
  for (const lane of LANES) {
    const levels = stable(
      new Set(comparisons.filter((row) => row.lane === lane && row.level !== 'pooled').map((row) => row.level)),
    );
    improving[lane] = levels.filter((level) =>
      TARGETS.every((target) =>
        metricRows(findComparison(comparisons, { lane, level, target, candidate, baseline: 'no_state' })).every(
          (metric) => metric.point_delta > 0,
        ),
      ),
    );
    if (lane !== 'world_transfer' && contract.transfer_screen.all_levels_noninferior) {
      for (const level of levels) {
        for (const target of TARGETS) {
          const comparison = findComparison(comparisons, { lane, level, target, candidate, baseline: 'no_state' });
          for (const metric of metricRows(comparison)) {
            const margin = contract.transfer_screen.noninferiority_margins[metric.metric];
            if (metric.point_delta < -margin) reasons.push(`${lane}_${level}_${target}_${metric.metric}_inferior`);
          }
        }
      }
    }
  }
  if (improving.world_transfer.length < contract.transfer_screen.minimum_point_improving_worlds) {
    reasons.push('insufficient_improving_worlds');
  }
  if (improving.generator_transfer.length < contract.transfer_screen.minimum_point_improving_generators) {
    reasons.push('insufficient_improving_generators');
  }
  if (improving.realizer_transfer.length < contract.transfer_screen.minimum_point_improving_realizers) {
    reasons.push('insufficient_improving_realizers');
  }
  for (const target of TARGETS) {
    const row = calibration.find((item) => item.target === target && item.representation === candidate);
    if (!row || row.ece > contract.calibration.candidate_max_ece) reasons.push(`${target}_calibration_failed`);
  }
  return { passed: reasons.length === 0, reasons, improving_levels: improving };
}

function richerIncrement(candidate, baseline, stale, comparisons, contract) {
  const reasons = [];
  for (const target of TARGETS) {
    const incremental = findComparison(comparisons, { target, candidate, baseline });
    for (const metric of metricRows(incremental)) {
      const minimum =
        metric.metric === 'log_loss'
          ? contract.richer_rung_increment.minimum_log_loss_delta
          : contract.richer_rung_increment.minimum_brier_score_delta;
      if (metric.point_delta < minimum) reasons.push(`${target}_${metric.metric}_increment_below_minimum`);
      if (metric.probability_of_improvement < contract.richer_rung_increment.minimum_probability_of_improvement) {
        reasons.push(`${target}_${metric.metric}_increment_probability_below_minimum`);
      }
    }
    const control = findComparison(comparisons, { target, candidate, baseline: stale });
    for (const metric of metricRows(control)) {
      if (!(metric.point_delta > contract.richer_rung_increment.matched_stale_point_delta_strictly_greater_than)) {
        reasons.push(`${target}_${metric.metric}_matched_stale_failed`);
      }
    }
  }
  return { passed: reasons.length === 0, reasons };
}

export function evaluateAdaptiveStateCanonicalPilotScreen({
  auditPassed,
  modelsConverged,
  comparisons,
  calibration,
  pilotConfig,
} = {}) {
  const contract = validateAdaptiveStateCanonicalPilotContract(pilotConfig);
  const instrumentReasons = [];
  if (!auditPassed) instrumentReasons.push('stage0_structural_audit_failed');
  if (!modelsConverged) instrumentReasons.push('fixed_head_nonconvergence');
  for (const target of TARGETS) {
    for (const baseline of BASELINES) {
      const comparison = findComparison(comparisons, { target, candidate: 'oracle', baseline });
      if (metricRows(comparison).some((metric) => !(metric.point_delta > 0))) {
        instrumentReasons.push(`${target}_oracle_not_better_than_${baseline}`);
      }
    }
    const row = calibration.find((item) => item.target === target && item.representation === 'oracle');
    if (!row || row.ece > contract.calibration.oracle_max_ece) instrumentReasons.push(`${target}_oracle_calibration_failed`);
  }
  const instrument = { passed: instrumentReasons.length === 0, reasons: instrumentReasons };
  const lean = instrument.passed
    ? candidateAdequacy('lean_dag', comparisons, calibration, contract)
    : { passed: false, reasons: ['instrument_failed'] };
  const dagAdequacy = lean.passed
    ? candidateAdequacy('dag_trajectory', comparisons, calibration, contract)
    : { passed: false, reasons: ['lean_dag_failed'] };
  const dagIncrement = lean.passed
    ? richerIncrement('dag_trajectory', 'lean_dag', 'dag_stale', comparisons, contract)
    : { passed: false, reasons: ['lean_dag_failed'] };
  const dagPassed = dagAdequacy.passed && dagIncrement.passed;
  const fieldAdequacy = dagPassed
    ? candidateAdequacy('field_trajectory', comparisons, calibration, contract)
    : { passed: false, reasons: ['dag_trajectory_failed'] };
  const fieldIncrement = dagPassed
    ? richerIncrement('field_trajectory', 'dag_trajectory', 'field_stale', comparisons, contract)
    : { passed: false, reasons: ['dag_trajectory_failed'] };
  const fieldPassed = fieldAdequacy.passed && fieldIncrement.passed;
  const confirmationCandidate = fieldPassed
    ? 'field_trajectory'
    : dagPassed
      ? 'dag_trajectory'
      : lean.passed
        ? 'lean_dag'
        : null;
  return {
    status: instrument.passed && confirmationCandidate ? 'pass' : 'stop',
    decision:
      instrument.passed && confirmationCandidate
        ? contract.pass
        : contract.stop,
    confirmation_candidate: confirmationCandidate,
    validated_winner: null,
    policy_optimization_authorized: false,
    gates: {
      instrument,
      adequacy: { lean_dag: lean, dag_trajectory: dagAdequacy, field_trajectory: fieldAdequacy },
      increment: { dag_trajectory: dagIncrement, field_trajectory: fieldIncrement },
    },
  };
}

function reportContent(report) {
  const content = { ...report };
  delete content.content_sha256;
  return content;
}

export function validateAdaptiveStateCanonicalPilotReport(report) {
  if (
    report?.schema !== ADAPTIVE_STATE_CANONICAL_PILOT_REPORT_SCHEMA ||
    report.version !== '2.3' ||
    report.stage !== 's1_canonical_sensor_pilot' ||
    report.model_calls !== 0 ||
    report.confirmation_eligible !== false ||
    report.validated_winner !== null ||
    report.policy_optimization_authorized !== false ||
    report.content_sha256 !== hashCanonicalJson(reportContent(report))
  ) {
    throw new Error('stateBenchmarkCanonicalPilot: report contract or content hash is invalid');
  }
  return true;
}

export function buildAdaptiveStateCanonicalPilotReport({
  dataset,
  splitManifest,
  predictions,
  plan,
  baseConfig,
  pilotConfig,
  parent,
  provenance,
} = {}) {
  const contract = validateAdaptiveStateCanonicalPilotContract(pilotConfig);
  const audit = auditAdaptiveStateStage0Dataset(dataset, plan, baseConfig);
  const comparisons = buildComparisons(dataset, predictions, splitManifest, contract);
  const calibration = buildCalibration(predictions);
  const modelsConverged = predictions.models.every((model) => model.converged);
  const screen = evaluateAdaptiveStateCanonicalPilotScreen({
    auditPassed: audit.passed,
    modelsConverged,
    comparisons,
    calibration,
    pilotConfig,
  });
  const report = {
    schema: ADAPTIVE_STATE_CANONICAL_PILOT_REPORT_SCHEMA,
    version: '2.3',
    stage: 's1_canonical_sensor_pilot',
    status: screen.status,
    decision: screen.decision,
    confirmation_eligible: false,
    confirmation_candidate: screen.confirmation_candidate,
    validated_winner: null,
    policy_optimization_authorized: false,
    model_calls: 0,
    claim_boundary:
      'Directional synthetic pilot on the exact current-public-event channel. It may authorize only implementation of a bounded confirmation; it does not validate a representation, language transfer, policy value, efficacy, or human learning.',
    parent: clone(parent),
    provenance: clone(provenance),
    protocol: clone(contract),
    coverage: {
      worlds: stable(new Set(dataset.rows.map((row) => row.groups.world_id))),
      latent_generators: stable(new Set(dataset.rows.map((row) => row.groups.generator_id))),
      exact_renderers: stable(new Set(dataset.rows.map((row) => row.groups.realizer_id))),
      dialogues: dataset.dialogues.length,
      independent_latent_clusters: new Set(dataset.rows.map((row) => row.groups.latent_pair_id)).size,
      scored_transitions: dataset.rows.length,
      targets: [...TARGETS],
      candidates: [...CANDIDATES],
    },
    structural_audit: audit,
    fixed_head: {
      models: predictions.models.length,
      converged: predictions.models.filter((model) => model.converged).length,
      all_converged: modelsConverged,
    },
    comparisons,
    calibration,
    gates: screen.gates,
  };
  report.content_sha256 = hashCanonicalJson(reportContent(report));
  validateAdaptiveStateCanonicalPilotReport(report);
  return report;
}

export function renderAdaptiveStateCanonicalPilotReport(report) {
  const fmt = (value) => Number(value).toFixed(4);
  const lines = [
    '# Adaptive-state v2.3 canonical sensor pilot',
    '',
    `Status: **${report.status}**`,
    `Decision: \`${report.decision}\``,
    `Confirmation candidate: ${report.confirmation_candidate ? `\`${report.confirmation_candidate}\`` : '**none**'}`,
    'Validated winner: **none**',
    'Policy optimization: **blocked**',
    '',
    '## Boundary',
    '',
    `> ${report.claim_boundary}`,
    '',
    '## Coverage',
    '',
    `- ${report.coverage.dialogues} dialogues; ${report.coverage.scored_transitions} scored transitions`,
    `- ${report.coverage.independent_latent_clusters} independent latent clusters`,
    `- ${report.fixed_head.converged}/${report.fixed_head.models} fixed heads converged`,
    '- zero model calls',
    '',
    '## Gate summary',
    '',
    `- instrument: ${report.gates.instrument.passed ? 'pass' : 'fail'}`,
    `- lean DAG: ${report.gates.adequacy.lean_dag.passed ? 'screen pass' : 'screen fail'}`,
    `- DAG trajectory: ${report.gates.adequacy.dag_trajectory.passed && report.gates.increment.dag_trajectory.passed ? 'incremental screen pass' : 'incremental screen fail'}`,
    `- field trajectory: ${report.gates.adequacy.field_trajectory.passed && report.gates.increment.field_trajectory.passed ? 'incremental screen pass' : 'incremental screen fail'}`,
    '',
    '## Pooled candidate versus no-state deltas',
    '',
    '| Candidate | Target | Log-loss delta | P(improve) | Brier delta | P(improve) |',
    '|---|---|---:|---:|---:|---:|',
  ];
  for (const candidate of CANDIDATES) {
    for (const target of TARGETS) {
      const row = findComparison(report.comparisons, { target, candidate, baseline: 'no_state' });
      lines.push(
        `| ${candidate} | ${target} | ${fmt(row.metrics.log_loss.point_delta)} | ${fmt(row.metrics.log_loss.probability_of_improvement)} | ${fmt(row.metrics.brier_score.point_delta)} | ${fmt(row.metrics.brier_score.probability_of_improvement)} |`,
      );
    }
  }
  lines.push('', `Report SHA-256: \`${report.content_sha256}\``, '');
  return lines.join('\n');
}
