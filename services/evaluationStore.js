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
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes, createHash } from 'crypto';
import { isPidAlive } from './processUtils.js';
import { getScenario, getTutorProfile, loadRubric, resolveModel } from './evalConfigLoader.js';
import { readProgressLog } from './progressLogger.js';
import { loadTutorHolisticRubric, loadDialogueRubric, loadDeliberationRubric } from './rubricEvaluator.js';
import { loadLearnerRubric } from './learnerRubricEvaluator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

// Initialize database — override with EVAL_DB_PATH env var for test isolation
const dbPath = process.env.EVAL_DB_PATH || path.join(DATA_DIR, 'evaluations.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

// Migrate: rename evaluator_model → judge_model if the old column exists
try {
  const cols = db
    .prepare('PRAGMA table_info(evaluation_results)')
    .all()
    .map((c) => c.name);
  if (cols.includes('evaluator_model') && !cols.includes('judge_model')) {
    db.exec('ALTER TABLE evaluation_results RENAME COLUMN evaluator_model TO judge_model');
  }
} catch (e) {
  // Table may not exist yet (first run)
}

// Create tables
db.exec(`
  -- Evaluation runs (batches of tests)
  CREATE TABLE IF NOT EXISTS evaluation_runs (
    id TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    total_scenarios INTEGER DEFAULT 0,
    total_configurations INTEGER DEFAULT 0,
    total_tests INTEGER DEFAULT 0,
    status TEXT DEFAULT 'running',
    completed_at DATETIME,
    metadata TEXT  -- JSON
  );

  -- Individual evaluation results
  CREATE TABLE IF NOT EXISTS evaluation_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT REFERENCES evaluation_runs(id),
    scenario_id TEXT NOT NULL,
    scenario_name TEXT,

    -- Configuration
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    profile_name TEXT,
    hyperparameters TEXT,  -- JSON
    prompt_id TEXT,

    -- Raw output
    suggestions TEXT,      -- JSON array
    raw_response TEXT,

    -- Performance metrics
    latency_ms INTEGER,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost REAL,             -- OpenRouter API cost in USD
    dialogue_rounds INTEGER,
    api_calls INTEGER,
    dialogue_id TEXT,      -- For linking to dialogue logs

    -- Rubric scores (1-5 scale)
    score_relevance REAL,
    score_specificity REAL,
    score_pedagogical REAL,
    score_personalization REAL,
    score_actionability REAL,
    score_tone REAL,
    overall_score REAL,

    -- Validation
    passes_required BOOLEAN,
    passes_forbidden BOOLEAN,
    required_missing TEXT,   -- JSON array
    forbidden_found TEXT,    -- JSON array

    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    judge_model TEXT,
    evaluation_reasoning TEXT,
    success BOOLEAN DEFAULT 1,
    error_message TEXT
  );

  -- Indexes for efficient querying
  CREATE INDEX IF NOT EXISTS idx_results_run ON evaluation_results(run_id);
  CREATE INDEX IF NOT EXISTS idx_results_scenario ON evaluation_results(scenario_id);
  CREATE INDEX IF NOT EXISTS idx_results_provider ON evaluation_results(provider, model);
  CREATE INDEX IF NOT EXISTS idx_results_created ON evaluation_results(created_at);
  CREATE INDEX IF NOT EXISTS idx_runs_created ON evaluation_runs(created_at);
`);

// Helper: run idempotent ALTER TABLE migration, only ignoring "already exists" errors
function migrateAddColumn(sql, description) {
  try {
    db.exec(sql);
  } catch (e) {
    if (e.message && e.message.includes('duplicate column name')) return;
    if (e.message && e.message.includes('already exists')) return;
    console.error(`[evaluationStore] Migration failed (${description}):`, e.message);
    throw e;
  }
}

// Migrations: Add columns to evaluation_results
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN dialogue_id TEXT`, 'dialogue_id');
db.exec(`CREATE INDEX IF NOT EXISTS idx_results_dialogue ON evaluation_results(dialogue_id)`);
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN scenario_type TEXT DEFAULT 'suggestion'`, 'scenario_type');
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN scores_with_reasoning TEXT`, 'scores_with_reasoning');
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN cost REAL`, 'cost');
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN base_score REAL`, 'base_score');
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN recognition_score REAL`, 'recognition_score');
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN ego_model TEXT`, 'ego_model');
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN superego_model TEXT`, 'superego_model');
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN factor_recognition BOOLEAN`, 'factor_recognition');
migrateAddColumn(
  `ALTER TABLE evaluation_results ADD COLUMN factor_multi_agent_tutor BOOLEAN`,
  'factor_multi_agent_tutor',
);
migrateAddColumn(
  `ALTER TABLE evaluation_results ADD COLUMN factor_multi_agent_learner BOOLEAN`,
  'factor_multi_agent_learner',
);
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN learner_architecture TEXT`, 'learner_architecture');
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN scoring_method TEXT`, 'scoring_method');
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN learner_scores TEXT`, 'learner_scores');
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN learner_overall_score REAL`, 'learner_overall_score');
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN learner_judge_model TEXT`, 'learner_judge_model');
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN learner_holistic_scores TEXT`, 'learner_holistic_scores');
migrateAddColumn(
  `ALTER TABLE evaluation_results ADD COLUMN learner_holistic_overall_score REAL`,
  'learner_holistic_overall_score',
);
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN learner_holistic_summary TEXT`, 'learner_holistic_summary');
migrateAddColumn(
  `ALTER TABLE evaluation_results ADD COLUMN learner_holistic_judge_model TEXT`,
  'learner_holistic_judge_model',
);
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN judge_latency_ms INTEGER`, 'judge_latency_ms');
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN holistic_overall_score REAL`, 'holistic_overall_score');

// Rename: overall_score → tutor_first_turn_score (keep overall_score as deprecated alias)
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN tutor_first_turn_score REAL`, 'tutor_first_turn_score');
// Backfill tutor_first_turn_score from overall_score for existing rows
try {
  db.exec(
    `UPDATE evaluation_results SET tutor_first_turn_score = overall_score WHERE tutor_first_turn_score IS NULL AND overall_score IS NOT NULL`,
  );
} catch (e) {
  // Ignore if column doesn't exist yet
}

// Dialogue scoring columns (multi-turn evaluation redesign)
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN tutor_last_turn_score REAL`, 'tutor_last_turn_score');
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN tutor_development_score REAL`, 'tutor_development_score');
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN dialogue_quality_score REAL`, 'dialogue_quality_score');
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN dialogue_quality_summary TEXT`, 'dialogue_quality_summary');
migrateAddColumn(
  `ALTER TABLE evaluation_results ADD COLUMN dialogue_quality_judge_model TEXT`,
  'dialogue_quality_judge_model',
);
// Internal (full-trace) dialogue quality columns — separate from public-transcript score
migrateAddColumn(
  `ALTER TABLE evaluation_results ADD COLUMN dialogue_quality_internal_score REAL`,
  'dialogue_quality_internal_score',
);
migrateAddColumn(
  `ALTER TABLE evaluation_results ADD COLUMN dialogue_quality_internal_summary TEXT`,
  'dialogue_quality_internal_summary',
);

// Conversation mode: 'single-prompt' | 'messages' (how tutor context was delivered)
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN conversation_mode TEXT`, 'conversation_mode');

