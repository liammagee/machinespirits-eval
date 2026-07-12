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
} from '../services/experimentRunArtifacts.js';
import {
  buildAdaptiveStateCriticalPathPlan,
  validateAdaptiveStateCriticalPathPlan,
} from '../services/adaptiveTutor/stateBenchmarkV2.js';
import {
  adaptiveStateStage1DatasetContentSha256,
  executeAdaptiveStateStage1,
  validateAdaptiveStateStage1DatasetContentSha256,
  validateAdaptiveStateStage1Parent,
} from '../services/adaptiveTutor/stateBenchmarkStage1Executor.js';
import {
  buildAdaptiveStateStage1Report,
  buildAdaptiveStateStage1SplitManifest,
  validateAdaptiveStateStage1ReportContentSha256,
  validateAdaptiveStateStage1SplitManifestContentSha256,
} from '../services/adaptiveTutor/stateBenchmarkStage1Analysis.js';
import { createAdaptiveStateStage1ProductionLiveSeams } from '../services/adaptiveTutor/stateBenchmarkStage1LiveAdapters.js';
import {
  adaptiveStateStage1StaticExecutionContract,
  cliFingerprint,
} from '../services/adaptiveTutor/stateBenchmarkStage1Contracts.js';
import { validateAdaptiveStateObservabilityReliabilityV22Parent } from '../services/adaptiveTutor/stateObservabilityReliabilityV22Lineage.js';

export {
  adaptiveStateStage1StaticExecutionContract,
  cliFingerprint,
} from '../services/adaptiveTutor/stateBenchmarkStage1Contracts.js';

const SCRIPT = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT), '..');
const DEFAULT_CONFIG = path.join(ROOT, 'config', 'adaptive-state-benchmark-v2.yaml');
const DEFAULT_RELIABILITY_CONFIG = path.join(
  ROOT,
  'config',
  'adaptive-state-observability-reliability-v2.2.yaml',
);
const DEFAULT_OUT = path.join(ROOT, 'exports', 'adaptive-state-benchmark-v2');

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
  return `Usage: node scripts/execute-adaptive-state-benchmark-v2-s1.js [options]

Executes the serial paid S1 technical pilot. This command makes 339 CLI
process dispatches: 336 matrix dispatches plus three excluded canaries.

Required:
  --s0-parent <dir>             Fresh sealed passing benchmark-v2.1 S0 run
  --preflight-parent <dir>      Sealed passing v2.2 repeated-draw reliability gate
  --confirm-paid-s1-v2.1        Explicit paid-execution acknowledgement

Options:
  --supersedes-stopped-s1 <dir>  Sealed stopped v2.1 S1 replaced by this run
  --label <id>                  Default: adaptive-state-v2-s1-technical-pilot
  --run-seed <n>                Artifact job-order seed. Default: 20260712
  --config <path>               Default: config/adaptive-state-benchmark-v2.yaml
  --reliability-config <path>   Default: config/adaptive-state-observability-reliability-v2.2.yaml
  --out <dir>                   Default: exports/adaptive-state-benchmark-v2
  --help                        Show this help
`;
}

