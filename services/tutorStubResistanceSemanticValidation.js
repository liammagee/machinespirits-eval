import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildTutorStubResistanceSemanticAdjudicationPrompt,
  buildTutorStubResistanceSemanticZeroCallFixtureResponse,
  scoreTutorStubResistanceSemanticCorpus,
  tutorStubResistanceSemanticSha256,
  validateTutorStubResistanceSemanticCorpus,
} from './tutorStubResistanceSemanticAdjudication.js';
import { runPaidStudyEndpointPreflight } from './paidStudyEndpointPreflight.js';
import { loadTutorStubResistanceSemanticRegistration } from './tutorStubResistanceSemanticRuntime.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_REGISTRATION =
  'config/tutor-stub-resistance-semantic-adjudication-validation-registration.v1.json';
export const TUTOR_STUB_RESISTANCE_SEMANTIC_HELDOUT_CORPUS =
  'config/tutor-stub-resistance-semantic-adjudication-heldout-corpus.v1.json';
const OPAQUE_CASE_ID_KEY = '14ff268ef54f1ec016a4c11180205d8ebd9430439a5fe82c46ce635e70ead0fd';
const SHUFFLE_SEED = 'f98d130510e1bf557232d1b119d8609880e8e3bc8be9fdd60e78ba8f878e6b92';

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

