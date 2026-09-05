import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createTutorStubTraceRuntime } from '../services/tutorStubTraceRuntime.js';

// Regression for the 2026-09-04 second-family launch: the shared attempt ledger
// (durableAttemptJournal) refuses to close an attempt as completed until the
// response is persisted, and the tutor-stub child closed every model_call
// without persisting. The first paid dialogue died at its first call. This
// test runs the child's trace runtime against a real shared ledger.

function buildRuntime(root) {
  return createTutorStubTraceRuntime({
    ROOT: root,
    fs,
    path,
    resolveWorkspacePath: (value) => path.resolve(root, value),
    safeTimestampForFile: () => 'run-1',
    captureTutorStubRunProvenance: () => ({ git: { sha: 'a'.repeat(40) } }),
    captureGitProvenanceSummary: () => ({}),
    hashCanonicalJson: () => 'hash',
    redactTraceSecrets: (entry) =>
      JSON.parse(JSON.stringify(entry, (key, value) => (key === 'secret' ? undefined : value))),
    formatTurnDebugId: (runId, turn) => `${runId}:t${turn}`,
    openingDebugId: (runId) => `${runId}:opening`,
    selectedLabModelCallBudget: {
      calls: 0,
      snapshot() {
        return { labId: 'automated_eval', limit: 30, remaining: 30 - this.calls };
      },
      reserve() {
        this.calls += 1;
        return { call: this.calls, limit: 30, remaining: 30 - this.calls };
      },
    },
  });
}

function readLedger(ledgerPath) {
  return fs
    .readFileSync(ledgerPath, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test('a completed model call persists its response in the run directory before the shared ledger closes it', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-shared-attempt-'));
  const destination = path.join(root, 'study-out');
  const traceDir = path.join(destination, 'dialogues', 'unit-1');
  const runLedgerPath = path.join(destination, 'run-ledger.jsonl');
  const studyLedgerPath = path.join(root, 'state', 'study-ledger.jsonl');
  fs.mkdirSync(path.dirname(studyLedgerPath), { recursive: true });
  const previousEnv = process.env.TUTOR_STUB_SHARED_ATTEMPT_LEDGER;
  process.env.TUTOR_STUB_SHARED_ATTEMPT_LEDGER = JSON.stringify({
    runLedgerPath,
    studyLedgerPath,
    studyId: 'study-1',
    destination,
    hardCeiling: 10,
    unitId: 'unit-1',
    capacityId: 'capacity-1',
    capacityLimit: 5,
    maximumTurn: 8,
  });
  try {
    const runtime = buildRuntime(root);
    const trace = runtime.createTraceState({ enabled: true, traceDir, metadata: {} });
    assert.ok(trace.sharedAttemptLedger, 'the child reads the shared ledger from its environment');

    const reservation = runtime.reserveTutorStubMeteredModelCall({ trace, role: 'tutor_stub_opening', turn: 0 });
    runtime.markTutorStubMeteredModelCallDispatched({ trace, reservation, role: 'tutor_stub_opening', turn: 0 });
    runtime.appendTraceEvent(trace, {
      type: 'model_call',
      role: 'tutor_stub_opening',
      turn: 0,
      provider: 'claude-code',
      model: 'claude-opus-5',
      request: { prompt: 'open the scene', secret: 'remove-me' },
      response: { text: 'The inquiry log is open.' },
    });

    const events = readLedger(runLedgerPath).filter((event) => event.attempt_id === reservation.attemptId);
    assert.deepEqual(
      events.map((event) => event.type),
      [
        'model_attempt_dispatch_reserved',
        'model_attempt_dispatch_started',
        'attempt_response_persisted',
        'attempt_completed',
      ],
    );
    const persisted = events.find((event) => event.type === 'attempt_response_persisted');
    assert.ok(persisted.response_path.startsWith(traceDir), 'the response lives inside the dialogue directory');
    const written = fs.readFileSync(persisted.response_path, 'utf8');
    assert.match(written, /The inquiry log is open\./u);
    assert.doesNotMatch(written, /remove-me/u);
    assert.equal(persisted.response_sha256.length, 64);

    // A failed call still closes as failed without a response file.
    const second = runtime.reserveTutorStubMeteredModelCall({ trace, role: 'tutor_stub_auto_learner', turn: 1 });
    runtime.markTutorStubMeteredModelCallDispatched({
      trace,
      reservation: second,
      role: 'tutor_stub_auto_learner',
      turn: 1,
    });
    runtime.appendTraceEvent(trace, {
      type: 'model_call_error',
      role: 'tutor_stub_auto_learner',
      turn: 1,
      error: 'transport reset',
    });
    const secondEvents = readLedger(runLedgerPath).filter((event) => event.attempt_id === second.attemptId);
    assert.deepEqual(
      secondEvents.map((event) => event.type),
      ['model_attempt_dispatch_reserved', 'model_attempt_dispatch_started', 'attempt_failed'],
    );
    assert.equal(fs.readdirSync(path.join(traceDir, 'attempt-responses')).length, 1);
  } finally {
    if (previousEnv === undefined) delete process.env.TUTOR_STUB_SHARED_ATTEMPT_LEDGER;
    else process.env.TUTOR_STUB_SHARED_ATTEMPT_LEDGER = previousEnv;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
