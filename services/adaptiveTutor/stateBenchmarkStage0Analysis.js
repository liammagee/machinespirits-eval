import { hashCanonicalJson } from '../experimentRunArtifacts.js';

export const ADAPTIVE_STATE_STAGE0_REPORT_V2_SCHEMA =
  'machinespirits.adaptive-state-stage0-contract-report.v2';
export const ADAPTIVE_STATE_SPLIT_MANIFEST_V2_SCHEMA =
  'machinespirits.adaptive-state-split-manifest.v2';

const TARGET_LABELS = Object.freeze({
  next_dag_event_family: Object.freeze(['retract', 'derive', 'adopt', 'none']),
  next_proof_trajectory: Object.freeze(['advance', 'regress', 'stall']),
});
const EXPECTED_TARGET_CONTRACTS = Object.freeze([
  Object.freeze({
    id: 'next_dag_event_family',
    labels: TARGET_LABELS.next_dag_event_family,
    owner: 'transition_harness',
  }),
  Object.freeze({
    id: 'next_proof_trajectory',
    labels: TARGET_LABELS.next_proof_trajectory,
    owner: 'world_normalized_proof_distance_and_debt_harness',
  }),
]);

export const ADAPTIVE_STATE_STATE_BLIND_BASELINE_CONTRACT = Object.freeze({
  class_prior: Object.freeze({
    training_scope: 'each_training_fold_only',
    smoothing: 'symmetric_dirichlet',
    alpha: 1,
    label_set: 'frozen_target_labels',
    absent_class_behavior: 'alpha_smoothed_nonzero',
    test_frequency_access: false,
  }),
  uniform: Object.freeze({
    probability: 'one_over_frozen_label_count',
    label_set: 'frozen_target_labels',
  }),
});

const FORBIDDEN_NON_ORACLE_KEY = /(?:^|_)(?:future|target|oracle|hidden|private|answer_key)(?:_|$)/iu;

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function stableSort(values) {
  return [...values].sort((left, right) => String(left).localeCompare(String(right)));
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + Number(value), 0) / values.length : null;
}

function flatten(value, prefix = '', out = {}) {
  if (Array.isArray(value)) {
    if (!value.length && prefix) out[prefix] = null;
    value.forEach((child, index) => flatten(child, `${prefix}[${index}]`, out));
    return out;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (!entries.length && prefix) out[prefix] = null;
    for (const [key, child] of entries) flatten(child, prefix ? `${prefix}.${key}` : key, out);
    return out;
  }
  if (prefix) out[prefix] = value;
  return out;
}

function featureObject(row, representation) {
  return flatten({
    state: row.representations?.[representation] || {},
    action: row.action || { missing: true },
  });
}

function encoderFromTraining(rows, representation) {
  const flattened = rows.map((row) => featureObject(row, representation));
  const keys = stableSort(new Set(flattened.flatMap((row) => Object.keys(row))));
  const specs = [];
  for (const key of keys) {
    const present = flattened.map((row) => row[key]).filter((value) => value !== null && value !== undefined);
    const numeric = present.length > 0 && present.every((value) => typeof value === 'number' && Number.isFinite(value));
    if (numeric) {
      const center = mean(present);
      const variance = mean(present.map((value) => (value - center) ** 2));
      specs.push({ key, kind: 'numeric', center, scale: Math.sqrt(variance) || 1 });
      continue;
    }
    const values = new Set(present.map((value) => String(value)));
    values.add('__missing__');
    values.add('__unknown__');
    specs.push({ key, kind: 'categorical', values: stableSort(values) });
  }
  const featureNames = ['(intercept)'];
  for (const spec of specs) {
    if (spec.kind === 'numeric') {
      featureNames.push(spec.key, `${spec.key}.__missing__`);
    } else {
      featureNames.push(...spec.values.map((value) => `${spec.key}=${value}`));
    }
  }
  return { representation, specs, featureNames };
}

function encode(features, encoder) {
  const vector = [1];
  for (const spec of encoder.specs) {
    const raw = features[spec.key];
    if (spec.kind === 'numeric') {
      const missing = typeof raw !== 'number' || !Number.isFinite(raw);
      vector.push(missing ? 0 : (raw - spec.center) / spec.scale, missing ? 1 : 0);
      continue;
    }
    const normalized = raw === null || raw === undefined ? '__missing__' : String(raw);
    const value = spec.values.includes(normalized) ? normalized : '__unknown__';
    for (const category of spec.values) vector.push(category === value ? 1 : 0);
  }
  return vector;
}

