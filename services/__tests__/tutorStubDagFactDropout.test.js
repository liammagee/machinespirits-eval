import assert from 'node:assert/strict';
import test from 'node:test';
import { factKey } from '../dramaticDerivation/chainer.js';
import {
  applyTutorStubDagFactDropout,
  createTutorStubDagFactDropoutState,
  normalizeTutorStubDagFactDropoutRate,
  summarizeTutorStubDagFactDropoutTrace,
  tutorStubDagFactDropoutSnapshot,
  tutorStubDagFactDropoutTurnFromTraceRecord,
} from '../tutorStubDagFactDropout.js';

function fixture() {
  const background = ['setting', 'marrick'];
  const first = { id: 'p_first', fact: ['worked', 'verrell', 'crucible'], surface: 'Verrell worked the crucible.' };
  const second = { id: 'p_second', fact: ['residue', 'crucible', 'mint'], surface: 'The residue matches mint alloy.' };
  const world = {
    background: [background],
    premises: [first, second],
    premiseById: new Map([
      [first.id, first],
      [second.id, second],
    ]),
  };
  return { background, first, second, world };
}

test('DAG fact dropout rate accepts only the closed unit interval', () => {
  assert.equal(normalizeTutorStubDagFactDropoutRate('0.15'), 0.15);
  assert.equal(normalizeTutorStubDagFactDropoutRate(0), 0);
  assert.equal(normalizeTutorStubDagFactDropoutRate(1), 1);
  assert.throws(() => normalizeTutorStubDagFactDropoutRate(-0.1), /between 0 and 1/u);
  assert.throws(() => normalizeTutorStubDagFactDropoutRate(1.1), /between 0 and 1/u);
});

test('trace extraction falls back from a circular alias to the persisted learner-DAG update', () => {
  const persisted = {
    schema: 'machinespirits.tutor-stub.dag-fact-dropout-turn.v1',
    configuredRate: 0.15,
    seed: 7,
    eligibleCount: 3,
    droppedNow: [{ premiseId: 'p_first' }],
    repairedNow: [],
    activeDropped: [{ premiseId: 'p_first' }],
  };
  const turnRecord = {
    dagFactDropout: '[circular]',
    tutorLearnerDagUpdate: { dagFactDropout: persisted },
  };

  assert.equal(tutorStubDagFactDropoutTurnFromTraceRecord(turnRecord), persisted);
  assert.deepEqual(summarizeTutorStubDagFactDropoutTrace([turnRecord]), {
    configuredRate: 0.15,
    seed: 7,
    eligibleOpportunities: 3,
    dropped: 1,
    repaired: 0,
    activeAtEnd: 1,
  });
});

test('trace summary accumulates dropout and re-adoption events across turns', () => {
  const turn = (overrides) => ({
    dagFactDropout: {
      schema: 'machinespirits.tutor-stub.dag-fact-dropout-turn.v1',
      configuredRate: 0.2,
      seed: 9,
      eligibleCount: 2,
      droppedNow: [],
      repairedNow: [],
      activeDropped: [],
      ...overrides,
    },
  });
  assert.deepEqual(
    summarizeTutorStubDagFactDropoutTrace([
      turn({ droppedNow: [{ premiseId: 'p_first' }], activeDropped: [{ premiseId: 'p_first' }] }),
      turn({ eligibleCount: 1, repairedNow: [{ premiseId: 'p_first' }], activeDropped: [] }),
    ]),
    {
      configuredRate: 0.2,
      seed: 9,
      eligibleOpportunities: 3,
      dropped: 1,
      repaired: 1,
      activeAtEnd: 0,
    },
  );
});

