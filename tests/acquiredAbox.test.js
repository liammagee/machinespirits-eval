import assert from 'node:assert/strict';
import test from 'node:test';
import { trajectory, checkSnapshot, GROUNDED, HYPOTHESIZED } from '../services/ontology/acquiredAbox.js';

// A tiny fixture drama: the tutor's evolving model of one learner on the recognition
// axis (authority-to-defer-to ↔ thinking-partner).
//   T1  the tutor OBSERVES deference (grounded)
//   T2  the tutor optimistically HYPOTHESISES partnership — the guess outruns the
//       evidence (a misrecognition: grounded says defer, hypothesis says partner)
//   T3  the tutor re-observes deference AND revises the hypothesis back to defer (repair)
//   T4  the learner genuinely becomes a partner — observed (a developmental transition,
//       NOT an inconsistency)
const FIXTURE = [
  {
    role: 'tutor',
    subject: 'learner',
    dimension: 'perceived_role',
    type: 'AuthorityToDeferTo',
    turn: 1,
    tier: GROUNDED,
  },
  {
    role: 'tutor',
    subject: 'learner',
    dimension: 'perceived_role',
    type: 'ThinkingPartner',
    turn: 2,
    tier: HYPOTHESIZED,
  },
  {
    role: 'tutor',
    subject: 'learner',
    dimension: 'perceived_role',
    type: 'AuthorityToDeferTo',
    turn: 3,
    tier: GROUNDED,
  },
  {
    role: 'tutor',
    subject: 'learner',
    dimension: 'perceived_role',
    type: 'AuthorityToDeferTo',
    turn: 3,
    tier: HYPOTHESIZED,
  },
  { role: 'tutor', subject: 'learner', dimension: 'perceived_role', type: 'ThinkingPartner', turn: 4, tier: GROUNDED },
  {
    role: 'tutor',
    subject: 'learner',
    dimension: 'perceived_role',
    type: 'ThinkingPartner',
    turn: 4,
    tier: HYPOTHESIZED,
  },
];

test('misrecognition-over-turns: the hypothesis outruns observation, then is repaired', async () => {
  const tr = await trajectory(FIXTURE, { role: 'tutor', maxTurn: 4 });

  // Observation (grounded) is never self-contradictory.
  assert.equal(tr.groundedAlwaysConsistent, true);
  // The tutor's hypothesis contradicts observation at turn 2 ...
  assert.equal(tr.firstMisrecognition, 2);
  // ... and is repaired at turn 3.
  assert.deepEqual(tr.repairs, [3]);
  // Per-turn full-consistency trace: ok, BROKEN, ok, ok.
  assert.deepEqual(
    tr.snapshots.map((s) => s.full),
    [true, false, true, true],
  );
});

test('nonmonotonic revision is development, not inconsistency (defer→partner across turns)', async () => {
  const tr = await trajectory(FIXTURE, { role: 'tutor', maxTurn: 4 });

  // The grounded snapshot stays consistent at every turn even though its value moves.
  assert.deepEqual(
    tr.snapshots.map((s) => s.grounded),
    [true, true, true, true],
  );
  // The move AuthorityToDeferTo → ThinkingPartner is surfaced as a transition, not a clash.
  const t4 = tr.transitions.find((x) => x.turn === 4 && x.dimension === 'perceived_role');
  assert.ok(t4, 'expected a perceived_role transition at turn 4');
  assert.equal(t4.from, 'AuthorityToDeferTo');
  assert.equal(t4.to, 'ThinkingPartner');
});

test('a within-turn grounded contradiction is a real error, not a hypothesis clash', async () => {
  // If observation itself asserts both poles at one turn, the grounded snapshot breaks.
  const bad = [
    {
      role: 'tutor',
      subject: 'learner',
      dimension: 'perceived_role',
      type: 'AuthorityToDeferTo',
      turn: 1,
      tier: GROUNDED,
    },
    {
      role: 'tutor',
      subject: 'learner',
      dimension: 'perceived_role',
      type: 'ThinkingPartner',
      turn: 1,
      tier: GROUNDED,
    },
  ];
  const snap = await checkSnapshot(bad, { role: 'tutor', turn: 1 });
  assert.equal(snap.grounded, false);
});
