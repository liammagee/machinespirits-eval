import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluation-store-roundtrip-'));
process.env.EVAL_DB_PATH = path.join(tempRoot, 'evaluations.db');
process.env.EVAL_LOGS_DIR = path.join(tempRoot, 'logs');

const evaluationStore = await import('../services/evaluationStore.js');

const createdRunIds = new Set();

after(() => {
  for (const runId of createdRunIds) {
    try {
      evaluationStore.deleteRun(runId);
    } catch {
      // Best-effort cleanup; the temporary root is removed below.
    }
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
  delete process.env.EVAL_DB_PATH;
  delete process.env.EVAL_LOGS_DIR;
});

function trackRun(runId) {
  createdRunIds.add(runId);
  return runId;
}

function richGeneration(overrides = {}) {
  return {
    scenarioId: 'roundtrip-scenario',
    scenarioName: 'Round-trip scenario',
    scenarioType: 'suggestion',
    provider: 'test-provider',
    model: 'test-model',
    profileName: 'cell_roundtrip',
    hyperparameters: { temperature: 0.25, max_tokens: 321 },
    promptId: 'prompt-roundtrip',
    egoModel: 'test.ego',
    superegoModel: 'test.superego',
    suggestions: [{ message: 'Preserve this generation exactly.' }],
    rawResponse: '{"raw":"provider envelope"}',
    latencyMs: 123,
    inputTokens: 45,
    outputTokens: 67,
    cost: 0.0042,
    dialogueRounds: 3,
    deliberationRounds: 2,
    apiCalls: 5,
    dialogueId: 'dialogue-roundtrip-0',
    attemptIndex: 0,
    factors: {
      recognition: true,
      multi_agent_tutor: true,
      multi_agent_learner: false,
    },
    learnerArchitecture: 'ego_superego',
    scoringMethod: 'generation',
    conversationMode: 'messages',
    dialogueContentHash: 'dialogue-hash-roundtrip',
    configHash: 'config-hash-roundtrip',
    tutorEgoPromptVersion: 'ego-v3',
    tutorSuperegoPromptVersion: 'superego-v2',
    learnerPromptVersion: 'learner-v4',
    promptContentHash: 'prompt-hash-roundtrip',
    learnerId: 'learner-roundtrip',
    idConstructionTrace: [{ turn: 0, construction: { persona_delta: 'witness' } }],
    tutorFirstTurnScore: 81,
    passesRequired: true,
    passesForbidden: true,
    success: true,
    ...overrides,
  };
}

function assertGenerationPreserved(actual, expected, { scoringMethod = expected.scoringMethod } = {}) {
  const scalarFields = [
    'scenarioId',
    'scenarioName',
    'scenarioType',
    'provider',
    'model',
    'profileName',
    'promptId',
    'egoModel',
    'superegoModel',
    'rawResponse',
    'latencyMs',
    'inputTokens',
    'outputTokens',
    'cost',
    'dialogueRounds',
    'deliberationRounds',
    'apiCalls',
    'dialogueId',
    'attemptIndex',
    'learnerArchitecture',
    'conversationMode',
    'dialogueContentHash',
    'configHash',
    'tutorEgoPromptVersion',
    'tutorSuperegoPromptVersion',
    'learnerPromptVersion',
    'promptContentHash',
    'learnerId',
  ];
  for (const field of scalarFields) assert.deepEqual(actual[field], expected[field], `${field} must round-trip`);
  assert.deepEqual(actual.hyperparameters, expected.hyperparameters);
  assert.deepEqual(actual.suggestions, expected.suggestions);
  assert.deepEqual(actual.factors, expected.factors);
  assert.deepEqual(actual.idConstructionTrace, expected.idConstructionTrace);
  assert.equal(actual.scoringMethod, scoringMethod);
}

describe('evaluation generation/provenance round trips', () => {
  it('preserves current generation fields through reload, rejudge, rubric clone, and export', () => {
    const sourceRun = evaluationStore.createRun({
      description: 'round-trip source',
      totalScenarios: 1,
      totalConfigurations: 1,
      metadata: {
        runsPerConfig: 2,
        gitCommit: 'source-git-sha',
        packageVersion: '0.5.0-test',
      },
    });
    trackRun(sourceRun.id);
    evaluationStore.updateRun(sourceRun.id, { status: 'running', totalTests: 2 });

    const generation = richGeneration();
    const sourceId = evaluationStore.storeResult(sourceRun.id, generation);
    const source = evaluationStore.getResultById(sourceId);
    assertGenerationPreserved(source, generation);

    const rejudgedId = evaluationStore.storeRejudgment(source, {
      tutorFirstTurnScore: 88,
      scores: { relevance: { score: 4, reasoning: 'retained generation' } },
      passesRequired: true,
      passesForbidden: true,
      judgeModel: 'test-rejudge',
      summary: 'new judgment only',
    });
    const rejudged = evaluationStore.getResultById(rejudgedId);
    assertGenerationPreserved(rejudged, generation, { scoringMethod: 'rubric' });

    const { derivedRunId, clonedIds } = evaluationStore.cloneRowsForRubricVersion(sourceRun.id, [source], '2.2');
    trackRun(derivedRunId);
    assert.equal(clonedIds.length, 1);
    const clone = evaluationStore.getResultById(clonedIds[0]);
    assertGenerationPreserved(clone, generation);

    const derivedRun = evaluationStore.getRun(derivedRunId);
    assert.equal(derivedRun.totalTests, 2);
    assert.equal(derivedRun.gitCommit, 'source-git-sha');
    assert.equal(derivedRun.packageVersion, '0.5.0-test');
    assert.equal(derivedRun.metadata.sourceRunId, sourceRun.id);
    assert.equal(derivedRun.metadata.rubricVersion, '2.2');

    const secondClone = evaluationStore.cloneRowsForRubricVersion(sourceRun.id, [source], '2.2');
    assert.deepEqual(secondClone.clonedIds, [], 'rubric cloning must be idempotent by generation identity');

    const exported = evaluationStore.exportToJson(sourceRun.id).results[0];
    assertGenerationPreserved(exported, generation);
    const csv = evaluationStore.exportToCsv(sourceRun.id);
    assert.match(csv.split('\n')[0], /attempt_index/);
    assert.match(csv.split('\n')[0], /id_construction_trace/);
    assert.match(csv, /learner-roundtrip/);
    assert.match(csv, /provider envelope/);
  });

  it('keeps distinct repeated attempts when cloning identical response text', () => {
    const run = evaluationStore.createRun({
      description: 'clone repeated attempts',
      totalScenarios: 1,
      totalConfigurations: 1,
      metadata: { runsPerConfig: 2 },
    });
    trackRun(run.id);
    evaluationStore.updateRun(run.id, { status: 'running', totalTests: 2 });

    evaluationStore.storeResult(run.id, richGeneration({ dialogueId: null, attemptIndex: 0 }));
    evaluationStore.storeResult(run.id, richGeneration({ dialogueId: null, attemptIndex: 1 }));
    const sourceRows = evaluationStore.getResults(run.id);
    const { derivedRunId, clonedIds } = evaluationStore.cloneRowsForRubricVersion(run.id, sourceRows, '2.1');
    trackRun(derivedRunId);

    assert.equal(clonedIds.length, 2);
    assert.deepEqual(
      evaluationStore
        .getResults(derivedRunId)
        .map((row) => row.attemptIndex)
        .sort(),
      [0, 1],
    );
  });
});

describe('attempt-aware completion and resume accounting', () => {
  it('does not count rejudgments or failed rows as completed repetitions', () => {
    const run = evaluationStore.createRun({
      description: 'attempt accounting',
      totalScenarios: 1,
      totalConfigurations: 1,
      metadata: { runsPerConfig: 3 },
    });
    trackRun(run.id);
    evaluationStore.updateRun(run.id, { status: 'running', totalTests: 3 });

    const firstId = evaluationStore.storeResult(run.id, richGeneration({ attemptIndex: 0 }));
    const first = evaluationStore.getResultById(firstId);
    evaluationStore.storeRejudgment(first, {
      tutorFirstTurnScore: 90,
      scores: { relevance: 5 },
      passesRequired: true,
      passesForbidden: true,
      judgeModel: 'second-judge',
    });
    evaluationStore.storeResult(
      run.id,
      richGeneration({ attemptIndex: 1, dialogueId: 'dialogue-failed-1', success: false, errorMessage: 'failed' }),
    );

    const status = evaluationStore.getIncompleteTests(
      run.id,
      ['cell_roundtrip'],
      [{ id: 'roundtrip-scenario', name: 'Round-trip scenario' }],
    );
    assert.equal(status.totalExpected, 3);
    assert.equal(status.completed, 1);
    assert.deepEqual(
      status.remainingTests.map((test) => test.attemptIndex),
      [1, 2],
    );

    const completion = evaluationStore.completeRun(run.id);
    assert.equal(completion.resultsFound, 1, 'completion must count generations, not stored judgment rows');
    assert.equal(completion.storedRows, 3);
    assert.equal(completion.expectedTests, 3);
    assert.equal(completion.wasPartial, true);
  });

  it('de-duplicates legacy rejudgments and assigns distinct legacy generations conservatively', () => {
    const run = evaluationStore.createRun({
      description: 'legacy attempt accounting',
      totalScenarios: 1,
      totalConfigurations: 1,
      metadata: { runsPerConfig: 2 },
    });
    trackRun(run.id);
    evaluationStore.updateRun(run.id, { status: 'running', totalTests: 2 });

    const legacyId = evaluationStore.storeResult(run.id, richGeneration({ attemptIndex: null, dialogueId: null }));
    const legacy = evaluationStore.getResultById(legacyId);
    evaluationStore.storeRejudgment(legacy, {
      tutorFirstTurnScore: 86,
      scores: { relevance: 4 },
      passesRequired: true,
      passesForbidden: true,
      judgeModel: 'legacy-rejudge',
    });

    const status = evaluationStore.getIncompleteTests(
      run.id,
      ['cell_roundtrip'],
      [{ id: 'roundtrip-scenario', name: 'Round-trip scenario' }],
    );
    assert.equal(status.completed, 1);
    assert.deepEqual(
      status.remainingTests.map((test) => test.attemptIndex),
      [1],
    );
  });

  it('preserves expected totals when completing a partial repeated run', () => {
    const run = evaluationStore.createRun({
      description: 'partial repeated completion',
      totalScenarios: 1,
      totalConfigurations: 1,
      metadata: { runsPerConfig: 3 },
    });
    trackRun(run.id);
    evaluationStore.updateRun(run.id, { status: 'running', totalTests: 3 });
    evaluationStore.storeResult(run.id, richGeneration({ attemptIndex: 0 }));

    const completion = evaluationStore.completeRun(run.id);
    assert.equal(completion.resultsFound, 1);
    assert.equal(completion.expectedTests, 3);
    assert.equal(completion.wasPartial, true);
    assert.equal(evaluationStore.getRun(run.id).totalTests, 3);
  });

  it('honors totalTests when status and completion are updated together', () => {
    const run = evaluationStore.createRun({ description: 'completed total update' });
    trackRun(run.id);
    evaluationStore.updateRun(run.id, { status: 'completed', totalTests: 7 });
    assert.equal(evaluationStore.getRun(run.id).totalTests, 7);
  });
});
