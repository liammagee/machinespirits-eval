import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  adjudicateTutorStubResistanceRecoverySemanticJudgesV3,
  buildTutorStubResistanceRecoverySemanticZeroCallFixture,
  scoreTutorStubResistanceRecoverySemanticCorpusV3,
} from '../services/tutorStubResistanceRecoverySemanticAdjudicationV3.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const v2Registration = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, 'config/tutor-stub-resistance-recovery-semantic-adjudication-registration.v2.json'),
    'utf8',
  ),
);
const corpus = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v2.json'), 'utf8'),
);
const registration = structuredClone(v2Registration);
registration.measurement.judges.push({
  id: 'recovery_semantic_judge_c',
  modelRef: 'codex.gpt-5.5',
  provider: 'codex',
  model: 'gpt-5.5',
  modelFamily: 'openai_gpt_5_5',
  effort: 'low',
  modelAttestationBasis: 'explicit_cli_model_argument_accepted_bridge_echo',
  independent: true,
});
registration.measurement.validationGates = {
  minimumJudgmentValidityRate: 0.95,
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

function panelFor(corpusCase) {
  return Object.fromEntries(
    registration.measurement.judges.map((judge) => [
      judge.id,
      buildTutorStubResistanceRecoverySemanticZeroCallFixture({ corpusCase, judge }),
    ]),
  );
}

function adjudicate(corpusCase, panel) {
  return adjudicateTutorStubResistanceRecoverySemanticJudgesV3({
    caseId: corpusCase.case_id,
    publicPacket: Object.fromEntries(
      ['trigger', 'intervention', 'prior_post_trigger', 'intervening_tutor', 'current_learner'].map((field) => [
        field,
        corpusCase[field],
      ]),
    ),
    responses: Object.values(panel).map((entry) => entry.response),
    registration,
    prompts: Object.fromEntries(Object.entries(panel).map(([judgeId, entry]) => [judgeId, entry.prompt])),
  });
}

test('three-seat outcome panel aggregates primary recovery and each diagnostic independently', () => {
  const corpusCase = corpus.cases[0];
  const panel = panelFor(corpusCase);
  const dissent = panel.recovery_semantic_judge_b.response;
  dissent.judgment.delivered_register = dissent.judgment.delivered_register === 'warm' ? 'plain' : 'warm';
  const result = adjudicate(corpusCase, panel);
  assert.equal(result.status, 'determinate');
  assert.equal(result.final_recovery, corpusCase.expected.judgment.final_recovery);
  assert.equal(result.component_measurement.delivered_register.status, 'determinate');
  assert.equal(result.component_measurement.delivered_register.value, corpusCase.expected.judgment.delivered_register);
  assert.equal(result.component_disagreement_may_veto_primary_recovery, false);
});

test('one missing or response-free seat abstains while two valid independent seats remain determinate', () => {
  const corpusCase = corpus.cases[1];
  const panel = panelFor(corpusCase);
  delete panel.recovery_semantic_judge_b;
  const result = adjudicate(corpusCase, panel);
  assert.equal(result.status, 'determinate');
  assert.equal(result.final_recovery, corpusCase.expected.judgment.final_recovery);
  assert.deepEqual(result.abstentions, [{ judge_id: 'recovery_semantic_judge_b', reason: 'missing_or_response_free' }]);
  assert.equal(result.judge_rerun_after_response_allowed, false);
  assert.equal(result.replacement_allowed, false);
});

test('fewer than two eligible seats is measurement indeterminate without repair or Fisher authority', () => {
  const corpusCase = corpus.cases[2];
  const panel = panelFor(corpusCase);
  delete panel.recovery_semantic_judge_b;
  delete panel.recovery_semantic_judge_c;
  const result = adjudicate(corpusCase, panel);
  assert.equal(result.status, 'measurement_indeterminate');
  assert.equal(result.final_recovery, 'indeterminate');
  assert.equal(result.fisher_analysis_allowed, false);
  assert.equal(result.repair_allowed, false);
  assert.equal(result.outcome_selection_allowed, false);
});

test('full unused 120-case heldout traverses the frozen hierarchical scorer at zero calls', () => {
  const responsePairs = Object.fromEntries(
    corpus.cases.map((corpusCase) => [corpusCase.case_id, panelFor(corpusCase)]),
  );
  const score = scoreTutorStubResistanceRecoverySemanticCorpusV3({ corpus, responsePairs, registration });
  assert.equal(score.status, 'passed');
  assert.equal(score.metrics.primary_sensitivity, 1);
  assert.equal(score.metrics.primary_specificity, 1);
  assert.equal(score.metrics.aggregate_component_accuracy, 1);
  assert.equal(score.metrics.multi_rater_recovery_kappa, 1);
  assert.equal(score.metrics.primary_indeterminate_cases, 0);
});
