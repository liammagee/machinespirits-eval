import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBehaviorLog,
  buildTutorPlanPrompt,
  renderG1PaidSmokeReport,
  runG1PaidSmoke,
} from '../scripts/run-yoked-contingency-g1-paid-smoke.js';
import { seedTable, simulateItemResponses } from '../scripts/run-yoked-contingency-smoke.js';

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

test('behavior log includes affective prose and answer evidence without family tags', () => {
  const state = seedTable('alpha');
  const preItems = fixtureItems.filter((item) => item.form === 'A');
  const responses = simulateItemResponses(preItems, state);
  const log = buildBehaviorLog({ learnerId: 'fixture', seedId: 'alpha', items: preItems, responses });

  assert.equal(log.rows.length, 4);
  assert.match(log.rows[0].visible_prose, /unsure|confident/);
  assert.equal(JSON.stringify(log).includes('same_denominator_operation'), false);
});

test('tutor-plan prompt asks for finite family labels and behavior-based inference', () => {
  const state = seedTable('alpha');
  const preItems = fixtureItems.filter((item) => item.form === 'A');
  const responses = simulateItemResponses(preItems, state);
  const log = buildBehaviorLog({ learnerId: 'fixture', seedId: 'alpha', items: preItems, responses });
  const prompt = buildTutorPlanPrompt({ sourceLog: log, planTurns: 4 });

  assert.match(prompt, /selected answers, correct answers/);
  assert.match(prompt, /target_family/);
  assert.match(prompt, /same_denominator_operation/);
  assert.doesNotMatch(prompt, /seed table/);
});

test('mock G1 separates same-seed from different-seed yoking', async () => {
  const result = await runG1PaidSmoke({
    backend: 'mock',
    sessions: 1,
    maxCalls: 1,
    items: fixtureItems,
    sessionSpecs: [
      { sessionId: 'fixture-alpha', targetSeed: 'alpha', sameSeedSource: 'alpha', differentSeedSource: 'beta' },
    ],
  });

  assert.equal(result.status, 'pass_g1_paid_smoke');
  assert.equal(result.summary.modelCalls.total, 0);
  assert.ok(result.summary.delta2_diagnosis > 0);
  assert.ok(result.summary.sameSeedActiveTargets > result.summary.differentSeedActiveTargets);
});

test('G1 report keeps outcome programmatic and names contrasts', async () => {
  const result = await runG1PaidSmoke({
    backend: 'mock',
    sessions: 1,
    maxCalls: 1,
    items: fixtureItems,
    sessionSpecs: [
      { sessionId: 'fixture-alpha', targetSeed: 'alpha', sameSeedSource: 'alpha', differentSeedSource: 'beta' },
    ],
  });
  const report = renderG1PaidSmokeReport(result);

  assert.match(report, /Δ1 responsiveness/);
  assert.match(report, /Δ2 diagnosis/);
  assert.match(report, /programmatic item outcomes/);
});
