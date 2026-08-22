import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  TUTOR_STUB_RESISTANCE_FIDELITY_MODEL_SCHEMA_V7,
  TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_MODEL_SCHEMA_V7,
  buildTutorStubResistanceMeasurementZeroCallFixtureV7,
} from '../services/tutorStubResistanceRecoverySemanticAdjudicationV7.js';
import { tutorStubResistanceRecoverySemanticOpaqueCaseId } from '../services/tutorStubResistanceRecoverySemanticValidation.js';
import {
  analyzeTutorStubResistanceRecoverySemanticValidation,
  buildTutorStubResistanceRecoverySemanticValidationPlan,
  runTutorStubResistanceRecoverySemanticValidation,
} from '../services/tutorStubResistanceSplitMeasurementValidationRuntime.js';
import { writeTutorStubResistanceMeasurementCombinedValidationReportV7 } from '../services/tutorStubResistanceMeasurementValidationV7Runtime.js';
import {
  TUTOR_STUB_RESISTANCE_FIDELITY_VALIDATION_REGISTRATION_V7,
  TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_VALIDATION_REGISTRATION_V7,
  loadTutorStubResistanceMeasurementValidationV7,
} from '../services/tutorStubResistanceRecoverySemanticValidationV7.js';

const SOURCE_COMMIT = 'b'.repeat(40);
const SOURCE_TREE = 'c'.repeat(40);
const GO_REQUEST_PATH = 'config/future-resistance-measurement-v7-go-request.json';
const GO_REQUEST_SHA256 = 'd'.repeat(64);

function sourceCase(loaded, executionId) {
  return loaded.corpus.cases.find((row) => tutorStubResistanceRecoverySemanticOpaqueCaseId(row) === executionId);
}

function responseFreeError() {
  return Object.assign(new Error('response free'), {
    code: 'CLI_PROVIDER_RESPONSE_FREE_ERROR',
    provider: 'claude-code',
    classification: 'response_free_error',
    responseFree: true,
    exitCode: 1,
    stdoutBytes: 165,
    stderrBytes: 0,
    stdoutSha256: 'e'.repeat(64),
    stderrSha256: 'f'.repeat(64),
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
    const fixture = buildTutorStubResistanceMeasurementZeroCallFixtureV7({
      corpusCase: { ...corpusCase, case_id: prompt.case_id },
      judge,
      instrument: loaded.stage,
    });
    const modelSchema =
      loaded.stage === 'primary_recovery'
        ? TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_MODEL_SCHEMA_V7
        : TUTOR_STUB_RESISTANCE_FIDELITY_MODEL_SCHEMA_V7;
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
    schema: 'machinespirits.tutor-stub.resistance-measurement-validation-study-go-request.v7',
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
      programmeLedgerBefore: 2273,
      programmeMaximumAfterValidation: 4433,
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

test('V7 plans bind separate blinded stages under the amended operational safeguard', () => {
  const primary = loadTutorStubResistanceMeasurementValidationV7(
    TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_VALIDATION_REGISTRATION_V7,
  );
  const fidelity = loadTutorStubResistanceMeasurementValidationV7(
    TUTOR_STUB_RESISTANCE_FIDELITY_VALIDATION_REGISTRATION_V7,
  );
  const destinations = { primary: '/tmp/v7-primary', fidelity: '/tmp/v7-fidelity' };
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
    assert.equal(plan.budget.planned_calls, 360);
    assert.equal(plan.budget.hard_reservation_ceiling, 1080);
    assert.equal(plan.budget.programme_ceiling, 10000);
    assert.equal(JSON.stringify(plan).includes('"expected"'), false);
    if (loaded.stage === 'intervention_fidelity') {
      assert.equal(JSON.stringify(plan).includes('current_learner'), false);
    }
  }
});

test('V7 stages seal independently and a response-free Sonnet seat never blocks the remaining majority', async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'resistance-measurement-v7-runtime-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const destinations = {
    primary: path.join(temporary, 'primary'),
    fidelity: path.join(temporary, 'fidelity'),
    combined: path.join(temporary, 'combined'),
  };
  const archiveDir = path.join(temporary, 'archive');
  fs.mkdirSync(archiveDir);
  const primary = loadTutorStubResistanceMeasurementValidationV7(
    TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_VALIDATION_REGISTRATION_V7,
  );
  const fidelity = loadTutorStubResistanceMeasurementValidationV7(
    TUTOR_STUB_RESISTANCE_FIDELITY_VALIDATION_REGISTRATION_V7,
  );
  const request = goRequest(primary, fidelity, destinations);
  const primaryRun = await runTutorStubResistanceRecoverySemanticValidation({
    destination: destinations.primary,
    sourceCommit: SOURCE_COMMIT,
    sourceTree: SOURCE_TREE,
    goRequestPath: GO_REQUEST_PATH,
    goRequestSha256: GO_REQUEST_SHA256,
    goRequest: request,
    sourceDirty: false,
    archiveDir,
    validationRegistration: TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_VALIDATION_REGISTRATION_V7,
    waitForRetry: async () => {},
    callModel: fixtureCaller(primary, primary.corpus.cases[0].case_id),
    resolveModelRef: routeResolver(primary),
  });
  assert.equal(primaryRun.seal.judge_results, 360);
  assert.equal(primaryRun.seal.reservations, 362);
  const fidelityRun = await runTutorStubResistanceRecoverySemanticValidation({
    destination: destinations.fidelity,
    sourceCommit: SOURCE_COMMIT,
    sourceTree: SOURCE_TREE,
    goRequestPath: GO_REQUEST_PATH,
    goRequestSha256: GO_REQUEST_SHA256,
    goRequest: request,
    sourceDirty: false,
    archiveDir,
    validationRegistration: TUTOR_STUB_RESISTANCE_FIDELITY_VALIDATION_REGISTRATION_V7,
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
    validationRegistration: TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_VALIDATION_REGISTRATION_V7,
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
    validationRegistration: TUTOR_STUB_RESISTANCE_FIDELITY_VALIDATION_REGISTRATION_V7,
  });
  assert.equal(primaryReport.score.stage, 'primary_recovery');
  assert.equal(primaryReport.score.status, 'passed');
  assert.equal(primaryReport.score.metrics.panel_exact_accuracy, 1);
  assert.equal(fidelityReport.score.stage, 'intervention_fidelity');
  assert.equal(fidelityReport.score.status, 'passed');
  assert.equal(fidelityReport.score.metrics.panel_register_accuracy, 1);
  const combined = writeTutorStubResistanceMeasurementCombinedValidationReportV7({
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
  assert.equal(combined.verdict_separation.fidelity_failure_may_erase_primary_validation, false);
  assert.equal(
    fs
      .readFileSync(path.join(destinations.combined, 'report.json'))
      .equals(
        fs.readFileSync(
          path.join(
            archiveDir,
            'artifacts/tutor-stub-live/resistance-measurement-validation-v7',
            GO_REQUEST_SHA256.slice(0, 24),
            'combined-report.json',
          ),
        ),
      ),
    true,
  );
});
