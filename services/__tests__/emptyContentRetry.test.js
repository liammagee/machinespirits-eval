/**
 * Tests for empty-content retry logic in callLearnerAI.
 *
 * Uses node:test (built-in, no dependencies required).
 * Run: node --test services/__tests__/emptyContentRetry.test.js
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
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
  const body = {
    id: 'gen-test',
    choices: [{ message: { content }, finish_reason: finishReason }],
    usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens },
  };
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
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

  it('returns immediately on non-empty response', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      return mockOpenRouterResponse({ content: 'Hello learner!', outputTokens: 8 });
    };

    const result = await callLearnerAI(makeAgentConfig(), 'system', 'user', 'learner_ego');

    assert.equal(result.content, 'Hello learner!');
    assert.equal(callCount, 1);
  });

  it('retries on empty content and succeeds', async () => {
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
    // callAI handles the retry, so we should see multiple calls
    assert.ok(callCount > 1);
  });

  it('skips retry when finishReason is length', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      return mockOpenRouterResponse({ content: '', outputTokens: 0, finishReason: 'length' });
    };

    const result = await callLearnerAI(makeAgentConfig(), 'system', 'user', 'learner_ego');

    assert.equal(result.content, '');
    assert.equal(callCount, 1);
  });

  it.skip('handles exceptions gracefully by returning empty (preserved behavior)', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      if (callCount === 1) {
        return mockOpenRouterResponse({ content: '', outputTokens: 0 });
      }
      throw new Error('Network failure on retry');
    };

    const result = await callLearnerAI(makeAgentConfig(), 'system', 'user', 'learner_ego');

    // callAI will swallow the retry exception if it already has a (successful but empty) result
    assert.equal(result.content, '');
    assert.ok(callCount > 1);
  });
});
