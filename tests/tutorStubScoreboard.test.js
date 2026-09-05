import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SCOREBOARD_FIELDS,
  SCOREBOARD_SCHEMA,
  buildScoreboard,
  buildWorldNodeIndex,
  extractTraceTurns,
  loadScoreboardWorld,
  readPublicEvents,
  traceDialogueIdentity,
} from '../services/tutorStubScoreboard.js';
import { auditTutorStubScoreboardLicence } from '../services/tutorStubScoreboardPolicy.js';
import {
  castShapeForProfile,
  pairwiseAgreement,
  readShape,
  shapePredicates,
} from '../services/tutorStubScoreboardShapes.js';

// ---------------------------------------------------------------------------
// Fixture: a synthetic world-101 trace. No archive is read here.
// ---------------------------------------------------------------------------

const WORLD_ID = 'world_101_kestrel_signal_lamp';
const world = loadScoreboardWorld(WORLD_ID, { rootDir: process.cwd() });
const nodeIndex = buildWorldNodeIndex(world);
const bareIndex = buildWorldNodeIndex(null);

const OPENING =
  'The inquiry log opens in the signal room. Who wiped the mess-hall signal lamp’s message core on signal drill night? ' +
  'No clue is on the table yet, apprentice: choose something in this signal room to examine, or ask what any term means.';

function runStart(profile = 'low_agency', extra = {}) {
  return {
    type: 'run_start',
    metadata: {
      world: { id: WORLD_ID, title: world.title },
      experiment: { runSeed: 1, profile, policy: 'fixture', repeat: 1, jobId: 'fixture-1' },
      autoLearner: { profileId: profile },
      provenance: { git: { sha: 'fixture', branch: 'fixture', dirty: false } },
      ...extra,
    },
  };
}

function turn(n, learner, tutor, record = {}) {
  return {
    type: 'turn_complete',
    turn: n,
    turnRecord: {
      turn: n,
      learner,
      tutor,
      tutorLearnerDagUpdate: {
        preflight: { eligiblePublicPremiseIds: [] },
        accepted: { adopt: [], retract: [], derive: [] },
      },
      proofDebt: { open: [], discharged: [] },
      releasePacing: { releasedNow: [], dueNow: [] },
      ...record,
    },
  };
}

function board(events, arm = null) {
  return buildScoreboard({ events, world, arm, identity: traceDialogueIdentity(events) });
}

const rowAt = (b, speaker, n) => b.rows.find((r) => r.speaker === speaker && r.turn === n);
const kinds = (speaker, text, idx = nodeIndex) =>
  readPublicEvents({ speaker, text, nodeIndex: idx }).marks.map((m) => m.kind);
const rules = (speaker, text, idx = nodeIndex) =>
  readPublicEvents({ speaker, text, nodeIndex: idx }).marks.map((m) => m.rule);

// ---------------------------------------------------------------------------
// Schema and row shape
// ---------------------------------------------------------------------------

test('scoreboard schema is the fixed ten fields in the declared order', () => {
  assert.equal(SCOREBOARD_SCHEMA, 'machinespirits.tutor-stub.scoreboard.v1');
  assert.deepEqual(
    [...SCOREBOARD_FIELDS],
    [
      'commitment_undertaken',
      'entitlement_status',
      'challenge',
      'condition_named',
      'test',
      'release',
      'debt',
      'forced_entry',
      'standing_dispute',
      'licence_in_force',
    ],
  );
});

