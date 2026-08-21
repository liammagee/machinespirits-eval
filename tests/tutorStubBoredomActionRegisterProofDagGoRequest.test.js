import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { validateTutorStubResistantProfileStudyGoRequest } from '../scripts/check-tutor-stub-resistant-profile-study-go-request.js';
import {
  GO_REQUEST_PACKAGE_MARKERS,
  goRequestFileSha256Marker,
  packageTutorStubResistantProfileStudyGoRequest,
} from '../scripts/package-tutor-stub-resistant-profile-study-go-request.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRATION = 'config/tutor-stub-boredom-action-register-proof-dag-registration.v1.json';
const ENDPOINT = 'config/paid-study-endpoints/tutor-stub-boredom-action-register-proof-dag.v1.json';
const CERTIFICATE = 'config/paid-study-endpoints/tutor-stub-boredom-action-register-proof-dag.v1.endpoint-go.json';
const REGISTRATION_V2 = 'config/tutor-stub-boredom-action-register-proof-dag-registration.v2.json';
const ENDPOINT_V2 = 'config/paid-study-endpoints/tutor-stub-boredom-action-register-proof-dag.v2.json';
const CERTIFICATE_V2 = 'config/paid-study-endpoints/tutor-stub-boredom-action-register-proof-dag.v2.endpoint-go.json';
const CONSUMED_REQUEST_V2 = 'config/tutor-stub-boredom-action-register-proof-dag-study-go-request.v2.json';
const CALIBRATION_REQUEST = 'config/tutor-stub-resistance-action-register-baseline-analysis-go-request.v1.json';
const CONSUMED_REQUEST = 'config/tutor-stub-boredom-action-register-proof-dag-study-go-request.v1.json';
const STOPPED_EXECUTION = Object.freeze({
  request: Object.freeze({
    path: CONSUMED_REQUEST,
    sha256: '0972e76083a7a89592a25d55820527e2b061afad0fdf72036f08790dd61dfe61',
  }),
  launchSource: Object.freeze({
    commit: '1771eb3eaa8ab80a42c716e0e0079f62e63b608f',
    tree: '114ab3cf90fd806647db1e19f26fa72cd47f9426',
  }),
  stoppedBatch: 'execution_batch_1',
  artifactRoot: '.tutor-stub-auto-eval/boredom-action-register-proof-dag-confirmation-v1-live-2026-08-20-batch-1',
  artifactRootManifestSha256: '9f6efec5665554a9b63062c4e2994051d3ed37abf140cfef05ae5649faa69895',
  privateArchiveRoot:
    'artifacts/tutor-stub-live/.tutor-stub-auto-eval/boredom-action-register-proof-dag-confirmation-v1-live-2026-08-20-batch-1',
  privateArchiveManifestSha256: '0158271a157e57af7babf108fc2c57c5e495e3fb5a1194c2b2b409bf34147087',
  batchPlanSha256: '7407e34fdc652bf2dcd1a926d685e891c473939abc84601d7b7eddba6a6a7e2d',
  batchResultSha256: '41298a4bf7f1ba32028cfe9ff4f97928d2c5bbb7d8d8ca04264f8226658d3d40',
  reservations: 0,
  completed: 0,
  providerErrors: 0,
  interrupted: 0,
  traces: Object.freeze([
    Object.freeze({
      jobId: 'bored-confirm-w1-d1',
      path: 'jobs/bored-confirm-w1-d1/traces/2026-08-20T21-18-13-146Z.jsonl',
      sha256: 'a9b2718152597199b858939508c677c7951dd3efa63365e994be166cf11bb209',
    }),
    Object.freeze({
      jobId: 'bored-confirm-w1-d2',
      path: 'jobs/bored-confirm-w1-d2/traces/2026-08-20T21-18-13-170Z.jsonl',
      sha256: '5b74dfe63db4cf09669edc67d90e8fb9c320c6dadc19323e7e14cf122abc9ec5',
    }),
    Object.freeze({
      jobId: 'bored-confirm-w1-d4',
      path: 'jobs/bored-confirm-w1-d4/traces/2026-08-20T21-18-13-151Z.jsonl',
      sha256: '42b2111ed62652d4a60c7c06ca825126549cb98b5747a45db14ec7076687dcf0',
    }),
    Object.freeze({
      jobId: 'bored-confirm-w1-d5',
      path: 'jobs/bored-confirm-w1-d5/traces/2026-08-20T21-18-13-162Z.jsonl',
      sha256: '75a3b5c49249d5eeab6681627c545805d6d67a31b00494c78e37eccdb1e3314c',
    }),
  ]),
  batches2Through9Started: false,
  combinedAnalyzerRan: false,
  combinedResultProduced: false,
  sealProduced: false,
  recoveryPermitted: false,
  reusePermitted: false,
  poolingPermitted: false,
  outcomeSelectionPermitted: false,
});
const STOPPED_EXECUTION_V2 = Object.freeze({
  request: Object.freeze({
    path: CONSUMED_REQUEST_V2,
    sha256: '476db5ea5d2bdb9a3bc9a1d3df5b0c5e0d3a641cbd1883129e4fe0f583037310',
  }),
  predecessorRequest: Object.freeze({
    path: CONSUMED_REQUEST,
    sha256: '0972e76083a7a89592a25d55820527e2b061afad0fdf72036f08790dd61dfe61',
  }),
  launchSource: Object.freeze({
    commit: 'c2bc7b1bcc79b32c48e9b47290d9354c92a44647',
    tree: 'cdf9ffdd22863f0f22f49c9711bee052186ba76b',
  }),
  privateArchiveBranch: 'codex/boredom-proof-dag-confirmation-v2-incomplete-archive',
  privateArchiveCommit: '5833e54cac9b2e2e88847630c0c61c700c765bb4',
  accounting: Object.freeze({ reservations: 71, completed: 71, providerErrors: 0, aborted: 0 }),
  batch1: Object.freeze({
    status: 'sealed_complete',
    dialoguesComplete: 4,
    planSha256: 'a90c3bf1dc4b2f85fc0ba455a03696840040b9e3f7cab43723586eb6675e6257',
    resultSha256: 'e0abf503f21e063a48aa7167e06f5eb64b8e680fc5a3200747874c520e233eea',
    sealSha256: '318e9bbe7f91bbdbcbed546bb5d8039cd3a0e692e4f1af0a93e1da4bab33bc48',
    liveInventorySha256: 'b3eeb3bb9361d9912c8d2d106d5beb5561d9561bf9cde213853c6eb6e5713d7a',
    privateInventorySha256: 'd9958cf8ba562b6bcc3ae14a5dce22540027409f24595b1c18add83dc111a675',
  }),
  batch2: Object.freeze({
    status: 'stopped_incomplete',
    dialoguesComplete: 2,
    substantiveFailures: 2,
    planSha256: '9bb84d2d142e93f37dceb21c773c3a5d367d57db483547f8216abd7a463a94ed',
    resultSha256: '37658d100fe3c4899fda44b729d8d0c36903164cf8634a6c699303489fe6a41c',
    sealProduced: false,
    liveInventorySha256: '35aca4d938b865d9f635884b40157f5f5ea04e8ee879870f08ea1ed44ec6e1e2',
    privateInventorySha256: '2b9457e7a6a8f34a2c74b3d06b102242c578d496e19521bf4f92c4ac5ca4e6b9',
  }),
  traceSha256: Object.freeze([
    '615b6b58e329638285024a34b5c66eac4883bd76d98d58715fc6a9b5e5c01c02',
    'a4c666878724d537f3b960be1b5d153a02ef2eaf873475781e9100427f6f8a40',
    'd87db7fdb9656b9840abe7e35c5fb6045f579e8bb09cd3a5f64d3e9b8a2503fc',
    '354c0149d2e94e92d2d4d21a0de9ae853f3d1bee14d0a3b09b2e33e5fc8e17bd',
    '100eb9e43df72eee19aa973ef81e1eecdc8029be81021bd19ba88a2ca1c32f09',
    '0a9de6bdf7e36b1f031372c981c37bb6216778acef6a1c8f1e2c3b15f7974c3f',
    '00da8fe46cf830c2284883be43fef23f47b7c89d1ddb0140dac3ffaab5fb5d3d',
    'f3594107f431fe87b46c8fadaf2b6c4ad0ec4705ce3f42f6fbad1a4dcddc8dea',
  ]),
  batches3Through9Started: false,
  recoveryRan: false,
  combinedAnalyzerRan: false,
  reportProduced: false,
  scientificVerdict: 'none_categorical_instrument_failure',
  reusePermitted: false,
  resumePermitted: false,
  retryPermitted: false,
  replacementPermitted: false,
  poolingPermitted: false,
  analysisPermitted: false,
  outcomeSelectionPermitted: false,
  confirmationCreditPermitted: false,
});
const CLOSURE = [
  'scripts/run-tutor-stub-boredom-action-register-proof-dag.js',
  'scripts/analyze-tutor-stub-boredom-action-register-proof-dag.js',
  'scripts/tutor-stub.js',
  'scripts/tutor-stub-learner-profile-contracts.js',
  'scripts/check-tutor-stub-resistant-profile-study-go-request.js',
  'scripts/package-tutor-stub-resistant-profile-study-go-request.js',
  'services/tutorStubBoredomActionRegisterProofDagStudy.js',
  'services/tutorStubBoredomActionRegisterProofDagPreflight.js',
  'services/tutorStubResistanceActionRegisterStudy.js',
  'services/paidStudyEndpointPreflight.js',
  'services/tutorStubTurnOrchestration.js',
  'services/tutorStubCliApplicationHost.js',
  'services/tutorStubCliArguments.js',
  'services/tutorStubNonInteractiveApplication.js',
  'services/tutorStubApplicationState.js',
  'services/tutorStubApplicationTraceContext.js',
  'services/tutorStubSessionRecipe.js',
  'services/tutorStubReleasePacing.js',
  'services/tutorStubAutomatedLearnerGenerationRuntime.js',
  'services/mixedLearnerArtifacts.js',
  'services/tutorStubStageSpeech.js',
  'services/tutorStubLearnerAnalysisRuntime.js',
  'services/tutorStubPublicLearnerAnalysis.js',
  'services/resistantLearnerObservation.js',
  'services/tutorStubActionBeforeRegisterShadow.js',
  'services/pedagogicalMove/resistantProfileWarrantShadow.js',
  'services/tutorStubRegisterPragmatics.js',
  'services/tutorStubResponsePolicy.js',
  'services/tutorStubEdgeTimingPolicy.js',
  'services/tutorStubCliPolicyRetry.js',
  'services/tutorStubPromptTransport.js',
  'services/tutorStubTutorAttemptRuntime.js',
  'services/tutorStubTraceRuntime.js',
  'services/tutorStubLabs.js',
  'services/tutorStubArtifactArchive.js',
  'config/drama-derivation/world-005-marrick.yaml',
  'config/drama-derivation/world-026-skyway-bakery.yaml',
  'config/drama-derivation/world-029-riverside-clinic.yaml',
  'config/drama-derivation/world-030-rowan-flat.yaml',
  'config/drama-derivation/world-031-tideway-makerspace.yaml',
  'config/drama-derivation/world-033-alder-row-redoubt.yaml',
  'config/providers.yaml',
  'package.json',
  'package-lock.json',
];
const CLOSURE_V2 = [...CLOSURE, 'services/resistantLearnerAxisObservation.js'];

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function fileSha256(repoPath) {
  return sha256(fs.readFileSync(path.join(ROOT, repoPath)));
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

function commandSha256(value) {
  return sha256(JSON.stringify(value));
}

function buildRequest({ destinationSuffix }) {
  const launchCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const launchTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const registration = JSON.parse(fs.readFileSync(path.join(ROOT, REGISTRATION), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(ROOT, ENDPOINT), 'utf8'));
  const certificate = JSON.parse(fs.readFileSync(path.join(ROOT, CERTIFICATE), 'utf8'));
  const route = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'config/tutor-stub-frame-refuser-opportunity-study-go-request.v4.json'), 'utf8'),
  ).bindings.routeCanary;
  const batchIds = Array.from({ length: 9 }, (_, index) => `execution_batch_${index + 1}`);
  const destinations = batchIds.map((batch) => ({
    batch,
    artifactRoot: `.tutor-stub-auto-eval/boredom-proof-dag-test-${destinationSuffix}-${batch}`,
    createOnce: true,
    mustNotExistBeforeLaunch: true,
  }));
  const report = `.tutor-stub-auto-eval/boredom-proof-dag-test-${destinationSuffix}-combined.json`;
  const live = destinations.map(({ batch, artifactRoot }) => [
    'node',
    'scripts/run-tutor-stub-boredom-action-register-proof-dag.js',
    '--live-batch',
    '--registration',
    REGISTRATION,
    '--batch',
    batch,
    '--destination',
    artifactRoot,
    '--parallelism',
    '4',
    '--expected-source-commit',
    launchCommit,
  ]);
  const recovery = destinations.map(({ artifactRoot }) => [
    'node',
    'scripts/run-tutor-stub-boredom-action-register-proof-dag.js',
    '--recover-batch',
    '--destination',
    artifactRoot,
    '--expected-source-commit',
    launchCommit,
    '--parallelism',
    '4',
  ]);
  const analyze = [
    'node',
    'scripts/analyze-tutor-stub-boredom-action-register-proof-dag.js',
    ...destinations.flatMap(({ artifactRoot }) => ['--batch', artifactRoot]),
    '--registration',
    REGISTRATION,
    '--expected-source-commit',
    launchCommit,
    '--out',
    report,
    '--json',
  ];
  return {
    schema: 'machinespirits.tutor-stub.resistant-profile-discrimination-study-go-request.v1',
    status: 'HOLD_PENDING_EXPLICIT_HUMAN_APPROVAL',
    studyId: contract.study_id,
    authorization: {
      explicitHumanApproval: null,
      modelCallsAuthorized: false,
      liveRunAuthorized: false,
      standingAuthorizationAttachmentSha256: '4ef020fa2c59d6f7e215029374d7d5adaabc5f620fe1cbd5369020a34e88e08b',
      standingAuthorizationIncludesFutureRequestDigest: true,
      programmeCeilingOperationalSafeguard: 4539,
    },
    source: {
      launchCommit,
      launchTree,
      requirements: { headMustEqualLaunchCommit: true, checkoutMustBeClean: true, detachedLaunchWorktree: true },
      closure: CLOSURE.map((repoPath) => ({ path: repoPath, sha256: fileSha256(repoPath) })),
    },
    boredomActionRegisterProofDag: {
      type: 'prospective_boredom_matched_action_warm_plain_proof_dag_confirmation_v1',
      requestRevision: 2,
      priorStoppedExecution: structuredClone(STOPPED_EXECUTION),
      calibrationSizingEvidence: {
        analysisRequest: { path: CALIBRATION_REQUEST, sha256: fileSha256(CALIBRATION_REQUEST) },
        reportSha256: '42021a390338cd556386efc96d8f00b35655a411627908a10248dba1e473a3a5',
        privateArchiveCommit: '0857363dabb4445052159b8218acaed13d921949',
      },
      heldOutDetectionEvidenceUsedForInstrumentOnly: true,
      historicalMatchedActionEvidenceUsedForFixedActionOnly: true,
      twelveDialogueCalibrationUsedForSizingOnly: true,
      priorDialoguesReused: false,
      priorOutcomesPooled: false,
      interimAnalysisPermitted: false,
      validUnitRerunsPermitted: false,
      outcomeSelectionPermitted: false,
      recoveryBoundary: {
        sameLaunchSource: true,
        sameRegistrationModelsSeedsWorldsMeasurementAndAssignment: true,
        missingOrFailedUnitsOnly: true,
        freshNonOverwritingRecoveryCheckpoint: true,
        rerunValidOutputs: false,
        selectAmongOutcomes: false,
        maximumAttemptsPerDialogueUnchanged: 60,
        maximumAttemptsPerBatchUnchanged: 240,
        maximumTotalStudyAttemptsUnchanged: 2160,
        programmeCeilingUnchanged: 4539,
      },
    },
    design: {
      profiles: ['bored'],
      dialogues: 36,
      dialoguesPerArm: 18,
      realizations: ['plain', 'warm'],
      worlds: registration.design.worlds,
      freshIndependentDialogues: true,
      triggerMustShowByTurn: 2,
      primaryRecoveryDeadlinePostTriggerLearnerTurns: 1,
      proofProgressHorizonPostTriggerLearnerTurns: 2,
      fixedPedagogicalMove: 'ask_discriminating_question',
      dagMode: 'strict_dag',
      assignmentManifestSha256: registration.design.randomization.assignmentManifestSha256,
      runSeedBase: 2026082000,
      parallelism: 4,
      models: { tutor: 'codex.gpt-5.6-luna', analysis: 'codex.gpt-5.6-luna', learner: 'codex.gpt-5.6-luna' },
      cliEffort: 'low',
    },
    power: {
      test: 'two_sided_exact_conditional_blocked_score_test',
      alpha: 0.05,
      calibrationPlainRate: 1 / 6,
      calibrationWarmRate: 4 / 6,
      powerAt17PerArm: 0.7947641958186097,
      powerAt18PerArm: 0.8164905471625752,
      minimumNPerArmAtOrAbove80Percent: 18,
    },
    budget: {
      dialogues: 36,
      plannedRoleCallsPerDialogue: 20,
      maximumReservationsPerPlannedCall: 3,
      maximumAttemptsPerDialogue: 60,
      dialoguesPerBatch: 4,
      maximumAttemptsPerBatch: 240,
      maximumPlannedModelAttempts: 2160,
      programmeLedgerBefore: 219,
      programmeCeilingBefore: 2379,
      frameRefusalConfirmationReservedAttempts: 2160,
      programmeOperationalSafeguardIncrement: 2160,
      programmeCeilingAfter: 4539,
      programmeLedgerAfterBoredomMaximum: 2379,
      programmeReservedAfterBothMaximum: 4539,
      attemptAccountingRole: 'operational_execution_safeguard_only',
      retryOrResumeAuthority: 'bounded_technical_recovery',
    },
    measurement: {
      reportSchema: 'machinespirits.tutor-stub.boredom-action-register-proof-dag-confirmation-report.v1',
      primaryOutcome: 'profile_specific_resistance_recovery_first_post_trigger_turn',
      keySecondaryOutcome: 'objective_proof_progress_by_two_turns',
      primaryTest: 'two_sided_exact_conditional_blocked_score_test',
      fixedSequencePrimaryThenKeySecondary: true,
      oneCombinedThirtySixDialogueAnalysisRequired: true,
      interimAnalysisPermitted: false,
      priorDialoguesReusedOrPooled: 0,
      claimBoundary: 'boredom_matched_action_warm_versus_plain_recovery_and_fixed_sequence_proof_progress_only',
    },
    bindings: {
      registration: { path: REGISTRATION, sha256: fileSha256(REGISTRATION) },
      endpoint: {
        contractPath: ENDPOINT,
        contractFileSha256: fileSha256(ENDPOINT),
        contractCanonicalSha256: sha256(JSON.stringify(canonicalJson(contract))),
        certificatePath: CERTIFICATE,
        certificateFileSha256: fileSha256(CERTIFICATE),
        preflightSha256: certificate.preflight_sha256,
      },
      routeCanary: route,
      commands: {
        source: 'commands',
        liveArraySha256: commandSha256(live),
        recoveryArraySha256: commandSha256(recovery),
        analyzeArraySha256: commandSha256(analyze),
      },
    },
    commands: { live, recovery, analyze },
    payload: { humanSubjectData: false, privateArchiveData: false, trainingReuseStatus: 'not_applicable' },
    destination: {
      batches: destinations,
      combinedReport: report,
      combinedReportCreateOnce: true,
      mustNotExistBeforeAnalysis: true,
    },
  };
}

