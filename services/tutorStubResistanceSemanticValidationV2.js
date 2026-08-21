import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildTutorStubResistanceSemanticAdjudicationPromptV2,
  buildTutorStubResistanceSemanticZeroCallFixtureResponseV2,
  scoreTutorStubResistanceSemanticCorpusV2,
  validateTutorStubResistanceSemanticCorpusV2,
} from './tutorStubResistanceSemanticAdjudicationV2.js';
import { tutorStubResistanceSemanticSha256 } from './tutorStubResistanceSemanticAdjudication.js';
import { runPaidStudyEndpointPreflight } from './paidStudyEndpointPreflight.js';
import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_V2,
  loadTutorStubResistanceSemanticRegistration,
} from './tutorStubResistanceSemanticRuntime.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_REGISTRATION_V2 =
  'config/tutor-stub-resistance-semantic-adjudication-validation-registration.v2.json';
export const TUTOR_STUB_RESISTANCE_SEMANTIC_HELDOUT_CORPUS_V2 =
  'config/tutor-stub-resistance-semantic-adjudication-heldout-corpus.v2.json';
const V1_DEVELOPMENT = 'config/tutor-stub-resistance-semantic-adjudication-development-corpus.v1.json';
const V1_OBSERVED_HELDOUT = 'config/tutor-stub-resistance-semantic-adjudication-heldout-corpus.v1.json';
const OPAQUE_CASE_ID_KEY = '63e13119eb3254f35979a4044279fcc1eecad5a9a5a17b0738c6f831def47e09';
const SHUFFLE_SEED = '797ce8677a7afba10637d593ad667b92a357ef48d7ea53c09cad1830574079cd';

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

