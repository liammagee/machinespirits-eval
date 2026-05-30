/**
 * Tutor Configuration Loader
 *
 * Loads and manages multiagent tutor configuration from YAML files.
 * Supports environment variable overrides and multiple profiles.
 *
 * Uses shared configLoaderBase.js for common loading patterns.
 */

import {
  loadProviders,
  createConfigLoader,
  createPromptLoader,
} from './configLoaderBase.js';
import { createBoundResolver } from './modelResolver.js';

// ============================================================================
// Default Configurations
// ============================================================================

function getDefaultConfig() {
  return {
    active_profile: 'default',
    providers: {
      anthropic: {
        api_key_env: 'ANTHROPIC_API_KEY',
        base_url: 'https://api.anthropic.com/v1/messages',
        default_model: 'claude-sonnet-4-5-20250514',
        models: {
          haiku: 'claude-haiku-4-5-20241022',
          sonnet: 'claude-sonnet-4-5-20250514',
          opus: 'claude-opus-4-5-20250514',
        },
      },
    },
    profiles: {
      default: getDefaultProfile(),
    },
  };
}

function getDefaultProfile() {
  return {
    description: 'Default Sonnet-based configuration',
    dialogue: {
      enabled: true,
      max_rounds: 2,
    },
    ego: {
      provider: 'anthropic',
      model: 'sonnet',
      prompt_file: 'tutor-ego.md',
      hyperparameters: {
        temperature: 0.6,
        max_tokens: 1500,
      },
    },
    superego: {
      provider: 'anthropic',
      model: 'haiku',
      prompt_file: 'tutor-superego.md',
      hyperparameters: {
        temperature: 0.4,
        max_tokens: 800,
      },
    },
    intervention_thresholds: getDefaultThresholds(),
  };
}

function getDefaultThresholds() {
  return {
    low_intensity_skip_dialogue: true,
    high_intensity_extra_rounds: true,
    struggle_signal_threshold: 2,
    rapid_nav_window_ms: 30000,
    retry_frustration_count: 3,
  };
}

function getDefaultPrompt(filename) {
  return `You are a helpful AI tutor assistant. (Prompt file ${filename} not found)`;
}

// ============================================================================
// Create Base Loaders
// ============================================================================

const configLoader = createConfigLoader('tutor-agents.yaml', getDefaultConfig);
const promptLoader = createPromptLoader(getDefaultPrompt);

// Re-export loadConfig and getProviderConfig from the base loader
export const loadConfig = configLoader.loadConfig;
export const getProviderConfig = configLoader.getProviderConfig;

// Re-export loadProviders from base
export { loadProviders };

// Re-export prompt loading utilities
export const loadPrompt = promptLoader.loadPrompt;
export const getPromptCacheStatus = promptLoader.getPromptCacheStatus;
export const getPromptMetadata = promptLoader.getPromptMetadata;

// ============================================================================
// Tutor-Specific Functions
// ============================================================================

// Callbacks for prompt reload notifications
let promptReloadCallbacks = [];

/**
 * Get the active profile configuration
 * @param {string} profileName - Optional profile name override
 * @returns {Object} Profile configuration
 */
export function getActiveProfile(profileName = null) {
  const config = loadConfig();

  // Check for environment variable override
  const envProfile = process.env.TUTOR_PROFILE || process.env.TUTOR_AGENT_PROFILE;
  const targetProfile = profileName || envProfile || config.active_profile || 'default';

  const profile = config.profiles?.[targetProfile];
  if (!profile) {
    console.warn(`Profile "${targetProfile}" not found, using default`);
    return config.profiles?.default || getDefaultProfile();
  }

  return {
    name: targetProfile,
    ...profile,
  };
}

/**
 * Get full agent configuration for a role (ego or superego)
 * @param {string} role - 'ego' or 'superego'
 * @param {string} profileName - Optional profile name
 * @param {Object} options - Optional configuration
 * @param {string} options.strategy - Superego strategy name (only applies to superego role)
 * @returns {Object} Complete agent configuration
 */
export function getAgentConfig(role, profileName = null, options = {}) {
  const { strategy = null } = options;
  const profile = getActiveProfile(profileName);
  const agentConfig = profile[role];

  if (!agentConfig) {
    return null;
  }

  // Get provider configuration
  const providerConfig = getProviderConfig(agentConfig.provider);

  // Resolve model name (short name like 'haiku' -> full ID like 'claude-haiku-4-5')
  const modelShortName = agentConfig.model; // e.g., 'haiku', 'sonnet'
  const modelFullId = providerConfig.models?.[modelShortName] || modelShortName;

  // Load prompt file
  let prompt = loadPrompt(agentConfig.prompt_file);

  // Apply strategy modifier for superego if specified
  let strategyName = null;
  if (role === 'superego' && strategy) {
    const strategyConfig = getSuperegoStrategy(strategy);
    if (strategyConfig && strategyConfig.prompt_modifier) {
      prompt = `${prompt}\n\n${strategyConfig.prompt_modifier}`;
      strategyName = strategyConfig.name;
    }
  }

  return {
    role,
    provider: agentConfig.provider,
    providerConfig,
    model: modelFullId,
    modelName: modelShortName, // Keep short name for fallback logic
    prompt,
    hyperparameters: agentConfig.hyperparameters || {},
    isConfigured: providerConfig.isConfigured,
    strategy: strategyName, // Track which strategy is active
  };
}

