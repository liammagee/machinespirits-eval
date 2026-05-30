/**
 * Unified AI Provider Service
 * Single source of truth for all AI provider communications.
 *
 * Consolidates duplicate implementations from aiService.js and tutorIntegrationService.js
 * into a single, normalized interface.
 */

import { getApiKey, getDefaultModel, getDefaultProviderId, logInteraction } from './aiConfigService.js';
import { parseSSEStream } from './sseStreamParser.js';

// ============================================================================
// Configuration Presets
// ============================================================================

export const PRESETS = {
  chat: {
    name: 'Context-based Chat',
    temperature: 0.35,
    maxTokens: 800,
    topP: 0.95,
  },
  direct: {
    name: 'Direct Reply',
    temperature: 0.5,
    maxTokens: 1000,
    topP: 0.95,
  },
  socratic: {
    name: 'Socratic Dialogue',
    temperature: 0.7,
    maxTokens: 500,
    topP: 0.9,
  },
  codeReview: {
    name: 'Code Review',
    temperature: 0.3,
    maxTokens: 1500,
    topP: 0.9,
  },
  deliberation: {
    name: 'Agent Deliberation',
    temperature: 0.7,
    maxTokens: 1000,
    topP: 0.9,
  },
  persona: {
    name: 'Philosopher Persona',
    temperature: 0.7,
    maxTokens: 1000,
    topP: 0.9,
  },
};

// ============================================================================
// Provider Priority Order
// ============================================================================

const PROVIDER_PREFERENCE = ['openrouter', 'anthropic', 'openai', 'gemini'];

// ============================================================================
// Text Sanitization (fixes invalid Unicode surrogates)
// ============================================================================

/**
 * Sanitize text to remove invalid Unicode surrogates that break JSON.stringify
 * Surrogates (U+D800-U+DFFF) must come in valid pairs; orphaned ones cause errors.
 * @param {string} text - Text to sanitize
 * @returns {string} - Sanitized text
 */
function sanitizeText(text) {
  if (typeof text !== 'string') return text;
  // Remove unpaired surrogates (orphaned high or low surrogates)
  // High surrogate: D800-DBFF, Low surrogate: DC00-DFFF
  return text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD');
}

/**
 * Sanitize messages array to prevent JSON encoding errors
 * @param {Array} messages - Array of message objects
 * @returns {Array} - Sanitized messages
 */
function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return messages;
  return messages.map(m => ({
    ...m,
    content: sanitizeText(m.content),
  }));
}

/**
 * Get the first available provider based on API key availability
 * @returns {string} Provider ID
 */
export function getAvailableProvider() {
  for (const provider of PROVIDER_PREFERENCE) {
    const keyName = provider === 'anthropic' ? 'claude' : provider;
    if (getApiKey(keyName)) {
      return provider;
    }
  }
  return getDefaultProviderId();
}

// ============================================================================
// Normalized Response Type
// ============================================================================

/**
 * @typedef {Object} AIResponse
 * @property {string} content - The generated text
 * @property {string} model - Model ID used
 * @property {Object} usage - Token usage statistics
 * @property {number} usage.inputTokens - Input/prompt tokens
 * @property {number} usage.outputTokens - Output/completion tokens
 * @property {number} usage.totalTokens - Total tokens
 * @property {number} latencyMs - Response time in milliseconds
 * @property {string} provider - Provider used
 */

// ============================================================================
// Provider-Specific Implementations
// ============================================================================

/**
 * Call OpenRouter API
 * @private
 */
