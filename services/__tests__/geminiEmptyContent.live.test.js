/**
 * Live integration test: Gemini Flash empty content reproduction.
 *
 * Calls OpenRouter with google/gemini-3-flash-preview to detect the
 * empty-content-with-stop-finish pattern observed in production.
 * The issue manifests as HTTP 200 with finish_reason=stop but empty
 * content and 0 output tokens, typically with longer system prompts
 * (~5000+ input tokens).
 *
 * Requires OPENROUTER_API_KEY in environment (loaded from .env).
 * Run: node --test services/__tests__/geminiEmptyContent.live.test.js
 *
 * This test is NOT included in `npm test` — it makes real API calls.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { callLearnerAI } from '../learnerTutorInteractionEngine.js';
import { getProviderConfig, resolveModel } from '../learnerConfigLoader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const GEMINI_MODEL_ALIAS = 'openrouter.gemini-flash';
const N_ATTEMPTS = 10;

function buildAgentConfig() {
  const resolved = resolveModel(GEMINI_MODEL_ALIAS);
  const providerConfig = getProviderConfig(resolved.provider);
  return {
    provider: resolved.provider,
    providerConfig,
    model: resolved.model,
    hyperparameters: { temperature: 0.5, max_tokens: 1500 },
  };
}

// ---------------------------------------------------------------------------
// Prompts: short (simple) vs long (production-like ~5k input tokens)
// ---------------------------------------------------------------------------

const SHORT_SYSTEM = `You are a pedagogical reviewer. Evaluate the tutor's response for accuracy, clarity, scaffolding, and tone. Provide a brief critique (2-3 sentences) and improvement suggestions. Keep your response under 200 words.`;

const SHORT_USER = `The learner asked: "I don't understand recursion at all, can you explain it?"

The tutor responded: "Recursion is when a function calls itself. Think of it like Russian nesting dolls - each doll contains a smaller version of itself. In programming, a recursive function solves a problem by breaking it into smaller instances of the same problem, with a base case that stops the recursion. For example, calculating factorial: factorial(5) = 5 × factorial(4) = 5 × 4 × factorial(3), and so on until factorial(1) = 1."

Please evaluate this tutor response.`;

// Load actual superego prompt for realistic input size
function loadLongPrompts() {
  const superegoPath = path.join(ROOT, 'prompts/tutor-superego-recognition-nomem.md');
  let systemPrompt;
  try {
    systemPrompt = fs.readFileSync(superegoPath, 'utf-8');
  } catch {
    // Fallback: pad the short prompt to ~15KB to simulate long input
    systemPrompt = SHORT_SYSTEM + '\n\n' + 'Additional pedagogical guidelines:\n'.repeat(500);
  }

  const userPrompt = `## Tutor Response to Evaluate

### Learner Context
The learner is a second-year undergraduate who has been struggling with object-oriented programming concepts. They expressed frustration in their previous message about not understanding how inheritance works in Python. They said: "I've read the textbook three times but I still can't figure out when to use inheritance vs composition. Every example seems contrived."

### Tutor's Response
"I completely understand your frustration - this is genuinely one of the trickier conceptual distinctions in OOP, and textbook examples often don't help because they use artificial scenarios like Animal→Dog hierarchies that don't reflect real decisions you'd face.

Let me offer a different way to think about it. Ask yourself: 'Is the new thing a specialized version of the existing thing?' If yes, that's inheritance. 'Does the new thing USE the existing thing?' If yes, that's composition.

Real example: A CheckingAccount IS-A BankAccount (inheritance). A Customer HAS-A BankAccount (composition). The customer isn't a type of bank account, they just have one.

Here's a practical exercise: take a system you're familiar with - maybe a music player app. Try to identify 3 inheritance relationships and 3 composition relationships. We can discuss what you come up with.

The fact that you're questioning when to use each approach actually shows sophisticated thinking - many beginners just use inheritance everywhere without considering alternatives."

### Previous Superego Assessment (Turn 1)
The tutor showed good empathy but could improve scaffolding by providing more structured practice opportunities.

Please provide your assessment.`;

  return { systemPrompt, userPrompt };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function runBatch(agentConfig, systemPrompt, userPrompt, label, n) {
  const results = [];

  for (let i = 0; i < n; i++) {
    const start = Date.now();
    const result = await callLearnerAI(agentConfig, systemPrompt, userPrompt, 'superego');
    const elapsed = Date.now() - start;

    const isEmpty = !result.content;
    results.push({
      attempt: i + 1,
      isEmpty,
      outputTokens: result.usage?.outputTokens || 0,
      inputTokens: result.usage?.inputTokens || 0,
      finishReason: result.finishReason || 'unknown',
      retries: result.emptyContentRetries || 0,
      latencyMs: elapsed,
      contentLength: result.content?.length || 0,
    });

    const status = isEmpty ? '❌ EMPTY' : `✓ ${result.content.length} chars`;
    console.log(
      `  [${label} ${i + 1}/${n}] ${status} (${result.usage?.inputTokens || 0}in/${result.usage?.outputTokens || 0}out, finish=${result.finishReason || '?'}, ${elapsed}ms${result.emptyContentRetries ? `, retries=${result.emptyContentRetries}` : ''})`,
    );

    if (i < n - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return results;
}

function printSummary(label, results) {
  const n = results.length;
  const emptyCount = results.filter((r) => r.isEmpty).length;
  const retryCount = results.filter((r) => r.retries > 0).length;
  const avgLatency = Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / n);
  const avgInput = Math.round(results.reduce((s, r) => s + r.inputTokens, 0) / n);

  console.log(`\n  ── ${label} ──────────────────────────────────`);
  console.log(`  Calls:        ${n}`);
  console.log(`  Avg input:    ${avgInput} tokens`);
  console.log(`  Empty:        ${emptyCount}/${n} (${((emptyCount / n) * 100).toFixed(0)}%)`);
  console.log(`  Retried:      ${retryCount}/${n}`);
  console.log(`  Avg latency:  ${avgLatency}ms`);

  return { emptyCount, retryCount };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Gemini Flash empty content (live API)', () => {
  let agentConfig;

  before(() => {
    const providerConfig = getProviderConfig('openrouter');
    if (!providerConfig?.isConfigured) {
      console.log('SKIP: OPENROUTER_API_KEY not set');
      process.exit(0);
    }
    agentConfig = buildAgentConfig();
    console.log(`Testing model: ${agentConfig.model}`);
  });

  it('short prompt: reports empty content rate', async () => {
    const results = await runBatch(agentConfig, SHORT_SYSTEM, SHORT_USER, 'short', N_ATTEMPTS);
    const { emptyCount } = printSummary('Short prompt', results);

    if (emptyCount > 0) {
      console.log(`  ⚠ Empty content reproduced with short prompt.`);
    } else {
      console.log(`  ✓ No empty responses.`);
    }

    const successCount = results.filter((r) => !r.isEmpty).length;
    assert.ok(successCount > 0 || emptyCount === N_ATTEMPTS);
  });

  it('long prompt (~5k tokens): reports empty content rate', async () => {
    const { systemPrompt, userPrompt } = loadLongPrompts();
    const results = await runBatch(agentConfig, systemPrompt, userPrompt, 'long', N_ATTEMPTS);
    const { emptyCount } = printSummary('Long prompt (~5k tokens)', results);

    if (emptyCount > 0) {
      console.log(`  ⚠ Empty content reproduced with long prompt — matches production pattern.`);
    } else {
      console.log(`  ✓ No empty responses.`);
    }

    const successCount = results.filter((r) => !r.isEmpty).length;
    assert.ok(successCount > 0 || emptyCount === N_ATTEMPTS);
  });
});
