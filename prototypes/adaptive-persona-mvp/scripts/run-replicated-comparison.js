#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runRubricComparison } from '../src/rubricComparison.js';
import { annotateReflexiveBranches } from '../src/deepReflexiveScoring.js';
import { isReflexiveCondition } from '../src/reflexiveVariants.js';
import {
  conditionMetricValues,
  pairedMetricDifferences,
  summarizePairedDifferences,
  summarizeValues,
} from '../src/statistics.js';

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

const scenarioIds = argValue('scenarios')?.split(',').map((s) => s.trim()).filter(Boolean) || null;
const conditions = (argValue('conditions') || 'static_codex,controller_codex,controller_reflexive_psychodynamic_codex')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const baselineCondition = argValue('baseline') || 'static_codex';
const targetCondition = argValue('target') || 'controller_reflexive_psychodynamic_codex';
const repeats = Number(argValue('repeats') || 3);
const outDir = resolveOutDir('outputs/replicated-comparison');
const model = argValue('model');
const judgeModel = argValue('judge-model');
const parentJudgeModel = argValue('parent-judge-model');
const learnerMode = argValue('learner') || 'rule';
const timeoutMs = Number(argValue('timeout-ms') || 600_000);
const dryRun = hasFlag('dry-run');
const keepPrompts = hasFlag('keep-prompts') || dryRun;
const permutations = Number(argValue('permutations') || 10_000);
const deepReflexive = !hasFlag('skip-deep-reflexive') && conditions.some((condition) => isReflexiveCondition(condition));

fs.mkdirSync(outDir, { recursive: true });

const reports = [];
for (let repeat = 0; repeat < repeats; repeat++) {
  console.log(`Running repeat ${repeat + 1}/${repeats}`);
  const report = await runRubricComparison({
    scenarioIds,
    conditions,
    learnerMode,
    model,
    judgeModel,
    parentJudgeModel,
    timeoutMs,
    dryRun,
    keepPrompts,
  });
  if (deepReflexive) {
    await annotateReflexiveBranches(report, {
      model: parentJudgeModel || judgeModel || model,
      timeoutMs,
      dryRun,
      keepPrompts,
    });
  }
  report.repeat = repeat;
  reports.push(report);
}

const metrics = ['mvp', 'parent_dialogue', 'outcome'];
const statistics = Object.fromEntries(metrics.map((metric) => {
  const rows = pairedMetricDifferences(reports, {
    baselineCondition,
    targetCondition,
    metric,
  });
  return [metric, {
    rows,
    summary: summarizePairedDifferences(rows.map((row) => row.diff), { permutations }),
  }];
}));
const targetMechanismMetrics = ['deliberation', 'psychodynamic'];
const targetMechanismStatistics = Object.fromEntries(targetMechanismMetrics.map((metric) => {
  const rows = conditionMetricValues(reports, {
    condition: targetCondition,
    metric,
  });
  return [metric, {
    rows,
    summary: summarizeValues(rows.map((row) => row.score), { permutations }),
  }];
}));

