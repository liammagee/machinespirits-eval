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
const REGISTRATION = 'config/tutor-stub-resistance-semantic-adjudication-validation-registration.v1.json';
const INSTRUMENT = 'config/tutor-stub-resistance-semantic-adjudication-registration.v1.json';
const HELDOUT = 'config/tutor-stub-resistance-semantic-adjudication-heldout-corpus.v1.json';
const ENDPOINT = 'config/paid-study-endpoints/tutor-stub-resistance-semantic-adjudication-validation.v1.json';
const CERTIFICATE =
  'config/paid-study-endpoints/tutor-stub-resistance-semantic-adjudication-validation.v1.endpoint-go.json';
const REGISTRATION_V2 = 'config/tutor-stub-resistance-semantic-adjudication-validation-registration.v2.json';
const INSTRUMENT_V2 = 'config/tutor-stub-resistance-semantic-adjudication-registration.v2.json';
const HELDOUT_V2 = 'config/tutor-stub-resistance-semantic-adjudication-heldout-corpus.v2.json';
const ENDPOINT_V2 = 'config/paid-study-endpoints/tutor-stub-resistance-semantic-adjudication-validation.v2.json';
const CERTIFICATE_V2 =
  'config/paid-study-endpoints/tutor-stub-resistance-semantic-adjudication-validation.v2.endpoint-go.json';
const RECOVERY_REGISTRATION = 'config/tutor-stub-resistance-recovery-semantic-validation-registration.v2.json';
const RECOVERY_INSTRUMENT = 'config/tutor-stub-resistance-recovery-semantic-adjudication-registration.v2.json';
const RECOVERY_HELDOUT = 'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v2.json';
const RECOVERY_ENDPOINT = 'config/paid-study-endpoints/tutor-stub-resistance-recovery-semantic-validation.v2.json';
const RECOVERY_CERTIFICATE =
  'config/paid-study-endpoints/tutor-stub-resistance-recovery-semantic-validation.v2.endpoint-go.json';
