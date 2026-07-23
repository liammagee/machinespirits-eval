import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function traceEvents({ sealed = true } = {}) {
  const first = {
    turn: 1,
    turnId: 'run-ingest-test:t001',
    learner: 'I cannot answer that from the evidence shown.',
    learnerResponseProvenance: { authorship: 'human' },
    tutor: 'Which public record names the material test?',
    tutorResponseRepaired: true,
    tutorDeterministicFallback: false,
    tutorGuardAccounting: {
      attempts: [
        {
          kind: 'original_candidate',
          attempt: 0,
          candidate: { text: 'What is the answer?' },
          auditOk: false,
          guardedSpans: [
            {
              guard: 'question_support',
              issueType: 'unanswerable_open_recall',
              reason: 'The answer is not public.',
            },
          ],
        },
        {
          kind: 'model_repair_candidate',
          attempt: 1,
          candidate: { text: 'Which public record names the material test?' },
          auditOk: true,
        },
      ],
      finalDelivery: {
        source: 'model_repair_candidate',
        auditOk: true,
        candidate: { text: 'Which public record names the material test?' },
      },
    },
  };
  const second = {
    turn: 2,
    turnId: 'run-ingest-test:t002',
    learner: 'That still felt too abstract.',
    learnerResponseProvenance: { authorship: 'human' },
    previousRegisterEfficacy: {
      registerTurn: 1,
      evaluatedAtTurn: 2,
      label: 'regression_or_overreach',
      progressScore: -1,
    },
    feedbackObservation: {
      feedback: { rating: 'down', reason: 'too_abstract', comment: 'review-only note' },
      ratedResponse: { turn: 1, turnId: 'run-ingest-test:t001' },
      outcomes: { subjectiveHelpfulness: -1 },
    },
    pointOfAction: {
      assigned_trigger: 'warrant_skip',
      compliance: { compliant: false, detector_version: 'test-v1' },
    },
    tutor: 'What does the assay slip establish?',
    tutorResponseRepaired: false,
    tutorDeterministicFallback: false,
    tutorGuardAccounting: {
      attempts: [],
      finalDelivery: { source: 'original_candidate', auditOk: true },
    },
  };
  return [
    {
      type: 'run_start',
      runId: 'run-ingest-test',
      metadata: {
        world: { id: 'world_test' },
        autoLearner: { profileId: 'proof_skipper' },
        provenance: { git: { sha: 'abc123' } },
      },
    },
    { type: 'tutor_opening', text: 'Two public records are on the desk.' },
    { type: 'turn_complete', turnRecord: first },
    { type: 'turn_complete', turnRecord: second },
    ...(sealed ? [{ type: 'run_end', reason: 'test' }] : []),
  ];
}

function writeTrace(filePath, options) {
  fs.writeFileSync(
    filePath,
    `${traceEvents(options)
      .map((event) => JSON.stringify(event))
      .join('\n')}\n`,
  );
}

function ingest(tracePath, dbPath) {
  return JSON.parse(
    execFileSync(process.execPath, ['scripts/ingest-tutor-stub-turn-failures.js', tracePath, '--db', dbPath], {
      cwd: ROOT,
      encoding: 'utf8',
    }),
  );
}

