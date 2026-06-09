import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import {
  factKey,
  matchPattern,
  closure,
  entails,
  proofTree,
  loadWorld,
  validateWorld,
  plotLint,
  derivationDistance,
  detectStall,
  runDrama,
  makeMockDirector,
  makeMockTutor,
  makeMockLearner,
} from '../services/dramaticDerivation/index.js';

const WORLD_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../config/drama-derivation/world-000-smoke.yaml',
);

const world = loadWorld(WORLD_PATH);

const mockRoles = (policy = {}) => ({
  director: makeMockDirector(world),
  tutor: makeMockTutor(world),
  learner: makeMockLearner(policy),
});

// ---------------------------------------------------------------------------
// chainer
// ---------------------------------------------------------------------------

test('matchPattern binds variables and rejects mismatches', () => {
  assert.deepEqual(matchPattern(['heir', '?x'], ['heir', 'marin']), { '?x': 'marin' });
  assert.equal(matchPattern(['heir', '?x'], ['child', 'marin']), null);
  assert.equal(matchPattern(['heir', '?x'], ['heir', 'marin', 'extra']), null);
  // repeated variable must bind consistently
  assert.equal(matchPattern(['child', '?x', '?x'], ['child', 'a', 'b']), null);
  assert.deepEqual(matchPattern(['child', '?x', '?x'], ['child', 'a', 'a']), { '?x': 'a' });
  // prior bindings constrain the match
  assert.deepEqual(matchPattern(['child', '?x', '?y'], ['child', 'a', 'b'], { '?x': 'a' }), {
    '?x': 'a',
    '?y': 'b',
  });
  assert.equal(matchPattern(['child', '?x', '?y'], ['child', 'a', 'b'], { '?x': 'z' }), null);
});

test('closure derives to fixpoint and records first proofs', () => {
  const base = [
    ['child', 'marin', 'tessa'],
    ['child', 'tessa', 'founder'],
    ['bearsMark', 'marin'],
  ];
  const { facts, proofs } = closure(base, world.rules);
  assert.ok(facts.has(factKey(['grandchild', 'marin', 'founder'])));
  assert.ok(facts.has(factKey(['heir', 'marin'])));
  // base facts carry a null proof; derived facts carry {rule, premises}
  assert.equal(proofs.get(factKey(base[0])), null);
  const grandchildProof = proofs.get(factKey(['grandchild', 'marin', 'founder']));
  assert.equal(grandchildProof.rule, 'R1_lineage');
  assert.deepEqual(grandchildProof.premises, [factKey(base[0]), factKey(base[1])]);
});

test('entails answers positively and negatively', () => {
  const base = [
    ['child', 'marin', 'tessa'],
    ['child', 'tessa', 'founder'],
  ];
  assert.ok(entails(base, world.rules, ['grandchild', 'marin', 'founder']));
  assert.equal(entails(base, world.rules, ['heir', 'marin']), false);
});

test('proofTree expands a derived goal down to base facts', () => {
  const base = [
    ['child', 'marin', 'tessa'],
    ['child', 'tessa', 'founder'],
    ['bearsMark', 'marin'],
  ];
  const tree = proofTree(base, world.rules, ['heir', 'marin']);
  assert.equal(tree.base, false);
  assert.equal(tree.rule, 'R2_succession');
  const leaves = [];
  const walk = (node) => {
    if (node.base) leaves.push(factKey(node.fact));
    else node.premises.forEach(walk);
  };
  walk(tree);
  assert.deepEqual(new Set(leaves), new Set(base.map(factKey)));
  assert.equal(proofTree(base.slice(0, 2), world.rules, ['heir', 'marin']), null);
});

// ---------------------------------------------------------------------------
// world validation + plot lint
// ---------------------------------------------------------------------------

test('validateWorld requires the public question pattern', () => {
  const raw = yaml.parse(fs.readFileSync(WORLD_PATH, 'utf8'));
  delete raw.question_pattern;
  assert.throws(() => validateWorld(raw, 'test'), /question_pattern/);
});

