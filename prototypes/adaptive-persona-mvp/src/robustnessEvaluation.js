import fs from 'node:fs';
import path from 'node:path';
import {
  summarizePairedDifferences,
} from './statistics.js';
import { DEFAULT_HARD_SCENARIOS, PUBLIC_METRICS } from './variantSweep.js';

export const ADAPTIVE_PRIMARY_METRICS = Object.freeze(['mvp', 'outcome']);
export const COMPATIBILITY_METRICS = Object.freeze(
  PUBLIC_METRICS.filter((metric) => !ADAPTIVE_PRIMARY_METRICS.includes(metric)),
);

export function collectJsonFiles(inputs) {
  const files = [];
  for (const input of inputs) {
    const resolved = path.resolve(input);
    if (!fs.existsSync(resolved)) continue;
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(resolved)) {
        files.push(...collectJsonFiles([path.join(resolved, child)]));
      }
    } else if (resolved.endsWith('.json')) {
      files.push(resolved);
    }
  }
  return [...new Set(files)].sort();
}

export function loadRobustnessSources(files) {
  const summaries = [];
  const parseErrors = [];
  for (const file of files) {
    try {
      const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
      summaries.push(...extractRunSummaries(payload, file));
    } catch (error) {
      parseErrors.push({ file, error: error.message });
    }
  }
  return { summaries, parseErrors };
}

export function extractRunSummaries(payload, file) {
  if (payload?.targetSummaries) return extractVariantSweepSummaries(payload, file);
  if (payload?.statistics && payload?.targetCondition) return extractReplicatedSummaries(payload, file);
  return [];
}

export function buildRobustnessEvaluation({
  summaries,
  targetCondition = 'controller_reflexive_psychodynamic_codex',
  baselineCondition = 'static_codex',
  eligibleScenarioIds = [...DEFAULT_HARD_SCENARIOS],
  scenarioSetLabel = 'hard',
  permutations = 10_000,
} = {}) {
  const targetSummaries = summaries.filter((summary) => summary.targetCondition === targetCondition);
  const hardLlmFullRuns = targetSummaries.filter((summary) => isFullScenarioRun(summary, eligibleScenarioIds) && summary.learnerMode === 'codex' && !summary.dryRun);
  const focusedLlmRuns = targetSummaries.filter((summary) => !summary.isHardFullRun && summary.isHardOnly && summary.learnerMode === 'codex' && !summary.dryRun);
  const ruleFullRuns = targetSummaries.filter((summary) => isFullScenarioRun(summary, eligibleScenarioIds) && summary.learnerMode === 'rule' && !summary.dryRun);

  const aggregate = aggregateMetricRows(hardLlmFullRuns, { permutations });
  const runFailures = hardLlmFullRuns.filter((summary) => runHasMaterialFailure(summary));
  const robustPositive = decideRobustPositive({
    hardLlmFullRuns,
    aggregate,
    runFailures,
  });
  const ablations = summarizeAblationComparisons(summaries, {
    targetCondition,
    baselineCondition,
    permutations,
  });

  return {
    generatedAt: new Date().toISOString(),
    targetCondition,
    baselineCondition,
    scenarioSetLabel,
    eligibleScenarioIds,
    sourceCounts: {
      summaries: summaries.length,
      targetSummaries: targetSummaries.length,
      hardLlmFullRuns: hardLlmFullRuns.length,
      focusedLlmRuns: focusedLlmRuns.length,
      ruleFullRuns: ruleFullRuns.length,
    },
    robustPositive,
    aggregate,
    hardLlmFullRuns,
    focusedLlmRuns,
    ruleFullRuns,
    ablations,
  };
}

