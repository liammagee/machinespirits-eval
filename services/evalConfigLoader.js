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

// Mtime-based caches
let rubricCache = null;
let rubricMtime = null;
let providersCache = null;
let providersMtime = null;
let tutorAgentsCache = null;
let tutorAgentsMtime = null;

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
 * Load the providers YAML from the eval repo's config directory.
 *
 * @param {Object} [options]
 * @param {boolean} [options.forceReload] - Bypass mtime cache
 * @returns {Object|null} Parsed providers object, or null if file not found
 */
export function loadProviders({ forceReload } = {}) {
  const effectivePath = path.join(EVAL_CONFIG_DIR, 'providers.yaml');

  try {
    const stats = fs.statSync(effectivePath);
    if (!forceReload && providersCache && providersMtime === stats.mtimeMs) {
      return providersCache;
    }
    providersMtime = stats.mtimeMs;
  } catch (err) {
    console.warn('[evalConfigLoader] Providers file not found:', err.message);
    return null;
  }

  try {
    const content = fs.readFileSync(effectivePath, 'utf-8');
    providersCache = yaml.parse(content);
    return providersCache;
  } catch (err) {
    console.error('[evalConfigLoader] Failed to parse providers:', err.message);
    return null;
  }
}

/**
 * Get provider config with API key resolved from environment.
 *
 * @param {string} providerName - Provider key (e.g. 'anthropic', 'openrouter')
 * @param {Object} [options]
 * @param {boolean} [options.forceReload] - Bypass mtime cache
 * @returns {Object} Provider config with apiKey and isConfigured
 */
export function getProviderConfig(providerName, options = {}) {
  const data = loadProviders(options);
  const provider = data?.providers?.[providerName];

  if (!provider) {
    throw new Error(`Unknown provider: ${providerName}`);
  }

  const apiKey = provider.api_key_env ? (process.env[provider.api_key_env] || '') : '';
  const isLocal = providerName === 'local';
  const isConfigured = isLocal ? Boolean(provider.base_url) : Boolean(apiKey);

  return {
    ...provider,
    apiKey,
    isConfigured,
  };
}

/**
 * Resolve a model reference to full provider config.
 *
 * Accepts:
 *   - String: "provider.alias" (e.g. "openrouter.sonnet")
 *   - Object: { provider, model } (e.g. { provider: 'anthropic', model: 'sonnet' })
 *
 * @param {string|Object} ref - Model reference
 * @param {Object} [options]
 * @param {boolean} [options.forceReload] - Bypass mtime cache
 * @returns {Object} { provider, model, apiKey, isConfigured, baseUrl }
 */
export function resolveModel(ref, options = {}) {
  let providerName, modelAlias;

  if (typeof ref === 'string') {
    const dotIndex = ref.indexOf('.');
    if (dotIndex > 0 && dotIndex < ref.length - 1) {
      providerName = ref.slice(0, dotIndex);
      modelAlias = ref.slice(dotIndex + 1);
    } else {
      throw new Error(
        `Invalid model reference: "${ref}". Use format "provider.model" (e.g., "openrouter.haiku", "anthropic.sonnet")`
      );
    }
  } else if (typeof ref === 'object' && ref !== null) {
    providerName = ref.provider;
    modelAlias = ref.model;
    if (!providerName || !modelAlias) {
      throw new Error('Model reference object must have both "provider" and "model" properties');
    }
  } else {
    throw new Error('Model reference must be a string or object');
  }

  const providerConfig = getProviderConfig(providerName, options);
  const modelId = providerConfig.models?.[modelAlias] || modelAlias;

  return {
    provider: providerName,
    model: modelId,
    apiKey: providerConfig.apiKey,
    isConfigured: providerConfig.isConfigured,
    baseUrl: providerConfig.base_url,
  };
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
  return rubric?.judge || null;
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

/**
 * Load the tutor-agents YAML from the eval repo's config directory.
 *
 * @param {Object} [options]
 * @param {boolean} [options.forceReload] - Bypass mtime cache
 * @returns {Object|null} Parsed tutor-agents object, or null if file not found
 */
export function loadTutorAgents({ forceReload } = {}) {
  const effectivePath = path.join(EVAL_CONFIG_DIR, 'tutor-agents.yaml');

  try {
    const stats = fs.statSync(effectivePath);
    if (!forceReload && tutorAgentsCache && tutorAgentsMtime === stats.mtimeMs) {
      return tutorAgentsCache;
    }
    tutorAgentsMtime = stats.mtimeMs;
  } catch (err) {
    console.warn('[evalConfigLoader] Tutor agents file not found:', err.message);
    return null;
  }

  try {
    const content = fs.readFileSync(effectivePath, 'utf-8');
    tutorAgentsCache = yaml.parse(content);
    return tutorAgentsCache;
  } catch (err) {
    console.error('[evalConfigLoader] Failed to parse tutor agents:', err.message);
    return null;
  }
}

/**
 * Get a tutor profile's config with provider/model resolved through providers.yaml.
 *
 * @param {string} profileName - Profile key (e.g. 'budget', 'quality')
 * @param {Object} [options]
 * @param {boolean} [options.forceReload] - Bypass mtime cache
 * @returns {Object|null} Resolved profile with ego/superego provider/model IDs, or null
 */
export function getTutorProfile(profileName, options = {}) {
  const data = loadTutorAgents(options);
  const profile = data?.profiles?.[profileName];

  if (!profile) {
    return null;
  }

  const result = {
    name: profileName,
    description: profile.description,
    dialogue: profile.dialogue,
    ego: profile.ego ? { ...profile.ego } : null,
    superego: profile.superego ? { ...profile.superego } : null,
  };

  // Resolve ego model through providers.yaml
  if (result.ego?.provider && result.ego?.model) {
    try {
      const resolved = resolveModel(`${result.ego.provider}.${result.ego.model}`, options);
      result.ego.resolvedProvider = resolved.provider;
      result.ego.resolvedModel = resolved.model;
    } catch (e) {
      // Keep the raw values if resolution fails
    }
  }

  // Resolve superego model through providers.yaml
  if (result.superego?.provider && result.superego?.model) {
    try {
      const resolved = resolveModel(`${result.superego.provider}.${result.superego.model}`, options);
      result.superego.resolvedProvider = resolved.provider;
      result.superego.resolvedModel = resolved.model;
    } catch (e) {
      // Keep the raw values if resolution fails
    }
  }

  return result;
}

/**
 * List available tutor profiles from the local tutor-agents.yaml.
 *
 * @param {Object} [options]
 * @param {boolean} [options.forceReload] - Bypass mtime cache
 * @returns {Array} Array of { name, description, dialogueEnabled, maxRounds, egoProvider, egoModel, superegoProvider, superegoModel }
 */
export function listTutorProfiles(options = {}) {
  const data = loadTutorAgents(options);
  const profiles = data?.profiles || {};

  return Object.entries(profiles).map(([name, profile]) => ({
    name,
    description: profile.description || '',
    dialogueEnabled: profile.dialogue?.enabled ?? true,
    maxRounds: profile.dialogue?.max_rounds ?? 0,
    egoProvider: profile.ego?.provider,
    egoModel: profile.ego?.model,
    superegoProvider: profile.superego?.provider,
    superegoModel: profile.superego?.model,
  }));
}

export default {
  loadRubric,
  loadProviders,
  getProviderConfig,
  resolveModel,
  getJudgeConfig,
  getRubricDimensions,
  getScenario,
  listScenarios,
  isMultiTurnScenario,
  getBenchmarkSettings,
  loadTutorAgents,
  getTutorProfile,
  listTutorProfiles,
};
