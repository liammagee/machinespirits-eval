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
import { spawnSync } from 'child_process';
import * as learnerConfigLoader from '../services/learnerConfigLoader.js';
import * as promptRecommendationService from '../services/promptRecommendationService.js';
import interactionEngine from '../services/learnerTutorInteractionEngine.js';
import * as evalConfigLoader from '../services/evalConfigLoader.js';
import * as codexSessionService from '../services/codexSessionService.js';
import {
  admitEvaluationRequest,
  EvaluationAdmissionError,
  hasEvalApiPrivilegedOverride,
  resolveEvalApiMaxPlannedTests,
} from '../services/evalRequestAdmission.js';
import {
  admitFixedModelCalls,
  createModelCallBudget,
  resolveHttpMaxModelCalls,
} from '../services/httpModelWorkAdmission.js';
import { evaluationStreamRegistry } from '../services/evaluationStreamRegistry.js';
import { registerEvalAnalysisReadRoutes } from './evalAnalysisReadRoutes.js';
import { registerEvalConfigurationReadRoutes } from './evalConfigurationReadRoutes.js';
import {
  registerEvalDocumentationReadRoutes,
  registerEvalPromptReadRoutes,
  registerEvalTrajectoryReadRoutes,
} from './evalFileReadRoutes.js';
import { registerEvalInteractionReadRoutes } from './evalInteractionReadRoutes.js';
import { registerEvalLogReadRoutes } from './evalLogReadRoutes.js';
import { registerEvalMonitoringReadRoutes } from './evalMonitoringReadRoutes.js';
import {
  registerEvalRunDetailReadRoutes,
  registerEvalRunListReadRoutes,
  registerEvalRunResumeStatusReadRoute,
} from './evalRunReadRoutes.js';
// Lazy-loaded tutor-core services — resolved on first request so this module
// can be imported without tutor-core installed at parse time.
// Module-scoped vars are populated by the middleware below; existing handler
// code references them unchanged.
let tutorConfigLoader, dialogueLogService, monitoringService;
let getApiKey, getDefaultModel, clearConscious, getWritingPad;
let _tutorCoreLoaded = false;

async function ensureTutorCore() {
  if (_tutorCoreLoaded) return;
  const mod = await import('../tutor-core/index.js');
  tutorConfigLoader = mod.tutorConfigLoader;
  dialogueLogService = mod.dialogueLogService;
  monitoringService = mod.monitoringService;
  getApiKey = mod.aiConfigService.getApiKey;
  getDefaultModel = mod.aiConfigService.getDefaultModel;
  clearConscious = mod.writingPadService.clearConscious;
  getWritingPad = mod.writingPadService.getWritingPad;
  _tutorCoreLoaded = true;
}

import fs from 'fs';
import path from 'path';

const router = Router();

function evaluationDependencyFor(req, name) {
  const dependency = req?.app?.locals?.[name];
  if (!dependency || typeof dependency !== 'object') {
    throw new Error(
      `evalRoutes requires app.locals.${name}; bind the host with bindEvalSurfaceDependencies() before serving requests`,
    );
  }
  return dependency;
}

function evaluationStoreFor(req) {
  return evaluationDependencyFor(req, 'evaluationStore');
}

function evaluationRunnerFor(req) {
  return evaluationDependencyFor(req, 'evaluationRunner');
}

export function resolveEvalRouteDependencies(req) {
  return Object.freeze({
    evaluationStore: evaluationStoreFor(req),
    evaluationRunner: evaluationRunnerFor(req),
  });
}

function httpBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
}

function httpPositiveInteger(value, fallback = undefined) {
  if (value === undefined || value === '') return fallback;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) return Number(value);
  return value;
}

function httpIdList(value, fallback) {
  if (value === undefined || value === '') return fallback;
  if (value === 'all') return 'all';
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',');
  return value;
}

function requestWithAdmissionBody(req, body) {
  return {
    body,
    headers: req.headers,
    get: typeof req.get === 'function' ? req.get.bind(req) : undefined,
  };
}

function requireObjectBody(req) {
  const body = req.body === undefined ? {} : req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new EvaluationAdmissionError(400, 'invalid_request_schema', 'Request body must be a JSON object');
  }
  return body;
}

function attachEvaluationTestBudget(req, admission) {
  let used = 0;
  req.reserveEvaluationTest = (label = 'evaluation_test') => {
    if (req.aborted) {
      throw new EvaluationAdmissionError(499, 'client_closed_request', 'Client closed before model work');
    }
    if (used >= admission.plannedTestCount) {
      throw new EvaluationAdmissionError(
        409,
        'evaluation_test_budget_exhausted',
        `Test budget exhausted before ${label}`,
        {
          plannedTestCount: admission.plannedTestCount,
          usedTestCount: used,
        },
      );
    }
    used += 1;
    return used;
  };
  req.evaluationTestBudget = () =>
    Object.freeze({
      plannedTestCount: admission.plannedTestCount,
      usedTestCount: used,
      remainingTestCount: admission.plannedTestCount - used,
    });
}

export function createExactEvaluationAdmissionMiddleware({
  endpoint,
  buildInput,
  minProfiles = 1,
  profileRegistry = effectiveEvaluationProfileRegistry,
  scenarioRegistry = effectiveEvaluationScenarioRegistry,
  maxPlannedTests = () => resolveEvalApiMaxPlannedTests(),
  privilegedOverride = (req, input) => hasEvalApiPrivilegedOverride(requestWithAdmissionBody(req, input)),
} = {}) {
  return (req, res, next) => {
    try {
      if (req.aborted) {
        throw new EvaluationAdmissionError(499, 'client_closed_request', 'Client closed before admission');
      }
      if (req.evaluationAdmission) {
        throw new EvaluationAdmissionError(409, 'duplicate_request_admission', 'Request was already admitted');
      }
      const input = buildInput(req);
      req.evaluationAdmission = admitEvaluationRequest(input, {
        profileRegistry: typeof profileRegistry === 'function' ? profileRegistry() : profileRegistry,
        scenarioRegistry: typeof scenarioRegistry === 'function' ? scenarioRegistry() : scenarioRegistry,
        minProfiles,
        maxPlannedTests: typeof maxPlannedTests === 'function' ? maxPlannedTests() : maxPlannedTests,
        privilegedOverride:
          typeof privilegedOverride === 'function' ? privilegedOverride(req, input) : privilegedOverride,
        endpoint,
      });
      attachEvaluationTestBudget(req, req.evaluationAdmission);
      return next();
    } catch (error) {
      return sendEvaluationAdmissionError(res, error, `[EvalRoutes] Admission failed for ${endpoint}:`);
    }
  };
}

export function createFixedModelCallAdmissionMiddleware({
  endpoint,
  buildInput,
  plannedModelCallLimit,
  maxModelCalls = () => resolveHttpMaxModelCalls(),
  privilegedOverride = (req, input) => hasEvalApiPrivilegedOverride(requestWithAdmissionBody(req, input)),
  shortCircuitDryRun = false,
} = {}) {
  return (req, res, next) => {
    try {
      if (req.aborted) {
        throw new EvaluationAdmissionError(499, 'client_closed_request', 'Client closed before admission');
      }
      if (req.modelWorkAdmission) {
        throw new EvaluationAdmissionError(409, 'duplicate_request_admission', 'Request was already admitted');
      }
      const input = buildInput(req);
      const limit = plannedModelCallLimit(req, input);
      const admissionPlan = admitFixedModelCalls(input, {
        endpoint,
        plannedModelCallLimit: limit,
        maxModelCalls: typeof maxModelCalls === 'function' ? maxModelCalls() : maxModelCalls,
        privilegedOverride:
          typeof privilegedOverride === 'function' ? privilegedOverride(req, input) : privilegedOverride,
      });
      req.modelWorkInput = input;
      req.modelWorkAdmission = admissionPlan;
      req.modelCallBudget = createModelCallBudget(admissionPlan);
      if (shortCircuitDryRun && admissionPlan.dryRun) {
        return res.json({ success: true, dryRun: true, admissionPlan });
      }
      return next();
    } catch (error) {
      return sendEvaluationAdmissionError(res, error, `[EvalRoutes] Admission failed for ${endpoint}:`);
    }
  };
}

