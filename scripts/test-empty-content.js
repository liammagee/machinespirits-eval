#!/usr/bin/env node
/**
 * Diagnostic: measure empty-content rate for a given model.
 *
 * Tests both the learner (callLearnerAI) and tutor-core (callAI) code paths
 * with short (~175 token) and long (~4k token) prompts.
 *
 * Usage:
 *   node scripts/test-empty-content.js [model]           # default: openrouter.gemini-flash
 *   node scripts/test-empty-content.js openrouter.nemotron
 *   node scripts/test-empty-content.js --attempts 20     # more calls per batch
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from 'node:util';
import { callLearnerAI } from '../services/learnerTutorInteractionEngine.js';
import { getProviderConfig, resolveModel } from '../services/learnerConfigLoader.js';
import { callAI } from '@machinespirits/tutor-core/services/tutorDialogueEngine';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    attempts: { type: 'string', short: 'n', default: '10' },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help) {
  console.log(`Usage: node scripts/test-empty-content.js [model] [--attempts N]

  model       Provider.model alias (default: openrouter.gemini-flash)
  --attempts  Calls per batch (default: 10)

Examples:
  node scripts/test-empty-content.js
  node scripts/test-empty-content.js openrouter.nemotron --attempts 20
  node scripts/test-empty-content.js openrouter.kimi-k2.5 -n 5`);
  process.exit(0);
}

const modelAlias = positionals[0] || 'openrouter.gemini-flash';
const N_ATTEMPTS = parseInt(values.attempts, 10) || 10;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function buildAgentConfig(alias) {
  const resolved = resolveModel(alias);
  const providerConfig = getProviderConfig(resolved.provider);
  if (!providerConfig?.isConfigured) {
    console.error(`Provider ${resolved.provider} not configured (missing API key)`);
    process.exit(1);
  }
  return {
    provider: resolved.provider,
    providerConfig,
    model: resolved.model,
    hyperparameters: { temperature: 0.5, max_tokens: 1500 },
  };
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const SHORT_SYSTEM = `You are a pedagogical reviewer. Evaluate the tutor's response for accuracy, clarity, scaffolding, and tone. Provide a brief critique (2-3 sentences) and improvement suggestions. Keep your response under 200 words.`;

const SHORT_USER = `The learner asked: "I don't understand recursion at all, can you explain it?"

The tutor responded: "Recursion is when a function calls itself. Think of it like Russian nesting dolls - each doll contains a smaller version of itself. In programming, a recursive function solves a problem by breaking it into smaller instances of the same problem, with a base case that stops the recursion. For example, calculating factorial: factorial(5) = 5 × factorial(4) = 5 × 4 × factorial(3), and so on until factorial(1) = 1."

Please evaluate this tutor response.`;

function loadLongPrompts() {
  const superegoPath = path.join(ROOT, 'prompts/tutor-superego-recognition-nomem.md');
  let systemPrompt;
  try {
    systemPrompt = fs.readFileSync(superegoPath, 'utf-8');
  } catch {
    systemPrompt = SHORT_SYSTEM + '\n\n' +
      Array.from({ length: 200 }, (_, i) =>
        `Guideline ${i + 1}: When evaluating tutor responses, consider the learner's emotional state, prior knowledge level, and the pedagogical approach used. Assess whether the tutor builds appropriate scaffolding, validates learner emotions, and creates opportunities for deeper understanding through guided discovery rather than direct instruction.`
      ).join('\n');
  }

  const userPrompt = `## Tutor Response to Evaluate

### Learner Context
The learner is a second-year undergraduate who has been struggling with object-oriented programming concepts. They expressed frustration in their previous message about not understanding how inheritance works in Python. They said: "I've read the textbook three times but I still can't figure out when to use inheritance vs composition. Every example seems contrived."

### Tutor's Response
"I completely understand your frustration - this is genuinely one of the trickier conceptual distinctions in OOP, and textbook examples often don't help because they use artificial scenarios that don't reflect real decisions you'd face.

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

/**
 * @param {Function} callFn - callLearnerAI or callAI
 * @param {'learner'|'tutor-core'} codePath
 */
