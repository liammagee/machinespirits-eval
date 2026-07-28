import assert from 'node:assert/strict';
import test from 'node:test';

import { projectTutorStubStrictDagAuditState } from '../services/tutorStubStrictDagAuditState.js';

test('strict DAG audit projection preserves the disabled defaults', () => {
  assert.deepEqual(projectTutorStubStrictDagAuditState(null), {
    enabled: false,
    coverage: null,
    bottleneck: null,
    finalSecretEntailed: false,
    assertedSecret: false,
    assertedMirror: false,
    unsupportedAssertionCount: 0,
    missingPremiseCount: 0,
    missingPremiseBuckets: {},
  });
});

test('strict DAG audit projection prefers model metrics and exact true flags', () => {
  const projected = projectTutorStubStrictDagAuditState({
    model: {
      assessment: {
        bestPathCoverage: 0,
        bottleneck: 'assertion_gap',
        finalSecretEntailed: true,
        assertedSecret: 1,
        assertedMirror: true,
        unsupportedAssertionCount: '2',
        missingPremiseCount: 5,
        missingPremiseBuckets: { public: 1 },
      },
      metrics: { missingPremiseCount: 3 },
    },
  });

  assert.deepEqual(projected, {
    enabled: true,
    coverage: 0,
    bottleneck: 'assertion_gap',
    finalSecretEntailed: true,
    assertedSecret: false,
    assertedMirror: true,
    unsupportedAssertionCount: 2,
    missingPremiseCount: 3,
    missingPremiseBuckets: { public: 1 },
  });
});

test('strict DAG audit projection accepts an unwrapped legacy model and assessment fallback', () => {
  const projected = projectTutorStubStrictDagAuditState({
    assessment: { bestPathCoverage: 0.5, missingPremiseCount: '4' },
  });

  assert.equal(projected.enabled, true);
  assert.equal(projected.coverage, 0.5);
  assert.equal(projected.missingPremiseCount, 4);
});
