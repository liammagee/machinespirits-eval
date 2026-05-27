#!/usr/bin/env node
/**
 * Package one poetics sidecar run as ignored compressed JSONL plus a tracked manifest.
 *
 * The sidecar DB stays the index. This script materializes an archive bundle for
 * raw/generated evidence, then writes a compact manifest suitable for Git.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { openPoeticsStore } from '../services/poeticsStore.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_ARCHIVE_DIR = path.join(ROOT, 'artifacts/poetics-runs');
const DEFAULT_MANIFEST_DIR = path.join(ROOT, 'config/poetics-calibration/runs');
const SCHEMA_VERSION = 'poetics-run-archive-manifest-v1';

function parseArgs(argv) {
  const args = {
    runId: null,
    dbPath: null,
    archiveDir: DEFAULT_ARCHIVE_DIR,
    manifestDir: DEFAULT_MANIFEST_DIR,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--run-id') args.runId = argv[++i];
    else if (token === '--db') args.dbPath = path.resolve(argv[++i]);
    else if (token === '--archive-dir') args.archiveDir = path.resolve(argv[++i]);
    else if (token === '--manifest-dir') args.manifestDir = path.resolve(argv[++i]);
    else if (token === '--dry-run') args.dryRun = true;
    else if (token === '--help' || token === '-h') {
      console.log(`Usage:
  node scripts/package-poetics-run.js --run-id RUN_ID [--db FILE]
      [--archive-dir artifacts/poetics-runs] [--manifest-dir config/poetics-calibration/runs]
      [--dry-run]

Writes ignored compressed JSONL archives under archive-dir/RUN_ID/ and a commit-ready
manifest under manifest-dir/RUN_ID.manifest.json.`);
      process.exit(0);
    } else {
      throw new Error(`unknown arg: ${token}`);
    }
  }
  if (!args.runId) throw new Error('--run-id is required');
  return args;
}

function decodeJson(value, fallback = null) {
  if (value == null || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function encodePathSegment(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, '_');
}

function repoPath(value) {
  if (!value) return null;
  const resolved = path.resolve(value);
  const rel = path.relative(ROOT, resolved);
  return rel.startsWith('..') || path.isAbsolute(rel) ? resolved : rel;
}

function resolveStoredPath(value) {
  if (!value) return null;
  return path.isAbsolute(value) ? value : path.resolve(ROOT, value);
}

function sha256Buffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

function gitCommit() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function normalizeRun(row) {
  return {
    ...row,
    metadata: decodeJson(row.metadata, {}),
  };
}

function normalizeItem(row) {
  return {
    ...row,
    quality_warnings: decodeJson(row.quality_warnings, []),
    metadata: decodeJson(row.metadata, {}),
  };
}

function normalizeScore(row) {
  return {
    ...row,
    flags: decodeJson(row.flags, []),
    metadata: decodeJson(row.metadata, {}),
  };
}

function normalizeJsonMetadata(row) {
  return {
    ...row,
    metadata: decodeJson(row.metadata, {}),
  };
}

function loadRunBundle(db, runId) {
  const run = db.prepare('SELECT * FROM poetics_runs WHERE id = ?').get(runId);
  if (!run) throw new Error(`unknown poetics run: ${runId}`);
  const items = db
    .prepare('SELECT * FROM poetics_items WHERE run_id = ? ORDER BY repeat, unit_id, arm, tid')
    .all(runId)
    .map(normalizeItem);
  const scores = db
    .prepare(
      `
      SELECT s.*
      FROM poetics_scores s
      JOIN poetics_items i ON i.id = s.item_id
      WHERE i.run_id = ?
      ORDER BY s.item_id, s.critic_model, s.score_file
    `,
    )
    .all(runId)
    .map(normalizeScore);
  const labels = db
    .prepare(
      `
      SELECT l.*
      FROM poetics_labels l
      JOIN poetics_items i ON i.id = l.item_id
      WHERE i.run_id = ?
      ORDER BY l.item_id, l.perspective, l.labeller_id, l.label_file
    `,
    )
    .all(runId)
    .map(normalizeJsonMetadata);
  const reviewFlags = db
    .prepare(
      `
      SELECT f.*
      FROM poetics_review_flags f
      JOIN poetics_items i ON i.id = f.item_id
      WHERE i.run_id = ?
      ORDER BY f.item_id, f.flag_type, f.flagger_id
    `,
    )
    .all(runId)
    .map(normalizeJsonMetadata);
  const tutorAdaptations = db
    .prepare(
      `
      SELECT a.*
      FROM poetics_tutor_adaptations a
      JOIN poetics_items i ON i.id = a.item_id
      WHERE i.run_id = ?
      ORDER BY a.item_id, a.analyzer_version
    `,
    )
    .all(runId)
    .map((row) => ({
      ...row,
      learner_self_reframe: Boolean(row.learner_self_reframe),
      tutor_strategy_shift: Boolean(row.tutor_strategy_shift),
      tutor_contingent_adaptation: Boolean(row.tutor_contingent_adaptation),
      shared_salient_terms: decodeJson(row.shared_salient_terms, []),
      metadata: decodeJson(row.metadata, {}),
    }));
  return {
    run: normalizeRun(run),
    items,
    scores,
    labels,
    reviewFlags,
    tutorAdaptations,
  };
}

function artifactRefs(bundle) {
  const refs = new Map();
  const add = (kind, storedPath, context = {}) => {
    if (!storedPath) return;
    const absPath = resolveStoredPath(storedPath);
    const key = path.resolve(absPath);
    if (!refs.has(key)) {
      refs.set(key, {
        kind,
        path: repoPath(absPath),
        storedPath,
        absPath,
        contexts: [],
      });
    }
    refs.get(key).contexts.push(context);
  };

  add('run_spec', bundle.run.spec_path, { runId: bundle.run.id });
  add('run_key', bundle.run.key_path, { runId: bundle.run.id });
  for (const item of bundle.items) {
    const context = { itemId: item.id, tid: item.tid };
    add('sample', item.sample_path, context);
    add('full_transcript', item.full_transcript_path, context);
    add('item_key', item.key_path, context);
  }
  for (const score of bundle.scores) {
    add('score_file', score.score_file, {
      itemId: score.item_id,
      criticModel: score.critic_model,
    });
  }
  for (const label of bundle.labels) {
    add('label_file', label.label_file, {
      itemId: label.item_id,
      labellerId: label.labeller_id,
      perspective: label.perspective,
    });
  }
  for (const adaptation of bundle.tutorAdaptations) {
    add('tutor_trace', adaptation.source_trace_path, {
      itemId: adaptation.item_id,
      analyzerVersion: adaptation.analyzer_version,
    });
  }
  return [...refs.values()].sort((a, b) => String(a.path).localeCompare(String(b.path)));
}

async function writeJsonlGzip(filePath, records) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  let count = 0;
  async function* source() {
    for await (const record of records) {
      count += 1;
      yield `${JSON.stringify(record)}\n`;
    }
  }
  await pipeline(Readable.from(source()), createGzip({ level: 9 }), fs.createWriteStream(filePath));
  const stat = fs.statSync(filePath);
  return {
    path: repoPath(filePath),
    records: count,
    bytes: stat.size,
    sha256: sha256File(filePath),
  };
}

async function writeArtifactArchive(filePath, refs, missingArtifacts) {
  async function* records() {
    for (const ref of refs) {
      if (!fs.existsSync(ref.absPath)) {
        missingArtifacts.push({
          kind: ref.kind,
          path: ref.path,
          contexts: ref.contexts,
        });
        continue;
      }
      const content = fs.readFileSync(ref.absPath, 'utf8');
      const buffer = Buffer.from(content, 'utf8');
      yield {
        kind: ref.kind,
        path: ref.path,
        bytes: buffer.length,
        sha256: sha256Buffer(buffer),
        encoding: 'utf8',
        contexts: ref.contexts,
        content,
      };
    }
  }
  return writeJsonlGzip(filePath, records());
}

function kindCounts(refs) {
  return refs.reduce((acc, ref) => {
    acc[ref.kind] = (acc[ref.kind] || 0) + 1;
    return acc;
  }, {});
}

function summarizeBundle(bundle, refs, missingArtifacts) {
  return {
    items: bundle.items.length,
    scores: bundle.scores.length,
    labels: bundle.labels.length,
    reviewFlags: bundle.reviewFlags.length,
    tutorAdaptations: bundle.tutorAdaptations.length,
    artifactRefs: refs.length,
    archivedArtifacts: refs.length - missingArtifacts.length,
    missingArtifacts: missingArtifacts.length,
  };
}

async function packagePoeticsRun(options) {
  const db = openPoeticsStore(options.dbPath || undefined);
  let bundle;
  try {
    bundle = loadRunBundle(db, options.runId);
  } finally {
    db.close();
  }

  const archiveDir = path.resolve(options.archiveDir || DEFAULT_ARCHIVE_DIR);
  const manifestDir = path.resolve(options.manifestDir || DEFAULT_MANIFEST_DIR);
  const runSegment = encodePathSegment(options.runId);
  const runArchiveDir = path.join(archiveDir, runSegment);
  const refs = artifactRefs(bundle);
  const missingArtifacts = [];

  if (options.dryRun) {
    for (const ref of refs) {
      if (!fs.existsSync(ref.absPath)) {
        missingArtifacts.push({ kind: ref.kind, path: ref.path, contexts: ref.contexts });
      }
    }
    return {
      dryRun: true,
      manifestPath: path.join(manifestDir, `${runSegment}.manifest.json`),
      archiveDir: runArchiveDir,
      manifest: {
        schemaVersion: SCHEMA_VERSION,
        runId: options.runId,
        counts: summarizeBundle(bundle, refs, missingArtifacts),
        artifactKinds: kindCounts(refs),
        missingArtifacts,
      },
    };
  }

  fs.mkdirSync(runArchiveDir, { recursive: true });
  const files = {};
  files.run = await writeJsonlGzip(path.join(runArchiveDir, 'run.jsonl.gz'), [bundle.run]);
  files.items = await writeJsonlGzip(path.join(runArchiveDir, 'items.jsonl.gz'), bundle.items);
  files.scores = await writeJsonlGzip(path.join(runArchiveDir, 'scores.jsonl.gz'), bundle.scores);
  files.labels = await writeJsonlGzip(path.join(runArchiveDir, 'labels.jsonl.gz'), bundle.labels);
  files.reviewFlags = await writeJsonlGzip(path.join(runArchiveDir, 'review-flags.jsonl.gz'), bundle.reviewFlags);
  files.tutorAdaptations = await writeJsonlGzip(
    path.join(runArchiveDir, 'tutor-adaptations.jsonl.gz'),
    bundle.tutorAdaptations,
  );
  files.artifacts = await writeArtifactArchive(path.join(runArchiveDir, 'artifacts.jsonl.gz'), refs, missingArtifacts);

  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    runId: options.runId,
    packagedAt: new Date().toISOString(),
    packagingGitCommit: gitCommit(),
    source: {
      dbPath: repoPath(options.dbPath || process.env.EVAL_DB_PATH || path.join(ROOT, 'data/evaluations.db')),
      runCreatedAt: bundle.run.created_at,
      runSourceRoot: bundle.run.source_root,
      runGitCommit: bundle.run.git_commit,
    },
    archive: {
      archiveDir: repoPath(runArchiveDir),
      compression: 'gzip',
      files,
    },
    counts: summarizeBundle(bundle, refs, missingArtifacts),
    artifactKinds: kindCounts(refs),
    missingArtifacts,
  };

  fs.mkdirSync(manifestDir, { recursive: true });
  const manifestPath = path.join(manifestDir, `${runSegment}.manifest.json`);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return {
    dryRun: false,
    manifestPath,
    archiveDir: runArchiveDir,
    manifest,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await packagePoeticsRun(args);
  const counts = result.manifest.counts;
  if (result.dryRun) {
    console.log(
      `would package poetics run ${args.runId}: ${counts.items} items, ${counts.scores} scores, ` +
        `${counts.archivedArtifacts}/${counts.artifactRefs} artifacts present`,
    );
    console.log(`manifest: ${repoPath(result.manifestPath)}`);
    console.log(`archive: ${repoPath(result.archiveDir)}`);
    return;
  }
  console.log(
    `packaged poetics run ${args.runId}: ${counts.items} items, ${counts.scores} scores, ` +
      `${counts.archivedArtifacts}/${counts.artifactRefs} artifacts archived`,
  );
  console.log(`manifest: ${repoPath(result.manifestPath)}`);
  console.log(`archive: ${repoPath(result.archiveDir)}`);
}

if (path.resolve(process.argv[1] || '') === __filename) {
  main().catch((err) => {
    console.error(err?.stack || String(err));
    process.exit(1);
  });
}

export { artifactRefs, loadRunBundle, packagePoeticsRun };
