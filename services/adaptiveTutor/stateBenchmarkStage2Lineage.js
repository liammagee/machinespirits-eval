import fs from 'node:fs';
import path from 'node:path';

import {
  hashCanonicalJson,
  hashFile,
  readRunEvents,
  sha256,
  verifyExperimentRun,
} from '../experimentRunArtifacts.js';
import {
  buildAdaptiveStateCriticalPathPlan,
  validateAdaptiveStateCriticalPathPlan,
} from './stateBenchmarkV2.js';
import {
  validateAdaptiveStateStage1DatasetContentSha256,
  validateAdaptiveStateStage1Parent,
} from './stateBenchmarkStage1Executor.js';
import {
  buildAdaptiveStateStage1Report,
  buildAdaptiveStateStage1SplitManifest,
} from './stateBenchmarkStage1Analysis.js';
import {
  cliFingerprint,
  executionRunPlan,
} from '../../scripts/execute-adaptive-state-benchmark-v2-s1.js';

export const ADAPTIVE_STATE_S2_AUTHORIZATION_V21_SCHEMA =
  'machinespirits.adaptive-state-s2-authorization.v2.1';
export const ADAPTIVE_STATE_S2_DATASET_V21_SCHEMA =
  'machinespirits.adaptive-state-s2-confirmation-dataset.v2.1';
export const ADAPTIVE_STATE_S2_SPLIT_MANIFEST_V21_SCHEMA =
  'machinespirits.adaptive-state-s2-split-manifest.v2.1';
export const ADAPTIVE_STATE_S2_PREDICTIONS_V21_SCHEMA =
  'machinespirits.adaptive-state-s2-predictions.v2.1';
export const ADAPTIVE_STATE_S2_CALL_LEDGER_V21_SCHEMA =
  'machinespirits.adaptive-state-s2-call-ledger.v2.1';
export const ADAPTIVE_STATE_S2_ANALYSIS_MANIFEST_V21_SCHEMA =
  'machinespirits.adaptive-state-s2-analysis-manifest.v2.1';
export const ADAPTIVE_STATE_S2_SEMANTIC_REGENERATION_IMPLEMENTED = false;

export const ADAPTIVE_STATE_S1_FILES = Object.freeze({
  criticalPlan: 'critical-path-plan.json',
  dataset: 'stage1-dataset.json',
  callLedger: 'stage1-call-ledger.jsonl',
  splitManifest: 'stage1-split-manifest.json',
  report: 'stage1-technical-report.json',
});

export const ADAPTIVE_STATE_S2_FILES = Object.freeze({
  criticalPlan: 'critical-path-plan.json',
  dataset: 'stage2-confirmation-dataset.json',
  callLedger: 'stage2-paid-call-ledger.json',
  splitManifest: 'stage2-split-manifest.json',
  predictions: 'stage2-predictions.json',
  report: 'stage2-precomputed-lane-report.json',
  analysisManifest: 'stage2-analysis-manifest.json',
});

const EXPECTED_VERSION = '2.1';
const EXPECTED_S1_DATASET_SCHEMA = 'machinespirits.adaptive-state-stage1-dataset.v2.1';
const RUN_SEAL_FILE = 'run-seal.json';
const VERIFIED_S1_PROMOTION_PARENTS = new WeakSet();

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function readJson(runDir, fileName, label = fileName) {
  const filePath = path.join(path.resolve(runDir), fileName);
  if (!fs.existsSync(filePath)) throw new Error(`stateBenchmarkStage2: missing sealed ${label} (${fileName})`);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`stateBenchmarkStage2: invalid ${label} JSON: ${error.message}`);
  }
}

function readJsonLines(runDir, fileName) {
  const filePath = path.join(path.resolve(runDir), fileName);
  if (!fs.existsSync(filePath)) throw new Error(`stateBenchmarkStage2: missing sealed call ledger (${fileName})`);
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`stateBenchmarkStage2: invalid call-ledger JSON at line ${index + 1}: ${error.message}`);
      }
    });
}

function requireSealedFile(verification, fileName) {
  const entry = verification.inventory.find((artifact) => artifact.path === fileName);
  if (!entry) throw new Error(`stateBenchmarkStage2: ${fileName} is absent from the sealed artifact inventory`);
  return entry;
}

function verifyCompleteRun(runDir, label) {
  if (!runDir) throw new Error(`stateBenchmarkStage2: a sealed ${label} run is required`);
  const verification = verifyExperimentRun(runDir);
  if (!verification.ok) {
    throw new Error(`stateBenchmarkStage2: ${label} failed seal verification: ${verification.errors.join('; ')}`);
  }
  if (verification.seal?.status !== 'complete') {
    throw new Error(`stateBenchmarkStage2: ${label} must have a complete seal`);
  }
  return verification;
}

