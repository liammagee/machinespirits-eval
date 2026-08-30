import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPoeticsStore } from './poeticsStore.js';
import { resolveTutorStubArtifactArchiveDirectory } from './tutorStubArtifactArchive.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const POETICS_EVIDENCE_BUNDLE_SCHEMA = 'machinespirits.poetics.evidence-bundle.v1';

/**
 * The complete claim-evidence classification for the Poetics sidecar.
 *
 * New poetics tables, run-poetics* runners, or sidecar kinds must be added here.
 * The audit below deliberately fails closed when a new surface is not classified.
 * Semantic-v5 is stored in poetics_tutor_adaptations.metadata.peripeteia: its four
 * tri-state measurements and semantic_adjudication_provenance are preserved with
 * the complete table row rather than projected into a lossy compatibility table.
 */
export const POETICS_EVIDENCE_INVENTORY = Object.freeze({
  databaseTables: Object.freeze({
    poetics_runs: Object.freeze({ scope: 'run', claimBearing: true }),
    poetics_items: Object.freeze({ scope: 'run', claimBearing: true }),
    poetics_scores: Object.freeze({ scope: 'item', claimBearing: true }),
    poetics_labels: Object.freeze({ scope: 'item', claimBearing: true }),
    poetics_review_flags: Object.freeze({ scope: 'item', claimBearing: true }),
    poetics_tutor_adaptations: Object.freeze({
      scope: 'item',
      claimBearing: true,
      includes: 'legacy adaptation rows and prospective semantic-v5 measurement family',
    }),
  }),
  sidecars: Object.freeze({
    run_spec: Object.freeze({ claimBearing: true, source: 'poetics_runs.spec_path' }),
    run_key: Object.freeze({ claimBearing: true, source: 'poetics_runs.key_path' }),
    sample: Object.freeze({ claimBearing: true, source: 'poetics_items.sample_path' }),
    full_transcript: Object.freeze({ claimBearing: true, source: 'poetics_items.full_transcript_path' }),
    item_key: Object.freeze({ claimBearing: true, source: 'poetics_items.key_path' }),
    score_file: Object.freeze({ claimBearing: true, source: 'poetics_scores.score_file' }),
    label_file: Object.freeze({ claimBearing: true, source: 'poetics_labels.label_file' }),
    tutor_trace: Object.freeze({ claimBearing: true, source: 'poetics_tutor_adaptations.source_trace_path' }),
    production_batch_plan: Object.freeze({ claimBearing: true, source: 'runner root/batch-plan.json' }),
    raw_run_tree: Object.freeze({ claimBearing: true, source: 'runner root recursive artifact tree' }),
    target_spec: Object.freeze({ claimBearing: true, source: 'loop target specification' }),
    semantic_adjudication_packet: Object.freeze({ claimBearing: true, source: 'semantic-v5 input packet' }),
    tutor_adaptation_report_json: Object.freeze({ claimBearing: true }),
    tutor_adaptation_report_csv: Object.freeze({ claimBearing: true }),
    sidecar_report_json: Object.freeze({ claimBearing: true }),
    sidecar_report_csv: Object.freeze({ claimBearing: true }),
    sidecar_report_markdown: Object.freeze({ claimBearing: true }),
    item_gate_stream: Object.freeze({ claimBearing: true }),
    loop_status_json: Object.freeze({ claimBearing: true }),
    loop_status_markdown: Object.freeze({ claimBearing: true }),
  }),
  runners: Object.freeze({
    'scripts/run-poetics-production-batch.js': Object.freeze({
      claimBearing: true,
      lifecycle: 'emits a partial raw tree; the enclosing loop or explicit packager closes it',
    }),
    'scripts/run-poetics-adaptation-loop.js': Object.freeze({
      claimBearing: true,
      lifecycle: 'automatically creates the terminal durable private bundle',
    }),
  }),
  nonClaimBearingExemptions: Object.freeze({
    sqlite_sequence: 'SQLite AUTOINCREMENT implementation state; no scientific value',
    'database-wal-shm': 'SQLite transport state; committed rows are the evidence',
    'runner-stdout-stderr': 'operator progress only; failures are retained in loop status and raw artifacts',
    'generated-workplan-projections': 'derived planning views, unrelated to run evidence',
  }),
});

