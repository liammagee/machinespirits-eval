import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  formatTutorStubOpeningDebugId,
  formatTutorStubSafeTimestamp,
  formatTutorStubTurnDebugId,
} from '../services/tutorStubDebugIdentity.js';

test('debug timestamps remain filename-safe and byte-exact', () => {
  assert.equal(formatTutorStubSafeTimestamp(new Date('2026-07-28T01:02:03.456Z')), '2026-07-28T01-02-03-456Z');
});

test('turn debug ids normalize run ids and pad positive turns', () => {
  assert.equal(formatTutorStubTurnDebugId(' run-fixed ', 7), 'run-fixed:t007');
  assert.equal(formatTutorStubTurnDebugId('', '12'), 'no-trace:t012');
});

test('invalid turn numbers preserve the normalized run identity', () => {
  assert.equal(formatTutorStubTurnDebugId(' run-fixed ', 0), 'run-fixed');
  assert.equal(formatTutorStubTurnDebugId(null, 'not-a-turn'), 'no-trace');
});

test('opening debug ids share the same run normalization', () => {
  assert.equal(formatTutorStubOpeningDebugId(' run-fixed '), 'run-fixed:opening');
  assert.equal(formatTutorStubOpeningDebugId(''), 'no-trace:opening');
});

test('the CLI imports rather than redeclares the debug identity model', () => {
  const source = fs.readFileSync(new URL('../scripts/tutor-stub.js', import.meta.url), 'utf8');
  assert.match(source, /from '\.\.\/services\/tutorStubDebugIdentity\.js'/u);
  assert.doesNotMatch(source, /function (?:safeTimestampForFile|formatTurnDebugId|openingDebugId)\(/u);
});