export function validateTutorStubResistanceSemanticValidationRegistration({
  registration,
  instrument,
  corpus,
  corpusSha256,
  developmentCorpus,
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
        'scoringCorrectionCommit',
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
        'cases',
        'frameRefuser',
        'productiveDispute',
        'neither',
        'uniqueSources',
        'uniqueContextMessages',
        'goldVisibleToModelPackets',
      ],
      'heldout',
    ],
    [
      registration?.executionBlinding,
      [
        'opaqueCaseIdHmacKeyHex',
        'deterministicShuffleSeedHex',
        'originalCaseIdsVisibleToExecution',
        'goldMappingJoinedOnlyAfterAllResponsesSealed',
      ],
      'executionBlinding',
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
      ],
      'executionReadiness',
    ],
    [
      registration?.executionPolicy,
      [
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
      ],
      'executionPolicy',
    ],
    [
      registration?.authorization,
      [
        'goRequestPrepared',
        'modelCallsAuthorized',
        'liveRunAuthorized',
        'standingArchitecturalCorrectionSha256',
        'priorStandingAuthoritySha256',
      ],
      'authorization',
    ],
    [
      registration?.claimBoundary,
      [
        'validationOnly',
        'syntheticZeroCallPreflightEstablishesAccuracy',
        'heldoutPassRequiredBeforeConfirmationRequest',
        'validationOutcomesExcludedFromConfirmation',
        'historicalPartialOutcomesExcluded',
        'noWarmPlainEfficacyNullLearningTransferHumanOrCellClaim',
      ],
      'claimBoundary',
    ],
  ];
  for (const [value, keys, label] of exactShapes) {
    if (!exactKeys(value, keys)) issues.push(`${label} keys are not exact`);
  }
  if (
    registration?.schema !== 'machinespirits.tutor-stub.resistance-semantic-adjudication-validation-registration.v1' ||
    registration?.version !== 1 ||
    registration?.status !== 'prospective_zero_call_readiness_hold' ||
    registration?.studyId !== 'tutor-stub-resistance-semantic-adjudication-heldout-validation-v1'
  ) {
    issues.push('validation registration identity drifted');
  }
  if (
    registration?.instrument?.registrationPath !== instrument?.path ||
    registration?.instrument?.registrationSha256 !== instrument?.sha256 ||
    registration?.instrument?.instrumentFreezeCommit !== '4cf49a15b500f058401bd8bd586166ba90c8842c' ||
    registration?.instrument?.scoringCorrectionCommit !== 'c9f11e44e7938875c5f391b60b569b7b4ba5dabe' ||
    registration?.instrument?.postHeldoutPromptModelThresholdOrConsensusTuning !== false
  ) {
    issues.push('frozen instrument binding or no-post-heldout-tuning rule drifted');
  }
  if (
    registration?.heldout?.corpusPath !== TUTOR_STUB_RESISTANCE_SEMANTIC_HELDOUT_CORPUS ||
    registration?.heldout?.corpusSha256 !== corpusSha256 ||
    registration?.heldout?.authorCommit !== '149d237c43ad366f36f80d61e69db8d1514bf6fd' ||
    registration?.heldout?.cases !== 80 ||
    registration?.heldout?.frameRefuser !== 40 ||
    registration?.heldout?.productiveDispute !== 16 ||
    registration?.heldout?.neither !== 24 ||
    registration?.heldout?.uniqueSources !== 80 ||
    registration?.heldout?.uniqueContextMessages !== 88 ||
    registration?.heldout?.goldVisibleToModelPackets !== false ||
    corpus?.role !== 'heldout_blinded' ||
    corpus?.frozen !== true ||
    corpus?.prompt_examples_allowed !== false ||
    corpus?.context_provenance !== 'independently_authored_bounded_public_context_blinded_after_instrument_freeze'
  ) {
    issues.push('heldout provenance, counts, freeze, or blinding binding drifted');
  }
  const developmentIds = new Set((developmentCorpus?.cases || []).map((row) => row.case_id));
  const developmentSources = new Set((developmentCorpus?.cases || []).map((row) => row.source));
  const developmentContextMessages = new Set(
    (developmentCorpus?.cases || []).flatMap((row) =>
      Array.isArray(row.public_context) ? row.public_context.map((message) => message.text) : [],
    ),
  );
  const heldoutSources = (corpus?.cases || []).map((row) => row.source);
  const heldoutContextMessages = (corpus?.cases || []).flatMap((row) =>
    Array.isArray(row.public_context) ? row.public_context.map((message) => message.text) : [],
  );
  if (
    (corpus?.cases || []).some(
      (row) =>
        developmentIds.has(row.case_id) ||
        developmentSources.has(row.source) ||
        (Array.isArray(row.public_context) &&
          row.public_context.some((message) => developmentContextMessages.has(message.text))),
    )
  ) {
    issues.push('heldout case id, source, or public context message collides with development evidence');
  }
  if (new Set(heldoutSources).size !== 80 || new Set(heldoutContextMessages).size !== 88) {
    issues.push('heldout source utterances or public context messages are not uniquely authored');
  }
  if (
    registration?.executionBlinding?.opaqueCaseIdHmacKeyHex !== OPAQUE_CASE_ID_KEY ||
    registration?.executionBlinding?.deterministicShuffleSeedHex !== SHUFFLE_SEED ||
    registration?.executionBlinding?.originalCaseIdsVisibleToExecution !== false ||
    registration?.executionBlinding?.goldMappingJoinedOnlyAfterAllResponsesSealed !== true
  ) {
    issues.push('opaque execution identity, shuffle, or post-seal gold join binding drifted');
  }
  const counts = Object.fromEntries(
    ['frame_refuser', 'frame_defiant_or_productive_dispute', 'neither'].map((label) => [
      label,
      (corpus?.cases || []).filter((row) => row.expected.label === label).length,
    ]),
  );
  if (counts.frame_refuser !== 40 || counts.frame_defiant_or_productive_dispute !== 16 || counts.neither !== 24) {
    issues.push('heldout class counts drifted');
  }
  const budget = registration?.executionReadiness || {};
  if (
    budget.plannedCases !== 80 ||
    budget.judgesPerCase !== 2 ||
    budget.plannedModelCalls !== 160 ||
    budget.maximumReservationsPerPlannedCall !== 3 ||
    budget.hardValidationReservations !== 480 ||
    budget.programmeLedgerBefore !== 331 ||
    budget.programmeLedgerAfterMaximum !== 811 ||
    budget.programmeCeiling !== 5000 ||
    budget.futureOutcomeValidationHardReservations !== 720 ||
    budget.futureConfirmationHardReservations !== 3456 ||
    budget.futureStagedMaximumOnlyAfterBothValidationsPass !== 4987
  ) {
    issues.push('validation or staged confirmation attempt ledger drifted');
  }
  const policy = registration?.executionPolicy || {};
  if (
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
    policy.developmentExamplesVisibleToJudges !== false
  ) {
    issues.push('validation checkpoint, recovery, no-selection, or blinding boundary drifted');
  }
  if (
    registration?.authorization?.goRequestPrepared !== false ||
    registration?.authorization?.modelCallsAuthorized !== false ||
    registration?.authorization?.liveRunAuthorized !== false ||
    registration?.authorization?.standingArchitecturalCorrectionSha256 !==
      'dae9091d4f2584d416d7765e66d47acba03a33264886a6fa0a1eba45857c05f4' ||
    registration?.authorization?.priorStandingAuthoritySha256 !==
      '538aa73239072ea618e2c8308edf562f1dd7495b78574e35a3db2f549302c1ce'
  ) {
    issues.push('authorization HOLD or governance provenance drifted');
  }
  const claims = registration?.claimBoundary || {};
  if (
    claims.validationOnly !== true ||
    claims.syntheticZeroCallPreflightEstablishesAccuracy !== false ||
    claims.heldoutPassRequiredBeforeConfirmationRequest !== true ||
    claims.validationOutcomesExcludedFromConfirmation !== true ||
    claims.historicalPartialOutcomesExcluded !== true ||
    claims.noWarmPlainEfficacyNullLearningTransferHumanOrCellClaim !== true
  ) {
    issues.push('validation-only claim boundary drifted');
  }
  return { valid: issues.length === 0, issues, counts };
}

