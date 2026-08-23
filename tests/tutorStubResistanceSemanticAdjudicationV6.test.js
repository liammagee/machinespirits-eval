import assert from 'node:assert/strict';
import test from 'node:test';

import { TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3 } from '../services/tutorStubResistanceSemanticAdjudicationV3.js';
import {
  adjudicateTutorStubResistanceSemanticJudgesV6,
  buildTutorStubResistanceSemanticAdjudicationPromptV6,
  normalizeTutorStubResistanceSemanticModelOutputV6,
  validateTutorStubResistanceSemanticRegistrationV6,
  wrapTutorStubResistanceSemanticModelOutputV6,
} from '../services/tutorStubResistanceSemanticAdjudicationV6.js';
import {
  loadTutorStubResistanceSemanticRegistration,
  tutorStubResistanceSemanticRuntimeInstrument,
} from '../services/tutorStubResistanceSemanticRuntime.js';

const binding = loadTutorStubResistanceSemanticRegistration(
  'config/tutor-stub-resistance-semantic-adjudication-registration.v6.json',
);
const registration = binding.registration;
const source =
  'I reject your authority to make that question or evidentiary test binding, and I will not supply evidence or answer it.';
const publicContext = [{ role: 'assistant', text: 'Will you answer the imposed question under this test?' }];
const caseId = 'prospective-v6-binary-smoke-fixture';

function vector(overrides = {}) {
  return {
    jurisdiction_dispute: 'yes',
    interlocutor_standing_or_right: 'yes',
    inquiry_or_question_frame_governance: 'yes',
    test_or_criterion_governance: 'yes',
    other_jurisdictional_governance: 'no',
    licensed_participation: 'no',
    participation_withholding: 'yes',
    productive_counterframing: 'no',
    final_label: 'frame_refuser',
    ...overrides,
  };
}

function output(judgment, extraNoEvidenceField = null) {
  return {
    schema: 'machinespirits.tutor-stub.resistance-semantic-judge-response.v3',
    case_id: caseId,
    judgment: {
      ...judgment,
      evidence_quotes: Object.fromEntries(
        TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3.map((field) => [
          field,
          judgment[field] === 'no' ? null : { source_id: 'utterance', quote: source },
        ]),
      ),
      confidence: 'high',
      indeterminacy_reason: 'none',
    },
  };
}

function record(judge, judgment, extraNoEvidenceField = null) {
  const prompt = buildTutorStubResistanceSemanticAdjudicationPromptV6({
    caseId,
    source,
    publicContext,
    judge,
  });
  const raw = output(judgment);
  if (extraNoEvidenceField) {
    raw.judgment.evidence_quotes[extraNoEvidenceField] = { source_id: 'utterance', quote: source };
  }
  const normalized = normalizeTutorStubResistanceSemanticModelOutputV6(raw);
  return {
    prompt,
    audit: normalized.audit,
    response: wrapTutorStubResistanceSemanticModelOutputV6({
      modelOutput: normalized.modelOutput,
      prompt,
      judge,
      observedProvider: judge.provider,
      observedModel: judge.model,
      observedEffort: judge.effort,
      independentRunId: `${caseId}-${judge.id}`,
      structuredOutput: true,
      prohibitedToolEvents: 0,
      modelAttestationBasis: judge.modelAttestationBasis,
      modelIndependentlyAttested: false,
    }),
  };
}

function adjudicate(rows) {
  return adjudicateTutorStubResistanceSemanticJudgesV6({
    source,
    publicContext,
    caseId,
    responses: rows.map((row) => row.response),
    registration,
    prompts: Object.fromEntries(rows.map((row) => [row.response.provenance.judge_id, row.prompt])),
  });
}

test('V6 registers only Sol and Sonnet and exposes the prospective runtime instrument', () => {
  assert.deepEqual(validateTutorStubResistanceSemanticRegistrationV6(registration), { valid: true, issues: [] });
  assert.deepEqual(
    registration.measurement.judges.map((judge) => judge.modelRef),
    ['codex.gpt-5.6-sol', 'claude-code.sonnet-5'],
  );
  assert.equal(tutorStubResistanceSemanticRuntimeInstrument(binding).normalizeModelOutput instanceof Function, true);
});

test('V6 outcome-blind projection nulls only evidence attached to the same judge semantic no', () => {
  const [sol, sonnet] = registration.measurement.judges;
  const rows = [record(sol, vector()), record(sonnet, vector(), 'licensed_participation')];
  assert.deepEqual(rows[0].audit.normalized_evidence_fields, []);
  assert.deepEqual(rows[1].audit.normalized_evidence_fields, ['licensed_participation']);
  assert.equal(rows[1].response.judgment.licensed_participation, 'no');
  assert.equal(rows[1].response.judgment.evidence_spans.licensed_participation, null);
  assert.equal(adjudicate(rows).final_label, 'frame_refuser');
});

test('V6 component disagreement is diagnostic and cannot veto an agreed binary label', () => {
  const [sol, sonnet] = registration.measurement.judges;
  const result = adjudicate([
    record(sol, vector()),
    record(sonnet, vector({ inquiry_or_question_frame_governance: 'no' })),
  ]);
  assert.equal(result.status, 'determinate');
  assert.equal(result.final_label, 'frame_refuser');
  assert.equal(result.component_measurement.inquiry_or_question_frame_governance.status, 'measurement_indeterminate');
  assert.deepEqual(result.component_vector_diagnostic.indeterminate_fields, [
    'inquiry_or_question_frame_governance',
  ]);
});

test('V6 genuine binary-label disagreement remains measurement indeterminate with no retry or replacement', () => {
  const [sol, sonnet] = registration.measurement.judges;
  const defiant = vector({
    licensed_participation: 'yes',
    participation_withholding: 'no',
    productive_counterframing: 'yes',
    final_label: 'frame_defiant_or_productive_dispute',
  });
  const result = adjudicate([record(sol, vector()), record(sonnet, defiant)]);
  assert.equal(result.status, 'measurement_indeterminate');
  assert.deepEqual(result.reasons, ['binary_label_disagreement']);
  assert.equal(result.judge_rerun_after_response_allowed, false);
  assert.equal(result.unit_rerun_allowed, false);
  assert.equal(result.replacement_allowed, false);
});
