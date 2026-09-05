import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TUTOR_STUB_RESISTANCE_FIDELITY_VALIDATION_REGISTRATION_V5,
  TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_VALIDATION_REGISTRATION_V5,
  loadTutorStubResistanceMeasurementValidationV5,
  validateTutorStubResistanceMeasurementValidationV5,
} from '../services/tutorStubResistanceRecoverySemanticValidationV5.js';

test('V5 primary and fidelity validation registrations bind one fresh corpus but separate stages', () => {
  const primary = loadTutorStubResistanceMeasurementValidationV5(
    TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_VALIDATION_REGISTRATION_V5,
  );
  const fidelity = loadTutorStubResistanceMeasurementValidationV5(
    TUTOR_STUB_RESISTANCE_FIDELITY_VALIDATION_REGISTRATION_V5,
  );
  assert.equal(primary.stage, 'primary_recovery');
  assert.equal(fidelity.stage, 'intervention_fidelity');
  assert.equal(primary.instrumentSha256, fidelity.instrumentSha256);
  assert.equal(primary.corpusSha256, fidelity.corpusSha256);
  // The instrument digest is recorded, not pinned. Asserting drifted === false
  // re-creates the banned pin on a code file, and comparing observedSha256 with
  // instrumentSha256 hashes the same file twice in one run (CLAUDE.md, 2026-08-21).
  assert.equal(
    primary.digestRecords[0].path,
    'config/tutor-stub-resistance-recovery-semantic-adjudication-registration.v5.json',
  );
  assert.match(primary.digestRecords[0].observedSha256, /^[0-9a-f]{64}$/u);
  assert.equal(typeof primary.digestRecords[0].drifted, 'boolean');
  assert.notEqual(primary.registrationSha256, fidelity.registrationSha256);
  assert.equal(primary.registration.executionReadiness.plannedModelCalls, 360);
  assert.equal(fidelity.registration.executionReadiness.plannedModelCalls, 360);
  assert.equal(primary.registration.executionReadiness.hardStageReservations, 1080);
  assert.equal(fidelity.registration.executionReadiness.hardStageReservations, 1080);
});

test('V5 validation registration fails closed on outcome leakage and old ceiling drift', () => {
  const loaded = loadTutorStubResistanceMeasurementValidationV5(
    TUTOR_STUB_RESISTANCE_FIDELITY_VALIDATION_REGISTRATION_V5,
  );
  const registration = structuredClone(loaded.registration);
  registration.analysis.fidelityMayVetoOrRecodePrimary = true;
  registration.executionReadiness.programmeCeiling = 5000;
  const validation = validateTutorStubResistanceMeasurementValidationV5({
    registration,
    instrument: loaded.instrument,
    corpus: loaded.corpus,
  });
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.includes('execution, lifecycle, analysis, or authorization boundary drifted'));
});
