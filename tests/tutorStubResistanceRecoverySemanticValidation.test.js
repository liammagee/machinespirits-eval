import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildTutorStubResistanceRecoverySemanticZeroCallFixture } from '../services/tutorStubResistanceRecoverySemanticAdjudication.js';
import {
  buildTutorStubResistanceRecoverySemanticBlindedValidationCases,
  loadTutorStubResistanceRecoverySemanticValidation,
  runTutorStubResistanceRecoverySemanticValidationPreflight,
  tutorStubResistanceRecoverySemanticOpaqueCaseId,
} from '../services/tutorStubResistanceRecoverySemanticValidation.js';
import {
  analyzeTutorStubResistanceRecoverySemanticValidation,
  buildTutorStubResistanceRecoverySemanticValidationPlan,
  runTutorStubResistanceRecoverySemanticValidation,
} from '../services/tutorStubResistanceRecoverySemanticValidationRuntime.js';
import { validatePaidStudyEndpointGoCertificate } from '../services/paidStudyEndpointPreflight.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const CONTRACT = 'config/paid-study-endpoints/tutor-stub-resistance-recovery-semantic-validation.v1.json';
const CERTIFICATE =
  'config/paid-study-endpoints/tutor-stub-resistance-recovery-semantic-validation.v1.endpoint-go.json';

function json(repoPath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, repoPath), 'utf8'));
}

test('outcome heldout is frozen, blinded, stratified, and zero-call endpoint wiring passes', () => {
  const loaded = loadTutorStubResistanceRecoverySemanticValidation();
  assert.equal(loaded.corpus.cases.length, 120);
  const blinded = buildTutorStubResistanceRecoverySemanticBlindedValidationCases(loaded.corpus.cases);
  assert.equal(blinded.length, 120);
  assert.equal(new Set(blinded.map((row) => row.case_id)).size, 120);
  const exposed = JSON.stringify(blinded);
  for (const row of loaded.corpus.cases) assert.equal(exposed.includes(row.case_id), false);
  assert.equal(exposed.includes('"expected"'), false);
  const contract = json(CONTRACT);
  const preflight = runTutorStubResistanceRecoverySemanticValidationPreflight({ contract });
  assert.equal(preflight.status, 'passed');
  assert.equal(preflight.model_calls, 0);
  assert.equal(preflight.production_writes, 0);
  assert.equal(
    preflight.outcome_semantic_validation_readiness_audit.live_accuracy_agreement_validity_and_coverage_gates,
    'pending_live_validation',
  );
  const certificate = validatePaidStudyEndpointGoCertificate({
    certificate: json(CERTIFICATE),
    contract,
    preflight,
  });
  assert.equal(certificate.ok, true, certificate.errors.join('; '));
});

test('outcome validation runtime seals exactly 120 opaque cases and analyzer joins gold only after seal', async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'outcome-semantic-validation-'));
  const destination = path.join(temporary, 'run');
  const archiveDir = path.join(temporary, 'archive');
  fs.mkdirSync(archiveDir);
  const loaded = loadTutorStubResistanceRecoverySemanticValidation();
  const sourceCommit = '1'.repeat(40);
  const sourceTree = '2'.repeat(40);
  const goRequestSha256 = '3'.repeat(64);
  const calls = [];
  try {
    const plan = buildTutorStubResistanceRecoverySemanticValidationPlan({
      sourceCommit,
      sourceTree,
      destination,
      goRequestPath: 'config/future-outcome-validation-request.json',
      goRequestSha256,
      loaded,
    });
    assert.equal(plan.cases.length, 120);
    assert.equal(JSON.stringify(plan).includes('ho-merits'), false);
    await runTutorStubResistanceRecoverySemanticValidation({
      destination,
      sourceCommit,
      sourceTree,
      goRequestPath: 'config/future-outcome-validation-request.json',
      goRequestSha256,
      sourceDirty: false,
      archiveDir,
      resolveModelRef: (modelRef) => {
        const judge = loaded.instrument.measurement.judges.find((row) => row.modelRef === modelRef);
        return { provider: judge.provider, model: judge.model };
      },
      callModel: async ({ provider, model }, _system, user, role, options) => {
        const prompt = JSON.parse(user);
        const source = loaded.corpus.cases.find(
          (row) => tutorStubResistanceRecoverySemanticOpaqueCaseId(row) === prompt.case_id,
        );
        const judge = loaded.instrument.measurement.judges.find((row) => row.id === prompt.judge.id);
        const fixture = buildTutorStubResistanceRecoverySemanticZeroCallFixture({
          corpusCase: { ...source, case_id: prompt.case_id },
          judge,
        });
        calls.push({ role, caseId: prompt.case_id });
        return {
          text: JSON.stringify(fixture.modelOutput),
          provider,
          model,
          effort: options.effort,
          structuredOutput: true,
          prohibitedToolEventCount: 0,
          modelAttestationBasis: judge.modelAttestationBasis,
          modelIndependentlyAttested: false,
        };
      },
    });
    assert.equal(calls.length, 240);
    const report = analyzeTutorStubResistanceRecoverySemanticValidation({
      destination,
      expectedSourceCommit: sourceCommit,
      expectedSourceTree: sourceTree,
      expectedGoRequestPath: 'config/future-outcome-validation-request.json',
      expectedGoRequestSha256: goRequestSha256,
      sourceDirty: false,
      archiveDir,
    });
    assert.equal(report.status, 'passed');
    assert.equal(report.score.metrics.raw_full_vector_interjudge_agreement, 1);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
