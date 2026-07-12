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
  sha256,
} from '../services/experimentRunArtifacts.js';
import { validateAdaptiveStateStage1Parent } from '../services/adaptiveTutor/stateBenchmarkStage1Executor.js';
import { createAdaptiveStateStage1ProductionLiveSeams } from '../services/adaptiveTutor/stateBenchmarkStage1LiveAdapters.js';
import {
  adaptiveStateStage1StaticExecutionContract,
  cliFingerprint,
} from '../services/adaptiveTutor/stateBenchmarkStage1Contracts.js';
import {
  adaptiveStateObservabilityReliabilityCallRows,
  adaptiveStateObservabilityReliabilityResultContentSha256,
  buildAdaptiveStateObservabilityReliabilityPlan,
  buildAdaptiveStateObservabilityReliabilityReport,
  executeAdaptiveStateObservabilityReliability,
  validateAdaptiveStateObservabilityReliabilityReport,
  validateAdaptiveStateObservabilityReliabilityResult,
} from '../services/adaptiveTutor/stateObservabilityReliabilityV22.js';
import { adaptiveStateObservabilityReliabilityV22StaticExecutionContract } from '../services/adaptiveTutor/stateObservabilityReliabilityV22Contracts.js';
import { validateAdaptiveStateStoppedObservabilityPreflightV21 } from '../services/adaptiveTutor/stateObservabilityReliabilityV22Lineage.js';

const SCRIPT = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT), '..');
const DEFAULT_BENCHMARK_CONFIG = path.join(ROOT, 'config', 'adaptive-state-benchmark-v2.yaml');
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
  return `Usage: node scripts/execute-adaptive-state-observability-reliability-v22.js [options]

Executes the prospectively frozen v2.2 repeated-draw observability gate:
24 base cells x 3 fresh draws = 72 cases, with one realizer and one analyzer
call per case = 144 serial CLI dispatches. Every draw is retained. This command
never launches full S1 automatically.

Required:
  --s0-parent <dir>                         Sealed passing current-contract S0
  --diagnoses-stopped-preflight <dir>       Sealed stopped 23/24 v2.1 preflight
  --confirm-paid-observability-reliability-v2.2

Options:
  --label <id>                 Default: adaptive-state-v2-observability-reliability-v22
  --run-seed <n>               Artifact seed; draw order is fixed. Default: 20260712
  --benchmark-config <path>    Default: config/adaptive-state-benchmark-v2.yaml
  --reliability-config <path>  Default: config/adaptive-state-observability-reliability-v2.2.yaml
  --out <dir>                  Default: exports/adaptive-state-benchmark-v2
  --dry-run                    Validate lineage and print the frozen plan; no writes or calls
  --help                       Show this help
`;
}

function writeExclusive(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  try {
    fs.writeFileSync(filePath, content, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new Error(`Refusing to overwrite immutable reliability artifact at ${filePath}`);
    }
    throw error;
  }
  return { path: filePath, bytes: Buffer.byteLength(content), sha256: sha256(content) };
}

function jsonl(rows) {
  return `${rows.map((row) => canonicalJson(row)).join('\n')}\n`;
}