export function tutorStubResistanceSemanticOpaqueCaseId(corpusCase) {
  const commitment = crypto
    .createHmac('sha256', Buffer.from(OPAQUE_CASE_ID_KEY, 'hex'))
    .update(`${corpusCase.case_id}\0${tutorStubResistanceSemanticSha256(corpusCase.source)}`)
    .digest('hex');
  return `sv-${commitment.slice(0, 32)}`;
}

function shuffledHeldoutCases(cases) {
  return cases
    .map((corpusCase) => ({
      corpusCase,
      executionCaseId: tutorStubResistanceSemanticOpaqueCaseId(corpusCase),
      orderKey: tutorStubResistanceSemanticSha256(
        `${SHUFFLE_SEED}\0${tutorStubResistanceSemanticOpaqueCaseId(corpusCase)}`,
      ),
    }))
    .sort((left, right) => left.orderKey.localeCompare(right.orderKey));
}

export function buildTutorStubResistanceSemanticBlindedValidationCases(cases) {
  return shuffledHeldoutCases(cases).map(({ corpusCase, executionCaseId }) => ({
    case_id: executionCaseId,
    source: corpusCase.source,
    public_context: corpusCase.public_context,
  }));
}

export function tutorStubResistanceSemanticCorpusCaseForExecutionId(cases, executionCaseId) {
  return cases.find((row) => tutorStubResistanceSemanticOpaqueCaseId(row) === executionCaseId) || null;
}

export function loadTutorStubResistanceSemanticValidation() {
  const registration = readJson(TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_REGISTRATION);
  const instrument = loadTutorStubResistanceSemanticRegistration(registration.instrument.registrationPath);
  const corpus = readJson(registration.heldout.corpusPath);
  const developmentCorpus = readJson(instrument.registration.instrument.developmentCorpusPath);
  const corpusValidation = validateTutorStubResistanceSemanticCorpus(corpus);
  const issues = [...corpusValidation.issues];
  const validation = validateTutorStubResistanceSemanticValidationRegistration({
    registration,
    instrument,
    corpus,
    corpusSha256: fileSha256(registration.heldout.corpusPath),
    developmentCorpus,
  });
  issues.push(...validation.issues);
  if (issues.length) throw new Error(`semantic validation registration invalid: ${issues.join('; ')}`);
  return {
    registration,
    registrationPath: TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_REGISTRATION,
    registrationSha256: fileSha256(TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_REGISTRATION),
    instrument,
    corpus,
    corpusSha256: fileSha256(registration.heldout.corpusPath),
    counts: validation.counts,
  };
}

