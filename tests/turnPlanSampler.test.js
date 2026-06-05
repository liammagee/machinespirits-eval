import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validMovesFor, sampleTurnPlan } from '../services/ontology/turnPlanSampler.js';
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
  assert.ok(entry.moves.every((m) => ['perform_device', 'genuine_anagnorisis'].includes(m)));
});

test('director moves have no aimsAtForm in the ontology — pool is empty (documents the gap)', async () => {
  // A real limitation to surface, not paper over: director moves (inject_revisit_cue, …) are
  // not form-typed, so they cannot be sampled by form. Form-typing them is a follow-up.
  assert.deepEqual(await validMovesFor('director', ['peripeteia']), []);
});
