#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

import {
  appendRunEvent,
  assertExperimentRun,
  buildExperimentRunPlan,
  canonicalJson,
  captureGitFingerprint,
  createRunPlan,
  createRunSeal,
  hashCanonicalJson,
  hashFile,
  sha256,
  verifyExperimentRun,
} from '../services/experimentRunArtifacts.js';
import {
  buildAdaptiveStateCanonicalPilotPredictions,
  buildAdaptiveStateCanonicalPilotReport,
  renderAdaptiveStateCanonicalPilotReport,
  validateAdaptiveStateCanonicalPilotContract,
} from '../services/adaptiveTutor/stateBenchmarkCanonicalPilot.js';
import { validateAdaptiveStateStage0SplitManifestContentSha256 } from '../services/adaptiveTutor/stateBenchmarkStage0Analysis.js';
import { loadAdaptiveStateStage0Dataset } from '../services/adaptiveTutor/stateBenchmarkStage0Executor.js';
import { validateAdaptiveStateStage1Parent } from '../services/adaptiveTutor/stateBenchmarkStage1Executor.js';

const SCRIPT = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT), '..');
const DEFAULT_BASE_CONFIG = path.join(ROOT, 'config', 'adaptive-state-benchmark-v2.yaml');
const DEFAULT_PILOT_CONFIG = path.join(ROOT, 'config', 'adaptive-state-instrument-v2.3.yaml');
const DEFAULT_PARENT = path.join(
  ROOT,
  'exports',
  'adaptive-state-benchmark-v2',
  'adaptive-state-v2-s0-exact-channel-346e472a-v23',
);
const DEFAULT_OUT = path.join(ROOT, 'exports', 'adaptive-state-benchmark-v2');
const ANALYZER = path.join(ROOT, 'services', 'adaptiveTutor', 'stateBenchmarkCanonicalPilot.js');
const STAGE0_ANALYSIS = path.join(ROOT, 'services', 'adaptiveTutor', 'stateBenchmarkStage0Analysis.js');

function arg(argv, name, fallback = null) {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[index + 1] : fallback;
}

function has(argv, name) {
  return argv.includes(`--${name}`);
}

function resolveFromRoot(value) {
  return path.isAbsolute(value) ? value : path.resolve(ROOT, value);
}

