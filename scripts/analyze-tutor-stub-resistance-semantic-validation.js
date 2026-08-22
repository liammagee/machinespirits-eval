#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { resolveTutorStubArtifactArchiveDirectory } from '../services/tutorStubArtifactArchive.js';
import { writeTutorStubResistanceSemanticValidationReport } from '../services/tutorStubResistanceSemanticValidationRuntime.js';
import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_REGISTRATION_V2,
  loadTutorStubResistanceSemanticValidationV2,
} from '../services/tutorStubResistanceSemanticValidationV2.js';
import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_REGISTRATION_V3,
  loadTutorStubResistanceSemanticValidationV3,
} from '../services/tutorStubResistanceSemanticValidationV3.js';

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
  const goRequest = JSON.parse(fs.readFileSync(request.absolute, 'utf8'));
  const validationRegistration = String(args['validation-registration'] || '').trim();
  if (
    validationRegistration &&
    ![
      TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_REGISTRATION_V2,
      TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_REGISTRATION_V3,
    ].includes(validationRegistration)
  ) {
    throw new Error('--validation-registration is not a supported additive semantic validation registration');
  }
  const loaded =
    validationRegistration === TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_REGISTRATION_V3
      ? loadTutorStubResistanceSemanticValidationV3()
      : validationRegistration
        ? loadTutorStubResistanceSemanticValidationV2()
        : undefined;
  const snapshot = sourceSnapshot();
  if (snapshot.commit !== args['source-commit'] || snapshot.tree !== args['source-tree']) {
    throw new Error('semantic validation analysis source commit/tree does not match the command pin');
  }
  const executionSourceCommit = args['execution-source-commit'] || snapshot.commit;
  const executionSourceTree = args['execution-source-tree'] || snapshot.tree;
  if (Boolean(args['execution-source-commit']) !== Boolean(args['execution-source-tree'])) {
    throw new Error('--execution-source-commit and --execution-source-tree must be supplied together');
  }
  const archiveDir = resolveTutorStubArtifactArchiveDirectory(args['archive-dir'], { cwd: ROOT, repoRoot: ROOT });
  if (!archiveDir) throw new Error('semantic validation analysis requires the stable private artifact archive');
  const report = writeTutorStubResistanceSemanticValidationReport({
    destination,
    expectedSourceCommit: executionSourceCommit,
    expectedSourceTree: executionSourceTree,
    expectedGoRequestPath: request.relative,
    expectedGoRequestSha256: sha256(request.absolute),
    expectedGoRequest: goRequest,
    sourceDirty: snapshot.dirty,
    archiveDir,
    ...(loaded ? { loaded } : {}),
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
