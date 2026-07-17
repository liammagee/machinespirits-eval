#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import Database from 'better-sqlite3';
import { resolveCanonicalEvaluationDbPath } from '../services/evaluationDataPaths.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST_RUN_DESCRIPTIONS = new Set([
  'New User - First Visit',
  'Evaluation: 1 configs x 1 scenarios',
  'Comparison: budget vs default',
  '1 profiles × 1 scenarios',
  'storeRejudgment propagation test',
]);

const { values: args } = parseArgs({
  options: {
    'local-db': { type: 'string', default: path.join(ROOT, 'data', 'evaluations.db') },
    'canonical-db': { type: 'string', default: resolveCanonicalEvaluationDbPath() },
    config: { type: 'string', default: path.join(ROOT, 'config', 'evaluation-data-closeout.json') },
    apply: { type: 'boolean', default: false },
    check: { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
    'allow-missing-local-db': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function usage() {
  console.log(`Usage:
  npm run db:closeout -- [--apply]
  npm run merge:preflight

Default mode is a non-mutating audit. --apply backs up the canonical DB and
idempotently imports configured claim sets. It never copies a SQLite file and
never imports test-like evaluation_results rows.`);
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function sha256File(filePath) {
  const hash = createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function tableExists(db, name) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
}

function readConfig() {
  const configPath = resolvePath(args.config);
  if (!fs.existsSync(configPath)) throw new Error(`Closeout config not found: ${configPath}`);
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (config.schema !== 'machinespirits.evaluation-data-closeout.v1' || !Array.isArray(config.claimSets)) {
    throw new Error(`Unsupported closeout config: ${configPath}`);
  }
  return { configPath, config };
}

function inspectLocalDatabase(localDbPath, canonicalDbPath) {
  if (!fs.existsSync(localDbPath)) {
    return {
      exists: false,
      sameAsCanonical: false,
      evaluationResults: { total: 0, testArtifacts: 0, unresolvedDurable: 0, unresolvedRuns: [] },
      tutorStub: { runs: 0, rows: 0, sourcePresent: 0, sourceMissing: 0, missingSources: [] },
    };
  }
  let sameAsCanonical = false;
  try {
    sameAsCanonical = fs.realpathSync(localDbPath) === fs.realpathSync(canonicalDbPath);
  } catch {
    sameAsCanonical = path.resolve(localDbPath) === path.resolve(canonicalDbPath);
  }
  if (sameAsCanonical) {
    return {
      exists: true,
      sameAsCanonical: true,
      evaluationResults: { total: 0, testArtifacts: 0, unresolvedDurable: 0, unresolvedRuns: [] },
      tutorStub: { runs: 0, rows: 0, sourcePresent: 0, sourceMissing: 0, missingSources: [] },
    };
  }

  const db = new Database(localDbPath, { readonly: true, fileMustExist: true });
  try {
    const evaluation = {
      total: tableExists(db, 'evaluation_results')
        ? Number(db.prepare('SELECT COUNT(*) AS n FROM evaluation_results').get().n)
        : 0,
      testArtifacts: 0,
      unresolvedDurable: 0,
      unresolvedRuns: [],
    };
    if (evaluation.total) {
      const rows = tableExists(db, 'evaluation_runs')
        ? db
            .prepare(
              `
              SELECT r.run_id, COALESCE(er.description, '') AS description, COUNT(*) AS rows
              FROM evaluation_results r
              LEFT JOIN evaluation_runs er ON er.id = r.run_id
              GROUP BY r.run_id, er.description
              ORDER BY r.run_id
            `,
            )
            .all()
        : db.prepare('SELECT run_id, COUNT(*) AS rows FROM evaluation_results GROUP BY run_id').all();
      for (const row of rows) {
        if (TEST_RUN_DESCRIPTIONS.has(String(row.description || ''))) evaluation.testArtifacts += Number(row.rows);
        else
          evaluation.unresolvedRuns.push({ runId: row.run_id, description: row.description || null, rows: row.rows });
      }
      evaluation.unresolvedDurable = evaluation.unresolvedRuns.reduce((sum, row) => sum + Number(row.rows), 0);
    }

    const tutorRows = tableExists(db, 'tutor_stub_eval_rows')
      ? Number(db.prepare('SELECT COUNT(*) AS n FROM tutor_stub_eval_rows').get().n)
      : 0;
    const tutorRuns = tableExists(db, 'tutor_stub_eval_runs')
      ? db.prepare('SELECT id, summary_path, source_hash, rows FROM tutor_stub_eval_runs ORDER BY id').all()
      : [];
    const sourceRows = tutorRuns.map((run) => {
      const sourcePath = resolvePath(run.summary_path);
      return { ...run, sourcePath, sourcePresent: fs.existsSync(sourcePath) };
    });
    return {
      exists: true,
      sameAsCanonical: false,
      evaluationResults: evaluation,
      tutorStub: {
        runs: tutorRuns.length,
        rows: tutorRows,
        sourcePresent: sourceRows.filter((row) => row.sourcePresent).length,
        sourceMissing: sourceRows.filter((row) => !row.sourcePresent).length,
        missingSources: sourceRows.filter((row) => !row.sourcePresent).map((row) => row.summary_path),
      },
    };
  } finally {
    db.close();
  }
}

function ensureClaimSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tutor_stub_claim_sets (
      id TEXT PRIMARY KEY,
      paper_section TEXT NOT NULL,
      claim_status TEXT NOT NULL,
      manifest_path TEXT NOT NULL,
      manifest_sha256 TEXT NOT NULL,
      rows_path TEXT NOT NULL,
      rows_sha256 TEXT NOT NULL,
      expected_rows INTEGER NOT NULL,
      imported_rows INTEGER NOT NULL,
      verdict_json TEXT,
      imported_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tutor_stub_claim_rows (
      claim_set_id TEXT NOT NULL,
      family TEXT NOT NULL,
      profile TEXT NOT NULL,
      policy TEXT NOT NULL,
      run_index INTEGER NOT NULL,
      run_id TEXT,
      source_summary TEXT NOT NULL,
      source_summary_sha256 TEXT NOT NULL,
      trace_path TEXT NOT NULL,
      trace_sha256 TEXT NOT NULL,
      primary_horizon INTEGER NOT NULL,
      primary_coverage REAL NOT NULL,
      primary_grounded INTEGER NOT NULL,
      hard_safety_passed INTEGER NOT NULL,
      primary_only INTEGER NOT NULL,
      observed_models_json TEXT,
      git_sha TEXT,
      config_sha256 TEXT,
      row_json TEXT NOT NULL,
      PRIMARY KEY (claim_set_id, family, profile, policy, run_index),
      FOREIGN KEY (claim_set_id) REFERENCES tutor_stub_claim_sets(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_tutor_stub_claim_rows_source
      ON tutor_stub_claim_rows(source_summary_sha256, trace_sha256);
  `);
}

function verifiedClaimSet(spec) {
  const manifestPath = resolvePath(spec.manifest);
  const rowsPath = resolvePath(spec.rows);
  if (!fs.existsSync(manifestPath) || !fs.existsSync(rowsPath)) {
    throw new Error(`Claim set ${spec.id} is missing its manifest or rows artifact`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const rowsArtifact = JSON.parse(fs.readFileSync(rowsPath, 'utf8'));
  const rows = Array.isArray(rowsArtifact.rows) ? rowsArtifact.rows : [];
  if (rows.length !== Number(spec.expectedRows)) {
    throw new Error(`Claim set ${spec.id}: expected ${spec.expectedRows} rows, found ${rows.length}`);
  }
  const declaredRows = (manifest.derivedArtifacts || []).find((entry) => entry.path === spec.rows);
  const rowsHash = sha256File(rowsPath);
  if (!declaredRows || declaredRows.sha256 !== rowsHash || Number(declaredRows.bytes) !== fs.statSync(rowsPath).size) {
    throw new Error(`Claim set ${spec.id}: rows artifact does not match its final-analysis manifest`);
  }
  for (const row of rows) {
    if (
      !row.family ||
      !row.profile ||
      !row.policy ||
      !Number.isInteger(Number(row.runIndex)) ||
      !row.sourceSummarySha256 ||
      !row.traceSha256 ||
      row.primaryEndpoint?.complete !== true
    ) {
      throw new Error(`Claim set ${spec.id}: malformed selected row ${JSON.stringify(row.key || null)}`);
    }
  }
  return { spec, manifestPath, rowsPath, manifest, rows, manifestHash: sha256File(manifestPath), rowsHash };
}

function inspectClaimSets(canonicalDbPath, specs) {
  const verified = specs.map(verifiedClaimSet);
  if (!fs.existsSync(canonicalDbPath)) {
    return verified.map((claim) => ({
      id: claim.spec.id,
      expectedRows: claim.rows.length,
      importedRows: 0,
      complete: false,
    }));
  }
  const db = new Database(canonicalDbPath, { readonly: true, fileMustExist: true });
  try {
    if (!tableExists(db, 'tutor_stub_claim_rows')) {
      return verified.map((claim) => ({
        id: claim.spec.id,
        expectedRows: claim.rows.length,
        importedRows: 0,
        complete: false,
      }));
    }
    return verified.map((claim) => {
      const importedRows = Number(
        db.prepare('SELECT COUNT(*) AS n FROM tutor_stub_claim_rows WHERE claim_set_id = ?').get(claim.spec.id).n,
      );
      return {
        id: claim.spec.id,
        expectedRows: claim.rows.length,
        importedRows,
        complete: importedRows === claim.rows.length,
      };
    });
  } finally {
    db.close();
  }
}

async function backupCanonicalDatabase(canonicalDbPath) {
  if (!fs.existsSync(canonicalDbPath)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/gu, '-');
  const backupPath = `${canonicalDbPath}.pre-closeout-${stamp}.bak`;
  const db = new Database(canonicalDbPath, { readonly: true, fileMustExist: true });
  try {
    await db.backup(backupPath);
  } finally {
    db.close();
  }
  return { path: backupPath, sha256: sha256File(backupPath), bytes: fs.statSync(backupPath).size };
}

function importClaimSets(canonicalDbPath, specs) {
  fs.mkdirSync(path.dirname(canonicalDbPath), { recursive: true });
  const db = new Database(canonicalDbPath);
  db.pragma('foreign_keys = ON');
  try {
    ensureClaimSchema(db);
    const upsertSet = db.prepare(`
      INSERT INTO tutor_stub_claim_sets (
        id, paper_section, claim_status, manifest_path, manifest_sha256,
        rows_path, rows_sha256, expected_rows, imported_rows, verdict_json, imported_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        paper_section = excluded.paper_section,
        claim_status = excluded.claim_status,
        manifest_path = excluded.manifest_path,
        manifest_sha256 = excluded.manifest_sha256,
        rows_path = excluded.rows_path,
        rows_sha256 = excluded.rows_sha256,
        expected_rows = excluded.expected_rows,
        imported_rows = excluded.imported_rows,
        verdict_json = excluded.verdict_json,
        imported_at = excluded.imported_at
    `);
    const insertRow = db.prepare(`
      INSERT INTO tutor_stub_claim_rows (
        claim_set_id, family, profile, policy, run_index, run_id,
        source_summary, source_summary_sha256, trace_path, trace_sha256,
        primary_horizon, primary_coverage, primary_grounded, hard_safety_passed,
        primary_only, observed_models_json, git_sha, config_sha256, row_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const transaction = db.transaction((claim) => {
      upsertSet.run(
        claim.spec.id,
        String(claim.spec.paperSection),
        String(claim.spec.claimStatus),
        path.relative(ROOT, claim.manifestPath),
        claim.manifestHash,
        path.relative(ROOT, claim.rowsPath),
        claim.rowsHash,
        claim.rows.length,
        claim.rows.length,
        JSON.stringify(claim.manifest.verdict || null),
        new Date().toISOString(),
      );
      db.prepare('DELETE FROM tutor_stub_claim_rows WHERE claim_set_id = ?').run(claim.spec.id);
      for (const row of claim.rows) {
        insertRow.run(
          claim.spec.id,
          row.family,
          row.profile,
          row.policy,
          Number(row.runIndex),
          row.runId || null,
          row.sourceSummary,
          row.sourceSummarySha256,
          row.trace,
          row.traceSha256,
          Number(row.primaryEndpoint.horizon),
          Number(row.primaryEndpoint.coverage),
          row.primaryEndpoint.grounded ? 1 : 0,
          row.primaryEndpoint.hardSafetyPassed ? 1 : 0,
          row.primaryOnly ? 1 : 0,
          JSON.stringify(row.observedModels || null),
          row.git?.sha || null,
          row.configSha256 || null,
          JSON.stringify(row),
        );
      }
    });
    for (const spec of specs) transaction(verifiedClaimSet(spec));
    const integrity = db.pragma('integrity_check', { simple: true });
    if (integrity !== 'ok') throw new Error(`Canonical SQLite integrity_check failed: ${integrity}`);
  } finally {
    db.close();
  }
}

function render(report) {
  const lines = [
    '# Evaluation Data Closeout',
    '',
    `- Local DB: ${report.localDb}`,
    `- Canonical DB: ${report.canonicalDb}`,
    `- Local DB aliases canonical: ${report.local.sameAsCanonical ? 'yes' : 'no'}`,
    `- Local evaluation_results: ${report.local.evaluationResults.total} (${report.local.evaluationResults.testArtifacts} test artifacts; ${report.local.evaluationResults.unresolvedDurable} unresolved durable)`,
    `- Local tutor-stub SQL: ${report.local.tutorStub.runs} runs / ${report.local.tutorStub.rows} rows (${report.local.tutorStub.sourcePresent} source summaries present; ${report.local.tutorStub.sourceMissing} missing)`,
    `- Claim sets: ${report.claimSets.map((row) => `${row.id} ${row.importedRows}/${row.expectedRows}`).join(', ') || 'none'}`,
    `- Merge preflight: ${report.ok ? 'PASS' : 'BLOCKED'}`,
  ];
  if (report.backup) lines.push(`- Canonical backup: ${report.backup.path} (${report.backup.sha256})`);
  if (report.blockers.length) lines.push('', 'Blockers:', ...report.blockers.map((row) => `- ${row}`));
  return `${lines.join('\n')}\n`;
}

async function main() {
  if (args.help) {
    usage();
    return;
  }
  const localDbPath = resolvePath(args['local-db']);
  const canonicalDbPath = resolvePath(args['canonical-db']);
  const { configPath, config } = readConfig();
  let local = inspectLocalDatabase(localDbPath, canonicalDbPath);
  let backup = null;
  if (args.apply) {
    if (local.evaluationResults.unresolvedDurable > 0) {
      throw new Error('Refusing apply: worktree DB contains unclassified durable evaluation_results rows');
    }
    if (local.tutorStub.sourceMissing > 0) {
      throw new Error('Refusing apply: worktree DB contains tutor-stub rows whose source summaries are missing');
    }
    backup = await backupCanonicalDatabase(canonicalDbPath);
    importClaimSets(canonicalDbPath, config.claimSets);
    local = inspectLocalDatabase(localDbPath, canonicalDbPath);
  }
  const claimSets = inspectClaimSets(canonicalDbPath, config.claimSets);
  const blockers = [];
  if (!local.exists && !args['allow-missing-local-db']) blockers.push('worktree-local database is missing');
  if (local.evaluationResults.unresolvedDurable) {
    blockers.push(`${local.evaluationResults.unresolvedDurable} evaluation_results rows are not classified as tests`);
  }
  if (local.tutorStub.sourceMissing)
    blockers.push(`${local.tutorStub.sourceMissing} tutor-stub source summaries are missing`);
  for (const claim of claimSets.filter((row) => !row.complete)) {
    blockers.push(`claim set ${claim.id} is only ${claim.importedRows}/${claim.expectedRows} in canonical SQL`);
  }
  const report = {
    schema: 'machinespirits.evaluation-data-closeout-report.v1',
    generatedAt: new Date().toISOString(),
    mode: args.apply ? 'apply' : 'audit',
    config: path.relative(ROOT, configPath),
    localDb: localDbPath,
    canonicalDb: canonicalDbPath,
    local,
    claimSets,
    backup,
    blockers,
    ok: blockers.length === 0,
  };
  console.log(args.json ? JSON.stringify(report, null, 2) : render(report));
  if ((args.check || args.apply) && !report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`[db-closeout] ${error.message}`);
  process.exit(1);
});
