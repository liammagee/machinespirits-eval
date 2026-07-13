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
    const response = input.includes('# Explanatory debug task')
      ? 'The learner is asking for orientation, so the central need is a concrete link between the assay and the evidence. The exchange leaves understanding tentative but gives the next turn a clearer starting point. You held a warm, re-anchoring stance because explanation still matters more than pressure.'
      : input.includes('Write learner turn')
        ? 'I would compare the metal residues first.'
        : 'Take the crucible as a fingerprint: which public mark would let you match it to one hand?';
    if (outputPath) fs.writeFileSync(outputPath, response);
    process.stdout.write(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: response } }) + '\\n');
  };
  setTimeout(finish, Number(process.env.FAKE_CODEX_DELAY_MS || 0));
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

function runInteractiveModelSwitchSequence({ tmp, timeoutMs = 12_000 }) {
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
      const tutorReplies = plain.match(/tutor > Take the crucible as a fingerprint/gu) || [];
      if (stage === 0 && tutorReplies.length >= 1) {
        stage = 1;
        child.stdin.write('/settings model codex.gpt-5.6-luna\n');
      } else if (stage === 1 && /new tutor model will reread all 2 earlier public messages/u.test(plain)) {
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
      stopWhen: (plain) => plain.includes('tutor > Take the crucible as a fingerprint'),
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

    assert.equal(calls.length, 2);
    assert.doesNotMatch(calls[0], /Conversation so far:/u);
    assert.match(calls[1], /Conversation so far:\nuser: First learner message\./u);
    assert.match(calls[1], /assistant: Take the crucible as a fingerprint/u);
    assert.match(calls[1], /Learner says:\nSecond learner message\./u);

    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const modelChange = events.find((event) => event.type === 'tutor_model_changed' && event.changed === true);
    assert.equal(modelChange.contextReplay.historyMode, 'full_public_replay');
    assert.equal(modelChange.contextReplay.publicMessageCount, 2);
    const laterTutorCall = events.find(
      (event) =>
        event.type === 'model_call' &&
        event.role === 'tutor_stub_tutor' &&
        event.request?.config?.messageHistoryMode === 'full_public_replay',
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
          } else if (!commandCompleted && plain.includes('learner(auto) >')) {
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
      assert.match(plain, /learner\(auto\) >/u);
      assert.match(plain, /session status > AUTO/u);
      assert.match(plain, /learning summary: automatic HTML on conclusion/u);
      assert.doesNotMatch(plain, /unknown command/u);
      assert.ok(plain.indexOf('learner(auto) >') < plain.indexOf('session status > AUTO'), plain);
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
      stopWhen: (plain) => plain.includes('tutor > Take the crucible as a fingerprint'),
    });

    assert.match(result.plain, /debug > off/u);
    assert.match(result.plain, /automatic explanations stopped/u);
    assert.doesNotMatch(result.plain, /turn id >/u);
    assert.doesNotMatch(result.plain, /learner classifier >/u);
    assert.doesNotMatch(result.plain, /tutor learner-DAG model >/u);
    assert.doesNotMatch(result.plain, /engagement stance >/u);
    assert.doesNotMatch(result.plain, /tutor DAG >/u);
    assert.doesNotMatch(result.plain, /debug explain > turn 1/u);
    assert.match(result.plain, /tokens unavailable, effort medium, style [a-z ]+, move [a-z ]+/u);
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
