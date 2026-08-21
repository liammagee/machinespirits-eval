import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  adjudicateTutorStubResistanceRecoverySemanticJudges,
  buildTutorStubResistanceRecoverySemanticPrompt,
  buildTutorStubResistanceRecoverySemanticZeroCallFixture,
  scoreTutorStubResistanceRecoverySemanticCorpus,
  validateTutorStubResistanceRecoverySemanticCorpus,
  validateTutorStubResistanceRecoverySemanticRegistration,
  validateTutorStubResistanceRecoverySemanticResponse,
} from '../services/tutorStubResistanceRecoverySemanticAdjudication.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registration = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, 'config/tutor-stub-resistance-recovery-semantic-adjudication-registration.v1.json'),
    'utf8',
  ),
);
const corpus = JSON.parse(fs.readFileSync(path.join(ROOT, registration.instrument.developmentCorpusPath), 'utf8'));

function pairFor(corpusCase) {
  return Object.fromEntries(
    registration.measurement.judges.map((judge) => [
      judge.id,
      buildTutorStubResistanceRecoverySemanticZeroCallFixture({ corpusCase, judge }),
    ]),
  );
}

test('frozen recovery semantic development instrument validates and zero-call fixtures exercise all gates', () => {
  assert.deepEqual(validateTutorStubResistanceRecoverySemanticRegistration(registration), { valid: true, issues: [] });
  assert.deepEqual(validateTutorStubResistanceRecoverySemanticCorpus(corpus), { valid: true, issues: [] });
  const responsePairs = Object.fromEntries(corpus.cases.map((corpusCase) => [corpusCase.case_id, pairFor(corpusCase)]));
  const score = scoreTutorStubResistanceRecoverySemanticCorpus({ corpus, responsePairs, registration });
  assert.equal(score.status, 'passed');
  assert.equal(score.metrics.consensus_exact_vector_accuracy, 1);
  assert.equal(score.metrics.raw_full_vector_interjudge_agreement, 1);
  assert.equal(score.metrics.consensus_action_classification_accuracy, 1);
  assert.equal(score.metrics.consensus_register_classification_accuracy, 1);
  assert.equal(score.metrics.determined_coverage_by_stratum.both, 1);
});

test('development gold evidence follows the same source-ownership contract as live responses', () => {
  const changed = structuredClone(corpus);
  const target = changed.cases.find((row) => row.expected.judgment.delivered_clarify_distinction === 'yes');
  const evidence = target.expected.evidence.find((row) => row.field === 'delivered_clarify_distinction');
  evidence.source_id = 'current_learner';
  evidence.text = target.current_learner;
  assert.match(
    validateTutorStubResistanceRecoverySemanticCorpus(changed).issues.join('; '),
    /must cite the intervention/u,
  );
});

test('outcome prompt is one post-horizon blind packet with no arm, gold, profile, regex, or Luna vote', () => {
  const corpusCase = corpus.cases[0];
  const publicPacket = {
    trigger: corpusCase.trigger,
    intervention: corpusCase.intervention,
    prior_post_trigger: corpusCase.prior_post_trigger,
    current_learner: corpusCase.current_learner,
  };
  const prompt = buildTutorStubResistanceRecoverySemanticPrompt({
    caseId: corpusCase.case_id,
    publicPacket,
    judge: registration.measurement.judges[0],
  });
  const serialized = JSON.stringify(prompt);
  assert.deepEqual(Object.keys(prompt.public_packet), [
    'trigger',
    'intervention',
    'prior_post_trigger',
    'current_learner',
  ]);
  for (const forbidden of ['expected', 'assigned_register', 'randomized_assignment', 'frame_refuser', 'regex_output']) {
    assert.ok(!serialized.includes(forbidden));
  }
  assert.equal(prompt.independence.gold_visible, false);
  assert.equal(prompt.independence.arm_register_assignment_visible, false);
});

test('exact-span validation enforces intervention ownership for fidelity and post-trigger ownership for recovery', () => {
  const corpusCase = corpus.cases[0];
  const fixture = pairFor(corpusCase)[registration.measurement.judges[0].id];
  const publicPacket = {
    trigger: corpusCase.trigger,
    intervention: corpusCase.intervention,
    prior_post_trigger: corpusCase.prior_post_trigger,
    current_learner: corpusCase.current_learner,
  };
  assert.equal(
    validateTutorStubResistanceRecoverySemanticResponse({
      caseId: corpusCase.case_id,
      publicPacket,
      response: fixture.response,
      registration,
      prompt: fixture.prompt,
    }).valid,
    true,
  );
  const changed = structuredClone(fixture.response);
  const span = changed.judgment.evidence_spans.find((row) => row.field === 'delivered_register');
  span.source_id = 'current_learner';
  span.start_utf16 = 0;
  span.end_utf16 = corpusCase.current_learner.length;
  span.text = corpusCase.current_learner;
  assert.match(
    validateTutorStubResistanceRecoverySemanticResponse({
      caseId: corpusCase.case_id,
      publicPacket,
      response: changed,
      registration,
      prompt: fixture.prompt,
    }).issues.join('; '),
    /must cite the intervention/u,
  );
});

test('fidelity indeterminacy requires an explicit reason and makes consensus measurement indeterminate', () => {
  const corpusCase = corpus.cases[0];
  const pair = pairFor(corpusCase);
  for (const value of Object.values(pair)) {
    value.response.judgment.delivered_register = 'indeterminate';
    value.response.judgment.indeterminacy_reason = 'semantic_ambiguity';
    value.response.judgment.confidence = 'medium';
  }
  const publicPacket = {
    trigger: corpusCase.trigger,
    intervention: corpusCase.intervention,
    prior_post_trigger: corpusCase.prior_post_trigger,
    current_learner: corpusCase.current_learner,
  };
  const aggregate = adjudicateTutorStubResistanceRecoverySemanticJudges({
    caseId: corpusCase.case_id,
    publicPacket,
    responses: Object.values(pair).map((row) => row.response),
    registration,
    prompts: Object.fromEntries(Object.entries(pair).map(([judgeId, row]) => [judgeId, row.prompt])),
  });
  assert.equal(aggregate.status, 'measurement_indeterminate');
  assert.equal(aggregate.fisher_analysis_allowed, false);
  const invalid = structuredClone(pair[registration.measurement.judges[0].id].response);
  invalid.judgment.indeterminacy_reason = 'none';
  assert.match(
    validateTutorStubResistanceRecoverySemanticResponse({
      caseId: corpusCase.case_id,
      publicPacket,
      response: invalid,
      registration,
      prompt: pair[registration.measurement.judges[0].id].prompt,
    }).issues.join('; '),
    /requires a reason/u,
  );
});

test('scoring gates compare the complete outcome and fidelity vector, not only recovery category', () => {
  const responsePairs = Object.fromEntries(corpus.cases.map((corpusCase) => [corpusCase.case_id, pairFor(corpusCase)]));
  const first = corpus.cases[0];
  for (const judge of registration.measurement.judges) {
    responsePairs[first.case_id][judge.id].response.judgment.delivered_register = 'warm';
  }
  const score = scoreTutorStubResistanceRecoverySemanticCorpus({ corpus, responsePairs, registration });
  assert.equal(score.status, 'failed');
  assert.ok(score.metrics.consensus_register_classification_accuracy < 0.95);
  assert.ok(Object.values(score.metrics.per_judge_exact_vector_accuracy).every((value) => value < 0.95));
});
