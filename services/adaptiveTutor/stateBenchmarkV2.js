import { createHash } from 'node:crypto';
import { adaptiveStateValidityV2Contract } from './stateValidityMetricsV2.js';

export const ADAPTIVE_STATE_BENCHMARK_V2_SCHEMA = 'machinespirits.adaptive-state-benchmark-config.v2';
export const ADAPTIVE_STATE_CRITICAL_PATH_PLAN_SCHEMA = 'machinespirits.adaptive-state-critical-path-plan.v2';
export const ADAPTIVE_STATE_ORACLE_V2_SCHEMA = 'machinespirits.adaptive-state-oracle.v2';
export const ADAPTIVE_STATE_PROOF_TRANSITION_V2_SCHEMA = 'machinespirits.adaptive-state-proof-transition.v2';

const STAGES = new Set(['s0_contract', 's1_technical_pilot', 's2_confirmation']);
const CONFIRMATION_SIZES = new Set([6, 8]);
const PRIMARY_TARGETS = Object.freeze(['next_dag_event_family', 'next_proof_trajectory']);
const REQUIRED_REPRESENTATIONS = Object.freeze([
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

function stableHash(value) {
  const sort = (current) => {
    if (Array.isArray(current)) return current.map(sort);
    if (!current || typeof current !== 'object') return current;
    return Object.fromEntries(
      Object.keys(current)
        .sort()
        .map((key) => [key, sort(current[key])]),
    );
  };
  return createHash('sha256')
    .update(JSON.stringify(sort(value)))
    .digest('hex');
}

function requireArray(value, label, minimum = 1) {
  if (!Array.isArray(value) || value.length < minimum) {
    throw new Error(`stateBenchmarkV2: ${label} must contain at least ${minimum} item(s)`);
  }
  return value;
}

function requireUniqueIds(rows, label, expectedCount = null) {
  requireArray(rows, label, expectedCount || 1);
  const ids = rows.map((row) => String(row?.id || ''));
  if (ids.some((id) => !id)) throw new Error(`stateBenchmarkV2: ${label} contains a missing id`);
  if (new Set(ids).size !== ids.length) throw new Error(`stateBenchmarkV2: ${label} ids must be unique`);
  if (expectedCount !== null && ids.length !== expectedCount) {
    throw new Error(`stateBenchmarkV2: ${label} must contain exactly ${expectedCount} items`);
  }
  return ids;
}

function representationIds(config) {
  const representations = config.representations || {};
  return [
    ...(representations.nested_candidates || []),
    ...(representations.matched_controls || []),
    ...(representations.upper_bound_only || []),
  ];
}

function jsonClone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function eventKindCounts(observation) {
  const counts = { adopt: 0, derive: 0, retract: 0, other: 0 };
  for (const event of observation?.accepted_events || []) {
    const kind = ['adopt', 'derive', 'retract'].includes(event?.kind) ? event.kind : 'other';
    counts[kind] += 1;
  }
  return counts;
}

function noStateFeatures(observation, task) {
  return {
    turn: Number(observation?.turn || 0),
    task: {
      knowledge_component: task?.knowledge_component || task?.knowledgeComponent || 'unknown',
      prerequisite_count: (task?.prerequisite_path || task?.prerequisitePath || []).length,
      item_difficulty: Number(task?.item_difficulty ?? task?.itemDifficulty ?? 0.5),
      item_discrimination: Number(task?.item_discrimination ?? task?.itemDiscrimination ?? 1),
    },
  };
}

function leanDagFeatures(observation, task) {
  const dag = observation?.dag || {};
  return {
    ...noStateFeatures(observation, task),
    dag: {
      status: dag.status || null,
      bottleneck_family: dag.bottleneck || 'unknown',
      best_path_coverage: Number(dag.best_path_coverage || 0),
      missing_premise_count: Number(dag.missing_premise_count || 0),
      grounded_count: Number(dag.grounded_count || 0),
      voiced_derived_count: Number(dag.voiced_derived_count || 0),
      unsupported_assertion_count: Number(dag.unsupported_assertion_count || 0),
      final_secret_entailed: dag.final_secret_entailed === true,
      asserted_secret: dag.asserted_secret === true,
      asserted_mirror: dag.asserted_mirror === true,
      event_kind_counts: eventKindCounts(observation),
      missingness: jsonClone(dag.missingness || {}),
    },
  };
}

function dagTrajectoryFeatures(observation, task) {
  const projection = observation?.runtime_field_trajectory || {};
  const trajectory = projection.trajectory || {};
  return {
    ...leanDagFeatures(observation, task),
    trajectory: {
      schema: trajectory.schema || null,
      window: trajectory.window ?? null,
      point_count: trajectory.pointCount ?? null,
      points: (trajectory.points || []).map((point) => ({
        turn: point.turn,
        dag_score: point.dagScore,
        risk_score: point.riskScore,
        bottleneck_family: point.bottleneck,
      })),
      dag: jsonClone(trajectory.dag || {}),
      risk: jsonClone(trajectory.risk || {}),
      flags: Object.fromEntries(
        Object.entries(trajectory.flags || {}).filter(([key]) =>
          ['riskRising', 'dagOnlyDrift', 'nearClosure'].includes(key),
        ),
      ),
    },
  };
}

function fieldTrajectoryFeatures(observation, task) {
  const projection = observation?.runtime_field_trajectory || {};
  const trajectory = projection.trajectory || {};
  return {
    ...dagTrajectoryFeatures(observation, task),
    field: jsonClone(projection.features?.field || {}),
    public_classifier_labels: {
      request_type: projection.features?.requestType || 'unknown',
      discourse_move: projection.features?.discourseMove || 'unknown',
      evidence_use: projection.features?.evidenceUse || 'unknown',
      epistemic_stance: projection.features?.epistemicStance || 'unknown',
      agency: projection.features?.agency || 'unknown',
      affect: projection.features?.affect || 'unknown',
    },
    trajectory: {
      ...dagTrajectoryFeatures(observation, task).trajectory,
      points: (trajectory.points || []).map((point) => ({ ...point })),
      field: jsonClone(trajectory.field || {}),
      flags: jsonClone(trajectory.flags || {}),
    },
  };
}

function stripCommon(features) {
  const { turn: _turn, task: _task, ...additionalState } = features;
  return additionalState;
}

function wrappedRepresentation(common, additionalState) {
  return {
    common: jsonClone(common),
    additional_state: jsonClone(additionalState),
  };
}

function validateProbabilityDistribution(distribution, labels, name) {
  if (!distribution || typeof distribution !== 'object' || Array.isArray(distribution)) {
    throw new Error(`stateBenchmarkV2: oracle ${name} distribution is required`);
  }
  if (JSON.stringify(Object.keys(distribution).sort()) !== JSON.stringify([...labels].sort())) {
    throw new Error(`stateBenchmarkV2: oracle ${name} distribution must contain exactly ${labels.join(', ')}`);
  }
  const probabilities = Object.values(distribution).map(Number);
  if (probabilities.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new Error(`stateBenchmarkV2: oracle ${name} probabilities must be finite values in [0, 1]`);
  }
  const total = probabilities.reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 1) > 1e-9) {
    throw new Error(`stateBenchmarkV2: oracle ${name} probabilities must sum to one`);
  }
}

