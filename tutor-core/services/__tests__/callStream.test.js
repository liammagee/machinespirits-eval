import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock aiConfigService before importing the module under test.
// This avoids the real module's SQLite initialization at import time.
vi.mock('../aiConfigService.js', () => ({
  getApiKey: vi.fn((provider) => {
    const keys = {
      openrouter: 'test-openrouter-key',
      claude: 'test-anthropic-key',
      openai: 'test-openai-key',
      gemini: 'test-gemini-key',
    };
    return keys[provider] || null;
  }),
  getDefaultModel: vi.fn((provider) => {
    const models = {
      openrouter: 'test-org/test-model',
      claude: 'claude-test',
      openai: 'gpt-test',
      gemini: 'gemini-test',
    };
    return models[provider] || 'default-model';
  }),
  getDefaultProviderId: vi.fn(() => 'openrouter'),
  logInteraction: vi.fn(),
}));

// Stub sseStreamParser (used by the non-streaming call() path, not callStream)
vi.mock('../sseStreamParser.js', () => ({
  parseSSEStream: vi.fn(async () => ({ text: '', inputTokens: 0, outputTokens: 0 })),
}));

import { callStream, call, getAvailableProvider, getProviderStatus, PRESETS } from '../unifiedAIProviderService.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a mock fetch Response whose body is a ReadableStream of SSE chunks. */
function mockSSEResponse(chunks, status = 200) {
  const encoder = new TextEncoder();
  let index = 0;

  const body = new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });

  return {
    ok: status >= 200 && status < 300,
    status,
    body,
    json: async () => {
      // For error responses, decode remaining body
      const reader = body.getReader();
      const parts = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(new TextDecoder().decode(value));
      }
      return JSON.parse(parts.join(''));
    },
  };
}

/** Create a mock non-streaming JSON response (for callLocal tests). */
function mockJSONResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    body: null,
    json: async () => data,
  };
}

