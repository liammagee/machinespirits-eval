import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildTutorStubResistanceSemanticBlindedValidationCases,
  buildTutorStubResistanceSemanticValidationPackets,
  loadTutorStubResistanceSemanticValidation,
  runTutorStubResistanceSemanticValidationPreflight,
  validateTutorStubResistanceSemanticValidationRegistration,
} from '../services/tutorStubResistanceSemanticValidation.js';
import {
  buildTutorStubResistanceSemanticBlindedValidationCasesV2,
  buildTutorStubResistanceSemanticValidationPacketsV2,
  loadTutorStubResistanceSemanticValidationV2,
  runTutorStubResistanceSemanticValidationPreflightV2,
  validateTutorStubResistanceSemanticValidationRegistrationV2,
} from '../services/tutorStubResistanceSemanticValidationV2.js';
import { validatePaidStudyEndpointGoCertificate } from '../services/paidStudyEndpointPreflight.js';
import { buildTutorStubResistanceActionRegisterConfirmationPlan } from '../services/tutorStubResistanceActionRegisterConfirmation.js';
import { loadTutorStubResistanceActionRegisterRegistration } from '../services/tutorStubResistanceActionRegisterStudy.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENDPOINT = 'config/paid-study-endpoints/tutor-stub-resistance-semantic-adjudication-validation.v1.json';
const CERTIFICATE =
  'config/paid-study-endpoints/tutor-stub-resistance-semantic-adjudication-validation.v1.endpoint-go.json';
const ENDPOINT_V2 = 'config/paid-study-endpoints/tutor-stub-resistance-semantic-adjudication-validation.v2.json';
const CERTIFICATE_V2 =
  'config/paid-study-endpoints/tutor-stub-resistance-semantic-adjudication-validation.v2.endpoint-go.json';
const sha256 = (repoPath) =>
  crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(ROOT, repoPath)))
    .digest('hex');

test('independent heldout is frozen, separated from development evidence, and absent from blind packets', () => {
  const loaded = loadTutorStubResistanceSemanticValidation();
  assert.equal(loaded.corpusSha256, '9378416d1fdf8dc41f35ad84a4edf69fba6ad8889ce5020617f3d19747c9a2c7');
  assert.deepEqual(loaded.counts, {
    frame_refuser: 40,
    frame_defiant_or_productive_dispute: 16,
    neither: 24,
  });
  const blindedCases = buildTutorStubResistanceSemanticBlindedValidationCases(loaded.corpus.cases);
  const packets = buildTutorStubResistanceSemanticValidationPackets(blindedCases);
  assert.equal(packets.length, 80);
  assert.equal(new Set(blindedCases.map((row) => row.case_id)).size, 80);
  assert.deepEqual(buildTutorStubResistanceSemanticBlindedValidationCases(loaded.corpus.cases), blindedCases);
  const executionJson = JSON.stringify({ blindedCases, packets });
  for (const corpusCase of loaded.corpus.cases) assert.ok(!executionJson.includes(corpusCase.case_id));
  for (const forbidden of ['"expected"', 'hb1-rf', 'hb1-neg']) {
    assert.ok(!executionJson.includes(forbidden), `blinded execution leaked ${forbidden}`);
  }
  assert.ok(blindedCases.every((row) => /^sv-[0-9a-f]{32}$/u.test(row.case_id)));
  assert.ok(packets.every((packet) => Object.keys(packet).sort().join(',') === 'case_ids,packet_id,prompts,schema'));
  assert.ok(packets.every((packet) => !JSON.stringify(packet).includes('expected')));
  assert.ok(
    packets.every((packet) =>
      Object.values(packet.prompts).every(
        (prompt) => prompt.independence.gold_labels_visible === false && prompt.expected === undefined,
      ),
    ),
  );
});

