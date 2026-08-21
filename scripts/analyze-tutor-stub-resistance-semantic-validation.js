#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { resolveTutorStubArtifactArchiveDirectory } from '../services/tutorStubArtifactArchive.js';
import { writeTutorStubResistanceSemanticValidationReport } from '../services/tutorStubResistanceSemanticValidationRuntime.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function argsFrom(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`unexpected argument: ${token}`);
    args[token.slice(2)] = argv[++index];
  }
  return args;
}

function repoPath(value) {
  const relative = String(value || '').trim();
  if (!relative || path.isAbsolute(relative)) throw new Error('--go-request must be repository-relative');
  const absolute = path.resolve(ROOT, relative);
  const rebased = path.relative(ROOT, absolute);
  if (rebased.startsWith('..') || path.isAbsolute(rebased)) throw new Error('--go-request escapes the repository');
  return { relative, absolute };
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function sourceSnapshot() {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const dirty = Boolean(
    execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim(),
  );
  return { commit, tree, dirty };
}

function main() {
  const args = argsFrom(process.argv.slice(2));
  const destination = path.resolve(String(args.destination || ''));
  if (!path.isAbsolute(destination) || destination === path.parse(destination).root) {
    throw new Error('--destination must be a bounded absolute path');
  }
  const request = repoPath(args['go-request']);
  const snapshot = sourceSnapshot();
  if (snapshot.commit !== args['source-commit'] || snapshot.tree !== args['source-tree']) {
    throw new Error('semantic validation analysis source commit/tree does not match the command pin');
  }
  const archiveDir = resolveTutorStubArtifactArchiveDirectory(args['archive-dir'], { cwd: ROOT, repoRoot: ROOT });
  if (!archiveDir) throw new Error('semantic validation analysis requires the stable private artifact archive');
  const report = writeTutorStubResistanceSemanticValidationReport({
    destination,
    expectedSourceCommit: snapshot.commit,
    expectedSourceTree: snapshot.tree,
    expectedGoRequestPath: request.relative,
    expectedGoRequestSha256: sha256(request.absolute),
    sourceDirty: snapshot.dirty,
    archiveDir,
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
