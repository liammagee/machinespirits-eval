/**
 * Tests for promptRecommendationService.
 *
 * Pure functions (analyzeResults, formatRecommendations) are tested directly.
 * generateRecommendations() is exercised with a mocked fetch + a temporary
 * rubric YAML pointing at the openrouter recommender path. The anthropic SDK
 * path is not exercised — it requires the optional @anthropic-ai/sdk peer
 * dependency, which we treat as out of scope.
 *
 * Run: node --test services/__tests__/promptRecommendationService.test.js
 */

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as evalConfigLoader from '../evalConfigLoader.js';
import { generateRecommendations, formatRecommendations } from '../promptRecommendationService.js';
import promptRecommendationDefault from '../promptRecommendationService.js';

const { analyzeResults } = promptRecommendationDefault;

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeResult(overrides = {}) {
  return {
    success: true,
    scenarioId: 'scen_a',
    scenarioName: 'Scenario A',
    tutorFirstTurnScore: 80,
    passesRequired: true,
    passesForbidden: true,
    requiredMissing: [],
    forbiddenFound: [],
    suggestions: [{ title: 'Try this', message: 'A nice message' }],
    scores: { relevance: 4, specificity: 4 },
    evaluationReasoning: 'Looks good',
    ...overrides,
  };
}

function writeTempRubric(extraConfig = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rubric-test-'));
  const rubricPath = path.join(tmpDir, 'evaluation-rubric.yaml');
  const recommender = extraConfig.recommender ?? {
    model: 'openrouter.test-model',
    hyperparameters: { temperature: 0.4, max_tokens: 1000 },
  };
  fs.writeFileSync(
    rubricPath,
    `version: "test"\nrecommender:\n  model: "${recommender.model}"\n  hyperparameters:\n    temperature: ${recommender.hyperparameters.temperature}\n    max_tokens: ${recommender.hyperparameters.max_tokens}\n`,
  );
  return { rubricPath, tmpDir };
}

function mockOpenRouterResponse({ content = 'Recommendation text', inputTokens = 50, outputTokens = 200 } = {}) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: async () => ({
      model: 'openrouter/test-model',
      choices: [{ message: { content } }],
      usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens },
    }),
    text: async () => '',
  };
}

// ---------------------------------------------------------------------------
// analyzeResults — pure
// ---------------------------------------------------------------------------

describe('analyzeResults', () => {
  it('returns zero counts and 0 avg for empty input', () => {
    const a = analyzeResults([]);
    assert.equal(a.totalResults, 0);
    assert.equal(a.successCount, 0);
    assert.equal(a.failureCount, 0);
    assert.equal(a.avgScore, 0);
    assert.deepEqual(a.lowScoreResults, []);
    assert.deepEqual(a.validationFailures, []);
    assert.deepEqual(a.dimensionWeaknesses, {});
  });

  it('counts success vs failure rows', () => {
    const a = analyzeResults([
      makeResult({ success: true }),
      makeResult({ success: false }),
      makeResult({ success: true }),
    ]);
    assert.equal(a.totalResults, 3);
    assert.equal(a.successCount, 2);
    assert.equal(a.failureCount, 1);
  });

  it('computes avgScore from tutorFirstTurnScore and ignores nulls', () => {
    const a = analyzeResults([
      makeResult({ tutorFirstTurnScore: 90 }),
      makeResult({ tutorFirstTurnScore: 70 }),
      makeResult({ tutorFirstTurnScore: null }),
    ]);
    assert.equal(a.avgScore, 80);
  });

  it('includes only rows with score < 70 in lowScoreResults', () => {
    const a = analyzeResults([
      makeResult({ scenarioId: 'high', tutorFirstTurnScore: 95 }),
      makeResult({ scenarioId: 'low1', tutorFirstTurnScore: 60 }),
      makeResult({ scenarioId: 'low2', tutorFirstTurnScore: 50 }),
      makeResult({ scenarioId: 'edge', tutorFirstTurnScore: 70 }),
    ]);
    const ids = a.lowScoreResults.map((r) => r.scenarioId);
    assert.deepEqual(ids.sort(), ['low1', 'low2']);
  });

  it('caps lowScoreResults at 10 entries', () => {
    const results = Array.from({ length: 15 }, (_, i) =>
      makeResult({ scenarioId: `low_${i}`, tutorFirstTurnScore: 40 + i }),
    );
    const a = analyzeResults(results);
    assert.equal(a.lowScoreResults.length, 10);
  });

  it('captures validation failures with their missing/forbidden lists', () => {
    const a = analyzeResults([
      makeResult({ scenarioId: 'ok' }),
      makeResult({
        scenarioId: 'bad_required',
        passesRequired: false,
        requiredMissing: ['must_say_x'],
      }),
      makeResult({
        scenarioId: 'bad_forbidden',
        passesForbidden: false,
        forbiddenFound: ['said_y'],
      }),
    ]);
    const ids = a.validationFailures.map((f) => f.scenarioId).sort();
    assert.deepEqual(ids, ['bad_forbidden', 'bad_required']);
    const requiredFailure = a.validationFailures.find((f) => f.scenarioId === 'bad_required');
    assert.deepEqual(requiredFailure.requiredMissing, ['must_say_x']);
  });

  it('flags dimensions with avg score < 3.5 as weak (and ignores null per-dim scores)', () => {
    const a = analyzeResults([
      makeResult({ scores: { relevance: 4, specificity: 2, tone: null } }),
      makeResult({ scores: { relevance: 5, specificity: 3 } }),
      makeResult({ scores: { relevance: 4, specificity: 3 } }),
    ]);
    // relevance avg = 4.33 -> not weak. specificity avg = 2.67 -> weak.
    assert.ok(!('relevance' in a.dimensionWeaknesses));
    assert.ok('specificity' in a.dimensionWeaknesses);
    assert.ok(Math.abs(a.dimensionWeaknesses.specificity.avgScore - 2.6667) < 0.01);
    assert.equal(a.dimensionWeaknesses.specificity.sampleCount, 3);
    // tone has only nulls -> not present
    assert.ok(!('tone' in a.dimensionWeaknesses));
  });
});

