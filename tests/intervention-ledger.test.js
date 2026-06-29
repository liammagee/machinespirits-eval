import assert from 'node:assert/strict';
import test from 'node:test';
import { selectPedagogicalAction } from '../services/adaptiveTutor/actionPolicy.js';
import { createAdaptationContract } from '../services/adaptiveTutor/adaptationContract.js';
import { appendPendingIntervention, closePendingIntervention } from '../services/adaptiveTutor/interventionLedger.js';

function contract() {
  const stateBelief = {
    version: '1.0',
    turn_index: 0,
    learner_project: {
      goal: 'solve the task',
      current_plan: 'unknown',
      commitment: 'uncommitted',
      next_authorship_opportunity: 'choose a next move',
    },
    hypotheses: [{ id: 'low_confidence', probability: 1, evidence: ['maybe'], disconfirming_evidence: [] }],
    axes: {
      proof: 0.3,
      release: 0.3,
      ownership: 0.2,
      conceptual_mastery: 0.3,
      metacognitive_accuracy: 0.3,
      affective_readiness: 0.7,
    },
    uncertainty: { entropy: 0, needs_discrimination: false, reason: 'single hypothesis' },
  };
  const selection = selectPedagogicalAction({ stateBelief, mode: 'closed_loop' });
  return createAdaptationContract({
    dialogueId: 'ledger-test',
    turnIndex: 0,
    stateBelief,
    selectedAction: selection.selectedAction,
    candidateActions: selection.candidateActions,
    gateResult: { allowed: true, violations: [], repairs: [] },
    policyMode: 'closed_loop',
  });
}

test('ledger appends one pending intervention and rejects a second pending', () => {
  const appended = appendPendingIntervention([], contract());
  assert.equal(appended.pendingIntervention.status, 'pending');
  assert.throws(() => appendPendingIntervention(appended.ledger, contract()), /unresolved pending/u);
});

test('ledger closes pending intervention from learner evidence', () => {
  const appended = appendPendingIntervention([], contract());
  const closed = closePendingIntervention({
    ledger: appended.ledger,
    learnerTurn: 'I predict the relation will stay unchanged because the same invariant is preserved.',
    turnIndex: 1,
  });
  assert.equal(closed.pendingIntervention, null);
  assert.equal(closed.ledger[0].status, 'closed');
  assert.equal(closed.ledger[0].outcome, 'success');
});

function combinedPending() {
  const successSignal = {
    required_evidence: ['learner-authored rationale', 'learner-authored prediction', 'non-formulaic learner rationale'],
    forbidden_evidence: ['mere agreement'],
  };
  return {
    contract_id: 'combined-contract',
    turn_index: 0,
    hypothesis_ids: ['resistance_rote_parroting'],
    action_type: 'request_evidence',
    expected_transition: {},
    success_signal: successSignal,
    original_success_signal: successSignal,
    adaptation_policy_layer: {
      proof_dag: { id: 'W_AF6_CURRICULUM' },
      learner_resistance: { observed_signal: 'rote_parroting' },
    },
    status: 'pending',
    observed_transition: null,
    outcome: null,
    evidence: [],
    staged_closure: null,
    policy_update: null,
  };
}

test('staged combined closure keeps a partial proof/resistance contract pending', () => {
  const staged = closePendingIntervention({
    ledger: [combinedPending()],
    learnerTurn: 'I can justify it because the relation changes in this case, not just by repeating the formula.',
    turnIndex: 1,
    config: { stagedCombinedClosure: true },
  });

  assert.equal(staged.closedRecord, null);
  assert.equal(staged.pendingIntervention.status, 'pending');
  assert.equal(staged.pendingIntervention.outcome, 'partial');
  assert.deepEqual(staged.pendingIntervention.success_signal.required_evidence, ['learner-authored prediction']);
  assert.deepEqual(staged.pendingIntervention.staged_closure.missing_required_evidence, [
    'learner-authored prediction',
  ]);
});

test('staged combined closure succeeds once missing evidence appears', () => {
  const first = closePendingIntervention({
    ledger: [combinedPending()],
    learnerTurn: 'I can justify it because the relation changes in this case, not just by repeating the formula.',
    turnIndex: 1,
    config: { stagedCombinedClosure: true },
  });
  const second = closePendingIntervention({
    ledger: first.ledger,
    learnerTurn: 'I predict the formula breaks when the case changes.',
    turnIndex: 2,
    config: { stagedCombinedClosure: true },
  });

  assert.equal(second.pendingIntervention, null);
  assert.equal(second.closedRecord.status, 'closed');
  assert.equal(second.closedRecord.outcome, 'success');
  assert.deepEqual(second.closedRecord.success_signal.required_evidence, [
    'learner-authored rationale',
    'learner-authored prediction',
    'non-formulaic learner rationale',
  ]);
  assert.equal(second.closedRecord.evidence.length, 2);
});