const output = {
  generatedAt: new Date().toISOString(),
  repeats,
  scenarioIds,
  conditions,
  baselineCondition,
  targetCondition,
  learnerMode,
  dryRun,
  model: model || 'codex-cli-default',
  judgeModel: judgeModel || model || 'codex-cli-default',
  parentJudgeModel: parentJudgeModel || judgeModel || model || 'codex-cli-default',
  deepReflexive,
  statistics,
  targetMechanismStatistics,
  reports,
};

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const jsonPath = path.join(outDir, `replicated-comparison-${stamp}.json`);
const htmlPath = path.join(outDir, `replicated-comparison-${stamp}.html`);
fs.writeFileSync(jsonPath, `${JSON.stringify(output, null, 2)}\n`);
fs.writeFileSync(htmlPath, renderReplicatedHtml(output));

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${htmlPath}`);
for (const [metric, stat] of Object.entries(statistics)) {
  const s = stat.summary;
  console.log(`${metric}: n=${s.n} meanDiff=${s.meanDiff} ci=${s.bootstrap95Ci.join(',')} p=${s.permutationP} dz=${s.cohenDz} nonTrivialPositive=${s.nonTrivialPositive}`);
}
for (const [metric, stat] of Object.entries(targetMechanismStatistics)) {
  const s = stat.summary;
  console.log(`${metric}: n=${s.n} mean=${s.mean} ci=${s.bootstrap95Ci.join(',')}`);
}

function renderReplicatedHtml(result) {
  const metricRows = Object.entries(result.statistics).map(([metric, stat]) => ({
    metric,
    ...stat.summary,
  }));
  const mechanismRows = Object.entries(result.targetMechanismStatistics || {}).map(([metric, stat]) => ({
    metric,
    ...stat.summary,
  }));
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Adaptive Tutor Replicated Comparison</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f8fa; color: #17202a; line-height: 1.45; }
    header { padding: 28px 34px 18px; background: #fff; border-bottom: 1px solid #d9e0e7; }
    main { padding: 24px 34px 44px; max-width: 1400px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    h2 { margin: 28px 0 12px; font-size: 20px; }
    .meta { color: #5e6b78; display: flex; flex-wrap: wrap; gap: 16px; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d9e0e7; border-radius: 8px; overflow: hidden; }
    th, td { text-align: left; vertical-align: top; border-bottom: 1px solid #d9e0e7; padding: 9px 10px; font-size: 13px; }
    th { background: #eef3f7; font-weight: 650; }
    tr:last-child td { border-bottom: 0; }
    .score { font-weight: 750; font-variant-numeric: tabular-nums; }
    .good { color: #087443; }
    .bad { color: #b42318; }
    code { background: #eef3f7; padding: 1px 4px; border-radius: 4px; }
  </style>
</head>
<body>
  <header>
    <h1>Adaptive Tutor Replicated Comparison</h1>
    <div class="meta">
      <span>Generated: ${escapeHtml(result.generatedAt)}</span>
      <span>Repeats: <code>${result.repeats}</code></span>
      <span>Baseline: <code>${escapeHtml(result.baselineCondition)}</code></span>
      <span>Target: <code>${escapeHtml(result.targetCondition)}</code></span>
      <span>Dry run: <code>${result.dryRun}</code></span>
      <span>Deep reflexive: <code>${result.deepReflexive}</code></span>
    </div>
  </header>
  <main>
    <h2>Statistical Summary</h2>
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          <th>N paired branches</th>
          <th>Mean diff</th>
          <th>Bootstrap 95% CI</th>
          <th>Permutation p</th>
          <th>Cohen dz</th>
          <th>Win / Tie / Loss</th>
          <th>Passes Gate</th>
        </tr>
      </thead>
      <tbody>
        ${metricRows.map((row) => `
        <tr>
          <td>${escapeHtml(row.metric)}</td>
          <td>${row.n}</td>
          <td class="score ${row.meanDiff > 0 ? 'good' : row.meanDiff < 0 ? 'bad' : ''}">${format(row.meanDiff)}</td>
          <td>${format(row.bootstrap95Ci[0])} to ${format(row.bootstrap95Ci[1])}</td>
          <td>${format(row.permutationP)}</td>
          <td>${format(row.cohenDz)}</td>
          <td>${format(row.winRate)} / ${format(row.tieRate)} / ${format(row.lossRate)}</td>
          <td>${row.nonTrivialPositive ? 'yes' : 'no'}</td>
        </tr>`).join('')}
      </tbody>
    </table>

    <h2>Target Mechanism Summary</h2>
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          <th>N target branches</th>
          <th>Mean</th>
          <th>Bootstrap 95% CI</th>
        </tr>
      </thead>
      <tbody>
        ${mechanismRows.map((row) => `
        <tr>
          <td>${escapeHtml(row.metric)}</td>
          <td>${row.n}</td>
          <td class="score ${scoreClass(row.mean)}">${format(row.mean)}</td>
          <td>${format(row.bootstrap95Ci[0])} to ${format(row.bootstrap95Ci[1])}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </main>
</body>
</html>`;
}

function format(value) {
  return typeof value === 'number' ? value.toFixed(3) : 'n/a';
}

function scoreClass(value) {
  if (typeof value !== 'number') return '';
  if (value >= 75) return 'good';
  if (value < 60) return 'bad';
  return '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
