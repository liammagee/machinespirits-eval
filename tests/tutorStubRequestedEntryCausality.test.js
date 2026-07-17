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
    surfaces: ['The cellar pumps were idle for the whole inspection.', 'The basement still flooded before dawn.'],
  });

  assert.equal(contract?.public_relation, 'inactive_candidate_with_persisting_outcome');
  assert.doesNotMatch(contract.instruction, /charger|brownout|depot|Tallow/iu);
});

test('the shared audit licenses negative production but rejects prevention inversion', () => {
  const surfaces = ['The cellar pumps were idle for the whole inspection.', 'The basement still flooded before dawn.'];
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
  assert.deepEqual(production.constructions, ['inactive_candidate_with_persisting_outcome_rules_out_production']);
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

test('typed causal roles bind the exact public subject without world-specific vocabulary', () => {
  const surfaces = [
    'The depot chargers stood dark throughout the stocktake.',
    'Tallow Street still browned out at 18:40.',
  ];
  const evidence = [
    {
      surface: surfaces.join(' '),
      causal_relation: {
        kind: 'inactive_candidate_with_persisting_outcome',
        family: 'production',
        subject: 'depot chargers',
        outcome: 'Tallow Street brownout',
      },
    },
  ];
  const contract = compileTutorStubWritableEntryCausalContract({ evidence, surfaces });
  const exact = auditTutorStubPublicCausalRelationSupport({
    surfaces,
    quotedLine: 'The depot chargers did not cause the Tallow Street brownout.',
    causalContract: contract,
  });
  const widened = auditTutorStubPublicCausalRelationSupport({
    surfaces,
    quotedLine: 'The depot did not cause the Tallow Street brownout.',
    causalContract: contract,
  });

  assert.equal(contract.subject, 'depot chargers');
  assert.equal(contract.outcome, 'Tallow Street brownout');
  assert.match(contract.instruction, /exact causal subject/iu);
  assert.equal(exact.supported, true);
  assert.equal(exact.subject_binding.preserved, true);
  assert.equal(widened.supported, false);
  assert.equal(widened.subject_binding.preserved, false);
});

test('typed causal binding preserves subject, outcome, family, and polarity as one tuple', () => {
  const surfaces = [
    'The depot chargers stood dark throughout the stocktake.',
    'Tallow Street still browned out at 18:40.',
  ];
  const causalContract = {
    family: 'production',
    polarity: 'negative',
    subject: 'depot chargers',
    outcome: 'Tallow Street brownout',
  };
  for (const quotedLine of [
    'The depot chargers and every depot machine did not cause the Tallow Street brownout.',
    'The depot chargers did not cause the North Street brownout.',
    'The depot did not cause the Tallow Street brownout.',
    'The depot chargers did not prevent the Tallow Street brownout.',
  ]) {
    const audit = auditTutorStubPublicCausalRelationSupport({
      surfaces,
      quotedLine,
      causalContract,
    });
    assert.equal(audit.supported, false, quotedLine);
    assert.equal(audit.relation_binding.preserved, false, quotedLine);
  }
  const exact = auditTutorStubPublicCausalRelationSupport({
    surfaces,
    quotedLine: 'The depot chargers did not cause the Tallow Street brownout.',
    causalContract,
  });
  assert.equal(exact.supported, true);
  assert.equal(exact.relation_binding.preserved, true);
  assert.equal(exact.relation_binding.candidates[0].subject_preserved, true);
  assert.equal(exact.relation_binding.candidates[0].outcome_preserved, true);
});

test('typed causal extraction is stable across repeated calls', () => {
  const input = {
    surfaces: ['The pumps were idle, yet the basement still flooded.'],
    quotedLine: 'The cellar pumps did not cause the basement flood.',
    causalContract: {
      family: 'production',
      subject: 'cellar pumps',
      outcome: 'basement flood',
    },
  };
  const first = auditTutorStubPublicCausalRelationSupport(input);
  const second = auditTutorStubPublicCausalRelationSupport(input);
  assert.deepEqual(second, first);
  assert.equal(second.supported, true);
});

test('typed causal compilation fails closed on malformed or ambiguous metadata', () => {
  const surface = 'The pumps were idle, yet the basement still flooded.';
  assert.throws(
    () =>
      compileTutorStubWritableEntryCausalContract({
        surfaces: [surface],
        evidence: [
          {
            surface,
            causal_relation: {
              kind: 'inactive_candidate_with_persisting_outcome',
              family: 'prevention',
              subject: 'cellar pumps',
              outcome: 'basement flood',
            },
          },
        ],
      }),
    /incomplete or incompatible/iu,
  );
  assert.throws(
    () =>
      compileTutorStubWritableEntryCausalContract({
        surfaces: [surface],
        evidence: [
          {
            surface,
            causal_relation: {
              kind: 'inactive_candidate_with_persisting_outcome',
              family: 'production',
              subject: 'cellar pumps',
              outcome: 'basement flood',
            },
          },
          {
            surface,
            causal_relation: {
              kind: 'inactive_candidate_with_persisting_outcome',
              family: 'production',
              subject: 'drain pumps',
              outcome: 'basement flood',
            },
          },
        ],
      }),
    /exactly one typed public relation/iu,
  );
});