const CLOSURE = [
  'scripts/run-tutor-stub-resistance-semantic-validation.js',
  'scripts/analyze-tutor-stub-resistance-semantic-validation.js',
  'scripts/check-tutor-stub-resistant-profile-study-go-request.js',
  'scripts/package-tutor-stub-resistant-profile-study-go-request.js',
  'services/tutorStubResistanceSemanticValidationRuntime.js',
  'services/tutorStubResistanceSemanticValidation.js',
  'services/tutorStubResistanceSemanticRuntime.js',
  'services/tutorStubResistanceSemanticAdjudication.js',
  'services/tutorStubPromptTransport.js',
  'services/tutorStubCliPolicyRetry.js',
  'services/tutorStubArtifactArchive.js',
  'services/paidStudyEndpointPreflight.js',
  'services/cliProviderBridge.js',
  'services/evalConfigLoader.js',
  REGISTRATION,
  INSTRUMENT,
  'config/tutor-stub-resistance-semantic-adjudication-response.schema.v1.json',
  'config/tutor-stub-resistance-semantic-adjudication-development-corpus.v1.json',
  HELDOUT,
  ENDPOINT,
  CERTIFICATE,
  'config/providers.yaml',
  'package.json',
  'package-lock.json',
];
const CLOSURE_V2 = [
  'scripts/run-tutor-stub-resistance-semantic-validation.js',
  'scripts/analyze-tutor-stub-resistance-semantic-validation.js',
  'scripts/check-tutor-stub-resistant-profile-study-go-request.js',
  'scripts/package-tutor-stub-resistant-profile-study-go-request.js',
  'services/tutorStubResistanceSemanticValidationRuntime.js',
  'services/tutorStubResistanceSemanticValidationV2.js',
  'services/tutorStubResistanceSemanticRuntime.js',
  'services/tutorStubResistanceSemanticAdjudicationV2.js',
  'services/tutorStubResistanceSemanticAdjudication.js',
  'services/tutorStubPromptTransport.js',
  'services/tutorStubCliPolicyRetry.js',
  'services/tutorStubArtifactArchive.js',
  'services/paidStudyEndpointPreflight.js',
  'services/cliProviderBridge.js',
  'services/evalConfigLoader.js',
  REGISTRATION_V2,
  INSTRUMENT_V2,
  'config/tutor-stub-resistance-semantic-adjudication-response.schema.v2.json',
  'config/tutor-stub-resistance-semantic-adjudication-development-evidence.v2.json',
  'config/tutor-stub-resistance-semantic-adjudication-development-corpus.v1.json',
  'config/tutor-stub-resistance-semantic-adjudication-heldout-corpus.v1.json',
  'config/tutor-stub-resistance-semantic-adjudication-validation-registration.v1.json',
  'config/tutor-stub-resistance-semantic-adjudication-registration.v1.json',
  HELDOUT_V2,
  'config/tutor-stub-resistance-semantic-adjudication-validation-study-go-request.v1.json',
  ENDPOINT_V2,
  CERTIFICATE_V2,
  'config/providers.yaml',
  'package.json',
  'package-lock.json',
];
const RECOVERY_CLOSURE = [
  'scripts/run-tutor-stub-resistance-recovery-semantic-validation.js',
  'scripts/analyze-tutor-stub-resistance-recovery-semantic-validation.js',
  'scripts/check-tutor-stub-resistant-profile-study-go-request.js',
  'scripts/package-tutor-stub-resistant-profile-study-go-request.js',
  'services/tutorStubResistanceRecoverySemanticValidationRuntime.js',
  'services/tutorStubResistanceRecoverySemanticValidation.js',
  'services/tutorStubResistanceRecoverySemanticAdjudicationV2.js',
  'services/tutorStubPromptTransport.js',
  'services/tutorStubCliPolicyRetry.js',
  'services/tutorStubArtifactArchive.js',
  'services/paidStudyEndpointPreflight.js',
  'services/cliProviderBridge.js',
  'services/evalConfigLoader.js',
  RECOVERY_REGISTRATION,
  RECOVERY_INSTRUMENT,
  'config/tutor-stub-resistance-recovery-semantic-response.schema.v2.json',
  'config/tutor-stub-resistance-recovery-semantic-development-corpus.v2.json',
  RECOVERY_HELDOUT,
  RECOVERY_ENDPOINT,
  RECOVERY_CERTIFICATE,
  'config/providers.yaml',
  'package.json',
  'package-lock.json',
];

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const fileSha256 = (repoPath) => sha256(fs.readFileSync(path.join(ROOT, repoPath)));

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