export function validateAdaptiveStateOracleV2(oracle, { predictionTurn = null, benchmarkStratum = null } = {}) {
  if (oracle?.schema !== ADAPTIVE_STATE_ORACLE_V2_SCHEMA) {
    throw new Error(`stateBenchmarkV2: oracle schema must be ${ADAPTIVE_STATE_ORACLE_V2_SCHEMA}`);
  }
  const allowedKeys = new Set(['schema', 'prediction_origin', 'kernel_provenance', 'distributions']);
  const unknownKeys = Object.keys(oracle).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length) throw new Error(`stateBenchmarkV2: oracle contains forbidden keys ${unknownKeys.join(', ')}`);
  if (oracle.prediction_origin?.phase !== 'before_transition_sampling') {
    throw new Error('stateBenchmarkV2: oracle must be captured before transition sampling');
  }
  if (predictionTurn !== null && Number(oracle.prediction_origin?.turn) !== Number(predictionTurn)) {
    throw new Error('stateBenchmarkV2: oracle prediction turn does not match the public observation');
  }
  const provenance = oracle.kernel_provenance || {};
  if (!provenance.generator_id || !provenance.action_id || !Number.isSafeInteger(Number(provenance.seed))) {
    throw new Error('stateBenchmarkV2: oracle requires generator, action, and safe-integer seed provenance');
  }
  if (!/^[0-9a-f]{64}$/u.test(String(provenance.transition_kernel_sha256 || ''))) {
    throw new Error('stateBenchmarkV2: oracle requires a transition-kernel SHA-256');
  }
  if (
    benchmarkStratum &&
    (provenance.generator_id !== benchmarkStratum.generator_id || provenance.action_id !== benchmarkStratum.action_id)
  ) {
    throw new Error('stateBenchmarkV2: oracle generator/action provenance does not match the public stratum');
  }
  validateProbabilityDistribution(
    oracle.distributions?.next_dag_event_family,
    ['retract', 'derive', 'adopt', 'none'],
    'next_dag_event_family',
  );
  validateProbabilityDistribution(
    oracle.distributions?.next_proof_trajectory,
    ['advance', 'regress', 'stall'],
    'next_proof_trajectory',
  );
  return true;
}

