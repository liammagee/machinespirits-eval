/**
 * Evaluation Runner Service
 *
 * Orchestrates the evaluation of AI tutor configurations across
 * test scenarios with rubric-based scoring.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';
import { createHash } from 'crypto';
import { jsonrepair } from 'jsonrepair';
import {
  tutorApiService as tutorApi,
  tutorConfigLoader,
  monitoringService,
  tutorDialogueEngine as dialogueEngine,
  setQuietMode,
} from '@machinespirits/tutor-core';
import * as rubricEvaluator from './rubricEvaluator.js';
import {
  buildLearnerEvaluationPrompt,
  buildBatchedLearnerPrompt,
  buildLearnerHolisticEvaluationPrompt,
  calculateLearnerOverallScore,
} from './learnerRubricEvaluator.js';
import * as evaluationStore from './evaluationStore.js';
import * as evalConfigLoader from './evalConfigLoader.js';
import * as contentResolver from './contentResolver.js';
import { ProgressLogger, getProgressLogPath } from './progressLogger.js';
import { StreamingReporter } from './streamingReporter.js';
import * as anovaStats from './anovaStats.js';
import { generateLearnerResponse } from './learnerTutorInteractionEngine.js';
import * as learnerConfigLoader from './learnerConfigLoader.js';
import * as turnComparisonAnalyzer from './turnComparisonAnalyzer.js';
import * as dialogueTraceAnalyzer from './dialogueTraceAnalyzer.js';
import * as promptRewriter from './promptRewriter.js';
import { captureApiCalls, attachApiPayloadsToTrace } from './apiPayloadCapture.js';
import { formatApiMessages } from './apiMessageFormatter.js';
import { LiveApiReporter } from './liveApiReporter.js';
import { mockGenerateResult, mockJudgeResult } from './mockProvider.js';
import { formatEntry, formatTranscript, formatCompactLine } from './transcriptFormatter.js';
import { chalk } from './cliTheme.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVAL_ROOT = path.resolve(__dirname, '..');
const LOGS_DIR = path.join(EVAL_ROOT, 'logs', 'tutor-dialogues');
const TRANSCRIPTS_DIR = path.join(EVAL_ROOT, 'logs', 'transcripts');
const CHECKPOINTS_DIR = path.join(EVAL_ROOT, 'logs', 'checkpoints');

// Redirect tutor-core logs to this repo's logs/ directory (if available)
import('@machinespirits/tutor-core')
  .then((mod) => {
    if (typeof mod.setLogDir === 'function') mod.setLogDir(path.join(EVAL_ROOT, 'logs'));
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
 * Eval-only profile names that need remapping to tutor-core profiles.
 */
export const EVAL_ONLY_PROFILES = [
  'single_baseline',
  'single_baseline_paid',
  'single_recognition',
  'single_recognition_paid',
  'single_enhanced',
  'baseline',
  'baseline_paid',
  'recognition',
  'recognition_paid',
  'enhanced',
  'cell_1_base_single_unified',
  'cell_2_base_single_psycho',
  'cell_3_base_multi_unified',
  'cell_4_base_multi_psycho',
  'cell_5_recog_single_unified',
  'cell_6_recog_single_psycho',
  'cell_7_recog_multi_unified',
  'cell_8_recog_multi_psycho',
  'cell_9_enhanced_single_unified',
  'cell_10_enhanced_single_psycho',
  'cell_11_enhanced_multi_unified',
  'cell_12_enhanced_multi_psycho',
  'cell_13_hardwired_single_unified',
  'cell_14_hardwired_single_psycho',
  'cell_15_placebo_single_unified',
  'cell_16_placebo_single_psycho',
  'cell_17_placebo_multi_unified',
  'cell_18_placebo_multi_psycho',
  'cell_19_memory_single_unified',
  'cell_20_recog_nomem_single_unified',
  'cell_21_recog_multi_unified_rewrite',
  'cell_22_base_suspicious_unified',
  'cell_23_recog_suspicious_unified',
  'cell_24_base_adversary_unified',
  'cell_25_recog_adversary_unified',
  'cell_26_base_advocate_unified',
  'cell_27_recog_advocate_unified',
  'cell_28_base_dialectical_suspicious_unified',
  'cell_29_recog_dialectical_suspicious_unified',
  'cell_30_base_dialectical_adversary_unified',
  'cell_31_recog_dialectical_adversary_unified',
  'cell_32_base_dialectical_advocate_unified',
  'cell_33_recog_dialectical_advocate_unified',
  'cell_34_base_dialectical_suspicious_unified_full',
  'cell_35_recog_dialectical_suspicious_unified_full',
  'cell_36_base_dialectical_adversary_unified_full',
  'cell_37_recog_dialectical_adversary_unified_full',
  'cell_38_base_dialectical_advocate_unified_full',
  'cell_39_recog_dialectical_advocate_unified_full',
  'cell_40_base_dialectical_suspicious_unified_superego',
  'cell_41_recog_dialectical_suspicious_unified_superego',
  'cell_42_base_dialectical_adversary_unified_superego',
  'cell_43_recog_dialectical_adversary_unified_superego',
  'cell_44_base_dialectical_advocate_unified_superego',
  'cell_45_recog_dialectical_advocate_unified_superego',
  'cell_46_base_dialectical_suspicious_unified_quantitative',
  'cell_47_recog_dialectical_suspicious_unified_quantitative',
  'cell_48_base_dialectical_suspicious_unified_erosion',
  'cell_49_recog_dialectical_suspicious_unified_erosion',
  'cell_50_base_dialectical_suspicious_unified_intersubjective',
  'cell_51_recog_dialectical_suspicious_unified_intersubjective',
  'cell_52_base_dialectical_suspicious_unified_combined',
  'cell_53_recog_dialectical_suspicious_unified_combined',
  'cell_54_base_dialectical_profile_tutor',
  'cell_55_recog_dialectical_profile_tutor',
  'cell_56_base_dialectical_profile_bidirectional',
  'cell_57_recog_dialectical_profile_bidirectional',
  'cell_58_recog_dialectical_profile_bidirectional_full',
  'cell_59_recog_dialectical_profile_bidirectional_strategy',
  'cell_60_base_dialectical_selfreflect_psycho',
  'cell_61_recog_dialectical_selfreflect_psycho',
  'cell_62_base_dialectical_profile_bidirectional_psycho',
  'cell_63_recog_dialectical_profile_bidirectional_psycho',
  'cell_64_recog_dialectical_intersubjective_psycho',
  'cell_65_recog_dialectical_combined_psycho',
  'cell_66_recog_dialectical_profile_prosthesis_descriptive',
  'cell_67_recog_dialectical_profile_prosthesis_prescriptive',
  'cell_68_recog_dialectical_profile_prosthesis_adversary',
  'cell_69_base_dialectical_intersubjective_psycho',
  'cell_70_base_dialectical_combined_psycho',
  'cell_71_naive_single_unified',
  'cell_72_base_dialectical_quantitative_psycho',
  'cell_73_recog_dialectical_quantitative_psycho',
  'cell_74_base_dialectical_erosion_psycho',
  'cell_75_recog_dialectical_erosion_psycho',
  'cell_76_base_dialectical_profile_tutor_psycho',
  'cell_77_recog_dialectical_profile_tutor_psycho',
  'cell_78_base_dialectical_selfreflect_psycho_authentic',
  'cell_79_recog_dialectical_selfreflect_psycho_authentic',
  'cell_80_messages_base_single_unified',
  'cell_81_messages_base_single_psycho',
  'cell_82_messages_base_multi_unified',
  'cell_83_messages_base_multi_psycho',
  'cell_84_messages_recog_single_unified',
  'cell_85_messages_recog_single_psycho',
  'cell_86_messages_recog_multi_unified',
  'cell_87_messages_recog_multi_psycho',
  'cell_88_messages_recog_multi_psycho_haiku',
  'cell_89_messages_recog_multi_psycho_gemflash',
  'cell_90_messages_recog_single_unified',
  'cell_91_messages_recog_multi_unified_gemflash',
  'cell_92_messages_recog_single_psycho_gemflash',
];

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
  const evalProfile = evalConfigLoader.loadTutorAgents()?.profiles?.[profileName];
  const useDialogue = evalProfile?.dialogue?.enabled ?? false;
  const maxRounds = evalProfile?.dialogue?.max_rounds ?? 0;
  const recognitionMode = evalProfile?.recognition_mode ?? profileName?.includes('recognition') ?? false;

  let resolvedProfileName = profileName;
  let wasRemapped = false;
  if (profileName && EVAL_ONLY_PROFILES.includes(profileName)) {
    wasRemapped = true;
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
    } else if (promptType === 'dialectical_adversary') {
      resolvedProfileName = recognitionMode ? 'dialectical_adversary_recognition' : 'dialectical_adversary';
    } else if (promptType === 'dialectical_advocate') {
      resolvedProfileName = recognitionMode ? 'dialectical_advocate_recognition' : 'dialectical_advocate';
    } else if (recognitionMode) {
      resolvedProfileName = 'recognition';
    } else {
      resolvedProfileName = 'budget';
    }
  }

  // For remapped eval-only profiles, verify the resolved name exists in tutor-core.
  // Eval-specific profiles (enhanced, placebo, dialectical_*, etc.) only exist in the
  // dev version of tutor-core. When the published package is installed, fall back to a
  // safe base profile — the eval runner provides all real configuration via explicit
  // overrides (egoModel, superegoModel, hyperparameters, systemPromptExtension).
  if (wasRemapped) {
    try {
      const tutorConfig = tutorConfigLoader.loadConfig();
      if (!tutorConfig.profiles?.[resolvedProfileName]) {
        const fallback = recognitionMode ? 'recognition' : 'budget';
        console.debug(
          `[resolveEvalProfile] Profile "${resolvedProfileName}" not in tutor-core, using "${fallback}" base`,
        );
        resolvedProfileName = fallback;
      }
    } catch {
      // tutorConfigLoader not available — keep resolved name as-is
    }
  }

  return { useDialogue, maxRounds, recognitionMode, resolvedProfileName };
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

export function getCliJudgeModelLabel(judgeCli, modelOverride = null) {
  const cli = String(judgeCli || '').toLowerCase();
  if (!SUPPORTED_JUDGE_CLIS.has(cli)) {
    throw new Error(`Unsupported judge CLI: ${judgeCli}`);
  }

  if (cli === 'gemini') return `gemini-cli/${modelOverride || 'auto'}`;
  if (cli === 'codex') return `codex-cli/${modelOverride || 'auto'}`;
  return modelOverride ? `claude-code/${modelOverride}` : 'claude-opus-4.6';
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

async function callCliJudge(prompt, judgeCli, modelOverride = null) {
  const cli = String(judgeCli || '').toLowerCase();
  if (!SUPPORTED_JUDGE_CLIS.has(cli)) {
    throw new Error(`Unsupported judge CLI: ${judgeCli}`);
  }

  let cliBinary;
  let cliArgs;
  let cliEnv;

  if (cli === 'gemini') {
    cliBinary = 'gemini';
    cliArgs = ['-s', '-o', 'text'];
    if (modelOverride) cliArgs.push('-m', modelOverride);
    cliEnv = { ...process.env };
  } else if (cli === 'codex') {
    cliBinary = 'codex';
    cliArgs = ['exec', '-'];
    if (modelOverride) cliArgs.push('-m', modelOverride);
    cliEnv = { ...process.env };
  } else {
    cliBinary = 'claude';
    cliArgs = ['-p', '-', '--output-format', 'text'];
    if (modelOverride) cliArgs.push('--model', modelOverride);
    cliEnv = { ...process.env };
    delete cliEnv.ANTHROPIC_API_KEY;
    delete cliEnv.CLAUDECODE;
  }

  const stdout = await new Promise((resolve, reject) => {
    const child = spawn(cliBinary, cliArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: cliEnv,
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => {
      out += d;
    });
    child.stderr.on('data', (d) => {
      err += d;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(err || out || `${cliBinary} exited with code ${code}`));
      else resolve(out);
    });
    child.stdin.write(prompt);
    child.stdin.end();
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
      return JSON.parse(candidate);
    } catch (error) {
      errors.push(`JSON.parse: ${error.message}`);
    }

    try {
      return JSON.parse(jsonrepair(candidate));
    } catch (error) {
      errors.push(`jsonrepair: ${error.message}`);
    }
  }

  const preview = raw.slice(0, 300).replace(/\s+/g, ' ');
  throw new Error(
    `Could not parse CLI judge response as JSON. Tried ${candidates.length} candidate(s). ${errors[errors.length - 1] || ''} Raw preview: ${preview}`,
  );
}

