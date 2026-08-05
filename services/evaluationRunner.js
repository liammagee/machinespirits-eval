/**
 * Evaluation Runner Service
 *
 * Orchestrates the evaluation of AI tutor configurations across
 * test scenarios with rubric-based scoring.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { jsonrepair } from 'jsonrepair';
import {
  tutorApiService as tutorApi,
  tutorConfigLoader,
  monitoringService,
  tutorDialogueEngine as dialogueEngine,
  memoryDynamicsService,
} from '../tutor-core/index.js';
// setQuietMode was a convenience export tutor-core used to ship for
// silencing verbose dialogue output during eval runs. It was removed
// from the package's public exports in 0.5.0. Resolve it via a
// namespace import so the static binding doesn't crash module load,
// and fall back to a no-op when the function isn't present — if a
// future tutor-core re-exports it, this resolver picks it up.
import * as _tutorCore from '../tutor-core/index.js';
const setQuietMode = typeof _tutorCore.setQuietMode === 'function' ? _tutorCore.setQuietMode : () => {};
import { buildCliProviderHook, callModelCliText, CLAUDE_CLI_CONTEXT_ISOLATION } from './cliProviderBridge.js';
// Extend CLI providers (codex / claude-code) into tutor-core's dialogue
// engine: the hook is injected from the eval side so tutor-core never
// imports eval code (one-way seam). Covers the callAI standard loop
// (ego/superego/ego-revise) and the unified/aiService dialectical layer,
// making --ego-model codex.gpt-5.5 / --superego-model claude-code.sonnet
// work for standard-runner cells (e.g. cell_40/93), not just id-director
// and learner engines.
//
// MUST register synchronously at module load (not in the lazy dynamic-import
// .then below): a run whose path to the first LLM call is sync/microtask-only
// (sqlite + config reads are synchronous) never yields to the event loop, so
// a dynamic import()'s continuation would fire only at process teardown and
// the first codex/claude-code call would fail "Provider not configured".
if (typeof _tutorCore.setExternalAIProviderHook === 'function') {
  try {
    _tutorCore.setExternalAIProviderHook(buildCliProviderHook());
  } catch (err) {
    console.error(`[evaluationRunner] CLI provider hook registration failed: ${err?.message || err}`);
  }
}
import * as rubricEvaluator from './rubricEvaluator.js';
import {
  buildLearnerEvaluationPrompt,
  buildBatchedLearnerPrompt,
  buildLearnerHolisticEvaluationPrompt,
  calculateLearnerOverallScore,
} from './learnerRubricEvaluator.js';
import * as evaluationStore from './evaluationStore.js';
import * as evalConfigLoader from './evalConfigLoader.js';
import {
  assertEvalProfileTargetExists,
  createEvalProfileRegistry,
  LEGACY_EVAL_PROFILE_ALIASES as LEGACY_PROFILE_ALIASES,
  validateEvalProfileRegistry,
} from './evalProfileRegistry.js';
import * as idDirectorEngine from './idDirectorEngine.js';
import * as contentResolver from './contentResolver.js';
import { ProgressLogger, getProgressLogPath } from './progressLogger.js';
import { StreamingReporter } from './streamingReporter.js';
import * as anovaStats from './anovaStats.js';
import { generateLearnerResponse } from './learnerTutorInteractionEngine.js';
import * as learnerConfigLoader from './learnerConfigLoader.js';
import * as turnComparisonAnalyzer from './turnComparisonAnalyzer.js';
import * as dialogueTraceAnalyzer from './dialogueTraceAnalyzer.js';
import { projectLearnerDeliberationTrace, TRACE_SCHEMA_VERSION } from './traceSchema.js';
import {
  adaptiveTraceScenarioContext,
  adaptiveTraceToDialogueLog,
  extractLearnerTurnsFromTrace,
  isAdaptiveTraceLog,
} from './adaptiveTraceProjection.js';
import * as promptRewriter from './promptRewriter.js';
import { captureApiCalls, attachApiPayloadsToTrace } from './apiPayloadCapture.js';
import { warnIfWeakStackDefault } from './stackDefaultWarning.js';
import { formatApiMessages } from './apiMessageFormatter.js';
import { LiveApiReporter } from './liveApiReporter.js';
import { mockGenerateResult, mockJudgeResult } from './mockProvider.js';
import {
  buildResistanceSignalRetryContext,
  evaluateResistanceSignalTarget,
  resistanceSignalGateMaxAttempts,
} from './resistanceSignalGate.js';
import {
  buildDriftCorrectionContext,
  buildInteriorCharacterSheet,
  checkContentConditionSemantic,
  checkGrounding,
  classifyLearnerDraft,
  countTutorWork,
  driftGateMaxAttempts,
  evaluateLearnerDraft,
  loadFormalInterior,
} from './learnerInteriorGate.js';
import { callJudgeModel as callDriftClassifierJudge } from './rubricEvaluator.js';

const DESUB_DRIFT_CLASSIFIER_MODEL = process.env.DESUB_DRIFT_CLASSIFIER_MODEL || 'openrouter.sonnet-5';
// Stage 2 iteration 2: sonnet-class semantic release judge (frozen; credit
// probed $11.68 at go — openrouter.sonnet-5 per the recorded choice).
const DESUB_SEMANTIC_RELEASE_JUDGE = process.env.DESUB_SEMANTIC_RELEASE_JUDGE || 'openrouter.sonnet-5';
import { formatTranscript } from './transcriptFormatter.js';
import { chalk } from './cliTheme.js';
import {
  resolveEvaluationLogsRoot,
  resolveEvaluationSecondaryArtifactDir,
  resolveTutorDialoguesDir,
} from './evaluationDataPaths.js';
import {
  analyzeLearnerTrajectory,
  buildMessageChain,
  buildMultiTurnContext,
  extractTurnSuperegoAssessment,
  flattenConversationHistory,
  formatLearnerActionForTranscript,
  formatTurnForContext,
  joinContextBlocks,
  shouldGateDynamicResistanceTurn,
  stripRecentChatHistory,
  structureLearnerContext,
} from './evaluationTurnContext.js';
import { createEvaluationTurnExecutionRuntime } from './evaluationTurnExecutionRuntime.js';
import { createEvaluationCheckpointStore } from './evaluationCheckpointStore.js';
import { createEvaluationMultiTurnTranscriptRuntime } from './evaluationMultiTurnTranscriptRuntime.js';
import { createEvaluationMultiTurnCompletionRuntime } from './evaluationMultiTurnCompletionRuntime.js';
import { createEvaluationMultiTurnSetupRuntime } from './evaluationMultiTurnSetupRuntime.js';
import { createEvaluationMultiTurnExecutionRuntime } from './evaluationMultiTurnExecutionRuntime.js';
import { createEvaluationBetweenTurnAdaptationRuntime } from './evaluationBetweenTurnAdaptationRuntime.js';
import { createEvaluationResumeRuntime } from './evaluationResumeRuntime.js';
import { createEvaluationRejudgeRuntime } from './evaluationRejudgeRuntime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVAL_ROOT = path.resolve(__dirname, '..');
const LOGS_ROOT = resolveEvaluationLogsRoot(EVAL_ROOT);
const LOGS_DIR = resolveTutorDialoguesDir(EVAL_ROOT);
const TRANSCRIPTS_DIR = resolveEvaluationSecondaryArtifactDir(EVAL_ROOT, 'transcripts');
const CHECKPOINTS_DIR = resolveEvaluationSecondaryArtifactDir(EVAL_ROOT, 'checkpoints');
const { deleteCheckpoint, listCheckpoints, loadCheckpoint, writeCheckpoint } = createEvaluationCheckpointStore({
  rootDir: CHECKPOINTS_DIR,
});

function resolveRejudgeScenarioAndDialogueLog(result, preloadedDialogueLog = null) {
  const standardScenario = evalConfigLoader.getScenario(result.scenarioId);
  const dialogueLog = preloadedDialogueLog || evaluationStore.loadDialogueLog(result.dialogueId);
  if (standardScenario) return { scenario: standardScenario, dialogueLog };
  if (dialogueLog?.adaptiveTrace) {
    return {
      scenario: adaptiveTraceScenarioContext(dialogueLog.adaptiveTrace, result),
      dialogueLog,
    };
  }
  if (isAdaptiveTraceLog(dialogueLog)) {
    return {
      scenario: adaptiveTraceScenarioContext(dialogueLog, result),
      dialogueLog: adaptiveTraceToDialogueLog(dialogueLog),
    };
  }
  return { scenario: null, dialogueLog };
}

// Redirect tutor-core logs to the same root the eval runner uses.
// (The CLI provider hook is registered synchronously above — do NOT move it
// into this lazy .then: its continuation can starve until process teardown
// on sync-only run paths.)
import('../tutor-core/index.js')
  .then((mod) => {
    if (typeof mod.setLogDir === 'function') mod.setLogDir(LOGS_ROOT);
  })
  .catch(() => {
    /* setLogDir not available in this tutor-core version */
  });

// Read package version once at import time
const pkg = JSON.parse(fs.readFileSync(path.join(EVAL_ROOT, 'package.json'), 'utf-8'));

/**
 * Get the current git commit hash, or 'unknown' if not in a git repo.
 */
function getGitCommitHash() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: EVAL_ROOT, encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

import { isPidAlive } from './processUtils.js';

/**
 * Classify retriable/transient execution errors so failed rows are not persisted.
 * These should be re-attempted by `resume` instead of counted as permanent failures.
 */
export function isTransientEvaluationError(errorMessage = '') {
  const msg = String(errorMessage || '');
  return /429|rate limit|too many requests|503|502|504|timeout|timed out|ECONNREFUSED|ECONNRESET|ETIMEDOUT|terminated|unavailable|fetch failed|failed to fetch|network error|socket hang up|failed to generate suggestions/i.test(
    msg,
  );
}

/**
 * Canonical evaluation cells come from the eval YAML source of truth. Historical
 * non-cell names remain explicit aliases for database and CLI compatibility.
 */
const loadedEvalProfiles = evalConfigLoader.loadTutorAgents()?.profiles;
const evalProfileRegistry = createEvalProfileRegistry(loadedEvalProfiles, LEGACY_PROFILE_ALIASES);

export const CANONICAL_EVAL_PROFILES = evalProfileRegistry.canonicalCellNames;
export const LEGACY_EVAL_PROFILE_ALIASES = evalProfileRegistry.legacyAliases;
export const EVAL_ONLY_PROFILES = evalProfileRegistry.allEvaluationNames;
export { validateEvalProfileRegistry };

