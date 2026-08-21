import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3,
  TUTOR_STUB_RESISTANCE_SEMANTIC_MODEL_SCHEMA_V3,
  TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA_V3,
  adjudicateTutorStubResistanceSemanticJudgesV3,
  buildTutorStubResistanceSemanticAdjudicationPromptV3,
  buildTutorStubResistanceSemanticZeroCallFixtureResponseV3,
  scoreTutorStubResistanceSemanticCorpusV3,
  validateTutorStubResistanceSemanticCorpusV3,
  validateTutorStubResistanceSemanticDevelopmentEvidenceV3,
  validateTutorStubResistanceSemanticRegistrationV3,
  validateTutorStubResistanceSemanticResponseV3,
  wrapTutorStubResistanceSemanticModelOutputV3,
} from '../services/tutorStubResistanceSemanticAdjudicationV3.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
const sha256 = (relativePath) =>
  crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(ROOT, relativePath)))
    .digest('hex');
const registration = readJson('config/tutor-stub-resistance-semantic-adjudication-registration.v3.json');
const developmentEvidence = readJson('config/tutor-stub-resistance-semantic-adjudication-development-evidence.v3.json');
const responseSchema = readJson('config/tutor-stub-resistance-semantic-adjudication-response.schema.v3.json');

const context = [{ role: 'assistant', text: 'Will you compare the two public records under this question?' }];
const refuserSource =
  'Your office gives you no right to impose that question or its evidentiary test, so I will not answer or inspect either record.';
const productiveSource =
  'You do not have standing to impose that question, and I will not answer it; I will compare the two public records under whether their dates agree.';

function evidence({ dispute, standing, frame, test, participate, withhold, productive }) {
  return {
    jurisdiction_dispute: dispute ? { source_id: 'utterance', text: dispute } : null,
    interlocutor_standing_or_right: standing ? { source_id: 'utterance', text: standing } : null,
    inquiry_or_question_frame_governance: frame ? { source_id: 'utterance', text: frame } : null,
    test_or_criterion_governance: test ? { source_id: 'utterance', text: test } : null,
    other_jurisdictional_governance: null,
    licensed_participation: participate ? { source_id: 'utterance', text: participate } : null,
    participation_withholding: withhold ? { source_id: 'utterance', text: withhold } : null,
    productive_counterframing: productive ? { source_id: 'utterance', text: productive } : null,
  };
}

const refuserCase = {
  case_id: 'v3-dev-refuser',
  public_context: context,
  source: refuserSource,
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
    evidence: evidence({
      dispute: 'no right to impose that question',
      standing: 'Your office gives you no right',
      frame: 'impose that question',
      test: 'its evidentiary test',
      withhold: 'I will not answer or inspect either record',
      source: refuserSource,
    }),
  },
};

const productiveCase = {
  case_id: 'v3-dev-productive',
  public_context: context,
  source: productiveSource,
  expected: {
    label: 'frame_defiant_or_productive_dispute',
    judgment: {
      jurisdiction_dispute: 'yes',
      interlocutor_standing_or_right: 'yes',
      inquiry_or_question_frame_governance: 'yes',
      test_or_criterion_governance: 'no',
      other_jurisdictional_governance: 'no',
      licensed_participation: 'yes',
      participation_withholding: 'yes',
      productive_counterframing: 'yes',
      final_label: 'frame_defiant_or_productive_dispute',
    },
    evidence: evidence({
      dispute: 'do not have standing to impose that question',
      standing: 'do not have standing',
      frame: 'impose that question',
      participate: 'I will compare the two public records',
      withhold: 'I will not answer it',
      productive: 'compare the two public records under whether their dates agree',
      source: productiveSource,
    }),
  },
};

const corpus = {
  schema: 'machinespirits.tutor-stub.resistance-semantic-adjudication-corpus.v3',
  corpus_id: 'v3-development-smoke',
  role: 'development_regression',
  frozen: true,
  prompt_examples_allowed: false,
  context_provenance: 'public_synthetic_authored',
  cases: [refuserCase, productiveCase],
};

function pairFor(corpusCase) {
  return Object.fromEntries(
    registration.measurement.judges.map((judge) => [
      judge.id,
      buildTutorStubResistanceSemanticZeroCallFixtureResponseV3({ corpusCase, judge }),
    ]),
  );
}

