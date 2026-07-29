import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { abortTutorStubTurnAttempt, assertTutorStubTurnAttemptCurrent } from '../services/tutorStubTurnAttempt.js';

test('turn-attempt abort errors preserve default and custom identity', () => {
  const defaultError = abortTutorStubTurnAttempt();
  assert.equal(defaultError instanceof Error, true);
  assert.equal(defaultError.name, 'AbortError');
  assert.equal(defaultError.code, 'TUTOR_STUB_TURN_SUPERSEDED');
  assert.equal(defaultError.message, 'learner turn attempt was superseded');
  assert.equal(abortTutorStubTurnAttempt('custom message').message, 'custom message');
});

test('turn-attempt currentness preserves signal and callback short-circuit behavior', () => {
  assert.doesNotThrow(() => assertTutorStubTurnAttemptCurrent());
  assert.doesNotThrow(() => assertTutorStubTurnAttemptCurrent({ signal: { aborted: false }, isCurrent: true }));

  let calls = 0;
  assert.throws(
    () =>
      assertTutorStubTurnAttemptCurrent({
        signal: { aborted: true },
        isCurrent: () => {
          calls += 1;
          return true;
        },
      }),
    (error) => error.name === 'AbortError' && error.code === 'TUTOR_STUB_TURN_SUPERSEDED',
  );
  assert.equal(calls, 0);

  assert.throws(
    () =>
      assertTutorStubTurnAttemptCurrent({
        signal: { aborted: false },
        isCurrent: () => {
          calls += 1;
          return false;
        },
      }),
    (error) => error.name === 'AbortError' && error.code === 'TUTOR_STUB_TURN_SUPERSEDED',
  );
  assert.equal(calls, 1);
});

test('the CLI imports rather than redeclares turn-attempt guards', () => {
  const source = fs.readFileSync(new URL('../scripts/tutor-stub.js', import.meta.url), 'utf8');
  assert.match(source, /from '\.\.\/services\/tutorStubTurnAttempt\.js'/u);
  assert.doesNotMatch(source, /function (?:abortTutorStubTurnAttempt|assertTutorStubTurnAttemptCurrent)\(/u);
});
