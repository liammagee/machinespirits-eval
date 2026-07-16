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
  assert.match(support.tutorInstruction, /using only public people, objects, and actions already in this scene/u);
  assert.doesNotMatch(support.tutorInstruction, /custody evidence|expert recognition|forge|tool/iu);
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
  assert.match(fallback, /A\) a plain explanation of the clue/u);
  assert.match(fallback, /B\) to look at the next piece of evidence/u);
  assert.doesNotMatch(fallback, /condition in the rule|whole case|supporting step|complete answer/iu);
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

test('a natural concrete choice and an offer to clarify satisfy bounded support', () => {
  const support = {
    guardRequired: true,
    modality: 'bounded_directional_choice',
    clarificationInvitationRequired: true,
  };
  const text =
    'Exactly. The badge and lift notice show that Wrenfold could enter and clear the fridge; they do not show that Priya’s lunchbox was moved. Shall we check lost property for a matching entry, or pause to clarify that difference?';

  assert.equal(auditTutorStubQuestionSupportResponse({ text, support }).ok, true);
  assert.equal(
    auditTutorStubQuestionSupportResponse({
      text: 'The badge shows that the crew entered at noon. We still need either their authority or what their visit involved. Which part of that distinction needs clarifying?',
      support,
    }).ok,
    true,
  );
});

test('learner-facing ask-plus-meaning options are clarification invitations', () => {
  const support = {
    guardRequired: true,
    modality: 'stage_then_bounded_choice',
    clarificationInvitationRequired: true,
  };
  for (const text of [
    'You could write that G17 was present there, or ask what “resident strain” means. What changes?',
    'You may unpack whichever connection is unclear, or choose the swab. Which do you want?',
    'You could ask which term needs explaining, or read the quarantine entry. Which first?',
  ]) {
    assert.equal(auditTutorStubQuestionSupportResponse({ text, support }).ok, true, text);
  }
  for (const text of [
    'The report asks what resident strain means. What changes?',
    'Or ask who contaminated Corvat. What changes?',
  ]) {
    assert.equal(auditTutorStubQuestionSupportResponse({ text, support }).ok, false, text);
  }
});

test('a natural what-or contrast counts as a bounded directional choice', () => {
  const support = {
    guardRequired: true,
    modality: 'bounded_directional_choice',
    clarificationInvitationRequired: false,
  };
  const text =
    'What still lacks a mark: that this coin bears a die cut by Verrell’s graver, or merely that he owns the graver?';

  assert.equal(auditTutorStubQuestionSupportResponse({ text, support }).ok, true);
});

test('an is-or question over two public exhibit readings is a bounded choice', () => {
  const support = {
    guardRequired: true,
    modality: 'bounded_directional_choice',
    clarificationInvitationRequired: false,
  };
  const text = 'Is the next want a mark on the coin itself, or a closer reckoning of the graver?';

  assert.equal(auditTutorStubQuestionSupportResponse({ text, support }).ok, true);
});

test('a does-or question over two public readings is a bounded choice', () => {
  const support = {
    guardRequired: true,
    modality: 'bounded_directional_choice',
    clarificationInvitationRequired: false,
  };
  const text = 'Does the key settle access, or the brig’s course?';

  assert.equal(auditTutorStubQuestionSupportResponse({ text, support }).ok, true);
});

