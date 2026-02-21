#!/usr/bin/env node
import 'dotenv/config';
import { resolveModel } from '../services/evalConfigLoader.js';
/**
 * Quick rate-limit probe for OpenRouter models.
 * Usage: node scripts/test-rate-limit.js [model-alias]
 * Default: nemotron
 * Resolves model aliases through providers.yaml (e.g. nemotron → full model ID).
 */

const alias = process.argv[2] || 'nemotron';
// Resolve through providers.yaml — "nemotron" → "openrouter.nemotron" → full ID
const ref = alias.includes('.') ? alias : `openrouter.${alias}`;
let model;
try {
  const resolved = resolveModel(ref);
  model = resolved.model;
} catch {
  // Pass through as-is if not a known alias (e.g. a full model ID)
  model = alias;
}
const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  console.error('OPENROUTER_API_KEY not set');
  process.exit(1);
}

function formatReset(resetValue) {
  const ts = Number(resetValue);
  if (!ts || isNaN(ts)) return resetValue;
  const resetDate = new Date(ts);
  const now = new Date();
  const diffMs = resetDate - now;
  const local = resetDate.toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' });
  if (diffMs <= 0) return `${local} AEDT (already passed)`;
  const mins = Math.ceil(diffMs / 60000);
  if (mins < 60) return `${local} AEDT (in ${mins}m)`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${local} AEDT (in ${hrs}h ${remMins}m)`;
}

async function probe() {
  console.log(`Probing ${alias} (${model})...\n`);
  const start = Date.now();

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Say "hello" and nothing else.' }],
      max_tokens: 10,
    }),
  });

  const elapsed = Date.now() - start;
  const headers = Object.fromEntries(res.headers.entries());

  // Rate limit headers
  const rl = {
    limit: headers['x-ratelimit-limit-requests'] || headers['x-ratelimit-limit'] || '?',
    remaining: headers['x-ratelimit-remaining-requests'] || headers['x-ratelimit-remaining'] || '?',
    reset: headers['x-ratelimit-reset-requests'] || headers['x-ratelimit-reset'] || '?',
  };

  const body = await res.json();

  console.log(`Status: ${res.status} (${elapsed}ms)`);
  console.log(`Rate limit: ${rl.remaining}/${rl.limit} remaining`);
  console.log(`Resets: ${formatReset(rl.reset)}`);

  if (res.status === 429) {
    console.log('\n*** RATE LIMITED ***');
    console.log('Error:', body.error?.message || JSON.stringify(body));
    process.exit(2);
  }

  if (res.status !== 200) {
    console.log('\nError:', body.error?.message || JSON.stringify(body));
    process.exit(1);
  }

  const reply = body.choices?.[0]?.message?.content || '(empty)';
  const usage = body.usage || {};
  console.log(`Reply: "${reply.trim()}"`);
  console.log(`Tokens: ${usage.prompt_tokens || '?'} in / ${usage.completion_tokens || '?'} out`);
  if (body.id) console.log(`Request ID: ${body.id}`);
}

probe().catch((err) => {
  console.error('Fetch error:', err.message);
  process.exit(1);
});
