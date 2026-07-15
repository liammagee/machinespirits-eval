#!/usr/bin/env node

import 'dotenv/config';
import { parseArgs } from 'node:util';

import {
  DEFAULT_TUTOR_STUB_VOICE_MODEL,
  DEFAULT_TUTOR_STUB_VOICE_NAME,
  buildTutorStubRealtimeSession,
} from '../services/tutorStubVoiceBridge.js';

const { values: args } = parseArgs({
  options: {
    model: { type: 'string', default: process.env.TUTOR_STUB_VOICE_MODEL || DEFAULT_TUTOR_STUB_VOICE_MODEL },
    voice: { type: 'string', default: process.env.TUTOR_STUB_VOICE_NAME || DEFAULT_TUTOR_STUB_VOICE_NAME },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (args.help) {
  console.log(`Usage: node scripts/smoke-tutor-stub-realtime.js [--model gpt-realtime-2.1-mini] [--voice marin]

Creates a short-lived Realtime client secret to verify the API key and the exact
tutor-stub voice session configuration. It never prints either credential.`);
  process.exit(0);
}

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not configured');
}

const session = buildTutorStubRealtimeSession({ model: args.model, voice: args.voice });
const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
  method: 'POST',
  headers: {
    authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    session,
    expires_after: {
      anchor: 'created_at',
      seconds: 60,
    },
  }),
});
const requestId = response.headers.get('x-request-id');
const responseText = await response.text();
let body;
try {
  body = JSON.parse(responseText);
} catch {
  body = { error: { message: responseText } };
}
if (!response.ok) {
  const error = new Error(body?.error?.message || `Realtime credential smoke failed with HTTP ${response.status}`);
  error.requestId = requestId;
  throw error;
}
if (!body?.value) throw new Error('Realtime credential response did not include an ephemeral client secret');

console.log(
  JSON.stringify(
    {
      ok: true,
      model: session.model,
      voice: session.audio.output.voice,
      transcriptionModel: session.audio.input.transcription.model,
      automaticResponses: session.audio.input.turn_detection.create_response,
      ephemeralCredentialIssued: true,
      expiresAt: body.expires_at || null,
      requestId,
    },
    null,
    2,
  ),
);
