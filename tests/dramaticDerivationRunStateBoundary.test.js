import assert from 'node:assert/strict';
import test from 'node:test';
import {
  loadWorld,
  makeMockDirector,
  makeMockLearner,
  makeMockTutor,
  runDrama,
} from '../services/dramaticDerivation/index.js';
import {
  createDramaRunState,
  normalizeActsConfig,
  normalizeDirectorCadence,
} from '../services/dramaticDerivation/runState.js';
import {
  createDramaStagePrologue,
  finalizeDramaRunLifecycle,
  resolveDramaTurnLimit,
} from '../services/dramaticDerivation/runLifecycle.js';
import { resolveDramaVerdict } from '../services/dramaticDerivation/runResult.js';

const world = loadWorld('config/drama-derivation/world-000-smoke.yaml');

function mockRoles() {
  return {
    director: makeMockDirector(world),
    tutor: makeMockTutor(world),
    learner: makeMockLearner(),
  };
}

const BASE_RESULT_KEYS = [
  'assertedGroundedTurn',
  'events',
  'firstForcedTurn',
  'inference',
  'learnerDag',
  'ledger',
  'proof',
  'trajectory',
  'transcript',
  'turnsPlayed',
  'verdict',
  'worldId',
];

test('run-state owner creates isolated formal state and enforces cross-feature guards', () => {
  const first = createDramaRunState({ world });
  const second = createDramaRunState({ world });

  assert.equal(first.opts.maxTurns, Infinity);
  assert.equal(first.grounded.size, world.background.length);
  assert.deepEqual(
    [...first.grounded.values()].map((entry) => entry.fact),
    world.background,
  );
  assert.equal(first.corruption, null);
  assert.equal(first.actState, null);
  assert.equal(first.lemmaRun, null);
  assert.equal(first.registerRouterState, null);
  assert.notEqual(first.events, second.events);
  assert.notEqual(first.grounded, second.grounded);

  assert.throws(
    () => createDramaRunState({ world, options: { acts: {}, fieldPlanner: true } }),
    /field planner currently requires non-acts mode/u,
  );
  assert.throws(
    () => createDramaRunState({ world, options: { strategyLedger: true } }),
    /strategy ledger requires scene mode/u,
  );
  assert.deepEqual(normalizeActsConfig('{"minActTurns":2,"maxActTurns":5}'), {
    minActTurns: 2,
    maxActTurns: 5,
  });
  assert.equal(normalizeDirectorCadence(null, { sceneMode: true }), 'scene');
});

test('lifecycle owner preserves the turn cap and fallback prologue contract', async () => {
  assert.equal(resolveDramaTurnLimit(world, { maxTurns: 3 }), 3);
  assert.equal(resolveDramaTurnLimit(world, { maxTurns: Infinity }), world.turnCap);

  const lifecycle = await createDramaStagePrologue({
    enabled: true,
    director: async () => ({}),
    world,
    publicRegister: 'modern',
    groundedFacts: world.background,
    inferenceFrontier: [],
  });
  assert.equal(lifecycle.prologue.stageNotes.includes(world.title), true);
  assert.deepEqual(lifecycle.transcriptLine.meta, {
    prologue: lifecycle.prologue,
    publicRegister: 'modern',
  });
  assert.equal(
    await createDramaStagePrologue({
      enabled: false,
      director: async () => ({}),
      world,
      publicRegister: 'default',
      groundedFacts: world.background,
      inferenceFrontier: [],
    }),
    null,
  );
});

