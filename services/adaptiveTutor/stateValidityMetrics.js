import { createHash } from 'node:crypto';
import { validateCommonLeanBaselineRepresentations } from './tutorStubStateAdapter.js';

export const ADAPTIVE_STATE_VALIDITY_REPORT_SCHEMA = 'machinespirits.adaptive-state-validity-report.v1';
export const ADAPTIVE_STATE_SPLIT_MANIFEST_SCHEMA = 'machinespirits.adaptive-state-split-manifest.v1';

export const LATENT_GENERATOR_REGISTRY = Object.freeze({
  a21_durable_state_transition_kernel: Object.freeze({
    independent: true,
    transitionKernel: 'services/dramaticDerivation/a21/learnerSimulator.js',
  }),
  dag_fact_dropout_memory_instrument: Object.freeze({
    independent: true,
    transitionKernel: 'services/tutorStubDagFactDropout.js',
  }),
  prompt_persona_shared_generator: Object.freeze({
    independent: false,
    transitionKernel: null,
  }),
});

const DEFAULT_HOLDOUT_AXES = Object.freeze([
  'world',
  'scenario_family',
  'latent_generator_family',
  'learner_source',
  'model_family',
]);
const PLACEBO_REPRESENTATIONS = new Set(['state_scramble', 'shuffled_evidence_ids', 'stale_state']);
const REPRESENTATION_KINDS = Object.freeze({
  lean: 'baseline',
  plan2_belief: 'candidate',
  plan4_fields: 'candidate_projection',
  field_without_dynamics: 'ablation',
  belief_without_affect: 'ablation',
  belief_without_task_difficulty: 'ablation',
  state_scramble: 'placebo',
  shuffled_evidence_ids: 'placebo',
  stale_state: 'placebo',
  oracle: 'upper_bound',
});
const DEFAULT_BOOTSTRAP_ITERATIONS = 2000;
const DEFAULT_BOOTSTRAP_SEED = 20260711;
const DEFAULT_BOOTSTRAP_CONFIDENCE_LEVEL = 0.95;
const DEFAULT_BOOTSTRAP_GROUP_KEY = 'dialogue_id';
const DEFAULT_IMPROVEMENT_PROBABILITY = 0.95;
export const DEFAULT_STATE_VALIDITY_GATE_POLICY = Object.freeze({
  minimumBootstrapIterations: DEFAULT_BOOTSTRAP_ITERATIONS,
  minimumConfidenceLevel: DEFAULT_BOOTSTRAP_CONFIDENCE_LEVEL,
  minimumImprovementProbability: DEFAULT_IMPROVEMENT_PROBABILITY,
  requiredBootstrapGroupKey: DEFAULT_BOOTSTRAP_GROUP_KEY,
  maximumExpectedCalibrationError: 0.2,
  minimumCalibrationPredictions: 20,
  calibrationEvaluation: 'held_out_out_of_fold_fixed_head',
});

function canonicalComparable(value) {
  const sort = (current) => {
    if (Array.isArray(current)) return current.map(sort);
    if (!current || typeof current !== 'object') return current;
    return Object.fromEntries(
      Object.keys(current)
        .sort()
        .map((key) => [key, sort(current[key])]),
    );
  };
  return JSON.stringify(sort(value));
}

function assertUniqueStrings(values, label) {
  if (!Array.isArray(values) || !values.length) {
    throw new Error(`stateValidityMetrics: ${label} must be a non-empty array`);
  }
  if (values.some((value) => value == null)) {
    throw new Error(`stateValidityMetrics: ${label} cannot contain missing values`);
  }
  const normalized = values.map((value) => String(value));
  if (normalized.some((value) => !value)) {
    throw new Error(`stateValidityMetrics: ${label} cannot contain empty values`);
  }
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`stateValidityMetrics: ${label} contains duplicates`);
  }
  return normalized;
}

export function normalizeStateValidityGatePolicy(policy = {}) {
  const requested = {
    minimumBootstrapIterations: Number(
      policy.minimumBootstrapIterations ?? DEFAULT_STATE_VALIDITY_GATE_POLICY.minimumBootstrapIterations,
    ),
    minimumConfidenceLevel: Number(
      policy.minimumConfidenceLevel ?? DEFAULT_STATE_VALIDITY_GATE_POLICY.minimumConfidenceLevel,
    ),
    minimumImprovementProbability: Number(
      policy.minimumImprovementProbability ?? DEFAULT_STATE_VALIDITY_GATE_POLICY.minimumImprovementProbability,
    ),
    requiredBootstrapGroupKey: String(
      policy.requiredBootstrapGroupKey || DEFAULT_STATE_VALIDITY_GATE_POLICY.requiredBootstrapGroupKey,
    ),
    maximumExpectedCalibrationError: Number(
      policy.maximumExpectedCalibrationError ?? DEFAULT_STATE_VALIDITY_GATE_POLICY.maximumExpectedCalibrationError,
    ),
    minimumCalibrationPredictions: Number(
      policy.minimumCalibrationPredictions ?? DEFAULT_STATE_VALIDITY_GATE_POLICY.minimumCalibrationPredictions,
    ),
    calibrationEvaluation: String(
      policy.calibrationEvaluation || DEFAULT_STATE_VALIDITY_GATE_POLICY.calibrationEvaluation,
    ),
  };
  if (!Number.isInteger(requested.minimumBootstrapIterations) || requested.minimumBootstrapIterations < 1) {
    throw new Error('stateValidityMetrics: gate minimum bootstrap iterations must be a positive integer');
  }
  if (!(requested.minimumConfidenceLevel > 0 && requested.minimumConfidenceLevel < 1)) {
    throw new Error('stateValidityMetrics: gate minimum confidence level must be between zero and one');
  }
  if (!(requested.minimumImprovementProbability > 0 && requested.minimumImprovementProbability <= 1)) {
    throw new Error('stateValidityMetrics: gate minimum improvement probability must be in (0, 1]');
  }
  if (!requested.requiredBootstrapGroupKey) {
    throw new Error('stateValidityMetrics: gate requires a bootstrap group key');
  }
  if (requested.requiredBootstrapGroupKey !== DEFAULT_STATE_VALIDITY_GATE_POLICY.requiredBootstrapGroupKey) {
    throw new Error(
      `stateValidityMetrics: claim-grade bootstrap group must be ${DEFAULT_STATE_VALIDITY_GATE_POLICY.requiredBootstrapGroupKey}`,
    );
  }
  if (!(requested.maximumExpectedCalibrationError >= 0 && requested.maximumExpectedCalibrationError <= 1)) {
    throw new Error('stateValidityMetrics: maximum expected calibration error must be in [0, 1]');
  }
  if (!Number.isInteger(requested.minimumCalibrationPredictions) || requested.minimumCalibrationPredictions < 1) {
    throw new Error('stateValidityMetrics: minimum calibration predictions must be a positive integer');
  }
  if (requested.calibrationEvaluation !== 'held_out_out_of_fold_fixed_head') {
    throw new Error(
      'stateValidityMetrics: claim-grade calibration must use held_out_out_of_fold_fixed_head evaluation',
    );
  }
  return {
    minimumBootstrapIterations: Math.max(
      DEFAULT_STATE_VALIDITY_GATE_POLICY.minimumBootstrapIterations,
      requested.minimumBootstrapIterations,
    ),
    minimumConfidenceLevel: Math.max(
      DEFAULT_STATE_VALIDITY_GATE_POLICY.minimumConfidenceLevel,
      requested.minimumConfidenceLevel,
    ),
    minimumImprovementProbability: Math.max(
      DEFAULT_STATE_VALIDITY_GATE_POLICY.minimumImprovementProbability,
      requested.minimumImprovementProbability,
    ),
    requiredBootstrapGroupKey: requested.requiredBootstrapGroupKey,
    maximumExpectedCalibrationError: Math.min(
      DEFAULT_STATE_VALIDITY_GATE_POLICY.maximumExpectedCalibrationError,
      requested.maximumExpectedCalibrationError,
    ),
    minimumCalibrationPredictions: Math.max(
      DEFAULT_STATE_VALIDITY_GATE_POLICY.minimumCalibrationPredictions,
      requested.minimumCalibrationPredictions,
    ),
    calibrationEvaluation: requested.calibrationEvaluation,
  };
}

