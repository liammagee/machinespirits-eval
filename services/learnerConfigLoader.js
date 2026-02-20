/**
 * Learner Configuration Loader
 *
 * Loads and manages synthetic learner configuration from YAML files.
 * Supports environment variable overrides and multiple profiles.
 *
 * Uses shared configLoaderBase.js for common loading patterns.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';
import { configLoaderBase, modelResolver } from '@machinespirits/tutor-core';
const { createConfigLoader, createPromptLoader } = configLoaderBase;
const { createBoundResolver } = modelResolver;

// Local eval-repo config directory (for learner-agents.yaml override)
const __filename_local = fileURLToPath(import.meta.url);
const __dirname_local = path.dirname(__filename_local);
const LOCAL_CONFIG_DIR = path.join(path.resolve(__dirname_local, '..'), 'config');

// ============================================================================
// Default Configurations
// ============================================================================

/**
 * Load merged providers from configLoaderBase (tutor-core defaults + eval-repo overrides).
 * No hardcoded model IDs — all model references are resolved through YAML config.
 */
function getDefaultProviders() {
  const merged = configLoaderBase.loadProviders();
  if (merged) return merged;
  // Minimal structural fallback (no model IDs — callers must configure via YAML)
  return {
    openrouter: {
      api_key_env: 'OPENROUTER_API_KEY',
      base_url: 'https://openrouter.ai/api/v1/chat/completions',
      models: {},
    },
  };
}

function getDefaultConfig() {
  return {
    active_profile: 'unified',
    providers: getDefaultProviders(),
    architectures: {
      unified: getDefaultArchitecture(),
    },
    personas: {
      eager_novice: getDefaultPersona(),
    },
    profiles: {
      unified: getDefaultProfile(),
    },
  };
}

function getDefaultProfile() {
  return {
    description: 'Single unified learner agent',
    architecture: 'unified',
    provider: 'openrouter',
    model: 'nemotron',
    dialogue: {
      enabled: false,
      max_rounds: 0,
    },
  };
}

function getDefaultArchitecture() {
  return {
    name: 'Unified Learner',
    description: 'Single agent representing the whole learner',
    agents: {
      unified_learner: {
        role: 'unified_learner',
        prompt_file: 'learner-unified.md',
        hyperparameters: {
          temperature: 0.7,
          max_tokens: 300,
        },
      },
    },
  };
}

function getDefaultPersona() {
  return {
    name: 'Eager Novice',
    description: 'Enthusiastic but easily overwhelmed',
    default_architecture: 'unified',
    traits: {
      frustration_threshold: 'low',
      persistence: 'medium',
      prior_knowledge: 'minimal',
      self_confidence: 'low',
    },
  };
}

function getDefaultPrompt(filename) {
  const role = filename.replace('learner-', '').replace('.md', '');

  const defaults = {
    unified: `You are simulating a learner's internal experience. Respond authentically to the tutor's message, showing genuine reactions including confusion, insight, frustration, or understanding.`,
    ego: `You represent the EGO dimension of the learner. Draft an authentic learner response based on the conversation so far — express what the learner would naturally say, including confusion, partial understanding, questions, and emotional reactions.`,
    superego: `You represent the SUPEREGO dimension of the learner. Critique the ego's draft response: Is it realistic for this learner's level? Does it engage meaningfully with the tutor's message? Should the learner push back, ask for clarification, or show more/less understanding?`,
    desire: `You represent the DESIRE dimension of a learner. Express immediate wants, frustrations, and emotional reactions.`,
    intellect: `You represent the INTELLECT dimension of a learner. Process information rationally, identify what makes sense and what doesn't.`,
    aspiration: `You represent the ASPIRATION dimension of a learner. Express goals, standards, and desire for mastery.`,
    thesis: `You represent the learner's CURRENT UNDERSTANDING. State what you currently believe or understand about the topic.`,
    antithesis: `You represent the learner's DOUBT. Challenge the current understanding, raise questions and objections.`,
    'synthesis-dialectical': `You represent the learner's EMERGING UNDERSTANDING. Integrate the thesis and antithesis into a new perspective.`,
    synthesis: `Synthesize the internal voices into a coherent external response that the learner would actually say.`,
    novice: `You are the NOVICE voice. Express confusion, basic questions, and unfamiliarity with the material.`,
    practitioner: `You are the PRACTITIONER voice. Apply prior knowledge, make connections, show developing competence.`,
    expert: `You are the EXPERT voice. Show deep understanding, make sophisticated connections, identify nuance.`,
  };

  return (
    defaults[role] || `You are simulating part of a learner's internal experience. (Prompt file ${filename} not found)`
  );
}

// ============================================================================
// Create Base Loaders
// ============================================================================

// Load from eval repo's local config/ directory first, fall back to tutor-core's createConfigLoader
let localConfigCache = null;
let localConfigMtime = null;

