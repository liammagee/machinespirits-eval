import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA_V3,
  buildTutorStubResistanceSemanticAdjudicationPromptV3,
  buildTutorStubResistanceSemanticZeroCallFixtureResponseV3,
  scoreTutorStubResistanceSemanticCorpusV3,
  validateTutorStubResistanceSemanticCorpusV3,
} from './tutorStubResistanceSemanticAdjudicationV3.js';
import { tutorStubResistanceSemanticSha256 } from './tutorStubResistanceSemanticAdjudication.js';
import { runPaidStudyEndpointPreflight } from './paidStudyEndpointPreflight.js';
import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_V3,
  loadTutorStubResistanceSemanticRegistration,
} from './tutorStubResistanceSemanticRuntime.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_REGISTRATION_V3 =
  'config/tutor-stub-resistance-semantic-adjudication-validation-registration.v3.json';
export const TUTOR_STUB_RESISTANCE_SEMANTIC_HELDOUT_CORPUS_V3 =
  'config/tutor-stub-resistance-semantic-adjudication-heldout-corpus.v3.json';
const V1_DEVELOPMENT = 'config/tutor-stub-resistance-semantic-adjudication-development-corpus.v1.json';
const V1_OBSERVED_HELDOUT = 'config/tutor-stub-resistance-semantic-adjudication-heldout-corpus.v1.json';
const V2_OBSERVED_HELDOUT = 'config/tutor-stub-resistance-semantic-adjudication-heldout-corpus.v2.json';
const OPAQUE_CASE_ID_KEY = 'c0d7b04e70394d7f1c5c0c6095cf67f7da47e89ebefbd809d8fa2b9261bd1ced';
const SHUFFLE_SEED = 'd8fe63f2fcc60b3d6c204093341679979f05166f38dd2de8fd7276c0a2e1187b';

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

function normalizedText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
}

function corpusTexts(corpus) {
  return {
    ids: (corpus?.cases || []).map((row) => normalizedText(row.case_id)),
    sources: (corpus?.cases || []).map((row) => normalizedText(row.source)),
    contexts: (corpus?.cases || []).flatMap((row) =>
      Array.isArray(row.public_context) ? row.public_context.map((message) => normalizedText(message.text)) : [],
    ),
  };
}

function schemaKeywordCount(value, keyword) {
  if (Array.isArray(value)) return value.reduce((sum, row) => sum + schemaKeywordCount(row, keyword), 0);
  if (!value || typeof value !== 'object') return 0;
  return (
    (Object.hasOwn(value, keyword) ? 1 : 0) +
    Object.values(value).reduce((sum, row) => sum + schemaKeywordCount(row, keyword), 0)
  );
}

// Dependency-free endpoint audit mirror. The bridge implementation is covered
// by its direct and composed transport tests; keeping this tiny reconstruction
// local lets the endpoint/certificate replay without loading provider runtime
// dependencies or making a model call.
function normalizedV3CodexProviderSchemaForAudit(value) {
  if (Array.isArray(value)) return value.map(normalizedV3CodexProviderSchemaForAudit);
  if (!value || typeof value !== 'object') return value;
  if (Object.hasOwn(value, 'oneOf')) {
    const keys = Object.keys(value);
    if (keys.length !== 1 || keys[0] !== 'oneOf' || !Array.isArray(value.oneOf) || value.oneOf.length !== 2) {
      throw new Error('semantic validation v3 provider-schema audit found an unsupported oneOf');
    }
    const nullBranches = value.oneOf.filter(
      (row) =>
        row && typeof row === 'object' && !Array.isArray(row) && Object.keys(row).length === 1 && row.type === 'null',
    );
    const objectBranches = value.oneOf.filter(
      (row) => row && typeof row === 'object' && !Array.isArray(row) && row.type === 'object',
    );
    if (nullBranches.length !== 1 || objectBranches.length !== 1) {
      throw new Error('semantic validation v3 provider-schema audit found an unsupported oneOf');
    }
    return { anyOf: value.oneOf.map(normalizedV3CodexProviderSchemaForAudit) };
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, row]) => [key, normalizedV3CodexProviderSchemaForAudit(row)]),
  );
}

