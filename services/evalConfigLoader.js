/**
 * Eval Config Loader
 *
 * Loads the evaluation rubric locally from the eval repo's own config directory,
 * removing the dependency on tutorApiService.loadRubric() for rubric/scenario data.
 *
 * Uses mtime-based caching (same pattern as tutor-core's configLoaderBase).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVAL_CONFIG_DIR = path.join(path.resolve(__dirname, '..'), 'config');

// Mtime-based cache
let rubricCache = null;
let rubricMtime = null;

/**
 * Load the evaluation rubric YAML from the eval repo's config directory.
 *
 * @param {Object} [options]
 * @param {string} [options.rubricPath] - Override path to rubric YAML file
 * @param {boolean} [options.forceReload] - Bypass mtime cache
 * @returns {Object|null} Parsed rubric object, or null if file not found
 */
export function loadRubric({ rubricPath, forceReload } = {}) {
  const effectivePath = rubricPath || path.join(EVAL_CONFIG_DIR, 'evaluation-rubric.yaml');

  try {
    const stats = fs.statSync(effectivePath);
    if (!forceReload && rubricCache && rubricMtime === stats.mtimeMs) {
      return rubricCache;
    }
    rubricMtime = stats.mtimeMs;
  } catch (err) {
    console.warn('[evalConfigLoader] Rubric file not found:', err.message);
    return null;
  }

  try {
    const content = fs.readFileSync(effectivePath, 'utf-8');
    rubricCache = yaml.parse(content);
    return rubricCache;
  } catch (err) {
    console.error('[evalConfigLoader] Failed to parse rubric:', err.message);
    return null;
  }
}

/**
 * Get judge model configuration from rubric.
 *
 * @param {Object} [options]
 * @param {string} [options.rubricPath] - Override rubric path
 * @returns {Object|null} Judge config ({ model, fallback, hyperparameters }) or null
 */
export function getJudgeConfig(options = {}) {
  const rubric = loadRubric(options);
  return rubric?.judge || rubric?.evaluator || null;
}

/**
 * Get rubric dimensions with weights and criteria.
 *
 * @param {Object} [options]
 * @param {string} [options.rubricPath] - Override rubric path
 * @returns {Object} Dimensions map (keyed by dimension id)
 */
export function getRubricDimensions(options = {}) {
  const rubric = loadRubric(options);
  return rubric?.dimensions || {};
}

/**
 * Get a single scenario by ID.
 *
 * @param {string} scenarioId
 * @param {Object} [options]
 * @param {string} [options.rubricPath] - Override rubric path
 * @returns {Object|null} Scenario object or null
 */
export function getScenario(scenarioId, options = {}) {
  const rubric = loadRubric(options);
  return rubric?.scenarios?.[scenarioId] || null;
}

/**
 * List all scenarios with metadata.
 *
 * @param {Object} [options]
 * @param {string} [options.rubricPath] - Override rubric path
 * @returns {Array} Array of { id, name, description, isNewUser, minAcceptableScore, turnCount, isMultiTurn }
 */
export function listScenarios(options = {}) {
  const rubric = loadRubric(options);
  if (!rubric?.scenarios) return [];

  return Object.entries(rubric.scenarios).map(([id, scenario]) => ({
    id,
    name: scenario.name,
    description: scenario.description,
    isNewUser: scenario.is_new_user,
    minAcceptableScore: scenario.min_acceptable_score,
    turnCount: (scenario.turns?.length || 0) + 1,
    isMultiTurn: Array.isArray(scenario.turns) && scenario.turns.length > 0,
  }));
}

/**
 * Check if a scenario is multi-turn.
 *
 * @param {string} scenarioId
 * @param {Object} [options]
 * @returns {boolean}
 */
export function isMultiTurnScenario(scenarioId, options = {}) {
  const scenario = getScenario(scenarioId, options);
  return Array.isArray(scenario?.turns) && scenario.turns.length > 0;
}

/**
 * Get benchmark settings from rubric.
 *
 * @param {Object} [options]
 * @returns {Object} { useAIJudge, forceAIJudgeDimensions }
 */
export function getBenchmarkSettings(options = {}) {
  const rubric = loadRubric(options);
  const settings = rubric?.settings?.benchmark || {};
  return {
    useAIJudge: settings.use_ai_judge ?? true,
    forceAIJudgeDimensions: settings.force_ai_judge_dimensions || ['specificity'],
  };
}

export default {
  loadRubric,
  getJudgeConfig,
  getRubricDimensions,
  getScenario,
  listScenarios,
  isMultiTurnScenario,
  getBenchmarkSettings,
};
