import assert from 'node:assert/strict';
import { test } from 'node:test';

import { compareReaders, kappa, scoreReader, traceKey, verdict } from '../scripts/compare-learner-state-labels.js';

// Label files may name a trace by a scratchpad path or by a renamed copy; the
// join key must come out the same for both spellings of one dialogue.
test('traceKey joins the same dialogue under different paths', () => {
  assert.equal(traceKey('../../scratchpad/hero-hold/world-030-butler-d1.jsonl'), '030:butler-d1');
  assert.equal(traceKey('/abs/exports/form-state-detector/step6a-traces/world-030-butler-d1.jsonl'), '030:butler-d1');
  assert.equal(traceKey('../../scratchpad/hero-036/v3-d1.jsonl'), '036:v3-d1');
  assert.equal(traceKey('exports/x/step6a-traces/world-036-v3-d1.jsonl'), '036:v3-d1');
  assert.equal(traceKey('lesson-pool/world-038-plants-d0.jsonl'), '038:plants-d0');
  assert.throws(() => traceKey('nowhere/butler-d1.jsonl'), /world number/);
});

test('verdict matches the labeller scorer', () => {
  assert.equal(verdict('opposed', 'opposed'), 'right');
  assert.equal(verdict('opposed', 'irritated'), 'wrong-kind');
  assert.equal(verdict('opposed', 'neutral'), 'silent');
  assert.equal(verdict('bored', 'bored'), 'quiet-right');
  assert.equal(verdict('bored', 'irritated'), 'wrong-fire');
  assert.equal(verdict('neutral', 'jumping_ahead'), 'false-alarm');
  assert.equal(verdict('neutral', 'neutral'), 'neutral-ok');
});

test('scoreReader and compareReaders count plants, quiet, off-plant fires and agreement', () => {
  const rows = [
    { planted: 'opposed', reads: { a: 'opposed', b: 'neutral' } },
    { planted: 'irritated', reads: { a: 'opposed', b: 'irritated' } },
    { planted: 'bored', reads: { a: 'irritated', b: 'bored' } },
    { planted: null, reads: { a: 'jumping_ahead', b: 'jumping_ahead' } },
    { planted: null, reads: { a: 'neutral', b: 'neutral' } },
    { planted: null, reads: { a: 'jumping_ahead', b: 'opposed' } },
  ];
  assert.deepEqual(scoreReader(rows, 'a'), {
    rightKind: '1/2',
    quietRight: '0/1',
    wrongFireAtQuiet: '1/1',
    firesOnUnplanted: '2/3',
    fireStates: { jumping_ahead: 2 },
    unparsed: 0,
  });
  const pair = compareReaders(rows, ['a', 'b'])['a vs b'];
  assert.equal(pair.all.agree, 2);
  assert.equal(pair.unplantedBothFire, 2);
  assert.equal(pair.unplantedSameState, 1);
});

test('kappa: full agreement is 1, chance-level agreement is about 0', () => {
  assert.equal(
    kappa([
      ['x', 'x'],
      ['y', 'y'],
    ]).kappa,
    1,
  );
  const k = kappa([
    ['x', 'x'],
    ['x', 'y'],
    ['y', 'x'],
    ['y', 'y'],
  ]);
  assert.equal(k.po, 0.5);
  assert.equal(k.kappa, 0);
  assert.equal(kappa([]), null);
});
