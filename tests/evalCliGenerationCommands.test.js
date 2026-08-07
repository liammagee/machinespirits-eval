import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { resolveChatModel } from '../scripts/eval-cli/commands/chatCommand.js';
import { GENERATION_COMMAND_NAMES, getGenerationCommandHandler } from '../scripts/eval-cli/commands/generationIndex.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const cliPath = path.join(repoRoot, 'scripts', 'eval-cli.js');
const commandsDir = path.join(repoRoot, 'scripts', 'eval-cli', 'commands');

const EXPECTED_GENERATION_COMMANDS = ['chat', 'quick', 'rejudge', 'run', 'test'];
const GENERATION_OWNER_FILES = [
  'chatCommand.js',
  'chatTools.js',
  'generationIndex.js',
  'quickCommand.js',
  'rejudgeCommand.js',
  'runCommand.js',
];

describe('eval-cli generation command boundaries', () => {
  it('registers every extracted generation command exactly once', () => {
    assert.deepEqual([...GENERATION_COMMAND_NAMES].sort(), EXPECTED_GENERATION_COMMANDS);

    for (const command of EXPECTED_GENERATION_COMMANDS) {
      assert.equal(typeof getGenerationCommandHandler(command), 'function', `${command} should resolve to a handler`);
    }
    assert.equal(getGenerationCommandHandler('evaluate'), null, 'scoring commands stay in their own registry');
    assert.equal(getGenerationCommandHandler('not-a-command'), null);
  });

  it('keeps each generation owner below the 500-line ceiling', () => {
    for (const file of GENERATION_OWNER_FILES) {
      const lineCount = fs.readFileSync(path.join(commandsDir, file), 'utf8').split('\n').length - 1;
      assert.ok(lineCount <= 500, `${file} has ${lineCount} lines; expected at most 500`);
    }
  });

  it('keeps the executable facade and prevents extracted cases returning to its switch', () => {
    const source = fs.readFileSync(cliPath, 'utf8');

    assert.match(source, /^#!\/usr\/bin\/env node/u);
    assert.match(source, /getGenerationCommandHandler\(command\)/u);
    assert.match(source, /await generationCommandHandler\(/u);

    for (const command of EXPECTED_GENERATION_COMMANDS) {
      assert.doesNotMatch(source, new RegExp(`case ['"]${command}['"]`, 'u'));
    }
    assert.match(source, /getScoringCommandHandler\(command\)/u);
    assert.match(source, /await scoringCommandHandler\(/u);

    for (const helper of [
      'FACTORIAL_2X2X2_PROFILES',
      'validateCanonicalFactorialTutorEgoModels',
      'CHAT_TOOLS',
      'runChat',
    ]) {
      assert.doesNotMatch(source, new RegExp(helper, 'u'));
    }
  });

  it('preserves the high-risk generation and cleanup invariants in their owners', () => {
    const runSource = fs.readFileSync(path.join(commandsDir, 'runCommand.js'), 'utf8');
    const rejudgeSource = fs.readFileSync(path.join(commandsDir, 'rejudgeCommand.js'), 'utf8');
    const chatToolsSource = fs.readFileSync(path.join(commandsDir, 'chatTools.js'), 'utf8');

    assert.match(runSource, /validateCanonicalFactorialTutorEgoModels/u);
    assert.match(runSource, /if \(summary\.halted\)[\s\S]{0,200}break;/u);
    assert.match(rejudgeSource, /try\s*\{/u);
    assert.match(rejudgeSource, /finally\s*\{/u);
    assert.match(rejudgeSource, /clearAllRubricOverrides/u);
    assert.match(chatToolsSource, /executeChatTool/u);
    for (const tool of ['list_runs', 'get_run_status', 'get_run_report', 'get_transcript']) {
      assert.match(chatToolsSource, new RegExp(`name: ['"]${tool}['"]`, 'u'));
    }
  });
});

describe('chat model resolution', () => {
  it('passes an OpenRouter judge slug through unchanged', () => {
    const resolved = resolveChatModel({ provider: 'openrouter', model: 'anthropic/claude-sonnet-4.6' });

    assert.equal(resolved.error, undefined);
    assert.equal(resolved.model, 'anthropic/claude-sonnet-4.6');
  });

  it('refuses a non-OpenRouter judge instead of inventing a slug', () => {
    // chat POSTs to OpenRouter whatever it is handed, so 'claude-code/sonnet'
    // used to leave here as a model name and come back a 400 on the first
    // message typed. Fail at the config, and name what resolved.
    for (const [provider, model] of [
      ['claude-code', 'sonnet'],
      ['codex', 'gpt-5.5'],
      ['anthropic', 'claude-sonnet-4.6'],
      ['gemini', 'gemini-2.5-pro'],
    ]) {
      const resolved = resolveChatModel({ provider, model });

      assert.equal(resolved.model, undefined, `${provider} should not yield a chat model`);
      assert.match(resolved.error, new RegExp(`${provider}/${model}`, 'u'));
      assert.match(resolved.error, /openrouter\.\*/u);
    }
  });

  it('reports a judge that resolved to no model at all', () => {
    for (const judge of [undefined, {}, { provider: 'openrouter' }]) {
      const resolved = resolveChatModel(judge);

      assert.equal(resolved.model, undefined);
      assert.match(resolved.error, /No judge model resolved/u);
    }
  });
});
