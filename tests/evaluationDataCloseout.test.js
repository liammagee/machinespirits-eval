import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

test('ordinary npm tests receive isolated evaluation data paths', () => {
  const output = execFileSync(process.execPath, ['scripts/run-hermetic-tests.js', '--print-env'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const env = JSON.parse(output);
  assert.deepEqual(Object.keys(env).sort(), [
    'AUTH_DB_PATH',
    'EVAL_DB_PATH',
    'EVAL_EXPORTS_DIR',
    'EVAL_LOGS_DIR',
    'EVAL_WRITING_PAD_DIR',
    'TUTOR_CORE_LOG_DIR',
    'TUTOR_STUB_EVAL_INDEX_ROOT',
    'TUTOR_STUB_EVAL_TRACE_DIR',
    'TUTOR_STUB_TRACE_DIR',
  ]);
  for (const [name, value] of Object.entries(env)) {
    assert.match(value, /machinespirits-tests-/u, `${name} should use the shared temporary root`);
    assert.equal(value.startsWith(ROOT), false, `${name} should stay outside the repository`);
  }
});

test('database closeout discards test rows and idempotently imports the exact claim set', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluation-closeout-'));
  const localDb = path.join(tmp, 'local.db');
  const canonicalDb = path.join(tmp, 'canonical.db');
  const sourceSummary = path.join(tmp, 'auto-eval-source.json');
  const rowsPath = path.join(tmp, 'claim-rows.json');
  const manifestPath = path.join(tmp, 'claim-manifest.json');
  const configPath = path.join(tmp, 'closeout.json');
  fs.writeFileSync(sourceSummary, '{"schema":"fixture"}\n');

  const local = new Database(localDb);
  local.exec(`
    CREATE TABLE evaluation_runs (id TEXT PRIMARY KEY, description TEXT);
    CREATE TABLE evaluation_results (id INTEGER PRIMARY KEY, run_id TEXT);
    CREATE TABLE tutor_stub_eval_runs (
      id TEXT PRIMARY KEY, summary_path TEXT, source_hash TEXT, rows INTEGER
    );
    CREATE TABLE tutor_stub_eval_rows (id INTEGER PRIMARY KEY, eval_run_id TEXT);
    INSERT INTO evaluation_runs VALUES ('test-run', 'New User - First Visit');
    INSERT INTO evaluation_results VALUES (1, 'test-run');
  `);
  local
    .prepare('INSERT INTO tutor_stub_eval_runs VALUES (?, ?, ?, ?)')
    .run('exploratory', sourceSummary, sha256(sourceSummary), 1);
  local.prepare('INSERT INTO tutor_stub_eval_rows VALUES (?, ?)').run(1, 'exploratory');
  local.close();
  new Database(canonicalDb).close();

  const rows = [
    ['terra', 'diligent', 'bland', 1, 0.5],
    ['sonnet', 'proof_skipper', 'field', 1, 0.2],
  ].map(([family, profile, policy, runIndex, coverage]) => ({
    family,
    profile,
    policy,
    runIndex,
    key: `${policy}-r${runIndex}`,
    runId: `${family}-${profile}-${policy}-${runIndex}`,
    sourceSummary: `${family}/summary.json`,
    sourceSummarySha256: 'a'.repeat(64),
    trace: `${family}/trace.jsonl`,
    traceSha256: 'b'.repeat(64),
    primaryOnly: false,
    primaryEndpoint: {
      horizon: 16,
      complete: true,
      coverage,
      grounded: false,
      hardSafetyPassed: true,
    },
    observedModels: { tutor: { label: family } },
    git: { sha: 'c'.repeat(40) },
    configSha256: 'd'.repeat(64),
  }));
  fs.writeFileSync(rowsPath, `${JSON.stringify({ schema: 'fixture', rows }, null, 2)}\n`);
  fs.writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        schema: 'fixture-manifest',
        derivedArtifacts: [{ path: rowsPath, sha256: sha256(rowsPath), bytes: fs.statSync(rowsPath).size }],
        verdict: { summary: 'fixture verdict' },
      },
      null,
      2,
    )}\n`,
  );
  fs.writeFileSync(
    configPath,
    `${JSON.stringify(
      {
        schema: 'machinespirits.evaluation-data-closeout.v1',
        claimSets: [
          {
            id: 'fixture-claim',
            paperSection: '6.17',
            claimStatus: 'scope-bound',
            manifest: manifestPath,
            rows: rowsPath,
            expectedRows: 2,
          },
        ],
      },
      null,
      2,
    )}\n`,
  );

  const command = [
    'scripts/closeout-worktree-db.js',
    '--local-db',
    localDb,
    '--canonical-db',
    canonicalDb,
    '--config',
    configPath,
    '--json',
  ];
  const before = JSON.parse(execFileSync(process.execPath, command, { cwd: ROOT, encoding: 'utf8' }));
  assert.equal(before.local.evaluationResults.testArtifacts, 1);
  assert.equal(before.local.evaluationResults.unresolvedDurable, 0);
  assert.equal(before.local.tutorStub.sourcePresent, 1);
  assert.equal(before.claimSets[0].complete, false);

  const applied = JSON.parse(execFileSync(process.execPath, [...command, '--apply'], { cwd: ROOT, encoding: 'utf8' }));
  assert.equal(applied.ok, true);
  assert.equal(applied.claimSets[0].importedRows, 2);
  assert.ok(applied.backup?.path);
  assert.ok(fs.existsSync(applied.backup.path));

  const reapplied = JSON.parse(
    execFileSync(process.execPath, [...command, '--apply'], { cwd: ROOT, encoding: 'utf8' }),
  );
  assert.equal(reapplied.ok, true);
  const canonical = new Database(canonicalDb, { readonly: true });
  try {
    assert.equal(canonical.prepare('SELECT COUNT(*) AS n FROM tutor_stub_claim_rows').get().n, 2);
    assert.equal(canonical.prepare('SELECT imported_rows FROM tutor_stub_claim_sets').get().imported_rows, 2);
    assert.equal(
      canonical.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'evaluation_results'").get().n,
      0,
    );
  } finally {
    canonical.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
