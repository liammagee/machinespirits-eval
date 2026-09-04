#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  executeTutorStubResistantProfileRouteCanary,
  resistantProfileRouteCanaryFileSha256,
  validateTutorStubResistantProfileRouteCanaryAuthorization,
  validateTutorStubResistantProfileRouteCanaryRequest,
} from '../services/tutorStubResistantProfileRouteCanary.js';
import { recordSourceStatus } from '../services/recordedSourceProvenance.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_REQUEST = 'config/tutor-stub-resistant-profile-route-canary-request.v1.json';

function refuse(message) {
  throw new Error(`route canary refuses: ${message}`);
}

function parseArgs(argv) {
  const args = {
    request: DEFAULT_REQUEST,
    authorization: '',
    execute: false,
    acceptOneModelCall: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--request') args.request = argv[++index] || '';
    else if (token === '--authorization') args.authorization = argv[++index] || '';
    else if (token === '--execute') args.execute = true;
    else if (token === '--accept-one-model-call') args.acceptOneModelCall = true;
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

// CLAUDE.md (2026-08-21): provenance is recorded, not enforced. Write down the
// commit, the tree and whether the checkout was dirty; never refuse to run over
// it. A refusal here turned a one-line fix into a re-approval ceremony.
function recordProvenance(root) {
  const rev = (spec) => execFileSync('git', ['rev-parse', spec], { cwd: root, encoding: 'utf8' }).trim();
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
  const { dirty, dirtyPaths } = recordSourceStatus({ label: 'resistant profile route canary', statusOutput: status });
  return { head: rev('HEAD'), tree: rev('HEAD^{tree}'), dirty, dirtyPaths };
}

function printPlan(plan, json) {
  if (json) {
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return;
  }
  process.stdout.write(
    [
      'Resistant-profile route canary plan',
      `Status: ${plan.status}`,
      `Route: ${plan.route.modelRef} (${plan.route.provider}/${plan.route.model}, effort=${plan.route.effort})`,
      `Roles covered by shared route: ${plan.route.roles.join(', ')}`,
      `Maximum calls: ${plan.maximumModelCalls}`,
      `Artifact root: ${plan.artifactRoot}`,
      'No model call or artifact write was made.',
      'Execution requires a separately committed authorization plus --execute --accept-one-model-call.',
      '',
    ].join('\n'),
  );
}

export async function runTutorStubResistantProfileRouteCanaryCommand(
  args,
  { root = ROOT, callModel, now = () => new Date().toISOString() } = {},
) {
  const requestPath = repositoryRelative(root, args.request || DEFAULT_REQUEST, 'request');
  const request = readJson(root, requestPath, 'request');
  const validation = validateTutorStubResistantProfileRouteCanaryRequest(request, { root });
  const plan = {
    schema: 'machinespirits.tutor-stub.resistant-profile-route-canary-plan.v1',
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
      roles: validation.roles,
    },
    maximumModelCalls: request.scope.maximumModelCalls,
    artifactRoot: request.artifactRoot,
    liveStudyAuthorized: false,
  };
  if (!args.execute) return plan;

  if (args.acceptOneModelCall !== true) refuse('--accept-one-model-call is required');
  if (!args.authorization) refuse('--authorization is required');
  const provenance = recordProvenance(root);

  const authorizationPath = repositoryRelative(root, args.authorization, 'authorization');
  const authorization = readJson(root, authorizationPath, 'authorization');
  const requestSha256 = resistantProfileRouteCanaryFileSha256(path.resolve(root, requestPath));
  const authorized = validateTutorStubResistantProfileRouteCanaryAuthorization({
    authorization,
    request,
    requestPath,
    requestSha256,
  });
  const digestRecords = [...validation.digestRecords, ...authorized.digestRecords];

  const artifactRoot = path.resolve(root, request.artifactRoot);
  if (fs.existsSync(artifactRoot)) refuse(`artifact root already exists: ${request.artifactRoot}`);
  fs.mkdirSync(path.dirname(artifactRoot), { recursive: true });
  fs.mkdirSync(artifactRoot, { recursive: false });
  const resultPath = path.join(artifactRoot, 'route-canary.json');
  try {
    const result = await executeTutorStubResistantProfileRouteCanary({ request, root, callModel, now });
    const sealed = {
      ...result,
      request: { path: requestPath, sha256: requestSha256 },
      authorization: {
        path: authorizationPath,
        sha256: resistantProfileRouteCanaryFileSha256(path.resolve(root, authorizationPath)),
      },
      executionHead: provenance.head,
      provenance,
      digestRecords,
      artifact: path.relative(root, resultPath),
    };
    fs.writeFileSync(resultPath, `${JSON.stringify(sealed, null, 2)}\n`, { flag: 'wx' });
    return sealed;
  } catch (error) {
    const failure = {
      schema: 'machinespirits.tutor-stub.resistant-profile-route-canary-failure.v1',
      status: 'failed_consumed_no_retry',
      studyId: request.studyId,
      failedAt: now(),
      maximumModelCalls: 1,
      retryOrResumeAuthority: 'none',
      errorCode: error?.code || error?.name || 'ERROR',
      errorMessage: String(error?.message || error),
      provenance,
      digestRecords,
    };
    fs.writeFileSync(path.join(artifactRoot, 'route-canary-failure.json'), `${JSON.stringify(failure, null, 2)}\n`, {
      flag: 'wx',
    });
    throw error;
  }
}

function usage() {
  return `Usage:
  node scripts/run-tutor-stub-resistant-profile-route-canary.js [--dry-run] [--json]
  node scripts/run-tutor-stub-resistant-profile-route-canary.js --execute \\
    --authorization <committed-authorization.json> --accept-one-model-call

The default path is a zero-call, zero-write plan. Execution is impossible
without a separately committed, request-bound, one-call human authorization.`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const report = await runTutorStubResistantProfileRouteCanaryCommand(args);
  if (args.execute || args.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else printPlan(report, false);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((error) => {
    console.error(`error: ${error.message}`);
    process.exitCode = 1;
  });
}
