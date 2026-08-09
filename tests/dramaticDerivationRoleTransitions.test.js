import assert from 'node:assert/strict';
import test from 'node:test';
import { factKey } from '../services/dramaticDerivation/chainer.js';
import { runDirectorTransition } from '../services/dramaticDerivation/directorTransition.js';
import { runLearnerTransition } from '../services/dramaticDerivation/learnerTransition.js';
import { createDramaRunState } from '../services/dramaticDerivation/runState.js';
import { runTutorTransition } from '../services/dramaticDerivation/tutorTransition.js';
import { loadWorld } from '../services/dramaticDerivation/world.js';

const world = loadWorld('config/drama-derivation/world-000-smoke.yaml');

function validFacts(runState) {
  return [...runState.grounded.values()].filter((entry) => entry.valid && !entry.decayed).map((entry) => entry.fact);
}

test('director transition owns cadence, release, act phase, and transcript ordering', async () => {
  const runState = createDramaRunState({ world, options: { acts: { minActTurns: 2, maxActTurns: 4 } } });
  const releasedThisTurn = [];
  const roleViews = [];
  const first = await runDirectorTransition({
    turn: 1,
    openedScene: null,
    role: async (view) => {
      roleViews.push(view);
      return { direction: 'Open the inquiry.', act: 'continue', release: 'p1' };
    },
    shouldCallDirector: () => true,
    buildView: () => ({ proxyDagPacing: { turn: 1, signal: 'hold' } }),
    proxyDagPacingRows: runState.proxyDagPacingRows,
    applyRelease: (_turn, premiseId, via) => ({ premiseId, via }),
    releasedThisTurn,
    lemmaRun: null,
    lemmaConfig: null,
    lemmaDag: null,
    events: runState.events,
    actState: runState.actState,
    acts: runState.acts,
    staging: runState.staging,
    didacticFallbackForAct: () => null,
    sceneMeta: { index: 1 },
    publicRegister: 'modern',
    transcript: runState.transcript,
  });

  assert.equal(first.callDirector, true);
  assert.equal(roleViews.length, 1);
  assert.deepEqual(releasedThisTurn, [{ premiseId: 'p1', via: 'director' }]);
  assert.deepEqual(runState.staging.phase, { name: 'Act 1', intent: 'Open the inquiry.', turn: 1 });
  assert.deepEqual(runState.proxyDagPacingRows, [{ turn: 1, signal: 'hold' }]);
  assert.deepEqual(runState.transcript[0], {
    turn: 1,
    role: 'director',
    text: 'Open the inquiry.',
    meta: {
      release: 'p1',
      phase: { name: 'Act 1', intent: 'Open the inquiry.', turn: 1 },
      act: 'continue',
      scene: { index: 1 },
      proxyDagPacing: { turn: 1, signal: 'hold' },
      publicRegister: 'modern',
    },
  });
});

test('director transition preserves the minimum-act guard', async () => {
  const runState = createDramaRunState({ world, options: { acts: { minActTurns: 2, maxActTurns: 4 } } });
  runState.actState.brief = 'opening';
  await runDirectorTransition({
    turn: 2,
    openedScene: null,
    role: async () => ({ direction: 'Turn early.', act: 'end' }),
    shouldCallDirector: () => true,
    buildView: () => ({}),
    proxyDagPacingRows: runState.proxyDagPacingRows,
    applyRelease: () => null,
    releasedThisTurn: [],
    lemmaRun: null,
    lemmaConfig: null,
    lemmaDag: null,
    events: runState.events,
    actState: runState.actState,
    acts: runState.acts,
    staging: runState.staging,
    didacticFallbackForAct: () => null,
    sceneMeta: null,
    publicRegister: 'default',
    transcript: runState.transcript,
  });

  assert.equal(runState.actState.index, 1);
  assert.equal(runState.events[0].type, 'act_min_blocked');
  assert.equal(runState.transcript[0].meta.act, 'end');
});

test('tutor transition keeps the pre-commit register on the tutor line and returns the scene register', async () => {
  const runState = createDramaRunState({
    world,
    options: { sceneMode: {}, strategyLedger: true },
  });
  const sceneState = { index: 1 };
  const releasedThisTurn = [];
  const result = await runTutorTransition({
    runState,
    world,
    turn: 1,
    role: async () => ({
      dialogue: 'Let us begin with the record.',
      release: 'p1',
      move: { intent: 'stage', targetPremise: 'p1' },
      sceneCommitment: {
        register: 'modern',
        didacticDefault: 'question',
        releasePosture: 'paced',
        recognitionBudget: 1,
      },
    }),
    buildView: () => ({ proxyDagPacing: { turn: 1 }, tutorLearnerDagModel: { turn: 1 } }),
    currentProofDebt: () => ({ active: false }),
    applyRelease: () => world.premiseById.get('p1').fact,
    releasedThisTurn,
    sceneState,
    sceneMeta: { index: 1 },
    sceneTempo: null,
    publicRegister: 'default',
    premiseIdForKey: () => 'p1',
    plotAuditDetail: () => 'plot audited',
    learnerTransformationRow: () => ({}),
  });

  assert.equal(result.tutorRelease, world.premiseById.get('p1').fact);
  assert.equal(result.publicRegister, 'modern');
  assert.equal(runState.transcript[0].meta.publicRegister, 'default');
  assert.equal(runState.transcript[0].meta.scene.index, 1);
  assert.equal(runState.ledgerState.rows[0].commitment.register, 'modern');
  assert.deepEqual(runState.registerRows, [{ turn: 1, register: 'modern', scope: 'scene', scene: 1 }]);
  assert.deepEqual(releasedThisTurn, [world.premiseById.get('p1').fact]);
});

test('learner transition applies only released adoptions and returns formal turn state', async () => {
  const runState = createDramaRunState({ world });
  const p1 = world.premiseById.get('p1').fact;
  runState.releasedKeys.add(factKey(p1));
  runState.releasedFacts.push(p1);
  runState.releasedIdByKey.set(factKey(p1), 'p1');
  runState.ledger.push({ turn: 1, premiseId: 'p1', via: 'tutor' });

  const result = await runLearnerTransition({
    runState,
    world,
    turn: 1,
    role: async () => ({ dialogue: 'I accept that Marin is Tessa child.', adopt: [p1] }),
    buildView: () => ({ public: true }),
    releasedThisTurn: [p1],
    sceneState: null,
    sceneMeta: null,
    sceneTempo: null,
    publicRegister: 'modern',
    tutorOut: {},
    tutorRelease: p1,
    fieldPlannerRow: null,
    firstForcedTurn: null,
    assertedGroundedTurn: null,
    endedBy: null,
    validGroundedFacts: () => validFacts(runState),
    learnerBoardFacts: () => [...runState.grounded.values()].map((entry) => entry.fact),
    recordAvailability: () => {},
    theoryFidelity: () => 1,
    premiseIdForKey: () => 'p1',
    normKey: (fact) => fact.join(' ').toLowerCase(),
    isPatternFact: (fact) => fact[0] === 'heir',
    renderFact: (fact) => fact.join(' '),
    learnerTransformationRow: () => ({}),
  });

  assert.equal(runState.grounded.get(factKey(p1)).valid, true);
  assert.equal(result.endedBy, null);
  assert.equal(result.forced, false);
  assert.equal(result.D, 2);
  assert.equal(runState.transcript[0].role, 'learner');
  assert.equal(runState.transcript[0].meta.publicRegister, 'modern');
  assert.deepEqual(runState.trajectory[0], { turn: 1, D: 2, forced: false, groundedCount: 2 });
});
