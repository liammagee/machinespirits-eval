import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { detectTutorStubEdgeTimingSignal } from './tutorStubEdgeTimingPolicy.js';
import { RESISTANT_LEARNER_OBSERVATION_SEMANTICS, observeResistantLearnerTurn } from './resistantLearnerObservation.js';
import { beginTutorStubActionBeforeRegisterShadow } from './tutorStubActionBeforeRegisterShadow.js';
import { tutorStubFirstDraftContractPrompt } from './tutorStubFirstDraftContract.js';
import { extractTutorStubFrozenTurn, refreshTutorStubFrozenFirstDraftRequest } from './tutorStubFrozenReplay.js';
import { normalizeTutorStubResponseConfiguration } from './tutorStubRegisterPragmatics.js';

export const TUTOR_STUB_RESISTANCE_ACTION_REGISTER_STUDY_SCHEMA =
  'machinespirits.tutor-stub.resistance-action-register-study-runtime.v1';
export const TUTOR_STUB_RESISTANCE_ACTION_REGISTER_INTERVENTION_SCHEMA =
  'machinespirits.tutor-stub.resistance-action-register-intervention.v1';
export const TUTOR_STUB_RESISTANCE_ACTION_REGISTER_PREFIX_SCHEMA =
  'machinespirits.tutor-stub.resistance-action-register-prefix.v1';
export const TUTOR_STUB_RESISTANCE_ACTION_REGISTER_PLAN_SCHEMA =
  'machinespirits.tutor-stub.resistance-action-register-plan.v1';

export const TUTOR_STUB_RESISTANCE_ACTION_REGISTER_REGISTRATION_SCHEMA =
  'machinespirits.tutor-stub.resistance-action-register-crossed-registration.v1';

const STUDY_PROFILES = Object.freeze(['bored', 'frame_defiant']);
const PREFIX_PROFILES = Object.freeze([...STUDY_PROFILES, 'frame_refuser']);
const ACTION_FITS = Object.freeze(['matched', 'mismatched']);
const REALIZATIONS = Object.freeze(['plain', 'warm', 'edged']);
const REPEATS = Object.freeze(['A', 'B']);

function isV2Registration(registration) {
  return (
    registration?.schema === TUTOR_STUB_RESISTANCE_ACTION_REGISTER_REGISTRATION_SCHEMA && registration?.version === 2
  );
}

function registeredLevels(registration, key, fallback) {
  const levels = registration?.design?.factors?.[key]?.levels;
  return Array.isArray(levels) && levels.length ? levels : fallback;
}

function registeredProfiles(registration) {
  const profiles = registration?.design?.profiles;
  return Array.isArray(profiles) && profiles.length ? profiles : STUDY_PROFILES;
}

const MOVE_TO_HOST_ACTION = Object.freeze({
  ask_discriminating_question: 'stage_next_step',
  test_bounded_distinction: 'clarify_distinction',
});

const MOVE_INSTRUCTIONS = Object.freeze({
  ask_discriminating_question:
    'Ask exactly one concrete question about the nearest already-public object or inference. Make its alternatives genuinely discriminating, so the answer changes which live public path should be tested next. Do not ask permission, ask what the learner wants to do, or supply the answer.',
  test_bounded_distinction:
    'Name one bounded distinction inside the disputed inquiry frame and offer one local public test that could count for or against it. Explicitly leave the learner free to reject the wider frame; do not convert disagreement into compliance.',
});

const COMPACT_MOVE_INSTRUCTIONS = Object.freeze({
  ask_discriminating_question:
    'Ask exactly one concrete, genuinely discriminating question about the nearest already-public object; do not supply the answer.',
  test_bounded_distinction:
    'Name one bounded distinction and ask for one local public test; explicitly leave the wider frame open to rejection.',
});

const CONTENT_BEARING_MOVES = new Set(['hypothesis', 'inference', 'evidence_adoption', 'metacognitive_reflection']);
const CONTENT_BEARING_EVIDENCE = new Set(['cites_public_evidence', 'links_evidence_to_rule', 'revises_from_evidence']);

const PERMISSION_SEEKING = /\b(?:is it (?:okay|ok)|may i|am i allowed|do you want me to|should i)\b/iu;
const MERE_ASSENT = /^\s*(?:yes|yeah|yep|okay|ok|sure|fine|right|whatever|if you say so)[.!]?\s*$/iu;
const FRAME_ISSUE = /\b(?:evidence|warrant|premise|frame|question|rule|test|standard|authority|standing|criterion)\b/iu;
const FIRST_DRAFT_BLOCK =
  /(?:\[Tutor-only first-draft performance contract\][\s\S]*?\[End tutor-only first-draft performance contract\]|\[Tutor-only host plan\][\s\S]*?\[End tutor-only host plan\])/u;

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
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

function hashValue(value) {
  return sha256(JSON.stringify(canonicalJson(value)));
}

