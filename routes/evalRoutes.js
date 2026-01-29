/**
 * Evaluation API Routes
 *
 * Endpoints for testing and evaluating AI tutor performance.
 * Mirrors CLI /eval functionality for web/API access.
 *
 * Note: Prompt recommendations are read-only via API.
 * Prompts can be viewed but not written to disk.
 */

import { Router } from 'express';
import * as evaluationRunner from '../services/evaluationRunner.js';
import * as evaluationStore from '../services/evaluationStore.js';
import * as learnerConfigLoader from '../services/learnerConfigLoader.js';
import * as promptRecommendationService from '../services/promptRecommendationService.js';
import interactionEngine from '../services/learnerTutorInteractionEngine.js';
import * as evalConfigLoader from '../services/evalConfigLoader.js';
// Import core tutor services from @machinespirits/tutor-core
import {
  tutorApiService as tutorApi,
  tutorConfigLoader,
  dialogueLogService,
  monitoringService,
  aiConfigService,
  writingPadService
} from '@machinespirits/tutor-core';
const { getApiKey, getDefaultModel } = aiConfigService;
const { clearConscious, getWritingPad } = writingPadService;
import fs from 'fs';
import path from 'path';

const router = Router();

// ============================================================================
// CRASH PROTECTION: Track active evaluation streams
// ============================================================================
const activeEvalStreams = new Map();
let streamIdCounter = 0;

// Configuration
const MAX_STREAM_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours
const TIMEOUT_WARNING_MS = 30 * 60 * 1000; // Warn at 30 minutes before timeout

// Cleanup function for orphaned streams
export function cleanupAllStreams() {
  if (activeEvalStreams.size > 0) {
    console.log(`[EvalRoutes] Cleaning up ${activeEvalStreams.size} active streams...`);
    activeEvalStreams.forEach(({ res, keepAlive, timeoutTimer, streamId }) => {
      try {
        if (keepAlive) clearInterval(keepAlive);
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (res && !res.writableEnded) {
          res.write('event: error\ndata: {"error": "Server restarting"}\n\n');
          res.end();
        }
      } catch (e) {
        console.error(`[EvalRoutes] Error cleaning stream ${streamId}:`, e.message);
      }
    });
    activeEvalStreams.clear();
  }
}

// Helper to register a new stream with timeout protection
function registerStream(res, keepAlive, options = {}) {
  const streamId = `eval-stream-${++streamIdCounter}-${Date.now()}`;
  const maxDuration = options.maxDuration || MAX_STREAM_DURATION_MS;
  const startedAt = Date.now();

  // Set up timeout handler
  const timeoutTimer = setTimeout(() => {
    console.warn(`[EvalRoutes] Stream ${streamId} exceeded max duration (${maxDuration}ms), forcing cleanup`);
    try {
      if (res && !res.writableEnded) {
        res.write('event: error\ndata: {"error": "Evaluation timeout - exceeded maximum duration", "timeout": true}\n\n');
        res.end();
      }
    } catch (e) {
      console.error(`[EvalRoutes] Error sending timeout to ${streamId}:`, e.message);
    }
    unregisterStream(streamId);
  }, maxDuration);

  activeEvalStreams.set(streamId, {
    res,
    keepAlive,
    timeoutTimer,
    streamId,
    startedAt,
    maxDuration
  });

  console.log(`[EvalRoutes] Stream registered: ${streamId} (Timeout: ${maxDuration}ms, Total active: ${activeEvalStreams.size})`);
  return streamId;
}

// Helper to unregister a stream
function unregisterStream(streamId) {
  const stream = activeEvalStreams.get(streamId);
  if (stream) {
    if (stream.keepAlive) clearInterval(stream.keepAlive);
    if (stream.timeoutTimer) clearTimeout(stream.timeoutTimer);
    activeEvalStreams.delete(streamId);
    const duration = Math.round((Date.now() - stream.startedAt) / 1000);
    console.log(`[EvalRoutes] Stream closed: ${streamId} (Duration: ${duration}s, Remaining: ${activeEvalStreams.size})`);
  }
}

// Periodic check for hung streams (runs every 5 minutes)
setInterval(() => {
  const now = Date.now();
  activeEvalStreams.forEach((stream, streamId) => {
    const age = now - stream.startedAt;

    // Warn if approaching timeout
    if (age > (stream.maxDuration - TIMEOUT_WARNING_MS) && !stream.warningShown) {
      const remaining = Math.round((stream.maxDuration - age) / 1000 / 60);
      console.warn(`[EvalRoutes] Stream ${streamId} will timeout in ${remaining} minutes`);
      try {
        if (stream.res && !stream.res.writableEnded) {
          stream.res.write(`event: warning\ndata: {"message": "Evaluation will timeout in ${remaining} minutes", "remainingMs": ${stream.maxDuration - age}}\n\n`);
        }
      } catch (e) {
        // Ignore write errors
      }
      stream.warningShown = true;
    }
  });
}, 5 * 60 * 1000); // Check every 5 minutes

// Path to prompts directory
const PROMPTS_DIR = path.join(process.cwd(), 'prompts');

// ============================================================================
// Configuration Endpoints
// ============================================================================

/**
 * List available scenarios
 * GET /api/eval/scenarios
 */
router.get('/scenarios', (req, res) => {
  try {
    const scenarios = evalConfigLoader.listScenarios();
    res.json({ success: true, scenarios });
  } catch (error) {
    console.error('[EvalRoutes] List scenarios error:', error);
    res.status(500).json({ error: 'Failed to list scenarios' });
  }
});

/**
 * Get scenario details
 * GET /api/eval/scenarios/:id
 */
router.get('/scenarios/:id', (req, res) => {
  try {
    const scenario = evalConfigLoader.getScenario(req.params.id);
    if (!scenario) {
      return res.status(404).json({ error: 'Scenario not found' });
    }
    res.json({ success: true, scenario });
  } catch (error) {
    console.error('[EvalRoutes] Get scenario error:', error);
    res.status(500).json({ error: 'Failed to get scenario' });
  }
});

/**
 * List available tutor profiles
 * GET /api/eval/profiles
 */
router.get('/profiles', (req, res) => {
  try {
    const profiles = tutorConfigLoader.listProfiles();
    res.json({ success: true, profiles });
  } catch (error) {
    console.error('[EvalRoutes] List profiles error:', error);
    res.status(500).json({ error: 'Failed to list profiles' });
  }
});

/**
 * List available learner profiles (for interaction evaluations)
 * GET /api/eval/learner-profiles
 */
router.get('/learner-profiles', (req, res) => {
  try {
    const profiles = learnerConfigLoader.listProfiles();
    const personas = learnerConfigLoader.listPersonas();
    res.json({ success: true, profiles, personas });
  } catch (error) {
    console.error('[EvalRoutes] List learner profiles error:', error);
    res.status(500).json({ error: 'Failed to list learner profiles' });
  }
});

/**
 * List model configurations
 * GET /api/eval/configurations
 */
router.get('/configurations', (req, res) => {
  try {
    const configurations = evalConfigLoader.listConfigurations();
    res.json({ success: true, configurations });
  } catch (error) {
    console.error('[EvalRoutes] List configurations error:', error);
    res.status(500).json({ error: 'Failed to list configurations' });
  }
});

// ============================================================================
// Quick Test Endpoints
// ============================================================================

/**
 * Run a quick evaluation test
 * POST /api/eval/quick
 *
 * Body: {
 *   profile: "budget",           // Profile name or config string
 *   scenario: "new_user_first_visit",  // Scenario ID (optional)
 *   skipRubric: true,            // Skip AI judge evaluation (optional)
 *   judgeOverride: null,         // Override judge model (optional)
 *   provider: null,              // Override tutor provider (optional)
 *   model: null,                 // Override tutor model (optional)
 *   egoModel: null,              // Override ego model (optional)
 *   superegoStrategy: null,      // Superego intervention strategy (optional)
 *   hyperparameters: null        // Override hyperparameters (optional)
 * }
 */
router.post('/quick', async (req, res) => {
  try {
    const {
      profile = 'budget',
      scenario = 'new_user_first_visit',
      skipRubric = false,
      judgeOverride = null,
      provider,
      model,
      egoModel,
      superegoStrategy,
      hyperparameters,
    } = req.body;

    // Build config with optional tutor overrides
    const config = {
      profileName: profile,
      ...(provider && { provider }),
      ...(model && { model }),
      ...(egoModel && { egoModel }),
      ...(hyperparameters && { hyperparameters }),
    };

    // Get scenario name for description
    const scenarioDetails = evalConfigLoader.getScenario(scenario);
    const scenarioName = scenarioDetails?.name || scenario;

    // Create a run to persist result to history
    const run = evaluationStore.createRun({
      description: scenarioName,
      totalScenarios: 1,
      totalConfigurations: 1,
      metadata: {
        runType: 'quick',
        profiles: [profile],
        scenarios: [scenario],
        scenarioNames: [scenarioName],
        judgeOverride: judgeOverride || undefined,
        ...(provider && { provider }),
        ...(model && { model }),
        ...(egoModel && { egoModel }),
        ...(superegoStrategy && { superegoStrategy }),
      },
    });

    const result = await evaluationRunner.quickTest(config, {
      scenarioId: scenario,
      skipRubricEval: skipRubric,
      verbose: false,
      judgeOverride,
      superegoStrategy,
    });

    // Store result to history
    evaluationStore.storeResult(run.id, result);

    // Mark run as completed
    evaluationStore.updateRun(run.id, {
      status: 'completed',
      totalTests: 1,
      completedAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      runId: run.id,
      result: {
        runId: run.id,
        scenarioId: result.scenarioId,
        scenarioName: result.scenarioName,
        profile: result.profileName,
        provider: result.provider,
        model: result.model,
        passed: result.success,
        overallScore: result.overallScore,
        latencyMs: result.latencyMs,
        scores: result.scoresWithReasoning || result.scores, // Prefer detailed scores
        validation: {
          passesRequired: result.passesRequired,
          passesForbidden: result.passesForbidden,
          requiredMissing: result.requiredMissing,
          forbiddenFound: result.forbiddenFound,
        },
        suggestions: result.suggestions,
        // Token usage
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens: (result.inputTokens || 0) + (result.outputTokens || 0),
        apiCalls: result.apiCalls,
        dialogueRounds: result.dialogueRounds,
        // Judge reasoning
        evaluationReasoning: result.evaluationReasoning,
        judgeModel: result.judgeModel,
        // Scenario context for display (original user request)
        scenarioContext: scenarioDetails ? {
          description: scenarioDetails.description,
          expectedBehavior: scenarioDetails.expected_behavior,
          learnerContext: scenarioDetails.learner_context,
        } : null,
      },
    });
  } catch (error) {
    console.error('[EvalRoutes] Quick test error:', error);
    res.status(500).json({ error: 'Failed to run quick test', details: error.message });
  }
});

/**
 * Run a quick test with SSE streaming for real-time logs
 * GET /api/eval/stream/quick
 * Query params: profile, scenario, skipRubric
 */
