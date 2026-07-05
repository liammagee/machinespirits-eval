import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { loadWorld } from '../services/dramaticDerivation/world.js';
import { generateLeanCertificate } from '../services/dramaticDerivation/leanCertificate.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('generateLeanCertificate emits dependency-free theorem certificates for Nocturne proof paths', () => {
  const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-001-nocturne.yaml'));
  const certificate = generateLeanCertificate(world, {
    sourcePath: 'config/drama-derivation/world-001-nocturne.yaml',
  });

  assert.equal(certificate.worldId, 'world_001_nocturne');
  assert.equal(certificate.theoremCount, 4);
  assert.deepEqual(
    certificate.pathSummaries.map((row) => row.pathId),
    ['path_1', 'path_2', 'path_3', 'path_4'],
  );
  assert.match(certificate.lean, /import ProofDag\.Basic/);
  assert.doesNotMatch(certificate.lean, /Mathlib/);
  assert.match(certificate.lean, /theorem authored_positive_proof_path_1/);
  assert.match(certificate.lean, /rule__r4_attribution/);
  assert.match(certificate.lean, /exact h__composed__liane__nocturne/);
});