// ---------------------------------------------------------------------------
// formatRecommendations — pure
// ---------------------------------------------------------------------------

describe('formatRecommendations', () => {
  it('returns the short success message when needsImprovement is false', () => {
    const out = formatRecommendations({
      needsImprovement: false,
      message: 'All good',
    });
    assert.match(out, /All good/);
    assert.match(out, /PROMPT IMPROVEMENT RECOMMENDATIONS/);
    // Should not mention dimensions or recommender
    assert.equal(out.includes('Recommender:'), false);
  });

  it('renders the analysis summary, weak dimensions, and recommendation text', () => {
    const out = formatRecommendations({
      needsImprovement: true,
      analysis: {
        totalResults: 12,
        avgScore: 65.4,
        validationFailures: [{ scenarioId: 'x' }, { scenarioId: 'y' }],
        dimensionWeaknesses: { specificity: { avgScore: 2.7 } },
      },
      recommendations: 'Add more concrete examples',
      recommenderModel: 'openrouter/test',
      usage: { inputTokens: 123, outputTokens: 456 },
    });
    assert.match(out, /Total tests analyzed: 12/);
    assert.match(out, /Average score: 65\.4\/100/);
    assert.match(out, /Validation failures: 2/);
    assert.match(out, /specificity: 2\.70\/5/);
    assert.match(out, /Add more concrete examples/);
    assert.match(out, /Recommender: openrouter\/test/);
    assert.match(out, /Tokens: 123 in \/ 456 out/);
  });
});

// ---------------------------------------------------------------------------
// generateRecommendations — async, with mocked fetch
// ---------------------------------------------------------------------------