export function stateValidityGatePolicyFromConfig(config = {}) {
  const uncertainty = config.metrics?.uncertainty || {};
  const claimGrade = uncertainty.claim_grade_minimums || {};
  const calibration = config.metrics?.calibration || {};
  return normalizeStateValidityGatePolicy({
    minimumBootstrapIterations: claimGrade.iterations ?? uncertainty.iterations,
    minimumConfidenceLevel: claimGrade.confidence_level ?? uncertainty.confidence_level,
    minimumImprovementProbability:
      claimGrade.minimum_probability_of_improvement ?? uncertainty.minimum_probability_of_improvement,
    requiredBootstrapGroupKey: claimGrade.group_key ?? config.splits?.atomic_unit,
    maximumExpectedCalibrationError: calibration.max_expected_calibration_error,
    minimumCalibrationPredictions: calibration.minimum_predictions,
    calibrationEvaluation: calibration.evaluation,
  });
}

export function validateLatentGeneratorFamilyClaim(row) {
  const family = String(row?.groups?.latent_generator_family || '');
  if (!family) {
    throw new Error(`stateValidityMetrics: row ${row?.id || '<unknown>'} is missing latent generator family`);
  }
  const registration = LATENT_GENERATOR_REGISTRY[family];
  if (!registration) {
    throw new Error(
      `stateValidityMetrics: row ${row?.id || '<unknown>'} claims unregistered latent generator ${family}`,
    );
  }
  if (
    registration.independent &&
    String(row?.feature_provenance?.transition_kernel || '') !== registration.transitionKernel
  ) {
    throw new Error(
      `stateValidityMetrics: row ${row?.id || '<unknown>'} has invalid transition kernel provenance for ${family}`,
    );
  }
  return registration;
}

function mean(values) {
  const numeric = values.map(Number).filter(Number.isFinite);
  return numeric.length ? numeric.reduce((sum, value) => sum + value, 0) / numeric.length : null;
}

function normalizeBootstrapOptions(options = {}) {
  const iterations = Number(options.iterations ?? DEFAULT_BOOTSTRAP_ITERATIONS);
  const seed = Number(options.seed ?? DEFAULT_BOOTSTRAP_SEED);
  const confidenceLevel = Number(options.confidenceLevel ?? DEFAULT_BOOTSTRAP_CONFIDENCE_LEVEL);
  const groupKey = String(options.groupKey || DEFAULT_BOOTSTRAP_GROUP_KEY);
  const minimumImprovementProbability = Number(
    options.minimumImprovementProbability ?? DEFAULT_IMPROVEMENT_PROBABILITY,
  );
  if (!Number.isInteger(iterations) || iterations < 1) {
    throw new Error('stateValidityMetrics: bootstrap iterations must be a positive integer');
  }
  if (!Number.isInteger(seed) || seed < 0) {
    throw new Error('stateValidityMetrics: bootstrap seed must be a non-negative integer');
  }
  if (!(confidenceLevel > 0 && confidenceLevel < 1)) {
    throw new Error('stateValidityMetrics: bootstrap confidence level must be between zero and one');
  }
  if (!(minimumImprovementProbability > 0 && minimumImprovementProbability <= 1)) {
    throw new Error('stateValidityMetrics: minimum improvement probability must be in (0, 1]');
  }
  return {
    iterations,
    seed,
    confidenceLevel,
    groupKey,
    minimumImprovementProbability,
  };
}

function comparisonSeed(seed, namespace = '') {
  const digest = createHash('sha256').update(`${seed}:${namespace}`).digest();
  return digest.readUInt32LE(0);
}