test('validation registration fails closed on governance, budget, no-selection, claim, and heldout collisions', () => {
  const loaded = loadTutorStubResistanceSemanticValidation();
  const developmentCorpus = JSON.parse(
    fs.readFileSync(path.join(ROOT, loaded.instrument.registration.instrument.developmentCorpusPath), 'utf8'),
  );
  const validate = (registration = loaded.registration, corpus = loaded.corpus) =>
    validateTutorStubResistanceSemanticValidationRegistration({
      registration,
      instrument: loaded.instrument,
      corpus,
      corpusSha256: loaded.corpusSha256,
      developmentCorpus,
    });
  assert.equal(validate().valid, true);
  for (const mutate of [
    (value) => (value.heldout.authorCommit = '0'.repeat(40)),
    (value) => (value.executionReadiness.futureStagedMaximumOnlyAfterBothValidationsPass = 4986),
    (value) => (value.executionPolicy.validCaseRerun = true),
    (value) => (value.authorization.standingArchitecturalCorrectionSha256 = '0'.repeat(64)),
    (value) => (value.claimBoundary.validationOutcomesExcludedFromConfirmation = false),
    (value) => (value.extra = true),
  ]) {
    const registration = structuredClone(loaded.registration);
    mutate(registration);
    assert.equal(validate(registration).valid, false);
  }
  for (const field of ['case_id', 'source']) {
    const corpus = structuredClone(loaded.corpus);
    corpus.cases[0][field] = structuredClone(developmentCorpus.cases[0][field]);
    assert.match(validate(loaded.registration, corpus).issues.join('; '), /collides with development/u);
  }
  {
    const corpus = structuredClone(loaded.corpus);
    corpus.cases[0].public_context[0].text = developmentCorpus.cases[0].public_context[0].text;
    assert.match(validate(loaded.registration, corpus).issues.join('; '), /collides with development/u);
  }
  for (const field of ['source', 'public_context']) {
    const corpus = structuredClone(loaded.corpus);
    if (field === 'source') corpus.cases[1].source = corpus.cases[0].source;
    else corpus.cases[1].public_context[0].text = corpus.cases[0].public_context[0].text;
    assert.match(validate(loaded.registration, corpus).issues.join('; '), /uniquely authored/u);
  }
});

test('validation endpoint preflight proves only zero-call wiring and retains pending live gates', () => {
  const contract = JSON.parse(fs.readFileSync(path.join(ROOT, ENDPOINT), 'utf8'));
  const certificate = JSON.parse(fs.readFileSync(path.join(ROOT, CERTIFICATE), 'utf8'));
  const preflight = runTutorStubResistanceSemanticValidationPreflight({ contract });
  const certificateValidation = validatePaidStudyEndpointGoCertificate({ certificate, contract, preflight });
  assert.equal(preflight.model_calls, 0);
  assert.equal(preflight.production_writes, 0);
  assert.equal(
    preflight.semantic_validation_readiness_audit.live_heldout_accuracy_agreement_and_coverage_gates,
    'pending_live_validation',
  );
  assert.match(preflight.semantic_validation_readiness_audit.status, /wiring_only_not_accuracy_evidence/u);
  assert.equal(certificateValidation.ok, true, certificateValidation.errors.join('; '));
  assert.equal(
    sha256('config/tutor-stub-resistance-semantic-adjudication-registration.v1.json'),
    'd479a556df2f61458546e9e1463dc11fa1261b74df91fe4b765d159c330f415d',
  );
  const drifted = structuredClone(contract);
  drifted.registration.registration_sha256 = '0'.repeat(64);
  assert.throws(
    () => runTutorStubResistanceSemanticValidationPreflight({ contract: drifted }),
    /endpoint registration, instrument, or heldout binding drifted/u,
  );
});