function exactLevel(value, levels, label) {
  const normalized = String(value || '').trim();
  if (!levels.includes(normalized)) throw new Error(`${label} must be one of ${levels.join(', ')}`);
  return normalized;
}

function classificationTurn(classification) {
  return classification?.turn || classification?.classifier || classification || {};
}

function observeResistanceAxis({ learnerText = '', classification = null } = {}) {
  return beginTutorStubActionBeforeRegisterShadow({ learnerText, classification }).resistance_axis_shadow;
}

function contentBearing(classification) {
  const turn = classificationTurn(classification);
  return CONTENT_BEARING_MOVES.has(turn.discourse_move) || CONTENT_BEARING_EVIDENCE.has(turn.evidence_use);
}

function decisionTurn(state, tutorLearnerDag) {
  const explicit = Number(tutorLearnerDag?.model?.turn);
  if (Number.isFinite(explicit)) return explicit;
  return Array.isArray(state?.turns) ? state.turns.length + 1 : null;
}

function normalizeRegistration(registration) {
  if (registration?.schema !== TUTOR_STUB_RESISTANCE_ACTION_REGISTER_REGISTRATION_SCHEMA) {
    throw new Error(`registration schema must be ${TUTOR_STUB_RESISTANCE_ACTION_REGISTER_REGISTRATION_SCHEMA}`);
  }
  const expectedStatus = isV2Registration(registration) ? 'prospective_zero_call_readiness_hold' : 'frozen_design_hold';
  if (registration.status !== expectedStatus) throw new Error(`registration must remain ${expectedStatus}`);
  if (registration.authorization?.modelCallsAuthorized !== false) {
    throw new Error('registration must not authorize model calls');
  }
  if (registration.authorization?.liveRunAuthorized !== false) {
    throw new Error('registration must not authorize a live run');
  }
  if (registration.design?.intervention?.studyOnlyOptIn !== true) {
    throw new Error('registration must require a study-only opt-in intervention');
  }
  if (registration.design?.intervention?.legacyDefaultOutsideStudy !== true) {
    throw new Error('registration must preserve the legacy default outside the study');
  }
  if (registration.design?.world !== 'world_005_marrick' || registration.design?.dagMode !== 'strict_dag') {
    throw new Error('registration must remain pinned to strict-DAG world_005_marrick');
  }
  if (!isV2Registration(registration)) {
    if (registration.design?.factorialCells !== 24) throw new Error('registration must retain 24 factorial cells');
    return registration;
  }
  if (
    registration.authorization?.baselinePilotAuthorized !== false ||
    registration.authorization?.goRequestPrepared !== false ||
    registration.authorization?.standingAuthorizationAttachmentSha256 !==
      '4ef020fa2c59d6f7e215029374d7d5adaabc5f620fe1cbd5369020a34e88e08b'
  ) {
    throw new Error('v2 registration must remain on HOLD with the standing authorization attachment bound');
  }
  if (JSON.stringify(registration.design?.profiles) !== JSON.stringify(['frame_refuser'])) {
    throw new Error('v2 registration must retain frame_refuser as its only treatment profile');
  }
  if (registration.design?.diagnosticProfile !== 'frame_defiant') {
    throw new Error('v2 registration must retain frame_defiant as diagnostic-only');
  }
  if (registration.design?.trigger?.observationSemantics !== RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV4) {
    throw new Error('v2 registration must use prospective_v4 observation semantics');
  }
  const frozenPrefixes = registration.design?.trigger?.frozenPrefixSource?.prefixes;
  if (
    registration.design?.trigger?.frozenPrefixSource?.gateReportSha256 !==
      '771076330d58ec8818182a1924e3ea8dd2c8e54bdc1c9f32a822e491f405b431' ||
    !Array.isArray(frozenPrefixes) ||
    frozenPrefixes.length !== 3 ||
    new Set(frozenPrefixes.map((prefix) => prefix.sourceTraceSha256)).size !== 3 ||
    new Set(frozenPrefixes.map((prefix) => prefix.publicPrefixSha256)).size !== 3 ||
    frozenPrefixes.some(
      (prefix) =>
        prefix.triggerTurn !== 1 ||
        !/^[a-f0-9]{64}$/u.test(prefix.sourceTraceSha256) ||
        !/^[a-f0-9]{64}$/u.test(prefix.publicPrefixSha256),
    )
  ) {
    throw new Error('v2 registration must bind three distinct V4 target prefixes and the passing gate report');
  }
  if (JSON.stringify(registration.design?.factors?.actionFit?.levels) !== JSON.stringify(['matched'])) {
    throw new Error('v2 registration must hold action fit fixed at matched');
  }
  if (registration.design?.factors?.actionFit?.assignments?.frame_refuser?.matched !== 'test_bounded_distinction') {
    throw new Error('v2 registration must hold the frame_refuser matched move at test_bounded_distinction');
  }
  if (JSON.stringify(registration.design?.factors?.realization?.levels) !== JSON.stringify(['plain', 'warm'])) {
    throw new Error('v2 registration must retain the plain/warm baseline comparison');
  }
  if (JSON.stringify(registration.design?.factors?.replicationBlock?.levels) !== JSON.stringify(REPEATS)) {
    throw new Error('v2 registration must retain A/B same-treatment repeats');
  }
  if (registration.baselinePilot?.expectedTreatmentDialogues !== 12) {
    throw new Error('v2 registration must retain 12 baseline treatment dialogues');
  }
  const batches = registration.executionReadiness?.batches;
  if (
    !Array.isArray(batches) ||
    batches.length !== 2 ||
    batches.some((batch) => batch.dialogues !== 6 || batch.maximumModelAttemptReservations !== 234)
  ) {
    throw new Error('v2 registration must retain two six-dialogue batches capped at 234 reservations each');
  }
  if (registration.executionReadiness?.combinedMaximumModelAttemptReservations !== 468) {
    throw new Error('v2 registration must retain the combined 468-reservation baseline ceiling');
  }
  if (
    registration.executionReadiness?.plannedRoleCallsPerDialogue !== 13 ||
    registration.executionReadiness?.maximumReservationsPerPlannedCall !== 3 ||
    registration.executionReadiness?.maximumModelAttemptReservationsPerDialogue !== 39 ||
    registration.executionReadiness?.combinedPlannedRoleCalls !== 156 ||
    batches.some(
      (batch, index) =>
        batch.id !== `batch_${REPEATS[index]}` ||
        batch.repeat !== REPEATS[index] ||
        batch.plannedRoleCalls !== 78 ||
        batch.destination !== null,
    )
  ) {
    throw new Error('v2 registration budget arithmetic or fixed batch assignment drifted');
  }
  const ledgerBefore = registration.authorization?.programmeLedgerBeforeThisBaseline;
  const ledgerAfter = registration.executionReadiness?.programmeLedgerAfterMaximum;
  if (
    ledgerBefore?.reservedAttempts !== 45 ||
    ledgerBefore?.ceiling !== 1200 ||
    ledgerBefore?.remaining !== 1155 ||
    ledgerAfter?.reservedAttempts !== 513 ||
    ledgerAfter?.ceiling !== 1200 ||
    ledgerAfter?.remaining !== 687
  ) {
    throw new Error('v2 registration programme ledger must remain 45/1200 before and 513/1200 after maximum');
  }
  return registration;
}

