import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import { callCodexJson } from './codexCli.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTOTYPE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PROTOTYPE_ROOT, '..', '..');

export function loadParentDialogueRubric() {
  const p = path.join(REPO_ROOT, 'config', 'evaluation-rubric-dialogue.yaml');
  return yaml.parse(fs.readFileSync(p, 'utf-8'));
}

export function buildParentDialogueRubricPrompt({ scenario, branch, rubric }) {
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
        },
      ]),
    ),
  };

  return `You are applying the parent project's dialogue-quality rubric to a tutoring transcript.

Do not edit files. You are intentionally not given hidden learner state, policy labels, mastery estimates, or expected actions. Judge only the visible transcript and outcome task.

Return only JSON:
{
  "scores": {
    "pedagogical_progression": 1,
    "dialogical_responsiveness": 1,
    "knowledge_co_construction": 1,
    "productive_tension_management": 1,
    "transformation_evidence": 1,
    "interactional_coherence": 1
  },
  "weighted_score": 0,
  "verdict": "short verdict",
  "evidence": ["short quotes from transcript"],
  "failure_modes": []
}

Scoring:
- Dimension scores are 1-5 integers.
- weighted_score must be normalized to 0-100 using ((weighted_avg - 1) / 4) * 100.
- Reward visible interaction quality, not access to hidden controller state.
- Penalize generic tutoring that happens to produce a correct final answer without visible co-construction.

Rubric:
${JSON.stringify(compactRubric, null, 2)}

Scenario objective:
${scenario.objective}

Transcript:
${JSON.stringify(branch.transcript, null, 2)}

Outcome task:
${JSON.stringify(branch.outcomeTask, null, 2)}
`;
}

export async function judgeWithParentDialogueRubric({
  scenario,
  branch,
  model = null,
  timeoutMs = 360_000,
  dryRun = false,
  keepPrompt = false,
} = {}) {
  const rubric = loadParentDialogueRubric();
  const prompt = buildParentDialogueRubricPrompt({ scenario, branch, rubric });
  const scenarioLabel = scenario.id || scenario.scenarioId || 'unknown-scenario';
  const parsed = dryRun
    ? dryRunParentDialogueJudge({ branch })
    : (await callCodexJson(prompt, {
        model,
        timeoutMs,
        label: `parent-dialogue-rubric:${scenarioLabel}:${branch.condition}:${branch.branchName}`,
      })).parsed;
  const normalized = normalizeParentJudge(parsed);
  if (keepPrompt || dryRun) normalized.parentDialoguePrompt = prompt;
  return normalized;
}

function dryRunParentDialogueJudge({ branch }) {
  const transcriptText = branch.transcript.map((m) => m.content).join('\n').toLowerCase();
  const outcome = branch.outcomeTask.success ? 5 : 2;
  const responsive = /you|your|try|explain|what|why|example|test/.test(transcriptText) ? 4 : 2;
  const scores = {
    pedagogical_progression: outcome,
    dialogical_responsiveness: responsive,
    knowledge_co_construction: responsive,
    productive_tension_management: responsive,
    transformation_evidence: outcome,
    interactional_coherence: 4,
  };
  return {
    scores,
    weighted_score: normalizedWeightedScore(scores, {
      pedagogical_progression: 0.2,
      dialogical_responsiveness: 0.2,
      knowledge_co_construction: 0.2,
      productive_tension_management: 0.15,
      transformation_evidence: 0.15,
      interactional_coherence: 0.1,
    }),
    verdict: 'DRY RUN parent dialogue rubric.',
    evidence: [],
    failure_modes: branch.outcomeTask.success ? [] : ['outcome_task_failed'],
  };
}

function normalizeParentJudge(judge) {
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
