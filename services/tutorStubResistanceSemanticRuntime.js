import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION,
  TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA,
  adjudicateTutorStubResistanceSemanticJudges,
  buildTutorStubResistanceSemanticAdjudicationPrompt,
  tutorStubResistanceSemanticPromptSha256,
  tutorStubResistanceSemanticSha256,
  validateTutorStubResistanceSemanticRegistration,
  wrapTutorStubResistanceSemanticModelOutput,
} from './tutorStubResistanceSemanticAdjudication.js';
import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_MODEL_SCHEMA_V2,
  TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V2,
  TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA_V2,
  adjudicateTutorStubResistanceSemanticJudgesV2,
  buildTutorStubResistanceSemanticAdjudicationPromptV2,
  validateTutorStubResistanceSemanticRegistrationV2,
  wrapTutorStubResistanceSemanticModelOutputV2,
} from './tutorStubResistanceSemanticAdjudicationV2.js';
import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_MODEL_SCHEMA_V3,
  TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V3,
  TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA_V3,
  adjudicateTutorStubResistanceSemanticJudgesV3,
  buildTutorStubResistanceSemanticAdjudicationPromptV3,
  validateTutorStubResistanceSemanticRegistrationV3,
  wrapTutorStubResistanceSemanticModelOutputV3,
} from './tutorStubResistanceSemanticAdjudicationV3.js';
import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V4,
  adjudicateTutorStubResistanceSemanticJudgesV4,
  validateTutorStubResistanceSemanticRegistrationV4,
} from './tutorStubResistanceSemanticAdjudicationV4.js';
import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V5,
  adjudicateTutorStubResistanceSemanticJudgesV5,
  buildTutorStubResistanceSemanticAdjudicationPromptV5,
  buildTutorStubResistanceSemanticOutputSchemaV5,
  validateTutorStubResistanceSemanticRegistrationV5,
  wrapTutorStubResistanceSemanticModelOutputV5,
} from './tutorStubResistanceSemanticAdjudicationV5.js';
import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V6,
  adjudicateTutorStubResistanceSemanticJudgesV6,
  buildTutorStubResistanceSemanticAdjudicationPromptV6,
  buildTutorStubResistanceSemanticOutputSchemaV6,
  normalizeTutorStubResistanceSemanticModelOutputV6,
  validateTutorStubResistanceSemanticRegistrationV6,
  wrapTutorStubResistanceSemanticModelOutputV6,
} from './tutorStubResistanceSemanticAdjudicationV6.js';
import {
  TUTOR_STUB_MERGED_STANDING_RIVALRY_OBSERVATION_V1,
  TUTOR_STUB_MERGED_TURN_GATE_REGISTRATION_SCHEMA_V1,
  TUTOR_STUB_MERGED_TURN_GATE_REGISTRATION_V1,
  TUTOR_STUB_STANDING_RIVALRY_OBSERVATION_V3,
  TUTOR_STUB_STANDING_RIVALRY_REGISTRATION_SCHEMA_V3,
  TUTOR_STUB_STANDING_RIVALRY_REGISTRATION_V3,
  adjudicateTutorStubStandingRivalryJudgesV3,
  buildTutorStubStandingRivalryOutputSchemaV3,
  buildTutorStubStandingRivalryPromptV3,
  tutorStubMergedStandingRivalryRegistrationV1,
  validateTutorStubMergedTurnGateRegistrationV1,
  validateTutorStubStandingRivalryRegistrationV3,
  wrapTutorStubStandingRivalryModelOutputV3,
} from './tutorStubStandingRivalrySemanticAdjudicationV3.js';
import { recordFileDigest } from './recordedFileDigest.js';
import { createTutorStubResistanceConfirmationSemanticRuntime } from './tutorStubResistanceConfirmationSemanticRuntime.js';
import { createTutorStubResistantLearnerSemanticRuntime } from './tutorStubResistantLearnerSemanticRuntime.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION =
  'config/tutor-stub-resistance-semantic-adjudication-registration.v1.json';
export const TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_V2 =
  'config/tutor-stub-resistance-semantic-adjudication-registration.v2.json';
export const TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_V3 =
  'config/tutor-stub-resistance-semantic-adjudication-registration.v3.json';
export const TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_V4 =
  'config/tutor-stub-resistance-semantic-adjudication-registration.v4.json';
export const TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_V5 =
  'config/tutor-stub-resistance-semantic-adjudication-registration.v5.json';
export const TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_V6 =
  'config/tutor-stub-resistance-semantic-adjudication-registration.v6.json';
export const TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_STANDING_RIVALRY_V3 =
  TUTOR_STUB_STANDING_RIVALRY_REGISTRATION_V3;
export const TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_MERGED_STANDING_RIVALRY_V1 =
  TUTOR_STUB_MERGED_TURN_GATE_REGISTRATION_V1;
