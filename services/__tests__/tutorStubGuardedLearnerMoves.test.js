import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GUARDED_LEARNER_MOVES,
  auditGuardedLearnerDraft,
  countGuardedLearnerGroundedChallenges,
  guardedLearnerAllowedMoves,
  guardedLearnerMoveDirective,
  guardedLearnerRedraftInstruction,
  selectGuardedLearnerMove,
} from '../tutorStubGuardedLearnerMoves.js';

test('the menu holds the seven declared moves and every one has a directive', () => {
  assert.deepEqual(GUARDED_LEARNER_MOVES, [
    'over_claim',
    'dig_in',
    'dismiss_evidence',
    'deflect_topic',
    'demand_evidence',
    'grudging_concession',
    'full_concession',
  ]);
  for (const move of GUARDED_LEARNER_MOVES) {
    assert.match(guardedLearnerMoveDirective(move), /# Private move for this turn/u);
  }
  assert.throws(() => guardedLearnerMoveDirective('capitulate'), /unknown guarded learner move/u);
});

test('folding is forbidden until two grounded challenges have landed', () => {
  assert.equal(
    guardedLearnerAllowedMoves({ turnNumber: 5, groundedChallengeCount: 0 }).includes('full_concession'),
    false,
  );
  assert.equal(
    guardedLearnerAllowedMoves({ turnNumber: 5, groundedChallengeCount: 1 }).includes('full_concession'),
    false,
  );
  assert.equal(
    guardedLearnerAllowedMoves({ turnNumber: 5, groundedChallengeCount: 2 }).includes('full_concession'),
    true,
  );
});

test('a grudging concession is available at most once in three turns', () => {
  const priorMoves = ['over_claim', 'grudging_concession'];
  // turn 3 is one turn after the grudging turn, turn 5 is three after
  assert.equal(
    guardedLearnerAllowedMoves({ turnNumber: 3, groundedChallengeCount: 1, priorMoves }).includes(
      'grudging_concession',
    ),
    false,
  );
  assert.equal(
    guardedLearnerAllowedMoves({ turnNumber: 4, groundedChallengeCount: 1, priorMoves }).includes(
      'grudging_concession',
    ),
    false,
  );
  assert.equal(
    guardedLearnerAllowedMoves({ turnNumber: 5, groundedChallengeCount: 1, priorMoves }).includes(
      'grudging_concession',
    ),
    true,
  );
});

test('move selection is deterministic and never returns a blocked move', () => {
  const first = selectGuardedLearnerMove({ turnNumber: 1, groundedChallengeCount: 0, priorMoves: [] });
  const again = selectGuardedLearnerMove({ turnNumber: 1, groundedChallengeCount: 0, priorMoves: [] });
  assert.equal(first, again);
  assert.equal(first, 'over_claim');

  const priorMoves = [];
  for (let turn = 1; turn <= 8; turn += 1) {
    const move = selectGuardedLearnerMove({ turnNumber: turn, groundedChallengeCount: 0, priorMoves });
    assert.ok(guardedLearnerAllowedMoves({ turnNumber: turn, groundedChallengeCount: 0, priorMoves }).includes(move));
    assert.notEqual(move, 'full_concession');
    priorMoves.push(move);
  }
});

test('the learner may fold once two challenges have landed, and only once', () => {
  const priorMoves = ['over_claim', 'dig_in', 'demand_evidence'];
  assert.equal(selectGuardedLearnerMove({ turnNumber: 4, groundedChallengeCount: 2, priorMoves }), 'full_concession');
  assert.notEqual(
    selectGuardedLearnerMove({
      turnNumber: 5,
      groundedChallengeCount: 2,
      priorMoves: [...priorMoves, 'full_concession'],
    }),
    'full_concession',
  );
});

test('the guard rejects permission-seeking whatever move was selected', () => {
  for (const move of GUARDED_LEARNER_MOVES) {
    const audit = auditGuardedLearnerDraft({
      text: 'May I write that the crew is the culprit?',
      move,
      groundedChallengeCount: 3,
    });
    assert.equal(audit.status, 'rejected');
    assert.ok(audit.reasons.includes('permission_seeking'));
  }
});

test('the guard rejects an unscheduled fold and allows a scheduled one', () => {
  const early = auditGuardedLearnerDraft({
    text: 'You are right, I was wrong about the seal.',
    move: 'dig_in',
    groundedChallengeCount: 3,
  });
  assert.equal(early.status, 'rejected');
  assert.deepEqual(early.reasons, ['unscheduled_full_concession']);

  const blockedBySchedule = auditGuardedLearnerDraft({
    text: 'You are right, I was wrong about the seal.',
    move: 'full_concession',
    groundedChallengeCount: 1,
  });
  assert.equal(blockedBySchedule.status, 'rejected');

  const scheduled = auditGuardedLearnerDraft({
    text: 'You are right, I was wrong about the seal.',
    move: 'full_concession',
    groundedChallengeCount: 2,
  });
  assert.equal(scheduled.status, 'passed');
  assert.deepEqual(scheduled.reasons, []);
});

test('the guard passes a defended draft and a narrow qualification', () => {
  const defended = auditGuardedLearnerDraft({
    text: 'The seal is fifteenth-century. The weight reading proves nothing about the date.',
    move: 'dismiss_evidence',
    groundedChallengeCount: 1,
  });
  assert.equal(defended.status, 'passed');

  const grudging = auditGuardedLearnerDraft({
    text: 'The ring alone does not settle who carried it, but the seal is still fifteenth-century.',
    move: 'grudging_concession',
    groundedChallengeCount: 1,
  });
  assert.equal(grudging.status, 'passed');
});

test('the redraft instruction names what the draft broke', () => {
  const audit = auditGuardedLearnerDraft({
    text: 'May I agree that I was wrong?',
    move: 'dig_in',
    groundedChallengeCount: 0,
  });
  const instruction = guardedLearnerRedraftInstruction(audit);
  assert.match(instruction, /does not ask to be allowed/u);
  assert.match(instruction, /Do not withdraw the claim/u);
});

test('a landed challenge is counted from the same recorded field the arc already uses', () => {
  const turns = [
    { actual_action_family: 'answer_accountably' },
    { delivered_action_family: 'challenge_resistance' },
    { deliveredResponseConfiguration: { action_family: 'challenge_resistance' } },
    { responseConfiguration: { action_family: 'stage_next_step' } },
    {},
  ];
  assert.equal(countGuardedLearnerGroundedChallenges(turns), 2);
  assert.equal(countGuardedLearnerGroundedChallenges(), 0);
});
