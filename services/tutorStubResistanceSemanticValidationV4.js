import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { tutorStubResistanceSemanticSha256 } from './tutorStubResistanceSemanticAdjudication.js';
import { validateTutorStubResistanceSemanticRegistrationV4 } from './tutorStubResistanceSemanticAdjudicationV4.js';
import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_HELDOUT_CORPUS_V4,
  validateTutorStubResistanceSemanticHeldoutCorpusV4,
} from './tutorStubResistanceSemanticHeldoutCorpusV4.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_REGISTRATION_V4 =
  'config/tutor-stub-resistance-semantic-adjudication-validation-registration.v4.json';
export const TUTOR_STUB_RESISTANCE_SEMANTIC_INSTRUMENT_REGISTRATION_V4 =
  'config/tutor-stub-resistance-semantic-adjudication-registration.v4.json';
const OPAQUE_CASE_ID_KEY = '1726410d8e86a68cad616624a2da37beba1bdfb11192f6a15ade5a7af380d390';
const SHUFFLE_SEED = 'fdda323721ba80fb36af5b4f0746f6de1d0b1cfd8fa51428be55b601d92ac8ad';

function readJson(repoPath) {
  return JSON.parse(fs.readFileSync(path.resolve(ROOT, repoPath), 'utf8'));
}

function fileSha256(repoPath) {
  return tutorStubResistanceSemanticSha256(fs.readFileSync(path.resolve(ROOT, repoPath)));
}

function exactKeys(value, expected) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort())
  );
}

