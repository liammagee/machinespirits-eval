import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildTutorStubResistanceSemanticZeroCallFixtureResponseV3 } from '../services/tutorStubResistanceSemanticAdjudicationV3.js';
import {
  loadTutorStubResistanceSemanticValidationV4,
  tutorStubResistanceSemanticCorpusCaseForExecutionIdV4,
} from '../services/tutorStubResistanceSemanticValidationV4.js';
import {
  analyzeTutorStubResistanceSemanticValidation,
  buildTutorStubResistanceSemanticValidationPlan,
  runTutorStubResistanceSemanticValidation,
} from '../services/tutorStubResistanceSemanticValidationRuntime.js';

const SOURCE_COMMIT = '4'.repeat(40);
const SOURCE_TREE = '5'.repeat(40);
const GO_REQUEST_PATH = 'config/future-semantic-validation-v4-go-request.json';
const GO_REQUEST_SHA256 = 'b'.repeat(64);

function goRequest(loaded) {
  const readiness = loaded.registration.executionReadiness;
  return {
    semanticAdjudicationValidation: {
      type: 'prospective_resistance_semantic_adjudication_heldout_validation_v4',
    },
    budget: {
      plannedCases: readiness.plannedCases,
      plannedModelCalls: readiness.plannedModelCalls,
      maximumReservationsPerPlannedCall: readiness.maximumReservationsPerPlannedCall,
      maximumPlannedModelAttempts: readiness.hardValidationReservations,
      programmeLedgerBefore: readiness.programmeLedgerBefore,
      programmeLedgerAfterMaximum: readiness.programmeLedgerAfterMaximum,
      programmeCeiling: readiness.programmeCeiling,
      retryOrResumeAuthority: 'bounded_technical_recovery',
    },
  };
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
    stdoutSha256: 'c'.repeat(64),
    stderrSha256: 'd'.repeat(64),
  });
}

function fixtureCaller(loaded, { exhaustSonnetCase = null } = {}) {
  return async (agentConfig, systemPrompt, userPrompt, role, options) => {
    const prompt = JSON.parse(userPrompt);
    const corpusCase = tutorStubResistanceSemanticCorpusCaseForExecutionIdV4(loaded.corpus.cases, prompt.case_id);
    const judge = loaded.instrument.registration.measurement.judges.find(
      (row) => role === `tutor_stub_resistance_semantic_${row.id}`,
    );
    assert.ok(corpusCase);
    assert.ok(judge);
    assert.equal(agentConfig.provider, judge.provider);
    assert.equal(agentConfig.model, judge.model);
    assert.equal(options.effort, 'low');
    assert.equal(userPrompt.includes(corpusCase.case_id), false);
    if (judge.id === 'semantic_judge_b' && corpusCase.case_id === exhaustSonnetCase) {
      throw responseFreeError();
    }
    const fixture = buildTutorStubResistanceSemanticZeroCallFixtureResponseV3({
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

function resolveModel(loaded, modelRef) {
  const judge = loaded.instrument.registration.measurement.judges.find((row) => row.modelRef === modelRef);
  assert.ok(judge);
  return { provider: judge.provider, model: judge.model };
}

test('v4 plan binds 80 blinded cases, three independent seats, and the 720-reservation safeguard', () => {
  const loaded = loadTutorStubResistanceSemanticValidationV4();
  const plan = buildTutorStubResistanceSemanticValidationPlan({
    sourceCommit: SOURCE_COMMIT,
    sourceTree: SOURCE_TREE,
    destination: path.join(os.tmpdir(), 'future-resistance-semantic-v4'),
    goRequestPath: GO_REQUEST_PATH,
    goRequestSha256: GO_REQUEST_SHA256,
    goRequest: goRequest(loaded),
    loaded,
  });
  assert.equal(plan.cases.length, 80);
  assert.equal(plan.judges.length, 3);
  assert.equal(plan.budget.planned_calls, 240);
  assert.equal(plan.budget.hard_reservation_ceiling, 720);
  assert.equal(JSON.stringify(plan).includes('"expected"'), false);
  assert.ok(plan.cases.every((row) => /^sv4-[a-f0-9]{32}$/u.test(row.case_id)));
});

test('v4 runtime continues past one exhausted response-free seat and passes on the remaining majority', async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'resistance-semantic-v4-runtime-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const destination = path.join(temporary, 'run');
  const archiveDir = path.join(temporary, 'archive');
  fs.mkdirSync(archiveDir);
  const loaded = loadTutorStubResistanceSemanticValidationV4();
  const exhaustedCase = loaded.corpus.cases[0].case_id;
  const request = goRequest(loaded);
  const result = await runTutorStubResistanceSemanticValidation({
    destination,
    sourceCommit: SOURCE_COMMIT,
    sourceTree: SOURCE_TREE,
    goRequestPath: GO_REQUEST_PATH,
    goRequestSha256: GO_REQUEST_SHA256,
    goRequest: request,
    sourceDirty: false,
    archiveDir,
    loaded,
    waitForRetry: async () => {},
    callModel: fixtureCaller(loaded, { exhaustSonnetCase: exhaustedCase }),
    resolveModelRef: (modelRef) => resolveModel(loaded, modelRef),
  });
  assert.equal(result.seal.cases, 80);
  assert.equal(result.seal.judge_results, 240);
  assert.equal(result.seal.reservations, 242);

  const exhaustedExecutionId = loaded.buildBlindedCases(loaded.corpus.cases).find((row) => {
    const corpusCase = tutorStubResistanceSemanticCorpusCaseForExecutionIdV4(loaded.corpus.cases, row.case_id);
    return corpusCase.case_id === exhaustedCase;
  }).case_id;
  const checkpoint = JSON.parse(
    fs.readFileSync(path.join(destination, 'cases', exhaustedExecutionId, 'checkpoint.json'), 'utf8'),
  );
  assert.equal(checkpoint.judge_results.length, 3);
  assert.equal(checkpoint.judge_results[1].outcome, 'transport_failed');
  assert.equal(checkpoint.judge_results[2].outcome, 'recorded_response');
  assert.equal(checkpoint.aggregate.status, 'determinate');
  assert.equal(checkpoint.aggregate.primary_label_measurement.supporting_judges.length, 2);

  const report = analyzeTutorStubResistanceSemanticValidation({
    destination,
    expectedSourceCommit: SOURCE_COMMIT,
    expectedSourceTree: SOURCE_TREE,
    expectedGoRequestPath: GO_REQUEST_PATH,
    expectedGoRequestSha256: GO_REQUEST_SHA256,
    expectedGoRequest: request,
    sourceDirty: false,
    archiveDir,
    loaded,
  });
  assert.equal(report.status, 'passed');
  assert.equal(report.score.metrics.primary_exact_label_accuracy, 1);
  assert.equal(report.score.metrics.primary_determined_coverage_overall, 1);
  assert.equal(report.score.metrics.abstaining_judgments, 1);
  assert.equal(report.score.metrics.judgment_validity_rate, 239 / 240);
});
