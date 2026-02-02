/**
 * Evaluation Store Service
 *
 * SQLite-based storage for AI tutor evaluation results.
 * Supports querying, aggregation, comparison, and export.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

// Initialize database
const dbPath = path.join(DATA_DIR, 'evaluations.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

// Migrate: rename evaluator_model → judge_model if the old column exists
try {
  const cols = db.prepare('PRAGMA table_info(evaluation_results)').all().map(c => c.name);
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

// Migration: Add dialogue_id column if it doesn't exist
try {
  db.exec(`ALTER TABLE evaluation_results ADD COLUMN dialogue_id TEXT`);
} catch (e) {
  // Column already exists, ignore
}
db.exec(`CREATE INDEX IF NOT EXISTS idx_results_dialogue ON evaluation_results(dialogue_id)`);

// Migration: Add scenario_type column if it doesn't exist
try {
  db.exec(`ALTER TABLE evaluation_results ADD COLUMN scenario_type TEXT DEFAULT 'suggestion'`);
} catch (e) {
  // Column already exists, ignore
}

// Migration: Add scores_with_reasoning column if it doesn't exist
try {
  db.exec(`ALTER TABLE evaluation_results ADD COLUMN scores_with_reasoning TEXT`);
} catch (e) {
  // Column already exists, ignore
}

// Migration: Add cost column if it doesn't exist
try {
  db.exec(`ALTER TABLE evaluation_results ADD COLUMN cost REAL`);
} catch (e) {
  // Column already exists, ignore
}

// Migration: Add dual scoring columns if they don't exist
try {
  db.exec(`ALTER TABLE evaluation_results ADD COLUMN base_score REAL`);
} catch (e) {
  // Column already exists, ignore
}
try {
  db.exec(`ALTER TABLE evaluation_results ADD COLUMN recognition_score REAL`);
} catch (e) {
  // Column already exists, ignore
}

// Migration: Add ego_model and superego_model columns
try {
  db.exec(`ALTER TABLE evaluation_results ADD COLUMN ego_model TEXT`);
} catch (e) {
  // Column already exists, ignore
}
try {
  db.exec(`ALTER TABLE evaluation_results ADD COLUMN superego_model TEXT`);
} catch (e) {
  // Column already exists, ignore
}

// Migration: Add factorial factor columns
try {
  db.exec(`ALTER TABLE evaluation_results ADD COLUMN factor_recognition BOOLEAN`);
} catch (e) { /* Column already exists */ }
try {
  db.exec(`ALTER TABLE evaluation_results ADD COLUMN factor_multi_agent_tutor BOOLEAN`);
} catch (e) { /* Column already exists */ }
try {
  db.exec(`ALTER TABLE evaluation_results ADD COLUMN factor_multi_agent_learner BOOLEAN`);
} catch (e) { /* Column already exists */ }
try {
  db.exec(`ALTER TABLE evaluation_results ADD COLUMN learner_architecture TEXT`);
} catch (e) { /* Column already exists */ }

// Migration: Add reproducibility metadata columns to evaluation_runs
try {
  db.exec(`ALTER TABLE evaluation_runs ADD COLUMN git_commit TEXT`);
} catch (e) { /* Column already exists */ }
try {
  db.exec(`ALTER TABLE evaluation_runs ADD COLUMN package_version TEXT`);
} catch (e) { /* Column already exists */ }

