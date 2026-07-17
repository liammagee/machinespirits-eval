import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validMovesFor,
  sampleTurnPlan,
  agenciesForArchitecture,
  sampleDramaSpec,
} from '../services/ontology/turnPlanSampler.js';
import { validateTurnPlan } from '../services/ontology/reasoningOntology.js';

// Stage 1 of the generative arc: the sampler walks the SAME ontology the critic scores.
// The load-bearing test is the generate⊨score ROUND-TRIP — every sampled plan must pass
// validateTurnPlan with zero conflicts (valid by construction).

test('validMovesFor walks the ontology: tutor+peripeteia keeps serving moves, drops contra / off-target / wrong-role', async () => {
  const pool = await validMovesFor('tutor', ['peripeteia']);
  assert.ok(pool.includes('route_change')); // aimsAtForm Peripeteia, TutorRole
  assert.ok(pool.includes('stock_take'));
  assert.ok(!pool.includes('hold')); // contraindicatesForm Peripeteia
  assert.ok(!pool.includes('action_gate')); // aimsAtForm Anagnorisis, not Peripeteia
  assert.ok(!pool.includes('perform_device')); // LearnerRole, not Tutor
});

test('validMovesFor tutor+catharsis surfaces a catharsis-serving move', async () => {
  const pool = await validMovesFor('tutor', ['catharsis']);
  assert.ok(pool.includes('register_shift')); // aimsAtForm Catharsis
});

test('generate⊨score round-trip: 12 sampled plans all pass validateTurnPlan with zero conflicts', async () => {
  const targets = ['peripeteia'];
  const sets = new Set();
  for (let i = 0; i < 12; i++) {
    const entry = await sampleTurnPlan(targets, 'tutor', { seed: `s${i}` });
    assert.ok(entry.moves.length >= 1, 'non-empty move-set');
    const v = await validateTurnPlan([entry], targets);
    assert.equal(v.ok, true, `seed s${i} should round-trip clean; conflicts: ${JSON.stringify(v.conflicts)}`);
    sets.add(entry.moves.join('+'));
  }
  assert.ok(sets.size >= 3, `diversity floor: expected >=3 distinct move-sets, got ${sets.size}`);
});

test('sampling is deterministic from the seed', async () => {
  const a = await sampleTurnPlan(['peripeteia'], 'tutor', { seed: 'fixed' });
  const b = await sampleTurnPlan(['peripeteia'], 'tutor', { seed: 'fixed' });
  assert.deepEqual(a, b);
});

test('a learner+anagnorisis plan round-trips and uses only learner anagnorisis moves', async () => {
  const entry = await sampleTurnPlan(['anagnorisis'], 'learner', { seed: 'L' });
  const v = await validateTurnPlan([entry], ['anagnorisis']);
  assert.equal(v.ok, true);
  assert.ok(entry.moves.every((m) => ['perform_device', 'genuine_anagnorisis', 'revoice'].includes(m)));
});

test('director moves are now form-typed: cue/pressure -> Peripeteia, interruption -> SurpriseInevitability, and a director plan round-trips', async () => {
  const peri = await validMovesFor('director', ['peripeteia']);
  assert.ok(peri.includes('inject_revisit_cue'));
  assert.ok(peri.includes('inject_reversal_pressure'));
  assert.ok(!peri.includes('scene_interruption')); // aimsAtForm SurpriseInevitability, not Peripeteia
  const surprise = await validMovesFor('director', ['surprise_inevitability']);
  assert.ok(surprise.includes('scene_interruption'));
  const entry = await sampleTurnPlan(['peripeteia'], 'director', { seed: 'D' });
  assert.ok(entry.moves.length >= 1);
  assert.equal((await validateTurnPlan([entry], ['peripeteia'])).ok, true);
});

test('audience is first-order but non-enacted: it cannot receive or validate a turn-plan move', async () => {
  await assert.rejects(
    () => validMovesFor('audience', ['peripeteia']),
    /Audience is a non-enacted position and cannot perform moves/u,
  );
  await assert.rejects(
    () => sampleTurnPlan(['peripeteia'], 'audience', { seed: 'A' }),
    /Audience is a non-enacted position and cannot perform moves/u,
  );

  const validation = await validateTurnPlan(
    [{ at: { turn: 3 }, role: 'audience', target: 'peripeteia', moves: ['route_change'] }],
    ['peripeteia'],
  );
  assert.equal(validation.ok, false);
  assert.equal(validation.errors[0].code, 'unsupported_role');
});

