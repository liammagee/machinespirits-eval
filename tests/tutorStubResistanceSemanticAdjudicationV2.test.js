import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_MODEL_SCHEMA_V2,
  TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA_V2,
  adjudicateTutorStubResistanceSemanticJudgesV2,
  buildTutorStubResistanceSemanticAdjudicationPromptV2,
  buildTutorStubResistanceSemanticZeroCallFixtureResponseV2,
  scoreTutorStubResistanceSemanticCorpusV2,
  validateTutorStubResistanceSemanticCorpusV2,
  validateTutorStubResistanceSemanticDevelopmentEvidenceV2,
  validateTutorStubResistanceSemanticRegistrationV2,
  validateTutorStubResistanceSemanticResponseV2,
  wrapTutorStubResistanceSemanticModelOutputV2,
} from '../services/tutorStubResistanceSemanticAdjudicationV2.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
const sha256 = (relativePath) =>
  crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(ROOT, relativePath)))
    .digest('hex');
const registration = readJson('config/tutor-stub-resistance-semantic-adjudication-registration.v2.json');
const developmentEvidence = readJson('config/tutor-stub-resistance-semantic-adjudication-development-evidence.v2.json');
const v1Development = readJson('config/tutor-stub-resistance-semantic-adjudication-development-corpus.v1.json');
const observedV1Heldout = readJson('config/tutor-stub-resistance-semantic-adjudication-heldout-corpus.v1.json');

function asV2Corpus(corpus) {
  return {
    ...structuredClone(corpus),
    schema: 'machinespirits.tutor-stub.resistance-semantic-adjudication-corpus.v2',
  };
}

function pairFor(corpusCase) {
  return Object.fromEntries(
    registration.measurement.judges.map((judge) => [
      judge.id,
      buildTutorStubResistanceSemanticZeroCallFixtureResponseV2({ corpusCase, judge }),
    ]),
  );
}

test('v1 instrument, schema, development, heldout, and consumed request bytes remain frozen', () => {
  assert.deepEqual(
    {
      implementation: sha256('services/tutorStubResistanceSemanticAdjudication.js'),
      schema: sha256('config/tutor-stub-resistance-semantic-adjudication-response.schema.v1.json'),
      registration: sha256('config/tutor-stub-resistance-semantic-adjudication-registration.v1.json'),
      development: sha256('config/tutor-stub-resistance-semantic-adjudication-development-corpus.v1.json'),
      heldout: sha256('config/tutor-stub-resistance-semantic-adjudication-heldout-corpus.v1.json'),
      request: sha256('config/tutor-stub-resistance-semantic-adjudication-validation-study-go-request.v1.json'),
    },
    {
      implementation: '4c1123b7272e33bdfc63205c85058d9b02753b7c89d3c05af2137b0f72783456',
      schema: '39a9d12655ec26b1255ab72cfd1f5818dc9e0084daf4c9fafc39c0dbb8ea044f',
      registration: 'd479a556df2f61458546e9e1463dc11fa1261b74df91fe4b765d159c330f415d',
      development: '159fdafe39d67c200868f67a27ea5392366c614e4b2b73f186c3051cb734a5e9',
      heldout: '9378416d1fdf8dc41f35ad84a4edf69fba6ad8889ce5020617f3d19747c9a2c7',
      request: 'b6d9a41cc9fbdb2a3fc15f536e2a0b6e97a406986c9f88027e0765ab4bddb826',
    },
  );
});

test('v2 freezes a quote-only example-free prompt and discloses all observed v1 cases as development evidence', () => {
  assert.deepEqual(validateTutorStubResistanceSemanticRegistrationV2(registration), { valid: true, issues: [] });
  assert.deepEqual(validateTutorStubResistanceSemanticDevelopmentEvidenceV2(developmentEvidence), {
    valid: true,
    issues: [],
  });
  assert.equal(developmentEvidence.total_cases, 96);
  assert.equal(developmentEvidence.v2_heldout_reuse_allowed, false);
  assert.equal(
    developmentEvidence.inputs[1].sealed_report_sha256,
    registration.supersession.v1FailedValidationReportSha256,
  );
  assert.equal(sha256(registration.instrument.implementationPath), registration.instrument.implementationSha256);
  assert.equal(sha256(registration.instrument.responseSchemaPath), registration.instrument.responseSchemaSha256);
  assert.equal(
    sha256(registration.instrument.developmentEvidencePath),
    registration.instrument.developmentEvidenceSha256,
  );
  assert.equal(
    TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA_V2.properties.judgment.properties.evidence_quotes.type,
    'array',
  );
  assert.equal(
    Object.hasOwn(TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA_V2.properties.judgment.properties, 'evidence_spans'),
    false,
  );

  const corpusCase = v1Development.cases[0];
  const prompt = buildTutorStubResistanceSemanticAdjudicationPromptV2({
    caseId: 'opaque-case',
    source: corpusCase.source,
    publicContext: corpusCase.public_context,
    judge: registration.measurement.judges[0],
  });
  const instructions = prompt.instructions.join(' ');
  assert.match(instructions, /Hypothetical, counterfactual, conditional-only, or generic willingness/);
  assert.match(instructions, /merits disagreement, factual objection, procedural defect, administrative instruction/);
  assert.match(instructions, /requires a concrete alternative inquiry/);
  assert.match(instructions, /Do not calculate or return numeric offsets/);
  assert.equal(prompt.independence.development_examples_visible, false);
  assert.doesNotMatch(JSON.stringify(prompt), /historic-v|hb1-/);
});