function buildRequestV2({ destinationSuffix }) {
  const request = buildRequest({ destinationSuffix: `v2-${destinationSuffix}` });
  const registration = JSON.parse(fs.readFileSync(path.join(ROOT, REGISTRATION_V2), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(ROOT, ENDPOINT_V2), 'utf8'));
  const certificate = JSON.parse(fs.readFileSync(path.join(ROOT, CERTIFICATE_V2), 'utf8'));
  request.studyId = contract.study_id;
  request.authorization.programmeCeilingOperationalSafeguard = 5000;
  request.source.closure = CLOSURE_V2.map((repoPath) => ({ path: repoPath, sha256: fileSha256(repoPath) }));
  request.boredomActionRegisterProofDag.requestRevision = 3;
  request.boredomActionRegisterProofDag.priorStoppedExecution = structuredClone(STOPPED_EXECUTION_V2);
  request.boredomActionRegisterProofDag.recoveryBoundary.programmeCeilingUnchanged = 5000;
  request.design.worlds = registration.design.worlds;
  request.design.assignmentManifestSha256 = registration.design.randomization.assignmentManifestSha256;
  request.design.runSeedBase = registration.design.freshPrefixGeneration.seedBase;
  request.budget.programmeLedgerBefore = 293;
  request.budget.programmeCeilingBefore = 5000;
  request.budget.programmeCeilingAfter = 5000;
  request.budget.programmeLedgerAfterBoredomMaximum = 2453;
  request.budget.programmeReservedAfterBothMaximum = 4613;
  request.bindings.registration = { path: REGISTRATION_V2, sha256: fileSha256(REGISTRATION_V2) };
  request.bindings.endpoint = {
    contractPath: ENDPOINT_V2,
    contractFileSha256: fileSha256(ENDPOINT_V2),
    contractCanonicalSha256: sha256(JSON.stringify(canonicalJson(contract))),
    certificatePath: CERTIFICATE_V2,
    certificateFileSha256: fileSha256(CERTIFICATE_V2),
    preflightSha256: certificate.preflight_sha256,
  };
  request.commands.live = request.commands.live.map((command) =>
    command.map((value) => (value === REGISTRATION ? REGISTRATION_V2 : value)),
  );
  request.commands.analyze = request.commands.analyze.map((value) =>
    value === REGISTRATION ? REGISTRATION_V2 : value,
  );
  request.bindings.commands.liveArraySha256 = commandSha256(request.commands.live);
  request.bindings.commands.recoveryArraySha256 = commandSha256(request.commands.recovery);
  request.bindings.commands.analyzeArraySha256 = commandSha256(request.commands.analyze);
  return request;
}

