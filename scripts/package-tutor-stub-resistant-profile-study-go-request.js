#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REQUEST_SCHEMA = 'machinespirits.tutor-stub.resistant-profile-discrimination-study-go-request.v1';
const REPORT_SCHEMA = 'machinespirits.tutor-stub.resistant-profile-study-go-request-package-report.v1';
const HOLD_STATUS = 'HOLD_PENDING_EXPLICIT_HUMAN_APPROVAL';
const MARKER_PREFIX = '__GO_REQUEST_PACKAGE__:';
const SUPPORTED_OPPORTUNITY = 'prospective_frame_refuser_treatment_opportunity';
const SUPPORTED_ACTION_REGISTER_BASELINE = 'prospective_frame_refuser_action_register_baseline_v2';
const SUPPORTED_ACTION_REGISTER_ANALYSIS_ONLY = 'sealed_frame_refuser_action_register_baseline_analysis_only_v1';
const SUPPORTED_ACTION_REGISTER_CONFIRMATION = 'prospective_frame_refuser_warm_plain_confirmation_v1';
const SUPPORTED_BOREDOM_ACTION_REGISTER_PROOF_DAG =
  'prospective_boredom_matched_action_warm_plain_proof_dag_confirmation_v1';
const SUPPORTED_ACTION_REGISTER_CONFIRMATION_SUCCESSOR = 'prospective_frame_refuser_warm_plain_confirmation_v2';
const SUPPORTED_ACTION_REGISTER_CONFIRMATION_OPERATIONAL_CEILING =
  'prospective_frame_refuser_warm_plain_confirmation_v3';
const SUPPORTED_ACTION_REGISTER_CONFIRMATION_OBSERVER_REPAIR = 'prospective_frame_refuser_warm_plain_confirmation_v4';
const SUPPORTED_ACTION_REGISTER_CONFIRMATION_OBSERVER_REPAIR_V7 =
  'prospective_frame_refuser_warm_plain_confirmation_v5';
const SUPPORTED_RESISTANCE_SEMANTIC_VALIDATION = 'prospective_resistance_semantic_adjudication_heldout_validation_v1';
const SUPPORTED_RESISTANCE_SEMANTIC_VALIDATION_V2 =
  'prospective_resistance_semantic_adjudication_heldout_validation_v2';
const SUPPORTED_RESISTANCE_SEMANTIC_VALIDATION_V3 =
  'prospective_resistance_semantic_adjudication_heldout_validation_v3';
const SUPPORTED_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION =
  'prospective_resistance_recovery_semantic_adjudication_heldout_validation_v1';
const SUPPORTED_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_V2 =
  'prospective_resistance_recovery_semantic_adjudication_heldout_validation_v2';

function isSupportedResistanceSemanticValidation(value) {
  return [
    SUPPORTED_RESISTANCE_SEMANTIC_VALIDATION,
    SUPPORTED_RESISTANCE_SEMANTIC_VALIDATION_V2,
    SUPPORTED_RESISTANCE_SEMANTIC_VALIDATION_V3,
    SUPPORTED_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION,
    SUPPORTED_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_V2,
  ].includes(value);
}

function isSupportedActionRegisterConfirmation(value) {
  return [
    SUPPORTED_ACTION_REGISTER_CONFIRMATION,
    SUPPORTED_ACTION_REGISTER_CONFIRMATION_SUCCESSOR,
    SUPPORTED_ACTION_REGISTER_CONFIRMATION_OPERATIONAL_CEILING,
    SUPPORTED_ACTION_REGISTER_CONFIRMATION_OBSERVER_REPAIR,
    SUPPORTED_ACTION_REGISTER_CONFIRMATION_OBSERVER_REPAIR_V7,
  ].includes(value);
}

export const GO_REQUEST_PACKAGE_MARKERS = Object.freeze({
  sourceCommit: `${MARKER_PREFIX}source.commit`,
  sourceTree: `${MARKER_PREFIX}source.tree`,
  endpointCanonicalSha256: `${MARKER_PREFIX}endpoint.contract.canonical-sha256`,
  endpointPreflightSha256: `${MARKER_PREFIX}endpoint.preflight-sha256`,
  routeSourceArtifactSha256: `${MARKER_PREFIX}route.source-artifact-sha256`,
  routeExecutionHead: `${MARKER_PREFIX}route.execution-head`,
  routeProvider: `${MARKER_PREFIX}route.provider`,
  routeModel: `${MARKER_PREFIX}route.model`,
  routeEffort: `${MARKER_PREFIX}route.effort`,
  routeAttestationBasis: `${MARKER_PREFIX}route.attestation-basis`,
  routeModelIndependentlyAttested: `${MARKER_PREFIX}route.model-independently-attested`,
  liveCommandSha256: `${MARKER_PREFIX}commands.live.sha256`,
  recoveryCommandSha256: `${MARKER_PREFIX}commands.recovery.sha256`,
  analyzeCommandSha256: `${MARKER_PREFIX}commands.analyze.sha256`,
});

export function goRequestFileSha256Marker(repoPath) {
  return `${MARKER_PREFIX}file-sha256:${repoPath}`;
}

function usage() {
  return `Usage:
  node scripts/package-tutor-stub-resistant-profile-study-go-request.js \\
    --template <authored-hold.json> --launch-commit <full-oid> \\
    --out <new-request.json> [--json]

Required inputs:
  --template <json>      authored HOLD request with ${MARKER_PREFIX} proof markers
  --launch-commit <oid>  full commit oid supplying source and binding blobs
  --out <json>           new request path inside the repository (create-once)

Options:
  --json                 emit a machine-readable stdout proof summary

The command fills mechanical proof fields only, validates in an isolated tree
with no node_modules, makes zero model calls, and never records human approval.`;
}

function parseArgs(argv) {
  const args = { json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') return { help: true };
    if (token === '--json') {
      args.json = true;
      continue;
    }
    if (!['--template', '--launch-commit', '--out'].includes(token)) throw new Error(`unknown option: ${token}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${token} requires a value`);
    const key = token.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
    if (args[key] !== undefined) throw new Error(`${token} may be supplied only once`);
    args[key] = value;
    index += 1;
  }
  for (const key of ['template', 'launchCommit', 'out']) {
    if (!args[key]) throw new Error(`--${key.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)} is required`);
  }
  return args;
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalJson(value[key])]),
    );
  }
  return value;
}