function softmax(scores, clip) {
  const maximum = Math.max(...scores);
  const exponentials = scores.map((score) => Math.exp(score - maximum));
  const total = exponentials.reduce((sum, value) => sum + value, 0) || 1;
  const clipped = exponentials.map((value) => Math.max(clip, value / total));
  const clippedTotal = clipped.reduce((sum, value) => sum + value, 0);
  return clipped.map((value) => value / clippedTotal);
}

function dot(left, right) {
  let total = 0;
  for (let index = 0; index < left.length; index += 1) total += left[index] * right[index];
  return total;
}

/** Deterministic fixed-head implementation used to smoke the frozen S0 path. */
export function fitAdaptiveStateStage0Head(
  rows,
  {
    representation = 'no_state',
    target,
    labels = TARGET_LABELS[target],
    lambda = 1,
    regularizationScaling = 'lambda_over_training_rows',
    learningRate = 0.05,
    maximumIterations = 2000,
    convergenceTolerance = 1e-5,
    convergenceCriterion = 'absolute_objective_delta',
    probabilityClip = 1e-12,
  } = {},
) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('stateBenchmarkStage0: head needs training rows');
  if (!target || !Array.isArray(labels) || labels.length < 2) {
    throw new Error('stateBenchmarkStage0: head needs a target with at least two frozen labels');
  }
  if (
    regularizationScaling !== 'lambda_over_training_rows' ||
    convergenceCriterion !== 'absolute_objective_delta'
  ) {
    throw new Error('stateBenchmarkStage0: unsupported fixed-head scaling or convergence criterion');
  }
  const encoder = encoderFromTraining(rows, representation);
  const x = rows.map((row) => encode(featureObject(row, representation), encoder));
  const y = rows.map((row) => labels.indexOf(String(row.targets?.[target])));
  if (y.some((index) => index < 0)) throw new Error(`stateBenchmarkStage0: unknown ${target} training label`);
  const weights = labels.map(() => Array(encoder.featureNames.length).fill(0));
  let converged = false;
  let iterations = 0;
  let previousObjective = null;
  let finalObjective = null;
  for (iterations = 1; iterations <= maximumIterations; iterations += 1) {
    const gradient = labels.map(() => Array(encoder.featureNames.length).fill(0));
    let dataLoss = 0;
    for (let rowIndex = 0; rowIndex < x.length; rowIndex += 1) {
      const probabilities = softmax(weights.map((row) => dot(row, x[rowIndex])), probabilityClip);
      dataLoss -= Math.log(Math.max(probabilityClip, probabilities[y[rowIndex]]));
      for (let labelIndex = 0; labelIndex < labels.length; labelIndex += 1) {
        const error = probabilities[labelIndex] - (y[rowIndex] === labelIndex ? 1 : 0);
        for (let featureIndex = 0; featureIndex < x[rowIndex].length; featureIndex += 1) {
          gradient[labelIndex][featureIndex] += error * x[rowIndex][featureIndex];
        }
      }
    }
    const penalty =
      (lambda / (2 * x.length)) *
      weights.reduce(
        (total, row) => total + row.slice(1).reduce((sum, weight) => sum + weight * weight, 0),
        0,
      );
    finalObjective = dataLoss / x.length + penalty;
    if (previousObjective !== null && Math.abs(previousObjective - finalObjective) <= convergenceTolerance) {
      converged = true;
      break;
    }
    previousObjective = finalObjective;
    let maximumUpdate = 0;
    for (let labelIndex = 0; labelIndex < labels.length; labelIndex += 1) {
      for (let featureIndex = 0; featureIndex < encoder.featureNames.length; featureIndex += 1) {
        const penalty = featureIndex === 0 ? 0 : lambda * weights[labelIndex][featureIndex];
        const update = learningRate * ((gradient[labelIndex][featureIndex] + penalty) / x.length);
        weights[labelIndex][featureIndex] -= update;
        maximumUpdate = Math.max(maximumUpdate, Math.abs(update));
      }
    }
    if (!Number.isFinite(maximumUpdate)) throw new Error('stateBenchmarkStage0: fixed-head update became non-finite');
  }
  return {
    schema: 'machinespirits.adaptive-state-fixed-head.v2',
    representation,
    target,
    labels: [...labels],
    encoder,
    weights,
    converged,
    iterations: Math.min(iterations, maximumIterations),
    objective: finalObjective,
    contract: {
      id: 'l2_multinomial_logistic',
      regularization_kind: 'l2',
      regularization_lambda: lambda,
      regularization_scaling: regularizationScaling,
      solver_id: 'deterministic_batch_gradient_descent',
      learning_rate: learningRate,
      maximum_iterations: maximumIterations,
      convergence_tolerance: convergenceTolerance,
      convergence_criterion: convergenceCriterion,
      probability_clip: probabilityClip,
    },
  };
}