function executionRunPlan({
  plan,
  benchmarkConfig,
  benchmarkConfigPath,
  reliabilityConfig,
  reliabilityConfigPath,
  s0Parent,
  stoppedPreflight,
  runSeed,
  cliFingerprints,
}) {
  const git = captureGitFingerprint({ repoRoot: ROOT });
  delete git.repoRoot;
  const realizers = Object.fromEntries(
    benchmarkConfig.critical_path.language_realizers.map((row) => [row.id, row]),
  );
  const runtime = benchmarkConfig.paid_execution_contract.realizer_runtime;
  const analyzer = benchmarkConfig.paid_execution_contract.public_turn_analyzer;
  const s1Contract = adaptiveStateStage1StaticExecutionContract({
    config: benchmarkConfig,
    configPath: benchmarkConfigPath,
    repoRoot: ROOT,
  });
  return buildExperimentRunPlan({
    runId: plan.label,
    runner: path.relative(ROOT, SCRIPT),
    provenance: { git },
    models: {
      codex_realizer: {
        requested: realizers.codex_terra.model_ref,
        resolved: runtime.codex_terra.expected_cli_model_label,
        observed: null,
        allowedObservedModels: [runtime.codex_terra.expected_cli_model_label],
      },
      claude_realizer: {
        requested: realizers.claude_sonnet.model_ref,
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
    requiredObservedModelRoles: [],
    hashes: adaptiveStateObservabilityReliabilityV22StaticExecutionContract({
      benchmarkConfig,
      benchmarkConfigPath,
      reliabilityConfig,
      reliabilityConfigPath,
      repoRoot: ROOT,
    }),
    masterSeed: runSeed,
    jobs: plan.jobs,
    lineage: { parentRunId: stoppedPreflight.run_id, resumeOf: null, supersedes: [] },
    intent: {
      observabilityReliability: plan,
      claimBoundary:
        'Claim-ineligible combined realizer/analyzer reliability gate only; no sensor, policy, efficacy, human-learning, or deployment claim.',
      escalationBoundary:
        'A pass may authorize a separately invoked full S1 retry. This runner never launches S1 automatically.',
    },
    metadata: {
      benchmarkSchema: benchmarkConfig.schema,
      benchmarkVersion: benchmarkConfig.version,
      reliabilitySchema: reliabilityConfig.schema,
      reliabilityVersion: reliabilityConfig.version,
      stage: 's1_observability_reliability_gate',
      paid: true,
      claimEligible: false,
      expectedCliDispatches: 144,
      backendRequestCount: 'unknown',
      s0ParentRunId: s0Parent.run_id,
      s0ParentPlanSha256: s0Parent.plan_sha256,
      s0ParentSealInventorySha256: s0Parent.seal_inventory_sha256,
      s0ConfigSha256: s0Parent.config_sha256,
      diagnosesStoppedPreflightRunId: stoppedPreflight.run_id,
      diagnosesStoppedPreflightPlanSha256: stoppedPreflight.plan_sha256,
      diagnosesStoppedPreflightSealInventorySha256: stoppedPreflight.seal_inventory_sha256,
      diagnosesStoppedPreflightReportSha256: stoppedPreflight.report_sha256,
      diagnosesStoppedS1RunId: stoppedPreflight.diagnoses_stopped_s1_run_id,
      cliFingerprints,
      cliFingerprintsSha256: hashCanonicalJson(cliFingerprints),
      s1RelevantHashes: s1Contract.hashes,
      s1RelevantHashesSha256: hashCanonicalJson(s1Contract.hashes),
      reliabilityPlanSha256: plan.content_sha256,
      retries: 0,
      semanticRerolls: 0,
      repairs: 0,
      fallbacks: 0,
      exclusions: 0,
      partialReuse: false,
      priorPreflightRowsReused: false,
    },
  });
}

function renderReport(report) {
  const failedChecks = Object.entries(report.gate_checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  return [
    '# Adaptive learner-state benchmark — observability reliability gate v2.2',
    '',
    `Status: **${report.status}**`,
    `Decision: \`${report.decision}\``,
    '',
    `- completed cases: ${report.coverage.completed_cases}/72`,
    `- exact intended-family recovery: ${report.coverage.exact_family_matches}/72`,
    `- serial CLI dispatches: ${report.coverage.cli_dispatches}/144`,
    '- backend request count: unknown',
    '- retries, semantic rerolls, repairs, fallbacks, exclusions, prior-row reuse: 0',
    '',
    ...(failedChecks.length ? ['## Failed gate checks', '', ...failedChecks.map((name) => `- ${name}`), ''] : []),
    ...(report.failures.length
      ? [
          '## Failed draws',
          '',
          ...report.failures.map(
            (row) => `- ${row.id}: ${row.intended_family} -> ${row.observed_family}`,
          ),
          '',
        ]
      : []),
    '> This reliability gate is claim-ineligible. A pass authorizes only a separately invoked full S1 technical pilot; it is not a learner-state validity or tutoring result.',
    '',
    `Report SHA-256: \`${report.content_sha256}\``,
    '',
  ].join('\n');
}

function remapLifecycle(event, { drawId, drawIndex, callOffset }) {
  const childIndex = Number(event.callIndex || String(event.callId || '').replace(/^preflight-call-/u, ''));
  const parentIndex = callOffset + childIndex;
  return {
    ...event,
    drawId,
    drawIndex,
    childCallId: event.callId,
    childCallIndex: childIndex,
    callId: `reliability-call-${String(parentIndex).padStart(3, '0')}`,
    callIndex: parentIndex,
  };
}

async function main(argv = process.argv.slice(2)) {
  if (has(argv, 'help')) {
    process.stdout.write(usage());
    return;
  }
  const dryRun = has(argv, 'dry-run');
  if (!dryRun && !has(argv, 'confirm-paid-observability-reliability-v2.2')) {
    throw new Error(
      'Paid reliability gate is locked; pass --confirm-paid-observability-reliability-v2.2 after reviewing the exact 72-case/144-dispatch contract',
    );
  }
  const s0Arg = arg(argv, 's0-parent');
  const stoppedArg = arg(argv, 'diagnoses-stopped-preflight');
  if (!s0Arg) throw new Error('--s0-parent is required');
  if (!stoppedArg) throw new Error('--diagnoses-stopped-preflight is required');
  const benchmarkConfigPath = resolveFromRoot(
    arg(argv, 'benchmark-config', DEFAULT_BENCHMARK_CONFIG),
  );
  const reliabilityConfigPath = resolveFromRoot(
    arg(argv, 'reliability-config', DEFAULT_RELIABILITY_CONFIG),
  );
  const outRoot = resolveFromRoot(arg(argv, 'out', DEFAULT_OUT));
  const label = arg(argv, 'label', 'adaptive-state-v2-observability-reliability-v22');
  const runSeed = Number(arg(argv, 'run-seed', '20260712'));
  if (!Number.isSafeInteger(runSeed)) throw new Error('--run-seed must be a safe integer');
  const cleanGit = captureGitFingerprint({ repoRoot: ROOT });
  if (!dryRun && (cleanGit.dirty || cleanGit.untracked.length)) {
    throw new Error('Paid observability reliability gate requires a clean committed Git worktree');
  }
  const benchmarkConfig = yaml.parse(fs.readFileSync(benchmarkConfigPath, 'utf8'));
  const reliabilityConfig = yaml.parse(fs.readFileSync(reliabilityConfigPath, 'utf8'));
  const s0Parent = validateAdaptiveStateStage1Parent({
    parentRunDir: resolveFromRoot(s0Arg),
    config: benchmarkConfig,
    configPath: benchmarkConfigPath,
    repoRoot: ROOT,
  });
  const stoppedPreflight = validateAdaptiveStateStoppedObservabilityPreflightV21({
    stoppedPreflightRunDir: resolveFromRoot(stoppedArg),
    s0Parent,
    benchmarkConfig,
  });
  const plan = buildAdaptiveStateObservabilityReliabilityPlan(
    benchmarkConfig,
    reliabilityConfig,
    { label },
  );
  const runDir = path.join(outRoot, label);
  const cliFingerprints = {
    codex: cliFingerprint('codex', { repoRoot: ROOT }),
    claude: cliFingerprint('claude', { repoRoot: ROOT }),
  };
  const runPlan = executionRunPlan({
    plan,
    benchmarkConfig,
    benchmarkConfigPath,
    reliabilityConfig,
    reliabilityConfigPath,
    s0Parent,
    stoppedPreflight,
    runSeed,
    cliFingerprints,
  });
  if (dryRun) {
    process.stdout.write(
      canonicalJson(
        {
          mode: 'dry_run_no_writes_no_calls',
          label: plan.label,
          cases: plan.jobs.length,
          cli_dispatches: plan.counts.total_cli_dispatches,
          draw_blocks: plan.axes.draw_blocks,
          pass_contract: plan.pass_contract,
          s0_parent_run_id: s0Parent.run_id,
          stopped_preflight_parent_run_id: stoppedPreflight.run_id,
          reliability_plan_sha256: plan.content_sha256,
          static_hashes_sha256: hashCanonicalJson(runPlan.hashes),
          s1_relevant_hashes_sha256: runPlan.metadata.s1RelevantHashesSha256,
          git_dirty: cleanGit.dirty,
          git_untracked: cleanGit.untracked,
        },
        { space: 2, trailingNewline: true },
      ),
    );
    return;
  }
  const created = createRunPlan(runDir, runPlan);
  writeExclusive(
    path.join(runDir, 'observability-reliability-plan.json'),
    canonicalJson(plan, { space: 2, trailingNewline: true }),
  );
  appendRunEvent(runDir, {
    type: 'observability_reliability_started',
    plannedCases: 72,
    plannedCliDispatches: 144,
    drawBlocks: plan.axes.draw_blocks,
    backendRequestCount: 'unknown',
    claimEligible: false,
  });

  const abortController = new AbortController();
  let interruption = null;
  const requestAbort = (signal, exitCode) => {
    if (interruption) return;
    interruption = { signal, exitCode };
    process.exitCode = exitCode;
    appendRunEvent(runDir, {
      type: 'observability_reliability_abort_requested',
      signal,
      disposition: 'stopped_never_resume_same_label_no_partial_reuse',
    });
    abortController.abort(new Error(`Observability reliability gate interrupted by ${signal}`));
  };
  const onSigint = () => requestAbort('SIGINT', 130);
  const onSigterm = () => requestAbort('SIGTERM', 143);
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);
  const removeSignalHandlers = () => {
    process.removeListener('SIGINT', onSigint);
    process.removeListener('SIGTERM', onSigterm);
  };
  const assertNotInterrupted = () => {
    if (interruption) throw new Error(`Observability reliability gate interrupted by ${interruption.signal}`);
  };

  const observedRoles = new Set();
  const onCall = async (row) => {
    appendRunEvent(runDir, {
      type: 'observability_reliability_call_recorded',
      callId: row.parent_call_id,
      callIndex: row.parent_call_index,
      childCallId: row.child_call.id,
      drawId: row.draw_id,
      drawIndex: row.draw_index,
      role: row.child_call.role,
      status: row.child_call.status,
      jobId: row.child_call.job_id,
      dispatchCount: row.child_call.provenance.dispatch_count,
      claimEligible: false,
      callSha256: hashCanonicalJson(row.child_call),
    });
    if (row.child_call.status === 'success' && !observedRoles.has(row.child_call.role)) {
      observedRoles.add(row.child_call.role);
      appendRunEvent(runDir, {
        type: 'model_observed',
        role: row.child_call.role,
        requested: row.child_call.provenance.requested_model_ref,
        resolved: row.child_call.provenance.resolved_model_ref,
        observed: row.child_call.provenance.observed_model_ref,
        attestationBasis: row.child_call.provenance.model_attestation_basis,
        independentlyAttested: false,
      });
    }
  };

  let result;
  try {
    result = await executeAdaptiveStateObservabilityReliability({
      plan,
      benchmarkConfig,
      reliabilityConfig,
      repoRoot: ROOT,
      onCall,
      createDrawSeams: async ({ drawId, drawIndex, callOffset }) => {
        const lifecycle = async (event) =>
          appendRunEvent(runDir, remapLifecycle(event, { drawId, drawIndex, callOffset }));
        return createAdaptiveStateStage1ProductionLiveSeams({
          config: benchmarkConfig,
          onReached: lifecycle,
          onDispatch: lifecycle,
          onFinished: lifecycle,
          signal: abortController.signal,
        });
      },
    });
    assertNotInterrupted();
    result.execution_mode = 'paid_cli';
    result.execution_transaction = {
      run_id: runPlan.runId,
      run_plan_sha256: created.sha256,
      reliability_hashes_sha256: hashCanonicalJson(runPlan.hashes),
      s1_relevant_hashes_sha256: runPlan.metadata.s1RelevantHashesSha256,
      cli_fingerprints_sha256: runPlan.metadata.cliFingerprintsSha256,
    };
    result.content_sha256 = adaptiveStateObservabilityReliabilityResultContentSha256(result);
    validateAdaptiveStateObservabilityReliabilityResult(
      result,
      plan,
      benchmarkConfig,
      reliabilityConfig,
    );
  } catch (error) {
    const partial = error.reliabilityPartial || {
      completed_draw_results: [],
      failing_draw: null,
      failing_draw_partial: null,
      disposition: 'stopped_never_resume_same_label_no_partial_reuse',
    };
    writeExclusive(
      path.join(runDir, 'observability-reliability-partial.json'),
      canonicalJson(partial, { space: 2, trailingNewline: true }),
    );
    appendRunEvent(runDir, {
      type: 'observability_reliability_stopped',
      error: error.message,
      failingDraw: partial.failing_draw,
      disposition: partial.disposition,
    });
    createRunSeal(runDir, {
      status: 'stopped',
      metadata: {
        stage: 's1_observability_reliability_gate',
        reason: error.message,
        failingDraw: partial.failing_draw,
        backendRequestCount: 'unknown',
        claimEligible: false,
        s1RetryEligible: false,
        disposition: partial.disposition,
      },
    });
    assertExperimentRun(runDir);
    removeSignalHandlers();
    if (interruption) error.exitCode = interruption.exitCode;
    throw error;
  }

  let report;
  let passed = false;
  let verified;
  try {
    assertNotInterrupted();
    const resultFile = writeExclusive(
      path.join(runDir, 'observability-reliability-result.json'),
      canonicalJson(result, { space: 2, trailingNewline: true }),
    );
    writeExclusive(
      path.join(runDir, 'observability-reliability-call-ledger.jsonl'),
      jsonl(adaptiveStateObservabilityReliabilityCallRows(result.draw_results)),
    );
    writeExclusive(path.join(runDir, 'observability-reliability-cases.jsonl'), jsonl(result.cases));
    report = buildAdaptiveStateObservabilityReliabilityReport({
      plan,
      result,
      benchmarkConfig,
      reliabilityConfig,
    });
    validateAdaptiveStateObservabilityReliabilityReport(report);
    const reportFile = writeExclusive(
      path.join(runDir, 'observability-reliability-report.json'),
      canonicalJson(report, { space: 2, trailingNewline: true }),
    );
    writeExclusive(path.join(runDir, 'observability-reliability-report.md'), renderReport(report));
    appendRunEvent(runDir, {
      type: 'observability_reliability_evaluated',
      status: report.status,
      decision: report.decision,
      completedCases: report.coverage.completed_cases,
      exactFamilyMatches: report.coverage.exact_family_matches,
      executedCliDispatches: report.coverage.cli_dispatches,
      reportSha256: report.content_sha256,
    });
    passed = report.status === 'pass' && report.s1_retry_eligible === true;
    assertNotInterrupted();
    createRunSeal(runDir, {
      status: passed ? 'complete' : 'stopped',
      metadata: {
        stage: 's1_observability_reliability_gate',
        decision: report.decision,
        reliabilityPlanSha256: plan.content_sha256,
        reliabilityResultSha256: result.content_sha256,
        reliabilityResultFileSha256: resultFile.sha256,
        reliabilityReportSha256: report.content_sha256,
        reliabilityReportFileSha256: reportFile.sha256,
        executedCliDispatches: result.call_accounting.dispatched,
        exactFamilyMatches: result.exact_family_matches,
        backendRequestCount: 'unknown',
        claimEligible: false,
        s1RetryEligible: report.s1_retry_eligible,
      },
    });
    removeSignalHandlers();
    verified = assertExperimentRun(runDir);
  } catch (error) {
    if (!fs.existsSync(path.join(runDir, 'run-seal.json'))) {
      appendRunEvent(runDir, {
        type: 'observability_reliability_finalization_stopped',
        error: error.message,
        disposition: 'stopped_never_resume_same_label_no_partial_reuse',
      });
      createRunSeal(runDir, {
        status: 'stopped',
        metadata: {
          stage: 's1_observability_reliability_gate',
          reason: error.message,
          executedCliDispatches: result.call_accounting.dispatched,
          exactFamilyMatches: result.exact_family_matches,
          backendRequestCount: 'unknown',
          claimEligible: false,
          s1RetryEligible: false,
          disposition: 'stopped_never_resume_same_label_no_partial_reuse',
        },
      });
      assertExperimentRun(runDir);
    }
    removeSignalHandlers();
    if (interruption) error.exitCode = interruption.exitCode;
    throw error;
  }
  process.stdout.write(
    `${passed ? 'complete' : 'stopped'}: ${result.cases.length}/72 cases, ${result.exact_family_matches}/72 exact family matches, ${result.call_accounting.dispatched}/144 CLI dispatches\n`,
  );
  process.stdout.write(`${path.relative(ROOT, runDir)}\n`);
  process.stdout.write(`sealed observability reliability gate verified: ${verified.inventory.length} artifacts\n`);
  if (!passed) process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : process.exitCode || 1;
  });
}
