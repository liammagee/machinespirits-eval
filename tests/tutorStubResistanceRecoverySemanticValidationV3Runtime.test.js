import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildTutorStubResistanceRecoverySemanticZeroCallFixture } from '../services/tutorStubResistanceRecoverySemanticAdjudicationV2.js';
import { tutorStubResistanceRecoverySemanticOpaqueCaseId } from '../services/tutorStubResistanceRecoverySemanticValidation.js';
import {
  analyzeTutorStubResistanceRecoverySemanticValidation,
  buildTutorStubResistanceRecoverySemanticValidationPlan,
  runTutorStubResistanceRecoverySemanticValidation,
} from '../services/tutorStubResistanceRecoverySemanticValidationRuntime.js';
import {
  TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_REGISTRATION_V3,
  loadTutorStubResistanceRecoverySemanticValidationV3,
} from '../services/tutorStubResistanceRecoverySemanticValidationV3.js';

const SOURCE_COMMIT = '6'.repeat(40);
const SOURCE_TREE = '7'.repeat(40);
const GO_REQUEST_PATH = 'config/future-resistance-outcome-semantic-v3-go-request.json';
const GO_REQUEST_SHA256 = '8'.repeat(64);

function responseFreeError() {
  return Object.assign(new Error('response free'), {
    code: 'CLI_PROVIDER_RESPONSE_FREE_ERROR',
    provider: 'claude-code',
    classification: 'response_free_error',
    responseFree: true,
    exitCode: 1,
    stdoutBytes: 165,
    stderrBytes: 0,
    stdoutSha256: '9'.repeat(64),
    stderrSha256: 'a'.repeat(64),
  });
}

function sourceCase(loaded, executionId) {
  return loaded.corpus.cases.find((row) => tutorStubResistanceRecoverySemanticOpaqueCaseId(row) === executionId);
}

function fixtureCaller(loaded, exhaustedOriginalCaseId) {
  return async ({ provider, model }, _system, userPrompt, role, options) => {
    const prompt = JSON.parse(userPrompt);
    const corpusCase = sourceCase(loaded, prompt.case_id);
    const judge = loaded.instrument.measurement.judges.find(
      (candidate) => role === `tutor_stub_resistance_recovery_semantic_${candidate.id}`,
    );
    assert.ok(corpusCase);
    assert.ok(judge);
    assert.equal(provider, judge.provider);
    assert.equal(model, judge.model);
    assert.equal(options.effort, 'low');
    if (judge.id === 'recovery_semantic_judge_b' && corpusCase.case_id === exhaustedOriginalCaseId) {
      throw responseFreeError();
    }
    const fixture = buildTutorStubResistanceRecoverySemanticZeroCallFixture({
      corpusCase: { ...corpusCase, case_id: prompt.case_id },
      judge,
    });
    return {
      text: JSON.stringify(fixture.modelOutput),
      provider: judge.provider,
      model: judge.model,
      effort: judge.effort,
      structuredOutput: true,
      prohibitedToolEventCount: 0,
      modelAttestationBasis: judge.modelAttestationBasis,
      modelIndependentlyAttested: false,
    };
  };
}

function routeResolver(loaded) {
  return (modelRef) => {
    const judge = loaded.instrument.measurement.judges.find((candidate) => candidate.modelRef === modelRef);
    assert.ok(judge);
    return { provider: judge.provider, model: judge.model };
  };
}

function goRequest(loaded, destination) {
  const readiness = loaded.registration.executionReadiness;
  return {
    schema: 'machinespirits.tutor-stub.resistance-recovery-semantic-adjudication-validation-study-go-request.v3',
    status: 'go_under_standing_user_authority',
    authorization: { confirmationAuthorized: false },
    source: {
      launchCommit: SOURCE_COMMIT,
      launchTree: SOURCE_TREE,
      headMustEqualLaunchCommit: true,
      checkoutMustBeClean: true,
      detachedLaunchWorktree: true,
    },
    outcomeSemanticAdjudicationValidation: {
      validationRegistration: { path: loaded.registrationPath, sha256: loaded.registrationSha256 },
      instrumentRegistration: { path: loaded.instrumentPath, sha256: loaded.instrumentSha256 },
      heldoutCorpus: {
        path: loaded.registration.heldout.corpusPath,
        sha256: loaded.corpusSha256,
        cases: 120,
      },
      judges: loaded.instrument.measurement.judges.map((judge) => judge.modelRef),
      primaryRule: 'two_of_three_valid_high_confidence_final_recovery_votes',
      componentRule: 'two_of_three_valid_high_confidence_field_values_independently',
      componentDisagreementMayVetoPrimary: false,
      invalidLowConfidenceMissingOrResponseFreeDisposition: 'judge_abstention',
      regexOrKeywordAuthority: 'none',
      noInterimAnalysis: true,
    },
    budget: {
      plannedCases: readiness.plannedCases,
      plannedModelCalls: readiness.plannedModelCalls,
      maximumReservationsPerPlannedCall: readiness.maximumReservationsPerPlannedCall,
      maximumPlannedModelAttempts: readiness.hardValidationReservations,
      programmeLedgerBefore: readiness.programmeLedgerBefore,
      programmeLedgerAfterMaximum: readiness.programmeMaximumAfterValidation,
      programmeCeiling: readiness.programmeCeiling,
      retryOrResumeAuthority: 'bounded_technical_recovery',
    },
    destination: { artifactRoot: destination, createOnce: true, mustNotExistBeforeLaunch: true },
    claimBoundary: {
      validationOnly: true,
      validationOutcomesExcludedFromConfirmation: true,
      confirmationCallsAuthorized: false,
    },
  };
}

