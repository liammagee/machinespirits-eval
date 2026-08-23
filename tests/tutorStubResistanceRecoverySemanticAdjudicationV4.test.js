import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  adjudicateTutorStubResistanceRecoverySemanticJudgesV4,
  buildTutorStubResistanceRecoverySemanticZeroCallFixture,
  normalizeTutorStubResistanceRecoverySemanticEvidenceV4,
  scoreTutorStubResistanceRecoverySemanticCorpusV4,
} from '../services/tutorStubResistanceRecoverySemanticAdjudicationV4.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registration = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, 'config/tutor-stub-resistance-recovery-semantic-adjudication-registration.v3.json'),
    'utf8',
  ),
);
registration.measurement.validationGates = {
  minimumPrimarySeatValidityRate: 0.95,
  minimumPanelsWithTwoEligibleVoters: 0.95,
  minimumPerJudgeFinalRecoveryAccuracy: 0.85,
  minimumPrimarySensitivity: 0.95,
  minimumPrimarySpecificity: 0.95,
  minimumPrimaryExactAccuracy: 0.95,
  minimumPrimaryDeterminedCoverageOverall: 0.95,
  minimumPrimaryDeterminedCoveragePerStratum: 0.9,
  minimumAggregateComponentAccuracy: 0.9,
  minimumAggregateComponentDeterminedCoverage: 0.9,
  minimumActionClassificationAccuracy: 0.95,
  minimumRegisterClassificationAccuracy: 0.95,
  minimumMeanPairwiseRecoveryAgreement: 0.85,
  minimumMultiRaterRecoveryKappa: 0.75,
  maximumProhibitedToolEvents: 0,
};
const corpus = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v2.json'), 'utf8'),
);
const packetFields = ['trigger', 'intervention', 'prior_post_trigger', 'intervening_tutor', 'current_learner'];

function panelFor(corpusCase) {
  return Object.fromEntries(
    registration.measurement.judges.map((judge) => [
      judge.id,
      buildTutorStubResistanceRecoverySemanticZeroCallFixture({ corpusCase, judge }),
    ]),
  );
}

function adjudicate(corpusCase, panel) {
  return adjudicateTutorStubResistanceRecoverySemanticJudgesV4({
    caseId: corpusCase.case_id,
    publicPacket: Object.fromEntries(packetFields.map((field) => [field, corpusCase[field]])),
    responses: Object.values(panel).map((entry) => entry.response),
    registration,
    prompts: Object.fromEntries(Object.entries(panel).map(([judgeId, entry]) => [judgeId, entry.prompt])),
  });
}

test('V4 derives numeric offsets from unique exact quotes instead of trusting model arithmetic', () => {
  const corpusCase = corpus.cases.find((row) => row.expected.evidence.length > 1);
  const panel = panelFor(corpusCase);
  for (const span of panel.recovery_semantic_judge_b.response.judgment.evidence_spans) {
    span.start_utf16 = 0;
    span.end_utf16 = 1;
  }
  panel.recovery_semantic_judge_b.response.judgment.confidence = 'medium';
  const packet = Object.fromEntries(packetFields.map((field) => [field, corpusCase[field]]));
  const normalized = normalizeTutorStubResistanceRecoverySemanticEvidenceV4({
    publicPacket: packet,
    response: panel.recovery_semantic_judge_b.response,
  });
  for (const span of normalized.judgment.evidence_spans) {
    assert.equal(packet[span.source_id].slice(span.start_utf16, span.end_utf16), span.text);
  }
  const result = adjudicate(corpusCase, panel);
  assert.equal(result.status, 'determinate');
  assert.equal(result.final_recovery, corpusCase.expected.judgment.final_recovery);
  assert.equal(result.eligible_judges.includes('recovery_semantic_judge_b'), true);
});

test('diagnostic evidence defects remain field-local and cannot veto primary recovery', () => {
  const corpusCase = corpus.cases.find(
    (row) =>
      row.expected.judgment.final_recovery === 'yes' && row.expected.judgment.delivered_clarify_distinction === 'yes',
  );
  const panel = panelFor(corpusCase);
  const response = panel.recovery_semantic_judge_b.response;
  response.judgment.evidence_spans = response.judgment.evidence_spans.filter(
    (span) => span.field !== 'delivered_clarify_distinction' && span.field !== 'delivered_register',
  );
  const result = adjudicate(corpusCase, panel);
  const validity = result.validation.find((entry) => entry.judge_id === 'recovery_semantic_judge_b');
  assert.equal(validity.primary_valid, true);
  assert.equal(validity.component_validity.delivered_clarify_distinction, false);
  assert.equal(validity.component_validity.delivered_register, false);
  assert.equal(result.status, 'determinate');
  assert.equal(result.final_recovery, 'yes');
  assert.equal(result.component_disagreement_may_veto_primary_recovery, false);
});

test('low confidence abstains while medium determinate remains eligible', () => {
  const corpusCase = corpus.cases[0];
  const panel = panelFor(corpusCase);
  panel.recovery_semantic_judge_b.response.judgment.confidence = 'medium';
  panel.recovery_semantic_judge_c.response.judgment.confidence = 'low';
  const result = adjudicate(corpusCase, panel);
  assert.equal(result.status, 'determinate');
  assert.equal(result.eligible_judges.includes('recovery_semantic_judge_b'), true);
  assert.equal(result.eligible_judges.includes('recovery_semantic_judge_c'), false);
  assert.equal(
    result.abstentions.find((entry) => entry.judge_id === 'recovery_semantic_judge_c').reason,
    'confidence_low_or_invalid',
  );
});

test('consumed V2 corpus traverses V4 only as a zero-call engineering regression', () => {
  const responsePairs = Object.fromEntries(
    corpus.cases.map((corpusCase) => {
      const panel = panelFor(corpusCase);
      for (const span of panel.recovery_semantic_judge_b.response.judgment.evidence_spans) {
        span.start_utf16 = 0;
        span.end_utf16 = 1;
      }
      panel.recovery_semantic_judge_b.response.judgment.confidence = 'medium';
      return [corpusCase.case_id, panel];
    }),
  );
  const score = scoreTutorStubResistanceRecoverySemanticCorpusV4({ corpus, responsePairs, registration });
  assert.equal(score.status, 'passed');
  assert.equal(score.metrics.primary_seat_validity_rate, 1);
  assert.equal(score.metrics.primary_exact_accuracy, 1);
  assert.equal(score.metrics.aggregate_component_accuracy, 1);
  assert.equal(score.metrics.multi_rater_recovery_kappa, 1);
});
