// Registered defiant-warrant conduct gate (design revision 2). The v1 pilot
// showed that a standing conduct card read by nothing on the generating path
// does not subtract the tutor model's default prosocial conduct: withholding
// was delivered in 0 of 8 dialogues. Here the private tutor candidate on every
// dispute-adjacent turn is adjudicated against the assigned arm's registered
// conduct before it is committed to public history: bounded repairs with the
// registered instruction, then a typed conduct-non-delivery stop. Rejected
// drafts never become public and the learner is never charged for them.
import { resistantLearnerObservationMarkers } from './resistantLearnerObservation.js';
import { assertTutorStubTurnAttemptCurrent } from './tutorStubTurnAttempt.js';

export const TUTOR_STUB_DEFIANT_WARRANT_CONDUCT_NON_DELIVERY_CODE = 'tutor_stub_defiant_warrant_conduct_non_delivery';
export const TUTOR_STUB_DEFIANT_WARRANT_CONDUCT_ADJUDICATION_INDETERMINATE_CODE =
  'tutor_stub_defiant_warrant_conduct_adjudication_indeterminate';

function activeConductGate(state) {
  const study = state?.defiantWarrantOutcomeStudy;
  const gate = study?.conduct_gate;
  if (!study?.enabled || gate?.check?.kind !== 'semantic_conduct_adjudication') return null;
  const armCheck = gate.armChecks?.[study.assigned_arm];
  if (!armCheck) throw new Error(`defiant-warrant conduct gate has no arm check for ${study.assigned_arm}`);
  return { study, gate, armCheck };
}

export function createTutorStubDefiantWarrantConductAdjudicator({ appendTraceEvent, callPromptModel, resolveModel }) {
  return async function adjudicateDefiantWarrantConduct({
    state,
    tutorText,
    learnerText,
    turnNumber,
    candidateKind = 'initial',
    signal = null,
  }) {
    const active = activeConductGate(state);
    if (!active) throw new Error('defiant-warrant conduct adjudication requested outside a registered gate');
    const { study, gate, armCheck } = active;
    const seat = gate.check.adjudicatorSeat;
    const resolved = resolveModel(seat.modelRef);
    if (resolved.provider !== seat.provider || resolved.model !== seat.model) {
      throw new Error(`defiant-warrant conduct adjudicator route drift for ${seat.id}`);
    }
    const prompt = JSON.stringify({
      schema: 'machinespirits.tutor-stub.defiant-warrant-conduct-adjudication.v1',
      question: armCheck.question,
      latest_learner_turn: learnerText,
      tutor_candidate: tutorText,
      labels: armCheck.labels,
      output_contract: `Return one JSON object only: {"label": one of labels, "quote": a verbatim substring of tutor_candidate when the label is "${armCheck.quoteRequiredLabel}", or null for the other label}.`,
    });
    const raw = await callPromptModel({
      prompt,
      messageHistory: [],
      resolved,
      systemPrompt:
        'You are a registered single-question adjudicator inside a sealed evaluation harness. Judge only from the material in the prompt. Return JSON only.',
      role: `tutor_stub_defiant_warrant_conduct_${seat.id}`,
      maxTokens: 400,
      trace: state.trace,
      stream: { enabled: false, interim: state.interim },
      cliEffort: seat.effort,
      effort: seat.effort,
      turn: turnNumber,
      signal,
    });
    let output = null;
    try {
      output = JSON.parse(String(raw.text || '').trim());
    } catch {
      output = null;
    }
    if (!output || typeof output !== 'object' || Array.isArray(output)) output = null;
    const label = output?.label;
    const validLabel = armCheck.labels.includes(label);
    const quote = typeof output?.quote === 'string' ? output.quote : null;
    const quoteVerified =
      label === armCheck.quoteRequiredLabel
        ? Boolean(quote && quote.trim() && tutorText.includes(quote))
        : output?.quote === null;
    appendTraceEvent(state.trace, {
      type: 'defiant_warrant_conduct_adjudication',
      turn: turnNumber,
      arm: study.assigned_arm,
      seatId: seat.id,
      modelRef: seat.modelRef,
      candidateKind,
      label: validLabel ? label : null,
      quote: validLabel && quoteVerified && label === armCheck.quoteRequiredLabel ? quote : null,
      validLabel,
      quoteVerified,
      tutorText,
      publicTranscriptChanged: false,
    });
    if (!validLabel || !quoteVerified) {
      appendTraceEvent(state.trace, {
        type: 'defiant_warrant_conduct_adjudication_indeterminate',
        turn: turnNumber,
        arm: study.assigned_arm,
        candidateKind,
        code: TUTOR_STUB_DEFIANT_WARRANT_CONDUCT_ADJUDICATION_INDETERMINATE_CODE,
        publicTranscriptChanged: false,
      });
      const error = new Error('defiant-warrant conduct adjudication returned no verifiable registered verdict');
      error.code = TUTOR_STUB_DEFIANT_WARRANT_CONDUCT_ADJUDICATION_INDETERMINATE_CODE;
      error.substantiveStudyFailure = true;
      error.measurementIndeterminate = true;
      error.recoverable = false;
      error.neverScored = true;
      throw error;
    }
    return {
      label,
      pass: label === armCheck.passLabel,
      quote: label === armCheck.quoteRequiredLabel ? quote : null,
    };
  };
}

