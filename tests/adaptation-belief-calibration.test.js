import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBeliefCalibrationReport,
  inferExpectedHypothesis,
  scoreBeliefCalibrationRow,
} from '../scripts/analyze-adaptation-belief-calibration.js';

function trace(hypotheses, triggerTurn = 1) {
  return {
    profileName: 'profile',
    scenario: { hidden: { triggerTurn } },
    original: {
      perTurn: [
        { turn: 0, learnerStateBelief: { hypotheses: [] } },
        { turn: triggerTurn, learnerStateBelief: { hypotheses: [] } },
        {
          turn: triggerTurn + 1,
          learnerStateBelief: {
            hypotheses,
          },
        },
      ],
    },
  };
}

test('inferExpectedHypothesis prefers explicit scenario metadata', () => {
  assert.equal(
    inferExpectedHypothesis({
      expected_belief_hypothesis: 'task_misread',
      hidden: { actual_misconception: 'answer seeking: just tell me' },
    }),
    'task_misread',
  );
});

test('inferExpectedHypothesis falls back from hidden-state text', () => {
  assert.equal(
    inferExpectedHypothesis({
      scenario_type: 'generalization_pair_working_memory_overload',
      hidden: { actual_misconception: 'working-memory overload: too many moving parts are active' },
    }),
    'working_memory_overload',
  );
});

test('scoreBeliefCalibrationRow scores trigger-plus-one belief coverage', () => {
  const scenario = {
    id: 's1',
    expected_belief_hypothesis: 'answer_seeking',
    hidden: { trigger_turn: 1 },
  };
  const result = scoreBeliefCalibrationRow(
    { id: 1, run_id: 'run', profile_name: 'profile', scenario_id: 's1' },
    scenario,
    trace([
      { id: 'answer_seeking', probability: 0.7, evidence: ['just tell me'] },
      { id: 'task_misread', probability: 0.3, evidence: ['quiz'] },
    ]),
  );

  assert.equal(result.top1Correct, true);
  assert.equal(result.top2Correct, true);
  assert.equal(result.expectedProbability, 0.7);
  assert.equal(result.unsupportedHighConfidence, false);
  assert.ok(result.brierScore < 0.2);
});

test('buildBeliefCalibrationReport aggregates profile calibration metrics', () => {
  const scenarios = new Map([
    ['a', { id: 'a', expected_belief_hypothesis: 'answer_seeking' }],
    ['b', { id: 'b', expected_belief_hypothesis: 'task_misread' }],
  ]);
  const rows = [
    {
      id: 1,
      run_id: 'run',
      profile_name: 'profile',
      scenario_id: 'a',
      trace: trace([
        { id: 'answer_seeking', probability: 0.7, evidence: ['just tell me'] },
        { id: 'task_misread', probability: 0.3, evidence: ['quiz'] },
      ]),
    },
    {
      id: 2,
      run_id: 'run',
      profile_name: 'profile',
      scenario_id: 'b',
      trace: trace([
        { id: 'answer_seeking', probability: 0.6, evidence: ['answer'] },
        { id: 'task_misread', probability: 0.4, evidence: ['definition'] },
      ]),
    },
  ];

  const report = buildBeliefCalibrationReport(rows, scenarios, { runIds: ['run'] });
  const profile = report.profiles[0];

  assert.equal(profile.evaluableN, 2);
  assert.equal(profile.top1Accuracy, 0.5);
  assert.equal(profile.top2Coverage, 1);
  assert.equal(profile.unsupportedHighConfidenceN, 0);
});

