import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

import {
  CANONICAL_BENCHMARK_ACTION_TYPES,
  adaptiveStateLearnerKernel,
  buildKernelForecast,
  createAdaptiveStateKernelSession,
  loadAdaptiveStateWorldAdapters,
  stepAdaptiveStateKernelSession,
} from '../services/adaptiveTutor/learnerKernels/index.js';
import {
  adaptiveStatePublicObservationKey,
  adaptiveStatePublicObservationProjection,
  createLatentKernelBelief,
  expectedLatentKernelInformationGainBits,
  forwardLatentKernelBelief,
  latentKernelBeliefEntropyBits,
  latentKernelStateKey,
  pointMassLatentKernelBelief,
  predictLatentKernelFilter,
  updateLatentKernelFilter,
} from '../services/adaptiveTutor/latentKernelFilter.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGETS = ['next_dag_event_family', 'next_proof_trajectory'];
const KERNEL_IDS = ['durable_state', 'dag_dropout'];
const GRID_SEEDS = [7, 41];
const SCORED_TRANSITIONS = 6;

const baseConfig = yaml.parse(fs.readFileSync(path.join(ROOT, 'config', 'adaptive-state-benchmark-v2.yaml'), 'utf8'));
const adapters = loadAdaptiveStateWorldAdapters(baseConfig.critical_path.worlds, { repoRoot: ROOT });

function scheduleFor(worldIndex) {
  const schedule = baseConfig.critical_path.action_schedule;
  const shift = worldIndex % schedule.length;
  return [...schedule.slice(shift), ...schedule.slice(0, shift)];
}

test('MANDATORY fixed point: a point-mass belief on the true state reproduces the kernel oracle exactly across worlds x kernels x actions x turns', () => {
  let checkedForecasts = 0;
  for (const [worldIndex, adapter] of adapters.entries()) {
    for (const kernelId of KERNEL_IDS) {
      const kernel = adaptiveStateLearnerKernel(kernelId);
      for (const seed of GRID_SEEDS) {
        let session = createAdaptiveStateKernelSession({ adapter, kernel, seed });
        const schedule = scheduleFor(worldIndex + seed);
        for (let index = 0; index < SCORED_TRANSITIONS; index += 1) {
          const predictionTurn = index + 1;
          const transitionSeed = seed * 100 + predictionTurn; // exact S0 executor seed policy
          const belief = pointMassLatentKernelBelief(session.state);
          for (const action of CANONICAL_BENCHMARK_ACTION_TYPES) {
            const oracle = buildKernelForecast({
              kernel,
              adapter,
              state: session.state,
              action,
              turn: predictionTurn,
              seed: transitionSeed,
            }).oracle.distributions;
            const prediction = predictLatentKernelFilter({
              kernel,
              adapter,
              belief,
              action,
              turn: predictionTurn,
              seed: transitionSeed,
            });
            assert.deepEqual(prediction.target_distributions, oracle);
            checkedForecasts += 1;
          }
          session = stepAdaptiveStateKernelSession({ session, action: schedule[index], predictionTurn }).next_session;
        }
      }
    }
  }
  // 3 worlds x 2 kernels x 2 seeds x 6 turns x 3 actions
  assert.equal(checkedForecasts, 216);
});