function assertMatchedDonor(recipient, donor, label) {
  if (!donor) throw new Error(`stateBenchmarkV2: ${label} matched cross-dialogue donor is required`);
  if (Number(donor.turn) !== Number(recipient.turn)) {
    throw new Error(`stateBenchmarkV2: ${label} donor must be aligned to the recipient turn`);
  }
  const recipientDialogue = recipient.provenance?.source_dialogue_id;
  const donorDialogue = donor.provenance?.source_dialogue_id;
  if (!recipientDialogue || !donorDialogue || recipientDialogue === donorDialogue) {
    throw new Error(`stateBenchmarkV2: ${label} donor must come from a different dialogue`);
  }
  const recipientStratum = recipient.provenance?.benchmark_stratum;
  const donorStratum = donor.provenance?.benchmark_stratum;
  if (!recipientStratum || !donorStratum || stableHash(recipientStratum) !== stableHash(donorStratum)) {
    throw new Error(`stateBenchmarkV2: ${label} donor must match world, generator, action, and turn stratum`);
  }
}

/**
 * Build the v2 nested sensor ladder from the exact projection stored by the
 * live tutor. The caller supplies matched cross-dialogue donors; this module
 * never manufactures an in-dialogue "shuffle" that could preserve identity.
 * Tutor action is intentionally absent because it is a common prediction-head
 * input, not part of any representation.
 */
export function buildAdaptiveStateRepresentationsV2({
  observation,
  task,
  previousObservation = null,
  matchedDagDonorObservation = null,
  matchedFieldDonorObservation = null,
  oracleState = null,
} = {}) {
  if (!observation?.runtime_field_trajectory) {
    throw new Error('stateBenchmarkV2: observation is missing the shared runtime field/trajectory projection');
  }
  if (
    !previousObservation ||
    Number(previousObservation.turn) !== Number(observation.turn) - 1 ||
    previousObservation.provenance?.source_dialogue_id !== observation.provenance?.source_dialogue_id
  ) {
    throw new Error('stateBenchmarkV2: the immediately prior same-dialogue public observation is required');
  }
  assertMatchedDonor(observation, matchedDagDonorObservation, 'DAG scramble');
  assertMatchedDonor(observation, matchedFieldDonorObservation, 'field scramble');
  const common = noStateFeatures(observation, task);
  const representations = {
    no_state: { common: jsonClone(common) },
    lean_dag: wrappedRepresentation(common, stripCommon(leanDagFeatures(observation, task))),
    dag_trajectory: wrappedRepresentation(common, stripCommon(dagTrajectoryFeatures(observation, task))),
    field_trajectory: wrappedRepresentation(common, stripCommon(fieldTrajectoryFeatures(observation, task))),
    dag_scramble: wrappedRepresentation(common, stripCommon(dagTrajectoryFeatures(matchedDagDonorObservation, task))),
    dag_stale: wrappedRepresentation(common, stripCommon(dagTrajectoryFeatures(previousObservation, task))),
    field_scramble: wrappedRepresentation(
      common,
      stripCommon(fieldTrajectoryFeatures(matchedFieldDonorObservation, task)),
    ),
    field_stale: wrappedRepresentation(common, stripCommon(fieldTrajectoryFeatures(previousObservation, task))),
  };
  if (oracleState !== null) {
    validateAdaptiveStateOracleV2(oracleState, {
      predictionTurn: observation.turn,
      benchmarkStratum: observation.provenance?.benchmark_stratum || null,
    });
    representations.oracle = wrappedRepresentation(common, oracleState);
  }
  return representations;
}

