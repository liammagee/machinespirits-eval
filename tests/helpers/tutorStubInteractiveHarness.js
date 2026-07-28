import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pty from 'node-pty';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// Fixtures that inspect a due clue on the first tutor turn opt into an
// accelerated schedule explicitly; steady 1x now preserves Marrick's authored
// first release at turn 2.
const FIRST_TURN_CLUE_ARGS = ['--release-speed', '2'];
const RUN_CONCURRENT_PTY_IN_CI = process.env.TUTOR_STUB_RUN_CONCURRENT_PTY_TEST === '1';
const CONCURRENT_PTY_TIMEOUT_MS = RUN_CONCURRENT_PTY_IN_CI ? 30_000 : 12_000;
const CONCURRENT_PTY_TEST_TIMEOUT_MS = RUN_CONCURRENT_PTY_IN_CI ? 35_000 : 15_000;

function plainTerminalText(value) {
  // Build the ESC char dynamically so the ANSI-strip regex carries no
  // control-character escape in a literal (no-control-regex).
  const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, 'gu');
  return String(value || '')
    .replace(ansi, '')
    .replace(/\r/gu, '');
}

function readTutorStubTraceEvents(directory) {
  return fs
    .readdirSync(directory)
    .filter((name) => name.endsWith('.jsonl'))
    .flatMap((name) => fs.readFileSync(path.join(directory, name), 'utf8').trim().split('\n'))
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

// A first draft that fails on its own checks rather than on the ones that go on
// to reject the recovery. The pass is offered only when the recovery's finding
// is new, so a fixture whose two drafts fail identically would be testing the
// skip rather than the disclosure.
const SELF_CORRECTION_FIRST_DRAFT_FIXTURE = [
  'I keep your point about “First learner message” in view.',
  'Which public mark would let you match it to one hand?',
  'What does that let us carry forward about “First learner message”?',
].join(' ');

// The turn a tutor writes when it takes the offered self-correction pass: a
// preface saying it nearly went elsewhere, then the answer the learner is owed.
const SELF_CORRECTION_FIXTURE = [
  'I was about to answer a different question.',
  'I keep your point about “First learner message” in view before we develop it.',
  'I set the public record under examination and mark the claim’s limit.',
  'Keep only what the public evidence already shows.',
  'What does that let us carry forward about “First learner message”?',
].join(' ');

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
  const finish = () => {
    if (process.env.FAKE_CODEX_LOG) fs.appendFileSync(process.env.FAKE_CODEX_LOG, input + '\\n---CALL---\\n');
    const response = process.env.FAKE_CODEX_FIXTURE_MODE === 'self_correction' && input.includes('SELF-CORRECTION PASS.')
      ? ${JSON.stringify(SELF_CORRECTION_FIXTURE)}
      : process.env.FAKE_CODEX_VALID_ANALYSIS === '1' && input.includes('# Current learner turn')
      ? JSON.stringify({
          classification: {
            turn: {
              summary: 'The learner adds a specific clarification to the same turn.',
              request_type: 'conceptual_clarity_request',
              discourse_move: 'repair_request',
              evidence_use: 'none',
              epistemic_stance: 'confused',
              affect: 'engaged',
              agency: 'steering',
              scores: {
                conceptual_engagement: { score: 2, reason: 'The learner identifies the unclear comparison.' },
                epistemic_readiness: { score: 3, reason: 'The learner narrows the request.' }
              },
              pedagogical_need: 'Explain the residue comparison concretely.'
            },
            overall: {
              summary: 'The learner is actively refining a request for clarity.',
              trajectory: 'more specific',
              recurring_pattern: 'none yet',
              current_state: 'seeking a concrete explanation',
              next_best_tutor_move: 'Answer the refined clarification.'
            }
          },
          learner_record: {
            human_discourse: { proof_status: 'unclear' },
            notes: 'No proof update.'
          }
        })
      : input.includes('# CLI director question')
        ? 'Use /tutor adversarial_teacher, then choose a demanding mixed learner with /learner affective_resistant. The director answer changes nothing by itself; after this answer you return to the learner prompt.'
      : input.includes('# Character restatement task')
        ? 'Let me rephrase that. Challenge the town’s first answer within the assay itself: whose hand struck the false shillings passed at the Marrick fair, and what should we examine first?'
      : input.includes('# Explanatory debug task')
      ? 'The learner is asking for orientation, so the central need is a concrete link between the assay and the evidence. The exchange leaves understanding tentative but gives the next turn a clearer starting point. You held a warm, re-anchoring stance because explanation still matters more than pressure.'
      : process.env.FAKE_CODEX_LIGHT_RESPONSE === '1' && input.includes('Learner says')
        ? 'You are frustrated and still comparing the residue, so I set the assay ledger beside the crucible and mark only what the public evidence can support. The residue test asks whether this alloy matches one crucible uniquely; use that single comparison before naming any hand. Which public residue mark can you connect next?'
      : input.includes('Write learner turn')
        ? 'I would compare the metal residues first.'
        : input.includes('[Tutor-only dramatic clue release]')
          ? "I see the point you are putting on the table. “I am tapping the mint-yard register: Verrell alone draws the mint-yard crucible.” Take the crucible as a fingerprint—which public mark would let you match it to one hand?"
          : process.env.FAKE_CODEX_FIXTURE_MODE === 'self_correction' && !input.includes('[End tutor-only repair instruction]')
            ? ${JSON.stringify(SELF_CORRECTION_FIRST_DRAFT_FIXTURE)}
          : 'I see the point you are putting on the table. Take the crucible as a fingerprint: which public mark would let you match it to one hand?';
    if (outputPath) fs.writeFileSync(outputPath, response);
    process.stdout.write(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: response } }) + '\\n');
  };
  const delay = input.includes('# Current learner turn')
    ? Number(process.env.FAKE_CODEX_ANALYSIS_DELAY_MS || process.env.FAKE_CODEX_DELAY_MS || 0)
    : Number(process.env.FAKE_CODEX_DELAY_MS || 0);
  setTimeout(finish, delay);
});
`,
    'utf8',
  );
  fs.chmodSync(fakeCodex, 0o755);
  return fakeCodex;
}

function runInteractive({ tmp, args, initialInput, followupInputs = [], stopWhen, timeoutMs = 10_000, env = {} }) {
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
        TUTOR_STUB_OPENING_REALIZER: 'deterministic',
        ...env,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let stopping = false;
    const followupTimers = followupInputs.map(
      ({ delayMs, afterLogIncludes = null, afterPlainIncludes = null, text }) => {
        if (afterLogIncludes) {
          const interval = setInterval(() => {
            if (!fs.existsSync(logPath) || !fs.readFileSync(logPath, 'utf8').includes(afterLogIncludes)) return;
            clearInterval(interval);
            if (!child.killed && child.stdin.writable) child.stdin.write(text);
          }, 25);
          return interval;
        }
        if (afterPlainIncludes) {
          const interval = setInterval(() => {
            if (!plainTerminalText(stdout).includes(afterPlainIncludes)) return;
            clearInterval(interval);
            if (!child.killed && child.stdin.writable) child.stdin.write(text);
          }, 25);
          return interval;
        }
        return setTimeout(() => {
          if (!child.killed && child.stdin.writable) child.stdin.write(text);
        }, delayMs);
      },
    );
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
      for (const followupTimer of followupTimers) clearTimeout(followupTimer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      for (const followupTimer of followupTimers) clearTimeout(followupTimer);
      if (code !== 0) {
        reject(new Error(`interactive mode test exited ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`));
        return;
      }
      resolve({ stdout, stderr, plain: plainTerminalText(stdout), logPath });
    });
    child.stdin.write(initialInput);
  });
}

function runInteractiveModelSwitchSequence({ tmp, timeoutMs = 12_000, changeModel = true, passthrough = true }) {
  installFakeCodex(tmp);
  const logPath = path.join(tmp, 'fake-codex-input.log');
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--no-opening',
        '--no-classifier',
        '--no-register-selection',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--no-turn-feedback',
        ...(passthrough ? ['--passthrough'] : []),
        '--trace-dir',
        tmp,
        '--world',
        'none',
        '--history-turns',
        '1',
      ],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          PATH: `${tmp}${path.delimiter}${process.env.PATH || ''}`,
          FAKE_CODEX_LOG: logPath,
          CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
    let stdout = '';
    let stderr = '';
    let stage = 0;
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`model switch sequence timed out\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      const plain = plainTerminalText(stdout);
      // Response composition is one continuous public tutor utterance even
      // though uptake and development remain separately auditable internally.
      const tutorReplies = plain.match(/tutor >/gu) || [];
      if (stage === 0 && tutorReplies.length >= 1) {
        if (changeModel) {
          stage = 1;
          child.stdin.write('/settings model codex.gpt-5.6-luna\n');
        } else {
          stage = 2;
          child.stdin.write('Second learner message.\n');
        }
      } else if (stage === 1 && /new tutor model will continue replaying all 2 earlier public messages/u.test(plain)) {
        stage = 2;
        child.stdin.write('Second learner message.\n');
      } else if (stage === 2 && tutorReplies.length >= 2) {
        stage = 3;
        child.stdin.end('/quit\n');
      }
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`model switch sequence exited ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`));
        return;
      }
      resolve({ stdout, stderr, plain: plainTerminalText(stdout), logPath });
    });
    child.stdin.write('First learner message.\n');
  });
}

export {
  assert,
  spawn,
  spawnSync,
  fs,
  os,
  path,
  pty,
  test,
  ROOT,
  FIRST_TURN_CLUE_ARGS,
  RUN_CONCURRENT_PTY_IN_CI,
  CONCURRENT_PTY_TIMEOUT_MS,
  CONCURRENT_PTY_TEST_TIMEOUT_MS,
  plainTerminalText,
  readTutorStubTraceEvents,
  installFakeCodex,
  runInteractive,
  runInteractiveModelSwitchSequence,
};
