import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ADAPTIVE_STATE_LEARNER_KERNEL_SCHEMA = 'machinespirits.adaptive-state-learner-kernel.v2';
export const ADAPTIVE_STATE_KERNEL_FORECAST_SCHEMA = 'machinespirits.adaptive-state-kernel-forecast.v2';
export const ADAPTIVE_STATE_KERNEL_TRANSITION_SCHEMA = 'machinespirits.adaptive-state-kernel-transition.v2';
export const ADAPTIVE_STATE_ORACLE_V2_SCHEMA = 'machinespirits.adaptive-state-oracle.v2';

export const CANONICAL_BENCHMARK_ACTION_TYPES = Object.freeze([
  'diagnose_with_discriminating_question',
  'minimal_hint',
  'request_evidence',
]);

const DAG_LABELS = Object.freeze(['retract', 'derive', 'adopt', 'none']);
const PROOF_LABELS = Object.freeze(['advance', 'regress', 'stall']);

export function cloneKernelValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function sha256KernelValue(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

export function hashKernelSourceFiles(sourceFiles, { repoRoot } = {}) {
  const root = repoRoot || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const rows = [...new Set(sourceFiles)].sort().map((sourcePath) => {
    const file = path.resolve(root, sourcePath);
    return {
      path: sourcePath,
      sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
    };
  });
  return sha256KernelValue(JSON.stringify(rows));
}

export function kernelImplementationMetadata(moduleUrl, { source, dependencies = [] } = {}) {
  const file = fileURLToPath(moduleUrl);
  const root = path.resolve(path.dirname(file), '../../..');
  const sourceFiles = [source, ...dependencies];
  if (path.resolve(root, source) !== file) {
    throw new Error(`learnerKernel: declared source ${source} does not match implementation module ${file}`);
  }
  const implementationSha256 = hashKernelSourceFiles(sourceFiles, { repoRoot: root });
  return Object.freeze({
    source,
    source_files: Object.freeze([...sourceFiles]),
    transition_kernel_sha256: implementationSha256,
  });
}

export function canonicalBenchmarkActionType(action) {
  const actionType = String(typeof action === 'string' ? action : action?.action_type || '').trim();
  if (!CANONICAL_BENCHMARK_ACTION_TYPES.includes(actionType)) {
    throw new Error(`learnerKernel: unsupported canonical action_type ${JSON.stringify(actionType)}`);
  }
  return actionType;
}

export function deterministicKernelUnit(seed, key) {
  if (!Number.isSafeInteger(Number(seed))) throw new Error('learnerKernel: seed must be a safe integer');
  const digest = sha256KernelValue(`${Number(seed)}:${String(key)}`);
  return Number.parseInt(digest.slice(0, 13), 16) / 0x10000000000000;
}

function normalizedBranches(branches) {
  if (!Array.isArray(branches) || !branches.length) {
    throw new Error('learnerKernel: transition enumeration must return at least one branch');
  }
  const seen = new Set();
  const normalized = branches
    .map((branch) => {
      const id = String(branch?.id || '').trim();
      const probability = Number(branch?.probability);
      if (!id || seen.has(id)) throw new Error('learnerKernel: transition branch ids must be unique and non-empty');
      seen.add(id);
      if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
        throw new Error(`learnerKernel: invalid probability for branch ${id}`);
      }
      if (!branch.next_state || !branch.event) {
        throw new Error(`learnerKernel: branch ${id} requires next_state and event`);
      }
      return { ...branch, id, probability };
    })
    .filter((branch) => branch.probability > 0);
  const total = normalized.reduce((sum, branch) => sum + branch.probability, 0);
  if (Math.abs(total - 1) > 1e-9) {
    throw new Error(`learnerKernel: branch probabilities must sum to one, got ${total}`);
  }
  return normalized;
}

function emptyDistribution(labels) {
  return Object.fromEntries(labels.map((label) => [label, 0]));
}

function addProbability(distribution, label, probability) {
  if (!Object.prototype.hasOwnProperty.call(distribution, label)) {
    throw new Error(`learnerKernel: unsupported harness target label ${JSON.stringify(label)}`);
  }
  distribution[label] += probability;
}

function roundProbability(value) {
  return Number(Number(value).toFixed(12));
}

