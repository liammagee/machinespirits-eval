import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  tutorStubResistanceRecoverySemanticSha256,
  validateTutorStubResistanceRecoverySemanticCorpus,
} from './tutorStubResistanceRecoverySemanticAdjudicationV2.js';
import { recordFileDigest } from './recordedFileDigest.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_REGISTRATION_V3 =
  'config/tutor-stub-resistance-recovery-semantic-validation-registration.v3.json';

function readJson(repoPath) {
  return JSON.parse(fs.readFileSync(path.resolve(ROOT, repoPath), 'utf8'));
}

function fileSha256(repoPath) {
  return tutorStubResistanceRecoverySemanticSha256(fs.readFileSync(path.resolve(ROOT, repoPath)));
}

function exactRoutes(judges) {
  const routes = [
    ['recovery_semantic_judge_a', 'codex.gpt-5.6-sol', 'codex', 'gpt-5.6-sol'],
    ['recovery_semantic_judge_b', 'claude-code.sonnet-5', 'claude-code', 'claude-sonnet-5'],
    ['recovery_semantic_judge_c', 'codex.gpt-5.5', 'codex', 'gpt-5.5'],
  ];
  return (
    judges.length === routes.length &&
    routes.every(
      ([id, modelRef, provider, model], index) =>
        judges[index]?.id === id &&
        judges[index]?.modelRef === modelRef &&
        judges[index]?.provider === provider &&
        judges[index]?.model === model &&
        judges[index]?.effort === 'low' &&
        judges[index]?.independent === true,
    )
  );
}

