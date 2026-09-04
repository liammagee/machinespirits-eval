import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { runTutorStubResistantProfileRouteCanaryCommand } from '../scripts/run-tutor-stub-resistant-profile-route-canary.js';
import {
  executeTutorStubResistantProfileRouteCanary,
  resistantProfileRouteCanaryFileSha256,
  validateTutorStubResistantProfileRouteCanaryAuthorization,
  validateTutorStubResistantProfileRouteCanaryRequest,
} from '../services/tutorStubResistantProfileRouteCanary.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REQUEST_PATH = 'config/tutor-stub-resistant-profile-route-canary-request.v1.json';

function readRequest() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, REQUEST_PATH), 'utf8'));
}

function readCurrentSourceFixture() {
  const request = readRequest();
  // The closure names this service's own source. Recompute it here too, so an edit
  // to the canary does not read as a drifted fixture.
  for (const sourcePath of [
    'services/cliProviderBridge.js',
    'config/providers.yaml',
    'services/tutorStubResistantProfileRouteCanary.js',
  ]) {
    const entry = request.sourceClosure.find((candidate) => candidate.path === sourcePath);
    entry.sha256 = createHash('sha256')
      .update(fs.readFileSync(path.join(ROOT, entry.path)))
      .digest('hex');
  }
  return request;
}

function passingBridgeResult(overrides = {}) {
  return {
    text: '{"route_status":"ROUTE_OK"}',
    provider: 'codex',
    model: 'gpt-5.6-luna',
    effort: 'low',
    structuredOutput: true,
    prohibitedToolEventCount: 0,
    modelAttestationBasis: 'explicit_cli_model_argument_accepted_bridge_echo',
    modelIndependentlyAttested: false,
    codexCliVersion: 'test-only',
    ...overrides,
  };
}

test('consumed route-canary request records the drift after the provider bridge evolves', () => {
  const request = readRequest();
  const validation = validateTutorStubResistantProfileRouteCanaryRequest(request, { root: ROOT });
  const record = validation.digestRecords.find((row) => row.path === 'services/cliProviderBridge.js');
  assert.equal(record.drifted, true);
  assert.notEqual(record.observedSha256, record.recordedSha256);
});

test('current-source route-canary fixture pins the shared Luna route and complete closure', () => {
  const request = readCurrentSourceFixture();
  const result = validateTutorStubResistantProfileRouteCanaryRequest(request, { root: ROOT });

  assert.equal(result.modelRef, 'codex.gpt-5.6-luna');
  assert.equal(result.provider, 'codex');
  assert.equal(result.model, 'gpt-5.6-luna');
  assert.deepEqual(result.roles, ['tutor', 'analysis', 'learner']);
  assert.equal(request.scope.maximumModelCalls, 1);
  assert.equal(request.scope.retryOrResumeAuthority, 'none');
  assert.equal(request.scope.liveStudyAuthorized, false);
  assert.equal(request.payload.trainingReuseStatus, 'not_applicable');
  assert.ok(result.sourceClosure.every((entry) => entry.sha256 === entry.observedSha256));
});

test('default route-canary command plans the consumed request without any call or write', async () => {
  let calls = 0;
  const plan = await runTutorStubResistantProfileRouteCanaryCommand(
    { request: REQUEST_PATH, execute: false },
    {
      root: ROOT,
      callModel: async () => {
        calls += 1;
        return passingBridgeResult();
      },
    },
  );
  assert.equal(plan.status, 'HOLD');
  assert.equal(plan.modelCalls, 0);
  assert.equal(plan.artifactWrites, 0);
  assert.equal(calls, 0);
});

test('execution request records the stale source closure and calls nothing', async () => {
  let calls = 0;
  await assert.rejects(
    runTutorStubResistantProfileRouteCanaryCommand(
      {
        request: REQUEST_PATH,
        execute: true,
        acceptOneModelCall: true,
        authorization: '',
      },
      {
        root: ROOT,
        callModel: async () => {
          calls += 1;
          return passingBridgeResult();
        },
      },
    ),
    /--authorization is required/u,
  );
  assert.equal(calls, 0);
  const record = validateTutorStubResistantProfileRouteCanaryRequest(readRequest(), {
    root: ROOT,
  }).digestRecords.find((row) => row.path === 'services/cliProviderBridge.js');
  assert.equal(record.drifted, true);
});

test('pure route-canary execution calls the bridge exactly once and records the attestation limit', async () => {
  const request = readCurrentSourceFixture();
  let calls = 0;
  const report = await executeTutorStubResistantProfileRouteCanary({
    request,
    root: ROOT,
    now: () => '2026-08-19T00:00:00.000Z',
    callModel: async (agent, system, user, role, options) => {
      calls += 1;
      assert.deepEqual(agent, { provider: 'codex', model: 'gpt-5.6-luna' });
      assert.equal(system, request.prompt.system);
      assert.equal(user, request.prompt.user);
      assert.equal(role, 'resistant-profile-route-canary');
      assert.equal(options.effort, 'low');
      assert.deepEqual(options.outputSchema, request.prompt.outputSchema);
      return passingBridgeResult();
    },
  });

  assert.equal(calls, 1);
  assert.equal(report.status, 'passed');
  assert.equal(report.modelCalls, 1);
  assert.equal(report.observed.modelIndependentlyAttested, false);
  assert.match(report.interpretation, /not independently attested/u);
});

test('route canary fails closed on response, route, transport, or tool-policy drift without retrying', async () => {
  const scenarios = [
    { text: '{"route_status":"NO"}' },
    { provider: 'openai' },
    { model: 'gpt-5.6-sol' },
    { effort: 'medium' },
    { structuredOutput: false },
    { prohibitedToolEventCount: 1 },
    { modelAttestationBasis: 'cli_default_not_independently_attested' },
    { modelIndependentlyAttested: true },
  ];

  for (const overrides of scenarios) {
    let calls = 0;
    await assert.rejects(
      executeTutorStubResistantProfileRouteCanary({
        request: readCurrentSourceFixture(),
        root: ROOT,
        callModel: async () => {
          calls += 1;
          return passingBridgeResult(overrides);
        },
      }),
      /route canary refuses/u,
    );
    assert.equal(calls, 1);
  }
});

test('authorization binds exact request bytes and grants one canary call but no live study', () => {
  const request = readRequest();
  const requestSha256 = resistantProfileRouteCanaryFileSha256(path.join(ROOT, REQUEST_PATH));
  const authorization = {
    schema: 'machinespirits.tutor-stub.resistant-profile-route-canary-authorization.v1',
    status: 'APPROVED_FOR_ONE_ROUTE_CANARY_CALL',
    studyId: request.studyId,
    request: { path: REQUEST_PATH, sha256: requestSha256 },
    scope: {
      maximumModelCalls: 1,
      modelRef: request.route.modelRef,
      effort: request.route.effort,
      artifactRoot: request.artifactRoot,
      liveStudyAuthorized: false,
    },
    approval: {
      explicitOneModelCall: true,
      approvedBy: 'human',
      approvedAt: '2026-08-19T00:00:00.000Z',
    },
  };

  assert.equal(
    validateTutorStubResistantProfileRouteCanaryAuthorization({
      authorization,
      request,
      requestPath: REQUEST_PATH,
      requestSha256,
    }),
    true,
  );
  authorization.request.sha256 = '0'.repeat(64);
  assert.throws(
    () =>
      validateTutorStubResistantProfileRouteCanaryAuthorization({
        authorization,
        request,
        requestPath: REQUEST_PATH,
        requestSha256,
      }),
    /authorization request SHA mismatch/u,
  );
});
