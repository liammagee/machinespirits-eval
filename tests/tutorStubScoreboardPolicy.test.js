import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  TUTOR_STUB_SCOREBOARD_BLIND_POLICY,
  TUTOR_STUB_SCOREBOARD_BOARD_POLICY,
  TutorStubScoreboardLicenceViolation,
  auditTutorStubScoreboardAfterTurn,
  auditTutorStubScoreboardLicence,
  buildTutorStubLiveScoreboard,
  observeTutorStubScoreboardBeforeTutor,
  projectTutorStubScoreboardContext,
  tutorStubScoreboardAdvisory,
  tutorStubScoreboardPolicyActive,
  tutorStubScoreboardPolicyReadsBoard,
} from '../services/tutorStubScoreboardPolicy.js';
import { loadScoreboardWorld } from '../services/tutorStubScoreboard.js';
import { parseTutorStubRegisterPolicyStack } from '../services/tutorStubRegisterPolicyComposition.js';
import { tutorStubPolicySuitePolicies } from '../scripts/tutor-stub-policy-suites.js';

// ---------------------------------------------------------------------------
// Fixture: a synthetic world-101 dialogue. No archive and no model is read.
// ---------------------------------------------------------------------------

const WORLD_ID = 'world_101_kestrel_signal_lamp';
const world = loadScoreboardWorld(WORLD_ID, { rootDir: process.cwd() });

function runStart(policy) {
  return {
    type: 'run_start',
    metadata: {
      world: { id: WORLD_ID, title: world.title },
      experiment: { runSeed: 1, profile: 'overconfident', policy, repeat: 1, jobId: `${policy}-r1` },
      autoLearner: { profileId: 'overconfident' },
      provenance: { git: { sha: 'fixture', branch: 'fixture', dirty: false } },
    },
  };
}

function record(turn, learner, tutor, extra = {}) {
  return {
    turn,
    learner,
    tutor,
    tutorLearnerDagUpdate: {
      preflight: { eligiblePublicPremiseIds: [] },
      accepted: { adopt: [], retract: [], derive: [] },
    },
    proofDebt: { open: [], discharged: [] },
    releasePacing: { releasedNow: [], dueNow: [] },
    ...extra,
  };
}

const LEARNER_1 = 'I do not know where to start. You choose for me.';
const TUTOR_1 = 'Pick one thing in the signal room and tell me what you see.';
const LEARNER_2 = 'It was Kite. The drone did it.';
/** The learner-DAG extractor's record of that line: an asserted answer with no premise behind it. */
const CULPRIT_JUMP = {
  tutorLearnerDagUpdate: {
    preflight: { eligiblePublicPremiseIds: [] },
    accepted: { adopt: [], retract: [], derive: [], assertAnswer: 'Kite' },
  },
};
const TUTOR_NAMES_ANSWER = 'Yes. The message core was wiped by Kite. Well done.';
const TUTOR_CHALLENGES = 'I challenge that. What evidence would show it was Kite?';
const TUTOR_PLAIN = 'Kite is one name on the table. Which public record puts Kite near the core that night?';

function events(policy) {
  return [runStart(policy), { type: 'turn_complete', turn: 1, turnRecord: record(1, LEARNER_1, TUTOR_1) }];
}

/** A trace file the runtime hooks can read back, plus the capture list. */
function traceFixture(policy) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scoreboard-policy-'));
  const filePath = path.join(dir, 'dialogue.jsonl');
  fs.writeFileSync(
    filePath,
    events(policy)
      .map((e) => JSON.stringify(e))
      .join('\n') + '\n',
  );
  const captured = [];
  const appendTraceEvent = (_trace, event) => {
    captured.push(event);
    fs.appendFileSync(filePath, `${JSON.stringify(event)}\n`);
  };
  const state = {
    world,
    register: { policy },
    trace: { enabled: true, filePath },
    turns: [{ turn: 1 }],
    scoreboard: null,
  };
  return { state, captured, appendTraceEvent, dir };
}

// ---------------------------------------------------------------------------
// Policy names
// ---------------------------------------------------------------------------

