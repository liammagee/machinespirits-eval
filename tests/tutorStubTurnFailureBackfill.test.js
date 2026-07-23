import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  backfillTutorStubTurnFailures,
  buildTutorStubTurnFailureTraceEvents,
  parseTutorStubTraceJsonl,
  tutorStubFailureModeMatches,
} from '../services/tutorStubTurnFailureBackfill.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function runStart() {
  return {
    type: 'run_start',
    runId: 'run-backfill-test',
    metadata: {
      world: { id: 'world_test' },
      autoLearner: { profileId: 'proof_skipper' },
      provenance: { git: { sha: 'abc123' } },
    },
  };
}

function acceptedRepairTurn() {
  return {
    turn: 1,
    turnId: 'run-backfill-test:t001',
    learner: 'I cannot answer that from what you have shown me.',
    learnerResponseProvenance: { authorship: 'human' },
    classification: {
      turn: {
        request_type: 'conceptual_clarity_request',
        discourse_move: 'repair_request',
        evidence_use: 'none',
        epistemic_stance: 'confused',
        affect: 'frustrated',
        agency: 'medium',
        pedagogical_need: 'Make the available choice explicit.',
      },
    },
    tutor: 'You have two public records. Which one directly names the material test?',
    tutorResponseRepaired: true,
    tutorDeterministicFallback: false,
    provider: 'codex',
    model: 'gpt-test',
    tutorGuardAccounting: {
      outcome: 'guarded_model_repair_accepted',
      attempts: [
        {
          kind: 'original_candidate',
          attempt: 0,
          provider: 'codex',
          model: 'gpt-test',
          candidate: { text: 'What is the answer?' },
          auditOk: false,
          guardedSpans: [
            {
              guard: 'question_support',
              issueType: 'unanswerable_open_recall',
              reason: 'The answer is not public.',
              start: 0,
              end: 19,
              text: 'What is the answer?',
            },
          ],
        },
        {
          kind: 'model_repair_candidate',
          attempt: 1,
          provider: 'codex',
          model: 'gpt-test',
          candidate: { text: 'You have two public records. Which one directly names the material test?' },
          auditOk: true,
          guardedSpans: [],
        },
      ],
      finalDelivery: {
        source: 'model_repair_candidate',
        provider: 'codex',
        model: 'gpt-test',
        auditOk: true,
        candidate: { text: 'You have two public records. Which one directly names the material test?' },
      },
    },
  };
}

function nextTurnWithFeedbackAndRegression() {
  return {
    turn: 2,
    turnId: 'run-backfill-test:t002',
    learner: 'That was still too abstract.',
    learnerResponseProvenance: { authorship: 'human' },
    classification: {
      turn: {
        request_type: 'plain_language_request',
        discourse_move: 'repair_request',
        evidence_use: 'omits_warrant',
        epistemic_stance: 'confused',
        affect: 'frustrated',
        agency: 'low',
        pedagogical_need: 'Use one concrete object.',
      },
    },
    previousRegisterEfficacy: {
      schema: 'machinespirits.tutor-stub.register-efficacy.v1',
      registerTurn: 1,
      evaluatedAtTurn: 2,
      label: 'regression_or_overreach',
      progressScore: -1,
      dagProgress: false,
      mismatch: 'neither_progress',
      delta: { unsupportedAssertionCount: 1 },
      caveat: 'Heuristic local association only.',
    },
    feedbackObservation: {
      schema: 'machinespirits.tutor-stub.feedback-observation.v1',
      feedback: {
        rating: 'down',
        reason: 'too_abstract',
        reasonLabel: 'too abstract',
        scope: 'tutor_prompt',
        comment: 'private comment must not be copied',
      },
      ratedResponse: { turn: 1, turnId: 'run-backfill-test:t001' },
      outcomes: { subjectiveHelpfulness: -1 },
    },
    pointOfAction: {
      detector_version: 'detector-test-v1',
      arm: 'compiled_constraint',
      assigned_trigger: 'warrant_skip',
      candidates: { stagnant_repeat: false, warrant_skip: true },
      suppression: {},
      compliance: {
        detector_version: 'detector-test-v1',
        arm: 'compiled_constraint',
        trigger: 'warrant_skip',
        compliant: false,
        components: {
          exactly_one_question: false,
          warrant_cue: true,
          no_new_premise: true,
          guards_passed: true,
        },
        realized_action_family: 'answer_accountably',
      },
    },
    tutor: 'Look at the assay slip. What does that one test establish? What follows?',
    tutorResponseRepaired: false,
    tutorDeterministicFallback: false,
    tutorGuardAccounting: {
      outcome: 'guarded_original_accepted',
      attempts: [],
      finalDelivery: {
        source: 'original_candidate',
        provider: 'codex',
        model: 'gpt-test',
        auditOk: true,
      },
    },
    provider: 'codex',
    model: 'gpt-test',
  };
}

function fixtureEvents() {
  return [
    runStart(),
    { type: 'tutor_opening', text: 'The two public records are on the desk.' },
    { type: 'turn_complete', turnRecord: acceptedRepairTurn() },
    { type: 'turn_complete', turnRecord: nextTurnWithFeedbackAndRegression() },
    { type: 'run_end' },
  ];
}

