#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderAssessmentMarkdown,
  runRealAssessment,
} from '../src/assessmentHarness.js';

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
const judgeModel = argValue('judge-model');
const learnerModel = argValue('learner-model');
const learnerMode = argValue('learner') || 'rule';
const timeoutMs = Number(argValue('timeout-ms') || 360_000);
const dryRun = hasFlag('dry-run');
const keepPrompts = hasFlag('keep-prompts') || dryRun;
const conditionArg = argValue('conditions');
const conditions = conditionArg ? conditionArg.split(',').map((s) => s.trim()).filter(Boolean) : undefined;

fs.mkdirSync(outDir, { recursive: true });

const results = await runRealAssessment({
  scenarioId,
  conditions,
  model,
  judgeModel,
  learnerModel,
  learnerMode,
  timeoutMs,
  dryRun,
  keepPrompts,
});

if (results.length === 0) {
  console.error(`No scenarios matched ${scenarioId}`);
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const jsonPath = path.join(outDir, `real-adaptation-assessment-${stamp}.json`);
const mdPath = path.join(outDir, `real-adaptation-assessment-${stamp}.md`);

fs.writeFileSync(jsonPath, `${JSON.stringify(results, null, 2)}\n`);
fs.writeFileSync(mdPath, renderAssessmentMarkdown(results));

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${mdPath}`);
for (const result of results) {
  const baseline = result.comparisons.baseline;
  const summary = baseline
    ? `static=${baseline.staticBlindScore} controller=${baseline.controllerBlindScore} delta=${baseline.controllerScoreDelta}`
    : 'no baseline comparison';
  console.log(`${result.scenarioId}: ${summary}`);
}
