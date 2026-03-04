#!/usr/bin/env node
/**
 * Model shootout: latency + cost comparison with full-response output for manual quality inspection.
 * Calls each candidate model with a pedagogically-demanding prompt and prints metrics plus full responses.
 */
import 'dotenv/config';
import { unifiedAIProvider } from '@machinespirits/tutor-core';
import * as evalConfigLoader from '../services/evalConfigLoader.js';

const OPENROUTER_MODELS = [
  'openrouter.nemotron',
  'openrouter.deepseek',
  'openrouter.glm5',
  'openrouter.minimax',
  'openrouter.haiku',
  'openrouter.gemini-flash',
  'openrouter.gemini-flash-3.1',
  'openrouter.qwen3.5-plus',
];

const SYSTEM_PROMPT = `You are a philosophy tutor working with a university student. Respond helpfully, specifically, and concisely. Do NOT use bullet lists or headers — write in natural prose. Engage directly with the learner's confusion.`;

const LEARNER_INPUT = `I've been stuck on Hegel's master-slave dialectic for an hour. I think I get that there are two self-consciousnesses that fight, and one becomes the master and one becomes the slave. But then my textbook says the slave actually ends up with a "higher" form of self-consciousness? That makes no sense — the slave lost! How does losing make you MORE conscious? Am I missing something fundamental?`;

async function callModel(alias) {
  const resolved = evalConfigLoader.resolveModel(alias);
  if (!resolved.isConfigured) return { alias, status: 'skip', reason: 'no API key' };

  const start = Date.now();
  const response = await unifiedAIProvider.call({
    provider: resolved.provider,
    model: resolved.model,
    systemPrompt: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: LEARNER_INPUT }],
    config: { temperature: 0.3, maxTokens: 800 },
  });
  const wallMs = Date.now() - start;

  return {
    alias,
    modelId: resolved.model,
    status: 'ok',
    latencyMs: response.latencyMs || wallMs,
    inputTokens: response.usage?.inputTokens || 0,
    outputTokens: response.usage?.outputTokens || 0,
    cost: response.usage?.cost || 0,
    content: (response.content || '').trim(),
  };
}

function discoverLmStudioModels() {
  const provider = evalConfigLoader.getProviderConfig('lmstudio');
  const configuredAliases = Object.keys(provider.models || {});

  return configuredAliases
    .filter((alias) => alias !== 'default')
    .filter((alias) => !alias.includes('vl'))
    .map((alias) => `lmstudio.${alias}`);
}

function getShootoutModels() {
  return [...OPENROUTER_MODELS, ...discoverLmStudioModels()];
}

// ── Main ──────────────────────────────────────────────────────────────────────

const MODELS = getShootoutModels();

console.log(`\n${'═'.repeat(80)}`);
console.log(`  MODEL SHOOTOUT — Latency × Cost × Quality`);
console.log(`${'═'.repeat(80)}\n`);
console.log(`Prompt: "${LEARNER_INPUT.substring(0, 80)}..."\n`);

// Phase 1: Call all models
console.log('── Phase 1: Generating responses ──────────────────────────────────────────────\n');
const results = [];
for (const alias of MODELS) {
  process.stdout.write(`  ${alias.padEnd(14)} ... `);
  try {
    const r = await callModel(alias);
    if (r.status === 'ok') {
      process.stdout.write(
        `${(r.latencyMs / 1000).toFixed(1)}s  ${r.inputTokens}→${r.outputTokens} tok  $${r.cost.toFixed(4)}\n`,
      );
    } else {
      process.stdout.write(`${r.status}: ${r.reason || ''}\n`);
    }
    results.push(r);
  } catch (err) {
    process.stdout.write(`error: ${err.message.substring(0, 60)}\n`);
    results.push({ alias, status: 'error', reason: err.message.substring(0, 100) });
  }
}

// Phase 2: Summary table
const okResults = results.filter((r) => r.status === 'ok').sort((a, b) => a.latencyMs - b.latencyMs);

console.log(`\n── Metrics ────────────────────────────────────────────────────────────────────\n`);
console.log('  Model          Latency   In→Out       Cost');
console.log('  ' + '─'.repeat(50));

for (const r of okResults) {
  const costStr = r.cost < 0.001 ? `$${r.cost.toFixed(6)}` : `$${r.cost.toFixed(4)}`;
  console.log(
    `  ${r.alias.padEnd(14)} ${(r.latencyMs / 1000).toFixed(1).padStart(5)}s  ` +
      `${r.inputTokens}→${String(r.outputTokens).padEnd(4)} ${costStr.padStart(10)}`,
  );
}

// Cost projection for full 2×2×2 (8 cells × 3 runs × 6 scenarios = 144 dialogues)
console.log(`\n── Cost Projection (8 cells × 3 runs × 6 scenarios = 144 dialogues) ──────────\n`);
console.log('  Model          Per-call   Est/dialogue  Est/full-run');
console.log('  ' + '─'.repeat(55));
for (const r of okResults) {
  const perCall = r.cost;
  const perDialogue = perCall * 10;
  const fullRun = perDialogue * 144;
  console.log(
    `  ${r.alias.padEnd(14)} ${('$' + perCall.toFixed(4)).padStart(8)}   ` +
      `${('$' + perDialogue.toFixed(3)).padStart(8)}      ` +
      `${('$' + fullRun.toFixed(2)).padStart(8)}`,
  );
}

// Print full responses for quality assessment
console.log(`\n── Full Responses (for quality assessment) ────────────────────────────────────\n`);
for (const r of okResults) {
  console.log(`┌─ ${r.alias} (${(r.latencyMs / 1000).toFixed(1)}s, $${r.cost.toFixed(4)}) ─────────────────────`);
  console.log(r.content);
  console.log(`└${'─'.repeat(60)}\n`);
}

console.log(`${'═'.repeat(80)}\n`);