export function nextDagEventFamily(observation) {
  const kinds = new Set((observation?.accepted_events || []).map((event) => event?.kind));
  if (kinds.has('retract')) return 'retract';
  if (kinds.has('derive')) return 'derive';
  if (kinds.has('adopt')) return 'adopt';
  return 'none';
}

export function buildAdaptiveStateTargetsV2({ currentObservation, nextObservation, proofTransition } = {}) {
  if (proofTransition?.schema !== ADAPTIVE_STATE_PROOF_TRANSITION_V2_SCHEMA) {
    throw new Error(`stateBenchmarkV2: proof transition schema must be ${ADAPTIVE_STATE_PROOF_TRANSITION_V2_SCHEMA}`);
  }
  const denominator = Number(proofTransition.normalization_denominator);
  if (!(denominator > 0))
    throw new Error('stateBenchmarkV2: proof-distance normalization denominator must be positive');
  const currentTurn = Number(currentObservation?.turn);
  const nextTurn = Number(nextObservation?.turn);
  if (
    !Number.isInteger(currentTurn) ||
    !Number.isInteger(nextTurn) ||
    nextTurn !== currentTurn + 1 ||
    Number(proofTransition.current?.turn) !== currentTurn ||
    Number(proofTransition.next?.turn) !== nextTurn
  ) {
    throw new Error('stateBenchmarkV2: proof transition must bind adjacent public observations');
  }
  const currentRawDistance = Number(proofTransition.current?.raw_distance);
  const futureRawDistance = Number(proofTransition.next?.raw_distance);
  const currentDebt = Number(proofTransition.current?.harmful_proof_debt);
  const futureDebt = Number(proofTransition.next?.harmful_proof_debt);
  if (
    !Number.isFinite(currentRawDistance) ||
    !Number.isFinite(futureRawDistance) ||
    !Number.isFinite(currentDebt) ||
    !Number.isFinite(futureDebt)
  ) {
    throw new Error('stateBenchmarkV2: proof transition distances and harmful debt must be finite');
  }
  const provenance = proofTransition.provenance || {};
  if (!provenance.world_id || !provenance.adapter_version || !/^[0-9a-f]{64}$/u.test(String(provenance.world_sha256))) {
    throw new Error('stateBenchmarkV2: proof transition requires a versioned world adapter and world hash');
  }
  const currentWorld = currentObservation.provenance?.benchmark_stratum?.world_id;
  const nextWorld = nextObservation.provenance?.benchmark_stratum?.world_id;
  if (!currentWorld || currentWorld !== nextWorld || provenance.world_id !== currentWorld) {
    throw new Error('stateBenchmarkV2: proof transition world provenance does not match the public observations');
  }
  const currentDistance = currentRawDistance / denominator;
  const futureDistance = futureRawDistance / denominator;
  const nextProofTrajectory =
    futureDistance > currentDistance || futureDebt > currentDebt
      ? 'regress'
      : futureDistance < currentDistance
        ? 'advance'
        : 'stall';
  return {
    next_dag_event_family: nextDagEventFamily(nextObservation),
    next_proof_trajectory: nextProofTrajectory,
  };
}

