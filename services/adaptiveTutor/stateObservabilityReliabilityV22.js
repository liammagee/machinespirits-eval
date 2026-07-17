import { hashCanonicalJson } from '../experimentRunArtifacts.js';
import {
  buildAdaptiveStateObservabilityPreflightPlan,
  executeAdaptiveStateObservabilityPreflight,
  validateAdaptiveStateObservabilityPreflightPlan,
  validateAdaptiveStateObservabilityPreflightResult,
} from './stateObservabilityPreflight.js';

export const ADAPTIVE_STATE_OBSERVABILITY_RELIABILITY_PLAN_SCHEMA =
  'machinespirits.adaptive-state-observability-reliability-plan.v2.2';
export const ADAPTIVE_STATE_OBSERVABILITY_RELIABILITY_RESULT_SCHEMA =
  'machinespirits.adaptive-state-observability-reliability-result.v2.2';
export const ADAPTIVE_STATE_OBSERVABILITY_RELIABILITY_REPORT_SCHEMA =
  'machinespirits.adaptive-state-observability-reliability-report.v2.2';

const VERSION = '2.2';
const DRAW_IDS = Object.freeze(['draw_01', 'draw_02', 'draw_03']);
const FAMILIES = Object.freeze(['none', 'adopt', 'derive', 'retract']);
const EXPECTED_DESIGN = Object.freeze({
  base_matrix: {
    worlds: 3,
    event_families: [...FAMILIES],
    language_realizers: 2,
    cells: 24,
  },
  independent_draws_per_cell: 3,
  draw_blocks: [...DRAW_IDS],
  total_cases: 72,
  realizer_cli_dispatches: 72,
  analyzer_cli_dispatches: 72,
  total_cli_dispatches: 144,
  execution_order: 'serial_complete_balanced_draw_blocks',
  backend_request_count: 'unknown',
});
const EXPECTED_EXECUTION_CONTRACT = Object.freeze({
  retries: 0,
  semantic_rerolls: 0,
  repairs: 0,
  fallbacks: 0,
  exclusions: 0,
  partial_reuse: false,
  prior_preflight_rows_reused: false,
  stop_on_technical_failure: true,
  continue_after_semantic_mismatch: true,
  retain_every_draw: true,
});
const EXPECTED_PASS_CONTRACT = Object.freeze({
  required_complete_cases: 72,
  required_cli_dispatches: 144,
  minimum_exact_family_matches: 70,
  minimum_matches_per_draw_block: 23,
  minimum_matches_per_base_cell: 2,
  minimum_matches_per_world: 23,
  minimum_matches_per_event_family: 17,
  minimum_matches_per_language_realizer: 35,
  exact_nonempty_learner_text_evidence_span: true,
  exact_event_id_in_learner_text_forbidden: true,
  analyzer_structural_target_leak_forbidden: true,
  exact_one_dispatch_per_role_per_case: true,
});
const EXPECTED_DECISION_CONTRACT = Object.freeze({
  pass: 'authorize_separately_confirmed_full_s1_retry',
  stop: 'stop_observability_channel_no_s1',
  existing_v2_1_results_reinterpreted: false,
  automatically_launch_s1: false,
});

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function withoutContentSha256(value) {
  const copy = clone(value);
  delete copy.content_sha256;
  return copy;
}

export function adaptiveStateObservabilityReliabilityPlanContentSha256(plan) {
  return hashCanonicalJson(withoutContentSha256(plan));
}

export function adaptiveStateObservabilityReliabilityResultContentSha256(result) {
  return hashCanonicalJson(withoutContentSha256(result));
}

export function adaptiveStateObservabilityReliabilityReportContentSha256(report) {
  return hashCanonicalJson(withoutContentSha256(report));
}

