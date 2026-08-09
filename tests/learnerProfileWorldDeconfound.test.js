import assert from 'node:assert/strict';
import test from 'node:test';

import {
  readLearnerProfileWorldDeconfoundDesign,
  renderLearnerProfileWorldDeconfoundReview,
  validateLearnerProfileWorldDeconfoundDesign,
} from '../scripts/review-learner-profile-world-deconfound.js';

test('learner-profile world deconfound freezes one prospective balanced 2x2 without authorizing calls', () => {
  const design = readLearnerProfileWorldDeconfoundDesign();
  const report = validateLearnerProfileWorldDeconfoundDesign(design);

  assert.equal(report.dialogues, 20);
  assert.equal(report.status, 'prospective_balanced_delivery_verified');
  assert.equal(report.userAdjudication, 'approved');
  assert.equal(report.adjudicatedOn, '2026-08-09');
  assert.equal(report.thirdPersona, 'omit');
  assert.equal(report.scopeAmendment, 'approved_for_design');
  assert.equal(report.deliveryVerification, 'verified');
  assert.equal(report.paidAuthorization, 'not_authorized');
  assert.deepEqual(report.recoveryInstrument, {
    pressure: 'config/manner-trigger/v4.json',
    quietVersion: 'qd-v1',
    replayManifest: 'config/learner-profile-recovery-l1.json',
    quietArtifact: 'services/tutorStubQuietDetectorV1.js',
    status: 'restored_exact_prospective_rebaseline',
  });
  assert.deepEqual(
    report.cells.map(({ id, persona, world }) => ({ id, persona, world })),
    [
      {
        id: 'record_keeper_in_alder',
        persona: 'record_keeper',
        world: 'world_033_alder_row_redoubt',
      },
      {
        id: 'record_keeper_in_rowan',
        persona: 'record_keeper',
        world: 'world_030_rowan_flat',
      },
      { id: 'tenant_in_rowan', persona: 'tenant', world: 'world_030_rowan_flat' },
      { id: 'tenant_in_alder', persona: 'tenant', world: 'world_033_alder_row_redoubt' },
    ],
  );
  assert.deepEqual(
    report.personas.map(({ id, sourceWorld, targetWorld }) => ({ id, sourceWorld, targetWorld })),
    [
      {
        id: 'record_keeper',
        sourceWorld: 'world_033_alder_row_redoubt',
        targetWorld: 'world_030_rowan_flat',
      },
      {
        id: 'tenant',
        sourceWorld: 'world_030_rowan_flat',
        targetWorld: 'world_033_alder_row_redoubt',
      },
    ],
  );
});

test('learner-profile world deconfound review exposes the approved design and remaining gates', () => {
  const design = readLearnerProfileWorldDeconfoundDesign();
  const report = validateLearnerProfileWorldDeconfoundDesign(design);
  const markdown = renderLearnerProfileWorldDeconfoundReview(design, report);

  assert.match(markdown, /record keeper: world_033_alder_row_redoubt → world_030_rowan_flat/u);
  assert.match(markdown, /tenant: world_030_rowan_flat → world_033_alder_row_redoubt/u);
  assert.match(markdown, /Adjudicated: \*\*approved\*\* on 2026-08-09/u);
  assert.match(markdown, /Third persona: \*\*omit\*\*/u);
  assert.match(markdown, /20 new dialogues/u);
  assert.match(markdown, /no historical dialogue is pooled/u);
  assert.match(markdown, /historical motivation only/u);
  assert.match(markdown, /clean main SHA/u);
  assert.match(markdown, /separately authorize the twenty paid dialogues/iu);
  assert.doesNotMatch(markdown, /Accept or revise/u);
  assert.doesNotMatch(markdown, /paid authorization: \*\*authorized\*\*/iu);
});

test('learner-profile world deconfound rejects source-world surface leakage', () => {
  const design = structuredClone(readLearnerProfileWorldDeconfoundDesign());
  design.personas.tenant.transplant.private_brief += '\nSam is still the obvious culprit.';

  assert.throws(
    () => validateLearnerProfileWorldDeconfoundDesign(design),
    /tenant transplant private brief leaks source-world surface: Sam/u,
  );
});

test('learner-profile world deconfound rejects changed cost or premature authorization', () => {
  const changedCost = structuredClone(readLearnerProfileWorldDeconfoundDesign());
  changedCost.paid_design.cells[0].repeats = 6;
  assert.throws(
    () => validateLearnerProfileWorldDeconfoundDesign(changedCost),
    /record_keeper_in_alder must remain at five dialogues/u,
  );

  const authorized = structuredClone(readLearnerProfileWorldDeconfoundDesign());
  authorized.freeze.paid_authorization = 'authorized';
  assert.throws(
    () => validateLearnerProfileWorldDeconfoundDesign(authorized),
    /paid calls must remain not_authorized/u,
  );

  const changedInstrument = structuredClone(readLearnerProfileWorldDeconfoundDesign());
  changedInstrument.runtime.recovery_instrument.quiet_version = 'qd-v2';
  assert.throws(
    () => validateLearnerProfileWorldDeconfoundDesign(changedInstrument),
    /quiet instrument must remain qd-v1/u,
  );

  const changedAfterApproval = structuredClone(readLearnerProfileWorldDeconfoundDesign());
  changedAfterApproval.personas.record_keeper.transplant.private_brief += '\nA post-approval change.';
  assert.throws(
    () => validateLearnerProfileWorldDeconfoundDesign(changedAfterApproval),
    /record_keeper transplanted private brief changed after adjudication/u,
  );
});
