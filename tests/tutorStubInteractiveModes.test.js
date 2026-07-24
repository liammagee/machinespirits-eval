import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pty from 'node-pty';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
    assert.match(calls[1], /Latest message:\nSecond learner message\./u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('ordinary invalid tutor drafts recover through a progression-safe deterministic fallback', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-ordinary-progression-fallback-'));
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
        '--no-turn-feedback',
        '--trace-dir',
        tmp,
        '--world',
        'none',
      ],
      initialInput: 'First learner message.\n',
      stopWhen: (plain) => plain.includes('What does that let us carry forward about “First learner message”?'),
      timeoutMs: 15_000,
    });

    assert.match(result.plain, /I keep your point about “First learner message” in view/iu);
    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const accounting = events.find((event) => event.type === 'tutor_response_guard_accounting')?.accounting;
    assert.ok(accounting);
    assert.equal(accounting.outcome, 'guarded_deterministic_fallback');
    assert.deepEqual(
      accounting.attempts.map((attempt) => attempt.kind),
      ['original_candidate', 'plain_recovery_candidate', 'deterministic_fallback'],
    );
    assert.equal(accounting.attempts[0].audits.liveTurnProgressionAudit.ok, false);
    assert.equal(accounting.attempts[1].audits.liveTurnProgressionAudit.ok, false);
    assert.equal(accounting.finalDelivery.source, 'deterministic_fallback');
    assert.equal(accounting.finalDelivery.auditOk, true);
    assert.equal(accounting.attempts[2].audits.liveTurnProgressionAudit.ok, true);
    assert.equal(accounting.attempts[2].audits.liveTurnProgressionAudit.observed.question_count, 1);
    assert.deepEqual(accounting.attempts[2].audits.liveTurnProgressionAudit.issues, []);
    const failureEvents = events.filter((event) => event.type === 'turn_failure_recorded');
    assert.ok(failureEvents.some((event) => event.phase === 'incremental' && event.turn === 1));
    const sealedFailure = failureEvents.find((event) => event.phase === 'sealed' && event.turn === 1);
    assert.ok(sealedFailure);
    assert.equal(sealedFailure.record.run.sealed, true);
    assert.equal(sealedFailure.record.training.trainingLicensed, false);
    assert.ok(sealedFailure.failureModes.some((mode) => mode.startsWith('guard.live_turn_progression_v1.')));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('consecutive ordinary deterministic recoveries vary without weakening progression or repetition guards', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-consecutive-progression-fallback-'));
  try {
    const result = await runInteractiveModelSwitchSequence({
      tmp,
      changeModel: false,
      passthrough: false,
      timeoutMs: 15_000,
    });
    assert.equal((result.plain.match(/safe fallback used/gu) || []).length, 2);

    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const accountings = events
      .filter((event) => event.type === 'tutor_response_guard_accounting')
      .map((event) => event.accounting);
    assert.equal(accountings.length, 2);
    assert.notEqual(accountings[0].finalDelivery.candidate.text, accountings[1].finalDelivery.candidate.text);
    for (const accounting of accountings) {
      assert.equal(accounting.outcome, 'guarded_deterministic_fallback');
      assert.equal(accounting.finalDelivery.auditOk, true);
      assert.equal(accounting.finalDelivery.audits.liveTurnProgressionAudit.ok, true);
      assert.equal(accounting.finalDelivery.audits.repetitionAudit.ok, true);
    }
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
      stopWhen: (plain) => plain.includes('safe fallback used'),
      timeoutMs: 30_000,
      env: {
        FAKE_CODEX_DELAY_MS: '800',
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });

    assert.match(result.plain, /learner turn updated > added message 2; restarting the tutor with all 2 messages/u);
    assert.doesNotMatch(result.plain, /queued learner turn/u);
    assert.equal((result.plain.match(/tutor >/gu) || []).length, 1);

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
    assert.equal(completedTurns[0].turnRecord.learnerResponseProvenance.authorship, 'human');
    assert.deepEqual(
      completedTurns[0].turnRecord.learnerMessages.map((message) => message.provenance.authorship),
      ['human', 'human'],
    );
    assert.ok(
      events.some(
        (event) => event.type === 'learner_response_provenance_recorded' && event.provenance.authorship === 'human',
      ),
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

test('/use records an unchanged mixed learner suggestion as AI-authored with human acceptance', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-mixed-learner-provenance-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        '--mixed-learner',
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
      initialInput: '\n\n',
      followupInputs: [{ afterPlainIncludes: 'learner suggestion ready >', text: '/use\n' }],
      stopWhen: (plain) => (plain.match(/optional tutor feedback >/gu) || []).length >= 2,
      timeoutMs: 15_000,
      env: {
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });

    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const turn = events.find((event) => event.type === 'turn_complete')?.turnRecord;
    assert.ok(turn, result.plain);
    assert.equal(turn.learnerResponseProvenance.authorship, 'ai');
    assert.equal(turn.learnerResponseProvenance.origin, 'mixed_suggestion_accepted');
    assert.equal(turn.learnerResponseProvenance.inputMethod, 'slash_use');
    assert.equal(turn.learnerResponseProvenance.humanInLoop, true);
    assert.equal(turn.learnerMessages[0].provenance.aiGenerated, true);
    assert.ok(
      events.some(
        (event) =>
          event.type === 'mixed_learner_suggestion_accepted' && event.learnerResponseProvenance.authorship === 'ai',
      ),
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test(
  'editing a Tab-inserted mixed learner suggestion records hybrid authorship',
  { skip: process.platform === 'win32', timeout: 15_000 },
  async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-edited-mixed-provenance-'));
    try {
      installFakeCodex(tmp);
      let terminalOutput = '';
      let submitted = false;
      let submissionScheduled = false;
      let requestedExit = false;
      const terminal = pty.spawn(
        process.execPath,
        [
          'scripts/tutor-stub.js',
          '--mixed-learner',
          '--auto-learner-profile',
          'diligent',
          '--release-speed',
          '1',
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
          cols: 140,
          rows: 30,
          name: 'xterm-color',
          env: {
            ...process.env,
            PATH: `${tmp}${path.delimiter}${process.env.PATH || ''}`,
            CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
            TUTOR_STUB_OPENING_REALIZER: 'deterministic',
            TUTOR_STUB_SUMMARY_OPEN: '0',
            TUTOR_STUB_REMEMBER_SETTINGS: '0',
          },
        },
      );

      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          terminal.kill();
          reject(new Error(`edited mixed provenance terminal timed out\n${plainTerminalText(terminalOutput)}`));
        }, 12_000);
        terminal.onData((chunk) => {
          terminalOutput += chunk;
          const plain = plainTerminalText(terminalOutput);
          const feedbackCount = (plain.match(/optional tutor feedback >/gu) || []).length;
          if (
            !submissionScheduled &&
            plain.includes('learner suggestion ready >') &&
            plain.includes('A Diligent Learner >') &&
            feedbackCount >= 1
          ) {
            submissionScheduled = true;
            setTimeout(() => {
              if (requestedExit) return;
              terminal.write('\t');
              setTimeout(() => {
                if (requestedExit) return;
                submitted = true;
                terminal.write(' carefully\r');
              }, 100);
            }, 100);
          } else if (submitted && !requestedExit && feedbackCount >= 2) {
            requestedExit = true;
            terminal.write('/quit\r');
          }
        });
        terminal.onExit(({ exitCode, signal }) => {
          clearTimeout(timer);
          if (exitCode === 0) resolve();
          else reject(new Error(`edited mixed provenance terminal exited ${exitCode} (${signal})\n${terminalOutput}`));
        });
      });

      const events = fs
        .readdirSync(tmp)
        .filter((name) => name.endsWith('.jsonl'))
        .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      const turn = events.find((event) => event.type === 'turn_complete')?.turnRecord;
      assert.ok(turn, plainTerminalText(terminalOutput));
      assert.match(turn.learner, /carefully$/u);
      assert.equal(turn.learnerResponseProvenance.authorship, 'hybrid');
      assert.equal(turn.learnerResponseProvenance.origin, 'mixed_suggestion_edited');
      assert.equal(turn.learnerResponseProvenance.inputMethod, 'tab_completion_then_edit');
      assert.equal(turn.learnerResponseProvenance.humanGenerated, true);
      assert.equal(turn.learnerResponseProvenance.aiGenerated, true);
      assert.ok(events.some((event) => event.type === 'mixed_learner_suggestion_inserted'));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  },
);

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
        (event) => event.type === 'tutor_turn_feedback_selected' && event.inputSource === 'empty_prompt_right_arrow',
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
      events.some((event) => event.type === 'learner_turn_attempt_discarded' && event.reason === 'dialogue_reset'),
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

