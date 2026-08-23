import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { validateTutorStubResistantProfileStudyGoRequest } from '../scripts/check-tutor-stub-resistant-profile-study-go-request.js';
import {
  GO_REQUEST_PACKAGE_MARKERS,
  goRequestFileSha256Marker,
  resolveTutorStubGoRequestOutput,
} from '../scripts/package-tutor-stub-resistant-profile-study-go-request.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FRAME_REFUSER_OPPORTUNITY_CRITICAL_SOURCE_CLOSURE = [
  'scripts/run-tutor-stub-qa-matrix.js',
  'scripts/run-tutor-stub-auto-eval.js',
  'scripts/analyze-tutor-stub-resistance-axis-calibration.js',
  'scripts/tutor-stub.js',
  'scripts/tutor-stub-learner-profile-contracts.js',
  'scripts/check-tutor-stub-resistant-profile-study-go-request.js',
  'services/tutorStubAutomatedLearnerGenerationRuntime.js',
  'services/resistantLearnerObservation.js',
  'services/resistantLearnerAxisObservation.js',
  'services/tutorStubResistanceActionRegisterStudy.js',
  'services/tutorStubActionBeforeRegisterShadow.js',
  'services/pedagogicalMove/resistantProfileWarrantShadow.js',
  'services/tutorStubEdgeTimingPolicy.js',
  'services/tutorStubResistanceAxisDiscriminationPreflight.js',
  'services/paidStudyEndpointPreflight.js',
  'config/drama-derivation/world-005-marrick.yaml',
  'config/providers.yaml',
  'package.json',
  'package-lock.json',
];
const FRAME_REFUSER_OPPORTUNITY_V4_CRITICAL_SOURCE_CLOSURE = [
  ...FRAME_REFUSER_OPPORTUNITY_CRITICAL_SOURCE_CLOSURE,
  'services/tutorStubCliPolicyRetry.js',
  'services/tutorStubPromptTransport.js',
  'services/tutorStubTutorAttemptRuntime.js',
  'services/tutorStubTraceRuntime.js',
  'services/tutorStubLabs.js',
  'services/tutorStubApplicationTraceContext.js',
  'services/tutorStubCliApplicationHost.js',
];
const RESISTANCE_ACTION_REGISTER_BASELINE_V2_CRITICAL_SOURCE_CLOSURE = [
  'scripts/run-tutor-stub-resistance-action-register-crossed.js',
  'scripts/analyze-tutor-stub-resistance-action-register-baseline.js',
  'scripts/tutor-stub.js',
  'scripts/check-tutor-stub-resistant-profile-study-go-request.js',
  'scripts/package-tutor-stub-resistant-profile-study-go-request.js',
  'services/tutorStubResistanceActionRegisterExecution.js',
  'services/tutorStubResistanceActionRegisterStudy.js',
  'services/tutorStubResistanceActionRegisterPreflight.js',
  'services/paidStudyEndpointPreflight.js',
  'services/tutorStubTurnOrchestration.js',
  'services/tutorStubCliApplicationHost.js',
  'services/tutorStubCliArguments.js',
  'services/tutorStubNonInteractiveApplication.js',
  'services/tutorStubApplicationState.js',
  'services/tutorStubApplicationTraceContext.js',
  'services/tutorStubReleasePacing.js',
  'services/tutorStubAutomatedLearnerGenerationRuntime.js',
  'services/tutorStubLearnerAnalysisRuntime.js',
  'services/tutorStubPublicLearnerAnalysis.js',
  'services/resistantLearnerObservation.js',
  'services/resistantLearnerAxisObservation.js',
  'services/tutorStubActionBeforeRegisterShadow.js',
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
const RESISTANCE_ACTION_REGISTER_STOPPED_V2_REQUEST = {
  request: {
    path: 'config/tutor-stub-resistance-action-register-baseline-study-go-request.v2.json',
    sha256: 'b28f62240e82301fed77f4690b59eaf6df2fac3c7e4812f053071efb89135c1c',
  },
  disposition: 'consumed_stopped_wholly_excluded',
  partialBatch: {
    batch: 'A',
    artifactRoot: '.tutor-stub-auto-eval/resistance-action-register-baseline-v2-live-2026-08-20-a',
    artifactRootManifestSha256: '6eec7d2edc8664833d56cf8a66aa6bf6a272ec04981d18fb3550b02ad6a6ea10',
    privateArchiveManifestSha256: 'd3c15b61a5bfffbc6fa9faa344e03776ea110c068f72157d4466c53930f5248b',
    reservations: 31,
    completed: 28,
    interrupted: 3,
    providerErrors: 0,
    traces: [
      {
        jobId: 'frame_refuser-v4-r1-t1__matched_plain_A',
        path: 'jobs/frame_refuser-v4-r1-t1__matched_plain_A/traces/2026-08-20T08-54-55-423Z.jsonl',
        sha256: 'd3bda6c8439ba8a918ce1c8ae473892186469ebd43c29aa5d7811e736875b81d',
      },
      {
        jobId: 'frame_refuser-v4-r1-t1__matched_warm_A',
        path: 'jobs/frame_refuser-v4-r1-t1__matched_warm_A/traces/2026-08-20T08-54-55-418Z.jsonl',
        sha256: '72725d86b767b9e330356f20481ef3a9b6971d697835591d7c40275bc1bba258',
      },
      {
        jobId: 'frame_refuser-v4-r2-t1__matched_plain_A',
        path: 'jobs/frame_refuser-v4-r2-t1__matched_plain_A/traces/2026-08-20T08-54-55-418Z.jsonl',
        sha256: '0eb633edef1d67d29dd2c18e2f54db993151982e03b140fff3e263854d866822',
      },
      {
        jobId: 'frame_refuser-v4-r2-t1__matched_warm_A',
        path: 'jobs/frame_refuser-v4-r2-t1__matched_warm_A/traces/2026-08-20T08-55-34-985Z.jsonl',
        sha256: 'e92c93e5cf6410bb54561bee9ed8a9e58cf5dded3cb0d6b00b82371337b3aa3c',
      },
      {
        jobId: 'frame_refuser-v4-r3-t1__matched_plain_A',
        path: 'jobs/frame_refuser-v4-r3-t1__matched_plain_A/traces/2026-08-20T08-55-37-146Z.jsonl',
        sha256: '1a2fab9e2a1a32bbba2a0a481a5c4df9c6804824a10b404c30803bfb22590b4d',
      },
      {
        jobId: 'frame_refuser-v4-r3-t1__matched_warm_A',
        path: 'jobs/frame_refuser-v4-r3-t1__matched_warm_A/traces/2026-08-20T08-55-46-896Z.jsonl',
        sha256: '769756881993f7f3115c794531c68187dc72d1a559a3dd12e4fa7df1aad44aea',
      },
    ],
  },
  batchBStarted: false,
  combinedAnalyzerRan: false,
  combinedResultProduced: false,
  sealProduced: false,
  recoveryPermitted: false,
  reusePermitted: false,
  poolingPermitted: false,
  outcomeSelectionPermitted: false,
};
const RESISTANCE_ACTION_REGISTER_STOPPED_V3_REQUEST = {
  request: {
    path: 'config/tutor-stub-resistance-action-register-baseline-study-go-request.v3.json',
    sha256: '568782ec4df4453f4c7e08d6f26afbfe8174bd33a134c6057c65bb9f9b71315d',
  },
  disposition: 'consumed_stopped_wholly_excluded',
  partialBatch: {
    batch: 'A',
    artifactRoot: '.tutor-stub-auto-eval/resistance-action-register-baseline-v2-successor-live-2026-08-20-a',
    artifactRootManifestSha256: '0db1496cdab580b2094f536aa1b66276bd7eab8548963341d99914065277e8bd',
    privateArchiveManifestSha256: 'bf15bc3e9f5187f768a2cbff5c3db2d4dcf1ef9f52ece632c8e967ff6a6ffadf',
    reservations: 33,
    completed: 30,
    interrupted: 3,
    providerErrors: 0,
    traces: [
      {
        jobId: 'frame_refuser-v4-r1-t1__matched_plain_A',
        path: 'jobs/frame_refuser-v4-r1-t1__matched_plain_A/traces/2026-08-20T12-49-26-800Z.jsonl',
        sha256: 'f4fc7c7ca95dc43a2ac01b3bb295a7e3ab7d307a9a39140a664edf6648f7928b',
      },
      {
        jobId: 'frame_refuser-v4-r1-t1__matched_warm_A',
        path: 'jobs/frame_refuser-v4-r1-t1__matched_warm_A/traces/2026-08-20T12-49-26-789Z.jsonl',
        sha256: '7a7a6718e08c52cc05fbcc66033d5fdb58f775bcfbe132fff7a26495a3579d39',
      },
      {
        jobId: 'frame_refuser-v4-r2-t1__matched_plain_A',
        path: 'jobs/frame_refuser-v4-r2-t1__matched_plain_A/traces/2026-08-20T12-49-26-791Z.jsonl',
        sha256: '466ccc9626a401cd146e197214ade34b2cc87bb1bbe5623823b6bc53e909d88c',
      },
      {
        jobId: 'frame_refuser-v4-r2-t1__matched_warm_A',
        path: 'jobs/frame_refuser-v4-r2-t1__matched_warm_A/traces/2026-08-20T12-50-10-377Z.jsonl',
        sha256: 'b6cb0c5fec92c2c83ce0318e7c48da1fd43d63c00012d4f652f82d766eb0f14a',
      },
      {
        jobId: 'frame_refuser-v4-r3-t1__matched_plain_A',
        path: 'jobs/frame_refuser-v4-r3-t1__matched_plain_A/traces/2026-08-20T12-50-15-601Z.jsonl',
        sha256: '72c16ea8e715fc888785f49ebadaed5525d962a1590295a0402399ad298fc002',
      },
      {
        jobId: 'frame_refuser-v4-r3-t1__matched_warm_A',
        path: 'jobs/frame_refuser-v4-r3-t1__matched_warm_A/traces/2026-08-20T12-50-20-317Z.jsonl',
        sha256: '35394468d9c2b839524645bffccb758c9578a0d32be7d181cca267eeebd898f5',
      },
    ],
  },
  batchBStarted: false,
  combinedAnalyzerRan: false,
  combinedResultProduced: false,
  sealProduced: false,
  recoveryPermitted: false,
  reusePermitted: false,
  poolingPermitted: false,
  outcomeSelectionPermitted: false,
};
const REQUEST_PATH = path.join(ROOT, 'config', 'tutor-stub-resistant-profile-discrimination-study-go-request.v1.json');
const REPLACEMENT_REQUEST_PATH = path.join(
  ROOT,
  'config',
  'tutor-stub-frame-defiant-replacement-study-go-request.v1.json',
);
const MEASUREMENT_RECHECK_REQUEST_PATH = path.join(
  ROOT,
  'config',
  'tutor-stub-resistant-profile-measurement-recheck-study-go-request.v1.json',
);
const MEASUREMENT_RECHECK_RECOVERY_REQUEST_PATH = path.join(
  ROOT,
  'config',
  'tutor-stub-resistant-profile-measurement-recheck-technical-recovery-study-go-request.v1.json',
);
const AXIS_HELDOUT_REQUEST_PATH = path.join(
  ROOT,
  'config',
  'tutor-stub-resistance-axis-heldout-study-go-request.v1.json',
);
const FRAME_REFUSER_V2_REQUEST_PATH = path.join(
  ROOT,
  'config',
  'tutor-stub-frame-refuser-opportunity-study-go-request.v2.json',
);
const GO_REQUEST_PACKAGE_SCRIPT = 'scripts/package-tutor-stub-resistant-profile-study-go-request.js';

function protectedPackagerRepoPaths(request) {
  return [
    ...request.source.closure.map((entry) => entry.path),
    request.bindings.registration.path,
    request.bindings.prefixBundle?.path,
    request.bindings.endpoint.contractPath,
    request.bindings.endpoint.certificatePath,
    request.bindings.routeCanary.resultPath,
    request.bindings.routeCanary.authorizationConsumptionPath,
    request.opportunityGate?.historicalOpportunityV1?.requestPath,
    request.actionRegisterBaseline?.priorStoppedExecution?.request?.path,
    request.actionRegisterBaselineAnalysis?.sealedInputs?.priorRequest?.path,
  ].filter(Boolean);
}

function materializeProtectedPackagerBlobs(request, commit, gitEnv) {
  return [...new Set(protectedPackagerRepoPaths(request))].map((repoPath) => {
    const listed = spawnSync('git', ['ls-tree', '-z', commit, '--', repoPath], {
      cwd: ROOT,
      encoding: 'utf8',
      env: gitEnv,
    });
    assert.equal(listed.status, 0, listed.stderr);
    const records = listed.stdout.split('\0').filter(Boolean);
    assert.equal(records.length, 1, `${repoPath} must resolve to one protected launch blob`);
    const match = records[0].match(/^([0-7]{6}) ([^ ]+) ([0-9a-f]{40,64})\t([\s\S]+)$/u);
    assert.ok(match && match[2] === 'blob' && match[4] === repoPath, `${repoPath} must be a Git blob`);
    const oid = match[3];
    const materialized = spawnSync('git', ['cat-file', 'blob', oid], {
      cwd: ROOT,
      env: gitEnv,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    assert.equal(materialized.status, 0, String(materialized.stderr || ''));
    return { repoPath, oid };
  });
}

function createProtectedPackagerCheckout(t, request, label, commit = request.source.launchCommit) {
  const checkout = fs.mkdtempSync(path.join(os.tmpdir(), `go-request-packager-${label}-`));
  t.after(() => fs.rmSync(checkout, { recursive: true, force: true }));
  const gitEnv = { ...process.env, GIT_LFS_SKIP_SMUDGE: '1' };
  const protectedBlobs = materializeProtectedPackagerBlobs(request, commit, gitEnv);
  const clone = spawnSync('git', ['clone', '--quiet', '--shared', '--no-checkout', ROOT, checkout], {
    encoding: 'utf8',
    env: gitEnv,
  });
  assert.equal(clone.status, 0, clone.stderr);
  const detached = spawnSync('git', ['checkout', '--quiet', '--detach', commit], {
    cwd: checkout,
    encoding: 'utf8',
    env: gitEnv,
  });
  assert.equal(detached.status, 0, detached.stderr);
  const offlineGitEnv = { ...gitEnv, GIT_NO_LAZY_FETCH: '1' };
  for (const { repoPath, oid } of protectedBlobs) {
    const available = spawnSync('git', ['cat-file', '-e', oid], {
      cwd: checkout,
      encoding: 'utf8',
      env: offlineGitEnv,
    });
    assert.equal(available.status, 0, `${repoPath} (${oid}) must remain available without lazy fetching`);
  }
  const packagerPath = path.join(checkout, GO_REQUEST_PACKAGE_SCRIPT);
  fs.mkdirSync(path.dirname(packagerPath), { recursive: true });
  fs.copyFileSync(path.join(ROOT, GO_REQUEST_PACKAGE_SCRIPT), packagerPath);
  return checkout;
}

test('approved study request remains bound to its launch source and fails closed after source drift', () => {
  const requestBytes = fs.readFileSync(REQUEST_PATH);
  const request = JSON.parse(requestBytes.toString('utf8'));

  assert.equal(
    crypto.createHash('sha256').update(requestBytes).digest('hex'),
    'ac077d68e3f64c6f49b298bb12cbb5af79ac3d5d6ef8ce0476cb45c2044d2dbb',
  );
  assert.equal(request.source.launchCommit, 'ae940515978030c7f9db1ea72c4c42a647034272');
  assert.equal(request.authorization.liveRunAuthorized, false);
  assert.equal(request.budget.maximumPlannedModelAttempts, 864);
  assert.equal(request.budget.retryOrResumeAuthority, 'none');

  for (const binding of request.source.closure) {
    const launchBytes = execFileSync('git', ['show', `${request.source.launchCommit}:${binding.path}`], { cwd: ROOT });
    assert.equal(
      crypto.createHash('sha256').update(launchBytes).digest('hex'),
      binding.sha256,
      `${binding.path} must remain bound to the approved launch commit`,
    );
  }

  const result = spawnSync(
    process.execPath,
    ['scripts/check-tutor-stub-resistant-profile-study-go-request.js', '--request', REQUEST_PATH, '--json'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /source-closure-scripts\/analyze-tutor-stub-profile-discrimination\.js/u);
});

test('study GO request fails closed on a drifted source binding', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'resistant-profile-study-go-'));
  try {
    const request = JSON.parse(fs.readFileSync(REQUEST_PATH, 'utf8'));
    request.source.closure[0].sha256 = '0'.repeat(64);
    const driftedPath = path.join(tmp, 'drifted-request.json');
    fs.writeFileSync(driftedPath, `${JSON.stringify(request, null, 2)}\n`);
    const result = spawnSync(
      process.execPath,
      ['scripts/check-tutor-stub-resistant-profile-study-go-request.js', '--request', driftedPath, '--json'],
      { cwd: ROOT, encoding: 'utf8' },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /source-closure-scripts\/run-tutor-stub-qa-matrix\.js/u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('consumed frame-defiant replacement request remains frozen and fails closed after source drift', () => {
  const requestBytes = fs.readFileSync(REPLACEMENT_REQUEST_PATH);
  const request = JSON.parse(fs.readFileSync(REPLACEMENT_REQUEST_PATH, 'utf8'));

  assert.equal(
    crypto.createHash('sha256').update(requestBytes).digest('hex'),
    '0e022c64ef109b9631cbb544ba0b3c47baee61c44d477a45b4481efaa94e0f35',
  );
  assert.equal(request.source.launchCommit, '6dbec4cb49a47eca415f77e2324be57a6e1d6f45');
  assert.equal(request.budget.maximumPlannedModelAttempts, 144);
  assert.equal(request.budget.retryOrResumeAuthority, 'none');
  assert.equal(request.replacement.retainedPriorTraces.length, 15);
  assert.equal(request.replacement.excludedPriorTraces.length, 3);
  assert.ok(request.replacement.excludedPriorTraces.every((entry) => entry.profile === 'frame_defiant'));

  const result = spawnSync(
    process.execPath,
    ['scripts/check-tutor-stub-resistant-profile-study-go-request.js', '--request', REPLACEMENT_REQUEST_PATH, '--json'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /source-closure-scripts\/analyze-tutor-stub-profile-discrimination\.js/u);
});

test('consumed measurement recheck remains bound to its 18-dialogue launch source and fails closed after drift', () => {
  const requestBytes = fs.readFileSync(MEASUREMENT_RECHECK_REQUEST_PATH);
  const request = JSON.parse(requestBytes.toString('utf8'));

  assert.equal(
    crypto.createHash('sha256').update(requestBytes).digest('hex'),
    'c2176e17c403824c0566ccb86d167fad21c56be405291025f09f233c3a8ea26d',
  );
  assert.equal(request.source.launchCommit, '0f7ff1b3d0e1ca0146a519f06914f3d6e1cdcd4d');
  assert.equal(request.authorization.modelCallsAuthorized, false);
  assert.equal(request.authorization.liveRunAuthorized, false);
  assert.equal(request.budget.maximumPlannedModelAttempts, 864);
  assert.equal(request.budget.retryOrResumeAuthority, 'none');
  assert.equal(request.recheck.priorArtifactsReused, false);
  assert.equal(request.recheck.priorResultRewritten, false);
  assert.equal(request.recheck.thresholdsChanged, false);
  assert.equal(
    request.recheck.priorCanonicalReport.sha256,
    '06d7bbc49df46e2f20ebeb3eb0141dba975825ce10bf33eef0e0dc15540ec32c',
  );
  assert.equal(request.measurement.reportSchema, 'machinespirits.tutor-stub.profile-discrimination.v4');
  assert.equal(request.measurement.nearestNeighborAnchorMinimumSignatureTargetPassRate, 0.4);
  assert.doesNotMatch(request.commands.analyze[2], /--trace-root/u);

  const result = spawnSync(
    process.execPath,
    [
      'scripts/check-tutor-stub-resistant-profile-study-go-request.js',
      '--request',
      MEASUREMENT_RECHECK_REQUEST_PATH,
      '--json',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /source-closure-scripts\/tutor-stub\.js/u);
});

test('consumed technical recovery request remains frozen and fails closed after current source drift', () => {
  const requestBytes = fs.readFileSync(MEASUREMENT_RECHECK_RECOVERY_REQUEST_PATH);
  const request = JSON.parse(requestBytes.toString('utf8'));

  assert.equal(
    crypto.createHash('sha256').update(requestBytes).digest('hex'),
    '34e78c0753c1da34fd9fbc8865bb69a437adf383ad2867c24c2458ab869fdbab',
  );
  assert.equal(request.source.launchCommit, '0f7ff1b3d0e1ca0146a519f06914f3d6e1cdcd4d');
  assert.equal(request.authorization.modelCallsAuthorized, false);
  assert.equal(request.authorization.liveRunAuthorized, false);
  assert.equal(request.budget.maximumPlannedModelAttempts, 864);
  assert.equal(request.budget.retryOrResumeAuthority, 'bounded_technical_recovery');
  assert.equal(
    request.technicalRecovery.priorRequestSha256,
    'c2176e17c403824c0566ccb86d167fad21c56be405291025f09f233c3a8ea26d',
  );
  assert.equal(request.technicalRecovery.priorInvocation.completedModelCalls, 0);
  assert.equal(request.technicalRecovery.priorInvocation.artifactDestinationCreated, false);
  assert.equal(request.technicalRecovery.dependencyPreparation.modelCalls, 0);
  assert.equal(request.technicalRecovery.excludedUnplannedSmoke.completedModelCalls, 29);
  assert.equal(request.technicalRecovery.excludedUnplannedSmoke.interruptedReservations, 6);
  assert.equal(request.technicalRecovery.excludedUnplannedSmoke.eligibleForStudyAssembly, false);
  assert.equal(request.technicalRecovery.recoveryBoundary.rerunValidOutputs, false);
  assert.equal(request.technicalRecovery.recoveryBoundary.maximumTotalStudyAttemptsUnchanged, 864);
  assert.match(request.destination.artifactRoot, /technical-recovery/u);

  const result = spawnSync(
    process.execPath,
    [
      'scripts/check-tutor-stub-resistant-profile-study-go-request.js',
      '--request',
      MEASUREMENT_RECHECK_RECOVERY_REQUEST_PATH,
      '--json',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /source-closure-scripts\/tutor-stub\.js/u);
});

test('consumed axis heldout request remains frozen and fails closed after current source drift', () => {
  const requestBytes = fs.readFileSync(AXIS_HELDOUT_REQUEST_PATH);
  const request = JSON.parse(requestBytes.toString('utf8'));

  assert.equal(
    crypto.createHash('sha256').update(requestBytes).digest('hex'),
    'b52aa74bb5980229f85d6d6c8e857c59de72ba22f9e4d7be377eb17fe278b4ee',
  );
  assert.equal(request.source.launchCommit, 'c302d917da59c3608d6e0d654fc313b13eadb12f');
  assert.equal(request.authorization.modelCallsAuthorized, false);
  assert.equal(request.authorization.liveRunAuthorized, false);
  assert.equal(request.budget.maximumPlannedModelAttempts, 864);
  assert.equal(request.budget.retryOrResumeAuthority, 'bounded_technical_recovery');
  assert.deepEqual(request.measurement.coPrimaryProfiles, ['bored', 'frame_defiant']);
  assert.deepEqual(request.measurement.diagnosticProfiles, ['low_agency', 'skeptical', 'low_trust_skeptic']);
  assert.equal(request.measurement.epistemicTrustRole, 'descriptive_only_no_threshold_no_pass_contribution');
  assert.equal(request.axisHeldout.priorResultRewritten, false);
  assert.equal(request.axisHeldout.historicalEvidencePooled, false);

  const result = spawnSync(
    process.execPath,
    [
      'scripts/check-tutor-stub-resistant-profile-study-go-request.js',
      '--request',
      AXIS_HELDOUT_REQUEST_PATH,
      '--json',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /source-closure-scripts\/analyze-tutor-stub-resistance-axis-calibration\.js/u);
});

test('consumed frame-refuser v1, v2, and v3 requests retain their exact approval digests', () => {
  const expected = {
    'config/tutor-stub-frame-refuser-opportunity-study-go-request.v1.json':
      'ca832a863764748dde496166ee2f9e7793cb97a582d22564c085bacece005b84',
    'config/tutor-stub-frame-refuser-opportunity-study-go-request.v2.json':
      '2c77c131c2803e4af37eea3c8cbfb38e2ba423d645ab98739d661c5778c22c04',
    'config/tutor-stub-frame-refuser-opportunity-study-go-request.v3.json':
      '2cbe95ba7ec713888e5ed6c405b4856bdfb021be962d771a7578b9d62dc998f2',
  };
  for (const [relativePath, digest] of Object.entries(expected)) {
    assert.equal(
      crypto
        .createHash('sha256')
        .update(fs.readFileSync(path.join(ROOT, relativePath)))
        .digest('hex'),
      digest,
    );
  }
});

test('frame-refuser opportunity requests validate historical v1 and prospective v2/v3/v4 without a new model call', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-refuser-opportunity-go-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const digest = (filePath) => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  const commandDigest = (command) => crypto.createHash('sha256').update(JSON.stringify(command)).digest('hex');
  const launchCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const launchTree = execFileSync('git', ['show', '-s', '--format=%T', launchCommit], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  const fixtures = [
    {
      version: 'v1',
      studyId: 'tutor-stub-frame-refuser-opportunity-v1',
      registrationPath: 'config/tutor-stub-frame-refuser-opportunity-registration.v1.json',
      endpointPath: 'config/paid-study-endpoints/tutor-stub-frame-refuser-opportunity.json',
      certificatePath: 'config/paid-study-endpoints/tutor-stub-frame-refuser-opportunity.endpoint-go.json',
    },
    {
      version: 'v2',
      studyId: 'tutor-stub-frame-refuser-opportunity-v2',
      registrationPath: 'config/tutor-stub-frame-refuser-opportunity-registration.v2.json',
      endpointPath: 'config/paid-study-endpoints/tutor-stub-frame-refuser-opportunity.v2.json',
      certificatePath: 'config/paid-study-endpoints/tutor-stub-frame-refuser-opportunity.v2.endpoint-go.json',
    },
    {
      version: 'v3',
      studyId: 'tutor-stub-frame-refuser-opportunity-v3',
      registrationPath: 'config/tutor-stub-frame-refuser-opportunity-registration.v3.json',
      endpointPath: 'config/paid-study-endpoints/tutor-stub-frame-refuser-opportunity.v3.json',
      certificatePath: 'config/paid-study-endpoints/tutor-stub-frame-refuser-opportunity.v3.endpoint-go.json',
    },
    {
      version: 'v4',
      studyId: 'tutor-stub-frame-refuser-opportunity-v4',
      registrationPath: 'config/tutor-stub-frame-refuser-opportunity-registration.v4.json',
      endpointPath: 'config/paid-study-endpoints/tutor-stub-frame-refuser-opportunity.v4.json',
      certificatePath: 'config/paid-study-endpoints/tutor-stub-frame-refuser-opportunity.v4.endpoint-go.json',
    },
  ];
  for (const fixture of fixtures) {
    const registrationPath = fixture.registrationPath;
    const endpointPath = fixture.endpointPath;
    const certificatePath = fixture.certificatePath;
    const registration = JSON.parse(fs.readFileSync(path.join(ROOT, registrationPath), 'utf8'));
    const certificate = JSON.parse(fs.readFileSync(path.join(ROOT, certificatePath), 'utf8'));
    const artifactRoot = `.test-tmp/frame-refuser-opportunity-request-test-${fixture.version}-${process.pid}`;
    const live = [
      ...(fixture.version === 'v3' || fixture.version === 'v4'
        ? ['env', `TUTOR_STUB_RESISTANT_LEARNER_OBSERVATION_SEMANTICS=prospective_${fixture.version}`]
        : []),
      'node',
      'scripts/run-tutor-stub-qa-matrix.js',
      '--policies',
      'field',
      '--profiles',
      'frame_refuser,frame_defiant',
      '--runs',
      '3',
      '--run-seed',
      '20260820',
      '--turns',
      fixture.version === 'v4' ? '2' : '8',
      '--safety-turns',
      fixture.version === 'v4' ? '2' : '8',
      '--model',
      'codex.gpt-5.6-luna',
      '--analysis-model',
      'codex.gpt-5.6-luna',
      '--auto-learner-model',
      'codex.gpt-5.6-luna',
      '--model-call-budget',
      fixture.version === 'v4' ? '39' : '48',
      '--world',
      'world_005_marrick',
      '--dag-mode',
      'strict_dag',
      '--register-palette',
      'safe',
      '--register-overlay-threshold',
      '0.7',
      '--release-speed',
      '1',
      '--cli-effort',
      'low',
      '--history-turns',
      '4',
      '--max-tokens',
      '4096',
      '--parallelism',
      '3',
      '--trace-dir',
      artifactRoot,
      '--no-html-report',
      '--no-memory-summary',
      '--no-analyze',
    ];
    const analyze = [
      'zsh',
      '-lc',
      `set -euo pipefail; artifact_root='${artifactRoot}'; trace_args=(); for trace in "$artifact_root"/*/traces/*/*.jsonl; do [[ -f "$trace" ]] || continue; trace_args+=(--trace "$trace"); done; node scripts/analyze-tutor-stub-resistance-axis-calibration.js "${'${trace_args[@]}'}" --registration ${registrationPath} --required-traces 6 --required-profiles frame_refuser,frame_defiant --required-runs-per-profile 3 --required-turns ${fixture.version === 'v4' ? 2 : 8} --required-policies field --required-tutor-model codex.gpt-5.6-luna --required-analysis-model codex.gpt-5.6-luna --required-learner-model codex.gpt-5.6-luna --json --out "$artifact_root/frame-refuser-opportunity-gate.json"`,
    ];
    const request = {
      schema: 'machinespirits.tutor-stub.resistant-profile-discrimination-study-go-request.v1',
      status: 'HOLD_PENDING_EXPLICIT_HUMAN_APPROVAL',
      studyId: fixture.studyId,
      authorization: {
        explicitHumanApproval: null,
        modelCallsAuthorized: false,
        liveRunAuthorized: false,
      },
      source: {
        launchCommit,
        launchTree,
        closure: (fixture.version === 'v4'
          ? FRAME_REFUSER_OPPORTUNITY_V4_CRITICAL_SOURCE_CLOSURE
          : FRAME_REFUSER_OPPORTUNITY_CRITICAL_SOURCE_CLOSURE
        ).map((closurePath) => ({
          path: closurePath,
          sha256: digest(path.join(ROOT, closurePath)),
        })),
      },
      opportunityGate: {
        type: 'prospective_frame_refuser_treatment_opportunity',
        priorArtifactsReused: false,
        priorResultRewritten: false,
        historicalEvidencePooled: false,
        tutorEfficacyTested: false,
        registerEfficacyTested: false,
        heldoutAxisReportSha256: '714f69f489297c571ff4157ce0269e6d3f68ccac485453b53d05cc09d5908c75',
        recoveryBoundary: {
          sameLaunchSource: true,
          sameModelProviderRoute: true,
          sameProfilesPoliciesSeedConfigurationAndMeasurement: true,
          samePayloadAndDataScope: true,
          freshNonOverwritingDestinationForRecoveredUnits: true,
          rerunValidOutputs: false,
          selectAmongOutcomes: false,
          maximumTotalStudyAttemptsUnchanged: fixture.version === 'v4' ? 234 : 288,
        },
      },
      measurement: {
        reportSchema: 'machinespirits.tutor-stub.frame-refuser-opportunity-gate.v1',
        targetProfile: 'frame_refuser',
        controlProfile: 'frame_defiant',
        mustShowByTurn: 2,
        requiredDistinctTargetPrefixes: 3,
        targetObservation: registration.measurement.targetObservation,
        controlObservation: registration.measurement.controlObservation,
        ...(fixture.version === 'v2' || fixture.version === 'v3' || fixture.version === 'v4'
          ? {
              controlParticipationForms: registration.measurement.controlParticipationForms,
              refusalRule: registration.measurement.refusalRule,
            }
          : {}),
        ...(fixture.version === 'v3' || fixture.version === 'v4'
          ? {
              observationSemantics: registration.measurement.observationSemantics,
              jurisdictionRule: registration.measurement.jurisdictionRule,
              productiveParticipationPrecedesWithholding:
                registration.measurement.productiveParticipationPrecedesWithholding,
            }
          : {}),
        analysisTraceSelection: 'exact_profile_trace_files_only',
        analysisSelectorExcludesRunEvents: true,
        frozenFiveAxisObserverChanged: false,
      },
      bindings: {
        registration: { path: registrationPath, sha256: digest(path.join(ROOT, registrationPath)) },
        endpoint: {
          contractPath: endpointPath,
          contractFileSha256: digest(path.join(ROOT, endpointPath)),
          contractCanonicalSha256: certificate.contract_sha256,
          certificatePath,
          certificateFileSha256: digest(path.join(ROOT, certificatePath)),
          preflightSha256: certificate.preflight_sha256,
        },
        routeCanary: {
          resultPath: 'config/tutor-stub-resistant-profile-route-canary-result.v1.json',
          resultSha256: 'c68ee936441504fdb514f97537aaf87915c734b43da82f7d81136c40c6918623',
          authorizationConsumptionPath:
            'config/tutor-stub-resistant-profile-route-canary-authorization.consumed.v1.json',
          authorizationConsumptionSha256: '1ec23bf81df7678050e5383fbda9ab913979b9b93b24fb1944b59002c6eeefb2',
          sourceArtifactSha256: 'a2989dfb48438b7153928244a20ef42f698122b6edb3062fdfecca41ca1ac55f',
          executionHead: '04edc89f943e380bf5fc88bf2d84b93c8c1a805c',
          observedProvider: 'codex',
          observedModel: 'gpt-5.6-luna',
          observedEffort: 'low',
          attestationBasis: 'explicit_cli_model_argument_accepted_bridge_echo',
          modelIndependentlyAttested: false,
        },
        commands: {
          source: 'commands',
          liveArraySha256: commandDigest(live),
          analyzeArraySha256: commandDigest(analyze),
        },
      },
      commands: { live, analyze },
      ...(fixture.version === 'v3' || fixture.version === 'v4'
        ? { repairAdmission: registration.repairAdmission }
        : {}),
      design: {
        profiles: ['frame_refuser', 'frame_defiant'],
        dialogues: 6,
        runsPerProfile: 3,
        runSeed: 20260820,
        world: 'world_005_marrick',
        models: {
          tutor: 'codex.gpt-5.6-luna',
          analysis: 'codex.gpt-5.6-luna',
          learner: 'codex.gpt-5.6-luna',
        },
        cliEffort: 'low',
        parallelism: 3,
        ...(fixture.version === 'v4' ? { plannedRoleCallsPerDialogue: 13, plannedRoleCallsTotal: 78 } : {}),
      },
      budget: {
        dialogues: 6,
        maximumAttemptsPerDialogue: fixture.version === 'v4' ? 39 : 48,
        maximumPlannedModelAttempts: fixture.version === 'v4' ? 234 : 288,
        retryOrResumeAuthority: 'bounded_technical_recovery',
      },
      payload: {
        humanSubjectData: false,
        privateArchiveData: false,
        trainingReuseStatus: 'not_applicable',
      },
      destination: {
        artifactRoot,
        createOnce: true,
        mustNotExistBeforeLaunch: true,
      },
    };
    const requestPath = path.join(temporary, `${fixture.version}-request.json`);
    fs.writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`);
    const report = validateTutorStubResistantProfileStudyGoRequest({ requestPath });
    assert.equal(report.packetValid, true);
    assert.equal(report.readyForExplicitHumanApproval, true);
    assert.equal(report.modelCalls, 0);
    assert.equal(report.productionWrites, 0);
    assert.equal(report.budget.maximumPlannedModelAttempts, fixture.version === 'v4' ? 234 : 288);
    assert.match(report.exactApprovalStatement, /6-dialogue Luna study/u);

    const invalidRequests = [
      {
        name: 'empty-source-closure',
        mutate(value) {
          value.source.closure = [];
        },
        pattern: /frame-refuser-opportunity-source-closure/u,
      },
      {
        name: 'missing-source-closure',
        mutate(value) {
          delete value.source.closure;
        },
        pattern: /frame-refuser-opportunity-source-closure/u,
      },
      {
        name: 'incomplete-critical-source-closure',
        mutate(value) {
          value.source.closure = value.source.closure.slice(1);
        },
        pattern: /frame-refuser-opportunity-critical-source-closure/u,
      },
      {
        name: 'mismatched-control-observation',
        mutate(value) {
          value.measurement.controlObservation = 'wrong_control_semantics';
        },
        pattern: /frame-refuser-opportunity-measurement-binding/u,
      },
      {
        name: 'mismatched-target-observation',
        mutate(value) {
          value.measurement.targetObservation = 'wrong_target_semantics';
        },
        pattern: /frame-refuser-opportunity-measurement-binding/u,
      },
    ];
    if (fixture.version === 'v2' || fixture.version === 'v3' || fixture.version === 'v4') {
      invalidRequests.push(
        {
          name: 'mismatched-refusal-rule',
          mutate(value) {
            value.measurement.refusalRule = 'wrong_refusal_semantics';
          },
          pattern: /frame-refuser-opportunity-measurement-binding/u,
        },
        {
          name: 'mismatched-control-participation-forms',
          mutate(value) {
            value.measurement.controlParticipationForms = ['content_bearing_contribution'];
          },
          pattern: /frame-refuser-opportunity-measurement-binding/u,
        },
      );
    }
    if (fixture.version === 'v3' || fixture.version === 'v4') {
      invalidRequests.push(
        {
          name: 'mismatched-observation-semantics',
          mutate(value) {
            value.measurement.observationSemantics = 'prospective_v2';
          },
          pattern: /frame-refuser-opportunity-measurement-binding/u,
        },
        {
          name: 'mismatched-jurisdiction-rule',
          mutate(value) {
            value.measurement.jurisdictionRule = 'unregistered_rule';
          },
          pattern: /frame-refuser-opportunity-measurement-binding/u,
        },
        {
          name: 'disabled-productive-precedence',
          mutate(value) {
            value.measurement.productiveParticipationPrecedesWithholding = false;
          },
          pattern: /frame-refuser-opportunity-measurement-binding/u,
        },
        {
          name: 'expanded-repair-cap',
          mutate(value) {
            if (fixture.version === 'v4') value.repairAdmission.maxFullRepairsPerT1T2 = 2;
            else value.repairAdmission.maxFullRepairsPer8Turns = 2;
          },
          pattern: new RegExp(`frame-refuser-opportunity-${fixture.version}-repair-admission-binding`, 'u'),
        },
        {
          name: 'invalid-candidate-publication',
          mutate(value) {
            if (fixture.version === 'v4') value.repairAdmission.invalidCandidateMayBePublishedAtOrAfterT2 = true;
            else value.repairAdmission.invalidCandidateMayBePublished = true;
          },
          pattern: new RegExp(`frame-refuser-opportunity-${fixture.version}-repair-admission-binding`, 'u'),
        },
        {
          name: 'missing-runtime-semantics-binding',
          mutate(value) {
            value.commands.live = value.commands.live.slice(2);
            value.bindings.commands.liveArraySha256 = commandDigest(value.commands.live);
          },
          pattern: /frame-refuser-opportunity-live-command-shape/u,
        },
      );
      if (fixture.version === 'v4') {
        invalidRequests.push(
          {
            name: 'expanded-transport-retry-multiplicity',
            mutate(value) {
              value.repairAdmission.transportRetryLimitPerPlannedCall = 3;
            },
            pattern: /frame-refuser-opportunity-v4-repair-admission-binding/u,
          },
          {
            name: 'missing-v4-retry-source-closure',
            mutate(value) {
              value.source.closure = value.source.closure.filter(
                (entry) => entry.path !== 'services/tutorStubCliPolicyRetry.js',
              );
            },
            pattern: /frame-refuser-opportunity-critical-source-closure/u,
          },
        );
      }
    }
    for (const invalid of invalidRequests) {
      const invalidRequest = structuredClone(request);
      invalid.mutate(invalidRequest);
      const invalidPath = path.join(temporary, `${fixture.version}-${invalid.name}.json`);
      fs.writeFileSync(invalidPath, `${JSON.stringify(invalidRequest, null, 2)}\n`);
      const invalidResult = spawnSync(
        process.execPath,
        ['scripts/check-tutor-stub-resistant-profile-study-go-request.js', '--request', invalidPath, '--json'],
        { cwd: ROOT, encoding: 'utf8' },
      );
      assert.notEqual(invalidResult.status, 0, `${fixture.version} ${invalid.name} must fail closed`);
      assert.match(invalidResult.stderr, invalid.pattern);
    }
  }
});

test('future V2 action/register HOLD requests bind both live batches and one combined analysis without authorizing calls', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'action-register-go-fixture-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const digest = (filePath) => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  const commandDigest = (command) => crypto.createHash('sha256').update(JSON.stringify(command)).digest('hex');
  assert.equal(
    digest(path.join(ROOT, RESISTANCE_ACTION_REGISTER_STOPPED_V2_REQUEST.request.path)),
    RESISTANCE_ACTION_REGISTER_STOPPED_V2_REQUEST.request.sha256,
    'the consumed stopped request must retain its exact historical bytes',
  );
  assert.equal(
    digest(path.join(ROOT, RESISTANCE_ACTION_REGISTER_STOPPED_V3_REQUEST.request.path)),
    RESISTANCE_ACTION_REGISTER_STOPPED_V3_REQUEST.request.sha256,
    'the consumed revision-3 successor must retain its exact historical bytes',
  );
  const launchCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const launchTree = execFileSync('git', ['show', '-s', '--format=%T', launchCommit], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  const registrationPath = 'config/tutor-stub-resistance-action-register-crossed-registration.v2.json';
  const prefixBundlePath = 'config/tutor-stub-resistance-action-register-v4-public-prefixes.v1.json';
  const endpointPath = 'config/paid-study-endpoints/tutor-stub-resistance-action-register-baseline.v2.json';
  const certificatePath =
    'config/paid-study-endpoints/tutor-stub-resistance-action-register-baseline.v2.endpoint-go.json';
  const certificate = JSON.parse(fs.readFileSync(path.join(ROOT, certificatePath), 'utf8'));
  const route = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'config/tutor-stub-frame-refuser-opportunity-study-go-request.v4.json'), 'utf8'),
  ).bindings.routeCanary;
  const batchA = `.tutor-stub-auto-eval/action-register-baseline-v2-test-${process.pid}-a`;
  const batchB = `.tutor-stub-auto-eval/action-register-baseline-v2-test-${process.pid}-b`;
  const combinedReport = `.tutor-stub-auto-eval/action-register-baseline-v2-test-${process.pid}-combined.json`;
  const live = ['A', 'B'].map((repeat) => [
    'node',
    'scripts/run-tutor-stub-resistance-action-register-crossed.js',
    '--live-batch',
    '--batch',
    repeat,
    '--destination',
    repeat === 'A' ? batchA : batchB,
    '--registration',
    registrationPath,
    '--prefix-bundle',
    prefixBundlePath,
    '--parallelism',
    '3',
    '--expected-source-commit',
    launchCommit,
  ]);
  const analyze = [
    'node',
    'scripts/analyze-tutor-stub-resistance-action-register-baseline.js',
    '--batch-a',
    batchA,
    '--batch-b',
    batchB,
    '--registration',
    registrationPath,
    '--prefix-bundle',
    prefixBundlePath,
    '--expected-source-commit',
    launchCommit,
    '--out',
    combinedReport,
    '--json',
  ];
  const recovery = [batchA, batchB].map((destination) => [
    'node',
    'scripts/run-tutor-stub-resistance-action-register-crossed.js',
    '--recover-batch',
    '--destination',
    destination,
    '--expected-source-commit',
    launchCommit,
    '--parallelism',
    '3',
  ]);
  const request = {
    schema: 'machinespirits.tutor-stub.resistant-profile-discrimination-study-go-request.v1',
    status: 'HOLD_PENDING_EXPLICIT_HUMAN_APPROVAL',
    studyId: 'tutor-stub-resistance-action-register-frame-refuser-baseline-v2',
    authorization: {
      explicitHumanApproval: null,
      modelCallsAuthorized: false,
      liveRunAuthorized: false,
      standingAuthorizationAttachmentSha256: '4ef020fa2c59d6f7e215029374d7d5adaabc5f620fe1cbd5369020a34e88e08b',
    },
    source: {
      launchCommit,
      launchTree,
      requirements: { headMustEqualLaunchCommit: true, checkoutMustBeClean: true, detachedLaunchWorktree: true },
      closure: RESISTANCE_ACTION_REGISTER_BASELINE_V2_CRITICAL_SOURCE_CLOSURE.map((entry) => ({
        path: entry,
        sha256: digest(path.join(ROOT, entry)),
      })),
    },
    actionRegisterBaseline: {
      type: 'prospective_frame_refuser_action_register_baseline_v2',
      v4RequestSha256: '0c14c51ae8625e6f5db301c9328b8f3182a8dbcd0b6b5a9dd610db85064ee0ab',
      v4ReportSha256: '771076330d58ec8818182a1924e3ea8dd2c8e54bdc1c9f32a822e491f405b431',
      v4PrivateArchiveCommit: 'e5eb71f22f0c36f6e286272caf5b041e71d8e2ba',
      v4PrefixesConsumedAsFrozenInputsOnly: true,
      v4OutcomesPooled: false,
      interimInterpretationPermitted: false,
      outcomeSelectionPermitted: false,
      validUnitRerunsPermitted: false,
      matchedVersusMismatchedEfficacyTested: false,
      edgedRegisterEfficacyTested: false,
      recoveryBoundary: {
        sameLaunchSource: true,
        sameRegistrationPrefixBundleModelsSeedAndMeasurement: true,
        missingOrFailedUnitsOnly: true,
        rerunValidOutputs: false,
        selectAmongOutcomes: false,
        maximumAttemptsPerBatchUnchanged: 234,
        maximumCombinedAttemptsUnchanged: 468,
        programmeCeilingUnchanged: 1200,
      },
    },
    design: {
      profiles: ['frame_refuser'],
      dialogues: 12,
      prefixes: 3,
      realizations: ['plain', 'warm'],
      repeats: ['A', 'B'],
      actionFit: 'matched',
      pedagogicalMove: 'test_bounded_distinction',
      outcomeHorizonLearnerTurns: 2,
      runSeed: 20260820,
      parallelism: 3,
      models: { tutor: 'codex.gpt-5.6-luna', analysis: 'codex.gpt-5.6-luna', learner: 'codex.gpt-5.6-luna' },
      cliEffort: 'low',
    },
    budget: {
      dialogues: 12,
      dialoguesPerBatch: 6,
      maximumAttemptsPerDialogue: 39,
      maximumAttemptsPerBatch: 234,
      maximumPlannedModelAttempts: 468,
      programmeLedgerBefore: 45,
      programmeLedgerAfterMaximum: 513,
      programmeCeiling: 1200,
      retryOrResumeAuthority: 'bounded_technical_recovery',
    },
    measurement: {
      reportSchema: 'machinespirits.tutor-stub.resistance-action-register-baseline-report.v2',
      primaryOutcome: 'profile_specific_resistance_recovery_by_two_post_trigger_learner_turns',
      repeatEndpoint: 'same_treatment_repeat_stability',
      combinedTwelveCellAnalysisRequired: true,
      analysisTraceSelection: 'exact_prebound_batch_result_traces_only',
      partialBatchAnalysisPermitted: false,
      v4OutcomesExcluded: true,
    },
    bindings: {
      registration: { path: registrationPath, sha256: digest(path.join(ROOT, registrationPath)) },
      prefixBundle: { path: prefixBundlePath, sha256: digest(path.join(ROOT, prefixBundlePath)) },
      endpoint: {
        contractPath: endpointPath,
        contractFileSha256: digest(path.join(ROOT, endpointPath)),
        contractCanonicalSha256: certificate.contract_sha256,
        certificatePath,
        certificateFileSha256: digest(path.join(ROOT, certificatePath)),
        preflightSha256: certificate.preflight_sha256,
      },
      routeCanary: route,
      commands: {
        source: 'commands',
        liveArraySha256: commandDigest(live),
        recoveryArraySha256: commandDigest(recovery),
        analyzeArraySha256: commandDigest(analyze),
      },
    },
    commands: { live, recovery, analyze },
    payload: { humanSubjectData: false, privateArchiveData: false, trainingReuseStatus: 'not_applicable' },
    destination: {
      batchA: { artifactRoot: batchA, createOnce: true, mustNotExistBeforeLaunch: true },
      batchB: { artifactRoot: batchB, createOnce: true, mustNotExistBeforeLaunch: true },
      combinedReport,
      combinedReportCreateOnce: true,
    },
  };
  const requestPath = path.join(temporary, 'request.json');
  fs.writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`);
  const report = validateTutorStubResistantProfileStudyGoRequest({ requestPath });
  assert.equal(report.packetValid, true);
  assert.equal(report.modelCalls, 0);
  assert.equal(report.productionWrites, 0);
  assert.equal(report.budget.maximumPlannedModelAttempts, 468);

  const templatePath = path.join(temporary, 'action-register-template.json');
  fs.writeFileSync(templatePath, actionRegisterBaselineTemplateText(request));
  const protectedRoot = createProtectedPackagerCheckout(t, request, 'action-register-v2');
  const output = `config/.test-action-register-go-request-${process.pid}.json`;
  const packaged = spawnSync(
    process.execPath,
    [GO_REQUEST_PACKAGE_SCRIPT, '--template', templatePath, '--launch-commit', launchCommit, '--out', output, '--json'],
    {
      cwd: protectedRoot,
      encoding: 'utf8',
      env: { ...process.env, GIT_NO_LAZY_FETCH: '1', NODE_PATH: '', OPENROUTER_API_KEY: 'must-not-be-used' },
    },
  );
  assert.equal(packaged.status, 0, packaged.stderr);
  const packageReport = JSON.parse(packaged.stdout);
  assert.equal(packageReport.sourceClosureFiles, 32);
  assert.equal(packageReport.repositoryBindingFiles, 6);
  assert.equal(packageReport.isolatedReplay.nodeModulesPresent, false);
  assert.equal(packageReport.isolatedReplay.packetValid, true);
  assert.equal(packageReport.effects.modelCalls, 0);
  assert.deepEqual(
    fs.readFileSync(path.join(protectedRoot, output)),
    fs.readFileSync(requestPath),
    'baseline packager must reproduce the validator-ready HOLD request bytes deterministically',
  );

  const missingExecutor = structuredClone(request);
  missingExecutor.source.closure = missingExecutor.source.closure.filter(
    (entry) => entry.path !== 'services/tutorStubResistanceActionRegisterExecution.js',
  );
  const invalidPath = path.join(temporary, 'missing-executor.json');
  fs.writeFileSync(invalidPath, `${JSON.stringify(missingExecutor, null, 2)}\n`);
  assert.throws(
    () => validateTutorStubResistantProfileStudyGoRequest({ requestPath: invalidPath }),
    /frame-refuser-opportunity-critical-source-closure/u,
  );

  const successor = structuredClone(request);
  successor.actionRegisterBaseline.requestRevision = 3;
  successor.actionRegisterBaseline.priorStoppedExecution = structuredClone(
    RESISTANCE_ACTION_REGISTER_STOPPED_V2_REQUEST,
  );
  successor.budget.programmeLedgerBefore = 76;
  successor.budget.programmeLedgerAfterMaximum = 544;
  const successorBatchA = `${batchA}-successor`;
  const successorBatchB = `${batchB}-successor`;
  const successorCombinedReport = `${combinedReport}.successor.json`;
  successor.destination.batchA.artifactRoot = successorBatchA;
  successor.destination.batchB.artifactRoot = successorBatchB;
  successor.destination.combinedReport = successorCombinedReport;
  successor.commands.live[0][successor.commands.live[0].indexOf('--destination') + 1] = successorBatchA;
  successor.commands.live[1][successor.commands.live[1].indexOf('--destination') + 1] = successorBatchB;
  successor.commands.recovery[0][successor.commands.recovery[0].indexOf('--destination') + 1] = successorBatchA;
  successor.commands.recovery[1][successor.commands.recovery[1].indexOf('--destination') + 1] = successorBatchB;
  successor.commands.analyze[successor.commands.analyze.indexOf('--batch-a') + 1] = successorBatchA;
  successor.commands.analyze[successor.commands.analyze.indexOf('--batch-b') + 1] = successorBatchB;
  successor.commands.analyze[successor.commands.analyze.indexOf('--out') + 1] = successorCombinedReport;
  successor.bindings.commands.liveArraySha256 = commandDigest(successor.commands.live);
  successor.bindings.commands.recoveryArraySha256 = commandDigest(successor.commands.recovery);
  successor.bindings.commands.analyzeArraySha256 = commandDigest(successor.commands.analyze);
  const successorPath = path.join(temporary, 'successor-request.json');
  fs.writeFileSync(successorPath, `${JSON.stringify(successor, null, 2)}\n`);
  const successorReport = validateTutorStubResistantProfileStudyGoRequest({ requestPath: successorPath });
  assert.equal(successorReport.packetValid, true);
  assert.equal(successorReport.budget.programmeLedgerBefore, 76);
  assert.equal(successorReport.budget.programmeLedgerAfterMaximum, 544);

  const successorTemplatePath = path.join(temporary, 'action-register-successor-template.json');
  fs.writeFileSync(successorTemplatePath, actionRegisterBaselineTemplateText(successor));
  const successorProtectedRoot = createProtectedPackagerCheckout(t, successor, 'action-register-v2-successor');
  const successorOutput = `config/.test-action-register-successor-go-request-${process.pid}.json`;
  const successorPackaged = spawnSync(
    process.execPath,
    [
      GO_REQUEST_PACKAGE_SCRIPT,
      '--template',
      successorTemplatePath,
      '--launch-commit',
      launchCommit,
      '--out',
      successorOutput,
      '--json',
    ],
    {
      cwd: successorProtectedRoot,
      encoding: 'utf8',
      env: { ...process.env, GIT_NO_LAZY_FETCH: '1', NODE_PATH: '', OPENROUTER_API_KEY: 'must-not-be-used' },
    },
  );
  assert.equal(successorPackaged.status, 0, successorPackaged.stderr);
  const successorPackageReport = JSON.parse(successorPackaged.stdout);
  assert.equal(successorPackageReport.repositoryBindingFiles, 7);
  assert.equal(successorPackageReport.isolatedReplay.nodeModulesPresent, false);
  assert.equal(successorPackageReport.effects.modelCalls, 0);
  assert.deepEqual(
    fs.readFileSync(path.join(successorProtectedRoot, successorOutput)),
    fs.readFileSync(successorPath),
    'successor packager must reproduce the exact stopped-exclusion HOLD request bytes',
  );

  for (const invalid of [
    {
      name: 'wrong-successor-ledger',
      mutate(value) {
        value.budget.programmeLedgerBefore = 45;
      },
      pattern: /action-register-baseline-budget-binding/u,
    },
    {
      name: 'changed-stopped-trace',
      mutate(value) {
        value.actionRegisterBaseline.priorStoppedExecution.partialBatch.traces[0].sha256 = '0'.repeat(64);
      },
      pattern: /action-register-successor-stopped-exclusion-binding/u,
    },
    {
      name: 'stopped-unit-reuse',
      mutate(value) {
        value.actionRegisterBaseline.priorStoppedExecution.reusePermitted = true;
      },
      pattern: /action-register-successor-stopped-exclusion-binding/u,
    },
    {
      name: 'recovery-command-drift',
      mutate(value) {
        value.commands.recovery[0].push('--keep-going');
        value.bindings.commands.recoveryArraySha256 = commandDigest(value.commands.recovery);
      },
      pattern: /action-register-baseline-recovery-commands/u,
    },
  ]) {
    const invalidSuccessor = structuredClone(successor);
    invalid.mutate(invalidSuccessor);
    const invalidSuccessorPath = path.join(temporary, `${invalid.name}.json`);
    fs.writeFileSync(invalidSuccessorPath, `${JSON.stringify(invalidSuccessor, null, 2)}\n`);
    assert.throws(
      () => validateTutorStubResistantProfileStudyGoRequest({ requestPath: invalidSuccessorPath }),
      invalid.pattern,
    );
  }

  const secondSuccessor = structuredClone(successor);
  secondSuccessor.actionRegisterBaseline.requestRevision = 4;
  secondSuccessor.actionRegisterBaseline.priorStoppedExecution = structuredClone(
    RESISTANCE_ACTION_REGISTER_STOPPED_V3_REQUEST,
  );
  secondSuccessor.budget.programmeLedgerBefore = 109;
  secondSuccessor.budget.programmeLedgerAfterMaximum = 577;
  const secondSuccessorBatchA = `${batchA}-second-successor`;
  const secondSuccessorBatchB = `${batchB}-second-successor`;
  const secondSuccessorCombinedReport = `${combinedReport}.second-successor.json`;
  secondSuccessor.destination.batchA.artifactRoot = secondSuccessorBatchA;
  secondSuccessor.destination.batchB.artifactRoot = secondSuccessorBatchB;
  secondSuccessor.destination.combinedReport = secondSuccessorCombinedReport;
  secondSuccessor.commands.live[0][secondSuccessor.commands.live[0].indexOf('--destination') + 1] =
    secondSuccessorBatchA;
  secondSuccessor.commands.live[1][secondSuccessor.commands.live[1].indexOf('--destination') + 1] =
    secondSuccessorBatchB;
  secondSuccessor.commands.recovery[0][secondSuccessor.commands.recovery[0].indexOf('--destination') + 1] =
    secondSuccessorBatchA;
  secondSuccessor.commands.recovery[1][secondSuccessor.commands.recovery[1].indexOf('--destination') + 1] =
    secondSuccessorBatchB;
  secondSuccessor.commands.analyze[secondSuccessor.commands.analyze.indexOf('--batch-a') + 1] = secondSuccessorBatchA;
  secondSuccessor.commands.analyze[secondSuccessor.commands.analyze.indexOf('--batch-b') + 1] = secondSuccessorBatchB;
  secondSuccessor.commands.analyze[secondSuccessor.commands.analyze.indexOf('--out') + 1] =
    secondSuccessorCombinedReport;
  secondSuccessor.bindings.commands.liveArraySha256 = commandDigest(secondSuccessor.commands.live);
  secondSuccessor.bindings.commands.recoveryArraySha256 = commandDigest(secondSuccessor.commands.recovery);
  secondSuccessor.bindings.commands.analyzeArraySha256 = commandDigest(secondSuccessor.commands.analyze);
  const secondSuccessorPath = path.join(temporary, 'second-successor-request.json');
  fs.writeFileSync(secondSuccessorPath, `${JSON.stringify(secondSuccessor, null, 2)}\n`);
  const secondSuccessorReport = validateTutorStubResistantProfileStudyGoRequest({
    requestPath: secondSuccessorPath,
  });
  assert.equal(secondSuccessorReport.packetValid, true);
  assert.equal(secondSuccessorReport.budget.programmeLedgerBefore, 109);
  assert.equal(secondSuccessorReport.budget.programmeLedgerAfterMaximum, 577);

  const secondSuccessorTemplatePath = path.join(temporary, 'action-register-second-successor-template.json');
  fs.writeFileSync(secondSuccessorTemplatePath, actionRegisterBaselineTemplateText(secondSuccessor));
  const secondSuccessorProtectedRoot = createProtectedPackagerCheckout(
    t,
    secondSuccessor,
    'action-register-v2-second-successor',
  );
  const secondSuccessorOutput = `config/.test-action-register-second-successor-go-request-${process.pid}.json`;
  const secondSuccessorPackaged = spawnSync(
    process.execPath,
    [
      GO_REQUEST_PACKAGE_SCRIPT,
      '--template',
      secondSuccessorTemplatePath,
      '--launch-commit',
      launchCommit,
      '--out',
      secondSuccessorOutput,
      '--json',
    ],
    {
      cwd: secondSuccessorProtectedRoot,
      encoding: 'utf8',
      env: { ...process.env, GIT_NO_LAZY_FETCH: '1', NODE_PATH: '', OPENROUTER_API_KEY: 'must-not-be-used' },
    },
  );
  assert.equal(secondSuccessorPackaged.status, 0, secondSuccessorPackaged.stderr);
  const secondSuccessorPackageReport = JSON.parse(secondSuccessorPackaged.stdout);
  assert.equal(secondSuccessorPackageReport.repositoryBindingFiles, 7);
  assert.equal(secondSuccessorPackageReport.isolatedReplay.nodeModulesPresent, false);
  assert.equal(secondSuccessorPackageReport.effects.modelCalls, 0);
  assert.deepEqual(
    fs.readFileSync(path.join(secondSuccessorProtectedRoot, secondSuccessorOutput)),
    fs.readFileSync(secondSuccessorPath),
    'second-successor packager must reproduce the exact stopped-exclusion HOLD request bytes',
  );

  for (const invalid of [
    {
      name: 'wrong-second-successor-ledger',
      mutate(value) {
        value.budget.programmeLedgerBefore = 76;
      },
      pattern: /action-register-baseline-budget-binding/u,
    },
    {
      name: 'changed-second-stopped-trace',
      mutate(value) {
        value.actionRegisterBaseline.priorStoppedExecution.partialBatch.traces[5].sha256 = '0'.repeat(64);
      },
      pattern: /action-register-successor-stopped-exclusion-binding/u,
    },
    {
      name: 'second-stopped-unit-reuse',
      mutate(value) {
        value.actionRegisterBaseline.priorStoppedExecution.poolingPermitted = true;
      },
      pattern: /action-register-successor-stopped-exclusion-binding/u,
    },
  ]) {
    const invalidSecondSuccessor = structuredClone(secondSuccessor);
    invalid.mutate(invalidSecondSuccessor);
    const invalidSecondSuccessorPath = path.join(temporary, `${invalid.name}.json`);
    fs.writeFileSync(invalidSecondSuccessorPath, `${JSON.stringify(invalidSecondSuccessor, null, 2)}\n`);
    assert.throws(
      () => validateTutorStubResistantProfileStudyGoRequest({ requestPath: invalidSecondSuccessorPath }),
      invalid.pattern,
    );
  }
});

test('sealed action/register analysis-only request binds completed batches and authorizes no model call', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'action-register-analysis-only-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const digest = (filePath) => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  const commandDigest = (command) => crypto.createHash('sha256').update(JSON.stringify(command)).digest('hex');
  const launchCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const launchTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const registrationPath = 'config/tutor-stub-resistance-action-register-crossed-registration.v2.json';
  const prefixBundlePath = 'config/tutor-stub-resistance-action-register-v4-public-prefixes.v1.json';
  const endpointPath = 'config/paid-study-endpoints/tutor-stub-resistance-action-register-baseline.v2.json';
  const certificatePath =
    'config/paid-study-endpoints/tutor-stub-resistance-action-register-baseline.v2.endpoint-go.json';
  const certificate = JSON.parse(fs.readFileSync(path.join(ROOT, certificatePath), 'utf8'));
  const route = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'config/tutor-stub-frame-refuser-opportunity-study-go-request.v4.json'), 'utf8'),
  ).bindings.routeCanary;
  const combinedReport = `.tutor-stub-auto-eval/action-register-analysis-only-${process.pid}.json`;
  const sealedInputs = {
    priorRequest: {
      path: 'config/tutor-stub-resistance-action-register-baseline-study-go-request.v4.json',
      sha256: 'a2bf1d15de24f358518569ac5af7a3ddcfa78150aa4d89a7c038490f912f8806',
    },
    traceSourceCommit: '58aa961600368fa98387942572c187a1896aae3f',
    traceSourceTree: 'de5e05836b867bac5fa9071d845aefbb6d21abd0',
    batchA: {
      artifactRoot: '.tutor-stub-auto-eval/resistance-action-register-baseline-v2-second-successor-live-2026-08-20-a',
      artifactRootManifestSha256: '54565be283273d852bf36004f55ff276dd11fb6be785300b2c6e5631172d2add',
      privateArchiveManifestSha256: 'e60cb5cbccf5b49d45c80f9266194403190b7c5c0737ea3bcd4a4fb6c24b4950',
      batchPlanSha256: '604a9567916f716df7812bff08d9a509ce2f93b298c3045792dec5f159899112',
      batchResultSha256: 'c0d07d64e5d6d3604fbdb53c6abcf05508f75214eb7f8053cb5c4ff0adefff73',
      batchSealSha256: '04dca756801c3f7df8994b3190957f2bb3e3b23ea375a06bd2c6c5693e98196a',
      reservations: 36,
      completed: 36,
      providerErrors: 0,
      aborted: 0,
      traces: [
        ['frame_refuser-v4-r1-t1__matched_plain_A', '481101593b977ba1a25bc8d1dbb120ccfb09a0d609c2d6d271cdd1fe0a7d6c74'],
        ['frame_refuser-v4-r1-t1__matched_warm_A', 'b876fab7d707784168540eaba74c50b529062277cb76cabca97c65bdec9046f7'],
        ['frame_refuser-v4-r2-t1__matched_plain_A', 'd1e756962a794a6110c0589b4d7eadabf0f65e135b5757cfd963e9919e744581'],
        ['frame_refuser-v4-r2-t1__matched_warm_A', '15223bf2fd74c8cdd4082a812005cbb08f51806ae242787efa3d2fee261c43ef'],
        ['frame_refuser-v4-r3-t1__matched_plain_A', '883330168aea699d1e8a2ca7d56a139fec59f4353691921ec5c5531bb7daf9ac'],
        ['frame_refuser-v4-r3-t1__matched_warm_A', '49b172e0724948c17aa02b24c26610fe75f086fa65d4f2d028dd0ce7c63b4c47'],
      ].map(([jobId, sha256]) => ({ jobId, sha256 })),
    },
    batchB: {
      artifactRoot: '.tutor-stub-auto-eval/resistance-action-register-baseline-v2-second-successor-live-2026-08-20-b',
      artifactRootManifestSha256: '71e1ca7267f6b3ff561357bb48b4cac172c84b2f37d8d86dc4f63db5d0437c33',
      privateArchiveManifestSha256: 'e673f376f405d5692e7b26e998c233a481e00817dbd4bac6a5a6512d80d2f9d1',
      batchPlanSha256: '39ff10a256eac09e527ec961eb5cf9c42523d25a6cf4d32a1606241f020ff29d',
      batchResultSha256: 'cfca0047b91d9d17c30e2702e70423debafe868d03a5053863fad30de72f8244',
      batchSealSha256: '6c1d3e90b4d60a7e4a1a88a3c3b3fc303d825d53b1f8c2f737b0436fb317698f',
      reservations: 40,
      completed: 40,
      providerErrors: 0,
      aborted: 0,
      traces: [
        ['frame_refuser-v4-r1-t1__matched_plain_B', 'd6ae48dca1bd9a24fec4901ec9b512b329937d5ecbe4537f4452a2c0cfc986f8'],
        ['frame_refuser-v4-r1-t1__matched_warm_B', '0f1242ef4327f34fc881b31ef2db95a326455ea7807e1dfcee123ddafec1cb09'],
        ['frame_refuser-v4-r2-t1__matched_plain_B', 'c196b46055bed2c0a36753f415349ab621e3f55bfc94870fd8bd7fb8f0555fad'],
        ['frame_refuser-v4-r2-t1__matched_warm_B', '0376f7e52ecfa60a6d457399291dffb3ac82ae3812221b5ca6ea99f9aa96dff1'],
        ['frame_refuser-v4-r3-t1__matched_plain_B', '1f34e17fb14e94e2365b515796c19fe5263a254b7a34c67b96e5ec1de32596a6'],
        ['frame_refuser-v4-r3-t1__matched_warm_B', '99a1e5f749dd84f30542d3ee1b9cc07d472ad7df0bc73ebf019fd3f9d568d379'],
      ].map(([jobId, sha256]) => ({ jobId, sha256 })),
    },
    combinedArtifactManifestSha256: 'a9157ce7aff357a8c6c704327b5806c3a7dcf55ebdf54b623a775846c641822b',
    combinedPrivateArchiveManifestSha256: '88a65c82da36c36b68e94ee0114b7fc5b429eee523212b43384f724a04817c17',
    reservations: 76,
    completed: 76,
    providerErrors: 0,
    aborted: 0,
    technicalRecoveryRuns: 0,
    programmeLedgerBefore: 185,
    programmeLedgerAfterMaximum: 185,
    programmeCeiling: 1200,
  };
  const analyze = [
    'node',
    'scripts/analyze-tutor-stub-resistance-action-register-baseline.js',
    '--batch-a',
    sealedInputs.batchA.artifactRoot,
    '--batch-b',
    sealedInputs.batchB.artifactRoot,
    '--registration',
    registrationPath,
    '--prefix-bundle',
    prefixBundlePath,
    '--expected-analysis-source-commit',
    launchCommit,
    '--expected-trace-source-commit',
    sealedInputs.traceSourceCommit,
    '--out',
    combinedReport,
    '--json',
  ];
  const request = {
    schema: 'machinespirits.tutor-stub.resistant-profile-discrimination-study-go-request.v1',
    status: 'HOLD_PENDING_EXPLICIT_HUMAN_APPROVAL',
    studyId: 'tutor-stub-resistance-action-register-frame-refuser-baseline-v2',
    authorization: {
      explicitHumanApproval: null,
      modelCallsAuthorized: false,
      liveRunAuthorized: false,
      standingAuthorizationAttachmentSha256: '4ef020fa2c59d6f7e215029374d7d5adaabc5f620fe1cbd5369020a34e88e08b',
    },
    source: {
      launchCommit,
      launchTree,
      requirements: { headMustEqualLaunchCommit: true, checkoutMustBeClean: true, detachedLaunchWorktree: true },
      closure: RESISTANCE_ACTION_REGISTER_BASELINE_V2_CRITICAL_SOURCE_CLOSURE.map((entry) => ({
        path: entry,
        sha256: digest(path.join(ROOT, entry)),
      })),
    },
    actionRegisterBaselineAnalysis: {
      type: 'sealed_frame_refuser_action_register_baseline_analysis_only_v1',
      sealedInputs,
      priorAnalyzerInvocation: {
        invokedOnce: true,
        exitCode: 1,
        reportProduced: false,
        failureClass: 'deterministic_provenance_compatibility_defect',
      },
      modelUnitRerunsPermitted: false,
      liveCommandsPermitted: false,
      recoveryCommandsPermitted: false,
      analyzerInvocationsPermitted: 1,
      inputMutationPermitted: false,
      poolingPermitted: false,
      outcomeSelectionPermitted: false,
      inputView: {
        mode: 'read_only_symlink_view',
        relativeBatchRootsPreserved: true,
        sourceBatchRootsRemainImmutable: true,
        requireObservedManifestHashesBeforeAnalysis: true,
        modelCallsPermitted: false,
        evidenceMutationPermitted: false,
      },
    },
    design: { dialogues: 12, analysisOnly: true, modelCalls: 0, validUnitReruns: false, outcomeSelection: false },
    budget: {
      maximumPlannedModelAttempts: 0,
      programmeLedgerBefore: 185,
      programmeLedgerAfterMaximum: 185,
      programmeCeiling: 1200,
      retryOrResumeAuthority: 'none',
    },
    measurement: {
      reportSchema: 'machinespirits.tutor-stub.resistance-action-register-baseline-report.v2',
      primaryOutcome: 'profile_specific_resistance_recovery_by_two_post_trigger_learner_turns',
      repeatEndpoint: 'same_treatment_repeat_stability',
      combinedTwelveCellAnalysisRequired: true,
      analysisTraceSelection: 'exact_prebound_batch_result_traces_only',
      partialBatchAnalysisPermitted: false,
      v4OutcomesExcluded: true,
      claimBoundary: 'calibration_only_no_tutor_or_register_efficacy_claim',
    },
    bindings: {
      registration: { path: registrationPath, sha256: digest(path.join(ROOT, registrationPath)) },
      prefixBundle: { path: prefixBundlePath, sha256: digest(path.join(ROOT, prefixBundlePath)) },
      endpoint: {
        contractPath: endpointPath,
        contractFileSha256: digest(path.join(ROOT, endpointPath)),
        contractCanonicalSha256: certificate.contract_sha256,
        certificatePath,
        certificateFileSha256: digest(path.join(ROOT, certificatePath)),
        preflightSha256: certificate.preflight_sha256,
      },
      routeCanary: route,
      commands: { source: 'commands', analyzeArraySha256: commandDigest(analyze) },
    },
    commands: { analyze },
    payload: { humanSubjectData: false, privateArchiveData: false, trainingReuseStatus: 'not_applicable' },
    destination: { combinedReport, combinedReportCreateOnce: true, mustNotExistBeforeAnalysis: true },
  };
  const requestPath = path.join(temporary, 'analysis-only-request.json');
  fs.writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`);
  const report = validateTutorStubResistantProfileStudyGoRequest({ requestPath });
  assert.equal(report.packetValid, true);
  assert.equal(report.modelCalls, 0);
  assert.equal(report.productionWrites, 0);
  assert.equal(report.budget.maximumPlannedModelAttempts, 0);

  const templatePath = path.join(temporary, 'analysis-only-template.json');
  fs.writeFileSync(templatePath, actionRegisterBaselineTemplateText(request));
  const protectedRoot = createProtectedPackagerCheckout(t, request, 'action-register-analysis-only');
  const output = `config/.test-action-register-analysis-only-${process.pid}.json`;
  const packaged = spawnSync(
    process.execPath,
    [GO_REQUEST_PACKAGE_SCRIPT, '--template', templatePath, '--launch-commit', launchCommit, '--out', output, '--json'],
    {
      cwd: protectedRoot,
      encoding: 'utf8',
      env: { ...process.env, GIT_NO_LAZY_FETCH: '1', NODE_PATH: '', OPENROUTER_API_KEY: 'must-not-be-used' },
    },
  );
  assert.equal(packaged.status, 0, packaged.stderr);
  const packageReport = JSON.parse(packaged.stdout);
  assert.equal(packageReport.sourceClosureFiles, 32);
  assert.equal(packageReport.repositoryBindingFiles, 7);
  assert.equal(packageReport.isolatedReplay.packetValid, true);
  assert.equal(packageReport.effects.modelCalls, 0);
  assert.deepEqual(fs.readFileSync(path.join(protectedRoot, output)), fs.readFileSync(requestPath));

  for (const invalid of [
    {
      name: 'changed-sealed-trace',
      mutate(value) {
        value.actionRegisterBaselineAnalysis.sealedInputs.batchB.traces[5].sha256 = '0'.repeat(64);
      },
      pattern: /action-register-analysis-only-sealed-input-binding/u,
    },
    {
      name: 'live-command-added',
      mutate(value) {
        value.commands.live = ['node', 'scripts/run-tutor-stub-resistance-action-register-crossed.js'];
      },
      pattern: /analysis-only-no-live-command/u,
    },
    {
      name: 'model-budget-added',
      mutate(value) {
        value.budget.maximumPlannedModelAttempts = 1;
      },
      pattern: /action-register-analysis-only-budget-binding/u,
    },
    {
      name: 'trace-source-drift',
      mutate(value) {
        value.actionRegisterBaselineAnalysis.sealedInputs.traceSourceCommit = launchCommit;
      },
      pattern: /action-register-analysis-only-sealed-input-binding/u,
    },
    {
      name: 'mutable-input-view',
      mutate(value) {
        value.actionRegisterBaselineAnalysis.inputView.evidenceMutationPermitted = true;
      },
      pattern: /action-register-analysis-only-boundary/u,
    },
  ]) {
    const mutated = structuredClone(request);
    invalid.mutate(mutated);
    const invalidPath = path.join(temporary, `${invalid.name}.json`);
    fs.writeFileSync(invalidPath, `${JSON.stringify(mutated, null, 2)}\n`);
    assert.throws(() => validateTutorStubResistantProfileStudyGoRequest({ requestPath: invalidPath }), invalid.pattern);
  }
});

function replaceJsonFieldWithMarker(source, key, value, marker) {
  const expected = `${JSON.stringify(key)}: ${JSON.stringify(value)}`;
  const count = source.split(expected).length - 1;
  assert.equal(count, 1, `expected one ${key}=${JSON.stringify(value)} field while constructing the fixture template`);
  return source.replace(expected, `${JSON.stringify(key)}: ${JSON.stringify(marker)}`);
}

function moveMarkerToIgnoredField(source, marker, retainedValue, ignoredKey) {
  const token = JSON.stringify(marker);
  assert.equal(source.split(token).length - 1, 1, `expected one ${marker} marker before moving it`);
  const retained = source.replace(token, JSON.stringify(retainedValue));
  return retained.replace('"status":', `${JSON.stringify(ignoredKey)}: ${token},\n  "status":`);
}

function actionRegisterBaselineTemplateText(request) {
  let source = `${JSON.stringify(request, null, 2)}\n`;
  source = replaceJsonFieldWithMarker(
    source,
    'launchCommit',
    request.source.launchCommit,
    GO_REQUEST_PACKAGE_MARKERS.sourceCommit,
  );
  source = replaceJsonFieldWithMarker(
    source,
    'launchTree',
    request.source.launchTree,
    GO_REQUEST_PACKAGE_MARKERS.sourceTree,
  );
  for (const entry of request.source.closure) {
    source = replaceJsonFieldWithMarker(source, 'sha256', entry.sha256, goRequestFileSha256Marker(entry.path));
  }
  for (const binding of [request.bindings.registration, request.bindings.prefixBundle]) {
    source = replaceJsonFieldWithMarker(source, 'sha256', binding.sha256, goRequestFileSha256Marker(binding.path));
  }
  const priorStoppedRequest = request.actionRegisterBaseline?.priorStoppedExecution?.request;
  const priorAnalysisRequest = request.actionRegisterBaselineAnalysis?.sealedInputs?.priorRequest;
  const priorRequest = priorStoppedRequest ?? priorAnalysisRequest;
  if (priorRequest) {
    source = replaceJsonFieldWithMarker(
      source,
      'sha256',
      priorRequest.sha256,
      goRequestFileSha256Marker(priorRequest.path),
    );
  }
  source = replaceJsonFieldWithMarker(
    source,
    'contractFileSha256',
    request.bindings.endpoint.contractFileSha256,
    goRequestFileSha256Marker(request.bindings.endpoint.contractPath),
  );
  source = replaceJsonFieldWithMarker(
    source,
    'contractCanonicalSha256',
    request.bindings.endpoint.contractCanonicalSha256,
    GO_REQUEST_PACKAGE_MARKERS.endpointCanonicalSha256,
  );
  source = replaceJsonFieldWithMarker(
    source,
    'certificateFileSha256',
    request.bindings.endpoint.certificateFileSha256,
    goRequestFileSha256Marker(request.bindings.endpoint.certificatePath),
  );
  source = replaceJsonFieldWithMarker(
    source,
    'preflightSha256',
    request.bindings.endpoint.preflightSha256,
    GO_REQUEST_PACKAGE_MARKERS.endpointPreflightSha256,
  );
  source = replaceJsonFieldWithMarker(
    source,
    'resultSha256',
    request.bindings.routeCanary.resultSha256,
    goRequestFileSha256Marker(request.bindings.routeCanary.resultPath),
  );
  source = replaceJsonFieldWithMarker(
    source,
    'authorizationConsumptionSha256',
    request.bindings.routeCanary.authorizationConsumptionSha256,
    goRequestFileSha256Marker(request.bindings.routeCanary.authorizationConsumptionPath),
  );
  for (const [key, marker] of [
    ['sourceArtifactSha256', GO_REQUEST_PACKAGE_MARKERS.routeSourceArtifactSha256],
    ['executionHead', GO_REQUEST_PACKAGE_MARKERS.routeExecutionHead],
    ['observedProvider', GO_REQUEST_PACKAGE_MARKERS.routeProvider],
    ['observedModel', GO_REQUEST_PACKAGE_MARKERS.routeModel],
    ['observedEffort', GO_REQUEST_PACKAGE_MARKERS.routeEffort],
    ['attestationBasis', GO_REQUEST_PACKAGE_MARKERS.routeAttestationBasis],
    ['modelIndependentlyAttested', GO_REQUEST_PACKAGE_MARKERS.routeModelIndependentlyAttested],
  ]) {
    source = replaceJsonFieldWithMarker(source, key, request.bindings.routeCanary[key], marker);
  }
  if (request.bindings.commands.liveArraySha256) {
    source = replaceJsonFieldWithMarker(
      source,
      'liveArraySha256',
      request.bindings.commands.liveArraySha256,
      GO_REQUEST_PACKAGE_MARKERS.liveCommandSha256,
    );
  }
  if (request.bindings.commands.recoveryArraySha256) {
    source = replaceJsonFieldWithMarker(
      source,
      'recoveryArraySha256',
      request.bindings.commands.recoveryArraySha256,
      GO_REQUEST_PACKAGE_MARKERS.recoveryCommandSha256,
    );
  }
  return replaceJsonFieldWithMarker(
    source,
    'analyzeArraySha256',
    request.bindings.commands.analyzeArraySha256,
    GO_REQUEST_PACKAGE_MARKERS.analyzeCommandSha256,
  );
}

function frameRefuserV2TemplateText() {
  const request = JSON.parse(fs.readFileSync(FRAME_REFUSER_V2_REQUEST_PATH, 'utf8'));
  let source = fs.readFileSync(FRAME_REFUSER_V2_REQUEST_PATH, 'utf8');
  source = replaceJsonFieldWithMarker(
    source,
    'launchCommit',
    request.source.launchCommit,
    GO_REQUEST_PACKAGE_MARKERS.sourceCommit,
  );
  source = replaceJsonFieldWithMarker(
    source,
    'launchTree',
    request.source.launchTree,
    GO_REQUEST_PACKAGE_MARKERS.sourceTree,
  );
  for (const entry of request.source.closure) {
    source = replaceJsonFieldWithMarker(source, 'sha256', entry.sha256, goRequestFileSha256Marker(entry.path));
  }
  source = replaceJsonFieldWithMarker(
    source,
    'sha256',
    request.bindings.registration.sha256,
    goRequestFileSha256Marker(request.bindings.registration.path),
  );
  source = replaceJsonFieldWithMarker(
    source,
    'contractFileSha256',
    request.bindings.endpoint.contractFileSha256,
    goRequestFileSha256Marker(request.bindings.endpoint.contractPath),
  );
  source = replaceJsonFieldWithMarker(
    source,
    'contractCanonicalSha256',
    request.bindings.endpoint.contractCanonicalSha256,
    GO_REQUEST_PACKAGE_MARKERS.endpointCanonicalSha256,
  );
  source = replaceJsonFieldWithMarker(
    source,
    'certificateFileSha256',
    request.bindings.endpoint.certificateFileSha256,
    goRequestFileSha256Marker(request.bindings.endpoint.certificatePath),
  );
  source = replaceJsonFieldWithMarker(
    source,
    'preflightSha256',
    request.bindings.endpoint.preflightSha256,
    GO_REQUEST_PACKAGE_MARKERS.endpointPreflightSha256,
  );
  source = replaceJsonFieldWithMarker(
    source,
    'resultSha256',
    request.bindings.routeCanary.resultSha256,
    goRequestFileSha256Marker(request.bindings.routeCanary.resultPath),
  );
  source = replaceJsonFieldWithMarker(
    source,
    'authorizationConsumptionSha256',
    request.bindings.routeCanary.authorizationConsumptionSha256,
    goRequestFileSha256Marker(request.bindings.routeCanary.authorizationConsumptionPath),
  );
  for (const [key, marker] of [
    ['sourceArtifactSha256', GO_REQUEST_PACKAGE_MARKERS.routeSourceArtifactSha256],
    ['executionHead', GO_REQUEST_PACKAGE_MARKERS.routeExecutionHead],
    ['observedProvider', GO_REQUEST_PACKAGE_MARKERS.routeProvider],
    ['observedModel', GO_REQUEST_PACKAGE_MARKERS.routeModel],
    ['observedEffort', GO_REQUEST_PACKAGE_MARKERS.routeEffort],
    ['attestationBasis', GO_REQUEST_PACKAGE_MARKERS.routeAttestationBasis],
    ['modelIndependentlyAttested', GO_REQUEST_PACKAGE_MARKERS.routeModelIndependentlyAttested],
  ]) {
    source = replaceJsonFieldWithMarker(source, key, request.bindings.routeCanary[key], marker);
  }
  source = replaceJsonFieldWithMarker(
    source,
    'requestSha256',
    request.opportunityGate.historicalOpportunityV1.requestSha256,
    goRequestFileSha256Marker(request.opportunityGate.historicalOpportunityV1.requestPath),
  );
  source = replaceJsonFieldWithMarker(
    source,
    'liveArraySha256',
    request.bindings.commands.liveArraySha256,
    GO_REQUEST_PACKAGE_MARKERS.liveCommandSha256,
  );
  return replaceJsonFieldWithMarker(
    source,
    'analyzeArraySha256',
    request.bindings.commands.analyzeArraySha256,
    GO_REQUEST_PACKAGE_MARKERS.analyzeCommandSha256,
  );
}

test('GO request packaging materializes the approved request bytes deterministically without granting authority', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'go-request-package-'));
  const templatePath = path.join(temporary, 'authored-hold-template.json');
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  fs.writeFileSync(templatePath, frameRefuserV2TemplateText());
  const request = JSON.parse(fs.readFileSync(FRAME_REFUSER_V2_REQUEST_PATH, 'utf8'));
  const protectedRoot = createProtectedPackagerCheckout(t, request, 'historical');
  const firstOutput = `config/.test-packaged-go-request-${process.pid}-1.json`;
  const secondOutput = `config/.test-packaged-go-request-${process.pid}-2.json`;
  const first = path.join(protectedRoot, firstOutput);
  const second = path.join(protectedRoot, secondOutput);
  const args = [
    GO_REQUEST_PACKAGE_SCRIPT,
    '--template',
    templatePath,
    '--launch-commit',
    request.source.launchCommit,
    '--json',
  ];
  const run = (output) =>
    spawnSync(process.execPath, [...args, '--out', output], {
      cwd: protectedRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_NO_LAZY_FETCH: '1',
        NODE_PATH: '',
        OPENROUTER_API_KEY: 'must-not-be-used-by-zero-call-packager',
      },
    });

  const firstRun = run(firstOutput);
  assert.equal(firstRun.status, 0, firstRun.stderr);
  const report = JSON.parse(firstRun.stdout);
  const expectedBytes = fs.readFileSync(FRAME_REFUSER_V2_REQUEST_PATH);
  const firstBytes = fs.readFileSync(first);
  assert.equal(fs.statSync(first).mode & 0o777, 0o644, 'tracked request output should use ordinary non-secret mode');
  assert.deepEqual(
    firstBytes,
    expectedBytes,
    'the authored template must reproduce the committed v2 request byte-for-byte',
  );
  assert.equal(report.status, 'PACKAGED_HOLD_REQUIRES_EXPLICIT_HUMAN_APPROVAL');
  assert.equal(report.requestSha256, '2c77c131c2803e4af37eea3c8cbfb38e2ba423d645ab98739d661c5778c22c04');
  assert.equal(report.launchCommit, request.source.launchCommit);
  assert.equal(report.launchTree, request.source.launchTree);
  assert.equal(report.sourceClosureFiles, 19);
  assert.equal(report.repositoryBindingFiles, 6);
  assert.equal(report.protectedWorktreeBytesMatchLaunchCommit, true);
  assert.equal(report.fullCheckoutCleanlinessClaimed, false);
  assert.deepEqual(report.isolatedReplay, {
    nodeModulesPresent: false,
    packetValid: true,
    readyForExplicitHumanApproval: true,
    checksPassed: report.isolatedReplay.checksPassed,
    modelCalls: 0,
    productionWrites: 0,
    exactApprovalStatement: report.authorizationBoundary.exactApprovalStatement,
  });
  assert.ok(Number.isInteger(report.isolatedReplay.checksPassed) && report.isolatedReplay.checksPassed > 0);
  assert.deepEqual(report.effects, {
    requestFilesWritten: 1,
    proofArtifactsWritten: 0,
    modelCalls: 0,
    productionWrites: 0,
  });
  assert.equal(report.authorizationBoundary.explicitHumanApproval, null);
  assert.equal(report.authorizationBoundary.modelCallsAuthorized, false);
  assert.equal(report.authorizationBoundary.liveRunAuthorized, false);
  assert.match(report.authorizationBoundary.disposition, /not authorization/u);

  const secondRun = run(secondOutput);
  assert.equal(secondRun.status, 0, secondRun.stderr);
  assert.deepEqual(fs.readFileSync(second), firstBytes, 'identical inputs must produce byte-identical requests');

  const beforeOverwriteAttempt = crypto.createHash('sha256').update(firstBytes).digest('hex');
  const overwrite = run(firstOutput);
  assert.equal(overwrite.status, 2);
  assert.match(overwrite.stderr, /refusing to overwrite existing request/u);
  assert.equal(
    crypto.createHash('sha256').update(fs.readFileSync(first)).digest('hex'),
    beforeOverwriteAttempt,
    'failed duplicate packaging must leave the first request untouched',
  );
});

test('GO request packaging fails closed on incomplete authority, source, marker, and path inputs', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'go-request-package-fail-'));
  const templatePath = path.join(temporary, 'authored-hold-template.json');
  const unauthorizedTemplatePath = path.join(temporary, 'unauthorized-template.json');
  const unresolvedTemplatePath = path.join(temporary, 'unresolved-template.json');
  const misplacedSourceTemplatePath = path.join(temporary, 'misplaced-source-template.json');
  const misplacedBindingTemplatePath = path.join(temporary, 'misplaced-binding-template.json');
  const output = `config/.test-packaged-go-request-${process.pid}-fail.json`;
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const templateText = frameRefuserV2TemplateText();
  fs.writeFileSync(templatePath, templateText);
  const request = JSON.parse(fs.readFileSync(FRAME_REFUSER_V2_REQUEST_PATH, 'utf8'));
  const protectedRoot = createProtectedPackagerCheckout(t, request, 'negative-historical');
  const outputAt = (root) => path.join(root, output);
  const run = (args, root = protectedRoot) =>
    spawnSync(process.execPath, [GO_REQUEST_PACKAGE_SCRIPT, ...args], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
    });

  const missing = run(['--template', templatePath, '--out', output]);
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /--launch-commit is required/u);
  assert.equal(fs.existsSync(outputAt(protectedRoot)), false);

  const abbreviatedSource = run([
    '--template',
    templatePath,
    '--launch-commit',
    request.source.launchCommit.slice(0, 12),
    '--out',
    output,
  ]);
  assert.equal(abbreviatedSource.status, 2);
  assert.match(abbreviatedSource.stderr, /explicit full commit oid/u);
  assert.equal(fs.existsSync(outputAt(protectedRoot)), false);

  const unauthorized = JSON.parse(templateText);
  unauthorized.authorization.modelCallsAuthorized = true;
  fs.writeFileSync(unauthorizedTemplatePath, `${JSON.stringify(unauthorized, null, 2)}\n`);
  const unauthorizedRun = run([
    '--template',
    unauthorizedTemplatePath,
    '--launch-commit',
    request.source.launchCommit,
    '--out',
    output,
  ]);
  assert.equal(unauthorizedRun.status, 2);
  assert.match(unauthorizedRun.stderr, /literal HOLD/u);
  assert.equal(fs.existsSync(outputAt(protectedRoot)), false);

  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const currentRoot = createProtectedPackagerCheckout(t, request, 'negative-current', head);
  let misplacedSource = moveMarkerToIgnoredField(
    templateText,
    GO_REQUEST_PACKAGE_MARKERS.sourceCommit,
    request.source.launchCommit,
    'ignoredSourceCommitMarker',
  );
  misplacedSource = moveMarkerToIgnoredField(
    misplacedSource,
    GO_REQUEST_PACKAGE_MARKERS.sourceTree,
    request.source.launchTree,
    'ignoredSourceTreeMarker',
  );
  fs.writeFileSync(misplacedSourceTemplatePath, misplacedSource);
  const misplacedSourceRun = run(
    ['--template', misplacedSourceTemplatePath, '--launch-commit', head, '--out', output],
    currentRoot,
  );
  assert.equal(misplacedSourceRun.status, 2);
  assert.match(misplacedSourceRun.stderr, /materialized source launch commit does not match/u);
  assert.equal(fs.existsSync(outputAt(currentRoot)), false);

  const registrationMarker = goRequestFileSha256Marker(request.bindings.registration.path);
  const misplacedBinding = moveMarkerToIgnoredField(
    templateText,
    registrationMarker,
    '0'.repeat(64),
    'ignoredRegistrationDigestMarker',
  );
  fs.writeFileSync(misplacedBindingTemplatePath, misplacedBinding);
  const misplacedBindingRun = run([
    '--template',
    misplacedBindingTemplatePath,
    '--launch-commit',
    request.source.launchCommit,
    '--out',
    output,
  ]);
  assert.equal(misplacedBindingRun.status, 2);
  assert.match(misplacedBindingRun.stderr, /materialized registration digest does not match/u);
  assert.equal(fs.existsSync(outputAt(protectedRoot)), false);

  fs.writeFileSync(
    unresolvedTemplatePath,
    templateText.replace('"status":', '"extra": "__GO_REQUEST_PACKAGE__:unknown",\n  "status":'),
  );
  const unresolved = run([
    '--template',
    unresolvedTemplatePath,
    '--launch-commit',
    request.source.launchCommit,
    '--out',
    output,
  ]);
  assert.equal(unresolved.status, 2);
  assert.match(unresolved.stderr, /unknown or unresolved packaging marker/u);
  assert.equal(fs.existsSync(outputAt(protectedRoot)), false);

  assert.throws(() => resolveTutorStubGoRequestOutput(path.join(ROOT, '..', 'escaped-request.json')), /inside/u);
  assert.throws(() => resolveTutorStubGoRequestOutput('nested/../escaped-request.json'), /canonical/u);
});