/**
 * Get a superego intervention strategy configuration
 * @param {string} strategyName - Strategy identifier (e.g., 'socratic_challenge')
 * @returns {Object|null} Strategy configuration or null if not found
 */
export function getSuperegoStrategy(strategyName) {
  const config = loadConfig();
  const strategies = config.superego_strategies;

  if (!strategies || !strategies[strategyName]) {
    return null;
  }

  return strategies[strategyName];
}

/**
 * List all available superego strategies
 * @returns {Array} Array of strategy objects with id, name, description
 */
export function listSuperegoStrategies() {
  const config = loadConfig();
  const strategies = config.superego_strategies;

  if (!strategies) {
    return [];
  }

  return Object.entries(strategies).map(([id, config]) => ({
    id,
    name: config.name,
    description: config.description,
    style: config.style,
    hasModifier: !!config.prompt_modifier,
  }));
}

/**
 * Force reload all cached prompts
 * @returns {Object} Reload status with list of reloaded prompts
 */
export function reloadAllPrompts() {
  const reloaded = [];
  const errors = [];

  // Reload currently cached prompts
  for (const filename of promptLoader.getCachedPrompts()) {
    try {
      loadPrompt(filename, true);
      reloaded.push(filename);
    } catch (err) {
      errors.push({ filename, error: err.message });
    }
  }

  // Also reload known prompt files that might not be cached yet
  const knownPrompts = [
    'tutor-suggestion.md',
    'tutor-ego.md',
    'tutor-superego.md',
    'tutor-ego-experimental.md',
    'tutor-superego-experimental.md',
  ];

  for (const filename of knownPrompts) {
    if (!promptLoader.getCachedPrompts().includes(filename)) {
      try {
        loadPrompt(filename, true);
        reloaded.push(filename);
      } catch (err) {
        // Ignore missing optional prompts
      }
    }
  }

  // Notify callbacks
  for (const callback of promptReloadCallbacks) {
    try {
      callback(reloaded);
    } catch (err) {
      console.warn('Prompt reload callback error:', err.message);
    }
  }

  return { reloaded: [...new Set(reloaded)], errors };
}

/**
 * Register a callback to be notified when prompts are reloaded
 * @param {Function} callback - Callback function(reloadedFiles)
 */
export function onPromptsReload(callback) {
  promptReloadCallbacks.push(callback);
}

/**
 * Get dialogue configuration
 * @param {string} profileName - Optional profile name
 * @returns {Object} Dialogue settings
 */
export function getDialogueConfig(profileName = null) {
  const profile = getActiveProfile(profileName);
  return profile.dialogue || { enabled: true, max_rounds: 2 };
}

/**
 * Get intervention thresholds
 * @param {string} profileName - Optional profile name
 * @returns {Object} Intervention threshold settings
 */
export function getInterventionThresholds(profileName = null) {
  const profile = getActiveProfile(profileName);
  return profile.intervention_thresholds || getDefaultThresholds();
}

/**
 * Get evaluation configuration
 * @returns {Object} Evaluation settings
 */
export function getEvaluationConfig() {
  const config = loadConfig();
  return config.evaluation || {
    log_dialogues: false,
    metrics: [],
    ab_testing: { enabled: false },
  };
}

/**
 * Get logging configuration
 * @returns {Object} Logging settings
 */
export function getLoggingConfig() {
  const config = loadConfig();
  return config.logging || {
    log_api_calls: false,
    level: 'info',
    path: 'logs/tutor-api',
    include_prompts: false,
    include_responses: false,
  };
}

/**
 * List all available profiles
 * @returns {Array} Array of profile names and descriptions
 */
export function listProfiles() {
  const config = loadConfig();
  const profiles = config.profiles || {};

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
 * Resolve a model reference to full provider config and model ID
 * Delegates to shared modelResolver.js
 *
 * @param {string|Object} ref - Model reference string or object
 * @returns {Object} { provider, model, apiKey, isConfigured, baseUrl }
 */
export const resolveModel = createBoundResolver(getProviderConfig);

export default {
  loadConfig,
  loadProviders,
  getActiveProfile,
  getProviderConfig,
  getAgentConfig,
  getSuperegoStrategy,
  listSuperegoStrategies,
  loadPrompt,
  getPromptMetadata,
  reloadAllPrompts,
  onPromptsReload,
  getPromptCacheStatus,
  getDialogueConfig,
  getInterventionThresholds,
  getEvaluationConfig,
  getLoggingConfig,
  listProfiles,
  resolveModel,
};
