import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock all heavy dependencies that tutorDialogueEngine.js imports at module level
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

import { callAI, EMPTY_CONTENT_MAX_RETRIES, EMPTY_CONTENT_RETRY_DELAYS } from '../tutorDialogueEngine.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal agent config for the OpenRouter provider path */
function makeAgentConfig(overrides = {}) {
  return {
    provider: 'openrouter',
    providerConfig: { isConfigured: true, apiKey: 'test-key', base_url: 'https://openrouter.test/v1/chat/completions' },
    model: 'test/model',
    hyperparameters: { temperature: 0.5, max_tokens: 1500 },
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

function lastOpenRouterBody(mockFetch) {
  const [, options] = mockFetch.mock.calls.at(-1);
  return JSON.parse(options.body);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('callAI empty-content retry', () => {
  let originalFetch;
  let mockFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    delete process.env.OPENROUTER_REASONING_EFFORT;
    delete process.env.OPENROUTER_REASONING_MAX_TOKENS;
    delete process.env.OPENROUTER_REASONING_EXCLUDE;
    delete process.env.OPENROUTER_MAX_COMPLETION_TOKENS;
    delete process.env.OPENROUTER_API_TIMEOUT_MS;
  });

  it('returns immediately on non-empty response (no retry)', async () => {
    mockFetch.mockResolvedValueOnce(mockOpenRouterResponse({ content: 'Hello!', outputTokens: 5 }));

    const result = await callAI(makeAgentConfig(), 'system', 'user', 'ego');

    expect(result.text).toBe('Hello!');
    expect(result.emptyContentRetries).toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('sends OpenRouter reasoning runtime controls from environment overrides', async () => {
    process.env.OPENROUTER_REASONING_EFFORT = 'none';
    process.env.OPENROUTER_REASONING_MAX_TOKENS = '0';
    process.env.OPENROUTER_REASONING_EXCLUDE = 'true';
    process.env.OPENROUTER_MAX_COMPLETION_TOKENS = '1800';
    mockFetch.mockResolvedValueOnce(mockOpenRouterResponse({ content: 'Runtime-controlled', outputTokens: 5 }));

    const result = await callAI(
      makeAgentConfig({
        hyperparameters: {
          temperature: 0.5,
          max_tokens: 1500,
          reasoning_effort: 'low',
          reasoning_max_tokens: 400,
          reasoning_exclude: false,
          max_completion_tokens: 900,
        },
      }),
      'system',
      'user',
      'ego',
    );

    const body = lastOpenRouterBody(mockFetch);
    expect(result.text).toBe('Runtime-controlled');
    expect(body.reasoning).toEqual({ max_tokens: 0, exclude: true });
    expect(body.max_completion_tokens).toBe(1800);
  });

  it('sends OpenRouter abort signal and maps aborts to timeout errors when configured', async () => {
    process.env.OPENROUTER_API_TIMEOUT_MS = '1234';
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValueOnce(abortError);

    await expect(callAI(makeAgentConfig(), 'system', 'user', 'ego')).rejects.toThrow(
      /OpenRouter API request timed out after 1234ms/,
    );

    const [, options] = mockFetch.mock.calls[0];
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('retries on empty content with 0 output tokens and succeeds', async () => {
    // First call: empty content, 0 output tokens
    mockFetch.mockResolvedValueOnce(mockOpenRouterResponse({ content: '', outputTokens: 0 }));
    // Second call (retry): success
    mockFetch.mockResolvedValueOnce(mockOpenRouterResponse({ content: 'Recovered!', outputTokens: 12 }));

    const result = await callAI(makeAgentConfig(), 'system', 'user', 'ego');

    expect(result.text).toBe('Recovered!');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('returns empty after all retries exhausted', async () => {
    // All attempts return empty
    for (let i = 0; i <= EMPTY_CONTENT_MAX_RETRIES; i++) {
      mockFetch.mockResolvedValueOnce(mockOpenRouterResponse({ content: '', outputTokens: 0 }));
    }

    const result = await callAI(makeAgentConfig(), 'system', 'user', 'superego');

    expect(result.text).toBe('');
    expect(result.emptyContentRetries).toBe(EMPTY_CONTENT_MAX_RETRIES);
    expect(mockFetch).toHaveBeenCalledTimes(EMPTY_CONTENT_MAX_RETRIES + 1);
  });

  it('skips retry when outputTokens > 0 (thinking model budget exhaustion)', async () => {
    // Empty content but outputTokens > 0 → reasoning tokens consumed the budget
    mockFetch.mockResolvedValueOnce(mockOpenRouterResponse({ content: '', outputTokens: 500 }));

    const result = await callAI(makeAgentConfig(), 'system', 'user', 'ego');

    expect(result.text).toBe('');
    expect(result.emptyContentRetries).toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('skips retry when finishReason is length (token budget exhausted)', async () => {
    mockFetch.mockResolvedValueOnce(mockOpenRouterResponse({ content: '', outputTokens: 0, finishReason: 'length' }));

    const result = await callAI(makeAgentConfig(), 'system', 'user', 'superego');

    expect(result.text).toBe('');
    expect(result.emptyContentRetries).toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('skips retry for streaming calls (onToken set)', async () => {
    mockFetch.mockResolvedValueOnce(mockOpenRouterResponse({ content: '', outputTokens: 0 }));

    // Mock the SSE stream parsing to return empty
    const { parseSSEStream } = await import('../sseStreamParser.js');
    parseSSEStream.mockResolvedValueOnce({ text: '', inputTokens: 10, outputTokens: 0 });

    // Create a streaming-mode response with body
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, body });

    const onToken = vi.fn();
    const result = await callAI(makeAgentConfig(), 'system', 'user', 'ego', { onToken });

    // Should NOT retry — streaming calls can't be replayed
    expect(result.text).toBe('');
    expect(result.emptyContentRetries).toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('succeeds on second retry (third attempt)', async () => {
    mockFetch.mockResolvedValueOnce(mockOpenRouterResponse({ content: '', outputTokens: 0 }));
    mockFetch.mockResolvedValueOnce(mockOpenRouterResponse({ content: '', outputTokens: 0 }));
    mockFetch.mockResolvedValueOnce(mockOpenRouterResponse({ content: 'Third time lucky', outputTokens: 8 }));

    const result = await callAI(makeAgentConfig(), 'system', 'user', 'ego');

    expect(result.text).toBe('Third time lucky');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('exports expected constants', () => {
    expect(EMPTY_CONTENT_MAX_RETRIES).toBe(2);
    expect(EMPTY_CONTENT_RETRY_DELAYS).toEqual([1000, 2000]);
  });
});
