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
const OBSERVER_REPAIR_REGISTRATION = 'config/tutor-stub-resistance-action-register-crossed-registration.v6.json';
const OBSERVER_REPAIR_V7_REGISTRATION = 'config/tutor-stub-resistance-action-register-crossed-registration.v7.json';
const ENDPOINT = 'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v1.json';
const SUCCESSOR_ENDPOINT = 'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v2.json';
const OPERATIONAL_CEILING_ENDPOINT =
  'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v3.json';
const OBSERVER_REPAIR_ENDPOINT =
  'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v4.json';
const OBSERVER_REPAIR_V7_ENDPOINT =
  'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v5.json';
const CERTIFICATE =
  'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v1.endpoint-go.json';
const SUCCESSOR_CERTIFICATE =
  'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v2.endpoint-go.json';
const OPERATIONAL_CEILING_CERTIFICATE =
  'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v3.endpoint-go.json';
const OBSERVER_REPAIR_CERTIFICATE =
  'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v4.endpoint-go.json';
const OBSERVER_REPAIR_V7_CERTIFICATE =
  'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v5.endpoint-go.json';
const CALIBRATION_REQUEST = 'config/tutor-stub-resistance-action-register-baseline-analysis-go-request.v1.json';
const INCOMPLETE_CONFIRMATION_REQUEST =
  'config/tutor-stub-resistance-action-register-warm-plain-confirmation-study-go-request.v1.json';
const SUPERSEDED_CEILING_BOUND_REQUEST =
  'config/tutor-stub-resistance-action-register-warm-plain-confirmation-study-go-request.v2.json';
const INCOMPLETE_CONFIRMATION_V3_REQUEST =
  'config/tutor-stub-resistance-action-register-warm-plain-confirmation-study-go-request.v3.json';
const INCOMPLETE_CONFIRMATION_V4_REQUEST =
  'config/tutor-stub-resistance-action-register-warm-plain-confirmation-study-go-request.v4.json';
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

