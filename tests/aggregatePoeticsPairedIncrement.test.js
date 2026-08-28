import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import yaml from 'yaml';
import {
  buildPairs,
  classifyPair,
  parseArgs,
  tutorAdaptiveMechanismValue,
  validScored,
  wilson,
} from '../scripts/aggregate-poetics-paired-increment.js';
import { openPoeticsStore, upsertPoeticsItem, upsertPoeticsRun } from '../services/poeticsStore.js';

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
  assert.throws(
    () =>
      parseArgs([
        '--run-id',
        'historical-run',
        '--run-id',
        'historical-run',
        '--target-only',
        'D42,D50,D53',
        '--historical-v4',
      ]),
    /--run-id values must be unique/,
  );
  assert.throws(
    () => parseArgs(['--run-id', 'historical-run', '--target-only', 'D42,D42,D53', '--historical-v4']),
    /--target-only values must be unique/,
  );
  assert.throws(
    () =>
      parseArgs([
        '--run-id',
        'historical-run',
        '--target-only',
        'D42,D50,D53',
        '--historical-v4',
        '--item-gates-in',
        'gates.jsonl',
        '--db',
        'evidence.db',
      ]),
    /mutually exclusive historical evidence sources/,
  );
  assert.throws(
    () => parseArgs(['--run-id', 'semantic-run', '--target-only', 'D50,D53,D55', '--item-gates-in', 'gates.jsonl']),
    /historical-reproduction-only/,
  );
});

test('historical item-gate reaggregation contract returns the published 3/9 shape without re-scoring', () => {
  const runIds = ['historical-i01', 'historical-i02', 'historical-i03'];
  const targetOnly = ['D42', 'D50', 'D53'];
  const positiveKeys = new Set(['historical-i01:D42', 'historical-i02:D50', 'historical-i03:D53']);
  const rows = [];
  for (const runId of runIds) {
    for (const dramaId of targetOnly) {
      for (const arm of ['routine', 'none', 'peripeteia-only']) {
        const positive = positiveKeys.has(`${runId}:${dramaId}`);
        const treatment = arm === 'peripeteia-only';
        rows.push({
          runId,
          dramaId,
          arm,
          tid: dramaId,
          recognitionVotes: treatment ? (positive ? 4 : 2) : 0,
          totalCritics: 4,
          claimStatus: treatment && positive ? 'claimable' : 'negative',
          actionalVotes: treatment ? (positive ? 4 : 2) : 0,
          publicMechanism: treatment ? positive : false,
          originAmbiguous: treatment,
          pass: treatment ? positive : true,
          failures: treatment && !positive ? ['action_gap'] : [],
        });
      }
    }
  }
  const pairs = buildPairs(rows, { runIds, targetOnly, minCritics: 4 });
  assert.equal(pairs.length, 9);
  assert.equal(pairs.filter((pair) => pair.status === 'positive').length, 3);
  assert.equal(pairs.filter((pair) => pair.status === 'null').length, 6);
  assert.equal(pairs.filter((pair) => pair.status === 'invalid_control_leak').length, 0);
  assert.equal(pairs.reduce((sum, pair) => sum + pair.lift, 0) / pairs.length, 1 / 3);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-historical-v4-gate-file-'));
  const inputPath = path.join(root, 'item-gates.jsonl');
  const outPath = path.join(root, 'aggregate.json');
  fs.writeFileSync(inputPath, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8');
  const result = spawnSync(
    process.execPath,
    [
      path.resolve('scripts/aggregate-poetics-paired-increment.js'),
      ...runIds.flatMap((runId) => ['--run-id', runId]),
      '--target-only',
      'D42,D50,D53',
      '--historical-v4',
      '--item-gates-in',
      inputPath,
      '--out',
      outPath,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.equal(summary.aggregate.validPairs, 9);
  assert.equal(summary.aggregate.positive, 3);
  assert.equal(summary.aggregate.null, 6);
  assert.equal(summary.aggregate.invalidControlLeak, 0);
  assert.equal(summary.aggregate.recognitiveClosureLift, 1 / 3);
  assert.equal(summary.evidenceSource.mode, 'historical_v4_item_gate_reaggregation');
  assert.equal(summary.evidenceSource.claimUse, 'historical_reproduction_only');
  assert.match(summary.evidenceSource.sha256, /^[a-f0-9]{64}$/);
});

test('historical-v4 database reproduction fails closed when all 27 expected measurements are absent', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-historical-v4-missing-'));
  const dbPath = path.join(root, 'poetics.db');
  const outPath = path.join(root, 'aggregate.json');
  const itemGatesOut = path.join(root, 'item-gates.jsonl');
  const runIds = ['historical-i01', 'historical-i02', 'historical-i03'];
  const targets = [
    ['D42', 'T18'],
    ['D50', 'T24'],
    ['D53', 'T15'],
  ];
  const db = openPoeticsStore(dbPath);
  try {
    for (const runId of runIds) {
      upsertPoeticsRun(db, { id: runId, sourceRoot: path.join(root, runId) });
      for (const [dramaId, tid] of targets) {
        for (const arm of ['routine', 'none', 'peripeteia-only']) {
          upsertPoeticsItem(db, {
            id: `${runId}:${dramaId}:${arm}`,
            runId,
            unitId: 'target-r01',
            repeat: 'r01',
            arm,
            tid,
            dramaId,
            qualityStatus: 'ok',
            qualityWarnings: [],
          });
        }
      }
    }
  } finally {
    db.close();
  }

  const result = spawnSync(
    process.execPath,
    [
      path.resolve('scripts/aggregate-poetics-paired-increment.js'),
      ...runIds.flatMap((runId) => ['--run-id', runId]),
      '--target-only',
      'D42,D50,D53',
      '--historical-v4',
      '--db',
      dbPath,
      '--out',
      outPath,
      '--item-gates-out',
      itemGatesOut,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 1, result.stdout || result.stderr);
  assert.match(result.stderr, /missing tutor-adaptation-v4 measurement for 27\/27 selected items/);
  assert.match(result.stderr, /Do not interpret absent measurements as null outcomes/);
  assert.equal(fs.existsSync(outPath), false);
  assert.equal(fs.existsSync(itemGatesOut), false);
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
    /--target-only values must be unique/,
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