export function validateAdaptiveStateObservabilityReliabilityConfig(config) {
  if (
    config?.schema !== 'machinespirits.adaptive-state-observability-reliability-config.v2.2' ||
    String(config?.version) !== VERSION ||
    config?.status !== 'prospectively_frozen_before_paid_execution' ||
    hashCanonicalJson(config?.design) !== hashCanonicalJson(EXPECTED_DESIGN) ||
    hashCanonicalJson(config?.execution_contract) !== hashCanonicalJson(EXPECTED_EXECUTION_CONTRACT) ||
    hashCanonicalJson(config?.pass_contract) !== hashCanonicalJson(EXPECTED_PASS_CONTRACT) ||
    hashCanonicalJson(config?.decision_contract) !== hashCanonicalJson(EXPECTED_DECISION_CONTRACT)
  ) {
    throw new Error('stateObservabilityReliabilityV22: protocol config drifted from the frozen v2.2 contract');
  }
  return true;
}

function buildJobs(childPlans) {
  return childPlans.flatMap((draw) =>
    draw.plan.jobs.map((job) => ({
      id: `reliability__${draw.draw_id}__${job.id}`,
      draw_id: draw.draw_id,
      draw_index: draw.draw_index,
      base_cell_id: job.id,
      world: clone(job.world),
      event_family: job.event_family,
      language_realizer: clone(job.language_realizer),
      claim_eligible: false,
      expected_realizer_dispatches: 1,
      expected_analyzer_dispatches: 1,
    })),
  );
}

export function buildAdaptiveStateObservabilityReliabilityPlan(
  benchmarkConfig,
  reliabilityConfig,
  { label = 'adaptive-state-v2-observability-reliability-v22' } = {},
) {
  validateAdaptiveStateObservabilityReliabilityConfig(reliabilityConfig);
  const childPlans = DRAW_IDS.map((drawId, index) => ({
    draw_id: drawId,
    draw_index: index + 1,
    plan: buildAdaptiveStateObservabilityPreflightPlan(benchmarkConfig, {
      label: `${label}__${drawId}`,
    }),
  }));
  const plan = {
    schema: ADAPTIVE_STATE_OBSERVABILITY_RELIABILITY_PLAN_SCHEMA,
    version: VERSION,
    label: String(label),
    stage: 's1_observability_reliability_gate',
    paid: true,
    claim_eligible: false,
    confirmation_eligible: false,
    s2_validity_verdict: null,
    axes: {
      draw_blocks: [...DRAW_IDS],
      worlds: benchmarkConfig.critical_path.worlds.map((row) => row.id),
      event_families: [...FAMILIES],
      language_realizers: benchmarkConfig.critical_path.language_realizers.map((row) => row.id),
    },
    counts: clone(EXPECTED_DESIGN),
    execution: clone(EXPECTED_EXECUTION_CONTRACT),
    pass_contract: clone(EXPECTED_PASS_CONTRACT),
    decision_contract: clone(EXPECTED_DECISION_CONTRACT),
    child_plans: childPlans,
    jobs: buildJobs(childPlans),
  };
  plan.content_sha256 = adaptiveStateObservabilityReliabilityPlanContentSha256(plan);
  validateAdaptiveStateObservabilityReliabilityPlan(plan, benchmarkConfig, reliabilityConfig);
  return plan;
}