export function validateAdaptiveStateBenchmarkV2Config(config) {
  if (config?.schema !== ADAPTIVE_STATE_BENCHMARK_V2_SCHEMA) {
    throw new Error(`stateBenchmarkV2: expected schema ${ADAPTIVE_STATE_BENCHMARK_V2_SCHEMA}`);
  }
  const critical = config.critical_path || {};
  requireUniqueIds(critical.worlds, 'critical_path.worlds', 3);
  if (
    critical.worlds.some(
      (world) => !String(world.source || '').startsWith('config/drama-derivation/') || !world.geometry,
    ) ||
    new Set(critical.worlds.map((world) => world.source)).size !== critical.worlds.length
  ) {
    throw new Error('stateBenchmarkV2: worlds require distinct frozen derivation sources and declared geometries');
  }
  requireUniqueIds(critical.latent_generators, 'critical_path.latent_generators', 2);
  if (
    critical.latent_generators.some(
      (generator) =>
        !String(generator.source || '').startsWith('services/') ||
        generator.contract !== 'world_generalized_transition_kernel',
    ) ||
    new Set(critical.latent_generators.map((generator) => generator.source)).size !== critical.latent_generators.length
  ) {
    throw new Error(
      'stateBenchmarkV2: latent generators require distinct implementation sources and generalized contracts',
    );
  }
  const realizerIds = requireUniqueIds(critical.language_realizers, 'critical_path.language_realizers', 2);
  requireUniqueIds(critical.deterministic_realizers, 'critical_path.deterministic_realizers', 2);
  const families = critical.language_realizers.map((row) => String(row.model_family || ''));
  if (families.some((family) => !family) || new Set(families).size !== families.length) {
    throw new Error('stateBenchmarkV2: language realizers must come from distinct declared model families');
  }
  if (new Set(realizerIds).size !== realizerIds.length) {
    throw new Error('stateBenchmarkV2: language realizer ids must be independent');
  }
  if (
    new Set(critical.language_realizers.map((row) => row.model_ref)).size !== critical.language_realizers.length ||
    critical.language_realizers.some((row) => !/^[a-z0-9-]+\.[a-z0-9.-]+$/u.test(String(row.model_ref || '')))
  ) {
    throw new Error('stateBenchmarkV2: language realizers require distinct resolvable provider.model references');
  }
  if (
    config.realizer_contract?.calls !== 'one_turn_per_call' ||
    config.realizer_contract?.contract_failure !== 'technical_failure_no_semantic_reroll' ||
    config.realizer_contract?.output_schema?.additional_properties !== false
  ) {
    throw new Error('stateBenchmarkV2: sequential learner-realizer JSON contract is incomplete');
  }
  const schedule = requireArray(critical.action_schedule, 'critical_path.action_schedule', 1);
  const dialogue = critical.dialogue || {};
  if (Number(dialogue.scored_transitions) !== schedule.length) {
    throw new Error('stateBenchmarkV2: action schedule length must equal scored transitions');
  }
  if (Number(dialogue.learner_turns) !== Number(dialogue.scored_transitions) + 1) {
    throw new Error('stateBenchmarkV2: learner turns must equal scored transitions plus one');
  }
  if (Number(dialogue.bootstrap_public_observations) !== 1) {
    throw new Error('stateBenchmarkV2: exactly one unscored bootstrap public observation is required');
  }
  if (dialogue.one_realizer_call_per_turn !== true || dialogue.future_state_hidden_from_realizer !== true) {
    throw new Error('stateBenchmarkV2: sequential no-future realizer contract must be enabled');
  }
  const presentRepresentations = new Set(representationIds(config));
  for (const id of REQUIRED_REPRESENTATIONS) {
    if (!presentRepresentations.has(id)) throw new Error(`stateBenchmarkV2: missing representation ${id}`);
  }
  const targets = requireUniqueIds(config.targets?.co_primary, 'targets.co_primary', 2);
  if (JSON.stringify(targets) !== JSON.stringify(PRIMARY_TARGETS)) {
    throw new Error(`stateBenchmarkV2: co-primary targets must be ${PRIMARY_TARGETS.join(', ')}`);
  }
  const lanes = requireUniqueIds(config.analysis?.split_lanes, 'analysis.split_lanes', 3);
  for (const id of ['world_transfer', 'generator_transfer', 'realizer_transfer']) {
    if (!lanes.includes(id)) throw new Error(`stateBenchmarkV2: missing split lane ${id}`);
  }
  if (config.complexity_cap?.no_policy_sweep !== true || config.complexity_cap?.no_judge_model_sweep !== true) {
    throw new Error('stateBenchmarkV2: policy and judge sweeps must remain disabled on the critical path');
  }
  const confirmationOptions = config.stages?.s2_confirmation?.seeds_per_cell_options || [];
  if (JSON.stringify(confirmationOptions) !== JSON.stringify([6, 8])) {
    throw new Error('stateBenchmarkV2: confirmation sizes must remain frozen to 6 or 8 per crossed cell');
  }
  adaptiveStateValidityV2Contract(config);
  return true;
}