function verifyExactCalls(calls, { scored, excluded, stage }) {
  if (!Array.isArray(calls) || calls.length !== scored + excluded) {
    throw new Error(`stateBenchmarkStage2: ${stage} paid call ledger is incomplete`);
  }
  const ids = calls.map((call) => String(call.id || ''));
  if (ids.some((id, offset) => id !== `s1-call-${String(offset + 1).padStart(4, '0')}`)) {
    throw new Error(`stateBenchmarkStage2: ${stage} paid call ledger is not an exact ordered sequence`);
  }
  for (const call of calls) {
    if (
      call.status !== 'success' ||
      Number(call.provenance?.dispatch_count) !== 1 ||
      Number(call.provenance?.attempts) !== 1 ||
      Number(call.provenance?.semantic_rerolls) !== 0
    ) {
      throw new Error(`stateBenchmarkStage2: ${stage} contains a failed, undispatched, retried, or rerolled call`);
    }
  }
  const scoredRows = calls.filter((call) => call.matrix_scored_call === true);
  const canaries = calls.filter((call) => call.excluded_technical_canary === true);
  if (
    scoredRows.length !== scored ||
    canaries.length !== excluded ||
    calls.some(
      (call) =>
        (call.matrix_scored_call === true) === (call.excluded_technical_canary === true) ||
        (call.excluded_technical_canary === true && call.claim_eligible !== false),
    )
  ) {
    throw new Error(`stateBenchmarkStage2: ${stage} scored/canary call partition is invalid`);
  }
  return { scoredRows, canaries };
}

function withoutCreatedAt(plan) {
  const value = clone(plan);
  delete value.createdAt;
  return value;
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
    throw new Error('stateBenchmarkStage2: S1 plan lacks a self-consistent historical clean-Git attestation');
  }
  return true;
}

/**
 * An S2-only follow-up commit must not invalidate an exact paid S1. Compare
 * against the current canonical S1 transaction while preserving S1's sealed
 * historical clean-Git attestation. Current S1 source/config/CLI drift still
 * changes the expected transaction and fails closed.
 */
export function validateAdaptiveStateHistoricalS1RunPlan({ sealedPlan, expectedCurrentPlan } = {}) {
  if (!sealedPlan || !expectedCurrentPlan) {
    throw new Error('stateBenchmarkStage2: sealed and expected S1 run plans are required');
  }
  assertHistoricalCleanGitAttestation(sealedPlan.provenance?.git);
  const expected = clone(expectedCurrentPlan);
  expected.provenance = expected.provenance || {};
  expected.provenance.git = clone(sealedPlan.provenance.git);
  if (hashCanonicalJson(withoutCreatedAt(sealedPlan)) !== hashCanonicalJson(withoutCreatedAt(expected))) {
    throw new Error('stateBenchmarkStage2: S1 run plan differs from current S1-relevant sources/config/CLI contract');
  }
  return true;
}

