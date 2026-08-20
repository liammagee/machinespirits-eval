#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_REQUEST = path.join(
  ROOT,
  'config',
  'tutor-stub-resistant-profile-discrimination-study-go-request.v1.json',
);

const FRAME_REFUSER_OPPORTUNITY_CRITICAL_SOURCE_CLOSURE = Object.freeze([
  'scripts/run-tutor-stub-qa-matrix.js',
  'scripts/run-tutor-stub-auto-eval.js',
  'scripts/analyze-tutor-stub-resistance-axis-calibration.js',
  ['scripts', 'tutor-' + 'stub.js'].join('/'),
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
]);

const FRAME_REFUSER_OPPORTUNITY_V4_CRITICAL_SOURCE_CLOSURE = Object.freeze([
  ...FRAME_REFUSER_OPPORTUNITY_CRITICAL_SOURCE_CLOSURE,
  'services/tutorStubCliPolicyRetry.js',
  'services/tutorStubPromptTransport.js',
  'services/tutorStubTutorAttemptRuntime.js',
  'services/tutorStubTraceRuntime.js',
  'services/tutorStubLabs.js',
  'services/tutorStubApplicationTraceContext.js',
  'services/tutorStubCliApplicationHost.js',
]);

const RESISTANCE_ACTION_REGISTER_BASELINE_V2_CRITICAL_SOURCE_CLOSURE = Object.freeze([
  'scripts/run-tutor-stub-resistance-action-register-crossed.js',
  'scripts/analyze-tutor-stub-resistance-action-register-baseline.js',
  ['scripts', 'tutor-' + 'stub.js'].join('/'),
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
]);

const RESISTANCE_ACTION_REGISTER_CONFIRMATION_V1_CRITICAL_SOURCE_CLOSURE = Object.freeze([
  'scripts/run-tutor-stub-resistance-action-register-confirmation.js',
  'scripts/analyze-tutor-stub-resistance-action-register-confirmation.js',
  ['scripts', 'tutor-' + 'stub.js'].join('/'),
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
]);

const RESISTANCE_ACTION_REGISTER_STOPPED_V2_REQUEST = Object.freeze({
  requestRevision: 3,
  request: Object.freeze({
    path: 'config/tutor-stub-resistance-action-register-baseline-study-go-request.v2.json',
    sha256: 'b28f62240e82301fed77f4690b59eaf6df2fac3c7e4812f053071efb89135c1c',
  }),
  disposition: 'consumed_stopped_wholly_excluded',
  partialBatch: Object.freeze({
    batch: 'A',
    artifactRoot: '.tutor-stub-auto-eval/resistance-action-register-baseline-v2-live-2026-08-20-a',
    artifactRootManifestSha256: '6eec7d2edc8664833d56cf8a66aa6bf6a272ec04981d18fb3550b02ad6a6ea10',
    privateArchiveManifestSha256: 'd3c15b61a5bfffbc6fa9faa344e03776ea110c068f72157d4466c53930f5248b',
    reservations: 31,
    completed: 28,
    interrupted: 3,
    providerErrors: 0,
    traces: Object.freeze([
      Object.freeze({
        jobId: 'frame_refuser-v4-r1-t1__matched_plain_A',
        path: 'jobs/frame_refuser-v4-r1-t1__matched_plain_A/traces/2026-08-20T08-54-55-423Z.jsonl',
        sha256: 'd3bda6c8439ba8a918ce1c8ae473892186469ebd43c29aa5d7811e736875b81d',
      }),
      Object.freeze({
        jobId: 'frame_refuser-v4-r1-t1__matched_warm_A',
        path: 'jobs/frame_refuser-v4-r1-t1__matched_warm_A/traces/2026-08-20T08-54-55-418Z.jsonl',
        sha256: '72725d86b767b9e330356f20481ef3a9b6971d697835591d7c40275bc1bba258',
      }),
      Object.freeze({
        jobId: 'frame_refuser-v4-r2-t1__matched_plain_A',
        path: 'jobs/frame_refuser-v4-r2-t1__matched_plain_A/traces/2026-08-20T08-54-55-418Z.jsonl',
        sha256: '0eb633edef1d67d29dd2c18e2f54db993151982e03b140fff3e263854d866822',
      }),
      Object.freeze({
        jobId: 'frame_refuser-v4-r2-t1__matched_warm_A',
        path: 'jobs/frame_refuser-v4-r2-t1__matched_warm_A/traces/2026-08-20T08-55-34-985Z.jsonl',
        sha256: 'e92c93e5cf6410bb54561bee9ed8a9e58cf5dded3cb0d6b00b82371337b3aa3c',
      }),
      Object.freeze({
        jobId: 'frame_refuser-v4-r3-t1__matched_plain_A',
        path: 'jobs/frame_refuser-v4-r3-t1__matched_plain_A/traces/2026-08-20T08-55-37-146Z.jsonl',
        sha256: '1a2fab9e2a1a32bbba2a0a481a5c4df9c6804824a10b404c30803bfb22590b4d',
      }),
      Object.freeze({
        jobId: 'frame_refuser-v4-r3-t1__matched_warm_A',
        path: 'jobs/frame_refuser-v4-r3-t1__matched_warm_A/traces/2026-08-20T08-55-46-896Z.jsonl',
        sha256: '769756881993f7f3115c794531c68187dc72d1a559a3dd12e4fa7df1aad44aea',
      }),
    ]),
  }),
  batchBStarted: false,
  combinedAnalyzerRan: false,
  combinedResultProduced: false,
  sealProduced: false,
  recoveryPermitted: false,
  reusePermitted: false,
  poolingPermitted: false,
  outcomeSelectionPermitted: false,
});

const RESISTANCE_ACTION_REGISTER_STOPPED_V3_REQUEST = Object.freeze({
  requestRevision: 4,
  request: Object.freeze({
    path: 'config/tutor-stub-resistance-action-register-baseline-study-go-request.v3.json',
    sha256: '568782ec4df4453f4c7e08d6f26afbfe8174bd33a134c6057c65bb9f9b71315d',
  }),
  disposition: 'consumed_stopped_wholly_excluded',
  partialBatch: Object.freeze({
    batch: 'A',
    artifactRoot: '.tutor-stub-auto-eval/resistance-action-register-baseline-v2-successor-live-2026-08-20-a',
    artifactRootManifestSha256: '0db1496cdab580b2094f536aa1b66276bd7eab8548963341d99914065277e8bd',
    privateArchiveManifestSha256: 'bf15bc3e9f5187f768a2cbff5c3db2d4dcf1ef9f52ece632c8e967ff6a6ffadf',
    reservations: 33,
    completed: 30,
    interrupted: 3,
    providerErrors: 0,
    traces: Object.freeze([
      Object.freeze({
        jobId: 'frame_refuser-v4-r1-t1__matched_plain_A',
        path: 'jobs/frame_refuser-v4-r1-t1__matched_plain_A/traces/2026-08-20T12-49-26-800Z.jsonl',
        sha256: 'f4fc7c7ca95dc43a2ac01b3bb295a7e3ab7d307a9a39140a664edf6648f7928b',
      }),
      Object.freeze({
        jobId: 'frame_refuser-v4-r1-t1__matched_warm_A',
        path: 'jobs/frame_refuser-v4-r1-t1__matched_warm_A/traces/2026-08-20T12-49-26-789Z.jsonl',
        sha256: '7a7a6718e08c52cc05fbcc66033d5fdb58f775bcfbe132fff7a26495a3579d39',
      }),
      Object.freeze({
        jobId: 'frame_refuser-v4-r2-t1__matched_plain_A',
        path: 'jobs/frame_refuser-v4-r2-t1__matched_plain_A/traces/2026-08-20T12-49-26-791Z.jsonl',
        sha256: '466ccc9626a401cd146e197214ade34b2cc87bb1bbe5623823b6bc53e909d88c',
      }),
      Object.freeze({
        jobId: 'frame_refuser-v4-r2-t1__matched_warm_A',
        path: 'jobs/frame_refuser-v4-r2-t1__matched_warm_A/traces/2026-08-20T12-50-10-377Z.jsonl',
        sha256: 'b6cb0c5fec92c2c83ce0318e7c48da1fd43d63c00012d4f652f82d766eb0f14a',
      }),
      Object.freeze({
        jobId: 'frame_refuser-v4-r3-t1__matched_plain_A',
        path: 'jobs/frame_refuser-v4-r3-t1__matched_plain_A/traces/2026-08-20T12-50-15-601Z.jsonl',
        sha256: '72c16ea8e715fc888785f49ebadaed5525d962a1590295a0402399ad298fc002',
      }),
      Object.freeze({
        jobId: 'frame_refuser-v4-r3-t1__matched_warm_A',
        path: 'jobs/frame_refuser-v4-r3-t1__matched_warm_A/traces/2026-08-20T12-50-20-317Z.jsonl',
        sha256: '35394468d9c2b839524645bffccb758c9578a0d32be7d181cca267eeebd898f5',
      }),
    ]),
  }),
  batchBStarted: false,
  combinedAnalyzerRan: false,
  combinedResultProduced: false,
  sealProduced: false,
  recoveryPermitted: false,
  reusePermitted: false,
  poolingPermitted: false,
  outcomeSelectionPermitted: false,
});

const RESISTANCE_ACTION_REGISTER_SUCCESSOR_BY_REVISION = Object.freeze({
  [RESISTANCE_ACTION_REGISTER_STOPPED_V2_REQUEST.requestRevision]: Object.freeze({
    stoppedExecution: RESISTANCE_ACTION_REGISTER_STOPPED_V2_REQUEST,
    programmeLedgerBefore: 76,
    programmeLedgerAfterMaximum: 544,
  }),
  [RESISTANCE_ACTION_REGISTER_STOPPED_V3_REQUEST.requestRevision]: Object.freeze({
    stoppedExecution: RESISTANCE_ACTION_REGISTER_STOPPED_V3_REQUEST,
    programmeLedgerBefore: 109,
    programmeLedgerAfterMaximum: 577,
  }),
});

const RESISTANCE_ACTION_REGISTER_SEALED_V4_ANALYSIS = Object.freeze({
  priorRequest: Object.freeze({
    path: 'config/tutor-stub-resistance-action-register-baseline-study-go-request.v4.json',
    sha256: 'a2bf1d15de24f358518569ac5af7a3ddcfa78150aa4d89a7c038490f912f8806',
  }),
  traceSourceCommit: '58aa961600368fa98387942572c187a1896aae3f',
  traceSourceTree: 'de5e05836b867bac5fa9071d845aefbb6d21abd0',
  batchA: Object.freeze({
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
    traces: Object.freeze([
      Object.freeze({
        jobId: 'frame_refuser-v4-r1-t1__matched_plain_A',
        sha256: '481101593b977ba1a25bc8d1dbb120ccfb09a0d609c2d6d271cdd1fe0a7d6c74',
      }),
      Object.freeze({
        jobId: 'frame_refuser-v4-r1-t1__matched_warm_A',
        sha256: 'b876fab7d707784168540eaba74c50b529062277cb76cabca97c65bdec9046f7',
      }),
      Object.freeze({
        jobId: 'frame_refuser-v4-r2-t1__matched_plain_A',
        sha256: 'd1e756962a794a6110c0589b4d7eadabf0f65e135b5757cfd963e9919e744581',
      }),
      Object.freeze({
        jobId: 'frame_refuser-v4-r2-t1__matched_warm_A',
        sha256: '15223bf2fd74c8cdd4082a812005cbb08f51806ae242787efa3d2fee261c43ef',
      }),
      Object.freeze({
        jobId: 'frame_refuser-v4-r3-t1__matched_plain_A',
        sha256: '883330168aea699d1e8a2ca7d56a139fec59f4353691921ec5c5531bb7daf9ac',
      }),
      Object.freeze({
        jobId: 'frame_refuser-v4-r3-t1__matched_warm_A',
        sha256: '49b172e0724948c17aa02b24c26610fe75f086fa65d4f2d028dd0ce7c63b4c47',
      }),
    ]),
  }),
  batchB: Object.freeze({
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
    traces: Object.freeze([
      Object.freeze({
        jobId: 'frame_refuser-v4-r1-t1__matched_plain_B',
        sha256: 'd6ae48dca1bd9a24fec4901ec9b512b329937d5ecbe4537f4452a2c0cfc986f8',
      }),
      Object.freeze({
        jobId: 'frame_refuser-v4-r1-t1__matched_warm_B',
        sha256: '0f1242ef4327f34fc881b31ef2db95a326455ea7807e1dfcee123ddafec1cb09',
      }),
      Object.freeze({
        jobId: 'frame_refuser-v4-r2-t1__matched_plain_B',
        sha256: 'c196b46055bed2c0a36753f415349ab621e3f55bfc94870fd8bd7fb8f0555fad',
      }),
      Object.freeze({
        jobId: 'frame_refuser-v4-r2-t1__matched_warm_B',
        sha256: '0376f7e52ecfa60a6d457399291dffb3ac82ae3812221b5ca6ea99f9aa96dff1',
      }),
      Object.freeze({
        jobId: 'frame_refuser-v4-r3-t1__matched_plain_B',
        sha256: '1f34e17fb14e94e2365b515796c19fe5263a254b7a34c67b96e5ec1de32596a6',
      }),
      Object.freeze({
        jobId: 'frame_refuser-v4-r3-t1__matched_warm_B',
        sha256: '99a1e5f749dd84f30542d3ee1b9cc07d472ad7df0bc73ebf019fd3f9d568d379',
      }),
    ]),
  }),
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
});

