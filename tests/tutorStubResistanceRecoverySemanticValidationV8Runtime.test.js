import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  TUTOR_STUB_RESISTANCE_FIDELITY_MODEL_SCHEMA_V8,
  TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_MODEL_SCHEMA_V8,
  buildTutorStubResistanceMeasurementZeroCallFixtureV8,
} from '../services/tutorStubResistanceRecoverySemanticAdjudicationV8.js';
import { tutorStubResistanceRecoverySemanticOpaqueCaseId } from '../services/tutorStubResistanceRecoverySemanticValidation.js';
import {
  analyzeTutorStubResistanceRecoverySemanticValidation,
  buildTutorStubResistanceRecoverySemanticValidationPlan,
  runTutorStubResistanceRecoverySemanticValidation,
} from '../services/tutorStubResistanceSplitMeasurementValidationRuntime.js';
import { writeTutorStubResistanceMeasurementCombinedValidationReportV8 } from '../services/tutorStubResistanceMeasurementValidationV8Runtime.js';
import {
  TUTOR_STUB_RESISTANCE_FIDELITY_VALIDATION_REGISTRATION_V8,
  TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_VALIDATION_REGISTRATION_V8,
  loadTutorStubResistanceMeasurementValidationV8,
} from '../services/tutorStubResistanceRecoverySemanticValidationV8.js';

const SOURCE_COMMIT = 'b'.repeat(40);
const SOURCE_TREE = 'c'.repeat(40);
const GO_REQUEST_PATH = 'config/future-resistance-measurement-v8-go-request.json';
const GO_REQUEST_SHA256 = 'd'.repeat(64);

function sourceCase(loaded, executionId) {
  return loaded.corpus.cases.find((row) => tutorStubResistanceRecoverySemanticOpaqueCaseId(row) === executionId);
}

function responseFreeError() {
  const stdoutText = '[{"type":"result","is_error":true,"result":"overloaded"}]';
  const stderrText = '';
  return Object.assign(new Error('response free'), {
    code: 'CLI_PROVIDER_RESPONSE_FREE_ERROR',
    provider: 'claude-code',
    classification: 'response_free_error',
    reason: 'provider_overloaded',
    responseFree: true,
    exitCode: 1,
    stdoutBytes: Buffer.byteLength(stdoutText),
    stderrBytes: Buffer.byteLength(stderrText),
    stdoutSha256: crypto.createHash('sha256').update(stdoutText).digest('hex'),
    stderrSha256: crypto.createHash('sha256').update(stderrText).digest('hex'),
    stdoutText,
    stderrText,
    stdoutTextTruncated: false,
    stderrTextTruncated: false,
  });
}

