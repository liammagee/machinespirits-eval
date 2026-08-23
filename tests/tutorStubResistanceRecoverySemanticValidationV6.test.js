import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TUTOR_STUB_RESISTANCE_FIDELITY_VALIDATION_REGISTRATION_V6,
  TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_VALIDATION_REGISTRATION_V6,
  loadTutorStubResistanceMeasurementValidationV6,
  validateTutorStubResistanceMeasurementValidationV6,
} from '../services/tutorStubResistanceRecoverySemanticValidationV6.js';

test('V6 primary and fidelity validation registrations bind one fresh corpus but separate stages', () => {
  const primary = loadTutorStubResistanceMeasurementValidationV6(
    TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_VALIDATION_REGISTRATION_V6,
  );
  const fidelity = loadTutorStubResistanceMeasurementValidationV6(
    TUTOR_STUB_RESISTANCE_FIDELITY_VALIDATION_REGISTRATION_V6,
  );
  assert.equal(primary.stage, 'primary_recovery');
  assert.equal(fidelity.stage, 'intervention_fidelity');
  assert.equal(primary.instrumentSha256, fidelity.instrumentSha256);
  assert.equal(primary.corpusSha256, fidelity.corpusSha256);
  assert.notEqual(primary.registrationSha256, fidelity.registrationSha256);
  assert.equal(primary.registration.executionReadiness.plannedModelCalls, 360);
  assert.equal(fidelity.registration.executionReadiness.plannedModelCalls, 360);
  assert.equal(primary.registration.executionReadiness.hardStageReservations, 1080);
  assert.equal(fidelity.registration.executionReadiness.hardStageReservations, 1080);
});

test('V6 validation registration fails closed on outcome leakage and old ceiling drift', () => {
  const loaded = loadTutorStubResistanceMeasurementValidationV6(
    TUTOR_STUB_RESISTANCE_FIDELITY_VALIDATION_REGISTRATION_V6,
  );
  const registration = structuredClone(loaded.registration);
  registration.analysis.fidelityMayVetoOrRecodePrimary = true;
  registration.executionReadiness.programmeCeiling = 5000;
  const validation = validateTutorStubResistanceMeasurementValidationV6({
    registration,
    instrument: loaded.instrument,
    corpus: loaded.corpus,
  });
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.includes('execution, lifecycle, analysis, or authorization boundary drifted'));
});
