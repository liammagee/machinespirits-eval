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
import { tutorApiService as tutorApi, monitoringService, tutorDialogueEngine as dialogueEngine } from '@machinespirits/tutor-core';
import * as rubricEvaluator from './rubricEvaluator.js';
import * as evaluationStore from './evaluationStore.js';
import * as evalConfigLoader from './evalConfigLoader.js';
import * as contentResolver from './contentResolver.js';
import { ProgressLogger, getProgressLogPath } from './progressLogger.js';
import { StreamingReporter } from './streamingReporter.js';
import * as anovaStats from './anovaStats.js';
import { generateLearnerResponse } from './learnerTutorInteractionEngine.js';
import * as turnComparisonAnalyzer from './turnComparisonAnalyzer.js';
import * as dialogueTraceAnalyzer from './dialogueTraceAnalyzer.js';
import * as promptRewriter from './promptRewriter.js';
import { mockGenerateResult, mockJudgeResult } from './mockProvider.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVAL_ROOT = path.resolve(__dirname, '..');
const LOGS_DIR = path.join(EVAL_ROOT, 'logs', 'tutor-dialogues');

// Redirect tutor-core logs to this repo's logs/ directory (if available)
import('@machinespirits/tutor-core').then(mod => {
  if (typeof mod.setLogDir === 'function') mod.setLogDir(path.join(EVAL_ROOT, 'logs'));
}).catch(() => { /* setLogDir not available in this tutor-core version */ });

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
 * Eval-only profile names that need remapping to tutor-core profiles.
 */