export const TUTOR_STUB_RESISTANCE_SEMANTIC_JUDGE_EVENT = 'resistance_semantic_judge_result';
export const TUTOR_STUB_RESISTANCE_SEMANTIC_AGGREGATE_EVENT = 'resistance_semantic_adjudication';
export const TUTOR_STUB_RESISTANCE_SEMANTIC_MEASUREMENT_INDETERMINATE_CODE =
  'TUTOR_STUB_RESISTANCE_SEMANTIC_MEASUREMENT_INDETERMINATE';
export const TUTOR_STUB_RESISTANCE_SEMANTIC_SYSTEM_PROMPT =
  'You are one independent semantic adjudicator. Use only the supplied public packet. Return the registered JSON object, use no tools, and do not infer hidden experimental state.';

export function tutorStubResistanceSemanticRuntimeInstrument(registrationBinding) {
  if (registrationBinding?.registration?.schema === TUTOR_STUB_MERGED_TURN_GATE_REGISTRATION_SCHEMA_V1) {
    return {
      observationSemantics: TUTOR_STUB_MERGED_STANDING_RIVALRY_OBSERVATION_V1,
      responseSchema: TUTOR_STUB_RESISTANCE_SEMANTIC_MODEL_SCHEMA_V3,
      outputSchema: TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA_V3,
      buildOutputSchema: buildTutorStubStandingRivalryOutputSchemaV3,
      buildPrompt: buildTutorStubStandingRivalryPromptV3,
      wrapModelOutput: wrapTutorStubStandingRivalryModelOutputV3,
      adjudicate: adjudicateTutorStubStandingRivalryJudgesV3,
    };
  }
  if (registrationBinding?.registration?.schema === TUTOR_STUB_STANDING_RIVALRY_REGISTRATION_SCHEMA_V3) {
    return {
      observationSemantics: TUTOR_STUB_STANDING_RIVALRY_OBSERVATION_V3,
      responseSchema: TUTOR_STUB_RESISTANCE_SEMANTIC_MODEL_SCHEMA_V3,
      outputSchema: TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA_V3,
      buildOutputSchema: buildTutorStubStandingRivalryOutputSchemaV3,
      buildPrompt: buildTutorStubStandingRivalryPromptV3,
      wrapModelOutput: wrapTutorStubStandingRivalryModelOutputV3,
      adjudicate: adjudicateTutorStubStandingRivalryJudgesV3,
    };
  }
  if (registrationBinding?.registration?.version === 6) {
    return {
      observationSemantics: TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V6,
      responseSchema: TUTOR_STUB_RESISTANCE_SEMANTIC_MODEL_SCHEMA_V3,
      outputSchema: TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA_V3,
      buildOutputSchema: buildTutorStubResistanceSemanticOutputSchemaV6,
      buildPrompt: buildTutorStubResistanceSemanticAdjudicationPromptV6,
      normalizeModelOutput: normalizeTutorStubResistanceSemanticModelOutputV6,
      wrapModelOutput: wrapTutorStubResistanceSemanticModelOutputV6,
      adjudicate: adjudicateTutorStubResistanceSemanticJudgesV6,
    };
  }
  if (registrationBinding?.registration?.version === 5) {
    return {
      observationSemantics: TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V5,
      responseSchema: TUTOR_STUB_RESISTANCE_SEMANTIC_MODEL_SCHEMA_V3,
      outputSchema: TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA_V3,
      buildOutputSchema: buildTutorStubResistanceSemanticOutputSchemaV5,
      buildPrompt: buildTutorStubResistanceSemanticAdjudicationPromptV5,
      wrapModelOutput: wrapTutorStubResistanceSemanticModelOutputV5,
      adjudicate: adjudicateTutorStubResistanceSemanticJudgesV5,
    };
  }
  if (registrationBinding?.registration?.version === 4) {
    const panelOverride = registrationBinding?.runtimePanelOverride || null;
    return {
      observationSemantics: TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V4,
      responseSchema: TUTOR_STUB_RESISTANCE_SEMANTIC_MODEL_SCHEMA_V3,
      outputSchema: TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA_V3,
      buildPrompt: buildTutorStubResistanceSemanticAdjudicationPromptV3,
      wrapModelOutput: wrapTutorStubResistanceSemanticModelOutputV3,
      adjudicate: panelOverride
        ? (values) => {
            const aggregate = adjudicateTutorStubResistanceSemanticJudgesV4(values);
            const selectedIds = new Set(panelOverride.judges.map((judge) => judge.id));
            return {
              ...aggregate,
              validation: aggregate.validation.filter((row) => selectedIds.has(row.judge_id)),
              abstentions: aggregate.abstentions.filter((row) => selectedIds.has(row.judge_id)),
              runtime_panel_override: {
                scope: panelOverride.scope,
                panel_size: panelOverride.panelSize,
                rule: panelOverride.rule,
                model_refs: panelOverride.modelRefs,
                outcome_blind_operator_decision_date: panelOverride.outcomeBlindOperatorDecisionDate,
              },
            };
          }
        : adjudicateTutorStubResistanceSemanticJudgesV4,
    };
  }
  if (registrationBinding?.registration?.version === 3) {
    return {
      observationSemantics: TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V3,
      responseSchema: TUTOR_STUB_RESISTANCE_SEMANTIC_MODEL_SCHEMA_V3,
      outputSchema: TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA_V3,
      buildPrompt: buildTutorStubResistanceSemanticAdjudicationPromptV3,
      wrapModelOutput: wrapTutorStubResistanceSemanticModelOutputV3,
      adjudicate: adjudicateTutorStubResistanceSemanticJudgesV3,
    };
  }
  if (registrationBinding?.registration?.version === 2) {
    return {
      observationSemantics: TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V2,
      responseSchema: TUTOR_STUB_RESISTANCE_SEMANTIC_MODEL_SCHEMA_V2,
      outputSchema: TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA_V2,
      buildPrompt: buildTutorStubResistanceSemanticAdjudicationPromptV2,
      wrapModelOutput: wrapTutorStubResistanceSemanticModelOutputV2,
      adjudicate: adjudicateTutorStubResistanceSemanticJudgesV2,
    };
  }
  return {
    observationSemantics: TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION,
    responseSchema: 'machinespirits.tutor-stub.resistance-semantic-judge-response.v1',
    outputSchema: TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA,
    buildPrompt: buildTutorStubResistanceSemanticAdjudicationPrompt,
    wrapModelOutput: wrapTutorStubResistanceSemanticModelOutput,
    adjudicate: adjudicateTutorStubResistanceSemanticJudges,
  };
}