function buildRequest({
  destinationSuffix,
  successor = false,
  operationalCeiling = false,
  observerRepair = false,
  observerRepairV7 = false,
}) {
  const launchCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const launchTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const isSuccessor = successor || operationalCeiling || observerRepair || observerRepairV7;
  const registrationPath = observerRepairV7
    ? OBSERVER_REPAIR_V7_REGISTRATION
    : observerRepair
      ? OBSERVER_REPAIR_REGISTRATION
      : operationalCeiling
        ? OPERATIONAL_CEILING_REGISTRATION
        : successor
          ? SUCCESSOR_REGISTRATION
          : REGISTRATION;
  const endpointPath = observerRepairV7
    ? OBSERVER_REPAIR_V7_ENDPOINT
    : observerRepair
      ? OBSERVER_REPAIR_ENDPOINT
      : operationalCeiling
        ? OPERATIONAL_CEILING_ENDPOINT
        : successor
          ? SUCCESSOR_ENDPOINT
          : ENDPOINT;
  const certificatePath = observerRepairV7
    ? OBSERVER_REPAIR_V7_CERTIFICATE
    : observerRepair
      ? OBSERVER_REPAIR_CERTIFICATE
      : operationalCeiling
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
      standingAuthorizationAttachmentSha256: observerRepairV7
        ? '538aa73239072ea618e2c8308edf562f1dd7495b78574e35a3db2f549302c1ce'
        : '4ef020fa2c59d6f7e215029374d7d5adaabc5f620fe1cbd5369020a34e88e08b',
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
        : observerRepairV7
          ? 'prospective_frame_refuser_warm_plain_confirmation_v5'
          : observerRepair
            ? 'prospective_frame_refuser_warm_plain_confirmation_v4'
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
      ...(operationalCeiling || observerRepair || observerRepairV7
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
      ...(observerRepair || observerRepairV7
        ? {
            priorIncompleteConfirmationV3: {
              request: {
                path: INCOMPLETE_CONFIRMATION_V3_REQUEST,
                sha256: fileSha256(INCOMPLETE_CONFIRMATION_V3_REQUEST),
              },
              sourceCommit: 'c9f6d57b867376e94384e9efe99ccf8a79ca9195',
              sourceTree: '48c5fb51714948ea3911baed159aa731aacc9c05',
              batchPlanSha256: 'd04038ddb0c9e2c676ede89c198ee666195c91e45808d91dba8e3a5060e13e35',
              privateArchiveBranch: 'codex/resistance-action-register-confirmation-v3-incomplete-archive',
              privateArchiveCommit: '6f3e8f84079787abe1b0829be65be742c5983988',
              localInventorySha256: '83428e7d86df598b5794e3890e62e91e48dddea46514e6a0cd4d4123340c7493',
              liveMirrorInventorySha256: 'ce29fe1cef61b564b09d413b0b6782e2661a4ccff732b97c815d72deec72dae3',
              reservations: 36,
              completedCalls: 35,
              providerFailures: 0,
              coordinatorInterruptedReservations: 1,
              traceSha256: {
                s1: '39b9ec3e4a4be5552aef03ca9b06b1302e4c561b15401863ab53d8a7b7cc228b',
                s2: 'e2ddd2e5c15d757878ede5cc01b62e5deadde74626ebea0491726c870b61b0fe',
                s3: 'e414034894d3ef1050b970695547ac13a13c26a3b3b36d72d7aed8593d6b1763',
                s4: '4d7d6076c514de118ca90636aa4a17a890d2025535083e131b6e787e6f9cf727',
              },
              reused: false,
              pooled: false,
              outcomeSelected: false,
              excludedFromSuccessor: true,
              blocksAfterFirstLaunched: false,
              recoveryRun: false,
              analyzerRun: false,
              reportWritten: false,
            },
          }
        : {}),
      ...(observerRepairV7
        ? {
            priorIncompleteConfirmationV4: {
              request: {
                path: INCOMPLETE_CONFIRMATION_V4_REQUEST,
                sha256: fileSha256(INCOMPLETE_CONFIRMATION_V4_REQUEST),
              },
              sourceCommit: '8d18480e8e531ae7b4ac4e5c63e8de82628aea9f',
              sourceTree: 'adadcbff0502d0df15e777d8cebe1d7d5daa5011',
              batchPlanSha256: '388ee1df888d69f8cf2a63f6330e799092c3cc827a0e23c0913886ef9bb57591',
              batchResultSha256: '1d957f5bf8707f5ce2150a8e3576ad4ab2440f7e1e8a1f43a064e863de001636',
              privateArchiveBranch: 'codex/resistance-action-register-confirmation-v4-incomplete-archive',
              privateArchiveCommit: '05eb01179a437c4a7723a831639b1d7126a338e2',
              privateArchiveTree: 'e978a6761c6d8978084fd5d574758d75e3fb6d4d',
              privateArchiveBase: 'b36f25a295f23250f95d0ca6539123f12cc6a6af',
              localInventoryFiles: 18,
              localInventoryBytes: 7_845_834,
              localInventorySha256: 'd4585b41981d6ac4d4d6e44a6fccc253f792221f5e2c3f87fd7ec5d42c16eafe',
              liveMirrorInventoryFiles: 8,
              liveMirrorInventoryBytes: 922_685,
              liveMirrorInventorySha256: '7545452e100a2cfc1b59c17e6da8c1a5196eb7fc5d272cd60556c7462cb524fa',
              privateArchiveInventoryFiles: 16,
              privateArchiveInventoryBytes: 3_216_802,
              privateArchiveInventorySha256: '5f913668777b7bd5111d575eec49daca71a05b7f03f4a7e4281bc285a943845b',
              ledgerSha256: '2b3bf3f416edafdd21777219f7031afef7cfef75e8adebc843c4cc16576ba1b7',
              dialoguesPlanned: 36,
              dialoguesStarted: 4,
              dialoguesComplete: 2,
              dialoguesSubstantiveFailure: 2,
              reservations: 38,
              completedCalls: 38,
              providerFailures: 0,
              abortedCalls: 0,
              interruptedCalls: 0,
              traceSha256: {
                s1: '5d17d885bdad4e4b1ffe3b2a63a2e81f70c334eb9aafe1a5add649ebe1b8ac6c',
                s2: '7a9bd37991410c35f868f26fb63dc002d7aabdb64849a42220a1df8e50928942',
                s3: '14235461410868bba4e2a2bed2a7e24022dd4eadbe655b05835f0170da8ca3c3',
                s4: 'a211ea656bc458aaa3e31f6552d65e65b67a9f428ed6388d6006af057d8164ee',
              },
              compressedTraceSha256: {
                s1: 'a438528c8e5526038667e6f24cb0d080884b994acd3a6d4eebb293f3778dde75',
                s2: '3ef7bc055efe5410b77495e8e98d5d319e9cb4c76bab220e918748798e695dc5',
                s3: '549ab0a561951676a322e0ed8c4d8987ab79ac17190a0ef17e26b7423f319a45',
                s4: 'e5e4a872cbfd68dd7f5b633be6d018da1b97392b07c3433b51e6bccfd4f29dd3',
              },
              reused: false,
              pooled: false,
              outcomeSelected: false,
              excludedFromSuccessor: true,
              blocksAfterFirstLaunched: false,
              recoveryRun: false,
              analyzerRun: false,
              reportWritten: false,
              resultProduced: false,
              sealProduced: false,
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
        programmeCeilingUnchanged:
          operationalCeiling || observerRepair || observerRepairV7 ? 5000 : successor ? 2379 : 2345,
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
      programmeLedgerBefore: observerRepairV7 ? 293 : observerRepair ? 255 : isSuccessor ? 219 : 185,
      programmeCeilingBefore: observerRepair || observerRepairV7 ? 5000 : isSuccessor ? 2345 : 1200,
      programmeCeilingAmendment:
        observerRepair || observerRepairV7 ? 0 : operationalCeiling ? 2655 : successor ? 34 : 1145,
      programmeCeilingAfter: operationalCeiling || observerRepair || observerRepairV7 ? 5000 : successor ? 2379 : 2345,
      programmeLedgerAfterMaximum: observerRepairV7 ? 2453 : observerRepair ? 2415 : isSuccessor ? 2379 : 2345,
      ...(operationalCeiling || observerRepair || observerRepairV7
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
  if (template.actionRegisterConfirmation.priorIncompleteConfirmationV3) {
    const prior = template.actionRegisterConfirmation.priorIncompleteConfirmationV3.request;
    prior.sha256 = goRequestFileSha256Marker(prior.path);
  }
  if (template.actionRegisterConfirmation.priorIncompleteConfirmationV4) {
    const prior = template.actionRegisterConfirmation.priorIncompleteConfirmationV4.request;
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

test('observer-repair successor binds the incomplete V3 block and unchanged 5000 safeguard', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'confirmation-observer-repair-go-request-'));
  const output = `.tutor-stub-auto-eval/.test-confirmation-observer-repair-go-request-${process.pid}.json`;
  t.after(() => {
    fs.rmSync(temporary, { recursive: true, force: true });
    fs.rmSync(path.join(ROOT, output), { force: true });
  });
  assert.equal(
    fileSha256(INCOMPLETE_CONFIRMATION_REQUEST),
    '16f93e48f0b19fe23f0b91dabc9ac318f210ecbba6fbe954d76677d43fb78554',
  );
  assert.equal(
    fileSha256(SUPERSEDED_CEILING_BOUND_REQUEST),
    '94973232d87e812b947981f85c12345bb413302dd54bad87b1f478c0a356b34b',
  );
  assert.equal(
    fileSha256(INCOMPLETE_CONFIRMATION_V3_REQUEST),
    'e3df720358cc597e686f0007bfc1ce1a5d0b4a11273a725ce87b484d20c3fec9',
  );

  const request = buildRequest({
    destinationSuffix: `observer-repair-${process.pid}`,
    observerRepair: true,
  });
  const requestPath = path.join(temporary, 'request.json');
  fs.writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`);
  const report = validateTutorStubResistantProfileStudyGoRequest({ requestPath });
  assert.equal(report.packetValid, true);
  assert.equal(report.modelCalls, 0);
  assert.equal(report.productionWrites, 0);
  assert.equal(report.budget.maximumPlannedModelAttempts, 2160);
  assert.equal(report.budget.programmeLedgerBefore, 255);
  assert.equal(report.budget.programmeLedgerAfterMaximum, 2415);
  assert.equal(report.budget.programmeCeilingAfter, 5000);
  assert.match(report.exactApprovalStatement, /unchanged 5,000-attempt programme ceiling/u);
  assert.match(report.exactApprovalStatement, /incomplete V1 and V3 confirmation blocks/u);

  const templatePath = path.join(temporary, 'template.json');
  fs.writeFileSync(templatePath, templateText(request));
  fs.mkdirSync(path.dirname(path.join(ROOT, output)), { recursive: true });
  const packageReport = packageTutorStubResistantProfileStudyGoRequest({
    templatePath,
    launchCommit: request.source.launchCommit,
    outputPath: output,
  });
  assert.equal(packageReport.sourceClosureFiles, CLOSURE.length);
  assert.equal(packageReport.repositoryBindingFiles, 9);
  assert.equal(packageReport.isolatedReplay.packetValid, true);
  assert.equal(packageReport.effects.modelCalls, 0);
  assert.deepEqual(fs.readFileSync(path.join(ROOT, output)), fs.readFileSync(requestPath));

  for (const mutation of [
    (value) => {
      value.actionRegisterConfirmation.priorIncompleteConfirmationV3.reused = true;
    },
    (value) => {
      value.actionRegisterConfirmation.priorIncompleteConfirmationV3.reservations = 35;
    },
    (value) => {
      value.actionRegisterConfirmation.priorIncompleteConfirmationV3.request.sha256 = '0'.repeat(64);
    },
    (value) => {
      value.budget.programmeLedgerBefore = 254;
    },
    (value) => {
      value.budget.programmeLedgerAfterMaximum = 2414;
    },
  ]) {
    const invalid = structuredClone(request);
    mutation(invalid);
    const invalidPath = path.join(temporary, `invalid-${crypto.randomUUID()}.json`);
    fs.writeFileSync(invalidPath, `${JSON.stringify(invalid, null, 2)}\n`);
    assert.throws(() => validateTutorStubResistantProfileStudyGoRequest({ requestPath: invalidPath }));
  }
});

test('prospective-v7 future request binds the stopped V4 block and 293-to-2453 programme ledger', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'confirmation-v7-go-request-'));
  const output = `.tutor-stub-auto-eval/.test-confirmation-v7-go-request-${process.pid}.json`;
  t.after(() => {
    fs.rmSync(temporary, { recursive: true, force: true });
    fs.rmSync(path.join(ROOT, output), { force: true });
  });
  assert.equal(
    fileSha256(INCOMPLETE_CONFIRMATION_V4_REQUEST),
    '8c25d6afcae9b9c5689f3130664048c63d303a440412af7f4ba138a6a9337aab',
  );

  const request = buildRequest({
    destinationSuffix: `observer-repair-v7-${process.pid}`,
    observerRepairV7: true,
  });
  const requestPath = path.join(temporary, 'request.json');
  fs.writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`);
  const report = validateTutorStubResistantProfileStudyGoRequest({ requestPath });
  assert.equal(report.packetValid, true);
  assert.equal(report.modelCalls, 0);
  assert.equal(report.productionWrites, 0);
  assert.equal(report.budget.maximumPlannedModelAttempts, 2160);
  assert.equal(report.budget.programmeLedgerBefore, 293);
  assert.equal(report.budget.programmeLedgerAfterMaximum, 2453);
  assert.equal(report.budget.programmeCeilingAfter, 5000);
  assert.match(report.exactApprovalStatement, /538aa73239072ea618e2c8308edf562f1dd7495b78574e35a3db2f549302c1ce/u);
  assert.match(report.exactApprovalStatement, /incomplete V1, V3, or V4 confirmation blocks/u);

  const templatePath = path.join(temporary, 'template.json');
  fs.writeFileSync(templatePath, templateText(request));
  fs.mkdirSync(path.dirname(path.join(ROOT, output)), { recursive: true });
  const packageReport = packageTutorStubResistantProfileStudyGoRequest({
    templatePath,
    launchCommit: request.source.launchCommit,
    outputPath: output,
  });
  assert.equal(packageReport.sourceClosureFiles, CLOSURE.length);
  assert.equal(packageReport.repositoryBindingFiles, 10);
  assert.equal(packageReport.isolatedReplay.packetValid, true);
  assert.equal(packageReport.effects.modelCalls, 0);
  assert.deepEqual(fs.readFileSync(path.join(ROOT, output)), fs.readFileSync(requestPath));

  for (const mutation of [
    (value) => {
      value.authorization.standingAuthorizationAttachmentSha256 = '0'.repeat(64);
    },
    (value) => {
      value.actionRegisterConfirmation.priorIncompleteConfirmationV4.completedCalls = 37;
    },
    (value) => {
      value.actionRegisterConfirmation.priorIncompleteConfirmationV4.traceSha256.s2 = '0'.repeat(64);
    },
    (value) => {
      value.actionRegisterConfirmation.priorIncompleteConfirmationV4.privateArchiveCommit = '0'.repeat(40);
    },
    (value) => {
      value.actionRegisterConfirmation.priorIncompleteConfirmationV4.blocksAfterFirstLaunched = true;
    },
    (value) => {
      value.budget.programmeLedgerBefore = 292;
    },
    (value) => {
      value.budget.programmeLedgerAfterMaximum = 2452;
    },
  ]) {
    const invalid = structuredClone(request);
    mutation(invalid);
    const invalidPath = path.join(temporary, `invalid-${crypto.randomUUID()}.json`);
    fs.writeFileSync(invalidPath, `${JSON.stringify(invalid, null, 2)}\n`);
    assert.throws(() => validateTutorStubResistantProfileStudyGoRequest({ requestPath: invalidPath }));
  }
});