function kernelForecastPayload({ kernel, adapter, state, actionType, turn, seed, branches }) {
  const dag = emptyDistribution(DAG_LABELS);
  const proof = emptyDistribution(PROOF_LABELS);
  const targetRows = [];
  for (const branch of branches) {
    const targets = adapter.targets({
      beforeProof: state.proof,
      afterProof: branch.next_state.proof,
      event: branch.event,
    });
    addProbability(dag, targets.next_dag_event_family, branch.probability);
    addProbability(proof, targets.next_proof_trajectory, branch.probability);
    targetRows.push({ branch_id: branch.id, targets });
  }
  const distributions = {
    next_dag_event_family: Object.fromEntries(
      Object.entries(dag).map(([label, value]) => [label, roundProbability(value)]),
    ),
    next_proof_trajectory: Object.fromEntries(
      Object.entries(proof).map(([label, value]) => [label, roundProbability(value)]),
    ),
  };
  const oracle = {
    schema: ADAPTIVE_STATE_ORACLE_V2_SCHEMA,
    prediction_origin: { phase: 'before_transition_sampling', turn },
    kernel_provenance: {
      generator_id: kernel.id,
      action_id: actionType,
      seed: Number(seed),
      transition_kernel_sha256: kernel.metadata.transition_kernel_sha256,
      source_files: [...kernel.metadata.source_files],
    },
    distributions,
  };
  const planSha256 = sha256KernelValue(
    JSON.stringify({
      kernel: kernel.id,
      world: adapter.id,
      state,
      action_type: actionType,
      turn,
      seed: Number(seed),
      branches: branches.map((branch, index) => ({
        index,
        id: branch.id,
        probability: branch.probability,
        event: branch.event,
        next_state: branch.next_state,
      })),
      distributions,
    }),
  );
  return { oracle, targetRows, planSha256 };
}

export function buildKernelForecast({ kernel, adapter, state, action, turn, seed }) {
  const actionType = canonicalBenchmarkActionType(action);
  if (!kernel || kernel.schema !== ADAPTIVE_STATE_LEARNER_KERNEL_SCHEMA) {
    throw new Error('learnerKernel: a v2 kernel implementation is required');
  }
  adapter.validateHiddenProofState(state?.proof);
  const branches = normalizedBranches(
    kernel.enumerateTransitions({
      adapter,
      state: cloneKernelValue(state),
      action_type: actionType,
      turn: Number(turn),
      seed: Number(seed),
    }),
  );
  const { oracle, targetRows, planSha256 } = kernelForecastPayload({
    kernel,
    adapter,
    state,
    actionType,
    turn: Number(turn),
    seed,
    branches,
  });
  return {
    schema: ADAPTIVE_STATE_KERNEL_FORECAST_SCHEMA,
    generator_id: kernel.id,
    action_type: actionType,
    turn: Number(turn),
    seed: Number(seed),
    plan_sha256: planSha256,
    oracle,
    branches,
    target_rows: targetRows,
    audit_sequence: ['oracle_captured_before_transition_sampling'],
  };
}

function selectBranch(branches, draw) {
  let cumulative = 0;
  for (const branch of branches) {
    cumulative += branch.probability;
    if (draw < cumulative) return branch;
  }
  return branches.at(-1);
}

export function executeKernelTransition({ kernel, adapter, state, action, turn, seed, forecast = null }) {
  const prepared = forecast || buildKernelForecast({ kernel, adapter, state, action, turn, seed });
  const actionType = canonicalBenchmarkActionType(action);
  if (
    prepared.generator_id !== kernel.id ||
    prepared.action_type !== actionType ||
    Number(prepared.turn) !== Number(turn) ||
    Number(prepared.seed) !== Number(seed)
  ) {
    throw new Error('learnerKernel: forecast does not match the requested transition');
  }
  const recomputed = buildKernelForecast({ kernel, adapter, state, action: actionType, turn, seed });
  if (recomputed.plan_sha256 !== prepared.plan_sha256) {
    throw new Error('learnerKernel: forecast plan changed before sampling');
  }
  const draw = deterministicKernelUnit(
    seed,
    `${kernel.id}:${adapter.id}:${turn}:${actionType}:${prepared.plan_sha256}`,
  );
  const selected = selectBranch(prepared.branches, draw);
  const targets = adapter.targets({
    beforeProof: state.proof,
    afterProof: selected.next_state.proof,
    event: selected.event,
  });
  const proofTransition = adapter.proofTransition({
    beforeProof: state.proof,
    afterProof: selected.next_state.proof,
    currentTurn: Number(turn),
  });
  const publicEnvelope = adapter.publicEnvelope({
    kernelId: kernel.id,
    actionType,
    turn: Number(turn) + 1,
    beforeState: state,
    afterState: selected.next_state,
    event: selected.event,
  });
  return {
    schema: ADAPTIVE_STATE_KERNEL_TRANSITION_SCHEMA,
    generator_id: kernel.id,
    action_type: actionType,
    prediction_turn: Number(turn),
    realized_turn: Number(turn) + 1,
    seed: Number(seed),
    oracle_before_sample: cloneKernelValue(prepared.oracle),
    plan_sha256: prepared.plan_sha256,
    draw,
    selected_branch_id: selected.id,
    event: cloneKernelValue(selected.event),
    next_state: cloneKernelValue(selected.next_state),
    public_envelope: publicEnvelope,
    targets,
    proof_transition: proofTransition,
    audit_sequence: [
      'oracle_captured_before_transition_sampling',
      'seeded_branch_sampled',
      'hidden_state_transition_applied',
      'public_envelope_projected',
      'harness_targets_derived',
    ],
  };
}