export function predictAdaptiveStateStage0Head(model, rows) {
  return rows.map((row) => {
    const vector = encode(featureObject(row, model.representation), model.encoder);
    const values = softmax(
      model.weights.map((weights) => dot(weights, vector)),
      model.contract.probability_clip,
    );
    return {
      id: row.id,
      dialogue_id: row.groups.dialogue_id,
      truth: String(row.targets[model.target]),
      probabilities: Object.fromEntries(model.labels.map((label, index) => [label, values[index]])),
    };
  });
}

export function adaptiveStateStateBlindBaselineContractSha256(contract) {
  if (hashCanonicalJson(contract) !== hashCanonicalJson(ADAPTIVE_STATE_STATE_BLIND_BASELINE_CONTRACT)) {
    throw new Error('stateBenchmarkStage0: state-blind baseline contract differs from the frozen protocol');
  }
  return hashCanonicalJson(contract);
}

function validateStateBlindBaselineInputs(rows, target, labels) {
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error('stateBenchmarkStage0: state-blind baseline needs rows');
  }
  if (!target || !Array.isArray(labels) || labels.length < 2 || new Set(labels).size !== labels.length) {
    throw new Error('stateBenchmarkStage0: state-blind baseline needs distinct frozen target labels');
  }
  if (rows.some((row) => !labels.includes(String(row.targets?.[target])))) {
    throw new Error(`stateBenchmarkStage0: unknown ${target} label for state-blind baseline`);
  }
}

export function fitAdaptiveStateTrainingFoldClassPrior(
  trainingRows,
  { target, labels = TARGET_LABELS[target], contract = ADAPTIVE_STATE_STATE_BLIND_BASELINE_CONTRACT } = {},
) {
  validateStateBlindBaselineInputs(trainingRows, target, labels);
  const contractSha256 = adaptiveStateStateBlindBaselineContractSha256(contract);
  const alpha = Number(contract.class_prior.alpha);
  const counts = Object.fromEntries(labels.map((label) => [label, 0]));
  for (const row of trainingRows) counts[String(row.targets[target])] += 1;
  const denominator = trainingRows.length + alpha * labels.length;
  const probabilities = Object.fromEntries(
    labels.map((label) => [label, (counts[label] + alpha) / denominator]),
  );
  return {
    schema: 'machinespirits.adaptive-state-training-fold-class-prior.v2.1',
    target,
    labels: [...labels],
    training_rows: trainingRows.length,
    counts,
    smoothing: { kind: 'symmetric_dirichlet', alpha },
    probabilities,
    contract_sha256: contractSha256,
  };
}

export function predictAdaptiveStateTrainingFoldClassPrior(model, testingRows) {
  validateStateBlindBaselineInputs(testingRows, model.target, model.labels);
  if (
    model.smoothing?.kind !== 'symmetric_dirichlet' ||
    Number(model.smoothing?.alpha) !== 1 ||
    Object.values(model.probabilities || {}).some((probability) => !(Number(probability) > 0))
  ) {
    throw new Error('stateBenchmarkStage0: invalid frozen class-prior model');
  }
  return testingRows.map((row) => ({
    id: row.id,
    dialogue_id: row.groups.dialogue_id,
    truth: String(row.targets[model.target]),
    probabilities: clone(model.probabilities),
  }));
}

export function predictAdaptiveStateUniformBaseline(
  rows,
  { target, labels = TARGET_LABELS[target], contract = ADAPTIVE_STATE_STATE_BLIND_BASELINE_CONTRACT } = {},
) {
  validateStateBlindBaselineInputs(rows, target, labels);
  adaptiveStateStateBlindBaselineContractSha256(contract);
  const probabilities = Object.fromEntries(labels.map((label) => [label, 1 / labels.length]));
  return rows.map((row) => ({
    id: row.id,
    dialogue_id: row.groups.dialogue_id,
    truth: String(row.targets[target]),
    probabilities: clone(probabilities),
  }));
}

