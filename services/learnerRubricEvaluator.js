/**
 * Learner Rubric Evaluator Service
 *
 * Builds evaluation prompts for scoring learner turns in multi-turn dialogues
 * using the learner-side rubric (config/evaluation-rubric-learner.yaml).
 *
 * Key design decisions:
 * - Truncates transcript at the learner's turn to prevent retrospective bias
 * - v2.1.0: Judges see public messages ONLY (no internal deliberation)
 *   for fair cross-architecture comparison. Deliberation quality is scored
 *   separately via the deliberation rubric.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVAL_CONFIG_DIR = path.resolve(__dirname, '..', 'config');
const _PROMPTS_DIR = path.resolve(__dirname, '..', 'prompts');

const learnerCacheMap = new Map();
let _learnerRubricPathOverride = null;
export function setLearnerRubricPathOverride(p) { _learnerRubricPathOverride = p; }
export function clearLearnerRubricPathOverride() { _learnerRubricPathOverride = null; }

/**
 * Load the learner rubric YAML with mtime-based caching.
 */
export function loadLearnerRubric({ forceReload } = {}) {
  const rubricPath = _learnerRubricPathOverride || path.join(EVAL_CONFIG_DIR, 'evaluation-rubric-learner.yaml');

  try {
    const stats = fs.statSync(rubricPath);
    const cached = learnerCacheMap.get(rubricPath);
    if (!forceReload && cached && cached.mtime === stats.mtimeMs) {
      return cached.data;
    }
    const raw = fs.readFileSync(rubricPath, 'utf-8');
    const data = yaml.parse(raw);
    learnerCacheMap.set(rubricPath, { data, mtime: stats.mtimeMs });
    return data;
  } catch (err) {
    console.warn('[learnerRubricEvaluator] Learner rubric file not found:', err.message);
    return null;
  }
}

/**
 * Get learner rubric dimensions.
 * Since v2.1.0, all 7 dimensions apply uniformly to all architectures
 * (deliberation_depth moved to the deliberation rubric).
 *
 * @param {Object} options
 * @param {boolean} options.isMultiAgent - Kept for backward compat (no-op since v2.1.0)
 * @returns {Object} Map of dimension key → dimension config
 */
export function getLearnerDimensions({ isMultiAgent = false } = {}) {
  const rubric = loadLearnerRubric();
  if (!rubric?.dimensions) return {};

  return { ...rubric.dimensions };
}

/**
 * Calculate the overall learner score from per-dimension scores.
 *
 * @param {Object} scores - Map of dimension → { score, reasoning }
 * @param {boolean} isMultiAgent - Whether deliberation_depth is included
 * @returns {number} Overall score on 0-100 scale
 */
export function calculateLearnerOverallScore(scores, isMultiAgent = false) {
  const dims = getLearnerDimensions({ isMultiAgent });

  let weightedSum = 0;
  let totalWeight = 0;

  for (const [key, dim] of Object.entries(dims)) {
    const scoreEntry = scores[key];
    if (!scoreEntry) continue;

    const score = typeof scoreEntry === 'object' ? scoreEntry.score : scoreEntry;
    if (typeof score !== 'number' || score < 1 || score > 5) continue;

    weightedSum += score * dim.weight;
    totalWeight += dim.weight;
  }

  if (totalWeight === 0) return null;

  const weightedAvg = weightedSum / totalWeight;
  return ((weightedAvg - 1) / 4) * 100;
}

/**
 * Build the dimension criteria section for the judge prompt.
 *
 * @param {Object} dimensions - Rubric dimensions to include
 * @returns {string} Formatted criteria text
 */
function buildDimensionCriteria(dimensions) {
  return Object.entries(dimensions)
    .map(([key, dim]) => {
      const criteriaText = Object.entries(dim.criteria || {})
        .map(([score, desc]) => `  ${score}: ${desc}`)
        .join('\n');
      return `**${dim.name}** (weight: ${(dim.weight * 100).toFixed(0)}%, key: ${key})
${dim.description}
Criteria:
${criteriaText}`;
    })
    .join('\n\n');
}