// Holistic tutor evaluation (full-dialogue trajectory — mirrors learner holistic)
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN tutor_holistic_scores TEXT`, 'tutor_holistic_scores');
migrateAddColumn(
  `ALTER TABLE evaluation_results ADD COLUMN tutor_holistic_overall_score REAL`,
  'tutor_holistic_overall_score',
);
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN tutor_holistic_summary TEXT`, 'tutor_holistic_summary');
migrateAddColumn(
  `ALTER TABLE evaluation_results ADD COLUMN tutor_holistic_judge_model TEXT`,
  'tutor_holistic_judge_model',
);

// Per-turn tutor scores (unified scoring pipeline)
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN tutor_scores TEXT`, 'tutor_scores');
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN tutor_overall_score REAL`, 'tutor_overall_score');

// Deliberation quality columns (ego/superego process scoring — multi-agent only)
migrateAddColumn(
  `ALTER TABLE evaluation_results ADD COLUMN tutor_deliberation_scores TEXT`,
  'tutor_deliberation_scores',
);
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN tutor_deliberation_score REAL`, 'tutor_deliberation_score');
migrateAddColumn(
  `ALTER TABLE evaluation_results ADD COLUMN tutor_deliberation_summary TEXT`,
  'tutor_deliberation_summary',
);
migrateAddColumn(
  `ALTER TABLE evaluation_results ADD COLUMN tutor_deliberation_judge_model TEXT`,
  'tutor_deliberation_judge_model',
);
migrateAddColumn(
  `ALTER TABLE evaluation_results ADD COLUMN learner_deliberation_scores TEXT`,
  'learner_deliberation_scores',
);
migrateAddColumn(
  `ALTER TABLE evaluation_results ADD COLUMN learner_deliberation_score REAL`,
  'learner_deliberation_score',
);
migrateAddColumn(
  `ALTER TABLE evaluation_results ADD COLUMN learner_deliberation_summary TEXT`,
  'learner_deliberation_summary',
);
migrateAddColumn(
  `ALTER TABLE evaluation_results ADD COLUMN learner_deliberation_judge_model TEXT`,
  'learner_deliberation_judge_model',
);
migrateAddColumn(
  `ALTER TABLE evaluation_results ADD COLUMN deliberation_rubric_version TEXT`,
  'deliberation_rubric_version',
);

// Process measures from dialogue logs (turnComparisonAnalyzer + dialogueTraceAnalyzer)
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN adaptation_index REAL`, 'adaptation_index');
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN learner_growth_index REAL`, 'learner_growth_index');
migrateAddColumn(
  `ALTER TABLE evaluation_results ADD COLUMN bilateral_transformation_index REAL`,
  'bilateral_transformation_index',
);
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN incorporation_rate REAL`, 'incorporation_rate');
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN dimension_convergence REAL`, 'dimension_convergence');
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN transformation_quality REAL`, 'transformation_quality');

// Rubric version tracking (auto-resolved from YAML at write time)
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN tutor_rubric_version TEXT`, 'tutor_rubric_version');
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN learner_rubric_version TEXT`, 'learner_rubric_version');
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN dialogue_rubric_version TEXT`, 'dialogue_rubric_version');

// Deliberation rounds: cumulative ego-superego cycles across all conversation turns
// (split from dialogue_rounds which now stores conversation turn count)
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN deliberation_rounds INTEGER`, 'deliberation_rounds');

// P0 Provenance: dialogue content hash (SHA-256 of dialogue log JSON at write time)
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN dialogue_content_hash TEXT`, 'dialogue_content_hash');

// P1c Provenance: config snapshot hash (SHA-256 of resolved cell config at generation time)
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN config_hash TEXT`, 'config_hash');