test('plotLint passes the smoke world and reports first entailment turn', () => {
  const lint = plotLint(world);
  assert.deepEqual(lint.errors, []);
  assert.ok(lint.ok);
  assert.equal(lint.firstEntailedTurn, 8);
  assert.ok(lint.firstEntailedTurn >= world.slope.t_min);
});

test('plotLint catches an anti-reveal breach in the schedule', () => {
  const raw = yaml.parse(fs.readFileSync(WORLD_PATH, 'utf8'));
  // move the keystone premise before t_min: full derivation lands at turn 5
  raw.release_schedule = raw.release_schedule.map((e) => (e.premise === 'p3' ? { ...e, turn: 3 } : e));
  const lint = plotLint(validateWorld(raw, 'mutated'));
  assert.equal(lint.ok, false);
  assert.equal(lint.firstEntailedTurn, 5);
  assert.ok(lint.errors.some((e) => e.includes('anti-reveal')));
});

// ---------------------------------------------------------------------------
// slope
// ---------------------------------------------------------------------------

test('derivationDistance counts missing path premises, 0 once forced', () => {
  const p = (id) => world.premiseById.get(id).fact;
  assert.equal(derivationDistance(world, world.background), 3);
  assert.equal(derivationDistance(world, [...world.background, p('p1'), p('p2')]), 1);
  assert.equal(derivationDistance(world, [p('p1'), p('p2'), p('p3')]), 0);
});

test('detectStall separates disengagement from pure aporia', () => {
  // pure aporia: the abox keeps growing but D never falls — unreachable with
  // the simple mock learner (it stops adopting entirely), hence synthetic
  const aporia = [
    { turn: 5, D: 2, groundedCount: 3 },
    { turn: 6, D: 2, groundedCount: 4 },
    { turn: 7, D: 2, groundedCount: 5 },
    { turn: 8, D: 2, groundedCount: 6 },
  ];
  assert.equal(detectStall(aporia, 4, 2), 'aporia');

  const disengaged = aporia.map((e) => ({ ...e, groundedCount: 3 }));
  assert.equal(detectStall(disengaged, 4, 2), 'disengagement');

  // too short, pre-release, resolved, and progressing tails are not stalls
  assert.equal(detectStall(aporia.slice(0, 3), 4, 2), null);
  assert.equal(detectStall(aporia, 4, 6), null);
  assert.equal(
    detectStall(
      aporia.map((e) => ({ ...e, D: 0 })),
      4,
      2,
    ),
    null,
  );
  const progressing = aporia.map((e, i) => ({ ...e, D: 4 - i }));
  assert.equal(detectStall(progressing, 4, 2), null);
});

// ---------------------------------------------------------------------------
// engine integration (deterministic mock roles, zero model calls)
// ---------------------------------------------------------------------------

test('happy path reaches grounded anagnorisis on the authored slope', async () => {
  const result = await runDrama({ world, roles: mockRoles() });
  assert.equal(result.verdict, 'grounded_anagnorisis');
  assert.equal(result.turnsPlayed, 8);
  assert.equal(result.firstForcedTurn, 8);
  assert.equal(result.assertedGroundedTurn, 8);
  assert.ok(result.assertedGroundedTurn >= world.slope.t_min);
  assert.deepEqual(
    result.trajectory.map((p) => p.D),
    [3, 2, 2, 2, 1, 1, 1, 0],
  );
  assert.deepEqual(result.ledger, [
    { turn: 2, premiseId: 'p1', via: 'director' },
    { turn: 4, premiseId: 'p4', via: 'director' },
    { turn: 5, premiseId: 'p2', via: 'tutor' },
    { turn: 8, premiseId: 'p3', via: 'tutor' },
  ]);
  // the proof of the recognition is extractable down to released facts
  assert.equal(result.proof.rule, 'R2_succession');
  assert.equal(factKey(result.proof.fact), factKey(world.secret.fact));
});

test('an unforced assertion of S is a lucky leap, not anagnorisis', async () => {
  const result = await runDrama({
    world,
    roles: mockRoles({ luckyLeapAt: 6, leapFact: world.secret.fact }),
  });
  const leap = result.events.find((e) => e.type === 'lucky_leap');
  assert.ok(leap);
  assert.equal(leap.turn, 6);
  // the drama continues; the same learner later EARNS the recognition
  assert.equal(result.verdict, 'grounded_anagnorisis');
  assert.equal(result.assertedGroundedTurn, 8);
});