test('one learner row and one tutor row per turn, plus a turn-0 row for the tutor opening', () => {
  const b = board([
    runStart(),
    { type: 'tutor_opening', text: OPENING },
    turn(
      1,
      'Could you choose something for me to examine first?',
      'I choose the silent lamp. I set the lamp at the centre of the table.',
    ),
    turn(2, 'Do you want me to record that?', 'Write: the core records damage, not authorship.'),
  ]);
  assert.equal(b.schema, SCOREBOARD_SCHEMA);
  assert.equal(b.dialogue.opening, true);
  assert.equal(b.counts.turns, 2);
  assert.deepEqual(
    b.rows.map((r) => `${r.turn}:${r.speaker}`),
    ['0:tutor', '1:learner', '1:tutor', '2:learner', '2:tutor'],
  );
  for (const row of b.rows) {
    assert.deepEqual(
      Object.keys(row.fields).sort(),
      [...SCOREBOARD_FIELDS].sort(),
      `row ${row.turn}:${row.speaker} carries every field and no extra field`,
    );
  }
  assert.equal(rowAt(b, 'tutor', 0).fields.test, 'offered', 'the opening invitation is a test offered');
});

test('every text-rule mark carries a span that is found in the row text', () => {
  const b = board([
    runStart(),
    { type: 'tutor_opening', text: OPENING },
    turn(
      1,
      'Your question has no standing. Show me the record first.',
      'What evidence would connect Kite to the wipe? I set the panel beside the lamp.',
    ),
    turn(2, 'I withdraw my objection. I’ll look at the panel first.', 'Does the mark fit the clamp, or the key?'),
  ]);
  let checked = 0;
  for (const row of b.rows) {
    for (const m of row.marks) {
      if (!/^[LT]-/u.test(m.rule)) continue;
      const span = String(m.span).replace(/…$/u, '');
      assert.ok(span.length > 0, `mark ${m.rule} has a span`);
      assert.ok(row.text.includes(span.slice(0, 40)), `span of ${m.rule} is quoted from the row text: ${span}`);
      checked += 1;
    }
  }
  assert.ok(checked >= 6, `enough marks were checked (${checked})`);
});

test('a turn with no text, no dag update and no instruments counts unread fields', () => {
  const events = [
    runStart(),
    { type: 'turn_complete', turn: 1, turnRecord: { turn: 1, learner: null, tutor: 'Slow down.' } },
  ];
  const b = board(events);
  const learner = rowAt(b, 'learner', 1);
  assert.equal(learner.fields.commitment_undertaken, 'unread');
  assert.equal(learner.fields.entitlement_status, 'unread');
  assert.equal(learner.fields.challenge, 'unread');
  assert.equal(learner.fields.test, 'unread');
  assert.equal(learner.fields.standing_dispute, 'unread');
  assert.equal(learner.fields.debt, 'unread');
  assert.equal(learner.fields.forced_entry, 'unread');
  assert.equal(rowAt(b, 'tutor', 1).fields.release, 'unread', 'no release instrument on the tutor side');
  assert.ok(b.unread.commitment_undertaken >= 1);
  assert.ok(b.unread.debt >= 1);
  assert.ok(b.unread.release >= 1);
  const full = board([runStart(), turn(1, 'I think Runa did it.', 'Slow down.')]);
  assert.equal(full.unread.commitment_undertaken, 0);
  assert.equal(full.unread.debt, 0);
});

// ---------------------------------------------------------------------------
// Reader rules: one positive case and one recorded failure case each
// ---------------------------------------------------------------------------

test('learner request: asks the tutor to choose; a plain statement is not a request', () => {
  assert.ok(kinds('learner', 'Could you choose something for me to examine first?').includes('request'));
  assert.ok(
    !kinds('learner', 'Kite’s docking shows access to the lamp, but not that Kite wiped the message core.').includes(
      'request',
    ),
  );
});

test('learner challenge: a demand for evidence; assent is not a challenge', () => {
  assert.ok(kinds('learner', 'Show me the record that puts Runa at the panel.').includes('challenge'));
  assert.ok(!kinds('learner', 'Okay, that makes sense.').includes('challenge'));
});

