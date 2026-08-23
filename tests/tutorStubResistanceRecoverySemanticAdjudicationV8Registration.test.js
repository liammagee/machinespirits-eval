import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRATION = 'config/tutor-stub-resistance-recovery-semantic-adjudication-registration.v8.json';

function sha256(relative) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(ROOT, relative)))
    .digest('hex');
}

test('V8 registration freezes every observed failure into a prospective safeguard', () => {
  const registration = JSON.parse(fs.readFileSync(path.join(ROOT, REGISTRATION), 'utf8'));
  assert.equal(
    registration.status,
    'transport_observable_compositional_plain_split_instrument_frozen_pending_genuinely_fresh_v8_heldout',
  );
  assert.equal(registration.instrument.freezeCommit, '9cd37f0b6708ea9410930d97516aa707c762c632');
  assert.equal(sha256(registration.instrument.implementationPath), registration.instrument.implementationSha256);
  assert.equal(
    sha256(registration.instrument.primaryResponseSchemaPath),
    registration.instrument.primaryResponseSchemaSha256,
  );
  assert.equal(
    sha256(registration.instrument.fidelityResponseSchemaPath),
    registration.instrument.fidelityResponseSchemaSha256,
  );
  assert.equal(registration.instrument.primaryAndFidelityPromptCallsSeparate, true);
  assert.equal(registration.instrument.fidelityPacketContainsLearnerOutcome, false);
  assert.equal(registration.instrument.fidelityFailureMayVetoOrRecodePrimary, false);
  assert.equal(registration.instrument.primaryFinalRecoveryReturnedByModel, false);
  assert.equal(registration.instrument.confidenceEvidenceAndIndeterminacyAreFieldLocal, true);
  assert.equal(registration.failureToSafeguardMatrix.length, 22);
  assert.equal(new Set(registration.failureToSafeguardMatrix.map((row) => row.failure)).size, 22);
  assert.equal(
    registration.transport.cliBridgeSha256,
    'f15cee894143b40b97d50e8584a12888b6ceae33354b59a4963c9e16b794b868',
  );
  assert.notEqual(sha256(registration.transport.cliBridgePath), registration.transport.cliBridgeSha256);
  assert.equal(sha256(registration.transport.stubProcessPolicyPath), registration.transport.stubProcessPolicySha256);
  assert.equal(registration.transport.failureDiagnosticsPersistedToAttemptRecord, true);
  assert.equal(registration.transport.stagesRunSequentially, true);
  assert.deepEqual(registration.transport.responseFreeRetryDelaysMs, [15000, 45000]);
  assert.equal(registration.evidenceProtocol.modelSuppliedNumericOffsetsPresent, false);
  assert.equal(registration.evidenceProtocol.regexKeywordLexicalOrGeneratorSemanticAuthority, 'none');
});

test('V8 registration preserves the scientifically selected case structure under the amended safeguard', () => {
  const registration = JSON.parse(fs.readFileSync(path.join(ROOT, REGISTRATION), 'utf8'));
  assert.equal(registration.freshHeldoutProtocol.exactCases, 120);
  assert.equal(
    Object.values(registration.freshHeldoutProtocol.recoveryStrata).reduce((a, b) => a + b, 0),
    120,
  );
  assert.equal(
    registration.freshHeldoutProtocol.fidelityStrata.warm +
      registration.freshHeldoutProtocol.fidelityStrata.plain +
      registration.freshHeldoutProtocol.fidelityStrata.neither,
    120,
  );
  assert.equal(registration.budget.plannedCalls, 720);
  assert.equal(registration.budget.hardValidationReservations, 2160);
  assert.equal(registration.budget.programmeLedgerBeforeV8Validation, 3027);
  assert.equal(registration.budget.programmeMaximumAfterValidation, 5187);
  assert.equal(registration.budget.prospectiveConfirmationHardReservations, 4428);
  assert.equal(registration.budget.programmeMaximumAfterValidationAndConfirmation, 9615);
  assert.equal(registration.budget.programmeCeiling, 10000);
  assert.equal(registration.budget.programmeRemainingAtProspectiveMaximum, 385);
  assert.equal(registration.budget.attemptCountsAreOperationalSafeguardsNotDesignObjectives, true);
  assert.deepEqual(registration.authorization.programmeCeilingAmendment, {
    from: 5000,
    to: 10000,
    increase: 5000,
    authorizedByUser: true,
    authorizedAt: '2026-08-22',
  });
  assert.equal(registration.authorization.validationModelCallsAuthorized, false);
  assert.equal(registration.authorization.confirmationModelCallsAuthorized, false);
});
