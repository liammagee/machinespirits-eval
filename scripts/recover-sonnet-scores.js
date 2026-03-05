#!/usr/bin/env node
/**
 * Recover Sonnet scores for run aea2abfb from the score_audit trail.
 *
 * The original 144 rows were scored by claude-code/sonnet on 2026-03-01,
 * then overwritten by codex-cli/auto and gemini-cli/auto rejudge runs.
 * The audit trail preserved the original Sonnet new_value entries.
 *
 * Strategy: for each of the 144 original result_ids, insert a NEW row
 * (via storeRejudgment pattern) copying generation data from the current
 * row and restoring Sonnet scores from audit.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'evaluations.db');
const db = new Database(dbPath);

const RUN_ID = 'eval-2026-03-01-aea2abfb';
const SONNET_JUDGE = 'claude-code/sonnet';

// Score columns we can recover from audit
const SCORE_COLUMNS = [
  'tutor_first_turn_score', 'tutor_scores', 'tutor_last_turn_score',
  'tutor_development_score', 'tutor_overall_score', 'overall_score',
  'tutor_rubric_version', 'tutor_holistic_scores', 'tutor_holistic_overall_score',
  'tutor_holistic_summary', 'tutor_holistic_judge_model',
  'learner_scores', 'learner_overall_score', 'learner_rubric_version',
  'learner_holistic_scores', 'learner_holistic_overall_score',
  'learner_holistic_summary', 'learner_holistic_judge_model',
  'learner_judge_model',
  'dialogue_quality_score', 'dialogue_quality_summary',
  'dialogue_quality_judge_model', 'dialogue_rubric_version',
  'dialogue_quality_internal_score', 'dialogue_quality_internal_summary',
  'tutor_deliberation_scores', 'tutor_deliberation_score',
  'tutor_deliberation_summary', 'tutor_deliberation_judge_model',
  'learner_deliberation_scores', 'learner_deliberation_score',
  'learner_deliberation_summary', 'learner_deliberation_judge_model',
  'deliberation_rubric_version',
  'judge_model', 'evaluation_reasoning', 'scores_with_reasoning',
  'judge_latency_ms',
];

// Get the 144 distinct result_ids that were originally Sonnet-scored
const resultIds = db.prepare(`
  SELECT DISTINCT sa.result_id
  FROM score_audit sa
  WHERE sa.result_id IN (SELECT CAST(id AS TEXT) FROM evaluation_results WHERE run_id = ?)
    AND sa.judge_model = ?
    AND sa.operation = 'updateResultTutorScores'
    AND sa.old_value IS NULL
`).all(RUN_ID, SONNET_JUDGE).map(r => r.result_id);

console.log(`Found ${resultIds.length} result IDs with Sonnet audit trail`);

if (resultIds.length === 0) {
  console.log('Nothing to recover.');
  process.exit(0);
}

// Check if Sonnet rows already exist (idempotent)
const existingSonnet = db.prepare(`
  SELECT COUNT(*) as cnt FROM evaluation_results
  WHERE run_id = ? AND judge_model = ?
`).get(RUN_ID, SONNET_JUDGE);

if (existingSonnet.cnt > 0) {
  console.log(`Already have ${existingSonnet.cnt} Sonnet rows — aborting to prevent duplicates.`);
  process.exit(1);
}

// For each result_id, gather audit values and the current row's generation data
const getAudit = db.prepare(`
  SELECT column_name, new_value
  FROM score_audit
  WHERE result_id = ? AND judge_model = ? AND old_value IS NULL AND new_value IS NOT NULL
`);

const getRow = db.prepare(`
  SELECT * FROM evaluation_results WHERE id = ?
`);

// Generation columns to copy from current row (not score columns)
const GEN_COLUMNS = [
  'run_id', 'scenario_id', 'scenario_name', 'provider', 'model', 'profile_name',
  'hyperparameters', 'prompt_id', 'suggestions', 'raw_response',
  'latency_ms', 'input_tokens', 'output_tokens', 'cost',
  'dialogue_rounds', 'api_calls', 'dialogue_id',
  'success', 'error_message', 'scenario_type',
  'base_score', 'recognition_score',
  'ego_model', 'superego_model',
  'factor_recognition', 'factor_multi_agent_tutor', 'factor_multi_agent_learner',
  'learner_architecture', 'scoring_method', 'conversation_mode',
];

const dryRun = process.argv.includes('--dry-run');
let inserted = 0;

const insertRow = db.transaction(() => {
  for (const resultId of resultIds) {
    const currentRow = getRow.get(parseInt(resultId));
    if (!currentRow) {
      console.warn(`  Row ${resultId} not found — skipping`);
      continue;
    }

    // Get Sonnet scores from audit
    const auditEntries = getAudit.all(resultId, SONNET_JUDGE);
    const auditMap = new Map(auditEntries.map(e => [e.column_name, e.new_value]));

    // Build new row: generation data from current row + Sonnet scores from audit
    const cols = [...GEN_COLUMNS];
    const vals = GEN_COLUMNS.map(c => currentRow[c]);

    // Add score columns from audit
    for (const col of SCORE_COLUMNS) {
      if (auditMap.has(col)) {
        cols.push(col);
        vals.push(auditMap.get(col));
      }
    }

    // Ensure judge_model is set to Sonnet
    if (!cols.includes('judge_model')) {
      cols.push('judge_model');
      vals.push(SONNET_JUDGE);
    }

    // Add created_at
    cols.push('created_at');
    vals.push(new Date().toISOString());

    const placeholders = cols.map(() => '?').join(', ');
    const sql = `INSERT INTO evaluation_results (${cols.join(', ')}) VALUES (${placeholders})`;

    if (dryRun) {
      if (inserted === 0) console.log(`  SQL preview: ${sql.substring(0, 120)}...`);
    } else {
      db.prepare(sql).run(...vals);
    }
    inserted++;
  }
});

if (dryRun) {
  console.log(`\nDRY RUN: would insert ${resultIds.length} Sonnet rows`);
  // Still run to get count
  insertRow();
  console.log(`Verified ${inserted} rows would be inserted`);
} else {
  insertRow();
  console.log(`\nInserted ${inserted} Sonnet rows recovered from audit trail`);

  // Verify
  const verify = db.prepare(`
    SELECT judge_model, COUNT(*) as cnt,
      SUM(tutor_first_turn_score IS NOT NULL) as has_scores
    FROM evaluation_results WHERE run_id = ? AND judge_model = ?
  `).get(RUN_ID, SONNET_JUDGE);
  console.log(`Verification: ${verify.cnt} Sonnet rows, ${verify.has_scores} with tutor scores`);
}

db.close();
