import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildTutorStubBoredomProofDagPlan,
  buildTutorStubBoredomProofDagSyntheticCases,
  loadTutorStubBoredomProofDagRegistration,
  runTutorStubBoredomProofDagEndpointPreflight,
  validateTutorStubBoredomProofDagRegistration,
} from '../services/tutorStubBoredomActionRegisterProofDagPreflight.js';
import {
  hashPaidStudyEndpointValue,
  validatePaidStudyEndpointGoCertificate,
} from '../services/paidStudyEndpointPreflight.js';
import { selectTutorStubBoredomSemanticAdjudicatorFactory } from '../services/tutorStubCliApplicationHost.js';
import { createTutorStubBoredomSemanticAdjudicator as createV1Adjudicator } from '../services/tutorStubBoredomSemanticAdjudication.js';
import { createTutorStubBoredomSemanticAdjudicator as createV3Adjudicator } from '../services/tutorStubBoredomSemanticAdjudicationV3.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRATION = 'config/tutor-stub-boredom-action-register-proof-dag-registration.v4.json';
const CONTRACT = 'config/paid-study-endpoints/tutor-stub-boredom-action-register-proof-dag.v4.json';
const CERTIFICATE = 'config/paid-study-endpoints/tutor-stub-boredom-action-register-proof-dag.v4.endpoint-go.json';
const HELDOUT = 'config/tutor-stub-boredom-semantic-adjudication-heldout.v4.json';
const INSTRUMENT = 'services/tutorStubBoredomSemanticAdjudicationV3.js';
const SUPERSEDED_HOLD_REQUEST = 'config/tutor-stub-boredom-action-register-proof-dag-study-go-request.v3.json';

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function fileSha256(relativePath) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(ROOT, relativePath)))
    .digest('hex');
}

test('v4 registration pins the validated Sol V3 instrument and keeps the powered design unchanged', () => {
  const registration = loadTutorStubBoredomProofDagRegistration({ root: ROOT, registrationPath: REGISTRATION });
  const validation = validateTutorStubBoredomProofDagRegistration(registration);
  assert.equal(validation.ok, true, validation.errors.join('; '));
  assert.equal(registration.version, 4);
  assert.equal(registration.design.observationSemantics, 'prospective_v9');
  const adjudicator = registration.measurement.semanticAdjudicator;
  assert.equal(adjudicator.schema, 'machinespirits.tutor-stub.boredom-semantic-adjudication.v3');
  assert.equal(adjudicator.modelRef, 'codex.gpt-5.6-sol');
  assert.equal(adjudicator.generatorSelfJudgmentAllowed, false);
  assert.equal(adjudicator.lexicalSilenceMayVetoSemanticPositive, false);
  assert.equal(adjudicator.modulePath, INSTRUMENT);
  assert.equal(adjudicator.moduleSha256, fileSha256(INSTRUMENT));
  assert.equal(adjudicator.heldoutCorpus.path, HELDOUT);
  assert.equal(adjudicator.heldoutCorpus.sha256, fileSha256(HELDOUT));
  assert.equal(adjudicator.heldoutCorpus.cases, 55);
  assert.equal(adjudicator.empiricalValidationStatus, 'passed_all_predeclared_gates_on_sealed_heldout_v4_corpus');
  assert.equal(adjudicator.confirmationLaunchReady, true);
  assert.equal(adjudicator.empiricalValidation.determinateSensitivity, 1);
  assert.equal(adjudicator.empiricalValidation.determinateSpecificity, 1);
  assert.equal(adjudicator.empiricalValidation.referenceAgreement, 1);
  assert.equal(adjudicator.empiricalValidation.ambiguousIndeterminateRate, 1);
  assert.equal(adjudicator.empiricalValidation.lowConfidenceIndeterminateRate, 1);
  assert.equal(adjudicator.empiricalValidation.reservationsUsed, 55);
  assert.equal(adjudicator.empiricalValidation.retries, 0);
  assert.equal(
    adjudicator.empiricalValidation.reportSha256,
    '7ff7810e28f7e037af12fbd852445efab9538bc1c946c529356a0c009a51763c',
  );
  assert.equal(registration.executionReadiness.dialogue.measurementIndeterminateRepairCalls, 0);
  assert.equal(registration.executionReadiness.dialogue.oneCumulativeFullLearnerRepairCalls, 0);
  assert.equal(registration.executionReadiness.hardStudyAttemptCeiling, 2160);
  const plan = buildTutorStubBoredomProofDagPlan(registration);
  assert.equal(plan.jobs.length, 36);
  assert.equal(plan.jobs.filter((row) => row.realization === 'plain').length, 18);
  assert.equal(plan.jobs.filter((row) => row.realization === 'warm').length, 18);
});

