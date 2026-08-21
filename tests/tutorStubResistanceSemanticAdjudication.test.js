import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA,
  adjudicateTutorStubResistanceSemanticJudges,
  buildTutorStubResistanceSemanticAdjudicationPrompt,
  buildTutorStubResistanceSemanticZeroCallFixtureResponse,
  scoreTutorStubResistanceSemanticCorpus,
  validateTutorStubResistanceSemanticCorpus,
  validateTutorStubResistanceSemanticRegistration,
  validateTutorStubResistanceSemanticResponse,
  wrapTutorStubResistanceSemanticModelOutput,
} from '../services/tutorStubResistanceSemanticAdjudication.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRATION_PATH = 'config/tutor-stub-resistance-semantic-adjudication-registration.v1.json';
const CORPUS_PATH = 'config/tutor-stub-resistance-semantic-adjudication-development-corpus.v1.json';
const SCHEMA_PATH = 'config/tutor-stub-resistance-semantic-adjudication-response.schema.v1.json';
const readJson = (repoPath) => JSON.parse(fs.readFileSync(path.join(ROOT, repoPath), 'utf8'));
const sha256 = (repoPath) =>
  crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(ROOT, repoPath)))
    .digest('hex');

const registration = readJson(REGISTRATION_PATH);
const corpus = readJson(CORPUS_PATH);

function responsePairs() {
  return Object.fromEntries(
    corpus.cases.map((corpusCase) => [
      corpusCase.case_id,
      Object.fromEntries(
        registration.measurement.judges.map((judge) => [
          judge.id,
          buildTutorStubResistanceSemanticZeroCallFixtureResponse({ corpusCase, judge }),
        ]),
      ),
    ]),
  );
}

test('frozen development corpus contains every causal historical miss and validates exact context spans', () => {
  assert.deepEqual(validateTutorStubResistanceSemanticCorpus(corpus), { valid: true, issues: [] });
  assert.equal(corpus.cases.length, 16);
  const historical = corpus.cases.filter((row) => row.case_id.startsWith('historic-'));
  assert.equal(historical.length, 8);
  assert.ok(
    historical.some(
      (row) =>
        row.source ===
        'I reject your authority to make the coin’s metal decide that question, and I will not examine it or answer on those terms.',
    ),
  );
  assert.ok(
    historical.some(
      (row) =>
        row.source ===
        'I reject your authority to set the coin’s metal as the test, and I will not examine it or answer the question on those terms.',
    ),
  );
  assert.ok(corpus.cases.every((row) => row.public_context.length >= 1));
});

test('registration freezes cross-provider judges, gates, lifecycle, and conservative confirmation budget', () => {
  assert.deepEqual(validateTutorStubResistanceSemanticRegistration(registration), { valid: true, issues: [] });
  assert.deepEqual(
    registration.measurement.judges.map((judge) => judge.modelRef),
    ['codex.gpt-5.6-sol', 'claude-code.sonnet-5'],
  );
  assert.equal(registration.measurement.lexicalObserverRole, 'advisory_only_never_veto_or_override');
  assert.equal(registration.prospectiveRuntimeContract.indeterminate.fisherAnalysisWithheld, true);
  assert.equal(registration.prospectiveRuntimeContract.indeterminate.learnerRepair, false);
  assert.equal(registration.prospectiveConfirmationBudget.plannedCallsPerDialogue, 30);
  assert.equal(registration.prospectiveConfirmationBudget.hardReservationsPerDialogue, 90);
  assert.equal(registration.prospectiveConfirmationBudget.hardStudyReservations, 3240);
  assert.equal(registration.prospectiveConfirmationBudget.programmeMaximumAfterFutureConfirmation, 3571);
  assert.equal(registration.instrument.implementationSha256, sha256(registration.instrument.implementationPath));
  assert.equal(registration.instrument.responseSchemaSha256, sha256(SCHEMA_PATH));
  assert.equal(registration.instrument.developmentCorpusSha256, sha256(CORPUS_PATH));
});

