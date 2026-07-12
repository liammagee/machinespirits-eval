import fs from 'node:fs';
import path from 'node:path';

import {
  assertExperimentRun,
  hashCanonicalJson,
  readRunEvents,
} from '../experimentRunArtifacts.js';
import {
  adaptiveStateStage1StaticExecutionContract,
  cliFingerprint,
} from './stateBenchmarkStage1Contracts.js';
import {
  buildAdaptiveStateObservabilityPreflightReport,
  validateAdaptiveStateObservabilityPreflightPlan,
  validateAdaptiveStateObservabilityPreflightReport,
  validateAdaptiveStateObservabilityPreflightResult,
} from './stateObservabilityPreflight.js';
import {
  adaptiveStateObservabilityReliabilityCallRows,
  buildAdaptiveStateObservabilityReliabilityReport,
  validateAdaptiveStateObservabilityReliabilityPlan,
  validateAdaptiveStateObservabilityReliabilityReport,
  validateAdaptiveStateObservabilityReliabilityResult,
} from './stateObservabilityReliabilityV22.js';
import { adaptiveStateObservabilityReliabilityV22StaticExecutionContract } from './stateObservabilityReliabilityV22Contracts.js';

export const ADAPTIVE_STATE_OBSERVABILITY_RELIABILITY_FILES = Object.freeze({
  plan: 'observability-reliability-plan.json',
  result: 'observability-reliability-result.json',
  report: 'observability-reliability-report.json',
  calls: 'observability-reliability-call-ledger.jsonl',
  cases: 'observability-reliability-cases.jsonl',
});

function readJson(runDir, fileName) {
  return JSON.parse(fs.readFileSync(path.join(runDir, fileName), 'utf8'));
}

