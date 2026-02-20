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
import { configLoaderBase } from '@machinespirits/tutor-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVAL_CONFIG_DIR = path.join(path.resolve(__dirname, '..'), 'config');

// Register eval-repo's config dir as client overlay for provider merging.
// This makes configLoaderBase.loadProviders() return tutor-core defaults
// deep-merged with eval-repo overrides — single source of truth for all consumers.
configLoaderBase.registerClientConfigDir(EVAL_CONFIG_DIR);

// Mtime-based caches
let rubricCache = null;
let rubricMtime = null;
let scenariosCache = null;
let scenariosMtime = null;
let tutorAgentsCache = null;
let tutorAgentsMtime = null;
let evalSettingsCache = null;
let evalSettingsMtime = null;

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
 * Load suggestion scenarios from the dedicated scenarios YAML file.
 *
 * Environment variable overrides:
 * - EVAL_SCENARIOS_FILE: Override the scenarios file path (for testing different content domains)
 *
 * @param {Object} [options]
 * @param {boolean} [options.forceReload] - Bypass mtime cache
 * @returns {Object|null} Parsed scenarios object, or null if file not found
 */
export function loadSuggestionScenarios({ forceReload } = {}) {
  // Allow environment variable override for scenarios file (domain generalizability testing)
  const envScenariosFile = process.env.EVAL_SCENARIOS_FILE;
  let effectivePath;

  if (envScenariosFile) {
    const evalRoot = path.resolve(EVAL_CONFIG_DIR, '..');
    effectivePath = path.resolve(evalRoot, envScenariosFile);
    console.log(`[evalConfigLoader] Using EVAL_SCENARIOS_FILE override: ${effectivePath}`);
  } else {
    effectivePath = path.join(EVAL_CONFIG_DIR, 'suggestion-scenarios.yaml');
  }

  try {
    const stats = fs.statSync(effectivePath);
    if (!forceReload && scenariosCache && scenariosMtime === stats.mtimeMs) {
      return scenariosCache;
    }
    scenariosMtime = stats.mtimeMs;
  } catch (err) {
    console.warn('[evalConfigLoader] Suggestion scenarios file not found:', err.message);
    return null;
  }

  try {
    const content = fs.readFileSync(effectivePath, 'utf-8');
    scenariosCache = yaml.parse(content);
    return scenariosCache;
  } catch (err) {
    console.error('[evalConfigLoader] Failed to parse suggestion scenarios:', err.message);
    return null;
  }
}

// Cache for the { providers: ... } wrapper (so callers get stable references)
let providersWrapperCache = null;
let providersWrapperRef = null; // track configLoaderBase's cache reference

/**
 * Load merged providers (tutor-core defaults + eval-repo overrides).
 *
 * Delegates to configLoaderBase.loadProviders() which returns the deep-merged
 * provider map. Wraps the result in { providers: ... } for backward compatibility
 * with existing callers that expect the raw YAML structure.
 *
 * @param {Object} [options]
 * @param {boolean} [options.forceReload] - Bypass mtime cache
 * @returns {Object|null} { providers: mergedProviders } or null
 */
