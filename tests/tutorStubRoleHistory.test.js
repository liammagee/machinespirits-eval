import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function installFakeCodex(tmp) {
  const fakeCodex = path.join(tmp, 'codex');
  fs.writeFileSync(
    fakeCodex,
    `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const outputIndex = args.indexOf('-o');
const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : null;
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  const response = input.includes('Write learner turn')
    ? 'I would compare the metal residues first.'
    : 'Which public mark would connect this clue to one hand?';
  if (process.env.FAKE_CODEX_LOG) fs.appendFileSync(process.env.FAKE_CODEX_LOG, input + '\\n---CALL---\\n');
  if (outputPath) fs.writeFileSync(outputPath, response);
  process.stdout.write(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: response } }) + '\\n');
});
`,
    'utf8',
  );
  fs.chmodSync(fakeCodex, 0o755);
}

function traceEvents(tmp) {
  return fs
    .readdirSync(tmp)
    .filter((name) => name.endsWith('.jsonl'))
    .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test('automated learner replays the full public dialogue with learner-relative native roles', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-learner-role-history-'));
  try {
    installFakeCodex(tmp);
    const promptLog = path.join(tmp, 'fake-codex-input.log');
    const result = spawnSync(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--auto-learner',
        '--auto-turns',
        '2',
        '--no-classifier',
        '--no-register-selection',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          PATH: `${tmp}${path.delimiter}${process.env.PATH || ''}`,
          FAKE_CODEX_LOG: promptLog,
          CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
          TUTOR_STUB_SUMMARY_OPEN: '0',
        },
        encoding: 'utf8',
        timeout: 12_000,
      },
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const learnerCalls = traceEvents(tmp).filter(
      (event) => event.type === 'model_call' && event.role === 'tutor_stub_auto_learner',
    );
    assert.equal(learnerCalls.length, 2, 'expected one automated learner model call per turn');
    const [learnerCall, secondLearnerCall] = learnerCalls;
    assert.equal(learnerCall.request.messageHistory.length, 1);
    assert.equal(learnerCall.request.messageHistory[0].role, 'user');
    assert.match(learnerCall.request.messageHistory[0].content, /Keep the case question in view/u);
    assert.equal(learnerCall.request.messages.at(-1).role, 'user');
    assert.match(learnerCall.request.messages.at(-1).content, /Write learner turn 1/u);
    assert.doesNotMatch(learnerCall.request.prompt, /# Public transcript/u);

    assert.deepEqual(
      secondLearnerCall.request.messageHistory.map((message) => message.role),
      ['user', 'assistant', 'user'],
    );
    assert.match(secondLearnerCall.request.messageHistory[0].content, /Keep the case question in view/u);
    assert.equal(secondLearnerCall.request.messageHistory[1].content, 'I would compare the metal residues first.');
    assert.match(secondLearnerCall.request.messageHistory[2].content, /Which public mark would connect/u);
    assert.equal(secondLearnerCall.request.messages.at(-1).role, 'user');
    assert.match(secondLearnerCall.request.messages.at(-1).content, /Write learner turn 2/u);

    const cliCalls = fs.readFileSync(promptLog, 'utf8').split('\n---CALL---\n').filter(Boolean);
    const learnerCliCall = cliCalls.find((call) => call.includes('Write learner turn 1'));
    assert.match(learnerCliCall, /Conversation so far:\nuser: Keep the case question in view/u);
    assert.match(learnerCliCall, /Latest message:\n/u);
    const secondLearnerCliCall = cliCalls.find((call) => call.includes('Write learner turn 2'));
    assert.match(
      secondLearnerCliCall,
      /Conversation so far:\nuser: Keep the case question in view[\s\S]*assistant: I would compare the metal residues first\.[\s\S]*user: Which public mark would connect/u,
    );
    assert.match(secondLearnerCliCall, /Latest message:\n/u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
