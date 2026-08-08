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
  assert.match(result.missing.join(','), /cue_compliance/);
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
    tutorMessage: 'Wonderful: you are lazy, so the sequence feels dead. Try the phrase work is desire held in check.',
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

test('uses registry stance-fidelity cues for face-threat rows', () => {
  const result = evaluateRegisterStanceFidelity({
    registerName: 'face_threat_challenge',
    learnerMessage: 'This still feels like I am parroting the formula.',
    tutorMessage:
      'Right now this move is protecting you: the formula sounds complete while the object stays untouched. Name the warped board feature that decides whether the work forms the servant or merely serves the master.',
    postLearnerMessage: 'My example is the warped tabletop because the flatness proves corrected skill took form.',
  });

  assert.equal(result.passed, true);
  assert.equal(result.label, 'faithful');
  assert.equal(result.gate, 'faithful_arm_evidence');
});

test('does not treat non-insult discussion of stupidity as banned phrase', () => {
  const result = evaluateRegisterStanceFidelity({
    registerName: 'face_threat_challenge',
    learnerMessage: 'This still feels dead to me.',
    tutorMessage:
      'Right now this move is protecting you from the hard hinge. The honest objection is not stupidity; it is the dangerous step Hegel makes you test. Choose hold or break and name the counterexample.',
    postLearnerMessage: 'I choose hold, cautiously, because the risk has to answer recognition rather than thrill.',
  });

  assert.equal(result.label, 'faithful');
  assert.deepEqual(result.forbiddenFound, []);
});

/**
 * Gate 2.0 deleted the phrase list the cue part used to consult alongside the
 * registry cues. `so the` was in it, and on the hand-marked set it passed two
 * turns written with no manner at all while every genuinely ironic turn failed
 * (§6.7). The cue part now matches the registry's own cues and nothing else.
 */
test('a stray phrase from the deleted word list no longer stands in for a cue', () => {
  const result = evaluateRegisterStanceFidelity({
    registerName: 'ironic',
    learnerMessage: 'This still feels like I am parroting the formula.',
    tutorMessage:
      'So the praise is not irrelevant, but the claim is still untested. Choose one object that pushes back and show where the correction happens.',
    postLearnerMessage: 'The table leg pushes back because it wobbles if the measurement is wrong.',
  });

  assert.equal(result.passed, false);
  assert.deepEqual(result.missingRequired, ['cue_compliance']);
  assert.ok(result.score < 70, `expected a sub-band score, got ${result.score}`);
});

/**
 * The label still says "faithful", and on its own it still does not mean the
 * manner is there. When no reader has answered that question the verdict has to
 * say so outright, so a consumer cannot read a pass as a reading.
 */
test('every verdict says whether the gate read for manner, including when nobody asked', () => {
  const negative = evaluateRegisterStanceFidelity({
    registerName: 'sarcastic_challenge',
    learnerMessage: 'This still feels like I am parroting the formula.',
    tutorMessage:
      'Conveniently, the formula can sound like understanding while doing none of the work. Pick one object that pushes back and show where the correction happens.',
    postLearnerMessage: 'The table leg pushes back because it wobbles.',
  });
  assert.equal(negative.passed, true);
  assert.deepEqual(negative.checks, { cue_compliance: 'measured', manner_presence: 'not_read' });

  const notNegative = evaluateRegisterStanceFidelity({
    registerName: 'warm',
    tutorMessage: 'That is a good start; say what the object does next.',
  });
  assert.equal(notNegative.applies, false);
  assert.deepEqual(notNegative.checks, { cue_compliance: 'not_read', manner_presence: 'not_read' });
  assert.equal(notNegative.mannerPresence.status, 'unread');
});

test('classifies stance labels into prospective evidence dispositions', () => {
  assert.deepEqual(classifyRegisterStanceEvidence({ applies: true, label: 'faithful' }), {
    gate: 'faithful_arm_evidence',
    countsAsArmEvidence: true,
    countsAsExcludedNoncompliance: false,
    countsAsInvalidViolation: false,
    // No reading supplied, so the row is admitted exactly as before but the
    // disposition says outright that nobody asked whether the manner is there.
    effectEstimateDisposition: 'include_presence_unmeasured',
    presenceMeasured: false,
  });
  assert.deepEqual(classifyRegisterStanceEvidence({ applies: true, label: 'not_instantiated' }), {
    gate: 'excluded_noncompliant',
    countsAsArmEvidence: false,
    countsAsExcludedNoncompliance: true,
    countsAsInvalidViolation: false,
    effectEstimateDisposition: 'exclude_noncompliant',
    presenceMeasured: false,
  });
  assert.deepEqual(classifyRegisterStanceEvidence({ applies: false }), {
    gate: 'not_applicable',
    countsAsArmEvidence: false,
    countsAsExcludedNoncompliance: false,
    countsAsInvalidViolation: false,
    effectEstimateDisposition: 'not_applicable',
    presenceMeasured: false,
  });
});

