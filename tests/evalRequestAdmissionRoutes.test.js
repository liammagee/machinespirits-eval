import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createMeteredEvaluationHandlers } from '../routes/evalRoutes.js';

const profileRegistry = ['budget', 'quality', 'experimental'];
const scenarioRegistry = ['first', 'second'];

function mockResponse() {
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

function fakeRunner() {
  const calls = { run: [], compare: [] };
  return {
    calls,
    async runEvaluation(options) {
      calls.run.push(options);
      return {
        runId: 'eval-admitted-run',
        totalTests: options.admissionPlan.plannedTestCount,
        successfulTests: options.admissionPlan.plannedTestCount,
        stats: [],
        scenarioStats: [],
      };
    },
    async compareConfigurations(configurations, options) {
      calls.compare.push({ configurations, options });
      return { runId: 'eval-admitted-compare', rankings: [], scenarioBreakdown: [] };
    },
  };
}

function handlers(runner, overrides = {}) {
  return createMeteredEvaluationHandlers({
    runner,
    profileRegistry,
    scenarioRegistry,
    maxPlannedTests: 6,
    privilegedOverride: false,
    ...overrides,
  });
}

async function invoke(handler, body, headers = {}) {
  const req = {
    body,
    headers,
    get(name) {
      return headers[String(name).toLowerCase()];
    },
  };
  const res = mockResponse();
  await handler(req, res);
  return res;
}

describe('metered evaluation route admission', () => {
  it('rejects malformed, unknown, oversized, and unconfirmed run plans with zero runner calls', async () => {
    const runner = fakeRunner();
    const { run } = handlers(runner);
    const cases = [
      {
        body: { profiles: 'budget', scenarios: ['first'], dryRun: true },
        status: 400,
        code: 'invalid_request_schema',
      },
      {
        body: { profiles: ['unknown'], scenarios: ['first'], dryRun: true },
        status: 422,
        code: 'unknown_registry_value',
      },
      {
        body: { profiles: ['budget', 'quality'], scenarios: ['first', 'second'], runsPerConfig: 2, dryRun: true },
        status: 413,
        code: 'evaluation_plan_too_large',
      },
      {
        body: { profiles: ['budget'], scenarios: ['first'], runsPerConfig: 1 },
        status: 428,
        code: 'evaluation_confirmation_required',
      },
      {
        body: { profiles: ['budget'], scenarios: ['first'], runsPerConfig: 1, confirmTestCount: 2 },
        status: 422,
        code: 'evaluation_confirmation_mismatch',
      },
    ];

    for (const testCase of cases) {
      const response = await invoke(run, testCase.body);
      assert.equal(response.statusCode, testCase.status);
      assert.equal(response.body.code, testCase.code);
    }
    assert.equal(runner.calls.run.length, 0);
    assert.equal(runner.calls.compare.length, 0);
  });

  it('passes an exact frozen admission plan into a dry-run evaluation', async () => {
    const runner = fakeRunner();
    const { run } = handlers(runner);
    const response = await invoke(run, {
      profiles: ['budget'],
      scenarios: ['first', 'second'],
      runsPerConfig: 2,
      dryRun: true,
      skipRubric: true,
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.plannedTestCount, 4);
    assert.equal(runner.calls.run.length, 1);
    const options = runner.calls.run[0];
    assert.deepEqual(options.scenarios, ['first', 'second']);
    assert.deepEqual(options.configurations, [{ profileName: 'budget', label: 'budget' }]);
    assert.equal(options.runsPerConfig, 2);
    assert.equal(options.skipRubricEval, true);
    assert.equal(options.admissionPlan.plannedTestCount, 4);
    assert.equal(Object.isFrozen(options.admissionPlan), true);
  });

  it('requires two unique profiles for compare and admits an exactly confirmed paid plan', async () => {
    const runner = fakeRunner();
    const { compare } = handlers(runner);
    const rejected = await invoke(compare, {
      profiles: ['budget'],
      scenarios: ['first'],
      dryRun: true,
    });
    assert.equal(rejected.statusCode, 422);
    assert.equal(rejected.body.code, 'insufficient_profiles');
    assert.equal(runner.calls.compare.length, 0);

    const accepted = await invoke(compare, {
      profiles: ['budget', 'quality'],
      scenarios: ['first', 'second'],
      runsPerConfig: 1,
      skipRubric: true,
      confirmTestCount: 4,
    });
    assert.equal(accepted.statusCode, 200);
    assert.equal(accepted.body.plannedTestCount, 4);
    assert.equal(runner.calls.compare.length, 1);
    assert.deepEqual(runner.calls.compare[0].configurations, [
      { profileName: 'budget', label: 'budget' },
      { profileName: 'quality', label: 'quality' },
    ]);
    assert.equal(runner.calls.compare[0].options.skipRubricEval, true);
    assert.equal(runner.calls.compare[0].options.admissionPlan.confirmation, 'exact_count');
  });
});