async function runBatch(agentConfig, systemPrompt, userPrompt, callFn, codePath, label, n) {
  const results = [];

  for (let i = 0; i < n; i++) {
    const start = Date.now();
    const result = await callFn(agentConfig, systemPrompt, userPrompt, 'superego');
    const elapsed = Date.now() - start;

    // callLearnerAI returns .content; callAI returns .text
    const text = result.content ?? result.text ?? '';
    const inputTokens = result.usage?.inputTokens ?? result.inputTokens ?? 0;
    const outputTokens = result.usage?.outputTokens ?? result.outputTokens ?? 0;
    const isEmpty = !text;

    results.push({
      isEmpty,
      outputTokens,
      inputTokens,
      finishReason: result.finishReason || 'unknown',
      retries: result.emptyContentRetries || 0,
      latencyMs: elapsed,
      contentLength: text.length,
    });

    const status = isEmpty ? '\x1b[31mEMPTY\x1b[0m' : `\x1b[32m${text.length} chars\x1b[0m`;
    console.log(
      `  [${label} ${i + 1}/${n}] ${status} (${inputTokens}in/${outputTokens}out, finish=${result.finishReason || '?'}, ${elapsed}ms${result.emptyContentRetries ? `, retries=${result.emptyContentRetries}` : ''})`,
    );

    if (i < n - 1) await new Promise((r) => setTimeout(r, 500));
  }

  return results;
}

function printSummary(label, results) {
  const n = results.length;
  const emptyCount = results.filter((r) => r.isEmpty).length;
  const retryCount = results.filter((r) => r.retries > 0).length;
  const avgLatency = Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / n);
  const avgInput = Math.round(results.reduce((s, r) => s + r.inputTokens, 0) / n);

  console.log(`\n  -- ${label} ${'─'.repeat(Math.max(0, 44 - label.length))}`);
  console.log(`  Calls:        ${n}`);
  console.log(`  Avg input:    ${avgInput} tokens`);
  console.log(`  Empty:        ${emptyCount}/${n} (${((emptyCount / n) * 100).toFixed(0)}%)`);
  console.log(`  Retried:      ${retryCount}/${n}`);
  console.log(`  Avg latency:  ${avgLatency}ms`);

  return emptyCount;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const agentConfig = buildAgentConfig(modelAlias);

  console.log(`\nEmpty content diagnostic`);
  console.log(`Model:    ${agentConfig.model} (${modelAlias})`);
  console.log(`Attempts: ${N_ATTEMPTS} per batch (4 batches)\n`);

  const { systemPrompt: longSystem, userPrompt: longUser } = loadLongPrompts();

  let totalEmpty = 0;
  let totalCalls = 0;

  // 1. Learner path (callLearnerAI) — short
  const lr1 = await runBatch(agentConfig, SHORT_SYSTEM, SHORT_USER, callLearnerAI, 'learner', 'learner/short', N_ATTEMPTS);
  totalEmpty += printSummary('learner callLearnerAI / short', lr1);
  totalCalls += N_ATTEMPTS;

  // 2. Learner path — long
  const lr2 = await runBatch(agentConfig, longSystem, longUser, callLearnerAI, 'learner', 'learner/long', N_ATTEMPTS);
  totalEmpty += printSummary('learner callLearnerAI / long', lr2);
  totalCalls += N_ATTEMPTS;

  // 3. Tutor-core path (callAI) — short
  const tc1 = await runBatch(agentConfig, SHORT_SYSTEM, SHORT_USER, callAI, 'tutor-core', 'tutor-core/short', N_ATTEMPTS);
  totalEmpty += printSummary('tutor-core callAI / short', tc1);
  totalCalls += N_ATTEMPTS;

  // 4. Tutor-core path — long
  const tc2 = await runBatch(agentConfig, longSystem, longUser, callAI, 'tutor-core', 'tutor-core/long', N_ATTEMPTS);
  totalEmpty += printSummary('tutor-core callAI / long', tc2);
  totalCalls += N_ATTEMPTS;

  // Verdict
  console.log(`\n${'═'.repeat(50)}`);
  if (totalEmpty > 0) {
    console.log(`  Empty content: ${totalEmpty}/${totalCalls} calls (${((totalEmpty / totalCalls) * 100).toFixed(0)}%)`);
    process.exit(1);
  } else {
    console.log(`  0/${totalCalls} empty responses. Issue not reproduced.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