function templateText(request) {
  const template = structuredClone(request);
  template.source.launchCommit = GO_REQUEST_PACKAGE_MARKERS.sourceCommit;
  template.source.launchTree = GO_REQUEST_PACKAGE_MARKERS.sourceTree;
  for (const entry of template.source.closure) entry.sha256 = goRequestFileSha256Marker(entry.path);
  template.bindings.registration.sha256 = goRequestFileSha256Marker(template.bindings.registration.path);
  const endpoint = template.bindings.endpoint;
  endpoint.contractFileSha256 = goRequestFileSha256Marker(endpoint.contractPath);
  endpoint.contractCanonicalSha256 = GO_REQUEST_PACKAGE_MARKERS.endpointCanonicalSha256;
  endpoint.certificateFileSha256 = goRequestFileSha256Marker(endpoint.certificatePath);
  endpoint.preflightSha256 = GO_REQUEST_PACKAGE_MARKERS.endpointPreflightSha256;
  const route = template.bindings.routeCanary;
  route.resultSha256 = goRequestFileSha256Marker(route.resultPath);
  route.authorizationConsumptionSha256 = goRequestFileSha256Marker(route.authorizationConsumptionPath);
  route.sourceArtifactSha256 = GO_REQUEST_PACKAGE_MARKERS.routeSourceArtifactSha256;
  route.executionHead = GO_REQUEST_PACKAGE_MARKERS.routeExecutionHead;
  route.observedProvider = GO_REQUEST_PACKAGE_MARKERS.routeProvider;
  route.observedModel = GO_REQUEST_PACKAGE_MARKERS.routeModel;
  route.observedEffort = GO_REQUEST_PACKAGE_MARKERS.routeEffort;
  route.attestationBasis = GO_REQUEST_PACKAGE_MARKERS.routeAttestationBasis;
  route.modelIndependentlyAttested = GO_REQUEST_PACKAGE_MARKERS.routeModelIndependentlyAttested;
  template.boredomActionRegisterProofDag.calibrationSizingEvidence.analysisRequest.sha256 =
    goRequestFileSha256Marker(CALIBRATION_REQUEST);
  template.boredomActionRegisterProofDag.priorStoppedExecution.request.sha256 = goRequestFileSha256Marker(
    template.boredomActionRegisterProofDag.priorStoppedExecution.request.path,
  );
  template.bindings.commands.liveArraySha256 = GO_REQUEST_PACKAGE_MARKERS.liveCommandSha256;
  template.bindings.commands.recoveryArraySha256 = GO_REQUEST_PACKAGE_MARKERS.recoveryCommandSha256;
  template.bindings.commands.analyzeArraySha256 = GO_REQUEST_PACKAGE_MARKERS.analyzeCommandSha256;
  return `${JSON.stringify(template, null, 2)}\n`;
}

