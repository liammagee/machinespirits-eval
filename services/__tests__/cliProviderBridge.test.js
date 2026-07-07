import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  callAIWithCliBridge,
  cliAwareProviderConfig,
  isCliProvider,
  isProviderConfigured,
} from '../cliProviderBridge.js';

describe('cliProviderBridge', () => {
  it('recognizes repo-local CLI providers', () => {
    assert.equal(isCliProvider('claude-code'), true);
    assert.equal(isCliProvider('codex'), true);
    assert.equal(isCliProvider('openrouter'), false);
  });

  it('marks CLI providers configured without API keys', () => {
    assert.equal(isProviderConfigured('claude-code', { isConfigured: false }), true);
    assert.equal(isProviderConfigured('codex', { isConfigured: false }), true);
    assert.equal(isProviderConfigured('openai', { isConfigured: false }), false);
    assert.deepEqual(cliAwareProviderConfig('codex', { isConfigured: false, apiKey: 'secret' }), {
      isConfigured: true,
      apiKey: '',
    });
  });

  it('delegates non-CLI providers to the supplied fallback caller', async () => {
    const calls = [];
    const raw = await callAIWithCliBridge({ provider: 'openai', model: 'gpt-test' }, 'system', 'user', 'learner', {
      messageHistory: [{ role: 'user', content: 'hello' }],
      fallbackCallAI: async (...args) => {
        calls.push(args);
        return { text: 'fallback response', provider: 'openai', model: 'gpt-test' };
      },
    });

    assert.equal(raw.text, 'fallback response');
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0].provider, 'openai');
    assert.equal(calls[0][3], 'learner');
  });

  it('requires a fallback caller for non-CLI providers', async () => {
    await assert.rejects(
      () => callAIWithCliBridge({ provider: 'openai' }, 'system', 'user', 'learner'),
      /No fallback AI caller supplied/,
    );
  });
});
