/**
 * SSE Stream Parser
 *
 * Parses Server-Sent Events (SSE) from LLM API streaming responses.
 * Supports both OpenAI-compatible and Anthropic SSE formats.
 *
 * Usage:
 *   const result = await parseSSEStream(response, {
 *     onToken: (token) => process.stdout.write(token),
 *     format: 'openai', // or 'anthropic'
 *   });
 *   // result = { text, inputTokens, outputTokens }
 */

/**
 * Parse an SSE stream from a fetch Response, firing onToken per text delta.
 *
 * @param {Response} response - fetch() Response with streaming body
 * @param {Object} options
 * @param {Function} [options.onToken] - Called with each text delta string
 * @param {Function} [options.onDone] - Called when stream completes
 * @param {'openai'|'anthropic'} [options.format='openai'] - SSE format to parse
 * @returns {Promise<{text: string, inputTokens: number|undefined, outputTokens: number|undefined}>}
 */
export async function parseSSEStream(response, options = {}) {
  const { onToken, onDone, format = 'openai' } = options;

  const chunks = [];
  let inputTokens;
  let outputTokens;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines from the buffer
      const lines = buffer.split('\n');
      // Keep the last (possibly incomplete) line in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();

        // Empty line = end of event block
        if (trimmed === '') {
          currentEvent = '';
          continue;
        }

        // Track event type (Anthropic format uses event: lines)
        if (trimmed.startsWith('event:')) {
          currentEvent = trimmed.slice(6).trim();
          continue;
        }

        // Data lines
        if (trimmed.startsWith('data:')) {
          const dataStr = trimmed.slice(5).trim();

          // [DONE] sentinel (OpenAI/OpenRouter)
          if (dataStr === '[DONE]') {
            continue;
          }

          let parsed;
          try {
            parsed = JSON.parse(dataStr);
          } catch {
            // Non-JSON data line — skip
            continue;
          }

          if (format === 'anthropic') {
            const token = extractAnthropicToken(parsed, currentEvent);
            if (token) {
              chunks.push(token);
              onToken?.(token);
            }
            // Extract usage from message_delta or message_stop events
            const usage = extractAnthropicUsage(parsed, currentEvent);
            if (usage) {
              if (usage.inputTokens !== undefined) inputTokens = usage.inputTokens;
              if (usage.outputTokens !== undefined) outputTokens = usage.outputTokens;
            }
          } else {
            // OpenAI-compatible format (openai, openrouter, local)
            const token = extractOpenAIToken(parsed);
            if (token) {
              chunks.push(token);
              onToken?.(token);
            }
            // Extract usage if present in the chunk (some providers include it)
            const usage = extractOpenAIUsage(parsed);
            if (usage) {
              if (usage.inputTokens !== undefined) inputTokens = usage.inputTokens;
              if (usage.outputTokens !== undefined) outputTokens = usage.outputTokens;
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  const text = chunks.join('');
  onDone?.(text);

  return { text, inputTokens, outputTokens };
}

/**
 * Extract text token from an Anthropic SSE event.
 * Anthropic streams content_block_delta events with delta.text.
 */
function extractAnthropicToken(data, eventType) {
  if (eventType === 'content_block_delta' && data?.delta?.text) {
    return data.delta.text;
  }
  return null;
}

/**
 * Extract usage statistics from Anthropic SSE events.
 * Usage arrives in message_start (input) and message_delta (output) events.
 */
function extractAnthropicUsage(data, eventType) {
  if (eventType === 'message_start' && data?.message?.usage) {
    return { inputTokens: data.message.usage.input_tokens };
  }
  if (eventType === 'message_delta' && data?.usage) {
    return { outputTokens: data.usage.output_tokens };
  }
  return null;
}

/**
 * Extract text token from an OpenAI-compatible SSE chunk.
 * OpenAI/OpenRouter/local stream choices[0].delta.content.
 */
function extractOpenAIToken(data) {
  const content = data?.choices?.[0]?.delta?.content;
  if (content) return content;
  return null;
}

/**
 * Extract usage statistics from an OpenAI-compatible SSE chunk.
 * Some providers include usage in the final chunk.
 */
function extractOpenAIUsage(data) {
  if (data?.usage) {
    return {
      inputTokens: data.usage.prompt_tokens,
      outputTokens: data.usage.completion_tokens,
    };
  }
  return null;
}