function posix(value) {
  return value.split(path.sep).join('/');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function jsonValue(value) {
  if (value == null || value === '') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      ['metadata', 'flags', 'quality_warnings', 'shared_salient_terms'].includes(key) ? jsonValue(value) : value,
    ]),
  );
}

function sourceFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^run-poetics.*\.js$/u.test(entry.name))
    .map((entry) => `scripts/${entry.name}`)
    .sort();
}

export function discoverPoeticsStoreTables(
  source = fs.readFileSync(path.join(ROOT, 'services/poeticsStore.js'), 'utf8'),
) {
  return [...source.matchAll(/CREATE TABLE IF NOT EXISTS\s+([a-zA-Z0-9_]+)/gu)].map((match) => match[1]).sort();
}

export function auditPoeticsEvidenceInventory({ root = ROOT, db = null } = {}) {
  const errors = [];
  const classifiedTables = Object.keys(POETICS_EVIDENCE_INVENTORY.databaseTables).sort();
  const sourceTables = discoverPoeticsStoreTables();
  for (const table of sourceTables) {
    if (!classifiedTables.includes(table)) errors.push(`${table}: poetics store table is not classified`);
  }
  for (const table of classifiedTables) {
    if (!sourceTables.includes(table)) errors.push(`${table}: stale poetics table inventory entry`);
  }
  if (db) {
    const liveTables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'poetics_%' ORDER BY name")
      .all()
      .map((row) => row.name);
    for (const table of liveTables) {
      if (!classifiedTables.includes(table)) errors.push(`${table}: live poetics table is not classified`);
    }
  }
  const classifiedRunners = Object.keys(POETICS_EVIDENCE_INVENTORY.runners).sort();
  const discoveredRunners = sourceFiles(path.join(root, 'scripts'));
  for (const runner of discoveredRunners) {
    if (!classifiedRunners.includes(runner)) errors.push(`${runner}: poetics runner is not classified`);
  }
  for (const runner of classifiedRunners) {
    if (!discoveredRunners.includes(runner)) errors.push(`${runner}: stale poetics runner inventory entry`);
  }
  return { ok: errors.length === 0, errors, tables: sourceTables, runners: discoveredRunners };
}

function tableRows(db, table, runIds) {
  const placeholders = runIds.map(() => '?').join(', ');
  if (table === 'poetics_runs') {
    return db.prepare(`SELECT * FROM poetics_runs WHERE id IN (${placeholders}) ORDER BY id`).all(...runIds);
  }
  if (table === 'poetics_items') {
    return db
      .prepare(
        `SELECT * FROM poetics_items WHERE run_id IN (${placeholders}) ORDER BY run_id, repeat, unit_id, arm, tid`,
      )
      .all(...runIds);
  }
  return db
    .prepare(
      `SELECT evidence.* FROM ${table} evidence JOIN poetics_items item ON item.id = evidence.item_id ` +
        `WHERE item.run_id IN (${placeholders}) ORDER BY item.run_id, evidence.id`,
    )
    .all(...runIds);
}

function referencedArtifacts(tables) {
  const refs = [];
  const add = (surface, storedPath, context) => {
    if (storedPath) refs.push({ surface, path: storedPath, context });
  };
  for (const row of tables.poetics_runs) {
    add('run_spec', row.spec_path, { runId: row.id });
    add('run_key', row.key_path, { runId: row.id });
  }
  for (const row of tables.poetics_items) {
    const context = { itemId: row.id, runId: row.run_id };
    add('sample', row.sample_path, context);
    add('full_transcript', row.full_transcript_path, context);
    add('item_key', row.key_path, context);
  }
  for (const row of tables.poetics_scores) add('score_file', row.score_file, { itemId: row.item_id });
  for (const row of tables.poetics_labels) add('label_file', row.label_file, { itemId: row.item_id });
  for (const row of tables.poetics_tutor_adaptations) {
    add('tutor_trace', row.source_trace_path, { itemId: row.item_id, analyzerVersion: row.analyzer_version });
  }
  return refs;
}

function resolveSource(filePath, root) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(root, filePath);
}

function walk(root) {
  if (!root || !fs.existsSync(root)) return [];
  const files = [];
  const stack = [path.resolve(root)];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  }
  return files.sort();
}