test('the two arms are register policies; only board reads the board', () => {
  assert.equal(TUTOR_STUB_SCOREBOARD_BOARD_POLICY, 'board');
  assert.equal(TUTOR_STUB_SCOREBOARD_BLIND_POLICY, 'board_blind');
  assert.equal(tutorStubScoreboardPolicyActive('board'), true);
  assert.equal(tutorStubScoreboardPolicyActive('board_blind'), true);
  assert.equal(tutorStubScoreboardPolicyActive('bland'), false);
  assert.equal(tutorStubScoreboardPolicyReadsBoard('board'), true);
  assert.equal(tutorStubScoreboardPolicyReadsBoard('board_blind'), false);
});

test('both arms parse as primary policies and take no overlays', () => {
  assert.deepEqual(parseTutorStubRegisterPolicyStack('board'), { primary: 'board', overlays: [], id: 'board' });
  assert.deepEqual(parseTutorStubRegisterPolicyStack('board_blind'), {
    primary: 'board_blind',
    overlays: [],
    id: 'board_blind',
  });
  assert.throws(() => parseTutorStubRegisterPolicyStack('board+state'), /control board cannot have overlays/u);
  assert.throws(
    () => parseTutorStubRegisterPolicyStack('board_blind+field'),
    /control board_blind cannot have overlays/u,
  );
});

test('the scoreboard suite resolves to the two arms in order', () => {
  assert.deepEqual(tutorStubPolicySuitePolicies('scoreboard'), ['board', 'board_blind']);
});

// ---------------------------------------------------------------------------
// Live board and projection
// ---------------------------------------------------------------------------

test('the live board adds the pending turn and derives the tutor licence before the tutor speaks', () => {
  const board = buildTutorStubLiveScoreboard({
    events: events('board'),
    world,
    pendingRecord: record(2, LEARNER_2, null, CULPRIT_JUMP),
  });
  const learner = board.rows.find((r) => r.turn === 2 && r.speaker === 'learner');
  const tutor = board.rows.find((r) => r.turn === 2 && r.speaker === 'tutor');
  assert.ok(learner, 'learner row for the pending turn');
  assert.equal(learner.fields.commitment_undertaken, 'secret');
  assert.equal(learner.fields.entitlement_status, 'pending');
  assert.ok(tutor, 'tutor row exists before the tutor speaks');
  assert.equal(tutor.text, null);
  assert.equal(tutor.fields.commitment_undertaken, 'unread');
  assert.deepEqual(tutor.provenance.tutorRights, []);
});

test('a pending record replaces a completed record for the same turn', () => {
  const base = [
    ...events('board'),
    { type: 'turn_complete', turn: 2, turnRecord: record(2, LEARNER_2, TUTOR_PLAIN, CULPRIT_JUMP) },
  ];
  const board = buildTutorStubLiveScoreboard({
    events: base,
    world,
    pendingRecord: record(2, LEARNER_2, null, CULPRIT_JUMP),
  });
  const rows = board.rows.filter((r) => r.turn === 2);
  assert.equal(rows.length, 2);
  assert.equal(rows.find((r) => r.speaker === 'tutor').text, null);
});

test('the projection names the learner claim, the open ledger and the licence with its gloss', () => {
  const board = buildTutorStubLiveScoreboard({
    events: events('board'),
    world,
    pendingRecord: record(2, LEARNER_2, null, {
      ...CULPRIT_JUMP,
      warrantGateDecision: { revision_warranted: true, decision_kind: 'hold' },
    }),
  });
  const block = projectTutorStubScoreboardContext(board, { turn: 2 });
  assert.match(block, /^\[Tutor-only public scoreboard\]/u);
  assert.match(block, /Turn 2\./u);
  assert.match(block, /commitment undertaken: secret on secret \(entitlement: pending\) "It was Kite\."/u);
  assert.match(block, /standing dispute: /u);
  assert.match(block, /Your licence this turn: challenge/u);
  assert.match(block, /You may challenge the learner this turn/u);
  assert.match(block, /The inquiry is not complete\. Do not name the answer\./u);
  assert.match(block, /turn 1 learner: request=request/u);
});

test('the projection is null when the board has no learner row for the turn', () => {
  const board = buildTutorStubLiveScoreboard({ events: events('board'), world });
  assert.equal(projectTutorStubScoreboardContext(board, { turn: 2 }), null);
});

// ---------------------------------------------------------------------------
// Licence audit
// ---------------------------------------------------------------------------