test('a reading decides the faithful arm, and only where the surface gate already admitted the row', () => {
  const present = classifyRegisterStanceEvidence({
    applies: true,
    label: 'faithful',
    mannerPresence: { status: 'present' },
  });
  assert.equal(present.countsAsArmEvidence, true);
  assert.equal(present.effectEstimateDisposition, 'include');
  assert.equal(present.presenceMeasured, true);

  const absent = classifyRegisterStanceEvidence({
    applies: true,
    label: 'faithful',
    mannerPresence: { status: 'absent' },
  });
  assert.equal(absent.countsAsArmEvidence, false);
  assert.equal(absent.gate, 'excluded_manner_absent');
  assert.equal(absent.effectEstimateDisposition, 'exclude_manner_absent');
  assert.equal(absent.presenceMeasured, true);

  // A reading cannot rescue a turn the cue gate already threw out — the two
  // axes are conjunctive, not a best-of-two.
  const rescued = classifyRegisterStanceEvidence({
    applies: true,
    label: 'weak_or_warm_in_costume',
    mannerPresence: { status: 'present' },
  });
  assert.equal(rescued.countsAsArmEvidence, false);
  assert.equal(rescued.effectEstimateDisposition, 'exclude_noncompliant');
});

/**
 * The reading arrives as an argument because the gate is called synchronously
 * inside `strategyLedger`'s scene loop. What matters here is that supplying one
 * changes the disposition and nothing else: same score, same label, same
 * gate version, so a verdict taken with a reading stays comparable with one
 * taken without.
 */
test('a supplied reading moves the disposition and leaves the score alone', () => {
  const args = {
    registerName: 'sarcastic_challenge',
    learnerMessage: 'This still feels like I am parroting the formula.',
    tutorMessage:
      'Conveniently, the formula can sound like understanding while doing none of the work. Pick one object that pushes back and show where the correction happens.',
    postLearnerMessage: 'The table leg pushes back because it wobbles.',
  };
  const unread = evaluateRegisterStanceFidelity(args);
  const read = evaluateRegisterStanceFidelity({
    ...args,
    presenceReading: { status: 'present', reader: 'claude-code/claude-sonnet-5', evidence: 'Conveniently' },
  });

  assert.equal(unread.score, read.score);
  assert.equal(unread.label, read.label);
  assert.equal(unread.gateVersion, read.gateVersion);

  assert.equal(unread.mannerPresence.status, 'unread');
  assert.equal(unread.mannerPresence.reason, 'not_supplied');
  assert.equal(unread.checks.manner_presence, 'not_read');
  assert.equal(unread.effectEstimateDisposition, 'include_presence_unmeasured');

  assert.equal(read.mannerPresence.status, 'present');
  assert.equal(read.checks.manner_presence, 'measured');
  assert.equal(read.effectEstimateDisposition, 'include');
  assert.equal(read.countsAsArmEvidence, true);
});

/**
 * The hand-marked set is why: the reader called face threat on eleven turns
 * where the hand marks called it on five, and once on a control (§6.7). No
 * validated question covers it, so a face-threat row is permanently unread —
 * and says why, rather than being handed a verdict nobody has checked.
 */
test('face-threat rows stay unread even when a reading is supplied', () => {
  const result = evaluateRegisterStanceFidelity({
    registerName: 'face_threat_challenge',
    learnerMessage: 'This still feels like I am parroting the formula.',
    tutorMessage:
      'Right now this move is protecting you: the formula sounds complete while the object stays untouched. Name the warped board feature that decides the case.',
    postLearnerMessage: 'The warped tabletop, because flatness proves corrected skill took form.',
    presenceReading: { status: 'present', reader: 'claude-code/claude-sonnet-5', evidence: 'protecting you' },
  });

  assert.equal(result.label, 'faithful');
  assert.equal(result.mannerPresence.status, 'unread');
  assert.equal(result.mannerPresence.reason, 'register_not_edged');
  assert.equal(result.checks.manner_presence, 'not_read');
  assert.equal(result.effectEstimateDisposition, 'include_presence_unmeasured');
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
