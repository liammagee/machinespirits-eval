/**
 * Config Loader Base
 *
 * Shared configuration loading utilities used by tutorConfigLoader and learnerConfigLoader.
 * Provides YAML loading with mtime-based caching, provider resolution, and prompt loading.
 *
 * This consolidates duplicate implementations from:
 * - tutorConfigLoader.js
 * - learnerConfigLoader.js
 */

import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

// Resolve paths relative to this module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CONFIG_DIR = path.join(ROOT_DIR, 'config');
const PROMPTS_DIR = path.join(ROOT_DIR, 'prompts');

// Shared providers cache (since providers.yaml is used by both loaders)
let sharedProvidersCache = null;
let sharedProvidersMtime = null;

// Client config overlay (registered by consuming repos like eval-repo)
let clientConfigDir = null;
let clientProvidersMtime = null;

/**
 * Deep-merge two provider objects: client overrides core defaults.
 *
 * Per-provider: client fields override core fields.
 * `models` sub-object is merged additively (client models override/extend core models).
 *
 * @param {Object} core - Core providers from tutor-core
 * @param {Object} client - Client provider overrides
 * @returns {Object} Merged providers
 */
function deepMergeProviders(core, client) {
  const merged = { ...core };
  for (const [providerName, clientProvider] of Object.entries(client)) {
    const coreProvider = merged[providerName];
    if (!coreProvider) {
      // New provider from client — add as-is
      merged[providerName] = clientProvider;
    } else {
      // Merge: client fields override core, models merged additively
      merged[providerName] = {
        ...coreProvider,
        ...clientProvider,
        models: { ...coreProvider.models, ...clientProvider.models },
      };
    }
  }
  return merged;
}

/**
 * Register a client config directory for provider overlay.
 *
 * When registered, loadProviders() reads both the core providers.yaml
 * and the client's providers.yaml, deep-merging them (client wins).
 *
 * @param {string} dirPath - Absolute path to client config directory
 */
export function registerClientConfigDir(dirPath) {
  clientConfigDir = dirPath;
  // Invalidate caches so next loadProviders() re-merges
  sharedProvidersCache = null;
  sharedProvidersMtime = null;
  clientProvidersMtime = null;
}

/**
 * Load providers from shared providers.yaml, with optional client overlay.
 *
 * If a client config dir has been registered via registerClientConfigDir(),
 * providers from both files are deep-merged (client overrides core defaults).
 *
 * @param {boolean} forceReload - Force reload from disk
 * @returns {Object} Providers configuration
 */
export function loadProviders(forceReload = false) {
  const coreProvidersPath = path.join(CONFIG_DIR, 'providers.yaml');

  try {
    const coreStats = fs.statSync(coreProvidersPath);

    // Check client file mtime too (if registered)
    let clientStats = null;
    if (clientConfigDir) {
      try {
        clientStats = fs.statSync(path.join(clientConfigDir, 'providers.yaml'));
      } catch {
        // Client providers.yaml is optional
      }
    }

    const coreChanged = sharedProvidersMtime !== coreStats.mtimeMs;
    const clientChanged = clientStats && clientProvidersMtime !== clientStats.mtimeMs;

    if (!forceReload && sharedProvidersCache && !coreChanged && !clientChanged) {
      return sharedProvidersCache;
    }

    // Load core providers
    const coreContent = fs.readFileSync(coreProvidersPath, 'utf-8');
    const coreParsed = yaml.parse(coreContent);
    let providers = coreParsed?.providers || {};
    sharedProvidersMtime = coreStats.mtimeMs;

    // Merge client overlay if available
    if (clientStats) {
      const clientPath = path.join(clientConfigDir, 'providers.yaml');
      const clientContent = fs.readFileSync(clientPath, 'utf-8');
      const clientParsed = yaml.parse(clientContent);
      const clientProviders = clientParsed?.providers || {};
      providers = deepMergeProviders(providers, clientProviders);
      clientProvidersMtime = clientStats.mtimeMs;
    }

    sharedProvidersCache = providers;
    return sharedProvidersCache;
  } catch (err) {
    console.warn('providers.yaml not found, using defaults');
    return null;
  }
}

