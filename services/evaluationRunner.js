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
  return resolved;
}

// Rate limiting settings
const DEFAULT_PARALLELISM = 2;
const REQUEST_DELAY_MS = 500;
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
    targetConfigs = tutorApi.listConfigurations();
  } else if (configurations === 'profiles') {
    const profiles = tutorApi.listProfiles();
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

  log(`\nRun ID: ${run.id}\n`);

  // Register with monitoring service for realtime tracking
  monitoringService.startSession(run.id, {
    userId: 'eval-runner',
    profileName: `${targetConfigs.length} configs`,
    modelId: 'evaluation-batch',
  });

  const results = [];
  let completedTests = 0;
  const totalTests = targetScenarios.length * targetConfigs.length * runsPerConfig;

  // Run evaluations
  for (const config of targetConfigs) {
    log(`\nConfiguration: ${config.label || `${config.provider}/${config.model}`}`);
    log('='.repeat(60));

    for (const scenario of targetScenarios) {
      for (let runNum = 0; runNum < runsPerConfig; runNum++) {
        try {
          const result = await runSingleTest(scenario, config, {
            skipRubricEval,
            verbose,
          });

          // Store result
          evaluationStore.storeResult(run.id, result);
          results.push(result);

          completedTests++;
          log(`  [${completedTests}/${totalTests}] ${scenario.id}: ${result.success ? `score=${result.overallScore?.toFixed(1)}` : 'FAILED'}`);

          // Update monitoring session with progress
          monitoringService.recordEvent(run.id, {
            type: 'evaluation_test',
            inputTokens: result.inputTokens || 0,
            outputTokens: result.outputTokens || 0,
            latencyMs: result.latencyMs || 0,
            round: completedTests,
            approved: result.success,
          });

          // Rate limiting
          await sleep(REQUEST_DELAY_MS);
        } catch (error) {
          log(`  [${completedTests}/${totalTests}] ${scenario.id}: ERROR - ${error.message}`);
          completedTests++;

          // Record error in monitoring
          monitoringService.recordEvent(run.id, {
            type: 'evaluation_error',
            round: completedTests,
            error: error.message,
          });
        }
      }
    }
  }

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

  log('\n' + '='.repeat(60));
  log('EVALUATION COMPLETE');
  log('='.repeat(60));
  log(`Run ID: ${run.id}`);
  log(`Total tests: ${results.length}`);
  log(`Successful: ${results.filter(r => r.success).length}`);

  return {
    runId: run.id,
    totalTests: results.length,
    successfulTests: results.filter(r => r.success).length,
    stats,
    scenarioStats,
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

  // Build context
  log('Building learner context...', 'info');
  const context = tutorApi.buildContext(fullScenario.learner_context);
  context.isNewUser = fullScenario.is_new_user;

  // Generate suggestions
  log(`Generating suggestions with profile: ${resolvedConfig.profileName}`, 'info');
  log(`Provider: ${resolvedConfig.provider || 'from profile'}, Model: ${resolvedConfig.model || 'from profile'}`, 'info');
  if (resolvedConfig.egoModel) {
    log(`Ego model override: ${resolvedConfig.egoModel}`, 'info');
  }

  // Wrap API call with retry logic for rate limit handling
  const genResult = await retryWithBackoff(
    () => tutorApi.generateSuggestions(context, {
      provider: resolvedConfig.provider,
      model: resolvedConfig.model,
      egoModel: resolvedConfig.egoModel, // Override ego model for benchmarking
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
      provider: config.provider || genResult.metadata?.provider,
      model: config.model || genResult.metadata?.model,
      profileName: config.profileName,
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
    provider: config.provider || genResult.metadata?.provider,
    model: config.model || genResult.metadata?.model,
    profileName: config.profileName,
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
    passesRequired: rubricResult?.passesRequired ?? validation.passesRequired,
    passesForbidden: rubricResult?.passesForbidden ?? validation.passesForbidden,
    requiredMissing: rubricResult?.requiredMissing || validation.requiredMissing,
    forbiddenFound: rubricResult?.forbiddenFound || validation.forbiddenFound,
    evaluatorModel: rubricResult?.evaluatorModel,
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

  // Run the multi-turn scenario through tutorApi (with retry for rate limits)
  const multiTurnResult = await retryWithBackoff(
    () => tutorApi.runMultiTurnScenario(scenario.id, {
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
  const dims = ['relevance', 'specificity', 'pedagogical', 'personalization', 'actionability', 'tone'];
  for (const dim of dims) {
    const dimScores = turnResults
      .filter(t => t.scores?.[dim] !== undefined)
      .map(t => t.scores[dim]);
    if (dimScores.length > 0) {
      aggregateDimensions[dim] = dimScores.reduce((sum, s) => sum + s, 0) / dimScores.length;
    }
  }

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
    isMultiTurn: true,
    totalTurns: turnResults.length,
    provider: config.provider || multiTurnResult.turnResults[0]?.metadata?.provider,
    model: config.model || multiTurnResult.turnResults[0]?.metadata?.model,
    profileName: config.profileName,
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
    configurations: tutorApi.listConfigurations(),
    profiles: tutorApi.listProfiles(),
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