/** Collect all chunks from an async generator into an array. */
async function collectChunks(gen) {
  const chunks = [];
  for await (const chunk of gen) {
    chunks.push(chunk);
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('callStream()', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.LOCAL_AI_URL;
  });

  // =========================================================================
  // OpenAI-compatible format (openai, openrouter, local)
  // =========================================================================

  describe('OpenAI-compatible format (openrouter)', () => {
    it('yields text_delta chunks and a final done chunk', async () => {
      globalThis.fetch.mockResolvedValueOnce(
        mockSSEResponse([
          'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
          'data: [DONE]\n\n',
        ])
      );

      const chunks = await collectChunks(
        callStream({
          provider: 'openrouter',
          model: 'test-org/test-model',
          systemPrompt: 'Be helpful',
          messages: [{ role: 'user', content: 'Hi' }],
        })
      );

      const deltas = chunks.filter((c) => c.type === 'text_delta');
      expect(deltas).toHaveLength(2);
      expect(deltas[0].content).toBe('Hello');
      expect(deltas[1].content).toBe(' world');

      const done = chunks.find((c) => c.type === 'done');
      expect(done).toBeDefined();
      expect(done.content).toBe('Hello world');
      expect(done.provider).toBe('openrouter');
      expect(done.model).toBe('test-org/test-model');
      expect(done.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('extracts usage from the final chunk when provider includes it', async () => {
      globalThis.fetch.mockResolvedValueOnce(
        mockSSEResponse([
          'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
          'data: {"choices":[],"usage":{"prompt_tokens":15,"completion_tokens":3}}\n\n',
          'data: [DONE]\n\n',
        ])
      );

      const chunks = await collectChunks(
        callStream({
          provider: 'openrouter',
          model: 'test-org/test-model',
          systemPrompt: 'sys',
          messages: [{ role: 'user', content: 'test' }],
        })
      );

      const done = chunks.find((c) => c.type === 'done');
      expect(done.usage.inputTokens).toBe(15);
      expect(done.usage.outputTokens).toBe(3);
      expect(done.usage.totalTokens).toBe(18);
    });

    it('handles empty delta objects gracefully', async () => {
      globalThis.fetch.mockResolvedValueOnce(
        mockSSEResponse([
          'data: {"choices":[{"delta":{}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
          'data: [DONE]\n\n',
        ])
      );

      const chunks = await collectChunks(
        callStream({
          provider: 'openrouter',
          model: 'test-org/test-model',
          systemPrompt: '',
          messages: [{ role: 'user', content: 'test' }],
        })
      );

      const deltas = chunks.filter((c) => c.type === 'text_delta');
      expect(deltas).toHaveLength(1);
      expect(deltas[0].content).toBe('ok');
    });

    it('skips [DONE] and non-JSON data lines', async () => {
      globalThis.fetch.mockResolvedValueOnce(
        mockSSEResponse([
          'data: not-json\n\n',
          'data: {"choices":[{"delta":{"content":"valid"}}]}\n\n',
          'data: [DONE]\n\n',
        ])
      );

      const chunks = await collectChunks(
        callStream({
          provider: 'openrouter',
          model: 'test-org/test-model',
          systemPrompt: '',
          messages: [{ role: 'user', content: 'x' }],
        })
      );

      const deltas = chunks.filter((c) => c.type === 'text_delta');
      expect(deltas).toHaveLength(1);
      expect(deltas[0].content).toBe('valid');
    });

    it('handles chunks split across byte boundaries', async () => {
      globalThis.fetch.mockResolvedValueOnce(
        mockSSEResponse([
          'data: {"choices":[{"del',
          'ta":{"content":"split"}}]}\n\ndata: [DONE]\n\n',
        ])
      );

      const chunks = await collectChunks(
        callStream({
          provider: 'openrouter',
          model: 'test-org/test-model',
          systemPrompt: '',
          messages: [{ role: 'user', content: 'x' }],
        })
      );

      const done = chunks.find((c) => c.type === 'done');
      expect(done.content).toBe('split');
    });
  });

  // =========================================================================
  // Anthropic format
  // =========================================================================

  describe('Anthropic format', () => {
    it('yields text from content_block_delta events', async () => {
      globalThis.fetch.mockResolvedValueOnce(
        mockSSEResponse([
          'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":25}}}\n\n',
          'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"text":"Hello"}}\n\n',
          'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"text":" there"}}\n\n',
          'event: message_delta\ndata: {"type":"message_delta","usage":{"output_tokens":8}}\n\n',
          'event: message_stop\ndata: {"type":"message_stop"}\n\n',
        ])
      );

      const chunks = await collectChunks(
        callStream({
          provider: 'anthropic',
          model: 'claude-test',
          systemPrompt: 'sys',
          messages: [{ role: 'user', content: 'Hi' }],
        })
      );

      const deltas = chunks.filter((c) => c.type === 'text_delta');
      expect(deltas).toHaveLength(2);
      expect(deltas[0].content).toBe('Hello');
      expect(deltas[1].content).toBe(' there');

      const done = chunks.find((c) => c.type === 'done');
      expect(done.content).toBe('Hello there');
      expect(done.provider).toBe('anthropic');
    });

    it('extracts input/output tokens from message events', async () => {
      globalThis.fetch.mockResolvedValueOnce(
        mockSSEResponse([
          'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":30}}}\n\n',
          'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"text":"ok"}}\n\n',
          'event: message_delta\ndata: {"type":"message_delta","usage":{"output_tokens":12}}\n\n',
        ])
      );

      const chunks = await collectChunks(
        callStream({
          provider: 'anthropic',
          model: 'claude-test',
          systemPrompt: '',
          messages: [{ role: 'user', content: 'test' }],
        })
      );

      const done = chunks.find((c) => c.type === 'done');
      expect(done.usage.inputTokens).toBe(30);
      expect(done.usage.outputTokens).toBe(12);
      expect(done.usage.totalTokens).toBe(42);
    });

    it('ignores non-content events like ping', async () => {
      globalThis.fetch.mockResolvedValueOnce(
        mockSSEResponse([
          'event: ping\ndata: {"type":"ping"}\n\n',
          'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"text":"real"}}\n\n',
        ])
      );

      const chunks = await collectChunks(
        callStream({
          provider: 'anthropic',
          model: 'claude-test',
          systemPrompt: '',
          messages: [{ role: 'user', content: 'test' }],
        })
      );

      const done = chunks.find((c) => c.type === 'done');
      expect(done.content).toBe('real');
    });
  });

  // =========================================================================
  // Gemini format
  // =========================================================================

  describe('Gemini format', () => {
    it('yields text from candidates array', async () => {
      globalThis.fetch.mockResolvedValueOnce(
        mockSSEResponse([
          'data: {"candidates":[{"content":{"parts":[{"text":"Gem"}]}}]}\n\n',
          'data: {"candidates":[{"content":{"parts":[{"text":"ini"}]}}]}\n\n',
        ])
      );

      const chunks = await collectChunks(
        callStream({
          provider: 'gemini',
          model: 'gemini-test',
          systemPrompt: 'sys',
          messages: [{ role: 'user', content: 'Hi' }],
        })
      );

      const deltas = chunks.filter((c) => c.type === 'text_delta');
      expect(deltas).toHaveLength(2);
      expect(deltas[0].content).toBe('Gem');
      expect(deltas[1].content).toBe('ini');

      const done = chunks.find((c) => c.type === 'done');
      expect(done.content).toBe('Gemini');
      expect(done.provider).toBe('gemini');
    });

    it('extracts usage from usageMetadata', async () => {
      globalThis.fetch.mockResolvedValueOnce(
        mockSSEResponse([
          'data: {"candidates":[{"content":{"parts":[{"text":"hi"}]}}],"usageMetadata":{"promptTokenCount":20,"candidatesTokenCount":5}}\n\n',
        ])
      );

      const chunks = await collectChunks(
        callStream({
          provider: 'gemini',
          model: 'gemini-test',
          systemPrompt: '',
          messages: [{ role: 'user', content: 'test' }],
        })
      );

      const done = chunks.find((c) => c.type === 'done');
      expect(done.usage.inputTokens).toBe(20);
      expect(done.usage.outputTokens).toBe(5);
      expect(done.usage.totalTokens).toBe(25);
    });
  });

  // =========================================================================
  // Error handling
  // =========================================================================

  describe('error handling', () => {
    it('throws on non-ok HTTP response', async () => {
      const errorBody = JSON.stringify({ error: { message: 'Rate limited' } });
      const encoder = new TextEncoder();
      globalThis.fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(errorBody));
            controller.close();
          },
        }),
        json: async () => ({ error: { message: 'Rate limited' } }),
      });

      const gen = callStream({
        provider: 'openrouter',
        model: 'test-org/test-model',
        systemPrompt: '',
        messages: [{ role: 'user', content: 'test' }],
      });

      await expect(collectChunks(gen)).rejects.toThrow('429');
    });

    it('throws when API key is missing', async () => {
      // Import and override the mock to return null for this provider
      const { getApiKey } = await import('../aiConfigService.js');
      getApiKey.mockImplementationOnce(() => null);

      const gen = callStream({
        provider: 'openrouter',
        model: 'test-org/test-model',
        systemPrompt: '',
        messages: [{ role: 'user', content: 'test' }],
      });

      await expect(collectChunks(gen)).rejects.toThrow('API key missing');
    });
  });

  // =========================================================================
  // Local provider (OpenAI-compatible)
  // =========================================================================

  describe('local provider via callStream', () => {
    it('streams from local endpoint with OpenAI-compatible format', async () => {
      globalThis.fetch.mockResolvedValueOnce(
        mockSSEResponse([
          'data: {"choices":[{"delta":{"content":"local"}}]}\n\n',
          'data: [DONE]\n\n',
        ])
      );

      const chunks = await collectChunks(
        callStream({
          provider: 'local',
          model: 'my-model',
          systemPrompt: 'sys',
          messages: [{ role: 'user', content: 'Hi' }],
        })
      );

      // Verify it called the local endpoint
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:1234/v1/chat/completions',
        expect.objectContaining({ method: 'POST' })
      );

      const done = chunks.find((c) => c.type === 'done');
      expect(done.content).toBe('local');
      expect(done.provider).toBe('local');
    });

    it('respects LOCAL_AI_URL env var', async () => {
      process.env.LOCAL_AI_URL = 'http://myserver:8000';

      globalThis.fetch.mockResolvedValueOnce(
        mockSSEResponse([
          'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
          'data: [DONE]\n\n',
        ])
      );

      await collectChunks(
        callStream({
          provider: 'local',
          systemPrompt: '',
          messages: [{ role: 'user', content: 'test' }],
        })
      );

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://myserver:8000/v1/chat/completions',
        expect.anything()
      );
    });

    it('normalizes URL that already includes /v1/chat/completions', async () => {
      process.env.LOCAL_AI_URL = 'http://myserver:8000/v1/chat/completions';

      globalThis.fetch.mockResolvedValueOnce(
        mockSSEResponse([
          'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
          'data: [DONE]\n\n',
        ])
      );

      await collectChunks(
        callStream({
          provider: 'local',
          systemPrompt: '',
          messages: [{ role: 'user', content: 'test' }],
        })
      );

      // Should NOT double-append the path
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://myserver:8000/v1/chat/completions',
        expect.anything()
      );
    });
  });

  // =========================================================================
  // Preset config merging
  // =========================================================================

  describe('preset config merging', () => {
    it('uses preset defaults when no config overrides given', async () => {
      globalThis.fetch.mockResolvedValueOnce(
        mockSSEResponse(['data: {"choices":[{"delta":{"content":"x"}}]}\n\n', 'data: [DONE]\n\n'])
      );

      await collectChunks(
        callStream({
          provider: 'openai',
          model: 'gpt-test',
          systemPrompt: '',
          messages: [{ role: 'user', content: 'test' }],
          preset: 'socratic',
        })
      );

      const callBody = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
      expect(callBody.temperature).toBe(PRESETS.socratic.temperature);
      expect(callBody.max_completion_tokens).toBe(PRESETS.socratic.maxTokens);
    });

    it('allows config overrides to take precedence', async () => {
      globalThis.fetch.mockResolvedValueOnce(
        mockSSEResponse(['data: {"choices":[{"delta":{"content":"x"}}]}\n\n', 'data: [DONE]\n\n'])
      );

      await collectChunks(
        callStream({
          provider: 'openai',
          model: 'gpt-test',
          systemPrompt: '',
          messages: [{ role: 'user', content: 'test' }],
          preset: 'socratic',
          config: { temperature: 0.1, maxTokens: 50 },
        })
      );

      const callBody = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
      expect(callBody.temperature).toBe(0.1);
      expect(callBody.max_completion_tokens).toBe(50);
    });
  });
});

