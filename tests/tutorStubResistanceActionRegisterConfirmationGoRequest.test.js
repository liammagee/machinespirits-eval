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
const REGISTRATION = 'config/tutor-stub-resistance-action-register-crossed-registration.v3.json';
const SUCCESSOR_REGISTRATION = 'config/tutor-stub-resistance-action-register-crossed-registration.v4.json';
const OPERATIONAL_CEILING_REGISTRATION = 'config/tutor-stub-resistance-action-register-crossed-registration.v5.json';
const ENDPOINT = 'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v1.json';
const SUCCESSOR_ENDPOINT = 'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v2.json';
const OPERATIONAL_CEILING_ENDPOINT =
  'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v3.json';
const CERTIFICATE =
  'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v1.endpoint-go.json';
const SUCCESSOR_CERTIFICATE =
  'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v2.endpoint-go.json';
const OPERATIONAL_CEILING_CERTIFICATE =
  'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v3.endpoint-go.json';
const CALIBRATION_REQUEST = 'config/tutor-stub-resistance-action-register-baseline-analysis-go-request.v1.json';
const INCOMPLETE_CONFIRMATION_REQUEST =
  'config/tutor-stub-resistance-action-register-warm-plain-confirmation-study-go-request.v1.json';
const SUPERSEDED_CEILING_BOUND_REQUEST =
  'config/tutor-stub-resistance-action-register-warm-plain-confirmation-study-go-request.v2.json';