export function auditTutorStubResistanceSemanticV3CodexProviderSchema() {
  const frozenBytes = JSON.stringify(TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA_V3);
  const normalized = normalizedV3CodexProviderSchemaForAudit(TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA_V3);
  const normalizedBytes = JSON.stringify(normalized);
  const audit = {
    status: 'passed_zero_call_nullable_object_union_wiring',
    provider: 'codex',
    rewrite: 'disjoint_nullable_object_oneOf_to_anyOf_only',
    frozen_schema_sha256: tutorStubResistanceSemanticSha256(frozenBytes),
    provider_schema_sha256: tutorStubResistanceSemanticSha256(normalizedBytes),
    frozen_one_of_count: schemaKeywordCount(TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA_V3, 'oneOf'),
    provider_one_of_count: schemaKeywordCount(normalized, 'oneOf'),
    provider_any_of_count: schemaKeywordCount(normalized, 'anyOf'),
    byte_length_preserved: Buffer.byteLength(frozenBytes) === Buffer.byteLength(normalizedBytes),
    model_visible_prompt_changed: false,
    claude_schema_changed: false,
    local_frozen_schema_changed: JSON.stringify(TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA_V3) !== frozenBytes,
  };
  if (
    audit.frozen_one_of_count !== 8 ||
    audit.provider_one_of_count !== 0 ||
    audit.provider_any_of_count !== 8 ||
    !audit.byte_length_preserved ||
    audit.local_frozen_schema_changed
  ) {
    throw new Error('semantic validation v3 Codex provider-schema compatibility audit failed');
  }
  return audit;
}