const EVAL_ONLY_PROFILES = [
  'single_baseline', 'single_baseline_paid',
  'single_recognition', 'single_recognition_paid',
  'single_enhanced',
  'baseline', 'baseline_paid',
  'recognition', 'recognition_paid',
  'enhanced',
  'cell_1_base_single_unified', 'cell_2_base_single_psycho',
  'cell_3_base_multi_unified', 'cell_4_base_multi_psycho',
  'cell_5_recog_single_unified', 'cell_6_recog_single_psycho',
  'cell_7_recog_multi_unified', 'cell_8_recog_multi_psycho',
  'cell_9_enhanced_single_unified', 'cell_10_enhanced_single_psycho',
  'cell_11_enhanced_multi_unified', 'cell_12_enhanced_multi_psycho',
  'cell_13_hardwired_single_unified', 'cell_14_hardwired_single_psycho',
  'cell_15_placebo_single_unified', 'cell_16_placebo_single_psycho',
  'cell_17_placebo_multi_unified', 'cell_18_placebo_multi_psycho',
  'cell_19_memory_single_unified', 'cell_20_recog_nomem_single_unified',
  'cell_21_recog_multi_unified_rewrite',
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
  if (profileName && EVAL_ONLY_PROFILES.includes(profileName)) {
    // Map eval profile to tutor-core profile based on prompt_type
    const promptType = evalProfile?.factors?.prompt_type;
    if (promptType === 'enhanced') {
      resolvedProfileName = 'enhanced';
    } else if (promptType === 'placebo') {
      resolvedProfileName = 'placebo';
    } else if (promptType === 'hardwired') {
      resolvedProfileName = 'hardwired';
    } else if (promptType === 'memory') {
      resolvedProfileName = 'memory';
    } else if (promptType === 'recognition_nomem') {
      resolvedProfileName = 'recognition_nomem';
    } else if (recognitionMode) {
      resolvedProfileName = 'recognition';
    } else {
      resolvedProfileName = 'budget';
    }
  }

  return { useDialogue, maxRounds, recognitionMode, resolvedProfileName };
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
    } catch (e) { console.debug(`[evaluationRunner] resolveModel failed for ${config.provider}.${config.model}:`, e.message); }
  }
  if (config.egoModel) {
    try {
      const r = evalConfigLoader.resolveModel(config.egoModel);
      resolved.egoModel = r.model;
      resolved.egoProvider = r.provider;
    } catch (e) { console.debug(`[evaluationRunner] resolveModel failed for egoModel ${config.egoModel}:`, e.message); }
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
    }

    // Extract factorial factor tags and learner architecture from profile
    const rawProfile = evalConfigLoader.loadTutorAgents()?.profiles?.[resolved.profileName];
    if (rawProfile?.factors) {
      resolved.factors = { ...rawProfile.factors };
      // Normalize prompt_type → recognition boolean for DB storage
      if (resolved.factors.prompt_type && resolved.factors.recognition == null) {
        resolved.factors.recognition = resolved.factors.prompt_type === 'recognition';
      }
    }
    if (rawProfile?.learner_architecture) {
      resolved.learnerArchitecture = rawProfile.learner_architecture;
    }
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
  const clusters = filter.split(',').map(s => s.trim().toLowerCase());
  return scenarios.filter(s => {
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

// Debug logging helper - suppressed in transcript mode for clean output
function debugLog(...args) {
  if (process.env.TUTOR_TRANSCRIPT !== 'true') {
    console.log(...args);
  }
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
      const is429 = error?.message?.includes('429') ||
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
        context.log(`Rate limit exceeded, retrying in ${delayMs / 1000}s (attempt ${attempt + 1}/${maxRetries})`, 'warning');
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
    fields['Learner Type'] = 'Returning user' +
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
    previousSuggestion,
  } = options;

  const contextParts = [];

  // sessionEvolution is now injected into the system prompt (not user context).
  // See systemPromptExtension threading through generateAndEvaluateTurn → tutor-core.

  contextParts.push(originalContext);

  if (conversationHistory.length > 0) {
    contextParts.push('\n### Conversation History');
    for (const turn of conversationHistory) {
      contextParts.push(formatTurnForContext(turn));
    }
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
 * Format a previous turn for inclusion in context
 */
function formatTurnForContext(turn) {
  const lines = [];
  lines.push(`\n**Turn ${turn.turnIndex + 1}** (${turn.turnId})`);

  if (turn.suggestion) {
    lines.push(`- Tutor suggested: "${turn.suggestion.title || turn.suggestion.message?.substring(0, 100)}..."`);
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
function formatSuggestionForContext(suggestion) {
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
    'followed_suggestion': '✓ Followed suggestion',
    'ignored_suggestion': '✗ Ignored suggestion',
    'asked_followup': '❓ Asked follow-up question',
    'reported_confusion': '😕 Reported confusion',
    'completed_activity': '✅ Completed activity',
    'navigated_away': '🔄 Navigated away',
    'requested_hint': '💡 Requested hint',
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
    useDialogue = false,
    maxRounds = 0,
    log = () => {},
    scenarioId = '',
    systemPromptExtension = null,
    learnerId = null, // For Writing Pad memory persistence
    dryRun = false,
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
  const genResult = await retryWithBackoff(
    () => tutorApi.generateSuggestions(context, {
      provider: resolvedConfig.provider,
      model: resolvedConfig.model,
      egoModel: resolvedConfig.egoModel,
      superegoModel: resolvedConfig.superegoModel || null,
      profileName: resolvedConfig.profileName,
      hyperparameters: resolvedConfig.hyperparameters || {},
      trace: true,
      superegoStrategy,
      outputSize,
      useDialogue,
      maxRounds,
      systemPromptExtension,
      learnerId, // Activates Writing Pad three-layer memory
    }),
    { log }
  );

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

  log(`Validation: required=${validation.passesRequired ? 'PASS' : 'FAIL'}, forbidden=${validation.passesForbidden ? 'PASS' : 'FAIL'}`, validation.passesRequired && validation.passesForbidden ? 'success' : 'warning');

  let rubricResult = null;
  if (!skipRubricEval && suggestion) {
    log('Running AI rubric evaluation...', 'info');
    debugLog(`[evaluationRunner] Running rubric evaluation for ${scenarioId}...`);

    // Build dialogue context for the judge (if available from multi-turn)
    const dialogueContext = (options.conversationHistory || options.dialogueTrace || options.consolidatedTrace)
      ? {
          conversationHistory: options.conversationHistory || null,
          dialogueTrace: options.dialogueTrace || null,
          consolidatedTrace: options.consolidatedTrace || null,
        }
      : null;

    rubricResult = await rubricEvaluator.evaluateSuggestion(suggestion, {
      name: turnMeta.scenarioName,
      description: turnMeta.description,
      expectedBehavior: turnMeta.expectedBehavior,
      learnerContext: turnMeta.learnerContext,
      requiredElements: turnMeta.requiredElements,
      forbiddenElements: turnMeta.forbiddenElements,
    }, { dialogueContext }, { judgeOverride });

    if (rubricResult) {
      debugLog(`[evaluationRunner] Rubric result: success=${rubricResult.success}, ` +
        `overallScore=${rubricResult.overallScore}, ` +
        `scoresCount=${Object.keys(rubricResult.scores || {}).length}, ` +
        `error=${rubricResult.error || 'none'}`);
      if (rubricResult.success) {
        log(`Rubric evaluation complete: score=${rubricResult.overallScore?.toFixed(1)}`, 'success');
      } else {
        log(`Rubric evaluation failed: ${rubricResult.error || 'unknown error'}`, 'error');
      }
    }
  } else if (skipRubricEval) {
    debugLog(`[evaluationRunner] Skipping rubric evaluation (--fast mode)`);
    log('Skipping AI rubric evaluation (fast mode)', 'info');
  } else if (!suggestion) {
    debugLog(`[evaluationRunner] Skipping rubric evaluation (no suggestion generated)`);
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
    log(`WARNING: Judge evaluation failed for ${scenarioId}; score stored as null (was: ${(validation.passesRequired ? 50 : 0) + (validation.passesForbidden ? 50 : 0)} from keyword fallback). Error: ${rubricResult.error || 'unknown'}`, 'warning');
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
    scenarios = 'all',          // Which scenarios to run ('all' or array of IDs)
    configurations = 'all',     // Which configs to test ('all', 'profiles', or array)
    runsPerConfig = 1,          // Repetitions for statistical significance
    parallelism = DEFAULT_PARALLELISM,
    skipRubricEval = false,     // Skip AI-based rubric evaluation (faster)
    description = null,
    verbose = false,
    scenarioFilter = null,      // Cluster filter: 'single-turn', 'multi-turn', or category names
    modelOverride = null,       // CLI --model override (e.g. "openrouter.nemotron")
    egoModelOverride = null,    // CLI --ego-model override (replaces only ego model)
    superegoModelOverride = null, // CLI --superego-model override (replaces only superego model)
    dryRun = false,             // Use mock data instead of API calls
  } = options;

  const log = verbose ? console.log : () => {};

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
  let targetScenarios = scenarios === 'all'
    ? allScenarios
    : allScenarios.filter(s => scenarios.includes(s.id));

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
      'cell_1_base_single_unified', 'cell_2_base_single_psycho',
      'cell_3_base_multi_unified', 'cell_4_base_multi_psycho',
      'cell_5_recog_single_unified', 'cell_6_recog_single_psycho',
      'cell_7_recog_multi_unified', 'cell_8_recog_multi_psycho',
    ];
    targetConfigs = FACTORIAL_CELLS.map(name => ({
      provider: null,
      model: null,
      profileName: name,
      label: name,
    }));
  } else if (configurations === 'profiles') {
    const profiles = evalConfigLoader.listTutorProfiles();
    targetConfigs = profiles.map(p => ({
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
  const effectiveEgoModelOverride = egoModelOverride || yamlOverrides.egoModelOverride;
  const effectiveSuperegoModelOverride = superegoModelOverride || yamlOverrides.superegoModelOverride;

  if (effectiveModelOverride) {
    targetConfigs = targetConfigs.map(c => ({ ...c, modelOverride: effectiveModelOverride }));
  }
  if (effectiveEgoModelOverride) {
    targetConfigs = targetConfigs.map(c => ({ ...c, egoModelOverride: effectiveEgoModelOverride }));
  }
  if (effectiveSuperegoModelOverride) {
    targetConfigs = targetConfigs.map(c => ({ ...c, superegoModelOverride: effectiveSuperegoModelOverride }));
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
      modelOverride: effectiveModelOverride || null,
      egoModelOverride: effectiveEgoModelOverride || null,
      superegoModelOverride: effectiveSuperegoModelOverride || null,
      // Store scenario IDs and profile names for accurate resume
      scenarioIds: targetScenarios.map(s => s.id),
      profileNames: targetConfigs.map(c => c.profileName).filter(Boolean),
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

  const profileNames = targetConfigs.map(c => c.label || c.profileName || `${c.provider}/${c.model}`);
  const scenarioNames = targetScenarios.map(s => s.name || s.id);

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

    const workers = Array.from(
      { length: Math.min(workerCount, items.length) },
      () => worker()
    );
    await Promise.all(workers);
  }

  log(`\nRunning ${allTests.length} tests with parallelism=${parallelism}...\n`);

  const runStartTime = Date.now();

  await processQueue(allTests, parallelism, async ({ config, scenario }) => {
    const profileLabel = config.label || config.profileName || '';

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
        dryRun,
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
        overallScore: result.overallScore,
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

      log(`  ${formatProgress(completedTests, totalTests, runStartTime)} ${profileLabel} / ${scenario.id}: ${result.success ? `score=${result.overallScore?.toFixed(1)}` : 'FAILED'}`);

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
      if (result.overallScore != null) sp.scores.push(result.overallScore);
      if (sp.completed >= sp.total) {
        completedScenarios++;
        const avgScore = sp.scores.length > 0
          ? sp.scores.reduce((a, b) => a + b, 0) / sp.scores.length
          : null;
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
      log(`  ${formatProgress(completedTests, totalTests, runStartTime)} ${profileLabel} / ${scenario.id}: ERROR - ${error.message}`);

      // Store failed result so it shows up in the database instead of silently disappearing
      // Extract provider/model from nested ego config if not at top level (profile-based configs)
      const failedResult = {
        scenarioId: scenario.id,
        scenarioName: scenario.name || scenario.id,
        profileName: config.profileName,
        provider: config.provider || config.ego?.provider || 'unknown',
        model: config.model || config.ego?.model || 'unknown',
        egoModel: config.egoModel
          ? `${config.egoModel.provider}.${config.egoModel.model}`
          : config.ego ? `${config.ego.provider}.${config.ego.model}` : null,
        superegoModel: config.superegoModel
          ? `${config.superegoModel.provider}.${config.superegoModel.model}`
          : config.superego ? `${config.superego.provider}.${config.superego.model}` : null,
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
        const avgScore = sp.scores.length > 0
          ? sp.scores.reduce((a, b) => a + b, 0) / sp.scores.length
          : null;
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

  const durationMs = Date.now() - runStartTime;
  const successfulTests = results.filter(r => r.success).length;
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
 * Run a single test (scenario + config combination)
 * Handles both single-turn and multi-turn scenarios
 */
async function runSingleTest(scenario, config, options = {}) {
  const { skipRubricEval = false, outputSize = 'normal', verbose = false, onLog, superegoStrategy = null, judgeOverride = null, dryRun = false } = options;

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
    return runMultiTurnTest(scenario, config, fullScenario, { ...options, log, judgeOverride });
  }

  // Single-turn evaluation (original logic)
  return runSingleTurnTest(scenario, config, fullScenario, { ...options, log, judgeOverride });
}

/**
 * Run a single-turn test
 */
async function runSingleTurnTest(scenario, config, fullScenario, options = {}) {
  const { skipRubricEval = false, outputSize = 'normal', verbose = false, log = () => {}, superegoStrategy = null, judgeOverride = null, dryRun = false } = options;

  // Resolve model aliases through eval's providers.yaml
  const resolvedConfig = resolveConfigModels(config);

  // Build context with optional curriculum content
  log('Building learner context...', 'info');
  const curriculumContext = contentResolver.isConfigured()
    ? contentResolver.buildCurriculumContext(
        contentResolver.resolveScenarioContent(fullScenario)
      )
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

  // Log config info
  log(`Generating suggestions with profile: ${resolvedConfig.profileName} (dialogue=${useDialogue}, rounds=${maxRounds}, recognition=${recognitionMode})`, 'info');
  log(`Provider: ${resolvedConfig.provider || 'from profile'}, Model: ${resolvedConfig.model || 'from profile'}`, 'info');
  if (resolvedConfig.egoModel) {
    const egoLabel = typeof resolvedConfig.egoModel === 'object'
      ? `${resolvedConfig.egoModel.provider}.${resolvedConfig.egoModel.model}`
      : resolvedConfig.egoModel;
    log(`Ego model override: ${egoLabel}`, 'info');
  }

  // Use shared generation + evaluation helper
  const { genResult, suggestion, validation, rubricResult, turnScore: overallScore, scoringMethod } = await generateAndEvaluateTurn(
    context, resolvedConfig,
    {
      scenarioName: fullScenario.name,
      description: fullScenario.description,
      expectedBehavior: fullScenario.expected_behavior,
      learnerContext: fullScenario.learner_context,
      requiredElements: fullScenario.required_elements,
      requiredElementsAny: fullScenario.required_elements_any,
      forbiddenElements: fullScenario.forbidden_elements,
    },
    { skipRubricEval, outputSize, superegoStrategy, judgeOverride, useDialogue, maxRounds, log, scenarioId: scenario.id, dryRun }
  );

  if (!genResult.success) {
    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      scenarioType: fullScenario.type || 'suggestion',
      provider: resolvedConfig.provider || genResult.metadata?.provider,
      model: resolvedConfig.model || genResult.metadata?.model,
      profileName: config.profileName,
      egoModel: resolvedConfig.egoModel
        ? `${resolvedConfig.egoModel.provider}.${resolvedConfig.egoModel.model}`
        : null,
      superegoModel: resolvedConfig.superegoModel
        ? `${resolvedConfig.superegoModel.provider}.${resolvedConfig.superegoModel.model}`
        : null,
      success: false,
      errorMessage: genResult.error,
      latencyMs: genResult.metadata?.latencyMs,
    };
  }

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    scenarioType: fullScenario.type || 'suggestion',
    provider: resolvedConfig.provider || genResult.metadata?.provider,
    model: resolvedConfig.model || genResult.metadata?.model,
    profileName: config.profileName,
    egoModel: resolvedConfig.egoModel
      ? `${resolvedConfig.egoModel.provider}.${resolvedConfig.egoModel.model}`
      : null,
    superegoModel: resolvedConfig.superegoModel
      ? `${resolvedConfig.superegoModel.provider}.${resolvedConfig.superegoModel.model}`
      : null,
    hyperparameters: config.hyperparameters,
    suggestions: genResult.suggestions,
    success: true,
    latencyMs: genResult.metadata?.latencyMs,
    inputTokens: genResult.metadata?.inputTokens,
    outputTokens: genResult.metadata?.outputTokens,
    dialogueRounds: genResult.metadata?.dialogueRounds,
    apiCalls: genResult.metadata?.apiCalls,
    cost: genResult.metadata?.totalCost,
    dialogueId: genResult.metadata?.dialogueId,
    scores: rubricResult?.scores && Object.keys(rubricResult.scores).length > 0 ? {
      relevance: rubricResult.scores.relevance?.score,
      specificity: rubricResult.scores.specificity?.score,
      pedagogical: rubricResult.scores.pedagogical?.score,
      personalization: rubricResult.scores.personalization?.score,
      actionability: rubricResult.scores.actionability?.score,
      tone: rubricResult.scores.tone?.score,
    } : null,
    scoresWithReasoning: rubricResult?.scores && Object.keys(rubricResult.scores).length > 0
      ? rubricResult.scores
      : null,
    overallScore,
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
  const { skipRubricEval = false, outputSize = 'normal', verbose = false, log = () => {}, superegoStrategy = null, judgeOverride = null, dryRun = false } = options;

  log(`[evaluationRunner] Running multi-turn scenario: ${scenario.id}`);

  // 1. Resolve config (models, profile) — same as single-turn
  const resolvedConfig = resolveConfigModels(config);
  const profileResolution = resolveEvalProfile(resolvedConfig.profileName);
  const { useDialogue, maxRounds } = profileResolution;
  resolvedConfig.profileName = profileResolution.resolvedProfileName;

  // 2. Build curriculum context — same as single-turn
  const curriculumContext = contentResolver.isConfigured()
    ? contentResolver.buildCurriculumContext(
        contentResolver.resolveScenarioContent(fullScenario)
      )
    : null;

  // 3. Generate dialogue ID for the session
  const dialogueId = `dialogue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  dialogueEngine.setCurrentDialogueId(dialogueId);

  // Generate synthetic learnerId for Writing Pad persistence across turns
  const learnerId = `eval-learner-${dialogueId}-${scenario.id.replace(/[^a-zA-Z0-9]/g, '')}`;
  log(`[evaluationRunner] Generated learnerId for Writing Pad: ${learnerId}`, 'info');

  // Deep-clone turns to prevent mutation of shared scenario objects across profiles
  const turns = JSON.parse(JSON.stringify(fullScenario.turns || []));
  const turnResults = [];
  let totalLatencyMs = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalApiCalls = 0;
  let totalCost = 0;
  let totalDialogueRounds = 0;

  let conversationHistory = [];
  let previousSuggestion = null;
  const consolidatedTrace = [];

  const sharedTurnOptions = { skipRubricEval, outputSize, superegoStrategy, judgeOverride, useDialogue, maxRounds, log, scenarioId: scenario.id, learnerId, dryRun };

  // Check if prompt rewriting is enabled for this profile
  const rawProfile = evalConfigLoader.loadTutorAgents()?.profiles?.[config.profileName];
  const promptRewritingEnabled = rawProfile?.prompt_rewriting?.enabled ?? false;
  const promptRewritingStrategy = rawProfile?.prompt_rewriting?.strategy ?? 'template';
  let sessionEvolution = null;

  // 4. Loop through turns (initial turn 0 + follow-up turns)
  const totalTurnCount = 1 + turns.length;
  for (let turnIdx = 0; turnIdx < totalTurnCount; turnIdx++) {
    const isInitialTurn = turnIdx === 0;
    const turnDef = isInitialTurn ? null : turns[turnIdx - 1];

    log(`[evaluationRunner] Turn ${turnIdx}/${totalTurnCount - 1}${isInitialTurn ? ' (initial)' : ` (${turnDef.id})`}`, 'info');

    // Show learner action in transcript mode (for follow-up turns)
    if (!isInitialTurn && dialogueEngine.isTranscriptMode()) {
      dialogueEngine.transcript('LEARNER ACTION', formatLearnerActionForTranscript(turnDef));
    }

    // Build context for this turn
    let contextStr;
    if (isInitialTurn) {
      contextStr = fullScenario.learner_context;
    } else {
      // Add previous turn to conversation history
      conversationHistory.push({
        turnIndex: turnIdx - 1,
        turnId: turnIdx === 1 ? 'initial' : turns[turnIdx - 2]?.id,
        suggestion: previousSuggestion,
        learnerAction: turnDef.learner_action,
        learnerMessage: turnDef.action_details?.message,
      });

      contextStr = buildMultiTurnContext({
        originalContext: fullScenario.learner_context,
        conversationHistory,
        currentTurn: turnDef,
        previousSuggestion,
      });
    }

    const structuredContextStr = structureLearnerContext(contextStr);
    const context = tutorApi.buildContext(structuredContextStr, curriculumContext);
    context.isNewUser = isInitialTurn ? fullScenario.is_new_user : false;

    // Build turn-specific rubric metadata
    const turnMeta = {
      scenarioName: isInitialTurn
        ? fullScenario.name
        : `${fullScenario.name} - Turn ${turnIdx}`,
      description: isInitialTurn
        ? fullScenario.description
        : `Turn: ${turnDef.learner_action}`,
      expectedBehavior: isInitialTurn
        ? fullScenario.expected_behavior
        : turnDef.expected_behavior,
      learnerContext: contextStr,
      requiredElements: isInitialTurn
        ? (fullScenario.required_elements || [])
        : (turnDef.required_elements || []),
      requiredElementsAny: isInitialTurn
        ? (fullScenario.required_elements_any || [])
        : (turnDef.required_elements_any || []),
      forbiddenElements: isInitialTurn
        ? (fullScenario.forbidden_elements || [])
        : (turnDef.forbidden_elements || []),
    };

    // Call the SAME generation+evaluation code path as single-turn
    // Pass dialogue context so the judge can see the full exchange
    const turnOptions = {
      ...sharedTurnOptions,
      ...(sessionEvolution ? { systemPromptExtension: sessionEvolution } : {}),
      conversationHistory: conversationHistory.length > 0 ? conversationHistory : null,
      consolidatedTrace: consolidatedTrace.length > 0 ? consolidatedTrace : null,
    };
    const { genResult, suggestion, validation, rubricResult, turnScore, scoringMethod } =
      await generateAndEvaluateTurn(context, resolvedConfig, turnMeta, turnOptions);

    if (!genResult.success) {
      const turnId = isInitialTurn ? 'initial' : turnDef.id;
      throw new Error(`Multi-turn scenario ${scenario.id}: Turn ${turnIdx} (${turnId}) failed to generate suggestions`);
    }

    // Accumulate dialogue traces
    if (genResult.dialogueTrace && genResult.dialogueTrace.length > 0) {
      // Insert user turn action entry before each turn (except initial)
      if (!isInitialTurn) {
        const histEntry = conversationHistory[conversationHistory.length - 1];
        consolidatedTrace.push({
          agent: 'user',
          action: 'turn_action',
          turnIndex: turnIdx,
          contextSummary: histEntry?.learnerMessage || `${histEntry?.learnerAction || 'Action'}`,
          detail: `Learner: ${histEntry?.learnerAction}`,
          timestamp: new Date().toISOString(),
        });
      }
      consolidatedTrace.push(...genResult.dialogueTrace);

      // Add final delivery to user for multi-agent mode
      const hasSuperego = genResult.dialogueTrace.some(entry => entry.agent === 'superego');
      if (hasSuperego) {
        const suggCount = genResult.suggestions?.length || 0;
        consolidatedTrace.push({
          agent: 'user',
          action: 'final_output',
          turnIndex: turnIdx,
          from: 'ego',
          to: 'user',
          direction: 'response',
          suggestionCount: suggCount,
          contextSummary: `Delivered ${suggCount} suggestion${suggCount !== 1 ? 's' : ''}`,
          detail: `Turn ${turnIdx + 1} complete`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Collect per-turn result
    turnResults.push({
      turnIndex: turnIdx,
      turnId: isInitialTurn ? 'initial' : turnDef.id,
      learnerAction: isInitialTurn ? undefined : turnDef.learner_action,
      learnerMessage: isInitialTurn ? undefined : turnDef.action_details?.message,  // Include generated learner message for growth tracking
      expectedBehavior: turnMeta.expectedBehavior,
      suggestion,
      learnerDeliberation: turnDef?._learnerDeliberation || null,
      learnerEmotionalState: turnDef?._learnerEmotionalState || null,
      learnerMessageGenerated: !!turnDef?._learnerDeliberation,
      learnerOriginalMessage: turnDef?._originalMessage || null,
      scores: rubricResult?.scores && Object.keys(rubricResult.scores).length > 0 ? {
        relevance: rubricResult.scores.relevance?.score,
        specificity: rubricResult.scores.specificity?.score,
        pedagogical: rubricResult.scores.pedagogical?.score,
        personalization: rubricResult.scores.personalization?.score,
        actionability: rubricResult.scores.actionability?.score,
        tone: rubricResult.scores.tone?.score,
      } : null,
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
    totalDialogueRounds += genResult.metadata?.dialogueRounds || 0;

    // Update for next iteration
    previousSuggestion = suggestion;

    // Synthesize prompt rewriting directives for next turn (if enabled)
    if (promptRewritingEnabled && turnIdx < totalTurnCount - 1) {
      if (promptRewritingStrategy === 'llm') {
        // LLM-based directive synthesis using superego model
        try {
          sessionEvolution = await promptRewriter.synthesizeDirectivesLLM({
            turnResults,
            consolidatedTrace,
            conversationHistory,
            config: rawProfile,
          });
          if (sessionEvolution) {
            log(`[evaluationRunner] LLM rewriter generated directives for turn ${turnIdx + 1}`, 'info');
          }
        } catch (error) {
          log(`[evaluationRunner] LLM rewriter failed, falling back to template: ${error.message}`, 'warn');
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
        log(`[evaluationRunner] Prompt rewriter (${promptRewritingStrategy}) generated ${sessionEvolution.split('\n').length - 2} directives for turn ${turnIdx + 1}`, 'info');
      }
    }

    // Generate LLM learner response for next turn if ego_superego architecture
    // Note: check includes() to handle both 'ego_superego' and 'ego_superego_recognition'
    if (resolvedConfig.learnerArchitecture?.includes('ego_superego') && turnIdx < totalTurnCount - 1) {
      const nextTurnDef = turns[turnIdx]; // turnIdx is 0-based into the loop; turns[turnIdx] is the next follow-up turn
      if (nextTurnDef) {
        const learnerResponse = await generateLearnerResponse({
          tutorMessage: suggestion?.message || suggestion?.title || '',
          topic: fullScenario.topic || fullScenario.name || '',
          conversationHistory: conversationHistory.map(h => ({
            role: h.learnerMessage ? 'learner' : 'tutor',
            content: h.learnerMessage || h.suggestion?.message || '',
          })),
          learnerProfile: resolvedConfig.learnerArchitecture,
          personaId: fullScenario.learner_persona || 'eager_novice',
          modelOverride: config.modelOverride || null,
        });

        // Override scripted message with LLM-generated one
        nextTurnDef._originalMessage = nextTurnDef.action_details?.message;
        nextTurnDef.action_details = nextTurnDef.action_details || {};
        nextTurnDef.action_details.message = learnerResponse.message;
        nextTurnDef._learnerDeliberation = learnerResponse.internalDeliberation;
        nextTurnDef._learnerEmotionalState = learnerResponse.emotionalState;

        // Track learner LLM costs
        totalInputTokens += learnerResponse.tokenUsage?.inputTokens || 0;
        totalOutputTokens += learnerResponse.tokenUsage?.outputTokens || 0;
        totalApiCalls += learnerResponse.tokenUsage?.apiCalls || 0;

        // Add learner deliberation to consolidated trace
        if (learnerResponse.internalDeliberation?.length > 0) {
          for (const delib of learnerResponse.internalDeliberation) {
            consolidatedTrace.push({
              agent: `learner_${delib.role}`,
              action: 'deliberation',
              turnIndex: turnIdx + 1,
              contextSummary: delib.content.substring(0, 100),
              detail: delib.content,
              timestamp: new Date().toISOString(),
            });
          }
          consolidatedTrace.push({
            agent: 'learner_synthesis',
            action: 'response',
            turnIndex: turnIdx + 1,
            contextSummary: learnerResponse.message.substring(0, 100),
            detail: learnerResponse.message,
            timestamp: new Date().toISOString(),
          });
        }

        log(`[evaluationRunner] Generated LLM learner response (ego_superego): "${learnerResponse.message.substring(0, 80)}..."`, 'info');
      }
    }
  }

  // 5. Aggregate scores across turns
  const validTurnScores = turnResults.filter(t => t.turnScore !== null).map(t => t.turnScore);
  const overallScore = validTurnScores.length > 0
    ? validTurnScores.reduce((sum, s) => sum + s, 0) / validTurnScores.length
    : null;

  const aggregateDimensions = {};
  const baseDims = ['relevance', 'specificity', 'pedagogical', 'personalization', 'actionability', 'tone', 'productive_struggle', 'epistemic_honesty'];
  const recognitionDims = ['mutual_recognition', 'dialectical_responsiveness', 'memory_integration', 'transformative_potential', 'tutor_adaptation', 'learner_growth'];
  const allDims = [...baseDims, ...recognitionDims];
  for (const dim of allDims) {
    const dimScores = turnResults
      .filter(t => t.scores?.[dim] !== undefined)
      .map(t => t.scores[dim]);
    if (dimScores.length > 0) {
      aggregateDimensions[dim] = dimScores.reduce((sum, s) => sum + s, 0) / dimScores.length;
    }
  }

  const baseScoreValues = baseDims.filter(d => aggregateDimensions[d] !== undefined).map(d => aggregateDimensions[d]);
  const recognitionScoreValues = recognitionDims.filter(d => aggregateDimensions[d] !== undefined).map(d => aggregateDimensions[d]);
  const baseScore = baseScoreValues.length > 0
    ? ((baseScoreValues.reduce((s, v) => s + v, 0) / baseScoreValues.length - 1) / 4) * 100
    : null;
  const recognitionScore = recognitionScoreValues.length > 0
    ? ((recognitionScoreValues.reduce((s, v) => s + v, 0) / recognitionScoreValues.length - 1) / 4) * 100
    : null;

  const allTurnsPassed = turnResults.every(t => {
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
        const holisticResult = await rubricEvaluator.evaluateSuggestion(lastSuggestion, {
          name: `${fullScenario.name} (holistic dialogue)`,
          description: `Holistic evaluation of ${turnResults.length}-turn dialogue. Score the overall quality of the tutoring interaction, not just this final response.`,
          expectedBehavior: fullScenario.expected_behavior,
          learnerContext: fullScenario.learner_context,
          requiredElements: fullScenario.required_elements || [],
          forbiddenElements: fullScenario.forbidden_elements || [],
        }, {
          dialogueContext: {
            conversationHistory,
            consolidatedTrace,
          },
        }, { judgeOverride });

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
          log(`[evaluationRunner] Holistic dialogue evaluation failed: ${holisticResult?.error || 'unknown'}`, 'warning');
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

  // 6. Write consolidated dialogue log
  const consolidatedDialogue = {
    suggestions: turnResults[turnResults.length - 1]?.suggestion ? [turnResults[turnResults.length - 1].suggestion] : [],
    dialogueTrace: consolidatedTrace,
    converged: false,
    rounds: totalDialogueRounds,
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
    totalTurns: turnResults.length,
    turnResults: turnResults.map(t => ({
      turnIndex: t.turnIndex,
      turnId: t.turnId,
      suggestions: t.suggestion ? [t.suggestion] : [],
    })),
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
  const logPath = path.join(LOGS_DIR, `${dialogueId}.json`);
  fs.writeFileSync(logPath, JSON.stringify(consolidatedDialogue, null, 2));

  log(`[evaluationRunner] Multi-turn complete: ${turnResults.length} turns, avgScore=${overallScore?.toFixed(1)}`);

  // Aggregate requiredMissing/forbiddenFound from all turns
  const requiredMissing = [...new Set(turnResults.flatMap(t => t.requiredMissing || []))];
  const forbiddenFound = [...new Set(turnResults.flatMap(t => t.forbiddenFound || []))];

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
    egoModel: resolvedConfig.egoModel
      ? `${resolvedConfig.egoModel.provider}.${resolvedConfig.egoModel.model}`
      : null,
    superegoModel: resolvedConfig.superegoModel
      ? `${resolvedConfig.superegoModel.provider}.${resolvedConfig.superegoModel.model}`
      : null,
    hyperparameters: config.hyperparameters,
    suggestions: turnResults.map(t => t.suggestion).filter(Boolean),
    success: true,
    latencyMs: totalLatencyMs,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    apiCalls: totalApiCalls,
    cost: totalCost,
    dialogueId,
    dialogueRounds: totalDialogueRounds,
    scores: Object.keys(aggregateDimensions).length > 0 ? aggregateDimensions : null,
    overallScore,
    scoringMethod: turnResults.some(t => t.scoringMethod === 'judge_failed')
      ? 'partial_judge_failure'
      : turnResults.every(t => t.scoringMethod === 'rubric') ? 'rubric' : 'mixed',
    baseScore,
    recognitionScore,
    turnResults,
    allTurnsPassed,
    passesRequired: turnResults.every(t => t.passesRequired),
    passesForbidden: turnResults.every(t => t.passesForbidden),
    requiredMissing,
    forbiddenFound,
    factors: resolvedConfig.factors || null,
    learnerArchitecture: resolvedConfig.learnerArchitecture || null,
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
    force = false,  // Skip the "already running" check
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
        `Use --force to override (may cause duplicates).`
      );
    }
  }

  // 2. Extract metadata
  const metadata = run.metadata || {};
  const runsPerConfig = metadata.runsPerConfig || 1;
  const skipRubricEval = metadata.skipRubricEval || false;
  const modelOverride = metadata.modelOverride || null;

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
    scenarioIds = [...new Set(existingResults.map(r => r.scenarioId).filter(Boolean))];
  }
  const targetScenarios = allScenarios.filter(s => scenarioIds.includes(s.id));

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
    profileNames = [...new Set(existingResults.map(r => r.profileName).filter(Boolean))];
  }

  if (profileNames.length === 0) {
    throw new Error(`No profiles found for run ${runId} — cannot determine what to resume`);
  }

  let targetConfigs = profileNames.map(name => ({
    provider: null,
    model: null,
    profileName: name,
    label: name,
  }));

  // 6. Re-apply modelOverride if present in metadata
  if (modelOverride) {
    targetConfigs = targetConfigs.map(c => ({ ...c, modelOverride }));
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
  const totalExpectedTests = targetScenarios.length * targetConfigs.length * runsPerConfig;

  console.log(`\nResuming run: ${runId}`);
  console.log(`  Previously completed: ${existingResults.length} tests`);
  console.log(`  Remaining: ${totalRemainingTests} tests`);
  console.log(`  Profiles: ${profileNames.join(', ')}`);
  console.log(`  Scenarios: ${targetScenarios.length}`);
  if (modelOverride) console.log(`  Model override: ${modelOverride}`);

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
  const scenarioNames = targetScenarios.map(s => s.name || s.id);
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
    const testsForScenario = remainingTests.filter(t => t.scenario.id === scenario.id).length;
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

    const workers = Array.from(
      { length: Math.min(workerCount, items.length) },
      () => worker()
    );
    await Promise.all(workers);
  }

  log(`\nRunning ${totalRemainingTests} remaining tests with parallelism=${parallelism}...\n`);

  const runStartTime = Date.now();

  await processQueue(remainingTests, parallelism, async ({ config, scenario }) => {
    const profileLabel = config.label || config.profileName || '';

    progressLogger.testStart({
      scenarioId: scenario.id,
      scenarioName: scenario.name || scenario.id,
      profileName: profileLabel,
    });

    try {
      const result = await runSingleTest(scenario, config, {
        skipRubricEval,
        verbose,
      });

      evaluationStore.storeResult(runId, result);
      results.push(result);
      completedTests++;

      progressLogger.testComplete({
        scenarioId: scenario.id,
        scenarioName: scenario.name || scenario.id,
        profileName: profileLabel,
        success: result.success,
        overallScore: result.overallScore,
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

      log(`  ${formatProgress(completedTests, totalRemainingTests, runStartTime)} ${profileLabel} / ${scenario.id}: ${result.success ? `score=${result.overallScore?.toFixed(1)}` : 'FAILED'}`);

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
      if (result.overallScore != null) sp.scores.push(result.overallScore);
      if (sp.completed >= sp.total) {
        completedScenarios++;
        const avgScore = sp.scores.length > 0
          ? sp.scores.reduce((a, b) => a + b, 0) / sp.scores.length
          : null;
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
      log(`  ${formatProgress(completedTests, totalRemainingTests, runStartTime)} ${profileLabel} / ${scenario.id}: ERROR - ${error.message}`);

      // Store failed result so it shows up in the database
      const failedResult = {
        scenarioId: scenario.id,
        scenarioName: scenario.name || scenario.id,
        profileName: config.profileName,
        provider: config.provider || config.ego?.provider || 'unknown',
        model: config.model || config.ego?.model || 'unknown',
        egoModel: config.egoModel
          ? `${config.egoModel.provider}.${config.egoModel.model}`
          : config.ego ? `${config.ego.provider}.${config.ego.model}` : null,
        superegoModel: config.superegoModel
          ? `${config.superegoModel.provider}.${config.superegoModel.model}`
          : config.superego ? `${config.superego.provider}.${config.superego.model}` : null,
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
        const avgScore = sp.scores.length > 0
          ? sp.scores.reduce((a, b) => a + b, 0) / sp.scores.length
          : null;
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

  const durationMs = Date.now() - runStartTime;
  const successfulTests = results.filter(r => r.success).length;
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
    failedTests: allResults.filter(r => !r.success).length,
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
  const {
    scenarios = 'all',
    runsPerConfig = 1,
    verbose = false,
  } = options;

  // Run evaluation with specified configs
  const result = await runEvaluation({
    scenarios,
    configurations: configs,
    runsPerConfig,
    verbose,
    description: `Comparison: ${configs.map(c => c.label || c.profileName || `${c.provider}/${c.model}`).join(' vs ')}`,
  });

  // Build comparison
  const comparison = {
    runId: result.runId,
    configurations: configs,
    rankings: result.stats.sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0)).map((stat, i) => ({
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

  const scenarios = [evalConfigLoader.listScenarios().find(s => s.id === scenarioId)].filter(Boolean);
  if (scenarios.length === 0) {
    throw new Error(`Scenario not found: ${scenarioId}`);
  }

  const result = await runSingleTest(scenarios[0], config, { verbose, skipRubricEval, outputSize, onLog, superegoStrategy, judgeOverride, dryRun });
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
  lines.push('| Rank | Profile                          | Model                   | Overall |  Base  | Recog  | Latency | Pass |');
  lines.push('|------|----------------------------------|-------------------------|---------|--------|--------|---------|------|');

  stats.forEach((stat, i) => {
    const profile = (stat.profileName || 'N/A').substring(0, 32).padEnd(32);
    const model = (stat.model || '').substring(0, 23).padEnd(23);
    const score = stat.avgScore ? stat.avgScore.toFixed(1).padStart(7) : '    N/A';
    const base = stat.avgBaseScore ? stat.avgBaseScore.toFixed(1).padStart(6) : '   N/A';
    const recog = stat.avgRecognitionScore ? stat.avgRecognitionScore.toFixed(1).padStart(6) : '   N/A';
    const latency = stat.avgLatencyMs ? `${stat.avgLatencyMs.toFixed(0)}ms`.padStart(7) : '    N/A';
    const passRate = `${(stat.validationPassRate * 100).toFixed(0)}%`.padStart(4);
    lines.push(`| ${(i + 1).toString().padStart(4)} | ${profile} | ${model} | ${score} | ${base} | ${recog} | ${latency} | ${passRate} |`);
  });

  lines.push('');

  // Dimension breakdown
  if (stats.length > 0 && stats[0].dimensions) {
    lines.push('DIMENSION BREAKDOWN');
    lines.push('-'.repeat(80));

    const dims = ['relevance', 'specificity', 'pedagogical', 'personalization', 'actionability', 'tone'];
    const header = '| Dimension       |' + stats.map(s => ` ${(s.profileName || s.model).substring(0, 12).padEnd(12)} |`).join('');
    lines.push(header);
    lines.push('|-----------------|' + stats.map(() => '--------------|').join(''));

    for (const dim of dims) {
      const row = `| ${dim.padEnd(15)} |` + stats.map(s => {
        const score = s.dimensions?.[dim];
        return ` ${score ? score.toFixed(2).padStart(12) : '         N/A'} |`;
      }).join('');
      lines.push(row);
    }
    lines.push('');
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
    { column: 'overall_score', label: 'Overall Score' },
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
      const cellLabel = key.replace(/r(\d)_t(\d)_l(\d)/, (_, r, t, l) =>
        `Recog=${r === '1' ? 'Y' : 'N'} Tutor=${t === '1' ? 'Multi' : 'Single'} Learner=${l === '1' ? 'Psycho' : 'Unified'}`
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
 * Re-judge all results in an existing run without regenerating tutor responses.
 *
 * By default, creates NEW rows preserving judgment history (for inter-judge reliability).
 * Use --overwrite to replace existing scores instead.
 *
 * @param {string} runId - The run to rejudge
 * @param {Object} options
 * @param {string} [options.judgeOverride] - Override judge model (e.g. 'openrouter.nemotron')
 * @param {boolean} [options.verbose] - Show per-result progress
 * @param {string} [options.scenarioFilter] - Only rejudge results for this scenario ID
 * @param {number} [options.parallelism] - Concurrent judge calls (default 3)
 * @param {boolean} [options.overwrite] - If true, update existing rows instead of creating new ones
 * @returns {Promise<Object>} Summary stats
 */
export async function rejudgeRun(runId, options = {}) {
  const {
    judgeOverride = null,
    verbose = false,
    scenarioFilter = null,
    parallelism = DEFAULT_PARALLELISM,
    overwrite = false,
  } = options;

  const log = verbose ? console.log : () => {};

  const run = evaluationStore.getRun(runId);
  if (!run) throw new Error(`Run not found: ${runId}`);

  let results = evaluationStore.getResults(runId, {
    scenarioId: scenarioFilter || null,
  });

  // Skip results that have no suggestions (errors / failed generation)
  results = results.filter(r => r.success && r.suggestions?.length > 0);

  if (results.length === 0) {
    throw new Error('No successful results with suggestions found to rejudge');
  }

  // Deduplicate: only rejudge unique responses (by suggestions content)
  // This prevents cascading rejudgments when running multiple times
  const seenSuggestions = new Set();
  const uniqueResults = [];
  for (const r of results) {
    const suggKey = typeof r.suggestions === 'string' ? r.suggestions : JSON.stringify(r.suggestions);
    if (!seenSuggestions.has(suggKey)) {
      seenSuggestions.add(suggKey);
      uniqueResults.push(r);
    }
  }

  const skipped = results.length - uniqueResults.length;
  results = uniqueResults;

  log(`\nRejudging ${results.length} unique results from run ${runId}${skipped > 0 ? ` (skipping ${skipped} duplicates)` : ''}`);
  if (judgeOverride) log(`  Judge override: ${judgeOverride}`);
  if (scenarioFilter) log(`  Scenario filter: ${scenarioFilter}`);

  // Capture old scores for before/after comparison
  const oldScores = results.map(r => r.overallScore).filter(s => s != null);
  const oldAvg = oldScores.length > 0
    ? oldScores.reduce((a, b) => a + b, 0) / oldScores.length
    : null;

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

        const suggestion = result.suggestions[0];

        // Load dialogue context for multi-turn results
        let dialogueContext = null;
        if (result.dialogueId) {
          const logPath = path.join(LOGS_DIR, `${result.dialogueId}.json`);
          try {
            if (fs.existsSync(logPath)) {
              const dialogueLog = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
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

        const evaluation = await retryWithBackoff(
          () => rubricEvaluator.evaluateSuggestion(suggestion, {
            name: fullScenario.name,
            description: fullScenario.description,
            expectedBehavior: fullScenario.expected_behavior,
            learnerContext: fullScenario.learner_context,
            requiredElements: fullScenario.required_elements,
            forbiddenElements: fullScenario.forbidden_elements,
          }, { dialogueContext }, judgeOverrideObj),
          {}
        );

        if (evaluation.success) {
          if (overwrite) {
            // Old behavior: update in place (loses history)
            evaluationStore.updateResultScores(result.id, evaluation);
          } else {
            // New behavior: create new row (preserves history for reliability analysis)
            evaluationStore.storeRejudgment(result, evaluation);
          }
          succeeded++;
          if (evaluation.overallScore != null) newScores.push(evaluation.overallScore);
          const modeLabel = overwrite ? 'replaced' : 'added';
          log(`  [${completed + 1}/${results.length}] ${result.scenarioId} / ${result.profileName}: ${evaluation.overallScore?.toFixed(1)} (${modeLabel}, was ${result.overallScore?.toFixed(1) ?? '--'})`);
        } else {
          failed++;
          log(`  [${completed + 1}/${results.length}] ${result.scenarioId} / ${result.profileName}: JUDGE FAILED - ${evaluation.error}`);
        }
      } catch (error) {
        failed++;
        log(`  [${completed + 1}/${results.length}] ${result.scenarioId} / ${result.profileName}: ERROR - ${error.message}`);
      }

      completed++;
      await sleep(REQUEST_DELAY_MS);
    }
  }

  const workers = Array.from(
    { length: Math.min(parallelism, items.length) },
    () => worker()
  );
  await Promise.all(workers);

  const newAvg = newScores.length > 0
    ? newScores.reduce((a, b) => a + b, 0) / newScores.length
    : null;

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
export { structureLearnerContext, resolveConfigModels };

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