export function validateTutorStubResistanceSemanticValidationRegistrationV4({
  registration,
  instrument,
  corpus,
  corpusSha256,
}) {
  const issues = [];
  if (
    !exactKeys(registration, [
      'schema',
      'version',
      'status',
      'studyId',
      'instrument',
      'heldout',
      'executionBlinding',
      'executionReadiness',
      'executionPolicy',
      'authorization',
      'claimBoundary',
    ]) ||
    registration?.schema !== 'machinespirits.tutor-stub.resistance-semantic-adjudication-validation-registration.v4' ||
    registration?.version !== 4 ||
    registration?.status !== 'prospective_zero_call_readiness_hold' ||
    registration?.studyId !== 'tutor-stub-resistance-semantic-adjudication-heldout-validation-v4'
  ) {
    issues.push('v4 validation registration identity or keys drifted');
  }
  const artifact = registration?.instrument || {};
  if (
    artifact.registrationPath !== TUTOR_STUB_RESISTANCE_SEMANTIC_INSTRUMENT_REGISTRATION_V4 ||
    artifact.registrationPath !== instrument?.path ||
    artifact.registrationSha256 !== instrument?.sha256 ||
    artifact.instrumentFreezeCommit !== 'bc4edae085da2f2c9f328a584eb5b8c42b87efa5' ||
    artifact.ensembleImplementationSha256 !== fileSha256(artifact.ensembleImplementationPath) ||
    artifact.seatImplementationSha256 !== fileSha256(artifact.seatImplementationPath) ||
    artifact.responseSchemaSha256 !== fileSha256(artifact.responseSchemaPath) ||
    artifact.scoringImplementationSha256 !== fileSha256(artifact.scoringImplementationPath) ||
    artifact.postHeldoutPromptModelOntologyConsensusOrGateTuning !== false
  ) {
    issues.push('v4 frozen instrument, schema, or scorer binding drifted');
  }
  const heldout = registration?.heldout || {};
  if (
    heldout.corpusPath !== 'services/tutorStubResistanceSemanticHeldoutCorpusV4.js' ||
    heldout.corpusSha256 !== corpusSha256 ||
    heldout.authorCommit !== '0d401d58fb2065edc16d6cab4ba3887b05f5e7f7' ||
    heldout.instrumentFreezeParent !== 'bc4edae085da2f2c9f328a584eb5b8c42b87efa5' ||
    heldout.cases !== 80 ||
    heldout.frameRefuser !== 40 ||
    heldout.productiveDispute !== 16 ||
    heldout.neither !== 24 ||
    heldout.actualParticipation !== 24 ||
    heldout.hypotheticalOrConditionalOnly !== 12 ||
    heldout.concreteProductiveCounterframes !== 16 ||
    heldout.uniqueSources !== 80 ||
    heldout.uniqueContextMessages !== 80 ||
    heldout.v1V2V3Collision !== false ||
    heldout.goldVisibleToModelPackets !== false
  ) {
    issues.push('v4 heldout freeze, provenance, counts, or blinding drifted');
  }
  const blind = registration?.executionBlinding || {};
  if (
    blind.opaqueCaseIdHmacKeyHex !== OPAQUE_CASE_ID_KEY ||
    blind.deterministicShuffleSeedHex !== SHUFFLE_SEED ||
    blind.originalCaseIdsVisibleToExecution !== false ||
    blind.goldMappingJoinedOnlyAfterAllResponsesSealed !== true
  ) {
    issues.push('v4 opaque case identity or post-seal gold join drifted');
  }
  const readiness = registration?.executionReadiness || {};
  if (
    readiness.plannedCases !== 80 ||
    readiness.judgesPerCase !== 3 ||
    readiness.plannedModelCalls !== 240 ||
    readiness.maximumReservationsPerPlannedCall !== 3 ||
    readiness.hardValidationReservations !== 720 ||
    readiness.programmeLedgerBefore !== 894 ||
    readiness.programmeLedgerAfterMaximum !== 1614 ||
    readiness.programmeCeiling !== 5000 ||
    readiness.futureOutcomeValidationHardReservations !== 720 ||
    readiness.futureConfirmationHardReservations !== 3456 ||
    readiness.futureStagedMaximumOnlyAfterBothValidationsPass !== 5790 ||
    readiness.ceilingAmendmentRequiredBeforeConfirmation !== true
  ) {
    issues.push('v4 operational safeguard ledger drifted');
  }
  const policy = registration?.executionPolicy || {};
  if (
    policy.caseCheckpointing !== 'after_each_judge_response' ||
    policy.dispatchedWithoutResponseDisposition !== 'seat_abstains_no_recall' ||
    policy.invalidLowConfidenceIndeterminateOrTransportDisposition !== 'seat_abstains_no_repair_rerun_or_replacement' ||
    policy.completedOrPartialCaseRestart !== false ||
    policy.validJudgeRerun !== false ||
    policy.replacement !== false ||
    policy.outcomeSelection !== false ||
    policy.goldVisibleToJudges !== false ||
    policy.developmentExamplesVisibleToJudges !== false ||
    policy.v1V2V3InputsOrOutputsReusable !== false
  ) {
    issues.push('v4 no-recall, abstention, no-selection, or exclusion policy drifted');
  }
  if (
    registration?.authorization?.goRequestPrepared !== false ||
    registration?.authorization?.modelCallsAuthorizedByArtifact !== false ||
    registration?.authorization?.liveRunAuthorizedByArtifact !== false ||
    registration?.authorization?.confirmationAuthorized !== false
  ) {
    issues.push('v4 validation registration must remain a HOLD artifact');
  }
  const claims = registration?.claimBoundary || {};
  if (
    claims.validationOnly !== true ||
    claims.syntheticZeroCallPreflightEstablishesAccuracy !== false ||
    claims.v1V2V3FailedOrIncompleteEvidenceRescoredReusedOrReinterpreted !== false ||
    claims.heldoutPassRequiredBeforeConfirmationRequest !== true ||
    claims.validationOutcomesExcludedFromConfirmation !== true ||
    claims.historicalPartialOutcomesExcluded !== true ||
    claims.noWarmPlainEfficacyNullLearningTransferHumanOrCellClaim !== true ||
    claims.noInterimAnalysis !== true
  ) {
    issues.push('v4 validation-only claim boundary drifted');
  }
  if (corpus !== TUTOR_STUB_RESISTANCE_SEMANTIC_HELDOUT_CORPUS_V4) {
    issues.push('v4 loader corpus identity drifted');
  }
  return { valid: issues.length === 0, issues };
}

