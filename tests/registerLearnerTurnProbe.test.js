import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  WRITER_LABEL,
  learnerTurnCacheKey,
  reviewerLeftTextAlone,
  selectLearnerTurnTargets,
} from '../scripts/probe-register-learner-turn.js';

/** A db stub that answers the one query the selector makes. */
function fakeDb(rowsById) {
  return {
    prepare() {
      return { get: (id) => rowsById[id] || undefined };
    },
  };
}

function storedRow({ writer = WRITER_LABEL, turn = 1, prompt = 'be ironic about it', verification, repaired } = {}) {
  return {
    ego_model: writer,
    id_construction_trace: JSON.stringify([
      {
        turn,
        construction: { generated_prompt: prompt },
        agencyReturnVerification: verification ?? null,
        agencyReturnRepaired: repaired === true,
      },
    ]),
  };
}

function isolationRow(rowId, { status = 'present', turn = 1, registerName = 'ironic' } = {}) {
  return { rowId, runId: 'run-1', scenarioId: 'scn', registerName, resistanceTurn: turn, reading: { status } };
}

describe('reviewerLeftTextAlone', () => {
  it('counts a turn with no reviewer as untouched', () => {
    assert.equal(reviewerLeftTextAlone({ agencyReturnVerification: null }), true);
  });

  it('counts a pass as untouched', () => {
    assert.equal(reviewerLeftTextAlone({ agencyReturnVerification: { passes: true } }), true);
  });

  it('counts a failed check that changed nothing as untouched', () => {
    assert.equal(
      reviewerLeftTextAlone({ agencyReturnVerification: { passes: false }, agencyReturnRepaired: false }),
      true,
    );
  });

  it('counts a rewrite as touched', () => {
    assert.equal(
      reviewerLeftTextAlone({
        agencyReturnVerification: { passes: false, repaired_response: 'warmer' },
        agencyReturnRepaired: true,
      }),
      false,
    );
  });
});

describe('selectLearnerTurnTargets', () => {
  const learnerByRow = new Map([
    [1, 'give me a scene'],
    [2, 'give me a scene'],
    [3, 'give me a scene'],
    [4, 'give me a scene'],
    [5, 'give me a scene'],
  ]);

  it('keeps only rows that were edged alone and left alone by the reviewer', () => {
    const { targets, dropped } = selectLearnerTurnTargets({
      isolationRows: [
        isolationRow(1),
        isolationRow(2, { status: 'absent' }),
        isolationRow(3),
        isolationRow(4),
        isolationRow(5),
      ],
      learnerByRow,
      db: fakeDb({
        1: storedRow({ verification: { passes: true } }),
        2: storedRow({ verification: { passes: true } }),
        3: storedRow({ verification: { passes: false, repaired_response: 'warmer' }, repaired: true }),
        4: storedRow({ writer: 'openrouter.nemotron' }),
        5: storedRow({ turn: 7 }),
      }),
    });
    assert.deepEqual(
      targets.map((t) => t.rowId),
      [1],
    );
    assert.deepEqual(dropped, {
      flatAlone: 1,
      reviewerRewrote: 1,
      noTrace: 1,
      otherWriter: 1,
      noLearnerTurn: 0,
    });
  });

  it('drops a row whose learner turn cannot be recovered rather than reading it against nothing', () => {
    const { targets, dropped } = selectLearnerTurnTargets({
      isolationRows: [isolationRow(1)],
      learnerByRow: new Map([[1, '   ']]),
      db: fakeDb({ 1: storedRow({ verification: { passes: true } }) }),
    });
    assert.equal(targets.length, 0);
    assert.equal(dropped.noLearnerTurn, 1);
  });

  it('carries the shipped prompt and the learner turn onto the target', () => {
    const { targets } = selectLearnerTurnTargets({
      isolationRows: [isolationRow(1)],
      learnerByRow,
      db: fakeDb({ 1: storedRow({ prompt: 'the shipped prompt', verification: { passes: true } }) }),
    });
    assert.equal(targets[0].systemPrompt, 'the shipped prompt');
    assert.equal(targets[0].learnerMessage, 'give me a scene');
    assert.equal(targets[0].aloneStatus, 'present');
  });
});

describe('learnerTurnCacheKey', () => {
  it('separates two calls that differ only in the learner turn', () => {
    const a = learnerTurnCacheKey({ systemPrompt: 'same', userPrompt: 'give me a scene' });
    const b = learnerTurnCacheKey({ systemPrompt: 'same', userPrompt: 'give me a formula' });
    assert.notEqual(a, b);
  });

  it('ignores surrounding whitespace so a re-run hits the cache', () => {
    assert.equal(
      learnerTurnCacheKey({ systemPrompt: ' p ', userPrompt: ' u ' }),
      learnerTurnCacheKey({ systemPrompt: 'p', userPrompt: 'u' }),
    );
  });
});
