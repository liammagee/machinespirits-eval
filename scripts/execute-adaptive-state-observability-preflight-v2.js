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
  adaptiveStateObservabilityPreflightResultContentSha256,
  buildAdaptiveStateObservabilityPreflightPlan,
  buildAdaptiveStateObservabilityPreflightReport,
  executeAdaptiveStateObservabilityPreflight,
  validateAdaptiveStateObservabilityPreflightReport,
  validateAdaptiveStateObservabilityPreflightResult,
} from '../services/adaptiveTutor/stateObservabilityPreflight.js';
import { validateAdaptiveStateStoppedS1DiagnosticParent } from '../services/adaptiveTutor/stateObservabilityPreflightLineage.js';
import { adaptiveStateObservabilityPreflightStaticExecutionContract } from '../services/adaptiveTutor/stateObservabilityPreflightContracts.js';

const SCRIPT = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT), '..');
const DEFAULT_CONFIG = path.join(ROOT, 'config', 'adaptive-state-benchmark-v2.yaml');
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
  return `Usage: node scripts/execute-adaptive-state-observability-preflight-v2.js [options]

Executes exactly 24 claim-ineligible isolated public-observability cases:
three worlds x four event families x two language realizers. Each case makes
one realizer and one public-analyzer dispatch, for 48 serial CLI dispatches.
This command never launches the 339-dispatch S1 matrix automatically.

Required:
  --s0-parent <dir>                         Sealed passing benchmark-v2.1 S0
  --diagnoses-stopped-s1 <dir>              Sealed stopped S1 being diagnosed
  --confirm-paid-observability-preflight-v2.1

Options:
  --diagnostic-s0-parent <dir>  Original S0 of the stopped S1; required only
                                when a construct repair required a fresh S0
  --label <id>       Default: adaptive-state-v2-observability-preflight-v21
  --run-seed <n>     Immutable artifact seed; execution order is fixed. Default: 20260712
  --config <path>    Default: config/adaptive-state-benchmark-v2.yaml
  --out <dir>        Default: exports/adaptive-state-benchmark-v2
  --help             Show this help
`;
}

function writeExclusive(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  try {
    fs.writeFileSync(filePath, content, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new Error(`Refusing to overwrite immutable observability-preflight artifact at ${filePath}`);
    }
    throw error;
  }
  return { path: filePath, bytes: Buffer.byteLength(content), sha256: sha256(content) };
}

function jsonl(rows) {
  return `${rows.map((row) => canonicalJson(row)).join('\n')}\n`;
}

function executionRunPlan({ plan, config, configPath, s0Parent, stoppedS1, runSeed, cliFingerprints }) {
  const git = captureGitFingerprint({ repoRoot: ROOT });
  delete git.repoRoot;
  const realizers = Object.fromEntries(config.critical_path.language_realizers.map((row) => [row.id, row]));
  const runtime = config.paid_execution_contract.realizer_runtime;
  const analyzer = config.paid_execution_contract.public_turn_analyzer;
  const s1Contract = adaptiveStateStage1StaticExecutionContract({ config, configPath, repoRoot: ROOT });
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
    hashes: adaptiveStateObservabilityPreflightStaticExecutionContract({
      config,
      configPath,
      repoRoot: ROOT,
    }),
    masterSeed: runSeed,
    jobs: plan.jobs,
    lineage: { parentRunId: s0Parent.run_id, resumeOf: null, supersedes: [] },
    intent: {
      observabilityPreflight: plan,
      claimBoundary:
        'Claim-ineligible public observability and parser-integrity diagnostic only; no sensor, policy, efficacy, human-learning, or deployment claim.',
      escalationBoundary:
        'A pass may authorize a separately confirmed full S1 retry. This run never launches S1 automatically.',
    },
    metadata: {
      benchmarkSchema: config.schema,
      benchmarkVersion: config.version,
      stage: 's1_observability_preflight',
      paid: true,
      claimEligible: false,
      expectedCliDispatches: 48,
      backendRequestCount: 'unknown',
      s0ParentRunId: s0Parent.run_id,
      s0ParentReportSha256: s0Parent.report_sha256,
      diagnosesStoppedS1RunId: stoppedS1.run_id,
      diagnosesStoppedS1PlanSha256: stoppedS1.plan_sha256,
      diagnosesStoppedS1SealInventorySha256: stoppedS1.seal_inventory_sha256,
      diagnosticS0ParentRunId: stoppedS1.s0_lineage.diagnostic_s0_parent_run_id,
      diagnosticS0ParentPlanSha256: stoppedS1.s0_lineage.diagnostic_s0_parent_plan_sha256,
      diagnosticS0SealInventorySha256: stoppedS1.s0_lineage.diagnostic_s0_seal_inventory_sha256,
      diagnosticS0ReportSha256: stoppedS1.s0_lineage.diagnostic_s0_report_sha256,
      diagnosticS0DatasetSha256: stoppedS1.s0_lineage.diagnostic_s0_dataset_sha256,
      diagnosticS0ConfigSha256: stoppedS1.s0_lineage.diagnostic_s0_config_sha256,
      currentS0ParentPlanSha256: stoppedS1.s0_lineage.current_s0_parent_plan_sha256,
      currentS0SealInventorySha256: stoppedS1.s0_lineage.current_s0_seal_inventory_sha256,
      currentS0ConfigSha256: stoppedS1.s0_lineage.current_s0_config_sha256,
      s0LineageMode: stoppedS1.s0_lineage.mode,
      cliFingerprints,
      cliFingerprintsSha256: hashCanonicalJson(cliFingerprints),
      s1RelevantHashes: s1Contract.hashes,
      s1RelevantHashesSha256: hashCanonicalJson(s1Contract.hashes),
      preflightPlanSha256: plan.content_sha256,
      retries: 0,
      semanticRerolls: 0,
      repairs: 0,
      fallbacks: 0,
      exclusions: 0,
      partialReuse: false,
    },
  });
}