export function buildAdaptiveStateOutOfFoldStateBlindBaselines(
  rows,
  splitManifest,
  {
    target,
    labels = TARGET_LABELS[target],
    contract = ADAPTIVE_STATE_STATE_BLIND_BASELINE_CONTRACT,
    laneId = 'world_transfer',
  } = {},
) {
  validateStateBlindBaselineInputs(rows, target, labels);
  const contractSha256 = adaptiveStateStateBlindBaselineContractSha256(contract);
  const lane = splitManifest?.lanes?.find((candidate) => candidate.id === laneId);
  if (!lane) throw new Error(`stateBenchmarkStage0: missing state-blind baseline lane ${laneId}`);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const classPriorPredictions = [];
  const models = [];
  for (const fold of lane.folds) {
    const training = fold.train_ids.map((id) => byId.get(id));
    const testing = fold.test_ids.map((id) => byId.get(id));
    if (training.some((row) => !row) || testing.some((row) => !row)) {
      throw new Error(`stateBenchmarkStage0: state-blind baseline fold ${fold.id} references an unknown row`);
    }
    const model = fitAdaptiveStateTrainingFoldClassPrior(training, { target, labels, contract });
    models.push({
      fold: fold.id,
      training_rows: model.training_rows,
      counts: clone(model.counts),
      probabilities: clone(model.probabilities),
      contract_sha256: model.contract_sha256,
    });
    classPriorPredictions.push(...predictAdaptiveStateTrainingFoldClassPrior(model, testing));
  }
  if (
    classPriorPredictions.length !== rows.length ||
    new Set(classPriorPredictions.map((row) => row.id)).size !== rows.length
  ) {
    throw new Error('stateBenchmarkStage0: state-blind baseline folds do not predict every row exactly once');
  }
  return {
    contract: clone(contract),
    contract_sha256: contractSha256,
    class_prior: { predictions: classPriorPredictions, folds: models },
    uniform: { predictions: predictAdaptiveStateUniformBaseline(rows, { target, labels, contract }) },
  };
}

function normalizedProbabilities(probabilities, labels) {
  const values = Object.fromEntries(labels.map((label) => [label, Math.max(0, Number(probabilities?.[label] || 0))]));
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) throw new Error('stateBenchmarkStage0: prediction has no probability mass');
  return Object.fromEntries(labels.map((label) => [label, values[label] / total]));
}

export function adaptiveStateStage0PredictionMetrics(predictions, labels) {
  if (!predictions.length) throw new Error('stateBenchmarkStage0: cannot score empty predictions');
  const normalized = predictions.map((row) => {
    const probabilities = normalizedProbabilities(row.probabilities, labels);
    const ranked = Object.entries(probabilities).sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    );
    return { ...row, probabilities, predicted: ranked[0][0], confidence: ranked[0][1] };
  });
  const logLoss = mean(
    normalized.map((row) => -Math.log(Math.max(1e-12, Number(row.probabilities[row.truth] || 0)))),
  );
  const brierScore = mean(
    normalized.map((row) =>
      labels.reduce(
        (sum, label) => sum + (row.probabilities[label] - (row.truth === label ? 1 : 0)) ** 2,
        0,
      ),
    ),
  );
  let ece = 0;
  for (let index = 0; index < 10; index += 1) {
    const low = index / 10;
    const high = (index + 1) / 10;
    const bin = normalized.filter(
      (row) => row.confidence >= low && (index === 9 ? row.confidence <= high : row.confidence < high),
    );
    if (!bin.length) continue;
    const accuracy = mean(bin.map((row) => (row.predicted === row.truth ? 1 : 0)));
    ece += (bin.length / normalized.length) * Math.abs(accuracy - mean(bin.map((row) => row.confidence)));
  }
  return { predictions: normalized.length, log_loss: logLoss, brier_score: brierScore, ece };
}

function laneAxis(laneId) {
  if (laneId === 'world_transfer') return 'world_id';
  if (laneId === 'generator_transfer') return 'generator_id';
  if (laneId === 'realizer_transfer') return 'realizer_id';
  throw new Error(`stateBenchmarkStage0: unsupported split lane ${laneId}`);
}

