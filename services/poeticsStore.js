import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

function defaultDbPath() {
  return process.env.EVAL_DB_PATH || path.join(DATA_DIR, 'evaluations.db');
}

function encodeJson(value) {
  return value == null ? null : JSON.stringify(value);
}

export function migratePoeticsStore(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS poetics_runs (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      source_root TEXT NOT NULL,
      batch_id TEXT,
      generator TEXT,
      generator_model TEXT,
      spec_path TEXT,
      key_path TEXT,
      git_commit TEXT,
      metadata TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_poetics_runs_source_root ON poetics_runs(source_root);

    CREATE TABLE IF NOT EXISTS poetics_items (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES poetics_runs(id) ON DELETE CASCADE,
      unit_id TEXT,
      repeat TEXT,
      arm TEXT,
      tid TEXT NOT NULL,
      drama_id TEXT,
      discipline TEXT,
      condition_name TEXT,
      intended_lean TEXT,
      control_family TEXT,
      control_role TEXT,
      sample_path TEXT,
      full_transcript_path TEXT,
      key_path TEXT,
      quality_status TEXT,
      quality_warnings TEXT,
      content_hash TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(run_id, unit_id, arm, tid)
    );
    CREATE INDEX IF NOT EXISTS idx_poetics_items_run ON poetics_items(run_id);
    CREATE INDEX IF NOT EXISTS idx_poetics_items_drama ON poetics_items(drama_id);

    CREATE TABLE IF NOT EXISTS poetics_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT NOT NULL REFERENCES poetics_items(id) ON DELETE CASCADE,
      critic_model TEXT NOT NULL,
      score_file TEXT NOT NULL,
      form_class TEXT,
      recontextualization REAL,
      stated_insight REAL,
      rupture REAL,
      global_coherence REAL,
      pivot_learner_turn INTEGER,
      recohered_earlier TEXT,
      stated_insight_evidence TEXT,
      error_message TEXT,
      flags TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(item_id, critic_model, score_file)
    );
    CREATE INDEX IF NOT EXISTS idx_poetics_scores_item ON poetics_scores(item_id);
    CREATE INDEX IF NOT EXISTS idx_poetics_scores_critic ON poetics_scores(critic_model);

    CREATE TABLE IF NOT EXISTS poetics_labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT NOT NULL REFERENCES poetics_items(id) ON DELETE CASCADE,
      labeller_id TEXT NOT NULL,
      perspective TEXT NOT NULL DEFAULT 'human',
      label_file TEXT NOT NULL,
      form_class TEXT NOT NULL,
      pivot_learner_turn INTEGER,
      rationale TEXT,
      metadata TEXT,
      labelled_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(item_id, labeller_id, perspective, label_file)
    );
    CREATE INDEX IF NOT EXISTS idx_poetics_labels_item ON poetics_labels(item_id);
    CREATE INDEX IF NOT EXISTS idx_poetics_labels_labeller ON poetics_labels(labeller_id);

    CREATE TABLE IF NOT EXISTS poetics_review_flags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT NOT NULL REFERENCES poetics_items(id) ON DELETE CASCADE,
      flagger_id TEXT NOT NULL,
      flag_type TEXT NOT NULL DEFAULT 'human_review',
      priority TEXT NOT NULL DEFAULT 'normal',
      reason TEXT,
      metadata TEXT,
      resolved_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(item_id, flagger_id, flag_type)
    );
    CREATE INDEX IF NOT EXISTS idx_poetics_review_flags_item ON poetics_review_flags(item_id);
    CREATE INDEX IF NOT EXISTS idx_poetics_review_flags_flagger ON poetics_review_flags(flagger_id);
  `);
}

export function openPoeticsStore(dbPath = defaultDbPath()) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migratePoeticsStore(db);
  return db;
}

export function upsertPoeticsRun(db, run) {
  db.prepare(
    `INSERT INTO poetics_runs
      (id, source_root, batch_id, generator, generator_model, spec_path, key_path, git_commit, metadata)
     VALUES
      (@id, @source_root, @batch_id, @generator, @generator_model, @spec_path, @key_path, @git_commit, @metadata)
     ON CONFLICT(id) DO UPDATE SET
      source_root = excluded.source_root,
      batch_id = excluded.batch_id,
      generator = excluded.generator,
      generator_model = excluded.generator_model,
      spec_path = excluded.spec_path,
      key_path = excluded.key_path,
      git_commit = excluded.git_commit,
      metadata = excluded.metadata`,
  ).run({
    id: run.id,
    source_root: run.sourceRoot,
    batch_id: run.batchId ?? null,
    generator: run.generator ?? null,
    generator_model: run.generatorModel ?? null,
    spec_path: run.specPath ?? null,
    key_path: run.keyPath ?? null,
    git_commit: run.gitCommit ?? null,
    metadata: encodeJson(run.metadata ?? null),
  });
}

export function upsertPoeticsItem(db, item) {
  db.prepare(
    `INSERT INTO poetics_items
      (id, run_id, unit_id, repeat, arm, tid, drama_id, discipline, condition_name,
       intended_lean, control_family, control_role, sample_path, full_transcript_path,
       key_path, quality_status, quality_warnings, content_hash, metadata)
     VALUES
      (@id, @run_id, @unit_id, @repeat, @arm, @tid, @drama_id, @discipline,
       @condition_name, @intended_lean, @control_family, @control_role, @sample_path,
       @full_transcript_path, @key_path, @quality_status, @quality_warnings,
       @content_hash, @metadata)
     ON CONFLICT(run_id, unit_id, arm, tid) DO UPDATE SET
      drama_id = excluded.drama_id,
      discipline = excluded.discipline,
      condition_name = excluded.condition_name,
      intended_lean = excluded.intended_lean,
      control_family = excluded.control_family,
      control_role = excluded.control_role,
      sample_path = excluded.sample_path,
      full_transcript_path = excluded.full_transcript_path,
      key_path = excluded.key_path,
      quality_status = excluded.quality_status,
      quality_warnings = excluded.quality_warnings,
      content_hash = excluded.content_hash,
      metadata = excluded.metadata`,
  ).run({
    id: item.id,
    run_id: item.runId,
    unit_id: item.unitId ?? null,
    repeat: item.repeat ?? null,
    arm: item.arm ?? 'default',
    tid: item.tid,
    drama_id: item.dramaId ?? null,
    discipline: item.discipline ?? null,
    condition_name: item.condition ?? null,
    intended_lean: item.intendedLean ?? null,
    control_family: item.controlFamily ?? null,
    control_role: item.controlRole ?? null,
    sample_path: item.samplePath ?? null,
    full_transcript_path: item.fullTranscriptPath ?? null,
    key_path: item.keyPath ?? null,
    quality_status: item.qualityStatus ?? null,
    quality_warnings: encodeJson(item.qualityWarnings ?? []),
    content_hash: item.contentHash ?? null,
    metadata: encodeJson(item.metadata ?? null),
  });
}

export function upsertPoeticsScore(db, score) {
  db.prepare(
    `INSERT INTO poetics_scores
      (item_id, critic_model, score_file, form_class, recontextualization,
       stated_insight, rupture, global_coherence, pivot_learner_turn,
       recohered_earlier, stated_insight_evidence, error_message, flags, metadata)
     VALUES
      (@item_id, @critic_model, @score_file, @form_class, @recontextualization,
       @stated_insight, @rupture, @global_coherence, @pivot_learner_turn,
       @recohered_earlier, @stated_insight_evidence, @error_message, @flags, @metadata)
     ON CONFLICT(item_id, critic_model, score_file) DO UPDATE SET
      form_class = excluded.form_class,
      recontextualization = excluded.recontextualization,
      stated_insight = excluded.stated_insight,
      rupture = excluded.rupture,
      global_coherence = excluded.global_coherence,
      pivot_learner_turn = excluded.pivot_learner_turn,
      recohered_earlier = excluded.recohered_earlier,
      stated_insight_evidence = excluded.stated_insight_evidence,
      error_message = excluded.error_message,
      flags = excluded.flags,
      metadata = excluded.metadata`,
  ).run({
    item_id: score.itemId,
    critic_model: score.criticModel,
    score_file: score.scoreFile,
    form_class: score.formClass ?? null,
    recontextualization: score.recontextualization ?? null,
    stated_insight: score.statedInsight ?? null,
    rupture: score.rupture ?? null,
    global_coherence: score.globalCoherence ?? null,
    pivot_learner_turn: score.pivotLearnerTurn ?? null,
    recohered_earlier: score.recoheredEarlier ?? null,
    stated_insight_evidence: score.statedInsightEvidence ?? null,
    error_message: score.errorMessage ?? null,
    flags: encodeJson(score.flags ?? []),
    metadata: encodeJson(score.metadata ?? null),
  });
}

export function upsertPoeticsLabel(db, label) {
  db.prepare(
    `INSERT INTO poetics_labels
      (item_id, labeller_id, perspective, label_file, form_class, pivot_learner_turn,
       rationale, metadata, labelled_at)
     VALUES
      (@item_id, @labeller_id, @perspective, @label_file, @form_class,
       @pivot_learner_turn, @rationale, @metadata, @labelled_at)
     ON CONFLICT(item_id, labeller_id, perspective, label_file) DO UPDATE SET
      form_class = excluded.form_class,
      pivot_learner_turn = excluded.pivot_learner_turn,
      rationale = excluded.rationale,
      metadata = excluded.metadata,
      labelled_at = excluded.labelled_at`,
  ).run({
    item_id: label.itemId,
    labeller_id: label.labellerId,
    perspective: label.perspective || 'human',
    label_file: label.labelFile,
    form_class: label.formClass,
    pivot_learner_turn: label.pivotLearnerTurn ?? null,
    rationale: label.rationale ?? null,
    metadata: encodeJson(label.metadata ?? null),
    labelled_at: label.labelledAt ?? null,
  });
}

export function upsertPoeticsReviewFlag(db, flag) {
  db.prepare(
    `INSERT INTO poetics_review_flags
      (item_id, flagger_id, flag_type, priority, reason, metadata, resolved_at)
     VALUES
      (@item_id, @flagger_id, @flag_type, @priority, @reason, @metadata, @resolved_at)
     ON CONFLICT(item_id, flagger_id, flag_type) DO UPDATE SET
      priority = excluded.priority,
      reason = excluded.reason,
      metadata = excluded.metadata,
      resolved_at = excluded.resolved_at`,
  ).run({
    item_id: flag.itemId,
    flagger_id: flag.flaggerId,
    flag_type: flag.flagType || 'human_review',
    priority: flag.priority || 'normal',
    reason: flag.reason ?? null,
    metadata: encodeJson(flag.metadata ?? null),
    resolved_at: flag.resolvedAt ?? null,
  });
}

export function resolvePoeticsReviewFlag(db, flag) {
  db.prepare(
    `UPDATE poetics_review_flags
     SET resolved_at = @resolved_at
     WHERE item_id = @item_id AND flagger_id = @flagger_id AND flag_type = @flag_type`,
  ).run({
    item_id: flag.itemId,
    flagger_id: flag.flaggerId,
    flag_type: flag.flagType || 'human_review',
    resolved_at: flag.resolvedAt || new Date().toISOString(),
  });
}