/**
 * Resolve an eval profile name into dialogue settings and a tutor-core profile.
 *
 * Eval profiles (cell_*, recognition, etc.) carry dialogue/recognition config that
 * tutor-core doesn't know about. This function extracts those settings and maps the
 * profile name to a tutor-core equivalent ('budget' or 'recognition').
 *
 * Exported for unit testing.
 */
export function resolveEvalProfile(profileName) {
  const isCanonicalCell = CANONICAL_EVAL_PROFILES.includes(profileName);
  const legacyTarget = LEGACY_EVAL_PROFILE_ALIASES[profileName] || null;
  if (profileName?.startsWith('cell_') && !isCanonicalCell) {
    throw new Error(`Unknown evaluation cell "${profileName}"; no matching profile exists in tutor-agents.yaml`);
  }

  const evalProfile = isCanonicalCell ? loadedEvalProfiles[profileName] : null;
  const useDialogue = evalProfile?.dialogue?.enabled ?? false;
  const maxRounds = evalProfile?.dialogue?.max_rounds ?? 0;
  const recognitionMode =
    evalProfile?.recognition_mode ?? (legacyTarget === 'recognition' || profileName?.includes('recognition') || false);

  let resolvedProfileName = profileName;
  const wasRemapped = isCanonicalCell || Boolean(legacyTarget);
  if (legacyTarget) {
    resolvedProfileName = legacyTarget;
  } else if (isCanonicalCell) {
    // Map eval profile to tutor-core profile based on prompt_type
    const promptType = evalProfile?.factors?.prompt_type;
    if (promptType === 'enhanced') {
      resolvedProfileName = 'enhanced';
    } else if (promptType === 'placebo') {
      resolvedProfileName = 'placebo';
    } else if (promptType === 'hardwired') {
      resolvedProfileName = 'hardwired';
    } else if (promptType === 'naive') {
      resolvedProfileName = 'naive';
    } else if (promptType === 'memory') {
      resolvedProfileName = 'memory';
    } else if (promptType === 'recognition_nomem') {
      resolvedProfileName = 'recognition_nomem';
    } else if (promptType === 'divergent_suspicious') {
      resolvedProfileName = recognitionMode ? 'suspicious_recognition' : 'suspicious';
    } else if (promptType === 'divergent_adversary') {
      resolvedProfileName = recognitionMode ? 'adversary_recognition' : 'adversary';
    } else if (promptType === 'divergent_advocate') {
      resolvedProfileName = recognitionMode ? 'advocate_recognition' : 'advocate';
    } else if (promptType === 'dialectical_suspicious') {
      resolvedProfileName = recognitionMode ? 'dialectical_suspicious_recognition' : 'dialectical_suspicious';
    } else if (promptType === 'dialectical_suspicious_directive') {
      // D3 directive bridge variant: same pipeline as dialectical_suspicious; only the
      // ego prompt_file differs (tutor-ego-dialectical-directive.md). Reusing the
      // dialectical_suspicious tutor-core profile is correct because the architectural
      // behaviour (negotiation rounds, rejection budget, superego coupling) is identical;
      // the prompt content is the only treatment variable.
      resolvedProfileName = recognitionMode ? 'dialectical_suspicious_recognition' : 'dialectical_suspicious';
    } else if (promptType === 'dialectical_suspicious_two_pass') {
      // D3 Bridge 1 (two-pass reflection-as-input): same pipeline as
      // dialectical_suspicious. The architectural change is at the eval-runner
      // level (Phase-1 reflection injected into contextStr); the tutor-core
      // profile resolution is unchanged.
      resolvedProfileName = recognitionMode ? 'dialectical_suspicious_recognition' : 'dialectical_suspicious';
    } else if (promptType === 'dialectical_coupling') {
      // D3 Bridge 2 (coupling-targeted superego): same pipeline as
      // dialectical_suspicious. The architectural change is in the superego
      // prompt content (tutor-superego-coupling.md), which retargets critique
      // at reflection-action coupling rather than authenticity. The
      // tutor-core profile resolution is unchanged because the dialectical
      // negotiation loop is identical; only the critique target shifts.
      resolvedProfileName = recognitionMode ? 'dialectical_suspicious_recognition' : 'dialectical_suspicious';
    } else if (promptType === 'dialectical_suspicious_best_of_n') {
      // D3 Bridge 3 (best-of-N selector): same pipeline per candidate as
      // dialectical_suspicious. The architectural change is K parallel
      // candidate dialectical-loop invocations followed by selection on
      // reasoning↔message coupling cosine. Each candidate uses the standard
      // dialectical_suspicious tutor-core profile; the selection happens
      // at the eval-runner level (see runMultiTurnTest, "D3 Bridge 3").
      resolvedProfileName = recognitionMode ? 'dialectical_suspicious_recognition' : 'dialectical_suspicious';
    } else if (promptType === 'dialectical_adversary') {
      resolvedProfileName = recognitionMode ? 'dialectical_adversary_recognition' : 'dialectical_adversary';
    } else if (promptType === 'dialectical_advocate') {
      resolvedProfileName = recognitionMode ? 'dialectical_advocate_recognition' : 'dialectical_advocate';
    } else if (promptType === 'matched_pedagogical') {
      // A10 density control: pedagogical prompt of matched specificity, zero recognition content.
      // Registered in tutor-core as 'matched_pedagogical' profile pointing at tutor-ego-matched-pedagogical.md.
      resolvedProfileName = 'matched_pedagogical';
    } else if (promptType === 'matched_behaviorist') {
      // A10b density control: matched-specificity behaviorist prompt orthogonal to recognition's
      // intersubjective family. Grounded in Skinner/Gagné/Keller/Thorndike/Rosenshine.
      // Registered in tutor-core as 'matched_behaviorist' profile pointing at tutor-ego-matched-behaviorist.md.
      resolvedProfileName = 'matched_behaviorist';
    } else if (recognitionMode) {
      resolvedProfileName = 'recognition';
    } else {
      resolvedProfileName = 'budget';
    }
  }

  // Keep the diagnostic name for the bug_007 regression surface. In the
  // in-housed architecture it must equal the profile that actually loads.
  // The bug_007 regression test asserts on `dispatchedProfileName`: a non-base
  // prompt_type *dispatching* to 'budget' means there's no branch for it (the
  // bug).
  const dispatchedProfileName = resolvedProfileName;

  // The tutor-core module is in-housed, so a missing dispatch target is a
  // configuration error. Never hide it behind a budget/recognition fallback.
  if (wasRemapped) {
    const tutorConfig = tutorConfigLoader.loadConfig();
    assertEvalProfileTargetExists(profileName, resolvedProfileName, tutorConfig?.profiles);
  }

  return { useDialogue, maxRounds, recognitionMode, resolvedProfileName, dispatchedProfileName };
}

/**
 * Compute a deterministic SHA-256 hash of the fully-resolved cell configuration.
 * Detects config drift — if YAML is edited between generation and analysis,
 * or if CLI overrides aren't recorded, the hash will mismatch.
 */
