/**
 * Model Resolver
 *
 * Unified model resolution logic shared across config loaders.
 * Resolves model references like "provider.model" to full provider configs.
 *
 * This consolidates duplicate implementations from:
 * - tutorConfigLoader.js
 * - learnerConfigLoader.js
 * - agents/learnerAgentRegistry.js (deprecated wrapper)
 */

/**
 * Resolve a model reference to full provider config and model ID
 *
 * Supports formats:
 *   - "provider.model" string (e.g., "anthropic.sonnet", "openrouter.haiku")
 *   - { provider, model } object
 *
 * @param {string|Object} ref - Model reference string or object
 * @param {Function} getProviderConfig - Function to get provider config by name
 * @returns {Object} { provider, model, apiKey, isConfigured, baseUrl }
 * @throws {Error} If ref format is invalid or provider not found
 *
 * @example
 * // String format
 * resolveModel("anthropic.sonnet", getProviderConfig)
 * // => { provider: 'anthropic', model: 'claude-sonnet-4-20250514', apiKey: '...', isConfigured: true }
 *
 * @example
 * // Object format
 * resolveModel({ provider: 'openrouter', model: 'haiku' }, getProviderConfig)
 * // => { provider: 'openrouter', model: 'anthropic/claude-3-haiku', apiKey: '...', isConfigured: true }
 */
export function resolveModel(ref, getProviderConfig) {
  if (!getProviderConfig || typeof getProviderConfig !== 'function') {
    throw new Error('getProviderConfig function is required');
  }

  let providerName, modelAlias;

  if (typeof ref === 'string') {
    // Parse "provider.model" format - split on first dot only to support model aliases with dots (e.g., "kimi-k2.5")
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
      throw new Error(
        'Model reference object must have both "provider" and "model" properties'
      );
    }
  } else {
    throw new Error('Model reference must be a string or object');
  }

  // Get provider configuration (includes models mapping, API key, etc.)
  const providerConfig = getProviderConfig(providerName);

  // Resolve model alias to full model ID
  // e.g., "haiku" -> "claude-haiku-4-5" or "anthropic/claude-3-haiku"
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
 * Create a bound resolveModel function for a specific config loader
 *
 * This allows config loaders to export their own resolveModel without
 * requiring callers to pass getProviderConfig every time.
 *
 * @param {Function} getProviderConfig - Function to get provider config by name
 * @returns {Function} Bound resolveModel function
 *
 * @example
 * // In tutorConfigLoader.js:
 * import { createBoundResolver } from './modelResolver.js';
 * export const resolveModel = createBoundResolver(getProviderConfig);
 */
export function createBoundResolver(getProviderConfig) {
  return (ref) => resolveModel(ref, getProviderConfig);
}

/**
 * Validate a model reference without resolving it
 *
 * @param {string|Object} ref - Model reference to validate
 * @returns {{ valid: boolean, error?: string, provider?: string, model?: string }}
 */
export function validateModelRef(ref) {
  try {
    let providerName, modelAlias;

    if (typeof ref === 'string') {
      // Split on first dot only to support model aliases with dots (e.g., "kimi-k2.5")
      const dotIndex = ref.indexOf('.');
      if (dotIndex <= 0 || dotIndex >= ref.length - 1) {
        return {
          valid: false,
          error: `Invalid format. Expected "provider.model", got "${ref}"`,
        };
      }
      providerName = ref.slice(0, dotIndex);
      modelAlias = ref.slice(dotIndex + 1);
    } else if (typeof ref === 'object' && ref !== null) {
      providerName = ref.provider;
      modelAlias = ref.model;

      if (!providerName || !modelAlias) {
        return {
          valid: false,
          error: 'Object must have both "provider" and "model" properties',
        };
      }
    } else {
      return {
        valid: false,
        error: 'Reference must be a string or object',
      };
    }

    return {
      valid: true,
      provider: providerName,
      model: modelAlias,
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
}

export default {
  resolveModel,
  createBoundResolver,
  validateModelRef,
};
