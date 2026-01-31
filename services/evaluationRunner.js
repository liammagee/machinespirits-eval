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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVAL_ROOT = path.resolve(__dirname, '..');
const LOGS_DIR = path.join(EVAL_ROOT, 'logs', 'tutor-dialogues');

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

/**
 * Eval-only profile names that need remapping to tutor-core profiles.
 */
const EVAL_ONLY_PROFILES = [
  'single_baseline', 'single_baseline_paid',
  'single_recognition', 'single_recognition_paid',
  'baseline', 'baseline_paid',
  'recognition', 'recognition_paid',
  'cell_1_base_single_unified', 'cell_2_base_single_psycho',
  'cell_3_base_multi_unified', 'cell_4_base_multi_psycho',
  'cell_5_recog_single_unified', 'cell_6_recog_single_psycho',
  'cell_7_recog_multi_unified', 'cell_8_recog_multi_psycho',
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
  const recognitionMode = evalProfile?.recognition_mode ?? false;

  let resolvedProfileName = profileName;
  if (profileName && EVAL_ONLY_PROFILES.includes(profileName)) {
    resolvedProfileName = recognitionMode ? 'recognition' : 'budget';
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
      resolved.factors = rawProfile.factors;
    }
    if (rawProfile?.learner_architecture) {
      resolved.learnerArchitecture = rawProfile.learner_architecture;
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

  const contextParts = [originalContext];

  if (conversationHistory.length > 0) {
    contextParts.push('\n### Conversation History');
    for (const turn of conversationHistory) {
      contextParts.push(formatTurnForContext(turn));
    }
  }

  if (previousSuggestion) {
    contextParts.push('\n### Previous Tutor Suggestion');
    contextParts.push(formatSuggestionForContext(previousSuggestion));
  }

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
  if (suggestion.reasoning) {
    lines.push(`**Reasoning**: ${suggestion.reasoning}`);
  }

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
  } = options;

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
        forbiddenElements: turnMeta.forbiddenElements,
      })
    : { passesRequired: false, passesForbidden: true, requiredMissing: ['No suggestions generated'] };

  log(`Validation: required=${validation.passesRequired ? 'PASS' : 'FAIL'}, forbidden=${validation.passesForbidden ? 'PASS' : 'FAIL'}`, validation.passesRequired && validation.passesForbidden ? 'success' : 'warning');

  let rubricResult = null;
  if (!skipRubricEval && suggestion) {
    log('Running AI rubric evaluation...', 'info');
    debugLog(`[evaluationRunner] Running rubric evaluation for ${scenarioId}...`);
    rubricResult = await rubricEvaluator.evaluateSuggestion(suggestion, {
      name: turnMeta.scenarioName,
      description: turnMeta.description,
      expectedBehavior: turnMeta.expectedBehavior,
      learnerContext: turnMeta.learnerContext,
      requiredElements: turnMeta.requiredElements,
      forbiddenElements: turnMeta.forbiddenElements,
    }, {}, { judgeOverride });

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
  if (rubricResult?.success) {
    turnScore = rubricResult.overallScore;
  } else if (suggestion) {
    turnScore = (validation.passesRequired ? 50 : 0) + (validation.passesForbidden ? 50 : 0);
  }

  return { genResult, suggestion, validation, rubricResult, turnScore };
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
  } = options;

  const log = verbose ? console.log : () => {};

  // Initialize content resolver from eval settings (opt-in)
  const contentConfig = evalConfigLoader.getContentConfig();
  if (contentConfig?.content_package_path) {
    contentResolver.configure({
      contentPackagePath: contentConfig.content_package_path,
      maxLectureChars: contentConfig.max_lecture_chars,
      includeSpeakerNotes: contentConfig.include_speaker_notes,
    });
    if (contentResolver.isConfigured()) {
      log('[evaluationRunner] Content resolver configured:', contentConfig.content_package_path);
    } else {
      log('[evaluationRunner] Content path set but directory not found — using fallback curriculum');
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
      packageVersion: pkg.version,
      gitCommit: getGitCommitHash(),
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

      log(`  [${completedTests}/${totalTests}] ${profileLabel} / ${scenario.id}: ${result.success ? `score=${result.overallScore?.toFixed(1)}` : 'FAILED'}`);

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
      log(`  [${completedTests}/${totalTests}] ${profileLabel} / ${scenario.id}: ERROR - ${error.message}`);

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

  // Update run status
  evaluationStore.updateRun(run.id, {
    status: 'completed',
    totalTests: results.length,
    completedAt: new Date().toISOString(),
  });

  // End monitoring session
  monitoringService.endSession(run.id);

  // Get aggregated stats
  const stats = evaluationStore.getRunStats(run.id);
  const scenarioStats = evaluationStore.getScenarioStats(run.id);

  return {
    runId: run.id,
    totalTests: results.length,
    successfulTests,
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
  const { skipRubricEval = false, outputSize = 'normal', verbose = false, onLog, superegoStrategy = null, judgeOverride = null } = options;

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
  const { skipRubricEval = false, outputSize = 'normal', verbose = false, log = () => {}, superegoStrategy = null, judgeOverride = null } = options;

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
  const context = tutorApi.buildContext(fullScenario.learner_context, curriculumContext);
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
  const { genResult, suggestion, validation, rubricResult, turnScore: overallScore } = await generateAndEvaluateTurn(
    context, resolvedConfig,
    {
      scenarioName: fullScenario.name,
      description: fullScenario.description,
      expectedBehavior: fullScenario.expected_behavior,
      learnerContext: fullScenario.learner_context,
      requiredElements: fullScenario.required_elements,
      forbiddenElements: fullScenario.forbidden_elements,
    },
    { skipRubricEval, outputSize, superegoStrategy, judgeOverride, useDialogue, maxRounds, log, scenarioId: scenario.id }
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
  const { skipRubricEval = false, outputSize = 'normal', verbose = false, log = () => {}, superegoStrategy = null, judgeOverride = null } = options;

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

  const turns = fullScenario.turns || [];
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

  const sharedTurnOptions = { skipRubricEval, outputSize, superegoStrategy, judgeOverride, useDialogue, maxRounds, log, scenarioId: scenario.id };

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

    const context = tutorApi.buildContext(contextStr, curriculumContext);
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
      forbiddenElements: isInitialTurn
        ? (fullScenario.forbidden_elements || [])
        : (turnDef.forbidden_elements || []),
    };

    // Call the SAME generation+evaluation code path as single-turn
    const { genResult, suggestion, validation, rubricResult, turnScore } =
      await generateAndEvaluateTurn(context, resolvedConfig, turnMeta, sharedTurnOptions);

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
      expectedBehavior: turnMeta.expectedBehavior,
      suggestion,
      scores: rubricResult?.scores && Object.keys(rubricResult.scores).length > 0 ? {
        relevance: rubricResult.scores.relevance?.score,
        specificity: rubricResult.scores.specificity?.score,
        pedagogical: rubricResult.scores.pedagogical?.score,
        personalization: rubricResult.scores.personalization?.score,
        actionability: rubricResult.scores.actionability?.score,
        tone: rubricResult.scores.tone?.score,
      } : null,
      turnScore,
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
  }

  // 5. Aggregate scores across turns
  const validTurnScores = turnResults.filter(t => t.turnScore !== null).map(t => t.turnScore);
  const overallScore = validTurnScores.length > 0
    ? validTurnScores.reduce((sum, s) => sum + s, 0) / validTurnScores.length
    : null;

  const aggregateDimensions = {};
  const baseDims = ['relevance', 'specificity', 'pedagogical', 'personalization', 'actionability', 'tone'];
  const recognitionDims = ['mutual_recognition', 'dialectical_responsiveness', 'memory_integration', 'transformative_potential'];
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
  };

  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
  const logPath = path.join(LOGS_DIR, `${dialogueId}.json`);
  fs.writeFileSync(logPath, JSON.stringify(consolidatedDialogue, null, 2));

  log(`[evaluationRunner] Multi-turn complete: ${turnResults.length} turns, avgScore=${overallScore?.toFixed(1)}`);

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
    baseScore,
    recognitionScore,
    turnResults,
    allTurnsPassed,
    passesRequired: turnResults.every(t => t.passesRequired),
    passesForbidden: turnResults.every(t => t.passesForbidden),
    factors: resolvedConfig.factors || null,
    learnerArchitecture: resolvedConfig.learnerArchitecture || null,
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
  } = options;

  const scenarios = [evalConfigLoader.listScenarios().find(s => s.id === scenarioId)].filter(Boolean);
  if (scenarios.length === 0) {
    throw new Error(`Scenario not found: ${scenarioId}`);
  }

  const result = await runSingleTest(scenarios[0], config, { verbose, skipRubricEval, outputSize, onLog, superegoStrategy, judgeOverride });
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
 * @param {string} runId - The run to rejudge
 * @param {Object} options
 * @param {string} [options.judgeOverride] - Override judge model (e.g. 'openrouter.nemotron')
 * @param {boolean} [options.verbose] - Show per-result progress
 * @param {string} [options.scenarioFilter] - Only rejudge results for this scenario ID
 * @param {number} [options.parallelism] - Concurrent judge calls (default 3)
 * @returns {Promise<Object>} Summary stats
 */