test('/demo runs a bounded live tour, writes inspectable evidence, and returns control', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-guided-demo-'));
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
      initialInput: '/demo 1\n',
      stopWhen: (plain) => plain.includes('demonstration complete >'),
      timeoutMs: 15_000,
      env: {
        TUTOR_STUB_TRANSCRIPT_OPEN: '0',
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });

    assert.match(result.plain, /guided harness demonstration · 1 live turn/u);
    assert.match(
      result.plain,
      /limited tour: learner interpretation, reasoning-map tracking, adaptive teaching style, authored evidence DAG are off/u,
    );
    assert.match(result.plain, /A Diligent Learner \(auto\) >/u);
    assert.match(result.plain, /demo readout · learner interpretation/u);
    assert.match(result.plain, /demo readout · inspectable evidence/u);
    assert.match(result.plain, /transcript HTML >/u);
    assert.match(result.plain, /demonstration complete > 1 new turn · control returned/u);
    assert.match(result.plain, /session status > LEARNER/u);

    const transcriptFiles = fs.readdirSync(tmp).filter((name) => name.endsWith('-transcript.html'));
    assert.equal(transcriptFiles.length, 1);
    const transcriptHtml = fs.readFileSync(path.join(tmp, transcriptFiles[0]), 'utf8');
    assert.match(transcriptHtml, /Replay JS/u);
    assert.match(transcriptHtml, /I would compare the metal residues first\./u);

    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const started = events.find((event) => event.type === 'interactive_harness_demo_started');
    const completed = events.find((event) => event.type === 'interactive_harness_demo_completed');
    assert.equal(started?.requestedTurns, 1);
    assert.equal(started?.publicTranscriptChanged, false);
    assert.equal(completed?.completedTurns, 1);
    assert.match(completed?.transcript || '', /-transcript\.html$/u);
    assert.equal(completed?.publicTranscriptChanged, false);
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
      stopWhen: (plain) => plain.includes('safe fallback used'),
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
    const tutorCalls = completedCalls.filter(
      (call) => call.includes('Learner says') && !call.includes('[Tutor-only repair instruction]'),
    );
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
      stopWhen: (plain) => plain.includes('1 new clue'),
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
    assert.match(html, /Verrell alone draws the mint-yard crucible/u);

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
    assert.match(calls[1], /Latest message:\nSecond learner message\./u);

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
        event.role === 'tutor_stub_passthrough' &&
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
  // The parallel root matrix keeps this timing-sensitive case in the explicit
  // skip ledger. A dedicated Linux PTY lane opts it back in, runs this file in
  // isolation without forced exit, and gives shared runners a bounded budget.
  {
    skip: process.platform === 'win32' || (Boolean(process.env.CI) && !RUN_CONCURRENT_PTY_IN_CI),
    timeout: CONCURRENT_PTY_TEST_TIMEOUT_MS,
  },
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
        }, CONCURRENT_PTY_TIMEOUT_MS);
        terminal.onData((chunk) => {
          terminalOutput += chunk;
          const plain = plainTerminalText(terminalOutput);
          if (!autoStarted && plain.includes('learner >')) {
            autoStarted = true;
            terminal.write('/auto 1\r');
          } else if (
            !partialCommandEntered &&
            plain.includes('tutor and learner now continue from the public transcript') &&
            plain.endsWith('auto > ')
          ) {
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
      assert.match(plain, /auto > \/sta/u);
      assert.match(plain, /A Diligent Learner \(auto\) >/u);
      assert.match(plain, /session status > AUTO/u);
      assert.match(plain, /learning summary: automatic HTML on conclusion/u);
      assert.doesNotMatch(plain, /unknown command/u);
      assert.ok(plain.indexOf('auto > /sta') < plain.indexOf('A Diligent Learner (auto) >'), plain);
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
      assert.match(plain, /\/status\s+show the current role, models, modes, and session state/u);
      assert.match(plain, /learner > \/status/u);
      assert.match(plain, /session status > LEARNER/u);
      assert.doesNotMatch(plain, /unknown command/u);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  },
);

test(
  'profile palette completes the documented stress-list command',
  { skip: process.platform === 'win32', timeout: 15_000 },
  async () => {
    let terminalOutput = '';
    let filterEntered = false;
    let tabPressed = false;
    let commandSubmitted = false;
    let requestedExit = false;
    const terminal = pty.spawn(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--mixed-learner',
        '--no-opening',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--no-trace',
        '--no-remember-settings',
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
          TERM: 'xterm-color',
          TUTOR_STUB_SUMMARY_OPEN: '0',
          TUTOR_STUB_REMEMBER_SETTINGS: '0',
        },
      },
    );

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        terminal.kill();
        reject(new Error(`profile palette terminal timed out\n${plainTerminalText(terminalOutput)}`));
      }, 12_000);
      terminal.onData((chunk) => {
        terminalOutput += chunk;
        const plain = plainTerminalText(terminalOutput);
        if (!filterEntered && plain.includes('A Diligent Learner >')) {
          filterEntered = true;
          terminal.write('/profile list s');
        } else if (!tabPressed && plain.includes('1 match for /profile list s')) {
          tabPressed = true;
          terminal.write('\t');
        } else if (!commandSubmitted && plain.includes('A Diligent Learner > /profile list stress')) {
          commandSubmitted = true;
          terminal.write('\r');
        } else if (!requestedExit && plain.includes('learner profiles > specialist failure modes (10)')) {
          requestedExit = true;
          terminal.write('/quit\r');
        }
      });
      terminal.onExit(({ exitCode, signal }) => {
        clearTimeout(timer);
        if (exitCode === 0) resolve();
        else reject(new Error(`profile palette terminal exited ${exitCode} (${signal})\n${terminalOutput}`));
      });
    });

    const plain = plainTerminalText(terminalOutput);
    assert.match(plain, /1 match for \/profile list s/u);
    assert.match(plain, /A Diligent Learner > \/profile list stress/u);
    assert.match(plain, /learner profiles > specialist failure modes \(10\)/u);
    assert.doesNotMatch(plain, /unknown learner profile/u);
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
      stopWhen: (plain) => plain.includes('1 new clue'),
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

