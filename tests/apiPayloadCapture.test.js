import test from 'node:test';
import assert from 'node:assert/strict';
import { attachApiPayloadsToTrace } from '../services/apiPayloadCapture.js';

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
      url: 'https://openrouter.ai/api/v1/chat/completions',
      method: 'POST',
      generationId: 'gen-1',
      request: { headers: {}, body: { model: 'nvidia/nemotron-3-nano-30b-a3b' } },
      response: { status: 200, ok: true, headers: {}, json: { id: 'gen-1', choices: [{ message: { content: 'ok' } }] } },
      error: null,
    },
  ];

  const enriched = attachApiPayloadsToTrace(trace, records);
  assert.ok(enriched[0].apiPayload, 'expected apiPayload on trace entry');
  assert.equal(enriched[0].apiPayload.matchReason, 'generation_id');
  assert.equal(enriched[0].apiPayload.generationId, 'gen-1');
  assert.equal(enriched[0].apiPayload.request.body.model, 'nvidia/nemotron-3-nano-30b-a3b');
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