export function buildAdaptiveStateStage0SplitManifest(rows, config) {
  const lanes = config.analysis.split_lanes.map((lane) => {
    const axis = laneAxis(lane.id);
    const levels = stableSort(new Set(rows.map((row) => String(row.groups[axis]))));
    return {
      id: lane.id,
      method: lane.method,
      axis,
      folds: levels.map((level) => ({
        id: `${lane.id}=${level}`,
        level,
        train_ids: rows.filter((row) => String(row.groups[axis]) !== level).map((row) => row.id),
        test_ids: rows.filter((row) => String(row.groups[axis]) === level).map((row) => row.id),
      })),
    };
  });
  const manifest = {
    schema: ADAPTIVE_STATE_SPLIT_MANIFEST_V2_SCHEMA,
    version: config.version,
    stage: 's0_contract',
    confirmation_eligible: false,
    atomic_unit: 'dialogue_id',
    rows: rows.length,
    lanes,
  };
  manifest.content_sha256 = adaptiveStateStage0SplitManifestContentSha256(manifest);
  return manifest;
}

export function adaptiveStateStage0SplitManifestContentSha256(manifest) {
  const content = { ...manifest };
  delete content.content_sha256;
  return hashCanonicalJson(content);
}

export function validateAdaptiveStateStage0SplitManifestContentSha256(manifest) {
  if (manifest?.content_sha256 !== adaptiveStateStage0SplitManifestContentSha256(manifest)) {
    throw new Error('stateBenchmarkStage0: split-manifest content SHA-256 mismatch');
  }
  return true;
}

function scanForbidden(value, localIds, path = 'representation') {
  if (!value || typeof value !== 'object') return [];
  const failures = [];
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_NON_ORACLE_KEY.test(key)) failures.push(`${path}.${key}`);
    if (typeof child === 'string' && localIds.has(child)) failures.push(`${path}.${key}=world_local_id`);
    failures.push(...scanForbidden(child, localIds, `${path}.${key}`));
  }
  return failures;
}