const CLOSURE = [
  'scripts/run-tutor-stub-resistance-action-register-confirmation.js',
  'scripts/analyze-tutor-stub-resistance-action-register-confirmation.js',
  'scripts/tutor-stub.js',
  'scripts/check-tutor-stub-resistant-profile-study-go-request.js',
  'scripts/package-tutor-stub-resistant-profile-study-go-request.js',
  'services/tutorStubResistanceActionRegisterConfirmation.js',
  'services/tutorStubResistanceActionRegisterStudy.js',
  'services/paidStudyEndpointPreflight.js',
  'services/edgedRegisterCalibration.js',
  'services/tutorStubTurnOrchestration.js',
  'services/tutorStubCliApplicationHost.js',
  'services/tutorStubCliArguments.js',
  'services/tutorStubNonInteractiveApplication.js',
  'services/tutorStubApplicationState.js',
  'services/tutorStubApplicationTraceContext.js',
  'services/tutorStubSessionRecipe.js',
  'services/tutorStubReleasePacing.js',
  'services/tutorStubAutomatedLearnerGenerationRuntime.js',
  'services/tutorStubLearnerAnalysisRuntime.js',
  'services/tutorStubPublicLearnerAnalysis.js',
  'services/resistantLearnerObservation.js',
  'services/tutorStubActionBeforeRegisterShadow.js',
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

function buildRequest({ destinationSuffix, successor = false, operationalCeiling = false }) {
  const launchCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const launchTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const isSuccessor = successor || operationalCeiling;
  const registrationPath = operationalCeiling
    ? OPERATIONAL_CEILING_REGISTRATION
    : successor
      ? SUCCESSOR_REGISTRATION
      : REGISTRATION;
  const endpointPath = operationalCeiling ? OPERATIONAL_CEILING_ENDPOINT : successor ? SUCCESSOR_ENDPOINT : ENDPOINT;
  const certificatePath = operationalCeiling
    ? OPERATIONAL_CEILING_CERTIFICATE
    : successor
      ? SUCCESSOR_CERTIFICATE
      : CERTIFICATE;
  const registration = JSON.parse(fs.readFileSync(path.join(ROOT, registrationPath), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(ROOT, endpointPath), 'utf8'));
  const certificate = JSON.parse(fs.readFileSync(path.join(ROOT, certificatePath), 'utf8'));
  const route = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'config/tutor-stub-frame-refuser-opportunity-study-go-request.v4.json'), 'utf8'),
  ).bindings.routeCanary;
  const blocks = registration.design.factors.confirmationBlock.blocks;
  const destinations = blocks.map((block) => ({
    block: block.id,
    artifactRoot: `.tutor-stub-auto-eval/confirmation-test-${destinationSuffix}-${block.id}`,
    createOnce: true,
    mustNotExistBeforeLaunch: true,
  }));
  const report = `.tutor-stub-auto-eval/confirmation-test-${destinationSuffix}-combined.json`;
  const live = blocks.map((block, index) => [
    'node',
    'scripts/run-tutor-stub-resistance-action-register-confirmation.js',
    '--live-batch',
    '--registration',
    registrationPath,
    '--batch',
    block.id,
    '--destination',
    destinations[index].artifactRoot,
    '--parallelism',
    '4',
    '--expected-source-commit',
    launchCommit,
  ]);
  const recovery = destinations.map(({ artifactRoot }) => [
    'node',
    'scripts/run-tutor-stub-resistance-action-register-confirmation.js',
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
    'scripts/analyze-tutor-stub-resistance-action-register-confirmation.js',
    ...destinations.flatMap(({ artifactRoot }) => ['--batch', artifactRoot]),
    '--registration',
    registrationPath,
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
      programmeCeilingAmendmentAuthorized: false,
    },
    source: {
      launchCommit,
      launchTree,
      requirements: { headMustEqualLaunchCommit: true, checkoutMustBeClean: true, detachedLaunchWorktree: true },
      closure: CLOSURE.map((repoPath) => ({ path: repoPath, sha256: fileSha256(repoPath) })),
    },
    actionRegisterConfirmation: {
      type: successor
        ? 'prospective_frame_refuser_warm_plain_confirmation_v2'
        : operationalCeiling
          ? 'prospective_frame_refuser_warm_plain_confirmation_v3'
          : 'prospective_frame_refuser_warm_plain_confirmation_v1',
      calibrationSizingEvidence: {
        analysisRequest: { path: CALIBRATION_REQUEST, sha256: fileSha256(CALIBRATION_REQUEST) },
        reportSha256: '42021a390338cd556386efc96d8f00b35655a411627908a10248dba1e473a3a5',
        privateArchiveCommit: '0857363dabb4445052159b8218acaed13d921949',
        dialogues: 12,
        plainRecovered: 1,
        plainTotal: 6,
        warmRecovered: 4,
        warmTotal: 6,
        usedForSizingOnly: true,
      },
      calibrationDialoguesReused: false,
      calibrationDialoguesPooled: false,
      ...(isSuccessor
        ? {
            priorIncompleteConfirmation: {
              request: {
                path: INCOMPLETE_CONFIRMATION_REQUEST,
                sha256: fileSha256(INCOMPLETE_CONFIRMATION_REQUEST),
              },
              privateArchiveBranch: 'codex/resistance-action-register-confirmation-v1-incomplete-archive',
              privateArchiveCommit: '4604cc31920913e10b3e04565bf3d70def7c112e',
              localInventorySha256: '4b7345dd69e6d700b7216f1af7a4b315fdcb7aae5161248610000e592c1f7a1f',
              liveMirrorInventorySha256: '8f530416c8b24ff809486c6638ed329b6ab03593931f85768befe6ef1972a361',
              reservations: 34,
              completedCalls: 34,
              providerFailures: 0,
              reused: false,
              pooled: false,
              outcomeSelected: false,
              excludedFromSuccessor: true,
              blocksAfterFirstLaunched: false,
              analyzerRun: false,
              reportWritten: false,
            },
          }
        : {}),
      ...(operationalCeiling
        ? {
            supersededCeilingBoundRequest: {
              request: {
                path: SUPERSEDED_CEILING_BOUND_REQUEST,
                sha256: fileSha256(SUPERSEDED_CEILING_BOUND_REQUEST),
              },
              supersededWithoutExecution: true,
              modelCalls: 0,
              productionWrites: 0,
              destinationsUsed: false,
              outcomesAvailable: false,
            },
          }
        : {}),
      interimAnalysisPermitted: false,
      validUnitRerunsPermitted: false,
      outcomeSelectionPermitted: false,
      recoveryBoundary: {
        sameLaunchSource: true,
        sameRegistrationModelsSeedsMeasurementAndArmAssignment: true,
        missingOrFailedUnitsOnly: true,
        freshNonOverwritingRecoveryCheckpoint: true,
        rerunValidOutputs: false,
        selectAmongOutcomes: false,
        maximumAttemptsPerDialogueUnchanged: 60,
        maximumAttemptsPerBatchUnchanged: 240,
        maximumTotalStudyAttemptsUnchanged: 2160,
        programmeCeilingUnchanged: operationalCeiling ? 5000 : successor ? 2379 : 2345,
      },
    },
    design: {
      profiles: ['frame_refuser'],
      dialogues: 36,
      dialoguesPerArm: 18,
      realizations: ['plain', 'warm'],
      freshIndependentDialogues: true,
      triggerMustShowByTurn: 2,
      outcomeHorizonLearnerTurns: 2,
      blocks,
      world: 'world_005_marrick',
      runSeed: registration.design.randomization.masterSeed,
      parallelism: 4,
      models: { tutor: 'codex.gpt-5.6-luna', analysis: 'codex.gpt-5.6-luna', learner: 'codex.gpt-5.6-luna' },
      cliEffort: 'low',
    },
    power: {
      test: 'fisher_exact_two_sided',
      alpha: 0.05,
      calibrationPlainRate: 1 / 6,
      calibrationWarmRate: 4 / 6,
      powerAt17PerArm: 0.796776592585303,
      powerAt18PerArm: 0.8388687257645503,
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
      programmeLedgerBefore: isSuccessor ? 219 : 185,
      programmeCeilingBefore: isSuccessor ? 2345 : 1200,
      programmeCeilingAmendment: operationalCeiling ? 2655 : successor ? 34 : 1145,
      programmeCeilingAfter: operationalCeiling ? 5000 : successor ? 2379 : 2345,
      programmeLedgerAfterMaximum: isSuccessor ? 2379 : 2345,
      ...(operationalCeiling
        ? {
            attemptAccountingRole: 'operational_execution_safeguard_only_not_scientific_endpoint_or_design_objective',
          }
        : {}),
      retryOrResumeAuthority: 'bounded_technical_recovery',
    },
    measurement: {
      reportSchema: 'machinespirits.tutor-stub.resistance-action-register-confirmation-report.v1',
      primaryOutcome: 'profile_specific_resistance_recovery_by_two_post_trigger_learner_turns',
      primaryTest: 'fisher_exact_two_sided',
      alpha: 0.05,
      oneCombinedThirtySixDialogueAnalysisRequired: true,
      interimAnalysisPermitted: false,
      analysisTraceSelection: 'exact_prebound_batch_result_traces_only',
      calibrationDialoguesReusedOrPooled: 0,
      claimBoundary: 'confirmation_of_frame_refuser_matched_action_warm_versus_plain_recovery_only',
    },
    bindings: {
      registration: { path: registrationPath, sha256: fileSha256(registrationPath) },
      endpoint: {
        contractPath: endpointPath,
        contractFileSha256: fileSha256(endpointPath),
        contractCanonicalSha256: sha256(JSON.stringify(canonicalJson(contract))),
        certificatePath,
        certificateFileSha256: fileSha256(certificatePath),
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
  template.actionRegisterConfirmation.calibrationSizingEvidence.analysisRequest.sha256 =
    goRequestFileSha256Marker(CALIBRATION_REQUEST);
  if (template.actionRegisterConfirmation.priorIncompleteConfirmation) {
    const prior = template.actionRegisterConfirmation.priorIncompleteConfirmation.request;
    prior.sha256 = goRequestFileSha256Marker(prior.path);
  }
  if (template.actionRegisterConfirmation.supersededCeilingBoundRequest) {
    const prior = template.actionRegisterConfirmation.supersededCeilingBoundRequest.request;
    prior.sha256 = goRequestFileSha256Marker(prior.path);
  }
  template.bindings.commands.liveArraySha256 = GO_REQUEST_PACKAGE_MARKERS.liveCommandSha256;
  template.bindings.commands.recoveryArraySha256 = GO_REQUEST_PACKAGE_MARKERS.recoveryCommandSha256;
  template.bindings.commands.analyzeArraySha256 = GO_REQUEST_PACKAGE_MARKERS.analyzeCommandSha256;
  return `${JSON.stringify(template, null, 2)}\n`;
}

test('confirmation GO validator and packager bind the exact powered ceiling amendment without executing', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'confirmation-go-request-'));
  const output = `.tutor-stub-auto-eval/.test-confirmation-go-request-${process.pid}.json`;
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
  assert.match(report.exactApprovalStatement, /ceiling from 1,200 to 2,345 model attempts/u);
  assert.match(report.exactApprovalStatement, /18 warm and 18 plain/u);

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

  for (const mutation of [
    (value) => {
      value.budget.programmeCeilingAfter = 2344;
    },
    (value) => {
      value.actionRegisterConfirmation.calibrationDialoguesPooled = true;
    },
    (value) => {
      value.commands.analyze.splice(2, 2);
      value.bindings.commands.analyzeArraySha256 = commandSha256(value.commands.analyze);
    },
  ]) {
    const invalid = structuredClone(request);
    mutation(invalid);
    const invalidPath = path.join(temporary, `invalid-${crypto.randomUUID()}.json`);
    fs.writeFileSync(invalidPath, `${JSON.stringify(invalid, null, 2)}\n`);
    assert.throws(() => validateTutorStubResistantProfileStudyGoRequest({ requestPath: invalidPath }));
  }
});