test('a learner that stops adopting is detected as disengagement', async () => {
  const result = await runDrama({ world, roles: mockRoles({ stallAfter: 5 }) });
  assert.equal(result.verdict, 'disengagement');
  assert.ok(result.events.some((e) => e.type === 'disengagement'));
  assert.equal(result.firstForcedTurn, null);
});

test('converging on the authored near-miss yields the mirror verdict', async () => {
  const result = await runDrama({
    world,
    roles: mockRoles({ assertMirrorAt: 6, mirrorFact: world.mirror.fact, stallAfter: 6 }),
  });
  assert.equal(result.verdict, 'mirror');
  const mirror = result.events.find((e) => e.type === 'mirror');
  assert.equal(mirror.turn, 6);
});

test('adopted-but-never-released facts are fabrications, excluded from success', async () => {
  // operator-authored learner: invents the keystone fact instead of earning it
  const fabricator = async (view) => {
    if (view.turn === 1) {
      return { dialogue: 'I already know the mark is Marin’s.', adopt: [['bearsMark', 'marin']] };
    }
    return { dialogue: 'I rest on what I know.' };
  };
  const result = await runDrama({
    world,
    roles: { director: makeMockDirector(world), tutor: makeMockTutor(world), learner: fabricator },
  });
  const fabricated = result.events.find((e) => e.type === 'fabricated_fact');
  assert.ok(fabricated);
  assert.equal(fabricated.turn, 1);
  // the fabricated fact never enters the success channel
  assert.ok(result.trajectory.every((p) => p.forced === false));
  assert.ok(result.trajectory.every((p) => p.D === 3));
  assert.equal(result.firstForcedTurn, null);
});

// ---------------------------------------------------------------------------
// the single-concealment invariant (engine.js header contract)
// ---------------------------------------------------------------------------

test('learner views conceal exactly S, the mirror, and unreleased premises', async () => {
  const views = [];
  const inner = makeMockLearner({});
  const spy = async (view) => {
    views.push(JSON.parse(JSON.stringify(view)));
    return inner(view);
  };
  const result = await runDrama({
    world,
    roles: { director: makeMockDirector(world), tutor: makeMockTutor(world), learner: spy },
  });
  assert.equal(result.verdict, 'grounded_anagnorisis');
  assert.equal(views.length, result.turnsPlayed);

  const releaseTurn = new Map(world.releaseSchedule.map((e) => [e.premise, e.turn]));
  const VIEW_KEYS = [
    'abox',
    'background',
    'question',
    'questionPattern',
    'releasedFacts',
    'releasedThisTurn',
    'rules',
    'transcript',
    'turn',
  ];

  for (const view of views) {
    // structural: the view exposes exactly the public surface, nothing else
    assert.deepEqual(Object.keys(view).sort(), VIEW_KEYS);
    for (const entry of view.transcript) {
      assert.deepEqual(Object.keys(entry).sort(), ['role', 'text', 'turn']);
    }

    const serialized = JSON.stringify(view);
    // the secret and the mirror never appear in any learner view
    assert.ok(!serialized.includes(factKey(world.secret.fact)), `secret leaked at turn ${view.turn}`);
    assert.ok(!serialized.includes(factKey(world.mirror.fact)), `mirror leaked at turn ${view.turn}`);
    // premises stay invisible until their scheduled release turn
    for (const premise of world.premises) {
      const released = view.turn >= (releaseTurn.get(premise.id) ?? Infinity);
      if (!released) {
        assert.ok(!serialized.includes(factKey(premise.fact)), `premise ${premise.id} leaked at turn ${view.turn}`);
      }
    }
  }

  // sanity: released premises DO reach the view once staged (not over-concealed)
  const finalView = views[views.length - 1];
  const finalSerialized = JSON.stringify(finalView);
  for (const premise of world.premises) {
    if (finalView.turn >= releaseTurn.get(premise.id)) {
      assert.ok(finalSerialized.includes(factKey(premise.fact)));
    }
  }
});