export function auditAdaptiveStateStage0Dataset(dataset, plan, config) {
  const rows = dataset.rows || [];
  const dialogues = dataset.dialogues || [];
  const failures = [];
  const expectedRepresentations = new Set(plan.representations);
  if (dialogues.length !== plan.counts.dialogue_jobs) failures.push('dialogue_count_mismatch');
  if (rows.length !== plan.counts.scored_transitions) failures.push('transition_count_mismatch');
  if (dataset.model_call_count !== 0) failures.push('nonzero_model_calls');
  const cellCounts = new Map();
  for (const dialogue of dialogues) {
    cellCounts.set(dialogue.cell_id, (cellCounts.get(dialogue.cell_id) || 0) + 1);
    if (dialogue.observations?.length !== dialogue.learner_turns + 1) failures.push('bootstrap_observation_missing');
    if (dialogue.observations?.[0]?.turn !== 0) failures.push('bootstrap_turn_not_zero');
  }
  if (
    cellCounts.size !== plan.counts.crossed_cells ||
    [...cellCounts.values()].some((count) => count !== plan.counts.seeds_per_cell)
  ) {
    failures.push('crossed_matrix_incomplete');
  }
  const dialogueById = new Map(dialogues.map((row) => [row.id, row]));
  let donorSameDialogueCount = 0;
  let donorSeedMatchCount = 0;
  let donorStratumMismatchCount = 0;
  let staleTurnMismatchCount = 0;
  let commonMismatchCount = 0;
  const leakagePaths = [];
  const localIds = new Set(dataset.world_local_fact_ids || []);
  for (const row of rows) {
    const names = Object.keys(row.representations || {});
    if (names.length !== expectedRepresentations.size || names.some((name) => !expectedRepresentations.has(name))) {
      failures.push('representation_set_incomplete');
    }
    const common = JSON.stringify(row.representations?.no_state?.common);
    for (const representation of Object.values(row.representations || {})) {
      if (JSON.stringify(representation.common) !== common) commonMismatchCount += 1;
    }
    for (const [name, representation] of Object.entries(row.representations || {})) {
      if (name === 'oracle') continue;
      leakagePaths.push(...scanForbidden(representation, localIds, `${row.id}.${name}`));
    }
    const donorId = row.controls?.scramble_donor_dialogue_id;
    const donor = dialogueById.get(donorId);
    if (!donor) {
      donorStratumMismatchCount += 1;
    } else {
      if (donorId === row.groups.dialogue_id) donorSameDialogueCount += 1;
      if (Number(donor.seed) === Number(row.groups.seed)) donorSeedMatchCount += 1;
      if (
        donor.world_id !== row.groups.world_id ||
        donor.generator_id !== row.groups.generator_id ||
        donor.realizer_id !== row.groups.realizer_id ||
        donor.action_schedule[row.turn - 1] !== row.action.id
      ) {
        donorStratumMismatchCount += 1;
      }
    }
    if (Number(row.controls?.stale_observation_turn) !== Number(row.turn) - 1) staleTurnMismatchCount += 1;
  }
  if (donorSameDialogueCount) failures.push('scramble_donor_same_dialogue');
  if (donorSeedMatchCount) failures.push('scramble_donor_same_seed');
  if (donorStratumMismatchCount) failures.push('scramble_donor_stratum_mismatch');
  if (staleTurnMismatchCount) failures.push('stale_control_turn_mismatch');
  if (commonMismatchCount) failures.push('representation_common_input_mismatch');
  if (leakagePaths.length) failures.push('non_oracle_leakage');
  const degeneracy = [];
  for (const generator of plan.axes.latent_generators) {
    const subset = rows.filter((row) => row.groups.generator_id === generator);
    for (const target of plan.co_primary_targets) {
      const labels = stableSort(new Set(subset.map((row) => row.targets[target])));
      if (labels.length < 2) degeneracy.push({ generator, target, labels });
    }
  }
  if (degeneracy.length) failures.push('target_degenerate_within_generator');
  const targetContracts = config.targets.co_primary.map((target) => ({
    id: target.id,
    labels: [...target.labels],
    owner: target.owner,
  }));
  if (
    hashCanonicalJson(targetContracts) !== hashCanonicalJson(EXPECTED_TARGET_CONTRACTS) ||
    hashCanonicalJson(targetContracts.map((target) => target.id)) !==
      hashCanonicalJson(plan.co_primary_targets) ||
    rows.some((row) =>
      targetContracts.some((target) => !target.labels.includes(String(row.targets?.[target.id]))),
    )
  ) {
    failures.push('target_contract_mismatch');
  }
  const pairedTargetDrift = [];
  const byLatentPair = new Map();
  for (const row of rows) {
    const key = row.groups.latent_pair_id;
    const values = byLatentPair.get(key) || [];
    values.push(row);
    byLatentPair.set(key, values);
  }
  for (const [pairId, pairRows] of byLatentPair) {
    const byRealizer = new Map();
    for (const row of pairRows) {
      const values = byRealizer.get(row.groups.realizer_id) || [];
      values.push(row);
      byRealizer.set(row.groups.realizer_id, values);
    }
    const signatures = new Set(
      [...byRealizer.values()].map((values) =>
        hashCanonicalJson(
          values
            .sort((left, right) => left.turn - right.turn)
            .map((row) => ({ turn: row.turn, targets: row.targets })),
        ),
      ),
    );
    if (byRealizer.size !== plan.axes.realizers.length || signatures.size !== 1) pairedTargetDrift.push(pairId);
  }
  if (pairedTargetDrift.length) failures.push('realizer_changed_latent_target');
  return {
    passed: failures.length === 0,
    failures: [...new Set(failures)],
    matrix: { crossed_cells: cellCounts.size, dialogues: dialogues.length, transitions: rows.length },
    controls: {
      donor_same_dialogue_count: donorSameDialogueCount,
      donor_same_seed_count: donorSeedMatchCount,
      donor_stratum_mismatch_count: donorStratumMismatchCount,
      stale_turn_mismatch_count: staleTurnMismatchCount,
      common_input_mismatch_count: commonMismatchCount,
    },
    leakage: { count: leakagePaths.length, paths: leakagePaths.slice(0, 20) },
    target_degeneracy: degeneracy,
    target_contracts: targetContracts,
    paired_realizer_target_drift: pairedTargetDrift,
  };
}

