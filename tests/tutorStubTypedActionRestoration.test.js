import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { advanceScaffoldLifecycle, createScaffoldLifecycle } from '../services/adaptiveTutor/scaffoldLifecycle.js';
import {
  restoreTutorStubTypedActionState,
  tutorStubTypedActionDecisionFromTurn,
} from '../services/tutorStubTypedActionRestoration.js';

function decision(contractId, actionType = 'diagnostic_probe') {
  return {
    contract_id: contractId,
    chosen_action: { action_type: actionType, move_family: 'diagnose_elicit', turn: 2 },
  };
}

test('typed-action decision lookup preserves modern, legacy, and register precedence', () => {
  const modern = { contract_id: 'modern' };
  const legacy = { contract_id: 'legacy' };
  const register = { contract_id: 'register' };
  assert.equal(
    tutorStubTypedActionDecisionFromTurn({
      typedActionDecision: modern,
      typed_action_decision: legacy,
      registerSelection: { typed_action_decision: register },
    }),
    modern,
  );
  assert.equal(
    tutorStubTypedActionDecisionFromTurn({
      typed_action_decision: legacy,
      registerSelection: { typed_action_decision: register },
    }),
    legacy,
  );
  assert.equal(
    tutorStubTypedActionDecisionFromTurn({ registerSelection: { typed_action_decision: register } }),
    register,
  );
});

test('typed-action decision lookup skips absent, primitive, and contractless candidates', () => {
  const fallback = { contract_id: 'fallback' };
  assert.equal(tutorStubTypedActionDecisionFromTurn(null), null);
  assert.equal(
    tutorStubTypedActionDecisionFromTurn({
      typedActionDecision: 'invalid',
      typed_action_decision: {},
      registerSelection: { typed_action_decision: fallback },
    }),
    fallback,
  );
  assert.equal(tutorStubTypedActionDecisionFromTurn({ typedActionDecision: { contract_id: '' } }), null);
});

test('typed-action restoration preserves disabled and empty enabled states', () => {
  assert.deepEqual(restoreTutorStubTypedActionState({ typedActions: { enabled: false } }, [], []), {
    enabled: false,
    restored: false,
    ledgerRecords: 0,
    pendingContractId: null,
    phase: null,
  });
  const state = { typedActions: { enabled: true, ledger: ['stale'] } };
  assert.deepEqual(restoreTutorStubTypedActionState(state, [], []), {
    enabled: true,
    restored: false,
    ledgerRecords: 0,
    closedRecords: 0,
    pendingContractId: null,
    currentActionType: null,
    phase: 'diagnose',
    lifecycleTransitions: 0,
  });
  assert.deepEqual(state.typedActions.ledger, []);
  assert.equal(state.typedActions.currentDecision, null);
});

test('typed-action restoration rebuilds one pending decision and lifecycle after the last clear', () => {
  const current = decision('current');
  const pending = { contract_id: 'current', status: 'pending', action_type: 'diagnostic_probe' };
  const state = { typedActions: { enabled: true } };
  const result = restoreTutorStubTypedActionState(
    state,
    [],
    [
      {
        type: 'tutor_typed_action_decision',
        decision: decision('ignored'),
        pendingIntervention: { contract_id: 'ignored', status: 'pending' },
      },
      { type: 'history_clear' },
      { type: 'tutor_typed_action_decision', decision: current, pendingIntervention: pending },
    ],
  );
  assert.deepEqual(result, {
    enabled: true,
    restored: true,
    ledgerRecords: 1,
    closedRecords: 0,
    pendingContractId: 'current',
    currentActionType: 'diagnostic_probe',
    phase: 'diagnose',
    lifecycleTransitions: 1,
  });
  assert.equal(state.typedActions.ledger[0].contract_id, 'current');
  assert.equal(state.typedActions.scaffoldLifecycle.pending_contract_id, 'current');
  assert.notEqual(state.typedActions.currentDecision, current);
  assert.notEqual(state.typedActions.ledger[0], pending);
});

test('typed-action restoration keeps closed records closed and clears pending decision state', () => {
  const closed = { contract_id: 'closed', status: 'closed', outcome: 'success' };
  const state = { typedActions: { enabled: true } };
  const result = restoreTutorStubTypedActionState(
    state,
    [],
    [
      {
        type: 'tutor_typed_action_decision',
        decision: decision('closed'),
        pendingIntervention: { contract_id: 'closed', status: 'pending' },
      },
      { type: 'tutor_typed_action_outcome_closed', outcome: { closed_record: closed } },
      {
        type: 'tutor_typed_action_decision',
        decision: decision('closed'),
        pendingIntervention: { contract_id: 'closed', status: 'pending' },
      },
    ],
  );
  assert.equal(result.closedRecords, 1);
  assert.equal(result.pendingContractId, null);
  assert.equal(state.typedActions.ledger[0].status, 'closed');
  assert.equal(state.typedActions.currentDecision, null);
});

test('typed-action restoration fails closed on ambiguous or unproven pending ledgers', () => {
  const enabled = () => ({ typedActions: { enabled: true } });
  assert.throws(
    () =>
      restoreTutorStubTypedActionState(
        enabled(),
        [],
        [
          {
            type: 'tutor_typed_action_decision',
            decision: decision('one'),
            pendingIntervention: { contract_id: 'one', status: 'pending' },
          },
          {
            type: 'tutor_typed_action_decision',
            decision: decision('two'),
            pendingIntervention: { contract_id: 'two', status: 'pending' },
          },
        ],
      ),
    /multiple pending interventions: one, two/u,
  );
  assert.throws(
    () =>
      restoreTutorStubTypedActionState(
        enabled(),
        [{ typedActionPriorOutcome: { closed_record: { contract_id: 'missing', status: 'pending' } } }],
        [],
      ),
    /missing decision provenance for missing/u,
  );

  const orphanLifecycle = advanceScaffoldLifecycle(createScaffoldLifecycle(), {
    kind: 'typed_action_decision',
    decision: decision('orphan'),
  }).lifecycle;
  assert.throws(
    () =>
      restoreTutorStubTypedActionState(
        enabled(),
        [],
        [{ type: 'tutor_scaffold_lifecycle_transition', lifecycle: orphanLifecycle }],
      ),
    /orphaned pending contract orphan without a ledger record/u,
  );
});

test('the CLI imports rather than redeclares typed-action decision lookup', () => {
  const source = fs.readFileSync(new URL('../scripts/tutor-stub.js', import.meta.url), 'utf8');
  assert.match(source, /restoreTutorStubTypedActionState as restoreTypedActionState/u);
  assert.doesNotMatch(source, /function typedActionDecisionFromTurn\(/u);
  assert.doesNotMatch(source, /function restoreTypedActionState\(/u);
});