export function renderRobustnessMarkdown(evaluation) {
  const lines = [
    '# Adaptive Tutor Robustness Evaluation',
    '',
    `Generated: ${evaluation.generatedAt}`,
    '',
    `Target: \`${evaluation.targetCondition}\``,
    `Baseline: \`${evaluation.baselineCondition}\``,
    '',
    '## Verdict',
    '',
    `Adaptive primary robust positive effect established: **${evaluation.robustPositive.established ? 'yes' : 'no'}**`,
    '',
    `Strict all-public-metric confirmation: **${evaluation.robustPositive.strictPublicEstablished ? 'yes' : 'no'}**`,
    '',
    evaluation.robustPositive.reason,
    '',
    '## Aggregate Hard LLM Full-Run Evidence',
    '',
    '| Metric | n | mean diff | 95% CI | p | win/tie/loss | gate |',
    '|---|---:|---:|---:|---:|---:|---|',
  ];
  for (const metric of PUBLIC_METRICS) {
    const s = evaluation.aggregate[metric]?.summary || {};
    lines.push(`| ${metric} | ${s.n ?? 0} | ${fmt(s.meanDiff)} | ${fmt(s.bootstrap95Ci?.[0])}..${fmt(s.bootstrap95Ci?.[1])} | ${fmt(s.permutationP)} | ${fmt(s.winRate)}/${fmt(s.tieRate)}/${fmt(s.lossRate)} | ${s.nonTrivialPositive ? 'pass' : 'fail'} |`);
  }

  lines.push('', '## Eligible Hard LLM Runs', '');
  if (evaluation.hardLlmFullRuns.length === 0) {
    lines.push('No eligible full hard LLM runs found.');
  } else {
    lines.push('| File | MVP | Parent | Outcome | decision |');
    lines.push('|---|---:|---:|---:|---|');
    for (const run of evaluation.hardLlmFullRuns) {
      lines.push(`| ${run.relativeFile || run.file} | ${fmt(run.metrics.mvp?.meanDiff)} | ${fmt(run.metrics.parent_dialogue?.meanDiff)} | ${fmt(run.metrics.outcome?.meanDiff)} | ${run.decisionRationale || ''} |`);
    }
  }

  lines.push('', '## Focused LLM Slices', '');
  if (evaluation.focusedLlmRuns.length === 0) {
    lines.push('No focused LLM slices found.');
  } else {
    lines.push('| File | Scenarios | MVP | Parent | Outcome |');
    lines.push('|---|---|---:|---:|---:|');
    for (const run of evaluation.focusedLlmRuns) {
      lines.push(`| ${run.relativeFile || run.file} | ${run.scenarioIds.join(', ')} | ${fmt(run.metrics.mvp?.meanDiff)} | ${fmt(run.metrics.parent_dialogue?.meanDiff)} | ${fmt(run.metrics.outcome?.meanDiff)} |`);
    }
  }

  lines.push('', '## Ablation Comparisons', '');
  if (evaluation.ablations.length === 0) {
    lines.push('No ablation reports with the full target in the same file found.');
  } else {
    lines.push('| File | Ablation | MVP full-minus-ablation | Parent | Outcome |');
    lines.push('|---|---|---:|---:|---:|');
    for (const row of evaluation.ablations) {
      lines.push(`| ${row.relativeFile || row.file} | ${row.ablationCondition} | ${fmt(row.metrics.mvp?.summary.meanDiff)} | ${fmt(row.metrics.parent_dialogue?.summary.meanDiff)} | ${fmt(row.metrics.outcome?.summary.meanDiff)} |`);
    }
  }

  return `${lines.join('\n')}\n`;
}

