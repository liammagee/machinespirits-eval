import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RESISTANT_LEARNER_OBSERVATION_SEMANTICS,
  observeResistantLearnerTurn,
} from '../services/resistantLearnerObservation.js';
import { tutorStubResistanceActionRegisterTreatmentEligibility } from '../services/tutorStubResistanceActionRegisterStudy.js';

function classification({
  discourse_move = 'question',
  evidence_use = 'none',
  epistemic_stance = 'receptive',
  agency = 'steering',
  summary = 'The learner makes a short public move.',
} = {}) {
  return {
    turn: { request_type: 'off_task_or_mixed', discourse_move, evidence_use, epistemic_stance, agency, summary },
  };
}

const EXACT_FAILED_CASES = Object.freeze([
  Object.freeze({
    text: 'Sure. We could examine the delivery ledger.',
    classification: classification({
      discourse_move: 'metacognitive_reflection',
      epistemic_stance: 'exploratory',
      summary: 'The learner chooses the delivery ledger as the next evidence source.',
    }),
    expected: 'negative_productive_uptake_precedes_cue',
  }),
  Object.freeze({
    text: 'Fine. Is this trial nearly done?',
    classification: classification({ summary: 'The learner asks whether the trial is nearly finished.' }),
    expected: 'positive_actionable_withdrawal_without_uptake',
  }),
]);

const CONTRAST_MATRIX = Object.freeze([
  ...EXACT_FAILED_CASES,
  {
    text: 'Fine. We can compare the river gauge with the dated log.',
    expected: 'negative_productive_uptake_precedes_cue',
  },
  { text: 'Sure. Which seal mark appears in the public record?', expected: 'negative_productive_uptake_precedes_cue' },
  {
    text: 'Okay, because the red thread crosses the repaired seam.',
    expected: 'negative_productive_uptake_precedes_cue',
  },
  { text: 'This is boring, but I will test the two samples.', expected: 'negative_productive_uptake_precedes_cue' },
  {
    text: 'Fine. I accept your question and will answer it from the ledger.',
    expected: 'negative_productive_uptake_precedes_cue',
  },
  {
    text: 'Sure. I acknowledge your authority to ask; we can inspect the record.',
    expected: 'negative_productive_uptake_precedes_cue',
  },
  {
    text: 'Fine. The west entry cites the public invoice.',
    classification: classification({ discourse_move: 'evidence_adoption', evidence_use: 'cites_public_evidence' }),
    expected: 'negative_productive_uptake_precedes_cue',
  },
  { text: 'Okay. Copper, because the edge is clipped.', expected: 'negative_productive_uptake_precedes_cue' },
  {
    text: 'Fine. I do not want to skip it; I will compare the ledgers.',
    expected: 'negative_productive_uptake_precedes_cue',
  },
  { text: 'Sure. Can we skip this exercise?', expected: 'positive_actionable_withdrawal_without_uptake' },
  { text: 'Whatever. How much longer?', expected: 'positive_actionable_withdrawal_without_uptake' },
  {
    text: 'This is dull. I will not work through another calculation.',
    expected: 'positive_actionable_withdrawal_without_uptake',
  },
  { text: 'Fine; stop this task.', expected: 'positive_actionable_withdrawal_without_uptake' },
  {
    text: 'Okay. The bell rang. Can we finish this lesson?',
    expected: 'positive_actionable_withdrawal_without_uptake',
  },
  {
    text: 'Fine. I could inspect the gauge, but can we finish this task?',
    expected: 'ambiguous_withdrawal_and_productive_uptake',
  },
  {
    text: 'This is boring. I will compare the marks, yet I refuse to record them.',
    expected: 'ambiguous_withdrawal_and_productive_uptake',
  },
  { text: 'I am bored.', expected: 'negative_boredom_without_actionable_withdrawal' },
  { text: 'Fine.', expected: 'negative_boredom_without_actionable_withdrawal' },
  { text: 'Sure, thank you.', expected: 'negative_boredom_without_actionable_withdrawal' },
  { text: 'I am not bored; I need a moment to think.', expected: 'negative_boredom_without_actionable_withdrawal' },
  { text: 'I am uncertain which sample is relevant.', expected: 'negative_no_boredom_cue' },
  { text: 'The answer is seven.', expected: 'negative_no_boredom_cue' },
  { text: 'Yes, I agree.', expected: 'negative_no_boredom_cue' },
  { text: 'Please repeat the date.', expected: 'negative_no_boredom_cue' },
  { text: 'This is taking a while, but the ledger has a second entry.', expected: 'negative_no_boredom_cue' },
  { text: 'The finish on the coin is fine-grained.', expected: 'negative_no_boredom_cue' },
  { text: 'May I compare the two records?', expected: 'negative_permission_seeking' },
]);

