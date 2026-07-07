import assert from 'node:assert/strict';
import test from 'node:test';
import {
  estimateStateFromBehavior,
  estimateStateFromProse,
  renderYokedContingencyReport,
  runYokedContingencyExperiment,
  seedTable,
  simulateItemResponses,
} from '../scripts/run-yoked-contingency-smoke.js';

const fixtureItems = [
  {
    id: 'i-add',
    form: 'A',
    family: 'same_denominator_operation',
    correct: 'b',
    choices: [
      { value: 'a', label: 'wrong' },
      { value: 'b', label: 'right' },
    ],
  },
  {
    id: 'i-mag',
    form: 'A',
    family: 'magnitude_denominator_bias',
    correct: 'b',
    choices: [
      { value: 'a', label: 'wrong' },
      { value: 'b', label: 'right' },
    ],
  },
  {
    id: 'i-scale',
    form: 'A',
    family: 'equivalence_scaling',
    correct: 'b',
    choices: [
      { value: 'a', label: 'wrong' },
      { value: 'b', label: 'right' },
    ],
  },
];

test('mock G0 separates non-leaking prose from diagnosable item behavior', () => {
  const learnerState = seedTable('alpha');
  const responses = simulateItemResponses(fixtureItems, learnerState);
  const behavior = estimateStateFromBehavior(responses);
  const prose = estimateStateFromProse(['I am not sure why this one feels different.']);

  assert.deepEqual(
    behavior.filter((row) => row.predictedActive).map((row) => row.family),
    ['magnitude_denominator_bias', 'same_denominator_operation'],
  );
  assert.equal(
    prose.some((row) => row.predictedActive),
    false,
  );
});

test('yoked contingency smoke separates responsiveness and diagnosis terms', () => {
  const result = runYokedContingencyExperiment();
  const arms = Object.fromEntries(result.arms.map((arm) => [arm.arm, arm]));

  assert.equal(result.reads.g0, 'mock_pass_opacity_plus_diagnosability');
  assert.ok(arms.contingent.gain > arms.same_seed_yoked.gain);
  assert.ok(arms.same_seed_yoked.gain > arms.different_seed_yoked.gain);
  assert.ok(result.contrasts.delta1_responsiveness > 0);
  assert.ok(result.contrasts.delta2_diagnosis > 0);
});

test('yoked contingency report keeps primary outcome programmatic', () => {
  const report = renderYokedContingencyReport(runYokedContingencyExperiment());

  assert.match(report, /Outcome validity/);
  assert.match(report, /not from an LLM judge/);
  assert.match(report, /Δ2 diagnosis/);
});
