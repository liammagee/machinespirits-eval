import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

import {
  assertAdaptiveStateV24DecompositionContract,
  buildScheduleFloorRows,
  classifyAdaptiveStateDecomposition,
} from '../scripts/analyze-adaptive-state-decomposition-v24.js';
import { bootstrapMetric, predictionLosses } from '../services/adaptiveTutor/stateBenchmarkCanonicalPilot.js';
import { fitAdaptiveStateStage0Head } from '../services/adaptiveTutor/stateBenchmarkStage0Analysis.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGETS = ['next_dag_event_family', 'next_proof_trajectory'];
const WORLDS = ['hethel', 'marrick', 'ravensmark'];
const MARGINS = { negligible_abs_delta: 0.02, useful_delta: 0.05, world_driver_delta: -0.1 };

function entry({ rung = 'lean_dag', multiplier = 1, pooled, perWorld }) {
  return {
    rung,
    lambda_multiplier: multiplier,
    pooled: { next_dag_event_family: pooled[0], next_proof_trajectory: pooled[1] },
    per_world: Object.fromEntries(
      WORLDS.map((world, index) => [
        world,
        {
          next_dag_event_family: perWorld?.[index]?.[0] ?? pooled[0],
          next_proof_trajectory: perWorld?.[index]?.[1] ?? pooled[1],
        },
      ]),
    ),
  };
}

function classify(entries) {
  return classifyAdaptiveStateDecomposition({ entries, targets: TARGETS, worlds: WORLDS, margins: MARGINS });
}

test('v2.4 frozen instrument contract is accepted exactly and fails closed on drift', () => {
  const config = yaml.parse(fs.readFileSync(path.join(ROOT, 'config', 'adaptive-state-instrument-v2.4.yaml'), 'utf8'));
  const contract = assertAdaptiveStateV24DecompositionContract(config);
  assert.deepEqual(contract.part_1a.regularization_grid_relative_to_pilot_l2, [0.25, 1, 4, 16, 64]);
  assert.equal(contract.bootstrap.seed, 20260713);
  assert.equal(contract.bootstrap.resamples, 5000);
  assert.equal(contract.bootstrap.refit_inside_resamples, false);

  const drifted = JSON.parse(JSON.stringify(config));
  drifted.part_1a_decomposition.margins_pooled_log_loss_nats.negligible_abs_delta = 0.05;
  assert.throws(() => assertAdaptiveStateV24DecompositionContract(drifted), /drifted/u);
  const wrongSeed = JSON.parse(JSON.stringify(config));
  wrongSeed.data_provenance.bootstrap.seed = 20260712;
  assert.throws(() => assertAdaptiveStateV24DecompositionContract(wrongSeed), /bootstrap contract drifted/u);
});

test('classification: data_starved when any rung/lambda is pooled-negligible on both targets', () => {
  const result = classify([
    entry({ multiplier: 1, pooled: [-0.52, -0.5] }),
    entry({ multiplier: 16, pooled: [-0.019, 0.015] }),
  ]);
  assert.equal(result.label, 'data_starved');
  assert.equal(result.matched_clause, 1);
  assert.equal(result.evidence.qualifying.length, 1);
  assert.equal(result.evidence.qualifying[0].lambda_multiplier, 16);
});

test('classification: data_starved takes precedence over a world-confounded pattern', () => {
  const result = classify([
    // Qualifies for clause 2: two negligible worlds, one common driver.
    entry({
      rung: 'dag_trajectory',
      multiplier: 4,
      pooled: [-0.2, -0.2],
      perWorld: [
        [-0.01, 0.01],
        [0.005, -0.015],
        [-0.55, -0.6],
      ],
    }),
    // Also qualifies for clause 1.
    entry({ rung: 'lean_dag', multiplier: 64, pooled: [0.01, -0.01] }),
  ]);
  assert.equal(result.label, 'data_starved');
});