export function loadTutorStubResistanceActionRegisterRegistration(filePath) {
  const absolute = path.resolve(filePath);
  const source = fs.readFileSync(absolute, 'utf8');
  return {
    path: absolute,
    source,
    sha256: sha256(source),
    registration: normalizeRegistration(JSON.parse(source)),
  };
}

export function createTutorStubResistanceActionRegisterStudyRuntime({
  registration,
  registrationPath = null,
  registrationSha256 = null,
  profile,
  actionFit,
  realization,
  repeat,
} = {}) {
  const frozen = normalizeRegistration(registration);
  const normalizedProfile = exactLevel(profile, registeredProfiles(frozen), 'study profile');
  const normalizedActionFit = exactLevel(actionFit, registeredLevels(frozen, 'actionFit', ACTION_FITS), 'action fit');
  const normalizedRealization = exactLevel(
    realization,
    registeredLevels(frozen, 'realization', REALIZATIONS),
    'realization',
  );
  const normalizedRepeat = exactLevel(repeat, registeredLevels(frozen, 'replicationBlock', REPEATS), 'repeat');
  return {
    schema: TUTOR_STUB_RESISTANCE_ACTION_REGISTER_STUDY_SCHEMA,
    enabled: true,
    authority: 'explicit_study_only_opt_in',
    profile: normalizedProfile,
    action_fit: normalizedActionFit,
    realization: normalizedRealization,
    repeat: normalizedRepeat,
    registration_path: registrationPath,
    registration_sha256: registrationSha256,
    registration: frozen,
    consumed: false,
    history: [],
  };
}

function assignedMove(registration, profile, actionFit) {
  const move = registration.design?.factors?.actionFit?.assignments?.[profile]?.[actionFit];
  if (!MOVE_TO_HOST_ACTION[move] || !MOVE_INSTRUCTIONS[move]) {
    throw new Error(`registration assigns unsupported pedagogical move ${JSON.stringify(move)}`);
  }
  return move;
}

function assignedRegister(registration, move, realization) {
  if (realization === 'plain') return registration.design.factors.realization.plain;
  if (realization === 'warm') return registration.design.factors.realization.warm;
  const register = registration.design.factors.realization.edgedByAssignedMove?.[move];
  if (!['sarcastic', 'ironic'].includes(register)) {
    throw new Error(`registration has no compatible edged register for ${move}`);
  }
  return register;
}

