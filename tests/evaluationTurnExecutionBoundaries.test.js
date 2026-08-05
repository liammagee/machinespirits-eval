import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function serviceSource(fileName) {
  return readFileSync(path.join(ROOT, 'services', fileName), 'utf8');
}

test('evaluationRunner delegates turn execution to bounded implementation owners', () => {
  const runner = serviceSource('evaluationRunner.js');
  const owners = [
    ['evaluationTurnContext.js', null],
    ['evaluationTurnExecutionRuntime.js', 'createEvaluationTurnExecutionRuntime'],
    ['evaluationMultiTurnExecutionRuntime.js', 'createEvaluationMultiTurnExecutionRuntime'],
    ['evaluationMultiTurnSetupRuntime.js', 'createEvaluationMultiTurnSetupRuntime'],
    ['evaluationBetweenTurnAdaptationRuntime.js', 'createEvaluationBetweenTurnAdaptationRuntime'],
    ['evaluationMultiTurnTranscriptRuntime.js', 'createEvaluationMultiTurnTranscriptRuntime'],
    ['evaluationMultiTurnCompletionRuntime.js', 'createEvaluationMultiTurnCompletionRuntime'],
    ['evaluationCheckpointStore.js', 'createEvaluationCheckpointStore'],
  ];

  for (const [fileName, factoryName] of owners) {
    const source = serviceSource(fileName);
    assert.match(runner, new RegExp(`from './${fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
    if (factoryName) assert.match(source, new RegExp(`export function ${factoryName}\\(`));
    assert.ok(source.split('\n').length <= 1200, `${fileName} must remain within the 1,200-line owner ceiling`);
  }

  assert.doesNotMatch(runner, /async function generateAndEvaluateTurn\(/);
  assert.doesNotMatch(runner, /async function runSingleTurnTest\(/);
  assert.doesNotMatch(runner, /async function runSingleTest\(/);
  assert.doesNotMatch(runner, /async function runMultiTurnTest\(/);
});

test('evaluationRunner remains the compatibility facade for callers', () => {
  const runner = serviceSource('evaluationRunner.js');

  for (const helper of [
    'structureLearnerContext',
    'stripRecentChatHistory',
    'resolveConfigModels',
    'flattenConversationHistory',
    'flattenNumericScores',
    'parseCliJudgeJsonResponse',
    'buildMultiTurnContext',
    'formatTurnForContext',
    'buildMessageChain',
    'writeCheckpoint',
    'loadCheckpoint',
    'deleteCheckpoint',
    'listCheckpoints',
    'normalizeCliJudgeEvaluation',
  ]) {
    assert.match(runner, new RegExp(`\\b${helper}\\b`));
  }

  for (const operation of [
    'runEvaluation',
    'resumeEvaluation',
    'compareConfigurations',
    'quickTest',
    'listOptions',
    'getRunResults',
    'generateReport',
    'rejudgeRun',
  ]) {
    assert.match(runner, new RegExp(`\\b${operation},`));
  }
});
