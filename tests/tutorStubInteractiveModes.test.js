import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function plainTerminalText(value) {
  return String(value || '')
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/gu, '')
    .replace(/\r/gu, '');
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
  if (process.env.FAKE_CODEX_LOG) fs.appendFileSync(process.env.FAKE_CODEX_LOG, input + '\\n---CALL---\\n');
  const response = input.includes('Write learner turn')
    ? 'I would compare the metal residues first.'
    : 'Take the crucible as a fingerprint: which public mark would let you match it to one hand?';
  if (outputPath) fs.writeFileSync(outputPath, response);
  process.stdout.write(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: response } }) + '\\n');
});
`,
    'utf8',
  );
  fs.chmodSync(fakeCodex, 0o755);
  return fakeCodex;
}

function runInteractive({ tmp, args, initialInput, stopWhen, timeoutMs = 10_000 }) {
  installFakeCodex(tmp);
  const logPath = path.join(tmp, 'fake-codex-input.log');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/tutor-stub.js', ...args], {
      cwd: ROOT,
      env: {
        ...process.env,
        PATH: `${tmp}${path.delimiter}${process.env.PATH || ''}`,
        FAKE_CODEX_LOG: logPath,
        CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let stopping = false;
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`interactive mode test timed out\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (!stopping && stopWhen(plainTerminalText(stdout))) {
        stopping = true;
        child.stdin.end('/status\n/quit\n');
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`interactive mode test exited ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`));
        return;
      }
      resolve({ stdout, stderr, plain: plainTerminalText(stdout), logPath });
    });
    child.stdin.write(initialInput);
  });
}

test('coach mode keeps guidance private and incorporates it into the next tutor prompt', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-coach-mode-'));
  try {
    const guidance = 'Use a concrete analogy before asking one question.';
    const result = await runInteractive({
      tmp,
      args: [
        '--no-opening',
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
      initialInput: `/coach ${guidance}\n/learner\nThe assay still confuses me.\n`,
      stopWhen: (plain) => plain.includes('tutor > Take the crucible as a fingerprint'),
    });

    assert.match(result.plain, /coach queued > Use a concrete analogy/u);
    assert.match(result.plain, /private; applies to tutor turn 1/u);
    assert.match(result.plain, /LEARNER mode/u);
    assert.match(fs.readFileSync(result.logPath, 'utf8'), /\[Private coach guidance for this tutor turn\]/u);
    assert.match(fs.readFileSync(result.logPath, 'utf8'), /Use a concrete analogy before asking one question\./u);

    const trace = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const completed = trace.find((event) => event.type === 'turn_complete');
    assert.equal(completed.turnRecord.learner, 'The assay still confuses me.');
    assert.equal(completed.turnRecord.coachGuidance[0].text, guidance);
    assert.ok(!completed.turnRecord.learner.includes(guidance));
    assert.ok(trace.some((event) => event.type === 'coach_guidance_applied'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('auto mode plays both roles from the current transcript and returns after a bounded handoff', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-live-auto-mode-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        '--no-classifier',
        '--no-register-selection',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--no-trace',
        '--world',
        'world_005_marrick',
      ],
      initialInput: '/auto 1\n',
      stopWhen: (plain) => plain.includes('automation paused > auto turn cap'),
    });

    assert.match(result.plain, /AUTO mode · 1 turn · profile diligent/u);
    assert.match(result.plain, /learner\(auto\) > I would compare the metal residues first\./u);
    assert.match(result.plain, /tutor > Take the crucible as a fingerprint/u);
    assert.match(result.plain, /automation paused > auto turn cap/u);
    assert.match(result.plain, /session status > LEARNER · turn 2/u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('explanatory debug mode prints analysis, exact field calculations, and the register consequence', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-explanatory-debug-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        '--no-opening',
        '--no-classifier',
        '--register-policy',
        'random',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      initialInput: '/debug on\nThe assay still confuses me.\n',
      stopWhen: (plain) => plain.includes('debug explain > turn 1'),
    });

    assert.match(result.plain, /debug explain > on/u);
    assert.match(result.plain, /A · learner analysis/u);
    assert.match(result.plain, /B · calculations and field update/u);
    assert.match(result.plain, /mastery calculation: 0\.34×/u);
    assert.match(result.plain, /risk calculation: 0\.45×/u);
    assert.match(result.plain, /alignment calculation: 0\.30×/u);
    assert.match(result.plain, /momentum calculation: 0\.42×/u);
    assert.match(result.plain, /field updated for next turn: mastery=/u);
    assert.match(result.plain, /C · resulting register decision/u);
    assert.match(result.plain, /register change: initial choice →/u);
    assert.match(result.plain, /policy path: stack=random; activated=random/u);
    assert.match(result.plain, /explanatory debug: on/u);

    const traces = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    assert.ok(traces.some((event) => event.type === 'explanatory_debug_mode_changed' && event.enabled));
    assert.ok(traces.some((event) => event.type === 'explanatory_debug_output' && event.turn === 1));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
