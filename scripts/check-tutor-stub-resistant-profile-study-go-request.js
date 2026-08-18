#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_REQUEST = path.join(
  ROOT,
  'config',
  'tutor-stub-resistant-profile-discrimination-study-go-request.v1.json',
);

function parseArgs(argv) {
  const args = { request: DEFAULT_REQUEST, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--request') args.request = path.resolve(argv[++index] || '');
    else if (token === '--json') args.json = true;
    else if (token === '--help' || token === '-h') {
      console.log(`Usage:
  node scripts/check-tutor-stub-resistant-profile-study-go-request.js [options]

Options:
  --request <json>  non-executable study GO request
  --json            emit machine-readable report

This is a zero-call, zero-write request validator. It cannot authorize or
launch the study.`);
      process.exit(0);
    } else throw new Error(`Unknown option: ${token}`);
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function sha256Json(value) {
  return sha256(JSON.stringify(value));
}

function assertion(checks, name, condition, detail) {
  if (!condition) throw new Error(`${name}: ${detail}`);
  checks.push({ name, pass: true, detail });
}

function rootPath(relativePath) {
  return path.join(ROOT, relativePath);
}

function validateFileBinding(checks, name, binding) {
  const observed = sha256File(rootPath(binding.path));
  assertion(checks, name, observed === binding.sha256, `${binding.path} remains ${binding.sha256}`);
}

function sourceCommitAudit(source) {
  const result = spawnSync('git', ['show', '-s', '--format=%T', source.launchCommit], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return {
      available: false,
      reason: 'launch commit object is unavailable in this checkout (expected in shallow CI checkouts)',
    };
  }
  const observedTree = result.stdout.trim();
  if (observedTree !== source.launchTree) {
    throw new Error(`source-launch-tree: expected ${source.launchTree}, observed ${observedTree}`);
  }
  return { available: true, observedTree };
}

function formatMarkdown(report) {
  return `${[
    '# Resistant Profile Study GO Request',
    '',
    `Status: **${report.status}**`,
    `Request SHA-256: \`${report.requestSha256}\``,
    `Launch commit: \`${report.launchCommit}\``,
    `Ready for explicit human approval: **${report.readyForExplicitHumanApproval ? 'yes' : 'no'}**`,
    `Live run authorized: **${report.liveRunAuthorized ? 'yes' : 'no'}**`,
    `Model calls made by this check: **${report.modelCalls}**`,
    `Production writes made by this check: **${report.productionWrites}**`,
    '',
    'Exact approval statement:',
    '',
    `> ${report.exactApprovalStatement}`,
    '',
    'This validator does not execute the live command.',
    '',
  ].join('\n')}\n`;
}

export function validateTutorStubResistantProfileStudyGoRequest({ requestPath = DEFAULT_REQUEST } = {}) {
  const request = readJson(requestPath);
  const checks = [];

  assertion(
    checks,
    'request-schema',
    request.schema === 'machinespirits.tutor-stub.resistant-profile-discrimination-study-go-request.v1',
    request.schema,
  );
  assertion(
    checks,
    'request-hold-status',
    request.status === 'HOLD_PENDING_EXPLICIT_HUMAN_APPROVAL',
    'the request cannot authorize execution',
  );
  assertion(
    checks,
    'authorization-absent',
    request.authorization.explicitHumanApproval === null &&
      request.authorization.modelCallsAuthorized === false &&
      request.authorization.liveRunAuthorized === false,
    'no human approval, model call, or live run is encoded',
  );
  assertion(
    checks,
    'source-pin-shape',
    /^[0-9a-f]{40}$/u.test(request.source.launchCommit) && /^[0-9a-f]{40}$/u.test(request.source.launchTree),
    `launch source is ${request.source.launchCommit} / ${request.source.launchTree}`,
  );

  const sourceAudit = sourceCommitAudit(request.source);
  for (const entry of request.source.closure) {
    validateFileBinding(checks, `source-closure-${entry.path}`, entry);
  }
  checks.push({
    name: 'source-commit-object',
    pass: true,
    detail: sourceAudit.available ? `launch tree verified as ${sourceAudit.observedTree}` : sourceAudit.reason,
  });

  validateFileBinding(checks, 'registration-binding', request.bindings.registration);
  validateFileBinding(checks, 'readiness-hold-binding', request.bindings.liveReadinessHold);

  const hold = readJson(rootPath(request.bindings.liveReadinessHold.path));
  const readiness = JSON.parse(
    execFileSync(process.execPath, ['scripts/check-tutor-stub-resistant-profile-live-readiness.js', '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
    }),
  );
  assertion(
    checks,
    'live-readiness',
    readiness.packetValid === true &&
      readiness.routeVerificationPassed === true &&
      readiness.readyForStudyGoPreparation === true &&
      readiness.modelCalls === 0 &&
      readiness.productionWrites === 0,
    'the full readiness packet and consumed route canary remain valid with zero new calls and writes',
  );

  const endpoint = request.bindings.endpoint;
  assertion(
    checks,
    'endpoint-contract-file-binding',
    sha256File(rootPath(endpoint.contractPath)) === endpoint.contractFileSha256 &&
      endpoint.contractCanonicalSha256 === hold.endpoint.contractSha256,
    'the endpoint contract file and canonical runtime binding remain pinned',
  );
  assertion(
    checks,
    'endpoint-certificate-file-binding',
    sha256File(rootPath(endpoint.certificatePath)) === endpoint.certificateFileSha256 &&
      endpoint.preflightSha256 === hold.endpoint.preflightSha256,
    'the endpoint certificate and full-scale preflight remain pinned',
  );

  const route = request.bindings.routeCanary;
  const routeResult = readJson(rootPath(route.resultPath));
  assertion(
    checks,
    'route-result-binding',
    sha256File(rootPath(route.resultPath)) === route.resultSha256 &&
      sha256File(rootPath(route.authorizationConsumptionPath)) === route.authorizationConsumptionSha256 &&
      routeResult.status === 'passed' &&
      routeResult.modelCalls === 1 &&
      routeResult.sourceArtifactSha256 === route.sourceArtifactSha256 &&
      routeResult.executionHead === route.executionHead &&
      routeResult.observed.provider === route.observedProvider &&
      routeResult.observed.model === route.observedModel &&
      routeResult.observed.effort === route.observedEffort &&
      routeResult.observed.modelAttestationBasis === route.attestationBasis &&
      routeResult.observed.modelIndependentlyAttested === route.modelIndependentlyAttested,
    'the one consumed Luna route call remains exactly bound and is not independently attested',
  );

  assertion(
    checks,
    'live-command-binding',
    sha256Json(hold.proposedCommands.live) === request.bindings.commands.liveArraySha256,
    `live command array remains ${request.bindings.commands.liveArraySha256}`,
  );
  assertion(
    checks,
    'analysis-command-binding',
    sha256Json(hold.proposedCommands.analyze) === request.bindings.commands.analyzeArraySha256,
    `analysis command array remains ${request.bindings.commands.analyzeArraySha256}`,
  );
  assertion(
    checks,
    'design-binding',
    request.design.dialogues === hold.budget.dialogues &&
      request.design.parallelism === hold.budget.parallelism &&
      request.budget.maximumAttemptsPerDialogue === hold.budget.maximumAttemptsPerDialogue &&
      request.budget.maximumPlannedModelAttempts === hold.budget.maximumPlannedModelAttempts &&
      request.budget.retryOrResumeAuthority === 'none',
    '18 dialogues, parallelism 3, and the 864-attempt no-retry ceiling remain frozen',
  );
  assertion(
    checks,
    'payload-boundary',
    request.payload.humanSubjectData === false &&
      request.payload.privateArchiveData === false &&
      request.payload.trainingReuseStatus === 'not_applicable',
    'only repository-authored automated-study material is in scope',
  );
  assertion(
    checks,
    'fresh-destination',
    request.destination.createOnce === true &&
      request.destination.mustNotExistBeforeLaunch === true &&
      !fs.existsSync(rootPath(request.destination.artifactRoot)),
    `${request.destination.artifactRoot} does not exist`,
  );

  const requestSha256 = sha256File(requestPath);
  const exactApprovalStatement =
    `I approve ${path.relative(ROOT, requestPath)} at SHA-256 ${requestSha256} for one 18-dialogue Luna study, ` +
    'with a hard ceiling of 864 model attempts and no retry or resume authority.';

  return {
    schema: 'machinespirits.tutor-stub.resistant-profile-discrimination-study-go-request-report.v1',
    status: request.status,
    requestPath: path.relative(ROOT, requestPath),
    requestSha256,
    launchCommit: request.source.launchCommit,
    launchTree: request.source.launchTree,
    sourceCommitObjectAvailable: sourceAudit.available,
    packetValid: true,
    readyForExplicitHumanApproval: true,
    explicitHumanApproval: false,
    modelCallsAuthorized: false,
    liveRunAuthorized: false,
    modelCalls: 0,
    productionWrites: 0,
    budget: request.budget,
    destination: request.destination,
    exactApprovalStatement,
    checks,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = validateTutorStubResistantProfileStudyGoRequest({ requestPath: args.request });
  process.stdout.write(args.json ? `${JSON.stringify(report, null, 2)}\n` : formatMarkdown(report));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
