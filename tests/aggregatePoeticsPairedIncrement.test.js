import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import yaml from 'yaml';
import {
  classifyPair,
  parseArgs,
  tutorAdaptiveMechanismValue,
  validScored,
  wilson,
} from '../scripts/aggregate-poetics-paired-increment.js';

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

test('classifyPair: semantic indeterminacy is excluded rather than counted as a null outcome', () => {
  for (const failure of ['mechanism_measurement_indeterminate', 'learner_measurement_indeterminate']) {
    const r = classifyPair({
      peri: item({ pass: false, failures: [failure] }),
      controls: [item()],
      minCritics: 4,
    });
    assert.equal(r.status, 'measurement_indeterminate');
    assert.equal(r.lift, null);
    assert.match(r.reason, new RegExp(failure));
  }
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

test('paired-increment aggregation has no implicit D42/v4 claim default', () => {
  assert.throws(
    () => parseArgs(['--run-id', 'historical-run']),
    /--target-only is required; there is no implicit clean-anchor default/,
  );
  assert.throws(
    () => parseArgs(['--run-id', 'historical-run', '--target-only', 'D42,D50,D53']),
    /D42 is calibration-only/,
  );
  const historical = parseArgs(['--run-id', 'historical-run', '--target-only', 'D42,D50,D53', '--historical-v4']);
  assert.equal(historical.analyzerVersion, 'tutor-adaptation-v4');
});

test('new paired-increment aggregation requires the registered semantic-v5 anchor set', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-paired-increment-targets-'));
  const targetSpec = path.join(root, 'targets.yaml');
  fs.writeFileSync(
    targetSpec,
    yaml.stringify({
      meta: {
        clean_anchor_set: {
          status: 'complete',
          required_core: ['D50', 'D53'],
          qualified_third_anchor: 'D55',
          claim_gate_ready: true,
        },
      },
    }),
    'utf8',
  );
  const args = parseArgs([
    '--run-id',
    'semantic-run',
    '--target-spec',
    targetSpec,
    '--target-only',
    'D50,D53,D55',
    '--analyzer-version',
    'tutor-adaptation-v5-semantic-change',
  ]);
  assert.deepEqual(args.targetOnly, ['D50', 'D53', 'D55']);
  assert.equal(args.analyzerVersion, 'tutor-adaptation-v5-semantic-change');
  assert.throws(
    () =>
      parseArgs([
        '--run-id',
        'semantic-run',
        '--target-spec',
        targetSpec,
        '--target-only',
        'D50,D50,D53',
        '--analyzer-version',
        'tutor-adaptation-v5-semantic-change',
      ]),
    /must match the registered clean anchor set/,
  );
});

test('validScored requires enough critics with no quality or scorer failure', () => {
  assert.equal(validScored(item({ totalCritics: 4 }), 4), true);
  assert.equal(validScored(item({ totalCritics: 3 }), 4), false);
  assert.equal(validScored(item({ totalCritics: 4, failures: ['quality_warning'] }), 4), false);
  assert.equal(validScored(item({ totalCritics: 4, failures: ['scorer_error'] }), 4), false);
});

test('paired-increment evidence exports read the canonical tutor mechanism field with legacy fallback', () => {
  assert.equal(tutorAdaptiveMechanismValue({ adaptationGate: { tutorAdaptiveMechanism: true } }), true);
  assert.equal(tutorAdaptiveMechanismValue({ adaptationGate: { tutorAdaptiveMechanism: false } }), false);
  assert.equal(tutorAdaptiveMechanismValue({ adaptationGate: { publicMechanism: true } }), true);
  assert.equal(tutorAdaptiveMechanismValue({ adaptationGate: {} }), null);
});

test('wilson score interval: empty is [0,0]; 1/3 excludes 0 but is wide', () => {
  assert.deepEqual(wilson(0, 0), { low: 0, high: 0 });
  const w = wilson(1, 3);
  assert.ok(w.low > 0 && w.low < 0.2, `low ${w.low}`);
  assert.ok(w.high > 0.5 && w.high <= 1, `high ${w.high}`);
});
