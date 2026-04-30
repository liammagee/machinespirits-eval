// Dispatcher between mock and real LLM backends for the adaptive cell.
//
// Default is mock so smoke tests, CI, and local development cost nothing
// and stay deterministic. Set ADAPTIVE_TUTOR_LLM=real (and provide the
// usual provider env vars, e.g. OPENROUTER_API_KEY) to hit a real model.
//
// Graph nodes always import callRole from this file — never directly from
// mockLLM or realLLM — so the swap point lives in exactly one place.

import * as mock from './mockLLM.js';
import * as real from './realLLM.js';

const mode = () => (process.env.ADAPTIVE_TUTOR_LLM || 'mock').toLowerCase();

export async function callRole(role, payload) {
  const m = mode();
  if (m === 'mock') return mock.callRole(role, payload);
  if (m === 'real') return real.callRole(role, payload);
  throw new Error(`adaptiveTutor.llm: unknown ADAPTIVE_TUTOR_LLM mode '${m}' (expected 'mock' or 'real')`);
}

export function llmMode() {
  return mode();
}