function validateS1Lifecycle(events, calls) {
  const lifecycleTypes = ['call_reached', 'call_dispatch_started', 'call_finished', 'stage1_call_recorded'];
  const byId = new Map(calls.map((call) => [call.id, Object.fromEntries(lifecycleTypes.map((type) => [type, []]))]));
  for (const event of events.filter((row) => lifecycleTypes.includes(row.type))) {
    const bucket = byId.get(event.callId);
    if (!bucket) throw new Error(`stateBenchmarkStage2: lifecycle event names unknown call ${event.callId}`);
    bucket[event.type].push(event);
  }
  let priorRecordedSequence = 0;
  for (const [index, call] of calls.entries()) {
    const expectedIndex = index + 1;
    const lifecycle = byId.get(call.id);
    if (lifecycleTypes.some((type) => lifecycle[type].length !== 1)) {
      throw new Error(`stateBenchmarkStage2: call ${call.id} lacks an exact reached/dispatch/finished/recorded lifecycle`);
    }
    for (const type of lifecycleTypes.slice(0, 3)) {
      const event = lifecycle[type][0];
      if (Number(event.callIndex) !== expectedIndex || event.role !== call.role) {
        throw new Error(`stateBenchmarkStage2: ${call.id} lifecycle identity differs from the sealed ledger`);
      }
    }
    const finished = lifecycle.call_finished[0];
    const recorded = lifecycle.stage1_call_recorded[0];
    const orderedSequences = lifecycleTypes.map((type) => Number(lifecycle[type][0].sequence));
    if (
      orderedSequences[0] <= priorRecordedSequence ||
      orderedSequences.some((sequence, offset) => offset > 0 && sequence <= orderedSequences[offset - 1]) ||
      finished.status !== 'success' ||
      Number(finished.dispatchCount) !== 1 ||
      recorded.status !== 'success' ||
      recorded.role !== call.role ||
      Number(recorded.dispatchCount) !== 1 ||
      recorded.callSha256 !== hashCanonicalJson(call) ||
      recorded.matrixScoredCall !== call.matrix_scored_call ||
      recorded.excludedTechnicalCanary !== call.excluded_technical_canary
    ) {
      throw new Error(`stateBenchmarkStage2: ${call.id} lifecycle outcome differs from its exact call record`);
    }
    priorRecordedSequence = orderedSequences.at(-1);
  }
  if (
    events.filter((event) => event.type === 'stage1_execution_started').length !== 1 ||
    events.filter((event) => event.type === 'stage1_technical_evaluated').length !== 1 ||
    events.some((event) => ['stage1_execution_stopped', 'stage1_evaluation_stopped'].includes(event.type))
  ) {
    throw new Error('stateBenchmarkStage2: S1 lifecycle is partial, stopped, or multiply started/evaluated');
  }
  const observed = events.filter((event) => event.type === 'model_observed');
  const roles = ['claude_realizer', 'codex_realizer', 'public_turn_analyzer'];
  if (
    observed.length !== roles.length ||
    hashCanonicalJson(observed.map((event) => event.role).sort()) !== hashCanonicalJson(roles)
  ) {
    throw new Error('stateBenchmarkStage2: S1 lifecycle lacks one exact observation for every paid model role');
  }
}

function validateCanonicalS1Transaction({
  verification,
  criticalPlan,
  dataset,
  verifiedS0,
  config,
  configPath,
  parentRunDir,
}) {
  const cliVersions = { codex: cliFingerprint('codex'), claude: cliFingerprint('claude') };
  const expectedPlan = executionRunPlan({
    plan: criticalPlan,
    config,
    configPath: path.resolve(configPath),
    parent: verifiedS0,
    runSeed: verification.plan.randomization.masterSeed,
    cliVersions,
  });
  validateAdaptiveStateHistoricalS1RunPlan({ sealedPlan: verification.plan, expectedCurrentPlan: expectedPlan });
  if (
    verification.plan.runner !== 'scripts/execute-adaptive-state-benchmark-v2-s1.js' ||
    dataset.execution_transaction?.run_id !== verification.plan.runId ||
    dataset.execution_transaction?.run_plan_sha256 !== verification.seal.planSha256
  ) {
    throw new Error('stateBenchmarkStage2: S1 dataset is not bound to its exact clean canonical run plan');
  }
  validateS1Lifecycle(readRunEvents(parentRunDir), dataset.calls);
}

/**
 * Verify the only parent that may authorize the fixed maximum S2 plan. S1 is
 * an instrument/transfer gate only; it supplies no effect estimate and makes
 * no power claim. Passing S1 therefore authorizes exactly eight seeds/cell.
 */
