import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { loadWorld } from '../services/dramaticDerivation/world.js';
import { buildLearnerDag, buildLearnerDagSnapshot } from '../services/dramaticDerivation/learnerDag.js';
import {
  buildDynamicLearnerField,
  buildLearnerFieldSnapshot,
  buildLearnerFieldTopology,
  LEARNER_FIELD_SCHEMA,
} from '../services/dramaticDerivation/learnerField.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function smokeWorld() {
  return loadWorld(path.join(ROOT, 'config/drama-derivation/world-000-smoke.yaml'));
}

function ledgerThrough(turn) {
  return [
    { turn: 2, premiseId: 'p1', via: 'director' },
    { turn: 4, premiseId: 'p4', via: 'director' },
    { turn: 5, premiseId: 'p2', via: 'tutor' },
    { turn: 8, premiseId: 'p3', via: 'tutor' },
  ].filter((row) => row.turn <= turn);
}

test('buildLearnerFieldTopology projects the authored proof topology into field nodes', () => {
  const world = smokeWorld();
  const topology = buildLearnerFieldTopology(world);

  assert.equal(topology.schema, `${LEARNER_FIELD_SCHEMA}.topology`);
  assert.deepEqual(topology.nodes.map((node) => node.premiseId).sort(), ['p1', 'p2', 'p3', 'p4']);
  assert.ok(topology.nodes.find((node) => node.premiseId === 'p1').pathIds.includes('path_1'));
  assert.ok(topology.nodes.find((node) => node.premiseId === 'p4').pathIds.length === 0);
  assert.deepEqual(
    topology.edges.map((edge) => edge.id),
    ['field-edge:path_1:p1->p2', 'field-edge:path_1:p2->p3'],
  );
});

test('buildDynamicLearnerField computes velocity when a premise becomes held', () => {
  const world = smokeWorld();
  const p1 = world.premiseById.get('p1').fact;
  const p2 = world.premiseById.get('p2').fact;
  const dag = buildLearnerDag(
    [
      buildLearnerDagSnapshot(world, {
        turn: 2,
        boardFacts: [p1],
        validFacts: [p1],
        ledger: ledgerThrough(2),
      }),
      buildLearnerDagSnapshot(world, {
        turn: 5,
        boardFacts: [p1, p2],
        validFacts: [p1, p2],
        voiced: [{ turn: 5, fact: ['grandchild', 'marin', 'founder'] }],
        ledger: ledgerThrough(5),
      }),
    ],
    world,
  );

  const field = buildDynamicLearnerField(world, dag);
  assert.equal(field.schema, LEARNER_FIELD_SCHEMA);
  assert.equal(field.turns.length, 2);

  const p2Field = field.turns[1].nodes.find((node) => node.premiseId === 'p2');
  assert.equal(p2Field.held, true);
  assert.equal(p2Field.dimensions.mastery, 1);
  assert.ok(p2Field.dynamics.velocity.mastery > 0);
  assert.equal(p2Field.phase, 'breakthrough');
  assert.ok(field.trajectory.fieldDelta.mastery > 0);
});

test('buildLearnerFieldSnapshot marks released but unheld proof material as productive confusion', () => {
  const world = smokeWorld();
  const p1 = world.premiseById.get('p1').fact;
  const p2 = world.premiseById.get('p2').fact;
  const snapshot = buildLearnerDagSnapshot(world, {
    turn: 8,
    boardFacts: [p1, p2],
    validFacts: [p1, p2],
    ledger: ledgerThrough(8),
  });

  const field = buildLearnerFieldSnapshot(world, snapshot);
  const p3Field = field.nodes.find((node) => node.premiseId === 'p3');
  assert.equal(p3Field.released, true);
  assert.equal(p3Field.held, false);
  assert.equal(p3Field.attractor, 'productive_confusion');
  assert.ok(field.recommendedActions.some((action) => action.action === 'scaffold_next_observation'));
});

test('buildLearnerFieldSnapshot flags unsupported confident assertions as misconception attractors', () => {
  const world = smokeWorld();
  const p1 = world.premiseById.get('p1').fact;
  const p2 = world.premiseById.get('p2').fact;
  const snapshot = buildLearnerDagSnapshot(world, {
    turn: 5,
    boardFacts: [p1, p2],
    validFacts: [p1, p2],
    assertion: ['heir', 'joren'],
    ledger: ledgerThrough(5),
  });

  const field = buildLearnerFieldSnapshot(world, snapshot);
  assert.equal(
    field.nodes.some((node) => node.attractor === 'misconception_attractor'),
    false,
  );
  assert.equal(field.evidenceNodes.length, 1);
  assert.equal(field.evidenceNodes[0].attractor, 'misconception_attractor');
  assert.equal(field.summary.evidenceNodeCount, 1);
  assert.ok((field.summary.attractorCounts.misconception_attractor || 0) >= 1);
  assert.ok(field.recommendedActions.some((action) => action.action === 'destabilize_misconception'));
});
