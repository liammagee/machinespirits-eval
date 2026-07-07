import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateClaimReadiness,
  evaluatePaperIntegration,
  renderClaimReadinessReport,
} from '../scripts/report-yoked-contingency-claim-readiness.js';

test('claim readiness fails when scaled independent outcome fails', () => {
  const readiness = evaluateClaimReadiness({
    g0_visible_affect: { status: 'pass_g0_paid_smoke' },
    g1_smoke: { status: 'pass_g1_paid_smoke' },
    g1_scaled: { status: 'pass_g1_paid_smoke' },
    g2_standard_smoke: { status: 'pass_g2_independent_outcome' },
    g2_standard_scaled: {
      status: 'fail_g2_independent_outcome',
      summary: { delta2_diagnosis: 0.089, sameGreaterSessionCount: 2, sessionCount: 9, signTestOneSidedP: 0.9805 },
    },
    g2_calibrated_smoke: { status: 'pass_g2_independent_outcome' },
    g2_calibrated_scaled: {
      status: 'fail_g2_independent_outcome',
      summary: { delta2_diagnosis: 0.189, sameGreaterSessionCount: 5, sessionCount: 9, signTestOneSidedP: 0.5 },
    },
    g2_hard_transfer_smoke: null,
    g2_hard_transfer_scaled: null,
    g2_rule_transfer_smoke: null,
    g2_rule_transfer_scaled: null,
  });

  assert.equal(readiness.ready, false);
  assert.equal(readiness.status, 'not_ready_for_main_paper_claim');
  assert.equal(readiness.gates.find((gate) => gate.gate === 'G2 independent outcome scaled').status, 'fail');
});

test('claim readiness passes when hard-transfer scaled independent outcome passes', () => {
  const readiness = evaluateClaimReadiness({
    g0_visible_affect: { status: 'pass_g0_paid_smoke' },
    g1_smoke: { status: 'pass_g1_paid_smoke' },
    g1_scaled: { status: 'pass_g1_paid_smoke' },
    g2_standard_smoke: { status: 'pass_g2_independent_outcome' },
    g2_standard_scaled: { status: 'fail_g2_independent_outcome', summary: {} },
    g2_calibrated_smoke: { status: 'pass_g2_independent_outcome' },
    g2_calibrated_scaled: { status: 'fail_g2_independent_outcome', summary: {} },
    g2_hard_transfer_smoke: { status: 'pass_g2_independent_outcome' },
    g2_hard_transfer_scaled: {
      status: 'fail_g2_independent_outcome',
      summary: { delta2_diagnosis: 0.144, sameGreaterSessionCount: 6, sessionCount: 9, signTestOneSidedP: 0.2539 },
    },
    g2_rule_transfer_smoke: { status: 'pass_g2_independent_outcome' },
    g2_rule_transfer_scaled: {
      status: 'pass_g2_independent_outcome',
      summary: { delta2_diagnosis: 0.2, sameGreaterSessionCount: 7, sessionCount: 9, signTestOneSidedP: 0.09 },
    },
  });

  assert.equal(readiness.ready, true);
  assert.equal(readiness.status, 'ready_for_main_paper_claim');
});

test('claim readiness report names the next required gate', () => {
  const report = renderClaimReadinessReport({
    ready: false,
    status: 'not_ready_for_main_paper_claim',
    gates: [{ gate: 'G2 independent outcome scaled', status: 'fail', evidence: 'calibrated fail' }],
  });

  assert.match(report, /Do not add a main-paper outcome claim yet/);
  assert.match(report, /scaled independent-outcome run/);
});

test('paper integration audit recognizes the canonical bounded claim', () => {
  const integration = evaluatePaperIntegration();

  assert.equal(integration.integrated, true);
  assert.match(integration.evidence, /canonical paper contains/);
});

test('claim readiness report promotes after paper integration audit passes', () => {
  const report = renderClaimReadinessReport({
    ready: true,
    status: 'ready_for_main_paper_claim',
    gates: [{ gate: 'G2 independent outcome scaled', status: 'pass', evidence: 'rule-transfer pass' }],
    paperIntegration: { integrated: true, evidence: 'canonical paper contains §6.12.5 claim and boundaries' },
  });

  assert.match(report, /Paper integration audit \| pass/);
  assert.match(report, /now a cautious main-paper claim/);
});
