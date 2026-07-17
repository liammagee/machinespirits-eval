import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditTutorStubEngagementOperation,
  compileTutorStubEngagementOperation,
  TUTOR_STUB_ENGAGEMENT_OPERATION_SCHEMA,
} from '../services/tutorStubEngagementOperation.js';

function causalContract(overrides = {}) {
  return {
    schema: 'machinespirits.tutor-stub.writable-entry-causal-contract.v1',
    public_relation: 'inactive_candidate_with_persisting_outcome',
    family: 'production',
    polarity: 'negative',
    subject: 'depot chargers',
    outcome: 'Tallow Street brownout',
    public_evidence_surface:
      'The depot chargers stood dark during stocktake while Tallow Street still browned out.',
    ...overrides,
  };
}

test('compiles a world-general charismatic public-pressure collision from a typed causal relation', () => {
  const contract = compileTutorStubEngagementOperation({
    engagementStance: 'charismatic',
    causalRelationContract: causalContract(),
  });

  assert.equal(contract.schema, TUTOR_STUB_ENGAGEMENT_OPERATION_SCHEMA);
  assert.equal(contract.owner, 'performance_entry');
  assert.equal(contract.id, 'public_pressure_collision');
  assert.match(contract.instruction, /public inactivity clue against the accusation or claim/iu);
  assert.match(contract.instruction, /depot chargers/iu);
  assert.match(contract.instruction, /Tallow Street brownout/iu);
});

test('V46 remains a genuine generation miss under the typed operation', () => {
  const contract = compileTutorStubEngagementOperation({
    engagementStance: 'charismatic',
    causalRelationContract: causalContract(),
  });
  const audit = auditTutorStubEngagementOperation({
    contract,
    performanceEntry:
      'My case is this: dark depot chargers during stocktake cannot explain the 18:40 Tallow Street brownout.',
  });

  assert.equal(audit.ok, false);
  assert.equal(audit.checks.public_evidence_cue_visible, true);
  assert.equal(audit.checks.subject_visible, true);
  assert.equal(audit.checks.outcome_visible, true);
  assert.equal(audit.checks.pressure_target_visible, false);
  assert.equal(audit.checks.first_person_set_against_visible, false);
});

test('accepts set-against variants only when clue, target, subject, and outcome share the owned entry', () => {
  const contract = compileTutorStubEngagementOperation({
    engagementStance: 'charismatic',
    causalRelationContract: causalContract(),
  });
  const variants = [
    'My case is this: I set stocktake darkness against the accusation against depot chargers for the Tallow Street brownout.',
    'My case is this: I set idle depot chargers against the Tallow Street brownout claim.',
    'My case is this: I set cold depot chargers against the verdict on the Tallow Street brownout.',
  ];

  for (const performanceEntry of variants) {
    const audit = auditTutorStubEngagementOperation({ contract, performanceEntry });
    assert.equal(audit.ok, true, `${performanceEntry}: ${audit.reason}`);
  }
});

test('binds the same typed operation across an unrelated subject and outcome', () => {
  const contract = compileTutorStubEngagementOperation({
    engagementStance: 'charismatic',
    causalRelationContract: causalContract({
      subject: 'backup pump',
      outcome: 'basement flood',
      public_evidence_surface:
        'The backup pump remained idle while the basement still flooded.',
    }),
  });
  const audit = auditTutorStubEngagementOperation({
    contract,
    performanceEntry:
      'My case is this: I set the idle backup pump against the basement flood accusation.',
  });

  assert.equal(audit.ok, true, audit.reason);
  assert.equal(audit.checks.subject_visible, true);
  assert.equal(audit.checks.outcome_visible, true);
});

test('binds the clue to the supplied public surface instead of a fixed inactivity vocabulary', () => {
  const contract = compileTutorStubEngagementOperation({
    engagementStance: 'charismatic',
    causalRelationContract: causalContract({
      subject: 'north ventilator',
      outcome: 'gallery haze',
      public_evidence_surface:
        'The north ventilator was quiescent during inspection while the gallery haze persisted.',
    }),
  });
  const audit = auditTutorStubEngagementOperation({
    contract,
    performanceEntry:
      'My case is this: I set the quiescent north ventilator against the gallery haze claim.',
  });

  assert.equal(audit.ok, true, audit.reason);
  assert.equal(audit.checks.public_evidence_cue_visible, true);
});

test('does not manufacture realization when any typed obligation or concrete operation is absent', () => {
  const contract = compileTutorStubEngagementOperation({
    engagementStance: 'charismatic',
    causalRelationContract: causalContract(),
  });
  const misses = [
    'My case is this: the claim fails before the Tallow Street brownout.',
    'My case is this: the depot charger case is weakened by the Tallow Street brownout.',
    'My case is this: I set darkness against the accusation.',
    'My case is this: I set dark depot chargers beside the Tallow Street brownout claim.',
  ];

  for (const performanceEntry of misses) {
    const audit = auditTutorStubEngagementOperation({ contract, performanceEntry });
    assert.equal(audit.ok, false, performanceEntry);
  }
  const wrongOwner = auditTutorStubEngagementOperation({
    contract: { ...contract, owner: 'handoff' },
    performanceEntry:
      'My case is this: I set idle depot chargers against the Tallow Street brownout claim.',
  });
  assert.equal(wrongOwner.ok, false);
  assert.equal(wrongOwner.checks.owner_matches, false);
});

test('stays inactive outside the exact typed charismatic causal condition', () => {
  assert.equal(
    compileTutorStubEngagementOperation({
      engagementStance: 'precise',
      causalRelationContract: causalContract(),
    }),
    null,
  );
  assert.equal(
    compileTutorStubEngagementOperation({
      engagementStance: 'charismatic',
      causalRelationContract: causalContract({ family: 'prevention' }),
    }),
    null,
  );
  assert.equal(
    compileTutorStubEngagementOperation({
      engagementStance: 'charismatic',
      causalRelationContract: causalContract({ public_evidence_surface: null }),
    }),
    null,
  );
  assert.equal(auditTutorStubEngagementOperation({ contract: null }).active, false);
});
