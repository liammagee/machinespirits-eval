import assert from 'node:assert/strict';
import test from 'node:test';
import { parseArgs, parsePairSpec } from '../scripts/derivation-ownership-eval.js';

test('ownership eval parses S0/S1 pair specs', () => {
  assert.deepEqual(parsePairSpec('hethel=s0-label,s1-label'), {
    pairId: 'hethel',
    refs: ['s0-label', 's1-label'],
  });
});

test('ownership eval rejects malformed or duplicate pair specs', () => {
  assert.throws(() => parsePairSpec('bad'), /Invalid --pair/u);
  assert.throws(() => parsePairSpec('bad=a'), /Invalid --pair/u);
  assert.throws(() => parsePairSpec('bad=a,a'), /Refs must differ/u);
});

test('ownership eval parseArgs collects pairs and out directory', () => {
  const opts = parseArgs(['--pair', 'p=a,b', '--out', 'exports/tmp']);

  assert.equal(opts.pairs.length, 1);
  assert.equal(opts.pairs[0].pairId, 'p');
  assert.match(opts.out, /exports\/tmp$/u);
});