export function validateTutorStubResistanceSemanticValidationRegistrationV2({
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
        'uniqueSources',
        'uniqueContextMessages',
        'v1DevelopmentOrObservedCaseCollision',
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
    registration?.schema !== 'machinespirits.tutor-stub.resistance-semantic-adjudication-validation-registration.v2' ||
    registration?.version !== 2 ||
    registration?.status !== 'prospective_zero_call_readiness_hold' ||
    registration?.studyId !== 'tutor-stub-resistance-semantic-adjudication-heldout-validation-v2'
  ) {
    issues.push('v2 validation registration identity drifted');
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
      'v1InstrumentHeldoutAndOutcomesEligibleForV2HeldoutOrConfirmation',
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
    v1.v1InstrumentHeldoutAndOutcomesEligibleForV2HeldoutOrConfirmation !== false
  ) {
    issues.push('sealed failed v1 validation preservation drifted');
  }
  const artifact = registration?.instrument || {};
  if (
    artifact.registrationPath !== instrument?.path ||
    artifact.registrationPath !== TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_V2 ||
    artifact.registrationSha256 !== instrument?.sha256 ||
    artifact.instrumentFreezeCommit !== '30d184211e09371c6aff86abcbed4623b8e457f0' ||
    artifact.implementationPath !== 'services/tutorStubResistanceSemanticAdjudicationV2.js' ||
    artifact.implementationSha256 !== fileSha256(artifact.implementationPath) ||
    artifact.responseSchemaPath !== 'config/tutor-stub-resistance-semantic-adjudication-response.schema.v2.json' ||
    artifact.responseSchemaSha256 !== fileSha256(artifact.responseSchemaPath) ||
    artifact.developmentEvidencePath !==
      'config/tutor-stub-resistance-semantic-adjudication-development-evidence.v2.json' ||
    artifact.developmentEvidenceSha256 !== fileSha256(artifact.developmentEvidencePath) ||
    artifact.postHeldoutPromptModelThresholdOrConsensusTuning !== false
  ) {
    issues.push('frozen v2 instrument binding or no-post-heldout-tuning rule drifted');
  }
  const heldout = registration?.heldout || {};
  if (
    heldout.corpusPath !== TUTOR_STUB_RESISTANCE_SEMANTIC_HELDOUT_CORPUS_V2 ||
    heldout.corpusSha256 !== corpusSha256 ||
    heldout.authorCommit !== 'efc1dae8dbfa745c8d3d9b2fab9414ec3abe72f8' ||
    heldout.instrumentFreezeParent !== '30d184211e09371c6aff86abcbed4623b8e457f0' ||
    heldout.cases !== 80 ||
    heldout.frameRefuser !== 40 ||
    heldout.productiveDispute !== 16 ||
    heldout.neither !== 24 ||
    heldout.actualParticipation !== 28 ||
    heldout.hypotheticalOrConditionalOnly !== 12 ||
    heldout.meritsProceduralOrAdministrativeNonjurisdiction !== 16 ||
    heldout.concreteProductiveCounterframes !== 16 ||
    heldout.uniqueSources !== 80 ||
    heldout.uniqueContextMessages !== 80 ||
    heldout.v1DevelopmentOrObservedCaseCollision !== false ||
    heldout.goldVisibleToModelPackets !== false ||
    corpus?.role !== 'heldout_blinded' ||
    corpus?.frozen !== true ||
    corpus?.prompt_examples_allowed !== false ||
    corpus?.context_provenance !== 'independently_authored_bounded_public_context_blinded_after_instrument_freeze'
  ) {
    issues.push('v2 heldout provenance, counts, freeze, or blinding binding drifted');
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
    issues.push('v2 heldout case id, source, or context collides with disclosed v1 development evidence');
  }
  if (
    new Set(heldoutTexts.ids).size !== 80 ||
    new Set(heldoutTexts.sources).size !== 80 ||
    new Set(heldoutTexts.contexts).size !== 80
  ) {
    issues.push('v2 heldout ids, source utterances, or context messages are not uniquely authored');
  }
  const counts = Object.fromEntries(
    ['frame_refuser', 'frame_defiant_or_productive_dispute', 'neither'].map((label) => [
      label,
      (corpus?.cases || []).filter((row) => row.expected?.label === label).length,
    ]),
  );
  if (counts.frame_refuser !== 40 || counts.frame_defiant_or_productive_dispute !== 16 || counts.neither !== 24) {
    issues.push('v2 heldout class counts drifted');
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
    issues.push('v2 opaque execution identity, shuffle, or gold join binding drifted');
  }
  const budget = registration?.executionReadiness || {};
  if (
    budget.plannedCases !== 80 ||
    budget.judgesPerCase !== 2 ||
    budget.plannedModelCalls !== 160 ||
    budget.maximumReservationsPerPlannedCall !== 3 ||
    budget.hardValidationReservations !== 480 ||
    budget.programmeLedgerBefore !== 491 ||
    budget.programmeLedgerAfterMaximum !== 971 ||
    budget.programmeCeiling !== 5000 ||
    budget.futureOutcomeValidationHardReservations !== 720 ||
    budget.futureConfirmationHardReservations !== 3456 ||
    budget.futureStagedMaximumOnlyAfterBothValidationsPass !== 5147 ||
    budget.ceilingAmendmentRequiredBeforeConfirmation !== true
  ) {
    issues.push('v2 validation or later staged attempt ledger drifted');
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
      'v1ValidationInputsOrOutputsReusable',
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
    policy.v1ValidationInputsOrOutputsReusable !== false
  ) {
    issues.push('v2 validation checkpoint, no-recall, no-selection, or historical exclusion boundary drifted');
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
    issues.push('v2 validation authorization HOLD or later-stage boundary drifted');
  }
  const claims = registration?.claimBoundary || {};
  if (
    !exactKeys(claims, [
      'validationOnly',
      'syntheticZeroCallPreflightEstablishesAccuracy',
      'v1FailedValidationRescoredOrReinterpreted',
      'heldoutPassRequiredBeforeConfirmationRequest',
      'validationOutcomesExcludedFromConfirmation',
      'historicalPartialOutcomesExcluded',
      'noWarmPlainEfficacyNullLearningTransferHumanOrCellClaim',
    ]) ||
    claims.validationOnly !== true ||
    claims.syntheticZeroCallPreflightEstablishesAccuracy !== false ||
    claims.v1FailedValidationRescoredOrReinterpreted !== false ||
    claims.heldoutPassRequiredBeforeConfirmationRequest !== true ||
    claims.validationOutcomesExcludedFromConfirmation !== true ||
    claims.historicalPartialOutcomesExcluded !== true ||
    claims.noWarmPlainEfficacyNullLearningTransferHumanOrCellClaim !== true
  ) {
    issues.push('v2 validation-only claim boundary drifted');
  }
  return { valid: issues.length === 0, issues, counts };
}

