import assert from 'node:assert/strict';
import test from 'node:test';

import { createPilotTutorSessionAdapter } from '../services/pilotTutorSessionAdapter.js';

function fixtureStore({ status = 'tutoring', expired = false } = {}) {
  const session = {
    id: 'pilot-1',
    status,
    condition_cell: 'cell_5_recog_single_unified',
    scenario_lecture_ref: '101-lecture-1',
  };
  const turns = [{ role: 'tutor', content: 'What do equal parts tell us?' }];
  return {
    turns,
    PILOT_STATUSES: { TUTORING: 'tutoring' },
    getSession: (id) => (id === session.id ? session : null),
    isTutoringExpired: () => expired,
    endTutoring: (_id, { reason }) => {
      session.status = reason === 'timed_out' ? 'timed_out' : 'tutoring_done';
    },
    listTurns: () => turns,
    computeConfigHash: () => 'pilot-config-hash',
    appendTurn: (_id, turn) => {
      turns.push(turn);
      return { turnIndex: turns.length - 1, dialogueContentHash: `hash-${turns.length}` };
    },
    tutoringTimeRemainingMs: () => 12_000,
  };
}

test('pilot tutor adapter keeps assignment and history server-authoritative and persists one pair', async () => {
  const store = fixtureStore();
  let received = null;
  const adapter = createPilotTutorSessionAdapter({
    store,
    env: { OPENROUTER_API_KEY: 'test-key' },
    loadTutorAgents: () => ({
      profiles: {
        cell_5_recog_single_unified: {
          ego: { provider: 'openrouter', model: 'gpt', prompt_file: 'ego.md' },
          superego: null,
        },
      },
    }),
    loadCurriculum: ({ lectureRef }) => ({ lectureRef, text: 'fractions source' }),
    loadPrompt: () => 'prompt',
    buildDirectorPlan: () => null,
    runTurn: async (specification) => {
      received = specification;
      return {
        finalMessage: 'Equal denominators name equal-sized parts.',
        wasRevised: false,
        deliberation: [{ role: 'ego', model: 'test-model' }],
        totals: { inputTokens: 10, outputTokens: 5, latencyMs: 7 },
      };
    },
  });

  const result = await adapter.executeTurn({ sessionId: 'pilot-1', learnerMessage: 'I add the bottoms too.' });

  assert.equal(received.profile.ego.prompt_file, 'ego.md');
  assert.deepEqual(received.history, [{ role: 'tutor', content: 'What do equal parts tell us?' }]);
  assert.equal(received.curriculum.lectureRef, '101-lecture-1');
  assert.equal(result.finalMessage, 'Equal denominators name equal-sized parts.');
  assert.equal(result.turnIndex, 2);
  assert.deepEqual(
    store.turns.slice(-2).map((turn) => [turn.role, turn.configHash]),
    [
      ['learner', 'pilot-config-hash'],
      ['tutor', 'pilot-config-hash'],
    ],
  );
});

test('pilot tutor adapter fails closed on an expired session before any provider call', async () => {
  const store = fixtureStore({ expired: true });
  let providerCalls = 0;
  const adapter = createPilotTutorSessionAdapter({
    store,
    env: { OPENROUTER_API_KEY: 'test-key' },
    runTurn: async () => {
      providerCalls += 1;
      return {};
    },
  });

  await assert.rejects(
    adapter.executeTurn({ sessionId: 'pilot-1', learnerMessage: 'hello' }),
    (error) => error.code === 'PILOT_TIMED_OUT' && error.statusCode === 410,
  );
  assert.equal(providerCalls, 0);
  assert.equal(store.getSession('pilot-1').status, 'timed_out');
});
