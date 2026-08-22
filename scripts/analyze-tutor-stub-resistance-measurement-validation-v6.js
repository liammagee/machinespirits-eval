#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { writeTutorStubResistanceMeasurementCombinedValidationReportV6 } from '../services/tutorStubResistanceMeasurementValidationV6Runtime.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function argsFrom(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`unexpected argument ${token}`);
    args[token.slice(2)] = argv[++index];
  }
  return args;
}

function repoPath(value) {
  const relative = String(value || '').trim();
  if (!relative || path.isAbsolute(relative)) throw new Error('--go-request must be repository-relative');
  const absolute = path.resolve(ROOT, relative);
  if (path.relative(ROOT, absolute).startsWith('..')) throw new Error('--go-request escapes repository');
  return { relative, absolute };
}

function snapshot() {
  return {
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    tree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    dirty: Boolean(
      execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
        cwd: ROOT,
        encoding: 'utf8',
      }).trim(),
    ),
  };
}

function main() {
  const args = argsFrom(process.argv.slice(2));
  const requestPath = repoPath(args['go-request']);
  const goRequestBytes = fs.readFileSync(requestPath.absolute);
  const goRequestSha256 = crypto.createHash('sha256').update(goRequestBytes).digest('hex');
  const goRequest = JSON.parse(goRequestBytes);
  const source = snapshot();
  if (source.dirty || source.commit !== args['source-commit'] || source.tree !== args['source-tree']) {
    throw new Error('combined V6 validation analysis requires the exact clean source');
  }
  const report = writeTutorStubResistanceMeasurementCombinedValidationReportV6({
    primaryDestination: path.resolve(String(args['primary-destination'] || '')),
    fidelityDestination: path.resolve(String(args['fidelity-destination'] || '')),
    combinedDestination: path.resolve(String(args.destination || '')),
    expectedSourceCommit: source.commit,
    expectedSourceTree: source.tree,
    expectedGoRequestPath: requestPath.relative,
    expectedGoRequestSha256: goRequestSha256,
    expectedGoRequest: goRequest,
    sourceDirty: false,
    archiveDir: args['archive-dir'],
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