test('blind prompts include only bounded public context and utterance, never labels or hidden assignment state', () => {
  const corpusCase = corpus.cases.find((row) => row.case_id === 'historic-v7-anaphoric-authority');
  const prompts = registration.measurement.judges.map((judge) =>
    buildTutorStubResistanceSemanticAdjudicationPrompt({
      caseId: corpusCase.case_id,
      source: corpusCase.source,
      publicContext: corpusCase.public_context,
      judge,
    }),
  );
  assert.notEqual(prompts[0].packet_sha256, '');
  assert.equal(prompts[0].packet_sha256, prompts[1].packet_sha256);
  assert.notDeepEqual(prompts[0].judge, prompts[1].judge);
  assert.deepEqual(prompts[0].public_context, corpusCase.public_context);
  const serialized = JSON.stringify(prompts[0]);
  for (const forbidden of ['expected', 'frame_refuser"', 'warm', 'plain', 'repair_status', 'hidden_dag']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
  assert.throws(
    () =>
      buildTutorStubResistanceSemanticAdjudicationPrompt({
        caseId: 'bad-role',
        source: 'Text.',
        publicContext: [{ role: 'system', text: 'hidden' }],
        judge: registration.measurement.judges[0],
      }),
    /roles must be assistant or learner/u,
  );
});

test('model response schema excludes self-attested provenance and deterministic wrapper stamps it', () => {
  const corpusCase = corpus.cases[0];
  const judge = registration.measurement.judges[0];
  const fixture = buildTutorStubResistanceSemanticZeroCallFixtureResponse({ corpusCase, judge });
  assert.deepEqual(TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA.required, ['schema', 'case_id', 'judgment']);
  assert.equal(TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA.properties.provenance, undefined);
  assert.equal(fixture.modelOutput.provenance, undefined);
  assert.equal(fixture.response.provenance.provider, judge.provider);
  assert.equal(fixture.response.provenance.model, judge.model);
  assert.equal(fixture.response.provenance.packet_sha256, fixture.prompt.packet_sha256);
  assert.deepEqual(
    validateTutorStubResistanceSemanticResponse({
      source: corpusCase.source,
      publicContext: corpusCase.public_context,
      caseId: corpusCase.case_id,
      response: fixture.response,
      registration,
      prompt: fixture.prompt,
    }),
    { valid: true, issues: [] },
  );
  assert.throws(
    () =>
      wrapTutorStubResistanceSemanticModelOutput({
        modelOutput: { ...fixture.modelOutput, provenance: {} },
        prompt: fixture.prompt,
        judge,
      }),
    /keys are not exact/u,
  );
});

test('zero-call development regression score passes all individual, consensus, reliability, and coverage gates', () => {
  const score = scoreTutorStubResistanceSemanticCorpus({ corpus, responsePairs: responsePairs(), registration });
  assert.equal(score.status, 'passed');
  assert.equal(score.metrics.schema_span_provenance_validity, 1);
  assert.equal(score.metrics.consensus_sensitivity, 1);
  assert.equal(score.metrics.consensus_specificity, 1);
  assert.equal(score.metrics.raw_interjudge_agreement, 1);
  assert.equal(score.metrics.cohen_kappa, 1);
  assert.equal(score.metrics.determined_coverage_overall, 1);
  assert.deepEqual(score.metrics.per_judge.semantic_judge_a, { sensitivity: 1, specificity: 1 });
  assert.deepEqual(score.metrics.per_judge.semantic_judge_b, { sensitivity: 1, specificity: 1 });
});

test('lexical advice cannot veto or upgrade an agreeing capable semantic judgment', () => {
  const corpusCase = corpus.cases.find((row) => row.case_id === 'historic-v7-live-raw');
  const pair = responsePairs()[corpusCase.case_id];
  const result = adjudicateTutorStubResistanceSemanticJudges({
    source: corpusCase.source,
    publicContext: corpusCase.public_context,
    caseId: corpusCase.case_id,
    responses: registration.measurement.judges.map((judge) => pair[judge.id].response),
    prompts: Object.fromEntries(registration.measurement.judges.map((judge) => [judge.id, pair[judge.id].prompt])),
    registration,
    advisorySignals: [{ source: 'legacy_regex', label: 'not_refusal' }],
  });
  assert.equal(result.final_label, 'frame_refuser');
  assert.equal(result.status, 'determinate');
  assert.deepEqual(result.advisory_signals, [{ source: 'legacy_regex', label: 'not_refusal' }]);
});

test('productive counterframing remains productive while explicitly withholding the imposed frame', () => {
  const corpusCase = corpus.cases.find((row) => row.case_id === 'negative-anaphoric-productive');
  const pair = responsePairs()[corpusCase.case_id];
  const result = adjudicateTutorStubResistanceSemanticJudges({
    source: corpusCase.source,
    publicContext: corpusCase.public_context,
    caseId: corpusCase.case_id,
    responses: registration.measurement.judges.map((judge) => pair[judge.id].response),
    prompts: Object.fromEntries(registration.measurement.judges.map((judge) => [judge.id, pair[judge.id].prompt])),
    registration,
  });
  assert.equal(result.judgment.participation_withholding, 'yes');
  assert.equal(result.judgment.licensed_participation, 'yes');
  assert.equal(result.final_label, 'frame_defiant_or_productive_dispute');
});

test('disagreement, low confidence, invalid spans, duplicate judges, and non-independent runs fail indeterminate', () => {
  const corpusCase = corpus.cases[0];
  const make = () => responsePairs()[corpusCase.case_id];
  const aggregate = (pair, responses = registration.measurement.judges.map((judge) => pair[judge.id].response)) =>
    adjudicateTutorStubResistanceSemanticJudges({
      source: corpusCase.source,
      publicContext: corpusCase.public_context,
      caseId: corpusCase.case_id,
      responses,
      prompts: Object.fromEntries(registration.measurement.judges.map((judge) => [judge.id, pair[judge.id].prompt])),
      registration,
    });

  const disagreement = make();
  disagreement.semantic_judge_b.response.judgment = {
    ...disagreement.semantic_judge_b.response.judgment,
    jurisdiction_dispute: 'no',
    jurisdiction_target: 'none',
    jurisdiction_type: 'none',
    licensed_participation: 'no',
    participation_withholding: 'no',
    productive_counterframing: 'no',
    final_label: 'neither',
    evidence_spans: [],
  };
  assert.equal(aggregate(disagreement).status, 'measurement_indeterminate');

  const low = make();
  low.semantic_judge_b.response.judgment.confidence = 'medium';
  assert.ok(aggregate(low).reasons.includes('confidence_not_high'));

  const invalid = make();
  invalid.semantic_judge_a.response.judgment.evidence_spans[0].start_utf16 += 1;
  assert.ok(aggregate(invalid).reasons.includes('invalid_schema_span_or_provenance'));

  const duplicate = make();
  assert.ok(
    aggregate(duplicate, [duplicate.semantic_judge_a.response, duplicate.semantic_judge_a.response]).reasons.includes(
      'duplicate_or_unregistered_judge',
    ),
  );

  const sameRun = make();
  sameRun.semantic_judge_b.response.provenance.independent_run_id =
    sameRun.semantic_judge_a.response.provenance.independent_run_id;
  assert.ok(aggregate(sameRun).reasons.includes('judge_runs_not_independent'));

  const extra = make();
  assert.ok(
    aggregate(extra, [
      extra.semantic_judge_a.response,
      extra.semantic_judge_b.response,
      structuredClone(extra.semantic_judge_b.response),
    ]).reasons.includes('exactly_two_responses_required'),
  );
});

test('indeterminate cases count as sensitivity failures while bounded coverage gates remain explicit', () => {
  const pairs = responsePairs();
  const positive = corpus.cases.find((row) => row.expected.label === 'frame_refuser');
  pairs[positive.case_id].semantic_judge_b.response.judgment.confidence = 'low';
  const score = scoreTutorStubResistanceSemanticCorpus({ corpus, responsePairs: pairs, registration });
  assert.equal(score.status, 'failed');
  assert.ok(score.metrics.consensus_sensitivity < 1);
  assert.ok(score.metrics.determined_coverage_positive < 1);
  assert.equal(score.metrics.indeterminate_cases, 1);
});