test('lifecycle owner seals scene, strategy, act, and final-audit state', async () => {
  const runState = {
    trajectory: [{ D: 2 }],
    sceneRows: [],
    ledgerState: {
      block: { clearance: [{ turn: 2 }] },
      blockRows: [],
    },
    actState: { index: 2, startTurn: 2, brief: 'press the proof', history: [] },
    transcript: [{ turn: 1, role: 'tutor', text: 'Consider the record.' }],
    ledger: [{ turn: 1, premiseId: 'p1', via: 'director' }],
    plotAuditRows: [],
    events: [],
  };
  const sceneState = { index: 1, dStart: 3, exchanges: [{ turn: 1 }] };

  await finalizeDramaRunLifecycle({
    runState,
    sceneState,
    turn: 3,
    endedBy: 'leak',
    tutor: {
      finalAudit: async () => ({ act: 2, clauses: [], summary: 'sealed' }),
    },
    didacticFallbackForAct: () => ({ schema: 'fallback.v1' }),
    plotAuditDetail: () => 'act 2 plot audited at run end',
  });

  assert.deepEqual(runState.sceneRows, [
    {
      index: 1,
      dStart: 3,
      dEnd: 2,
      endTurn: 3,
      status: 'failed',
      closeReason: 'run ended: leak',
      exchanges: [{ turn: 1 }],
    },
  ]);
  assert.equal(runState.ledgerState.block, null);
  assert.equal(runState.ledgerState.blockRows[0].status, 'run_end');
  assert.deepEqual(runState.actState.history[0], {
    act: 2,
    turns: [2, 3],
    endedBy: 'run_end',
    brief: 'press the proof',
    didacticFallback: { schema: 'fallback.v1' },
  });
  assert.deepEqual(runState.plotAuditRows, [{ turn: 3, final: true, act: 2, clauses: [], summary: 'sealed' }]);
  assert.deepEqual(runState.events, [{ turn: 3, type: 'plot_audit', detail: 'act 2 plot audited at run end' }]);
});

test('result owner keeps terminal precedence explicit', () => {
  assert.equal(
    resolveDramaVerdict({
      endedBy: null,
      events: [{ type: 'mirror' }],
      firstForcedTurn: null,
      assertedGroundedTurn: null,
    }),
    'mirror',
  );
  assert.equal(
    resolveDramaVerdict({
      endedBy: null,
      events: [{ type: 'lucky_leap' }],
      firstForcedTurn: 4,
      assertedGroundedTurn: null,
    }),
    'unstaged_recognition',
  );
  assert.equal(
    resolveDramaVerdict({ endedBy: 'leak', events: [], firstForcedTurn: null, assertedGroundedTurn: null }),
    'leak',
  );
});

test('run-state baseline is deterministic and omits every opt-in result surface', async () => {
  const first = await runDrama({ world, roles: mockRoles() });
  const second = await runDrama({ world, roles: mockRoles() });

  assert.deepEqual(second, first);
  assert.deepEqual(Object.keys(first).sort(), BASE_RESULT_KEYS);
  assert.equal(first.verdict, 'grounded_anagnorisis');
  assert.equal(first.turnsPlayed, 8);
  assert.deepEqual(
    first.transcript.map(({ turn, role }) => [turn, role]),
    Array.from({ length: 8 }, (_, index) => [
      [index + 1, 'director'],
      [index + 1, 'tutor'],
      [index + 1, 'learner'],
    ]).flat(),
  );
});

test('outer lifecycle adds only the requested prologue, register, and logic surfaces', async () => {
  const result = await runDrama({
    world,
    roles: mockRoles(),
    options: {
      stagePrologue: true,
      logicProjection: true,
      publicRegister: 'modern',
      maxTurns: 4,
    },
  });

  assert.deepEqual(
    Object.keys(result).sort(),
    [...BASE_RESULT_KEYS, 'logicSnapshots', 'publicRegister', 'stagePrologue'].sort(),
  );
  assert.equal(result.verdict, 'cap_reached');
  assert.equal(result.turnsPlayed, 4);
  assert.equal(result.publicRegister, 'modern');
  assert.equal(result.logicSnapshots.length, 4);
  assert.deepEqual(result.transcript[0], {
    turn: 0,
    role: 'director',
    text: result.stagePrologue.stageNotes,
    meta: {
      prologue: result.stagePrologue,
      publicRegister: 'modern',
    },
  });
});

test('corruption remains an additive run-level result contract', async () => {
  const result = await runDrama({
    world,
    roles: mockRoles(),
    options: {
      decay: {
        seed: 2,
        rate: 1,
        graceTurns: 0,
        maxConcurrent: 2,
        startTurn: 5,
      },
    },
  });

  assert.deepEqual(Object.keys(result).sort(), [...BASE_RESULT_KEYS, 'corruption'].sort());
  assert.equal(result.corruption.config.seed, 2);
  assert.ok(result.corruption.ledger.length > 0);
  assert.ok(result.corruption.ledger.every((entry) => entry.turn >= 5));
});
