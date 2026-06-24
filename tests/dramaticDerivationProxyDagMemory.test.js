import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  buildLearnerProxyDagMemory,
  deriveProxyDagPacingSignal,
  factKey,
  loadWorld,
  makeMockDirector,
  makeMockLearner,
  makeMockTutor,
  PROXY_DAG_PACING_SCHEMA,
  runDrama,
} from '../services/dramaticDerivation/index.js';
import { parseProxyDagABArgs, planLearnerProxyDagAB } from '../scripts/run-learner-proxy-dag-ab.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function smokeWorld() {
  return loadWorld(path.join(ROOT, 'config/drama-derivation/world-000-smoke.yaml'));
}

function surfaceMap(world) {
  return new Map(world.premises.map((premise) => [factKey(premise.fact), premise.surface]));
}

test('learner proxy-DAG memory exposes only learner-visible surface rows', () => {
  const world = smokeWorld();
  const surfaces = surfaceMap(world);
  const p1 = world.premiseById.get('p1').fact;
  const p2 = world.premiseById.get('p2').fact;
  const p3 = world.premiseById.get('p3').fact;
  const grandchild = ['grandchild', 'marin', 'founder'];

  const memory = buildLearnerProxyDagMemory({
    turn: 8,
    questionPattern: world.questionPattern,
    rules: world.rules,
    groundedFacts: [p1, p2, p3],
    voiced: [{ turn: 6, fact: grandchild }],
    hypotheses: [{ turn: 4, text: 'Marin may be the answer, but I need the mark.' }],
    factSurface: (fact) => surfaces.get(factKey(fact)) || fact.join(' '),
  });

  assert.equal(memory.publicOnly, true);
  assert.equal(memory.audit.authoredProofPathsIncluded, false);
  assert.equal(memory.audit.factArraysIncluded, false);
  assert.equal(memory.answerCandidates[0].answer, 'marin');
  assert.ok(memory.voicedDerived.some((row) => row.surface.includes('grandchild marin founder')));
  assert.ok(memory.hypotheses.some((row) => row.text.includes('need the mark')));

  const serialized = JSON.stringify(memory);
  assert.doesNotMatch(serialized, /\bp1\b|\bp2\b|\bp3\b/u);
  assert.doesNotMatch(serialized, /R1_lineage|R2_succession|proofPaths|releaseSchedule/u);
});

test('proxy-DAG pacing recommends evidence release when the learner stalls before unreleased best-path material', () => {
  const signal = deriveProxyDagPacingSignal({
    turn: 6,
    role: 'tutor',
    stallType: 'aporia',
    nextScheduledRelease: { turn: 8, premise: 'p3', via: 'tutor' },
    assessment: {
      status: 'available',
      bottleneck: 'release_or_pacing_gap',
      bestPathId: 'path_1',
      bestPathCoverage: 0.667,
      finalSecretEntailed: false,
      assertedSecret: false,
      assertedMirror: false,
      missingPremiseBuckets: { unreleased: 1 },
      missingPremises: [{ premiseId: 'p3', bucket: 'unreleased', releaseTurn: 8, releaseVia: 'tutor' }],
    },
  });

  assert.equal(signal.schema, PROXY_DAG_PACING_SCHEMA);
  assert.equal(signal.recommendedAction, 'release_evidence');
  assert.equal(signal.advisoryOnly, true);
  assert.equal(signal.missingPremises[0].premiseId, 'p3');
});

test('runDrama supplies opt-in learner memory and tutor/director pacing views', async () => {
  const world = smokeWorld();
  const learnerMemories = [];
  const pacingSignals = [];
  const learner = makeMockLearner();
  const tutor = makeMockTutor(world);

  const result = await runDrama({
    world,
    roles: {
      director: makeMockDirector(world),
      tutor: async (view) => {
        if (view.proxyDagPacing) pacingSignals.push(view.proxyDagPacing);
        return tutor(view);
      },
      learner: async (view) => {
        if (view.proxyDagMemory) learnerMemories.push(view.proxyDagMemory);
        return learner(view);
      },
    },
    options: {
      maxTurns: 3,
      learnerProxyDag: true,
      proxyDagPacing: true,
    },
  });

  assert.ok(learnerMemories.length >= 1);
  assert.ok(learnerMemories.every((memory) => memory.publicOnly));
  assert.ok(pacingSignals.length >= 1);
  assert.equal(pacingSignals[0].schema, PROXY_DAG_PACING_SCHEMA);
  assert.ok(result.proxyDagPacing.length >= pacingSignals.length);
});

test('learner proxy-DAG A/B planner pairs control and treatment with the treatment flags only', () => {
  const opts = parseProxyDagABArgs([
    '--world',
    'w.yaml',
    '--script',
    's.md',
    '--label-prefix',
    'ab1',
    '--include-gated-proxy',
    '--dry-run',
  ]);
  assert.equal(opts.world, 'w.yaml');
  assert.equal(opts.script, 's.md');
  assert.equal(opts.includeGatedProxy, true);
  assert.equal(opts.dryRun, true);

  const plan = planLearnerProxyDagAB({ world: 'w.yaml', script: 's.md', labelPrefix: 'ab1' });
  assert.deepEqual(plan.labels, ['ab1-control', 'ab1-proxy']);
  assert.ok(!plan.commands[0].args.includes('--learner-proxy-dag'));
  assert.ok(!plan.commands[0].args.includes('--proxy-dag-pacing'));
  assert.ok(plan.commands[1].args.includes('--learner-proxy-dag'));
  assert.ok(plan.commands[1].args.includes('--proxy-dag-pacing'));
});

test('learner proxy-DAG A/B planner can add an explicit gated proxy arm', () => {
  const plan = planLearnerProxyDagAB({
    world: 'w.yaml',
    script: 's.md',
    labelPrefix: 'ab1',
    includeGatedProxy: true,
  });

  assert.deepEqual(plan.labels, ['ab1-control', 'ab1-proxy', 'ab1-proxy-gated']);
  assert.equal(plan.commands[2].arm, 'proxy-gated');
  assert.ok(plan.commands[2].args.includes('--learner-proxy-dag'));
  assert.ok(plan.commands[2].args.includes('--proxy-dag-pacing'));
  assert.ok(plan.commands[2].args.includes('--same-turn-assertion-affordance'));
});