export function validateTutorStubResistanceSemanticValidationRegistrationV3({
  registration,
  instrument,
  corpus,
  corpusSha256,
  disclosedDevelopmentCorpora,
}) {
  const issues = [];
  const exactShapes = [
    [
      registration,
      [
        'schema',
        'version',
        'status',
        'studyId',
        'supersession',
        'instrument',
        'heldout',
        'executionBlinding',
        'executionReadiness',
        'executionPolicy',
        'authorization',
        'claimBoundary',
      ],
      'registration',
    ],
    [
      registration?.instrument,
      [
        'registrationPath',
        'registrationSha256',
        'instrumentFreezeCommit',
        'implementationPath',
        'implementationSha256',
        'responseSchemaPath',
        'responseSchemaSha256',
        'developmentEvidencePath',
        'developmentEvidenceSha256',
        'postHeldoutPromptModelThresholdOrConsensusTuning',
      ],
      'instrument',
    ],
    [
      registration?.heldout,
      [
        'corpusPath',
        'corpusSha256',
        'authorCommit',
        'instrumentFreezeParent',
        'cases',
        'frameRefuser',
        'productiveDispute',
        'neither',
        'actualParticipation',
        'hypotheticalOrConditionalOnly',
        'meritsProceduralOrAdministrativeNonjurisdiction',
        'concreteProductiveCounterframes',
        'interlocutorStandingOrRightPositive',
        'inquiryOrQuestionFrameGovernancePositive',
        'testOrCriterionGovernancePositive',
        'multiAxisJurisdiction',
        'otherJurisdictionalGovernance',
        'uniqueSources',
        'uniqueContextMessages',
        'v1V2DevelopmentOrObservedCaseCollision',
        'goldVisibleToModelPackets',
      ],
      'heldout',
    ],
    [
      registration?.executionReadiness,
      [
        'plannedCases',
        'judgesPerCase',
        'plannedModelCalls',
        'maximumReservationsPerPlannedCall',
        'hardValidationReservations',
        'programmeLedgerBefore',
        'programmeLedgerAfterMaximum',
        'programmeCeiling',
        'futureOutcomeValidationHardReservations',
        'futureConfirmationHardReservations',
        'futureStagedMaximumOnlyAfterBothValidationsPass',
        'ceilingAmendmentRequiredBeforeConfirmation',
      ],
      'executionReadiness',
    ],
  ];
  for (const [value, keys, label] of exactShapes) {
    if (!exactKeys(value, keys)) issues.push(`${label} keys are not exact`);
  }
  if (
    registration?.schema !== 'machinespirits.tutor-stub.resistance-semantic-adjudication-validation-registration.v3' ||
    registration?.version !== 3 ||
    registration?.status !== 'prospective_zero_call_readiness_hold' ||
    registration?.studyId !== 'tutor-stub-resistance-semantic-adjudication-heldout-validation-v3'
  ) {
    issues.push('v3 validation registration identity drifted');
  }
  const v1 = registration?.supersession || {};
  if (
    !exactKeys(v1, [
      'v1ValidationRegistrationPath',
      'v1ValidationRegistrationSha256',
      'v1InstrumentRegistrationSha256',
      'v1HeldoutCorpusSha256',
      'v1ConsumedRequestPath',
      'v1ConsumedRequestSha256',
      'v1FailedReportSha256',
      'v1FailedArchiveBranch',
      'v1FailedArchiveCommit',
      'v1ObservedAccounting',
      'v1FailureDisposition',
      'v2ValidationRegistrationPath',
      'v2ValidationRegistrationSha256',
      'v2InstrumentRegistrationSha256',
      'v2HeldoutCorpusSha256',
      'v2ConsumedRequestPath',
      'v2ConsumedRequestSha256',
      'v2FailedReportSha256',
      'v2FailedArchiveBranch',
      'v2FailedArchiveCommit',
      'v2ObservedAccounting',
      'v2FailureDisposition',
      'v1V2InstrumentHeldoutAndOutcomesEligibleForV3HeldoutOrConfirmation',
    ]) ||
    v1.v1ValidationRegistrationPath !==
      'config/tutor-stub-resistance-semantic-adjudication-validation-registration.v1.json' ||
    v1.v1ValidationRegistrationSha256 !== fileSha256(v1.v1ValidationRegistrationPath) ||
    v1.v1InstrumentRegistrationSha256 !==
      fileSha256('config/tutor-stub-resistance-semantic-adjudication-registration.v1.json') ||
    v1.v1HeldoutCorpusSha256 !==
      fileSha256('config/tutor-stub-resistance-semantic-adjudication-heldout-corpus.v1.json') ||
    v1.v1ConsumedRequestPath !==
      'config/tutor-stub-resistance-semantic-adjudication-validation-study-go-request.v1.json' ||
    v1.v1ConsumedRequestSha256 !== 'b6d9a41cc9fbdb2a3fc15f536e2a0b6e97a406986c9f88027e0765ab4bddb826' ||
    v1.v1FailedReportSha256 !== '008230526809a6aa2917b240c6a30af644f30184b89042825773b1b8040c5c74' ||
    v1.v1FailedArchiveBranch !== 'codex/resistance-semantic-validation-v1-failed-archive' ||
    v1.v1FailedArchiveCommit !== 'cf92081bd566948f4ea26d0ac5e67f8132ebeef8' ||
    JSON.stringify(v1.v1ObservedAccounting) !==
      JSON.stringify({
        cases: 80,
        chargedReservations: 160,
        returnedFirstAttempts: 160,
        retries: 0,
        recoveries: 0,
        invalidJudgments: 91,
        measurementIndeterminateCases: 78,
        programmeLedgerAfter: 491,
      }) ||
    v1.v1FailureDisposition !==
      'sealed_failed_validation_evidence_no_rescoring_normalization_reuse_or_reinterpretation' ||
    v1.v2ValidationRegistrationPath !==
      'config/tutor-stub-resistance-semantic-adjudication-validation-registration.v2.json' ||
    v1.v2ValidationRegistrationSha256 !== fileSha256(v1.v2ValidationRegistrationPath) ||
    v1.v2InstrumentRegistrationSha256 !==
      fileSha256('config/tutor-stub-resistance-semantic-adjudication-registration.v2.json') ||
    v1.v2HeldoutCorpusSha256 !== fileSha256(V2_OBSERVED_HELDOUT) ||
    v1.v2ConsumedRequestPath !==
      'config/tutor-stub-resistance-semantic-adjudication-validation-study-go-request.v2.json' ||
    v1.v2ConsumedRequestSha256 !== 'b91b6c92ec6b82b15b40821938929c3e2c31c86424822846a26443977cb479d6' ||
    v1.v2FailedReportSha256 !== '11e868d18135e6df29230eab6f7912427917c0e0b55ea350f6cec4a2168fca11' ||
    v1.v2FailedArchiveBranch !== 'codex/resistance-semantic-validation-v2-failed-archive' ||
    v1.v2FailedArchiveCommit !== 'a98b58732ae2f0b68180e3bbb8d0357cf2e4adfa' ||
    JSON.stringify(v1.v2ObservedAccounting) !==
      JSON.stringify({
        cases: 80,
        chargedReservations: 160,
        returnedFirstAttempts: 160,
        retries: 0,
        recoveries: 0,
        invalidJudgments: 52,
        measurementIndeterminateCases: 57,
        programmeLedgerAfter: 651,
      }) ||
    v1.v2FailureDisposition !==
      'sealed_failed_validation_evidence_no_rescoring_normalization_reuse_or_reinterpretation' ||
    v1.v1V2InstrumentHeldoutAndOutcomesEligibleForV3HeldoutOrConfirmation !== false
  ) {
    issues.push('sealed failed v1/v2 validation preservation drifted');
  }
  const artifact = registration?.instrument || {};
  if (
    artifact.registrationPath !== instrument?.path ||
    artifact.registrationPath !== TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_V3 ||
    artifact.registrationSha256 !== instrument?.sha256 ||
    artifact.instrumentFreezeCommit !== 'a0e0b56d371e8313eeb98d99f22a1a5f880a0d67' ||
    artifact.implementationPath !== 'services/tutorStubResistanceSemanticAdjudicationV3.js' ||
    artifact.implementationSha256 !== fileSha256(artifact.implementationPath) ||
    artifact.responseSchemaPath !== 'config/tutor-stub-resistance-semantic-adjudication-response.schema.v3.json' ||
    artifact.responseSchemaSha256 !== fileSha256(artifact.responseSchemaPath) ||
    artifact.developmentEvidencePath !==
      'config/tutor-stub-resistance-semantic-adjudication-development-evidence.v3.json' ||
    artifact.developmentEvidenceSha256 !== fileSha256(artifact.developmentEvidencePath) ||
    artifact.postHeldoutPromptModelThresholdOrConsensusTuning !== false
  ) {
    issues.push('frozen v3 instrument binding or no-post-heldout-tuning rule drifted');
  }
  const heldout = registration?.heldout || {};
  if (
    heldout.corpusPath !== TUTOR_STUB_RESISTANCE_SEMANTIC_HELDOUT_CORPUS_V3 ||
    heldout.corpusSha256 !== corpusSha256 ||
    heldout.authorCommit !== 'd76dd2691a496abacc39c3ba0034f74b6f5c7bde' ||
    heldout.instrumentFreezeParent !== 'a0e0b56d371e8313eeb98d99f22a1a5f880a0d67' ||
    heldout.cases !== 80 ||
    heldout.frameRefuser !== 40 ||
    heldout.productiveDispute !== 16 ||
    heldout.neither !== 24 ||
    heldout.actualParticipation !== 28 ||
    heldout.hypotheticalOrConditionalOnly !== 12 ||
    heldout.meritsProceduralOrAdministrativeNonjurisdiction !== 24 ||
    heldout.concreteProductiveCounterframes !== 16 ||
    heldout.interlocutorStandingOrRightPositive !== 28 ||
    heldout.inquiryOrQuestionFrameGovernancePositive !== 28 ||
    heldout.testOrCriterionGovernancePositive !== 28 ||
    heldout.multiAxisJurisdiction !== 16 ||
    heldout.otherJurisdictionalGovernance !== 4 ||
    heldout.uniqueSources !== 80 ||
    heldout.uniqueContextMessages !== 80 ||
    heldout.v1V2DevelopmentOrObservedCaseCollision !== false ||
    heldout.goldVisibleToModelPackets !== false ||
    corpus?.role !== 'heldout_blinded' ||
    corpus?.frozen !== true ||
    corpus?.prompt_examples_allowed !== false ||
    corpus?.context_provenance !== 'public_synthetic_authored'
  ) {
    issues.push('v3 heldout provenance, counts, freeze, or blinding binding drifted');
  }
  const heldoutTexts = corpusTexts(corpus);
  const development = disclosedDevelopmentCorpora.map(corpusTexts);
  const developmentIds = new Set(development.flatMap((row) => row.ids));
  const developmentSources = new Set(development.flatMap((row) => row.sources));
  const developmentContexts = new Set(development.flatMap((row) => row.contexts));
  if (
    heldoutTexts.ids.some((value) => developmentIds.has(value)) ||
    heldoutTexts.sources.some((value) => developmentSources.has(value)) ||
    heldoutTexts.contexts.some((value) => developmentContexts.has(value))
  ) {
    issues.push('v3 heldout case id, source, or context collides with disclosed v1/v2 development evidence');
  }
  if (
    new Set(heldoutTexts.ids).size !== 80 ||
    new Set(heldoutTexts.sources).size !== 80 ||
    new Set(heldoutTexts.contexts).size !== 80
  ) {
    issues.push('v3 heldout ids, source utterances, or context messages are not uniquely authored');
  }
  const counts = Object.fromEntries(
    ['frame_refuser', 'frame_defiant_or_productive_dispute', 'neither'].map((label) => [
      label,
      (corpus?.cases || []).filter((row) => row.expected?.label === label).length,
    ]),
  );
  if (counts.frame_refuser !== 40 || counts.frame_defiant_or_productive_dispute !== 16 || counts.neither !== 24) {
    issues.push('v3 heldout class counts drifted');
  }
  const blind = registration?.executionBlinding || {};
  if (
    !exactKeys(blind, [
      'opaqueCaseIdHmacKeyHex',
      'deterministicShuffleSeedHex',
      'originalCaseIdsVisibleToExecution',
      'goldMappingJoinedOnlyAfterAllResponsesSealed',
    ]) ||
    blind.opaqueCaseIdHmacKeyHex !== OPAQUE_CASE_ID_KEY ||
    blind.deterministicShuffleSeedHex !== SHUFFLE_SEED ||
    blind.originalCaseIdsVisibleToExecution !== false ||
    blind.goldMappingJoinedOnlyAfterAllResponsesSealed !== true
  ) {
    issues.push('v3 opaque execution identity, shuffle, or gold join binding drifted');
  }
  const budget = registration?.executionReadiness || {};
  if (
    budget.plannedCases !== 80 ||
    budget.judgesPerCase !== 2 ||
    budget.plannedModelCalls !== 160 ||
    budget.maximumReservationsPerPlannedCall !== 3 ||
    budget.hardValidationReservations !== 480 ||
    budget.programmeLedgerBefore !== 651 ||
    budget.programmeLedgerAfterMaximum !== 1131 ||
    budget.programmeCeiling !== 5000 ||
    budget.futureOutcomeValidationHardReservations !== 720 ||
    budget.futureConfirmationHardReservations !== 3456 ||
    budget.futureStagedMaximumOnlyAfterBothValidationsPass !== 5307 ||
    budget.ceilingAmendmentRequiredBeforeConfirmation !== true
  ) {
    issues.push('v3 validation or later staged attempt ledger drifted');
  }
  const policy = registration?.executionPolicy || {};
  if (
    !exactKeys(policy, [
      'caseCheckpointing',
      'preservedValidJudgeDisposition',
      'preparedNotDispatchedDisposition',
      'dispatchedWithoutResponseDisposition',
      'invalidOrTransportTerminalDisposition',
      'technicalRecovery',
      'completedOrPartialCaseRestart',
      'validCaseRerun',
      'replacement',
      'outcomeSelection',
      'goldVisibleToJudges',
      'developmentExamplesVisibleToJudges',
      'v1V2ValidationInputsOrOutputsReusable',
    ]) ||
    policy.caseCheckpointing !== 'after_each_judge_response' ||
    policy.preservedValidJudgeDisposition !==
      'call_only_the_never_prepared_peer_without_recalling_the_preserved_judge' ||
    policy.preparedNotDispatchedDisposition !== 'same_prepared_invocation_may_dispatch_once' ||
    policy.dispatchedWithoutResponseDisposition !== 'terminal_measurement_indeterminate_no_recall' ||
    policy.invalidOrTransportTerminalDisposition !== 'terminal_measurement_indeterminate_no_peer_call_required' ||
    policy.technicalRecovery !== 'predeclared_never_dispatched_missing_judge_only' ||
    policy.completedOrPartialCaseRestart !== false ||
    policy.validCaseRerun !== false ||
    policy.replacement !== false ||
    policy.outcomeSelection !== false ||
    policy.goldVisibleToJudges !== false ||
    policy.developmentExamplesVisibleToJudges !== false ||
    policy.v1V2ValidationInputsOrOutputsReusable !== false
  ) {
    issues.push('v3 validation checkpoint, no-recall, no-selection, or historical exclusion boundary drifted');
  }
  const authorization = registration?.authorization || {};
  if (
    !exactKeys(authorization, [
      'goRequestPrepared',
      'modelCallsAuthorized',
      'liveRunAuthorized',
      'standingArchitecturalCorrectionSha256',
      'priorStandingAuthoritySha256',
      'laterProgrammeCeilingAmendmentAuthorized',
      'confirmationAuthorized',
    ]) ||
    authorization.goRequestPrepared !== false ||
    authorization.modelCallsAuthorized !== false ||
    authorization.liveRunAuthorized !== false ||
    authorization.standingArchitecturalCorrectionSha256 !==
      'dae9091d4f2584d416d7765e66d47acba03a33264886a6fa0a1eba45857c05f4' ||
    authorization.priorStandingAuthoritySha256 !== '538aa73239072ea618e2c8308edf562f1dd7495b78574e35a3db2f549302c1ce' ||
    authorization.laterProgrammeCeilingAmendmentAuthorized !== false ||
    authorization.confirmationAuthorized !== false
  ) {
    issues.push('v3 validation authorization HOLD or later-stage boundary drifted');
  }
  const claims = registration?.claimBoundary || {};
  if (
    !exactKeys(claims, [
      'validationOnly',
      'syntheticZeroCallPreflightEstablishesAccuracy',
      'v1V2FailedValidationRescoredOrReinterpreted',
      'heldoutPassRequiredBeforeConfirmationRequest',
      'validationOutcomesExcludedFromConfirmation',
      'historicalPartialOutcomesExcluded',
      'noWarmPlainEfficacyNullLearningTransferHumanOrCellClaim',
    ]) ||
    claims.validationOnly !== true ||
    claims.syntheticZeroCallPreflightEstablishesAccuracy !== false ||
    claims.v1V2FailedValidationRescoredOrReinterpreted !== false ||
    claims.heldoutPassRequiredBeforeConfirmationRequest !== true ||
    claims.validationOutcomesExcludedFromConfirmation !== true ||
    claims.historicalPartialOutcomesExcluded !== true ||
    claims.noWarmPlainEfficacyNullLearningTransferHumanOrCellClaim !== true
  ) {
    issues.push('v3 validation-only claim boundary drifted');
  }
  return { valid: issues.length === 0, issues, counts };
}

