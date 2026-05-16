import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import { callCodexJson } from './codexCli.js';
import { isReflexiveCondition } from './reflexiveVariants.js';
import { jaccardDistance } from './textMetrics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTOTYPE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PROTOTYPE_ROOT, '..', '..');

export function loadParentDeliberationRubric() {
  const p = path.join(REPO_ROOT, 'config', 'evaluation-rubric-deliberation.yaml');
  return yaml.parse(fs.readFileSync(p, 'utf-8'));
}

export function extractReflexiveTurns(branch) {
  return (branch.stateTrace || [])
    .filter((turn) => turn.reflexiveTrace)
    .map((turn) => ({
      eventId: turn.eventId,
      learner: turn.learner,
      policy: turn.policy?.selectedPolicy || null,
      outcomeGate: turn.policy?.outcomeGate || null,
      actionTemplate: turn.policy?.actionTemplate || null,
      egoDraft: turn.reflexiveTrace.egoDraft,
      superegoCritique: turn.reflexiveTrace.superegoCritique,
      egoRevision: turn.reflexiveTrace.egoRevision,
      finalTutorMessage: turn.tutorMessage,
      reflexiveMemory: turn.reflexiveMemory,
    }));
}

export function computeReflexiveMetrics(branch) {
  const turns = extractReflexiveTurns(branch);
  const revisionDistances = turns.map((turn) => Number(jaccardDistance(
    turn.egoDraft?.draft_message || '',
    turn.egoRevision?.tutor_message || turn.finalTutorMessage || '',
  ).toFixed(3)));
  const risks = turns.map((turn) => turn.superegoCritique?.adaptation_risk || 'unknown');
  const riskCounts = risks.reduce((acc, risk) => {
    acc[risk] = (acc[risk] || 0) + 1;
    return acc;
  }, {});
  const memoryFocuses = turns.map((turn) => turn.reflexiveMemory?.currentFocus || '').filter(Boolean);
  const uniqueMemoryFocuses = new Set(memoryFocuses);
  const repairGateTurns = turns.filter((turn) => turn.outcomeGate?.status === 'repair_required').length;
  const actionTemplateTurns = turns.filter((turn) => turn.actionTemplate).length;
  const materialRevisionTurns = revisionDistances.filter((d) => d >= 0.25).length;

  return {
    turnCount: turns.length,
    riskCounts,
    risks,
    repairGateTurns,
    actionTemplateTurns,
    revisionDistances,
    avgRevisionDistance: average(revisionDistances),
    materialRevisionTurns,
    memoryFocuses,
    memoryEvolved: uniqueMemoryFocuses.size > 1,
    outcomeSuccess: Boolean(branch.outcomeTask?.success),
  };
}

export function buildReflexiveDeliberationPrompt({ scenario, branch, rubric, metrics }) {
  const compactRubric = {
    name: rubric.name,
    version: rubric.version,
    scale: rubric.scale,
    dimensions: Object.fromEntries(
      Object.entries(rubric.dimensions || {}).map(([key, value]) => [
        key,
        {
          name: value.name,
          weight: value.weight,
          description: value.description,
          criteria: value.criteria,
          markers: value.markers,
          note_for_single_turn: value.note_for_single_turn,
        },
      ]),
    ),
  };
  const turns = extractReflexiveTurns(branch);

  return `You are applying the parent project's Deliberation Quality Rubric to an internal tutor Ego/Superego trace.

Do not edit files. Judge the internal deliberation process, not only the final learner-facing transcript.

Return only JSON:
{
  "scores": {
    "critique_substance": 1,
    "revision_impact": 1,
    "deliberation_depth": 1,
    "insight_generation": 1,
    "process_coherence": 1,
    "cross_turn_evolution": 1
  },
  "weighted_score": 0,
  "verdict": "short verdict",
  "evidence": ["short evidence from the ego/superego trace"],
  "failure_modes": []
}

Scoring:
- Dimension scores are 1-5 integers.
- weighted_score must be normalized to 0-100 using ((weighted_avg - 1) / 4) * 100.
- Reward genuine internal tension that changes the final tutor message.
- Penalize rubber-stamping, generic critique, cosmetic revision, or critique that improves the trace without improving the learner-facing move.
- Cross-turn evolution should inspect whether reflexiveMemory and Superego focus changed across turns.

Rubric:
${JSON.stringify(compactRubric, null, 2)}

Scenario:
${JSON.stringify({
  id: scenario.scenarioId || scenario.id,
  discipline: scenario.discipline,
  objective: scenario.objective,
}, null, 2)}

Branch:
${JSON.stringify({
  branchName: branch.branchName,
  hiddenType: branch.hiddenType,
  outcomeTask: branch.outcomeTask,
  blindJudge: branch.blindJudge,
  parentDialogueJudge: branch.parentDialogueJudge,
}, null, 2)}

Local metrics:
${JSON.stringify(metrics, null, 2)}

Internal reflexive turns:
${JSON.stringify(turns, null, 2)}
`;
}