test('v3 outcome plan binds 120 opaque cases, three seats, and the 1080-reservation safeguard', () => {
  const loaded = loadTutorStubResistanceRecoverySemanticValidationV3();
  const destination = path.join(os.tmpdir(), 'future-resistance-outcome-semantic-v3');
  const plan = buildTutorStubResistanceRecoverySemanticValidationPlan({
    sourceCommit: SOURCE_COMMIT,
    sourceTree: SOURCE_TREE,
    destination,
    goRequestPath: GO_REQUEST_PATH,
    goRequestSha256: GO_REQUEST_SHA256,
    goRequest: goRequest(loaded, destination),
    loaded,
  });
  assert.equal(plan.cases.length, 120);
  assert.equal(plan.judges.length, 3);
  assert.equal(plan.budget.planned_calls, 360);
  assert.equal(plan.budget.hard_reservation_ceiling, 1080);
  assert.equal(plan.budget.programme_ledger_before, 1136);
  assert.equal(plan.budget.programme_maximum_after_validation, 2216);
  assert.equal(JSON.stringify(plan).includes('"expected"'), false);
});

test('v3 outcome runtime continues after one exhausted response-free seat and seals the remaining majority', async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'resistance-outcome-semantic-v3-runtime-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const destination = path.join(temporary, 'run');
  const archiveDir = path.join(temporary, 'archive');
  fs.mkdirSync(archiveDir);
  const loaded = loadTutorStubResistanceRecoverySemanticValidationV3();
  const exhaustedOriginalCaseId = loaded.corpus.cases[0].case_id;
  const request = goRequest(loaded, destination);
  const result = await runTutorStubResistanceRecoverySemanticValidation({
    destination,
    sourceCommit: SOURCE_COMMIT,
    sourceTree: SOURCE_TREE,
    goRequestPath: GO_REQUEST_PATH,
    goRequestSha256: GO_REQUEST_SHA256,
    goRequest: request,
    sourceDirty: false,
    archiveDir,
    validationRegistration: TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_REGISTRATION_V3,
    waitForRetry: async () => {},
    callModel: fixtureCaller(loaded, exhaustedOriginalCaseId),
    resolveModelRef: routeResolver(loaded),
  });
  assert.equal(result.seal.cases, 120);
  assert.equal(result.seal.judge_results, 360);
  assert.equal(result.seal.reservations, 362);

  const executionId = tutorStubResistanceRecoverySemanticOpaqueCaseId(loaded.corpus.cases[0]);
  const checkpoint = JSON.parse(
    fs.readFileSync(path.join(destination, 'cases', executionId, 'checkpoint.json'), 'utf8'),
  );
  assert.equal(checkpoint.judge_results.length, 3);
  assert.equal(checkpoint.judge_results[1].outcome, 'transport_failed');
  assert.equal(checkpoint.judge_results[2].outcome, 'recorded_response');
  assert.equal(checkpoint.aggregate.status, 'determinate');
  assert.equal(checkpoint.aggregate.primary_recovery_measurement.supporting_judges.length, 2);

  const report = analyzeTutorStubResistanceRecoverySemanticValidation({
    destination,
    expectedSourceCommit: SOURCE_COMMIT,
    expectedSourceTree: SOURCE_TREE,
    expectedGoRequestPath: GO_REQUEST_PATH,
    expectedGoRequestSha256: GO_REQUEST_SHA256,
    expectedGoRequest: request,
    sourceDirty: false,
    archiveDir,
    validationRegistration: TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_REGISTRATION_V3,
  });
  assert.equal(report.status, 'passed');
  assert.equal(report.score.metrics.primary_exact_accuracy, 1);
  assert.equal(report.score.metrics.primary_determined_coverage_overall, 1);
  assert.equal(report.score.metrics.abstaining_judgments, 1);
  assert.equal(report.score.metrics.judgment_validity_rate, 359 / 360);
});
