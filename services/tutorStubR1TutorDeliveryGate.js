// Registered face-B tutor-delivery enforcement (merged design revision 4+).
// The learner's bounded bridge duty is reachable only after the tutor has
// actually delivered the registered standing-conditions bridge. Judge the
// private tutor candidate before it is committed to public history: one
// semantic check, at most one tutor repair, one re-check, then a typed
// tutor-non-delivery outcome. The rejected draft is never public and the
// learner is never charged for it.
import { assertTutorStubTurnAttemptCurrent } from './tutorStubTurnAttempt.js';

export const TUTOR_STUB_TUTOR_BOUNDED_TEST_NON_DELIVERY_CODE = 'tutor_stub_tutor_bounded_test_non_delivery';
export const TUTOR_STUB_TUTOR_DISCRIMINATING_QUESTION_NON_DELIVERY_CODE =
  'tutor_stub_tutor_discriminating_question_non_delivery';

export async function applyTutorStubR1TutorDeliveryGate({
  state,
  response,
  turnNumber,
  learnerText,
  interventionApplied = false,
  adjudicateTutorDelivery,
  repairTutor,
  appendTraceEvent,
  signal = null,
  isCurrent = null,
} = {}) {
  const enforcement = state?.resistanceActionRegisterStudy?.design?.tutorDeliveryContract?.enforcement;
  if (!interventionApplied || enforcement?.check?.kind !== 'semantic_tutor_delivery_adjudication') {
    return response;
  }
  if (typeof adjudicateTutorDelivery !== 'function') {
    throw new Error('registered tutor-delivery enforcement requires its semantic adjudicator');
  }
  if (typeof repairTutor !== 'function') {
    throw new Error('registered tutor-delivery enforcement requires its tutor repair callback');
  }

  let candidate = response;
  let repairs = 0;
  let verdict = await adjudicateTutorDelivery({
    state,
    tutorText: candidate?.text || '',
    learnerText,
    turnNumber,
    candidateKind: 'initial',
    signal,
  });
  assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
  const maximumRepairs = Number(enforcement.repairsAllowedPerEpisode) || 0;
  while (!verdict.delivered && repairs < maximumRepairs) {
    appendTraceEvent(state.trace, {
      type: 'tutor_delivery_repair_requested',
      turn: turnNumber,
      attempt: repairs + 1,
      rejectedDraft: candidate?.text || '',
      publicTranscriptChanged: false,
    });
    candidate = await repairTutor({
      instruction: enforcement.repairInstruction,
      attempt: repairs + 1,
      signal,
    });
    assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
    repairs += 1;
    verdict = await adjudicateTutorDelivery({
      state,
      tutorText: candidate?.text || '',
      learnerText,
      turnNumber,
      candidateKind: `tutor-repair-${repairs}`,
      signal,
    });
    assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
  }

  state.tutorDeliveryEnforcement = {
    consumed: true,
    turn: turnNumber,
    delivered: verdict.delivered,
    repairAttempts: repairs,
  };
  appendTraceEvent(state.trace, {
    type: 'tutor_delivery_enforcement',
    turn: turnNumber,
    scope: enforcement.scope,
    delivered: verdict.delivered,
    quote: verdict.quote || null,
    repairAttempts: repairs,
    publicTranscriptChanged: false,
  });
  if (!verdict.delivered) {
    const study = state?.resistanceActionRegisterStudy?.resistant_learner_study;
    const error = new Error(
      study === 'B1'
        ? 'registered face-A tutor failed to deliver the discriminating question after the allowed repair'
        : 'registered face-B tutor failed to deliver the bounded standing-conditions test after the allowed repair',
    );
    error.code =
      enforcement.exhaustionCode ||
      (study === 'B1'
        ? TUTOR_STUB_TUTOR_DISCRIMINATING_QUESTION_NON_DELIVERY_CODE
        : TUTOR_STUB_TUTOR_BOUNDED_TEST_NON_DELIVERY_CODE);
    error.disposition = enforcement.exhaustionDisposition;
    error.substantiveStudyFailure = true;
    error.recoverable = false;
    error.neverScored = true;
    error.measurementDeterminate = false;
    throw error;
  }
  return candidate;
}

export default {
  applyTutorStubR1TutorDeliveryGate,
  TUTOR_STUB_TUTOR_BOUNDED_TEST_NON_DELIVERY_CODE,
  TUTOR_STUB_TUTOR_DISCRIMINATING_QUESTION_NON_DELIVERY_CODE,
};
