#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { resolveTutorStubArtifactArchiveDirectory } from '../services/tutorStubArtifactArchive.js';
import { writeTutorStubResistanceRecoverySemanticValidationReport } from '../services/tutorStubResistanceRecoverySemanticValidationRuntime.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function argsFrom(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) args[String(argv[index]).slice(2)] = argv[++index];
  return args;
}
function repoPath(value) {
  const relative = String(value || '').trim();
  const absolute = path.resolve(ROOT, relative);
  if (!relative || path.isAbsolute(relative) || path.relative(ROOT, absolute).startsWith('..')) {
    throw new Error('--go-request must be bounded and repository-relative');
  }
  return { relative, absolute };
}
function main() {
  const args = argsFrom(process.argv.slice(2));
  const request = repoPath(args['go-request']);
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const dirty = Boolean(execFileSync('git', ['status', '--porcelain=v1'], { cwd: ROOT, encoding: 'utf8' }).trim());
  if (commit !== args['source-commit'] || tree !== args['source-tree']) throw new Error('analysis source pin drifted');
  const report = writeTutorStubResistanceRecoverySemanticValidationReport({
    destination: path.resolve(args.destination),
    expectedSourceCommit: commit,
    expectedSourceTree: tree,
    expectedGoRequestPath: request.relative,
    expectedGoRequestSha256: crypto.createHash('sha256').update(fs.readFileSync(request.absolute)).digest('hex'),
    expectedGoRequest: JSON.parse(fs.readFileSync(request.absolute, 'utf8')),
    sourceDirty: dirty,
    archiveDir: resolveTutorStubArtifactArchiveDirectory(args['archive-dir'], { cwd: ROOT, repoRoot: ROOT }),
    validationRegistration: args['validation-registration'],
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