router.get('/stream/quick', async (req, res) => {
  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const sendEvent = (type, data) => {
    // Use named events for addEventListener compatibility
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Keep-alive to prevent connection timeout
  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 15000);

  // Register stream for crash protection
  const streamId = registerStream(res, keepAlive);

  // Clean up on close
  req.on('close', () => {
    clearInterval(keepAlive);
    unregisterStream(streamId);
  });

  try {
    const profile = req.query.profile || 'budget';
    const scenario = req.query.scenario || 'new_user_first_visit';
    const skipRubric = req.query.skipRubric === 'true';
    const outputSize = req.query.outputSize || 'normal'; // compact, normal, expanded

    // Get scenario name for description
    const scenarioDetails = evalConfigLoader.getScenario(scenario);
    const scenarioName = scenarioDetails?.name || scenario;

    // Create a run to persist result to history (status: 'running')
    const run = evaluationStore.createRun({
      description: scenarioName,
      totalScenarios: 1,
      totalConfigurations: 1,
      metadata: {
        runType: 'quick',
        profiles: [profile],
        scenarios: [scenario],
        scenarioNames: [scenarioName],
      },
    });

    sendEvent('start', {
      profile,
      scenario,
      skipRubric,
      outputSize,
      runId: run.id,
      timestamp: new Date().toISOString(),
    });

    sendEvent('log', { message: `Starting quick test: ${profile} / ${scenario}`, level: 'info' });
    sendEvent('log', { message: `Run ID: ${run.id}`, level: 'info' });
    sendEvent('log', { message: `Skip rubric evaluation: ${skipRubric}`, level: 'info' });
    sendEvent('log', { message: `Output size: ${outputSize}`, level: 'info' });

    const config = { profileName: profile };

    // Create a log callback to stream logs
    const onLog = (message, level = 'info') => {
      sendEvent('log', { message, level, timestamp: new Date().toISOString() });
    };

    sendEvent('log', { message: 'Building learner context...', level: 'info' });
    sendEvent('progress', { stage: 'context', message: 'Building learner context' });

    const result = await evaluationRunner.quickTest(config, {
      scenarioId: scenario,
      skipRubricEval: skipRubric,
      outputSize, // compact, normal, expanded - affects response length
      verbose: true,
      onLog, // Pass log callback
    });

    // Store result to history
    evaluationStore.storeResult(run.id, result);

    // Mark run as completed
    evaluationStore.updateRun(run.id, {
      status: 'completed',
      totalTests: 1,
      completedAt: new Date().toISOString(),
    });

    sendEvent('log', { message: `Test completed: score=${result.overallScore?.toFixed(1) || 'N/A'}`, level: 'success' });
    sendEvent('log', { message: `Saved to history: ${run.id}`, level: 'info' });

    sendEvent('result', {
      runId: run.id,
      scenarioId: result.scenarioId,
      scenarioName: result.scenarioName,
      profile: result.profileName,
      provider: result.provider,
      model: result.model,
      passed: result.success,
      overallScore: result.overallScore,
      latencyMs: result.latencyMs,
      scores: result.scoresWithReasoning || result.scores, // Prefer detailed scores
      validation: {
        passesRequired: result.passesRequired,
        passesForbidden: result.passesForbidden,
        requiredMissing: result.requiredMissing,
        forbiddenFound: result.forbiddenFound,
      },
      suggestions: result.suggestions,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      totalTokens: (result.inputTokens || 0) + (result.outputTokens || 0),
      apiCalls: result.apiCalls,
      dialogueRounds: result.dialogueRounds,
      dialogueId: result.dialogueId,
      // Evaluator reasoning
      evaluationReasoning: result.evaluationReasoning,
      judgeModel: result.judgeModel,
      // Scenario context for display (original user request)
      scenarioContext: scenarioDetails ? {
        description: scenarioDetails.description,
        expectedBehavior: scenarioDetails.expected_behavior,
        learnerContext: scenarioDetails.learner_context,
      } : null,
    });

    sendEvent('complete', { success: true, runId: run.id });
    clearInterval(keepAlive);
    res.end();
  } catch (error) {
    sendEvent('log', { message: `Error: ${error.message}`, level: 'error' });
    sendEvent('error', { error: error.message });
    clearInterval(keepAlive);
    res.end();
  }
});

// ============================================================================
// Full Evaluation Endpoints
// ============================================================================

/**
 * Run a full evaluation
 * POST /api/eval/run
 *
 * Body: {
 *   profiles: ["budget", "fast"],  // Profiles to test
 *   scenarios: ["new_user_first_visit", "struggling_learner"],  // Scenarios (or "all")
 *   runsPerConfig: 1,             // Repetitions
 *   skipRubric: false             // Use AI judge
 * }
 */
router.post('/run', async (req, res) => {
  try {
    const {
      profiles = ['budget'],
      scenarios = 'all',
      runsPerConfig = 1,
      skipRubric = false,
      description
    } = req.body;

    // Build configurations from profiles
    const configurations = profiles.map(p => ({ profileName: p, label: p }));

    const result = await evaluationRunner.runEvaluation({
      scenarios,
      configurations,
      runsPerConfig,
      skipRubricEval: skipRubric,
      description,
      verbose: false,
    });

    res.json({
      success: true,
      runId: result.runId,
      totalTests: result.totalTests,
      successfulTests: result.successfulTests,
      stats: result.stats,
      scenarioStats: result.scenarioStats,
    });
  } catch (error) {
    console.error('[EvalRoutes] Run evaluation error:', error);
    res.status(500).json({ error: 'Failed to run evaluation', details: error.message });
  }
});

/**
 * Compare multiple configurations
 * POST /api/eval/compare
 *
 * Body: {
 *   profiles: ["budget", "fast", "quality"],
 *   scenarios: "all",
 *   runsPerConfig: 1
 * }
 */
router.post('/compare', async (req, res) => {
  try {
    const { profiles, scenarios = 'all', runsPerConfig = 1 } = req.body;

    if (!profiles || profiles.length < 2) {
      return res.status(400).json({ error: 'At least 2 profiles required for comparison' });
    }

    const configs = profiles.map(p => ({ profileName: p, label: p }));

    const result = await evaluationRunner.compareConfigurations(configs, {
      scenarios,
      runsPerConfig,
      verbose: false,
    });

    res.json({
      success: true,
      runId: result.runId,
      rankings: result.rankings,
      scenarioBreakdown: result.scenarioBreakdown,
    });
  } catch (error) {
    console.error('[EvalRoutes] Compare error:', error);
    res.status(500).json({ error: 'Failed to compare configurations', details: error.message });
  }
});

/**
 * Matrix comparison of multiple profiles with dimension breakdowns
 * POST /api/eval/matrix
 *
 * Body: {
 *   profiles: ["budget", "default", "experimental"],  // Profiles to test
 *   scenarios: "all",        // Scenarios to run (or array of IDs)
 *   skipRubric: true         // Skip AI judge evaluation (faster)
 * }
 *
 * Returns dimension scores and overall rankings for each profile.
 */
router.post('/matrix', async (req, res) => {
  try {
    let { profiles = [], scenarios = 'all', skipRubric = false } = req.body;

    // Default profiles if none specified
    const allProfiles = tutorConfigLoader.listProfiles();
    if (profiles.length === 0) {
      profiles = ['budget', 'experimental', 'default', 'fast'].filter(p =>
        allProfiles.some(ap => ap.name === p)
      );
    }

    // Validate profiles exist
    const validProfiles = profiles.filter(p => allProfiles.some(ap => ap.name === p));
    const invalidProfiles = profiles.filter(p => !allProfiles.some(ap => ap.name === p));

    if (validProfiles.length === 0) {
      return res.status(400).json({
        error: 'No valid profiles specified',
        available: allProfiles.map(p => p.name),
      });
    }

    // Get scenarios
    const allScenarios = evalConfigLoader.listScenarios();
    const scenariosToRun = scenarios === 'all'
      ? allScenarios
      : allScenarios.filter(s => scenarios.includes(s.id));

    // Create a run to persist results to history
    const run = evaluationStore.createRun({
      description: `${validProfiles.length} profiles × ${scenariosToRun.length} scenarios`,
      totalScenarios: scenariosToRun.length,
      totalConfigurations: validProfiles.length,
      metadata: {
        runType: 'matrix',
        profiles: validProfiles,
        scenarios: scenariosToRun.map(s => s.id),
        scenarioNames: scenariosToRun.map(s => s.name),
        skipRubric,
      },
    });

    // Run evaluations
    const results = {};
    const dimensionScores = {};
    let totalTests = 0;

    for (const profileName of validProfiles) {
      results[profileName] = [];
      dimensionScores[profileName] = {};

      for (const scenario of scenariosToRun) {
        try {
          const config = { profileName, label: profileName };
          const result = await evaluationRunner.quickTest(config, {
            scenarioId: scenario.id,
            verbose: false,
            skipRubricEval: skipRubric,
            debug: false,
          });

          results[profileName].push(result);
          totalTests++;

          // Save result to database
          evaluationStore.storeResult(run.id, {
            ...result,
            scenarioId: scenario.id,
            scenarioName: scenario.name,
            profileName,
          });

          // Collect dimension scores
          if (result.scores) {
            for (const [dim, score] of Object.entries(result.scores)) {
              if (!dimensionScores[profileName][dim]) {
                dimensionScores[profileName][dim] = [];
              }
              if (typeof score === 'number') {
                dimensionScores[profileName][dim].push(score);
              }
            }
          }
        } catch (e) {
          const errorResult = {
            success: false,
            errorMessage: e.message,
            scenarioId: scenario.id,
          };
          results[profileName].push(errorResult);
          totalTests++;

          // Save error to database
          evaluationStore.storeResult(run.id, {
            ...errorResult,
            scenarioName: scenario.name,
            profileName,
            provider: 'unknown',
            model: 'unknown',
          });
        }
      }
    }

    // Update run as completed
    evaluationStore.updateRun(run.id, {
      status: 'completed',
      totalTests,
      completedAt: new Date().toISOString(),
    });

    // Build dimension averages
    const dimensions = ['relevance', 'specificity', 'pedagogical', 'personalization', 'actionability', 'tone'];
    const dimensionAverages = {};
    for (const profile of validProfiles) {
      dimensionAverages[profile] = {};
      for (const dim of dimensions) {
        const scores = dimensionScores[profile]?.[dim] || [];
        dimensionAverages[profile][dim] = scores.length > 0
          ? scores.reduce((a, b) => a + b, 0) / scores.length
          : null;
      }
    }

    // Build rankings
    const rankings = validProfiles.map(profile => {
      const profileResults = results[profile] || [];
      const successCount = profileResults.filter(r => r.success !== false).length;
      const scores = profileResults.filter(r => r.overallScore != null).map(r => r.overallScore);
      const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      const latencies = profileResults.filter(r => r.latencyMs != null).map(r => r.latencyMs);
      const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null;

      return {
        profile,
        tests: profileResults.length,
        successes: successCount,
        avgScore,
        avgLatency,
      };
    }).sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0));

    res.json({
      success: true,
      runId: run.id, // Include run ID so frontend can navigate to history
      profiles: validProfiles,
      invalidProfiles: invalidProfiles.length > 0 ? invalidProfiles : undefined,
      scenariosRun: scenariosToRun.length,
      dimensionAverages,
      rankings,
      results, // Full results for detailed analysis
    });
  } catch (error) {
    console.error('[EvalRoutes] Matrix error:', error);
    res.status(500).json({ error: 'Failed to run matrix comparison', details: error.message });
  }
});

/**
 * Run matrix comparison with SSE streaming for real-time logs
 * GET /api/eval/stream/matrix
 * Query params: profiles, scenarios, skipRubric
 */