function buildRequest(requestRepoPath, suffix) {
  const launchCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const launchTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const contract = JSON.parse(fs.readFileSync(path.join(ROOT, ENDPOINT), 'utf8'));
  const certificate = JSON.parse(fs.readFileSync(path.join(ROOT, CERTIFICATE), 'utf8'));
  const artifactRoot = `.tutor-stub-auto-eval/semantic-validation-${suffix}`;
  const runBase = [
    'node',
    'scripts/run-tutor-stub-resistance-semantic-validation.js',
    '--live',
    '--destination',
    artifactRoot,
    '--source-commit',
    launchCommit,
    '--source-tree',
    launchTree,
    '--go-request',
    requestRepoPath,
    '--maximum-reservations',
    '480',
  ];
  const live = runBase;
  const recovery = [...runBase, '--resume'];
  const analyze = [
    'node',
    'scripts/analyze-tutor-stub-resistance-semantic-validation.js',
    '--destination',
    artifactRoot,
    '--source-commit',
    launchCommit,
    '--source-tree',
    launchTree,
    '--go-request',
    requestRepoPath,
  ];
  return {
    schema: 'machinespirits.tutor-stub.resistant-profile-discrimination-study-go-request.v1',
    status: 'HOLD_PENDING_EXPLICIT_HUMAN_APPROVAL',
    studyId: contract.study_id,
    authorization: {
      explicitHumanApproval: null,
      modelCallsAuthorized: false,
      liveRunAuthorized: false,
      standingArchitecturalCorrectionSha256: 'dae9091d4f2584d416d7765e66d47acba03a33264886a6fa0a1eba45857c05f4',
      priorStandingAuthoritySha256: '538aa73239072ea618e2c8308edf562f1dd7495b78574e35a3db2f549302c1ce',
    },
    source: {
      launchCommit,
      launchTree,
      requirements: { headMustEqualLaunchCommit: true, checkoutMustBeClean: true, detachedLaunchWorktree: true },
      closure: CLOSURE.map((repoPath) => ({ path: repoPath, sha256: fileSha256(repoPath) })),
    },
    semanticAdjudicationValidation: {
      type: 'prospective_resistance_semantic_adjudication_heldout_validation_v1',
      instrumentRegistration: { path: INSTRUMENT, sha256: fileSha256(INSTRUMENT) },
      heldoutCorpus: { path: HELDOUT, sha256: fileSha256(HELDOUT), cases: 80 },
      lifecycle: {
        preservedValidJudgeRecalled: false,
        neverPreparedPeerMayComplete: true,
        dispatchedWithoutResponseRecalled: false,
        invalidOrTransportTerminalPeerRequired: false,
        validCaseRerun: false,
        replacement: false,
        outcomeSelection: false,
        goldJoinedOnlyAfterSeal: true,
        durablePrivateArchiveRequired: true,
      },
      claimBoundary:
        'heldout_semantic_instrument_validation_only_no_confirmation_outcome_or_warm_plain_efficacy_null_learning_transfer_human_or_cell_claim',
      syntheticPreflightEstablishesAccuracy: false,
      validationOutcomesExcludedFromConfirmation: true,
      postHeldoutPromptSchemaConsensusThresholdTuning: false,
    },
    design: {
      cases: 80,
      judgesPerCase: 2,
      judges: ['codex.gpt-5.6-sol', 'claude-code.sonnet-5'],
      effort: 'low',
      goldVisibleToJudgePackets: false,
      originalCaseIdsVisibleToExecution: false,
      goldJoinedOnlyAfterAllCasesSealed: true,
    },
    budget: {
      plannedCases: 80,
      plannedModelCalls: 160,
      maximumReservationsPerPlannedCall: 3,
      maximumPlannedModelAttempts: 480,
      programmeLedgerBefore: 331,
      programmeLedgerAfterMaximum: 811,
      programmeCeiling: 5000,
      retryOrResumeAuthority: 'bounded_technical_recovery',
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
      judgeRoutes: {
        providerConfigPath: 'config/providers.yaml',
        providerConfigSha256: fileSha256('config/providers.yaml'),
        judgeA: {
          modelRef: 'codex.gpt-5.6-sol',
          provider: 'codex',
          model: 'gpt-5.6-sol',
          effort: 'low',
        },
        judgeB: {
          modelRef: 'claude-code.sonnet-5',
          provider: 'claude-code',
          model: 'claude-sonnet-5',
          effort: 'low',
        },
        crossProviderAndModelFamilyIndependent: true,
        learnerLunaExcludedFromVoting: true,
      },
      commands: {
        source: 'commands',
        liveArraySha256: sha256(JSON.stringify(live)),
        recoveryArraySha256: sha256(JSON.stringify(recovery)),
        analyzeArraySha256: sha256(JSON.stringify(analyze)),
      },
    },
    commands: { live, recovery, analyze },
    payload: { humanSubjectData: false, privateArchiveData: false, trainingReuseStatus: 'not_applicable' },
    destination: { artifactRoot, createOnce: true, mustNotExistBeforeLaunch: true },
  };
}

