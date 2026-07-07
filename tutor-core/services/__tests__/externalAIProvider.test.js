import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// The external-AI-provider hook: a generic seam letting a consuming repo
// route extra provider names (e.g. CLI bridges) through its own call
// function. These tests prove, at the tutor-core function-call level and
// with a plain injected fake (no client code, no subprocess, no network):
//   1. _fetchProvider (the callAI standard loop) routes hook-handled
//      providers to the hook, BEFORE the isConfigured gate;
//   2. unifiedAIProviderService.call (the aiService.generateText /
//      dialectical layer) routes hook-handled providers too;
//   3. resolveProviderConfig treats hook-handled providers as configured
//      (with or without a YAML entry);
//   4. with no hook (default), behavior is byte-identical to before —
//      unknown/unconfigured providers still throw the classic errors.

// Mock heavy sibling imports the engine pulls in at module level
vi.mock('../tutorConfigLoader.js', () => ({
  loadConfig: vi.fn(() => ({ profiles: {} })),
  getProfile: vi.fn(() => null),
  getLoggingConfig: vi.fn(() => ({ log_api_calls: false })),
}));
vi.mock('../monitoringService.js', () => ({
  record: vi.fn(),
  logApiCall: vi.fn(),
}));
vi.mock('../sseStreamParser.js', () => ({
  parseSSEStream: vi.fn(async () => ({ text: '', inputTokens: 0, outputTokens: 0 })),
}));

import {
  setExternalAIProviderHook,
  clearExternalAIProviderHook,
  externalProviderHandles,
} from '../externalAIProvider.js';
import { callAI, _fetchProvider } from '../tutorDialogueEngine.js';
import { call as unifiedCall } from '../unifiedAIProviderService.js';
import { resolveProviderConfig } from '../configLoaderBase.js';

function makeFakeHook(received) {
  return {
    handles: (provider) => provider === 'codex' || provider === 'claude-code',
    call: async (request) => {
      received.push(request);
      return {
        text: `FAKE:${request.channel}:${request.provider}/${request.model}`,
        model: request.model,
        provider: request.provider,
        latencyMs: 3,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
      };
    },
  };
}

describe('externalAIProvider hook', () => {
  let received;

  beforeEach(() => {
    received = [];
    clearExternalAIProviderHook();
  });

  afterEach(() => {
    clearExternalAIProviderHook();
  });

  it('routes a hook-handled provider through _fetchProvider (before the isConfigured gate)', async () => {
    setExternalAIProviderHook(makeFakeHook(received));
    const result = await _fetchProvider({
      provider: 'codex',
      providerConfig: { isConfigured: false }, // would throw without the hook
      model: 'gpt-5.5',
      messages: [
        { role: 'system', content: 'SYS' },
        { role: 'user', content: 'hello' },
      ],
      systemPrompt: 'SYS',
      hyperparameters: { temperature: 0.5, max_tokens: 100 },
    });
    expect(result.text).toBe('FAKE:dialogue-engine:codex/gpt-5.5');
    expect(received).toHaveLength(1);
    expect(received[0].channel).toBe('dialogue-engine');
    expect(received[0].messages).toHaveLength(2);
    expect(received[0].systemPrompt).toBe('SYS');
  });

  it('reaches the hook through the full callAI wrapper (agentConfig shape)', async () => {
    setExternalAIProviderHook(makeFakeHook(received));
    const result = await callAI(
      {
        provider: 'codex',
        providerConfig: {},
        model: 'gpt-5.5',
        hyperparameters: { temperature: 0.5, max_tokens: 100 },
      },
      'SYSTEM PROMPT',
      'user prompt',
      'ego',
    );
    expect(result.text).toBe('FAKE:dialogue-engine:codex/gpt-5.5');
    expect(result.provider).toBe('codex');
    expect(result.model).toBe('gpt-5.5');
    expect(received).toHaveLength(1);
  });

  it('routes a hook-handled provider through unifiedAIProviderService.call (dialectical layer)', async () => {
    setExternalAIProviderHook(makeFakeHook(received));
    const response = await unifiedCall({
      provider: 'codex',
      model: 'gpt-5.5',
      systemPrompt: 'SYS',
      messages: [{ role: 'user', content: 'critique this' }],
      preset: 'direct',
    });
    expect(response.content).toBe('FAKE:unified:codex/gpt-5.5');
    expect(response.provider).toBe('codex');
    expect(response.usage).toEqual({ inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 });
    expect(received[0].channel).toBe('unified');
    expect(received[0].hyperparameters).toHaveProperty('max_tokens');
  });

  it('does not intercept providers the hook does not handle', async () => {
    setExternalAIProviderHook(makeFakeHook(received));
    await expect(
      _fetchProvider({
        provider: 'openrouter',
        providerConfig: { isConfigured: false },
        model: 'x',
        messages: [],
      }),
    ).rejects.toThrow('Provider openrouter not configured');
    expect(received).toHaveLength(0);
  });

  it('with no hook registered, unconfigured providers throw exactly as before', async () => {
    await expect(
      _fetchProvider({
        provider: 'codex',
        providerConfig: { isConfigured: false },
        model: 'gpt-5.5',
        messages: [],
      }),
    ).rejects.toThrow('Provider codex not configured (missing API key)');
  });

  it('resolveProviderConfig synthesizes a configured block for hook-handled providers missing from YAML', () => {
    expect(() => resolveProviderConfig({}, 'codex')).toThrow('Unknown provider: codex');
    setExternalAIProviderHook(makeFakeHook(received));
    const config = resolveProviderConfig({}, 'codex');
    expect(config.isConfigured).toBe(true);
    expect(config.apiKey).toBe('');
  });

  it('resolveProviderConfig forces isConfigured for hook-handled providers that have a YAML entry without base_url/api_key_env', () => {
    const providers = { codex: { default_model: 'gpt-5.5', models: { 'gpt-5.5': 'gpt-5.5' } } };
    const before = resolveProviderConfig(providers, 'codex');
    expect(before.isConfigured).toBe(false);
    setExternalAIProviderHook(makeFakeHook(received));
    const after = resolveProviderConfig(providers, 'codex');
    expect(after.isConfigured).toBe(true);
    expect(after.models['gpt-5.5']).toBe('gpt-5.5');
  });

  it('setExternalAIProviderHook validates the hook shape and supports clearing', () => {
    expect(() => setExternalAIProviderHook({ handles: true })).toThrow(/handles\(provider\) and call\(request\)/);
    setExternalAIProviderHook(makeFakeHook(received));
    expect(externalProviderHandles('codex')).toBe(true);
    clearExternalAIProviderHook();
    expect(externalProviderHandles('codex')).toBe(false);
    setExternalAIProviderHook(makeFakeHook(received));
    setExternalAIProviderHook(null); // null also clears
    expect(externalProviderHandles('codex')).toBe(false);
  });

  it('treats a throwing handles() predicate as not-handled', () => {
    setExternalAIProviderHook({
      handles: () => {
        throw new Error('broken predicate');
      },
      call: async () => ({ text: 'x' }),
    });
    expect(externalProviderHandles('codex')).toBe(false);
  });
});