export function tutorStubResistanceSemanticOpaqueCaseIdV2(corpusCase) {
  const commitment = crypto
    .createHmac('sha256', Buffer.from(OPAQUE_CASE_ID_KEY, 'hex'))
    .update(`${corpusCase.case_id}\0${tutorStubResistanceSemanticSha256(corpusCase.source)}`)
    .digest('hex');
  return `sv2-${commitment.slice(0, 32)}`;
}

function shuffledHeldoutCases(cases) {
  return cases
    .map((corpusCase) => ({
      corpusCase,
      executionCaseId: tutorStubResistanceSemanticOpaqueCaseIdV2(corpusCase),
      orderKey: tutorStubResistanceSemanticSha256(
        `${SHUFFLE_SEED}\0${tutorStubResistanceSemanticOpaqueCaseIdV2(corpusCase)}`,
      ),
    }))
    .sort((left, right) => left.orderKey.localeCompare(right.orderKey));
}

export function buildTutorStubResistanceSemanticBlindedValidationCasesV2(cases) {
  return shuffledHeldoutCases(cases).map(({ corpusCase, executionCaseId }) => ({
    case_id: executionCaseId,
    source: corpusCase.source,
    public_context: corpusCase.public_context,
  }));
}

export function tutorStubResistanceSemanticCorpusCaseForExecutionIdV2(cases, executionCaseId) {
  return cases.find((row) => tutorStubResistanceSemanticOpaqueCaseIdV2(row) === executionCaseId) || null;
}

export function loadTutorStubResistanceSemanticValidationV2() {
  const registration = readJson(TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_REGISTRATION_V2);
  const instrument = loadTutorStubResistanceSemanticRegistration(registration.instrument.registrationPath);
  const corpus = readJson(registration.heldout.corpusPath);
  const corpusValidation = validateTutorStubResistanceSemanticCorpusV2(corpus);
  const disclosedDevelopmentCorpora = [readJson(V1_DEVELOPMENT), readJson(V1_OBSERVED_HELDOUT)];
  const validation = validateTutorStubResistanceSemanticValidationRegistrationV2({
    registration,
    instrument,
    corpus,
    corpusSha256: fileSha256(registration.heldout.corpusPath),
    disclosedDevelopmentCorpora,
  });
  const issues = [...corpusValidation.issues, ...validation.issues];
  if (issues.length) throw new Error(`semantic validation v2 registration invalid: ${issues.join('; ')}`);
  return {
    registration,
    registrationPath: TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_REGISTRATION_V2,
    registrationSha256: fileSha256(TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_REGISTRATION_V2),
    instrument,
    corpus,
    corpusSha256: fileSha256(registration.heldout.corpusPath),
    counts: validation.counts,
    buildBlindedCases: buildTutorStubResistanceSemanticBlindedValidationCasesV2,
    corpusCaseForExecutionId: tutorStubResistanceSemanticCorpusCaseForExecutionIdV2,
  };
}

