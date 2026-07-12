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
    true,
  );
  assert.match(deterministicTutorStubQuestionSupportFallback(support), /A\) a record of custody/u);
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
  assert.match(support.tutorInstruction, /State the due evidence/u);
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
