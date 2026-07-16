import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  addTutorStubFrozenReplayAdmissionState,
  atomicWriteTutorStubFrozenReplayCheckpoint,
  buildTutorStubFrozenReplayAdmissionPlan,
  buildTutorStubFrozenReplayAdmissionState,
  runTutorStubFrozenReplayStopMode,
  validateTutorStubFrozenReplayStopMode,
} from '../services/tutorStubFrozenReplayCheckpoint.js';

function acceptedResult(candidate) {
  return {
    candidate,
    audit: {
      ok: true,
      safetyFailure: false,
      hardFailureClusters: [],
      audits: { actorialRealizationAudit: { ok: true } },
    },
  };
}

function rejectedResult(candidate, { safetyFailure = false } = {}) {
  return {
    candidate,
    audit: {
      ok: false,
      safetyFailure,
      hardFailureClusters: ['deliveryAudit:rejected'],
      audits: { actorialRealizationAudit: { ok: false } },
    },
  };
}

function jobs() {
  return [1, 2, 3].map((turn) => ({
    bundle: { turn, turnId: `run:t${String(turn).padStart(3, '0')}` },
    draw: 1,
  }));
}

test('stop mode requires a predeclared original-only sequential output path', () => {
  assert.throws(
    () =>
      validateTutorStubFrozenReplayStopMode({
        enabled: true,
        originalOnly: false,
        concurrency: 1,
        out: 'screen.json',
      }),
    /requires --original-only/u,
  );
  assert.throws(
    () =>
      validateTutorStubFrozenReplayStopMode({
        enabled: true,
        originalOnly: true,
        concurrency: 2,
        out: 'screen.json',
      }),
    /requires --concurrency 1/u,
  );
  assert.throws(
    () =>
      validateTutorStubFrozenReplayStopMode({
        enabled: true,
        originalOnly: true,
        concurrency: 1,
      }),
    /requires --out/u,
  );
  assert.deepEqual(
    validateTutorStubFrozenReplayStopMode({
      enabled: true,
      originalOnly: true,
      concurrency: 1,
      out: 'screen.json',
    }),
    {
      enabled: true,
      mode: 'stop_on_first_strict_rejection',
      predeclared: true,
      concurrency: 1,
    },
  );
});

test('stop mode checkpoints the complete unstarted inventory before first model admission', async () => {
  const events = [];
  const sourceJobs = jobs();
  await runTutorStubFrozenReplayStopMode({
    jobs: sourceJobs,
    runJob: async (job) => {
      events.push(`admit:${job.bundle.turn}`);
      return acceptedResult(`candidate ${job.bundle.turn}`);
    },
    checkpoint: async ({ results, admissionState }) => {
      events.push(`checkpoint:${results.length}`);
      if (results.length === 0) {
        assert.equal(admissionState.status, 'in_progress');
        assert.equal(admissionState.admittedDraws, 0);
        assert.equal(admissionState.unstartedDraws, 3);
        assert.deepEqual(
          admissionState.admissions.map((entry) => entry.status),
          ['unstarted', 'unstarted', 'unstarted'],
        );
      }
    },
  });

  assert.deepEqual(events.slice(0, 2), ['checkpoint:0', 'admit:1']);
});

test('each completed draw atomically replaces the checkpoint with exact partial results', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-frozen-checkpoint-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const target = path.join(directory, 'screen.json');
  const observed = [];

  const outcome = await runTutorStubFrozenReplayStopMode({
    jobs: jobs(),
    runJob: async (job) => acceptedResult(`candidate ${job.bundle.turn}`),
    checkpoint: ({ results, admissionState }) => {
      atomicWriteTutorStubFrozenReplayCheckpoint(target, { results, admissionState });
      const checkpoint = JSON.parse(fs.readFileSync(target, 'utf8'));
      observed.push(checkpoint.results.map((result) => result.candidate));
      assert.equal(checkpoint.admissionState.completedDraws, checkpoint.results.length);
      assert.deepEqual(
        fs.readdirSync(directory).filter((name) => name.endsWith('.tmp')),
        [],
      );
    },
  });

  assert.deepEqual(observed, [
    [],
    ['candidate 1'],
    ['candidate 1', 'candidate 2'],
    ['candidate 1', 'candidate 2', 'candidate 3'],
  ]);
  assert.equal(outcome.admissionState.status, 'complete');
  assert.equal(outcome.admissionState.stopReason, 'plan_complete');
});

test('the first strict rejection closes admission and preserves unstarted inventory', async () => {
  const admitted = [];
  const checkpoints = [];
  const outcome = await runTutorStubFrozenReplayStopMode({
    jobs: jobs(),
    runJob: async (job) => {
      admitted.push(job.bundle.turn);
      return job.bundle.turn === 2
        ? rejectedResult('unsafe candidate retained only in the audit artifact', { safetyFailure: true })
        : acceptedResult(`candidate ${job.bundle.turn}`);
    },
    checkpoint: async ({ results, admissionState }) => {
      checkpoints.push({ results, admissionState });
    },
  });

  assert.deepEqual(admitted, [1, 2]);
  assert.equal(checkpoints.length, 3);
  assert.equal(outcome.results.length, 2);
  assert.equal(outcome.results[1].candidate, 'unsafe candidate retained only in the audit artifact');
  assert.equal(outcome.admissionState.status, 'stopped_gate_impossible');
  assert.equal(outcome.admissionState.admissionClosed, true);
  assert.equal(outcome.admissionState.stopReason, 'first_strict_rejection');
  assert.equal(outcome.admissionState.firstRejectedAdmission.id, 'admission_2');
  assert.equal(outcome.admissionState.firstRejectedAdmission.safetyFailure, true);
  assert.equal(outcome.admissionState.unstartedDraws, 1);
  assert.deepEqual(
    outcome.admissionState.admissions.map((entry) => entry.status),
    ['completed', 'completed', 'unstarted'],
  );
});

test('disabled stop mode is a no-op and leaves legacy concurrency and output validation unchanged', () => {
  assert.deepEqual(
    validateTutorStubFrozenReplayStopMode({
      enabled: false,
      originalOnly: false,
      concurrency: 3,
      out: null,
    }),
    { enabled: false },
  );

  const legacyReport = {
    schema: 'legacy',
    summary: { draws: 1 },
    results: [acceptedResult('candidate')],
  };
  assert.equal(addTutorStubFrozenReplayAdmissionState(legacyReport), legacyReport);
  assert.deepEqual(Object.keys(addTutorStubFrozenReplayAdmissionState(legacyReport)), ['schema', 'summary', 'results']);

  const plan = buildTutorStubFrozenReplayAdmissionPlan(jobs());
  const state = buildTutorStubFrozenReplayAdmissionState({
    plan,
    results: jobs().map((job) => acceptedResult(`candidate ${job.bundle.turn}`)),
  });
  assert.equal(state.status, 'complete');
});