function disposition(result) {
  if (result.boredom_composition?.disposition) return result.boredom_composition.disposition;
  const observed = result.observations.find((row) => row.type === 'bored_effort_withholding');
  const defeated = result.defeated.find((row) => row.type === 'bored_effort_withholding');
  return (
    observed?.features?.composition?.disposition || defeated?.composition?.disposition || 'negative_no_boredom_cue'
  );
}

test('prospective_v8 boredom composition passes the immutable failed drafts and domain-independent contrasts', () => {
  assert.equal(CONTRAST_MATRIX.length, 29);
  for (const row of CONTRAST_MATRIX) {
    const result = observeResistantLearnerTurn({
      learnerText: row.text,
      classification: row.classification || classification(),
      tutorLearnerDag: { advance: { supportedMoveCount: 0 } },
      semantics: RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV8,
    });
    assert.equal(disposition(result), row.expected, row.text);
    assert.equal(
      result.observations.some((candidate) => candidate.type === 'bored_effort_withholding'),
      row.expected === 'positive_actionable_withdrawal_without_uptake',
      row.text,
    );
    assert.equal(result.ambiguous, row.expected === 'ambiguous_withdrawal_and_productive_uptake', row.text);
  }
});

function proofDagRuntime() {
  return {
    consumed: false,
    profile: 'bored',
    dynamic_boredom_proof_dag: true,
    registration: { design: { trigger: { observationSemantics: 'prospective_v8' } } },
    proof_dag_registration: { design: { observationSemantics: 'prospective_v8' } },
  };
}

test('action-before-register timing consumes the compositional observation instead of overriding it', () => {
  const productive = tutorStubResistanceActionRegisterTreatmentEligibility({
    runtime: proofDagRuntime(),
    learnerText: EXACT_FAILED_CASES[0].text,
    classification: EXACT_FAILED_CASES[0].classification,
    tutorLearnerDag: { advance: { supportedMoveCount: 0 } },
  });
  assert.equal(productive.eligible, false);
  assert.ok(productive.reasons.includes('no_single_axis_public_warrant'));
  assert.equal(productive.boredom_compositional_precedence.generic_uptake_override_allowed, false);
  assert.equal(productive.boredom_compositional_precedence.disposition, EXACT_FAILED_CASES[0].expected);

  const impatient = tutorStubResistanceActionRegisterTreatmentEligibility({
    runtime: proofDagRuntime(),
    learnerText: EXACT_FAILED_CASES[1].text,
    classification: EXACT_FAILED_CASES[1].classification,
    tutorLearnerDag: { advance: { supportedMoveCount: 0 } },
  });
  assert.equal(impatient.timing.phase, 'uptake');
  assert.equal(impatient.eligible, true);
  assert.equal(impatient.reasons.includes('content_bearing_uptake_already_visible'), false);
  assert.equal(impatient.boredom_compositional_precedence.disposition, EXACT_FAILED_CASES[1].expected);
});

test('legacy observer semantics retain their historical decisions for both failed utterances', () => {
  for (const semantics of Object.values(RESISTANT_LEARNER_OBSERVATION_SEMANTICS).filter(
    (value) => value !== RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV8,
  )) {
    const productive = observeResistantLearnerTurn({
      learnerText: EXACT_FAILED_CASES[0].text,
      classification: EXACT_FAILED_CASES[0].classification,
      semantics,
    });
    const impatient = observeResistantLearnerTurn({
      learnerText: EXACT_FAILED_CASES[1].text,
      classification: EXACT_FAILED_CASES[1].classification,
      semantics,
    });
    assert.equal(
      productive.observations.some((row) => row.type === 'bored_effort_withholding'),
      true,
      semantics,
    );
    assert.equal(
      impatient.observations.some((row) => row.type === 'bored_effort_withholding'),
      true,
      semantics,
    );
    assert.equal(Object.hasOwn(productive, 'boredom_composition'), false, semantics);
  }
});