function templateTextV2(request) {
  const template = JSON.parse(templateText(request));
  template.boredomActionRegisterProofDag.priorStoppedExecution.predecessorRequest.sha256 =
    goRequestFileSha256Marker(CONSUMED_REQUEST);
  return `${JSON.stringify(template, null, 2)}\n`;
}

test('boredom proof-DAG GO validator and packager bind scientific design separately from operational safeguards', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'boredom-proof-dag-go-'));
  const output = `.tutor-stub-auto-eval/.test-boredom-proof-dag-go-${process.pid}.json`;
  t.after(() => {
    fs.rmSync(temporary, { recursive: true, force: true });
    fs.rmSync(path.join(ROOT, output), { force: true });
  });
  assert.equal(fileSha256(CONSUMED_REQUEST), '0972e76083a7a89592a25d55820527e2b061afad0fdf72036f08790dd61dfe61');
  const request = buildRequest({ destinationSuffix: process.pid });
  const requestPath = path.join(temporary, 'request.json');
  fs.writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`);
  const report = validateTutorStubResistantProfileStudyGoRequest({ requestPath });
  assert.equal(report.packetValid, true);
  assert.equal(report.modelCalls, 0);
  assert.equal(report.productionWrites, 0);
  assert.equal(report.budget.maximumPlannedModelAttempts, 2160);
  assert.equal(report.budget.programmeCeilingAfter, 4539);
  assert.equal(report.budget.attemptAccountingRole, 'operational_execution_safeguard_only');
  assert.match(report.exactApprovalStatement, /4,539-attempt cumulative programme safeguard/u);
  assert.match(report.exactApprovalStatement, /exact conditional blocked analysis/u);

  const templatePath = path.join(temporary, 'template.json');
  fs.writeFileSync(templatePath, templateText(request));
  fs.mkdirSync(path.dirname(path.join(ROOT, output)), { recursive: true });
  const packageReport = packageTutorStubResistantProfileStudyGoRequest({
    templatePath,
    launchCommit: request.source.launchCommit,
    outputPath: output,
  });
  assert.equal(packageReport.sourceClosureFiles, CLOSURE.length);
  assert.equal(packageReport.isolatedReplay.nodeModulesPresent, false);
  assert.equal(packageReport.isolatedReplay.packetValid, true);
  assert.equal(packageReport.effects.modelCalls, 0);
  assert.deepEqual(fs.readFileSync(path.join(ROOT, output)), fs.readFileSync(requestPath));

  for (const mutate of [
    (value) => {
      value.budget.programmeCeilingAfter = 4538;
    },
    (value) => {
      value.boredomActionRegisterProofDag.priorOutcomesPooled = true;
    },
    (value) => {
      value.commands.analyze.splice(2, 2);
      value.bindings.commands.analyzeArraySha256 = commandSha256(value.commands.analyze);
    },
    (value) => {
      value.boredomActionRegisterProofDag.priorStoppedExecution.artifactRootManifestSha256 = '0'.repeat(64);
    },
    (value) => {
      value.boredomActionRegisterProofDag.priorStoppedExecution.traces[0].sha256 = '0'.repeat(64);
    },
    (value) => {
      value.boredomActionRegisterProofDag.priorStoppedExecution.reusePermitted = true;
    },
  ]) {
    const invalid = structuredClone(request);
    mutate(invalid);
    const invalidPath = path.join(temporary, `invalid-${crypto.randomUUID()}.json`);
    fs.writeFileSync(invalidPath, `${JSON.stringify(invalid, null, 2)}\n`);
    assert.throws(() => validateTutorStubResistantProfileStudyGoRequest({ requestPath: invalidPath }));
  }
});

test('prospective-v8 successor packaging binds the categorical failure and complete executable closure', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'boredom-proof-dag-v2-go-'));
  const output = `.tutor-stub-auto-eval/.test-boredom-proof-dag-v2-go-${process.pid}.json`;
  t.after(() => {
    fs.rmSync(temporary, { recursive: true, force: true });
    fs.rmSync(path.join(ROOT, output), { force: true });
  });
  assert.equal(fileSha256(CONSUMED_REQUEST_V2), STOPPED_EXECUTION_V2.request.sha256);
  const request = buildRequestV2({ destinationSuffix: process.pid });
  const requestPath = path.join(temporary, 'request.json');
  fs.writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`);
  const report = validateTutorStubResistantProfileStudyGoRequest({ requestPath });
  assert.equal(report.packetValid, true);
  assert.equal(report.modelCalls, 0);
  assert.equal(report.productionWrites, 0);
  assert.equal(report.budget.programmeLedgerBefore, 293);
  assert.equal(report.budget.programmeLedgerAfterBoredomMaximum, 2453);
  assert.equal(report.budget.programmeReservedAfterBothMaximum, 4613);
  assert.match(report.exactApprovalStatement, /5,000-attempt cumulative programme safeguard/u);

  const templatePath = path.join(temporary, 'template.json');
  fs.writeFileSync(templatePath, templateTextV2(request));
  fs.mkdirSync(path.dirname(path.join(ROOT, output)), { recursive: true });
  const packageReport = packageTutorStubResistantProfileStudyGoRequest({
    templatePath,
    launchCommit: request.source.launchCommit,
    outputPath: output,
  });
  assert.equal(packageReport.sourceClosureFiles, CLOSURE_V2.length);
  assert.equal(packageReport.isolatedReplay.packetValid, true);
  assert.equal(packageReport.effects.modelCalls, 0);
  assert.deepEqual(fs.readFileSync(path.join(ROOT, output)), fs.readFileSync(requestPath));

  for (const mutate of [
    (value) => {
      value.boredomActionRegisterProofDag.priorStoppedExecution.accounting.reservations = 70;
    },
    (value) => {
      value.boredomActionRegisterProofDag.priorStoppedExecution.analysisPermitted = true;
    },
    (value) => {
      value.source.closure = value.source.closure.filter(
        (entry) => entry.path !== 'services/resistantLearnerAxisObservation.js',
      );
    },
  ]) {
    const invalid = structuredClone(request);
    mutate(invalid);
    const invalidPath = path.join(temporary, `invalid-v2-${crypto.randomUUID()}.json`);
    fs.writeFileSync(invalidPath, `${JSON.stringify(invalid, null, 2)}\n`);
    assert.throws(() => validateTutorStubResistantProfileStudyGoRequest({ requestPath: invalidPath }));
  }
});
