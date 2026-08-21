import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runPaidStudyEndpointPreflight } from './paidStudyEndpointPreflight.js';
import {
  buildTutorStubResistanceRecoverySemanticPrompt,
  buildTutorStubResistanceRecoverySemanticZeroCallFixture,
  scoreTutorStubResistanceRecoverySemanticCorpus,
  tutorStubResistanceRecoverySemanticSha256,
  validateTutorStubResistanceRecoverySemanticCorpus,
  validateTutorStubResistanceRecoverySemanticRegistration,
} from './tutorStubResistanceRecoverySemanticAdjudicationV2.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_REGISTRATION =
  'config/tutor-stub-resistance-recovery-semantic-validation-registration.v2.json';
export const TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_HELDOUT_CORPUS =
  'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v2.json';
const OPAQUE_CASE_ID_KEY = 'e46291804189812550946440944969acc081ff0234567a35398fd645c0404dcb';
const SHUFFLE_SEED = '71b18bd3a1708b095a446730e6a04261f23512f76852dca08d75c5d707ae97d9';
const PACKET_FIELDS = ['trigger', 'intervention', 'prior_post_trigger', 'intervening_tutor', 'current_learner'];

function readJson(repoPath) {
  return JSON.parse(fs.readFileSync(path.resolve(ROOT, repoPath), 'utf8'));
}

function fileSha256(repoPath) {
  return tutorStubResistanceRecoverySemanticSha256(fs.readFileSync(path.resolve(ROOT, repoPath)));
}

function exactKeys(value, keys) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort())
  );
}

function publicPacket(corpusCase) {
  return Object.fromEntries(PACKET_FIELDS.map((field) => [field, corpusCase[field]]));
}

function recoveryStratum(judgment) {
  if (judgment.bounded_test_merits_engagement === 'yes') {
    return judgment.grounded_precise_jurisdictional_condition === 'yes' ? 'both' : 'meritsOnly';
  }
  return judgment.grounded_precise_jurisdictional_condition === 'yes' ? 'groundedOnly' : 'noRecovery';
}

