import assert from 'node:assert/strict';
import test from 'node:test';
import {
  estimateLearnerStateBelief,
  legacyPolicyActionForAdaptiveAction,
  selectPedagogicalAction,
} from '../services/adaptiveTutor/actionPolicy.js';

test('uncertain first turn selects a diagnostic action', () => {
  const belief = estimateLearnerStateBelief({
    dialogue: [{ role: 'learner', content: "I don't get why that works." }],
    turnIndex: 0,
  });
  const selection = selectPedagogicalAction({ stateBelief: belief, interventionLedger: [], mode: 'closed_loop' });
  assert.equal(selection.selectedAction.action_type, 'diagnose_with_discriminating_question');
});

test('successful diagnostic evidence lets task misread select reanchor_goal', () => {
  const dialogue = [
    { role: 'learner', content: "I don't get why that works." },
    { role: 'tutor', content: 'diagnostic question' },
    {
      role: 'learner',
      content: 'I misread the task; I thought the question asks for a computation, not a comparison.',
    },
  ];
  const belief = estimateLearnerStateBelief({ dialogue, turnIndex: 1 });
  const ledger = [
    {
      status: 'closed',
      outcome: 'success',
      action_type: 'diagnose_with_discriminating_question',
      hypothesis_ids: ['missing_prerequisite', 'low_confidence'],
    },
  ];
  const selection = selectPedagogicalAction({ stateBelief: belief, interventionLedger: ledger, mode: 'closed_loop' });
  assert.equal(belief.hypotheses[0].id, 'task_misread');
  assert.equal(selection.selectedAction.action_type, 'reanchor_goal');
});

test('advanced boundary-case signal selects a scope-test-compatible contrast action', () => {
  const dialogue = [
    { role: 'learner', content: "I don't get why that works." },
    { role: 'tutor', content: 'diagnostic question' },
    {
      role: 'learner',
      content:
        'Does this only break down in the master-slave case where recognition is structurally one-sided? That limit-case seems to motivate bilateralism rather than refute it.',
    },
  ];
  const belief = estimateLearnerStateBelief({ dialogue, turnIndex: 2 });
  const ledger = [
    {
      status: 'closed',
      outcome: 'success',
      action_type: 'diagnose_with_discriminating_question',
      hypothesis_ids: ['missing_prerequisite', 'low_confidence'],
    },
  ];
  const selection = selectPedagogicalAction({ stateBelief: belief, interventionLedger: ledger, mode: 'closed_loop' });

  assert.equal(belief.hypotheses[0].id, 'boundary_case');
  assert.equal(selection.selectedAction.action_type, 'contrast_models');
  assert.equal(legacyPolicyActionForAdaptiveAction(selection.selectedAction.action_type), 'scope_test');
});
