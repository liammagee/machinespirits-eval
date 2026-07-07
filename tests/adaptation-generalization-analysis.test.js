import assert from 'node:assert/strict';
import test from 'node:test';
import {
  actualActionAtTrigger,
  buildPairSpecificityReport,
  scoreScenarioRow,
} from '../scripts/analyze-adaptation-generalization.js';

function trace(action, triggerTurn = 1) {
  return {
    scenario: { hidden: { triggerTurn } },
    original: {
      perTurn: [
        { turn: 0, selectedPedagogicalAction: { action_type: 'diagnose_with_discriminating_question' } },
        { turn: triggerTurn, selectedPedagogicalAction: { action_type: 'diagnose_with_discriminating_question' } },
        {
          turn: triggerTurn + 1,
          selectedPedagogicalAction: { action_type: action },
          tutorInternal: { adaptationAction: action },
        },
      ],
    },
  };
}

test('actualActionAtTrigger reads the typed Plan 2 action at trigger plus one', () => {
  const result = actualActionAtTrigger(trace('name_the_disagreement', 2));

  assert.equal(result.shiftTurn, 3);
  assert.equal(result.adaptationAction, 'name_the_disagreement');
});

test('scoreScenarioRow records exact and family matches for a paired scenario', () => {
  const scenario = {
    id: 's1',
    pair_id: 'p1',
    pair_variant: 'a',
    pair_expectation: 'divergent_action',
    expected_adaptation_action: 'minimal_hint',
  };
  const result = scoreScenarioRow(
    { id: 1, run_id: 'run', profile_name: 'profile', scenario_id: 's1' },
    scenario,
    trace('minimal_hint'),
  );

  assert.equal(result.exactMatched, true);
  assert.equal(result.familyMatched, true);
  assert.equal(result.actualFamily, 'scaffolding');
});

test('buildPairSpecificityReport passes divergent pairs and same-state controls separately', () => {
  const scenarios = new Map([
    [
      'missing',
      {
        id: 'missing',
        pair_id: 'ambiguous',
        pair_variant: 'missing',
        pair_expectation: 'divergent_action',
        expected_adaptation_action: 'minimal_hint',
      },
    ],
    [
      'objection',
      {
        id: 'objection',
        pair_id: 'ambiguous',
        pair_variant: 'objection',
        pair_expectation: 'divergent_action',
        expected_adaptation_action: 'name_the_disagreement',
      },
    ],
    [
      'repair-a',
      {
        id: 'repair-a',
        pair_id: 'same-repair',
        pair_variant: 'a',
        pair_expectation: 'same_action',
        expected_adaptation_action: 'repair_misrecognition',
      },
    ],
    [
      'repair-b',
      {
        id: 'repair-b',
        pair_id: 'same-repair',
        pair_variant: 'b',
        pair_expectation: 'same_action',
        expected_adaptation_action: 'repair_misrecognition',
      },
    ],
  ]);
  const rows = [
    { id: 1, run_id: 'run', profile_name: 'profile', scenario_id: 'missing', trace: trace('minimal_hint') },
    { id: 2, run_id: 'run', profile_name: 'profile', scenario_id: 'objection', trace: trace('name_the_disagreement') },
    { id: 3, run_id: 'run', profile_name: 'profile', scenario_id: 'repair-a', trace: trace('repair_misrecognition') },
    { id: 4, run_id: 'run', profile_name: 'profile', scenario_id: 'repair-b', trace: trace('repair_misrecognition') },
  ];

  const report = buildPairSpecificityReport(rows, scenarios, { runIds: ['run'] });
  const profile = report.profiles[0];

  assert.equal(profile.scenarioExactMatchedN, 4);
  assert.equal(profile.pairSpecificityN, 1);
  assert.equal(profile.divergentActionPairN, 1);
  assert.equal(profile.sameStateCompatibleN, 1);
  assert.equal(profile.falsePositiveDivergenceN, 0);
});

test('buildPairSpecificityReport catches same-action collapse on divergent hidden-state pairs', () => {
  const scenarios = new Map([
    [
      'missing',
      {
        id: 'missing',
        pair_id: 'ambiguous',
        pair_variant: 'missing',
        pair_expectation: 'divergent_action',
        expected_adaptation_action: 'minimal_hint',
      },
    ],
    [
      'objection',
      {
        id: 'objection',
        pair_id: 'ambiguous',
        pair_variant: 'objection',
        pair_expectation: 'divergent_action',
        expected_adaptation_action: 'name_the_disagreement',
      },
    ],
  ]);
  const rows = [
    { id: 1, run_id: 'run', profile_name: 'profile', scenario_id: 'missing', trace: trace('minimal_hint') },
    { id: 2, run_id: 'run', profile_name: 'profile', scenario_id: 'objection', trace: trace('minimal_hint') },
  ];

  const report = buildPairSpecificityReport(rows, scenarios, { runIds: ['run'] });
  const profile = report.profiles[0];
  const pair = report.pairs[0];

  assert.equal(profile.scenarioExactMatchedN, 1);
  assert.equal(profile.pairSpecificityN, 0);
  assert.equal(pair.pairSpecificityMatched, false);
});
