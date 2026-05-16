#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderMarkdownReport, runAll } from '../src/harness.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function argValue(name) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx === -1 ? null : process.argv[idx + 1];
}

function resolveOutDir(defaultRelative) {
  const explicit = argValue('out');
  return explicit ? path.resolve(explicit) : path.resolve(ROOT, defaultRelative);
}

const scenarioId = argValue('scenario');
const outDir = resolveOutDir('outputs');
fs.mkdirSync(outDir, { recursive: true });

const results = runAll({ scenarioId });
if (results.length === 0) {
  console.error(`No scenarios matched ${scenarioId}`);
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const jsonPath = path.join(outDir, `adaptive-persona-mvp-${stamp}.json`);
const mdPath = path.join(outDir, `adaptive-persona-mvp-${stamp}.md`);

fs.writeFileSync(jsonPath, `${JSON.stringify(results, null, 2)}\n`);
fs.writeFileSync(mdPath, renderMarkdownReport(results));

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${mdPath}`);
for (const result of results) {
  console.log(`${result.scenarioId}: ${result.evaluation.weightedScore} - ${result.evaluation.summary}`);
}
