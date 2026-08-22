import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  adjudicateTutorStubResistanceFidelityPanelV5,
  adjudicateTutorStubResistanceRecoveryPrimaryPanelV5,
  buildTutorStubResistanceMeasurementZeroCallFixtureV5,
  scoreTutorStubResistanceMeasurementCorpusV5,
  validateTutorStubResistanceFidelityResponseV5,
  validateTutorStubResistanceRecoveryPrimaryResponseV5,
} from '../services/tutorStubResistanceRecoverySemanticAdjudicationV5.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const consumed = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v2.json'), 'utf8'),
);
const judges = [
  {
    id: 'recovery_semantic_judge_a',
    modelRef: 'codex.gpt-5.6-sol',
    provider: 'codex',
    model: 'gpt-5.6-sol',
    modelFamily: 'openai_gpt_5_6',
    effort: 'low',
    modelAttestationBasis: 'explicit_cli_model_argument_accepted_bridge_echo',
  },
  {
    id: 'recovery_semantic_judge_b',
    modelRef: 'claude-code.sonnet-5',
    provider: 'claude-code',
    model: 'claude-sonnet-5',
    modelFamily: 'anthropic_claude_5',
    effort: 'low',
    modelAttestationBasis: 'explicit_cli_model_argument_accepted_bridge_echo',
  },
  {
    id: 'recovery_semantic_judge_c',
    modelRef: 'codex.gpt-5.5',
    provider: 'codex',
    model: 'gpt-5.5',
    modelFamily: 'openai_gpt_5_5',
    effort: 'low',
    modelAttestationBasis: 'explicit_cli_model_argument_accepted_bridge_echo',
  },
];
const registration = {
  measurement: {
    judges,
    validationGates: {
      primary: {
        minimumSeatEligibilityRate: 0.95,
        minimumPanelsWithTwoEligibleVoters: 0.95,
        minimumPerJudgeConditionalAccuracy: 0.95,
        minimumPerJudgeCoverage: 0.9,
        minimumPanelSensitivity: 0.95,
        minimumPanelSpecificity: 0.95,
        minimumPanelExactAccuracy: 0.95,
        minimumPanelDeterminedCoverage: 0.95,
        minimumPanelCoveragePerStratum: 0.9,
        minimumCrossFamilyJointCoverage: 0.85,
        minimumCrossFamilyConditionalAgreement: 0.9,
      },
      fidelity: {
        minimumSeatEligibilityRate: 0.95,
        minimumPerJudgeCoverage: 0.9,
        minimumPerJudgeActionConditionalAccuracy: 0.95,
        minimumPerJudgeRegisterConditionalAccuracy: 0.95,
        minimumPanelActionAccuracy: 0.95,
        minimumPanelActionCoverage: 0.95,
        minimumPanelRegisterAccuracy: 0.95,
        minimumPanelRegisterCoverage: 0.95,
        minimumPanelRegisterRecallPerClass: 0.9,
        minimumCrossFamilyJointCoverage: 0.85,
        minimumCrossFamilyConditionalAgreement: 0.9,
      },
    },
  },
};
const packetFields = ['trigger', 'intervention', 'prior_post_trigger', 'intervening_tutor', 'current_learner'];

function adaptCase(row) {
  return {
    ...row,
    expected: {
      primary: {
        bounded_test_merits_engagement: row.expected.judgment.bounded_test_merits_engagement,
        grounded_precise_jurisdictional_condition: row.expected.judgment.grounded_precise_jurisdictional_condition,
        final_recovery: row.expected.judgment.final_recovery,
      },
      primary_evidence: row.expected.evidence.filter((quote) =>
        ['bounded_test_merits_engagement', 'grounded_precise_jurisdictional_condition'].includes(quote.field),
      ),
      fidelity: {
        delivered_clarify_distinction: row.expected.judgment.delivered_clarify_distinction,
        delivered_register: row.expected.judgment.delivered_register,
      },
      fidelity_evidence: row.expected.evidence.filter((quote) =>
        ['delivered_clarify_distinction', 'delivered_register'].includes(quote.field),
      ),
    },
  };
}

const corpus = { cases: consumed.cases.map(adaptCase) };

function panel(corpusCase, instrument) {
  return Object.fromEntries(
    judges.map((judge) => [
      judge.id,
      buildTutorStubResistanceMeasurementZeroCallFixtureV5({ corpusCase, judge, instrument }),
    ]),
  );
}

test('V5 derives quote offsets and never asks a model to calculate them', () => {
  const corpusCase = corpus.cases.find((row) => row.expected.primary_evidence.length > 0);
  const fixture = panel(corpusCase, 'primary_recovery')[judges[0].id];
  assert.equal(Object.hasOwn(fixture.response.judgment.evidence_quotes[0], 'start_utf16'), false);
  const validation = validateTutorStubResistanceRecoveryPrimaryResponseV5({
    caseId: corpusCase.case_id,
    publicPacket: Object.fromEntries(packetFields.map((field) => [field, corpusCase[field]])),
    response: fixture.response,
    judge: judges[0],
    prompt: fixture.prompt,
  });
  assert.equal(validation.eligible, true);
  assert.equal(validation.derived_evidence[0].start_utf16 >= 0, true);
  assert.equal(
    corpusCase[validation.derived_evidence[0].source_id].slice(
      validation.derived_evidence[0].start_utf16,
      validation.derived_evidence[0].end_utf16,
    ),
    validation.derived_evidence[0].text,
  );
});

