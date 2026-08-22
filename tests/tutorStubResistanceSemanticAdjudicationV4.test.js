import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3,
  buildTutorStubResistanceSemanticZeroCallFixtureResponseV3,
} from '../services/tutorStubResistanceSemanticAdjudicationV3.js';
import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_ENSEMBLE_SCHEMA_V4,
  adjudicateTutorStubResistanceSemanticJudgesV4,
  validateTutorStubResistanceSemanticRegistrationV4,
} from '../services/tutorStubResistanceSemanticAdjudicationV4.js';
import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_HELDOUT_CORPUS_V4,
  validateTutorStubResistanceSemanticHeldoutCorpusV4,
} from '../services/tutorStubResistanceSemanticHeldoutCorpusV4.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registration = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'config/tutor-stub-resistance-semantic-adjudication-registration.v4.json'), 'utf8'),
);
const fileSha256 = (relativePath) =>
  crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(ROOT, relativePath)))
    .digest('hex');

const source =
  'Your office has no right to impose that question or its evidentiary test, so I will not answer it or inspect either record.';
const publicContext = [{ role: 'assistant', text: 'Will you compare the two public records under this question?' }];
const corpusCase = {
  case_id: 'v4-development-refuser',
  public_context: publicContext,
  source,
  expected: {
    label: 'frame_refuser',
    judgment: {
      jurisdiction_dispute: 'yes',
      interlocutor_standing_or_right: 'yes',
      inquiry_or_question_frame_governance: 'yes',
      test_or_criterion_governance: 'yes',
      other_jurisdictional_governance: 'no',
      licensed_participation: 'no',
      participation_withholding: 'yes',
      productive_counterframing: 'no',
      final_label: 'frame_refuser',
    },
    evidence: {
      jurisdiction_dispute: { source_id: 'utterance', text: 'no right to impose that question' },
      interlocutor_standing_or_right: { source_id: 'utterance', text: 'Your office has no right' },
      inquiry_or_question_frame_governance: { source_id: 'utterance', text: 'impose that question' },
      test_or_criterion_governance: { source_id: 'utterance', text: 'its evidentiary test' },
      other_jurisdictional_governance: null,
      licensed_participation: null,
      participation_withholding: { source_id: 'utterance', text: 'I will not answer it or inspect either record' },
      productive_counterframing: null,
    },
  },
};

function panel() {
  return Object.fromEntries(
    registration.measurement.judges.map((judge) => [
      judge.id,
      buildTutorStubResistanceSemanticZeroCallFixtureResponseV3({ corpusCase, judge }),
    ]),
  );
}

function adjudicate(fixtures, advisorySignals = []) {
  return adjudicateTutorStubResistanceSemanticJudgesV4({
    source,
    publicContext,
    caseId: corpusCase.case_id,
    responses: Object.values(fixtures)
      .map((fixture) => fixture?.response)
      .filter(Boolean),
    registration,
    prompts: Object.fromEntries(
      Object.entries(fixtures)
        .filter(([, fixture]) => fixture)
        .map(([judgeId, fixture]) => [judgeId, fixture.prompt]),
    ),
    advisorySignals,
  });
}

test('v4 registration freezes three distinct non-generator judges and hierarchical rules', () => {
  assert.deepEqual(validateTutorStubResistanceSemanticRegistrationV4(registration), { valid: true, issues: [] });
  assert.deepEqual(
    registration.measurement.judges.map((judge) => judge.modelRef),
    ['codex.gpt-5.6-sol', 'claude-code.sonnet-5', 'codex.gpt-5.5'],
  );
  assert.ok(registration.measurement.judges.every((judge) => judge.modelRef !== 'codex.gpt-5.6-luna'));
  assert.equal(registration.measurement.hierarchicalConsensus.componentDisagreementMayVetoPrimaryLabel, false);
  assert.equal(
    fileSha256(registration.instrument.ensembleImplementationPath),
    registration.instrument.ensembleImplementationSha256,
  );
  assert.equal(
    fileSha256(registration.instrument.seatImplementationPath),
    registration.instrument.seatImplementationSha256,
  );
  assert.equal(
    fileSha256(registration.instrument.seatResponseSchemaPath),
    registration.instrument.seatResponseSchemaSha256,
  );
  assert.equal(
    fileSha256(registration.instrument.developmentEvidencePath),
    registration.instrument.developmentEvidenceSha256,
  );
  assert.equal(registration.authorization.validationModelCallsAuthorized, false);
});

