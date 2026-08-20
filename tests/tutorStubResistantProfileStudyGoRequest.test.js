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
    request.bindings.endpoint.contractPath,
    request.bindings.endpoint.certificatePath,
    request.bindings.routeCanary.resultPath,
    request.bindings.routeCanary.authorizationConsumptionPath,
    request.opportunityGate.historicalOpportunityV1.requestPath,
  ];
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
  t.after(() => fs.rmSync(checkout, { recursive: true, force: true }));
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
  assert.match(result.stderr, /source-closure-scripts\/tutor-stub-learner-profile-contracts\.js/u);
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
  assert.match(result.stderr, /source-closure-scripts\/tutor-stub-learner-profile-contracts\.js/u);
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

test('consumed frame-refuser v1 and v2 requests retain their exact approval digests', () => {
  const expected = {
    'config/tutor-stub-frame-refuser-opportunity-study-go-request.v1.json':
      'ca832a863764748dde496166ee2f9e7793cb97a582d22564c085bacece005b84',
    'config/tutor-stub-frame-refuser-opportunity-study-go-request.v2.json':
      '2c77c131c2803e4af37eea3c8cbfb38e2ba423d645ab98739d661c5778c22c04',
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

test('frame-refuser opportunity requests validate historical v1 and prospective v2/v3 without a new model call', (t) => {
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
  ];
  for (const fixture of fixtures) {
    const registrationPath = fixture.registrationPath;
    const endpointPath = fixture.endpointPath;
    const certificatePath = fixture.certificatePath;
    const registration = JSON.parse(fs.readFileSync(path.join(ROOT, registrationPath), 'utf8'));
    const certificate = JSON.parse(fs.readFileSync(path.join(ROOT, certificatePath), 'utf8'));
    const artifactRoot = `.test-tmp/frame-refuser-opportunity-request-test-${fixture.version}-${process.pid}`;
    const live = [
      ...(fixture.version === 'v3' ? ['env', 'TUTOR_STUB_RESISTANT_LEARNER_OBSERVATION_SEMANTICS=prospective_v3'] : []),
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
      '8',
      '--safety-turns',
      '8',
      '--model',
      'codex.gpt-5.6-luna',
      '--analysis-model',
      'codex.gpt-5.6-luna',
      '--auto-learner-model',
      'codex.gpt-5.6-luna',
      '--model-call-budget',
      '48',
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
      `set -euo pipefail; artifact_root='${artifactRoot}'; trace_args=(); for trace in "$artifact_root"/*/traces/*/*.jsonl; do [[ -f "$trace" ]] || continue; trace_args+=(--trace "$trace"); done; node scripts/analyze-tutor-stub-resistance-axis-calibration.js "${'${trace_args[@]}'}" --registration ${registrationPath} --required-traces 6 --required-profiles frame_refuser,frame_defiant --required-runs-per-profile 3 --required-turns 8 --required-policies field --required-tutor-model codex.gpt-5.6-luna --required-analysis-model codex.gpt-5.6-luna --required-learner-model codex.gpt-5.6-luna --json --out "$artifact_root/frame-refuser-opportunity-gate.json"`,
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
        closure: FRAME_REFUSER_OPPORTUNITY_CRITICAL_SOURCE_CLOSURE.map((closurePath) => ({
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
          maximumTotalStudyAttemptsUnchanged: 288,
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
        ...(fixture.version === 'v2' || fixture.version === 'v3'
          ? {
              controlParticipationForms: registration.measurement.controlParticipationForms,
              refusalRule: registration.measurement.refusalRule,
            }
          : {}),
        ...(fixture.version === 'v3'
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
      ...(fixture.version === 'v3' ? { repairAdmission: registration.repairAdmission } : {}),
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
      },
      budget: {
        dialogues: 6,
        maximumAttemptsPerDialogue: 48,
        maximumPlannedModelAttempts: 288,
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
    assert.equal(report.budget.maximumPlannedModelAttempts, 288);
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
    if (fixture.version === 'v2' || fixture.version === 'v3') {
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
    if (fixture.version === 'v3') {
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
            value.repairAdmission.maxFullRepairsPer8Turns = 2;
          },
          pattern: /frame-refuser-opportunity-v3-repair-admission-binding/u,
        },
        {
          name: 'invalid-candidate-publication',
          mutate(value) {
            value.repairAdmission.invalidCandidateMayBePublished = true;
          },
          pattern: /frame-refuser-opportunity-v3-repair-admission-binding/u,
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