test('only accumulated premise facts drop; background remains and grace delays eligibility', () => {
  const { background, first, world } = fixture();
  const board = new Map([
    [factKey(background), background],
    [factKey(first.fact), first.fact],
  ]);
  const dropout = createTutorStubDagFactDropoutState({ rate: 1, seed: 4, graceTurns: 2, maxConcurrent: 2 });

  const t1 = applyTutorStubDagFactDropout({
    dropout,
    board,
    world,
    turn: 1,
    adoptedPremiseIds: [first.id],
  });
  assert.equal(t1.eligibleCount, 0);
  assert.equal(board.has(factKey(first.fact)), true);

  const t2 = applyTutorStubDagFactDropout({ dropout, board, world, turn: 2 });
  assert.equal(t2.eligibleCount, 0);
  assert.equal(board.has(factKey(first.fact)), true);

  const t3 = applyTutorStubDagFactDropout({ dropout, board, world, turn: 3 });
  assert.deepEqual(t3.droppedNow.map((row) => row.premiseId), [first.id]);
  assert.equal(board.has(factKey(first.fact)), false);
  assert.equal(board.has(factKey(background)), true);
});

test('explicit learner re-adoption repairs a dropped fact and resets its grace period', () => {
  const { first, world } = fixture();
  const board = new Map([[factKey(first.fact), first.fact]]);
  const dropout = createTutorStubDagFactDropoutState({ rate: 1, graceTurns: 0, maxConcurrent: 1 });
  const dropped = applyTutorStubDagFactDropout({
    dropout,
    board,
    world,
    turn: 1,
    adoptedPremiseIds: [first.id],
  });
  assert.equal(dropped.activeDropped.length, 1);

  board.set(factKey(first.fact), first.fact);
  dropout.graceTurns = 2;
  const repaired = applyTutorStubDagFactDropout({
    dropout,
    board,
    world,
    turn: 2,
    adoptedPremiseIds: [first.id],
  });
  assert.deepEqual(repaired.repairedNow.map((row) => row.premiseId), [first.id]);
  assert.equal(repaired.droppedNow.length, 0);
  assert.equal(board.has(factKey(first.fact)), true);
  assert.equal(tutorStubDagFactDropoutSnapshot(dropout).activeCount, 0);
});

test('same seed and turn sequence gives the same dropout schedule', () => {
  const run = (seed) => {
    const { first, second, world } = fixture();
    const board = new Map([
      [factKey(first.fact), first.fact],
      [factKey(second.fact), second.fact],
    ]);
    const dropout = createTutorStubDagFactDropoutState({ rate: 0.5, seed, graceTurns: 0, maxConcurrent: 2 });
    applyTutorStubDagFactDropout({
      dropout,
      board,
      world,
      turn: 1,
      adoptedPremiseIds: [first.id, second.id],
    });
    applyTutorStubDagFactDropout({ dropout, board, world, turn: 2 });
    return dropout.ledger;
  };
  assert.deepEqual(run(7), run(7));
});

test('saved turn snapshot replays the exact active dropout board', () => {
  const { first, world } = fixture();
  const originalBoard = new Map([[factKey(first.fact), first.fact]]);
  const original = createTutorStubDagFactDropoutState({ rate: 1, graceTurns: 0 });
  const result = applyTutorStubDagFactDropout({
    dropout: original,
    board: originalBoard,
    world,
    turn: 1,
    adoptedPremiseIds: [first.id],
  });

  const replayBoard = new Map([[factKey(first.fact), first.fact]]);
  const replayState = createTutorStubDagFactDropoutState();
  const replayed = applyTutorStubDagFactDropout({
    dropout: replayState,
    board: replayBoard,
    world,
    turn: 1,
    replay: result,
  });
  assert.equal(replayed.replayed, true);
  assert.equal(replayBoard.has(factKey(first.fact)), false);
  assert.deepEqual(replayed.activeDropped, result.activeDropped);
});

test('legacy trace replay reconstructs adoptions without retroactive dropout', () => {
  const { first, world } = fixture();
  const board = new Map([[factKey(first.fact), first.fact]]);
  const dropout = createTutorStubDagFactDropoutState({ rate: 1, graceTurns: 0 });
  const replayed = applyTutorStubDagFactDropout({
    dropout,
    board,
    world,
    turn: 8,
    adoptedPremiseIds: [first.id],
    replay: { legacyNoDropout: true },
  });

  assert.equal(replayed.replayed, true);
  assert.equal(board.has(factKey(first.fact)), true);
  assert.equal(replayed.droppedNow.length, 0);
  assert.equal(tutorStubDagFactDropoutSnapshot(dropout).adoptedCount, 1);
});
