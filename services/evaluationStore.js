/**
 * Evaluation Store Service
 *
 * SQLite-based storage for AI tutor evaluation results.
 * Supports querying, aggregation, comparison, and export.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * COLUMN SEMANTIC MAPPING (multi-turn dialogue scoring)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * For multi-turn dialogue rows, six distinct score types answer different questions:
 *
 *   DB Column                       │ Question
 *   ────────────────────────────────┼───────────────────────────────────
 *   tutor_overall_score             │ Average of per-turn tutor scores
 *   tutor_holistic_overall_score    │ Holistic tutor dialogue trajectory evaluation
 *   learner_overall_score           │ Average of per-turn learner scores
 *   learner_holistic_overall_score  │ Holistic learner dialogue evaluation
 *   dialogue_quality_score          │ Overall pedagogical encounter quality (PUBLIC transcript)
 *   dialogue_quality_internal_score │ Overall pedagogical encounter quality (FULL transcript w/ internal deliberation)
 *
 *   Additional tutor per-turn detail:
 *   tutor_first_turn_score          │ How good is the tutor's cold-start response?
 *   tutor_last_turn_score           │ How good is the tutor after adaptation?
 *   tutor_development_score         │ How much did the tutor improve? (last - first)
 *
 * DEPRECATED columns (kept for backward compatibility):
 *   - overall_score: DEPRECATED alias for tutor_first_turn_score (synced on write)
 *   - holistic_overall_score: DEAD column, no longer read or written (was alias for tutor_last_turn_score)
 *
 * For single-turn rows: tutor_last_turn_score, tutor_development_score,
 *   and dialogue_quality_score are NULL (these metrics are meaningless).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes, createHash } from 'crypto';
import { isPidAlive } from './processUtils.js';
import { getScenario, getTutorProfile, loadRubric, resolveModel } from './evalConfigLoader.js';
import { readProgressLog } from './progressLogger.js';
import {
  loadTutorHolisticRubric,
  loadDialogueRubric,
  loadDeliberationRubric,
  loadTutorCharismaRubric,
} from './rubricEvaluator.js';
import { loadLearnerRubric } from './learnerRubricEvaluator.js';
import { openEvaluationDatabase } from './evaluationStore/connection.js';
import { migrateEvaluationDatabase } from './evaluationStore/migrations.js';
import { createResultRepository } from './evaluationStore/resultRepository.js';
import { createRunRepository } from './evaluationStore/runRepository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
// Data home: the canonical archive holding the DB and the dialogue logs, co-located
// (workplan item: consolidate-logs-db-private-archive). Override with MS_DATA_HOME.
const DATA_HOME = process.env.MS_DATA_HOME || path.join(os.homedir(), '.machinespirits-data');
// Logs root, in precedence order:
//   1. EVAL_LOGS_DIR — explicit override (sandboxed/CI tmp; the packaged desktop).
//   2. <DATA_HOME>/logs — co-located beside the DB, so ANY worktree finds the
//      canonical logs without a per-worktree `logs/` symlink (the recurrence the
//      symlink approach kept hitting; this is what fixes the provenance
//      `log_file_missing` from fresh checkouts).
//   3. <repo>/logs — fallback for hosts without the archive (e.g. the website
//      shallow clone that mounts /poetics from the DB and never reads logs).
const LOGS_ROOT =
  process.env.EVAL_LOGS_DIR || (fs.existsSync(DATA_HOME) ? path.join(DATA_HOME, 'logs') : path.join(ROOT_DIR, 'logs'));

// Preserve the historical facade contract: importing evaluationStore opens the
// configured database and runs every idempotent migration immediately.
const db = openEvaluationDatabase({ rootDir: ROOT_DIR });
migrateEvaluationDatabase(db);

/**
 * Generate a unique run ID
 */
function generateRunId() {
  const timestamp = new Date().toISOString().slice(0, 10);
  const suffix = randomBytes(4).toString('hex');
  return `eval-${timestamp}-${suffix}`;
}

// ── Rubric version resolvers ──────────────────────────────────────────
// Auto-resolve rubric versions from YAML at write time.
// Tutor per-turn and holistic rubrics are versioned together (use per-turn as primary).
function getTutorRubricVersion() {
  return loadRubric()?.version || loadTutorHolisticRubric()?.version || null;
}
function getLearnerRubricVersion() {
  return loadLearnerRubric()?.version || null;
}
function getDialogueRubricVersion() {
  return loadDialogueRubric()?.version || null;
}
function getDeliberationRubricVersion() {
  return loadDeliberationRubric()?.version || null;
}
function getCharismaRubricVersion() {
  return loadTutorCharismaRubric()?.version || null;
}

// ── P0 Provenance: audit trail helpers ────────────────────────────────

/**
 * Coerce a value to a string suitable for audit storage.
 * Objects/arrays are JSON-stringified; null/undefined stay null.
 */
function stringifyAudit(val) {
  if (val === null || val === undefined) return null;
  return typeof val === 'object' ? JSON.stringify(val) : String(val);
}

/**
 * Capture before-state of columns about to be UPDATEd, then return a
 * function that—when called after the UPDATE—diffs and writes audit rows.
 *
 * @param {string|number} resultId - Row ID in evaluation_results
 * @param {string[]} columns - Column names being modified
 * @param {string} operation - Name of the calling function (audit label)
 * @param {{ judgeModel?: string, rubricVersion?: string }} [metadata]
 * @returns {() => void} Call this AFTER the UPDATE statement runs
 */