router.get('/stream/matrix', async (req, res) => {
  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const sendEvent = (type, data) => {
    // Use named events for addEventListener compatibility
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Keep-alive to prevent connection timeout
  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 15000);

  // Register stream for crash protection
  const streamId = registerStream(res, keepAlive);

  // Clean up on close
  req.on('close', () => {
    clearInterval(keepAlive);
    unregisterStream(streamId);
  });

  try {
    const profilesParam = req.query.profiles || '';
    let profiles = profilesParam ? profilesParam.split(',') : [];
    const scenariosParam = req.query.scenarios || 'all';
    const scenarios = scenariosParam === 'all' ? 'all' : scenariosParam.split(',');
    const skipRubric = req.query.skipRubric === 'true';
    const outputSize = req.query.outputSize || 'normal';

    // Get all available profiles
    const allProfiles = tutorConfigLoader.listProfiles();
    if (profiles.length === 0) {
      profiles = ['budget', 'experimental', 'default', 'fast'].filter(p =>
        allProfiles.some(ap => ap.name === p)
      );
    }

    // Validate profiles
    const validProfiles = profiles.filter(p => allProfiles.some(ap => ap.name === p));
    if (validProfiles.length === 0) {
      sendEvent('error', { error: 'No valid profiles specified' });
      return res.end();
    }

    // Get scenarios
    const allScenarios = evalConfigLoader.listScenarios();
    const scenariosToRun = scenarios === 'all'
      ? allScenarios
      : allScenarios.filter(s => scenarios.includes(s.id));

    const totalTests = validProfiles.length * scenariosToRun.length;

    sendEvent('start', {
      profiles: validProfiles,
      scenarioCount: scenariosToRun.length,
      totalTests,
      skipRubric,
      outputSize,
      timestamp: new Date().toISOString(),
    });

    sendEvent('log', { message: `Starting matrix: ${validProfiles.length} profiles × ${scenariosToRun.length} scenarios = ${totalTests} tests`, level: 'info' });
    sendEvent('log', { message: `Output size: ${outputSize}`, level: 'info' });

    // Create a run to persist results
    const run = evaluationStore.createRun({
      description: `${validProfiles.length} profiles × ${scenariosToRun.length} scenarios`,
      totalScenarios: scenariosToRun.length,
      totalConfigurations: validProfiles.length,
      metadata: {
        runType: 'matrix',
        profiles: validProfiles,
        scenarios: scenariosToRun.map(s => s.id),
        scenarioNames: scenariosToRun.map(s => s.name),
        skipRubric,
      },
    });

    sendEvent('log', { message: `Run ID: ${run.id}`, level: 'info' });

    // Run evaluations
    const results = {};
    const dimensionScores = {};
    let completedTests = 0;

    for (const profileName of validProfiles) {
      results[profileName] = [];
      dimensionScores[profileName] = {};

      sendEvent('log', { message: `\n=== Profile: ${profileName} ===`, level: 'info' });

      for (const scenario of scenariosToRun) {
        completedTests++;

        sendEvent('progress', {
          current: completedTests,
          total: totalTests,
          profile: profileName,
          scenario: scenario.name,
          percentage: Math.round((completedTests / totalTests) * 100),
        });

        sendEvent('log', { message: `[${completedTests}/${totalTests}] ${scenario.name}...`, level: 'info' });

        try {
          const config = { profileName, label: profileName };

          // Create log callback for this test
          const onLog = (message, level = 'info') => {
            sendEvent('log', { message: `  ${message}`, level, timestamp: new Date().toISOString() });
          };

          const result = await evaluationRunner.quickTest(config, {
            scenarioId: scenario.id,
            verbose: false,
            skipRubricEval: skipRubric,
            outputSize,
            onLog,
          });

          results[profileName].push(result);

          // Save result to database
          evaluationStore.storeResult(run.id, {
            ...result,
            scenarioId: scenario.id,
            scenarioName: scenario.name,
            profileName,
          });

          // Collect dimension scores
          if (result.scores) {
            for (const [dim, score] of Object.entries(result.scores)) {
              if (!dimensionScores[profileName][dim]) {
                dimensionScores[profileName][dim] = [];
              }
              if (typeof score === 'number') {
                dimensionScores[profileName][dim].push(score);
              }
            }
          }

          const scoreStr = result.overallScore != null ? result.overallScore.toFixed(1) : 'N/A';
          const status = result.success !== false ? '✓' : '✗';
          sendEvent('log', { message: `  ${status} Score: ${scoreStr} (${result.latencyMs}ms)`, level: result.success !== false ? 'success' : 'warning' });

          sendEvent('result', {
            profile: profileName,
            scenarioId: scenario.id,
            scenarioName: scenario.name,
            passed: result.success !== false,
            score: result.overallScore,
            latencyMs: result.latencyMs,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
          });

        } catch (e) {
          sendEvent('log', { message: `  ✗ Error: ${e.message}`, level: 'error' });

          const errorResult = {
            success: false,
            errorMessage: e.message,
            scenarioId: scenario.id,
          };
          results[profileName].push(errorResult);

          evaluationStore.storeResult(run.id, {
            ...errorResult,
            scenarioName: scenario.name,
            profileName,
            provider: 'unknown',
            model: 'unknown',
          });
        }
      }
    }

    // Update run as completed
    evaluationStore.updateRun(run.id, {
      status: 'completed',
      totalTests: completedTests,
      completedAt: new Date().toISOString(),
    });

    // Build dimension averages
    const dimensions = ['relevance', 'specificity', 'pedagogical', 'personalization', 'actionability', 'tone'];
    const dimensionAverages = {};
    for (const profile of validProfiles) {
      dimensionAverages[profile] = {};
      for (const dim of dimensions) {
        const scores = dimensionScores[profile]?.[dim] || [];
        dimensionAverages[profile][dim] = scores.length > 0
          ? scores.reduce((a, b) => a + b, 0) / scores.length
          : null;
      }
    }

    // Build rankings
    const rankings = validProfiles.map(profile => {
      const profileResults = results[profile] || [];
      const successCount = profileResults.filter(r => r.success !== false).length;
      const scores = profileResults.filter(r => r.overallScore != null).map(r => r.overallScore);
      const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      const latencies = profileResults.filter(r => r.latencyMs != null).map(r => r.latencyMs);
      const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null;

      return {
        profile,
        tests: profileResults.length,
        successes: successCount,
        avgScore,
        avgLatency,
      };
    }).sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0));

    sendEvent('log', { message: `\n=== Matrix Complete ===`, level: 'success' });
    sendEvent('log', { message: `Total tests: ${completedTests}`, level: 'info' });

    // Send final complete event with full results
    sendEvent('complete', {
      success: true,
      runId: run.id,
      profiles: validProfiles,
      scenariosRun: scenariosToRun.length,
      dimensionAverages,
      rankings,
      results,
    });

    unregisterStream(streamId);
    res.end();
  } catch (error) {
    sendEvent('log', { message: `Fatal error: ${error.message}`, level: 'error' });
    sendEvent('error', { error: error.message });
    unregisterStream(streamId);
    res.end();
  }
});

/**
 * Run learner-tutor interaction evaluation with SSE streaming
 * GET /api/eval/stream/interact
 * Query params:
 *   - persona: learner persona ID (default: confused_novice)
 *   - profile: tutor profile name (default: budget)
 *   - turns: number of dialogue turns (default: 5)
 *   - dialogueEnabled: whether tutor uses multi-agent dialogue (default: true)
 *   - topic: topic for discussion (default: "Hegel's concept of recognition")
 *   - runJudge: whether to run AI judge evaluation (default: true)
 */
