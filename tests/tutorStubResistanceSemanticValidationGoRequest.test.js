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
const REGISTRATION_V3 = 'config/tutor-stub-resistance-semantic-adjudication-validation-registration.v3.json';
const INSTRUMENT_V3 = 'config/tutor-stub-resistance-semantic-adjudication-registration.v3.json';
const HELDOUT_V3 = 'config/tutor-stub-resistance-semantic-adjudication-heldout-corpus.v3.json';
const ENDPOINT_V3 = 'config/paid-study-endpoints/tutor-stub-resistance-semantic-adjudication-validation.v3.json';
const CERTIFICATE_V3 =
  'config/paid-study-endpoints/tutor-stub-resistance-semantic-adjudication-validation.v3.endpoint-go.json';
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
const CLOSURE_V3 = [
  'scripts/run-tutor-stub-resistance-semantic-validation.js',
  'scripts/analyze-tutor-stub-resistance-semantic-validation.js',
  'scripts/check-tutor-stub-resistant-profile-study-go-request.js',
  'scripts/package-tutor-stub-resistant-profile-study-go-request.js',
  'services/tutorStubResistanceSemanticValidationRuntime.js',
  'services/tutorStubResistanceSemanticValidationV3.js',
  'services/tutorStubResistanceSemanticRuntime.js',
  'services/tutorStubResistanceSemanticAdjudicationV3.js',
  'services/tutorStubResistanceSemanticAdjudicationV2.js',
  'services/tutorStubResistanceSemanticAdjudication.js',
  'services/tutorStubPromptTransport.js',
  'services/tutorStubCliPolicyRetry.js',
  'services/tutorStubArtifactArchive.js',
  'services/paidStudyEndpointPreflight.js',
  'services/cliProviderBridge.js',
  'services/evalConfigLoader.js',
  REGISTRATION_V3,
  INSTRUMENT_V3,
  'config/tutor-stub-resistance-semantic-adjudication-response.schema.v3.json',
  'config/tutor-stub-resistance-semantic-adjudication-development-evidence.v3.json',
  HELDOUT_V3,
  REGISTRATION_V2,
  INSTRUMENT_V2,
  HELDOUT_V2,
  'config/tutor-stub-resistance-semantic-adjudication-validation-study-go-request.v2.json',
  REGISTRATION,
  INSTRUMENT,
  'config/tutor-stub-resistance-semantic-adjudication-development-corpus.v1.json',
  HELDOUT,
  'config/tutor-stub-resistance-semantic-adjudication-validation-study-go-request.v1.json',
  ENDPOINT_V3,
  CERTIFICATE_V3,
  'config/providers.yaml',
  'package.json',
  'package-lock.json',
];
const V3_REQUEST = 'config/tutor-stub-resistance-semantic-adjudication-validation-study-go-request.v3.json';
const CLOSURE_V3_SUCCESSOR = [...CLOSURE_V3, V3_REQUEST];
const V3_SUCCESSOR_REQUEST =
  'config/tutor-stub-resistance-semantic-adjudication-validation-study-go-request.v3-successor.json';
