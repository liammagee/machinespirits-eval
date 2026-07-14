import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pty from 'node-pty';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function plainTerminalText(value) {
  // Build the ESC char dynamically so the ANSI-strip regex carries no
  // control-character escape in a literal (no-control-regex).
  const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, 'gu');
  return String(value || '')
    .replace(ansi, '')
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
  const finish = () => {
    if (process.env.FAKE_CODEX_LOG) fs.appendFileSync(process.env.FAKE_CODEX_LOG, input + '\\n---CALL---\\n');
    const response = process.env.FAKE_CODEX_VALID_ANALYSIS === '1' && input.includes('# Current learner turn')
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
      : input.includes('# Explanatory debug task')
      ? 'The learner is asking for orientation, so the central need is a concrete link between the assay and the evidence. The exchange leaves understanding tentative but gives the next turn a clearer starting point. You held a warm, re-anchoring stance because explanation still matters more than pressure.'
      : input.includes('Write learner turn')
        ? 'I would compare the metal residues first.'
        : input.includes('[Tutor-only dramatic clue release]')
          ? "I see the point you are putting on the table.\\n\\nI'm going to give you another piece of information. Let's role-play it: I'll be the town assayer. Verrell alone draws the mint-yard crucible. Back to the case: Take the crucible as a fingerprint—which public mark would let you match it to one hand?"
          : 'I see the point you are putting on the table.\\n\\nTake the crucible as a fingerprint: which public mark would let you match it to one hand?';
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
    const followupTimers = followupInputs.map(({ delayMs, afterLogIncludes = null, afterPlainIncludes = null, text }) => {
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
    });
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

function runInteractiveModelSwitchSequence({ tmp, timeoutMs = 12_000, changeModel = true }) {
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
      // Response composition renders one public assistant message as two
      // visibly separated tutor beats. Count the development display marker
      // so those two display lines are not mistaken for two tutor turns.
      const tutorReplies = plain.match(/↳/gu) || [];
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

test('ordinary tutor turns replay the full public user/assistant history without a model change', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-default-context-replay-'));
  try {
    const result = await runInteractiveModelSwitchSequence({ tmp, changeModel: false });
    const calls = fs.readFileSync(result.logPath, 'utf8').split('\n---CALL---\n').filter(Boolean);

    assert.ok(calls.length >= 2);
    assert.doesNotMatch(calls[0], /Conversation so far:/u);
    assert.match(calls[1], /Conversation so far:\nuser: First learner message\./u);
    assert.match(
      calls[1],
      /assistant: I see the point you are putting on the table\.[\s\S]*Take the crucible as a fingerprint/u,
    );
    assert.match(calls[1], /Learner says:\nSecond learner message\./u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('learner messages sent before the tutor replies form one restart-safe compound turn', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-compound-learner-turn-'));
  try {
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
        'none',
      ],
      initialInput: 'The first clue is unclear.\n',
      followupInputs: [{ delayMs: 200, text: 'I mean the residue comparison specifically.\n' }],
      stopWhen: (plain) => plain.includes('Take the crucible as a fingerprint'),
      timeoutMs: 30_000,
      env: {
        FAKE_CODEX_DELAY_MS: '800',
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });

    assert.match(result.plain, /learner turn updated > added message 2; restarting the tutor with all 2 messages/u);
    assert.doesNotMatch(result.plain, /queued learner turn/u);
    assert.equal((result.plain.match(/tutor > I see the point you are putting on the table\./gu) || []).length, 1);

    const completedCalls = fs.readFileSync(result.logPath, 'utf8').split('\n---CALL---\n').filter(Boolean);
    // A cancelled external CLI process may finish logging during the restart;
    // the last completed call must be the compound turn that is shown.
    assert.ok(completedCalls.length >= 1);
    const completedCompoundCall = completedCalls.at(-1);
    assert.match(
      completedCompoundCall,
      /Learner says in 2 consecutive messages before your reply \(treat them as one compound turn\):[\s\S]*The first clue is unclear\.[\s\S]*I mean the residue comparison specifically\./u,
    );

    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const fragments = events.filter((event) => event.type === 'learner_turn_fragment_received');
    assert.equal(fragments.length, 2);
    assert.equal(fragments[0].compoundTurnId, fragments[1].compoundTurnId);
    assert.deepEqual(
      fragments.map((event) => event.text),
      ['The first clue is unclear.', 'I mean the residue comparison specifically.'],
    );
    assert.ok(events.some((event) => event.type === 'learner_turn_attempt_superseded' && event.revision === 2));
    assert.ok(
      events.some((event) => event.type === 'learner_turn_attempt_discarded' && event.replacedByRevision === 2),
    );

    const completedTurns = events.filter((event) => event.type === 'turn_complete');
    assert.equal(completedTurns.length, 1);
    assert.equal(
      completedTurns[0].turnRecord.learner,
      'The first clue is unclear.\nI mean the residue comparison specifically.',
    );
    assert.equal(completedTurns[0].turnRecord.learnerInput.messageCount, 2);
    assert.deepEqual(
      completedTurns[0].turnRecord.learnerMessages.map((message) => message.text),
      ['The first clue is unclear.', 'I mean the residue comparison specifically.'],
    );
    assert.ok(
      events.some(
        (event) => event.type === 'learner_turn_compound_committed' && event.revision === 2 && event.messageCount === 2,
      ),
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('optional thumbs feedback is attached to the next human learner message and guides the tutor privately', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-turn-feedback-'));
  try {
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
        'none',
      ],
      initialInput: 'First learner message.\n',
      followupInputs: [
        {
          afterPlainIncludes: 'optional tutor feedback >',
          text: '/down\nSecond learner message.\n',
        },
      ],
      stopWhen: (plain) => (plain.match(/optional tutor feedback >/gu) || []).length >= 2,
      timeoutMs: 12_000,
    });

    assert.match(result.plain, /tutor feedback > 👎 not helpful · private/u);
    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) =>
        fs
          .readFileSync(path.join(tmp, name), 'utf8')
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line)),
      );
    const secondTurn = events.find((event) => event.type === 'turn_complete' && event.turn === 2)?.turnRecord;
    assert.equal(secondTurn.learnerInput.tutorFeedback.rating, 'down');
    assert.equal(secondTurn.learnerInput.tutorFeedback.supplied, true);
    assert.equal(secondTurn.learnerMessages[0].tutorFeedback.rating, 'down');
    assert.equal(secondTurn.learner, 'Second learner message.');
    assert.equal(secondTurn.feedbackAdaptationPlan.rating, 'down');
    assert.equal(secondTurn.feedbackAdaptationPlan.requiresRealizationChange, true);
    assert.equal(secondTurn.feedbackObservation.feedback.helpfulness, -1);
    assert.equal(secondTurn.feedbackObservation.outcomes.subjectiveHelpfulness, -1);
    assert.ok(events.some((event) => event.type === 'tutor_feedback_observation' && event.turn === 2));
    assert.ok(
      events.some(
        (event) =>
          event.type === 'tutor_feedback_rating_recorded' &&
          event.turn === 1 &&
          event.record?.feedback?.helpfulness === -1,
      ),
    );

    const calls = fs.readFileSync(result.logPath, 'utf8').split('\n---CALL---\n').filter(Boolean);
    assert.match(calls.at(-1), /The learner marked your previous public response unhelpful/u);
    assert.match(calls.at(-1), /Private one-turn response adaptation contract/u);
    assert.match(calls.at(-1), /This contract expires after this tutor response/u);
    assert.match(calls.at(-1), /Do not mention the rating/u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test(
  'empty-prompt arrow keys rate the tutor immediately without taking over cursor movement',
  { skip: process.platform === 'win32', timeout: 15_000 },
  async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-arrow-feedback-'));
    try {
      installFakeCodex(tmp);
      let terminalOutput = '';
      let firstTurnSent = false;
      let arrowPressed = false;
      let secondTurnSent = false;
      let requestedExit = false;
      const terminal = pty.spawn(
        process.execPath,
        [
          'scripts/tutor-stub.js',
          '--no-opening',
          '--no-classifier',
          '--no-register-selection',
          '--no-closeout-report',
          '--no-interim-animation',
          '--no-stream',
          '--trace-dir',
          tmp,
          '--world',
          'none',
        ],
        {
          cwd: ROOT,
          cols: 120,
          rows: 24,
          name: 'xterm-color',
          env: {
            ...process.env,
            PATH: `${tmp}${path.delimiter}${process.env.PATH || ''}`,
            TERM: 'xterm-color',
            CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
            TUTOR_STUB_SUMMARY_OPEN: '0',
            TUTOR_STUB_REMEMBER_SETTINGS: '0',
          },
        },
      );

      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          terminal.kill();
          reject(new Error(`arrow-feedback terminal timed out\n${plainTerminalText(terminalOutput)}`));
        }, 12_000);
        terminal.onData((chunk) => {
          terminalOutput += chunk;
          const plain = plainTerminalText(terminalOutput);
          const feedbackRequests = plain.match(/optional tutor feedback >/gu) || [];
          if (!firstTurnSent && plain.includes('learner >')) {
            firstTurnSent = true;
            terminal.write('First learner message.\r');
          } else if (!arrowPressed && feedbackRequests.length >= 1) {
            arrowPressed = true;
            terminal.write('\x1b[C');
          } else if (!secondTurnSent && plain.includes('tutor feedback > 👍 helpful · private')) {
            secondTurnSent = true;
            terminal.write('Second learner message.\r');
          } else if (!requestedExit && feedbackRequests.length >= 2) {
            requestedExit = true;
            terminal.write('/quit\r');
          }
        });
        terminal.onExit(({ exitCode, signal }) => {
          clearTimeout(timer);
          if (exitCode === 0) resolve();
          else reject(new Error(`arrow-feedback terminal exited ${exitCode} (${signal})\n${terminalOutput}`));
        });
      });

      const plain = plainTerminalText(terminalOutput);
      assert.match(plain, /← 👎 not helpful · 👍 helpful → · empty prompt; no Enter/u);
      assert.match(plain, /tutor feedback > 👍 helpful · private/u);
      const events = fs
        .readdirSync(tmp)
        .filter((name) => name.endsWith('.jsonl'))
        .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      const selection = events.find(
        (event) =>
          event.type === 'tutor_turn_feedback_selected' &&
          event.inputSource === 'empty_prompt_right_arrow',
      );
      assert.equal(selection.rating, 'up');
      const secondTurn = events.find((event) => event.type === 'turn_complete' && event.turn === 2)?.turnRecord;
      assert.equal(secondTurn.learner, 'Second learner message.');
      assert.equal(secondTurn.learnerInput.tutorFeedback.rating, 'up');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  },
);