test('turn-failure traces ingest idempotently into review-gated SQL tables and views', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-turn-failure-ingest-'));
  const tracePath = path.join(temporary, 'sealed.jsonl');
  const dbPath = path.join(temporary, 'evaluations.db');
  writeTrace(tracePath, { sealed: true });

  const firstSummary = ingest(tracePath, dbPath);
  const secondSummary = ingest(tracePath, dbPath);
  assert.equal(firstSummary.zeroModelCalls, true);
  assert.equal(firstSummary.records, 2);
  assert.equal(firstSummary.labels, 4);
  assert.equal(firstSummary.humanFeedbackConfirmedRecords, 1);
  assert.equal(firstSummary.humanGroundTruthValidatedRecords, 0);
  assert.equal(firstSummary.trainingLicensed, false);
  assert.equal(secondSummary.write.records, 2);

  const db = new Database(dbPath, { readonly: true });
  try {
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM tutor_stub_turn_failure_records').get().count, 2);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM tutor_stub_turn_failure_labels').get().count, 4);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM v_tutor_stub_turn_failures').get().count, 4);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM v_tutor_stub_corrective_candidates').get().count, 1);
    const candidate = db
      .prepare(
        `SELECT trace_sealed, preference_pair_candidate, corrected_target_candidate,
                human_feedback_confirmed, human_ground_truth_validated,
                training_licensed, source_hash, record_json
         FROM tutor_stub_turn_failure_records
         WHERE turn_number = 1`,
      )
      .get();
    assert.equal(candidate.trace_sealed, 1);
    assert.equal(candidate.preference_pair_candidate, 1);
    assert.equal(candidate.corrected_target_candidate, 1);
    assert.equal(candidate.human_feedback_confirmed, 1);
    assert.equal(candidate.human_ground_truth_validated, 0);
    assert.equal(candidate.training_licensed, 0);
    assert.equal(candidate.source_hash.length, 64);
    assert.equal(candidate.record_json.includes('review-only note'), false);
    const labels = db.prepare('SELECT mode, status FROM v_tutor_stub_turn_failures ORDER BY mode').all();
    assert.deepEqual(
      labels.map((row) => [row.mode, row.status]),
      [
        ['conduct.warrant_skip.unhandled', 'confirmed'],
        ['feedback.too_abstract', 'human_reported'],
        ['guard.question_support.unanswerable_open_recall', 'confirmed'],
        ['interaction.regression_or_overreach', 'confirmed'],
      ],
    );
  } finally {
    db.close();
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('unsealed trace records remain queryable but cannot become corrective candidates', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-turn-failure-unsealed-'));
  const tracePath = path.join(temporary, 'unsealed.jsonl');
  const dbPath = path.join(temporary, 'evaluations.db');
  writeTrace(tracePath, { sealed: false });
  const summary = ingest(tracePath, dbPath);
  assert.equal(summary.sealedTraces, 0);

  const db = new Database(dbPath, { readonly: true });
  try {
    const candidate = db
      .prepare(
        `SELECT trace_sealed, preference_pair_candidate, corrected_target_candidate,
                training_licensed, exclusions_json
         FROM tutor_stub_turn_failure_records
         WHERE turn_number = 1`,
      )
      .get();
    assert.equal(candidate.trace_sealed, 0);
    assert.equal(candidate.preference_pair_candidate, 0);
    assert.equal(candidate.corrected_target_candidate, 0);
    assert.equal(candidate.training_licensed, 0);
    assert.ok(JSON.parse(candidate.exclusions_json).includes('unsealed_trace'));
  } finally {
    db.close();
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('malformed traces remain diagnosable but fail closed before SQL replacement', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-turn-failure-malformed-'));
  try {
    const tracePath = path.join(temporary, 'malformed.jsonl');
    const dbPath = path.join(temporary, 'evaluations.db');
    writeTrace(tracePath, { sealed: true });
    fs.appendFileSync(tracePath, 'not-json\n');

    const dryRun = JSON.parse(
      execFileSync(
        process.execPath,
        ['scripts/ingest-tutor-stub-turn-failures.js', tracePath, '--db', dbPath, '--dry-run'],
        { cwd: ROOT, encoding: 'utf8' },
      ),
    );
    assert.equal(dryRun.malformedLines, 1);
    assert.equal(dryRun.dbWritten, false);

    const write = spawnSync(
      process.execPath,
      ['scripts/ingest-tutor-stub-turn-failures.js', tracePath, '--db', dbPath],
      { cwd: ROOT, encoding: 'utf8' },
    );
    assert.equal(write.status, 1);
    assert.match(write.stderr, /Refusing SQL replacement: 1 malformed JSONL line/u);
    assert.equal(fs.existsSync(dbPath), false);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