export function validateAdaptiveStateObservabilityReliabilityPlan(plan, benchmarkConfig, reliabilityConfig) {
  validateAdaptiveStateObservabilityReliabilityConfig(reliabilityConfig);
  if (
    plan?.schema !== ADAPTIVE_STATE_OBSERVABILITY_RELIABILITY_PLAN_SCHEMA ||
    String(plan?.version) !== VERSION ||
    plan?.stage !== 's1_observability_reliability_gate' ||
    plan?.paid !== true ||
    plan?.claim_eligible !== false ||
    plan?.confirmation_eligible !== false ||
    plan?.s2_validity_verdict !== null ||
    plan?.content_sha256 !== adaptiveStateObservabilityReliabilityPlanContentSha256(plan) ||
    hashCanonicalJson(plan?.counts) !== hashCanonicalJson(EXPECTED_DESIGN) ||
    hashCanonicalJson(plan?.execution) !== hashCanonicalJson(EXPECTED_EXECUTION_CONTRACT) ||
    hashCanonicalJson(plan?.pass_contract) !== hashCanonicalJson(EXPECTED_PASS_CONTRACT) ||
    hashCanonicalJson(plan?.decision_contract) !== hashCanonicalJson(EXPECTED_DECISION_CONTRACT)
  ) {
    throw new Error('stateObservabilityReliabilityV22: invalid frozen plan envelope or contract');
  }
  if (
    !Array.isArray(plan.child_plans) ||
    plan.child_plans.length !== 3 ||
    !Array.isArray(plan.jobs) ||
    plan.jobs.length !== 72 ||
    hashCanonicalJson(plan.axes?.draw_blocks) !== hashCanonicalJson(DRAW_IDS) ||
    hashCanonicalJson(plan.axes?.event_families) !== hashCanonicalJson(FAMILIES)
  ) {
    throw new Error('stateObservabilityReliabilityV22: plan lacks the exact 72-case repeated matrix');
  }
  for (const [index, draw] of plan.child_plans.entries()) {
    if (draw.draw_id !== DRAW_IDS[index] || Number(draw.draw_index) !== index + 1) {
      throw new Error('stateObservabilityReliabilityV22: draw block order drifted');
    }
    validateAdaptiveStateObservabilityPreflightPlan(draw.plan, benchmarkConfig);
    if (draw.plan.label !== `${plan.label}__${draw.draw_id}`) {
      throw new Error('stateObservabilityReliabilityV22: child plan label is not parent-bound');
    }
  }
  const expectedJobs = buildJobs(plan.child_plans);
  if (hashCanonicalJson(plan.jobs) !== hashCanonicalJson(expectedJobs)) {
    throw new Error('stateObservabilityReliabilityV22: parent jobs differ from frozen child matrices');
  }
  const expectedCells = new Set(
    DRAW_IDS.flatMap((drawId) =>
      plan.axes.worlds.flatMap((world) =>
        FAMILIES.flatMap((family) =>
          plan.axes.language_realizers.map((realizer) => `${drawId}|${world}|${family}|${realizer}`),
        ),
      ),
    ),
  );
  const observedCells = new Set(
    plan.jobs.map((job) => `${job.draw_id}|${job.world.id}|${job.event_family}|${job.language_realizer.id}`),
  );
  if (
    observedCells.size !== 72 ||
    hashCanonicalJson([...observedCells].sort()) !== hashCanonicalJson([...expectedCells].sort())
  ) {
    throw new Error('stateObservabilityReliabilityV22: repeated matrix is incomplete or duplicated');
  }
  return true;
}

function parentCallAccounting(drawResults) {
  const calls = drawResults.flatMap((draw) => draw.result.calls);
  return {
    planned: 144,
    reached: calls.length,
    dispatched: calls.reduce((sum, call) => sum + Number(call.provenance?.dispatch_count || 0), 0),
    completed: calls.filter((call) => call.status === 'success').length,
    failed: calls.filter((call) => call.status === 'technical_failure').length,
    by_role: {
      codex_realizer: {
        planned: 36,
        completed: calls.filter((call) => call.role === 'codex_realizer' && call.status === 'success').length,
      },
      claude_realizer: {
        planned: 36,
        completed: calls.filter((call) => call.role === 'claude_realizer' && call.status === 'success').length,
      },
      public_turn_analyzer: {
        planned: 72,
        completed: calls.filter((call) => call.role === 'public_turn_analyzer' && call.status === 'success').length,
      },
    },
  };
}

export function adaptiveStateObservabilityReliabilityCallRows(drawResults) {
  return drawResults.flatMap((draw) =>
    draw.result.calls.map((call, index) => ({
      id: `reliability-call-${String((draw.draw_index - 1) * 48 + index + 1).padStart(3, '0')}`,
      draw_id: draw.draw_id,
      draw_index: draw.draw_index,
      child_call_id: call.id,
      child_job_id: call.job_id,
      child_call: clone(call),
    })),
  );
}