export async function rejudgeRun(runId, options = {}) {
  const {
    judgeOverride = null,
    verbose = false,
    scenarioFilter = null,
    parallelism = DEFAULT_PARALLELISM,
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

  log(`\nRejudging ${results.length} results from run ${runId}`);
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
  const judgeOverrideObj = judgeOverride ? { judgeOverride } : {};

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

        const evaluation = await retryWithBackoff(
          () => rubricEvaluator.evaluateSuggestion(suggestion, {
            name: fullScenario.name,
            description: fullScenario.description,
            expectedBehavior: fullScenario.expected_behavior,
            learnerContext: fullScenario.learner_context,
            requiredElements: fullScenario.required_elements,
            forbiddenElements: fullScenario.forbidden_elements,
          }, {}, judgeOverrideObj),
          {}
        );

        if (evaluation.success) {
          evaluationStore.updateResultScores(result.id, evaluation);
          succeeded++;
          if (evaluation.overallScore != null) newScores.push(evaluation.overallScore);
          log(`  [${completed + 1}/${results.length}] ${result.scenarioId} / ${result.profileName}: ${evaluation.overallScore?.toFixed(1)} (was ${result.overallScore?.toFixed(1) ?? '--'})`);
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

export default {
  runEvaluation,
  compareConfigurations,
  quickTest,
  listOptions,
  getRunResults,
  generateReport,
  rejudgeRun,
};