export function validateTutorStubResistanceRecoverySemanticValidationRegistration({
  registration,
  instrument,
  corpus,
  corpusSha256,
  developmentCorpus,
}) {
  const issues = [];
  const expectedTop = [
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
  ];
  if (!exactKeys(registration, expectedTop)) issues.push('registration keys are not exact');
  if (
    registration?.schema !== 'machinespirits.tutor-stub.resistance-recovery-semantic-validation-registration.v2' ||
    registration?.version !== 2 ||
    registration?.status !== 'prospective_zero_call_readiness_hold' ||
    registration?.studyId !== 'tutor-stub-resistance-recovery-semantic-heldout-validation-v2'
  ) {
    issues.push('outcome validation registration identity drifted');
  }
  if (
    !exactKeys(registration?.instrument, [
      'registrationPath',
      'registrationSha256',
      'instrumentFreezeCommit',
      'instrumentBindingCommit',
      'postHeldoutPromptModelThresholdOrConsensusTuning',
    ]) ||
    registration?.instrument?.registrationPath !==
      'config/tutor-stub-resistance-recovery-semantic-adjudication-registration.v2.json' ||
    registration?.instrument?.registrationSha256 !== instrument.sha256 ||
    registration?.instrument?.instrumentFreezeCommit !== 'ecb0c5b289848308adffa2a415ced06924e5afe6' ||
    registration?.instrument?.instrumentBindingCommit !== 'd37c5ef66b54f199a505560eb3d244106502b36a' ||
    registration?.instrument?.postHeldoutPromptModelThresholdOrConsensusTuning !== false
  ) {
    issues.push('outcome instrument freeze or no-post-heldout-tuning binding drifted');
  }
  const heldout = registration?.heldout || {};
  if (
    !exactKeys(heldout, [
      'corpusPath',
      'corpusSha256',
      'authorCommit',
      'cases',
      'meritsOnly',
      'groundedOnly',
      'both',
      'noRecovery',
      'warm',
      'plain',
      'neither',
      'actionPresent',
      'actionAbsent',
      'interveningTutorDependentCases',
      'interveningTutorDependentPositiveCases',
      'interveningTutorDependentNegativeCases',
      'uniquePacketTexts',
      'uniqueEvidenceTexts',
      'goldVisibleToModelPackets',
    ]) ||
    heldout.corpusPath !== TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_HELDOUT_CORPUS ||
    heldout.corpusSha256 !== corpusSha256 ||
    heldout.authorCommit !== '44e6b21097ed6c55402fbabcd8ca45d7b52a8884' ||
    heldout.cases !== 120 ||
    heldout.meritsOnly !== 32 ||
    heldout.groundedOnly !== 32 ||
    heldout.both !== 16 ||
    heldout.noRecovery !== 40 ||
    heldout.warm !== 40 ||
    heldout.plain !== 40 ||
    heldout.neither !== 40 ||
    heldout.actionPresent !== 80 ||
    heldout.actionAbsent !== 40 ||
    heldout.interveningTutorDependentCases !== 24 ||
    heldout.interveningTutorDependentPositiveCases !== 12 ||
    heldout.interveningTutorDependentNegativeCases !== 12 ||
    heldout.uniquePacketTexts !== 600 ||
    heldout.uniqueEvidenceTexts !== 256 ||
    heldout.goldVisibleToModelPackets !== false ||
    corpus?.role !== 'heldout_blinded' ||
    corpus?.frozen !== true ||
    corpus?.prompt_examples_allowed !== false ||
    corpus?.context_provenance !==
      'independently_authored_complete_public_horizon_after_v2_binding_freeze_d37c5ef66b54f199a505560eb3d244106502b36a'
  ) {
    issues.push('outcome heldout provenance, counts, or blinding drifted');
  }
  const counts = { meritsOnly: 0, groundedOnly: 0, both: 0, noRecovery: 0 };
  const registers = { warm: 0, plain: 0, neither: 0 };
  let actionPresent = 0;
  let interveningTutorDependentCases = 0;
  let interveningTutorDependentPositiveCases = 0;
  let interveningTutorDependentNegativeCases = 0;
  for (const row of corpus?.cases || []) {
    counts[recoveryStratum(row.expected.judgment)] += 1;
    registers[row.expected.judgment.delivered_register] += 1;
    if (row.expected.judgment.delivered_clarify_distinction === 'yes') actionPresent += 1;
    if (row.case_id.includes('-itdep-')) {
      interveningTutorDependentCases += 1;
      if (row.expected.judgment.final_recovery === 'yes') interveningTutorDependentPositiveCases += 1;
      else interveningTutorDependentNegativeCases += 1;
    }
  }
  if (
    JSON.stringify(counts) !== JSON.stringify({ meritsOnly: 32, groundedOnly: 32, both: 16, noRecovery: 40 }) ||
    JSON.stringify(registers) !== JSON.stringify({ warm: 40, plain: 40, neither: 40 }) ||
    actionPresent !== 80 ||
    interveningTutorDependentCases !== 24 ||
    interveningTutorDependentPositiveCases !== 12 ||
    interveningTutorDependentNegativeCases !== 12
  ) {
    issues.push('outcome heldout strata, register, or action counts drifted');
  }
  const packetTexts = (corpus?.cases || []).flatMap((row) => PACKET_FIELDS.map((field) => row[field]));
  const evidenceTexts = (corpus?.cases || []).flatMap((row) => row.expected.evidence.map((entry) => entry.text));
  if (new Set(packetTexts).size !== 600 || new Set(evidenceTexts).size !== 256) {
    issues.push('outcome heldout does not retain unique packet and evidence texts');
  }
  const developmentTexts = new Set(
    (developmentCorpus?.cases || []).flatMap((row) => [
      ...PACKET_FIELDS.map((field) => row[field]),
      ...row.expected.evidence.map((entry) => entry.text),
    ]),
  );
  if ([...packetTexts, ...evidenceTexts].some((text) => developmentTexts.has(text))) {
    issues.push('outcome heldout text collides with development evidence');
  }
  if (
    !exactKeys(registration?.executionBlinding, [
      'opaqueCaseIdHmacKeyHex',
      'deterministicShuffleSeedHex',
      'originalCaseIdsVisibleToExecution',
      'goldMappingJoinedOnlyAfterAllResponsesSealed',
    ]) ||
    registration?.executionBlinding?.opaqueCaseIdHmacKeyHex !== OPAQUE_CASE_ID_KEY ||
    registration?.executionBlinding?.deterministicShuffleSeedHex !== SHUFFLE_SEED ||
    registration?.executionBlinding?.originalCaseIdsVisibleToExecution !== false ||
    registration?.executionBlinding?.goldMappingJoinedOnlyAfterAllResponsesSealed !== true
  ) {
    issues.push('outcome opaque identity or post-seal gold join drifted');
  }
  const readiness = registration?.executionReadiness || {};
  if (
    !exactKeys(readiness, [
      'plannedCases',
      'judgesPerCase',
      'plannedModelCalls',
      'maximumReservationsPerPlannedCall',
      'hardValidationReservations',
      'programmeObservedLedgerBeforeAnyValidation',
      'programmeMaximumAfterManipulationValidation',
      'programmeMaximumAfterBothValidations',
      'futureConfirmationHardReservations',
      'futureStagedMaximumOnlyAfterBothValidationsPass',
      'programmeCeiling',
      'liveExecutorStatus',
    ]) ||
    readiness.plannedCases !== 120 ||
    readiness.judgesPerCase !== 2 ||
    readiness.plannedModelCalls !== 240 ||
    readiness.maximumReservationsPerPlannedCall !== 3 ||
    readiness.hardValidationReservations !== 720 ||
    readiness.programmeObservedLedgerBeforeAnyValidation !== 491 ||
    readiness.programmeMaximumAfterManipulationValidation !== 971 ||
    readiness.programmeMaximumAfterBothValidations !== 1691 ||
    readiness.futureConfirmationHardReservations !== 3456 ||
    readiness.futureStagedMaximumOnlyAfterBothValidationsPass !== 5147 ||
    readiness.programmeCeiling !== 5000 ||
    readiness.liveExecutorStatus !== 'zero_call_ready_pending_digest_bound_go_request_and_model_authority'
  ) {
    issues.push('outcome validation or staged programme budget drifted');
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
      'durablePrivateArchiveRequired',
    ]) ||
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
    policy.durablePrivateArchiveRequired !== true
  ) {
    issues.push('outcome validation no-recall, no-selection, or archive policy drifted');
  }
  if (
    !exactKeys(registration?.authorization, [
      'goRequestPrepared',
      'modelCallsAuthorized',
      'liveRunAuthorized',
      'standingArchitecturalCorrectionSha256',
      'priorStandingAuthoritySha256',
    ]) ||
    registration?.authorization?.goRequestPrepared !== false ||
    registration?.authorization?.modelCallsAuthorized !== false ||
    registration?.authorization?.liveRunAuthorized !== false ||
    registration?.authorization?.standingArchitecturalCorrectionSha256 !==
      'dae9091d4f2584d416d7765e66d47acba03a33264886a6fa0a1eba45857c05f4' ||
    registration?.authorization?.priorStandingAuthoritySha256 !==
      '538aa73239072ea618e2c8308edf562f1dd7495b78574e35a3db2f549302c1ce'
  ) {
    issues.push('outcome validation HOLD or authority binding drifted');
  }
  const claim = registration?.claimBoundary || {};
  if (
    !exactKeys(claim, [
      'validationOnly',
      'syntheticZeroCallPreflightEstablishesAccuracy',
      'sealedPassRequiredBeforeExecutableConfirmationRegistration',
      'validationOutcomesExcludedFromConfirmation',
      'historicalPartialOutcomesExcluded',
      'noWarmPlainEfficacyNullLearningTransferHumanOrCellClaim',
    ]) ||
    claim.validationOnly !== true ||
    claim.syntheticZeroCallPreflightEstablishesAccuracy !== false ||
    claim.sealedPassRequiredBeforeExecutableConfirmationRegistration !== true ||
    claim.validationOutcomesExcludedFromConfirmation !== true ||
    claim.historicalPartialOutcomesExcluded !== true ||
    claim.noWarmPlainEfficacyNullLearningTransferHumanOrCellClaim !== true
  ) {
    issues.push('outcome validation-only claim boundary drifted');
  }
  return { valid: issues.length === 0, issues, counts, registers, actionPresent };
}

