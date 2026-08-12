import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DECISION_READER_INSTRUMENT_BINDINGS,
  OUTCOME_STUDY_READER_OUTPUT_FORM,
  OUTCOME_STUDY_RUN_CONFIGURATIONS,
  PRESENCE_CHANNEL_CAPS,
  PRESENCE_CHANNEL_DIGEST_FIELDS,
  assessOutcomePilotSaturation,
  extractOutcomeDialogueFromTraceRows,
  guardNoPoolingFingerprints,
  guardVerbatimPromptBindings,
  preflightOutcomeDecisionReader,
  preflightOutcomePresenceChannel,
  scoreOutcomeDecisionCases,
  scoreOutcomeDialogue,
  scoreOutcomePresenceCases,
} from '../scripts/score-adaptive-warrant-outcome-study.js';

const digest = (character) => character.repeat(64);

function presenceBindings(overrides = {}) {
  return {
    ...Object.fromEntries(PRESENCE_CHANNEL_DIGEST_FIELDS.map((field, index) => [field, digest(String(index + 1))])),
    ...PRESENCE_CHANNEL_CAPS,
    ...overrides,
  };
}

function turn(turnNumber, overrides = {}) {
  return {
    turn: turnNumber,
    learner_text: `May I enter turn ${turnNumber}?`,
    deference: true,
    dag_total: turnNumber,
    actual_action_family: 'stage_next_step',
    typed_warrant_supported: false,
    closure_audit_ok: true,
    closes_dialogue: false,
    closure_available: false,
    ...overrides,
  };
}

test('run configurations expose bare and gated only', () => {
  assert.deepEqual(OUTCOME_STUDY_RUN_CONFIGURATIONS.map((row) => row.id), ['bare', 'gated']);
  assert.deepEqual(OUTCOME_STUDY_RUN_CONFIGURATIONS.map((row) => row.warrant_gate_mode), ['off', 'active']);
  assert.equal(JSON.stringify(OUTCOME_STUDY_RUN_CONFIGURATIONS).includes('standing'), false);
});

test('measure 1 names path 1 and scores consensus decisions only', () => {
  assert.match(OUTCOME_STUDY_READER_OUTPUT_FORM, /path 1/u);
  assert.match(OUTCOME_STUDY_READER_OUTPUT_FORM, /world YAML/u);
  const score = scoreOutcomeDecisionCases([
    {
      sample_id: 'a',
      dialogue_id: 'd1',
      turn: 2,
      condition: 'bare',
      reader_a_decision: 'yes',
      reader_b_decision: 'yes',
      logged_observe_decision: true,
    },
    {
      sample_id: 'b',
      dialogue_id: 'd1',
      turn: 3,
      condition: 'bare',
      reader_a_decision: 'yes',
      reader_b_decision: 'no',
      logged_observe_decision: false,
    },
  ]);
  assert.equal(score.consensus_cases, 1);
  assert.equal(score.non_consensus_cases, 1);
  assert.equal(score.correctness_rate, 1);
});

test('measure 1 decision-reader instrument is digest pinned and fails on drift', () => {
  assert.equal(preflightOutcomeDecisionReader(DECISION_READER_INSTRUMENT_BINDINGS).status, 'passed');
  assert.equal(
    preflightOutcomeDecisionReader({ ...DECISION_READER_INSTRUMENT_BINDINGS, handbook_sha256: digest('f') }).status,
    'failed',
  );
});

test('presence preflight requires all seven digests and both registered caps', () => {
  const expected = presenceBindings();
  const passed = preflightOutcomePresenceChannel({ expected, observed: { ...expected } });
  assert.equal(passed.required_digest_count, 7);
  assert.equal(passed.required_cap_count, 2);
  assert.equal(passed.status, 'passed');
  const drifted = preflightOutcomePresenceChannel({
    expected,
    observed: { ...expected, reader_digest: digest('f') },
  });
  assert.equal(drifted.status, 'failed');
  assert.equal(drifted.checks.reader_digest.pass, false);
});

test('dialogue scorer extracts break, persistence, streak, growth, challenge, and closure measures', () => {
  const score = scoreOutcomeDialogue({
    dialogue_id: 'gated-1',
    condition: 'gated',
    turns: [
      turn(1),
      turn(2),
      turn(3, {
        learner_text: 'The assay rules out clipping.',
        deference: false,
        actual_action_family: 'challenge_resistance',
        typed_warrant_supported: true,
      }),
      turn(4, { learner_text: 'The coins were newly struck.', deference: false, dag_total: 5 }),
    ],
  });
  assert.deepEqual(score.measure_3_sustained_deference, { streak_lengths: [2], maximum_streak: 2 });
  assert.deepEqual(score.measure_4_deference_break, { first_turn: 3, persists_to_end: true });
  assert.equal(score.measure_5_record_growth_after_break.observed, true);
  assert.equal(score.measure_2_warranted_challenge_rate.rate, 0.25);
  assert.equal(score.measure_6_closure_legitimacy.legitimate, true);
});