function outOfFoldNoStatePredictions(rows, splitManifest, target, config) {
  const lane = splitManifest.lanes.find((row) => row.id === 'world_transfer');
  const byId = new Map(rows.map((row) => [row.id, row]));
  const predictions = [];
  const models = [];
  for (const fold of lane.folds) {
    const training = fold.train_ids.map((id) => byId.get(id));
    const testing = fold.test_ids.map((id) => byId.get(id));
    const model = fitAdaptiveStateStage0Head(training, {
      representation: 'no_state',
      target,
      labels: TARGET_LABELS[target],
      lambda: config.analysis.fixed_head_contract.regularization.lambda,
      regularizationScaling: config.analysis.fixed_head_contract.regularization.scaling,
      learningRate: config.analysis.fixed_head_contract.solver.learning_rate,
      maximumIterations: config.analysis.fixed_head_contract.solver.maximum_iterations,
      convergenceTolerance: config.analysis.fixed_head_contract.solver.convergence_tolerance,
      convergenceCriterion: config.analysis.fixed_head_contract.solver.convergence_criterion,
      probabilityClip: config.analysis.fixed_head_contract.probability_clip,
    });
    models.push({ fold: fold.id, converged: model.converged, iterations: model.iterations });
    predictions.push(...predictAdaptiveStateStage0Head(model, testing));
  }
  return { predictions, models };
}

function oraclePredictions(rows, target) {
  return rows.map((row) => ({
    id: row.id,
    dialogue_id: row.groups.dialogue_id,
    truth: String(row.targets[target]),
    probabilities: clone(row.representations.oracle.additional_state.distributions[target]),
  }));
}

function stage0ReportContent(report) {
  const content = { ...report };
  delete content.content_sha256;
  return content;
}

export function adaptiveStateStage0ReportContentSha256(report) {
  return hashCanonicalJson(stage0ReportContent(report));
}

export function validateAdaptiveStateStage0ReportContentSha256(report) {
  if (report?.content_sha256 !== adaptiveStateStage0ReportContentSha256(report)) {
    throw new Error('stateBenchmarkStage0: report content SHA-256 mismatch');
  }
  if (
    report.schema !== ADAPTIVE_STATE_STAGE0_REPORT_V2_SCHEMA ||
    report.stage !== 's0_contract' ||
    report.confirmation_eligible !== false ||
    report.s2_validity_verdict !== null ||
    report.protocol?.gate_eligible !== false ||
    hashCanonicalJson(report.protocol?.target_contracts) !== hashCanonicalJson(EXPECTED_TARGET_CONTRACTS)
  ) {
    throw new Error('stateBenchmarkStage0: report contract differs from the frozen non-confirmatory protocol');
  }
  return true;
}

