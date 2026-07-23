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
  const response = input.includes('# Public-safe opening frame')
    ? "The autumn fair booths are down, and light coin lies beside the guild-hall balance. Whose hand struck the false shillings passed at the Marrick fair? No assay mark has been entered yet; which public thing should we examine first?"
    : input.includes('Write learner turn')
      ? 'I would compare the metal residues first.'
      : input.includes('[Tutor-only dramatic clue release]')
        ? "Yes—that gives us a concrete comparison. “I am tapping the mint-yard register: Verrell alone draws the mint-yard crucible.” Which public mark would connect this clue to one hand?"
        : 'Yes—that gives us a concrete comparison. Which public mark would connect this clue to one hand?';
  if (process.env.FAKE_CODEX_LOG) fs.appendFileSync(process.env.FAKE_CODEX_LOG, input + '\\n---CALL---\\n');
  if (outputPath) fs.writeFileSync(outputPath, response);
  process.stdout.write(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: response } }) + '\\n');
});
`,
    'utf8',
  );
  fs.chmodSync(fakeCodex, 0o755);
}

function installLongHistoryFakeCodex(tmp) {
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
  const learnerMatch = input.match(/Write learner turn (\\d+)/u);
  const tutorMatches = [...input.matchAll(/PUBLIC-OBSERVATION-(\\d+)/gu)];
  const tutorTurn = tutorMatches.at(-1)?.[1] || '0';
  const response = input.includes('# Public-safe opening frame')
    ? 'The public inquiry is open. Which visible record should we inspect first?'
    : learnerMatch
      ? \`PUBLIC-OBSERVATION-\${learnerMatch[1]}: \${'The visible record remains incomplete and needs one more public check. '.repeat(24)}\`
      : \`I see public observation \${tutorTurn}. Keep that visible record open while we test one bounded mark. Which public check follows at turn \${tutorTurn}?\`;
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

test('short automated learner runs replay the full public dialogue with learner-relative native roles', () => {
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
    assert.match(learnerCall.request.messageHistory[0].content, /autumn fair booths are down/u);
    assert.equal(learnerCall.request.messages.at(-1).role, 'user');
    assert.match(learnerCall.request.messages.at(-1).content, /Write learner turn 1/u);
    assert.doesNotMatch(learnerCall.request.prompt, /# Public transcript/u);

    assert.deepEqual(
      secondLearnerCall.request.messageHistory.map((message) => message.role),
      ['user', 'assistant', 'user'],
    );
    assert.match(secondLearnerCall.request.messageHistory[0].content, /autumn fair booths are down/u);
    assert.equal(secondLearnerCall.request.messageHistory[1].content, 'I would compare the metal residues first.');
    const firstTutorTurn = traceEvents(tmp).find((event) => event.type === 'turn_complete')?.turnRecord?.tutor;
    assert.ok(firstTutorTurn, 'expected the first delivered tutor turn in the trace');
    assert.equal(secondLearnerCall.request.messageHistory[2].content, firstTutorTurn);
    assert.equal(secondLearnerCall.request.messages.at(-1).role, 'user');
    assert.match(secondLearnerCall.request.messages.at(-1).content, /Write learner turn 2/u);

    const completedTurns = traceEvents(tmp).filter((event) => event.type === 'turn_complete');
    assert.equal(completedTurns.length, 2);
    for (const completed of completedTurns) {
      assert.equal(completed.turnRecord.learnerResponseProvenance.authorship, 'ai');
      assert.equal(completed.turnRecord.learnerResponseProvenance.origin, 'automated_learner');
      assert.equal(completed.turnRecord.learnerResponseProvenance.humanInLoop, false);
      assert.equal(completed.turnRecord.learnerMessages[0].provenance.aiGenerated, true);
    }

    const cliCalls = fs.readFileSync(promptLog, 'utf8').split('\n---CALL---\n').filter(Boolean);
    const learnerCliCall = cliCalls.find((call) => call.includes('Write learner turn 1'));
    assert.match(learnerCliCall, /Conversation so far:\nuser: The autumn fair booths are down/u);
    assert.match(learnerCliCall, /Latest message:\n/u);
    const secondLearnerCliCall = cliCalls.find((call) => call.includes('Write learner turn 2'));
    assert.match(
      secondLearnerCliCall,
      /Conversation so far:\nuser: The autumn fair booths are down[\s\S]*assistant: I would compare the metal residues first\./u,
    );
    assert.ok(secondLearnerCliCall.includes(`user: ${firstTutorTurn}`));
    assert.match(secondLearnerCliCall, /Latest message:\n/u);

    const openingEvent = traceEvents(tmp).find((event) => event.type === 'tutor_opening');
    assert.equal(openingEvent.realization.source, 'speaking_tutor_model');
    assert.equal(openingEvent.realization.audit.ok, true);
    assert.deepEqual(
      openingEvent.realization.requirements.map((row) => row.id),
      ['public_situation', 'public_question', 'available_evidence_only', 'observation_or_clarification'],
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('long automated learner runs recover budget overflow with a public recent-turn window', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-learner-budget-history-'));
  try {
    installLongHistoryFakeCodex(tmp);
    const result = spawnSync(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--auto-learner',
        '--auto-turns',
        '10',
        '--no-auto-stop-on-grounded',
        '--no-classifier',
        '--no-register-selection',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--no-remember-settings',
        '--loop-mode',
        'diagnostic',
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
          CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
          TUTOR_STUB_SUMMARY_OPEN: '0',
        },
        encoding: 'utf8',
        timeout: 20_000,
      },
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const events = traceEvents(tmp);
    const recoveries = events.filter(
      (event) =>
        event.type === 'prompt_audit_recovery' &&
        event.role === 'tutor_stub_auto_learner' &&
        event.recovery?.method === 'budget_window_public_history',
    );
    assert.ok(recoveries.length >= 1, 'expected a long learner replay to cross the audited budget');
    assert.equal(recoveries[0].turn, 9);
    assert.equal(recoveries[0].recovery.applied, true);
    assert.equal(recoveries[0].recovery.availableMessageCount, 17);
    assert.equal(recoveries[0].recovery.replayedMessageCount, 9);
    assert.equal(recoveries[0].recovery.omittedMessageCount, 8);
    assert.ok(recoveries[0].recovery.originalViolations.some((row) => row.code === 'character_budget_exceeded'));
    assert.equal(recoveries[0].audit.ok, true);
    assert.equal(
      events.some((event) => event.type === 'prompt_audit_failed' && event.role === 'tutor_stub_auto_learner'),
      false,
    );
    assert.equal(events.filter((event) => event.type === 'turn_complete').length, 10);

    const recoveredCall = events.find(
      (event) => event.type === 'model_call' && event.role === 'tutor_stub_auto_learner' && event.turn === 9,
    );
    assert.equal(recoveredCall.request.messageHistory.length, 9);
    assert.match(recoveredCall.request.messageHistory[0].content, /Earlier public dialogue omitted/u);
    assert.equal(recoveredCall.request.messageHistory.at(-1).role, 'user');
    assert.equal(recoveredCall.request.promptAudit.recovery.method, 'budget_window_public_history');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
