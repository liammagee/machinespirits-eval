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
import {
  auditTutorStubFeedbackAdaptation,
  buildTutorStubFeedbackAdaptationPlan,
  buildTutorStubFeedbackObservation,
  buildTutorStubFeedbackRatingRecord,
  findTutorStubFeedbackTargetTurn,
  tutorStubFeedbackAdaptationPrompt,
} from '../tutorStubFeedbackLearning.js';

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
    reason: null,
    reasonLabel: null,
    comment: null,
    scope: null,
    targetTutorTurn: null,
    targetTutorTurnId: null,
    targetKind: null,
    requestedAt: null,
    ratedAt: null,
    source: 'automated_learner_disabled',
  });
});

test('typed feedback reasons and comments remain attached to the rated response', () => {
  const state = createTutorStubTurnFeedbackState();
  requestTutorStubTurnFeedback(state, { tutorTurn: 2, tutorTurnId: 'run:t002' });
  const feedback = setTutorStubTurnFeedbackRating(state, 'down', {
    reason: 'too_abstract',
    comment: 'I could not connect this to the scene.',
  });
  assert.equal(feedback.reason, 'too_abstract');
  assert.equal(feedback.reasonLabel, 'too abstract');
  assert.equal(feedback.scope, 'tutor_prompt');
  assert.equal(feedback.comment, 'I could not connect this to the scene.');
});

test('bare arrows rate a pending tutor response only from an empty idle prompt', () => {
  const feedback = {
    enabled: true,
    requested: true,
  };
  assert.equal(tutorStubTurnFeedbackArrowRating({ line: '', key: { name: 'left' }, feedback }), 'down');
  assert.equal(tutorStubTurnFeedbackArrowRating({ line: '', key: { name: 'right' }, feedback }), 'up');

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

test('a down-rating becomes a one-turn observable adaptation contract tied to the rated response', () => {
  const targetTurn = {
    turn: 2,
    turnId: 'run:t002',
    tutor: 'The ledger names the tool. What follows from that?',
    responseConfiguration: {
      engagement_stance: 'precise',
      action_family: 'clarify_distinction',
      audience_register: 'domain_apprentice',
      lexical_accessibility: 'standard',
      scene_immersion: 'grounded',
      actorial_part: 'examiner',
    },
  };
  const feedback = {
    requested: true,
    supplied: true,
    rating: 'down',
    targetTutorTurn: 2,
    targetTutorTurnId: 'run:t002',
    source: 'human_learner',
  };
  assert.equal(findTutorStubFeedbackTargetTurn({ feedback, turns: [targetTurn] }), targetTurn);
  const plan = buildTutorStubFeedbackAdaptationPlan({
    feedback,
    targetTurn,
    nextSelection: { response_configuration: targetTurn.responseConfiguration },
  });
  assert.equal(plan.sameConfiguration, true);
  assert.deepEqual(plan.changedAxes, []);
  assert.match(tutorStubFeedbackAdaptationPrompt(plan), /change the realization instead/u);

  const audit = auditTutorStubFeedbackAdaptation({
    plan,
    targetTurn,
    currentTurn: {
      tutor:
        'You are right to pause. In plain terms, the ledger only links a tool to the desk; it does not name a person.',
      responseConfiguration: targetTurn.responseConfiguration,
      responseConfigurationAudit: { axes: {} },
      responseComposition: { uptake: 'You are right to pause.' },
    },
  });
  assert.equal(audit.passed, true);
  assert.equal(audit.sameConfigurationRecovery, true);
  assert.equal(audit.surfaceDistinct, true);
});

test('feedback observations retain human helpfulness separately from objective progress', () => {
  const targetTurn = {
    turn: 1,
    turnId: 'run:t001',
    tutor: 'What does the mark establish?',
    responseConfiguration: { engagement_stance: 'plain', action_family: 'clarify_distinction' },
    registerSelection: { policy: 'continuous_dynamical_system_register_policy', selection_probability: 0.64 },
    tutorLeakAudit: { ok: true },
  };
  const feedback = {
    requested: true,
    supplied: true,
    rating: 'up',
    targetTutorTurn: 1,
    targetTutorTurnId: 'run:t001',
    source: 'human_learner',
  };
  const observation = buildTutorStubFeedbackObservation({
    feedback,
    targetTurn,
    learnerTurn: { turn: 2, turnId: 'run:t002', text: 'It identifies the tool.', classification: {} },
    currentTurn: { turn: 2, turnId: 'run:t002', responseConfiguration: {} },
    previousRegisterEfficacy: {
      label: 'no_observed_progress',
      progressScore: 0,
      dagProgress: false,
      field: { delta: 0 },
    },
    provenance: { runId: 'run' },
  });
  assert.equal(observation.feedback.helpfulness, 1);
  assert.equal(observation.outcomes.subjectiveHelpfulness, 1);
  assert.equal(observation.outcomes.objectiveProgress.progressScore, 0);
  assert.equal(observation.causalClaim, false);
  assert.equal(observation.ratedResponse.selectionProbability, 0.64);
});

test('an immediate rating record survives without a following learner turn', () => {
  const feedback = {
    requested: true,
    supplied: true,
    rating: 'down',
    targetTutorTurn: 4,
    targetTutorTurnId: 'run:t004',
    ratedAt: '2026-07-14T08:00:00.000Z',
  };
  const record = buildTutorStubFeedbackRatingRecord({
    feedback,
    targetTurn: {
      turn: 4,
      turnId: 'run:t004',
      tutor: 'Which conclusion follows?',
      responseConfiguration: { engagement_stance: 'precise', action_family: 'clarify_distinction' },
      provider: 'codex',
      model: 'gpt-5.6-terra',
    },
    provenance: { runId: 'run', inputSource: 'empty_prompt_left_arrow' },
  });
  assert.equal(record.schema, 'machinespirits.tutor-stub.feedback-rating-record.v1');
  assert.equal(record.feedback.helpfulness, -1);
  assert.equal(record.ratedResponse.turnId, 'run:t004');
  assert.equal(record.ratedResponse.responseConfiguration.engagement_stance, 'precise');
  assert.equal(record.provenance.inputSource, 'empty_prompt_left_arrow');
});