export function tutorStubResistanceRecoverySemanticOpaqueCaseId(corpusCase) {
  const packetSha = tutorStubResistanceRecoverySemanticSha256(JSON.stringify(publicPacket(corpusCase)));
  const digest = crypto
    .createHmac('sha256', Buffer.from(OPAQUE_CASE_ID_KEY, 'hex'))
    .update(`${corpusCase.case_id}\0${packetSha}`)
    .digest('hex');
  return `rv-${digest.slice(0, 32)}`;
}

export function buildTutorStubResistanceRecoverySemanticBlindedValidationCases(cases) {
  return cases
    .map((corpusCase) => ({
      corpusCase,
      case_id: tutorStubResistanceRecoverySemanticOpaqueCaseId(corpusCase),
      order: tutorStubResistanceRecoverySemanticSha256(
        `${SHUFFLE_SEED}\0${tutorStubResistanceRecoverySemanticOpaqueCaseId(corpusCase)}`,
      ),
    }))
    .sort((left, right) => left.order.localeCompare(right.order))
    .map(({ corpusCase, case_id }) => ({ case_id, ...publicPacket(corpusCase) }));
}

export function loadTutorStubResistanceRecoverySemanticValidation() {
  const registration = readJson(TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_REGISTRATION);
  const instrumentPath = registration.instrument.registrationPath;
  const instrument = readJson(instrumentPath);
  const instrumentValidation = validateTutorStubResistanceRecoverySemanticRegistration(instrument);
  const corpus = readJson(registration.heldout.corpusPath);
  const corpusValidation = validateTutorStubResistanceRecoverySemanticCorpus(corpus);
  const developmentCorpus = readJson(instrument.instrument.developmentCorpusPath);
  const bindingValidation = validateTutorStubResistanceRecoverySemanticValidationRegistration({
    registration,
    instrument: { registration: instrument, path: instrumentPath, sha256: fileSha256(instrumentPath) },
    corpus,
    corpusSha256: fileSha256(registration.heldout.corpusPath),
    developmentCorpus,
  });
  const issues = [...instrumentValidation.issues, ...corpusValidation.issues, ...bindingValidation.issues];
  if (issues.length) throw new Error(`outcome semantic validation invalid: ${issues.join('; ')}`);
  return {
    registration,
    registrationPath: TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_REGISTRATION,
    registrationSha256: fileSha256(TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_REGISTRATION),
    instrument,
    instrumentPath,
    instrumentSha256: fileSha256(instrumentPath),
    corpus,
    corpusSha256: fileSha256(registration.heldout.corpusPath),
  };
}