test('posterior normalization: updates along a realized trajectory keep the belief a probability distribution', () => {
  const adapter = adapters[0];
  const kernel = adaptiveStateLearnerKernel('dag_dropout');
  const seed = 13;
  let session = createAdaptiveStateKernelSession({ adapter, kernel, seed });
  let belief = pointMassLatentKernelBelief(session.state);
  const schedule = scheduleFor(1);
  for (let index = 0; index < SCORED_TRANSITIONS; index += 1) {
    const predictionTurn = index + 1;
    const stepped = stepAdaptiveStateKernelSession({ session, action: schedule[index], predictionTurn });
    const observation = adaptiveStatePublicObservationProjection({
      adapter,
      event: stepped.transition.event,
      nextState: stepped.transition.next_state,
    });
    const updated = updateLatentKernelFilter({
      kernel,
      adapter,
      belief,
      action: schedule[index],
      observation,
      turn: predictionTurn,
      seed: seed * 100 + predictionTurn,
    });
    const total = updated.belief.states.reduce((sum, row) => sum + row.probability, 0);
    assert.ok(Math.abs(total - 1) < 1e-12);
    assert.ok(updated.belief.states.every((row) => row.probability > 0));
    assert.ok(updated.observation_probability > 0 && updated.observation_probability <= 1);
    // The realized public projection identifies the true next state on this substrate.
    assert.ok(updated.belief.states.some((row) => row.key === latentKernelStateKey(stepped.transition.next_state)));
    belief = updated.belief;
    session = stepped.next_session;
  }
  assert.ok(latentKernelBeliefEntropyBits(belief) >= 0);
});

test('impossible observation fails closed: an event outside the predicted support throws', () => {
  const adapter = adapters[0];
  const kernel = adaptiveStateLearnerKernel('durable_state');
  const seed = 5;
  const session = createAdaptiveStateKernelSession({ adapter, kernel, seed });
  const belief = pointMassLatentKernelBelief(session.state);
  const prediction = predictLatentKernelFilter({
    kernel,
    adapter,
    belief,
    action: 'minimal_hint',
    turn: 1,
    seed: seed * 100 + 1,
  });
  const impossible = JSON.parse(JSON.stringify(prediction.observations[0].projection));
  impossible.event = { event_family: 'derive', event_id: 'derive:inference_99', semantic_role: 'fabricated' };
  assert.ok(!prediction.observations.some((row) => row.key === adaptiveStatePublicObservationKey(impossible)));
  assert.throws(
    () =>
      updateLatentKernelFilter({
        kernel,
        adapter,
        belief,
        action: 'minimal_hint',
        observation: impossible,
        turn: 1,
        seed: seed * 100 + 1,
      }),
    /fail closed/u,
  );
});

test('belief construction validates, merges duplicates, and measures entropy in bits', () => {
  const adapter = adapters[1];
  const kernel = adaptiveStateLearnerKernel('durable_state');
  const stateA = kernel.initialize({ adapter, seed: 3 });
  const stateB = kernel.initialize({ adapter, seed: 4 });
  assert.throws(() => createLatentKernelBelief([]), /at least one weighted state/u);
  assert.throws(() => createLatentKernelBelief([{ state: stateA, probability: -0.2 }]), /finite and non-negative/u);
  assert.throws(() => createLatentKernelBelief([{ state: stateA, probability: 0.5 }]), /sum to one/u);
  const merged = createLatentKernelBelief([
    { state: stateA, probability: 0.5 },
    { state: stateA, probability: 0.5 },
  ]);
  assert.equal(merged.states.length, 1);
  assert.equal(merged.states[0].probability, 1);
  assert.equal(latentKernelBeliefEntropyBits(merged), 0);
  const even = createLatentKernelBelief([
    { state: stateA, probability: 0.5 },
    { state: stateB, probability: 0.5 },
  ]);
  assert.ok(Math.abs(latentKernelBeliefEntropyBits(even) - 1) < 1e-12);
});

