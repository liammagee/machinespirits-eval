import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { getOperationalCommandHandler, OPERATIONAL_COMMAND_NAMES } from '../scripts/eval-cli/commands/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const cliPath = path.join(repoRoot, 'scripts', 'eval-cli.js');
const commandsDir = path.join(repoRoot, 'scripts', 'eval-cli', 'commands');

const EXPECTED_OPERATIONAL_COMMANDS = [
  'cleanup',
  'delete-runs',
  'export',
  'list',
  'play',
  'report',
  'resume',
  'revert',
  'runs',
  'status',
  'transcript',
  'validate-config',
  'watch',
];

const OPERATIONAL_OWNER_FILES = [
  'cleanupCommand.js',
  'deleteRunsCommand.js',
  'exportCommand.js',
  'listCommand.js',
  'playCommand.js',
  'reportCommand.js',
  'resumeCommand.js',
  'revertCommand.js',
  'runsCommand.js',
  'statusCommand.js',
  'transcriptCommand.js',
  'validateConfigCommand.js',
  'watchCommand.js',
];

describe('eval-cli operational command boundaries', () => {
  it('registers every extracted command exactly once', () => {
    assert.deepEqual([...OPERATIONAL_COMMAND_NAMES].sort(), EXPECTED_OPERATIONAL_COMMANDS);

    for (const command of EXPECTED_OPERATIONAL_COMMANDS) {
      assert.equal(typeof getOperationalCommandHandler(command), 'function', `${command} should resolve to a handler`);
    }
    assert.equal(getOperationalCommandHandler('evaluate'), null, 'unmigrated scoring commands stay in the facade');
    assert.equal(getOperationalCommandHandler('not-a-command'), null);
  });

  it('keeps every operational owner below the 500-line ceiling', () => {
    for (const file of OPERATIONAL_OWNER_FILES) {
      const lineCount = fs.readFileSync(path.join(commandsDir, file), 'utf8').split('\n').length - 1;
      assert.ok(lineCount <= 500, `${file} has ${lineCount} lines; expected at most 500`);
    }

    for (const file of ['runProgressPresentation.js', 'runsPresentation.js', 'tracePresentation.js']) {
      const lineCount = fs.readFileSync(path.join(commandsDir, '..', file), 'utf8').split('\n').length - 1;
      assert.ok(lineCount <= 500, `${file} has ${lineCount} lines; expected at most 500`);
    }
  });

  it('keeps the executable facade and prevents extracted cases returning to its switch', () => {
    const source = fs.readFileSync(cliPath, 'utf8');

    assert.match(source, /^#!\/usr\/bin\/env node/u);
    assert.match(source, /getOperationalCommandHandler\(command\)/u);
    assert.match(source, /await operationalCommandHandler\(/u);

    for (const command of EXPECTED_OPERATIONAL_COMMANDS) {
      assert.doesNotMatch(source, new RegExp(`case ['"]${command}['"]`, 'u'));
    }

    for (const helper of [
      'buildGridFromEvents',
      'deriveActiveTestProgress',
      'formatTraceEntry',
      'renderDeleteRunsPreview',
      'renderGrid',
      'renderRunsTable',
    ]) {
      assert.doesNotMatch(source, new RegExp(`function ${helper}\\(`, 'u'));
    }

    assert.match(source, /getScoringCommandHandler\(command\)/u);
    assert.match(source, /await scoringCommandHandler\(/u);
  });

  it('keeps host-relative dynamic imports at the facade boundary', () => {
    const source = fs.readFileSync(cliPath, 'utf8');
    const playSource = fs.readFileSync(path.join(commandsDir, 'playCommand.js'), 'utf8');
    const validateSource = fs.readFileSync(path.join(commandsDir, 'validateConfigCommand.js'), 'utf8');

    assert.match(source, /loadContentResolver: \(\) => import\('\.\.\/services\/contentResolver\.js'\)/u);
    assert.match(source, /await import\('\.\/playCommand\.js'\)/u);
    assert.doesNotMatch(playSource, /import\(/u);
    assert.doesNotMatch(validateSource, /import\(/u);
  });
});