test('classification: world_confounded needs 2-of-3 negligible worlds and one common driving world', () => {
  const result = classify([
    entry({ multiplier: 1, pooled: [-0.52, -0.5] }),
    entry({
      multiplier: 4,
      pooled: [-0.19, -0.21],
      perWorld: [
        [0.012, -0.008],
        [-0.015, 0.01],
        [-0.56, -0.61],
      ],
    }),
  ]);
  assert.equal(result.label, 'world_confounded');
  assert.equal(result.matched_clause, 2);
  assert.equal(result.evidence.qualifying.length, 1);
  assert.equal(result.evidence.qualifying[0].driving_world, 'ravensmark');
});

test('classification: representation_carries_nothing when every rung/lambda stays materially worse', () => {
  const result = classify([
    entry({ multiplier: 0.25, pooled: [-0.9, -0.8] }),
    entry({ multiplier: 64, pooled: [-0.11, -0.14] }),
  ]);
  assert.equal(result.label, 'representation_carries_nothing');
  assert.equal(result.matched_clause, 3);
});

test('classification ambiguity defaults: driver below margin, split drivers, one-target patterns, non-finite deltas', () => {
  // Remaining world at -0.05 misses the -0.10 driver bar.
  const weakDriver = classify([
    entry({
      multiplier: 4,
      pooled: [-0.04, -0.04],
      perWorld: [
        [0.01, 0.01],
        [-0.01, -0.01],
        [-0.05, -0.05],
      ],
    }),
  ]);
  assert.equal(weakDriver.label, 'representation_carries_nothing');

  // Different driving world per target is ambiguous.
  const splitDrivers = classify([
    entry({
      multiplier: 4,
      pooled: [-0.2, -0.2],
      perWorld: [
        [-0.55, 0.01],
        [0.01, -0.55],
        [0.005, 0.005],
      ],
    }),
  ]);
  assert.equal(splitDrivers.label, 'representation_carries_nothing');

  // Pooled negligible on one target only never reaches clause 1.
  const oneTarget = classify([entry({ multiplier: 16, pooled: [0.01, -0.3] })]);
  assert.equal(oneTarget.label, 'representation_carries_nothing');

  // Non-finite deltas can satisfy nothing.
  const nonFinite = classify([
    entry({
      multiplier: 4,
      pooled: [Number.NaN, -0.01],
      perWorld: [
        [Number.NaN, 0.01],
        [0.01, 0.01],
        [-0.5, -0.5],
      ],
    }),
  ]);
  assert.equal(nonFinite.label, 'representation_carries_nothing');
});

test('classification validates its frozen inputs', () => {
  assert.throws(() => classify([]), /needs entries/u);
  assert.throws(
    () =>
      classifyAdaptiveStateDecomposition({
        entries: [entry({ pooled: [0, 0] })],
        targets: TARGETS,
        worlds: WORLDS.slice(0, 2),
        margins: MARGINS,
      }),
    /three frozen worlds/u,
  );
  assert.throws(
    () =>
      classifyAdaptiveStateDecomposition({
        entries: [entry({ pooled: [0, 0] })],
        targets: TARGETS,
        worlds: WORLDS,
        margins: { negligible_abs_delta: 0.02, world_driver_delta: 0.1 },
      }),
    /frozen negligible and world-driver margins/u,
  );
});

function datasetRow({ id, world, turn, action, truth, dialogue = 'd1', pair = 'p1' }) {
  return {
    id,
    turn,
    action: { action_type: action, id: action, schema: 'machinespirits.adaptive-state-common-action.v2' },
    groups: { world_id: world, dialogue_id: dialogue, latent_pair_id: pair, generator_id: 'durable_state' },
    targets: { next_proof_trajectory: truth, next_dag_event_family: 'none' },
    representations: {
      no_state: { common: { task: { item_difficulty: 0.5 }, turn } },
      lean_dag: { common: { turn }, additional_state: { dag: { grounded_count: turn } } },
      oracle: { additional_state: { distributions: {} } },
    },
    controls: { secret_hint: 'must never leak into the schedule floor' },
  };
}

function syntheticRows() {
  const actions = ['minimal_hint', 'request_evidence'];
  const rows = [];
  let index = 0;
  for (const world of ['world_a', 'world_b']) {
    for (const turn of [1, 2, 3]) {
      for (const action of actions) {
        index += 1;
        rows.push(
          datasetRow({
            id: `row_${index}`,
            world,
            turn,
            action,
            truth: turn === 1 ? 'stall' : 'advance',
            dialogue: `${world}_dialogue`,
            pair: `${world}_pair`,
          }),
        );
      }
    }
  }
  return rows;
}