export function buildTutorStubResistanceSemanticValidationPackets(cases) {
  const loaded = loadTutorStubResistanceSemanticValidation();
  return cases.map((blindedCase) => ({
    schema: 'machinespirits.tutor-stub.resistance-semantic-validation-packet.v1',
    packet_id: blindedCase.case_id,
    case_ids: [blindedCase.case_id],
    prompts: Object.fromEntries(
      loaded.instrument.registration.measurement.judges.map((judge) => [
        judge.id,
        buildTutorStubResistanceSemanticAdjudicationPrompt({
          caseId: blindedCase.case_id,
          source: blindedCase.source,
          publicContext: blindedCase.public_context,
          judge,
        }),
      ]),
    ),
  }));
}

export function assembleTutorStubResistanceSemanticValidationPreflight({ cases }) {
  const loaded = loadTutorStubResistanceSemanticValidation();
  const blindedCorpus = {
    ...loaded.corpus,
    cases: cases.map((blindedCase) => {
      const corpusCase = tutorStubResistanceSemanticCorpusCaseForExecutionId(loaded.corpus.cases, blindedCase.case_id);
      if (!corpusCase) throw new Error(`unknown opaque heldout case ${blindedCase.case_id}`);
      return { ...corpusCase, case_id: blindedCase.case_id };
    }),
  };
  const responsePairs = Object.fromEntries(
    blindedCorpus.cases.map((corpusCase) => [
      corpusCase.case_id,
      Object.fromEntries(
        loaded.instrument.registration.measurement.judges.map((judge) => [
          judge.id,
          buildTutorStubResistanceSemanticZeroCallFixtureResponse({ corpusCase, judge }),
        ]),
      ),
    ]),
  );
  const score = scoreTutorStubResistanceSemanticCorpus({
    corpus: blindedCorpus,
    responsePairs,
    registration: loaded.instrument.registration,
  });
  return {
    schema: 'machinespirits.tutor-stub.resistance-semantic-validation-preflight-assembly.v1',
    case_ids: cases.map((row) => row.case_id),
    endpoint_status: {
      synthetic_fixture_metric_pipeline_wiring: score.status === 'passed' ? 'complete' : 'failed',
      synthetic_schema_span_provenance_wiring:
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

export function runTutorStubResistanceSemanticValidationPreflight({ contract }) {
  const loaded = loadTutorStubResistanceSemanticValidation();
  if (
    contract?.registration?.registration_path !== loaded.registrationPath ||
    contract?.registration?.registration_sha256 !== loaded.registrationSha256 ||
    contract?.registration?.instrument_registration_path !== loaded.instrument.path ||
    contract?.registration?.instrument_registration_sha256 !== loaded.instrument.sha256 ||
    contract?.registration?.heldout_corpus_path !== loaded.registration.heldout.corpusPath ||
    contract?.registration?.heldout_corpus_sha256 !== loaded.corpusSha256
  ) {
    throw new Error('semantic validation endpoint registration, instrument, or heldout binding drifted');
  }
  const blindedCases = buildTutorStubResistanceSemanticBlindedValidationCases(loaded.corpus.cases);
  const preflight = runPaidStudyEndpointPreflight({
    contract,
    cases: blindedCases,
    buildPackets: buildTutorStubResistanceSemanticValidationPackets,
    assemble: assembleTutorStubResistanceSemanticValidationPreflight,
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
      programme_ledger_before: 331,
      programme_ledger_after_maximum: 811,
      outcome_validation_hard_reservations: 720,
      confirmation_hard_reservations: 3456,
      staged_maximum_only_after_both_validations_pass: 4987,
      live_heldout_accuracy_agreement_and_coverage_gates: 'pending_live_validation',
      model_calls: 0,
      production_writes: 0,
    },
  };
}

export function tutorStubResistanceSemanticValidationPlanFingerprint(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export default {
  assembleTutorStubResistanceSemanticValidationPreflight,
  buildTutorStubResistanceSemanticBlindedValidationCases,
  buildTutorStubResistanceSemanticValidationPackets,
  loadTutorStubResistanceSemanticValidation,
  runTutorStubResistanceSemanticValidationPreflight,
};