function seededRandom(seed) {
  let state = Number(seed) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function percentile(sortedValues, quantile) {
  if (!sortedValues.length) return null;
  const position = (sortedValues.length - 1) * quantile;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  if (lowerIndex === upperIndex) return sortedValues[lowerIndex];
  const fraction = position - lowerIndex;
  return sortedValues[lowerIndex] + (sortedValues[upperIndex] - sortedValues[lowerIndex]) * fraction;
}

function metricDelta(row, metric) {
  if (metric === 'top1Accuracy') return Number(row.candidate[metric]) - Number(row.lean[metric]);
  return Number(row.lean[metric]) - Number(row.candidate[metric]);
}

function metricBootstrapSummary(rows, samples, metric, confidenceLevel) {
  const pointDelta = mean(rows.map((row) => metricDelta(row, metric)));
  const sorted = samples.map((sample) => sample[metric]).sort((left, right) => left - right);
  const tail = (1 - confidenceLevel) / 2;
  return {
    pointDelta,
    confidenceInterval: {
      method: 'percentile',
      level: confidenceLevel,
      lower: percentile(sorted, tail),
      upper: percentile(sorted, 1 - tail),
    },
    probabilityOfImprovement: sorted.filter((value) => value > 0).length / sorted.length,
  };
}

/**
 * Paired cluster bootstrap for already-scored prediction rows. Each sampled
 * unit contributes every one of its turns/fold predictions together, so no
 * dialogue is broken into spuriously independent observations.
 */
export function pairedGroupBootstrapStateValidity(pairedRows, options = {}) {
  if (!Array.isArray(pairedRows) || !pairedRows.length) {
    throw new Error('stateValidityMetrics: paired bootstrap needs at least one prediction pair');
  }
  const normalized = normalizeBootstrapOptions(options);
  const byGroup = new Map();
  for (const [index, row] of pairedRows.entries()) {
    const groupId = row?.groupId == null ? '' : String(row.groupId);
    if (!groupId) throw new Error(`stateValidityMetrics: paired bootstrap row ${index} is missing groupId`);
    for (const side of ['lean', 'candidate']) {
      for (const metric of ['logLoss', 'brierScore', 'top1Accuracy']) {
        if (!Number.isFinite(Number(row?.[side]?.[metric]))) {
          throw new Error(`stateValidityMetrics: paired bootstrap row ${index} has invalid ${side}.${metric}`);
        }
      }
    }
    if (!byGroup.has(groupId)) byGroup.set(groupId, []);
    byGroup.get(groupId).push(row);
  }
  const groups = [...byGroup.keys()].sort();
  const groupStats = new Map(
    groups.map((groupId) => {
      const groupRows = byGroup.get(groupId);
      return [
        groupId,
        {
          count: groupRows.length,
          logLoss: groupRows.reduce((sum, row) => sum + metricDelta(row, 'logLoss'), 0),
          brierScore: groupRows.reduce((sum, row) => sum + metricDelta(row, 'brierScore'), 0),
          top1Accuracy: groupRows.reduce((sum, row) => sum + metricDelta(row, 'top1Accuracy'), 0),
        },
      ];
    }),
  );
  const random = seededRandom(comparisonSeed(normalized.seed, options.namespace));
  const samples = [];
  for (let iteration = 0; iteration < normalized.iterations; iteration += 1) {
    const totals = { count: 0, logLoss: 0, brierScore: 0, top1Accuracy: 0 };
    for (let draw = 0; draw < groups.length; draw += 1) {
      const groupId = groups[Math.floor(random() * groups.length)];
      const selected = groupStats.get(groupId);
      totals.count += selected.count;
      totals.logLoss += selected.logLoss;
      totals.brierScore += selected.brierScore;
      totals.top1Accuracy += selected.top1Accuracy;
    }
    samples.push({
      logLoss: totals.logLoss / totals.count,
      brierScore: totals.brierScore / totals.count,
      top1Accuracy: totals.top1Accuracy / totals.count,
    });
  }
  return {
    method: 'paired_group_bootstrap',
    samplingUnit: 'whole_group',
    groupKey: normalized.groupKey,
    groupCount: groups.length,
    pairedPredictionCount: pairedRows.length,
    iterations: normalized.iterations,
    seed: normalized.seed,
    comparisonSeed: comparisonSeed(normalized.seed, options.namespace),
    confidenceLevel: normalized.confidenceLevel,
    metrics: {
      logLoss: metricBootstrapSummary(pairedRows, samples, 'logLoss', normalized.confidenceLevel),
      brierScore: metricBootstrapSummary(pairedRows, samples, 'brierScore', normalized.confidenceLevel),
      top1Accuracy: metricBootstrapSummary(pairedRows, samples, 'top1Accuracy', normalized.confidenceLevel),
    },
  };
}

export function passesStateValidityUncertaintyGate(
  comparison,
  minimumImprovementProbability = DEFAULT_IMPROVEMENT_PROBABILITY,
) {
  if (Number(comparison?.groupCount) < 2) return false;
  const required = [comparison?.metrics?.logLoss, comparison?.metrics?.brierScore];
  return required.every(
    (metric) =>
      Number(metric?.confidenceInterval?.lower) > 0 &&
      Number(metric?.probabilityOfImprovement) >= Number(minimumImprovementProbability),
  );
}

function flatten(value, prefix = '', out = {}) {
  if (value === null || value === undefined) {
    if (prefix) out[prefix] = null;
    return out;
  }
  if (Array.isArray(value)) {
    if (prefix) out[prefix] = value.map(String).sort().join('|');
    return out;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (!entries.length && prefix) out[prefix] = null;
    for (const [key, nested] of entries) flatten(nested, prefix ? `${prefix}.${key}` : key, out);
    return out;
  }
  if (prefix) out[prefix] = value;
  return out;
}

function labelsFromRows(rows, target) {
  return [
    ...new Set(
      rows
        .map((row) => row.targets?.[target])
        .filter((label) => label != null)
        .map(String),
    ),
  ].sort();
}

function trainingScale(rows) {
  const byKey = new Map();
  for (const row of rows) {
    for (const [key, value] of Object.entries(row.features)) {
      if (!Number.isFinite(Number(value)) || typeof value === 'boolean') continue;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(Number(value));
    }
  }
  return new Map(
    [...byKey.entries()].map(([key, values]) => {
      const center = mean(values) ?? 0;
      const variance = mean(values.map((value) => (value - center) ** 2)) ?? 0;
      return [key, { mean: center, scale: Math.sqrt(variance) || 1 }];
    }),
  );
}

function featureDistance(left, right, scale) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  if (!keys.size) return 1;
  let sum = 0;
  let weight = 0;
  for (const key of keys) {
    const a = left[key];
    const b = right[key];
    if (a == null && b == null) continue;
    weight += 1;
    if (a == null || b == null) {
      sum += 1;
      continue;
    }
    if (
      scale.has(key) &&
      typeof a !== 'boolean' &&
      typeof b !== 'boolean' &&
      Number.isFinite(Number(a)) &&
      Number.isFinite(Number(b))
    ) {
      const denominator = scale.get(key).scale;
      sum += Math.min(1, Math.abs(Number(a) - Number(b)) / (denominator * 3));
    } else {
      sum += String(a) === String(b) ? 0 : 1;
    }
  }
  return weight ? sum / weight : 1;
}

