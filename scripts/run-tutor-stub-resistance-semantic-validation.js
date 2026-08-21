#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { resolveTutorStubArtifactArchiveDirectory } from '../services/tutorStubArtifactArchive.js';
import {
  buildTutorStubResistanceSemanticValidationPlan,
  runTutorStubResistanceSemanticValidation,
} from '../services/tutorStubResistanceSemanticValidationRuntime.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function argsFrom(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`unexpected argument: ${token}`);
    const key = token.slice(2);
    if (['live', 'preflight', 'resume'].includes(key)) args[key] = true;
    else args[key] = argv[++index];
  }
  return args;
}

function repoPath(value, label) {
  const relative = String(value || '').trim();
  if (!relative || path.isAbsolute(relative)) throw new Error(`${label} must be repository-relative`);
  const absolute = path.resolve(ROOT, relative);
  const rebased = path.relative(ROOT, absolute);
  if (rebased.startsWith('..') || path.isAbsolute(rebased)) throw new Error(`${label} escapes the repository`);
  return { relative, absolute };
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function sourceSnapshot() {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const status = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  return { commit, tree, dirty: Boolean(status) };
}

async function main() {
  const args = argsFrom(process.argv.slice(2));
  if (Boolean(args.live) === Boolean(args.preflight)) {
    throw new Error('choose exactly one of --preflight or --live');
  }
  const destination = path.resolve(String(args.destination || ''));
  if (!path.isAbsolute(destination) || destination === path.parse(destination).root) {
    throw new Error('--destination must be a bounded absolute path');
  }
  if (Number(args['maximum-reservations']) !== 480) {
    throw new Error('--maximum-reservations must equal the registered hard ceiling 480');
  }
  const request = repoPath(args['go-request'], '--go-request');
  const requestSha256 = sha256(request.absolute);
  const snapshot = sourceSnapshot();
  if (snapshot.dirty) throw new Error('semantic validation requires a clean source checkout');
  if (snapshot.commit !== args['source-commit'] || snapshot.tree !== args['source-tree']) {
    throw new Error('semantic validation source commit/tree does not match the command pin');
  }
  const archiveDir = resolveTutorStubArtifactArchiveDirectory(args['archive-dir'], { cwd: ROOT, repoRoot: ROOT });
  if (!archiveDir) throw new Error('semantic validation requires the stable private artifact archive');
  const plan = buildTutorStubResistanceSemanticValidationPlan({
    sourceCommit: snapshot.commit,
    sourceTree: snapshot.tree,
    destination,
    goRequestPath: request.relative,
    goRequestSha256: requestSha256,
  });
  if (args.preflight) {
    if (fs.existsSync(destination)) throw new Error('semantic validation destination must be fresh');
    process.stdout.write(
      `${JSON.stringify({ status: 'preflight_pass', model_calls: 0, production_writes: 0, plan }, null, 2)}\n`,
    );
    return;
  }
  const [{ callAIWithCliBridge }, { resolveModel }] = await Promise.all([
    import('../services/cliProviderBridge.js'),
    import('../services/evalConfigLoader.js'),
  ]);
  const result = await runTutorStubResistanceSemanticValidation({
    destination,
    sourceCommit: snapshot.commit,
    sourceTree: snapshot.tree,
    goRequestPath: request.relative,
    goRequestSha256: requestSha256,
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