function buildRequestV2(requestRepoPath, suffix) {
  const request = buildRequest(requestRepoPath, suffix);
  const launchCommit = request.source.launchCommit;
  const launchTree = request.source.launchTree;
  const contract = JSON.parse(fs.readFileSync(path.join(ROOT, ENDPOINT_V2), 'utf8'));
  const certificate = JSON.parse(fs.readFileSync(path.join(ROOT, CERTIFICATE_V2), 'utf8'));
  const artifactRoot = `.tutor-stub-auto-eval/semantic-validation-v2-${suffix}`;
  const registrationFlag = ['--validation-registration', REGISTRATION_V2];
  const live = [
    'node',
    'scripts/run-tutor-stub-resistance-semantic-validation.js',
    '--live',
    '--destination',
    artifactRoot,
    '--source-commit',
    launchCommit,
    '--source-tree',
    launchTree,
    '--go-request',
    requestRepoPath,
    '--maximum-reservations',
    '480',
    ...registrationFlag,
  ];
  const recovery = [...live, '--resume'];
  const analyze = [
    'node',
    'scripts/analyze-tutor-stub-resistance-semantic-validation.js',
    '--destination',
    artifactRoot,
    '--source-commit',
    launchCommit,
    '--source-tree',
    launchTree,
    '--go-request',
    requestRepoPath,
    ...registrationFlag,
  ];
  request.studyId = contract.study_id;
  request.source.closure = CLOSURE_V2.map((repoPath) => ({ path: repoPath, sha256: fileSha256(repoPath) }));
  request.semanticAdjudicationValidation = {
    type: 'prospective_resistance_semantic_adjudication_heldout_validation_v2',
    instrumentRegistration: { path: INSTRUMENT_V2, sha256: fileSha256(INSTRUMENT_V2) },
    heldoutCorpus: { path: HELDOUT_V2, sha256: fileSha256(HELDOUT_V2), cases: 80 },
    failedV1Validation: {
      request: {
        path: 'config/tutor-stub-resistance-semantic-adjudication-validation-study-go-request.v1.json',
        sha256: fileSha256('config/tutor-stub-resistance-semantic-adjudication-validation-study-go-request.v1.json'),
      },
      reportSha256: '008230526809a6aa2917b240c6a30af644f30184b89042825773b1b8040c5c74',
      privateArchive: {
        branch: 'codex/resistance-semantic-validation-v1-failed-archive',
        commit: 'cf92081bd566948f4ea26d0ac5e67f8132ebeef8',
      },
      chargedReservations: 160,
      returnedFirstAttempts: 160,
      programmeLedgerAfter: 491,
      rescored: false,
      normalized: false,
      reused: false,
      pooled: false,
      outcomeSelected: false,
    },
    lifecycle: {
      preservedValidJudgeRecalled: false,
      neverPreparedPeerMayComplete: true,
      dispatchedWithoutResponseRecalled: false,
      invalidOrTransportTerminalPeerRequired: false,
      validCaseRerun: false,
      replacement: false,
      outcomeSelection: false,
      goldJoinedOnlyAfterSeal: true,
      durablePrivateArchiveRequired: true,
    },
    claimBoundary:
      'heldout_semantic_instrument_v2_validation_only_failed_v1_excluded_no_confirmation_outcome_or_warm_plain_efficacy_null_learning_transfer_human_or_cell_claim',
    syntheticPreflightEstablishesAccuracy: false,
    validationOutcomesExcludedFromConfirmation: true,
    postHeldoutPromptSchemaConsensusThresholdTuning: false,
  };
  request.budget = {
    plannedCases: 80,
    plannedModelCalls: 160,
    maximumReservationsPerPlannedCall: 3,
    maximumPlannedModelAttempts: 480,
    programmeLedgerBefore: 491,
    programmeLedgerAfterMaximum: 971,
    programmeCeiling: 5000,
    retryOrResumeAuthority: 'bounded_technical_recovery',
  };
  request.bindings.registration = { path: REGISTRATION_V2, sha256: fileSha256(REGISTRATION_V2) };
  request.bindings.endpoint = {
    contractPath: ENDPOINT_V2,
    contractFileSha256: fileSha256(ENDPOINT_V2),
    contractCanonicalSha256: sha256(JSON.stringify(canonicalJson(contract))),
    certificatePath: CERTIFICATE_V2,
    certificateFileSha256: fileSha256(CERTIFICATE_V2),
    preflightSha256: certificate.preflight_sha256,
  };
  request.commands = { live, recovery, analyze };
  request.bindings.commands = {
    source: 'commands',
    liveArraySha256: sha256(JSON.stringify(live)),
    recoveryArraySha256: sha256(JSON.stringify(recovery)),
    analyzeArraySha256: sha256(JSON.stringify(analyze)),
  };
  request.destination = { artifactRoot, createOnce: true, mustNotExistBeforeLaunch: true };
  return request;
}

