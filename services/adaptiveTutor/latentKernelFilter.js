// Exact Bayes filter over kernel latent state — Part 1b of the frozen v2.4 contract
// (PLAN_4_0/2026-07-13-adaptive-state-decomposition-and-voi-protocol-v2.4.md; machine mirror
// config/adaptive-state-instrument-v2.4.yaml).
//
// The committed learner kernels expose their full transition law before sampling:
// `kernel.enumerateTransitions(...)` returns explicit branches with probabilities, events, and
// next states, and `buildKernelForecast` normalizes them and derives the two harness-target
// distributions. That makes an exact (enumerative, zero-model-call) Bayes filter over latent
// kernel state computable:
//
//   belief                    = distribution over latent kernel states (canonical-JSON keys)
//   predict(belief, a, t)     = branch-mixture distribution over public-event projections and
//                               over the two harness targets
//   update(belief, a, o, t)   = Bayes posterior over next latent states given the observed
//                               public-event projection; fails closed on impossible observations
//
// Seed policy: the caller must thread the SAME transition seed the S0 executor uses
// (`session.seed * 100 + predictionTurn`, see stepAdaptiveStateKernelSession in
// learnerKernels/index.js). The kernels' branch distributions do not depend on the seed, but the
// forecast provenance and plan hashes do, and the mandated fixed-point check (point-mass belief
// on the true state reproduces `buildKernelForecast`'s oracle distributions exactly) is defined
// against the harness seed.
//
// The observation projection is a deterministic function of publicly visible artifacts only:
// the realized public event (family, event id, semantic role — all carried by the public act
// envelope), the public state cues, and the proof-state summary the turn record publishes
// (missing/held/voiced counts, harmful debt, coverage, final-secret entailment, released-evidence
// count). No hidden scalar, seed, or branch id enters the projection.
//
// Pure module: no I/O, no model calls, no persistence.

import { buildKernelForecast, cloneKernelValue } from './learnerKernels/contract.js';

export const ADAPTIVE_STATE_LATENT_KERNEL_BELIEF_SCHEMA = 'machinespirits.adaptive-state-latent-kernel-belief.v2.4';
export const ADAPTIVE_STATE_LATENT_KERNEL_PREDICTION_SCHEMA =
  'machinespirits.adaptive-state-latent-kernel-prediction.v2.4';
export const ADAPTIVE_STATE_PUBLIC_OBSERVATION_PROJECTION_SCHEMA =
  'machinespirits.adaptive-state-public-observation-projection.v2.4';

const MASS_TOLERANCE = 1e-6;
const ENTROPY_TOLERANCE = 1e-9;
const LOG2 = Math.log(2);
const DAG_LABELS = Object.freeze(['retract', 'derive', 'adopt', 'none']);
const PROOF_LABELS = Object.freeze(['advance', 'regress', 'stall']);
const PUBLIC_EVENT_FAMILIES = new Set(['adopt', 'derive', 'retract']);

function sortJsonValue(value) {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortJsonValue(value[key])]),
  );
}

function canonicalJsonKey(value) {
  return JSON.stringify(sortJsonValue(value));
}

/** Canonical identity of one latent kernel state (order-insensitive JSON). */
export function latentKernelStateKey(state) {
  if (!state || typeof state !== 'object') throw new Error('latentKernelFilter: a latent kernel state is required');
  return canonicalJsonKey(state);
}

function requireSafeInteger(value, label) {
  if (!Number.isSafeInteger(Number(value))) throw new Error(`latentKernelFilter: ${label} must be a safe integer`);
  return Number(value);
}

/**
 * Build a validated belief from `[{ state, probability }]` entries. Entries with identical
 * canonical state keys are merged; total mass must be 1 within tolerance and is renormalized
 * exactly so downstream mixtures stay probability distributions.
 */
export function createLatentKernelBelief(entries) {
  if (!Array.isArray(entries) || !entries.length) {
    throw new Error('latentKernelFilter: a belief needs at least one weighted state');
  }
  const byKey = new Map();
  let total = 0;
  for (const entry of entries) {
    const probability = Number(entry?.probability);
    if (!Number.isFinite(probability) || probability < 0) {
      throw new Error('latentKernelFilter: belief probabilities must be finite and non-negative');
    }
    if (probability === 0) continue;
    const key = latentKernelStateKey(entry.state);
    const row = byKey.get(key) || { key, probability: 0, state: cloneKernelValue(entry.state) };
    row.probability += probability;
    byKey.set(key, row);
    total += probability;
  }
  if (!byKey.size) throw new Error('latentKernelFilter: belief has no probability mass');
  if (Math.abs(total - 1) > MASS_TOLERANCE) {
    throw new Error(`latentKernelFilter: belief mass must sum to one, got ${total}`);
  }
  const states = [...byKey.values()]
    .map((row) => ({ ...row, probability: row.probability / total }))
    .sort((left, right) => left.key.localeCompare(right.key));
  return { schema: ADAPTIVE_STATE_LATENT_KERNEL_BELIEF_SCHEMA, states };
}

