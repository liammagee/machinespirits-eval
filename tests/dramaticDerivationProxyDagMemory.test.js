import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { DataFactory, Store } from 'n3';

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
  buildTutorLearnerDagModel,
  TUTOR_LEARNER_DAG_MODEL_SCHEMA,
} from '../services/dramaticDerivation/index.js';
import {
  auditPublicProofDagProjection,
  PROOF_DAG_NAMESPACES,
} from '../services/dramaticDerivation/semanticWebProofDag.js';
import {
  loadProofDagShaclShapes,
  validateProofDagDataset,
} from '../services/dramaticDerivation/semanticWebValidation.js';
import { buildNocturneProofDagSemanticWebBundle } from '../scripts/export-proof-dag-semantic-web.js';
import { parseProxyDagABArgs, planLearnerProxyDagAB } from '../scripts/run-learner-proxy-dag-ab.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

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

test('tutor learner-DAG model redacts authored proof identifiers while preserving learner record', () => {
  const world = smokeWorld();
  const surfaces = surfaceMap(world);
  const p1 = world.premiseById.get('p1').fact;
  const p2 = world.premiseById.get('p2').fact;
  const p3 = world.premiseById.get('p3').fact;
  const proxyDagMemory = buildLearnerProxyDagMemory({
    turn: 8,
    questionPattern: world.questionPattern,
    rules: world.rules,
    groundedFacts: [p1, p2],
    voiced: [],
    hypotheses: [{ turn: 7, text: 'Marin may be the answer, but I need the mark.' }],
    factSurface: (fact) => surfaces.get(factKey(fact)) || fact.join(' '),
  });
  const model = buildTutorLearnerDagModel({
    turn: 8,
    role: 'tutor',
    proxyDagMemory,
    assessment: {
      status: 'available',
      bestPathId: 'path_1',
      bestPathCoverage: 0.667,
      finalSecretEntailed: false,
      assertedSecret: false,
      assertedMirror: false,
      unsupportedAssertionCount: 0,
      voicedDerivedCount: 0,
      hypothesisCount: 1,
      bottleneck: 'release_or_pacing_gap',
      missingPremises: [{ premiseId: 'p3', bucket: 'unreleased', releaseTurn: 8, releaseVia: 'tutor' }],
      missingPremiseBuckets: { unreleased: 1 },
    },
  });

  assert.equal(model.schema, TUTOR_LEARNER_DAG_MODEL_SCHEMA);
  assert.equal(model.publicOnly, true);
  assert.equal(model.advisoryOnly, true);
  assert.equal(model.audit.authoredProofPathsIncluded, false);
  assert.equal(model.audit.missingPremiseIdsIncluded, false);
  assert.equal(model.assessment.missingPremiseCount, 1);
  assert.deepEqual(model.assessment.missingPremiseBuckets, { unreleased: 1 });
  assert.ok(model.learnerRecord.grounded.some((row) => row.surface === surfaces.get(factKey(p1))));
  assert.ok(model.learnerRecord.hypotheses.some((row) => row.text.includes('need the mark')));
  assert.equal(model.learnerRecord.answerCandidates.length, 0);

  const serialized = JSON.stringify(model);
  assert.doesNotMatch(serialized, /\bp1\b|\bp2\b|\bp3\b|path_1|R1_lineage|R2_succession/u);
  assert.doesNotMatch(serialized, new RegExp(escapeRegExp(surfaces.get(factKey(p3))), 'u'));
});

test('Nocturne proof-DAG semantic-web artifacts conform while preserving authority boundaries', async () => {
  const worldPath = path.join(ROOT, 'config/drama-derivation/world-001-nocturne.yaml');
  const bundle = await buildNocturneProofDagSemanticWebBundle(worldPath);

  assert.equal(bundle.validation.conforms, true);
  assert.deepEqual(
    Object.fromEntries(Object.entries(bundle.validation.graphs).map(([name, graph]) => [name, graph.conforms])),
    { authored: true, learner: true, tutor: true },
  );
  assert.match(bundle.files['authored.ttl'], /prov:generated/);
  assert.match(bundle.files['authored.ttl'], /"p_hand"/);
  assert.match(bundle.files['learner-proxy.jsonld'], /"@context"/);
  assert.match(bundle.files['tutor-model.jsonld'], /ms:bestPathCoverage/);
  assert.doesNotMatch(bundle.files['learner-proxy.jsonld'], /p_hand|R4_attribution|path_1/);
  assert.doesNotMatch(bundle.files['tutor-model.jsonld'], /p_hand|R4_attribution|path_1/);
  assert.equal(bundle.projections.learnerProxyDag.metrics.groundedCount, 6);
  assert.equal(bundle.projections.learnerProxyDag.metrics.voicedDerivedCount, 3);
  assert.equal(bundle.projections.tutorLearnerDagModel.assessment.bestPathCoverage, 0.857);
  assert.equal(bundle.projections.tutorLearnerDagModel.assessment.missingPremiseCount, 1);
});

