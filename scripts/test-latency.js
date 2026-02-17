#!/usr/bin/env node
/**
 * Lightweight latency test for all configured models.
 *
 * Sends a single short prompt ("Say hello in one sentence.") to each model
 * and reports latency, token counts, and cost in a compact table.
 *
 * Usage:
 *   node scripts/test-latency.js                  # all openrouter models (default)
 *   node scripts/test-latency.js --provider all    # all providers
 *   node scripts/test-latency.js --models nemotron,glm5,kimi-k2.5
 *   node scripts/test-latency.js --serial          # one at a time
 *   node scripts/test-latency.js --prompt "Explain Hegel in one sentence."
 *   node scripts/test-latency.js --max-tokens 500  # override max output tokens
 *   node scripts/test-latency.js --input "I don't understand why Hegel matters"
 */

import 'dotenv/config';
import { unifiedAIProvider } from '@machinespirits/tutor-core';
import * as evalConfigLoader from '../services/evalConfigLoader.js';

// ── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
};
const hasFlag = (flag) => args.includes(flag);

const serial = hasFlag('--serial');
const maxTokens = parseInt(getArg('--max-tokens') || '200', 10);
const providerFilter = getArg('--provider') || 'openrouter';
const modelsFilter = getArg('--models')?.split(',').map(s => s.trim()) || null;

const defaultInput = 'I keep reading about Hegel\'s master-slave dialectic but I don\'t really get why it matters. Can you explain it simply?';
const learnerInput = getArg('--input') || getArg('--prompt') || defaultInput;
const systemPrompt = 'You are a philosophy tutor. Respond helpfully and concisely to the learner.';

// ── Discover models ─────────────────────────────────────────────────────────

function discoverModels() {
  const providers = evalConfigLoader.loadProviders();
  if (!providers?.providers) {
    console.error('No providers found in config/providers.yaml');
    process.exit(1);
  }

  const targets = [];

  for (const [provName, provConfig] of Object.entries(providers.providers)) {
    if (providerFilter !== 'all' && provName !== providerFilter) continue;
    if (provName === 'local') continue;

    const models = provConfig.models || {};
    for (const [alias, modelId] of Object.entries(models)) {
      if (modelsFilter && !modelsFilter.includes(alias)) continue;
      targets.push({ provider: provName, alias, modelId });
    }
  }

  return targets;
}

// ── Test a single model ─────────────────────────────────────────────────────

async function testModel({ provider, alias, modelId }) {
  const label = providerFilter === 'all' ? `${provider}.${alias}` : alias;
  try {
    const resolved = evalConfigLoader.resolveModel({ provider, model: alias });
    if (!resolved.isConfigured) {
      return { label, modelId, status: 'skip', reason: 'no API key' };
    }

    const start = Date.now();
    const response = await unifiedAIProvider.call({
      provider,
      model: resolved.model,
      systemPrompt,
      messages: [{ role: 'user', content: learnerInput }],
      config: {
        temperature: 0.3,
        maxTokens,
      },
    });
    const wallMs = Date.now() - start;

    return {
      label,
      modelId: resolved.model,
      status: 'ok',
      latencyMs: response.latencyMs || wallMs,
      wallMs,
      inputTokens: response.usage?.inputTokens || 0,
      outputTokens: response.usage?.outputTokens || 0,
      cost: response.usage?.cost || 0,
      content: (response.content || '').replace(/\s+/g, ' ').trim(),
    };
  } catch (error) {
    return { label, modelId, status: 'error', reason: error.message.substring(0, 100) };
  }
}

// ── Formatting helpers ──────────────────────────────────────────────────────

function formatLatency(ms) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function formatCost(cost) {
  if (!cost || cost === 0) return '  --';
  if (cost < 0.001) return `$${cost.toFixed(6)}`;
  return `$${cost.toFixed(4)}`;
}

function bar(ms, maxMs) {
  const width = 20;
  const filled = Math.round((ms / maxMs) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

// ── Main ────────────────────────────────────────────────────────────────────

const targets = discoverModels();
if (targets.length === 0) {
  console.error('No models matched. Check --provider / --models flags.');
  process.exit(1);
}

console.log(`\nTesting ${targets.length} model(s) ${serial ? 'sequentially' : 'in parallel'} (max ${maxTokens} tokens)...`);
console.log(`Input: "${learnerInput}"\n`);

let results;
if (serial) {
  results = [];
  for (const t of targets) {
    process.stdout.write(`  ${t.alias} ... `);
    const r = await testModel(t);
    if (r.status === 'ok') {
      process.stdout.write(`${formatLatency(r.latencyMs)} (${r.inputTokens}→${r.outputTokens} tok)\n`);
    } else {
      process.stdout.write(`${r.status}: ${r.reason || ''}\n`);
    }
    results.push(r);
  }
} else {
  results = await Promise.all(targets.map(t => testModel(t)));
}

// ── Table output ────────────────────────────────────────────────────────────

const ok = results.filter(r => r.status === 'ok').sort((a, b) => a.latencyMs - b.latencyMs);
const failed = results.filter(r => r.status !== 'ok');

if (ok.length > 0) {
  const maxMs = ok[ok.length - 1].latencyMs;
  const labelW = Math.max(12, ...ok.map(r => r.label.length));
  const modelW = Math.max(15, ...ok.map(r => r.modelId.length));
  const sep = '─'.repeat(labelW + modelW + 68);

  console.log(`\n${sep}`);
  console.log(
    ' ' + 'Alias'.padEnd(labelW) +
    '  ' + 'Model'.padEnd(modelW) +
    '  ' + 'Latency'.padStart(7) +
    '  ' + 'In'.padStart(4) +
    '  ' + 'Out'.padStart(4) +
    '  ' + 'Cost'.padStart(9) +
    '  ' + 'Bar'.padEnd(20) +
    '  Response'
  );
  console.log(sep);

  for (const r of ok) {
    console.log(
      ' ' + r.label.padEnd(labelW) +
      '  ' + r.modelId.padEnd(modelW) +
      '  ' + formatLatency(r.latencyMs).padStart(7) +
      '  ' + String(r.inputTokens).padStart(4) +
      '  ' + String(r.outputTokens).padStart(4) +
      '  ' + formatCost(r.cost).padStart(9) +
      '  ' + bar(r.latencyMs, maxMs) +
      '  ' + r.content.substring(0, 35)
    );
  }
  console.log(sep);
}

if (failed.length > 0) {
  console.log('\nFailed/Skipped:');
  for (const r of failed) {
    console.log(`  ${r.label}: ${r.reason || r.status}`);
  }
}

// ── Summary ─────────────────────────────────────────────────────────────────

if (ok.length > 0) {
  const fastest = ok[0];
  const slowest = ok[ok.length - 1];
  const median = ok[Math.floor(ok.length / 2)];
  const totalCost = ok.reduce((s, r) => s + r.cost, 0);
  const avgLatency = Math.round(ok.reduce((s, r) => s + r.latencyMs, 0) / ok.length);
  console.log(`\n${ok.length} succeeded, ${failed.length} failed`);
  console.log(`  Fastest:  ${fastest.label} (${formatLatency(fastest.latencyMs)})`);
  console.log(`  Median:   ${median.label} (${formatLatency(median.latencyMs)})`);
  console.log(`  Slowest:  ${slowest.label} (${formatLatency(slowest.latencyMs)})`);
  console.log(`  Average:  ${formatLatency(avgLatency)}`);
  if (totalCost > 0) console.log(`  Total cost: ${formatCost(totalCost)}`);
}