async function callOpenRouter(model, systemPrompt, messages, config) {
  const startTime = Date.now();
  const apiKey = getApiKey('openrouter');

  if (!apiKey) {
    throw new Error('OpenRouter API key missing. Set OPENROUTER_API_KEY.');
  }

  // Use default model if model parameter doesn't look like an OpenRouter model ID
  const effectiveModel = model && model.includes('/') ? model : getDefaultModel('openrouter');

  const sanitizedMessages = sanitizeMessages(messages);
  const body = {
    model: effectiveModel,
    max_tokens: config.maxTokens || 1000,
    temperature: config.temperature ?? 0.7,
    messages: [
      { role: 'system', content: sanitizeText(systemPrompt) },
      ...sanitizedMessages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
    ],
  };
  if (config.onToken) body.stream = true;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://machinespirits.org',
      'X-Title': 'Machine Spirits',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(`OpenRouter error: ${res.status} - ${error.error?.message || 'Unknown'}`);
  }

  let content, inputTokens, outputTokens, generationId, cost;
  if (config.onToken) {
    const parsed = await parseSSEStream(res, { onToken: config.onToken, format: 'openai' });
    content = parsed.text || '';
    inputTokens = parsed.inputTokens || 0;
    outputTokens = parsed.outputTokens || 0;
  } else {
    const data = await res.json();
    generationId = data.id || null;

    const message = data.choices?.[0]?.message;
    // Thinking models (GLM-5, kimi-k2.5, deepseek-r1, etc.) may return their
    // answer in `reasoning` or `reasoning_content` while `content` is empty.
    // Fall back to the reasoning field so we don't silently drop the response.
    content = message?.content || '';
    if (!content && message?.reasoning) {
      content = message.reasoning;
    } else if (!content && message?.reasoning_content) {
      content = message.reasoning_content;
    }
    if (!content) {
      const finishReason = data.choices?.[0]?.finish_reason || 'unknown';
      const nativeError = data.choices?.[0]?.native_finish_reason || data.error?.message || '';
      console.warn(`[OpenRouter] Empty response from ${effectiveModel}: finish_reason=${finishReason}, native=${nativeError}, choices=${data.choices?.length || 0}, error=${JSON.stringify(data.error || null)}`);
    }
    inputTokens = data.usage?.prompt_tokens || 0;
    outputTokens = data.usage?.completion_tokens || 0;
    cost = data.usage?.cost || 0;
  }

  return {
    content,
    model: effectiveModel,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cost: cost || 0,
    },
    latencyMs: Date.now() - startTime,
    provider: 'openrouter',
    generationId: generationId || null,
  };
}

/**
 * Call Anthropic Claude API
 * @private
 */
async function callAnthropic(model, systemPrompt, messages, config) {
  const startTime = Date.now();
  const apiKey = getApiKey('claude');

  if (!apiKey) {
    throw new Error('Anthropic API key missing. Set ANTHROPIC_API_KEY.');
  }

  const effectiveModel = model || getDefaultModel('claude');

  const sanitizedMessages = sanitizeMessages(messages);
  const body = {
    model: effectiveModel,
    max_tokens: config.maxTokens || 1000,
    temperature: config.temperature ?? 0.5,
    system: sanitizeText(systemPrompt),
    messages: sanitizedMessages.map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    })),
  };
  if (config.onToken) body.stream = true;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    if (res.status === 401) {
      throw new Error('Anthropic auth failed (check ANTHROPIC_API_KEY).');
    }
    throw new Error(`Anthropic error: ${res.status} - ${error.error?.message || 'Unknown'}`);
  }

  let content, inputTokens, outputTokens;
  if (config.onToken) {
    const parsed = await parseSSEStream(res, { onToken: config.onToken, format: 'anthropic' });
    content = parsed.text || '';
    inputTokens = parsed.inputTokens || 0;
    outputTokens = parsed.outputTokens || 0;
  } else {
    const data = await res.json();
    content = data.content?.[0]?.text || '';
    inputTokens = data.usage?.input_tokens || 0;
    outputTokens = data.usage?.output_tokens || 0;
  }

  return {
    content,
    model: effectiveModel,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    },
    latencyMs: Date.now() - startTime,
    provider: 'anthropic',
  };
}

/**
 * Call OpenAI API
 * @private
 */
async function callOpenAI(model, systemPrompt, messages, config) {
  const startTime = Date.now();
  const apiKey = getApiKey('openai');

  if (!apiKey) {
    throw new Error('OpenAI API key missing. Set OPENAI_API_KEY.');
  }

  const effectiveModel = model || getDefaultModel('openai');

  const sanitizedMessages = sanitizeMessages(messages);
  const body = {
    model: effectiveModel,
    max_completion_tokens: config.maxTokens || 1000,
    temperature: config.temperature ?? 0.5,
    messages: [
      { role: 'system', content: sanitizeText(systemPrompt) },
      ...sanitizedMessages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
    ],
  };

  // Add JSON mode for code review preset
  if (config.jsonMode) {
    body.response_format = { type: 'json_object' };
  }
  if (config.onToken) body.stream = true;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    if (res.status === 401) {
      throw new Error('OpenAI auth failed (check OPENAI_API_KEY).');
    }
    throw new Error(`OpenAI error: ${res.status} - ${error.error?.message || 'Unknown'}`);
  }

  let content, inputTokens, outputTokens;
  if (config.onToken) {
    const parsed = await parseSSEStream(res, { onToken: config.onToken, format: 'openai' });
    content = parsed.text || '';
    inputTokens = parsed.inputTokens || 0;
    outputTokens = parsed.outputTokens || 0;
  } else {
    const data = await res.json();
    content = data.choices?.[0]?.message?.content || '';
    inputTokens = data.usage?.prompt_tokens || 0;
    outputTokens = data.usage?.completion_tokens || 0;
  }

  return {
    content,
    model: effectiveModel,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    },
    latencyMs: Date.now() - startTime,
    provider: 'openai',
  };
}