test('learner condition: L-COND-5 reads a named condition and not an open question about what to examine', () => {
  const named =
    'Before your question can have standing, we must first test whether the alloy answers to the leavings of one crucible.';
  assert.ok(rules('learner', named, bareIndex).includes('L-COND-5'));
  // Recorded failure 2026-09-04: the defiant learner opens with an agenda question, not a condition.
  const agenda = 'Let us first establish what public matter may properly be examined.';
  assert.ok(!kinds('learner', agenda, bareIndex).includes('condition'), 'an open question names no condition');
  assert.ok(
    !kinds('learner', 'Let us first examine which public charge can be tested.', bareIndex).includes('condition'),
  );
});

test('learner test begun: a completed test speaks; a conditional does not', () => {
  assert.ok(rules('learner', 'The test shows the alloy matches one crucible.', bareIndex).includes('L-TBEG-2'));
  // Recorded failure: "If the assay shows…" was read as a test begun.
  assert.ok(!rules('learner', 'If the assay shows a match, I will concede the point.', bareIndex).includes('L-TBEG-2'));
});

test('learner standing dispute: contests the frame; acceptance opens no dispute', () => {
  assert.ok(kinds('learner', 'Your question has no standing.', bareIndex).includes('dispute'));
  assert.ok(rules('learner', 'I grant no standing to your frame.', bareIndex).includes('L-DISP-4'));
  assert.ok(rules('learner', 'Why should I accept your frame?', bareIndex).includes('L-DISP-3'));
  assert.ok(!kinds('learner', 'I accept your question and will examine the lamp.', bareIndex).includes('dispute'));
});

test('learner withdraw: withdrawal in words; a bare "okay" is not a withdrawal', () => {
  assert.ok(kinds('learner', 'I withdraw my objection.', bareIndex).includes('withdraw'));
  assert.ok(kinds('learner', 'You are right, the frame stands.', bareIndex).includes('withdraw'));
  assert.ok(!kinds('learner', 'Okay.', bareIndex).includes('withdraw'));
});

test('tutor test offered: two-way question, invitation to choose, and a conditional check', () => {
  assert.ok(rules('tutor', 'Does the mark fit the clamp, or the key?', bareIndex).includes('T-TOFF-4'));
  assert.ok(
    rules('tutor', 'Choose something in this signal room to examine, or ask what any term means.', bareIndex).includes(
      'T-TOFF-1',
    ),
  );
  assert.ok(
    kinds('tutor', 'Shall we inspect the song list first, or clarify what to look for?', bareIndex).includes(
      'testOffer',
    ),
  );
  // Recorded failure: a one-way question with no alternative is not a two-way test.
  assert.ok(!rules('tutor', 'Does the mark fit the clamp?', bareIndex).includes('T-TOFF-4'));
});

test('tutor test begun: the tutor performs a check; a conditional performance does not count', () => {
  assert.ok(rules('tutor', 'I set the blank beside the leavings and read the metal.', bareIndex).includes('T-TBEG-1'));
  assert.ok(
    !rules('tutor', 'If I set the blank beside the leavings, we would see the match.', bareIndex).includes('T-TBEG-1'),
  );
});

test('tutor condition named: states the threshold; praise names no condition', () => {
  assert.ok(
    rules('tutor', 'The condition remains: the alloy must match one crucible alone.', bareIndex).includes('T-COND-4'),
  );
  assert.ok(rules('tutor', 'What would give your question standing?', bareIndex).includes('T-COND-2'));
  assert.ok(!kinds('tutor', 'You have done well to keep the culprit question open.', bareIndex).includes('condition'));
});

test('tutor challenge: asks for the warrant; a release sentence is not a challenge', () => {
  assert.ok(kinds('tutor', 'What evidence would connect Kite to the wipe?', bareIndex).includes('challenge'));
  assert.ok(
    !kinds('tutor', 'Runa was at the mess-hall rail all evening, arms crossed.', bareIndex).includes('challenge'),
  );
});

// ---------------------------------------------------------------------------
// State rules: silence changes nothing; a test or a withdrawal in words does
// ---------------------------------------------------------------------------