export function tutorStubResistanceSemanticOpaqueCaseIdV3(corpusCase) {
  const commitment = crypto
    .createHmac('sha256', Buffer.from(OPAQUE_CASE_ID_KEY, 'hex'))
    .update(`${corpusCase.case_id}\0${tutorStubResistanceSemanticSha256(corpusCase.source)}`)
    .digest('hex');
  return `sv3-${commitment.slice(0, 32)}`;
}

function shuffledHeldoutCases(cases) {
  return cases
    .map((corpusCase) => ({
      corpusCase,
      executionCaseId: tutorStubResistanceSemanticOpaqueCaseIdV3(corpusCase),
      orderKey: tutorStubResistanceSemanticSha256(
        `${SHUFFLE_SEED}\0${tutorStubResistanceSemanticOpaqueCaseIdV3(corpusCase)}`,
      ),
    }))
    .sort((left, right) => left.orderKey.localeCompare(right.orderKey));
}

export function buildTutorStubResistanceSemanticBlindedValidationCasesV3(cases) {
  return shuffledHeldoutCases(cases).map(({ corpusCase, executionCaseId }) => ({
    case_id: executionCaseId,
    source: corpusCase.source,
    public_context: corpusCase.public_context,
  }));
}

export function tutorStubResistanceSemanticCorpusCaseForExecutionIdV3(cases, executionCaseId) {
  return cases.find((row) => tutorStubResistanceSemanticOpaqueCaseIdV3(row) === executionCaseId) || null;
}