describe('generateRecommendations', () => {
  let originalFetch;
  let originalKey;
  let tmpRubric;

  before(() => {
    tmpRubric = writeTempRubric();
    evalConfigLoader.setRubricPathOverride(tmpRubric.rubricPath);
  });

  after(() => {
    evalConfigLoader.clearRubricPathOverride();
    fs.rmSync(tmpRubric.tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = 'test-key';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalKey;
  });

  it('throws when called with no results', async () => {
    await assert.rejects(() => generateRecommendations({ results: [] }), /No evaluation results/);
  });

  it('returns needsImprovement=false (no API call) when avgScore > 90 and no validation failures', async () => {
    let fetched = 0;
    globalThis.fetch = async () => {
      fetched++;
      return mockOpenRouterResponse();
    };
    const results = [
      makeResult({ tutorFirstTurnScore: 95 }),
      makeResult({ tutorFirstTurnScore: 96 }),
    ];
    const out = await generateRecommendations({
      results,
      profileName: 'cell_5',
      egoPromptFile: 'tutor-ego-placebo.md',
      superegoPromptFile: 'tutor-superego-placebo.md',
    });
    assert.equal(out.needsImprovement, false);
    assert.equal(fetched, 0);
    assert.match(out.message, /performing well/);
  });

  it('calls OpenRouter and returns recommendations when scores are weak', async () => {
    let captured;
    globalThis.fetch = async (url, init) => {
      captured = { url, init };
      return mockOpenRouterResponse({ content: '## Issues\nNeeds calibration', inputTokens: 200, outputTokens: 300 });
    };
    const results = [
      makeResult({ tutorFirstTurnScore: 50, scores: { specificity: 2 } }),
      makeResult({ tutorFirstTurnScore: 45, scores: { specificity: 2 } }),
    ];
    const out = await generateRecommendations({
      results,
      profileName: 'cell_1',
      // Use prompts that actually exist in this repo's prompts/ dir
      egoPromptFile: 'tutor-ego-placebo.md',
      superegoPromptFile: 'tutor-superego-placebo.md',
    });
    assert.equal(out.needsImprovement, true);
    assert.equal(out.recommendations, '## Issues\nNeeds calibration');
    assert.equal(out.usage.inputTokens, 200);
    assert.equal(out.usage.outputTokens, 300);
    // Verify the request shape
    assert.equal(captured.url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(captured.init.method, 'POST');
    assert.match(captured.init.headers.Authorization, /^Bearer test-key$/);
    const body = JSON.parse(captured.init.body);
    // resolveModel() strips the "openrouter." prefix and uses the alias as the model id
    assert.equal(body.model, 'test-model');
    assert.equal(body.temperature, 0.4);
    assert.equal(body.max_tokens, 1000);
    assert.match(body.messages[0].content, /cell_1/);
  });

  it('includes validation failures in the analysis prompt sent to the recommender', async () => {
    let body;
    globalThis.fetch = async (_url, init) => {
      body = JSON.parse(init.body);
      return mockOpenRouterResponse({ content: 'fix it' });
    };
    const results = [
      makeResult({
        scenarioId: 'fail_one',
        scenarioName: 'Failure case',
        tutorFirstTurnScore: 50,
        passesRequired: false,
        requiredMissing: ['must_mention_topic'],
      }),
    ];
    await generateRecommendations({
      results,
      profileName: 'cell_1',
      egoPromptFile: 'tutor-ego-placebo.md',
      superegoPromptFile: 'tutor-superego-placebo.md',
    });
    const prompt = body.messages[0].content;
    assert.match(prompt, /Validation Failures/);
    assert.match(prompt, /must_mention_topic/);
    assert.match(prompt, /Failure case/);
  });

  it('throws when neither prompt file exists', async () => {
    const results = [makeResult({ tutorFirstTurnScore: 50 })];
    await assert.rejects(
      () =>
        generateRecommendations({
          results,
          egoPromptFile: '__does_not_exist_ego.md',
          superegoPromptFile: '__does_not_exist_superego.md',
        }),
      /Could not read any prompt files/,
    );
  });

  it('surfaces OpenRouter HTTP errors from the recommender call', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
      text: async () => 'upstream blew up',
    });
    const results = [makeResult({ tutorFirstTurnScore: 40 })];
    await assert.rejects(
      () =>
        generateRecommendations({
          results,
          profileName: 'cell_1',
          egoPromptFile: 'tutor-ego-placebo.md',
          superegoPromptFile: 'tutor-superego-placebo.md',
        }),
      /OpenRouter error: 500/,
    );
  });

  it('throws a clear error when OPENROUTER_API_KEY is unset', async () => {
    delete process.env.OPENROUTER_API_KEY;
    const results = [makeResult({ tutorFirstTurnScore: 40 })];
    await assert.rejects(
      () =>
        generateRecommendations({
          results,
          profileName: 'cell_1',
          egoPromptFile: 'tutor-ego-placebo.md',
          superegoPromptFile: 'tutor-superego-placebo.md',
        }),
      /OPENROUTER_API_KEY not set/,
    );
  });
});