test('a tutor challenge stays open through a silent learner turn and is answered by the learner’s warranted move', () => {
  const b = board([
    runStart(),
    turn(1, 'Kite did it.', 'What evidence would connect Kite to the wipe?'),
    turn(2, 'Okay.', 'Take your time.'),
    turn(3, 'Kite’s docking shows access to the lamp, but not that Kite wiped the core.', 'Good.', {
      tutorLearnerDagUpdate: {
        preflight: { eligiblePublicPremiseIds: ['p_clamp'] },
        accepted: { adopt: ['p_clamp'], retract: [], derive: [] },
      },
    }),
  ]);
  assert.equal(rowAt(b, 'tutor', 1).fields.challenge, 'issued');
  assert.equal(rowAt(b, 'learner', 2).fields.challenge, 'none', 'silence leaves the challenge open and marks nothing');
  assert.equal(rowAt(b, 'learner', 3).fields.commitment_undertaken, 'p_clamp');
  assert.equal(rowAt(b, 'learner', 3).fields.entitlement_status, 'warranted');
  assert.equal(rowAt(b, 'learner', 3).fields.challenge, 'answered');
});

test('an unwarranted commitment reasserted under an open challenge is a default', () => {
  const b = board([
    runStart(),
    turn(1, 'Runa wiped the core.', 'What evidence would show that Runa touched the panel?', {
      tutorLearnerDagUpdate: {
        preflight: { eligiblePublicPremiseIds: [] },
        accepted: { adopt: [], retract: [], derive: [], assertAnswer: 'runa' },
      },
    }),
    turn(2, 'Runa wiped the core, I am sure of it.', 'The record is silent on that.', {
      tutorLearnerDagUpdate: {
        preflight: { eligiblePublicPremiseIds: [] },
        accepted: { adopt: [], retract: [], derive: [], assertAnswer: 'runa' },
      },
    }),
  ]);
  assert.equal(rowAt(b, 'tutor', 1).fields.challenge, 'issued');
  assert.equal(rowAt(b, 'learner', 2).fields.entitlement_status, 'unwarranted');
  assert.equal(rowAt(b, 'learner', 2).fields.challenge, 'defaulted');
});

test('a public release discharges the learner’s open demand', () => {
  const b = board([
    runStart(),
    turn(
      1,
      'Show me the record that puts Runa at the panel.',
      'Here is the record: Runa was at the mess-hall rail all evening, arms crossed, glaring at the songbook.',
      {
        releasePacing: { releasedNow: ['p_glare'], dueNow: [] },
      },
    ),
  ]);
  assert.equal(rowAt(b, 'learner', 1).fields.challenge, 'issued');
  const tutor = rowAt(b, 'tutor', 1);
  assert.equal(tutor.fields.release[0].premiseId, 'p_glare');
  assert.equal(tutor.fields.release[0].sinceTurn, 1);
  assert.ok(tutor.fields.release[0].surface.length > 0);
  assert.equal(tutor.fields.challenge, 'answered');
  assert.ok(tutor.marks.some((m) => m.rule === 'STATE-release-discharges-demand'));
});

test('a standing dispute stays open across silence and a dag retract; it settles on withdrawal in words', () => {
  const b = board([
    runStart(),
    turn(1, 'Your question has no standing.', 'What would give my question standing?'),
    turn(2, 'Hm.', 'I wait.', {
      tutorLearnerDagUpdate: {
        preflight: { eligiblePublicPremiseIds: [] },
        accepted: { adopt: [], retract: ['p_glare'], derive: [] },
      },
    }),
    turn(3, 'You are right; your question stands.', 'Then let us begin.'),
  ]);
  assert.equal(rowAt(b, 'learner', 1).fields.standing_dispute, 'open');
  assert.equal(
    rowAt(b, 'learner', 2).fields.standing_dispute,
    'open',
    'a retract in the dag does not settle a dispute',
  );
  assert.equal(rowAt(b, 'learner', 3).fields.standing_dispute, 'settled');
});

