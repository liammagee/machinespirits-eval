import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceScaffoldLifecycle,
  allowedMoveFamiliesForScaffoldPhase,
  createScaffoldLifecycle,
  SCAFFOLD_LIFECYCLE_SCHEMA,
} from '../services/adaptiveTutor/scaffoldLifecycle.js';

function decision(turn, contractId, actionType, moveFamily) {
  return {
    kind: 'typed_action_decision',
    turn,
    decision: {
      contract_id: contractId,
      chosen_action: { action_type: actionType, move_family: moveFamily },
    },
  };
}

function outcome(turn, contractId, value) {
  return {
    kind: 'closed_public_outcome',
    turn,
    outcome: {
      contract_id: contractId,
      outcome: value,
      closed_record: { contract_id: contractId, status: 'closed', outcome: value },
    },
  };
}

function step(lifecycle, event, transitions) {
  const result = advanceScaffoldLifecycle(lifecycle, event);
  transitions.push(result.transition);
  return result.lifecycle;
}

test('successful scaffold lifecycle fades support into independent work and transfer', () => {
  let lifecycle = createScaffoldLifecycle();
  const transitions = [];
  assert.equal(lifecycle.schema, SCAFFOLD_LIFECYCLE_SCHEMA);
  assert.deepEqual(allowedMoveFamiliesForScaffoldPhase('diagnose'), ['diagnose_elicit']);

  lifecycle = step(
    lifecycle,
    decision(1, 'c1', 'diagnose_with_discriminating_question', 'diagnose_elicit'),
    transitions,
  );
  assert.equal(lifecycle.phase, 'diagnose');
  lifecycle = step(lifecycle, outcome(2, 'c1', 'success'), transitions);
  assert.equal(lifecycle.phase, 'support');
  lifecycle = step(lifecycle, decision(2, 'c2', 'minimal_hint', 'minimal_support'), transitions);
  assert.equal(lifecycle.phase, 'observe_uptake');
  lifecycle = step(lifecycle, outcome(3, 'c2', 'success'), transitions);
  assert.equal(lifecycle.phase, 'fade');
  lifecycle = step(lifecycle, decision(3, 'c3', 'fade_hint', 'fade_transfer'), transitions);
  assert.equal(lifecycle.phase, 'independent_work');
  lifecycle = step(lifecycle, outcome(4, 'c3', 'success'), transitions);

  assert.equal(lifecycle.phase, 'transfer');
  assert.equal(lifecycle.terminal, true);
  assert.equal(lifecycle.transition_count, 6);
  assert.deepEqual(
    transitions.map((transition) => `${transition.from}->${transition.to}`),
    [
      'diagnose->diagnose',
      'diagnose->support',
      'support->observe_uptake',
      'observe_uptake->fade',
      'fade->independent_work',
      'independent_work->transfer',
    ],
  );
  assert.ok(transitions.every((transition) => transition.public_evidence_only));
});

test('failed public uptake enters bounded recovery without inventing learner state', () => {
  let lifecycle = createScaffoldLifecycle();
  const transitions = [];
  lifecycle = step(
    lifecycle,
    decision(1, 'c1', 'diagnose_with_discriminating_question', 'diagnose_elicit'),
    transitions,
  );
  lifecycle = step(lifecycle, outcome(2, 'c1', 'inconclusive'), transitions);
  lifecycle = step(lifecycle, decision(2, 'c2', 'explain_principle', 'explain_model'), transitions);
  lifecycle = step(lifecycle, outcome(3, 'c2', 'failure'), transitions);

  assert.equal(lifecycle.phase, 'recover');
  assert.equal(lifecycle.terminal, true);
  assert.equal(lifecycle.last_transition.reason, 'public_failure_requires_recovery');
  assert.deepEqual(Object.keys(lifecycle).sort(), [
    'cycle',
    'cycle_transition_count',
    'last_transition',
    'max_transitions_per_cycle',
    'pending_action_type',
    'pending_contract_id',
    'phase',
    'schema',
    'terminal',
    'transition_count',
    'version',
  ]);
  assert.throws(
    () => advanceScaffoldLifecycle(lifecycle, { kind: 'learner_state_guess', turn: 4 }),
    /unsupported event kind/u,
  );
});

test('a mismatched closed outcome fails into recovery', () => {
  let lifecycle = createScaffoldLifecycle();
  lifecycle = advanceScaffoldLifecycle(
    lifecycle,
    decision(1, 'expected-contract', 'diagnose_with_discriminating_question', 'diagnose_elicit'),
  ).lifecycle;
  const result = advanceScaffoldLifecycle(lifecycle, outcome(2, 'wrong-contract', 'success'));

  assert.equal(result.lifecycle.phase, 'recover');
  assert.equal(result.transition.accepted, false);
  assert.equal(result.transition.reason, 'closed_outcome_contract_mismatch');
});

test('a closed outcome before any typed decision fails closed', () => {
  const result = advanceScaffoldLifecycle(createScaffoldLifecycle(), outcome(1, 'orphan-contract', 'success'));

  assert.equal(result.lifecycle.phase, 'recover');
  assert.equal(result.transition.accepted, false);
  assert.equal(result.transition.reason, 'closed_outcome_without_pending_decision');
});

test('a typed decision without a contract id fails closed', () => {
  const result = advanceScaffoldLifecycle(
    createScaffoldLifecycle(),
    decision(1, null, 'diagnose_with_discriminating_question', 'diagnose_elicit'),
  );

  assert.equal(result.lifecycle.phase, 'recover');
  assert.equal(result.transition.accepted, false);
  assert.equal(result.transition.reason, 'typed_action_decision_missing_contract_id');
  assert.equal(result.lifecycle.pending_contract_id, null);
});

test('an id-less outcome cannot close a pending typed decision', () => {
  let lifecycle = createScaffoldLifecycle();
  lifecycle = advanceScaffoldLifecycle(
    lifecycle,
    decision(1, 'pending-contract', 'diagnose_with_discriminating_question', 'diagnose_elicit'),
  ).lifecycle;
  const result = advanceScaffoldLifecycle(lifecycle, outcome(2, null, 'success'));

  assert.equal(result.lifecycle.phase, 'recover');
  assert.equal(result.transition.accepted, false);
  assert.equal(result.transition.reason, 'closed_outcome_missing_contract_id_for_pending_decision');
});
