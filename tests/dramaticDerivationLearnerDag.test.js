import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { loadWorld } from '../services/dramaticDerivation/world.js';
import {
  buildLearnerDag,
  buildLearnerDagFromResult,
  buildLearnerDagSnapshot,
} from '../services/dramaticDerivation/learnerDag.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function smokeWorld() {
  return loadWorld(path.join(ROOT, 'config/drama-derivation/world-000-smoke.yaml'));
}

test('buildLearnerDagSnapshot captures learner-owned proof nodes and rule applications', () => {
  const world = smokeWorld();
  const p1 = world.premiseById.get('p1').fact;
  const p2 = world.premiseById.get('p2').fact;
  const p3 = world.premiseById.get('p3').fact;
  const grandchild = ['grandchild', 'marin', 'founder'];
  const snapshot = buildLearnerDagSnapshot(world, {
    turn: 8,
    boardFacts: [p1, p2, p3],
    validFacts: [p1, p2, p3],
    voiced: [{ turn: 5, fact: grandchild }],
    assertion: ['heir', 'marin'],
    ledger: [
      { turn: 2, premiseId: 'p1', via: 'director' },
      { turn: 5, premiseId: 'p2', via: 'tutor' },
      { turn: 8, premiseId: 'p3', via: 'tutor' },
    ],
  });

  assert.equal(snapshot.secretEntailed, true);
  assert.deepEqual(snapshot.heldPremiseIds, ['p1', 'p2', 'p3']);
  assert.ok(snapshot.nodes.some((node) => node.factText === 'heir(marin)' && node.statuses.includes('asserted')));
  assert.equal(snapshot.metrics.ruleApplicationCount, 2);
  assert.ok(snapshot.nodes.some((node) => node.kind === 'rule_application' && node.rule === 'R1_lineage'));
  assert.ok(snapshot.nodes.some((node) => node.kind === 'rule_application' && node.rule === 'R2_succession'));
  assert.ok(snapshot.edges.some((edge) => edge.kind === 'input' && edge.rule === 'R1_lineage'));
  assert.ok(snapshot.edges.some((edge) => edge.kind === 'output' && edge.rule === 'R2_succession'));
});

test('buildLearnerDagFromResult assesses coverage against authored paths without exposing them to the learner', () => {
  const world = smokeWorld();
  const result = {
    ledger: [
      { turn: 2, premiseId: 'p1', via: 'director' },
      { turn: 5, premiseId: 'p2', via: 'tutor' },
      { turn: 8, premiseId: 'p3', via: 'tutor' },
    ],
    transcript: [
      {
        turn: 2,
        role: 'learner',
        text: 'I will hold the first relation.',
        meta: { adopt: [world.premiseById.get('p1').fact], retract: [], derive: [], deriveOutcomes: [] },
      },
      {
        turn: 5,
        role: 'learner',
        text: 'Then Marin is the founder grandchild.',
        meta: {
          adopt: [world.premiseById.get('p2').fact],
          retract: [],
          derive: [['grandchild', 'marin', 'founder']],
          deriveOutcomes: [{ fact: ['grandchild', 'marin', 'founder'], status: 'voiced' }],
        },
      },
      {
        turn: 8,
        role: 'learner',
        text: 'The board now settles Marin.',
        meta: {
          adopt: [world.premiseById.get('p3').fact],
          retract: [],
          derive: [],
          deriveOutcomes: [],
          asserts: ['heir', 'marin'],
        },
      },
    ],
  };

  const dag = buildLearnerDagFromResult(world, result);
  assert.equal(dag.schema, 'machinespirits.derivation.learner-dag.v1');
  assert.equal(dag.source, 'transcript_reconstruction');
  assert.equal(dag.assessment.bestPathCoverage, 1);
  assert.deepEqual(dag.assessment.completePathIds, ['path_1']);
  assert.equal(dag.assessment.firstCompletePathTurn, 8);
  assert.equal(dag.assessment.assertedSecret, true);
  assert.equal(dag.assessment.bottleneck, 'grounded_asserted_secret');
  assert.deepEqual(dag.assessment.missingPremises, []);
});

test('buildLearnerDag reports incomplete learner graphs as partial path coverage', () => {
  const world = smokeWorld();
  const p1 = world.premiseById.get('p1').fact;
  const p2 = world.premiseById.get('p2').fact;
  const dag = buildLearnerDag(
    [
      buildLearnerDagSnapshot(world, {
        turn: 5,
        boardFacts: [p1, p2],
        validFacts: [p1, p2],
        ledger: [
          { turn: 2, premiseId: 'p1', via: 'director' },
          { turn: 5, premiseId: 'p2', via: 'tutor' },
        ],
      }),
    ],
    world,
  );

  assert.equal(dag.assessment.bestPathCoverage, 0.667);
  assert.deepEqual(dag.assessment.missingOnBestPath, ['p3']);
  assert.deepEqual(dag.assessment.missingPremises, [
    { premiseId: 'p3', bucket: 'unreleased', releaseTurn: 8, releaseVia: 'tutor' },
  ]);
  assert.equal(dag.assessment.bottleneck, 'release_or_pacing_gap');
  assert.equal(dag.assessment.finalSecretEntailed, false);
});