function computeConfigHash(resolvedConfig) {
  const snapshot = {
    profileName: resolvedConfig.profileName || null,
    provider: resolvedConfig.provider || null,
    model: resolvedConfig.model || null,
    egoModel: resolvedConfig.egoModel || null,
    superegoModel: resolvedConfig.superegoModel || null,
    hyperparameters: resolvedConfig.hyperparameters || null,
    superegoHyperparameters: resolvedConfig.superegoHyperparameters || null,
    factors: resolvedConfig.factors || null,
    learnerArchitecture: resolvedConfig.learnerArchitecture || null,
    learnerModelOverride: resolvedConfig.learnerModelOverride || null,
    disableSuperego: resolvedConfig.disableSuperego || false,
    conversationMode: resolvedConfig.conversationMode || null,
    internalHistory: resolvedConfig.internalHistory || null,
  };
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

/**
 * Collect prompt version metadata for tutor ego, superego, and learner prompts.
 *
 * Reads prompt_file fields from the eval YAML profile and learner architecture,
 * then calls getPromptMetadata() to extract version strings and content hashes.
 * Returns a flat object ready to attach to result objects.
 *
 * @param {string} profileName - Eval profile name (e.g. 'cell_5_recog_single_unified')
 * @param {Object} resolvedConfig - Resolved config with learnerArchitecture
 * @returns {{ tutorEgoPromptVersion: string|null, tutorSuperegoPromptVersion: string|null,
 *             learnerPromptVersion: string|null, promptContentHash: string }}
 */
function collectPromptVersions(profileName, resolvedConfig) {
  const versions = {
    tutorEgoPromptVersion: null,
    tutorSuperegoPromptVersion: null,
    learnerPromptVersion: null,
    promptContentHash: null,
  };

  const hashes = [];

  // 1. Tutor ego + superego prompt files from eval YAML profile
  try {
    const rawProfile = evalConfigLoader.loadTutorAgents()?.profiles?.[profileName];
    if (rawProfile?.ego?.prompt_file) {
      const meta = tutorConfigLoader.getPromptMetadata(rawProfile.ego.prompt_file);
      versions.tutorEgoPromptVersion = meta.version;
      if (meta.contentHash) hashes.push(meta.contentHash);
    }
    if (rawProfile?.superego?.prompt_file) {
      const meta = tutorConfigLoader.getPromptMetadata(rawProfile.superego.prompt_file);
      versions.tutorSuperegoPromptVersion = meta.version;
      if (meta.contentHash) hashes.push(meta.contentHash);
    }
  } catch (e) {
    // Profile may not exist or prompt file missing — leave as null
  }

  // 2. Learner prompt file from learner architecture config
  try {
    const learnerArch = resolvedConfig.learnerArchitecture || 'unified';
    const learnerProfile = learnerConfigLoader.getActiveProfile(learnerArch);
    // Unified learners have unified_learner.prompt_file; ego_superego have ego.prompt_file
    const learnerPromptFile = learnerProfile?.unified_learner?.prompt_file || learnerProfile?.ego?.prompt_file || null;
    if (learnerPromptFile) {
      const meta = learnerConfigLoader.getPromptMetadata(learnerPromptFile);
      versions.learnerPromptVersion = meta.version;
      if (meta.contentHash) hashes.push(meta.contentHash);
    }
  } catch (e) {
    // Learner config not available — leave as null
  }

  // 3. Composite hash: combine individual hashes into a single 16-char hash
  if (hashes.length > 0) {
    versions.promptContentHash = createHash('sha256').update(hashes.join(':')).digest('hex').slice(0, 16);
  }

  return versions;
}

/**
 * Resolve provider/model references in a config object through eval's providers.yaml.
 * This ensures eval controls which model IDs get sent to tutorApi.
 */
function resolveConfigModels(config) {
  const resolved = { ...config };
  if (config.provider && config.model) {
    try {
      const r = evalConfigLoader.resolveModel(`${config.provider}.${config.model}`);
      resolved.provider = r.provider;
      resolved.model = r.model;
    } catch (e) {
      console.debug(`[evaluationRunner] resolveModel failed for ${config.provider}.${config.model}:`, e.message);
    }
  }
  if (config.egoModel) {
    try {
      const r = evalConfigLoader.resolveModel(config.egoModel);
      resolved.egoModel = r.model;
      resolved.egoProvider = r.provider;
    } catch (e) {
      console.debug(`[evaluationRunner] resolveModel failed for egoModel ${config.egoModel}:`, e.message);
    }
  }

  // When a profileName is provided but no explicit provider/model,
  // look up the profile from the eval repo's local tutor-agents.yaml
  // and extract the ego provider/model as explicit overrides.
  // Uses egoModel (not model) because tutor-core's generateSuggestions
  // uses profileName to load its own config — egoModel is the override.
  if (resolved.profileName && !resolved.provider && !resolved.model) {
    const profile = evalConfigLoader.getTutorProfile(resolved.profileName);
    if (profile?.ego) {
      resolved.provider = profile.ego.resolvedProvider || profile.ego.provider;
      resolved.model = profile.ego.resolvedModel || profile.ego.model;
      // Pass egoModel as object { provider, model } — tutor-core's resolveModel()
      // supports both string ("provider.model") and object formats, but aliases
      // containing dots (e.g., "kimi-k2.5") break the string format's split('.').
      resolved.egoModel = { provider: profile.ego.provider, model: profile.ego.model };
      if (profile.ego.hyperparameters && !resolved.hyperparameters) {
        resolved.hyperparameters = profile.ego.hyperparameters;
      }
    }
    if (profile?.superego) {
      resolved.superegoModel = { provider: profile.superego.provider, model: profile.superego.model };
      if (profile.superego.hyperparameters && !resolved.superegoHyperparameters) {
        resolved.superegoHyperparameters = profile.superego.hyperparameters;
      }
    } else {
      resolved.superegoModel = null;
    }

    // Extract factorial factor tags and learner architecture from profile
    const rawProfile = evalConfigLoader.loadTutorAgents()?.profiles?.[resolved.profileName];

    // Honor multi_agent_tutor factor: if false, force superego off even if
    // a superego section was accidentally configured.
    if (rawProfile?.factors?.multi_agent_tutor === false) {
      resolved.superegoModel = null;
      resolved.superegoHyperparameters = undefined;
    }

    // Explicit disable flag for tutor-core: when the eval cell has no superego,
    // tell tutor-core to skip superego review even if its own profile has one configured.
    // This prevents phantom superego calls when eval cells remap to tutor-core profiles
    // that have a superego (e.g., cell 90 → recognition profile).
    resolved.disableSuperego = !profile?.superego || rawProfile?.factors?.multi_agent_tutor === false;

    if (rawProfile?.factors) {
      resolved.factors = { ...rawProfile.factors };
      // Normalize prompt_type → recognition boolean for DB storage
      // Check both prompt_type and the top-level recognition_mode flag
      if (resolved.factors.recognition == null) {
        resolved.factors.recognition =
          resolved.factors.prompt_type === 'recognition' || rawProfile.recognition_mode === true;
      }
    }
    if (rawProfile?.learner_architecture) {
      resolved.learnerArchitecture = rawProfile.learner_architecture;
    }
    if (rawProfile?.conversation_mode) {
      resolved.conversationMode = rawProfile.conversation_mode;
    }
    if (rawProfile?.internal_history) {
      resolved.internalHistory = rawProfile.internal_history;
    }
    // Per-profile learner model override (YAML `learner.model`); CLI --learner-model takes priority
    if (rawProfile?.learner?.model && !config.learnerModelOverride) {
      resolved.learnerModelOverride = `${rawProfile.learner.provider || 'openrouter'}.${rawProfile.learner.model}`;
    }
  }

  // Apply CLI --max-tokens override (overrides ego max_tokens hyperparameter)
  if (config.maxTokensOverride) {
    if (!resolved.hyperparameters) resolved.hyperparameters = {};
    resolved.hyperparameters = { ...resolved.hyperparameters, max_tokens: config.maxTokensOverride };
  }

  // Apply CLI --model override (replaces ego and superego models, preserves factorial metadata)
  if (config.modelOverride) {
    try {
      const r = evalConfigLoader.resolveModel(config.modelOverride);
      resolved.provider = r.provider;
      resolved.model = r.model;
      resolved.egoModel = { provider: r.provider, model: r.model };
      if (resolved.superegoModel) {
        resolved.superegoModel = { provider: r.provider, model: r.model };
      }
    } catch (e) {
      throw new Error(`Invalid --model override "${config.modelOverride}": ${e.message}`);
    }
  }

  // Apply CLI --tutor-model override (replaces tutor ego + superego, overrides --model for tutor)
  if (config.tutorModelOverride) {
    try {
      const r = evalConfigLoader.resolveModel(config.tutorModelOverride);
      resolved.provider = r.provider;
      resolved.model = r.model;
      resolved.egoModel = { provider: r.provider, model: r.model };
      if (resolved.superegoModel) {
        resolved.superegoModel = { provider: r.provider, model: r.model };
      }
    } catch (e) {
      throw new Error(`Invalid --tutor-model override "${config.tutorModelOverride}": ${e.message}`);
    }
  }

  // Apply CLI --ego-model override (replaces only ego model)
  if (config.egoModelOverride) {
    try {
      const r = evalConfigLoader.resolveModel(config.egoModelOverride);
      resolved.egoModel = { provider: r.provider, model: r.model };
      // Also update top-level provider/model for compatibility
      resolved.provider = r.provider;
      resolved.model = r.model;
    } catch (e) {
      throw new Error(`Invalid --ego-model override "${config.egoModelOverride}": ${e.message}`);
    }
  }

  // Apply CLI --superego-model override (replaces only superego model)
  if (config.superegoModelOverride && resolved.superegoModel) {
    try {
      const r = evalConfigLoader.resolveModel(config.superegoModelOverride);
      resolved.superegoModel = { provider: r.provider, model: r.model };
    } catch (e) {
      throw new Error(`Invalid --superego-model override "${config.superegoModelOverride}": ${e.message}`);
    }
  }

  return resolved;
}

/**
 * Filter scenarios by cluster name(s).
 * Supported clusters: 'single-turn', 'multi-turn', or category names (core, mood, benchmark, recognition, multi_turn).
 * Comma-separated values are OR'd together.
 */
function applyScenarioFilter(scenarios, filter) {
  const clusters = filter.split(',').map((s) => s.trim().toLowerCase());
  return scenarios.filter((s) => {
    for (const c of clusters) {
      if (c === 'single-turn' && !s.isMultiTurn) return true;
      if (c === 'multi-turn' && s.isMultiTurn) return true;
      if (s.category === c) return true;
    }
    return false;
  });
}

// Rate limiting settings
const DEFAULT_PARALLELISM = 3;
const REQUEST_DELAY_MS = 200;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 2000; // Start with 2 seconds

// Debug logging helper - suppressed in quiet/transcript mode for clean output
let _liveQuiet = false;
function debugLog(...args) {
  if (!_liveQuiet && process.env.TUTOR_TRANSCRIPT !== 'true') {
    console.log(...args);
  }
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SUPPORTED_JUDGE_CLIS = new Set(['claude', 'gemini', 'codex']);

export function getCliJudgeModelLabel(judgeCli, modelOverride = null, effort = null) {
  const cli = String(judgeCli || '').toLowerCase();
  if (!SUPPORTED_JUDGE_CLIS.has(cli)) {
    throw new Error(`Unsupported judge CLI: ${judgeCli}`);
  }

  const effortSuffix = effort ? `@${effort}` : '';
  if (cli === 'gemini') return `gemini-cli/${modelOverride || 'auto'}${effortSuffix}`;
  if (cli === 'codex') return `codex-cli/${modelOverride || 'auto'}${effortSuffix}`;
  return `${modelOverride ? `claude-code/${modelOverride}` : 'claude-opus-4.6'}${effortSuffix}`;
}

function getDefaultCliJudgeModelOverride(judgeCli = 'claude') {
  const cli = String(judgeCli || '').toLowerCase();
  try {
    const rubric = evalConfigLoader.loadRubric();
    return cli === 'claude' ? rubric?.claude_code_judge?.model || null : null;
  } catch {
    return null;
  }
}

async function callCliJudge(prompt, judgeCli, modelOverride = null, effort = null) {
  const cli = String(judgeCli || '').toLowerCase();
  if (!SUPPORTED_JUDGE_CLIS.has(cli)) {
    throw new Error(`Unsupported judge CLI: ${judgeCli}`);
  }
  const stdout = await callModelCliText({
    provider: cli,
    model: modelOverride,
    prompt,
    role: 'evaluation-runner-judge',
    effort,
  });

  return parseCliJudgeJsonResponse(stdout);
}

function flattenNumericScores(scoreMap) {
  if (!scoreMap || typeof scoreMap !== 'object') return null;

  const flattened = {};
  for (const [key, value] of Object.entries(scoreMap)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      flattened[key] = value;
      continue;
    }

    if (typeof value === 'object' && value !== null) {
      const numericScore = typeof value.score === 'number' ? value.score : Number(value.score);
      if (Number.isFinite(numericScore)) {
        flattened[key] = numericScore;
      }
    }
  }

  return Object.keys(flattened).length > 0 ? flattened : null;
}

function extractCliJudgeScoreSource(parsed, dimensionMap) {
  if (!parsed || typeof parsed !== 'object') return null;

  const directKeys = new Set([
    ...Object.keys(dimensionMap),
    ...Object.keys(evalConfigLoader.getRubricDimensions?.() || {}),
  ]);

  const candidates = [];
  if (parsed.scores && typeof parsed.scores === 'object') candidates.push(parsed.scores);
  if (parsed.dimension_scores && typeof parsed.dimension_scores === 'object') candidates.push(parsed.dimension_scores);
  if (parsed.dimensions && typeof parsed.dimensions === 'object') candidates.push(parsed.dimensions);

  const directScores = {};
  for (const [key, value] of Object.entries(parsed)) {
    const looksLikeScoreObject =
      typeof value === 'object' &&
      value !== null &&
      ('score' in value || 'reasoning' in value || 'rationale' in value || 'explanation' in value);
    if (directKeys.has(key) && (looksLikeScoreObject || typeof value === 'number')) {
      directScores[key] = value;
    }
  }
  if (Object.keys(directScores).length > 0) candidates.push(directScores);

  return candidates.find((candidate) => candidate && Object.keys(candidate).length > 0) || null;
}

function parseCliJudgeJsonResponse(text) {
  const raw = String(text || '').trim();
  if (!raw) {
    throw new Error('Empty CLI judge response');
  }

  const sources = [];
  const fencedMatches = [...raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  for (const match of fencedMatches) {
    if (match[1]?.trim()) sources.push(match[1].trim());
  }
  sources.push(raw);

  const candidates = [];
  const seen = new Set();

  const pushCandidate = (value) => {
    const candidate = String(value || '').trim();
    if (!candidate || seen.has(candidate)) return;
    seen.add(candidate);
    candidates.push(candidate);
  };

  const extractBalancedObjects = (value) => {
    const found = [];
    let depth = 0;
    let start = -1;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < value.length; i++) {
      const ch = value[i];

      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\' && inString) {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (ch === '{') {
        if (depth === 0) start = i;
        depth += 1;
      } else if (ch === '}') {
        if (depth === 0) continue;
        depth -= 1;
        if (depth === 0 && start !== -1) {
          found.push(value.slice(start, i + 1));
          start = -1;
        }
      }
    }

    return found;
  };

  for (const source of sources) {
    pushCandidate(source);
    for (const objectCandidate of extractBalancedObjects(source)) {
      pushCandidate(objectCandidate);
    }
  }

  const errors = [];
  for (const candidate of [...candidates].reverse()) {
    try {
      return coerceCliJudgeJsonPayload(JSON.parse(candidate));
    } catch (error) {
      errors.push(`JSON.parse: ${error.message}`);
    }

    try {
      return coerceCliJudgeJsonPayload(JSON.parse(jsonrepair(candidate)));
    } catch (error) {
      errors.push(`jsonrepair: ${error.message}`);
    }
  }

  const preview = raw.slice(0, 300).replace(/\s+/g, ' ');
  throw new Error(
    `Could not parse CLI judge response as JSON. Tried ${candidates.length} candidate(s). ${errors[errors.length - 1] || ''} Raw preview: ${preview}`,
  );
}

function coerceCliJudgeJsonPayload(parsed) {
  if (!Array.isArray(parsed)) return parsed;

  const scoredObject = parsed.find(
    (item) =>
      item &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      (item.scores || item.turns || item.overall_score != null || item.overallScore != null),
  );
  if (scoredObject) return scoredObject;

  const joinedText = parsed
    .filter((item) => typeof item === 'string')
    .join('\n')
    .trim();
  if (joinedText) {
    return parseCliJudgeJsonResponse(joinedText);
  }

  return parsed;
}

function extractCliJudgeOverallScore(parsed) {
  const candidates = [parsed?.overall_score, parsed?.overallScore, parsed?.total_score, parsed?.totalScore];

  for (const candidate of candidates) {
    const numeric = typeof candidate === 'number' ? candidate : Number(candidate);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }

  return null;
}

function extractCliJudgeValidation(parsed) {
  const validation = parsed?.validation && typeof parsed.validation === 'object' ? parsed.validation : parsed || {};

  return {
    passesRequired: validation?.passes_required ?? validation?.passesRequired ?? true,
    passesForbidden: validation?.passes_forbidden ?? validation?.passesForbidden ?? true,
    requiredMissing: validation?.required_missing ?? validation?.requiredMissing ?? [],
    forbiddenFound: validation?.forbidden_found ?? validation?.forbiddenFound ?? [],
  };
}

function normalizeCliJudgeEvaluation(parsed, judgeModelLabel, judgeLatencyMs) {
  const dimensionMap = {
    relevance: 'relevance',
    specificity: 'specificity',
    pedagogical_soundness: 'pedagogical',
    pedagogical: 'pedagogical',
    personalization: 'personalization',
    actionability: 'actionability',
    tone: 'tone',
  };

  const rawScores = extractCliJudgeScoreSource(parsed, dimensionMap) || {};
  const normalizedScores = {};
  for (const [key, value] of Object.entries(rawScores)) {
    const normalizedKey = dimensionMap[key] || key;
    if (typeof value === 'object' && value !== null) {
      const numericScore = typeof value.score === 'number' ? value.score : Number(value.score);
      if (value.not_applicable === true) {
        normalizedScores[normalizedKey] = {
          score: null,
          not_applicable: true,
          reasoning: value.reasoning ?? value.rationale ?? value.explanation ?? null,
        };
        continue;
      }
      if (!Number.isFinite(numericScore)) continue;
      normalizedScores[normalizedKey] = {
        score: numericScore,
        not_applicable: false,
        reasoning: value.reasoning ?? value.rationale ?? value.explanation ?? null,
      };
    } else if (typeof value === 'number') {
      normalizedScores[normalizedKey] = { score: value, reasoning: null };
    }
  }

  const extractedOverallScore = extractCliJudgeOverallScore(parsed);
  if (Object.keys(normalizedScores).length === 0 && extractedOverallScore == null) {
    const preview = JSON.stringify(parsed)?.slice(0, 400) || 'null';
    return {
      success: false,
      error: `CLI judge returned JSON without usable scores or overall_score. Parsed preview: ${preview}`,
      judgeModel: judgeModelLabel,
      judgeLatencyMs,
    };
  }

  const tutorFirstTurnScore =
    Object.keys(normalizedScores).length > 0
      ? rubricEvaluator.calculateOverallScore(normalizedScores)
      : extractedOverallScore;

  const validation = extractCliJudgeValidation(parsed);

  return {
    success: true,
    scores: normalizedScores,
    tutorFirstTurnScore,
    overallScore: tutorFirstTurnScore,
    baseScore: Object.keys(normalizedScores).length > 0 ? rubricEvaluator.calculateBaseScore(normalizedScores) : null,
    recognitionScore:
      Object.keys(normalizedScores).length > 0 ? rubricEvaluator.calculateRecognitionScore(normalizedScores) : null,
    passesRequired: validation.passesRequired,
    passesForbidden: validation.passesForbidden,
    requiredMissing: validation.requiredMissing,
    forbiddenFound: validation.forbiddenFound,
    summary: parsed?.summary ?? parsed?.assessment ?? parsed?.overview ?? null,
    judgeModel: judgeModelLabel,
    judgeLatencyMs,
  };
}

async function evaluateSuggestionWithSelectedJudge(suggestion, scenarioContext, context = {}, options = {}) {
  const { dialogueContext = null } = context;
  const { judgeOverride = null, judgeCli = null, judgeCliModel = null } = options;

  if (judgeCli) {
    const startTime = Date.now();
    const parsed = await callCliJudge(
      rubricEvaluator.buildEvaluationPrompt(suggestion, scenarioContext, { dialogueContext }),
      judgeCli,
      judgeCliModel,
    );
    return normalizeCliJudgeEvaluation(parsed, getCliJudgeModelLabel(judgeCli, judgeCliModel), Date.now() - startTime);
  }

  return rubricEvaluator.evaluateSuggestion(suggestion, scenarioContext, { dialogueContext }, { judgeOverride });
}

/**
 * Format a progress tag with percentage and elapsed time.
 * @param {number} completed - Completed tests
 * @param {number} total - Total tests
 * @param {number} startTime - Start timestamp (Date.now())
 * @returns {string} e.g. "[3/10] (30%) 1m 23s"
 */
function formatProgress(completed, total, startTime) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const elapsedMs = Date.now() - startTime;
  const elapsedSec = Math.round(elapsedMs / 1000);
  const min = Math.floor(elapsedSec / 60);
  const sec = elapsedSec % 60;
  const elapsed = min > 0 ? `${min}m ${sec}s` : `${sec}s`;
  return `[${completed}/${total}] (${pct}%) ${elapsed}`;
}