test('unsafe coach guidance is sanitized and the tutor continues from a public-only rebuilt prompt', async () => {
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
      stopWhen: (plain) => plain.includes('1 new clue'),
    });

    assert.doesNotMatch(result.plain, /Speaking-tutor prompt crossed the private-planner boundary/u);
    const trace = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const blocked = trace.find((event) => event.type === 'tutor_speaker_privilege_audit');
    assert.ok(blocked, 'expected the rebuilt prompt to retain a fail-closed privilege audit');
    assert.equal(blocked.audit?.ok, true);
    const recovery = trace.find((event) => event.type === 'tutor_speaker_privilege_recovery');
    if (recovery) {
      assert.equal(recovery.applied, true);
      assert.equal(recovery.speakerPrivilegeAudit?.ok, true);
      assert.equal(recovery.promptAudit?.ok, true);
    }
    const tutorCall = trace.find((event) => event.type === 'model_call' && event.role === 'tutor_stub_tutor');
    assert.ok(tutorCall, 'expected the tutor model call to proceed after safe recovery');
    assert.equal(tutorCall.request.config.speakerPrivilegeAudit.ok, true);
    const tutorPrompt = tutorCall.request.messages.at(-1)?.content || '';
    assert.doesNotMatch(tutorPrompt, /worn burin with the sprung heel/u);
    assert.match(tutorPrompt, /Private coach guidance/u);
    assert.ok(trace.some((event) => event.type === 'turn_complete'));
    assert.equal(
      trace.some((event) => event.type === 'model_call_error'),
      false,
    );
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
    assert.match(result.plain, /Verrell alone draws the mint-yard crucible/u);
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