export async function judgeReflexiveDeliberation({
  scenario,
  branch,
  model = null,
  timeoutMs = 360_000,
  dryRun = false,
  keepPrompt = false,
} = {}) {
  const metrics = computeReflexiveMetrics(branch);
  const rubric = loadParentDeliberationRubric();
  const prompt = buildReflexiveDeliberationPrompt({ scenario, branch, rubric, metrics });
  const parsed = dryRun
    ? dryRunReflexiveJudge(metrics)
    : (await callCodexJson(prompt, {
        model,
        timeoutMs,
        label: `reflexive-deliberation:${scenario.scenarioId || scenario.id}:${branch.condition}:${branch.branchName}`,
      })).parsed;
  const normalized = normalizeJudge(parsed);
  normalized.metrics = metrics;
  if (keepPrompt || dryRun) normalized.reflexiveDeliberationPrompt = prompt;
  return normalized;
}

export function renderReflexiveDeepHtml(report) {
  const rows = [];
  for (const scenario of report.results) {
    for (const [conditionName, condition] of Object.entries(scenario.conditions || {})) {
      if (!isReflexiveCondition(conditionName)) continue;
      for (const branchName of ['original', 'counterfactual']) {
        const branch = condition[branchName];
        const judge = branch.reflexiveDeliberationJudge;
        const psychodynamicJudge = branch.psychodynamicAdaptationJudge;
        rows.push({
          scenario: scenario.scenarioId,
          discipline: scenario.discipline,
          conditionName,
          reflexiveVariant: branch.stateTrace?.find((turn) => turn.reflexiveVariant)?.reflexiveVariant || '',
          branchName,
          hiddenType: branch.hiddenType,
          outcome: branch.outcomeTask?.success,
          mvpScore: branch.blindJudge?.weighted_score,
          parentDialogueScore: branch.parentDialogueJudge?.weighted_score,
          deliberationScore: judge?.weighted_score,
          psychodynamicScore: psychodynamicJudge?.weighted_score,
          deliberationVerdict: judge?.verdict || '',
          psychodynamicVerdict: psychodynamicJudge?.verdict || '',
          metrics: judge?.metrics || psychodynamicJudge?.metrics || computeReflexiveMetrics(branch),
          turns: extractReflexiveTurns(branch),
          transcript: branch.transcript,
        });
      }
    }
  }

  const scenarioRows = summarizeByScenario(rows);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Reflexive Adaptation Deep Analysis</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f9;
      --panel: #ffffff;
      --ink: #17202a;
      --muted: #5f6c7a;
      --line: #d8e0e7;
      --accent: #b45309;
      --good: #087443;
      --bad: #b42318;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--bg); color: var(--ink); line-height: 1.45; }
    header { padding: 28px 34px 18px; background: var(--panel); border-bottom: 1px solid var(--line); }
    main { padding: 24px 34px 44px; max-width: 1500px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    h2 { margin: 30px 0 12px; font-size: 20px; }
    h3 { margin: 0 0 8px; font-size: 17px; }
    .meta { color: var(--muted); display: flex; flex-wrap: wrap; gap: 16px; font-size: 14px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 14px; }
    .card { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 16px; }
    table { width: 100%; border-collapse: collapse; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
    th, td { text-align: left; vertical-align: top; border-bottom: 1px solid var(--line); padding: 9px 10px; font-size: 13px; }
    th { background: #eef3f7; font-weight: 650; }
    tr:last-child td { border-bottom: 0; }
    .score { font-weight: 750; font-variant-numeric: tabular-nums; }
    .good { color: var(--good); }
    .bad { color: var(--bad); }
    .badge { display: inline-block; padding: 2px 7px; border-radius: 999px; background: #eef3f7; color: var(--muted); font-size: 12px; white-space: nowrap; }
    details { margin-top: 10px; border-top: 1px solid var(--line); padding-top: 8px; }
    summary { cursor: pointer; color: var(--accent); font-weight: 650; }
    .turn { border-top: 1px dashed var(--line); padding: 10px 0; }
    .label { color: var(--muted); font-weight: 700; font-size: 11px; letter-spacing: .04em; text-transform: uppercase; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #f2f4f7; padding: 10px; border-radius: 6px; font-size: 12px; }
  </style>
</head>
<body>
  <header>
    <h1>Reflexive Adaptation Deep Analysis</h1>
    <div class="meta">
      <span>Generated: ${escapeHtml(report.reflexiveAnalysis?.generatedAt || report.generatedAt)}</span>
      <span>Conditions: <code>${escapeHtml([...new Set(rows.map((row) => row.conditionName))].join(', '))}</code></span>
      <span>Rubric: parent deliberation quality v2.2 + psychodynamic adaptation v0.1 + local reflexive metrics</span>
    </div>
  </header>
  <main>
    <section class="grid">
      <div class="card">
        <h3>What This Measures</h3>
        <p>Whether Ego/Superego deliberation creates genuine internal critique, material revision, cross-turn memory movement, and visible learner-facing improvement.</p>
      </div>
      <div class="card">
        <h3>Key Warning</h3>
        <p>High deliberation can coexist with lower public dialogue quality if the inner loop makes the final tutor move terse, checklist-like, or less co-constructed.</p>
      </div>
    </section>

    <h2>Scenario Summary</h2>
    <table>
      <thead>
        <tr>
          <th>Scenario</th>
          <th>Discipline</th>
          <th>Conditions</th>
          <th>Deliberation Avg.</th>
          <th>Psychodynamic Avg.</th>
          <th>MVP Avg.</th>
          <th>Parent Dialogue Avg.</th>
          <th>Avg Revision Distance</th>
          <th>Material Revisions</th>
        </tr>
      </thead>
      <tbody>
        ${scenarioRows.map((row) => `
        <tr>
          <td>${escapeHtml(row.scenario)}</td>
          <td>${escapeHtml(row.discipline)}</td>
          <td>${escapeHtml(row.conditions.join(', '))}</td>
          <td class="score ${scoreClass(row.deliberationAvg)}">${formatScore(row.deliberationAvg)}</td>
          <td class="score ${scoreClass(row.psychodynamicAvg)}">${formatScore(row.psychodynamicAvg)}</td>
          <td class="score ${scoreClass(row.mvpAvg)}">${formatScore(row.mvpAvg)}</td>
          <td class="score ${scoreClass(row.parentDialogueAvg)}">${formatScore(row.parentDialogueAvg)}</td>
          <td>${formatScore(row.avgRevisionDistance)}</td>
          <td>${row.materialRevisionTurns}</td>
        </tr>`).join('')}
      </tbody>
    </table>

    <h2>Branch Detail</h2>
    <table>
      <thead>
        <tr>
          <th>Scenario</th>
          <th>Condition</th>
          <th>Branch</th>
          <th>Outcome</th>
          <th>Delib.</th>
          <th>Psych.</th>
          <th>MVP</th>
          <th>Parent</th>
          <th>Risks</th>
          <th>Verdict</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
        <tr>
          <td>${escapeHtml(row.scenario)}<br><span class="badge">${escapeHtml(row.discipline)}</span></td>
          <td>${escapeHtml(row.conditionName)}<br><span class="badge">${escapeHtml(row.reflexiveVariant)}</span></td>
          <td>${escapeHtml(row.branchName)}<br><span class="badge">${escapeHtml(row.hiddenType)}</span></td>
          <td>${row.outcome ? 'success' : 'fail'}</td>
          <td class="score ${scoreClass(row.deliberationScore)}">${formatScore(row.deliberationScore)}</td>
          <td class="score ${scoreClass(row.psychodynamicScore)}">${formatScore(row.psychodynamicScore)}</td>
          <td class="score ${scoreClass(row.mvpScore)}">${formatScore(row.mvpScore)}</td>
          <td class="score ${scoreClass(row.parentDialogueScore)}">${formatScore(row.parentDialogueScore)}</td>
          <td>${escapeHtml(row.metrics.risks.join(', '))}</td>
          <td>${escapeHtml(row.deliberationVerdict)}</td>
        </tr>`).join('')}
      </tbody>
    </table>

    <h2>Ego/Superego Traces</h2>
    <div class="grid">
      ${rows.map((row) => `
      <article class="card">
        <h3>${escapeHtml(row.scenario)} / ${escapeHtml(row.branchName)}</h3>
        <p><span class="badge">${escapeHtml(row.conditionName)}</span> <span class="badge">${escapeHtml(row.hiddenType)}</span> Delib. ${formatScore(row.deliberationScore)} | Psych. ${formatScore(row.psychodynamicScore)} | MVP ${formatScore(row.mvpScore)} | Parent ${formatScore(row.parentDialogueScore)}</p>
        <p>Revision distance: ${escapeHtml(row.metrics.revisionDistances.join(', '))}; Memory evolved: ${row.metrics.memoryEvolved ? 'yes' : 'no'}; Material revisions: ${row.metrics.materialRevisionTurns}</p>
        ${row.psychodynamicVerdict ? `<p>${escapeHtml(row.psychodynamicVerdict)}</p>` : ''}
        <details>
          <summary>Transcript</summary>
          ${row.transcript.map((turn) => `<div class="turn"><div class="label">${escapeHtml(turn.role)}</div><div>${escapeHtml(turn.content)}</div></div>`).join('')}
        </details>
        <details>
          <summary>Internal Deliberation</summary>
          ${row.turns.map((turn, idx) => `
          <div class="turn">
            <div class="label">Turn ${idx + 1} / Policy</div>
            <pre>${escapeHtml(JSON.stringify({ eventId: turn.eventId, policy: turn.policy, gate: turn.outcomeGate?.status }, null, 2))}</pre>
            <div class="label">Ego Draft</div>
            <pre>${escapeHtml(turn.egoDraft?.draft_message || '')}</pre>
            <div class="label">Superego Critique</div>
            <pre>${escapeHtml(JSON.stringify(turn.superegoCritique || {}, null, 2))}</pre>
            <div class="label">Ego Revision</div>
            <pre>${escapeHtml(turn.egoRevision?.tutor_message || '')}</pre>
            <div class="label">Memory</div>
            <pre>${escapeHtml(JSON.stringify(turn.reflexiveMemory || {}, null, 2))}</pre>
          </div>`).join('')}
        </details>
      </article>`).join('')}
    </div>
  </main>
</body>
</html>`;
}

function dryRunReflexiveJudge(metrics) {
  const revision = metrics.avgRevisionDistance >= 0.25 ? 4 : 3;
  const critique = metrics.risks.some((risk) => risk !== 'none') ? 4 : 3;
  const evolution = metrics.memoryEvolved ? 4 : 2;
  const scores = {
    critique_substance: critique,
    revision_impact: revision,
    deliberation_depth: critique,
    insight_generation: revision,
    process_coherence: 4,
    cross_turn_evolution: evolution,
  };
  return {
    scores,
    weighted_score: normalizedWeightedScore(scores, {
      critique_substance: 0.2,
      revision_impact: 0.2,
      deliberation_depth: 0.15,
      insight_generation: 0.15,
      process_coherence: 0.15,
      cross_turn_evolution: 0.15,
    }),
    verdict: 'DRY RUN reflexive deliberation judge.',
    evidence: [],
    failure_modes: metrics.memoryEvolved ? [] : ['memory_did_not_evolve'],
  };
}

function summarizeByScenario(rows) {
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.scenario)) grouped.set(row.scenario, []);
    grouped.get(row.scenario).push(row);
  }
  return [...grouped.entries()].map(([scenario, values]) => ({
    scenario,
    discipline: values[0]?.discipline || '',
    conditions: [...new Set(values.map((row) => row.conditionName))],
    deliberationAvg: average(values.map((row) => row.deliberationScore)),
    psychodynamicAvg: average(values.map((row) => row.psychodynamicScore)),
    mvpAvg: average(values.map((row) => row.mvpScore)),
    parentDialogueAvg: average(values.map((row) => row.parentDialogueScore)),
    avgRevisionDistance: average(values.flatMap((row) => row.metrics.revisionDistances)),
    materialRevisionTurns: values.reduce((sum, row) => sum + row.metrics.materialRevisionTurns, 0),
  }));
}

function normalizeJudge(judge) {
  const out = { ...(judge || {}) };
  const score = out.weighted_score;
  if (typeof score === 'number' && score >= 1 && score <= 5) {
    out.raw_weighted_score = score;
    out.weighted_score = Number((((score - 1) / 4) * 100).toFixed(1));
    out.score_normalization = 'converted_from_1_5_to_0_100';
  }
  return out;
}

function normalizedWeightedScore(scores, weights) {
  let weighted = 0;
  let total = 0;
  for (const [key, score] of Object.entries(scores)) {
    const weight = weights[key] ?? 0;
    weighted += score * weight;
    total += weight;
  }
  return Number(((((weighted / total) - 1) / 4) * 100).toFixed(1));
}

function average(values) {
  const numeric = values.filter((v) => typeof v === 'number');
  if (numeric.length === 0) return null;
  return Number((numeric.reduce((sum, value) => sum + value, 0) / numeric.length).toFixed(1));
}

function formatScore(score) {
  return typeof score === 'number' ? score.toFixed(1) : 'n/a';
}

function scoreClass(score) {
  if (typeof score !== 'number') return '';
  if (score >= 80) return 'good';
  if (score < 60) return 'bad';
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
