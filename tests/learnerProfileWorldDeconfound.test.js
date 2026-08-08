import assert from 'node:assert/strict';
import test from 'node:test';

import {
  readLearnerProfileWorldDeconfoundDesign,
  renderLearnerProfileWorldDeconfoundReview,
  validateLearnerProfileWorldDeconfoundDesign,
} from '../scripts/review-learner-profile-world-deconfound.js';

test('learner-profile world deconfound freezes two crossed cells without authorizing calls', () => {
  const design = readLearnerProfileWorldDeconfoundDesign();
  const report = validateLearnerProfileWorldDeconfoundDesign(design);

  assert.equal(report.dialogues, 10);
  assert.equal(report.userAdjudication, 'pending');
  assert.equal(report.paidAuthorization, 'not_authorized');
  assert.deepEqual(report.recoveryInstrument, {
    pressure: 'config/manner-trigger/v4.json',
    quietVersion: 'qd-v1',
    status: 'restore_exact_before_certificate',
  });
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

test('learner-profile world deconfound review exposes exact adjudication decisions', () => {
  const design = readLearnerProfileWorldDeconfoundDesign();
  const report = validateLearnerProfileWorldDeconfoundDesign(design);
  const markdown = renderLearnerProfileWorldDeconfoundReview(design, report);

  assert.match(markdown, /record keeper: world_033_alder_row_redoubt → world_030_rowan_flat/u);
  assert.match(markdown, /tenant: world_030_rowan_flat → world_033_alder_row_redoubt/u);
  assert.match(markdown, /Accept or revise the record-keeper transplant/u);
  assert.match(markdown, /reproduce the original 56\/64 reading before certification/u);
  assert.match(markdown, /Separately authorize the ten paid dialogues/u);
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
    /record_keeper_in_rowan must remain at five dialogues/u,
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
});
