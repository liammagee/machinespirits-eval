import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { replayTutorStubLearnerDagFromTurns } from '../services/tutorStubLearnerDagRestoration.js';

test('learner-DAG replay remains disabled without the feature or world', () => {
  let calls = 0;
  const adapters = {
    applyLearnerRecordUpdate: () => {
      calls += 1;
    },
    learnerPublicEvidenceState: () => {
      calls += 1;
    },
  };
  assert.deepEqual(replayTutorStubLearnerDagFromTurns({ learnerDag: { enabled: false } }, [{}], adapters), {
    replayed: 0,
    skipped: 0,
  });
  assert.deepEqual(replayTutorStubLearnerDagFromTurns({ learnerDag: { enabled: true } }, [{}], adapters), {
    replayed: 0,
    skipped: 0,
  });
  assert.equal(calls, 0);
});

test('learner-DAG replay preserves accepted update projection, turn fallback, dropout precedence, and model state', () => {
  const calls = [];
  const state = { learnerDag: { enabled: true, lastModel: null }, world: { id: 'world' } };
  const explicitDropout = { source: 'turn' };
  const result = replayTutorStubLearnerDagFromTurns(
    state,
    [
      {
        turn: '2',
        learner: 'learner text',
        dagFactDropout: explicitDropout,
        tutorLearnerDagUpdate: {
          dagFactDropout: { source: 'nested' },
          accepted: {
            adopt: ['a'],
            retract: ['r'],
            derive: ['d'],
            hypothesis: { id: 'h' },
            assertAnswer: { answer: 'x' },
            humanDiscourse: [{ claim: 'c' }],
          },
        },
      },
      { turn: 'invalid', learner: null, tutorLearnerDagUpdate: { accepted: {} } },
    ],
    {
      learnerPublicEvidenceState: (receivedState, tutorTurn) => ({
        publicState: receivedState,
        evidenceTurn: tutorTurn,
      }),
      applyLearnerRecordUpdate: (input) => {
        calls.push(input);
        return { model: { replay: calls.length } };
      },
    },
  );
  assert.deepEqual(result, { replayed: 2, skipped: 0 });
  assert.deepEqual(calls[0], {
    update: {
      adopt: ['a'],
      retract: ['r'],
      derive: ['d'],
      hypothesis: { id: 'h' },
      assert_answer: { answer: 'x' },
      human_discourse: [{ claim: 'c' }],
    },
    state,
    tutorTurn: 2,
    learnerText: 'learner text',
    dropoutReplay: explicitDropout,
    publicState: state,
    evidenceTurn: 2,
  });
  assert.deepEqual(calls[1].update, {
    adopt: [],
    retract: [],
    derive: [],
    hypothesis: null,
    assert_answer: null,
    human_discourse: null,
  });
  assert.equal(calls[1].tutorTurn, 2);
  assert.equal(calls[1].learnerText, '');
  assert.deepEqual(calls[1].dropoutReplay, { legacyNoDropout: true });
  assert.deepEqual(state.learnerDag.lastModel, { replay: 2 });
});

test('learner-DAG replay clones stored models, counts skips, and ignores empty turns', () => {
  const stored = { nodes: [{ id: 'n1' }] };
  const state = { learnerDag: { enabled: true, lastModel: null }, world: { id: 'world' } };
  assert.deepEqual(
    replayTutorStubLearnerDagFromTurns(state, [{ tutorLearnerDagModel: stored }, {}, null], {
      applyLearnerRecordUpdate: () => assert.fail('unexpected update'),
      learnerPublicEvidenceState: () => assert.fail('unexpected evidence projection'),
    }),
    { replayed: 0, skipped: 1 },
  );
  assert.deepEqual(state.learnerDag.lastModel, stored);
  assert.notEqual(state.learnerDag.lastModel, stored);
  assert.notEqual(state.learnerDag.lastModel.nodes, stored.nodes);
});

test('the CLI imports rather than redeclares learner-DAG replay', () => {
  const source = fs.readFileSync(new URL('../scripts/tutor-stub.js', import.meta.url), 'utf8');
  assert.match(source, /replayTutorStubLearnerDagFromTurns/u);
  assert.doesNotMatch(source, /function replayLearnerDagFromTurns\(/u);
});