/**
 * Retry wrapper for API calls with exponential backoff
 * Handles 429 rate limit errors from OpenRouter free tier
 */
async function retryWithBackoff(fn, context = {}, maxRetries = MAX_RETRIES) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if it's a rate limit error (429)
      const is429 =
        error?.message?.includes('429') ||
        error?.message?.includes('rate limit') ||
        error?.message?.includes('Rate limit');

      // Don't retry on last attempt or non-429 errors
      if (attempt === maxRetries || !is429) {
        throw error;
      }

      // Calculate exponential backoff delay: 2s, 4s, 8s
      const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);

      debugLog(`[Retry ${attempt + 1}/${maxRetries}] Rate limit hit, waiting ${delayMs}ms before retry...`);
      if (context.log) {
        context.log(
          `Rate limit exceeded, retrying in ${delayMs / 1000}s (attempt ${attempt + 1}/${maxRetries})`,
          'warning',
        );
      }

      await sleep(delayMs);
    }
  }

  // Should never reach here, but throw last error just in case
  throw lastError;
}

/**
 * Run a complete evaluation across configurations and scenarios
 *
 * @param {Object} options - Evaluation options
 * @returns {Promise<Object>} Evaluation run results
 */
export async function runEvaluation(options = {}) {
  const {
    scenarios = 'all', // Which scenarios to run ('all' or array of IDs)
    configurations = 'all', // Which configs to test ('all', 'profiles', or array)
    runsPerConfig = 1, // Repetitions for statistical significance
    parallelism = DEFAULT_PARALLELISM,
    skipRubricEval = false, // Skip AI-based rubric evaluation (faster)
    judgeOverride = null, // CLI --judge override for rubric evaluation
    judgeCli = null, // CLI judge backend for rubric evaluation
    judgeCliModel = null, // Optional CLI judge model override
    description = null,
    verbose = false,
    scenarioFilter = null, // Cluster filter: 'single-turn', 'multi-turn', or category names
    modelOverride = null, // CLI --model override (e.g. "openrouter.nemotron") — ALL agents (tutor + learner)
    tutorModelOverride = null, // CLI --tutor-model override — tutor ego + superego only
    egoModelOverride = null, // CLI --ego-model override (replaces only tutor ego model)
    superegoModelOverride = null, // CLI --superego-model override (replaces only tutor superego model)
    learnerModelOverride = null, // CLI --learner-model override (replaces all learner agent models)
    learnerEgoModelOverride = null, // CLI --learner-ego-model override (replaces only learner ego model)
    learnerSuperegoModelOverride = null, // CLI --learner-superego-model override (replaces only learner superego model)
    dryRun = false, // Use mock data instead of API calls
    transcriptMode = false, // Write play-format transcript files during multi-turn runs
    maxTokensOverride = null, // CLI --max-tokens override (replaces ego max_tokens hyperparameter)
    showMessages = false, // true for truncated, 'full' for untruncated API message display
    liveApi = false, // --live: stream one-line display per API call in real time
    learnerId: explicitLearnerId = null, // A7 Longitudinal: shared Writing Pad across runs
    threadNegotiationResolution: explicitThreadNegotiationResolution = false, // A5 CLI --thread-negotiation-resolution: carry negotiated resolution into the delivered suggestion across revision rounds (OR'd with the profile-level thread_negotiation_resolution flag in runMultiTurnTest)
    externalEgoExtension = null, // opt-in ego prompt extension (e.g. cross-session memory narrative); multi-turn only, folded into fullEgoExtension in runMultiTurnTest
    admissionPlan = null, // HTTP metered-work admission snapshot; absent on CLI/direct callers
  } = options;

  const log = verbose ? console.log : () => {};

  if (judgeOverride && judgeCli) {
    throw new Error('Use either judgeOverride or judgeCli, not both');
  }
  if (judgeCli && !SUPPORTED_JUDGE_CLIS.has(String(judgeCli).toLowerCase())) {
    throw new Error(`Unsupported judge CLI: ${judgeCli}`);
  }
  const effectiveCliJudge = judgeCli ? String(judgeCli).toLowerCase() : null;
  const effectiveCliJudgeModel = effectiveCliJudge
    ? judgeCliModel || getDefaultCliJudgeModelOverride(effectiveCliJudge)
    : null;

  // Always suppress tutor-core verbose dialogue output during eval runs
  // (TUTOR DIALOGUE boxes, learner context, model overrides, etc.)
  setQuietMode(true);

  // Install live API reporter if --live is active
  let liveApiReporter = null;
  if (liveApi) {
    liveApiReporter = new LiveApiReporter();
    liveApiReporter.install();
    _liveQuiet = true;
  }

  // Log domain override env vars (always visible, not gated on verbose)
  if (process.env.EVAL_CONTENT_PATH || process.env.EVAL_SCENARIOS_FILE) {
    console.log('[evaluationRunner] Domain overrides detected:');
    if (process.env.EVAL_CONTENT_PATH) console.log(`  EVAL_CONTENT_PATH = ${process.env.EVAL_CONTENT_PATH}`);
    if (process.env.EVAL_SCENARIOS_FILE) console.log(`  EVAL_SCENARIOS_FILE = ${process.env.EVAL_SCENARIOS_FILE}`);
  }

  // Initialize content resolver from eval settings (opt-in)
  const contentConfig = evalConfigLoader.getContentConfig();
  if (contentConfig?.content_package_path) {
    contentResolver.configure({
      contentPackagePath: contentConfig.content_package_path,
      maxLectureChars: contentConfig.max_lecture_chars,
      includeSpeakerNotes: contentConfig.include_speaker_notes,
    });
    if (contentResolver.isConfigured()) {
      console.log(`[evaluationRunner] Content: ${contentConfig.content_package_path}`);
    } else {
      console.warn('[evaluationRunner] Content path set but directory not found — using fallback curriculum');
    }
  }

  // Resolve scenarios (loaded from eval repo's local rubric)
  const allScenarios = evalConfigLoader.listScenarios();
  let targetScenarios = scenarios === 'all' ? allScenarios : allScenarios.filter((s) => scenarios.includes(s.id));

  // Apply cluster filter if specified
  if (scenarioFilter) {
    targetScenarios = applyScenarioFilter(targetScenarios, scenarioFilter);
  }

  if (targetScenarios.length === 0) {
    throw new Error('No scenarios to run');
  }

  // Resolve configurations
  let targetConfigs = [];
  if (configurations === 'all') {
    targetConfigs = evalConfigLoader.listConfigurations();
  } else if (configurations === 'factorial') {
    const FACTORIAL_CELLS = [
      'cell_1_base_single_unified',
      'cell_2_base_single_psycho',
      'cell_3_base_multi_unified',
      'cell_4_base_multi_psycho',
      'cell_5_recog_single_unified',
      'cell_6_recog_single_psycho',
      'cell_7_recog_multi_unified',
      'cell_8_recog_multi_psycho',
    ];
    targetConfigs = FACTORIAL_CELLS.map((name) => ({
      provider: null,
      model: null,
      profileName: name,
      label: name,
    }));
  } else if (configurations === 'profiles') {
    const profiles = evalConfigLoader.listTutorProfiles();
    targetConfigs = profiles.map((p) => ({
      provider: null,
      model: null,
      profileName: p.name,
      label: p.name,
    }));
  } else if (Array.isArray(configurations)) {
    // Normalize string entries ("cell_40_...") into config objects. Passing a
    // bare string previously spread into per-character garbage downstream —
    // config.profileName came out undefined and the run silently used the
    // DEFAULT tutor-core profile instead of the named cell (with none of the
    // cell's feature flags: dialectical negotiation, prompt rewriting, ...).
    targetConfigs = configurations.map((c) =>
      typeof c === 'string' ? { provider: null, model: null, profileName: c, label: c } : c,
    );
  }

  // Apply model overrides: CLI flags take precedence over YAML-level config
  const yamlOverrides = evalConfigLoader.getTutorModelOverrides();

  // Effective overrides: CLI > YAML > none
  const effectiveModelOverride = modelOverride || yamlOverrides.modelOverride;
  const effectiveTutorModelOverride = tutorModelOverride || null;
  const effectiveEgoModelOverride = egoModelOverride || yamlOverrides.egoModelOverride;
  const effectiveSuperegoModelOverride = superegoModelOverride || yamlOverrides.superegoModelOverride;
  const effectiveLearnerModelOverride = learnerModelOverride || null;
  const effectiveLearnerEgoModelOverride = learnerEgoModelOverride || null;
  const effectiveLearnerSuperegoModelOverride = learnerSuperegoModelOverride || null;

  if (effectiveModelOverride) {
    targetConfigs = targetConfigs.map((c) => ({ ...c, modelOverride: effectiveModelOverride }));
  }
  if (effectiveTutorModelOverride) {
    targetConfigs = targetConfigs.map((c) => ({ ...c, tutorModelOverride: effectiveTutorModelOverride }));
  }
  if (effectiveEgoModelOverride) {
    targetConfigs = targetConfigs.map((c) => ({ ...c, egoModelOverride: effectiveEgoModelOverride }));
  }
  if (effectiveSuperegoModelOverride) {
    targetConfigs = targetConfigs.map((c) => ({ ...c, superegoModelOverride: effectiveSuperegoModelOverride }));
  }
  if (effectiveLearnerModelOverride) {
    targetConfigs = targetConfigs.map((c) => ({ ...c, learnerModelOverride: effectiveLearnerModelOverride }));
  }
  if (effectiveLearnerEgoModelOverride) {
    targetConfigs = targetConfigs.map((c) => ({ ...c, learnerEgoModelOverride: effectiveLearnerEgoModelOverride }));
  }
  if (effectiveLearnerSuperegoModelOverride) {
    targetConfigs = targetConfigs.map((c) => ({
      ...c,
      learnerSuperegoModelOverride: effectiveLearnerSuperegoModelOverride,
    }));
  }
  if (maxTokensOverride) {
    targetConfigs = targetConfigs.map((c) => ({ ...c, maxTokensOverride }));
  }

  if (targetConfigs.length === 0) {
    throw new Error('No configurations to test');
  }

  // Model-stack default check (CLAUDE.md "Model stack default"): warn — never
  // block — when a run would put cells on the weak nemotron/kimi pairing with
  // no explicit model override.
  warnIfWeakStackDefault(targetConfigs);

  log(`\nStarting evaluation:`);
  log(`  Scenarios: ${targetScenarios.length}`);
  log(`  Configurations: ${targetConfigs.length}`);
  log(`  Runs per config: ${runsPerConfig}`);
  log(`  Total tests: ${targetScenarios.length * targetConfigs.length * runsPerConfig}`);

  // Create evaluation run record with reproducibility metadata
  const run = evaluationStore.createRun({
    description: description || `Evaluation: ${targetConfigs.length} configs x ${targetScenarios.length} scenarios`,
    totalScenarios: targetScenarios.length,
    totalConfigurations: targetConfigs.length,
    metadata: {
      runsPerConfig,
      skipRubricEval,
      judgeOverride: judgeOverride || null,
      judgeCli: effectiveCliJudge || null,
      judgeCliModel: effectiveCliJudgeModel || null,
      modelOverride: effectiveModelOverride || null,
      tutorModelOverride: effectiveTutorModelOverride || null,
      egoModelOverride: effectiveEgoModelOverride || null,
      superegoModelOverride: effectiveSuperegoModelOverride || null,
      learnerModelOverride: effectiveLearnerModelOverride || null,
      learnerEgoModelOverride: effectiveLearnerEgoModelOverride || null,
      learnerSuperegoModelOverride: effectiveLearnerSuperegoModelOverride || null,
      // A5: run-wide threading arm, re-applied on resume (see resumeEvaluation)
      // so a test resumed before its first checkpoint still gets the right arm.
      threadNegotiationResolution: explicitThreadNegotiationResolution || null,
      maxTokensOverride: maxTokensOverride || null,
      dryRun: dryRun || false,
      // Store scenario IDs and profile names for accurate resume
      scenarioIds: targetScenarios.map((s) => s.id),
      profileNames: targetConfigs.map((c) => c.profileName).filter(Boolean),
      // Store env overrides so evaluate/rejudge can re-apply them
      scenariosFile: process.env.EVAL_SCENARIOS_FILE || null,
      contentPath: process.env.EVAL_CONTENT_PATH || null,
      packageVersion: pkg.version,
      gitCommit: getGitCommitHash(),
      // Instrument stamp: claude-CLI subprocess calls run context-isolated
      // (--safe-mode etc. — see CLAUDE_CLI_ISOLATION_ARGS in
      // cliProviderBridge.js). Runs whose metadata lacks this field predate
      // the isolation and saw ~16k tokens of ambient repo context (CLAUDE.md,
      // skills, hooks, MCP) in every claude-code call, judges included.
      claudeCliContextIsolation: CLAUDE_CLI_CONTEXT_ISOLATION,
      ...(admissionPlan ? { admissionPlan: JSON.parse(JSON.stringify(admissionPlan)) } : {}),
      pid: process.pid,
    },
  });

  const totalTests = targetScenarios.length * targetConfigs.length * runsPerConfig;

  // Store total_tests upfront so progress can be tracked for in-progress runs
  evaluationStore.updateRun(run.id, { status: 'running', totalTests });

  const profileNames = targetConfigs.map((c) => c.label || c.profileName || `${c.provider}/${c.model}`);
  const scenarioNames = targetScenarios.map((s) => s.name || s.id);

  // Print run ID + progress log path immediately so users can `watch`
  const progressLogPath = getProgressLogPath(run.id);
  console.log(`\nRun ID: ${run.id} (use 'watch ${run.id}' to monitor)`);
  console.log(`Progress log: ${progressLogPath}\n`);

  // Instantiate progress logger and streaming reporter
  const progressLogger = new ProgressLogger(run.id);
  const reporter = new StreamingReporter({
    totalTests,
    totalScenarios: targetScenarios.length,
    profiles: profileNames,
    scenarios: scenarioNames,
  });

  progressLogger.runStart({
    totalTests,
    totalScenarios: targetScenarios.length,
    totalConfigurations: targetConfigs.length,
    scenarios: scenarioNames,
    profiles: profileNames,
    description: description || run.description,
  });

  // Register with monitoring service for realtime tracking
  monitoringService.startSession(run.id, {
    userId: 'eval-runner',
    profileName: `${targetConfigs.length} configs`,
    modelId: 'evaluation-batch',
  });

  const results = [];
  let completedTests = 0;

  // Build flat list of all tests — SCENARIO-FIRST ordering
  // All profiles for scenario 1 complete before scenario 2 starts.
  const allTests = [];
  for (const scenario of targetScenarios) {
    for (const config of targetConfigs) {
      for (let runNum = 0; runNum < runsPerConfig; runNum++) {
        allTests.push({ config, scenario, runNum });
      }
    }
  }

  // Scenario completion tracking
  const scenarioProgress = new Map();
  for (const scenario of targetScenarios) {
    scenarioProgress.set(scenario.id, {
      total: targetConfigs.length * runsPerConfig,
      completed: 0,
      scores: [],
      scenarioName: scenario.name || scenario.id,
    });
  }
  let completedScenarios = 0;

  // Parallel worker pool
  async function processQueue(queue, workerCount, processItem) {
    const items = [...queue];
    let index = 0;

    async function worker() {
      while (index < items.length) {
        const i = index++;
        await processItem(items[i]);
        await sleep(REQUEST_DELAY_MS);
      }
    }

    const workers = Array.from({ length: Math.min(workerCount, items.length) }, () => worker());
    await Promise.all(workers);
  }

  log(`\nRunning ${allTests.length} tests with parallelism=${parallelism}...\n`);

  const runStartTime = Date.now();

  await processQueue(allTests, parallelism, async ({ config, scenario, runNum }) => {
    const profileLabel = config.label || config.profileName || '';

    // Wrap in live API conversation context if --live is active
    const runTest = async () => {
      // Emit test_start
      progressLogger.testStart({
        scenarioId: scenario.id,
        scenarioName: scenario.name || scenario.id,
        profileName: profileLabel,
      });

      try {
        const result = {
          ...(await runSingleTest(scenario, config, {
            skipRubricEval,
            verbose,
            judgeOverride,
            judgeCli: effectiveCliJudge,
            judgeCliModel: effectiveCliJudgeModel,
            dryRun,
            transcriptMode,
            showMessages,
            runId: run.id,
            runNum,
            liveApiReporter,
            learnerId: explicitLearnerId,
            threadNegotiationResolution: explicitThreadNegotiationResolution,
            externalEgoExtension,
          })),
          attemptIndex: runNum,
        };

        // Store result (better-sqlite3 is synchronous, thread-safe for concurrent writes)
        evaluationStore.storeResult(run.id, result);
        results.push(result);

        completedTests++;

        // Emit test_complete event
        progressLogger.testComplete({
          scenarioId: scenario.id,
          scenarioName: scenario.name || scenario.id,
          profileName: profileLabel,
          success: result.success,
          overallScore: result.tutorFirstTurnScore,
          baseScore: result.baseScore ?? null,
          recognitionScore: result.recognitionScore ?? null,
          latencyMs: result.latencyMs,
          completedCount: completedTests,
          totalTests,
        });

        // Streaming reporter line
        reporter.onTestComplete({
          ...result,
          profileName: profileLabel,
          scenarioName: scenario.name || scenario.id,
        });

        log(
          `  ${formatProgress(completedTests, totalTests, runStartTime)} ${profileLabel} / ${scenario.id}: ${result.success ? `score=${result.tutorFirstTurnScore?.toFixed(1)}` : 'FAILED'}`,
        );

        // Update monitoring session with progress
        monitoringService.recordEvent(run.id, {
          type: 'evaluation_test',
          inputTokens: result.inputTokens || 0,
          outputTokens: result.outputTokens || 0,
          latencyMs: result.latencyMs || 0,
          round: completedTests,
          approved: result.success,
        });

        // Track scenario completion
        const sp = scenarioProgress.get(scenario.id);
        sp.completed++;
        if (result.tutorFirstTurnScore != null) sp.scores.push(result.tutorFirstTurnScore);
        if (sp.completed >= sp.total) {
          completedScenarios++;
          const avgScore = sp.scores.length > 0 ? sp.scores.reduce((a, b) => a + b, 0) / sp.scores.length : null;
          progressLogger.scenarioComplete({
            scenarioId: scenario.id,
            scenarioName: sp.scenarioName,
            profileNames,
            avgScore,
            completedScenarios,
            totalScenarios: targetScenarios.length,
          });
          reporter.onScenarioComplete({
            scenarioName: sp.scenarioName,
            avgScore,
            completedScenarios,
            totalScenarios: targetScenarios.length,
          });
        }
      } catch (error) {
        completedTests++;
        log(
          `  ${formatProgress(completedTests, totalTests, runStartTime)} ${profileLabel} / ${scenario.id}: ERROR - ${error.message}`,
        );

        // Only store failed results for permanent errors (bad config, invalid scenario).
        // Skip storing for retriable/transient errors (rate limits, model unavailable, timeouts)
        // so that `resume` can retry them without needing manual cleanup.
        const errMsg = error.message || '';
        const isTransient = isTransientEvaluationError(errMsg);

        if (!isTransient) {
          const failedResult = {
            scenarioId: scenario.id,
            scenarioName: scenario.name || scenario.id,
            profileName: config.profileName,
            provider: config.provider || config.ego?.provider || 'unknown',
            model: config.model || config.ego?.model || 'unknown',
            egoModel: config.egoModel
              ? `${config.egoModel.provider}.${config.egoModel.model}`
              : config.ego
                ? `${config.ego.provider}.${config.ego.model}`
                : null,
            superegoModel: config.superegoModel
              ? `${config.superegoModel.provider}.${config.superegoModel.model}`
              : config.superego
                ? `${config.superego.provider}.${config.superego.model}`
                : null,
            factors: config.factors || null,
            learnerArchitecture: config.learnerArchitecture || null,
            attemptIndex: runNum,
            success: false,
            errorMessage: error.message,
          };
          try {
            evaluationStore.storeResult(run.id, failedResult);
            results.push(failedResult);
          } catch (storeErr) {
            log(`  [WARNING] Failed to store error result: ${storeErr.message}`);
          }
        } else {
          log(`  [SKIPPED] Transient error, not storing empty row (resumable): ${errMsg.substring(0, 100)}`);
        }

        // Emit test_error event
        progressLogger.testError({
          scenarioId: scenario.id,
          scenarioName: scenario.name || scenario.id,
          profileName: profileLabel,
          errorMessage: error.message,
          completedCount: completedTests,
          totalTests,
        });

        reporter.onTestError({
          scenarioName: scenario.name || scenario.id,
          profileName: profileLabel,
          errorMessage: error.message,
        });

        // Record error in monitoring
        monitoringService.recordEvent(run.id, {
          type: 'evaluation_error',
          round: completedTests,
          error: error.message,
        });

        // Track scenario completion even on error
        const sp = scenarioProgress.get(scenario.id);
        sp.completed++;
        if (sp.completed >= sp.total) {
          completedScenarios++;
          const avgScore = sp.scores.length > 0 ? sp.scores.reduce((a, b) => a + b, 0) / sp.scores.length : null;
          progressLogger.scenarioComplete({
            scenarioId: scenario.id,
            scenarioName: sp.scenarioName,
            profileNames,
            avgScore,
            completedScenarios,
            totalScenarios: targetScenarios.length,
          });
          reporter.onScenarioComplete({
            scenarioName: sp.scenarioName,
            avgScore,
            completedScenarios,
            totalScenarios: targetScenarios.length,
          });
        }
      }
    }; // end runTest

    if (liveApiReporter) {
      await liveApiReporter.withConversation({ profileName: profileLabel, scenarioId: scenario.id }, runTest);
    } else {
      await runTest();
    }
  });

  // Restore tutor-core output and uninstall live API reporter
  setQuietMode(false);
  if (liveApiReporter) {
    liveApiReporter.uninstall();
    _liveQuiet = false;
  }

  const durationMs = Date.now() - runStartTime;
  const successfulTests = results.filter((r) => r.success).length;
  const failedTests = completedTests - successfulTests;

  // Emit run_complete
  progressLogger.runComplete({ totalTests: completedTests, successfulTests, failedTests, durationMs });
  reporter.onRunComplete({ totalTests: completedTests, successfulTests, failedTests, durationMs });

  // Update run status (keep original totalTests to show expected vs actual)
  evaluationStore.updateRun(run.id, {
    status: 'completed',
    completedAt: new Date().toISOString(),
  });

  // End monitoring session
  monitoringService.endSession(run.id);

  // Get aggregated stats
  const stats = evaluationStore.getRunStats(run.id);
  const scenarioStats = evaluationStore.getScenarioStats(run.id);

  return {
    runId: run.id,
    totalTests,
    successfulTests,
    failedTests,
    stats,
    scenarioStats,
    progressLogPath,
  };
}

