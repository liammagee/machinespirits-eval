import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { validateTutorStubResistantProfileStudyGoRequest } from '../scripts/check-tutor-stub-resistant-profile-study-go-request.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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

test('frame-refuser opportunity request validates six dialogues without a new canary or model call', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-refuser-opportunity-go-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const digest = (filePath) => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  const commandDigest = (command) => crypto.createHash('sha256').update(JSON.stringify(command)).digest('hex');
  const launchCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const launchTree = execFileSync('git', ['show', '-s', '--format=%T', launchCommit], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  const registrationPath = 'config/tutor-stub-frame-refuser-opportunity-registration.v1.json';
  const endpointPath = 'config/paid-study-endpoints/tutor-stub-frame-refuser-opportunity.json';
  const certificatePath = 'config/paid-study-endpoints/tutor-stub-frame-refuser-opportunity.endpoint-go.json';
  const certificate = JSON.parse(fs.readFileSync(path.join(ROOT, certificatePath), 'utf8'));
  const artifactRoot = `.test-tmp/frame-refuser-opportunity-request-test-${process.pid}`;
  const live = [
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
    studyId: 'tutor-stub-frame-refuser-opportunity-v1',
    authorization: {
      explicitHumanApproval: null,
      modelCallsAuthorized: false,
      liveRunAuthorized: false,
    },
    source: { launchCommit, launchTree, closure: [] },
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
        authorizationConsumptionPath: 'config/tutor-stub-resistant-profile-route-canary-authorization.consumed.v1.json',
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
  const requestPath = path.join(temporary, 'request.json');
  fs.writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`);
  const report = validateTutorStubResistantProfileStudyGoRequest({ requestPath });
  assert.equal(report.packetValid, true);
  assert.equal(report.readyForExplicitHumanApproval, true);
  assert.equal(report.modelCalls, 0);
  assert.equal(report.productionWrites, 0);
  assert.equal(report.budget.maximumPlannedModelAttempts, 288);
  assert.match(report.exactApprovalStatement, /6-dialogue Luna study/u);
});
