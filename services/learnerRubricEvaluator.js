/**
 * Learner Rubric Evaluator Service
 *
 * Builds evaluation prompts for scoring learner turns in multi-turn dialogues
 * using the learner-side rubric (config/evaluation-rubric-learner.yaml).
 *
 * Key design decisions:
 * - Truncates transcript at the learner's turn to prevent retrospective bias
 * - Includes internal deliberation traces for multi-agent learners
 * - Omits deliberation_depth dimension for single-agent (unified) learners
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVAL_CONFIG_DIR = path.resolve(__dirname, '..', 'config');
const _PROMPTS_DIR = path.resolve(__dirname, '..', 'prompts');

let rubricCache = null;
let rubricMtime = null;

/**
 * Load the learner rubric YAML with mtime-based caching.
 */
export function loadLearnerRubric({ forceReload } = {}) {
  const rubricPath = path.join(EVAL_CONFIG_DIR, 'evaluation-rubric-learner.yaml');

  try {
    const stats = fs.statSync(rubricPath);
    if (!forceReload && rubricCache && rubricMtime === stats.mtimeMs) {
      return rubricCache;
    }
    rubricMtime = stats.mtimeMs;
  } catch (err) {
    console.warn('[learnerRubricEvaluator] Learner rubric file not found:', err.message);
    return null;
  }

  const raw = fs.readFileSync(rubricPath, 'utf-8');
  rubricCache = yaml.parse(raw);
  return rubricCache;
}

/**
 * Get learner rubric dimensions, optionally excluding deliberation_depth
 * for single-agent learners.
 *
 * @param {Object} options
 * @param {boolean} options.isMultiAgent - Whether the learner uses ego/superego architecture
 * @returns {Object} Map of dimension key → dimension config
 */
export function getLearnerDimensions({ isMultiAgent = false } = {}) {
  const rubric = loadLearnerRubric();
  if (!rubric?.dimensions) return {};

  const dims = { ...rubric.dimensions };

  if (!isMultiAgent) {
    delete dims.deliberation_depth;
  }

  return dims;
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

  if (totalWeight === 0) return 0;

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
  return Object.entries(dimensions).map(([key, dim]) => {
    const criteriaText = Object.entries(dim.criteria || {})
      .map(([score, desc]) => `  ${score}: ${desc}`)
      .join('\n');
    return `**${dim.name}** (weight: ${(dim.weight * 100).toFixed(0)}%, key: ${key})
${dim.description}
Criteria:
${criteriaText}`;
  }).join('\n\n');
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

  return deliberation.map(step => {
    const roleLabel = {
      'ego_initial': 'Ego (initial reaction)',
      'superego': 'Superego (critique)',
      'ego_revision': 'Ego (revision — final authority)',
      'synthesis': 'Synthesis (unified process)',
      'ego': 'Ego',
    }[step.role] || step.role;

    return `**${roleLabel}**:\n${step.content}`;
  }).join('\n\n');
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

  // Internal deliberation section (multi-agent only)
  let internalDeliberationSection = '';
  if (isMultiAgent && targetTurn.internalDeliberation?.length > 0) {
    internalDeliberationSection = `
**Internal deliberation** (the learner's ego/superego process — not visible to the tutor):

${formatDeliberation(targetTurn.internalDeliberation)}
`;
  }

  // Note about deliberation_depth dimension
  let deliberationDepthNote = '';
  if (isMultiAgent) {
    deliberationDepthNote = 'This is a multi-agent learner. Score ALL dimensions including deliberation_depth (evaluate the quality of the internal ego/superego process shown above).';
  } else {
    deliberationDepthNote = 'This is a single-agent (unified) learner. OMIT the deliberation_depth dimension — do not include it in your scores.';
  }

  // Build dimension keys for JSON example
  const dimKeys = Object.keys(dimensions);
  const exampleScores = dimKeys.map(key => {
    return `    "${key}": {"score": 3, "reasoning": "Brief reason"}`;
  }).join(',\n');

  return `You are an expert evaluator of synthetic learner agents in AI tutoring dialogues. Your task is to evaluate the quality of a LEARNER's response turn — how well the learner agent engages as a student, independent of the tutor's quality.

You are NOT evaluating the tutor. You are evaluating whether the learner agent produces responses that reflect genuine learning engagement: authentic reactions, substantive questions, conceptual thinking, and evidence of intellectual development.

## IMPORTANT: BIAS PREVENTION

You are shown the dialogue history UP TO AND INCLUDING the learner turn being evaluated. You do NOT see subsequent tutor responses. Evaluate the learner turn on its own merits.

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
${internalDeliberationSection}
## YOUR TASK

${deliberationDepthNote}

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

export default {
  loadLearnerRubric,
  getLearnerDimensions,
  calculateLearnerOverallScore,
  buildLearnerEvaluationPrompt,
};