function predictKnn(trainRows, features, labels, { k = 7 } = {}) {
  const scale = trainingScale(trainRows);
  const nearest = trainRows
    .map((row) => ({ label: row.label, distance: featureDistance(features, row.features, scale) }))
    .sort((left, right) => left.distance - right.distance || left.label.localeCompare(right.label))
    .slice(0, Math.max(1, Math.min(k, trainRows.length)));
  const scores = Object.fromEntries(labels.map((label) => [label, 1e-6]));
  for (const row of nearest) scores[row.label] += 1 / (0.05 + row.distance);
  const total = Object.values(scores).reduce((sum, value) => sum + value, 0) || 1;
  return Object.fromEntries(labels.map((label) => [label, scores[label] / total]));
}

function topEntries(probabilities) {
  return Object.entries(probabilities).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

function expectedCalibrationError(predictions, bins = 10) {
  if (!predictions.length) return null;
  let total = 0;
  for (let index = 0; index < bins; index += 1) {
    const low = index / bins;
    const high = (index + 1) / bins;
    const bucket = predictions.filter(
      (prediction) =>
        prediction.confidence >= low &&
        (index === bins - 1 ? prediction.confidence <= high : prediction.confidence < high),
    );
    if (!bucket.length) continue;
    const accuracy = mean(bucket.map((prediction) => (prediction.correct ? 1 : 0)));
    const confidence = mean(bucket.map((prediction) => prediction.confidence));
    total += (bucket.length / predictions.length) * Math.abs(accuracy - confidence);
  }
  return total;
}

function calibrationBins(predictions, bins = 10) {
  return Array.from({ length: bins }, (_, index) => {
    const low = index / bins;
    const high = (index + 1) / bins;
    const bucket = predictions.filter(
      (prediction) =>
        prediction.confidence >= low &&
        (index === bins - 1 ? prediction.confidence <= high : prediction.confidence < high),
    );
    return {
      low,
      high,
      n: bucket.length,
      meanConfidence: mean(bucket.map((row) => row.confidence)),
      accuracy: mean(bucket.map((row) => (row.correct ? 1 : 0))),
    };
  });
}

function macroClassification(predictions, labels) {
  const rows = labels.map((label) => {
    const truePositive = predictions.filter((row) => row.truth === label && row.predicted === label).length;
    const falsePositive = predictions.filter((row) => row.truth !== label && row.predicted === label).length;
    const falseNegative = predictions.filter((row) => row.truth === label && row.predicted !== label).length;
    return {
      label,
      support: predictions.filter((row) => row.truth === label).length,
      precision: truePositive + falsePositive ? truePositive / (truePositive + falsePositive) : 0,
      recall: truePositive + falseNegative ? truePositive / (truePositive + falseNegative) : 0,
    };
  });
  return {
    macroPrecision: mean(rows.map((row) => row.precision)),
    macroRecall: mean(rows.map((row) => row.recall)),
    byLabel: rows,
  };
}

function abstentionCurve(predictions) {
  return [0, 0.5, 0.6, 0.7, 0.8, 0.9].map((threshold) => {
    const retained = predictions.filter((row) => row.confidence >= threshold);
    return {
      threshold,
      coverage: predictions.length ? retained.length / predictions.length : 0,
      accuracy: retained.length ? mean(retained.map((row) => (row.correct ? 1 : 0))) : null,
      n: retained.length,
    };
  });
}

function predictionMetrics(predictions, labels) {
  if (!predictions.length) return null;
  const logLoss = mean(predictions.map((row) => -Math.log(Math.max(1e-12, Number(row.probabilities[row.truth] || 0)))));
  const brier = mean(
    predictions.map((row) =>
      labels.reduce(
        (sum, label) => sum + (Number(row.probabilities[label] || 0) - (row.truth === label ? 1 : 0)) ** 2,
        0,
      ),
    ),
  );
  const classification = macroClassification(predictions, labels);
  return {
    n: predictions.length,
    labels,
    logLoss,
    brierScore: brier,
    top1Accuracy: mean(predictions.map((row) => (row.correct ? 1 : 0))),
    topKAccuracy: mean(predictions.map((row) => (row.topK.includes(row.truth) ? 1 : 0))),
    expectedCalibrationError: expectedCalibrationError(predictions),
    calibrationBins: calibrationBins(predictions),
    macroPrecision: classification.macroPrecision,
    macroRecall: classification.macroRecall,
    byLabel: classification.byLabel,
    abstention: abstentionCurve(predictions),
  };
}

export function scoreStateValidityPredictions(rows, labels = null) {
  const normalizedLabels = labels || [...new Set(rows.map((row) => String(row.truth)))].sort();
  const predictions = rows.map((row, index) => {
    const probabilities = Object.fromEntries(
      normalizedLabels.map((label) => [label, Math.max(0, Number(row.probabilities?.[label] || 0))]),
    );
    const total = Object.values(probabilities).reduce((sum, value) => sum + value, 0);
    if (!(total > 0)) throw new Error(`stateValidityMetrics: prediction ${index} has no probability mass`);
    for (const label of normalizedLabels) probabilities[label] /= total;
    const ranked = topEntries(probabilities);
    const truth = String(row.truth);
    return {
      id: row.id || `prediction-${index + 1}`,
      truth,
      predicted: ranked[0][0],
      confidence: ranked[0][1],
      probabilities,
      correct: ranked[0][0] === truth,
      topK: ranked.slice(0, Math.min(3, normalizedLabels.length)).map(([label]) => label),
    };
  });
  return predictionMetrics(predictions, normalizedLabels);
}

function levelValues(rows, axis) {
  return [
    ...new Set(
      rows
        .map((row) => row.groups?.[axis])
        .filter((value) => value != null)
        .map(String),
    ),
  ].sort();
}

export function buildStateValidityHoldouts(rows, axes = DEFAULT_HOLDOUT_AXES) {
  const folds = [];
  for (const axis of axes) {
    for (const value of levelValues(rows, axis)) {
      const testIds = rows
        .filter((row) => String(row.groups?.[axis]) === value)
        .map((row) => String(row.id))
        .sort();
      if (!testIds.length || testIds.length === rows.length) continue;
      folds.push({ id: `${axis}=${value}`, axis, value, testIds });
    }
  }
  return folds;
}

function validateAtomicHoldoutIdentity(rows, holdoutAxes, atomicUnit) {
  const byAtomicUnit = new Map();
  for (const row of rows) {
    const groupId = row?.groups?.[atomicUnit];
    if (groupId == null || String(groupId) === '') {
      throw new Error(`stateValidityMetrics: row ${row?.id || '<unknown>'} is missing groups.${atomicUnit}`);
    }
    const signature = canonicalComparable(
      Object.fromEntries(holdoutAxes.map((axis) => [axis, row.groups?.[axis] ?? null])),
    );
    if (byAtomicUnit.has(String(groupId)) && byAtomicUnit.get(String(groupId)) !== signature) {
      throw new Error(`stateValidityMetrics: ${atomicUnit} ${groupId} crosses grouped holdout identities`);
    }
    byAtomicUnit.set(String(groupId), signature);
  }
}

export function buildStateValiditySplitManifest(
  rows,
  {
    method = 'leave_one_group_level_out',
    atomicUnit = DEFAULT_BOOTSTRAP_GROUP_KEY,
    holdoutAxes = DEFAULT_HOLDOUT_AXES,
    gatePolicy = DEFAULT_STATE_VALIDITY_GATE_POLICY,
  } = {},
) {
  if (!Array.isArray(rows) || rows.length < 2) {
    throw new Error('stateValidityMetrics: split manifest needs at least two rows');
  }
  if (method !== 'leave_one_group_level_out') {
    throw new Error(`stateValidityMetrics: unsupported split manifest method ${method}`);
  }
  const axes = assertUniqueStrings(holdoutAxes, 'split manifest holdoutAxes');
  const unit = String(atomicUnit || '');
  if (!unit) throw new Error('stateValidityMetrics: split manifest atomicUnit is required');
  const sampleIds = assertUniqueStrings(
    rows.map((row) => row?.id),
    'split manifest sampleIds',
  ).sort();
  validateAtomicHoldoutIdentity(rows, axes, unit);
  const folds = buildStateValidityHoldouts(rows, axes);
  if (!folds.length) throw new Error('stateValidityMetrics: split manifest produced no valid grouped holdouts');
  return {
    schema: ADAPTIVE_STATE_SPLIT_MANIFEST_SCHEMA,
    method,
    atomicUnit: unit,
    holdoutAxes: axes,
    gatePolicy: normalizeStateValidityGatePolicy(gatePolicy),
    folds,
    sampleIds,
  };
}

export function verifyStateValiditySplitManifest(rows, manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('stateValidityMetrics: split manifest must be an object');
  }
  if (manifest.schema !== ADAPTIVE_STATE_SPLIT_MANIFEST_SCHEMA) {
    throw new Error(`stateValidityMetrics: unsupported split manifest schema ${manifest.schema || '<missing>'}`);
  }
  if (manifest.method !== 'leave_one_group_level_out') {
    throw new Error(`stateValidityMetrics: unsupported split manifest method ${manifest.method || '<missing>'}`);
  }
  if (typeof manifest.atomicUnit !== 'string' || !manifest.atomicUnit) {
    throw new Error('stateValidityMetrics: split manifest atomicUnit is required');
  }
  const declaredAxes = assertUniqueStrings(manifest.holdoutAxes, 'split manifest holdoutAxes');
  assertUniqueStrings(manifest.sampleIds, 'split manifest sampleIds');
  if (!Array.isArray(manifest.folds) || !manifest.folds.length) {
    throw new Error('stateValidityMetrics: split manifest folds must be a non-empty array');
  }
  const foldIds = assertUniqueStrings(
    manifest.folds.map((fold) => fold?.id),
    'split manifest fold ids',
  );
  for (const [index, fold] of manifest.folds.entries()) {
    if (!declaredAxes.includes(String(fold?.axis || ''))) {
      throw new Error(`stateValidityMetrics: split manifest fold ${foldIds[index]} uses an undeclared axis`);
    }
    assertUniqueStrings(fold?.testIds, `split manifest fold ${foldIds[index]} testIds`);
  }
  const expected = buildStateValiditySplitManifest(rows, {
    method: manifest.method,
    atomicUnit: manifest.atomicUnit,
    holdoutAxes: declaredAxes,
    gatePolicy: manifest.gatePolicy,
  });
  for (const field of ['sampleIds', 'folds']) {
    if (canonicalComparable(manifest[field]) !== canonicalComparable(expected[field])) {
      throw new Error(`stateValidityMetrics: split manifest ${field} do not match benchmark rows`);
    }
  }
  if (canonicalComparable(manifest.gatePolicy) !== canonicalComparable(expected.gatePolicy)) {
    throw new Error('stateValidityMetrics: split manifest gatePolicy is incomplete or non-canonical');
  }
  return expected;
}

