import { STATIC_BASELINE_PROMPT_SUMMARY } from './assessmentPrompts.js';
import {
  estimateAssessmentProgressUnits,
  loadAssessmentScenarios,
  runRealAssessment,
} from './assessmentHarness.js';
import { judgeWithParentDialogueRubric } from './parentRubricJudge.js';
import { withProgress } from './progressMonitor.js';

export async function runRubricComparison({
  scenarioId = null,
  scenarioIds = null,
  learnerMode = 'rule',
  model = null,
  judgeModel = null,
  parentJudgeModel = null,
  conditions = ['static_codex', 'controller_codex'],
  reflexiveVariant = null,
  timeoutMs = 360_000,
  dryRun = false,
  keepPrompts = false,
  onProgress = null,
} = {}) {
  const results = await runRealAssessment({
    scenarioId,
    scenarioIds,
    conditions,
    learnerMode,
    model,
    judgeModel,
    reflexiveVariant,
    timeoutMs,
    dryRun,
    keepPrompts,
    onProgress,
  });

  for (const scenarioResult of results) {
    for (const [condition, conditionPayload] of Object.entries(scenarioResult.conditions)) {
      for (const branchName of ['original', 'counterfactual']) {
        const branch = conditionPayload[branchName];
        branch.parentDialogueJudge = await withProgress(onProgress, {
          phase: 'parent-rubric',
          scenarioId: scenarioResult.scenarioId,
          condition,
          branchName,
          step: 'parent dialogue judge',
        }, async () => judgeWithParentDialogueRubric({
          scenario: scenarioResult,
          branch,
          model: parentJudgeModel || judgeModel || model,
          timeoutMs,
          dryRun,
          keepPrompt: keepPrompts,
        }));
      }
    }
    scenarioResult.comparisons.rubrics = compareRubricsAcrossConditions(scenarioResult.conditions);
    scenarioResult.comparisons.conditionAverages = compareConditionAverages(scenarioResult.conditions);
  }

  return {
    generatedAt: new Date().toISOString(),
    learnerMode,
    conditions,
    baselinePromptSummary: STATIC_BASELINE_PROMPT_SUMMARY,
    rubrics: {
      mvpAdaptation: 'Blind transcript/outcome adaptation judge: behavioral_adaptation, responsiveness_to_learner_evidence, productive_scaffolding, outcome_task_success, overpersonalization_risk.',
      parentDialogue: 'Parent project Dialogue Quality Rubric v2.2: pedagogical_progression, dialogical_responsiveness, knowledge_co_construction, productive_tension_management, transformation_evidence, interactional_coherence.',
    },
    results,
  };
}

export function estimateRubricComparisonProgressUnits({
  scenarioId = null,
  scenarioIds = null,
  conditions = ['static_codex', 'controller_codex'],
  learnerMode = 'rule',
} = {}) {
  const scenarios = loadAssessmentScenarios({ scenarioId, scenarioIds });
  const branchCount = scenarios.length * conditions.length * 2;
  return estimateAssessmentProgressUnits({ scenarios, conditions, learnerMode }) + branchCount;
}