export function validateAdaptiveStateS1PromotionParent({
  parentRunDir,
  s0RunDir,
  config,
  configPath,
  repoRoot = path.resolve('.'),
} = {}) {
  if (!config || !configPath) {
    throw new Error('stateBenchmarkStage2: current config and configPath are required for S1 authorization');
  }
  const verifiedS0 = validateAdaptiveStateStage1Parent({
    parentRunDir: s0RunDir,
    config,
    configPath,
    repoRoot,
  });
  const verification = verifyCompleteRun(parentRunDir, 'paid S1 parent');
  for (const fileName of Object.values(ADAPTIVE_STATE_S1_FILES)) requireSealedFile(verification, fileName);

  const criticalPlan = readJson(parentRunDir, ADAPTIVE_STATE_S1_FILES.criticalPlan, 'S1 critical-path plan');
  validateAdaptiveStateCriticalPathPlan(criticalPlan);
  const dataset = readJson(parentRunDir, ADAPTIVE_STATE_S1_FILES.dataset, 'S1 dataset');
  const split = readJson(parentRunDir, ADAPTIVE_STATE_S1_FILES.splitManifest, 'S1 split manifest');
  const report = readJson(parentRunDir, ADAPTIVE_STATE_S1_FILES.report, 'S1 technical report');
  const ledger = readJsonLines(parentRunDir, ADAPTIVE_STATE_S1_FILES.callLedger);

  const expectedCriticalPlan = buildAdaptiveStateCriticalPathPlan(config, {
    stage: 's1_technical_pilot',
    label: criticalPlan.label,
  });
  if (
    criticalPlan.stage !== 's1_technical_pilot' ||
    criticalPlan.paid !== true ||
    criticalPlan.confirmation_eligible !== false ||
    String(criticalPlan.version) !== EXPECTED_VERSION ||
    Number(criticalPlan.counts?.expected_cli_process_dispatches) !== 336 ||
    Number(criticalPlan.counts?.expected_model_calls) !== 336 ||
    criticalPlan.counts?.expected_model_calls_deprecated_alias_semantics !==
      'cli_process_dispatches_not_backend_requests' ||
    Number(criticalPlan.counts?.excluded_technical_canary_calls) !== 3 ||
    criticalPlan.config_sha256 !== hashCanonicalJson(config) ||
    hashCanonicalJson(criticalPlan) !== hashCanonicalJson(expectedCriticalPlan)
  ) {
    throw new Error('stateBenchmarkStage2: parent is not the current frozen paid S1 v2.1 matrix');
  }
  validateAdaptiveStateStage1DatasetContentSha256(dataset);
  if (
    dataset.schema !== EXPECTED_S1_DATASET_SCHEMA ||
    String(dataset.version) !== EXPECTED_VERSION ||
    dataset.stage !== 's1_technical_pilot' ||
    dataset.execution_mode !== 'paid_cli' ||
    dataset.confirmation_eligible !== false ||
    dataset.s2_validity_verdict !== null ||
    Number(dataset.scored_cli_dispatch_count) !== 336 ||
    Number(dataset.total_cli_dispatch_count) !== 339 ||
    Number(dataset.semantic_rerolls) !== 0 ||
    !Array.isArray(dataset.calls) ||
    hashCanonicalJson(dataset.calls) !== hashCanonicalJson(ledger)
  ) {
    throw new Error('stateBenchmarkStage2: S1 dataset is partial, mock, or differs from its exact paid call ledger');
  }
  verifyExactCalls(dataset.calls, { scored: 336, excluded: 3, stage: 'S1' });
  const recomputedSplit = buildAdaptiveStateStage1SplitManifest(dataset.rows, config);
  if (hashCanonicalJson(split) !== hashCanonicalJson(recomputedSplit)) {
    throw new Error('stateBenchmarkStage2: sealed S1 split manifest differs from deterministic recomputation');
  }
  const recomputedReport = buildAdaptiveStateStage1Report({
    dataset,
    plan: criticalPlan,
    config,
    splitManifest: recomputedSplit,
    repoRoot,
  });
  if (hashCanonicalJson(report) !== hashCanonicalJson(recomputedReport) || recomputedReport.status !== 'pass') {
    throw new Error('stateBenchmarkStage2: sealed S1 technical pass differs from deterministic recomputation');
  }
  if (
    hashCanonicalJson(dataset.parent) !== hashCanonicalJson(verifiedS0) ||
    verification.plan?.lineage?.parentRunId !== verifiedS0.run_id ||
    !verification.plan.lineage.parentRunId
  ) {
    throw new Error('stateBenchmarkStage2: S1 run plan does not bind its sealed S0 parent');
  }
  if (
    verification.plan?.metadata?.stage !== 's1_technical_pilot' ||
    verification.plan?.metadata?.paid !== true ||
    verification.plan?.hashes?.config !== hashFile(path.resolve(configPath)) ||
    hashCanonicalJson(verification.plan?.intent?.criticalPath) !== hashCanonicalJson(criticalPlan)
  ) {
    throw new Error('stateBenchmarkStage2: S1 run plan is stale or does not bind the recomputed paid matrix');
  }
  const metadata = verification.seal.metadata || {};
  if (
    metadata.stage1DatasetSha256 !== dataset.content_sha256 ||
    metadata.stage1CallLedgerSha256 !== hashCanonicalJson(dataset.calls) ||
    metadata.stage1SplitManifestSha256 !== split.content_sha256 ||
    metadata.stage1ReportSha256 !== report.content_sha256 ||
    Number(metadata.executedCliDispatches) !== 339 ||
    Number(metadata.scoredCliDispatches) !== 336 ||
    Number(metadata.fixedS2SeedsPerCell) !== 8 ||
    metadata.powerClaimMade !== false
  ) {
    throw new Error('stateBenchmarkStage2: S1 seal does not bind its recomputed artifacts and fixed-eight no-power boundary');
  }
  validateCanonicalS1Transaction({
    verification,
    criticalPlan,
    dataset,
    verifiedS0,
    config,
    configPath,
    parentRunDir,
  });

  const authorization = {
    schema: ADAPTIVE_STATE_S2_AUTHORIZATION_V21_SCHEMA,
    version: EXPECTED_VERSION,
    s0: clone(dataset.parent),
    s1: {
      run_id: verification.plan.runId,
      seal_sha256: hashFile(path.join(path.resolve(parentRunDir), RUN_SEAL_FILE)),
      plan_sha256: verification.seal.planSha256,
      inventory_sha256: verification.seal.inventorySha256,
      critical_path_design_sha256: criticalPlan.design_sha256,
      config_sha256: criticalPlan.config_sha256,
      dataset_sha256: dataset.content_sha256,
      call_ledger_sha256: hashCanonicalJson(dataset.calls),
      split_manifest_sha256: split.content_sha256,
      report_sha256: report.content_sha256,
    },
    selected_seeds_per_cell: 8,
    sample_size_basis: 'preregistered_bounded_maximum',
    power_claim: false,
  };
  authorization.authorization_sha256 = hashCanonicalJson(authorization);
  const result = { authorization, verification, criticalPlan, dataset, split, report };
  VERIFIED_S1_PROMOTION_PARENTS.add(result);
  return result;
}