/**
 * D3 Bridge 1 — Phase 1 reflection (two-pass reflection-as-input).
 *
 * Cells with `two_pass_reflection: true` get a Phase-1 ego call that
 * produces a brief plain-text noticing about the learner's current state
 * (using prompts/tutor-ego-reflectonly.md). The result is prepended to
 * the next call's contextStr as a "Tutor's Prior Reflection On This Turn"
 * block — i.e., the reflection is fed back as *content the model reads*,
 * not as a system-prompt directive.
 *
 * Empirical hypothesis (D3-architectural design note):
 * LLMs follow concrete recent-context tokens better than abstract
 * meta-instructions. If true, the Phase-2 ego will couple its message
 * to the reflection more reliably than under cell 97's directive rider.
 *
 * Returns the plain-text reflection on success, null on failure (caller
 * proceeds without the augmentation — degrades gracefully to cell-40
 * behaviour).
 */
const REFLECTONLY_PROMPT_PATH = path.join(EVAL_ROOT, 'prompts', 'tutor-ego-reflectonly.md');
let _reflectonlyPromptCache = null;
function loadReflectonlyPrompt() {
  if (_reflectonlyPromptCache) return _reflectonlyPromptCache;
  try {
    _reflectonlyPromptCache = fs.readFileSync(REFLECTONLY_PROMPT_PATH, 'utf8');
  } catch (e) {
    console.error('[evaluationRunner] reflectonly prompt missing:', e.message);
    _reflectonlyPromptCache = '';
  }
  return _reflectonlyPromptCache;
}