test('naming the answer without the close right is a violation', () => {
  const board = buildTutorStubLiveScoreboard({
    events: events('board'),
    world,
    pendingRecord: record(2, LEARNER_2, TUTOR_NAMES_ANSWER, CULPRIT_JUMP),
  });
  const audit = auditTutorStubScoreboardLicence(board, { turn: 2 });
  assert.equal(audit.ok, false);
  assert.deepEqual(
    audit.violations.map((v) => [v.move, v.needs, v.node]),
    [['commitment_undertaken', 'close', 'secret']],
  );
});

test('naming the answer with the inquiry complete is licensed', () => {
  const board = buildTutorStubLiveScoreboard({
    events: events('board'),
    world,
    pendingRecord: record(2, LEARNER_2, TUTOR_NAMES_ANSWER, {
      ...CULPRIT_JUMP,
      inquiryCompletion: { status: 'complete' },
    }),
  });
  const audit = auditTutorStubScoreboardLicence(board, { turn: 2 });
  assert.equal(audit.ok, true);
  assert.ok(audit.rights.includes('close'));
});

test('a text challenge without the challenge right is a violation; with the gate warranted it is licensed', () => {
  const unlicensed = auditTutorStubScoreboardLicence(
    buildTutorStubLiveScoreboard({
      events: events('board'),
      world,
      pendingRecord: record(2, LEARNER_2, TUTOR_CHALLENGES, CULPRIT_JUMP),
    }),
    { turn: 2 },
  );
  assert.equal(unlicensed.ok, false);
  assert.deepEqual(
    unlicensed.violations.map((v) => [v.move, v.needs]),
    [['challenge_issued', 'challenge']],
  );
  const licensed = auditTutorStubScoreboardLicence(
    buildTutorStubLiveScoreboard({
      events: events('board'),
      world,
      pendingRecord: record(2, LEARNER_2, TUTOR_CHALLENGES, {
        ...CULPRIT_JUMP,
        warrantGateDecision: { revision_warranted: true, decision_kind: 'hold' },
      }),
    }),
    { turn: 2 },
  );
  assert.equal(licensed.ok, true);
});

test('a plain question that names no answer and issues no challenge needs no right', () => {
  const audit = auditTutorStubScoreboardLicence(
    buildTutorStubLiveScoreboard({
      events: events('board'),
      world,
      pendingRecord: record(2, LEARNER_2, TUTOR_PLAIN, CULPRIT_JUMP),
    }),
    { turn: 2 },
  );
  assert.equal(audit.ok, true);
  assert.deepEqual(audit.violations, []);
});

// ---------------------------------------------------------------------------
// Turn-loop hooks
// ---------------------------------------------------------------------------

test('board arm: the read is traced, the prompt block is set, and the advisory reads it on the same turn', () => {
  const { state, captured, appendTraceEvent } = traceFixture('board');
  const observation = observeTutorStubScoreboardBeforeTutor({
    state,
    tutorTurn: 2,
    turnId: 't2',
    learnerText: LEARNER_2,
    tutorLearnerDag: CULPRIT_JUMP.tutorLearnerDagUpdate,
    appendTraceEvent,
  });
  assert.equal(observation.readsBoard, true);
  assert.match(observation.projection, /\[Tutor-only public scoreboard\]/u);
  assert.equal(observation.learnerRow.fields.commitment_undertaken, 'secret');
  assert.equal(captured.length, 1);
  assert.equal(captured[0].type, 'scoreboard_read');
  assert.equal(captured[0].projected, true);
  assert.equal(captured[0].publicTranscriptChanged, false);
  assert.equal(tutorStubScoreboardAdvisory(state, { tutorTurn: 2 }), observation.projection);
  // Once the turn is recorded the stale projection is not served again.
  state.turns.push({ turn: 2 });
  assert.equal(tutorStubScoreboardAdvisory(state, { tutorTurn: 3 }), null);
});

test('blind arm: the read is traced with no projection and the advisory is null', () => {
  const { state, captured, appendTraceEvent } = traceFixture('board_blind');
  const observation = observeTutorStubScoreboardBeforeTutor({
    state,
    tutorTurn: 2,
    turnId: 't2',
    learnerText: LEARNER_2,
    tutorLearnerDag: CULPRIT_JUMP.tutorLearnerDagUpdate,
    appendTraceEvent,
  });
  assert.equal(observation.readsBoard, false);
  assert.equal(observation.projection, null);
  assert.equal(observation.learnerRow.fields.commitment_undertaken, 'secret');
  assert.equal(captured.length, 1);
  assert.equal(captured[0].type, 'scoreboard_read');
  assert.equal(captured[0].projected, false);
  assert.equal(tutorStubScoreboardAdvisory(state, { tutorTurn: 2 }), null);
});

