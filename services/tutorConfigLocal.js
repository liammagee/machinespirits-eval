/**
 * Local-first tutor config loader (eval repo owns its prompts).
 *
 * tutor-core's `tutorConfigLoader` resolves prompts against tutor-core's own
 * bundled `prompts/` dir, so tutor prompts edited in this repo never loaded. This
 * thin wrapper delegates ALL config logic to tutor-core unchanged, but re-resolves
 * the agent prompt text through the eval-first loader (see localPromptLoader.js).
 *
 * For files that are byte-identical between eval and tutor-core (the vast majority,
 * kept in sync by the copy step), this is a behavioural no-op — it just makes the
 * eval repo the editable source of truth and stops tutor-core silently owning the
 * active prompt text. The superego strategy modifier (cells 22-33, 93-100) is
 * re-applied exactly as tutor-core does, so strategy-bearing superegos are intact.
 */
import { tutorConfigLoader } from '../tutor-core/index.js';
import { createLocalPromptLoader } from './localPromptLoader.js';

const localLoader = createLocalPromptLoader();

// Pass-through re-exports — everything the eval engine consumes, unchanged.
export const loadConfig = tutorConfigLoader.loadConfig;
export const getProviderConfig = tutorConfigLoader.getProviderConfig;
export const getActiveProfile = tutorConfigLoader.getActiveProfile;
export const getSuperegoStrategy = tutorConfigLoader.getSuperegoStrategy;
export const listSuperegoStrategies = tutorConfigLoader.listSuperegoStrategies;
export const reloadAllPrompts = tutorConfigLoader.reloadAllPrompts;
export const onPromptsReload = tutorConfigLoader.onPromptsReload;
export const getDialogueConfig = tutorConfigLoader.getDialogueConfig;
export const getInterventionThresholds = tutorConfigLoader.getInterventionThresholds;
export const getEvaluationConfig = tutorConfigLoader.getEvaluationConfig;
export const getLoggingConfig = tutorConfigLoader.getLoggingConfig;
export const listProfiles = tutorConfigLoader.listProfiles;
export const resolveModel = tutorConfigLoader.resolveModel;

// Prompt access — eval-first, so provenance (version/hash) reflects the eval copy.
export const loadPrompt = localLoader.loadPrompt;
export const getPromptMetadata = localLoader.getPromptMetadata;
export const getPromptCacheStatus = localLoader.getPromptCacheStatus;

/**
 * getAgentConfig: tutor-core resolves the full config (provider, model, strategy,
 * hyperparameters); we then swap `.prompt` for the eval-resolved text, re-applying
 * the superego strategy modifier so the result matches tutor-core's assembly.
 */
export function getAgentConfig(role, profileName = null, options = {}) {
  const cfg = tutorConfigLoader.getAgentConfig(role, profileName, options);
  if (!cfg) return cfg;

  const profile = tutorConfigLoader.getActiveProfile(profileName);
  const promptFile = profile?.[role]?.prompt_file;
  if (!promptFile) return cfg; // inline/no prompt_file → nothing to redirect

  let prompt = localLoader.loadPrompt(promptFile);

  // Mirror tutor-core: append the superego strategy modifier when one is active.
  const { strategy = null } = options;
  if (role === 'superego' && strategy) {
    const strategyConfig = tutorConfigLoader.getSuperegoStrategy(strategy);
    if (strategyConfig && strategyConfig.prompt_modifier) {
      prompt = `${prompt}\n\n${strategyConfig.prompt_modifier}`;
    }
  }

  return { ...cfg, prompt };
}
