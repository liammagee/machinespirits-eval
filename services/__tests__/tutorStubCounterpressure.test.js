import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadWorld } from '../dramaticDerivation/world.js';
import { resolveTutorStubPublicCounterpressure } from '../tutorStubCounterpressure.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function marrick() {
  return loadWorld(path.join(ROOT, 'config', 'drama-derivation', 'world-005-marrick.yaml'));
}

test('resolves an authored counterpressure relation only from exact public and due premises', () => {
  const world = marrick();
  const pair = resolveTutorStubPublicCounterpressure({
    world,
    publicEvidence: ['m_caster', 'p_alloy', 'p_crucible'],
    dueEvidence: ['p_caster'],
  });

  assert.equal(pair.pressureTarget, world.premiseById.get('m_caster').surface);
  assert.equal(pair.contraryEvidence, world.premiseById.get('p_caster').surface);
  assert.deepEqual(pair.provenance, {
    source: 'authored_release_counterpressure',
    duePremise: 'p_caster',
    pressurePremise: 'm_caster',
    contraryPremise: 'p_caster',
  });
});

test('fails closed when the authored pressure premise is not already public', () => {
  const pair = resolveTutorStubPublicCounterpressure({
    world: marrick(),
    publicEvidence: ['p_alloy', 'p_crucible'],
    dueEvidence: ['p_caster'],
  });

  assert.equal(pair, null);
});

test('does not infer counterpressure from adjacent public and due evidence without authored metadata', () => {
  const world = marrick();
  const pair = resolveTutorStubPublicCounterpressure({
    world,
    publicEvidence: ['m_caster', 'p_alloy'],
    dueEvidence: ['p_crucible'],
  });

  assert.equal(pair, null);
});