export function loadProviders({ forceReload } = {}) {
  const merged = configLoaderBase.loadProviders(forceReload);
  if (!merged) return null;
  // Return cached wrapper if underlying reference hasn't changed
  if (providersWrapperCache && providersWrapperRef === merged) {
    return providersWrapperCache;
  }
  providersWrapperRef = merged;
  providersWrapperCache = { providers: merged };
  return providersWrapperCache;
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

  const apiKey = provider.api_key_env ? process.env[provider.api_key_env] || '' : '';
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
        `Invalid model reference: "${ref}". Use format "provider.model" (e.g., "openrouter.haiku", "anthropic.sonnet")`,
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
 * Tries the dedicated suggestion-scenarios.yaml first, then falls back
 * to the rubric file for backward compatibility.
 *
 * @param {string} scenarioId
 * @param {Object} [options]
 * @param {string} [options.rubricPath] - Override rubric path
 * @returns {Object|null} Scenario object or null
 */
export function getScenario(scenarioId, options = {}) {
  // Try new dedicated file first
  const scenarios = loadSuggestionScenarios(options);
  const scenario = scenarios?.scenarios?.[scenarioId];
  if (scenario) {
    return { ...scenario, type: scenario.type || 'suggestion', id: scenarioId };
  }

  // Fallback to rubric (backward compat)
  const rubric = loadRubric(options);
  const legacy = rubric?.scenarios?.[scenarioId];
  if (legacy) {
    console.warn(`[evalConfigLoader] Scenario '${scenarioId}' loaded from legacy rubric location`);
    return { ...legacy, type: 'suggestion', id: scenarioId };
  }

  return null;
}

/**
 * List all scenarios with metadata.
 *
 * Tries the dedicated suggestion-scenarios.yaml first, then falls back
 * to the rubric file for backward compatibility.
 *
 * @param {Object} [options]
 * @param {string} [options.rubricPath] - Override rubric path
 * @returns {Array} Array of { id, name, description, type, isNewUser, minAcceptableScore, turnCount, isMultiTurn }
 */
export function listScenarios(options = {}) {
  // Try new dedicated file first
  const scenarioData = loadSuggestionScenarios(options);
  let scenarioMap = scenarioData?.scenarios;

  // Fallback to rubric
  if (!scenarioMap) {
    const rubric = loadRubric(options);
    scenarioMap = rubric?.scenarios;
    if (scenarioMap) {
      console.warn('[evalConfigLoader] Scenarios loaded from legacy rubric location');
    }
  }

  if (!scenarioMap) return [];

  return Object.entries(scenarioMap).map(([id, scenario]) => ({
    id,
    name: scenario.name,
    description: scenario.description,
    type: scenario.type || 'suggestion',
    category: scenario.category || 'core',
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
 * Get evaluation settings from rubric.
 *
 * @param {Object} [options]
 * @returns {Object} { useAIJudge, runsPerConfig, parallelism }
 */
export function getEvalSettings(options = {}) {
  const rubric = loadRubric(options);
  const settings = rubric?.settings || {};
  return {
    useAIJudge: settings.use_ai_judge ?? true,
    runsPerConfig: settings.runs_per_config ?? 3,
    parallelism: settings.parallelism ?? 2,
  };
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

/**
 * List available provider/model configurations from eval's providers.yaml.
 *
 * @param {Object} [options]
 * @param {boolean} [options.forceReload] - Bypass mtime cache
 * @returns {Array} Array of { provider, model, label }
 */
export function listConfigurations(options = {}) {
  const data = loadProviders(options);
  const providers = data?.providers || {};
  const configs = [];

  for (const [providerId, provider] of Object.entries(providers)) {
    for (const [alias, modelId] of Object.entries(provider.models || {})) {
      configs.push({
        provider: providerId,
        model: modelId,
        label: `${providerId}/${alias}`,
      });
    }
  }

  return configs;
}

/**
 * List scenarios filtered by category.
 *
 * @param {string} category - Category to filter by (e.g. 'core', 'recognition', 'multi_turn')
 * @param {Object} [options]
 * @returns {Array} Filtered scenario list
 */
export function listScenariosByCategory(category, options = {}) {
  return listScenarios(options).filter((s) => s.category === category);
}

/**
 * Get interaction judge model configuration from rubric.
 *
 * Returns the `interaction_judge` section from evaluation-rubric.yaml,
 * falling back to the suggestion `judge` section if not defined.
 *
 * @param {Object} [options]
 * @param {string} [options.rubricPath] - Override rubric path
 * @returns {Object|null} Judge config ({ model, fallback, hyperparameters }) or null
 */
export function getInteractionJudgeConfig(options = {}) {
  const rubric = loadRubric(options);
  return rubric?.interaction_judge || rubric?.judge || null;
}

/**
 * Load eval-settings.yaml from the eval repo's config directory.
 *
 * @param {Object} [options]
 * @param {boolean} [options.forceReload] - Bypass mtime cache
 * @returns {Object|null} Parsed eval settings, or null if file not found
 */
export function loadEvalSettings({ forceReload } = {}) {
  const effectivePath = path.join(EVAL_CONFIG_DIR, 'eval-settings.yaml');

  try {
    const stats = fs.statSync(effectivePath);
    if (!forceReload && evalSettingsCache && evalSettingsMtime === stats.mtimeMs) {
      return evalSettingsCache;
    }
    evalSettingsMtime = stats.mtimeMs;
  } catch (err) {
    // File is optional — not a warning
    return null;
  }

  try {
    const content = fs.readFileSync(effectivePath, 'utf-8');
    evalSettingsCache = yaml.parse(content);
    return evalSettingsCache;
  } catch (err) {
    console.error('[evalConfigLoader] Failed to parse eval-settings:', err.message);
    return null;
  }
}

/**
 * Get content configuration from eval-settings.yaml.
 * Resolves relative content_package_path against the eval repo root.
 *
 * Environment variable overrides:
 * - EVAL_CONTENT_PATH: Override content_package_path (for testing different content domains)
 *
 * @param {Object} [options]
 * @param {boolean} [options.forceReload] - Bypass mtime cache
 * @returns {Object|null} Content config with resolved paths, or null
 */
export function getContentConfig(options = {}) {
  const settings = loadEvalSettings(options);
  const content = settings?.content;
  if (!content) return null;

  const evalRoot = path.resolve(EVAL_CONFIG_DIR, '..');
  const resolved = { ...content };

  // Allow environment variable override for content path (domain generalizability testing)
  const envContentPath = process.env.EVAL_CONTENT_PATH;
  if (envContentPath) {
    resolved.content_package_path = path.resolve(evalRoot, envContentPath);
    console.log(`[evalConfigLoader] Using EVAL_CONTENT_PATH override: ${resolved.content_package_path}`);
  } else if (resolved.content_package_path) {
    resolved.content_package_path = path.resolve(evalRoot, resolved.content_package_path);
  }

  return resolved;
}

/**
 * Load scenarios from a custom file path.
 * Used for testing domain generalizability with alternate content.
 *
 * @param {string} scenariosPath - Path to scenarios YAML file
 * @returns {Object|null} Parsed scenarios object, or null if file not found
 */
export function loadCustomScenarios(scenariosPath) {
  const evalRoot = path.resolve(EVAL_CONFIG_DIR, '..');
  const resolvedPath = path.resolve(evalRoot, scenariosPath);

  try {
    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const scenarios = yaml.parse(content);
    console.log(`[evalConfigLoader] Loaded custom scenarios from: ${resolvedPath}`);
    return scenarios;
  } catch (err) {
    console.error(`[evalConfigLoader] Failed to load custom scenarios from ${resolvedPath}:`, err.message);
    return null;
  }
}

export default {
  loadRubric,
  loadSuggestionScenarios,
  loadCustomScenarios,
  loadProviders,
  getProviderConfig,
  resolveModel,
  getJudgeConfig,
  getInteractionJudgeConfig,
  getRubricDimensions,
  getScenario,
  listScenarios,
  listScenariosByCategory,
  isMultiTurnScenario,
  getEvalSettings,
  getBenchmarkSettings,
  loadTutorAgents,
  getTutorProfile,
  listTutorProfiles,
  listConfigurations,
  loadEvalSettings,
  getContentConfig,
  getTutorModelOverrides,
};

/**
 * Get YAML-level model overrides from tutor-agents.yaml.
 * These are lower priority than CLI flags.
 *
 * @param {Object} [options]
 * @param {boolean} [options.forceReload] - Bypass mtime cache
 * @returns {Object} { modelOverride, egoModelOverride, superegoModelOverride } (null if not set)
 */
export function getTutorModelOverrides(options = {}) {
  const data = loadTutorAgents(options);
  return {
    modelOverride: data?.model_override || null,
    egoModelOverride: data?.ego_model_override || null,
    superegoModelOverride: data?.superego_model_override || null,
  };
}
