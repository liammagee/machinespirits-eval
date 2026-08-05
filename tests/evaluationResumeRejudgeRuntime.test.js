import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createEvaluationRejudgeRuntime } from '../services/evaluationRejudgeRuntime.js';
import { rejudgeRun, resumeEvaluation } from '../services/evaluationRunner.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function serviceSource(fileName) {
  return readFileSync(path.join(ROOT, 'services', fileName), 'utf8');
}

function singleTurnResult(overrides = {}) {
  return {
    id: 1,
    runId: 'run-1',
    scenarioId: 'scenario-1',
    profileName: 'cell_1_base_single_unified',
    success: true,
    suggestions: [{ message: 'Ask the learner to compare the two premises.' }],
    tutorFirstTurnScore: 65,
    judgeModel: 'judge-a',
    ...overrides,
  };
}

function rejudgeDependencies(storeOverrides = {}) {
  const evaluationStore = {
    getRun: () => ({ id: 'run-1' }),
    getResults: () => [singleTurnResult()],
    generationIdentity: () => 'generation-1',
    storeRejudgment: () => 2,
    updateResultScores() {},
    ...storeOverrides,
  };

  return {
    DEFAULT_PARALLELISM: 1,
    REQUEST_DELAY_MS: 0,
    SUPPORTED_JUDGE_CLIS: new Set(['codex', 'claude', 'gemini']),
    evaluationStore,
    getDefaultCliJudgeModelOverride: () => null,
    resolveRejudgeScenarioAndDialogueLog: () => ({
      scenario: {
        id: 'scenario-1',
        name: 'Scenario 1',
        description: 'A frozen test scenario',
        expected_behavior: 'Scaffold without answering',
        learner_context: 'The learner is comparing premises.',
        required_elements: [],
        forbidden_elements: [],
      },
      dialogueLog: null,
    }),
    retryWithBackoff: (operation) => operation(),
    rubricEvaluator: {
      evaluateSuggestion: async () => ({
        success: true,
        overallScore: 72,
        judgeModel: 'judge-b',
        evaluationTimeMs: 4,
      }),
      getAvailableJudge: () => ({ provider: 'judge', model: 'b' }),
      getUsageAccumulator: () => ({ calls: 1 }),
      normalizeJudgeLabel: (provider, model) => `${provider}-${model}`,
      resetUsageAccumulator() {},
    },
    sleep: async () => {},
  };
}

test('evaluationRunner delegates resume and rejudge to bounded runtime owners', () => {
  const runner = serviceSource('evaluationRunner.js');
  const owners = [
    ['evaluationResumeRuntime.js', 'createEvaluationResumeRuntime'],
    ['evaluationRejudgeRuntime.js', 'createEvaluationRejudgeRuntime'],
  ];

  for (const [fileName, factoryName] of owners) {
    const source = serviceSource(fileName);
    assert.match(runner, new RegExp(`import \\{ ${factoryName} \\} from './${fileName}'`));
    assert.match(source, new RegExp(`export function ${factoryName}\\(`));
    assert.ok(source.split('\n').length <= 1200, `${fileName} must remain within the 1,200-line owner ceiling`);
  }

  assert.equal(typeof resumeEvaluation, 'function');
  assert.equal(typeof rejudgeRun, 'function');
  assert.doesNotMatch(runner, /export async function resumeEvaluation\(/);
  assert.doesNotMatch(runner, /async function scoreMultiTurnRejudgment\(/);
  assert.doesNotMatch(runner, /export async function rejudgeRun\(/);
});

test('rejudge runtime preserves exact validation failures without entering scoring', async () => {
  const missing = createEvaluationRejudgeRuntime(
    rejudgeDependencies({
      getRun: () => null,
    }),
  );
  await assert.rejects(missing.rejudgeRun('missing-run'), /Run not found: missing-run/u);

  const conflicting = createEvaluationRejudgeRuntime(rejudgeDependencies());
  await assert.rejects(
    conflicting.rejudgeRun('run-1', { judgeOverride: 'judge.b', judgeCli: 'codex' }),
    /Use either judgeOverride or judgeCli, not both/u,
  );
  await assert.rejects(conflicting.rejudgeRun('run-1', { judgeCli: 'unknown' }), /Unsupported judge CLI: unknown/u);
});

test('rejudge runtime skips an already-complete target judgment by generation identity', async () => {
  const source = singleTurnResult();
  const target = singleTurnResult({ id: 2, judgeModel: 'judge-b', tutorFirstTurnScore: 78 });
  let resultReads = 0;
  let writes = 0;
  const runtime = createEvaluationRejudgeRuntime(
    rejudgeDependencies({
      getResults: () => (++resultReads === 1 ? [source] : [source, target]),
      storeRejudgment: () => {
        writes++;
        return 3;
      },
      updateResultScores: () => {
        writes++;
      },
    }),
  );

  const summary = await runtime.rejudgeRun('run-1');
  assert.equal(summary.total, 0);
  assert.equal(summary.succeeded, 0);
  assert.equal(writes, 0);
});

test('rejudge runtime refuses to overwrite a row owned by another judge', async () => {
  const source = singleTurnResult();
  let stored = 0;
  let overwritten = 0;
  const runtime = createEvaluationRejudgeRuntime(
    rejudgeDependencies({
      getResults: () => [source],
      storeRejudgment: () => {
        stored++;
        return 2;
      },
      updateResultScores: () => {
        overwritten++;
      },
    }),
  );

  const summary = await runtime.rejudgeRun('run-1', { overwrite: true });
  assert.equal(summary.total, 1);
  assert.equal(summary.succeeded, 1);
  assert.equal(stored, 1);
  assert.equal(overwritten, 0);
});