function originalCase(loaded, executionId) {
  return loaded.corpus.cases.find((row) => tutorStubResistanceRecoverySemanticOpaqueCaseId(row) === executionId);
}

export function buildTutorStubResistanceRecoverySemanticValidationPackets(cases) {
  const loaded = loadTutorStubResistanceRecoverySemanticValidation();
  return cases.map((row) => ({
    schema: 'machinespirits.tutor-stub.resistance-recovery-semantic-validation-packet.v2',
    packet_id: row.case_id,
    case_ids: [row.case_id],
    prompts: Object.fromEntries(
      loaded.instrument.measurement.judges.map((judge) => [
        judge.id,
        buildTutorStubResistanceRecoverySemanticPrompt({
          caseId: row.case_id,
          publicPacket: Object.fromEntries(PACKET_FIELDS.map((field) => [field, row[field]])),
          judge,
        }),
      ]),
    ),
  }));
}

export function assembleTutorStubResistanceRecoverySemanticValidationPreflight({ cases }) {
  const loaded = loadTutorStubResistanceRecoverySemanticValidation();
  const syntheticCorpus = {
    ...loaded.corpus,
    cases: cases.map((row) => {
      const source = originalCase(loaded, row.case_id);
      if (!source) throw new Error(`unknown opaque outcome heldout case ${row.case_id}`);
      return { ...source, case_id: row.case_id };
    }),
  };
  const responsePairs = Object.fromEntries(
    syntheticCorpus.cases.map((corpusCase) => [
      corpusCase.case_id,
      Object.fromEntries(
        loaded.instrument.measurement.judges.map((judge) => [
          judge.id,
          buildTutorStubResistanceRecoverySemanticZeroCallFixture({ corpusCase, judge }),
        ]),
      ),
    ]),
  );
  const score = scoreTutorStubResistanceRecoverySemanticCorpus({
    corpus: syntheticCorpus,
    responsePairs,
    registration: loaded.instrument,
  });
  return {
    schema: 'machinespirits.tutor-stub.resistance-recovery-semantic-validation-preflight-assembly.v2',
    case_ids: cases.map((row) => row.case_id),
    endpoint_status: {
      synthetic_fixture_full_vector_metric_wiring: score.status === 'passed' ? 'complete' : 'failed',
      synthetic_schema_span_source_ownership_wiring:
        score.metrics.schema_span_provenance_validity === 1 ? 'complete' : 'failed',
      synthetic_interjudge_full_vector_wiring:
        score.metrics.raw_full_vector_interjudge_agreement >= 0.9 ? 'complete' : 'failed',
      synthetic_four_stratum_coverage_wiring: Object.values(score.metrics.determined_coverage_by_stratum).every(
        (value) => value >= 0.9,
      )
        ? 'complete'
        : 'failed',
    },
    synthetic_fixture_score: score,
  };
}

