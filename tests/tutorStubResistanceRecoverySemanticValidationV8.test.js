import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TUTOR_STUB_RESISTANCE_FIDELITY_VALIDATION_REGISTRATION_V8,
  TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_VALIDATION_REGISTRATION_V8,
  loadTutorStubResistanceMeasurementValidationV8,
  validateTutorStubResistanceMeasurementValidationV8,
} from '../services/tutorStubResistanceRecoverySemanticValidationV8.js';

test('V8 registrations bind one wholly fresh corpus but separate sequential stages', () => {
  const primary = loadTutorStubResistanceMeasurementValidationV8(
    TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_VALIDATION_REGISTRATION_V8,
  );
  const fidelity = loadTutorStubResistanceMeasurementValidationV8(
    TUTOR_STUB_RESISTANCE_FIDELITY_VALIDATION_REGISTRATION_V8,
  );
  assert.equal(primary.stage, 'primary_recovery');
  assert.equal(fidelity.stage, 'intervention_fidelity');
  assert.equal(primary.corpusSha256, fidelity.corpusSha256);
  assert.equal(primary.registration.lifecycle.stageOrder, 'primary_then_fidelity');
  assert.deepEqual(primary.registration.lifecycle.responseFreeRetryDelaysMs, [15000, 45000]);
});

test('V8 registration fails closed on diagnostic, sequence, and ledger drift', () => {
  const loaded = loadTutorStubResistanceMeasurementValidationV8(
    TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_VALIDATION_REGISTRATION_V8,
  );
  const registration = structuredClone(loaded.registration);
  registration.lifecycle.failureDiagnosticsPersistedToAttemptRecord = false;
  registration.lifecycle.stageOrder = 'parallel';
  registration.executionReadiness.combinedValidationMaximumAfterBothStages = 5000;
  const validation = validateTutorStubResistanceMeasurementValidationV8({
    registration,
    instrument: loaded.instrument,
    corpus: loaded.corpus,
  });
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.includes('execution, lifecycle, analysis, or authorization boundary drifted'));
});