test('schedule-floor builder exposes exactly (world, turn index, action family) and nothing else', () => {
  const rows = syntheticRows();
  const floor = buildScheduleFloorRows(rows);
  assert.equal(floor.length, rows.length);
  for (const [index, row] of floor.entries()) {
    assert.deepEqual(Object.keys(row.representations), ['schedule_only']);
    assert.deepEqual(row.representations.schedule_only, {
      schedule: { turn_index: rows[index].turn, world_id: rows[index].groups.world_id },
    });
    assert.deepEqual(row.action, rows[index].action);
    assert.deepEqual(row.targets, rows[index].targets);
    assert.equal(row.groups.latent_pair_id, rows[index].groups.latent_pair_id);
    assert.equal('controls' in row, false);
  }
  // Deep copies: mutating the built rows must not touch the sealed dataset rows.
  floor[0].action.action_type = 'mutated';
  floor[0].groups.world_id = 'mutated';
  assert.equal(rows[0].action.action_type, 'minimal_hint');
  assert.equal(rows[0].groups.world_id, 'world_a');

  const model = fitAdaptiveStateStage0Head(floor, {
    representation: 'schedule_only',
    target: 'next_proof_trajectory',
    labels: ['advance', 'regress', 'stall'],
    lambda: 1,
    maximumIterations: 25,
  });
  assert.equal(model.encoder.featureNames[0], '(intercept)');
  for (const name of model.encoder.featureNames.slice(1)) {
    assert.match(name, /^(action\.|state\.schedule\.)/u);
  }
  assert.ok(model.encoder.featureNames.includes('state.schedule.turn_index'));
  assert.ok(model.encoder.featureNames.includes('state.schedule.world_id=world_a'));
  assert.ok(model.encoder.featureNames.includes('action.action_type=minimal_hint'));
  assert.ok(!model.encoder.featureNames.some((name) => name.includes('controls') || name.includes('no_state')));
});

test('schedule-floor builder fails closed on rows missing world, turn, or action', () => {
  assert.throws(() => buildScheduleFloorRows([]), /needs dataset rows/u);
  const missingTurn = datasetRow({ id: 'x', world: 'world_a', turn: 1, action: 'minimal_hint', truth: 'stall' });
  delete missingTurn.turn;
  assert.throws(() => buildScheduleFloorRows([missingTurn]), /missing world or turn index/u);
  const missingAction = datasetRow({ id: 'y', world: 'world_a', turn: 1, action: 'minimal_hint', truth: 'stall' });
  delete missingAction.action;
  assert.throws(() => buildScheduleFloorRows([missingAction]), /missing its frozen action family/u);
});

test('re-exported pilot helpers stay deterministic and loss-correct (paired cluster bootstrap reuse)', () => {
  const losses = predictionLosses({ truth: 'advance', probabilities: { advance: 0.5, regress: 0.25, stall: 0.25 } }, [
    'advance',
    'regress',
    'stall',
  ]);
  assert.ok(Math.abs(losses.log_loss - -Math.log(0.5)) < 1e-12);
  assert.ok(Math.abs(losses.brier_score - (0.25 + 0.0625 + 0.0625)) < 1e-12);

  const deltas = new Map([
    ['pair_a', [0.1, 0.2]],
    ['pair_b', [-0.05, 0.05]],
    ['pair_c', [0.15]],
  ]);
  const options = { iterations: 500, seed: 20260713, confidenceLevel: 0.95, material: 'unit|test' };
  const first = bootstrapMetric(deltas, options);
  const second = bootstrapMetric(deltas, options);
  assert.deepEqual(first, second);
  assert.ok(Math.abs(first.point_delta - 0.09) < 1e-12);
  assert.ok(first.confidence_interval.lower <= first.point_delta);
  assert.ok(first.confidence_interval.upper >= first.point_delta);
  assert.ok(first.probability_of_improvement >= 0 && first.probability_of_improvement <= 1);
});