export function createPromptRecommendationAdmissionMiddleware({
  profileRegistry = effectiveEvaluationProfileRegistry,
  scenarioRegistry = effectiveEvaluationScenarioRegistry,
  maxPlannedTests = () => resolveEvalApiMaxPlannedTests(),
  maxModelCalls = () => resolveHttpMaxModelCalls(),
} = {}) {
  return (req, res, next) => {
    try {
      if (req.aborted) {
        throw new EvaluationAdmissionError(499, 'client_closed_request', 'Client closed before admission');
      }
      if (req.modelWorkAdmission || req.evaluationAdmission) {
        throw new EvaluationAdmissionError(409, 'duplicate_request_admission', 'Request was already admitted');
      }
      const body = req.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new EvaluationAdmissionError(400, 'invalid_request_schema', 'Request body must be a JSON object');
      }
      if (!body.runId && !body.profile) {
        throw new EvaluationAdmissionError(400, 'invalid_request_value', 'Either runId or profile is required');
      }

      const fixedInput = {
        dryRun: body.dryRun ?? false,
        confirmModelCallLimit: body.confirmModelCallLimit,
        allowOversizedPlan: body.allowOversizedPlan,
      };
      req.modelWorkAdmission = admitFixedModelCalls(fixedInput, {
        endpoint: '/api/eval/prompts/recommend',
        plannedModelCallLimit: 1,
        maxModelCalls: typeof maxModelCalls === 'function' ? maxModelCalls() : maxModelCalls,
        privilegedOverride: hasEvalApiPrivilegedOverride(requestWithAdmissionBody(req, fixedInput)),
      });
      req.modelCallBudget = createModelCallBudget(req.modelWorkAdmission);

      if (body.profile && !body.runId) {
        const evaluationInput = {
          profiles: [body.profile],
          scenarios: body.scenarios ?? 'all',
          runsPerConfig: 1,
          skipRubric: false,
          dryRun: body.dryRun ?? false,
          confirmTestCount: body.confirmTestCount,
          allowOversizedPlan: body.allowOversizedPlan,
        };
        req.evaluationAdmission = admitEvaluationRequest(evaluationInput, {
          profileRegistry: typeof profileRegistry === 'function' ? profileRegistry() : profileRegistry,
          scenarioRegistry: typeof scenarioRegistry === 'function' ? scenarioRegistry() : scenarioRegistry,
          maxPlannedTests: typeof maxPlannedTests === 'function' ? maxPlannedTests() : maxPlannedTests,
          privilegedOverride: hasEvalApiPrivilegedOverride(requestWithAdmissionBody(req, evaluationInput)),
          endpoint: '/api/eval/prompts/recommend',
        });
        attachEvaluationTestBudget(req, req.evaluationAdmission);
      }
      return next();
    } catch (error) {
      return sendEvaluationAdmissionError(res, error, '[EvalRoutes] Prompt recommendation admission failed:');
    }
  };
}

// Resolve tutor-core on first request
router.use(async (req, res, next) => {
  if (req.path.startsWith('/codex')) {
    return next();
  }
  try {
    await ensureTutorCore();
    next();
  } catch (err) {
    res.status(503).json({ error: 'tutor-core not available', message: err.message });
  }
});

// ============================================================================
// CRASH PROTECTION: Track active evaluation streams
// ============================================================================
const INTERACTION_STREAM_MAX_DURATION_MS = 30 * 60 * 1000;

export function cleanupAllStreams() {
  return evaluationStreamRegistry.cleanupAllStreams();
}

function registerStream(res, keepAlive, options = {}) {
  return evaluationStreamRegistry.registerStream(res, keepAlive, options);
}

function unregisterStream(streamId) {
  return evaluationStreamRegistry.unregisterStream(streamId);
}

function resolveApiCwd(cwd) {
  const resolved = cwd ? path.resolve(cwd) : process.cwd();
  if (!fs.existsSync(resolved)) {
    throw new Error(`cwd does not exist: ${resolved}`);
  }
  if (!fs.statSync(resolved).isDirectory()) {
    throw new Error(`cwd is not a directory: ${resolved}`);
  }
  return resolved;
}

function parseJsonSafe(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function runPaperBugAudit({ cwd, claimReportPath, includeAllRuns = false, strict = false, skipCommandChecks = true }) {
  const scriptPath = path.join(cwd, 'scripts', 'validate-bug-claims.js');
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`paper audit script not found: ${scriptPath}`);
  }

  const args = [scriptPath, '--json'];
  if (strict) args.push('--strict');
  if (includeAllRuns) args.push('--include-all-runs');
  if (skipCommandChecks) args.push('--skip-command-checks');
  if (claimReportPath) args.push('--claim-report', claimReportPath);

  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });

  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  const parsed = parseJsonSafe(stdout.trim());

  return {
    exitCode: result.status,
    stdout,
    stderr,
    parsed,
  };
}

function summarizeAudit(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return {
      summary: { pass: 0, warn: 0, fail: 0 },
      failedChecks: [],
      warnedChecks: [],
    };
  }
  const checks = Array.isArray(parsed.checks) ? parsed.checks : [];
  const failedChecks = checks.filter((check) => check.status === 'fail').map((check) => check.id);
  const warnedChecks = checks.filter((check) => check.status === 'warn').map((check) => check.id);
  return {
    summary: parsed.summary || { pass: 0, warn: 0, fail: 0 },
    failedChecks,
    warnedChecks,
  };
}

// ============================================================================
// Codex Session Endpoints
// ============================================================================

/**
 * Start a Codex process session.
 * POST /api/eval/codex/sessions
 *
 * Body: {
 *   args?: string[],
 *   cwd?: string,
 *   env?: Record<string,string>,
 *   noColor?: boolean
 * }
 */
router.post('/codex/sessions', (req, res) => {
  try {
    const session = codexSessionService.createCodexSession({
      args: req.body?.args,
      cwd: req.body?.cwd,
      env: req.body?.env,
      noColor: Boolean(req.body?.noColor),
    });
    res.status(201).json({ success: true, session });
  } catch (error) {
    console.error('[EvalRoutes] Create codex session error:', error);
    res.status(400).json({ error: 'Failed to create codex session', message: error.message });
  }
});

/**
 * List Codex sessions.
 * GET /api/eval/codex/sessions
 */
router.get('/codex/sessions', (req, res) => {
  try {
    const sessions = codexSessionService.listCodexSessions();
    res.json({ success: true, sessions });
  } catch (error) {
    console.error('[EvalRoutes] List codex sessions error:', error);
    res.status(500).json({ error: 'Failed to list codex sessions', message: error.message });
  }
});

/**
 * Get session metadata.
 * GET /api/eval/codex/sessions/:id
 */