// ===========================================================================
// callLocal via call() (non-streaming path)
// ===========================================================================

describe('call() with local provider (non-streaming)', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.LOCAL_AI_URL;
  });

  it('calls correct endpoint with OpenAI-compatible body', async () => {
    globalThis.fetch.mockResolvedValueOnce(
      mockJSONResponse({
        choices: [{ message: { content: 'Hello from local' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      })
    );

    const result = await call({
      provider: 'local',
      model: 'my-local-model',
      systemPrompt: 'Be helpful',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(result.content).toBe('Hello from local');
    expect(result.provider).toBe('local');
    expect(result.model).toBe('my-local-model');
    expect(result.usage.inputTokens).toBe(10);
    expect(result.usage.outputTokens).toBe(5);
    expect(result.usage.totalTokens).toBe(15);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:1234/v1/chat/completions',
      expect.objectContaining({ method: 'POST' })
    );

    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(body.model).toBe('my-local-model');
    expect(body.messages[0]).toEqual({ role: 'system', content: 'Be helpful' });
    expect(body.messages[1]).toEqual({ role: 'user', content: 'Hi' });
  });

  it('respects LOCAL_AI_URL env var', async () => {
    process.env.LOCAL_AI_URL = 'http://custom:9999';

    globalThis.fetch.mockResolvedValueOnce(
      mockJSONResponse({
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      })
    );

    await call({
      provider: 'local',
      systemPrompt: '',
      messages: [{ role: 'user', content: 'test' }],
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://custom:9999/v1/chat/completions',
      expect.anything()
    );
  });

  it('uses "local-model" as default when no model specified', async () => {
    globalThis.fetch.mockResolvedValueOnce(
      mockJSONResponse({
        choices: [{ message: { content: 'ok' } }],
        usage: {},
      })
    );

    const result = await call({
      provider: 'local',
      systemPrompt: '',
      messages: [{ role: 'user', content: 'test' }],
    });

    expect(result.model).toBe('local-model');
  });

  it('throws on non-ok response with error message', async () => {
    globalThis.fetch.mockResolvedValueOnce(
      mockJSONResponse({ error: { message: 'Server error' } }, 500)
    );

    await expect(
      call({
        provider: 'local',
        systemPrompt: '',
        messages: [{ role: 'user', content: 'test' }],
      })
    ).rejects.toThrow('Local AI error: 500 - Server error');
  });

  it('throws specific error for "no models loaded"', async () => {
    globalThis.fetch.mockResolvedValueOnce(
      mockJSONResponse({ error: { message: 'No models loaded' } }, 400)
    );

    await expect(
      call({
        provider: 'local',
        systemPrompt: '',
        messages: [{ role: 'user', content: 'test' }],
      })
    ).rejects.toThrow(/no models loaded/i);
  });
});

// ===========================================================================
// Utility exports
// ===========================================================================

describe('getAvailableProvider()', () => {
  it('returns first provider with an API key based on preference order', () => {
    // With our mock, openrouter has a key and is first in PROVIDER_PREFERENCE
    const provider = getAvailableProvider();
    expect(provider).toBe('openrouter');
  });
});

describe('getProviderStatus()', () => {
  it('returns status for all known providers plus local', () => {
    const status = getProviderStatus();
    expect(status).toHaveProperty('gemini');
    expect(status).toHaveProperty('openai');
    expect(status).toHaveProperty('claude');
    expect(status).toHaveProperty('openrouter');
    expect(status).toHaveProperty('local');
    expect(status.local.configured).toBe(true);
  });
});