function evaluateFold(rows, fold, representation, target, labels, options) {
  const testIds = new Set(fold.testIds);
  const training = rows
    .filter((row) => !testIds.has(row.id) && row.targets?.[target] != null && row.representations?.[representation])
    .map((row) => ({
      id: row.id,
      label: String(row.targets[target]),
      features: flatten({ state: row.representations[representation], action: row.action || { missing: true } }),
    }));
  const testing = rows.filter(
    (row) => testIds.has(row.id) && row.targets?.[target] != null && row.representations?.[representation],
  );
  if (!training.length || !testing.length) return null;
  const predictions = testing.map((row) => {
    const probabilities = predictKnn(
      training,
      flatten({ state: row.representations[representation], action: row.action || { missing: true } }),
      labels,
      options,
    );
    const ranked = topEntries(probabilities);
    const truth = String(row.targets[target]);
    return {
      id: row.id,
      groupId: row.groups?.[options.bootstrapGroupKey] ?? null,
      truth,
      predicted: ranked[0]?.[0] || null,
      confidence: ranked[0]?.[1] || 0,
      probabilities,
      correct: ranked[0]?.[0] === truth,
      topK: ranked.slice(0, Math.min(3, labels.length)).map(([label]) => label),
    };
  });
  return {
    fold: fold.id,
    axis: fold.axis,
    value: fold.value,
    trainN: training.length,
    testN: testing.length,
    metrics: predictionMetrics(predictions, labels),
    predictions,
  };
}