export function buildTutorStubResistanceSemanticValidationPacketsV2(cases) {
  const loaded = loadTutorStubResistanceSemanticValidationV2();
  return cases.map((blindedCase) => ({
    schema: 'machinespirits.tutor-stub.resistance-semantic-validation-packet.v2',
    packet_id: blindedCase.case_id,
    case_ids: [blindedCase.case_id],
    prompts: Object.fromEntries(
      loaded.instrument.registration.measurement.judges.map((judge) => [
        judge.id,
        buildTutorStubResistanceSemanticAdjudicationPromptV2({
          caseId: blindedCase.case_id,
          source: blindedCase.source,
          publicContext: blindedCase.public_context,
          judge,
        }),
      ]),
    ),
  }));
}

export function assembleTutorStubResistanceSemanticValidationPreflightV2({ cases }) {
  const loaded = loadTutorStubResistanceSemanticValidationV2();
  const blindedCorpus = {
    ...loaded.corpus,
    cases: cases.map((blindedCase) => {
      const corpusCase = tutorStubResistanceSemanticCorpusCaseForExecutionIdV2(
        loaded.corpus.cases,
        blindedCase.case_id,
      );
      if (!corpusCase) throw new Error(`unknown opaque heldout v2 case ${blindedCase.case_id}`);
      return { ...corpusCase, case_id: blindedCase.case_id };
    }),
  };
  const responsePairs = Object.fromEntries(
    blindedCorpus.cases.map((corpusCase) => [
      corpusCase.case_id,
      Object.fromEntries(
        loaded.instrument.registration.measurement.judges.map((judge) => [
          judge.id,
          buildTutorStubResistanceSemanticZeroCallFixtureResponseV2({ corpusCase, judge }),
        ]),
      ),
    ]),
  );
  const score = scoreTutorStubResistanceSemanticCorpusV2({
    corpus: blindedCorpus,
    responsePairs,
    registration: loaded.instrument.registration,
  });
  return {
    schema: 'machinespirits.tutor-stub.resistance-semantic-validation-preflight-assembly.v2',
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
    },
    synthetic_fixture_score: score,
  };
}

export function runTutorStubResistanceSemanticValidationPreflightV2({ contract }) {
  const loaded = loadTutorStubResistanceSemanticValidationV2();
  if (
    contract?.registration?.registration_path !== loaded.registrationPath ||
    contract?.registration?.registration_sha256 !== loaded.registrationSha256 ||
    contract?.registration?.instrument_registration_path !== loaded.instrument.path ||
    contract?.registration?.instrument_registration_sha256 !== loaded.instrument.sha256 ||
    contract?.registration?.heldout_corpus_path !== loaded.registration.heldout.corpusPath ||
    contract?.registration?.heldout_corpus_sha256 !== loaded.corpusSha256
  ) {
    throw new Error('semantic validation v2 endpoint registration, instrument, or heldout binding drifted');
  }
  const blindedCases = buildTutorStubResistanceSemanticBlindedValidationCasesV2(loaded.corpus.cases);
  const preflight = runPaidStudyEndpointPreflight({
    contract,
    cases: blindedCases,
    buildPackets: buildTutorStubResistanceSemanticValidationPacketsV2,
    assemble: assembleTutorStubResistanceSemanticValidationPreflightV2,
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
      programme_ledger_before: 491,
      programme_ledger_after_maximum: 971,
      outcome_validation_hard_reservations: 720,
      confirmation_hard_reservations: 3456,
      staged_maximum_only_after_both_validations_pass: 5147,
      ceiling_amendment_required_before_confirmation: true,
      live_heldout_accuracy_agreement_and_coverage_gates: 'pending_live_validation',
      model_calls: 0,
      production_writes: 0,
    },
  };
}

export default {
  assembleTutorStubResistanceSemanticValidationPreflightV2,
  buildTutorStubResistanceSemanticBlindedValidationCasesV2,
  buildTutorStubResistanceSemanticValidationPacketsV2,
  loadTutorStubResistanceSemanticValidationV2,
  runTutorStubResistanceSemanticValidationPreflightV2,
};