/** Point-mass belief on one known latent state (the deterministic-initialization case). */
export function pointMassLatentKernelBelief(state) {
  return createLatentKernelBelief([{ state, probability: 1 }]);
}

function validateBelief(belief) {
  if (belief?.schema !== ADAPTIVE_STATE_LATENT_KERNEL_BELIEF_SCHEMA || !Array.isArray(belief.states)) {
    throw new Error('latentKernelFilter: a validated latent-kernel belief is required');
  }
  return belief;
}

function entropyBits(rows) {
  let bits = 0;
  for (const row of rows) {
    const probability = Number(row.probability);
    if (probability > 0) bits -= (probability * Math.log(probability)) / LOG2;
  }
  return bits;
}

/** Shannon entropy of a belief, in bits. */
export function latentKernelBeliefEntropyBits(belief) {
  return entropyBits(validateBelief(belief).states);
}

/**
 * Deterministic projection of one realized transition onto the public channel. Uses only fields
 * the harness makes public (event identity/semantic role, state cues, and the proof metrics the
 * turn record publishes) — never the seed, the branch id, or hidden continuous state.
 */
export function adaptiveStatePublicObservationProjection({ adapter, event, nextState } = {}) {
  if (!adapter?.proofSnapshot) throw new Error('latentKernelFilter: a world adapter is required for projections');
  if (!event || typeof event !== 'object') throw new Error('latentKernelFilter: a public event is required');
  if (!nextState?.proof) throw new Error('latentKernelFilter: a next latent state with proof is required');
  const family = PUBLIC_EVENT_FAMILIES.has(event.kind) ? event.kind : 'none';
  const snapshot = adapter.proofSnapshot(nextState.proof);
  return {
    schema: ADAPTIVE_STATE_PUBLIC_OBSERVATION_PROJECTION_SCHEMA,
    event: {
      event_family: family,
      event_id: event.event_id ?? null,
      semantic_role: String(event.semantic_role || ''),
    },
    state_cues: cloneKernelValue(nextState.public_cues || {}),
    public_proof: {
      raw_distance: snapshot.raw_distance,
      harmful_proof_debt: snapshot.harmful_proof_debt,
      held_critical_count: snapshot.held_critical_count,
      voiced_derived_count: snapshot.voiced_derived_count,
      best_path_coverage: snapshot.best_path_coverage,
      final_secret_entailed: snapshot.final_secret_entailed,
      released_premise_count: nextState.proof.releasedPremiseIds.length,
    },
  };
}

/** Canonical identity of one public observation projection. */
export function adaptiveStatePublicObservationKey(projection) {
  if (projection?.schema !== ADAPTIVE_STATE_PUBLIC_OBSERVATION_PROJECTION_SCHEMA) {
    throw new Error('latentKernelFilter: a public observation projection is required');
  }
  return canonicalJsonKey(projection);
}

function accumulateMass(map, key, state, mass) {
  const row = map.get(key) || { key, probability: 0, state };
  row.probability += mass;
  map.set(key, row);
}

function sortedRows(map) {
  return [...map.values()].sort((left, right) => left.key.localeCompare(right.key));
}

function normalizedRows(rows, total) {
  return rows.map((row) => ({ key: row.key, probability: row.probability / total, state: row.state }));
}

/**
 * Exact one-step predictive distribution from a belief under one action. Enumerates
 * `buildKernelForecast` for every hypothesis state (with the harness transition seed) and mixes:
 * - `target_distributions`: the two harness-target label distributions (for a point-mass belief
 *   these equal the kernel's own oracle distributions exactly — the mandated fixed-point);
 * - `next_state_prior`: the pre-observation distribution over next latent states;
 * - `observations`: the distribution over public-event projections, each with its conditional
 *   posterior over next latent states.
 */
