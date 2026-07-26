import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  loadTutorPrBenchmarkRubric,
  TUTOR_PR_BENCHMARK_RUBRIC_SCHEMA,
  validateTutorPrBenchmarkRubric,
} from '../services/tutorPrBenchmarkRubric.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUBRIC_PATH = path.join(ROOT, 'config', 'tutor-pr-benchmark-rubric.yaml');

test('versioned PR benchmark rubric defines anchored hard, advisory, and composite axes', () => {
  const loaded = loadTutorPrBenchmarkRubric(RUBRIC_PATH, {
    schema: TUTOR_PR_BENCHMARK_RUBRIC_SCHEMA,
    version: '1.0',
  });
  assert.equal(loaded.rubric.status, 'calibration');
  assert.equal(loaded.rubric.supersedes, 'implicit-deterministic-audit-criteria');
  assert.deepEqual(loaded.rubric.decision_policy.hard_axes, [
    'safety',
    'learner_uptake',
    'evidence_discipline',
    'handoff',
    'actorial_part',
  ]);
  assert.deepEqual(loaded.rubric.decision_policy.advisory_axes, ['performance_tactic']);
  assert.equal(loaded.rubric.axes.overall_delivery.severity, 'composite');
  for (const axis of Object.values(loaded.rubric.axes)) {
    assert.ok(axis.pass_anchor);
    assert.ok(axis.fail_anchor);
    assert.ok(axis.unsure_anchor);
    assert.ok(axis.exclusions.length > 0);
  }
  assert.match(loaded.sha256, /^[a-f0-9]{64}$/u);
});

test('rubric validation rejects missing anchors and severity-policy drift', () => {
  const loaded = loadTutorPrBenchmarkRubric(RUBRIC_PATH);
  const missingAnchor = structuredClone(loaded.rubric);
  delete missingAnchor.axes.safety.fail_anchor;
  assert.throws(() => validateTutorPrBenchmarkRubric(missingAnchor), /safety\.fail_anchor is required/u);

  const severityDrift = structuredClone(loaded.rubric);
  severityDrift.axes.handoff.severity = 'advisory';
  assert.throws(() => validateTutorPrBenchmarkRubric(severityDrift), /classifies handoff differently/u);
});