function stageContract(config, stage, confirmationPerCell) {
  if (!STAGES.has(stage)) throw new Error(`stateBenchmarkV2: unknown stage ${JSON.stringify(stage)}`);
  const contract = config.stages[stage];
  if (stage === 's2_confirmation') {
    const requested = Number(confirmationPerCell);
    if (!CONFIRMATION_SIZES.has(requested)) {
      throw new Error('stateBenchmarkV2: confirmation requires --per-cell 6 or 8 after the frozen power check');
    }
    return { ...contract, seedsPerCell: requested, realizerKey: 'language_realizers' };
  }
  return {
    ...contract,
    seedsPerCell: Number(contract.seeds_per_cell),
    realizerKey: String(contract.realizers || ''),
  };
}

function stageSeed(stage, cellIndex, repetition) {
  const base = stage === 's0_contract' ? 1 : stage === 's1_technical_pilot' ? 101 : 1001;
  return base + cellIndex * 100 + repetition;
}

function rotateSchedule(schedule, offset) {
  const shift = ((offset % schedule.length) + schedule.length) % schedule.length;
  return [...schedule.slice(shift), ...schedule.slice(0, shift)];
}

export function buildAdaptiveStateCriticalPathPlan(
  config,
  { stage = 's0_contract', confirmationPerCell = null, label = null } = {},
) {
  validateAdaptiveStateBenchmarkV2Config(config);
  const contract = stageContract(config, stage, confirmationPerCell);
  const critical = config.critical_path;
  const realizers = critical[contract.realizerKey];
  if (!Array.isArray(realizers)) {
    throw new Error(`stateBenchmarkV2: stage ${stage} names unknown realizer set ${contract.realizerKey}`);
  }
  const jobs = [];
  let latentPairIndex = 0;
  for (const world of critical.worlds) {
    for (const generator of critical.latent_generators) {
      for (const realizer of realizers) {
        const cellId = `${world.id}__${generator.id}__${realizer.id}`;
        for (let repetition = 1; repetition <= contract.seedsPerCell; repetition += 1) {
          // The realizer is a surface-only axis. Give both realizers the same
          // latent seed and action order for a world x generator x repetition
          // pair so a realizer can never change the harness-owned target.
          const seed = stageSeed(stage, latentPairIndex, repetition);
          jobs.push({
            id: `${stage}__${cellId}__r${repetition}`,
            stage,
            cell_id: cellId,
            latent_pair_id: `${stage}__${world.id}__${generator.id}__r${repetition}`,
            world: { ...world },
            latent_generator: { ...generator },
            language_realizer: { ...realizer },
            repetition,
            seed,
            // Keep actions fixed within the world x generator donor stratum.
            // Scramble controls can then use a different-seed dialogue at the
            // same turn/action instead of the state-identical paired realizer.
            action_schedule: rotateSchedule(critical.action_schedule, latentPairIndex),
            bootstrap_public_observations: Number(critical.dialogue.bootstrap_public_observations),
            learner_turns: Number(critical.dialogue.learner_turns),
            scored_transitions: Number(critical.dialogue.scored_transitions),
            expected_model_calls: contract.paid ? Number(critical.dialogue.learner_turns) : 0,
          });
        }
      }
      latentPairIndex += 1;
    }
  }
  const cellCount = critical.worlds.length * critical.latent_generators.length * realizers.length;
  const expectedJobs = cellCount * contract.seedsPerCell;
  if (jobs.length !== expectedJobs) throw new Error('stateBenchmarkV2: internal crossed-plan count mismatch');
  const expectedTransitions = jobs.reduce((sum, job) => sum + job.scored_transitions, 0);
  const expectedCalls = jobs.reduce((sum, job) => sum + job.expected_model_calls, 0);
  const generatedLabel = label || `adaptive-state-v2-${stage}`;
  const plan = {
    schema: ADAPTIVE_STATE_CRITICAL_PATH_PLAN_SCHEMA,
    version: config.version,
    label: generatedLabel,
    stage,
    paid: Boolean(contract.paid),
    confirmation_eligible: stage === 's2_confirmation',
    axes: {
      worlds: critical.worlds.map((row) => row.id),
      latent_generators: critical.latent_generators.map((row) => row.id),
      realizers: realizers.map((row) => row.id),
    },
    counts: {
      crossed_cells: cellCount,
      seeds_per_cell: contract.seedsPerCell,
      dialogue_jobs: jobs.length,
      scored_transitions: expectedTransitions,
      expected_model_calls: expectedCalls,
    },
    representations: representationIds(config),
    co_primary_targets: config.targets.co_primary.map((row) => row.id),
    split_lanes: config.analysis.split_lanes.map((row) => ({ ...row })),
    stop_rules: [...(contract.stop_if || [])],
    complexity_cap: { ...config.complexity_cap },
    statistical_contract: {
      prediction_origin: jsonClone(config.prediction_origin),
      targets: jsonClone(config.targets),
      analysis: jsonClone(config.analysis),
      minimum_useful_effects: jsonClone(config.minimum_useful_effects),
      gate: jsonClone(config.gate),
      stages: jsonClone(config.stages),
    },
    config_sha256: stableHash(config),
    jobs,
  };
  plan.design_sha256 = stableHash(planDesignPayload(plan));
  return plan;
}

