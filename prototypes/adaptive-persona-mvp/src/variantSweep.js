import { isReflexiveCondition } from './reflexiveVariants.js';
import {
  conditionMetricValues,
  pairedMetricDifferences,
  summarizePairedDifferences,
  summarizeValues,
} from './statistics.js';

export const DEFAULT_DISCIPLINARY_SCENARIOS = Object.freeze([
  'fractions_denominator_size_closed_loop',
  'ai_bias_single_cause_closed_loop',
  'stats_confounding_closed_loop',
]);

export const DEFAULT_HARD_SCENARIOS = Object.freeze([
  'hard_fractions_forgetful_resistant_closed_loop',
  'hard_ai_bias_resistant_closed_loop',
  'hard_stats_confounding_skeptical_closed_loop',
]);

export const DEFAULT_HELDOUT_HARD_SCENARIOS = Object.freeze([
  'heldout_argument_warrant_resistant_closed_loop',
  'heldout_science_variable_control_resistant_closed_loop',
  'heldout_programming_debugging_resistant_closed_loop',
  'heldout_social_measurement_resistant_closed_loop',
]);

export const DEFAULT_HIDDEN_STATE_TRAP_SCENARIOS = Object.freeze([
  'trap_argument_warrant_false_mastery_closed_loop',
  'trap_science_variable_control_false_mastery_closed_loop',
  'trap_programming_debugging_false_mastery_closed_loop',
  'trap_social_measurement_false_mastery_closed_loop',
]);

export const DEFAULT_SWEEP_CONDITIONS = Object.freeze([
  'static_codex',
  'controller_codex',
  'controller_reflexive_codex',
  'controller_reflexive_psychodynamic_codex',
  'controller_reflexive_dialogical_codex',
]);

export const PUBLIC_METRICS = Object.freeze(['mvp', 'parent_dialogue', 'outcome']);
export const MECHANISM_METRICS = Object.freeze(['deliberation', 'psychodynamic']);

