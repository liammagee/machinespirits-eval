export function migrateEvaluationDatabase(db) {
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
  migrateAddColumn(
    `ALTER TABLE evaluation_results ADD COLUMN scenario_type TEXT DEFAULT 'suggestion'`,
    'scenario_type',
  );
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
  migrateAddColumn(
    `ALTER TABLE evaluation_results ADD COLUMN learner_holistic_summary TEXT`,
    'learner_holistic_summary',
  );
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
  migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN dialogue_quality_scores TEXT`, 'dialogue_quality_scores');
  migrateAddColumn(
    `ALTER TABLE evaluation_results ADD COLUMN dialogue_quality_summary TEXT`,
    'dialogue_quality_summary',
  );
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
    `ALTER TABLE evaluation_results ADD COLUMN dialogue_quality_internal_scores TEXT`,
    'dialogue_quality_internal_scores',
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
  migrateAddColumn(
    `ALTER TABLE evaluation_results ADD COLUMN tutor_deliberation_score REAL`,
    'tutor_deliberation_score',
  );
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

  // Charisma rubric (cells 101/102 — id-director architecture).
  // Per-dimension scores as JSON, weighted overall as REAL, rubric version
  // auto-resolved from config/evaluation-rubric-charisma.yaml at write time.
  // id_construction_trace stores the per-turn JSON envelope the id-director
  // emitted (generated_prompt, persona_delta, stage_directions, reasoning),
  // keyed by turn index — the architectural fingerprint of the cell.
  migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN tutor_charisma_scores TEXT`, 'tutor_charisma_scores');
  migrateAddColumn(
    `ALTER TABLE evaluation_results ADD COLUMN tutor_charisma_overall_score REAL`,
    'tutor_charisma_overall_score',
  );
  migrateAddColumn(
    `ALTER TABLE evaluation_results ADD COLUMN tutor_charisma_rubric_version TEXT`,
    'tutor_charisma_rubric_version',
  );
  migrateAddColumn(
    `ALTER TABLE evaluation_results ADD COLUMN tutor_charisma_judge_model TEXT`,
    'tutor_charisma_judge_model',
  );
  migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN tutor_register_scores TEXT`, 'tutor_register_scores');
  migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN id_construction_trace TEXT`, 'id_construction_trace');

  // Adaptive grader (cells with runner: adaptive — 110, 111-113, 118-120).
  // Bespoke 4-dimension graded rubric (1-5 per dim) scored against the adaptive
  // trap scenarios (config/adaptive-trap-scenarios.yaml). The v2.2 evaluator
  // pipeline skips adaptive cells (scenario_id not in suggestion-scenarios.yaml
  // lookup), so this complements the binary strategy_shift_correctness signal
  // computed by scripts/analyze-strategy-shift.js with a graded judgement.
  // Written by scripts/grade-adaptive-dialogue.js.
  migrateAddColumn(
    `ALTER TABLE evaluation_results ADD COLUMN adaptive_trigger_recognition REAL`,
    'adaptive_trigger_recognition',
  );
  migrateAddColumn(
    `ALTER TABLE evaluation_results ADD COLUMN adaptive_strategy_execution REAL`,
    'adaptive_strategy_execution',
  );
  migrateAddColumn(
    `ALTER TABLE evaluation_results ADD COLUMN adaptive_strategy_quality REAL`,
    'adaptive_strategy_quality',
  );
  migrateAddColumn(
    `ALTER TABLE evaluation_results ADD COLUMN adaptive_pedagogical_coherence REAL`,
    'adaptive_pedagogical_coherence',
  );
  migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN adaptive_grader_scores TEXT`, 'adaptive_grader_scores');
  migrateAddColumn(
    `ALTER TABLE evaluation_results ADD COLUMN adaptive_grader_reasoning TEXT`,
    'adaptive_grader_reasoning',
  );
  migrateAddColumn(
    `ALTER TABLE evaluation_results ADD COLUMN adaptive_grader_judge_model TEXT`,
    'adaptive_grader_judge_model',
  );
  migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN adaptive_grader_version TEXT`, 'adaptive_grader_version');

  // Deliberation rounds: cumulative ego-superego cycles across all conversation turns
  // (split from dialogue_rounds which now stores conversation turn count)
  migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN deliberation_rounds INTEGER`, 'deliberation_rounds');

  // P0 Provenance: dialogue content hash (SHA-256 of dialogue log JSON at write time)
  migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN dialogue_content_hash TEXT`, 'dialogue_content_hash');

  // P1c Provenance: config snapshot hash (SHA-256 of resolved cell config at generation time)
  migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN config_hash TEXT`, 'config_hash');

  // Prompt versioning: track which prompt versions produced each row
  migrateAddColumn(
    `ALTER TABLE evaluation_results ADD COLUMN tutor_ego_prompt_version TEXT`,
    'tutor_ego_prompt_version',
  );
  migrateAddColumn(
    `ALTER TABLE evaluation_results ADD COLUMN tutor_superego_prompt_version TEXT`,
    'tutor_superego_prompt_version',
  );
  migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN learner_prompt_version TEXT`, 'learner_prompt_version');
  migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN prompt_content_hash TEXT`, 'prompt_content_hash');

  // A7 Longitudinal: cross-session Writing Pad persistence keyed by learner_id.
  // Populated when --learner-id is supplied to `eval-cli.js run`; NULL otherwise.
  // Session ordering is derived: ROW_NUMBER() OVER (PARTITION BY learner_id ORDER BY created_at).
  migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN learner_id TEXT`, 'learner_id');
  db.exec(`CREATE INDEX IF NOT EXISTS idx_results_learner ON evaluation_results(learner_id)`);
  migrateAddColumn(`ALTER TABLE evaluation_results ADD COLUMN attempt_index INTEGER`, 'attempt_index');
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_results_attempt ON evaluation_results(run_id, profile_name, scenario_id, attempt_index)`,
  );

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
}