test('tutor-stub exposes and executes public proof-DAG fixture inspection without a model call', () => {
  const help = spawnSync(process.execPath, ['scripts/tutor-stub.js', '--help'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /\/proof\s+check the Nocturne Lean certificate/u);
  assert.match(help.stdout, /\/proof inspect \[authored\|learner\|tutor\]/u);

  const result = spawnSync(
    process.execPath,
    [
      'scripts/tutor-stub.js',
      '--no-opening',
      '--no-closeout-report',
      '--no-interim-animation',
      '--no-stream',
      '--no-trace',
      '--no-remember-settings',
      '--world',
      'world_005_marrick',
      '--dag',
      '--tutor-learner-dag',
    ],
    {
      cwd: ROOT,
      encoding: 'utf8',
      input: '/proof inspect learner\n/quit\n',
      env: {
        ...process.env,
        NO_COLOR: '1',
        TUTOR_STUB_OPENING_REALIZER: 'deterministic',
        TUTOR_STUB_SUMMARY_OPEN: '0',
      },
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /proof DAG > inspect · deterministic Nocturne fixture/u);
  assert.match(result.stdout, /semantic web: PASS/u);
  assert.match(result.stdout, /learner > public-only proxy graph at fixture turn 26/u);
  assert.match(result.stdout, /93 quads · SHACL conforms · 6 grounded · 3 voiced/u);
  assert.match(result.stdout, /Use \/analysis technical for the live session/u);
});

test('SHACL and source audits reject authored identifiers in learner and tutor projections', async () => {
  const worldPath = path.join(ROOT, 'config/drama-derivation/world-001-nocturne.yaml');
  const bundle = await buildNocturneProofDagSemanticWebBundle(worldPath);
  const publicShapes = loadProofDagShaclShapes(
    path.join(ROOT, 'tools/proof-dag-semantic-web/shapes/public-projections.ttl'),
  );
  const { literal, namedNode, quad } = DataFactory;
  const forbiddenPredicate = namedNode(`${PROOF_DAG_NAMESPACES.ms}premiseId`);

  for (const artifact of [bundle.artifacts.learner, bundle.artifacts.tutor]) {
    const mutated = new Store(artifact.store.getQuads(null, null, null, null));
    mutated.addQuad(quad(namedNode(artifact.root), forbiddenPredicate, literal('p_hand')));
    const report = await validateProofDagDataset(mutated, publicShapes);
    assert.equal(report.conforms, false);
    assert.ok(
      report.results.some((row) => String(row.sourceConstraintComponent).endsWith('MaxCountConstraintComponent')),
    );
  }

  const leaked = structuredClone(bundle.projections.learnerProxyDag);
  leaked.hypotheses.push({ turn: 26, text: 'Use p_hand next.' });
  const audit = auditPublicProofDagProjection(bundle.world, leaked);
  assert.equal(audit.ok, false);
  assert.ok(audit.violations.some((row) => row.includes('p_hand')));
});

test('runDrama supplies opt-in learner memory and tutor/director pacing views', async () => {
  const world = smokeWorld();
  const learnerMemories = [];
  const pacingSignals = [];
  const tutorModels = [];
  const learner = makeMockLearner();
  const tutor = makeMockTutor(world);

  const result = await runDrama({
    world,
    roles: {
      director: makeMockDirector(world),
      tutor: async (view) => {
        if (view.proxyDagPacing) pacingSignals.push(view.proxyDagPacing);
        if (view.tutorLearnerDagModel) tutorModels.push(view.tutorLearnerDagModel);
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
      tutorLearnerDag: true,
    },
  });

  assert.ok(learnerMemories.length >= 1);
  assert.ok(learnerMemories.every((memory) => memory.publicOnly));
  assert.ok(pacingSignals.length >= 1);
  assert.equal(pacingSignals[0].schema, PROXY_DAG_PACING_SCHEMA);
  assert.ok(tutorModels.length >= 1);
  assert.ok(tutorModels.every((model) => model.schema === TUTOR_LEARNER_DAG_MODEL_SCHEMA));
  assert.ok(tutorModels.every((model) => model.audit.missingPremiseIdsIncluded === false));
  assert.ok(result.proxyDagPacing.length >= pacingSignals.length);
  assert.ok(result.tutorLearnerDagModel.length >= tutorModels.length);
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