/**
 * Call Google Gemini API
 * @private
 */
async function callGemini(model, systemPrompt, messages, config) {
  const startTime = Date.now();
  const apiKey = getApiKey('gemini');

  if (!apiKey) {
    throw new Error('Gemini API key missing. Set GEMINI_API_KEY.');
  }

  const effectiveModel = model || getDefaultModel('gemini');

  // Gemini uses a different structure
  const sanitizedMessages = sanitizeMessages(messages);
  const contents = sanitizedMessages.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  // Prepend system as first user message with synthetic acknowledgment
  if (systemPrompt) {
    contents.unshift({
      role: 'user',
      parts: [{ text: `[System Instructions]\n${sanitizeText(systemPrompt)}\n\n[End System Instructions]` }],
    });
    contents.splice(1, 0, {
      role: 'model',
      parts: [{ text: 'I understand and will follow these instructions.' }],
    });
  }

  const generationConfig = {
    temperature: config.temperature ?? 0.5,
    maxOutputTokens: config.maxTokens || 1000,
    topP: config.topP ?? 0.9,
  };

  // Add JSON mode for code review preset
  if (config.jsonMode) {
    generationConfig.responseMimeType = 'application/json';
  }

  const body = {
    contents,
    generationConfig,
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(`Gemini error: ${res.status} - ${error.error?.message || 'Unknown'}`);
  }

  const data = await res.json();

  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    model: effectiveModel,
    usage: {
      inputTokens: data.usageMetadata?.promptTokenCount || 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: data.usageMetadata?.totalTokenCount || 0,
    },
    latencyMs: Date.now() - startTime,
    provider: 'gemini',
  };
}

/**
 * Call a local OpenAI-compatible API (LM Studio, Ollama, etc.)
 * @private
 */
async function callLocal(model, systemPrompt, messages, config) {
  const startTime = Date.now();

  const baseUrl = process.env.LOCAL_AI_URL || 'http://localhost:1234';
  // Normalize: strip trailing slash, ensure /v1/chat/completions
  const endpoint = baseUrl.replace(/\/+$/, '').replace(/\/v1\/chat\/completions$/, '')
    + '/v1/chat/completions';

  const effectiveModel = model || 'local-model';

  const sanitizedMessages = sanitizeMessages(messages);
  const body = {
    model: effectiveModel,
    temperature: config.temperature ?? 0.7,
    max_tokens: config.maxTokens || 1000,
    messages: [
      { role: 'system', content: sanitizeText(systemPrompt) },
      ...sanitizedMessages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
    ],
  };
  if (config.onToken) body.stream = true;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    const msg = error.error?.message || error.message || 'Unknown';
    // Surface "no models loaded" as a specific code
    if (msg.toLowerCase().includes('no models loaded') || msg.toLowerCase().includes('no model')) {
      const err = new Error(`Local AI has no models loaded. Load a model in the developer page or run "lms load".`);
      err.code = 'LOCAL_AI_NO_MODEL';
      throw err;
    }
    throw new Error(`Local AI error: ${res.status} - ${msg}`);
  }

  let content, inputTokens, outputTokens;
  if (config.onToken) {
    const parsed = await parseSSEStream(res, { onToken: config.onToken, format: 'openai' });
    content = parsed.text || '';
    inputTokens = parsed.inputTokens || 0;
    outputTokens = parsed.outputTokens || 0;
  } else {
    const data = await res.json();
    content = data.choices?.[0]?.message?.content || '';
    inputTokens = data.usage?.prompt_tokens || 0;
    outputTokens = data.usage?.completion_tokens || 0;
  }

  return {
    content,
    model: effectiveModel,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    },
    latencyMs: Date.now() - startTime,
    provider: 'local',
  };
}

// ============================================================================
// Provider Dispatcher
// ============================================================================