test('v1 and v2 instrument, heldout, request, and registration bytes remain frozen', () => {
  assert.deepEqual(
    {
      v1Implementation: sha256('services/tutorStubResistanceSemanticAdjudication.js'),
      v1Schema: sha256('config/tutor-stub-resistance-semantic-adjudication-response.schema.v1.json'),
      v1Registration: sha256('config/tutor-stub-resistance-semantic-adjudication-registration.v1.json'),
      v1Heldout: sha256('config/tutor-stub-resistance-semantic-adjudication-heldout-corpus.v1.json'),
      v1Request: sha256('config/tutor-stub-resistance-semantic-adjudication-validation-study-go-request.v1.json'),
      v2Implementation: sha256('services/tutorStubResistanceSemanticAdjudicationV2.js'),
      v2Schema: sha256('config/tutor-stub-resistance-semantic-adjudication-response.schema.v2.json'),
      v2Registration: sha256('config/tutor-stub-resistance-semantic-adjudication-registration.v2.json'),
      v2Heldout: sha256('config/tutor-stub-resistance-semantic-adjudication-heldout-corpus.v2.json'),
      v2Request: sha256('config/tutor-stub-resistance-semantic-adjudication-validation-study-go-request.v2.json'),
    },
    {
      v1Implementation: '4c1123b7272e33bdfc63205c85058d9b02753b7c89d3c05af2137b0f72783456',
      v1Schema: '39a9d12655ec26b1255ab72cfd1f5818dc9e0084daf4c9fafc39c0dbb8ea044f',
      v1Registration: 'd479a556df2f61458546e9e1463dc11fa1261b74df91fe4b765d159c330f415d',
      v1Heldout: '9378416d1fdf8dc41f35ad84a4edf69fba6ad8889ce5020617f3d19747c9a2c7',
      v1Request: 'b6d9a41cc9fbdb2a3fc15f536e2a0b6e97a406986c9f88027e0765ab4bddb826',
      v2Implementation: '2b9faa679fedf1e98c25e6e5f3569da6c2ef83f3654642c08dc3c00e6fc15bfd',
      v2Schema: 'eaeebc729a56ce7802bf9030a60cdf4cc60734f3aabe0760c7ddd6a64d011205',
      v2Registration: '4cf2b38f3424960d983e2dd5e1a9938e0397e5038fa5f4c8d96bb5d8a78306be',
      v2Heldout: 'a52d10f60ceeeb9e1e92415c6add6d0dee4dbf69608053652ff9c23f08216535',
      v2Request: 'b91b6c92ec6b82b15b40821938929c3e2c31c86424822846a26443977cb479d6',
    },
  );
});

test('v3 freeze binds failed v1/v2 evidence, unchanged gates, and the 651 to 1131 budget', () => {
  assert.deepEqual(validateTutorStubResistanceSemanticRegistrationV3(registration), { valid: true, issues: [] });
  assert.deepEqual(validateTutorStubResistanceSemanticDevelopmentEvidenceV3(developmentEvidence), {
    valid: true,
    issues: [],
  });
  assert.equal(developmentEvidence.total_cases, 176);
  assert.equal(
    registration.supersession.v2FailedValidationReportSha256,
    '11e868d18135e6df29230eab6f7912427917c0e0b55ea350f6cec4a2168fca11',
  );
  assert.equal(registration.prospectiveValidationBudget.programmeLedgerBeforeV3Validation, 651);
  assert.equal(registration.prospectiveValidationBudget.programmeMaximumAfterV3Validation, 1131);
  assert.equal(registration.authorization.validationModelCallsAuthorized, false);
  assert.equal(sha256(registration.instrument.implementationPath), registration.instrument.implementationSha256);
  assert.equal(sha256(registration.instrument.responseSchemaPath), registration.instrument.responseSchemaSha256);
  assert.equal(
    sha256(registration.instrument.developmentEvidencePath),
    registration.instrument.developmentEvidenceSha256,
  );
});

test('file schema and exported model schema require the same fixed evidence slots', () => {
  assert.equal(responseSchema.properties.schema.const, TUTOR_STUB_RESISTANCE_SEMANTIC_MODEL_SCHEMA_V3);
  const fileEvidence = responseSchema.properties.judgment.properties.evidence_quotes;
  const exportedEvidence =
    TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA_V3.properties.judgment.properties.evidence_quotes;
  assert.deepEqual(fileEvidence.required, TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3);
  assert.deepEqual(exportedEvidence.required, TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3);
  assert.deepEqual(Object.keys(fileEvidence.properties), TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3);
  assert.deepEqual(Object.keys(exportedEvidence.properties), TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3);
});