function fixtureCaller(loaded, exhaustedOriginalCaseId = null) {
  return async ({ provider, model }, _system, userPrompt, role, options) => {
    const prompt = JSON.parse(userPrompt);
    const corpusCase = sourceCase(loaded, prompt.case_id);
    const judge = loaded.instrument.measurement.judges.find(
      (candidate) => role === `tutor_stub_resistance_${loaded.stage}_${candidate.id}`,
    );
    assert.ok(corpusCase);
    assert.ok(judge);
    assert.equal(provider, judge.provider);
    assert.equal(model, judge.model);
    assert.equal(options.effort, 'low');
    if (judge.id === 'recovery_semantic_judge_b' && corpusCase.case_id === exhaustedOriginalCaseId) {
      throw responseFreeError();
    }
    const fixture = buildTutorStubResistanceMeasurementZeroCallFixtureV8({
      corpusCase: { ...corpusCase, case_id: prompt.case_id },
      judge,
      instrument: loaded.stage,
    });
    const modelSchema =
      loaded.stage === 'primary_recovery'
        ? TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_MODEL_SCHEMA_V8
        : TUTOR_STUB_RESISTANCE_FIDELITY_MODEL_SCHEMA_V8;
    assert.deepEqual(options.outputSchema.properties.schema.enum, [modelSchema]);
    return {
      text: JSON.stringify({ schema: modelSchema, case_id: prompt.case_id, judgment: fixture.response.judgment }),
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

function goRequest(primary, fidelity, destinations) {
  const stage = (loaded, destination) => ({
    registration: { path: loaded.registrationPath, sha256: loaded.registrationSha256 },
    destination,
    plannedCalls: 360,
    hardReservations: 1080,
    createOnce: true,
  });
  return {
    schema: 'machinespirits.tutor-stub.resistance-measurement-validation-study-go-request.v8',
    status: 'go_under_standing_user_authority',
    source: {
      launchCommit: SOURCE_COMMIT,
      launchTree: SOURCE_TREE,
      headMustEqualLaunchCommit: true,
      checkoutMustBeClean: true,
      detachedLaunchWorktree: true,
    },
    measurementValidation: {
      instrumentRegistration: { path: primary.instrumentPath, sha256: primary.instrumentSha256 },
      heldoutCorpus: { path: primary.corpusPath, sha256: primary.corpusSha256, cases: 120 },
      judges: primary.instrument.measurement.judges.map((judge) => judge.modelRef),
      primaryAndFidelityCallsSeparate: true,
      fidelityLearnerOutcomeVisible: false,
      regexKeywordOrGeneratorAuthority: 'none',
      mediumOrHighDeterminateVotesEligible: true,
      fieldLocalEligibility: true,
      modelReturnsFinalRecovery: false,
      stagesRunSequentially: true,
      responseFreeRetryDelaysMs: [15000, 45000],
      failureDiagnosticsPersistedToAttemptRecord: true,
      indeterminateRepairRerunReplacementOrSelection: false,
      analysisOnlyAfterBothStagesSeal: true,
      stages: {
        primary_recovery: stage(primary, destinations.primary),
        intervention_fidelity: stage(fidelity, destinations.fidelity),
      },
    },
    budget: {
      plannedCalls: 720,
      hardValidationReservations: 2160,
      programmeLedgerBefore: 3027,
      programmeMaximumAfterValidation: 5187,
      programmeCeiling: 10000,
      attemptCountsRole: 'operational_safeguard_only_not_design_objective',
    },
    authorization: {
      validationModelCallsAuthorized: true,
      confirmationModelCallsAuthorized: false,
      boundedTechnicalRecovery: 'response_free_missing_or_failed_units_only_no_semantic_recall',
    },
    claimBoundary: {
      validationOnly: true,
      validationOutcomesExcludedFromConfirmation: true,
      noEfficacyNullLearningTransferHumanOrCellClaim: true,
    },
  };
}

test('V8 plans bind the fresh split instrument, corpus, transport, and operational safeguard', () => {
  const primary = loadTutorStubResistanceMeasurementValidationV8(
    TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_VALIDATION_REGISTRATION_V8,
  );
  const fidelity = loadTutorStubResistanceMeasurementValidationV8(
    TUTOR_STUB_RESISTANCE_FIDELITY_VALIDATION_REGISTRATION_V8,
  );
  const destinations = { primary: '/tmp/v8-primary', fidelity: '/tmp/v8-fidelity' };
  const request = goRequest(primary, fidelity, destinations);
  for (const [loaded, destination] of [
    [primary, destinations.primary],
    [fidelity, destinations.fidelity],
  ]) {
    const plan = buildTutorStubResistanceRecoverySemanticValidationPlan({
      sourceCommit: SOURCE_COMMIT,
      sourceTree: SOURCE_TREE,
      destination,
      goRequestPath: GO_REQUEST_PATH,
      goRequestSha256: GO_REQUEST_SHA256,
      goRequest: request,
      loaded,
    });
    assert.equal(plan.measurement_stage, loaded.stage);
    assert.equal(plan.cases.length, 120);
    assert.equal(plan.judges.length, 3);
    assert.equal(plan.budget.hard_reservation_ceiling, 1080);
    assert.equal(plan.budget.programme_ceiling, 10000);
    assert.equal(JSON.stringify(plan).includes('"expected"'), false);
    if (loaded.stage === 'intervention_fidelity') {
      assert.equal(JSON.stringify(plan).includes('current_learner'), false);
    }
  }
});

test('V8 enforces sequential stages and preserves capped provider diagnostics in immutable attempts', async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'resistance-measurement-v8-runtime-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const destinations = {
    primary: path.join(temporary, 'primary'),
    fidelity: path.join(temporary, 'fidelity'),
    combined: path.join(temporary, 'combined'),
  };
  const archiveDir = path.join(temporary, 'archive');
  fs.mkdirSync(archiveDir);
  const primary = loadTutorStubResistanceMeasurementValidationV8(
    TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_VALIDATION_REGISTRATION_V8,
  );
  const fidelity = loadTutorStubResistanceMeasurementValidationV8(
    TUTOR_STUB_RESISTANCE_FIDELITY_VALIDATION_REGISTRATION_V8,
  );
  const request = goRequest(primary, fidelity, destinations);
  await assert.rejects(
    runTutorStubResistanceRecoverySemanticValidation({
      destination: destinations.fidelity,
      sourceCommit: SOURCE_COMMIT,
      sourceTree: SOURCE_TREE,
      goRequestPath: GO_REQUEST_PATH,
      goRequestSha256: GO_REQUEST_SHA256,
      goRequest: request,
      sourceDirty: false,
      archiveDir,
      validationRegistration: TUTOR_STUB_RESISTANCE_FIDELITY_VALIDATION_REGISTRATION_V8,
      callModel: fixtureCaller(fidelity),
      resolveModelRef: routeResolver(fidelity),
    }),
    /cannot launch before the primary stage seals/u,
  );
  const observedDelays = [];
  const primaryRun = await runTutorStubResistanceRecoverySemanticValidation({
    destination: destinations.primary,
    sourceCommit: SOURCE_COMMIT,
    sourceTree: SOURCE_TREE,
    goRequestPath: GO_REQUEST_PATH,
    goRequestSha256: GO_REQUEST_SHA256,
    goRequest: request,
    sourceDirty: false,
    archiveDir,
    validationRegistration: TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_VALIDATION_REGISTRATION_V8,
    waitForRetry: async (delay) => observedDelays.push(delay),
    callModel: fixtureCaller(primary, primary.corpus.cases[0].case_id),
    resolveModelRef: routeResolver(primary),
  });
  assert.equal(primaryRun.seal.judge_results, 360);
  assert.equal(primaryRun.seal.reservations, 362);
  assert.deepEqual(observedDelays, [15000, 45000]);
  const failedCaseId = tutorStubResistanceRecoverySemanticOpaqueCaseId(primary.corpus.cases[0]);
  const failedCheckpoint = JSON.parse(
    fs.readFileSync(path.join(destinations.primary, 'cases', failedCaseId, 'checkpoint.json'), 'utf8'),
  );
  const failedAttempts = failedCheckpoint.attempts_by_judge.recovery_semantic_judge_b;
  assert.equal(failedAttempts.length, 3);
  assert.equal(failedAttempts[0].stdout_text.includes('overloaded'), true);
  assert.equal(failedAttempts[0].stdout_bytes, Buffer.byteLength(failedAttempts[0].stdout_text));
  assert.equal(failedAttempts[0].stdout_text_truncated, false);

  const fidelityRun = await runTutorStubResistanceRecoverySemanticValidation({
    destination: destinations.fidelity,
    sourceCommit: SOURCE_COMMIT,
    sourceTree: SOURCE_TREE,
    goRequestPath: GO_REQUEST_PATH,
    goRequestSha256: GO_REQUEST_SHA256,
    goRequest: request,
    sourceDirty: false,
    archiveDir,
    validationRegistration: TUTOR_STUB_RESISTANCE_FIDELITY_VALIDATION_REGISTRATION_V8,
    waitForRetry: async () => {},
    callModel: fixtureCaller(fidelity),
    resolveModelRef: routeResolver(fidelity),
  });
  assert.equal(fidelityRun.seal.judge_results, 360);
  assert.equal(fidelityRun.seal.reservations, 360);

  const primaryReport = analyzeTutorStubResistanceRecoverySemanticValidation({
    destination: destinations.primary,
    expectedSourceCommit: SOURCE_COMMIT,
    expectedSourceTree: SOURCE_TREE,
    expectedGoRequestPath: GO_REQUEST_PATH,
    expectedGoRequestSha256: GO_REQUEST_SHA256,
    expectedGoRequest: request,
    sourceDirty: false,
    archiveDir,
    validationRegistration: TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_VALIDATION_REGISTRATION_V8,
  });
  const fidelityReport = analyzeTutorStubResistanceRecoverySemanticValidation({
    destination: destinations.fidelity,
    expectedSourceCommit: SOURCE_COMMIT,
    expectedSourceTree: SOURCE_TREE,
    expectedGoRequestPath: GO_REQUEST_PATH,
    expectedGoRequestSha256: GO_REQUEST_SHA256,
    expectedGoRequest: request,
    sourceDirty: false,
    archiveDir,
    validationRegistration: TUTOR_STUB_RESISTANCE_FIDELITY_VALIDATION_REGISTRATION_V8,
  });
  assert.equal(primaryReport.score.status, 'passed');
  assert.equal(fidelityReport.score.status, 'passed');
  assert.equal(primaryReport.score.metrics.panel_exact_accuracy, 1);
  assert.equal(fidelityReport.score.metrics.panel_register_accuracy, 1);
  const combined = writeTutorStubResistanceMeasurementCombinedValidationReportV8({
    primaryDestination: destinations.primary,
    fidelityDestination: destinations.fidelity,
    combinedDestination: destinations.combined,
    expectedSourceCommit: SOURCE_COMMIT,
    expectedSourceTree: SOURCE_TREE,
    expectedGoRequestPath: GO_REQUEST_PATH,
    expectedGoRequestSha256: GO_REQUEST_SHA256,
    expectedGoRequest: request,
    sourceDirty: false,
    archiveDir,
  });
  assert.equal(combined.status, 'passed');
  assert.equal(combined.confirmation_ready, true);
  assert.equal(combined.accounting.observed_reservations, 722);
  assert.equal(combined.transport.stages_run_sequentially, true);
});