// Prompt versioning: track which prompt versions produced each row
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN tutor_ego_prompt_version TEXT`, 'tutor_ego_prompt_version');
migrateAddColumn(
  `ALTER TABLE evaluation_results ADD COLUMN tutor_superego_prompt_version TEXT`,
  'tutor_superego_prompt_version',
);
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN learner_prompt_version TEXT`, 'learner_prompt_version');
migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN prompt_content_hash TEXT`, 'prompt_content_hash');

// P0 Provenance: score audit trail (append-only)
db.exec(`
  CREATE TABLE IF NOT EXISTS score_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    result_id TEXT NOT NULL,
    column_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    operation TEXT NOT NULL,
    judge_model TEXT,
    rubric_version TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_score_audit_result ON score_audit(result_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_score_audit_timestamp ON score_audit(timestamp)`);

// Migrations: Add columns to evaluation_runs
migrateAddColumn(`ALTER TABLE evaluation_runs ADD COLUMN git_commit TEXT`, 'git_commit');
migrateAddColumn(`ALTER TABLE evaluation_runs ADD COLUMN package_version TEXT`, 'package_version');

// Migration: Revert any accidental renames (batch→matrix, interact→interaction)
try {
  const revertRuns = db.prepare(`
    UPDATE evaluation_runs
    SET metadata = REPLACE(REPLACE(metadata, '"runType":"batch"', '"runType":"matrix"'), '"runType":"interact"', '"runType":"interaction"')
    WHERE metadata LIKE '%"runType":"batch"%' OR metadata LIKE '%"runType":"interact"%'
  `);
  revertRuns.run();
} catch (e) {
  if (!(e.message && e.message.includes('no such column'))) {
    console.error('[evaluationStore] Migration failed (revert renames):', e.message);
    throw e;
  }
}

// Create interaction evaluation tables
db.exec(`
  -- Interaction evaluation results (learner-tutor dialogues)
  CREATE TABLE IF NOT EXISTS interaction_evaluations (
    id TEXT PRIMARY KEY,
    run_id TEXT REFERENCES evaluation_runs(id),
    scenario_id TEXT NOT NULL,
    scenario_name TEXT,
    eval_type TEXT DEFAULT 'short_term',

    -- Configuration
    learner_profile TEXT,
    tutor_profile TEXT,
    persona_id TEXT,
    learner_agents TEXT,  -- JSON array of agent roles

    -- Interaction data
    turn_count INTEGER,
    turns TEXT,           -- JSON array of turn objects
    sequence_diagram TEXT,
    formatted_transcript TEXT,

    -- Memory snapshots
    learner_memory_before TEXT,  -- JSON
    learner_memory_after TEXT,   -- JSON
    tutor_memory_before TEXT,    -- JSON
    tutor_memory_after TEXT,     -- JSON

    -- Metrics
    total_tokens INTEGER,
    learner_tokens INTEGER,
    tutor_tokens INTEGER,
    latency_ms INTEGER,

    -- Outcomes
    final_learner_state TEXT,
    final_understanding TEXT,
    unique_outcomes TEXT,  -- JSON array

    -- Judge evaluation
    judge_overall_score REAL,
    judge_evaluation TEXT,  -- JSON

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_interaction_run ON interaction_evaluations(run_id);
  CREATE INDEX IF NOT EXISTS idx_interaction_scenario ON interaction_evaluations(scenario_id);
  CREATE INDEX IF NOT EXISTS idx_interaction_created ON interaction_evaluations(created_at);
`);

// Migration: Add learner-side evaluation columns to interaction_evaluations
try {
  db.exec(`ALTER TABLE interaction_evaluations ADD COLUMN learner_scores TEXT`);
} catch (e) {
  /* Column already exists */
}
try {
  db.exec(`ALTER TABLE interaction_evaluations ADD COLUMN learner_overall_score REAL`);
} catch (e) {
  /* Column already exists */
}
try {
  db.exec(`ALTER TABLE interaction_evaluations ADD COLUMN learner_judge_model TEXT`);
} catch (e) {
  /* Column already exists */
}
try {
  db.exec(`ALTER TABLE interaction_evaluations ADD COLUMN learner_holistic_scores TEXT`);
} catch (e) {
  /* Column already exists */
}
try {
  db.exec(`ALTER TABLE interaction_evaluations ADD COLUMN learner_holistic_overall_score REAL`);
} catch (e) {
  /* Column already exists */
}
try {
  db.exec(`ALTER TABLE interaction_evaluations ADD COLUMN learner_holistic_summary TEXT`);
} catch (e) {
  /* Column already exists */
}
try {
  db.exec(`ALTER TABLE interaction_evaluations ADD COLUMN learner_holistic_judge_model TEXT`);
} catch (e) {
  /* Column already exists */
}

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

/**
 * Create a new evaluation run
 *
 * @param {Object} options - Run options
 * @returns {Object} Created run
 */
export function createRun(options = {}) {
  const { description = null, totalScenarios = 0, totalConfigurations = 0, metadata = {} } = options;

  const id = generateRunId();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO evaluation_runs (id, created_at, description, total_scenarios, total_configurations, metadata, git_commit, package_version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    now,
    description,
    totalScenarios,
    totalConfigurations,
    JSON.stringify(metadata),
    metadata.gitCommit || null,
    metadata.packageVersion || null,
  );

  return {
    id,
    description,
    totalScenarios,
    totalConfigurations,
    status: 'running',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Update a run's status
 */
export function updateRun(runId, updates) {
  const { status, totalTests, completedAt, metadata } = updates;

  // If metadata provided, merge with existing
  if (metadata) {
    const existing = getRun(runId);
    const mergedMetadata = { ...(existing?.metadata || {}), ...metadata };
    const stmt = db.prepare(`UPDATE evaluation_runs SET metadata = ? WHERE id = ?`);
    stmt.run(JSON.stringify(mergedMetadata), runId);
  }

  if (status === 'completed') {
    const stmt = db.prepare(`
      UPDATE evaluation_runs
      SET status = ?, completed_at = ?
      WHERE id = ?
    `);
    stmt.run(status, completedAt || new Date().toISOString(), runId);
  } else if (status && totalTests != null) {
    const stmt = db.prepare(`
      UPDATE evaluation_runs SET status = ?, total_tests = ? WHERE id = ?
    `);
    stmt.run(status, totalTests, runId);
  } else if (status) {
    const stmt = db.prepare(`
      UPDATE evaluation_runs SET status = ? WHERE id = ?
    `);
    stmt.run(status, runId);
  }
}

/**
 * Store an individual evaluation result
 *
 * @param {string} runId - The run ID
 * @param {Object} result - The evaluation result
 * @returns {number} Inserted row ID
 */
export function storeResult(runId, result) {
  const stmt = db.prepare(`
    INSERT INTO evaluation_results (
      run_id, scenario_id, scenario_name, scenario_type,
      provider, model, profile_name, hyperparameters, prompt_id,
      ego_model, superego_model,
      suggestions, raw_response,
      latency_ms, input_tokens, output_tokens, cost, dialogue_rounds, deliberation_rounds, api_calls, dialogue_id,
      score_relevance, score_specificity, score_pedagogical,
      score_personalization, score_actionability, score_tone, overall_score, tutor_first_turn_score,
      base_score, recognition_score,
      passes_required, passes_forbidden, required_missing, forbidden_found,
      judge_model, evaluation_reasoning, scores_with_reasoning, success, error_message,
      factor_recognition, factor_multi_agent_tutor, factor_multi_agent_learner, learner_architecture,
      scoring_method,
      conversation_mode,
      dialogue_content_hash,
      config_hash,
      tutor_ego_prompt_version,
      tutor_superego_prompt_version,
      learner_prompt_version,
      prompt_content_hash,
      created_at
    ) VALUES (
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?,
      ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?,
      ?,
      ?,
      ?,
      ?, ?, ?, ?,
      ?
    )
  `);

  const info = stmt.run(
    runId,
    result.scenarioId,
    result.scenarioName,
    result.scenarioType || 'suggestion',
    result.provider,
    result.model,
    result.profileName,
    JSON.stringify(result.hyperparameters || {}),
    result.promptId,
    result.egoModel || null,
    result.superegoModel || null,
    JSON.stringify(result.suggestions || []),
    result.rawResponse,
    result.latencyMs,
    result.inputTokens,
    result.outputTokens,
    result.cost,
    result.dialogueRounds,
    result.deliberationRounds ?? null,
    result.apiCalls,
    result.dialogueId,
    result.scores?.relevance,
    result.scores?.specificity,
    result.scores?.pedagogical,
    result.scores?.personalization,
    result.scores?.actionability,
    result.scores?.tone,
    result.tutorFirstTurnScore ?? result.overallScore ?? null,
    result.tutorFirstTurnScore ?? result.overallScore ?? null, // tutor_first_turn_score (same value, synced)
    result.baseScore,
    result.recognitionScore,
    result.passesRequired ? 1 : 0,
    result.passesForbidden ? 1 : 0,
    JSON.stringify(result.requiredMissing || []),
    JSON.stringify(result.forbiddenFound || []),
    result.judgeModel,
    result.evaluationReasoning,
    result.scoresWithReasoning ? JSON.stringify(result.scoresWithReasoning) : null,
    result.success ? 1 : 0,
    result.errorMessage,
    result.factors?.recognition != null ? (result.factors.recognition ? 1 : 0) : null,
    result.factors?.multi_agent_tutor != null ? (result.factors.multi_agent_tutor ? 1 : 0) : null,
    result.factors?.multi_agent_learner != null ? (result.factors.multi_agent_learner ? 1 : 0) : null,
    result.learnerArchitecture || null,
    result.scoringMethod || null,
    result.conversationMode || null,
    result.dialogueContentHash || null,
    result.configHash || null,
    result.tutorEgoPromptVersion || null,
    result.tutorSuperegoPromptVersion || null,
    result.learnerPromptVersion || null,
    result.promptContentHash || null,
    new Date().toISOString(),
  );

  return info.lastInsertRowid;
}

/**
 * Get a run by ID
 */
export function getRun(runId) {
  const stmt = db.prepare('SELECT * FROM evaluation_runs WHERE id = ?');
  const row = stmt.get(runId);
  if (!row) return null;

  return {
    id: row.id,
    createdAt: row.created_at,
    description: row.description,
    totalScenarios: row.total_scenarios,
    totalConfigurations: row.total_configurations,
    totalTests: row.total_tests,
    status: row.status,
    completedAt: row.completed_at,
    metadata: JSON.parse(row.metadata || '{}'),
    gitCommit: row.git_commit,
    packageVersion: row.package_version,
  };
}

/**
 * List all runs with scenario names
 */
export function listRuns(options = {}) {
  const { limit = null, status = null } = options;

  let query = 'SELECT * FROM evaluation_runs';
  const params = [];

  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';
  if (limit) {
    query += ' LIMIT ?';
    params.push(limit);
  }

  const stmt = db.prepare(query);
  const rows = stmt.all(...params);

  // Get distinct scenario names for each run
  const scenarioStmt = db.prepare(`
    SELECT DISTINCT scenario_name FROM evaluation_results
    WHERE run_id = ? AND scenario_name IS NOT NULL
    ORDER BY scenario_name
  `);

  // Count completed results per run (primary judge only to avoid inflated counts from rejudging)
  const resultCountStmt = db.prepare(`
    SELECT COUNT(*) as completed,
           SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
           AVG(COALESCE(tutor_overall_score, tutor_first_turn_score, overall_score)) as avg_score,
           AVG(tutor_holistic_overall_score) as avg_tutor_holistic_score,
           AVG(learner_overall_score) as avg_learner_score,
           AVG(learner_holistic_overall_score) as avg_learner_holistic_score,
           AVG(dialogue_quality_score) as avg_dialogue_score,
           AVG(dialogue_quality_internal_score) as avg_dialogue_internal_score,
           COUNT(DISTINCT judge_model) as judge_count
    FROM evaluation_results
    WHERE run_id = ?
      AND (judge_model IS NULL OR judge_model = (
        SELECT judge_model FROM evaluation_results
        WHERE run_id = ? AND judge_model IS NOT NULL
        ORDER BY created_at ASC LIMIT 1
      ))
  `);

  // Get distinct ego + superego models for each run
  const modelStmt = db.prepare(`
    SELECT DISTINCT ego_model FROM evaluation_results
    WHERE run_id = ? AND ego_model IS NOT NULL
    ORDER BY ego_model
  `);
  const superegoModelStmt = db.prepare(`
    SELECT DISTINCT superego_model FROM evaluation_results
    WHERE run_id = ? AND superego_model IS NOT NULL
    ORDER BY superego_model
  `);

  // Get distinct profile names actually used in results
  const profileStmt = db.prepare(`
    SELECT DISTINCT profile_name FROM evaluation_results
    WHERE run_id = ? AND profile_name IS NOT NULL
    ORDER BY profile_name
  `);

  return rows.map((row) => {
    const scenarioRows = scenarioStmt.all(row.id);
    const scenarioNames = scenarioRows.map((s) => s.scenario_name).filter(Boolean);
    const counts = resultCountStmt.get(row.id, row.id);

    const extractAlias = (raw) => {
      if (!raw) return null;
      const dotIdx = raw.indexOf('.');
      return dotIdx !== -1 ? raw.slice(dotIdx + 1) : raw;
    };

    const modelRows = modelStmt.all(row.id);
    const superegoRows = superegoModelStmt.all(row.id);
    const models = [
      ...new Set(
        [
          ...modelRows.map((m) => extractAlias(m.ego_model)),
          ...superegoRows.map((m) => extractAlias(m.superego_model)),
        ].filter(Boolean),
      ),
    ];

    // Actual profile names from result rows (may differ from metadata if run was partial/resumed)
    const profileRows = profileStmt.all(row.id);
    const profileNames = profileRows.map((p) => p.profile_name).filter(Boolean);

    // Model fingerprint: 6-char hex from sorted model list (stable across runs with same models)
    const fpInput = [...models].sort().join('|');
    const modelFingerprint = fpInput ? createHash('sha256').update(fpInput).digest('hex').slice(0, 6) : null;

    const completedResults = counts?.completed || 0;
    const totalTests = row.total_tests || 0;
    const progressPct = totalTests > 0 ? Math.min(100, Math.round((completedResults / totalTests) * 100)) : null;

    // Compute duration: running status always means "elapsed so far",
    // even if completed_at is still present from a previous completed phase.
    let durationMs = null;
    if (row.created_at) {
      const start = new Date(row.created_at).getTime();
      if (row.status === 'running') {
        durationMs = Date.now() - start;
      } else if (row.completed_at) {
        durationMs = new Date(row.completed_at).getTime() - start;
      }
    }

    return {
      id: row.id,
      createdAt: row.created_at,
      description: row.description,
      totalScenarios: row.total_scenarios,
      totalConfigurations: row.total_configurations,
      totalTests,
      completedResults,
      successfulResults: counts?.successful || 0,
      avgScore: counts?.avg_score || null,
      avgTutorHolisticScore: counts?.avg_tutor_holistic_score || null,
      avgLearnerScore: counts?.avg_learner_score || null,
      avgLearnerHolisticScore: counts?.avg_learner_holistic_score || null,
      avgDialogueScore: counts?.avg_dialogue_score || null,
      avgDialogueInternalScore: counts?.avg_dialogue_internal_score || null,
      judgeCount: counts?.judge_count || 1,
      progressPct,
      durationMs,
      status: row.status,
      completedAt: row.completed_at,
      scenarioNames, // Scenario names from results
      models, // Distinct ego model aliases used
      profileNames, // Distinct profile/cell names from results
      modelFingerprint, // 6-char hex for comparing model configs across runs
      metadata: JSON.parse(row.metadata || '{}'), // Structured metadata
    };
  });
}

/**
 * Get results for a run
 */
export function getResults(runId, options = {}) {
  const { scenarioId = null, provider = null, model = null, profileName = null } = options;

  let query = 'SELECT * FROM evaluation_results WHERE run_id = ?';
  const params = [runId];

  if (scenarioId) {
    query += ' AND scenario_id = ?';
    params.push(scenarioId);
  }

  if (provider) {
    query += ' AND provider = ?';
    params.push(provider);
  }

  if (model) {
    query += ' AND model = ?';
    params.push(model);
  }

  if (profileName) {
    query += ' AND profile_name = ?';
    params.push(profileName);
  }

  query += ' ORDER BY created_at';

  const stmt = db.prepare(query);
  const rows = stmt.all(...params);

  return rows.map(parseResultRow);
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
  for (const result of results) {
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
const MANIFESTS_DIR = path.join(ROOT_DIR, 'logs', 'run-manifests');

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
        judgeModel: r.judgeModel || null,
        tutorRubricVersion: rubricVersionMap[rowIdStr] || null,
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
      expected_tests: (run.totalScenarios || 0) * (run.totalConfigurations || 0),
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

/**
 * Marks a stuck/interrupted run as completed with whatever results exist.
 * Returns summary of what was completed.
 *
 * @param {string} runId - The run ID to complete
 * @returns {Object} Completion summary
 */
export function completeRun(runId) {
  const run = getRun(runId);
  if (!run) {
    throw new Error(`Run not found: ${runId}`);
  }

  if (run.status === 'completed') {
    return {
      alreadyCompleted: true,
      runId,
      message: 'Run was already marked as completed',
    };
  }

  // Get all results for this run
  const results = getResults(runId);

  if (results.length === 0) {
    // No results at all - mark as failed
    updateRun(runId, {
      status: 'failed',
      totalTests: 0,
      completedAt: new Date().toISOString(),
    });

    return {
      runId,
      status: 'failed',
      message: 'No results found - marked as failed',
      resultsFound: 0,
      expectedTests: run.totalScenarios * run.totalConfigurations,
    };
  }

  // Find the last result timestamp
  const lastResultTime = results.reduce((latest, r) => {
    const time = new Date(r.createdAt).getTime();
    return time > latest ? time : latest;
  }, 0);

  const completedAt = new Date(lastResultTime).toISOString();

  // Update run as completed with partial results
  updateRun(runId, {
    status: 'completed',
    totalTests: results.length,
    completedAt,
  });

  // Calculate completion percentage
  const expectedTests = run.totalScenarios * run.totalConfigurations;
  const completionRate = expectedTests > 0 ? (results.length / expectedTests) * 100 : 0;

  // Get profile breakdown
  const profileBreakdown = {};
  for (const result of results) {
    const profile = result.profileName || 'unknown';
    if (!profileBreakdown[profile]) {
      profileBreakdown[profile] = 0;
    }
    profileBreakdown[profile]++;
  }

  // Phase 3c: Write run snapshot manifest
  writeRunManifest(runId, run, results, completedAt);

  return {
    runId,
    status: 'completed',
    message: 'Run marked as completed with partial results',
    resultsFound: results.length,
    expectedTests,
    completionRate: Math.round(completionRate),
    completedAt,
    profileBreakdown,
    wasPartial: results.length < expectedTests,
  };
}

/**
 * Find all incomplete (stuck) evaluation runs
 *
 * @param {Object} options - Query options
 * @returns {Array} List of incomplete runs
 */
export function findIncompleteRuns(options = {}) {
  const { olderThanMinutes = 30 } = options;

  const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000).toISOString();

  const stmt = db.prepare(`
    SELECT * FROM evaluation_runs
    WHERE status = 'running'
    AND created_at < ?
    ORDER BY created_at DESC
  `);

  const rows = stmt.all(cutoffTime);

  return rows.map((row) => {
    const resultsStmt = db.prepare('SELECT COUNT(*) as count FROM evaluation_results WHERE run_id = ?');
    const resultsCount = resultsStmt.get(row.id).count;
    const metadata = JSON.parse(row.metadata || '{}');
    const pid = metadata?.pid;

    return {
      id: row.id,
      createdAt: row.created_at,
      description: row.description,
      totalScenarios: row.total_scenarios,
      totalConfigurations: row.total_configurations,
      expectedTests: row.total_scenarios * row.total_configurations,
      resultsFound: resultsCount,
      ageMinutes: Math.round((Date.now() - new Date(row.created_at).getTime()) / 60000),
      metadata,
      pid,
      pidAlive: isPidAlive(pid),
    };
  });
}

/**
 * Auto-complete all stale runs
 *
 * Finds and completes all runs stuck in "running" state for more than the threshold.
 *
 * @param {Object} options - Options
 * @returns {Array} List of completed runs
 */
export function autoCompleteStaleRuns(options = {}) {
  const { olderThanMinutes = 30, dryRun = false } = options;

  const incompleteRuns = findIncompleteRuns({ olderThanMinutes });

  // Filter out runs whose PID is still alive
  const staleRuns = incompleteRuns.filter((run) => {
    const pid = run.metadata?.pid;
    const isAlive = isPidAlive(pid);
    if (isAlive) {
      console.log(`  Skipping ${run.id}: pid ${pid} still running`);
    }
    return !isAlive;
  });

  if (dryRun) {
    return {
      dryRun: true,
      found: incompleteRuns.length,
      stale: staleRuns.length,
      skippedAlive: incompleteRuns.length - staleRuns.length,
      runs: staleRuns,
    };
  }

  const completed = [];
  for (const run of staleRuns) {
    try {
      const result = completeRun(run.id);
      completed.push(result);
    } catch (error) {
      completed.push({
        runId: run.id,
        status: 'error',
        error: error.message,
      });
    }
  }

  return {
    found: incompleteRuns.length,
    stale: staleRuns.length,
    skippedAlive: incompleteRuns.length - staleRuns.length,
    completed: completed.length,
    runs: completed,
  };
}

/**
 * Delete a run and its results
 */
export function deleteRun(runId) {
  const deleteAudit = db.prepare(`
    DELETE FROM score_audit
    WHERE result_id IN (SELECT id FROM evaluation_results WHERE run_id = ?)
  `);
  const deleteResults = db.prepare('DELETE FROM evaluation_results WHERE run_id = ?');
  const deleteInteractionEvals = db.prepare('DELETE FROM interaction_evaluations WHERE run_id = ?');
  const deleteRun = db.prepare('DELETE FROM evaluation_runs WHERE id = ?');

  const transaction = db.transaction(() => {
    const auditInfo = deleteAudit.run(runId);
    const resultsInfo = deleteResults.run(runId);
    const interactionInfo = deleteInteractionEvals.run(runId);
    const runInfo = deleteRun.run(runId);

    return {
      deletedAuditRows: auditInfo.changes,
      deletedResults: resultsInfo.changes,
      deletedInteractionEvals: interactionInfo.changes,
      deletedRuns: runInfo.changes,
    };
  });

  return transaction();
}

/**
 * Get incomplete tests for a run to enable resumption
 *
 * Given a run ID and the expected test matrix (profiles x scenarios),
 * returns which tests have NOT been completed yet.
 *
 * @param {string} runId - The run ID
 * @param {Array} profiles - Array of profile names
 * @param {Array} scenarios - Array of scenario objects with { id, name }
 * @returns {Object} { completed, remaining, progress }
 */
export function getIncompleteTests(runId, profiles, scenarios) {
  const run = getRun(runId);
  if (!run) {
    throw new Error(`Run not found: ${runId}`);
  }

  // Get all completed tests for this run
  const results = getResults(runId);
  const completedSet = new Set();

  // Build set of completed (profile, scenarioId) pairs — only count successes
  for (const result of results) {
    if (result.success === false || result.success === 0) continue;
    const key = `${result.profileName}:${result.scenarioId}`;
    completedSet.add(key);
  }

  // Build list of all expected tests
  const allTests = [];
  const remainingTests = [];

  for (const profile of profiles) {
    for (const scenario of scenarios) {
      const testKey = `${profile}:${scenario.id}`;
      const test = {
        profile,
        scenarioId: scenario.id,
        scenarioName: scenario.name,
      };

      allTests.push(test);

      if (!completedSet.has(testKey)) {
        remainingTests.push(test);
      }
    }
  }

  const expectedCount = allTests.length;
  const completedCount = expectedCount - remainingTests.length;
  const progress = expectedCount > 0 ? (completedCount / expectedCount) * 100 : 0;

  return {
    runId,
    totalExpected: expectedCount,
    completed: completedCount,
    remaining: remainingTests.length,
    progress: Math.round(progress),
    remainingTests,
    status: run.status,
    canResume: remainingTests.length > 0 && run.status === 'running',
  };
}

/**
 * Parse a result row from the database
 */
function parseResultRow(row) {
  // Parse scoresWithReasoning if available, otherwise build from numeric scores
  let scoresWithReasoning = null;
  if (row.scores_with_reasoning) {
    try {
      scoresWithReasoning = JSON.parse(row.scores_with_reasoning);
    } catch (e) {
      // Ignore parse errors
    }
  }

  // Parse tutor_scores if available (Rubric 2.2+ per-turn scores)
  let tutorScoresJson = null;
  if (row.tutor_scores) {
    try {
      tutorScoresJson = JSON.parse(row.tutor_scores);
    } catch (e) {
      // Ignore
    }
  }

  // Build the scores object
  let scores = scoresWithReasoning;

  if (!scores && tutorScoresJson) {
    // If we have tutor_scores JSON (v2.2+), aggregate turn-level dimension scores
    // into a single dimensions object for legacy-compatible reporting.
    const turnIndices = Object.keys(tutorScoresJson);
    if (turnIndices.length > 0) {
      const dimensionSums = {};
      const dimensionCounts = {};

      for (const idx of turnIndices) {
        const turnData = tutorScoresJson[idx];
        const turnScores = turnData.scores || turnData; // Handle both wrapped and direct scores
        if (!turnScores) continue;

        for (const [dim, detail] of Object.entries(turnScores)) {
          // Skip non-score keys if we're looking at a turn object
          if (
            [
              'overallScore',
              'baseScore',
              'recognitionScore',
              'summary',
              'judgeInputHash',
              'judgeTimestamp',
              'judgeModel',
              'contentTurnId',
              'turnIndex',
            ].includes(dim)
          )
            continue;

          const val = typeof detail === 'number' ? detail : detail?.score;
          if (val != null) {
            dimensionSums[dim] = (dimensionSums[dim] || 0) + val;
            dimensionCounts[dim] = (dimensionCounts[dim] || 0) + 1;
          }
        }
      }

      const aggregated = {};
      for (const dim of Object.keys(dimensionSums)) {
        aggregated[dim] = dimensionSums[dim] / dimensionCounts[dim];
      }

      // If we found dimensions, use them
      if (Object.keys(aggregated).length > 0) {
        scores = aggregated;
      }
    }
  }

  // Fallback to legacy numeric columns if no structured scores found
  if (!scores) {
    const legacyScores = {
      relevance: row.score_relevance,
      specificity: row.score_specificity,
      pedagogical: row.score_pedagogical,
      personalization: row.score_personalization,
      actionability: row.score_actionability,
      tone: row.score_tone,
    };
    scores = Object.values(legacyScores).some((value) => value != null) ? legacyScores : null;
  }

  return {
    id: row.id,
    runId: row.run_id,
    scenarioId: row.scenario_id,
    scenarioName: row.scenario_name,
    scenarioType: row.scenario_type || 'suggestion',
    provider: row.provider,
    model: row.model,
    profileName: row.profile_name,
    egoModel: row.ego_model,
    superegoModel: row.superego_model,
    hyperparameters: JSON.parse(row.hyperparameters || '{}'),
    promptId: row.prompt_id,
    suggestions: JSON.parse(row.suggestions || '[]'),
    latencyMs: row.latency_ms,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cost: row.cost,
    dialogueRounds: row.dialogue_rounds,
    deliberationRounds: row.deliberation_rounds ?? null,
    apiCalls: row.api_calls,
    dialogueId: row.dialogue_id,
    scores,
    tutorFirstTurnScore: row.tutor_first_turn_score ?? row.overall_score ?? null,
    overallScore: row.tutor_first_turn_score ?? row.overall_score ?? null, // DEPRECATED alias
    scoringMethod: row.scoring_method || null,
    baseScore: row.base_score,
    recognitionScore: row.recognition_score,
    passesRequired: Boolean(row.passes_required),
    passesForbidden: Boolean(row.passes_forbidden),
    requiredMissing: JSON.parse(row.required_missing || '[]'),
    forbiddenFound: JSON.parse(row.forbidden_found || '[]'),
    judgeModel: row.judge_model,
    evaluationReasoning: row.evaluation_reasoning,
    success: Boolean(row.success),
    errorMessage: row.error_message,
    createdAt: row.created_at,
    factors:
      row.factor_recognition != null || row.factor_multi_agent_tutor != null || row.factor_multi_agent_learner != null
        ? {
            recognition: Boolean(row.factor_recognition),
            multi_agent_tutor: Boolean(row.factor_multi_agent_tutor),
            multi_agent_learner: Boolean(row.factor_multi_agent_learner),
          }
        : null,
    learnerArchitecture: row.learner_architecture || null,
    learnerScores: row.learner_scores ? JSON.parse(row.learner_scores) : null,
    learnerOverallScore: row.learner_overall_score != null ? row.learner_overall_score : null,
    learnerJudgeModel: row.learner_judge_model || null,
    learnerHolisticScores: row.learner_holistic_scores ? JSON.parse(row.learner_holistic_scores) : null,
    learnerHolisticOverallScore: row.learner_holistic_overall_score != null ? row.learner_holistic_overall_score : null,
    learnerHolisticSummary: row.learner_holistic_summary || null,
    learnerHolisticJudgeModel: row.learner_holistic_judge_model || null,
    // Dialogue scoring columns
    tutorLastTurnScore: row.tutor_last_turn_score != null ? row.tutor_last_turn_score : null,
    tutorDevelopmentScore: row.tutor_development_score != null ? row.tutor_development_score : null,
    dialogueQualityScore: row.dialogue_quality_score != null ? row.dialogue_quality_score : null,
    dialogueQualitySummary: row.dialogue_quality_summary || null,
    dialogueQualityJudgeModel: row.dialogue_quality_judge_model || null,
    dialogueQualityInternalScore:
      row.dialogue_quality_internal_score != null ? row.dialogue_quality_internal_score : null,
    dialogueQualityInternalSummary: row.dialogue_quality_internal_summary || null,
    conversationMode: row.conversation_mode || null,
    dialogueContentHash: row.dialogue_content_hash || null,
    configHash: row.config_hash || null,
    tutorScores: row.tutor_scores ? JSON.parse(row.tutor_scores) : null,
    tutorOverallScore: row.tutor_overall_score != null ? row.tutor_overall_score : null,
    tutorHolisticScores: row.tutor_holistic_scores ? JSON.parse(row.tutor_holistic_scores) : null,
    tutorHolisticOverallScore: row.tutor_holistic_overall_score != null ? row.tutor_holistic_overall_score : null,
    tutorHolisticSummary: row.tutor_holistic_summary || null,
    tutorHolisticJudgeModel: row.tutor_holistic_judge_model || null,
    // Prompt versioning
    tutorEgoPromptVersion: row.tutor_ego_prompt_version || null,
    tutorSuperegoPromptVersion: row.tutor_superego_prompt_version || null,
    learnerPromptVersion: row.learner_prompt_version || null,
    promptContentHash: row.prompt_content_hash || null,
  };
}

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
 * Store a new judgment row for an existing result (preserves judgment history).
 * Copies the original result's response data but adds new scores from a different judge.
 * This enables inter-judge reliability analysis.
 *
 * @param {Object} originalResult - The original result row (from getResults)
 * @param {Object} evaluation - The new evaluation scores
 * @returns {number} The new row ID
 */
export function storeRejudgment(originalResult, evaluation) {
  const stmt = db.prepare(`
    INSERT INTO evaluation_results (
      run_id, scenario_id, scenario_name, scenario_type,
      provider, model, profile_name, hyperparameters, prompt_id,
      ego_model, superego_model,
      suggestions, raw_response,
      latency_ms, input_tokens, output_tokens, cost, dialogue_rounds, deliberation_rounds, api_calls, dialogue_id,
      score_relevance, score_specificity, score_pedagogical,
      score_personalization, score_actionability, score_tone, overall_score, tutor_first_turn_score,
      base_score, recognition_score,
      passes_required, passes_forbidden, required_missing, forbidden_found,
      judge_model, evaluation_reasoning, scores_with_reasoning, success, error_message,
      factor_recognition, factor_multi_agent_tutor, factor_multi_agent_learner, learner_architecture,
      scoring_method,
      conversation_mode,
      dialogue_content_hash,
      config_hash,
      judge_latency_ms,
      tutor_rubric_version,
      tutor_ego_prompt_version,
      tutor_superego_prompt_version,
      learner_prompt_version,
      prompt_content_hash,
      created_at
    ) VALUES (
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?,
      ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?,
      ?, ?, ?,
      ?,
      ?,
      ?, ?, ?, ?,
      ?
    )
  `);

  const scores = evaluation.scores || {};
  const firstTurnScore = evaluation.tutorFirstTurnScore ?? evaluation.overallScore ?? null;

  const bindArgs = [
    originalResult.runId,
    originalResult.scenarioId,
    originalResult.scenarioName,
    originalResult.scenarioType || 'suggestion',
    originalResult.provider,
    originalResult.model,
    originalResult.profileName,
    typeof originalResult.hyperparameters === 'string'
      ? originalResult.hyperparameters
      : JSON.stringify(originalResult.hyperparameters || {}),
    originalResult.promptId,
    originalResult.egoModel || null,
    originalResult.superegoModel || null,
    typeof originalResult.suggestions === 'string'
      ? originalResult.suggestions
      : JSON.stringify(originalResult.suggestions || []),
    originalResult.rawResponse,
    originalResult.latencyMs,
    originalResult.inputTokens,
    originalResult.outputTokens,
    originalResult.cost,
    originalResult.dialogueRounds,
    originalResult.deliberationRounds ?? null,
    originalResult.apiCalls,
    originalResult.dialogueId,
    // New scores from the new judge
    scores.relevance?.score ?? scores.relevance ?? null,
    scores.specificity?.score ?? scores.specificity ?? null,
    scores.pedagogical?.score ?? scores.pedagogical ?? null,
    scores.personalization?.score ?? scores.personalization ?? null,
    scores.actionability?.score ?? scores.actionability ?? null,
    scores.tone?.score ?? scores.tone ?? null,
    firstTurnScore, // overall_score (deprecated)
    firstTurnScore, // tutor_first_turn_score
    evaluation.baseScore ?? null,
    evaluation.recognitionScore ?? null,
    evaluation.passesRequired ? 1 : 0,
    evaluation.passesForbidden ? 1 : 0,
    JSON.stringify(evaluation.requiredMissing || []),
    JSON.stringify(evaluation.forbiddenFound || []),
    evaluation.judgeModel || null,
    evaluation.summary || null,
    evaluation.scores ? JSON.stringify(evaluation.scores) : null,
    1, // success
    null, // error_message
    originalResult.factorRecognition ?? null,
    originalResult.factorMultiAgentTutor ?? null,
    originalResult.factorMultiAgentLearner ?? null,
    originalResult.learnerArchitecture || null,
    'rubric', // Rejudgments only store successful rubric evaluations
    originalResult.conversationMode || null,
    originalResult.dialogueContentHash || null,
    originalResult.configHash || null,
    evaluation.judgeLatencyMs ?? null,
    getTutorRubricVersion(),
    // Propagate prompt versions from original result (rejudging doesn't change prompts)
    originalResult.tutorEgoPromptVersion || null,
    originalResult.tutorSuperegoPromptVersion || null,
    originalResult.learnerPromptVersion || null,
    originalResult.promptContentHash || null,
    new Date().toISOString(),
  ];
  const info = stmt.run(...bindArgs);

  return info.lastInsertRowid;
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
 * @param {string} [evaluation.dialogueQualitySummary] - Judge narrative summary
 * @param {string} [evaluation.dialogueQualityJudgeModel] - Judge model used
 */
export function updateDialogueQualityScore(resultId, evaluation) {
  const recordAudit = withAuditTrail(
    resultId,
    ['dialogue_quality_score', 'dialogue_quality_summary', 'dialogue_quality_judge_model', 'dialogue_rubric_version'],
    'updateDialogueQualityScore',
    { judgeModel: evaluation.dialogueQualityJudgeModel, rubricVersion: getDialogueRubricVersion() },
  );

  const stmt = db.prepare(`
    UPDATE evaluation_results SET
      dialogue_quality_score = ?,
      dialogue_quality_summary = ?,
      dialogue_quality_judge_model = ?,
      dialogue_rubric_version = ?
    WHERE id = ?
  `);
  stmt.run(
    evaluation.dialogueQualityScore ?? null,
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
 * @param {string} [evaluation.dialogueQualityInternalSummary] - Judge narrative summary
 */
export function updateDialogueQualityInternalScore(resultId, evaluation) {
  const recordAudit = withAuditTrail(
    resultId,
    ['dialogue_quality_internal_score', 'dialogue_quality_internal_summary', 'dialogue_rubric_version'],
    'updateDialogueQualityInternalScore',
    { rubricVersion: getDialogueRubricVersion() },
  );

  const stmt = db.prepare(`
    UPDATE evaluation_results SET
      dialogue_quality_internal_score = ?,
      dialogue_quality_internal_summary = ?,
      dialogue_rubric_version = ?
    WHERE id = ?
  `);
  stmt.run(
    evaluation.dialogueQualityInternalScore ?? null,
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

const DIALOGUE_LOGS_DIR = path.join(ROOT_DIR, 'logs', 'tutor-dialogues');

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

/**
 * Get a single result by its row ID.
 */
export function getResultById(id) {
  const stmt = db.prepare('SELECT * FROM evaluation_results WHERE id = ?');
  const row = stmt.get(id);
  if (!row) return null;
  return parseResultRow(row);
}

/**
 * Clone evaluation result rows into a derived run for rubric version comparison.
 *
 * Creates a new run record `{runId}_rubric-v{ver}` (if not already present),
 * then copies each target row with all generation columns preserved and all
 * score columns NULLed so they can be re-scored with the new rubric.
 *
 * @param {string} sourceRunId - The original run ID
 * @param {Array} sourceResults - Array of parsed result objects to clone
 * @param {string} rubricVersion - The target rubric version (e.g. "2.2")
 * @returns {{ derivedRunId: string, clonedIds: number[] }}
 */
export function cloneRowsForRubricVersion(sourceRunId, sourceResults, rubricVersion) {
  const derivedRunId = `${sourceRunId}_rubric-v${rubricVersion}`;

  // Ensure derived run record exists
  const existingRun = getRun(derivedRunId);
  if (!existingRun) {
    const sourceRun = getRun(sourceRunId);
    const now = new Date().toISOString();
    const meta = {
      sourceRunId,
      rubricVersion,
      derivedFrom: 'rubric-version-comparison',
      ...(sourceRun?.metadata || {}),
    };
    db.prepare(
      `
      INSERT INTO evaluation_runs (id, created_at, description, total_scenarios, total_configurations, metadata, status)
      VALUES (?, ?, ?, ?, ?, ?, 'running')
    `,
    ).run(
      derivedRunId,
      now,
      `Rubric v${rubricVersion} re-score of ${sourceRunId}`,
      sourceRun?.totalScenarios || 0,
      sourceRun?.totalConfigurations || 0,
      JSON.stringify(meta),
    );
  }

  // Check for existing clones (idempotent: skip rows already cloned)
  const existingDialogueIds = new Set(
    db
      .prepare('SELECT dialogue_id FROM evaluation_results WHERE run_id = ?')
      .all(derivedRunId)
      .map((r) => r.dialogue_id),
  );

  const clonedIds = [];
  const insertStmt = db.prepare(`
    INSERT INTO evaluation_results (
      run_id, scenario_id, scenario_name, scenario_type,
      provider, model, profile_name, hyperparameters, prompt_id,
      ego_model, superego_model,
      suggestions, raw_response,
      latency_ms, input_tokens, output_tokens, cost, dialogue_rounds, deliberation_rounds, api_calls, dialogue_id,
      success, error_message,
      factor_recognition, factor_multi_agent_tutor, factor_multi_agent_learner, learner_architecture,
      scoring_method, conversation_mode,
      created_at
    ) VALUES (
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?,
      ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?,
      ?, ?,
      ?
    )
  `);

  for (const r of sourceResults) {
    if (existingDialogueIds.has(r.dialogueId)) continue;

    const info = insertStmt.run(
      derivedRunId,
      r.scenarioId,
      r.scenarioName,
      r.scenarioType || 'suggestion',
      r.provider,
      r.model,
      r.profileName,
      JSON.stringify(r.hyperparameters || {}),
      r.promptId,
      r.egoModel || null,
      r.superegoModel || null,
      JSON.stringify(r.suggestions || []),
      r.rawResponse,
      r.latencyMs,
      r.inputTokens,
      r.outputTokens,
      r.cost,
      r.dialogueRounds,
      r.deliberationRounds ?? null,
      r.apiCalls,
      r.dialogueId,
      r.success ? 1 : 0,
      r.errorMessage || null,
      r.factors?.recognition != null ? (r.factors.recognition ? 1 : 0) : null,
      r.factors?.multi_agent_tutor != null ? (r.factors.multi_agent_tutor ? 1 : 0) : null,
      r.factors?.multi_agent_learner != null ? (r.factors.multi_agent_learner ? 1 : 0) : null,
      r.learnerArchitecture || null,
      r.scoringMethod || null,
      r.conversationMode || null,
      new Date().toISOString(),
    );
    clonedIds.push(info.lastInsertRowid);
  }

  return { derivedRunId, clonedIds };
}

export default {
  createRun,
  updateRun,
  storeResult,
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
  cloneRowsForRubricVersion,
  // P0 Provenance
  getScoreAudit,
  getScoreAuditByRun,
};
