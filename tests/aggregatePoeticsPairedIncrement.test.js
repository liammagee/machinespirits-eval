import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { classifyPair, validScored, wilson } from '../scripts/aggregate-poetics-paired-increment.js';

const item = ({ totalCritics = 4, failures = [], pass = false } = {}) => ({
  consensus: { totalCritics },
  failures,
  pass,
});

test('classifyPair: clean controls + passing peripeteia → positive (lift=1)', () => {
  const r = classifyPair({
    peri: item({ pass: true }),
    controls: [item({ pass: false }), item({ pass: false })],
    minCritics: 4,
  });
  assert.equal(r.status, 'positive');
  assert.equal(r.lift, 1);
});

test('classifyPair: clean controls + failing peripeteia → null (lift=0)', () => {
  const r = classifyPair({
    peri: item({ pass: false, failures: ['action_gap'] }),
    controls: [item()],
    minCritics: 4,
  });
  assert.equal(r.status, 'null');
  assert.equal(r.lift, 0);
});

test('classifyPair: under-scored peripeteia arm → invalid_coverage', () => {
  const r = classifyPair({ peri: item({ totalCritics: 3, pass: false }), controls: [item()], minCritics: 4 });
  assert.equal(r.status, 'invalid_coverage');
  assert.equal(r.lift, null);
});

test('classifyPair: no validly-scored control → invalid_coverage', () => {
  const r = classifyPair({ peri: item({ pass: true }), controls: [item({ totalCritics: 2 })], minCritics: 4 });
  assert.equal(r.status, 'invalid_coverage');
  assert.equal(r.lift, null);
});

test('classifyPair: a leaking valid control invalidates the scenario (not failed-on-treatment)', () => {
  const r = classifyPair({
    peri: item({ pass: true }),
    controls: [item({ failures: ['control_leak'] })],
    minCritics: 4,
  });
  assert.equal(r.status, 'invalid_control_leak');
  assert.equal(r.lift, null);
});

test('classifyPair: a quality-warned peripeteia arm is not validly scored → invalid_coverage', () => {
  const r = classifyPair({
    peri: item({ pass: false, failures: ['quality_warning'] }),
    controls: [item()],
    minCritics: 4,
  });
  assert.equal(r.status, 'invalid_coverage');
  assert.equal(r.lift, null);
});

test('validScored requires enough critics and no quality warning', () => {
  assert.equal(validScored(item({ totalCritics: 4 }), 4), true);
  assert.equal(validScored(item({ totalCritics: 3 }), 4), false);
  assert.equal(validScored(item({ totalCritics: 4, failures: ['quality_warning'] }), 4), false);
});

test('wilson score interval: empty is [0,0]; 1/3 excludes 0 but is wide', () => {
  assert.deepEqual(wilson(0, 0), { low: 0, high: 0 });
  const w = wilson(1, 3);
  assert.ok(w.low > 0 && w.low < 0.2, `low ${w.low}`);
  assert.ok(w.high > 0.5 && w.high <= 1, `high ${w.high}`);
});
