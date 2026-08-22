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

const RESISTANCE_SEMANTIC_VALIDATION_V1_CRITICAL_SOURCE_CLOSURE = Object.freeze([
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
  'config/tutor-stub-resistance-semantic-adjudication-validation-registration.v1.json',
  'config/tutor-stub-resistance-semantic-adjudication-registration.v1.json',
  'config/tutor-stub-resistance-semantic-adjudication-response.schema.v1.json',
  'config/tutor-stub-resistance-semantic-adjudication-development-corpus.v1.json',
  'config/tutor-stub-resistance-semantic-adjudication-heldout-corpus.v1.json',
  'config/paid-study-endpoints/tutor-stub-resistance-semantic-adjudication-validation.v1.json',
  'config/paid-study-endpoints/tutor-stub-resistance-semantic-adjudication-validation.v1.endpoint-go.json',
  'config/providers.yaml',
  'package.json',
  'package-lock.json',
]);

const RESISTANCE_SEMANTIC_VALIDATION_V2_CRITICAL_SOURCE_CLOSURE = Object.freeze([
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
  'config/tutor-stub-resistance-semantic-adjudication-validation-registration.v2.json',
  'config/tutor-stub-resistance-semantic-adjudication-registration.v2.json',
  'config/tutor-stub-resistance-semantic-adjudication-response.schema.v2.json',
  'config/tutor-stub-resistance-semantic-adjudication-development-evidence.v2.json',
  'config/tutor-stub-resistance-semantic-adjudication-development-corpus.v1.json',
  'config/tutor-stub-resistance-semantic-adjudication-heldout-corpus.v1.json',
  'config/tutor-stub-resistance-semantic-adjudication-validation-registration.v1.json',
  'config/tutor-stub-resistance-semantic-adjudication-registration.v1.json',
  'config/tutor-stub-resistance-semantic-adjudication-heldout-corpus.v2.json',
  'config/tutor-stub-resistance-semantic-adjudication-validation-study-go-request.v1.json',
  'config/paid-study-endpoints/tutor-stub-resistance-semantic-adjudication-validation.v2.json',
  'config/paid-study-endpoints/tutor-stub-resistance-semantic-adjudication-validation.v2.endpoint-go.json',
  'config/providers.yaml',
  'package.json',
  'package-lock.json',
]);

const RESISTANCE_SEMANTIC_VALIDATION_V3_CRITICAL_SOURCE_CLOSURE = Object.freeze([
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
  'config/tutor-stub-resistance-semantic-adjudication-validation-registration.v3.json',
  'config/tutor-stub-resistance-semantic-adjudication-registration.v3.json',
  'config/tutor-stub-resistance-semantic-adjudication-response.schema.v3.json',
  'config/tutor-stub-resistance-semantic-adjudication-development-evidence.v3.json',
  'config/tutor-stub-resistance-semantic-adjudication-heldout-corpus.v3.json',
  'config/tutor-stub-resistance-semantic-adjudication-validation-registration.v2.json',
  'config/tutor-stub-resistance-semantic-adjudication-registration.v2.json',
  'config/tutor-stub-resistance-semantic-adjudication-heldout-corpus.v2.json',
  'config/tutor-stub-resistance-semantic-adjudication-validation-study-go-request.v2.json',
  'config/tutor-stub-resistance-semantic-adjudication-validation-registration.v1.json',
  'config/tutor-stub-resistance-semantic-adjudication-registration.v1.json',
  'config/tutor-stub-resistance-semantic-adjudication-development-corpus.v1.json',
  'config/tutor-stub-resistance-semantic-adjudication-heldout-corpus.v1.json',
  'config/tutor-stub-resistance-semantic-adjudication-validation-study-go-request.v1.json',
  'config/paid-study-endpoints/tutor-stub-resistance-semantic-adjudication-validation.v3.json',
  'config/paid-study-endpoints/tutor-stub-resistance-semantic-adjudication-validation.v3.endpoint-go.json',
  'config/providers.yaml',
  'package.json',
  'package-lock.json',
]);

const RESISTANCE_SEMANTIC_VALIDATION_STOPPED_V3_REQUEST = Object.freeze({
  requestRevision: 2,
  request: Object.freeze({
    path: 'config/tutor-stub-resistance-semantic-adjudication-validation-study-go-request.v3.json',
    sha256: '940cd6582909ff2e193830f219b0dc1a7d36f279d3d8c2709ca108177aba5539',
  }),
  disposition: 'consumed_stopped_wholly_excluded',
  source: Object.freeze({
    commit: '04bd7d5ebbd227b62e3f8cbede2ff15ec4a0e0c4',
    tree: '7da60b5a1c88373073d03a267654e402571bcd73',
  }),
  destination: '.tutor-stub-auto-eval/resistance-semantic-adjudication-validation-v3-2026-08-21-a',
  planSha256: 'a4994193e2cb712551302a84a3015b42473ac66645ad432d7221694ac37eddde',
  localEvidence: Object.freeze({
    files: 4,
    bytes: 83931,
    inventorySha256: 'c73158e8c4e4dc8c4ddab4e82e93fa6d8dbe7af721c3399f4efa135e0954745e',
    artifacts: Object.freeze([
      Object.freeze({
        path: 'plan.json',
        status: 'plan',
        sha256: '0bbbbe137cba32253f5c2a6d2f0b585c37dcba491cad01f67e58b7dfb7c4e5e9',
      }),
      Object.freeze({
        path: 'cases/sv3-3e8cd42b67a4d67bd1bb0004cc0338f2/checkpoint.json',
        status: 'sealed',
        sha256: 'a9b77ab99335b951f04758d8e54ad717c810987940f071b6c09ccc5f4fa7acff',
      }),
      Object.freeze({
        path: 'cases/sv3-d34fc430c5374c7e30833d6b5df8d3eb/checkpoint.json',
        status: 'sealed',
        sha256: '3d2d8deb253cce0cf535bf299eb11b1a8cf606c3db30fb1ef71fe501dc5db39f',
      }),
      Object.freeze({
        path: 'cases/sv3-ddf1d5cf7c4c04a94be25c73930d7f5e/checkpoint.json',
        status: 'judge_in_flight',
        sha256: 'ad550d590ad8deaf8957ca72d7e8223a441c72b204dde1f5f4eb5a5bebc915a8',
      }),
    ]),
  }),
  privateArchive: Object.freeze({
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
  }),
  accounting: Object.freeze({
    chargedReservations: 10,
    returnedResponses: 1,
    terminalTransportFailures: 8,
    dispatchedAmbiguous: 1,
    sealedCases: 2,
    judgeInFlightCases: 1,
    programmeLedgerAfter: 661,
  }),
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
});

const RESISTANCE_SEMANTIC_VALIDATION_STOPPED_V3_SUCCESSOR_REQUEST = Object.freeze({
  requestRevision: 3,
  request: Object.freeze({
    path: 'config/tutor-stub-resistance-semantic-adjudication-validation-study-go-request.v3-successor.json',
    sha256: 'bb3571a2971e1d3fc3d7dad9fa0e41715b3e2282d495aef6f5880fd04fd4b5da',
  }),
  disposition: 'consumed_stopped_wholly_excluded',
  source: Object.freeze({
    commit: 'b39e82d872a9b1320a20bd9e58ae23e33e000a13',
    tree: '584d89016a0010ecb83783c005bb0e5f919b0914',
  }),
  destination: '.tutor-stub-auto-eval/resistance-semantic-adjudication-validation-v3-2026-08-21-b',
  planSha256: '2f9ef9d889469da5ec6b4cbf3609d7a03b7855c9b4ff3b23be52cf7cd396b817',
  localEvidence: Object.freeze({
    files: 19,
    bytes: 420968,
    inventorySha256: 'f0c0cc3a58f720128d634cc48c4674e5179adee4bc6ad1a84faa1646132d5bd9',
    artifacts: Object.freeze([
      Object.freeze({
        path: 'plan.json',
        status: 'plan',
        sha256: 'a8aeec3d7cdaae9c6cf3c06598f4aa831f639c7c49622f9132eaaaeb9769e74b',
      }),
      Object.freeze({
        path: 'cases/sv3-0846454abc11ce08d275b2f892bae842/checkpoint.json',
        status: 'sealed',
        sha256: 'd07339398b62722fbeeb5d06ea818dff673fbb7b7f4b651fc6fd9320323f1168',
      }),
      Object.freeze({
        path: 'cases/sv3-1856062e7c569f5436091bf773524990/checkpoint.json',
        status: 'sealed',
        sha256: '0e82d1d8cc01f0dbfab4975cb2ecec9de1101a9c7fe5c647db96a326191e3292',
      }),
      Object.freeze({
        path: 'cases/sv3-33784137804c32208977669a6288f338/checkpoint.json',
        status: 'sealed',
        sha256: '877e78f59065d700aa0098dfa9553fbd569517315b585d88ea31773ee8c1938f',
      }),
      Object.freeze({
        path: 'cases/sv3-342e7a6727b7549c908f19502a43ca30/checkpoint.json',
        status: 'sealed',
        sha256: 'ca19516de8c61e02a07ded8845f333e4ae184822c31e12e3396098a75daee1d4',
      }),
      Object.freeze({
        path: 'cases/sv3-3e8cd42b67a4d67bd1bb0004cc0338f2/checkpoint.json',
        status: 'sealed',
        sha256: '2b435a8b3aaba8e01955a9578fbd76bb10690b527b08818e2e22422296d6aa3c',
      }),
      Object.freeze({
        path: 'cases/sv3-446ea7ff1b853d91609b942cd7361064/checkpoint.json',
        status: 'sealed',
        sha256: '6bd545a94f616bef55b1f51ee085a7a1e80b4e2544ff6910ab808106aecb42e9',
      }),
      Object.freeze({
        path: 'cases/sv3-4873505e21825ee51b69481a071ed0d7/checkpoint.json',
        status: 'sealed',
        sha256: 'ce09ecf47aaf77545ec6c1bf976f54fbe9251b9949592db2026479f64742955e',
      }),
      Object.freeze({
        path: 'cases/sv3-4c2db32139b2fcb0a22ef3a967eeddc9/checkpoint.json',
        status: 'sealed',
        sha256: '36b832e0f3a85976b72b57254d4652635a6c53a22dd6e23d6549ced143d47791',
      }),
      Object.freeze({
        path: 'cases/sv3-630037d2c2ac71afa73d1a7fe13ea1b1/checkpoint.json',
        status: 'judge_in_flight',
        sha256: 'b9722815d73bba30127142150eb75b4a8d380fb4bfd961c02bf56a4c73b7cb7a',
      }),
      Object.freeze({
        path: 'cases/sv3-86fb1748771f7743d76d07ffdd9f6533/checkpoint.json',
        status: 'sealed',
        sha256: '31c39c760ece2f41d75b4a09152cc65520a4131fc6a2e66f7fef073029ec4d4c',
      }),
      Object.freeze({
        path: 'cases/sv3-9fad8e3a4f635f2c6c14f23216174712/checkpoint.json',
        status: 'sealed',
        sha256: 'cbd56b0f6c959deaae300ffa2c3b01abc2027ad807f66d8dd7bd80bcd823a7eb',
      }),
      Object.freeze({
        path: 'cases/sv3-a059314a64d8f58efc25097b50de5a23/checkpoint.json',
        status: 'sealed',
        sha256: 'ec5a662ef454a88fd610f61cc2f21611bdd45926407f586eb3cdbc0dac803bbd',
      }),
      Object.freeze({
        path: 'cases/sv3-b154dc89b6d7bb62d8e316a5b5dcc6a4/checkpoint.json',
        status: 'sealed',
        sha256: '66c25787fd4b177e09b43e884835b453ff3a574c1e458fa0f9ee904437785255',
      }),
      Object.freeze({
        path: 'cases/sv3-b3ebe28ac0a34f02aec2a9d8819e78d6/checkpoint.json',
        status: 'sealed',
        sha256: 'c9ac9234dbb1bb8e83a8dec25ce2e57eff2e0c6d3644f2955ed8e4b94e3e1ce7',
      }),
      Object.freeze({
        path: 'cases/sv3-becd77dbbacd806515c0f612b74bd756/checkpoint.json',
        status: 'sealed',
        sha256: '9f4ddea7358a1d63c50a376283cc81f8bf66fb67d823ef39aad1862419530402',
      }),
      Object.freeze({
        path: 'cases/sv3-c25051c69f0c4c7b8c66e2c45685ee0a/checkpoint.json',
        status: 'sealed',
        sha256: '24b80a8b6b6f0b95e17686cf9fdb976940c851b1e798f200587ba9b8876f9a2a',
      }),
      Object.freeze({
        path: 'cases/sv3-d34fc430c5374c7e30833d6b5df8d3eb/checkpoint.json',
        status: 'sealed',
        sha256: '4d0b421b0bd6769c585d0d6afbacc3d334d6bcec01236189cd8dbd0bef50dd88',
      }),
      Object.freeze({
        path: 'cases/sv3-ddf1d5cf7c4c04a94be25c73930d7f5e/checkpoint.json',
        status: 'sealed',
        sha256: '3df49cc20bd129f2803cebd410abbb741105ab5d8f0088b2903f234e3f953c32',
      }),
    ]),
  }),
  privateArchive: Object.freeze({
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
  }),
  accounting: Object.freeze({
    chargedReservations: 35,
    returnedResponses: 32,
    terminalTransportFailures: 2,
    dispatchedAmbiguous: 1,
    sealedCases: 17,
    judgeInFlightCases: 1,
    programmeLedgerAfter: 696,
  }),
  failureEvidence: Object.freeze({
    judgeId: 'semantic_judge_b',
    provider: 'claude-code',
    model: 'claude-sonnet-5',
    errorCode: 'CLI_PROVIDER_EXIT_FAILED',
    exitCode: 1,
    cases: Object.freeze(['sv3-a059314a64d8f58efc25097b50de5a23', 'sv3-d34fc430c5374c7e30833d6b5df8d3eb']),
  }),
  ambiguousCase: Object.freeze({
    caseId: 'sv3-630037d2c2ac71afa73d1a7fe13ea1b1',
    judgeId: 'semantic_judge_a',
    attempt: 1,
    status: 'dispatched',
  }),
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
});

const RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_V1_CRITICAL_SOURCE_CLOSURE = Object.freeze([
  'scripts/run-tutor-stub-resistance-recovery-semantic-validation.js',
  'scripts/analyze-tutor-stub-resistance-recovery-semantic-validation.js',
  'scripts/check-tutor-stub-resistant-profile-study-go-request.js',
  'scripts/package-tutor-stub-resistant-profile-study-go-request.js',
  'services/tutorStubResistanceRecoverySemanticValidationRuntime.js',
  'services/tutorStubResistanceRecoverySemanticValidation.js',
  'services/tutorStubResistanceRecoverySemanticAdjudication.js',
  'services/tutorStubPromptTransport.js',
  'services/tutorStubCliPolicyRetry.js',
  'services/tutorStubArtifactArchive.js',
  'services/paidStudyEndpointPreflight.js',
  'services/cliProviderBridge.js',
  'services/evalConfigLoader.js',
  'config/tutor-stub-resistance-recovery-semantic-validation-registration.v1.json',
  'config/tutor-stub-resistance-recovery-semantic-adjudication-registration.v1.json',
  'config/tutor-stub-resistance-recovery-semantic-response.schema.v1.json',
  'config/tutor-stub-resistance-recovery-semantic-development-corpus.v1.json',
  'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v1.json',
  'config/paid-study-endpoints/tutor-stub-resistance-recovery-semantic-validation.v1.json',
  'config/paid-study-endpoints/tutor-stub-resistance-recovery-semantic-validation.v1.endpoint-go.json',
  'config/providers.yaml',
  'package.json',
  'package-lock.json',
]);

const RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_V2_CRITICAL_SOURCE_CLOSURE = Object.freeze([
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
  'config/tutor-stub-resistance-recovery-semantic-validation-registration.v2.json',
  'config/tutor-stub-resistance-recovery-semantic-adjudication-registration.v2.json',
  'config/tutor-stub-resistance-recovery-semantic-response.schema.v2.json',
  'config/tutor-stub-resistance-recovery-semantic-development-corpus.v2.json',
  'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v2.json',
  'config/paid-study-endpoints/tutor-stub-resistance-recovery-semantic-validation.v2.json',
  'config/paid-study-endpoints/tutor-stub-resistance-recovery-semantic-validation.v2.endpoint-go.json',
  'config/providers.yaml',
  'package.json',
  'package-lock.json',
]);

const BOREDOM_ACTION_REGISTER_PROOF_DAG_V1_CRITICAL_SOURCE_CLOSURE = Object.freeze([
  'scripts/run-tutor-stub-boredom-action-register-proof-dag.js',
  'scripts/analyze-tutor-stub-boredom-action-register-proof-dag.js',
  ['scripts', 'tutor-' + 'stub.js'].join('/'),
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
]);

const BOREDOM_ACTION_REGISTER_PROOF_DAG_V2_CRITICAL_SOURCE_CLOSURE = Object.freeze([
  ...BOREDOM_ACTION_REGISTER_PROOF_DAG_V1_CRITICAL_SOURCE_CLOSURE,
  'services/resistantLearnerAxisObservation.js',
]);

const BOREDOM_ACTION_REGISTER_PROOF_DAG_V3_CRITICAL_SOURCE_CLOSURE = Object.freeze([
  ...BOREDOM_ACTION_REGISTER_PROOF_DAG_V2_CRITICAL_SOURCE_CLOSURE,
  'services/tutorStubBoredomSemanticAdjudication.js',
  'services/evalConfigLoader.js',
  'services/cliProviderBridge.js',
  'services/tutorStubPromptAudit.js',
  'services/tutorStubCliRequest.js',
  'tutor-core/services/unifiedAIProviderService.js',
  'config/tutor-stub-boredom-semantic-adjudication-heldout.v1.json',
]);

