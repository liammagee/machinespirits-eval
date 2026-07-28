import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  formatTutorStubFact,
  tutorStubFactMatches,
  tutorStubSplitSymbolWords,
  tutorStubTextContainsToken,
  tutorStubTextTokens,
  tutorStubTokenRegex,
} from '../services/tutorStubFactModel.js';

test('fact formatting preserves symbolic tuple bytes and scalar fallbacks', () => {
  assert.equal(formatTutorStubFact(['struckBy', 'coin', 'verrell']), 'struckBy(coin, verrell)');
  assert.equal(formatTutorStubFact([]), '');
  assert.equal(formatTutorStubFact('plain'), 'plain');
});

test('symbol words share the public-text camel, separator, and possessive normalization', () => {
  assert.deepEqual(tutorStubSplitSymbolWords("Brandt's castBlank_for"), ['brandt', 'cast', 'blank', 'for']);
  assert.deepEqual([...tutorStubTextTokens('same same-hand')], ['same', 'hand']);
});

test('token matching is whole-word, case-insensitive, and regex-safe', () => {
  assert.equal(tutorStubTextContainsToken('The A.B mark differs.', 'a.b'), true);
  assert.equal(tutorStubTextContainsToken('Brandtish evidence', 'brandt'), false);
  assert.equal(tutorStubTokenRegex('a.b').source, '\\ba\\.b\\b');
});

test('fact equality uses the canonical dramatic-derivation key', () => {
  assert.equal(tutorStubFactMatches(['p', 'a'], ['p', 'a']), true);
  assert.equal(tutorStubFactMatches(['p', 'a'], ['p', 'b']), false);
});

test('the CLI imports rather than redeclares fact-model helpers', () => {
  const source = fs.readFileSync(new URL('../scripts/tutor-stub.js', import.meta.url), 'utf8');
  assert.match(source, /from '\.\.\/services\/tutorStubFactModel\.js'/u);
  assert.doesNotMatch(
    source,
    /function (?:factText|splitSymbolWords|textTokens|tokenRegex|textContainsToken|factMatches)\(/u,
  );
});