function safeSegment(value) {
  const segment = String(value || '').replace(/[^a-zA-Z0-9._-]/gu, '_');
  if (!segment) throw new Error('poetics evidence bundle id is required');
  return segment;
}

function exclusiveJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}

function writeJsonl(filePath, rows) {
  const body = rows.map((row) => JSON.stringify(normalizeRow(row))).join('\n');
  fs.writeFileSync(filePath, body ? `${body}\n` : '', { flag: 'wx' });
}

function copyEvidenceFile({ source, destination, surface, logicalPath, context }, copied, missing, strict) {
  if (!POETICS_EVIDENCE_INVENTORY.sidecars[surface]) {
    throw new Error(`unclassified poetics claim evidence surface: ${surface}`);
  }
  if (!fs.existsSync(source)) {
    missing.push({ surface, path: logicalPath, context });
    if (strict) throw new Error(`missing poetics claim evidence: ${surface} ${logicalPath}`);
    return;
  }
  const content = fs.readFileSync(source);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content, { flag: 'wx' });
  if (sha256(fs.readFileSync(destination)) !== sha256(content)) {
    throw new Error(`poetics evidence hash verification failed: ${surface} ${logicalPath}`);
  }
  copied.push({ surface, path: logicalPath, bytes: content.length, sha256: sha256(content), context });
}

export function resolvePoeticsEvidenceArchiveDirectory(explicit, options = {}) {
  return resolveTutorStubArtifactArchiveDirectory(explicit, {
    cwd: options.cwd || ROOT,
    repoRoot: options.repoRoot || ROOT,
    env: options.env || process.env,
    commonGitDirectory: options.commonGitDirectory || null,
  });
}