test('v2 independent heldout remains blind, collision-free, quote-only, and separately budgeted after failed v1', () => {
  const loaded = loadTutorStubResistanceSemanticValidationV2();
  assert.equal(loaded.corpusSha256, 'a52d10f60ceeeb9e1e92415c6add6d0dee4dbf69608053652ff9c23f08216535');
  assert.equal(
    loaded.registration.supersession.v1FailedReportSha256,
    '008230526809a6aa2917b240c6a30af644f30184b89042825773b1b8040c5c74',
  );
  assert.equal(loaded.registration.supersession.v1FailedArchiveCommit, 'cf92081bd566948f4ea26d0ac5e67f8132ebeef8');
  assert.equal(loaded.registration.executionReadiness.programmeLedgerBefore, 491);
  assert.equal(loaded.registration.executionReadiness.programmeLedgerAfterMaximum, 971);
  assert.equal(loaded.registration.executionReadiness.futureStagedMaximumOnlyAfterBothValidationsPass, 5147);
  assert.equal(loaded.registration.executionReadiness.ceilingAmendmentRequiredBeforeConfirmation, true);
  const cases = buildTutorStubResistanceSemanticBlindedValidationCasesV2(loaded.corpus.cases);
  const packets = buildTutorStubResistanceSemanticValidationPacketsV2(cases);
  assert.equal(cases.length, 80);
  assert.ok(cases.every((row) => /^sv2-[0-9a-f]{32}$/u.test(row.case_id)));
  assert.deepEqual(buildTutorStubResistanceSemanticBlindedValidationCasesV2(loaded.corpus.cases), cases);
  const executionJson = JSON.stringify({ cases, packets });
  for (const corpusCase of loaded.corpus.cases) assert.equal(executionJson.includes(corpusCase.case_id), false);
  assert.equal(executionJson.includes('"expected"'), false);
  assert.equal(executionJson.includes('evidence_spans'), false);
  assert.equal(executionJson.includes('Do not calculate or return numeric offsets'), true);

  const disclosedDevelopmentCorpora = [
    'config/tutor-stub-resistance-semantic-adjudication-development-corpus.v1.json',
    'config/tutor-stub-resistance-semantic-adjudication-heldout-corpus.v1.json',
  ].map((repoPath) => JSON.parse(fs.readFileSync(path.join(ROOT, repoPath), 'utf8')));
  const validate = (registration = loaded.registration, corpus = loaded.corpus) =>
    validateTutorStubResistanceSemanticValidationRegistrationV2({
      registration,
      instrument: loaded.instrument,
      corpus,
      corpusSha256: loaded.corpusSha256,
      disclosedDevelopmentCorpora,
    });
  assert.equal(validate().valid, true);
  for (const mutate of [
    (value) => (value.supersession.v1ObservedAccounting.invalidJudgments = 90),
    (value) => (value.supersession.v1FailedArchiveCommit = '0'.repeat(40)),
    (value) => (value.heldout.authorCommit = '0'.repeat(40)),
    (value) => (value.executionReadiness.programmeLedgerBefore = 331),
    (value) => (value.executionReadiness.ceilingAmendmentRequiredBeforeConfirmation = false),
    (value) => (value.executionPolicy.v1ValidationInputsOrOutputsReusable = true),
    (value) => (value.authorization.confirmationAuthorized = true),
  ]) {
    const changed = structuredClone(loaded.registration);
    mutate(changed);
    assert.equal(validate(changed).valid, false);
  }
  const collision = structuredClone(loaded.corpus);
  collision.cases[0].source = disclosedDevelopmentCorpora[1].cases[0].source;
  assert.match(validate(loaded.registration, collision).issues.join('; '), /collides with disclosed v1/u);
});

