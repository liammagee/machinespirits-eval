import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  parseTutorStubAutoTurns,
  parseTutorStubCommaSeparatedStrings,
  parseTutorStubNumber,
  parseTutorStubOptionalBoundedInt,
  parseTutorStubPositiveInt,
} from '../services/tutorStubCliParsing.js';

test('bounded numbers preserve coercion, range checks, and error wording', () => {
  assert.equal(parseTutorStubNumber('0.25', '--temperature', { min: 0, max: 2 }), 0.25);
  assert.equal(parseTutorStubNumber(null, '--temperature', { min: 0, max: 2 }), 0);
  assert.throws(
    () => parseTutorStubNumber('three', '--temperature', { min: 0, max: 2 }),
    /--temperature must be a number between 0 and 2/u,
  );
});

test('positive integers retain parseInt compatibility', () => {
  assert.equal(parseTutorStubPositiveInt('4.9', '--runs'), 4);
  assert.throws(() => parseTutorStubPositiveInt('0', '--runs'), /--runs must be a positive integer/u);
});

test('optional bounded integers distinguish absence from invalid values', () => {
  assert.equal(parseTutorStubOptionalBoundedInt('  ', '--support'), null);
  assert.equal(parseTutorStubOptionalBoundedInt('3', '--support', { min: 1, max: 4 }), 3);
  assert.throws(
    () => parseTutorStubOptionalBoundedInt('3.5', '--support', { min: 1, max: 4 }),
    /--support must be an integer between 1 and 4/u,
  );
});

test('comma-separated strings trim entries and omit empty values', () => {
  assert.deepEqual(parseTutorStubCommaSeparatedStrings('alpha, , beta,,gamma '), ['alpha', 'beta', 'gamma']);
  assert.deepEqual(parseTutorStubCommaSeparatedStrings(null), []);
});

test('auto-turn parsing preserves every unbounded alias and positive fallback', () => {
  for (const value of ['0', 'none', 'UNBOUNDED', 'until-grounded', 'grounded']) {
    assert.equal(parseTutorStubAutoTurns(value), null, value);
  }
  assert.equal(parseTutorStubAutoTurns('7'), 7);
  assert.throws(() => parseTutorStubAutoTurns('later'), /--auto-turns must be a positive integer/u);
});

test('the CLI imports rather than redeclares parsing helpers', () => {
  const source = fs.readFileSync(new URL('../scripts/tutor-stub.js', import.meta.url), 'utf8');
  assert.match(source, /parseTutorStubAutoTurns as parseAutoTurns/u);
  assert.doesNotMatch(
    source,
    /function (?:parseNumber|parsePositiveInt|parseOptionalBoundedInt|commaSeparatedStrings|parseAutoTurns)\(/u,
  );
});
