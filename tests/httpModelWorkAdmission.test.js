import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  admitFixedModelCalls,
  assertHttpModelWorkPolicyInventory,
  createModelCallBudget,
  HTTP_MODEL_WORK_ENDPOINT_POLICIES,
} from '../services/httpModelWorkAdmission.js';
import {
  createExactEvaluationAdmissionMiddleware,
  createFixedModelCallAdmissionMiddleware,
  createPromptRecommendationAdmissionMiddleware,
} from '../routes/evalRoutes.js';
import { createLegacyChatAdmissionMiddleware } from '../services/legacyChatCompatibilityRouter.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function responseDouble() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function requestDouble({ body = {}, query = {}, aborted = false, destroyed = false } = {}) {
  return {
    body,
    query,
    headers: {},
    aborted,
    destroyed,
    get() {
      return undefined;
    },
  };
}

async function invokeMiddleware(middleware, req) {
  const res = responseDouble();
  let nextCalls = 0;
  await middleware(req, res, () => {
    nextCalls += 1;
  });
  return { req, res, nextCalls };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertRoutePreHandler(source, { method, routePath, middleware }) {
  const routePattern = new RegExp(
    `router\\.${method}\\(\\s*['"]${escapeRegExp(routePath)}['"]\\s*,\\s*${escapeRegExp(middleware)}`,
  );
  assert.match(source, routePattern, `missing pre-handler admission marker: ${method.toUpperCase()} ${routePath}`);
}

describe('fixed model-call admission', () => {
  it('rejects malformed, oversized, unconfirmed, and mismatched plans before model allocation', () => {
    const cases = [
      {
        input: null,
        options: { endpoint: '/api/chat/assist', plannedModelCallLimit: 2 },
        code: 'invalid_request_schema',
      },
      {
        input: {},
        options: { endpoint: '/api/chat/assist', plannedModelCallLimit: 2 },
        code: 'model_call_confirmation_required',
      },
      {
        input: { confirmModelCallLimit: 1 },
        options: { endpoint: '/api/chat/assist', plannedModelCallLimit: 2 },
        code: 'model_call_confirmation_mismatch',
      },
      {
        input: { dryRun: true },
        options: { endpoint: '/api/eval/stream/interact', plannedModelCallLimit: 49, maxModelCalls: 48 },
        code: 'model_call_plan_too_large',
      },
    ];

    for (const testCase of cases) {
      assert.throws(
        () => admitFixedModelCalls(testCase.input, testCase.options),
        (error) => error.code === testCase.code,
      );
    }
  });

  it('freezes provenance and fails closed when the admitted call limit is exhausted', () => {
    const plan = admitFixedModelCalls(
      { confirmModelCallLimit: 2 },
      { endpoint: '/api/chat/assist', plannedModelCallLimit: 2, now: () => '2026-07-23T00:00:00.000Z' },
    );
    assert.equal(Object.isFrozen(plan), true);
    assert.equal(plan.confirmation, 'exact_call_limit');
    assert.match(plan.requestHash, /^[a-f0-9]{64}$/);

    const budget = createModelCallBudget(plan);
    assert.equal(budget.reserve('first'), 1);
    assert.equal(budget.reserve('second'), 2);
    assert.throws(
      () => budget.reserve('third'),
      (error) => error.code === 'model_call_budget_exhausted',
    );
    assert.deepEqual(budget.snapshot(), {
      plannedModelCallLimit: 2,
      usedModelCalls: 2,
      remainingModelCalls: 0,
    });
  });
});

describe('route admission middleware', () => {
  it('rejects unknown, unconfirmed, disconnected, and duplicate exact-plan requests with zero next calls', async () => {
    const middleware = createExactEvaluationAdmissionMiddleware({
      endpoint: '/api/eval/stream/run',
      buildInput: (req) => req.body,
      profileRegistry: ['budget'],
      scenarioRegistry: ['first'],
      maxPlannedTests: 4,
      privilegedOverride: false,
    });
    const cases = [
      { req: requestDouble({ body: { profiles: ['unknown'], scenarios: ['first'], dryRun: true } }), status: 422 },
      { req: requestDouble({ body: { profiles: ['budget'], scenarios: ['first'] } }), status: 428 },
      {
        req: requestDouble({
          body: { profiles: ['budget'], scenarios: ['first'], dryRun: true },
          aborted: true,
        }),
        status: 499,
      },
    ];
    for (const testCase of cases) {
      const result = await invokeMiddleware(middleware, testCase.req);
      assert.equal(result.res.statusCode, testCase.status);
      assert.equal(result.nextCalls, 0);
    }

    const admitted = requestDouble({ body: { profiles: ['budget'], scenarios: ['first'], dryRun: true } });
    assert.equal((await invokeMiddleware(middleware, admitted)).nextCalls, 1);
    assert.equal(admitted.reserveEvaluationTest('first'), 1);
    assert.throws(
      () => admitted.reserveEvaluationTest('duplicate'),
      (error) => error.code === 'evaluation_test_budget_exhausted',
    );
    const duplicate = await invokeMiddleware(middleware, admitted);
    assert.equal(duplicate.res.statusCode, 409);
    assert.equal(duplicate.nextCalls, 0);

    const disconnected = requestDouble({ body: { profiles: ['budget'], scenarios: ['first'], dryRun: true } });
    assert.equal((await invokeMiddleware(middleware, disconnected)).nextCalls, 1);
    disconnected.aborted = true;
    assert.throws(
      () => disconnected.reserveEvaluationTest('after_disconnect'),
      (error) => error.code === 'client_closed_request',
    );
  });

  it('short-circuits fixed-call dry runs and blocks oversized interactions before SSE setup', async () => {
    const middleware = createFixedModelCallAdmissionMiddleware({
      endpoint: '/api/eval/stream/interact',
      buildInput: (req) => req.body,
      plannedModelCallLimit: (_req, input) => input.turns * 6 + 3,
      maxModelCalls: 48,
      privilegedOverride: false,
      shortCircuitDryRun: true,
    });

    const dryRun = await invokeMiddleware(middleware, requestDouble({ body: { dryRun: true, turns: 5 } }));
    assert.equal(dryRun.res.statusCode, 200);
    assert.equal(dryRun.res.body.dryRun, true);
    assert.equal(dryRun.nextCalls, 0);

    const oversized = await invokeMiddleware(middleware, requestDouble({ body: { dryRun: true, turns: 8 } }));
    assert.equal(oversized.res.statusCode, 413);
    assert.equal(oversized.nextCalls, 0);
  });

  it('requires both admitted components for fresh prompt recommendations', async () => {
    const middleware = createPromptRecommendationAdmissionMiddleware({
      profileRegistry: ['budget'],
      scenarioRegistry: ['first', 'second'],
      maxPlannedTests: 4,
      maxModelCalls: 4,
    });
    const unconfirmed = await invokeMiddleware(
      middleware,
      requestDouble({ body: { profile: 'budget', scenarios: ['first'] } }),
    );
    assert.equal(unconfirmed.res.statusCode, 428);
    assert.equal(unconfirmed.nextCalls, 0);

    const admitted = await invokeMiddleware(
      middleware,
      requestDouble({
        body: {
          profile: 'budget',
          scenarios: ['first', 'second'],
          confirmTestCount: 2,
          confirmModelCallLimit: 1,
        },
      }),
    );
    assert.equal(admitted.nextCalls, 1);
    assert.equal(admitted.req.evaluationAdmission.plannedTestCount, 2);
    assert.equal(admitted.req.modelWorkAdmission.plannedModelCallLimit, 1);
  });

  it('applies the same fixed-call contract to legacy chat routes', async () => {
    const middleware = createLegacyChatAdmissionMiddleware({
      endpoint: '/api/chat/assist',
      plannedModelCallLimit: () => 2,
    });
    const rejected = await invokeMiddleware(middleware, requestDouble({ body: {} }));
    assert.equal(rejected.res.statusCode, 428);
    assert.equal(rejected.nextCalls, 0);

    const admitted = await invokeMiddleware(middleware, requestDouble({ body: { confirmModelCallLimit: 2 } }));
    assert.equal(admitted.nextCalls, 1);
    assert.equal(admitted.req.modelWorkAdmission.plannedModelCallLimit, 2);
  });
});

describe('HTTP model-work endpoint inventory', () => {
  it('is unique, valid, and covers every route with direct model-work launch symbols', () => {
    assert.equal(assertHttpModelWorkPolicyInventory(), true);
    const policyKeys = new Set(HTTP_MODEL_WORK_ENDPOINT_POLICIES.map((policy) => `${policy.method} ${policy.path}`));

    const expected = [
      'POST /api/eval/run',
      'POST /api/eval/compare',
      'POST /api/eval/quick',
      'GET /api/eval/stream/quick',
      'POST /api/eval/matrix',
      'GET /api/eval/stream/matrix',
      'GET /api/eval/stream/run',
      'GET /api/eval/stream/recognition-ab',
      'POST /api/eval/prompts/recommend',
      'GET /api/eval/stream/interact',
      'POST /api/chat/assist',
      'POST /api/chat/learner-turn',
      'POST /api/chat/turn',
    ];
    for (const key of expected) assert.ok(policyKeys.has(key), `missing policy for ${key}`);

    const evalSource = readFileSync(path.join(ROOT, 'routes', 'evalRoutes.js'), 'utf8');
    const chatSource = readFileSync(path.join(ROOT, 'services', 'legacyChatCompatibilityRouter.js'), 'utf8');
    const discoverDirectLaunchRoutes = (source, prefix, launchPattern) => {
      const declarations = [...source.matchAll(/router\.(get|post)\(\s*['"]([^'"]+)['"]/g)];
      return declarations
        .filter((match, index) => {
          const end = declarations[index + 1]?.index ?? source.length;
          return launchPattern.test(source.slice(match.index, end));
        })
        .map((match) => `${match[1].toUpperCase()} ${prefix}${match[2]}`);
    };
    const discovered = [
      ...discoverDirectLaunchRoutes(
        evalSource,
        '/api/eval',
        /evaluationRunner\.quickTest|interactionEngine\.runInteraction|promptRecommendationService\.generateRecommendations/,
      ),
      ...discoverDirectLaunchRoutes(
        chatSource,
        '/api/chat',
        /callModel\(|callCli\(|generateLearnerResponse\(|runTutorTurn\(|streamSingleAgentTurn\(/,
      ),
    ];
    for (const key of discovered) assert.ok(policyKeys.has(key), `direct launch route has no policy: ${key}`);

    for (const [method, routePath, middleware] of [
      ['post', '/quick', 'createExactEvaluationAdmissionMiddleware'],
      ['get', '/stream/quick', 'createExactEvaluationAdmissionMiddleware'],
      ['post', '/matrix', 'createExactEvaluationAdmissionMiddleware'],
      ['get', '/stream/matrix', 'createExactEvaluationAdmissionMiddleware'],
      ['get', '/stream/run', 'createExactEvaluationAdmissionMiddleware'],
      ['get', '/stream/recognition-ab', 'createExactEvaluationAdmissionMiddleware'],
      ['get', '/stream/interact', 'createFixedModelCallAdmissionMiddleware'],
      ['post', '/prompts/recommend', 'createPromptRecommendationAdmissionMiddleware()'],
    ]) {
      assertRoutePreHandler(evalSource, { method, routePath, middleware });
    }
    for (const marker of [
      "'/assist',\n  createLegacyChatAdmissionMiddleware",
      "'/learner-turn',\n  createLegacyChatAdmissionMiddleware",
      "'/turn',\n  createLegacyChatAdmissionMiddleware",
    ]) {
      assert.ok(chatSource.includes(marker), `missing chat admission marker: ${marker}`);
    }
  });
});
