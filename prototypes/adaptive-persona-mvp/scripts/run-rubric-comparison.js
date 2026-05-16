#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  estimateRubricComparisonProgressUnits,
  renderRubricComparisonHtml,
  runRubricComparison,
} from '../src/rubricComparison.js';
import { createPercentageMonitor } from '../src/progressMonitor.js';

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
const scenarioIds = argValue('scenarios')?.split(',').map((s) => s.trim()).filter(Boolean) || null;
const outDir = resolveOutDir('outputs');
const model = argValue('model');
const judgeModel = argValue('judge-model');
const parentJudgeModel = argValue('parent-judge-model');
const learnerMode = argValue('learner') || 'rule';
const reflexiveVariant = argValue('reflexive-variant');
const conditionArg = argValue('conditions');
const conditions = conditionArg
  ? conditionArg.split(',').map((s) => s.trim()).filter(Boolean)
  : (hasFlag('include-reflexive')
      ? ['static_codex', 'controller_codex', 'controller_reflexive_codex']
      : undefined);
const timeoutMs = Number(argValue('timeout-ms') || 360_000);
const dryRun = hasFlag('dry-run');
const keepPrompts = hasFlag('keep-prompts') || dryRun;
const progressEnabled = !hasFlag('no-progress');

fs.mkdirSync(outDir, { recursive: true });

const progress = createPercentageMonitor({
  label: 'rubric-comparison',
  total: estimateRubricComparisonProgressUnits({
    scenarioId,
    scenarioIds,
    conditions: conditions || ['static_codex', 'controller_codex'],
    learnerMode,
  }),
  enabled: progressEnabled,
});

const report = await runRubricComparison({
  scenarioId,
  scenarioIds,
  conditions,
  learnerMode,
  model,
  judgeModel,
  parentJudgeModel,
  reflexiveVariant,
  timeoutMs,
  dryRun,
  keepPrompts,
  onProgress: progress.event,
});

if (report.results.length === 0) {
  console.error(`No scenarios matched ${scenarioId || scenarioIds?.join(',') || 'all scenarios'}`);
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const jsonPath = path.join(outDir, `rubric-comparison-${stamp}.json`);
const htmlPath = path.join(outDir, `rubric-comparison-${stamp}.html`);

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(htmlPath, renderRubricComparisonHtml(report));

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${htmlPath}`);
for (const scenario of report.results) {
  const baseline = scenario.comparisons.baseline;
  const conditionAverages = scenario.comparisons.conditionAverages || {};
  const summary = baseline
    ? `static=${baseline.staticBlindScore} controller=${baseline.controllerBlindScore} delta=${baseline.controllerScoreDelta}`
    : 'no baseline comparison';
  const aggregate = Object.keys(conditionAverages).length
    ? Object.entries(conditionAverages)
        .map(([condition, scores]) => `${condition}:mvp=${scores.mvpAvg},parent=${scores.parentAvg}`)
        .join(' ')
    : 'no aggregate rubric comparison';
  console.log(`${scenario.scenarioId}: original_branch ${summary}; ${aggregate}`);
}