test('/random samples style and host character independently while preserving the adaptive safety pipeline', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-random-performance-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        '--no-opening',
        '--dag',
        '--tutor-learner-dag',
        '--register-policy',
        'dynamic',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      initialInput: '/random on\nThe assay still confuses me.\n',
      stopWhen: (plain) => plain.includes('optional tutor feedback >'),
      env: {
        FAKE_CODEX_VALID_ANALYSIS: '1',
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });

    assert.match(result.plain, /random performance > on/u);
    assert.match(result.plain, /style and host character will change randomly without learner-assessment influence/u);
    assert.match(result.plain, /random performance: on — assessment-independent style \+ character/u);
    assert.match(result.plain, /, random performance,/u);
    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const modeChange = events.find((event) => event.type === 'random_performance_mode_changed');
    const turn = events.find((event) => event.type === 'turn_complete')?.turnRecord;
    const selection = turn?.registerSelection;
    assert.equal(modeChange?.enabled, true);
    assert.equal(modeChange?.assessmentInfluence.engagementStance, false);
    assert.equal(selection?.primary_policy, 'dynamic');
    assert.equal(selection?.activated_policy, 'random_performance');
    assert.equal(selection?.source, 'random_performance_mode');
    assert.equal(selection?.random_performance.assessment_influence.engagement_stance, false);
    assert.equal(selection?.random_performance.assessment_influence.actorial_part, false);
    assert.equal(selection?.random_performance.assessment_influence.action_family, true);
    assert.equal(selection?.temperature_applied, false);
    assert.match(selection?.temperature_scope || '', /bypassed_for_random/u);
    assert.ok(
      ['plain', 'precise', 'brisk', 'warm', 'witnessing', 'charismatic'].includes(selection?.selected_register),
    );
    assert.ok(['scene_partner', 'examiner', 'record_keeper', 'advocate', 'skeptic'].includes(selection?.actorial_part));
    assert.equal(selection?.actorial_part_selection.selection_method, 'random_performance_seeded_uniform');
    assert.equal(selection?.random?.decision?.material?.policy, 'random_performance');
    assert.equal(selection?.actorial_part_selection.random?.decision?.material?.policy, 'random_performance');
    assert.deepEqual(selection?.random_performance.hard_constraints_preserved, [
      'dialogue_closure',
      'evidence_release',
      'response_safety',
    ]);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('light adaptation forces a replayable style and character shift after continued learner difficulty', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-light-adaptation-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        '--no-opening',
        '--dag',
        '--tutor-learner-dag',
        '--register-policy',
        'dynamic',
        '--light-adaptation',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      initialInput: '/debug on technical\n/light off\n/light on\nThe assay still confuses me.\n',
      followupInputs: [
        {
          afterPlainIncludes: 'optional tutor feedback >',
          text: '/up\nI am frustrated and still uncertain about the residue comparison.\n',
        },
      ],
      // Stop once the second register selection is observable; response composition is covered separately.
      stopWhen: (plain) => plain.includes('light adaptation: continued confusion/frustration streak 2'),
      timeoutMs: 15_000,
      env: {
        FAKE_CODEX_VALID_ANALYSIS: '1',
        FAKE_CODEX_LIGHT_RESPONSE: '1',
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });

    assert.match(result.plain, /light adaptation > on/u);
    assert.match(result.plain, /light adaptation: on — seeded style \+ character shift after 2/u);
    assert.match(result.plain, /source light_stochastic_adaptation/u);
    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const turns = events
      .filter((event) => event.type === 'turn_complete')
      .map((event) => event.turnRecord)
      .sort((left, right) => left.turn - right.turn);
    const modeChanges = events.filter((event) => event.type === 'light_adaptation_mode_changed');
    assert.deepEqual(
      modeChanges.map((event) => event.enabled),
      [false, true],
    );
    assert.ok(modeChanges.every((event) => event.threshold === 2));
    assert.equal(turns.length, 1);
    const first = turns[0].registerSelection;
    assert.equal(first.light_adaptation.streak, 1);
    assert.equal(first.light_adaptation.triggered, false);
    const stanceMatches = [...result.plain.matchAll(/engagement stance > ([a-z_]+)/gu)];
    const partMatches = [...result.plain.matchAll(/audience: [^\n]+; part: ([^\n]+)/gu)];
    assert.ok(stanceMatches.length >= 2, result.plain);
    assert.ok(partMatches.length >= 2, result.plain);
    assert.notEqual(stanceMatches.at(-1)[1], first.engagement_stance);
    assert.notEqual(partMatches.at(-1)[1].trim(), first.actorial_part_label);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('/register and /character explicitly direct their own performance axes and outrank /random', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-explicit-performance-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        '--no-opening',
        '--dag',
        '--tutor-learner-dag',
        '--register-policy',
        'dynamic',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      initialInput: '/random on\n/register warm\n/character advocate\nThe assay still confuses me.\n',
      stopWhen: (plain) => plain.includes('optional tutor feedback >'),
      env: {
        FAKE_CODEX_VALID_ANALYSIS: '1',
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });

    assert.match(result.plain, /teaching style direction > warm/u);
    assert.match(result.plain, /tutor character > Advocate for the live case/u);
    assert.match(result.plain, /directed performance: style warm · character advocate/u);
    assert.match(result.plain, /style warm/u);
    assert.match(result.plain, /character advocate for the live case/u);
    assert.match(result.plain, /style directed, character directed/u);

    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const changes = events.filter((event) => event.type === 'explicit_performance_directive_changed');
    const selection = events.find((event) => event.type === 'turn_complete')?.turnRecord?.registerSelection;
    assert.deepEqual(
      changes.map((event) => [event.axis, event.value]),
      [
        ['engagement_stance', 'warm'],
        ['actorial_part', 'advocate'],
      ],
    );
    assert.equal(selection?.primary_policy, 'dynamic');
    assert.equal(selection?.activated_policy, 'explicit_register_directive');
    assert.equal(selection?.source, 'explicit_register_directive');
    assert.equal(selection?.selected_register, 'warm');
    assert.equal(selection?.actorial_part, 'advocate');
    assert.equal(selection?.actorial_part_selection.selection_method, 'explicit_character_directive');
    assert.equal(selection?.performance_directives.register.assessment_influence, false);
    assert.equal(selection?.performance_directives.character.assessment_influence, false);
    assert.equal(selection?.performance_directives.character.applied, true);
    assert.equal(selection?.random_performance.configured, true);
    assert.equal(selection?.random_performance.enabled, false);
    assert.deepEqual(selection?.random_performance.active_axes, []);
    assert.deepEqual(selection?.random_performance.explicitly_directed_axes, ['engagement_stance', 'actorial_part']);
    assert.deepEqual(selection?.performance_directives.hard_constraints_preserved, [
      'dialogue_closure',
      'authored_evidence_source',
      'evidence_release',
      'response_safety',
    ]);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('/character configures learner and tutor characters while preserving legacy forms', () => {
  const result = spawnSync(
    process.execPath,
    [
      'scripts/tutor-stub.js',
      '--mixed-learner',
      '--dag',
      '--tutor-learner-dag',
      '--no-opening',
      '--no-closeout-report',
      '--no-interim-animation',
      '--no-stream',
      '--no-trace',
      '--world',
      'world_005_marrick',
    ],
    {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, TUTOR_STUB_REMEMBER_SETTINGS: '0' },
      input:
        '/character\n/character tutor\n/character tutor adversarial_teacher\n/character learner counterexample_hunter\n/character\n/character opposing_counsel\n/quit\n',
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /character controls >/u);
  assert.match(result.stdout, /learner character > diligent/u);
  assert.match(result.stdout, /tutor character > auto/u);
  assert.match(result.stdout, /adversarial_teacher\s+adversarial teacher/u);
  assert.match(result.stdout, /exacting_schoolmaster\s+exacting schoolmaster/u);
  assert.match(result.stdout, /tutor character > Adversarial teacher/u);
  assert.match(
    result.stdout,
    /Tutor replies will actively test your ideas with subject-based counterexamples or alternatives\./u,
  );
  assert.match(result.stdout, /Clue-givers and the closing scene may temporarily use another character\./u);
  assert.match(result.stdout, /Choose Tutor → Auto, or type \/character tutor auto/u);
  assert.match(result.stdout, /switched to counterexample_hunter: Counterexample hunter/u);
  assert.match(result.stdout, /learner character > counterexample_hunter/u);
  assert.match(result.stdout, /tutor character > adversarial_teacher/u);
  assert.match(result.stdout, /tutor character > Exacting schoolmaster/u);
});