/**
 * Build a truncated transcript up to and including the learner turn being evaluated.
 * Does NOT include subsequent tutor responses to prevent retrospective bias.
 *
 * @param {Array} turns - All turns from the interaction
 * @param {number} targetTurnIndex - Index (in the turns array) of the learner turn to evaluate
 * @returns {string} Formatted transcript
 */
function buildTruncatedTranscript(turns, targetTurnIndex) {
  const lines = [];

  for (let i = 0; i <= targetTurnIndex; i++) {
    const turn = turns[i];
    const role = turn.phase === 'learner' ? 'LEARNER' : 'TUTOR';
    const turnLabel = `[Turn ${turn.turnNumber}, ${role}]`;

    lines.push(`${turnLabel}`);
    lines.push(turn.externalMessage || '(no message)');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format internal deliberation trace for display in the judge prompt.
 *
 * @param {Array} deliberation - Array of { role, content } objects
 * @returns {string} Formatted deliberation trace
 */
function formatDeliberation(deliberation) {
  if (!deliberation || deliberation.length === 0) return '';

  return deliberation
    .map((step) => {
      const roleLabel =
        {
          ego_initial: 'Ego (initial reaction)',
          superego: 'Superego (critique)',
          ego_revision: 'Ego (revision — final authority)',
          synthesis: 'Synthesis (unified process)',
          ego: 'Ego',
        }[step.role] || step.role;

      return `**${roleLabel}**:\n${step.content}`;
    })
    .join('\n\n');
}

/**
 * Build a full transcript for dialogue-level learner evaluation.
 * For multi-agent learners, include internal deliberation under each learner turn.
 *
 * @param {Array} turns - All turns from the interaction
 * @param {boolean} includeDeliberation - Whether to include learner internal traces
 * @returns {string} Formatted full transcript
 */
function buildHolisticTranscript(turns, includeDeliberation = false) {
  const lines = [];

  for (const turn of turns || []) {
    const role = turn.phase === 'learner' ? 'LEARNER' : 'TUTOR';
    lines.push(`[Turn ${turn.turnNumber}, ${role}]`);
    lines.push(turn.externalMessage || '(no message)');

    if (includeDeliberation && turn.phase === 'learner' && turn.internalDeliberation?.length > 0) {
      lines.push('');
      lines.push('Internal deliberation:');
      lines.push(formatDeliberation(turn.internalDeliberation));
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Build a BATCHED learner evaluation prompt for multi-turn dialogues.
 * Instead of M separate prompts (one per learner turn), this produces ONE prompt
 * that includes the rubric criteria once and the full transcript, asking the
 * judge to score each learner turn independently.
 *
 * @param {Object} params
 * @param {Array} params.turns - All turns from the interaction (reconstructedTurns)
 * @param {Array} params.learnerTurnTargets - Array of { lt, targetIdx } mapping learner ordinal to turns index
 * @param {string} params.personaId - Learner persona ID
 * @param {string} params.personaDescription - Description of the learner persona
 * @param {string} params.learnerArchitecture - 'unified' or 'multi_agent'
 * @param {string} params.scenarioName - Name of the scenario
 * @param {string} params.topic - Topic being discussed
 * @returns {string|null} Complete batched judge prompt, or null if no turns to score
 */
export function buildBatchedLearnerPrompt(params) {
  const {
    turns,
    learnerTurnTargets,
    personaId = 'unknown',
    personaDescription = 'No persona description available',
    learnerArchitecture = 'unified',
    scenarioName = 'unknown',
    topic = 'unknown',
  } = params;

  if (!learnerTurnTargets || learnerTurnTargets.length === 0) return null;

  const isMultiAgent = learnerArchitecture === 'multi_agent' || learnerArchitecture === 'psychodynamic';
  const dimensions = getLearnerDimensions({ isMultiAgent });
  const dimensionCriteria = buildDimensionCriteria(dimensions);

  // Build full transcript (all turns, public only)
  const fullTranscript = buildHolisticTranscript(turns, false);

  // Build per-turn listing of learner messages to evaluate
  const turnListings = learnerTurnTargets.map(({ lt, targetIdx }) => {
    const turn = turns[targetIdx];
    return `### Learner Turn ${lt + 1} (at dialogue position ${targetIdx + 1})
**External message** (what the tutor sees):
${turn?.externalMessage || '(no message)'}`;
  }).join('\n\n');

  // Build example JSON
  const dimKeys = Object.keys(dimensions);
  const exampleScores = Object.fromEntries(
    dimKeys.map((key) => [key, { score: 3, reasoning: 'Brief reason' }]),
  );
  const exampleTurn = {
    learner_turn_index: 0,
    scores: exampleScores,
    overall_score: 55,
    summary: 'Brief assessment',
  };

  return `You are an expert evaluator of synthetic learner agents in AI tutoring dialogues. You will evaluate MULTIPLE learner turns from the same dialogue, scoring each turn independently.

You are NOT evaluating the tutor. You are evaluating whether the learner agent produces responses that reflect genuine learning engagement: authentic reactions, substantive questions, conceptual thinking, and evidence of intellectual development.

## IMPORTANT: BIAS PREVENTION

For each learner turn, consider ONLY the dialogue context up to and including that turn. Mentally ignore subsequent exchanges when scoring earlier turns.

## IMPORTANT: RESPONSE COMPLETENESS

All learner responses shown below are COMPLETE as generated — they are NOT truncated. Some learner models produce concise output (1-3 sentences). This is the full response, not a fragment. Evaluate what is present. Never penalize brevity itself, never assume missing content, and never describe a response as "truncated." If text ends with an em-dash or ellipsis, that is the model's stylistic choice, not truncation.

## EVALUATION RUBRIC

Score each dimension from 1-5:
- 1: Completely fails this criterion
- 2: Weak, significant issues
- 3: Adequate, meets basic expectations
- 4: Good, exceeds expectations
- 5: Excellent, exemplary

${dimensionCriteria}

## LEARNER CONTEXT

**Assigned Persona**: ${personaId}
**Persona Description**: ${personaDescription}
**Learner Architecture**: ${learnerArchitecture}
**Scenario**: ${scenarioName}
**Topic**: ${topic}

## FULL DIALOGUE TRANSCRIPT

${fullTranscript}

## LEARNER TURNS TO EVALUATE

${turnListings}

## YOUR TASK

Score EACH learner turn listed above independently. For each turn:
- Consider ONLY the dialogue context up to and including that turn
- Evaluate based on the learner's external message only. Internal deliberation (if any) is scored separately.

CROSS-TURN CALIBRATION: For dimensions that measure development (revision_signals,
conceptual_progression, metacognitive_development), a score of 4 or 5 requires
EVIDENCE OF CHANGE compared to prior turns. At Turn 1, base your score on the
quality of the learner's initial engagement. From Turn 2 onward, ask: "How has
the learner's thinking evolved since the previous turn?" A score of 5 requires
the learner to demonstrate growth that builds on earlier exchanges.

For each turn, provide:
1. A score (1-5) for each applicable dimension with brief reasoning
2. An overall score (weighted average, 0-100 scale)
3. A brief summary

CRITICAL JSON RULES:
- Never use unescaped double quotes inside JSON string values. Use single quotes or rephrase.
- Keep "reasoning" values under 25 words.
- BAD:  "reasoning": "Says \\"great point\\" which sounds scripted"
- GOOD: "reasoning": "Says 'great point' which sounds scripted"

Respond with ONLY a JSON object in this exact format (no other text before or after):
\`\`\`json
{
  "turns": [
    ${JSON.stringify(exampleTurn, null, 4).split('\n').join('\n    ')}
  ]
}
\`\`\``;
}

/**
 * Build a complete learner evaluation prompt for a single learner turn.
 *
 * @param {Object} params
 * @param {Array} params.turns - All turns from the interaction
 * @param {number} params.targetTurnIndex - Index of the learner turn to evaluate
 * @param {string} params.personaId - Learner persona ID
 * @param {string} params.personaDescription - Description of the learner persona
 * @param {string} params.learnerArchitecture - 'unified' or 'multi_agent'
 * @param {string} params.scenarioName - Name of the scenario
 * @param {string} params.topic - Topic being discussed
 * @returns {string} Complete judge prompt
 */
export function buildLearnerEvaluationPrompt(params) {
  const {
    turns,
    targetTurnIndex,
    personaId = 'unknown',
    personaDescription = 'No persona description available',
    learnerArchitecture = 'unified',
    scenarioName = 'unknown',
    topic = 'unknown',
  } = params;

  const isMultiAgent = learnerArchitecture === 'multi_agent' || learnerArchitecture === 'psychodynamic';
  const dimensions = getLearnerDimensions({ isMultiAgent });
  const dimensionCriteria = buildDimensionCriteria(dimensions);

  const targetTurn = turns[targetTurnIndex];
  const truncatedTranscript = buildTruncatedTranscript(turns, targetTurnIndex);

  // Build dimension keys for JSON example
  const dimKeys = Object.keys(dimensions);
  const exampleScores = dimKeys
    .map((key) => {
      return `    "${key}": {"score": 3, "reasoning": "Brief reason"}`;
    })
    .join(',\n');

  return `You are an expert evaluator of synthetic learner agents in AI tutoring dialogues. Your task is to evaluate the quality of a LEARNER's response turn — how well the learner agent engages as a student, independent of the tutor's quality.

You are NOT evaluating the tutor. You are evaluating whether the learner agent produces responses that reflect genuine learning engagement: authentic reactions, substantive questions, conceptual thinking, and evidence of intellectual development.

## IMPORTANT: BIAS PREVENTION

You are shown the dialogue history UP TO AND INCLUDING the learner turn being evaluated. You do NOT see subsequent tutor responses. Evaluate the learner turn on its own merits.

## IMPORTANT: RESPONSE COMPLETENESS

All learner responses shown below are COMPLETE as generated — they are NOT truncated. Some learner models produce concise output (1-3 sentences). This is the full response, not a fragment. Evaluate what is present. Never penalize brevity itself, never assume missing content, and never describe a response as "truncated." If text ends with an em-dash or ellipsis, that is the model's stylistic choice, not truncation.

## EVALUATION RUBRIC

Score each dimension from 1-5:
- 1: Completely fails this criterion
- 2: Weak, significant issues
- 3: Adequate, meets basic expectations
- 4: Good, exceeds expectations
- 5: Excellent, exemplary

${dimensionCriteria}

## LEARNER CONTEXT

**Assigned Persona**: ${personaId}
**Persona Description**: ${personaDescription}
**Learner Architecture**: ${learnerArchitecture}
**Scenario**: ${scenarioName}
**Topic**: ${topic}

## DIALOGUE HISTORY (up to and including the turn being evaluated)

${truncatedTranscript}

## LEARNER TURN TO EVALUATE

**External message** (what the tutor sees):
${targetTurn.externalMessage || '(no message)'}

## YOUR TASK

Evaluate based on the learner's external message only. Internal deliberation (if any) is scored separately.

CROSS-TURN CALIBRATION: For dimensions that measure development (revision_signals,
conceptual_progression, metacognitive_development), a score of 4 or 5 requires
EVIDENCE OF CHANGE compared to prior turns. At Turn 1, base your score on the
quality of the learner's initial engagement. From Turn 2 onward, ask: "How has
the learner's thinking evolved since the previous turn?" A score of 5 requires
the learner to demonstrate growth that builds on earlier exchanges.

Evaluate the learner's turn and provide:
1. A score (1-5) for each applicable dimension with brief reasoning
2. An overall score (weighted average, 0-100 scale)

CRITICAL JSON RULES:
- Never use unescaped double quotes inside JSON string values. Use single quotes or rephrase.
- Keep "reasoning" values under 25 words.
- BAD:  "reasoning": "Says \\"great point\\" which sounds scripted"
- GOOD: "reasoning": "Says 'great point' which sounds scripted"

Respond with ONLY a JSON object in this exact format (no other text before or after):
\`\`\`json
{
  "scores": {
${exampleScores}
  },
  "overall_score": 55,
  "summary": "Brief overall assessment of learner turn quality"
}
\`\`\``;
}

/**
 * Build a dialogue-level learner evaluation prompt.
 * Scores the learner trajectory across the full multi-turn dialogue.
 *
 * @param {Object} params
 * @param {Array} params.turns - All turns from the interaction
 * @param {string} params.personaId - Learner persona ID
 * @param {string} params.personaDescription - Description of the learner persona
 * @param {string} params.learnerArchitecture - 'unified' or 'multi_agent'
 * @param {string} params.scenarioName - Name of the scenario
 * @param {string} params.topic - Topic being discussed
 * @returns {string} Complete judge prompt
 */
export function buildLearnerHolisticEvaluationPrompt(params) {
  const {
    turns,
    personaId = 'unknown',
    personaDescription = 'No persona description available',
    learnerArchitecture = 'unified',
    scenarioName = 'unknown',
    topic = 'unknown',
  } = params;

  const isMultiAgent = learnerArchitecture === 'multi_agent' || learnerArchitecture === 'psychodynamic';
  const dimensions = getLearnerDimensions({ isMultiAgent });
  const dimensionCriteria = buildDimensionCriteria(dimensions);
  // Always pass false — public messages only (internal deliberation scored separately)
  const fullTranscript = buildHolisticTranscript(turns, false);

  const dimKeys = Object.keys(dimensions);
  const exampleScores = dimKeys
    .map((key) => {
      return `    "${key}": {"score": 3, "reasoning": "Brief reason"}`;
    })
    .join(',\n');

  return `You are an expert evaluator of synthetic learner agents in AI tutoring dialogues. Your task is to evaluate the LEARNER's quality ACROSS THE ENTIRE DIALOGUE, independent of tutor quality.

You are NOT evaluating the tutor. Evaluate the learner's trajectory: authenticity, conceptual engagement, question depth, revision over turns, and consistency with assigned persona.

## IMPORTANT: RESPONSE COMPLETENESS

All learner responses shown below are COMPLETE as generated — they are NOT truncated. Some learner models produce concise output (1-3 sentences). This is the full response, not a fragment. Evaluate what is present. Never penalize brevity itself, never assume missing content, and never describe a response as "truncated." If text ends with an em-dash or ellipsis, that is the model's stylistic choice, not truncation.

## EVALUATION RUBRIC

Score each dimension from 1-5:
- 1: Completely fails this criterion
- 2: Weak, significant issues
- 3: Adequate, meets basic expectations
- 4: Good, exceeds expectations
- 5: Excellent, exemplary

${dimensionCriteria}

## LEARNER CONTEXT

**Assigned Persona**: ${personaId}
**Persona Description**: ${personaDescription}
**Learner Architecture**: ${learnerArchitecture}
**Scenario**: ${scenarioName}
**Topic**: ${topic}

## PUBLIC DIALOGUE TRANSCRIPT

Only externally visible messages are shown. Internal deliberation (if any) is scored separately.

${fullTranscript}

## YOUR TASK

Evaluate based on the learner's external messages only.

CROSS-TURN CALIBRATION: When scoring development dimensions (revision_signals,
conceptual_progression, metacognitive_development), require evidence of CUMULATIVE
change across the full dialogue, not just isolated moments. A score of 5 means the
learner's trajectory shows clear arc of development from first to last turn.

Evaluate the learner's performance across the full dialogue and provide:
1. A score (1-5) for each applicable dimension with brief reasoning
2. An overall score (weighted average, 0-100 scale)
3. A short summary of the learner's overall trajectory

CRITICAL JSON RULES:
- Never use unescaped double quotes inside JSON string values. Use single quotes or rephrase.
- Keep "reasoning" values under 25 words.

Respond with ONLY a JSON object in this exact format (no other text before or after):
\`\`\`json
{
  "scores": {
${exampleScores}
  },
  "overall_score": 55,
  "summary": "Brief overall assessment of learner quality across the dialogue"
}
\`\`\``;
}

export default {
  loadLearnerRubric,
  setLearnerRubricPathOverride,
  clearLearnerRubricPathOverride,
  getLearnerDimensions,
  calculateLearnerOverallScore,
  buildLearnerEvaluationPrompt,
  buildBatchedLearnerPrompt,
  buildLearnerHolisticEvaluationPrompt,
};