export function assertAdaptiveStateS1PromotionParentAuthorization(value) {
  if (!value || !VERIFIED_S1_PROMOTION_PARENTS.has(value)) {
    throw new Error('stateBenchmarkStage2: S2 planning authority must come from live sealed-parent verification');
  }
  return value.authorization;
}

/**
 * Fail-closed final entrypoint. The S2 executor and deterministic S2 analysis
 * regenerator do not exist yet. Hash-linked JSON is not a substitute: until a
 * production module can regenerate the split, fitted predictions, support
 * bindings, bootstrap summaries, and lane report from the sealed dataset, no
 * S2 report is allowed to reach the verdict evaluator.
 */
export function validateAdaptiveStateStage2Run({
  runDir,
  parentRunDir,
  s0RunDir,
  config,
  configPath,
  repoRoot = path.resolve('.'),
} = {}) {
  const parent = validateAdaptiveStateS1PromotionParent({
    parentRunDir,
    s0RunDir,
    config,
    configPath,
    repoRoot,
  });
  const verification = verifyCompleteRun(runDir, 'S2 confirmation');
  for (const fileName of Object.values(ADAPTIVE_STATE_S2_FILES)) requireSealedFile(verification, fileName);

  const criticalPlan = readJson(runDir, ADAPTIVE_STATE_S2_FILES.criticalPlan, 'S2 critical-path plan');
  validateAdaptiveStateCriticalPathPlan(criticalPlan);
  if (
    criticalPlan.stage !== 's2_confirmation' ||
    criticalPlan.paid !== true ||
    criticalPlan.confirmation_eligible !== true ||
    String(criticalPlan.version) !== EXPECTED_VERSION ||
    Number(criticalPlan.counts?.seeds_per_cell) !== parent.authorization.selected_seeds_per_cell
  ) {
    throw new Error('stateBenchmarkStage2: S2 critical-path plan is not the authorized fixed-eight design');
  }
  if (
    verification.plan?.metadata?.stage !== 's2_confirmation' ||
    String(verification.plan?.metadata?.benchmarkVersion) !== EXPECTED_VERSION ||
    verification.plan?.metadata?.executionMode !== 'paid_cli' ||
    verification.plan?.lineage?.parentRunId !== parent.authorization.s1.run_id ||
    hashCanonicalJson(verification.plan?.intent?.s2Authorization) !== hashCanonicalJson(parent.authorization) ||
    hashCanonicalJson(verification.plan?.intent?.criticalPath) !== hashCanonicalJson(criticalPlan)
  ) {
    throw new Error('stateBenchmarkStage2: S2 run plan does not bind the sealed S0-to-S1 authorization lineage');
  }
  if (
    criticalPlan.provenance?.parent_s1_authorization_sha256 !== parent.authorization.authorization_sha256 ||
    criticalPlan.provenance?.parent_s1_seal_sha256 !== parent.authorization.s1.seal_sha256 ||
    criticalPlan.provenance?.sample_size_basis !== 'preregistered_bounded_maximum' ||
    criticalPlan.provenance?.power_claim !== false
  ) {
    throw new Error('stateBenchmarkStage2: S2 critical plan lacks its S1/fixed-eight no-power binding');
  }
  if (!ADAPTIVE_STATE_S2_SEMANTIC_REGENERATION_IMPLEMENTED) {
    throw new Error(
      'stateBenchmarkStage2: promotion refused because deterministic S2 split/prediction/report regeneration is not implemented',
    );
  }
  throw new Error('stateBenchmarkStage2: unreachable S2 semantic-regeneration state');
}
