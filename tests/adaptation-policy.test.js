import assert from 'node:assert/strict';
import test from 'node:test';
import {
  estimateLearnerStateBelief,
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