function usage() {
  return `Usage: node scripts/execute-adaptive-state-canonical-pilot-v23.js [options]

Runs the prospectively frozen, zero-model-call v2.3 canonical sensor pilot.
It can authorize implementation of S2, but never launches S2, names a validated
winner, or opens policy optimization.

Options:
  --parent <dir>       Sealed passing exact-channel S0 parent
  --label <id>         Default: adaptive-state-v2-s1-canonical-pilot-v23
  --run-seed <n>       Artifact job-order seed. Default: 20260712
  --base-config <path> Default: config/adaptive-state-benchmark-v2.yaml
  --pilot-config <path> Default: config/adaptive-state-instrument-v2.3.yaml
  --out <dir>          Default: exports/adaptive-state-benchmark-v2
  --dry-run            Verify the frozen contract and parent without fitting heads
  --help               Show this help
`;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeExclusive(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  try {
    fs.writeFileSync(filePath, content, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error(`Refusing to overwrite immutable pilot artifact at ${filePath}`);
    throw error;
  }
  return { path: filePath, bytes: Buffer.byteLength(content), sha256: sha256(content) };
}

function aggregateFileHash(paths) {
  return hashCanonicalJson(
    [...new Set(paths)].sort().map((file) => ({
      path: path.relative(ROOT, file),
      sha256: hashFile(file),
    })),
  );
}

function validateExactChannelParent({ parentRunDir, baseConfig, baseConfigPath }) {
  const parent = validateAdaptiveStateStage1Parent({
    parentRunDir,
    config: baseConfig,
    configPath: baseConfigPath,
    repoRoot: ROOT,
  });
  const verification = verifyExperimentRun(parentRunDir);
  if (
    verification.plan?.metadata?.observationChannelVersion !== '2.3' ||
    verification.plan?.metadata?.stage !== 's0_contract' ||
    verification.seal?.status !== 'complete'
  ) {
    throw new Error('Canonical pilot requires a sealed passing v2.3 exact-public-event S0 parent');
  }
  const report = readJson(path.join(parentRunDir, 'stage0-contract-report.json'));
  if (report.status !== 'pass' || Number(report?.coverage?.model_calls ?? 0) !== 0) {
    throw new Error('Canonical pilot parent report is not a zero-call S0 pass');
  }
  return { ...parent, observation_channel_version: '2.3' };
}

function executionRunPlan({ label, runSeed, parent, baseConfigPath, pilotConfigPath, pilotConfig }) {
  const git = captureGitFingerprint({ repoRoot: ROOT });
  delete git.repoRoot;
  return buildExperimentRunPlan({
    runId: label,
    runner: path.relative(ROOT, SCRIPT),
    provenance: { git },
    models: {
      fixed_prediction_head: {
        requested: 'deterministic-fixed-multinomial-head-v2.1',
        resolved: 'deterministic-fixed-multinomial-head-v2.1',
        observed: null,
      },
    },
    requiredObservedModelRoles: [],
    hashes: {
      runner: aggregateFileHash([SCRIPT, ANALYZER]),
      analyzer: aggregateFileHash([ANALYZER, STAGE0_ANALYSIS]),
      policy: hashCanonicalJson(pilotConfig.stage_contract.s1_canonical_sensor_pilot.decision_contract),
      profile: hashFile(pilotConfigPath),
      prompt: hashCanonicalJson({ model_calls: 0, public_channel: 'exact_public_event_channel_v2.3' }),
      world: parent.dataset_sha256,
      config: aggregateFileHash([baseConfigPath, pilotConfigPath]),
    },
    masterSeed: runSeed,
    jobs: [{ id: 'canonical-pilot-offline-analysis', repeat: 1 }],
    lineage: { parentRunId: parent.run_id, resumeOf: null, supersedes: [] },
    intent: {
      claimBoundary: pilotConfig.claim_boundary,
      executionBoundary:
        'Zero-call directional screen only. May authorize S2 implementation; never a validated winner, policy optimization, efficacy, human learning, or deployment.',
      decisionContract: pilotConfig.stage_contract.s1_canonical_sensor_pilot.decision_contract,
    },
    metadata: {
      stage: 's1_canonical_sensor_pilot',
      instrumentVersion: '2.3',
      observationChannelVersion: '2.3',
      paid: false,
      expectedModelCalls: 0,
      parentReportSha256: parent.report_sha256,
      parentDatasetSha256: parent.dataset_sha256,
    },
  });
}

async function main(argv = process.argv.slice(2)) {
  if (has(argv, 'help')) {
    process.stdout.write(usage());
    return;
  }
  const parentRunDir = resolveFromRoot(arg(argv, 'parent', DEFAULT_PARENT));
  const baseConfigPath = resolveFromRoot(arg(argv, 'base-config', DEFAULT_BASE_CONFIG));
  const pilotConfigPath = resolveFromRoot(arg(argv, 'pilot-config', DEFAULT_PILOT_CONFIG));
  const outRoot = resolveFromRoot(arg(argv, 'out', DEFAULT_OUT));
  const label = arg(argv, 'label', 'adaptive-state-v2-s1-canonical-pilot-v23');
  const runSeed = Number(arg(argv, 'run-seed', '20260712'));
  if (!Number.isSafeInteger(runSeed)) throw new Error('--run-seed must be a safe integer');
  const git = captureGitFingerprint({ repoRoot: ROOT });
  if (git.dirty || git.untracked.length) {
    throw new Error('Canonical pilot requires a clean committed Git worktree');
  }
  const baseConfig = yaml.parse(fs.readFileSync(baseConfigPath, 'utf8'));
  const pilotConfig = yaml.parse(fs.readFileSync(pilotConfigPath, 'utf8'));
  const contract = validateAdaptiveStateCanonicalPilotContract(pilotConfig);
  const parent = validateExactChannelParent({ parentRunDir, baseConfig, baseConfigPath });
  const runPlan = executionRunPlan({
    label,
    runSeed,
    parent,
    baseConfigPath,
    pilotConfigPath,
    pilotConfig,
  });
  if (has(argv, 'dry-run')) {
    process.stdout.write(`dry-run pass: ${parent.run_id} -> ${label}; zero model calls; no artifacts written\n`);
    process.stdout.write(`decision contract ${hashCanonicalJson(contract)}\n`);
    process.stdout.write(`run plan ${hashCanonicalJson(runPlan)}\n`);
    return;
  }

  const runDir = path.join(outRoot, label);
  createRunPlan(runDir, runPlan);
  writeExclusive(
    path.join(runDir, 'pilot-contract.json'),
    canonicalJson(contract, { space: 2, trailingNewline: true }),
  );
  writeExclusive(
    path.join(runDir, 'parent-verification.json'),
    canonicalJson(parent, { space: 2, trailingNewline: true }),
  );
  appendRunEvent(runDir, {
    type: 'canonical_sensor_pilot_started',
    expectedModelCalls: 0,
    parentRunId: parent.run_id,
    parentDatasetSha256: parent.dataset_sha256,
  });

  const dataset = loadAdaptiveStateStage0Dataset(parentRunDir);
  const splitManifest = readJson(path.join(parentRunDir, 'split-manifest.json'));
  validateAdaptiveStateStage0SplitManifestContentSha256(splitManifest);
  const criticalPlan = readJson(path.join(parentRunDir, 'critical-path-plan.json'));
  const predictions = buildAdaptiveStateCanonicalPilotPredictions({
    dataset,
    splitManifest,
    baseConfig,
  });
  const report = buildAdaptiveStateCanonicalPilotReport({
    dataset,
    splitManifest,
    predictions,
    plan: criticalPlan,
    baseConfig,
    pilotConfig,
    parent,
    provenance: {
      git_commit: git.sha,
      git_dirty: false,
      prediction_sha256: predictions.content_sha256,
      split_manifest_sha256: splitManifest.content_sha256,
      parent_dataset_sha256: dataset.content_sha256,
    },
  });
  writeExclusive(
    path.join(runDir, 'canonical-pilot-predictions.json'),
    canonicalJson(predictions, { space: 2, trailingNewline: true }),
  );
  writeExclusive(
    path.join(runDir, 'canonical-pilot-report.json'),
    canonicalJson(report, { space: 2, trailingNewline: true }),
  );
  writeExclusive(path.join(runDir, 'canonical-pilot-report.md'), renderAdaptiveStateCanonicalPilotReport(report));
  appendRunEvent(runDir, {
    type: 'canonical_sensor_pilot_evaluated',
    status: report.status,
    decision: report.decision,
    confirmationCandidate: report.confirmation_candidate,
    validatedWinner: null,
    policyOptimizationAuthorized: false,
    executedModelCalls: 0,
    predictionsSha256: predictions.content_sha256,
    reportSha256: report.content_sha256,
  });
  createRunSeal(runDir, {
    status: report.status === 'pass' ? 'complete' : 'stopped',
    metadata: {
      stage: 's1_canonical_sensor_pilot',
      decision: report.decision,
      confirmationCandidate: report.confirmation_candidate,
      validatedWinner: null,
      policyOptimizationAuthorized: false,
      executedModelCalls: 0,
      parentRunId: parent.run_id,
      predictionsSha256: predictions.content_sha256,
      reportSha256: report.content_sha256,
    },
  });
  const verification = assertExperimentRun(runDir);
  process.stdout.write(
    `${report.status}: ${report.decision}; candidate=${report.confirmation_candidate || 'none'}; 0 model calls\n`,
  );
  process.stdout.write(`${path.relative(ROOT, runDir)}\n`);
  process.stdout.write(`sealed evidence transaction verified: ${verification.inventory.length} artifacts\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  });
}
