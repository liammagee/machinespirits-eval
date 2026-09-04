import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { recordFileDigest } from './recordedFileDigest.js';
import { resolveTutorStubArtifactArchiveDirectory } from './tutorStubArtifactArchive.js';
import {
  isTutorStubRetryableClaudeResponseFreeError,
  tutorStubCliPolicyRetryDecision,
  waitTutorStubCliPolicyRetryDelay,
} from './tutorStubCliPolicyRetry.js';
import {
  TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_OUTPUT_SCHEMA,
  adjudicateTutorStubResistanceRecoverySemanticJudges,
  buildTutorStubResistanceRecoverySemanticPrompt,
  scoreTutorStubResistanceRecoverySemanticCorpus,
  tutorStubResistanceRecoverySemanticPromptSha256,
  tutorStubResistanceRecoverySemanticSha256,
  wrapTutorStubResistanceRecoverySemanticModelOutput,
} from './tutorStubResistanceRecoverySemanticAdjudicationV2.js';
import {
  adjudicateTutorStubResistanceRecoverySemanticJudgesV3,
  scoreTutorStubResistanceRecoverySemanticCorpusV3,
} from './tutorStubResistanceRecoverySemanticAdjudicationV3.js';
import {
  TUTOR_STUB_RESISTANCE_FIDELITY_OUTPUT_SCHEMA_V5,
  TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_OUTPUT_SCHEMA_V5,
  adjudicateTutorStubResistanceFidelityPanelV5,
  adjudicateTutorStubResistanceRecoveryPrimaryPanelV5,
  buildTutorStubResistanceFidelityPromptV5,
  buildTutorStubResistanceRecoveryPrimaryPromptV5,
  scoreTutorStubResistanceMeasurementCorpusV5,
  tutorStubResistanceMeasurementSha256,
  wrapTutorStubResistanceMeasurementModelOutputV5,
} from './tutorStubResistanceRecoverySemanticAdjudicationV5.js';
import {
  TUTOR_STUB_RESISTANCE_FIDELITY_OUTPUT_SCHEMA_V6,
  TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_OUTPUT_SCHEMA_V6,
  adjudicateTutorStubResistanceFidelityPanelV6,
  adjudicateTutorStubResistanceRecoveryPrimaryPanelV6,
  buildTutorStubResistanceFidelityPromptV6,
  buildTutorStubResistanceRecoveryPrimaryPromptV6,
  scoreTutorStubResistanceMeasurementCorpusV6,
  tutorStubResistanceMeasurementSha256 as tutorStubResistanceMeasurementSha256V6,
  wrapTutorStubResistanceMeasurementModelOutputV6,
} from './tutorStubResistanceRecoverySemanticAdjudicationV6.js';
import {
  TUTOR_STUB_RESISTANCE_FIDELITY_OUTPUT_SCHEMA_V7,
  TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_OUTPUT_SCHEMA_V7,
  adjudicateTutorStubResistanceFidelityPanelV7,
  adjudicateTutorStubResistanceRecoveryPrimaryPanelV7,
  buildTutorStubResistanceFidelityPromptV7,
  buildTutorStubResistanceRecoveryPrimaryPromptV7,
  scoreTutorStubResistanceMeasurementCorpusV7,
  tutorStubResistanceMeasurementSha256 as tutorStubResistanceMeasurementSha256V7,
  wrapTutorStubResistanceMeasurementModelOutputV7,
} from './tutorStubResistanceRecoverySemanticAdjudicationV7.js';
import {
  TUTOR_STUB_RESISTANCE_FIDELITY_OUTPUT_SCHEMA_V8,
  TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_OUTPUT_SCHEMA_V8,
  adjudicateTutorStubResistanceFidelityPanelV8,
  adjudicateTutorStubResistanceRecoveryPrimaryPanelV8,
  buildTutorStubResistanceFidelityPromptV8,
  buildTutorStubResistanceRecoveryPrimaryPromptV8,
  scoreTutorStubResistanceMeasurementCorpusV8,
  tutorStubResistanceMeasurementSha256 as tutorStubResistanceMeasurementSha256V8,
  wrapTutorStubResistanceMeasurementModelOutputV8,
} from './tutorStubResistanceRecoverySemanticAdjudicationV8.js';
import {
  buildTutorStubResistanceRecoverySemanticBlindedValidationCases,
  loadTutorStubResistanceRecoverySemanticValidation,
  tutorStubResistanceRecoverySemanticOpaqueCaseId,
} from './tutorStubResistanceRecoverySemanticValidation.js';
import {
  TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_REGISTRATION_V3,
  loadTutorStubResistanceRecoverySemanticValidationV3,
} from './tutorStubResistanceRecoverySemanticValidationV3.js';
import {
  TUTOR_STUB_RESISTANCE_FIDELITY_VALIDATION_REGISTRATION_V5,
  TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_VALIDATION_REGISTRATION_V5,
  loadTutorStubResistanceMeasurementValidationV5,
} from './tutorStubResistanceRecoverySemanticValidationV5.js';
import {
  TUTOR_STUB_RESISTANCE_FIDELITY_VALIDATION_REGISTRATION_V6,
  TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_VALIDATION_REGISTRATION_V6,
  loadTutorStubResistanceMeasurementValidationV6,
} from './tutorStubResistanceRecoverySemanticValidationV6.js';
import {
  TUTOR_STUB_RESISTANCE_FIDELITY_VALIDATION_REGISTRATION_V7,
  TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_VALIDATION_REGISTRATION_V7,
  loadTutorStubResistanceMeasurementValidationV7,
} from './tutorStubResistanceRecoverySemanticValidationV7.js';
import {
  TUTOR_STUB_RESISTANCE_FIDELITY_VALIDATION_REGISTRATION_V8,
  TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_VALIDATION_REGISTRATION_V8,
  loadTutorStubResistanceMeasurementValidationV8,
} from './tutorStubResistanceRecoverySemanticValidationV8.js';

export const TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_SYSTEM_PROMPT =
  'Independently judge only the supplied public dialogue packet under the frozen response schema. Do not use tools, hidden state, lexical heuristics, profile labels, assignments, gold labels, or another judge response. Return only schema-valid JSON.';
export const TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_PLAN_SCHEMA =
  'machinespirits.tutor-stub.resistance-recovery-semantic-validation-plan.v2';
export const TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_CHECKPOINT_SCHEMA =
  'machinespirits.tutor-stub.resistance-recovery-semantic-validation-case-checkpoint.v2';
export const TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_SEAL_SCHEMA =
  'machinespirits.tutor-stub.resistance-recovery-semantic-validation-seal.v2';
export const TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_REPORT_SCHEMA =
  'machinespirits.tutor-stub.resistance-recovery-semantic-validation-report.v2';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PACKET_FIELDS = ['trigger', 'intervention', 'prior_post_trigger', 'intervening_tutor', 'current_learner'];

export function loadTutorStubResistanceRecoverySemanticValidationForRegistration(validationRegistration) {
  if (validationRegistration === TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_REGISTRATION_V3) {
    return loadTutorStubResistanceRecoverySemanticValidationV3();
  }
  if (
    [
      TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_VALIDATION_REGISTRATION_V5,
      TUTOR_STUB_RESISTANCE_FIDELITY_VALIDATION_REGISTRATION_V5,
    ].includes(validationRegistration)
  ) {
    return loadTutorStubResistanceMeasurementValidationV5(validationRegistration);
  }
  if (
    [
      TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_VALIDATION_REGISTRATION_V6,
      TUTOR_STUB_RESISTANCE_FIDELITY_VALIDATION_REGISTRATION_V6,
    ].includes(validationRegistration)
  ) {
    return loadTutorStubResistanceMeasurementValidationV6(validationRegistration);
  }
  if (
    [
      TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_VALIDATION_REGISTRATION_V7,
      TUTOR_STUB_RESISTANCE_FIDELITY_VALIDATION_REGISTRATION_V7,
    ].includes(validationRegistration)
  ) {
    return loadTutorStubResistanceMeasurementValidationV7(validationRegistration);
  }
  if (
    [
      TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_VALIDATION_REGISTRATION_V8,
      TUTOR_STUB_RESISTANCE_FIDELITY_VALIDATION_REGISTRATION_V8,
    ].includes(validationRegistration)
  ) {
    return loadTutorStubResistanceMeasurementValidationV8(validationRegistration);
  }
  return loadTutorStubResistanceRecoverySemanticValidation();
}

function hierarchicalV3(loaded) {
  return loaded?.instrument?.version === 3;
}

function splitV5(loaded) {
  return loaded?.instrument?.version === 5 && ['primary_recovery', 'intervention_fidelity'].includes(loaded?.stage);
}

function splitV6(loaded) {
  return loaded?.instrument?.version === 6 && ['primary_recovery', 'intervention_fidelity'].includes(loaded?.stage);
}

function splitV7(loaded) {
  return loaded?.instrument?.version === 7 && ['primary_recovery', 'intervention_fidelity'].includes(loaded?.stage);
}

function splitV8(loaded) {
  return loaded?.instrument?.version === 8 && ['primary_recovery', 'intervention_fidelity'].includes(loaded?.stage);
}

function splitMeasurement(loaded) {
  return splitV5(loaded) || splitV6(loaded) || splitV7(loaded) || splitV8(loaded);
}

function panelMayContinueAfterTerminalSeat(loaded) {
  return hierarchicalV3(loaded) || splitMeasurement(loaded);
}

