import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  admitEvaluationRequest,
  EvaluationAdmissionError,
  hasEvalApiPrivilegedOverride,
  resolveEvalApiMaxPlannedTests,
} from '../evalRequestAdmission.js';

const registries = {
  profileRegistry: ['budget', 'quality', 'cell_7_recog_multi_unified'],
  scenarioRegistry: ['first', 'second', 'third'],
};

function expectAdmissionError(fn, status, code) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof EvaluationAdmissionError);
    assert.equal(error.status, status);
    assert.equal(error.code, code);
    return true;
  });
}

describe('evalRequestAdmission', () => {
  it('normalizes an exact dry-run plan and freezes its provenance', () => {
    const admitted = admitEvaluationRequest(
      {
        profiles: ['budget', 'quality'],
        scenarios: 'all',
        runsPerConfig: 2,
        dryRun: true,
        skipRubric: true,
      },
      { ...registries, maxPlannedTests: 20, endpoint: '/api/eval/compare', now: () => '2026-07-23T00:00:00.000Z' },
    );

    assert.equal(admitted.plannedTestCount, 12);
    assert.deepEqual(admitted.scenarios, ['first', 'second', 'third']);
    assert.equal(admitted.admissionPlan.confirmation, 'dry_run_exempt');
    assert.equal(admitted.admissionPlan.admittedAt, '2026-07-23T00:00:00.000Z');
    assert.match(admitted.admissionPlan.requestHash, /^[a-f0-9]{64}$/u);
    assert.equal(Object.isFrozen(admitted), true);
    assert.equal(Object.isFrozen(admitted.admissionPlan), true);
    assert.equal(Object.isFrozen(admitted.admissionPlan.profiles), true);
  });

  it('requires exact confirmation for paid work', () => {
    const request = { profiles: ['budget'], scenarios: ['first', 'second'], runsPerConfig: 2 };
    expectAdmissionError(
      () => admitEvaluationRequest(request, { ...registries, maxPlannedTests: 20 }),
      428,
      'evaluation_confirmation_required',
    );
    expectAdmissionError(
      () => admitEvaluationRequest({ ...request, confirmTestCount: 3 }, { ...registries, maxPlannedTests: 20 }),
      422,
      'evaluation_confirmation_mismatch',
    );
    const admitted = admitEvaluationRequest(
      { ...request, confirmTestCount: 4 },
      { ...registries, maxPlannedTests: 20 },
    );
    assert.equal(admitted.plannedTestCount, 4);
    assert.equal(admitted.admissionPlan.confirmation, 'exact_count');
  });

  it('distinguishes malformed, invalid, unknown, and oversized requests', () => {
    const cases = [
      {
        body: { profiles: 'budget', scenarios: ['first'], dryRun: true },
        status: 400,
        code: 'invalid_request_schema',
      },
      {
        body: { profiles: ['budget', 'budget'], scenarios: ['first'], dryRun: true },
        status: 422,
        code: 'duplicate_request_value',
      },
      {
        body: { profiles: ['missing'], scenarios: ['first'], dryRun: true },
        status: 422,
        code: 'unknown_registry_value',
      },
      {
        body: { profiles: ['budget'], scenarios: ['first'], runsPerConfig: 0, dryRun: true },
        status: 422,
        code: 'invalid_request_value',
      },
      {
        body: { profiles: ['budget'], scenarios: ['first'], runsPerConfig: 1.5, dryRun: true },
        status: 422,
        code: 'invalid_request_value',
      },
      {
        body: { profiles: ['budget', 'quality'], scenarios: 'all', runsPerConfig: 2, dryRun: true },
        status: 413,
        code: 'evaluation_plan_too_large',
        maxPlannedTests: 10,
      },
    ];
    for (const testCase of cases) {
      expectAdmissionError(
        () =>
          admitEvaluationRequest(testCase.body, {
            ...registries,
            maxPlannedTests: testCase.maxPlannedTests ?? 20,
          }),
        testCase.status,
        testCase.code,
      );
    }
  });

  it('rejects unsafe-integer plans before Cartesian materialization', () => {
    expectAdmissionError(
      () =>
        admitEvaluationRequest(
          {
            profiles: ['budget', 'quality'],
            scenarios: ['first'],
            runsPerConfig: Number.MAX_SAFE_INTEGER,
            dryRun: true,
          },
          { ...registries, maxPlannedTests: Number.MAX_SAFE_INTEGER },
        ),
      413,
      'evaluation_plan_too_large',
    );
  });

  it('permits a server-authenticated ceiling override but still requires exact confirmation', () => {
    const body = {
      profiles: ['budget', 'quality'],
      scenarios: 'all',
      runsPerConfig: 2,
      allowOversizedPlan: true,
      confirmTestCount: 12,
    };
    const admitted = admitEvaluationRequest(body, {
      ...registries,
      maxPlannedTests: 10,
      privilegedOverride: true,
    });
    assert.equal(admitted.admissionPlan.ceilingOverridden, true);
    assert.equal(admitted.plannedTestCount, 12);
  });

  it('parses the conservative ceiling and authenticates override tokens without leaking them', () => {
    assert.equal(resolveEvalApiMaxPlannedTests({}), 100);
    assert.equal(resolveEvalApiMaxPlannedTests({ EVAL_API_MAX_PLANNED_TESTS: '17' }), 17);
    assert.equal(resolveEvalApiMaxPlannedTests({ EVAL_API_MAX_PLANNED_TESTS: '-1' }), 100);
    const req = {
      body: { allowOversizedPlan: true },
      headers: { 'x-eval-override-token': 'server-secret' },
    };
    assert.equal(hasEvalApiPrivilegedOverride(req, { EVAL_API_OVERRIDE_TOKEN: 'server-secret' }), true);
    assert.equal(hasEvalApiPrivilegedOverride(req, { EVAL_API_OVERRIDE_TOKEN: 'wrong' }), false);
  });
});