/**
 * Get provider configuration with environment variable resolution
 * @param {Object} providers - Providers object from config
 * @param {string} providerName - Provider name (anthropic, openai, openrouter, gemini, local)
 * @returns {Object} Provider configuration with resolved API key
 */
export function resolveProviderConfig(providers, providerName) {
  const provider = providers?.[providerName];

  if (!provider) {
    throw new Error(`Unknown provider: ${providerName}`);
  }

  // Resolve API key from environment (if required)
  const apiKey = provider.api_key_env ? (process.env[provider.api_key_env] || '') : '';

  // Providers without api_key_env (local, lmstudio, etc.) only need base_url
  const needsApiKey = Boolean(provider.api_key_env);
  const isConfigured = needsApiKey ? Boolean(apiKey) : Boolean(provider.base_url);

  return {
    ...provider,
    apiKey,
    isConfigured,
  };
}

/**
 * Create a config loader with caching for a specific YAML file
 * @param {string} configFileName - Name of the config file (e.g., 'tutor-agents.yaml')
 * @param {Function} getDefaultConfig - Function that returns default config if file not found
 * @returns {Object} Loader utilities { loadConfig, getProviderConfig, clearCache }
 */
export function createConfigLoader(configFileName, getDefaultConfig) {
  // Per-loader cache
  let configCache = null;
  let configMtime = null;
  let providersMtime = null;

  /**
   * Load the configuration with mtime-based caching
   * @param {boolean} forceReload - Force reload from disk
   * @returns {Object} Configuration object
   */
  function loadConfig(forceReload = false) {
    const configPath = path.join(CONFIG_DIR, configFileName);
    const providersPath = path.join(CONFIG_DIR, 'providers.yaml');

    // Check if files have changed
    try {
      const configStats = fs.statSync(configPath);
      let providersStats = null;
      try {
        providersStats = fs.statSync(providersPath);
      } catch (e) {
        // providers.yaml is optional
      }

      const providersChanged = providersStats && providersMtime !== providersStats.mtimeMs;
      const configChanged = configMtime !== configStats.mtimeMs;

      if (!forceReload && configCache && !configChanged && !providersChanged) {
        return configCache;
      }

      configMtime = configStats.mtimeMs;
      if (providersStats) providersMtime = providersStats.mtimeMs;
    } catch (err) {
      console.warn(`Config file ${configFileName} not found, using defaults:`, err.message);
      return getDefaultConfig();
    }

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      configCache = yaml.parse(content);

      // Merge shared providers (providers.yaml takes precedence)
      const sharedProviders = loadProviders(forceReload);
      if (sharedProviders) {
        configCache.providers = { ...configCache.providers, ...sharedProviders };
      }

      return configCache;
    } catch (err) {
      console.error(`Failed to parse ${configFileName}:`, err.message);
      return getDefaultConfig();
    }
  }

  /**
   * Get provider configuration with environment variable resolution
   * @param {string} providerName - Provider name
   * @returns {Object} Provider configuration with resolved API key
   */
  function getProviderConfig(providerName) {
    const config = loadConfig();
    return resolveProviderConfig(config.providers, providerName);
  }

  /**
   * Clear the config cache (for testing or forced refresh)
   */
  function clearCache() {
    configCache = null;
    configMtime = null;
    providersMtime = null;
  }

  return {
    loadConfig,
    getProviderConfig,
    clearCache,
  };
}

/**
 * Create a prompt loader with mtime-based caching
 * @param {string} defaultPromptFn - Function that returns default prompt for a filename
 * @returns {Object} Prompt loader utilities { loadPrompt, clearPromptCache, getPromptCacheStatus }
 */
