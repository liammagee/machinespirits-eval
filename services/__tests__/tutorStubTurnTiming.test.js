import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TUTOR_STUB_TURN_TIMING_SCHEMA,
  buildTutorStubTurnTiming,
  formatTutorStubTurnTiming,
  tutorStubLearnerAnalysisModelLatencyMs,
} from '../tutorStubTurnTiming.js';

test('turn timing separates foreground analysis, tutor, local, and recovery time', () => {
  const timing = buildTutorStubTurnTiming({
    startedAtMs: 1_000,
    analysisStartedAtMs: 1_100,
    analysisCompletedAtMs: 4_100,
    tutorStartedAtMs: 4_200,
    completedAtMs: 10_000,
    classification: { combined: true, latencyMs: 2_900 },
    response: {
      latencyMs: 5_500,
      guardAccounting: {
        generation: {
          modelCallCount: 2,
          originalCandidateLatencyMs: 3_700,
          recoveryLatencyMs: 1_800,
          totalModelLatencyMs: 5_500,
        },
      },
    },
  });

  assert.equal(timing.schema, TUTOR_STUB_TURN_TIMING_SCHEMA);
  assert.deepEqual(timing.foreground, {
    totalMs: 9_000,
    analysisMs: 3_000,
    tutorMs: 5_800,
    localMs: 200,
  });
  assert.equal(timing.analysis.modelLatencyMs, 2_900);
  assert.equal(timing.tutor.recoveryLatencyMs, 1_800);
  assert.equal(
    formatTutorStubTurnTiming(timing),
    'time > wait 9.0s · analysis 3.0s · tutor 5.8s (2 calls; recovery 1.8s) · local 0.2s',
  );
});

test('prefetched stages report foreground wait without claiming background model time', () => {
  const timing = buildTutorStubTurnTiming({
    startedAtMs: 1_000,
    analysisStartedAtMs: 1_000,
    analysisCompletedAtMs: 1_020,
    tutorStartedAtMs: 1_040,
    completedAtMs: 1_120,
    analysisSource: 'prefetched',
    tutorSource: 'prefetched',
    classification: { combined: true, latencyMs: 9_300 },
    response: { latencyMs: 11_400, speculativeCacheHit: true },
  });

  assert.equal(timing.foreground.totalMs, 120);
  assert.equal(timing.analysis.modelLatencyMs, 9_300);
  assert.equal(timing.tutor.modelLatencyMs, 11_400);
  assert.equal(
    formatTutorStubTurnTiming(timing),
    'time > wait 0.1s · analysis <0.1s (prefetched) · tutor <0.1s (prefetched) · local <0.1s',
  );
});

test('separate classifier and learner-record calls are summed once', () => {
  assert.equal(
    tutorStubLearnerAnalysisModelLatencyMs({
      classification: { latencyMs: 700 },
      tutorLearnerDag: { extractor: { latencyMs: 900 } },
    }),
    1_600,
  );
  assert.equal(
    tutorStubLearnerAnalysisModelLatencyMs({
      classification: { combined: true, latencyMs: 1_200 },
      tutorLearnerDag: { extractor: { latencyMs: 1_200 } },
    }),
    1_200,
  );
});