function writeExclusive(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  try {
    fs.writeFileSync(filePath, content, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error(`Refusing to overwrite immutable S1 artifact at ${filePath}`);
    throw error;
  }
  return { path: filePath, bytes: Buffer.byteLength(content), sha256: sha256(content) };
}

function jsonl(rows) {
  return `${rows.map((row) => canonicalJson(row)).join('\n')}\n`;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function stage1MatrixContract(plan) {
  return {
    version: plan.version,
    stage: plan.stage,
    paid: plan.paid,
    axes: plan.axes,
    counts: plan.counts,
    jobs: plan.jobs,
  };
}

function stage1SemanticDesignContract(plan) {
  const contract = JSON.parse(JSON.stringify(plan));
  delete contract.label;
  delete contract.design_sha256;
  return contract;
}

export function validateAdaptiveStateStage1SupersededStoppedRun({
  supersededRunDir,
  replacementPlan,
  replacementParent,
  configPath,
} = {}) {
  if (!supersededRunDir || !replacementPlan || !replacementParent || !configPath) {
    throw new Error('S1 supersedes validation requires a stopped run, replacement plan, S0 parent, and config path');
  }
  const runDir = path.resolve(supersededRunDir);
  const verification = assertExperimentRun(runDir);
  const sealedPlan = verification.plan;
  if (
    verification.seal?.status !== 'stopped' ||
    sealedPlan?.runner !== 'scripts/execute-adaptive-state-benchmark-v2-s1.js' ||
    sealedPlan?.metadata?.stage !== 's1_technical_pilot' ||
    String(sealedPlan?.metadata?.benchmarkVersion) !== '2.1' ||
    sealedPlan?.metadata?.paid !== true
  ) {
    throw new Error('S1 supersedes source must be a sealed stopped paid v2.1 S1 technical pilot, never a completed run');
  }
  const criticalPlan = readJson(path.join(runDir, 'critical-path-plan.json'));
  validateAdaptiveStateCriticalPathPlan(criticalPlan);
  const report = readJson(path.join(runDir, 'stage1-technical-report.json'));
  validateAdaptiveStateStage1ReportContentSha256(report);
  if (
    criticalPlan.label !== sealedPlan.runId ||
    sealedPlan.metadata?.designSha256 !== criticalPlan.design_sha256 ||
    hashCanonicalJson(sealedPlan.intent?.criticalPath) !== hashCanonicalJson(criticalPlan) ||
    verification.seal.metadata?.runPlanSha256 !== verification.seal.planSha256 ||
    verification.seal.metadata?.stage1ReportSha256 !== report.content_sha256 ||
    report.status !== 'stop' ||
    report.decision !== 'stop_and_repair_s1' ||
    verification.seal.metadata?.decision !== 'stop_and_repair_s1'
  ) {
    throw new Error('S1 supersedes source must carry a stopped, non-passing stop_and_repair_s1 verdict');
  }
  if (
    sealedPlan.lineage?.parentRunId !== replacementParent.run_id ||
    sealedPlan.metadata?.parentS0ReportSha256 !== replacementParent.report_sha256
  ) {
    throw new Error('S1 supersedes source does not share the replacement run\'s sealed S0 parent');
  }
  if (
    hashCanonicalJson(stage1SemanticDesignContract(criticalPlan)) !==
      hashCanonicalJson(stage1SemanticDesignContract(replacementPlan)) ||
    criticalPlan.config_sha256 !== replacementPlan.config_sha256 ||
    sealedPlan.hashes?.config !== hashFile(path.resolve(configPath)) ||
    hashCanonicalJson(stage1MatrixContract(criticalPlan)) !==
      hashCanonicalJson(stage1MatrixContract(replacementPlan))
  ) {
    throw new Error('S1 supersedes source does not share the replacement v2.1 design, config, and exact matrix');
  }
  if (sealedPlan.runId === replacementPlan.label) {
    throw new Error('S1 replacement must use a new label instead of overwriting the stopped run');
  }
  return {
    run_id: sealedPlan.runId,
    run_dir: runDir,
    plan_sha256: verification.seal.planSha256,
    seal_inventory_sha256: verification.seal.inventorySha256,
    report_sha256: report.content_sha256,
  };
}

export function executionRunPlan({
  plan,
  config,
  configPath,
  parent,
  preflight = null,
  runSeed,
  cliVersions,
  supersedes = [],
}) {
  const git = captureGitFingerprint({ repoRoot: ROOT });
  delete git.repoRoot;
  const realizer = Object.fromEntries(config.critical_path.language_realizers.map((row) => [row.id, row]));
  const runtime = config.paid_execution_contract.realizer_runtime;
  const analyzer = config.paid_execution_contract.public_turn_analyzer;
  const staticContract = adaptiveStateStage1StaticExecutionContract({ config, configPath, repoRoot: ROOT });
  return buildExperimentRunPlan({
    runId: plan.label,
    runner: path.relative(ROOT, SCRIPT),
    provenance: { git },
    models: {
      codex_realizer: {
        requested: realizer.codex_terra.model_ref,
        resolved: runtime.codex_terra.expected_cli_model_label,
        observed: null,
        allowedObservedModels: [runtime.codex_terra.expected_cli_model_label],
      },
      claude_realizer: {
        requested: realizer.claude_sonnet.model_ref,
        resolved: runtime.claude_sonnet.expected_cli_model_label,
        observed: null,
        allowedObservedModels: [runtime.claude_sonnet.expected_cli_model_label],
      },
      public_turn_analyzer: {
        requested: analyzer.model_ref,
        resolved: analyzer.expected_cli_model_label,
        observed: null,
        allowedObservedModels: [analyzer.expected_cli_model_label],
      },
    },
    // Partial fail-closed seals can stop before all three roles are observed;
    // the complete report separately requires every exact ledger role/count.
    requiredObservedModelRoles: [],
    hashes: staticContract.hashes,
    masterSeed: runSeed,
    jobs: plan.jobs,
    lineage: { parentRunId: parent.run_id, resumeOf: null, supersedes },
    intent: {
      criticalPath: plan,
      claimBoundary: config.claim_boundary,
      executionBoundary:
        'S1 technical observation only. No S2 sensor verdict, tutor efficacy, human learning, or deployment claim.',
    },
    metadata: {
      benchmarkSchema: config.schema,
      benchmarkVersion: config.version,
      stage: 's1_technical_pilot',
      paid: true,
      expectedScoredCliDispatches: 336,
      excludedTechnicalCanaryCliDispatches: 3,
      backendRequestCount: 'unknown',
      cliVersions,
      cliFingerprintsSha256: hashCanonicalJson(cliVersions),
      staticExecutionContract: staticContract.call_contract,
      s1RelevantHashesSha256: hashCanonicalJson(staticContract.hashes),
      downstreamCurrentRepoShaEqualityRequired: false,
      designSha256: plan.design_sha256,
      parentS0ReportSha256: parent.report_sha256,
      observabilityPreflight: preflight ? JSON.parse(JSON.stringify(preflight)) : null,
    },
  });
}

function renderReport(report) {
  return [
    '# Adaptive learner-state benchmark v2.1 — S1 technical pilot',
    '',
    `Status: **${report.status}**`,
    `Decision: \`${report.decision}\``,
    '',
    `- realized dialogues: ${report.coverage.realized_dialogues}`,
    `- independent latent clusters: ${report.coverage.independent_latent_clusters}`,
    `- scored CLI dispatches: ${report.coverage.scored_cli_dispatches}`,
    `- excluded technical canary dispatches: ${report.coverage.excluded_technical_canary_calls}`,
    `- backend request count: ${report.coverage.backend_request_count}`,
    `- analyzer exact family recovery: ${report.structural_audit.public_analyzer_event_family_recovery.overall.toFixed(3)}`,
    '',
    '- S2 prerequisite size, if authorized: fixed eight seeds per crossed cell (no power claim)',
    '',
    '> S1 cannot emit the S2 learner-state validity verdict. This benchmark sensor is the canonical policy-invariant no-memory/no-register profile; live-default equivalence is not claimed.',
    '',
    `Report SHA-256: \`${report.content_sha256}\``,
    '',
  ].join('\n');
}

async function main(argv = process.argv.slice(2)) {
  if (has(argv, 'help')) {
    process.stdout.write(usage());
    return;
  }
  if (!has(argv, 'confirm-paid-s1-v2.1')) {
    throw new Error('Paid S1 is locked; pass --confirm-paid-s1-v2.1 after reviewing the 339-dispatch contract');
  }
  const parentArg = arg(argv, 's0-parent');
  const preflightArg = arg(argv, 'preflight-parent');
  if (!parentArg) throw new Error('--s0-parent is required');
  if (!preflightArg) throw new Error('--preflight-parent is required; full S1 cannot bypass the sealed v2.2 observability reliability gate');
  const parentRunDir = resolveFromRoot(parentArg);
  const configPath = resolveFromRoot(arg(argv, 'config', DEFAULT_CONFIG));
  const reliabilityConfigPath = resolveFromRoot(
    arg(argv, 'reliability-config', DEFAULT_RELIABILITY_CONFIG),
  );
  const outRoot = resolveFromRoot(arg(argv, 'out', DEFAULT_OUT));
  const supersededArg = arg(argv, 'supersedes-stopped-s1');
  const label = arg(argv, 'label', 'adaptive-state-v2-s1-technical-pilot');
  const runSeed = Number(arg(argv, 'run-seed', '20260712'));
  if (!Number.isSafeInteger(runSeed)) throw new Error('--run-seed must be a safe integer');
  const config = yaml.parse(fs.readFileSync(configPath, 'utf8'));
  const reliabilityConfig = yaml.parse(fs.readFileSync(reliabilityConfigPath, 'utf8'));
  const cleanGit = captureGitFingerprint({ repoRoot: ROOT });
  if (cleanGit.dirty || cleanGit.untracked.length) {
    throw new Error('Paid S1 requires a clean committed Git worktree with no untracked critical files');
  }
  const parent = validateAdaptiveStateStage1Parent({ parentRunDir, config, configPath, repoRoot: ROOT });
  const preflight = validateAdaptiveStateObservabilityReliabilityV22Parent({
    reliabilityRunDir: resolveFromRoot(preflightArg),
    s0Parent: parent,
    benchmarkConfig: config,
    benchmarkConfigPath: configPath,
    reliabilityConfig,
    reliabilityConfigPath,
    repoRoot: ROOT,
  });
  const plan = buildAdaptiveStateCriticalPathPlan(config, { stage: 's1_technical_pilot', label });
  validateAdaptiveStateCriticalPathPlan(plan);
  const superseded = supersededArg
    ? validateAdaptiveStateStage1SupersededStoppedRun({
        supersededRunDir: resolveFromRoot(supersededArg),
        replacementPlan: plan,
        replacementParent: parent,
        configPath,
      })
    : null;
  const runDir = path.join(outRoot, label);
  const cliVersions = {
    codex: cliFingerprint('codex', { repoRoot: ROOT }),
    claude: cliFingerprint('claude', { repoRoot: ROOT }),
  };
  const runPlan = executionRunPlan({
    plan,
    config,
    configPath,
    parent,
    preflight,
    runSeed,
    cliVersions,
    supersedes: superseded ? [superseded.run_id] : [],
  });
  const created = createRunPlan(runDir, runPlan);
  writeExclusive(path.join(runDir, 'critical-path-plan.json'), canonicalJson(plan, { space: 2, trailingNewline: true }));
  appendRunEvent(runDir, {
    type: 'stage1_execution_started',
    plannedScoredCliDispatches: 336,
    plannedExcludedCanaryCliDispatches: 3,
    executionOrder: 'serial_dialogues_and_turns',
    backendRequestCount: 'unknown',
    observabilityPreflightRunId: preflight.run_id,
    observabilityPreflightReportSha256: preflight.report_sha256,
  });

  const abortController = new AbortController();
  let interruption = null;
  const requestAbort = (signal, exitCode) => {
    if (interruption) return;
    interruption = { signal, exitCode };
    process.exitCode = exitCode;
    appendRunEvent(runDir, {
      type: 'stage1_abort_requested',
      signal,
      activeCliChildKillRequested: true,
      disposition: 'stopped_indeterminate_never_resume_same_label',
      backendRequestCount: 'unknown',
    });
    // cliProviderBridge binds this signal to the active child process and
    // sends SIGKILL before rejecting. We deliberately do not seal or exit in
    // this handler: the awaited call must emit call_finished and the executor
    // must persist exact partial accounting first.
    abortController.abort(new Error(`S1 interrupted by ${signal}`));
  };
  const onSigint = () => requestAbort('SIGINT', 130);
  const onSigterm = () => requestAbort('SIGTERM', 143);
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);
  const assertNotInterrupted = () => {
    if (interruption) throw new Error(`S1 interrupted by ${interruption.signal}`);
  };

  const observedRoles = new Set();
  const appendLifecycle = async (event) => appendRunEvent(runDir, event);
  const onCall = async (call) => {
    appendRunEvent(runDir, {
      type: 'stage1_call_recorded',
      callId: call.id,
      role: call.role,
      status: call.status,
      matrixScoredCall: call.matrix_scored_call,
      excludedTechnicalCanary: call.excluded_technical_canary,
      dispatchCount: call.provenance.dispatch_count,
      callSha256: hashCanonicalJson(call),
    });
    if (call.status === 'success' && !observedRoles.has(call.role)) {
      observedRoles.add(call.role);
      appendRunEvent(runDir, {
        type: 'model_observed',
        role: call.role,
        requested: call.provenance.requested_model_ref,
        resolved: call.provenance.resolved_model_ref,
        observed: call.provenance.observed_model_ref,
        attestationBasis: call.provenance.model_attestation_basis,
        independentlyAttested: false,
      });
    }
  };

  let dataset;
  try {
    const seams = createAdaptiveStateStage1ProductionLiveSeams({
      config,
      onReached: appendLifecycle,
      onDispatch: appendLifecycle,
      onFinished: appendLifecycle,
      signal: abortController.signal,
    });
    dataset = await executeAdaptiveStateStage1({
      plan,
      config,
      parent,
      parentRunDir,
      configPath,
      ...seams,
      onCall,
      repoRoot: ROOT,
    });
    assertNotInterrupted();
    // Only this canonical runner binds a pure executor result to the immutable
    // paid transaction. Injected seams can exercise the core but cannot mint
    // paid status or a promotable report.
    dataset.execution_mode = 'paid_cli';
    dataset.execution_transaction = {
      run_id: runPlan.runId,
      run_plan_sha256: created.sha256,
      s1_relevant_hashes_sha256: hashCanonicalJson(runPlan.hashes),
      cli_fingerprints_sha256: hashCanonicalJson(cliVersions),
      historical_clean_git_fingerprint_sha256: runPlan.provenance.git.fingerprintSha256,
      downstream_current_repo_sha_equality_required: false,
    };
    dataset.content_sha256 = adaptiveStateStage1DatasetContentSha256(dataset);
  } catch (error) {
    const partial = error.stage1Partial || {
      call_accounting: {
        planned: 339,
        reached: 0,
        dispatched: 0,
        completed: 0,
        failed: 0,
        by_role_and_scope: {},
      },
      calls: [],
      completed_dialogues: [],
    };
    writeExclusive(
      path.join(runDir, 'stage1-partial-call-ledger.jsonl'),
      jsonl(partial.calls),
    );
    writeExclusive(
      path.join(runDir, 'stage1-partial-accounting.json'),
      canonicalJson(partial, { space: 2, trailingNewline: true }),
    );
    appendRunEvent(runDir, {
      type: 'stage1_execution_stopped',
      error: error.message,
      callAccounting: partial.call_accounting,
    });
    if (interruption) {
      appendRunEvent(runDir, {
        type: 'stage1_process_interrupted',
        signal: interruption.signal,
        disposition: 'stopped_indeterminate_never_resume_same_label',
        wrapperFinishObservedBeforeSeal: true,
        cliChildTerminationNotIndependentlyAttested: true,
        possibleOrphanCliOrBackendRequestNotExcluded: true,
        backendRequestCount: 'unknown',
      });
    }
    createRunSeal(runDir, {
      status: 'stopped',
      metadata: {
        stage: 's1_technical_pilot',
        reason: error.message,
        callAccounting: partial.call_accounting,
        backendRequestCount: 'unknown',
        ...(interruption
          ? {
              interruptedBySignal: interruption.signal,
              disposition: 'indeterminate_never_resume_same_label',
              activeCliChildKillRequested: true,
              wrapperFinishObservedBeforeSeal: true,
              cliChildTerminationNotIndependentlyAttested: true,
              possibleOrphanCliOrBackendRequestNotExcluded: true,
            }
          : {}),
      },
    });
    assertExperimentRun(runDir);
    if (interruption) error.exitCode = interruption.exitCode;
    throw error;
  }

  try {
    assertNotInterrupted();
    validateAdaptiveStateStage1DatasetContentSha256(dataset);
    const datasetFile = writeExclusive(
    path.join(runDir, 'stage1-dataset.json'),
    canonicalJson(dataset, { space: 2, trailingNewline: true }),
  );
    const ledgerFile = writeExclusive(path.join(runDir, 'stage1-call-ledger.jsonl'), jsonl(dataset.calls));
    const readback = JSON.parse(fs.readFileSync(datasetFile.path, 'utf8'));
    validateAdaptiveStateStage1DatasetContentSha256(readback);
    const ledgerReadback = fs
    .readFileSync(ledgerFile.path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
    if (hashCanonicalJson(ledgerReadback) !== hashCanonicalJson(dataset.calls)) {
      throw new Error('S1 call-ledger readback differs from the dataset');
    }
    const splitManifest = buildAdaptiveStateStage1SplitManifest(dataset.rows, config);
    validateAdaptiveStateStage1SplitManifestContentSha256(splitManifest);
    writeExclusive(
    path.join(runDir, 'stage1-split-manifest.json'),
    canonicalJson(splitManifest, { space: 2, trailingNewline: true }),
  );
    const report = buildAdaptiveStateStage1Report({
    dataset,
    plan,
    config,
    splitManifest,
    repoRoot: ROOT,
  });
    validateAdaptiveStateStage1ReportContentSha256(report);
    writeExclusive(
    path.join(runDir, 'stage1-technical-report.json'),
    canonicalJson(report, { space: 2, trailingNewline: true }),
  );
    writeExclusive(path.join(runDir, 'stage1-technical-report.md'), renderReport(report));
    appendRunEvent(runDir, {
    type: 'stage1_technical_evaluated',
    status: report.status,
    decision: report.decision,
    scoredCliDispatches: dataset.scored_cli_dispatch_count,
    excludedTechnicalCanaryCliDispatches: dataset.excluded_technical_canary_call_count,
    reportSha256: report.content_sha256,
  });
    const complete = report.status === 'pass';
    createRunSeal(runDir, {
    status: complete ? 'complete' : 'stopped',
    metadata: {
      stage: 's1_technical_pilot',
      stage1DatasetSha256: dataset.content_sha256,
      stage1CallLedgerSha256: hashCanonicalJson(dataset.calls),
      stage1SplitManifestSha256: splitManifest.content_sha256,
      stage1ReportSha256: report.content_sha256,
      runPlanSha256: created.sha256,
      s1RelevantHashes: runPlan.hashes,
      s1RelevantHashesSha256: hashCanonicalJson(runPlan.hashes),
      cliFingerprints: cliVersions,
      cliFingerprintsSha256: hashCanonicalJson(cliVersions),
      historicalCleanGitAttestation: {
        sha: runPlan.provenance.git.sha,
        branch: runPlan.provenance.git.branch,
        dirty: runPlan.provenance.git.dirty,
        untracked: runPlan.provenance.git.untracked,
        fingerprintSha256: runPlan.provenance.git.fingerprintSha256,
        cleanAtS1Execution: runPlan.provenance.git.dirty === false && runPlan.provenance.git.untracked.length === 0,
        downstreamCurrentRepoShaEqualityRequired: false,
      },
      executedCliDispatches: dataset.total_cli_dispatch_count,
      scoredCliDispatches: dataset.scored_cli_dispatch_count,
      backendRequestCount: 'unknown',
      fixedS2SeedsPerCell: 8,
      powerClaimMade: false,
      decision: report.decision,
      observabilityPreflightRunId: preflight.run_id,
      observabilityPreflightReportSha256: preflight.report_sha256,
    },
  });
    const verified = assertExperimentRun(runDir);
    process.stdout.write(
    `${complete ? 'complete' : 'stopped'}: 24 dialogues, 144 transitions, 336 scored + 3 excluded CLI dispatches\n`,
  );
    process.stdout.write(`${path.relative(ROOT, runDir)}\n`);
    process.stdout.write(`sealed S1 evidence transaction verified: ${verified.inventory.length} artifacts\n`);
    if (!complete) process.exitCode = 2;
  } catch (error) {
    if (!fs.existsSync(path.join(runDir, 'run-seal.json'))) {
      appendRunEvent(runDir, {
        type: 'stage1_evaluation_stopped',
        error: error.message,
        executedCliDispatches: dataset.total_cli_dispatch_count,
      });
      createRunSeal(runDir, {
        status: 'stopped',
        metadata: {
          stage: 's1_technical_pilot',
          reason: error.message,
          executedCliDispatches: dataset.total_cli_dispatch_count,
          scoredCliDispatches: dataset.scored_cli_dispatch_count,
          backendRequestCount: 'unknown',
        },
      });
      assertExperimentRun(runDir);
    }
    if (interruption) error.exitCode = interruption.exitCode;
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : process.exitCode || 1;
  });
}
