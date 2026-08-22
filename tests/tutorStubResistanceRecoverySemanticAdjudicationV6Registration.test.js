import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRATION = 'config/tutor-stub-resistance-recovery-semantic-adjudication-registration.v6.json';

function sha256(relative) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(ROOT, relative)))
    .digest('hex');
}

test('V6 registration freezes every observed failure into a prospective safeguard', () => {
  const registration = JSON.parse(fs.readFileSync(path.join(ROOT, REGISTRATION), 'utf8'));
  assert.equal(registration.status, 'field_local_split_instrument_frozen_pending_genuinely_fresh_v6_heldout');
  assert.equal(registration.instrument.freezeCommit, '779941725c6c57b880aef49e0c5524c19c117903');
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
  assert.equal(registration.failureToSafeguardMatrix.length, 16);
  assert.equal(new Set(registration.failureToSafeguardMatrix.map((row) => row.failure)).size, 16);
  assert.equal(registration.evidenceProtocol.modelSuppliedNumericOffsetsPresent, false);
  assert.equal(registration.evidenceProtocol.regexKeywordLexicalOrGeneratorSemanticAuthority, 'none');
});

test('V6 registration preserves the scientifically selected case structure under the amended safeguard', () => {
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
  assert.equal(registration.budget.programmeMaximumAfterValidation, 3670);
  assert.equal(registration.budget.prospectiveConfirmationHardReservations, 4428);
  assert.equal(registration.budget.programmeMaximumAfterValidationAndConfirmation, 8098);
  assert.equal(registration.budget.programmeCeiling, 10000);
  assert.equal(registration.budget.programmeRemainingAtProspectiveMaximum, 1902);
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