function treatmentEligibility({ runtime, learnerText, classification, tutorLearnerDag }) {
  const semantics = runtime.registration?.design?.trigger?.observationSemantics;
  const v4Observation = isV2Registration(runtime.registration)
    ? observeResistantLearnerTurn({ learnerText, classification, semantics })
    : null;
  const v4Refusal = v4Observation?.observations?.find(
    (observation) => observation.type === 'frame_jurisdiction_refusal',
  );
  const shadow = v4Observation
    ? {
        resistance_kind: v4Refusal ? 'frame_refuser' : null,
        observation: v4Observation,
        warrant: {
          status: v4Refusal && v4Observation.ambiguous === false ? 'licensed' : 'not_licensed',
          required_observation_type: 'frame_jurisdiction_refusal',
          basis: clone(v4Refusal || null),
          ambiguity_blocks_license: v4Observation.ambiguous === true,
          primary_move_type: v4Refusal ? 'test_bounded_distinction' : null,
        },
      }
    : observeResistanceAxis({ learnerText, classification });
  const timing = detectTutorStubEdgeTimingSignal({ learnerText, classification, tutorLearnerDag });
  const reasons = [];
  if (runtime.consumed) reasons.push('study_intervention_already_consumed');
  if (shadow.warrant.status !== 'licensed') reasons.push('no_single_axis_public_warrant');
  if (shadow.resistance_kind && shadow.resistance_kind !== runtime.profile) {
    reasons.push('observed_axis_does_not_match_registered_cohort');
  }
  if (timing.comprehensionRepair) reasons.push('comprehension_repair');
  if (timing.protectedAffect) reasons.push('protected_affect');
  if (timing.phase === 'uptake') reasons.push('content_bearing_uptake_already_visible');
  return { eligible: reasons.length === 0, reasons, shadow, timing };
}

function assignedDistribution(register) {
  return [{ engagement_stance: register, register, weight: 1, probability: 1, sourceScore: 1 }];
}

export function applyTutorStubResistanceActionRegisterStudyIntervention({
  selection,
  state,
  learnerText = '',
  classification = null,
  tutorLearnerDag = null,
} = {}) {
  const runtime = state?.resistanceActionRegisterStudy;
  if (!selection || !runtime?.enabled) return selection;
  const eligibility = treatmentEligibility({ runtime, learnerText, classification, tutorLearnerDag });
  if (!eligibility.eligible) {
    runtime.history.push({
      turn: decisionTurn(state, tutorLearnerDag),
      status: 'not_applied',
      reasons: [...eligibility.reasons],
      public_observation: clone(eligibility.shadow.observation),
    });
    return selection;
  }

  const moveType = assignedMove(runtime.registration, runtime.profile, runtime.action_fit);
  const hostAction = MOVE_TO_HOST_ACTION[moveType];
  const register = assignedRegister(runtime.registration, moveType, runtime.realization);
  const palette = new Set(state?.register?.palette || []);
  if (!palette.has(register)) throw new Error(`study-assigned register ${register} is outside the active palette`);

  const turn = decisionTurn(state, tutorLearnerDag);
  const intervention = {
    schema: TUTOR_STUB_RESISTANCE_ACTION_REGISTER_INTERVENTION_SCHEMA,
    status: 'applied',
    authority: 'explicit_study_only_opt_in',
    turn,
    profile_cohort: runtime.profile,
    profile_identity_triggered: false,
    public_trigger: {
      resistance_kind: eligibility.shadow.resistance_kind,
      warrant: clone(eligibility.shadow.warrant),
      observation: clone(eligibility.shadow.observation),
    },
    assignment: {
      action_fit: runtime.action_fit,
      realization: runtime.realization,
      repeat: runtime.repeat,
      batch_id: runtime.registration.design?.factors?.replicationBlock?.batchAssignment?.[runtime.repeat] || null,
      pedagogical_move: moveType,
      host_action_family: hostAction,
      register,
      application_order: [...runtime.registration.design.intervention.applicationOrder],
    },
    action_instruction: MOVE_INSTRUCTIONS[moveType],
    compact_action_instruction: COMPACT_MOVE_INSTRUCTIONS[moveType],
    duration_tutor_turns: 1,
    reverts_after_this_turn: true,
    safety_override: { applied: false, assigned_register: register, delivered_register: register, reason: null },
    reroll_authorized: false,
  };
  const responseConfiguration = normalizeTutorStubResponseConfiguration(
    {
      ...(selection.response_configuration || {}),
      engagement_stance: register,
      action_family: hostAction,
      engagement_stance_distribution: assignedDistribution(register),
      selection_reasons: {
        ...(selection.response_configuration?.selection_reasons || {}),
        engagement_stance: `Frozen ${runtime.realization} realization assigned after ${moveType}.`,
        action_family: `Frozen ${runtime.action_fit} pedagogical move ${moveType}.`,
      },
      compatibility: {
        ...(selection.response_configuration?.compatibility || {}),
        selected_register: register,
        assigned_pedagogical_move: moveType,
        study_only: true,
      },
      resistance_action_register_intervention: intervention,
    },
    { world: state?.world || null },
  );

  const next = {
    ...selection,
    engagement_stance: register,
    selected_register: register,
    action_family: hostAction,
    engagement_stance_distribution: assignedDistribution(register),
    selected_probability: 1,
    source: 'resistance_action_register_study_intervention',
    response_configuration: responseConfiguration,
    resistance_action_register_intervention: intervention,
  };
  runtime.consumed = true;
  runtime.history.push(clone(intervention));
  if (state?.register?.history?.at(-1) === selection) state.register.history[state.register.history.length - 1] = next;
  if (state?.register) state.register.current = next;
  return next;
}