router.get('/codex/sessions/:id', (req, res) => {
  try {
    const session = codexSessionService.getCodexSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Codex session not found' });
    }
    res.json({ success: true, session });
  } catch (error) {
    console.error('[EvalRoutes] Get codex session error:', error);
    res.status(500).json({ error: 'Failed to get codex session', message: error.message });
  }
});

/**
 * Poll output events from a Codex session.
 * GET /api/eval/codex/sessions/:id/poll?cursor=<n>
 */
router.get('/codex/sessions/:id/poll', (req, res) => {
  try {
    const cursor = Number.parseInt(String(req.query.cursor ?? '-1'), 10);
    const polled = codexSessionService.pollCodexSession(req.params.id, Number.isNaN(cursor) ? -1 : cursor);
    if (!polled) {
      return res.status(404).json({ error: 'Codex session not found' });
    }
    res.json({ success: true, ...polled });
  } catch (error) {
    console.error('[EvalRoutes] Poll codex session error:', error);
    res.status(500).json({ error: 'Failed to poll codex session', message: error.message });
  }
});

/**
 * Send input to a Codex session.
 * POST /api/eval/codex/sessions/:id/input
 *
 * Body: { input: string, appendNewline?: boolean }
 */
router.post('/codex/sessions/:id/input', (req, res) => {
  try {
    const input = req.body?.input;
    const appendNewline = req.body?.appendNewline !== false;
    const result = codexSessionService.writeCodexSessionInput(req.params.id, input, appendNewline);
    res.json({ success: true, result });
  } catch (error) {
    const status = /not found/i.test(error.message) ? 404 : 400;
    console.error('[EvalRoutes] Write codex input error:', error);
    res.status(status).json({ error: 'Failed to write codex input', message: error.message });
  }
});

/**
 * Terminate a Codex session.
 * DELETE /api/eval/codex/sessions/:id
 */
router.delete('/codex/sessions/:id', (req, res) => {
  try {
    const terminated = codexSessionService.terminateCodexSession(req.params.id);
    if (!terminated) {
      return res.status(404).json({ error: 'Codex session not found' });
    }
    res.json({ success: true, session: terminated });
  } catch (error) {
    console.error('[EvalRoutes] Terminate codex session error:', error);
    res.status(500).json({ error: 'Failed to terminate codex session', message: error.message });
  }
});

/**
 * Run paper bug audit and start a seeded Codex session for interactive follow-up.
 * POST /api/eval/codex/paper-bug-audit-session
 *
 * Body: {
 *   cwd?: string,
 *   claimReportPath?: string,       // default: notes/paper-claim-audit.json
 *   auditJsonPath?: string,         // default: notes/paper-bug-audit.latest.json
 *   includeAllRuns?: boolean,
 *   strict?: boolean,
 *   skipCommandChecks?: boolean,    // default: true
 *   codexArgs?: string[],           // default: ["--full-auto"]
 *   seedPrompt?: string,            // custom initial prompt for codex
 *   seedDelayMs?: number            // default: 3500
 * }
 */
router.post('/codex/paper-bug-audit-session', (req, res) => {
  try {
    const cwd = resolveApiCwd(req.body?.cwd);
    const claimReportPathRel = req.body?.claimReportPath || path.join('notes', 'paper-claim-audit.json');
    const auditJsonPathRel = req.body?.auditJsonPath || path.join('notes', 'paper-bug-audit.latest.json');
    const claimReportPath = path.isAbsolute(claimReportPathRel)
      ? claimReportPathRel
      : path.join(cwd, claimReportPathRel);
    const auditJsonPath = path.isAbsolute(auditJsonPathRel) ? auditJsonPathRel : path.join(cwd, auditJsonPathRel);

    const auditRun = runPaperBugAudit({
      cwd,
      claimReportPath: claimReportPathRel,
      includeAllRuns: Boolean(req.body?.includeAllRuns),
      strict: Boolean(req.body?.strict),
      skipCommandChecks: req.body?.skipCommandChecks !== false,
    });

    // Persist latest raw JSON so Codex can inspect full details in-context.
    if (auditRun.parsed) {
      fs.mkdirSync(path.dirname(auditJsonPath), { recursive: true });
      fs.writeFileSync(auditJsonPath, JSON.stringify(auditRun.parsed, null, 2), 'utf8');
    }

    const codexArgs =
      Array.isArray(req.body?.codexArgs) && req.body.codexArgs.length > 0 ? req.body.codexArgs : ['--full-auto'];
    const session = codexSessionService.createCodexSession({
      cwd,
      args: codexArgs,
    });

    const auditSummary = summarizeAudit(auditRun.parsed);
    const seedPrompt =
      req.body?.seedPrompt ||
      [
        'Analyze the latest paper bug audit and help me plan fixes.',
        `Audit JSON: ${path.relative(cwd, auditJsonPath)}`,
        `Claim report JSON: ${path.relative(cwd, claimReportPath)}`,
        `Audit exit code: ${auditRun.exitCode}`,
        `Summary: pass=${auditSummary.summary.pass || 0}, warn=${auditSummary.summary.warn || 0}, fail=${auditSummary.summary.fail || 0}`,
        `Failed checks: ${auditSummary.failedChecks.join(', ') || '(none)'}`,
        `Warn checks: ${auditSummary.warnedChecks.join(', ') || '(none)'}`,
        'Tasks:',
        '1) Summarize failures by severity and likely root cause.',
        '2) Propose an ordered fix plan with concrete commands/files.',
        '3) Identify which fixes would most change paper conclusions.',
        'Then wait for my follow-up questions.',
      ].join('\n');

    const seedDelayMs = Number.isFinite(req.body?.seedDelayMs) ? Number(req.body.seedDelayMs) : 3500;
    setTimeout(
      () => {
        try {
          codexSessionService.writeCodexSessionInput(session.id, seedPrompt, true);
        } catch (error) {
          console.error('[EvalRoutes] Seed codex prompt error:', error.message);
        }
      },
      Math.max(500, seedDelayMs),
    );

    res.status(201).json({
      success: true,
      session,
      audit: {
        exitCode: auditRun.exitCode,
        summary: auditSummary.summary,
        failedChecks: auditSummary.failedChecks,
        warnedChecks: auditSummary.warnedChecks,
        auditJsonPath: path.relative(cwd, auditJsonPath),
        claimReportPath: path.relative(cwd, claimReportPath),
      },
      seeded: true,
      seedDelayMs: Math.max(500, seedDelayMs),
    });
  } catch (error) {
    console.error('[EvalRoutes] paper-bug-audit-session error:', error);
    res.status(400).json({ error: 'Failed to create paper bug audit codex session', message: error.message });
  }
});

// ============================================================================
// Configuration Endpoints
// ============================================================================

