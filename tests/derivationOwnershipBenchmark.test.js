import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateOwnershipBenchmark,
  OWNERSHIP_BENCHMARK_CASES,
  OWNERSHIP_BENCHMARK_SCHEMA,
} from '../services/dramaticDerivation/index.js';
import { parseArgs } from '../scripts/derivation-ownership-benchmark.js';

test('ownership benchmark contains the declared compact control set', () => {
  assert.equal(OWNERSHIP_BENCHMARK_CASES.length, 12);

  const counts = OWNERSHIP_BENCHMARK_CASES.reduce((acc, row) => {
    acc[row.controlType] = (acc[row.controlType] || 0) + 1;
    return acc;
  }, {});

  assert.deepEqual(counts, {
    positive: 4,
    negative: 4,
    disqualification: 4,
  });
});

test('ownership benchmark controls pass before mined artifact scoring', () => {
  const report = evaluateOwnershipBenchmark();

  assert.equal(report.schema, OWNERSHIP_BENCHMARK_SCHEMA);
  assert.equal(report.summary.count, 12);
  assert.equal(report.summary.fail, 0);
  assert.equal(report.summary.allPassed, true);

  for (const row of report.cases.filter((item) => item.controlType === 'positive')) {
    assert.equal(row.comparison.reliabilityMatched, true, row.id);
    assert.equal(row.decision, 'eligible_for_replay_gate', row.id);
    assert.ok(row.comparison.meanOwnershipDelta >= 0.5, row.id);
  }

  for (const row of report.cases.filter((item) => item.controlType === 'negative')) {
    assert.equal(row.comparison.reliabilityMatched, true, row.id);
    assert.equal(row.decision, 'matched_reliability_no_ownership_gain', row.id);
    assert.ok(row.comparison.meanOwnershipDelta < 0.5, row.id);
  }

  for (const row of report.cases.filter((item) => item.controlType === 'disqualification')) {
    assert.equal(row.comparison.reliabilityMatched, false, row.id);
    assert.equal(row.decision, 'not_matched_reliability', row.id);
  }
});

test('ownership benchmark CLI parses output override', () => {
  const opts = parseArgs(['--out', 'exports/tmp-ownership-benchmark']);
  assert.match(opts.out, /exports\/tmp-ownership-benchmark$/u);
});