export function isTutorStubResistanceSemanticObservation(observationSemantics) {
  return [
    TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION,
    TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V2,
    TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V3,
    TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V4,
    TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V5,
    TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V6,
    TUTOR_STUB_STANDING_RIVALRY_OBSERVATION_V3,
    TUTOR_STUB_MERGED_STANDING_RIVALRY_OBSERVATION_V1,
  ].includes(observationSemantics);
}

export function tutorStubResistanceSemanticExpectedLabel(profileId) {
  if (profileId === 'frame_refuser') return 'frame_refuser';
  if (profileId === 'frame_defiant') return 'frame_defiant_or_productive_dispute';
  return null;
}

export function tutorStubResistanceSemanticLabelAdheres({ profileId, label, observationSemantics } = {}) {
  if (
    profileId === 'frame_refuser' &&
    [TUTOR_STUB_STANDING_RIVALRY_OBSERVATION_V3, TUTOR_STUB_MERGED_STANDING_RIVALRY_OBSERVATION_V1].includes(
      observationSemantics,
    )
  ) {
    return ['frame_refuser', 'frame_defiant_or_productive_dispute', 'adherent_label_set'].includes(label);
  }
  return label === tutorStubResistanceSemanticExpectedLabel(profileId);
}

export function countTutorStubResistanceSemanticProfileObservations(turns, profileId, observationSemantics = null) {
  const expected = tutorStubResistanceSemanticExpectedLabel(profileId);
  if (!expected) return 0;
  return (turns || []).filter(
    (turn) =>
      turn?.resistanceSemanticAdjudication?.aggregate?.status === 'determinate' &&
      tutorStubResistanceSemanticLabelAdheres({
        profileId,
        label: turn.resistanceSemanticAdjudication.aggregate.final_label,
        observationSemantics:
          observationSemantics || turn.resistanceSemanticAdjudication?.observationSemantics || null,
      }),
  ).length;
}

export async function enforceTutorStubResistanceSemanticCandidate({
  adjudicateCandidate,
  appendTraceEvent,
  state,
  learnerText,
  turnNumber,
  profileId,
  candidateKind,
  lexicalAdherence,
  signal = null,
}) {
  const semanticAdjudication = await adjudicateCandidate({
    state,
    learnerText,
    turnNumber,
    candidateKind,
    advisorySignals: [{ source: 'legacy_observer_and_luna_classifier', adherence: lexicalAdherence }],
    signal,
  });
  if (semanticAdjudication.aggregate.status === 'measurement_indeterminate') {
    appendTraceEvent(state.trace, {
      type: 'auto_learner_profile_measurement_indeterminate',
      turn: turnNumber,
      profile: profileId,
      semanticAdjudication,
      repairRequested: false,
      disposition: 'terminal_nonrecoverable_no_rerun_replacement_or_selection',
      learnerText,
    });
    const error = new Error('independent semantic adjudication was indeterminate');
    error.code = TUTOR_STUB_RESISTANCE_SEMANTIC_MEASUREMENT_INDETERMINATE_CODE;
    error.substantiveStudyFailure = true;
    error.measurementIndeterminate = true;
    error.recoverable = false;
    error.semanticAdjudication = semanticAdjudication;
    throw error;
  }
  return {
    semanticAdjudication,
    passed: tutorStubResistanceSemanticLabelAdheres({
      profileId,
      label: semanticAdjudication.aggregate.final_label,
      observationSemantics: semanticAdjudication.observationSemantics,
    }),
  };
}

