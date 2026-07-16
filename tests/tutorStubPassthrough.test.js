import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function plainTerminalText(value) {
  const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, 'gu');
  return String(value || '').replace(ansi, '').replace(/\r/gu, '');
}

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
  const response = 'Pure speaker reply.';
  if (process.env.FAKE_CODEX_LOG) fs.writeFileSync(process.env.FAKE_CODEX_LOG, input);
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

test('passthrough dry run disables every auxiliary tutoring stage', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/tutor-stub.js', '--passthrough', '--dry-run', '--no-trace', '--world', 'world_005_marrick'],
    {
      cwd: ROOT,
      env: { ...process.env, TUTOR_STUB_REMEMBER_SETTINGS: '0' },
      encoding: 'utf8',
      timeout: 10_000,
    },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const config = JSON.parse(result.stdout);
  assert.equal(config.passthrough.enabled, true);
  assert.equal(config.passthrough.modelCallsPerTurn, 1);
  assert.deepEqual(config.passthrough.requestSurface, [
    'system_setup',
    'full_public_history',
    'latest_learner_message',
  ]);
  assert.equal(config.classifier.enabled, false);
  assert.equal(config.tutorLearnerDag.enabled, false);
  assert.equal(config.registerSelection.enabled, false);
  assert.equal(config.opening.enabled, false);
  assert.equal(config.turnFeedback.enabled, false);
  assert.equal(config.learningSummaryReport.enabled, false);
  assert.equal(config.memorySummary.enabled, false);
});

test('passthrough exposes live release notes without invoking a model', () => {
  const result = spawnSync(
    process.execPath,
    [
      'scripts/tutor-stub.js',
      '--passthrough',
      '--no-closeout-report',
      '--no-interim-animation',
      '--no-stream',
      '--no-trace',
      '--world',
      'world_005_marrick',
      '--no-remember-settings',
    ],
    {
      cwd: ROOT,
      env: { ...process.env, TUTOR_STUB_SUMMARY_OPEN: '0' },
      encoding: 'utf8',
      input: '/release-notes\n/quit\n',
      timeout: 10_000,
    },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const stdout = plainTerminalText(result.stdout);
  assert.match(stdout, /release notes > last 24 hours/u);
  assert.match(stdout, /effect >/u);
  assert.doesNotMatch(stdout, /intentionally unavailable in passthrough mode/u);
  assert.doesNotMatch(stdout, /tutor >/u);
});

test('passthrough makes exactly one speaker call with raw learner text and no harness advisories', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-passthrough-'));
  try {
    installFakeCodex(tmp);
    const promptLog = path.join(tmp, 'fake-codex-input.log');
    const learnerText = 'Can we inspect the coins directly?';
    const result = spawnSync(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--passthrough',
        '--once',
        learnerText,
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
        '--no-remember-settings',
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
        timeout: 10_000,
      },
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const events = traceEvents(tmp);
    const modelCalls = events.filter((event) => event.type === 'model_call');
    assert.equal(modelCalls.length, 1, 'passthrough must make exactly one model call per learner turn');

    const call = modelCalls[0];
    assert.equal(call.role, 'tutor_stub_passthrough');
    assert.equal(call.request.config.passthrough, true);
    assert.equal(call.request.config.leakGuard, false);
    assert.equal(call.request.config.scaffoldGuard, false);
    assert.equal(call.request.config.responseCompositionGuard, false);
    assert.equal(call.request.config.repetitionGuard, false);
    assert.equal(call.request.config.closureGuard, false);
    assert.equal(call.request.messages.length, 1);
    assert.deepEqual(call.request.messages[0], { role: 'user', content: learnerText });
    assert.equal(call.request.systemPrompt.includes('The Light Shillings'), true);
    assert.doesNotMatch(call.request.messages[0].content, /Learner says:/u);
    assert.doesNotMatch(call.request.messages[0].content, /Tutor-only|learner-DAG|response composition/iu);

    const completion = events.find((event) => event.type === 'passthrough_turn_complete');
    assert.equal(completion.modelCallCount, 1);
    assert.deepEqual(completion.requestSurface, [
      'system_setup',
      'full_public_history',
      'latest_learner_message',
    ]);
    const stdout = plainTerminalText(result.stdout);
    assert.match(stdout, /passthrough > pure speaker chat/u);
    assert.match(stdout, /tutor > Pure speaker reply\./u);
    assert.doesNotMatch(stdout, /director instructions|learning summary|learner classifier|learner reasoning tracker/iu);
    assert.equal(fs.existsSync(promptLog), true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
