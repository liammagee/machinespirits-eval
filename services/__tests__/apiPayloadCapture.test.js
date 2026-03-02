import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// We must set up the global fetch mock BEFORE importing the module, or at least before it wraps fetch.
// Actually, since the module lazily wraps on first use, we can just set a dynamic mock.
let currentMockResponse = null;
let fetchWasCalled = false;
let currentMockError = null;

const originalGlobalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  fetchWasCalled = true;
  if (currentMockError) throw currentMockError;
  return currentMockResponse || new Response('{}', { status: 200 });
};

import { captureApiCalls, setGlobalOnRecord, attachApiPayloadsToTrace } from '../apiPayloadCapture.js';

describe('apiPayloadCapture', () => {

  beforeEach(() => {
    currentMockResponse = new Response('{}', { status: 200 });
    currentMockError = null;
    fetchWasCalled = false;
  });

  afterEach(() => {
    setGlobalOnRecord(null); // Cleanup global handler
  });

  it('bypasses capture if disabled', async () => {
    const { records, result } = await captureApiCalls(async () => {
      await fetch('https://api.openai.com/v1/chat/completions');
      return 42;
    }, { enabled: false });

    assert.equal(result, 42);
    assert.deepEqual(records, []);
  });

  it('captures API calls within scope', async () => {
    currentMockResponse = new Response(JSON.stringify({ id: 'gen-123', choices: [] }), { 
        status: 200, 
        headers: { 'content-type': 'application/json' } 
    });

    const { records, result } = await captureApiCalls(async () => {
      await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer secret',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ model: 'test-model', messages: [] })
      });
      return 'done';
    });

    assert.equal(result, 'done');
    assert.equal(records.length, 1);
    const rec = records[0];
    assert.equal(rec.provider, 'openrouter');
    assert.equal(rec.method, 'POST');
    assert.equal(rec.generationId, 'gen-123');
    assert.equal(rec.request.headers.authorization, '[REDACTED]');
    assert.equal(rec.request.body.model, 'test-model');
    assert.equal(rec.response.status, 200);
    assert.equal(rec.response.json.id, 'gen-123');
  });

  it('triggers globalOnRecord for scoped and unscoped calls', async () => {
    let captured = null;
    setGlobalOnRecord((rec) => {
      captured = rec;
    });

    await fetch('https://api.anthropic.com/v1/messages');
    assert.ok(captured);
    assert.equal(captured.provider, 'anthropic');
    
    captured = null;

    await captureApiCalls(async () => {
      await fetch('https://api.openai.com/v1/chat');
    });
    
    assert.ok(captured);
    assert.equal(captured.provider, 'openai');
  });

  it('only captures supported LLM provider URLs', async () => {
    const { records } = await captureApiCalls(async () => {
      await fetch('https://example.com/api/data'); 
      await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent'); 
    });

    assert.equal(records.length, 1);
    assert.equal(records[0].provider, 'gemini');
  });

  it('attaches payloads to trace by generation_id', () => {
    const records = [
      {
        timestamp: '2023-01-01',
        durationMs: 100,
        provider: 'openrouter',
        generationId: 'gen-123',
        request: { method: 'POST', headers: {}, body: {} },
        response: { status: 200 }
      }
    ];

    const trace = [
      { agent: 'ego', action: 'generate', metrics: { generationId: 'gen-123' } }
    ];

    const result = attachApiPayloadsToTrace(trace, records);
    assert.equal(result.length, 1);
    assert.ok(result[0].apiPayload);
    assert.equal(result[0].apiPayload.matchReason, 'generation_id');
  });

  it('attaches payloads to trace by heuristic fallback', () => {
    const records = [
      {
        timestamp: '2023-01-01',
        durationMs: 100,
        provider: 'anthropic',
        request: { body: { model: 'claude-3' } }
      }
    ];

    const trace = [
      { agent: 'superego', action: 'review', metrics: { model: 'claude-3' } }
    ];

    const result = attachApiPayloadsToTrace(trace, records);
    assert.equal(result.length, 1);
    assert.ok(result[0].apiPayload);
    assert.equal(result[0].apiPayload.matchReason, 'heuristic_model_order');
  });

  it('does not attach payloads to non-tutor trace entries', () => {
    const records = [{ generationId: 'gen-123' }];
    const trace = [
      { agent: 'user', action: 'say', metrics: { generationId: 'gen-123' } }
    ];

    const result = attachApiPayloadsToTrace(trace, records);
    assert.equal(result[0].apiPayload, undefined);
  });
  
  it('truncates large payloads correctly', async () => {
    currentMockResponse = new Response(JSON.stringify({ text: 'a'.repeat(200) }));

    const { records } = await captureApiCalls(async () => {
      await fetch('https://api.openai.com/v1/chat', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'b'.repeat(200) })
      });
    }, { maxChars: 50 });

    const rec = records[0];
    assert.ok(typeof rec.request.body === 'string');
    assert.ok(rec.request.body.includes('... [truncated'));
    assert.ok(typeof rec.response.json.text === 'string');
    assert.ok(rec.response.json.text.includes('... [truncated'));
  });
  
  it('handles fetch errors correctly', async () => {
    currentMockError = new Error('Network failure');
    
    try {
      await captureApiCalls(async () => {
        await fetch('https://api.openai.com/v1/chat');
      });
      assert.fail('Should have thrown');
    } catch (err) {
      assert.equal(err.message, 'Network failure');
    }
  });
});