test('expected information gain equals the branch-outcome entropy when the public projection separates branches', () => {
  const adapter = adapters[0];
  const kernel = adaptiveStateLearnerKernel('durable_state');
  const seed = 9;
  const session = createAdaptiveStateKernelSession({ adapter, kernel, seed });
  const belief = pointMassLatentKernelBelief(session.state);
  const transitionSeed = seed * 100 + 1;
  const prediction = predictLatentKernelFilter({
    kernel,
    adapter,
    belief,
    action: 'minimal_hint',
    turn: 1,
    seed: transitionSeed,
  });
  assert.ok(prediction.observations.length >= 2);
  for (const row of prediction.observations) assert.equal(row.posterior.length, 1);
  const expectedGain = -prediction.observations.reduce(
    (sum, row) => sum + row.probability * Math.log2(row.probability),
    0,
  );
  const gain = expectedLatentKernelInformationGainBits({
    kernel,
    adapter,
    belief,
    action: 'minimal_hint',
    turn: 1,
    seed: transitionSeed,
  });
  assert.ok(Math.abs(gain.expected_gain_bits - expectedGain) < 1e-12);
  assert.ok(Math.abs(gain.expected_posterior_entropy_bits) < 1e-12);
  assert.equal(gain.observation_count, prediction.observations.length);
});

test('mixture beliefs: prediction mixes per-state forecasts and Bayes update re-weights toward the compatible hypothesis', () => {
  const adapter = adapters[2];
  const kernel = adaptiveStateLearnerKernel('durable_state');
  const stateA = kernel.initialize({ adapter, seed: 21 });
  const stateB = kernel.initialize({ adapter, seed: 22 });
  assert.notEqual(latentKernelStateKey(stateA), latentKernelStateKey(stateB));
  const belief = createLatentKernelBelief([
    { state: stateA, probability: 0.6 },
    { state: stateB, probability: 0.4 },
  ]);
  const transitionSeed = 21 * 100 + 1;
  const mixed = predictLatentKernelFilter({
    kernel,
    adapter,
    belief,
    action: 'request_evidence',
    turn: 1,
    seed: transitionSeed,
  });
  const forA = buildKernelForecast({
    kernel,
    adapter,
    state: stateA,
    action: 'request_evidence',
    turn: 1,
    seed: transitionSeed,
  }).oracle.distributions;
  const forB = buildKernelForecast({
    kernel,
    adapter,
    state: stateB,
    action: 'request_evidence',
    turn: 1,
    seed: transitionSeed,
  }).oracle.distributions;
  for (const target of TARGETS) {
    for (const [label, value] of Object.entries(mixed.target_distributions[target])) {
      assert.ok(Math.abs(value - (0.6 * forA[target][label] + 0.4 * forB[target][label])) < 1e-12);
    }
  }
  const total = mixed.next_state_prior.reduce((sum, row) => sum + row.probability, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
  const observed = mixed.observations[0];
  const updated = updateLatentKernelFilter({
    kernel,
    adapter,
    belief,
    action: 'request_evidence',
    observation: observed.projection,
    turn: 1,
    seed: transitionSeed,
  });
  assert.ok(Math.abs(updated.observation_probability - observed.probability) < 1e-12);
  const posteriorTotal = updated.belief.states.reduce((sum, row) => sum + row.probability, 0);
  assert.ok(Math.abs(posteriorTotal - 1) < 1e-12);
  for (const row of updated.belief.states) {
    const predicted = observed.posterior.find((candidate) => candidate.key === row.key);
    assert.ok(predicted, 'posterior support must come from the predicted conditional');
    assert.ok(Math.abs(predicted.probability - row.probability) < 1e-12);
  }
});

test('forward (predict-only) belief accumulates branch-draw uncertainty without observations', () => {
  const adapter = adapters[0];
  const kernel = adaptiveStateLearnerKernel('durable_state');
  const seed = 17;
  let prior = pointMassLatentKernelBelief(kernel.initialize({ adapter, seed }));
  const schedule = scheduleFor(0);
  for (let index = 0; index < 3; index += 1) {
    prior = forwardLatentKernelBelief({
      kernel,
      adapter,
      belief: prior,
      action: schedule[index],
      turn: index + 1,
      seed: seed * 100 + index + 1,
    });
  }
  assert.ok(prior.states.length > 1);
  assert.ok(latentKernelBeliefEntropyBits(prior) > 0);
  const total = prior.states.reduce((sum, row) => sum + row.probability, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
});