registerEvalConfigurationReadRoutes(router, {
  evalConfigLoader,
  learnerConfigLoader,
  getTutorConfigLoader: () => tutorConfigLoader,
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
router.post(
  '/quick',
  createExactEvaluationAdmissionMiddleware({
    endpoint: '/api/eval/quick',
    buildInput: (req) => {
      const body = requireObjectBody(req);
      return {
        profiles: [body.profile ?? 'budget'],
        scenarios: [body.scenario ?? 'new_user_first_visit'],
        runsPerConfig: 1,
        skipRubric: body.skipRubric ?? false,
        dryRun: body.dryRun ?? false,
        confirmTestCount: body.confirmTestCount,
        allowOversizedPlan: body.allowOversizedPlan,
      };
    },
  }),
  async (req, res) => {
    try {
      const admission = req.evaluationAdmission;
      const { judgeOverride = null, provider, model, egoModel, superegoStrategy, hyperparameters } = req.body || {};
      const profile = admission.profiles[0];
      const scenario = admission.scenarios[0];
      const skipRubric = admission.skipRubric;
      const dryRun = admission.dryRun;

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
      const run = evaluationStoreFor(req).createRun({
        description: scenarioName,
        totalScenarios: 1,
        totalConfigurations: 1,
        metadata: {
          runType: 'quick',
          profiles: [profile],
          scenarios: [scenario],
          scenarioNames: [scenarioName],
          judgeOverride: judgeOverride || undefined,
          dryRun,
          admissionPlan: admission.admissionPlan,
          ...(provider && { provider }),
          ...(model && { model }),
          ...(egoModel && { egoModel }),
          ...(superegoStrategy && { superegoStrategy }),
        },
      });

      req.reserveEvaluationTest(`${profile}:${scenario}`);
      const result = await evaluationRunnerFor(req).quickTest(config, {
        scenarioId: scenario,
        skipRubricEval: skipRubric,
        dryRun,
        verbose: false,
        judgeOverride,
        superegoStrategy,
      });

      // Store result to history
      evaluationStoreFor(req).storeResult(run.id, result);

      // Mark run as completed
      evaluationStoreFor(req).updateRun(run.id, {
        status: 'completed',
        totalTests: 1,
        completedAt: new Date().toISOString(),
      });

      res.json({
        success: true,
        runId: run.id,
        admissionPlan: admission.admissionPlan,
        result: {
          runId: run.id,
          scenarioId: result.scenarioId,
          scenarioName: result.scenarioName,
          profile: result.profileName,
          provider: result.provider,
          model: result.model,
          passed: result.success,
          tutorFirstTurnScore: result.tutorFirstTurnScore,
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
          scenarioContext: scenarioDetails
            ? {
                description: scenarioDetails.description,
                expectedBehavior: scenarioDetails.expected_behavior,
                learnerContext: scenarioDetails.learner_context,
              }
            : null,
        },
      });
    } catch (error) {
      console.error('[EvalRoutes] Quick test error:', error);
      res.status(500).json({ error: 'Failed to run quick test', details: error.message });
    }
  },
);

/**
 * Run a quick test with SSE streaming for real-time logs
 * GET /api/eval/stream/quick
 * Query params: profile, scenario, skipRubric
 */
router.get(
  '/stream/quick',
  createExactEvaluationAdmissionMiddleware({
    endpoint: '/api/eval/stream/quick',
    buildInput: (req) => ({
      profiles: [req.query.profile ?? 'budget'],
      scenarios: [req.query.scenario ?? 'new_user_first_visit'],
      runsPerConfig: 1,
      skipRubric: httpBoolean(req.query.skipRubric, false),
      dryRun: httpBoolean(req.query.dryRun, false),
      confirmTestCount: httpPositiveInteger(req.query.confirmTestCount),
      allowOversizedPlan: httpBoolean(req.query.allowOversizedPlan, false),
    }),
  }),
  async (req, res) => {
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
      const admission = req.evaluationAdmission;
      const profile = admission.profiles[0];
      const scenario = admission.scenarios[0];
      const skipRubric = admission.skipRubric;
      const dryRun = admission.dryRun;
      const outputSize = req.query.outputSize || 'normal'; // compact, normal, expanded

      // Get scenario name for description
      const scenarioDetails = evalConfigLoader.getScenario(scenario);
      const scenarioName = scenarioDetails?.name || scenario;

      // Create a run to persist result to history (status: 'running')
      const run = evaluationStoreFor(req).createRun({
        description: scenarioName,
        totalScenarios: 1,
        totalConfigurations: 1,
        metadata: {
          runType: 'quick',
          profiles: [profile],
          scenarios: [scenario],
          scenarioNames: [scenarioName],
          admissionPlan: admission.admissionPlan,
        },
      });

      sendEvent('start', {
        profile,
        scenario,
        skipRubric,
        outputSize,
        runId: run.id,
        admissionPlan: admission.admissionPlan,
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

      req.reserveEvaluationTest(`${profile}:${scenario}`);
      const result = await evaluationRunnerFor(req).quickTest(config, {
        scenarioId: scenario,
        skipRubricEval: skipRubric,
        outputSize, // compact, normal, expanded - affects response length
        dryRun,
        verbose: true,
        onLog, // Pass log callback
      });

      // Store result to history
      evaluationStoreFor(req).storeResult(run.id, result);

      // Mark run as completed
      evaluationStoreFor(req).updateRun(run.id, {
        status: 'completed',
        totalTests: 1,
        completedAt: new Date().toISOString(),
      });

      sendEvent('log', {
        message: `Test completed: score=${result.tutorFirstTurnScore?.toFixed(1) || 'N/A'}`,
        level: 'success',
      });
      sendEvent('log', { message: `Saved to history: ${run.id}`, level: 'info' });

      sendEvent('result', {
        runId: run.id,
        scenarioId: result.scenarioId,
        scenarioName: result.scenarioName,
        profile: result.profileName,
        provider: result.provider,
        model: result.model,
        passed: result.success,
        tutorFirstTurnScore: result.tutorFirstTurnScore,
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
        scenarioContext: scenarioDetails
          ? {
              description: scenarioDetails.description,
              expectedBehavior: scenarioDetails.expected_behavior,
              learnerContext: scenarioDetails.learner_context,
            }
          : null,
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
  },
);

// ============================================================================
// Full Evaluation Endpoints
// ============================================================================

function effectiveEvaluationProfileRegistry() {
  const names = new Set();
  for (const profile of tutorConfigLoader.listProfiles()) {
    if (profile?.name) names.add(profile.name);
  }
  // Eval-only cells are intentionally absent from tutor-core's public profile
  // registry, but are valid runEvaluation configurations.
  for (const profile of evalConfigLoader.listTutorProfiles()) {
    if (profile?.name) names.add(profile.name);
  }
  return [...names];
}

function effectiveEvaluationScenarioRegistry() {
  return evalConfigLoader.listScenarios().map((scenario) => scenario.id);
}

function sendEvaluationAdmissionError(res, error, logPrefix) {
  if (error instanceof EvaluationAdmissionError) {
    return res.status(error.status).json({
      error: error.message,
      code: error.code,
      ...(error.details === undefined ? {} : { details: error.details }),
    });
  }
  console.error(logPrefix, error);
  return res.status(500).json({ error: 'Failed to run evaluation', details: error.message });
}

export function createMeteredEvaluationHandlers({
  runner = null,
  profileRegistry = effectiveEvaluationProfileRegistry,
  scenarioRegistry = effectiveEvaluationScenarioRegistry,
  maxPlannedTests = () => resolveEvalApiMaxPlannedTests(),
  privilegedOverride = (req) => hasEvalApiPrivilegedOverride(req),
} = {}) {
  const runnerFor = (req) => runner || evaluationRunnerFor(req);
  const admit = (req, endpoint, minProfiles, defaults = {}) => {
    const rawBody = req.body;
    const body =
      rawBody === undefined
        ? { ...defaults }
        : rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)
          ? { ...defaults, ...rawBody }
          : rawBody;
    return admitEvaluationRequest(body, {
      profileRegistry: typeof profileRegistry === 'function' ? profileRegistry() : profileRegistry,
      scenarioRegistry: typeof scenarioRegistry === 'function' ? scenarioRegistry() : scenarioRegistry,
      minProfiles,
      maxPlannedTests: typeof maxPlannedTests === 'function' ? maxPlannedTests() : maxPlannedTests,
      privilegedOverride: typeof privilegedOverride === 'function' ? privilegedOverride(req) : privilegedOverride,
      endpoint,
    });
  };

  return {
    run: async (req, res) => {
      try {
        const admission = admit(req, '/api/eval/run', 1, {
          profiles: ['budget'],
          scenarios: 'all',
          runsPerConfig: 1,
          skipRubric: false,
          dryRun: false,
        });
        const configurations = admission.profiles.map((profileName) => ({ profileName, label: profileName }));
        const result = await runnerFor(req).runEvaluation({
          scenarios: admission.scenarios,
          configurations,
          runsPerConfig: admission.runsPerConfig,
          skipRubricEval: admission.skipRubric,
          dryRun: admission.dryRun,
          description: req.body?.description,
          admissionPlan: admission.admissionPlan,
          verbose: false,
        });

        return res.json({
          success: true,
          runId: result.runId,
          totalTests: result.totalTests,
          plannedTestCount: admission.plannedTestCount,
          admissionPlan: admission.admissionPlan,
          successfulTests: result.successfulTests,
          stats: result.stats,
          scenarioStats: result.scenarioStats,
        });
      } catch (error) {
        return sendEvaluationAdmissionError(res, error, '[EvalRoutes] Run evaluation error:');
      }
    },

    compare: async (req, res) => {
      try {
        const admission = admit(req, '/api/eval/compare', 2, {
          scenarios: 'all',
          runsPerConfig: 1,
          dryRun: false,
        });
        const configurations = admission.profiles.map((profileName) => ({ profileName, label: profileName }));
        const result = await runnerFor(req).compareConfigurations(configurations, {
          scenarios: admission.scenarios,
          runsPerConfig: admission.runsPerConfig,
          dryRun: admission.dryRun,
          skipRubricEval: admission.skipRubric,
          admissionPlan: admission.admissionPlan,
          verbose: false,
        });

        return res.json({
          success: true,
          runId: result.runId,
          plannedTestCount: admission.plannedTestCount,
          admissionPlan: admission.admissionPlan,
          rankings: result.rankings,
          scenarioBreakdown: result.scenarioBreakdown,
        });
      } catch (error) {
        if (!(error instanceof EvaluationAdmissionError)) {
          console.error('[EvalRoutes] Compare error:', error);
          return res.status(500).json({ error: 'Failed to compare configurations', details: error.message });
        }
        return sendEvaluationAdmissionError(res, error, '[EvalRoutes] Compare error:');
      }
    },
  };
}

const meteredEvaluationHandlers = createMeteredEvaluationHandlers();

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
router.post('/run', meteredEvaluationHandlers.run);

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
router.post('/compare', meteredEvaluationHandlers.compare);

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
router.post(
  '/matrix',
  createExactEvaluationAdmissionMiddleware({
    endpoint: '/api/eval/matrix',
    buildInput: (req) => {
      const body = requireObjectBody(req);
      const requested = body.profiles ?? [];
      const profiles =
        Array.isArray(requested) && requested.length === 0
          ? ['budget', 'experimental', 'default', 'fast'].filter((name) =>
              tutorConfigLoader.listProfiles().some((profile) => profile.name === name),
            )
          : requested;
      return {
        profiles,
        scenarios: body.scenarios ?? 'all',
        runsPerConfig: 1,
        skipRubric: body.skipRubric ?? false,
        dryRun: body.dryRun ?? false,
        confirmTestCount: body.confirmTestCount,
        allowOversizedPlan: body.allowOversizedPlan,
      };
    },
  }),
  async (req, res) => {
    try {
      const admission = req.evaluationAdmission;
      const profiles = admission.profiles;
      const skipRubric = admission.skipRubric;
      const dryRun = admission.dryRun;

      // Default profiles if none specified
      const allProfiles = tutorConfigLoader.listProfiles();
      // Validate profiles exist
      const validProfiles = profiles;
      const invalidProfiles = [];

      if (validProfiles.length === 0) {
        return res.status(400).json({
          error: 'No valid profiles specified',
          available: allProfiles.map((p) => p.name),
        });
      }

      // Get scenarios
      const allScenarios = evalConfigLoader.listScenarios();
      const admittedScenarioIds = new Set(admission.scenarios);
      const scenariosToRun = allScenarios.filter((scenario) => admittedScenarioIds.has(scenario.id));

      // Create a run to persist results to history
      const run = evaluationStoreFor(req).createRun({
        description: `${validProfiles.length} profiles × ${scenariosToRun.length} scenarios`,
        totalScenarios: scenariosToRun.length,
        totalConfigurations: validProfiles.length,
        metadata: {
          runType: 'matrix',
          profiles: validProfiles,
          scenarios: scenariosToRun.map((s) => s.id),
          scenarioNames: scenariosToRun.map((s) => s.name),
          skipRubric,
          dryRun,
          admissionPlan: admission.admissionPlan,
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
            req.reserveEvaluationTest(`${profileName}:${scenario.id}`);
            const result = await evaluationRunnerFor(req).quickTest(config, {
              scenarioId: scenario.id,
              verbose: false,
              skipRubricEval: skipRubric,
              dryRun,
              debug: false,
            });

            results[profileName].push(result);
            totalTests++;

            // Save result to database
            evaluationStoreFor(req).storeResult(run.id, {
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
            evaluationStoreFor(req).storeResult(run.id, {
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
      evaluationStoreFor(req).updateRun(run.id, {
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
          dimensionAverages[profile][dim] =
            scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
        }
      }

      // Build rankings
      const rankings = validProfiles
        .map((profile) => {
          const profileResults = results[profile] || [];
          const successCount = profileResults.filter((r) => r.success !== false).length;
          const scores = profileResults.filter((r) => r.tutorFirstTurnScore != null).map((r) => r.tutorFirstTurnScore);
          const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
          const latencies = profileResults.filter((r) => r.latencyMs != null).map((r) => r.latencyMs);
          const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null;

          return {
            profile,
            tests: profileResults.length,
            successes: successCount,
            avgScore,
            avgLatency,
          };
        })
        .sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0));

      res.json({
        success: true,
        runId: run.id, // Include run ID so frontend can navigate to history
        admissionPlan: admission.admissionPlan,
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
  },
);

/**
 * Run matrix comparison with SSE streaming for real-time logs
 * GET /api/eval/stream/matrix
 * Query params: profiles, scenarios, skipRubric
 */
router.get(
  '/stream/matrix',
  createExactEvaluationAdmissionMiddleware({
    endpoint: '/api/eval/stream/matrix',
    buildInput: (req) => {
      const requested = httpIdList(req.query.profiles, []);
      const profiles =
        Array.isArray(requested) && requested.length === 0
          ? ['budget', 'experimental', 'default', 'fast'].filter((name) =>
              tutorConfigLoader.listProfiles().some((profile) => profile.name === name),
            )
          : requested;
      return {
        profiles,
        scenarios: httpIdList(req.query.scenarios, 'all'),
        runsPerConfig: 1,
        skipRubric: httpBoolean(req.query.skipRubric, false),
        dryRun: httpBoolean(req.query.dryRun, false),
        confirmTestCount: httpPositiveInteger(req.query.confirmTestCount),
        allowOversizedPlan: httpBoolean(req.query.allowOversizedPlan, false),
      };
    },
  }),
  async (req, res) => {
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
      const admission = req.evaluationAdmission;
      const profiles = admission.profiles;
      const skipRubric = admission.skipRubric;
      const dryRun = admission.dryRun;
      const outputSize = req.query.outputSize || 'normal';

      // Get all available profiles
      // Validate profiles
      const validProfiles = profiles;
      if (validProfiles.length === 0) {
        sendEvent('error', { error: 'No valid profiles specified' });
        return res.end();
      }

      // Get scenarios
      const allScenarios = evalConfigLoader.listScenarios();
      const admittedScenarioIds = new Set(admission.scenarios);
      const scenariosToRun = allScenarios.filter((scenario) => admittedScenarioIds.has(scenario.id));

      const totalTests = validProfiles.length * scenariosToRun.length;

      sendEvent('start', {
        profiles: validProfiles,
        scenarioCount: scenariosToRun.length,
        totalTests,
        skipRubric,
        outputSize,
        admissionPlan: admission.admissionPlan,
        timestamp: new Date().toISOString(),
      });

      sendEvent('log', {
        message: `Starting matrix: ${validProfiles.length} profiles × ${scenariosToRun.length} scenarios = ${totalTests} tests`,
        level: 'info',
      });
      sendEvent('log', { message: `Output size: ${outputSize}`, level: 'info' });

      // Create a run to persist results
      const run = evaluationStoreFor(req).createRun({
        description: `${validProfiles.length} profiles × ${scenariosToRun.length} scenarios`,
        totalScenarios: scenariosToRun.length,
        totalConfigurations: validProfiles.length,
        metadata: {
          runType: 'matrix',
          profiles: validProfiles,
          scenarios: scenariosToRun.map((s) => s.id),
          scenarioNames: scenariosToRun.map((s) => s.name),
          skipRubric,
          dryRun,
          admissionPlan: admission.admissionPlan,
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

            req.reserveEvaluationTest(`${profileName}:${scenario.id}`);
            const result = await evaluationRunnerFor(req).quickTest(config, {
              scenarioId: scenario.id,
              verbose: false,
              skipRubricEval: skipRubric,
              dryRun,
              outputSize,
              onLog,
            });

            results[profileName].push(result);

            // Save result to database
            evaluationStoreFor(req).storeResult(run.id, {
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

            const scoreStr = result.tutorFirstTurnScore != null ? result.tutorFirstTurnScore.toFixed(1) : 'N/A';
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
              score: result.tutorFirstTurnScore,
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

            evaluationStoreFor(req).storeResult(run.id, {
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
      evaluationStoreFor(req).updateRun(run.id, {
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
          dimensionAverages[profile][dim] =
            scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
        }
      }

      // Build rankings
      const rankings = validProfiles
        .map((profile) => {
          const profileResults = results[profile] || [];
          const successCount = profileResults.filter((r) => r.success !== false).length;
          const scores = profileResults.filter((r) => r.tutorFirstTurnScore != null).map((r) => r.tutorFirstTurnScore);
          const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
          const latencies = profileResults.filter((r) => r.latencyMs != null).map((r) => r.latencyMs);
          const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null;

          return {
            profile,
            tests: profileResults.length,
            successes: successCount,
            avgScore,
            avgLatency,
          };
        })
        .sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0));

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
  },
);

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
router.get(
  '/stream/interact',
  createFixedModelCallAdmissionMiddleware({
    endpoint: '/api/eval/stream/interact',
    buildInput: (req) => ({
      dryRun: httpBoolean(req.query.dryRun, false),
      confirmModelCallLimit: httpPositiveInteger(req.query.confirmModelCallLimit),
      allowOversizedPlan: httpBoolean(req.query.allowOversizedPlan, false),
      turns: httpPositiveInteger(req.query.turns, 5),
      profile: req.query.profile || 'budget',
      persona: req.query.persona || 'confused_novice',
      dialogueEnabled: httpBoolean(req.query.dialogueEnabled, true),
    }),
    plannedModelCallLimit: (_req, input) => {
      if (!Number.isSafeInteger(input.turns) || input.turns <= 0) {
        throw new EvaluationAdmissionError(422, 'invalid_request_value', 'turns must be a positive safe integer');
      }
      if (typeof input.dialogueEnabled !== 'boolean') {
        throw new EvaluationAdmissionError(400, 'invalid_request_schema', 'dialogueEnabled must be a boolean');
      }
      if (!effectiveEvaluationProfileRegistry().includes(input.profile)) {
        throw new EvaluationAdmissionError(422, 'unknown_registry_value', 'profile contains an unknown entry', {
          field: 'profile',
          unknown: [input.profile],
        });
      }
      const personaIds = learnerConfigLoader.listPersonas().map((persona) => persona.id || persona.name);
      if (!personaIds.includes(input.persona)) {
        throw new EvaluationAdmissionError(422, 'unknown_registry_value', 'persona contains an unknown entry', {
          field: 'persona',
          unknown: [input.persona],
        });
      }
      // Maximum bilateral path: three calls for the opening learner, then
      // tutor ego/superego/adjudication + learner ego/superego/adjudication.
      return 3 + input.turns * 6;
    },
    shortCircuitDryRun: true,
  }),
  async (req, res) => {
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
    const streamId = registerStream(res, keepAlive, { maxDuration: INTERACTION_STREAM_MAX_DURATION_MS });

    // Clean up on close
    req.on('close', () => {
      clearInterval(keepAlive);
      unregisterStream(streamId);
    });

    try {
      const persona = req.modelWorkInput.persona;
      const tutorProfile = req.modelWorkInput.profile;
      const maxTurns = req.modelWorkInput.turns;
      const dialogueEnabled = req.modelWorkInput.dialogueEnabled;
      const topic = req.query.topic || "Hegel's concept of recognition";
      const runJudge = req.query.runJudge !== 'false';

      sendEvent('start', {
        persona,
        tutorProfile,
        maxTurns,
        dialogueEnabled,
        topic,
        runJudge,
        admissionPlan: req.modelWorkAdmission,
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
        throw new Error(
          'No LLM API key configured. Set OPENROUTER_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY.',
        );
      }

      // Create the llmCall function matching the expected signature
      const llmCall = async (requestedModel, systemPrompt, messages, options = {}) => {
        if (req.aborted) {
          throw new EvaluationAdmissionError(499, 'client_closed_request', 'Client closed before model work');
        }
        req.modelCallBudget.reserve(options.agentRole || 'interaction_model_call');
        const { temperature = 0.7, maxTokens = 1000 } = options;
        // Last-resort model per provider. The Anthropic entry must be a live id:
        // the old `claude-3-5-haiku-20241022` fallback was retired on 2026-02-19
        // and was unreachable here in any case (`model` is never falsy).
        const lastResortModel = llmProvider === 'anthropic' ? 'claude-sonnet-5' : 'deepseek/deepseek-chat';
        const model =
          requestedModel || getDefaultModel(llmProvider === 'anthropic' ? 'claude' : llmProvider) || lastResortModel;

        try {
          if (llmProvider === 'openrouter') {
            const response = await llmClient.chat.completions.create({
              model,
              temperature,
              max_tokens: maxTokens,
              messages: [
                { role: 'system', content: systemPrompt },
                ...messages.map((m) => ({
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
            const userMessages = messages.map((m) => m.content).join('\n\n');
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
              model,
              max_tokens: maxTokens,
              system: systemPrompt,
              messages: messages.map((m) => ({
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
                ...messages.map((m) => ({
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
          learnerProfile: dialogueEnabled ? 'ego_superego' : 'unified',
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
        },
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
        learnerArchitecture: dialogueEnabled ? 'ego_superego' : 'unified',
        learnerProfile: dialogueEnabled ? 'ego_superego' : 'unified',
        topic,
        interaction: interactionTrace,
        turnCount: interactionTrace.turns.length,
        turns: interactionTrace.turns,
        sequenceDiagram: generateSequenceDiagram(interactionTrace),
        formattedTranscript: generateTranscript(interactionTrace),
        skipJudge: !runJudge,
        metrics: {
          turnCount: interactionTrace.turns.length,
          totalTokens:
            (interactionTrace.metrics?.learnerInputTokens || 0) +
            (interactionTrace.metrics?.learnerOutputTokens || 0) +
            (interactionTrace.metrics?.tutorInputTokens || 0) +
            (interactionTrace.metrics?.tutorOutputTokens || 0),
          learnerTokens:
            (interactionTrace.metrics?.learnerInputTokens || 0) + (interactionTrace.metrics?.learnerOutputTokens || 0),
          tutorTokens:
            (interactionTrace.metrics?.tutorInputTokens || 0) + (interactionTrace.metrics?.tutorOutputTokens || 0),
          totalLatencyMs: interactionTrace.metrics?.totalLatencyMs || 0,
        },
        timestamp: new Date().toISOString(),
      };

      // Store in database
      sendEvent('progress', { stage: 'storing', message: 'Saving results' });

      // First create a run entry so it appears in History with "Interact" filter
      let runId = null;
      try {
        const runData = evaluationStoreFor(req).createRun({
          description: `Interact: ${persona} → ${tutorProfile}`,
          totalScenarios: 1,
          metadata: {
            runType: 'interaction',
            profiles: [tutorProfile],
            personaId: persona,
            learnerArchitecture: dialogueEnabled ? 'ego_superego' : 'unified',
            topic,
            fastMode: !runJudge,
            admissionPlan: req.modelWorkAdmission,
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
        evaluationStoreFor(req).storeInteractionEval(result);
        sendEvent('log', { message: `Stored in database: ${evalId}`, level: 'success' });

        // Mark the run as completed (don't use completeRun which checks evaluation_results table)
        if (runId) {
          evaluationStoreFor(req).updateRun(runId, {
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
        tutorFirstTurnScore: null,
        modelCallBudget: req.modelCallBudget.snapshot(),
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
  },
);

// ============================================================================
// Results Endpoints
// ============================================================================

registerEvalRunListReadRoutes(router, { storeFor: evaluationStoreFor });

/**
 * Auto-complete all stale runs
 * POST /api/eval/runs-auto-complete
 * Body: { olderThanMinutes: 30, dryRun: false }
 */
router.post('/runs-auto-complete', (req, res) => {
  try {
    const { olderThanMinutes = 30, dryRun = false } = req.body;
    const result = evaluationStoreFor(req).autoCompleteStaleRuns({ olderThanMinutes, dryRun });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[EvalRoutes] Auto-complete runs error:', error);
    res.status(500).json({ error: 'Failed to auto-complete runs', details: error.message });
  }
});

registerEvalRunDetailReadRoutes(router, {
  storeFor: evaluationStoreFor,
  runnerFor: evaluationRunnerFor,
});

// ============================================================================
// Dialogue Log Endpoints
// ============================================================================

registerEvalLogReadRoutes(router, {
  storeFor: evaluationStoreFor,
  getDialogueLogService: () => dialogueLogService,
});

// ============================================================================
// Prompt Endpoints (Read-Only)
// ============================================================================

registerEvalPromptReadRoutes(router);

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
router.post('/prompts/recommend', createPromptRecommendationAdmissionMiddleware(), async (req, res) => {
  try {
    const { runId, profile, dryRun = false } = req.body;

    let results = [];
    let profileName = profile || 'unknown';

    if (runId) {
      // Get results from existing run
      const runResults = evaluationStoreFor(req).getResults(runId);
      if (!runResults || runResults.length === 0) {
        return res.status(404).json({ error: 'Run not found or has no results' });
      }
      results = runResults;
      profileName = runResults[0]?.profileName || profileName;
    } else if (profile) {
      // Run fresh evaluations
      const allScenarios = evalConfigLoader.listScenarios();
      const admittedScenarioIds = new Set(req.evaluationAdmission.scenarios);
      const scenariosToRun = allScenarios.filter((scenario) => admittedScenarioIds.has(scenario.id));

      for (const scenario of scenariosToRun) {
        try {
          const config = { profileName: profile, label: profile };
          req.reserveEvaluationTest(`${profile}:${scenario.id}`);
          const result = await evaluationRunnerFor(req).quickTest(config, {
            scenarioId: scenario.id,
            verbose: false,
            skipRubricEval: false, // Need rubric for recommendations
            dryRun,
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
    if (!dryRun) {
      if (req.aborted) {
        throw new EvaluationAdmissionError(499, 'client_closed_request', 'Client closed before model work');
      }
      req.modelCallBudget.reserve('prompt_recommendation');
    }
    const recommendations = await promptRecommendationService.generateRecommendations({
      results,
      profileName,
      dryRun,
    });

    res.json({
      success: true,
      ...recommendations,
      // Explicitly note this is read-only
      readOnly: true,
      dryRun,
      evaluationAdmissionPlan: req.evaluationAdmission?.admissionPlan || null,
      modelWorkAdmissionPlan: req.modelWorkAdmission,
      modelCallBudget: req.modelCallBudget.snapshot(),
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
router.get(
  '/stream/run',
  createExactEvaluationAdmissionMiddleware({
    endpoint: '/api/eval/stream/run',
    buildInput: (req) => ({
      profiles: httpIdList(req.query.profiles, ['budget']),
      scenarios: httpIdList(req.query.scenarios, 'all'),
      runsPerConfig: 1,
      skipRubric: httpBoolean(req.query.skipRubric, false),
      dryRun: httpBoolean(req.query.dryRun, false),
      confirmTestCount: httpPositiveInteger(req.query.confirmTestCount),
      allowOversizedPlan: httpBoolean(req.query.allowOversizedPlan, false),
    }),
  }),
  async (req, res) => {
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
      const admission = req.evaluationAdmission;
      const profiles = admission.profiles;
      const skipRubric = admission.skipRubric;
      const dryRun = admission.dryRun;
      const outputSize = req.query.outputSize || 'normal';

      // Get all scenarios to run
      const allScenarios = evalConfigLoader.listScenarios();
      const admittedScenarioIds = new Set(admission.scenarios);
      const scenariosToRun = allScenarios.filter((scenario) => admittedScenarioIds.has(scenario.id));

      const totalTests = profiles.length * scenariosToRun.length;
      let completedTests = 0;

      sendEvent('start', {
        profiles,
        scenarioCount: scenariosToRun.length,
        totalTests,
        skipRubric,
        outputSize,
        admissionPlan: admission.admissionPlan,
        timestamp: new Date().toISOString(),
      });

      sendEvent('log', {
        message: `Starting batch run: ${profiles.length} profiles × ${scenariosToRun.length} scenarios = ${totalTests} tests`,
        level: 'info',
      });
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

            req.reserveEvaluationTest(`${profileName}:${scenario.id}`);
            const result = await evaluationRunnerFor(req).quickTest(config, {
              scenarioId: scenario.id,
              skipRubricEval: skipRubric,
              outputSize,
              dryRun,
              verbose: false,
              onLog,
            });

            results.push(result);

            const scoreStr = result.tutorFirstTurnScore != null ? result.tutorFirstTurnScore.toFixed(1) : 'N/A';
            const status = result.success !== false ? '✓' : '✗';
            sendEvent('log', {
              message: `  ${status} Score: ${scoreStr} (${result.latencyMs}ms)`,
              level: result.success !== false ? 'success' : 'warning',
            });

            sendEvent('result', {
              profile: profileName,
              scenarioId: scenario.id,
              scenarioName: scenario.name,
              passed: result.success,
              score: result.tutorFirstTurnScore,
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
      const successCount = results.filter((r) => r.success !== false).length;
      const scores = results.filter((r) => r.tutorFirstTurnScore != null).map((r) => r.tutorFirstTurnScore);
      const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

      sendEvent('log', { message: `\n=== Batch Complete ===`, level: 'success' });
      sendEvent('log', {
        message: `Total: ${totalTests}, Passed: ${successCount}, Avg Score: ${avgScore?.toFixed(1) || 'N/A'}`,
        level: 'info',
      });

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
  },
);

// ============================================================================
// Trajectory and Improvement Cycle Endpoints
// ============================================================================

registerEvalTrajectoryReadRoutes(router);
registerEvalAnalysisReadRoutes(router, { storeFor: evaluationStoreFor });

// ============================================================================
// Documentation Endpoints
// ============================================================================

registerEvalDocumentationReadRoutes(router);

// ============================================================================
// Monitoring Endpoints
// ============================================================================

registerEvalMonitoringReadRoutes(router, { getMonitoringService: () => monitoringService });

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
    const result = evaluationStoreFor(req).completeRun(req.params.runId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[EvalRoutes] Complete run error:', error);
    res.status(500).json({ error: 'Failed to complete run', details: error.message });
  }
});

registerEvalRunResumeStatusReadRoute(router, {
  storeFor: evaluationStoreFor,
  evalConfigLoader,
});

// ============================================================================
// Interaction Evaluation Endpoints (Learner-Tutor Dialogues)
// ============================================================================

registerEvalInteractionReadRoutes(router, { storeFor: evaluationStoreFor });

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
router.get(
  '/stream/recognition-ab',
  createExactEvaluationAdmissionMiddleware({
    endpoint: '/api/eval/stream/recognition-ab',
    buildInput: (req) => ({
      profiles: ['baseline', 'recognition'],
      scenarios: evalConfigLoader
        .listScenarios()
        .filter((scenario) => scenario.recognition_test === true)
        .map((scenario) => scenario.id),
      runsPerConfig: 1,
      skipRubric: httpBoolean(req.query.skipRubric, false),
      dryRun: httpBoolean(req.query.dryRun, false),
      confirmTestCount: httpPositiveInteger(req.query.confirmTestCount),
      allowOversizedPlan: httpBoolean(req.query.allowOversizedPlan, false),
    }),
    minProfiles: 2,
  }),
  async (req, res) => {
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
      const admission = req.evaluationAdmission;
      // Fixed profiles for A/B comparison
      const profiles = admission.profiles;
      const skipRubric = admission.skipRubric;
      const dryRun = admission.dryRun;
      const outputSize = req.query.outputSize || 'normal';

      // Validate profiles exist
      const allProfiles = tutorConfigLoader.listProfiles();
      const validProfiles = profiles.filter((p) => allProfiles.some((ap) => ap.name === p));

      if (validProfiles.length !== 2) {
        sendEvent('error', {
          error: 'Recognition A/B requires both baseline and recognition profiles',
          found: validProfiles,
          available: allProfiles.map((p) => p.name),
        });
        return res.end();
      }

      // Get only recognition_test scenarios
      const allScenarios = evalConfigLoader.listScenarios();
      const recognitionScenarios = allScenarios.filter((s) => s.recognition_test === true);

      if (recognitionScenarios.length === 0) {
        sendEvent('error', { error: 'No recognition_test scenarios found in config' });
        return res.end();
      }

      const totalTests = validProfiles.length * recognitionScenarios.length;
      const testLearnerId = `eval-recognition-ab-${Date.now()}`;

      sendEvent('start', {
        profiles: validProfiles,
        scenarioCount: recognitionScenarios.length,
        scenarioIds: recognitionScenarios.map((s) => s.id),
        totalTests,
        skipRubric,
        outputSize,
        testLearnerId,
        admissionPlan: admission.admissionPlan,
        timestamp: new Date().toISOString(),
      });

      sendEvent('log', {
        message: `Recognition A/B: baseline vs recognition × ${recognitionScenarios.length} scenarios`,
        level: 'info',
      });

      // Create a run to persist results
      const run = evaluationStoreFor(req).createRun({
        description: `Recognition A/B: baseline vs recognition × ${recognitionScenarios.length} scenarios`,
        totalScenarios: recognitionScenarios.length,
        totalConfigurations: 2,
        metadata: {
          runType: 'recognition-ab',
          profiles: validProfiles,
          scenarios: recognitionScenarios.map((s) => s.id),
          scenarioNames: recognitionScenarios.map((s) => s.name),
          skipRubric,
          testLearnerId,
          dryRun,
          admissionPlan: admission.admissionPlan,
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

            req.reserveEvaluationTest(`${profileName}:${scenario.id}`);
            const result = await evaluationRunnerFor(req).quickTest(config, {
              scenarioId: scenario.id,
              verbose: false,
              skipRubricEval: skipRubric,
              outputSize,
              onLog,
              learnerId: testLearnerId,
              dryRun,
            });

            results[profileName].push(result);

            // Save result to database
            evaluationStoreFor(req).storeResult(run.id, {
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
                    recognitionMetrics.synthesisStrategies.ghost_dominates +=
                      stats.synthesisStrategies.ghost_dominates || 0;
                    recognitionMetrics.synthesisStrategies.learner_dominates +=
                      stats.synthesisStrategies.learner_dominates || 0;
                    recognitionMetrics.synthesisStrategies.dialectical_synthesis +=
                      stats.synthesisStrategies.dialectical_synthesis || 0;
                  }
                }
              } catch (e) {
                // Recognition metrics collection failed silently
              }
            }

            const scoreStr = result.tutorFirstTurnScore != null ? result.tutorFirstTurnScore.toFixed(1) : 'N/A';
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
              score: result.tutorFirstTurnScore,
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

            evaluationStoreFor(req).storeResult(run.id, {
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
      evaluationStoreFor(req).updateRun(run.id, {
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
          dimensionAverages[profile][dim] =
            scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
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

      const baselineScores = baselineResults
        .filter((r) => r.tutorFirstTurnScore != null)
        .map((r) => r.tutorFirstTurnScore);
      const recognitionScores = recognitionResults
        .filter((r) => r.tutorFirstTurnScore != null)
        .map((r) => r.tutorFirstTurnScore);

      const baselineAvgScore =
        baselineScores.length > 0 ? baselineScores.reduce((a, b) => a + b, 0) / baselineScores.length : null;
      const recognitionAvgScore =
        recognitionScores.length > 0 ? recognitionScores.reduce((a, b) => a + b, 0) / recognitionScores.length : null;

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
      const avgDialecticalDepth =
        recognitionMetrics.dialecticalDepth.length > 0
          ? recognitionMetrics.dialecticalDepth.reduce((a, b) => a + b, 0) / recognitionMetrics.dialecticalDepth.length
          : 0;

      sendEvent('log', { message: `\n=== Recognition A/B Complete ===`, level: 'success' });
      sendEvent('log', { message: `Total tests: ${completedTests}`, level: 'info' });
      sendEvent('log', {
        message: `Baseline avg: ${baselineAvgScore?.toFixed(1) || 'N/A'} | Recognition avg: ${recognitionAvgScore?.toFixed(1) || 'N/A'}`,
        level: 'info',
      });
      if (overallWinner) {
        sendEvent('log', {
          message: `Winner: ${overallWinner.toUpperCase()} (${overallSignificance})`,
          level: 'success',
        });
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
  },
);

export default router;