function loadLocalConfig(forceReload = false) {
  const localPath = path.join(LOCAL_CONFIG_DIR, 'learner-agents.yaml');
  try {
    const stats = fs.statSync(localPath);
    if (!forceReload && localConfigCache && localConfigMtime === stats.mtimeMs) {
      return localConfigCache;
    }
    const content = fs.readFileSync(localPath, 'utf-8');
    const localYaml = yaml.parse(content);
    localConfigMtime = stats.mtimeMs;

    // Merge local overrides on top of defaults so missing sections
    // (e.g. personas) fall back to built-in defaults instead of being undefined.
    // getDefaultProviders() already returns the merged tutor-core + eval-repo providers
    // via configLoaderBase.loadProviders(), so no separate eval provider merge needed.
    const defaults = getDefaultConfig();
    localConfigCache = {
      ...defaults,
      ...localYaml,
      providers: { ...defaults.providers, ...localYaml.providers },
      profiles: { ...defaults.profiles, ...localYaml.profiles },
      architectures: { ...defaults.architectures, ...localYaml.architectures },
      personas: { ...defaults.personas, ...localYaml.personas },
    };

    return localConfigCache;
  } catch {
    // Fall through to tutor-core's loader / defaults
    return null;
  }
}

const coreConfigLoader = createConfigLoader('learner-agents.yaml', getDefaultConfig);
const promptLoader = createPromptLoader(getDefaultPrompt);

// loadConfig: prefer local eval-repo config, fall back to tutor-core / defaults
export function loadConfig(forceReload = false) {
  return loadLocalConfig(forceReload) || coreConfigLoader.loadConfig(forceReload);
}

// getProviderConfig needs to use the locally-loaded config's providers
export function getProviderConfig(providerName) {
  const config = loadConfig();
  const provider = config.providers?.[providerName];
  if (!provider) {
    // Fall back to tutor-core's resolver
    return coreConfigLoader.getProviderConfig(providerName);
  }
  const apiKey = provider.api_key_env ? process.env[provider.api_key_env] || '' : '';
  const isLocal = providerName === 'local';
  const isConfigured = isLocal ? Boolean(provider.base_url) : Boolean(apiKey);
  return { ...provider, apiKey, isConfigured };
}

// Re-export loadProviders (delegates to evalConfigLoader which wraps configLoaderBase)
export { loadProviders } from './evalConfigLoader.js';

// Re-export prompt loading utilities
export const loadPrompt = promptLoader.loadPrompt;

// ============================================================================
// Learner-Specific Functions
// ============================================================================

/**
 * Get the active profile configuration
 * @param {string} profileName - Optional profile name override
 * @returns {Object} Profile configuration
 */
export function getActiveProfile(profileName = null) {
  const config = loadConfig();

  // Check for environment variable override
  const envProfile = process.env.LEARNER_PROFILE || process.env.LEARNER_AGENT_PROFILE;
  const targetProfile = profileName || envProfile || config.active_profile || 'unified';

  const profile = config.profiles?.[targetProfile];
  if (!profile) {
    console.warn(`Learner profile "${targetProfile}" not found, using unified`);
    return config.profiles?.unified || getDefaultProfile();
  }

  return {
    name: targetProfile,
    ...profile,
  };
}

/**
 * Get architecture configuration
 * @param {string} architectureName - Architecture name (unified, ego_superego)
 * @returns {Object} Architecture configuration with agents
 */
export function getArchitecture(architectureName) {
  const config = loadConfig();
  const arch = config.architectures?.[architectureName];

  if (!arch) {
    console.warn(`Architecture "${architectureName}" not found, using unified`);
    return config.architectures?.unified || getDefaultArchitecture();
  }

  return arch;
}

/**
 * Get persona configuration
 * @param {string} personaId - Persona identifier
 * @returns {Object} Persona configuration
 */
export function getPersona(personaId) {
  const config = loadConfig();
  const persona = config.personas?.[personaId];

  if (!persona) {
    console.warn(`Persona "${personaId}" not found, using eager_novice`);
    return config.personas?.eager_novice || getDefaultPersona();
  }

  return {
    id: personaId,
    ...persona,
  };
}

/**
 * Get agent configuration for a specific role
 * Mirrors tutorConfigLoader.getAgentConfig pattern - reads per-agent config from profile
 * @param {string} role - Agent role (e.g., 'desire', 'intellect', 'unified_learner', 'synthesis')
 * @param {string} profileName - Optional profile name
 * @returns {Object} Complete agent configuration
 */
export function getAgentConfig(role, profileName = null) {
  const profile = getActiveProfile(profileName);
  const agentConfig = profile[role];

  if (!agentConfig) {
    return null;
  }

  // Get provider configuration from the agent's own settings
  const providerName = agentConfig.provider || 'openrouter';
  const providerConfig = getProviderConfig(providerName);

  // Resolve model name (short name like 'nemotron' -> full ID)
  const modelAlias = agentConfig.model || 'nemotron';
  const modelFullId = providerConfig.models?.[modelAlias] || modelAlias;

  // Load prompt file
  const prompt = loadPrompt(agentConfig.prompt_file);

  return {
    role,
    provider: providerName,
    providerConfig,
    model: modelFullId,
    modelAlias,
    prompt,
    hyperparameters: agentConfig.hyperparameters || {},
    isConfigured: providerConfig.isConfigured,
  };
}