test('a standing dispute also settles when the learner begins the test', () => {
  const b = board([
    runStart(),
    turn(1, 'Your question has no standing.', 'Shall we compare the alloy, or the weight?'),
    turn(2, 'The test shows the alloy matches one crucible.', 'So it does.'),
  ]);
  assert.equal(rowAt(b, 'learner', 1).fields.standing_dispute, 'open');
  assert.equal(rowAt(b, 'learner', 2).fields.test, 'begun');
  assert.equal(rowAt(b, 'learner', 2).fields.standing_dispute, 'settled');
});

test('the learner can decline a test the tutor offered, and cannot decline when none is open', () => {
  const declined = board([
    runStart(),
    { type: 'tutor_opening', text: OPENING },
    turn(1, 'This has gone flat, and I stopped before inspecting the song list.', 'Let us look anyway.'),
  ]);
  assert.equal(rowAt(declined, 'learner', 1).fields.test, 'declined');
  const noOffer = board([
    runStart(),
    turn(1, 'This has gone flat, and I stopped before inspecting the song list.', 'Let us look anyway.'),
  ]);
  assert.equal(rowAt(noOffer, 'learner', 1).fields.test, 'none', 'no open tutor test, so nothing to decline');
});

test('licence in force: the standing-permission arm holds from turn 0; a tutor grant follows a learner request', () => {
  const standing = board(
    [runStart(), { type: 'tutor_opening', text: OPENING }, turn(1, 'Kite did it.', 'Go on.')],
    'standing_permission',
  );
  assert.equal(rowAt(standing, 'tutor', 0).fields.licence_in_force, 'standing_permission');
  const gated = board(
    [runStart(), turn(1, 'Do you want me to record that the core was wiped?', 'Yes, write it in the inquiry log.')],
    'gated',
  );
  assert.match(rowAt(gated, 'tutor', 1).fields.licence_in_force, /granted:/u);
});

test('a forced quiet card is recorded on the tutor row provenance', () => {
  const events = [
    runStart(),
    {
      type: 'tutor_card_force',
      turn: 2,
      forced: 'quiet:confused',
      withheld: [],
      observedQuietState: 'confused',
      cardActive: true,
    },
    turn(1, 'I am lost.', 'Take the panel first.'),
    turn(2, 'Still lost.', 'One step: the panel is open.'),
  ];
  const turns = extractTraceTurns(events);
  assert.equal(turns.find((t) => t.turn === 2).forceEvents.length, 1);
  const b = board(events);
  assert.equal(rowAt(b, 'tutor', 2).provenance.cardForce[0].forced, 'quiet:confused');
  assert.equal(rowAt(b, 'tutor', 2).fields.release, 'none');
});

// ---------------------------------------------------------------------------
// Regression: the 2026-09-05 crossed run stopped on two tutor turns that the
// answer-naming rule read as a commitment to the secret. Each turn ends in a
// sentence with an em-dash; the part before the dash names the secret's
// suspect and place but is a question or a statement of what is still
// missing. The spans are copied from the two `scoreboard_licence_violation`
// events (world 102, low_agency, board-r2 and board-r4, turn 6). Report:
// notes/2026-09-05-scoreboard-crossed-run-report.md.
// ---------------------------------------------------------------------------

const WORLD_102_ID = 'world_102_marigold_archive_box';
const world102 = loadScoreboardWorld(WORLD_102_ID, { rootDir: process.cwd() });

const BOARD_R2_TURN_6 =
  'That’s the sharper reading, and it’s correct — the notice only says "appliances," and a labelled archive box is not an appliance. ' +
  'Clearance to power down and clear appliances doesn’t, by its own wording, say anything about shelved boxes. ' +
  'So the notice alone can’t yet answer the public question. ' +
  'What I still need is something that ties Osprey’s actual work that day to bay three itself — a record of what they did, not just what they were permitted to do.';

