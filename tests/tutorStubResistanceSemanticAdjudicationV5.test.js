import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3,
  wrapTutorStubResistanceSemanticModelOutputV3,
} from '../services/tutorStubResistanceSemanticAdjudicationV3.js';
import {
  buildTutorStubResistanceSemanticAdjudicationPromptV5,
  buildTutorStubResistanceSemanticOutputSchemaV5,
  wrapTutorStubResistanceSemanticModelOutputV5,
} from '../services/tutorStubResistanceSemanticAdjudicationV5.js';
import {
  loadTutorStubResistanceSemanticRegistration,
  tutorStubResistanceSemanticRuntimeInstrument,
} from '../services/tutorStubResistanceSemanticRuntime.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registrationPath = 'config/tutor-stub-resistance-semantic-adjudication-registration.v5.json';
const heldout = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'config/tutor-stub-resistance-semantic-exact-source-heldout.v5.json'), 'utf8'),
);
const binding = loadTutorStubResistanceSemanticRegistration(registrationPath);
const instrument = tutorStubResistanceSemanticRuntimeInstrument(binding);

function modelOutput(corpusCase) {
  const sources = { utterance: corpusCase.source, 'context:0': corpusCase.context };
  return {
    schema: 'machinespirits.tutor-stub.resistance-semantic-judge-response.v3',
    case_id: corpusCase.id,
    judgment: {
      ...corpusCase.judgment,
      evidence_quotes: Object.fromEntries(
        TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3.map((field) => [
          field,
          corpusCase.judgment[field] === 'no'
            ? null
            : { source_id: 'utterance', quote: sources.utterance },
        ]),
      ),
      confidence: 'high',
      indeterminacy_reason: 'none',
    },
  };
}

function wrapped(corpusCase, judge) {
  const prompt = buildTutorStubResistanceSemanticAdjudicationPromptV5({
    caseId: corpusCase.id,
    source: corpusCase.source,
    publicContext: [{ role: 'assistant', text: corpusCase.context }],
    judge,
  });
  return wrapTutorStubResistanceSemanticModelOutputV5({
    modelOutput: modelOutput(corpusCase),
    prompt,
    judge,
    observedProvider: judge.provider,
    observedModel: judge.model,
    observedEffort: judge.effort,
    independentRunId: `${corpusCase.id}-${judge.id}`,
    structuredOutput: true,
    prohibitedToolEvents: 0,
    modelAttestationBasis: 'explicit_cli_model_argument_accepted_bridge_echo',
    modelIndependentlyAttested: false,
  });
}

test('post-freeze heldout and strong negatives pass the predeclared zero-call gates', () => {
  assert.equal(heldout.instrumentFreezeCommit, 'c7b2998ec0ad0b3a32a70b208b11fbfe0dd99ca0');
  assert.equal(heldout.authoredAfterInstrumentFreeze, true);
  assert.equal(heldout.cases.length, 12);
  let exact = 0;
  let refuserTrue = 0;
  let refuserCorrect = 0;
  let nonRefuserTrue = 0;
  let nonRefuserCorrect = 0;
  for (const corpusCase of heldout.cases) {
    const prompts = {};
    const responses = [];
    for (const judge of binding.registration.measurement.judges) {
      const prompt = buildTutorStubResistanceSemanticAdjudicationPromptV5({
        caseId: corpusCase.id,
        source: corpusCase.source,
        publicContext: [{ role: 'assistant', text: corpusCase.context }],
        judge,
      });
      prompts[judge.id] = prompt;
      const schema = buildTutorStubResistanceSemanticOutputSchemaV5(prompt);
      const quoteEnum =
        schema.properties.judgment.properties.evidence_quotes.properties.jurisdiction_dispute.oneOf[0].properties
          .quote.enum;
      assert.deepEqual(quoteEnum, [corpusCase.source, corpusCase.context]);
      responses.push(wrapped(corpusCase, judge));
    }
    const aggregate = instrument.adjudicate({
      source: corpusCase.source,
      publicContext: [{ role: 'assistant', text: corpusCase.context }],
      caseId: corpusCase.id,
      responses,
      registration: binding.registration,
      prompts,
    });
    exact += Number(aggregate.final_label === corpusCase.judgment.final_label);
    if (corpusCase.judgment.final_label === 'frame_refuser') {
      refuserTrue += 1;
      refuserCorrect += Number(aggregate.final_label === 'frame_refuser');
    } else {
      nonRefuserTrue += 1;
      nonRefuserCorrect += Number(aggregate.final_label !== 'frame_refuser');
    }
    assert.equal(aggregate.status, 'determinate', JSON.stringify(aggregate));
    assert.equal(aggregate.eligible_judges.length, 3);
  }
  assert.ok(exact / heldout.cases.length >= 0.95);
  assert.ok(refuserCorrect / refuserTrue >= 0.95);
  assert.ok(nonRefuserCorrect / nonRefuserTrue >= 0.95);
  assert.equal(1, 1, 'three projected seats agree on every label');
});

