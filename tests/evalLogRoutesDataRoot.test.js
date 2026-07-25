import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'machinespirits-eval-log-routes-'));
const evalLogsRoot = path.join(testRoot, 'eval-logs');
const oldTutorCoreRoot = path.join(testRoot, 'old-tutor-core-logs');
const fixtureDate = '2026-07-24';
const fixtureTimestamp = Date.parse(`${fixtureDate}T12:34:56.000Z`);
const fixtureDialogueId = `dialogue-${fixtureTimestamp}-route-fixture`;
const decoyDate = '1999-12-31';
const decoyDialogueId = `dialogue-${Date.parse(`${decoyDate}T12:00:00.000Z`)}-wrong-root`;

process.env.EVAL_DB_PATH = path.join(testRoot, 'evaluations.db');
process.env.EVAL_LOGS_DIR = evalLogsRoot;
process.env.AUTH_DB_PATH = path.join(testRoot, 'auth.db');
process.env.TUTOR_CORE_LOG_DIR = oldTutorCoreRoot;

function writeLogRoot(root, date, dialogueId, marker) {
  const apiDir = path.join(root, 'tutor-api');
  const dialogueDir = path.join(root, 'tutor-dialogues');
  fs.mkdirSync(apiDir, { recursive: true });
  fs.mkdirSync(dialogueDir, { recursive: true });

  const timestamp = new Date(Number(dialogueId.split('-')[1])).toISOString();
  const entries = [
    { timestamp, step: 1, dialogueId, agent: 'user', action: 'input', response: marker },
    { timestamp, step: 2, dialogueId, agent: 'ego', action: 'generate', response: '[]' },
  ];
  fs.writeFileSync(path.join(apiDir, `api-${date}.jsonl`), `${entries.map(JSON.stringify).join('\n')}\n`);
  fs.writeFileSync(
    path.join(dialogueDir, `${dialogueId}.json`),
    JSON.stringify(
      {
        dialogueId,
        profileName: marker,
        dialogueTrace: entries,
        suggestions: [{ message: marker }],
        rounds: 1,
        converged: true,
      },
      null,
      2,
    ),
  );
}

writeLogRoot(evalLogsRoot, fixtureDate, fixtureDialogueId, 'hermetic-eval-root');
writeLogRoot(oldTutorCoreRoot, decoyDate, decoyDialogueId, 'wrong-root-decoy');

const { app } = await import('../server.js');

function get(baseUrl, pathname) {
  return new Promise((resolve, reject) => {
    http
      .get(`${baseUrl}${pathname}`, (response) => {
        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          resolve({ status: response.statusCode, body: JSON.parse(data) });
        });
      })
      .on('error', reject);
  });
}

describe('evaluation log routes use the redirected data root', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    fs.rmSync(testRoot, { recursive: true, force: true });
  });

  it('lists only dates present in EVAL_LOGS_DIR, not the old tutor-core root', async () => {
    const { status, body } = await get(baseUrl, '/api/eval/logs/dates');
    assert.equal(status, 200);
    assert.deepEqual(body, { success: true, dates: [fixtureDate] });
    assert.ok(!body.dates.includes(decoyDate));
  });

  it('returns the data-bearing dialogue collection from EVAL_LOGS_DIR', async () => {
    const { status, body } = await get(baseUrl, `/api/eval/logs/${fixtureDate}?limit=5`);
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.total, 1);
    assert.equal(body.dialogues.length, 1);
    assert.equal(body.dialogues[0].dialogueId, fixtureDialogueId);
    assert.equal(body.dialogues[0].profileName, 'hermetic-eval-root');
  });

  it('loads the same hermetic dialogue by id and by index', async () => {
    const byId = await get(baseUrl, `/api/eval/logs/dialogue/${fixtureDialogueId}`);
    assert.equal(byId.status, 200);
    assert.equal(byId.body.dialogueId, fixtureDialogueId);
    assert.equal(byId.body.dialogue.profileName, 'hermetic-eval-root');

    const byIndex = await get(baseUrl, `/api/eval/logs/${fixtureDate}/0`);
    assert.equal(byIndex.status, 200);
    assert.equal(byIndex.body.dialogue.dialogueId, fixtureDialogueId);
    assert.equal(byIndex.body.dialogue.profileName, 'hermetic-eval-root');
  });

  it('computes statistics from the hermetic API log rather than an empty or decoy root', async () => {
    const { status, body } = await get(baseUrl, `/api/eval/logs-stats?startDate=${fixtureDate}&endDate=${fixtureDate}`);
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.totalDates, 1);
    assert.equal(body.totalDialogues, 1);
    assert.equal(body.totalEntries, 2);
    assert.deepEqual(body.byDate, [{ date: fixtureDate, dialogues: 1, entries: 2 }]);
  });
});