// D3 Bridge 3 — coupling cosine for best-of-N selection.
// Mirrors scripts/analyze-insight-action-gap.js's tokenize+cosine so the
// selection criterion is *identical* to the verdict criterion. This makes
// Bridge 3 the strongest possible test of the orchestration hypothesis:
// "the model already produces coupled outputs sometimes; we just need to
// keep them." If best-of-N selection by the very metric we use to score
// the verdict still nulls, the hypothesis is dead.
function _bridge3Tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}
function _bridge3CouplingCosine(reasoning, message) {
  const ta = _bridge3Tokenize(reasoning);
  const tb = _bridge3Tokenize(message);
  if (ta.length === 0 || tb.length === 0) return 0;
  const fa = Object.create(null);
  const fb = Object.create(null);
  for (const t of ta) fa[t] = (fa[t] || 0) + 1;
  for (const t of tb) fb[t] = (fb[t] || 0) + 1;
  let dot = 0,
    mA = 0,
    mB = 0;
  const keys = new Set([...Object.keys(fa), ...Object.keys(fb)]);
  for (const k of keys) {
    const va = fa[k] || 0;
    const vb = fb[k] || 0;
    dot += va * vb;
    mA += va * va;
    mB += vb * vb;
  }
  return dot / (Math.sqrt(mA) * Math.sqrt(mB) || 1);
}

