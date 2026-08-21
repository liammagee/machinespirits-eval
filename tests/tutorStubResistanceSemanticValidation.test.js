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
import { validatePaidStudyEndpointGoCertificate } from '../services/paidStudyEndpointPreflight.js';
import { buildTutorStubResistanceActionRegisterConfirmationPlan } from '../services/tutorStubResistanceActionRegisterConfirmation.js';
import { loadTutorStubResistanceActionRegisterRegistration } from '../services/tutorStubResistanceActionRegisterStudy.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENDPOINT = 'config/paid-study-endpoints/tutor-stub-resistance-semantic-adjudication-validation.v1.json';
const CERTIFICATE =
  'config/paid-study-endpoints/tutor-stub-resistance-semantic-adjudication-validation.v1.endpoint-go.json';
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
    (value) => (value.executionReadiness.futureConfirmationMaximumOnlyAfterValidationPass = 4050),
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
    '3ca5c34fefe5aa2eca1f2e49cd6ca59d64261cadd505de26f508fbfe650b926a',
  );
});

test('V8 confirmation readiness is loadable but cannot become an executable confirmation before sealed validation', () => {
  const loaded = loadTutorStubResistanceActionRegisterRegistration(
    path.join(ROOT, 'config/tutor-stub-resistance-action-register-crossed-registration.v8.json'),
  );
  assert.equal(loaded.registration.version, 8);
  assert.equal(loaded.registration.semanticAdjudication.validationReportPath, null);
  assert.equal(loaded.registration.semanticAdjudication.validationReportSha256, null);
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
      (value) => (value.semanticAdjudication.validationReportPath = 'results/forged.json'),
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