export function loadTutorStubResistanceSemanticValidationV3() {
  const registration = readJson(TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_REGISTRATION_V3);
  const instrument = loadTutorStubResistanceSemanticRegistration(registration.instrument.registrationPath);
  const corpus = readJson(registration.heldout.corpusPath);
  const corpusValidation = validateTutorStubResistanceSemanticCorpusV3(corpus);
  const disclosedDevelopmentCorpora = [
    readJson(V1_DEVELOPMENT),
    readJson(V1_OBSERVED_HELDOUT),
    readJson(V2_OBSERVED_HELDOUT),
  ];
  const validation = validateTutorStubResistanceSemanticValidationRegistrationV3({
    registration,
    instrument,
    corpus,
    corpusSha256: fileSha256(registration.heldout.corpusPath),
    disclosedDevelopmentCorpora,
  });
  const issues = [...corpusValidation.issues, ...validation.issues];
  if (issues.length) throw new Error(`semantic validation v3 registration invalid: ${issues.join('; ')}`);
  return {
    registration,
    registrationPath: TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_REGISTRATION_V3,
    registrationSha256: fileSha256(TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_REGISTRATION_V3),
    instrument,
    corpus,
    corpusSha256: fileSha256(registration.heldout.corpusPath),
    counts: validation.counts,
    buildBlindedCases: buildTutorStubResistanceSemanticBlindedValidationCasesV3,
    corpusCaseForExecutionId: tutorStubResistanceSemanticCorpusCaseForExecutionIdV3,
  };
}