export function createTutorStubResistanceSemanticAdherenceBridge({
  observationSemantics,
  adjudicateCandidate,
  appendTraceEvent,
}) {
  const enabled = isTutorStubResistanceSemanticObservation(observationSemantics);
  if (enabled && typeof adjudicateCandidate !== 'function') {
    throw new Error('semantic frame-resistance observation requires the independent semantic adjudicator');
  }
  const isFrameProfile = (profileId) => ['frame_refuser', 'frame_defiant'].includes(profileId);
  const studyCandidate = (state, profileId) => enabled && isFrameProfile(profileId) && state?.enabled === true;
  return {
    enabled,
    countObserved(turns, profileId, legacyCount) {
      return enabled
        ? countTutorStubResistanceSemanticProfileObservations(turns, profileId, observationSemantics)
        : legacyCount;
    },
    studyCandidate,
    shouldEvaluate(state, runtime) {
      return (
        enabled &&
        isFrameProfile(runtime?.profileId) &&
        (runtime.requiredNow || studyCandidate(state, runtime.profileId))
      );
    },
    async evaluate({ state, learnerText, turnNumber, runtime, repairs, lexicalAdherence, signal }) {
      if (!enabled || !isFrameProfile(runtime?.profileId)) {
        return { passed: lexicalAdherence, semanticAdjudication: null };
      }
      return enforceTutorStubResistanceSemanticCandidate({
        adjudicateCandidate,
        appendTraceEvent,
        state,
        learnerText,
        turnNumber,
        profileId: runtime.profileId,
        candidateKind: repairs === 0 ? 'initial' : `learner-repair-${repairs}`,
        lexicalAdherence,
        signal,
      });
    },
    stopBeforeRepair({ state, turnNumber }) {
      return enabled && (turnNumber === 1 || state?.consumed === true);
    },
    adherenceRequired(state) {
      return !(enabled && state?.consumed === true);
    },
    suppressExhaustion({ state, turnNumber }) {
      return enabled && (turnNumber === 1 || state?.consumed === true);
    },
  };
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalJson(value[key])]),
    );
  }
  return value;
}

function canonicalSha256(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalJson(value)))
    .digest('hex');
}

export function loadTutorStubResistanceSemanticRegistration(
  registrationPath = TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION,
) {
  const absolute = path.resolve(ROOT, registrationPath);
  const source = fs.readFileSync(absolute);
  const parsed = JSON.parse(source);
  const registration =
    parsed.schema === TUTOR_STUB_MERGED_TURN_GATE_REGISTRATION_SCHEMA_V1
      ? tutorStubMergedStandingRivalryRegistrationV1(parsed)
      : parsed;
  const validation =
    registration.schema === TUTOR_STUB_MERGED_TURN_GATE_REGISTRATION_SCHEMA_V1
      ? validateTutorStubMergedTurnGateRegistrationV1(parsed)
      : registration.schema === TUTOR_STUB_STANDING_RIVALRY_REGISTRATION_SCHEMA_V3
      ? validateTutorStubStandingRivalryRegistrationV3(registration)
      : registration.version === 6
      ? validateTutorStubResistanceSemanticRegistrationV6(registration)
      : registration.version === 5
      ? validateTutorStubResistanceSemanticRegistrationV5(registration)
      : registration.version === 4
      ? validateTutorStubResistanceSemanticRegistrationV4(registration)
      : registration.version === 3
        ? validateTutorStubResistanceSemanticRegistrationV3(registration)
        : registration.version === 2
          ? validateTutorStubResistanceSemanticRegistrationV2(registration)
          : validateTutorStubResistanceSemanticRegistration(registration);
  if (!validation.valid) throw new Error(`semantic registration invalid: ${validation.issues.join('; ')}`);
  return { registration, path: registrationPath, sha256: tutorStubResistanceSemanticSha256(source) };
}

export const TUTOR_STUB_RESISTANT_LEARNER_TWO_SEAT_PANEL_RULE =
  'both_valid_high_confidence_sol_sonnet_votes_agree';