function templateText(request) {
  const template = structuredClone(request);
  template.source.launchCommit = GO_REQUEST_PACKAGE_MARKERS.sourceCommit;
  template.source.launchTree = GO_REQUEST_PACKAGE_MARKERS.sourceTree;
  for (const entry of template.source.closure) entry.sha256 = goRequestFileSha256Marker(entry.path);
  const endpoint = template.bindings.endpoint;
  endpoint.contractCanonicalSha256 = GO_REQUEST_PACKAGE_MARKERS.endpointCanonicalSha256;
  endpoint.preflightSha256 = GO_REQUEST_PACKAGE_MARKERS.endpointPreflightSha256;
  // File bindings that are also in the critical closure retain their launch-source
  // digest literals. The single closure marker for each path lets the packager
  // materialize that blob without introducing an ambiguous duplicate marker.
  template.bindings.commands.liveArraySha256 = GO_REQUEST_PACKAGE_MARKERS.liveCommandSha256;
  template.bindings.commands.recoveryArraySha256 = GO_REQUEST_PACKAGE_MARKERS.recoveryCommandSha256;
  template.bindings.commands.analyzeArraySha256 = GO_REQUEST_PACKAGE_MARKERS.analyzeCommandSha256;
  return `${JSON.stringify(template, null, 2)}\n`;
}

function buildRecoveryRequest(requestRepoPath, suffix) {
  const request = buildRequest(requestRepoPath, suffix);
  const launchCommit = request.source.launchCommit;
  const launchTree = request.source.launchTree;
  const contract = JSON.parse(fs.readFileSync(path.join(ROOT, RECOVERY_ENDPOINT), 'utf8'));
  const certificate = JSON.parse(fs.readFileSync(path.join(ROOT, RECOVERY_CERTIFICATE), 'utf8'));
  const root = `.tutor-stub-auto-eval/recovery-semantic-validation-${suffix}`;
  const live = [
    'node',
    'scripts/run-tutor-stub-resistance-recovery-semantic-validation.js',
    '--live',
    '--destination',
    root,
    '--source-commit',
    launchCommit,
    '--source-tree',
    launchTree,
    '--go-request',
    requestRepoPath,
    '--maximum-reservations',
    '720',
  ];
  const recovery = [...live, '--resume'];
  const analyze = [
    'node',
    'scripts/analyze-tutor-stub-resistance-recovery-semantic-validation.js',
    '--destination',
    root,
    '--source-commit',
    launchCommit,
    '--source-tree',
    launchTree,
    '--go-request',
    requestRepoPath,
  ];
  request.studyId = contract.study_id;
  request.source.closure = RECOVERY_CLOSURE.map((repoPath) => ({ path: repoPath, sha256: fileSha256(repoPath) }));
  request.semanticAdjudicationValidation = {
    type: 'prospective_resistance_recovery_semantic_adjudication_heldout_validation_v2',
    instrumentRegistration: { path: RECOVERY_INSTRUMENT, sha256: fileSha256(RECOVERY_INSTRUMENT) },
    heldoutCorpus: { path: RECOVERY_HELDOUT, sha256: fileSha256(RECOVERY_HELDOUT), cases: 120 },
    lifecycle: {
      preservedValidJudgeRecalled: false,
      neverPreparedPeerMayComplete: true,
      dispatchedWithoutResponseRecalled: false,
      validCaseRerun: false,
      replacement: false,
      outcomeSelection: false,
      goldJoinedOnlyAfterSeal: true,
      durablePrivateArchiveRequired: true,
    },
  };
  request.design = {
    cases: 120,
    judgesPerCase: 2,
    judges: ['codex.gpt-5.6-sol', 'claude-code.sonnet-5'],
    effort: 'low',
    goldVisibleToJudgePackets: false,
    originalCaseIdsVisibleToExecution: false,
    goldJoinedOnlyAfterAllCasesSealed: true,
  };
  request.budget = {
    plannedCases: 120,
    plannedModelCalls: 240,
    maximumReservationsPerPlannedCall: 3,
    maximumPlannedModelAttempts: 720,
    programmeLedgerBeforeMaximum: 971,
    programmeLedgerAfterMaximum: 1691,
    programmeCeiling: 5000,
    retryOrResumeAuthority: 'bounded_technical_recovery',
  };
  request.bindings.registration = { path: RECOVERY_REGISTRATION, sha256: fileSha256(RECOVERY_REGISTRATION) };
  request.bindings.endpoint = {
    contractPath: RECOVERY_ENDPOINT,
    contractFileSha256: fileSha256(RECOVERY_ENDPOINT),
    contractCanonicalSha256: sha256(JSON.stringify(canonicalJson(contract))),
    certificatePath: RECOVERY_CERTIFICATE,
    certificateFileSha256: fileSha256(RECOVERY_CERTIFICATE),
    preflightSha256: certificate.preflight_sha256,
  };
  request.commands = { live, recovery, analyze };
  request.bindings.commands = {
    source: 'commands',
    liveArraySha256: sha256(JSON.stringify(live)),
    recoveryArraySha256: sha256(JSON.stringify(recovery)),
    analyzeArraySha256: sha256(JSON.stringify(analyze)),
  };
  request.destination = { artifactRoot: root, createOnce: true, mustNotExistBeforeLaunch: true };
  return request;
}