export function buildTutorStubResistanceSemanticValidationPacketsV3(cases) {
  const loaded = loadTutorStubResistanceSemanticValidationV3();
  return cases.map((blindedCase) => ({
    schema: 'machinespirits.tutor-stub.resistance-semantic-validation-packet.v3',
    packet_id: blindedCase.case_id,
    case_ids: [blindedCase.case_id],
    prompts: Object.fromEntries(
      loaded.instrument.registration.measurement.judges.map((judge) => [
        judge.id,
        buildTutorStubResistanceSemanticAdjudicationPromptV3({
          caseId: blindedCase.case_id,
          source: blindedCase.source,
          publicContext: blindedCase.public_context,
          judge,
        }),
      ]),
    ),
  }));
}

export function assembleTutorStubResistanceSemanticValidationPreflightV3({ cases }) {
  const loaded = loadTutorStubResistanceSemanticValidationV3();
  const blindedCorpus = {
    ...loaded.corpus,
    cases: cases.map((blindedCase) => {
      const corpusCase = tutorStubResistanceSemanticCorpusCaseForExecutionIdV3(
        loaded.corpus.cases,
        blindedCase.case_id,
      );
      if (!corpusCase) throw new Error(`unknown opaque heldout v3 case ${blindedCase.case_id}`);
      return { ...corpusCase, case_id: blindedCase.case_id };
    }),
  };
  const responsePairs = Object.fromEntries(
    blindedCorpus.cases.map((corpusCase) => [
      corpusCase.case_id,
      Object.fromEntries(
        loaded.instrument.registration.measurement.judges.map((judge) => [
          judge.id,
          buildTutorStubResistanceSemanticZeroCallFixtureResponseV3({ corpusCase, judge }),
        ]),
      ),
    ]),
  );
  const score = scoreTutorStubResistanceSemanticCorpusV3({
    corpus: blindedCorpus,
    responsePairs,
    registration: loaded.instrument.registration,
  });
  const providerSchemaAudit = auditTutorStubResistanceSemanticV3CodexProviderSchema();
  return {
    schema: 'machinespirits.tutor-stub.resistance-semantic-validation-preflight-assembly.v3',
    case_ids: cases.map((row) => row.case_id),
    endpoint_status: {
      synthetic_fixture_metric_pipeline_wiring: score.status === 'passed' ? 'complete' : 'failed',
      synthetic_quote_normalization_provenance_wiring:
        score.metrics.schema_span_provenance_validity === 1 ? 'complete' : 'failed',
      synthetic_interjudge_metric_wiring:
        score.metrics.raw_interjudge_label_agreement >= 0.9 && score.metrics.raw_interjudge_full_vector_agreement >= 0.9
          ? 'complete'
          : 'failed',
      synthetic_coverage_metric_wiring: score.metrics.determined_coverage_overall >= 0.95 ? 'complete' : 'failed',
      synthetic_codex_provider_schema_compatibility_wiring:
        providerSchemaAudit.status === 'passed_zero_call_nullable_object_union_wiring' ? 'complete' : 'failed',
    },
    codex_provider_schema_compatibility: providerSchemaAudit,
    synthetic_fixture_score: score,
  };
}