function adjudicateLoaded(loaded, options) {
  if (splitV8(loaded)) {
    return loaded.stage === 'primary_recovery'
      ? adjudicateTutorStubResistanceRecoveryPrimaryPanelV8(options)
      : adjudicateTutorStubResistanceFidelityPanelV8(options);
  }
  if (splitV7(loaded)) {
    return loaded.stage === 'primary_recovery'
      ? adjudicateTutorStubResistanceRecoveryPrimaryPanelV7(options)
      : adjudicateTutorStubResistanceFidelityPanelV7(options);
  }
  if (splitV6(loaded)) {
    return loaded.stage === 'primary_recovery'
      ? adjudicateTutorStubResistanceRecoveryPrimaryPanelV6(options)
      : adjudicateTutorStubResistanceFidelityPanelV6(options);
  }
  if (splitV5(loaded)) {
    return loaded.stage === 'primary_recovery'
      ? adjudicateTutorStubResistanceRecoveryPrimaryPanelV5(options)
      : adjudicateTutorStubResistanceFidelityPanelV5(options);
  }
  return hierarchicalV3(loaded)
    ? adjudicateTutorStubResistanceRecoverySemanticJudgesV3(options)
    : adjudicateTutorStubResistanceRecoverySemanticJudges(options);
}

function scoreLoaded(loaded, options) {
  if (splitV8(loaded)) return scoreTutorStubResistanceMeasurementCorpusV8(options);
  if (splitV7(loaded)) return scoreTutorStubResistanceMeasurementCorpusV7(options);
  if (splitV6(loaded)) return scoreTutorStubResistanceMeasurementCorpusV6(options);
  if (splitV5(loaded)) return scoreTutorStubResistanceMeasurementCorpusV5(options);
  return hierarchicalV3(loaded)
    ? scoreTutorStubResistanceRecoverySemanticCorpusV3(options)
    : scoreTutorStubResistanceRecoverySemanticCorpus(options);
}

function validateHierarchicalV3GoRequest({ loaded, goRequest, sourceCommit, sourceTree, destination }) {
  if (!hierarchicalV3(loaded)) return;
  const readiness = loaded.registration.executionReadiness;
  const gate = goRequest?.outcomeSemanticAdjudicationValidation || {};
  const expectedJudges = loaded.instrument.measurement.judges.map((judge) => judge.modelRef);
  recordFileDigest({
    root: ROOT,
    filePath: loaded.registrationPath,
    recordedSha256: gate.validationRegistration?.sha256,
    label: 'v3 outcome semantic validation registration',
  });
  recordFileDigest({
    root: ROOT,
    filePath: loaded.instrumentPath,
    recordedSha256: gate.instrumentRegistration?.sha256,
    label: 'v3 outcome semantic instrument registration',
  });
  if (
    goRequest?.schema !==
      'machinespirits.tutor-stub.resistance-recovery-semantic-adjudication-validation-study-go-request.v3' ||
    goRequest?.status !== 'go_under_standing_user_authority' ||
    goRequest?.source?.launchCommit !== sourceCommit ||
    goRequest?.source?.launchTree !== sourceTree ||
    goRequest?.source?.headMustEqualLaunchCommit !== true ||
    goRequest?.source?.checkoutMustBeClean !== true ||
    goRequest?.source?.detachedLaunchWorktree !== true ||
    gate.validationRegistration?.path !== loaded.registrationPath ||
    gate.instrumentRegistration?.path !== loaded.instrumentPath ||
    gate.heldoutCorpus?.path !== loaded.registration.heldout.corpusPath ||
    gate.heldoutCorpus?.sha256 !== loaded.corpusSha256 ||
    gate.heldoutCorpus?.cases !== 120 ||
    JSON.stringify(gate.judges) !== JSON.stringify(expectedJudges) ||
    gate.primaryRule !== 'two_of_three_valid_high_confidence_final_recovery_votes' ||
    gate.componentRule !== 'two_of_three_valid_high_confidence_field_values_independently' ||
    gate.componentDisagreementMayVetoPrimary !== false ||
    gate.invalidLowConfidenceMissingOrResponseFreeDisposition !== 'judge_abstention' ||
    gate.regexOrKeywordAuthority !== 'none' ||
    gate.noInterimAnalysis !== true ||
    goRequest?.budget?.plannedCases !== readiness.plannedCases ||
    goRequest?.budget?.plannedModelCalls !== readiness.plannedModelCalls ||
    goRequest?.budget?.maximumReservationsPerPlannedCall !== readiness.maximumReservationsPerPlannedCall ||
    goRequest?.budget?.maximumPlannedModelAttempts !== readiness.hardValidationReservations ||
    goRequest?.budget?.programmeLedgerBefore !== readiness.programmeLedgerBefore ||
    goRequest?.budget?.programmeLedgerAfterMaximum !== readiness.programmeMaximumAfterValidation ||
    goRequest?.budget?.programmeCeiling !== readiness.programmeCeiling ||
    goRequest?.budget?.retryOrResumeAuthority !== 'bounded_technical_recovery' ||
    path.resolve(String(goRequest?.destination?.artifactRoot || '')) !== destination ||
    goRequest?.destination?.createOnce !== true ||
    goRequest?.destination?.mustNotExistBeforeLaunch !== true ||
    goRequest?.authorization?.confirmationAuthorized !== false ||
    goRequest?.claimBoundary?.validationOnly !== true ||
    goRequest?.claimBoundary?.validationOutcomesExcludedFromConfirmation !== true ||
    goRequest?.claimBoundary?.confirmationCallsAuthorized !== false
  ) {
    throw new Error('v3 outcome semantic validation GO request binding drifted');
  }
}

function validateSplitMeasurementGoRequest({ loaded, goRequest, sourceCommit, sourceTree, destination }) {
  if (!splitMeasurement(loaded)) return;
  const version = loaded.instrument.version;
  const stage = goRequest?.measurementValidation?.stages?.[loaded.stage];
  const expectedJudges = loaded.instrument.measurement.judges.map((judge) => judge.modelRef);
  recordFileDigest({
    root: ROOT,
    filePath: loaded.instrumentPath,
    recordedSha256: goRequest?.measurementValidation?.instrumentRegistration?.sha256,
    label: `v${version} split measurement instrument registration`,
  });
  recordFileDigest({
    root: ROOT,
    filePath: loaded.registrationPath,
    recordedSha256: stage?.registration?.sha256,
    label: `v${version} ${loaded.stage} validation registration`,
  });
  if (
    goRequest?.schema !== `machinespirits.tutor-stub.resistance-measurement-validation-study-go-request.v${version}` ||
    goRequest?.status !== 'go_under_standing_user_authority' ||
    goRequest?.source?.launchCommit !== sourceCommit ||
    goRequest?.source?.launchTree !== sourceTree ||
    goRequest?.source?.headMustEqualLaunchCommit !== true ||
    goRequest?.source?.checkoutMustBeClean !== true ||
    goRequest?.source?.detachedLaunchWorktree !== true ||
    goRequest?.measurementValidation?.instrumentRegistration?.path !== loaded.instrumentPath ||
    goRequest?.measurementValidation?.heldoutCorpus?.path !== loaded.corpusPath ||
    goRequest?.measurementValidation?.heldoutCorpus?.sha256 !== loaded.corpusSha256 ||
    goRequest?.measurementValidation?.heldoutCorpus?.cases !== 120 ||
    JSON.stringify(goRequest?.measurementValidation?.judges) !== JSON.stringify(expectedJudges) ||
    goRequest?.measurementValidation?.primaryAndFidelityCallsSeparate !== true ||
    goRequest?.measurementValidation?.fidelityLearnerOutcomeVisible !== false ||
    goRequest?.measurementValidation?.regexKeywordOrGeneratorAuthority !== 'none' ||
    goRequest?.measurementValidation?.mediumOrHighDeterminateVotesEligible !== true ||
    (version >= 6 && goRequest?.measurementValidation?.fieldLocalEligibility !== true) ||
    (version >= 6 && goRequest?.measurementValidation?.modelReturnsFinalRecovery !== false) ||
    (version >= 8 && goRequest?.measurementValidation?.stagesRunSequentially !== true) ||
    (version >= 8 &&
      JSON.stringify(goRequest?.measurementValidation?.responseFreeRetryDelaysMs) !== JSON.stringify([15000, 45000])) ||
    (version >= 8 && goRequest?.measurementValidation?.failureDiagnosticsPersistedToAttemptRecord !== true) ||
    goRequest?.measurementValidation?.indeterminateRepairRerunReplacementOrSelection !== false ||
    goRequest?.measurementValidation?.analysisOnlyAfterBothStagesSeal !== true ||
    stage?.registration?.path !== loaded.registrationPath ||
    path.resolve(String(stage?.destination || '')) !== destination ||
    stage?.plannedCalls !== 360 ||
    stage?.hardReservations !== 1080 ||
    stage?.createOnce !== true ||
    goRequest?.budget?.plannedCalls !== 720 ||
    goRequest?.budget?.hardValidationReservations !== 2160 ||
    goRequest?.budget?.programmeLedgerBefore !==
      loaded.instrument.budget[`programmeLedgerBeforeV${version}Validation`] ||
    goRequest?.budget?.programmeMaximumAfterValidation !== loaded.instrument.budget.programmeMaximumAfterValidation ||
    goRequest?.budget?.programmeCeiling !== 10000 ||
    goRequest?.budget?.attemptCountsRole !== 'operational_safeguard_only_not_design_objective' ||
    goRequest?.authorization?.validationModelCallsAuthorized !== true ||
    goRequest?.authorization?.confirmationModelCallsAuthorized !== false ||
    goRequest?.authorization?.boundedTechnicalRecovery !==
      'response_free_missing_or_failed_units_only_no_semantic_recall' ||
    goRequest?.claimBoundary?.validationOnly !== true ||
    goRequest?.claimBoundary?.validationOutcomesExcludedFromConfirmation !== true ||
    goRequest?.claimBoundary?.noEfficacyNullLearningTransferHumanOrCellClaim !== true
  ) {
    throw new Error(`v${version} split resistance measurement validation GO request binding drifted`);
  }
}