const BOREDOM_ACTION_REGISTER_PROOF_DAG_V4_CRITICAL_SOURCE_CLOSURE = Object.freeze([
  ...BOREDOM_ACTION_REGISTER_PROOF_DAG_V3_CRITICAL_SOURCE_CLOSURE,
  'services/tutorStubBoredomSemanticAdjudicationV3.js',
  'config/tutor-stub-boredom-semantic-adjudication-heldout.v4.json',
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

const BOREDOM_PROOF_DAG_STOPPED_V1_REQUEST = Object.freeze({
  requestRevision: 2,
  request: Object.freeze({
    path: 'config/tutor-stub-boredom-action-register-proof-dag-study-go-request.v1.json',
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

const BOREDOM_PROOF_DAG_STOPPED_V2_REQUEST = Object.freeze({
  requestRevision: 3,
  request: Object.freeze({
    path: 'config/tutor-stub-boredom-action-register-proof-dag-study-go-request.v2.json',
    sha256: '476db5ea5d2bdb9a3bc9a1d3df5b0c5e0d3a641cbd1883129e4fe0f583037310',
  }),
  predecessorRequest: Object.freeze({
    path: 'config/tutor-stub-boredom-action-register-proof-dag-study-go-request.v1.json',
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

const BOREDOM_PROOF_DAG_STOPPED_V3_REQUEST = Object.freeze({
  ...BOREDOM_PROOF_DAG_STOPPED_V2_REQUEST,
  requestRevision: 4,
});

const BOREDOM_PROOF_DAG_STOPPED_V4_REQUEST = Object.freeze({
  ...BOREDOM_PROOF_DAG_STOPPED_V2_REQUEST,
  requestRevision: 5,
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
  const requestRepoPath = path.relative(ROOT, fs.realpathSync(requestPath));
  const checks = [];
  const isFrameRefuserOpportunity = request.opportunityGate?.type === 'prospective_frame_refuser_treatment_opportunity';
  const isActionRegisterBaseline =
    request.actionRegisterBaseline?.type === 'prospective_frame_refuser_action_register_baseline_v2';
  const isActionRegisterAnalysisOnly =
    request.actionRegisterBaselineAnalysis?.type === 'sealed_frame_refuser_action_register_baseline_analysis_only_v1';
  const isActionRegisterConfirmation = [
    'prospective_frame_refuser_warm_plain_confirmation_v1',
    'prospective_frame_refuser_warm_plain_confirmation_v2',
    'prospective_frame_refuser_warm_plain_confirmation_v3',
    'prospective_frame_refuser_warm_plain_confirmation_v4',
    'prospective_frame_refuser_warm_plain_confirmation_v5',
  ].includes(request.actionRegisterConfirmation?.type);
  const isActionRegisterConfirmationV2 =
    request.actionRegisterConfirmation?.type === 'prospective_frame_refuser_warm_plain_confirmation_v2';
  const isActionRegisterConfirmationV3 =
    request.actionRegisterConfirmation?.type === 'prospective_frame_refuser_warm_plain_confirmation_v3';
  const isActionRegisterConfirmationV4 =
    request.actionRegisterConfirmation?.type === 'prospective_frame_refuser_warm_plain_confirmation_v4';
  const isActionRegisterConfirmationV5 =
    request.actionRegisterConfirmation?.type === 'prospective_frame_refuser_warm_plain_confirmation_v5';
  const isActionRegisterConfirmationSuccessor =
    isActionRegisterConfirmationV2 ||
    isActionRegisterConfirmationV3 ||
    isActionRegisterConfirmationV4 ||
    isActionRegisterConfirmationV5;
  const isBoredomActionRegisterProofDag =
    request.boredomActionRegisterProofDag?.type ===
    'prospective_boredom_matched_action_warm_plain_proof_dag_confirmation_v1';
  const isBoredomActionRegisterProofDagV2 =
    isBoredomActionRegisterProofDag && request.boredomActionRegisterProofDag?.requestRevision === 3;
  const isResistanceSemanticValidation = [
    'prospective_resistance_semantic_adjudication_heldout_validation_v1',
    'prospective_resistance_semantic_adjudication_heldout_validation_v2',
    'prospective_resistance_semantic_adjudication_heldout_validation_v3',
  ].includes(request.semanticAdjudicationValidation?.type);
  const isResistanceSemanticValidationV2 =
    request.semanticAdjudicationValidation?.type ===
    'prospective_resistance_semantic_adjudication_heldout_validation_v2';
  const isResistanceSemanticValidationV3 =
    request.semanticAdjudicationValidation?.type ===
    'prospective_resistance_semantic_adjudication_heldout_validation_v3';
  const isResistanceSemanticValidationV3Successor =
    isResistanceSemanticValidationV3 &&
    [
      RESISTANCE_SEMANTIC_VALIDATION_STOPPED_V3_REQUEST.requestRevision,
      RESISTANCE_SEMANTIC_VALIDATION_STOPPED_V3_SUCCESSOR_REQUEST.requestRevision,
    ].includes(request.semanticAdjudicationValidation?.requestRevision);
  const isResistanceSemanticValidationV3SecondSuccessor =
    isResistanceSemanticValidationV3 &&
    request.semanticAdjudicationValidation?.requestRevision ===
      RESISTANCE_SEMANTIC_VALIDATION_STOPPED_V3_SUCCESSOR_REQUEST.requestRevision;
  const resistanceSemanticValidationProgrammeLedgerBefore = isResistanceSemanticValidationV3SecondSuccessor
    ? 696
    : isResistanceSemanticValidationV3Successor
      ? 661
      : isResistanceSemanticValidationV3
        ? 651
        : isResistanceSemanticValidationV2
          ? 491
          : 331;
  const resistanceSemanticValidationProgrammeLedgerAfterMaximum = isResistanceSemanticValidationV3SecondSuccessor
    ? 1176
    : isResistanceSemanticValidationV3Successor
      ? 1141
      : isResistanceSemanticValidationV3
        ? 1131
        : isResistanceSemanticValidationV2
          ? 971
          : 811;
  const resistanceSemanticValidationVersion = isResistanceSemanticValidationV3
    ? 3
    : isResistanceSemanticValidationV2
      ? 2
      : 1;
  const isResistanceRecoverySemanticValidation = [
    'prospective_resistance_recovery_semantic_adjudication_heldout_validation_v1',
    'prospective_resistance_recovery_semantic_adjudication_heldout_validation_v2',
  ].includes(request.semanticAdjudicationValidation?.type);
  const isResistanceRecoverySemanticValidationV2 =
    request.semanticAdjudicationValidation?.type ===
    'prospective_resistance_recovery_semantic_adjudication_heldout_validation_v2';
  const isAnyResistanceSemanticValidation = isResistanceSemanticValidation || isResistanceRecoverySemanticValidation;
  const isBoredomActionRegisterProofDagV3 =
    isBoredomActionRegisterProofDag && request.boredomActionRegisterProofDag?.requestRevision === 4;
  const isBoredomActionRegisterProofDagV4 =
    isBoredomActionRegisterProofDag && request.boredomActionRegisterProofDag?.requestRevision === 5;
  const isBoredomActionRegisterProofDagCurrent =
    isBoredomActionRegisterProofDagV2 || isBoredomActionRegisterProofDagV3 || isBoredomActionRegisterProofDagV4;

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
  if (isActionRegisterConfirmationSuccessor) {
    assertion(
      checks,
      'action-register-confirmation-successor-standing-authority-boundary',
      request.authorization.standingAuthorizationAttachmentSha256 ===
        (isActionRegisterConfirmationV5
          ? '538aa73239072ea618e2c8308edf562f1dd7495b78574e35a3db2f549302c1ce'
          : '4ef020fa2c59d6f7e215029374d7d5adaabc5f620fe1cbd5369020a34e88e08b') &&
        request.authorization.programmeCeilingAmendmentAuthorized === false,
      'the successor must bind the recorded standing authority and must not pre-authorize its ceiling amendment',
    );
  }
  if (isAnyResistanceSemanticValidation) {
    assertion(
      checks,
      'semantic-validation-standing-authority-boundary',
      request.authorization.standingArchitecturalCorrectionSha256 ===
        'dae9091d4f2584d416d7765e66d47acba03a33264886a6fa0a1eba45857c05f4' &&
        request.authorization.priorStandingAuthoritySha256 ===
          '538aa73239072ea618e2c8308edf562f1dd7495b78574e35a3db2f549302c1ce',
      'the validation request binds both the architectural correction and prior standing programme authority',
    );
  }
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
    isActionRegisterConfirmation ||
    isBoredomActionRegisterProofDag ||
    isAnyResistanceSemanticValidation
  ) {
    assertion(
      checks,
      'frame-refuser-opportunity-source-closure',
      Array.isArray(sourceClosure) && sourceClosure.length > 0,
      'the opportunity request must bind a non-empty critical executable source closure',
    );
    const closurePaths = sourceClosure.map((entry) => entry?.path);
    const registrationVersion = readJson(bindingPath(request.bindings.registration)).version ?? 1;
    const baseRequiredCriticalSourceClosure = isResistanceRecoverySemanticValidation
      ? isResistanceRecoverySemanticValidationV2
        ? RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_V2_CRITICAL_SOURCE_CLOSURE
        : RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_V1_CRITICAL_SOURCE_CLOSURE
      : isResistanceSemanticValidation
        ? isResistanceSemanticValidationV3
          ? RESISTANCE_SEMANTIC_VALIDATION_V3_CRITICAL_SOURCE_CLOSURE
          : isResistanceSemanticValidationV2
            ? RESISTANCE_SEMANTIC_VALIDATION_V2_CRITICAL_SOURCE_CLOSURE
            : RESISTANCE_SEMANTIC_VALIDATION_V1_CRITICAL_SOURCE_CLOSURE
        : isBoredomActionRegisterProofDag
          ? isBoredomActionRegisterProofDagV4
            ? BOREDOM_ACTION_REGISTER_PROOF_DAG_V4_CRITICAL_SOURCE_CLOSURE
            : isBoredomActionRegisterProofDagV3
              ? BOREDOM_ACTION_REGISTER_PROOF_DAG_V3_CRITICAL_SOURCE_CLOSURE
              : isBoredomActionRegisterProofDagV2
                ? BOREDOM_ACTION_REGISTER_PROOF_DAG_V2_CRITICAL_SOURCE_CLOSURE
                : BOREDOM_ACTION_REGISTER_PROOF_DAG_V1_CRITICAL_SOURCE_CLOSURE
          : isActionRegisterConfirmation
            ? RESISTANCE_ACTION_REGISTER_CONFIRMATION_V1_CRITICAL_SOURCE_CLOSURE
            : isActionRegisterBaseline || isActionRegisterAnalysisOnly
              ? RESISTANCE_ACTION_REGISTER_BASELINE_V2_CRITICAL_SOURCE_CLOSURE
              : registrationVersion === 4
                ? FRAME_REFUSER_OPPORTUNITY_V4_CRITICAL_SOURCE_CLOSURE
                : FRAME_REFUSER_OPPORTUNITY_CRITICAL_SOURCE_CLOSURE;
    const requiredCriticalSourceClosure = isResistanceSemanticValidationV3SecondSuccessor
      ? [
          ...baseRequiredCriticalSourceClosure,
          RESISTANCE_SEMANTIC_VALIDATION_STOPPED_V3_REQUEST.request.path,
          RESISTANCE_SEMANTIC_VALIDATION_STOPPED_V3_SUCCESSOR_REQUEST.request.path,
        ]
      : isResistanceSemanticValidationV3Successor
        ? [...baseRequiredCriticalSourceClosure, RESISTANCE_SEMANTIC_VALIDATION_STOPPED_V3_REQUEST.request.path]
        : baseRequiredCriticalSourceClosure;
    assertion(
      checks,
      'frame-refuser-opportunity-critical-source-closure',
      new Set(closurePaths).size === closurePaths.length &&
        requiredCriticalSourceClosure.every((entry) => closurePaths.includes(entry)),
      isAnyResistanceSemanticValidation
        ? 'semantic validation executor, analyzer, dual-judge instrument, frozen heldout, checkpoint/archive runtime, validator, route configuration, and dependencies remain bound'
        : isBoredomActionRegisterProofDag
          ? 'boredom proof-DAG executor, blocked analyzer, dynamic trigger runtime, retry metering, validator, six worlds, route, and dependency files remain bound'
          : isActionRegisterConfirmation
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
    isActionRegisterConfirmation ||
    isBoredomActionRegisterProofDag ||
    isAnyResistanceSemanticValidation
  ) {
    const contract = readJson(rootPath(endpoint.contractPath));
    const certificate = readJson(rootPath(endpoint.certificatePath));
    const endpointRegistration = readJson(rootPath(request.bindings.registration.path));
    const expectedEndpointCases = isResistanceRecoverySemanticValidation
      ? 120
      : isResistanceSemanticValidation
        ? 80
        : isActionRegisterConfirmation || isBoredomActionRegisterProofDag
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
    if (isResistanceRecoverySemanticValidation) {
      const endpointIds = contract.endpoints?.map((row) => row.id) || [];
      assertion(
        checks,
        'resistance-recovery-semantic-validation-endpoint-readiness-binding',
        endpointRegistration.version === (isResistanceRecoverySemanticValidationV2 ? 2 : 1) &&
          contract.runner?.live_executor === 'scripts/run-tutor-stub-resistance-recovery-semantic-validation.js' &&
          contract.runner?.combined_analyzer ===
            'scripts/analyze-tutor-stub-resistance-recovery-semantic-validation.js' &&
          contract.runner?.attempt_contract?.planned_model_calls === 240 &&
          contract.runner?.attempt_contract?.hard_validation_reservations === 720 &&
          contract.runner?.attempt_contract?.programme_maximum_after_both_validations ===
            (isResistanceRecoverySemanticValidationV2 ? 1691 : 1531) &&
          contract.runner?.attempt_contract?.programme_ceiling === 5000 &&
          contract.runner?.attempt_contract?.preserved_valid_judge_recalled === false &&
          contract.runner?.attempt_contract?.never_prepared_peer_may_complete === true &&
          contract.runner?.attempt_contract?.dispatched_without_response_recalled === false &&
          contract.runner?.attempt_contract?.durable_private_archive_required === true &&
          contract.runner?.attempt_contract?.outcome_selection === false &&
          [
            'synthetic_fixture_full_vector_metric_wiring',
            'synthetic_schema_span_source_ownership_wiring',
            'synthetic_interjudge_full_vector_wiring',
            'synthetic_four_stratum_coverage_wiring',
          ].every((id) => endpointIds.includes(id)),
        'the 120-case outcome validation endpoint binds blinded full-vector judging and the 720-attempt ceiling',
      );
    } else if (isResistanceSemanticValidation) {
      const endpointIds = contract.endpoints?.map((row) => row.id) || [];
      assertion(
        checks,
        'resistance-semantic-validation-endpoint-readiness-binding',
        endpointRegistration.version === resistanceSemanticValidationVersion &&
          contract.runner?.live_executor === 'scripts/run-tutor-stub-resistance-semantic-validation.js' &&
          contract.runner?.combined_analyzer === 'scripts/analyze-tutor-stub-resistance-semantic-validation.js' &&
          contract.runner?.attempt_contract?.planned_model_calls === 160 &&
          contract.runner?.attempt_contract?.maximum_reservations_per_planned_call === 3 &&
          contract.runner?.attempt_contract?.hard_validation_reservations === 480 &&
          contract.runner?.attempt_contract?.programme_ledger_before ===
            (isResistanceSemanticValidationV3 ? 651 : isResistanceSemanticValidationV2 ? 491 : 331) &&
          contract.runner?.attempt_contract?.programme_ledger_after_maximum ===
            (isResistanceSemanticValidationV3 ? 1131 : isResistanceSemanticValidationV2 ? 971 : 811) &&
          contract.runner?.attempt_contract?.programme_ceiling === 5000 &&
          contract.runner?.attempt_contract?.partial_case_rerun === false &&
          contract.runner?.attempt_contract?.technical_recovery === 'predeclared_never_dispatched_missing_judge_only' &&
          contract.runner?.attempt_contract?.preserved_valid_judge_recalled === false &&
          contract.runner?.attempt_contract?.never_prepared_peer_may_complete === true &&
          contract.runner?.attempt_contract?.prepared_not_dispatched_may_dispatch_once === true &&
          contract.runner?.attempt_contract?.dispatched_without_response_recalled === false &&
          contract.runner?.attempt_contract?.terminal_artifact_publication ===
            'byte_identical_idempotent_archive_reconciliation_only' &&
          contract.runner?.attempt_contract?.durable_private_archive_required === true &&
          contract.runner?.attempt_contract?.outcome_selection === false &&
          [
            'synthetic_fixture_metric_pipeline_wiring',
            isResistanceSemanticValidationV2 || isResistanceSemanticValidationV3
              ? 'synthetic_quote_normalization_provenance_wiring'
              : 'synthetic_schema_span_provenance_wiring',
            'synthetic_interjudge_metric_wiring',
            'synthetic_coverage_metric_wiring',
          ].every((id) => endpointIds.includes(id)),
        'the 80-case validation endpoint binds blinded dual judging, checkpointed no-recall execution, and the 480-attempt ceiling',
      );
    } else if (isBoredomActionRegisterProofDag) {
      const endpointIds = contract.endpoints?.map((row) => row.id) || [];
      assertion(
        checks,
        'boredom-action-register-proof-dag-endpoint-readiness-binding',
        endpointRegistration.version ===
          (isBoredomActionRegisterProofDagV4
            ? 4
            : isBoredomActionRegisterProofDagV3
              ? 3
              : isBoredomActionRegisterProofDagV2
                ? 2
                : 1) &&
          (!isBoredomActionRegisterProofDagV4 ||
            (contract.runner?.batch_contract?.programme_ledger_before === 446 &&
              contract.runner?.batch_contract?.combined_maximum_with_both_confirmations === 4766)) &&
          contract.runner?.live_batch_executor ===
            'scripts/run-tutor-stub-boredom-action-register-proof-dag.js#runTutorStubBoredomProofDagBatch' &&
          contract.runner?.live_batch_recovery_executor ===
            'scripts/run-tutor-stub-boredom-action-register-proof-dag.js#recoverTutorStubBoredomProofDagBatch' &&
          contract.runner?.combined_analyzer ===
            'scripts/analyze-tutor-stub-boredom-action-register-proof-dag.js#analyzeTutorStubBoredomProofDag' &&
          contract.runner?.batch_contract?.required_batches?.length === 9 &&
          contract.runner?.batch_contract?.dialogues_per_batch === 4 &&
          contract.runner?.batch_contract?.plain_per_batch === 2 &&
          contract.runner?.batch_contract?.warm_per_batch === 2 &&
          contract.runner?.batch_contract?.maximum_model_attempt_reservations_per_dialogue === 60 &&
          contract.runner?.batch_contract?.maximum_model_attempt_reservations_per_batch === 240 &&
          contract.runner?.batch_contract?.combined_maximum_model_attempt_reservations === 2160 &&
          contract.runner?.batch_contract?.programme_ceiling_if_frame_refusal_confirmation_also_reserved ===
            (isBoredomActionRegisterProofDagCurrent ? 5000 : 4539) &&
          contract.runner?.batch_contract?.combined_analysis_only === true &&
          contract.runner?.batch_contract?.interim_analysis === false &&
          contract.runner?.batch_contract?.valid_unit_reruns === false &&
          contract.runner?.batch_contract?.outcome_selection === false &&
          [
            'profile_specific_resistance_recovery',
            'objective_proof_progress_by_two_turns',
            'randomized_register_assembly',
            'action_register_fidelity_and_safety',
            ...(isBoredomActionRegisterProofDagV2 ? ['compositional_boredom_observer_timing'] : []),
            ...(isBoredomActionRegisterProofDagV3 || isBoredomActionRegisterProofDagV4
              ? ['independent_boredom_semantic_measurement']
              : []),
          ].every((id) => endpointIds.includes(id)),
        'the boredom 36-case endpoint binds fresh triggers, exact blocked analysis, recovery, proof progress, and all hard caps',
      );
    } else if (isActionRegisterConfirmation) {
      const endpointIds = contract.endpoints?.map((row) => row.id) || [];
      assertion(
        checks,
        'action-register-confirmation-endpoint-readiness-binding',
        endpointRegistration.version ===
          (isActionRegisterConfirmationV5
            ? 7
            : isActionRegisterConfirmationV4
              ? 6
              : isActionRegisterConfirmationV3
                ? 5
                : isActionRegisterConfirmationV2
                  ? 4
                  : 3) &&
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
          contract.channels?.frozen_registration?.implementation === request.bindings.registration.path &&
          contract.runner?.batch_contract?.valid_unit_reruns === false &&
          contract.runner?.batch_contract?.outcome_selection === false &&
          contract.runner?.batch_contract?.bounded_technical_recovery ===
            `missing_or_failed_units_only_within_unchanged_60_per_dialogue_240_per_batch_2160_confirmation_and_${isActionRegisterConfirmationV3 || isActionRegisterConfirmationV4 || isActionRegisterConfirmationV5 ? 5000 : isActionRegisterConfirmationV2 ? 2379 : 2345}_programme_caps` &&
          (!(isActionRegisterConfirmationV3 || isActionRegisterConfirmationV4 || isActionRegisterConfirmationV5) ||
            (contract.runner?.batch_contract?.programme_ledger_after_confirmation_maximum ===
              (isActionRegisterConfirmationV5 ? 2453 : isActionRegisterConfirmationV4 ? 2415 : 2379) &&
              contract.runner?.batch_contract?.programme_operational_ceiling === 5000 &&
              contract.runner?.batch_contract?.attempt_accounting_role ===
                'operational_execution_safeguard_only_not_scientific_endpoint_or_design_objective')) &&
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

  if (isAnyResistanceSemanticValidation) {
    validateFileBinding(checks, 'semantic-judge-route-provider-config', {
      path: request.bindings.judgeRoutes.providerConfigPath,
      sha256: request.bindings.judgeRoutes.providerConfigSha256,
    });
    assertion(
      checks,
      'semantic-judge-route-binding',
      request.bindings.judgeRoutes.providerConfigPath === 'config/providers.yaml' &&
        request.bindings.judgeRoutes.judgeA.modelRef === 'codex.gpt-5.6-sol' &&
        request.bindings.judgeRoutes.judgeA.provider === 'codex' &&
        request.bindings.judgeRoutes.judgeA.model === 'gpt-5.6-sol' &&
        request.bindings.judgeRoutes.judgeA.effort === 'low' &&
        request.bindings.judgeRoutes.judgeB.modelRef === 'claude-code.sonnet-5' &&
        request.bindings.judgeRoutes.judgeB.provider === 'claude-code' &&
        request.bindings.judgeRoutes.judgeB.model === 'claude-sonnet-5' &&
        request.bindings.judgeRoutes.judgeB.effort === 'low' &&
        request.bindings.judgeRoutes.crossProviderAndModelFamilyIndependent === true &&
        request.bindings.judgeRoutes.learnerLunaExcludedFromVoting === true,
      'both cross-provider low-effort judge routes are source-bound and Luna cannot vote',
    );
  } else {
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
  }

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
        isActionRegisterConfirmation ||
        isBoredomActionRegisterProofDag ||
        isAnyResistanceSemanticValidation)) ||
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
  } else if (
    isActionRegisterBaseline ||
    isActionRegisterConfirmation ||
    isBoredomActionRegisterProofDag ||
    isAnyResistanceSemanticValidation
  ) {
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
  } else if (isResistanceRecoverySemanticValidation) {
    const registered = readJson(rootPath(request.bindings.registration.path));
    const gate = request.semanticAdjudicationValidation;
    assertion(
      checks,
      'resistance-recovery-semantic-validation-design-binding',
      registered.version === (isResistanceRecoverySemanticValidationV2 ? 2 : 1) &&
        registered.status === 'prospective_zero_call_readiness_hold' &&
        gate.instrumentRegistration.path ===
          `config/tutor-stub-resistance-recovery-semantic-adjudication-registration.${isResistanceRecoverySemanticValidationV2 ? 'v2' : 'v1'}.json` &&
        gate.instrumentRegistration.sha256 === registered.instrument.registrationSha256 &&
        gate.heldoutCorpus.path ===
          `config/tutor-stub-resistance-recovery-semantic-heldout-corpus.${isResistanceRecoverySemanticValidationV2 ? 'v2' : 'v1'}.json` &&
        gate.heldoutCorpus.sha256 === registered.heldout.corpusSha256 &&
        gate.heldoutCorpus.cases === 120 &&
        request.design.cases === 120 &&
        request.design.judgesPerCase === 2 &&
        request.design.judges.join(',') === 'codex.gpt-5.6-sol,claude-code.sonnet-5' &&
        request.design.effort === 'low' &&
        request.design.goldVisibleToJudgePackets === false &&
        request.design.originalCaseIdsVisibleToExecution === false &&
        request.design.goldJoinedOnlyAfterAllCasesSealed === true,
      'the request binds the frozen 120-case outcome corpus and two independent non-Luna judges',
    );
    validateFileBinding(checks, 'recovery-semantic-validation-instrument-binding', gate.instrumentRegistration);
    validateFileBinding(checks, 'recovery-semantic-validation-heldout-binding', gate.heldoutCorpus);
    assertion(
      checks,
      'resistance-recovery-semantic-validation-budget-and-lifecycle',
      request.budget.plannedCases === 120 &&
        request.budget.plannedModelCalls === 240 &&
        request.budget.maximumReservationsPerPlannedCall === 3 &&
        request.budget.maximumPlannedModelAttempts === 720 &&
        request.budget.programmeLedgerBeforeMaximum === (isResistanceRecoverySemanticValidationV2 ? 971 : 811) &&
        request.budget.programmeLedgerAfterMaximum === (isResistanceRecoverySemanticValidationV2 ? 1691 : 1531) &&
        request.budget.programmeCeiling === 5000 &&
        request.budget.retryOrResumeAuthority === 'bounded_technical_recovery' &&
        gate.lifecycle.preservedValidJudgeRecalled === false &&
        gate.lifecycle.neverPreparedPeerMayComplete === true &&
        gate.lifecycle.dispatchedWithoutResponseRecalled === false &&
        gate.lifecycle.validCaseRerun === false &&
        gate.lifecycle.replacement === false &&
        gate.lifecycle.outcomeSelection === false &&
        gate.lifecycle.goldJoinedOnlyAfterSeal === true &&
        gate.lifecycle.durablePrivateArchiveRequired === true,
      'the 240-call outcome validation is capped at 720 reservations with no recall or selection',
    );
    const exactRun = (command, resume) =>
      Array.isArray(command) &&
      command[0] === 'node' &&
      command[1] === 'scripts/run-tutor-stub-resistance-recovery-semantic-validation.js' &&
      command.includes('--live') &&
      command.includes('--resume') === resume &&
      commandArg(command, '--destination') === request.destination.artifactRoot &&
      commandArg(command, '--source-commit') === request.source.launchCommit &&
      commandArg(command, '--source-tree') === request.source.launchTree &&
      commandArg(command, '--go-request') === requestRepoPath &&
      commandArg(command, '--maximum-reservations') === '720';
    assertion(
      checks,
      'resistance-recovery-semantic-validation-live-and-recovery-commands',
      exactRun(liveCommand, false) && exactRun(recoveryCommand, true),
      'outcome live and bounded resume commands retain the exact source, request, destination, and ceiling',
    );
    assertion(
      checks,
      'resistance-recovery-semantic-validation-analysis-command',
      analyzeCommand[0] === 'node' &&
        analyzeCommand[1] === 'scripts/analyze-tutor-stub-resistance-recovery-semantic-validation.js' &&
        commandArg(analyzeCommand, '--destination') === request.destination.artifactRoot &&
        commandArg(analyzeCommand, '--source-commit') === request.source.launchCommit &&
        commandArg(analyzeCommand, '--source-tree') === request.source.launchTree &&
        commandArg(analyzeCommand, '--go-request') === requestRepoPath,
      'the outcome analyzer is bound to the sealed destination, source, and request',
    );
  } else if (isResistanceSemanticValidation) {
    const registered = readJson(rootPath(request.bindings.registration.path));
    const gate = request.semanticAdjudicationValidation;
    assertion(
      checks,
      'resistance-semantic-validation-design-binding',
      registered.version === resistanceSemanticValidationVersion &&
        registered.status === 'prospective_zero_call_readiness_hold' &&
        gate.instrumentRegistration.path ===
          `config/tutor-stub-resistance-semantic-adjudication-registration.v${resistanceSemanticValidationVersion}.json` &&
        gate.instrumentRegistration.sha256 === registered.instrument.registrationSha256 &&
        gate.heldoutCorpus.path ===
          `config/tutor-stub-resistance-semantic-adjudication-heldout-corpus.v${resistanceSemanticValidationVersion}.json` &&
        gate.heldoutCorpus.sha256 === registered.heldout.corpusSha256 &&
        gate.heldoutCorpus.cases === 80 &&
        request.design.cases === 80 &&
        request.design.judgesPerCase === 2 &&
        request.design.judges.join(',') === 'codex.gpt-5.6-sol,claude-code.sonnet-5' &&
        request.design.effort === 'low' &&
        request.design.goldVisibleToJudgePackets === false &&
        request.design.originalCaseIdsVisibleToExecution === false &&
        request.design.goldJoinedOnlyAfterAllCasesSealed === true,
      'the request binds the frozen 80-case blinded corpus and two independent non-Luna low-effort judges',
    );
    if (isResistanceSemanticValidationV2) {
      assertion(
        checks,
        'resistance-semantic-validation-v2-failed-v1-exclusion',
        gate.failedV1Validation?.request?.path ===
          'config/tutor-stub-resistance-semantic-adjudication-validation-study-go-request.v1.json' &&
          gate.failedV1Validation?.request?.sha256 === registered.supersession.v1ConsumedRequestSha256 &&
          gate.failedV1Validation?.reportSha256 === registered.supersession.v1FailedReportSha256 &&
          gate.failedV1Validation?.privateArchive?.branch === registered.supersession.v1FailedArchiveBranch &&
          gate.failedV1Validation?.privateArchive?.commit === registered.supersession.v1FailedArchiveCommit &&
          gate.failedV1Validation?.chargedReservations === 160 &&
          gate.failedV1Validation?.returnedFirstAttempts === 160 &&
          gate.failedV1Validation?.programmeLedgerAfter === 491 &&
          gate.failedV1Validation?.rescored === false &&
          gate.failedV1Validation?.normalized === false &&
          gate.failedV1Validation?.reused === false &&
          gate.failedV1Validation?.pooled === false &&
          gate.failedV1Validation?.outcomeSelected === false,
        'the sealed failed v1 validation remains digest-bound and excluded without rescoring or reuse',
      );
      validateFileBinding(checks, 'semantic-validation-failed-v1-request-binding', gate.failedV1Validation.request);
    }
    if (isResistanceSemanticValidationV3) {
      assertion(
        checks,
        'resistance-semantic-validation-v3-request-revision',
        (gate.requestRevision === undefined &&
          gate.stoppedV3Validation === undefined &&
          gate.stoppedV3SuccessorValidation === undefined) ||
          (gate.requestRevision === RESISTANCE_SEMANTIC_VALIDATION_STOPPED_V3_REQUEST.requestRevision &&
            gate.stoppedV3Validation !== undefined &&
            gate.stoppedV3SuccessorValidation === undefined) ||
          (isResistanceSemanticValidationV3SecondSuccessor &&
            gate.stoppedV3Validation !== undefined &&
            gate.stoppedV3SuccessorValidation !== undefined),
        'the historical V3 request remains valid while revisions 2 and 3 bind every consumed stopped V3 run exactly',
      );
      if (isResistanceSemanticValidationV3Successor) {
        assertion(
          checks,
          'resistance-semantic-validation-v3-stopped-exclusion',
          JSON.stringify(
            canonicalJson({
              requestRevision: RESISTANCE_SEMANTIC_VALIDATION_STOPPED_V3_REQUEST.requestRevision,
              ...gate.stoppedV3Validation,
            }),
          ) === JSON.stringify(canonicalJson(RESISTANCE_SEMANTIC_VALIDATION_STOPPED_V3_REQUEST)),
          'the consumed V3 request, source, four local artifacts, durable archive, accounting, absences, and total exclusion remain exact',
        );
        validateFileBinding(checks, 'semantic-validation-stopped-v3-request-binding', gate.stoppedV3Validation.request);
      }
      if (isResistanceSemanticValidationV3SecondSuccessor) {
        assertion(
          checks,
          'resistance-semantic-validation-v3-stopped-successor-exclusion',
          JSON.stringify(
            canonicalJson({
              requestRevision: gate.requestRevision,
              ...gate.stoppedV3SuccessorValidation,
            }),
          ) === JSON.stringify(canonicalJson(RESISTANCE_SEMANTIC_VALIDATION_STOPPED_V3_SUCCESSOR_REQUEST)),
          'the consumed V3 successor request, source, 19 local artifacts, durable archive, accounting, failures, absences, and total exclusion remain exact',
        );
        validateFileBinding(
          checks,
          'semantic-validation-stopped-v3-successor-request-binding',
          gate.stoppedV3SuccessorValidation.request,
        );
      }
      for (const [version, expected] of [
        [
          'V1',
          {
            path: 'config/tutor-stub-resistance-semantic-adjudication-validation-study-go-request.v1.json',
            requestSha: registered.supersession.v1ConsumedRequestSha256,
            reportSha: registered.supersession.v1FailedReportSha256,
            archiveBranch: registered.supersession.v1FailedArchiveBranch,
            archiveCommit: registered.supersession.v1FailedArchiveCommit,
            ledger: 491,
          },
        ],
        [
          'V2',
          {
            path: 'config/tutor-stub-resistance-semantic-adjudication-validation-study-go-request.v2.json',
            requestSha: registered.supersession.v2ConsumedRequestSha256,
            reportSha: registered.supersession.v2FailedReportSha256,
            archiveBranch: registered.supersession.v2FailedArchiveBranch,
            archiveCommit: registered.supersession.v2FailedArchiveCommit,
            ledger: 651,
          },
        ],
      ]) {
        const failed = gate[`failed${version}Validation`];
        assertion(
          checks,
          `resistance-semantic-validation-v3-failed-${version.toLowerCase()}-exclusion`,
          failed?.request?.path === expected.path &&
            failed?.request?.sha256 === expected.requestSha &&
            failed?.reportSha256 === expected.reportSha &&
            failed?.privateArchive?.branch === expected.archiveBranch &&
            failed?.privateArchive?.commit === expected.archiveCommit &&
            failed?.chargedReservations === 160 &&
            failed?.returnedFirstAttempts === 160 &&
            failed?.programmeLedgerAfter === expected.ledger &&
            failed?.rescored === false &&
            failed?.normalized === false &&
            failed?.reused === false &&
            failed?.pooled === false &&
            failed?.outcomeSelected === false,
          `the sealed failed ${version} validation remains digest-bound and excluded`,
        );
        validateFileBinding(
          checks,
          `semantic-validation-failed-${version.toLowerCase()}-request-binding`,
          failed.request,
        );
      }
    }
    validateFileBinding(checks, 'semantic-validation-instrument-binding', gate.instrumentRegistration);
    validateFileBinding(checks, 'semantic-validation-heldout-binding', gate.heldoutCorpus);
    assertion(
      checks,
      'resistance-semantic-validation-budget-and-lifecycle',
      request.budget.plannedCases === 80 &&
        request.budget.plannedModelCalls === 160 &&
        request.budget.maximumReservationsPerPlannedCall === 3 &&
        request.budget.maximumPlannedModelAttempts === 480 &&
        request.budget.programmeLedgerBefore === resistanceSemanticValidationProgrammeLedgerBefore &&
        request.budget.programmeLedgerAfterMaximum === resistanceSemanticValidationProgrammeLedgerAfterMaximum &&
        request.budget.programmeCeiling === 5000 &&
        request.budget.retryOrResumeAuthority === 'bounded_technical_recovery' &&
        gate.lifecycle.preservedValidJudgeRecalled === false &&
        gate.lifecycle.neverPreparedPeerMayComplete === true &&
        gate.lifecycle.dispatchedWithoutResponseRecalled === false &&
        gate.lifecycle.invalidOrTransportTerminalPeerRequired === false &&
        gate.lifecycle.validCaseRerun === false &&
        gate.lifecycle.replacement === false &&
        gate.lifecycle.outcomeSelection === false &&
        gate.lifecycle.goldJoinedOnlyAfterSeal === true &&
        gate.lifecycle.durablePrivateArchiveRequired === true,
      'the 160-call validation is capped at 480 reservations and permits only missing never-dispatched peer completion without recall or selection',
    );
    assertion(
      checks,
      'resistance-semantic-validation-claim-boundary',
      gate.claimBoundary ===
        (isResistanceSemanticValidationV3
          ? isResistanceSemanticValidationV3SecondSuccessor
            ? 'heldout_semantic_instrument_v3_validation_only_failed_v1_v2_and_two_stopped_v3_runs_excluded_no_confirmation_outcome_or_warm_plain_efficacy_null_learning_transfer_human_or_cell_claim'
            : isResistanceSemanticValidationV3Successor
              ? 'heldout_semantic_instrument_v3_validation_only_failed_v1_v2_and_stopped_v3_excluded_no_confirmation_outcome_or_warm_plain_efficacy_null_learning_transfer_human_or_cell_claim'
              : 'heldout_semantic_instrument_v3_validation_only_failed_v1_v2_excluded_no_confirmation_outcome_or_warm_plain_efficacy_null_learning_transfer_human_or_cell_claim'
          : isResistanceSemanticValidationV2
            ? 'heldout_semantic_instrument_v2_validation_only_failed_v1_excluded_no_confirmation_outcome_or_warm_plain_efficacy_null_learning_transfer_human_or_cell_claim'
            : 'heldout_semantic_instrument_validation_only_no_confirmation_outcome_or_warm_plain_efficacy_null_learning_transfer_human_or_cell_claim') &&
        gate.syntheticPreflightEstablishesAccuracy === false &&
        gate.validationOutcomesExcludedFromConfirmation === true &&
        gate.postHeldoutPromptSchemaConsensusThresholdTuning === false,
      'the request authorizes instrument validation only and cannot create a confirmation or efficacy claim',
    );
    const exactRun = (command, resume) =>
      Array.isArray(command) &&
      command[0] === 'node' &&
      command[1] === 'scripts/run-tutor-stub-resistance-semantic-validation.js' &&
      command.includes('--live') &&
      command.includes('--resume') === resume &&
      commandArg(command, '--destination') === request.destination.artifactRoot &&
      commandArg(command, '--source-commit') === request.source.launchCommit &&
      commandArg(command, '--source-tree') === request.source.launchTree &&
      commandArg(command, '--go-request') === requestRepoPath &&
      commandArg(command, '--maximum-reservations') === '480' &&
      (isResistanceSemanticValidationV2 || isResistanceSemanticValidationV3
        ? commandArg(command, '--validation-registration') ===
          `config/tutor-stub-resistance-semantic-adjudication-validation-registration.v${resistanceSemanticValidationVersion}.json`
        : commandArg(command, '--validation-registration') === null);
    assertion(
      checks,
      'resistance-semantic-validation-live-and-recovery-commands',
      exactRun(liveCommand, false) && exactRun(recoveryCommand, true),
      `live and bounded resume commands preserve the source, request ${requestRepoPath}, destination, and hard ceiling`,
    );
    assertion(
      checks,
      'resistance-semantic-validation-analysis-command',
      Array.isArray(analyzeCommand) &&
        analyzeCommand[0] === 'node' &&
        analyzeCommand[1] === 'scripts/analyze-tutor-stub-resistance-semantic-validation.js' &&
        commandArg(analyzeCommand, '--destination') === request.destination.artifactRoot &&
        commandArg(analyzeCommand, '--source-commit') === request.source.launchCommit &&
        commandArg(analyzeCommand, '--source-tree') === request.source.launchTree &&
        commandArg(analyzeCommand, '--go-request') === requestRepoPath &&
        (isResistanceSemanticValidationV2 || isResistanceSemanticValidationV3
          ? commandArg(analyzeCommand, '--validation-registration') ===
            `config/tutor-stub-resistance-semantic-adjudication-validation-registration.v${resistanceSemanticValidationVersion}.json`
          : commandArg(analyzeCommand, '--validation-registration') === null),
      'the sole analyzer binds the sealed destination, source, and digest-bound request',
    );
  } else if (isBoredomActionRegisterProofDag) {
    const registered = readJson(rootPath(request.bindings.registration.path));
    const gate = request.boredomActionRegisterProofDag;
    const stoppedBinding = isBoredomActionRegisterProofDagV4
      ? BOREDOM_PROOF_DAG_STOPPED_V4_REQUEST
      : isBoredomActionRegisterProofDagV3
        ? BOREDOM_PROOF_DAG_STOPPED_V3_REQUEST
        : isBoredomActionRegisterProofDagV2
          ? BOREDOM_PROOF_DAG_STOPPED_V2_REQUEST
          : BOREDOM_PROOF_DAG_STOPPED_V1_REQUEST;
    const isSuccessor = gate.requestRevision === stoppedBinding.requestRevision;
    const batchDestinations = request.destination.batches;
    const registeredWorlds = registered.design?.worlds || [];
    assertion(
      checks,
      'boredom-proof-dag-design-binding',
      registered.version ===
        (isBoredomActionRegisterProofDagV4
          ? 4
          : isBoredomActionRegisterProofDagV3
            ? 3
            : isBoredomActionRegisterProofDagV2
              ? 2
              : 1) &&
        registered.design?.observationSemantics ===
          (isBoredomActionRegisterProofDagV3 || isBoredomActionRegisterProofDagV4
            ? 'prospective_v9'
            : isBoredomActionRegisterProofDagV2
              ? 'prospective_v8'
              : 'prospective_bored_effort_withholding') &&
        request.design.profiles.join(',') === 'bored' &&
        request.design.dialogues === 36 &&
        request.design.dialoguesPerArm === 18 &&
        request.design.realizations.join(',') === 'plain,warm' &&
        request.design.worlds.length === 6 &&
        JSON.stringify(request.design.worlds) === JSON.stringify(registeredWorlds) &&
        request.design.freshIndependentDialogues === true &&
        request.design.triggerMustShowByTurn === 2 &&
        request.design.primaryRecoveryDeadlinePostTriggerLearnerTurns === 1 &&
        request.design.proofProgressHorizonPostTriggerLearnerTurns === 2 &&
        request.design.fixedPedagogicalMove === 'ask_discriminating_question' &&
        request.design.dagMode === 'strict_dag' &&
        request.design.assignmentManifestSha256 === registered.design.randomization.assignmentManifestSha256 &&
        request.design.models.tutor === 'codex.gpt-5.6-luna' &&
        request.design.models.analysis === 'codex.gpt-5.6-luna' &&
        request.design.models.learner === 'codex.gpt-5.6-luna' &&
        (!(isBoredomActionRegisterProofDagV3 || isBoredomActionRegisterProofDagV4) ||
          request.design.models.semanticAdjudicator === 'codex.gpt-5.6-sol') &&
        request.design.cliEffort === 'low',
      'the boredom confirmation is 36 fresh blocked-randomized strict-DAG dialogues, 18 per arm, over six exact worlds',
    );
    assertion(
      checks,
      'boredom-proof-dag-request-revision',
      (gate.requestRevision === undefined && gate.priorStoppedExecution === undefined) ||
        (isSuccessor && gate.priorStoppedExecution !== undefined),
      'the original request remains compatible; revisions 2 through 5 bind their exact stopped predecessors',
    );
    if (isSuccessor) {
      assertion(
        checks,
        'boredom-proof-dag-stopped-exclusion-binding',
        JSON.stringify(
          canonicalJson({
            requestRevision: gate.requestRevision,
            ...gate.priorStoppedExecution,
          }),
        ) === JSON.stringify(canonicalJson(stoppedBinding)),
        'the consumed request, preserved stopped batches, traces, accounting, and total exclusion remain exact',
      );
      validateFileBinding(checks, 'boredom-proof-dag-consumed-request-binding', gate.priorStoppedExecution.request);
      if (isBoredomActionRegisterProofDagCurrent) {
        validateFileBinding(
          checks,
          'boredom-proof-dag-predecessor-request-binding',
          gate.priorStoppedExecution.predecessorRequest,
        );
      }
    }
    assertion(
      checks,
      'boredom-proof-dag-evidence-separation',
      gate.calibrationSizingEvidence?.analysisRequest?.path ===
        'config/tutor-stub-resistance-action-register-baseline-analysis-go-request.v1.json' &&
        gate.calibrationSizingEvidence?.analysisRequest?.sha256 ===
          '965aca0ad1f61d2f43891c162861180016d79a8afa5c090ace0e3e88a436e0dd' &&
        gate.calibrationSizingEvidence?.reportSha256 ===
          '42021a390338cd556386efc96d8f00b35655a411627908a10248dba1e473a3a5' &&
        gate.calibrationSizingEvidence?.privateArchiveCommit === '0857363dabb4445052159b8218acaed13d921949' &&
        gate.heldOutDetectionEvidenceUsedForInstrumentOnly === true &&
        gate.historicalMatchedActionEvidenceUsedForFixedActionOnly === true &&
        gate.twelveDialogueCalibrationUsedForSizingOnly === true &&
        gate.priorDialoguesReused === false &&
        gate.priorOutcomesPooled === false &&
        gate.interimAnalysisPermitted === false &&
        gate.validUnitRerunsPermitted === false &&
        gate.outcomeSelectionPermitted === false &&
        (!isSuccessor ||
          (isBoredomActionRegisterProofDagCurrent
            ? gate.priorStoppedExecution.retryPermitted === false &&
              gate.priorStoppedExecution.resumePermitted === false &&
              gate.priorStoppedExecution.reusePermitted === false &&
              gate.priorStoppedExecution.replacementPermitted === false &&
              gate.priorStoppedExecution.poolingPermitted === false &&
              gate.priorStoppedExecution.analysisPermitted === false &&
              gate.priorStoppedExecution.outcomeSelectionPermitted === false &&
              gate.priorStoppedExecution.confirmationCreditPermitted === false
            : gate.priorStoppedExecution.recoveryPermitted === false &&
              gate.priorStoppedExecution.reusePermitted === false &&
              gate.priorStoppedExecution.poolingPermitted === false &&
              gate.priorStoppedExecution.outcomeSelectionPermitted === false)),
      'held-out detection, historical action-fit, and the 12-dialogue calibration remain excluded from confirmation outcomes',
    );
    if (isBoredomActionRegisterProofDagV3) {
      assertion(
        checks,
        'boredom-proof-dag-independent-semantic-measurement-boundary',
        gate.semanticValidation?.modelRef === 'codex.gpt-5.6-sol' &&
          gate.semanticValidation?.role === 'tutor_stub_boredom_performance_adjudication' &&
          gate.semanticValidation?.generatorSelfJudgmentAllowed === false &&
          gate.semanticValidation?.regexFinalAuthority === false &&
          gate.semanticValidation?.lexicalSilenceMayVetoSemanticPositive === false &&
          gate.semanticValidation?.heldoutCorpus?.path ===
            'config/tutor-stub-boredom-semantic-adjudication-heldout.v1.json' &&
          gate.semanticValidation?.heldoutCorpus?.sha256 ===
            'ad61f7b104c8202889c9f9eb00090a900aafea5d5bf55d7e3b89cf41db300f93' &&
          gate.semanticValidation?.heldoutCorpus?.cases === 22 &&
          JSON.stringify(gate.semanticValidation?.gates) ===
            JSON.stringify({
              determinateSensitivityMinimum: 0.9,
              determinateSpecificityMinimum: 0.9,
              referenceAgreementMinimum: 0.9,
              ambiguousIndeterminateRateMinimum: 1,
              lowConfidenceIndeterminateRateMinimum: 1,
            }) &&
          gate.semanticValidation?.empiricalValidationStatus === 'pending' &&
          gate.semanticValidation?.confirmationLaunchReady === false &&
          gate.semanticValidation?.lowConfidenceOrDisagreementDisposition ===
            'measurement_indeterminate_no_repair_no_rerun_no_replacement',
        'the independent Sol semantic seat, sealed held-out corpus, auxiliary-only regex, and prelaunch empirical gate remain exact',
      );
      validateFileBinding(
        checks,
        'boredom-proof-dag-semantic-heldout-corpus-binding',
        gate.semanticValidation.heldoutCorpus,
      );
    }
    if (isBoredomActionRegisterProofDagV4) {
      assertion(
        checks,
        'boredom-proof-dag-validated-semantic-instrument-boundary',
        gate.semanticValidation?.modelRef === 'codex.gpt-5.6-sol' &&
          gate.semanticValidation?.role === 'tutor_stub_boredom_performance_adjudication' &&
          gate.semanticValidation?.generatorSelfJudgmentAllowed === false &&
          gate.semanticValidation?.regexFinalAuthority === false &&
          gate.semanticValidation?.lexicalSilenceMayVetoSemanticPositive === false &&
          gate.semanticValidation?.instrumentModule?.path === 'services/tutorStubBoredomSemanticAdjudicationV3.js' &&
          gate.semanticValidation?.instrumentModule?.sha256 ===
            'c6519c690857360d15dd86a0757bfc382a7963e1fdf617abc270652d7289b18c' &&
          gate.semanticValidation?.heldoutCorpus?.path ===
            'config/tutor-stub-boredom-semantic-adjudication-heldout.v4.json' &&
          gate.semanticValidation?.heldoutCorpus?.sha256 ===
            '5f65dd5dc3e193c9dc0368b4155a550bc9b5acd56de78e62704e35f750f50aa0' &&
          gate.semanticValidation?.heldoutCorpus?.cases === 55 &&
          JSON.stringify(gate.semanticValidation?.gates) ===
            JSON.stringify({
              determinateSensitivityMinimum: 0.9,
              determinateSpecificityMinimum: 0.9,
              referenceAgreementMinimum: 0.9,
              ambiguousIndeterminateRateMinimum: 1,
              lowConfidenceIndeterminateRateMinimum: 1,
            }) &&
          gate.semanticValidation?.empiricalValidationStatus ===
            'passed_all_predeclared_gates_on_sealed_heldout_v4_corpus' &&
          gate.semanticValidation?.empiricalValidationReportSha256 ===
            '7ff7810e28f7e037af12fbd852445efab9538bc1c946c529356a0c009a51763c' &&
          gate.semanticValidation?.confirmationLaunchReady === true &&
          gate.semanticValidation?.lowConfidenceOrDisagreementDisposition ===
            'measurement_indeterminate_no_repair_no_rerun_no_replacement' &&
          gate.semanticValidation?.supersededHoldRequest?.path ===
            'config/tutor-stub-boredom-action-register-proof-dag-study-go-request.v3.json' &&
          gate.semanticValidation?.supersededHoldRequest?.sha256 ===
            'abda11e242d3d2cd67c0fe9f3e3c16a11cd59020e86e62ca2f9445e97508c08c' &&
          gate.semanticValidation?.supersededHoldRequest?.consumedByExecution === false,
        'the validated Sol V3 instrument, sealed 55-case held-out corpus, passed gates, and superseded v3 HOLD request remain exactly pinned',
      );
      validateFileBinding(
        checks,
        'boredom-proof-dag-semantic-instrument-module-binding',
        gate.semanticValidation.instrumentModule,
      );
      validateFileBinding(
        checks,
        'boredom-proof-dag-semantic-heldout-corpus-binding',
        gate.semanticValidation.heldoutCorpus,
      );
      validateFileBinding(
        checks,
        'boredom-proof-dag-superseded-hold-request-binding',
        gate.semanticValidation.supersededHoldRequest,
      );
    }
    validateFileBinding(
      checks,
      'boredom-proof-dag-calibration-request-binding',
      gate.calibrationSizingEvidence.analysisRequest,
    );
    assertion(
      checks,
      'boredom-proof-dag-power-and-budget',
      request.power.test === 'two_sided_exact_conditional_blocked_score_test' &&
        request.power.alpha === 0.05 &&
        request.power.calibrationPlainRate === 1 / 6 &&
        request.power.calibrationWarmRate === 4 / 6 &&
        Math.abs(request.power.powerAt17PerArm - 0.7947641958186097) < 1e-12 &&
        Math.abs(request.power.powerAt18PerArm - 0.8164905471625752) < 1e-12 &&
        request.power.minimumNPerArmAtOrAbove80Percent === 18 &&
        request.budget.dialogues === 36 &&
        request.budget.plannedRoleCallsPerDialogue === 20 &&
        request.budget.maximumReservationsPerPlannedCall === 3 &&
        request.budget.maximumAttemptsPerDialogue === 60 &&
        request.budget.dialoguesPerBatch === 4 &&
        request.budget.maximumAttemptsPerBatch === 240 &&
        request.budget.maximumPlannedModelAttempts === 2160 &&
        request.budget.programmeLedgerBefore ===
          (isBoredomActionRegisterProofDagV4 ? 446 : isBoredomActionRegisterProofDagCurrent ? 293 : 219) &&
        request.budget.programmeCeilingBefore === (isBoredomActionRegisterProofDagCurrent ? 5000 : 2379) &&
        request.budget.frameRefusalConfirmationReservedAttempts === 2160 &&
        request.budget.programmeOperationalSafeguardIncrement === 2160 &&
        request.budget.programmeCeilingAfter === (isBoredomActionRegisterProofDagCurrent ? 5000 : 4539) &&
        request.budget.programmeLedgerAfterBoredomMaximum ===
          (isBoredomActionRegisterProofDagV4 ? 2606 : isBoredomActionRegisterProofDagCurrent ? 2453 : 2379) &&
        request.budget.programmeReservedAfterBothMaximum ===
          (isBoredomActionRegisterProofDagV4 ? 4766 : isBoredomActionRegisterProofDagCurrent ? 4613 : 4539) &&
        request.budget.attemptAccountingRole === 'operational_execution_safeguard_only' &&
        request.budget.retryOrResumeAuthority === 'bounded_technical_recovery',
      'the exact blocked test needs 18 per arm; attempt counts separately bind 60 per dialogue, 2160 for boredom, and 4539 as the cumulative operational safeguard',
    );
    const recovery = gate.recoveryBoundary;
    assertion(
      checks,
      'boredom-proof-dag-recovery-boundary',
      recovery.sameLaunchSource === true &&
        recovery.sameRegistrationModelsSeedsWorldsMeasurementAndAssignment === true &&
        recovery.missingOrFailedUnitsOnly === true &&
        recovery.freshNonOverwritingRecoveryCheckpoint === true &&
        recovery.rerunValidOutputs === false &&
        recovery.selectAmongOutcomes === false &&
        recovery.maximumAttemptsPerDialogueUnchanged === 60 &&
        recovery.maximumAttemptsPerBatchUnchanged === 240 &&
        recovery.maximumTotalStudyAttemptsUnchanged === 2160 &&
        recovery.programmeCeilingUnchanged === (isBoredomActionRegisterProofDagCurrent ? 5000 : 4539),
      'bounded recovery may fill only missing or failed units under every unchanged protected input and cap',
    );
    assertion(
      checks,
      'boredom-proof-dag-command-shape',
      Array.isArray(liveCommand) &&
        Array.isArray(recoveryCommand) &&
        liveCommand.length === 9 &&
        recoveryCommand.length === 9 &&
        Array.isArray(batchDestinations) &&
        batchDestinations.length === 9 &&
        liveCommand.every(
          (command, index) =>
            command[0] === 'node' &&
            command[1] === 'scripts/run-tutor-stub-boredom-action-register-proof-dag.js' &&
            command.includes('--live-batch') &&
            commandArg(command, '--registration') === request.bindings.registration.path &&
            commandArg(command, '--batch') === `execution_batch_${index + 1}` &&
            commandArg(command, '--destination') === batchDestinations[index].artifactRoot &&
            commandArg(command, '--parallelism') === '4' &&
            commandArg(command, '--expected-source-commit') === request.source.launchCommit,
        ) &&
        recoveryCommand.every(
          (command, index) =>
            command[0] === 'node' &&
            command[1] === 'scripts/run-tutor-stub-boredom-action-register-proof-dag.js' &&
            command.includes('--recover-batch') &&
            commandArg(command, '--destination') === batchDestinations[index].artifactRoot &&
            commandArg(command, '--expected-source-commit') === request.source.launchCommit &&
            commandArg(command, '--parallelism') === '4',
        ),
      'nine exact four-dialogue live commands and missing-or-failed-only recovery commands remain bound',
    );
    assertion(
      checks,
      'boredom-proof-dag-analysis-command-shape',
      analyzeCommand[0] === 'node' &&
        analyzeCommand[1] === 'scripts/analyze-tutor-stub-boredom-action-register-proof-dag.js' &&
        JSON.stringify(commandArgs(analyzeCommand, '--batch')) ===
          JSON.stringify(batchDestinations.map((entry) => entry.artifactRoot)) &&
        commandArg(analyzeCommand, '--registration') === request.bindings.registration.path &&
        commandArg(analyzeCommand, '--expected-source-commit') === request.source.launchCommit &&
        commandArg(analyzeCommand, '--out') === request.destination.combinedReport &&
        analyzeCommand.includes('--json') &&
        request.measurement.reportSchema ===
          'machinespirits.tutor-stub.boredom-action-register-proof-dag-confirmation-report.v1' &&
        request.measurement.primaryOutcome === 'profile_specific_resistance_recovery_first_post_trigger_turn' &&
        request.measurement.keySecondaryOutcome === 'objective_proof_progress_by_two_turns' &&
        request.measurement.primaryTest === 'two_sided_exact_conditional_blocked_score_test' &&
        request.measurement.fixedSequencePrimaryThenKeySecondary === true &&
        request.measurement.oneCombinedThirtySixDialogueAnalysisRequired === true &&
        request.measurement.interimAnalysisPermitted === false,
      'one exact combined analyzer binds the predeclared blocked test, fixed sequence, and create-once report',
    );
  } else if (isActionRegisterConfirmation) {
    const registered = readJson(rootPath(request.bindings.registration.path));
    const gate = request.actionRegisterConfirmation;
    const blocks = request.design.blocks;
    const batchDestinations = request.destination.batches;
    assertion(
      checks,
      'action-register-confirmation-design-binding',
      registered.version ===
        (isActionRegisterConfirmationV5
          ? 7
          : isActionRegisterConfirmationV4
            ? 6
            : isActionRegisterConfirmationV3
              ? 5
              : isActionRegisterConfirmationV2
                ? 4
                : 3) &&
        registered.design?.trigger?.observationSemantics ===
          (isActionRegisterConfirmationV5
            ? 'prospective_v7'
            : isActionRegisterConfirmationV4
              ? 'prospective_v6'
              : isActionRegisterConfirmationSuccessor
                ? 'prospective_v5'
                : 'prospective_v4') &&
        (!isActionRegisterConfirmationSuccessor || registered.design?.trigger?.observerFirstEligibility === true) &&
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
    if (isActionRegisterConfirmationSuccessor) {
      const stopped = gate.priorIncompleteConfirmation;
      assertion(
        checks,
        'action-register-confirmation-prior-incomplete-exclusion',
        stopped?.request?.path ===
          'config/tutor-stub-resistance-action-register-warm-plain-confirmation-study-go-request.v1.json' &&
          stopped?.request?.sha256 === '16f93e48f0b19fe23f0b91dabc9ac318f210ecbba6fbe954d76677d43fb78554' &&
          stopped?.privateArchiveBranch === 'codex/resistance-action-register-confirmation-v1-incomplete-archive' &&
          stopped?.privateArchiveCommit === '4604cc31920913e10b3e04565bf3d70def7c112e' &&
          stopped?.localInventorySha256 === '4b7345dd69e6d700b7216f1af7a4b315fdcb7aae5161248610000e592c1f7a1f' &&
          stopped?.liveMirrorInventorySha256 === '8f530416c8b24ff809486c6638ed329b6ab03593931f85768befe6ef1972a361' &&
          stopped?.reservations === 34 &&
          stopped?.completedCalls === 34 &&
          stopped?.providerFailures === 0 &&
          stopped?.reused === false &&
          stopped?.pooled === false &&
          stopped?.outcomeSelected === false &&
          stopped?.excludedFromSuccessor === true &&
          stopped?.blocksAfterFirstLaunched === false &&
          stopped?.analyzerRun === false &&
          stopped?.reportWritten === false,
        'the incomplete V1 block is hash-bound diagnostic evidence only and is wholly excluded from the fresh successor',
      );
      validateFileBinding(checks, 'action-register-confirmation-prior-request-binding', stopped.request);
    }
    if (isActionRegisterConfirmationV4 || isActionRegisterConfirmationV5) {
      const stopped = gate.priorIncompleteConfirmationV3;
      assertion(
        checks,
        'action-register-confirmation-prior-v3-incomplete-exclusion',
        stopped?.request?.path ===
          'config/tutor-stub-resistance-action-register-warm-plain-confirmation-study-go-request.v3.json' &&
          stopped?.request?.sha256 === 'e3df720358cc597e686f0007bfc1ce1a5d0b4a11273a725ce87b484d20c3fec9' &&
          stopped?.sourceCommit === 'c9f6d57b867376e94384e9efe99ccf8a79ca9195' &&
          stopped?.sourceTree === '48c5fb51714948ea3911baed159aa731aacc9c05' &&
          stopped?.batchPlanSha256 === 'd04038ddb0c9e2c676ede89c198ee666195c91e45808d91dba8e3a5060e13e35' &&
          stopped?.privateArchiveBranch === 'codex/resistance-action-register-confirmation-v3-incomplete-archive' &&
          stopped?.privateArchiveCommit === '6f3e8f84079787abe1b0829be65be742c5983988' &&
          stopped?.localInventorySha256 === '83428e7d86df598b5794e3890e62e91e48dddea46514e6a0cd4d4123340c7493' &&
          stopped?.liveMirrorInventorySha256 === 'ce29fe1cef61b564b09d413b0b6782e2661a4ccff732b97c815d72deec72dae3' &&
          stopped?.reservations === 36 &&
          stopped?.completedCalls === 35 &&
          stopped?.providerFailures === 0 &&
          stopped?.coordinatorInterruptedReservations === 1 &&
          stopped?.traceSha256?.s1 === '39b9ec3e4a4be5552aef03ca9b06b1302e4c561b15401863ab53d8a7b7cc228b' &&
          stopped?.traceSha256?.s2 === 'e2ddd2e5c15d757878ede5cc01b62e5deadde74626ebea0491726c870b61b0fe' &&
          stopped?.traceSha256?.s3 === 'e414034894d3ef1050b970695547ac13a13c26a3b3b36d72d7aed8593d6b1763' &&
          stopped?.traceSha256?.s4 === '4d7d6076c514de118ca90636aa4a17a890d2025535083e131b6e787e6f9cf727' &&
          stopped?.reused === false &&
          stopped?.pooled === false &&
          stopped?.outcomeSelected === false &&
          stopped?.excludedFromSuccessor === true &&
          stopped?.blocksAfterFirstLaunched === false &&
          stopped?.recoveryRun === false &&
          stopped?.analyzerRun === false &&
          stopped?.reportWritten === false,
        'the incomplete V3 block is hash-bound diagnostic evidence only and is wholly excluded from the fresh successor',
      );
      validateFileBinding(checks, 'action-register-confirmation-prior-v3-request-binding', stopped.request);
    }
    if (isActionRegisterConfirmationV5) {
      const stopped = gate.priorIncompleteConfirmationV4;
      assertion(
        checks,
        'action-register-confirmation-prior-v4-incomplete-exclusion',
        stopped?.request?.path ===
          'config/tutor-stub-resistance-action-register-warm-plain-confirmation-study-go-request.v4.json' &&
          stopped?.request?.sha256 === '8c25d6afcae9b9c5689f3130664048c63d303a440412af7f4ba138a6a9337aab' &&
          stopped?.sourceCommit === '8d18480e8e531ae7b4ac4e5c63e8de82628aea9f' &&
          stopped?.sourceTree === 'adadcbff0502d0df15e777d8cebe1d7d5daa5011' &&
          stopped?.batchPlanSha256 === '388ee1df888d69f8cf2a63f6330e799092c3cc827a0e23c0913886ef9bb57591' &&
          stopped?.batchResultSha256 === '1d957f5bf8707f5ce2150a8e3576ad4ab2440f7e1e8a1f43a064e863de001636' &&
          stopped?.privateArchiveBranch === 'codex/resistance-action-register-confirmation-v4-incomplete-archive' &&
          stopped?.privateArchiveCommit === '05eb01179a437c4a7723a831639b1d7126a338e2' &&
          stopped?.privateArchiveTree === 'e978a6761c6d8978084fd5d574758d75e3fb6d4d' &&
          stopped?.privateArchiveBase === 'b36f25a295f23250f95d0ca6539123f12cc6a6af' &&
          stopped?.localInventoryFiles === 18 &&
          stopped?.localInventoryBytes === 7_845_834 &&
          stopped?.localInventorySha256 === 'd4585b41981d6ac4d4d6e44a6fccc253f792221f5e2c3f87fd7ec5d42c16eafe' &&
          stopped?.liveMirrorInventoryFiles === 8 &&
          stopped?.liveMirrorInventoryBytes === 922_685 &&
          stopped?.liveMirrorInventorySha256 === '7545452e100a2cfc1b59c17e6da8c1a5196eb7fc5d272cd60556c7462cb524fa' &&
          stopped?.privateArchiveInventoryFiles === 16 &&
          stopped?.privateArchiveInventoryBytes === 3_216_802 &&
          stopped?.privateArchiveInventorySha256 ===
            '5f913668777b7bd5111d575eec49daca71a05b7f03f4a7e4281bc285a943845b' &&
          stopped?.ledgerSha256 === '2b3bf3f416edafdd21777219f7031afef7cfef75e8adebc843c4cc16576ba1b7' &&
          stopped?.dialoguesPlanned === 36 &&
          stopped?.dialoguesStarted === 4 &&
          stopped?.dialoguesComplete === 2 &&
          stopped?.dialoguesSubstantiveFailure === 2 &&
          stopped?.reservations === 38 &&
          stopped?.completedCalls === 38 &&
          stopped?.providerFailures === 0 &&
          stopped?.abortedCalls === 0 &&
          stopped?.interruptedCalls === 0 &&
          stopped?.traceSha256?.s1 === '5d17d885bdad4e4b1ffe3b2a63a2e81f70c334eb9aafe1a5add649ebe1b8ac6c' &&
          stopped?.traceSha256?.s2 === '7a9bd37991410c35f868f26fb63dc002d7aabdb64849a42220a1df8e50928942' &&
          stopped?.traceSha256?.s3 === '14235461410868bba4e2a2bed2a7e24022dd4eadbe655b05835f0170da8ca3c3' &&
          stopped?.traceSha256?.s4 === 'a211ea656bc458aaa3e31f6552d65e65b67a9f428ed6388d6006af057d8164ee' &&
          stopped?.compressedTraceSha256?.s1 === 'a438528c8e5526038667e6f24cb0d080884b994acd3a6d4eebb293f3778dde75' &&
          stopped?.compressedTraceSha256?.s2 === '3ef7bc055efe5410b77495e8e98d5d319e9cb4c76bab220e918748798e695dc5' &&
          stopped?.compressedTraceSha256?.s3 === '549ab0a561951676a322e0ed8c4d8987ab79ac17190a0ef17e26b7423f319a45' &&
          stopped?.compressedTraceSha256?.s4 === 'e5e4a872cbfd68dd7f5b633be6d018da1b97392b07c3433b51e6bccfd4f29dd3' &&
          stopped?.blocksAfterFirstLaunched === false &&
          stopped?.recoveryRun === false &&
          stopped?.analyzerRun === false &&
          stopped?.reportWritten === false &&
          stopped?.resultProduced === false &&
          stopped?.sealProduced === false &&
          stopped?.reused === false &&
          stopped?.pooled === false &&
          stopped?.outcomeSelected === false &&
          stopped?.excludedFromSuccessor === true,
        'the incomplete V4 block and every substantive failure are hash-bound diagnostic evidence only and wholly excluded',
      );
      validateFileBinding(checks, 'action-register-confirmation-prior-v4-request-binding', stopped.request);
    }
    if (isActionRegisterConfirmationV3 || isActionRegisterConfirmationV4 || isActionRegisterConfirmationV5) {
      const superseded = gate.supersededCeilingBoundRequest;
      assertion(
        checks,
        'action-register-confirmation-superseded-ceiling-request-exclusion',
        superseded?.request?.path ===
          'config/tutor-stub-resistance-action-register-warm-plain-confirmation-study-go-request.v2.json' &&
          superseded?.request?.sha256 === '94973232d87e812b947981f85c12345bb413302dd54bad87b1f478c0a356b34b' &&
          superseded?.supersededWithoutExecution === true &&
          superseded?.modelCalls === 0 &&
          superseded?.productionWrites === 0 &&
          superseded?.destinationsUsed === false &&
          superseded?.outcomesAvailable === false,
        'the ceiling-bound V2 request is preserved as unexecuted metadata and contributes no dialogue or outcome',
      );
      validateFileBinding(checks, 'action-register-confirmation-superseded-request-binding', superseded.request);
    }
    const expectedProgrammeBudget = isActionRegisterConfirmationV5
      ? {
          ledgerBefore: 293,
          ceilingBefore: 5000,
          amendment: 0,
          ceilingAfter: 5000,
          ledgerAfterMaximum: 2453,
        }
      : isActionRegisterConfirmationV4
        ? {
            ledgerBefore: 255,
            ceilingBefore: 5000,
            amendment: 0,
            ceilingAfter: 5000,
            ledgerAfterMaximum: 2415,
          }
        : isActionRegisterConfirmationV3
          ? {
              ledgerBefore: 219,
              ceilingBefore: 2345,
              amendment: 2655,
              ceilingAfter: 5000,
              ledgerAfterMaximum: 2379,
            }
          : isActionRegisterConfirmationV2
            ? {
                ledgerBefore: 219,
                ceilingBefore: 2345,
                amendment: 34,
                ceilingAfter: 2379,
                ledgerAfterMaximum: 2379,
              }
            : {
                ledgerBefore: 185,
                ceilingBefore: 1200,
                amendment: 1145,
                ceilingAfter: 2345,
                ledgerAfterMaximum: 2345,
              };
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
        request.budget.programmeLedgerBefore === expectedProgrammeBudget.ledgerBefore &&
        request.budget.programmeCeilingBefore === expectedProgrammeBudget.ceilingBefore &&
        request.budget.programmeCeilingAmendment === expectedProgrammeBudget.amendment &&
        request.budget.programmeCeilingAfter === expectedProgrammeBudget.ceilingAfter &&
        request.budget.programmeLedgerAfterMaximum === expectedProgrammeBudget.ledgerAfterMaximum &&
        (!(isActionRegisterConfirmationV3 || isActionRegisterConfirmationV4 || isActionRegisterConfirmationV5) ||
          request.budget.attemptAccountingRole ===
            'operational_execution_safeguard_only_not_scientific_endpoint_or_design_objective') &&
        request.budget.retryOrResumeAuthority === 'bounded_technical_recovery',
      `20 planned calls times three charged attempts gives 60 per dialogue and 2160 total; programme accounting remains an operational safeguard from ${expectedProgrammeBudget.ledgerBefore} to at most ${expectedProgrammeBudget.ledgerAfterMaximum} within ${expectedProgrammeBudget.ceilingAfter}`,
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
        recovery.programmeCeilingUnchanged === expectedProgrammeBudget.ceilingAfter,
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
  } else if (isActionRegisterConfirmation || isBoredomActionRegisterProofDag) {
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
  const exactApprovalStatement = isBoredomActionRegisterProofDag
    ? isBoredomActionRegisterProofDagV4
      ? `I approve ${path.relative(ROOT, requestPath)} at SHA-256 ${requestSha256} for one 36-dialogue Luna boredom matched-action warm-versus-plain proof-DAG confirmation with 18 dialogues per arm, scored by the independently pinned Sol V3 semantic instrument that passed all five predeclared gates on the sealed 55-case held-out v4 corpus, one predeclared two-sided exact conditional blocked analysis with fixed-sequence proof-progress testing, no interim analysis, no reuse or pooling of prior dialogues or outcomes including the stopped 71-reservation v2 cohort, a 2,160-attempt study safeguard and 5,000-attempt cumulative programme safeguard while both powered confirmations remain reserved, and bounded technical recovery authority for missing or failed units only within unchanged protected inputs and safeguards.`
      : isBoredomActionRegisterProofDagV3
        ? `No confirmation launch approval is available for ${path.relative(ROOT, requestPath)} at SHA-256 ${requestSha256}: the independently pinned Sol semantic adjudicator must first pass its predeclared frozen-failure, strong-negative, held-out sensitivity, specificity, agreement, and indeterminacy gates without changing the request, prompt, wrapper, or protected inputs.`
        : `I approve ${path.relative(ROOT, requestPath)} at SHA-256 ${requestSha256} for one 36-dialogue Luna boredom matched-action warm-versus-plain proof-DAG confirmation with 18 dialogues per arm, one predeclared two-sided exact conditional blocked analysis with fixed-sequence proof-progress testing, no interim analysis, no reuse or pooling of prior dialogues or outcomes, a 2,160-attempt study safeguard and ${isBoredomActionRegisterProofDagV2 ? '5,000' : '4,539'}-attempt cumulative programme safeguard while both powered confirmations remain reserved, and bounded technical recovery authority for missing or failed units only within unchanged protected inputs and safeguards.`
    : isActionRegisterConfirmation
      ? isActionRegisterConfirmationV5
        ? `Standing programme authority attachment SHA-256 538aa73239072ea618e2c8308edf562f1dd7495b78574e35a3db2f549302c1ce applies to ${requestRepoPath} at SHA-256 ${requestSha256}: one wholly fresh 36-dialogue Luna confirmation with 18 warm and 18 plain dialogues, a hard ceiling of 2,160 model attempts, one predeclared two-sided Fisher exact analysis, no interim analysis, no reuse or pooling of the 12 calibration dialogues or the incomplete V1, V3, or V4 confirmation blocks, and bounded technical recovery for missing or failed units only within the unchanged 5,000-attempt programme ceiling.`
        : isActionRegisterConfirmationV4
          ? `I approve ${requestRepoPath} at SHA-256 ${requestSha256} for one wholly fresh 36-dialogue Luna confirmation with 18 warm and 18 plain dialogues, a hard ceiling of 2,160 model attempts, one predeclared two-sided Fisher exact analysis, no interim analysis, no reuse or pooling of the 12 calibration dialogues or the incomplete V1 and V3 confirmation blocks, and bounded technical recovery authority for missing or failed units only within the unchanged 5,000-attempt programme ceiling.`
          : isActionRegisterConfirmationV3
            ? `I amend the resistance-action-register programme ceiling from 2,345 to 5,000 model attempts and approve ${requestRepoPath} at SHA-256 ${requestSha256} for one wholly fresh 36-dialogue Luna confirmation with 18 warm and 18 plain dialogues, a hard ceiling of 2,160 model attempts, one predeclared two-sided Fisher exact analysis, no interim analysis, no reuse or pooling of the 12 calibration dialogues or the incomplete V1 confirmation block, and bounded technical recovery authority for missing or failed units only within the unchanged 5,000-attempt programme ceiling.`
            : isActionRegisterConfirmationSuccessor
              ? `I amend the resistance-action-register programme ceiling from 2,345 to 2,379 model attempts and approve ${requestRepoPath} at SHA-256 ${requestSha256} for one wholly fresh 36-dialogue Luna confirmation with 18 warm and 18 plain dialogues, a hard ceiling of 2,160 model attempts, one predeclared two-sided Fisher exact analysis, no interim analysis, no reuse or pooling of the 12 calibration dialogues or the incomplete V1 confirmation block, and bounded technical recovery authority for missing or failed units only within the unchanged 2,379-attempt programme ceiling.`
              : `I amend the resistance-action-register programme ceiling from 1,200 to 2,345 model attempts and approve ${requestRepoPath} at SHA-256 ${requestSha256} for one 36-dialogue Luna confirmation with 18 warm and 18 plain dialogues, a hard ceiling of 2,160 model attempts, one predeclared two-sided Fisher exact analysis, no interim analysis, no reuse or pooling of the 12 calibration dialogues, and bounded technical recovery authority for missing or failed units only within the unchanged 2,345-attempt programme ceiling.`
      : isResistanceRecoverySemanticValidation
        ? `Standing architectural correction SHA-256 dae9091d4f2584d416d7765e66d47acba03a33264886a6fa0a1eba45857c05f4 applies to ${requestRepoPath} at SHA-256 ${requestSha256}: one frozen blinded 120-case ${isResistanceRecoverySemanticValidationV2 ? 'corrected-v2 complete-public-horizon ' : ''}recovery-and-treatment-fidelity semantic-instrument validation with exactly two independent judges per case, a hard ceiling of 720 model-attempt reservations, no gold in execution packets, no recall of a completed or ambiguously dispatched judge, no replacement or selection, and no confirmation or efficacy claim.`
        : isResistanceSemanticValidation
          ? `Standing architectural correction SHA-256 dae9091d4f2584d416d7765e66d47acba03a33264886a6fa0a1eba45857c05f4 applies to ${requestRepoPath} at SHA-256 ${requestSha256}: one frozen blinded 80-case resistance semantic-instrument validation with exactly two independent judges per case, a hard ceiling of 480 model-attempt reservations, no gold in execution packets, no recall of a completed or ambiguously dispatched judge, no replacement or selection, and no confirmation or efficacy claim.`
          : `I approve ${requestRepoPath} at SHA-256 ${requestSha256} for one ` +
            `${request.design.dialogues}-dialogue Luna ${isReplacement ? 'replacement study' : isActionRegisterAnalysisOnly ? 'sealed action/register baseline analysis' : isActionRegisterBaseline ? 'action/register baseline' : 'study'}, ` +
            `with a hard ceiling of ${request.budget.maximumPlannedModelAttempts} model attempts and ${recoveryAuthorityClause}`;

  return {
    schema: 'machinespirits.tutor-stub.resistant-profile-discrimination-study-go-request-report.v1',
    status: request.status,
    requestPath: requestRepoPath,
    requestSha256,
    launchCommit: request.source.launchCommit,
    launchTree: request.source.launchTree,
    sourceCommitObjectAvailable: sourceAudit.available,
    packetValid: true,
    readyForExplicitHumanApproval: !isBoredomActionRegisterProofDagV3 && (!isReplacement || priorArtifactsAvailable),
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
