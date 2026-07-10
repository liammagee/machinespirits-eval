/**
 * External AI Provider Hook
 *
 * A generic, injectable seam that lets a CONSUMING repo (e.g. the eval
 * layer) route additional provider names — ones tutor-core's own HTTP
 * dispatch does not know (local CLI bridges like `codex` / `claude-code`)
 * — through its own call function, without tutor-core importing any
 * client code. tutor-core defines only the interface and the dispatch
 * points; the hook itself is registered from outside via
 * setExternalAIProviderHook() (mirroring the setLogDir()/
 * registerClientConfigDir() injection pattern this module family already
 * uses). One-way dependency preserved: tutor-core/** never imports the
 * eval repo.
 *
 * Hook shape:
 *   {
 *     handles(provider: string) => boolean,
 *     call(request) => Promise<{
 *       text: string,
 *       model?: string,
 *       provider?: string,
 *       latencyMs?: number,
 *       inputTokens?: number,
 *       outputTokens?: number,
 *       cost?: number,
 *       finishReason?: string,
 *     }>,
 *   }
 *
 * Request shape (built by the dispatch points):
 *   {
 *     channel: 'dialogue-engine' | 'unified',
 *     provider: string,
 *     model: string,
 *     systemPrompt: string,
 *     messages: Array<{role, content}>,
 *     hyperparameters: { temperature?, max_tokens?, ... },
 *   }
 *
 * Dispatch points (all no-ops when no hook is registered — default
 * behavior is byte-identical to before this module existed):
 *   - tutorDialogueEngine._fetchProvider (the callAI standard loop:
 *     ego / superego / ego-revise, plus the learner engine's direct
 *     _fetchProvider import)
 *   - unifiedAIProviderService.call (aiService.generateText — the
 *     dialectical critique/negotiation layer)
 *   - configLoaderBase.resolveProviderConfig (treats hook-handled
 *     providers as configured, so model overrides resolve cleanly)
 */

let externalHook = null;

/**
 * Register (or replace) the external provider hook.
 * Pass null to unregister.
 *
 * @param {Object|null} hook - { handles(provider), call(request) } or null
 */
export function setExternalAIProviderHook(hook) {
  if (hook == null) {
    externalHook = null;
    return;
  }
  if (typeof hook.handles !== 'function' || typeof hook.call !== 'function') {
    throw new Error('External AI provider hook must expose handles(provider) and call(request) functions');
  }
  externalHook = hook;
}

/** Unregister the external provider hook. */
export function clearExternalAIProviderHook() {
  externalHook = null;
}

/** @returns {Object|null} The currently registered hook, if any. */
export function getExternalAIProviderHook() {
  return externalHook;
}

/**
 * Whether the registered hook (if any) claims this provider name.
 * Never throws — a broken hook predicate is treated as "not handled".
 *
 * @param {string} provider
 * @returns {boolean}
 */
export function externalProviderHandles(provider) {
  if (!externalHook || !provider) return false;
  try {
    return Boolean(externalHook.handles(provider));
  } catch {
    return false;
  }
}

/**
 * Call the external provider hook for a request it handles.
 *
 * @param {Object} request - See module docblock for shape
 * @returns {Promise<Object>} Normalized result ({ text, ... })
 */
export async function callExternalProvider(request) {
  const provider = request?.provider;
  if (!externalProviderHandles(provider)) {
    throw new Error(`No external AI provider hook handles provider "${provider}"`);
  }
  const result = await externalHook.call(request);
  if (!result || typeof result.text !== 'string') {
    throw new Error(`External AI provider hook returned no text for provider "${provider}"`);
  }
  return result;
}