const CLOSURE_V3_SECOND_SUCCESSOR = [...CLOSURE_V3_SUCCESSOR, V3_SUCCESSOR_REQUEST];
const STOPPED_V3_VALIDATION = {
  request: { path: V3_REQUEST, sha256: '940cd6582909ff2e193830f219b0dc1a7d36f279d3d8c2709ca108177aba5539' },
  disposition: 'consumed_stopped_wholly_excluded',
  source: {
    commit: '04bd7d5ebbd227b62e3f8cbede2ff15ec4a0e0c4',
    tree: '7da60b5a1c88373073d03a267654e402571bcd73',
  },
  destination: '.tutor-stub-auto-eval/resistance-semantic-adjudication-validation-v3-2026-08-21-a',
  planSha256: 'a4994193e2cb712551302a84a3015b42473ac66645ad432d7221694ac37eddde',
  localEvidence: {
    files: 4,
    bytes: 83931,
    inventorySha256: 'c73158e8c4e4dc8c4ddab4e82e93fa6d8dbe7af721c3399f4efa135e0954745e',
    artifacts: [
      {
        path: 'plan.json',
        status: 'plan',
        sha256: '0bbbbe137cba32253f5c2a6d2f0b585c37dcba491cad01f67e58b7dfb7c4e5e9',
      },
      {
        path: 'cases/sv3-3e8cd42b67a4d67bd1bb0004cc0338f2/checkpoint.json',
        status: 'sealed',
        sha256: 'a9b77ab99335b951f04758d8e54ad717c810987940f071b6c09ccc5f4fa7acff',
      },
      {
        path: 'cases/sv3-d34fc430c5374c7e30833d6b5df8d3eb/checkpoint.json',
        status: 'sealed',
        sha256: '3d2d8deb253cce0cf535bf299eb11b1a8cf606c3db30fb1ef71fe501dc5db39f',
      },
      {
        path: 'cases/sv3-ddf1d5cf7c4c04a94be25c73930d7f5e/checkpoint.json',
        status: 'judge_in_flight',
        sha256: 'ad550d590ad8deaf8957ca72d7e8223a441c72b204dde1f5f4eb5a5bebc915a8',
      },
    ],
  },
  privateArchive: {
    branch: 'codex/resistance-semantic-validation-v3-incomplete-archive',
    commit: 'e18190e61e4630968bfb5c5d5c7c226b9ce3f98e',
    tree: '07db6db788b19e3ab03c17c700cd6814337402c2',
    artifactPath: 'artifacts/tutor-stub-live/resistance-semantic-validation/940cd6582909ff2e-a4994193e2cb7125',
    files: 31,
    bytes: 183101,
    inventorySha256: 'eed7dc7f295df934d48cabc8a78ae8ed4989be075c53561216ba65f499f18145',
    manifestSha256: '32cefbf50b69c066d79d1e9664331a3df55dfd9796437a41fb5ea6cc3356d7be',
    manifestedTransitions: 30,
    status: 'running_stopped_before_seal',
  },
  accounting: {
    chargedReservations: 10,
    returnedResponses: 1,
    terminalTransportFailures: 8,
    dispatchedAmbiguous: 1,
    sealedCases: 2,
    judgeInFlightCases: 1,
    programmeLedgerAfter: 661,
  },
  goldJoined: false,
  recoveryRan: false,
  analyzerRan: false,
  resultProduced: false,
  reportProduced: false,
  sealProduced: false,
  sameSourceResumePermitted: false,
  recoveryPermitted: false,
  reusePermitted: false,
  poolingPermitted: false,
  outcomeSelectionPermitted: false,
  confirmationCreditPermitted: false,
};
const STOPPED_V3_SUCCESSOR_VALIDATION = {
  request: {
    path: V3_SUCCESSOR_REQUEST,
    sha256: 'bb3571a2971e1d3fc3d7dad9fa0e41715b3e2282d495aef6f5880fd04fd4b5da',
  },
  disposition: 'consumed_stopped_wholly_excluded',
  source: {
    commit: 'b39e82d872a9b1320a20bd9e58ae23e33e000a13',
    tree: '584d89016a0010ecb83783c005bb0e5f919b0914',
  },
  destination: '.tutor-stub-auto-eval/resistance-semantic-adjudication-validation-v3-2026-08-21-b',
  planSha256: '2f9ef9d889469da5ec6b4cbf3609d7a03b7855c9b4ff3b23be52cf7cd396b817',
  localEvidence: {
    files: 19,
    bytes: 420968,
    inventorySha256: 'f0c0cc3a58f720128d634cc48c4674e5179adee4bc6ad1a84faa1646132d5bd9',
    artifacts: [
      ['plan.json', 'plan', 'a8aeec3d7cdaae9c6cf3c06598f4aa831f639c7c49622f9132eaaaeb9769e74b'],
      [
        'cases/sv3-0846454abc11ce08d275b2f892bae842/checkpoint.json',
        'sealed',
        'd07339398b62722fbeeb5d06ea818dff673fbb7b7f4b651fc6fd9320323f1168',
      ],
      [
        'cases/sv3-1856062e7c569f5436091bf773524990/checkpoint.json',
        'sealed',
        '0e82d1d8cc01f0dbfab4975cb2ecec9de1101a9c7fe5c647db96a326191e3292',
      ],
      [
        'cases/sv3-33784137804c32208977669a6288f338/checkpoint.json',
        'sealed',
        '877e78f59065d700aa0098dfa9553fbd569517315b585d88ea31773ee8c1938f',
      ],
      [
        'cases/sv3-342e7a6727b7549c908f19502a43ca30/checkpoint.json',
        'sealed',
        'ca19516de8c61e02a07ded8845f333e4ae184822c31e12e3396098a75daee1d4',
      ],
      [
        'cases/sv3-3e8cd42b67a4d67bd1bb0004cc0338f2/checkpoint.json',
        'sealed',
        '2b435a8b3aaba8e01955a9578fbd76bb10690b527b08818e2e22422296d6aa3c',
      ],
      [
        'cases/sv3-446ea7ff1b853d91609b942cd7361064/checkpoint.json',
        'sealed',
        '6bd545a94f616bef55b1f51ee085a7a1e80b4e2544ff6910ab808106aecb42e9',
      ],
      [
        'cases/sv3-4873505e21825ee51b69481a071ed0d7/checkpoint.json',
        'sealed',
        'ce09ecf47aaf77545ec6c1bf976f54fbe9251b9949592db2026479f64742955e',
      ],
      [
        'cases/sv3-4c2db32139b2fcb0a22ef3a967eeddc9/checkpoint.json',
        'sealed',
        '36b832e0f3a85976b72b57254d4652635a6c53a22dd6e23d6549ced143d47791',
      ],
      [
        'cases/sv3-630037d2c2ac71afa73d1a7fe13ea1b1/checkpoint.json',
        'judge_in_flight',
        'b9722815d73bba30127142150eb75b4a8d380fb4bfd961c02bf56a4c73b7cb7a',
      ],
      [
        'cases/sv3-86fb1748771f7743d76d07ffdd9f6533/checkpoint.json',
        'sealed',
        '31c39c760ece2f41d75b4a09152cc65520a4131fc6a2e66f7fef073029ec4d4c',
      ],
      [
        'cases/sv3-9fad8e3a4f635f2c6c14f23216174712/checkpoint.json',
        'sealed',
        'cbd56b0f6c959deaae300ffa2c3b01abc2027ad807f66d8dd7bd80bcd823a7eb',
      ],
      [
        'cases/sv3-a059314a64d8f58efc25097b50de5a23/checkpoint.json',
        'sealed',
        'ec5a662ef454a88fd610f61cc2f21611bdd45926407f586eb3cdbc0dac803bbd',
      ],
      [
        'cases/sv3-b154dc89b6d7bb62d8e316a5b5dcc6a4/checkpoint.json',
        'sealed',
        '66c25787fd4b177e09b43e884835b453ff3a574c1e458fa0f9ee904437785255',
      ],
      [
        'cases/sv3-b3ebe28ac0a34f02aec2a9d8819e78d6/checkpoint.json',
        'sealed',
        'c9ac9234dbb1bb8e83a8dec25ce2e57eff2e0c6d3644f2955ed8e4b94e3e1ce7',
      ],
      [
        'cases/sv3-becd77dbbacd806515c0f612b74bd756/checkpoint.json',
        'sealed',
        '9f4ddea7358a1d63c50a376283cc81f8bf66fb67d823ef39aad1862419530402',
      ],
      [
        'cases/sv3-c25051c69f0c4c7b8c66e2c45685ee0a/checkpoint.json',
        'sealed',
        '24b80a8b6b6f0b95e17686cf9fdb976940c851b1e798f200587ba9b8876f9a2a',
      ],
      [
        'cases/sv3-d34fc430c5374c7e30833d6b5df8d3eb/checkpoint.json',
        'sealed',
        '4d0b421b0bd6769c585d0d6afbacc3d334d6bcec01236189cd8dbd0bef50dd88',
      ],
      [
        'cases/sv3-ddf1d5cf7c4c04a94be25c73930d7f5e/checkpoint.json',
        'sealed',
        '3df49cc20bd129f2803cebd410abbb741105ab5d8f0088b2903f234e3f953c32',
      ],
    ].map(([path, status, sha256]) => ({ path, status, sha256 })),
  },
  privateArchive: {
    branch: 'codex/resistance-semantic-validation-v3-successor-incomplete-archive',
    commit: '17365bcdb1c1a3c0baad585200ccacdcc0d5c1ff',
    tree: '2b556a59e05da040ba621bee3d94e925e0d080c5',
    baseCommit: '83450f09a69a8cf559fb4f17b2c4da6e769c430d',
    artifactPath: 'artifacts/tutor-stub-live/resistance-semantic-validation/bb3571a2971e1d3f-2f9ef9d889469da5',
    files: 141,
    bytes: 1370698,
    inventorySha256: 'ea84d3801bc10238dbfb80a1a3739f2a24814548f6687ff0bfcb941c864a1f84',
    manifestSha256: '81e8ce26d43ae6d218313e1b02d4ade684ed66001e44dd901eb450ae4185f507',
    manifestedTransitions: 140,
    status: 'running_stopped_before_seal',
  },
  accounting: {
    chargedReservations: 35,
    returnedResponses: 32,
    terminalTransportFailures: 2,
    dispatchedAmbiguous: 1,
    sealedCases: 17,
    judgeInFlightCases: 1,
    programmeLedgerAfter: 696,
  },
  failureEvidence: {
    judgeId: 'semantic_judge_b',
    provider: 'claude-code',
    model: 'sonnet-5',
    errorCode: 'CLI_PROVIDER_EXIT_FAILED',
    exitCode: 1,
    cases: ['sv3-a059314a64d8f58efc25097b50de5a23', 'sv3-d34fc430c5374c7e30833d6b5df8d3eb'],
  },
  ambiguousCase: {
    caseId: 'sv3-630037d2c2ac71afa73d1a7fe13ea1b1',
    judgeId: 'semantic_judge_a',
    attempt: 1,
    status: 'dispatched',
  },
  goldJoined: false,
  recoveryRan: false,
  analyzerRan: false,
  resultProduced: false,
  reportProduced: false,
  sealProduced: false,
  sameSourceResumePermitted: false,
  recoveryPermitted: false,
  reusePermitted: false,
  poolingPermitted: false,
  outcomeSelectionPermitted: false,
  confirmationCreditPermitted: false,
};
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

