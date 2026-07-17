import assert from 'node:assert/strict';
import test from 'node:test';

import { splitTutorStubPublicWords } from '../tutorStubPublicText.js';

test('public token normalization aligns possessive prose with bare fact symbols', () => {
  const publicTokens = new Set(splitTutorStubPublicWords("Lights are the keeper's business — Brandt's business."));

  assert.equal(publicTokens.has('keeper'), true);
  assert.equal(publicTokens.has('brandt'), true);
  assert.equal(publicTokens.has("keeper's"), false);
  assert.equal(publicTokens.has("brandt's"), false);
});

test('public token normalization preserves camel-case fact vocabulary', () => {
  assert.deepEqual(splitTutorStubPublicWords('onlyKeyTo'), ['only', 'key', 'to']);
});
