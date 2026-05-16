#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderMarkdownReport } from '../src/harness.js';
import { runAllWithCodex } from '../src/codexHarness.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function argValue(name) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx === -1 ? null : process.argv[idx + 1];
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function resolveOutDir(defaultRelative) {
  const explicit = argValue('out');
  return explicit ? path.resolve(explicit) : path.resolve(ROOT, defaultRelative);
}

const scenarioId = argValue('scenario');
const outDir = resolveOutDir('outputs');
const model = argValue('model');
const observerModel = argValue('observer-model');
const timeoutMs = Number(argValue('timeout-ms') || 360_000);
const dryRun = hasFlag('dry-run');
const keepPrompts = hasFlag('keep-prompts') || dryRun;

fs.mkdirSync(outDir, { recursive: true });

const results = await runAllWithCodex({
  scenarioId,
  model,
  observerModel,
  timeoutMs,
  dryRun,
  keepPrompts,
});

if (results.length === 0) {
  console.error(`No scenarios matched ${scenarioId}`);
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const jsonPath = path.join(outDir, `adaptive-persona-mvp-codex-${stamp}.json`);
const mdPath = path.join(outDir, `adaptive-persona-mvp-codex-${stamp}.md`);

fs.writeFileSync(jsonPath, `${JSON.stringify(results, null, 2)}\n`);
fs.writeFileSync(mdPath, renderMarkdownReport(results));

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${mdPath}`);
for (const result of results) {
  const observer = result.codexObservation?.weighted_score != null
    ? ` | codexObserver=${result.codexObservation.weighted_score}`
    : '';
  console.log(`${result.scenarioId}: deterministic=${result.evaluation.weightedScore}${observer} - ${result.evaluation.summary}`);
}