test('/reset cancels an in-flight tutor turn and reopens the same scenario without stale output', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-dialogue-reset-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
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
      initialInput: 'I think this sequence has gone wrong.\n',
      followupInputs: [{ delayMs: 150, text: '/reset\n' }],
      stopWhen: (plain) => plain.includes('dialogue reset > unfinished work cancelled; starting this scenario again'),
      timeoutMs: 12_000,
      env: {
        FAKE_CODEX_DELAY_MS: '2500',
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });

    assert.match(result.plain, /dialogue reset > unfinished work cancelled; starting this scenario again/u);
    assert.match(result.plain, /previous turns discarded · learner profile and settings kept/u);
    assert.doesNotMatch(result.plain, /tutor > Take the crucible as a fingerprint/u);
    assert.doesNotMatch(result.plain, /error: learner turn attempt was superseded/u);

    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    assert.equal(events.filter((event) => event.type === 'tutor_opening').length, 2);
    assert.equal(events.filter((event) => event.type === 'turn_complete').length, 0);
    assert.ok(
      events.some(
        (event) =>
          event.type === 'interactive_dialogue_reset' &&
          event.command === '/reset' &&
          event.interrupted === true &&
          event.interruptedLearnerTurn?.turn === 1,
      ),
    );
    assert.ok(
      events.some(
        (event) => event.type === 'history_clear' && event.reason === 'dialogue_reset' && event.interrupted === true,
      ),
    );
    assert.ok(
      events.some(
        (event) => event.type === 'learner_turn_attempt_discarded' && event.reason === 'dialogue_reset',
      ),
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('/reset escapes an in-flight automated sequence and returns control to learner mode', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-auto-reset-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
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
      initialInput: '/auto 2\n',
      followupInputs: [{ delayMs: 150, text: '/reset\n' }],
      stopWhen: (plain) => plain.includes('dialogue reset > unfinished work cancelled; starting this scenario again'),
      timeoutMs: 12_000,
      env: {
        FAKE_CODEX_DELAY_MS: '2500',
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });

    assert.match(result.plain, /dialogue reset > unfinished work cancelled; starting this scenario again/u);
    assert.doesNotMatch(result.plain, /A Diligent Learner \(auto\) >/u);
    assert.doesNotMatch(result.plain, /auto mode error:/u);

    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const reset = events.find((event) => event.type === 'interactive_dialogue_reset');
    assert.equal(reset?.command, '/reset');
    assert.match(reset?.interruptedAutoRunId || '', /:auto:/u);
    assert.equal(events.filter((event) => event.type === 'turn_complete').length, 0);
    assert.ok(events.some((event) => event.type === 'interactive_auto_discarded' && event.reason === 'dialogue_reset'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('a late learner fragment discards already-computed analysis state before regenerating every assessment', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-compound-analysis-restart-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        '--no-opening',
        '--dag',
        '--tutor-learner-dag',
        '--no-register-selection',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      initialInput: 'I do not follow the comparison.\n',
      followupInputs: [
        {
          afterLogIncludes: '# Current learner turn',
          text: 'Specifically, explain how the residue distinguishes a hand.\n',
        },
      ],
      stopWhen: (plain) => plain.includes('Take the crucible as a fingerprint'),
      timeoutMs: 20_000,
      env: {
        FAKE_CODEX_VALID_ANALYSIS: '1',
        FAKE_CODEX_ANALYSIS_DELAY_MS: '50',
        FAKE_CODEX_DELAY_MS: '2200',
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });

    const completedCalls = fs.readFileSync(result.logPath, 'utf8').split('\n---CALL---\n').filter(Boolean);
    const analysisCalls = completedCalls.filter((call) => call.includes('# Current learner turn'));
    const tutorCalls = completedCalls.filter((call) => call.includes('Learner says'));
    assert.equal(analysisCalls.length, 2);
    assert.match(analysisCalls[0], /# Current learner turn[\s\S]*I do not follow the comparison\./u);
    assert.doesNotMatch(analysisCalls[0], /Specifically, explain how the residue/u);
    assert.match(
      analysisCalls[1],
      /# Current learner turn[\s\S]*I do not follow the comparison\.[\s\S]*Specifically, explain how the residue distinguishes a hand\./u,
    );
    assert.equal(tutorCalls.length, 1);
    assert.match(
      tutorCalls[0],
      /Learner says in 2 consecutive messages before your reply[\s\S]*Specifically, explain how the residue distinguishes a hand\./u,
    );

    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const completedTurns = events.filter((event) => event.type === 'turn_complete');
    assert.equal(completedTurns.length, 1);
    assert.equal(completedTurns[0].turnRecord.learnerMessages.length, 2);
    assert.equal(
      completedTurns[0].turnRecord.classification.turn.summary,
      'The learner adds a specific clarification to the same turn.',
    );
    assert.equal(completedTurns[0].turnRecord.tutorLearnerDagModel.turn, 1);
    assert.deepEqual(completedTurns[0].turnRecord.tutorLearnerDagUpdate.accepted.adopt, []);
    assert.ok(
      events.some(
        (event) =>
          event.type === 'learner_turn_attempt_discarded' && event.revision === 1 && event.replacedByRevision === 2,
      ),
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('/quit writes a learner-centred HTML summary after a completed turn', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-learning-summary-exit-'));
  try {
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
      initialInput: 'The assay still confuses me.\n',
      stopWhen: (plain) => plain.includes('Take the crucible as a fingerprint'),
    });

    assert.match(result.plain, /learning summary >/u);
    const summaryFiles = fs.readdirSync(tmp).filter((name) => name.endsWith('-learning-summary.html'));
    assert.equal(summaryFiles.length, 1);
    const html = fs.readFileSync(path.join(tmp, summaryFiles[0]), 'utf8');
    assert.match(html, /Tutor stub · what we learned/u);
    assert.match(html, /The Light Shillings/u);
    assert.match(html, /Whose hand struck the false shillings/u);
    assert.match(html, /You chose to end the session here/u);
    assert.match(html, /The assay still confuses me/u);
    assert.match(html, /Take the crucible as a fingerprint/u);

    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    assert.ok(
      events.some(
        (event) =>
          event.type === 'learning_summary_html' &&
          event.reason === 'exit' &&
          event.turns === 1 &&
          event.natural === false &&
          event.launched === false,
      ),
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('a live tutor-model change replays the full public user/assistant history on every later tutor call', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-model-context-replay-'));
  try {
    const result = await runInteractiveModelSwitchSequence({ tmp });
    const calls = fs.readFileSync(result.logPath, 'utf8').split('\n---CALL---\n').filter(Boolean);

    assert.ok(calls.length >= 2);
    assert.doesNotMatch(calls[0], /Conversation so far:/u);
    assert.match(calls[1], /Conversation so far:\nuser: First learner message\./u);
    assert.match(
      calls[1],
      /assistant: I see the point you are putting on the table\.[\s\S]*Take the crucible as a fingerprint/u,
    );
    assert.match(calls[1], /Learner says:\nSecond learner message\./u);

    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const modelChange = events.find((event) => event.type === 'tutor_model_changed' && event.changed === true);
    assert.equal(modelChange.contextReplay.historyMode, 'full_public_replay');
    assert.equal(modelChange.contextReplay.alreadyActive, true);
    assert.equal(modelChange.contextReplay.publicMessageCount, 2);
    const laterTutorCall = events.find(
      (event) =>
        event.type === 'model_call' &&
        event.role === 'tutor_stub_tutor' &&
        event.request?.config?.messageHistoryMode === 'full_public_replay' &&
        event.request?.config?.replayedMessageCount === 2,
    );
    assert.equal(laterTutorCall.request.config.replayedMessageCount, 2);
    assert.equal(laterTutorCall.request.config.replayedUserMessageCount, 1);
    assert.equal(laterTutorCall.request.config.replayedAssistantMessageCount, 1);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test(
  'auto mode keeps a separate editable command line while model output is generated',
  { skip: process.platform === 'win32', timeout: 15_000 },
  async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-concurrent-auto-terminal-'));
    try {
      installFakeCodex(tmp);
      let terminalOutput = '';
      let autoStarted = false;
      let partialCommandEntered = false;
      let commandCompleted = false;
      let requestedExit = false;
      const terminal = pty.spawn(
        process.execPath,
        [
          'scripts/tutor-stub.js',
          '--no-opening',
          '--no-classifier',
          '--no-register-selection',
          '--no-closeout-report',
          '--no-stream',
          '--trace-dir',
          tmp,
          '--world',
          'world_005_marrick',
        ],
        {
          cwd: ROOT,
          cols: 120,
          rows: 24,
          name: 'xterm-color',
          env: {
            ...process.env,
            PATH: `${tmp}${path.delimiter}${process.env.PATH || ''}`,
            TERM: 'xterm-color',
            FAKE_CODEX_DELAY_MS: '800',
            CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
            TUTOR_STUB_SUMMARY_OPEN: '0',
            TUTOR_STUB_REMEMBER_SETTINGS: '0',
          },
        },
      );

      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          terminal.kill();
          reject(new Error(`concurrent auto terminal timed out\n${plainTerminalText(terminalOutput)}`));
        }, 12_000);
        terminal.onData((chunk) => {
          terminalOutput += chunk;
          const plain = plainTerminalText(terminalOutput);
          if (!autoStarted && plain.includes('learner >')) {
            autoStarted = true;
            terminal.write('/auto 1\r');
          } else if (!partialCommandEntered && plain.includes('calling auto learner')) {
            partialCommandEntered = true;
            terminal.write('/sta');
          } else if (!commandCompleted && plain.includes('A Diligent Learner (auto) >')) {
            commandCompleted = true;
            terminal.write('tus\r');
          } else if (!requestedExit && plain.includes('session status > AUTO')) {
            requestedExit = true;
            terminal.write('/quit\r');
          }
        });
        terminal.onExit(({ exitCode, signal }) => {
          clearTimeout(timer);
          if (exitCode === 0) resolve();
          else reject(new Error(`concurrent auto terminal exited ${exitCode} (${signal})\n${terminalOutput}`));
        });
      });

      const plain = plainTerminalText(terminalOutput);
      assert.match(plain, /calling auto learner[^\n]*\nauto > \/sta/u);
      assert.match(plain, /A Diligent Learner \(auto\) >/u);
      assert.match(plain, /session status > AUTO/u);
      assert.match(plain, /learning summary: automatic HTML on conclusion/u);
      assert.doesNotMatch(plain, /unknown command/u);
      assert.ok(plain.indexOf('A Diligent Learner (auto) >') < plain.indexOf('session status > AUTO'), plain);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  },
);

test(
  'typing slash opens a filtered command palette and Tab completes the selection',
  { skip: process.platform === 'win32', timeout: 15_000 },
  async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-slash-palette-'));
    try {
      installFakeCodex(tmp);
      let terminalOutput = '';
      let slashEntered = false;
      let filterEntered = false;
      let tabPressed = false;
      let statusSubmitted = false;
      let requestedExit = false;
      const terminal = pty.spawn(
        process.execPath,
        [
          'scripts/tutor-stub.js',
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
        {
          cwd: ROOT,
          cols: 120,
          rows: 30,
          name: 'xterm-color',
          env: {
            ...process.env,
            PATH: `${tmp}${path.delimiter}${process.env.PATH || ''}`,
            TERM: 'xterm-color',
            CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
            TUTOR_STUB_SUMMARY_OPEN: '0',
            TUTOR_STUB_REMEMBER_SETTINGS: '0',
          },
        },
      );

      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          terminal.kill();
          reject(new Error(`slash palette terminal timed out\n${plainTerminalText(terminalOutput)}`));
        }, 12_000);
        terminal.onData((chunk) => {
          terminalOutput += chunk;
          const plain = plainTerminalText(terminalOutput);
          if (!slashEntered && plain.includes('learner >')) {
            slashEntered = true;
            terminal.write('/');
          } else if (!filterEntered && plain.includes('slash commands ·') && plain.includes('available')) {
            filterEntered = true;
            terminal.write('sta');
          } else if (!tabPressed && plain.includes('1 match for /sta')) {
            tabPressed = true;
            terminal.write('\t');
          } else if (!statusSubmitted && plain.includes('learner > /status')) {
            statusSubmitted = true;
            terminal.write('\r');
          } else if (!requestedExit && plain.includes('session status > LEARNER')) {
            requestedExit = true;
            terminal.write('/quit\r');
          }
        });
        terminal.onExit(({ exitCode, signal }) => {
          clearTimeout(timer);
          if (exitCode === 0) resolve();
          else reject(new Error(`slash palette terminal exited ${exitCode} (${signal})\n${terminalOutput}`));
        });
      });

      const plain = plainTerminalText(terminalOutput);
      assert.match(plain, /slash commands · \d+ available/u);
      assert.match(plain, /1 match for \/sta/u);
      assert.match(plain, /learner > \/status/u);
      assert.match(plain, /session status > LEARNER/u);
      assert.doesNotMatch(plain, /unknown command/u);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  },
);

test(
  'prompt shortcuts select and replace words and whole lines',
  { skip: process.platform === 'win32', timeout: 15_000 },
  async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-line-selection-'));
    try {
      let terminalOutput = '';
      let coachSelected = false;
      let wordSubmitted = false;
      let lineSubmitted = false;
      let requestedExit = false;
      const terminal = pty.spawn(
        process.execPath,
        [
          'scripts/tutor-stub.js',
          '--no-opening',
          '--no-classifier',
          '--no-register-selection',
          '--no-closeout-report',
          '--no-interim-animation',
          '--no-stream',
          '--no-trace',
          '--world',
          'none',
        ],
        {
          cwd: ROOT,
          cols: 120,
          rows: 24,
          name: 'xterm-color',
          env: {
            ...process.env,
            TERM: 'xterm-color',
            TUTOR_STUB_SUMMARY_OPEN: '0',
            TUTOR_STUB_REMEMBER_SETTINGS: '0',
          },
        },
      );

      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          terminal.kill();
          reject(new Error(`line-selection terminal timed out\n${plainTerminalText(terminalOutput)}`));
        }, 12_000);
        terminal.onData((chunk) => {
          terminalOutput += chunk;
          const plain = plainTerminalText(terminalOutput);
          if (!coachSelected && plain.includes('learner >')) {
            coachSelected = true;
            terminal.write('/coach\r');
          } else if (!wordSubmitted && plain.includes('coach >')) {
            wordSubmitted = true;
            terminal.write('alpha beta gamma\x1b[1;4Ddelta\r');
          } else if (!lineSubmitted && plain.includes('coach queued > alpha beta delta')) {
            lineSubmitted = true;
            terminal.write('discard this\x1b[1;2Hreplacement\r');
          } else if (!requestedExit && plain.includes('coach queued > replacement')) {
            requestedExit = true;
            terminal.write('/quit\r');
          }
        });
        terminal.onExit(({ exitCode, signal }) => {
          clearTimeout(timer);
          if (exitCode === 0) resolve();
          else reject(new Error(`line-selection terminal exited ${exitCode} (${signal})\n${terminalOutput}`));
        });
      });

      const plain = plainTerminalText(terminalOutput);
      assert.match(plain, /coach queued > alpha beta delta/u);
      assert.match(plain, /coach queued > replacement/u);
      assert.doesNotMatch(plain, /coach queued > alpha beta deltagamma/u);
      assert.doesNotMatch(plain, /coach queued > replacementdiscard this/u);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  },
);

