#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { callAIWithCliBridge } from '../services/cliProviderBridge.js';
import {
  boredomSemanticValidationFileSha256,
  executeTutorStubBoredomSemanticValidation,
  validateTutorStubBoredomSemanticValidationAuthorization,
  validateTutorStubBoredomSemanticValidationRequest,
} from '../services/tutorStubBoredomSemanticValidation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_REQUEST = 'config/tutor-stub-boredom-semantic-validation-request.v4.json';

function refuse(message) {
  throw new Error(`boredom semantic validation refuses: ${message}`);
}

function parseArgs(argv) {
  const args = {
    request: DEFAULT_REQUEST,
    authorization: '',
    execute: false,
    acceptBoundedValidationCalls: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--request') args.request = argv[++index] || '';
    else if (token === '--authorization') args.authorization = argv[++index] || '';
    else if (token === '--execute') args.execute = true;
    else if (token === '--accept-bounded-validation-calls') args.acceptBoundedValidationCalls = true;
    else if (token === '--json') args.json = true;
    else if (token === '--dry-run') args.execute = false;
    else if (token === '--help' || token === '-h') args.help = true;
    else refuse(`unknown option: ${token}`);
  }
  return args;
}

function repositoryRelative(root, candidate, label) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, candidate);
  if (!resolved.startsWith(`${resolvedRoot}${path.sep}`)) refuse(`${label} must be repository-contained`);
  return path.relative(resolvedRoot, resolved);
}

function readJson(root, relativePath, label) {
  const resolved = path.resolve(root, relativePath);
  if (!fs.existsSync(resolved)) refuse(`${label} not found: ${relativePath}`);
  try {
    return JSON.parse(fs.readFileSync(resolved, 'utf8'));
  } catch (error) {
    refuse(`${label} is not valid JSON: ${error.message}`);
  }
}

function committedBytes(root, relativePath, label) {
  let committed;
  try {
    committed = execFileSync('git', ['show', `HEAD:${relativePath}`], { cwd: root });
  } catch {
    refuse(`${label} is not committed at HEAD: ${relativePath}`);
  }
  const onDisk = fs.readFileSync(path.resolve(root, relativePath));
  if (!committed.equals(onDisk)) refuse(`${label} differs from committed HEAD bytes: ${relativePath}`);
}

function assertCleanWorktree(root) {
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim();
  if (status) refuse('the worktree is dirty');
}

function printPlan(plan) {
  process.stdout.write(
    [
      'Boredom semantic-instrument validation plan',
      `Status: ${plan.status}`,
      `Route: ${plan.route.modelRef} (${plan.route.provider}/${plan.route.model}, effort=${plan.route.effort})`,
      `Corpus: ${plan.corpus.path} (${plan.corpus.cases} frozen held-out cases)`,
      `Planned calls: ${plan.plannedModelCalls} (hard ceiling ${plan.maximumModelCalls})`,
      `Artifact root: ${plan.artifactRoot}`,
      'No model call or artifact write was made.',
      'Execution requires a separately committed authorization plus --execute --accept-bounded-validation-calls.',
      '',
    ].join('\n'),
  );
}