test('v2 validation endpoint certifies zero-call quote-normalization wiring with live gates pending', () => {
  const contract = JSON.parse(fs.readFileSync(path.join(ROOT, ENDPOINT_V2), 'utf8'));
  const certificate = JSON.parse(fs.readFileSync(path.join(ROOT, CERTIFICATE_V2), 'utf8'));
  const preflight = runTutorStubResistanceSemanticValidationPreflightV2({ contract });
  const validation = validatePaidStudyEndpointGoCertificate({ certificate, contract, preflight });
  assert.equal(validation.ok, true, validation.errors.join('; '));
  assert.equal(preflight.model_calls, 0);
  assert.equal(preflight.production_writes, 0);
  assert.equal(preflight.semantic_validation_readiness_audit.programme_ledger_before, 491);
  assert.equal(preflight.semantic_validation_readiness_audit.programme_ledger_after_maximum, 971);
  assert.equal(preflight.semantic_validation_readiness_audit.ceiling_amendment_required_before_confirmation, true);
  assert.equal(
    preflight.semantic_validation_readiness_audit.live_heldout_accuracy_agreement_and_coverage_gates,
    'pending_live_validation',
  );
});

test('V8 confirmation readiness is loadable but cannot become an executable confirmation before sealed validation', () => {
  const loaded = loadTutorStubResistanceActionRegisterRegistration(
    path.join(ROOT, 'config/tutor-stub-resistance-action-register-crossed-registration.v8.json'),
  );
  assert.equal(loaded.registration.version, 8);
  assert.equal(loaded.registration.semanticAdjudication.validationReportPath, null);
  assert.equal(loaded.registration.semanticAdjudication.validationReportSha256, null);
  assert.equal(loaded.registration.outcomeSemanticAdjudication.validationReportPath, null);
  assert.equal(
    loaded.registration.outcomeSemanticAdjudication.heldoutCorpusSha256,
    '16899134545d574203192ae2b1b6ff6671500fa24957f6d82015be5064c784c5',
  );
  assert.equal(loaded.registration.executionReadiness.combinedMaximumModelAttemptReservations, 3456);
  assert.equal(loaded.registration.executionReadiness.programmeLedgerAfterMaximum.reservedAttempts, 5147);
  assert.equal(loaded.registration.authorization.requiredCeilingAmendment.increase, 147);
  assert.equal(loaded.registration.semanticAdjudication.failedV1Validation.reused, false);
  assert.throws(
    () => buildTutorStubResistanceActionRegisterConfirmationPlan({ registration: loaded.registration }),
    /requires a registered V3, V4, V5, V6, or V7/u,
  );
  const registration = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, 'config/tutor-stub-resistance-action-register-crossed-registration.v8.json'),
      'utf8',
    ),
  );
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-v8-registration-'));
  try {
    for (const mutate of [
      (value) => (value.preservation.calibration.reportSha256 = '0'.repeat(64)),
      (value) => (value.preservation.stoppedConfirmationV1.reused = true),
      (value) => (value.preservation.stoppedConfirmationV3.traceSha256.s1 = '0'.repeat(64)),
      (value) => (value.preservation.stoppedConfirmationV4.pooled = true),
      (value) => (value.preservation.stoppedConfirmationV7.traceSha256.s2 = '0'.repeat(64)),
      (value) => (value.semanticAdjudication.validationReportPath = 'results/forged.json'),
      (value) => (value.semanticAdjudication.failedV1Validation.rescored = true),
      (value) => (value.outcomeSemanticAdjudication.instrumentRegistrationSha256 = '0'.repeat(64)),
      (value) => (value.outcomeSemanticAdjudication.validationReportPath = 'results/forged-outcome.json'),
      (value) => (value.authorization.requiredBeforeValidationModelCalls[0] = 'circular or drifted'),
      (value) => (value.authorization.requiredBeforeConfirmationModelCalls = []),
      (value) => (value.executionReadiness.stagedValidationBudget.outcomeValidationHardReservations = 719),
      (value) => (value.authorization.requiredCeilingAmendment.authorized = true),
      (value) => (value.executionReadiness.programmeLedgerAfterMaximum.role = 'observed'),
    ]) {
      const changed = structuredClone(registration);
      mutate(changed);
      const file = path.join(temporary, `${crypto.randomUUID()}.json`);
      fs.writeFileSync(file, `${JSON.stringify(changed, null, 2)}\n`);
      assert.throws(() => loadTutorStubResistanceActionRegisterRegistration(file), /v8 semantic confirmation/u);
    }
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