async function generatePhase1Reflection({ contextStr, learnerMessage, modelAlias, log }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    log('[two-pass] OPENROUTER_API_KEY missing; skipping Phase-1 reflection', 'warn');
    return null;
  }
  const systemPrompt = loadReflectonlyPrompt();
  if (!systemPrompt) {
    log('[two-pass] reflectonly prompt not loadable; skipping Phase-1', 'warn');
    return null;
  }

  // Resolve provider/model via the same alias path everything else uses.
  let modelId;
  try {
    const resolved = evalConfigLoader.resolveModel(modelAlias);
    modelId = resolved.model;
  } catch (e) {
    log(`[two-pass] could not resolve ${modelAlias}: ${e.message}`, 'warn');
    return null;
  }

  const userMessage =
    `### Learner Context\n\n${contextStr || '(no context)'}\n\n` +
    (learnerMessage ? `### Learner Just Said\n\n"${learnerMessage}"\n\n` : '') +
    `Produce your noticing now (2–4 sentences, plain prose, first-person).`;

  try {
    const start = Date.now();
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://machinespirits-eval.local',
        'X-Title': 'Machine Spirits Eval (D3 Bridge 1 Phase 1)',
      },
      body: JSON.stringify({
        model: modelId,
        temperature: 0.5,
        max_tokens: 400,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });
    const latencyMs = Date.now() - start;
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      log(`[two-pass] Phase-1 ${response.status}: ${body.slice(0, 200)}`, 'warn');
      return null;
    }
    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content?.trim() || '';
    if (!content) {
      log('[two-pass] Phase-1 empty content; skipping', 'warn');
      return null;
    }
    log(`[two-pass] Phase-1 reflection generated (${content.length} chars, ${latencyMs}ms)`, 'info');
    return content;
  } catch (e) {
    log(`[two-pass] Phase-1 fetch failed: ${e.message}`, 'warn');
    return null;
  }
}

/**
 * Run a multi-turn test as an iterative loop.
 *
 * Each turn goes through the SAME generateAndEvaluateTurn() code path as
 * single-turn, with accumulated conversation context between turns.
 * This eliminates the separate multiTurnRunner orchestration.
 */
function buildIdConstructionTraceFromTurnResults(turnResults = []) {
  const idTurns = [];

  for (const turn of turnResults) {
    if (!turn?.idConstruction && !turn?.agencyReturnVerification && !turn?.engagementState) continue;

    const record = {
      turn: Number.isInteger(turn.turnIndex) ? turn.turnIndex : idTurns.length,
      construction: turn.idConstruction || null,
      tutorText: turn.suggestion?.message || turn.suggestion?.text || null,
    };

    if (turn.agencyReturnVerification) {
      record.agencyReturnVerification = turn.agencyReturnVerification;
      record.agencyReturnRepaired = turn.agencyReturnRepaired === true;
    }
    if (turn.engagementState) {
      record.engagementState = turn.engagementState;
    }

    idTurns.push(record);
  }

  return idTurns.length > 0 ? idTurns : null;
}

/**
 * Resume an incomplete evaluation run, re-running only the missing tests.
 *
 * @param {Object} options
 * @param {string} options.runId - The run ID to resume
 * @param {number} [options.parallelism] - Parallel worker count
 * @param {boolean} [options.verbose] - Enable verbose output
 * @returns {Promise<Object>} Evaluation results (same shape as runEvaluation)
 */
const { advanceBetweenTurnAdaptation } = createEvaluationBetweenTurnAdaptationRuntime({ promptRewriter });

const { prepareMultiTurnEvaluation } = createEvaluationMultiTurnSetupRuntime({
  chalk,
  collectPromptVersions,
  computeConfigHash,
  contentResolver,
  createEvaluationMultiTurnTranscriptRuntime,
  dialogueEngine,
  evalConfigLoader,
  fs,
  loadFormalInterior,
  path,
  resolveConfigModels,
  resolveEvalProfile,
  transcriptsDir: TRANSCRIPTS_DIR,
});

const { completeMultiTurnEvaluation } = createEvaluationMultiTurnCompletionRuntime({
  TRACE_SCHEMA_VERSION,
  buildIdConstructionTraceFromTurnResults,
  chalk,
  createHash,
  deleteCheckpoint,
  dialogueTraceAnalyzer,
  evalConfigLoader,
  evaluationStore,
  evaluateSuggestionWithSelectedJudge,
  formatTranscript,
  fs,
  logsDir: LOGS_DIR,
  path,
  rubricEvaluator,
  turnComparisonAnalyzer,
});

const turnExecutionDependencies = {
  attachApiPayloadsToTrace,
  buildIdConstructionTraceFromTurnResults,
  captureApiCalls,
  collectPromptVersions,
  computeConfigHash,
  contentResolver,
  debugLog,
  evalConfigLoader,
  evaluateSuggestionWithSelectedJudge,
  flattenNumericScores,
  formatApiMessages,
  idDirectorEngine,
  memoryDynamicsService,
  mockGenerateResult,
  mockJudgeResult,
  resolveConfigModels,
  resolveEvalProfile,
  retryWithBackoff,
  rubricEvaluator,
  structureLearnerContext,
  tutorApi,
};

const { generateAndEvaluateTurn, runSingleTest } = createEvaluationTurnExecutionRuntime(turnExecutionDependencies);

const { runMultiTurnTest } = createEvaluationMultiTurnExecutionRuntime({
  DESUB_DRIFT_CLASSIFIER_MODEL,
  DESUB_SEMANTIC_RELEASE_JUDGE,
  _bridge3CouplingCosine,
  advanceBetweenTurnAdaptation,
  analyzeLearnerTrajectory,
  buildDriftCorrectionContext,
  buildInteriorCharacterSheet,
  buildMessageChain,
  buildMultiTurnContext,
  buildResistanceSignalRetryContext,
  callDriftClassifierJudge,
  checkContentConditionSemantic,
  checkGrounding,
  classifyLearnerDraft,
  completeMultiTurnEvaluation,
  countTutorWork,
  dialogueEngine,
  driftGateMaxAttempts,
  evaluateLearnerDraft,
  evaluateResistanceSignalTarget,
  evaluationStore,
  extractTurnSuperegoAssessment,
  flattenConversationHistory,
  flattenNumericScores,
  formatLearnerActionForTranscript,
  generateAndEvaluateTurn,
  generateLearnerResponse,
  generatePhase1Reflection,
  joinContextBlocks,
  prepareMultiTurnEvaluation,
  projectLearnerDeliberationTrace,
  promptRewriter,
  resistanceSignalGateMaxAttempts,
  shouldGateDynamicResistanceTurn,
  structureLearnerContext,
  tutorApi,
  writeCheckpoint,
});

// The single-test owner delegates multi-turn scenarios through this late-bound
// seam, avoiding a source-level import cycle between the two runtime owners.
turnExecutionDependencies.runMultiTurnTest = runMultiTurnTest;

const { resumeEvaluation } = createEvaluationResumeRuntime({
  DEFAULT_PARALLELISM,
  ProgressLogger,
  REQUEST_DELAY_MS,
  StreamingReporter,
  contentResolver,
  evalConfigLoader,
  evaluationStore,
  formatProgress,
  getProgressLogPath,
  isPidAlive,
  isTransientEvaluationError,
  listCheckpoints,
  monitoringService,
  runSingleTest,
  setQuietMode,
  sleep,
});

const { rejudgeRun } = createEvaluationRejudgeRuntime({
  DEFAULT_PARALLELISM,
  REQUEST_DELAY_MS,
  SUPPORTED_JUDGE_CLIS,
  buildBatchedLearnerPrompt,
  buildLearnerEvaluationPrompt,
  buildLearnerHolisticEvaluationPrompt,
  calculateLearnerOverallScore,
  callCliJudge,
  createHash,
  evaluationStore,
  extractLearnerTurnsFromTrace,
  getCliJudgeModelLabel,
  getDefaultCliJudgeModelOverride,
  normalizeCliJudgeEvaluation,
  resolveRejudgeScenarioAndDialogueLog,
  retryWithBackoff,
  rubricEvaluator,
  sleep,
});