function aggregateFolds(folds) {
  const valid = folds.filter((fold) => fold?.metrics);
  const weighted = (field) => {
    const rows = valid.filter((fold) => Number.isFinite(Number(fold.metrics[field])));
    const denominator = rows.reduce((sum, fold) => sum + fold.testN, 0);
    return denominator
      ? rows.reduce((sum, fold) => sum + Number(fold.metrics[field]) * fold.testN, 0) / denominator
      : null;
  };
  return {
    folds: valid.length,
    n: valid.reduce((sum, fold) => sum + fold.testN, 0),
    logLoss: weighted('logLoss'),
    brierScore: weighted('brierScore'),
    top1Accuracy: weighted('top1Accuracy'),
    topKAccuracy: weighted('topKAccuracy'),
    expectedCalibrationError: weighted('expectedCalibrationError'),
    macroPrecision: weighted('macroPrecision'),
    macroRecall: weighted('macroRecall'),
  };
}

function predictionContribution(prediction, labels) {
  return {
    logLoss: -Math.log(Math.max(1e-12, Number(prediction.probabilities[prediction.truth] || 0))),
    brierScore: labels.reduce(
      (sum, label) => sum + (Number(prediction.probabilities[label] || 0) - (prediction.truth === label ? 1 : 0)) ** 2,
      0,
    ),
    top1Accuracy: prediction.correct ? 1 : 0,
  };
}

function pairedPredictionContributions(lean, candidate, labels) {
  const pairs = [];
  const leanFolds = new Map(lean.folds.map((fold) => [fold.fold, fold]));
  for (const candidateFold of candidate.folds) {
    const leanFold = leanFolds.get(candidateFold.fold);
    if (!leanFold) throw new Error(`stateValidityMetrics: lean is missing fold ${candidateFold.fold}`);
    const leanPredictions = new Map(leanFold.predictions.map((prediction) => [prediction.id, prediction]));
    for (const prediction of candidateFold.predictions) {
      const baseline = leanPredictions.get(prediction.id);
      if (!baseline) {
        throw new Error(
          `stateValidityMetrics: lean is missing paired prediction ${prediction.id} in ${candidateFold.fold}`,
        );
      }
      if (baseline.truth !== prediction.truth) {
        throw new Error(
          `stateValidityMetrics: paired prediction truth differs for ${prediction.id} in ${candidateFold.fold}`,
        );
      }
      if (baseline.groupId == null || prediction.groupId == null || baseline.groupId !== prediction.groupId) {
        throw new Error(
          `stateValidityMetrics: paired prediction group differs for ${prediction.id} in ${candidateFold.fold}`,
        );
      }
      pairs.push({
        id: `${candidateFold.fold}:${prediction.id}`,
        groupId: prediction.groupId,
        lean: predictionContribution(baseline, labels),
        candidate: predictionContribution(prediction, labels),
      });
    }
    if (candidateFold.predictions.length !== leanFold.predictions.length) {
      throw new Error(`stateValidityMetrics: paired prediction support differs in fold ${candidateFold.fold}`);
    }
  }
  return pairs;
}

function compareWithLean(results, target, bootstrapOptions) {
  const lean = results.lean?.targets?.[target];
  if (!lean) return {};
  return Object.fromEntries(
    Object.entries(results)
      .filter(([name]) => name !== 'lean')
      .map(([name, result]) => {
        const current = result.targets?.[target];
        const pairedBootstrap = current
          ? pairedGroupBootstrapStateValidity(pairedPredictionContributions(lean, current, current.labels), {
              ...bootstrapOptions,
              namespace: `${target}:${name}`,
            })
          : null;
        return [
          name,
          current
            ? {
                deltaLogLoss: pairedBootstrap.metrics.logLoss.pointDelta,
                deltaBrier: pairedBootstrap.metrics.brierScore.pointDelta,
                deltaTop1Accuracy: pairedBootstrap.metrics.top1Accuracy.pointDelta,
                pairedBootstrap,
              }
            : null,
        ];
      }),
  );
}

function compareCandidateWithPlacebos(results, candidateName, target, bootstrapOptions) {
  const candidate = results[candidateName]?.targets?.[target];
  if (!candidate) return {};
  return Object.fromEntries(
    [...PLACEBO_REPRESENTATIONS].map((placeboName) => {
      const placebo = results[placeboName]?.targets?.[target];
      const pairedBootstrap = placebo
        ? pairedGroupBootstrapStateValidity(pairedPredictionContributions(placebo, candidate, candidate.labels), {
            ...bootstrapOptions,
            namespace: `${target}:${candidateName}:vs:${placeboName}`,
          })
        : null;
      return [
        placeboName,
        pairedBootstrap
          ? {
              deltaLogLoss: pairedBootstrap.metrics.logLoss.pointDelta,
              deltaBrier: pairedBootstrap.metrics.brierScore.pointDelta,
              deltaTop1Accuracy: pairedBootstrap.metrics.top1Accuracy.pointDelta,
              pairedBootstrap,
            }
          : null,
      ];
    }),
  );
}

function crossedIndependentAxisCoverage(rows, axis) {
  const byFamily = new Map();
  for (const row of rows) {
    const family = String(row.groups?.latent_generator_family || '');
    if (LATENT_GENERATOR_REGISTRY[family]?.independent !== true) continue;
    const value = row.groups?.[axis];
    if (value == null) continue;
    if (!byFamily.has(family)) byFamily.set(family, new Set());
    byFamily.get(family).add(String(value));
  }
  const valuesByFamily = Object.fromEntries(
    [...byFamily.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([family, values]) => [family, [...values].sort()]),
  );
  return {
    axis,
    independentLatentGeneratorFamilies: Object.keys(valuesByFamily),
    valuesByFamily,
    crossed:
      Object.keys(valuesByFamily).length >= 2 && Object.values(valuesByFamily).every((values) => values.length >= 2),
  };
}

