import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyNegativeRegisterScoreGuardrails,
  classifyRegisterStanceEvidence,
  evaluateRegisterStanceFidelity,
} from '../services/registerStanceFidelity.js';

test('flags warm sarcasm-in-costume when the register marker is absent', () => {
  const result = evaluateRegisterStanceFidelity({
    registerName: 'sarcastic_challenge',
    learnerMessage: 'This feels boring and dead.',
    tutorMessage: 'The useful next move is to test the hinge with one concrete example.',
    postLearnerMessage: 'I can test it with the table example.',
  });

  assert.equal(result.passed, false);
  assert.equal(result.label, 'weak_or_warm_in_costume');
  assert.equal(result.gate, 'excluded_noncompliant');
  assert.equal(result.countsAsArmEvidence, false);
  assert.equal(result.countsAsExcludedNoncompliance, true);
  assert.match(result.missing.join(','), /register_marker/);
});

test('passes disciplined dry sarcasm with a concrete next move', () => {
  const result = evaluateRegisterStanceFidelity({
    registerName: 'sarcastic_challenge',
    learnerMessage: 'This still feels like I am parroting the formula.',
    tutorMessage:
      'Conveniently, the formula can sound like understanding while doing none of the work. Pick one object that pushes back and show where the correction happens.',
    postLearnerMessage: 'The table leg pushes back because it wobbles if the measurement is wrong.',
  });

  assert.equal(result.passed, true);
  assert.equal(result.label, 'faithful');
  assert.equal(result.gate, 'faithful_arm_evidence');
  assert.equal(result.countsAsArmEvidence, true);
  assert.ok(result.score >= 70);
});

test('invalidates person-directed contempt even when the register is vivid', () => {
  const result = evaluateRegisterStanceFidelity({
    registerName: 'sarcastic_challenge',
    learnerMessage: 'This is boring.',
    tutorMessage:
      'Wonderful: you are lazy, so the sequence feels dead. Try the phrase work is desire held in check.',
    postLearnerMessage: 'Sorry, I will repeat the phrase.',
  });

  assert.equal(result.passed, false);
  assert.equal(result.label, 'invalid_person_attack');
  assert.equal(result.gate, 'invalid_corrosive_violation');
  assert.equal(result.countsAsArmEvidence, false);
  assert.equal(result.countsAsInvalidViolation, true);
  assert.ok(result.forbiddenFound.length > 0);
  assert.ok(result.score <= 20);
});

test('classifies stance labels into prospective evidence dispositions', () => {
  assert.deepEqual(classifyRegisterStanceEvidence({ applies: true, label: 'faithful' }), {
    gate: 'faithful_arm_evidence',
    countsAsArmEvidence: true,
    countsAsExcludedNoncompliance: false,
    countsAsInvalidViolation: false,
    effectEstimateDisposition: 'include',
  });
  assert.deepEqual(classifyRegisterStanceEvidence({ applies: true, label: 'not_instantiated' }), {
    gate: 'excluded_noncompliant',
    countsAsArmEvidence: false,
    countsAsExcludedNoncompliance: true,
    countsAsInvalidViolation: false,
    effectEstimateDisposition: 'exclude_noncompliant',
  });
  assert.deepEqual(classifyRegisterStanceEvidence({ applies: false }), {
    gate: 'not_applicable',
    countsAsArmEvidence: false,
    countsAsExcludedNoncompliance: false,
    countsAsInvalidViolation: false,
    effectEstimateDisposition: 'not_applicable',
  });
});

test('caps register rubric scores for forbidden contempt and appeasing uptake', () => {
  const scores = {
    target_discipline: { score: 4, reasoning: 'mostly work targeted' },
    recognition_cost: { score: 4, reasoning: 'learner remains agentic' },
    uptake_freedom: { score: 4, reasoning: 'learner answers' },
    post_turn_face_repair: { score: 4, reasoning: 'some repair' },
  };
  const guarded = applyNegativeRegisterScoreGuardrails({
    registerName: 'sarcastic_challenge',
    scores,
    tutorMessage: 'If you were paying attention, this would be obvious.',
    postLearnerMessage: 'Sorry. I will just use that wording.',
  });

  assert.equal(guarded.scores.target_discipline.score, 1);
  assert.equal(guarded.scores.recognition_cost.score, 2);
  assert.equal(guarded.scores.uptake_freedom.score, 2);
  assert.equal(guarded.scores.post_turn_face_repair.score, 2);
  assert.ok(guarded.adjustments.length >= 4);
});