function validateV8LiveStageOrder({ loaded, goRequest, resume, plan }) {
  if (!splitV8(loaded)) return;
  const stages = goRequest.measurementValidation.stages;
  const primaryDestination = path.resolve(String(stages.primary_recovery.destination));
  const fidelityDestination = path.resolve(String(stages.intervention_fidelity.destination));
  if (primaryDestination === fidelityDestination) throw new Error('V8 stage destinations must be distinct');
  if (loaded.stage === 'primary_recovery') {
    if (!resume && fs.existsSync(fidelityDestination)) {
      throw new Error('V8 fidelity destination must not exist before the primary stage seals');
    }
    return;
  }
  const primaryPlanFile = path.join(primaryDestination, 'plan.json');
  const primarySealFile = path.join(primaryDestination, 'seal.json');
  if (!fs.existsSync(primaryPlanFile) || !fs.existsSync(primarySealFile)) {
    throw new Error('V8 fidelity stage cannot launch before the primary stage seals');
  }
  const primaryPlan = read(primaryPlanFile);
  const primarySeal = read(primarySealFile);
  if (
    primaryPlan.schema !== TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_PLAN_SCHEMA ||
    primaryPlan.measurement_stage !== 'primary_recovery' ||
    primaryPlan.destination !== primaryDestination ||
    !exact(primaryPlan.source, plan.source) ||
    !exact(primaryPlan.authorization, plan.authorization) ||
    !exact(primaryPlan.instrument, plan.instrument) ||
    !exact(primaryPlan.heldout, plan.heldout) ||
    primarySeal.schema !== TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_SEAL_SCHEMA ||
    primarySeal.plan_sha256 !== primaryPlan.plan_sha256 ||
    primarySeal.cases !== 120 ||
    primarySeal.gold_joined !== false
  ) {
    throw new Error('V8 primary stage seal is invalid');
  }
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

function digest(value) {
  return tutorStubResistanceRecoverySemanticSha256(Buffer.isBuffer(value) ? value : JSON.stringify(canonical(value)));
}

function exact(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function bytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

function createOrVerify(file, value, label) {
  const expected = bytes(value);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, expected, { flag: 'wx' });
  else if (!fs.readFileSync(file).equals(expected)) throw new Error(`${label} exists with noncanonical bytes`);
}

function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${crypto.randomUUID()}`;
  fs.writeFileSync(temporary, bytes(value), { flag: 'wx' });
  fs.renameSync(temporary, file);
}

function read(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function packet(row) {
  return Object.fromEntries(PACKET_FIELDS.map((field) => [field, row[field]]));
}

function measurementPacket(loaded, row) {
  return splitMeasurement(loaded) && loaded.stage === 'intervention_fidelity'
    ? { intervention: row.intervention }
    : packet(row);
}

function checkpointArchiveStage(checkpoint) {
  if (checkpoint.status === 'pending') return 'checkpoint_initialized';
  if (checkpoint.status === 'judge_in_flight') {
    const latest = Object.values(checkpoint.attempts_by_judge || {})
      .flat()
      .at(-1);
    if (latest?.status === 'prepared_not_dispatched') return 'checkpoint_prepared';
    if (latest?.status === 'dispatched') return 'checkpoint_dispatched';
  }
  if (checkpoint.status === 'judge_checkpointed') {
    const outcome = checkpoint.judge_results.at(-1)?.outcome;
    if (outcome === 'recorded_response') return 'checkpoint_returned';
    if (outcome === 'invalid_return') return 'checkpoint_invalid';
    if (outcome === 'transport_failed') return 'checkpoint_transport_failed';
  }
  if (checkpoint.status === 'sealed') {
    if (checkpoint.judge_results.at(-1)?.outcome === 'dispatch_ambiguous_no_recall') {
      return 'checkpoint_dispatch_ambiguous_sealed';
    }
    if (checkpoint.resumed_partial_without_rejudge) return 'checkpoint_partial_sealed';
    return 'checkpoint_sealed';
  }
  throw new Error(`cannot reconcile outcome validation checkpoint stage ${checkpoint.status}`);
}

function attemptCount(checkpoints) {
  return checkpoints.reduce(
    (sum, checkpoint) => sum + Object.values(checkpoint.attempts_by_judge || {}).flat().length,
    0,
  );
}

function loadExistingCheckpoints(destination, caseIds) {
  return caseIds.flatMap((caseId) => {
    const file = caseFile(destination, caseId);
    return fs.existsSync(file) ? [read(file)] : [];
  });
}

function originalCase(loaded, executionId) {
  return loaded.corpus.cases.find((row) => tutorStubResistanceRecoverySemanticOpaqueCaseId(row) === executionId);
}

function archiveFor({ archiveDir, plan, resume, afterEntry }) {
  const base = resolveTutorStubArtifactArchiveDirectory(archiveDir, { repoRoot: process.cwd() });
  if (!base) throw new Error('outcome semantic validation requires a durable private archive');
  const root = path.join(
    base,
    'artifacts/tutor-stub-live/resistance-recovery-semantic-validation',
    `${plan.authorization.go_request_sha256.slice(0, 16)}-${plan.plan_sha256.slice(0, 16)}`,
  );
  const manifestFile = path.join(root, 'archive-manifest.json');
  if (!resume) {
    fs.mkdirSync(path.dirname(root), { recursive: true });
    fs.mkdirSync(root, { recursive: false });
    createOrVerify(
      manifestFile,
      {
        schema: 'machinespirits.tutor-stub.resistance-recovery-semantic-validation-archive.v1',
        plan_sha256: plan.plan_sha256,
        source: plan.source,
        entries: [],
      },
      'outcome archive manifest',
    );
  }
  if (!fs.existsSync(manifestFile)) throw new Error('outcome semantic validation archive is absent');
  function append(stage, logicalPath, value) {
    const content = bytes(value);
    const sha256 = digest(content);
    const transition = digest(`${stage}\0${logicalPath}\0${sha256}`);
    const relative = `entries/${transition}.json`;
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!fs.existsSync(target)) fs.writeFileSync(target, content, { flag: 'wx' });
    else if (!fs.readFileSync(target).equals(content)) throw new Error('outcome archive transition collision');
    afterEntry?.({ stage, logicalPath, transition, target });
    const manifest = read(manifestFile);
    const existing = manifest.entries.find((entry) => entry.transition === transition);
    if (existing) {
      if (
        existing.stage !== stage ||
        existing.logical_path !== logicalPath ||
        existing.path !== relative ||
        existing.bytes !== content.length ||
        existing.sha256 !== sha256
      ) {
        throw new Error('outcome archive transition manifest drifted');
      }
      return;
    }
    manifest.entries.push({
      sequence: manifest.entries.length + 1,
      transition,
      stage,
      logical_path: logicalPath,
      path: relative,
      bytes: content.length,
      sha256,
    });
    atomicWrite(manifestFile, manifest);
  }
  function localArchiveCandidates(localRoot) {
    const candidates = [];
    for (const logicalPath of ['plan.json', 'seal.json', 'report.json']) {
      const file = path.join(localRoot, logicalPath);
      if (!fs.existsSync(file)) continue;
      candidates.push({ logicalPath, file, stage: logicalPath.split('.')[0], value: read(file) });
    }
    const casesRoot = path.join(localRoot, 'cases');
    if (fs.existsSync(casesRoot)) {
      for (const caseId of fs.readdirSync(casesRoot)) {
        const logicalPath = `cases/${caseId}/checkpoint.json`;
        const file = path.join(localRoot, logicalPath);
        if (!fs.existsSync(file)) continue;
        const value = read(file);
        candidates.push({ logicalPath, file, stage: checkpointArchiveStage(value), value });
      }
    }
    return candidates;
  }
  function verify({
    localRoot = null,
    requireCurrentLocalTransitions = false,
    allowUnmanifestedEntryFiles = false,
    allowedUnmanifestedTransitions = null,
  } = {}) {
    const manifest = read(manifestFile);
    const issues = [];
    const manifestKeys = ['schema', 'plan_sha256', 'source', 'entries'];
    if (
      !exact(Object.keys(manifest).sort(), manifestKeys.sort()) ||
      manifest.schema !== 'machinespirits.tutor-stub.resistance-recovery-semantic-validation-archive.v1' ||
      manifest.plan_sha256 !== plan.plan_sha256 ||
      !exact(manifest.source, plan.source) ||
      !Array.isArray(manifest.entries)
    ) {
      return { valid: false, issues: ['outcome archive manifest binding or keys drifted'], manifest };
    }
    const entryKeys = ['sequence', 'transition', 'stage', 'logical_path', 'path', 'bytes', 'sha256'];
    const checkpointStages = new Set([
      'checkpoint_initialized',
      'checkpoint_prepared',
      'checkpoint_dispatched',
      'checkpoint_returned',
      'checkpoint_invalid',
      'checkpoint_transport_failed',
      'checkpoint_sealed',
      'checkpoint_partial_sealed',
      'checkpoint_dispatch_ambiguous_sealed',
    ]);
    const terminalCheckpointStages = new Set([
      'checkpoint_sealed',
      'checkpoint_partial_sealed',
      'checkpoint_dispatch_ambiguous_sealed',
    ]);
    const seenTransitions = new Set();
    const seenSequences = new Set();
    for (const [index, entry] of manifest.entries.entries()) {
      const expectedTransition = digest(`${entry.stage}\0${entry.logical_path}\0${entry.sha256}`);
      const expectedPath = `entries/${expectedTransition}.json`;
      const checkpointLogical = /^cases\/[a-z0-9-]+\/checkpoint\.json$/u.test(entry.logical_path);
      const stageLogicalValid =
        (entry.stage === 'plan' && entry.logical_path === 'plan.json') ||
        (entry.stage === 'seal' && entry.logical_path === 'seal.json') ||
        (entry.stage === 'report' && entry.logical_path === 'report.json') ||
        (checkpointStages.has(entry.stage) && checkpointLogical);
      if (
        !exact(Object.keys(entry).sort(), entryKeys.sort()) ||
        entry.sequence !== index + 1 ||
        seenSequences.has(entry.sequence) ||
        seenTransitions.has(entry.transition) ||
        entry.transition !== expectedTransition ||
        entry.path !== expectedPath ||
        !stageLogicalValid ||
        !Number.isInteger(entry.bytes) ||
        entry.bytes < 1 ||
        !/^[0-9a-f]{64}$/u.test(entry.sha256)
      ) {
        issues.push(`archive entry ${index + 1} topology drifted`);
      }
      seenSequences.add(entry.sequence);
      seenTransitions.add(entry.transition);
      const file = path.join(root, entry.path);
      const relative = path.relative(root, file);
      if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        issues.push(`archive entry ${entry.sequence} escapes root`);
      } else if (!fs.existsSync(file)) issues.push(`archive entry ${entry.sequence} is absent`);
      else {
        const archivedBytes = fs.readFileSync(file);
        if (archivedBytes.length !== entry.bytes || digest(archivedBytes) !== entry.sha256) {
          issues.push(`archive entry ${entry.sequence} byte metadata drifted`);
        } else if (entry.stage === 'plan') {
          if (!exact(read(file), plan)) issues.push(`archive entry ${entry.sequence} plan bytes drifted`);
        } else if (checkpointStages.has(entry.stage)) {
          const archivedCheckpoint = read(file);
          const caseId = entry.logical_path.split('/')[1];
          if (
            archivedCheckpoint.schema !== TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_CHECKPOINT_SCHEMA ||
            archivedCheckpoint.plan_sha256 !== plan.plan_sha256 ||
            archivedCheckpoint.case_id !== caseId ||
            checkpointArchiveStage(archivedCheckpoint) !== entry.stage
          ) {
            issues.push(`archive entry ${entry.sequence} checkpoint binding or stage drifted`);
          }
        }
      }
    }
    const entriesDirectory = path.join(root, 'entries');
    const archivedEntryFiles = fs.existsSync(entriesDirectory)
      ? fs
          .readdirSync(entriesDirectory, { withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) => `entries/${entry.name}`)
          .sort()
      : [];
    const manifestedEntryFiles = manifest.entries.map((entry) => entry.path).sort();
    const referencedFilesArePresent = manifestedEntryFiles.every((file) => archivedEntryFiles.includes(file));
    const unmanifestedTransitions = archivedEntryFiles
      .filter((file) => !manifestedEntryFiles.includes(file))
      .map((file) => path.basename(file, '.json'));
    const allowedUnmanifested =
      allowUnmanifestedEntryFiles ||
      (allowedUnmanifestedTransitions instanceof Set &&
        unmanifestedTransitions.every((transition) => allowedUnmanifestedTransitions.has(transition)));
    if (!referencedFilesArePresent || (!allowedUnmanifested && !exact(archivedEntryFiles, manifestedEntryFiles))) {
      issues.push('outcome archive entry inventory drifted');
    }
    if (localRoot) {
      for (const local of localArchiveCandidates(localRoot)) {
        const localBytes = fs.readFileSync(local.file);
        const localSha256 = digest(localBytes);
        if (
          !manifest.entries.some(
            (entry) =>
              entry.logical_path === local.logicalPath &&
              (requireCurrentLocalTransitions || !local.logicalPath.includes('/checkpoint.json')
                ? entry.stage === local.stage
                : terminalCheckpointStages.has(entry.stage)) &&
              entry.sha256 === localSha256 &&
              entry.bytes === localBytes.length,
          )
        ) {
          issues.push(`${local.logicalPath}: local final artifact has no byte-identical archive transition`);
        }
      }
    }
    return { valid: issues.length === 0, issues, manifest };
  }
  function reconcileResume(localRoot) {
    const initial = verify({ allowUnmanifestedEntryFiles: true });
    if (!initial.valid) throw new Error(initial.issues.join('; '));
    const candidates = localArchiveCandidates(localRoot);
    const expectedMissingTransitions = new Set(
      candidates.map((candidate) => {
        const sha256 = digest(fs.readFileSync(candidate.file));
        return digest(`${candidate.stage}\0${candidate.logicalPath}\0${sha256}`);
      }),
    );
    const entriesDirectory = path.join(root, 'entries');
    const manifestedTransitions = new Set(initial.manifest.entries.map((entry) => entry.transition));
    const orphanTransitions = fs.existsSync(entriesDirectory)
      ? fs
          .readdirSync(entriesDirectory, { withFileTypes: true })
          .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
          .map((entry) => entry.name.slice(0, -'.json'.length))
          .filter((transition) => !manifestedTransitions.has(transition))
      : [];
    if (orphanTransitions.some((transition) => !expectedMissingTransitions.has(transition))) {
      throw new Error('outcome archive contains a noncurrent orphan transition');
    }
    for (const candidate of candidates) append(candidate.stage, candidate.logicalPath, candidate.value);
    const reconciled = verify({ localRoot, requireCurrentLocalTransitions: true });
    if (!reconciled.valid) throw new Error(reconciled.issues.join('; '));
  }
  if (resume) {
    const initial = verify({ allowUnmanifestedEntryFiles: true });
    if (!initial.valid) throw new Error(initial.issues.join('; '));
  }
  return { append, verify, reconcileResume };
}

function caseFile(destination, caseId) {
  if (!/^[a-z0-9-]+$/u.test(caseId)) throw new Error('unsafe outcome validation case id');
  return path.join(destination, 'cases', caseId, 'checkpoint.json');
}

function promptsFor(loaded, row) {
  return Object.fromEntries(
    loaded.instrument.measurement.judges.map((judge) => [
      judge.id,
      splitMeasurement(loaded)
        ? loaded.stage === 'primary_recovery'
          ? (splitV8(loaded)
              ? buildTutorStubResistanceRecoveryPrimaryPromptV8
              : splitV7(loaded)
                ? buildTutorStubResistanceRecoveryPrimaryPromptV7
                : splitV6(loaded)
                  ? buildTutorStubResistanceRecoveryPrimaryPromptV6
                  : buildTutorStubResistanceRecoveryPrimaryPromptV5)({
              caseId: row.case_id,
              publicPacket: packet(row),
              judge,
            })
          : (splitV8(loaded)
              ? buildTutorStubResistanceFidelityPromptV8
              : splitV7(loaded)
                ? buildTutorStubResistanceFidelityPromptV7
                : splitV6(loaded)
                  ? buildTutorStubResistanceFidelityPromptV6
                  : buildTutorStubResistanceFidelityPromptV5)({
              caseId: row.case_id,
              intervention: row.intervention,
              judge,
            })
        : buildTutorStubResistanceRecoverySemanticPrompt({ caseId: row.case_id, publicPacket: packet(row), judge }),
    ]),
  );
}

function promptSha256(loaded, prompt) {
  if (splitV8(loaded)) return tutorStubResistanceMeasurementSha256V8(prompt);
  if (splitV7(loaded)) return tutorStubResistanceMeasurementSha256V7(prompt);
  if (splitV6(loaded)) return tutorStubResistanceMeasurementSha256V6(prompt);
  if (splitV5(loaded)) return tutorStubResistanceMeasurementSha256(prompt);
  return tutorStubResistanceRecoverySemanticPromptSha256(prompt);
}

function outputSchemaFor(loaded) {
  if (!splitMeasurement(loaded)) return TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_OUTPUT_SCHEMA;
  if (splitV8(loaded)) {
    return loaded.stage === 'primary_recovery'
      ? TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_OUTPUT_SCHEMA_V8
      : TUTOR_STUB_RESISTANCE_FIDELITY_OUTPUT_SCHEMA_V8;
  }
  if (splitV7(loaded)) {
    return loaded.stage === 'primary_recovery'
      ? TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_OUTPUT_SCHEMA_V7
      : TUTOR_STUB_RESISTANCE_FIDELITY_OUTPUT_SCHEMA_V7;
  }
  if (splitV6(loaded)) {
    return loaded.stage === 'primary_recovery'
      ? TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_OUTPUT_SCHEMA_V6
      : TUTOR_STUB_RESISTANCE_FIDELITY_OUTPUT_SCHEMA_V6;
  }
  return loaded.stage === 'primary_recovery'
    ? TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_OUTPUT_SCHEMA_V5
    : TUTOR_STUB_RESISTANCE_FIDELITY_OUTPUT_SCHEMA_V5;
}

function roleFor(loaded, judge) {
  return `tutor_stub_resistance_${splitMeasurement(loaded) ? loaded.stage : 'recovery_semantic'}_${judge.id}`;
}

export function buildTutorStubResistanceRecoverySemanticValidationPlan({
  sourceCommit,
  sourceTree,
  destination,
  goRequestPath,
  goRequestSha256,
  goRequest,
  loaded = loadTutorStubResistanceRecoverySemanticValidation(),
}) {
  if (!/^[0-9a-f]{40}$/u.test(sourceCommit) || !/^[0-9a-f]{40}$/u.test(sourceTree)) {
    throw new Error('outcome validation requires exact source commit and tree');
  }
  if (!path.isAbsolute(destination) || !goRequestPath || !/^[0-9a-f]{64}$/u.test(goRequestSha256)) {
    throw new Error('outcome validation requires absolute destination and digest-bound request');
  }
  validateHierarchicalV3GoRequest({ loaded, goRequest, sourceCommit, sourceTree, destination });
  validateSplitMeasurementGoRequest({ loaded, goRequest, sourceCommit, sourceTree, destination });
  const cases = buildTutorStubResistanceRecoverySemanticBlindedValidationCases(loaded.corpus.cases);
  const plan = {
    schema: TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_PLAN_SCHEMA,
    status: 'prospective_unlaunched',
    source: { commit: sourceCommit, tree: sourceTree, clean_required: true },
    destination,
    authorization: { go_request_path: goRequestPath, go_request_sha256: goRequestSha256 },
    durable_archive: { policy: 'required', immutable_transition_entries: true },
    registration: { path: loaded.registrationPath, sha256: loaded.registrationSha256 },
    instrument: { path: loaded.instrumentPath, sha256: loaded.instrumentSha256 },
    heldout: { path: loaded.registration.heldout.corpusPath, sha256: loaded.corpusSha256, cases: 120 },
    ...(splitMeasurement(loaded) ? { measurement_stage: loaded.stage } : {}),
    judges: loaded.instrument.measurement.judges.map((judge) => ({
      id: judge.id,
      model_ref: judge.modelRef,
      provider: judge.provider,
      model: judge.model,
      effort: judge.effort,
      maximum_reservations: 3,
    })),
    budget: splitMeasurement(loaded)
      ? {
          planned_calls: loaded.registration.executionReadiness.plannedModelCalls,
          hard_reservation_ceiling: loaded.registration.executionReadiness.hardStageReservations,
          programme_ledger_before_prospective_maximum:
            loaded.registration.executionReadiness.programmeLedgerBeforeProspectiveMaximum,
          programme_maximum_after_stage: loaded.registration.executionReadiness.programmeMaximumAfterStage,
          combined_validation_maximum_after_both_stages:
            loaded.registration.executionReadiness.combinedValidationMaximumAfterBothStages,
          programme_ceiling: loaded.registration.executionReadiness.programmeCeiling,
        }
      : hierarchicalV3(loaded)
        ? {
            planned_calls: loaded.registration.executionReadiness.plannedModelCalls,
            hard_reservation_ceiling: loaded.registration.executionReadiness.hardValidationReservations,
            programme_ledger_before: loaded.registration.executionReadiness.programmeLedgerBefore,
            programme_maximum_after_validation: loaded.registration.executionReadiness.programmeMaximumAfterValidation,
            programme_ceiling: loaded.registration.executionReadiness.programmeCeiling,
          }
        : {
            planned_calls: 240,
            hard_reservation_ceiling: 720,
            programme_maximum_after_both_validations: 1531,
            programme_ceiling: 5000,
          },
    lifecycle: {
      preserved_judge_recalled: false,
      never_prepared_peer_may_complete: true,
      dispatched_without_response_recalled: false,
      partial_case_restart: false,
      replacement: false,
      outcome_selection: false,
      gold_joined_only_after_seal: true,
    },
    cases: cases.map((row) => {
      const prompts = promptsFor(loaded, row);
      return {
        case_id: row.case_id,
        packet_sha256: prompts[loaded.instrument.measurement.judges[0].id].packet_sha256,
        prompt_sha256_by_judge: Object.fromEntries(
          loaded.instrument.measurement.judges.map((judge) => [judge.id, promptSha256(loaded, prompts[judge.id])]),
        ),
      };
    }),
  };
  plan.plan_sha256 = digest(plan);
  return plan;
}

function newCheckpoint(plan, row, loaded) {
  return {
    schema: TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_CHECKPOINT_SCHEMA,
    case_id: row.case_id,
    plan_sha256: plan.plan_sha256,
    public_packet_sha256: digest(measurementPacket(loaded, row)),
    packet_sha256: plan.cases.find((entry) => entry.case_id === row.case_id).packet_sha256,
    status: 'pending',
    attempts_by_judge: {},
    invocation_id_by_judge: {},
    judge_results: [],
    aggregate: null,
    aggregate_sha256: null,
    resumed_partial_without_rejudge: false,
  };
}

function persist(destination, checkpoint, archive, stage, hook) {
  const logical = `cases/${checkpoint.case_id}/checkpoint.json`;
  atomicWrite(caseFile(destination, checkpoint.case_id), checkpoint);
  hook?.({ stage, checkpoint });
  archive.append(stage, logical, checkpoint);
}

function aggregateCheckpoint(checkpoint, row, loaded, prompts) {
  const common = {
    caseId: row.case_id,
    responses: checkpoint.judge_results.map((result) => result.record).filter(Boolean),
    registration: loaded.instrument,
    prompts,
  };
  const aggregate = adjudicateLoaded(
    loaded,
    splitMeasurement(loaded) && loaded.stage === 'intervention_fidelity'
      ? { ...common, intervention: row.intervention }
      : { ...common, publicPacket: packet(row) },
  );
  return { ...checkpoint, status: 'sealed', aggregate, aggregate_sha256: digest(aggregate) };
}

function observed(result) {
  return {
    text: result.text,
    provider: result.provider || null,
    model: result.model || null,
    effort: result.effort || result.reasoningEffort || null,
    structured_output: result.structuredOutput === true,
    prohibited_tool_event_count: Number.isInteger(result.prohibitedToolEventCount)
      ? result.prohibitedToolEventCount
      : null,
    prohibited_tool_event_count_observed:
      Object.hasOwn(result, 'prohibitedToolEventCount') && Number.isInteger(result.prohibitedToolEventCount),
    model_attestation_basis: result.modelAttestationBasis || null,
    model_independently_attested: result.modelIndependentlyAttested === true,
  };
}

function cappedDiagnosticText(value) {
  const source = Buffer.from(String(value || ''));
  if (source.length <= 4096) return source.toString('utf8');
  let capped = source.subarray(0, 4096).toString('utf8');
  while (Buffer.byteLength(capped) > 4096) capped = capped.slice(0, -1);
  return capped;
}

function v8ResponseFreeAttemptDiagnostics(error) {
  if (!isTutorStubRetryableClaudeResponseFreeError(error)) return null;
  return {
    provider: 'claude-code',
    classification: 'response_free_error',
    reason: String(error.reason || 'unspecified'),
    response_free: true,
    exit_code: Number.isInteger(error.exitCode) ? error.exitCode : null,
    stdout_bytes: error.stdoutBytes,
    stderr_bytes: error.stderrBytes,
    stdout_sha256: error.stdoutSha256,
    stderr_sha256: error.stderrSha256,
    stdout_text: cappedDiagnosticText(error.stdoutText),
    stderr_text: cappedDiagnosticText(error.stderrText),
    stdout_text_truncated: error.stdoutTextTruncated === true,
    stderr_text_truncated: error.stderrTextTruncated === true,
  };
}

function wrapRaw({ raw, prompt, judge, independentRunId, loaded }) {
  if (splitMeasurement(loaded)) {
    const wrap = splitV8(loaded)
      ? wrapTutorStubResistanceMeasurementModelOutputV8
      : splitV7(loaded)
        ? wrapTutorStubResistanceMeasurementModelOutputV7
        : splitV6(loaded)
          ? wrapTutorStubResistanceMeasurementModelOutputV6
          : wrapTutorStubResistanceMeasurementModelOutputV5;
    return wrap({
      instrument: loaded.stage,
      modelOutput: JSON.parse(String(raw.text || '').trim()),
      prompt,
      judge,
      observedProvider: raw.provider,
      observedModel: raw.model,
      observedEffort: raw.effort,
      independentRunId,
      structuredOutput: raw.structured_output,
      prohibitedToolEvents: raw.prohibited_tool_event_count_observed ? raw.prohibited_tool_event_count : null,
      modelAttestationBasis: raw.model_attestation_basis,
      modelIndependentlyAttested: raw.model_independently_attested,
    });
  }
  return wrapTutorStubResistanceRecoverySemanticModelOutput({
    modelOutput: JSON.parse(String(raw.text || '').trim()),
    prompt,
    judge,
    observedProvider: raw.provider,
    observedModel: raw.model,
    observedEffort: raw.effort,
    independentRunId,
    structuredOutput: raw.structured_output,
    prohibitedToolEvents: raw.prohibited_tool_event_count_observed ? raw.prohibited_tool_event_count : null,
    modelAttestationBasis: raw.model_attestation_basis,
    modelIndependentlyAttested: raw.model_independently_attested,
  });
}

async function executeJudge({
  destination,
  plan,
  checkpoint,
  row,
  judge,
  prompt,
  callModel,
  resolveModelRef,
  waitForRetry,
  persistNow,
  afterPreparedCheckpoint,
  afterDispatchCheckpoint,
  allowClaudeResponseFreeError,
  loaded,
}) {
  const route = resolveModelRef(judge.modelRef);
  if (route.provider !== judge.provider || route.model !== judge.model) throw new Error('outcome judge route drifted');
  const result = {
    judge_id: judge.id,
    role: roleFor(loaded, judge),
    independent_run_id: checkpoint.invocation_id_by_judge[judge.id] || crypto.randomUUID(),
    prompt,
    prompt_sha256: promptSha256(loaded, prompt),
    attempts: checkpoint.attempts_by_judge[judge.id] || [],
    outcome: null,
    raw_response: null,
    record: null,
    invalid_reason: null,
  };
  checkpoint.invocation_id_by_judge[judge.id] = result.independent_run_id;
  checkpoint.attempts_by_judge[judge.id] = result.attempts;
  for (;;) {
    const prepared = result.attempts.at(-1)?.status === 'prepared_not_dispatched';
    if (!prepared) {
      const checkpoints = loadExistingCheckpoints(
        destination,
        plan.cases.map((entry) => entry.case_id),
      );
      if (attemptCount(checkpoints) >= plan.budget.hard_reservation_ceiling) {
        throw new Error('outcome semantic validation hard reservation ceiling exhausted');
      }
      if (result.attempts.length >= 3) {
        result.outcome = 'transport_failed';
        break;
      }
      result.attempts.push({ attempt: result.attempts.length + 1, status: 'prepared_not_dispatched' });
      checkpoint.status = 'judge_in_flight';
      persistNow('checkpoint_prepared');
      await afterPreparedCheckpoint?.({ caseId: row.case_id, judgeId: judge.id });
    }
    result.attempts.at(-1).status = 'dispatched';
    persistNow('checkpoint_dispatched');
    await afterDispatchCheckpoint?.({ caseId: row.case_id, judgeId: judge.id });
    try {
      const response = await callModel(
        { provider: route.provider, model: route.model },
        TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_SYSTEM_PROMPT,
        JSON.stringify(prompt),
        roleFor(loaded, judge),
        { effort: judge.effort, outputSchema: outputSchemaFor(loaded) },
      );
      result.attempts.at(-1).status = 'returned';
      result.raw_response = observed(response);
      try {
        result.record = wrapRaw({
          raw: result.raw_response,
          prompt,
          judge,
          independentRunId: result.independent_run_id,
          loaded,
        });
        result.outcome = 'recorded_response';
      } catch (error) {
        result.outcome = 'invalid_return';
        result.invalid_reason = error.message;
      }
      break;
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      result.attempts.at(-1).status = 'transport_failed';
      result.attempts.at(-1).error_code = error?.code || null;
      if (splitV8(loaded)) {
        const diagnostics = v8ResponseFreeAttemptDiagnostics(error);
        if (diagnostics) Object.assign(result.attempts.at(-1), diagnostics);
      }
      const retry = tutorStubCliPolicyRetryDecision(error, {
        retryCount: result.attempts.length - 1,
        allowClaudeResponseFreeError,
      });
      if (!retry.retry) {
        result.outcome = 'transport_failed';
        result.invalid_reason = error.message;
        break;
      }
      const retryDelayMs =
        splitV8(loaded) && isTutorStubRetryableClaudeResponseFreeError(error)
          ? loaded.instrument.transport.responseFreeRetryDelaysMs[result.attempts.length - 1]
          : retry.delay_ms;
      await waitForRetry(retryDelayMs);
    }
  }
  if (!result.outcome) result.outcome = 'transport_failed';
  checkpoint.judge_results.push(result);
  checkpoint.status = 'judge_checkpointed';
  persistNow(
    result.outcome === 'recorded_response'
      ? 'checkpoint_returned'
      : result.outcome === 'invalid_return'
        ? 'checkpoint_invalid'
        : 'checkpoint_transport_failed',
  );
}

export async function runTutorStubResistanceRecoverySemanticValidation({
  destination,
  sourceCommit,
  sourceTree,
  goRequestPath,
  goRequestSha256,
  goRequest,
  sourceDirty,
  archiveDir,
  resume = false,
  callModel,
  resolveModelRef,
  waitForRetry = waitTutorStubCliPolicyRetryDelay,
  afterPreparedCheckpoint,
  afterDispatchCheckpoint,
  afterJudgeCheckpoint,
  afterArchiveEntryWrite,
  afterLocalCheckpointWrite,
  afterSealLocalWrite,
  validationRegistration,
}) {
  if (sourceDirty !== false) throw new Error('outcome validation requires a clean source tree');
  if (typeof callModel !== 'function' || typeof resolveModelRef !== 'function') {
    throw new Error('outcome validation requires explicit model-call and route-resolution dependencies');
  }
  const loaded = loadTutorStubResistanceRecoverySemanticValidationForRegistration(validationRegistration);
  const plan = buildTutorStubResistanceRecoverySemanticValidationPlan({
    sourceCommit,
    sourceTree,
    destination,
    goRequestPath,
    goRequestSha256,
    goRequest,
    loaded,
  });
  validateV8LiveStageOrder({ loaded, goRequest, resume, plan });
  const planFile = path.join(destination, 'plan.json');
  const sealFile = path.join(destination, 'seal.json');
  const reportFile = path.join(destination, 'report.json');
  const archive = archiveFor({ archiveDir, plan, resume, afterEntry: afterArchiveEntryWrite });
  if (!resume) {
    fs.mkdirSync(destination, { recursive: false });
    createOrVerify(planFile, plan, 'outcome validation plan');
  } else if (!fs.existsSync(planFile) || !exact(read(planFile), plan)) {
    throw new Error('outcome validation resume plan drifted');
  }
  if (resume && fs.existsSync(reportFile) && !fs.existsSync(sealFile)) {
    throw new Error('outcome validation report exists without its required seal');
  }
  if (resume) archive.reconcileResume(destination);
  else archive.append('plan', 'plan.json', plan);
  if (resume && fs.existsSync(sealFile)) {
    const checkpoints = loadExistingCheckpoints(
      destination,
      plan.cases.map((row) => row.case_id),
    );
    const seal = {
      schema: TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_SEAL_SCHEMA,
      plan_sha256: plan.plan_sha256,
      cases: 120,
      judge_results: checkpoints.reduce((sum, row) => sum + row.judge_results.length, 0),
      reservations: attemptCount(checkpoints),
      case_checkpoint_sha256: Object.fromEntries(checkpoints.map((row) => [row.case_id, digest(row)])),
      gold_joined: false,
    };
    createOrVerify(sealFile, seal, 'outcome validation seal');
    archive.append('seal', 'seal.json', seal);
    const verified = archive.verify({ localRoot: destination });
    if (!verified.valid) throw new Error(verified.issues.join('; '));
    return { plan, seal };
  }
  const cases = buildTutorStubResistanceRecoverySemanticBlindedValidationCases(loaded.corpus.cases);
  for (const blinded of cases) {
    const source = originalCase(loaded, blinded.case_id);
    const row = { ...source, case_id: blinded.case_id };
    const file = caseFile(destination, row.case_id);
    let checkpoint = fs.existsSync(file) ? read(file) : newCheckpoint(plan, row, loaded);
    const persistNow = (stage) => persist(destination, checkpoint, archive, stage, afterLocalCheckpointWrite);
    if (!fs.existsSync(file)) persistNow('checkpoint_initialized');
    else archive.append(checkpointArchiveStage(checkpoint), `cases/${checkpoint.case_id}/checkpoint.json`, checkpoint);
    if (checkpoint.status === 'sealed') continue;
    const prompts = promptsFor(loaded, row);
    const ambiguous = loaded.instrument.measurement.judges.find(
      (judge) =>
        checkpoint.attempts_by_judge[judge.id]?.at(-1)?.status === 'dispatched' &&
        !checkpoint.judge_results.some((result) => result.judge_id === judge.id),
    );
    if (ambiguous) {
      checkpoint.judge_results.push({
        judge_id: ambiguous.id,
        role: roleFor(loaded, ambiguous),
        independent_run_id: checkpoint.invocation_id_by_judge[ambiguous.id],
        prompt: prompts[ambiguous.id],
        prompt_sha256: promptSha256(loaded, prompts[ambiguous.id]),
        attempts: checkpoint.attempts_by_judge[ambiguous.id],
        outcome: 'dispatch_ambiguous_no_recall',
        raw_response: null,
        record: null,
        invalid_reason: 'dispatched response was not durably recorded; recall is forbidden',
      });
    }
    const hasTerminalSeat = checkpoint.judge_results.some((result) => result.outcome !== 'recorded_response');
    if (!panelMayContinueAfterTerminalSeat(loaded) && (ambiguous || hasTerminalSeat)) {
      checkpoint.resumed_partial_without_rejudge = true;
    } else {
      if (ambiguous || hasTerminalSeat) checkpoint.resumed_partial_without_rejudge = true;
      for (const judge of loaded.instrument.measurement.judges) {
        if (checkpoint.judge_results.some((result) => result.judge_id === judge.id)) continue;
        await executeJudge({
          destination,
          plan,
          checkpoint,
          row,
          judge,
          prompt: prompts[judge.id],
          callModel,
          resolveModelRef,
          waitForRetry,
          persistNow,
          afterPreparedCheckpoint,
          afterDispatchCheckpoint,
          allowClaudeResponseFreeError: panelMayContinueAfterTerminalSeat(loaded),
          loaded,
        });
        await afterJudgeCheckpoint?.({ caseId: row.case_id, judgeId: judge.id });
        if (
          !panelMayContinueAfterTerminalSeat(loaded) &&
          checkpoint.judge_results.at(-1).outcome !== 'recorded_response'
        ) {
          break;
        }
      }
    }
    checkpoint = aggregateCheckpoint(checkpoint, row, loaded, prompts);
    persist(destination, checkpoint, archive, checkpointArchiveStage(checkpoint), afterLocalCheckpointWrite);
  }
  const checkpoints = cases.map((row) => read(caseFile(destination, row.case_id)));
  const seal = {
    schema: TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_SEAL_SCHEMA,
    plan_sha256: plan.plan_sha256,
    cases: 120,
    judge_results: checkpoints.reduce((sum, row) => sum + row.judge_results.length, 0),
    reservations: checkpoints.reduce((sum, row) => sum + Object.values(row.attempts_by_judge).flat().length, 0),
    case_checkpoint_sha256: Object.fromEntries(checkpoints.map((row) => [row.case_id, digest(row)])),
    gold_joined: false,
  };
  createOrVerify(sealFile, seal, 'outcome validation seal');
  afterSealLocalWrite?.({ sealFile, seal });
  archive.append('seal', 'seal.json', seal);
  const verified = archive.verify({ localRoot: destination });
  if (!verified.valid) throw new Error(verified.issues.join('; '));
  return { plan, seal };
}

export function analyzeTutorStubResistanceRecoverySemanticValidation({
  destination,
  expectedSourceCommit,
  expectedSourceTree,
  expectedGoRequestPath,
  expectedGoRequestSha256,
  expectedGoRequest,
  sourceDirty,
  archiveDir,
  allowExistingReport = false,
  validationRegistration,
}) {
  if (sourceDirty !== false) throw new Error('outcome validation analysis requires a clean source tree');
  const loaded = loadTutorStubResistanceRecoverySemanticValidationForRegistration(validationRegistration);
  const expectedPlan = buildTutorStubResistanceRecoverySemanticValidationPlan({
    sourceCommit: expectedSourceCommit,
    sourceTree: expectedSourceTree,
    destination,
    goRequestPath: expectedGoRequestPath,
    goRequestSha256: expectedGoRequestSha256,
    goRequest: expectedGoRequest,
    loaded,
  });
  if (!exact(read(path.join(destination, 'plan.json')), expectedPlan)) throw new Error('outcome plan drifted');
  const rootEntries = fs.readdirSync(destination).sort();
  const expectedRoot = allowExistingReport
    ? ['cases', 'plan.json', 'report.json', 'seal.json']
    : ['cases', 'plan.json', 'seal.json'];
  if (!exact(rootEntries, expectedRoot)) throw new Error('outcome validation root artifact set drifted');
  const seal = read(path.join(destination, 'seal.json'));
  const sealKeys = [
    'schema',
    'plan_sha256',
    'cases',
    'judge_results',
    'reservations',
    'case_checkpoint_sha256',
    'gold_joined',
  ];
  if (
    !exact(Object.keys(seal).sort(), sealKeys.sort()) ||
    seal.schema !== TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_SEAL_SCHEMA ||
    seal.plan_sha256 !== expectedPlan.plan_sha256 ||
    seal.cases !== 120 ||
    seal.gold_joined !== false ||
    Object.keys(seal.case_checkpoint_sha256 || {}).length !== 120
  ) {
    throw new Error('outcome validation seal drifted');
  }
  const archive = archiveFor({ archiveDir, plan: expectedPlan, resume: true });
  const allowedUnmanifestedTransitions = new Set();
  if (allowExistingReport) {
    const reportBytes = fs.readFileSync(path.join(destination, 'report.json'));
    const reportSha256 = digest(reportBytes);
    allowedUnmanifestedTransitions.add(digest(`report\0report.json\0${reportSha256}`));
  }
  const archiveVerification = archive.verify({
    localRoot: allowExistingReport ? null : destination,
    allowedUnmanifestedTransitions,
  });
  if (!archiveVerification.valid) throw new Error(archiveVerification.issues.join('; '));
  const caseRoot = path.join(destination, 'cases');
  const directoryCaseIds = fs
    .readdirSync(caseRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const plannedCaseIds = expectedPlan.cases.map((row) => row.case_id).sort();
  if (!exact(directoryCaseIds, plannedCaseIds)) throw new Error('outcome validation case directory set drifted');
  const responsePairs = {};
  const scoredCases = [];
  const runIds = [];
  for (const blinded of buildTutorStubResistanceRecoverySemanticBlindedValidationCases(loaded.corpus.cases)) {
    const original = originalCase(loaded, blinded.case_id);
    const row = { ...original, case_id: blinded.case_id };
    scoredCases.push(row);
    const checkpoint = read(caseFile(destination, blinded.case_id));
    const checkpointKeys = [
      'schema',
      'case_id',
      'plan_sha256',
      'public_packet_sha256',
      'packet_sha256',
      'status',
      'attempts_by_judge',
      'invocation_id_by_judge',
      'judge_results',
      'aggregate',
      'aggregate_sha256',
      'resumed_partial_without_rejudge',
    ];
    if (
      !exact(Object.keys(checkpoint).sort(), checkpointKeys.sort()) ||
      checkpoint.schema !== TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_CHECKPOINT_SCHEMA ||
      checkpoint.case_id !== blinded.case_id ||
      checkpoint.status !== 'sealed' ||
      checkpoint.plan_sha256 !== expectedPlan.plan_sha256 ||
      checkpoint.public_packet_sha256 !== digest(measurementPacket(loaded, row)) ||
      checkpoint.packet_sha256 !==
        expectedPlan.cases.find((entry) => entry.case_id === blinded.case_id).packet_sha256 ||
      seal.case_checkpoint_sha256[blinded.case_id] !== digest(checkpoint) ||
      !exact(fs.readdirSync(path.dirname(caseFile(destination, blinded.case_id))).sort(), ['checkpoint.json'])
    ) {
      throw new Error('outcome validation checkpoint or sealed digest drifted');
    }
    const prompts = promptsFor(loaded, row);
    const responses = [];
    responsePairs[row.case_id] = splitMeasurement(loaded)
      ? { [loaded.stage === 'primary_recovery' ? 'primary' : 'fidelity']: {} }
      : {};
    const stagePairs = splitMeasurement(loaded)
      ? responsePairs[row.case_id][loaded.stage === 'primary_recovery' ? 'primary' : 'fidelity']
      : responsePairs[row.case_id];
    const judges = loaded.instrument.measurement.judges;
    const judgeIds = checkpoint.judge_results.map((result) => result.judge_id);
    if (
      judgeIds.length < 1 ||
      judgeIds.length > judges.length ||
      new Set(judgeIds).size !== judgeIds.length ||
      judgeIds.some((id) => !judges.some((judge) => judge.id === id)) ||
      Object.keys(checkpoint.attempts_by_judge || {}).some((id) => !judges.some((judge) => judge.id === id))
    ) {
      throw new Error('outcome validation has duplicate, extra, or unregistered judge evidence');
    }
    for (const judge of loaded.instrument.measurement.judges) {
      const stored = checkpoint.judge_results.find((result) => result.judge_id === judge.id);
      if (!stored) continue;
      const storedKeys = [
        'judge_id',
        'role',
        'independent_run_id',
        'prompt',
        'prompt_sha256',
        'attempts',
        'outcome',
        'raw_response',
        'record',
        'invalid_reason',
      ];
      if (
        !exact(Object.keys(stored).sort(), storedKeys.sort()) ||
        stored.role !== roleFor(loaded, judge) ||
        !exact(stored.prompt, prompts[judge.id]) ||
        stored.prompt_sha256 !== promptSha256(loaded, prompts[judge.id]) ||
        checkpoint.invocation_id_by_judge?.[judge.id] !== stored.independent_run_id ||
        !exact(checkpoint.attempts_by_judge?.[judge.id], stored.attempts) ||
        !String(stored.independent_run_id || '').trim()
      ) {
        throw new Error('outcome validation judge binding drifted');
      }
      if (!Array.isArray(stored.attempts) || stored.attempts.length < 1 || stored.attempts.length > 3) {
        throw new Error('outcome validation judge attempt envelope is invalid');
      }
      stored.attempts.forEach((attempt, index) => {
        const v8ResponseFree =
          splitV8(loaded) && attempt.status === 'transport_failed' && attempt.response_free === true;
        const expectedKeys =
          attempt.status !== 'transport_failed'
            ? ['attempt', 'status']
            : v8ResponseFree
              ? [
                  'attempt',
                  'status',
                  'error_code',
                  'provider',
                  'classification',
                  'reason',
                  'response_free',
                  'exit_code',
                  'stdout_bytes',
                  'stderr_bytes',
                  'stdout_sha256',
                  'stderr_sha256',
                  'stdout_text',
                  'stderr_text',
                  'stdout_text_truncated',
                  'stderr_text_truncated',
                ]
              : ['attempt', 'error_code', 'status'];
        if (
          !exact(Object.keys(attempt).sort(), expectedKeys.sort()) ||
          attempt.attempt !== index + 1 ||
          !['returned', 'transport_failed', 'dispatched'].includes(attempt.status) ||
          (index < stored.attempts.length - 1 && attempt.status !== 'transport_failed') ||
          (v8ResponseFree &&
            (attempt.error_code !== 'CLI_PROVIDER_RESPONSE_FREE_ERROR' ||
              attempt.provider !== 'claude-code' ||
              attempt.classification !== 'response_free_error' ||
              !Number.isInteger(attempt.stdout_bytes) ||
              attempt.stdout_bytes < 1 ||
              !Number.isInteger(attempt.stderr_bytes) ||
              attempt.stderr_bytes < 0 ||
              !/^[a-f0-9]{64}$/u.test(attempt.stdout_sha256) ||
              !/^[a-f0-9]{64}$/u.test(attempt.stderr_sha256) ||
              typeof attempt.reason !== 'string' ||
              (attempt.exit_code !== null && !Number.isInteger(attempt.exit_code)) ||
              typeof attempt.stdout_text !== 'string' ||
              typeof attempt.stderr_text !== 'string' ||
              Buffer.byteLength(attempt.stdout_text) > 4096 ||
              Buffer.byteLength(attempt.stderr_text) > 4096 ||
              typeof attempt.stdout_text_truncated !== 'boolean' ||
              typeof attempt.stderr_text_truncated !== 'boolean' ||
              (!attempt.stdout_text_truncated &&
                (Buffer.byteLength(attempt.stdout_text) !== attempt.stdout_bytes ||
                  digest(Buffer.from(attempt.stdout_text)) !== attempt.stdout_sha256)) ||
              (!attempt.stderr_text_truncated &&
                (Buffer.byteLength(attempt.stderr_text) !== attempt.stderr_bytes ||
                  digest(Buffer.from(attempt.stderr_text)) !== attempt.stderr_sha256)) ||
              (attempt.stdout_text_truncated && Buffer.byteLength(attempt.stdout_text) >= attempt.stdout_bytes) ||
              (attempt.stderr_text_truncated && Buffer.byteLength(attempt.stderr_text) >= attempt.stderr_bytes)))
        ) {
          throw new Error('outcome validation judge attempt sequence drifted');
        }
      });
      const finalStatus = stored.attempts.at(-1).status;
      if (
        (['recorded_response', 'invalid_return'].includes(stored.outcome) && finalStatus !== 'returned') ||
        (stored.outcome === 'transport_failed' && finalStatus !== 'transport_failed') ||
        (stored.outcome === 'dispatch_ambiguous_no_recall' && finalStatus !== 'dispatched')
      ) {
        throw new Error('outcome validation judge disposition does not match its attempt ledger');
      }
      runIds.push(stored.independent_run_id);
      let rebuilt = null;
      if (stored.raw_response) {
        try {
          rebuilt = wrapRaw({
            raw: stored.raw_response,
            prompt: prompts[judge.id],
            judge,
            independentRunId: stored.independent_run_id,
            loaded,
          });
        } catch {
          if (stored.outcome !== 'invalid_return') throw new Error('outcome invalid return disposition drifted');
        }
      }
      if (rebuilt && (!exact(rebuilt, stored.record) || stored.outcome !== 'recorded_response')) {
        throw new Error('outcome stored record does not derive from raw model response');
      }
      if (!rebuilt && stored.raw_response && (stored.outcome !== 'invalid_return' || stored.record !== null)) {
        throw new Error('outcome invalid response disposition is not reproducible');
      }
      if (!stored.raw_response && !['transport_failed', 'dispatch_ambiguous_no_recall'].includes(stored.outcome)) {
        throw new Error('outcome missing response has no registered terminal disposition');
      }
      if (rebuilt) responses.push(rebuilt);
      stagePairs[judge.id] = { prompt: prompts[judge.id], response: rebuilt };
    }
    const common = { caseId: row.case_id, responses, registration: loaded.instrument, prompts };
    const aggregate = adjudicateLoaded(
      loaded,
      splitMeasurement(loaded) && loaded.stage === 'intervention_fidelity'
        ? { ...common, intervention: row.intervention }
        : { ...common, publicPacket: packet(row) },
    );
    if (!exact(aggregate, checkpoint.aggregate) || digest(aggregate) !== checkpoint.aggregate_sha256) {
      throw new Error('outcome aggregate does not reproduce from persisted judge records');
    }
  }
  if (new Set(runIds).size !== runIds.length) throw new Error('outcome judge invocation IDs are not globally unique');
  const checkpoints = buildTutorStubResistanceRecoverySemanticBlindedValidationCases(loaded.corpus.cases).map((row) =>
    read(caseFile(destination, row.case_id)),
  );
  const reservations = checkpoints.reduce((sum, row) => sum + Object.values(row.attempts_by_judge).flat().length, 0);
  const judgeResults = checkpoints.reduce((sum, row) => sum + row.judge_results.length, 0);
  if (
    seal.reservations !== reservations ||
    seal.judge_results !== judgeResults ||
    reservations > expectedPlan.budget.hard_reservation_ceiling
  ) {
    throw new Error('outcome validation seal accounting drifted');
  }
  if (!exact(Object.keys(seal.case_checkpoint_sha256).sort(), plannedCaseIds)) {
    throw new Error('outcome validation seal checkpoint map drifted');
  }
  const stageCounts = Object.fromEntries(
    [...new Set(archiveVerification.manifest.entries.map((entry) => entry.stage))].map((stage) => [
      stage,
      archiveVerification.manifest.entries.filter((entry) => entry.stage === stage).length,
    ]),
  );
  const archivedJudgeOutcomes =
    Number(stageCounts.checkpoint_returned || 0) +
    Number(stageCounts.checkpoint_invalid || 0) +
    Number(stageCounts.checkpoint_transport_failed || 0) +
    Number(stageCounts.checkpoint_dispatch_ambiguous_sealed || 0);
  const archivedCaseSeals =
    Number(stageCounts.checkpoint_sealed || 0) +
    Number(stageCounts.checkpoint_partial_sealed || 0) +
    Number(stageCounts.checkpoint_dispatch_ambiguous_sealed || 0);
  if (
    stageCounts.plan !== 1 ||
    stageCounts.seal !== 1 ||
    stageCounts.checkpoint_initialized !== 120 ||
    stageCounts.checkpoint_prepared !== reservations ||
    stageCounts.checkpoint_dispatched !== reservations ||
    archivedJudgeOutcomes !== judgeResults ||
    archivedCaseSeals !== 120
  ) {
    throw new Error('outcome validation durable archive transition inventory drifted');
  }
  const combinedScore = scoreLoaded(loaded, {
    corpus: { ...loaded.corpus, cases: scoredCases },
    responsePairs,
    registration: loaded.instrument,
  });
  const score = splitMeasurement(loaded)
    ? {
        schema: `machinespirits.tutor-stub.resistance-measurement-validation-stage-score.v${loaded.instrument.version}`,
        stage: loaded.stage,
        status: loaded.stage === 'primary_recovery' ? combinedScore.primary.status : combinedScore.fidelity.status,
        metrics: loaded.stage === 'primary_recovery' ? combinedScore.primary.metrics : combinedScore.fidelity.metrics,
        prohibited_tool_events: combinedScore.prohibited_tool_events,
        stage_outcome_interpretation_allowed: false,
        combined_analysis_requires_both_sealed_stages: true,
      }
    : combinedScore;
  return {
    schema: TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_REPORT_SCHEMA,
    status: score.status,
    source: expectedPlan.source,
    plan_sha256: expectedPlan.plan_sha256,
    seal_sha256: digest(seal),
    instrument_registration_sha256: loaded.instrumentSha256,
    heldout_corpus_sha256: loaded.corpusSha256,
    score,
    claim_boundary: splitMeasurement(loaded)
      ? `Single sealed V${loaded.instrument.version} measurement stage only; no stage verdict may be interpreted before the separately blinded peer stage is sealed and the one combined validation analysis runs.`
      : 'Outcome-and-treatment-fidelity instrument validation only; excluded from confirmation outcomes and all efficacy claims.',
  };
}

export function writeTutorStubResistanceRecoverySemanticValidationReport(options) {
  const reportFile = path.join(options.destination, 'report.json');
  const report = analyzeTutorStubResistanceRecoverySemanticValidation({
    ...options,
    allowExistingReport: fs.existsSync(reportFile),
  });
  createOrVerify(reportFile, report, 'outcome validation report');
  options.afterReportLocalWrite?.({ reportFile, report });
  const plan = read(path.join(options.destination, 'plan.json'));
  const archive = archiveFor({
    archiveDir: options.archiveDir,
    plan,
    resume: true,
    afterEntry: options.afterArchiveEntryWrite,
  });
  archive.append('report', 'report.json', report);
  const verified = archive.verify({ localRoot: options.destination });
  if (!verified.valid) throw new Error(verified.issues.join('; '));
  return report;
}

export default {
  analyzeTutorStubResistanceRecoverySemanticValidation,
  buildTutorStubResistanceRecoverySemanticValidationPlan,
  runTutorStubResistanceRecoverySemanticValidation,
  writeTutorStubResistanceRecoverySemanticValidationReport,
};
