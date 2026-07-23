import test from 'node:test';
import assert from 'node:assert/strict';
import { attachApiPayloadsToTrace, captureApiCalls } from '../services/apiPayloadCapture.js';

test('attachApiPayloadsToTrace attaches payloads by generationId', () => {
  const trace = [
    {
      agent: 'ego',
      action: 'generate',
      metrics: { model: 'nvidia/nemotron-3-nano-30b-a3b', provider: 'openrouter', generationId: 'gen-1' },
    },
  ];
  const records = [
    {
      timestamp: '2026-02-25T00:00:00.000Z',
      durationMs: 111,
      provider: 'openrouter',
      url: 'https://openrouter.ai/api/v1/chat/completions?token=trace-secret',
      method: 'POST',
      generationId: 'gen-1',
      request: { headers: {}, body: { model: 'nvidia/nemotron-3-nano-30b-a3b' } },
      response: {
        status: 200,
        ok: true,
        headers: {},
        json: { id: 'gen-1', choices: [{ message: { content: 'ok' } }] },
      },
      error: null,
    },
  ];

  const enriched = attachApiPayloadsToTrace(trace, records);
  assert.ok(enriched[0].apiPayload, 'expected apiPayload on trace entry');
  assert.equal(enriched[0].apiPayload.matchReason, 'generation_id');
  assert.equal(enriched[0].apiPayload.generationId, 'gen-1');
  assert.equal(enriched[0].apiPayload.request.body.model, 'nvidia/nemotron-3-nano-30b-a3b');
  assert.doesNotMatch(enriched[0].apiPayload.endpoint, /trace-secret/u);
  assert.equal(new URL(enriched[0].apiPayload.endpoint).searchParams.get('token'), '[REDACTED]');
});

test('attachApiPayloadsToTrace falls back to model/provider heuristic', () => {
  const trace = [
    {
      agent: 'superego',
      action: 'review',
      metrics: { model: 'moonshotai/kimi-k2.5', provider: 'openrouter' },
    },
  ];
  const records = [
    {
      timestamp: '2026-02-25T00:00:00.000Z',
      durationMs: 222,
      provider: 'openrouter',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      method: 'POST',
      generationId: null,
      request: { headers: {}, body: { model: 'moonshotai/kimi-k2.5' } },
      response: { status: 200, ok: true, headers: {}, json: { choices: [{ message: { content: 'review' } }] } },
      error: null,
    },
  ];

  const enriched = attachApiPayloadsToTrace(trace, records);
  assert.ok(enriched[0].apiPayload, 'expected apiPayload on trace entry');
  assert.equal(enriched[0].apiPayload.matchReason, 'heuristic_model_order');
  assert.equal(enriched[0].apiPayload.provider, 'openrouter');
});

test('captureApiCalls preserves response body while redacting sensitive URL parameters from records and traces', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  let fetchedUrl = null;
  globalThis.fetch = async (input) => {
    fetchedUrl = String(input);
    return new Response(
      JSON.stringify({
        id: 'gen-replay',
        choices: [{ message: { content: 'caller can still read me' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  };

  const { result, records } = await captureApiCalls(async () => {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/test:generateContent?alt=json&key=supersecret',
      {
        method: 'POST',
        body: JSON.stringify({ model: 'test/model' }),
      },
    );
    const payload = await response.json();
    return payload.choices[0].message.content;
  });

  assert.equal(result, 'caller can still read me');
  assert.equal(records.length, 1);
  assert.equal(records[0].generationId, 'gen-replay');
  assert.equal(records[0].response.json.choices[0].message.content, 'caller can still read me');
  assert.match(fetchedUrl, /key=supersecret/u, 'the original request should still receive the credential');
  assert.doesNotMatch(records[0].url, /supersecret/u);
  assert.equal(new URL(records[0].url).searchParams.get('key'), '[REDACTED]');

  const [enriched] = attachApiPayloadsToTrace(
    [
      {
        agent: 'ego',
        action: 'generate',
        metrics: { provider: 'gemini', model: 'test/model', generationId: 'gen-replay' },
      },
    ],
    records,
  );
  assert.doesNotMatch(enriched.apiPayload.endpoint, /supersecret/u);
  assert.equal(new URL(enriched.apiPayload.endpoint).searchParams.get('key'), '[REDACTED]');
});
