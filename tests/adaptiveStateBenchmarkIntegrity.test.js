import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ADAPTIVE_STATE_TARGET_HORIZON_SCHEMA,
  buildAdaptiveStateTargetHorizon,
  buildTutorStubNextEventTargets,
} from '../services/adaptiveTutor/tutorStubStateAdapter.js';
import {
  actionRecord,
  actionSourceProvenance,
  fixedLearnerTurnTarget,
} from '../scripts/export-adaptive-state-benchmark.js';

function observation(turn, { success = false } = {}) {
  return {
    turn,
    learner_text: `public learner observation ${turn}`,
    accepted_events: [],
    classifier: { agency: 'unknown' },
    dag: {
      bottleneck: 'inference_gap',
      final_secret_entailed: success,
      asserted_secret: success,
      unsupported_assertion_count: 0,
    },
    human_discourse: { proof_debt: { harmful_count: 0 } },
  };
}

test('legacy controller identity stays out of prediction action features', () => {
  const turnRecord = {
    registerSelection: {
      policy: 'continuous_dynamical_system',
      action_family: 'diagnose_elicit',
      selected_register: 'precise',
      selected_probability: 0.4,
    },
  };
  const action = actionRecord(turnRecord, { task_id: 'fixture-task', item_difficulty: 0.5 });
  const provenance = actionSourceProvenance(turnRecord);

  assert.equal(Object.hasOwn(action, 'legacy_policy'), false);
  assert.equal(JSON.stringify({ state: { public_signal: 1 }, action }).includes('continuous_dynamical_system'), false);
  assert.deepEqual(provenance, {
    schema: 'machinespirits.adaptive-state-action-source-provenance.v1',
    source: 'legacy_register_selection',
    source_controller_policy: 'continuous_dynamical_system',
    excluded_from_prediction_features: true,
  });
});

test('fixed learner-turn horizons never source a later observation and disclose carry-forward semantics', () => {
  const selected = fixedLearnerTurnTarget([observation(1), observation(3), observation(5, { success: true })], 4);
  assert.equal(selected.horizonObservation.turn, 3);
  assert.deepEqual(selected.targetHorizon, { kind: 'fixed_learner_turn', requested_turn: 4 });

  const horizon = buildAdaptiveStateTargetHorizon({
    kind: selected.targetHorizon.kind,
    currentObservation: observation(1),
    nextObservation: observation(2),
    horizonObservation: selected.horizonObservation,
    requestedTurn: selected.targetHorizon.requested_turn,
  });
  assert.deepEqual(horizon, {
    schema: ADAPTIVE_STATE_TARGET_HORIZON_SCHEMA,
    target: 'task_success_at_horizon',
    kind: 'fixed_learner_turn',
    prediction_turn: 1,
    requested_turn: 4,
    source_observation_turn: 3,
    source_policy: 'last_observation_carried_forward',
    prediction_relation: 'future',
    prediction_precedes_horizon: true,
    turn_offset: 3,
  });
  assert.throws(
    () =>
      buildAdaptiveStateTargetHorizon({
        kind: 'fixed_learner_turn',
        currentObservation: observation(1),
        nextObservation: observation(2),
        horizonObservation: observation(5),
        requestedTurn: 4,
      }),
    /cannot use later observation turn 5/u,
  );
});

test('a fixed horizon at or before prediction time is explicit and not emitted as a future success target', () => {
  const current = observation(5);
  const next = observation(6, { success: true });
  const source = observation(4, { success: true });
  const horizon = buildAdaptiveStateTargetHorizon({
    kind: 'fixed_learner_turn',
    currentObservation: current,
    nextObservation: next,
    horizonObservation: source,
    requestedTurn: 4,
  });
  const targets = buildTutorStubNextEventTargets({
    currentObservation: current,
    nextObservation: next,
    horizonObservation: source,
    targetHorizon: horizon,
  });

  assert.equal(horizon.prediction_relation, 'past_horizon');
  assert.equal(horizon.prediction_precedes_horizon, false);
  assert.equal(targets.task_success_at_horizon, null);
});