/**
 * Get synthesis agent configuration (for multi-agent architectures)
 * Reads from profile.synthesis directly (mirrors per-agent pattern)
 * @param {string} profileName - Optional profile name
 * @returns {Object} Synthesis agent configuration
 */
export function getSynthesisConfig(profileName = null) {
  // Use getAgentConfig with 'synthesis' role - same pattern as other agents
  return getAgentConfig('synthesis', profileName);
}

/**
 * List all available profiles
 * @returns {Array} Array of profile summaries
 */
export function listProfiles() {
  const config = loadConfig();
  const profiles = config.profiles || {};

  return Object.entries(profiles).map(([name, profile]) => {
    const agents = getProfileAgentRoles(name);
    return {
      name,
      description: profile.description || '',
      dialogueEnabled: profile.dialogue?.enabled ?? false,
      maxRounds: profile.dialogue?.max_rounds ?? 0,
      agents: agents.map((role) => ({
        role,
        provider: profile[role]?.provider,
        model: profile[role]?.model,
      })),
    };
  });
}

/**
 * Get the list of agent roles defined in a profile
 * @param {string} profileName - Profile name
 * @returns {Array<string>} List of agent role names (excluding 'synthesis')
 */
export function getProfileAgentRoles(profileName = null) {
  const profile = getActiveProfile(profileName);

  // Reserved keys that are not agent roles
  const reservedKeys = ['name', 'description', 'dialogue', 'synthesis'];

  // Get all keys that have a provider/model/prompt_file (indicating an agent config)
  const agentRoles = Object.keys(profile).filter((key) => {
    if (reservedKeys.includes(key)) return false;
    const val = profile[key];
    return val && typeof val === 'object' && (val.provider || val.model || val.prompt_file);
  });

  return agentRoles;
}

/**
 * Check if profile has synthesis agent
 * @param {string} profileName - Profile name
 * @returns {boolean} True if profile has synthesis agent
 */
export function profileHasSynthesis(profileName = null) {
  const profile = getActiveProfile(profileName);
  return profile.synthesis && typeof profile.synthesis === 'object' && profile.synthesis.prompt_file;
}

/**
 * List all available personas
 * @returns {Array} Array of persona summaries
 */
export function listPersonas() {
  const config = loadConfig();
  const personas = config.personas || {};

  return Object.entries(personas).map(([id, persona]) => ({
    id,
    name: persona.name,
    description: persona.description,
    defaultArchitecture: persona.default_architecture,
  }));
}

/**
 * List all available architectures
 * @returns {Array} Array of architecture summaries
 */
export function listArchitectures() {
  const config = loadConfig();
  const archs = config.architectures || {};

  return Object.entries(archs).map(([id, arch]) => ({
    id,
    name: arch.name,
    description: arch.description,
    agentCount: Object.keys(arch.agents || {}).length,
    hasSynthesis: !!arch.synthesis,
  }));
}

/**
 * Get logging configuration
 * @returns {Object} Logging settings
 */
export function getLoggingConfig() {
  const config = loadConfig();
  return (
    config.logging || {
      log_deliberation: true,
      log_path: 'logs/learner-agents',
      include_internal_state: true,
    }
  );
}

/**
 * Get evaluation configuration
 * @returns {Object} Evaluation settings
 */
export function getEvaluationConfig() {
  const config = loadConfig();
  return (
    config.evaluation || {
      track_emotional_state: true,
      track_understanding_level: true,
      track_memory_changes: true,
    }
  );
}

/**
 * Resolve a model reference to full provider config and model ID
 * Delegates to shared modelResolver.js
 *
 * @param {string|Object} ref - Model reference (\"provider.model\" or { provider, model })
 * @returns {Object} { provider, model, apiKey, isConfigured, baseUrl }
 */
export const resolveModel = createBoundResolver(getProviderConfig);

/**
 * Get YAML-level model overrides from learner-agents.yaml.
 * These are lower priority than CLI flags.
 *
 * @returns {Object} { modelOverride, egoModelOverride, superegoModelOverride } (null if not set)
 */
export function getLearnerModelOverrides() {
  const config = loadConfig();
  return {
    modelOverride: config?.model_override || null,
    egoModelOverride: config?.ego_model_override || null,
    superegoModelOverride: config?.superego_model_override || null,
  };
}

// Import for default export (the named re-export above handles the named export)
import { loadProviders as _loadProviders } from './evalConfigLoader.js';

export default {
  loadConfig,
  loadProviders: _loadProviders,
  getActiveProfile,
  getProviderConfig,
  getArchitecture,
  getPersona,
  getAgentConfig,
  getSynthesisConfig,
  getProfileAgentRoles,
  profileHasSynthesis,
  loadPrompt,
  resolveModel,
  listProfiles,
  listPersonas,
  listArchitectures,
  getLoggingConfig,
  getEvaluationConfig,
  getLearnerModelOverrides,
};