export function createPromptLoader(defaultPromptFn = null) {
  // Per-loader prompt cache
  const promptCache = new Map();

  /**
   * Load a prompt file with mtime-based caching
   * @param {string} filename - Prompt filename
   * @param {boolean} forceReload - Force reload from disk
   * @returns {string} Prompt content
   */
  function loadPrompt(filename, forceReload = false) {
    const promptPath = path.join(PROMPTS_DIR, filename);

    try {
      if (!fs.existsSync(promptPath)) {
        if (defaultPromptFn) {
          return defaultPromptFn(filename);
        }
        return `Prompt file ${filename} not found.`;
      }

      const stats = fs.statSync(promptPath);
      const cached = promptCache.get(filename);

      // Return cached if not forced and mtime unchanged
      if (!forceReload && cached && cached.mtime === stats.mtimeMs) {
        return cached.content;
      }

      // Load fresh from disk
      const rawContent = fs.readFileSync(promptPath, 'utf-8');
      // Remove markdown title (first line starting with #)
      const content = rawContent.replace(/^#[^\n]*\n+/, '').trim();

      // Extract version from <!-- version: X.Y --> comment
      const versionMatch = rawContent.match(/<!--\s*version:\s*([\d.]+)\s*-->/);
      const version = versionMatch ? versionMatch[1] : null;

      // Compute 16-char SHA-256 content hash (of the raw file, not stripped content)
      const contentHash = createHash('sha256').update(rawContent).digest('hex').slice(0, 16);

      // Track if this was a change (for hot reload logging)
      const wasChanged = cached && cached.mtime !== stats.mtimeMs;
      promptCache.set(filename, { content, mtime: stats.mtimeMs, version, contentHash });

      if (wasChanged) {
        console.log(`[Hot Reload] Prompt reloaded: ${filename}`);
      }

      return content;
    } catch (err) {
      console.warn(`Failed to load prompt ${filename}:`, err.message);
      if (defaultPromptFn) {
        return defaultPromptFn(filename);
      }
      return `Prompt file ${filename} not found.`;
    }
  }

  /**
   * Clear the prompt cache
   */
  function clearPromptCache() {
    promptCache.clear();
  }

  /**
   * Get prompt cache status for debugging
   * @returns {Object} Cache status by filename
   */
  function getPromptCacheStatus() {
    const status = {};
    for (const [filename, { mtime }] of promptCache.entries()) {
      const promptPath = path.join(PROMPTS_DIR, filename);
      let currentMtime = null;
      let needsReload = false;
      try {
        currentMtime = fs.statSync(promptPath).mtimeMs;
        needsReload = currentMtime !== mtime;
      } catch (e) {
        // File may have been deleted
      }
      status[filename] = {
        cachedMtime: new Date(mtime).toISOString(),
        currentMtime: currentMtime ? new Date(currentMtime).toISOString() : null,
        needsReload,
      };
    }
    return status;
  }

  /**
   * Get list of cached prompt filenames
   * @returns {Array<string>} Cached filenames
   */
  function getCachedPrompts() {
    return Array.from(promptCache.keys());
  }

  /**
   * Get version and content hash metadata for a prompt file.
   * Triggers a load if the file is not yet cached.
   *
   * @param {string} filename - Prompt filename
   * @returns {{ version: string|null, contentHash: string, filename: string }}
   */
  function getPromptMetadata(filename) {
    // Ensure the file is loaded (populates cache with version + hash)
    if (!promptCache.has(filename)) {
      loadPrompt(filename);
    }
    const cached = promptCache.get(filename);
    return {
      version: cached?.version || null,
      contentHash: cached?.contentHash || null,
      filename,
    };
  }

  return {
    loadPrompt,
    clearPromptCache,
    getPromptCacheStatus,
    getCachedPrompts,
    getPromptMetadata,
  };
}

// Export path constants for loaders that need them
export { CONFIG_DIR, PROMPTS_DIR, ROOT_DIR };

export default {
  loadProviders,
  registerClientConfigDir,
  resolveProviderConfig,
  createConfigLoader,
  createPromptLoader,
  CONFIG_DIR,
  PROMPTS_DIR,
  ROOT_DIR,
};