export async function runTutorStubBoredomSemanticValidationCommand(
  args,
  { root = ROOT, callModel, now = () => new Date().toISOString() } = {},
) {
  const requestPath = repositoryRelative(root, args.request || DEFAULT_REQUEST, 'request');
  const request = readJson(root, requestPath, 'request');
  const validation = validateTutorStubBoredomSemanticValidationRequest(request, { root });
  const plan = {
    schema: 'machinespirits.tutor-stub.boredom-semantic-validation-plan.v1',
    status: 'HOLD',
    mode: args.execute ? 'execution-requested' : 'dry-run',
    modelCalls: 0,
    artifactWrites: 0,
    requestPath,
    route: {
      modelRef: validation.modelRef,
      provider: validation.provider,
      model: validation.model,
      effort: request.route.effort,
    },
    corpus: { path: request.corpus.path, sha256: validation.corpusSha256, cases: validation.corpus.cases.length },
    plannedModelCalls: request.scope.plannedModelCalls,
    maximumModelCalls: request.scope.maximumModelCalls,
    artifactRoot: request.artifactRoot,
    liveStudyAuthorized: false,
    confirmationLaunchAuthorized: false,
  };
  if (!args.execute) return plan;

  if (args.acceptBoundedValidationCalls !== true) refuse('--accept-bounded-validation-calls is required');
  if (!args.authorization) refuse('--authorization is required');
  assertCleanWorktree(root);

  const authorizationPath = repositoryRelative(root, args.authorization, 'authorization');
  const authorization = readJson(root, authorizationPath, 'authorization');
  committedBytes(root, requestPath, 'request');
  committedBytes(root, authorizationPath, 'authorization');
  for (const entry of request.sourceClosure) committedBytes(root, entry.path, 'source-closure file');
  const requestSha256 = boredomSemanticValidationFileSha256(path.resolve(root, requestPath));
  validateTutorStubBoredomSemanticValidationAuthorization({
    authorization,
    request,
    requestPath,
    requestSha256,
  });

  const artifactRoot = path.resolve(root, request.artifactRoot);
  if (fs.existsSync(artifactRoot)) refuse(`artifact root already exists: ${request.artifactRoot}`);
  fs.mkdirSync(path.dirname(artifactRoot), { recursive: true });
  fs.mkdirSync(artifactRoot, { recursive: false });
  fs.mkdirSync(path.join(artifactRoot, 'cases'), { recursive: false });
  const resultPath = path.join(artifactRoot, 'validation-report.json');
  try {
    const result = await executeTutorStubBoredomSemanticValidation({
      request,
      root,
      // The real bridge is injected only here, after every execution gate above
      // has passed; the service itself refuses to run without an explicit caller.
      callModel: callModel ?? callAIWithCliBridge,
      now,
      onCaseSealed: (sealed) => {
        fs.writeFileSync(
          path.join(artifactRoot, 'cases', `${sealed.id}.json`),
          `${JSON.stringify(sealed, null, 2)}\n`,
          { flag: 'wx' },
        );
      },
    });
    const sealed = {
      ...result,
      request: { path: requestPath, sha256: requestSha256 },
      authorization: {
        path: authorizationPath,
        sha256: boredomSemanticValidationFileSha256(path.resolve(root, authorizationPath)),
      },
      executionHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      artifact: path.relative(root, resultPath),
    };
    fs.writeFileSync(resultPath, `${JSON.stringify(sealed, null, 2)}\n`, { flag: 'wx' });
    return sealed;
  } catch (error) {
    const failure = {
      schema: 'machinespirits.tutor-stub.boredom-semantic-validation-failure.v1',
      status: 'failed_sealed_no_retry',
      studyId: request.studyId,
      failedAt: now(),
      retryOrResumeAuthority: request.scope.retryOrResumeAuthority,
      errorCode: error?.code || error?.name || 'ERROR',
      errorMessage: String(error?.message || error),
    };
    fs.writeFileSync(path.join(artifactRoot, 'validation-failure.json'), `${JSON.stringify(failure, null, 2)}\n`, {
      flag: 'wx',
    });
    throw error;
  }
}

function usage() {
  return `Usage:
  node scripts/run-tutor-stub-boredom-semantic-validation.js [--dry-run] [--json]
  node scripts/run-tutor-stub-boredom-semantic-validation.js --execute \\
    --authorization <committed-authorization.json> --accept-bounded-validation-calls

The default path is a zero-call, zero-write plan. Execution is impossible
without a separately committed, request-bound, human authorization. Completed
model outputs are final: only thrown transport errors consume extra
reservations, and nothing is retried, replaced, or selected on content.`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const report = await runTutorStubBoredomSemanticValidationCommand(args);
  if (args.execute || args.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else printPlan(report);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((error) => {
    console.error(`error: ${error.message}`);
    process.exitCode = 1;
  });
}
