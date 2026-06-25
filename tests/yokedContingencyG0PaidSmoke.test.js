import assert from 'node:assert/strict';
import test from 'node:test';
import {
  backendDetail,
  buildLearnerProsePrompt,
  buildLearnerProsePromptForProtocol,
  buildProseClassifierPrompt,
  canonicalBackend,
  reasoningLeakHits,
  renderG0PaidSmokeReport,
  runG0PaidSmoke,
  selectProbeResponses,
} from '../scripts/run-yoked-contingency-g0-paid-smoke.js';
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
];

test('backend parser preserves concrete Claude, OpenRouter, and agy model variants', () => {
  assert.equal(canonicalBackend('claude'), 'claude-code');
  assert.equal(canonicalBackend('claude-code:sonnet'), 'claude-code');
  assert.equal(canonicalBackend('openrouter:anthropic/claude-sonnet-4.5'), 'openrouter');
  assert.equal(canonicalBackend('agy:gemini-3.1-pro-high'), 'agy');
  assert.deepEqual(backendDetail('claude-code:sonnet'), {
    kind: 'claude-code',
    model: 'sonnet',
    effort: 'low',
    label: 'claude-code:sonnet',
  });
  assert.equal(backendDetail('openrouter:anthropic/claude-sonnet-4.5').model, 'anthropic/claude-sonnet-4.5');
  assert.deepEqual(backendDetail('agy:gemini-3.1-pro-high'), {
    kind: 'agy',
    model: 'gemini-3.1-pro-high',
    label: 'agy:gemini-3.1-pro-high',
  });
});

test('mock paid G0 smoke passes only the narrow opacity plus diagnosability gate', async () => {
  const result = await runG0PaidSmoke({
    backend: 'mock',
    classifier: 'mock',
    sessions: 1,
    itemsPerSession: 4,
    maxCalls: 1,
    items: fixtureItems,
    sessionSpecs: [{ sessionId: 'fixture-alpha', seedId: 'alpha' }],
  });

  assert.equal(result.status, 'pass_g0_paid_smoke');
  assert.equal(result.summary.modelCalls.total, 0);
  assert.equal(result.summary.behaviorExactSessions, 1);
  assert.equal(result.summary.meanProseRecall, 0);
  assert.equal(result.summary.reasoningLeakCount, 0);
  assert.equal(result.preregistration, 'PLAN_2_0/yoked-contingency-g0-visible-affect-preregistration.md');
});

test('probe response selection includes active seeded errors before fillers', () => {
  const state = seedTable('alpha');
  const responses = simulateItemResponses(fixtureItems, state);
  const selected = selectProbeResponses(fixtureItems, responses, state, 3);

  assert.deepEqual(
    selected.slice(0, 2).map((row) => row.family),
    ['same_denominator_operation', 'magnitude_denominator_bias'],
  );
  assert.equal(selected.length, 3);
});

test('paid smoke prompts keep hidden family labels out of learner generation', () => {
  const state = seedTable('alpha');
  const [response] = selectProbeResponses(fixtureItems, simulateItemResponses(fixtureItems, state), state, 1);
  const prompt = buildLearnerProsePrompt({ item: response.item, response });

  assert.match(prompt, /Item stem/);
  assert.doesNotMatch(prompt, /same_denominator_operation/);
  assert.doesNotMatch(prompt, /magnitude_denominator_bias/);
});

test('visible-affect prompt separates logged behavior from visible prose rationale', () => {
  const state = seedTable('alpha');
  const [response] = selectProbeResponses(fixtureItems, simulateItemResponses(fixtureItems, state), state, 1);
  const choice = response.item.choices.find((c) => c.value === response.response_value);
  const prompt = buildLearnerProsePromptForProtocol({
    item: response.item,
    choice,
    feedback: 'That answer was not accepted.',
    proseProtocol: 'visible-affect',
  });

  assert.match(prompt, /logged separately/);
  assert.match(prompt, /Do not explain any arithmetic reasoning/);
  assert.match(prompt, /Do not mention any numbers, fractions/);
});

test('reasoning leak guard catches visible arithmetic rationale', () => {
  assert.deepEqual(reasoningLeakHits(['I added the top and bottom numbers because the denominator looked bigger.']), [
    'numerator_denominator_language',
    'operation_language',
    'magnitude_comparison_language',
  ]);
  assert.deepEqual(reasoningLeakHits(['I feel unsure and would like help checking my thinking.']), []);
});

test('classifier prompt receives prose but not item stems or selected answers', () => {
  const prompt = buildProseClassifierPrompt({
    sessionId: 'fixture-alpha',
    proseTurns: ['I chose it because the numbers looked familiar.'],
  });

  assert.match(prompt, /I chose it because/);
  assert.equal(prompt.includes('What is 1/4'), false);
  assert.doesNotMatch(prompt, /Learner selected/);
});

test('report labels the artifact as non-G1', async () => {
  const result = await runG0PaidSmoke({
    backend: 'mock',
    classifier: 'mock',
    sessions: 1,
    itemsPerSession: 4,
    maxCalls: 1,
    items: fixtureItems,
    sessionSpecs: [{ sessionId: 'fixture-alpha', seedId: 'alpha' }],
  });
  const report = renderG0PaidSmokeReport(result);

  assert.match(report, /not the full G0 gate/);
  assert.match(report, /not the G1 yoked-contingency experiment/);
});