test('an imperative choice among three named public checks is bounded support', () => {
  const support = {
    guardRequired: true,
    modality: 'bounded_directional_choice',
    clarificationInvitationRequired: false,
  };
  const text =
    'Choose our next check: the basin under the trough, the lead-sweat on the coin, or wormwood signs in the cup.';

  assert.equal(auditTutorStubQuestionSupportResponse({ text, support }).ok, true);
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

test('a natural offer to explain what a term means satisfies the clarification invitation', () => {
  const support = buildTutorStubQuestionSupport({
    tutorTurn: 7,
    scaffoldState: scaffold(),
    assessment: { missingPremiseBuckets: { released_but_not_held: 1 } },
    classification: { turn: { pedagogical_need: 'plain_language', epistemic_stance: 'confused' } },
    learnerText: 'What is a cupel?',
  });

  const audit = auditTutorStubQuestionSupportResponse({
    text: 'A cupel is the porous dish used in the assay. Would you want me to say what “porous” means?',
    support,
  });

  assert.equal(audit.ok, true);
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

test('internal proof-map language is rejected even when no extra question scaffold is required', () => {
  const audit = auditTutorStubQuestionSupportResponse({
    text: 'What mark on the coin would make that second branch speak?',
    support: { guardRequired: false },
  });

  assert.equal(audit.ok, false);
  assert.deepEqual(
    audit.issues.map((issue) => issue.type),
    ['abstract_proof_language'],
  );
});

test('a purposeful stepwise move is not misread as learner struggle', () => {
  const support = buildTutorStubQuestionSupport({
    tutorTurn: 1,
    scaffoldState: scaffold({ dueNow: [{ premise: 'p_assay', turn: 1 }] }),
    assessment: { missingPremises: [{ premiseId: 'p_assay', bucket: 'unreleased', releaseTurn: 1 }] },
    classification: {
      turn: {
        request_type: 'stepwise_support_request',
        epistemic_stance: 'reflective',
        pedagogical_need: 'Stage relevant assay evidence.',
      },
    },
    learnerText: 'I would first set down the weights and touchstone marks before naming any hand.',
  });

  assert.equal(support.guardRequired, false);
  assert.equal(support.clarificationInvitationRequired, false);
  assert.equal(support.modality, 'stage_then_ask');
});

test('a tentative overreach is corrected without being misread as confusion', () => {
  const support = buildTutorStubQuestionSupport({
    tutorTurn: 2,
    scaffoldState: scaffold({ nextRelease: { premise: 'p_alloy', turn: 3 } }),
    assessment: {
      missingPremises: [{ premiseId: 'p_alloy', bucket: 'unreleased', releaseTurn: 3 }],
    },
    classification: {
      turn: {
        request_type: 'answer_seeking_or_overreach',
        epistemic_stance: 'reflective',
        affect: 'tentative',
      },
    },
    learnerText:
      'If it led to Verrell’s crucible, it would support that he made the false shillings; I suppose it would not yet prove he struck them himself.',
  });

  assert.equal(support.modality, 'embedded_directional_hint');
  assert.equal(support.clarificationInvitationRequired, false);
  assert.equal(
    auditTutorStubQuestionSupportResponse({
      text: 'I tap the balance beam: precisely. Casting a blank is not yet striking a shilling. What is still missing: the blank, the die, or the finished coin?',
      support,
    }).ok,
    true,
  );
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

test('an unanswered-question complaint requires a direct answer instead of another choice', () => {
  const support = buildTutorStubQuestionSupport({
    tutorTurn: 3,
    scaffoldState: scaffold({ nextRelease: { premise: 'p_permit', turn: 5 } }),
    assessment: { missingPremiseBuckets: { unreleased: 1 } },
    classification: { turn: { request_type: 'stepwise_support_request', discourse_move: 'repair_request' } },
    learnerText: 'still not answering my question',
    recentTurns: [
      {
        learner: "you didn't answer my question though",
        classification: { turn: { request_type: 'stepwise_support_request' } },
      },
    ],
  });

  assert.equal(support.modality, 'direct_answer_then_direction');
  assert.equal(support.responsiveRepairRequired, true);
  assert.equal(support.adaptiveMultipleChoice, false);
  assert.equal(
    auditTutorStubQuestionSupportResponse({
      text: 'You’re right. Yes, the badge log is a record of who entered the kitchen; it records Dario and the visitor crew.',
      support,
    }).ok,
    true,
  );
  assert.equal(
    auditTutorStubQuestionSupportResponse({
      text: 'A) check the badge, or B) check the notice?',
      support,
    }).ok,
    false,
  );
  assert.equal(
    auditTutorStubQuestionSupportResponse({ text: 'You’re right—I should have answered directly.', support }).ok,
    false,
  );
});
