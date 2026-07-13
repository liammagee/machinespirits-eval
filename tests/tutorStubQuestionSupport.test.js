import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditTutorStubQuestionSupportResponse,
  buildTutorStubQuestionSupport,
  deterministicTutorStubQuestionSupportFallback,
} from '../services/tutorStubQuestionSupport.js';

function scaffold({ dueNow = [], nextRelease = null } = {}) {
  return { releaseState: { dueNow, nextRelease } };
}

test('unreleased evidence produces an embedded direction instead of an open recall quiz', () => {
  const support = buildTutorStubQuestionSupport({
    tutorTurn: 19,
    scaffoldState: scaffold({ nextRelease: { premise: 'p_holder', turn: 22 } }),
    assessment: {
      missingPremiseBuckets: { released_but_not_held: 3, unreleased: 1 },
    },
    classification: { turn: { epistemic_stance: 'grounded' } },
    learnerText: 'not Verrell',
  });

  assert.equal(support.answerability, 'direction_only_until_evidence_is_public');
  assert.equal(support.modality, 'embedded_directional_hint');
  assert.equal(support.guardRequired, true);
  assert.equal(support.clarificationInvitationRequired, false);
  assert.deepEqual(support.learnerMoves, ['use_the_public_direction', 'ask_which_clue', 'ask_what_term_means']);
  assert.match(support.tutorInstruction, /Do not ask the learner to invent/u);
});

test('uncertainty before release selects a bounded public-safe choice', () => {
  const support = buildTutorStubQuestionSupport({
    tutorTurn: 20,
    scaffoldState: scaffold({ nextRelease: { premise: 'p_holder', turn: 22 } }),
    assessment: {
      missingPremises: [{ premiseId: 'p_holder', bucket: 'unreleased', releaseTurn: 22 }],
    },
    classification: { turn: { epistemic_stance: 'confused', request_type: 'stepwise_support_request' } },
    learnerText: "I don't know",
  });

  assert.equal(support.modality, 'bounded_directional_choice');
  assert.equal(support.adaptiveMultipleChoice, true);
  assert.equal(support.clarificationInvitationRequired, true);
  assert.equal(
    auditTutorStubQuestionSupportResponse({
      text: 'What kind of workshop record might show that?',
      support,
    }).ok,
    false,
  );
  assert.equal(
    auditTutorStubQuestionSupportResponse({
      text: 'Which is safer: A) custody evidence, B) recognizing the cut, or C) being near a forge?',
      support,
    }).ok,
    false,
  );
  assert.equal(
    auditTutorStubQuestionSupportResponse({
      text: 'Which is safer: A) custody evidence, B) recognizing the cut, or C) being near a forge? If any term is unclear, ask me to explain it.',
      support,
    }).ok,
    true,
  );
  const fallback = deterministicTutorStubQuestionSupportFallback({
    support,
    world: { title: 'The Missing Lunchbox', question: 'Who moved the lunchbox?' },
  });
  assert.match(fallback, /Who moved the lunchbox/u);
  assert.match(fallback, /A\) this clue establishes one condition/u);
  assert.doesNotMatch(fallback, /tool|forge|cut|decisive act/iu);
});

test('a scenario-grounded two-part contrast satisfies bounded directional support', () => {
  const support = buildTutorStubQuestionSupport({
    tutorTurn: 1,
    scaffoldState: scaffold({ nextRelease: { premise: 'p_byline', turn: 2 } }),
    assessment: {
      missingPremiseBuckets: { unreleased: 1, unscheduled: 0 },
      missingPremises: [{ premiseId: 'p_byline', bucket: 'unreleased', releaseTurn: 2 }],
    },
    classification: { turn: { epistemic_stance: 'neutral' } },
    learnerText: 'sorry, where are we?',
    multipleChoice: true,
  });

  const result = auditTutorStubQuestionSupportResponse({
    text: 'We are tracing the false quote. Should we clarify the difference between whose story it was and who inserted the quote?',
    support,
  });

  assert.equal(result.ok, true);
});

