import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditTutorStubPublicCausalRelationSupport,
  compileTutorStubWritableEntryCausalContract,
} from '../services/tutorStubRequestedEntryCausality.js';

test('compiles the inactive-candidate relation into a production claim, not a prevention claim', () => {
  const surfaces = [
    'The depot chargers stood dark throughout the stocktake.',
    'Tallow Street still browned out at 18:40.',
  ];

  const contract = compileTutorStubWritableEntryCausalContract({ surfaces });

  assert.equal(contract.public_relation, 'inactive_candidate_with_persisting_outcome');
  assert.equal(contract.licensed_conclusion, 'rules_out_candidate_production');
  assert.equal(contract.forbidden_relation, 'candidate_failed_to_prevent_outcome');
  assert.match(contract.instruction, /inactive while the outcome still occurred/iu);
  assert.match(contract.instruction, /rules out candidate causation/iu);
  assert.match(contract.instruction, /never say[^.]*failed to prevent/iu);
});

test('the causal contract is world-general rather than tied to Tallow vocabulary', () => {
  const contract = compileTutorStubWritableEntryCausalContract({
    surfaces: [
      'The cellar pumps were idle for the whole inspection.',
      'The basement still flooded before dawn.',
    ],
  });

  assert.equal(contract?.public_relation, 'inactive_candidate_with_persisting_outcome');
  assert.doesNotMatch(contract.instruction, /charger|brownout|depot|Tallow/iu);
});

test('the shared audit licenses negative production but rejects prevention inversion', () => {
  const surfaces = [
    'The cellar pumps were idle for the whole inspection.',
    'The basement still flooded before dawn.',
  ];
  const production = auditTutorStubPublicCausalRelationSupport({
    surfaces,
    quotedLine: 'The idle pumps did not cause the basement flood.',
  });
  const prevention = auditTutorStubPublicCausalRelationSupport({
    surfaces,
    quotedLine: 'The idle pumps did not prevent the basement flood.',
  });

  assert.equal(production.family, 'production');
  assert.equal(production.supported, true);
  assert.deepEqual(production.constructions, [
    'inactive_candidate_with_persisting_outcome_rules_out_production',
  ]);
  assert.equal(prevention.family, 'prevention');
  assert.equal(prevention.supported, false);
});

test('does not invent a causal contract without both inactivity and a persisting outcome', () => {
  assert.equal(
    compileTutorStubWritableEntryCausalContract({
      surfaces: ['The cellar pumps were inspected before dawn.'],
    }),
    null,
  );
  assert.equal(
    compileTutorStubWritableEntryCausalContract({
      surfaces: ['The cellar pumps were idle for the whole inspection.'],
    }),
    null,
  );
});
