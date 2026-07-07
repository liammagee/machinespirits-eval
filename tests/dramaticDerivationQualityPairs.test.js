import assert from 'node:assert/strict';
import test from 'node:test';
import {
  QUALITY_PAIR_CASES,
  QUALITY_PAIR_REPORT_SCHEMA,
  evaluateQualityPair,
  evaluateQualityPairs,
} from '../services/dramaticDerivation/index.js';

test('quality-pair controls pass and keep proof-matching explicit', () => {
  const report = evaluateQualityPairs();
  assert.equal(report.schema, QUALITY_PAIR_REPORT_SCHEMA);
  assert.equal(report.summary.count, QUALITY_PAIR_CASES.length);
  assert.equal(report.summary.fail, 0);
  assert.equal(report.summary.allPassed, true);
});

test('quality-pair scorer disqualifies release-timing mismatch', () => {
  const mismatch = QUALITY_PAIR_CASES.find((row) => row.id === 'proof-mismatch-disqualifies-quality-claim');
  const result = evaluateQualityPair(mismatch);
  assert.equal(result.proofMatched, false);
  assert.equal(result.decision, 'not_proof_matched');
  assert.ok(result.proofMismatchReasons.includes('release_timing'));
});

test('quality-pair scorer separates prose-only warmth from a quality win', () => {
  const proseOnly = QUALITY_PAIR_CASES.find((row) => row.id === 'warmer-prose-without-use-is-not-a-quality-win');
  const result = evaluateQualityPair(proseOnly);
  assert.equal(result.proofMatched, true);
  assert.equal(result.decision, 'no_qualifying_gain');
  assert.ok(result.delta < 0.4);
});
