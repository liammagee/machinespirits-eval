import assert from 'node:assert/strict';
import test from 'node:test';
import { factKey } from '../services/dramaticDerivation/chainer.js';
import { runPostTurnLifecycle } from '../services/dramaticDerivation/postTurnLifecycle.js';
import { openScene } from '../services/dramaticDerivation/rhetoricalMovePolicy.js';
import { createDramaRunState } from '../services/dramaticDerivation/runState.js';
import { loadWorld } from '../services/dramaticDerivation/world.js';

const world = loadWorld('config/drama-derivation/world-000-smoke.yaml');

function lifecycleInput(runState, overrides = {}) {
  return {
    runState,
    world,
    turn: 1,
    sceneState: null,
    sceneExchange: null,
    sceneTempo: null,
    sceneRecognitionNeed: null,
    lastClosedSceneSummary: null,
    publicRegister: 'default',
    baseRegister: 'default',
    endedBy: null,
    learnerOut: {},
    tutorOut: {},
    directorView: {},
    tutorView: {},
    releasedThisTurn: [],
    deriveOutcomes: [],
    postLearnerTransformation: null,
    fieldPlannerRow: null,
    D: 2,
    F: 1,
    forced: false,
    ...overrides,
  };
}

test('post-turn lifecycle closes scenes, seals public history, resets register, and projects the close', () => {
  const statuses = [];
  const runState = createDramaRunState({
    world,
    options: { sceneMode: { maxExchanges: 4 }, strategyLedger: true, onTurn: (status) => statuses.push(status) },
  });
  runState.ledgerState.appliedCommitment = {
    register: 'modern',
    didacticDefault: 'question',
    releasePosture: 'paced',
    recognitionBudget: 1,
  };
  runState.transcript.push(
    { turn: 1, role: 'tutor', text: 'Take the first relation carefully.' },
    { turn: 1, role: 'learner', text: 'That relation shortens the path.' },
  );
  runState.ledger.push({ turn: 1, premiseId: 'p1', via: 'tutor' });
  const sceneState = openScene({
    index: 1,
    turn: 1,
    dNow: 3,
    targetPremise: 'p1',
    goal: 'Seat the first premise.',
  });

  const result = runPostTurnLifecycle(
    lifecycleInput(runState, {
      sceneState,
      sceneExchange: {
        type: 'substantive',
        formalActions: 1,
        dDelta: 1,
        boardDelta: 1,
        countsForProgress: true,
        phatic: false,
      },
      publicRegister: 'modern',
      tutorView: { proxyDagPacing: { signal: 'advance' } },
      releasedThisTurn: [world.premiseById.get('p1').fact],
    }),
  );

  assert.equal(result.sceneState, null);
  assert.equal(result.closedScene.closeReason, 'D decreased');
  assert.equal(result.lastClosedSceneSummary.lastLearnerText, 'That relation shortens the path.');
  assert.deepEqual(result.lastClosedSceneSummary.releases, [{ turn: 1, premiseId: 'p1' }]);
  assert.equal(result.publicRegister, 'default');
  assert.equal(runState.ledgerState.appliedCommitment, null);
  assert.deepEqual(runState.registerRows, [{ turn: 1, register: 'default', scope: 'scene_end', scene: 1 }]);
  assert.equal(runState.sceneRows.length, 1);
  assert.equal(statuses[0].closedScene.closeReason, 'D decreased');
  assert.equal(statuses[0].scene, null);
  assert.equal(statuses[0].publicRegister, 'default');
  assert.deepEqual(statuses[0].proxyDagPacing, { signal: 'advance' });
});

test('post-turn lifecycle applies deterministic decay before projecting live corruption state', () => {
  const statuses = [];
  const runState = createDramaRunState({
    world,
    options: {
      decay: { seed: 7, rate: 1, graceTurns: 0, maxConcurrent: 1, startTurn: 1 },
      onTurn: (status) => statuses.push(status),
    },
  });
  const premise = world.premiseById.get('p1').fact;
  const key = factKey(premise);
  runState.releasedKeys.add(key);
  runState.releasedIdByKey.set(key, 'p1');
  runState.grounded.set(key, { fact: premise, turn: 1, valid: true });
  runState.ledger.push({ turn: 1, premiseId: 'p1', via: 'tutor' });
  runState.trajectory.push({ turn: 1, D: 2, forced: false, groundedCount: 2, F: 1 });

  const result = runPostTurnLifecycle(lifecycleInput(runState, { releasedThisTurn: [premise] }));

  assert.deepEqual(result.decayedNow, ['p1']);
  assert.equal(runState.grounded.get(key).decayed, true);
  assert.deepEqual(runState.corruption.ledger, [{ turn: 1, type: 'decay', premiseId: 'p1', fact: premise }]);
  assert.deepEqual(statuses[0].decayedNow, ['p1']);
  assert.equal(statuses[0].decayActive, 1);
  assert.equal(statuses[0].events.at(-1).type, 'decay');
});

test('post-turn lifecycle records a terminal stall before decay and exposes the terminal status', () => {
  const statuses = [];
  const runState = createDramaRunState({
    world,
    options: {
      decay: { seed: 7, rate: 1, graceTurns: 0, maxConcurrent: 1, startTurn: 1 },
      onTurn: (status) => statuses.push(status),
    },
  });
  const premise = world.premiseById.get('p1').fact;
  const key = factKey(premise);
  runState.releasedKeys.add(key);
  runState.releasedIdByKey.set(key, 'p1');
  runState.grounded.set(key, { fact: premise, turn: 1, valid: true });
  runState.ledger.push({ turn: 1, premiseId: 'p1', via: 'tutor' });
  runState.trajectory.push(
    { turn: 1, D: 2, forced: false, groundedCount: 2 },
    { turn: 2, D: 2, forced: false, groundedCount: 2 },
    { turn: 3, D: 2, forced: false, groundedCount: 2 },
    { turn: 4, D: 2, forced: false, groundedCount: 2 },
  );

  const result = runPostTurnLifecycle(lifecycleInput(runState, { turn: 4 }));

  assert.equal(result.endedBy, 'disengagement');
  assert.deepEqual(result.decayedNow, []);
  assert.equal(runState.grounded.get(key).decayed, undefined);
  assert.equal(runState.events.at(-1).type, 'disengagement');
  assert.equal(statuses[0].endedBy, 'disengagement');
  assert.equal(statuses[0].events.at(-1).type, 'disengagement');
});

test('post-turn lifecycle records the logic projection after lifecycle mutations', () => {
  const runState = createDramaRunState({ world, options: { logicProjection: true } });
  const premise = world.premiseById.get('p1').fact;
  const key = factKey(premise);
  runState.releasedKeys.add(key);
  runState.releasedIdByKey.set(key, 'p1');
  runState.grounded.set(key, { fact: premise, turn: 1, valid: true });
  runState.ledger.push({ turn: 1, premiseId: 'p1', via: 'tutor' });

  runPostTurnLifecycle(lifecycleInput(runState));

  assert.equal(runState.logicSnapshots.length, 1);
  assert.equal(runState.logicSnapshots[0].trajectoryD, 2);
  assert.deepEqual(runState.logicSnapshots[0].groundedPremiseIds, ['p1']);
  assert.deepEqual(runState.logicSnapshots[0].releasedPremiseIds, ['p1']);
  assert.deepEqual(runState.logicSnapshots[0].decayedPremiseIds, []);
});