function flattenCases(drawResults) {
  return drawResults.flatMap((draw) =>
    draw.result.cases.map((row) => ({
      ...clone(row),
      id: `reliability__${draw.draw_id}__${row.id}`,
      child_case_id: row.id,
      draw_id: draw.draw_id,
      draw_index: draw.draw_index,
      base_cell_id: row.id,
      schema: 'machinespirits.adaptive-state-observability-reliability-case.v2.2',
      version: VERSION,
    })),
  );
}

function groupedRecovery(cases, key) {
  return Object.fromEntries(
    [...new Set(cases.map((row) => row[key]))].sort().map((value) => {
      const rows = cases.filter((row) => row[key] === value);
      return [value, { passed: rows.filter((row) => row.passed).length, total: rows.length }];
    }),
  );
}

function gateEvaluation(cases, accounting) {
  const exact = cases.filter((row) => row.passed).length;
  const byDraw = groupedRecovery(cases, 'draw_id');
  const byCell = groupedRecovery(cases, 'base_cell_id');
  const byWorld = groupedRecovery(cases, 'world_id');
  const byFamily = groupedRecovery(cases, 'event_family');
  const byRealizer = groupedRecovery(cases, 'realizer_id');
  const checks = {
    complete_cases: cases.length === EXPECTED_PASS_CONTRACT.required_complete_cases,
    complete_dispatches:
      accounting.dispatched === EXPECTED_PASS_CONTRACT.required_cli_dispatches &&
      accounting.completed === EXPECTED_PASS_CONTRACT.required_cli_dispatches &&
      accounting.failed === 0,
    overall_exact: exact >= EXPECTED_PASS_CONTRACT.minimum_exact_family_matches,
    every_draw_block: Object.values(byDraw).every(
      (row) => row.total === 24 && row.passed >= EXPECTED_PASS_CONTRACT.minimum_matches_per_draw_block,
    ),
    every_base_cell: Object.values(byCell).every(
      (row) => row.total === 3 && row.passed >= EXPECTED_PASS_CONTRACT.minimum_matches_per_base_cell,
    ),
    every_world: Object.values(byWorld).every(
      (row) => row.total === 24 && row.passed >= EXPECTED_PASS_CONTRACT.minimum_matches_per_world,
    ),
    every_event_family: Object.values(byFamily).every(
      (row) => row.total === 18 && row.passed >= EXPECTED_PASS_CONTRACT.minimum_matches_per_event_family,
    ),
    every_language_realizer: Object.values(byRealizer).every(
      (row) => row.total === 36 && row.passed >= EXPECTED_PASS_CONTRACT.minimum_matches_per_language_realizer,
    ),
    exact_spans_and_no_event_id_leaks: cases.every(
      (row) => row.exact_learner_text_evidence_span === true && row.harness_event_id_in_learner_text === false,
    ),
  };
  return {
    passed: Object.values(checks).every(Boolean),
    exact_family_matches: exact,
    checks,
    recovery: {
      by_draw_block: byDraw,
      by_base_cell: byCell,
      by_world: byWorld,
      by_event_family: byFamily,
      by_realizer: byRealizer,
    },
  };
}

