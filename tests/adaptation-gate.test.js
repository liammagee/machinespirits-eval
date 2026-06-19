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

test('gate permits explanation after a failed hint under a prerequisite gap', () => {
  const result = validateProofReleaseOwnershipGate({
    stateBelief: stateBelief({
      learner_project: {
        goal: 'apply the concept to a similar problem',
        current_plan:
          'The small hint is still not enough; I need the prerequisite idea before I can apply it to a similar problem.',
        commitment: 'uncommitted',
        next_authorship_opportunity: 'apply the explanation to a transfer case',
      },
      hypotheses: [
        {
          id: 'missing_prerequisite',
          probability: 0.73,
          evidence: ['need the prerequisite idea'],
          disconfirming_evidence: [],
        },
      ],
    }),
    selectedAction: materialize('explain_principle'),
    candidateActions: [
      { action_type: 'ask_strategy_choice', utility: 0.59, control_cost: 0.15, information_gain: 0.55 },
      { action_type: 'explain_principle', utility: 0.34, control_cost: 0.6, information_gain: 0.25 },
    ],
    interventionLedger: [
      {
        status: 'closed',
        outcome: 'failure',
        action_type: 'minimal_hint',
        hypothesis_ids: ['missing_prerequisite', 'low_confidence'],
        contract_id: 'prior-hint',
      },
    ],
  });

  assert.equal(result.allowed, true);
});

test('gate allows task reanchor as a meaningful bounded opportunity', () => {
  const result = validateProofReleaseOwnershipGate({
    stateBelief: stateBelief(),
    selectedAction: materialize('reanchor_goal'),
  });
  assert.equal(result.allowed, true);
});

test('gate preserves answer withholding as a bounded learner-owned opportunity', () => {
  const result = validateProofReleaseOwnershipGate({
    stateBelief: stateBelief({
      hypotheses: [{ id: 'answer_seeking', probability: 1, evidence: ['just tell me the answer'], disconfirming_evidence: [] }],
      axes: {
        proof: 0.25,
        release: 0.25,
        ownership: 0.2,
        conceptual_mastery: 0.3,
        metacognitive_accuracy: 0.35,
        affective_readiness: 0.7,
      },
    }),
    selectedAction: materialize('withhold_answer'),
  });
  assert.equal(result.allowed, true);
});

test('gate allows no-intervention when learner already owns a productive next move', () => {
  const result = validateProofReleaseOwnershipGate({
    stateBelief: stateBelief({
      learner_project: {
        goal: 'compare two quantities',
        current_plan: 'Next I would test the boundary case because the relation may fail there.',
        commitment: 'tentative',
        next_authorship_opportunity: 'continue the learner-authored next move',
      },
      hypotheses: [
        {
          id: 'productive_progress',
          probability: 0.7,
          evidence: ['Next I would test the boundary case'],
          disconfirming_evidence: [],
        },
        {
          id: 'boundary_case',
          probability: 0.3,
          evidence: ['boundary case'],
          disconfirming_evidence: [],
        },
      ],
      uncertainty: {
        entropy: 0.88,
        needs_discrimination: true,
        reason: 'Learner is progressing while still near a boundary-case question.',
      },
    }),
    selectedAction: materialize('observe_no_intervention'),
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

test('gate does not repair compatible actionable uncertainty back to diagnostic', () => {
  const result = validateProofReleaseOwnershipGate({
    stateBelief: stateBelief({
      learner_project: {
        goal: 'restart from one small available move',
        current_plan: "I just... I can't do this. I don't get any of this and I'm wasting your time.",
        commitment: 'uncommitted',
        next_authorship_opportunity: 'name one small part still available',
      },
      hypotheses: [
        {
          id: 'affective_shutdown',
          probability: 0.72,
          evidence: ["I just... I can't do this."],
          disconfirming_evidence: [],
        },
        {
          id: 'low_confidence',
          probability: 0.28,
          evidence: ["I don't get any of this."],
          disconfirming_evidence: [],
        },
      ],
      uncertainty: {
        entropy: 0.86,
        needs_discrimination: true,
        reason: 'Affective state is dominant but still mixed with low confidence.',
      },
    }),
    selectedAction: materialize('acknowledge_and_redirect'),
  });

  assert.equal(result.allowed, true);
  assert.equal(
    result.violations.some((v) => v.code === VIOLATION_CODES.HIGH_CONFIDENCE_WITH_HIGH_UNCERTAINTY),
    false,
  );
});