test('prompt is example-free, multiaxial, and distinguishes actual from hypothetical participation', () => {
  const prompt = buildTutorStubResistanceSemanticAdjudicationPromptV3({
    caseId: 'blind-case',
    source: refuserSource,
    publicContext: context,
    judge: registration.measurement.judges[0],
  });
  assert.equal(prompt.independence.gold_labels_visible, false);
  assert.equal(prompt.independence.development_examples_visible, false);
  assert.match(prompt.instructions.join('\n'), /four independent axes/);
  assert.match(prompt.instructions.join('\n'), /Hypothetical, counterfactual, conditional-only/);
  assert.match(prompt.instructions.join('\n'), /concrete alternative inquiry/);
  assert.doesNotMatch(prompt.instructions.join('\n'), /v2-dev|hb2-|expected label/i);
});

test('fixed quote slots normalize to unique UTF-16 spans and validate', () => {
  const pair = pairFor(refuserCase);
  for (const judge of registration.measurement.judges) {
    const fixture = pair[judge.id];
    assert.equal(fixture.response.judgment.test_or_criterion_governance, 'yes');
    assert.equal(fixture.response.judgment.evidence_spans.other_jurisdictional_governance, null);
    assert.equal(
      refuserSource.slice(
        fixture.response.judgment.evidence_spans.test_or_criterion_governance.start_utf16,
        fixture.response.judgment.evidence_spans.test_or_criterion_governance.end_utf16,
      ),
      'its evidentiary test',
    );
    assert.deepEqual(
      validateTutorStubResistanceSemanticResponseV3({
        source: refuserSource,
        publicContext: context,
        caseId: refuserCase.case_id,
        response: fixture.response,
        registration,
        prompt: fixture.prompt,
      }),
      { valid: true, issues: [] },
    );
  }
});

test('missing fixed evidence slot fails before a record can be stored', () => {
  const judge = registration.measurement.judges[1];
  const fixture = buildTutorStubResistanceSemanticZeroCallFixtureResponseV3({ corpusCase: refuserCase, judge });
  delete fixture.modelOutput.judgment.evidence_quotes.interlocutor_standing_or_right;
  assert.throws(
    () =>
      wrapTutorStubResistanceSemanticModelOutputV3({
        modelOutput: fixture.modelOutput,
        prompt: fixture.prompt,
        judge,
        observedProvider: judge.provider,
        observedModel: judge.model,
        observedEffort: judge.effort,
        independentRunId: 'missing-slot',
        structuredOutput: true,
        prohibitedToolEvents: 0,
        modelAttestationBasis: judge.modelAttestationBasis,
        modelIndependentlyAttested: false,
      }),
    /evidence quote slots are not exact/,
  );
});

test('absent and ambiguous quotes fail deterministically', () => {
  const judge = registration.measurement.judges[0];
  const absent = buildTutorStubResistanceSemanticZeroCallFixtureResponseV3({ corpusCase: refuserCase, judge });
  absent.modelOutput.judgment.evidence_quotes.jurisdiction_dispute.quote = 'not in the source';
  assert.throws(
    () =>
      wrapTutorStubResistanceSemanticModelOutputV3({
        modelOutput: absent.modelOutput,
        prompt: absent.prompt,
        judge,
        observedProvider: judge.provider,
        observedModel: judge.model,
        observedEffort: judge.effort,
        independentRunId: 'absent',
        structuredOutput: true,
        prohibitedToolEvents: 0,
        modelAttestationBasis: judge.modelAttestationBasis,
        modelIndependentlyAttested: false,
      }),
    /absent/,
  );
  const ambiguousCase = structuredClone(refuserCase);
  ambiguousCase.source = 'right right';
  ambiguousCase.expected.evidence = Object.fromEntries(
    TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3.map((field) => [
      field,
      ambiguousCase.expected.judgment[field] === 'no' ? null : { source_id: 'utterance', text: 'right' },
    ]),
  );
  assert.throws(
    () => buildTutorStubResistanceSemanticZeroCallFixtureResponseV3({ corpusCase: ambiguousCase, judge }),
    /ambiguous/,
  );
});

test('null is allowed only for no and every yes or indeterminate field requires evidence', () => {
  const fixture = pairFor(refuserCase).semantic_judge_a;
  const missing = structuredClone(fixture.response);
  missing.judgment.evidence_spans.interlocutor_standing_or_right = null;
  assert.match(
    validateTutorStubResistanceSemanticResponseV3({
      source: refuserSource,
      publicContext: context,
      caseId: refuserCase.case_id,
      response: missing,
      registration,
      prompt: fixture.prompt,
    }).issues.join('\n'),
    /interlocutor_standing_or_right requires exact-span evidence/,
  );
  const surplus = structuredClone(fixture.response);
  surplus.judgment.evidence_spans.other_jurisdictional_governance = structuredClone(
    surplus.judgment.evidence_spans.jurisdiction_dispute,
  );
  assert.match(
    validateTutorStubResistanceSemanticResponseV3({
      source: refuserSource,
      publicContext: context,
      caseId: refuserCase.case_id,
      response: surplus,
      registration,
      prompt: fixture.prompt,
    }).issues.join('\n'),
    /other_jurisdictional_governance evidence must be null/,
  );
});