test('semantic validation GO validator and packager bind frozen dual judging without calls', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-validation-go-request-'));
  const output = `.tutor-stub-auto-eval/.test-semantic-validation-go-${process.pid}.json`;
  t.after(() => {
    fs.rmSync(temporary, { recursive: true, force: true });
    fs.rmSync(path.join(ROOT, output), { force: true });
  });
  const request = buildRequest(output, process.pid);
  fs.mkdirSync(path.dirname(path.join(ROOT, output)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, output), `${JSON.stringify(request, null, 2)}\n`);
  const report = validateTutorStubResistantProfileStudyGoRequest({ requestPath: path.join(ROOT, output) });
  assert.equal(report.packetValid, true);
  assert.equal(report.modelCalls, 0);
  assert.equal(report.productionWrites, 0);
  assert.equal(report.budget.maximumPlannedModelAttempts, 480);
  assert.match(report.exactApprovalStatement, /80-case resistance semantic-instrument validation/u);
  fs.rmSync(path.join(ROOT, output));

  const templatePath = path.join(temporary, 'template.json');
  fs.writeFileSync(templatePath, templateText(request));
  const packageReport = packageTutorStubResistantProfileStudyGoRequest({
    templatePath,
    launchCommit: request.source.launchCommit,
    outputPath: output,
  });
  assert.equal(packageReport.sourceClosureFiles, CLOSURE.length);
  assert.equal(packageReport.isolatedReplay.nodeModulesPresent, false);
  assert.equal(packageReport.isolatedReplay.packetValid, true);
  assert.equal(packageReport.effects.modelCalls, 0);
  assert.deepEqual(fs.readFileSync(path.join(ROOT, output)), Buffer.from(`${JSON.stringify(request, null, 2)}\n`));

  for (const mutation of [
    (value) => (value.bindings.judgeRoutes.judgeB.model = 'gpt-5.6-sol'),
    (value) => (value.budget.maximumPlannedModelAttempts = 479),
    (value) => (value.semanticAdjudicationValidation.lifecycle.preservedValidJudgeRecalled = true),
    (value) => (value.source.closure = value.source.closure.filter((row) => !row.path.includes('ArtifactArchive'))),
    (value) =>
      (value.source.closure = value.source.closure.filter(
        (row) => !row.path.endsWith('semantic-adjudication-development-corpus.v1.json'),
      )),
  ]) {
    const changed = structuredClone(request);
    mutation(changed);
    const invalidPath = path.join(temporary, `invalid-${crypto.randomUUID()}.json`);
    fs.writeFileSync(invalidPath, `${JSON.stringify(changed, null, 2)}\n`);
    assert.throws(() => validateTutorStubResistantProfileStudyGoRequest({ requestPath: invalidPath }));
  }
});