function renderReport(report) {
  return [
    '# Adaptive learner-state benchmark v2.1 — observability preflight',
    '',
    `Status: **${report.status}**`,
    `Decision: \`${report.decision}\``,
    '',
    `- completed cases: ${report.coverage.completed_cases}/24`,
    `- exact intended-family recovery: ${report.coverage.exact_family_matches}/24`,
    `- serial CLI dispatches: ${report.coverage.cli_dispatches}/48`,
    '- backend request count: unknown',
    '- retries, rerolls, repairs, fallbacks, exclusions: 0',
    '',
    ...(report.failures.length
      ? [
          '## Failed cells',
          '',
          ...report.failures.map((row) => `- ${row.id}: ${row.intended_family} -> ${row.observed_family}`),
          '',
        ]
      : []),
    '> This diagnostic is claim-ineligible. A pass authorizes only a separately confirmed full S1 retry; it is not a learner-state validity or tutoring result.',
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
  if (!has(argv, 'confirm-paid-observability-preflight-v2.1')) {
    throw new Error(
      'Paid observability preflight is locked; pass --confirm-paid-observability-preflight-v2.1 after reviewing the exact 48-dispatch contract',
    );
  }
  const s0Arg = arg(argv, 's0-parent');
  const stoppedArg = arg(argv, 'diagnoses-stopped-s1');
  const diagnosticS0Arg = arg(argv, 'diagnostic-s0-parent');
  if (!s0Arg) throw new Error('--s0-parent is required');
  if (!stoppedArg) throw new Error('--diagnoses-stopped-s1 is required');
  const configPath = resolveFromRoot(arg(argv, 'config', DEFAULT_CONFIG));
  const outRoot = resolveFromRoot(arg(argv, 'out', DEFAULT_OUT));
  const label = arg(argv, 'label', 'adaptive-state-v2-observability-preflight-v21');
  const runSeed = Number(arg(argv, 'run-seed', '20260712'));
  if (!Number.isSafeInteger(runSeed)) throw new Error('--run-seed must be a safe integer');
  const cleanGit = captureGitFingerprint({ repoRoot: ROOT });
  if (cleanGit.dirty || cleanGit.untracked.length) {
    throw new Error('Paid observability preflight requires a clean committed Git worktree');
  }
  const config = yaml.parse(fs.readFileSync(configPath, 'utf8'));
  const s0Parent = validateAdaptiveStateStage1Parent({
    parentRunDir: resolveFromRoot(s0Arg),
    config,
    configPath,
    repoRoot: ROOT,
  });
  const stoppedS1 = validateAdaptiveStateStoppedS1DiagnosticParent({
    stoppedRunDir: resolveFromRoot(stoppedArg),
    s0Parent,
    diagnosticS0ParentRunDir: diagnosticS0Arg ? resolveFromRoot(diagnosticS0Arg) : null,
  });
  const plan = buildAdaptiveStateObservabilityPreflightPlan(config, { label });
  const runDir = path.join(outRoot, label);
  const cliFingerprints = {
    codex: cliFingerprint('codex', { repoRoot: ROOT }),
    claude: cliFingerprint('claude', { repoRoot: ROOT }),
  };
  const runPlan = executionRunPlan({
    plan,
    config,
    configPath,
    s0Parent,
    stoppedS1,
    runSeed,
    cliFingerprints,
  });
  const created = createRunPlan(runDir, runPlan);
  writeExclusive(
    path.join(runDir, 'observability-preflight-plan.json'),
    canonicalJson(plan, { space: 2, trailingNewline: true }),
  );
  appendRunEvent(runDir, {
    type: 'observability_preflight_started',
    plannedCases: 24,
    plannedCliDispatches: 48,
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
      type: 'observability_preflight_abort_requested',
      signal,
      disposition: 'stopped_never_resume_same_label_no_partial_reuse',
    });
    abortController.abort(new Error(`Observability preflight interrupted by ${signal}`));
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
    if (interruption) throw new Error(`Observability preflight interrupted by ${interruption.signal}`);
  };

  const observedRoles = new Set();
  const lifecycle = async (event) => appendRunEvent(runDir, event);
  const onCall = async (call) => {
    const callIndex = Number(String(call.id).replace(/^preflight-call-/u, ''));
    appendRunEvent(runDir, {
      type: 'observability_preflight_call_recorded',
      callId: call.id,
      callIndex,
      role: call.role,
      status: call.status,
      jobId: call.job_id,
      dispatchCount: call.provenance.dispatch_count,
      claimEligible: false,
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

  let result;
  try {
    const seams = createAdaptiveStateStage1ProductionLiveSeams({
      config,
      onReached: lifecycle,
      onDispatch: lifecycle,
      onFinished: lifecycle,
      signal: abortController.signal,
    });
    result = await executeAdaptiveStateObservabilityPreflight({
      plan,
      config,
      realizeTurn: seams.realizeTurn,
      analyzePublicText: seams.analyzePublicText,
      onCall,
      repoRoot: ROOT,
    });
    assertNotInterrupted();
    result.execution_mode = 'paid_cli';
    result.execution_transaction = {
      run_id: runPlan.runId,
      run_plan_sha256: created.sha256,
      preflight_hashes_sha256: hashCanonicalJson(runPlan.hashes),
      s1_relevant_hashes_sha256: runPlan.metadata.s1RelevantHashesSha256,
      cli_fingerprints_sha256: runPlan.metadata.cliFingerprintsSha256,
    };
    result.content_sha256 = adaptiveStateObservabilityPreflightResultContentSha256(result);
    validateAdaptiveStateObservabilityPreflightResult(result, plan, config);
  } catch (error) {
    const partial = error.preflightPartial || {
      call_accounting: { planned: 48, reached: 0, dispatched: 0, completed: 0, failed: 0, by_role: {} },
      calls: [],
      completed_cases: [],
      disposition: 'stopped_never_resume_same_label_no_partial_reuse',
    };
    writeExclusive(path.join(runDir, 'observability-preflight-partial-call-ledger.jsonl'), jsonl(partial.calls));
    writeExclusive(
      path.join(runDir, 'observability-preflight-partial-accounting.json'),
      canonicalJson(partial, { space: 2, trailingNewline: true }),
    );
    appendRunEvent(runDir, {
      type: 'observability_preflight_stopped',
      error: error.message,
      callAccounting: partial.call_accounting,
      disposition: partial.disposition,
    });
    createRunSeal(runDir, {
      status: 'stopped',
      metadata: {
        stage: 's1_observability_preflight',
        reason: error.message,
        callAccounting: partial.call_accounting,
        backendRequestCount: 'unknown',
        claimEligible: false,
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
      path.join(runDir, 'observability-preflight-result.json'),
      canonicalJson(result, { space: 2, trailingNewline: true }),
    );
    writeExclusive(path.join(runDir, 'observability-preflight-call-ledger.jsonl'), jsonl(result.calls));
    writeExclusive(path.join(runDir, 'observability-preflight-cases.jsonl'), jsonl(result.cases));
    report = buildAdaptiveStateObservabilityPreflightReport({ plan, result, config });
    validateAdaptiveStateObservabilityPreflightReport(report);
    const reportFile = writeExclusive(
      path.join(runDir, 'observability-preflight-report.json'),
      canonicalJson(report, { space: 2, trailingNewline: true }),
    );
    writeExclusive(path.join(runDir, 'observability-preflight-report.md'), renderReport(report));
    assertNotInterrupted();
    appendRunEvent(runDir, {
      type: 'observability_preflight_evaluated',
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
        stage: 's1_observability_preflight',
        decision: report.decision,
        preflightPlanSha256: plan.content_sha256,
        preflightResultSha256: result.content_sha256,
        preflightResultFileSha256: resultFile.sha256,
        preflightReportSha256: report.content_sha256,
        preflightReportFileSha256: reportFile.sha256,
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
        type: 'observability_preflight_finalization_stopped',
        error: error.message,
        executedCliDispatches: result.call_accounting.dispatched,
        disposition: 'stopped_never_resume_same_label_no_partial_reuse',
      });
      createRunSeal(runDir, {
        status: 'stopped',
        metadata: {
          stage: 's1_observability_preflight',
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
    `${passed ? 'complete' : 'stopped'}: ${result.cases.length}/24 cases, ${result.exact_family_matches}/24 exact family matches, ${result.call_accounting.dispatched}/48 CLI dispatches\n`,
  );
  process.stdout.write(`${path.relative(ROOT, runDir)}\n`);
  process.stdout.write(`sealed observability preflight verified: ${verified.inventory.length} artifacts\n`);
  if (!passed) process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : process.exitCode || 1;
  });
}
