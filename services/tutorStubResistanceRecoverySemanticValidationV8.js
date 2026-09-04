import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { recordFileDigest } from './recordedFileDigest.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_VALIDATION_REGISTRATION_V8 =
  'config/tutor-stub-resistance-recovery-primary-validation-registration.v8.json';
export const TUTOR_STUB_RESISTANCE_FIDELITY_VALIDATION_REGISTRATION_V8 =
  'config/tutor-stub-resistance-intervention-fidelity-validation-registration.v8.json';
const INSTRUMENT_PATH = 'config/tutor-stub-resistance-recovery-semantic-adjudication-registration.v8.json';
const CORPUS_PATH = 'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v8.json';

function sha256File(relative) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(ROOT, relative)))
    .digest('hex');
}

function read(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}

function count(cases, predicate) {
  return cases.filter(predicate).length;
}

export function validateTutorStubResistanceMeasurementValidationV8({ registration, instrument, corpus }) {
  const issues = [];
  if (
    registration?.schema !== 'machinespirits.tutor-stub.resistance-measurement-validation-registration.v8' ||
    registration?.version !== 8 ||
    !['primary_recovery', 'intervention_fidelity'].includes(registration?.stage) ||
    registration?.status !== 'fresh_heldout_frozen_pending_digest_bound_go'
  ) {
    issues.push('validation registration identity drifted');
  }
  if (
    registration?.instrument?.path !== INSTRUMENT_PATH ||
    registration?.heldout?.corpusPath !== CORPUS_PATH ||
    registration?.heldout?.corpusSha256 !== sha256File(CORPUS_PATH) ||
    registration?.heldout?.corpusFreezeCommit !== 'e1c8f133d00be5730a65e1a769c13fc5174693c6' ||
    registration?.heldout?.cases !== 120 ||
    registration?.heldout?.goldVisibleDuringExecution !== false ||
    registration?.heldout?.consumedCasesReusedOrPooled !== false
  ) {
    issues.push('instrument or heldout binding drifted');
  }
  if (
    instrument?.schema !== 'machinespirits.tutor-stub.resistance-recovery-semantic-adjudication-registration.v8' ||
    instrument?.version !== 8 ||
    instrument?.status !==
      'transport_observable_compositional_plain_split_instrument_frozen_pending_genuinely_fresh_v8_heldout' ||
    instrument?.instrument?.freezeCommit !== '9cd37f0b6708ea9410930d97516aa707c762c632' ||
    instrument?.instrument?.primaryFinalRecoveryReturnedByModel !== false ||
    instrument?.instrument?.confidenceEvidenceAndIndeterminacyAreFieldLocal !== true ||
    instrument?.instrument?.primaryAndFidelityPromptCallsSeparate !== true ||
    instrument?.instrument?.fidelityPacketContainsLearnerOutcome !== false ||
    instrument?.instrument?.fidelityFailureMayVetoOrRecodePrimary !== false ||
    instrument?.evidenceProtocol?.modelSuppliedNumericOffsetsPresent !== false ||
    instrument?.evidenceProtocol?.regexKeywordLexicalOrGeneratorSemanticAuthority !== 'none' ||
    instrument?.transport?.failureDiagnosticsPersistedToAttemptRecord !== true ||
    instrument?.transport?.stagesRunSequentially !== true ||
    JSON.stringify(instrument?.transport?.responseFreeRetryDelaysMs) !== JSON.stringify([15000, 45000]) ||
    instrument?.measurement?.judges?.length !== 3 ||
    new Set(instrument?.measurement?.judges?.map((judge) => judge.id)).size !== 3 ||
    instrument?.measurement?.judges?.some(
      (judge) => judge.effort !== 'low' || judge.independent !== true || judge.modelRef === 'codex.gpt-5.6-luna',
    )
  ) {
    issues.push('split semantic instrument or transport contract drifted');
  }
  if (
    corpus?.schema !== 'machinespirits.tutor-stub.resistance-recovery-semantic-adjudication-corpus.v8' ||
    corpus?.version !== 8 ||
    corpus?.role !== 'genuinely_fresh_heldout_blinded' ||
    corpus?.frozen !== true ||
    corpus?.authored_after_instrument_freeze_commit !== instrument?.instrument?.freezeCommit ||
    corpus?.authored_after_registration_commit !== '932c20c70af6591d47782d8d23426c88d706d339' ||
    corpus?.judge_models_authored_gold_or_cases !== false ||
    corpus?.prompt_examples_allowed !== false ||
    corpus?.cases?.length !== 120 ||
    new Set(corpus?.cases?.map((row) => row.case_id)).size !== 120 ||
    count(corpus.cases, (row) => row.strata.recovery === 'merits_only') !== 32 ||
    count(corpus.cases, (row) => row.strata.recovery === 'grounded_only') !== 32 ||
    count(corpus.cases, (row) => row.strata.recovery === 'both') !== 16 ||
    count(corpus.cases, (row) => row.strata.recovery === 'no_recovery') !== 40 ||
    count(corpus.cases, (row) => row.strata.register === 'warm') !== 40 ||
    count(corpus.cases, (row) => row.strata.register === 'plain') !== 40 ||
    count(corpus.cases, (row) => row.strata.register === 'neither') !== 40 ||
    count(corpus.cases, (row) => row.strata.action_present) !== 80
  ) {
    issues.push('fresh heldout topology or strata drifted');
  }
  const readiness = registration?.executionReadiness || {};
  if (
    readiness.plannedCases !== 120 ||
    readiness.judgesPerCase !== 3 ||
    readiness.plannedModelCalls !== 360 ||
    readiness.maximumReservationsPerPlannedCall !== 3 ||
    readiness.hardStageReservations !== 1080 ||
    readiness.combinedValidationMaximumAfterBothStages !== 5187 ||
    readiness.programmeCeiling !== 10000 ||
    readiness.attemptCountsAreOperationalSafeguardsNotDesignObjectives !== true ||
    registration?.lifecycle?.retryOnlyProvenResponseFreeError !== true ||
    JSON.stringify(registration?.lifecycle?.responseFreeRetryDelaysMs) !== JSON.stringify([15000, 45000]) ||
    registration?.lifecycle?.failureDiagnosticsPersistedToAttemptRecord !== true ||
    registration?.lifecycle?.stageOrder !== 'primary_then_fidelity' ||
    registration?.lifecycle?.noRecallAfterSemanticOrAmbiguousReturn !== true ||
    registration?.lifecycle?.noRepairRerunReplacementOrSelection !== true ||
    registration?.analysis?.combinedOnlyAfterBothStagesSealed !== true ||
    registration?.analysis?.interimStageOutcomeAnalysis !== false ||
    registration?.analysis?.primaryAndFidelityVerdictsSeparate !== true ||
    registration?.analysis?.fidelityMayVetoOrRecodePrimary !== false ||
    registration?.authorization?.modelCallsAuthorized !== false
  ) {
    issues.push('execution, lifecycle, analysis, or authorization boundary drifted');
  }
  const digestRecords = [
    recordFileDigest({
      root: ROOT,
      filePath: INSTRUMENT_PATH,
      recordedSha256: registration?.instrument?.sha256,
      label: 'v8 adjudication instrument registration',
    }),
  ];
  return { valid: issues.length === 0, issues, digestRecords };
}

export function loadTutorStubResistanceMeasurementValidationV8(registrationPath) {
  if (
    ![
      TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_VALIDATION_REGISTRATION_V8,
      TUTOR_STUB_RESISTANCE_FIDELITY_VALIDATION_REGISTRATION_V8,
    ].includes(registrationPath)
  ) {
    throw new Error('unknown split resistance measurement validation registration');
  }
  const registration = read(registrationPath);
  const instrument = read(INSTRUMENT_PATH);
  const corpus = read(CORPUS_PATH);
  const validation = validateTutorStubResistanceMeasurementValidationV8({ registration, instrument, corpus });
  if (!validation.valid) throw new Error(validation.issues.join('; '));
  return {
    stage: registration.stage,
    registrationPath,
    registrationSha256: sha256File(registrationPath),
    registration,
    instrumentPath: INSTRUMENT_PATH,
    instrumentSha256: sha256File(INSTRUMENT_PATH),
    instrument,
    corpusPath: CORPUS_PATH,
    corpusSha256: sha256File(CORPUS_PATH),
    corpus,
    digestRecords: validation.digestRecords,
  };
}