// Migration: Revert any accidental renames (batch→matrix, interact→interaction)
try {
  const revertRuns = db.prepare(`
    UPDATE evaluation_runs
    SET metadata = REPLACE(REPLACE(metadata, '"runType":"batch"', '"runType":"matrix"'), '"runType":"interact"', '"runType":"interaction"')
    WHERE metadata LIKE '%"runType":"batch"%' OR metadata LIKE '%"runType":"interact"%'
  `);
  revertRuns.run();
} catch (e) {
  // Ignore errors
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

/**
 * Generate a unique run ID
 */
function generateRunId() {
  const timestamp = new Date().toISOString().slice(0, 10);
  const suffix = randomBytes(4).toString('hex');
  return `eval-${timestamp}-${suffix}`;
}

/**
 * Create a new evaluation run
 *
 * @param {Object} options - Run options
 * @returns {Object} Created run
 */
export function createRun(options = {}) {
  const {
    description = null,
    totalScenarios = 0,
    totalConfigurations = 0,
    metadata = {},
  } = options;

  const id = generateRunId();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO evaluation_runs (id, created_at, description, total_scenarios, total_configurations, metadata, git_commit, package_version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, now, description, totalScenarios, totalConfigurations, JSON.stringify(metadata), metadata.gitCommit || null, metadata.packageVersion || null);

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
  const { status, totalTests, completedAt } = updates;

  if (status === 'completed') {
    const stmt = db.prepare(`
      UPDATE evaluation_runs
      SET status = ?, total_tests = ?, completed_at = ?
      WHERE id = ?
    `);
    stmt.run(status, totalTests || 0, completedAt || new Date().toISOString(), runId);
  } else if (totalTests != null) {
    const stmt = db.prepare(`
      UPDATE evaluation_runs SET status = ?, total_tests = ? WHERE id = ?
    `);
    stmt.run(status, totalTests, runId);
  } else {
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
      latency_ms, input_tokens, output_tokens, cost, dialogue_rounds, api_calls, dialogue_id,
      score_relevance, score_specificity, score_pedagogical,
      score_personalization, score_actionability, score_tone, overall_score,
      base_score, recognition_score,
      passes_required, passes_forbidden, required_missing, forbidden_found,
      judge_model, evaluation_reasoning, scores_with_reasoning, success, error_message,
      factor_recognition, factor_multi_agent_tutor, factor_multi_agent_learner, learner_architecture,
      created_at
    ) VALUES (
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?,
      ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
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
    result.apiCalls,
    result.dialogueId,
    result.scores?.relevance,
    result.scores?.specificity,
    result.scores?.pedagogical,
    result.scores?.personalization,
    result.scores?.actionability,
    result.scores?.tone,
    result.overallScore,
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
    new Date().toISOString()
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

  query += ' ORDER BY created_at ASC';
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

  // Count completed results per run
  const resultCountStmt = db.prepare(`
    SELECT COUNT(*) as completed,
           SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
           AVG(overall_score) as avg_score
    FROM evaluation_results WHERE run_id = ?
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

  return rows.map(row => {
    const scenarioRows = scenarioStmt.all(row.id);
    const scenarioNames = scenarioRows.map(s => s.scenario_name).filter(Boolean);
    const counts = resultCountStmt.get(row.id);

    const extractAlias = (raw) => {
      if (!raw) return null;
      const dotIdx = raw.indexOf('.');
      return dotIdx !== -1 ? raw.slice(dotIdx + 1) : raw;
    };

    const modelRows = modelStmt.all(row.id);
    const superegoRows = superegoModelStmt.all(row.id);
    const models = [...new Set([
      ...modelRows.map(m => extractAlias(m.ego_model)),
      ...superegoRows.map(m => extractAlias(m.superego_model)),
    ].filter(Boolean))];

    const completedResults = counts?.completed || 0;
    const totalTests = row.total_tests || 0;
    const progressPct = totalTests > 0 ? Math.min(100, Math.round((completedResults / totalTests) * 100)) : null;

    // Compute duration: for completed runs use completed_at - created_at;
    // for running runs compute elapsed from now.
    let durationMs = null;
    if (row.created_at) {
      const start = new Date(row.created_at).getTime();
      if (row.completed_at) {
        durationMs = new Date(row.completed_at).getTime() - start;
      } else if (row.status === 'running') {
        durationMs = Date.now() - start;
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
      progressPct,
      durationMs,
      status: row.status,
      completedAt: row.completed_at,
      scenarioNames, // Scenario names from results
      models, // Distinct ego model aliases used
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

/**
 * Get aggregated statistics for a run
 */
export function getRunStats(runId) {
  const stmt = db.prepare(`
    SELECT
      provider,
      model,
      profile_name,
      ego_model,
      superego_model,
      COUNT(*) as total_tests,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_tests,
      AVG(overall_score) as avg_score,
      AVG(score_relevance) as avg_relevance,
      AVG(score_specificity) as avg_specificity,
      AVG(score_pedagogical) as avg_pedagogical,
      AVG(score_personalization) as avg_personalization,
      AVG(score_actionability) as avg_actionability,
      AVG(score_tone) as avg_tone,
      AVG(base_score) as avg_base_score,
      AVG(recognition_score) as avg_recognition_score,
      AVG(latency_ms) as avg_latency,
      SUM(input_tokens) as total_input_tokens,
      SUM(output_tokens) as total_output_tokens,
      SUM(CASE WHEN passes_required = 1 THEN 1 ELSE 0 END) as passes_required,
      SUM(CASE WHEN passes_forbidden = 1 THEN 1 ELSE 0 END) as passes_forbidden
    FROM evaluation_results
    WHERE run_id = ?
    GROUP BY provider, model, profile_name
    ORDER BY avg_score DESC
  `);

  const rows = stmt.all(runId);

  return rows.map(row => ({
    provider: row.provider,
    model: row.model,
    profileName: row.profile_name,
    egoModel: row.ego_model,
    superegoModel: row.superego_model,
    totalTests: row.total_tests,
    successfulTests: row.successful_tests,
    successRate: row.total_tests > 0 ? row.successful_tests / row.total_tests : 0,
    avgScore: row.avg_score,
    avgBaseScore: row.avg_base_score,
    avgRecognitionScore: row.avg_recognition_score,
    dimensions: {
      relevance: row.avg_relevance,
      specificity: row.avg_specificity,
      pedagogical: row.avg_pedagogical,
      personalization: row.avg_personalization,
      actionability: row.avg_actionability,
      tone: row.avg_tone,
    },
    avgLatencyMs: row.avg_latency,
    totalInputTokens: row.total_input_tokens,
    totalOutputTokens: row.total_output_tokens,
    passesRequired: row.passes_required,
    passesForbidden: row.passes_forbidden,
    validationPassRate: row.total_tests > 0
      ? (row.passes_required + row.passes_forbidden) / (row.total_tests * 2)
      : 0,
  }));
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
      AVG(overall_score) as avg_score,
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
      runs: row.runs,
    });
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
        AVG(overall_score) as avg_score,
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
  const scenarios = new Set([...results1.map(r => r.scenario_id), ...results2.map(r => r.scenario_id)]);

  for (const scenarioId of scenarios) {
    const r1 = results1.find(r => r.scenario_id === scenarioId) || {};
    const r2 = results2.find(r => r.scenario_id === scenarioId) || {};

    comparison.push({
      scenarioId,
      config1Score: r1.avg_score || null,
      config2Score: r2.avg_score || null,
      difference: (r1.avg_score || 0) - (r2.avg_score || 0),
      winner: r1.avg_score > r2.avg_score ? 'config1'
        : r2.avg_score > r1.avg_score ? 'config2'
        : 'tie',
    });
  }

  // Overall stats
  const overall = {
    config1Wins: comparison.filter(c => c.winner === 'config1').length,
    config2Wins: comparison.filter(c => c.winner === 'config2').length,
    ties: comparison.filter(c => c.winner === 'tie').length,
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
    'scenario_id', 'scenario_name', 'provider', 'model',
    'overall_score', 'relevance', 'specificity', 'pedagogical',
    'personalization', 'actionability', 'tone',
    'latency_ms', 'input_tokens', 'output_tokens',
    'passes_required', 'passes_forbidden', 'success'
  ];

  const rows = results.map(r => [
    r.scenarioId,
    r.scenarioName,
    r.provider,
    r.model,
    r.overallScore,
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

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

/**
 * Complete an incomplete evaluation run
 *
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

  return rows.map(row => {
    const resultsStmt = db.prepare('SELECT COUNT(*) as count FROM evaluation_results WHERE run_id = ?');
    const resultsCount = resultsStmt.get(row.id).count;

    return {
      id: row.id,
      createdAt: row.created_at,
      description: row.description,
      totalScenarios: row.total_scenarios,
      totalConfigurations: row.total_configurations,
      expectedTests: row.total_scenarios * row.total_configurations,
      resultsFound: resultsCount,
      ageMinutes: Math.round((Date.now() - new Date(row.created_at).getTime()) / 60000),
      metadata: JSON.parse(row.metadata || '{}'),
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

  if (dryRun) {
    return {
      dryRun: true,
      found: incompleteRuns.length,
      runs: incompleteRuns,
    };
  }

  const completed = [];
  for (const run of incompleteRuns) {
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
    completed: completed.length,
    runs: completed,
  };
}

/**
 * Delete a run and its results
 */
export function deleteRun(runId) {
  const deleteResults = db.prepare('DELETE FROM evaluation_results WHERE run_id = ?');
  const deleteRun = db.prepare('DELETE FROM evaluation_runs WHERE id = ?');

  const transaction = db.transaction(() => {
    deleteResults.run(runId);
    deleteRun.run(runId);
  });

  transaction();
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

  // Build set of completed (profile, scenarioId) pairs
  for (const result of results) {
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

  // Build the scores object - use scoresWithReasoning if available
  const scores = scoresWithReasoning || {
    relevance: row.score_relevance,
    specificity: row.score_specificity,
    pedagogical: row.score_pedagogical,
    personalization: row.score_personalization,
    actionability: row.score_actionability,
    tone: row.score_tone,
  };

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
    apiCalls: row.api_calls,
    dialogueId: row.dialogue_id,
    scores,
    overallScore: row.overall_score,
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
    factors: (row.factor_recognition != null || row.factor_multi_agent_tutor != null || row.factor_multi_agent_learner != null)
      ? {
          recognition: Boolean(row.factor_recognition),
          multi_agent_tutor: Boolean(row.factor_multi_agent_tutor),
          multi_agent_learner: Boolean(row.factor_multi_agent_learner),
        }
      : null,
    learnerArchitecture: row.learner_architecture || null,
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
      evalData.judgeEvaluation?.overall_score ?? null,
    JSON.stringify(evalData.judgeEvaluation || null)
  );

  return evalData.evalId;
}

/**
 * List interaction evaluations
 */
export function listInteractionEvals(options = {}) {
  const { limit = 50, scenarioId = null } = options;

  let sql = `
    SELECT * FROM interaction_evaluations
    ${scenarioId ? 'WHERE scenario_id = ?' : ''}
    ORDER BY created_at DESC
    LIMIT ?
  `;

  const stmt = db.prepare(sql);
  const rows = scenarioId ? stmt.all(scenarioId, limit) : stmt.all(limit);

  return rows.map(row => ({
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
 * @param {string} [options.scoreColumn='overall_score'] - Which score to use
 * @returns {Object} Map of cellKey → [score, ...]
 */
export function getFactorialCellData(runId, options = {}) {
  const { scoreColumn = 'overall_score' } = options;

  // Whitelist valid score columns to prevent SQL injection
  const validColumns = ['overall_score', 'base_score', 'recognition_score'];
  const col = validColumns.includes(scoreColumn) ? scoreColumn : 'overall_score';

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
 * Update score columns for an existing result row (for rejudging)
 */
export function updateResultScores(resultId, evaluation) {
  const stmt = db.prepare(`
    UPDATE evaluation_results SET
      score_relevance = ?,
      score_specificity = ?,
      score_pedagogical = ?,
      score_personalization = ?,
      score_actionability = ?,
      score_tone = ?,
      overall_score = ?,
      base_score = ?,
      recognition_score = ?,
      passes_required = ?,
      passes_forbidden = ?,
      required_missing = ?,
      forbidden_found = ?,
      judge_model = ?,
      evaluation_reasoning = ?,
      scores_with_reasoning = ?
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
    evaluation.overallScore ?? null,
    evaluation.baseScore ?? null,
    evaluation.recognitionScore ?? null,
    evaluation.passesRequired ? 1 : 0,
    evaluation.passesForbidden ? 1 : 0,
    JSON.stringify(evaluation.requiredMissing || []),
    JSON.stringify(evaluation.forbiddenFound || []),
    evaluation.judgeModel || null,
    evaluation.summary || null,
    evaluation.scores ? JSON.stringify(evaluation.scores) : null,
    resultId
  );
}

export default {
  createRun,
  updateRun,
  storeResult,
  updateResultScores,
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
  getInteractionEval,
  getInteractionEvalByRunId,
};
