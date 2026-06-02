import assert from 'node:assert/strict';
import test from 'node:test';
import { GROUNDED } from '../services/ontology/acquiredAbox.js';
import {
  specToDefinedABox,
  observationsToAcquired,
  anagnorisisOverlap,
  classForTag,
} from '../services/ontology/definedAbox.js';

const SCENARIO = {
  id: 'deductive_affirming_consequent_v1',
  hidden: {
    learnerMisconception: 'affirming_consequent',
    learnerPerceptionOfTutor: 'authority_to_defer_to',
    targetRepair: 'learner distinguishes sufficient from necessary conditions',
  },
};

test('specToDefinedABox gives the director ground truth and a goal the tutor lacks', () => {
  const def = specToDefinedABox(SCENARIO);

  assert.equal(def.misconception, 'AffirmingConsequent');
  assert.equal(def.perception, 'AuthorityToDeferTo');
  assert.equal(def.targetKC, 'DistinguishNecessarySufficient');

  // The director holds the learner's true state (incl. the missing repair KC) ...
  const director = def.records.filter((r) => r.role === 'director');
  assert.ok(director.some((r) => r.type === 'AffirmingConsequent'));
  assert.ok(director.some((r) => r.type === 'AuthorityToDeferTo'));
  assert.ok(director.some((r) => r.type === 'KCMissing'));
  // ... the learner starts in its hamartia ...
  assert.ok(def.records.some((r) => r.role === 'learner' && r.type === 'AffirmingConsequent'));
  // ... and NO tutor record carries a hidden fact (the tutor must acquire them).
  assert.equal(def.records.filter((r) => r.role === 'tutor').length, 0);
  // The goal S = own the conclusion + master the repair KC.
  assert.equal(def.goal.length, 2);
  assert.ok(def.goal.some((g) => g.type === 'ConclusionOwned'));
  assert.ok(def.goal.some((g) => g.type === 'KCMastered'));
});

test('anagnorisis-as-overlap rises from 0 to 1 as the learner reaches the goal', () => {
  const { goal, targetKC } = specToDefinedABox(SCENARIO);
  const learner = [
    {
      role: 'learner',
      subject: 'learner',
      dimension: 'claim_ownership',
      type: 'ClaimOwnershipWeak',
      turn: 1,
      tier: GROUNDED,
    },
    {
      role: 'learner',
      subject: 'learner',
      dimension: 'claim_ownership',
      type: 'ConclusionOwned',
      turn: 3,
      tier: GROUNDED,
    },
    {
      role: 'learner',
      subject: `learner__${targetKC}`,
      dimension: 'kc_status',
      type: 'KCMastered',
      turn: 3,
      tier: GROUNDED,
    },
  ];

  assert.equal(anagnorisisOverlap(learner, goal, 1), 0);
  assert.equal(anagnorisisOverlap(learner, goal, 3), 1);
});

test('observationsToAcquired maps per-turn tags to a role-of-subject model', () => {
  const recs = observationsToAcquired({
    observations: [
      { id: 'o', quote: 'a benchmark drop proves the change', tags: ['affirming_consequent', 'authority_to_defer_to'] },
    ],
    role: 'tutor',
    subject: 'learner',
    turn: 1,
  });

  assert.equal(recs.length, 2);
  assert.deepEqual(recs.map((r) => r.type).sort(), ['AffirmingConsequent', 'AuthorityToDeferTo']);
  assert.ok(recs.every((r) => r.role === 'tutor' && r.subject === 'learner' && r.tier === GROUNDED));
  assert.equal(classForTag('missing_warrant'), 'MissingWarrant');
});
