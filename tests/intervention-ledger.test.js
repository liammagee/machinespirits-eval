import assert from 'node:assert/strict';
import test from 'node:test';
import { selectPedagogicalAction } from '../services/adaptiveTutor/actionPolicy.js';
import { createAdaptationContract } from '../services/adaptiveTutor/adaptationContract.js';
import {
  appendPendingIntervention,
  closePendingIntervention,
} from '../services/adaptiveTutor/interventionLedger.js';

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
