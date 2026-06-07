import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateTimingArms, multisetHash } from '../services/ontology/timingPairGenerator.js';

// A canonical BRIDGED base: obstruction(1) < pivotalMove(2, tutor) < reframe(4).
const BASE = {
  turns: [
    { role: 'learner', text: 'Every arrow points the way the cart moves, so the net force is forward.' },
    { role: 'tutor', text: "Here's a cart still moving right but slowing down. Watch the speed drop each frame." },
    {
      role: 'tutor',
      text: "Switch the test: instead of 'which way is it moving', ask 'which way is the velocity CHANGING'.",
    },
    { role: 'learner', text: "It's moving right, but the change is... toward the left." },
    {
      role: 'learner',
      text: 'So the net force is leftward, opposite the motion — the arrow follows the change in velocity.',
    },
  ],
  tags: { obstruction: 1, pivotalMove: 2, reframe: 4 },
};
const NEUTRAL = "Good — you're thinking carefully about this. Keep watching the cart and tell me what you notice.";

const sortedTexts = (arm) =>
  arm.turns
    .map((t) => `${t.role}|${t.text}`)
    .sort()
    .join('§');

test('within a move-type, the two timing arms are PURE REORDERS (identical multiset)', () => {
  const { arms, invariants } = generateTimingArms({ ...BASE, neutralMove: NEUTRAL });
  assert.equal(invariants.pivotalTimingPreservesContent, true);
  assert.equal(invariants.neutralTimingPreservesContent, true);
  assert.equal(arms.bridged.utteranceMultisetHash, arms.displacedPivotal.utteranceMultisetHash);
  assert.equal(arms.decoyBridged.utteranceMultisetHash, arms.displacedNeutral.utteranceMultisetHash);
  // and they really are permutations (same sorted utterance set), just different order
  assert.equal(sortedTexts(arms.bridged), sortedTexts(arms.displacedPivotal));
  assert.notEqual(
    arms.bridged.turns.map((t) => t.text).join('|'),
    arms.displacedPivotal.turns.map((t) => t.text).join('|'),
    'the order must differ even though the multiset is identical',
  );
});

test('across move-types, exactly ONE turn differs (the tutor move text)', () => {
  const { arms, invariants } = generateTimingArms({ ...BASE, neutralMove: NEUTRAL });
  assert.equal(invariants.moveTypeDiffersByOneTurn, true);
  assert.notEqual(arms.bridged.utteranceMultisetHash, arms.decoyBridged.utteranceMultisetHash);
  const diffs = arms.bridged.turns.filter((t, i) => t.text !== arms.decoyBridged.turns[i].text);
  assert.equal(diffs.length, 1);
  assert.equal(arms.decoyBridged.turns[2].text, NEUTRAL);
});

test('symbolic prediction: ONLY the bridged arm is induced (the baseline the panel is read against)', () => {
  const { arms, invariants } = generateTimingArms({ ...BASE, neutralMove: NEUTRAL });
  assert.equal(invariants.onlyBridgedIsInduced, true);
  assert.equal(arms.bridged.predictedOrigin, 'PeripeteiaInducedRecognition');
  for (const key of ['displacedPivotal', 'decoyBridged', 'displacedNeutral']) {
    assert.equal(arms[key].predictedOrigin, 'OrganicRecognition');
    assert.ok(arms[key].chainBrokenBy, `${key} should record why the chain is broken`);
  }
});

test('DISPLACEMENT (default): coherence-preserving — move before reframe (cause→effect) intact, necessitation broken', () => {
  const { arms } = generateTimingArms({ ...BASE, neutralMove: NEUTRAL }); // default decoupling
  // adjacent arms: full order both ways
  for (const k of ['bridged', 'decoyBridged']) {
    assert.equal(arms[k].moveBeforeReframe, true);
    assert.equal(arms[k].moveAfterObstruction, true);
    assert.equal(arms[k].coherenceRisk, 'none');
  }
  // displaced arms: move still precedes the reframe (coherent) but no longer follows the obstruction
  for (const k of ['displacedPivotal', 'displacedNeutral']) {
    assert.equal(arms[k].moveBeforeReframe, true, 'displacement keeps the device before its use (coherent)');
    assert.equal(arms[k].moveAfterObstruction, false, 'displacement breaks necessitation (move precedes obstruction)');
    assert.equal(arms[k].coherenceRisk, 'upstream');
    assert.equal(arms[k].decoupling, 'displacement');
    assert.equal(arms[k].predictedOrigin, 'OrganicRecognition');
  }
});

test('POST-EMPTION (robustness): cause→effect order broken (reframe precedes the move), risk reverse-order', () => {
  const { arms, invariants } = generateTimingArms({ ...BASE, neutralMove: NEUTRAL, decoupling: 'postemption' });
  assert.equal(invariants.pivotalTimingPreservesContent, true); // still a pure reorder
  for (const k of ['displacedPivotal', 'displacedNeutral']) {
    assert.equal(arms[k].moveBeforeReframe, false, 'post-emption puts the reframe before the move');
    assert.equal(arms[k].moveAfterObstruction, true);
    assert.equal(arms[k].coherenceRisk, 'reverse-order');
    assert.equal(arms[k].decoupling, 'postemption');
    assert.equal(arms[k].predictedOrigin, 'OrganicRecognition');
  }
  assert.equal(arms.bridged.moveBeforeReframe, true); // unchanged
});

test('rejects an unknown decoupling mode', () => {
  assert.throws(
    () => generateTimingArms({ ...BASE, neutralMove: NEUTRAL, decoupling: 'sideways' }),
    /decoupling must be/,
  );
});

test('every arm preserves the turn COUNT (reorder/substitute, never add or drop)', () => {
  const { arms } = generateTimingArms({ ...BASE, neutralMove: NEUTRAL });
  for (const a of Object.values(arms)) assert.equal(a.turns.length, BASE.turns.length);
});

test('rejects a non-canonical base, a non-tutor pivot, a missing neutral move, and a tiny transcript', () => {
  assert.throws(
    () =>
      generateTimingArms({
        turns: BASE.turns,
        tags: { obstruction: 1, pivotalMove: 4, reframe: 2 },
        neutralMove: NEUTRAL,
      }),
    /canonically bridged/,
  );
  assert.throws(
    () =>
      generateTimingArms({
        turns: BASE.turns,
        tags: { obstruction: 0, pivotalMove: 3, reframe: 4 },
        neutralMove: NEUTRAL,
      }),
    /must be a tutor turn/,
  );
  assert.throws(() => generateTimingArms({ ...BASE, neutralMove: '   ' }), /matched neutralMove/);
  assert.throws(
    () => generateTimingArms({ turns: BASE.turns.slice(0, 2), tags: BASE.tags, neutralMove: NEUTRAL }),
    />= 3 turns/,
  );
});

test('multisetHash is order-independent and content-sensitive', () => {
  const a = [
    { role: 'tutor', text: 'x' },
    { role: 'learner', text: 'y' },
  ];
  const b = [
    { role: 'learner', text: 'y' },
    { role: 'tutor', text: 'x' },
  ];
  const c = [
    { role: 'tutor', text: 'x' },
    { role: 'learner', text: 'z' },
  ];
  assert.equal(multisetHash(a), multisetHash(b));
  assert.notEqual(multisetHash(a), multisetHash(c));
});
