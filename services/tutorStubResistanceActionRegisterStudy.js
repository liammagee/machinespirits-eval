import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { detectTutorStubEdgeTimingSignal } from './tutorStubEdgeTimingPolicy.js';
import { RESISTANT_LEARNER_OBSERVATION_SEMANTICS, observeResistantLearnerTurn } from './resistantLearnerObservation.js';
import { beginTutorStubActionBeforeRegisterShadow } from './tutorStubActionBeforeRegisterShadow.js';
import { tutorStubFirstDraftContractPrompt } from './tutorStubFirstDraftContract.js';
import { extractTutorStubFrozenTurn, refreshTutorStubFrozenFirstDraftRequest } from './tutorStubFrozenReplay.js';
import { normalizeTutorStubResponseConfiguration } from './tutorStubRegisterPragmatics.js';
import {
  loadTutorStubResistanceSemanticRegistration,
  tutorStubResistanceSemanticPublicContext,
  validateTutorStubResistanceSemanticRuntimeResult,
} from './tutorStubResistanceSemanticRuntime.js';

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

function isV3Registration(registration) {
  return (
    registration?.schema === TUTOR_STUB_RESISTANCE_ACTION_REGISTER_REGISTRATION_SCHEMA && registration?.version === 3
  );
}

function isV4Registration(registration) {
  return (
    registration?.schema === TUTOR_STUB_RESISTANCE_ACTION_REGISTER_REGISTRATION_SCHEMA && registration?.version === 4
  );
}

function isV5Registration(registration) {
  return (
    registration?.schema === TUTOR_STUB_RESISTANCE_ACTION_REGISTER_REGISTRATION_SCHEMA && registration?.version === 5
  );
}

function isV6Registration(registration) {
  return (
    registration?.schema === TUTOR_STUB_RESISTANCE_ACTION_REGISTER_REGISTRATION_SCHEMA && registration?.version === 6
  );
}

function isV7Registration(registration) {
  return (
    registration?.schema === TUTOR_STUB_RESISTANCE_ACTION_REGISTER_REGISTRATION_SCHEMA && registration?.version === 7
  );
}

function isConfirmationSuccessorRegistration(registration) {
  return (
    isV4Registration(registration) ||
    isV5Registration(registration) ||
    isV6Registration(registration) ||
    isV7Registration(registration)
  );
}