export function renderRobustnessHtml(evaluation) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Adaptive Tutor Robustness Evaluation</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f8fa; color: #17202a; line-height: 1.45; }
    header { padding: 28px 34px 18px; background: #fff; border-bottom: 1px solid #d9e0e7; }
    main { padding: 24px 34px 44px; max-width: 1500px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    h2 { margin: 28px 0 12px; font-size: 20px; }
    .meta { color: #5e6b78; display: flex; flex-wrap: wrap; gap: 16px; font-size: 14px; }
    .verdict { background: #fff; border: 1px solid #d9e0e7; border-left: 5px solid ${evaluation.robustPositive.established ? '#087443' : '#b42318'}; padding: 14px 16px; border-radius: 8px; margin-bottom: 18px; }
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
    <h1>Adaptive Tutor Robustness Evaluation</h1>
    <div class="meta">
      <span>Generated: ${escapeHtml(evaluation.generatedAt)}</span>
      <span>Target: <code>${escapeHtml(evaluation.targetCondition)}</code></span>
      <span>Baseline: <code>${escapeHtml(evaluation.baselineCondition)}</code></span>
      <span>Hard LLM full runs: <code>${evaluation.sourceCounts.hardLlmFullRuns}</code></span>
    </div>
  </header>
  <main>
    <section class="verdict">
      <strong>Adaptive primary robust positive effect established: ${evaluation.robustPositive.established ? 'yes' : 'no'}</strong>
      <p>Strict all-public-metric confirmation: ${evaluation.robustPositive.strictPublicEstablished ? 'yes' : 'no'}</p>
      <p>${escapeHtml(evaluation.robustPositive.reason)}</p>
    </section>
    <h2>Aggregate Hard LLM Full-Run Evidence</h2>
    <table>
      <thead><tr><th>Metric</th><th>n</th><th>Mean diff</th><th>95% CI</th><th>p</th><th>Win/Tie/Loss</th><th>Gate</th></tr></thead>
      <tbody>
        ${PUBLIC_METRICS.map((metric) => {
          const s = evaluation.aggregate[metric]?.summary || {};
          return `<tr><td>${escapeHtml(metric)}</td><td>${s.n ?? 0}</td><td class="score ${scoreClass(s.meanDiff)}">${fmt(s.meanDiff)}</td><td>${fmt(s.bootstrap95Ci?.[0])} to ${fmt(s.bootstrap95Ci?.[1])}</td><td>${fmt(s.permutationP)}</td><td>${fmt(s.winRate)} / ${fmt(s.tieRate)} / ${fmt(s.lossRate)}</td><td>${s.nonTrivialPositive ? 'pass' : 'fail'}</td></tr>`;
        }).join('')}
      </tbody>
    </table>
    <h2>Eligible Hard LLM Runs</h2>
    ${renderRunTable(evaluation.hardLlmFullRuns)}
    <h2>Focused LLM Slices</h2>
    ${renderRunTable(evaluation.focusedLlmRuns)}
    <h2>Ablation Comparisons</h2>
    ${renderAblationTable(evaluation.ablations)}
  </main>
</body>
</html>`;
}

function extractVariantSweepSummaries(payload, file) {
  return Object.values(payload.targetSummaries || {}).map((summary) => {
    const metrics = metricsFromPublicStats(summary.publicStats);
    const rows = Object.fromEntries(PUBLIC_METRICS.map((metric) => [
      metric,
      summary.publicStats?.[metric]?.rows || [],
    ]));
    const scenarioIds = unique([
      ...(payload.scenarioIds || []),
      ...Object.values(rows).flat().map((row) => row.scenarioId).filter(Boolean),
    ]);
    return normalizeRunSummary({
      file,
      reportType: 'variant-sweep',
      generatedAt: payload.generatedAt,
      targetCondition: summary.targetCondition,
      baselineCondition: payload.baselineCondition,
      learnerMode: payload.learnerMode,
      dryRun: Boolean(payload.dryRun),
      deepReflexive: Boolean(payload.deepReflexive),
      scenarioIds,
      conditions: payload.conditions || [],
      metrics,
      rows,
      challengeStats: summary.challengeStats || null,
      decisionRationale: summary.decision?.rationale || '',
    });
  });
}

function extractReplicatedSummaries(payload, file) {
  const metrics = metricsFromPublicStats(payload.statistics);
  const rows = Object.fromEntries(PUBLIC_METRICS.map((metric) => [
    metric,
    payload.statistics?.[metric]?.rows || [],
  ]));
  const scenarioIds = unique([
    ...(payload.scenarioIds || []),
    ...Object.values(rows).flat().map((row) => row.scenarioId).filter(Boolean),
  ]);
  return [normalizeRunSummary({
    file,
    reportType: 'replicated-comparison',
    generatedAt: payload.generatedAt,
    targetCondition: payload.targetCondition,
    baselineCondition: payload.baselineCondition,
    learnerMode: payload.learnerMode,
    dryRun: Boolean(payload.dryRun),
    deepReflexive: Boolean(payload.deepReflexive),
    scenarioIds,
    conditions: payload.conditions || [],
    metrics,
    rows,
    challengeStats: null,
    decisionRationale: Object.entries(metrics)
      .map(([metric, summary]) => `${metric}=${summary.meanDiff}`)
      .join(' '),
  })];
}

function normalizeRunSummary(summary) {
  const scenarioSet = new Set(summary.scenarioIds);
  const isHardOnly = summary.scenarioIds.length > 0
    && summary.scenarioIds.every((scenarioId) => DEFAULT_HARD_SCENARIOS.includes(scenarioId));
  const isHardFullRun = DEFAULT_HARD_SCENARIOS.every((scenarioId) => scenarioSet.has(scenarioId));
  return {
    ...summary,
    relativeFile: path.relative(process.cwd(), summary.file),
    isHardOnly,
    isHardFullRun,
  };
}

function isFullScenarioRun(summary, eligibleScenarioIds) {
  const scenarioSet = new Set(summary.scenarioIds);
  return eligibleScenarioIds.every((scenarioId) => scenarioSet.has(scenarioId));
}

function metricsFromPublicStats(publicStats = {}) {
  return Object.fromEntries(PUBLIC_METRICS.map((metric) => [
    metric,
    publicStats?.[metric]?.summary || {},
  ]));
}

function aggregateMetricRows(summaries, { permutations }) {
  return Object.fromEntries(PUBLIC_METRICS.map((metric) => {
    const rows = summaries.flatMap((summary) => summary.rows?.[metric] || []);
    return [metric, {
      rows,
      summary: summarizePairedDifferences(rows.map((row) => row.diff), { permutations }),
    }];
  }));
}

function decideRobustPositive({ hardLlmFullRuns, aggregate, runFailures }) {
  const n = aggregate.mvp?.summary?.n || 0;
  const positiveMetrics = PUBLIC_METRICS.filter((metric) => (aggregate[metric]?.summary?.meanDiff ?? -Infinity) > 0);
  const primaryPositiveMetrics = ADAPTIVE_PRIMARY_METRICS.filter((metric) => (aggregate[metric]?.summary?.meanDiff ?? -Infinity) > 0);
  const gatedMetrics = PUBLIC_METRICS.filter((metric) => aggregate[metric]?.summary?.nonTrivialPositive);
  const primaryGatedMetrics = ADAPTIVE_PRIMARY_METRICS.filter((metric) => aggregate[metric]?.summary?.nonTrivialPositive);
  const compatibleMetrics = COMPATIBILITY_METRICS.filter((metric) => (aggregate[metric]?.summary?.meanDiff ?? -Infinity) >= 0);
  const enoughRuns = hardLlmFullRuns.length >= 2 || n >= 12;
  const enoughBranches = n >= 12;
  const noRunFailures = runFailures.length === 0;
  const primaryPositive = primaryPositiveMetrics.length === ADAPTIVE_PRIMARY_METRICS.length;
  const compatibilityNonNegative = compatibleMetrics.length === COMPATIBILITY_METRICS.length;
  const allPositive = positiveMetrics.length === PUBLIC_METRICS.length;
  const adaptiveGates = primaryGatedMetrics.length === ADAPTIVE_PRIMARY_METRICS.length;
  const strictPublicGates = gatedMetrics.length === PUBLIC_METRICS.length;
  const established = enoughRuns && enoughBranches && noRunFailures && primaryPositive && compatibilityNonNegative && adaptiveGates;
  const strictPublicEstablished = established && allPositive && strictPublicGates;

  const failures = [];
  if (!enoughRuns || !enoughBranches) failures.push(`insufficient replicated hard LLM evidence (runs=${hardLlmFullRuns.length}, paired branches=${n}; need at least 2 runs or 12 branches)`);
  if (!primaryPositive) failures.push(`not all adaptive primary metrics are positive (${primaryPositiveMetrics.join(', ') || 'none'})`);
  if (!compatibilityNonNegative) failures.push(`compatibility metric declined (${compatibleMetrics.join(', ') || 'none'} non-negative)`);
  if (!adaptiveGates) failures.push(`not all adaptive primary metrics pass the non-trivial positive gate (${primaryGatedMetrics.join(', ') || 'none'})`);
  if (!noRunFailures) failures.push(`${runFailures.length} eligible hard LLM run(s) have material negative metrics`);

  const cautions = [];
  if (!strictPublicGates) cautions.push(`strict all-public-metric gate did not pass (${gatedMetrics.join(', ') || 'none'} passed)`);

  return {
    established,
    strictPublicEstablished,
    enoughRuns,
    enoughBranches,
    noRunFailures,
    allPositive,
    adaptiveGates,
    strictPublicGates,
    primaryPositive,
    compatibilityNonNegative,
    positiveMetrics,
    primaryPositiveMetrics,
    compatibleMetrics,
    gatedMetrics,
    primaryGatedMetrics,
    requiredMetrics: [...ADAPTIVE_PRIMARY_METRICS],
    compatibilityMetrics: [...COMPATIBILITY_METRICS],
    reason: established
      ? `Adaptive primary hard LLM robustness gates passed.${cautions.length ? ` Caution: ${cautions.join('; ')}.` : ''}`
      : `Robust positive effects are not established: ${failures.join('; ')}.`,
  };
}

function runHasMaterialFailure(summary) {
  return PUBLIC_METRICS.some((metric) => (summary.metrics?.[metric]?.meanDiff ?? 0) < -5);
}

function summarizeAblationComparisons(summaries, {
  targetCondition,
  baselineCondition,
  permutations,
}) {
  const rows = [];
  const byFile = new Map();
  for (const summary of summaries) {
    if (!summary.file || summary.baselineCondition !== baselineCondition) continue;
    if (!byFile.has(summary.file)) byFile.set(summary.file, []);
    byFile.get(summary.file).push(summary);
  }

  for (const [file, group] of byFile.entries()) {
    const full = group.find((summary) => summary.targetCondition === targetCondition);
    if (!full) continue;
    if (full.dryRun) continue;
    for (const ablation of group.filter((summary) => !summary.dryRun
      && summary.targetCondition !== targetCondition
      && (summary.targetCondition.includes('no_') || summary.targetCondition.includes('ego_only')))) {
      const metricSummaries = {};
      for (const metric of PUBLIC_METRICS) {
        const fullRows = full.rows?.[metric] || [];
        const ablationRows = ablation.rows?.[metric] || [];
        const diffs = [];
        for (const fullRow of fullRows) {
          const match = ablationRows.find((row) => row.repeat === fullRow.repeat
            && row.scenarioId === fullRow.scenarioId
            && row.branchName === fullRow.branchName);
          if (!match) continue;
          diffs.push(Number((fullRow.diff - match.diff).toFixed(3)));
        }
        metricSummaries[metric] = {
          rows: diffs,
          summary: summarizePairedDifferences(diffs, { permutations }),
        };
      }
      rows.push({
        file,
        relativeFile: path.relative(process.cwd(), file),
        ablationCondition: ablation.targetCondition,
        metrics: metricSummaries,
      });
    }
  }
  return rows;
}

function renderRunTable(runs) {
  if (!runs.length) return '<p>No matching runs.</p>';
  return `<table>
    <thead><tr><th>File</th><th>Scenarios</th><th>MVP</th><th>Parent</th><th>Outcome</th><th>Decision</th></tr></thead>
    <tbody>
      ${runs.map((run) => `<tr><td><code>${escapeHtml(run.relativeFile || run.file)}</code></td><td>${escapeHtml(run.scenarioIds.join(', '))}</td><td class="score ${scoreClass(run.metrics.mvp?.meanDiff)}">${fmt(run.metrics.mvp?.meanDiff)}</td><td class="score ${scoreClass(run.metrics.parent_dialogue?.meanDiff)}">${fmt(run.metrics.parent_dialogue?.meanDiff)}</td><td class="score ${scoreClass(run.metrics.outcome?.meanDiff)}">${fmt(run.metrics.outcome?.meanDiff)}</td><td>${escapeHtml(run.decisionRationale || '')}</td></tr>`).join('')}
    </tbody>
  </table>`;
}

function renderAblationTable(rows) {
  if (!rows.length) return '<p>No ablation comparisons found.</p>';
  return `<table>
    <thead><tr><th>File</th><th>Ablation</th><th>MVP full-minus-ablation</th><th>Parent</th><th>Outcome</th></tr></thead>
    <tbody>
      ${rows.map((row) => `<tr><td><code>${escapeHtml(row.relativeFile || row.file)}</code></td><td><code>${escapeHtml(row.ablationCondition)}</code></td><td class="score ${scoreClass(row.metrics.mvp?.summary.meanDiff)}">${fmt(row.metrics.mvp?.summary.meanDiff)}</td><td class="score ${scoreClass(row.metrics.parent_dialogue?.summary.meanDiff)}">${fmt(row.metrics.parent_dialogue?.summary.meanDiff)}</td><td class="score ${scoreClass(row.metrics.outcome?.summary.meanDiff)}">${fmt(row.metrics.outcome?.summary.meanDiff)}</td></tr>`).join('')}
    </tbody>
  </table>`;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function fmt(value) {
  return typeof value === 'number' ? value.toFixed(3) : 'n/a';
}

function scoreClass(value) {
  if (typeof value !== 'number') return '';
  if (value > 0) return 'good';
  if (value < 0) return 'bad';
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