export function buildVariantSweepReport({
  reports,
  scenarioIds,
  conditions = DEFAULT_SWEEP_CONDITIONS,
  baselineCondition = 'static_codex',
  learnerMode = 'rule',
  dryRun = false,
  deepReflexive = false,
  model = 'codex-cli-default',
  judgeModel = 'codex-cli-default',
  parentJudgeModel = 'codex-cli-default',
  permutations = 10_000,
} = {}) {
  const targets = conditions.filter((condition) => condition !== baselineCondition);
  const targetSummaries = Object.fromEntries(targets.map((targetCondition) => {
    const publicStats = Object.fromEntries(PUBLIC_METRICS.map((metric) => {
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
    const mechanismStats = isReflexiveCondition(targetCondition)
      ? Object.fromEntries(MECHANISM_METRICS.map((metric) => {
          const rows = conditionMetricValues(reports, {
            condition: targetCondition,
            metric,
          });
          return [metric, {
            rows,
            summary: summarizeValues(rows.map((row) => row.score), { permutations }),
          }];
        }))
      : {};
    return [targetCondition, {
      targetCondition,
      publicStats,
      mechanismStats,
      challengeStats: summarizeChallengeStats(reports, { condition: targetCondition }),
      decision: decideVariant(publicStats, mechanismStats, { dryRun }),
    }];
  }));

  return {
    generatedAt: new Date().toISOString(),
    scenarioIds,
    conditions,
    baselineCondition,
    targets,
    learnerMode,
    dryRun,
    deepReflexive,
    model,
    judgeModel,
    parentJudgeModel,
    permutations,
    targetSummaries,
    recommendedCandidates: rankCandidates(targetSummaries),
    reports,
  };
}

export function decideVariant(publicStats, mechanismStats = {}, { dryRun = false } = {}) {
  const publicRows = Object.entries(publicStats).map(([metric, stat]) => ({
    metric,
    ...stat.summary,
  }));
  const positiveMetrics = publicRows
    .filter((row) => typeof row.meanDiff === 'number' && row.meanDiff > 0)
    .map((row) => row.metric);
  const negativeMetrics = publicRows
    .filter((row) => typeof row.meanDiff === 'number' && row.meanDiff < -5)
    .map((row) => row.metric);
  const significantMetrics = publicRows
    .filter((row) => row.nonTrivialPositive)
    .map((row) => row.metric);
  const mechanismRows = Object.entries(mechanismStats).map(([metric, stat]) => ({
    metric,
    ...stat.summary,
  }));
  const mechanismMean = average(mechanismRows.map((row) => row.mean));
  const compositeMeanDiff = average(publicRows.map((row) => row.meanDiff));
  const publicTriagePass = positiveMetrics.length >= 2 && negativeMetrics.length === 0;
  const significancePass = !dryRun && significantMetrics.length > 0 && negativeMetrics.length === 0;

  return {
    publicTriagePass,
    significancePass,
    dryRun,
    positiveMetrics,
    negativeMetrics,
    significantMetrics,
    mechanismMean,
    compositeMeanDiff,
    rationale: summarizeDecision({
      dryRun,
      publicTriagePass,
      significancePass,
      positiveMetrics,
      negativeMetrics,
      significantMetrics,
      mechanismMean,
      compositeMeanDiff,
    }),
  };
}

export function rankCandidates(targetSummaries) {
  return Object.values(targetSummaries)
    .filter((summary) => summary.decision.publicTriagePass || summary.decision.significancePass)
    .sort((a, b) => {
      if (a.decision.significancePass !== b.decision.significancePass) {
        return a.decision.significancePass ? -1 : 1;
      }
      if (a.decision.publicTriagePass !== b.decision.publicTriagePass) {
        return a.decision.publicTriagePass ? -1 : 1;
      }
      const mechanismDelta = (b.decision.mechanismMean ?? -Infinity) - (a.decision.mechanismMean ?? -Infinity);
      if (mechanismDelta !== 0) return mechanismDelta;
      return (b.decision.compositeMeanDiff ?? -Infinity) - (a.decision.compositeMeanDiff ?? -Infinity);
    })
    .map((summary, index) => ({
      rank: index + 1,
      targetCondition: summary.targetCondition,
      decision: summary.decision,
    }));
}

export function renderVariantSweepHtml(report) {
  const targetRows = Object.values(report.targetSummaries);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Adaptive Tutor Variant Sweep</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f8fa; color: #17202a; line-height: 1.45; }
    header { padding: 28px 34px 18px; background: #fff; border-bottom: 1px solid #d9e0e7; }
    main { padding: 24px 34px 44px; max-width: 1500px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    h2 { margin: 28px 0 12px; font-size: 20px; }
    h3 { margin: 18px 0 10px; font-size: 17px; }
    .meta { color: #5e6b78; display: flex; flex-wrap: wrap; gap: 16px; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d9e0e7; border-radius: 8px; overflow: hidden; }
    th, td { text-align: left; vertical-align: top; border-bottom: 1px solid #d9e0e7; padding: 9px 10px; font-size: 13px; }
    th { background: #eef3f7; font-weight: 650; }
    tr:last-child td { border-bottom: 0; }
    .score { font-weight: 750; font-variant-numeric: tabular-nums; }
    .good { color: #087443; }
    .bad { color: #b42318; }
    .muted { color: #5e6b78; }
    .evidence { max-width: 420px; }
    .quote { color: #344054; }
    code { background: #eef3f7; padding: 1px 4px; border-radius: 4px; }
  </style>
</head>
<body>
  <header>
    <h1>Adaptive Tutor Variant Sweep</h1>
    <div class="meta">
      <span>Generated: ${escapeHtml(report.generatedAt)}</span>
      <span>Baseline: <code>${escapeHtml(report.baselineCondition)}</code></span>
      <span>Repeats: <code>${escapeHtml(report.reports.length)}</code></span>
      <span>Dry run: <code>${report.dryRun}</code></span>
      <span>Deep reflexive: <code>${report.deepReflexive}</code></span>
    </div>
  </header>
  <main>
    <h2>Recommended Candidates</h2>
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Condition</th>
          <th>Decision</th>
          <th>Composite Public Diff</th>
          <th>Mechanism Mean</th>
        </tr>
      </thead>
      <tbody>
        ${report.recommendedCandidates.length > 0 ? report.recommendedCandidates.map((candidate) => `
        <tr>
          <td>${candidate.rank}</td>
          <td><code>${escapeHtml(candidate.targetCondition)}</code></td>
          <td>${escapeHtml(candidate.decision.rationale)}</td>
          <td class="score ${scoreClass(candidate.decision.compositeMeanDiff)}">${format(candidate.decision.compositeMeanDiff)}</td>
          <td class="score ${mechanismClass(candidate.decision.mechanismMean)}">${format(candidate.decision.mechanismMean)}</td>
        </tr>`).join('') : '<tr><td colspan="5">No target passed the public triage rule.</td></tr>'}
      </tbody>
    </table>

    <h2>Public Adaptation Metrics</h2>
    <table>
      <thead>
        <tr>
          <th>Target</th>
          <th>MVP Mean Diff</th>
          <th>MVP p</th>
          <th>Parent Mean Diff</th>
          <th>Parent p</th>
          <th>Outcome Mean Diff</th>
          <th>Outcome p</th>
          <th>Positive Metrics</th>
          <th>Significant Metrics</th>
          <th>Triage</th>
        </tr>
      </thead>
      <tbody>
        ${targetRows.map((row) => `
        <tr>
          <td><code>${escapeHtml(row.targetCondition)}</code></td>
          ${metricCells(row.publicStats.mvp)}
          ${metricCells(row.publicStats.parent_dialogue)}
          ${metricCells(row.publicStats.outcome)}
          <td>${escapeHtml(row.decision.positiveMetrics.join(', ') || 'none')}</td>
          <td>${escapeHtml(row.decision.significantMetrics.join(', ') || 'none')}</td>
          <td>${row.decision.publicTriagePass ? 'pass' : 'fail'}</td>
        </tr>`).join('')}
      </tbody>
    </table>

    <h2>Challenge-State Mechanism Checks</h2>
    <table>
      <thead>
        <tr>
          <th>Target</th>
          <th>Hard Branches</th>
          <th>Detected Challenge</th>
          <th>Escalated</th>
          <th>Directive Applied</th>
          <th>Resolved</th>
          <th>Outcome Success</th>
        </tr>
      </thead>
      <tbody>
        ${targetRows.map((row) => `
        <tr>
          <td><code>${escapeHtml(row.targetCondition)}</code></td>
          <td>${row.challengeStats.n}</td>
          <td>${formatRate(row.challengeStats.activeRate)}</td>
          <td>${formatRate(row.challengeStats.escalatedRate)}</td>
          <td>${formatRate(row.challengeStats.directiveRate)}</td>
          <td>${formatRate(row.challengeStats.resolvedRate)}</td>
          <td>${formatRate(row.challengeStats.outcomeSuccessRate)}</td>
        </tr>`).join('')}
      </tbody>
    </table>

    <h2>Mechanism Metrics</h2>
    <table>
      <thead>
        <tr>
          <th>Target</th>
          <th>Deliberation Mean</th>
          <th>Deliberation CI</th>
          <th>Psychodynamic Mean</th>
          <th>Psychodynamic CI</th>
        </tr>
      </thead>
      <tbody>
        ${targetRows.map((row) => `
        <tr>
          <td><code>${escapeHtml(row.targetCondition)}</code></td>
          ${mechanismCells(row.mechanismStats.deliberation)}
          ${mechanismCells(row.mechanismStats.psychodynamic)}
        </tr>`).join('')}
      </tbody>
    </table>

    ${renderLearnerEvidenceTable(report)}
  </main>
</body>
</html>`;
}

function metricCells(stat) {
  const summary = stat?.summary || {};
  return `
    <td class="score ${scoreClass(summary.meanDiff)}">${format(summary.meanDiff)}</td>
    <td>${format(summary.permutationP)}</td>`;
}

function mechanismCells(stat) {
  const summary = stat?.summary || {};
  return `
    <td class="score ${mechanismClass(summary.mean)}">${format(summary.mean)}</td>
    <td>${format(summary.bootstrap95Ci?.[0])} to ${format(summary.bootstrap95Ci?.[1])}</td>`;
}

function renderLearnerEvidenceTable(report) {
  const rows = learnerEvidenceRows(report);
  if (rows.length === 0) return '';
  return `
    <h2>Learner-Owned Transfer Evidence</h2>
    <table>
      <thead>
        <tr>
          <th>Repeat</th>
          <th>Scenario</th>
          <th>Condition</th>
          <th>Branch</th>
          <th>Outcome</th>
          <th>Missing Checks</th>
          <th>Learner Transcript Evidence</th>
          <th>Outcome Answer</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
        <tr>
          <td>${row.repeat}</td>
          <td><code>${escapeHtml(row.scenarioId)}</code></td>
          <td><code>${escapeHtml(row.condition)}</code></td>
          <td>${escapeHtml(row.branchName)}</td>
          <td class="score ${row.success ? 'good' : 'bad'}">${row.success ? 'pass' : 'fail'}</td>
          <td>${escapeHtml(row.missingChecks || 'none')}</td>
          <td class="evidence quote">${escapeHtml(row.transcriptEvidence || 'No learner transfer marker found.')}</td>
          <td class="evidence quote">${escapeHtml(row.outcomeAnswer || 'n/a')}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

function learnerEvidenceRows(report) {
  const rows = [];
  for (const sourceReport of report.reports || []) {
    for (const scenario of sourceReport.results || []) {
      if (!scenario.challengeProfile?.hidden_state_trap) continue;
      for (const condition of report.conditions || []) {
        const conditionResult = scenario.conditions?.[condition];
        if (!conditionResult) continue;
        for (const branchName of ['original', 'counterfactual']) {
          const branch = conditionResult[branchName];
          if (!branch?.outcomeTask?.validation?.applicable) continue;
          rows.push({
            repeat: sourceReport.repeat ?? 0,
            scenarioId: scenario.scenarioId,
            condition,
            branchName,
            success: Boolean(branch.outcomeTask.success),
            missingChecks: (branch.outcomeTask.validation.missing || []).join(', '),
            transcriptEvidence: extractLearnerTransferEvidence(branch, scenario.scenarioId),
            outcomeAnswer: compactText(branch.outcomeTask.learner_answer),
          });
        }
      }
    }
  }
  return rows;
}

function extractLearnerTransferEvidence(branch, scenarioId) {
  const learnerMessages = (branch.transcript || [])
    .filter((turn) => turn.role === 'learner')
    .map((turn) => String(turn.content || ''));
  const marker = transferMarkerPattern(scenarioId);
  const evidence = learnerMessages.filter((message) => marker.test(message));
  const selected = evidence.length > 0 ? evidence.at(-1) : learnerMessages.at(-1);
  return compactText(selected);
}

function transferMarkerPattern(scenarioId) {
  if (String(scenarioId).includes('argument_warrant')) {
    return /school[- ]uniform|uniform|single quote|cannot prove|stronger evidence|different policy|new policy/i;
  }
  if (String(scenarioId).includes('science_variable_control')) {
    return /next experiment|future experiment|team a|team b|fertilizer type|same fair-test rule|only fertilizer|different watering|blue light|flawed setup/i;
  }
  if (String(scenarioId).includes('programming_debugging')) {
    return /cart|invoice|order|payment|missing|invalid|undefined|lineTotal|regression|legitimate zero|reject|handle/i;
  }
  if (String(scenarioId).includes('social_measurement')) {
    return /course belonging|belonging item|single item|multi[- ]item|test-retest|cognitive interview|cannot prove|can't prove|new survey/i;
  }
  return /transfer|future|next|different|cannot prove/i;
}

function compactText(value, maxLength = 260) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

export function summarizeChallengeStats(reports, { condition } = {}) {
  const rows = [];
  for (const report of reports) {
    for (const scenario of report.results || []) {
      if (scenario.challengeProfile?.mode !== 'hard') continue;
      const conditionResult = scenario.conditions?.[condition];
      if (!conditionResult) continue;
      for (const branchName of ['original', 'counterfactual']) {
        const branch = conditionResult[branchName];
        const trace = branch?.stateTrace || [];
        const levels = trace.map((turn) => turn.challengeState?.level).filter(Boolean);
        const directiveTurns = trace
          .filter((turn) => typeof turn.policy?.challengeDirective === 'string' && turn.policy.challengeDirective)
          .length;
        rows.push({
          scenarioId: scenario.scenarioId,
          branchName,
          active: levels.some((level) => ['active', 'escalated', 'resolved'].includes(level)),
          escalated: levels.includes('escalated'),
          directiveApplied: directiveTurns > 0,
          resolved: levels.includes('resolved'),
          outcomeSuccess: Boolean(branch?.outcomeTask?.success),
        });
      }
    }
  }

  return {
    n: rows.length,
    activeRate: rate(rows, 'active'),
    escalatedRate: rate(rows, 'escalated'),
    directiveRate: rate(rows, 'directiveApplied'),
    resolvedRate: rate(rows, 'resolved'),
    outcomeSuccessRate: rate(rows, 'outcomeSuccess'),
    rows,
  };
}

function summarizeDecision({
  dryRun,
  publicTriagePass,
  significancePass,
  positiveMetrics,
  negativeMetrics,
  significantMetrics,
  mechanismMean,
}) {
  if (dryRun && publicTriagePass) {
    const mechanism = typeof mechanismMean === 'number' ? `; mechanism mean ${mechanismMean}` : '';
    return `dry-run triage signal on ${positiveMetrics.join(', ')}${mechanism}`;
  }
  if (significancePass) {
    return `confirmed on ${significantMetrics.join(', ')}`;
  }
  if (publicTriagePass) {
    const mechanism = typeof mechanismMean === 'number' ? `; mechanism mean ${mechanismMean}` : '';
    return `triage pass on ${positiveMetrics.join(', ')}${mechanism}`;
  }
  if (negativeMetrics.length > 0) {
    return `blocked by negative ${negativeMetrics.join(', ')}`;
  }
  return positiveMetrics.length > 0
    ? `weak signal on ${positiveMetrics.join(', ')}`
    : 'no positive public signal';
}

function average(values) {
  const numeric = values.filter((value) => typeof value === 'number' && Number.isFinite(value));
  if (numeric.length === 0) return null;
  return Number((numeric.reduce((sum, value) => sum + value, 0) / numeric.length).toFixed(3));
}

function format(value) {
  return typeof value === 'number' ? value.toFixed(3) : 'n/a';
}

function formatRate(value) {
  return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : 'n/a';
}

function rate(rows, key) {
  if (rows.length === 0) return null;
  return Number((rows.filter((row) => row[key]).length / rows.length).toFixed(3));
}

function scoreClass(value) {
  if (typeof value !== 'number') return '';
  if (value > 0) return 'good';
  if (value < 0) return 'bad';
  return '';
}

function mechanismClass(value) {
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
