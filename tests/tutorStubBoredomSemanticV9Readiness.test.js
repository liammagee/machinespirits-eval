import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  assessTutorStubBoredomSemanticSyntheticCases,
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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRATION = 'config/tutor-stub-boredom-action-register-proof-dag-registration.v3.json';
const CONTRACT = 'config/paid-study-endpoints/tutor-stub-boredom-action-register-proof-dag.v3.json';
const CERTIFICATE = 'config/paid-study-endpoints/tutor-stub-boredom-action-register-proof-dag.v3.endpoint-go.json';
const HELDOUT = 'config/tutor-stub-boredom-semantic-adjudication-heldout.v1.json';

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function fileSha256(relativePath) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(ROOT, relativePath)))
    .digest('hex');
}

test('prospective-v9 registration binds the independent semantic seat and preserves the powered design', () => {
  const registration = loadTutorStubBoredomProofDagRegistration({ root: ROOT, registrationPath: REGISTRATION });
  const validation = validateTutorStubBoredomProofDagRegistration(registration);
  assert.equal(validation.ok, true, validation.errors.join('; '));
  assert.equal(registration.design.observationSemantics, 'prospective_v9');
  assert.equal(registration.measurement.semanticAdjudicator.modelRef, 'codex.gpt-5.6-sol');
  assert.equal(registration.measurement.semanticAdjudicator.independentFromGeneratingModel, true);
  assert.equal(registration.measurement.semanticAdjudicator.generatorSelfJudgmentAllowed, false);
  assert.equal(
    registration.measurement.semanticAdjudicator.regexRole,
    'auxiliary_high_precision_signal_and_disagreement_only_never_final_semantic_authority',
  );
  assert.equal(registration.measurement.semanticAdjudicator.lexicalSilenceMayVetoSemanticPositive, false);
  assert.equal(
    registration.measurement.semanticAdjudicator.empiricalValidationStatus,
    'pending_no_model_calls_authorized_by_this_registration',
  );
  assert.equal(registration.measurement.semanticAdjudicator.confirmationLaunchReady, false);
  assert.equal(registration.executionReadiness.dialogue.maximumIndependentSemanticAdjudicationCalls, 2);
  assert.equal(registration.executionReadiness.dialogue.oneCumulativeFullLearnerRepairCalls, 0);
  assert.equal(registration.executionReadiness.dialogue.plannedCallsPerDialogue, 20);
  assert.equal(registration.executionReadiness.dialogue.maximumReservationsPerDialogue, 60);
  assert.equal(registration.executionReadiness.hardStudyAttemptCeiling, 2160);
  const plan = buildTutorStubBoredomProofDagPlan(registration);
  assert.equal(plan.jobs.length, 36);
  assert.equal(plan.jobs.filter((row) => row.realization === 'plain').length, 18);
  assert.equal(plan.jobs.filter((row) => row.realization === 'warm').length, 18);
});

test('zero-call semantic wrapper assessment covers the sealed unseen corpus and predeclared gates', () => {
  const assessment = assessTutorStubBoredomSemanticSyntheticCases({ corpusPath: HELDOUT });
  assert.equal(assessment.cases, 22);
  assert.equal(assessment.pass, true);
  assert.equal(assessment.metrics.determinate_sensitivity, 1);
  assert.equal(assessment.metrics.determinate_specificity, 1);
  assert.equal(assessment.metrics.reference_agreement, 1);
  assert.equal(assessment.metrics.ambiguous_indeterminate_rate, 1);
  assert.equal(assessment.metrics.low_confidence_indeterminate_rate, 1);
  assert.equal(assessment.empirical_model_predictions_present, false);
  assert.equal(assessment.empirical_model_validation_required_before_confirmation_launch, true);
});