test('future v2 GO packaging binds failed-v1 exclusion and the 491-to-971 validation-only ledger', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-validation-v2-go-request-'));
  const output = `.tutor-stub-auto-eval/.test-semantic-validation-v2-go-${process.pid}.json`;
  t.after(() => {
    fs.rmSync(temporary, { recursive: true, force: true });
    fs.rmSync(path.join(ROOT, output), { force: true });
  });
  const request = buildRequestV2(output, process.pid);
  fs.mkdirSync(path.dirname(path.join(ROOT, output)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, output), `${JSON.stringify(request, null, 2)}\n`);
  const report = validateTutorStubResistantProfileStudyGoRequest({ requestPath: path.join(ROOT, output) });
  assert.equal(report.packetValid, true);
  assert.equal(report.modelCalls, 0);
  assert.equal(report.productionWrites, 0);
  assert.equal(report.budget.programmeLedgerBefore, 491);
  assert.equal(report.budget.programmeLedgerAfterMaximum, 971);
  fs.rmSync(path.join(ROOT, output));

  const templatePath = path.join(temporary, 'template.json');
  fs.writeFileSync(templatePath, templateText(request));
  const packaged = packageTutorStubResistantProfileStudyGoRequest({
    templatePath,
    launchCommit: request.source.launchCommit,
    outputPath: output,
  });
  assert.equal(packaged.sourceClosureFiles, CLOSURE_V2.length);
  assert.equal(packaged.isolatedReplay.nodeModulesPresent, false);
  assert.equal(packaged.isolatedReplay.packetValid, true);
  assert.equal(packaged.effects.modelCalls, 0);

  for (const mutate of [
    (value) => (value.semanticAdjudicationValidation.failedV1Validation.rescored = true),
    (value) => (value.semanticAdjudicationValidation.failedV1Validation.privateArchive.commit = '0'.repeat(40)),
    (value) => (value.budget.programmeLedgerBefore = 331),
    (value) => value.commands.live.splice(value.commands.live.indexOf('--validation-registration'), 2),
    (value) =>
      (value.source.closure = value.source.closure.filter(
        (row) => !row.path.endsWith('semantic-adjudication-heldout-corpus.v1.json'),
      )),
    (value) =>
      (value.source.closure = value.source.closure.filter(
        (row) => !row.path.endsWith('semantic-adjudication-validation-registration.v1.json'),
      )),
    (value) =>
      (value.source.closure = value.source.closure.filter(
        (row) => !row.path.endsWith('semantic-adjudication-registration.v1.json'),
      )),
  ]) {
    const changed = structuredClone(request);
    mutate(changed);
    const invalidPath = path.join(temporary, `invalid-v2-${crypto.randomUUID()}.json`);
    fs.writeFileSync(invalidPath, `${JSON.stringify(changed, null, 2)}\n`);
    assert.throws(() => validateTutorStubResistantProfileStudyGoRequest({ requestPath: invalidPath }));
  }
});

test('outcome semantic validation GO validator and packager bind the 120-case full-vector gate', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'recovery-semantic-validation-go-'));
  const output = `.tutor-stub-auto-eval/.test-recovery-semantic-validation-go-${process.pid}.json`;
  t.after(() => {
    fs.rmSync(temporary, { recursive: true, force: true });
    fs.rmSync(path.join(ROOT, output), { force: true });
  });
  const request = buildRecoveryRequest(output, process.pid);
  fs.mkdirSync(path.dirname(path.join(ROOT, output)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, output), `${JSON.stringify(request, null, 2)}\n`);
  const report = validateTutorStubResistantProfileStudyGoRequest({ requestPath: path.join(ROOT, output) });
  assert.equal(report.packetValid, true);
  assert.equal(report.modelCalls, 0);
  assert.equal(report.budget.maximumPlannedModelAttempts, 720);
  fs.rmSync(path.join(ROOT, output));
  const templatePath = path.join(temporary, 'template.json');
  fs.writeFileSync(templatePath, templateText(request));
  const packaged = packageTutorStubResistantProfileStudyGoRequest({
    templatePath,
    launchCommit: request.source.launchCommit,
    outputPath: output,
  });
  assert.equal(packaged.sourceClosureFiles, RECOVERY_CLOSURE.length);
  assert.equal(packaged.isolatedReplay.packetValid, true);
  assert.equal(packaged.effects.modelCalls, 0);
});