export function applyTutorStubResistanceActionRegisterSafetyOverride(selection, { reason } = {}) {
  const intervention = selection?.resistance_action_register_intervention;
  if (!intervention || !['sarcastic', 'ironic'].includes(intervention.assignment?.register)) return selection;
  if (!['comprehension_repair', 'protected_affect', 'content_bearing_uptake_already_visible'].includes(reason)) {
    throw new Error('study safety override requires a frozen protected-condition reason');
  }
  const nextIntervention = clone(intervention);
  nextIntervention.status = 'safety_override_nonadherent';
  nextIntervention.safety_override = {
    applied: true,
    assigned_register: intervention.assignment.register,
    delivered_register: 'plain',
    reason,
  };
  const responseConfiguration = normalizeTutorStubResponseConfiguration({
    ...selection.response_configuration,
    engagement_stance: 'plain',
    engagement_stance_distribution: assignedDistribution('plain'),
    resistance_action_register_intervention: nextIntervention,
  });
  return {
    ...selection,
    engagement_stance: 'plain',
    selected_register: 'plain',
    engagement_stance_distribution: assignedDistribution('plain'),
    response_configuration: responseConfiguration,
    resistance_action_register_intervention: nextIntervention,
  };
}

function parseTrace(source) {
  return String(source || '')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function triggerFromTurnRecord(
  record,
  profile,
  observationSemantics = RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV2,
) {
  const learnerText = record?.learner || '';
  const classification = record?.classification || null;
  const shadow = observeResistanceAxis({ learnerText, classification });
  const legacySemantics = observationSemantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.legacyV1;
  const prospectiveV3 = observationSemantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV3;
  const prospectiveV4 = observationSemantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV4;
  const observationProfiles = legacySemantics ? ['frame_refuser'] : ['frame_refuser', 'frame_defiant'];
  const profileObservation = observationProfiles.includes(profile)
    ? observeResistantLearnerTurn({ learnerText, classification, semantics: observationSemantics })
    : null;
  const timing = detectTutorStubEdgeTimingSignal({ learnerText, classification, tutorLearnerDag: null });
  const frameDispute = profileObservation?.observations?.find(
    (observation) => observation.type === 'frame_jurisdiction_dispute',
  );
  const frameRefusal = profileObservation?.observations?.some(
    (observation) => observation.type === 'frame_jurisdiction_refusal',
  );
  const matchesRegisteredCohort = legacySemantics
    ? frameRefusal || shadow.resistance_kind === profile
    : (profile === 'frame_refuser' && frameRefusal) ||
      (profile === 'frame_defiant' &&
        frameDispute?.features?.contract_licensed_participation === true &&
        !frameRefusal) ||
      (!profileObservation && shadow.resistance_kind === profile);
  const warrantLicensed = prospectiveV3 || prospectiveV4 ? Boolean(frameDispute) : shadow.warrant.status === 'licensed';
  return {
    eligible:
      warrantLicensed &&
      matchesRegisteredCohort &&
      timing.comprehensionRepair !== true &&
      timing.protectedAffect !== true &&
      timing.phase !== 'uptake',
    learnerText,
    classification,
    shadow,
    cohortObservation: profileObservation || shadow.observation,
    timing,
  };
}

export function extractTutorStubResistanceActionRegisterPrefix({
  tracePath,
  profile,
  requireFrozenBundle = true,
  observationSemantics = RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV2,
} = {}) {
  const normalizedProfile = exactLevel(profile, PREFIX_PROFILES, 'prefix profile');
  const source = fs.readFileSync(tracePath, 'utf8');
  const events = parseTrace(source);
  const completed = events.filter((event) => event.type === 'turn_complete' && event.turnRecord);
  let trigger = null;
  for (const event of completed) {
    const candidate = triggerFromTurnRecord(event.turnRecord, normalizedProfile, observationSemantics);
    if (candidate.eligible) {
      trigger = { ...candidate, turn: Number(event.turn), turnId: event.turnId || event.turnRecord?.turnId || null };
      break;
    }
  }
  if (!trigger) throw new Error(`trace has no eligible ${normalizedProfile} resistance trigger: ${tracePath}`);
  const firstTriggerEvent = events.findIndex((event) => Number(event.turn) === trigger.turn);
  if (firstTriggerEvent < 0) throw new Error(`trace trigger turn ${trigger.turn} has no event boundary`);
  const prefixEvents = events.slice(0, firstTriggerEvent);
  const priorTurns = completed
    .filter((event) => Number(event.turn) < trigger.turn)
    .map((event) => ({
      turn: Number(event.turn),
      learner: event.turnRecord.learner || '',
      tutor: event.turnRecord.tutor || '',
      learnerDag: clone(event.turnRecord.tutorLearnerDagModel || null),
      publicPremiseIds: clone(event.turnRecord.tutorLeakAudit?.publicPremiseIds || []),
    }));
  const runStart = events.find((event) => event.type === 'run_start') || {};
  const prefixSource = `${prefixEvents.map((event) => JSON.stringify(event)).join('\n')}\n`;
  const publicPrefix = {
    world: runStart.metadata?.world?.id || 'world_005_marrick',
    profile: normalizedProfile,
    priorTurns,
    triggerTurn: trigger.turn,
    triggerLearnerText: trigger.learnerText,
  };
  const frozenBundle = requireFrozenBundle ? extractTutorStubFrozenTurn({ tracePath, turn: trigger.turn }) : null;
  return {
    schema: TUTOR_STUB_RESISTANCE_ACTION_REGISTER_PREFIX_SCHEMA,
    id: `${path.basename(tracePath, path.extname(tracePath))}:t${String(trigger.turn).padStart(3, '0')}`,
    profile: normalizedProfile,
    world: publicPrefix.world,
    trigger_turn: trigger.turn,
    trigger_turn_id: trigger.turnId,
    trigger_learner_text: trigger.learnerText,
    trigger_classification: clone(trigger.classification),
    trigger_observation: clone(trigger.cohortObservation),
    source_trace: path.resolve(tracePath),
    source_trace_sha256: sha256(source),
    prefix_trace_sha256: sha256(prefixSource),
    public_prefix_sha256: hashValue(publicPrefix),
    prefix_source: prefixSource,
    prior_turn_count: priorTurns.length,
    frozen_bundle: frozenBundle,
  };
}

function frozenPublicPrefixValue(bundle) {
  return {
    worldId: bundle?.worldId || null,
    turn: bundle?.turn || null,
    learnerText: bundle?.learnerText || '',
    priorTurns: clone(bundle?.priorTurns || []),
    publicPremiseIds: clone(bundle?.publicPremiseIds || []),
    duePremiseIds: clone(bundle?.duePremiseIds || []),
    frames: clone(bundle?.frames || null),
  };
}

/**
 * Add the experimental move to an already-built frozen speaking contract.
 * This leaves the byte-pinned legacy builder untouched: only the new
 * exact-prefix branch owns this post-build overlay.
 */
export function applyTutorStubResistanceActionRegisterContractOverlay({ bundle, intervention } = {}) {
  if (!bundle?.firstDraftContract || !intervention?.assignment?.pedagogical_move) {
    throw new Error('study contract overlay requires a frozen first-draft contract and intervention');
  }
  const next = clone(bundle);
  const contract = clone(next.firstDraftContract);
  const handoff = contract.host_plan?.slots?.find((slot) => slot?.id === 'handoff');
  if (!handoff?.instruction) throw new Error('study contract overlay requires the frozen HANDOFF host slot');
  contract.development = {
    ...contract.development,
    legacy_instruction: contract.development?.instruction || null,
    instruction: [contract.development?.learner_acceleration_instruction, intervention.action_instruction]
      .filter(Boolean)
      .join(' '),
    pedagogical_move: intervention.assignment.pedagogical_move,
    resistance_action_register_intervention: clone(intervention),
  };
  handoff.instruction = `${intervention.compact_action_instruction} ${handoff.instruction}`.trim();

  const messages = next.request?.messages || [];
  const latestRequest = messages.at(-1);
  if (!latestRequest || latestRequest.role !== 'user' || !FIRST_DRAFT_BLOCK.test(latestRequest.content)) {
    throw new Error('study contract overlay requires a replaceable frozen host-plan block');
  }
  latestRequest.content = latestRequest.content.replace(FIRST_DRAFT_BLOCK, tutorStubFirstDraftContractPrompt(contract));
  next.firstDraftContract = contract;
  next.request.messages = messages;
  return next;
}

export function prepareTutorStubResistanceActionRegisterFrozenBranch({
  prefix,
  registration,
  world,
  actionFit,
  realization,
  repeat,
} = {}) {
  if (!prefix?.frozen_bundle) throw new Error('exact-prefix branch requires a frozen speaking-turn bundle');
  if (prefix.world !== registration?.design?.world || world?.id !== registration?.design?.world) {
    throw new Error('exact-prefix branch world does not match the frozen registration');
  }
  const baseBundle = clone(prefix.frozen_bundle);
  const originalPrefixHash = hashValue(frozenPublicPrefixValue(baseBundle));
  const study = createTutorStubResistanceActionRegisterStudyRuntime({
    registration,
    profile: prefix.profile,
    actionFit,
    realization,
    repeat,
  });
  const selection = {
    engagement_stance: baseBundle.selectedResponseConfiguration?.engagement_stance || null,
    selected_register: baseBundle.selectedResponseConfiguration?.engagement_stance || null,
    action_family: baseBundle.selectedResponseConfiguration?.action_family || null,
    response_configuration: clone(baseBundle.selectedResponseConfiguration),
    source: 'frozen_recorded_response_configuration',
  };
  const state = {
    resistanceActionRegisterStudy: study,
    turns: Array.from({ length: Math.max(0, Number(baseBundle.turn || 1) - 1) }),
    world,
    register: {
      enabled: true,
      palette: ['plain', 'warm', 'precise', 'brisk', 'ironic', 'sarcastic'],
      history: [selection],
      current: selection,
    },
  };
  const assigned = applyTutorStubResistanceActionRegisterStudyIntervention({
    selection,
    state,
    learnerText: prefix.trigger_learner_text,
    classification: prefix.trigger_classification,
    tutorLearnerDag: { model: { turn: prefix.trigger_turn } },
  });
  if (!assigned?.resistance_action_register_intervention) {
    throw new Error(`frozen prefix ${prefix.id} did not admit its registered treatment`);
  }
  baseBundle.selectedResponseConfiguration = clone(assigned.response_configuration);
  baseBundle.resistanceActionRegisterIntervention = clone(assigned.resistance_action_register_intervention);
  const refreshedLegacy = refreshTutorStubFrozenFirstDraftRequest({ bundle: baseBundle, world });
  const refreshed = applyTutorStubResistanceActionRegisterContractOverlay({
    bundle: refreshedLegacy,
    intervention: assigned.resistance_action_register_intervention,
  });
  const refreshedPrefixHash = hashValue(frozenPublicPrefixValue(refreshed));
  if (refreshedPrefixHash !== originalPrefixHash) {
    throw new Error(`frozen prefix ${prefix.id} changed while preparing a treatment branch`);
  }
  return {
    schema: 'machinespirits.tutor-stub.resistance-action-register-frozen-branch.v1',
    prefix_id: prefix.id,
    public_prefix_sha256: prefix.public_prefix_sha256,
    frozen_bundle_prefix_sha256: originalPrefixHash,
    treatment: clone(assigned.resistance_action_register_intervention.assignment),
    intervention: clone(assigned.resistance_action_register_intervention),
    bundle: refreshed,
  };
}

function conditionsForStage(registration, stage) {
  if (stage === 'baseline') {
    const baselineRealizations = isV2Registration(registration)
      ? registeredLevels(registration, 'realization', ['plain', 'warm'])
      : ['plain', 'warm'];
    return baselineRealizations.flatMap((realization) =>
      registeredLevels(registration, 'replicationBlock', REPEATS).map((repeat) => ({
        actionFit: 'matched',
        realization,
        repeat,
      })),
    );
  }
  if (stage === 'factorial') {
    if (isV2Registration(registration)) throw new Error('v2 registration does not authorize a factorial stage');
    return ACTION_FITS.flatMap((actionFit) =>
      REALIZATIONS.flatMap((realization) => REPEATS.map((repeat) => ({ actionFit, realization, repeat }))),
    );
  }
  throw new Error('study stage must be baseline or factorial');
}

export function buildTutorStubResistanceActionRegisterPlan({ registration, prefixes, stage = 'baseline' } = {}) {
  const frozen = normalizeRegistration(registration);
  const profiles = registeredProfiles(frozen);
  if (!Array.isArray(prefixes) || !prefixes.length) throw new Error('study plan requires frozen prefixes');
  const expectedPerProfile = stage === 'baseline' ? frozen.baselinePilot.prefixesPerProfile : null;
  for (const prefix of prefixes) {
    if (prefix?.schema !== TUTOR_STUB_RESISTANCE_ACTION_REGISTER_PREFIX_SCHEMA) {
      throw new Error(`prefix ${prefix?.id || '(unnamed)'} has an unsupported schema`);
    }
    exactLevel(prefix.profile, profiles, 'prefix profile');
    if (prefix.world !== frozen.design.world) throw new Error(`prefix ${prefix.id} is not from ${frozen.design.world}`);
  }
  if (expectedPerProfile) {
    for (const profile of profiles) {
      const count = prefixes.filter((prefix) => prefix.profile === profile).length;
      if (count !== expectedPerProfile) {
        throw new Error(`baseline requires ${expectedPerProfile} fresh ${profile} prefixes; found ${count}`);
      }
    }
  }
  const identities = prefixes.map((prefix) => prefix.public_prefix_sha256);
  if (new Set(identities).size !== identities.length)
    throw new Error('study prefixes must have unique public-prefix hashes');
  const conditions = conditionsForStage(frozen, stage);
  const jobs = prefixes.flatMap((prefix) =>
    conditions.map((condition) => {
      const move = assignedMove(frozen, prefix.profile, condition.actionFit);
      const register = assignedRegister(frozen, move, condition.realization);
      const treatment = {
        profile: prefix.profile,
        action_fit: condition.actionFit,
        realization: condition.realization,
        repeat: condition.repeat,
        batch_id: frozen.design?.factors?.replicationBlock?.batchAssignment?.[condition.repeat] || null,
        pedagogical_move: move,
        host_action_family: MOVE_TO_HOST_ACTION[move],
        register,
      };
      return {
        id: `${prefix.id}__${condition.actionFit}_${condition.realization}_${condition.repeat}`,
        prefix_id: prefix.id,
        public_prefix_sha256: prefix.public_prefix_sha256,
        prefix_trace_sha256: prefix.prefix_trace_sha256,
        trigger_turn: prefix.trigger_turn,
        trigger_learner_text: prefix.trigger_learner_text,
        treatment,
      };
    }),
  );
  const expectedJobs = stage === 'baseline' ? frozen.baselinePilot.expectedTreatmentDialogues : prefixes.length * 12;
  if (jobs.length !== expectedJobs) throw new Error(`study plan expected ${expectedJobs} jobs; found ${jobs.length}`);
  return {
    schema: TUTOR_STUB_RESISTANCE_ACTION_REGISTER_PLAN_SCHEMA,
    status: 'planned_zero_call',
    stage,
    model_calls_authorized: false,
    model_calls: 0,
    production_writes: 0,
    prefixes: prefixes.map(({ prefix_source: _source, frozen_bundle: _bundle, ...prefix }) => clone(prefix)),
    jobs,
    invariants: {
      branch_only_after_trigger: true,
      exact_public_prefix_per_treatment_pair: true,
      profile_identity_may_trigger: false,
      valid_outputs_may_be_selected_or_rerolled: false,
    },
  };
}

function meritsEngagement(turn) {
  return (
    CONTENT_BEARING_MOVES.has(turn.discourse_move) ||
    CONTENT_BEARING_EVIDENCE.has(turn.evidence_use) ||
    (['challenge', 'question'].includes(turn.discourse_move) &&
      ['grounded', 'exploratory', 'reflective'].includes(turn.epistemic_stance))
  );
}

export function scoreTutorStubResistanceRecovery({ profile, triggerLearnerText = '', postLearnerTurns = [] } = {}) {
  const normalizedProfile = exactLevel(profile, PREFIX_PROFILES, 'outcome profile');
  const rows = Array.isArray(postLearnerTurns) ? postLearnerTurns : [];
  if (normalizedProfile === 'bored') {
    const first = rows[0] || {};
    const text = String(first.learnerText || first.text || '').trim();
    const recovered = Boolean(
      text && contentBearing(first.classification) && !PERMISSION_SEEKING.test(text) && !MERE_ASSENT.test(text),
    );
    return {
      profile: normalizedProfile,
      recovered,
      deadline_turns: 1,
      observed_turn: recovered ? 1 : null,
      reason: recovered ? 'content_bearing_answer_without_permission_or_mere_assent' : 'bored_recovery_absent',
    };
  }
  for (let index = 0; index < Math.min(2, rows.length); index += 1) {
    const row = rows[index] || {};
    const text = String(row.learnerText || row.text || '').trim();
    const turn = classificationTurn(row.classification);
    const axis = observeResistanceAxis({ learnerText: text, classification: row.classification });
    const preciseDispute =
      axis.resistance_kind === 'frame_defiant' &&
      FRAME_ISSUE.test(text) &&
      text.split(/\s+/u).length > Math.max(6, String(triggerLearnerText).split(/\s+/u).length / 2);
    if (meritsEngagement(turn) || preciseDispute) {
      return {
        profile: normalizedProfile,
        recovered: true,
        deadline_turns: 2,
        observed_turn: index + 1,
        reason: meritsEngagement(turn) ? 'engaged_bounded_test_on_merits' : 'frame_dispute_became_more_precise',
      };
    }
  }
  return {
    profile: normalizedProfile,
    recovered: false,
    deadline_turns: 2,
    observed_turn: null,
    reason: 'frame_recovery_absent',
  };
}

export default {
  applyTutorStubResistanceActionRegisterContractOverlay,
  applyTutorStubResistanceActionRegisterSafetyOverride,
  applyTutorStubResistanceActionRegisterStudyIntervention,
  buildTutorStubResistanceActionRegisterPlan,
  createTutorStubResistanceActionRegisterStudyRuntime,
  extractTutorStubResistanceActionRegisterPrefix,
  loadTutorStubResistanceActionRegisterRegistration,
  prepareTutorStubResistanceActionRegisterFrozenBranch,
  scoreTutorStubResistanceRecovery,
};