export function applyTutorStubResistantLearnerCalibrationSemanticPanel(registrationBinding, runtime) {
  if (
    runtime?.resistant_learner_calibration !== true ||
    runtime?.resistant_learner_study !== 'R1'
  ) {
    return registrationBinding;
  }
  const trigger = runtime?.design?.models?.triggerObservation;
  if (
    registrationBinding?.registration?.schema === TUTOR_STUB_MERGED_TURN_GATE_REGISTRATION_SCHEMA_V1 &&
    trigger?.semantics === TUTOR_STUB_MERGED_STANDING_RIVALRY_OBSERVATION_V1
  ) {
    return registrationBinding;
  }
  if (
    registrationBinding?.registration?.schema === TUTOR_STUB_STANDING_RIVALRY_REGISTRATION_SCHEMA_V3 &&
    trigger?.semantics === TUTOR_STUB_STANDING_RIVALRY_OBSERVATION_V3
  ) {
    return registrationBinding;
  }
  if (
    registrationBinding?.registration?.version !== 4 ||
    trigger?.semantics !== TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V4
  ) {
    throw new Error('R1 calibration requires its scoped v4 two-seat trigger panel');
  }
  const modelRefs = trigger.judges?.map((judge) => judge.modelRef) || [];
  if (JSON.stringify(modelRefs) !== JSON.stringify(['codex.gpt-5.6-sol', 'claude-code.sonnet-5'])) {
    throw new Error('R1 calibration trigger panel must be the Sol-Sonnet pair');
  }
  const registeredJudges = registrationBinding.registration.measurement.judges;
  const selectedJudges = trigger.judges.map((declared) => {
    const registered = registeredJudges.find((judge) => judge.modelRef === declared.modelRef);
    if (
      !registered ||
      registered.id !== declared.id ||
      registered.provider !== declared.provider ||
      registered.model !== declared.model ||
      registered.effort !== declared.effort
    ) {
      throw new Error(`R1 calibration trigger route drift for ${declared.modelRef}`);
    }
    return structuredClone(registered);
  });
  const runtimePanelOverride = {
    scope: 'resistant_learner_r1_gate1_calibration',
    panelSize: 2,
    rule: TUTOR_STUB_RESISTANT_LEARNER_TWO_SEAT_PANEL_RULE,
    modelRefs,
    judges: selectedJudges,
    outcomeBlindOperatorDecisionDate: '2026-08-23',
  };
  const overrideSha256 = canonicalSha256({
    baseRegistrationSha256: registrationBinding.sha256,
    runtimePanelOverride: {
      ...runtimePanelOverride,
      judges: runtimePanelOverride.judges.map((judge) => ({
        id: judge.id,
        modelRef: judge.modelRef,
        provider: judge.provider,
        model: judge.model,
        effort: judge.effort,
      })),
    },
  });
  return {
    registration: registrationBinding.registration,
    path: `${registrationBinding.path}#resistant-learner-r1-two-seat`,
    sha256: overrideSha256,
    runtimePanelOverride,
  };
}

export function tutorStubResistanceSemanticRegistrationPathForObservation(observationSemantics = '') {
  const normalized = String(observationSemantics || '').trim();
  if (!normalized || normalized === TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION) {
    return TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION;
  }
  if (normalized === TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V2) {
    return TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_V2;
  }
  if (normalized === TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V3) {
    return TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_V3;
  }
  if (normalized === TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V4) {
    return TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_V4;
  }
  if (normalized === TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V5) {
    return TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_V5;
  }
  if (normalized === TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V6) {
    return TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_V6;
  }
  if (normalized === TUTOR_STUB_STANDING_RIVALRY_OBSERVATION_V3) {
    return TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_STANDING_RIVALRY_V3;
  }
  if (normalized === TUTOR_STUB_MERGED_STANDING_RIVALRY_OBSERVATION_V1) {
    return TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_MERGED_STANDING_RIVALRY_V1;
  }
  throw new Error(`unsupported resistance semantic observation semantics: ${normalized}`);
}

