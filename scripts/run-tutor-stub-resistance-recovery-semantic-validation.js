#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { resolveTutorStubArtifactArchiveDirectory } from '../services/tutorStubArtifactArchive.js';
import {
  buildTutorStubResistanceRecoverySemanticValidationPlan,
  runTutorStubResistanceRecoverySemanticValidation,
} from '../services/tutorStubResistanceRecoverySemanticValidationRuntime.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function argsFrom(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`unexpected argument ${token}`);
    const key = token.slice(2);
    args[key] = ['live', 'preflight', 'resume'].includes(key) ? true : argv[++index];
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

async function main() {
  const args = argsFrom(process.argv.slice(2));
  if (Boolean(args.live) === Boolean(args.preflight)) throw new Error('choose exactly one of --live or --preflight');
  if (Number(args['maximum-reservations']) !== 720) throw new Error('registered hard ceiling is 720');
  const destination = path.resolve(String(args.destination || ''));
  const request = repoPath(args['go-request']);
  const source = snapshot();
  if (source.dirty || source.commit !== args['source-commit'] || source.tree !== args['source-tree']) {
    throw new Error('outcome validation requires the exact clean source');
  }
  const goRequestSha256 = crypto.createHash('sha256').update(fs.readFileSync(request.absolute)).digest('hex');
  const archiveDir = resolveTutorStubArtifactArchiveDirectory(args['archive-dir'], { cwd: ROOT, repoRoot: ROOT });
  const plan = buildTutorStubResistanceRecoverySemanticValidationPlan({
    sourceCommit: source.commit,
    sourceTree: source.tree,
    destination,
    goRequestPath: request.relative,
    goRequestSha256,
  });
  if (args.preflight) {
    if (fs.existsSync(destination)) throw new Error('outcome validation destination must be fresh');
    process.stdout.write(
      `${JSON.stringify({ status: 'preflight_pass', model_calls: 0, production_writes: 0, plan }, null, 2)}\n`,
    );
    return;
  }
  const [{ callAIWithCliBridge }, { resolveModel }] = await Promise.all([
    import('../services/cliProviderBridge.js'),
    import('../services/evalConfigLoader.js'),
  ]);
  const result = await runTutorStubResistanceRecoverySemanticValidation({
    destination,
    sourceCommit: source.commit,
    sourceTree: source.tree,
    goRequestPath: request.relative,
    goRequestSha256,
    sourceDirty: false,
    archiveDir,
    resume: args.resume === true,
    callModel: callAIWithCliBridge,
    resolveModelRef: resolveModel,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
