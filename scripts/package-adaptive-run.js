#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createGzip } from 'node:zlib';
import { assertExperimentRun, hashFile, sha256 } from '../services/experimentRunArtifacts.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_ARCHIVE_DIR = path.join(ROOT, 'artifacts', 'adaptive-tutor-runs');
const DEFAULT_MANIFEST_DIR = path.join(ROOT, 'config', 'adaptive-tutor-evidence');
const ARCHIVE_SCHEMA = 'machinespirits.adaptive-tutor-run-archive.v1';
const MANIFEST_SCHEMA = 'machinespirits.adaptive-tutor-evidence-manifest.v1';
const CLAIM_STATUSES = new Set([
  'settled',
  'scope-bound',
  'exploratory',
  'killed',
  'speculative',
  'methods',
  'planned',
  'future',
]);

function safeSlug(value) {
  return String(value || 'run')
    .replace(/[^a-z0-9._-]+/giu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 100);
}

function displayPath(filePath) {
  const relative = path.relative(ROOT, filePath);
  return relative.startsWith('..') || path.isAbsolute(relative) ? filePath : relative;
}

function exclusiveJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  try {
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error(`Refusing to overwrite evidence manifest at ${filePath}`);
    throw error;
  }
}

function archiveFileRows(runDir, verification) {
  const rows = verification.inventory.map((entry) => ({
    path: entry.path,
    sha256: entry.sha256,
    bytes: entry.bytes,
    schema: entry.schema,
  }));
  const sealPath = path.join(runDir, 'run-seal.json');
  const stat = fs.statSync(sealPath);
  rows.push({
    path: 'run-seal.json',
    sha256: hashFile(sealPath),
    bytes: stat.size,
    schema: verification.seal.schema,
  });
  return rows.sort((left, right) => left.path.localeCompare(right.path));
}

async function writeArchive(archivePath, runDir, rows, header) {
  fs.mkdirSync(path.dirname(archivePath), { recursive: true });
  async function* records() {
    yield `${JSON.stringify(header)}\n`;
    for (const row of rows) {
      const content = fs.readFileSync(path.join(runDir, row.path));
      if (content.length !== row.bytes || sha256(content) !== row.sha256) {
        throw new Error(`Source artifact changed during packaging: ${row.path}`);
      }
      yield `${JSON.stringify({
        type: 'file',
        ...row,
        encoding: 'base64',
        content: content.toString('base64'),
      })}\n`;
    }
  }
  await pipeline(
    Readable.from(records()),
    createGzip({ level: 9, mtime: 0 }),
    fs.createWriteStream(archivePath, { flags: 'wx', mode: 0o600 }),
  );
}

export async function packageAdaptiveRun({
  runDir,
  archiveDir = DEFAULT_ARCHIVE_DIR,
  manifestDir = DEFAULT_MANIFEST_DIR,
  claimStatus = 'methods',
} = {}) {
  if (!runDir) throw new Error('runDir is required');
  const source = path.resolve(runDir || '');
  if (!CLAIM_STATUSES.has(claimStatus)) throw new Error(`Unknown claim status: ${claimStatus}`);
  const verification = assertExperimentRun(source);
  const sealPath = path.join(source, 'run-seal.json');
  const sealSha256 = hashFile(sealPath);
  const runId = verification.plan.runId;
  const stem = `${safeSlug(runId)}-${sealSha256.slice(0, 12)}`;
  const resolvedArchiveDir = path.resolve(archiveDir);
  const resolvedManifestDir = path.resolve(manifestDir);
  const archivePath = path.join(resolvedArchiveDir, `${stem}.jsonl.gz`);
  const manifestPath = path.join(resolvedManifestDir, `${stem}.manifest.json`);
  if (fs.existsSync(archivePath) || fs.existsSync(manifestPath)) {
    throw new Error(`Refusing partial or duplicate packaging; archive/manifest destination already exists for ${stem}`);
  }
  const files = archiveFileRows(source, verification);
  const header = {
    type: 'header',
    schema: ARCHIVE_SCHEMA,
    runId,
    sealSha256,
    fileCount: files.length,
  };
  try {
    await writeArchive(archivePath, source, files, header);
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error(`Refusing to overwrite adaptive-run archive at ${archivePath}`);
    throw error;
  }
  const archiveStat = fs.statSync(archivePath);
  const manifest = {
    schema: MANIFEST_SCHEMA,
    runId,
    createdAt: new Date().toISOString(),
    claimStatus,
    source: {
      planSha256: verification.seal.planSha256,
      eventsSha256: verification.seal.eventsSha256,
      inventorySha256: verification.seal.inventorySha256,
      sealSha256,
    },
    archive: {
      path: displayPath(archivePath),
      availability: 'local_file_pointer',
      format: 'jsonl+gzip+base64-v1',
      sha256: hashFile(archivePath),
      bytes: archiveStat.size,
      files: files.length,
    },
    exclusions: [
      'model outputs are archived, not regenerated',
      'the manifest points to a local archive and does not transport or publish the archive itself',
      'a successful replay proves job and draw determinism, not deterministic language-model generation',
      'simulated learner outcomes do not estimate human learning effects',
    ],
    verification: {
      source: `node scripts/verify-experiment-run.js --run-dir ${displayPath(source)}`,
      restore: `node scripts/restore-adaptive-run.js --archive ${displayPath(archivePath)} --manifest ${displayPath(manifestPath)} --out <fresh-dir>`,
    },
  };
  exclusiveJson(manifestPath, manifest);
  return { archivePath, manifestPath, manifest };
}

async function main() {
  const { values } = parseArgs({
    options: {
      'run-dir': { type: 'string' },
      'archive-dir': { type: 'string', default: DEFAULT_ARCHIVE_DIR },
      'manifest-dir': { type: 'string', default: DEFAULT_MANIFEST_DIR },
      'claim-status': { type: 'string', default: 'methods' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help || !values['run-dir']) {
    console.log(
      'Usage: node scripts/package-adaptive-run.js --run-dir DIR [--archive-dir DIR] [--manifest-dir DIR] [--claim-status STATUS]',
    );
    if (!values.help) process.exitCode = 1;
    return;
  }
  const result = await packageAdaptiveRun({
    runDir: values['run-dir'],
    archiveDir: values['archive-dir'],
    manifestDir: values['manifest-dir'],
    claimStatus: values['claim-status'],
  });
  console.log(`archive  ${result.archivePath}`);
  console.log(`manifest ${result.manifestPath}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  });
}