function readJsonLines(runDir, fileName) {
  return fs
    .readFileSync(path.join(runDir, fileName), 'utf8')
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function inventoryHas(verification, fileName) {
  return verification.inventory.some((row) => row.path === fileName);
}

function assertHistoricalCleanGitAttestation(git) {
  if (
    !git ||
    git.dirty !== false ||
    !Array.isArray(git.untracked) ||
    git.untracked.length !== 0 ||
    !/^[0-9a-f]{40}$/u.test(String(git.sha || git.commit || ''))
  ) {
    throw new Error('stateObservabilityReliabilityV22Lineage: parent lacks a clean committed Git attestation');
  }
}

export function validateAdaptiveStateStoppedObservabilityPreflightV21({
  stoppedPreflightRunDir,
  s0Parent,
  benchmarkConfig,
} = {}) {
  if (!stoppedPreflightRunDir || !s0Parent?.run_id || !benchmarkConfig) {
    throw new Error('stateObservabilityReliabilityV22Lineage: stopped v2.1 preflight, S0, and config are required');
  }
  const runDir = path.resolve(stoppedPreflightRunDir);
  const verification = assertExperimentRun(runDir);
  const files = {
    plan: 'observability-preflight-plan.json',
    result: 'observability-preflight-result.json',
    report: 'observability-preflight-report.json',
    calls: 'observability-preflight-call-ledger.jsonl',
    cases: 'observability-preflight-cases.jsonl',
  };
  for (const fileName of Object.values(files)) {
    if (!inventoryHas(verification, fileName)) {
      throw new Error(`stateObservabilityReliabilityV22Lineage: stopped preflight seal omits ${fileName}`);
    }
  }
  const plan = readJson(runDir, files.plan);
  const result = readJson(runDir, files.result);
  const report = readJson(runDir, files.report);
  const calls = readJsonLines(runDir, files.calls);
  const cases = readJsonLines(runDir, files.cases);
  validateAdaptiveStateObservabilityPreflightPlan(plan, benchmarkConfig);
  validateAdaptiveStateObservabilityPreflightResult(result, plan, benchmarkConfig);
  validateAdaptiveStateObservabilityPreflightReport(report);
  const rebuilt = buildAdaptiveStateObservabilityPreflightReport({ plan, result, config: benchmarkConfig });
  const metadata = verification.plan?.metadata || {};
  const sealMetadata = verification.seal?.metadata || {};
  assertHistoricalCleanGitAttestation(verification.plan?.provenance?.git);
  if (
    verification.seal?.status !== 'stopped' ||
    verification.plan?.runner !== 'scripts/execute-adaptive-state-observability-preflight-v2.js' ||
    verification.plan?.lineage?.parentRunId !== s0Parent.run_id ||
    metadata.stage !== 's1_observability_preflight' ||
    metadata.paid !== true ||
    metadata.claimEligible !== false ||
    Number(metadata.expectedCliDispatches) !== 48 ||
    metadata.s0ParentRunId !== s0Parent.run_id ||
    metadata.currentS0ConfigSha256 !== s0Parent.config_sha256 ||
    metadata.currentS0ParentPlanSha256 !== s0Parent.plan_sha256 ||
    metadata.currentS0SealInventorySha256 !== s0Parent.seal_inventory_sha256 ||
    report.status !== 'stop' ||
    report.decision !== 'stop_and_repair_observability_preflight' ||
    report.s1_retry_eligible !== false ||
    result.execution_mode !== 'paid_cli' ||
    result.exact_family_matches !== 23 ||
    result.all_cases_passed !== false ||
    result.call_accounting.dispatched !== 48 ||
    hashCanonicalJson(rebuilt) !== hashCanonicalJson(report) ||
    hashCanonicalJson(calls) !== hashCanonicalJson(result.calls) ||
    hashCanonicalJson(cases) !== hashCanonicalJson(result.cases) ||
    sealMetadata.decision !== report.decision ||
    sealMetadata.preflightPlanSha256 !== plan.content_sha256 ||
    sealMetadata.preflightResultSha256 !== result.content_sha256 ||
    sealMetadata.preflightReportSha256 !== report.content_sha256 ||
    Number(sealMetadata.executedCliDispatches) !== 48 ||
    Number(sealMetadata.exactFamilyMatches) !== 23 ||
    sealMetadata.s1RetryEligible !== false
  ) {
    throw new Error('stateObservabilityReliabilityV22Lineage: diagnostic v2.1 preflight is stale, incomplete, or not the sealed 23/24 current-contract stop');
  }
  return {
    run_id: verification.plan.runId,
    run_dir: runDir,
    plan_sha256: verification.seal.planSha256,
    seal_inventory_sha256: verification.seal.inventorySha256,
    preflight_plan_sha256: plan.content_sha256,
    result_sha256: result.content_sha256,
    report_sha256: report.content_sha256,
    exact_family_matches: result.exact_family_matches,
    s0_parent_run_id: metadata.s0ParentRunId,
    diagnoses_stopped_s1_run_id: metadata.diagnosesStoppedS1RunId,
  };
}

export function validateAdaptiveStateObservabilityReliabilityV22Parent({
  reliabilityRunDir,
  s0Parent,
  benchmarkConfig,
  benchmarkConfigPath,
  reliabilityConfig,
  reliabilityConfigPath,
  repoRoot = path.resolve('.'),
} = {}) {
  if (
    !reliabilityRunDir ||
    !s0Parent?.run_id ||
    !benchmarkConfig ||
    !benchmarkConfigPath ||
    !reliabilityConfig ||
    !reliabilityConfigPath
  ) {
    throw new Error('stateObservabilityReliabilityV22Lineage: passing reliability run, S0, and configs are required');
  }
  const runDir = path.resolve(reliabilityRunDir);
  const verification = assertExperimentRun(runDir);
  for (const fileName of Object.values(ADAPTIVE_STATE_OBSERVABILITY_RELIABILITY_FILES)) {
    if (!inventoryHas(verification, fileName)) {
      throw new Error(`stateObservabilityReliabilityV22Lineage: passing seal omits ${fileName}`);
    }
  }
  const plan = readJson(runDir, ADAPTIVE_STATE_OBSERVABILITY_RELIABILITY_FILES.plan);
  const result = readJson(runDir, ADAPTIVE_STATE_OBSERVABILITY_RELIABILITY_FILES.result);
  const report = readJson(runDir, ADAPTIVE_STATE_OBSERVABILITY_RELIABILITY_FILES.report);
  const callLedger = readJsonLines(runDir, ADAPTIVE_STATE_OBSERVABILITY_RELIABILITY_FILES.calls);
  const caseLedger = readJsonLines(runDir, ADAPTIVE_STATE_OBSERVABILITY_RELIABILITY_FILES.cases);
  validateAdaptiveStateObservabilityReliabilityPlan(plan, benchmarkConfig, reliabilityConfig);
  validateAdaptiveStateObservabilityReliabilityResult(
    result,
    plan,
    benchmarkConfig,
    reliabilityConfig,
  );
  validateAdaptiveStateObservabilityReliabilityReport(report);
  const rebuilt = buildAdaptiveStateObservabilityReliabilityReport({
    plan,
    result,
    benchmarkConfig,
    reliabilityConfig,
  });
  const currentContract = adaptiveStateObservabilityReliabilityV22StaticExecutionContract({
    benchmarkConfig,
    benchmarkConfigPath,
    reliabilityConfig,
    reliabilityConfigPath,
    repoRoot,
  });
  const currentS1Contract = adaptiveStateStage1StaticExecutionContract({
    config: benchmarkConfig,
    configPath: benchmarkConfigPath,
    repoRoot,
  });
  const currentCli = {
    codex: cliFingerprint('codex', { repoRoot }),
    claude: cliFingerprint('claude', { repoRoot }),
  };
  const metadata = verification.plan?.metadata || {};
  const sealMetadata = verification.seal?.metadata || {};
  assertHistoricalCleanGitAttestation(verification.plan?.provenance?.git);
  if (
    verification.seal?.status !== 'complete' ||
    verification.plan?.runner !== 'scripts/execute-adaptive-state-observability-reliability-v22.js' ||
    metadata.stage !== 's1_observability_reliability_gate' ||
    metadata.paid !== true ||
    metadata.claimEligible !== false ||
    Number(metadata.expectedCliDispatches) !== 144 ||
    metadata.s0ParentRunId !== s0Parent.run_id ||
    metadata.s0ParentPlanSha256 !== s0Parent.plan_sha256 ||
    metadata.s0ParentSealInventorySha256 !== s0Parent.seal_inventory_sha256 ||
    metadata.s0ConfigSha256 !== s0Parent.config_sha256 ||
    verification.plan?.lineage?.parentRunId !== metadata.diagnosesStoppedPreflightRunId ||
    hashCanonicalJson(verification.plan?.hashes) !== hashCanonicalJson(currentContract) ||
    hashCanonicalJson(verification.plan?.intent?.observabilityReliability) !== hashCanonicalJson(plan) ||
    hashCanonicalJson(verification.plan?.jobs) !== hashCanonicalJson(plan.jobs) ||
    hashCanonicalJson(verification.plan?.randomization?.jobOrder) !== hashCanonicalJson(plan.jobs.map((row) => row.id)) ||
    metadata.reliabilityPlanSha256 !== plan.content_sha256 ||
    metadata.s1RelevantHashesSha256 !== hashCanonicalJson(currentS1Contract.hashes) ||
    hashCanonicalJson(metadata.cliFingerprints) !== hashCanonicalJson(currentCli) ||
    metadata.cliFingerprintsSha256 !== hashCanonicalJson(currentCli) ||
    report.status !== 'pass' ||
    report.decision !== 'authorize_separately_confirmed_full_s1_retry' ||
    report.s1_retry_eligible !== true ||
    result.execution_mode !== 'paid_cli' ||
    result.execution_transaction?.run_id !== verification.plan.runId ||
    result.execution_transaction?.run_plan_sha256 !== verification.seal.planSha256 ||
    result.execution_transaction?.reliability_hashes_sha256 !== hashCanonicalJson(verification.plan.hashes) ||
    result.execution_transaction?.s1_relevant_hashes_sha256 !== metadata.s1RelevantHashesSha256 ||
    result.execution_transaction?.cli_fingerprints_sha256 !== metadata.cliFingerprintsSha256 ||
    result.reliability_gate_passed !== true ||
    hashCanonicalJson(rebuilt) !== hashCanonicalJson(report) ||
    hashCanonicalJson(callLedger) !== hashCanonicalJson(adaptiveStateObservabilityReliabilityCallRows(result.draw_results)) ||
    hashCanonicalJson(caseLedger) !== hashCanonicalJson(result.cases) ||
    sealMetadata.decision !== report.decision ||
    sealMetadata.reliabilityPlanSha256 !== plan.content_sha256 ||
    sealMetadata.reliabilityResultSha256 !== result.content_sha256 ||
    sealMetadata.reliabilityReportSha256 !== report.content_sha256 ||
    Number(sealMetadata.executedCliDispatches) !== 144 ||
    Number(sealMetadata.exactFamilyMatches) !== result.exact_family_matches ||
    sealMetadata.s1RetryEligible !== true
  ) {
    throw new Error('stateObservabilityReliabilityV22Lineage: reliability parent is stale, incomplete, non-passing, or not bound to current S1');
  }
  const events = readRunEvents(runDir);
  const lifecycleTypes = [
    'call_reached',
    'call_dispatch_started',
    'call_finished',
    'observability_reliability_call_recorded',
  ];
  if (
    events.filter((event) => event.type === 'observability_reliability_started').length !== 1 ||
    events.filter((event) => event.type === 'observability_reliability_evaluated').length !== 1 ||
    events.some((event) => event.type === 'observability_reliability_stopped') ||
    lifecycleTypes.some((type) => events.filter((event) => event.type === type).length !== 144)
  ) {
    throw new Error('stateObservabilityReliabilityV22Lineage: reliability lifecycle is incomplete or stopped');
  }
  return {
    run_id: verification.plan.runId,
    run_dir: runDir,
    plan_sha256: verification.seal.planSha256,
    seal_inventory_sha256: verification.seal.inventorySha256,
    reliability_plan_sha256: plan.content_sha256,
    result_sha256: result.content_sha256,
    report_sha256: report.content_sha256,
    decision: report.decision,
    s0_parent_run_id: metadata.s0ParentRunId,
    diagnoses_stopped_preflight_run_id: metadata.diagnosesStoppedPreflightRunId,
    s1_relevant_hashes_sha256: metadata.s1RelevantHashesSha256,
    cli_fingerprints_sha256: metadata.cliFingerprintsSha256,
  };
}
