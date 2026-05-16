import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import { callCodexJson } from './codexCli.js';
import {
  computeReflexiveMetrics,
  extractReflexiveTurns,
} from './reflexiveAnalysis.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTOTYPE_ROOT = path.resolve(__dirname, '..');

export function loadPsychodynamicAdaptationRubric() {
  const p = path.join(PROTOTYPE_ROOT, 'config', 'psychodynamic-adaptation-rubric.yaml');
  return yaml.parse(fs.readFileSync(p, 'utf-8'));
}

export function buildPsychodynamicJudgePrompt({ scenario, branch, rubric, metrics }) {
  const compactRubric = {
    name: rubric.name,
    version: rubric.version,
    purpose: rubric.purpose,
    scale: rubric.scale,
    dimensions: Object.fromEntries(
      Object.entries(rubric.dimensions || {}).map(([key, value]) => [
        key,
        {
          weight: value.weight,
          question: value.question,
          score_5: value.score_5,
          score_3: value.score_3,
          score_1: value.score_1,
        },
      ]),
    ),
  };
  const turns = extractReflexiveTurns(branch);

  return `You are applying a Psychodynamic Adaptation Rubric to an adaptive tutor trace.

Do not edit files. Judge whether the Ego/Superego loop and memory mechanisms convert internal conflict into better learner-facing adaptation. Do not reward theory name-dropping. Reward psychodynamic hypotheses only when they remain evidence-bound and change the final tutor move.

Return only JSON:
{
  "scores": {
    "defense_recognition": 1,
    "evidence_bound_psychodynamic_inference": 1,
    "repair_debt_tracking": 1,
    "agency_preservation": 1,
    "revision_transformation": 1,
    "public_dialogue_translation": 1
  },
  "weighted_score": 0,
  "verdict": "short verdict",
  "evidence": ["short evidence from trace or transcript"],
  "failure_modes": []
}

Scoring:
- Dimension scores are 1-5 integers.
- weighted_score must be normalized to 0-100 using ((weighted_avg - 1) / 4) * 100.
- Penalize unsupported learner diagnosis, hidden trait inference, rescue, compliance collusion, and internal traces that do not improve the public transcript.
- It is acceptable for this rubric to disagree with the parent dialogue rubric when psychodynamic adaptation is visible but terse.

Rubric:
${JSON.stringify(compactRubric, null, 2)}

Scenario:
${JSON.stringify({
  id: scenario.scenarioId || scenario.id,
  discipline: scenario.discipline,
  objective: scenario.objective,
}, null, 2)}

Branch public behavior:
${JSON.stringify({
  branchName: branch.branchName,
  condition: branch.condition,
  hiddenType: branch.hiddenType,
  transcript: branch.transcript,
  outcomeTask: branch.outcomeTask,
  blindJudge: branch.blindJudge,
  parentDialogueJudge: branch.parentDialogueJudge,
}, null, 2)}

Local reflexive metrics:
${JSON.stringify(metrics, null, 2)}

Internal Ego/Superego turns:
${JSON.stringify(turns, null, 2)}
`;
}

export async function judgePsychodynamicAdaptation({
  scenario,
  branch,
  model = null,
  timeoutMs = 360_000,
  dryRun = false,
  keepPrompt = false,
} = {}) {
  const metrics = computeReflexiveMetrics(branch);
  const rubric = loadPsychodynamicAdaptationRubric();
  const prompt = buildPsychodynamicJudgePrompt({ scenario, branch, rubric, metrics });
  const parsed = dryRun
    ? dryRunPsychodynamicJudge({ branch, metrics, rubric })
    : (await callCodexJson(prompt, {
        model,
        timeoutMs,
        label: `psychodynamic-adaptation:${scenario.scenarioId || scenario.id}:${branch.condition}:${branch.branchName}`,
      })).parsed;
  const normalized = normalizePsychodynamicJudge(parsed);
  normalized.metrics = metrics;
  normalized.rubric = {
    name: rubric.name,
    version: rubric.version,
  };
  if (keepPrompt || dryRun) normalized.psychodynamicJudgePrompt = prompt;
  return normalized;
}

export function dryRunPsychodynamicJudge({ branch, metrics, rubric }) {
  const turns = extractReflexiveTurns(branch);
  const allMemories = turns.map((turn) => turn.reflexiveMemory || {});
  const psychodynamicMemoryCount = allMemories.reduce(
    (sum, memory) => sum
      + (memory.psychodynamicHypotheses || []).length
      + (memory.transferences || []).length,
    0,
  );
  const repairDebtCount = allMemories.reduce(
    (sum, memory) => sum + (memory.repairDebts || []).length,
    0,
  );
  const psychodynamicRiskCount = metrics.risks.filter((risk) => [
    'rescue_fantasy',
    'projection_of_mastery',
    'punitive_challenge',
    'compliance_collusion',
    'shame_amplification',
  ].includes(risk)).length;
  const asksForObservableWork = (branch.transcript || [])
    .filter((turn) => turn.role === 'tutor')
    .some((turn) => /\?|show|try|compare|explain|answer|write|tell/i.test(turn.content || ''));
  const parentScore = branch.parentDialogueJudge?.weighted_score;
  const mvpScore = branch.blindJudge?.weighted_score;
  const publicStrong = [parentScore, mvpScore].some((score) => typeof score === 'number' && score >= 75)
    || Boolean(branch.outcomeTask?.success);

  const scores = {
    defense_recognition: psychodynamicRiskCount > 0 ? 4 : metrics.risks.some((risk) => risk !== 'none') ? 3 : 2,
    evidence_bound_psychodynamic_inference: psychodynamicMemoryCount > 0 ? 4 : 3,
    repair_debt_tracking: repairDebtCount > 0 && metrics.memoryEvolved ? 4 : repairDebtCount > 0 ? 3 : 2,
    agency_preservation: asksForObservableWork && branch.outcomeTask?.success ? 4 : asksForObservableWork ? 3 : 2,
    revision_transformation: metrics.materialRevisionTurns > 0 ? 4 : metrics.avgRevisionDistance >= 0.18 ? 3 : 2,
    public_dialogue_translation: publicStrong ? 4 : 2,
  };

  return {
    scores,
    weighted_score: weightedScore(scores, rubric),
    verdict: 'DRY RUN psychodynamic adaptation judge.',
    evidence: [],
    failure_modes: [
      ...(psychodynamicRiskCount > 0 ? [] : ['no_specific_psychodynamic_risk']),
      ...(repairDebtCount > 0 ? [] : ['repair_debt_not_tracked']),
      ...(publicStrong ? [] : ['weak_public_translation']),
    ],
  };
}

function normalizePsychodynamicJudge(judge) {
  const out = { ...(judge || {}) };
  const score = out.weighted_score;
  if (typeof score === 'number' && score >= 1 && score <= 5) {
    out.raw_weighted_score = score;
    out.weighted_score = Number((((score - 1) / 4) * 100).toFixed(1));
    out.score_normalization = 'converted_from_1_5_to_0_100';
  }
  return out;
}

function weightedScore(scores, rubric) {
  let weighted = 0;
  let total = 0;
  for (const [key, value] of Object.entries(scores)) {
    const weight = rubric.dimensions?.[key]?.weight || 0;
    weighted += value * weight;
    total += weight;
  }
  if (total === 0) return null;
  return Number(((((weighted / total) - 1) / 4) * 100).toFixed(1));
}