function withAuditTrail(resultId, columns, operation, metadata = {}) {
  const colList = columns.map((c) => `"${c}"`).join(', ');
  const before = db.prepare(`SELECT ${colList} FROM evaluation_results WHERE id = ?`).get(resultId);

  return function recordAudit() {
    const after = db.prepare(`SELECT ${colList} FROM evaluation_results WHERE id = ?`).get(resultId);
    const auditStmt = db.prepare(`
      INSERT INTO score_audit (result_id, column_name, old_value, new_value, operation, judge_model, rubric_version)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const col of columns) {
      const oldVal = before?.[col];
      const newVal = after?.[col];
      if (stringifyAudit(oldVal) !== stringifyAudit(newVal)) {
        auditStmt.run(
          String(resultId),
          col,
          stringifyAudit(oldVal),
          stringifyAudit(newVal),
          operation,
          metadata.judgeModel || null,
          metadata.rubricVersion || null,
        );
      }
    }
  };
}

/**
 * Retrieve the full score audit trail for a single evaluation result.
 * @param {string|number} resultId
 * @returns {Array} Ordered audit entries
 */
export function getScoreAudit(resultId) {
  return db.prepare('SELECT * FROM score_audit WHERE result_id = ? ORDER BY timestamp').all(String(resultId));
}

/**
 * Retrieve all audit entries for results belonging to a run.
 * @param {string} runId
 * @returns {Array} Ordered audit entries
 */
export function getScoreAuditByRun(runId) {
  return db
    .prepare(
      `
    SELECT sa.* FROM score_audit sa
    JOIN evaluation_results er ON sa.result_id = CAST(er.id AS TEXT)
    WHERE er.run_id = ?
    ORDER BY sa.timestamp
  `,
    )
    .all(runId);
}

function expectedTestsForRun(run) {
  if (Number.isInteger(run?.totalTests) && run.totalTests > 0) return run.totalTests;
  const runsPerConfig = Number(run?.metadata?.runsPerConfig) || 1;
  return (run?.totalScenarios || 0) * (run?.totalConfigurations || 0) * runsPerConfig;
}

function safeResolveModel(ref) {
  if (!ref) return null;
  try {
    return resolveModel(ref);
  } catch {
    return null;
  }
}

function inferScenarioName(scenarioId, progressEvents = []) {
  for (let i = progressEvents.length - 1; i >= 0; i--) {
    const event = progressEvents[i];
    if (event?.scenarioId === scenarioId && event?.scenarioName) {
      return event.scenarioName;
    }
  }

  return getScenario(scenarioId)?.name || scenarioId;
}

function inferPlannedConfigSummary(profileName, metadata = {}) {
  const profile = profileName ? getTutorProfile(profileName) : null;
  const egoRef = profile?.ego?.provider && profile?.ego?.model ? `${profile.ego.provider}.${profile.ego.model}` : null;
  const superegoRef =
    profile?.superego?.provider && profile?.superego?.model
      ? `${profile.superego.provider}.${profile.superego.model}`
      : null;
  const egoResolved = safeResolveModel(egoRef);

  const inferred = {
    provider: egoResolved?.provider || profile?.ego?.resolvedProvider || profile?.ego?.provider || null,
    model: egoResolved?.model || profile?.ego?.resolvedModel || profile?.ego?.model || null,
    egoModel: egoRef,
    superegoModel: superegoRef,
  };

  if (metadata.modelOverride) {
    const resolved = safeResolveModel(metadata.modelOverride);
    if (resolved) {
      inferred.provider = resolved.provider;
      inferred.model = resolved.model;
    }
    inferred.egoModel = metadata.modelOverride;
    if (inferred.superegoModel) inferred.superegoModel = metadata.modelOverride;
  }

  if (metadata.tutorModelOverride) {
    const resolved = safeResolveModel(metadata.tutorModelOverride);
    if (resolved) {
      inferred.provider = resolved.provider;
      inferred.model = resolved.model;
    }
    inferred.egoModel = metadata.tutorModelOverride;
    if (inferred.superegoModel) inferred.superegoModel = metadata.tutorModelOverride;
  }

  if (metadata.egoModelOverride) {
    const resolved = safeResolveModel(metadata.egoModelOverride);
    if (resolved) {
      inferred.provider = resolved.provider;
      inferred.model = resolved.model;
    }
    inferred.egoModel = metadata.egoModelOverride;
  }

  if (metadata.superegoModelOverride && inferred.superegoModel) {
    inferred.superegoModel = metadata.superegoModelOverride;
  }

  return inferred;
}

function buildTransientPlaceholderMap(runId, existingResults = null) {
  const run = getRun(runId);
  if (!run || run.status !== 'completed') return new Map();

  const metadata = run.metadata || {};
  const progressEvents = readProgressLog(runId);
  const runStartProfiles = progressEvents.flatMap((event) =>
    event?.eventType === 'run_start' && Array.isArray(event.profiles) ? event.profiles : [],
  );
  const progressScenarioIds = progressEvents.map((event) => event?.scenarioId).filter(Boolean);
  const profileNames = [
    ...new Set(
      [...(metadata.profileNames || []), ...runStartProfiles].filter((value) => typeof value === 'string' && value),
    ),
  ];
  const scenarioIds = [
    ...new Set(
      [...(metadata.scenarioIds || []), ...progressScenarioIds].filter((value) => typeof value === 'string' && value),
    ),
  ];
  const runsPerConfig = Number(metadata.runsPerConfig) || 1;
  const results = existingResults || getResults(runId);

  if (profileNames.length === 0 || scenarioIds.length === 0) return new Map();

  const storedCounts = new Map();
  for (const result of uniqueGenerationResults(results)) {
    const key = `${result.scenarioId}|${result.profileName}`;
    storedCounts.set(key, (storedCounts.get(key) || 0) + 1);
  }

  const lastErrorByKey = new Map();
  for (const event of progressEvents) {
    if (event?.eventType !== 'test_error' || !event?.scenarioId || !event?.profileName) continue;
    const key = `${event.scenarioId}|${event.profileName}`;
    lastErrorByKey.set(key, event.errorMessage || null);
  }

  const placeholders = new Map();
  for (const scenarioId of scenarioIds) {
    const scenarioName = inferScenarioName(scenarioId, progressEvents);
    for (const profileName of profileNames) {
      const key = `${scenarioId}|${profileName}`;
      const storedCount = storedCounts.get(key) || 0;
      const transientFailedTests = Math.max(0, runsPerConfig - storedCount);
      if (transientFailedTests === 0) continue;

      const inferredConfig = inferPlannedConfigSummary(profileName, metadata);
      placeholders.set(key, {
        scenarioId,
        scenarioName,
        profileName,
        ...inferredConfig,
        transientFailedTests,
        lastErrorMessage: lastErrorByKey.get(key) || null,
      });
    }
  }

  return placeholders;
}

/**
 * Get aggregated statistics for a run
 */
export function getRunStats(runId) {
  const results = getResults(runId);
  const transientPlaceholders = buildTransientPlaceholderMap(runId, results);
  if (results.length === 0 && transientPlaceholders.size === 0) return [];

  // Group by (provider, model, profileName)
  const groups = {};

  for (const r of results) {
    const key = `${r.provider}|${r.model}|${r.profileName}`;
    if (!groups[key]) {
      groups[key] = {
        provider: r.provider,
        model: r.model,
        profileName: r.profileName,
        egoModel: r.egoModel,
        superegoModel: r.superegoModel,
        storedTests: 0,
        transientFailedTests: 0,
        successfulTests: 0,
        scores: [],
        baseScores: [],
        recognitionScores: [],
        latencies: [],
        inputTokens: 0,
        outputTokens: 0,
        passesRequired: 0,
        passesForbidden: 0,
        dimensionSums: {},
        dimensionCounts: {},
        lastErrorMessage: null,
      };
    }

    const g = groups[key];
    g.storedTests++;
    if (r.success) {
      g.successfulTests++;
      if (r.tutorFirstTurnScore != null) g.scores.push(r.tutorFirstTurnScore);
      if (r.baseScore != null) g.baseScores.push(r.baseScore);
      if (r.recognitionScore != null) g.recognitionScores.push(r.recognitionScore);
      if (r.latencyMs != null) g.latencies.push(r.latencyMs);
      g.inputTokens += r.inputTokens || 0;
      g.outputTokens += r.outputTokens || 0;
      if (r.passesRequired) g.passesRequired++;
      if (r.passesForbidden) g.passesForbidden++;

      // Aggregate dimensions from the parsed scores object
      if (r.scores) {
        for (const [dim, score] of Object.entries(r.scores)) {
          const numericScore = typeof score === 'number' ? score : score?.score;
          if (Number.isFinite(numericScore)) {
            g.dimensionSums[dim] = (g.dimensionSums[dim] || 0) + numericScore;
            g.dimensionCounts[dim] = (g.dimensionCounts[dim] || 0) + 1;
          }
        }
      }
    }
  }

  for (const placeholder of transientPlaceholders.values()) {
    const key = `${placeholder.provider}|${placeholder.model}|${placeholder.profileName}`;
    if (!groups[key]) {
      groups[key] = {
        provider: placeholder.provider,
        model: placeholder.model,
        profileName: placeholder.profileName,
        egoModel: placeholder.egoModel,
        superegoModel: placeholder.superegoModel,
        storedTests: 0,
        transientFailedTests: 0,
        successfulTests: 0,
        scores: [],
        baseScores: [],
        recognitionScores: [],
        latencies: [],
        inputTokens: 0,
        outputTokens: 0,
        passesRequired: 0,
        passesForbidden: 0,
        dimensionSums: {},
        dimensionCounts: {},
        lastErrorMessage: null,
      };
    }

    const group = groups[key];
    group.transientFailedTests += placeholder.transientFailedTests;
    if (placeholder.lastErrorMessage) group.lastErrorMessage = placeholder.lastErrorMessage;
  }

  const finalStats = Object.values(groups)
    .map((g) => {
      const avgScore = g.scores.length > 0 ? g.scores.reduce((a, b) => a + b, 0) / g.scores.length : null;
      const totalTests = g.storedTests + g.transientFailedTests;

      const dimensions = {};
      for (const dim of Object.keys(g.dimensionSums)) {
        dimensions[dim] = g.dimensionSums[dim] / g.dimensionCounts[dim];
      }

      return {
        provider: g.provider,
        model: g.model,
        profileName: g.profileName,
        egoModel: g.egoModel,
        superegoModel: g.superegoModel,
        totalTests,
        storedTests: g.storedTests,
        successfulTests: g.successfulTests,
        transientFailedTests: g.transientFailedTests,
        successRate: totalTests > 0 ? g.successfulTests / totalTests : 0,
        avgScore,
        avgBaseScore: g.baseScores.length > 0 ? g.baseScores.reduce((a, b) => a + b, 0) / g.baseScores.length : null,
        avgRecognitionScore:
          g.recognitionScores.length > 0
            ? g.recognitionScores.reduce((a, b) => a + b, 0) / g.recognitionScores.length
            : null,
        dimensions,
        avgLatencyMs: g.latencies.length > 0 ? g.latencies.reduce((a, b) => a + b, 0) / g.latencies.length : null,
        totalInputTokens: g.inputTokens,
        totalOutputTokens: g.outputTokens,
        passesRequired: g.passesRequired,
        passesForbidden: g.passesForbidden,
        validationPassRate: totalTests > 0 ? (g.passesRequired + g.passesForbidden) / (totalTests * 2) : 0,
        lastErrorMessage: g.lastErrorMessage,
      };
    })
    .sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0));

  return finalStats;
}

/**
 * Get scenario-level statistics for a run
 */
export function getScenarioStats(runId) {
  const stmt = db.prepare(`
    SELECT
      scenario_id,
      scenario_name,
      provider,
      model,
      profile_name,
      ego_model,
      superego_model,
      AVG(COALESCE(tutor_first_turn_score, overall_score)) as avg_score,
      AVG(base_score) as avg_base_score,
      AVG(recognition_score) as avg_recognition_score,
      AVG(latency_ms) as avg_latency,
      SUM(CASE WHEN passes_required = 1 AND passes_forbidden = 1 THEN 1 ELSE 0 END) as passes_validation,
      COUNT(*) as runs
    FROM evaluation_results
    WHERE run_id = ?
    GROUP BY scenario_id, provider, model, profile_name
    ORDER BY scenario_id, avg_score DESC
  `);

  const rows = stmt.all(runId);
  const transientPlaceholders = buildTransientPlaceholderMap(runId);
  if (rows.length === 0 && transientPlaceholders.size === 0) return [];

  // Group by scenario
  const grouped = {};
  for (const row of rows) {
    if (!grouped[row.scenario_id]) {
      grouped[row.scenario_id] = {
        scenarioId: row.scenario_id,
        scenarioName: row.scenario_name,
        configurations: [],
      };
    }
    grouped[row.scenario_id].configurations.push({
      provider: row.provider,
      model: row.model,
      profileName: row.profile_name,
      egoModel: row.ego_model,
      superegoModel: row.superego_model,
      avgScore: row.avg_score,
      avgBaseScore: row.avg_base_score,
      avgRecognitionScore: row.avg_recognition_score,
      avgLatencyMs: row.avg_latency,
      passesValidation: row.passes_validation === row.runs,
      storedRuns: row.runs,
      transientFailedRuns: 0,
      runs: row.runs,
      lastErrorMessage: null,
    });
  }

  for (const placeholder of transientPlaceholders.values()) {
    if (!grouped[placeholder.scenarioId]) {
      grouped[placeholder.scenarioId] = {
        scenarioId: placeholder.scenarioId,
        scenarioName: placeholder.scenarioName,
        configurations: [],
      };
    }

    let existingConfig = grouped[placeholder.scenarioId].configurations.find(
      (config) =>
        config.provider === placeholder.provider &&
        config.model === placeholder.model &&
        config.profileName === placeholder.profileName,
    );

    if (!existingConfig) {
      existingConfig = {
        provider: placeholder.provider,
        model: placeholder.model,
        profileName: placeholder.profileName,
        egoModel: placeholder.egoModel,
        superegoModel: placeholder.superegoModel,
        avgScore: null,
        avgBaseScore: null,
        avgRecognitionScore: null,
        avgLatencyMs: null,
        passesValidation: false,
        storedRuns: 0,
        transientFailedRuns: 0,
        runs: 0,
        lastErrorMessage: null,
      };
      grouped[placeholder.scenarioId].configurations.push(existingConfig);
    }

    existingConfig.transientFailedRuns += placeholder.transientFailedTests;
    existingConfig.runs += placeholder.transientFailedTests;
    existingConfig.passesValidation = false;
    if (placeholder.lastErrorMessage) existingConfig.lastErrorMessage = placeholder.lastErrorMessage;
  }

  return Object.values(grouped);
}

/**
 * Compare two configurations across all scenarios
 */
export function compareConfigs(runId, config1, config2) {
  const getConfigResults = (provider, model) => {
    const stmt = db.prepare(`
      SELECT
        scenario_id,
        AVG(COALESCE(tutor_first_turn_score, overall_score)) as avg_score,
        AVG(score_relevance) as relevance,
        AVG(score_specificity) as specificity,
        AVG(score_pedagogical) as pedagogical,
        AVG(score_personalization) as personalization,
        AVG(score_actionability) as actionability,
        AVG(score_tone) as tone,
        AVG(latency_ms) as latency,
        SUM(CASE WHEN passes_required = 1 AND passes_forbidden = 1 THEN 1 ELSE 0 END) * 1.0 / COUNT(*) as pass_rate
      FROM evaluation_results
      WHERE run_id = ? AND provider = ? AND model = ?
      GROUP BY scenario_id
    `);
    return stmt.all(runId, provider, model);
  };

  const results1 = getConfigResults(config1.provider, config1.model);
  const results2 = getConfigResults(config2.provider, config2.model);

  // Build comparison
  const comparison = [];
  const scenarios = new Set([...results1.map((r) => r.scenario_id), ...results2.map((r) => r.scenario_id)]);

  for (const scenarioId of scenarios) {
    const r1 = results1.find((r) => r.scenario_id === scenarioId) || {};
    const r2 = results2.find((r) => r.scenario_id === scenarioId) || {};

    comparison.push({
      scenarioId,
      config1Score: r1.avg_score || null,
      config2Score: r2.avg_score || null,
      difference: (r1.avg_score || 0) - (r2.avg_score || 0),
      winner: r1.avg_score > r2.avg_score ? 'config1' : r2.avg_score > r1.avg_score ? 'config2' : 'tie',
    });
  }

  // Overall stats
  const overall = {
    config1Wins: comparison.filter((c) => c.winner === 'config1').length,
    config2Wins: comparison.filter((c) => c.winner === 'config2').length,
    ties: comparison.filter((c) => c.winner === 'tie').length,
    config1AvgScore: results1.reduce((sum, r) => sum + r.avg_score, 0) / (results1.length || 1),
    config2AvgScore: results2.reduce((sum, r) => sum + r.avg_score, 0) / (results2.length || 1),
  };

  return { comparison, overall };
}

/**
 * Export results to JSON
 */
export function exportToJson(runId) {
  const run = getRun(runId);
  const results = getResults(runId);
  const stats = getRunStats(runId);
  const scenarioStats = getScenarioStats(runId);

  return {
    run,
    stats,
    scenarioStats,
    results,
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Export results to CSV format
 */
export function exportToCsv(runId) {
  const results = getResults(runId);

  const headers = [
    'scenario_id',
    'scenario_name',
    'provider',
    'model',
    'tutor_first_turn_score',
    'relevance',
    'specificity',
    'pedagogical',
    'personalization',
    'actionability',
    'tone',
    'latency_ms',
    'input_tokens',
    'output_tokens',
    'passes_required',
    'passes_forbidden',
    'success',
    'attempt_index',
    'profile_name',
    'prompt_id',
    'ego_model',
    'superego_model',
    'factor_recognition',
    'factor_multi_agent_tutor',
    'factor_multi_agent_learner',
    'learner_architecture',
    'learner_id',
    'conversation_mode',
    'dialogue_id',
    'dialogue_content_hash',
    'config_hash',
    'tutor_ego_prompt_version',
    'tutor_superego_prompt_version',
    'learner_prompt_version',
    'prompt_content_hash',
    'id_construction_trace',
    'raw_response',
  ];

  const rows = results.map((r) => [
    r.scenarioId,
    r.scenarioName,
    r.provider,
    r.model,
    r.tutorFirstTurnScore,
    r.scores?.relevance,
    r.scores?.specificity,
    r.scores?.pedagogical,
    r.scores?.personalization,
    r.scores?.actionability,
    r.scores?.tone,
    r.latencyMs,
    r.inputTokens,
    r.outputTokens,
    r.passesRequired ? 1 : 0,
    r.passesForbidden ? 1 : 0,
    r.success ? 1 : 0,
    r.attemptIndex,
    r.profileName,
    r.promptId,
    r.egoModel,
    r.superegoModel,
    r.factors?.recognition == null ? null : r.factors.recognition ? 1 : 0,
    r.factors?.multi_agent_tutor == null ? null : r.factors.multi_agent_tutor ? 1 : 0,
    r.factors?.multi_agent_learner == null ? null : r.factors.multi_agent_learner ? 1 : 0,
    r.learnerArchitecture,
    r.learnerId,
    r.conversationMode,
    r.dialogueId,
    r.dialogueContentHash,
    r.configHash,
    r.tutorEgoPromptVersion,
    r.tutorSuperegoPromptVersion,
    r.learnerPromptVersion,
    r.promptContentHash,
    r.idConstructionTrace == null ? null : JSON.stringify(r.idConstructionTrace),
    r.rawResponse,
  ]);

  const escapeCsvField = (value) => {
    if (value == null) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  return [headers.join(','), ...rows.map((row) => row.map(escapeCsvField).join(','))].join('\n');
}

/**
 * Complete an incomplete evaluation run
 *
 * Phase 3c: Write run snapshot manifest to logs/run-manifests/{runId}.json.
 * Records the complete provenance anchor for a run: every row's dialogue hash,
 * config hash, and scoring metadata.
 */
const MANIFESTS_DIR = path.join(LOGS_ROOT, 'run-manifests');

function writeRunManifest(runId, run, results, completedAt) {
  try {
    if (!fs.existsSync(MANIFESTS_DIR)) {
      fs.mkdirSync(MANIFESTS_DIR, { recursive: true });
    }

    // Collect per-row provenance data
    const rows = {};
    const configHashes = {};
    const profiles = new Set();
    const scenarios = new Set();
    const judgeModels = new Set();

    // Query rubric versions directly (not in parsed results)
    const rubricVersionMap = {};
    try {
      const versionRows = db
        .prepare('SELECT id, tutor_rubric_version FROM evaluation_results WHERE run_id = ?')
        .all(runId);
      for (const vr of versionRows) rubricVersionMap[String(vr.id)] = vr.tutor_rubric_version || null;
    } catch {
      /* ignore */
    }

    for (const r of results) {
      const rowIdStr = String(r.id);
      rows[rowIdStr] = {
        dialogueId: r.dialogueId || null,
        dialogueContentHash: r.dialogueContentHash || null,
        configHash: r.configHash || null,
        profileName: r.profileName || null,
        scenarioId: r.scenarioId || null,
        attemptIndex: r.attemptIndex ?? null,
        learnerId: r.learnerId || null,
        judgeModel: r.judgeModel || null,
        tutorRubricVersion: rubricVersionMap[rowIdStr] || null,
        promptContentHash: r.promptContentHash || null,
        tutorEgoPromptVersion: r.tutorEgoPromptVersion || null,
        tutorSuperegoPromptVersion: r.tutorSuperegoPromptVersion || null,
        learnerPromptVersion: r.learnerPromptVersion || null,
      };

      if (r.configHash && r.profileName) {
        configHashes[r.profileName] = r.configHash;
      }
      if (r.profileName) profiles.add(r.profileName);
      if (r.scenarioId) scenarios.add(r.scenarioId);
      if (r.judgeModel) judgeModels.add(r.judgeModel);
    }

    const rubricVersions = [...new Set(Object.values(rubricVersionMap).filter(Boolean))].sort();

    const manifest = {
      run_id: runId,
      created_at: run.createdAt,
      completed_at: completedAt,
      git_commit: run.gitCommit || null,
      package_version: run.packageVersion || null,
      description: run.description || null,
      total_rows: results.length,
      total_generations: uniqueGenerationResults(results).length,
      expected_tests: expectedTestsForRun(run),
      profiles: [...profiles].sort(),
      scenarios: [...scenarios].sort(),
      judge_models: [...judgeModels].sort(),
      rubric_versions: rubricVersions,
      config_hashes: configHashes,
      rows,
    };

    const manifestPath = path.join(MANIFESTS_DIR, `${runId}.json`);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  } catch {
    // Non-fatal: manifest write failure should not block run completion
  }
}

const resultRepository = createResultRepository({
  db,
  getTutorRubricVersion,
  getRun: (...args) => runRepository.getRun(...args),
  expectedTestsForRun,
});
const runRepository = createRunRepository({
  db,
  generateRunId,
  getResults: (...args) => resultRepository.getResults(...args),
  generationIdentity: (...args) => resultRepository.generationIdentity(...args),
  uniqueGenerationResults: (...args) => resultRepository.uniqueGenerationResults(...args),
  expectedTestsForRun,
  writeRunManifest,
  isPidAlive,
});

export const storeResult = resultRepository.storeResult;
export const getResults = resultRepository.getResults;
export const getResultById = resultRepository.getResultById;
export const storeRejudgment = resultRepository.storeRejudgment;
export const generationIdentity = resultRepository.generationIdentity;
export const cloneRowsForRubricVersion = resultRepository.cloneRowsForRubricVersion;
const uniqueGenerationResults = resultRepository.uniqueGenerationResults;

export const createRun = runRepository.createRun;
export const updateRun = runRepository.updateRun;
export const getRun = runRepository.getRun;
export const listRuns = runRepository.listRuns;
export const completeRun = runRepository.completeRun;
export const findIncompleteRuns = runRepository.findIncompleteRuns;
export const autoCompleteStaleRuns = runRepository.autoCompleteStaleRuns;
export const deleteRun = runRepository.deleteRun;
export const getIncompleteTests = runRepository.getIncompleteTests;

// ============================================================================
// Interaction Evaluation Functions
// ============================================================================

/**
 * Store an interaction evaluation result
 */
export function storeInteractionEval(evalData) {
  const stmt = db.prepare(`
    INSERT INTO interaction_evaluations (
      id, run_id, scenario_id, scenario_name, eval_type,
      learner_profile, tutor_profile, persona_id, learner_agents,
      turn_count, turns, sequence_diagram, formatted_transcript,
      learner_memory_before, learner_memory_after, tutor_memory_before, tutor_memory_after,
      total_tokens, learner_tokens, tutor_tokens, latency_ms,
      final_learner_state, final_understanding, unique_outcomes,
      judge_overall_score, judge_evaluation
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    evalData.evalId,
    evalData.runId || null,
    evalData.scenarioId,
    evalData.scenarioName,
    evalData.type || 'short_term',
    evalData.learnerProfile || null,
    evalData.tutorProfile || 'default',
    evalData.personaId || null,
    JSON.stringify(evalData.learnerAgents || []),
    evalData.metrics?.turnCount || evalData.interaction?.turns?.length || 0,
    JSON.stringify(evalData.interaction?.turns || []),
    evalData.sequenceDiagram || null,
    evalData.formattedTranscript || null,
    JSON.stringify(evalData.interaction?.writingPadSnapshots?.learner?.before || null),
    JSON.stringify(evalData.interaction?.writingPadSnapshots?.learner?.after || null),
    JSON.stringify(evalData.interaction?.writingPadSnapshots?.tutor?.before || null),
    JSON.stringify(evalData.interaction?.writingPadSnapshots?.tutor?.after || null),
    evalData.metrics?.totalTokens || 0,
    evalData.metrics?.learnerTokens || 0,
    evalData.metrics?.tutorTokens || 0,
    evalData.metrics?.totalLatencyMs || 0,
    evalData.interaction?.summary?.learnerFinalState || null,
    evalData.interaction?.summary?.learnerFinalUnderstanding || null,
    JSON.stringify(evalData.interaction?.summary?.uniqueOutcomes || []),
    // Extract overall score from multiple possible locations in judge evaluation
    evalData.judgeEvaluation?.overall_assessment?.score ??
      evalData.judgeEvaluation?.narrative_summary?.overall_quality ??
      evalData.judgeEvaluation?.overall_score ??
      null,
    JSON.stringify(evalData.judgeEvaluation || null),
  );

  return evalData.evalId;
}

/**
 * List interaction evaluations
 */
export function listInteractionEvals(options = {}) {
  const { limit = 50, scenarioId = null } = options;

  const sql = `
    SELECT * FROM interaction_evaluations
    ${scenarioId ? 'WHERE scenario_id = ?' : ''}
    ORDER BY created_at DESC
    LIMIT ?
  `;

  const stmt = db.prepare(sql);
  const rows = scenarioId ? stmt.all(scenarioId, limit) : stmt.all(limit);

  return rows.map((row) => ({
    evalId: row.id,
    runId: row.run_id,
    scenarioId: row.scenario_id,
    scenarioName: row.scenario_name,
    evalType: row.eval_type,
    learnerProfile: row.learner_profile,
    tutorProfile: row.tutor_profile,
    personaId: row.persona_id,
    turnCount: row.turn_count,
    totalTokens: row.total_tokens,
    latencyMs: row.latency_ms,
    finalLearnerState: row.final_learner_state,
    finalUnderstanding: row.final_understanding,
    judgeOverallScore: row.judge_overall_score,
    createdAt: row.created_at,
  }));
}

/**
 * Get a specific interaction evaluation
 */
export function getInteractionEval(evalId) {
  const stmt = db.prepare('SELECT * FROM interaction_evaluations WHERE id = ?');
  const row = stmt.get(evalId);

  if (!row) return null;

  return {
    evalId: row.id,
    runId: row.run_id,
    scenarioId: row.scenario_id,
    scenarioName: row.scenario_name,
    evalType: row.eval_type,
    learnerProfile: row.learner_profile,
    tutorProfile: row.tutor_profile,
    personaId: row.persona_id,
    learnerAgents: JSON.parse(row.learner_agents || '[]'),
    turnCount: row.turn_count,
    turns: JSON.parse(row.turns || '[]'),
    sequenceDiagram: row.sequence_diagram,
    formattedTranscript: row.formatted_transcript,
    learnerMemoryBefore: JSON.parse(row.learner_memory_before || 'null'),
    learnerMemoryAfter: JSON.parse(row.learner_memory_after || 'null'),
    tutorMemoryBefore: JSON.parse(row.tutor_memory_before || 'null'),
    tutorMemoryAfter: JSON.parse(row.tutor_memory_after || 'null'),
    totalTokens: row.total_tokens,
    learnerTokens: row.learner_tokens,
    tutorTokens: row.tutor_tokens,
    latencyMs: row.latency_ms,
    finalLearnerState: row.final_learner_state,
    finalUnderstanding: row.final_understanding,
    uniqueOutcomes: JSON.parse(row.unique_outcomes || '[]'),
    judgeOverallScore: row.judge_overall_score,
    judgeEvaluation: JSON.parse(row.judge_evaluation || 'null'),
    learnerScores: JSON.parse(row.learner_scores || 'null'),
    learnerOverallScore: row.learner_overall_score,
    learnerJudgeModel: row.learner_judge_model,
    learnerHolisticScores: JSON.parse(row.learner_holistic_scores || 'null'),
    learnerHolisticOverallScore: row.learner_holistic_overall_score,
    learnerHolisticSummary: row.learner_holistic_summary,
    learnerHolisticJudgeModel: row.learner_holistic_judge_model,
    createdAt: row.created_at,
  };
}

/**
 * Get an interaction evaluation by its run ID (for Interact tab runs)
 */
export function getInteractionEvalByRunId(runId) {
  const stmt = db.prepare('SELECT * FROM interaction_evaluations WHERE run_id = ? ORDER BY created_at DESC LIMIT 1');
  const row = stmt.get(runId);

  if (!row) return null;

  return {
    evalId: row.id,
    runId: row.run_id,
    scenarioId: row.scenario_id,
    scenarioName: row.scenario_name,
    evalType: row.eval_type,
    learnerProfile: row.learner_profile,
    tutorProfile: row.tutor_profile,
    personaId: row.persona_id,
    learnerAgents: JSON.parse(row.learner_agents || '[]'),
    turnCount: row.turn_count,
    turns: JSON.parse(row.turns || '[]'),
    sequenceDiagram: row.sequence_diagram,
    formattedTranscript: row.formatted_transcript,
    learnerMemoryBefore: JSON.parse(row.learner_memory_before || 'null'),
    learnerMemoryAfter: JSON.parse(row.learner_memory_after || 'null'),
    tutorMemoryBefore: JSON.parse(row.tutor_memory_before || 'null'),
    tutorMemoryAfter: JSON.parse(row.tutor_memory_after || 'null'),
    totalTokens: row.total_tokens,
    learnerTokens: row.learner_tokens,
    tutorTokens: row.tutor_tokens,
    latencyMs: row.latency_ms,
    finalLearnerState: row.final_learner_state,
    finalUnderstanding: row.final_understanding,
    uniqueOutcomes: JSON.parse(row.unique_outcomes || '[]'),
    judgeOverallScore: row.judge_overall_score,
    judgeEvaluation: JSON.parse(row.judge_evaluation || 'null'),
    learnerScores: JSON.parse(row.learner_scores || 'null'),
    learnerOverallScore: row.learner_overall_score,
    learnerJudgeModel: row.learner_judge_model,
    learnerHolisticScores: JSON.parse(row.learner_holistic_scores || 'null'),
    learnerHolisticOverallScore: row.learner_holistic_overall_score,
    learnerHolisticSummary: row.learner_holistic_summary,
    learnerHolisticJudgeModel: row.learner_holistic_judge_model,
    createdAt: row.created_at,
  };
}

/**
 * Get factorial cell data for ANOVA analysis.
 *
 * Returns scores grouped by cell key ("r0_t0_l0", etc.)
 * Only includes results that have factor tags stored.
 *
 * @param {string} runId - The run ID
 * @param {Object} [options] - Options
 * @param {string} [options.scoreColumn='tutor_first_turn_score'] - Which score to use
 * @returns {Object} Map of cellKey → [score, ...]
 */
export function getFactorialCellData(runId, options = {}) {
  const { scoreColumn = 'tutor_first_turn_score' } = options;

  // Whitelist valid score columns to prevent SQL injection
  const validColumns = ['tutor_first_turn_score', 'overall_score', 'base_score', 'recognition_score'];
  const col = validColumns.includes(scoreColumn) ? scoreColumn : 'tutor_first_turn_score';

  const stmt = db.prepare(`
    SELECT factor_recognition, factor_multi_agent_tutor, factor_multi_agent_learner, ${col} as score
    FROM evaluation_results
    WHERE run_id = ? AND factor_recognition IS NOT NULL AND ${col} IS NOT NULL AND success = 1
  `);

  const rows = stmt.all(runId);
  const cells = {};

  for (const row of rows) {
    const key = `r${row.factor_recognition}_t${row.factor_multi_agent_tutor}_l${row.factor_multi_agent_learner}`;
    if (!cells[key]) cells[key] = [];
    cells[key].push(row.score);
  }

  return cells;
}

/**
 * Update score columns for an existing result row (for rejudging - overwrites history)
 * @deprecated Use storeRejudgment() to preserve judgment history for reliability analysis
 */
export function updateResultScores(resultId, evaluation) {
  const recordAudit = withAuditTrail(
    resultId,
    [
      'score_relevance',
      'score_specificity',
      'score_pedagogical',
      'score_personalization',
      'score_actionability',
      'score_tone',
      'overall_score',
      'tutor_first_turn_score',
      'judge_model',
      'tutor_rubric_version',
    ],
    'updateResultScores',
    { judgeModel: evaluation.judgeModel, rubricVersion: getTutorRubricVersion() },
  );

  const stmt = db.prepare(`
    UPDATE evaluation_results SET
      score_relevance = ?,
      score_specificity = ?,
      score_pedagogical = ?,
      score_personalization = ?,
      score_actionability = ?,
      score_tone = ?,
      overall_score = ?,
      tutor_first_turn_score = ?,
      base_score = ?,
      recognition_score = ?,
      passes_required = ?,
      passes_forbidden = ?,
      required_missing = ?,
      forbidden_found = ?,
      judge_model = ?,
      evaluation_reasoning = ?,
      scores_with_reasoning = ?,
      scoring_method = ?,
      judge_latency_ms = ?,
      tutor_rubric_version = ?
    WHERE id = ?
  `);

  const scores = evaluation.scores || {};
  stmt.run(
    scores.relevance?.score ?? scores.relevance ?? null,
    scores.specificity?.score ?? scores.specificity ?? null,
    scores.pedagogical?.score ?? scores.pedagogical ?? null,
    scores.personalization?.score ?? scores.personalization ?? null,
    scores.actionability?.score ?? scores.actionability ?? null,
    scores.tone?.score ?? scores.tone ?? null,
    evaluation.tutorFirstTurnScore ?? evaluation.overallScore ?? null, // overall_score (deprecated)
    evaluation.tutorFirstTurnScore ?? evaluation.overallScore ?? null, // tutor_first_turn_score
    evaluation.baseScore ?? null,
    evaluation.recognitionScore ?? null,
    evaluation.passesRequired ? 1 : 0,
    evaluation.passesForbidden ? 1 : 0,
    JSON.stringify(evaluation.requiredMissing || []),
    JSON.stringify(evaluation.forbiddenFound || []),
    evaluation.judgeModel || null,
    evaluation.summary || null,
    evaluation.scores ? JSON.stringify(evaluation.scores) : null,
    'rubric', // Only called on successful evaluations
    evaluation.judgeLatencyMs ?? null,
    getTutorRubricVersion(),
    resultId,
  );

  recordAudit();
}

/**
 * Update tutor last-turn score for a multi-turn dialogue result.
 * Sets tutor_last_turn_score and computes tutor_development_score = last - first.
 *
 * @param {number} resultId - The evaluation result row ID
 * @param {Object} evaluation - Evaluation data
 * @param {number} evaluation.tutorLastTurnScore - Tutor rubric score on last turn (0-100)
 * @param {string} [evaluation.judgeModel] - Judge model used
 * @param {number} [evaluation.judgeLatencyMs] - Judge latency
 */
export function updateTutorLastTurnScore(resultId, evaluation) {
  const recordAudit = withAuditTrail(
    resultId,
    ['tutor_last_turn_score', 'tutor_development_score'],
    'updateTutorLastTurnScore',
  );

  // Read existing tutor_first_turn_score to compute development delta
  const row = db
    .prepare('SELECT tutor_first_turn_score, overall_score FROM evaluation_results WHERE id = ?')
    .get(resultId);
  const firstTurnScore = row?.tutor_first_turn_score ?? row?.overall_score ?? null;
  const lastTurnScore = evaluation.tutorLastTurnScore ?? null;
  const developmentScore = firstTurnScore != null && lastTurnScore != null ? lastTurnScore - firstTurnScore : null;

  const stmt = db.prepare(`
    UPDATE evaluation_results SET
      tutor_last_turn_score = ?,
      tutor_development_score = ?
    WHERE id = ?
  `);
  stmt.run(lastTurnScore, developmentScore, resultId);

  recordAudit();
}

/**
 * Update dialogue quality score for a multi-turn dialogue result.
 *
 * @param {number} resultId - The evaluation result row ID
 * @param {Object} evaluation - Dialogue quality evaluation data
 * @param {number} evaluation.dialogueQualityScore - Overall dialogue quality (0-100)
 * @param {Object} [evaluation.dialogueQualityScores] - Per-dimension scores
 * @param {string} [evaluation.dialogueQualitySummary] - Judge narrative summary
 * @param {string} [evaluation.dialogueQualityJudgeModel] - Judge model used
 */
export function updateDialogueQualityScore(resultId, evaluation) {
  const recordAudit = withAuditTrail(
    resultId,
    [
      'dialogue_quality_score',
      'dialogue_quality_scores',
      'dialogue_quality_summary',
      'dialogue_quality_judge_model',
      'dialogue_rubric_version',
    ],
    'updateDialogueQualityScore',
    { judgeModel: evaluation.dialogueQualityJudgeModel, rubricVersion: getDialogueRubricVersion() },
  );

  const stmt = db.prepare(`
    UPDATE evaluation_results SET
      dialogue_quality_score = ?,
      dialogue_quality_scores = ?,
      dialogue_quality_summary = ?,
      dialogue_quality_judge_model = ?,
      dialogue_rubric_version = ?
    WHERE id = ?
  `);
  stmt.run(
    evaluation.dialogueQualityScore ?? null,
    evaluation.dialogueQualityScores ? JSON.stringify(evaluation.dialogueQualityScores) : null,
    evaluation.dialogueQualitySummary || null,
    evaluation.dialogueQualityJudgeModel || null,
    getDialogueRubricVersion(),
    resultId,
  );

  recordAudit();
}

/**
 * Update dialogue quality INTERNAL (full-trace) score for a multi-turn dialogue result.
 * This is the score from the full transcript including internal deliberation.
 *
 * @param {number} resultId - The evaluation result row ID
 * @param {Object} evaluation - Internal dialogue quality evaluation data
 * @param {number} evaluation.dialogueQualityInternalScore - Full-trace dialogue quality (0-100)
 * @param {Object} [evaluation.dialogueQualityInternalScores] - Per-dimension full-trace scores
 * @param {string} [evaluation.dialogueQualityInternalSummary] - Judge narrative summary
 */
export function updateDialogueQualityInternalScore(resultId, evaluation) {
  const recordAudit = withAuditTrail(
    resultId,
    [
      'dialogue_quality_internal_score',
      'dialogue_quality_internal_scores',
      'dialogue_quality_internal_summary',
      'dialogue_rubric_version',
    ],
    'updateDialogueQualityInternalScore',
    { rubricVersion: getDialogueRubricVersion() },
  );

  const stmt = db.prepare(`
    UPDATE evaluation_results SET
      dialogue_quality_internal_score = ?,
      dialogue_quality_internal_scores = ?,
      dialogue_quality_internal_summary = ?,
      dialogue_rubric_version = ?
    WHERE id = ?
  `);
  stmt.run(
    evaluation.dialogueQualityInternalScore ?? null,
    evaluation.dialogueQualityInternalScores ? JSON.stringify(evaluation.dialogueQualityInternalScores) : null,
    evaluation.dialogueQualityInternalSummary || null,
    getDialogueRubricVersion(),
    resultId,
  );

  recordAudit();
}

/**
 * Update tutor deliberation quality scores for a multi-turn dialogue result.
 * Only applicable to multi-agent tutor cells with a configured superego.
 *
 * @param {number} resultId - The evaluation result row ID
 * @param {Object} evaluation - Deliberation evaluation data
 * @param {Object} evaluation.deliberationScores - Per-dimension scores (JSON-serializable)
 * @param {number} evaluation.deliberationScore - Overall deliberation quality (0-100)
 * @param {string} [evaluation.deliberationSummary] - Judge narrative summary
 * @param {string} [evaluation.deliberationJudgeModel] - Judge model used
 */
export function updateTutorDeliberationScores(resultId, evaluation) {
  const recordAudit = withAuditTrail(
    resultId,
    [
      'tutor_deliberation_scores',
      'tutor_deliberation_score',
      'tutor_deliberation_summary',
      'tutor_deliberation_judge_model',
      'deliberation_rubric_version',
    ],
    'updateTutorDeliberationScores',
    { judgeModel: evaluation.deliberationJudgeModel, rubricVersion: getDeliberationRubricVersion() },
  );

  const stmt = db.prepare(`
    UPDATE evaluation_results SET
      tutor_deliberation_scores = ?,
      tutor_deliberation_score = ?,
      tutor_deliberation_summary = ?,
      tutor_deliberation_judge_model = ?,
      deliberation_rubric_version = ?
    WHERE id = ?
  `);
  stmt.run(
    evaluation.deliberationScores ? JSON.stringify(evaluation.deliberationScores) : null,
    evaluation.deliberationScore ?? null,
    evaluation.deliberationSummary || null,
    evaluation.deliberationJudgeModel || null,
    getDeliberationRubricVersion(),
    resultId,
  );

  recordAudit();
}

/**
 * Update learner deliberation quality scores for a multi-turn dialogue result.
 * Only applicable to ego_superego learner architecture cells.
 *
 * @param {number} resultId - The evaluation result row ID
 * @param {Object} evaluation - Deliberation evaluation data
 * @param {Object} evaluation.deliberationScores - Per-dimension scores (JSON-serializable)
 * @param {number} evaluation.deliberationScore - Overall deliberation quality (0-100)
 * @param {string} [evaluation.deliberationSummary] - Judge narrative summary
 * @param {string} [evaluation.deliberationJudgeModel] - Judge model used
 */
export function updateLearnerDeliberationScores(resultId, evaluation) {
  const recordAudit = withAuditTrail(
    resultId,
    [
      'learner_deliberation_scores',
      'learner_deliberation_score',
      'learner_deliberation_summary',
      'learner_deliberation_judge_model',
      'deliberation_rubric_version',
    ],
    'updateLearnerDeliberationScores',
    { judgeModel: evaluation.deliberationJudgeModel, rubricVersion: getDeliberationRubricVersion() },
  );

  const stmt = db.prepare(`
    UPDATE evaluation_results SET
      learner_deliberation_scores = ?,
      learner_deliberation_score = ?,
      learner_deliberation_summary = ?,
      learner_deliberation_judge_model = ?,
      deliberation_rubric_version = ?
    WHERE id = ?
  `);
  stmt.run(
    evaluation.deliberationScores ? JSON.stringify(evaluation.deliberationScores) : null,
    evaluation.deliberationScore ?? null,
    evaluation.deliberationSummary || null,
    evaluation.deliberationJudgeModel || null,
    getDeliberationRubricVersion(),
    resultId,
  );

  recordAudit();
}

/**
 * Update process measures extracted from dialogue logs.
 * These are non-rubric metrics computed by turnComparisonAnalyzer and dialogueTraceAnalyzer.
 *
 * @param {string} resultId - The evaluation result ID
 * @param {Object} metrics - Process measure data
 * @param {number} [metrics.adaptationIndex] - Tutor approach change 0-1
 * @param {number} [metrics.learnerGrowthIndex] - Learner sophistication evolution 0-1
 * @param {number} [metrics.bilateralTransformationIndex] - Average of adaptation + growth 0-1
 * @param {number} [metrics.incorporationRate] - Ego revision following superego feedback 0-1
 * @param {number} [metrics.dimensionConvergence] - Score variance reduction 0-1
 * @param {number} [metrics.transformationQuality] - Overall transformation quality 0-100
 */
export function updateProcessMeasures(resultId, metrics) {
  const recordAudit = withAuditTrail(
    resultId,
    [
      'adaptation_index',
      'learner_growth_index',
      'bilateral_transformation_index',
      'incorporation_rate',
      'dimension_convergence',
      'transformation_quality',
    ],
    'updateProcessMeasures',
  );

  const stmt = db.prepare(`
    UPDATE evaluation_results SET
      adaptation_index = ?,
      learner_growth_index = ?,
      bilateral_transformation_index = ?,
      incorporation_rate = ?,
      dimension_convergence = ?,
      transformation_quality = ?
    WHERE id = ?
  `);
  stmt.run(
    metrics.adaptationIndex ?? null,
    metrics.learnerGrowthIndex ?? null,
    metrics.bilateralTransformationIndex ?? null,
    metrics.incorporationRate ?? null,
    metrics.dimensionConvergence ?? null,
    metrics.transformationQuality ?? null,
    resultId,
  );

  recordAudit();
}

/**
 * Update learner-side evaluation scores on an evaluation_results row.
 *
 * @param {string} resultId - The evaluation result ID
 * @param {Object} evaluation - Learner evaluation data
 * @param {Object} evaluation.scores - Per-turn learner scores (JSON-serializable)
 * @param {number} evaluation.overallScore - Weighted average learner score (0-100)
 * @param {string} evaluation.judgeModel - Model used for judging
 * @param {Object} [evaluation.holisticScores] - Dialogue-level learner rubric scores
 * @param {number} [evaluation.holisticOverallScore] - Dialogue-level learner score (0-100)
 * @param {string} [evaluation.holisticSummary] - Judge summary for dialogue-level score
 * @param {string} [evaluation.holisticJudgeModel] - Model used for holistic learner judging
 */
export function updateResultLearnerScores(resultId, evaluation) {
  const recordAudit = withAuditTrail(
    resultId,
    [
      'learner_scores',
      'learner_overall_score',
      'learner_judge_model',
      'learner_holistic_scores',
      'learner_holistic_overall_score',
      'learner_holistic_summary',
      'learner_holistic_judge_model',
      'learner_rubric_version',
    ],
    'updateResultLearnerScores',
    { judgeModel: evaluation.judgeModel, rubricVersion: getLearnerRubricVersion() },
  );

  const stmt = db.prepare(`
    UPDATE evaluation_results SET
      learner_scores = ?,
      learner_overall_score = ?,
      learner_judge_model = ?,
      learner_holistic_scores = ?,
      learner_holistic_overall_score = ?,
      learner_holistic_summary = ?,
      learner_holistic_judge_model = ?,
      learner_rubric_version = ?
    WHERE id = ?
  `);

  stmt.run(
    JSON.stringify(evaluation.scores ?? null),
    evaluation.overallScore ?? null,
    evaluation.judgeModel || null,
    evaluation.holisticScores ? JSON.stringify(evaluation.holisticScores) : null,
    evaluation.holisticOverallScore ?? null,
    evaluation.holisticSummary || null,
    evaluation.holisticJudgeModel || null,
    getLearnerRubricVersion(),
    resultId,
  );

  recordAudit();
}

/**
 * Update per-turn tutor scores for a multi-turn dialogue result.
 * Stores per-turn JSON scores and computes aggregate metrics.
 *
 * @param {string} resultId - The evaluation result row ID
 * @param {Object} evaluation - Tutor scoring data
 * @param {Object} evaluation.tutorScores - Per-turn tutor scores: { "0": {scores, overallScore, summary}, ... }
 * @param {number} evaluation.tutorOverallScore - Average across all tutor turns (0-100)
 * @param {number} evaluation.tutorFirstTurnScore - Turn 0 score (0-100)
 * @param {number} evaluation.tutorLastTurnScore - Turn N score (0-100)
 * @param {number} evaluation.tutorDevelopmentScore - last - first delta
 * @param {string} [evaluation.judgeModel] - Judge model used
 * @param {number} [evaluation.judgeLatencyMs] - Total judge latency
 */
export function updateResultTutorScores(resultId, evaluation) {
  const recordAudit = withAuditTrail(
    resultId,
    [
      'tutor_scores',
      'tutor_overall_score',
      'tutor_first_turn_score',
      'tutor_last_turn_score',
      'tutor_development_score',
      'judge_model',
      'tutor_rubric_version',
    ],
    'updateResultTutorScores',
    { judgeModel: evaluation.judgeModel, rubricVersion: evaluation.rubricVersion || getTutorRubricVersion() },
  );

  const resolvedRubricVersion = evaluation.rubricVersion || getTutorRubricVersion();

  const stmt = db.prepare(`
    UPDATE evaluation_results SET
      tutor_scores = ?,
      tutor_overall_score = ?,
      tutor_first_turn_score = ?,
      overall_score = ?,
      tutor_last_turn_score = ?,
      tutor_development_score = ?,
      judge_model = COALESCE(?, judge_model),
      judge_latency_ms = COALESCE(?, judge_latency_ms),
      tutor_rubric_version = ?
    WHERE id = ?
  `);

  stmt.run(
    evaluation.tutorScores ? JSON.stringify(evaluation.tutorScores) : null,
    evaluation.tutorOverallScore ?? null,
    evaluation.tutorFirstTurnScore ?? null,
    evaluation.tutorFirstTurnScore ?? null, // overall_score (deprecated alias)
    evaluation.tutorLastTurnScore ?? null,
    evaluation.tutorDevelopmentScore ?? null,
    evaluation.judgeModel || null,
    evaluation.judgeLatencyMs ?? null,
    resolvedRubricVersion,
    resultId,
  );

  recordAudit();
}

/**
 * Update holistic tutor evaluation scores on an evaluation_results row.
 * Writes ONLY the 4 holistic tutor columns — no clobbering of per-turn tutor data.
 *
 * @param {string} resultId - The evaluation result ID
 * @param {Object} evaluation - Holistic tutor evaluation data
 * @param {Object} evaluation.holisticScores - Per-dimension holistic scores (JSON-serializable)
 * @param {number} evaluation.holisticOverallScore - Weighted overall (0-100)
 * @param {string} [evaluation.holisticSummary] - Judge narrative summary
 * @param {string} [evaluation.holisticJudgeModel] - Model used for holistic judging
 */
/**
 * Persist charisma rubric scores for a single evaluation row.
 * Used by scripts/evaluate-charisma.js (cells 101/102 + any back-fill of
 * earlier cells for cross-rubric comparison).
 *
 * @param {string} resultId
 * @param {Object} evaluation
 * @param {Object} evaluation.charismaScores - per-dimension scores
 * @param {number} evaluation.charismaOverallScore - 0-100 weighted average
 * @param {string} [evaluation.charismaSummary] - judge's brief summary
 * @param {string} [evaluation.charismaJudgeModel] - judge model label
 */
export function updateResultTutorCharismaScores(resultId, evaluation) {
  const recordAudit = withAuditTrail(
    resultId,
    [
      'tutor_charisma_scores',
      'tutor_charisma_overall_score',
      'tutor_charisma_rubric_version',
      'tutor_charisma_judge_model',
    ],
    'updateResultTutorCharismaScores',
    {
      judgeModel: evaluation.charismaJudgeModel,
      rubricVersion: getCharismaRubricVersion(),
    },
  );

  const stmt = db.prepare(`
    UPDATE evaluation_results SET
      tutor_charisma_scores = ?,
      tutor_charisma_overall_score = ?,
      tutor_charisma_rubric_version = ?,
      tutor_charisma_judge_model = ?
    WHERE id = ?
  `);

  stmt.run(
    evaluation.charismaScores ? JSON.stringify(evaluation.charismaScores) : null,
    evaluation.charismaOverallScore ?? null,
    getCharismaRubricVersion(),
    evaluation.charismaJudgeModel || null,
    resultId,
  );

  recordAudit();
}

export function updateResultTutorRegisterScore(resultId, evaluation) {
  const registerName = String(evaluation.register || '').trim();
  const sliceKey = String(evaluation.sliceKey || '').trim();
  if (!registerName) throw new Error('updateResultTutorRegisterScore requires evaluation.register');
  if (!sliceKey) throw new Error('updateResultTutorRegisterScore requires evaluation.sliceKey');

  const recordAudit = withAuditTrail(resultId, ['tutor_register_scores'], 'updateResultTutorRegisterScore', {
    judgeModel: evaluation.judgeModel,
    rubricVersion: evaluation.rubricVersion,
  });

  const current = db.prepare(`SELECT tutor_register_scores FROM evaluation_results WHERE id = ?`).get(resultId);
  let payload = {};
  if (current?.tutor_register_scores) {
    try {
      payload = JSON.parse(current.tutor_register_scores) || {};
    } catch {
      payload = {};
    }
  }

  payload[registerName] = payload[registerName] || {};
  payload[registerName][sliceKey] = {
    scores: evaluation.scores || null,
    overall: evaluation.overall ?? null,
    summary: evaluation.summary || null,
    rubric_version: evaluation.rubricVersion || null,
    rubric_path: evaluation.rubricPath || null,
    judge_model: evaluation.judgeModel || null,
    guardrail_adjustments: evaluation.guardrailAdjustments || [],
    slice_ref: evaluation.sliceRef || null,
    scored_at: evaluation.scoredAt || new Date().toISOString(),
  };

  const stmt = db.prepare(`UPDATE evaluation_results SET tutor_register_scores = ? WHERE id = ?`);
  stmt.run(JSON.stringify(payload), resultId);

  recordAudit();
}

// Backfill the id-director per-turn construction envelope onto an existing
// row. Stored as JSON (array of { turn, construction, tutorText } records, or
// the legacy single-turn shape). Used by id-director cells (101-109) and the
// trap-pilot adapter (scripts/run-id-director-trap-pilot.js).
export function setIdConstructionTrace(resultId, trace) {
  const stmt = db.prepare(`UPDATE evaluation_results SET id_construction_trace = ? WHERE id = ?`);
  stmt.run(trace == null ? null : JSON.stringify(trace), resultId);
}

export function updateResultTutorHolisticScores(resultId, evaluation) {
  const recordAudit = withAuditTrail(
    resultId,
    [
      'tutor_holistic_scores',
      'tutor_holistic_overall_score',
      'tutor_holistic_summary',
      'tutor_holistic_judge_model',
      'tutor_rubric_version',
    ],
    'updateResultTutorHolisticScores',
    { judgeModel: evaluation.holisticJudgeModel, rubricVersion: getTutorRubricVersion() },
  );

  const stmt = db.prepare(`
    UPDATE evaluation_results SET
      tutor_holistic_scores = ?,
      tutor_holistic_overall_score = ?,
      tutor_holistic_summary = ?,
      tutor_holistic_judge_model = ?,
      tutor_rubric_version = ?
    WHERE id = ?
  `);

  stmt.run(
    evaluation.holisticScores ? JSON.stringify(evaluation.holisticScores) : null,
    evaluation.holisticOverallScore ?? null,
    evaluation.holisticSummary || null,
    evaluation.holisticJudgeModel || null,
    getTutorRubricVersion(),
    resultId,
  );

  recordAudit();
}

/**
 * List all interaction evaluations for a given run ID.
 *
 * @param {string} runId - The run ID
 * @returns {Array} Array of interaction evaluation objects
 */
export function listInteractionEvalsByRunId(runId) {
  const stmt = db.prepare('SELECT * FROM interaction_evaluations WHERE run_id = ? ORDER BY created_at');
  const rows = stmt.all(runId);

  return rows.map((row) => ({
    evalId: row.id,
    runId: row.run_id,
    scenarioId: row.scenario_id,
    scenarioName: row.scenario_name,
    evalType: row.eval_type,
    learnerProfile: row.learner_profile,
    tutorProfile: row.tutor_profile,
    personaId: row.persona_id,
    learnerAgents: JSON.parse(row.learner_agents || '[]'),
    turnCount: row.turn_count,
    turns: JSON.parse(row.turns || '[]'),
    formattedTranscript: row.formatted_transcript,
    totalTokens: row.total_tokens,
    finalLearnerState: row.final_learner_state,
    finalUnderstanding: row.final_understanding,
    judgeOverallScore: row.judge_overall_score,
    learnerScores: JSON.parse(row.learner_scores || 'null'),
    learnerOverallScore: row.learner_overall_score,
    learnerJudgeModel: row.learner_judge_model,
    learnerHolisticScores: JSON.parse(row.learner_holistic_scores || 'null'),
    learnerHolisticOverallScore: row.learner_holistic_overall_score,
    learnerHolisticSummary: row.learner_holistic_summary,
    learnerHolisticJudgeModel: row.learner_holistic_judge_model,
    createdAt: row.created_at,
  }));
}

/**
 * Update learner-side evaluation scores for an interaction evaluation.
 *
 * @param {string} evalId - The interaction evaluation ID
 * @param {Object} evaluation - Learner evaluation data
 * @param {Object} evaluation.scores - Per-turn scores: { turnIndex: { dimension: {score, reasoning} } }
 * @param {number} evaluation.overallScore - Weighted average learner score (0-100)
 * @param {string} evaluation.judgeModel - Model used for judging
 * @param {Object} [evaluation.holisticScores] - Dialogue-level learner rubric scores
 * @param {number} [evaluation.holisticOverallScore] - Dialogue-level learner score (0-100)
 * @param {string} [evaluation.holisticSummary] - Judge summary for dialogue-level score
 * @param {string} [evaluation.holisticJudgeModel] - Model used for holistic learner judging
 */
export function updateInteractionLearnerScores(evalId, evaluation) {
  const stmt = db.prepare(`
    UPDATE interaction_evaluations
    SET learner_scores = ?,
        learner_overall_score = ?,
        learner_judge_model = ?,
        learner_holistic_scores = ?,
        learner_holistic_overall_score = ?,
        learner_holistic_summary = ?,
        learner_holistic_judge_model = ?
    WHERE id = ?
  `);

  stmt.run(
    JSON.stringify(evaluation.scores ?? null),
    evaluation.overallScore ?? null,
    evaluation.judgeModel || null,
    evaluation.holisticScores ? JSON.stringify(evaluation.holisticScores) : null,
    evaluation.holisticOverallScore ?? null,
    evaluation.holisticSummary || null,
    evaluation.holisticJudgeModel || null,
    evalId,
  );
}

// ── Dialogue log loading ───────────────────────────────────────────────────

const DIALOGUE_LOGS_DIR = path.join(LOGS_ROOT, 'tutor-dialogues');

/**
 * Load a dialogue log file from disk by its dialogueId.
 *
 * Uses a hybrid lookup strategy: tries the exact path first
 * (`{dialogueId}.json`), then falls back to a partial-match scan of the
 * logs directory.  Returns the parsed JSON object, or null if the file
 * cannot be found or parsed.
 *
 * @param {string} dialogueId - The dialogue identifier (e.g. "dialogue-1771310299522-ys1c3i")
 * @returns {{ [key: string]: any } | null} Parsed dialogue log, or null
 */
export function loadDialogueLog(dialogueId) {
  if (!dialogueId) return null;

  // 1. Try exact path
  const direct = path.join(DIALOGUE_LOGS_DIR, `${dialogueId}.json`);
  if (fs.existsSync(direct)) {
    try {
      return JSON.parse(fs.readFileSync(direct, 'utf-8'));
    } catch {
      return null;
    }
  }

  // 2. Fallback: partial-match scan (handles legacy naming)
  let files;
  try {
    files = fs.readdirSync(DIALOGUE_LOGS_DIR).filter((f) => f.includes(dialogueId) && f.endsWith('.json'));
  } catch {
    return null; // directory doesn't exist
  }
  if (files.length === 0) return null;

  try {
    return JSON.parse(fs.readFileSync(path.join(DIALOGUE_LOGS_DIR, files[0]), 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Load a dialogue log from the content-addressed (immutable) copy.
 * Phase 3a: hash-named files are the write-once evidence snapshot.
 * Returns { log, verified } where verified indicates the content matches the hash filename.
 */
export function loadImmutableDialogueLog(contentHash) {
  if (!contentHash) return { log: null, verified: false };

  const hashPath = path.join(DIALOGUE_LOGS_DIR, `${contentHash}.json`);
  if (!fs.existsSync(hashPath)) return { log: null, verified: false };

  try {
    const content = fs.readFileSync(hashPath, 'utf-8');
    const log = JSON.parse(content);
    // Verify content matches filename hash
    const recomputed = createHash('sha256')
      .update(JSON.stringify(log, null, 2))
      .digest('hex');
    return { log, verified: recomputed === contentHash };
  } catch {
    return { log: null, verified: false };
  }
}

export default {
  createRun,
  updateRun,
  storeResult,
  setIdConstructionTrace,
  storeRejudgment,
  updateResultScores,
  updateTutorLastTurnScore,
  updateDialogueQualityScore,
  updateDialogueQualityInternalScore,
  updateTutorDeliberationScores,
  updateLearnerDeliberationScores,
  updateResultLearnerScores,
  updateResultTutorHolisticScores,
  getRun,
  listRuns,
  getResults,
  getRunStats,
  getScenarioStats,
  compareConfigs,
  exportToJson,
  exportToCsv,
  deleteRun,
  completeRun,
  findIncompleteRuns,
  autoCompleteStaleRuns,
  getIncompleteTests,
  getFactorialCellData,
  // Interaction evaluations
  storeInteractionEval,
  listInteractionEvals,
  listInteractionEvalsByRunId,
  getInteractionEval,
  getInteractionEvalByRunId,
  updateInteractionLearnerScores,
  // Process measures
  updateProcessMeasures,
  // Dialogue log loading
  loadDialogueLog,
  loadImmutableDialogueLog,
  // Rubric version comparison
  getResultById,
  generationIdentity,
  cloneRowsForRubricVersion,
  // P0 Provenance
  getScoreAudit,
  getScoreAuditByRun,
};