test('post-freeze v4 heldout has 80 fresh cases, exact strata, and no v1-v3 collisions', () => {
  const priorCorpora = ['v1', 'v2', 'v3'].map((version) =>
    JSON.parse(
      fs.readFileSync(
        path.join(ROOT, `config/tutor-stub-resistance-semantic-adjudication-heldout-corpus.${version}.json`),
        'utf8',
      ),
    ),
  );
  assert.deepEqual(
    validateTutorStubResistanceSemanticHeldoutCorpusV4(TUTOR_STUB_RESISTANCE_SEMANTIC_HELDOUT_CORPUS_V4, priorCorpora),
    { valid: true, issues: [] },
  );
  const cases = TUTOR_STUB_RESISTANCE_SEMANTIC_HELDOUT_CORPUS_V4.cases;
  assert.equal(cases.length, 80);
  assert.equal(cases.filter((row) => row.expected.label === 'frame_refuser').length, 40);
  assert.equal(cases.filter((row) => row.expected.label === 'frame_defiant_or_productive_dispute').length, 16);
  assert.equal(cases.filter((row) => row.expected.label === 'neither').length, 24);
  assert.equal(new Set(cases.map((row) => row.source)).size, 80);
  assert.equal(
    fileSha256(registration.heldoutFreezeProtocol.heldoutCorpusPath),
    registration.heldoutFreezeProtocol.heldoutCorpusSha256,
  );
  assert.equal(registration.heldoutFreezeProtocol.instrumentFreezeCommit, 'bc4edae0');
  assert.equal(registration.heldoutFreezeProtocol.corpusAuthorshipDidNotModifyFrozenInstrument, true);
  assert.equal(
    fileSha256(registration.instrument.ensembleImplementationPath),
    '40394d54ff569b388b5772d66ee9d4a806ecf9aade63710f4a2dc01c2faf634b',
  );
});

test('all 80 heldout cases traverse the frozen three-seat wrapper and hierarchical aggregate at zero calls', () => {
  for (const heldoutCase of TUTOR_STUB_RESISTANCE_SEMANTIC_HELDOUT_CORPUS_V4.cases) {
    const fixtures = Object.fromEntries(
      registration.measurement.judges.map((judge) => [
        judge.id,
        buildTutorStubResistanceSemanticZeroCallFixtureResponseV3({ corpusCase: heldoutCase, judge }),
      ]),
    );
    const result = adjudicateTutorStubResistanceSemanticJudgesV4({
      source: heldoutCase.source,
      publicContext: heldoutCase.public_context,
      caseId: heldoutCase.case_id,
      responses: Object.values(fixtures).map((fixture) => fixture.response),
      registration,
      prompts: Object.fromEntries(Object.entries(fixtures).map(([judgeId, fixture]) => [judgeId, fixture.prompt])),
    });
    assert.equal(result.status, 'determinate', heldoutCase.case_id);
    assert.equal(result.final_label, heldoutCase.expected.label, heldoutCase.case_id);
    assert.ok(
      Object.values(result.component_measurement).every((measurement) => measurement.status === 'determinate'),
      heldoutCase.case_id,
    );
  }
});

test('two-of-three primary agreement remains determinate when one diagnostic component has no majority', () => {
  const fixtures = panel();
  const a = fixtures.semantic_judge_a.response.judgment;
  const b = fixtures.semantic_judge_b.response.judgment;
  const c = fixtures.semantic_judge_c.response.judgment;
  a.interlocutor_standing_or_right = 'yes';
  b.interlocutor_standing_or_right = 'no';
  b.evidence_spans.interlocutor_standing_or_right = null;
  c.interlocutor_standing_or_right = 'indeterminate';
  c.evidence_spans.interlocutor_standing_or_right = c.evidence_spans.jurisdiction_dispute;
  c.final_label = 'indeterminate';
  c.confidence = 'medium';
  c.indeterminacy_reason = 'semantic_ambiguity';

  const result = adjudicate(fixtures);
  assert.equal(result.schema, TUTOR_STUB_RESISTANCE_SEMANTIC_ENSEMBLE_SCHEMA_V4);
  assert.equal(result.status, 'determinate');
  assert.equal(result.final_label, 'frame_refuser');
  assert.equal(result.primary_label_measurement.vote_counts.frame_refuser, 2);
  assert.equal(result.component_measurement.interlocutor_standing_or_right.status, 'measurement_indeterminate');
  assert.equal(result.judgment.interlocutor_standing_or_right, 'indeterminate');
  assert.equal(result.component_vector_diagnostic.required_for_primary_determination, false);
  assert.equal(result.component_disagreement_may_veto_primary_label, false);
});

