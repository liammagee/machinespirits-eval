import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { compactTutorStubOneLine } from '../services/tutorStubTextProjection.js';

test('one-line projection collapses whitespace and trims edges', () => {
  assert.equal(compactTutorStubOneLine('  first\n\tsecond   third  '), 'first second third');
});

test('one-line projection leaves text within the budget byte-exact', () => {
  assert.equal(compactTutorStubOneLine('exact', { max: 5 }), 'exact');
});

test('one-line projection truncates to the exact budget with three dots', () => {
  assert.equal(compactTutorStubOneLine('abcdefghij', { max: 8 }), 'abcde...');
  assert.equal(compactTutorStubOneLine('abcdef', { max: 2 }), '...');
});

test('one-line projection preserves the nullish fallback', () => {
  assert.equal(compactTutorStubOneLine(null), '');
  assert.equal(compactTutorStubOneLine(0), '');
});

test('the CLI imports rather than redeclares its shared one-line projection', () => {
  const source = fs.readFileSync(new URL('../scripts/tutor-stub.js', import.meta.url), 'utf8');
  assert.match(source, /compactTutorStubOneLine as oneLine/u);
  assert.doesNotMatch(source, /function oneLine\(/u);
});
