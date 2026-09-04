import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { callAIWithCliBridge } from './cliProviderBridge.js';
import { resolveModel } from './evalConfigLoader.js';
import { recordFileDigest } from './recordedFileDigest.js';

// Sealed data keeps its byte pin; code, schemas and registrations are recorded.
// This closure carries no sealed file today, and the guard says what happens
// if one is added.
const SEALED_SOURCE_CLOSURE_PATH = /heldout|held-out|development-corpus|blind-read|certificate/u;

export const RESISTANT_PROFILE_ROUTE_CANARY_SCHEMA =
  'machinespirits.tutor-stub.resistant-profile-route-canary-request.v1';
export const RESISTANT_PROFILE_ROUTE_CANARY_AUTHORIZATION_SCHEMA =
  'machinespirits.tutor-stub.resistant-profile-route-canary-authorization.v1';
export const RESISTANT_PROFILE_ROUTE_CANARY_RESULT_SCHEMA =
  'machinespirits.tutor-stub.resistant-profile-route-canary-result.v1';
export const RESISTANT_PROFILE_ROUTE_CANARY_RESPONSE_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  properties: {
    route_status: { type: 'string', enum: ['ROUTE_OK'] },
  },
  required: ['route_status'],
});

const EXPECTED_ATTESTATION_BASIS = 'explicit_cli_model_argument_accepted_bridge_echo';
const EXPECTED_ROLES = Object.freeze(['tutor', 'analysis', 'learner']);

export function resistantProfileRouteCanarySha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function resistantProfileRouteCanaryFileSha256(filePath) {
  return resistantProfileRouteCanarySha256(fs.readFileSync(filePath));
}

function assert(condition, message) {
  if (!condition) throw new Error(`route canary refuses: ${message}`);
}

function assertSha256(value, label) {
  assert(/^[0-9a-f]{64}$/u.test(String(value || '')), `${label} must be a lowercase SHA-256 digest`);
}

function resolveRepositoryFile(root, relativePath, label) {
  assert(typeof relativePath === 'string' && relativePath.length > 0, `${label} path is required`);
  assert(!path.isAbsolute(relativePath), `${label} path must be repository-relative`);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  assert(resolved.startsWith(`${resolvedRoot}${path.sep}`), `${label} path escapes the repository`);
  assert(fs.existsSync(resolved) && fs.statSync(resolved).isFile(), `${label} file is missing: ${relativePath}`);
  return resolved;
}

