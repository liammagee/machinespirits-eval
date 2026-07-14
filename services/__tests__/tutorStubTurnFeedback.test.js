import assert from 'node:assert/strict';
import test from 'node:test';
import {
  commitTutorStubTurnFeedback,
  createTutorStubTurnFeedbackState,
  requestTutorStubTurnFeedback,
  setTutorStubTurnFeedbackRating,
  tutorStubTurnFeedbackArrowRating,
  tutorStubTurnFeedbackEnvelope,
  tutorStubTurnFeedbackPrompt,
} from '../tutorStubTurnFeedback.js';

test('human turn feedback is on by default and may be skipped', () => {
  const state = createTutorStubTurnFeedbackState();
  requestTutorStubTurnFeedback(state, {
    tutorTurn: 2,
    tutorTurnId: 'run:t002',
    requestedAt: '2026-07-14T00:00:00.000Z',
  });

  const feedback = tutorStubTurnFeedbackEnvelope(state);
  assert.equal(feedback.enabled, true);
  assert.equal(feedback.requested, true);
  assert.equal(feedback.supplied, false);
  assert.equal(feedback.rating, null);

  const committed = commitTutorStubTurnFeedback(state, { learnerTurn: 3, learnerTurnId: 'run:t003' });
  assert.equal(committed.supplied, false);
  assert.equal(state.history.length, 1);
  assert.equal(state.history[0].learnerTurn, 3);
  assert.equal(tutorStubTurnFeedbackEnvelope(state).requested, false);
});

test('a thumbs rating remains structured metadata and creates private tutor guidance', () => {
  const state = createTutorStubTurnFeedbackState();
  requestTutorStubTurnFeedback(state, { tutorTurn: 1, tutorTurnId: 'run:t001' });
  const feedback = setTutorStubTurnFeedbackRating(state, 'down', {
    ratedAt: '2026-07-14T00:01:00.000Z',
  });

  assert.deepEqual(
    {
      supplied: feedback.supplied,
      rating: feedback.rating,
      targetTutorTurn: feedback.targetTutorTurn,
      targetTutorTurnId: feedback.targetTutorTurnId,
    },
    { supplied: true, rating: 'down', targetTutorTurn: 1, targetTutorTurnId: 'run:t001' },
  );
  const prompt = tutorStubTurnFeedbackPrompt(feedback);
  assert.match(prompt, /marked your previous public response unhelpful/u);
  assert.match(prompt, /Do not mention the rating/u);
});

test('fully automated learners never receive or supply tutor-message feedback', () => {
  const state = createTutorStubTurnFeedbackState({ automatedLearner: true });
  assert.equal(state.enabled, false);
  assert.equal(requestTutorStubTurnFeedback(state, { tutorTurn: 1 }), null);
  assert.deepEqual(tutorStubTurnFeedbackEnvelope(state), {
    schema: 'machinespirits.tutor-stub.turn-feedback.v1',
    enabled: false,
    requested: false,
    supplied: false,
    rating: null,
    targetTutorTurn: null,
    targetTutorTurnId: null,
    targetKind: null,
    requestedAt: null,
    ratedAt: null,
    source: 'automated_learner_disabled',
  });
});

test('bare arrows rate a pending tutor response only from an empty idle prompt', () => {
  const feedback = {
    enabled: true,
    requested: true,
  };
  assert.equal(
    tutorStubTurnFeedbackArrowRating({ line: '', key: { name: 'left' }, feedback }),
    'down',
  );
  assert.equal(
    tutorStubTurnFeedbackArrowRating({ line: '', key: { name: 'right' }, feedback }),
    'up',
  );

  for (const blocked of [
    { line: 'editing a reply', key: { name: 'left' }, feedback },
    { line: '', key: { name: 'left', shift: true }, feedback },
    { line: '', key: { name: 'right', ctrl: true }, feedback },
    { line: '', key: { name: 'right' }, feedback, busy: true },
    { line: '', key: { name: 'right' }, feedback, interactiveMode: 'auto' },
    { line: '', key: { name: 'right' }, feedback, interfaceBlocked: true },
    { line: '', key: { name: 'right' }, feedback: { enabled: true, requested: false } },
  ]) {
    assert.equal(tutorStubTurnFeedbackArrowRating(blocked), null);
  }
});