function claimGradeSettings(bootstrapOptions, gatePolicy) {
  const checks = {
    bootstrapIterations: bootstrapOptions.iterations >= gatePolicy.minimumBootstrapIterations,
    confidenceLevel: bootstrapOptions.confidenceLevel >= gatePolicy.minimumConfidenceLevel,
    improvementProbability: bootstrapOptions.minimumImprovementProbability >= gatePolicy.minimumImprovementProbability,
    bootstrapGroupKey: bootstrapOptions.groupKey === gatePolicy.requiredBootstrapGroupKey,
  };
  return {
    passed: Object.values(checks).every(Boolean),
    checks,
    observed: {
      bootstrapIterations: bootstrapOptions.iterations,
      confidenceLevel: bootstrapOptions.confidenceLevel,
      minimumImprovementProbability: bootstrapOptions.minimumImprovementProbability,
      bootstrapGroupKey: bootstrapOptions.groupKey,
    },
    required: gatePolicy,
  };
}

function sensorGate(benchmarkRows, results, targets, incrementalValueOverLean, bootstrapOptions, gatePolicy) {
  const settings = claimGradeSettings(bootstrapOptions, gatePolicy);
  const independentAxisCoverage = {
    learnerSource: crossedIndependentAxisCoverage(benchmarkRows, 'learner_source'),
    modelFamily: crossedIndependentAxisCoverage(benchmarkRows, 'model_family'),
  };
  const candidates = Object.keys(results).filter(
    (name) => name !== 'lean' && name !== 'oracle' && !PLACEBO_REPRESENTATIONS.has(name),
  );
  const representationRows = candidates.map((name) => {
    const improvements = targets.map((target) => {
      const lean = results.lean?.targets?.[target];
      const current = results[name]?.targets?.[target];
      if (!lean || !current) {
        return {
          target,
          evaluable: false,
          reason: !lean ? 'lean_baseline_has_no_evaluable_holdout' : 'candidate_has_no_evaluable_holdout',
          worldLevels: 0,
          latentGeneratorLevels: 0,
          learnerSourceLevels: 0,
          modelFamilyLevels: 0,
          independentHoldoutPassed: false,
          calibrationPassed: false,
          calibration: null,
          uncertaintyPassed: false,
          placeboPassed: false,
          placeboComparisons: {},
          pairedBootstrap: null,
        };
      }
      const incremental = incrementalValueOverLean?.[target]?.[name] || null;
      const uncertaintyPassed = passesStateValidityUncertaintyGate(
        incremental?.pairedBootstrap,
        bootstrapOptions.minimumImprovementProbability,
      );
      const placeboComparisons = compareCandidateWithPlacebos(results, name, target, bootstrapOptions);
      const placeboPassed = [...PLACEBO_REPRESENTATIONS].every((placeboName) =>
        passesStateValidityUncertaintyGate(
          placeboComparisons[placeboName]?.pairedBootstrap,
          bootstrapOptions.minimumImprovementProbability,
        ),
      );
      const improvingFolds = current.folds.filter((fold) => {
        const baseline = lean.folds.find((candidate) => candidate.fold === fold.fold);
        return (
          baseline &&
          fold.metrics.logLoss < baseline.metrics.logLoss &&
          fold.metrics.brierScore < baseline.metrics.brierScore
        );
      });
      const calibration = {
        evaluation: gatePolicy.calibrationEvaluation,
        n: current.aggregate.n,
        expectedCalibrationError: current.aggregate.expectedCalibrationError,
        maximumExpectedCalibrationError: gatePolicy.maximumExpectedCalibrationError,
        minimumPredictions: gatePolicy.minimumCalibrationPredictions,
      };
      const calibrationPassed =
        Number(calibration.n) >= gatePolicy.minimumCalibrationPredictions &&
        Number.isFinite(Number(calibration.expectedCalibrationError)) &&
        Number(calibration.expectedCalibrationError) <= gatePolicy.maximumExpectedCalibrationError;
      const latentGeneratorLevels = new Set(
        improvingFolds
          .filter(
            (fold) =>
              fold.axis === 'latent_generator_family' &&
              LATENT_GENERATOR_REGISTRY[String(fold.value)]?.independent === true,
          )
          .map((fold) => fold.value),
      ).size;
      const learnerSourceLevels = new Set(
        improvingFolds.filter((fold) => fold.axis === 'learner_source').map((fold) => fold.value),
      ).size;
      const modelFamilyLevels = new Set(
        improvingFolds.filter((fold) => fold.axis === 'model_family').map((fold) => fold.value),
      ).size;
      const independentHoldoutPassed =
        (learnerSourceLevels >= 2 && independentAxisCoverage.learnerSource.crossed) ||
        (modelFamilyLevels >= 2 && independentAxisCoverage.modelFamily.crossed);
      return {
        target,
        evaluable: true,
        worldLevels: new Set(improvingFolds.filter((fold) => fold.axis === 'world').map((fold) => fold.value)).size,
        latentGeneratorLevels,
        learnerSourceLevels,
        modelFamilyLevels,
        independentHoldoutPassed,
        calibrationPassed,
        calibration,
        uncertaintyPassed,
        placeboPassed,
        placeboComparisons,
        pairedBootstrap: incremental?.pairedBootstrap || null,
      };
    });
    const passedTargets = improvements.filter(
      (row) =>
        row.evaluable &&
        settings.passed &&
        row.calibrationPassed &&
        row.uncertaintyPassed &&
        row.placeboPassed &&
        row.worldLevels >= 2 &&
        row.latentGeneratorLevels >= 2 &&
        row.independentHoldoutPassed,
    );
    return { representation: name, improvements, passedTargets: passedTargets.map((row) => row.target) };
  });
  const winner = representationRows.find((row) => row.passedTargets.length > 0) || null;
  return {
    analysisProtocolGrade: settings.passed ? 'claim_grade_settings' : 'exploratory_settings',
    status: winner ? 'synthetic_instrument_only' : 'not_passed',
    engineeringDecision: winner
      ? 'sensor_candidate_passes_synthetic_gate'
      : settings.passed
        ? 'do_not_optimize_policy'
        : 'exploratory_settings_do_not_optimize_policy',
    winner: winner?.representation || null,
    targets: winner?.passedTargets || [],
    representations: representationRows,
    claimGradeSettings: settings,
    independentAxisCoverage,
    calibrationCriteria: {
      evaluation: gatePolicy.calibrationEvaluation,
      maximumExpectedCalibrationError: gatePolicy.maximumExpectedCalibrationError,
      minimumPredictions: gatePolicy.minimumCalibrationPredictions,
    },
    uncertaintyCriteria: {
      primaryMetrics: ['logLoss', 'brierScore'],
      confidenceIntervalLowerBoundMustExceed: 0,
      minimumProbabilityOfImprovement: bootstrapOptions.minimumImprovementProbability,
      confidenceLevel: bootstrapOptions.confidenceLevel,
      requiredPlacebos: [...PLACEBO_REPRESENTATIONS],
    },
    claimBoundary:
      'This gate validates held-out prediction on the named data tiers only. It is not evidence of human learning or policy efficacy.',
  };
}

