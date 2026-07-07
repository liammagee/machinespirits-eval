import assert from 'node:assert/strict';
import test from 'node:test';
import { createAdaptationContract, validateLearnerStateBelief } from '../services/adaptiveTutor/adaptationContract.js';
import { selectPedagogicalAction } from '../services/adaptiveTutor/actionPolicy.js';

function belief(overrides = {}) {
  return {
    version: '1.0',
    turn_index: 1,
    learner_project: {
      goal: 'solve the task',
      current_plan: 'try a strategy',
      commitment: 'tentative',
      next_authorship_opportunity: 'choose the next move',
    },
    hypotheses: [
      { id: 'low_confidence', probability: 0.6, evidence: ['learner says maybe'], disconfirming_evidence: [] },
      { id: 'approval_dependency', probability: 0.4, evidence: ['asks if right'], disconfirming_evidence: [] },
    ],
    axes: {
      proof: 0.35,
      release: 0.3,
      ownership: 0.25,
      conceptual_mastery: 0.4,
      metacognitive_accuracy: 0.35,
      affective_readiness: 0.7,
    },
    uncertainty: { entropy: 0.7, needs_discrimination: true, reason: 'close hypotheses' },
    ...overrides,
  };
}

test('valid adaptation contract carries typed state and selected action', () => {
  const stateBelief = belief();
  const selection = selectPedagogicalAction({ stateBelief, interventionLedger: [], mode: 'closed_loop' });
  const contract = createAdaptationContract({
    dialogueId: 'd1',
    turnIndex: 1,
    stateBelief,
    selectedAction: selection.selectedAction,
    candidateActions: selection.candidateActions,
    gateResult: { allowed: true, violations: [], repairs: [] },
    policyMode: 'closed_loop',
  });
  assert.equal(contract.policy_mode, 'closed_loop');
  assert.equal(contract.state_belief.hypotheses.length, 2);
  assert.ok(contract.selected_action.action_type);
});

test('learner-state belief validation rejects unnormalized probabilities', () => {
  assert.throws(
    () =>
      validateLearnerStateBelief(
        belief({
          hypotheses: [
            { id: 'a', probability: 0.6, evidence: ['x'], disconfirming_evidence: [] },
            { id: 'b', probability: 0.6, evidence: ['y'], disconfirming_evidence: [] },
          ],
        }),
      ),
    /probabilities sum/u,
  );
});
