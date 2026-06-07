import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  ROLES,
  DEFAULT_MAX_TURNS,
  MAX_TURNS_CEILING,
  tutorCellFor,
  startSession,
  humanTurn,
  viewSession,
  saveSession,
  buildMockDeps,
  _resetSessionsForTest,
} from '../services/poetics/liveCompose.js';

// Every case runs on mock deps so no LLM is ever called and spend stays zero —
// the whole point of buildMockDeps(). The store is process-global, so reset it
// between cases.
const mock = buildMockDeps();
const savedFiles = [];

beforeEach(() => _resetSessionsForTest());

after(() => {
  // Clean up any artifacts saveSession wrote to exports/live-compose/.
  for (const rel of savedFiles) {
    try {
      fs.rmSync(path.resolve(process.cwd(), rel));
    } catch {
      /* already gone */
    }
  }
});

describe('liveCompose · tutorCellFor', () => {
  it('maps prompt_type × architecture to the four registered cells', () => {
    assert.equal(tutorCellFor('recognition', 'ego_superego'), 'cell_7_recog_multi_unified');
    assert.equal(tutorCellFor('recognition', 'ego_only'), 'cell_5_recog_single_unified');
    assert.equal(tutorCellFor('base', 'ego_superego'), 'cell_3_base_multi_unified');
    assert.equal(tutorCellFor('base', 'ego_only'), 'cell_1_base_single_unified');
  });

  it('defaults unknown values to recognition / ego_only', () => {
    assert.equal(tutorCellFor(undefined, undefined), 'cell_5_recog_single_unified');
    assert.equal(tutorCellFor('nonsense', 'nonsense'), 'cell_5_recog_single_unified');
  });
});

describe('liveCompose · human-as-learner (AI tutor opens)', () => {
  it('greets the human with an AI tutor line, then trades turns at zero spend', async () => {
    const { session, openingTurn } = await startSession(
      { humanRole: ROLES.LEARNER, openingSpeaker: ROLES.TUTOR, topic: 'logarithms' },
      mock,
    );
    // AI holds the tutor seat and speaks first, so the human arrives to a line.
    assert.equal(session.humanRole, ROLES.LEARNER);
    assert.equal(session.aiRole, ROLES.TUTOR);
    assert.ok(openingTurn, 'opening AI turn should exist');
    assert.equal(openingTurn.role, ROLES.TUTOR);
    assert.equal(openingTurn.by, 'ai');
    assert.equal(session.nextSpeaker, ROLES.LEARNER, 'after the tutor opens, it is the human learner’s turn');

    const { humanTurn: h, aiTurn: a } = await humanTurn(session.id, 'I just want the rule', mock);
    assert.equal(h.role, ROLES.LEARNER);
    assert.equal(h.by, 'human');
    assert.equal(a.role, ROLES.TUTOR);
    assert.equal(a.by, 'ai');

    // Mock deps report zero usage, so no spend should accrue.
    const v = viewSession(session.id);
    assert.equal(v.spend.inputTokens, 0);
    assert.equal(v.spend.outputTokens, 0);
    assert.equal(v.turnCount, 3); // tutor-open, human, tutor-reply
  });

  it('never leaks AI deliberation onto the live wire view', async () => {
    const { openingTurn } = await startSession({ humanRole: ROLES.LEARNER, openingSpeaker: ROLES.TUTOR }, mock);
    assert.ok(!('deliberation' in openingTurn), 'public turn must omit deliberation');
  });
});

describe('liveCompose · human-as-tutor (AI learner replies)', () => {
  it('lets the human open as tutor and the AI answer as learner', async () => {
    const { session, openingTurn } = await startSession({ humanRole: ROLES.TUTOR, openingSpeaker: ROLES.TUTOR }, mock);
    assert.equal(session.humanRole, ROLES.TUTOR);
    assert.equal(session.aiRole, ROLES.LEARNER);
    assert.equal(openingTurn, null, 'human opens, so there is no opening AI turn');
    assert.equal(session.nextSpeaker, ROLES.TUTOR);

    const { humanTurn: h, aiTurn: a } = await humanTurn(session.id, 'What is log base 2 of 8 asking, in words?', mock);
    assert.equal(h.role, ROLES.TUTOR);
    assert.equal(h.by, 'human');
    assert.equal(a.role, ROLES.LEARNER);
    assert.equal(a.by, 'ai');
  });
});

describe('liveCompose · turn-order + input guards', () => {
  it('rejects a second human turn while the AI turn is still resolving', async () => {
    const { session } = await startSession({ humanRole: ROLES.LEARNER, openingSpeaker: ROLES.TUTOR }, mock);
    // p1 runs synchronously up to its first await, flipping nextSpeaker to the
    // AI seat; p2's guard then sees it is no longer the human's turn.
    const p1 = humanTurn(session.id, 'first', mock);
    await assert.rejects(humanTurn(session.id, 'second', mock), (e) => e.code === 'LIVE_NOT_YOUR_TURN');
    await p1;
  });

  it('rejects an empty human turn', async () => {
    const { session } = await startSession({ humanRole: ROLES.LEARNER, openingSpeaker: ROLES.TUTOR }, mock);
    await assert.rejects(humanTurn(session.id, '   ', mock), (e) => e.code === 'LIVE_EMPTY_TURN');
  });

  it('throws a 404-coded error for an unknown session', () => {
    assert.throws(
      () => viewSession('live_does_not_exist'),
      (e) => e.code === 'LIVE_SESSION_NOT_FOUND',
    );
  });
});

describe('liveCompose · turn cap', () => {
  it('closes the session once maxTurns is reached and returns a null aiTurn', async () => {
    // maxTurns=2: AI tutor opens (1), human learner replies (2) → done, no AI reply.
    const { session } = await startSession(
      { humanRole: ROLES.LEARNER, openingSpeaker: ROLES.TUTOR, maxTurns: 2 },
      mock,
    );
    const { aiTurn } = await humanTurn(session.id, 'a reply that hits the cap', mock);
    assert.equal(aiTurn, null, 'no AI reply once the cap is hit');
    const v = viewSession(session.id);
    assert.equal(v.status, 'done');
    assert.equal(v.turnCount, 2);
  });

  it('clamps maxTurns into [2, ceiling]', async () => {
    const { session: lo } = await startSession({ maxTurns: 1 }, mock);
    assert.equal(lo.maxTurns, 2);
    const { session: hi } = await startSession({ maxTurns: 9999 }, mock);
    assert.equal(hi.maxTurns, MAX_TURNS_CEILING);
    const { session: def } = await startSession({}, mock);
    assert.equal(def.maxTurns, DEFAULT_MAX_TURNS);
  });
});

describe('liveCompose · saveSession', () => {
  it('writes a self-describing transcript artifact with deliberation retained', async () => {
    const { session } = await startSession(
      { humanRole: ROLES.LEARNER, openingSpeaker: ROLES.TUTOR, topic: 'save-test logarithms' },
      mock,
    );
    await humanTurn(session.id, 'a learner line for the artifact', mock);
    const { path: rel, bytes } = saveSession(session.id, { filename: 'livecompose-unit-test-artifact' });
    savedFiles.push(rel);

    assert.ok(bytes > 0);
    const abs = path.resolve(process.cwd(), rel);
    assert.ok(fs.existsSync(abs), 'artifact file should be on disk');
    const body = fs.readFileSync(abs, 'utf8');
    assert.match(body, /kind: live-compose-transcript/);
    assert.match(body, /tutor_cell: cell_5_recog_single_unified/);
    // Deliberation is stripped from the wire view but retained in the artifact.
    assert.match(body, /deliberation:/);
  });
});