test('v4 endpoint and certificate pass at zero calls with launch authorization still pending', () => {
  const registration = readJson(REGISTRATION);
  const contract = readJson(CONTRACT);
  const certificate = readJson(CERTIFICATE);
  const preflight = runTutorStubBoredomProofDagEndpointPreflight({ contract, registration });
  assert.equal(preflight.model_calls, 0);
  assert.equal(preflight.production_writes, 0);
  assert.equal(
    preflight.readiness.status,
    'passed_zero_call_hold_empirical_semantic_validation_passed_launch_authorization_pending',
  );
  assert.equal(preflight.readiness.independent_semantic_adjudicator, 'codex.gpt-5.6-sol');
  assert.equal(
    preflight.readiness.empirical_semantic_validation_status,
    'passed_all_predeclared_gates_on_sealed_heldout_v4_corpus',
  );
  assert.equal(preflight.readiness.confirmation_launch_ready, true);
  assert.equal(preflight.assembly_audit.endpoint_status.independent_boredom_semantic_measurement, 'complete');
  assert.equal(contract.runner.batch_contract.programme_ledger_before, 446);
  assert.equal(contract.runner.batch_contract.combined_maximum_with_both_confirmations, 4766);
  assert.equal(hashPaidStudyEndpointValue(contract), certificate.contract_sha256);
  const validation = validatePaidStudyEndpointGoCertificate({ certificate, contract, preflight });
  assert.equal(validation.ok, true, validation.errors.join('; '));
  assert.match(certificate.authorization_scope, /authorizes no confirmation-model call/u);
  assert.match(certificate.launch_gate, /separately committed explicit human approval/u);
});

test('v4 instrument pins, gates, and repair prohibitions fail closed', () => {
  const registration = readJson(REGISTRATION);
  for (const mutate of [
    (row) => (row.measurement.semanticAdjudicator.modelRef = 'codex.gpt-5.6-luna'),
    (row) =>
      (row.measurement.semanticAdjudicator.schema = 'machinespirits.tutor-stub.boredom-semantic-adjudication.v1'),
    (row) => (row.measurement.semanticAdjudicator.moduleSha256 = '0'.repeat(64)),
    (row) => (row.measurement.semanticAdjudicator.heldoutCorpus.sha256 = '0'.repeat(64)),
    (row) => (row.measurement.semanticAdjudicator.empiricalValidationStatus = 'pending'),
    (row) => (row.measurement.semanticAdjudicator.confirmationLaunchReady = false),
    (row) => (row.measurement.semanticAdjudicator.empiricalValidation.determinateSensitivity = 0.9),
    (row) => (row.executionReadiness.dialogue.measurementIndeterminateRepairCalls = 1),
  ]) {
    const mutated = structuredClone(registration);
    mutate(mutated);
    assert.equal(validateTutorStubBoredomProofDagRegistration(mutated).ok, false);
  }
});

test('v4 synthetic rows carry determinate semantic measurement for every dialogue', () => {
  const registration = readJson(REGISTRATION);
  const cases = buildTutorStubBoredomProofDagSyntheticCases(registration);
  assert.equal(cases.length, 36);
  assert.ok(cases.every((row) => row.semantic_measurement.disposition === 'actionable_boredom'));
  assert.ok(cases.every((row) => row.semantic_measurement.independent_route_matches === true));
  assert.ok(cases.every((row) => row.semantic_measurement.evidence_spans_valid === true));
  assert.ok(cases.every((row) => row.semantic_measurement.indeterminate === false));
});

test('host adjudicator seam selects the factory from the registration schema and fails closed on drift', (t) => {
  const noRegistration = selectTutorStubBoredomSemanticAdjudicatorFactory({ args: {}, root: ROOT });
  assert.equal(noRegistration, createV1Adjudicator);
  const v4Factory = selectTutorStubBoredomSemanticAdjudicatorFactory({
    args: { 'boredom-proof-dag-registration': REGISTRATION },
    root: ROOT,
  });
  assert.equal(v4Factory, createV3Adjudicator);
  const v1Factory = selectTutorStubBoredomSemanticAdjudicatorFactory({
    args: {
      'boredom-proof-dag-registration': 'config/tutor-stub-boredom-action-register-proof-dag-registration.v2.json',
    },
    root: ROOT,
  });
  assert.equal(v1Factory, createV1Adjudicator);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'boredom-adjudicator-seam-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const unknownPath = path.join(temporary, 'unknown-schema-registration.json');
  fs.writeFileSync(
    unknownPath,
    `${JSON.stringify({ measurement: { semanticAdjudicator: { schema: 'machinespirits.tutor-stub.boredom-semantic-adjudication.v99' } } })}\n`,
  );
  assert.throws(
    () =>
      selectTutorStubBoredomSemanticAdjudicatorFactory({
        args: { 'boredom-proof-dag-registration': unknownPath },
        root: temporary,
      }),
    /unsupported boredom semantic adjudication schema/u,
  );
});

test('v4 registration, endpoint, certificate, instrument, corpus, and superseded HOLD bytes remain exact', () => {
  const expected = {
    [REGISTRATION]: '02b612a7b902dd0aa8eb644d733f6f3f350865e8bad2b068af695e7d0078a6b7',
    [CONTRACT]: 'dcf4eddf7eab0f8e2cacbf2f1f85f49b3958565b8ed93c450f3395f70dd291a4',
    [CERTIFICATE]: '68769dec56cee01c4aee5d0f396f9a25faa4b5cb6f175ac503df8b060a91a489',
    [INSTRUMENT]: 'ba4a692fd1310591072a52c600b91cdd796edfdc89f979e7843b41d7fa9ff191',
    [HELDOUT]: '5f65dd5dc3e193c9dc0368b4155a550bc9b5acd56de78e62704e35f750f50aa0',
    [SUPERSEDED_HOLD_REQUEST]: 'abda11e242d3d2cd67c0fe9f3e3c16a11cd59020e86e62ca2f9445e97508c08c',
  };
  for (const [relativePath, sha256] of Object.entries(expected)) {
    assert.equal(fileSha256(relativePath), sha256, relativePath);
  }
});