function usesProspectiveV4Observation(registration) {
  return (
    isV2Registration(registration) ||
    isV3Registration(registration) ||
    isConfirmationSuccessorRegistration(registration)
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
const BOUNDED_PUBLIC_MERITS =
  /\b(?:bounded|local|public|evidence|exhibit|record|mark|feature|distinction|comparison|criterion|assay|source|claim|premise)\b/iu;
const EXPLICIT_CONTINUED_WITHHOLDING =
  /\b(?:will not|won't|refuse|decline)\b.{0,100}\b(?:answer|test|examine|engage|consider|respond|participate|record)\b/iu;
const CONDITIONAL_PUBLIC_BOUNDARY =
  /\b(?:unless|until|only if|provided that|so long as)\b.{0,140}\b(?:public|evidence|exhibit|record|mark|feature|distinction|comparison|criterion|assay|source|claim|premise)\b/iu;
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

function usesCompositionalBoredomObservation(runtime) {
  return (
    runtime?.dynamic_boredom_proof_dag === true &&
    runtime?.proof_dag_registration?.design?.observationSemantics ===
      RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV8
  );
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
  const expectedStatus = usesProspectiveV4Observation(registration)
    ? 'prospective_zero_call_readiness_hold'
    : 'frozen_design_hold';
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
  if (!usesProspectiveV4Observation(registration)) {
    if (registration.design?.factorialCells !== 24) throw new Error('registration must retain 24 factorial cells');
    return registration;
  }
  const requiredStandingAuthorizationAttachmentSha256 = isV7Registration(registration)
    ? '538aa73239072ea618e2c8308edf562f1dd7495b78574e35a3db2f549302c1ce'
    : '4ef020fa2c59d6f7e215029374d7d5adaabc5f620fe1cbd5369020a34e88e08b';
  if (
    registration.authorization?.baselinePilotAuthorized !== false ||
    registration.authorization?.goRequestPrepared !== false ||
    registration.authorization?.standingAuthorizationAttachmentSha256 !== requiredStandingAuthorizationAttachmentSha256
  ) {
    throw new Error('prospective registration must remain on HOLD with the standing authorization attachment bound');
  }
  if (JSON.stringify(registration.design?.profiles) !== JSON.stringify(['frame_refuser'])) {
    throw new Error('v2 registration must retain frame_refuser as its only treatment profile');
  }
  if (registration.design?.diagnosticProfile !== 'frame_defiant') {
    throw new Error('v2 registration must retain frame_defiant as diagnostic-only');
  }
  const requiredObservationSemantics = isConfirmationSuccessorRegistration(registration)
    ? isV7Registration(registration)
      ? RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV7
      : isV6Registration(registration)
        ? RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV6
        : RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV5
    : RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV4;
  if (registration.design?.trigger?.observationSemantics !== requiredObservationSemantics) {
    throw new Error(`prospective registration must use ${requiredObservationSemantics} observation semantics`);
  }
  if (isV3Registration(registration)) {
    const blocks = registration.design?.factors?.confirmationBlock?.blocks;
    const calibration = registration.preservation?.calibration;
    const sizing = registration.measurement?.confirmatoryTest?.powering;
    const readiness = registration.executionReadiness;
    if (
      registration.design?.stage !== 'frame_refuser_matched_action_plain_warm_confirmation' ||
      registration.design?.form !== 'fresh_independent_online_triggered_dialogues' ||
      registration.design?.trigger?.eligibleByTurn !== 2 ||
      registration.design?.trigger?.freshDialogueRequired !== true ||
      registration.design?.trigger?.calibrationPrefixesConsumedAsInputs !== false ||
      registration.design?.factors?.actionFit?.assignments?.frame_refuser?.matched !== 'test_bounded_distinction' ||
      JSON.stringify(registration.design?.factors?.actionFit?.levels) !== JSON.stringify(['matched']) ||
      JSON.stringify(registration.design?.factors?.realization?.levels) !== JSON.stringify(['plain', 'warm']) ||
      !Array.isArray(blocks) ||
      blocks.length !== 9 ||
      blocks.some(
        (block, index) =>
          block.id !== `block_${String(index + 1).padStart(2, '0')}` ||
          block.dialogues !== 4 ||
          block.plain !== 2 ||
          block.warm !== 2,
      ) ||
      calibration?.reportSha256 !== '42021a390338cd556386efc96d8f00b35655a411627908a10248dba1e473a3a5' ||
      calibration?.dialogues !== 12 ||
      calibration?.plainRecovered !== 1 ||
      calibration?.warmRecovered !== 4 ||
      calibration?.pooledIntoConfirmation !== false ||
      sizing?.test !== 'fisher_exact_two_sided' ||
      sizing?.alpha !== 0.05 ||
      sizing?.targetPower !== 0.8 ||
      sizing?.plainCalibrationRate !== 1 / 6 ||
      sizing?.warmCalibrationRate !== 4 / 6 ||
      sizing?.minimumNPerArm !== 18 ||
      sizing?.powerAt17PerArm !== 0.796776592585303 ||
      sizing?.powerAt18PerArm !== 0.8388687257645503 ||
      readiness?.plannedRoleCallsPerDialogue !== 20 ||
      readiness?.maximumReservationsPerPlannedCall !== 3 ||
      readiness?.maximumModelAttemptReservationsPerDialogue !== 60 ||
      readiness?.combinedDialogues !== 36 ||
      readiness?.combinedPlannedRoleCalls !== 720 ||
      readiness?.combinedMaximumModelAttemptReservations !== 2160 ||
      readiness?.programmeLedgerAfterMaximum?.reservedAttempts !== 2345 ||
      readiness?.programmeLedgerAfterMaximum?.ceiling !== 2345 ||
      readiness?.programmeLedgerAfterMaximum?.remaining !== 0 ||
      registration.authorization?.programmeLedgerBeforeThisConfirmation?.reservedAttempts !== 185 ||
      registration.authorization?.programmeLedgerBeforeThisConfirmation?.ceiling !== 1200 ||
      registration.authorization?.programmeLedgerBeforeThisConfirmation?.remaining !== 1015 ||
      registration.authorization?.requiredCeilingAmendment?.from !== 1200 ||
      registration.authorization?.requiredCeilingAmendment?.to !== 2345 ||
      registration.authorization?.requiredCeilingAmendment?.increase !== 1145
    ) {
      throw new Error('v3 confirmation design, calibration separation, power, or hard-attempt arithmetic drifted');
    }
    const batches = readiness?.batches;
    if (
      !Array.isArray(batches) ||
      batches.length !== 9 ||
      batches.some(
        (batch, index) =>
          batch.id !== blocks[index].id ||
          batch.dialogues !== 4 ||
          batch.plannedRoleCalls !== 80 ||
          batch.maximumModelAttemptReservations !== 240 ||
          batch.destination !== null,
      )
    ) {
      throw new Error('v3 confirmation must retain nine balanced four-dialogue batches capped at 240 each');
    }
    return registration;
  }
  if (isConfirmationSuccessorRegistration(registration)) {
    const blocks = registration.design?.factors?.confirmationBlock?.blocks;
    const calibration = registration.preservation?.calibration;
    const stopped = registration.preservation?.stoppedConfirmationV1;
    const stoppedV3 = registration.preservation?.stoppedConfirmationV3;
    const stoppedV4 = registration.preservation?.stoppedConfirmationV4;
    const sizing = registration.measurement?.confirmatoryTest?.powering;
    const readiness = registration.executionReadiness;
    if (
      registration.design?.stage !== 'frame_refuser_matched_action_plain_warm_confirmation_successor' ||
      registration.design?.form !== 'fresh_independent_online_triggered_dialogues' ||
      registration.design?.trigger?.eligibleByTurn !== 2 ||
      registration.design?.trigger?.freshDialogueRequired !== true ||
      registration.design?.trigger?.calibrationPrefixesConsumedAsInputs !== false ||
      registration.design?.trigger?.observerFirstEligibility !== true ||
      registration.design?.factors?.actionFit?.assignments?.frame_refuser?.matched !== 'test_bounded_distinction' ||
      JSON.stringify(registration.design?.factors?.actionFit?.levels) !== JSON.stringify(['matched']) ||
      JSON.stringify(registration.design?.factors?.realization?.levels) !== JSON.stringify(['plain', 'warm']) ||
      !Array.isArray(blocks) ||
      blocks.length !== 9 ||
      blocks.some(
        (block, index) =>
          block.id !== `block_${String(index + 1).padStart(2, '0')}` ||
          block.dialogues !== 4 ||
          block.plain !== 2 ||
          block.warm !== 2,
      ) ||
      calibration?.reportSha256 !== '42021a390338cd556386efc96d8f00b35655a411627908a10248dba1e473a3a5' ||
      calibration?.dialogues !== 12 ||
      calibration?.pooledIntoConfirmation !== false ||
      stopped?.requestSha256 !== '16f93e48f0b19fe23f0b91dabc9ac318f210ecbba6fbe954d76677d43fb78554' ||
      stopped?.privateArchiveCommit !== '4604cc31920913e10b3e04565bf3d70def7c112e' ||
      stopped?.reservedAttempts !== 34 ||
      stopped?.completedCalls !== 34 ||
      stopped?.providerFailures !== 0 ||
      stopped?.excludedFromSuccessor !== true ||
      ((isV6Registration(registration) || isV7Registration(registration)) &&
        (registration.design?.randomization?.masterSeed !== (isV7Registration(registration) ? 20260824 : 20260823) ||
          registration.design?.trigger?.priorIncompleteConfirmationV3ConsumedAsInputs !== false ||
          stoppedV3?.requestSha256 !== 'e3df720358cc597e686f0007bfc1ce1a5d0b4a11273a725ce87b484d20c3fec9' ||
          stoppedV3?.sourceCommit !== 'c9f6d57b867376e94384e9efe99ccf8a79ca9195' ||
          stoppedV3?.privateArchiveCommit !== '6f3e8f84079787abe1b0829be65be742c5983988' ||
          stoppedV3?.localInventorySha256 !== '83428e7d86df598b5794e3890e62e91e48dddea46514e6a0cd4d4123340c7493' ||
          stoppedV3?.liveMirrorInventorySha256 !== 'ce29fe1cef61b564b09d413b0b6782e2661a4ccff732b97c815d72deec72dae3' ||
          stoppedV3?.reservedAttempts !== 36 ||
          stoppedV3?.completedCalls !== 35 ||
          stoppedV3?.providerFailures !== 0 ||
          stoppedV3?.coordinatorInterruptedReservations !== 1 ||
          stoppedV3?.excludedFromSuccessor !== true ||
          stoppedV3?.reused !== false ||
          stoppedV3?.pooled !== false ||
          stoppedV3?.outcomeSelected !== false ||
          registration.confirmation?.priorIncompleteConfirmationV3DialoguesReused !== 0 ||
          registration.confirmation?.priorIncompleteConfirmationV3DialoguesPooled !== 0)) ||
      (isV7Registration(registration) &&
        (registration.design?.randomization?.masterSeed !== 20260824 ||
          registration.design?.trigger?.priorIncompleteConfirmationV4ConsumedAsInputs !== false ||
          stoppedV4?.requestSha256 !== '8c25d6afcae9b9c5689f3130664048c63d303a440412af7f4ba138a6a9337aab' ||
          stoppedV4?.sourceCommit !== '8d18480e8e531ae7b4ac4e5c63e8de82628aea9f' ||
          stoppedV4?.sourceTree !== 'adadcbff0502d0df15e777d8cebe1d7d5daa5011' ||
          stoppedV4?.batchPlanSha256 !== '388ee1df888d69f8cf2a63f6330e799092c3cc827a0e23c0913886ef9bb57591' ||
          stoppedV4?.batchResultSha256 !== '1d957f5bf8707f5ce2150a8e3576ad4ab2440f7e1e8a1f43a064e863de001636' ||
          stoppedV4?.privateArchiveBranch !== 'codex/resistance-action-register-confirmation-v4-incomplete-archive' ||
          stoppedV4?.privateArchiveCommit !== '05eb01179a437c4a7723a831639b1d7126a338e2' ||
          stoppedV4?.privateArchiveTree !== 'e978a6761c6d8978084fd5d574758d75e3fb6d4d' ||
          stoppedV4?.privateArchiveBase !== 'b36f25a295f23250f95d0ca6539123f12cc6a6af' ||
          stoppedV4?.localInventoryFiles !== 18 ||
          stoppedV4?.localInventoryBytes !== 7_845_834 ||
          stoppedV4?.localInventorySha256 !== 'd4585b41981d6ac4d4d6e44a6fccc253f792221f5e2c3f87fd7ec5d42c16eafe' ||
          stoppedV4?.liveMirrorInventoryFiles !== 8 ||
          stoppedV4?.liveMirrorInventoryBytes !== 922_685 ||
          stoppedV4?.liveMirrorInventorySha256 !== '7545452e100a2cfc1b59c17e6da8c1a5196eb7fc5d272cd60556c7462cb524fa' ||
          stoppedV4?.privateArchiveInventoryFiles !== 16 ||
          stoppedV4?.privateArchiveInventoryBytes !== 3_216_802 ||
          stoppedV4?.privateArchiveInventorySha256 !==
            '5f913668777b7bd5111d575eec49daca71a05b7f03f4a7e4281bc285a943845b' ||
          stoppedV4?.ledgerSha256 !== '2b3bf3f416edafdd21777219f7031afef7cfef75e8adebc843c4cc16576ba1b7' ||
          stoppedV4?.dialoguesPlanned !== 36 ||
          stoppedV4?.dialoguesStarted !== 4 ||
          stoppedV4?.dialoguesComplete !== 2 ||
          stoppedV4?.dialoguesSubstantiveFailure !== 2 ||
          stoppedV4?.reservedAttempts !== 38 ||
          stoppedV4?.completedCalls !== 38 ||
          stoppedV4?.providerFailures !== 0 ||
          stoppedV4?.abortedCalls !== 0 ||
          stoppedV4?.interruptedCalls !== 0 ||
          JSON.stringify(stoppedV4?.traceSha256) !==
            JSON.stringify({
              s1: '5d17d885bdad4e4b1ffe3b2a63a2e81f70c334eb9aafe1a5add649ebe1b8ac6c',
              s2: '7a9bd37991410c35f868f26fb63dc002d7aabdb64849a42220a1df8e50928942',
              s3: '14235461410868bba4e2a2bed2a7e24022dd4eadbe655b05835f0170da8ca3c3',
              s4: 'a211ea656bc458aaa3e31f6552d65e65b67a9f428ed6388d6006af057d8164ee',
            }) ||
          JSON.stringify(stoppedV4?.compressedTraceSha256) !==
            JSON.stringify({
              s1: 'a438528c8e5526038667e6f24cb0d080884b994acd3a6d4eebb293f3778dde75',
              s2: '3ef7bc055efe5410b77495e8e98d5d319e9cb4c76bab220e918748798e695dc5',
              s3: '549ab0a561951676a322e0ed8c4d8987ab79ac17190a0ef17e26b7423f319a45',
              s4: 'e5e4a872cbfd68dd7f5b633be6d018da1b97392b07c3433b51e6bccfd4f29dd3',
            }) ||
          stoppedV4?.block2Through9Started !== false ||
          stoppedV4?.recoveryRun !== false ||
          stoppedV4?.analyzerRun !== false ||
          stoppedV4?.reportWritten !== false ||
          stoppedV4?.resultProduced !== false ||
          stoppedV4?.sealProduced !== false ||
          stoppedV4?.excludedFromSuccessor !== true ||
          stoppedV4?.reused !== false ||
          stoppedV4?.pooled !== false ||
          stoppedV4?.outcomeSelected !== false ||
          registration.confirmation?.priorIncompleteConfirmationV4DialoguesReused !== 0 ||
          registration.confirmation?.priorIncompleteConfirmationV4DialoguesPooled !== 0)) ||
      sizing?.test !== 'fisher_exact_two_sided' ||
      sizing?.alpha !== 0.05 ||
      sizing?.targetPower !== 0.8 ||
      sizing?.minimumNPerArm !== 18 ||
      readiness?.plannedRoleCallsPerDialogue !== 20 ||
      readiness?.maximumReservationsPerPlannedCall !== 3 ||
      readiness?.maximumModelAttemptReservationsPerDialogue !== 60 ||
      readiness?.combinedDialogues !== 36 ||
      readiness?.combinedPlannedRoleCalls !== 720 ||
      readiness?.combinedMaximumModelAttemptReservations !== 2160 ||
      readiness?.programmeLedgerAfterMaximum?.reservedAttempts !==
        (isV7Registration(registration) ? 2453 : isV6Registration(registration) ? 2415 : 2379) ||
      readiness?.programmeLedgerAfterMaximum?.ceiling !==
        (isV5Registration(registration) || isV6Registration(registration) || isV7Registration(registration)
          ? 5000
          : 2379) ||
      readiness?.programmeLedgerAfterMaximum?.remaining !==
        (isV7Registration(registration)
          ? 2547
          : isV6Registration(registration)
            ? 2585
            : isV5Registration(registration)
              ? 2621
              : 0) ||
      ((isV5Registration(registration) || isV6Registration(registration) || isV7Registration(registration)) &&
        (readiness?.attemptAccountingRole !==
          'operational_execution_safeguard_only_not_scientific_endpoint_or_design_objective' ||
          registration.preservation?.supersedesRegistrationPath !==
            (isV7Registration(registration)
              ? 'config/tutor-stub-resistance-action-register-crossed-registration.v6.json'
              : isV6Registration(registration)
                ? 'config/tutor-stub-resistance-action-register-crossed-registration.v5.json'
                : 'config/tutor-stub-resistance-action-register-crossed-registration.v4.json') ||
          registration.authorization?.requiredCeilingAmendment?.authorized !== false)) ||
      registration.authorization?.programmeLedgerBeforeThisConfirmation?.reservedAttempts !==
        (isV7Registration(registration) ? 293 : isV6Registration(registration) ? 255 : 219) ||
      registration.authorization?.programmeLedgerBeforeThisConfirmation?.ceiling !==
        (isV6Registration(registration) || isV7Registration(registration) ? 5000 : 2345) ||
      registration.authorization?.programmeLedgerBeforeThisConfirmation?.remaining !==
        (isV7Registration(registration) ? 4707 : isV6Registration(registration) ? 4745 : 2126) ||
      registration.authorization?.requiredCeilingAmendment?.from !==
        (isV6Registration(registration) || isV7Registration(registration) ? 5000 : 2345) ||
      registration.authorization?.requiredCeilingAmendment?.to !==
        (isV6Registration(registration) || isV7Registration(registration)
          ? 5000
          : isV5Registration(registration)
            ? 5000
            : 2379) ||
      registration.authorization?.requiredCeilingAmendment?.increase !==
        (isV6Registration(registration) || isV7Registration(registration)
          ? 0
          : isV5Registration(registration)
            ? 2655
            : 34)
    ) {
      throw new Error('successor confirmation design, exclusions, power, or hard-attempt arithmetic drifted');
    }
    const batches = readiness?.batches;
    if (
      !Array.isArray(batches) ||
      batches.length !== 9 ||
      batches.some(
        (batch, index) =>
          batch.id !== blocks[index].id ||
          batch.dialogues !== 4 ||
          batch.plannedRoleCalls !== 80 ||
          batch.maximumModelAttemptReservations !== 240 ||
          batch.destination !== null,
      )
    ) {
      throw new Error('v4 successor confirmation must retain nine fresh balanced batches capped at 240 each');
    }
    return registration;
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

export function tutorStubResistanceActionRegisterTreatmentEligibility({
  runtime,
  learnerText,
  classification,
  tutorLearnerDag,
  turnNumber = null,
  expectedPublicContext = null,
}) {
  const semantics = runtime.registration?.design?.trigger?.observationSemantics;
  if (semantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveFrameResistanceSemanticV1) {
    const semanticAdjudication = runtime.current_semantic_adjudication || null;
    const semanticBinding = loadTutorStubResistanceSemanticRegistration();
    const semanticValidation = validateTutorStubResistanceSemanticRuntimeResult({
      result: semanticAdjudication,
      learnerText,
      turnNumber,
      registrationBinding: semanticBinding,
      expectedPublicContext,
    });
    const aggregate = semanticAdjudication?.aggregate || null;
    const observedProfile =
      aggregate?.status === 'determinate'
        ? aggregate.final_label === 'frame_refuser'
          ? 'frame_refuser'
          : aggregate.final_label === 'frame_defiant_or_productive_dispute'
            ? 'frame_defiant'
            : null
        : null;
    const matchesRegisteredCohort = observedProfile === runtime.profile;
    const timingObservation = detectTutorStubEdgeTimingSignal({ learnerText, classification, tutorLearnerDag });
    const reasons = [];
    if (runtime.consumed) reasons.push('study_intervention_already_consumed');
    if (!semanticValidation.valid) reasons.push('semantic_measurement_indeterminate_missing_or_stale');
    if (semanticValidation.valid && !matchesRegisteredCohort) {
      reasons.push('semantic_label_does_not_match_registered_cohort');
    }
    if (timingObservation.comprehensionRepair) reasons.push('comprehension_repair');
    if (timingObservation.protectedAffect) reasons.push('protected_affect');
    return {
      eligible: reasons.length === 0,
      reasons,
      shadow: {
        resistance_kind: observedProfile,
        observation: {
          schema: 'machinespirits.tutor-stub.resistance-semantic-trigger-observation.v1',
          authority: 'independent_dual_judge_consensus',
          semanticAdjudication: clone(semanticAdjudication),
          validation: semanticValidation,
        },
        warrant: {
          status: semanticValidation.valid && matchesRegisteredCohort ? 'licensed' : 'not_licensed',
          required_observation_type: 'independent_semantic_consensus',
          basis: clone(aggregate),
          ambiguity_blocks_license: !semanticValidation.valid,
          primary_move_type: semanticValidation.valid && matchesRegisteredCohort ? 'test_bounded_distinction' : null,
        },
      },
      timing: {
        authority: 'advisory_only_under_semantic_observation',
        observation: timingObservation,
        canVetoSemanticClassification: false,
        canBlockUnsafeIntervention: true,
      },
      semantic_authority: {
        regex_or_keyword_veto_allowed: false,
        luna_classifier_vote_or_tiebreak_allowed: false,
        safety_signal_can_recode_semantic_positive: false,
        semantic_label: observedProfile,
      },
    };
  }
  const compositionalBoredom = usesCompositionalBoredomObservation(runtime);
  const v4Observation = usesProspectiveV4Observation(runtime.registration)
    ? observeResistantLearnerTurn({ learnerText, classification, semantics })
    : null;
  const v4Refusal = v4Observation?.observations?.find(
    (observation) => observation.type === 'frame_jurisdiction_refusal',
  );
  const compositionalBoredomShadow = compositionalBoredom
    ? beginTutorStubActionBeforeRegisterShadow({
        learnerText,
        classification,
        tutorLearnerDag,
        observationSemantics: RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV8,
      }).resistance_axis_shadow
    : null;
  const shadow =
    compositionalBoredomShadow ||
    (v4Observation
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
      : observeResistanceAxis({ learnerText, classification }));
  const timing = detectTutorStubEdgeTimingSignal({ learnerText, classification, tutorLearnerDag });
  const confirmationObserverFirstRefusal =
    isConfirmationSuccessorRegistration(runtime.registration) &&
    runtime.dynamic_confirmation === true &&
    v4Refusal?.features?.content_bearing === false &&
    v4Refusal?.features?.contract_licensed_participation === false &&
    Number(
      tutorLearnerDag?.advance?.supportedMoveCount ?? tutorLearnerDag?.model?.learnerAdvance?.supportedMoveCount ?? 0,
    ) === 0 &&
    !contentBearing(classification) &&
    !/\b(?:now i see|i see why|that makes sense|the deciding feature|the key (?:feature|point|hinge)|i(?:'ll| will) hold|my (?:claim|sentence|test) is|provisionally|this is less dead)\b/iu.test(
      String(learnerText || ''),
    );
  const reasons = [];
  if (runtime.consumed) reasons.push('study_intervention_already_consumed');
  if (shadow.warrant.status !== 'licensed') reasons.push('no_single_axis_public_warrant');
  if (shadow.resistance_kind && shadow.resistance_kind !== runtime.profile) {
    reasons.push('observed_axis_does_not_match_registered_cohort');
  }
  if (timing.comprehensionRepair) reasons.push('comprehension_repair');
  if (timing.protectedAffect) reasons.push('protected_affect');
  if (timing.phase === 'uptake' && !confirmationObserverFirstRefusal && !compositionalBoredom) {
    reasons.push('content_bearing_uptake_already_visible');
  }
  const boredomComposition = compositionalBoredom
    ? shadow.observation?.registered_observation?.boredom_composition ||
      shadow.observation?.registered_observation?.defeated?.find(
        (candidate) => candidate.type === 'bored_effort_withholding',
      )?.composition ||
      shadow.observation?.registered_observation?.observations?.find(
        (candidate) => candidate.type === 'bored_effort_withholding',
      )?.features?.composition ||
      null
    : null;
  return {
    eligible: reasons.length === 0,
    reasons,
    shadow,
    timing,
    ...(compositionalBoredom
      ? {
          boredom_compositional_precedence: {
            consumed_by_timing_decision: true,
            generic_uptake_override_allowed: false,
            disposition: boredomComposition?.disposition || 'negative_no_boredom_cue',
            ambiguous: boredomComposition?.ambiguous === true,
          },
        }
      : {}),
    ...(isConfirmationSuccessorRegistration(runtime.registration)
      ? { confirmation_observer_first_refusal: confirmationObserverFirstRefusal }
      : {}),
  };
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
  const semanticObservation =
    runtime.registration?.design?.trigger?.observationSemantics ===
    RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveFrameResistanceSemanticV1;
  const eligibility = tutorStubResistanceActionRegisterTreatmentEligibility({
    runtime,
    learnerText,
    classification,
    tutorLearnerDag,
    turnNumber: decisionTurn(state, tutorLearnerDag),
    expectedPublicContext: semanticObservation ? tutorStubResistanceSemanticPublicContext(state) : null,
  });
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
      ...(runtime.batch_id
        ? { batch_id: runtime.batch_id }
        : runtime.registration.design?.factors?.replicationBlock?.batchAssignment?.[runtime.repeat]
          ? { batch_id: runtime.registration.design.factors.replicationBlock.batchAssignment[runtime.repeat] }
          : {}),
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
  if (runtime.dynamic_confirmation === true) {
    runtime.trigger_turn = turn;
    runtime.trigger_learner_text = String(learnerText || '');
    runtime.trigger_learner_sha256 = sha256(runtime.trigger_learner_text);
  }
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
  expectedPublicContext = null,
) {
  const learnerText = record?.learner || '';
  const classification = record?.classification || null;
  if (observationSemantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveFrameResistanceSemanticV1) {
    const semanticAdjudication = record?.resistanceSemanticAdjudication || null;
    const semanticValidation = validateTutorStubResistanceSemanticRuntimeResult({
      result: semanticAdjudication,
      learnerText,
      turnNumber: Number(record?.turn),
      registrationBinding: loadTutorStubResistanceSemanticRegistration(),
      expectedPublicContext,
    });
    const aggregate = semanticAdjudication?.aggregate || null;
    const observedProfile =
      aggregate?.status === 'determinate'
        ? aggregate.final_label === 'frame_refuser'
          ? 'frame_refuser'
          : aggregate.final_label === 'frame_defiant_or_productive_dispute'
            ? 'frame_defiant'
            : null
        : null;
    return {
      eligible: semanticValidation.valid && observedProfile === profile,
      learnerText,
      classification,
      shadow: {
        resistance_kind: observedProfile,
        observation: { semanticAdjudication, validation: semanticValidation },
        warrant: {
          status: semanticValidation.valid && observedProfile === profile ? 'licensed' : 'not_licensed',
          basis: aggregate,
        },
      },
      cohortObservation: semanticAdjudication,
      timing: { authority: 'advisory_only_under_semantic_observation', canVetoSemanticPositive: false },
    };
  }
  const shadow = observeResistanceAxis({ learnerText, classification });
  const legacySemantics = observationSemantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.legacyV1;
  const prospectiveV3 = observationSemantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV3;
  const prospectiveV4 = observationSemantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV4;
  const prospectiveV5 = observationSemantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV5;
  const prospectiveV6 = observationSemantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV6;
  const prospectiveV7 = observationSemantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV7;
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
  const warrantLicensed =
    prospectiveV3 || prospectiveV4 || prospectiveV5 || prospectiveV6 || prospectiveV7
      ? Boolean(frameDispute)
      : shadow.warrant.status === 'licensed';
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
  const opening = events.find((event) => event.type === 'tutor_opening')?.text;
  const publicHistory = opening ? [{ role: 'assistant', text: opening }] : [];
  let trigger = null;
  for (const event of completed) {
    const candidate = triggerFromTurnRecord(
      event.turnRecord,
      normalizedProfile,
      observationSemantics,
      publicHistory.slice(-4),
    );
    if (candidate.eligible) {
      trigger = { ...candidate, turn: Number(event.turn), turnId: event.turnId || event.turnRecord?.turnId || null };
      break;
    }
    publicHistory.push(
      { role: 'learner', text: String(event.turnRecord.learner || '') },
      { role: 'assistant', text: String(event.turnRecord.tutor || '') },
    );
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
    ...(observationSemantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV4
      ? { observation_semantics: observationSemantics }
      : {}),
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
  if (isV2Registration(frozen)) {
    const bindings = frozen.design.trigger.frozenPrefixSource.prefixes;
    for (const prefix of prefixes) {
      const binding = bindings.find((candidate) => candidate.publicPrefixSha256 === prefix.public_prefix_sha256);
      if (
        !binding ||
        prefix.source_trace_sha256 !== binding.sourceTraceSha256 ||
        prefix.trigger_turn !== binding.triggerTurn ||
        prefix.observation_semantics !== RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV4
      ) {
        throw new Error(`v2 prefix ${prefix.id} does not match the frozen prospective-v4 source binding`);
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
        ...(frozen.design?.factors?.replicationBlock?.batchAssignment?.[condition.repeat]
          ? { batch_id: frozen.design.factors.replicationBlock.batchAssignment[condition.repeat] }
          : {}),
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

function frameRefuserMeritsEngagement(turn, text) {
  if (EXPLICIT_CONTINUED_WITHHOLDING.test(text)) return false;
  return Boolean(
    CONTENT_BEARING_EVIDENCE.has(turn.evidence_use) ||
    (BOUNDED_PUBLIC_MERITS.test(text) &&
      (CONTENT_BEARING_MOVES.has(turn.discourse_move) ||
        (['challenge', 'question'].includes(turn.discourse_move) &&
          ['grounded', 'exploratory', 'reflective'].includes(turn.epistemic_stance)))),
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
    const strictFrameRefuser = normalizedProfile === 'frame_refuser';
    const engagedMerits = strictFrameRefuser ? frameRefuserMeritsEngagement(turn, text) : meritsEngagement(turn);
    const preciseDispute =
      axis.resistance_kind === 'frame_defiant' &&
      FRAME_ISSUE.test(text) &&
      (!strictFrameRefuser ||
        (BOUNDED_PUBLIC_MERITS.test(text) &&
          (!EXPLICIT_CONTINUED_WITHHOLDING.test(text) || CONDITIONAL_PUBLIC_BOUNDARY.test(text)))) &&
      text.split(/\s+/u).length > Math.max(6, String(triggerLearnerText).split(/\s+/u).length / 2);
    if (engagedMerits || preciseDispute) {
      return {
        profile: normalizedProfile,
        recovered: true,
        deadline_turns: 2,
        observed_turn: index + 1,
        reason: engagedMerits ? 'engaged_bounded_test_on_merits' : 'frame_dispute_became_more_precise',
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