export function predictLatentKernelFilter({ kernel, adapter, belief, action, turn, seed } = {}) {
  const validated = validateBelief(belief);
  const predictionTurn = requireSafeInteger(turn, 'turn');
  const transitionSeed = requireSafeInteger(seed, 'seed');
  const dag = Object.fromEntries(DAG_LABELS.map((label) => [label, 0]));
  const proof = Object.fromEntries(PROOF_LABELS.map((label) => [label, 0]));
  const nextStates = new Map();
  const observations = new Map();
  const hypotheses = [];
  let actionType = null;
  for (const { key, probability: weight, state } of validated.states) {
    const forecast = buildKernelForecast({
      kernel,
      adapter,
      state,
      action,
      turn: predictionTurn,
      seed: transitionSeed,
    });
    actionType = forecast.action_type;
    hypotheses.push({ key, probability: weight, plan_sha256: forecast.plan_sha256 });
    for (const label of DAG_LABELS) dag[label] += weight * forecast.oracle.distributions.next_dag_event_family[label];
    for (const label of PROOF_LABELS) {
      proof[label] += weight * forecast.oracle.distributions.next_proof_trajectory[label];
    }
    for (const branch of forecast.branches) {
      const mass = weight * branch.probability;
      if (!(mass > 0)) continue;
      const nextState = cloneKernelValue(branch.next_state);
      const nextKey = latentKernelStateKey(nextState);
      accumulateMass(nextStates, nextKey, nextState, mass);
      const projection = adaptiveStatePublicObservationProjection({ adapter, event: branch.event, nextState });
      const observationKey = adaptiveStatePublicObservationKey(projection);
      const row = observations.get(observationKey) || {
        key: observationKey,
        projection,
        probability: 0,
        posterior: new Map(),
      };
      row.probability += mass;
      accumulateMass(row.posterior, nextKey, nextState, mass);
      observations.set(observationKey, row);
    }
  }
  const priorRows = sortedRows(nextStates);
  const priorMass = priorRows.reduce((sum, row) => sum + row.probability, 0);
  if (Math.abs(priorMass - 1) > MASS_TOLERANCE) {
    throw new Error(`latentKernelFilter: predictive mass must sum to one, got ${priorMass}`);
  }
  return {
    schema: ADAPTIVE_STATE_LATENT_KERNEL_PREDICTION_SCHEMA,
    action_type: actionType,
    turn: predictionTurn,
    seed: transitionSeed,
    hypotheses,
    target_distributions: {
      next_dag_event_family: dag,
      next_proof_trajectory: proof,
    },
    next_state_prior: normalizedRows(priorRows, priorMass),
    observations: sortedRows(observations).map((row) => {
      const posteriorRows = sortedRows(row.posterior);
      return {
        key: row.key,
        probability: row.probability / priorMass,
        projection: row.projection,
        posterior: normalizedRows(posteriorRows, row.probability),
      };
    }),
  };
}

/**
 * Bayes update: condition the one-step prediction on an observed public-event projection.
 * Impossible observations (zero predicted mass) fail closed with a thrown error — the filter
 * never invents support for an event its transition law cannot produce.
 */
export function updateLatentKernelFilter({ kernel, adapter, belief, action, observation, turn, seed } = {}) {
  const prediction = predictLatentKernelFilter({ kernel, adapter, belief, action, turn, seed });
  const observationKey = typeof observation === 'string' ? observation : adaptiveStatePublicObservationKey(observation);
  const match = prediction.observations.find((row) => row.key === observationKey);
  if (!match || !(match.probability > 0)) {
    throw new Error(
      `latentKernelFilter: observed public event has zero probability under the predicted belief (fail closed): ${observationKey}`,
    );
  }
  return {
    belief: createLatentKernelBelief(match.posterior.map(({ state, probability }) => ({ state, probability }))),
    observation_probability: match.probability,
    prediction,
  };
}

/** Predict-only forward step (no conditioning) — the "prior at horizon" reference chain. */
export function forwardLatentKernelBelief({ kernel, adapter, belief, action, turn, seed } = {}) {
  const prediction = predictLatentKernelFilter({ kernel, adapter, belief, action, turn, seed });
  return createLatentKernelBelief(
    prediction.next_state_prior.map(({ state, probability }) => ({ state, probability })),
  );
}

/**
 * Expected one-step posterior-entropy reduction over latent state, in bits:
 *   I(S_{t+1}; O_{t+1} | belief, action) = H(next-state prior) − E_obs[H(next-state posterior)].
 * This is the action-informativeness quantity frozen for B1.
 */
export function expectedLatentKernelInformationGainBits({ kernel, adapter, belief, action, turn, seed } = {}) {
  const prediction = predictLatentKernelFilter({ kernel, adapter, belief, action, turn, seed });
  const priorEntropy = entropyBits(prediction.next_state_prior);
  let expectedPosteriorEntropy = 0;
  for (const row of prediction.observations) {
    expectedPosteriorEntropy += row.probability * entropyBits(row.posterior);
  }
  const gain = priorEntropy - expectedPosteriorEntropy;
  if (gain < -ENTROPY_TOLERANCE) {
    throw new Error(`latentKernelFilter: information gain must be non-negative, got ${gain}`);
  }
  return {
    action_type: prediction.action_type,
    turn: prediction.turn,
    prior_entropy_bits: priorEntropy,
    expected_posterior_entropy_bits: expectedPosteriorEntropy,
    expected_gain_bits: Math.max(0, gain),
    observation_count: prediction.observations.length,
    next_state_count: prediction.next_state_prior.length,
  };
}