test('one invalid judge abstains while two valid high-confidence primary votes determine the label', () => {
  const fixtures = panel();
  fixtures.semantic_judge_b.response.judgment.evidence_spans.licensed_participation =
    fixtures.semantic_judge_b.response.judgment.evidence_spans.jurisdiction_dispute;
  const result = adjudicate(fixtures);
  assert.equal(result.status, 'determinate');
  assert.equal(result.final_label, 'frame_refuser');
  assert.deepEqual(result.eligible_judges, ['semantic_judge_a', 'semantic_judge_c']);
  assert.deepEqual(result.abstentions, [{ judge_id: 'semantic_judge_b', reason: 'invalid_schema_span_or_provenance' }]);
  assert.equal(result.validation.find((row) => row.judge_id === 'semantic_judge_b').valid, false);
});

test('missing, response-free, low-confidence, and indeterminate seats never become nonadherence votes', () => {
  const fixtures = panel();
  delete fixtures.semantic_judge_b;
  const c = fixtures.semantic_judge_c.response.judgment;
  c.final_label = 'indeterminate';
  c.confidence = 'low';
  c.indeterminacy_reason = 'mixed_pragmatic_force';
  c.interlocutor_standing_or_right = 'indeterminate';
  c.evidence_spans.interlocutor_standing_or_right = c.evidence_spans.jurisdiction_dispute;
  const result = adjudicate(fixtures);
  assert.equal(result.status, 'measurement_indeterminate');
  assert.equal(result.final_label, 'indeterminate');
  assert.ok(result.reasons.includes('fewer_than_two_valid_high_confidence_judges'));
  assert.deepEqual(result.abstentions, [
    { judge_id: 'semantic_judge_b', reason: 'missing_or_response_free' },
    { judge_id: 'semantic_judge_c', reason: 'confidence_not_high' },
  ]);
  assert.equal(result.repair_allowed, false);
  assert.equal(result.replacement_allowed, false);
  assert.equal(result.outcome_selection_allowed, false);
});

test('a valid three-way primary split is measurement indeterminate without a lexical tiebreaker', () => {
  const fixtures = panel();
  const productive = fixtures.semantic_judge_b.response.judgment;
  productive.licensed_participation = 'yes';
  productive.evidence_spans.licensed_participation = productive.evidence_spans.participation_withholding;
  productive.productive_counterframing = 'yes';
  productive.evidence_spans.productive_counterframing = productive.evidence_spans.participation_withholding;
  productive.final_label = 'frame_defiant_or_productive_dispute';

  const neither = fixtures.semantic_judge_c.response.judgment;
  neither.jurisdiction_dispute = 'no';
  neither.interlocutor_standing_or_right = 'no';
  neither.inquiry_or_question_frame_governance = 'no';
  neither.test_or_criterion_governance = 'no';
  neither.other_jurisdictional_governance = 'no';
  for (const field of [
    'jurisdiction_dispute',
    'interlocutor_standing_or_right',
    'inquiry_or_question_frame_governance',
    'test_or_criterion_governance',
    'other_jurisdictional_governance',
  ]) {
    neither.evidence_spans[field] = null;
  }
  neither.final_label = 'neither';

  const result = adjudicate(fixtures, [{ kind: 'regex', polarity: 'frame_refuser' }]);
  assert.equal(result.status, 'measurement_indeterminate');
  assert.equal(result.final_label, 'indeterminate');
  assert.ok(result.reasons.includes('no_primary_label_majority'));
  assert.equal(result.lexical_or_regex_authority, 'none');
  assert.deepEqual(result.primary_label_measurement.vote_counts, {
    frame_defiant_or_productive_dispute: 1,
    frame_refuser: 1,
    neither: 1,
  });
});

test('duplicate judge identities fail panel integrity even when labels would form a majority', () => {
  const fixtures = panel();
  fixtures.semantic_judge_c.response.provenance.judge_id = 'semantic_judge_a';
  const result = adjudicate(fixtures);
  assert.equal(result.status, 'measurement_indeterminate');
  assert.ok(result.reasons.includes('duplicate_or_unregistered_judge'));
});

test('every diagnostic component is aggregated and preserved separately from the primary endpoint', () => {
  const result = adjudicate(panel());
  assert.deepEqual(Object.keys(result.component_measurement), TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3);
  assert.ok(Object.values(result.component_measurement).every((row) => row.status === 'determinate'));
  assert.equal(result.final_label, 'frame_refuser');
});