export function validateTutorStubResistanceRecoverySemanticRegistrationV3(registration) {
  const issues = [];
  if (
    registration?.schema !== 'machinespirits.tutor-stub.resistance-recovery-semantic-adjudication-registration.v3' ||
    registration?.version !== 3 ||
    registration?.status !== 'hierarchical_ensemble_frozen_pending_independent_v3_heldout_validation'
  ) {
    issues.push('v3 outcome instrument identity drifted');
  }
  const instrument = registration?.instrument || {};
  const digestRecords = [
    [instrument.ensembleImplementationPath, instrument.ensembleImplementationSha256, 'v3 ensemble implementation'],
    [instrument.seatImplementationPath, instrument.seatImplementationSha256, 'v3 seat implementation'],
    [instrument.seatResponseSchemaPath, instrument.seatResponseSchemaSha256, 'v3 seat response schema'],
  ].map(([filePath, recordedSha256, label]) => recordFileDigest({ root: ROOT, filePath, recordedSha256, label }));
  if (
    instrument.ensembleImplementationPath !== 'services/tutorStubResistanceRecoverySemanticAdjudicationV3.js' ||
    instrument.ensembleFreezeCommit !== '4a58374052041d6ac7cb18ded0d6d009a5ee4060' ||
    instrument.seatImplementationPath !== 'services/tutorStubResistanceRecoverySemanticAdjudicationV2.js' ||
    instrument.seatResponseSchemaPath !== 'config/tutor-stub-resistance-recovery-semantic-response.schema.v2.json' ||
    instrument.seatPromptSchemaAndSpanWrapperChangedFromV2 !== false
  ) {
    issues.push('v3 outcome frozen implementation binding drifted');
  }
  if (!exactRoutes(registration?.measurement?.judges || [])) issues.push('v3 outcome judge panel drifted');
  const consensus = registration?.measurement?.hierarchicalConsensus || {};
  if (
    consensus.primaryRecoveryRule !== 'two_of_three_valid_high_confidence_final_recovery_votes' ||
    consensus.componentRule !== 'two_of_three_valid_high_confidence_field_values_independently' ||
    consensus.componentDisagreementMayVetoPrimaryRecovery !== false ||
    consensus.invalidLowConfidenceMissingOrResponseFreeDisposition !== 'judge_abstention' ||
    consensus.noPrimaryMajorityDisposition !== 'measurement_indeterminate' ||
    consensus.classifierOrRegexTiebreaker !== false ||
    consensus.judgeRerunAfterSemanticResponse !== false ||
    consensus.unitReplacementOrOutcomeSelection !== false
  ) {
    issues.push('v3 outcome hierarchical consensus drifted');
  }
  const gates = registration?.measurement?.validationGates || {};
  const expectedGates = {
    minimumJudgmentValidityRate: 0.95,
    minimumPanelsWithTwoEligibleVoters: 0.95,
    minimumPerJudgeFinalRecoveryAccuracy: 0.85,
    minimumPrimarySensitivity: 0.95,
    minimumPrimarySpecificity: 0.95,
    minimumPrimaryExactAccuracy: 0.95,
    minimumPrimaryDeterminedCoverageOverall: 0.95,
    minimumPrimaryDeterminedCoveragePerStratum: 0.9,
    minimumAggregateComponentAccuracy: 0.9,
    minimumAggregateComponentDeterminedCoverage: 0.9,
    minimumActionClassificationAccuracy: 0.95,
    minimumRegisterClassificationAccuracy: 0.95,
    minimumMeanPairwiseRecoveryAgreement: 0.85,
    minimumMultiRaterRecoveryKappa: 0.75,
    maximumProhibitedToolEvents: 0,
    indeterminateCountsAsSensitivitySpecificityOrAccuracyFailure: true,
  };
  if (JSON.stringify(gates) !== JSON.stringify(expectedGates)) issues.push('v3 outcome validation gates drifted');
  const heldout = registration?.heldoutFreezeProtocol || {};
  if (
    heldout.corpusPath !== 'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v2.json' ||
    heldout.corpusSha256 !== fileSha256(heldout.corpusPath) ||
    heldout.neverSentToAnyJudgeBeforeV3EnsembleFreeze !== true ||
    heldout.neverAnalyzedAsOutcomeDataBeforeV3EnsembleFreeze !== true ||
    heldout.v3AggregationDecisionUsedHeldoutTextOrGold !== false ||
    heldout.postHeldoutResponsePromptModelThresholdOrConsensusTuning !== false ||
    heldout.validationCallsAuthorized !== false
  ) {
    issues.push('v3 outcome heldout independence or no-tuning boundary drifted');
  }
  const budget = registration?.prospectiveValidationBudget || {};
  if (
    budget.programmeLedgerBeforeV3OutcomeValidation !== 1136 ||
    budget.heldoutCases !== 120 ||
    budget.independentJudgesPerCase !== 3 ||
    budget.plannedCalls !== 360 ||
    budget.maximumChargedReservationsPerPlannedCall !== 3 ||
    budget.hardValidationReservations !== 1080 ||
    budget.programmeMaximumAfterV3OutcomeValidation !== 2216 ||
    budget.programmeCeiling !== 5000 ||
    budget.attemptCountsAreOperationalSafeguardsNotDesignObjectives !== true
  ) {
    issues.push('v3 outcome operational safeguards drifted');
  }
  if (
    registration?.authorization?.validationModelCallsAuthorized !== false ||
    registration?.authorization?.confirmationModelCallsAuthorized !== false ||
    registration?.authorization?.liveRunAuthorized !== false ||
    registration?.claimBoundary?.validationOnly !== true ||
    registration?.claimBoundary?.validationOutcomesExcludedFromConfirmation !== true
  ) {
    issues.push('v3 outcome authorization or claim boundary drifted');
  }
  return { valid: issues.length === 0, issues, digestRecords };
}

