import { createHash } from 'node:crypto';

function json(value) {
  return JSON.stringify(value ?? null);
}

function boolInt(value) {
  return value ? 1 : 0;
}

function stableRecordId(record) {
  const tracePath = record?.run?.tracePath || 'unknown-trace';
  const runId = record?.run?.id || 'unknown-run';
  const turnId = record?.turn?.id || `t${record?.turn?.number ?? 'unknown'}`;
  const digest = createHash('sha256').update(`${tracePath}\n${runId}\n${turnId}`).digest('hex').slice(0, 32);
  return `tutor-stub-failure:${digest}`;
}

export function migrateTutorStubTurnFailureStore(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tutor_stub_turn_failure_records (
      id TEXT PRIMARY KEY,
      schema_version TEXT NOT NULL,
      run_id TEXT,
      turn_id TEXT,
      turn_number INTEGER NOT NULL,
      trace_path TEXT NOT NULL,
      trace_sealed INTEGER NOT NULL,
      world_id TEXT,
      learner_profile_id TEXT,
      interaction_mode TEXT,
      provenance_sha TEXT,
      learner_authorship TEXT,
      learner_text TEXT,
      tutor_text TEXT,
      failure_count INTEGER NOT NULL,
      preference_pair_candidate INTEGER NOT NULL,
      corrected_target_candidate INTEGER NOT NULL,
      human_feedback_confirmed INTEGER NOT NULL,
      human_ground_truth_validated INTEGER NOT NULL DEFAULT 0,
      training_licensed INTEGER NOT NULL DEFAULT 0 CHECK (training_licensed = 0),
      exclusions_json TEXT NOT NULL,
      rejected_candidates_json TEXT NOT NULL,
      public_context_json TEXT NOT NULL,
      signals_json TEXT NOT NULL,
      next_turn_outcome_json TEXT,
      record_json TEXT NOT NULL,
      source_hash TEXT,
      ingested_at TEXT NOT NULL,
      UNIQUE(trace_path, turn_number)
    );

    CREATE TABLE IF NOT EXISTS tutor_stub_turn_failure_labels (
      record_id TEXT NOT NULL REFERENCES tutor_stub_turn_failure_records(id) ON DELETE CASCADE,
      mode TEXT NOT NULL,
      subject TEXT NOT NULL,
      status TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      source TEXT NOT NULL,
      confidence TEXT NOT NULL,
      evidence_json TEXT NOT NULL,
      PRIMARY KEY(record_id, mode)
    );

    CREATE INDEX IF NOT EXISTS idx_tutor_stub_turn_failure_records_run
      ON tutor_stub_turn_failure_records(run_id, turn_number);
    CREATE INDEX IF NOT EXISTS idx_tutor_stub_turn_failure_records_trace
      ON tutor_stub_turn_failure_records(trace_path, turn_number);
    CREATE INDEX IF NOT EXISTS idx_tutor_stub_turn_failure_records_candidates
      ON tutor_stub_turn_failure_records(preference_pair_candidate, corrected_target_candidate);
    CREATE INDEX IF NOT EXISTS idx_tutor_stub_turn_failure_labels_mode
      ON tutor_stub_turn_failure_labels(mode, status);

    DROP VIEW IF EXISTS v_tutor_stub_turn_failures;
    CREATE VIEW v_tutor_stub_turn_failures AS
      SELECT
        records.id AS record_id,
        records.run_id,
        records.turn_id,
        records.turn_number,
        records.trace_path,
        records.trace_sealed,
        records.world_id,
        records.learner_profile_id,
        records.learner_authorship,
        labels.mode,
        labels.subject,
        labels.status,
        labels.observed_at,
        labels.source,
        labels.confidence,
        records.preference_pair_candidate,
        records.corrected_target_candidate,
        records.human_feedback_confirmed,
        records.human_ground_truth_validated,
        records.training_licensed,
        records.learner_text,
        records.tutor_text,
        labels.evidence_json
      FROM tutor_stub_turn_failure_records records
      JOIN tutor_stub_turn_failure_labels labels ON labels.record_id = records.id;

    DROP VIEW IF EXISTS v_tutor_stub_corrective_candidates;
    CREATE VIEW v_tutor_stub_corrective_candidates AS
      SELECT
        id AS record_id,
        run_id,
        turn_id,
        turn_number,
        trace_path,
        world_id,
        learner_profile_id,
        learner_authorship,
        preference_pair_candidate,
        corrected_target_candidate,
        human_feedback_confirmed,
        human_ground_truth_validated,
        training_licensed,
        learner_text,
        tutor_text,
        rejected_candidates_json,
        exclusions_json,
        record_json
      FROM tutor_stub_turn_failure_records
      WHERE preference_pair_candidate = 1 OR corrected_target_candidate = 1;
  `);
}

export function replaceTutorStubTurnFailureRecords(
  db,
  records,
  { tracePaths = [], sourceHashes = {}, ingestedAt = new Date().toISOString() } = {},
) {
  const insertRecord = db.prepare(`
    INSERT INTO tutor_stub_turn_failure_records (
      id, schema_version, run_id, turn_id, turn_number, trace_path, trace_sealed,
      world_id, learner_profile_id, interaction_mode, provenance_sha,
      learner_authorship, learner_text, tutor_text, failure_count,
      preference_pair_candidate, corrected_target_candidate,
      human_feedback_confirmed, human_ground_truth_validated, training_licensed,
      exclusions_json, rejected_candidates_json, public_context_json, signals_json,
      next_turn_outcome_json, record_json, source_hash, ingested_at
    ) VALUES (
      @id, @schema_version, @run_id, @turn_id, @turn_number, @trace_path, @trace_sealed,
      @world_id, @learner_profile_id, @interaction_mode, @provenance_sha,
      @learner_authorship, @learner_text, @tutor_text, @failure_count,
      @preference_pair_candidate, @corrected_target_candidate,
      @human_feedback_confirmed, @human_ground_truth_validated, 0,
      @exclusions_json, @rejected_candidates_json, @public_context_json, @signals_json,
      @next_turn_outcome_json, @record_json, @source_hash, @ingested_at
    )
    ON CONFLICT(id) DO UPDATE SET
      schema_version = excluded.schema_version,
      run_id = excluded.run_id,
      turn_id = excluded.turn_id,
      turn_number = excluded.turn_number,
      trace_path = excluded.trace_path,
      trace_sealed = excluded.trace_sealed,
      world_id = excluded.world_id,
      learner_profile_id = excluded.learner_profile_id,
      interaction_mode = excluded.interaction_mode,
      provenance_sha = excluded.provenance_sha,
      learner_authorship = excluded.learner_authorship,
      learner_text = excluded.learner_text,
      tutor_text = excluded.tutor_text,
      failure_count = excluded.failure_count,
      preference_pair_candidate = excluded.preference_pair_candidate,
      corrected_target_candidate = excluded.corrected_target_candidate,
      human_feedback_confirmed = excluded.human_feedback_confirmed,
      human_ground_truth_validated = 0,
      training_licensed = 0,
      exclusions_json = excluded.exclusions_json,
      rejected_candidates_json = excluded.rejected_candidates_json,
      public_context_json = excluded.public_context_json,
      signals_json = excluded.signals_json,
      next_turn_outcome_json = excluded.next_turn_outcome_json,
      record_json = excluded.record_json,
      source_hash = excluded.source_hash,
      ingested_at = excluded.ingested_at
  `);
  const insertLabel = db.prepare(`
    INSERT INTO tutor_stub_turn_failure_labels (
      record_id, mode, subject, status, observed_at, source, confidence, evidence_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const removeTrace = db.prepare('DELETE FROM tutor_stub_turn_failure_records WHERE trace_path = ?');
  const removeLabels = db.prepare('DELETE FROM tutor_stub_turn_failure_labels WHERE record_id = ?');

  const transaction = db.transaction(() => {
    for (const tracePath of new Set(tracePaths.filter(Boolean))) removeTrace.run(tracePath);
    for (const record of records) {
      const id = stableRecordId(record);
      const tracePath = record.run?.tracePath || 'unknown-trace';
      insertRecord.run({
        id,
        schema_version: record.schema,
        run_id: record.run?.id || null,
        turn_id: record.turn?.id || null,
        turn_number: Number(record.turn?.number),
        trace_path: tracePath,
        trace_sealed: boolInt(record.run?.sealed),
        world_id: record.run?.worldId || null,
        learner_profile_id: record.run?.learnerProfileId || null,
        interaction_mode: record.run?.interactionMode || null,
        provenance_sha: record.run?.provenanceSha || null,
        learner_authorship: record.turn?.learnerAuthorship || null,
        learner_text: record.publicContext?.learner || null,
        tutor_text: record.delivered?.text || null,
        failure_count: record.failures?.length || 0,
        preference_pair_candidate: boolInt(record.training?.preferencePairCandidate),
        corrected_target_candidate: boolInt(record.training?.correctedTargetCandidate),
        human_feedback_confirmed: boolInt(record.training?.humanFeedbackConfirmed),
        human_ground_truth_validated: 0,
        exclusions_json: json(record.training?.exclusions || []),
        rejected_candidates_json: json(record.rejectedCandidates || []),
        public_context_json: json(record.publicContext || {}),
        signals_json: json(record.signals || {}),
        next_turn_outcome_json: record.nextTurnOutcome ? json(record.nextTurnOutcome) : null,
        record_json: json(record),
        source_hash: sourceHashes[tracePath] || null,
        ingested_at: ingestedAt,
      });
      removeLabels.run(id);
      for (const failure of record.failures || []) {
        insertLabel.run(
          id,
          failure.mode,
          failure.subject,
          failure.status,
          failure.observedAt,
          failure.source,
          failure.confidence,
          json(failure.evidence || {}),
        );
      }
    }
  });
  transaction();
  return {
    records: records.length,
    labels: records.reduce((total, record) => total + (record.failures?.length || 0), 0),
    traces: new Set(tracePaths.filter(Boolean)).size,
  };
}