test('prospective-v9 endpoint and certificate pass at zero calls while retaining the empirical HOLD', () => {
  const registration = readJson(REGISTRATION);
  const contract = readJson(CONTRACT);
  const certificate = readJson(CERTIFICATE);
  const preflight = runTutorStubBoredomProofDagEndpointPreflight({ contract, registration });
  assert.equal(preflight.model_calls, 0);
  assert.equal(preflight.production_writes, 0);
  assert.equal(preflight.readiness.status, 'passed_zero_call_hold_empirical_semantic_validation_pending');
  assert.equal(preflight.readiness.independent_semantic_adjudicator, 'codex.gpt-5.6-sol');
  assert.equal(preflight.readiness.confirmation_launch_ready, false);
  assert.equal(preflight.assembly_audit.endpoint_status.independent_boredom_semantic_measurement, 'complete');
  assert.equal(hashPaidStudyEndpointValue(contract), certificate.contract_sha256);
  const validation = validatePaidStudyEndpointGoCertificate({ certificate, contract, preflight });
  assert.equal(validation.ok, true, validation.errors.join('; '));
  assert.match(certificate.authorization_scope, /authorizes no semantic-model validation call/u);
});

test('semantic route, authority, corpus, and indeterminacy drift fail closed', () => {
  const registration = readJson(REGISTRATION);
  for (const mutate of [
    (row) => (row.measurement.semanticAdjudicator.modelRef = 'codex.gpt-5.6-luna'),
    (row) => (row.measurement.semanticAdjudicator.regexRole = 'final_authority'),
    (row) => (row.measurement.semanticAdjudicator.lexicalSilenceMayVetoSemanticPositive = true),
    (row) => (row.measurement.semanticAdjudicator.heldoutCorpus.sha256 = '0'.repeat(64)),
    (row) => (row.measurement.semanticAdjudicator.confirmationLaunchReady = true),
    (row) => (row.executionReadiness.dialogue.measurementIndeterminateRepairCalls = 1),
  ]) {
    const mutated = structuredClone(registration);
    mutate(mutated);
    assert.equal(validateTutorStubBoredomProofDagRegistration(mutated).ok, false);
  }
});

test('prospective-v9 synthetic rows bind determinate semantic measurement without changing outcomes', () => {
  const registration = readJson(REGISTRATION);
  const cases = buildTutorStubBoredomProofDagSyntheticCases(registration);
  assert.equal(cases.length, 36);
  assert.ok(cases.every((row) => row.semantic_measurement.disposition === 'actionable_boredom'));
  assert.ok(cases.every((row) => row.semantic_measurement.independent_route_matches === true));
  assert.ok(cases.every((row) => row.semantic_measurement.evidence_spans_valid === true));
  assert.ok(cases.every((row) => row.semantic_measurement.indeterminate === false));
});

test('sealed observer and certificate bytes remain exact', () => {
  // Only sealed inputs keep a byte pin (CLAUDE.md, 2026-08-21). The registrations,
  // the endpoint contracts and the go requests were pinned here too; a one-line
  // correction to any of them turned this test red and pushed the next agent to
  // write a numbered copy instead of editing in place.
  const expected = {
    'config/paid-study-endpoints/tutor-stub-boredom-action-register-proof-dag.v1.endpoint-go.json':
      '702e3fd849c3664d3edcc95dd63b4fbc3138cfa21121b96090b586095acb6899',
    'config/paid-study-endpoints/tutor-stub-boredom-action-register-proof-dag.v2.endpoint-go.json':
      '24bd1ee6ed2b34c472e96b28b02eb9aaffded17b6762993913c354101e2cfb54',
  };
  for (const [relativePath, sha256] of Object.entries(expected)) {
    assert.equal(fileSha256(relativePath), sha256, relativePath);
  }
  assert.equal(fileSha256(HELDOUT), 'ad61f7b104c8202889c9f9eb00090a900aafea5d5bf55d7e3b89cf41db300f93');
  assert.equal(fileSha256(CERTIFICATE), '6eb6c6529af429cd01ef5755357d6289b5eef32b1b7b4158e0920d663fc62880');
  // The registration and the endpoint contract are read, not pinned.
  assert.match(fileSha256(REGISTRATION), /^[0-9a-f]{64}$/u);
  assert.match(fileSha256(CONTRACT), /^[0-9a-f]{64}$/u);
});
