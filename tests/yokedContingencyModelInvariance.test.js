import assert from 'node:assert/strict';
import test from 'node:test';
import { runG1PaidSmoke } from '../scripts/run-yoked-contingency-g1-paid-smoke.js';
import {
  classifyG2Boundary,
  renderModelInvarianceReport,
  runModelInvarianceMatrix,
  slugify,
} from '../scripts/run-yoked-contingency-model-invariance.js';

const fixtureItems = [
  {
    id: 'i-add',
    form: 'A',
    family: 'same_denominator_operation',
    stem: 'What is 1/4 + 2/4?',
    correct: 'b',
    choices: [
      { value: 'a', label: '2/8' },
      { value: 'b', label: '3/4' },
    ],
  },
  {
    id: 'i-mag',
    form: 'A',
    family: 'magnitude_denominator_bias',
    stem: 'Which fraction is larger?',
    correct: 'b',
    choices: [
      { value: 'a', label: '1/4' },
      { value: 'b', label: '1/3' },
    ],
  },
  {
    id: 'i-scale',
    form: 'A',
    family: 'equivalence_scaling',
    stem: 'Which is equivalent to 1/2?',
    correct: 'b',
    choices: [
      { value: 'a', label: '1/4' },
      { value: 'b', label: '2/4' },
    ],
  },
  {
    id: 'i-qty',
    form: 'A',
    family: 'fraction_of_quantity',
    stem: 'What is 1/3 of 12?',
    correct: 'b',
    choices: [
      { value: 'a', label: '3' },
      { value: 'b', label: '4' },
    ],
  },
  {
    id: 'i-add-post',
    form: 'B',
    family: 'same_denominator_operation',
    stem: 'What is 2/7 + 3/7?',
    correct: 'b',
    choices: [
      { value: 'a', label: '5/14' },
      { value: 'b', label: '5/7' },
    ],
  },
  {
    id: 'i-mag-post',
    form: 'B',
    family: 'magnitude_denominator_bias',
    stem: 'Which fraction is larger?',
    correct: 'b',
    choices: [
      { value: 'a', label: '1/5' },
      { value: 'b', label: '1/2' },
    ],
  },
  {
    id: 'i-scale-post',
    form: 'B',
    family: 'equivalence_scaling',
    stem: 'Which is equivalent to 2/3?',
    correct: 'b',
    choices: [
      { value: 'a', label: '2/6' },
      { value: 'b', label: '4/6' },
    ],
  },
  {
    id: 'i-qty-post',
    form: 'B',
    family: 'fraction_of_quantity',
    stem: 'What is 1/4 of 20?',
    correct: 'b',
    choices: [
      { value: 'a', label: '4' },
      { value: 'b', label: '5' },
    ],
  },
];

test('model-invariance matrix keeps frozen G1 and regenerated planner rows', async () => {
  const g1 = await runG1PaidSmoke({
    backend: 'mock',
    sessions: 1,
    maxCalls: 1,
    items: fixtureItems,
    sessionSpecs: [
      { sessionId: 'fixture-alpha', targetSeed: 'alpha', sameSeedSource: 'alpha', differentSeedSource: 'beta' },
    ],
  });
  const result = await runModelInvarianceMatrix({
    g1Json: g1,
    learnerBackends: ['mock'],
    plannerBackends: ['mock'],
    learnerProtocol: 'rule-transfer-novice',
    posttestProfile: 'hard-transfer',
    sessionLimit: 1,
    maxCallsPerRun: 1,
    maxPlanCalls: 1,
    write: false,
    items: fixtureItems,
  });

  assert.equal(result.status, 'pass_model_invariance_matrix');
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.rows.map((row) => row.planKind).sort(), ['frozen', 'regenerated']);
  assert.ok(result.rows.every((row) => row.summary.boundaryClass === 'supports_invariance_endpoint'));

  const report = renderModelInvarianceReport(result);
  assert.match(report, /Five-step protocol/);
  assert.match(report, /same-state > different-state/);
});

test('model-invariance helpers classify boundary evidence and stable slugs', () => {
  assert.equal(slugify('openrouter:anthropic/claude-sonnet-4.5'), 'openrouter-anthropic-claude-sonnet-4-5');
  assert.equal(
    classifyG2Boundary({
      thresholds: { requiredSameGreaterSessionCount: 1, scaledSignTestPMax: null },
      summary: {
        invalidAnswerCount: 0,
        promptFamilyLabelLeakCount: 0,
        delta2_diagnosis: -0.1,
        sameGreaterSessionCount: 0,
      },
    }),
    'boundary_same_state_not_above_different_state',
  );
});
