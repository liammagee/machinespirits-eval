/**
 * Evaluation Runner Service
 *
 * Orchestrates the evaluation of AI tutor configurations across
 * test scenarios with rubric-based scoring.
 */

import { tutorApiService as tutorApi, monitoringService } from '@machinespirits/tutor-core';
import * as rubricEvaluator from './rubricEvaluator.js';
import * as evaluationStore from './evaluationStore.js';
import * as evalConfigLoader from './evalConfigLoader.js';
import * as multiTurnRunner from './multiTurnRunner.js';
import * as contentResolver from './contentResolver.js';
import { ProgressLogger, getProgressLogPath } from './progressLogger.js';
import { StreamingReporter } from './streamingReporter.js';

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
    } catch (e) { /* pass through as-is */ }
  }
  if (config.egoModel) {
    try {
      const r = evalConfigLoader.resolveModel(config.egoModel);
      resolved.egoModel = r.model;
      resolved.egoProvider = r.provider;
    } catch (e) { /* pass through as-is */ }
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
  }

  return resolved;
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
  const targetScenarios = scenarios === 'all'
    ? allScenarios
    : allScenarios.filter(s => scenarios.includes(s.id));

  if (targetScenarios.length === 0) {
    throw new Error('No scenarios to run');
  }

  // Resolve configurations
  let targetConfigs = [];
  if (configurations === 'all') {
    targetConfigs = evalConfigLoader.listConfigurations();
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

  // Create evaluation run record
  const run = evaluationStore.createRun({
    description: description || `Evaluation: ${targetConfigs.length} configs x ${targetScenarios.length} scenarios`,
    totalScenarios: targetScenarios.length,
    totalConfigurations: targetConfigs.length,
    metadata: {
      runsPerConfig,
      skipRubricEval,
    },
  });

  const totalTests = targetScenarios.length * targetConfigs.length * runsPerConfig;
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

  // Map eval-only profile names to tutor-core base profiles.
  // Eval profiles like 'single_baseline_paid' don't exist in tutor-core's tutor-agents.yaml,
  // causing "Profile not found" warnings. The explicit egoModel/superegoModel overrides
  // already force the correct model, so we just need a valid base profile for tutor-core.
  if (resolvedConfig.profileName) {
    const evalOnlyProfiles = [
      'single_baseline', 'single_baseline_paid',
      'single_recognition', 'single_recognition_paid',
      'baseline', 'baseline_paid',
      'recognition', 'recognition_paid',
    ];
    if (evalOnlyProfiles.includes(resolvedConfig.profileName)) {
      resolvedConfig.profileName = 'budget';
    }
  }

  // Generate suggestions
  log(`Generating suggestions with profile: ${resolvedConfig.profileName}`, 'info');
  log(`Provider: ${resolvedConfig.provider || 'from profile'}, Model: ${resolvedConfig.model || 'from profile'}`, 'info');
  if (resolvedConfig.egoModel) {
    const egoLabel = typeof resolvedConfig.egoModel === 'object'
      ? `${resolvedConfig.egoModel.provider}.${resolvedConfig.egoModel.model}`
      : resolvedConfig.egoModel;
    log(`Ego model override: ${egoLabel}`, 'info');
  }

  // Wrap API call with retry logic for rate limit handling
  const genResult = await retryWithBackoff(
    () => tutorApi.generateSuggestions(context, {
      provider: resolvedConfig.provider,
      model: resolvedConfig.model,
      egoModel: resolvedConfig.egoModel, // Override ego model for benchmarking
      superegoModel: resolvedConfig.superegoModel || null, // Override superego model for benchmarking
      profileName: resolvedConfig.profileName,
      hyperparameters: resolvedConfig.hyperparameters || {},
      trace: true, // Always capture trace for tension analysis
      superegoStrategy, // Pass through superego intervention strategy
      outputSize, // compact, normal, expanded - affects response length
    }),
    { log }
  );

  if (!genResult.success) {
    log(`Generation failed: ${genResult.error}`, 'error');
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
        requiredElements: fullScenario.required_elements,
        forbiddenElements: fullScenario.forbidden_elements,
      })
    : { passesRequired: false, passesForbidden: true, requiredMissing: ['No suggestions generated'] };

  log(`Validation: required=${validation.passesRequired ? 'PASS' : 'FAIL'}, forbidden=${validation.passesForbidden ? 'PASS' : 'FAIL'}`, validation.passesRequired && validation.passesForbidden ? 'success' : 'warning');

  let rubricResult = null;
  if (!skipRubricEval && suggestion) {
    // Full rubric evaluation with AI judge
    log('Running AI rubric evaluation...', 'info');
    debugLog(`[evaluationRunner] Running rubric evaluation for ${scenario.id}...`);
    rubricResult = await rubricEvaluator.evaluateSuggestion(suggestion, {
      name: fullScenario.name,
      description: fullScenario.description,
      expectedBehavior: fullScenario.expected_behavior,
      learnerContext: fullScenario.learner_context,
      requiredElements: fullScenario.required_elements,
      forbiddenElements: fullScenario.forbidden_elements,
    }, {}, { judgeOverride });

    // Log rubric result summary
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

  // Calculate overall score
  let overallScore = null;
  if (rubricResult?.success) {
    overallScore = rubricResult.overallScore;
  } else if (suggestion) {
    // Fallback: simple validation-based score
    overallScore = (validation.passesRequired ? 50 : 0) + (validation.passesForbidden ? 50 : 0);
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
    cost: genResult.metadata?.totalCost, // OpenRouter API cost in USD
    dialogueId: genResult.metadata?.dialogueId, // For linking to logs
    scores: rubricResult?.scores && Object.keys(rubricResult.scores).length > 0 ? {
      relevance: rubricResult.scores.relevance?.score,
      specificity: rubricResult.scores.specificity?.score,
      pedagogical: rubricResult.scores.pedagogical?.score,
      personalization: rubricResult.scores.personalization?.score,
      actionability: rubricResult.scores.actionability?.score,
      tone: rubricResult.scores.tone?.score,
    } : null,
    // Include full scores with reasoning for detailed analysis
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
    // Include dialogueResult for tension analysis
    dialogueResult: {
      dialogueTrace: genResult.dialogueTrace,
      dialogueRounds: genResult.metadata?.dialogueRounds,
      converged: genResult.metadata?.converged,
      dialogueId: genResult.metadata?.dialogueId,
    },
  };
}

