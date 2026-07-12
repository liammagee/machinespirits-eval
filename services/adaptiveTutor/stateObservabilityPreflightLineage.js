import fs from 'node:fs';
import path from 'node:path';

import {
  assertExperimentRun,
  hashCanonicalJson,
  readRunEvents,
  sha256,
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
import { adaptiveStateObservabilityPreflightStaticExecutionContract } from './stateObservabilityPreflightContracts.js';
import { validateAdaptiveStateStage0ReportContentSha256 } from './stateBenchmarkStage0Analysis.js';
import {
  loadAdaptiveStateStage0Dataset,
  validateAdaptiveStateStage0DatasetContentSha256,
} from './stateBenchmarkStage0Executor.js';
import { validateAdaptiveStateCriticalPathPlan } from './stateBenchmarkV2.js';

export const ADAPTIVE_STATE_OBSERVABILITY_PREFLIGHT_FILES = Object.freeze({
  plan: 'observability-preflight-plan.json',
  result: 'observability-preflight-result.json',
  report: 'observability-preflight-report.json',
  calls: 'observability-preflight-call-ledger.jsonl',
  cases: 'observability-preflight-cases.jsonl',
});

function readJson(runDir, fileName) {
  return JSON.parse(fs.readFileSync(path.join(runDir, fileName), 'utf8'));
}

function readJsonLines(runDir, fileName) {
  return fs
    .readFileSync(path.join(runDir, fileName), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function inventoryHas(verification, fileName) {
  return verification.inventory.some((row) => row.path === fileName);
}

function assertHistoricalCleanGitAttestation(git) {
  const emptySha256 = sha256('');
  if (
    !git ||
    !/^[0-9a-f]{40}$/u.test(String(git.sha || '')) ||
    typeof git.branch !== 'string' ||
    !git.branch.trim() ||
    git.dirty !== false ||
    !Array.isArray(git.untracked) ||
    git.untracked.length !== 0 ||
    git.statusSha256 !== emptySha256 ||
    git.patchSha256 !== emptySha256 ||
    git.fingerprintSha256 !==
      hashCanonicalJson({
        sha: git.sha,
        branch: git.branch,
        statusSha256: git.statusSha256,
        patchSha256: git.patchSha256,
        untracked: git.untracked,
      })
  ) {
    throw new Error('stateObservabilityPreflightLineage: preflight lacks a self-consistent historical clean-Git attestation');
  }
  return true;
}

function validateHistoricalAdaptiveStateS0(runDirInput) {
  const runDir = path.resolve(runDirInput);
  const verification = assertExperimentRun(runDir);
  const plan = verification.plan;
  assertHistoricalCleanGitAttestation(plan?.provenance?.git);
  for (const fileName of [
    'critical-path-plan.json',
    'dataset-manifest.json',
    'benchmark-rows.jsonl',
    'dialogues.jsonl',
    'stage0-contract-report.json',
  ]) {
    if (!inventoryHas(verification, fileName)) {
      throw new Error(`stateObservabilityPreflightLineage: historical S0 seal omits ${fileName}`);
    }
  }
  const criticalPlan = readJson(runDir, 'critical-path-plan.json');
  validateAdaptiveStateCriticalPathPlan(criticalPlan);
  const dataset = loadAdaptiveStateStage0Dataset(runDir);
  validateAdaptiveStateStage0DatasetContentSha256(dataset);
  const report = readJson(runDir, 'stage0-contract-report.json');
  validateAdaptiveStateStage0ReportContentSha256(report);
  if (
    verification.seal?.status !== 'complete' ||
    plan?.runner !== 'scripts/execute-adaptive-state-benchmark-v2-s0.js' ||
    plan?.metadata?.stage !== 's0_contract' ||
    String(plan?.metadata?.benchmarkVersion) !== '2.1' ||
    Number(plan?.metadata?.expectedModelCalls) !== 0 ||
    plan?.metadata?.paid !== false ||
    criticalPlan.label !== plan.runId ||
    report.status !== 'pass' ||
    report.decision !== 'advance_to_s1_technical_pilot' ||
    report.confirmation_eligible !== false ||
    report.s2_validity_verdict !== null ||
    report.content_sha256 !== verification.seal.metadata?.reportSha256 ||
    dataset.content_sha256 !== verification.seal.metadata?.datasetSha256
  ) {
    throw new Error('stateObservabilityPreflightLineage: historical diagnostic S0 is incomplete or non-passing');
  }
  return {
    run_id: plan.runId,
    plan_sha256: verification.seal.planSha256,
    seal_inventory_sha256: verification.seal.inventorySha256,
    config_sha256: criticalPlan.config_sha256,
    report_sha256: report.content_sha256,
    dataset_sha256: dataset.content_sha256,
  };
}

export function resolveAdaptiveStateDiagnosticS0Lineage({
  stoppedS1ParentRunId,
  currentS0,
  diagnosticS0 = null,
} = {}) {
  if (
    !stoppedS1ParentRunId ||
    !currentS0?.run_id ||
    !currentS0?.config_sha256 ||
    !currentS0?.plan_sha256 ||
    !currentS0?.seal_inventory_sha256 ||
    !currentS0?.report_sha256 ||
    !currentS0?.dataset_sha256
  ) {
    throw new Error('stateObservabilityPreflightLineage: stopped-S1 parent and current S0 are required');
  }
  if (stoppedS1ParentRunId === currentS0.run_id) {
    if (diagnosticS0 && diagnosticS0.run_id !== currentS0.run_id) {
      throw new Error('stateObservabilityPreflightLineage: unnecessary diagnostic S0 differs from the current parent');
    }
    return {
      mode: 'current_s0_is_diagnostic_parent',
      diagnostic_s0_parent_run_id: currentS0.run_id,
      diagnostic_s0_parent_plan_sha256: currentS0.plan_sha256,
      diagnostic_s0_seal_inventory_sha256: currentS0.seal_inventory_sha256,
      diagnostic_s0_report_sha256: currentS0.report_sha256,
      diagnostic_s0_dataset_sha256: currentS0.dataset_sha256,
      diagnostic_s0_config_sha256: currentS0.config_sha256,
      current_s0_parent_run_id: currentS0.run_id,
      current_s0_parent_plan_sha256: currentS0.plan_sha256,
      current_s0_seal_inventory_sha256: currentS0.seal_inventory_sha256,
      current_s0_config_sha256: currentS0.config_sha256,
    };
  }
  if (!diagnosticS0?.run_id) {
    throw new Error(
      'stateObservabilityPreflightLineage: stopped S1 belongs to an earlier S0; --diagnostic-s0-parent is required',
    );
  }
  if (
    diagnosticS0.run_id !== stoppedS1ParentRunId ||
    !diagnosticS0.config_sha256 ||
    !diagnosticS0.plan_sha256 ||
    !diagnosticS0.seal_inventory_sha256 ||
    !diagnosticS0.report_sha256 ||
    !diagnosticS0.dataset_sha256 ||
    diagnosticS0.config_sha256 === currentS0.config_sha256
  ) {
    throw new Error(
      'stateObservabilityPreflightLineage: replacement S0 lineage must bind the stopped S1 original parent and a changed current config',
    );
  }
  return {
    mode: 'replacement_s0_after_observability_repair',
    diagnostic_s0_parent_run_id: diagnosticS0.run_id,
    diagnostic_s0_parent_plan_sha256: diagnosticS0.plan_sha256,
    diagnostic_s0_seal_inventory_sha256: diagnosticS0.seal_inventory_sha256,
    diagnostic_s0_report_sha256: diagnosticS0.report_sha256,
    diagnostic_s0_dataset_sha256: diagnosticS0.dataset_sha256,
    diagnostic_s0_config_sha256: diagnosticS0.config_sha256,
    current_s0_parent_run_id: currentS0.run_id,
    current_s0_parent_plan_sha256: currentS0.plan_sha256,
    current_s0_seal_inventory_sha256: currentS0.seal_inventory_sha256,
    current_s0_config_sha256: currentS0.config_sha256,
  };
}

export function validateAdaptiveStateStoppedS1DiagnosticParent({
  stoppedRunDir,
  s0Parent,
  diagnosticS0ParentRunDir = null,
} = {}) {
  if (!stoppedRunDir || !s0Parent?.run_id) {
    throw new Error('stateObservabilityPreflightLineage: stopped S1 and verified S0 parent are required');
  }
  const runDir = path.resolve(stoppedRunDir);
  const verification = assertExperimentRun(runDir);
  const plan = verification.plan;
  if (
    verification.seal?.status !== 'stopped' ||
    plan?.runner !== 'scripts/execute-adaptive-state-benchmark-v2-s1.js' ||
    plan?.metadata?.stage !== 's1_technical_pilot' ||
    String(plan?.metadata?.benchmarkVersion) !== '2.1' ||
    plan?.metadata?.paid !== true
  ) {
    throw new Error('stateObservabilityPreflightLineage: diagnostic parent is not a sealed stopped paid v2.1 S1');
  }
  const criticalPlan = readJson(runDir, 'critical-path-plan.json');
  validateAdaptiveStateCriticalPathPlan(criticalPlan);
  const diagnosticS0 = diagnosticS0ParentRunDir
    ? validateHistoricalAdaptiveStateS0(diagnosticS0ParentRunDir)
    : null;
  const s0Lineage = resolveAdaptiveStateDiagnosticS0Lineage({
    stoppedS1ParentRunId: plan?.lineage?.parentRunId,
    currentS0: s0Parent,
    diagnosticS0,
  });
  if (
    criticalPlan.label !== plan.runId ||
    criticalPlan.config_sha256 !== s0Lineage.diagnostic_s0_config_sha256
  ) {
    throw new Error('stateObservabilityPreflightLineage: stopped S1 plan differs from its S0 design/config lineage');
  }
  const reason = String(verification.seal.metadata?.reason || '');
  const partialFile = 'stage1-partial-accounting.json';
  const hasPartial = inventoryHas(verification, partialFile);
  const partial = hasPartial ? readJson(runDir, partialFile) : null;
  const diagnosticReason = /evidence_span|event-family recovery|event_family_recovery/iu.test(reason);
  if (
    !hasPartial ||
    !partial?.call_accounting ||
    Number(partial.call_accounting.dispatched) < 1 ||
    Number(partial.call_accounting.failed) < 1 ||
    !diagnosticReason
  ) {
    throw new Error('stateObservabilityPreflightLineage: stopped S1 does not prove the observability failure this preflight diagnoses');
  }
  return {
    run_id: plan.runId,
    run_dir: runDir,
    plan_sha256: verification.seal.planSha256,
    seal_inventory_sha256: verification.seal.inventorySha256,
    reason,
    call_accounting: partial.call_accounting,
    s0_parent_run_id: s0Lineage.diagnostic_s0_parent_run_id,
    s0_lineage: s0Lineage,
  };
}

export function validateAdaptiveStateObservabilityPreflightParent({
  preflightRunDir,
  s0Parent,
  config,
  configPath,
  repoRoot = path.resolve('.'),
} = {}) {
  if (!preflightRunDir || !s0Parent?.run_id || !config || !configPath) {
    throw new Error('stateObservabilityPreflightLineage: passing preflight, S0, config, and config path are required');
  }
  const runDir = path.resolve(preflightRunDir);
  const verification = assertExperimentRun(runDir);
  for (const fileName of Object.values(ADAPTIVE_STATE_OBSERVABILITY_PREFLIGHT_FILES)) {
    if (!inventoryHas(verification, fileName)) {
      throw new Error(`stateObservabilityPreflightLineage: passing preflight seal omits ${fileName}`);
    }
  }
  const plan = readJson(runDir, ADAPTIVE_STATE_OBSERVABILITY_PREFLIGHT_FILES.plan);
  const result = readJson(runDir, ADAPTIVE_STATE_OBSERVABILITY_PREFLIGHT_FILES.result);
  const report = readJson(runDir, ADAPTIVE_STATE_OBSERVABILITY_PREFLIGHT_FILES.report);
  const callLedger = readJsonLines(runDir, ADAPTIVE_STATE_OBSERVABILITY_PREFLIGHT_FILES.calls);
  const caseLedger = readJsonLines(runDir, ADAPTIVE_STATE_OBSERVABILITY_PREFLIGHT_FILES.cases);
  validateAdaptiveStateObservabilityPreflightPlan(plan, config);
  validateAdaptiveStateObservabilityPreflightResult(result, plan, config);
  validateAdaptiveStateObservabilityPreflightReport(report);
  const rebuiltReport = buildAdaptiveStateObservabilityPreflightReport({ plan, result, config });
  const currentS1Contract = adaptiveStateStage1StaticExecutionContract({ config, configPath, repoRoot });
  const currentPreflightContract = adaptiveStateObservabilityPreflightStaticExecutionContract({
    config,
    configPath,
    repoRoot,
  });
  const currentCli = {
    codex: cliFingerprint('codex', { repoRoot }),
    claude: cliFingerprint('claude', { repoRoot }),
  };
  assertHistoricalCleanGitAttestation(verification.plan?.provenance?.git);
  const metadata = verification.plan?.metadata || {};
  const sealMetadata = verification.seal?.metadata || {};
  if (
    verification.seal?.status !== 'complete' ||
    verification.plan?.runner !== 'scripts/execute-adaptive-state-observability-preflight-v2.js' ||
    metadata.stage !== 's1_observability_preflight' ||
    metadata.paid !== true ||
    metadata.claimEligible !== false ||
    Number(metadata.expectedCliDispatches) !== 48 ||
    metadata.s0ParentRunId !== s0Parent.run_id ||
    verification.plan?.lineage?.parentRunId !== s0Parent.run_id ||
    !['current_s0_is_diagnostic_parent', 'replacement_s0_after_observability_repair'].includes(
      metadata.s0LineageMode,
    ) ||
    metadata.currentS0ConfigSha256 !== s0Parent.config_sha256 ||
    (metadata.s0LineageMode === 'current_s0_is_diagnostic_parent' &&
      (metadata.diagnosticS0ParentRunId !== s0Parent.run_id ||
        metadata.diagnosticS0ConfigSha256 !== s0Parent.config_sha256)) ||
    (metadata.s0LineageMode === 'replacement_s0_after_observability_repair' &&
      (metadata.diagnosticS0ParentRunId === s0Parent.run_id ||
        metadata.diagnosticS0ConfigSha256 === s0Parent.config_sha256)) ||
    !/^[0-9a-f]{64}$/u.test(String(metadata.diagnosticS0ParentPlanSha256 || '')) ||
    !/^[0-9a-f]{64}$/u.test(String(metadata.diagnosticS0SealInventorySha256 || '')) ||
    !/^[0-9a-f]{64}$/u.test(String(metadata.diagnosticS0ReportSha256 || '')) ||
    !/^[0-9a-f]{64}$/u.test(String(metadata.diagnosticS0DatasetSha256 || '')) ||
    metadata.currentS0ParentPlanSha256 !== s0Parent.plan_sha256 ||
    metadata.currentS0SealInventorySha256 !== s0Parent.seal_inventory_sha256 ||
    !/^[0-9a-f]{64}$/u.test(String(metadata.diagnosesStoppedS1PlanSha256 || '')) ||
    !/^[0-9a-f]{64}$/u.test(String(metadata.diagnosesStoppedS1SealInventorySha256 || '')) ||
    hashCanonicalJson(verification.plan?.hashes) !== hashCanonicalJson(currentPreflightContract) ||
    hashCanonicalJson(verification.plan?.intent?.observabilityPreflight) !== hashCanonicalJson(plan) ||
    hashCanonicalJson(verification.plan?.jobs) !== hashCanonicalJson(plan.jobs) ||
    hashCanonicalJson(verification.plan?.randomization?.jobOrder) !==
      hashCanonicalJson(plan.jobs.map((job) => job.id)) ||
    metadata.preflightPlanSha256 !== plan.content_sha256 ||
    plan.label !== verification.plan.runId ||
    result.plan_content_sha256 !== plan.content_sha256 ||
    report.plan_content_sha256 !== plan.content_sha256 ||
    report.result_content_sha256 !== result.content_sha256 ||
    report.status !== 'pass' ||
    report.decision !== 'authorize_full_s1_retry' ||
    report.s1_retry_eligible !== true ||
    result.execution_mode !== 'paid_cli' ||
    result.execution_transaction?.run_id !== verification.plan.runId ||
    result.execution_transaction?.run_plan_sha256 !== verification.seal.planSha256 ||
    result.execution_transaction?.preflight_hashes_sha256 !==
      hashCanonicalJson(verification.plan.hashes) ||
    result.execution_transaction?.s1_relevant_hashes_sha256 !== metadata.s1RelevantHashesSha256 ||
    result.execution_transaction?.cli_fingerprints_sha256 !== metadata.cliFingerprintsSha256 ||
    result.exact_family_matches !== 24 ||
    result.all_cases_passed !== true ||
    hashCanonicalJson(rebuiltReport) !== hashCanonicalJson(report) ||
    hashCanonicalJson(callLedger) !== hashCanonicalJson(result.calls) ||
    hashCanonicalJson(caseLedger) !== hashCanonicalJson(result.cases) ||
    metadata.s1RelevantHashesSha256 !== hashCanonicalJson(currentS1Contract.hashes) ||
    hashCanonicalJson(metadata.cliFingerprints) !== hashCanonicalJson(currentCli) ||
    metadata.cliFingerprintsSha256 !== hashCanonicalJson(currentCli) ||
    sealMetadata.preflightPlanSha256 !== plan.content_sha256 ||
    sealMetadata.preflightResultSha256 !== result.content_sha256 ||
    sealMetadata.preflightReportSha256 !== report.content_sha256 ||
    sealMetadata.decision !== 'authorize_full_s1_retry' ||
    Number(sealMetadata.executedCliDispatches) !== 48
  ) {
    throw new Error('stateObservabilityPreflightLineage: preflight is stale, incomplete, non-passing, or not bound to the current S1 runtime');
  }
  const events = readRunEvents(runDir);
  const observedRoles = events
    .filter((event) => event.type === 'model_observed')
    .map((event) => event.role)
    .sort();
  const lifecycleTypes = [
    'call_reached',
    'call_dispatch_started',
    'call_finished',
    'observability_preflight_call_recorded',
  ];
  const lifecycle = Object.fromEntries(
    lifecycleTypes.map((type) => [type, events.filter((event) => event.type === type)]),
  );
  if (
    events.filter((event) => event.type === 'observability_preflight_started').length !== 1 ||
    events.filter((event) => event.type === 'observability_preflight_evaluated').length !== 1 ||
    events.some((event) => event.type === 'observability_preflight_stopped') ||
    hashCanonicalJson(observedRoles) !==
      hashCanonicalJson(['claude_realizer', 'codex_realizer', 'public_turn_analyzer']) ||
    lifecycleTypes.some((type) => lifecycle[type].length !== 48)
  ) {
    throw new Error('stateObservabilityPreflightLineage: preflight lifecycle is partial, stopped, or multiply evaluated');
  }
  let priorRecordedSequence = 0;
  for (const [index, call] of result.calls.entries()) {
    const expectedIndex = index + 1;
    const byType = Object.fromEntries(
      lifecycleTypes.map((type) => [type, lifecycle[type].filter((event) => event.callId === call.id)]),
    );
    const reached = byType.call_reached[0];
    const dispatched = byType.call_dispatch_started[0];
    const finished = byType.call_finished[0];
    const recorded = byType.observability_preflight_call_recorded[0];
    const orderedSequences = lifecycleTypes.map((type) => Number(byType[type][0]?.sequence));
    if (
      lifecycleTypes.some((type) => byType[type].length !== 1) ||
      orderedSequences[0] <= priorRecordedSequence ||
      orderedSequences.some((sequence, offset) => offset > 0 && sequence <= orderedSequences[offset - 1]) ||
      [reached, dispatched, finished, recorded].some(
        (event) => Number(event?.callIndex) !== expectedIndex || event?.role !== call.role,
      ) ||
      [reached, dispatched, finished].some((event) => event?.context?.job_id !== call.job_id) ||
      finished.status !== 'success' ||
      Number(finished.dispatchCount) !== 1 ||
      recorded.status !== 'success' ||
      Number(recorded.dispatchCount) !== 1 ||
      recorded.jobId !== call.job_id ||
      recorded.callSha256 !== hashCanonicalJson(call)
    ) {
      throw new Error(`stateObservabilityPreflightLineage: incomplete lifecycle binding for ${call.id}`);
    }
    priorRecordedSequence = orderedSequences.at(-1);
  }
  return {
    run_id: verification.plan.runId,
    run_dir: runDir,
    plan_sha256: verification.seal.planSha256,
    seal_inventory_sha256: verification.seal.inventorySha256,
    preflight_plan_sha256: plan.content_sha256,
    result_sha256: result.content_sha256,
    report_sha256: report.content_sha256,
    decision: report.decision,
    diagnoses_stopped_s1_run_id: metadata.diagnosesStoppedS1RunId,
    s0_parent_run_id: metadata.s0ParentRunId,
    diagnostic_s0_parent_run_id: metadata.diagnosticS0ParentRunId,
    s0_lineage_mode: metadata.s0LineageMode,
    s1_relevant_hashes_sha256: metadata.s1RelevantHashesSha256,
    cli_fingerprints_sha256: metadata.cliFingerprintsSha256,
  };
}