function sha256CanonicalJson(value) {
  return sha256(JSON.stringify(canonicalJson(value)));
}

function repoRelative(filePath, label) {
  const absolute = path.resolve(filePath);
  const relative = path.relative(ROOT, absolute);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`${label} must be inside the repository`);
  }
  const normalized = relative.split(path.sep).join('/');
  if (normalized === '.' || path.posix.normalize(normalized) !== normalized || normalized.split('/').includes('..')) {
    throw new Error(`${label} must be a canonical repository-relative path without traversal`);
  }
  return normalized;
}

function canonicalRepoPath(value, label) {
  const candidate = String(value || '');
  if (
    !candidate ||
    path.isAbsolute(candidate) ||
    candidate.includes('\\') ||
    candidate === '.' ||
    path.posix.normalize(candidate) !== candidate ||
    candidate.split('/').includes('..')
  ) {
    throw new Error(`${label} must be a canonical repository-relative path without traversal`);
  }
  return candidate;
}

function runGit(args, { binary = false } = {}) {
  const result = spawnSync('git', args, {
    cwd: ROOT,
    encoding: binary ? null : 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || '').trim();
    throw new Error(`git ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
  return result.stdout;
}

function resolveLaunchCommit(value) {
  const oid = String(value || '').trim();
  if (!/^[0-9a-f]{40,64}$/u.test(oid)) throw new Error('--launch-commit must be an explicit full commit oid');
  const resolved = String(runGit(['rev-parse', '--verify', `${oid}^{commit}`])).trim();
  if (resolved !== oid) throw new Error(`--launch-commit resolved to ${resolved}, not ${oid}`);
  return oid;
}

function commitTree(commit) {
  return String(runGit(['rev-parse', '--verify', `${commit}^{tree}`])).trim();
}

function gitBlobAt(commit, repoPath) {
  const records = runGit(['ls-tree', '-z', commit, '--', repoPath], { binary: true })
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
  if (records.length !== 1) throw new Error(`${repoPath} is not one exact file at launch commit ${commit}`);
  const match = records[0].match(/^([0-7]{6}) ([^ ]+) ([0-9a-f]{40,64})\t([\s\S]+)$/u);
  if (!match || match[2] !== 'blob' || match[4] !== repoPath) {
    throw new Error(`${repoPath} is not a Git blob at launch commit ${commit}`);
  }
  return {
    mode: match[1],
    oid: match[3],
    bytes: runGit(['cat-file', 'blob', match[3]], { binary: true }),
  };
}

function requireHoldBoundary(template) {
  if (template.schema !== REQUEST_SCHEMA) throw new Error(`unsupported request schema: ${template.schema}`);
  if (
    template.opportunityGate?.type !== SUPPORTED_OPPORTUNITY &&
    template.actionRegisterBaseline?.type !== SUPPORTED_ACTION_REGISTER_BASELINE &&
    template.actionRegisterBaselineAnalysis?.type !== SUPPORTED_ACTION_REGISTER_ANALYSIS_ONLY &&
    !isSupportedActionRegisterConfirmation(template.actionRegisterConfirmation?.type) &&
    template.boredomActionRegisterProofDag?.type !== SUPPORTED_BOREDOM_ACTION_REGISTER_PROOF_DAG &&
    !isSupportedResistanceSemanticValidation(template.semanticAdjudicationValidation?.type)
  ) {
    throw new Error(
      'the packager supports only frame-refuser opportunity, action/register baseline, sealed analysis-only, frame-refuser confirmation, boredom proof-DAG confirmation, or resistance semantic-validation HOLD templates',
    );
  }
  if (
    template.status !== HOLD_STATUS ||
    template.authorization?.explicitHumanApproval !== null ||
    template.authorization?.modelCallsAuthorized !== false ||
    template.authorization?.liveRunAuthorized !== false
  ) {
    throw new Error('template must remain a literal HOLD with no encoded human approval or execution authority');
  }
  if (
    isSupportedResistanceSemanticValidation(template.semanticAdjudicationValidation?.type) &&
    (template.authorization?.standingArchitecturalCorrectionSha256 !==
      'dae9091d4f2584d416d7765e66d47acba03a33264886a6fa0a1eba45857c05f4' ||
      template.authorization?.priorStandingAuthoritySha256 !==
        '538aa73239072ea618e2c8308edf562f1dd7495b78574e35a3db2f549302c1ce' ||
      template.authorization?.programmeCeilingAmendmentAuthorized !== undefined)
  ) {
    throw new Error(
      'semantic-validation template must bind the architectural correction and prior authority without encoding a ceiling amendment',
    );
  }
  if (
    [
      SUPPORTED_ACTION_REGISTER_CONFIRMATION_SUCCESSOR,
      SUPPORTED_ACTION_REGISTER_CONFIRMATION_OPERATIONAL_CEILING,
      SUPPORTED_ACTION_REGISTER_CONFIRMATION_OBSERVER_REPAIR,
      SUPPORTED_ACTION_REGISTER_CONFIRMATION_OBSERVER_REPAIR_V7,
    ].includes(template.actionRegisterConfirmation?.type) &&
    (template.authorization?.standingAuthorizationAttachmentSha256 !==
      (template.actionRegisterConfirmation?.type === SUPPORTED_ACTION_REGISTER_CONFIRMATION_OBSERVER_REPAIR_V7
        ? '538aa73239072ea618e2c8308edf562f1dd7495b78574e35a3db2f549302c1ce'
        : '4ef020fa2c59d6f7e215029374d7d5adaabc5f620fe1cbd5369020a34e88e08b') ||
      template.authorization?.programmeCeilingAmendmentAuthorized !== false)
  ) {
    throw new Error(
      'successor confirmation template must bind the standing authority and keep its ceiling amendment unauthorized',
    );
  }
  const requirements = template.source?.requirements ?? {};
  const exactHeadPin = requirements.headMustEqualLaunchCommit === true;
  const closurePin =
    requirements.headMustEqualLaunchCommit === false &&
    requirements.closureMustMatchLaunchCommit === true &&
    requirements.launchAuthorizationMustBeCommittedAtHead === true;
  if (
    (!exactHeadPin && !closurePin) ||
    requirements.checkoutMustBeClean !== true ||
    requirements.detachedLaunchWorktree !== true
  ) {
    throw new Error(
      'template must retain one source pin (exact HEAD, or launch-commit closure with a committed launch authorization) plus clean-checkout and detached-launch execution requirements',
    );
  }
}

function materializeRepoFile({ launchCommit, repoPath, label, files }) {
  const canonicalPath = canonicalRepoPath(repoPath, label);
  const blob = gitBlobAt(launchCommit, canonicalPath);
  const digest = sha256(blob.bytes);
  const workingPath = path.join(ROOT, canonicalPath);
  if (!fs.existsSync(workingPath)) throw new Error(`${label} is absent from the protected worktree: ${canonicalPath}`);
  const workingDigest = sha256(fs.readFileSync(workingPath));
  if (workingDigest !== digest) {
    throw new Error(`${label} differs between the protected worktree and launch commit: ${canonicalPath}`);
  }
  files.set(canonicalPath, { ...blob, sha256: digest });
  return { path: canonicalPath, mode: blob.mode, gitBlob: blob.oid, sha256: digest };
}

function requireMarker(templateText, marker, value, replacements) {
  const token = JSON.stringify(marker);
  const count = templateText.split(token).length - 1;
  if (count !== 1) throw new Error(`template must contain exactly one ${marker} marker (observed ${count})`);
  replacements.set(token, JSON.stringify(value));
}

function replaceMarkers(templateText, replacements) {
  let output = templateText;
  for (const [marker, value] of replacements) output = output.replace(marker, value);
  if (output.includes(MARKER_PREFIX)) throw new Error('template contains an unknown or unresolved packaging marker');
  return output.endsWith('\n') ? output : `${output}\n`;
}

function readLaunchJson(files, launchCommit, repoPath, label) {
  const proof = materializeRepoFile({ launchCommit, repoPath, label, files });
  return { proof, value: JSON.parse(files.get(proof.path).bytes.toString('utf8')) };
}

function assertComputedValue(actual, expected, label) {
  if (!Object.is(actual, expected)) throw new Error(`materialized ${label} does not match the computed value`);
}

function assertMaterializedStructure({
  request,
  launchCommit,
  launchTree,
  sourceClosure,
  registration,
  contract,
  certificate,
  routeResult,
  routeConsumption,
  judgeRouteConfig,
  historicalRequest,
  priorConfirmationRequest,
  priorConfirmationV3Request,
  priorConfirmationV4Request,
  priorCeilingBoundRequest,
  priorBoredomRequest,
  priorBoredomPredecessorRequest,
  priorCompletedBoredomFiles,
  priorSemanticValidationRequest,
  priorSemanticValidationSuccessorRequest,
  prefixBundle,
  liveCommandSha256,
  recoveryCommandSha256,
  analyzeCommandSha256,
}) {
  assertComputedValue(request.source?.launchCommit, launchCommit, 'source launch commit');
  assertComputedValue(request.source?.launchTree, launchTree, 'source launch tree');

  if (!Array.isArray(request.source?.closure) || request.source.closure.length !== sourceClosure.length) {
    throw new Error('materialized source closure does not match the computed closure');
  }
  for (const proof of sourceClosure) {
    const matches = request.source.closure.filter((entry) => entry?.path === proof.path);
    if (matches.length !== 1) {
      throw new Error(`materialized source closure must contain exactly one computed path: ${proof.path}`);
    }
    assertComputedValue(matches[0].sha256, proof.sha256, `source closure digest for ${proof.path}`);
  }

  assertComputedValue(request.bindings?.registration?.path, registration.path, 'registration path');
  assertComputedValue(request.bindings?.registration?.sha256, registration.sha256, 'registration digest');

  const endpoint = request.bindings?.endpoint;
  assertComputedValue(endpoint?.contractPath, contract.proof.path, 'endpoint contract path');
  assertComputedValue(endpoint?.contractFileSha256, contract.proof.sha256, 'endpoint contract file digest');
  assertComputedValue(
    endpoint?.contractCanonicalSha256,
    sha256CanonicalJson(contract.value),
    'endpoint contract canonical digest',
  );
  assertComputedValue(endpoint?.certificatePath, certificate.proof.path, 'endpoint certificate path');
  assertComputedValue(endpoint?.certificateFileSha256, certificate.proof.sha256, 'endpoint certificate file digest');
  assertComputedValue(endpoint?.preflightSha256, certificate.value.preflight_sha256, 'endpoint preflight digest');

  if (judgeRouteConfig) {
    assertComputedValue(
      request.bindings?.judgeRoutes?.providerConfigPath,
      judgeRouteConfig.path,
      'judge route provider config path',
    );
    assertComputedValue(
      request.bindings?.judgeRoutes?.providerConfigSha256,
      judgeRouteConfig.sha256,
      'judge route provider config digest',
    );
  } else {
    const route = request.bindings?.routeCanary;
    assertComputedValue(route?.resultPath, routeResult.proof.path, 'route result path');
    assertComputedValue(route?.resultSha256, routeResult.proof.sha256, 'route result digest');
    assertComputedValue(
      route?.authorizationConsumptionPath,
      routeConsumption.path,
      'route authorization consumption path',
    );
    assertComputedValue(
      route?.authorizationConsumptionSha256,
      routeConsumption.sha256,
      'route authorization consumption digest',
    );
    for (const [field, expected] of [
      ['sourceArtifactSha256', routeResult.value.sourceArtifactSha256],
      ['executionHead', routeResult.value.executionHead],
      ['observedProvider', routeResult.value.observed?.provider],
      ['observedModel', routeResult.value.observed?.model],
      ['observedEffort', routeResult.value.observed?.effort],
      ['attestationBasis', routeResult.value.observed?.modelAttestationBasis],
      ['modelIndependentlyAttested', routeResult.value.observed?.modelIndependentlyAttested],
    ]) {
      assertComputedValue(route?.[field], expected, `route ${field}`);
    }
  }

  const historical = request.opportunityGate?.historicalOpportunityV1;
  if (historicalRequest) {
    const priorRequest =
      request.actionRegisterBaseline?.priorStoppedExecution?.request ??
      request.actionRegisterBaselineAnalysis?.sealedInputs?.priorRequest ??
      request.actionRegisterConfirmation?.calibrationSizingEvidence?.analysisRequest ??
      request.boredomActionRegisterProofDag?.calibrationSizingEvidence?.analysisRequest;
    assertComputedValue(
      historical?.requestPath ?? priorRequest?.path,
      historicalRequest.path,
      'historical request path',
    );
    assertComputedValue(
      historical?.requestSha256 ?? priorRequest?.sha256,
      historicalRequest.sha256,
      'historical request digest',
    );
  }
  if (priorConfirmationRequest) {
    const prior = request.actionRegisterConfirmation?.priorIncompleteConfirmation?.request;
    assertComputedValue(prior?.path, priorConfirmationRequest.path, 'prior incomplete confirmation request path');
    assertComputedValue(prior?.sha256, priorConfirmationRequest.sha256, 'prior incomplete confirmation request digest');
  }
  if (priorConfirmationV3Request) {
    const prior = request.actionRegisterConfirmation?.priorIncompleteConfirmationV3?.request;
    assertComputedValue(prior?.path, priorConfirmationV3Request.path, 'prior incomplete V3 request path');
    assertComputedValue(prior?.sha256, priorConfirmationV3Request.sha256, 'prior incomplete V3 request digest');
  }
  if (priorConfirmationV4Request) {
    const prior = request.actionRegisterConfirmation?.priorIncompleteConfirmationV4?.request;
    assertComputedValue(prior?.path, priorConfirmationV4Request.path, 'prior incomplete V4 request path');
    assertComputedValue(prior?.sha256, priorConfirmationV4Request.sha256, 'prior incomplete V4 request digest');
  }
  if (priorCeilingBoundRequest) {
    const prior = request.actionRegisterConfirmation?.supersededCeilingBoundRequest?.request;
    assertComputedValue(prior?.path, priorCeilingBoundRequest.path, 'superseded ceiling-bound request path');
    assertComputedValue(prior?.sha256, priorCeilingBoundRequest.sha256, 'superseded ceiling-bound request digest');
  }
  if (priorBoredomRequest) {
    const prior = request.boredomActionRegisterProofDag?.priorStoppedExecution?.request;
    assertComputedValue(prior?.path, priorBoredomRequest.path, 'prior stopped boredom request path');
    assertComputedValue(prior?.sha256, priorBoredomRequest.sha256, 'prior stopped boredom request digest');
  }
  if (priorBoredomPredecessorRequest) {
    const prior = request.boredomActionRegisterProofDag?.priorStoppedExecution?.predecessorRequest;
    assertComputedValue(prior?.path, priorBoredomPredecessorRequest.path, 'prior boredom predecessor request path');
    assertComputedValue(prior?.sha256, priorBoredomPredecessorRequest.sha256, 'prior boredom predecessor digest');
  }
  for (const [key, proof] of priorCompletedBoredomFiles || []) {
    const prior = request.boredomActionRegisterProofDag?.priorCompletedExecution?.[key];
    assertComputedValue(prior?.path, proof.path, `completed boredom predecessor ${key} path`);
    assertComputedValue(prior?.sha256, proof.sha256, `completed boredom predecessor ${key} digest`);
  }
  if (priorSemanticValidationRequest) {
    const prior = request.semanticAdjudicationValidation?.stoppedV3Validation?.request;
    assertComputedValue(prior?.path, priorSemanticValidationRequest.path, 'prior semantic-validation request path');
    assertComputedValue(
      prior?.sha256,
      priorSemanticValidationRequest.sha256,
      'prior semantic-validation request digest',
    );
  }
  if (priorSemanticValidationSuccessorRequest) {
    const prior = request.semanticAdjudicationValidation?.stoppedV3SuccessorValidation?.request;
    assertComputedValue(
      prior?.path,
      priorSemanticValidationSuccessorRequest.path,
      'prior semantic-validation successor path',
    );
    assertComputedValue(
      prior?.sha256,
      priorSemanticValidationSuccessorRequest.sha256,
      'prior semantic-validation successor digest',
    );
  }
  if (prefixBundle) {
    assertComputedValue(request.bindings?.prefixBundle?.path, prefixBundle.path, 'prefix bundle path');
    assertComputedValue(request.bindings?.prefixBundle?.sha256, prefixBundle.sha256, 'prefix bundle digest');
  }
  if (request.actionRegisterBaselineAnalysis?.type === SUPPORTED_ACTION_REGISTER_ANALYSIS_ONLY) {
    assertComputedValue(request.commands?.live, undefined, 'absent analysis-only live command');
    assertComputedValue(request.bindings?.commands?.liveArraySha256, undefined, 'absent analysis-only live digest');
  } else {
    assertComputedValue(request.bindings?.commands?.liveArraySha256, liveCommandSha256, 'live command digest');
  }
  if (
    request.actionRegisterBaseline?.type === SUPPORTED_ACTION_REGISTER_BASELINE ||
    isSupportedActionRegisterConfirmation(request.actionRegisterConfirmation?.type) ||
    request.boredomActionRegisterProofDag?.type === SUPPORTED_BOREDOM_ACTION_REGISTER_PROOF_DAG ||
    isSupportedResistanceSemanticValidation(request.semanticAdjudicationValidation?.type)
  ) {
    assertComputedValue(
      request.bindings?.commands?.recoveryArraySha256,
      recoveryCommandSha256,
      'recovery command digest',
    );
  }
  assertComputedValue(request.bindings?.commands?.analyzeArraySha256, analyzeCommandSha256, 'analyze command digest');
}

function materializeTemplate({ templateText, template, launchCommit }) {
  requireHoldBoundary(template);
  const files = new Map();
  const replacements = new Map();
  const launchTree = commitTree(launchCommit);
  requireMarker(templateText, GO_REQUEST_PACKAGE_MARKERS.sourceCommit, launchCommit, replacements);
  requireMarker(templateText, GO_REQUEST_PACKAGE_MARKERS.sourceTree, launchTree, replacements);

  if (!Array.isArray(template.source?.closure) || template.source.closure.length === 0) {
    throw new Error('template source closure must be a non-empty array');
  }
  const closurePaths = template.source.closure.map((entry) => entry?.path);
  if (new Set(closurePaths).size !== closurePaths.length)
    throw new Error('template source closure paths must be unique');
  const sourceClosure = template.source.closure.map((entry) => {
    const proof = materializeRepoFile({
      launchCommit,
      repoPath: entry.path,
      label: `source closure ${entry.path}`,
      files,
    });
    requireMarker(templateText, goRequestFileSha256Marker(proof.path), proof.sha256, replacements);
    return proof;
  });

  const registration = materializeRepoFile({
    launchCommit,
    repoPath: template.bindings?.registration?.path,
    label: 'registration binding',
    files,
  });
  requireMarker(templateText, goRequestFileSha256Marker(registration.path), registration.sha256, replacements);

  const endpoint = template.bindings?.endpoint;
  const contract = readLaunchJson(files, launchCommit, endpoint?.contractPath, 'endpoint contract');
  const certificate = readLaunchJson(files, launchCommit, endpoint?.certificatePath, 'endpoint certificate');
  requireMarker(templateText, goRequestFileSha256Marker(contract.proof.path), contract.proof.sha256, replacements);
  requireMarker(
    templateText,
    goRequestFileSha256Marker(certificate.proof.path),
    certificate.proof.sha256,
    replacements,
  );
  requireMarker(
    templateText,
    GO_REQUEST_PACKAGE_MARKERS.endpointCanonicalSha256,
    sha256CanonicalJson(contract.value),
    replacements,
  );
  requireMarker(
    templateText,
    GO_REQUEST_PACKAGE_MARKERS.endpointPreflightSha256,
    certificate.value.preflight_sha256,
    replacements,
  );

  const isSemanticValidation = isSupportedResistanceSemanticValidation(template.semanticAdjudicationValidation?.type);
  let routeResult = null;
  let routeConsumption = null;
  let judgeRouteConfig = null;
  if (isSemanticValidation) {
    judgeRouteConfig = materializeRepoFile({
      launchCommit,
      repoPath: template.bindings?.judgeRoutes?.providerConfigPath,
      label: 'semantic judge route provider config',
      files,
    });
    requireMarker(
      templateText,
      goRequestFileSha256Marker(judgeRouteConfig.path),
      judgeRouteConfig.sha256,
      replacements,
    );
  } else {
    const route = template.bindings?.routeCanary;
    routeResult = readLaunchJson(files, launchCommit, route?.resultPath, 'route result');
    routeConsumption = materializeRepoFile({
      launchCommit,
      repoPath: route?.authorizationConsumptionPath,
      label: 'route authorization consumption',
      files,
    });
    requireMarker(
      templateText,
      goRequestFileSha256Marker(routeResult.proof.path),
      routeResult.proof.sha256,
      replacements,
    );
    requireMarker(
      templateText,
      goRequestFileSha256Marker(routeConsumption.path),
      routeConsumption.sha256,
      replacements,
    );
    for (const [marker, value] of [
      [GO_REQUEST_PACKAGE_MARKERS.routeSourceArtifactSha256, routeResult.value.sourceArtifactSha256],
      [GO_REQUEST_PACKAGE_MARKERS.routeExecutionHead, routeResult.value.executionHead],
      [GO_REQUEST_PACKAGE_MARKERS.routeProvider, routeResult.value.observed?.provider],
      [GO_REQUEST_PACKAGE_MARKERS.routeModel, routeResult.value.observed?.model],
      [GO_REQUEST_PACKAGE_MARKERS.routeEffort, routeResult.value.observed?.effort],
      [GO_REQUEST_PACKAGE_MARKERS.routeAttestationBasis, routeResult.value.observed?.modelAttestationBasis],
      [
        GO_REQUEST_PACKAGE_MARKERS.routeModelIndependentlyAttested,
        routeResult.value.observed?.modelIndependentlyAttested,
      ],
    ]) {
      requireMarker(templateText, marker, value, replacements);
    }
  }

  const historicalRequestPath =
    template.opportunityGate?.historicalOpportunityV1?.requestPath ??
    template.actionRegisterBaseline?.priorStoppedExecution?.request?.path ??
    template.actionRegisterBaselineAnalysis?.sealedInputs?.priorRequest?.path ??
    template.actionRegisterConfirmation?.calibrationSizingEvidence?.analysisRequest?.path ??
    template.boredomActionRegisterProofDag?.calibrationSizingEvidence?.analysisRequest?.path;
  const historicalRequest = historicalRequestPath
    ? materializeRepoFile({
        launchCommit,
        repoPath: historicalRequestPath,
        label: 'historical request',
        files,
      })
    : null;
  if (historicalRequest) {
    requireMarker(
      templateText,
      goRequestFileSha256Marker(historicalRequest.path),
      historicalRequest.sha256,
      replacements,
    );
  }
  const priorConfirmationRequestPath = template.actionRegisterConfirmation?.priorIncompleteConfirmation?.request?.path;
  const priorConfirmationRequest = priorConfirmationRequestPath
    ? materializeRepoFile({
        launchCommit,
        repoPath: priorConfirmationRequestPath,
        label: 'prior incomplete confirmation request',
        files,
      })
    : null;
  if (priorConfirmationRequest) {
    requireMarker(
      templateText,
      goRequestFileSha256Marker(priorConfirmationRequest.path),
      priorConfirmationRequest.sha256,
      replacements,
    );
  }
  const priorConfirmationV3RequestPath =
    template.actionRegisterConfirmation?.priorIncompleteConfirmationV3?.request?.path;
  const priorConfirmationV3Request = priorConfirmationV3RequestPath
    ? materializeRepoFile({
        launchCommit,
        repoPath: priorConfirmationV3RequestPath,
        label: 'prior incomplete V3 confirmation request',
        files,
      })
    : null;
  if (priorConfirmationV3Request) {
    requireMarker(
      templateText,
      goRequestFileSha256Marker(priorConfirmationV3Request.path),
      priorConfirmationV3Request.sha256,
      replacements,
    );
  }
  const priorConfirmationV4RequestPath =
    template.actionRegisterConfirmation?.priorIncompleteConfirmationV4?.request?.path;
  const priorConfirmationV4Request = priorConfirmationV4RequestPath
    ? materializeRepoFile({
        launchCommit,
        repoPath: priorConfirmationV4RequestPath,
        label: 'prior incomplete V4 confirmation request',
        files,
      })
    : null;
  if (priorConfirmationV4Request) {
    requireMarker(
      templateText,
      goRequestFileSha256Marker(priorConfirmationV4Request.path),
      priorConfirmationV4Request.sha256,
      replacements,
    );
  }
  const priorCeilingBoundRequestPath =
    template.actionRegisterConfirmation?.supersededCeilingBoundRequest?.request?.path;
  const priorCeilingBoundRequest = priorCeilingBoundRequestPath
    ? materializeRepoFile({
        launchCommit,
        repoPath: priorCeilingBoundRequestPath,
        label: 'superseded ceiling-bound confirmation request',
        files,
      })
    : null;
  if (priorCeilingBoundRequest) {
    requireMarker(
      templateText,
      goRequestFileSha256Marker(priorCeilingBoundRequest.path),
      priorCeilingBoundRequest.sha256,
      replacements,
    );
  }
  const priorBoredomRequestPath = template.boredomActionRegisterProofDag?.priorStoppedExecution?.request?.path;
  const priorBoredomRequest = priorBoredomRequestPath
    ? materializeRepoFile({
        launchCommit,
        repoPath: priorBoredomRequestPath,
        label: 'prior stopped boredom request',
        files,
      })
    : null;
  if (priorBoredomRequest) {
    requireMarker(
      templateText,
      goRequestFileSha256Marker(priorBoredomRequest.path),
      priorBoredomRequest.sha256,
      replacements,
    );
  }
  const priorBoredomPredecessorRequestPath =
    template.boredomActionRegisterProofDag?.priorStoppedExecution?.predecessorRequest?.path;
  const priorBoredomPredecessorRequest = priorBoredomPredecessorRequestPath
    ? materializeRepoFile({
        launchCommit,
        repoPath: priorBoredomPredecessorRequestPath,
        label: 'prior boredom predecessor request',
        files,
      })
    : null;
  if (priorBoredomPredecessorRequest) {
    requireMarker(
      templateText,
      goRequestFileSha256Marker(priorBoredomPredecessorRequest.path),
      priorBoredomPredecessorRequest.sha256,
      replacements,
    );
  }
  // v5 follows a study that finished rather than one that stopped. The three
  // files that carry the finished result travel the same road as a stopped
  // predecessor: materialised from the launch commit and digest-pinned, so the
  // checker can read them inside the replay tree, where nothing else reaches.
  const priorCompletedBoredomFiles = ['request', 'registration', 'amendment']
    .map((key) => {
      const repoPath = template.boredomActionRegisterProofDag?.priorCompletedExecution?.[key]?.path;
      if (!repoPath) return null;
      const proof = materializeRepoFile({
        launchCommit,
        repoPath,
        label: `completed boredom predecessor ${key}`,
        files,
      });
      requireMarker(templateText, goRequestFileSha256Marker(proof.path), proof.sha256, replacements);
      return [key, proof];
    })
    .filter(Boolean);

  const supersededBoredomHoldRequestPath =
    template.boredomActionRegisterProofDag?.semanticValidation?.supersededHoldRequest?.path;
  const supersededBoredomHoldRequest = supersededBoredomHoldRequestPath
    ? materializeRepoFile({
        launchCommit,
        repoPath: supersededBoredomHoldRequestPath,
        label: 'superseded boredom HOLD request',
        files,
      })
    : null;
  if (supersededBoredomHoldRequest) {
    requireMarker(
      templateText,
      goRequestFileSha256Marker(supersededBoredomHoldRequest.path),
      supersededBoredomHoldRequest.sha256,
      replacements,
    );
  }
  const priorSemanticValidationRequestPath =
    template.semanticAdjudicationValidation?.stoppedV3Validation?.request?.path;
  const priorSemanticValidationRequest = priorSemanticValidationRequestPath
    ? materializeRepoFile({
        launchCommit,
        repoPath: priorSemanticValidationRequestPath,
        label: 'prior stopped semantic-validation request',
        files,
      })
    : null;
  if (priorSemanticValidationRequest) {
    requireMarker(
      templateText,
      goRequestFileSha256Marker(priorSemanticValidationRequest.path),
      priorSemanticValidationRequest.sha256,
      replacements,
    );
  }
  const priorSemanticValidationSuccessorRequestPath =
    template.semanticAdjudicationValidation?.stoppedV3SuccessorValidation?.request?.path;
  const priorSemanticValidationSuccessorRequest = priorSemanticValidationSuccessorRequestPath
    ? materializeRepoFile({
        launchCommit,
        repoPath: priorSemanticValidationSuccessorRequestPath,
        label: 'prior stopped semantic-validation successor request',
        files,
      })
    : null;
  if (priorSemanticValidationSuccessorRequest) {
    requireMarker(
      templateText,
      goRequestFileSha256Marker(priorSemanticValidationSuccessorRequest.path),
      priorSemanticValidationSuccessorRequest.sha256,
      replacements,
    );
  }
  const prefixBundlePath = template.bindings?.prefixBundle?.path;
  const prefixBundle = prefixBundlePath
    ? materializeRepoFile({
        launchCommit,
        repoPath: prefixBundlePath,
        label: 'public prefix bundle',
        files,
      })
    : null;
  if (prefixBundle) {
    requireMarker(templateText, goRequestFileSha256Marker(prefixBundle.path), prefixBundle.sha256, replacements);
  }

  const isAnalysisOnly = template.actionRegisterBaselineAnalysis?.type === SUPPORTED_ACTION_REGISTER_ANALYSIS_ONLY;
  const liveCommandSha256 = isAnalysisOnly ? null : sha256(JSON.stringify(template.commands?.live));
  const recoveryCommandSha256 =
    template.actionRegisterBaseline?.type === SUPPORTED_ACTION_REGISTER_BASELINE ||
    isSupportedActionRegisterConfirmation(template.actionRegisterConfirmation?.type) ||
    template.boredomActionRegisterProofDag?.type === SUPPORTED_BOREDOM_ACTION_REGISTER_PROOF_DAG ||
    isSemanticValidation
      ? sha256(JSON.stringify(template.commands?.recovery))
      : null;
  const analyzeCommandSha256 = sha256(JSON.stringify(template.commands?.analyze));
  if (liveCommandSha256) {
    requireMarker(templateText, GO_REQUEST_PACKAGE_MARKERS.liveCommandSha256, liveCommandSha256, replacements);
  }
  if (recoveryCommandSha256) {
    requireMarker(templateText, GO_REQUEST_PACKAGE_MARKERS.recoveryCommandSha256, recoveryCommandSha256, replacements);
  }
  requireMarker(templateText, GO_REQUEST_PACKAGE_MARKERS.analyzeCommandSha256, analyzeCommandSha256, replacements);

  const requestText = replaceMarkers(templateText, replacements);
  const request = JSON.parse(requestText);
  assertMaterializedStructure({
    request,
    launchCommit,
    launchTree,
    sourceClosure,
    registration,
    contract,
    certificate,
    routeResult,
    routeConsumption,
    judgeRouteConfig,
    historicalRequest,
    priorConfirmationRequest,
    priorConfirmationV3Request,
    priorConfirmationV4Request,
    priorCeilingBoundRequest,
    priorBoredomRequest,
    priorBoredomPredecessorRequest,
    priorCompletedBoredomFiles,
    priorSemanticValidationRequest,
    priorSemanticValidationSuccessorRequest,
    prefixBundle,
    liveCommandSha256,
    recoveryCommandSha256,
    analyzeCommandSha256,
  });
  return {
    files,
    request,
    requestText,
    launchTree,
    sourceClosure,
    repositoryBindingCount: files.size - sourceClosure.length,
  };
}

export function resolveTutorStubGoRequestOutput(outputPath) {
  const absolutePath = path.isAbsolute(outputPath)
    ? path.resolve(outputPath)
    : path.join(ROOT, canonicalRepoPath(outputPath, '--out'));
  const repoPath = repoRelative(absolutePath, '--out');
  return { repoPath, absolutePath: path.join(ROOT, repoPath) };
}

function assertDestinationAbsent(request, root = ROOT) {
  if (request.actionRegisterBaselineAnalysis?.type === SUPPORTED_ACTION_REGISTER_ANALYSIS_ONLY) {
    const report = path.resolve(root, canonicalRepoPath(request.destination?.combinedReport, 'combined report'));
    const relative = path.relative(root, report);
    if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error('combined report must remain inside the repository');
    }
    if (fs.existsSync(report)) {
      throw new Error(`request destination already exists: ${request.destination.combinedReport}`);
    }
    return request.destination.combinedReport;
  }
  if (request.actionRegisterBaseline?.type === SUPPORTED_ACTION_REGISTER_BASELINE) {
    const destinations = [request.destination?.batchA?.artifactRoot, request.destination?.batchB?.artifactRoot];
    if (destinations.some((value) => !value) || destinations[0] === destinations[1]) {
      throw new Error('action/register request requires two distinct batch destinations');
    }
    for (const artifactRoot of destinations) {
      const absolute = path.resolve(root, canonicalRepoPath(artifactRoot, 'batch destination'));
      const relative = path.relative(root, absolute);
      if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        throw new Error('batch destination must remain inside the repository');
      }
      if (fs.existsSync(absolute)) throw new Error(`request destination already exists: ${artifactRoot}`);
    }
    const report = path.resolve(root, canonicalRepoPath(request.destination?.combinedReport, 'combined report'));
    if (fs.existsSync(report))
      throw new Error(`request destination already exists: ${request.destination.combinedReport}`);
    return destinations;
  }
  if (
    isSupportedActionRegisterConfirmation(request.actionRegisterConfirmation?.type) ||
    request.boredomActionRegisterProofDag?.type === SUPPORTED_BOREDOM_ACTION_REGISTER_PROOF_DAG
  ) {
    const destinations = request.destination?.batches?.map((entry) => entry?.artifactRoot) || [];
    if (destinations.length !== 9 || new Set(destinations).size !== 9 || destinations.some((value) => !value)) {
      throw new Error('confirmation request requires nine distinct batch destinations');
    }
    for (const artifactRoot of destinations) {
      const absolute = path.resolve(root, canonicalRepoPath(artifactRoot, 'confirmation batch destination'));
      const relative = path.relative(root, absolute);
      if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        throw new Error('confirmation batch destination must remain inside the repository');
      }
      if (fs.existsSync(absolute)) throw new Error(`request destination already exists: ${artifactRoot}`);
    }
    const report = path.resolve(root, canonicalRepoPath(request.destination?.combinedReport, 'combined report'));
    if (fs.existsSync(report))
      throw new Error(`request destination already exists: ${request.destination.combinedReport}`);
    return destinations;
  }
  const artifactRoot = String(request.destination?.artifactRoot || '');
  if (!artifactRoot || path.isAbsolute(artifactRoot) || path.posix.normalize(artifactRoot) !== artifactRoot) {
    throw new Error('request destination must be a canonical repository-relative path without traversal');
  }
  const absolute = path.resolve(root, artifactRoot);
  const relative = path.relative(root, absolute);
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('request destination must remain inside the repository');
  }
  if (fs.existsSync(absolute)) throw new Error(`request destination already exists: ${artifactRoot}`);
  return artifactRoot;
}

function writeMaterializedTree(root, files) {
  for (const [repoPath, file] of files) {
    const target = path.join(root, repoPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.bytes, { mode: file.mode === '100755' ? 0o755 : 0o644 });
  }
}

function isolatedReplay({ requestText, requestRepoPath, request, files }) {
  const replayRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'go-request-package-replay-'));
  try {
    writeMaterializedTree(replayRoot, files);
    const replayRequestPath = path.join(replayRoot, requestRepoPath);
    fs.mkdirSync(path.dirname(replayRequestPath), { recursive: true });
    fs.writeFileSync(replayRequestPath, requestText, { flag: 'wx' });
    if (fs.existsSync(path.join(replayRoot, 'node_modules'))) {
      throw new Error('isolated replay unexpectedly contains node_modules');
    }
    assertDestinationAbsent(request, replayRoot);
    const gitCommonDir = String(runGit(['rev-parse', '--path-format=absolute', '--git-common-dir'])).trim();
    const environment = { ...process.env, GIT_DIR: gitCommonDir, GIT_WORK_TREE: replayRoot, NODE_PATH: '' };
    for (const key of Object.keys(environment)) {
      if (/(?:API_KEY|AUTH_TOKEN|MODEL_TOKEN)$/u.test(key)) delete environment[key];
    }
    environment.GO_REQUEST_REPLAY_PATH = replayRequestPath;
    const validatorUrl = pathToFileURL(
      path.join(replayRoot, 'scripts', 'check-tutor-stub-resistant-profile-study-go-request.js'),
    ).href;
    const runner = [
      `import { validateTutorStubResistantProfileStudyGoRequest as validate } from ${JSON.stringify(validatorUrl)};`,
      'const report = validate({ requestPath: process.env.GO_REQUEST_REPLAY_PATH });',
      'process.stdout.write(JSON.stringify(report));',
    ].join('\n');
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', runner], {
      cwd: replayRoot,
      encoding: 'utf8',
      env: environment,
      maxBuffer: 16 * 1024 * 1024,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`isolated focused validation failed: ${String(result.stderr).trim()}`);
    const stdout = String(result.stdout || '').trim();
    if (!stdout) {
      throw new Error(
        `isolated focused validation produced no JSON: ${String(result.stderr || '').trim() || 'no stderr'}`,
      );
    }
    let report;
    try {
      report = JSON.parse(stdout);
    } catch (error) {
      throw new Error(`isolated focused validation produced invalid JSON: ${error.message}`);
    }
    const empiricalSemanticValidationPending =
      request.boredomActionRegisterProofDag?.requestRevision === 4 &&
      request.boredomActionRegisterProofDag?.semanticValidation?.empiricalValidationStatus === 'pending';
    const expectedApprovalReadiness = !empiricalSemanticValidationPending;
    if (
      report.packetValid !== true ||
      report.readyForExplicitHumanApproval !== expectedApprovalReadiness ||
      report.modelCalls !== 0 ||
      report.productionWrites !== 0
    ) {
      throw new Error('isolated replay did not prove the expected zero-call, zero-production-write HOLD boundary');
    }
    return {
      nodeModulesPresent: false,
      packetValid: true,
      readyForExplicitHumanApproval: report.readyForExplicitHumanApproval,
      checksPassed: report.checks.length,
      modelCalls: 0,
      productionWrites: 0,
      exactApprovalStatement: report.exactApprovalStatement,
    };
  } finally {
    fs.rmSync(replayRoot, { recursive: true, force: true });
  }
}

export function packageTutorStubResistantProfileStudyGoRequest({ templatePath, launchCommit, outputPath }) {
  if (!templatePath || !launchCommit || !outputPath) {
    throw new Error('templatePath, launchCommit, and outputPath are required');
  }
  const output = resolveTutorStubGoRequestOutput(outputPath);
  if (fs.existsSync(output.absolutePath)) throw new Error(`refusing to overwrite existing request: ${output.repoPath}`);
  const templateText = fs.readFileSync(path.resolve(templatePath), 'utf8');
  const template = JSON.parse(templateText);
  const exactLaunchCommit = resolveLaunchCommit(launchCommit);
  const materialized = materializeTemplate({ templateText, template, launchCommit: exactLaunchCommit });
  assertDestinationAbsent(materialized.request);
  const replay = isolatedReplay({
    requestText: materialized.requestText,
    requestRepoPath: output.repoPath,
    request: materialized.request,
    files: materialized.files,
  });
  try {
    fs.writeFileSync(output.absolutePath, materialized.requestText, { encoding: 'utf8', flag: 'wx', mode: 0o644 });
    fs.chmodSync(output.absolutePath, 0o644);
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error(`refusing to overwrite existing request: ${output.repoPath}`);
    throw error;
  }
  return {
    schema: REPORT_SCHEMA,
    status: replay.readyForExplicitHumanApproval
      ? 'PACKAGED_HOLD_REQUIRES_EXPLICIT_HUMAN_APPROVAL'
      : 'PACKAGED_HOLD_EMPIRICAL_VALIDATION_PENDING',
    requestPath: output.repoPath,
    requestSha256: sha256(materialized.requestText),
    launchCommit: exactLaunchCommit,
    launchTree: materialized.launchTree,
    sourceClosureFiles: materialized.sourceClosure.length,
    repositoryBindingFiles: materialized.repositoryBindingCount,
    protectedWorktreeBytesMatchLaunchCommit: true,
    fullCheckoutCleanlinessClaimed: false,
    isolatedReplay: replay,
    authorizationBoundary: {
      explicitHumanApproval: null,
      modelCallsAuthorized: false,
      liveRunAuthorized: false,
      exactApprovalStatement: replay.exactApprovalStatement,
      disposition: replay.readyForExplicitHumanApproval
        ? 'This package is not authorization; a human must supply the exact approval statement separately.'
        : 'This package is not authorization and is not approval-ready; its registered empirical validation gate remains pending.',
    },
    effects: {
      requestFilesWritten: 1,
      proofArtifactsWritten: 0,
      modelCalls: 0,
      productionWrites: 0,
    },
  };
}

function formatSummary(report) {
  return [
    `GO request packaged: ${report.requestPath}`,
    `Request SHA-256: ${report.requestSha256}`,
    `Launch commit/tree: ${report.launchCommit} / ${report.launchTree}`,
    'Isolated replay: pass; node_modules: absent; model calls: 0; production writes: 0',
    `Approval still required: ${report.authorizationBoundary.exactApprovalStatement}`,
  ].join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const report = packageTutorStubResistantProfileStudyGoRequest({
    templatePath: args.template,
    launchCommit: args.launchCommit,
    outputPath: args.out,
  });
  process.stdout.write(args.json ? `${JSON.stringify(report, null, 2)}\n` : `${formatSummary(report)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`GO request packaging failed: ${error.message}\n`);
    process.exitCode = 2;
  }
}
