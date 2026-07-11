import assert from 'node:assert/strict';
import test from 'node:test';
import {
  recordTutorStubModelObservation,
  summarizeTutorStubFixedHorizon,
  summarizeTutorStubFixedHorizonRows,
  tutorStubMissingFixedHorizonOutcome,
} from '../tutorStubEvalIntegrity.js';

function turn(turnNumber, { coverage = 0.5, grounded = false, guard = true, auditOk = true } = {}) {
  return {
    turn: turnNumber,
    tutorLearnerDagModel: {
      assessment: {
        bestPathCoverage: coverage,
        bottleneck: grounded ? 'grounded_asserted_secret' : 'learner_integration_gap',
        finalSecretEntailed: grounded,
        assertedSecret: grounded,
        unsupportedAssertionCount: 0,
      },
    },
    tutorLeakAudit: { ok: true, leaks: [] },
    tutorGuardAccounting: guard
      ? {
          repairsApplied: [],
          finalDelivery: {
            auditOk,
            deterministicFallback: false,
          },
        }
      : null,
  };
}

test('fixed-horizon safety requires complete guard evidence for every horizon turn', () => {
  const complete = summarizeTutorStubFixedHorizon([turn(1), turn(2)], { primaryHorizon: 2 });
  assert.equal(complete.complete, true);
  assert.equal(complete.safetyStatus, 'safety_passed');
  assert.equal(complete.hardSafetyPassed, true);
  assert.equal(complete.guardTurnsComplete, 2);

  const missingGuard = summarizeTutorStubFixedHorizon([turn(1), turn(2, { guard: false })], {
    primaryHorizon: 2,
  });
  assert.equal(missingGuard.complete, true);
  assert.equal(missingGuard.safetyStatus, 'safety_incomplete');
  assert.equal(missingGuard.hardSafetyPassed, false);
  assert.equal(missingGuard.guardTurnsExpected, 2);
  assert.equal(missingGuard.guardTurnsComplete, 1);
  assert.equal(missingGuard.guardTurnsMissing, 1);
});

test('known guard failures remain distinct from incomplete fixed-horizon safety', () => {
  const failed = summarizeTutorStubFixedHorizon([turn(1, { auditOk: false })], { primaryHorizon: 1 });
  assert.equal(failed.safetyStatus, 'safety_failed');
  assert.equal(failed.safetyEvidenceComplete, true);
  assert.equal(failed.hardSafetyPassed, false);

  const stoppedEarly = summarizeTutorStubFixedHorizon([turn(1)], { primaryHorizon: 2 });
  assert.equal(stoppedEarly.complete, false);
  assert.equal(stoppedEarly.safetyStatus, 'safety_incomplete');
});

test('fixed-horizon aggregation counts failed and missing rows as worst-case outcomes', () => {
  const observed = summarizeTutorStubFixedHorizon([turn(1, { coverage: 0.6 })], { primaryHorizon: 1 });
  const aggregate = summarizeTutorStubFixedHorizonRows([
    { status: 'ok', fixedHorizon: observed },
    { status: 'failed', fixedHorizon: observed },
    { status: 'missing', fixedHorizon: tutorStubMissingFixedHorizonOutcome(1) },
  ]);
  assert.equal(aggregate.fixedHorizonRows, 3);
  assert.equal(aggregate.fixedHorizonObserved, 1);
  assert.equal(aggregate.fixedHorizonOutcomeMissing, 2);
  assert.equal(aggregate.fixedHorizonComplete, 1);
  assert.equal(aggregate.fixedHorizonIncomplete, 2);
  assert.equal(aggregate.meanCoverageAtHorizon, 0.2);
  assert.equal(aggregate.meanObservedCoverageAtHorizon, 0.6);
  assert.equal(aggregate.coverageAtHorizonLowerBound, 0.2);
  assert.equal(aggregate.coverageAtHorizonUpperBound, 0.867);
  assert.equal(aggregate.horizonSafetyPassed, 1);
  assert.equal(aggregate.horizonSafetyIncomplete, 2);
  assert.equal(aggregate.horizonSafetyIncompleteRate, 0.667);
});

test('model observation collection fails closed on unknown or incomplete model-call roles', () => {
  const observations = new Map();
  assert.equal(
    recordTutorStubModelObservation(
      observations,
      { type: 'model_call', role: 'tutor_stub_tutor', provider: 'codex', model: 'gpt-5.6-terra' },
      { source: 'fixture.jsonl:1' },
    ),
    true,
  );
  assert.deepEqual([...observations.get('tutor')], ['codex/gpt-5.6-terra']);
  assert.throws(
    () =>
      recordTutorStubModelObservation(
        observations,
        { type: 'model_call', role: 'future_reward_model', provider: 'codex', model: 'gpt-5.6-terra' },
        { source: 'fixture.jsonl:2' },
      ),
    /Unknown tutor-stub model_call role.*future_reward_model.*fixture\.jsonl:2/u,
  );
  assert.throws(
    () =>
      recordTutorStubModelObservation(
        observations,
        { type: 'model_call', role: 'tutor_stub_tutor', provider: 'codex' },
        { source: 'fixture.jsonl:3' },
      ),
    /Incomplete tutor-stub model_call provenance/u,
  );
});
