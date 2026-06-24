import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildHeldOutLearnerPrompt,
  buildLearnerPretestView,
  hiddenFamilyLabelLeaks,
  loadG2Items,
  renderG2IndependentOutcomeReport,
  runG2IndependentOutcome,
  sanitizeIntervention,
} from '../scripts/run-yoked-contingency-g2-independent-outcome.js';
import { runG1PaidSmoke } from '../scripts/run-yoked-contingency-g1-paid-smoke.js';

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

test('held-out learner prompt hides seed, arm, family labels, and posttest answer keys', async () => {
  const g1 = await runG1PaidSmoke({
    backend: 'mock',
    sessions: 1,
    maxCalls: 1,
    items: fixtureItems,
    sessionSpecs: [
      { sessionId: 'fixture-alpha', targetSeed: 'alpha', sameSeedSource: 'alpha', differentSeedSource: 'beta' },
    ],
  });
  const session = g1.sessions[0];
  const preItems = fixtureItems.filter((item) => item.form === 'A');
  const postItems = fixtureItems.filter((item) => item.form === 'B');
  const pretestView = buildLearnerPretestView({ targetSeed: session.targetSeed, items: preItems });
  const prompt = buildHeldOutLearnerPrompt({
    session,
    arm: session.arms[0],
    pretestView,
    postItems,
    learnerProtocol: 'standard',
  });

  assert.deepEqual(hiddenFamilyLabelLeaks(prompt), []);
  assert.equal(prompt.includes('targetFamily'), false);
  assert.equal(prompt.includes('same_seed_yoked'), false);
  assert.equal(prompt.includes('targetSeed'), false);
  assert.equal(prompt.includes('Correct:'), false);
});

test('calibrated-novice prompt explicitly prevents expert ceiling behavior', async () => {
  const g1 = await runG1PaidSmoke({
    backend: 'mock',
    sessions: 1,
    maxCalls: 1,
    items: fixtureItems,
    sessionSpecs: [
      { sessionId: 'fixture-alpha', targetSeed: 'alpha', sameSeedSource: 'alpha', differentSeedSource: 'beta' },
    ],
  });
  const session = g1.sessions[0];
  const preItems = fixtureItems.filter((item) => item.form === 'A');
  const postItems = fixtureItems.filter((item) => item.form === 'B');
  const pretestView = buildLearnerPretestView({ targetSeed: session.targetSeed, items: preItems });
  const prompt = buildHeldOutLearnerPrompt({
    session,
    arm: session.arms[0],
    pretestView,
    postItems,
    learnerProtocol: 'calibrated-novice',
  });

  assert.match(prompt, /Do not solve from your own mathematical competence/);
  assert.match(prompt, /Treat rejected pretest answers as evidence/);
  assert.deepEqual(hiddenFamilyLabelLeaks(prompt), []);
});

