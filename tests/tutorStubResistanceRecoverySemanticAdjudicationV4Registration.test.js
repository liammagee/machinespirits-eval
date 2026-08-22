import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registration = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, 'config/tutor-stub-resistance-recovery-semantic-adjudication-registration.v4.json'),
    'utf8',
  ),
);

function sha256(relative) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(ROOT, relative)))
    .digest('hex');
}

test('V4 registration freezes field-local evidence validity before any fresh heldout is authored', () => {
  assert.equal(registration.instrument.freezeCommit, '61bb4ffa4fb5ac6e93090522e015c08cb47eebc5');
  assert.equal(sha256(registration.instrument.implementationPath), registration.instrument.implementationSha256);
  assert.equal(registration.evidenceProtocol.modelSuppliedNumericOffsetsAuthoritative, false);
  assert.equal(registration.evidenceProtocol.diagnosticInvalidityMayVetoPrimaryRecovery, false);
  assert.equal(registration.evidenceProtocol.regexKeywordOrLexicalSemanticAuthority, 'none');
  assert.equal(
    registration.measurement.hierarchicalConsensus.mediumConfidenceDisposition,
    'eligible_when_determinate_and_field_valid',
  );
  assert.equal(registration.measurement.hierarchicalConsensus.lowConfidenceDisposition, 'measurement_indeterminate');
  assert.equal(registration.freshHeldoutProtocol.corpusPath, null);
  assert.equal(registration.freshHeldoutProtocol.zeroCaseReuseFromConsumedV2V3Corpus, true);
  assert.equal(registration.freshHeldoutProtocol.judgeModelsMayAuthorGoldOrCases, false);
  assert.equal(registration.authorization.validationModelCallsAuthorized, false);
  assert.equal(registration.authorization.confirmationModelCallsAuthorized, false);
});

test('V4 preserves the scientific panel and gates while resetting the operational ledger', () => {
  assert.deepEqual(
    registration.measurement.judges.map((judge) => judge.modelRef),
    ['codex.gpt-5.6-sol', 'claude-code.sonnet-5', 'codex.gpt-5.5'],
  );
  assert.equal(registration.freshHeldoutProtocol.exactCases, 120);
  assert.equal(registration.freshHeldoutProtocol.exactMeritsOnlyCases, 32);
  assert.equal(registration.freshHeldoutProtocol.exactGroundedOnlyCases, 32);
  assert.equal(registration.freshHeldoutProtocol.exactBothRecoveryConstructCases, 16);
  assert.equal(registration.freshHeldoutProtocol.exactNoRecoveryCases, 40);
  assert.equal(registration.prospectiveValidationBudget.programmeLedgerBeforeV4OutcomeValidation, 1510);
  assert.equal(registration.prospectiveValidationBudget.hardValidationReservations, 1080);
  assert.equal(registration.prospectiveValidationBudget.programmeMaximumAfterV4OutcomeValidation, 2590);
  assert.equal(registration.prospectiveValidationBudget.programmeCeiling, 5000);
});