const PROVIDER_MAP = {
  openrouter: callOpenRouter,
  anthropic: callAnthropic,
  claude: callAnthropic,  // alias
  openai: callOpenAI,
  gemini: callGemini,
  google: callGemini,  // alias
  local: callLocal,
  lmstudio: callLocal,  // alias
};

/**
 * Dispatch to the appropriate provider
 * @private
 */
async function dispatch(provider, model, systemPrompt, messages, config) {
  const normalizedProvider = provider?.toLowerCase() || getAvailableProvider();
  const callFn = PROVIDER_MAP[normalizedProvider];

  if (!callFn) {
    throw new Error(`Unknown provider: ${normalizedProvider}`);
  }

  return callFn(model, systemPrompt, messages, config);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Make an LLM call with normalized response
 *
 * @param {Object} options
 * @param {string} [options.provider] - Provider ID (auto-detected if omitted)
 * @param {string} [options.model] - Model ID (uses provider default if omitted)
 * @param {string} options.systemPrompt - System prompt
 * @param {Array<{role: string, content: string}>} options.messages - Conversation messages
 * @param {string} [options.preset] - Preset name (chat, direct, socratic, codeReview, deliberation)
 * @param {Object} [options.config] - Override preset config {temperature, maxTokens, topP}
 * @param {string} [options.userId] - User ID for logging (optional)
 * @param {string} [options.promptCategory] - Category for logging (optional)
 * @returns {Promise<AIResponse>}
 */
export async function call({
  provider,
  model,
  systemPrompt,
  messages,
  preset = 'direct',
  config = {},
  userId = null,
  promptCategory = null,
  onToken = null, // Streaming callback for token-by-token output
}) {
  // Merge preset config with overrides
  const presetConfig = PRESETS[preset] || PRESETS.direct;
  const finalConfig = {
    temperature: config.temperature ?? presetConfig.temperature,
    maxTokens: config.maxTokens ?? presetConfig.maxTokens,
    topP: config.topP ?? presetConfig.topP,
    jsonMode: config.jsonMode ?? false,
    onToken,
  };

  const startTime = Date.now();

  try {
    const response = await dispatch(provider, model, systemPrompt, messages, finalConfig);

    // Log successful interaction if userId provided
    if (userId) {
      logInteraction({
        userId,
        provider: response.provider,
        model: response.model,
        promptCategory: promptCategory || preset,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        latencyMs: response.latencyMs,
        success: true,
      });
    }

    return response;
  } catch (error) {
    // Log failed interaction if userId provided
    if (userId) {
      logInteraction({
        userId,
        provider: provider || 'unknown',
        model: model || 'unknown',
        promptCategory: promptCategory || preset,
        latencyMs: Date.now() - startTime,
        success: false,
        errorMessage: error.message,
      });
    }
    throw error;
  }
}

/**
 * Create a reusable LLM call function (factory pattern for deliberation service)
 *
 * @param {string} [provider] - Lock to specific provider (optional)
 * @returns {Function} - (model, systemPrompt, messages, options) => Promise<AIResponse>
 */
export function createCallFactory(provider = null) {
  return async (model, systemPrompt, messages, options = {}) => {
    return call({
      provider: provider || options.provider,
      model,
      systemPrompt,
      messages,
      preset: options.preset || 'deliberation',
      config: {
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        topP: options.topP,
      },
      userId: options.userId,
      promptCategory: options.promptCategory,
    });
  };
}

/**
 * Simple text generation (single prompt, no conversation history)
 *
 * @param {Object} options
 * @param {string} options.prompt - The prompt text
 * @param {string} [options.systemPrompt] - System prompt (optional)
 * @param {string} [options.provider] - Provider ID
 * @param {string} [options.model] - Model ID
 * @param {string} [options.preset] - Preset name
 * @param {Object} [options.config] - Config overrides
 * @returns {Promise<AIResponse>}
 */
export async function generateText({
  prompt,
  systemPrompt = '',
  provider,
  model,
  preset = 'direct',
  config = {},
}) {
  return call({
    provider,
    model,
    systemPrompt,
    messages: [{ role: 'user', content: prompt }],
    preset,
    config,
  });
}

/**
 * Check if a provider is available (has API key configured)
 *
 * @param {string} providerId - Provider ID to check
 * @returns {boolean}
 */
export function isProviderAvailable(providerId) {
  const keyName = providerId === 'anthropic' ? 'claude' : providerId;
  return Boolean(getApiKey(keyName));
}

/**
 * Get provider status for all providers
 *
 * @returns {Object} Map of provider IDs to status objects
 */
export function getProviderStatus() {
  const providers = ['gemini', 'openai', 'claude', 'openrouter'];
  const status = {};

  for (const provider of providers) {
    status[provider] = {
      configured: Boolean(getApiKey(provider)),
      model: getDefaultModel(provider),
    };
  }

  // Local provider is always "configured" (no API key needed)
  status.local = {
    configured: true,
    model: 'local-model',
    baseUrl: process.env.LOCAL_AI_URL || 'http://localhost:1234',
  };

  return status;
}

// ============================================================================
// Streaming API (async generator)
// ============================================================================

/**
 * Yield raw SSE events from a fetch Response body as an async generator.
 * @param {Response} response - fetch Response with streaming body
 * @yields {{event: string, data: string}} Raw SSE event objects
 * @private
 */
async function* iterateSSE(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === '') {
          currentEvent = '';
          continue;
        }
        if (trimmed.startsWith('event:')) {
          currentEvent = trimmed.slice(6).trim();
          continue;
        }
        if (trimmed.startsWith('data:')) {
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') continue;
          yield { event: currentEvent, data: dataStr };
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Build a streaming fetch request for a given provider and return the Response.
 * @private
 */
async function buildStreamRequest(provider, model, systemPrompt, messages, config) {
  const normalizedProvider = provider?.toLowerCase() || getAvailableProvider();
  const sanitizedMessages = sanitizeMessages(messages);

  switch (normalizedProvider) {
    case 'openrouter': {
      const apiKey = getApiKey('openrouter');
      if (!apiKey) throw new Error('OpenRouter API key missing. Set OPENROUTER_API_KEY.');
      const effectiveModel = model && model.includes('/') ? model : getDefaultModel('openrouter');
      return {
        response: await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://machinespirits.org',
            'X-Title': 'Machine Spirits',
          },
          body: JSON.stringify({
            model: effectiveModel,
            max_tokens: config.maxTokens || 1000,
            temperature: config.temperature ?? 0.7,
            stream: true,
            messages: [
              { role: 'system', content: sanitizeText(systemPrompt) },
              ...sanitizedMessages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
            ],
          }),
        }),
        format: 'openai',
        model: effectiveModel,
        provider: 'openrouter',
      };
    }

    case 'anthropic':
    case 'claude': {
      const apiKey = getApiKey('claude');
      if (!apiKey) throw new Error('Anthropic API key missing. Set ANTHROPIC_API_KEY.');
      const effectiveModel = model || getDefaultModel('claude');
      return {
        response: await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: effectiveModel,
            max_tokens: config.maxTokens || 1000,
            temperature: config.temperature ?? 0.5,
            stream: true,
            system: sanitizeText(systemPrompt),
            messages: sanitizedMessages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
          }),
        }),
        format: 'anthropic',
        model: effectiveModel,
        provider: 'anthropic',
      };
    }

    case 'openai': {
      const apiKey = getApiKey('openai');
      if (!apiKey) throw new Error('OpenAI API key missing. Set OPENAI_API_KEY.');
      const effectiveModel = model || getDefaultModel('openai');
      return {
        response: await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: effectiveModel,
            max_completion_tokens: config.maxTokens || 1000,
            temperature: config.temperature ?? 0.5,
            stream: true,
            messages: [
              { role: 'system', content: sanitizeText(systemPrompt) },
              ...sanitizedMessages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
            ],
          }),
        }),
        format: 'openai',
        model: effectiveModel,
        provider: 'openai',
      };
    }

    case 'gemini':
    case 'google': {
      const apiKey = getApiKey('gemini');
      if (!apiKey) throw new Error('Gemini API key missing. Set GEMINI_API_KEY.');
      const effectiveModel = model || getDefaultModel('gemini');
      const contents = sanitizedMessages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));
      if (systemPrompt) {
        contents.unshift({ role: 'user', parts: [{ text: `[System Instructions]\n${sanitizeText(systemPrompt)}\n\n[End System Instructions]` }] });
        contents.splice(1, 0, { role: 'model', parts: [{ text: 'I understand and will follow these instructions.' }] });
      }
      return {
        response: await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:streamGenerateContent?alt=sse&key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents,
              generationConfig: {
                temperature: config.temperature ?? 0.5,
                maxOutputTokens: config.maxTokens || 1000,
                topP: config.topP ?? 0.9,
              },
            }),
          }
        ),
        format: 'gemini',
        model: effectiveModel,
        provider: 'gemini',
      };
    }

    case 'local':
    case 'lmstudio': {
      const localBaseUrl = config.providerConfig?.base_url || process.env.LOCAL_AI_URL || 'http://localhost:1234';
      const endpoint = localBaseUrl.replace(/\/+$/, '').replace(/\/v1\/chat\/completions$/, '') + '/v1/chat/completions';
      const effectiveModel = model || 'local-model';
      const localHeaders = { 'Content-Type': 'application/json' };
      const localApiKey = config.providerConfig?.apiKey;
      if (localApiKey) localHeaders['Authorization'] = `Bearer ${localApiKey}`;
      return {
        response: await fetch(endpoint, {
          method: 'POST',
          headers: localHeaders,
          body: JSON.stringify({
            model: effectiveModel,
            temperature: config.temperature ?? 0.7,
            max_tokens: config.maxTokens || 1000,
            stream: true,
            messages: [
              { role: 'system', content: sanitizeText(systemPrompt) },
              ...sanitizedMessages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
            ],
          }),
        }),
        format: 'openai',
        model: effectiveModel,
        provider: normalizedProvider,
      };
    }

    default:
      throw new Error(`Unknown provider for streaming: ${normalizedProvider}`);
  }
}