export function renderRubricComparisonHtml(report) {
  const rows = [];
  const aggregates = [];
  for (const scenario of report.results) {
    const conditionAverages = scenario.comparisons?.conditionAverages || compareConditionAverages(scenario.conditions);
    for (const [condition, aggregate] of Object.entries(conditionAverages)) {
      aggregates.push({
        scenario: scenario.scenarioId,
        discipline: scenario.discipline,
        condition,
        ...aggregate,
      });
    }
    for (const [condition, payload] of Object.entries(scenario.conditions)) {
      for (const branchName of ['original', 'counterfactual']) {
        const branch = payload[branchName];
        rows.push({
          scenario: scenario.scenarioId,
          discipline: scenario.discipline,
          condition,
          branch: branchName,
          hidden: branch.hiddenType,
          outcome: branch.outcomeTask.success,
          mvpScore: branch.blindJudge?.weighted_score ?? null,
          parentScore: branch.parentDialogueJudge?.weighted_score ?? null,
          mvpVerdict: branch.blindJudge?.verdict || '',
          parentVerdict: branch.parentDialogueJudge?.verdict || '',
          transcript: branch.transcript,
          reflexiveSummary: summarizeReflexiveBranch(branch),
        });
      }
    }
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Adaptive Persona MVP Rubric Comparison</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f8fa;
      --panel: #ffffff;
      --ink: #18202a;
      --muted: #5e6b78;
      --line: #d9e0e7;
      --accent: #0f766e;
      --accent-2: #7c3aed;
      --accent-3: #c2410c;
      --bad: #b42318;
      --good: #087443;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--ink);
      line-height: 1.45;
    }
    header {
      padding: 28px 34px 18px;
      background: #ffffff;
      border-bottom: 1px solid var(--line);
    }
    h1 { margin: 0 0 8px; font-size: 28px; }
    h2 { margin: 28px 0 12px; font-size: 20px; }
    h3 { margin: 0 0 10px; font-size: 17px; }
    p { margin: 8px 0; }
    main { padding: 24px 34px 40px; max-width: 1500px; }
    .meta {
      color: var(--muted);
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      font-size: 14px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 14px;
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 16px;
    }
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }
    th, td {
      text-align: left;
      vertical-align: top;
      border-bottom: 1px solid var(--line);
      padding: 9px 10px;
      font-size: 13px;
    }
    th { background: #eef3f7; font-weight: 650; }
    tr:last-child td { border-bottom: 0; }
    .score {
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .score.good { color: var(--good); }
    .score.bad { color: var(--bad); }
    .badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 999px;
      background: #eef3f7;
      color: var(--muted);
      font-size: 12px;
      white-space: nowrap;
    }
    .condition-static_codex { border-left: 4px solid var(--accent-2); }
    .condition-controller_codex { border-left: 4px solid var(--accent); }
    .condition-controller_reflexive_codex { border-left: 4px solid var(--accent-3); }
    details {
      margin-top: 8px;
      border-top: 1px solid var(--line);
      padding-top: 8px;
    }
    summary { cursor: pointer; color: var(--accent); font-weight: 650; }
    .turn {
      display: grid;
      grid-template-columns: 72px 1fr;
      gap: 8px;
      padding: 8px 0;
      border-bottom: 1px dashed var(--line);
      font-size: 13px;
    }
    .turn:last-child { border-bottom: 0; }
    .role {
      font-weight: 700;
      color: var(--muted);
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: .04em;
    }
    .note {
      background: #fff7ed;
      border: 1px solid #fed7aa;
      padding: 12px 14px;
      border-radius: 8px;
    }
    code { background: #eef3f7; padding: 1px 4px; border-radius: 4px; }
  </style>
</head>
<body>
  <header>
    <h1>Adaptive Persona MVP Rubric Comparison</h1>
    <div class="meta">
      <span>Generated: ${escapeHtml(report.generatedAt)}</span>
      <span>Learner mode: <code>${escapeHtml(report.learnerMode)}</code></span>
      <span>Conditions: ${report.conditions.map((condition) => `<code>${escapeHtml(condition)}</code>`).join(' ')}</span>
    </div>
  </header>
  <main>
    <section class="grid">
      <div class="card">
        <h3>MVP Adaptation Rubric</h3>
        <p>${escapeHtml(report.rubrics.mvpAdaptation)}</p>
      </div>
      <div class="card">
        <h3>Parent Dialogue Rubric</h3>
        <p>${escapeHtml(report.rubrics.parentDialogue)}</p>
      </div>
      <div class="card">
        <h3>Baseline Prompt</h3>
        <p>${escapeHtml(report.baselinePromptSummary)}</p>
      </div>
    </section>

    <h2>Condition Comparison</h2>
    <table class="summary-table">
      <thead>
        <tr>
          <th>Scenario</th>
          <th>Discipline</th>
          <th>Condition</th>
          <th>MVP Avg.</th>
          <th>MVP vs Static</th>
          <th>MVP vs Controller</th>
          <th>Parent Avg.</th>
          <th>Parent vs Static</th>
          <th>Parent vs Controller</th>
        </tr>
      </thead>
      <tbody>
        ${aggregates.map((row) => `
        <tr>
          <td>${escapeHtml(row.scenario)}</td>
          <td>${escapeHtml(row.discipline)}</td>
          <td><span class="badge">${escapeHtml(row.condition)}</span></td>
          <td class="score ${scoreClass(row.mvpAvg)}">${formatScore(row.mvpAvg)}</td>
          <td class="score ${deltaClass(row.mvpDeltaVsStatic)}">${formatDelta(row.mvpDeltaVsStatic)}</td>
          <td class="score ${deltaClass(row.mvpDeltaVsController)}">${formatDelta(row.mvpDeltaVsController)}</td>
          <td class="score ${scoreClass(row.parentAvg)}">${formatScore(row.parentAvg)}</td>
          <td class="score ${deltaClass(row.parentDeltaVsStatic)}">${formatDelta(row.parentDeltaVsStatic)}</td>
          <td class="score ${deltaClass(row.parentDeltaVsController)}">${formatDelta(row.parentDeltaVsController)}</td>
        </tr>`).join('')}
      </tbody>
    </table>

    <h2>Score Summary</h2>
    <table class="summary-table">
      <thead>
        <tr>
          <th>Scenario</th>
          <th>Discipline</th>
          <th>Condition</th>
          <th>Branch</th>
          <th>Outcome</th>
          <th>MVP Adapt.</th>
          <th>Parent Dialogue</th>
          <th>Verdicts</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
        <tr>
          <td>${escapeHtml(row.scenario)}</td>
          <td>${escapeHtml(row.discipline)}</td>
          <td><span class="badge">${escapeHtml(row.condition)}</span></td>
          <td>${escapeHtml(row.branch)}<br><span class="badge">${escapeHtml(row.hidden)}</span></td>
          <td>${row.outcome ? 'success' : 'fail'}</td>
          <td class="score ${scoreClass(row.mvpScore)}">${formatScore(row.mvpScore)}</td>
          <td class="score ${scoreClass(row.parentScore)}">${formatScore(row.parentScore)}</td>
          <td><strong>MVP:</strong> ${escapeHtml(row.mvpVerdict)}<br><strong>Parent:</strong> ${escapeHtml(row.parentVerdict)}</td>
        </tr>`).join('')}
      </tbody>
    </table>

    <h2>Transcripts</h2>
    <div class="grid">
      ${rows.map((row) => `
      <article class="card condition-${escapeHtml(row.condition)}">
        <h3>${escapeHtml(row.scenario)} / ${escapeHtml(row.condition)} / ${escapeHtml(row.branch)}</h3>
        <p><span class="badge">${escapeHtml(row.discipline)}</span> <span class="badge">${escapeHtml(row.hidden)}</span> Outcome: <strong>${row.outcome ? 'success' : 'fail'}</strong></p>
        <p>MVP ${formatScore(row.mvpScore)} / Parent ${formatScore(row.parentScore)}</p>
        ${row.reflexiveSummary ? `<p>${escapeHtml(row.reflexiveSummary)}</p>` : ''}
        <details>
          <summary>Transcript</summary>
          ${row.transcript.map((turn) => `
          <div class="turn">
            <div class="role">${escapeHtml(turn.role)}</div>
            <div>${escapeHtml(turn.content)}</div>
          </div>`).join('')}
        </details>
      </article>`).join('')}
    </div>
  </main>
</body>
</html>`;
}

export function compareRubricsAcrossConditions(conditionResults) {
  const staticBranches = branchesFor(conditionResults.static_codex);
  const controllerBranches = branchesFor(conditionResults.controller_codex);
  const staticMvpAvg = average(staticBranches.map((b) => b.blindJudge?.weighted_score));
  const controllerMvpAvg = average(controllerBranches.map((b) => b.blindJudge?.weighted_score));
  const staticParentAvg = average(staticBranches.map((b) => b.parentDialogueJudge?.weighted_score));
  const controllerParentAvg = average(controllerBranches.map((b) => b.parentDialogueJudge?.weighted_score));
  return {
    staticMvpAvg,
    controllerMvpAvg,
    mvpDelta: numericDelta(controllerMvpAvg, staticMvpAvg),
    staticParentAvg,
    controllerParentAvg,
    parentDelta: numericDelta(controllerParentAvg, staticParentAvg),
  };
}

export function compareConditionAverages(conditionResults) {
  const entries = Object.entries(conditionResults).map(([condition, payload]) => {
    const branches = branchesFor(payload);
    return [condition, {
      mvpAvg: average(branches.map((b) => b.blindJudge?.weighted_score)),
      parentAvg: average(branches.map((b) => b.parentDialogueJudge?.weighted_score)),
    }];
  });
  const out = Object.fromEntries(entries);
  const staticMvp = out.static_codex?.mvpAvg ?? null;
  const staticParent = out.static_codex?.parentAvg ?? null;
  const controllerMvp = out.controller_codex?.mvpAvg ?? null;
  const controllerParent = out.controller_codex?.parentAvg ?? null;
  for (const aggregate of Object.values(out)) {
    aggregate.mvpDeltaVsStatic = numericDelta(aggregate.mvpAvg, staticMvp);
    aggregate.parentDeltaVsStatic = numericDelta(aggregate.parentAvg, staticParent);
    aggregate.mvpDeltaVsController = numericDelta(aggregate.mvpAvg, controllerMvp);
    aggregate.parentDeltaVsController = numericDelta(aggregate.parentAvg, controllerParent);
  }
  return out;
}

function summarizeReflexiveBranch(branch) {
  const reflexiveTurns = branch.stateTrace?.filter((turn) => turn.reflexiveTrace) || [];
  if (reflexiveTurns.length === 0) return '';
  const risks = reflexiveTurns
    .map((turn) => turn.reflexiveTrace.superegoCritique?.adaptation_risk)
    .filter(Boolean);
  const revisions = reflexiveTurns
    .map((turn) => turn.reflexiveTrace.egoRevision?.revision_note)
    .filter(Boolean);
  const finalFocus = reflexiveTurns.at(-1)?.reflexiveMemory?.currentFocus || '';
  return [
    `Reflexive turns: ${reflexiveTurns.length}`,
    risks.length ? `Superego risks: ${risks.join(', ')}` : '',
    revisions.length ? `Revision: ${revisions.at(-1)}` : '',
    finalFocus ? `Memory focus: ${finalFocus}` : '',
  ].filter(Boolean).join(' | ');
}

function branchesFor(conditionPayload) {
  if (!conditionPayload) return [];
  return ['original', 'counterfactual'].map((branch) => conditionPayload[branch]).filter(Boolean);
}

function average(values) {
  const numeric = values.filter((v) => typeof v === 'number');
  if (numeric.length === 0) return null;
  return Number((numeric.reduce((sum, value) => sum + value, 0) / numeric.length).toFixed(1));
}

function numericDelta(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') return null;
  return Number((a - b).toFixed(1));
}

function formatScore(score) {
  return typeof score === 'number' ? score.toFixed(1) : 'n/a';
}

function formatDelta(score) {
  if (typeof score !== 'number') return 'n/a';
  return score > 0 ? `+${score.toFixed(1)}` : score.toFixed(1);
}

function scoreClass(score) {
  if (typeof score !== 'number') return '';
  if (score >= 80) return 'good';
  if (score < 60) return 'bad';
  return '';
}

function deltaClass(score) {
  if (typeof score !== 'number') return '';
  if (score > 0) return 'good';
  if (score < 0) return 'bad';
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
