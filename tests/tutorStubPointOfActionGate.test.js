import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildStep4PointOfActionPlan,
  runStep4ZeroModelFixtures,
  STEP4_POINT_OF_ACTION_SPEC,
  validateStep4PointOfActionPlan,
} from '../scripts/run-step4-point-of-action-gate.js';

test('Step 4 dry plan contains the frozen balanced 80-dialogue matrix', () => {
  const plan = buildStep4PointOfActionPlan({ outputRoot: '/tmp/step4-claim' });
  const validation = validateStep4PointOfActionPlan(plan);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
  assert.equal(plan.jobs.length, 80);
  assert.equal(validation.balancedCellCount, 16);
  assert.equal(validation.fixedSupportingSeams, true);
  assert.deepEqual(new Set(plan.jobs.map((job) => job.repeat)), new Set([1, 2, 3, 4, 5]));
  assert.ok(plan.jobs.every((job) => job.command.includes(STEP4_POINT_OF_ACTION_SPEC.supportingModel)));
});

test('Step 4 ordering and plan hash inputs are deterministic for the frozen seed', () => {
  const first = buildStep4PointOfActionPlan({ outputRoot: '/tmp/step4-claim' });
  const second = buildStep4PointOfActionPlan({ outputRoot: '/tmp/step4-claim' });
  assert.deepEqual(first, second);
});

test('Step 4 zero-model fixtures pass every frozen detector and compliance case', () => {
  const result = runStep4ZeroModelFixtures();
  assert.equal(result.ok, true);
  assert.ok(Object.values(result.checks).every(Boolean));
});
