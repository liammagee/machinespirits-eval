import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  dispatchTutorStubLearnerAnalysisWithRetries,
  resolveTutorStubLearnerAnalysisSealDisposition,
  summarizeTutorStubLearnerAnalysisCoverage,
  TUTOR_STUB_LEARNER_ANALYSIS_INCOMPLETE_STATUS,
} from '../services/tutorStubLearnerAnalysisCoverage.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function dialogue11FixtureEvents() {
  return fs
    .readFileSync(
      path.join(ROOT, 'tests/fixtures/adaptive-warrant-outcome-v3-dialogue-11-learner-analysis.jsonl'),
      'utf8',
    )
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
}

function publicTurnEvents({ failedTurn = null } = {}) {
  return Array.from({ length: 8 }, (_, index) => {
    const turn = index + 1;
    return {
      type: 'turn_complete',
      turnRecord: {
        turn,
        classification:
          turn === failedTurn
            ? {
                analysis_status: 'unanalyzed',
                failure_code: 'invalid_semantic_events',
                error: 'invalid_semantic_events',
              }
            : { combined: true },
      },
    };
  });
}

test('dialogue-11 invalid semantic events retry to a valid fresh sample and full coverage', async () => {
  const sourceFailure = dialogue11FixtureEvents().find((event) => event.type === 'learner_analysis_unanalyzed');
  const attempts = [];
  let dispatches = 0;
  const result = await dispatchTutorStubLearnerAnalysisWithRetries({
    turn: sourceFailure.turn,
    appendAttempt: (attempt) => attempts.push(attempt),
    dispatch: async () => {
      dispatches += 1;
      if (dispatches === 1) {
        const error = new Error(sourceFailure.failure.message);
        error.code = sourceFailure.failure.code;
        throw error;
      }
      return { parsed: { classification: {}, learner_record: {} }, freshSample: true };
    },
  });
  assert.equal(result.freshSample, true);
  assert.equal(dispatches, 2);
  assert.deepEqual(attempts, [
    { attemptIndex: 1, status: 'failed', failureCode: 'invalid_semantic_events', turn: 5 },
    { attemptIndex: 2, status: 'analyzed', failureCode: null, turn: 5 },
  ]);
  assert.deepEqual(summarizeTutorStubLearnerAnalysisCoverage(publicTurnEvents()), {
    publicTurns: [1, 2, 3, 4, 5, 6, 7, 8],
    analyzedTurns: [1, 2, 3, 4, 5, 6, 7, 8],
    unanalyzedTurns: [],
    coverage: 1,
  });
});

test('persistent dialogue-11 failure yields a distinct non-complete seal naming turn 5', async () => {
  const sourceFailure = dialogue11FixtureEvents().find((event) => event.type === 'learner_analysis_unanalyzed');
  const attempts = [];
  await assert.rejects(
    dispatchTutorStubLearnerAnalysisWithRetries({
      turn: sourceFailure.turn,
      appendAttempt: (attempt) => attempts.push(attempt),
      dispatch: async () => {
        const error = new Error(sourceFailure.failure.message);
        error.code = sourceFailure.failure.code;
        throw error;
      },
    }),
    (error) => error.code === 'invalid_semantic_events',
  );
  assert.equal(attempts.length, 3);
  const coverage = summarizeTutorStubLearnerAnalysisCoverage(publicTurnEvents({ failedTurn: 5 }));
  const disposition = resolveTutorStubLearnerAnalysisSealDisposition([{ jobId: 'dynamic-r1', coverage }]);
  assert.equal(disposition.status, TUTOR_STUB_LEARNER_ANALYSIS_INCOMPLETE_STATUS);
  assert.equal(disposition.coverage, 0.875);
  assert.deepEqual(disposition.unanalyzed, [{ jobId: 'dynamic-r1', turn: 5 }]);
});

test('fresh retries reserve normal calls and cannot exceed the 30-call dialogue cap', async () => {
  const attempts = [];
  let used = 28;
  let reservations = 0;
  await assert.rejects(
    dispatchTutorStubLearnerAnalysisWithRetries({
      turn: 5,
      appendAttempt: (attempt) => attempts.push(attempt),
      dispatch: async () => {
        if (used >= 30) {
          const exhausted = new Error('30-call budget exhausted');
          exhausted.code = 'analysis_model_call_failed';
          throw exhausted;
        }
        used += 1;
        reservations += 1;
        const invalid = new Error('strict sample invalid');
        invalid.code = 'invalid_analysis_schema';
        throw invalid;
      },
    }),
    (error) => error.code === 'analysis_model_call_failed',
  );
  assert.equal(reservations, 2);
  assert.equal(used, 30);
  assert.equal(attempts.length, 3);
  assert.equal(attempts.at(-1).failureCode, 'analysis_model_call_failed');
});