/**
 * Stream an LLM response as an async generator yielding normalized chunks.
 *
 * Chunk types:
 *   { type: 'text_delta', content: '...' }
 *   { type: 'done', content: 'full text', usage: {...}, latencyMs, provider, model }
 *
 * @param {Object} options - Same as call() options
 * @yields {{type: string, content: string, usage?: Object, latencyMs?: number, provider?: string, model?: string}}
 */
export async function* callStream({
  provider,
  model,
  systemPrompt,
  messages,
  preset = 'direct',
  config = {},
}) {
  const presetConfig = PRESETS[preset] || PRESETS.direct;
  const finalConfig = {
    temperature: config.temperature ?? presetConfig.temperature,
    maxTokens: config.maxTokens ?? presetConfig.maxTokens,
    topP: config.topP ?? presetConfig.topP,
  };

  const startTime = Date.now();
  const { response, format, model: effectiveModel, provider: effectiveProvider } =
    await buildStreamRequest(provider, model, systemPrompt, messages, finalConfig);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`${effectiveProvider} streaming error: ${response.status} - ${error.error?.message || 'Unknown'}`);
  }

  const chunks = [];
  let inputTokens = 0;
  let outputTokens = 0;

  for await (const { event, data } of iterateSSE(response)) {
    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch {
      continue;
    }

    let token = null;

    if (format === 'anthropic') {
      // Anthropic: content_block_delta events carry text
      if (event === 'content_block_delta' && parsed?.delta?.text) {
        token = parsed.delta.text;
      }
      // Usage from message_start / message_delta
      if (event === 'message_start' && parsed?.message?.usage) {
        inputTokens = parsed.message.usage.input_tokens || 0;
      }
      if (event === 'message_delta' && parsed?.usage) {
        outputTokens = parsed.usage.output_tokens || 0;
      }
    } else if (format === 'gemini') {
      // Gemini: each chunk has candidates[0].content.parts[0].text
      const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) token = text;
      // Usage metadata
      if (parsed?.usageMetadata) {
        inputTokens = parsed.usageMetadata.promptTokenCount || inputTokens;
        outputTokens = parsed.usageMetadata.candidatesTokenCount || outputTokens;
      }
    } else {
      // OpenAI-compatible (openai, openrouter, local)
      const content = parsed?.choices?.[0]?.delta?.content;
      if (content) token = content;
      // Some providers include usage in final chunk
      if (parsed?.usage) {
        inputTokens = parsed.usage.prompt_tokens || inputTokens;
        outputTokens = parsed.usage.completion_tokens || outputTokens;
      }
    }

    if (token) {
      chunks.push(token);
      yield { type: 'text_delta', content: token };
    }
  }

  const fullText = chunks.join('');
  yield {
    type: 'done',
    content: fullText,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    },
    latencyMs: Date.now() - startTime,
    provider: effectiveProvider,
    model: effectiveModel,
  };
}

export default {
  call,
  callStream,
  createCallFactory,
  generateText,
  getAvailableProvider,
  isProviderAvailable,
  getProviderStatus,
  PRESETS,
};