test('multiaxial ontology rejects contradictory dispute and other-axis vectors', () => {
  const fixture = pairFor(refuserCase).semantic_judge_a;
  const mutations = [
    (record) => {
      record.judgment.jurisdiction_dispute = 'no';
      record.judgment.final_label = 'neither';
    },
    (record) => {
      for (const field of [
        'interlocutor_standing_or_right',
        'inquiry_or_question_frame_governance',
        'test_or_criterion_governance',
      ]) {
        record.judgment[field] = 'no';
        record.judgment.evidence_spans[field] = null;
      }
    },
    (record) => {
      record.judgment.other_jurisdictional_governance = 'yes';
      record.judgment.evidence_spans.other_jurisdictional_governance = structuredClone(
        record.judgment.evidence_spans.jurisdiction_dispute,
      );
    },
  ];
  for (const mutate of mutations) {
    const record = structuredClone(fixture.response);
    mutate(record);
    assert.equal(
      validateTutorStubResistanceSemanticResponseV3({
        source: refuserSource,
        publicContext: context,
        caseId: refuserCase.case_id,
        response: record,
        registration,
        prompt: fixture.prompt,
      }).valid,
      false,
    );
  }
});

test('consensus requires the complete multiaxial vector but not identical evidence spans', () => {
  const pair = pairFor(refuserCase);
  const result = adjudicateTutorStubResistanceSemanticJudgesV3({
    source: refuserSource,
    publicContext: context,
    caseId: refuserCase.case_id,
    responses: registration.measurement.judges.map((judge) => pair[judge.id].response),
    registration,
    prompts: Object.fromEntries(registration.measurement.judges.map((judge) => [judge.id, pair[judge.id].prompt])),
  });
  assert.equal(result.status, 'determinate');
  const drift = structuredClone(pair.semantic_judge_b.response);
  drift.judgment.inquiry_or_question_frame_governance = 'no';
  drift.judgment.evidence_spans.inquiry_or_question_frame_governance = null;
  const disagreement = adjudicateTutorStubResistanceSemanticJudgesV3({
    source: refuserSource,
    publicContext: context,
    caseId: refuserCase.case_id,
    responses: [pair.semantic_judge_a.response, drift],
    registration,
    prompts: Object.fromEntries(registration.measurement.judges.map((judge) => [judge.id, pair[judge.id].prompt])),
  });
  assert.equal(disagreement.status, 'measurement_indeterminate');
  assert.ok(disagreement.reasons.includes('judge_disagreement'));
});

test('development corpus validates and perfect zero-call fixtures exercise every gate', () => {
  assert.deepEqual(validateTutorStubResistanceSemanticCorpusV3(corpus), { valid: true, issues: [] });
  const score = scoreTutorStubResistanceSemanticCorpusV3({
    corpus,
    responsePairs: Object.fromEntries(corpus.cases.map((corpusCase) => [corpusCase.case_id, pairFor(corpusCase)])),
    registration,
  });
  assert.equal(score.status, 'passed');
  assert.equal(score.metrics.schema_span_provenance_validity, 1);
  assert.equal(score.metrics.consensus_exact_core_vector_accuracy, 1);
});

test('registration rejects ontology, evidence, gate, supersession, and budget drift', () => {
  const mutations = [
    (value) => (value.instrument.jurisdictionOntology.singleChoiceTargetOrTypeAllowed = true),
    (value) => (value.instrument.evidenceContract.nullAllowedOnlyWhenFieldIsNo = false),
    (value) => (value.measurement.validationGates.minimumConsensusExactCoreVectorAccuracy = 0.94),
    (value) => (value.supersession.v2EligibleForFutureValidationOrLaunch = true),
    (value) => (value.prospectiveValidationBudget.programmeMaximumAfterV3Validation = 1130),
  ];
  for (const mutate of mutations) {
    const value = structuredClone(registration);
    mutate(value);
    assert.equal(validateTutorStubResistanceSemanticRegistrationV3(value).valid, false);
  }
});