function parseArgs(argv) {
  const args = { request: DEFAULT_REQUEST, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--request') args.request = path.resolve(argv[++index] || '');
    else if (token === '--json') args.json = true;
    else if (token === '--help' || token === '-h') {
      console.log(`Usage:
  node scripts/check-tutor-stub-resistant-profile-study-go-request.js [options]

Options:
  --request <json>  non-executable study GO request
  --json            emit machine-readable report

This is a zero-call, zero-write request validator. It cannot authorize or
launch the study.`);
      process.exit(0);
    } else throw new Error(`Unknown option: ${token}`);
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function sha256Json(value) {
  return sha256(JSON.stringify(value));
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

function sha256CanonicalJson(value) {
  return sha256(JSON.stringify(canonicalJson(value)));
}

function assertion(checks, name, condition, detail) {
  if (!condition) throw new Error(`${name}: ${detail}`);
  checks.push({ name, pass: true, detail });
}

function rootPath(relativePath) {
  return path.join(ROOT, relativePath);
}

function bindingPath(binding) {
  return path.isAbsolute(binding.path) ? binding.path : rootPath(binding.path);
}

function validateFileBinding(checks, name, binding) {
  const observed = sha256File(bindingPath(binding));
  assertion(checks, name, observed === binding.sha256, `${binding.path} remains ${binding.sha256}`);
}

function validateMachineLocalFileBinding(checks, name, binding) {
  const filePath = bindingPath(binding);
  if (!fs.existsSync(filePath)) {
    checks.push({
      name,
      pass: false,
      detail: `${binding.path} is unavailable on this machine`,
    });
    return false;
  }
  validateFileBinding(checks, name, binding);
  return true;
}

function commandArg(command, flag) {
  const index = command.indexOf(flag);
  return index === -1 ? null : command[index + 1];
}

function commandArgs(command, flag) {
  const values = [];
  for (let index = 0; index < command.length; index += 1) {
    if (command[index] === flag) values.push(command[index + 1]);
  }
  return values;
}

function sourceCommitAudit(source) {
  const result = spawnSync('git', ['show', '-s', '--format=%T', source.launchCommit], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return {
      available: false,
      reason: 'launch commit object is unavailable in this checkout (expected in shallow CI checkouts)',
    };
  }
  const observedTree = result.stdout.trim();
  if (observedTree !== source.launchTree) {
    throw new Error(`source-launch-tree: expected ${source.launchTree}, observed ${observedTree}`);
  }
  return { available: true, observedTree };
}

function formatMarkdown(report) {
  return `${[
    '# Resistant Profile Study GO Request',
    '',
    `Status: **${report.status}**`,
    `Request SHA-256: \`${report.requestSha256}\``,
    `Launch commit: \`${report.launchCommit}\``,
    `Ready for explicit human approval: **${report.readyForExplicitHumanApproval ? 'yes' : 'no'}**`,
    `Live run authorized: **${report.liveRunAuthorized ? 'yes' : 'no'}**`,
    `Model calls made by this check: **${report.modelCalls}**`,
    `Production writes made by this check: **${report.productionWrites}**`,
    '',
    'Exact approval statement:',
    '',
    `> ${report.exactApprovalStatement}`,
    '',
    'This validator does not execute the live command.',
    '',
  ].join('\n')}\n`;
}

export function validateTutorStubResistantProfileStudyGoRequest({ requestPath = DEFAULT_REQUEST } = {}) {
  const request = readJson(requestPath);
  const checks = [];
  const isFrameRefuserOpportunity = request.opportunityGate?.type === 'prospective_frame_refuser_treatment_opportunity';
  const isActionRegisterBaseline =
    request.actionRegisterBaseline?.type === 'prospective_frame_refuser_action_register_baseline_v2';
  const isActionRegisterAnalysisOnly =
    request.actionRegisterBaselineAnalysis?.type === 'sealed_frame_refuser_action_register_baseline_analysis_only_v1';
  const isActionRegisterConfirmation =
    request.actionRegisterConfirmation?.type === 'prospective_frame_refuser_warm_plain_confirmation_v1';

  assertion(
    checks,
    'request-schema',
    request.schema === 'machinespirits.tutor-stub.resistant-profile-discrimination-study-go-request.v1',
    request.schema,
  );
  assertion(
    checks,
    'request-hold-status',
    request.status === 'HOLD_PENDING_EXPLICIT_HUMAN_APPROVAL',
    'the request cannot authorize execution',
  );
  assertion(
    checks,
    'authorization-absent',
    request.authorization.explicitHumanApproval === null &&
      request.authorization.modelCallsAuthorized === false &&
      request.authorization.liveRunAuthorized === false,
    'no human approval, model call, or live run is encoded',
  );
  assertion(
    checks,
    'source-pin-shape',
    /^[0-9a-f]{40}$/u.test(request.source.launchCommit) && /^[0-9a-f]{40}$/u.test(request.source.launchTree),
    `launch source is ${request.source.launchCommit} / ${request.source.launchTree}`,
  );

  const sourceAudit = sourceCommitAudit(request.source);
  const sourceClosure = request.source.closure;
  if (
    isFrameRefuserOpportunity ||
    isActionRegisterBaseline ||
    isActionRegisterAnalysisOnly ||
    isActionRegisterConfirmation
  ) {
    assertion(
      checks,
      'frame-refuser-opportunity-source-closure',
      Array.isArray(sourceClosure) && sourceClosure.length > 0,
      'the opportunity request must bind a non-empty critical executable source closure',
    );
    const closurePaths = sourceClosure.map((entry) => entry?.path);
    const registrationVersion = readJson(bindingPath(request.bindings.registration)).version ?? 1;
    const requiredCriticalSourceClosure = isActionRegisterConfirmation
      ? RESISTANCE_ACTION_REGISTER_CONFIRMATION_V1_CRITICAL_SOURCE_CLOSURE
      : isActionRegisterBaseline || isActionRegisterAnalysisOnly
        ? RESISTANCE_ACTION_REGISTER_BASELINE_V2_CRITICAL_SOURCE_CLOSURE
        : registrationVersion === 4
          ? FRAME_REFUSER_OPPORTUNITY_V4_CRITICAL_SOURCE_CLOSURE
          : FRAME_REFUSER_OPPORTUNITY_CRITICAL_SOURCE_CLOSURE;
    assertion(
      checks,
      'frame-refuser-opportunity-critical-source-closure',
      new Set(closurePaths).size === closurePaths.length &&
        requiredCriticalSourceClosure.every((entry) => closurePaths.includes(entry)),
      isActionRegisterConfirmation
        ? 'fresh confirmation executor, combined Fisher analyzer, dynamic trigger runtime, retry metering, validator, route, world, and dependency files remain bound'
        : isActionRegisterBaseline || isActionRegisterAnalysisOnly
          ? 'exact-prefix executor, combined analyzer, runtime intervention, retry metering, validator, route, world, and dependency files remain bound'
          : registrationVersion === 4
            ? 'launch, analyzer, observer, runtime provenance, retry transport, metering, prefix, preflight, validator, world, route, and dependency files remain bound'
            : 'launch, analyzer, observer, runtime, prefix, preflight, validator, world, route, and dependency files remain bound',
    );
  }
  for (const entry of sourceClosure) {
    validateFileBinding(checks, `source-closure-${entry.path}`, entry);
  }
  checks.push({
    name: 'source-commit-object',
    pass: true,
    detail: sourceAudit.available ? `launch tree verified as ${sourceAudit.observedTree}` : sourceAudit.reason,
  });

  validateFileBinding(checks, 'registration-binding', request.bindings.registration);
  const endpoint = request.bindings.endpoint;
  let hold = null;
  if (
    isFrameRefuserOpportunity ||
    isActionRegisterBaseline ||
    isActionRegisterAnalysisOnly ||
    isActionRegisterConfirmation
  ) {
    const contract = readJson(rootPath(endpoint.contractPath));
    const certificate = readJson(rootPath(endpoint.certificatePath));
    const endpointRegistration = readJson(rootPath(request.bindings.registration.path));
    const expectedEndpointCases = isActionRegisterConfirmation
      ? 36
      : isActionRegisterBaseline || isActionRegisterAnalysisOnly
        ? 12
        : 6;
    assertion(
      checks,
      'opportunity-endpoint-contract-binding',
      sha256File(rootPath(endpoint.contractPath)) === endpoint.contractFileSha256 &&
        sha256CanonicalJson(contract) === endpoint.contractCanonicalSha256 &&
        contract.study_id === request.studyId &&
        contract.registered_scale?.cases === expectedEndpointCases &&
        contract.registration?.registration_path === request.bindings.registration.path &&
        contract.registration?.registration_sha256 === request.bindings.registration.sha256,
      `the ${expectedEndpointCases}-case executable endpoint contract remains file- and runtime-bound`,
    );
    assertion(
      checks,
      'opportunity-endpoint-certificate-binding',
      sha256File(rootPath(endpoint.certificatePath)) === endpoint.certificateFileSha256 &&
        certificate.schema === 'machinespirits.paid-study-endpoint-go.v1' &&
        certificate.status === 'endpoint_runtime_go' &&
        certificate.study_id === contract.study_id &&
        certificate.contract_path === endpoint.contractPath &&
        certificate.contract_sha256 === endpoint.contractCanonicalSha256 &&
        certificate.preflight_sha256 === endpoint.preflightSha256,
      `the ${expectedEndpointCases}-case endpoint certificate and zero-call preflight remain pinned`,
    );
    if (isActionRegisterConfirmation) {
      const endpointIds = contract.endpoints?.map((row) => row.id) || [];
      assertion(
        checks,
        'action-register-confirmation-endpoint-readiness-binding',
        endpointRegistration.version === 3 &&
          contract.runner?.live_batch_executor ===
            'scripts/run-tutor-stub-resistance-action-register-confirmation.js#runTutorStubResistanceActionRegisterConfirmationBatch' &&
          contract.runner?.live_batch_recovery_executor ===
            'scripts/run-tutor-stub-resistance-action-register-confirmation.js#recoverTutorStubResistanceActionRegisterConfirmationBatch' &&
          contract.runner?.combined_analyzer ===
            'scripts/analyze-tutor-stub-resistance-action-register-confirmation.js#analyzeTutorStubResistanceActionRegisterConfirmation' &&
          contract.runner?.batch_contract?.required_batches?.length === 9 &&
          contract.runner?.batch_contract?.dialogues_per_batch === 4 &&
          contract.runner?.batch_contract?.maximum_model_attempt_reservations_per_dialogue === 60 &&
          contract.runner?.batch_contract?.maximum_model_attempt_reservations_per_batch === 240 &&
          contract.runner?.batch_contract?.combined_maximum_model_attempt_reservations === 2160 &&
          contract.runner?.batch_contract?.combined_analysis_only === true &&
          contract.runner?.batch_contract?.valid_unit_reruns === false &&
          contract.runner?.batch_contract?.outcome_selection === false &&
          contract.runner?.batch_contract?.bounded_technical_recovery ===
            'missing_or_failed_units_only_within_unchanged_60_per_dialogue_240_per_batch_2160_confirmation_and_2345_programme_caps' &&
          [
            'profile_specific_resistance_recovery',
            'fisher_exact_two_sided_confirmation',
            'action_register_fidelity_and_safety',
            'fresh_independent_assembly',
          ].every((id) => endpointIds.includes(id)),
        'the 36-case endpoint binds fresh dynamic triggering, exact recovery, one Fisher analysis, and the 60/240/2160 ceilings',
      );
    } else if (isActionRegisterBaseline || isActionRegisterAnalysisOnly) {
      const prefixBundle = request.bindings.prefixBundle;
      validateFileBinding(checks, 'action-register-prefix-bundle-binding', prefixBundle);
      assertion(
        checks,
        'action-register-endpoint-readiness-binding',
        endpointRegistration.version === 2 &&
          contract.runner?.public_prefix_bundle === prefixBundle.path &&
          contract.runner?.public_prefix_bundle_sha256 === prefixBundle.sha256 &&
          contract.runner?.live_batch_executor ===
            'scripts/run-tutor-stub-resistance-action-register-crossed.js#runTutorStubResistanceActionRegisterBatch' &&
          contract.runner?.live_batch_recovery_executor ===
            'scripts/run-tutor-stub-resistance-action-register-crossed.js#recoverTutorStubResistanceActionRegisterBatch' &&
          contract.runner?.combined_analyzer ===
            'scripts/analyze-tutor-stub-resistance-action-register-baseline.js#analyzeTutorStubResistanceActionRegisterBaseline' &&
          contract.runner?.batch_contract?.dialogues_per_batch === 6 &&
          contract.runner?.batch_contract?.maximum_model_attempt_reservations_per_dialogue === 39 &&
          contract.runner?.batch_contract?.maximum_model_attempt_reservations_per_batch === 234 &&
          contract.runner?.batch_contract?.combined_maximum_model_attempt_reservations === 468 &&
          contract.runner?.batch_contract?.combined_analysis_only === true &&
          contract.runner?.batch_contract?.valid_unit_reruns === false &&
          contract.runner?.batch_contract?.outcome_selection === false &&
          contract.runner?.batch_contract?.bounded_technical_recovery ===
            'missing_or_failed_units_only_within_unchanged_39_per_dialogue_and_234_per_batch_caps',
        'the V2 endpoint binds the public prefix bundle, exact executor and bounded recovery, combined analyzer, and fixed ceilings',
      );
    } else if (endpointRegistration.version === 3) {
      const endpointIds = contract.endpoints?.map((row) => row.id) || [];
      assertion(
        checks,
        'frame-refuser-opportunity-v3-endpoint-readiness-binding',
        contract.runner?.packet_builder ===
          'services/tutorStubResistanceAxisDiscriminationPreflight.js#buildTutorStubFrameRefuserOpportunityV3PreflightPackets' &&
          contract.runner?.emitted_event_fields?.includes('observerMatrixAudit') &&
          contract.runner?.emitted_event_fields?.includes('repairBudgetAudit') &&
          [
            'frame_defiant_adherence_exhaustion_typed_failure',
            'frame_refuser_adherence_exhaustion_typed_failure',
            'prospective_v3_observer_matrix',
            'prospective_v3_repair_budget_readiness',
          ].every((id) => endpointIds.includes(id)),
        'the v3 endpoint binds both typed failures, the production observer matrix, and deterministic repair readiness',
      );
    } else if (endpointRegistration.version === 4) {
      const endpointIds = contract.endpoints?.map((row) => row.id) || [];
      assertion(
        checks,
        'frame-refuser-opportunity-v4-endpoint-readiness-binding',
        contract.runner?.packet_builder ===
          'services/tutorStubResistanceAxisDiscriminationPreflight.js#buildTutorStubFrameRefuserOpportunityV4PreflightPackets' &&
          contract.registration?.required_turns === 2 &&
          contract.runner?.emitted_event_fields?.includes('observerMatrixAudit') &&
          contract.runner?.emitted_event_fields?.includes('repairBudgetAudit') &&
          contract.runner?.emitted_event_fields?.includes('deferredAdherenceAudit') &&
          [
            'frame_defiant_adherence_exhaustion_typed_failure',
            'frame_refuser_adherence_exhaustion_typed_failure',
            'prospective_v4_observer_matrix',
            'prospective_v4_t1_t2_repair_budget_readiness',
            'prospective_v4_t1_t2_deferred_adherence',
          ].every((id) => endpointIds.includes(id)),
        'the v4 endpoint binds the T1-T2 gate, both typed failures, observer matrix, deferred admission, and reservation-aware repair readiness',
      );
    }
  } else {
    validateFileBinding(checks, 'readiness-hold-binding', request.bindings.liveReadinessHold);
    hold = readJson(rootPath(request.bindings.liveReadinessHold.path));
    const readiness = JSON.parse(
      execFileSync(
        process.execPath,
        [
          'scripts/check-tutor-stub-resistant-profile-live-readiness.js',
          '--hold',
          request.bindings.liveReadinessHold.path,
          '--json',
        ],
        {
          cwd: ROOT,
          encoding: 'utf8',
        },
      ),
    );
    assertion(
      checks,
      'live-readiness',
      readiness.packetValid === true &&
        readiness.routeVerificationPassed === true &&
        readiness.readyForStudyGoPreparation === true &&
        readiness.modelCalls === 0 &&
        readiness.productionWrites === 0,
      'the full readiness packet and consumed route canary remain valid with zero new calls and writes',
    );
    assertion(
      checks,
      'endpoint-contract-file-binding',
      sha256File(rootPath(endpoint.contractPath)) === endpoint.contractFileSha256 &&
        endpoint.contractCanonicalSha256 === hold.endpoint.contractSha256,
      'the endpoint contract file and canonical runtime binding remain pinned',
    );
    assertion(
      checks,
      'endpoint-certificate-file-binding',
      sha256File(rootPath(endpoint.certificatePath)) === endpoint.certificateFileSha256 &&
        endpoint.preflightSha256 === hold.endpoint.preflightSha256,
      'the endpoint certificate and full-scale preflight remain pinned',
    );
  }

  const route = request.bindings.routeCanary;
  const routeResult = readJson(rootPath(route.resultPath));
  assertion(
    checks,
    'route-result-binding',
    sha256File(rootPath(route.resultPath)) === route.resultSha256 &&
      sha256File(rootPath(route.authorizationConsumptionPath)) === route.authorizationConsumptionSha256 &&
      routeResult.status === 'passed' &&
      routeResult.modelCalls === 1 &&
      routeResult.sourceArtifactSha256 === route.sourceArtifactSha256 &&
      routeResult.executionHead === route.executionHead &&
      routeResult.observed.provider === route.observedProvider &&
      routeResult.observed.model === route.observedModel &&
      routeResult.observed.effort === route.observedEffort &&
      routeResult.observed.modelAttestationBasis === route.attestationBasis &&
      routeResult.observed.modelIndependentlyAttested === route.modelIndependentlyAttested,
    'the one consumed Luna route call remains exactly bound and is not independently attested',
  );

  const isReplacement = request.replacement?.type === 'fresh_profile_cohort_replacement';
  const isFreshMeasurementRecheck = request.recheck?.type === 'fresh_full_cohort_measurement_recheck';
  const isTechnicalRecovery =
    request.technicalRecovery?.type === 'fresh_destination_after_pre_model_dependency_failure';
  const isAxisHeldout = request.axisHeldout?.type === 'prospective_resistance_axis_heldout';
  const commandSource = request.bindings.commands.source;
  const liveCommand = commandSource === 'commands' ? request.commands?.live : hold.proposedCommands.live;
  const analyzeCommand = commandSource === 'commands' ? request.commands?.analyze : hold.proposedCommands.analyze;
  const recoveryCommand = commandSource === 'commands' ? request.commands?.recovery : null;
  assertion(
    checks,
    'command-source',
    (commandSource === 'commands' &&
      (isReplacement ||
        isFreshMeasurementRecheck ||
        isAxisHeldout ||
        isFrameRefuserOpportunity ||
        isActionRegisterBaseline ||
        isActionRegisterAnalysisOnly ||
        isActionRegisterConfirmation)) ||
      commandSource === 'bindings.liveReadinessHold.path#proposedCommands',
    `command source is ${commandSource}`,
  );
  if (isActionRegisterAnalysisOnly) {
    assertion(
      checks,
      'analysis-only-no-live-command',
      liveCommand === undefined && request.bindings.commands.liveArraySha256 === undefined,
      'the analysis-only request contains no live command or live-command digest',
    );
  } else {
    assertion(
      checks,
      'live-command-binding',
      Array.isArray(liveCommand) && sha256Json(liveCommand) === request.bindings.commands.liveArraySha256,
      `live command array remains ${request.bindings.commands.liveArraySha256}`,
    );
  }
  assertion(
    checks,
    'analysis-command-binding',
    Array.isArray(analyzeCommand) && sha256Json(analyzeCommand) === request.bindings.commands.analyzeArraySha256,
    `analysis command array remains ${request.bindings.commands.analyzeArraySha256}`,
  );
  if (isActionRegisterAnalysisOnly) {
    assertion(
      checks,
      'analysis-only-no-recovery-command',
      recoveryCommand === undefined && request.bindings.commands.recoveryArraySha256 === undefined,
      'the analysis-only request contains no recovery command or recovery-command digest',
    );
  } else if (isActionRegisterBaseline || isActionRegisterConfirmation) {
    assertion(
      checks,
      'recovery-command-binding',
      Array.isArray(recoveryCommand) && sha256Json(recoveryCommand) === request.bindings.commands.recoveryArraySha256,
      `recovery command array remains ${request.bindings.commands.recoveryArraySha256}`,
    );
  }

  let priorArtifactsAvailable = true;
  if (isReplacement) {
    const retained = request.replacement.retainedPriorTraces;
    const excluded = request.replacement.excludedPriorTraces;
    const retainedProfiles = [...new Set(retained.map((entry) => entry.profile))].sort();
    const retainedRunsByProfile = Object.fromEntries(
      retainedProfiles.map((profile) => [
        profile,
        retained
          .filter((entry) => entry.profile === profile)
          .map((entry) => entry.run)
          .sort((left, right) => left - right)
          .join(','),
      ]),
    );
    assertion(
      checks,
      'replacement-design-binding',
      request.design.profiles.join(',') === 'frame_defiant' &&
        request.design.dialogues === 3 &&
        request.design.runsPerProfile === 3 &&
        request.design.parallelism === 3 &&
        request.budget.dialogues === 3 &&
        request.budget.maximumAttemptsPerDialogue === 48 &&
        request.budget.maximumPlannedModelAttempts === 144 &&
        request.budget.retryOrResumeAuthority === 'none',
      'three fresh frame_defiant dialogues and the 144-attempt no-retry ceiling remain frozen',
    );
    assertion(
      checks,
      'replacement-trace-partition',
      retained.length === 15 &&
        excluded.length === 3 &&
        request.replacement.retainedTraceCount === 15 &&
        request.replacement.excludedTraceCount === 3 &&
        request.replacement.freshTraceCount === 3 &&
        request.replacement.finalAnalysisTraceCount === 18 &&
        retainedProfiles.join(',') === 'bored,diligent,low_agency,low_trust_skeptic,skeptical' &&
        Object.values(retainedRunsByProfile).every((runs) => runs === '1,2,3') &&
        excluded.every((entry) => entry.profile === 'frame_defiant') &&
        excluded
          .map((entry) => entry.run)
          .sort((left, right) => left - right)
          .join(',') === '1,2,3' &&
        request.replacement.priorFrameDefiantTracesReused === false &&
        request.replacement.priorDialoguesResumed === false,
      '15 unaffected traces are retained and all three prior frame_defiant traces are excluded',
    );
    validateFileBinding(checks, 'prior-request-binding', {
      path: request.replacement.priorRequestPath,
      sha256: request.replacement.priorRequestSha256,
    });
    for (const [name, binding] of [
      ['prior-run-plan-binding', request.replacement.priorRunPlan],
      ['prior-qa-plan-binding', request.replacement.priorQaPlan],
      ...retained.map((entry) => [`retained-trace-${entry.profile}-r${entry.run}`, entry]),
      ...excluded.map((entry) => [`excluded-trace-${entry.profile}-r${entry.run}`, entry]),
    ]) {
      priorArtifactsAvailable = validateMachineLocalFileBinding(checks, name, binding) && priorArtifactsAvailable;
    }
    assertion(
      checks,
      'replacement-live-command-shape',
      liveCommand[0] === 'node' &&
        liveCommand[1] === 'scripts/run-tutor-stub-qa-matrix.js' &&
        commandArg(liveCommand, '--profiles') === 'frame_defiant' &&
        commandArg(liveCommand, '--policies') === 'field' &&
        commandArg(liveCommand, '--runs') === '3' &&
        commandArg(liveCommand, '--run-seed') === '20260818' &&
        commandArg(liveCommand, '--turns') === '8' &&
        commandArg(liveCommand, '--safety-turns') === '8' &&
        commandArg(liveCommand, '--model-call-budget') === '48' &&
        commandArg(liveCommand, '--model') === request.design.models.tutor &&
        commandArg(liveCommand, '--analysis-model') === request.design.models.analysis &&
        commandArg(liveCommand, '--auto-learner-model') === request.design.models.learner &&
        commandArg(liveCommand, '--world') === request.design.world &&
        commandArg(liveCommand, '--dag-mode') === 'strict_dag' &&
        commandArg(liveCommand, '--register-palette') === 'safe' &&
        commandArg(liveCommand, '--register-overlay-threshold') === '0.7' &&
        commandArg(liveCommand, '--release-speed') === '1' &&
        commandArg(liveCommand, '--cli-effort') === request.design.cliEffort &&
        commandArg(liveCommand, '--history-turns') === '4' &&
        commandArg(liveCommand, '--max-tokens') === '4096' &&
        commandArg(liveCommand, '--parallelism') === '3' &&
        commandArg(liveCommand, '--trace-dir') === request.destination.artifactRoot &&
        liveCommand.includes('--no-html-report') &&
        liveCommand.includes('--no-memory-summary') &&
        liveCommand.includes('--no-analyze') &&
        !liveCommand.includes('--keep-going'),
      'the fresh three-dialogue command preserves the frozen runtime configuration',
    );
    const retainedTracePaths = retained.map((entry) => entry.path);
    const analysisTracePaths = commandArgs(analyzeCommand, '--trace');
    assertion(
      checks,
      'replacement-analysis-command-shape',
      analyzeCommand[0] === 'node' &&
        analyzeCommand[1] === 'scripts/analyze-tutor-stub-profile-discrimination.js' &&
        JSON.stringify(analysisTracePaths) === JSON.stringify(retainedTracePaths) &&
        excluded.every((entry) => !analysisTracePaths.includes(entry.path)) &&
        commandArg(analyzeCommand, '--trace-root') === request.destination.artifactRoot &&
        commandArg(analyzeCommand, '--required-traces') === '18' &&
        commandArg(analyzeCommand, '--required-profiles') === request.design.analysisProfiles.join(',') &&
        commandArg(analyzeCommand, '--required-runs-per-profile') === '3' &&
        commandArg(analyzeCommand, '--required-turns') === '8' &&
        commandArg(analyzeCommand, '--required-policies') === 'field' &&
        commandArg(analyzeCommand, '--required-tutor-model') === request.design.models.tutor &&
        commandArg(analyzeCommand, '--required-analysis-model') === request.design.models.analysis &&
        commandArg(analyzeCommand, '--required-learner-model') === request.design.models.learner &&
        analyzeCommand.includes('--require-pooled'),
      'the analysis combines only the 15 pinned prior traces with the fresh sealed root',
    );
  } else if (isActionRegisterConfirmation) {
    const registered = readJson(rootPath(request.bindings.registration.path));
    const gate = request.actionRegisterConfirmation;
    const blocks = request.design.blocks;
    const batchDestinations = request.destination.batches;
    assertion(
      checks,
      'action-register-confirmation-design-binding',
      registered.version === 3 &&
        request.design.profiles.join(',') === 'frame_refuser' &&
        request.design.dialogues === 36 &&
        request.design.dialoguesPerArm === 18 &&
        request.design.realizations.join(',') === 'plain,warm' &&
        request.design.freshIndependentDialogues === true &&
        request.design.triggerMustShowByTurn === 2 &&
        request.design.outcomeHorizonLearnerTurns === 2 &&
        request.design.models.tutor === 'codex.gpt-5.6-luna' &&
        request.design.models.analysis === 'codex.gpt-5.6-luna' &&
        request.design.models.learner === 'codex.gpt-5.6-luna' &&
        request.design.cliEffort === 'low' &&
        Array.isArray(blocks) &&
        blocks.length === 9 &&
        new Set(blocks.map((block) => block.id)).size === 9 &&
        blocks.every((block) => block.dialogues === 4 && block.plain === 2 && block.warm === 2),
      'the confirmation is 36 fresh dynamic-trigger dialogues, 18 per arm, in nine balanced blocks',
    );
    assertion(
      checks,
      'action-register-confirmation-calibration-separation',
      gate.calibrationSizingEvidence?.analysisRequest?.path ===
        'config/tutor-stub-resistance-action-register-baseline-analysis-go-request.v1.json' &&
        gate.calibrationSizingEvidence?.analysisRequest?.sha256 ===
          '965aca0ad1f61d2f43891c162861180016d79a8afa5c090ace0e3e88a436e0dd' &&
        gate.calibrationSizingEvidence?.reportSha256 ===
          '42021a390338cd556386efc96d8f00b35655a411627908a10248dba1e473a3a5' &&
        gate.calibrationSizingEvidence?.privateArchiveCommit === '0857363dabb4445052159b8218acaed13d921949' &&
        gate.calibrationSizingEvidence?.dialogues === 12 &&
        gate.calibrationSizingEvidence?.plainRecovered === 1 &&
        gate.calibrationSizingEvidence?.plainTotal === 6 &&
        gate.calibrationSizingEvidence?.warmRecovered === 4 &&
        gate.calibrationSizingEvidence?.warmTotal === 6 &&
        gate.calibrationSizingEvidence?.usedForSizingOnly === true &&
        gate.calibrationDialoguesReused === false &&
        gate.calibrationDialoguesPooled === false &&
        gate.interimAnalysisPermitted === false &&
        gate.validUnitRerunsPermitted === false &&
        gate.outcomeSelectionPermitted === false,
      'the 12 calibration dialogues are frozen sizing evidence only and cannot enter the confirmation analysis',
    );
    validateFileBinding(
      checks,
      'action-register-confirmation-calibration-request-binding',
      gate.calibrationSizingEvidence.analysisRequest,
    );
    assertion(
      checks,
      'action-register-confirmation-power-and-budget',
      request.power.test === 'fisher_exact_two_sided' &&
        request.power.alpha === 0.05 &&
        request.power.calibrationPlainRate === 1 / 6 &&
        request.power.calibrationWarmRate === 4 / 6 &&
        request.power.powerAt17PerArm === 0.796776592585303 &&
        request.power.powerAt18PerArm === 0.8388687257645503 &&
        request.power.minimumNPerArmAtOrAbove80Percent === 18 &&
        request.budget.dialogues === 36 &&
        request.budget.plannedRoleCallsPerDialogue === 20 &&
        request.budget.maximumReservationsPerPlannedCall === 3 &&
        request.budget.maximumAttemptsPerDialogue === 60 &&
        request.budget.dialoguesPerBatch === 4 &&
        request.budget.maximumAttemptsPerBatch === 240 &&
        request.budget.maximumPlannedModelAttempts === 2160 &&
        request.budget.programmeLedgerBefore === 185 &&
        request.budget.programmeCeilingBefore === 1200 &&
        request.budget.programmeCeilingAmendment === 1145 &&
        request.budget.programmeCeilingAfter === 2345 &&
        request.budget.programmeLedgerAfterMaximum === 2345 &&
        request.budget.retryOrResumeAuthority === 'bounded_technical_recovery',
      '20 planned calls times three charged attempts gives 60 per dialogue, 2160 total, and the exact 185-to-2345 programme boundary',
    );
    const recovery = gate.recoveryBoundary;
    assertion(
      checks,
      'action-register-confirmation-recovery-boundary',
      recovery.sameLaunchSource === true &&
        recovery.sameRegistrationModelsSeedsMeasurementAndArmAssignment === true &&
        recovery.missingOrFailedUnitsOnly === true &&
        recovery.freshNonOverwritingRecoveryCheckpoint === true &&
        recovery.rerunValidOutputs === false &&
        recovery.selectAmongOutcomes === false &&
        recovery.maximumAttemptsPerDialogueUnchanged === 60 &&
        recovery.maximumAttemptsPerBatchUnchanged === 240 &&
        recovery.maximumTotalStudyAttemptsUnchanged === 2160 &&
        recovery.programmeCeilingUnchanged === 2345,
      'bounded recovery may fill only missing or failed units under every unchanged confirmation cap',
    );
    assertion(
      checks,
      'action-register-confirmation-measurement-binding',
      request.measurement.reportSchema ===
        'machinespirits.tutor-stub.resistance-action-register-confirmation-report.v1' &&
        request.measurement.primaryOutcome ===
          'profile_specific_resistance_recovery_by_two_post_trigger_learner_turns' &&
        request.measurement.primaryTest === 'fisher_exact_two_sided' &&
        request.measurement.alpha === 0.05 &&
        request.measurement.oneCombinedThirtySixDialogueAnalysisRequired === true &&
        request.measurement.interimAnalysisPermitted === false &&
        request.measurement.analysisTraceSelection === 'exact_prebound_batch_result_traces_only' &&
        request.measurement.calibrationDialoguesReusedOrPooled === 0 &&
        request.measurement.claimBoundary ===
          'confirmation_of_frame_refuser_matched_action_warm_versus_plain_recovery_only',
      'one predeclared Fisher analysis tests only the fresh warm-versus-plain recovery contrast',
    );
    const exactLive = (command, block, destination) =>
      Array.isArray(command) &&
      command[0] === 'node' &&
      command[1] === 'scripts/run-tutor-stub-resistance-action-register-confirmation.js' &&
      command.includes('--live-batch') &&
      commandArg(command, '--batch') === block &&
      commandArg(command, '--destination') === destination &&
      commandArg(command, '--registration') === request.bindings.registration.path &&
      commandArg(command, '--parallelism') === '4' &&
      commandArg(command, '--expected-source-commit') === request.source.launchCommit;
    assertion(
      checks,
      'action-register-confirmation-live-commands',
      Array.isArray(liveCommand) &&
        liveCommand.length === 9 &&
        Array.isArray(batchDestinations) &&
        batchDestinations.length === 9 &&
        new Set(batchDestinations.map((entry) => entry.artifactRoot)).size === 9 &&
        liveCommand.every((command, index) =>
          exactLive(command, blocks[index].id, batchDestinations[index].artifactRoot),
        ),
      'nine live commands are prebound to the nine balanced create-once block roots',
    );
    const expectedRecovery = batchDestinations.map(({ artifactRoot }) => [
      'node',
      'scripts/run-tutor-stub-resistance-action-register-confirmation.js',
      '--recover-batch',
      '--destination',
      artifactRoot,
      '--expected-source-commit',
      request.source.launchCommit,
      '--parallelism',
      '4',
    ]);
    assertion(
      checks,
      'action-register-confirmation-recovery-commands',
      JSON.stringify(recoveryCommand) === JSON.stringify(expectedRecovery),
      'recovery commands preserve every block root, source, and hard cap without rerunning valid outputs',
    );
    assertion(
      checks,
      'action-register-confirmation-analysis-command',
      Array.isArray(analyzeCommand) &&
        analyzeCommand[0] === 'node' &&
        analyzeCommand[1] === 'scripts/analyze-tutor-stub-resistance-action-register-confirmation.js' &&
        JSON.stringify(commandArgs(analyzeCommand, '--batch')) ===
          JSON.stringify(batchDestinations.map((entry) => entry.artifactRoot)) &&
        commandArg(analyzeCommand, '--registration') === request.bindings.registration.path &&
        commandArg(analyzeCommand, '--expected-source-commit') === request.source.launchCommit &&
        commandArg(analyzeCommand, '--out') === request.destination.combinedReport &&
        analyzeCommand.includes('--json'),
      'the sole analyzer requires all nine sealed roots and writes one fresh combined report',
    );
  } else if (isActionRegisterAnalysisOnly) {
    const registered = readJson(rootPath(request.bindings.registration.path));
    const gate = request.actionRegisterBaselineAnalysis;
    assertion(
      checks,
      'action-register-analysis-only-design-binding',
      registered.version === 2 &&
        request.design.dialogues === 12 &&
        request.design.analysisOnly === true &&
        request.design.modelCalls === 0 &&
        request.design.validUnitReruns === false &&
        request.design.outcomeSelection === false,
      'the request analyzes the already-sealed 12-cell baseline without generating or selecting any model output',
    );
    assertion(
      checks,
      'action-register-analysis-only-sealed-input-binding',
      JSON.stringify(canonicalJson(gate.sealedInputs)) ===
        JSON.stringify(canonicalJson(RESISTANCE_ACTION_REGISTER_SEALED_V4_ANALYSIS)),
      'the prior request, sealed A/B plans/results/seals, 12 trace hashes, archive inventories, and accounting remain exact',
    );
    validateFileBinding(checks, 'action-register-analysis-only-prior-request-binding', gate.sealedInputs.priorRequest);
    assertion(
      checks,
      'action-register-analysis-only-boundary',
      gate.priorAnalyzerInvocation?.invokedOnce === true &&
        gate.priorAnalyzerInvocation?.exitCode === 1 &&
        gate.priorAnalyzerInvocation?.reportProduced === false &&
        gate.priorAnalyzerInvocation?.failureClass === 'deterministic_provenance_compatibility_defect' &&
        gate.modelUnitRerunsPermitted === false &&
        gate.liveCommandsPermitted === false &&
        gate.recoveryCommandsPermitted === false &&
        gate.analyzerInvocationsPermitted === 1 &&
        gate.inputMutationPermitted === false &&
        gate.poolingPermitted === false &&
        gate.outcomeSelectionPermitted === false &&
        gate.inputView?.mode === 'read_only_symlink_view' &&
        gate.inputView?.relativeBatchRootsPreserved === true &&
        gate.inputView?.sourceBatchRootsRemainImmutable === true &&
        gate.inputView?.requireObservedManifestHashesBeforeAnalysis === true &&
        gate.inputView?.modelCallsPermitted === false &&
        gate.inputView?.evidenceMutationPermitted === false,
      'one corrected zero-call analysis is permitted; model reruns, input mutation, pooling, and selection remain forbidden',
    );
    assertion(
      checks,
      'action-register-analysis-only-budget-binding',
      request.budget.maximumPlannedModelAttempts === 0 &&
        request.budget.programmeLedgerBefore === RESISTANCE_ACTION_REGISTER_SEALED_V4_ANALYSIS.programmeLedgerBefore &&
        request.budget.programmeLedgerAfterMaximum ===
          RESISTANCE_ACTION_REGISTER_SEALED_V4_ANALYSIS.programmeLedgerAfterMaximum &&
        request.budget.programmeCeiling === RESISTANCE_ACTION_REGISTER_SEALED_V4_ANALYSIS.programmeCeiling &&
        request.budget.retryOrResumeAuthority === 'none',
      'analysis consumes zero model attempts and leaves the programme ledger at 185 of 1200',
    );
    assertion(
      checks,
      'action-register-analysis-only-measurement-binding',
      request.measurement.reportSchema === 'machinespirits.tutor-stub.resistance-action-register-baseline-report.v2' &&
        request.measurement.primaryOutcome ===
          'profile_specific_resistance_recovery_by_two_post_trigger_learner_turns' &&
        request.measurement.repeatEndpoint === 'same_treatment_repeat_stability' &&
        request.measurement.combinedTwelveCellAnalysisRequired === true &&
        request.measurement.analysisTraceSelection === 'exact_prebound_batch_result_traces_only' &&
        request.measurement.partialBatchAnalysisPermitted === false &&
        request.measurement.v4OutcomesExcluded === true &&
        request.measurement.claimBoundary === 'calibration_only_no_tutor_or_register_efficacy_claim',
      'the original combined calibration estimand and no-efficacy boundary remain unchanged',
    );
    assertion(
      checks,
      'action-register-analysis-only-command',
      Array.isArray(analyzeCommand) &&
        analyzeCommand[0] === 'node' &&
        analyzeCommand[1] === 'scripts/analyze-tutor-stub-resistance-action-register-baseline.js' &&
        commandArg(analyzeCommand, '--batch-a') === gate.sealedInputs.batchA.artifactRoot &&
        commandArg(analyzeCommand, '--batch-b') === gate.sealedInputs.batchB.artifactRoot &&
        commandArg(analyzeCommand, '--registration') === request.bindings.registration.path &&
        commandArg(analyzeCommand, '--prefix-bundle') === request.bindings.prefixBundle.path &&
        commandArg(analyzeCommand, '--expected-analysis-source-commit') === request.source.launchCommit &&
        commandArg(analyzeCommand, '--expected-trace-source-commit') === gate.sealedInputs.traceSourceCommit &&
        !analyzeCommand.includes('--expected-source-commit') &&
        commandArg(analyzeCommand, '--out') === request.destination.combinedReport &&
        analyzeCommand.includes('--json'),
      'the sole command analyzes the exact sealed A/B roots under their original trace-source pin into a fresh report',
    );
  } else if (isActionRegisterBaseline) {
    const registered = readJson(rootPath(request.bindings.registration.path));
    const gate = request.actionRegisterBaseline;
    const successor = RESISTANCE_ACTION_REGISTER_SUCCESSOR_BY_REVISION[gate.requestRevision] ?? null;
    const isSuccessor = successor !== null;
    const programmeLedgerBefore = successor?.programmeLedgerBefore ?? 45;
    const programmeLedgerAfterMaximum = successor?.programmeLedgerAfterMaximum ?? 513;
    const liveA = liveCommand?.[0];
    const liveB = liveCommand?.[1];
    assertion(
      checks,
      'action-register-baseline-design-binding',
      registered.version === 2 &&
        request.design.profiles.join(',') === 'frame_refuser' &&
        request.design.dialogues === 12 &&
        request.design.prefixes === 3 &&
        request.design.realizations.join(',') === 'plain,warm' &&
        request.design.repeats.join(',') === 'A,B' &&
        request.design.actionFit === 'matched' &&
        request.design.pedagogicalMove === 'test_bounded_distinction' &&
        request.design.outcomeHorizonLearnerTurns === 2 &&
        request.design.models.tutor === 'codex.gpt-5.6-luna' &&
        request.design.models.analysis === 'codex.gpt-5.6-luna' &&
        request.design.models.learner === 'codex.gpt-5.6-luna' &&
        request.design.cliEffort === 'low' &&
        request.design.runSeed === 20260820,
      'the 3-prefix by plain/warm by A/B matched-action baseline remains frozen',
    );
    assertion(
      checks,
      'action-register-baseline-budget-binding',
      request.budget.dialogues === 12 &&
        request.budget.dialoguesPerBatch === 6 &&
        request.budget.maximumAttemptsPerDialogue === 39 &&
        request.budget.maximumAttemptsPerBatch === 234 &&
        request.budget.maximumPlannedModelAttempts === 468 &&
        request.budget.programmeLedgerBefore === programmeLedgerBefore &&
        request.budget.programmeLedgerAfterMaximum === programmeLedgerAfterMaximum &&
        request.budget.programmeCeiling === 1200 &&
        request.budget.retryOrResumeAuthority === 'bounded_technical_recovery',
      `two 234-cap batches remain below the cumulative ${programmeLedgerAfterMaximum}-of-1200 maximum`,
    );
    assertion(
      checks,
      'action-register-baseline-request-revision',
      (gate.requestRevision === undefined && gate.priorStoppedExecution === undefined) ||
        (isSuccessor && gate.priorStoppedExecution !== undefined),
      'the original request remains revision-compatible and only registered successor revisions may bind a stopped predecessor',
    );
    if (isSuccessor) {
      assertion(
        checks,
        'action-register-successor-stopped-exclusion-binding',
        JSON.stringify(
          canonicalJson({
            requestRevision: gate.requestRevision,
            ...gate.priorStoppedExecution,
          }),
        ) === JSON.stringify(canonicalJson(successor.stoppedExecution)),
        'the consumed request, stopped partial A, private archive, six traces, attempt accounting, and total exclusion remain exact',
      );
      validateFileBinding(
        checks,
        'action-register-successor-consumed-request-binding',
        gate.priorStoppedExecution.request,
      );
    }
    assertion(
      checks,
      'action-register-baseline-evidence-boundary',
      gate.v4RequestSha256 === '0c14c51ae8625e6f5db301c9328b8f3182a8dbcd0b6b5a9dd610db85064ee0ab' &&
        gate.v4ReportSha256 === '771076330d58ec8818182a1924e3ea8dd2c8e54bdc1c9f32a822e491f405b431' &&
        gate.v4PrivateArchiveCommit === 'e5eb71f22f0c36f6e286272caf5b041e71d8e2ba' &&
        gate.v4PrefixesConsumedAsFrozenInputsOnly === true &&
        gate.v4OutcomesPooled === false &&
        gate.interimInterpretationPermitted === false &&
        gate.outcomeSelectionPermitted === false &&
        gate.validUnitRerunsPermitted === false &&
        gate.matchedVersusMismatchedEfficacyTested === false &&
        gate.edgedRegisterEfficacyTested === false,
      'V4 contributes exact frozen inputs only and the baseline cannot become a broader efficacy claim',
    );
    const recovery = gate.recoveryBoundary;
    assertion(
      checks,
      'action-register-baseline-recovery-boundary',
      recovery.sameLaunchSource === true &&
        recovery.sameRegistrationPrefixBundleModelsSeedAndMeasurement === true &&
        recovery.missingOrFailedUnitsOnly === true &&
        recovery.rerunValidOutputs === false &&
        recovery.selectAmongOutcomes === false &&
        recovery.maximumAttemptsPerBatchUnchanged === 234 &&
        recovery.maximumCombinedAttemptsUnchanged === 468 &&
        recovery.programmeCeilingUnchanged === 1200,
      'technical recovery remains conditional on unused room and cannot rerun valid units or enlarge a ceiling',
    );
    assertion(
      checks,
      'action-register-baseline-measurement-binding',
      request.measurement.reportSchema === 'machinespirits.tutor-stub.resistance-action-register-baseline-report.v2' &&
        request.measurement.primaryOutcome ===
          'profile_specific_resistance_recovery_by_two_post_trigger_learner_turns' &&
        request.measurement.repeatEndpoint === 'same_treatment_repeat_stability' &&
        request.measurement.combinedTwelveCellAnalysisRequired === true &&
        request.measurement.analysisTraceSelection === 'exact_prebound_batch_result_traces_only' &&
        request.measurement.partialBatchAnalysisPermitted === false &&
        request.measurement.v4OutcomesExcluded === true,
      'the request binds recovery, repeat stability, and exact combined analysis without V4 pooling',
    );
    const exactLive = (command, repeat, destination) =>
      Array.isArray(command) &&
      command[0] === 'node' &&
      command[1] === 'scripts/run-tutor-stub-resistance-action-register-crossed.js' &&
      command.includes('--live-batch') &&
      commandArg(command, '--batch') === repeat &&
      commandArg(command, '--destination') === destination &&
      commandArg(command, '--registration') === request.bindings.registration.path &&
      commandArg(command, '--prefix-bundle') === request.bindings.prefixBundle.path &&
      commandArg(command, '--parallelism') === '3' &&
      commandArg(command, '--expected-source-commit') === request.source.launchCommit;
    assertion(
      checks,
      'action-register-baseline-live-commands',
      exactLive(liveA, 'A', request.destination.batchA.artifactRoot) &&
        exactLive(liveB, 'B', request.destination.batchB.artifactRoot) &&
        request.destination.batchA.artifactRoot !== request.destination.batchB.artifactRoot,
      'the two live commands are prebound to distinct A/B create-once roots and the same launch source',
    );
    const expectedRecovery = [request.destination.batchA.artifactRoot, request.destination.batchB.artifactRoot].map(
      (destination) => [
        'node',
        'scripts/run-tutor-stub-resistance-action-register-crossed.js',
        '--recover-batch',
        '--destination',
        destination,
        '--expected-source-commit',
        request.source.launchCommit,
        '--parallelism',
        '3',
      ],
    );
    assertion(
      checks,
      'action-register-baseline-recovery-commands',
      JSON.stringify(recoveryCommand) === JSON.stringify(expectedRecovery),
      'bounded recovery is prebound to the same A/B roots, source, and parallelism without widening either batch',
    );
    assertion(
      checks,
      'action-register-baseline-analysis-command',
      Array.isArray(analyzeCommand) &&
        analyzeCommand[0] === 'node' &&
        analyzeCommand[1] === 'scripts/analyze-tutor-stub-resistance-action-register-baseline.js' &&
        commandArg(analyzeCommand, '--batch-a') === request.destination.batchA.artifactRoot &&
        commandArg(analyzeCommand, '--batch-b') === request.destination.batchB.artifactRoot &&
        commandArg(analyzeCommand, '--registration') === request.bindings.registration.path &&
        commandArg(analyzeCommand, '--prefix-bundle') === request.bindings.prefixBundle.path &&
        commandArg(analyzeCommand, '--expected-source-commit') === request.source.launchCommit &&
        commandArg(analyzeCommand, '--out') === request.destination.combinedReport &&
        analyzeCommand.includes('--json'),
      'one combined analyzer refuses either partial batch and writes the registered report',
    );
  } else if (isFrameRefuserOpportunity) {
    const registered = readJson(rootPath(request.bindings.registration.path));
    const registrationVersion = registered.version ?? 1;
    const expectedProfiles = 'frame_refuser,frame_defiant';
    const analysisShell = analyzeCommand[2] || '';
    assertion(
      checks,
      'frame-refuser-opportunity-registration-semantics',
      (registrationVersion === 1 &&
        registered.measurement.controlObservation === 'frame_jurisdiction_dispute_with_content_bearing_true') ||
        (registrationVersion === 2 &&
          registered.measurement.controlObservation ===
            'frame_jurisdiction_dispute_with_contract_licensed_participation') ||
        (registrationVersion === 3 &&
          registered.measurement.observationSemantics === 'prospective_v3' &&
          registered.measurement.controlObservation ===
            'frame_jurisdiction_dispute_with_contract_licensed_participation' &&
          registered.measurement.refusalRule === 'explicit_withholding_without_contract_licensed_participation' &&
          registered.measurement.productiveParticipationPrecedesWithholding === true) ||
        (registrationVersion === 4 &&
          registered.measurement.observationSemantics === 'prospective_v4' &&
          registered.measurement.controlObservation ===
            'frame_jurisdiction_dispute_with_contract_licensed_participation' &&
          registered.measurement.refusalRule === 'explicit_withholding_without_contract_licensed_participation' &&
          registered.measurement.productiveParticipationPrecedesWithholding === true),
      `opportunity registration version ${registrationVersion} keeps its declared observer semantics`,
    );
    const v4 = registrationVersion === 4;
    const maximumAttemptsPerDialogue = v4 ? 39 : 48;
    const maximumPlannedModelAttempts = v4 ? 234 : 288;
    const requiredTurns = v4 ? 2 : 8;
    assertion(
      checks,
      'frame-refuser-opportunity-design-binding',
      request.design.profiles.join(',') === expectedProfiles &&
        request.design.dialogues === 6 &&
        request.design.runsPerProfile === 3 &&
        request.design.runSeed === 20260820 &&
        request.design.parallelism === 3 &&
        request.budget.dialogues === 6 &&
        request.budget.maximumAttemptsPerDialogue === maximumAttemptsPerDialogue &&
        request.budget.maximumPlannedModelAttempts === maximumPlannedModelAttempts &&
        (!v4 || (request.design.plannedRoleCallsPerDialogue === 13 && request.design.plannedRoleCallsTotal === 78)) &&
        request.budget.retryOrResumeAuthority === 'bounded_technical_recovery',
      v4
        ? 'two fresh three-run T1-T2 cohorts bind 78 planned role calls and the 234-reservation bounded-recovery ceiling'
        : 'two fresh three-run cohorts and the 288-attempt bounded-recovery ceiling remain frozen',
    );
    assertion(
      checks,
      'frame-refuser-opportunity-evidence-boundary',
      request.opportunityGate.priorArtifactsReused === false &&
        request.opportunityGate.priorResultRewritten === false &&
        request.opportunityGate.historicalEvidencePooled === false &&
        request.opportunityGate.tutorEfficacyTested === false &&
        request.opportunityGate.registerEfficacyTested === false &&
        request.opportunityGate.heldoutAxisReportSha256 === registered.preservation.heldoutAxisReportSha256,
      'the passed heldout instrument and prior negative result remain read-only while efficacy stays untested',
    );
    const recovery = request.opportunityGate.recoveryBoundary;
    assertion(
      checks,
      'frame-refuser-opportunity-bounded-recovery-authority',
      recovery.sameLaunchSource === true &&
        recovery.sameModelProviderRoute === true &&
        recovery.sameProfilesPoliciesSeedConfigurationAndMeasurement === true &&
        recovery.samePayloadAndDataScope === true &&
        recovery.freshNonOverwritingDestinationForRecoveredUnits === true &&
        recovery.rerunValidOutputs === false &&
        recovery.selectAmongOutcomes === false &&
        recovery.maximumTotalStudyAttemptsUnchanged === maximumPlannedModelAttempts,
      'technical recovery is limited to missing or failed units under the unchanged opportunity gate and ceiling',
    );
    assertion(
      checks,
      'frame-refuser-opportunity-measurement-binding',
      request.measurement.reportSchema === 'machinespirits.tutor-stub.frame-refuser-opportunity-gate.v1' &&
        request.measurement.targetProfile === 'frame_refuser' &&
        request.measurement.controlProfile === 'frame_defiant' &&
        request.measurement.mustShowByTurn === 2 &&
        request.measurement.requiredDistinctTargetPrefixes === 3 &&
        request.measurement.targetObservation === registered.measurement.targetObservation &&
        request.measurement.controlObservation === registered.measurement.controlObservation &&
        request.measurement.analysisTraceSelection === 'exact_profile_trace_files_only' &&
        request.measurement.analysisSelectorExcludesRunEvents === true &&
        request.measurement.frozenFiveAxisObserverChanged === false &&
        (registrationVersion === 1 ||
          (request.measurement.refusalRule === registered.measurement.refusalRule &&
            Array.isArray(request.measurement.controlParticipationForms) &&
            request.measurement.controlParticipationForms.join(',') ===
              registered.measurement.controlParticipationForms.join(',') &&
            (![3, 4].includes(registrationVersion) ||
              (request.measurement.observationSemantics === registered.measurement.observationSemantics &&
                request.measurement.jurisdictionRule === registered.measurement.jurisdictionRule &&
                request.measurement.productiveParticipationPrecedesWithholding ===
                  registered.measurement.productiveParticipationPrecedesWithholding)))) &&
        registered.gates.targetProfile === 'frame_refuser' &&
        registered.gates.controlProfile === 'frame_defiant' &&
        registered.gates.mustShowByTurn === 2 &&
        registered.gates.requiredDistinctTargetPrefixes === 3,
      'request-level target, control, refusal, trace-selection, and gate semantics match the selected registration',
    );
    if (registrationVersion === 3) {
      assertion(
        checks,
        'frame-refuser-opportunity-v3-repair-admission-binding',
        JSON.stringify(canonicalJson(request.repairAdmission)) ===
          JSON.stringify(canonicalJson(registered.repairAdmission)) &&
          request.repairAdmission.maxFullRepairsPer8Turns === 1 &&
          request.repairAdmission.modelCallBudgetPerDialogue === 48 &&
          request.repairAdmission.baseCalls === 25 &&
          request.repairAdmission.callsPerFullRepair === 2 &&
          request.repairAdmission.permittedRepairCalls === 2 &&
          request.repairAdmission.requiredTutorGuardReserve === 16 &&
          request.repairAdmission.worstCaseRequiredCalls === 43 &&
          request.repairAdmission.headroom === 5 &&
          request.repairAdmission.failBeforeUnadmittedRepairCall === true &&
          request.repairAdmission.invalidCandidateMayBePublished === false,
        'the request exactly binds the registered one-repair, 43-of-48 fail-before-call envelope',
      );
    } else if (registrationVersion === 4) {
      assertion(
        checks,
        'frame-refuser-opportunity-v4-repair-admission-binding',
        JSON.stringify(canonicalJson(request.repairAdmission)) ===
          JSON.stringify(canonicalJson(registered.repairAdmission)) &&
          request.repairAdmission.maxFullRepairsPerT1T2 === 1 &&
          request.repairAdmission.repairDecisionTurn === 2 &&
          request.repairAdmission.repairsAtTurn1 === 0 &&
          request.repairAdmission.modelCallBudgetPerDialogue === 39 &&
          request.repairAdmission.baseCalls === 7 &&
          request.repairAdmission.callsPerFullRepair === 2 &&
          request.repairAdmission.permittedRepairCalls === 2 &&
          request.repairAdmission.requiredTutorGuardReserve === 4 &&
          request.repairAdmission.plannedWorstCaseCalls === 13 &&
          request.repairAdmission.plannedRoleCallsTotal === 78 &&
          request.repairAdmission.transportRetryLimitPerPlannedCall === 2 &&
          request.repairAdmission.maximumReservationsPerPlannedCall === 3 &&
          request.repairAdmission.maximumModelAttemptReservationsPerDialogue === 39 &&
          request.repairAdmission.maximumModelAttemptReservationsTotal === 234 &&
          request.repairAdmission.technicalRetryHeadroomReservationsPerDialogue === 26 &&
          request.repairAdmission.reservationHeadroom === 0 &&
          request.repairAdmission.boundedRecoveryConditionalOnUnusedCeiling === true &&
          request.repairAdmission.failBeforeUnadmittedRepairCall === true &&
          request.repairAdmission.turn1QualificationRequired === false &&
          request.repairAdmission.nonqualifyingCandidateMayBePublishedAtT1 === true &&
          request.repairAdmission.invalidCandidateMayBePublishedAtOrAfterT2 === false,
        'the request binds one deferred T2 repair, 13 planned role calls, and the 39-per-dialogue/234-total retry-aware hard ceiling',
      );
    }
    const liveCommandOffset = registrationVersion >= 3 ? 2 : 0;
    const requiredSemantics = v4 ? 'prospective_v4' : 'prospective_v3';
    assertion(
      checks,
      'frame-refuser-opportunity-live-command-shape',
      (registrationVersion < 3 ||
        (liveCommand[0] === 'env' &&
          liveCommand[1] === `TUTOR_STUB_RESISTANT_LEARNER_OBSERVATION_SEMANTICS=${requiredSemantics}`)) &&
        liveCommand[liveCommandOffset] === 'node' &&
        liveCommand[liveCommandOffset + 1] === 'scripts/run-tutor-stub-qa-matrix.js' &&
        commandArg(liveCommand, '--profiles') === expectedProfiles &&
        commandArg(liveCommand, '--policies') === 'field' &&
        commandArg(liveCommand, '--runs') === '3' &&
        commandArg(liveCommand, '--run-seed') === '20260820' &&
        commandArg(liveCommand, '--turns') === String(requiredTurns) &&
        commandArg(liveCommand, '--safety-turns') === String(requiredTurns) &&
        commandArg(liveCommand, '--model-call-budget') === String(maximumAttemptsPerDialogue) &&
        commandArg(liveCommand, '--model') === request.design.models.tutor &&
        commandArg(liveCommand, '--analysis-model') === request.design.models.analysis &&
        commandArg(liveCommand, '--auto-learner-model') === request.design.models.learner &&
        commandArg(liveCommand, '--world') === request.design.world &&
        commandArg(liveCommand, '--dag-mode') === 'strict_dag' &&
        commandArg(liveCommand, '--register-palette') === 'safe' &&
        commandArg(liveCommand, '--register-overlay-threshold') === '0.7' &&
        commandArg(liveCommand, '--release-speed') === '1' &&
        commandArg(liveCommand, '--cli-effort') === request.design.cliEffort &&
        commandArg(liveCommand, '--history-turns') === '4' &&
        commandArg(liveCommand, '--max-tokens') === '4096' &&
        commandArg(liveCommand, '--parallelism') === '3' &&
        commandArg(liveCommand, '--trace-dir') === request.destination.artifactRoot &&
        liveCommand.includes('--no-html-report') &&
        liveCommand.includes('--no-memory-summary') &&
        liveCommand.includes('--no-analyze') &&
        !liveCommand.includes('--keep-going'),
      'the six-dialogue command preserves the registered opportunity-gate runtime',
    );
    assertion(
      checks,
      'frame-refuser-opportunity-analysis-command-shape',
      analyzeCommand.length === 3 &&
        analyzeCommand[0] === 'zsh' &&
        analyzeCommand[1] === '-lc' &&
        analysisShell.includes('/*/traces/*/*.jsonl') &&
        analysisShell.includes('trace_args+=(--trace "$trace")') &&
        analysisShell.includes('scripts/analyze-tutor-stub-resistance-axis-calibration.js') &&
        analysisShell.includes(`--registration ${request.bindings.registration.path}`) &&
        analysisShell.includes('--required-traces 6') &&
        analysisShell.includes(`--required-profiles ${expectedProfiles}`) &&
        analysisShell.includes('--required-runs-per-profile 3') &&
        analysisShell.includes(`--required-turns ${requiredTurns}`) &&
        analysisShell.includes('--required-policies field') &&
        analysisShell.includes(`--required-tutor-model ${request.design.models.tutor}`) &&
        analysisShell.includes(`--required-analysis-model ${request.design.models.analysis}`) &&
        analysisShell.includes(`--required-learner-model ${request.design.models.learner}`) &&
        analysisShell.includes(`--out "$artifact_root/frame-refuser-opportunity-gate.json"`),
      'the analysis selects the six exact profile traces and emits only the registered opportunity gate',
    );
  } else if (isAxisHeldout) {
    const registered = readJson(rootPath(request.bindings.registration.path));
    const expectedProfiles = 'diligent,low_agency,bored,skeptical,low_trust_skeptic,frame_defiant';
    const analysisShell = analyzeCommand[2] || '';
    assertion(
      checks,
      'axis-heldout-design-binding',
      request.design.profiles.join(',') === expectedProfiles &&
        request.design.dialogues === 18 &&
        request.design.runsPerProfile === 3 &&
        request.design.runSeed === 20260819 &&
        request.design.parallelism === 3 &&
        request.budget.dialogues === 18 &&
        request.budget.maximumAttemptsPerDialogue === 48 &&
        request.budget.maximumPlannedModelAttempts === 864 &&
        request.budget.retryOrResumeAuthority === 'bounded_technical_recovery',
      'six fresh three-run profile cohorts and the 864-attempt bounded-recovery ceiling remain frozen',
    );
    assertion(
      checks,
      'axis-heldout-evidence-boundary',
      request.axisHeldout.priorArtifactsReused === false &&
        request.axisHeldout.priorResultRewritten === false &&
        request.axisHeldout.historicalEvidencePooled === false &&
        request.axisHeldout.calibrationUsedForThresholdDesignOnly === true &&
        request.axisHeldout.registeredNegativeReportSha256 === registered.preservation.registeredNegativeReportSha256,
      'prior traces and negative results remain read-only, unpooled calibration inputs',
    );
    const recovery = request.axisHeldout.recoveryBoundary;
    assertion(
      checks,
      'axis-heldout-bounded-recovery-authority',
      recovery.sameLaunchSource === true &&
        recovery.sameModelProviderRoute === true &&
        recovery.sameProfilesPoliciesSeedConfigurationAndRubric === true &&
        recovery.samePayloadAndDataScope === true &&
        recovery.freshNonOverwritingDestinationForRecoveredUnits === true &&
        recovery.rerunValidOutputs === false &&
        recovery.selectAmongOutcomes === false &&
        recovery.maximumTotalStudyAttemptsUnchanged === 864,
      'technical recovery is limited to missing or failed units under the unchanged design and ceiling',
    );
    assertion(
      checks,
      'axis-heldout-measurement-binding',
      request.measurement.reportSchema === 'machinespirits.tutor-stub.resistance-axis-discrimination.v1' &&
        request.measurement.coPrimaryProfiles.join(',') === 'bored,frame_defiant' &&
        request.measurement.diagnosticProfiles.join(',') === 'low_agency,skeptical,low_trust_skeptic' &&
        request.measurement.epistemicTrustRole === 'descriptive_only_no_threshold_no_pass_contribution' &&
        registered.gates.profiles.bored.axis === 'effort_investment' &&
        registered.gates.profiles.bored.minimumObservedRate === 0.45 &&
        registered.gates.profiles.frame_defiant.axis === 'frame_legitimacy' &&
        registered.gates.profiles.frame_defiant.minimumObservedRate === 0.4 &&
        registered.gates.epistemicTrustRole === 'descriptive_only_no_threshold_no_pass_contribution',
      'bored effort and frame legitimacy are primary while low trust remains descriptive-only',
    );
    assertion(
      checks,
      'axis-heldout-live-command-shape',
      liveCommand[0] === 'node' &&
        liveCommand[1] === 'scripts/run-tutor-stub-qa-matrix.js' &&
        commandArg(liveCommand, '--profiles') === expectedProfiles &&
        commandArg(liveCommand, '--policies') === 'field' &&
        commandArg(liveCommand, '--runs') === '3' &&
        commandArg(liveCommand, '--run-seed') === '20260819' &&
        commandArg(liveCommand, '--turns') === '8' &&
        commandArg(liveCommand, '--safety-turns') === '8' &&
        commandArg(liveCommand, '--model-call-budget') === '48' &&
        commandArg(liveCommand, '--model') === request.design.models.tutor &&
        commandArg(liveCommand, '--analysis-model') === request.design.models.analysis &&
        commandArg(liveCommand, '--auto-learner-model') === request.design.models.learner &&
        commandArg(liveCommand, '--world') === request.design.world &&
        commandArg(liveCommand, '--dag-mode') === 'strict_dag' &&
        commandArg(liveCommand, '--register-palette') === 'safe' &&
        commandArg(liveCommand, '--register-overlay-threshold') === '0.7' &&
        commandArg(liveCommand, '--release-speed') === '1' &&
        commandArg(liveCommand, '--cli-effort') === request.design.cliEffort &&
        commandArg(liveCommand, '--history-turns') === '4' &&
        commandArg(liveCommand, '--max-tokens') === '4096' &&
        commandArg(liveCommand, '--parallelism') === '3' &&
        commandArg(liveCommand, '--trace-dir') === request.destination.artifactRoot &&
        liveCommand.includes('--no-html-report') &&
        liveCommand.includes('--no-memory-summary') &&
        liveCommand.includes('--no-analyze') &&
        !liveCommand.includes('--keep-going'),
      'the fresh 18-dialogue command preserves the registered axis-study runtime',
    );
    assertion(
      checks,
      'axis-heldout-analysis-command-shape',
      analyzeCommand.length === 3 &&
        analyzeCommand[0] === 'zsh' &&
        analyzeCommand[1] === '-lc' &&
        analysisShell.includes('/*/traces/*/*.jsonl') &&
        analysisShell.includes('trace_args+=(--trace "$trace")') &&
        analysisShell.includes('scripts/analyze-tutor-stub-resistance-axis-calibration.js') &&
        analysisShell.includes('--registration config/tutor-stub-resistance-axis-heldout-registration.v1.json') &&
        analysisShell.includes('--required-traces 18') &&
        analysisShell.includes(`--required-profiles ${expectedProfiles}`) &&
        analysisShell.includes('--required-runs-per-profile 3') &&
        analysisShell.includes('--required-turns 8') &&
        analysisShell.includes('--required-policies field') &&
        analysisShell.includes(`--required-tutor-model ${request.design.models.tutor}`) &&
        analysisShell.includes(`--required-analysis-model ${request.design.models.analysis}`) &&
        analysisShell.includes(`--required-learner-model ${request.design.models.learner}`) &&
        !analysisShell.includes('--require-pooled') &&
        !analysisShell.includes('target-average-cosine') &&
        !analysisShell.includes('nearest-neighbor') &&
        analysisShell.includes(`--out "$artifact_root/resistance-axis-discrimination.json"`),
      'the analysis selects exact dialogue traces and excludes the failed pooled and nearest-neighbour geometry',
    );
  } else if (isFreshMeasurementRecheck) {
    const registered = readJson(rootPath(request.bindings.registration.path));
    const expectedProfiles = 'diligent,low_agency,bored,skeptical,low_trust_skeptic,frame_defiant';
    const analysisShell = analyzeCommand[2] || '';
    const retryBoundaryValid = isTechnicalRecovery
      ? request.budget.retryOrResumeAuthority === 'bounded_technical_recovery'
      : request.budget.retryOrResumeAuthority === 'none';
    assertion(
      checks,
      'measurement-recheck-design-binding',
      request.design.profiles.join(',') === expectedProfiles &&
        request.design.dialogues === 18 &&
        request.design.runsPerProfile === 3 &&
        request.design.parallelism === 3 &&
        request.budget.dialogues === 18 &&
        request.budget.maximumAttemptsPerDialogue === 48 &&
        request.budget.maximumPlannedModelAttempts === 864 &&
        retryBoundaryValid,
      isTechnicalRecovery
        ? 'six fresh three-run profile cohorts and the 864-attempt bounded-recovery ceiling remain frozen'
        : 'six fresh three-run profile cohorts and the 864-attempt no-retry ceiling remain frozen',
    );
    assertion(
      checks,
      'measurement-recheck-boundary',
      request.recheck.priorArtifactsReused === false &&
        request.recheck.priorDialoguesResumed === false &&
        request.recheck.priorResultRewritten === false &&
        request.recheck.thresholdsChanged === false &&
        request.recheck.prospectiveExactTraceReplay.modelCalls === 0,
      'the new cohort neither reuses old traces nor rewrites the registered negative result or thresholds',
    );
    if (isTechnicalRecovery) {
      validateFileBinding(checks, 'measurement-recheck-recovery-prior-request-binding', {
        path: request.technicalRecovery.priorRequestPath,
        sha256: request.technicalRecovery.priorRequestSha256,
      });
      const dependency = request.technicalRecovery.dependencyPreparation;
      const excluded = request.technicalRecovery.excludedUnplannedSmoke;
      const recovery = request.technicalRecovery.recoveryBoundary;
      const sourceClosure = Object.fromEntries(request.source.closure.map((entry) => [entry.path, entry.sha256]));
      assertion(
        checks,
        'measurement-recheck-technical-recovery-basis',
        request.technicalRecovery.priorInvocation.outcome === 'technical_failure_before_model_call' &&
          request.technicalRecovery.priorInvocation.errorCode === 'ERR_MODULE_NOT_FOUND' &&
          request.technicalRecovery.priorInvocation.missingPackage === 'yaml' &&
          request.technicalRecovery.priorInvocation.completedModelCalls === 0 &&
          request.technicalRecovery.priorInvocation.reservedModelCalls === 0 &&
          request.technicalRecovery.priorInvocation.artifactDestinationCreated === false &&
          request.technicalRecovery.priorInvocation.reused === false &&
          request.technicalRecovery.priorInvocation.resumed === false,
        'the consumed request failed before any model call or requested artifact creation',
      );
      assertion(
        checks,
        'measurement-recheck-dependency-preparation',
        dependency.packageJsonSha256 === sourceClosure['package.json'] &&
          dependency.packageLockSha256 === sourceClosure['package-lock.json'] &&
          dependency.installedYamlVersion === '2.9.0' &&
          dependency.modelCalls === 0 &&
          dependency.productionWrites === 0,
        'the compatible dependency tree and safe zero-call module-load check are source-bound',
      );
      assertion(
        checks,
        'measurement-recheck-excluded-unplanned-smoke',
        excluded.profile === 'diligent' &&
          excluded.policies.join(',') === 'bland,dynamic,state,field,trajectory,dynamical_system' &&
          excluded.runSeed === 20260711 &&
          excluded.completedModelCalls === 29 &&
          excluded.interruptedReservations === 6 &&
          excluded.completedTrials === 0 &&
          excluded.artifactPreserved === true &&
          excluded.reused === false &&
          excluded.resumed === false &&
          excluded.analyzed === false &&
          excluded.eligibleForStudyAssembly === false,
        'the unplanned default-run artifacts are preserved but excluded from recovery and study assembly',
      );
      assertion(
        checks,
        'measurement-recheck-bounded-recovery-authority',
        recovery.sameLaunchSource === true &&
          recovery.sameModelProviderRoute === true &&
          recovery.sameProfilesPoliciesSeedConfigurationAndRubric === true &&
          recovery.samePayloadAndDataScope === true &&
          recovery.freshNonOverwritingDestination === true &&
          recovery.rerunValidOutputs === false &&
          recovery.selectAmongOutcomes === false &&
          recovery.maximumTotalStudyAttemptsUnchanged === 864,
        'technical recovery is limited to missing or failed units under the unchanged design and ceiling',
      );
    }
    validateFileBinding(checks, 'measurement-recheck-prior-request-binding', {
      path: request.recheck.priorRequestPath,
      sha256: request.recheck.priorRequestSha256,
    });
    const priorReport = request.recheck.priorCanonicalReport;
    if (fs.existsSync(bindingPath(priorReport))) {
      validateFileBinding(checks, 'measurement-recheck-prior-report-binding', priorReport);
    } else {
      assertion(
        checks,
        'measurement-recheck-prior-report-digest',
        /^[0-9a-f]{64}$/u.test(priorReport.sha256) && priorReport.result === 'failed_registered_co_primary_gate',
        'the machine-local canonical report is unavailable here; its negative result and digest remain frozen',
      );
    }
    assertion(
      checks,
      'measurement-recheck-instrument',
      request.measurement.reportSchema === 'machinespirits.tutor-stub.profile-discrimination.v4' &&
        request.measurement.behaviorVectorMarkers.join(',') ===
          'explicitRecollection,learnerAcceleration,boredWithholding,frameJurisdictionDispute' &&
        request.measurement.nearestNeighborAnchorMinimumSignatureTargetPassRate === 0.4 &&
        registered.gates.profiles.bored.minimumSignatureTargetPassRate === 0.4 &&
        registered.gates.profiles.frame_defiant.minimumSignatureTargetPassRate === 0.4 &&
        request.measurement.analysisTraceSelection === 'exact_profile_trace_files_only' &&
        request.measurement.analysisSelectorExcludesRunEvents === true,
      'analyzer v4, both resistant markers, and the unchanged 0.40 anchor floor remain explicit',
    );
    assertion(
      checks,
      'measurement-recheck-live-command-shape',
      liveCommand[0] === 'node' &&
        liveCommand[1] === 'scripts/run-tutor-stub-qa-matrix.js' &&
        commandArg(liveCommand, '--profiles') === expectedProfiles &&
        commandArg(liveCommand, '--policies') === 'field' &&
        commandArg(liveCommand, '--runs') === '3' &&
        commandArg(liveCommand, '--run-seed') === '20260818' &&
        commandArg(liveCommand, '--turns') === '8' &&
        commandArg(liveCommand, '--safety-turns') === '8' &&
        commandArg(liveCommand, '--model-call-budget') === '48' &&
        commandArg(liveCommand, '--model') === request.design.models.tutor &&
        commandArg(liveCommand, '--analysis-model') === request.design.models.analysis &&
        commandArg(liveCommand, '--auto-learner-model') === request.design.models.learner &&
        commandArg(liveCommand, '--world') === request.design.world &&
        commandArg(liveCommand, '--dag-mode') === 'strict_dag' &&
        commandArg(liveCommand, '--register-palette') === 'safe' &&
        commandArg(liveCommand, '--register-overlay-threshold') === '0.7' &&
        commandArg(liveCommand, '--release-speed') === '1' &&
        commandArg(liveCommand, '--cli-effort') === request.design.cliEffort &&
        commandArg(liveCommand, '--history-turns') === '4' &&
        commandArg(liveCommand, '--max-tokens') === '4096' &&
        commandArg(liveCommand, '--parallelism') === '3' &&
        commandArg(liveCommand, '--trace-dir') === request.destination.artifactRoot &&
        liveCommand.includes('--no-html-report') &&
        liveCommand.includes('--no-memory-summary') &&
        liveCommand.includes('--no-analyze') &&
        !liveCommand.includes('--keep-going'),
      'the fresh 18-dialogue command preserves the frozen runtime configuration',
    );
    assertion(
      checks,
      'measurement-recheck-analysis-command-shape',
      analyzeCommand.length === 3 &&
        analyzeCommand[0] === 'zsh' &&
        analyzeCommand[1] === '-lc' &&
        analysisShell.includes('/*/traces/*/*.jsonl') &&
        analysisShell.includes('trace_args+=(--trace "$trace")') &&
        !analysisShell.includes('--trace-root') &&
        analysisShell.includes('--required-traces 18') &&
        analysisShell.includes(`--required-profiles ${expectedProfiles}`) &&
        analysisShell.includes('--required-runs-per-profile 3') &&
        analysisShell.includes('--required-turns 8') &&
        analysisShell.includes('--required-policies field') &&
        analysisShell.includes(`--required-tutor-model ${request.design.models.tutor}`) &&
        analysisShell.includes(`--required-analysis-model ${request.design.models.analysis}`) &&
        analysisShell.includes(`--required-learner-model ${request.design.models.learner}`) &&
        analysisShell.includes('--require-pooled') &&
        analysisShell.includes(`--out "$artifact_root/profile-discrimination.json"`),
      'the analysis selects only exact dialogue traces and retains every registered assembly gate',
    );
  } else {
    assertion(
      checks,
      'design-binding',
      request.design.dialogues === hold.budget.dialogues &&
        request.design.parallelism === hold.budget.parallelism &&
        request.budget.maximumAttemptsPerDialogue === hold.budget.maximumAttemptsPerDialogue &&
        request.budget.maximumPlannedModelAttempts === hold.budget.maximumPlannedModelAttempts &&
        request.budget.retryOrResumeAuthority === 'none',
      '18 dialogues, parallelism 3, and the 864-attempt no-retry ceiling remain frozen',
    );
  }
  assertion(
    checks,
    'payload-boundary',
    request.payload.humanSubjectData === false &&
      request.payload.privateArchiveData === false &&
      request.payload.trainingReuseStatus === 'not_applicable',
    'only repository-authored automated-study material is in scope',
  );
  if (isActionRegisterAnalysisOnly) {
    assertion(
      checks,
      'fresh-destination',
      request.destination.combinedReportCreateOnce === true &&
        request.destination.mustNotExistBeforeAnalysis === true &&
        !fs.existsSync(rootPath(request.destination.combinedReport)),
      `${request.destination.combinedReport} does not exist`,
    );
  } else if (isActionRegisterBaseline) {
    const destinations = [request.destination.batchA, request.destination.batchB];
    assertion(
      checks,
      'fresh-destination',
      destinations.every(
        (destination) =>
          destination?.createOnce === true &&
          destination?.mustNotExistBeforeLaunch === true &&
          !fs.existsSync(rootPath(destination.artifactRoot)),
      ) &&
        request.destination.combinedReportCreateOnce === true &&
        !fs.existsSync(rootPath(request.destination.combinedReport)),
      `${destinations.map((row) => row.artifactRoot).join(' and ')} do not exist`,
    );
  } else if (isActionRegisterConfirmation) {
    const destinations = request.destination.batches;
    assertion(
      checks,
      'fresh-destination',
      Array.isArray(destinations) &&
        destinations.length === 9 &&
        new Set(destinations.map((destination) => destination?.artifactRoot)).size === 9 &&
        destinations.every(
          (destination) =>
            destination?.createOnce === true &&
            destination?.mustNotExistBeforeLaunch === true &&
            !fs.existsSync(rootPath(destination.artifactRoot)),
        ) &&
        request.destination.combinedReportCreateOnce === true &&
        request.destination.mustNotExistBeforeAnalysis === true &&
        !fs.existsSync(rootPath(request.destination.combinedReport)),
      'all nine confirmation roots and the combined report are fresh and absent',
    );
  } else {
    assertion(
      checks,
      'fresh-destination',
      request.destination.createOnce === true &&
        request.destination.mustNotExistBeforeLaunch === true &&
        !fs.existsSync(rootPath(request.destination.artifactRoot)),
      `${request.destination.artifactRoot} does not exist`,
    );
  }

  const requestSha256 = sha256File(requestPath);
  const recoveryAuthorityClause =
    isTechnicalRecovery || request.budget.retryOrResumeAuthority === 'bounded_technical_recovery'
      ? 'bounded technical recovery authority for missing or failed units only.'
      : 'no retry or resume authority.';
  const exactApprovalStatement = isActionRegisterConfirmation
    ? `I amend the resistance-action-register programme ceiling from 1,200 to 2,345 model attempts and approve ${path.relative(ROOT, requestPath)} at SHA-256 ${requestSha256} for one 36-dialogue Luna confirmation with 18 warm and 18 plain dialogues, a hard ceiling of 2,160 model attempts, one predeclared two-sided Fisher exact analysis, no interim analysis, no reuse or pooling of the 12 calibration dialogues, and bounded technical recovery authority for missing or failed units only within the unchanged 2,345-attempt programme ceiling.`
    : `I approve ${path.relative(ROOT, requestPath)} at SHA-256 ${requestSha256} for one ` +
      `${request.design.dialogues}-dialogue Luna ${isReplacement ? 'replacement study' : isActionRegisterAnalysisOnly ? 'sealed action/register baseline analysis' : isActionRegisterBaseline ? 'action/register baseline' : 'study'}, ` +
      `with a hard ceiling of ${request.budget.maximumPlannedModelAttempts} model attempts and ${recoveryAuthorityClause}`;

  return {
    schema: 'machinespirits.tutor-stub.resistant-profile-discrimination-study-go-request-report.v1',
    status: request.status,
    requestPath: path.relative(ROOT, requestPath),
    requestSha256,
    launchCommit: request.source.launchCommit,
    launchTree: request.source.launchTree,
    sourceCommitObjectAvailable: sourceAudit.available,
    packetValid: true,
    readyForExplicitHumanApproval: !isReplacement || priorArtifactsAvailable,
    priorArtifactsAvailable,
    explicitHumanApproval: false,
    modelCallsAuthorized: false,
    liveRunAuthorized: false,
    modelCalls: 0,
    productionWrites: 0,
    budget: request.budget,
    destination: request.destination,
    exactApprovalStatement,
    checks,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = validateTutorStubResistantProfileStudyGoRequest({ requestPath: args.request });
  process.stdout.write(args.json ? `${JSON.stringify(report, null, 2)}\n` : formatMarkdown(report));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