export function runTutorStubResistanceSemanticValidationPreflightV3({ contract }) {
  const loaded = loadTutorStubResistanceSemanticValidationV3();
  if (
    contract?.registration?.registration_path !== loaded.registrationPath ||
    contract?.registration?.registration_sha256 !== loaded.registrationSha256 ||
    contract?.registration?.instrument_registration_path !== loaded.instrument.path ||
    contract?.registration?.instrument_registration_sha256 !== loaded.instrument.sha256 ||
    contract?.registration?.heldout_corpus_path !== loaded.registration.heldout.corpusPath ||
    contract?.registration?.heldout_corpus_sha256 !== loaded.corpusSha256
  ) {
    throw new Error('semantic validation v3 endpoint registration, instrument, or heldout binding drifted');
  }
  const providerSchemaAudit = auditTutorStubResistanceSemanticV3CodexProviderSchema();
  const contractAdapter = contract?.runner?.codex_structured_output_schema_adapter;
  if (
    contractAdapter?.implementation !== 'services/cliProviderBridge.js#normalizeCodexProviderOutputSchema' ||
    contractAdapter?.rewrite !== providerSchemaAudit.rewrite ||
    contractAdapter?.frozen_schema_sha256 !== providerSchemaAudit.frozen_schema_sha256 ||
    contractAdapter?.provider_schema_sha256 !== providerSchemaAudit.provider_schema_sha256 ||
    contractAdapter?.claude_schema_changed !== false ||
    contractAdapter?.local_validation_uses_frozen_schema !== true
  ) {
    throw new Error('semantic validation v3 Codex provider-schema endpoint binding drifted');
  }
  const blindedCases = buildTutorStubResistanceSemanticBlindedValidationCasesV3(loaded.corpus.cases);
  const preflight = runPaidStudyEndpointPreflight({
    contract,
    cases: blindedCases,
    buildPackets: buildTutorStubResistanceSemanticValidationPacketsV3,
    assemble: assembleTutorStubResistanceSemanticValidationPreflightV3,
  });
  return {
    ...preflight,
    semantic_validation_readiness_audit: {
      status: 'passed_zero_call_wiring_only_not_accuracy_evidence',
      frozen_instrument_registration_sha256: loaded.instrument.sha256,
      frozen_heldout_corpus_sha256: loaded.corpusSha256,
      cases: loaded.corpus.cases.length,
      positive_cases: loaded.counts.frame_refuser,
      productive_dispute_cases: loaded.counts.frame_defiant_or_productive_dispute,
      other_negative_cases: loaded.counts.neither,
      planned_model_calls: 160,
      hard_validation_reservations: 480,
      programme_ledger_before: 651,
      programme_ledger_after_maximum: 1131,
      outcome_validation_hard_reservations: 720,
      confirmation_hard_reservations: 3456,
      staged_maximum_only_after_both_validations_pass: 5307,
      ceiling_amendment_required_before_confirmation: true,
      live_heldout_accuracy_agreement_and_coverage_gates: 'pending_live_validation',
      codex_provider_schema_compatibility: providerSchemaAudit,
      model_calls: 0,
      production_writes: 0,
    },
  };
}

export default {
  assembleTutorStubResistanceSemanticValidationPreflightV3,
  buildTutorStubResistanceSemanticBlindedValidationCasesV3,
  buildTutorStubResistanceSemanticValidationPacketsV3,
  loadTutorStubResistanceSemanticValidationV3,
  runTutorStubResistanceSemanticValidationPreflightV3,
};