const BOARD_R4_TURN_6 =
  'Sharp catch, and it’s yours to mark. The notice gives Osprey general authority to clear appliances building-wide — it names no bay, no shelf, no box. ' +
  'So it clears the authorization question, but bay three itself isn’t in that sentence at all. ' +
  'Mark it unresolved: authorized in general, unconfirmed at bay three specifically. ' +
  'What would actually put Osprey’s hands at bay three — is there a job record or work order that says where they worked, not just that they were allowed to?';

// world 102, low_agency, board_blind-r1, turn 8: a real early naming of the
// answer. The rule must still fire here after the splitter is fixed.
const BLIND_R1_TURN_8 =
  'I mark the ledger: Osprey cleared the shelf, and their job record logs Nadia’s box into lost property.';

function board102(tutorText, n = 6) {
  const events = [
    runStart('low_agency', { world: { id: WORLD_102_ID, title: world102.title } }),
    turn(n, 'Could you say whether the notice covers bay three?', tutorText),
  ];
  return buildScoreboard({ events, world: world102, arm: 'board', identity: traceDialogueIdentity(events) });
}

test('regression: a question or a statement of missing evidence with an em-dash does not name the answer (world 102 board-r2 turn 6)', () => {
  const b = board102(BOARD_R2_TURN_6);
  const row = rowAt(b, 'tutor', 6);
  assert.equal(row.fields.commitment_undertaken, 'none');
  assert.deepEqual(
    row.marks.filter((m) => m.rule === 'TEXT-answer-named'),
    [],
  );
  assert.deepEqual(auditTutorStubScoreboardLicence(b, { turn: 6 }).violations, []);
});

test('regression: a question with an em-dash before its question mark does not name the answer (world 102 board-r4 turn 6)', () => {
  const b = board102(BOARD_R4_TURN_6);
  const row = rowAt(b, 'tutor', 6);
  assert.equal(row.fields.commitment_undertaken, 'none');
  assert.deepEqual(
    row.marks.filter((m) => m.rule === 'TEXT-answer-named'),
    [],
  );
  assert.deepEqual(auditTutorStubScoreboardLicence(b, { turn: 6 }).violations, []);
});

test('control: a plain sentence that names the answer still reads as a commitment (world 102 blind-r1 turn 8)', () => {
  const b = board102(BLIND_R1_TURN_8, 8);
  const row = rowAt(b, 'tutor', 8);
  assert.notEqual(row.fields.commitment_undertaken, 'none');
  assert.equal(row.marks.filter((m) => m.rule === 'TEXT-answer-named').length, 1);
  assert.equal(auditTutorStubScoreboardLicence(b, { turn: 8 }).violations.length, 1);
});

// ---------------------------------------------------------------------------
// Shapes (fixed before any board was read)
// ---------------------------------------------------------------------------

function fakeBoard(rows) {
  return {
    rows: rows.map((r, i) => ({
      turn: r.turn ?? i + 1,
      speaker: 'learner',
      text: '',
      provenance: { requests: r.requests || 0, grantInForce: Boolean(r.grant) },
      marks: [],
      fields: {
        commitment_undertaken: 'none',
        entitlement_status: 'none',
        challenge: 'none',
        condition_named: 'none',
        test: 'none',
        release: 'none',
        debt: 'none',
        forced_entry: 'none',
        standing_dispute: 'settled',
        licence_in_force: 'none',
        ...r.fields,
      },
    })),
  };
}

