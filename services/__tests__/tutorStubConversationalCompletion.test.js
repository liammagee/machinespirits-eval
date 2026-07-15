import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyTutorStubConversationalCompletionSelection,
  auditTutorStubConversationalCompletionResponse,
  resolveTutorStubConversationalCompletion,
} from '../tutorStubConversationalCompletion.js';

const GAZETTE_QUESTION =
  'What does the byline establish—and what does it leave unproved about who planted the false quote?';

function gazetteClassification(overrides = {}) {
  return {
    turn: {
      summary: 'Treats Crane as a possible culprit while withholding a verdict.',
      request_type: 'off_task_or_mixed',
      discourse_move: 'hypothesis',
      evidence_use: 'cites_public_evidence',
      epistemic_stance: 'grounded',
      ...overrides,
    },
  };
}

test('a relevant qualified Gazette answer closes the local question without becoming a strict DAG fact', () => {
  const completion = resolveTutorStubConversationalCompletion({
    mode: 'defeasible_human_scaffold',
    learnerText: 'Crane is a possible culprit, but not proven guilty.',
    previousTutorText: `The page bears Crane’s byline. ${GAZETTE_QUESTION}`,
    classification: gazetteClassification(),
    tutorLearnerDag: { advance: { supportedMoveCount: 0 }, accepted: { hypothesis: null } },
  });

  assert.equal(completion.resolved, true);
  assert.equal(completion.status, 'qualified');
  assert.equal(completion.reopenForbidden, true);
  assert.equal(completion.releaseNextClue, true);
  assert.match(completion.instruction, /do not ask for a safer restatement/iu);
});

test('a learner question and an uninformative dunno remain open', () => {
  const question = resolveTutorStubConversationalCompletion({
    mode: 'defeasible_human_scaffold',
    learnerText: 'Who else had access to the story?',
    previousTutorText: GAZETTE_QUESTION,
    classification: gazetteClassification({ discourse_move: 'clarification', request_type: 'clarification' }),
  });
  const dunno = resolveTutorStubConversationalCompletion({
    mode: 'defeasible_human_scaffold',
    learnerText: 'dunno',
    previousTutorText: GAZETTE_QUESTION,
    classification: gazetteClassification({
      summary: 'The learner does not offer an answer.',
      discourse_move: 'off_task',
      evidence_use: 'none',
      epistemic_stance: 'uncertain',
    }),
  });

  assert.equal(question.resolved, false);
  assert.equal(dunno.resolved, false);
});

test('the completion audit rejects reopening and an unsupported stronger endorsement', () => {
  const learnerText = 'Crane is a possible culprit, but not proven guilty.';
  const completion = resolveTutorStubConversationalCompletion({
    mode: 'defeasible_human_scaffold',
    learnerText,
    previousTutorText: GAZETTE_QUESTION,
    classification: gazetteClassification(),
  });
  const audit = auditTutorStubConversationalCompletionResponse({
    text: 'Exactly—the byline names Crane but does not prove who planted the quote. For now, can we record Crane as responsible for the filed story while leaving the planting unproved?',
    completion,
    learnerText,
  });

  assert.equal(audit.ok, false);
  assert.deepEqual(
    audit.issues.map((issue) => issue.type),
    ['resolved_point_reopened', 'unsupported_endorsement_request'],
  );
});

test('new public evidence permits a genuinely new question after concise uptake', () => {
  const learnerText = 'Crane is a possible culprit, but not proven guilty.';
  const completion = resolveTutorStubConversationalCompletion({
    mode: 'defeasible_human_scaffold',
    learnerText,
    previousTutorText: GAZETTE_QUESTION,
    classification: gazetteClassification(),
  });
  const dueEvidence =
    'The archive copy shows Crane filed clean prose; the false kicker was inserted after filing.';
  const audit = auditTutorStubConversationalCompletionResponse({
    text: `Exactly—Crane remains possible, not proven. ${dueEvidence} Whose later access should we test next?`,
    completion,
    learnerText,
    dueEvidenceSurfaces: [dueEvidence],
  });

  assert.equal(audit.ok, true);
});

test('completion makes forward pressure authoritative without changing closure or clarification actions', () => {
  const completion = {
    resolved: true,
    requiresNewPressure: true,
    status: 'accepted',
  };
  const staged = applyTutorStubConversationalCompletionSelection(
    {
      action_family: 'answer_accountably',
      expected_dag_move: 'Ask for a safer restatement.',
      response_configuration: { action_family: 'answer_accountably', compatibility: {} },
    },
    completion,
  );
  const closure = applyTutorStubConversationalCompletionSelection(
    { action_family: 'close_inquiry', response_configuration: { action_family: 'close_inquiry' } },
    completion,
  );

  assert.equal(staged.selection.action_family, 'stage_next_step');
  assert.match(staged.selection.expected_dag_move, /genuinely new public evidence/iu);
  assert.equal(closure.selection.action_family, 'close_inquiry');
});