export async function executeAdaptiveStateObservabilityReliability({
  plan,
  benchmarkConfig,
  reliabilityConfig,
  createDrawSeams,
  onCall = null,
  repoRoot,
} = {}) {
  validateAdaptiveStateObservabilityReliabilityPlan(plan, benchmarkConfig, reliabilityConfig);
  if (typeof createDrawSeams !== 'function') {
    throw new Error('stateObservabilityReliabilityV22: createDrawSeams is required');
  }
  const drawResults = [];
  for (const draw of plan.child_plans) {
    const seams = await createDrawSeams({
      drawId: draw.draw_id,
      drawIndex: draw.draw_index,
      callOffset: (draw.draw_index - 1) * 48,
    });
    if (typeof seams?.realizeTurn !== 'function' || typeof seams?.analyzePublicText !== 'function') {
      throw new Error(`stateObservabilityReliabilityV22: missing seams for ${draw.draw_id}`);
    }
    try {
      const result = await executeAdaptiveStateObservabilityPreflight({
        plan: draw.plan,
        config: benchmarkConfig,
        realizeTurn: seams.realizeTurn,
        analyzePublicText: seams.analyzePublicText,
        onCall: async (call) => {
          if (typeof onCall === 'function') {
            const childIndex = Number(String(call.id).replace(/^preflight-call-/u, ''));
            await onCall({
              draw_id: draw.draw_id,
              draw_index: draw.draw_index,
              parent_call_id: `reliability-call-${String((draw.draw_index - 1) * 48 + childIndex).padStart(3, '0')}`,
              parent_call_index: (draw.draw_index - 1) * 48 + childIndex,
              child_call: clone(call),
            });
          }
        },
        repoRoot,
      });
      drawResults.push({ draw_id: draw.draw_id, draw_index: draw.draw_index, result });
    } catch (error) {
      error.reliabilityPartial = {
        completed_draw_results: clone(drawResults),
        failing_draw: draw.draw_id,
        failing_draw_partial: clone(error.preflightPartial || null),
        disposition: 'stopped_never_resume_same_label_no_partial_reuse',
      };
      throw error;
    }
  }
  const cases = flattenCases(drawResults);
  const accounting = parentCallAccounting(drawResults);
  const gate = gateEvaluation(cases, accounting);
  const result = {
    schema: ADAPTIVE_STATE_OBSERVABILITY_RELIABILITY_RESULT_SCHEMA,
    version: VERSION,
    stage: 's1_observability_reliability_gate',
    claim_eligible: false,
    confirmation_eligible: false,
    s2_validity_verdict: null,
    plan_content_sha256: plan.content_sha256,
    execution_order: EXPECTED_DESIGN.execution_order,
    semantic_rerolls: 0,
    repairs: 0,
    fallbacks: 0,
    exclusions: 0,
    partial_reuse: false,
    prior_preflight_rows_reused: false,
    backend_request_count: 'unknown',
    execution_mode: 'unsealed_injected_execution',
    execution_transaction: null,
    call_accounting: accounting,
    draw_results: drawResults,
    cases,
    exact_family_matches: gate.exact_family_matches,
    gate_checks: gate.checks,
    recovery: gate.recovery,
    reliability_gate_passed: gate.passed,
  };
  result.content_sha256 = adaptiveStateObservabilityReliabilityResultContentSha256(result);
  validateAdaptiveStateObservabilityReliabilityResult(result, plan, benchmarkConfig, reliabilityConfig);
  return result;
}