test('backfills rejected candidates, accepted repairs, human feedback, outcomes, and unhandled conduct by turn', () => {
  const result = backfillTutorStubTurnFailures({ events: fixtureEvents(), tracePath: 'fixture.jsonl' });
  assert.equal(result.turnsScanned, 2);
  assert.equal(result.records.length, 2);

  const first = result.records[0];
  assert.deepEqual(
    first.failures.map((failure) => failure.mode),
    ['feedback.too_abstract', 'guard.question_support.unanswerable_open_recall', 'interaction.regression_or_overreach'],
  );
  assert.equal(first.rejectedCandidates[0].text, 'What is the answer?');
  assert.equal(first.delivered.source, 'model_repair_candidate');
  assert.equal(first.training.preferencePairCandidate, true);
  assert.equal(first.training.correctedTargetCandidate, true);
  assert.equal(first.training.humanFeedbackConfirmed, true);
  assert.equal(first.training.humanGroundTruthValidated, false);
  assert.equal(first.training.trainingLicensed, false);
  assert.equal(first.failures[0].status, 'human_reported');
  assert.equal(first.publicContext.messages[0].role, 'assistant');
  assert.equal(first.publicContext.messages.at(-1).role, 'user');
  assert.equal(JSON.stringify(first).includes('private comment must not be copied'), false);

  const second = result.records[1];
  assert.deepEqual(
    second.failures.map((failure) => failure.mode),
    ['conduct.warrant_skip.unhandled'],
  );
  assert.equal(second.signals.pointOfAction.detectorVersion, 'detector-test-v1');
  assert.equal(second.publicContext.messages.length, 4);
});

test('keeps no-progress labels provisional and supports namespace mode filters', () => {
  const first = acceptedRepairTurn();
  const second = nextTurnWithFeedbackAndRegression();
  second.previousRegisterEfficacy.label = 'no_clear_progress';
  second.previousRegisterEfficacy.progressScore = 0;
  const result = backfillTutorStubTurnFailures({
    events: [runStart(), { type: 'turn_complete', turnRecord: first }, { type: 'turn_complete', turnRecord: second }],
  });
  const label = result.records[0].failures.find((failure) => failure.mode === 'interaction.no_clear_progress');
  assert.equal(label.status, 'candidate');
  assert.equal(label.confidence, 'heuristic');
  assert.equal(tutorStubFailureModeMatches(result.records[0], ['guard.question_support']), true);
  assert.equal(tutorStubFailureModeMatches(result.records[0], ['runtime']), false);
});

test('keeps unsealed traces out of preference and corrected-target candidates', () => {
  const turn = acceptedRepairTurn();
  turn.tutorGuardAccounting.attempts[0].guardedSpans = [];
  turn.tutorGuardAccounting.attempts[0].audits = {
    questionSupportAudit: { ok: false, issues: [] },
  };
  const result = backfillTutorStubTurnFailures({
    events: [runStart(), { type: 'turn_complete', turnRecord: turn }],
  });
  const record = result.records[0];
  assert.equal(record.run.sealed, false);
  assert.equal(record.failures[0].mode, 'guard.question_support.audit_failed_without_findings');
  assert.equal(record.training.preferencePairCandidate, false);
  assert.equal(record.training.correctedTargetCandidate, false);
  assert.ok(record.training.exclusions.includes('unsealed_trace'));
});

test('builds incremental outcome updates and sealed trace records without model calls', () => {
  const turns = [acceptedRepairTurn(), nextTurnWithFeedbackAndRegression()];
  const incremental = buildTutorStubTurnFailureTraceEvents({
    runStart: runStart(),
    turnRecords: turns,
    tracePath: 'fixture.jsonl',
  });
  assert.deepEqual(
    incremental.map((event) => [event.phase, event.turn]),
    [
      ['incremental', 1],
      ['incremental', 2],
    ],
  );
  assert.equal(incremental[0].record.run.sealed, false);
  assert.equal(incremental[0].record.training.preferencePairCandidate, false);
  assert.ok(incremental[0].record.training.exclusions.includes('unsealed_trace'));
  assert.ok(incremental[0].failureModes.includes('interaction.regression_or_overreach'));

  const sealed = buildTutorStubTurnFailureTraceEvents({
    runStart: runStart(),
    turnRecords: turns,
    tracePath: 'fixture.jsonl',
    traceSealed: true,
  });
  assert.equal(sealed[0].phase, 'sealed');
  assert.equal(sealed[0].record.run.sealed, true);
  assert.equal(sealed[0].record.training.preferencePairCandidate, true);
});