/**
 * Compare two or more configurations
 */
export async function compareConfigurations(configs, options = {}) {
  const {
    scenarios = 'all',
    runsPerConfig = 1,
    verbose = false,
    dryRun = false,
    skipRubricEval = false,
    admissionPlan = null,
  } = options;

  // Run evaluation with specified configs
  const result = await runEvaluation({
    scenarios,
    configurations: configs,
    runsPerConfig,
    verbose,
    dryRun,
    skipRubricEval,
    admissionPlan,
    description: `Comparison: ${configs.map((c) => c.label || c.profileName || `${c.provider}/${c.model}`).join(' vs ')}`,
  });

  // Build comparison
  const comparison = {
    runId: result.runId,
    configurations: configs,
    rankings: result.stats
      .sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0))
      .map((stat, i) => ({
        rank: i + 1,
        provider: stat.provider,
        model: stat.model,
        profileName: stat.profileName,
        egoModel: stat.egoModel,
        superegoModel: stat.superegoModel,
        avgScore: stat.avgScore,
        avgBaseScore: stat.avgBaseScore,
        avgRecognitionScore: stat.avgRecognitionScore,
        successRate: stat.successRate,
        avgLatencyMs: stat.avgLatencyMs,
      })),
    scenarioBreakdown: result.scenarioStats,
  };

  return comparison;
}

/**
 * Quick test of a single configuration
 */
export async function quickTest(config, options = {}) {
  const {
    scenarioId = 'new_user_first_visit',
    verbose = true,
    skipRubricEval = false,
    outputSize = 'normal', // compact, normal, expanded
    onLog,
    superegoStrategy = null, // Superego intervention strategy
    judgeOverride = null, // Override judge model for this run
    dryRun = false,
  } = options;

  const scenarios = [evalConfigLoader.listScenarios().find((s) => s.id === scenarioId)].filter(Boolean);
  if (scenarios.length === 0) {
    throw new Error(`Scenario not found: ${scenarioId}`);
  }

  const result = await runSingleTest(scenarios[0], config, {
    verbose,
    skipRubricEval,
    outputSize,
    onLog,
    superegoStrategy,
    judgeOverride,
    dryRun,
  });
  return result;
}

/**
 * List available scenarios and configurations
 */
export function listOptions() {
  return {
    scenarios: evalConfigLoader.listScenarios(),
    configurations: evalConfigLoader.listConfigurations(),
    profiles: evalConfigLoader.listTutorProfiles(),
  };
}

/**
 * Get previous run results
 */
export function getRunResults(runId) {
  const run = evaluationStore.getRun(runId);
  if (!run) {
    throw new Error(`Run not found: ${runId}`);
  }

  return {
    run,
    stats: evaluationStore.getRunStats(runId),
    scenarioStats: evaluationStore.getScenarioStats(runId),
    results: evaluationStore.getResults(runId),
  };
}

/**
 * Generate a text report for a run
 */
export function generateReport(runId) {
  const run = evaluationStore.getRun(runId);
  if (!run) {
    throw new Error(`Run not found: ${runId}`);
  }

  const stats = evaluationStore.getRunStats(runId);
  const scenarioStats = evaluationStore.getScenarioStats(runId);

  const lines = [];

  lines.push('='.repeat(80));
  lines.push(`TUTOR EVALUATION REPORT: ${runId}`);
  lines.push('='.repeat(80));
  lines.push('');
  lines.push(`Run Date: ${run.createdAt}`);
  lines.push(`Description: ${run.description || 'N/A'}`);
  lines.push(`Total Tests: ${run.totalTests}`);
  lines.push(`Status: ${run.status}`);
  lines.push('');

  // Rankings table
  lines.push('CONFIGURATION RANKINGS (by average score)');
  lines.push('-'.repeat(105));
  lines.push(
    '| Rank | Profile                          | Model                   | Overall |  Base  | Recog  | Latency | Pass |',
  );
  lines.push(
    '|------|----------------------------------|-------------------------|---------|--------|--------|---------|------|',
  );

  stats.forEach((stat, i) => {
    const profile = (stat.profileName || 'N/A').substring(0, 32).padEnd(32);
    const model = (stat.model || '').substring(0, 23).padEnd(23);
    const score = stat.avgScore ? stat.avgScore.toFixed(1).padStart(7) : '    N/A';
    const base = stat.avgBaseScore ? stat.avgBaseScore.toFixed(1).padStart(6) : '   N/A';
    const recog = stat.avgRecognitionScore ? stat.avgRecognitionScore.toFixed(1).padStart(6) : '   N/A';
    const latency = stat.avgLatencyMs ? `${stat.avgLatencyMs.toFixed(0)}ms`.padStart(7) : '    N/A';
    const passRate = `${(stat.validationPassRate * 100).toFixed(0)}%`.padStart(4);
    lines.push(
      `| ${(i + 1).toString().padStart(4)} | ${profile} | ${model} | ${score} | ${base} | ${recog} | ${latency} | ${passRate} |`,
    );
  });

  lines.push('');

  // Dimension breakdown
  if (stats.length > 0 && stats[0].dimensions) {
    lines.push('DIMENSION BREAKDOWN');
    lines.push('-'.repeat(80));

    // Determine which dimensions to show based on what's in the data
    const allDims = new Set();
    stats.forEach((s) => {
      if (s.dimensions) {
        Object.keys(s.dimensions).forEach((d) => allDims.add(d));
      }
    });

    // Order: Prioritize Rubric 2.2+ dimensions, then legacy, then any custom ones
    const prioritized = [
      'perception_quality',
      'pedagogical_craft',
      'elicitation_quality',
      'adaptive_responsiveness',
      'recognition_quality',
      'productive_difficulty',
      'epistemic_integrity',
      'content_accuracy',
      'relevance',
      'specificity',
      'pedagogical',
      'personalization',
      'actionability',
      'tone',
    ];

    // Build the final dimension list: prioritized first, then any remaining in data
    const dims = [];
    prioritized.forEach((d) => {
      if (allDims.has(d)) {
        dims.push(d);
      }
    });

    // Add any "new" dimensions not in the prioritized list
    const prioritizedSet = new Set(prioritized);
    allDims.forEach((d) => {
      if (!prioritizedSet.has(d)) {
        dims.push(d);
      }
    });

    if (dims.length > 0) {
      const header =
        '| Dimension'.padEnd(26) +
        '|' +
        stats.map((s) => ` ${(s.profileName || s.model).substring(0, 12).padEnd(12)} |`).join('');
      lines.push(header);
      lines.push('|' + '-'.repeat(25) + '|' + stats.map(() => '--------------|').join(''));

      for (const dim of dims) {
        const row =
          `| ${dim.padEnd(24)} |` +
          stats
            .map((s) => {
              const score = s.dimensions?.[dim];
              return ` ${Number.isFinite(score) ? score.toFixed(2).padStart(12) : '         N/A'} |`;
            })
            .join('');
        lines.push(row);
      }
      lines.push('');
    }
  }

  // Scenario breakdown
  lines.push('SCENARIO PERFORMANCE');
  lines.push('-'.repeat(80));

  for (const scenario of scenarioStats) {
    lines.push(`\n${scenario.scenarioName} (${scenario.scenarioId})`);
    for (const config of scenario.configurations) {
      const status = config.passesValidation ? 'PASS' : 'FAIL';
      const profile = config.profileName || `${config.provider}/${config.model}`;
      const base = config.avgBaseScore != null ? `base=${config.avgBaseScore.toFixed(1)}` : '';
      const recog = config.avgRecognitionScore != null ? `recog=${config.avgRecognitionScore.toFixed(1)}` : '';
      const scores = [base, recog].filter(Boolean).join(', ');
      lines.push(`  ${profile}: ${config.avgScore?.toFixed(1) || 'N/A'} (${scores}) [${status}]`);
    }
  }

  lines.push('');

  // ANOVA analysis — if factorial data is available, run for each score type
  const scoreTypes = [
    { column: 'tutor_first_turn_score', label: 'Overall Score' },
    { column: 'base_score', label: 'Base Score' },
    { column: 'recognition_score', label: 'Recognition Score' },
  ];

  for (const { column, label } of scoreTypes) {
    const cellData = evaluationStore.getFactorialCellData(runId, { scoreColumn: column });
    const cellKeys = Object.keys(cellData);
    if (cellKeys.length === 0) continue;

    const totalSamples = Object.values(cellData).reduce((sum, arr) => sum + arr.length, 0);
    lines.push(`FACTORIAL ANOVA — ${label.toUpperCase()} (2x2x2)`);
    lines.push('-'.repeat(80));
    lines.push(`Cells with data: ${cellKeys.length}/8  |  Total samples: ${totalSamples}`);
    lines.push('');

    // Cell means summary
    for (const key of cellKeys.sort()) {
      const scores = cellData[key];
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const cellLabel = key.replace(
        /r(\d)_t(\d)_l(\d)/,
        (_, r, t, l) =>
          `Recog=${r === '1' ? 'Y' : 'N'} Tutor=${t === '1' ? 'Multi' : 'Single'} Learner=${l === '1' ? 'Psycho' : 'Unified'}`,
      );
      lines.push(`  ${cellLabel}: mean=${mean.toFixed(1)} (n=${scores.length})`);
    }
    lines.push('');

    if (totalSamples > 8) {
      const anovaResult = anovaStats.runThreeWayANOVA(cellData);
      lines.push(anovaStats.formatANOVAReport(anovaResult, { scoreLabel: label }));
    } else {
      lines.push('  (Need > 8 total samples for ANOVA — increase --runs)');
    }
    lines.push('');
  }

  lines.push('='.repeat(80));

  return lines.join('\n');
}

// Named exports for unit testing (these are internal helpers not part of the public API)
export {
  resumeEvaluation,
  rejudgeRun,
  structureLearnerContext,
  stripRecentChatHistory,
  resolveConfigModels,
  flattenConversationHistory,
  flattenNumericScores,
  parseCliJudgeJsonResponse,
  buildMultiTurnContext,
  formatTurnForContext,
  buildMessageChain,
  writeCheckpoint,
  loadCheckpoint,
  deleteCheckpoint,
  listCheckpoints,
  normalizeCliJudgeEvaluation,
};

export default {
  runEvaluation,
  resumeEvaluation,
  compareConfigurations,
  quickTest,
  listOptions,
  getRunResults,
  generateReport,
  rejudgeRun,
};
