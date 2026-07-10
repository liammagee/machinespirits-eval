#!/usr/bin/env node
/**
 * Ingest tutor-stub auto-eval JSON summaries into data/evaluations.db.
 *
 * The tutor-stub experiment shape is intentionally kept in namespaced tables
 * instead of being forced into evaluation_results.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import Database from 'better-sqlite3';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DB = process.env.EVAL_DB_PATH || path.join(ROOT, 'data', 'evaluations.db');
const DEFAULT_DIR = '.tutor-stub-auto-eval';

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    db: { type: 'string', default: DEFAULT_DB },
    dir: { type: 'string', default: DEFAULT_DIR },
    latest: { type: 'string', default: '' },
    'include-dry-run': { type: 'boolean', default: false },
    'include-empty': { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    verbose: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function usage() {
  console.log(`Usage:
  node scripts/ingest-tutor-stub-auto-evals.js [auto-eval.json ...] [options]

Options:
  --db <path>           SQLite DB path (default: EVAL_DB_PATH or data/evaluations.db)
  --dir <path>          discovery root when no files are supplied (default: ${DEFAULT_DIR})
  --latest <n>          ingest only the newest n discovered/supplied summaries
  --include-dry-run     keep dry-run summaries
  --include-empty       keep summaries with no row data
  --dry-run             print what would be ingested without writing
  --verbose             print each ingested file
`);
}

function resolvePath(value) {
  if (!value) return null;
  if (value.startsWith('~')) return path.join(os.homedir(), value.slice(1));
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function repoRelative(value) {
  if (!value) return null;
  const resolved = resolvePath(value);
  return path.relative(ROOT, resolved);
}

function sourceHash(text) {
  return createHash('sha256').update(text).digest('hex');
}

function safeJson(value) {
  if (value === undefined) return null;
  return JSON.stringify(value);
}

function numberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function integerOrNull(value) {
  const numeric = Number.parseInt(value, 10);
  return Number.isFinite(numeric) ? numeric : null;
}

function boolInt(value) {
  if (value === undefined || value === null) return null;
  return value ? 1 : 0;
}

function roundDelta(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(4)) : null;
}

function csvLimit(value, name) {
  if (value === '' || value === undefined || value === null) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function runIdForSummary(summaryPath) {
  return path.basename(summaryPath, '.json');
}

function reportHtmlPath(summary, summaryPath) {
  if (summary?.report?.html) return repoRelative(summary.report.html);
  return repoRelative(summaryPath.replace(/\.json$/u, '.html'));
}

function defaultFailedRow(result) {
  return {
    policy: result.policy || null,
    runIndex: integerOrNull(result.runIndex),
    status: result.status || null,
    exitCode: integerOrNull(result.exitCode),
    signal: result.signal || null,
    log: result.log || null,
    trace: null,
    traceRelative: null,
    events: 0,
    turnCount: 0,
    lastTurn: null,
    stopReason: result.status || null,
    groundedClosure: false,
    bestPathCoverage: 0,
    missingPremiseCount: null,
    bottleneck: result.status === 'failed' ? 'technical_failure' : 'none',
    finalLearner: '',
    finalTutor: '',
    registerCounts: {},
    registerEntropy: 0,
    efficacyCounts: {},
    leakCount: 0,
    repairedCount: 0,
    fallbackCount: 0,
    errorCount: 0,
    field: null,
    trainingExamples: null,
  };
}

function fieldDelta(nextField = {}, currentField = {}, key) {
  if (!nextField || nextField[key] === undefined || !currentField || currentField[key] === undefined) return null;
  return roundDelta(Number(nextField[key]) - Number(currentField[key]));
}

function fallbackTrainingExamples(row = {}) {
  const frames = Array.isArray(row.animatedViz?.frames) ? row.animatedViz.frames : [];
  const turns = Array.isArray(row.transcript?.turns) ? row.transcript.turns : [];
  if (!frames.length && !turns.length) return [];
  const count = Math.max(frames.length, turns.length);
  const examples = [];
  for (let index = 0; index < count; index += 1) {
    const frame = frames[index] || {};
    const turn = turns[index] || {};
    const nextFrame = frames[index + 1] || null;
    const currentField = frame.field || turn.field || {};
    const nextField = nextFrame?.field || null;
    examples.push({
      schema: 'machinespirits.tutor-stub.turn-training-example.v1',
      turn: frame.turn ?? turn.turn ?? index + 1,
      policy: frame.policy || turn.register?.policy || row.policy || null,
      action: {
        engagementStance:
          frame.selectedEngagementStance ||
          frame.selectedRegister ||
          turn.register?.engagementStance ||
          turn.register?.selected ||
          null,
        selectedRegister: frame.selectedRegister || turn.register?.selected || null,
        actionFamily: turn.register?.actionFamily || frame.responseConfiguration?.action_family || null,
        audienceRegister: turn.register?.audienceRegister || frame.responseConfiguration?.audience_register || null,
        lexicalAccessibility:
          turn.register?.lexicalAccessibility || frame.responseConfiguration?.lexical_accessibility || null,
        sceneImmersion: turn.register?.sceneImmersion || frame.responseConfiguration?.scene_immersion || null,
        responseConfiguration: turn.responseConfiguration || frame.responseConfiguration || null,
        responseConfigurationAudit: turn.responseConfigurationAudit || frame.responseConfigurationAudit || null,
        registerPolicy: frame.register?.policy || turn.register?.policy || row.policy || null,
        registerVector: frame.register?.vector || turn.register?.vector || null,
        registerDistribution: frame.register?.distribution || null,
        registerVectorEntropyBits: frame.register?.vectorEntropyBits ?? turn.register?.vectorEntropyBits ?? null,
        tutorText: turn.tutor || frame.snippets?.tutor || '',
      },
      stateBeforeAction: {
        learnerText: turn.learner || frame.snippets?.learner || '',
        learnerState: turn.learnerState || frame.state?.classifier || {},
        dag: frame.state?.dag || turn.dag || {},
        field: currentField,
        stateVector: frame.dynamics?.stateVector || {},
        derivativeVector: frame.dynamics?.derivativeVector || {},
        trajectory: frame.trajectory || turn.trajectory || {},
        humanDiscourse: frame.humanDiscourse || turn.humanDiscourse || null,
      },
      outcomeAfterNextLearner: nextFrame
        ? {
            nextTurn: nextFrame.turn ?? null,
            dag: nextFrame.state?.dag || {},
            field: nextField || {},
            stateVector: nextFrame.dynamics?.stateVector || {},
            derivativeVector: nextFrame.dynamics?.derivativeVector || {},
            groundedClosure:
              nextFrame.state?.dag?.bottleneck === 'grounded_asserted_secret' ||
              (nextFrame.state?.dag?.finalSecretEntailed === true && nextFrame.state?.dag?.assertedSecret === true),
          }
        : null,
      response: turn.response || {},
      events: Array.from(new Set([...(frame.events || []), ...(turn.events || [])])).filter(Boolean),
      rewardProxy: {
        schema: 'machinespirits.tutor-stub.reward-proxy.v1',
        deltas: {
          learnerMastery: nextField ? fieldDelta(nextField, currentField, 'learnerMastery') : null,
          learnerRisk: nextField ? fieldDelta(nextField, currentField, 'learnerRisk') : null,
          coverage: nextField ? fieldDelta(nextField, currentField, 'coverage') : null,
          tutorAlignment: nextField ? fieldDelta(nextField, currentField, 'tutorAlignment') : null,
          jointMomentum: nextField ? fieldDelta(nextField, currentField, 'jointMomentum') : null,
        },
      },
      frame,
      transcriptTurn: turn,
    });
  }
  return examples;
}

function trainingExamplesFromRow(row = {}) {
  const examples = Array.isArray(row.trainingExamples?.examples) ? row.trainingExamples.examples : fallbackTrainingExamples(row);
  return examples.filter((example) => example && typeof example === 'object');
}

function rowsFromSummary(summary) {
  if (Array.isArray(summary.rows) && summary.rows.length) return summary.rows;
  const results = Array.isArray(summary.results) ? summary.results : [];
  return results.flatMap((result) => {
    const traceSummaries = Array.isArray(result.traceSummaries) ? result.traceSummaries : [];
    if (!traceSummaries.length) return [defaultFailedRow(result)];
    return traceSummaries.map((traceSummary) => ({
      policy: result.policy || null,
      runIndex: integerOrNull(result.runIndex),
      status: result.status || null,
      exitCode: integerOrNull(result.exitCode),
      signal: result.signal || null,
      log: result.log || null,
      ...traceSummary,
    }));
  });
}

function discoverSummaries(rootDir) {
  const root = resolvePath(rootDir);
  if (!fs.existsSync(root)) return [];
  const out = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(full);
      } else if (/^auto-eval-.*\.json$/u.test(entry.name)) {
        out.push(full);
      }
    }
  };
  visit(root);
  return out;
}

function inputSummaryPaths() {
  const explicit = positionals.flatMap((value) => {
    const resolved = resolvePath(value);
    if (!fs.existsSync(resolved)) throw new Error(`Summary path not found: ${value}`);
    if (fs.statSync(resolved).isDirectory()) return discoverSummaries(resolved);
    return [resolved];
  });
  const paths = explicit.length ? explicit : discoverSummaries(args.dir);
  const unique = [...new Map(paths.map((filePath) => [path.resolve(filePath), path.resolve(filePath)])).values()];
  unique.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs || a.localeCompare(b));
  const latest = csvLimit(args.latest, '--latest');
  return latest ? unique.slice(0, latest) : unique;
}

function openDb(dbPath) {
  const resolved = resolvePath(dbPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const db = new Database(resolved);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return { db, path: resolved };
}

function columnExists(db, table, column) {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((row) => row.name === column);
}

function addColumnIfMissing(db, table, column, definition) {
  if (!columnExists(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tutor_stub_eval_runs (
      id TEXT PRIMARY KEY,
      source_run_id TEXT NOT NULL,
      schema_version TEXT,
      source_hash TEXT NOT NULL,
      summary_path TEXT NOT NULL UNIQUE,
      html_path TEXT,
      trace_dir TEXT,
      started_at TEXT,
      completed_at TEXT,
      ingested_at TEXT NOT NULL,
      failed INTEGER,
      rows INTEGER,
      completed_rows INTEGER,
      ok_rows INTEGER,
      failed_rows INTEGER,
      dry_run_rows INTEGER,
      grounded_rows INTEGER,
      grounded_rate REAL,
      mean_turns REAL,
      mean_coverage REAL,
      mean_missing REAL,
      register_entropy REAL,
      configuration_realization_rate REAL,
      configuration_visible_difference_rate REAL,
      response_configuration_visibility_json TEXT,
      leak_count INTEGER,
      error_count INTEGER,
      world TEXT,
      policies_json TEXT,
      runs_per_policy INTEGER,
      turns TEXT,
      until_grounded INTEGER,
      safety_turns INTEGER,
      parallelism INTEGER,
      model TEXT,
      analysis_model TEXT,
      auto_learner_model TEXT,
      auto_learner_profile_id TEXT,
      max_tokens INTEGER,
      history_turns INTEGER,
      memory_summary_json TEXT,
      config_json TEXT,
      aggregates_json TEXT,
      report_json TEXT,
      resume_json TEXT
    );

    CREATE TABLE IF NOT EXISTS tutor_stub_eval_rows (
      id TEXT PRIMARY KEY,
      eval_run_id TEXT NOT NULL REFERENCES tutor_stub_eval_runs(id) ON DELETE CASCADE,
      policy TEXT,
      run_index INTEGER,
      status TEXT,
      exit_code INTEGER,
      signal TEXT,
      log_path TEXT,
      trace_path TEXT,
      trace_relative TEXT,
      events INTEGER,
      turn_count INTEGER,
      last_turn INTEGER,
      stop_reason TEXT,
      grounded_closure INTEGER,
      best_path_coverage REAL,
      missing_premise_count INTEGER,
      bottleneck TEXT,
      final_learner TEXT,
      final_tutor TEXT,
      register_entropy REAL,
      leak_count INTEGER,
      repaired_count INTEGER,
      fallback_count INTEGER,
      error_count INTEGER,
      register_counts_json TEXT,
      efficacy_counts_json TEXT,
      field_json TEXT,
      row_json TEXT,
      UNIQUE(eval_run_id, policy, run_index, trace_path)
    );

    CREATE TABLE IF NOT EXISTS tutor_stub_register_counts (
      eval_run_id TEXT NOT NULL REFERENCES tutor_stub_eval_runs(id) ON DELETE CASCADE,
      row_id TEXT NOT NULL REFERENCES tutor_stub_eval_rows(id) ON DELETE CASCADE,
      policy TEXT,
      run_index INTEGER,
      register TEXT NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY(row_id, register)
    );

	    CREATE TABLE IF NOT EXISTS tutor_stub_efficacy_counts (
      eval_run_id TEXT NOT NULL REFERENCES tutor_stub_eval_runs(id) ON DELETE CASCADE,
      row_id TEXT NOT NULL REFERENCES tutor_stub_eval_rows(id) ON DELETE CASCADE,
      policy TEXT,
      run_index INTEGER,
      efficacy TEXT NOT NULL,
      count INTEGER NOT NULL,
	      PRIMARY KEY(row_id, efficacy)
	    );

	    CREATE TABLE IF NOT EXISTS tutor_stub_turn_frames (
	      id TEXT PRIMARY KEY,
	      eval_run_id TEXT NOT NULL REFERENCES tutor_stub_eval_runs(id) ON DELETE CASCADE,
	      row_id TEXT NOT NULL REFERENCES tutor_stub_eval_rows(id) ON DELETE CASCADE,
	      policy TEXT,
	      run_index INTEGER,
	      turn INTEGER,
	      engagement_stance TEXT,
	      selected_register TEXT,
	      action_family TEXT,
	      audience_register TEXT,
	      lexical_accessibility TEXT,
	      scene_immersion TEXT,
	      response_configuration_json TEXT,
	      response_configuration_audit_json TEXT,
	      configuration_realization_rate REAL,
	      configuration_transcript_visible INTEGER,
	      register_policy TEXT,
	      register_vector_json TEXT,
	      register_distribution_json TEXT,
	      register_entropy_bits REAL,
	      state_vector_json TEXT,
	      derivative_vector_json TEXT,
	      dag_json TEXT,
	      learner_state_json TEXT,
	      field_json TEXT,
	      trajectory_json TEXT,
	      human_discourse_json TEXT,
	      scaffold_state_json TEXT,
	      side_arc_json TEXT,
	      proof_debt_json TEXT,
	      warrant_premise_audit_json TEXT,
	      learner_text TEXT,
	      tutor_text TEXT,
	      response_json TEXT,
	      events_json TEXT,
	      next_turn INTEGER,
	      next_field_json TEXT,
	      next_dag_json TEXT,
	      next_state_vector_json TEXT,
	      delta_mastery REAL,
	      delta_risk REAL,
	      delta_coverage REAL,
	      delta_alignment REAL,
	      delta_momentum REAL,
	      reward_proxy_json TEXT,
	      frame_json TEXT,
	      transcript_turn_json TEXT,
	      UNIQUE(row_id, turn)
	    );

	    CREATE INDEX IF NOT EXISTS idx_tutor_stub_runs_completed ON tutor_stub_eval_runs(completed_at);
	    CREATE INDEX IF NOT EXISTS idx_tutor_stub_runs_profile ON tutor_stub_eval_runs(auto_learner_profile_id);
	    CREATE INDEX IF NOT EXISTS idx_tutor_stub_rows_policy ON tutor_stub_eval_rows(policy);
	    CREATE INDEX IF NOT EXISTS idx_tutor_stub_rows_status ON tutor_stub_eval_rows(status);
	    CREATE INDEX IF NOT EXISTS idx_tutor_stub_rows_grounded ON tutor_stub_eval_rows(grounded_closure);
	    CREATE INDEX IF NOT EXISTS idx_tutor_stub_register_policy ON tutor_stub_register_counts(policy, register);
	    CREATE INDEX IF NOT EXISTS idx_tutor_stub_turn_frames_policy ON tutor_stub_turn_frames(policy, selected_register);
	    CREATE INDEX IF NOT EXISTS idx_tutor_stub_turn_frames_row ON tutor_stub_turn_frames(row_id, turn);

    DROP VIEW IF EXISTS v_tutor_stub_policy_summary;
    DROP VIEW IF EXISTS v_tutor_stub_register_effects;
    DROP VIEW IF EXISTS v_tutor_stub_turn_training;
    DROP VIEW IF EXISTS v_tutor_stub_failures;

    CREATE VIEW IF NOT EXISTS v_tutor_stub_policy_summary AS
      SELECT
        runs.auto_learner_profile_id,
        runs.world,
        rows.policy,
        COUNT(*) AS rows,
        SUM(CASE WHEN rows.status = 'ok' THEN 1 ELSE 0 END) AS ok_rows,
        SUM(CASE WHEN rows.status = 'failed' THEN 1 ELSE 0 END) AS failed_rows,
        ROUND(AVG(CASE WHEN rows.status = 'ok' THEN 1.0 ELSE 0.0 END), 4) AS ok_rate,
        ROUND(AVG(CASE WHEN rows.grounded_closure = 1 THEN 1.0 ELSE 0.0 END), 4) AS grounded_rate,
        ROUND(AVG(CASE WHEN rows.status = 'ok' THEN rows.turn_count END), 3) AS mean_turns_ok,
        ROUND(AVG(CASE WHEN rows.status = 'ok' THEN rows.best_path_coverage END), 3) AS mean_coverage_ok,
        ROUND(AVG(CASE WHEN rows.status = 'ok' THEN rows.missing_premise_count END), 3) AS mean_missing_ok,
        ROUND(AVG(CASE WHEN rows.status = 'ok' THEN rows.leak_count END), 3) AS mean_leaks_ok,
        ROUND(AVG(CASE WHEN rows.status = 'ok' THEN rows.register_entropy END), 3) AS mean_register_entropy_ok,
        ROUND(AVG(CASE WHEN rows.status = 'ok' THEN rows.configuration_realization_rate END), 3) AS mean_configuration_realization_ok,
        ROUND(AVG(CASE WHEN rows.status = 'ok' THEN rows.configuration_visible_difference_rate END), 3) AS mean_configuration_visible_difference_ok,
        MIN(runs.completed_at) AS first_completed_at,
        MAX(runs.completed_at) AS last_completed_at
      FROM tutor_stub_eval_rows rows
      JOIN tutor_stub_eval_runs runs ON runs.id = rows.eval_run_id
      GROUP BY runs.auto_learner_profile_id, runs.world, rows.policy;

    CREATE VIEW IF NOT EXISTS v_tutor_stub_register_effects AS
      SELECT
        runs.auto_learner_profile_id,
        runs.world,
        counts.policy,
        counts.register,
        SUM(counts.count) AS register_count,
        COUNT(DISTINCT counts.row_id) AS rows_with_register,
        ROUND(AVG(rows.turn_count), 3) AS mean_turns,
        ROUND(AVG(rows.grounded_closure), 4) AS grounded_rate,
  ROUND(AVG(rows.leak_count), 3) AS mean_leaks
	      FROM tutor_stub_register_counts counts
	      JOIN tutor_stub_eval_rows rows ON rows.id = counts.row_id
	      JOIN tutor_stub_eval_runs runs ON runs.id = counts.eval_run_id
	      GROUP BY runs.auto_learner_profile_id, runs.world, counts.policy, counts.register;

	    CREATE VIEW IF NOT EXISTS v_tutor_stub_turn_training AS
	      SELECT
	        runs.auto_learner_profile_id,
	        runs.world,
	        frames.policy,
	        frames.run_index,
	        frames.turn,
	        frames.engagement_stance,
	        frames.selected_register,
	        frames.action_family,
	        frames.audience_register,
	        frames.lexical_accessibility,
	        frames.scene_immersion,
	        frames.configuration_realization_rate,
	        frames.configuration_transcript_visible,
	        frames.response_configuration_json,
	        frames.response_configuration_audit_json,
	        frames.register_policy,
	        frames.register_entropy_bits,
	        frames.delta_mastery,
	        frames.delta_risk,
	        frames.delta_coverage,
	        frames.delta_alignment,
	        frames.delta_momentum,
	        frames.learner_text,
	        frames.tutor_text,
	        frames.register_vector_json,
	        frames.state_vector_json,
	        frames.derivative_vector_json,
	        frames.dag_json,
	        frames.learner_state_json,
	        frames.field_json,
	        frames.trajectory_json,
	        frames.human_discourse_json,
	        frames.scaffold_state_json,
	        frames.side_arc_json,
	        frames.proof_debt_json,
	        frames.warrant_premise_audit_json,
	        frames.reward_proxy_json
	      FROM tutor_stub_turn_frames frames
	      JOIN tutor_stub_eval_runs runs ON runs.id = frames.eval_run_id;

	    CREATE VIEW IF NOT EXISTS v_tutor_stub_failures AS
      SELECT
        runs.id AS eval_run_id,
        runs.summary_path,
        runs.auto_learner_profile_id,
        rows.policy,
        rows.run_index,
        rows.status,
        rows.exit_code,
        rows.stop_reason,
        rows.bottleneck,
        rows.log_path,
        rows.trace_path
      FROM tutor_stub_eval_rows rows
      JOIN tutor_stub_eval_runs runs ON runs.id = rows.eval_run_id
      WHERE rows.status != 'ok' OR rows.exit_code != 0;
  `);
  addColumnIfMissing(db, 'tutor_stub_turn_frames', 'human_discourse_json', 'TEXT');
  addColumnIfMissing(db, 'tutor_stub_turn_frames', 'scaffold_state_json', 'TEXT');
  addColumnIfMissing(db, 'tutor_stub_turn_frames', 'side_arc_json', 'TEXT');
  addColumnIfMissing(db, 'tutor_stub_turn_frames', 'proof_debt_json', 'TEXT');
  addColumnIfMissing(db, 'tutor_stub_turn_frames', 'warrant_premise_audit_json', 'TEXT');
  addColumnIfMissing(db, 'tutor_stub_eval_rows', 'configuration_realization_rate', 'REAL');
  addColumnIfMissing(db, 'tutor_stub_eval_rows', 'configuration_visible_difference_rate', 'REAL');
  addColumnIfMissing(db, 'tutor_stub_eval_rows', 'response_configuration_visibility_json', 'TEXT');
  addColumnIfMissing(db, 'tutor_stub_turn_frames', 'engagement_stance', 'TEXT');
  addColumnIfMissing(db, 'tutor_stub_turn_frames', 'action_family', 'TEXT');
  addColumnIfMissing(db, 'tutor_stub_turn_frames', 'audience_register', 'TEXT');
  addColumnIfMissing(db, 'tutor_stub_turn_frames', 'lexical_accessibility', 'TEXT');
  addColumnIfMissing(db, 'tutor_stub_turn_frames', 'scene_immersion', 'TEXT');
  addColumnIfMissing(db, 'tutor_stub_turn_frames', 'response_configuration_json', 'TEXT');
  addColumnIfMissing(db, 'tutor_stub_turn_frames', 'response_configuration_audit_json', 'TEXT');
  addColumnIfMissing(db, 'tutor_stub_turn_frames', 'configuration_realization_rate', 'REAL');
  addColumnIfMissing(db, 'tutor_stub_turn_frames', 'configuration_transcript_visible', 'INTEGER');
}

function ingestSummary(db, summaryPath) {
  const raw = fs.readFileSync(summaryPath, 'utf8');
  const summary = JSON.parse(raw);
  const rows = rowsFromSummary(summary);
  const aggregates = summary.aggregates || {};
  const config = summary.config || {};
  const dryRunRows = Number(aggregates.dryRun || rows.filter((row) => row.status === 'dry_run').length || 0);
  const realRows = rows.length - dryRunRows;
  if (!args['include-empty'] && rows.length === 0) return { skipped: true, reason: 'empty' };
  if (!args['include-dry-run'] && rows.length > 0 && realRows <= 0) return { skipped: true, reason: 'dry_run' };

  const runId = runIdForSummary(summaryPath);
  const now = new Date().toISOString();
  const summaryRelative = repoRelative(summaryPath);
  const hash = sourceHash(raw);
  const htmlPath = reportHtmlPath(summary, summaryPath);

  const transaction = db.transaction(() => {
    db.prepare(
      `
      INSERT INTO tutor_stub_eval_runs (
        id, source_run_id, schema_version, source_hash, summary_path, html_path, trace_dir,
        started_at, completed_at, ingested_at, failed, rows, completed_rows, ok_rows,
        failed_rows, dry_run_rows, grounded_rows, grounded_rate, mean_turns,
        mean_coverage, mean_missing, register_entropy, leak_count, error_count,
        world, policies_json, runs_per_policy, turns, until_grounded, safety_turns,
        parallelism, model, analysis_model, auto_learner_model, auto_learner_profile_id,
        max_tokens, history_turns, memory_summary_json, config_json, aggregates_json,
        report_json, resume_json
      ) VALUES (
        @id, @source_run_id, @schema_version, @source_hash, @summary_path, @html_path, @trace_dir,
        @started_at, @completed_at, @ingested_at, @failed, @rows, @completed_rows, @ok_rows,
        @failed_rows, @dry_run_rows, @grounded_rows, @grounded_rate, @mean_turns,
        @mean_coverage, @mean_missing, @register_entropy, @leak_count, @error_count,
        @world, @policies_json, @runs_per_policy, @turns, @until_grounded, @safety_turns,
        @parallelism, @model, @analysis_model, @auto_learner_model, @auto_learner_profile_id,
        @max_tokens, @history_turns, @memory_summary_json, @config_json, @aggregates_json,
        @report_json, @resume_json
      )
      ON CONFLICT(id) DO UPDATE SET
        source_run_id = excluded.source_run_id,
        schema_version = excluded.schema_version,
        source_hash = excluded.source_hash,
        summary_path = excluded.summary_path,
        html_path = excluded.html_path,
        trace_dir = excluded.trace_dir,
        started_at = excluded.started_at,
        completed_at = excluded.completed_at,
        ingested_at = excluded.ingested_at,
        failed = excluded.failed,
        rows = excluded.rows,
        completed_rows = excluded.completed_rows,
        ok_rows = excluded.ok_rows,
        failed_rows = excluded.failed_rows,
        dry_run_rows = excluded.dry_run_rows,
        grounded_rows = excluded.grounded_rows,
        grounded_rate = excluded.grounded_rate,
        mean_turns = excluded.mean_turns,
        mean_coverage = excluded.mean_coverage,
        mean_missing = excluded.mean_missing,
        register_entropy = excluded.register_entropy,
        leak_count = excluded.leak_count,
        error_count = excluded.error_count,
        world = excluded.world,
        policies_json = excluded.policies_json,
        runs_per_policy = excluded.runs_per_policy,
        turns = excluded.turns,
        until_grounded = excluded.until_grounded,
        safety_turns = excluded.safety_turns,
        parallelism = excluded.parallelism,
        model = excluded.model,
        analysis_model = excluded.analysis_model,
        auto_learner_model = excluded.auto_learner_model,
        auto_learner_profile_id = excluded.auto_learner_profile_id,
        max_tokens = excluded.max_tokens,
        history_turns = excluded.history_turns,
        memory_summary_json = excluded.memory_summary_json,
        config_json = excluded.config_json,
        aggregates_json = excluded.aggregates_json,
        report_json = excluded.report_json,
        resume_json = excluded.resume_json
    `,
    ).run({
      id: runId,
      source_run_id: runId,
      schema_version: summary.schema || null,
      source_hash: hash,
      summary_path: summaryRelative,
      html_path: htmlPath,
      trace_dir: config.traceDir ? repoRelative(config.traceDir) : null,
      started_at: summary.startedAt || null,
      completed_at: summary.completedAt || null,
      ingested_at: now,
      failed: boolInt(summary.failed),
      rows: integerOrNull(aggregates.rows) ?? rows.length,
      completed_rows: integerOrNull(aggregates.completed),
      ok_rows: integerOrNull(aggregates.ok),
      failed_rows: integerOrNull(aggregates.failed),
      dry_run_rows: dryRunRows,
      grounded_rows: integerOrNull(aggregates.grounded),
      grounded_rate: numberOrNull(aggregates.groundedRate),
      mean_turns: numberOrNull(aggregates.meanTurns),
      mean_coverage: numberOrNull(aggregates.meanCoverage),
      mean_missing: numberOrNull(aggregates.meanMissing),
      register_entropy: numberOrNull(aggregates.registerEntropy),
      leak_count: integerOrNull(aggregates.leakCount),
      error_count: integerOrNull(aggregates.errorCount),
      world: config.world || null,
      policies_json: safeJson(config.policies || []),
      runs_per_policy: integerOrNull(config.runs),
      turns: config.turns === undefined || config.turns === null ? null : String(config.turns),
      until_grounded: boolInt(config.untilGrounded),
      safety_turns: integerOrNull(config.safetyTurns),
      parallelism: integerOrNull(config.parallelism),
      model: config.model || null,
      analysis_model: config.analysisModel || null,
      auto_learner_model: config.autoLearnerModel || null,
      auto_learner_profile_id: config.autoLearnerProfileId || null,
      max_tokens: integerOrNull(config.maxTokens),
      history_turns: integerOrNull(config.historyTurns),
      memory_summary_json: safeJson(config.memorySummary || null),
      config_json: safeJson(config),
      aggregates_json: safeJson(aggregates),
      report_json: safeJson(summary.report || null),
      resume_json: safeJson(summary.resume || null),
    });

    db.prepare('DELETE FROM tutor_stub_turn_frames WHERE eval_run_id = ?').run(runId);
    db.prepare('DELETE FROM tutor_stub_efficacy_counts WHERE eval_run_id = ?').run(runId);
    db.prepare('DELETE FROM tutor_stub_register_counts WHERE eval_run_id = ?').run(runId);
    db.prepare('DELETE FROM tutor_stub_eval_rows WHERE eval_run_id = ?').run(runId);

    const insertRow = db.prepare(`
      INSERT INTO tutor_stub_eval_rows (
        id, eval_run_id, policy, run_index, status, exit_code, signal, log_path,
        trace_path, trace_relative, events, turn_count, last_turn, stop_reason,
        grounded_closure, best_path_coverage, missing_premise_count, bottleneck,
        final_learner, final_tutor, register_entropy, configuration_realization_rate,
        configuration_visible_difference_rate, response_configuration_visibility_json,
        leak_count, repaired_count,
        fallback_count, error_count, register_counts_json, efficacy_counts_json,
        field_json, row_json
      ) VALUES (
        @id, @eval_run_id, @policy, @run_index, @status, @exit_code, @signal, @log_path,
        @trace_path, @trace_relative, @events, @turn_count, @last_turn, @stop_reason,
        @grounded_closure, @best_path_coverage, @missing_premise_count, @bottleneck,
        @final_learner, @final_tutor, @register_entropy, @configuration_realization_rate,
        @configuration_visible_difference_rate, @response_configuration_visibility_json,
        @leak_count, @repaired_count,
        @fallback_count, @error_count, @register_counts_json, @efficacy_counts_json,
        @field_json, @row_json
      )
    `);
    const insertRegister = db.prepare(`
      INSERT INTO tutor_stub_register_counts (eval_run_id, row_id, policy, run_index, register, count)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertEfficacy = db.prepare(`
      INSERT INTO tutor_stub_efficacy_counts (eval_run_id, row_id, policy, run_index, efficacy, count)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertTurnFrame = db.prepare(`
      INSERT INTO tutor_stub_turn_frames (
        id, eval_run_id, row_id, policy, run_index, turn, engagement_stance, selected_register,
        action_family, audience_register, lexical_accessibility, scene_immersion,
        response_configuration_json, response_configuration_audit_json,
        configuration_realization_rate, configuration_transcript_visible,
        register_policy, register_vector_json, register_distribution_json,
        register_entropy_bits, state_vector_json, derivative_vector_json,
        dag_json, learner_state_json, field_json, trajectory_json,
        human_discourse_json, scaffold_state_json, side_arc_json, proof_debt_json,
        warrant_premise_audit_json, learner_text, tutor_text, response_json,
        events_json, next_turn, next_field_json, next_dag_json, next_state_vector_json, delta_mastery, delta_risk,
        delta_coverage, delta_alignment, delta_momentum, reward_proxy_json,
        frame_json, transcript_turn_json
      ) VALUES (
        @id, @eval_run_id, @row_id, @policy, @run_index, @turn, @engagement_stance, @selected_register,
        @action_family, @audience_register, @lexical_accessibility, @scene_immersion,
        @response_configuration_json, @response_configuration_audit_json,
        @configuration_realization_rate, @configuration_transcript_visible,
        @register_policy, @register_vector_json, @register_distribution_json,
        @register_entropy_bits, @state_vector_json, @derivative_vector_json,
        @dag_json, @learner_state_json, @field_json, @trajectory_json,
        @human_discourse_json, @scaffold_state_json, @side_arc_json, @proof_debt_json,
        @warrant_premise_audit_json, @learner_text, @tutor_text, @response_json,
        @events_json, @next_turn, @next_field_json, @next_dag_json, @next_state_vector_json, @delta_mastery, @delta_risk,
        @delta_coverage, @delta_alignment, @delta_momentum, @reward_proxy_json,
        @frame_json, @transcript_turn_json
      )
    `);

    rows.forEach((row, index) => {
      const policy = row.policy || null;
      const runIndex = integerOrNull(row.runIndex);
      const rowId = `${runId}:${policy || 'unknown'}:r${runIndex ?? index + 1}:${index + 1}`;
      insertRow.run({
        id: rowId,
        eval_run_id: runId,
        policy,
        run_index: runIndex,
        status: row.status || null,
        exit_code: integerOrNull(row.exitCode),
        signal: row.signal || null,
        log_path: row.log ? repoRelative(row.log) : null,
        trace_path: row.trace ? repoRelative(row.trace) : null,
        trace_relative: row.traceRelative || null,
        events: integerOrNull(row.events),
        turn_count: integerOrNull(row.turnCount),
        last_turn: integerOrNull(row.lastTurn),
        stop_reason: row.stopReason || null,
        grounded_closure: boolInt(row.groundedClosure),
        best_path_coverage: numberOrNull(row.bestPathCoverage),
        missing_premise_count: integerOrNull(row.missingPremiseCount),
        bottleneck: row.bottleneck || null,
        final_learner: row.finalLearner || null,
        final_tutor: row.finalTutor || null,
        register_entropy: numberOrNull(row.registerEntropy),
        configuration_realization_rate: numberOrNull(
          row.responseConfigurationVisibility?.mean_realization_rate,
        ),
        configuration_visible_difference_rate: numberOrNull(
          row.responseConfigurationVisibility?.pairwise_visible_difference_rate,
        ),
        response_configuration_visibility_json: safeJson(row.responseConfigurationVisibility || null),
        leak_count: integerOrNull(row.leakCount),
        repaired_count: integerOrNull(row.repairedCount),
        fallback_count: integerOrNull(row.fallbackCount),
        error_count: integerOrNull(row.errorCount),
        register_counts_json: safeJson(row.registerCounts || {}),
        efficacy_counts_json: safeJson(row.efficacyCounts || {}),
        field_json: safeJson(row.field || null),
        row_json: safeJson(row),
      });
      for (const [register, count] of Object.entries(row.registerCounts || {})) {
        const numeric = integerOrNull(count);
        if (numeric > 0) insertRegister.run(runId, rowId, policy, runIndex, register, numeric);
      }
      for (const [efficacy, count] of Object.entries(row.efficacyCounts || {})) {
        const numeric = integerOrNull(count);
        if (numeric > 0) insertEfficacy.run(runId, rowId, policy, runIndex, efficacy, numeric);
      }
      trainingExamplesFromRow(row).forEach((example, exampleIndex) => {
        const action = example.action || {};
        const before = example.stateBeforeAction || {};
        const outcome = example.outcomeAfterNextLearner || null;
        const reward = example.rewardProxy || {};
        const deltas = reward.deltas || {};
        const responseConfiguration = action.responseConfiguration || null;
        const responseConfigurationAudit = action.responseConfigurationAudit || null;
        const turn = integerOrNull(example.turn) ?? exampleIndex + 1;
        const humanDiscourse = before.humanDiscourse || example.humanDiscourse || example.frame?.humanDiscourse || null;
        insertTurnFrame.run({
          id: `${rowId}:t${turn}`,
          eval_run_id: runId,
          row_id: rowId,
          policy: example.policy || policy,
          run_index: runIndex,
          turn,
          engagement_stance: action.engagementStance || action.selectedRegister || null,
          selected_register: action.selectedRegister || action.engagementStance || null,
          action_family: action.actionFamily || responseConfiguration?.action_family || null,
          audience_register: action.audienceRegister || responseConfiguration?.audience_register || null,
          lexical_accessibility:
            action.lexicalAccessibility || responseConfiguration?.lexical_accessibility || null,
          scene_immersion: action.sceneImmersion || responseConfiguration?.scene_immersion || null,
          response_configuration_json: safeJson(responseConfiguration),
          response_configuration_audit_json: safeJson(responseConfigurationAudit),
          configuration_realization_rate: numberOrNull(responseConfigurationAudit?.realization_rate),
          configuration_transcript_visible: boolInt(responseConfigurationAudit?.transcript_visible),
          register_policy: action.registerPolicy || null,
          register_vector_json: safeJson(action.registerVector || null),
          register_distribution_json: safeJson(action.registerDistribution || []),
          register_entropy_bits: numberOrNull(action.registerVectorEntropyBits),
          state_vector_json: safeJson(before.stateVector || {}),
          derivative_vector_json: safeJson(before.derivativeVector || {}),
          dag_json: safeJson(before.dag || {}),
          learner_state_json: safeJson(before.learnerState || {}),
          field_json: safeJson(before.field || {}),
          trajectory_json: safeJson(before.trajectory || {}),
          human_discourse_json: safeJson(humanDiscourse),
          scaffold_state_json: safeJson(humanDiscourse?.scaffoldState || null),
          side_arc_json: safeJson(humanDiscourse?.sideArc || null),
          proof_debt_json: safeJson(humanDiscourse?.proofDebt || null),
          warrant_premise_audit_json: safeJson(humanDiscourse?.warrantPremiseAudit || null),
          learner_text: before.learnerText || null,
          tutor_text: action.tutorText || null,
          response_json: safeJson(example.response || {}),
          events_json: safeJson(example.events || []),
          next_turn: integerOrNull(outcome?.nextTurn),
          next_field_json: safeJson(outcome?.field || null),
          next_dag_json: safeJson(outcome?.dag || null),
          next_state_vector_json: safeJson(outcome?.stateVector || null),
          delta_mastery: numberOrNull(deltas.learnerMastery),
          delta_risk: numberOrNull(deltas.learnerRisk),
          delta_coverage: numberOrNull(deltas.coverage),
          delta_alignment: numberOrNull(deltas.tutorAlignment),
          delta_momentum: numberOrNull(deltas.jointMomentum),
          reward_proxy_json: safeJson(reward || null),
          frame_json: safeJson(example.frame || null),
          transcript_turn_json: safeJson(example.transcriptTurn || null),
        });
      });
    });
  });

  if (!args['dry-run']) transaction();
  return { skipped: false, id: runId, rows: rows.length, summaryPath: summaryRelative };
}

function main() {
  if (args.help) {
    usage();
    return;
  }
  const paths = inputSummaryPaths();
  if (!paths.length) {
    console.error(`No auto-eval summaries found under ${args.dir}`);
    process.exit(1);
  }
  const { db, path: dbPath } = args['dry-run'] ? { db: null, path: resolvePath(args.db) } : openDb(args.db);
  if (db) migrate(db);

  let ingested = 0;
  let skipped = 0;
  const details = [];
  for (const summaryPath of paths) {
    const result = db
      ? ingestSummary(db, summaryPath)
      : (() => {
          const raw = fs.readFileSync(summaryPath, 'utf8');
          const summary = JSON.parse(raw);
          const rows = rowsFromSummary(summary);
          const dryRunRows = Number(summary.aggregates?.dryRun || rows.filter((row) => row.status === 'dry_run').length || 0);
          const realRows = rows.length - dryRunRows;
          if (!args['include-empty'] && rows.length === 0) return { skipped: true, reason: 'empty' };
          if (!args['include-dry-run'] && rows.length > 0 && realRows <= 0) return { skipped: true, reason: 'dry_run' };
          return {
            skipped: false,
            id: runIdForSummary(summaryPath),
            rows: rows.length,
            summaryPath: repoRelative(summaryPath),
          };
        })();
    if (result.skipped) {
      skipped += 1;
      if (args.verbose) console.log(`[tutor-stub-ingest] skipped ${repoRelative(summaryPath)} (${result.reason})`);
    } else {
      ingested += 1;
      details.push(result);
      if (args.verbose) console.log(`[tutor-stub-ingest] ${result.id}: ${result.rows} rows from ${result.summaryPath}`);
    }
  }

  if (db) db.close();
  const prefix = args['dry-run'] ? '[tutor-stub-ingest] dry run' : '[tutor-stub-ingest]';
  console.log(`${prefix} db=${path.relative(ROOT, dbPath)} summaries=${paths.length} ingested=${ingested} skipped=${skipped}`);
  for (const detail of details.slice(0, 8)) {
    console.log(`  ${detail.id}: ${detail.rows} rows`);
  }
  if (details.length > 8) console.log(`  ... ${details.length - 8} more`);
}

try {
  main();
} catch (error) {
  console.error(`[tutor-stub-ingest] ${error.message}`);
  process.exit(1);
}