export function validateTutorStubResistanceSemanticRuntimeResult({
  result,
  learnerText,
  turnNumber,
  registrationBinding,
  expectedPublicContext,
  requireDeterminate = true,
}) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return { valid: false, issues: ['semantic runtime result missing'], digestRecords: [] };
  }
  const issues = [];
  const source = String(learnerText || '');
  const publicContext = Array.isArray(result?.publicContext) ? result.publicContext : [];
  const expectedContext = Array.isArray(expectedPublicContext) ? expectedPublicContext : null;
  const expectedPacketSha256 = canonicalSha256({
    case_id: result?.caseId,
    public_context: publicContext,
    utterance: source,
  });
  if (result?.schema !== 'machinespirits.tutor-stub.resistance-semantic-runtime-result.v1') {
    issues.push('runtime result schema mismatch');
  }
  if (result?.observationSemantics !== registrationBinding?.registration?.observationSemantics) {
    issues.push('observation semantics mismatch');
  }
  if (result?.turn !== turnNumber) issues.push('semantic result turn mismatch');
  if (result?.sourceSha256 !== tutorStubResistanceSemanticSha256(source)) issues.push('semantic source mismatch');
  if (result?.registrationPath !== registrationBinding?.path) issues.push('semantic registration path mismatch');
  // The result carries the registration digest that stood when it was produced.
  // A later edit to the registration file is written down, not refused.
  const digestRecords = registrationBinding?.path
    ? [
        recordFileDigest({
          root: ROOT,
          filePath: registrationBinding.path,
          recordedSha256: result?.registrationSha256,
          label: 'semantic registration named by the result',
        }),
      ]
    : [];
  if (result?.publicContextSha256 !== canonicalSha256(publicContext)) issues.push('public context digest mismatch');
  if (!expectedContext || JSON.stringify(publicContext) !== JSON.stringify(expectedContext)) {
    issues.push('public context does not match the current public history');
  }
  if (result?.packetSha256 !== expectedPacketSha256) issues.push('semantic packet digest mismatch');
  if (result?.packetKey !== canonicalSha256({ caseId: result?.caseId, publicContext, source })) {
    issues.push('semantic cache key mismatch');
  }
  if (result?.aggregate?.case_id !== result?.caseId) issues.push('semantic aggregate case mismatch');
  if (result?.aggregateSha256 !== canonicalSha256(result?.aggregate)) issues.push('semantic aggregate digest mismatch');
  if (requireDeterminate && result?.aggregate?.status !== 'determinate')
    issues.push('semantic aggregate is not determinate');
  if (requireDeterminate) {
    const aggregate = result?.aggregate || {};
    const standingRivalryV3 =
      registrationBinding?.registration?.schema === TUTOR_STUB_STANDING_RIVALRY_REGISTRATION_SCHEMA_V3;
    const mergedStandingRivalryV1 =
      registrationBinding?.registration?.schema === TUTOR_STUB_MERGED_TURN_GATE_REGISTRATION_SCHEMA_V1;
    const standingRivalry = standingRivalryV3 || mergedStandingRivalryV1;
    const hierarchicalV4 = registrationBinding?.registration?.version >= 4 || standingRivalry;
    const expectedPanelSize =
      registrationBinding?.runtimePanelOverride?.panelSize ||
      (registrationBinding?.registration?.version === 6 || standingRivalry ? 2 : hierarchicalV4 ? 3 : 2);
    const minimumEligibleJudges = 2;
    if (
      aggregate.repair_allowed !== false ||
      (hierarchicalV4
        ? aggregate.judge_rerun_after_response_allowed !== false
        : aggregate.judge_rerun_allowed !== false) ||
      aggregate.unit_rerun_allowed !== false ||
      aggregate.replacement_allowed !== false ||
      aggregate.outcome_selection_allowed !== false ||
      !Array.isArray(aggregate.reasons) ||
      aggregate.reasons.length !== 0 ||
      ![
        'frame_refuser',
        'frame_defiant_or_productive_dispute',
        'neither',
        ...(mergedStandingRivalryV1 ? ['adherent_label_set'] : []),
      ].includes(aggregate.final_label) ||
      aggregate.judgment?.final_label !== aggregate.final_label ||
      !Array.isArray(aggregate.validation) ||
      aggregate.validation.length !== expectedPanelSize ||
      !Array.isArray(aggregate.judge_evidence) ||
      aggregate.judge_evidence.length < minimumEligibleJudges ||
      aggregate.judge_evidence.length > expectedPanelSize ||
      aggregate.judge_evidence.some((row) =>
        standingRivalry ? !['high', 'medium'].includes(row.confidence) : row.confidence !== 'high',
      ) ||
      (hierarchicalV4
        ? !Number.isInteger(result?.judgeRecordCount) ||
          result.judgeRecordCount < minimumEligibleJudges ||
          result.judgeRecordCount > expectedPanelSize ||
          (mergedStandingRivalryV1
            ? aggregate.adherence_class_measurement?.status !== 'determinate' ||
              !['adherent', 'non_adherent'].includes(aggregate.adherence_class_measurement?.value)
            : aggregate.primary_label_measurement?.status !== 'determinate' ||
              aggregate.primary_label_measurement?.value !== aggregate.final_label) ||
          !Array.isArray(aggregate.eligible_judges) ||
          aggregate.eligible_judges.length < minimumEligibleJudges
        : aggregate.validation.some((row) => row.valid !== true) || result?.judgeRecordCount !== expectedPanelSize)
    ) {
      issues.push('determinate semantic aggregate envelope is invalid');
    }
  }
  return { valid: issues.length === 0, issues, digestRecords };
}

export function tutorStubResistanceSemanticPublicContext(state, maximumRows = 4) {
  const rows = (state?.history || [])
    .filter((row) => ['assistant', 'user'].includes(row?.role) && String(row?.content || '').trim())
    .slice(-maximumRows)
    .map((row) => ({ role: row.role === 'assistant' ? 'assistant' : 'learner', text: String(row.content) }));
  if (!rows.length) throw new Error('semantic adjudication requires preceding public context');
  return rows;
}

