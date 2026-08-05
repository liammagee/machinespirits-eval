import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { SCORING_COMMAND_NAMES, getScoringCommandHandler } from '../scripts/eval-cli/commands/scoringIndex.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(directory, '..');
const cliPath = path.join(repoRoot, 'scripts', 'eval-cli.js');
const commandsDirectory = path.join(repoRoot, 'scripts', 'eval-cli', 'commands');
const EXPECTED_SCORING_COMMANDS = ['backfill-first-turn', 'evaluate', 'evaluate-dialogue', 'evaluate-learner'];
const SCORING_OWNER_FILES = [
  'backfillFirstTurnCommand.js',
  'evaluateCommand.js',
  'evaluateDialogueCommand.js',
  'evaluateHolisticDialogues.js',
  'evaluateJudge.js',
  'evaluateLearnerCommand.js',
  'evaluateLearnerDialogue.js',
  'evaluateMultiTurnJudgeWave.js',
  'evaluateMultiTurnPersistence.js',
  'evaluateMultiTurnPreparation.js',
  'evaluateMultiTurnRuntime.js',
  'evaluatePresentation.js',
  'evaluateReview.js',
  'evaluateSingleResult.js',
  'scoringIndex.js',
  '../scoringCommandDependencies.js',
];

describe('eval-cli scoring command boundaries', () => {
  it('registers every scoring command exactly once', () => {
    assert.deepEqual([...SCORING_COMMAND_NAMES].sort(), EXPECTED_SCORING_COMMANDS);
    for (const command of EXPECTED_SCORING_COMMANDS) {
      assert.equal(typeof getScoringCommandHandler(command), 'function', `${command} should resolve to a handler`);
    }
    assert.equal(getScoringCommandHandler('run'), null);
    assert.equal(getScoringCommandHandler('not-a-command'), null);
  });

  it('keeps each scoring owner below the 500-line ceiling', () => {
    for (const file of SCORING_OWNER_FILES) {
      const lineCount = fs.readFileSync(path.join(commandsDirectory, file), 'utf8').split('\n').length - 1;
      assert.ok(lineCount <= 500, `${file} has ${lineCount} lines; expected at most 500`);
    }
  });

  it('keeps the executable facade bounded and free of scoring internals', () => {
    const source = fs.readFileSync(cliPath, 'utf8');
    const lineCount = source.split('\n').length - 1;
    assert.ok(lineCount <= 300, `eval-cli.js has ${lineCount} lines; expected at most 300`);
    assert.match(source, /getScoringCommandHandler\(command\)/u);
    assert.match(source, /await scoringCommandHandler\(/u);
    for (const command of EXPECTED_SCORING_COMMANDS) {
      assert.doesNotMatch(source, new RegExp(`case ['"]${command}['"]`, 'u'));
    }
    for (const internal of [
      'buildEvaluationPrompt',
      'calculateLearnerOverallScore',
      'resolveEvaluationScenarioAndDialogueLog',
      'setAllRubricOverrides',
      'updateResultTutorScores',
    ]) {
      assert.doesNotMatch(source, new RegExp(internal, 'u'));
    }
  });

  it('preserves bilateral writes, tutor-only gates, provenance, and follow cleanup', () => {
    const commandSource = fs.readFileSync(path.join(commandsDirectory, 'evaluateCommand.js'), 'utf8');
    const preparationSource = fs.readFileSync(path.join(commandsDirectory, 'evaluateMultiTurnPreparation.js'), 'utf8');
    const judgeWaveSource = fs.readFileSync(path.join(commandsDirectory, 'evaluateMultiTurnJudgeWave.js'), 'utf8');
    const persistenceSource = fs.readFileSync(path.join(commandsDirectory, 'evaluateMultiTurnPersistence.js'), 'utf8');

    assert.match(persistenceSource, /updateResultTutorScores/u);
    assert.match(persistenceSource, /updateResultLearnerScores/u);
    assert.match(preparationSource, /const dqPromptParams = !tutorOnly/u);
    assert.match(judgeWaveSource, /const dgpPromise = dqPromptParams/u);
    assert.match(judgeWaveSource, /const dgiPromise = dqPromptParams/u);
    assert.match(preparationSource, /dialogueContentHash/u);
    assert.match(preparationSource, /createHash\('sha256'\)/u);
    assert.match(commandSource, /process\.on\('SIGINT', sigintHandler\)/u);
    assert.match(commandSource, /process\.removeListener\('SIGINT', sigintHandler\)/u);
    assert.match(commandSource, /finally\s*\{/u);
    assert.match(commandSource, /clearAllRubricOverrides\(\)/u);
  });
});