test('changing the tutor character publicly restates the latest intent and replaces the cached reprise', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-character-restatement-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        '--dag',
        '--tutor-learner-dag',
        '--register-policy',
        'dynamic',
        '--no-turn-feedback',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      initialInput: '',
      followupInputs: [
        {
          afterPlainIncludes: 'tutor >',
          text: '/character tutor adversarial_teacher\n',
        },
      ],
      stopWhen: (plain) => plain.includes('tutor ↻ > Let me rephrase that.'),
      env: {
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });

    assert.match(result.plain, /tutor character > Adversarial teacher/u);
    assert.match(
      result.plain,
      /tutor ↻ > Let me rephrase that\. Challenge the town’s first answer within the assay itself:/u,
    );
    assert.ok(
      (result.plain.match(/Challenge the town’s first answer within the assay itself/gu) || []).length >= 2,
      result.plain,
    );

    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const completed = events.find((event) => event.type === 'tutor_character_restatement_completed');
    assert.equal(completed?.characterId, 'adversarial_teacher');
    assert.equal(completed?.target?.targetKind, 'opening');
    assert.equal(completed?.transcriptOperation, 'replace_latest_tutor_utterance');
    assert.equal(completed?.publicTranscriptChanged, true);
    assert.equal(completed?.deterministicFallback, false);
    assert.equal(completed?.audit?.ok, true);
    assert.equal(
      events.some((event) => event.type === 'tutor_utterance_reprise' && event.command === '/character'),
      false,
    );
    const modelInput = fs.readFileSync(result.logPath, 'utf8');
    assert.match(modelInput, /# Character restatement task/u);
    assert.match(modelInput, /Current character id: adversarial_teacher/u);
    assert.match(modelInput, /Previous tutor utterance/u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test(
  'bare /character chooses learner or tutor before opening the axis-specific keyboard selector',
  { skip: process.platform === 'win32', timeout: 12_000 },
  async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-character-selectors-'));
    installFakeCodex(tmp);
    let terminalOutput = '';
    let openedCharacterForTutor = false;
    let selectedTutorTarget = false;
    let selectedTutor = false;
    let openedCharacterForLearner = false;
    let selectedLearnerTarget = false;
    let selectedLearner = false;
    let requestedExit = false;
    const terminal = pty.spawn(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--mixed-learner',
        '--dag',
        '--tutor-learner-dag',
        '--no-opening',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--no-trace',
        '--world',
        'world_005_marrick',
      ],
      {
        cwd: ROOT,
        cols: 110,
        rows: 28,
        name: 'xterm-color',
        env: {
          ...process.env,
          PATH: `${tmp}${path.delimiter}${process.env.PATH || ''}`,
          TERM: 'xterm-color',
          TUTOR_STUB_REMEMBER_SETTINGS: '0',
        },
      },
    );
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          terminal.kill();
          reject(new Error(`TTY character selectors timed out\n${plainTerminalText(terminalOutput)}`));
        }, 10_000);
        terminal.onData((chunk) => {
          terminalOutput += chunk;
          const plain = plainTerminalText(terminalOutput);
          const targetMenuCount = (plain.match(/Character · choose learner or tutor/gu) || []).length;
          if (!openedCharacterForTutor && plain.includes('A Diligent Learner >')) {
            openedCharacterForTutor = true;
            terminal.write('/character\r');
          } else if (
            !selectedTutorTarget &&
            targetMenuCount >= 1 &&
            plain.includes('about > Choose the visible learner behavior profile')
          ) {
            selectedTutorTarget = true;
            terminal.write('\x1b[B\r');
          } else if (!selectedTutor && plain.includes('does > Return character choice to light adaptation')) {
            selectedTutor = true;
            terminal.write('\x1b[B\r');
          } else if (!openedCharacterForLearner && plain.includes('tutor character > Fellow investigator')) {
            openedCharacterForLearner = true;
            terminal.write('/character\r');
          } else if (
            !selectedLearnerTarget &&
            targetMenuCount >= 2 &&
            (plain.match(/about > Choose the visible learner behavior profile/gu) || []).length >= 2
          ) {
            selectedLearnerTarget = true;
            terminal.write('\r');
          } else if (!selectedLearner && plain.includes('pattern >')) {
            selectedLearner = true;
            terminal.write('\x1b[F\r');
          } else if (!requestedExit && /learner profile > switched to [a-z_]+:/u.test(plain)) {
            requestedExit = true;
            terminal.write('/quit\r');
          }
        });
        terminal.onExit(({ exitCode, signal }) => {
          clearTimeout(timer);
          if (exitCode === 0) resolve();
          else reject(new Error(`TTY character selectors exited ${exitCode} (${signal})\n${terminalOutput}`));
        });
      });

      const plain = plainTerminalText(terminalOutput);
      assert.ok((plain.match(/Character · choose learner or tutor/gu) || []).length >= 2, plain);
      assert.match(plain, /Learner\s+diligent/u);
      assert.match(plain, /Tutor\s+auto/u);
      assert.match(plain, /Tutor character · choose with ↑\/↓ and Enter/u);
      assert.match(plain, /scene_partner.*adaptive-safe/u);
      assert.match(plain, /tutor character > Fellow investigator/u);
      assert.match(plain, /Learner character · choose with ↑\/↓ and Enter/u);
      assert.match(plain, /pattern >/u);
      assert.match(plain, /learner profile > switched to [a-z_]+:/u);
    } finally {
      terminal.kill();
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  },
);