export function validateTutorStubResistantProfileRouteCanaryRequest(
  request,
  { root = path.resolve('.'), resolveModelRef = resolveModel, verifySourceClosure = true } = {},
) {
  assert(request?.schema === RESISTANT_PROFILE_ROUTE_CANARY_SCHEMA, 'request schema mismatch');
  assert(request.status === 'HOLD_PENDING_EXPLICIT_APPROVAL', 'request must retain HOLD_PENDING_EXPLICIT_APPROVAL');
  assert(request.studyId === 'tutor-stub-resistant-profile-discrimination-v1', 'study id mismatch');
  assert(request.route?.modelRef === 'codex.gpt-5.6-luna', 'model route must be codex.gpt-5.6-luna');
  assert(request.route?.provider === 'codex', 'provider must be codex');
  assert(request.route?.model === 'gpt-5.6-luna', 'model must be gpt-5.6-luna');
  assert(request.route?.effort === 'low', 'reasoning effort must be low');
  assert(request.route?.timeoutMs === 120000, 'timeout must remain 120000ms');
  assert(request.route?.maxStdoutBytes === 1048576, 'stdout limit must remain 1 MiB');
  assert(request.route?.maxStderrBytes === 262144, 'stderr limit must remain 256 KiB');
  assert(
    JSON.stringify(request.route?.roles) === JSON.stringify(EXPECTED_ROLES),
    'route roles must be tutor, analysis, learner',
  );

  const resolved = resolveModelRef(request.route.modelRef);
  assert(resolved?.provider === request.route.provider, 'resolved provider differs from request');
  assert(resolved?.model === request.route.model, 'resolved model differs from request');
  assert(resolved?.isConfigured === true, 'requested CLI model route is not configured');

  assert(request.scope?.maximumModelCalls === 1, 'maximum model-call scope must be exactly one');
  assert(request.scope?.retryOrResumeAuthority === 'none', 'retry or resume authority must be none');
  assert(request.scope?.liveStudyAuthorized === false, 'the route canary must not authorize the live study');
  assert(request.authorization === null, 'the request must not embed or inherit authorization');
  assert(request.payload?.humanSubjectData === false, 'human-subject data is forbidden');
  assert(request.payload?.privateArchiveData === false, 'private-archive data is forbidden');
  assert(request.payload?.trainingReuseStatus === 'not_applicable', 'training reuse must be not_applicable');
  assert(request.prompt?.system === 'Return the single requested route-status object.', 'system prompt drift');
  assert(request.prompt?.user === 'Confirm this model route by returning ROUTE_OK.', 'user prompt drift');
  assert(
    JSON.stringify(request.prompt?.outputSchema) === JSON.stringify(RESISTANT_PROFILE_ROUTE_CANARY_RESPONSE_SCHEMA),
    'structured-output schema drift',
  );
  assert(
    typeof request.artifactRoot === 'string' &&
      request.artifactRoot.startsWith('.tutor-stub-auto-eval/resistant-profile-discrimination-v1-route-canary-'),
    'artifact root is outside the ignored study namespace',
  );
  assert(
    !path.isAbsolute(request.artifactRoot) && !request.artifactRoot.includes('..'),
    'artifact root must be contained',
  );
  assert(Array.isArray(request.sourceClosure) && request.sourceClosure.length >= 6, 'source closure is incomplete');

  const seen = new Set();
  const digestRecords = [];
  const sourceClosure = request.sourceClosure.map((entry) => {
    assert(entry && typeof entry === 'object', 'source-closure entry must be an object');
    assert(!seen.has(entry.path), `duplicate source-closure path: ${entry.path}`);
    seen.add(entry.path);
    assertSha256(entry.sha256, `source closure ${entry.path}`);
    const resolvedPath = resolveRepositoryFile(root, entry.path, 'source-closure');
    const observedSha256 = resistantProfileRouteCanaryFileSha256(resolvedPath);
    if (verifySourceClosure && SEALED_SOURCE_CLOSURE_PATH.test(entry.path)) {
      assert(observedSha256 === entry.sha256, `source-closure SHA mismatch: ${entry.path}`);
    } else if (verifySourceClosure) {
      digestRecords.push(
        recordFileDigest({
          root,
          filePath: entry.path,
          recordedSha256: entry.sha256,
          label: 'source closure',
        }),
      );
    }
    return { path: entry.path, sha256: entry.sha256, observedSha256 };
  });

  for (const requiredPath of [
    'services/tutorStubResistantProfileRouteCanary.js',
    'scripts/run-tutor-stub-resistant-profile-route-canary.js',
    'services/cliProviderBridge.js',
    'services/evalConfigLoader.js',
    'config/providers.yaml',
    'config/tutor-stub-resistant-profile-discrimination-registration.v1.json',
    'config/tutor-stub-resistant-profile-discrimination-live-readiness.hold.v1.json',
  ]) {
    assert(seen.has(requiredPath), `source closure is missing ${requiredPath}`);
  }

  return {
    provider: resolved.provider,
    model: resolved.model,
    modelRef: request.route.modelRef,
    roles: [...EXPECTED_ROLES],
    sourceClosure,
    digestRecords,
  };
}

