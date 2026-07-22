import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateSuggestion, normalizeJudgeLabel } from '../rubricEvaluator.js';

const suggestion = { title: 'Suggestion', message: 'A grounded tutor response.' };
const scenario = {
  name: 'Scenario',
  description: 'Test fallback provenance.',
  expectedBehavior: 'Respond helpfully.',
  learnerContext: 'Learner context.',
  requiredElements: [],
  forbiddenElements: [],
};
const overrides = {
  judgeOverride: {
    model: 'lmstudio.qwen3.5-9b',
    hyperparameters: { temperature: 0.2, max_tokens: 8000 },
  },
};
const validScore = JSON.stringify({
  scores: { perception_quality: { score: 3, reasoning: 'Adequate perception.' } },
  validation: {
    passes_required: true,
    required_missing: [],
    passes_forbidden: true,
    forbidden_found: [],
  },
  overall_score: 50,
  summary: 'Fallback score.',
});

function installFetchStub(t, contentForCall) {
  const originalFetch = globalThis.fetch;
  const originalOpenRouterKey = process.env.OPENROUTER_API_KEY;
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalOpenRouterKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalOpenRouterKey;
  });

  process.env.OPENROUTER_API_KEY = 'test-key';
  const calledModels = [];
  globalThis.fetch = async (_url, options = {}) => {
    const body = JSON.parse(options.body);
    calledModels.push(body.model);
    const content = contentForCall({ call: calledModels.length, model: body.model });
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return calledModels;
}

test('evaluateSuggestion attributes a successful fallback score to the fallback judge', async (t) => {
  const calledModels = installFetchStub(t, ({ model }) => (model === 'qwen3.5-9b' ? '' : validScore));
  const result = await evaluateSuggestion(suggestion, scenario, {}, overrides);

  assert.equal(result.success, true);
  assert.equal(calledModels[0], 'qwen3.5-9b');
  assert.equal(calledModels.length, 2);
  assert.equal(result.judgeModel, normalizeJudgeLabel('openrouter', calledModels[1]));
  assert.notEqual(result.judgeModel, normalizeJudgeLabel('lmstudio', calledModels[0]));
});

test('evaluateSuggestion attributes parse-error recovery to the fallback judge', async (t) => {
  const calledModels = installFetchStub(t, ({ model }) => (model === 'qwen3.5-9b' ? 'not valid JSON' : validScore));
  const result = await evaluateSuggestion(suggestion, scenario, {}, overrides);

  assert.equal(result.success, true);
  assert.equal(calledModels.length, 2);
  assert.equal(result.judgeModel, normalizeJudgeLabel('openrouter', calledModels[1]));
});

test('evaluateSuggestion attributes fallback parse failure to the fallback judge', async (t) => {
  const calledModels = installFetchStub(t, () => 'not valid JSON');
  const result = await evaluateSuggestion(suggestion, scenario, {}, overrides);

  assert.equal(result.success, false);
  assert.equal(calledModels.length, 3);
  assert.equal(result.judgeModel, normalizeJudgeLabel('openrouter', calledModels.at(-1)));
});
