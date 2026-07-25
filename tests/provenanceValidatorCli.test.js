import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const CLI_PATH = fileURLToPath(new URL('../scripts/validate-provenance.js', import.meta.url));
const RUN_ID = 'eval-2026-07-25-feed1234';
const DIALOGUE_ID = 'dialogue-provenance-fixture';
const CONTENT_TURN_ID = 'fixture-turn-0';
const fixtureRoots = new Set();

function dialogueHash(log) {
  return createHash('sha256')
    .update(JSON.stringify(log, null, 2))
    .digest('hex');
}

function createFixture({
  includeLog = true,
  logTurnId = CONTENT_TURN_ID,
  includeJudgeInputHash = true,
  configHash = 'fixture-config-hash',
  rowRubricVersion = '2.2',
  turnRubricVersion = '2.2',
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'provenance-validator-'));
  fixtureRoots.add(root);
  const dbPath = join(root, 'evaluations.db');
  const logsRoot = join(root, 'logs');
  const tutorDialoguesDir = join(logsRoot, 'tutor-dialogues');
  const logPath = join(tutorDialoguesDir, `${DIALOGUE_ID}.json`);
  const reportPath = join(root, 'report.json');
  const log = {
    dialogueId: DIALOGUE_ID,
    turnResults: [
      {
        turnIndex: 0,
        turnId: 'turn-0',
        contentTurnId: logTurnId,
        suggestions: [{ message: 'A synthetic tutor response.' }],
      },
    ],
  };

  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE evaluation_runs (
      id TEXT PRIMARY KEY,
      description TEXT,
      created_at TEXT
    );
    CREATE TABLE evaluation_results (
      id INTEGER PRIMARY KEY,
      run_id TEXT,
      dialogue_id TEXT,
      dialogue_content_hash TEXT,
      tutor_scores TEXT,
      config_hash TEXT,
      tutor_overall_score REAL,
      tutor_rubric_version TEXT
    );
    CREATE TABLE score_audit (
      result_id TEXT
    );
  `);

  const turnScore = {
    turnIndex: 0,
    contentTurnId: CONTENT_TURN_ID,
    rubricVersion: turnRubricVersion,
    scores: { content_accuracy: { score: 4 } },
  };
  if (includeJudgeInputHash) turnScore.judgeInputHash = 'fixture-judge-input-hash';
  const tutorScores = JSON.stringify({ turn_0: turnScore });

  db.prepare('INSERT INTO evaluation_runs (id, description, created_at) VALUES (?, ?, ?)').run(
    RUN_ID,
    'Synthetic provenance fixture',
    '2026-07-25T00:00:00.000Z',
  );
  db.prepare(
    `INSERT INTO evaluation_results
      (id, run_id, dialogue_id, dialogue_content_hash, tutor_scores,
       config_hash, tutor_overall_score, tutor_rubric_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(1, RUN_ID, DIALOGUE_ID, dialogueHash(log), tutorScores, configHash, 4, rowRubricVersion);
  db.prepare('INSERT INTO score_audit (result_id) VALUES (?)').run('1');
  db.close();

  if (includeLog) {
    mkdirSync(tutorDialoguesDir, { recursive: true });
    writeFileSync(logPath, JSON.stringify(log));
  }

  return { root, dbPath, logsRoot, tutorDialoguesDir, logPath, reportPath, log };
}

function runValidator(fixture, { explicitRun = true, directLogsDir = false } = {}) {
  const reportPath = join(
    fixture.root,
    `report-${explicitRun ? 'single' : 'selected'}-${directLogsDir ? 'direct' : 'root'}.json`,
  );
  const args = [CLI_PATH];
  if (explicitRun) args.push(RUN_ID);
  args.push('--db', fixture.dbPath);
  args.push(directLogsDir ? '--logs-dir' : '--logs');
  args.push(directLogsDir ? fixture.tutorDialoguesDir : fixture.logsRoot);
  args.push('--json', reportPath);
  const processResult = spawnSync(process.execPath, args, { encoding: 'utf8' });
  const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : null;
  return { ...processResult, report, reportPath };
}

