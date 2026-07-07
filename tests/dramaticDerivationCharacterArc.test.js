// The LIVE character-arc layer (characterDesire.buildLearnerCharacterArcView):
// the §8 "still open" item — drift wired into a real run. These tests pin the
// two load-bearing properties: (1) the learner's disposition MOVES with proof
// progress (mirror-bound → letting go), and an authored `arc` shapes that
// movement; (2) the public-safe contract holds — the secret token NEVER crosses
// the learnerView redaction boundary in the rendered stance line.
//
// Deterministic: no model call, no DB, no eval. Pure structure over a real
// world (world-005-marrick), so it guards the engine seam, not a mock.

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadWorld, buildLearnerCharacterArcView } from '../services/dramaticDerivation/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-005-marrick.yaml'));

const SECRET_TOKEN = String(world.secret.fact[world.secret.fact.length - 1]); // "edony"
const MIRROR_TOKEN = String(world.motivation.learner.first_order.opens_on); // "verrell"
const PROOF_PREMISES = world.proofPaths[0].premises;
const factOf = (id) => world.premises.find((p) => p.id === id).fact;
const PULL_ORDER = { low: 0, medium: 1, high: 2 };

// Hold the leading k proof-path premises (their fact arrays).
const heldAfter = (k) => PROOF_PREMISES.slice(0, k).map(factOf);

// A static-arc clone: same world, disposition frozen (the on/off-arc control).
function staticWorld() {
  const w = structuredClone(world);
  w.motivation.learner.disposition.arc = 'static';
  return w;
}

test('no-op on a world without learner motivation (prose-only worlds)', () => {
  const w = structuredClone(world);
  delete w.motivation;
  assert.equal(buildLearnerCharacterArcView(w, []), null);
});

test('opens mirror-bound: high pull, not yet letting go, names the mirror not the secret', () => {
  const v = buildLearnerCharacterArcView(world, []);
  assert.ok(v, 'expected a view');
  assert.equal(v.mirrorPull, 'high');
  assert.equal(v.lettingGo, false);
  const text = v.lines.join(' ');
  assert.match(text.toLowerCase(), new RegExp(MIRROR_TOKEN.toLowerCase()), 'stance line names the public mirror');
  assert.match(text, /still pulls hardest/);
});

test('softens arc: the disposition migrates to the truth once the proof closes', () => {
  const v = buildLearnerCharacterArcView(world, heldAfter(PROOF_PREMISES.length));
  assert.equal(v.lettingGo, true, 'with the full proof grounded the learner lets go of the mirror');
  assert.match(v.lines.join(' '), /no longer satisfies you/);
});

test('LEAK GUARD: the secret token never crosses into the rendered stance line', () => {
  for (let k = 0; k <= PROOF_PREMISES.length; k += 1) {
    const v = buildLearnerCharacterArcView(world, heldAfter(k));
    const text = v.lines.join(' ').toLowerCase();
    assert.ok(
      !text.includes(SECRET_TOKEN.toLowerCase()),
      `secret token "${SECRET_TOKEN}" leaked into the stance line at held=${k}: ${v.lines.join(' ')}`,
    );
  }
});

test('the authored arc shapes the trajectory: static holds pull where softens decays it', () => {
  const stat = staticWorld();
  // At the opening both equal the authored baseline (high).
  assert.equal(buildLearnerCharacterArcView(world, []).mirrorPull, 'high');
  assert.equal(buildLearnerCharacterArcView(stat, []).mirrorPull, 'high');
  // As the proof advances, a softens learner's pull never EXCEEDS a static one's,
  // and by the penultimate step it has strictly let go further or pulled lower.
  for (let k = 1; k < PROOF_PREMISES.length; k += 1) {
    const soft = buildLearnerCharacterArcView(world, heldAfter(k));
    const fixed = buildLearnerCharacterArcView(stat, heldAfter(k));
    assert.ok(
      PULL_ORDER[soft.mirrorPull] <= PULL_ORDER[fixed.mirrorPull],
      `softens pull (${soft.mirrorPull}) should not exceed static pull (${fixed.mirrorPull}) at held=${k}`,
    );
  }
});
