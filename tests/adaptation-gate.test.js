import assert from 'node:assert/strict';
import test from 'node:test';
import { getActionDefinition, selectPedagogicalAction } from '../services/adaptiveTutor/actionPolicy.js';
import {
  validateProofReleaseOwnershipGate,
  VIOLATION_CODES,
} from '../services/adaptiveTutor/proofReleaseOwnershipGate.js';

function stateBelief(overrides = {}) {
  return {
    version: '1.0',
    turn_index: 1,
    learner_project: {
      goal: 'compare two quantities',
      current_plan: 'unclear',
      commitment: 'uncommitted',
      next_authorship_opportunity: 'choose a next move',
    },
    hypotheses: [{ id: 'task_misread', probability: 1, evidence: ['misread the task'], disconfirming_evidence: [] }],
    axes: {
      proof: 0.25,
      release: 0.3,
      ownership: 0.2,
      conceptual_mastery: 0.3,
      metacognitive_accuracy: 0.3,
      affective_readiness: 0.7,
    },
    uncertainty: { entropy: 0, needs_discrimination: false, reason: 'diagnostic evidence resolved state' },
    ...overrides,
  };
}

function materialize(actionType) {
  const selection = selectPedagogicalAction({ stateBelief: stateBelief(), mode: 'closed_loop' });
  const def = getActionDefinition(actionType);
  return {
    ...selection.selectedAction,
    action_type: def.action_type,
    description: def.description,
    target_axes: def.target_axes,
    expected_transition: def.expected_transition,
    success_signal: def.success_signal,
    control_cost: def.default_control_cost,
    information_gain: def.default_information_gain,
    forbidden_moves: def.forbidden_moves,
  };
}

test('gate blocks high-control proof supply while ownership is unresolved', () => {
  const result = validateProofReleaseOwnershipGate({
    stateBelief: stateBelief(),
    selectedAction: materialize('explain_principle'),
  });
  assert.equal(result.allowed, false);
  assert.ok(result.violations.some((v) => v.code === VIOLATION_CODES.OWNERSHIP_WITH_TUTOR_SUPPLIED_PROOF));
});

test('gate allows task reanchor as a meaningful bounded opportunity', () => {
  const result = validateProofReleaseOwnershipGate({
    stateBelief: stateBelief(),
    selectedAction: materialize('reanchor_goal'),
  });
  assert.equal(result.allowed, true);
});

test('gate allows repeated affective acknowledgement when shutdown evidence renews', () => {
  const result = validateProofReleaseOwnershipGate({
    stateBelief: stateBelief({
      learner_project: {
        goal: 'compare two quantities',
        current_plan: "I just... I can't do this. I don't get any of this and I'm wasting your time.",
        commitment: 'uncommitted',
        next_authorship_opportunity: 'name one small part still available',
      },
      hypotheses: [
        {
          id: 'affective_shutdown',
          probability: 1,
          evidence: ["I just... I can't do this."],
          disconfirming_evidence: [],
        },
      ],
    }),
    selectedAction: materialize('acknowledge_and_redirect'),
    interventionLedger: [
      {
        status: 'closed',
        outcome: 'failure',
        action_type: 'acknowledge_and_redirect',
        hypothesis_ids: ['affective_shutdown'],
        contract_id: 'prior-affective-repair',
      },
    ],
  });

  assert.equal(result.allowed, true);
});
