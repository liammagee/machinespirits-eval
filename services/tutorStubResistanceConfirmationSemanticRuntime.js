import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { recordFileDigest } from './recordedFileDigest.js';
import {
  TUTOR_STUB_RESISTANCE_FIDELITY_OUTPUT_SCHEMA_V8,
  TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_OUTPUT_SCHEMA_V8,
  adjudicateTutorStubResistanceFidelityPanelV8,
  adjudicateTutorStubResistanceRecoveryPrimaryPanelV8,
  buildTutorStubResistanceFidelityPromptV8,
  buildTutorStubResistanceRecoveryPrimaryPromptV8,
  tutorStubResistanceMeasurementSha256,
  wrapTutorStubResistanceMeasurementModelOutputV8,
} from './tutorStubResistanceRecoverySemanticAdjudicationV8.js';
import {
  adjudicateTutorStubResistanceFidelityPanelV9,
  adjudicateTutorStubResistanceRecoveryPrimaryPanelV9,
  validateTutorStubResistanceRecoverySemanticRegistrationV9,
} from './tutorStubResistanceRecoverySemanticAdjudicationV9.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INSTRUMENT_PATH = 'config/tutor-stub-resistance-recovery-semantic-adjudication-registration.v8.json';
const INSTRUMENT_PATH_V9 = 'config/tutor-stub-resistance-recovery-semantic-adjudication-registration.v9.json';
const SYSTEM_PROMPT =
  'You are one independent semantic adjudicator. Use only the supplied public packet. Return the registered JSON object, use no tools, and do not infer treatment assignment, hidden state, or another judge output.';

function sha256File(relative) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(ROOT, relative)))
    .digest('hex');
}

function parseModelOutput(text) {
  const value = JSON.parse(String(text || '').trim());
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('confirmation semantic response is not one JSON object');
  }
  return value;
}

function finalHorizonPacket(state, learnerText) {
  const study = state?.resistanceActionRegisterStudy;
  const triggerTurn = Number(study?.trigger_turn);
  const trigger = state?.turns?.find((row) => Number(row.turn) === triggerTurn);
  const intervening = state?.turns?.find((row) => Number(row.turn) === triggerTurn + 1);
  if (!trigger || !intervening || !String(learnerText || '').trim()) {
    throw new Error('confirmation semantic outcome requires its exact complete public horizon');
  }
  const publicPacket = {
    trigger: String(trigger.learner || ''),
    intervention: String(trigger.tutor || ''),
    prior_post_trigger: String(intervening.learner || ''),
    intervening_tutor: String(intervening.tutor || ''),
    current_learner: String(learnerText),
  };
  if (Object.values(publicPacket).some((value) => !value.trim())) {
    throw new Error('confirmation semantic outcome public packet contains an empty turn');
  }
  return publicPacket;
}

export function loadTutorStubResistanceConfirmationSemanticInstrument(registration) {
  const binding = registration?.outcomeSemanticAdjudication;
  const instrumentPath = binding?.instrumentRegistrationPath;
  if (registration?.version < 9 || ![INSTRUMENT_PATH, INSTRUMENT_PATH_V9].includes(instrumentPath)) {
    throw new Error('confirmation semantic outcome instrument binding drifted');
  }
  // The instrument registration is named by path above. Its bytes are recorded.
  const digestRecord = recordFileDigest({
    root: ROOT,
    filePath: instrumentPath,
    recordedSha256: binding?.instrumentRegistrationSha256,
    label: 'confirmation semantic outcome instrument registration',
  });
  const instrument = JSON.parse(fs.readFileSync(path.join(ROOT, instrumentPath), 'utf8'));
  if (instrument.version === 9) {
    const validation = validateTutorStubResistanceRecoverySemanticRegistrationV9(instrument);
    if (!validation.valid)
      throw new Error(`confirmation semantic V9 instrument invalid: ${validation.issues.join('; ')}`);
    return { path: instrumentPath, sha256: sha256File(instrumentPath), digestRecord, registration: instrument };
  }
  if (
    instrument?.schema !== 'machinespirits.tutor-stub.resistance-recovery-semantic-adjudication-registration.v8' ||
    instrument?.version !== 8 ||
    instrument?.measurement?.judges?.length !== 3 ||
    instrument?.instrument?.primaryAndFidelityPromptCallsSeparate !== true ||
    instrument?.instrument?.fidelityPacketContainsLearnerOutcome !== false ||
    instrument?.evidenceProtocol?.regexKeywordLexicalOrGeneratorSemanticAuthority !== 'none'
  ) {
    throw new Error('confirmation semantic outcome instrument contract drifted');
  }
  return { path: instrumentPath, sha256: sha256File(instrumentPath), digestRecord, registration: instrument };
}

