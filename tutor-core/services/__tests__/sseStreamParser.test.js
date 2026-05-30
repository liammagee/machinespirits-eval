import { describe, it, expect, vi } from 'vitest';
import { parseSSEStream } from '../sseStreamParser.js';

/**
 * Helper: create a mock fetch Response with a readable stream body
 * from an array of SSE text chunks.
 */
function mockResponse(chunks) {
  const encoder = new TextEncoder();
  let index = 0;

  const readableStream = new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });

  return { body: readableStream };
}

describe('parseSSEStream', () => {
  describe('OpenAI format', () => {
    it('should parse token deltas and concatenate full text', async () => {
      const response = mockResponse([
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
        'data: [DONE]\n\n',
      ]);

      const result = await parseSSEStream(response, { format: 'openai' });
      expect(result.text).toBe('Hello world');
    });

    it('should fire onToken for each delta', async () => {
      const tokens = [];
      const response = mockResponse([
        'data: {"choices":[{"delta":{"content":"A"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"B"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"C"}}]}\n\n',
        'data: [DONE]\n\n',
      ]);

      await parseSSEStream(response, {
        onToken: (t) => tokens.push(t),
        format: 'openai',
      });

      expect(tokens).toEqual(['A', 'B', 'C']);
    });

    it('should fire onDone with complete text', async () => {
      const onDone = vi.fn();
      const response = mockResponse([
        'data: {"choices":[{"delta":{"content":"done"}}]}\n\n',
        'data: [DONE]\n\n',
      ]);

      await parseSSEStream(response, { onDone, format: 'openai' });
      expect(onDone).toHaveBeenCalledWith('done');
    });

    it('should extract usage from final chunk', async () => {
      const response = mockResponse([
        'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
        'data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5}}\n\n',
        'data: [DONE]\n\n',
      ]);

      const result = await parseSSEStream(response, { format: 'openai' });
      expect(result.text).toBe('Hi');
      expect(result.inputTokens).toBe(10);
      expect(result.outputTokens).toBe(5);
    });

    it('should handle empty delta objects gracefully', async () => {
      const response = mockResponse([
        'data: {"choices":[{"delta":{}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
        'data: [DONE]\n\n',
      ]);

      const result = await parseSSEStream(response, { format: 'openai' });
      expect(result.text).toBe('ok');
    });

    it('should skip non-JSON data lines', async () => {
      const response = mockResponse([
        ': comment line\n\n',
        'data: not-json\n\n',
        'data: {"choices":[{"delta":{"content":"valid"}}]}\n\n',
        'data: [DONE]\n\n',
      ]);

      const result = await parseSSEStream(response, { format: 'openai' });
      expect(result.text).toBe('valid');
    });

    it('should handle chunks split across boundaries', async () => {
      // Simulate a chunk that arrives split mid-line
      const response = mockResponse([
        'data: {"choices":[{"del',
        'ta":{"content":"split"}}]}\n\ndata: [DONE]\n\n',
      ]);

      const result = await parseSSEStream(response, { format: 'openai' });
      expect(result.text).toBe('split');
    });
  });

  describe('Anthropic format', () => {
    it('should parse content_block_delta events', async () => {
      const response = mockResponse([
        'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":25}}}\n\n',
        'event: content_block_start\ndata: {"type":"content_block_start","index":0}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"text":"Hello"}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"text":" there"}}\n\n',
        'event: content_block_stop\ndata: {"type":"content_block_stop"}\n\n',
        'event: message_delta\ndata: {"type":"message_delta","usage":{"output_tokens":8}}\n\n',
        'event: message_stop\ndata: {"type":"message_stop"}\n\n',
      ]);

      const result = await parseSSEStream(response, { format: 'anthropic' });
      expect(result.text).toBe('Hello there');
      expect(result.inputTokens).toBe(25);
      expect(result.outputTokens).toBe(8);
    });

    it('should fire onToken per content delta', async () => {
      const tokens = [];
      const response = mockResponse([
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"text":"X"}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"text":"Y"}}\n\n',
      ]);

      await parseSSEStream(response, {
        onToken: (t) => tokens.push(t),
        format: 'anthropic',
      });

      expect(tokens).toEqual(['X', 'Y']);
    });

    it('should ignore non-content events', async () => {
      const response = mockResponse([
        'event: ping\ndata: {"type":"ping"}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"text":"real"}}\n\n',
      ]);

      const result = await parseSSEStream(response, { format: 'anthropic' });
      expect(result.text).toBe('real');
    });
  });

  describe('edge cases', () => {
    it('should return empty string for empty stream', async () => {
      const response = mockResponse([]);
      const result = await parseSSEStream(response, { format: 'openai' });
      expect(result.text).toBe('');
      expect(result.inputTokens).toBeUndefined();
      expect(result.outputTokens).toBeUndefined();
    });

    it('should default to openai format', async () => {
      const response = mockResponse([
        'data: {"choices":[{"delta":{"content":"default"}}]}\n\n',
        'data: [DONE]\n\n',
      ]);

      const result = await parseSSEStream(response);
      expect(result.text).toBe('default');
    });

    it('should work without onToken callback', async () => {
      const response = mockResponse([
        'data: {"choices":[{"delta":{"content":"no callback"}}]}\n\n',
        'data: [DONE]\n\n',
      ]);

      const result = await parseSSEStream(response, { format: 'openai' });
      expect(result.text).toBe('no callback');
    });
  });
});