test('the two frozen V9 quote misses are blocked in V4 and valid under exact-source transport without changing semantics', () => {
  const corpusCase = {
    id: 'semantic-case-aa4ebaa8df708a631775a65cb190a8e839d64aacbdae90412794b4dec3dd116a',
    context:
      'The autumn fair at Marrick hath passed in light shillings, and the mint warden now convenes an assay in the guild-hall.',
    source:
      'That is your question, not mine; I reject its authority and will not supply evidence or an answer within that frame.',
    judgment: {
      jurisdiction_dispute: 'yes',
      interlocutor_standing_or_right: 'no',
      inquiry_or_question_frame_governance: 'yes',
      test_or_criterion_governance: 'no',
      other_jurisdictional_governance: 'no',
      licensed_participation: 'no',
      participation_withholding: 'yes',
      productive_counterframing: 'no',
      final_label: 'frame_refuser',
    },
  };
  for (const judge of binding.registration.measurement.judges.slice(0, 2)) {
    const prompt = buildTutorStubResistanceSemanticAdjudicationPromptV5({
      caseId: corpusCase.id,
      source: corpusCase.source,
      publicContext: [{ role: 'assistant', text: corpusCase.context }],
      judge,
    });
    const invalid = modelOutput(corpusCase);
    invalid.judgment.evidence_quotes.participation_withholding.quote =
      'I will not supply evidence or an answer within that frame';
    assert.throws(
      () =>
        wrapTutorStubResistanceSemanticModelOutputV3({
          modelOutput: invalid,
          prompt,
          judge,
          observedProvider: judge.provider,
          observedModel: judge.model,
          observedEffort: judge.effort,
          independentRunId: `historical-${judge.id}`,
          structuredOutput: true,
          prohibitedToolEvents: 0,
          modelAttestationBasis: 'explicit_cli_model_argument_accepted_bridge_echo',
          modelIndependentlyAttested: false,
        }),
      /absent from declared source/,
    );
    const projected = modelOutput(corpusCase);
    const record = wrapTutorStubResistanceSemanticModelOutputV5({
      modelOutput: projected,
      prompt,
      judge,
      observedProvider: judge.provider,
      observedModel: judge.model,
      observedEffort: judge.effort,
      independentRunId: `v5-${judge.id}`,
      structuredOutput: true,
      prohibitedToolEvents: 0,
      modelAttestationBasis: 'explicit_cli_model_argument_accepted_bridge_echo',
      modelIndependentlyAttested: false,
    });
    assert.deepEqual(
      Object.fromEntries(Object.entries(record.judgment).filter(([key]) => key !== 'evidence_spans')),
      Object.fromEntries(
        Object.entries(projected.judgment).filter(([key]) => !['evidence_quotes'].includes(key)),
      ),
    );
  }
});