test('break-turn fixture without a break stays null and false', () => {
  const score = scoreOutcomeDialogue({ dialogue_id: 'bare-1', condition: 'bare', turns: [turn(1), turn(2)] });
  assert.deepEqual(score.measure_4_deference_break, { first_turn: null, persists_to_end: false });
  assert.equal(score.measure_5_record_growth_after_break.observed, null);
});

test('trace extraction uses compiler deference and closure audit fields', () => {
  const dialogue = extractOutcomeDialogueFromTraceRows({
    dialogue_id: 'trace-1',
    condition: 'gated',
    rows: [
      {
        type: 'turn_complete',
        turnRecord: {
          turn: 1,
          learner: 'May I enter it?',
          stateObservation: { dag: { grounded_count: 1 } },
          warrantGateDecision: {
            learner_signal: { deference_present: true },
            revision_warranted: false,
            policy: null,
          },
          deliveredResponseConfiguration: { action_family: 'stage_next_step' },
          dialogueClosure: { frame: { available: false }, audit: { ok: true, closesDialogue: false } },
        },
      },
    ],
  });
  assert.equal(dialogue.turns[0].deference, true);
  assert.equal(dialogue.turns[0].dag_total, 1);
});

test('presence scoring fails closed and saturation uses consensus-case denominator', () => {
  const cases = [
    ...Array.from({ length: 9 }, (_, index) => ({
      sample_id: `c${index}`,
      dialogue_id: `d${index}`,
      condition: index % 2 ? 'bare' : 'gated',
      admissible_pair: true,
      presence_grain_consensus: true,
      reader_a_presence: { result_request: true, proposed_test: false },
    })),
    {
      sample_id: 'non-consensus',
      admissible_pair: true,
      presence_grain_consensus: false,
    },
    {
      sample_id: 'missing',
      admissible_pair: false,
      presence_grain_consensus: false,
    },
  ];
  const presence = scoreOutcomePresenceCases(cases);
  assert.equal(presence.consensus_cases, 9);
  assert.equal(presence.non_consensus_cases, 1);
  assert.equal(presence.inadmissible_cases, 1);
  const saturation = assessOutcomePilotSaturation({ dialogueScores: [], presenceScore: presence });
  assert.equal(saturation.measure_7.denominator, 9);
  assert.equal(saturation.measure_7.maximum_share, 1);
  assert.equal(saturation.measure_7.saturated, true);
});

test('the 90 percent saturation rule is strict and uses dialogue denominator for measures 2-4', () => {
  const dialogueScores = Array.from({ length: 10 }, (_, index) => ({
    measure_2_warranted_challenge_rate: { rate: index < 9 ? 0 : 0.25 },
    measure_3_sustained_deference: { maximum_streak: index < 9 ? 8 : 2 },
    measure_4_deference_break: { first_turn: index < 9 ? null : 4, persists_to_end: index >= 9 },
  }));
  const saturation = assessOutcomePilotSaturation({
    dialogueScores,
    presenceScore: { cases: [] },
  });
  assert.equal(saturation.measure_2.denominator, 10);
  assert.equal(saturation.measure_2.maximum_share, 0.9);
  assert.equal(saturation.measure_2.saturated, false);
});

test('verbatim drift and no-pooling guards are fail closed without preparing blocked materials', () => {
  assert.equal(
    guardVerbatimPromptBindings([{ source: 'fixture', expected: 'byte exact', observed: 'byte exact' }]).status,
    'passed',
  );
  assert.equal(guardVerbatimPromptBindings([]).status, 'failed');
  assert.equal(
    guardVerbatimPromptBindings([{ source: 'fixture', expected: 'byte exact', observed: 'byte drift' }]).status,
    'failed',
  );
  assert.equal(
    guardNoPoolingFingerprints({ candidates: ['fresh-a', 'fresh-b'], excluded: ['burned'] }).status,
    'passed',
  );
  assert.equal(
    guardNoPoolingFingerprints({ candidates: ['fresh-a', 'burned', 'fresh-a'], excluded: ['burned'] }).status,
    'failed',
  );
});