test('due evidence is staged before interpretation is requested', () => {
  const support = buildTutorStubQuestionSupport({
    tutorTurn: 22,
    scaffoldState: scaffold({ dueNow: [{ premise: 'p_holder', turn: 22 }] }),
    assessment: {
      missingPremises: [{ premiseId: 'p_holder', bucket: 'unreleased', releaseTurn: 22 }],
    },
    classification: { turn: { epistemic_stance: 'confused' } },
    learnerText: 'the die-sinker?',
    recentTurns: [{ learner: "I don't know", classification: { turn: { epistemic_stance: 'confused' } } }],
  });

  assert.equal(support.answerability, 'answerable_after_staging');
  assert.equal(support.modality, 'stage_then_bounded_choice');
  assert.equal(support.clarificationInvitationRequired, true);
  assert.match(support.tutorInstruction, /State the due evidence/u);
});

test('a struggling learner is visibly allowed to answer a tutor question with a clarification question', () => {
  const support = buildTutorStubQuestionSupport({
    tutorTurn: 7,
    scaffoldState: scaffold(),
    assessment: { missingPremiseBuckets: { released_but_not_held: 1 } },
    classification: { turn: { pedagogical_need: 'plain_language', epistemic_stance: 'confused' } },
    learnerText: 'What does cupel mean?',
  });

  assert.equal(support.modality, 'embedded_public_hint');
  assert.equal(support.guardRequired, true);
  assert.equal(
    auditTutorStubQuestionSupportResponse({
      text: 'The cupel is the small porous assay dish. What does that change about the residue?',
      support,
    }).ok,
    false,
  );
  assert.equal(
    auditTutorStubQuestionSupportResponse({
      text: 'The cupel is the small porous assay dish. What does that change about the residue? If the clue is still unclear, ask me which part to explain.',
      support,
    }).ok,
    true,
  );
});

test('ordinary open questions must name the clue plainly instead of using an opaque placeholder', () => {
  const support = buildTutorStubQuestionSupport({
    tutorTurn: 7,
    scaffoldState: scaffold(),
    assessment: { missingPremiseBuckets: { released_but_not_held: 1 } },
    classification: { turn: { epistemic_stance: 'grounded' } },
    learnerText: 'The residue matches the mint alloy.',
  });

  assert.equal(support.modality, 'open_question');
  assert.equal(support.guardRequired, false);
  assert.deepEqual(support.learnerMoves, ['answer_from_public_evidence', 'ask_which_clue', 'ask_what_term_means']);
  assert.match(support.tutorInstruction, /Name the clue in plain language/u);
  assert.match(support.tutorInstruction, /clarification question/u);
});

test('adaptive choices cool down so the next scaffold is embedded in discourse', () => {
  const support = buildTutorStubQuestionSupport({
    tutorTurn: 21,
    scaffoldState: scaffold({ nextRelease: { premise: 'p_holder', turn: 22 } }),
    assessment: { missingPremiseBuckets: { unreleased: 1 } },
    classification: { turn: { epistemic_stance: 'confused' } },
    learnerText: "I still don't know",
    recentTurns: [
      {
        humanDiscourseFrame: {
          questionSupport: { adaptiveMultipleChoice: true },
        },
      },
    ],
  });

  assert.equal(support.modality, 'embedded_directional_hint');
  assert.equal(support.adaptiveMultipleChoice, false);
  assert.equal(support.adaptiveChoiceCoolingDown, true);
});

test('natural clarification questions are not mistaken for unseen-record recall', () => {
  const support = {
    guardRequired: true,
    clarificationInvitationRequired: true,
    modality: 'embedded_public_hint',
  };

  assert.equal(
    auditTutorStubQuestionSupportResponse({
      text: 'Here are the four clues we have already seen. Which record—or term—needs clarifying first?',
      support,
    }).ok,
    true,
  );
  assert.equal(
    auditTutorStubQuestionSupportResponse({
      text: 'We can take the clues one at a time. Which clue should we examine first?',
      support,
    }).ok,
    true,
  );
  assert.equal(
    auditTutorStubQuestionSupportResponse({
      text: 'What record could connect the tool to a person?',
      support,
    }).ok,
    false,
  );
});