/**
 * Run a multi-turn test
 * Evaluates each turn and aggregates scores
 */
async function runMultiTurnTest(scenario, config, fullScenario, options = {}) {
  const { skipRubricEval = false, verbose = false, judgeOverride = null } = options;
  const log = verbose ? console.log : () => {};

  log(`[evaluationRunner] Running multi-turn scenario: ${scenario.id}`);

  // Resolve model aliases through eval's providers.yaml
  const resolvedConfig = resolveConfigModels(config);

  const turns = fullScenario.turns || [];
  const turnResults = [];
  let totalLatencyMs = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalApiCalls = 0;
  let totalCost = 0;

  // Run the multi-turn scenario through local multiTurnRunner (with retry for rate limits)
  const multiTurnResult = await retryWithBackoff(
    () => multiTurnRunner.runMultiTurnScenario(scenario.id, {
      provider: resolvedConfig.provider,
      model: resolvedConfig.model,
      profileName: resolvedConfig.profileName,
      hyperparameters: resolvedConfig.hyperparameters || {},
      trace: verbose,
    }),
    { log }
  );

  // Validate that we got results
  if (!multiTurnResult.turnResults || multiTurnResult.turnResults.length === 0) {
    const errorMsg = `Multi-turn scenario returned no results (expected ${fullScenario.turns?.length + 1 || 1} turns)`;
    log(errorMsg, 'error');
    throw new Error(errorMsg);
  }

  // Evaluate each turn
  for (const turnResult of multiTurnResult.turnResults) {
    const suggestion = turnResult.suggestions?.[0];

    // Quick validation for this turn
    const validation = suggestion
      ? rubricEvaluator.quickValidate(suggestion, {
          requiredElements: turnResult.requiredElements,
          forbiddenElements: turnResult.forbiddenElements,
        })
      : { passesRequired: false, passesForbidden: true, requiredMissing: ['No suggestions generated'] };

    let rubricResult = null;
    if (!skipRubricEval && suggestion) {
      log(`[evaluationRunner] Running rubric evaluation for turn ${turnResult.turnIndex}...`);
      rubricResult = await rubricEvaluator.evaluateSuggestion(suggestion, {
        name: `${fullScenario.name} - Turn ${turnResult.turnIndex}`,
        description: turnResult.turnId === 'initial' ? fullScenario.description : `Turn: ${turnResult.learnerAction}`,
        expectedBehavior: turnResult.expectedBehavior,
        learnerContext: turnResult.context,
        requiredElements: turnResult.requiredElements,
        forbiddenElements: turnResult.forbiddenElements,
      }, {}, { judgeOverride });
    }

    // Calculate turn score
    let turnScore = null;
    if (rubricResult?.success) {
      turnScore = rubricResult.overallScore;
    } else if (suggestion) {
      turnScore = (validation.passesRequired ? 50 : 0) + (validation.passesForbidden ? 50 : 0);
    }

    turnResults.push({
      turnIndex: turnResult.turnIndex,
      turnId: turnResult.turnId,
      learnerAction: turnResult.learnerAction,
      expectedBehavior: turnResult.expectedBehavior,
      suggestion: suggestion,
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
      minAcceptableScore: turnResult.minAcceptableScore || fullScenario.min_acceptable_score,
    });

    // Aggregate metrics
    totalLatencyMs += turnResult.metadata?.latencyMs || 0;
    totalInputTokens += turnResult.metadata?.inputTokens || 0;
    totalOutputTokens += turnResult.metadata?.outputTokens || 0;
    totalApiCalls += turnResult.metadata?.apiCalls || 0;
    totalCost += turnResult.metadata?.totalCost || 0;
  }

  // Calculate aggregate scores
  const validTurnScores = turnResults.filter(t => t.turnScore !== null).map(t => t.turnScore);
  const overallScore = validTurnScores.length > 0
    ? validTurnScores.reduce((sum, s) => sum + s, 0) / validTurnScores.length
    : null;

  // Aggregate dimension scores
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

  // Calculate dual scores from aggregate dimensions
  const baseScoreValues = baseDims.filter(d => aggregateDimensions[d] !== undefined).map(d => aggregateDimensions[d]);
  const recognitionScoreValues = recognitionDims.filter(d => aggregateDimensions[d] !== undefined).map(d => aggregateDimensions[d]);
  const baseScore = baseScoreValues.length > 0
    ? ((baseScoreValues.reduce((s, v) => s + v, 0) / baseScoreValues.length - 1) / 4) * 100
    : null;
  const recognitionScore = recognitionScoreValues.length > 0
    ? ((recognitionScoreValues.reduce((s, v) => s + v, 0) / recognitionScoreValues.length - 1) / 4) * 100
    : null;

  // Check if all turns pass their thresholds
  const allTurnsPassed = turnResults.every(t => {
    if (t.turnScore === null) return false;
    const threshold = t.minAcceptableScore || fullScenario.min_acceptable_score || 0;
    return t.turnScore >= threshold;
  });

  log(`[evaluationRunner] Multi-turn complete: ${turnResults.length} turns, avgScore=${overallScore?.toFixed(1)}`);

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    scenarioType: fullScenario.type || 'suggestion',
    isMultiTurn: true,
    totalTurns: turnResults.length,
    provider: resolvedConfig.provider || multiTurnResult.turnResults[0]?.metadata?.provider,
    model: resolvedConfig.model || multiTurnResult.turnResults[0]?.metadata?.model,
    profileName: config.profileName,
    egoModel: resolvedConfig.egoModel
      ? `${resolvedConfig.egoModel.provider}.${resolvedConfig.egoModel.model}`
      : null,
    superegoModel: resolvedConfig.superegoModel
      ? `${resolvedConfig.superegoModel.provider}.${resolvedConfig.superegoModel.model}`
      : null,
    hyperparameters: config.hyperparameters,
    suggestions: multiTurnResult.turnResults.map(t => t.suggestions?.[0]).filter(Boolean),
    success: true,
    latencyMs: totalLatencyMs,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    apiCalls: totalApiCalls,
    cost: totalCost, // OpenRouter API cost in USD
    dialogueId: multiTurnResult.dialogueId, // Single continuous dialogue ID for all turns
    dialogueRounds: multiTurnResult.turnResults.reduce((sum, t) => sum + (t.metadata?.dialogueRounds || 0), 0), // Total across all turns
    scores: Object.keys(aggregateDimensions).length > 0 ? aggregateDimensions : null,
    overallScore,
    baseScore,
    recognitionScore,
    turnResults,
    allTurnsPassed,
    passesRequired: turnResults.every(t => t.passesRequired),
    passesForbidden: turnResults.every(t => t.passesForbidden),
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
      avgScore: stat.avgScore,
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
  lines.push('-'.repeat(80));
  lines.push('| Rank | Configuration                    | Avg Score | Latency | Pass Rate |');
  lines.push('|------|----------------------------------|-----------|---------|-----------|');

  stats.forEach((stat, i) => {
    const label = `${stat.provider}/${stat.model}`.substring(0, 32).padEnd(32);
    const score = stat.avgScore ? stat.avgScore.toFixed(1).padStart(9) : '     N/A';
    const latency = stat.avgLatencyMs ? `${stat.avgLatencyMs.toFixed(0)}ms`.padStart(7) : '    N/A';
    const passRate = `${(stat.validationPassRate * 100).toFixed(0)}%`.padStart(9);
    lines.push(`| ${(i + 1).toString().padStart(4)} | ${label} | ${score} | ${latency} | ${passRate} |`);
  });

  lines.push('');

  // Dimension breakdown
  if (stats.length > 0 && stats[0].dimensions) {
    lines.push('DIMENSION BREAKDOWN');
    lines.push('-'.repeat(80));

    const dims = ['relevance', 'specificity', 'pedagogical', 'personalization', 'actionability', 'tone'];
    const header = '| Dimension       |' + stats.map(s => ` ${s.model.substring(0, 12).padEnd(12)} |`).join('');
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
      lines.push(`  ${config.provider}/${config.model}: ${config.avgScore?.toFixed(1) || 'N/A'} [${status}]`);
    }
  }

  lines.push('');
  lines.push('='.repeat(80));

  return lines.join('\n');
}

export default {
  runEvaluation,
  compareConfigurations,
  quickTest,
  listOptions,
  getRunResults,
  generateReport,
};