function buildRequestV3(requestRepoPath, suffix) {
  const request = buildRequestV2(requestRepoPath, suffix);
  const contract = JSON.parse(fs.readFileSync(path.join(ROOT, ENDPOINT_V3), 'utf8'));
  const certificate = JSON.parse(fs.readFileSync(path.join(ROOT, CERTIFICATE_V3), 'utf8'));
  const artifactRoot = `.tutor-stub-auto-eval/semantic-validation-v3-${suffix}`;
  const replaceRegistration = (command) =>
    command
      .map((value) => (value === REGISTRATION_V2 ? REGISTRATION_V3 : value))
      .map((value, index, values) => (values[index - 1] === '--destination' ? artifactRoot : value));
  const live = replaceRegistration(request.commands.live);
  const recovery = replaceRegistration(request.commands.recovery);
  const analyze = replaceRegistration(request.commands.analyze);
  request.studyId = contract.study_id;
  request.source.closure = CLOSURE_V3.map((repoPath) => ({ path: repoPath, sha256: fileSha256(repoPath) }));
  request.semanticAdjudicationValidation = {
    ...request.semanticAdjudicationValidation,
    type: 'prospective_resistance_semantic_adjudication_heldout_validation_v3',
    instrumentRegistration: { path: INSTRUMENT_V3, sha256: fileSha256(INSTRUMENT_V3) },
    heldoutCorpus: { path: HELDOUT_V3, sha256: fileSha256(HELDOUT_V3), cases: 80 },
    failedV2Validation: {
      request: {
        path: 'config/tutor-stub-resistance-semantic-adjudication-validation-study-go-request.v2.json',
        sha256: fileSha256('config/tutor-stub-resistance-semantic-adjudication-validation-study-go-request.v2.json'),
      },
      reportSha256: '11e868d18135e6df29230eab6f7912427917c0e0b55ea350f6cec4a2168fca11',
      privateArchive: {
        branch: 'codex/resistance-semantic-validation-v2-failed-archive',
        commit: 'a98b58732ae2f0b68180e3bbb8d0357cf2e4adfa',
      },
      chargedReservations: 160,
      returnedFirstAttempts: 160,
      programmeLedgerAfter: 651,
      rescored: false,
      normalized: false,
      reused: false,
      pooled: false,
      outcomeSelected: false,
    },
    claimBoundary:
      'heldout_semantic_instrument_v3_validation_only_failed_v1_v2_excluded_no_confirmation_outcome_or_warm_plain_efficacy_null_learning_transfer_human_or_cell_claim',
  };
  request.budget.programmeLedgerBefore = 651;
  request.budget.programmeLedgerAfterMaximum = 1131;
  request.bindings.registration = { path: REGISTRATION_V3, sha256: fileSha256(REGISTRATION_V3) };
  request.bindings.endpoint = {
    contractPath: ENDPOINT_V3,
    contractFileSha256: fileSha256(ENDPOINT_V3),
    contractCanonicalSha256: sha256(JSON.stringify(canonicalJson(contract))),
    certificatePath: CERTIFICATE_V3,
    certificateFileSha256: fileSha256(CERTIFICATE_V3),
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

function buildRequestV3Successor(requestRepoPath, suffix) {
  const request = buildRequestV3(requestRepoPath, suffix);
  request.source.closure = CLOSURE_V3_SUCCESSOR.map((repoPath) => ({
    path: repoPath,
    sha256: fileSha256(repoPath),
  }));
  request.semanticAdjudicationValidation.requestRevision = 2;
  request.semanticAdjudicationValidation.stoppedV3Validation = structuredClone(STOPPED_V3_VALIDATION);
  request.semanticAdjudicationValidation.claimBoundary =
    'heldout_semantic_instrument_v3_validation_only_failed_v1_v2_and_stopped_v3_excluded_no_confirmation_outcome_or_warm_plain_efficacy_null_learning_transfer_human_or_cell_claim';
  request.budget.programmeLedgerBefore = 661;
  request.budget.programmeLedgerAfterMaximum = 1141;
  return request;
}

function buildRequestV3SecondSuccessor(requestRepoPath, suffix) {
  const request = buildRequestV3Successor(requestRepoPath, suffix);
  request.source.closure = CLOSURE_V3_SECOND_SUCCESSOR.map((repoPath) => ({
    path: repoPath,
    sha256: fileSha256(repoPath),
  }));
  request.semanticAdjudicationValidation.requestRevision = 3;
  request.semanticAdjudicationValidation.stoppedV3SuccessorValidation = structuredClone(
    STOPPED_V3_SUCCESSOR_VALIDATION,
  );
  request.semanticAdjudicationValidation.claimBoundary =
    'heldout_semantic_instrument_v3_validation_only_failed_v1_v2_and_two_stopped_v3_runs_excluded_no_confirmation_outcome_or_warm_plain_efficacy_null_learning_transfer_human_or_cell_claim';
  request.budget.programmeLedgerBefore = 696;
  request.budget.programmeLedgerAfterMaximum = 1176;
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

test('future v3 GO packaging binds both failed validations and the 651-to-1131 validation-only ledger', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-validation-v3-go-request-'));
  const output = `.tutor-stub-auto-eval/.test-semantic-validation-v3-go-${process.pid}.json`;
  t.after(() => {
    fs.rmSync(temporary, { recursive: true, force: true });
    fs.rmSync(path.join(ROOT, output), { force: true });
  });
  const request = buildRequestV3(output, process.pid);
  fs.mkdirSync(path.dirname(path.join(ROOT, output)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, output), `${JSON.stringify(request, null, 2)}\n`);
  const report = validateTutorStubResistantProfileStudyGoRequest({ requestPath: path.join(ROOT, output) });
  assert.equal(report.packetValid, true);
  assert.equal(report.modelCalls, 0);
  assert.equal(report.productionWrites, 0);
  assert.equal(report.budget.programmeLedgerBefore, 651);
  assert.equal(report.budget.programmeLedgerAfterMaximum, 1131);
  fs.rmSync(path.join(ROOT, output));

  const templatePath = path.join(temporary, 'template.json');
  fs.writeFileSync(templatePath, templateText(request));
  const packaged = packageTutorStubResistantProfileStudyGoRequest({
    templatePath,
    launchCommit: request.source.launchCommit,
    outputPath: output,
  });
  assert.equal(packaged.sourceClosureFiles, CLOSURE_V3.length);
  assert.equal(packaged.isolatedReplay.nodeModulesPresent, false);
  assert.equal(packaged.isolatedReplay.packetValid, true);
  assert.equal(packaged.effects.modelCalls, 0);

  for (const mutate of [
    (value) => (value.semanticAdjudicationValidation.failedV1Validation.reused = true),
    (value) => (value.semanticAdjudicationValidation.failedV2Validation.normalized = true),
    (value) => (value.semanticAdjudicationValidation.failedV2Validation.privateArchive.commit = '0'.repeat(40)),
    (value) => (value.budget.programmeLedgerBefore = 491),
    (value) =>
      (value.source.closure = value.source.closure.filter(
        (row) => !row.path.endsWith('semantic-adjudication-heldout-corpus.v2.json'),
      )),
    (value) =>
      (value.source.closure = value.source.closure.filter(
        (row) => !row.path.endsWith('semantic-adjudication-development-evidence.v3.json'),
      )),
  ]) {
    const changed = structuredClone(request);
    mutate(changed);
    const invalidPath = path.join(temporary, `invalid-v3-${crypto.randomUUID()}.json`);
    fs.writeFileSync(invalidPath, `${JSON.stringify(changed, null, 2)}\n`);
    assert.throws(() => validateTutorStubResistantProfileStudyGoRequest({ requestPath: invalidPath }));
  }
});

test('future v3 successor packaging binds the stopped partial and the 661-to-1141 ledger', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-validation-v3-successor-go-request-'));
  const output = `.tutor-stub-auto-eval/.test-semantic-validation-v3-successor-go-${process.pid}.json`;
  t.after(() => {
    fs.rmSync(temporary, { recursive: true, force: true });
    fs.rmSync(path.join(ROOT, output), { force: true });
  });
  const request = buildRequestV3Successor(output, `${process.pid}-successor`);
  fs.mkdirSync(path.dirname(path.join(ROOT, output)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, output), `${JSON.stringify(request, null, 2)}\n`);
  const report = validateTutorStubResistantProfileStudyGoRequest({ requestPath: path.join(ROOT, output) });
  assert.equal(report.packetValid, true);
  assert.equal(report.modelCalls, 0);
  assert.equal(report.productionWrites, 0);
  assert.equal(report.budget.programmeLedgerBefore, 661);
  assert.equal(report.budget.programmeLedgerAfterMaximum, 1141);
  fs.rmSync(path.join(ROOT, output));

  const templatePath = path.join(temporary, 'template.json');
  fs.writeFileSync(templatePath, templateText(request));
  const packaged = packageTutorStubResistantProfileStudyGoRequest({
    templatePath,
    launchCommit: request.source.launchCommit,
    outputPath: output,
  });
  assert.equal(packaged.sourceClosureFiles, CLOSURE_V3_SUCCESSOR.length);
  assert.equal(packaged.isolatedReplay.nodeModulesPresent, false);
  assert.equal(packaged.isolatedReplay.packetValid, true);
  assert.equal(packaged.effects.modelCalls, 0);
  assert.deepEqual(fs.readFileSync(path.join(ROOT, output)), Buffer.from(`${JSON.stringify(request, null, 2)}\n`));

  for (const mutate of [
    (value) => (value.semanticAdjudicationValidation.requestRevision = 3),
    (value) => (value.semanticAdjudicationValidation.stoppedV3Validation.request.sha256 = '0'.repeat(64)),
    (value) => (value.semanticAdjudicationValidation.stoppedV3Validation.privateArchive.commit = '0'.repeat(40)),
    (value) => (value.semanticAdjudicationValidation.stoppedV3Validation.privateArchive.tree = '0'.repeat(40)),
    (value) =>
      (value.semanticAdjudicationValidation.stoppedV3Validation.privateArchive.inventorySha256 = '0'.repeat(64)),
    (value) =>
      (value.semanticAdjudicationValidation.stoppedV3Validation.localEvidence.artifacts[3].sha256 = '0'.repeat(64)),
    (value) => (value.semanticAdjudicationValidation.stoppedV3Validation.accounting.returnedResponses = 2),
    (value) => (value.semanticAdjudicationValidation.stoppedV3Validation.goldJoined = true),
    (value) => (value.semanticAdjudicationValidation.stoppedV3Validation.analyzerRan = true),
    (value) => (value.semanticAdjudicationValidation.stoppedV3Validation.sameSourceResumePermitted = true),
    (value) => (value.budget.programmeLedgerBefore = 651),
    (value) => (value.source.closure = value.source.closure.filter((row) => row.path !== V3_REQUEST)),
  ]) {
    const changed = structuredClone(request);
    mutate(changed);
    const invalidPath = path.join(temporary, `invalid-v3-successor-${crypto.randomUUID()}.json`);
    fs.writeFileSync(invalidPath, `${JSON.stringify(changed, null, 2)}\n`);
    assert.throws(() => validateTutorStubResistantProfileStudyGoRequest({ requestPath: invalidPath }));
  }
});

test('future v3 revision-3 packaging binds both stopped partials and the 696-to-1176 ledger', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-validation-v3-second-successor-go-request-'));
  const output = `.tutor-stub-auto-eval/.test-semantic-validation-v3-second-successor-go-${process.pid}.json`;
  t.after(() => {
    fs.rmSync(temporary, { recursive: true, force: true });
    fs.rmSync(path.join(ROOT, output), { force: true });
  });
  const request = buildRequestV3SecondSuccessor(output, `${process.pid}-second-successor`);
  fs.mkdirSync(path.dirname(path.join(ROOT, output)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, output), `${JSON.stringify(request, null, 2)}\n`);
  const report = validateTutorStubResistantProfileStudyGoRequest({ requestPath: path.join(ROOT, output) });
  assert.equal(report.packetValid, true);
  assert.equal(report.modelCalls, 0);
  assert.equal(report.productionWrites, 0);
  assert.equal(report.budget.programmeLedgerBefore, 696);
  assert.equal(report.budget.programmeLedgerAfterMaximum, 1176);
  fs.rmSync(path.join(ROOT, output));

  const templatePath = path.join(temporary, 'template.json');
  fs.writeFileSync(templatePath, templateText(request));
  const packaged = packageTutorStubResistantProfileStudyGoRequest({
    templatePath,
    launchCommit: request.source.launchCommit,
    outputPath: output,
  });
  assert.equal(packaged.sourceClosureFiles, CLOSURE_V3_SECOND_SUCCESSOR.length);
  assert.equal(packaged.isolatedReplay.nodeModulesPresent, false);
  assert.equal(packaged.isolatedReplay.packetValid, true);
  assert.equal(packaged.effects.modelCalls, 0);
  assert.deepEqual(fs.readFileSync(path.join(ROOT, output)), Buffer.from(`${JSON.stringify(request, null, 2)}\n`));

  for (const mutate of [
    (value) => (value.semanticAdjudicationValidation.requestRevision = 4),
    (value) => (value.semanticAdjudicationValidation.stoppedV3Validation.request.sha256 = '0'.repeat(64)),
    (value) => (value.semanticAdjudicationValidation.stoppedV3SuccessorValidation.request.sha256 = '0'.repeat(64)),
    (value) =>
      (value.semanticAdjudicationValidation.stoppedV3SuccessorValidation.privateArchive.commit = '0'.repeat(40)),
    (value) => (value.semanticAdjudicationValidation.stoppedV3SuccessorValidation.privateArchive.tree = '0'.repeat(40)),
    (value) =>
      (value.semanticAdjudicationValidation.stoppedV3SuccessorValidation.privateArchive.manifestSha256 = '0'.repeat(
        64,
      )),
    (value) =>
      (value.semanticAdjudicationValidation.stoppedV3SuccessorValidation.localEvidence.artifacts[18].sha256 =
        '0'.repeat(64)),
    (value) => (value.semanticAdjudicationValidation.stoppedV3SuccessorValidation.accounting.returnedResponses = 33),
    (value) => (value.semanticAdjudicationValidation.stoppedV3SuccessorValidation.goldJoined = true),
    (value) => (value.semanticAdjudicationValidation.stoppedV3SuccessorValidation.analyzerRan = true),
    (value) => (value.semanticAdjudicationValidation.stoppedV3SuccessorValidation.sameSourceResumePermitted = true),
    (value) => (value.budget.programmeLedgerBefore = 661),
    (value) => (value.source.closure = value.source.closure.filter((row) => row.path !== V3_SUCCESSOR_REQUEST)),
  ]) {
    const changed = structuredClone(request);
    mutate(changed);
    const invalidPath = path.join(temporary, `invalid-v3-second-successor-${crypto.randomUUID()}.json`);
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