test('labels quarantined runtime turns but excludes them from corrective targets', () => {
  const quarantined = {
    turn: 1,
    turnId: 'run-backfill-test:t001',
    learner: 'Continue.',
    tutor: 'I have not added a new clue.',
    quarantined: true,
    quarantine: {
      failure: { disposition: 'quarantine', category: 'guard_exhaustion', reason: 'TUTOR_FALLBACK_AUDIT_FAILED' },
      error: { code: 'TUTOR_FALLBACK_AUDIT_FAILED' },
      transaction: { rolledBack: true },
    },
    tutorGuardAccounting: { attempts: [], finalDelivery: { source: 'mechanical_quarantine', auditOk: true } },
  };
  const result = backfillTutorStubTurnFailures({
    events: [runStart(), { type: 'turn_complete', turnRecord: quarantined }],
  });
  assert.equal(result.records[0].failures[0].mode, 'runtime.guard_exhaustion.tutor_fallback_audit_failed');
  assert.equal(result.records[0].training.preferencePairCandidate, false);
  assert.ok(result.records[0].training.exclusions.includes('quarantined_turn'));
});

test('retains an immediate down-rating even when no following learner turn exists', () => {
  const clean = {
    turn: 1,
    turnId: 'rating-only:t001',
    learner: 'Here is the public evidence.',
    tutor: 'What follows from that record?',
    tutorGuardAccounting: {
      attempts: [{ kind: 'original_candidate', auditOk: true, candidate: { text: 'What follows?' } }],
      finalDelivery: { source: 'original_candidate', auditOk: true },
    },
  };
  const result = backfillTutorStubTurnFailures({
    events: [
      runStart(),
      { type: 'turn_complete', turnRecord: clean },
      {
        type: 'tutor_feedback_rating_recorded',
        record: {
          observationType: 'immediate_observational_preference',
          feedback: { rating: 'down', reason: 'unsupported_question', comment: 'private rating note' },
          ratedResponse: { turn: 1, turnId: 'rating-only:t001' },
        },
      },
      { type: 'run_end' },
    ],
  });
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].failures[0].mode, 'feedback.unsupported_question');
  assert.equal(result.records[0].failures[0].status, 'human_reported');
  assert.equal(result.records[0].failures[0].evidence.observationType, 'immediate_observational_preference');
  assert.equal(result.records[0].training.humanFeedbackConfirmed, true);
  assert.equal(JSON.stringify(result.records[0]).includes('private rating note'), false);

  const rerated = backfillTutorStubTurnFailures({
    events: [
      runStart(),
      { type: 'turn_complete', turnRecord: clean },
      {
        type: 'tutor_feedback_rating_recorded',
        record: {
          feedback: { rating: 'down', reason: 'unsupported_question' },
          ratedResponse: { turn: 1, turnId: 'rating-only:t001' },
        },
      },
      {
        type: 'tutor_feedback_rating_recorded',
        record: {
          feedback: { rating: 'up', reason: 'helpful_pacing' },
          ratedResponse: { turn: 1, turnId: 'rating-only:t001' },
        },
      },
      { type: 'run_end' },
    ],
  });
  assert.equal(rerated.records.length, 0);
});

test('omits clean turns by default and accounts for malformed JSONL lines', () => {
  const clean = {
    turn: 1,
    turnId: 'clean:t001',
    learner: 'Here is the evidence.',
    tutor: 'Yes. What follows?',
    tutorGuardAccounting: {
      attempts: [{ kind: 'original_candidate', auditOk: true, candidate: { text: 'Yes. What follows?' } }],
      finalDelivery: { source: 'original_candidate', auditOk: true },
    },
  };
  const events = [runStart(), { type: 'turn_complete', turnRecord: clean }];
  assert.equal(backfillTutorStubTurnFailures({ events }).records.length, 0);
  assert.equal(backfillTutorStubTurnFailures({ events, includeClean: true }).records.length, 1);
  const parsed = parseTutorStubTraceJsonl(`${JSON.stringify(runStart())}\nnot-json\n`);
  assert.equal(parsed.events.length, 1);
  assert.deepEqual(
    parsed.malformedLines.map((row) => row.line),
    [2],
  );
});

test('CLI writes a filtered zero-call JSONL dataset and summary', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-turn-failure-'));
  const traceDir = path.join(temporary, 'traces');
  const outDir = path.join(temporary, 'out');
  fs.mkdirSync(traceDir);
  fs.writeFileSync(
    path.join(traceDir, 'fixture.jsonl'),
    `${fixtureEvents()
      .map((event) => JSON.stringify(event))
      .join('\n')}\nmalformed\n`,
  );
  const stdout = execFileSync(
    process.execPath,
    [
      path.join(ROOT, 'scripts/backfill-tutor-stub-turn-failures.js'),
      '--trace-root',
      traceDir,
      '--out',
      outDir,
      '--failure-mode',
      'guard.question_support',
    ],
    { encoding: 'utf8' },
  );
  const summary = JSON.parse(stdout);
  assert.equal(summary.zeroModelCalls, true);
  assert.equal(summary.trainingLicensed, false);
  assert.equal(summary.traceFiles, 1);
  assert.equal(summary.turnsScanned, 2);
  assert.equal(summary.records, 1);
  assert.equal(summary.malformedLines, 1);
  const rows = fs.readFileSync(path.join(outDir, 'turn-failures.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(rows.length, 1);
  assert.equal(tutorStubFailureModeMatches(rows[0], ['guard.question_support']), true);
  assert.equal(fs.existsSync(path.join(outDir, 'summary.json')), true);
});