export function validateAdaptiveStateObservabilityReliabilityResult(result, plan, benchmarkConfig, reliabilityConfig) {
  validateAdaptiveStateObservabilityReliabilityPlan(plan, benchmarkConfig, reliabilityConfig);
  if (
    result?.schema !== ADAPTIVE_STATE_OBSERVABILITY_RELIABILITY_RESULT_SCHEMA ||
    String(result?.version) !== VERSION ||
    result?.stage !== 's1_observability_reliability_gate' ||
    result?.claim_eligible !== false ||
    result?.confirmation_eligible !== false ||
    result?.s2_validity_verdict !== null ||
    result?.plan_content_sha256 !== plan.content_sha256 ||
    result?.content_sha256 !== adaptiveStateObservabilityReliabilityResultContentSha256(result) ||
    result?.execution_order !== EXPECTED_DESIGN.execution_order ||
    Number(result?.semantic_rerolls) !== 0 ||
    Number(result?.repairs) !== 0 ||
    Number(result?.fallbacks) !== 0 ||
    Number(result?.exclusions) !== 0 ||
    result?.partial_reuse !== false ||
    result?.prior_preflight_rows_reused !== false ||
    result?.backend_request_count !== 'unknown'
  ) {
    throw new Error('stateObservabilityReliabilityV22: invalid result envelope or execution contract');
  }
  const paid = result.execution_mode === 'paid_cli';
  if (
    (!paid && (result.execution_mode !== 'unsealed_injected_execution' || result.execution_transaction !== null)) ||
    (paid &&
      (!result.execution_transaction?.run_id ||
        !/^[0-9a-f]{64}$/u.test(String(result.execution_transaction?.run_plan_sha256 || '')) ||
        !/^[0-9a-f]{64}$/u.test(String(result.execution_transaction?.reliability_hashes_sha256 || '')) ||
        !/^[0-9a-f]{64}$/u.test(String(result.execution_transaction?.s1_relevant_hashes_sha256 || '')) ||
        !/^[0-9a-f]{64}$/u.test(String(result.execution_transaction?.cli_fingerprints_sha256 || ''))))
  ) {
    throw new Error('stateObservabilityReliabilityV22: result lacks a valid injected or paid binding');
  }
  if (!Array.isArray(result.draw_results) || result.draw_results.length !== 3) {
    throw new Error('stateObservabilityReliabilityV22: result lacks three complete draw blocks');
  }
  for (const [index, draw] of result.draw_results.entries()) {
    const planned = plan.child_plans[index];
    if (draw.draw_id !== planned.draw_id || Number(draw.draw_index) !== planned.draw_index) {
      throw new Error('stateObservabilityReliabilityV22: result draw order differs from plan');
    }
    validateAdaptiveStateObservabilityPreflightResult(draw.result, planned.plan, benchmarkConfig);
  }
  const cases = flattenCases(result.draw_results);
  const accounting = parentCallAccounting(result.draw_results);
  const calls = adaptiveStateObservabilityReliabilityCallRows(result.draw_results);
  const gate = gateEvaluation(cases, accounting);
  if (
    hashCanonicalJson(result.cases) !== hashCanonicalJson(cases) ||
    hashCanonicalJson(result.call_accounting) !== hashCanonicalJson(accounting) ||
    Number(result.exact_family_matches) !== gate.exact_family_matches ||
    hashCanonicalJson(result.gate_checks) !== hashCanonicalJson(gate.checks) ||
    hashCanonicalJson(result.recovery) !== hashCanonicalJson(gate.recovery) ||
    result.reliability_gate_passed !== gate.passed
  ) {
    throw new Error('stateObservabilityReliabilityV22: aggregates or gate decision are not recomputable');
  }
  if (
    result.cases.length !== 72 ||
    new Set(result.cases.map((row) => row.id)).size !== 72 ||
    calls.length !== 144 ||
    new Set(calls.map((row) => row.id)).size !== 144 ||
    result.call_accounting.dispatched !== 144 ||
    result.call_accounting.completed !== 144 ||
    result.call_accounting.failed !== 0
  ) {
    throw new Error('stateObservabilityReliabilityV22: result is not the complete 72-case/144-dispatch transaction');
  }
  return true;
}