test('a non-interactive single run also writes its learning summary', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-learning-summary-once-'));
  try {
    installFakeCodex(tmp);
    const result = spawnSync(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--once',
        'I would compare the metal residues first.',
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
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${tmp}${path.delimiter}${process.env.PATH || ''}`,
          CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
        },
      },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.match(plainTerminalText(result.stdout), /learning summary >/u);
    const summaryFiles = fs.readdirSync(tmp).filter((name) => name.endsWith('-learning-summary.html'));
    assert.equal(summaryFiles.length, 1);
    const html = fs.readFileSync(path.join(tmp, summaryFiles[0]), 'utf8');
    assert.match(html, /I would compare the metal residues first/u);
    assert.match(html, /The requested single turn is complete/u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

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
      stopWhen: (plain) => plain.includes('Take the crucible as a fingerprint'),
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

test('unsafe coach guidance is blocked and the tutor continues from a public-only rebuilt prompt', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-coach-boundary-recovery-'));
  try {
    const futureClue =
      "The old founder's tools were never sold off. The inventory of his estate, sworn and unredeemed, leaves his graving-irons to his widow alone — among them the worn burin with the sprung heel, kept in Edony's keeping these ten years.";
    const result = await runInteractive({
      tmp,
      args: [
        '--no-opening',
        '--no-classifier',
        '--no-register-selection',
        '--dag',
        '--tutor-learner-dag',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      initialInput: `/coach ${futureClue}\n/learner\nThe assay still confuses me.\n`,
      stopWhen: (plain) => plain.includes('Take the crucible as a fingerprint'),
    });

    assert.doesNotMatch(result.plain, /Speaking-tutor prompt crossed the private-planner boundary/u);
    const trace = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const blocked = trace.find((event) => event.type === 'tutor_speaker_privilege_audit');
    assert.ok(blocked, 'expected the contaminated prompt to be blocked before a model call');
    assert.ok(blocked.audit.issues.some((issue) => issue.code === 'future_evidence_surface'));
    const recovery = trace.find((event) => event.type === 'tutor_speaker_privilege_recovery');
    assert.equal(recovery?.applied, true);
    assert.equal(recovery?.speakerPrivilegeAudit?.ok, true);
    assert.equal(recovery?.promptAudit?.ok, true);
    const tutorCall = trace.find((event) => event.type === 'model_call' && event.role === 'tutor_stub_tutor');
    assert.ok(tutorCall, 'expected the tutor model call to proceed after safe recovery');
    assert.equal(tutorCall.request.config.speakerPrivilegeAudit.recovery.applied, true);
    const tutorPrompt = tutorCall.request.messages.at(-1)?.content || '';
    assert.doesNotMatch(tutorPrompt, /worn burin with the sprung heel/u);
    assert.doesNotMatch(tutorPrompt, /Private coach guidance/u);
    assert.ok(trace.some((event) => event.type === 'turn_complete'));
    assert.equal(trace.some((event) => event.type === 'model_call_error'), false);
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
    assert.match(result.plain, /A Diligent Learner \(auto\) > I would compare the metal residues first\./u);
    assert.match(result.plain, /Take the crucible as a fingerprint/u);
    assert.match(result.plain, /automation paused > auto turn cap/u);
    assert.match(result.plain, /session status > LEARNER · turn 2/u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('technical explanatory debug mode prints exact field calculations and the register consequence', async () => {
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
      initialInput: '/debug on technical\nThe assay still confuses me.\n',
      stopWhen: (plain) => plain.includes('debug explain > turn 1'),
    });

    assert.match(result.plain, /debug > on · technical details/u);
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
    assert.match(result.plain, /explanations: on \(technical details\)/u);

    const traces = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    assert.ok(
      traces.some(
        (event) => event.type === 'explanatory_debug_mode_changed' && event.enabled && event.format === 'technical',
      ),
    );
    assert.ok(
      traces.some(
        (event) => event.type === 'explanatory_debug_output' && event.turn === 1 && event.format === 'technical',
      ),
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('debug off suppresses automatic technical diagnostics but keeps the compact stance line', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-debug-off-'));
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
      initialInput: '/debug on technical\n/debug off\nThe assay still confuses me.\n',
      stopWhen: (plain) => plain.includes('Take the crucible as a fingerprint'),
    });

    assert.match(result.plain, /debug > off/u);
    assert.match(result.plain, /automatic explanations stopped/u);
    assert.doesNotMatch(result.plain, /turn id >/u);
    assert.doesNotMatch(result.plain, /learner classifier >/u);
    assert.doesNotMatch(result.plain, /tutor learner-DAG model >/u);
    assert.doesNotMatch(result.plain, /engagement stance >/u);
    assert.doesNotMatch(result.plain, /tutor DAG >/u);
    assert.doesNotMatch(result.plain, /debug explain > turn 1/u);
    assert.match(
      result.plain,
      /tokens unavailable, effort medium, style [a-z ]+, move [a-z ]+, character [^,\n]+/u,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('explanatory debug defaults to concise LLM-written prose', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-explanatory-debug-prose-'));
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
      stopWhen: (plain) => plain.includes('debug > turn 1 · prose'),
    });

    assert.match(result.plain, /debug > on · plain explanation/u);
    assert.match(result.plain, /debug > turn 1 · prose/u);
    assert.match(result.plain, /The learner is asking for orientation/u);
    assert.match(result.plain, /You held a warm, re-anchoring stance/u);
    assert.doesNotMatch(result.plain, /A · learner analysis/u);
    assert.doesNotMatch(result.plain, /mastery calculation/u);
    assert.match(result.plain, /technical evidence: \/debug technical/u);
    assert.match(result.plain, /explanations: on \(plain\)/u);
    assert.match(fs.readFileSync(result.logPath, 'utf8'), /# Explanatory debug task/u);

    const traces = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    assert.ok(traces.some((event) => event.type === 'model_call' && event.role === 'tutor_stub_explanatory_debug'));
    assert.ok(
      traces.some(
        (event) =>
          event.type === 'explanatory_debug_output' &&
          event.turn === 1 &&
          event.format === 'prose' &&
          event.generated === true,
      ),
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