function validateCommonSupport(rows, representations, holdoutAxes) {
  const ids = new Set();
  for (const row of rows) {
    if (!row?.id) throw new Error('stateValidityMetrics: every row needs an id');
    if (ids.has(row.id)) throw new Error(`stateValidityMetrics: duplicate row id ${row.id}`);
    ids.add(row.id);
    if (row.feature_provenance?.policy_invariant !== true) {
      throw new Error(`stateValidityMetrics: row ${row.id} is not marked policy-invariant`);
    }
    validateCommonLeanBaselineRepresentations(row.representations);
    validateLatentGeneratorFamilyClaim(row);
    for (const representation of representations) {
      if (representation === 'oracle') continue;
      if (!Object.hasOwn(row.representations || {}, representation)) {
        throw new Error(`stateValidityMetrics: row ${row.id} is missing representation ${representation}`);
      }
    }
  }
  validateAtomicHoldoutIdentity(rows, holdoutAxes, DEFAULT_BOOTSTRAP_GROUP_KEY);
}

export function evaluateAdaptiveStateValidity(rows, options = {}) {
  if (!Array.isArray(rows) || rows.length < 2) throw new Error('stateValidityMetrics: at least two rows are required');
  const holdoutAxes = assertUniqueStrings(
    options.holdoutAxes || options.splitManifest?.holdoutAxes || DEFAULT_HOLDOUT_AXES,
    'holdout axes',
  );
  const bootstrapOptions = normalizeBootstrapOptions(options.bootstrap);
  const gatePolicy = normalizeStateValidityGatePolicy(options.gatePolicy || options.splitManifest?.gatePolicy);
  const recomputedFolds = buildStateValidityHoldouts(rows, holdoutAxes);
  if (options.folds && canonicalComparable(options.folds) !== canonicalComparable(recomputedFolds)) {
    throw new Error('stateValidityMetrics: supplied folds do not match benchmark rows and holdout axes');
  }
  const folds = options.folds || recomputedFolds;
  const splitManifest = options.splitManifest
    ? verifyStateValiditySplitManifest(rows, options.splitManifest)
    : buildStateValiditySplitManifest(rows, {
        method: options.splitMethod || 'leave_one_group_level_out',
        atomicUnit: options.atomicUnit || DEFAULT_BOOTSTRAP_GROUP_KEY,
        holdoutAxes,
        gatePolicy,
      });
  if (canonicalComparable(splitManifest.gatePolicy) !== canonicalComparable(gatePolicy)) {
    throw new Error('stateValidityMetrics: gate policy differs from the verified split manifest');
  }
  if (canonicalComparable(splitManifest.folds) !== canonicalComparable(folds)) {
    throw new Error('stateValidityMetrics: evaluated folds differ from the verified split manifest');
  }
  if (!folds.length) throw new Error('stateValidityMetrics: no valid grouped holdouts; add more than one group level');
  const representations =
    options.representations || [...new Set(rows.flatMap((row) => Object.keys(row.representations || {})))].sort();
  validateCommonSupport(rows, representations, holdoutAxes);
  for (const row of rows) {
    if (row.groups?.[bootstrapOptions.groupKey] == null) {
      throw new Error(
        `stateValidityMetrics: row ${row.id} is missing bootstrap group groups.${bootstrapOptions.groupKey}`,
      );
    }
  }
  const targets = options.targets || [...new Set(rows.flatMap((row) => Object.keys(row.targets || {})))].sort();
  const results = {};
  for (const representation of representations) {
    const targetResults = {};
    for (const target of targets) {
      const labels = labelsFromRows(rows, target);
      if (labels.length < 2) continue;
      const evaluated = folds
        .map((fold) =>
          evaluateFold(rows, fold, representation, target, labels, {
            k: options.k || 7,
            bootstrapGroupKey: bootstrapOptions.groupKey,
          }),
        )
        .filter(Boolean);
      if (!evaluated.length) continue;
      targetResults[target] = { labels, folds: evaluated, aggregate: aggregateFolds(evaluated) };
    }
    results[representation] = {
      kind: REPRESENTATION_KINDS[representation] || 'candidate',
      targets: targetResults,
    };
  }
  const incrementalValueOverLean = Object.fromEntries(
    targets.map((target) => [target, compareWithLean(results, target, bootstrapOptions)]),
  );
  const gate = sensorGate(rows, results, targets, incrementalValueOverLean, bootstrapOptions, gatePolicy);
  for (const result of Object.values(results)) {
    for (const targetResult of Object.values(result.targets || {})) {
      for (const fold of targetResult.folds || []) delete fold.predictions;
    }
  }
  return {
    schema: ADAPTIVE_STATE_VALIDITY_REPORT_SCHEMA,
    generatedAt: new Date().toISOString(),
    analysisProtocolGrade: gate.analysisProtocolGrade,
    rowCount: rows.length,
    holdoutAxes,
    folds,
    targets,
    representations: results,
    uncertainty: {
      method: 'paired_group_bootstrap',
      samplingUnit: 'whole_group',
      groupKey: bootstrapOptions.groupKey,
      iterations: bootstrapOptions.iterations,
      seed: bootstrapOptions.seed,
      confidenceLevel: bootstrapOptions.confidenceLevel,
      minimumImprovementProbability: bootstrapOptions.minimumImprovementProbability,
    },
    incrementalValueOverLean,
    sensorGate: gate,
    gatePolicy,
    splitManifestSha256: createHash('sha256').update(canonicalComparable(splitManifest)).digest('hex'),
    foldsSha256: createHash('sha256').update(canonicalComparable(folds)).digest('hex'),
  };
}