test('successor confirmation GO validator binds the incomplete V1 exclusion and exact 2379 ceiling', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'confirmation-successor-go-request-'));
  const output = `.tutor-stub-auto-eval/.test-confirmation-successor-go-request-${process.pid}.json`;
  t.after(() => {
    fs.rmSync(temporary, { recursive: true, force: true });
    fs.rmSync(path.join(ROOT, output), { force: true });
  });
  const request = buildRequest({ destinationSuffix: `successor-${process.pid}`, successor: true });
  const requestPath = path.join(temporary, 'request.json');
  fs.writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`);
  const report = validateTutorStubResistantProfileStudyGoRequest({ requestPath });
  assert.equal(report.packetValid, true);
  assert.equal(report.modelCalls, 0);
  assert.equal(report.productionWrites, 0);
  assert.equal(report.budget.maximumPlannedModelAttempts, 2160);
  assert.match(report.exactApprovalStatement, /ceiling from 2,345 to 2,379 model attempts/u);
  assert.match(report.exactApprovalStatement, /incomplete V1 confirmation block/u);

  const templatePath = path.join(temporary, 'template.json');
  fs.writeFileSync(templatePath, templateText(request));
  fs.mkdirSync(path.dirname(path.join(ROOT, output)), { recursive: true });
  const packageReport = packageTutorStubResistantProfileStudyGoRequest({
    templatePath,
    launchCommit: request.source.launchCommit,
    outputPath: output,
  });
  assert.equal(packageReport.sourceClosureFiles, CLOSURE.length);
  assert.equal(packageReport.repositoryBindingFiles, 7);
  assert.equal(packageReport.isolatedReplay.packetValid, true);
  assert.equal(packageReport.effects.modelCalls, 0);
  assert.deepEqual(fs.readFileSync(path.join(ROOT, output)), fs.readFileSync(requestPath));

  for (const mutation of [
    (value) => {
      value.authorization.standingAuthorizationAttachmentSha256 = '0'.repeat(64);
    },
    (value) => {
      value.authorization.programmeCeilingAmendmentAuthorized = true;
    },
  ]) {
    const invalid = structuredClone(request);
    mutation(invalid);
    const invalidPath = path.join(temporary, `invalid-authority-${crypto.randomUUID()}.json`);
    fs.writeFileSync(invalidPath, `${JSON.stringify(invalid, null, 2)}\n`);
    assert.throws(() => validateTutorStubResistantProfileStudyGoRequest({ requestPath: invalidPath }));
    const invalidTemplatePath = path.join(temporary, `invalid-authority-template-${crypto.randomUUID()}.json`);
    fs.writeFileSync(invalidTemplatePath, templateText(invalid));
    const invalidOutput = `.tutor-stub-auto-eval/.test-confirmation-successor-invalid-${crypto.randomUUID()}.json`;
    assert.throws(
      () =>
        packageTutorStubResistantProfileStudyGoRequest({
          templatePath: invalidTemplatePath,
          launchCommit: request.source.launchCommit,
          outputPath: invalidOutput,
        }),
      /standing authority|ceiling amendment/u,
    );
    assert.equal(fs.existsSync(path.join(ROOT, invalidOutput)), false);
  }

  for (const mutation of [
    (value) => {
      value.actionRegisterConfirmation.priorIncompleteConfirmation.reused = true;
    },
    (value) => {
      value.actionRegisterConfirmation.priorIncompleteConfirmation.reservations = 33;
    },
    (value) => {
      value.budget.programmeCeilingAfter = 2378;
    },
  ]) {
    const invalid = structuredClone(request);
    mutation(invalid);
    const invalidPath = path.join(temporary, `invalid-${crypto.randomUUID()}.json`);
    fs.writeFileSync(invalidPath, `${JSON.stringify(invalid, null, 2)}\n`);
    assert.throws(() => validateTutorStubResistantProfileStudyGoRequest({ requestPath: invalidPath }));
  }
});

test('operational-ceiling confirmation GO validator preserves the powered design under the exact 5000 safeguard', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'confirmation-operational-ceiling-go-request-'));
  const output = `.tutor-stub-auto-eval/.test-confirmation-operational-ceiling-go-request-${process.pid}.json`;
  t.after(() => {
    fs.rmSync(temporary, { recursive: true, force: true });
    fs.rmSync(path.join(ROOT, output), { force: true });
  });
  const request = buildRequest({
    destinationSuffix: `operational-ceiling-${process.pid}`,
    operationalCeiling: true,
  });
  const requestPath = path.join(temporary, 'request.json');
  fs.writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`);
  const report = validateTutorStubResistantProfileStudyGoRequest({ requestPath });
  assert.equal(report.packetValid, true);
  assert.equal(report.modelCalls, 0);
  assert.equal(report.productionWrites, 0);
  assert.equal(report.budget.maximumPlannedModelAttempts, 2160);
  assert.equal(report.budget.programmeLedgerAfterMaximum, 2379);
  assert.equal(report.budget.programmeCeilingAfter, 5000);
  assert.match(report.exactApprovalStatement, /ceiling from 2,345 to 5,000 model attempts/u);
  assert.match(report.exactApprovalStatement, /18 warm and 18 plain/u);

  const templatePath = path.join(temporary, 'template.json');
  fs.writeFileSync(templatePath, templateText(request));
  fs.mkdirSync(path.dirname(path.join(ROOT, output)), { recursive: true });
  const packageReport = packageTutorStubResistantProfileStudyGoRequest({
    templatePath,
    launchCommit: request.source.launchCommit,
    outputPath: output,
  });
  assert.equal(packageReport.sourceClosureFiles, CLOSURE.length);
  assert.equal(packageReport.repositoryBindingFiles, 8);
  assert.equal(packageReport.isolatedReplay.packetValid, true);
  assert.equal(packageReport.effects.modelCalls, 0);
  assert.deepEqual(fs.readFileSync(path.join(ROOT, output)), fs.readFileSync(requestPath));

  for (const mutation of [
    (value) => {
      value.budget.programmeCeilingAfter = 4999;
    },
    (value) => {
      value.budget.programmeLedgerAfterMaximum = 5000;
    },
    (value) => {
      value.budget.attemptAccountingRole = 'scientific_design_objective';
    },
    (value) => {
      value.actionRegisterConfirmation.supersededCeilingBoundRequest.supersededWithoutExecution = false;
    },
    (value) => {
      value.actionRegisterConfirmation.supersededCeilingBoundRequest.request.sha256 = '0'.repeat(64);
    },
  ]) {
    const invalid = structuredClone(request);
    mutation(invalid);
    const invalidPath = path.join(temporary, `invalid-${crypto.randomUUID()}.json`);
    fs.writeFileSync(invalidPath, `${JSON.stringify(invalid, null, 2)}\n`);
    assert.throws(() => validateTutorStubResistantProfileStudyGoRequest({ requestPath: invalidPath }));
  }

  for (const mutation of [
    (value) => {
      value.authorization.standingAuthorizationAttachmentSha256 = '0'.repeat(64);
    },
    (value) => {
      value.authorization.programmeCeilingAmendmentAuthorized = true;
    },
  ]) {
    const invalid = structuredClone(request);
    mutation(invalid);
    const invalidTemplatePath = path.join(temporary, `invalid-template-${crypto.randomUUID()}.json`);
    fs.writeFileSync(invalidTemplatePath, templateText(invalid));
    const invalidOutput = `.tutor-stub-auto-eval/.test-confirmation-operational-invalid-${crypto.randomUUID()}.json`;
    assert.throws(
      () =>
        packageTutorStubResistantProfileStudyGoRequest({
          templatePath: invalidTemplatePath,
          launchCommit: request.source.launchCommit,
          outputPath: invalidOutput,
        }),
      /standing authority|ceiling amendment/u,
    );
    assert.equal(fs.existsSync(path.join(ROOT, invalidOutput)), false);
  }
});