export function createPoeticsEvidenceBundle({
  bundleId,
  status,
  runIds,
  dbPath,
  archiveRoot,
  claimArtifacts = [],
  rawRunRoots = [],
  itemGateRows = [],
  repoRoot = ROOT,
  createdAt = new Date().toISOString(),
}) {
  const ids = [...new Set((runIds || []).filter(Boolean))];
  if (!ids.length) throw new Error('poetics evidence bundle requires at least one run id');
  const terminalSuccess = status === 'passed' || status === 'complete';
  if (terminalSuccess && !itemGateRows.length)
    throw new Error('successful poetics closeout requires item-gate evidence');
  const knownSurfaces = POETICS_EVIDENCE_INVENTORY.sidecars;
  for (const artifact of claimArtifacts) {
    if (!knownSurfaces[artifact.surface]) {
      throw new Error(`unclassified poetics claim evidence surface: ${artifact.surface}`);
    }
  }
  const destinationRoot = resolvePoeticsEvidenceArchiveDirectory(archiveRoot, { repoRoot });
  if (!destinationRoot) {
    throw new Error('durable private poetics evidence archive is unavailable; set EVAL_ARCHIVE_DIR');
  }
  const base = path.join(destinationRoot, 'artifacts', 'poetics-runs');
  const finalDir = path.join(base, safeSegment(bundleId));
  if (fs.existsSync(finalDir)) throw new Error(`poetics evidence bundle is create-once: ${finalDir}`);
  fs.mkdirSync(base, { recursive: true });
  const stageDir = fs.mkdtempSync(path.join(base, `.${safeSegment(bundleId)}.tmp-`));
  const db = openPoeticsStore(dbPath);
  try {
    const audit = auditPoeticsEvidenceInventory({ root: repoRoot, db });
    if (!audit.ok) throw new Error(`poetics evidence inventory audit failed: ${audit.errors.join('; ')}`);
    const tables = Object.fromEntries(
      Object.keys(POETICS_EVIDENCE_INVENTORY.databaseTables).map((table) => [table, tableRows(db, table, ids)]),
    );
    const foundRunIds = new Set(tables.poetics_runs.map((row) => row.id));
    const missingRuns = ids.filter((id) => !foundRunIds.has(id));
    if (terminalSuccess && missingRuns.length)
      throw new Error(`successful poetics closeout lacks run rows: ${missingRuns.join(', ')}`);

    const databaseDir = path.join(stageDir, 'database');
    fs.mkdirSync(databaseDir, { recursive: true });
    const files = [];
    for (const [table, rows] of Object.entries(tables)) {
      const filePath = path.join(databaseDir, `${table}.jsonl`);
      writeJsonl(filePath, rows);
      files.push({
        path: posix(path.relative(stageDir, filePath)),
        bytes: fs.statSync(filePath).size,
        sha256: sha256(fs.readFileSync(filePath)),
      });
    }

    const copied = [];
    const missing = [];
    const artifactsDir = path.join(stageDir, 'artifacts');
    const refs = referencedArtifacts(tables);
    const seen = new Set();
    for (const ref of refs) {
      const source = resolveSource(ref.path, repoRoot);
      const key = `${ref.surface}\0${source}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const relativeSource = path.relative(repoRoot, source);
      const logical =
        relativeSource &&
        relativeSource !== '..' &&
        !relativeSource.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relativeSource)
          ? relativeSource
          : path.join('external', sha256(path.dirname(source)).slice(0, 12), path.basename(source));
      copyEvidenceFile(
        {
          source,
          destination: path.join(artifactsDir, 'referenced', ref.surface, logical),
          surface: ref.surface,
          logicalPath: posix(logical),
          context: ref.context,
        },
        copied,
        missing,
        terminalSuccess,
      );
    }

    for (const [rootIndex, rawRoot] of rawRunRoots.entries()) {
      const resolved = resolveSource(rawRoot, repoRoot);
      if (!fs.existsSync(resolved)) {
        missing.push({ surface: 'raw_run_tree', path: String(rawRoot), context: { rootIndex } });
        continue;
      }
      for (const source of walk(resolved)) {
        const logical = path.join(`run-${String(rootIndex + 1).padStart(2, '0')}`, path.relative(resolved, source));
        copyEvidenceFile(
          {
            source,
            destination: path.join(artifactsDir, 'raw-runs', logical),
            surface: 'raw_run_tree',
            logicalPath: posix(logical),
            context: { root: String(rawRoot) },
          },
          copied,
          missing,
          false,
        );
      }
    }

    for (const artifact of claimArtifacts) {
      const source = resolveSource(artifact.path, repoRoot);
      const logical = path.basename(artifact.name || source);
      copyEvidenceFile(
        {
          source,
          destination: path.join(artifactsDir, 'sidecars', safeSegment(artifact.surface), logical),
          surface: artifact.surface,
          logicalPath: posix(logical),
          context: artifact.context || null,
        },
        copied,
        missing,
        artifact.required !== false || terminalSuccess,
      );
    }

    const gatesPath = path.join(stageDir, 'item-gates.jsonl');
    writeJsonl(gatesPath, itemGateRows);
    files.push({
      path: 'item-gates.jsonl',
      bytes: fs.statSync(gatesPath).size,
      sha256: sha256(fs.readFileSync(gatesPath)),
    });

    for (const filePath of walk(artifactsDir)) {
      files.push({
        path: posix(path.relative(stageDir, filePath)),
        bytes: fs.statSync(filePath).size,
        sha256: sha256(fs.readFileSync(filePath)),
      });
    }
    files.sort((left, right) => left.path.localeCompare(right.path));
    const manifest = {
      schema: POETICS_EVIDENCE_BUNDLE_SCHEMA,
      bundleId,
      status,
      createdAt,
      createOnce: true,
      durablePrivateStorage: true,
      runIds: ids,
      inventory: {
        databaseTables: Object.keys(POETICS_EVIDENCE_INVENTORY.databaseTables),
        sidecarKinds: Object.keys(POETICS_EVIDENCE_INVENTORY.sidecars),
        nonClaimBearingExemptions: POETICS_EVIDENCE_INVENTORY.nonClaimBearingExemptions,
      },
      counts: Object.fromEntries(Object.entries(tables).map(([table, rows]) => [table, rows.length])),
      itemGateRows: itemGateRows.length,
      copiedArtifacts: copied,
      missingArtifacts: missing,
      files,
      filesSha256: sha256(JSON.stringify(files)),
    };
    exclusiveJson(path.join(stageDir, 'manifest.json'), manifest);
    fs.renameSync(stageDir, finalDir);
    return { path: finalDir, manifestPath: path.join(finalDir, 'manifest.json'), manifest };
  } catch (error) {
    fs.rmSync(stageDir, { recursive: true, force: true });
    throw error;
  } finally {
    db.close();
  }
}