test('rule-transfer novice prompt requires applying inferred novice rules', async () => {
  const g1 = await runG1PaidSmoke({
    backend: 'mock',
    sessions: 1,
    maxCalls: 1,
    items: fixtureItems,
    sessionSpecs: [
      { sessionId: 'fixture-alpha', targetSeed: 'alpha', sameSeedSource: 'alpha', differentSeedSource: 'beta' },
    ],
  });
  const session = g1.sessions[0];
  const items = loadG2Items({ posttestProfile: 'hard-transfer' });
  const pretestView = buildLearnerPretestView({
    targetSeed: session.targetSeed,
    items: items.filter((item) => item.form === 'A'),
  });
  const prompt = buildHeldOutLearnerPrompt({
    session,
    arm: session.arms[0],
    pretestView,
    postItems: items.filter((item) => item.form === 'B'),
    learnerProtocol: 'rule-transfer-novice',
  });

  assert.match(prompt, /infer the learner's local novice rule/);
  assert.match(prompt, /choose the matching distractor/);
  assert.deepEqual(hiddenFamilyLabelLeaks(prompt), []);
});

test('hard-transfer profile replaces the held-out posttest with targeted transfer items', () => {
  const items = loadG2Items({ posttestProfile: 'hard-transfer' });
  const preItems = items.filter((item) => item.form === 'A');
  const postItems = items.filter((item) => item.form === 'B');

  assert.ok(preItems.some((item) => item.id === 'fr-a-001'));
  assert.equal(postItems.length, 10);
  assert.deepEqual(
    [...new Set(postItems.map((item) => item.family))].sort(),
    [
      'equivalence_scaling',
      'fraction_of_quantity',
      'magnitude_denominator_bias',
      'part_whole_mapping',
      'same_denominator_operation',
    ].sort(),
  );
  assert.ok(postItems.every((item) => item.id.startsWith('ht-b-')));
});

test('hard-transfer learner prompt uses hard items without answer keys or family labels', async () => {
  const g1 = await runG1PaidSmoke({
    backend: 'mock',
    sessions: 1,
    maxCalls: 1,
    items: fixtureItems,
    sessionSpecs: [
      { sessionId: 'fixture-alpha', targetSeed: 'alpha', sameSeedSource: 'alpha', differentSeedSource: 'beta' },
    ],
  });
  const session = g1.sessions[0];
  const items = loadG2Items({ posttestProfile: 'hard-transfer' });
  const pretestView = buildLearnerPretestView({
    targetSeed: session.targetSeed,
    items: items.filter((item) => item.form === 'A'),
  });
  const postItems = items.filter((item) => item.form === 'B');
  const prompt = buildHeldOutLearnerPrompt({
    session,
    arm: session.arms[0],
    pretestView,
    postItems,
    learnerProtocol: 'calibrated-novice',
  });

  assert.match(prompt, /ht-b-001/);
  assert.match(prompt, /A runner finishes/);
  assert.deepEqual(hiddenFamilyLabelLeaks(prompt), []);
  assert.equal(prompt.includes('Correct:'), false);
  assert.equal(prompt.includes('correct_value'), false);
});

test('intervention sanitizer removes exact hidden family identifiers only', () => {
  assert.equal(
    sanitizeIntervention('Target same_denominator_operation using same-denominator examples.'),
    'Target the relevant idea using same-denominator examples.',
  );
});

test('mock G2 scores independent held-out answers and separates yoking', async () => {
  const g1 = await runG1PaidSmoke({
    backend: 'mock',
    sessions: 1,
    maxCalls: 1,
    items: fixtureItems,
    sessionSpecs: [
      { sessionId: 'fixture-alpha', targetSeed: 'alpha', sameSeedSource: 'alpha', differentSeedSource: 'beta' },
    ],
  });
  const result = await runG2IndependentOutcome({
    g1Json: g1,
    backend: 'mock',
    learnerProtocol: 'calibrated-novice',
    posttestProfile: 'hard-transfer',
    maxCalls: 1,
  });

  assert.equal(result.status, 'pass_g2_independent_outcome');
  assert.equal(result.posttestProfile, 'hard-transfer');
  assert.equal(result.summary.modelCalls.total, 0);
  assert.ok(result.summary.delta2_diagnosis > 0);
  assert.equal(result.summary.invalidAnswerCount, 0);
  assert.equal(result.summary.promptFamilyLabelLeakCount, 0);
});

test('G2 report states independent learner-outcome boundary', async () => {
  const g1 = await runG1PaidSmoke({
    backend: 'mock',
    sessions: 1,
    maxCalls: 1,
    items: fixtureItems,
    sessionSpecs: [
      { sessionId: 'fixture-alpha', targetSeed: 'alpha', sameSeedSource: 'alpha', differentSeedSource: 'beta' },
    ],
  });
  const result = await runG2IndependentOutcome({
    g1Json: g1,
    backend: 'mock',
    learnerProtocol: 'calibrated-novice',
    maxCalls: 1,
    items: fixtureItems,
  });
  const report = renderG2IndependentOutcomeReport(result);

  assert.match(report, /independent learner-outcome/);
  assert.match(report, /Δ2 diagnosis/);
  assert.match(report, /Invalid posttest answers/);
});