router.get('/stream/interact', async (req, res) => {
  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const sendEvent = (type, data) => {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Keep-alive to prevent connection timeout
  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 15000);

  // Register stream for crash protection (interaction evals can take a while)
  const streamId = registerStream(res, keepAlive, { maxDuration: 30 * 60 * 1000 }); // 30 min timeout

  // Clean up on close
  req.on('close', () => {
    clearInterval(keepAlive);
    unregisterStream(streamId);
  });

  try {
    const persona = req.query.persona || 'confused_novice';
    const tutorProfile = req.query.profile || 'budget';
    const maxTurns = parseInt(req.query.turns) || 5;
    const dialogueEnabled = req.query.dialogueEnabled !== 'false';
    const topic = req.query.topic || "Hegel's concept of recognition";
    const runJudge = req.query.runJudge !== 'false';

    sendEvent('start', {
      persona,
      tutorProfile,
      maxTurns,
      dialogueEnabled,
      topic,
      runJudge,
      timestamp: new Date().toISOString(),
    });

    sendEvent('log', { message: `Starting interaction evaluation`, level: 'info' });
    sendEvent('log', { message: `Learner persona: ${persona}`, level: 'info' });
    sendEvent('log', { message: `Tutor profile: ${tutorProfile}`, level: 'info' });
    sendEvent('log', { message: `Max turns: ${maxTurns}`, level: 'info' });
    sendEvent('log', { message: `Dialogue enabled: ${dialogueEnabled}`, level: 'info' });
    sendEvent('log', { message: `Topic: ${topic}`, level: 'info' });

    // Set up LLM call function using available providers
    let llmClient = null;
    let llmProvider = null;

    // Try providers in order of preference
    const openrouterKey = getApiKey('openrouter');
    const geminiKey = getApiKey('gemini');
    const anthropicKey = getApiKey('claude');
    const openaiKey = getApiKey('openai');

    if (openrouterKey) {
      llmProvider = 'openrouter';
      const OpenAI = (await import('openai')).default;
      llmClient = new OpenAI({
        apiKey: openrouterKey,
        baseURL: 'https://openrouter.ai/api/v1',
      });
      sendEvent('log', { message: `Using OpenRouter for LLM calls`, level: 'info' });
    } else if (geminiKey) {
      llmProvider = 'gemini';
      const { GoogleGenAI } = await import('@google/genai');
      llmClient = new GoogleGenAI({ apiKey: geminiKey });
      sendEvent('log', { message: `Using Gemini for LLM calls`, level: 'info' });
    } else if (anthropicKey) {
      llmProvider = 'anthropic';
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      llmClient = new Anthropic({ apiKey: anthropicKey });
      sendEvent('log', { message: `Using Anthropic for LLM calls`, level: 'info' });
    } else if (openaiKey) {
      llmProvider = 'openai';
      const OpenAI = (await import('openai')).default;
      llmClient = new OpenAI({ apiKey: openaiKey });
      sendEvent('log', { message: `Using OpenAI for LLM calls`, level: 'info' });
    } else {
      throw new Error('No LLM API key configured. Set OPENROUTER_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY.');
    }

    // Create the llmCall function matching the expected signature
    const llmCall = async (requestedModel, systemPrompt, messages, options = {}) => {
      const { temperature = 0.7, maxTokens = 1000 } = options;
      const model = requestedModel || getDefaultModel(llmProvider === 'anthropic' ? 'claude' : llmProvider) || 'deepseek/deepseek-chat';

      try {
        if (llmProvider === 'openrouter') {
          const response = await llmClient.chat.completions.create({
            model,
            temperature,
            max_tokens: maxTokens,
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages.map(m => ({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.content,
              })),
            ],
          });
          return {
            content: response.choices[0]?.message?.content || '',
            usage: {
              inputTokens: response.usage?.prompt_tokens || 0,
              outputTokens: response.usage?.completion_tokens || 0,
            },
          };
        } else if (llmProvider === 'gemini') {
          const userMessages = messages.map(m => m.content).join('\n\n');
          const response = await llmClient.models.generateContent({
            model,
            contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userMessages}` }] }],
            generationConfig: { temperature, maxOutputTokens: maxTokens },
          });
          const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || '';
          return {
            content: text,
            usage: {
              inputTokens: Math.ceil((systemPrompt.length + userMessages.length) / 4),
              outputTokens: Math.ceil(text.length / 4),
            },
          };
        } else if (llmProvider === 'anthropic') {
          const response = await llmClient.messages.create({
            model: model || 'claude-3-5-haiku-20241022',
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: messages.map(m => ({
              role: m.role === 'user' ? 'user' : 'assistant',
              content: m.content,
            })),
          });
          return {
            content: response.content[0]?.text || '',
            usage: {
              inputTokens: response.usage?.input_tokens || 0,
              outputTokens: response.usage?.output_tokens || 0,
            },
          };
        } else if (llmProvider === 'openai') {
          const response = await llmClient.chat.completions.create({
            model: model || 'gpt-4o-mini',
            temperature,
            max_tokens: maxTokens,
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages.map(m => ({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.content,
              })),
            ],
          });
          return {
            content: response.choices[0]?.message?.content || '',
            usage: {
              inputTokens: response.usage?.prompt_tokens || 0,
              outputTokens: response.usage?.completion_tokens || 0,
            },
          };
        }
      } catch (error) {
        console.error(`[InteractStream] LLM call error:`, error.message);
        throw error;
      }
    };

    // Generate unique learner ID for this eval
    const learnerId = `eval-learner-${persona}-${Date.now()}`;
    const evalId = `short-interact-${Date.now()}`;
    const sessionId = `session-${Date.now()}`;

    sendEvent('log', { message: `Eval ID: ${evalId}`, level: 'info' });
    sendEvent('progress', { stage: 'setup', message: 'Initializing interaction' });

    // Run the interaction
    sendEvent('log', { message: `\nStarting ${maxTurns}-turn interaction...`, level: 'info' });
    sendEvent('progress', { stage: 'interaction', message: 'Running learner-tutor dialogue' });

    const interactionTrace = await interactionEngine.runInteraction(
      {
        learnerId,
        personaId: persona,
        tutorProfile,
        learnerProfile: dialogueEnabled ? 'psychodynamic' : 'unified',
        topic,
        scenario: {
          name: `Interactive Evaluation - ${persona}`,
        },
        sessionId,
      },
      llmCall,
      {
        maxTurns,
        trace: true,
        observeInternals: true,
      }
    );

    sendEvent('log', { message: `Interaction completed: ${interactionTrace.turns.length} turns`, level: 'success' });

    // Generate sequence diagram and transcript
    const generateSequenceDiagram = (trace) => {
      const lines = ['sequenceDiagram'];
      lines.push('  participant L as Learner');
      lines.push('  participant T as Tutor');

      for (const turn of trace.turns || []) {
        const speaker = turn.phase === 'learner' ? 'L' : 'T';
        const target = turn.phase === 'learner' ? 'T' : 'L';
        const msg = (turn.externalMessage || '').slice(0, 50).replace(/"/g, "'").replace(/\n/g, ' ');
        lines.push(`  ${speaker}->>+${target}: ${msg}${msg.length >= 50 ? '...' : ''}`);
      }

      return lines.join('\n');
    };

    const generateTranscript = (trace) => {
      const lines = [];
      for (const turn of trace.turns || []) {
        const speaker = turn.phase === 'learner' ? 'LEARNER' : 'TUTOR';
        lines.push(`[Turn ${turn.turnNumber}] ${speaker}:`);
        lines.push(turn.externalMessage || '');
        lines.push('');
      }
      return lines.join('\n');
    };

    // Compile result
    const result = {
      evalId,
      scenarioId: `interact-${persona}`,
      scenarioName: `Interactive Evaluation - ${persona}`,
      type: 'short_term',
      learnerId,
      personaId: persona,
      tutorProfile,
      learnerArchitecture: dialogueEnabled ? 'psychodynamic' : 'unified',
      learnerProfile: dialogueEnabled ? 'psychodynamic' : 'unified',
      topic,
      interaction: interactionTrace,
      turnCount: interactionTrace.turns.length,
      turns: interactionTrace.turns,
      sequenceDiagram: generateSequenceDiagram(interactionTrace),
      formattedTranscript: generateTranscript(interactionTrace),
      skipJudge: !runJudge,
      metrics: {
        turnCount: interactionTrace.turns.length,
        totalTokens: (interactionTrace.metrics?.learnerInputTokens || 0) +
                     (interactionTrace.metrics?.learnerOutputTokens || 0) +
                     (interactionTrace.metrics?.tutorInputTokens || 0) +
                     (interactionTrace.metrics?.tutorOutputTokens || 0),
        learnerTokens: (interactionTrace.metrics?.learnerInputTokens || 0) +
                       (interactionTrace.metrics?.learnerOutputTokens || 0),
        tutorTokens: (interactionTrace.metrics?.tutorInputTokens || 0) +
                     (interactionTrace.metrics?.tutorOutputTokens || 0),
        totalLatencyMs: interactionTrace.metrics?.totalLatencyMs || 0,
      },
      timestamp: new Date().toISOString(),
    };

    // Store in database
    sendEvent('progress', { stage: 'storing', message: 'Saving results' });

    // First create a run entry so it appears in History with "Interact" filter
    let runId = null;
    try {
      const runData = evaluationStore.createRun({
        description: `Interact: ${persona} → ${tutorProfile}`,
        totalScenarios: 1,
        metadata: {
          runType: 'interaction',
          profiles: [tutorProfile],
          personaId: persona,
          learnerArchitecture: dialogueEnabled ? 'psychodynamic' : 'unified',
          topic,
          fastMode: !runJudge,
        },
      });
      runId = runData.id;
      sendEvent('log', { message: `Created run entry: ${runId}`, level: 'info' });
    } catch (e) {
      sendEvent('log', { message: `Run entry warning: ${e.message}`, level: 'warning' });
    }

    // Now store the interaction evaluation details
    try {
      result.runId = runId;
      evaluationStore.storeInteractionEval(result);
      sendEvent('log', { message: `Stored in database: ${evalId}`, level: 'success' });

      // Mark the run as completed (don't use completeRun which checks evaluation_results table)
      if (runId) {
        evaluationStore.updateRun(runId, {
          status: 'completed',
          totalTests: result.metrics?.turnCount || 1,
          completedAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      sendEvent('log', { message: `Database storage warning: ${e.message}`, level: 'warning' });
    }

    // Send turn-by-turn summary
    for (let i = 0; i < interactionTrace.turns.length; i++) {
      const turn = interactionTrace.turns[i];
      sendEvent('turn', {
        turnNumber: turn.turnNumber,
        phase: turn.phase,
        message: turn.externalMessage?.slice(0, 100) + (turn.externalMessage?.length > 100 ? '...' : ''),
      });
    }

    sendEvent('log', { message: `\n=== Interaction Complete ===`, level: 'success' });
    sendEvent('log', { message: `Total turns: ${result.metrics.turnCount}`, level: 'info' });
    sendEvent('log', { message: `Total tokens: ${result.metrics.totalTokens}`, level: 'info' });

    // Send final result
    sendEvent('result', {
      evalId: result.evalId,
      scenarioName: result.scenarioName,
      persona: result.personaId,
      tutorProfile: result.tutorProfile,
      learnerArchitecture: result.learnerArchitecture,
      turnCount: result.metrics.turnCount,
      totalTokens: result.metrics.totalTokens,
      learnerTokens: result.metrics.learnerTokens,
      tutorTokens: result.metrics.tutorTokens,
      latencyMs: result.metrics.totalLatencyMs,
      passed: true, // No judge score yet
      overallScore: null,
    });

    sendEvent('complete', {
      success: true,
      evalId: result.evalId,
    });

    unregisterStream(streamId);
    res.end();
  } catch (error) {
    console.error('[InteractStream] Error:', error);
    sendEvent('log', { message: `Error: ${error.message}`, level: 'error' });
    sendEvent('error', { error: error.message });
    unregisterStream(streamId);
    res.end();
  }
});

// ============================================================================
// Results Endpoints
// ============================================================================

/**
 * List previous evaluation runs
 * GET /api/eval/runs
 * Query params: limit (default 20)
 */
router.get('/runs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const runs = evaluationStore.listRuns({ limit });

    // Also include interaction evals in the runs list
    const interactionEvals = evaluationStore.listInteractionEvals({ limit });
    const interactionRuns = interactionEvals.map(e => ({
      id: e.evalId,
      description: e.scenarioName || 'Interaction Evaluation',
      status: 'completed',
      createdAt: e.createdAt,
      totalScenarios: 1,
      totalTests: e.turnCount || 1,
      type: 'interaction',
      metadata: JSON.stringify({
        runType: 'interaction',
        profiles: [e.tutorProfile || 'default'],
        scenarioNames: [e.scenarioName],
        learnerProfile: e.learnerProfile,
        personaId: e.personaId,
      }),
    }));

    // Merge and sort by createdAt descending
    const allRuns = [...runs, ...interactionRuns].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ).slice(0, limit);

    res.json({ success: true, runs: allRuns });
  } catch (error) {
    console.error('[EvalRoutes] List runs error:', error);
    res.status(500).json({ error: 'Failed to list runs' });
  }
});

/**
 * Find incomplete (stuck) evaluation runs
 * GET /api/eval/runs-incomplete
 * Query params: olderThanMinutes (default 30)
 */
router.get('/runs-incomplete', (req, res) => {
  try {
    const olderThanMinutes = parseInt(req.query.olderThanMinutes) || 30;
    const runs = evaluationStore.findIncompleteRuns({ olderThanMinutes });
    res.json({ success: true, runs, found: runs.length });
  } catch (error) {
    console.error('[EvalRoutes] Find incomplete runs error:', error);
    res.status(500).json({ error: 'Failed to find incomplete runs' });
  }
});

/**
 * Auto-complete all stale runs
 * POST /api/eval/runs-auto-complete
 * Body: { olderThanMinutes: 30, dryRun: false }
 */
router.post('/runs-auto-complete', (req, res) => {
  try {
    const { olderThanMinutes = 30, dryRun = false } = req.body;
    const result = evaluationStore.autoCompleteStaleRuns({ olderThanMinutes, dryRun });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[EvalRoutes] Auto-complete runs error:', error);
    res.status(500).json({ error: 'Failed to auto-complete runs', details: error.message });
  }
});

/**
 * Get results for a specific run
 * GET /api/eval/runs/:runId
 */
router.get('/runs/:runId', (req, res) => {
  try {
    const { runId } = req.params;

    // Check if this is an interaction eval
    if (runId.startsWith('short-') || runId.startsWith('long-')) {
      const evalData = evaluationStore.getInteractionEval(runId);
      if (!evalData) {
        return res.status(404).json({ error: 'Interaction evaluation not found' });
      }

      // Format as a run with results for the existing frontend
      return res.json({
        success: true,
        type: 'interaction',
        run: {
          id: evalData.evalId,
          description: evalData.scenarioName || 'Interaction Evaluation',
          status: 'completed',
          createdAt: evalData.createdAt,
        },
        stats: {
          totalTests: 1,
          avgScore: evalData.judgeOverallScore,
        },
        results: [{
          scenarioId: evalData.scenarioId,
          scenarioName: evalData.scenarioName,
          profileName: evalData.tutorProfile || 'default',
          tutorProfile: evalData.tutorProfile || 'default',
          model: `${evalData.turnCount} turns`,
          passed: evalData.judgeOverallScore >= 3,
          overallScore: evalData.judgeOverallScore,
          overall_score: evalData.judgeOverallScore,
          inputTokens: evalData.learnerTokens || 0,
          outputTokens: evalData.tutorTokens || 0,
          latencyMs: evalData.latencyMs || 0,
          latency_ms: evalData.latencyMs || 0,
          isInteraction: true,
          interactionEvalId: evalData.evalId,
          // dialogueId links to the dialogue log viewer
          dialogueId: evalData.evalId,
          // Include judgeEvaluation for dimension score extraction in History tab
          judgeEvaluation: evalData.judgeEvaluation,
        }],
        // Include full interaction data for display
        interaction: {
          evalId: evalData.evalId,
          scenarioName: evalData.scenarioName,
          turnCount: evalData.turnCount,
          turns: evalData.turns,
          sequenceDiagram: evalData.sequenceDiagram,
          formattedTranscript: evalData.formattedTranscript,
          totalTokens: evalData.totalTokens,
          learnerTokens: evalData.learnerTokens,
          tutorTokens: evalData.tutorTokens,
          latencyMs: evalData.latencyMs,
          judgeOverallScore: evalData.judgeOverallScore,
          judgeEvaluation: evalData.judgeEvaluation,
        },
        status: 'completed',
        description: evalData.scenarioName,
        scenarioNames: [evalData.scenarioName],
      });
    }

    // Regular run
    const result = evaluationRunner.getRunResults(runId);

    // Check if this is an interaction run (created from Interact tab)
    const runMetadata = result.run?.metadata ?
      (typeof result.run.metadata === 'string' ? JSON.parse(result.run.metadata) : result.run.metadata)
      : {};

    if (runMetadata.runType === 'interaction') {
      // Look up the interaction eval data by runId
      const interactionEval = evaluationStore.getInteractionEvalByRunId(runId);
      if (interactionEval) {
        return res.json({
          success: true,
          type: 'interaction',
          run: result.run,
          stats: {
            totalTests: 1,
            avgScore: interactionEval.judgeOverallScore,
          },
          results: [{
            scenarioId: interactionEval.scenarioId,
            scenarioName: interactionEval.scenarioName,
            profileName: interactionEval.tutorProfile || 'default',
            tutorProfile: interactionEval.tutorProfile || 'default',
            model: `${interactionEval.turnCount} turns`,
            passed: interactionEval.judgeOverallScore >= 3,
            overallScore: interactionEval.judgeOverallScore,
            overall_score: interactionEval.judgeOverallScore,
            inputTokens: interactionEval.learnerTokens || 0,
            outputTokens: interactionEval.tutorTokens || 0,
            latencyMs: interactionEval.latencyMs || 0,
            latency_ms: interactionEval.latencyMs || 0,
            isInteraction: true,
            interactionEvalId: interactionEval.evalId,
            dialogueId: interactionEval.evalId,
            judgeEvaluation: interactionEval.judgeEvaluation,
          }],
          interaction: {
            evalId: interactionEval.evalId,
            scenarioName: interactionEval.scenarioName,
            turnCount: interactionEval.turnCount,
            turns: interactionEval.turns,
            sequenceDiagram: interactionEval.sequenceDiagram,
            formattedTranscript: interactionEval.formattedTranscript,
            totalTokens: interactionEval.totalTokens,
            learnerTokens: interactionEval.learnerTokens,
            tutorTokens: interactionEval.tutorTokens,
            latencyMs: interactionEval.latencyMs,
            judgeOverallScore: interactionEval.judgeOverallScore,
            judgeEvaluation: interactionEval.judgeEvaluation,
          },
          status: 'completed',
          description: result.run?.description || interactionEval.scenarioName,
          scenarioNames: [interactionEval.scenarioName],
          metadata: runMetadata,
        });
      }
    }

    // Extract scenario names from results for display
    const scenarioNames = [...new Set(
      (result.results || [])
        .map((r) => r.scenarioName)
        .filter(Boolean)
    )].sort();

    // Include key run properties at top level for easier frontend access
    res.json({
      success: true,
      ...result,
      // Flatten these for easier access in UI
      status: result.run?.status,
      description: result.run?.description,
      scenarioNames,
    });
  } catch (error) {
    console.error('[EvalRoutes] Get run error:', error);
    res.status(500).json({ error: 'Failed to get run results', details: error.message });
  }
});

/**
 * Get report for a run
 * GET /api/eval/runs/:runId/report
 */
router.get('/runs/:runId/report', (req, res) => {
  try {
    const report = evaluationRunner.generateReport(req.params.runId);

    // Check if client wants plain text
    if (req.accepts('text/plain')) {
      res.type('text/plain').send(report);
    } else {
      res.json({ success: true, report });
    }
  } catch (error) {
    console.error('[EvalRoutes] Get report error:', error);
    res.status(500).json({ error: 'Failed to generate report', details: error.message });
  }
});

// ============================================================================
// Dialogue Log Endpoints
// ============================================================================

/**
 * List available log dates
 * GET /api/eval/logs/dates
 */
router.get('/logs/dates', (req, res) => {
  try {
    const dates = dialogueLogService.listLogDates();
    res.json({ success: true, dates });
  } catch (error) {
    console.error('[EvalRoutes] List log dates error:', error);
    res.status(500).json({ error: 'Failed to list log dates' });
  }
});

/**
 * Get dialogues for a specific date
 * GET /api/eval/logs/:date
 * Query params: limit (default 10), offset (default 0)
 */
router.get('/logs/:date', (req, res) => {
  try {
    const { date } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    const result = dialogueLogService.getDialogues({ date, limit, offset });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[EvalRoutes] Get dialogues error:', error);
    res.status(500).json({ error: 'Failed to get dialogues' });
  }
});

/**
 * Get a specific dialogue by dialogueId
 * GET /api/eval/logs/dialogue/:dialogueId
 */
router.get('/logs/dialogue/:dialogueId', (req, res) => {
  try {
    const { dialogueId } = req.params;

    // Check if this is an interaction eval dialogue (starts with short- or long-)
    if (dialogueId.startsWith('short-') || dialogueId.startsWith('long-')) {
      const interactionEval = evaluationStore.getInteractionEval(dialogueId);
      if (interactionEval) {
        // Format interaction eval as entries for DialogueFlowDiagram
        // Expand each turn into action-based entries the diagram expects
        const entries = [];
        let entryIndex = 0;

        for (const turn of interactionEval.turns || []) {
          const isLearner = turn.phase === 'learner';

          // Add internal deliberation steps if present
          if (turn.internalDeliberation && turn.internalDeliberation.length > 0) {
            for (const delib of turn.internalDeliberation) {
              if (delib.role === 'ego') {
                entries.push({
                  index: entryIndex++,
                  action: isLearner ? 'learner_ego_thought' : 'tutor_ego_thought',
                  agent: isLearner ? 'ego' : 'tutor_ego',
                  phase: turn.phase,
                  message: delib.content,
                  timestamp: turn.timestamp,
                });
              } else if (delib.role === 'superego') {
                entries.push({
                  index: entryIndex++,
                  action: isLearner ? 'learner_superego_critique' : 'tutor_superego_critique',
                  agent: isLearner ? 'superego' : 'tutor_superego',
                  phase: turn.phase,
                  message: delib.content,
                  timestamp: turn.timestamp,
                });
              }
            }
          }

          // Add the external message entry
          entries.push({
            index: entryIndex++,
            action: isLearner ? 'learner_input' : 'tutor_response',
            agent: isLearner ? 'ego' : 'tutor_ego',
            phase: turn.phase,
            message: turn.externalMessage,
            timestamp: turn.timestamp,
            turnNumber: turn.turnNumber,
          });
        }

        // Calculate summary stats
        const learnerTurns = (interactionEval.turns || []).filter(t => t.phase === 'learner').length;
        const tutorTurns = (interactionEval.turns || []).filter(t => t.phase === 'tutor').length;

        return res.json({
          success: true,
          dialogueId,
          dialogue: {
            dialogueId,
            entries,
            startTime: interactionEval.createdAt,
            isInteractionEval: true,
            scenarioName: interactionEval.scenarioName,
            personaId: interactionEval.personaId,
            judgeEvaluation: interactionEval.judgeEvaluation,
            summary: {
              totalTurns: interactionEval.turnCount,
              egoCount: learnerTurns,
              userCount: interactionEval.turnCount,
              superegoCount: 0,
              totalLatencyMs: interactionEval.latencyMs || 0,
              totalInputTokens: Math.floor((interactionEval.totalTokens || 0) / 2),
              totalOutputTokens: Math.ceil((interactionEval.totalTokens || 0) / 2),
              totalCost: 0,
            },
            sequenceDiagram: interactionEval.sequenceDiagram,
            formattedTranscript: interactionEval.formattedTranscript,
            isInteraction: true,
          },
        });
      }
    }

    // Regular dialogue lookup
    const dialogue = dialogueLogService.getDialogueById(dialogueId);

    if (!dialogue) {
      return res.status(404).json({ error: 'Dialogue not found' });
    }

    res.json({ success: true, dialogue, dialogueId });
  } catch (error) {
    console.error('[EvalRoutes] Get dialogue by ID error:', error);
    res.status(500).json({ error: 'Failed to get dialogue' });
  }
});

/**
 * Get a specific dialogue by index
 * GET /api/eval/logs/:date/:index
 */
router.get('/logs/:date/:index', (req, res) => {
  try {
    const { date, index } = req.params;
    const dialogue = dialogueLogService.getDialogueByIndex(date, parseInt(index));

    if (!dialogue) {
      return res.status(404).json({ error: 'Dialogue not found' });
    }

    res.json({ success: true, dialogue });
  } catch (error) {
    console.error('[EvalRoutes] Get dialogue error:', error);
    res.status(500).json({ error: 'Failed to get dialogue' });
  }
});

/**
 * Get log statistics
 * GET /api/eval/logs/stats
 * Query params: startDate, endDate
 */
router.get('/logs-stats', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const stats = dialogueLogService.getLogStatistics({ startDate, endDate });
    res.json({ success: true, ...stats });
  } catch (error) {
    console.error('[EvalRoutes] Get log stats error:', error);
    res.status(500).json({ error: 'Failed to get log statistics' });
  }
});

// ============================================================================
// Prompt Endpoints (Read-Only)
// ============================================================================

/**
 * List available prompts
 * GET /api/eval/prompts
 */
router.get('/prompts', (req, res) => {
  try {
    if (!fs.existsSync(PROMPTS_DIR)) {
      return res.json({ success: true, prompts: [] });
    }

    const files = fs.readdirSync(PROMPTS_DIR)
      .filter(f => f.endsWith('.md'))
      .map(f => {
        const filePath = path.join(PROMPTS_DIR, f);
        const stats = fs.statSync(filePath);
        return {
          name: f.replace('.md', ''),
          filename: f,
          size: stats.size,
          modified: stats.mtime.toISOString(),
        };
      });

    res.json({ success: true, prompts: files });
  } catch (error) {
    console.error('[EvalRoutes] List prompts error:', error);
    res.status(500).json({ error: 'Failed to list prompts' });
  }
});

/**
 * Get prompt content (read-only)
 * GET /api/eval/prompts/:name
 */
router.get('/prompts/:name', (req, res) => {
  try {
    const filename = req.params.name.endsWith('.md')
      ? req.params.name
      : `${req.params.name}.md`;
    const filePath = path.join(PROMPTS_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const stats = fs.statSync(filePath);

    res.json({
      success: true,
      prompt: {
        name: req.params.name,
        filename,
        content,
        size: stats.size,
        modified: stats.mtime.toISOString(),
      },
    });
  } catch (error) {
    console.error('[EvalRoutes] Get prompt error:', error);
    res.status(500).json({ error: 'Failed to get prompt' });
  }
});

/**
 * Generate prompt improvement recommendations (read-only)
 * POST /api/eval/prompts/recommend
 *
 * Body: {
 *   runId: "run-123",         // Get results from a run
 *   profile: "budget",        // Or run fresh tests with this profile
 *   scenarios: "all"          // Scenarios to test (if running fresh)
 * }
 *
 * Returns recommendations for prompt improvements.
 * Does NOT write to disk - web clients can display these for review.
 */
router.post('/prompts/recommend', async (req, res) => {
  try {
    const { runId, profile, scenarios = 'all' } = req.body;

    let results = [];
    let profileName = profile || 'unknown';

    if (runId) {
      // Get results from existing run
      const runResults = evaluationStore.getResults(runId);
      if (!runResults || runResults.length === 0) {
        return res.status(404).json({ error: 'Run not found or has no results' });
      }
      results = runResults;
      profileName = runResults[0]?.profileName || profileName;
    } else if (profile) {
      // Run fresh evaluations
      const allScenarios = evalConfigLoader.listScenarios();
      const scenariosToRun = scenarios === 'all'
        ? allScenarios
        : allScenarios.filter(s => scenarios.includes(s.id));

      for (const scenario of scenariosToRun) {
        try {
          const config = { profileName: profile, label: profile };
          const result = await evaluationRunner.quickTest(config, {
            scenarioId: scenario.id,
            verbose: false,
            skipRubricEval: false, // Need rubric for recommendations
          });
          results.push(result);
        } catch (e) {
          // Skip failed tests
        }
      }
    } else {
      return res.status(400).json({ error: 'Either runId or profile is required' });
    }

    if (results.length === 0) {
      return res.status(400).json({ error: 'No evaluation results available' });
    }

    // Generate recommendations
    const recommendations = await promptRecommendationService.generateRecommendations({
      results,
      profileName,
    });

    res.json({
      success: true,
      ...recommendations,
      // Explicitly note this is read-only
      readOnly: true,
      note: 'Recommendations are for review only. Use CLI to apply changes.',
    });
  } catch (error) {
    console.error('[EvalRoutes] Recommend prompts error:', error);
    res.status(500).json({ error: 'Failed to generate recommendations', details: error.message });
  }
});

// ============================================================================
// Streaming Evaluation Endpoints
// ============================================================================

/**
 * Run evaluation with SSE streaming for real-time progress
 * GET /api/eval/stream/run
 * Query params: profiles, scenarios, skipRubric
 */
router.get('/stream/run', async (req, res) => {
  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const sendEvent = (type, data) => {
    res.write(`event: ${type}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Keep-alive to prevent connection timeout
  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 15000);

  // Register stream for crash protection
  const streamId = registerStream(res, keepAlive);

  // Clean up on close
  req.on('close', () => {
    clearInterval(keepAlive);
    unregisterStream(streamId);
  });

  try {
    const profiles = req.query.profiles
      ? req.query.profiles.split(',')
      : ['budget'];
    const scenarios = req.query.scenarios === 'all' || !req.query.scenarios
      ? 'all'
      : req.query.scenarios.split(',');
    const skipRubric = req.query.skipRubric === 'true';
    const outputSize = req.query.outputSize || 'normal';

    // Get all scenarios to run
    const allScenarios = evalConfigLoader.listScenarios();
    const scenariosToRun = scenarios === 'all'
      ? allScenarios
      : allScenarios.filter(s => scenarios.includes(s.id));

    const totalTests = profiles.length * scenariosToRun.length;
    let completedTests = 0;

    sendEvent('start', {
      profiles,
      scenarioCount: scenariosToRun.length,
      totalTests,
      skipRubric,
      outputSize,
      timestamp: new Date().toISOString(),
    });

    sendEvent('log', { message: `Starting batch run: ${profiles.length} profiles × ${scenariosToRun.length} scenarios = ${totalTests} tests`, level: 'info' });
    sendEvent('log', { message: `Fast mode (skip rubric): ${skipRubric}`, level: 'info' });
    sendEvent('log', { message: `Output size: ${outputSize}`, level: 'info' });

    const results = [];

    for (const profileName of profiles) {
      sendEvent('log', { message: `\n=== Profile: ${profileName} ===`, level: 'info' });

      for (const scenario of scenariosToRun) {
        completedTests++;

        sendEvent('progress', {
          current: completedTests,
          total: totalTests,
          profile: profileName,
          scenario: scenario.name,
          percentage: Math.round((completedTests / totalTests) * 100),
        });

        sendEvent('log', { message: `[${completedTests}/${totalTests}] ${scenario.name}...`, level: 'info' });

        try {
          const config = { profileName, label: profileName };

          // Create log callback for this test
          const onLog = (message, level = 'info') => {
            sendEvent('log', { message: `  ${message}`, level, timestamp: new Date().toISOString() });
          };

          const result = await evaluationRunner.quickTest(config, {
            scenarioId: scenario.id,
            skipRubricEval: skipRubric,
            outputSize,
            verbose: false,
            onLog,
          });

          results.push(result);

          const scoreStr = result.overallScore != null ? result.overallScore.toFixed(1) : 'N/A';
          const status = result.success !== false ? '✓' : '✗';
          sendEvent('log', { message: `  ${status} Score: ${scoreStr} (${result.latencyMs}ms)`, level: result.success !== false ? 'success' : 'warning' });

          sendEvent('result', {
            profile: profileName,
            scenarioId: scenario.id,
            scenarioName: scenario.name,
            passed: result.success,
            score: result.overallScore,
            latencyMs: result.latencyMs,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            totalTokens: (result.inputTokens || 0) + (result.outputTokens || 0),
          });
        } catch (e) {
          sendEvent('log', { message: `  ✗ Error: ${e.message}`, level: 'error' });
          sendEvent('error', {
            profile: profileName,
            scenarioId: scenario.id,
            error: e.message,
          });
        }
      }
    }

    // Calculate summary
    const successCount = results.filter(r => r.success !== false).length;
    const scores = results.filter(r => r.overallScore != null).map(r => r.overallScore);
    const avgScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : null;

    sendEvent('log', { message: `\n=== Batch Complete ===`, level: 'success' });
    sendEvent('log', { message: `Total: ${totalTests}, Passed: ${successCount}, Avg Score: ${avgScore?.toFixed(1) || 'N/A'}`, level: 'info' });

    sendEvent('complete', {
      totalTests,
      successfulTests: successCount,
      averageScore: avgScore,
    });

    unregisterStream(streamId);
    res.end();
  } catch (error) {
    sendEvent('log', { message: `Fatal error: ${error.message}`, level: 'error' });
    sendEvent('error', { error: error.message });
    unregisterStream(streamId);
    res.end();
  }
});

// ============================================================================
// Trajectory and Improvement Cycle Endpoints
// ============================================================================

/**
 * Get improvement trajectory for a profile
 * GET /api/eval/trajectory/:profile
 * Query params: last (number of cycles), all (boolean)
 */
router.get('/trajectory/:profile', (req, res) => {
  try {
    const { profile } = req.params;
    const last = parseInt(req.query.last) || 5;
    const all = req.query.all === 'true';

    const trajectoryDir = path.join(process.cwd(), 'data', 'improvement-trajectories');
    const trajectoryFile = path.join(trajectoryDir, `${profile}.json`);

    if (!fs.existsSync(trajectoryFile)) {
      return res.json({
        success: true,
        profile,
        cycles: [],
        message: 'No improvement history found for this profile',
      });
    }

    const data = JSON.parse(fs.readFileSync(trajectoryFile, 'utf8'));
    const cycles = all ? data.cycles : data.cycles.slice(-last);

    res.json({
      success: true,
      profile,
      startedAt: data.startedAt,
      lastUpdated: data.lastUpdated,
      totalCycles: data.cycles.length,
      cycles,
    });
  } catch (error) {
    console.error('[EvalRoutes] Get trajectory error:', error);
    res.status(500).json({ error: 'Failed to get trajectory', details: error.message });
  }
});

/**
 * Compare two evaluation runs
 * GET /api/eval/compare-runs/:runId1/:runId2
 */
router.get('/compare-runs/:runId1/:runId2', (req, res) => {
  try {
    const { runId1, runId2 } = req.params;

    const results1 = evaluationStore.getResults(runId1);
    const results2 = evaluationStore.getResults(runId2);

    if (!results1 || results1.length === 0) {
      return res.status(404).json({ error: `Run ${runId1} not found` });
    }
    if (!results2 || results2.length === 0) {
      return res.status(404).json({ error: `Run ${runId2} not found` });
    }

    // Calculate averages for each run
    const calcAverages = (results) => {
      const dims = ['relevance', 'specificity', 'pedagogical', 'personalization', 'actionability', 'tone'];
      const dimScores = {};
      dims.forEach(d => { dimScores[d] = []; });

      let totalScore = 0;
      let scoreCount = 0;

      results.forEach(r => {
        if (r.overall_score != null) {
          totalScore += r.overall_score;
          scoreCount++;
        }
        dims.forEach(d => {
          const score = r[`score_${d}`];
          if (score != null) {
            dimScores[d].push(score);
          }
        });
      });

      const dimAverages = {};
      dims.forEach(d => {
        const scores = dimScores[d];
        dimAverages[d] = scores.length > 0
          ? scores.reduce((a, b) => a + b, 0) / scores.length
          : null;
      });

      return {
        overallScore: scoreCount > 0 ? totalScore / scoreCount : null,
        dimensions: dimAverages,
        testCount: results.length,
        successCount: results.filter(r => r.success).length,
      };
    };

    const avg1 = calcAverages(results1);
    const avg2 = calcAverages(results2);

    // Calculate deltas
    const deltas = {
      overallScore: avg2.overallScore != null && avg1.overallScore != null
        ? avg2.overallScore - avg1.overallScore
        : null,
      dimensions: {},
    };

    Object.keys(avg1.dimensions).forEach(dim => {
      if (avg1.dimensions[dim] != null && avg2.dimensions[dim] != null) {
        deltas.dimensions[dim] = avg2.dimensions[dim] - avg1.dimensions[dim];
      } else {
        deltas.dimensions[dim] = null;
      }
    });

    res.json({
      success: true,
      run1: { id: runId1, ...avg1 },
      run2: { id: runId2, ...avg2 },
      deltas,
      improved: deltas.overallScore != null && deltas.overallScore > 0,
    });
  } catch (error) {
    console.error('[EvalRoutes] Compare runs error:', error);
    res.status(500).json({ error: 'Failed to compare runs', details: error.message });
  }
});

/**
 * Get dimension statistics across all runs for trend analysis
 * GET /api/eval/trends
 * Query params: profile, limit (default 50 individual results)
 *
 * Returns individual test results (not aggregated per run) for accurate trend visualization.
 * Each point represents a single evaluation, not an averaged run.
 */
router.get('/trends', (req, res) => {
  try {
    const { profile } = req.query;
    const limit = parseInt(req.query.limit) || 50;

    // Get recent runs (fetch 3x the limit to account for fast-mode runs being filtered)
    // Many runs may be --fast (no AI scoring), so we need to fetch more to get enough scored results
    const runs = evaluationStore.listRuns({ limit: limit * 3 });

    // Helper to extract numeric score from potentially complex score objects
    const extractNumericScore = (scoreVal) => {
      if (scoreVal == null) return null;
      if (typeof scoreVal === 'number') return isNaN(scoreVal) ? null : scoreVal;
      if (typeof scoreVal === 'object' && scoreVal.score != null) {
        const s = scoreVal.score;
        return typeof s === 'number' && !isNaN(s) ? s : null;
      }
      return null;
    };

    // Collect individual results from all runs
    const allResults = [];
    const dims = ['relevance', 'specificity', 'pedagogical', 'personalization', 'actionability', 'tone'];

    for (const run of runs) {
      const results = evaluationStore.getResults(run.id);

      // Use metadata.runType if available, fallback to parsing description
      const metadata = run.metadata || {};
      let runType = metadata.runType || 'eval';
      if (runType === 'eval' && run.description) {
        const desc = run.description.toLowerCase();
        if (desc.includes('matrix')) runType = 'matrix';
        else if (desc.includes('auto-improve')) runType = 'auto';
        else if (desc.includes('compare')) runType = 'compare';
        else if (desc.includes('quick')) runType = 'quick';
      }

      for (const r of results) {
        // Filter by profile if specified
        if (profile && r.profileName !== profile) continue;

        // Extract dimension scores
        const dimScores = {};
        dims.forEach(d => {
          dimScores[d] = extractNumericScore(r.scores?.[d]);
        });

        allResults.push({
          runId: run.id,
          resultId: r.id,
          createdAt: r.createdAt || run.createdAt,
          description: run.description,
          runType,
          profileName: r.profileName,
          scenarioName: r.scenarioName,
          overallScore: extractNumericScore(r.overallScore),
          dimensions: dimScores,
          // Include testCount for the table display (how many tests in this run)
          testCount: results.length,
          // Include profiles array for compatibility with table display
          profiles: [r.profileName].filter(Boolean),
        });
      }
    }

    // Sort by createdAt (oldest first for charting) and limit
    allResults.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const trends = allResults.slice(-limit);

    res.json({
      success: true,
      profile: profile || 'all',
      trends,
      totalResults: allResults.length,
    });
  } catch (error) {
    console.error('[EvalRoutes] Get trends error:', error);
    res.status(500).json({ error: 'Failed to get trends', details: error.message });
  }
});

// ============================================================================
// Documentation Endpoints
// ============================================================================

// Path to evaluation documentation directory
const EVAL_DOCS_DIR = path.join(process.cwd(), 'markdown', 'eval');
// Path to research documentation directory
const RESEARCH_DOCS_DIR = path.join(process.cwd(), 'docs', 'research');

/**
 * List available evaluation documentation files
 * GET /api/eval/docs
 */
router.get('/docs', (req, res) => {
  try {
    if (!fs.existsSync(EVAL_DOCS_DIR)) {
      return res.json({ success: true, docs: [] });
    }

    const files = fs.readdirSync(EVAL_DOCS_DIR)
      .filter(f => f.endsWith('.md'))
      .map(f => {
        const filePath = path.join(EVAL_DOCS_DIR, f);
        const stats = fs.statSync(filePath);
        // Extract a friendly title from filename
        const name = f.replace('.md', '');
        const title = name
          .replace(/-/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());
        return {
          name,
          filename: f,
          title,
          size: stats.size,
          modified: stats.mtime.toISOString(),
        };
      })
      .sort((a, b) => a.title.localeCompare(b.title));

    res.json({ success: true, docs: files });
  } catch (error) {
    console.error('[EvalRoutes] List docs error:', error);
    res.status(500).json({ error: 'Failed to list docs' });
  }
});

/**
 * Get documentation file content
 * GET /api/eval/docs/:name
 *
 * Supports "research:" prefix to load from docs/research/ directory
 * e.g., /api/eval/docs/research:PAPER-DRAFT-RECOGNITION-TUTORING
 */
router.get('/docs/:name', (req, res) => {
  try {
    let docName = req.params.name;
    let docsDir = EVAL_DOCS_DIR;

    // Check for research: prefix to load from docs/research/
    if (docName.startsWith('research:')) {
      docName = docName.substring('research:'.length);
      docsDir = RESEARCH_DOCS_DIR;
    }

    const filename = docName.endsWith('.md')
      ? docName
      : `${docName}.md`;
    const filePath = path.join(docsDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Documentation not found' });
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const stats = fs.statSync(filePath);

    // Extract title from first heading or filename
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch
      ? titleMatch[1]
      : docName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    res.json({
      success: true,
      doc: {
        name: req.params.name,
        filename,
        title,
        content,
        size: stats.size,
        modified: stats.mtime.toISOString(),
      },
    });
  } catch (error) {
    console.error('[EvalRoutes] Get doc error:', error);
    res.status(500).json({ error: 'Failed to get documentation' });
  }
});

// ============================================================================
// Monitoring Endpoints
// ============================================================================

/**
 * Get monitoring summary
 * GET /api/eval/monitor/summary
 */
router.get('/monitor/summary', (req, res) => {
  try {
    const summary = monitoringService.getMonitoringSummary();
    res.json({ success: true, ...summary });
  } catch (error) {
    console.error('[EvalRoutes] Monitor summary error:', error);
    res.status(500).json({ error: 'Failed to get monitoring summary' });
  }
});

/**
 * Get active sessions
 * GET /api/eval/monitor/sessions
 */
router.get('/monitor/sessions', (req, res) => {
  try {
    const sessions = monitoringService.getActiveSessions();
    const aggregate = monitoringService.getAggregateMetrics();
    res.json({ success: true, sessions, aggregate });
  } catch (error) {
    console.error('[EvalRoutes] Monitor sessions error:', error);
    res.status(500).json({ error: 'Failed to get active sessions' });
  }
});

/**
 * Get specific session details
 * GET /api/eval/monitor/sessions/:id
 */
router.get('/monitor/sessions/:id', (req, res) => {
  try {
    const session = monitoringService.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json({ success: true, session });
  } catch (error) {
    console.error('[EvalRoutes] Get session error:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

/**
 * Get alerts
 * GET /api/eval/monitor/alerts
 * Query params: severity, acknowledged, limit
 */
router.get('/monitor/alerts', (req, res) => {
  try {
    const { severity, acknowledged, limit } = req.query;
    const options = {};
    if (severity) options.severity = severity;
    if (acknowledged !== undefined) options.acknowledged = acknowledged === 'true';
    if (limit) options.limit = parseInt(limit, 10);

    const alerts = monitoringService.getAlerts(options);
    res.json({ success: true, alerts });
  } catch (error) {
    console.error('[EvalRoutes] Get alerts error:', error);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

/**
 * Acknowledge an alert
 * POST /api/eval/monitor/alerts/:id/acknowledge
 */
router.post('/monitor/alerts/:id/acknowledge', (req, res) => {
  try {
    const alert = monitoringService.acknowledgeAlert(req.params.id);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json({ success: true, alert });
  } catch (error) {
    console.error('[EvalRoutes] Acknowledge alert error:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

// ============================================================================
// Run Completion & Recovery Endpoints
// ============================================================================

/**
 * Complete an incomplete evaluation run
 * POST /api/eval/runs/:runId/complete
 *
 * Marks a stuck/interrupted run as completed with whatever results exist.
 */
router.post('/runs/:runId/complete', (req, res) => {
  try {
    const result = evaluationStore.completeRun(req.params.runId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[EvalRoutes] Complete run error:', error);
    res.status(500).json({ error: 'Failed to complete run', details: error.message });
  }
});

/**
 * Get resumption status for an incomplete run
 * GET /api/eval/runs/:runId/resume-status
 *
 * Returns which tests have been completed and which remain,
 * enabling resumption of interrupted evaluations.
 *
 * Query params: profiles (comma-separated), scenarios (comma-separated or "all")
 */
router.get('/runs/:runId/resume-status', (req, res) => {
  try {
    const { runId } = req.params;
    const run = evaluationStore.getRun(runId);

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    // Get profiles and scenarios from query or run metadata
    const metadata = run.metadata ? JSON.parse(run.metadata) : {};
    let profiles = req.query.profiles ? req.query.profiles.split(',') : metadata.profiles || [];
    let scenariosParam = req.query.scenarios || metadata.scenarios || 'all';

    if (profiles.length === 0) {
      return res.status(400).json({
        error: 'Profiles not specified',
        hint: 'Provide profiles as query param or ensure run metadata contains profiles',
      });
    }

    // Get scenarios
    const allScenarios = evalConfigLoader.listScenarios();
    const scenarios = scenariosParam === 'all'
      ? allScenarios
      : allScenarios.filter(s => scenariosParam.includes(s.id));

    // Get incomplete tests
    const status = evaluationStore.getIncompleteTests(runId, profiles, scenarios);

    res.json({
      success: true,
      ...status,
      runMetadata: {
        description: run.description,
        createdAt: run.createdAt,
        totalScenarios: run.totalScenarios,
        totalConfigurations: run.totalConfigurations,
      },
    });
  } catch (error) {
    console.error('[EvalRoutes] Resume status error:', error);
    res.status(500).json({ error: 'Failed to get resume status', details: error.message });
  }
});

// ============================================================================
// Interaction Evaluation Endpoints (Learner-Tutor Dialogues)
// ============================================================================

/**
 * List interaction evaluations
 * GET /api/eval/interactions
 * Query params: limit (default 50), scenarioId
 */
router.get('/interactions', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const scenarioId = req.query.scenarioId || null;

    const evals = evaluationStore.listInteractionEvals({ limit, scenarioId });
    res.json({ success: true, evals, count: evals.length });
  } catch (error) {
    console.error('[EvalRoutes] List interactions error:', error);
    res.status(500).json({ error: 'Failed to list interaction evaluations' });
  }
});

/**
 * Get a specific interaction evaluation
 * GET /api/eval/interactions/:evalId
 */
router.get('/interactions/:evalId', (req, res) => {
  try {
    const { evalId } = req.params;
    const evalData = evaluationStore.getInteractionEval(evalId);

    if (!evalData) {
      return res.status(404).json({ error: 'Interaction evaluation not found' });
    }

    res.json({ success: true, ...evalData });
  } catch (error) {
    console.error('[EvalRoutes] Get interaction error:', error);
    res.status(500).json({ error: 'Failed to get interaction evaluation' });
  }
});

/**
 * Get mermaid sequence diagram for an interaction evaluation
 * GET /api/eval/interactions/:evalId/diagram
 */
router.get('/interactions/:evalId/diagram', (req, res) => {
  try {
    const { evalId } = req.params;
    const evalData = evaluationStore.getInteractionEval(evalId);

    if (!evalData) {
      return res.status(404).json({ error: 'Interaction evaluation not found' });
    }

    res.type('text/plain').send(evalData.sequenceDiagram || 'No diagram available');
  } catch (error) {
    console.error('[EvalRoutes] Get diagram error:', error);
    res.status(500).json({ error: 'Failed to get diagram' });
  }
});

/**
 * Get formatted transcript for an interaction evaluation
 * GET /api/eval/interactions/:evalId/transcript
 */
router.get('/interactions/:evalId/transcript', (req, res) => {
  try {
    const { evalId } = req.params;
    const evalData = evaluationStore.getInteractionEval(evalId);

    if (!evalData) {
      return res.status(404).json({ error: 'Interaction evaluation not found' });
    }

    res.type('text/plain').send(evalData.formattedTranscript || 'No transcript available');
  } catch (error) {
    console.error('[EvalRoutes] Get transcript error:', error);
    res.status(500).json({ error: 'Failed to get transcript' });
  }
});

// ============================================================================
// Recognition A/B Comparison Endpoint
// ============================================================================

/**
 * Run Recognition A/B comparison with SSE streaming
 * GET /api/eval/stream/recognition-ab
 *
 * Compares baseline (no recognition) vs recognition (with recognition) profiles
 * using only recognition_test: true scenarios.
 *
 * Returns:
 * - Per-profile results with dimension scores
 * - Recognition metrics for recognition profile
 * - Delta analysis with statistical significance indicators
 * - Winner badges per dimension
 */
router.get('/stream/recognition-ab', async (req, res) => {
  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const sendEvent = (type, data) => {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Keep-alive to prevent connection timeout
  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 15000);

  // Register stream for crash protection
  const streamId = registerStream(res, keepAlive);

  // Clean up on close
  req.on('close', () => {
    clearInterval(keepAlive);
    unregisterStream(streamId);
  });

  try {
    // Fixed profiles for A/B comparison
    const profiles = ['baseline', 'recognition'];
    const skipRubric = req.query.skipRubric === 'true';
    const outputSize = req.query.outputSize || 'normal';

    // Validate profiles exist
    const allProfiles = tutorConfigLoader.listProfiles();
    const validProfiles = profiles.filter(p => allProfiles.some(ap => ap.name === p));

    if (validProfiles.length !== 2) {
      sendEvent('error', {
        error: 'Recognition A/B requires both baseline and recognition profiles',
        found: validProfiles,
        available: allProfiles.map(p => p.name),
      });
      return res.end();
    }

    // Get only recognition_test scenarios
    const allScenarios = evalConfigLoader.listScenarios();
    const recognitionScenarios = allScenarios.filter(s => s.recognition_test === true);

    if (recognitionScenarios.length === 0) {
      sendEvent('error', { error: 'No recognition_test scenarios found in config' });
      return res.end();
    }

    const totalTests = validProfiles.length * recognitionScenarios.length;
    const testLearnerId = `eval-recognition-ab-${Date.now()}`;

    sendEvent('start', {
      profiles: validProfiles,
      scenarioCount: recognitionScenarios.length,
      scenarioIds: recognitionScenarios.map(s => s.id),
      totalTests,
      skipRubric,
      outputSize,
      testLearnerId,
      timestamp: new Date().toISOString(),
    });

    sendEvent('log', {
      message: `Recognition A/B: baseline vs recognition × ${recognitionScenarios.length} scenarios`,
      level: 'info',
    });

    // Create a run to persist results
    const run = evaluationStore.createRun({
      description: `Recognition A/B: baseline vs recognition × ${recognitionScenarios.length} scenarios`,
      totalScenarios: recognitionScenarios.length,
      totalConfigurations: 2,
      metadata: {
        runType: 'recognition-ab',
        profiles: validProfiles,
        scenarios: recognitionScenarios.map(s => s.id),
        scenarioNames: recognitionScenarios.map(s => s.name),
        skipRubric,
        testLearnerId,
      },
    });

    sendEvent('log', { message: `Run ID: ${run.id}`, level: 'info' });

    // Run evaluations
    const results = { baseline: [], recognition: [] };
    const dimensionScores = { baseline: {}, recognition: {} };
    const recognitionMetrics = {
      momentsGenerated: 0,
      dialecticalDepth: [],
      synthesisStrategies: {
        ghost_dominates: 0,
        learner_dominates: 0,
        dialectical_synthesis: 0,
      },
    };
    let completedTests = 0;

    for (const profileName of validProfiles) {
      sendEvent('log', { message: `\n=== Profile: ${profileName} ===`, level: 'info' });

      // Clear writing pad before each profile run for clean comparison
      try {
        clearConscious(testLearnerId);
        sendEvent('log', { message: `  Cleared writing pad for ${testLearnerId}`, level: 'info' });
      } catch (e) {
        // Pad may not exist yet, that's fine
      }

      for (const scenario of recognitionScenarios) {
        completedTests++;

        sendEvent('progress', {
          current: completedTests,
          total: totalTests,
          profile: profileName,
          scenario: scenario.name,
          percentage: Math.round((completedTests / totalTests) * 100),
        });

        sendEvent('log', { message: `[${completedTests}/${totalTests}] ${scenario.name}...`, level: 'info' });

        try {
          const config = { profileName, label: profileName };

          // Create log callback for this test
          const onLog = (message, level = 'info') => {
            sendEvent('log', { message: `  ${message}`, level, timestamp: new Date().toISOString() });
          };

          const result = await evaluationRunner.quickTest(config, {
            scenarioId: scenario.id,
            verbose: false,
            skipRubricEval: skipRubric,
            outputSize,
            onLog,
            learnerId: testLearnerId,
          });

          results[profileName].push(result);

          // Save result to database
          evaluationStore.storeResult(run.id, {
            ...result,
            scenarioId: scenario.id,
            scenarioName: scenario.name,
            profileName,
          });

          // Collect dimension scores
          if (result.scores) {
            for (const [dim, score] of Object.entries(result.scores)) {
              if (!dimensionScores[profileName][dim]) {
                dimensionScores[profileName][dim] = [];
              }
              if (typeof score === 'number') {
                dimensionScores[profileName][dim].push(score);
              }
            }
          }

          // For recognition profile, collect recognition-specific metrics
          if (profileName === 'recognition') {
            try {
              const pad = getWritingPad(testLearnerId);
              if (pad) {
                recognitionMetrics.momentsGenerated = pad.totalRecognitionMoments || 0;
                if (pad.dialecticalDepth) {
                  recognitionMetrics.dialecticalDepth.push(pad.dialecticalDepth);
                }
                // Aggregate synthesis strategies from pad stats
                const stats = pad.statistics || {};
                if (stats.synthesisStrategies) {
                  recognitionMetrics.synthesisStrategies.ghost_dominates += stats.synthesisStrategies.ghost_dominates || 0;
                  recognitionMetrics.synthesisStrategies.learner_dominates += stats.synthesisStrategies.learner_dominates || 0;
                  recognitionMetrics.synthesisStrategies.dialectical_synthesis += stats.synthesisStrategies.dialectical_synthesis || 0;
                }
              }
            } catch (e) {
              // Recognition metrics collection failed silently
            }
          }

          const scoreStr = result.overallScore != null ? result.overallScore.toFixed(1) : 'N/A';
          const status = result.success !== false ? '✓' : '✗';
          sendEvent('log', {
            message: `  ${status} Score: ${scoreStr} (${result.latencyMs}ms)`,
            level: result.success !== false ? 'success' : 'warning',
          });

          sendEvent('result', {
            profile: profileName,
            scenarioId: scenario.id,
            scenarioName: scenario.name,
            passed: result.success !== false,
            score: result.overallScore,
            latencyMs: result.latencyMs,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
          });

        } catch (e) {
          sendEvent('log', { message: `  ✗ Error: ${e.message}`, level: 'error' });

          const errorResult = {
            success: false,
            errorMessage: e.message,
            scenarioId: scenario.id,
          };
          results[profileName].push(errorResult);

          evaluationStore.storeResult(run.id, {
            ...errorResult,
            scenarioName: scenario.name,
            profileName,
            provider: 'unknown',
            model: 'unknown',
          });
        }
      }
    }

    // Update run as completed
    evaluationStore.updateRun(run.id, {
      status: 'completed',
      totalTests: completedTests,
      completedAt: new Date().toISOString(),
    });

    // Build dimension averages
    const dimensions = ['relevance', 'specificity', 'pedagogical', 'personalization', 'actionability', 'tone'];
    const dimensionAverages = { baseline: {}, recognition: {} };

    for (const profile of validProfiles) {
      for (const dim of dimensions) {
        const scores = dimensionScores[profile]?.[dim] || [];
        dimensionAverages[profile][dim] = scores.length > 0
          ? scores.reduce((a, b) => a + b, 0) / scores.length
          : null;
      }
    }

    // Build delta analysis with winner indicators
    const deltaAnalysis = [];
    for (const dim of dimensions) {
      const baselineAvg = dimensionAverages.baseline[dim];
      const recognitionAvg = dimensionAverages.recognition[dim];

      if (baselineAvg != null && recognitionAvg != null) {
        const delta = recognitionAvg - baselineAvg;
        const deltaPercent = baselineAvg > 0 ? (delta / baselineAvg) * 100 : 0;

        // Significance thresholds (on 5-point scale)
        // * = >5% improvement (delta > 0.25)
        // ** = >10% improvement (delta > 0.5)
        let significance = '';
        let winner = null;

        if (Math.abs(delta) > 0.5) {
          significance = '**';
          winner = delta > 0 ? 'recognition' : 'baseline';
        } else if (Math.abs(delta) > 0.25) {
          significance = '*';
          winner = delta > 0 ? 'recognition' : 'baseline';
        }

        deltaAnalysis.push({
          dimension: dim,
          baseline: baselineAvg,
          recognition: recognitionAvg,
          delta,
          deltaPercent,
          significance,
          winner,
        });
      }
    }

    // Calculate overall scores and winner
    const baselineResults = results.baseline || [];
    const recognitionResults = results.recognition || [];

    const baselineScores = baselineResults.filter(r => r.overallScore != null).map(r => r.overallScore);
    const recognitionScores = recognitionResults.filter(r => r.overallScore != null).map(r => r.overallScore);

    const baselineAvgScore = baselineScores.length > 0
      ? baselineScores.reduce((a, b) => a + b, 0) / baselineScores.length
      : null;
    const recognitionAvgScore = recognitionScores.length > 0
      ? recognitionScores.reduce((a, b) => a + b, 0) / recognitionScores.length
      : null;

    let overallWinner = null;
    let overallDelta = null;
    let overallSignificance = '';

    if (baselineAvgScore != null && recognitionAvgScore != null) {
      overallDelta = recognitionAvgScore - baselineAvgScore;

      // Overall winner based on score delta > 5 points
      if (Math.abs(overallDelta) > 10) {
        overallSignificance = '**';
        overallWinner = overallDelta > 0 ? 'recognition' : 'baseline';
      } else if (Math.abs(overallDelta) > 5) {
        overallSignificance = '*';
        overallWinner = overallDelta > 0 ? 'recognition' : 'baseline';
      }
    }

    // Calculate average dialectical depth
    const avgDialecticalDepth = recognitionMetrics.dialecticalDepth.length > 0
      ? recognitionMetrics.dialecticalDepth.reduce((a, b) => a + b, 0) / recognitionMetrics.dialecticalDepth.length
      : 0;

    sendEvent('log', { message: `\n=== Recognition A/B Complete ===`, level: 'success' });
    sendEvent('log', { message: `Total tests: ${completedTests}`, level: 'info' });
    sendEvent('log', {
      message: `Baseline avg: ${baselineAvgScore?.toFixed(1) || 'N/A'} | Recognition avg: ${recognitionAvgScore?.toFixed(1) || 'N/A'}`,
      level: 'info',
    });
    if (overallWinner) {
      sendEvent('log', { message: `Winner: ${overallWinner.toUpperCase()} (${overallSignificance})`, level: 'success' });
    }

    // Send final complete event with full results
    sendEvent('complete', {
      success: true,
      runId: run.id,
      profiles: validProfiles,
      scenariosRun: recognitionScenarios.length,
      dimensionAverages,
      deltaAnalysis,
      overallScores: {
        baseline: baselineAvgScore,
        recognition: recognitionAvgScore,
        delta: overallDelta,
        significance: overallSignificance,
        winner: overallWinner,
      },
      recognitionMetrics: {
        momentsGenerated: recognitionMetrics.momentsGenerated,
        avgDialecticalDepth,
        synthesisStrategies: recognitionMetrics.synthesisStrategies,
      },
      results,
    });

    unregisterStream(streamId);
    res.end();
  } catch (error) {
    sendEvent('log', { message: `Fatal error: ${error.message}`, level: 'error' });
    sendEvent('error', { error: error.message });
    unregisterStream(streamId);
    res.end();
  }
});

export default router;