function planDesignPayload(plan) {
  return {
    schema: plan.schema,
    version: plan.version,
    label: plan.label,
    stage: plan.stage,
    paid: plan.paid,
    confirmation_eligible: plan.confirmation_eligible,
    axes: plan.axes,
    counts: plan.counts,
    representations: plan.representations,
    co_primary_targets: plan.co_primary_targets,
    split_lanes: plan.split_lanes,
    stop_rules: plan.stop_rules,
    complexity_cap: plan.complexity_cap,
    statistical_contract: plan.statistical_contract,
    config_sha256: plan.config_sha256,
    jobs: plan.jobs,
  };
}

export function validateAdaptiveStateCriticalPathPlan(plan) {
  if (plan?.schema !== ADAPTIVE_STATE_CRITICAL_PATH_PLAN_SCHEMA) {
    throw new Error(`stateBenchmarkV2: expected plan schema ${ADAPTIVE_STATE_CRITICAL_PATH_PLAN_SCHEMA}`);
  }
  if (!STAGES.has(plan.stage)) throw new Error('stateBenchmarkV2: plan stage is invalid');
  const jobs = requireArray(plan.jobs, 'plan.jobs');
  if (new Set(jobs.map((job) => job.id)).size !== jobs.length) {
    throw new Error('stateBenchmarkV2: plan job ids must be unique');
  }
  if (!/^[0-9a-f]{64}$/u.test(String(plan.config_sha256 || ''))) {
    throw new Error('stateBenchmarkV2: plan is missing its frozen config hash');
  }
  const expectedDesignHash = stableHash(planDesignPayload(plan));
  if (plan.design_sha256 !== expectedDesignHash) {
    throw new Error('stateBenchmarkV2: plan design hash does not match its frozen semantic payload');
  }
  const expectedCells = new Set(
    plan.axes.worlds.flatMap((world) =>
      plan.axes.latent_generators.flatMap((generator) =>
        plan.axes.realizers.map((realizer) => `${world}__${generator}__${realizer}`),
      ),
    ),
  );
  const cells = new Set(jobs.map((job) => job.cell_id));
  if (cells.size !== Number(plan.counts?.crossed_cells)) {
    throw new Error('stateBenchmarkV2: one or more crossed cells are missing');
  }
  if (
    expectedCells.size !== cells.size ||
    [...expectedCells].some((cell) => !cells.has(cell)) ||
    [...cells].some((cell) => !expectedCells.has(cell))
  ) {
    throw new Error('stateBenchmarkV2: jobs do not implement the complete declared Cartesian product');
  }
  for (const cell of cells) {
    const cellRows = jobs.filter((job) => job.cell_id === cell);
    if (cellRows.length !== Number(plan.counts.seeds_per_cell)) {
      throw new Error(`stateBenchmarkV2: crossed cell ${cell} is unbalanced`);
    }
  }
  for (const job of jobs) {
    const expectedCell = `${job.world?.id}__${job.latent_generator?.id}__${job.language_realizer?.id}`;
    if (job.cell_id !== expectedCell) throw new Error(`stateBenchmarkV2: job ${job.id} cell identity is inconsistent`);
    if (!String(job.world?.source || '').startsWith('config/drama-derivation/')) {
      throw new Error(`stateBenchmarkV2: job ${job.id} has an invalid world source`);
    }
    if (!String(job.latent_generator?.source || '').startsWith('services/')) {
      throw new Error(`stateBenchmarkV2: job ${job.id} has an invalid transition-kernel source`);
    }
    if (job.action_schedule?.length !== Number(job.scored_transitions)) {
      throw new Error(`stateBenchmarkV2: job ${job.id} action schedule does not cover every transition`);
    }
    if (Number(job.bootstrap_public_observations) !== 1) {
      throw new Error(`stateBenchmarkV2: job ${job.id} is missing the unscored bootstrap observation`);
    }
    const expectedCalls = plan.paid ? Number(job.learner_turns) : 0;
    if (Number(job.expected_model_calls) !== expectedCalls) {
      throw new Error(`stateBenchmarkV2: job ${job.id} has an invalid expected model-call count`);
    }
  }
  const pairedJobs = new Map();
  for (const job of jobs) {
    const key = String(job.latent_pair_id || '');
    if (!key) throw new Error(`stateBenchmarkV2: job ${job.id} is missing its latent-pair identity`);
    const rows = pairedJobs.get(key) || [];
    rows.push(job);
    pairedJobs.set(key, rows);
  }
  for (const [pairId, rows] of pairedJobs) {
    if (rows.length !== plan.axes.realizers.length) {
      throw new Error(`stateBenchmarkV2: latent pair ${pairId} does not cover every realizer`);
    }
    const signatures = new Set(rows.map((job) => stableHash({ seed: job.seed, actions: job.action_schedule })));
    if (signatures.size !== 1) {
      throw new Error(`stateBenchmarkV2: latent pair ${pairId} changes seed or action schedule across realizers`);
    }
  }
  const donorBlocks = new Map();
  for (const job of jobs) {
    const key = `${job.world.id}__${job.latent_generator.id}`;
    const rows = donorBlocks.get(key) || [];
    rows.push(job);
    donorBlocks.set(key, rows);
  }
  for (const [blockId, rows] of donorBlocks) {
    const scheduleSignatures = new Set(rows.map((job) => stableHash(job.action_schedule)));
    if (scheduleSignatures.size !== 1) {
      throw new Error(`stateBenchmarkV2: donor block ${blockId} changes action schedule across repetitions`);
    }
    for (const job of rows) {
      const hasDifferentSeedDonor = rows.some(
        (candidate) =>
          candidate.id !== job.id &&
          candidate.language_realizer.id === job.language_realizer.id &&
          candidate.seed !== job.seed,
      );
      if (!hasDifferentSeedDonor) {
        throw new Error(`stateBenchmarkV2: job ${job.id} has no same-realizer different-seed scramble donor`);
      }
    }
  }
  const expectedDialogueCount = expectedCells.size * Number(plan.counts.seeds_per_cell);
  const expectedTransitions = jobs.reduce((sum, job) => sum + Number(job.scored_transitions), 0);
  const expectedCalls = jobs.reduce((sum, job) => sum + Number(job.expected_model_calls), 0);
  if (
    jobs.length !== expectedDialogueCount ||
    Number(plan.counts.dialogue_jobs) !== expectedDialogueCount ||
    Number(plan.counts.scored_transitions) !== expectedTransitions ||
    Number(plan.counts.expected_model_calls) !== expectedCalls
  ) {
    throw new Error('stateBenchmarkV2: plan aggregate counts do not match its jobs');
  }
  if (plan.stage === 's2_confirmation' && !CONFIRMATION_SIZES.has(Number(plan.counts.seeds_per_cell))) {
    throw new Error('stateBenchmarkV2: confirmation plan exceeds or misses the frozen sample-size choices');
  }
  if (
    plan.complexity_cap?.no_policy_sweep !== true ||
    plan.complexity_cap?.no_profile_sweep !== true ||
    plan.complexity_cap?.no_judge_model_sweep !== true ||
    plan.complexity_cap?.no_target_expansion_before_confirmation !== true
  ) {
    throw new Error('stateBenchmarkV2: critical-path complexity cap is not active');
  }
  return true;
}

export function adaptiveStateCriticalPathSummary(plan) {
  validateAdaptiveStateCriticalPathPlan(plan);
  return {
    stage: plan.stage,
    paid: plan.paid,
    crossedCells: plan.counts.crossed_cells,
    dialogues: plan.counts.dialogue_jobs,
    transitions: plan.counts.scored_transitions,
    modelCalls: plan.counts.expected_model_calls,
    representationsPerTransition: plan.representations.length,
    primaryTargets: [...plan.co_primary_targets],
  };
}