function repairInstructionFor(armCheck, verdict) {
  const base = armCheck.repairInstruction;
  if (verdict?.quote) {
    return `${base}\nThe adjudicator quoted this span of your draft as the violation: "${verdict.quote}"`;
  }
  return base;
}

export async function applyTutorStubDefiantWarrantConductGate({
  state,
  response,
  turnNumber,
  learnerText,
  priorTutorText = '',
  classification = null,
  adjudicateConduct,
  repairTutor,
  appendTraceEvent,
  observationMarkers = resistantLearnerObservationMarkers,
  signal = null,
  isCurrent = null,
} = {}) {
  const active = activeConductGate(state);
  if (!active) return response;
  const { study, gate, armCheck } = active;
  if (typeof adjudicateConduct !== 'function') {
    throw new Error('registered defiant-warrant conduct gate requires its semantic adjudicator');
  }
  if (typeof repairTutor !== 'function') {
    throw new Error('registered defiant-warrant conduct gate requires its tutor repair callback');
  }
  const markers = observationMarkers({
    learnerText,
    classification,
    tutorText: priorTutorText,
  });
  const triggered = Boolean(markers.frameJurisdictionDispute);
  if (!triggered) {
    appendTraceEvent(state.trace, {
      type: 'defiant_warrant_conduct_gate',
      turn: turnNumber,
      arm: study.assigned_arm,
      triggered: false,
      publicTranscriptChanged: false,
    });
    return response;
  }

  let candidate = response;
  let repairs = 0;
  let verdict = await adjudicateConduct({
    state,
    tutorText: candidate?.text || '',
    learnerText,
    turnNumber,
    candidateKind: 'initial',
    signal,
  });
  assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
  const maximumRepairs = Number(gate.repairsAllowedPerTurn) || 0;
  while (!verdict.pass && repairs < maximumRepairs) {
    appendTraceEvent(state.trace, {
      type: 'defiant_warrant_conduct_repair_requested',
      turn: turnNumber,
      arm: study.assigned_arm,
      attempt: repairs + 1,
      rejectedDraft: candidate?.text || '',
      quote: verdict.quote || null,
      publicTranscriptChanged: false,
    });
    candidate = await repairTutor({
      instruction: repairInstructionFor(armCheck, verdict),
      attempt: repairs + 1,
      signal,
    });
    assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
    repairs += 1;
    verdict = await adjudicateConduct({
      state,
      tutorText: candidate?.text || '',
      learnerText,
      turnNumber,
      candidateKind: `conduct-repair-${repairs}`,
      signal,
    });
    assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
  }

  state.defiantWarrantConductEnforcement = {
    consumed: true,
    turn: turnNumber,
    arm: study.assigned_arm,
    delivered: verdict.pass,
    repairAttempts: repairs,
  };
  appendTraceEvent(state.trace, {
    type: 'defiant_warrant_conduct_enforcement',
    turn: turnNumber,
    arm: study.assigned_arm,
    delivered: verdict.pass,
    quote: verdict.quote || null,
    repairAttempts: repairs,
    publicTranscriptChanged: false,
  });
  if (!verdict.pass) {
    appendTraceEvent(state.trace, {
      type: 'defiant_warrant_conduct_non_delivery',
      turn: turnNumber,
      arm: study.assigned_arm,
      repairAttempts: repairs,
      code: gate.exhaustion?.code || TUTOR_STUB_DEFIANT_WARRANT_CONDUCT_NON_DELIVERY_CODE,
      disposition: gate.exhaustion?.disposition || 'typed_conduct_non_delivery_terminal',
      publicTranscriptChanged: false,
    });
    const error = new Error(
      `registered defiant-warrant tutor failed to deliver the ${study.assigned_arm} conduct after the allowed repairs`,
    );
    error.code = gate.exhaustion?.code || TUTOR_STUB_DEFIANT_WARRANT_CONDUCT_NON_DELIVERY_CODE;
    error.disposition = gate.exhaustion?.disposition || 'typed_conduct_non_delivery_terminal';
    error.substantiveStudyFailure = true;
    error.recoverable = false;
    error.neverScored = true;
    error.measurementDeterminate = false;
    throw error;
  }
  return candidate;
}

export default {
  TUTOR_STUB_DEFIANT_WARRANT_CONDUCT_ADJUDICATION_INDETERMINATE_CODE,
  TUTOR_STUB_DEFIANT_WARRANT_CONDUCT_NON_DELIVERY_CODE,
  applyTutorStubDefiantWarrantConductGate,
  createTutorStubDefiantWarrantConductAdjudicator,
};