test('V5 fidelity judges see only the intervention and cannot veto primary recovery', () => {
  const corpusCase = corpus.cases.find(
    (row) => row.expected.primary.final_recovery === 'yes' && row.expected.fidelity.delivered_register === 'warm',
  );
  const primaryPanel = panel(corpusCase, 'primary_recovery');
  const fidelityPanel = panel(corpusCase, 'intervention_fidelity');
  for (const entry of Object.values(fidelityPanel)) {
    assert.deepEqual(Object.keys(entry.prompt.public_packet), ['intervention']);
    assert.equal(entry.prompt.independence.learner_outcome_visible, false);
  }
  fidelityPanel[judges[0].id].response.judgment.delivered_register = 'indeterminate';
  fidelityPanel[judges[0].id].response.judgment.confidence = 'low';
  fidelityPanel[judges[0].id].response.judgment.indeterminacy_reason = 'semantic_ambiguity';
  const primary = adjudicateTutorStubResistanceRecoveryPrimaryPanelV5({
    caseId: corpusCase.case_id,
    publicPacket: Object.fromEntries(packetFields.map((field) => [field, corpusCase[field]])),
    responses: Object.values(primaryPanel).map((entry) => entry.response),
    registration,
    prompts: Object.fromEntries(Object.entries(primaryPanel).map(([id, entry]) => [id, entry.prompt])),
  });
  const fidelity = adjudicateTutorStubResistanceFidelityPanelV5({
    caseId: corpusCase.case_id,
    intervention: corpusCase.intervention,
    responses: Object.values(fidelityPanel).map((entry) => entry.response),
    registration,
    prompts: Object.fromEntries(Object.entries(fidelityPanel).map(([id, entry]) => [id, entry.prompt])),
  });
  assert.equal(primary.status, 'determinate');
  assert.equal(primary.final_recovery, 'yes');
  assert.equal(primary.fidelity_may_veto_primary_measurement, false);
  assert.equal(fidelity.register_measurement.value, 'warm');
  assert.equal(fidelity.primary_recovery_may_be_recoded_or_vetoed, false);
});

test('V5 treats low confidence and disagreement as indeterminate without repair or replacement', () => {
  const corpusCase = corpus.cases[0];
  const entries = panel(corpusCase, 'primary_recovery');
  entries[judges[0].id].response.judgment.confidence = 'low';
  entries[judges[0].id].response.judgment.indeterminacy_reason = 'other';
  entries[judges[1].id].response.judgment.bounded_test_merits_engagement = 'no';
  entries[judges[1].id].response.judgment.final_recovery = 'no';
  entries[judges[2].id].response.judgment.grounded_precise_jurisdictional_condition = 'yes';
  const result = adjudicateTutorStubResistanceRecoveryPrimaryPanelV5({
    caseId: corpusCase.case_id,
    publicPacket: Object.fromEntries(packetFields.map((field) => [field, corpusCase[field]])),
    responses: Object.values(entries).map((entry) => entry.response),
    registration,
    prompts: Object.fromEntries(Object.entries(entries).map(([id, entry]) => [id, entry.prompt])),
  });
  assert.equal(result.status, 'measurement_indeterminate');
  assert.equal(result.repair_rerun_replacement_or_selection_allowed, false);
});

test('V5 rejects prose-like or wrong-source returns independently in each instrument', () => {
  const corpusCase = corpus.cases.find((row) => row.expected.primary_evidence.length > 0);
  const primary = panel(corpusCase, 'primary_recovery')[judges[0].id];
  primary.response.judgment.evidence_quotes[0].source_id = 'intervention';
  const primaryValidation = validateTutorStubResistanceRecoveryPrimaryResponseV5({
    caseId: corpusCase.case_id,
    publicPacket: Object.fromEntries(packetFields.map((field) => [field, corpusCase[field]])),
    response: primary.response,
    judge: judges[0],
    prompt: primary.prompt,
  });
  assert.equal(primaryValidation.eligible, false);
  assert.ok(primaryValidation.issues.some((issue) => issue.includes('post_trigger_learner')));

  const fidelity = panel(corpusCase, 'intervention_fidelity')[judges[0].id];
  fidelity.response.provenance.structured_output = false;
  const fidelityValidation = validateTutorStubResistanceFidelityResponseV5({
    caseId: corpusCase.case_id,
    intervention: corpusCase.intervention,
    response: fidelity.response,
    judge: judges[0],
    prompt: fidelity.prompt,
  });
  assert.equal(fidelityValidation.eligible, false);
  assert.ok(fidelityValidation.issues.includes('structured_output_not_observed'));
});

test('consumed V2 corpus is a zero-call engineering regression only and passes split V5 scoring', () => {
  const responsePairs = Object.fromEntries(
    corpus.cases.map((corpusCase) => [
      corpusCase.case_id,
      {
        primary: panel(corpusCase, 'primary_recovery'),
        fidelity: panel(corpusCase, 'intervention_fidelity'),
      },
    ]),
  );
  const score = scoreTutorStubResistanceMeasurementCorpusV5({ corpus, responsePairs, registration });
  assert.equal(score.status, 'passed');
  assert.equal(score.primary.status, 'passed');
  assert.equal(score.fidelity.status, 'passed');
  assert.equal(score.primary_and_fidelity_claims_separate, true);
  assert.equal(score.fidelity_failure_may_erase_primary_validation, false);
});