export function runTutorStubResistanceRecoverySemanticValidationPreflight({ contract }) {
  const loaded = loadTutorStubResistanceRecoverySemanticValidation();
  if (
    contract?.registration?.registration_path !== loaded.registrationPath ||
    contract?.registration?.registration_sha256 !== loaded.registrationSha256 ||
    contract?.registration?.instrument_registration_path !== loaded.instrumentPath ||
    contract?.registration?.instrument_registration_sha256 !== loaded.instrumentSha256 ||
    contract?.registration?.heldout_corpus_path !== loaded.registration.heldout.corpusPath ||
    contract?.registration?.heldout_corpus_sha256 !== loaded.corpusSha256
  ) {
    throw new Error('outcome semantic endpoint registration, instrument, or heldout binding drifted');
  }
  const cases = buildTutorStubResistanceRecoverySemanticBlindedValidationCases(loaded.corpus.cases);
  const preflight = runPaidStudyEndpointPreflight({
    contract,
    cases,
    buildPackets: buildTutorStubResistanceRecoverySemanticValidationPackets,
    assemble: assembleTutorStubResistanceRecoverySemanticValidationPreflight,
  });
  return {
    ...preflight,
    outcome_semantic_validation_readiness_audit: {
      status: 'passed_zero_call_wiring_only_not_accuracy_or_launch_authority_evidence',
      cases: 120,
      planned_model_calls: 240,
      hard_validation_reservations: 720,
      live_executor: 'zero_call_ready_pending_digest_bound_go_request_and_model_authority',
      live_accuracy_agreement_validity_and_coverage_gates: 'pending_live_validation',
      model_calls: 0,
      production_writes: 0,
    },
  };
}

export default {
  buildTutorStubResistanceRecoverySemanticBlindedValidationCases,
  buildTutorStubResistanceRecoverySemanticValidationPackets,
  loadTutorStubResistanceRecoverySemanticValidation,
  runTutorStubResistanceRecoverySemanticValidationPreflight,
};