test('v2 wrapper uniquely locates exact quotes and stamps JavaScript UTF-16 code-unit offsets', () => {
  const source = '🧭 I reject that frame and will not answer under it.';
  const publicContext = [{ role: 'assistant', text: 'Use this frame and answer.' }];
  const judge = registration.measurement.judges[0];
  const prompt = buildTutorStubResistanceSemanticAdjudicationPromptV2({
    caseId: 'unicode-offset',
    source,
    publicContext,
    judge,
  });
  const modelOutput = {
    schema: TUTOR_STUB_RESISTANCE_SEMANTIC_MODEL_SCHEMA_V2,
    case_id: 'unicode-offset',
    judgment: {
      jurisdiction_dispute: 'yes',
      jurisdiction_target: 'inquiry_frame',
      jurisdiction_type: 'frame_governance',
      licensed_participation: 'no',
      participation_withholding: 'yes',
      productive_counterframing: 'no',
      final_label: 'frame_refuser',
      evidence_quotes: [
        { field: 'jurisdiction_dispute', source_id: 'utterance', quote: 'reject that frame' },
        { field: 'jurisdiction_target', source_id: 'utterance', quote: 'that frame' },
        {
          field: 'participation_withholding',
          source_id: 'utterance',
          quote: 'will not answer under it',
        },
      ],
      confidence: 'high',
      indeterminacy_reason: 'none',
    },
  };
  const response = wrapTutorStubResistanceSemanticModelOutputV2({
    modelOutput,
    prompt,
    judge,
    observedProvider: judge.provider,
    observedModel: judge.model,
    observedEffort: judge.effort,
    independentRunId: 'observed-unique-run',
    structuredOutput: true,
    prohibitedToolEvents: 0,
    modelAttestationBasis: judge.modelAttestationBasis,
    modelIndependentlyAttested: false,
  });
  assert.equal(response.judgment.evidence_spans[0].start_utf16, source.indexOf('reject that frame'));
  assert.equal(response.judgment.evidence_spans[0].start_utf16, 5);
  assert.deepEqual(
    validateTutorStubResistanceSemanticResponseV2({
      source,
      publicContext,
      caseId: 'unicode-offset',
      response,
      registration,
      prompt,
    }),
    { valid: true, issues: [] },
  );
});

test('v2 wrapper rejects absent and ambiguous copied quotes before a record can be authoritative', () => {
  const source = 'I reject that frame; that frame will not govern my answer.';
  const publicContext = [{ role: 'assistant', text: 'Use this frame.' }];
  const judge = registration.measurement.judges[0];
  const prompt = buildTutorStubResistanceSemanticAdjudicationPromptV2({
    caseId: 'bad-quote',
    source,
    publicContext,
    judge,
  });
  const base = {
    schema: TUTOR_STUB_RESISTANCE_SEMANTIC_MODEL_SCHEMA_V2,
    case_id: 'bad-quote',
    judgment: {
      jurisdiction_dispute: 'yes',
      jurisdiction_target: 'inquiry_frame',
      jurisdiction_type: 'frame_governance',
      licensed_participation: 'no',
      participation_withholding: 'yes',
      productive_counterframing: 'no',
      final_label: 'frame_refuser',
      evidence_quotes: [],
      confidence: 'high',
      indeterminacy_reason: 'none',
    },
  };
  const wrap = (modelOutput) =>
    wrapTutorStubResistanceSemanticModelOutputV2({
      modelOutput,
      prompt,
      judge,
      observedProvider: judge.provider,
      observedModel: judge.model,
      observedEffort: judge.effort,
      independentRunId: 'bad-quote-run',
      structuredOutput: true,
      prohibitedToolEvents: 0,
      modelAttestationBasis: judge.modelAttestationBasis,
      modelIndependentlyAttested: false,
    });
  const absent = structuredClone(base);
  absent.judgment.evidence_quotes = [
    { field: 'jurisdiction_dispute', source_id: 'utterance', quote: 'words not present' },
  ];
  assert.throws(() => wrap(absent), /absent from declared source/);
  const ambiguous = structuredClone(base);
  ambiguous.judgment.evidence_quotes = [{ field: 'jurisdiction_target', source_id: 'utterance', quote: 'that frame' }];
  assert.throws(() => wrap(ambiguous), /ambiguous in declared source/);
  const numericOffsets = structuredClone(base);
  numericOffsets.judgment.evidence_quotes = [
    {
      field: 'jurisdiction_dispute',
      source_id: 'utterance',
      quote: 'I reject that frame',
      start_utf16: 0,
      end_utf16: 19,
    },
  ];
  assert.throws(() => wrap(numericOffsets), /keys are not exact/);
});

