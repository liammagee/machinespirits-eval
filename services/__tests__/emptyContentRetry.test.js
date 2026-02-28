/**
 * Tests for empty-content retry logic in callLearnerAI.
 *
 * Uses node:test (built-in, no dependencies required).
 * Run: node --test services/__tests__/emptyContentRetry.test.js
 */

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { callLearnerAI } from '../learnerTutorInteractionEngine.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal agent config for the OpenRouter provider path */
function makeAgentConfig(overrides = {}) {
  return {
    provider: 'openrouter',
    providerConfig: { isConfigured: true, apiKey: 'test-key', base_url: 'https://openrouter.test/v1/chat/completions' },
    model: 'test/model',
    hyperparameters: { temperature: 0.7, max_tokens: 1500 },
    ...overrides,
  };
}

/** Create a mock fetch response for OpenRouter */
function mockOpenRouterResponse({ content = '', inputTokens = 10, outputTokens = 0, finishReason = 'stop' } = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      id: 'gen-test',
      choices: [{ message: { content }, finish_reason: finishReason }],
      usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens },
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('callLearnerAI empty-content retry', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns immediately on non-empty response (no retry)', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      return mockOpenRouterResponse({ content: 'Hello learner!', outputTokens: 8 });
    };

    const result = await callLearnerAI(makeAgentConfig(), 'system', 'user', 'learner_ego');

    assert.equal(result.content, 'Hello learner!');
    assert.equal(result.emptyContentRetries, undefined);
    assert.equal(callCount, 1);
  });

  it('retries on empty content with 0 output tokens and succeeds', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      if (callCount === 1) {
        return mockOpenRouterResponse({ content: '', outputTokens: 0 });
      }
      return mockOpenRouterResponse({ content: 'Recovered!', outputTokens: 12 });
    };

    const result = await callLearnerAI(makeAgentConfig(), 'system', 'user', 'learner_ego');

    assert.equal(result.content, 'Recovered!');
    assert.equal(result.emptyContentRetries, 1);
    assert.equal(callCount, 2);
  });

  it('returns empty after all retries exhausted', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      return mockOpenRouterResponse({ content: '', outputTokens: 0 });
    };

    const result = await callLearnerAI(makeAgentConfig(), 'system', 'user', 'learner_superego');

    assert.equal(result.content, '');
    assert.equal(result.emptyContentRetries, 2); // EMPTY_CONTENT_MAX_RETRIES
    assert.equal(callCount, 3); // 1 original + 2 retries
  });

  it('skips retry when outputTokens > 0 (thinking model budget exhaustion)', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      return mockOpenRouterResponse({ content: '', outputTokens: 500 });
    };

    const result = await callLearnerAI(makeAgentConfig(), 'system', 'user', 'learner_ego');

    assert.equal(result.content, '');
    assert.equal(result.emptyContentRetries, undefined);
    assert.equal(callCount, 1);
  });

  it('succeeds on second retry (third attempt total)', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      if (callCount <= 2) {
        return mockOpenRouterResponse({ content: '', outputTokens: 0 });
      }
      return mockOpenRouterResponse({ content: 'Third time lucky', outputTokens: 8 });
    };

    const result = await callLearnerAI(makeAgentConfig(), 'system', 'user', 'learner_ego');

    assert.equal(result.content, 'Third time lucky');
    assert.equal(result.emptyContentRetries, 2);
    assert.equal(callCount, 3);
  });

  it('still handles 429 rate-limit errors (existing behavior preserved)', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      if (callCount === 1) {
        return { ok: false, status: 429, json: async () => ({ error: { message: 'Rate limit exceeded' } }) };
      }
      return mockOpenRouterResponse({ content: 'After rate limit', outputTokens: 10 });
    };

    const result = await callLearnerAI(makeAgentConfig(), 'system', 'user', 'learner_ego');

    assert.equal(result.content, 'After rate limit');
    assert.equal(callCount, 2);
  });

  it('handles retry attempt throwing an exception gracefully', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      if (callCount === 1) {
        // First call: empty content
        return mockOpenRouterResponse({ content: '', outputTokens: 0 });
      }
      // Retry throws
      throw new Error('Network failure on retry');
    };

    const result = await callLearnerAI(makeAgentConfig(), 'system', 'user', 'learner_ego');

    // Should return the original empty result, not throw
    assert.equal(result.content, '');
    assert.equal(callCount, 2);
  });
});