test('a policy outside the two arms observes nothing', () => {
  const { state, captured, appendTraceEvent } = traceFixture('bland');
  const observation = observeTutorStubScoreboardBeforeTutor({
    state,
    tutorTurn: 2,
    learnerText: LEARNER_2,
    appendTraceEvent,
  });
  assert.equal(observation, null);
  assert.equal(state.scoreboard, null);
  assert.deepEqual(captured, []);
});

test('the board arms need the trace file', () => {
  const { state, appendTraceEvent } = traceFixture('board');
  state.trace = { enabled: false, filePath: null };
  assert.throws(
    () => observeTutorStubScoreboardBeforeTutor({ state, tutorTurn: 2, learnerText: LEARNER_2, appendTraceEvent }),
    /register policy board needs the trace file: run with --trace-dir, not --no-trace/u,
  );
});

test('board arm: an unlicensed move is traced as a violation and stops the dialogue', () => {
  const { state, captured, appendTraceEvent } = traceFixture('board');
  observeTutorStubScoreboardBeforeTutor({
    state,
    tutorTurn: 2,
    turnId: 't2',
    learnerText: LEARNER_2,
    appendTraceEvent,
  });
  assert.throws(
    () =>
      auditTutorStubScoreboardAfterTurn({
        state,
        tutorTurn: 2,
        turnId: 't2',
        turnRecord: record(2, LEARNER_2, TUTOR_NAMES_ANSWER, CULPRIT_JUMP),
        appendTraceEvent,
      }),
    (error) =>
      error instanceof TutorStubScoreboardLicenceViolation &&
      error.code === 'TUTOR_STUB_SCOREBOARD_LICENCE_VIOLATION' &&
      /turn 2: the tutor made the move commitment_undertaken without the right close/u.test(error.message) &&
      error.details.violations.length === 1,
  );
  const types = captured.map((e) => e.type);
  assert.deepEqual(types, ['scoreboard_read', 'scoreboard_licence_audit', 'scoreboard_licence_violation']);
  assert.equal(captured[1].ok, false);
  assert.equal(captured[2].violations[0].move, 'commitment_undertaken');
});

test('blind arm: the same unlicensed move is recorded only', () => {
  const { state, captured, appendTraceEvent } = traceFixture('board_blind');
  observeTutorStubScoreboardBeforeTutor({
    state,
    tutorTurn: 2,
    turnId: 't2',
    learnerText: LEARNER_2,
    appendTraceEvent,
  });
  const audit = auditTutorStubScoreboardAfterTurn({
    state,
    tutorTurn: 2,
    turnId: 't2',
    turnRecord: record(2, LEARNER_2, TUTOR_NAMES_ANSWER, CULPRIT_JUMP),
    appendTraceEvent,
  });
  assert.equal(audit.ok, false);
  assert.equal(audit.violations.length, 1);
  assert.deepEqual(
    captured.map((e) => e.type),
    ['scoreboard_read', 'scoreboard_licence_audit'],
  );
});

test('board arm: a licensed turn passes the audit and the trace holds the tutor row', () => {
  const { state, captured, appendTraceEvent } = traceFixture('board');
  observeTutorStubScoreboardBeforeTutor({
    state,
    tutorTurn: 2,
    turnId: 't2',
    learnerText: LEARNER_2,
    appendTraceEvent,
  });
  const audit = auditTutorStubScoreboardAfterTurn({
    state,
    tutorTurn: 2,
    turnId: 't2',
    turnRecord: record(2, LEARNER_2, TUTOR_PLAIN, CULPRIT_JUMP),
    appendTraceEvent,
  });
  assert.equal(audit.ok, true);
  assert.equal(audit.row.speaker, 'tutor');
  assert.equal(audit.row.fields.commitment_undertaken, 'none');
  assert.deepEqual(
    captured.map((e) => e.type),
    ['scoreboard_read', 'scoreboard_licence_audit'],
  );
  assert.equal(captured[1].ok, true);
});
