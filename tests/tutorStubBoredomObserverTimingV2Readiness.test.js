import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  assessTutorStubBoredomCompositionSyntheticCases,
  buildTutorStubBoredomCompositionSyntheticCases,
  loadTutorStubBoredomProofDagRegistration,
  runTutorStubBoredomProofDagEndpointPreflight,
  validateTutorStubBoredomProofDagRegistration,
} from '../services/tutorStubBoredomActionRegisterProofDagPreflight.js';
import {
  hashPaidStudyEndpointValue,
  validatePaidStudyEndpointGoCertificate,
} from '../services/paidStudyEndpointPreflight.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRATION = 'config/tutor-stub-boredom-action-register-proof-dag-registration.v2.json';
const ENDPOINT = 'config/paid-study-endpoints/tutor-stub-boredom-action-register-proof-dag.v2.json';
const CERTIFICATE = 'config/paid-study-endpoints/tutor-stub-boredom-action-register-proof-dag.v2.endpoint-go.json';

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function sha(relativePath) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(ROOT, relativePath)))
    .digest('hex');
}

test('prospective-v7 registration freezes the failed run and preserves the powered scientific design', () => {
  const registration = loadTutorStubBoredomProofDagRegistration({ root: ROOT, registrationPath: REGISTRATION });
  assert.equal(validateTutorStubBoredomProofDagRegistration(registration).ok, true);
  assert.equal(registration.design.observationSemantics, 'prospective_v7');
  assert.equal(
    registration.stoppedConfirmation.disposition,
    'categorical_instrument_failure_incomplete_no_scientific_verdict',
  );
  assert.deepEqual(registration.stoppedConfirmation.accounting, {
    reservations: 71,
    completed: 71,
    providerFailures: 0,
    aborted: 0,
  });
  assert.equal(registration.stoppedConfirmation.traceSha256.length, 8);
  for (const key of ['reuse', 'resume', 'retry', 'pool', 'replace', 'analyze', 'confirmationCredit']) {
    assert.equal(registration.stoppedConfirmation[key], false, key);
  }
  assert.equal(registration.power.minimumPerArm, 18);
  assert.equal(registration.executionReadiness.hardStudyAttemptCeiling, 2160);
  assert.equal(
    registration.executionReadiness.programmeCeilingIfFrameRefusalConfirmationAlsoReserved.requiredCeiling,
    4610,
  );
  assert.equal(registration.authorization.modelCallsAuthorized, false);
  assert.equal(registration.authorization.liveRunAuthorized, false);
});

test('historical boredom registration, endpoint, certificate, and request bytes remain exact', () => {
  const expected = {
    'config/tutor-stub-boredom-action-register-proof-dag-registration.v1.json':
      '72f293cee1e364818bd6baa30a36df2d908af8d3c9f6df664731039d09d8e0a8',
    'config/paid-study-endpoints/tutor-stub-boredom-action-register-proof-dag.v1.json':
      'da33ca69e4092a66db3169ee19d645152a99b1c3ffaac231c8fbed09846f3d59',
    'config/paid-study-endpoints/tutor-stub-boredom-action-register-proof-dag.v1.endpoint-go.json':
      '702e3fd849c3664d3edcc95dd63b4fbc3138cfa21121b96090b586095acb6899',
    'config/tutor-stub-boredom-action-register-proof-dag-study-go-request.v1.json':
      '0972e76083a7a89592a25d55820527e2b061afad0fdf72036f08790dd61dfe61',
    'config/tutor-stub-boredom-action-register-proof-dag-study-go-request.v2.json':
      '476db5ea5d2bdb9a3bc9a1d3df5b0c5e0d3a641cbd1883129e4fe0f583037310',
  };
  for (const [relativePath, digest] of Object.entries(expected)) assert.equal(sha(relativePath), digest, relativePath);
});

test('zero-call endpoint preflight exercises positive, negative, and ambiguous composition and validates its certificate', () => {
  const registration = loadTutorStubBoredomProofDagRegistration({ root: ROOT, registrationPath: REGISTRATION });
  const contract = readJson(ENDPOINT);
  const certificate = readJson(CERTIFICATE);
  assert.equal(contract.registration.registration_sha256, sha(REGISTRATION));
  const preflight = runTutorStubBoredomProofDagEndpointPreflight({ contract, registration });
  assert.equal(preflight.model_calls, 0);
  assert.equal(preflight.production_writes, 0);
  assert.equal(preflight.assembly_audit.endpoint_status.compositional_boredom_observer_timing, 'complete');
  assert.equal(preflight.readiness.required_programme_ceiling_study_alone, 2450);
  assert.equal(preflight.readiness.required_programme_ceiling_with_frame_refusal_reservation, 4610);
  assert.equal(hashPaidStudyEndpointValue(contract), certificate.contract_sha256);
  assert.equal(validatePaidStudyEndpointGoCertificate({ contract, preflight, certificate }).ok, true);
  const matrix = assessTutorStubBoredomCompositionSyntheticCases();
  assert.equal(matrix.pass, true);
  assert.equal(matrix.results.length, 6);
  const ambiguous = buildTutorStubBoredomCompositionSyntheticCases().map((row) => ({ ...row }));
  ambiguous[0] = {
    ...ambiguous[0],
    expected: 'positive_actionable_withdrawal_without_uptake',
  };
  assert.equal(assessTutorStubBoredomCompositionSyntheticCases(ambiguous).pass, false);
});