test('--learner-character and --tutor-character set symmetric launch-time character controls', () => {
  const result = spawnSync(
    process.execPath,
    [
      'scripts/tutor-stub.js',
      '--mixed-learner',
      '--dag',
      '--tutor-learner-dag',
      '--learner-character',
      'goalpost_shifter',
      '--tutor-character',
      'opposing_counsel',
      '--no-opening',
      '--no-closeout-report',
      '--no-interim-animation',
      '--no-stream',
      '--no-trace',
      '--world',
      'world_005_marrick',
    ],
    {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, TUTOR_STUB_REMEMBER_SETTINGS: '0' },
      input: '/character\n/quit\n',
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /learner character > goalpost_shifter/u);
  assert.match(result.stdout, /tutor character > exacting_schoolmaster/u);
});

test('/register leaves the undirected character axis available to /random', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-explicit-register-random-character-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        '--no-opening',
        '--dag',
        '--tutor-learner-dag',
        '--register-policy',
        'dynamic',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      initialInput: '/random on\n/register warm\nThe assay still confuses me.\n',
      stopWhen: (plain) => plain.includes('optional tutor feedback >'),
      env: {
        FAKE_CODEX_VALID_ANALYSIS: '1',
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });

    assert.match(result.plain, /random performance: on — assessment-independent character/u);
    assert.match(result.plain, /directed performance: style warm · character auto/u);
    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const selection = events.find((event) => event.type === 'turn_complete')?.turnRecord?.registerSelection;
    assert.equal(selection?.selected_register, 'warm');
    assert.equal(selection?.actorial_part_selection.selection_method, 'random_performance_seeded_uniform');
    assert.equal(selection?.random_performance.enabled, true);
    assert.deepEqual(selection?.random_performance.active_axes, ['actorial_part']);
    assert.deepEqual(selection?.random_performance.explicitly_directed_axes, ['engagement_stance']);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('/register auto and /character auto clear only their session locks', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-explicit-performance-clear-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        '--no-opening',
        '--dag',
        '--tutor-learner-dag',
        '--register-policy',
        'dynamic',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      initialInput: '/register warm\n/character advocate\n/register auto\n/character auto\n/status\n',
      stopWhen: (plain) => plain.includes('directed performance: style auto · character auto'),
      env: {
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });

    assert.match(result.plain, /teaching style direction > auto/u);
    assert.match(result.plain, /tutor character > Automatic/u);
    assert.match(result.plain, /directed performance: style auto · character auto/u);
    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const changes = events.filter((event) => event.type === 'explicit_performance_directive_changed');
    assert.deepEqual(
      changes.map((event) => [event.axis, event.value]),
      [
        ['engagement_stance', 'warm'],
        ['actorial_part', 'advocate'],
        ['engagement_stance', null],
        ['actorial_part', null],
      ],
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
      stopWhen: (plain) => plain.includes('optional tutor feedback >'),
    });

    assert.match(result.plain, /debug > off/u);
    assert.match(result.plain, /automatic explanations stopped/u);
    assert.doesNotMatch(result.plain, /turn id >/u);
    assert.doesNotMatch(result.plain, /learner classifier >/u);
    assert.doesNotMatch(result.plain, /tutor learner-DAG model >/u);
    assert.doesNotMatch(result.plain, /engagement stance >/u);
    assert.doesNotMatch(result.plain, /tutor DAG >/u);
    assert.doesNotMatch(result.plain, /debug explain > turn 1/u);
    assert.match(result.plain, /tokens unavailable, effort medium, style [a-z ]+, move [a-z ]+, character [^,\n]+/u);
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