function section(report, name) {
  return report.runs[0].sections.find((entry) => entry.section === name);
}

test.afterEach(() => {
  for (const root of fixtureRoots) rmSync(root, { recursive: true, force: true });
  fixtureRoots.clear();
});

test('production CLI passes complete synthetic provenance through both normalized log paths', () => {
  const fixture = createFixture();
  const explicit = runValidator(fixture);
  const selected = runValidator(fixture, { explicitRun: false, directLogsDir: true });

  assert.equal(explicit.status, 0, explicit.stderr || explicit.stdout);
  assert.match(explicit.stdout, /Summary: 8 pass, 0 warn, 0 fail/);
  assert.deepEqual(explicit.report.summary, { pass: 8, warn: 0, fail: 0 });
  assert.equal(selected.status, 0, selected.stderr || selected.stdout);
  assert.match(selected.stdout, /Complete-Provenance Runs \(1\)/);
  assert.equal(selected.report.runs[0].runId, RUN_ID);
});

test('dialogue-content hash drift exits non-zero with a structured hash failure', () => {
  const fixture = createFixture();
  writeFileSync(fixture.logPath, JSON.stringify({ ...fixture.log, mutated: true }));
  const result = runValidator(fixture);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Dialogue log integrity: 0 match, 1 mismatch, 0 missing, 0 parse error/);
  assert.equal(result.report.summary.fail, 1);
  assert.deepEqual(section(result.report, 'dialogue_log_integrity').failures, [
    { id: 1, dialogueId: DIALOGUE_ID, reason: 'hash_mismatch' },
  ]);
});

test('persisted turn-ID mismatch exits non-zero while the dialogue hash remains valid', () => {
  const fixture = createFixture({ logTurnId: 'different-persisted-turn-id' });
  const result = runValidator(fixture);

  assert.equal(result.status, 1);
  assert.equal(section(result.report, 'dialogue_log_integrity').status, 'pass');
  assert.equal(section(result.report, 'turn_id_verification').status, 'fail');
  assert.deepEqual(section(result.report, 'turn_id_verification').failures, [
    { id: 1, dialogueId: DIALOGUE_ID, failedTurns: [0] },
  ]);
});

test('missing required provenance fields fail their exact coverage sections', () => {
  const missingJudgeHash = runValidator(createFixture({ includeJudgeInputHash: false }));
  const missingConfigHash = runValidator(createFixture({ configHash: null }));

  assert.equal(missingJudgeHash.status, 1);
  assert.deepEqual(section(missingJudgeHash.report, 'per_turn_provenance').failuresHash, [{ id: 1, turn: 'turn_0' }]);
  assert.equal(missingConfigHash.status, 1);
  assert.deepEqual(section(missingConfigHash.report, 'config_hash_presence').failures, [
    { id: 1, reason: 'missing_config_hash' },
  ]);
});

test('rubric-version schema mismatch exits non-zero with both versions recorded', () => {
  const fixture = createFixture({ turnRubricVersion: '2.1', rowRubricVersion: '2.2' });
  const result = runValidator(fixture);

  assert.equal(result.status, 1);
  assert.deepEqual(section(result.report, 'rubric_version_consistency').failures, [
    { id: 1, turn: 'turn_0', perTurnVersion: '2.1', rowVersion: '2.2' },
  ]);
});

test('missing dialogue logs and databases fail with exact diagnostics', () => {
  const missingLog = runValidator(createFixture({ includeLog: false }));
  const fixture = createFixture();
  const missingDbPath = join(fixture.root, 'missing.db');
  const missingDb = spawnSync(process.execPath, [CLI_PATH, RUN_ID, '--db', missingDbPath, '--logs', fixture.logsRoot], {
    encoding: 'utf8',
  });

  assert.equal(missingLog.status, 1);
  assert.deepEqual(section(missingLog.report, 'dialogue_log_integrity').failures, [
    { id: 1, dialogueId: DIALOGUE_ID, reason: 'log_file_missing' },
  ]);
  assert.equal(missingDb.status, 1);
  assert.match(missingDb.stderr, new RegExp(`Database not found: ${missingDbPath}`));
});