function extractCliJudgeOverallScore(parsed) {
  const candidates = [
    parsed?.overall_score,
    parsed?.overallScore,
    parsed?.total_score,
    parsed?.totalScore,
  ];

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
      if (!Number.isFinite(numericScore)) continue;
      normalizedScores[normalizedKey] = {
        score: numericScore,
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

async function evaluateSuggestionWithSelectedJudge(
  suggestion,
  scenarioContext,
  context = {},
  options = {},
) {
  const { dialogueContext = null } = context;
  const { judgeOverride = null, judgeCli = null, judgeCliModel = null } = options;

  if (judgeCli) {
    const startTime = Date.now();
    const parsed = await callCliJudge(
      rubricEvaluator.buildEvaluationPrompt(suggestion, scenarioContext, { dialogueContext }),
      judgeCli,
      judgeCliModel,
    );
    return normalizeCliJudgeEvaluation(
      parsed,
      getCliJudgeModelLabel(judgeCli, judgeCliModel),
      Date.now() - startTime,
    );
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

// ---------------------------------------------------------------------------
// Structured context extraction — parse markdown learner context into
// labeled fields so the model can't miss key signals.
// See notes/baseline-prompt-v2-2026-02-02.md for rationale.
// ---------------------------------------------------------------------------

/**
 * Extract key signals from markdown learner context and prepend a
 * structured summary block. The original context is preserved below.
 */
function structureLearnerContext(rawContext) {
  if (!rawContext || typeof rawContext !== 'string') return rawContext;

  const fields = {};

  // User type
  if (/\bnew user\b/i.test(rawContext)) {
    fields['Learner Type'] = 'New user (no prior history)';
  } else {
    const sessionMatch = rawContext.match(/(\d+)\s+sessions?/i);
    const eventMatch = rawContext.match(/(\d+)\s+total events?/i);
    fields['Learner Type'] =
      'Returning user' +
      (sessionMatch ? `, ${sessionMatch[1]} sessions` : '') +
      (eventMatch ? `, ${eventMatch[1]} events` : '');
  }

  // Current content
  const viewingMatch = rawContext.match(/\*\*Currently viewing\*\*:\s*(.+)/);
  if (viewingMatch) {
    fields['Current Content'] = viewingMatch[1].trim();
  }

  // Struggle signals
  const struggleMatch = rawContext.match(/\*\*Struggle signals? detected\*\*:\s*(\d+)/i);
  if (struggleMatch) {
    fields['Struggle Signals'] = `${struggleMatch[1]} detected`;
  }

  // Quiz/activity retries
  const retryMatch = rawContext.match(/retried?\s+(\d+)\s+times?/i);
  if (retryMatch) {
    fields['Activity Retries'] = `${retryMatch[1]} retries`;
  }
  // Also check for "Retrying activity" lines
  const retryLines = (rawContext.match(/Retrying activity/gi) || []).length;
  if (retryLines > 0 && !retryMatch) {
    fields['Activity Retries'] = `${retryLines} retries in timeline`;
  }

  // Primary struggle area
  const struggleAreaMatch = rawContext.match(/\*\*Primary struggle area\*\*:\s*(.+)/);
  if (struggleAreaMatch) {
    fields['Primary Struggle'] = struggleAreaMatch[1].trim();
  }

  // Concept difficulty
  const conceptMatch = rawContext.match(/\*\*Concept difficulty\*\*:\s*(.+)/);
  if (conceptMatch) {
    fields['Difficult Concepts'] = conceptMatch[1].trim();
  }

  // Mood / emotional signals from chat history
  const chatLines = [];
  const chatPattern = /- User:\s*"([^"]+)"/g;
  let m;
  while ((m = chatPattern.exec(rawContext)) !== null) {
    chatLines.push(m[1]);
  }
  if (chatLines.length > 0) {
    fields['Learner Messages'] = chatLines.join(' | ');
  }

  // Completed lectures
  const completedMatch = rawContext.match(/\*\*Completed lectures?\*\*:\s*(.+)/);
  if (completedMatch) {
    fields['Completed Lectures'] = completedMatch[1].trim();
  }

  // Time on page
  const timeMatch = rawContext.match(/\*\*Time on page\*\*:\s*(.+)/);
  if (timeMatch) {
    fields['Time on Page'] = timeMatch[1].trim();
  }

  // Scroll depth
  const scrollMatch = rawContext.match(/\*\*Scroll depth\*\*:\s*(.+)/);
  if (scrollMatch) {
    fields['Scroll Depth'] = scrollMatch[1].trim();
  }

  // Performance / success rate
  const avgScoreMatch = rawContext.match(/\*\*Average score\*\*:\s*(.+)/);
  if (avgScoreMatch) {
    fields['Average Score'] = avgScoreMatch[1].trim();
  }

  // Activities completion
  const actCompMatch = rawContext.match(/\*\*Activities completed\*\*:\s*(.+)/);
  if (actCompMatch) {
    fields['Activities Completed'] = actCompMatch[1].trim();
  }

  // If no meaningful fields extracted, return original unchanged
  const fieldKeys = Object.keys(fields);
  if (fieldKeys.length <= 1) return rawContext; // only learner type

  // Build structured summary block with explicit instruction header
  const lines = [
    '⚠️ YOU MUST REFERENCE AT LEAST ONE OF THESE SIGNALS BY NAME IN YOUR SUGGESTION:',
    '<structured_context_summary>',
  ];
  for (const [key, value] of Object.entries(fields)) {
    lines.push(`${key}: ${value}`);
  }
  lines.push('</structured_context_summary>');
  lines.push('Your suggestion MUST mention specific data from the summary above. Generic responses are WRONG.');
  lines.push('');

  return lines.join('\n') + rawContext;
}

/**
 * Unpack paired conversation history entries into a flat role-alternating array.
 *
 * Each entry in `conversationHistory` represents one exchange and contains both
 * the tutor's suggestion and the learner's reply.  This helper expands each
 * entry into separate {role, content} objects so the learner LLM sees a proper
 * alternating dialogue rather than a monologue.
 *
 * CRITICAL: Using .map() instead of .flatMap() here was the root cause of the
 * multi-turn ego_superego learner regression bug — the learner only ever saw
 * its own previous messages, causing it to loop.  Do NOT collapse back to .map().
 */
function flattenConversationHistory(conversationHistory) {
  return (conversationHistory || []).flatMap((h) => [
    { role: 'tutor', content: h.suggestion?.message || '' },
    ...(h.learnerMessage ? [{ role: 'learner', content: h.learnerMessage }] : []),
  ]);
}

/**
 * Build a proper message chain from conversation history for multi-turn
 * message mode. From the tutor's perspective: tutor suggestions = assistant,
 * learner messages = user.
 *
 * @param {Array} conversationHistory - Array of turn history objects
 * @returns {Array<{role: string, content: string}>} Alternating user/assistant messages
 */
function buildMessageChain(conversationHistory) {
  const messages = [];
  for (const h of conversationHistory || []) {
    if (h.suggestion?.message) {
      messages.push({ role: 'assistant', content: h.suggestion.message });
    }
    if (h.learnerMessage) {
      messages.push({ role: 'user', content: h.learnerMessage });
    }
  }
  return messages;
}

/**
 * Strip the "### Recent Chat History" section from learner context.
 *
 * In messages-mode multi-turn dialogues, the initial learner utterance is
 * embedded in the scenario's learner_context under this heading.  On Turn 1+
 * the real conversation history is carried as a proper message chain, so the
 * static chat history causes the tutor to anchor on the opening message
 * instead of the learner's evolving questions.
 *
 * The regex matches from the heading to the next `### ` heading or end-of-string.
 */
function stripRecentChatHistory(context) {
  if (!context) return context;
  return context.replace(/### Recent Chat History\n[\s\S]*?(?=\n###|$)/g, '').trim();
}

// ---------------------------------------------------------------------------
// Multi-turn context-building utilities (moved from multiTurnRunner.js)
// ---------------------------------------------------------------------------

/**
 * Build updated context for a follow-up turn in a multi-turn scenario
 */
function buildMultiTurnContext(options) {
  const {
    originalContext,
    conversationHistory = [],
    currentTurn,
    _previousSuggestion,
    priorSuperegoAssessments = [],
    learnerTrajectory = null,
    conversationMode = 'single-prompt',
  } = options;

  const contextParts = [];

  // sessionEvolution is now injected into the system prompt (not user context).
  // See systemPromptExtension threading through generateAndEvaluateTurn → tutor-core.

  // In messages mode (Turn 1+), strip the static "### Recent Chat History"
  // section so the tutor engages with the evolving message chain rather than
  // anchoring on the initial learner utterance baked into the scenario YAML.
  let effectiveContext = originalContext;
  if (conversationMode === 'messages' && conversationHistory.length > 0) {
    effectiveContext = stripRecentChatHistory(originalContext);
    effectiveContext +=
      '\n\n### Conversation Context\n' +
      "The learner's ongoing messages are provided as conversation history. " +
      'Focus your response on their most recent message.';
  }
  contextParts.push(effectiveContext);

  // In message chain mode, conversation history is carried as proper message
  // arrays (assistant/user roles) rather than serialized text in the context.
  // Only include the text serialization in single-prompt mode.
  if (conversationMode !== 'messages' && conversationHistory.length > 0) {
    contextParts.push('\n### Conversation History');
    for (const turn of conversationHistory) {
      contextParts.push(formatTurnForContext(turn));
    }
  }

  // Cross-turn superego memory: accumulated feedback from prior turns' internal
  // deliberation. Visible to both ego (full context) and superego (via
  // extractStructuredSummary fallback). Enables the superego to detect whether
  // its prior feedback was incorporated and escalate if needed.
  if (priorSuperegoAssessments.length > 0) {
    contextParts.push('\n### Prior Superego Assessment');
    for (const assessment of priorSuperegoAssessments) {
      contextParts.push(formatSuperegoAssessment(assessment));
    }
  }

  // Structured learner trajectory: pre-processed resistance/engagement signals
  // derived from conversation history and score trajectory. Enables the superego
  // to distinguish "learner asked a new question" from "learner is repeating the
  // same confusion because our approach isn't working."
  if (learnerTrajectory) {
    contextParts.push('\n### Learner Trajectory Assessment');
    contextParts.push(formatLearnerTrajectory(learnerTrajectory));
  }

  // Note: "Previous Tutor Suggestion" block removed — it duplicated the last
  // entry already present in conversation history above.

  if (currentTurn?.learner_action) {
    contextParts.push('\n### Learner Action');
    contextParts.push(formatLearnerAction(currentTurn));
  }

  if (currentTurn?.context_update) {
    contextParts.push('\n' + currentTurn.context_update.trim());
  }

  return contextParts.join('\n');
}

/**
 * Extract superego feedback from a single turn's dialogue trace entries.
 * Returns a structured assessment object for cross-turn memory.
 */
function extractTurnSuperegoAssessment(turnIndex, traceEntries) {
  const superegoEntries = traceEntries.filter((e) => e.agent === 'superego');
  if (superegoEntries.length === 0) return null;

  const lastEntry = superegoEntries[superegoEntries.length - 1];
  const totalRejections = superegoEntries.filter((e) => e.approved === false).length;
  const totalApprovals = superegoEntries.filter((e) => e.approved === true).length;
  const interventionTypes = superegoEntries.map((e) => e.interventionType).filter(Boolean);

  // Extract feedback text from last entry
  let feedbackText = lastEntry.feedback || '';
  if (!feedbackText && lastEntry.detail) {
    const match = lastEntry.detail.match(/"feedback"\s*:\s*"([^"]+)"/);
    if (match) feedbackText = match[1];
  }

  return {
    turnIndex,
    rejections: totalRejections,
    approvals: totalApprovals,
    interventionTypes,
    finalApproved: lastEntry.approved,
    confidence: lastEntry.confidence,
    feedback: feedbackText.substring(0, 300),
  };
}

/**
 * Format a superego assessment for context injection.
 */
function formatSuperegoAssessment(assessment) {
  const lines = [];
  lines.push(`\n**Turn ${assessment.turnIndex + 1} internal critique:**`);
  lines.push(
    `- Outcome: ${assessment.finalApproved ? 'approved' : 'rejected'} after ${assessment.rejections} rejection(s)`,
  );
  if (assessment.interventionTypes.length > 0) {
    lines.push(`- Interventions: ${[...new Set(assessment.interventionTypes)].join(', ')}`);
  }
  if (assessment.feedback) {
    lines.push(`- Key concern: "${assessment.feedback}"`);
  }
  return lines.join('\n');
}

/**
 * Analyze learner trajectory across turns to produce structured resistance signals.
 * Returns null if insufficient data.
 */
function analyzeLearnerTrajectory(turnResults, conversationHistory) {
  if (turnResults.length < 2) return null;

  const trajectory = {
    turnCount: turnResults.length,
    engagementDirection: 'stable',
    resistanceType: null,
    resistanceStrength: 0, // 0-3 scale
    priorApproachEffective: null,
    scoreTrajectory: [],
    messageLengthTrajectory: [],
    repeatedConfusion: false,
    questionDiversity: 0,
  };

  // Score trajectory
  trajectory.scoreTrajectory = turnResults.filter((t) => t.turnScore != null).map((t) => t.turnScore);

  // Message length trajectory (proxy for engagement)
  const messageLengths = conversationHistory.filter((h) => h.learnerMessage).map((h) => h.learnerMessage.length);
  trajectory.messageLengthTrajectory = messageLengths;

  // Engagement direction: declining if last 2 messages shorter than first 2
  if (messageLengths.length >= 3) {
    const earlyAvg = messageLengths.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
    const lateAvg = messageLengths.slice(-2).reduce((a, b) => a + b, 0) / 2;
    if (lateAvg < earlyAvg * 0.6) trajectory.engagementDirection = 'declining';
    else if (lateAvg > earlyAvg * 1.4) trajectory.engagementDirection = 'increasing';
  }

  // Score direction
  if (trajectory.scoreTrajectory.length >= 2) {
    const last = trajectory.scoreTrajectory[trajectory.scoreTrajectory.length - 1];
    const prev = trajectory.scoreTrajectory[trajectory.scoreTrajectory.length - 2];
    trajectory.priorApproachEffective = last >= prev;
  }

  // Repeated confusion detection: learner uses similar phrasing across turns
  const learnerMessages = conversationHistory
    .filter((h) => h.learnerMessage)
    .map((h) => h.learnerMessage.toLowerCase());

  if (learnerMessages.length >= 2) {
    // Check for confusion markers repeating
    const confusionPatterns = [
      /i('m| am) (still )?(confused|lost|not sure|unsure)/i,
      /i don'?t (understand|get|see)/i,
      /what do you mean/i,
      /can you explain/i,
      /i('m| am) not following/i,
    ];

    const confusionCounts = learnerMessages.map((msg) => confusionPatterns.filter((p) => p.test(msg)).length);
    const lastTwoConfusion = confusionCounts.slice(-2);
    if (lastTwoConfusion.length >= 2 && lastTwoConfusion.every((c) => c > 0)) {
      trajectory.repeatedConfusion = true;
      trajectory.resistanceType = 'repeated_confusion';
      trajectory.resistanceStrength = 2;
    }
  }

  // Pushback detection
  const lastMessage = learnerMessages[learnerMessages.length - 1] || '';
  const pushbackPatterns = [
    /\bbut\s+(what about|doesn'?t|isn'?t|that doesn'?t)\b/i,
    /\bi disagree\b/i,
    /\bi don'?t think\b/i,
    /\bthat'?s not (right|correct|what i)\b/i,
    /\byou('re| are) (wrong|missing|not)\b/i,
  ];
  if (pushbackPatterns.some((p) => p.test(lastMessage))) {
    trajectory.resistanceType = trajectory.resistanceType || 'pushback';
    trajectory.resistanceStrength = Math.max(trajectory.resistanceStrength, 2);
  }

  // Disengagement detection: very short messages, no questions
  if (messageLengths.length >= 2) {
    const lastLen = messageLengths[messageLengths.length - 1];
    if (lastLen < 30 && !lastMessage.includes('?')) {
      trajectory.resistanceType = trajectory.resistanceType || 'disengagement';
      trajectory.resistanceStrength = Math.max(trajectory.resistanceStrength, 1);
      trajectory.engagementDirection = 'declining';
    }
  }

  // Question diversity: how varied are the learner's questions?
  const questions = learnerMessages.filter((m) => m.includes('?'));
  if (questions.length >= 2) {
    // Simple word overlap check between consecutive questions
    const uniqueQuestionWords = questions.map((q) => new Set(q.split(/\s+/).filter((w) => w.length > 3)));
    let totalOverlap = 0;
    for (let i = 1; i < uniqueQuestionWords.length; i++) {
      const prev = uniqueQuestionWords[i - 1];
      const curr = uniqueQuestionWords[i];
      const overlap = [...curr].filter((w) => prev.has(w)).length / Math.max(curr.size, 1);
      totalOverlap += overlap;
    }
    trajectory.questionDiversity = 1 - totalOverlap / Math.max(uniqueQuestionWords.length - 1, 1);
  }

  // Cumulative resistance: if score declining AND engagement declining, high resistance
  if (trajectory.engagementDirection === 'declining' && trajectory.priorApproachEffective === false) {
    trajectory.resistanceStrength = 3;
    trajectory.resistanceType = trajectory.resistanceType || 'cumulative_decline';
  }

  return trajectory;
}

/**
 * Format learner trajectory assessment for context injection.
 */
function formatLearnerTrajectory(trajectory) {
  const lines = [];

  // Engagement direction
  const engagementEmoji =
    trajectory.engagementDirection === 'declining'
      ? 'DECLINING'
      : trajectory.engagementDirection === 'increasing'
        ? 'INCREASING'
        : 'STABLE';
  lines.push(`- Engagement: ${engagementEmoji} (over ${trajectory.turnCount} turns)`);

  // Score trajectory
  if (trajectory.scoreTrajectory.length >= 2) {
    const scores = trajectory.scoreTrajectory.map((s) => s.toFixed(0)).join(' → ');
    lines.push(`- Score trajectory: ${scores}`);
    lines.push(`- Prior approach effective: ${trajectory.priorApproachEffective ? 'YES' : 'NO'}`);
  }

  // Resistance
  if (trajectory.resistanceType) {
    const strengthLabel = ['none', 'mild', 'moderate', 'strong'][trajectory.resistanceStrength] || 'unknown';
    lines.push(`- Resistance detected: ${trajectory.resistanceType} (${strengthLabel})`);
  }

  // Specific signals
  if (trajectory.repeatedConfusion) {
    lines.push(`- WARNING: Learner expressed confusion in consecutive turns — prior explanation did not land`);
  }

  if (trajectory.questionDiversity < 0.3 && trajectory.turnCount >= 3) {
    lines.push(`- WARNING: Learner questions show low diversity — they may be stuck on the same concept`);
  }

  return lines.join('\n');
}

/**
 * Format a previous turn for inclusion in context
 */
function formatTurnForContext(turn) {
  const lines = [];
  lines.push(`\n**Turn ${turn.turnIndex + 1}** (${turn.turnId})`);

  if (turn.suggestion) {
    lines.push(`- Tutor responded: "${turn.suggestion.message || turn.suggestion.title || ''}"`);
    if (turn.suggestion.actionTarget) {
      lines.push(`  - Action: ${turn.suggestion.action} → ${turn.suggestion.actionTarget}`);
    }
  }

  if (turn.learnerAction) {
    lines.push(`- Learner response: ${turn.learnerAction}`);
    if (turn.learnerMessage) {
      lines.push(`  - Message: "${turn.learnerMessage}"`);
    }
  }

  return lines.join('\n');
}

/**
 * Format a suggestion for inclusion in conversation context
 */
function _formatSuggestionForContext(suggestion) {
  const lines = [];

  if (suggestion.title) {
    lines.push(`**Title**: ${suggestion.title}`);
  }
  if (suggestion.message) {
    lines.push(`**Message**: ${suggestion.message}`);
  }
  if (suggestion.action && suggestion.actionTarget) {
    lines.push(`**Suggested Action**: ${suggestion.action} → ${suggestion.actionTarget}`);
  }
  // Note: reasoning intentionally excluded — it's internal justification that
  // inflates context without helping the model generate the next suggestion.
  // Title + message + action are sufficient for conversational continuity.

  return lines.join('\n');
}

/**
 * Format learner action for context
 */
function formatLearnerAction(turn) {
  const action = turn.learner_action;
  const details = turn.action_details || {};
  const lines = [];

  switch (action) {
    case 'followed_suggestion':
      lines.push(`Learner **followed** the suggestion`);
      if (details.action_taken) {
        lines.push(`- Action: ${details.action_taken}`);
      }
      break;

    case 'ignored_suggestion':
      lines.push(`Learner **did not follow** the suggestion`);
      if (details.explicit_rejection) {
        lines.push(`- Explicitly rejected`);
      }
      break;

    case 'asked_followup':
      lines.push(`Learner **asked a follow-up question**`);
      break;

    case 'reported_confusion':
      lines.push(`Learner **reported confusion**`);
      break;

    case 'completed_activity':
      lines.push(`Learner **completed an activity**`);
      if (details.activity_id) {
        lines.push(`- Activity: ${details.activity_id}`);
      }
      if (details.success !== undefined) {
        lines.push(`- Success: ${details.success}`);
      }
      if (details.score !== undefined) {
        lines.push(`- Score: ${details.score}%`);
      }
      break;

    default:
      lines.push(`Learner action: ${action}`);
  }

  if (details.message) {
    lines.push(`\n**Learner said**: "${details.message}"`);
  }

  return lines.join('\n');
}

/**
 * Format learner action for transcript display (cleaner format for CLI)
 */
function formatLearnerActionForTranscript(turn) {
  const action = turn.learner_action;
  const details = turn.action_details || {};
  const lines = [];

  const actionLabels = {
    followed_suggestion: '✓ Followed suggestion',
    ignored_suggestion: '✗ Ignored suggestion',
    asked_followup: '❓ Asked follow-up question',
    reported_confusion: '😕 Reported confusion',
    completed_activity: '✅ Completed activity',
    navigated_away: '🔄 Navigated away',
    requested_hint: '💡 Requested hint',
  };

  lines.push(actionLabels[action] || `Action: ${action}`);

  if (details.action_taken) {
    lines.push(`  → ${details.action_taken}`);
  }
  if (details.activity_id) {
    lines.push(`  Activity: ${details.activity_id}`);
  }
  if (details.success !== undefined) {
    lines.push(`  Success: ${details.success ? 'Yes' : 'No'}`);
  }
  if (details.score !== undefined) {
    lines.push(`  Score: ${details.score}%`);
  }

  if (details.message) {
    lines.push(`\n  "${details.message}"`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Shared generation + evaluation helper
// ---------------------------------------------------------------------------

/**
 * Generate a tutor suggestion and evaluate it with the rubric.
 *
 * This is the single code path used by BOTH single-turn and multi-turn
 * evaluations. It encapsulates:
 *   1. retryWithBackoff → tutorApi.generateSuggestions
 *   2. rubricEvaluator.quickValidate
 *   3. rubricEvaluator.evaluateSuggestion (unless skipped)
 *
 * @param {Object} context - The learner context object (from tutorApi.buildContext)
 * @param {Object} resolvedConfig - Resolved config with provider, model, egoModel, etc.
 * @param {Object} turnMeta - Turn-level metadata for evaluation
 * @param {string} turnMeta.scenarioName - Human-readable scenario name
 * @param {string} turnMeta.description - Description for the rubric judge
 * @param {string} turnMeta.expectedBehavior - Expected tutor behavior
 * @param {string} turnMeta.learnerContext - Raw learner context string (for rubric)
 * @param {string[]} turnMeta.requiredElements - Required elements for validation
 * @param {string[]} turnMeta.forbiddenElements - Forbidden elements for validation
 * @param {Object} options - Evaluation options
 * @param {boolean} options.skipRubricEval
 * @param {string} options.outputSize
 * @param {string} options.superegoStrategy
 * @param {string} options.judgeOverride
 * @param {string} options.judgeCli
 * @param {string} options.judgeCliModel
 * @param {boolean} options.useDialogue
 * @param {number} options.maxRounds
 * @param {Function} options.log
 * @param {string} options.scenarioId - Used for debug logging
 * @returns {Promise<Object>} { genResult, suggestion, validation, rubricResult, turnScore }
 */
async function generateAndEvaluateTurn(context, resolvedConfig, turnMeta, options = {}) {
  const {
    skipRubricEval = false,
    outputSize = 'normal',
    superegoStrategy = null,
    judgeOverride = null,
    judgeCli = null,
    judgeCliModel = null,
    useDialogue = false,
    maxRounds = 0,
    log = () => {},
    scenarioId = '',
    systemPromptExtension = null,
    superegoPromptExtension = null, // Dynamic disposition adjustments for superego
    learnerId = null, // For Writing Pad memory persistence
    dialecticalNegotiation = false, // Phase 2: AI-powered dialectical struggle
    behavioralOverrides = null, // Quantitative params from superego self-reflection
    dryRun = false,
    captureApiPayloads = process.env.EVAL_CAPTURE_API_PAYLOADS !== 'false',
    conversationMode = 'single-prompt', // 'messages' for multi-turn message chains
    showMessages = false, // true for truncated, 'full' for untruncated API message display
  } = options;

  // Dry-run mode: return canned results without any API calls
  if (dryRun) {
    log('[dry-run] Generating mock suggestions (no API call)', 'info');
    const genResult = mockGenerateResult(resolvedConfig, turnMeta);
    const suggestion = genResult.suggestions?.[0];
    const validation = suggestion
      ? rubricEvaluator.quickValidate(suggestion, {
          requiredElements: turnMeta.requiredElements,
          requiredElementsAny: turnMeta.requiredElementsAny,
          forbiddenElements: turnMeta.forbiddenElements,
        })
      : { passesRequired: false, passesForbidden: true, requiredMissing: ['No suggestions generated'] };

    let rubricResult = null;
    let turnScore = null;
    let scoringMethod = 'skipped';
    if (!skipRubricEval && suggestion) {
      log('[dry-run] Generating mock judge scores (no API call)', 'info');
      rubricResult = mockJudgeResult(resolvedConfig, scenarioId + Date.now());
      turnScore = rubricResult.overallScore;
      scoringMethod = 'rubric';
    }

    return { genResult, suggestion, validation, rubricResult, turnScore, scoringMethod };
  }

  // Generate suggestions via tutor API with retry logic
  // Note: retryWithBackoff handles thrown errors, but tutorApi.generateSuggestions()
  // catches its own errors and returns { success: false }. We need to also handle
  // 429 rate limit errors returned in the result (not thrown).
  const { result: genResultRaw, records: capturedApiRecords } = await captureApiCalls(
    () =>
      retryWithBackoff(
        async () => {
          const result = await tutorApi.generateSuggestions(context, {
            provider: resolvedConfig.provider,
            model: resolvedConfig.model,
            egoModel: resolvedConfig.egoModel,
            superegoModel: resolvedConfig.superegoModel || null,
            disableSuperego: resolvedConfig.disableSuperego || false,
            profileName: resolvedConfig.profileName,
            hyperparameters: resolvedConfig.hyperparameters || {},
            trace: true,
            superegoStrategy,
            outputSize,
            useDialogue,
            maxRounds,
            systemPromptExtension,
            superegoPromptExtension, // Dynamic disposition adjustments for superego
            learnerId, // Activates Writing Pad three-layer memory
            dialecticalNegotiation, // Phase 2: AI-powered dialectical struggle
            behavioralOverrides, // Quantitative params from superego self-reflection
            conversationMode, // 'messages' for multi-turn message chains
          });
          // Re-throw 429 errors so retryWithBackoff can handle them
          if (
            !result.success &&
            result.error &&
            (result.error.includes('429') || result.error.toLowerCase().includes('rate limit'))
          ) {
            throw new Error(result.error);
          }
          return result;
        },
        { log },
      ),
    { enabled: captureApiPayloads || Boolean(showMessages) },
  );

  const genResult = genResultRaw;

  // Display API messages if --show-messages is active
  if (showMessages && Array.isArray(capturedApiRecords) && capturedApiRecords.length > 0) {
    formatApiMessages(capturedApiRecords, { showMessages });
  }
  if (captureApiPayloads && Array.isArray(genResult?.dialogueTrace) && genResult.dialogueTrace.length > 0) {
    genResult.dialogueTrace = attachApiPayloadsToTrace(genResult.dialogueTrace, capturedApiRecords);
  }

  if (!genResult.success) {
    log(`Generation failed: ${genResult.error}`, 'error');
    return { genResult, suggestion: null, validation: null, rubricResult: null, turnScore: null };
  }

  const suggestionCount = genResult.suggestions?.length || 0;
  log(`Generated ${suggestionCount} suggestion(s) in ${genResult.metadata?.latencyMs}ms`, 'success');

  if (genResult.metadata?.dialogueRounds) {
    log(`Dialogue rounds: ${genResult.metadata.dialogueRounds}`, 'info');
  }

  // Quick validation (rule-based)
  log('Running validation checks...', 'info');
  const suggestion = genResult.suggestions?.[0];
  const validation = suggestion
    ? rubricEvaluator.quickValidate(suggestion, {
        requiredElements: turnMeta.requiredElements,
        requiredElementsAny: turnMeta.requiredElementsAny,
        forbiddenElements: turnMeta.forbiddenElements,
      })
    : { passesRequired: false, passesForbidden: true, requiredMissing: ['No suggestions generated'] };

  log(
    `Validation: required=${validation.passesRequired ? 'PASS' : 'FAIL'}, forbidden=${validation.passesForbidden ? 'PASS' : 'FAIL'}`,
    validation.passesRequired && validation.passesForbidden ? 'success' : 'warning',
  );

  let rubricResult = null;
  if (!skipRubricEval && suggestion) {
    log('Running AI rubric evaluation...', 'info');
    debugLog(`[evaluationRunner] Running rubric evaluation for ${scenarioId}...`);

    // Build dialogue context for the judge (if available from multi-turn)
    const dialogueContext =
      options.conversationHistory || options.dialogueTrace || options.consolidatedTrace
        ? {
            conversationHistory: options.conversationHistory || null,
            dialogueTrace: options.dialogueTrace || null,
            consolidatedTrace: options.consolidatedTrace || null,
          }
        : null;

    rubricResult = await evaluateSuggestionWithSelectedJudge(
      suggestion,
      {
        name: turnMeta.scenarioName,
        description: turnMeta.description,
        expectedBehavior: turnMeta.expectedBehavior,
        learnerContext: turnMeta.learnerContext,
        requiredElements: turnMeta.requiredElements,
        forbiddenElements: turnMeta.forbiddenElements,
      },
      { dialogueContext },
      { judgeOverride, judgeCli, judgeCliModel },
    );

    if (rubricResult) {
      debugLog(
        `[evaluationRunner] Rubric result: success=${rubricResult.success}, ` +
          `overallScore=${rubricResult.overallScore}, ` +
          `scoresCount=${Object.keys(rubricResult.scores || {}).length}, ` +
          `error=${rubricResult.error || 'none'}`,
      );
      if (rubricResult.success) {
        log(`Rubric evaluation complete: score=${rubricResult.overallScore?.toFixed(1)}`, 'success');
      } else {
        log(`Rubric evaluation failed: ${rubricResult.error || 'unknown error'}`, 'error');
      }
    }
  } else if (skipRubricEval) {
    log('Skipping AI rubric evaluation (fast mode)', 'info');
  } else if (!suggestion) {
    log('Skipping rubric evaluation (no suggestion generated)', 'warning');
  }

  // Calculate turn score
  let turnScore = null;
  let scoringMethod = null;
  if (rubricResult?.success) {
    turnScore = rubricResult.overallScore;
    scoringMethod = 'rubric';
  } else if (suggestion && rubricResult && !rubricResult.success) {
    // Judge API failed — do NOT silently produce a synthetic score.
    // Store null so downstream aggregation excludes this data point.
    turnScore = null;
    scoringMethod = 'judge_failed';
    log(
      `WARNING: Judge evaluation failed for ${scenarioId}; score stored as null (was: ${(validation.passesRequired ? 50 : 0) + (validation.passesForbidden ? 50 : 0)} from keyword fallback). Error: ${rubricResult.error || 'unknown'}`,
      'warning',
    );
  } else if (suggestion && !rubricResult) {
    // Rubric evaluation was skipped (skipRubricEval=true) — no score available
    turnScore = null;
    scoringMethod = 'skipped';
  }

  return { genResult, suggestion, validation, rubricResult, turnScore, scoringMethod };
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
    targetConfigs = configurations;
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
        const result = await runSingleTest(scenario, config, {
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
        });

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

// ── Checkpoint helpers for mid-dialogue resume ──────────────────────────────

const CHECKPOINT_VERSION = 1;

function writeCheckpoint(runId, scenarioId, profileName, state) {
  const dir = path.join(CHECKPOINTS_DIR, runId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const safeName = `${profileName}--${scenarioId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filePath = path.join(dir, `${safeName}.json`);
  const payload = {
    version: CHECKPOINT_VERSION,
    runId,
    scenarioId,
    profileName,
    timestamp: new Date().toISOString(),
    ...state,
  };
  fs.writeFileSync(filePath, JSON.stringify(payload));
  return filePath;
}

function loadCheckpoint(runId, scenarioId, profileName) {
  const safeName = `${profileName}--${scenarioId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filePath = path.join(CHECKPOINTS_DIR, runId, `${safeName}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function deleteCheckpoint(runId, scenarioId, profileName) {
  const safeName = `${profileName}--${scenarioId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dir = path.join(CHECKPOINTS_DIR, runId);
  const filePath = path.join(dir, `${safeName}.json`);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
  } catch {
    /* best-effort cleanup */
  }
}

function listCheckpoints(runId) {
  const dir = path.join(CHECKPOINTS_DIR, runId);
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const checkpoints = [];
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
      if (data.version === CHECKPOINT_VERSION) checkpoints.push(data);
    } catch {
      /* skip corrupt */
    }
  }
  return checkpoints;
}

/**
 * Run a single test (scenario + config combination)
 * Handles both single-turn and multi-turn scenarios
 */
async function runSingleTest(scenario, config, options = {}) {
  const {
    _skipRubricEval = false,
    _outputSize = 'normal',
    verbose = false,
    onLog,
    _superegoStrategy = null,
    judgeOverride = null,
    judgeCli = null,
    judgeCliModel = null,
    _dryRun = false,
    checkpointState = null,
  } = options;

  // Create a log function that calls both console and onLog callback
  const log = (message, level = 'info') => {
    if (verbose) console.log(message);
    if (onLog) onLog(message, level);
  };

  const fullScenario = evalConfigLoader.getScenario(scenario.id);
  if (!fullScenario) {
    throw new Error(`Scenario not found: ${scenario.id}`);
  }

  log(`Running scenario: ${scenario.name}`, 'info');

  // Check if this is a multi-turn scenario
  const isMultiTurn = evalConfigLoader.isMultiTurnScenario(scenario.id);

  if (isMultiTurn) {
    log('Detected multi-turn scenario', 'info');
    return runMultiTurnTest(scenario, config, fullScenario, {
      ...options,
      log,
      judgeOverride,
      judgeCli,
      judgeCliModel,
      checkpointState,
      liveApiReporter: options.liveApiReporter,
    });
  }

  // Single-turn evaluation (original logic)
  return runSingleTurnTest(scenario, config, fullScenario, { ...options, log, judgeOverride, judgeCli, judgeCliModel });
}

/**
 * Run a single-turn test
 */
async function runSingleTurnTest(scenario, config, fullScenario, options = {}) {
  const {
    skipRubricEval = false,
    outputSize = 'normal',
    _verbose = false,
    log = () => {},
    superegoStrategy = null,
    judgeOverride = null,
    judgeCli = null,
    judgeCliModel = null,
    dryRun = false,
    showMessages = false,
  } = options;

  // Resolve model aliases through eval's providers.yaml
  const resolvedConfig = resolveConfigModels(config);

  // Build context with optional curriculum content
  log('Building learner context...', 'info');
  const curriculumContext = contentResolver.isConfigured()
    ? contentResolver.buildCurriculumContext(contentResolver.resolveScenarioContent(fullScenario))
    : null;
  if (curriculumContext) {
    log(`Curriculum context loaded (${curriculumContext.length} chars)`, 'info');
  }
  const structuredLearnerContext = structureLearnerContext(fullScenario.learner_context);
  const context = tutorApi.buildContext(structuredLearnerContext, curriculumContext);
  context.isNewUser = fullScenario.is_new_user;

  // Resolve profile: extract dialogue/recognition settings and remap to tutor-core profile.
  const profileResolution = resolveEvalProfile(resolvedConfig.profileName);
  const { useDialogue, maxRounds, recognitionMode } = profileResolution;
  resolvedConfig.profileName = profileResolution.resolvedProfileName;

  // P1c Provenance: snapshot the fully-resolved config
  const configHash = computeConfigHash(resolvedConfig);

  // P2 Provenance: prompt version metadata
  const promptVersions = collectPromptVersions(config.profileName, resolvedConfig);

  // Log config info
  log(
    `Generating suggestions with profile: ${resolvedConfig.profileName} (dialogue=${useDialogue}, rounds=${maxRounds}, recognition=${recognitionMode})`,
    'info',
  );
  log(
    `Provider: ${resolvedConfig.provider || 'from profile'}, Model: ${resolvedConfig.model || 'from profile'}`,
    'info',
  );
  if (resolvedConfig.egoModel) {
    const egoLabel =
      typeof resolvedConfig.egoModel === 'object'
        ? `${resolvedConfig.egoModel.provider}.${resolvedConfig.egoModel.model}`
        : resolvedConfig.egoModel;
    log(`Ego model override: ${egoLabel}`, 'info');
  }

  // Use shared generation + evaluation helper
  const {
    genResult,
    _suggestion,
    validation,
    rubricResult,
    turnScore: tutorFirstTurnScore,
    scoringMethod,
  } = await generateAndEvaluateTurn(
    context,
    resolvedConfig,
    {
      scenarioName: fullScenario.name,
      description: fullScenario.description,
      expectedBehavior: fullScenario.expected_behavior,
      learnerContext: fullScenario.learner_context,
      requiredElements: fullScenario.required_elements,
      requiredElementsAny: fullScenario.required_elements_any,
      forbiddenElements: fullScenario.forbidden_elements,
    },
    {
      skipRubricEval,
      outputSize,
      superegoStrategy,
      judgeOverride,
      judgeCli,
      judgeCliModel,
      useDialogue,
      maxRounds,
      log,
      scenarioId: scenario.id,
      dryRun,
      showMessages,
    },
  );

  if (!genResult.success) {
    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      scenarioType: fullScenario.type || 'suggestion',
      provider: resolvedConfig.provider || genResult.metadata?.provider,
      model: resolvedConfig.model || genResult.metadata?.model,
      profileName: config.profileName,
      egoModel: resolvedConfig.egoModel ? `${resolvedConfig.egoModel.provider}.${resolvedConfig.egoModel.model}` : null,
      superegoModel: resolvedConfig.superegoModel
        ? `${resolvedConfig.superegoModel.provider}.${resolvedConfig.superegoModel.model}`
        : null,
      success: false,
      errorMessage: genResult.error,
      latencyMs: genResult.metadata?.latencyMs,
      conversationMode: null,
    };
  }

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    scenarioType: fullScenario.type || 'suggestion',
    provider: resolvedConfig.provider || genResult.metadata?.provider,
    model: resolvedConfig.model || genResult.metadata?.model,
    profileName: config.profileName,
    egoModel: resolvedConfig.egoModel ? `${resolvedConfig.egoModel.provider}.${resolvedConfig.egoModel.model}` : null,
    superegoModel: resolvedConfig.superegoModel
      ? `${resolvedConfig.superegoModel.provider}.${resolvedConfig.superegoModel.model}`
      : null,
    hyperparameters: resolvedConfig.hyperparameters || config.hyperparameters,
    suggestions: genResult.suggestions,
    success: true,
    latencyMs: genResult.metadata?.latencyMs,
    inputTokens: genResult.metadata?.inputTokens,
    outputTokens: genResult.metadata?.outputTokens,
    dialogueRounds: 1,
    deliberationRounds: genResult.metadata?.dialogueRounds || 0,
    apiCalls: genResult.metadata?.apiCalls,
    cost: genResult.metadata?.totalCost,
    dialogueId: genResult.metadata?.dialogueId,
    conversationMode: null,
    scores: flattenNumericScores(rubricResult?.scores),
    scoresWithReasoning:
      rubricResult?.scores && Object.keys(rubricResult.scores).length > 0 ? rubricResult.scores : null,
    tutorFirstTurnScore,
    scoringMethod,
    baseScore: rubricResult?.baseScore ?? null,
    recognitionScore: rubricResult?.recognitionScore ?? null,
    passesRequired: rubricResult?.passesRequired ?? validation.passesRequired,
    passesForbidden: rubricResult?.passesForbidden ?? validation.passesForbidden,
    requiredMissing: rubricResult?.requiredMissing || validation.requiredMissing,
    forbiddenFound: rubricResult?.forbiddenFound || validation.forbiddenFound,
    judgeModel: rubricResult?.judgeModel,
    evaluationReasoning: rubricResult?.summary,
    factors: resolvedConfig.factors || null,
    learnerArchitecture: resolvedConfig.learnerArchitecture || null,
    configHash,
    ...promptVersions,
    dialogueResult: {
      dialogueTrace: genResult.dialogueTrace,
      dialogueRounds: genResult.metadata?.dialogueRounds,
      converged: genResult.metadata?.converged,
      dialogueId: genResult.metadata?.dialogueId,
    },
  };
}

/**
 * Run a multi-turn test as an iterative loop.
 *
 * Each turn goes through the SAME generateAndEvaluateTurn() code path as
 * single-turn, with accumulated conversation context between turns.
 * This eliminates the separate multiTurnRunner orchestration.
 */
async function runMultiTurnTest(scenario, config, fullScenario, options = {}) {
  const {
    skipRubricEval = false,
    outputSize = 'normal',
    _verbose = false,
    log = () => {},
    superegoStrategy = null,
    judgeOverride = null,
    judgeCli = null,
    judgeCliModel = null,
    dryRun = false,
    transcriptMode = false,
    runId = null,
    runNum = 0,
    showMessages = false,
    checkpointState = null,
    liveApiReporter: liveReporter = null,
  } = options;

  log(`[evaluationRunner] Running multi-turn scenario: ${scenario.id}`);

  // 1. Resolve config (models, profile) — same as single-turn
  const resolvedConfig = resolveConfigModels(config);
  const profileResolution = resolveEvalProfile(resolvedConfig.profileName);
  const { useDialogue, maxRounds } = profileResolution;
  resolvedConfig.profileName = profileResolution.resolvedProfileName;

  // P1c Provenance: snapshot the fully-resolved config
  const configHash = computeConfigHash(resolvedConfig);

  // P2 Provenance: prompt version metadata
  const promptVersions = collectPromptVersions(config.profileName, resolvedConfig);

  // 2. Build curriculum context — same as single-turn
  const curriculumContext = contentResolver.isConfigured()
    ? contentResolver.buildCurriculumContext(contentResolver.resolveScenarioContent(fullScenario))
    : null;

  // 3. Generate dialogue ID for the session (or restore from checkpoint)
  const dialogueId = checkpointState?.dialogueId || `dialogue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  dialogueEngine.setCurrentDialogueId(dialogueId);

  // Generate synthetic learnerId for Writing Pad persistence across turns (or restore)
  const learnerId =
    checkpointState?.learnerId || `eval-learner-${dialogueId}-${scenario.id.replace(/[^a-zA-Z0-9]/g, '')}`;
  if (checkpointState) {
    log(
      `[evaluationRunner] Resuming from checkpoint: turn ${checkpointState.lastCompletedTurn + 1} (dialogueId=${dialogueId})`,
      'info',
    );
  } else {
    log(`[evaluationRunner] Generated learnerId for Writing Pad: ${learnerId}`, 'info');
  }

  // Set up transcript file for incremental writing (tail -f friendly)
  let transcriptPath = null;
  if (transcriptMode) {
    const effectiveRunId = runId || 'live';
    const transcriptDir = path.join(TRANSCRIPTS_DIR, effectiveRunId);
    if (!fs.existsSync(transcriptDir)) fs.mkdirSync(transcriptDir, { recursive: true });
    const safeName = `${config.profileName}--${scenario.id}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    transcriptPath = path.join(transcriptDir, `${safeName}.txt`);
    // Write header
    const totalTurnCount = 1 + (fullScenario.turns || []).length;
    const header = `\n${(fullScenario.name || scenario.id).toUpperCase()} (${totalTurnCount}-turn)\n${config.profileName}\n${'─'.repeat(40)}\n\n`;
    fs.writeFileSync(transcriptPath, header);
    log(`[evaluationRunner] Transcript: ${transcriptPath}`, 'info');
  }

  // Initialize state variables — restore from checkpoint if resuming
  const cs = checkpointState; // alias for brevity

  // Deep-clone turns to prevent mutation of shared scenario objects across profiles.
  // On resume, restore the checkpointed turns (which include LLM-generated learner mutations).
  const turns = cs?.turns || JSON.parse(JSON.stringify(fullScenario.turns || []));
  const turnResults = cs?.turnResults || [];
  let totalLatencyMs = cs?.totalLatencyMs || 0;
  let totalInputTokens = cs?.totalInputTokens || 0;
  let totalOutputTokens = cs?.totalOutputTokens || 0;
  let totalApiCalls = cs?.totalApiCalls || 0;
  let totalCost = cs?.totalCost || 0;
  let totalDeliberationRounds = cs?.totalDeliberationRounds || 0;

  const conversationHistory = cs?.conversationHistory || [];
  let previousSuggestion = cs?.previousSuggestion || null;
  const consolidatedTrace = cs?.consolidatedTrace || [];
  const priorSuperegoAssessments = cs?.priorSuperegoAssessments || []; // Cross-turn superego memory

  // Helper: append new trace entries to transcript file and optionally console.
  // Always prints live chat-style lines for public-facing messages (User/Assistant).
  // --transcript mode additionally writes play-format to file + compact console lines.
  // On resume, skip entries already flushed in the previous session.
  let lastTranscriptIdx = cs ? consolidatedTrace.length : 0;
  const isEgoSuperegoLearner = resolvedConfig.learnerArchitecture?.includes('ego_superego');
  // isLLMLearner is set after conversationMode is resolved (below). All closures
  // that reference it (flushTranscript, formatChatLine) are called lazily.
  let isLLMLearner = isEgoSuperegoLearner; // provisional; updated after conversationMode
  const printedLearnerTurns = new Set(); // dedup: track which learner turns have been printed

  // Build a compact tag for live output: "cell_82_messages_base_multi_unified · misconception_correction_flow #1"
  const chatTag = chalk.dim(`[${config.profileName} · ${scenario.id} #${runNum + 1}]`);
  let chatBannerPrinted = false;

  function flushTranscript() {
    const newEntries = consolidatedTrace.slice(lastTranscriptIdx);
    if (newEntries.length === 0) return;
    lastTranscriptIdx = consolidatedTrace.length;

    // --- Always: print live chat lines for public-facing messages ---
    for (const entry of newEntries) {
      const chatLine = formatChatLine(entry, isLLMLearner, printedLearnerTurns);
      if (chatLine) {
        if (!chatBannerPrinted) {
          console.log('\n' + chalk.dim('─'.repeat(70)));
          console.log(chatTag);
          console.log(chalk.dim('─'.repeat(70)));
          chatBannerPrinted = true;
        }
        console.log(chatLine);
      }
    }

    // --- --transcript only: write play-format file + compact console lines ---
    if (transcriptMode && transcriptPath) {
      const lines = [];
      for (const entry of newEntries) {
        const formatted = formatEntry(entry, { detail: 'play' });
        if (formatted) lines.push(formatted + '\n');
        const compactLine = formatCompactLine(entry);
        if (compactLine) console.log(compactLine);
      }
      if (lines.length > 0) {
        fs.appendFileSync(transcriptPath, lines.join('\n'));
      }
    }
  }

  /**
   * Format a trace entry as a live chat line (User/Assistant/System).
   * Returns null for internal entries (superego reviews, reflections, etc.).
   */
  function formatChatLine(entry, isDynamic, printed) {
    const { agent, action } = entry;
    const ROLE_WIDTH = 11; // "Tutor      " padded width
    const pad = (label) => label.padEnd(ROLE_WIDTH);
    // Compact inline tag: [cell_82 · misconception #1]
    const inlineTag = ' ' + chalk.dim(`[${config.profileName} · ${scenario.id} #${runNum + 1}]`);

    // --- Learner messages ---
    // final_output: synthesized message from any LLM learner (ego_superego or unified)
    // turn_action: scripted learner action (single-prompt unified) — fallback for messages-mode too
    // Both use the same turnKey for deduplication, so whichever appears first wins.
    if ((agent === 'learner' || agent === 'user') && (action === 'final_output' || action === 'turn_action')) {
      const turnKey = `learner-${entry.turnIndex}`;
      if (printed.has(turnKey)) return null;
      printed.add(turnKey);
      const text = (entry.detail || entry.contextSummary || '').substring(0, 500);
      if (!text) return null;
      return (
        '\n' +
        chalk.green.bold(pad('Learner')) +
        inlineTag +
        '\n' +
        ' '.repeat(ROLE_WIDTH) +
        wrapChatText(text, ROLE_WIDTH)
      );
    }

    // --- Tutor messages ---
    // Revised output (final after superego review) or generate_final (legacy)
    if (agent === 'ego' && (action === 'revise' || action === 'generate_final')) {
      return formatTutorLine(entry, ROLE_WIDTH, pad, inlineTag);
    }
    // Generate without revision (single-agent or superego approved first draft)
    if (agent === 'ego' && action === 'generate') {
      // Check if a revision follows in the remaining new entries — if so, skip this draft
      const laterInTrace = consolidatedTrace.slice(consolidatedTrace.indexOf(entry) + 1);
      const hasRevision = laterInTrace.some(
        (e) =>
          e.turnIndex === entry.turnIndex &&
          e.agent === 'ego' &&
          (e.action === 'revise' || e.action === 'generate_final'),
      );
      if (hasRevision) return null;
      return formatTutorLine(entry, ROLE_WIDTH, pad, inlineTag);
    }

    return null;
  }

  function formatTutorLine(entry, roleWidth, pad, inlineTag) {
    const msg = (entry.suggestions || [])
      .map((s) => s.message || s.title || '')
      .join('\n\n')
      .substring(0, 500);
    if (!msg) return null;
    // Metadata line: model · latency · tokens
    const m = entry.metrics || {};
    const metaParts = [];
    if (m.model) {
      const name = m.model.includes('/') ? m.model.split('/').pop() : m.model;
      metaParts.push(name.split(':')[0].substring(0, 22));
    }
    if (m.latencyMs != null)
      metaParts.push(m.latencyMs < 1000 ? `${m.latencyMs}ms` : `${(m.latencyMs / 1000).toFixed(1)}s`);
    if (m.inputTokens != null || m.outputTokens != null)
      metaParts.push(`${m.inputTokens ?? '?'}→${m.outputTokens ?? '?'}`);
    const metaStr = metaParts.length > 0 ? '\n' + ' '.repeat(roleWidth) + chalk.dim(metaParts.join(' · ')) : '';
    return (
      '\n' +
      chalk.cyan.bold(pad('Tutor')) +
      inlineTag +
      '\n' +
      ' '.repeat(roleWidth) +
      wrapChatText(msg, roleWidth) +
      metaStr
    );
  }

  /** Word-wrap text with continuation-line indentation matching role label width. */
  function wrapChatText(text, indent) {
    const maxWidth = 90;
    const lines = text.split('\n');
    const result = [];
    for (const line of lines) {
      if (line.trim() === '') {
        result.push('');
        continue;
      }
      const words = line.split(/\s+/);
      let current = '';
      for (const word of words) {
        if (current.length + word.length + 1 > maxWidth - indent && current.length > 0) {
          result.push(current);
          current = ' '.repeat(indent) + word;
        } else {
          current = current ? current + ' ' + word : word;
        }
      }
      if (current) result.push(current);
    }
    return result.join('\n');
  }

  // Check profile-level feature flags
  const rawProfile = evalConfigLoader.loadTutorAgents()?.profiles?.[config.profileName];

  // Apply CLI model override to rawProfile so prompt rewriter calls use the correct model.
  // Without this, --model/--ego-model only affects tutor-core's generateSuggestions,
  // while promptRewriter functions (self-reflection, profiling, etc.) still use the YAML model.
  if (config.modelOverride || config.egoModelOverride) {
    const overrideModel = config.egoModelOverride || config.modelOverride;
    try {
      const r = evalConfigLoader.resolveModel(overrideModel);
      if (rawProfile?.ego) {
        rawProfile.ego = { ...rawProfile.ego, provider: r.provider, model: r.model };
      }
      // Also update top-level model for functions that read config.model
      if (rawProfile) rawProfile.model = r.model;
    } catch {
      /* leave rawProfile as-is if resolution fails */
    }
  }
  if (config.modelOverride || config.superegoModelOverride) {
    const overrideModel = config.superegoModelOverride || config.modelOverride;
    try {
      const r = evalConfigLoader.resolveModel(overrideModel);
      if (rawProfile?.superego) {
        rawProfile.superego = { ...rawProfile.superego, provider: r.provider, model: r.model };
      }
    } catch {
      /* leave rawProfile as-is if resolution fails */
    }
  }

  const dialecticalNegotiation = rawProfile?.dialectical_negotiation ?? false;
  const promptRewritingEnabled = rawProfile?.prompt_rewriting?.enabled ?? false;
  const promptRewritingStrategy = rawProfile?.prompt_rewriting?.strategy ?? 'template';
  const superegoDispositionRewriting = rawProfile?.superego_disposition_rewriting ?? false;
  const quantitativeDispositionEnabled = rawProfile?.prompt_rewriting?.quantitative_disposition ?? false;
  const promptErosionEnabled = rawProfile?.prompt_rewriting?.prompt_erosion?.enabled ?? false;
  const intersubjectiveEnabled = rawProfile?.prompt_rewriting?.intersubjective ?? false;
  const otherEgoProfilingEnabled = rawProfile?.other_ego_profiling?.enabled ?? false;
  const otherEgoBidirectional = rawProfile?.other_ego_profiling?.bidirectional ?? false;
  const strategyPlanningEnabled = rawProfile?.other_ego_profiling?.strategy_planning ?? false;
  const conversationMode = rawProfile?.conversation_mode ?? 'single-prompt';

  // In messages mode, ALL learners are LLM-generated (unified uses single-agent path,
  // ego_superego uses deliberation chain). In single-prompt mode, only ego_superego
  // learners are LLM-generated; unified learners use YAML turn messages.
  isLLMLearner = isEgoSuperegoLearner || conversationMode === 'messages';

  const sharedTurnOptions = {
    skipRubricEval,
    outputSize,
    superegoStrategy,
    judgeOverride,
    judgeCli,
    judgeCliModel,
    useDialogue,
    maxRounds,
    log,
    scenarioId: scenario.id,
    learnerId,
    dialecticalNegotiation,
    dryRun,
    conversationMode,
    showMessages,
  };
  let sessionEvolution = cs?.sessionEvolution ?? null;
  let superegoEvolution = cs?.superegoEvolution ?? null;
  let behavioralOverrides = cs?.behavioralOverrides ?? null; // Parsed quantitative params from superego self-reflection
  let tutorProfileOfLearner = cs?.tutorProfileOfLearner ?? null; // Other-ego: tutor's mental model of learner
  let learnerProfileOfTutor = cs?.learnerProfileOfTutor ?? null; // Other-ego: learner's mental model of tutor
  let strategyPlan = cs?.strategyPlan ?? null; // Other-ego: ego's explicit strategy plan

  // Per-dialogue rejection budget: limits total superego rejections across all turns
  // to prevent worst-case cascade (e.g., 3 rejections × 5 turns = 15 total)
  const rejectionBudget = rawProfile?.dialogue?.rejection_budget ?? null; // null = unlimited (backwards-compatible)
  let totalRejections = cs?.totalRejections ?? 0;

  // 4. Loop through turns (initial turn 0 + follow-up turns)
  const totalTurnCount = 1 + turns.length;
  const startTurnIdx = cs ? cs.lastCompletedTurn + 1 : 0;
  if (cs) {
    log(
      `[evaluationRunner] Checkpoint: resuming from turn ${startTurnIdx}/${totalTurnCount - 1} (${turnResults.length} turns already completed)`,
      'info',
    );
  }

  // Print live chat System context at dialogue start (shows the learner scenario)
  if (startTurnIdx === 0) {
    const systemText = fullScenario.learner_context || fullScenario.description || '';
    if (systemText) {
      const truncated = systemText.length > 300 ? systemText.substring(0, 297) + '...' : systemText;
      console.log('\n' + chalk.dim('─'.repeat(60)));
      console.log(chalk.gray.bold('System'.padEnd(11)) + chalk.dim(truncated.replace(/\n/g, '\n' + ' '.repeat(11))));
    }
  }

  for (let turnIdx = startTurnIdx; turnIdx < totalTurnCount; turnIdx++) {
    // Update live reporter with current turn index
    if (liveReporter) liveReporter.setTurnIdx(turnIdx);

    const isInitialTurn = turnIdx === 0;
    const turnDef = isInitialTurn ? null : turns[turnIdx - 1];

    log(
      `[evaluationRunner] Turn ${turnIdx}/${totalTurnCount - 1}${isInitialTurn ? ' (initial)' : ` (${turnDef.id})`}`,
      'info',
    );

    // Update run metadata with current turn progress for `runs` command
    if (runId) {
      evaluationStore.updateRun(runId, {
        metadata: {
          turnProgress: {
            current: turnIdx + 1,
            total: totalTurnCount,
            scenarioId: scenario.id,
          },
        },
      });
    }

    // Show learner action in transcript mode (for follow-up turns)
    // Skip for LLM learner — the LLM-generated response replaces the YAML action
    if (!isInitialTurn && dialogueEngine.isTranscriptMode() && !isLLMLearner) {
      dialogueEngine.transcript('LEARNER ACTION', formatLearnerActionForTranscript(turnDef));
    }

    // Build context for this turn
    let contextStr;
    if (isInitialTurn) {
      contextStr = fullScenario.learner_context;
    } else {
      // Add previous turn to conversation history
      // For LLM learner, omit the YAML learner_action — the LLM message is the action
      conversationHistory.push({
        turnIndex: turnIdx - 1,
        turnId: turnIdx === 1 ? 'initial' : turns[turnIdx - 2]?.id,
        suggestion: previousSuggestion,
        learnerAction: isLLMLearner ? undefined : turnDef.learner_action,
        learnerMessage: turnDef.action_details?.message,
      });

      // Build learner trajectory assessment from accumulated turn data
      const learnerTrajectory = analyzeLearnerTrajectory(turnResults, conversationHistory);

      contextStr = buildMultiTurnContext({
        originalContext: fullScenario.learner_context,
        conversationHistory,
        currentTurn: turnDef,
        previousSuggestion,
        priorSuperegoAssessments,
        learnerTrajectory,
        conversationMode,
      });
    }

    const structuredContextStr = structureLearnerContext(contextStr);
    // Build message chain for message mode (from accumulated conversation history)
    const turnMessageHistory =
      conversationMode === 'messages' && conversationHistory.length > 0 ? buildMessageChain(conversationHistory) : null;
    const context = tutorApi.buildContext(structuredContextStr, curriculumContext, null, turnMessageHistory);
    context.isNewUser = isInitialTurn ? fullScenario.is_new_user : false;

    // Build turn-specific rubric metadata
    const turnMeta = {
      scenarioName: isInitialTurn ? fullScenario.name : `${fullScenario.name} - Turn ${turnIdx}`,
      description: isInitialTurn
        ? fullScenario.description
        : isLLMLearner
          ? `Turn ${turnIdx}: LLM learner response`
          : `Turn: ${turnDef.learner_action}`,
      expectedBehavior: isInitialTurn ? fullScenario.expected_behavior : turnDef.expected_behavior,
      learnerContext: contextStr,
      requiredElements: isInitialTurn ? fullScenario.required_elements || [] : turnDef.required_elements || [],
      requiredElementsAny: isInitialTurn
        ? fullScenario.required_elements_any || []
        : turnDef.required_elements_any || [],
      forbiddenElements: isInitialTurn ? fullScenario.forbidden_elements || [] : turnDef.forbidden_elements || [],
    };

    // Build the ego prompt extension: erosion frame + session evolution (reflections)
    let fullEgoExtension = sessionEvolution;
    if (promptErosionEnabled && turnIdx > 0) {
      const erosionFrame = promptRewriter.buildPromptErosionFrame(turnIdx, rawProfile);
      if (erosionFrame) {
        // Erosion frame goes BEFORE reflections, so the model sees authority calibration first
        fullEgoExtension = erosionFrame + (sessionEvolution ? '\n\n' + sessionEvolution : '');
        log(
          `[evaluationRunner] Prompt erosion frame applied for turn ${turnIdx} (rate=${rawProfile.prompt_rewriting?.prompt_erosion?.rate ?? 0.2})`,
          'info',
        );
      }
    }

    // Append other-ego profile and strategy plan to ego extension
    // Injection order: erosion frame → self-reflection → other-ego profile → strategy plan
    if (otherEgoProfilingEnabled && tutorProfileOfLearner) {
      const profileBlock = promptRewriter.formatProfileForInjection(tutorProfileOfLearner, 'learner');
      fullEgoExtension = (fullEgoExtension ? fullEgoExtension + '\n\n' : '') + profileBlock;
    }
    if (strategyPlanningEnabled && strategyPlan) {
      fullEgoExtension = (fullEgoExtension ? fullEgoExtension + '\n\n' : '') + strategyPlan;
    }

    // Build the superego prompt extension: erosion frame + superego evolution (reflections)
    let fullSuperegoExtension = superegoEvolution;
    if (promptErosionEnabled && turnIdx > 0 && superegoEvolution) {
      const erosionFrame = promptRewriter.buildPromptErosionFrame(turnIdx, rawProfile);
      if (erosionFrame) {
        fullSuperegoExtension = erosionFrame + '\n\n' + superegoEvolution;
      }
    }

    // Call the SAME generation+evaluation code path as single-turn
    // Pass dialogue context so the judge can see the full exchange
    // When rejection budget is exhausted, also skip outer superego review loop (maxRounds: 0)
    const budgetExhausted = rejectionBudget !== null && totalRejections >= rejectionBudget;
    const turnOptions = {
      ...sharedTurnOptions,
      ...(fullEgoExtension ? { systemPromptExtension: fullEgoExtension } : {}),
      ...(fullSuperegoExtension ? { superegoPromptExtension: fullSuperegoExtension } : {}),
      ...(behavioralOverrides ? { behavioralOverrides } : {}),
      ...(budgetExhausted ? { maxRounds: 0 } : {}),
      conversationHistory: conversationHistory.length > 0 ? conversationHistory : null,
      consolidatedTrace: consolidatedTrace.length > 0 ? consolidatedTrace : null,
    };
    const { genResult, suggestion, validation, rubricResult, turnScore, scoringMethod } = await generateAndEvaluateTurn(
      context,
      resolvedConfig,
      turnMeta,
      turnOptions,
    );

    if (!genResult.success) {
      const turnId = isInitialTurn ? 'initial' : turnDef.id;
      throw new Error(
        `Multi-turn scenario ${scenario.id}: Turn ${turnIdx} (${turnId}) failed to generate suggestions: ${genResult.error || 'unknown error'}`,
      );
    }

    // Accumulate dialogue traces
    if (genResult.dialogueTrace && genResult.dialogueTrace.length > 0) {
      // Insert user turn action entry before each turn (except initial)
      // For dynamic learner (ego_superego), skip the scripted action label —
      // the learner's LLM-generated response is already in the trace via
      // learner_ego_initial / learner_superego / learner/final_output entries.
      if (!isInitialTurn && !isLLMLearner) {
        const histEntry = conversationHistory[conversationHistory.length - 1];
        consolidatedTrace.push({
          agent: 'learner',
          action: 'turn_action',
          turnIndex: turnIdx,
          contextSummary: histEntry?.learnerMessage || `${histEntry?.learnerAction || 'Action'}`,
          detail: `Learner: ${histEntry?.learnerAction}`,
          timestamp: new Date().toISOString(),
        });
      }
      consolidatedTrace.push(...genResult.dialogueTrace);

      // Attach inputMessages to tutor trace entries (symmetric with learner deliberation entries)
      for (let i = consolidatedTrace.length - genResult.dialogueTrace.length; i < consolidatedTrace.length; i++) {
        const entry = consolidatedTrace[i];
        if (
          entry.agent === 'ego' &&
          (entry.action === 'generate' || entry.action === 'revise' || entry.action === 'incorporate-feedback')
        ) {
          entry.inputMessages = turnMessageHistory || null;
        } else if (entry.agent === 'superego' && entry.action === 'review') {
          entry.inputMessages = null; // superego uses single-prompt, not message chains
        }
      }

      // Add final delivery marker for multi-agent mode
      const hasSuperego = genResult.dialogueTrace.some((entry) => entry.agent === 'superego');
      if (hasSuperego) {
        const suggCount = genResult.suggestions?.length || 0;
        consolidatedTrace.push({
          agent: 'tutor',
          action: 'final_output',
          turnIndex: turnIdx,
          from: 'ego',
          to: 'tutor',
          direction: 'response',
          suggestionCount: suggCount,
          contextSummary: `Delivered ${suggCount} suggestion${suggCount !== 1 ? 's' : ''}`,
          detail: `Turn ${turnIdx + 1} complete`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Flush transcript: ego/superego exchange for this turn
    flushTranscript();

    // Accumulate cross-turn superego memory from this turn's trace
    if (genResult.dialogueTrace && genResult.dialogueTrace.length > 0) {
      const assessment = extractTurnSuperegoAssessment(turnIdx, genResult.dialogueTrace);
      if (assessment) {
        priorSuperegoAssessments.push(assessment);
      }
    }

    // Track rejection budget across turns: count superego rejections in this turn's trace
    if (rejectionBudget !== null && genResult.dialogueTrace) {
      const turnRejections = genResult.dialogueTrace.filter(
        (entry) => entry.agent === 'superego' && entry.action === 'review' && entry.approved === false,
      ).length;
      totalRejections += turnRejections;

      if (totalRejections >= rejectionBudget) {
        // Budget exhausted: force approve-only mode for remaining turns
        behavioralOverrides = { ...(behavioralOverrides || {}), max_rejections: 0 };
        log(
          `[evaluationRunner] Rejection budget exhausted (${totalRejections}/${rejectionBudget}): forcing approve-only for remaining turns`,
          'info',
        );
        consolidatedTrace.push({
          agent: 'rejection_budget',
          action: 'exhausted',
          turnIndex: turnIdx,
          contextSummary: `Budget exhausted: ${totalRejections}/${rejectionBudget} rejections used`,
          detail: `Total rejections across ${turnIdx + 1} turns: ${totalRejections}. Remaining turns will auto-approve.`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Collect per-turn result
    turnResults.push({
      turnIndex: turnIdx,
      turnId: isInitialTurn ? 'initial' : turnDef.id,
      learnerAction: isInitialTurn || isLLMLearner ? undefined : turnDef.learner_action,
      learnerMessage: isInitialTurn ? undefined : turnDef.action_details?.message, // Include generated learner message for growth tracking
      expectedBehavior: turnMeta.expectedBehavior,
      suggestion,
      learnerDeliberation: turnDef?._learnerDeliberation || null,
      learnerEmotionalState: turnDef?._learnerEmotionalState || null,
      learnerMessageGenerated: !!turnDef?._learnerDeliberation,
      learnerOriginalMessage: turnDef?._originalMessage || null,
      scores: flattenNumericScores(rubricResult?.scores),
      scoresWithReasoning:
        rubricResult?.scores && Object.keys(rubricResult.scores).length > 0 ? rubricResult.scores : null,
      judgeModel: rubricResult?.judgeModel || null,
      evaluationReasoning: rubricResult?.summary || null,
      turnScore,
      scoringMethod,
      passesRequired: rubricResult?.passesRequired ?? validation.passesRequired,
      passesForbidden: rubricResult?.passesForbidden ?? validation.passesForbidden,
      requiredMissing: validation.requiredMissing,
      forbiddenFound: validation.forbiddenFound,
      minAcceptableScore: (!isInitialTurn ? turnDef.min_acceptable_score : null) || fullScenario.min_acceptable_score,
    });

    // Aggregate metrics
    totalLatencyMs += genResult.metadata?.latencyMs || 0;
    totalInputTokens += genResult.metadata?.inputTokens || 0;
    totalOutputTokens += genResult.metadata?.outputTokens || 0;
    totalApiCalls += genResult.metadata?.apiCalls || 0;
    totalCost += genResult.metadata?.totalCost || 0;
    totalDeliberationRounds += genResult.metadata?.dialogueRounds || 0;

    // Update for next iteration
    previousSuggestion = suggestion;

    // ── Between-turn processing ──────────────────────────────────────────
    // Parallelized into groups by dependency:
    //   Group 1 (independent): ego self-refl, superego self-refl, tutor profile, learner profile
    //   Group 2 (depends on group 1): intersubjective, quantitative parse, strategy plan
    //   Group 3 (depends on group 2): learner generation
    // This collapses ~6-8 sequential LLM calls into ~3 parallel rounds.

    if (turnIdx < totalTurnCount - 1) {
      const betweenTurnStart = Date.now();

      // ── Group 1: Independent LLM calls in parallel ──────────────────
      const group1Promises = [];
      const group1Labels = [];

      // Ego self-reflection / prompt rewriting
      if (promptRewritingEnabled) {
        if (promptRewritingStrategy === 'self_reflection') {
          group1Promises.push(
            promptRewriter
              .synthesizeEgoSelfReflection({
                turnResults,
                consolidatedTrace,
                conversationHistory,
                config: rawProfile,
              })
              .catch((error) => {
                log(
                  `[evaluationRunner] Ego self-reflection failed, will fall back to template: ${error.message}`,
                  'warn',
                );
                return null;
              }),
          );
          group1Labels.push('ego_self_reflection');
        } else if (promptRewritingStrategy === 'llm') {
          group1Promises.push(
            promptRewriter
              .synthesizeDirectivesLLM({
                turnResults,
                consolidatedTrace,
                conversationHistory,
                config: rawProfile,
              })
              .catch((error) => {
                log(`[evaluationRunner] LLM rewriter failed, will fall back to template: ${error.message}`, 'warn');
                return null;
              }),
          );
          group1Labels.push('llm_rewrite');
        }
      }

      // Superego self-reflection / disposition rewriting
      if (superegoDispositionRewriting) {
        if (promptRewritingStrategy === 'self_reflection') {
          group1Promises.push(
            promptRewriter
              .synthesizeSupergoSelfReflection({
                turnResults,
                consolidatedTrace,
                conversationHistory,
                priorSuperegoAssessments,
                config: rawProfile,
              })
              .catch((error) => {
                log(`[evaluationRunner] Superego self-reflection failed: ${error.message}`, 'warn');
                return null;
              }),
          );
          group1Labels.push('superego_self_reflection');
        } else {
          group1Promises.push(
            promptRewriter
              .synthesizeSuperegoDisposition({
                turnResults,
                consolidatedTrace,
                conversationHistory,
                priorSuperegoAssessments,
                config: rawProfile,
              })
              .catch((error) => {
                log(`[evaluationRunner] Superego disposition rewriting failed: ${error.message}`, 'warn');
                return null;
              }),
          );
          group1Labels.push('superego_disposition');
        }
      }

      // Tutor profiles learner (Theory of Mind)
      if (otherEgoProfilingEnabled) {
        group1Promises.push(
          promptRewriter
            .synthesizeTutorProfileOfLearner({
              turnResults,
              consolidatedTrace,
              conversationHistory,
              priorProfile: tutorProfileOfLearner,
              config: rawProfile,
            })
            .catch((error) => {
              log(`[evaluationRunner] Tutor profile of learner failed: ${error.message}`, 'warn');
              return null;
            }),
        );
        group1Labels.push('tutor_profile');
      }

      // Learner profiles tutor (bidirectional Theory of Mind)
      if (otherEgoProfilingEnabled && otherEgoBidirectional) {
        group1Promises.push(
          promptRewriter
            .synthesizeLearnerProfileOfTutor({
              turnResults,
              consolidatedTrace,
              conversationHistory,
              priorProfile: learnerProfileOfTutor,
              config: rawProfile,
            })
            .catch((error) => {
              log(`[evaluationRunner] Learner profile of tutor failed: ${error.message}`, 'warn');
              return null;
            }),
        );
        group1Labels.push('learner_profile');
      }

      // Fire all group 1 calls in parallel
      const group1Results = await Promise.all(group1Promises);
      const group1Map = {};
      group1Labels.forEach((label, i) => {
        group1Map[label] = group1Results[i];
      });

      // ── Process group 1 results ─────────────────────────────────────

      // Ego self-reflection / prompt rewriting result
      if (promptRewritingEnabled) {
        if (promptRewritingStrategy === 'self_reflection') {
          const egoReflResult = group1Map['ego_self_reflection'];
          sessionEvolution = egoReflResult?.text ?? null;
          if (sessionEvolution) {
            log(`[evaluationRunner] Ego self-reflection generated for turn ${turnIdx + 1}`, 'info');
            consolidatedTrace.push({
              agent: 'ego_self_reflection',
              action: 'rewrite',
              turnIndex: turnIdx,
              contextSummary: `Ego self-reflection generated for turn ${turnIdx + 1}`,
              detail: sessionEvolution,
              metrics: egoReflResult?.metrics ?? null,
              timestamp: new Date().toISOString(),
            });
          } else {
            log(
              `[evaluationRunner] Ego self-reflection returned empty, falling back to template for turn ${turnIdx + 1}`,
              'warn',
            );
            sessionEvolution = promptRewriter.synthesizeDirectives({
              turnResults,
              consolidatedTrace,
              conversationHistory,
            });
          }
        } else if (promptRewritingStrategy === 'llm') {
          const llmResult = group1Map['llm_rewrite'];
          sessionEvolution = llmResult?.text ?? null;
          if (sessionEvolution) {
            log(`[evaluationRunner] LLM rewriter generated directives for turn ${turnIdx + 1}`, 'info');
          } else {
            log(
              `[evaluationRunner] LLM rewriter returned empty, falling back to template for turn ${turnIdx + 1}`,
              'warn',
            );
            sessionEvolution = promptRewriter.synthesizeDirectives({
              turnResults,
              consolidatedTrace,
              conversationHistory,
            });
          }
        } else {
          // Template-based directive synthesis (deterministic, no LLM call)
          sessionEvolution = promptRewriter.synthesizeDirectives({
            turnResults,
            consolidatedTrace,
            conversationHistory,
          });
        }
        if (sessionEvolution) {
          log(
            `[evaluationRunner] Prompt rewriter (${promptRewritingStrategy}) generated ${sessionEvolution.split('\n').length - 2} directives for turn ${turnIdx + 1}`,
            'info',
          );
        }
      }

      // Superego self-reflection / disposition result
      if (superegoDispositionRewriting) {
        if (promptRewritingStrategy === 'self_reflection') {
          const seReflResult = group1Map['superego_self_reflection'];
          superegoEvolution = seReflResult?.text ?? null;
          if (superegoEvolution) {
            log(`[evaluationRunner] Superego self-reflection generated for turn ${turnIdx + 1}`, 'info');
            consolidatedTrace.push({
              agent: 'superego_self_reflection',
              action: 'rewrite',
              turnIndex: turnIdx,
              contextSummary: `Superego self-reflection generated for turn ${turnIdx + 1}`,
              detail: superegoEvolution,
              metrics: seReflResult?.metrics ?? null,
              timestamp: new Date().toISOString(),
            });
          } else {
            // Self-reflection returned empty — fall back to LLM disposition rewriting
            log(
              `[evaluationRunner] Superego self-reflection returned empty, falling back to LLM disposition for turn ${turnIdx + 1}`,
              'warn',
            );
            try {
              const dispFallback = await promptRewriter.synthesizeSuperegoDisposition({
                turnResults,
                consolidatedTrace,
                conversationHistory,
                priorSuperegoAssessments,
                config: rawProfile,
              });
              superegoEvolution = dispFallback?.text ?? null;
            } catch (error) {
              log(`[evaluationRunner] Superego disposition fallback also failed: ${error.message}`, 'warn');
            }
          }
        } else {
          const dispResult = group1Map['superego_disposition'];
          superegoEvolution = dispResult?.text ?? null;
          if (superegoEvolution) {
            log(`[evaluationRunner] Superego disposition rewriter generated evolution for turn ${turnIdx + 1}`, 'info');
            consolidatedTrace.push({
              agent: 'superego_disposition',
              action: 'rewrite',
              turnIndex: turnIdx,
              contextSummary: `Disposition evolution generated for turn ${turnIdx + 1}`,
              detail: superegoEvolution,
              metrics: dispResult?.metrics ?? null,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }

      // Tutor profile of learner result
      if (otherEgoProfilingEnabled) {
        const tutorProfResult = group1Map['tutor_profile'];
        if (tutorProfResult?.text) {
          tutorProfileOfLearner = tutorProfResult.text;
          log(`[evaluationRunner] Tutor profile of learner generated for turn ${turnIdx + 1}`, 'info');
          consolidatedTrace.push({
            agent: 'tutor_other_ego',
            action: 'profile_learner',
            turnIndex: turnIdx,
            contextSummary: `Tutor built mental model of learner after turn ${turnIdx + 1}`,
            detail: tutorProfileOfLearner,
            metrics: tutorProfResult.metrics ?? null,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Learner profile of tutor result
      if (otherEgoProfilingEnabled && otherEgoBidirectional) {
        const learnerProfResult = group1Map['learner_profile'];
        if (learnerProfResult?.text) {
          learnerProfileOfTutor = learnerProfResult.text;
          log(`[evaluationRunner] Learner profile of tutor generated for turn ${turnIdx + 1}`, 'info');
          consolidatedTrace.push({
            agent: 'learner_other_ego',
            action: 'profile_tutor',
            turnIndex: turnIdx,
            contextSummary: `Learner built mental model of tutor after turn ${turnIdx + 1}`,
            detail: learnerProfileOfTutor,
            metrics: learnerProfResult.metrics ?? null,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // ── Group 2: Dependent on group 1 results ──────────────────────
      const group2Promises = [];
      const group2Labels = [];

      // Parse quantitative behavioral parameters (sync — no LLM call)
      if (quantitativeDispositionEnabled && superegoEvolution) {
        const parsed = promptRewriter.parseBehavioralParameters(superegoEvolution);
        if (parsed) {
          behavioralOverrides = parsed;
          log(
            `[evaluationRunner] Behavioral overrides parsed: threshold=${parsed.rejection_threshold}, max_rejections=${parsed.max_rejections}, priority=[${parsed.priority_criteria.join(',')}], deprioritized=[${parsed.deprioritized_criteria.join(',')}]`,
            'info',
          );
          consolidatedTrace.push({
            agent: 'behavioral_overrides',
            action: 'parse',
            turnIndex: turnIdx,
            contextSummary: `Quantitative behavioral params: threshold=${parsed.rejection_threshold}, max=${parsed.max_rejections}`,
            detail: JSON.stringify(parsed),
            timestamp: new Date().toISOString(),
          });
        } else {
          log(
            `[evaluationRunner] No behavioral parameters found in superego reflection for turn ${turnIdx + 1} (quantitative_disposition enabled but no <behavioral_parameters> block)`,
            'warn',
          );
        }
      }

      // Intersubjective recognition (depends on ego + superego self-reflections)
      if (intersubjectiveEnabled && superegoEvolution) {
        group2Promises.push(
          promptRewriter
            .synthesizeEgoResponseToSuperego({
              superegoReflection: superegoEvolution,
              egoReflection: sessionEvolution,
              turnResults,
              conversationHistory,
              config: rawProfile,
            })
            .catch((error) => {
              log(`[evaluationRunner] Intersubjective ego response failed: ${error.message}`, 'warn');
              return null;
            }),
        );
        group2Labels.push('intersubjective');
      }

      // Strategy planning (depends on tutor profile)
      if (strategyPlanningEnabled && tutorProfileOfLearner) {
        group2Promises.push(
          promptRewriter
            .synthesizeStrategyPlan({
              learnerProfile: tutorProfileOfLearner,
              turnResults,
              conversationHistory,
              config: rawProfile,
            })
            .catch((error) => {
              log(`[evaluationRunner] Strategy plan failed: ${error.message}`, 'warn');
              return null;
            }),
        );
        group2Labels.push('strategy');
      }

      // Fire group 2 in parallel (intersubjective + strategy are independent of each other)
      if (group2Promises.length > 0) {
        const group2Results = await Promise.all(group2Promises);
        const group2Map = {};
        group2Labels.forEach((label, i) => {
          group2Map[label] = group2Results[i];
        });

        // Process intersubjective result
        if (group2Map['intersubjective']) {
          const egoResponseText = group2Map['intersubjective']?.text ?? null;
          if (egoResponseText) {
            sessionEvolution = sessionEvolution ? sessionEvolution + '\n\n' + egoResponseText : egoResponseText;
            log(
              `[evaluationRunner] Intersubjective ego response to superego generated for turn ${turnIdx + 1}`,
              'info',
            );
            consolidatedTrace.push({
              agent: 'ego_intersubjective',
              action: 'respond_to_critic',
              turnIndex: turnIdx,
              contextSummary: `Ego responded to superego's self-reflection for turn ${turnIdx + 1}`,
              detail: egoResponseText,
              metrics: group2Map['intersubjective']?.metrics ?? null,
              timestamp: new Date().toISOString(),
            });
          }
        }

        // Process strategy plan result
        if (group2Map['strategy']) {
          strategyPlan = group2Map['strategy']?.text ?? null;
          if (strategyPlan) {
            log(`[evaluationRunner] Strategy plan generated for turn ${turnIdx + 1}`, 'info');
            consolidatedTrace.push({
              agent: 'ego_strategy',
              action: 'plan',
              turnIndex: turnIdx,
              contextSummary: `Ego formulated strategy plan for turn ${turnIdx + 1}`,
              detail: strategyPlan,
              metrics: group2Map['strategy']?.metrics ?? null,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }

      const betweenTurnMs = Date.now() - betweenTurnStart;
      log(
        `[evaluationRunner] Between-turn processing completed in ${(betweenTurnMs / 1000).toFixed(1)}s (${group1Labels.length} parallel group-1, ${group2Labels.length} parallel group-2)`,
        'info',
      );
    }

    // Flush transcript: reflections (self-reflection, disposition, profiling, etc.)
    flushTranscript();

    // Generate LLM learner response for next turn.
    // Both architectures go through generateLearnerResponse():
    //   - ego_superego: ego → superego → ego_revision deliberation chain
    //   - unified (messages mode): single-agent LLM call
    // In single-prompt mode, unified learners use the YAML turn messages directly.
    if (isLLMLearner && turnIdx < totalTurnCount - 1) {
      const nextTurnDef = turns[turnIdx]; // turnIdx is 0-based into the loop; turns[turnIdx] is the next follow-up turn
      if (nextTurnDef) {
        const learnerResponse = await generateLearnerResponse({
          tutorMessage: suggestion?.message || suggestion?.title || '',
          topic: fullScenario.topic || fullScenario.name || '',
          conversationHistory: flattenConversationHistory(conversationHistory),
          learnerProfile: resolvedConfig.learnerArchitecture,
          personaId: fullScenario.learner_persona || 'eager_novice',
          modelOverride:
            config.learnerModelOverride || resolvedConfig.learnerModelOverride || config.modelOverride || null,
          egoModelOverride: config.learnerEgoModelOverride || null,
          superegoModelOverride: config.learnerSuperegoModelOverride || null,
          profileContext:
            otherEgoBidirectional && learnerProfileOfTutor
              ? promptRewriter.formatProfileForInjection(learnerProfileOfTutor, 'tutor')
              : null,
          conversationMode,
        });

        // Override YAML message with LLM-generated one
        nextTurnDef._originalMessage = nextTurnDef.action_details?.message;
        nextTurnDef.action_details = nextTurnDef.action_details || {};
        nextTurnDef.action_details.message = learnerResponse.message;
        nextTurnDef._learnerDeliberation = learnerResponse.internalDeliberation;
        nextTurnDef._learnerEmotionalState = learnerResponse.emotionalState;

        // Track learner LLM costs
        totalInputTokens += learnerResponse.tokenUsage?.inputTokens || 0;
        totalOutputTokens += learnerResponse.tokenUsage?.outputTokens || 0;
        totalApiCalls += learnerResponse.tokenUsage?.apiCalls || 0;

        // Add learner deliberation to consolidated trace.
        // ego_superego: multiple deliberation entries (ego_initial, superego, ego_revision)
        // unified: single deliberation entry (unified_learner)
        // Both produce a learner/final_output trace entry for symmetric transcript rendering.
        if (learnerResponse.internalDeliberation?.length > 0) {
          for (const delib of learnerResponse.internalDeliberation) {
            const delibMetrics = delib.metrics || null;
            consolidatedTrace.push({
              agent: `learner_${delib.role}`,
              action: 'deliberation',
              turnIndex: turnIdx + 1,
              contextSummary: delib.content.substring(0, 100),
              detail: delib.content,
              latencyMs: delibMetrics?.latencyMs ?? null,
              provider: delibMetrics?.provider || null,
              metrics: delibMetrics,
              apiPayload: delib.apiPayload || null,
              inputMessages: delib.inputMessages || null,
              timestamp: new Date().toISOString(),
            });
          }
          const finalLearnerDelib =
            learnerResponse.internalDeliberation[learnerResponse.internalDeliberation.length - 1];
          const finalLearnerMetrics = finalLearnerDelib?.metrics || null;
          consolidatedTrace.push({
            agent: 'learner',
            action: 'final_output',
            turnIndex: turnIdx + 1,
            contextSummary: learnerResponse.message.substring(0, 100),
            detail: learnerResponse.message,
            latencyMs: finalLearnerMetrics?.latencyMs ?? null,
            provider: finalLearnerMetrics?.provider || null,
            metrics: finalLearnerMetrics,
            apiPayload: finalLearnerDelib?.apiPayload || null,
            inputMessages: null, // synthesis is not a separate LLM call
            timestamp: new Date().toISOString(),
          });
        }

        const archLabel = isEgoSuperegoLearner ? 'ego_superego' : 'unified';
        log(
          `[evaluationRunner] Generated LLM learner response (${archLabel}): "${learnerResponse.message.substring(0, 80)}..."`,
          'info',
        );

        // Flush transcript: learner deliberation
        flushTranscript();
      }
    }

    // Write mid-dialogue checkpoint after each completed turn
    if (runId) {
      writeCheckpoint(runId, scenario.id, config.profileName, {
        lastCompletedTurn: turnIdx,
        totalTurns: totalTurnCount,
        dialogueId,
        learnerId,
        turns,
        turnResults,
        conversationHistory,
        consolidatedTrace,
        priorSuperegoAssessments,
        previousSuggestion,
        sessionEvolution,
        superegoEvolution,
        behavioralOverrides,
        tutorProfileOfLearner,
        learnerProfileOfTutor,
        strategyPlan,
        totalRejections,
        totalLatencyMs,
        totalInputTokens,
        totalOutputTokens,
        totalApiCalls,
        totalCost,
        totalDeliberationRounds,
      });
    }
  }

  // Print closing separator for live chat transcript
  if (consolidatedTrace.length > 0) {
    console.log(chalk.dim('─'.repeat(60)));
  }

  // Multi-turn loop completed successfully — clean up checkpoint
  if (runId) {
    deleteCheckpoint(runId, scenario.id, config.profileName);
  }

  // Clear turn progress from run metadata now that all turns are complete
  if (runId) {
    evaluationStore.updateRun(runId, {
      metadata: { turnProgress: null },
    });
  }

  // Write complete transcript file at end (for post-hoc viewing)
  if (transcriptMode && transcriptPath) {
    const fullTranscript = formatTranscript(consolidatedTrace, {
      detail: 'play',
      scenarioName: fullScenario.name || scenario.id,
      profileName: config.profileName,
      totalTurns: turnResults.length,
    });
    fs.writeFileSync(transcriptPath, fullTranscript);
    log(`[evaluationRunner] Transcript written: ${transcriptPath}`, 'info');
  }

  // 5. Aggregate scores across turns
  const validTurnScores = turnResults.filter((t) => t.turnScore !== null).map((t) => t.turnScore);
  const tutorFirstTurnScore =
    validTurnScores.length > 0 ? validTurnScores.reduce((sum, s) => sum + s, 0) / validTurnScores.length : null;

  // Aggregate per-dimension scores across turns, using YAML-driven dimension keys
  const allDimKeys = Object.keys(evalConfigLoader.getRubricDimensions());
  const aggregateDimensions = {};
  for (const dim of allDimKeys) {
    const dimScores = turnResults.filter((t) => t.scores?.[dim] !== undefined).map((t) => t.scores[dim]);
    if (dimScores.length > 0) {
      aggregateDimensions[dim] = dimScores.reduce((sum, s) => sum + s, 0) / dimScores.length;
    }
  }

  const baseScore = rubricEvaluator.calculateBaseScore(aggregateDimensions);
  const recognitionScore = rubricEvaluator.calculateRecognitionScore(aggregateDimensions);

  const allTurnsPassed = turnResults.every((t) => {
    if (t.turnScore === null) return false;
    const threshold = t.minAcceptableScore || fullScenario.min_acceptable_score || 0;
    return t.turnScore >= threshold;
  });

  // 5b. Holistic dialogue evaluation — score the full transcript as a single unit
  let holisticDialogueScore = null;
  if (!skipRubricEval && consolidatedTrace.length > 0 && turnResults.length > 1) {
    log('[evaluationRunner] Running holistic dialogue evaluation on full transcript...', 'info');
    try {
      // Use the last turn's suggestion as the focal point, with full dialogue context
      const lastSuggestion = turnResults[turnResults.length - 1]?.suggestion;
      if (lastSuggestion) {
        const holisticResult = await evaluateSuggestionWithSelectedJudge(
          lastSuggestion,
          {
            name: `${fullScenario.name} (holistic dialogue)`,
            description: `Holistic evaluation of ${turnResults.length}-turn dialogue. Score the overall quality of the tutoring interaction, not just this final response.`,
            expectedBehavior: fullScenario.expected_behavior,
            learnerContext: fullScenario.learner_context,
            requiredElements: fullScenario.required_elements || [],
            forbiddenElements: fullScenario.forbidden_elements || [],
          },
          {
            dialogueContext: {
              conversationHistory,
              consolidatedTrace,
            },
          },
          { judgeOverride, judgeCli, judgeCliModel },
        );

        if (holisticResult?.success) {
          holisticDialogueScore = {
            overallScore: holisticResult.overallScore,
            baseScore: holisticResult.baseScore,
            recognitionScore: holisticResult.recognitionScore,
            scores: holisticResult.scores,
            summary: holisticResult.summary,
            judgeModel: holisticResult.judgeModel,
          };
          log(`[evaluationRunner] Holistic dialogue score: ${holisticResult.overallScore?.toFixed(1)}`, 'success');
        } else {
          log(
            `[evaluationRunner] Holistic dialogue evaluation failed: ${holisticResult?.error || 'unknown'}`,
            'warning',
          );
        }
      }
    } catch (error) {
      log(`[evaluationRunner] Holistic dialogue evaluation error: ${error.message}`, 'warning');
    }
  }

  // 5c. Analyze bilateral transformation (tutor + learner evolution)
  const turnProgressionAnalysis = turnComparisonAnalyzer.analyzeTurnProgression(turnResults);
  const markerDefinitions = fullScenario.transformation_markers || fullScenario.transformationMarkers || null;
  const transformationMarkerAnalysis = markerDefinitions
    ? turnComparisonAnalyzer.analyzeTransformationMarkers(turnResults, markerDefinitions)
    : null;
  const dialogueTraceReport = dialogueTraceAnalyzer.generateTransformationReport(consolidatedTrace, turnResults);

  log(`[evaluationRunner] Bilateral transformation analysis:`, 'info');
  log(`  - Tutor adaptation index: ${turnProgressionAnalysis.adaptationIndex?.toFixed(2) ?? 'N/A'}`, 'info');
  log(`  - Learner growth index: ${turnProgressionAnalysis.learnerGrowthIndex?.toFixed(2) ?? 'N/A'}`, 'info');
  log(`  - Bilateral balance: ${dialogueTraceReport.bilateralMetrics.bilateralBalance?.toFixed(2) ?? 'N/A'}`, 'info');
  if (dialogueTraceReport.bilateralMetrics.summary) {
    log(`  - ${dialogueTraceReport.bilateralMetrics.summary}`, 'info');
  }

  const transcriptTurns = turnResults.map((t, idx) => ({
    turnIndex: Number.isInteger(t.turnIndex) ? t.turnIndex : idx,
    turnId: t.turnId,
    suggestion: t.suggestion || t.suggestions?.[0] || null,
    suggestions: t.suggestion ? [t.suggestion] : t.suggestions || [],
    learnerAction: t.learnerAction,
    learnerMessage: t.learnerMessage,
  }));
  const transcripts = rubricEvaluator.buildTranscriptArtifacts({
    turns: transcriptTurns,
    dialogueTrace: consolidatedTrace,
    learnerContext: fullScenario.learner_context,
  });

  // 6. Write consolidated dialogue log
  const consolidatedDialogue = {
    suggestions: turnResults[turnResults.length - 1]?.suggestion
      ? [turnResults[turnResults.length - 1].suggestion]
      : [],
    dialogueTrace: consolidatedTrace,
    converged: false,
    rounds: totalDeliberationRounds,
    conversationTurns: turnResults.length,
    metrics: {
      totalLatencyMs,
      totalInputTokens,
      totalOutputTokens,
      totalCost,
      apiCalls: totalApiCalls,
    },
    dialogueId,
    profileName: resolvedConfig.profileName,
    provider: resolvedConfig.provider,
    model: resolvedConfig.model,
    learnerContext: fullScenario.learner_context,
    isMultiTurn: true,
    learnerArchitecture: resolvedConfig.learnerArchitecture || 'unified',
    transcripts,
    totalTurns: turnResults.length,
    turnResults: turnResults.map((t) => {
      const turnContent = JSON.stringify({
        turnIndex: t.turnIndex,
        suggestion: t.suggestion ? [t.suggestion] : [],
        turnId: t.turnId,
      });
      const contentTurnId = createHash('sha256')
        .update(dialogueId + ':' + t.turnIndex + ':' + turnContent)
        .digest('hex')
        .slice(0, 16);
      return {
        turnIndex: t.turnIndex,
        turnId: t.turnId,
        contentTurnId,
        suggestions: t.suggestion ? [t.suggestion] : [],
        learnerAction: t.learnerAction,
        learnerMessage: t.learnerMessage,
      };
    }),
    // Conversation mode audit trail
    conversationMode,
    conversationHistory,
    // Holistic dialogue evaluation
    holisticDialogueScore,
    // Bilateral transformation analysis
    transformationAnalysis: {
      turnProgression: turnProgressionAnalysis,
      markerAnalysis: transformationMarkerAnalysis,
      dialogueTraceReport: dialogueTraceReport,
    },
  };

  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
  const logContent = JSON.stringify(consolidatedDialogue, null, 2);
  const dialogueContentHash = createHash('sha256').update(logContent).digest('hex');

  // Phase 3a: Content-addressable log storage
  // Hash-named file = immutable evidence snapshot (write-once)
  // DialogueId-named file = working copy (may be updated with holistic scores later)
  const hashPath = path.join(LOGS_DIR, `${dialogueContentHash}.json`);
  const dialoguePath = path.join(LOGS_DIR, `${dialogueId}.json`);
  fs.writeFileSync(hashPath, logContent);
  fs.writeFileSync(dialoguePath, logContent);

  log(
    `[evaluationRunner] Multi-turn complete: ${turnResults.length} turns, avgScore=${tutorFirstTurnScore?.toFixed(1)}`,
  );

  // Aggregate requiredMissing/forbiddenFound from all turns
  const requiredMissing = [...new Set(turnResults.flatMap((t) => t.requiredMissing || []))];
  const forbiddenFound = [...new Set(turnResults.flatMap((t) => t.forbiddenFound || []))];

  // 7. Return result
  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    scenarioType: fullScenario.type || 'suggestion',
    isMultiTurn: true,
    totalTurns: turnResults.length,
    provider: resolvedConfig.provider,
    model: resolvedConfig.model,
    profileName: config.profileName,
    egoModel: resolvedConfig.egoModel ? `${resolvedConfig.egoModel.provider}.${resolvedConfig.egoModel.model}` : null,
    superegoModel: resolvedConfig.superegoModel
      ? `${resolvedConfig.superegoModel.provider}.${resolvedConfig.superegoModel.model}`
      : null,
    hyperparameters: resolvedConfig.hyperparameters || config.hyperparameters,
    suggestions: turnResults.map((t) => t.suggestion).filter(Boolean),
    success: true,
    latencyMs: totalLatencyMs,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    apiCalls: totalApiCalls,
    cost: totalCost,
    dialogueId,
    dialogueRounds: turnResults.length,
    deliberationRounds: totalDeliberationRounds,
    scores: Object.keys(aggregateDimensions).length > 0 ? aggregateDimensions : null,
    scoresWithReasoning:
      Object.keys(aggregateDimensions).length > 0
        ? Object.fromEntries(
            Object.entries(aggregateDimensions).map(([key, value]) => [key, { score: value, reasoning: null }]),
          )
        : null,
    tutorFirstTurnScore,
    scoringMethod: turnResults.some((t) => t.scoringMethod === 'judge_failed')
      ? 'partial_judge_failure'
      : turnResults.every((t) => t.scoringMethod === 'rubric')
        ? 'rubric'
        : 'mixed',
    baseScore,
    recognitionScore,
    turnResults,
    allTurnsPassed,
    passesRequired: turnResults.every((t) => t.passesRequired),
    passesForbidden: turnResults.every((t) => t.passesForbidden),
    requiredMissing,
    forbiddenFound,
    judgeModel:
      turnResults.find((turn) => turn.judgeModel)?.judgeModel || holisticDialogueScore?.judgeModel || null,
    evaluationReasoning:
      holisticDialogueScore?.summary || turnResults.find((turn) => turn.evaluationReasoning)?.evaluationReasoning || null,
    factors: resolvedConfig.factors || null,
    learnerArchitecture: resolvedConfig.learnerArchitecture || null,
    conversationMode,
    dialogueContentHash,
    configHash,
    ...promptVersions,
    // Holistic dialogue evaluation (full transcript scored as single unit)
    holisticDialogueScore,
    // Bilateral transformation metrics
    transformationMetrics: {
      tutorAdaptationIndex: turnProgressionAnalysis.adaptationIndex,
      learnerGrowthIndex: turnProgressionAnalysis.learnerGrowthIndex,
      bilateralTransformationIndex: turnProgressionAnalysis.bilateralTransformationIndex,
      framingEvolution: turnProgressionAnalysis.framingEvolution,
      dimensionConvergence: turnProgressionAnalysis.dimensionConvergence,
      markerAnalysis: transformationMarkerAnalysis,
      bilateralMetrics: dialogueTraceReport.bilateralMetrics,
      superegoMetrics: dialogueTraceReport.superegoMetrics,
      transformationQuality: dialogueTraceReport.overallAssessment?.transformationQuality ?? null,
    },
  };
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
export async function resumeEvaluation(options = {}) {
  const {
    runId,
    parallelism = DEFAULT_PARALLELISM,
    verbose = false,
    force = false, // Skip the "already running" check
  } = options;

  const log = verbose ? console.log : () => {};

  // 1. Load the run and validate it exists
  const run = evaluationStore.getRun(runId);
  if (!run) {
    throw new Error(`Run not found: ${runId}`);
  }

  // 1b. Check if another process is already running this evaluation
  const existingPid = run.metadata?.pid;
  if (existingPid && existingPid !== process.pid && !force) {
    const isAlive = isPidAlive(existingPid);
    if (isAlive) {
      throw new Error(
        `Run ${runId} is already being processed by pid ${existingPid}. ` +
          `Use --force to override (may cause duplicates).`,
      );
    }
  }

  // 2. Extract metadata
  const metadata = run.metadata || {};
  const runsPerConfig = metadata.runsPerConfig || 1;
  const skipRubricEval = metadata.skipRubricEval || false;
  const dryRun = metadata.dryRun || false;
  const modelOverride = metadata.modelOverride || null;
  const tutorModelOverride = metadata.tutorModelOverride || null;
  const egoModelOverride = metadata.egoModelOverride || null;
  const superegoModelOverride = metadata.superegoModelOverride || null;
  const learnerModelOverride = metadata.learnerModelOverride || null;
  const learnerEgoModelOverride = metadata.learnerEgoModelOverride || null;
  const learnerSuperegoModelOverride = metadata.learnerSuperegoModelOverride || null;

  // 3. Get existing results for completion checking
  const existingResults = evaluationStore.getResults(runId);

  // 4. Reconstruct scenarios - prefer metadata (complete list), fall back to inferring from results
  const allScenarios = evalConfigLoader.listScenarios();
  let scenarioIds;
  if (metadata.scenarioIds && metadata.scenarioIds.length > 0) {
    // Use stored scenario list (includes scenarios that haven't started yet)
    scenarioIds = metadata.scenarioIds;
  } else {
    // Legacy: infer from existing results (may miss unstarted scenarios)
    scenarioIds = [...new Set(existingResults.map((r) => r.scenarioId).filter(Boolean))];
  }
  const targetScenarios = allScenarios.filter((s) => scenarioIds.includes(s.id));

  if (targetScenarios.length === 0) {
    throw new Error(`No matching scenarios found for run ${runId}`);
  }

  // 5. Reconstruct profiles - prefer metadata, fall back to inferring from results
  let profileNames;
  if (metadata.profileNames && metadata.profileNames.length > 0) {
    // Use stored profile list
    profileNames = metadata.profileNames;
  } else {
    // Legacy: infer from existing results
    profileNames = [...new Set(existingResults.map((r) => r.profileName).filter(Boolean))];
  }

  if (profileNames.length === 0) {
    throw new Error(`No profiles found for run ${runId} — cannot determine what to resume`);
  }

  let targetConfigs = profileNames.map((name) => ({
    provider: null,
    model: null,
    profileName: name,
    label: name,
  }));

  // 6. Re-apply model overrides if present in metadata
  if (modelOverride) {
    targetConfigs = targetConfigs.map((c) => ({ ...c, modelOverride }));
  }
  if (tutorModelOverride) {
    targetConfigs = targetConfigs.map((c) => ({ ...c, tutorModelOverride }));
  }
  if (egoModelOverride) {
    targetConfigs = targetConfigs.map((c) => ({ ...c, egoModelOverride }));
  }
  if (superegoModelOverride) {
    targetConfigs = targetConfigs.map((c) => ({ ...c, superegoModelOverride }));
  }
  if (learnerModelOverride) {
    targetConfigs = targetConfigs.map((c) => ({ ...c, learnerModelOverride }));
  }
  if (learnerEgoModelOverride) {
    targetConfigs = targetConfigs.map((c) => ({ ...c, learnerEgoModelOverride }));
  }
  if (learnerSuperegoModelOverride) {
    targetConfigs = targetConfigs.map((c) => ({ ...c, learnerSuperegoModelOverride }));
  }

  // 6. Count successful results per (profile, scenario) combo and fill up to runsPerConfig.
  //    Failed results are excluded so they get retried.
  const completedCounts = {};
  for (const result of existingResults) {
    // Only count successful results — failed ones should be retried
    if (result.success === false || result.success === 0) continue;
    const key = `${result.profileName}:${result.scenarioId}`;
    completedCounts[key] = (completedCounts[key] || 0) + 1;
  }

  // Build flat list of remaining tests
  const remainingTests = [];
  for (const scenario of targetScenarios) {
    for (const config of targetConfigs) {
      const key = `${config.profileName}:${scenario.id}`;
      const done = completedCounts[key] || 0;
      const needed = runsPerConfig - done;
      for (let i = 0; i < needed; i++) {
        remainingTests.push({ config, scenario, runNum: done + i });
      }
    }
  }

  // Scan for mid-dialogue checkpoints
  const checkpoints = listCheckpoints(runId);
  let checkpointCount = 0;
  if (checkpoints.length > 0) {
    const checkpointMap = new Map();
    for (const cp of checkpoints) {
      checkpointMap.set(`${cp.profileName}:${cp.scenarioId}`, cp);
    }
    for (const test of remainingTests) {
      const key = `${test.config.profileName}:${test.scenario.id}`;
      const cp = checkpointMap.get(key);
      if (cp) {
        test.checkpointState = cp;
        checkpointMap.delete(key);
        checkpointCount++;
      }
    }
  }

  if (remainingTests.length === 0) {
    console.log(`\nRun ${runId}: all tests completed (${runsPerConfig} reps each). Nothing to resume.`);
    return {
      runId,
      totalTests: 0,
      successfulTests: 0,
      stats: evaluationStore.getRunStats(runId),
      scenarioStats: evaluationStore.getScenarioStats(runId),
      progressLogPath: getProgressLogPath(runId),
      resumed: true,
      alreadyComplete: true,
    };
  }

  // 7. Set run status to 'running' and update PID
  evaluationStore.updateRun(runId, { status: 'running', metadata: { pid: process.pid } });

  const totalRemainingTests = remainingTests.length;
  const _totalExpectedTests = targetScenarios.length * targetConfigs.length * runsPerConfig;

  console.log(`\nResuming run: ${runId}`);
  console.log(`  Previously completed: ${existingResults.length} tests`);
  console.log(`  Remaining: ${totalRemainingTests} tests`);
  if (checkpointCount > 0) console.log(`  Mid-dialogue checkpoints: ${checkpointCount} (will resume mid-turn)`);
  console.log(`  Profiles: ${profileNames.join(', ')}`);
  console.log(`  Scenarios: ${targetScenarios.length}`);
  if (modelOverride) console.log(`  Model override: ${modelOverride}`);
  if (tutorModelOverride) console.log(`  Tutor model override: ${tutorModelOverride}`);
  if (egoModelOverride) console.log(`  Ego model override: ${egoModelOverride}`);
  if (superegoModelOverride) console.log(`  Superego model override: ${superegoModelOverride}`);
  if (learnerModelOverride) console.log(`  Learner model override: ${learnerModelOverride}`);
  if (learnerEgoModelOverride) console.log(`  Learner ego model override: ${learnerEgoModelOverride}`);
  if (learnerSuperegoModelOverride) console.log(`  Learner superego model override: ${learnerSuperegoModelOverride}`);

  // Initialize content resolver (same as runEvaluation)
  const contentConfig = evalConfigLoader.getContentConfig();
  if (contentConfig?.content_package_path) {
    contentResolver.configure({
      contentPackagePath: contentConfig.content_package_path,
      maxLectureChars: contentConfig.max_lecture_chars,
      includeSpeakerNotes: contentConfig.include_speaker_notes,
    });
  }

  // 8. Set up progress logger and streaming reporter (appends to existing JSONL)
  const progressLogPath = getProgressLogPath(runId);
  console.log(`Progress log: ${progressLogPath}\n`);

  const progressLogger = new ProgressLogger(runId);
  const scenarioNames = targetScenarios.map((s) => s.name || s.id);
  const reporter = new StreamingReporter({
    totalTests: totalRemainingTests,
    totalScenarios: targetScenarios.length,
    profiles: profileNames,
    scenarios: scenarioNames,
  });

  progressLogger.runStart({
    totalTests: totalRemainingTests,
    totalScenarios: targetScenarios.length,
    totalConfigurations: targetConfigs.length,
    scenarios: scenarioNames,
    profiles: profileNames,
    description: `Resumed: ${totalRemainingTests} remaining tests`,
  });

  // Register with monitoring
  monitoringService.startSession(runId, {
    userId: 'eval-runner-resume',
    profileName: `${targetConfigs.length} configs`,
    modelId: 'evaluation-batch',
  });

  const results = [];
  let completedTests = 0;

  // Scenario completion tracking
  const scenarioProgress = new Map();
  for (const scenario of targetScenarios) {
    const testsForScenario = remainingTests.filter((t) => t.scenario.id === scenario.id).length;
    scenarioProgress.set(scenario.id, {
      total: testsForScenario,
      completed: 0,
      scores: [],
      scenarioName: scenario.name || scenario.id,
    });
  }
  let completedScenarios = 0;

  // 9. Reuse the same parallel worker pool pattern
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

  // Suppress tutor-core verbose dialogue output during eval runs
  setQuietMode(true);

  log(`\nRunning ${totalRemainingTests} remaining tests with parallelism=${parallelism}...\n`);

  const runStartTime = Date.now();

  await processQueue(remainingTests, parallelism, async ({ config, scenario, checkpointState }) => {
    const profileLabel = config.label || config.profileName || '';

    progressLogger.testStart({
      scenarioId: scenario.id,
      scenarioName: scenario.name || scenario.id,
      profileName: profileLabel,
    });

    try {
      const result = await runSingleTest(scenario, config, {
        skipRubricEval,
        dryRun,
        verbose,
        runId,
        checkpointState: checkpointState || null,
      });

      evaluationStore.storeResult(runId, result);
      results.push(result);
      completedTests++;

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
        totalTests: totalRemainingTests,
      });

      reporter.onTestComplete({
        ...result,
        profileName: profileLabel,
        scenarioName: scenario.name || scenario.id,
      });

      log(
        `  ${formatProgress(completedTests, totalRemainingTests, runStartTime)} ${profileLabel} / ${scenario.id}: ${result.success ? `score=${result.tutorFirstTurnScore?.toFixed(1)}` : 'FAILED'}`,
      );

      monitoringService.recordEvent(runId, {
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
        `  ${formatProgress(completedTests, totalRemainingTests, runStartTime)} ${profileLabel} / ${scenario.id}: ERROR - ${error.message}`,
      );

      // Only store failed results for permanent errors — skip transient/retriable ones
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
          success: false,
          errorMessage: error.message,
        };
        try {
          evaluationStore.storeResult(runId, failedResult);
          results.push(failedResult);
        } catch (storeErr) {
          log(`  [WARNING] Failed to store error result: ${storeErr.message}`);
        }
      } else {
        log(`  [SKIPPED] Transient error, not storing empty row (resumable): ${errMsg.substring(0, 100)}`);
      }

      progressLogger.testError({
        scenarioId: scenario.id,
        scenarioName: scenario.name || scenario.id,
        profileName: profileLabel,
        errorMessage: error.message,
        completedCount: completedTests,
        totalTests: totalRemainingTests,
      });

      reporter.onTestError({
        scenarioName: scenario.name || scenario.id,
        profileName: profileLabel,
        errorMessage: error.message,
      });

      monitoringService.recordEvent(runId, {
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
  });

  // Restore tutor-core output
  setQuietMode(false);

  const durationMs = Date.now() - runStartTime;
  const successfulTests = results.filter((r) => r.success).length;
  const failedTests = completedTests - successfulTests;

  progressLogger.runComplete({ totalTests: completedTests, successfulTests, failedTests, durationMs });
  reporter.onRunComplete({ totalTests: completedTests, successfulTests, failedTests, durationMs });

  // 10. Mark run as completed (keep original totalTests to show expected vs actual)
  const allResults = evaluationStore.getResults(runId);
  evaluationStore.updateRun(runId, {
    status: 'completed',
    completedAt: new Date().toISOString(),
  });

  monitoringService.endSession(runId);

  const stats = evaluationStore.getRunStats(runId);
  const scenarioStats = evaluationStore.getScenarioStats(runId);

  return {
    runId,
    totalTests: run.totalTests,
    completedTests: allResults.length,
    successfulTests,
    failedTests: allResults.filter((r) => !r.success).length,
    resumedTests: totalRemainingTests,
    stats,
    scenarioStats,
    progressLogPath,
    resumed: true,
  };
}

/**
 * Compare two or more configurations
 */
export async function compareConfigurations(configs, options = {}) {
  const { scenarios = 'all', runsPerConfig = 1, verbose = false } = options;

  // Run evaluation with specified configs
  const result = await runEvaluation({
    scenarios,
    configurations: configs,
    runsPerConfig,
    verbose,
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

/**
 * Extract learner turns from a dialogue trace, mirroring eval-cli.js extractLearnerTurnsFromTrace.
 * Each turn contains the external message and any internal deliberation entries (for multi-agent learners).
 */
function extractLearnerTurnsFromTrace(trace, isMultiAgent, conversationHistory) {
  const learnerTurns = [];

  // Strategy 1: look for explicit turn_action entries (single-prompt mode)
  let turnMarkers = trace.filter((t) => (t.agent === 'learner' || t.agent === 'user') && t.action === 'turn_action');

  // Strategy 2: fall back to learner final output entries (messages mode — any learner architecture)
  if (turnMarkers.length === 0) {
    turnMarkers = trace.filter(
      (t) =>
        (t.agent === 'learner_synthesis' && t.action === 'response') ||
        (t.agent === 'learner' && t.action === 'final_output'),
    );
  }

  // Build conversationHistory lookup for supplementing empty messages
  const convHistByTurn = {};
  if (Array.isArray(conversationHistory)) {
    conversationHistory.forEach((ch, i) => {
      if (ch.learnerMessage) convHistByTurn[i] = ch.learnerMessage;
    });
  }

  for (const ta of turnMarkers) {
    let rawMessage = ta.action === 'final_output' ? ta.detail || ta.contextSummary || '' : ta.contextSummary || '';

    // Strip [INTERNAL] section from unified learner output
    const externalMatch = rawMessage.match(/\[EXTERNAL\]:?\s*([\s\S]*)/i);
    if (externalMatch) rawMessage = externalMatch[1].trim();

    const turnData = {
      turnIndex: ta.turnIndex,
      externalMessage: rawMessage,
      internalDeliberation: [],
    };

    if (!turnData.externalMessage && ta.turnIndex != null) {
      turnData.externalMessage = convHistByTurn[ta.turnIndex - 1] || '';
    }

    if (isMultiAgent) {
      const taIdx = trace.indexOf(ta);
      for (let j = taIdx - 1; j >= 0; j--) {
        const entry = trace[j];
        if (entry.agent === 'learner_ego_initial' && entry.action === 'deliberation') {
          turnData.internalDeliberation.unshift({ role: 'ego_initial', content: entry.contextSummary || '' });
          break;
        } else if (entry.agent === 'learner_superego' && entry.action === 'deliberation') {
          turnData.internalDeliberation.unshift({ role: 'superego', content: entry.contextSummary || '' });
        } else if (entry.agent === 'learner_ego_revision' && entry.action === 'deliberation') {
          turnData.internalDeliberation.unshift({ role: 'ego_revision', content: entry.contextSummary || '' });
        } else if (
          (entry.agent === 'learner_synthesis' && entry.action === 'response') ||
          (entry.agent === 'learner' && entry.action === 'final_output')
        ) {
          // final learner output — if this IS our marker, skip it
        } else if (entry.agent === 'ego' || entry.agent === 'system' || entry.agent === 'superego') {
          break;
        }
      }
    }

    learnerTurns.push(turnData);
  }

  return learnerTurns;
}

/**
 * Score multi-turn dimensions (learner, dialogue, holistic, deliberation) for a rejudge row.
 * Called after tutor per-turn scoring succeeds. Each phase is independently try/caught.
 *
 * @param {number|string} rowId - The DB row ID to update (from storeRejudgment or result.id for overwrite)
 * @param {Object} result - The original evaluation result
 * @param {Object} dialogueLog - Parsed dialogue log
 * @param {Object} opts - Judge dispatch and logging context
 */
async function scoreMultiTurnRejudgment(rowId, result, dialogueLog, opts) {
  const { judgeCli, judgeModel, effectiveCliJudgeModel, judgeOverrideObj, log, skipLearner, skipDeliberation } = opts;

  const turnResults = dialogueLog.turnResults || [];
  const dialogueTrace = dialogueLog.dialogueTrace || [];
  const totalTurns = turnResults.length;
  const scenarioId = result.scenarioId;
  const profileName = result.profileName || `${result.provider}/${result.model}`;

  if (totalTurns === 0) return;

  const fullScenario = evalConfigLoader.getScenario(scenarioId);
  if (!fullScenario) return;

  // ── Shared judge call helper (returns parsed JSON) ──
  async function callJudge(prompt) {
    if (judgeCli) {
      return await callCliJudge(prompt, judgeCli, effectiveCliJudgeModel);
    } else {
      // Use rubricEvaluator's API-based judge: callJudgeModel returns raw text, parseJudgeResponse parses it
      const responseText = await rubricEvaluator.callJudgeModel(prompt, judgeOverrideObj);
      return rubricEvaluator.parseJudgeResponse(responseText);
    }
  }

  // ── Learner data prep ──
  const isMultiAgent = rubricEvaluator.isEgoSuperegoLearner(dialogueTrace);
  const personaDescription = dialogueLog.learnerContext || 'No persona description available';
  const scenarioNameForLearner = fullScenario.name || scenarioId;
  const learnerCtx = dialogueLog.learnerContext || null;
  const transcriptArtifacts = dialogueLog.transcripts || null;

  const learnerTurns = extractLearnerTurnsFromTrace(dialogueTrace, isMultiAgent, dialogueLog.conversationHistory);

  // Build reconstructed turns for learner prompt builder
  const reconstructedTurns = [];
  for (let lt = 0; lt < learnerTurns.length; lt++) {
    reconstructedTurns.push({
      turnNumber: lt + 1,
      phase: 'learner',
      externalMessage: learnerTurns[lt].externalMessage,
      internalDeliberation: learnerTurns[lt].internalDeliberation,
    });
    const tutorTurn = turnResults[lt + 1];
    if (tutorTurn) {
      const sug = tutorTurn.suggestions?.[0];
      reconstructedTurns.push({
        turnNumber: lt + 1,
        phase: 'tutor',
        externalMessage: sug?.message || sug?.text || JSON.stringify(sug),
      });
    }
  }

  // Pre-compute learner turn target indices
  const learnerTurnTargets = [];
  for (let lt = 0; lt < learnerTurns.length; lt++) {
    const targetIdx = reconstructedTurns.findIndex(
      (t) => t.phase === 'learner' && t.externalMessage === learnerTurns[lt].externalMessage,
    );
    if (targetIdx !== -1) {
      learnerTurnTargets.push({ lt, targetIdx });
    }
  }

  // ── Build transcript turns (shared by dialogue + holistic prompts) ──
  const transcriptTurns = turnResults.map((t, idx) => ({
    turnIndex: idx,
    turnId: t.turnId,
    suggestion: t.suggestions?.[0],
    learnerAction: t.learnerAction,
    learnerMessage: t.learnerMessage,
  }));

  // ── Parallel scoring phases ──
  const promises = [];
  const phaseLabels = [];

  // Phase 1: Per-turn learner scoring
  if (!skipLearner && learnerTurnTargets.length > 0) {
    promises.push(
      (async () => {
        try {
          let learnerTurnScores = {};

          if (learnerTurnTargets.length > 1) {
            // Attempt batched prompt first
            const batchedPrompt = buildBatchedLearnerPrompt({
              turns: reconstructedTurns,
              learnerTurnTargets,
              personaId: profileName,
              personaDescription,
              learnerArchitecture: isMultiAgent ? 'multi_agent' : 'unified',
              scenarioName: scenarioNameForLearner,
              topic: scenarioId,
            });
            if (batchedPrompt) {
              const parsed = await retryWithBackoff(async () => callJudge(batchedPrompt), {});
              if (Array.isArray(parsed.turns)) {
                for (const turnData of parsed.turns) {
                  const lt = turnData.learner_turn_index ?? 0;
                  const turnOverall = calculateLearnerOverallScore(turnData.scores || {}, isMultiAgent);
                  learnerTurnScores[lt] = { scores: turnData.scores, overallScore: turnOverall };
                }
              }
            }
          }

          // Fallback to individual if batched didn't produce results
          if (Object.keys(learnerTurnScores).length === 0) {
            for (const { lt, targetIdx } of learnerTurnTargets) {
              const prompt = buildLearnerEvaluationPrompt({
                turns: reconstructedTurns,
                targetTurnIndex: targetIdx,
                personaId: profileName,
                personaDescription,
                learnerArchitecture: isMultiAgent ? 'multi_agent' : 'unified',
                scenarioName: scenarioNameForLearner,
                topic: scenarioId,
              });
              const parsed = await retryWithBackoff(async () => callJudge(prompt), {});
              const turnOverall = calculateLearnerOverallScore(parsed.scores || {}, isMultiAgent);
              learnerTurnScores[lt] = { scores: parsed.scores, overallScore: turnOverall };
            }
          }

          // Learner holistic
          let holisticResult = null;
          if (learnerTurns.length > 0) {
            const holisticPrompt = buildLearnerHolisticEvaluationPrompt({
              turns: reconstructedTurns,
              personaId: profileName,
              personaDescription,
              learnerArchitecture: isMultiAgent ? 'multi_agent' : 'unified',
              scenarioName: scenarioNameForLearner,
              topic: scenarioId,
            });
            const parsedHolistic = await retryWithBackoff(async () => callJudge(holisticPrompt), {});
            const holisticScores = parsedHolistic.scores || {};
            holisticResult = {
              holisticScores,
              holisticOverallScore: calculateLearnerOverallScore(holisticScores, isMultiAgent),
              holisticSummary: parsedHolistic.summary || null,
            };
          }

          // Echo detection: reject identical score vectors across turns
          const ltEntries = Object.values(learnerTurnScores);
          if (ltEntries.length >= 2) {
            const sigs = ltEntries.map((ts) =>
              Object.keys(ts.scores || {})
                .sort()
                .map((k) => `${k}=${typeof ts.scores[k] === 'object' ? ts.scores[k].score : ts.scores[k]}`)
                .join(','),
            );
            if (sigs.every((s) => s === sigs[0])) {
              log(`    learner SKIP: all ${ltEntries.length} turns have identical scores (echoed example)`);
              return { phase: 'learner', success: false };
            }
          }

          // Write to DB
          const learnerAvg =
            Object.keys(learnerTurnScores).length > 0
              ? Object.values(learnerTurnScores).reduce((a, b) => a + b.overallScore, 0) /
                Object.values(learnerTurnScores).length
              : null;

          const updateData = {
            scores: learnerTurnScores,
            overallScore: learnerAvg,
            judgeModel,
          };
          if (holisticResult) {
            updateData.holisticScores = holisticResult.holisticScores;
            updateData.holisticOverallScore = holisticResult.holisticOverallScore;
            updateData.holisticSummary = holisticResult.holisticSummary;
            updateData.holisticJudgeModel = judgeModel;
          }
          evaluationStore.updateResultLearnerScores(rowId, updateData);

          log(`    learner: avg=${learnerAvg?.toFixed(1) ?? '?'}${holisticResult ? ` holistic=${holisticResult.holisticOverallScore?.toFixed(1) ?? '?'}` : ''}`);
          return { phase: 'learner', success: true, score: learnerAvg };
        } catch (err) {
          log(`    learner scoring FAIL: ${err.message}`);
          return { phase: 'learner', success: false };
        }
      })(),
    );
    phaseLabels.push('learner');
  }

  // Phase 2: Dialogue quality (public)
  if (!skipLearner) {
    const dqPromptParams = {
      turns: transcriptTurns,
      dialogueTrace,
      scenarioName: fullScenario.name,
      scenarioDescription: fullScenario.description,
      topic: fullScenario.topic || fullScenario.name,
      turnCount: totalTurns,
      learnerContext: learnerCtx,
      transcriptArtifacts,
    };

    promises.push(
      (async () => {
        try {
          const publicPrompt = rubricEvaluator.buildDialogueQualityPrompt({ ...dqPromptParams, transcriptMode: 'public' });
          const publicParsed = await retryWithBackoff(async () => callJudge(publicPrompt), {});
          const publicScores = {};
          for (const [key, value] of Object.entries(publicParsed.scores || {})) {
            if (typeof value === 'object' && value !== null) {
              publicScores[key] = { score: value.score, reasoning: value.reasoning };
            } else if (typeof value === 'number') {
              publicScores[key] = { score: value, reasoning: null };
            }
          }
          const score =
            Object.keys(publicScores).length > 0
              ? rubricEvaluator.calculateDialogueQualityScore(publicScores)
              : publicParsed.overall_score;

          evaluationStore.updateDialogueQualityScore(rowId, {
            dialogueQualityScore: score,
            dialogueQualitySummary: publicParsed.summary || null,
            dialogueQualityJudgeModel: judgeModel,
          });
          log(`    dialogue-quality(public)=${score?.toFixed(1)}`);
          return { phase: 'dgp', success: true, score };
        } catch (err) {
          log(`    dialogue-quality(public) FAIL: ${err.message}`);
          return { phase: 'dgp', success: false };
        }
      })(),
    );
    phaseLabels.push('dgp');

    // Phase 3: Dialogue quality (internal)
    promises.push(
      (async () => {
        try {
          const fullPrompt = rubricEvaluator.buildDialogueQualityPrompt({ ...dqPromptParams, transcriptMode: 'full' });
          const fullParsed = await retryWithBackoff(async () => callJudge(fullPrompt), {});
          const fullScores = {};
          for (const [key, value] of Object.entries(fullParsed.scores || {})) {
            if (typeof value === 'object' && value !== null) {
              fullScores[key] = { score: value.score, reasoning: value.reasoning };
            } else if (typeof value === 'number') {
              fullScores[key] = { score: value, reasoning: null };
            }
          }
          const score =
            Object.keys(fullScores).length > 0
              ? rubricEvaluator.calculateDialogueQualityScore(fullScores)
              : fullParsed.overall_score;

          evaluationStore.updateDialogueQualityInternalScore(rowId, {
            dialogueQualityInternalScore: score,
            dialogueQualityInternalSummary: fullParsed.summary || null,
          });
          log(`    dialogue-quality(full)=${score?.toFixed(1)}`);
          return { phase: 'dgi', success: true, score };
        } catch (err) {
          log(`    dialogue-quality(full) FAIL: ${err.message}`);
          return { phase: 'dgi', success: false };
        }
      })(),
    );
    phaseLabels.push('dgi');
  }

  // Phase 4: Tutor holistic (only for multi-turn)
  if (!skipLearner && totalTurns > 1) {
    promises.push(
      (async () => {
        try {
          const hasRecognition = result.factorRecognition || profileName.includes('recog');
          const holisticPrompt = rubricEvaluator.buildTutorHolisticEvaluationPrompt({
            turns: transcriptTurns,
            dialogueTrace,
            scenarioName: fullScenario.name || scenarioId,
            scenarioDescription: fullScenario.description,
            learnerContext: learnerCtx,
            hasRecognition,
            transcriptArtifacts,
          });
          const parsedHolistic = await retryWithBackoff(async () => callJudge(holisticPrompt), {});
          const holisticScores = parsedHolistic.scores || {};
          const score = rubricEvaluator.calculateTutorHolisticScore(holisticScores, hasRecognition);

          evaluationStore.updateResultTutorHolisticScores(rowId, {
            holisticScores,
            holisticOverallScore: score,
            holisticSummary: parsedHolistic.summary || null,
            holisticJudgeModel: judgeModel,
          });
          log(`    tutor-holistic=${score?.toFixed(1)}`);
          return { phase: 'tutor-holistic', success: true, score };
        } catch (err) {
          log(`    tutor-holistic FAIL: ${err.message}`);
          return { phase: 'tutor-holistic', success: false };
        }
      })(),
    );
    phaseLabels.push('tutor-holistic');
  }

  // Phase 5: Tutor deliberation (gated by hasTutorSuperego)
  if (!skipDeliberation && rubricEvaluator.hasTutorSuperego(dialogueTrace)) {
    const deliberationParams = {
      turns: transcriptTurns,
      dialogueTrace,
      scenarioName: fullScenario.name || scenarioId,
      scenarioDescription: fullScenario.description,
      learnerContext: learnerCtx,
    };
    promises.push(
      (async () => {
        try {
          const prompt = rubricEvaluator.buildTutorDeliberationPrompt(deliberationParams);
          const parsed = await retryWithBackoff(async () => callJudge(prompt), {});
          const scores = parsed.scores || {};
          const score =
            Object.keys(scores).length > 0 ? rubricEvaluator.calculateDeliberationScore(scores) : parsed.overall_score;

          evaluationStore.updateTutorDeliberationScores(rowId, {
            deliberationScores: scores,
            deliberationScore: score,
            deliberationSummary: parsed.summary || null,
            deliberationJudgeModel: judgeModel,
          });
          log(`    tutor-deliberation=${score?.toFixed(1)}`);
          return { phase: 'tutor-delib', success: true, score };
        } catch (err) {
          log(`    tutor-deliberation FAIL: ${err.message}`);
          return { phase: 'tutor-delib', success: false };
        }
      })(),
    );
    phaseLabels.push('tutor-delib');
  }

  // Phase 6: Learner deliberation (gated by isMultiAgent)
  if (!skipDeliberation && isMultiAgent) {
    const deliberationParams = {
      turns: transcriptTurns,
      dialogueTrace,
      scenarioName: fullScenario.name || scenarioId,
      scenarioDescription: fullScenario.description,
      learnerContext: learnerCtx,
    };
    promises.push(
      (async () => {
        try {
          const prompt = rubricEvaluator.buildLearnerDeliberationPrompt(deliberationParams);
          const parsed = await retryWithBackoff(async () => callJudge(prompt), {});
          const scores = parsed.scores || {};
          const score =
            Object.keys(scores).length > 0 ? rubricEvaluator.calculateDeliberationScore(scores) : parsed.overall_score;

          evaluationStore.updateLearnerDeliberationScores(rowId, {
            deliberationScores: scores,
            deliberationScore: score,
            deliberationSummary: parsed.summary || null,
            deliberationJudgeModel: judgeModel,
          });
          log(`    learner-deliberation=${score?.toFixed(1)}`);
          return { phase: 'learner-delib', success: true, score };
        } catch (err) {
          log(`    learner-deliberation FAIL: ${err.message}`);
          return { phase: 'learner-delib', success: false };
        }
      })(),
    );
    phaseLabels.push('learner-delib');
  }

  // Phase 7: Process measures (no judge call, just extract from dialogue log)
  const tm = dialogueLog.transformationMetrics;
  if (tm) {
    evaluationStore.updateProcessMeasures(rowId, {
      adaptationIndex: tm.tutorAdaptationIndex ?? null,
      learnerGrowthIndex: tm.learnerGrowthIndex ?? null,
      bilateralTransformationIndex: tm.bilateralTransformationIndex ?? null,
      incorporationRate: tm.superegoMetrics?.incorporationRate ?? null,
      dimensionConvergence: tm.dimensionConvergence ?? null,
      transformationQuality: tm.transformationQuality ?? null,
    });
  }

  // Wait for all judge phases
  if (promises.length > 0) {
    await Promise.all(promises);
  }
}

/**
 * Re-judge all results in an existing run without regenerating tutor responses.
 *
 * By default, creates NEW rows preserving judgment history (for inter-judge reliability).
 * Use --overwrite to replace existing scores instead.
 *
 * @param {string} runId - The run to rejudge
 * @param {Object} options
 * @param {string} [options.judgeOverride] - Override judge model (e.g. 'openrouter.nemotron')
 * @param {string} [options.judgeCli] - CLI judge backend ('claude', 'gemini', 'codex')
 * @param {string} [options.judgeCliModel] - Optional CLI judge model override
 * @param {boolean} [options.verbose] - Show per-result progress
 * @param {string} [options.scenarioFilter] - Only rejudge results for this scenario ID
 * @param {number} [options.parallelism] - Concurrent judge calls (default 3)
 * @param {boolean} [options.overwrite] - If true, update existing rows instead of creating new ones
 * @param {boolean} [options.skipLearner] - Skip learner, dialogue, and holistic scoring (tutor-only rejudge)
 * @param {boolean} [options.skipDeliberation] - Skip deliberation scoring
 * @returns {Promise<Object>} Summary stats
 */
export async function rejudgeRun(runId, options = {}) {
  const {
    judgeOverride = null,
    judgeCli = null,
    judgeCliModel = null,
    verbose = false,
    scenarioFilter = null,
    parallelism = DEFAULT_PARALLELISM,
    overwrite = false,
    skipLearner = false,
    skipDeliberation = false,
  } = options;

  const log = verbose ? console.log : () => {};

  const run = evaluationStore.getRun(runId);
  if (!run) throw new Error(`Run not found: ${runId}`);

  if (judgeOverride && judgeCli) {
    throw new Error('Use either judgeOverride or judgeCli, not both');
  }
  if (judgeCli && !SUPPORTED_JUDGE_CLIS.has(String(judgeCli).toLowerCase())) {
    throw new Error(`Unsupported judge CLI: ${judgeCli}`);
  }

  let results = evaluationStore.getResults(runId, {
    scenarioId: scenarioFilter || null,
  });

  // Skip results that have no suggestions (errors / failed generation)
  results = results.filter((r) => r.success && r.suggestions?.length > 0);

  if (results.length === 0) {
    throw new Error('No successful results with suggestions found to rejudge');
  }

  // Resolve the target judge label so we can detect prior rejudgments by the same judge
  let targetJudgeLabel = null;
  const effectiveCliJudgeModel = judgeCli
    ? judgeCliModel || getDefaultCliJudgeModelOverride(judgeCli)
    : null;
  if (!overwrite) {
    try {
      if (judgeCli) {
        targetJudgeLabel = getCliJudgeModelLabel(judgeCli, effectiveCliJudgeModel);
      } else {
        const judge = rubricEvaluator.getAvailableJudge(judgeOverride ? { judgeOverride: { model: judgeOverride } } : {});
        targetJudgeLabel = rubricEvaluator.normalizeJudgeLabel(judge.provider, judge.model);
      }
    } catch {
      // If we can't resolve, skip the cross-call dedup (fall back to within-call dedup only)
    }
  }

  // Helper: check whether a row has complete multi-turn scores (all scoring phases done)
  function hasCompleteScores(r) {
    // Single-turn: just needs tutor_first_turn_score
    const isMultiTurn = r.dialogueId && (
      (Array.isArray(r.suggestions) && r.suggestions.length > 1) ||
      (r.conversationMode === 'messages' && r.dialogueRounds > 1)
    );
    if (!isMultiTurn) return r.tutorFirstTurnScore != null;
    // Multi-turn: needs per-turn tutor scores + last-turn + dialogue quality
    return r.tutorScores != null && r.tutorLastTurnScore != null && r.dialogueQualityScore != null;
  }

  // Build a map of suggestion keys → existing rows judged by the target judge.
  // In resume mode (default, no --overwrite): skip rows with COMPLETE scores.
  // Rows with incomplete scores (e.g. pre-fix single-shot only) are re-processed.
  const existingRowsByTarget = new Map(); // suggKey → row
  if (targetJudgeLabel) {
    for (const r of results) {
      if (r.judgeModel === targetJudgeLabel) {
        const suggKey = typeof r.suggestions === 'string' ? r.suggestions : JSON.stringify(r.suggestions);
        existingRowsByTarget.set(suggKey, r);
      }
    }
  }

  // Deduplicate: only rejudge unique responses (by suggestions content),
  // and skip responses already COMPLETELY judged by the target judge
  const seenSuggestions = new Set();
  const uniqueResults = [];
  let skippedComplete = 0;
  let resumeIncomplete = 0;
  for (const r of results) {
    const suggKey = typeof r.suggestions === 'string' ? r.suggestions : JSON.stringify(r.suggestions);
    if (seenSuggestions.has(suggKey)) continue;
    seenSuggestions.add(suggKey);
    // Check if target judge already scored this response
    const existing = existingRowsByTarget.get(suggKey);
    if (existing) {
      if (hasCompleteScores(existing)) {
        skippedComplete++;
        continue; // Fully scored — skip
      }
      // Incomplete scores — re-process with overwrite behavior on that row
      r._overwriteRowId = existing.id;
      resumeIncomplete++;
    }
    uniqueResults.push(r);
  }

  const skipped = results.length - uniqueResults.length - resumeIncomplete;
  results = uniqueResults;

  console.log(
    `\nRejudging ${results.length} unique results from run ${runId}${skippedComplete > 0 ? ` (skipping ${skippedComplete} already complete)` : ''}${resumeIncomplete > 0 ? ` (resuming ${resumeIncomplete} incomplete)` : ''}`,
  );
  if (judgeOverride) console.log(`  Judge override: ${judgeOverride}`);
  if (judgeCli) console.log(`  Judge CLI: ${judgeCli}${effectiveCliJudgeModel ? ` (${effectiveCliJudgeModel})` : ''}`);
  if (scenarioFilter) console.log(`  Scenario filter: ${scenarioFilter}`);

  // Capture old scores for before/after comparison
  const oldScores = results.map((r) => r.tutorFirstTurnScore).filter((s) => s != null);
  const oldAvg = oldScores.length > 0 ? oldScores.reduce((a, b) => a + b, 0) / oldScores.length : null;

  let completed = 0;
  let succeeded = 0;
  let failed = 0;
  const newScores = [];

  // Build judge override object if provided
  // rubricEvaluator expects { judgeOverride: { model: "..." } }
  const judgeOverrideObj = judgeOverride ? { judgeOverride: { model: judgeOverride } } : {};

  // Parallel worker pool (same pattern as main eval loop)
  const items = [...results];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      const result = items[i];

      try {
        const fullScenario = evalConfigLoader.getScenario(result.scenarioId);
        if (!fullScenario) {
          throw new Error(`Scenario not found: ${result.scenarioId}`);
        }

        const suggestion =
          result.dialogueId && result.suggestions.length > 1
            ? result.suggestions[result.suggestions.length - 1]
            : result.suggestions[0];

        // Load dialogue context for multi-turn results
        let dialogueContext = null;
        let dialogueLog = null;
        if (result.dialogueId) {
          const logPath = path.join(LOGS_DIR, `${result.dialogueId}.json`);
          try {
            if (fs.existsSync(logPath)) {
              dialogueLog = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
              if (dialogueLog.isMultiTurn && dialogueLog.dialogueTrace?.length > 0) {
                dialogueContext = {
                  consolidatedTrace: dialogueLog.dialogueTrace,
                  conversationHistory: (dialogueLog.turnResults || []).map((t, ti) => ({
                    turnIndex: ti,
                    turnId: t.turnId,
                    suggestion: t.suggestions?.[0],
                    learnerAction: t.learnerAction,
                    learnerMessage: t.learnerMessage,
                  })),
                };
              }
            }
          } catch (e) {
            log(`  Warning: could not load dialogue log for ${result.dialogueId}: ${e.message}`);
          }
        }

        const scenarioContext = {
          name: fullScenario.name,
          description: fullScenario.description,
          expectedBehavior: fullScenario.expected_behavior,
          learnerContext: fullScenario.learner_context,
          requiredElements: fullScenario.required_elements,
          forbiddenElements: fullScenario.forbidden_elements,
        };

        const evaluation = judgeCli
          ? await retryWithBackoff(
              async () => {
                const prompt = rubricEvaluator.buildEvaluationPrompt(suggestion, scenarioContext, { dialogueContext });
                const startTime = Date.now();
                const parsed = await callCliJudge(prompt, judgeCli, effectiveCliJudgeModel);
                return normalizeCliJudgeEvaluation(
                  parsed,
                  getCliJudgeModelLabel(judgeCli, effectiveCliJudgeModel),
                  Date.now() - startTime,
                );
              },
              {},
            )
          : await retryWithBackoff(
              () => rubricEvaluator.evaluateSuggestion(suggestion, scenarioContext, { dialogueContext }, judgeOverrideObj),
              {},
            );

        if (evaluation.success) {
          // Map evaluationTimeMs → judgeLatencyMs for DB storage
          evaluation.judgeLatencyMs = evaluation.evaluationTimeMs ?? null;
          let rowId;
          if (overwrite || result._overwriteRowId) {
            // Update in place: explicit --overwrite, or resuming an incomplete row
            const targetId = result._overwriteRowId || result.id;
            evaluationStore.updateResultScores(targetId, evaluation);
            rowId = targetId;
          } else {
            // Create new row (preserves history for reliability analysis)
            rowId = evaluationStore.storeRejudgment(result, evaluation);
          }
          succeeded++;
          if (evaluation.overallScore != null) newScores.push(evaluation.overallScore);
          const modeLabel = result._overwriteRowId ? 'resumed' : overwrite ? 'replaced' : 'added';
          // Always print one line per row so the user can see progress
          console.log(
            `  [${completed + 1}/${results.length}] ${result.scenarioId} / ${result.profileName}: ${evaluation.overallScore?.toFixed(1)} (${modeLabel}, was ${result.tutorFirstTurnScore?.toFixed(1) ?? '--'})`,
          );

          // Multi-turn: score learner, dialogue, holistic, deliberation
          if (result.dialogueId && dialogueLog?.isMultiTurn) {
            const judgeModelLabel = judgeCli
              ? getCliJudgeModelLabel(judgeCli, effectiveCliJudgeModel)
              : evaluation.judgeModel || null;
            try {
              await scoreMultiTurnRejudgment(rowId, result, dialogueLog, {
                judgeCli,
                judgeModel: judgeModelLabel,
                effectiveCliJudgeModel,
                judgeOverrideObj,
                log,
                skipLearner,
                skipDeliberation,
              });
            } catch (mtErr) {
              log(`    multi-turn scoring error: ${mtErr.message}`);
            }
          }
        } else {
          failed++;
          console.log(
            `  [${completed + 1}/${results.length}] ${result.scenarioId} / ${result.profileName}: JUDGE FAILED - ${evaluation.error}`,
          );
        }
      } catch (error) {
        failed++;
        console.log(
          `  [${completed + 1}/${results.length}] ${result.scenarioId} / ${result.profileName}: ERROR - ${error.message}`,
        );
      }

      completed++;
      await sleep(REQUEST_DELAY_MS);
    }
  }

  const workers = Array.from({ length: Math.min(parallelism, items.length) }, () => worker());
  await Promise.all(workers);

  const newAvg = newScores.length > 0 ? newScores.reduce((a, b) => a + b, 0) / newScores.length : null;

  return {
    runId,
    total: results.length,
    succeeded,
    failed,
    oldAvgScore: oldAvg,
    newAvgScore: newAvg,
    scoreDelta: oldAvg != null && newAvg != null ? newAvg - oldAvg : null,
  };
}

// Named exports for unit testing (these are internal helpers not part of the public API)
export {
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