export function tutorStubResistanceSemanticOpaqueCaseIdV4(corpusCase) {
  const commitment = crypto
    .createHmac('sha256', Buffer.from(OPAQUE_CASE_ID_KEY, 'hex'))
    .update(`${corpusCase.case_id}\0${tutorStubResistanceSemanticSha256(corpusCase.source)}`)
    .digest('hex');
  return `sv4-${commitment.slice(0, 32)}`;
}

function shuffledHeldoutCases(cases) {
  return cases
    .map((corpusCase) => ({
      corpusCase,
      executionCaseId: tutorStubResistanceSemanticOpaqueCaseIdV4(corpusCase),
      orderKey: tutorStubResistanceSemanticSha256(
        `${SHUFFLE_SEED}\0${tutorStubResistanceSemanticOpaqueCaseIdV4(corpusCase)}`,
      ),
    }))
    .sort((left, right) => left.orderKey.localeCompare(right.orderKey));
}

export function buildTutorStubResistanceSemanticBlindedValidationCasesV4(cases) {
  return shuffledHeldoutCases(cases).map(({ corpusCase, executionCaseId }) => ({
    case_id: executionCaseId,
    source: corpusCase.source,
    public_context: corpusCase.public_context,
  }));
}

export function tutorStubResistanceSemanticCorpusCaseForExecutionIdV4(cases, executionCaseId) {
  return cases.find((row) => tutorStubResistanceSemanticOpaqueCaseIdV4(row) === executionCaseId) || null;
}

export function loadTutorStubResistanceSemanticValidationV4() {
  const registration = readJson(TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_REGISTRATION_V4);
  const instrumentRegistration = readJson(TUTOR_STUB_RESISTANCE_SEMANTIC_INSTRUMENT_REGISTRATION_V4);
  const instrument = {
    path: TUTOR_STUB_RESISTANCE_SEMANTIC_INSTRUMENT_REGISTRATION_V4,
    sha256: fileSha256(TUTOR_STUB_RESISTANCE_SEMANTIC_INSTRUMENT_REGISTRATION_V4),
    registration: instrumentRegistration,
  };
  const priorCorpora = ['v1', 'v2', 'v3'].map((version) =>
    readJson(`config/tutor-stub-resistance-semantic-adjudication-heldout-corpus.${version}.json`),
  );
  const corpusValidation = validateTutorStubResistanceSemanticHeldoutCorpusV4(
    TUTOR_STUB_RESISTANCE_SEMANTIC_HELDOUT_CORPUS_V4,
    priorCorpora,
  );
  const instrumentValidation = validateTutorStubResistanceSemanticRegistrationV4(instrumentRegistration);
  const validation = validateTutorStubResistanceSemanticValidationRegistrationV4({
    registration,
    instrument,
    corpus: TUTOR_STUB_RESISTANCE_SEMANTIC_HELDOUT_CORPUS_V4,
    corpusSha256: fileSha256(registration.heldout.corpusPath),
  });
  const issues = [...corpusValidation.issues, ...instrumentValidation.issues, ...validation.issues];
  if (issues.length) throw new Error(`semantic validation v4 registration invalid: ${issues.join('; ')}`);
  return {
    registration,
    registrationPath: TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_REGISTRATION_V4,
    registrationSha256: fileSha256(TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_REGISTRATION_V4),
    instrument,
    corpus: TUTOR_STUB_RESISTANCE_SEMANTIC_HELDOUT_CORPUS_V4,
    corpusSha256: fileSha256(registration.heldout.corpusPath),
    buildBlindedCases: buildTutorStubResistanceSemanticBlindedValidationCasesV4,
    corpusCaseForExecutionId: tutorStubResistanceSemanticCorpusCaseForExecutionIdV4,
  };
}

export default {
  buildTutorStubResistanceSemanticBlindedValidationCasesV4,
  loadTutorStubResistanceSemanticValidationV4,
};
