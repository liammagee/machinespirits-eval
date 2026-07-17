import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TUTOR_STUB_LEARNER_ADVANCE_SCHEMA,
  buildTutorStubLearnerAdvance,
} from '../services/tutorStubLearnerAdvance.js';

function model({ grounded = 0, voiced = 0, missing = 4, coverage = 0 } = {}) {
  return {
    metrics: {
      groundedCount: grounded,
      voicedDerivedCount: voiced,
      missingPremiseCount: missing,
    },
    assessment: { bestPathCoverage: coverage },
  };
}

test('multiple accepted premises are recorded as accelerated learner-owned progress', () => {
  const advance = buildTutorStubLearnerAdvance({
    accepted: { adopt: ['p_assay', 'p_die'], derive: [] },
    beforeModel: model(),
    afterModel: model({ grounded: 2, missing: 2, coverage: 0.5 }),
  });

  assert.equal(advance.schema, TUTOR_STUB_LEARNER_ADVANCE_SCHEMA);
  assert.equal(advance.pace, 'accelerating');
  assert.equal(advance.accelerated, true);
  assert.equal(advance.multiPremise, true);
  assert.equal(advance.suppliedFollowUp, true);
  assert.equal(advance.supportedMoveCount, 2);
  assert.deepEqual(advance.adoptedPremiseIds, ['p_assay', 'p_die']);
  assert.deepEqual(advance.delta, {
    groundedCount: 2,
    voicedDerivedCount: 0,
    missingPremiseCount: -2,
    bestPathCoverage: 0.5,
  });
});

test('an adopted premise plus a supported learner inference counts as a multi-step advance', () => {
  const advance = buildTutorStubLearnerAdvance({
    accepted: { adopt: ['p_assay'], derive: [['matches', 'blank', 'crucible']] },
    beforeModel: model({ grounded: 1, missing: 3, coverage: 0.2 }),
    afterModel: model({ grounded: 3, voiced: 1, missing: 1, coverage: 0.7 }),
  });

  assert.equal(advance.multiPremise, false);
  assert.equal(advance.multiStep, true);
  assert.equal(advance.accelerated, true);
  assert.equal(advance.derivedFactCount, 1);
  assert.equal(advance.pace, 'accelerating');
});

test('logical closure alone cannot manufacture an accelerated learner turn', () => {
  const advance = buildTutorStubLearnerAdvance({
    accepted: { adopt: [], derive: [] },
    beforeModel: model({ grounded: 1, missing: 3, coverage: 0.2 }),
    afterModel: model({ grounded: 4, missing: 0, coverage: 1 }),
  });

  assert.equal(advance.supportedMoveCount, 0);
  assert.equal(advance.accelerated, false);
  assert.equal(advance.pace, 'steady');
});
