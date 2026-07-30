import assert from 'node:assert/strict';
import test from 'node:test';

import { tutorStubOutcomeRowKind } from '../services/tutorStubOutcomeRows.js';

/**
 * The row below is verbatim from the 2026-07-30 re-pilot: Nocturne #3 died at
 * turn 15 when the tutor's own fallback text tripped the leak guard, and the
 * runner recorded it as `ok` because its trace parsed. Read that way it counts
 * as a dialogue the tutor failed to close, and it alone moved Nocturne's gate
 * verdict from saturated to inside the band. The exit code is what says
 * otherwise, so that is what the rule reads.
 */
test('a crashed dialogue recorded before the distinction existed still reads as aborted', () => {
  assert.equal(
    tutorStubOutcomeRowKind({
      status: 'ok',
      exitCode: 1,
      stopReason: 'guard_exhausted',
      closure: { grounded: false },
    }),
    'aborted',
  );
});

test('a dialogue that stopped on its own is complete, whatever its closure verdict', () => {
  assert.equal(tutorStubOutcomeRowKind({ status: 'ok', exitCode: 0, closure: { grounded: true } }), 'complete');
  assert.equal(tutorStubOutcomeRowKind({ status: 'ok', exitCode: 0, closure: { grounded: false } }), 'complete');
});

test('a dialogue that left no readable trace is neither complete nor aborted', () => {
  assert.equal(tutorStubOutcomeRowKind({ status: 'error', exitCode: 0, error: 'no trace file' }), 'error');
  assert.equal(tutorStubOutcomeRowKind({ status: 'error', exitCode: 1, error: 'no trace file' }), 'error');
});

test('a row with no exit code at all is not counted as complete', () => {
  assert.equal(tutorStubOutcomeRowKind({ status: 'ok' }), 'aborted');
  assert.equal(tutorStubOutcomeRowKind({}), 'aborted');
});
