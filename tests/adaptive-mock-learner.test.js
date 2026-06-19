import assert from 'node:assert/strict';
import test from 'node:test';
import { callRole } from '../services/adaptiveTutor/mockLLM.js';

test('mock learner uses action-specific scripted responses after trigger turn', async () => {
  const response = await callRole('learnerTurn', {
    tutorLastMessage: 'Keep going with your own next step.',
    actionType: 'observe_no_intervention',
    turn: 2,
    hidden: {
      triggerTurn: 1,
      triggerSignal: 'trigger',
      actualSophistication: 'intermediate',
      scriptedResponses: {
        observe_no_intervention: 'Next I would test a new case because the relation depends on reciprocal standing.',
      },
    },
  });

  assert.equal(response, 'Next I would test a new case because the relation depends on reciprocal standing.');
});

test('mock learner preserves trigger signal precedence over scripted responses', async () => {
  const response = await callRole('learnerTurn', {
    tutorLastMessage: 'Keep going with your own next step.',
    actionType: 'observe_no_intervention',
    turn: 1,
    hidden: {
      triggerTurn: 1,
      triggerSignal: 'I just cannot do this.',
      actualSophistication: 'intermediate',
      scriptedResponses: {
        observe_no_intervention: 'Next I would continue independently.',
      },
    },
  });

  assert.equal(response, 'I just cannot do this.');
});