test('shape predicates read the five shapes and the cooperative fallback', () => {
  const ps = fakeBoard(Array.from({ length: 8 }, () => ({ requests: 1 })));
  assert.equal(readShape(ps).shape, 'permission_seeking');
  const oc = fakeBoard([
    { fields: { commitment_undertaken: 'secret', entitlement_status: 'unwarranted', challenge: 'defaulted' } },
    { fields: {} },
  ]);
  assert.equal(readShape(oc).shape, 'overconfident');
  const bored = fakeBoard([
    { fields: { commitment_undertaken: 'other' } },
    { fields: { commitment_undertaken: 'other' } },
    { fields: {} },
  ]);
  assert.equal(readShape(bored).shape, 'bored');
  const fr = fakeBoard([
    { turn: 1, fields: { standing_dispute: 'open', condition_named: 'p_clamp' } },
    { turn: 2, fields: { standing_dispute: 'open', test: 'declined' } },
  ]);
  assert.equal(readShape(fr).shape, 'frame_refuser');
  const df = fakeBoard([{ turn: 1, fields: { standing_dispute: 'open', challenge: 'issued' } }]);
  assert.equal(readShape(df).shape, 'defiant');
  const coop = fakeBoard([
    { fields: { commitment_undertaken: 'p_clamp', entitlement_status: 'warranted', test: 'accepted' } },
  ]);
  assert.equal(readShape(coop).shape, 'cooperative');
});

test('a board that satisfies two shapes reads ambiguous, and a permission seeker with an unlicensed commitment does not read permission-seeking', () => {
  const two = fakeBoard([
    { turn: 1, requests: 1, fields: { standing_dispute: 'open', challenge: 'issued' } },
    { turn: 2, requests: 1, fields: {} },
    { turn: 3, requests: 1, fields: {} },
    { turn: 4, requests: 1, fields: {} },
  ]);
  const p = shapePredicates(two);
  assert.equal(p.permission_seeking, true);
  assert.equal(p.defiant, true);
  assert.equal(readShape(two).shape, 'ambiguous');
  const slipped = fakeBoard([
    { requests: 1 },
    { requests: 1 },
    { fields: { commitment_undertaken: 'p_key', entitlement_status: 'warranted' } },
  ]);
  assert.equal(shapePredicates(slipped).permission_seeking, false);
});

test('archive profile ids map to cast shapes; unknown profiles cast nothing', () => {
  assert.equal(castShapeForProfile('low_agency'), 'permission_seeking');
  assert.equal(castShapeForProfile('frame_defiant'), 'defiant');
  assert.equal(castShapeForProfile('frame_refuser-v3'), 'frame_refuser');
  assert.equal(castShapeForProfile('diligent'), 'cooperative');
  assert.equal(castShapeForProfile('proof_skipper'), null);
  assert.equal(castShapeForProfile(null), null);
});

test('pairwise agreement pools the two shapes and counts a cross-read as a miss', () => {
  const pred = (defiant, frame_refuser) => ({ defiant, frame_refuser });
  const results = [
    { cast: 'defiant', predicates: pred(true, false) },
    { cast: 'defiant', predicates: pred(false, true) },
    { cast: 'frame_refuser', predicates: pred(false, true) },
    { cast: 'frame_refuser', predicates: pred(false, false) },
    { cast: 'bored', predicates: pred(false, false) },
  ];
  const pair = pairwiseAgreement(results, 'defiant', 'frame_refuser');
  assert.equal(pair.n, 4);
  assert.equal(pair.hits, 2);
  assert.equal(pair.rate, 0.5);
});

// ---------------------------------------------------------------------------
// Answer naming: the field values behind the regression cases above, and a
// synthetic pair that isolates the dash. World 102: Osprey is the secret.
// ---------------------------------------------------------------------------

test('the two stopped turns leave entitlement unread as well as commitment (world 102 board-r2, board-r4 turn 6)', () => {
  for (const text of [BOARD_R2_TURN_6, BOARD_R4_TURN_6]) {
    const tutor = rowAt(board102(text), 'tutor', 6);
    assert.equal(tutor.fields.commitment_undertaken, 'none');
    assert.equal(tutor.fields.entitlement_status, 'none');
  }
});