export function buildAdaptiveStateStage0Report({ dataset, plan, config, splitManifest, replay }) {
  const audit = auditAdaptiveStateStage0Dataset(dataset, plan, config);
  const instrument = {};
  const baselineContract = config.analysis.state_blind_baseline_contract;
  const baselineContractSha256 = adaptiveStateStateBlindBaselineContractSha256(baselineContract);
  const baselineSanity = {
    passed: true,
    contract: clone(baselineContract),
    contract_sha256: baselineContractSha256,
    targets: {},
  };
  let oraclePass = true;
  let allHeadsConverged = true;
  for (const target of plan.co_primary_targets) {
    const labels = TARGET_LABELS[target];
    const baseline = outOfFoldNoStatePredictions(dataset.rows, splitManifest, target, config);
    const stateBlind = buildAdaptiveStateOutOfFoldStateBlindBaselines(dataset.rows, splitManifest, {
      target,
      labels,
      contract: baselineContract,
    });
    const noStateMetrics = adaptiveStateStage0PredictionMetrics(baseline.predictions, labels);
    const classPriorMetrics = adaptiveStateStage0PredictionMetrics(stateBlind.class_prior.predictions, labels);
    const uniformMetrics = adaptiveStateStage0PredictionMetrics(stateBlind.uniform.predictions, labels);
    const oracleMetrics = adaptiveStateStage0PredictionMetrics(oraclePredictions(dataset.rows, target), labels);
    const stateBlindMetrics = {
      no_state: noStateMetrics,
      class_prior: classPriorMetrics,
      uniform: uniformMetrics,
    };
    const beats = Object.fromEntries(
      Object.entries(stateBlindMetrics).map(([id, metrics]) => [
        id,
        oracleMetrics.log_loss < metrics.log_loss && oracleMetrics.brier_score < metrics.brier_score,
      ]),
    );
    const beatsAll = Object.values(beats).every(Boolean);
    allHeadsConverged &&= baseline.models.every((row) => row.converged);
    oraclePass &&= beatsAll;
    const expectedUniform = 1 / labels.length;
    const sanityPassed =
      stateBlind.class_prior.folds.every(
        (fold) =>
          Object.values(fold.probabilities).every((probability) => Number(probability) > 0) &&
          Math.abs(Object.values(fold.probabilities).reduce((sum, value) => sum + value, 0) - 1) < 1e-12,
      ) &&
      stateBlind.uniform.predictions.every((prediction) =>
        labels.every((label) => prediction.probabilities[label] === expectedUniform),
      );
    baselineSanity.passed &&= sanityPassed;
    baselineSanity.targets[target] = {
      passed: sanityPassed,
      class_prior_folds: clone(stateBlind.class_prior.folds),
      uniform_probability: expectedUniform,
      no_test_frequency_access: true,
    };
    instrument[target] = {
      oracle: oracleMetrics,
      no_state: noStateMetrics,
      class_prior: classPriorMetrics,
      uniform: uniformMetrics,
      delta_state_blind_minus_oracle: Object.fromEntries(
        Object.entries(stateBlindMetrics).map(([id, metrics]) => [
          id,
          {
            log_loss: metrics.log_loss - oracleMetrics.log_loss,
            brier_score: metrics.brier_score - oracleMetrics.brier_score,
          },
        ]),
      ),
      oracle_beats_each_state_blind_baseline_on_both_metrics: beats,
      oracle_beats_all_state_blind_baselines_on_both_metrics: beatsAll,
      // Compatibility diagnostic retained for existing S0 readers.
      oracle_beats_no_state_on_both_metrics: beats.no_state,
      no_state_folds: baseline.models,
      class_prior_folds: clone(stateBlind.class_prior.folds),
    };
  }
  const replayPassed = replay?.passed === true;
  const stopReasons = [...audit.failures];
  if (!allHeadsConverged) stopReasons.push('fixed_head_nonconvergence');
  if (!baselineSanity.passed) stopReasons.push('state_blind_baseline_sanity_failure');
  if (!oraclePass) stopReasons.push('oracle_fails_to_beat_all_state_blind_baselines_on_both_primary_targets');
  if (!replayPassed) stopReasons.push('deterministic_replay_failure');
  const passed = stopReasons.length === 0;
  const report = {
    schema: ADAPTIVE_STATE_STAGE0_REPORT_V2_SCHEMA,
    version: config.version,
    stage: 's0_contract',
    status: passed ? 'pass' : 'stop',
    confirmation_eligible: false,
    s2_validity_verdict: null,
    decision: passed ? 'advance_to_s1_technical_pilot' : 'stop_and_repair_contract',
    claim_boundary: config.claim_boundary,
    provenance: {
      design_sha256: plan.design_sha256,
      dataset_sha256: dataset.content_sha256,
      split_manifest_sha256: splitManifest.content_sha256,
    },
    coverage: {
      worlds: [...plan.axes.worlds],
      latent_generators: [...plan.axes.latent_generators],
      deterministic_realizers: [...plan.axes.realizers],
      crossed_cells: plan.counts.crossed_cells,
      seeds_per_cell: plan.counts.seeds_per_cell,
      dialogues: dataset.dialogues.length,
      scored_transitions: dataset.rows.length,
      model_calls: dataset.model_call_count,
      deterministic_realizer_calls: dataset.deterministic_realizer_call_count,
    },
    protocol: {
      fixed_head: {
        id: config.analysis.fixed_head,
        ...clone(config.analysis.fixed_head_contract),
        regularization_scaling: config.analysis.fixed_head_contract.regularization.scaling,
        all_folds_converged: allHeadsConverged,
      },
      state_blind_baselines: {
        ids: ['no_state', 'class_prior', 'uniform'],
        contract: clone(baselineContract),
        contract_sha256: baselineContractSha256,
        no_test_time_baseline_selection: true,
      },
      target_contracts: config.targets.co_primary.map((target) => ({
        id: target.id,
        labels: [...target.labels],
        owner: target.owner,
      })),
      primary_lane: 'world_transfer',
      uncertainty_applied: false,
      gate_eligible: false,
      note: 'S0 exercises deterministic generation, splits, the fixed head, oracle alignment, and controls only.',
    },
    structural_audit: audit,
    deterministic_replay: clone(replay),
    baseline_sanity: baselineSanity,
    instrument,
    stop_reasons: [...new Set(stopReasons)],
  };
  report.content_sha256 = adaptiveStateStage0ReportContentSha256(report);
  return report;
}
