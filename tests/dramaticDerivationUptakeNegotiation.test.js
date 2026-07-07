import assert from 'node:assert/strict';
import test from 'node:test';
import {
  UPTAKE_BENCHMARK_CASES,
  UPTAKE_NEGOTIATION_SCHEMA,
  deriveUptakeNegotiationState,
  evaluateUptakeBenchmark,
} from '../services/dramaticDerivation/index.js';

test('uptake negotiation separates accepted scaffold from verbal compliance and bypass', () => {
  const accepted = deriveUptakeNegotiationState({
    scaffoldOffered: 'contrast_case',
    learnerResponse: 'The contrast helps: not the bond line but the cause line matters because it shows what happened.',
  });
  assert.equal(accepted.schema, UPTAKE_NEGOTIATION_SCHEMA);
  assert.equal(accepted.status, 'accepted_scaffold');
  assert.equal(accepted.nextActionRecommendation, 'continue_same_scaffold');

  const verbal = deriveUptakeNegotiationState({
    scaffoldOffered: 'purpose_bridge',
    learnerResponse: 'Yes, okay, that helps.',
  });
  assert.equal(verbal.status, 'complied_verbally_only');
  assert.equal(verbal.nextActionRecommendation, 'minimal_presence');

  const bypass = deriveUptakeNegotiationState({
    scaffoldOffered: 'teach_back',
    learnerResponse: 'Can you just tell me the answer?',
  });
  assert.equal(bypass.status, 'bypassed_scaffold');
  assert.equal(bypass.nextActionRecommendation, 'switch_mode');
});

test('uptake benchmark controls pass 12/12 before artifact scoring', () => {
  assert.equal(UPTAKE_BENCHMARK_CASES.length, 12);
  const report = evaluateUptakeBenchmark();
  assert.equal(report.summary.count, 12);
  assert.equal(report.summary.pass, 12);
  assert.equal(report.summary.fail, 0);
  assert.equal(report.summary.allPassed, true);
});

test('uptake public-only audit rejects hidden fields', () => {
  const state = deriveUptakeNegotiationState({
    scaffoldOffered: 'contrast_case',
    learnerResponse: 'The contrast helps.',
    proofPath: ['p1'],
  });
  assert.equal(state.status, 'unknown');
  assert.equal(state.confidence, 0);
  assert.equal(state.inputAudit.ok, false);
});