// ── Stage 2: alter-ego + context conditioning ──────────────────────────────────────────────

test('agenciesForArchitecture maps the cast architecture to the interior agencies present', () => {
  assert.deepEqual(agenciesForArchitecture('ego_only'), ['ego']);
  assert.deepEqual(agenciesForArchitecture('ego_superego'), ['ego', 'superego']);
  assert.deepEqual(agenciesForArchitecture('id_director'), ['ego', 'superego', 'id']);
  assert.deepEqual(agenciesForArchitecture('???'), ['ego', 'superego', 'id']); // unknown -> all present
});

test('alter-ego conditioning: an ego_only tutor cannot route_change (no superego mechanism-critic), an ego_superego tutor can', async () => {
  const egoOnly = await validMovesFor('tutor', ['peripeteia'], { agencies: agenciesForArchitecture('ego_only') });
  const egoSuper = await validMovesFor('tutor', ['peripeteia'], { agencies: agenciesForArchitecture('ego_superego') });
  assert.ok(!egoOnly.includes('route_change')); // requiresAgency Superego, absent
  assert.ok(egoSuper.includes('route_change')); // superego present
  assert.ok(egoOnly.includes('stock_take')); // ego-default move stays available
});

test('alter-ego conditioning applies to the learner too (reframe/perform_device need the superego costume-guard)', async () => {
  const egoOnly = await validMovesFor('learner', ['anagnorisis'], { agencies: agenciesForArchitecture('ego_only') });
  const egoSuper = await validMovesFor('learner', ['anagnorisis'], {
    agencies: agenciesForArchitecture('ego_superego'),
  });
  assert.ok(!egoOnly.includes('perform_device')); // requiresAgency Superego
  assert.ok(egoSuper.includes('perform_device'));
  assert.ok(egoOnly.includes('genuine_anagnorisis')); // ego-default stays
});

test('conditioned plans still round-trip, and the persona prior caps the move count', async () => {
  for (const arch of ['ego_only', 'ego_superego', 'id_director']) {
    const entry = await sampleTurnPlan(['peripeteia'], 'tutor', {
      agencies: agenciesForArchitecture(arch),
      persona: 'struggling_anxious', // count prior: <= 2
      seed: arch,
    });
    assert.ok(entry.moves.length >= 1 && entry.moves.length <= 2, `anxious persona caps count: ${entry.moves.length}`);
    assert.equal((await validateTurnPlan([entry], ['peripeteia'])).ok, true);
  }
});

// ── Stage 3: full drama spec ────────────────────────────────────────────────────────────────

test('sampleDramaSpec emits a well-formed drama/cast/audience/turn_plan whose turn_plan round-trips', async () => {
  const spec = await sampleDramaSpec({ targets: ['peripeteia'], seed: 'spec1', topic: 'logarithms' });
  assert.ok(spec.drama && spec.cast && spec.audience && Array.isArray(spec.turn_plan));
  assert.equal(spec.drama.topic, 'logarithms');
  assert.ok(spec.drama.tutor.architecture && spec.drama.learner.persona);
  assert.equal((await validateTurnPlan(spec.turn_plan, spec.drama.targets)).ok, true);
});

test('the spec is internally coherent: an ego_only tutor cannot get route_change in its turn_plan', async () => {
  const spec = await sampleDramaSpec({ targets: ['peripeteia'], tutorArchitecture: 'ego_only', seed: 'coh' });
  const tutorMoves = (spec.turn_plan.find((t) => t.role === 'tutor') || {}).moves || [];
  assert.ok(!tutorMoves.includes('route_change'));
});

test('sampleDramaSpec is deterministic from the seed', async () => {
  const a = await sampleDramaSpec({ targets: ['peripeteia'], seed: 'fixed' });
  const b = await sampleDramaSpec({ targets: ['peripeteia'], seed: 'fixed' });
  assert.deepEqual(a, b);
});
