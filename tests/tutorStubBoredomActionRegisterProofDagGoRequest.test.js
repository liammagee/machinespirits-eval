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
const CALIBRATION_REQUEST = 'config/tutor-stub-resistance-action-register-baseline-analysis-go-request.v1.json';
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
  template.bindings.commands.liveArraySha256 = GO_REQUEST_PACKAGE_MARKERS.liveCommandSha256;
  template.bindings.commands.recoveryArraySha256 = GO_REQUEST_PACKAGE_MARKERS.recoveryCommandSha256;
  template.bindings.commands.analyzeArraySha256 = GO_REQUEST_PACKAGE_MARKERS.analyzeCommandSha256;
  return `${JSON.stringify(template, null, 2)}\n`;
}

test('boredom proof-DAG GO validator and packager bind scientific design separately from operational safeguards', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'boredom-proof-dag-go-'));
  const output = `.tutor-stub-auto-eval/.test-boredom-proof-dag-go-${process.pid}.json`;
  t.after(() => {
    fs.rmSync(temporary, { recursive: true, force: true });
    fs.rmSync(path.join(ROOT, output), { force: true });
  });
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
  ]) {
    const invalid = structuredClone(request);
    mutate(invalid);
    const invalidPath = path.join(temporary, `invalid-${crypto.randomUUID()}.json`);
    fs.writeFileSync(invalidPath, `${JSON.stringify(invalid, null, 2)}\n`);
    assert.throws(() => validateTutorStubResistantProfileStudyGoRequest({ requestPath: invalidPath }));
  }
});