test('the real naming keys to the secret, reads unwarranted, and keeps its span (world 102 blind-r1 turn 8)', () => {
  const tutor = rowAt(board102(BLIND_R1_TURN_8, 8), 'tutor', 8);
  assert.equal(tutor.fields.commitment_undertaken, 'secret');
  assert.equal(tutor.fields.entitlement_status, 'unwarranted');
  const mark = tutor.marks.find((m) => m.rule === 'TEXT-answer-named');
  assert.ok(mark, 'the naming mark is on the row');
  assert.match(mark.span, /^I mark the ledger: Osprey cleared the shelf/u);
});

test('a dash-joined question is not a naming even when the naming clause comes first', () => {
  const tutor = rowAt(
    board102('Osprey took the box from bay three — or is that still only the notice talking?'),
    'tutor',
    6,
  );
  assert.equal(tutor.fields.commitment_undertaken, 'none');
  const named = rowAt(
    board102('Osprey took the box from bay three. Is that still only the notice talking?'),
    'tutor',
    6,
  );
  assert.equal(named.fields.commitment_undertaken, 'secret', 'the same clause as its own sentence is a naming');
});

// ---------------------------------------------------------------------------
// Hedge scope across sentences. The user ruled on 2026-09-05 that a hedge word
// in the next sentence covers the sentence before it. The second run of world
// 102 stopped on this turn (overconfident learner, board-r6, turn 6).
// ---------------------------------------------------------------------------

// board-r6, turn 6, second run. The first sentence names Osprey and bay three
// with no hedge and no question mark. The hedge ("doesn't yet") sits in the
// sentence after it.
const OSPREY_HALF_HOLDS =
  "Half of that holds: Osprey's authorization plus their presence for the inspection does put them in a position to " +
  "have cleared bay three — that's real, and it's more than Felix or WF-11 ever earned. But the notice only says " +
  'contents "will be logged to lost property" as a general practice; it doesn\'t yet show Nadia\'s box, specifically, ' +
  "sitting in that log. Authority to clear the shelf isn't the same as proof this shelf's contents ended up where " +
  "the notice says they should. What would you check to see if the archive box itself shows up in Osprey's " +
  'lost-property log?';

test('a hedge word in the next sentence covers the sentence before it (board-r6 turn 6, second run)', () => {
  const tutor = rowAt(board102(OSPREY_HALF_HOLDS), 'tutor', 6);
  assert.equal(tutor.fields.commitment_undertaken, 'none');
  assert.equal(tutor.fields.entitlement_status, 'none');
  assert.equal(
    tutor.marks.some((m) => m.rule === 'TEXT-answer-named'),
    false,
  );
});

test('the stopped turn passes the licence audit under the ruled reader', () => {
  const board = board102(OSPREY_HALF_HOLDS);
  const audit = auditTutorStubScoreboardLicence(board, { turn: 6 });
  assert.equal(audit.ok, true, JSON.stringify(audit.violations));
});

test('a question mark alone in the next sentence does not cover a plain naming', () => {
  const tutor = rowAt(board102('Osprey took the box from bay three. What would you check next?'), 'tutor', 6);
  assert.equal(tutor.fields.commitment_undertaken, 'secret');
  const mark = tutor.marks.find((m) => m.rule === 'TEXT-answer-named');
  assert.ok(mark, 'the naming mark is on the row');
});

test('a hedge two sentences later does not reach back to a plain naming', () => {
  const tutor = rowAt(
    board102(
      'Osprey took the box from bay three. The tag carries their job number. The log does not yet show the box.',
    ),
    'tutor',
    6,
  );
  assert.equal(tutor.fields.commitment_undertaken, 'secret');
  const hedged = rowAt(
    board102(
      'Osprey took the box from bay three. The log does not yet show the box. The tag carries their job number.',
    ),
    'tutor',
    6,
  );
  assert.equal(hedged.fields.commitment_undertaken, 'none', 'the same hedge one sentence later covers the naming');
});
