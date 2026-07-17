import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_TUTOR_STUB_VOICE_MODEL,
  TUTOR_STUB_VOICE_BRIDGE_SCHEMA,
  buildTutorStubRealtimeSession,
  createTutorStubVoiceBridge,
  renderTutorStubVoiceHtml,
} from '../services/tutorStubVoiceBridge.js';

test('voice session keeps Realtime transcription and audio separate from tutor authority', () => {
  const session = buildTutorStubRealtimeSession();

  assert.equal(session.type, 'realtime');
  assert.equal(session.model, DEFAULT_TUTOR_STUB_VOICE_MODEL);
  assert.deepEqual(session.output_modalities, ['audio']);
  assert.equal(session.audio.input.transcription.model, 'gpt-realtime-whisper');
  assert.equal(session.audio.input.turn_detection.create_response, false);
  assert.equal(session.audio.input.turn_detection.interrupt_response, false);
  assert.match(session.instructions, /Never answer the microphone input/u);
  assert.match(session.instructions, /approved tutor text/u);
});

test('voice companion explains the authoritative CLI path and implements barge-in', () => {
  const html = renderTutorStubVoiceHtml();

  assert.match(html, /same learner turn used by the CLI/u);
  assert.match(html, /response\.cancel/u);
  assert.match(html, /conversation\.item\.input_audio_transcription\.completed/u);
  assert.match(html, /\/api\/learner/u);
  assert.match(html, /Speak exactly the approved tutor text/u);
  assert.doesNotMatch(html, /OPENAI_API_KEY/u);
});

test('voice bridge requires its local bearer token and publishes approved tutor text', async () => {
  const bridge = createTutorStubVoiceBridge({ apiKey: 'test-key', runId: 'voice-test' });
  const started = await bridge.start();
  try {
    assert.equal(started.schema, TUTOR_STUB_VOICE_BRIDGE_SCHEMA);
    assert.match(started.url, /^http:\/\/127\.0\.0\.1:\d+\/voice\?token=/u);

    const denied = await fetch(started.url.replace(/\?token=.*/u, ''));
    assert.equal(denied.status, 403);

    const allowed = await fetch(started.url);
    assert.equal(allowed.status, 200);
    assert.match(await allowed.text(), /Tutor Stub Voice/u);

    const delivery = bridge.publishTutor({
      text: 'Only this accepted tutor line should be voiced.',
      turn: 2,
      turnId: 'run:t002',
    });
    assert.equal(delivery.text, 'Only this accepted tutor line should be voiced.');
    assert.equal(bridge.snapshot().tutorDeliveries, 1);
    assert.match(bridge.snapshot().url, /token=\[redacted\]/u);
  } finally {
    await bridge.stop('test_complete');
  }
});

test('voice bridge forwards SDP with the standard key only from the local server', async () => {
  let upstreamRequest = null;
  const fetchImpl = async (url, options) => {
    upstreamRequest = { url, options };
    return new Response('v=0\r\no=answer', {
      status: 200,
      headers: { 'content-type': 'application/sdp', 'x-request-id': 'req_voice_test' },
    });
  };
  const bridge = createTutorStubVoiceBridge({
    apiKey: 'server-only-key',
    fetchImpl,
    runId: 'voice-offer-test',
  });
  const started = await bridge.start();
  try {
    const url = new URL(started.url);
    url.pathname = '/api/realtime/calls';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/sdp' },
      body: 'v=0\r\no=offer',
    });

    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'v=0\r\no=answer');
    assert.equal(upstreamRequest.url, 'https://api.openai.com/v1/realtime/calls');
    assert.equal(upstreamRequest.options.headers.authorization, 'Bearer server-only-key');
    assert.equal(upstreamRequest.options.body.get('session') instanceof Blob, true);
    const session = JSON.parse(await upstreamRequest.options.body.get('session').text());
    assert.equal(session.audio.input.turn_detection.create_response, false);
    assert.equal(session.audio.output.voice, 'marin');
  } finally {
    await bridge.stop('test_complete');
  }
});

test('voice transcription callback receives the public speech fragment', async () => {
  const received = [];
  const bridge = createTutorStubVoiceBridge({
    apiKey: 'test-key',
    onLearnerTranscript: async (entry) => {
      received.push(entry);
      return { route: 'compound_learner_turn' };
    },
  });
  const started = await bridge.start();
  try {
    const url = new URL(started.url);
    url.pathname = '/api/learner';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Wait, I also meant the visitor log.', itemId: 'item_123' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 202);
    assert.equal(payload.result.route, 'compound_learner_turn');
    assert.equal(received.length, 1);
    assert.equal(received[0].text, 'Wait, I also meant the visitor log.');
    assert.equal(received[0].itemId, 'item_123');
    assert.equal(received[0].source, 'openai_realtime_transcription');
  } finally {
    await bridge.stop('test_complete');
  }
});

test('voice bridge audits the spoken transcript against the accepted tutor text', async () => {
  const audits = [];
  const bridge = createTutorStubVoiceBridge({
    apiKey: 'test-key',
    runId: 'voice-spoken-audit',
    onSpokenTranscript: async (audit) => {
      audits.push(audit);
      return { stored: true };
    },
  });
  const started = await bridge.start();
  try {
    const delivery = bridge.publishTutor({ text: 'Keep this exact accepted wording.' });
    const url = new URL(started.url);
    url.pathname = '/api/spoken';
    const exact = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deliveryId: delivery.deliveryId, transcript: 'Keep this exact accepted wording.' }),
    });
    const changed = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deliveryId: delivery.deliveryId, transcript: 'A changed paraphrase.' }),
    });

    assert.equal((await exact.json()).matchesCanonical, true);
    assert.equal((await changed.json()).matchesCanonical, false);
    assert.deepEqual(
      audits.map((audit) => audit.matchesCanonical),
      [true, false],
    );
  } finally {
    await bridge.stop('test_complete');
  }
});