test('/voice starts a local companion without calling a tutor model and reports the separate voice role', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-voice-command-'));
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
      initialInput: '/voice\n',
      stopWhen: (plain) => plain.includes('voice > ready'),
      env: {
        OPENAI_API_KEY: 'test-key-not-sent-without-webrtc',
        TUTOR_STUB_VOICE_OPEN: '0',
      },
    });

    assert.match(result.plain, /voice > ready · gpt-realtime-2\.1-mini · marin/u);
    assert.match(result.plain, /microphone speech joins the normal learner turn/u);
    assert.match(result.plain, /voice: on · gpt-realtime-2\.1-mini · marin · separate renderer/u);
    assert.equal(fs.existsSync(result.logPath), false);

    const traces = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    assert.ok(
      traces.some(
        (event) =>
          event.type === 'voice_runtime_enabled' &&
          event.voice.model === 'gpt-realtime-2.1-mini' &&
          event.voice.automaticRealtimeResponses === false,
      ),
    );
    assert.ok(traces.every((event) => !JSON.stringify(event).includes('test-key-not-sent-without-webrtc')));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('two voice transcripts before the tutor reply become one compound learner turn', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-voice-compound-'));
  installFakeCodex(tmp);
  const child = spawn(
    process.execPath,
    [
      'scripts/tutor-stub.js',
      '--no-opening',
      '--no-classifier',
      '--no-register-selection',
      '--no-closeout-report',
      '--no-turn-feedback',
      '--no-interim-animation',
      '--no-stream',
      '--trace-dir',
      tmp,
      '--world',
      'none',
    ],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        PATH: `${tmp}${path.delimiter}${process.env.PATH || ''}`,
        OPENAI_API_KEY: 'test-key-not-sent-without-webrtc',
        TUTOR_STUB_VOICE_OPEN: '0',
        TUTOR_STUB_OPENING_REALIZER: 'deterministic',
        FAKE_CODEX_DELAY_MS: '450',
        CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  let stdout = '';
  let stderr = '';
  let submitted = false;
  let completed = false;
  const timer = setTimeout(() => child.kill('SIGKILL'), 10_000);
  try {
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    const done = new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`voice compound test exited ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`));
      });
    });
    child.stdout.on('data', async (chunk) => {
      stdout += chunk;
      const plain = plainTerminalText(stdout);
      if (!submitted) {
        const match = plain.match(/(http:\/\/127\.0\.0\.1:\d+\/voice\?token=[^\s]+)/u);
        if (match) {
          submitted = true;
          const learnerUrl = new URL(match[1]);
          learnerUrl.pathname = '/api/learner';
          await fetch(learnerUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text: 'I think the mark identifies the tool.', itemId: 'voice_1' }),
          });
          setTimeout(async () => {
            await fetch(learnerUrl, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ text: 'But it does not identify the person.', itemId: 'voice_2' }),
            });
          }, 80);
        }
      }
      if (!completed && /tutor >/u.test(plain)) {
        completed = true;
        child.stdin.end('/quit\n');
      }
    });
    child.stdin.write('/voice\n');
    await done;

    assert.match(plainTerminalText(stdout), /learner turn updated > added message 2/u);
    const traces = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    assert.equal(traces.filter((event) => event.type === 'voice_learner_transcript').length, 2);
    assert.ok(
      traces.some(
        (event) =>
          event.type === 'learner_turn_compound_committed' &&
          event.messageCount === 2 &&
          event.combinedText.includes('mark identifies the tool') &&
          event.combinedText.includes('does not identify the person'),
      ),
    );
    assert.ok(
      traces.some(
        (event) =>
          event.type === 'learner_turn_attempt_discarded' &&
          event.reason === 'additional_learner_message_before_tutor_reply',
      ),
    );
  } finally {
    clearTimeout(timer);
    if (!child.killed && child.exitCode === null) child.kill('SIGKILL');
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
