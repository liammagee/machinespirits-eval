import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

import { hashDialogueLog } from '../services/messageChainAudit.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT_PATH = path.join(REPO_ROOT, 'scripts', 'audit-message-chain.js');
const fixtureRoots = new Set();

test.afterEach(() => {
  for (const fixtureRoot of fixtureRoots) {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
  fixtureRoots.clear();
});

function makeDialogueLog() {
  return {
    dialogueId: 'dialogue-cli-fixture',
    conversationMode: 'messages',
    conversationHistory: [
      {
        suggestion: { message: 'Tutor response' },
        learnerMessage: 'Learner response',
      },
    ],
    dialogueTrace: [
      {
        agent: 'ego',
        action: 'generate',
        direction: 'response',
        turnIndex: 0,
        inputMessages: [
          { role: 'assistant', content: 'Earlier tutor response' },
          { role: 'user', content: 'Earlier learner response' },
        ],
        apiPayload: {
          request: {
            body: {
              messages: [
                { role: 'system', content: 'Tutor system prompt' },
                { role: 'user', content: 'Tutor request' },
              ],
            },
          },
          response: { body: { choices: [{ message: { content: 'Tutor response' } }] } },
        },
      },
      {
        agent: 'learner_ego_initial',
        action: 'deliberation',
        turnIndex: 0,
        inputMessages: [
          { role: 'user', content: 'Tutor response' },
          { role: 'assistant', content: 'Earlier learner response' },
        ],
        apiPayload: {
          request: {
            body: {
              messages: [
                { role: 'system', content: 'Learner system prompt' },
                { role: 'user', content: 'Learner request' },
              ],
            },
          },
          response: { body: { choices: [{ message: { content: 'Learner response' } }] } },
        },
      },
    ],
  };
}

function createFixture({ dialogueLog = makeDialogueLog(), rawLog = null, expectedHash = null } = {}) {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'message-chain-audit-'));
  fixtureRoots.add(fixtureRoot);
  const dbPath = path.join(fixtureRoot, 'evaluations.db');
  const logsRoot = path.join(fixtureRoot, 'logs');
  const dialogueDir = path.join(logsRoot, 'tutor-dialogues');
  fs.mkdirSync(dialogueDir, { recursive: true });

  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE evaluation_results (
      id INTEGER PRIMARY KEY,
      run_id TEXT,
      scenario_id TEXT,
      profile_name TEXT,
      dialogue_id TEXT,
      dialogue_content_hash TEXT,
      provider TEXT,
      model TEXT,
      ego_model TEXT,
      superego_model TEXT,
      learner_architecture TEXT,
      conversation_mode TEXT,
      created_at TEXT
    )
  `);
  db.prepare(
    `INSERT INTO evaluation_results
      (id, run_id, scenario_id, profile_name, dialogue_id, dialogue_content_hash,
       provider, model, ego_model, superego_model, learner_architecture,
       conversation_mode, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    1,
    'run-message-chain-fixture',
    'scenario-fixture',
    'cell_80_base_single_unified_messages',
    'dialogue-cli-fixture',
    expectedHash ?? hashDialogueLog(dialogueLog),
    'fixture',
    'fixture-model',
    'fixture-model',
    null,
    'ego_superego',
    'messages',
    '2026-07-25T00:00:00.000Z',
  );
  db.close();

  fs.writeFileSync(
    path.join(dialogueDir, 'dialogue-cli-fixture.json'),
    rawLog ?? `${JSON.stringify(dialogueLog, null, 2)}\n`,
  );

  return { dbPath, logsRoot };
}

function runAudit(fixture, args) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      EVAL_DB_PATH: fixture.dbPath,
      EVAL_LOGS_DIR: fixture.logsRoot,
      NO_COLOR: '1',
    },
    encoding: 'utf8',
  });
}

function parseJsonOutput(result) {
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}

test('strict production CLI passes a complete synthetic tutor and learner message chain', () => {
  const fixture = createFixture();
  const result = runAudit(fixture, ['--result-id', '1', '--json', '--strict', '--include-learner']);

  assert.equal(result.status, 0, result.stderr);
  const output = parseJsonOutput(result);
  assert.deepEqual(output.summary, { status: 'pass', audit_count: 1, passed: 1, failed: 0 });
  assert.equal(output.query.strict, true);
  assert.equal(output.audits[0].exchange_count, 2);
  assert.equal(output.audits[0].integrity.checked_message_chains, 2);
});

test('strict production CLI rejects malformed dialogue JSON with an exact parse reason', () => {
  const fixture = createFixture({ rawLog: '{not-json' });
  const result = runAudit(fixture, ['--result-id', '1', '--json', '--strict']);

  assert.equal(result.status, 1);
  const output = parseJsonOutput(result);
  assert.deepEqual(output.audits[0].integrity.failures, [
    {
      reason: 'parse_error',
      dialogue_id: 'dialogue-cli-fixture',
      expected_hash: hashDialogueLog(makeDialogueLog()),
    },
  ]);
});

test('strict production CLI rejects dialogue hash drift with exact hashes', () => {
  const dialogueLog = makeDialogueLog();
  const fixture = createFixture({ dialogueLog, expectedHash: '0'.repeat(64) });
  const result = runAudit(fixture, ['--result-id', '1', '--json', '--strict']);

  assert.equal(result.status, 1);
  const output = parseJsonOutput(result);
  assert.equal(output.audits[0].integrity.failures[0].reason, 'dialogue_hash_mismatch');
  assert.equal(output.audits[0].integrity.failures[0].expected, '0'.repeat(64));
  assert.equal(output.audits[0].integrity.failures[0].actual, hashDialogueLog(dialogueLog));
});

test('strict production CLI rejects turn and role ordering while the stored hash still matches', () => {
  const dialogueLog = makeDialogueLog();
  dialogueLog.dialogueTrace[1].turnIndex = -1;
  dialogueLog.dialogueTrace[1].inputMessages = [
    { role: 'user', content: 'First learner input' },
    { role: 'user', content: 'Second learner input' },
  ];
  const fixture = createFixture({ dialogueLog });
  const result = runAudit(fixture, ['--result-id', '1', '--json', '--strict', '--include-learner']);

  assert.equal(result.status, 1);
  const output = parseJsonOutput(result);
  assert.deepEqual(
    output.audits[0].integrity.failures.map((entry) => entry.reason),
    ['turn_index_regression', 'consecutive_message_role'],
  );
  assert.equal(output.audits[0].integrity.actual_hash, output.audits[0].integrity.expected_hash);
});

test('legacy audit mode reports integrity failure but preserves its zero exit', () => {
  const fixture = createFixture({ expectedHash: '0'.repeat(64) });
  const result = runAudit(fixture, ['--result-id', '1', '--json']);

  assert.equal(result.status, 0, result.stderr);
  const output = parseJsonOutput(result);
  assert.equal(output.query.strict, false);
  assert.equal(output.summary.status, 'fail');
  assert.equal(output.audits[0].integrity.failures[0].reason, 'dialogue_hash_mismatch');
});

test('production CLI retains exact selector usage failures', () => {
  const fixture = createFixture();
  const missing = runAudit(fixture, ['--json', '--strict']);
  const conflicting = runAudit(fixture, [
    '--result-id',
    '1',
    '--run-id',
    'run-message-chain-fixture',
    '--json',
    '--strict',
  ]);

  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /Provide either --result-id or --run-id\./u);
  assert.equal(conflicting.status, 1);
  assert.match(conflicting.stderr, /Use exactly one of --result-id or --run-id\./u);
});