export function createTutorStubResistanceConfirmationSemanticRuntime({
  appendTraceEvent,
  callPromptModel,
  resolveModel,
} = {}) {
  if (
    typeof appendTraceEvent !== 'function' ||
    typeof callPromptModel !== 'function' ||
    typeof resolveModel !== 'function'
  ) {
    throw new Error('confirmation semantic runtime dependencies are incomplete');
  }

  async function callSeat({ state, turnNumber, caseId, instrument, prompt, judge, signal }) {
    const resolved = resolveModel(judge.modelRef);
    if (resolved.provider !== judge.provider || resolved.model !== judge.model) {
      throw new Error(`confirmation semantic judge route drift for ${judge.id}`);
    }
    const independentRunId = crypto.randomUUID();
    const role = `tutor_stub_resistance_semantic_confirmation_${instrument}_${judge.id}`;
    let raw = null;
    let record = null;
    let invalidReason = null;
    try {
      raw = await callPromptModel({
        prompt: JSON.stringify(prompt),
        messageHistory: [],
        resolved,
        systemPrompt: SYSTEM_PROMPT,
        role,
        maxTokens: 1400,
        trace: state.trace,
        stream: { enabled: false, interim: state.interim },
        cliEffort: judge.effort,
        effort: judge.effort,
        outputSchema:
          instrument === 'primary_recovery'
            ? TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_OUTPUT_SCHEMA_V8
            : TUTOR_STUB_RESISTANCE_FIDELITY_OUTPUT_SCHEMA_V8,
        semanticRetryDelaysMs: [15000, 45000],
        turn: turnNumber,
        signal,
      });
      const modelOutput = parseModelOutput(raw.text);
      if (modelOutput.case_id !== caseId) throw new Error('confirmation semantic response case id mismatch');
      record = wrapTutorStubResistanceMeasurementModelOutputV8({
        instrument,
        modelOutput,
        prompt,
        judge,
        observedProvider: raw.provider,
        observedModel: raw.model,
        observedEffort: raw.effort || raw.reasoningEffort,
        independentRunId,
        structuredOutput: raw.structuredOutput,
        prohibitedToolEvents: raw.prohibitedToolEventCountObserved === true ? raw.prohibitedToolEventCount : null,
        modelAttestationBasis: raw.modelAttestationBasis,
        modelIndependentlyAttested: raw.modelIndependentlyAttested,
      });
    } catch (error) {
      if (signal?.aborted || error?.name === 'AbortError') throw error;
      invalidReason = error.message;
    }
    appendTraceEvent(state.trace, {
      type: 'resistance_confirmation_semantic_judge_result',
      turn: turnNumber,
      caseId,
      instrument,
      judgeId: judge.id,
      role,
      independentRunId,
      promptSha256: tutorStubResistanceMeasurementSha256(prompt),
      packetSha256: prompt.packet_sha256,
      expectedProvider: resolved.provider,
      expectedModel: resolved.model,
      expectedEffort: judge.effort,
      transportCompleted: raw !== null,
      validModelEnvelope: record !== null,
      invalidReason,
      record,
      publicTranscriptChanged: false,
    });
    return record;
  }

  async function adjudicateInterventionFidelity({ state, turnNumber, intervention, signal = null } = {}) {
    const study = state?.resistanceActionRegisterStudy;
    const caseId = study?.job_id;
    if (!caseId || study?.dynamic_confirmation !== true || study?.registration?.version < 9) {
      throw new Error('intervention fidelity requires one registered semantic-panel dialogue');
    }
    const loaded = loadTutorStubResistanceConfirmationSemanticInstrument(study.registration);
    const text = String(intervention || '');
    if (!text.trim()) throw new Error('intervention fidelity requires the exact public tutor intervention');
    const fidelityPrompts = Object.fromEntries(
      loaded.registration.measurement.judges.map((judge) => [
        judge.id,
        buildTutorStubResistanceFidelityPromptV8({ caseId, intervention: text, judge }),
      ]),
    );
    const fidelityResponses = [];
    for (const judge of loaded.registration.measurement.judges) {
      const record = await callSeat({
        state,
        turnNumber,
        caseId,
        instrument: 'intervention_fidelity',
        prompt: fidelityPrompts[judge.id],
        judge,
        signal,
      });
      if (record) fidelityResponses.push(record);
    }
    const fidelity =
      loaded.registration.version === 9
        ? adjudicateTutorStubResistanceFidelityPanelV9({
            caseId,
            intervention: text,
            responses: fidelityResponses,
            registration: loaded.registration,
            prompts: fidelityPrompts,
          })
        : adjudicateTutorStubResistanceFidelityPanelV8({
            caseId,
            intervention: text,
            responses: fidelityResponses,
            registration: loaded.registration,
            prompts: fidelityPrompts,
          });
    if (study.manipulation_validation === true) {
      appendTraceEvent(state.trace, {
        type: 'resistance_action_register_manipulation_validation_fidelity',
        turn: turnNumber,
        schema: 'machinespirits.tutor-stub.resistance-action-register-manipulation-validation-result.v1',
        case_id: caseId,
        instrument: { path: loaded.path, sha256: loaded.sha256 },
        intervention_sha256: tutorStubResistanceMeasurementSha256(text),
        fidelity,
        measurement_disposition: fidelity.status === 'determinate' ? 'determinate' : 'measurement_indeterminate',
        assigned_treatment_hidden_from_judges: true,
        learner_outcome_generated_or_judged: false,
        regex_keyword_or_generator_semantic_authority: 'none',
        repair_rerun_replacement_or_selection_allowed: false,
        publicTranscriptChanged: false,
      });
    }
    return { loaded, fidelity };
  }

  async function adjudicateFinalHorizon({ state, turnNumber, learnerText, signal = null } = {}) {
    const study = state?.resistanceActionRegisterStudy;
    const caseId = study?.job_id;
    if (!caseId || study?.dynamic_confirmation !== true || study?.registration?.version < 9) {
      throw new Error('confirmation semantic outcome requires one registered V9 dialogue');
    }
    const loaded = loadTutorStubResistanceConfirmationSemanticInstrument(study.registration);
    const publicPacket = finalHorizonPacket(state, learnerText);
    const primaryPrompts = Object.fromEntries(
      loaded.registration.measurement.judges.map((judge) => [
        judge.id,
        buildTutorStubResistanceRecoveryPrimaryPromptV8({ caseId, publicPacket, judge }),
      ]),
    );
    const primaryResponses = [];
    for (const judge of loaded.registration.measurement.judges) {
      const record = await callSeat({
        state,
        turnNumber,
        caseId,
        instrument: 'primary_recovery',
        prompt: primaryPrompts[judge.id],
        judge,
        signal,
      });
      if (record) primaryResponses.push(record);
    }
    const primary =
      loaded.registration.version === 9
        ? adjudicateTutorStubResistanceRecoveryPrimaryPanelV9({
            caseId,
            publicPacket,
            responses: primaryResponses,
            registration: loaded.registration,
            prompts: primaryPrompts,
          })
        : adjudicateTutorStubResistanceRecoveryPrimaryPanelV8({
            caseId,
            publicPacket,
            responses: primaryResponses,
            registration: loaded.registration,
            prompts: primaryPrompts,
          });

    const { fidelity } = await adjudicateInterventionFidelity({
      state,
      turnNumber,
      intervention: publicPacket.intervention,
      signal,
    });
    const result = {
      schema: 'machinespirits.tutor-stub.resistance-confirmation-semantic-outcome.v9',
      case_id: caseId,
      instrument: { path: loaded.path, sha256: loaded.sha256 },
      public_packet_sha256: tutorStubResistanceMeasurementSha256(publicPacket),
      primary,
      fidelity,
      measurement_disposition:
        primary.status === 'determinate' && fidelity.status === 'determinate'
          ? 'determinate'
          : 'measurement_indeterminate',
      regex_keyword_learner_classifier_or_generator_authority: 'none',
      primary_and_fidelity_claims_separate: true,
      repair_rerun_replacement_or_selection_allowed: false,
    };
    appendTraceEvent(state.trace, {
      type: 'resistance_confirmation_semantic_adjudication',
      turn: turnNumber,
      ...result,
      publicTranscriptChanged: false,
    });
    return result;
  }

  return { adjudicateFinalHorizon, adjudicateInterventionFidelity };
}

export default { createTutorStubResistanceConfirmationSemanticRuntime };