test('v2 zero-call fixtures preserve full-vector consensus across all 96 disclosed development cases', () => {
  const corpus = {
    schema: 'machinespirits.tutor-stub.resistance-semantic-adjudication-corpus.v2',
    corpus_id: 'resistance-semantic-v2-disclosed-development-composite',
    role: 'development_regression',
    frozen: true,
    prompt_examples_allowed: false,
    context_provenance: 'authored_minimal_public_context_for_frozen_exact_learner_utterances',
    cases: [...v1Development.cases, ...observedV1Heldout.cases],
  };
  assert.equal(corpus.cases.length, 96);
  assert.deepEqual(validateTutorStubResistanceSemanticCorpusV2(corpus), { valid: true, issues: [] });
  const responsePairs = Object.fromEntries(corpus.cases.map((corpusCase) => [corpusCase.case_id, pairFor(corpusCase)]));
  const score = scoreTutorStubResistanceSemanticCorpusV2({ corpus, responsePairs, registration });
  assert.equal(score.status, 'passed');
  assert.equal(score.cases, 96);
  assert.equal(score.metrics.consensus_exact_core_vector_accuracy, 1);
  const first = corpus.cases[0];
  const pair = responsePairs[first.case_id];
  const aggregate = adjudicateTutorStubResistanceSemanticJudgesV2({
    source: first.source,
    publicContext: first.public_context,
    caseId: first.case_id,
    responses: registration.measurement.judges.map((judge) => pair[judge.id].response),
    registration,
    prompts: Object.fromEntries(registration.measurement.judges.map((judge) => [judge.id, pair[judge.id].prompt])),
  });
  assert.equal(aggregate.status, 'determinate');
  assert.equal(aggregate.final_label, first.expected.label);
});

test('v2 heldout contract is new, independent, balanced, and not authorized', () => {
  assert.deepEqual(registration.heldoutFreezeProtocol, {
    requiredRole: 'heldout_blinded',
    requiredSchema: 'machinespirits.tutor-stub.resistance-semantic-adjudication-corpus.v2',
    exactCases: 80,
    minimumCases: 80,
    exactPositiveCases: 40,
    minimumPositiveCases: 40,
    exactNeitherCases: 24,
    minimumNegativeCases: 40,
    exactProductiveDisputeCases: 16,
    minimumProductiveDisputeCases: 16,
    minimumActualParticipationCases: 20,
    minimumHypotheticalOrConditionalParticipationCases: 12,
    minimumMeritsProceduralOrAdministrativeNonjurisdictionCases: 16,
    minimumConcreteProductiveCounterframes: 16,
    uniqueSourceUtterances: 80,
    duplicateHeldoutContextMessagesAllowed: false,
    developmentCaseIdSourceOrContextCollisionAllowed: false,
    v1ObservedCaseIdSourceOrContextCollisionAllowed: false,
    authoredByIndependentAgentAfterInstrumentFreezeCommit: true,
    heldoutTextOrGoldVisibleToPromptBuilderBeforeFreeze: false,
    postHeldoutPromptModelThresholdOrConsensusTuning: false,
    futureValidationRequestRequired: true,
    validationCallsAuthorized: false,
  });
  assert.equal(registration.prospectiveValidationBudget.programmeLedgerBeforeV2Validation, 491);
  assert.equal(registration.prospectiveValidationBudget.programmeMaximumAfterV2Validation, 971);
  assert.equal(registration.authorization.goRequestPrepared, false);
  assert.equal(registration.authorization.validationModelCallsAuthorized, false);
  assert.equal(registration.authorization.confirmationModelCallsAuthorized, false);
  assert.equal(registration.laterProgrammeBoundary.prospectiveMaximumIfBothLaterStagesProceed, 5147);
  assert.equal(registration.laterProgrammeBoundary.ceilingAmendmentRequiredBeforeLaterStages, true);
});

test('v2 corpus validation remains additive while malformed corpus content fails closed', () => {
  const corpus = asV2Corpus(v1Development);
  assert.deepEqual(validateTutorStubResistanceSemanticCorpusV2(corpus), { valid: true, issues: [] });
  corpus.cases[0].expected.evidence[0].text = 'not present';
  assert.equal(validateTutorStubResistanceSemanticCorpusV2(corpus).valid, false);
});
