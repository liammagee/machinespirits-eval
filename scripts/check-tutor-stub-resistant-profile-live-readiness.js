#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  hashPaidStudyEndpointValue,
  validatePaidStudyEndpointGoCertificate,
} from '../services/paidStudyEndpointPreflight.js';
import { runTutorStubResistantProfileDiscriminationEndpointPreflight } from '../services/tutorStubResistantProfileDiscriminationPreflight.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_HOLD = path.join(
  ROOT,
  'config',
  'tutor-stub-resistant-profile-discrimination-live-readiness.hold.v1.json',
);
const DEFAULT_ROUTE_RESULT = path.join(ROOT, 'config', 'tutor-stub-resistant-profile-route-canary-result.v1.json');

function parseArgs(argv) {
  const args = { hold: DEFAULT_HOLD, routeResult: DEFAULT_ROUTE_RESULT, json: false, out: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--hold') args.hold = path.resolve(argv[++index] || '');
    else if (token === '--route-result') args.routeResult = path.resolve(argv[++index] || '');
    else if (token === '--json') args.json = true;
    else if (token === '--out') args.out = path.resolve(argv[++index] || '');
    else if (token === '--help' || token === '-h') {
      console.log(`Usage:
  node scripts/check-tutor-stub-resistant-profile-live-readiness.js [options]

Options:
  --hold <json>  committed HOLD packet (default: config v1)
  --route-result <json>  committed one-call route result (default: config v1)
  --json         emit machine-readable report
  --out <file>   write the report instead of stdout

This is a zero-call validation command. It cannot authorize or launch the study.`);
      process.exit(0);
    } else throw new Error(`Unknown option: ${token}`);
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function assertion(checks, name, condition, detail) {
  if (!condition) throw new Error(`${name}: ${detail}`);
  checks.push({ name, pass: true, detail });
}

function removeFlag(command, flag, { takesValue = false } = {}) {
  const copy = [];
  for (let index = 0; index < command.length; index += 1) {
    if (command[index] !== flag) copy.push(command[index]);
    else if (takesValue) index += 1;
  }
  return copy;
}

function replaceFlagValue(command, flag, value) {
  const copy = [...command];
  const index = copy.indexOf(flag);
  if (index < 0) throw new Error(`command is missing ${flag}`);
  copy[index + 1] = value;
  return copy;
}

function expectedLiveCommands(preflight, liveArtifactRoot) {
  let live = [...preflight.commands.dryRun];
  live = removeFlag(live, '--dry-run');
  live = removeFlag(live, '--no-ledger');
  live = replaceFlagValue(live, '--trace-dir', liveArtifactRoot);
  const analyze = preflight.commands.analyze.map((token) =>
    token.replaceAll('{separately-authorized-live-artifact-root}', liveArtifactRoot),
  );
  return { live, analyze };
}

function shellQuote(value) {
  const raw = String(value);
  return /^[A-Za-z0-9_./:=,<>-]+$/u.test(raw) ? raw : `'${raw.replaceAll("'", "'\\''")}'`;
}

function formatMarkdown(report) {
  const lines = [
    '# Resistant Profile Live Readiness',
    '',
    `Status: **${report.status}**`,
    `Packet valid: **${report.packetValid ? 'yes' : 'no'}**`,
    `Live run authorized: **${report.liveRunAuthorized ? 'yes' : 'no'}**`,
    `Model calls made by this check: **${report.modelCalls}**`,
    `Recorded route-canary calls: **${report.recordedRouteCanaryModelCalls}**`,
    '',
    '## Checks',
    '',
    ...report.checks.map((check) => `- PASS — ${check.name}: ${check.detail}`),
    '',
    '## Remaining blockers',
    '',
    ...report.blockers.map((blocker) => `- ${blocker}`),
    '',
    '## Proposed command after a separate GO',
    '',
    '```bash',
    report.proposedCommands.live.map(shellQuote).join(' '),
    '```',
    '',
    'The command above was validated but not executed. This packet remains HOLD.',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const hold = readJson(args.hold);
  const checks = [];
  assertion(
    checks,
    'hold-schema',
    hold.schema === 'machinespirits.tutor-stub.resistant-profile-live-readiness-hold.v1',
    hold.schema,
  );
  assertion(checks, 'hold-status', hold.status === 'HOLD', 'status is HOLD and cannot authorize a live run');

  const registrationPath = path.join(ROOT, hold.registration.path);
  const preparation = JSON.parse(
    execFileSync(process.execPath, ['scripts/prepare-tutor-stub-resistant-profile-discrimination.js', '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
    }),
  );
  assertion(checks, 'registration-preflight', preparation.pass === true, 'frozen protocol preflight passes');
  assertion(
    checks,
    'registration-digest',
    sha256File(registrationPath) === hold.registration.sha256 &&
      preparation.registrationSha256 === hold.registration.sha256,
    `registration remains ${hold.registration.sha256}`,
  );
  assertion(
    checks,
    'registration-authorization',
    preparation.authorization.modelCallsAuthorized === false && preparation.authorization.liveRunAuthorized === false,
    'the frozen registration still authorizes neither calls nor launch',
  );

  const endpointContract = readJson(path.join(ROOT, hold.endpoint.contractPath));
  const endpointCertificate = readJson(path.join(ROOT, hold.endpoint.certificatePath));
  const endpointPreflight = runTutorStubResistantProfileDiscriminationEndpointPreflight(endpointContract);
  const endpointGo = validatePaidStudyEndpointGoCertificate({
    certificate: endpointCertificate,
    contract: endpointContract,
    preflight: endpointPreflight,
  });
  assertion(
    checks,
    'endpoint-runtime',
    endpointGo.ok,
    endpointGo.errors.join('; ') || 'all registered endpoints complete',
  );
  assertion(
    checks,
    'endpoint-contract-digest',
    hashPaidStudyEndpointValue(endpointContract) === hold.endpoint.contractSha256 &&
      endpointGo.contract_sha256 === hold.endpoint.contractSha256,
    `endpoint contract remains ${hold.endpoint.contractSha256}`,
  );
  assertion(
    checks,
    'endpoint-preflight-digest',
    endpointPreflight.preflight_sha256 === hold.endpoint.preflightSha256 &&
      endpointGo.preflight_sha256 === hold.endpoint.preflightSha256,
    `full-scale endpoint preflight remains ${hold.endpoint.preflightSha256}`,
  );
  assertion(
    checks,
    'endpoint-zero-call',
    endpointPreflight.model_calls === 0 && endpointPreflight.production_writes === 0,
    '18 synthetic dialogues traverse the production analyzer with zero calls and zero production writes',
  );

  const expectedCommands = expectedLiveCommands(preparation, hold.destination.artifactRoot);
  assertion(
    checks,
    'proposed-live-command',
    JSON.stringify(expectedCommands.live) === JSON.stringify(hold.proposedCommands.live) &&
      !expectedCommands.live.includes('--dry-run') &&
      !expectedCommands.live.includes('--no-ledger'),
    'the proposed command matches the frozen design, enables the run ledger, and is not executed here',
  );
  assertion(
    checks,
    'proposed-analysis-command',
    JSON.stringify(expectedCommands.analyze) === JSON.stringify(hold.proposedCommands.analyze),
    'the post-run analyzer binds the same fresh artifact root and frozen gates',
  );
  assertion(
    checks,
    'fresh-destination',
    hold.destination.mustNotExistBeforeLaunch === true &&
      !fs.existsSync(path.resolve(ROOT, hold.destination.artifactRoot)),
    `${hold.destination.artifactRoot} does not exist`,
  );
  assertion(
    checks,
    'automated-payload-only',
    hold.payload.humanSubjectData === false && hold.payload.trainingReuseStatus === 'not_applicable',
    'payload is repository-authored automated-study material; training reuse is not applicable',
  );
  assertion(
    checks,
    'immutable-pre-canary-hold',
    hold.routeVerification.status === 'pending_explicit_approval' &&
      hold.routeVerification.artifact === null &&
      hold.routeVerification.canaryAuthorization === null &&
      hold.routeVerification.maximumModelCalls === 1 &&
      hold.routeVerification.retryOrResumeAuthority === 'none',
    'the original pre-canary HOLD remains byte-stable and grants no inherited authorization or retry',
  );
  const routeCanaryPlan = JSON.parse(
    execFileSync(
      process.execPath,
      [
        'scripts/run-tutor-stub-resistant-profile-route-canary.js',
        '--request',
        hold.routeVerification.canaryRequest,
        '--json',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    ),
  );
  assertion(
    checks,
    'route-canary-zero-call-plan',
    routeCanaryPlan.status === 'HOLD' &&
      routeCanaryPlan.mode === 'dry-run' &&
      routeCanaryPlan.modelCalls === 0 &&
      routeCanaryPlan.artifactWrites === 0 &&
      routeCanaryPlan.maximumModelCalls === 1 &&
      routeCanaryPlan.liveStudyAuthorized === false,
    'the sealed canary defaults to zero calls and zero writes and cannot authorize the live study',
  );
  const routeCanaryResult = readJson(args.routeResult);
  const routeAuthorizationConsumptionPath = path.join(ROOT, routeCanaryResult.authorizationConsumption?.path || '');
  const routeAuthorizationConsumption = readJson(routeAuthorizationConsumptionPath);
  const routeAuthorization = routeAuthorizationConsumption.approvedAuthorization?.content;
  assertion(
    checks,
    'route-canary-request-binding',
    routeCanaryResult.request?.path === hold.routeVerification.canaryRequest &&
      sha256File(path.join(ROOT, routeCanaryResult.request.path)) === routeCanaryResult.request.sha256,
    `route result binds request ${routeCanaryResult.request?.sha256}`,
  );
  assertion(
    checks,
    'route-canary-authorization-binding',
    routeAuthorizationConsumption.schema ===
      'machinespirits.tutor-stub.resistant-profile-route-canary-authorization-consumption.v1' &&
      routeAuthorizationConsumption.status === 'CONSUMED_AFTER_ONE_CALL' &&
      routeAuthorizationConsumption.approvedAuthorization?.path === routeCanaryResult.authorization?.path &&
      routeAuthorizationConsumption.approvedAuthorization?.sha256 === routeCanaryResult.authorization?.sha256 &&
      routeAuthorizationConsumption.execution?.head === routeCanaryResult.executionHead &&
      routeAuthorizationConsumption.execution?.modelCallsConsumed === 1 &&
      routeAuthorizationConsumption.execution?.sourceArtifactSha256 === routeCanaryResult.sourceArtifactSha256 &&
      routeAuthorizationConsumption.retryOrResumeAuthority === 'none' &&
      routeAuthorizationConsumption.liveStudyAuthorized === false &&
      routeAuthorization?.schema === 'machinespirits.tutor-stub.resistant-profile-route-canary-authorization.v1' &&
      routeAuthorization.status === 'APPROVED_FOR_ONE_ROUTE_CANARY_CALL' &&
      routeAuthorization.request?.sha256 === routeCanaryResult.request.sha256 &&
      routeAuthorization.scope?.maximumModelCalls === 1 &&
      routeAuthorization.scope?.liveStudyAuthorized === false &&
      routeAuthorization.approval?.explicitOneModelCall === true &&
      !fs.existsSync(path.join(ROOT, routeCanaryResult.authorization?.path || '')),
    `authorization ${routeCanaryResult.authorization?.sha256} is preserved only inside a non-executable consumed record`,
  );
  assertion(
    checks,
    'route-canary-result',
    routeCanaryResult.schema === 'machinespirits.tutor-stub.resistant-profile-route-canary-result.v1' &&
      routeCanaryResult.status === 'passed' &&
      routeCanaryResult.studyId === hold.studyId &&
      routeCanaryResult.modelCalls === 1 &&
      routeCanaryResult.retryOrResumeAuthority === 'none' &&
      routeCanaryResult.requested?.modelRef === 'codex.gpt-5.6-luna' &&
      JSON.stringify(routeCanaryResult.requested?.roles) === JSON.stringify(['tutor', 'analysis', 'learner']) &&
      routeCanaryResult.observed?.provider === 'codex' &&
      routeCanaryResult.observed?.model === 'gpt-5.6-luna' &&
      routeCanaryResult.observed?.effort === 'low' &&
      routeCanaryResult.observed?.structuredOutput === true &&
      routeCanaryResult.observed?.prohibitedToolEventCount === 0 &&
      routeCanaryResult.observed?.modelAttestationBasis === 'explicit_cli_model_argument_accepted_bridge_echo' &&
      routeCanaryResult.observed?.modelIndependentlyAttested === false &&
      /^[0-9a-f]{40}$/u.test(routeCanaryResult.executionHead || '') &&
      /^[0-9a-f]{64}$/u.test(routeCanaryResult.sourceArtifactSha256 || ''),
    'one call passed on the requested Luna CLI route with no prohibited tool event and no independent-attestation claim',
  );
  assertion(
    checks,
    'source-launch-pin-pending',
    /^[0-9a-f]{40}$/u.test(hold.source.preparedFromCommit) && hold.source.launchCommit === null,
    'the preparation base is recorded and the post-merge launch SHA remains unset',
  );
  assertion(
    checks,
    'authorization-held',
    hold.authorization.goNote === null &&
      hold.authorization.explicitHumanApproval === false &&
      hold.authorization.modelCallsAuthorized === false &&
      hold.authorization.liveRunAuthorized === false,
    'no study GO note, study approval, study model call, or live run is authorized',
  );

  const remainingBlockers = [
    'select the exact clean origin/main launch commit',
    'write and commit a study-specific GO note binding the registration, endpoint preflight, committed route result, launch commit, destination, payload scope, and 864-attempt ceiling',
    'obtain explicit human approval for that exact GO note and model-call spend',
  ];

  const report = {
    schema: 'machinespirits.tutor-stub.resistant-profile-live-readiness-report.v1',
    status: 'HOLD',
    packetValid: true,
    readyForAuthorizationRequest: false,
    routeVerificationPassed: true,
    readyForStudyGoPreparation: true,
    liveRunAuthorized: false,
    modelCalls: 0,
    recordedRouteCanaryModelCalls: routeCanaryResult.modelCalls,
    productionWrites: 0,
    holdPacket: path.relative(ROOT, args.hold),
    currentHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    worktreeDirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim()),
    checks,
    blockers: remainingBlockers,
    endpointPreflight,
    routeCanaryPlan,
    routeCanaryResult: {
      path: path.relative(ROOT, args.routeResult),
      sha256: sha256File(args.routeResult),
      ...routeCanaryResult,
      authorizationConsumptionSha256: sha256File(routeAuthorizationConsumptionPath),
    },
    proposedCommands: hold.proposedCommands,
  };
  const output = args.json ? `${JSON.stringify(report, null, 2)}\n` : formatMarkdown(report);
  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, output);
  } else process.stdout.write(output);
}

try {
  main();
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exit(1);
}