export function validateTutorStubResistantProfileRouteCanaryAuthorization({
  authorization,
  request,
  requestPath,
  requestSha256,
}) {
  assert(
    authorization?.schema === RESISTANT_PROFILE_ROUTE_CANARY_AUTHORIZATION_SCHEMA,
    'authorization schema mismatch',
  );
  assert(authorization.status === 'APPROVED_FOR_ONE_ROUTE_CANARY_CALL', 'authorization status mismatch');
  assert(authorization.studyId === request.studyId, 'authorization study id mismatch');
  assert(authorization.request?.path === requestPath, 'authorization request path mismatch');
  assertSha256(authorization.request?.sha256, 'authorization request');
  assert(authorization.request.sha256 === requestSha256, 'authorization request SHA mismatch');
  assert(authorization.scope?.maximumModelCalls === 1, 'authorization must permit exactly one model call');
  assert(authorization.scope?.modelRef === request.route.modelRef, 'authorization model route mismatch');
  assert(authorization.scope?.effort === request.route.effort, 'authorization effort mismatch');
  assert(authorization.scope?.artifactRoot === request.artifactRoot, 'authorization artifact root mismatch');
  assert(authorization.scope?.liveStudyAuthorized === false, 'authorization must not approve the live study');
  assert(authorization.approval?.explicitOneModelCall === true, 'explicit one-call approval is absent');
  assert(authorization.approval?.approvedBy === 'human', 'authorization must record human approval');
  assert(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(authorization.approval?.approvedAt || ''),
    'authorization approval timestamp must be UTC ISO-8601',
  );
  return true;
}

function parseRouteResponse(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text || ''));
  } catch {
    throw new Error('route canary refuses: model response is not exact JSON');
  }
  assert(
    parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      Object.keys(parsed).length === 1 &&
      parsed.route_status === 'ROUTE_OK',
    'model response does not satisfy the sealed ROUTE_OK schema',
  );
  return parsed;
}

export async function executeTutorStubResistantProfileRouteCanary({
  request,
  root = path.resolve('.'),
  callModel = callAIWithCliBridge,
  now = () => new Date().toISOString(),
} = {}) {
  const validation = validateTutorStubResistantProfileRouteCanaryRequest(request, { root });
  let calls = 0;
  const invokeOnce = async () => {
    calls += 1;
    assert(calls <= request.scope.maximumModelCalls, 'model-call ceiling exceeded');
    return callModel(
      { provider: validation.provider, model: validation.model },
      request.prompt.system,
      request.prompt.user,
      'resistant-profile-route-canary',
      {
        effort: request.route.effort,
        timeoutMs: request.route.timeoutMs,
        maxStdoutBytes: request.route.maxStdoutBytes,
        maxStderrBytes: request.route.maxStderrBytes,
        outputSchema: request.prompt.outputSchema,
      },
    );
  };

  const result = await invokeOnce();
  parseRouteResponse(result?.text);
  assert(result?.provider === validation.provider, 'observed provider differs from requested provider');
  assert(result?.model === validation.model, 'observed model differs from requested model');
  assert(result?.effort === request.route.effort, 'observed effort differs from requested effort');
  assert(result?.structuredOutput === true, 'structured-output transport was not active');
  assert(result?.prohibitedToolEventCount === 0, 'provider emitted a prohibited tool event');
  assert(result?.modelAttestationBasis === EXPECTED_ATTESTATION_BASIS, 'model attestation basis mismatch');
  assert(result?.modelIndependentlyAttested === false, 'unexpected independent-attestation claim');

  return {
    schema: RESISTANT_PROFILE_ROUTE_CANARY_RESULT_SCHEMA,
    status: 'passed',
    studyId: request.studyId,
    completedAt: now(),
    modelCalls: calls,
    retryOrResumeAuthority: 'none',
    requested: {
      modelRef: validation.modelRef,
      provider: validation.provider,
      model: validation.model,
      roles: validation.roles,
      effort: request.route.effort,
    },
    observed: {
      provider: result.provider,
      model: result.model,
      effort: result.effort,
      structuredOutput: result.structuredOutput,
      prohibitedToolEventCount: result.prohibitedToolEventCount,
      modelAttestationBasis: result.modelAttestationBasis,
      modelIndependentlyAttested: result.modelIndependentlyAttested,
      codexCliVersion: result.codexCliVersion ?? null,
    },
    interpretation:
      'The explicit CLI model argument was accepted and echoed by the bridge; server-side model identity is not independently attested.',
  };
}