export function buildAdaptiveStateObservabilityReliabilityReport({
  plan,
  result,
  benchmarkConfig,
  reliabilityConfig,
} = {}) {
  validateAdaptiveStateObservabilityReliabilityResult(result, plan, benchmarkConfig, reliabilityConfig);
  const paidExecutionBound =
    result.reliability_gate_passed === true &&
    result.execution_mode === 'paid_cli' &&
    result.execution_transaction !== null;
  const report = {
    schema: ADAPTIVE_STATE_OBSERVABILITY_RELIABILITY_REPORT_SCHEMA,
    version: VERSION,
    stage: 's1_observability_reliability_gate',
    status: result.reliability_gate_passed ? 'pass' : 'stop',
    decision: result.reliability_gate_passed
      ? paidExecutionBound
        ? EXPECTED_DECISION_CONTRACT.pass
        : 'injected_reliability_pass_non_authorizing'
      : EXPECTED_DECISION_CONTRACT.stop,
    claim_eligible: false,
    confirmation_eligible: false,
    s1_retry_eligible: paidExecutionBound,
    s2_validity_verdict: null,
    execution_mode: result.execution_mode,
    paid_execution_bound: paidExecutionBound,
    plan_content_sha256: plan.content_sha256,
    result_content_sha256: result.content_sha256,
    thresholds: clone(EXPECTED_PASS_CONTRACT),
    coverage: {
      completed_cases: result.cases.length,
      required_cases: 72,
      exact_family_matches: result.exact_family_matches,
      exact_family_recovery: result.exact_family_matches / 72,
      cli_dispatches: result.call_accounting.dispatched,
      required_cli_dispatches: 144,
      backend_request_count: 'unknown',
    },
    gate_checks: clone(result.gate_checks),
    recovery: clone(result.recovery),
    failures: result.cases
      .filter((row) => !row.passed)
      .map((row) => ({
        id: row.id,
        draw_id: row.draw_id,
        base_cell_id: row.base_cell_id,
        intended_family: row.event_family,
        observed_family: row.analyzer_observed_family,
      })),
    claim_boundary:
      'This repeated-draw gate tests combined public realization/analyzer reliability only. It is not a learner-state sensor, policy, efficacy, human-learning, or deployment result.',
  };
  report.content_sha256 = adaptiveStateObservabilityReliabilityReportContentSha256(report);
  validateAdaptiveStateObservabilityReliabilityReport(report);
  return report;
}

export function validateAdaptiveStateObservabilityReliabilityReport(report) {
  if (
    report?.schema !== ADAPTIVE_STATE_OBSERVABILITY_RELIABILITY_REPORT_SCHEMA ||
    String(report?.version) !== VERSION ||
    report?.stage !== 's1_observability_reliability_gate' ||
    report?.claim_eligible !== false ||
    report?.confirmation_eligible !== false ||
    report?.s2_validity_verdict !== null ||
    report?.content_sha256 !== adaptiveStateObservabilityReliabilityReportContentSha256(report) ||
    hashCanonicalJson(report?.thresholds) !== hashCanonicalJson(EXPECTED_PASS_CONTRACT)
  ) {
    throw new Error('stateObservabilityReliabilityV22: invalid report envelope or thresholds');
  }
  const pass =
    Object.values(report.gate_checks || {}).length === 9 &&
    Object.values(report.gate_checks || {}).every(Boolean) &&
    Number(report.coverage?.completed_cases) === 72 &&
    Number(report.coverage?.required_cases) === 72 &&
    Number(report.coverage?.cli_dispatches) === 144 &&
    Number(report.coverage?.required_cli_dispatches) === 144 &&
    Number(report.coverage?.exact_family_matches) >= 70 &&
    Number(report.coverage?.exact_family_matches) <= 72 &&
    Array.isArray(report.failures) &&
    report.failures.length === 72 - Number(report.coverage?.exact_family_matches);
  const paidExecutionBound = pass && report.execution_mode === 'paid_cli' && report.paid_execution_bound === true;
  const expectedDecision = pass
    ? paidExecutionBound
      ? EXPECTED_DECISION_CONTRACT.pass
      : 'injected_reliability_pass_non_authorizing'
    : EXPECTED_DECISION_CONTRACT.stop;
  if (
    report.status !== (pass ? 'pass' : 'stop') ||
    report.decision !== expectedDecision ||
    report.s1_retry_eligible !== paidExecutionBound ||
    report.paid_execution_bound !== paidExecutionBound ||
    !Array.isArray(report.failures) ||
    Number(report.coverage?.exact_family_matches) < 0 ||
    Number(report.coverage?.exact_family_matches) > 72
  ) {
    throw new Error('stateObservabilityReliabilityV22: report decision is not recomputable');
  }
  return true;
}
