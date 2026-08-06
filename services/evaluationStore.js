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
import { createInteractionRepository } from './evaluationStore/interactionRepository.js';
import { migrateEvaluationDatabase } from './evaluationStore/migrations.js';
import { createResultRepository } from './evaluationStore/resultRepository.js';
import { createRunRepository } from './evaluationStore/runRepository.js';
import { createScoreRepository } from './evaluationStore/scoreRepository.js';
import { createStatisticsRepository } from './evaluationStore/statisticsRepository.js';

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

function expectedTestsForRun(run) {
  if (Number.isInteger(run?.totalTests) && run.totalTests > 0) return run.totalTests;
  const runsPerConfig = Number(run?.metadata?.runsPerConfig) || 1;
  return (run?.totalScenarios || 0) * (run?.totalConfigurations || 0) * runsPerConfig;
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
const scoreRepository = createScoreRepository({
  db,
  getTutorRubricVersion,
  getLearnerRubricVersion,
  getDialogueRubricVersion,
  getDeliberationRubricVersion,
  getCharismaRubricVersion,
});
const interactionRepository = createInteractionRepository({ db });
const statisticsRepository = createStatisticsRepository({
  db,
  getResults: (...args) => resultRepository.getResults(...args),
  getRun: (...args) => runRepository.getRun(...args),
  readProgressLog,
  uniqueGenerationResults: (...args) => resultRepository.uniqueGenerationResults(...args),
  getScenario,
  getTutorProfile,
  resolveModel,
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

export const getScoreAudit = scoreRepository.getScoreAudit;
export const getScoreAuditByRun = scoreRepository.getScoreAuditByRun;
export const updateResultScores = scoreRepository.updateResultScores;
export const updateTutorLastTurnScore = scoreRepository.updateTutorLastTurnScore;
export const updateDialogueQualityScore = scoreRepository.updateDialogueQualityScore;
export const updateDialogueQualityInternalScore = scoreRepository.updateDialogueQualityInternalScore;
export const updateTutorDeliberationScores = scoreRepository.updateTutorDeliberationScores;
export const updateLearnerDeliberationScores = scoreRepository.updateLearnerDeliberationScores;
export const updateProcessMeasures = scoreRepository.updateProcessMeasures;
export const updateResultLearnerScores = scoreRepository.updateResultLearnerScores;
export const updateResultTutorScores = scoreRepository.updateResultTutorScores;
export const updateResultTutorCharismaScores = scoreRepository.updateResultTutorCharismaScores;
export const updateResultTutorRegisterScore = scoreRepository.updateResultTutorRegisterScore;
export const setIdConstructionTrace = scoreRepository.setIdConstructionTrace;
export const updateResultTutorHolisticScores = scoreRepository.updateResultTutorHolisticScores;
export const storeInteractionEval = interactionRepository.storeInteractionEval;
export const listInteractionEvals = interactionRepository.listInteractionEvals;
export const getInteractionEval = interactionRepository.getInteractionEval;
export const getInteractionEvalByRunId = interactionRepository.getInteractionEvalByRunId;
export const listInteractionEvalsByRunId = interactionRepository.listInteractionEvalsByRunId;
export const updateInteractionLearnerScores = interactionRepository.updateInteractionLearnerScores;
export const getRunStats = statisticsRepository.getRunStats;
export const getScenarioStats = statisticsRepository.getScenarioStats;
export const compareConfigs = statisticsRepository.compareConfigs;
export const getFactorialCellData = statisticsRepository.getFactorialCellData;

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
