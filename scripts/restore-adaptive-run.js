#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { gunzipSync } from 'node:zlib';
import { assertExperimentRun, sha256 } from '../services/experimentRunArtifacts.js';

const ARCHIVE_SCHEMA = 'machinespirits.adaptive-tutor-run-archive.v1';
const MANIFEST_SCHEMA = 'machinespirits.adaptive-tutor-evidence-manifest.v1';

function safeOutputPath(root, relative) {
  if (!relative || path.isAbsolute(relative) || relative.split(/[\\/]/u).includes('..')) {
    throw new Error(`Unsafe archive path: ${relative}`);
  }
  const resolved = path.resolve(root, relative);
  const back = path.relative(root, resolved);
  if (back.startsWith('..') || path.isAbsolute(back)) throw new Error(`Archive path escapes output: ${relative}`);
  return resolved;
}

export function restoreAdaptiveRun({ archivePath, manifestPath, outDir } = {}) {
  if (!archivePath) throw new Error('archivePath is required');
  if (!manifestPath) throw new Error('manifestPath is required');
  if (!outDir) throw new Error('outDir is required');
  const archive = path.resolve(archivePath || '');
  const manifestFile = path.resolve(manifestPath || '');
  const output = path.resolve(outDir || '');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  if (manifest.schema !== MANIFEST_SCHEMA) {
    throw new Error(`Unsupported adaptive-run manifest schema: ${manifest.schema || 'missing'}`);
  }
  const archiveBytes = fs.statSync(archive).size;
  if (archiveBytes !== manifest.archive?.bytes) {
    throw new Error(`Archive byte count does not match manifest: ${archiveBytes} != ${manifest.archive?.bytes}`);
  }
  const archiveSha256 = sha256(fs.readFileSync(archive));
  if (archiveSha256 !== manifest.archive?.sha256) throw new Error('Archive checksum does not match manifest');
  const lines = gunzipSync(fs.readFileSync(archive)).toString('utf8').split('\n').filter(Boolean);
  if (!lines.length) throw new Error('Adaptive-run archive is empty');
  const header = JSON.parse(lines[0]);
  if (header.type !== 'header' || header.schema !== ARCHIVE_SCHEMA) {
    throw new Error(`Unsupported adaptive-run archive schema: ${header.schema || 'missing'}`);
  }
  if (header.runId !== manifest.runId) throw new Error('Archive run id does not match manifest');
  if (header.sealSha256 !== manifest.source?.sealSha256) {
    throw new Error('Archive seal checksum does not match manifest');
  }
  if (header.fileCount !== manifest.archive?.files) throw new Error('Archive file count does not match manifest');
  const records = lines.slice(1).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid archive JSONL at record ${index + 2}: ${error.message}`);
    }
  });
  if (records.length !== header.fileCount) {
    throw new Error(`Archive file count mismatch: expected ${header.fileCount}, found ${records.length}`);
  }
  if (fs.existsSync(output) && fs.readdirSync(output).length > 0) {
    throw new Error(`Refusing to restore into non-empty directory ${output}`);
  }
  fs.mkdirSync(output, { recursive: true });
  for (const record of records) {
    if (record.type !== 'file' || record.encoding !== 'base64') throw new Error('Invalid archive file record');
    const content = Buffer.from(record.content, 'base64');
    if (content.length !== record.bytes) throw new Error(`Archive byte-count mismatch for ${record.path}`);
    if (sha256(content) !== record.sha256) throw new Error(`Archive checksum mismatch for ${record.path}`);
    const filePath = safeOutputPath(output, record.path);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, { flag: 'wx', mode: 0o600 });
  }
  const sealPath = path.join(output, 'run-seal.json');
  if (sha256(fs.readFileSync(sealPath)) !== header.sealSha256) throw new Error('Restored run seal checksum mismatch');
  const verification = assertExperimentRun(output);
  if (verification.plan.runId !== manifest.runId) throw new Error('Restored run id does not match manifest');
  const restoredSource = {
    planSha256: verification.seal.planSha256,
    eventsSha256: verification.seal.eventsSha256,
    inventorySha256: verification.seal.inventorySha256,
    sealSha256: sha256(fs.readFileSync(sealPath)),
  };
  for (const [field, restored] of Object.entries(restoredSource)) {
    if (manifest.source?.[field] !== restored) {
      throw new Error(`Restored ${field} does not match evidence manifest`);
    }
  }
  return { output, verification };
}

function main() {
  const { values } = parseArgs({
    options: {
      archive: { type: 'string' },
      manifest: { type: 'string' },
      out: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help || !values.archive || !values.manifest || !values.out) {
    console.log(
      'Usage: node scripts/restore-adaptive-run.js --archive FILE.jsonl.gz --manifest FILE.manifest.json --out FRESH_DIR',
    );
    if (!values.help) process.exitCode = 1;
    return;
  }
  const result = restoreAdaptiveRun({ archivePath: values.archive, manifestPath: values.manifest, outDir: values.out });
  console.log(`restored and verified ${result.output}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  }
}