function parseModelOutput(text) {
  const value = JSON.parse(String(text || '').trim());
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('semantic response is not an object');
  return value;
}

function cacheForState(state) {
  if (!state.resistanceSemanticAdjudicationCache) state.resistanceSemanticAdjudicationCache = {};
  return state.resistanceSemanticAdjudicationCache;
}

export function createTutorStubResistanceSemanticRuntime({
  appendTraceEvent,
  callPromptModel,
  resolveModel,
  registrationBinding = loadTutorStubResistanceSemanticRegistration(),
}) {
  if (typeof appendTraceEvent !== 'function') throw new Error('semantic runtime requires appendTraceEvent');
  if (typeof callPromptModel !== 'function') throw new Error('semantic runtime requires callPromptModel');
  if (typeof resolveModel !== 'function') throw new Error('semantic runtime requires resolveModel');
  const { registration } = registrationBinding;
  const instrument = tutorStubResistanceSemanticRuntimeInstrument(registrationBinding);
  const activeJudges = registrationBinding.runtimePanelOverride?.judges || registration.measurement.judges;

  async function adjudicateCandidate({
    state,
    learnerText,
    turnNumber,
    candidateKind = 'initial',
    advisorySignals = [],
    signal = null,
  }) {
    const source = String(learnerText || '');
    if (!source.trim()) throw new Error('semantic adjudication requires learner text');
    const publicContext = tutorStubResistanceSemanticPublicContext(state);
    const caseId = `semantic-case-${canonicalSha256({
      turnNumber,
      sourceSha256: tutorStubResistanceSemanticSha256(source),
      publicContextSha256: canonicalSha256(publicContext),
      registrationSha256: registrationBinding.sha256,
    })}`;
    const packetKey = canonicalSha256({ caseId, publicContext, source });
    const cache = cacheForState(state);
    if (cache[packetKey]) return cache[packetKey];

    const prompts = {};
    const records = [];
    for (const judge of activeJudges) {
      const prompt = instrument.buildPrompt({
        caseId,
        source,
        publicContext,
        judge,
      });
      prompts[judge.id] = prompt;
      const resolved = resolveModel(judge.modelRef);
      if (resolved.provider !== judge.provider || resolved.model !== judge.model) {
        throw new Error(`semantic judge route drift for ${judge.id}`);
      }
      const independentRunId = crypto.randomUUID();
      const role = `tutor_stub_resistance_semantic_${judge.id}`;
      const userPrompt = JSON.stringify(prompt);
      const outputSchema = instrument.buildOutputSchema
        ? instrument.buildOutputSchema(prompt)
        : instrument.outputSchema;
      let raw = null;
      let record = null;
      let invalidReason = null;
      let deterministicProjection = null;
      try {
        raw = await callPromptModel({
          prompt: userPrompt,
          messageHistory: [],
          resolved,
          systemPrompt: TUTOR_STUB_RESISTANCE_SEMANTIC_SYSTEM_PROMPT,
          role,
          maxTokens: 1400,
          trace: state.trace,
          stream: { enabled: false, interim: state.interim },
          cliEffort: judge.effort,
          effort: judge.effort,
          outputSchema,
          semanticRetryDelaysMs: [15000, 45000],
          turn: turnNumber,
          signal,
        });
        let modelOutput = parseModelOutput(raw.text);
        if (modelOutput.case_id !== caseId) throw new Error('semantic response case id mismatch');
        if (typeof instrument.normalizeModelOutput === 'function') {
          const normalized = instrument.normalizeModelOutput(modelOutput);
          modelOutput = normalized.modelOutput;
          deterministicProjection = normalized.audit;
        }
        record = instrument.wrapModelOutput({
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
        records.push(record);
      } catch (error) {
        if (signal?.aborted || error?.name === 'AbortError') throw error;
        invalidReason = error.message;
      }
      appendTraceEvent(state.trace, {
        type: TUTOR_STUB_RESISTANCE_SEMANTIC_JUDGE_EVENT,
        turn: turnNumber,
        candidateKind,
        caseId,
        judgeId: judge.id,
        registrationPath: registrationBinding.path,
        registrationSha256: registrationBinding.sha256,
        packetSha256: prompt.packet_sha256,
        promptSha256: tutorStubResistanceSemanticPromptSha256(prompt),
        sourceSha256: tutorStubResistanceSemanticSha256(source),
        independentRunId,
        role,
        expectedProvider: resolved.provider,
        expectedModel: resolved.model,
        expectedEffort: judge.effort,
        observedProvider: raw?.provider || null,
        observedModel: raw?.model || null,
        observedEffort: raw?.effort || raw?.reasoningEffort || null,
        systemPrompt: TUTOR_STUB_RESISTANCE_SEMANTIC_SYSTEM_PROMPT,
        systemPromptSha256: tutorStubResistanceSemanticSha256(TUTOR_STUB_RESISTANCE_SEMANTIC_SYSTEM_PROMPT),
        userPrompt,
        userPromptSha256: tutorStubResistanceSemanticSha256(userPrompt),
        outputSchema,
        structuredOutput: raw?.structuredOutput === true,
        prohibitedToolEventCount: Number.isInteger(raw?.prohibitedToolEventCount) ? raw.prohibitedToolEventCount : null,
        prohibitedToolEventCountObserved: raw?.prohibitedToolEventCountObserved === true,
        modelAttestationBasis: raw?.modelAttestationBasis || null,
        modelIndependentlyAttested: raw?.modelIndependentlyAttested === true,
        transportCompleted: raw !== null,
        validModelEnvelope: record !== null,
        invalidReason,
        deterministicProjection,
        record,
        publicTranscriptChanged: false,
      });
    }
    const aggregate = instrument.adjudicate({
      source,
      publicContext,
      caseId,
      responses: records,
      registration,
      prompts,
      advisorySignals,
    });
    const result = {
      schema: 'machinespirits.tutor-stub.resistance-semantic-runtime-result.v1',
      observationSemantics: instrument.observationSemantics,
      turn: turnNumber,
      candidateKind,
      caseId,
      packetKey,
      registrationPath: registrationBinding.path,
      registrationSha256: registrationBinding.sha256,
      sourceSha256: tutorStubResistanceSemanticSha256(source),
      publicContext,
      publicContextSha256: canonicalSha256(publicContext),
      packetSha256: prompts[registration.measurement.judges[0].id].packet_sha256,
      judgeRecordCount: records.length,
      aggregate,
    };
    result.aggregateSha256 = canonicalSha256(result.aggregate);
    appendTraceEvent(state.trace, {
      type: TUTOR_STUB_RESISTANCE_SEMANTIC_AGGREGATE_EVENT,
      ...result,
      publicTranscriptChanged: false,
    });
    cache[packetKey] = result;
    return result;
  }

  return { adjudicateCandidate, registrationBinding };
}

export function createLazyTutorStubResistanceSemanticAdjudicator(
  dependencies,
  { createRuntime, loadRegistration = loadTutorStubResistanceSemanticRegistration, observationSemantics = '' } = {},
) {
  let runtime = null;
  return async (values) => {
    if (!runtime) {
      const registrationPath = tutorStubResistanceSemanticRegistrationPathForObservation(observationSemantics);
      const baseRegistrationBinding = loadRegistration(registrationPath);
      const registrationBinding = applyTutorStubResistantLearnerCalibrationSemanticPanel(
        baseRegistrationBinding,
        values?.state?.resistanceActionRegisterStudy,
      );
      const expectedObservationSemantics =
        String(observationSemantics || '').trim() || TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION;
      if (registrationBinding?.registration?.observationSemantics !== expectedObservationSemantics) {
        throw new Error('semantic registration observation semantics drifted from the requested runtime');
      }
      runtime = (createRuntime || createTutorStubResistanceSemanticRuntime)({
        ...dependencies,
        registrationBinding,
      });
    }
    return runtime.adjudicateCandidate(values);
  };
}

export function createTutorStubResistanceSemanticAdjudicationComposition({
  appendTraceEvent,
  callPromptModel,
  resolveModel,
  observationSemantics = '',
} = {}) {
  const adjudicateResistanceSemanticCandidate = createLazyTutorStubResistanceSemanticAdjudicator(
    { appendTraceEvent, callPromptModel, resolveModel },
    { observationSemantics },
  );
  const confirmation = createTutorStubResistanceConfirmationSemanticRuntime({
    appendTraceEvent,
    callPromptModel,
    resolveModel,
  });
  const resistantLearner = createTutorStubResistantLearnerSemanticRuntime({
    appendTraceEvent,
    callPromptModel,
    resolveModel,
  });
  const adjudicateTutorStubResistanceConfirmationOutcome = (values) =>
    values?.state?.resistanceActionRegisterStudy?.resistant_learner_calibration === true
      ? resistantLearner.adjudicateFinalHorizon(values)
      : confirmation.adjudicateFinalHorizon(values);
  const adjudicateTutorStubResistanceInterventionFidelity = confirmation.adjudicateInterventionFidelity;
  return {
    adjudicateResistanceSemanticCandidate,
    adjudicateTutorStubResistanceConfirmationOutcome,
    adjudicateTutorStubResistanceInterventionFidelity,
    adjudicateRivalDagBridgeStep: resistantLearner.adjudicateRivalDagBridgeStep,
    adjudicateTutorStubTutorDelivery: resistantLearner.adjudicateTutorDelivery,
  };
}

export default { createTutorStubResistanceSemanticRuntime, loadTutorStubResistanceSemanticRegistration };