export function validateTutorStubResistanceRecoverySemanticValidationRegistrationV3({
  validationRegistration,
  instrument,
  corpus,
}) {
  const issues = [];
  if (
    validationRegistration?.schema !==
      'machinespirits.tutor-stub.resistance-recovery-semantic-validation-registration.v3' ||
    validationRegistration?.version !== 3 ||
    validationRegistration?.status !== 'prospective_zero_call_readiness_hold' ||
    validationRegistration?.studyId !== 'tutor-stub-resistance-recovery-semantic-heldout-validation-v3'
  ) {
    issues.push('v3 outcome validation registration identity drifted');
  }
  const digestRecords = [
    recordFileDigest({
      root: ROOT,
      filePath: 'config/tutor-stub-resistance-recovery-semantic-adjudication-registration.v3.json',
      recordedSha256: validationRegistration?.instrument?.registrationSha256,
      label: 'v3 outcome instrument registration',
    }),
  ];
  if (
    validationRegistration?.instrument?.registrationPath !==
      'config/tutor-stub-resistance-recovery-semantic-adjudication-registration.v3.json' ||
    validationRegistration?.instrument?.ensembleFreezeCommit !== '4a58374052041d6ac7cb18ded0d6d009a5ee4060' ||
    validationRegistration?.instrument?.postHeldoutResponsePromptModelThresholdOrConsensusTuning !== false
  ) {
    issues.push('v3 outcome validation instrument binding drifted');
  }
  if (
    validationRegistration?.heldout?.corpusPath !==
      'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v2.json' ||
    validationRegistration?.heldout?.corpusSha256 !== fileSha256(validationRegistration?.heldout?.corpusPath) ||
    validationRegistration?.heldout?.neverSentToAnyJudgeBeforeV3EnsembleFreeze !== true ||
    validationRegistration?.heldout?.goldVisibleToModelPackets !== false ||
    corpus?.cases?.length !== 120
  ) {
    issues.push('v3 outcome validation heldout binding drifted');
  }
  const readiness = validationRegistration?.executionReadiness || {};
  if (
    readiness.plannedCases !== 120 ||
    readiness.judgesPerCase !== 3 ||
    readiness.plannedModelCalls !== 360 ||
    readiness.maximumReservationsPerPlannedCall !== 3 ||
    readiness.hardValidationReservations !== 1080 ||
    readiness.programmeLedgerBefore !== 1136 ||
    readiness.programmeMaximumAfterValidation !== 2216 ||
    readiness.programmeCeiling !== 5000
  ) {
    issues.push('v3 outcome validation execution safeguards drifted');
  }
  const policy = validationRegistration?.executionPolicy || {};
  if (
    policy.dispatchedWithoutResponseDisposition !==
      'seat_abstention_no_recall_continue_remaining_never_dispatched_judges' ||
    policy.invalidLowConfidenceOrTransportTerminalDisposition !==
      'seat_abstention_no_semantic_rerun_continue_remaining_never_dispatched_judges' ||
    policy.validCaseRerun !== false ||
    policy.semanticResponseRerun !== false ||
    policy.replacement !== false ||
    policy.outcomeSelection !== false ||
    policy.durablePrivateArchiveRequired !== true
  ) {
    issues.push('v3 outcome validation recovery or selection policy drifted');
  }
  if (
    JSON.stringify(instrument) !== JSON.stringify(readJson(validationRegistration?.instrument?.registrationPath)) ||
    validationRegistration?.authorization?.goRequestPrepared !== false ||
    validationRegistration?.authorization?.modelCallsAuthorized !== false ||
    validationRegistration?.authorization?.liveRunAuthorized !== false
  ) {
    issues.push('v3 outcome validation HOLD boundary drifted');
  }
  return { valid: issues.length === 0, issues, digestRecords };
}

export function loadTutorStubResistanceRecoverySemanticValidationV3() {
  const registrationPath = TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_REGISTRATION_V3;
  const registration = readJson(registrationPath);
  const instrumentPath = registration.instrument.registrationPath;
  const instrument = readJson(instrumentPath);
  const corpus = readJson(registration.heldout.corpusPath);
  const instrumentValidation = validateTutorStubResistanceRecoverySemanticRegistrationV3(instrument);
  const corpusValidation = validateTutorStubResistanceRecoverySemanticCorpus(corpus);
  const bindingValidation = validateTutorStubResistanceRecoverySemanticValidationRegistrationV3({
    validationRegistration: registration,
    instrument,
    corpus,
  });
  const issues = [...instrumentValidation.issues, ...corpusValidation.issues, ...bindingValidation.issues];
  if (issues.length) throw new Error(`v3 outcome semantic validation invalid: ${issues.join('; ')}`);
  return {
    registration,
    registrationPath,
    registrationSha256: fileSha256(registrationPath),
    instrument,
    instrumentPath,
    instrumentSha256: fileSha256(instrumentPath),
    corpus,
    corpusSha256: fileSha256(registration.heldout.corpusPath),
    digestRecords: [...instrumentValidation.digestRecords, ...bindingValidation.digestRecords],
  };
}
