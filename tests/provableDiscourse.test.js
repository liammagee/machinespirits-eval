import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cohensD,
  computeLearnerSummaryFromScores,
  evaluateAssertion,
  evaluateSymmetryRule,
  inferMultiFromProfileName,
  inferRecognitionFromProfileName,
} from '../services/provableDiscourse.js';

test('inferRecognitionFromProfileName classifies canonical names', () => {
  assert.equal(inferRecognitionFromProfileName('cell_5_recog_single_unified'), true);
  assert.equal(inferRecognitionFromProfileName('cell_1_base_single_unified'), false);
  assert.equal(inferRecognitionFromProfileName('unclassified_profile'), null);
});

test('inferMultiFromProfileName classifies single vs multi', () => {
  assert.equal(inferMultiFromProfileName('cell_5_recog_single_unified'), false);
  assert.equal(inferMultiFromProfileName('cell_63_recog_dialectical_profile_bidirectional_psycho'), true);
  assert.equal(inferMultiFromProfileName('unknown_profile'), null);
});

test('computeLearnerSummaryFromScores computes avg/final/arc', () => {
  const learnerScores = JSON.stringify({
    turn_1: {
      turnIndex: 1,
      scores: {
        revision_signals: { score: 2 },
        question_quality: { score: 3 },
        conceptual_engagement: { score: 3 },
      },
    },
    turn_2: {
      turnIndex: 2,
      scores: {
        revision_signals: { score: 4 },
        question_quality: { score: 4 },
        conceptual_engagement: { score: 5 },
      },
    },
  });

  const summary = computeLearnerSummaryFromScores(learnerScores);
  assert.ok(summary);
  assert.equal(summary.turnCount, 2);
  assert.ok(summary.avgComposite > 0);
  assert.ok(summary.finalComposite > summary.avgComposite);
  assert.ok(summary.learningArc > 0);
  assert.equal(summary.revisionArc, 2);
});

test('evaluateAssertion supports approx and abs_lte', () => {
  const approxPass = evaluateAssertion(0.33, { op: 'approx', expected: 0.32, tolerance_abs: 0.02 });
  const approxFail = evaluateAssertion(0.40, { op: 'approx', expected: 0.32, tolerance_abs: 0.02 });
  const absPass = evaluateAssertion(-0.05, { op: 'abs_lte', expected: 0.1 });

  assert.equal(approxPass.pass, true);
  assert.equal(approxFail.pass, false);
  assert.equal(absPass.pass, true);
});

test('evaluateSymmetryRule handles both_abs_lte and abs_gap_gte', () => {
  const claimById = new Map([
    [
      'left',
      {
        statement_found: true,
        actual_value: -1.03,
      },
    ],
    [
      'right',
      {
        statement_found: true,
        actual_value: 0.32,
      },
    ],
  ]);

  const bothSmall = evaluateSymmetryRule(
    { id: 'rule.small', type: 'both_abs_lte', left_claim_id: 'left', right_claim_id: 'right', threshold: 1.2 },
    claimById,
  );
  const gapRule = evaluateSymmetryRule(
    { id: 'rule.gap', type: 'abs_gap_gte', left_claim_id: 'left', right_claim_id: 'right', threshold: 0.5 },
    claimById,
  );

  assert.equal(bothSmall.status, 'pass');
  assert.equal(gapRule.status, 'pass');
});

test('cohensD returns expected direction', () => {
  const d = cohensD([10, 11, 12, 13], [1, 2, 3, 4]);
  assert.ok(d > 0);
});

