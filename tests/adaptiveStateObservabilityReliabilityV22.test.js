import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import yaml from 'yaml';

import {
  appendRunEvent,
  buildExperimentRunPlan,
  canonicalJson,
  captureGitFingerprint,
  createRunPlan,
  createRunSeal,
  hashCanonicalJson,
  sha256,
} from '../services/experimentRunArtifacts.js';
import { buildAdaptiveStateCliRealizerSystemPrompt } from '../services/adaptiveTutor/stateBenchmarkCliRealizer.js';
import {
  adaptiveStateObservabilityReliabilityPlanContentSha256,
  adaptiveStateObservabilityReliabilityCallRows,
  adaptiveStateObservabilityReliabilityResultContentSha256,
  buildAdaptiveStateObservabilityReliabilityPlan,
  buildAdaptiveStateObservabilityReliabilityReport,
  executeAdaptiveStateObservabilityReliability,
  validateAdaptiveStateObservabilityReliabilityConfig,
  validateAdaptiveStateObservabilityReliabilityPlan,
  validateAdaptiveStateObservabilityReliabilityReport,
  validateAdaptiveStateObservabilityReliabilityResult,
} from '../services/adaptiveTutor/stateObservabilityReliabilityV22.js';
import { adaptiveStateObservabilityReliabilityV22StaticExecutionContract } from '../services/adaptiveTutor/stateObservabilityReliabilityV22Contracts.js';
import { validateAdaptiveStateObservabilityReliabilityV22Parent } from '../services/adaptiveTutor/stateObservabilityReliabilityV22Lineage.js';
import {
  adaptiveStateStage1StaticExecutionContract,
  cliFingerprint,
} from '../services/adaptiveTutor/stateBenchmarkStage1Contracts.js';

const ROOT = path.resolve('.');
const BENCHMARK = yaml.parse(fs.readFileSync(path.join(ROOT, 'config/adaptive-state-benchmark-v2.yaml'), 'utf8'));
const RELIABILITY = yaml.parse(
  fs.readFileSync(path.join(ROOT, 'config/adaptive-state-observability-reliability-v2.2.yaml'), 'utf8'),
);

function label(modelRef) {
  return modelRef === 'codex.gpt-5.6-terra' ? 'codex/gpt-5.6-terra' : 'claude-code/claude-sonnet-4-6';
}

function fakeRealizer() {
  return async ({ modelRef, input, expectedEventIds, effort, timeoutMs }) => {
    const family = input.currentPublicActEnvelope.event_family;
    const event = input.currentPublicActEnvelope.events?.[0];
    const learnerText =
      family === 'adopt'
        ? `I can now use this public evidence: ${event.evidence_surface}`
        : family === 'derive'
          ? 'I can now state one new supported conclusion from the public record.'
          : family === 'retract'
            ? `I withdraw this earlier public step: ${event.evidence_surface}`
            : 'I remain uncertain and do not yet have a new proof move.';
    const output = {
      learner_text: learnerText,
      realized_public_event_ids: [...expectedEventIds],
    };
    const systemPrompt = buildAdaptiveStateCliRealizerSystemPrompt();
    const userPrompt = canonicalJson(input);
    const rawOutput = JSON.stringify(output);
    const resolved = label(modelRef);
    return {
      output,
      raw_output: rawOutput,
      call_artifacts: { system_prompt: systemPrompt, user_prompt: userPrompt },
      call_metadata: {
        status: 'success',
        requested_model_ref: modelRef,
        resolved_model_ref: resolved,
        observed_model_ref: resolved,
        effort,
        timeout_ms: timeoutMs,
        attempts: 1,
        dispatch_count: 1,
        semantic_rerolls: 0,
        structured_output_reported: true,
        stream_event_type_counts: {},
        stream_item_type_counts: {},
        structured_event_audit: resolved.startsWith('codex/')
          ? { policy: 'strict_no_tools_allowlist', invalid_jsonl_line_count: 0 }
          : { enforcement: 'claude_tools_disabled' },
        invalid_stream_lines: 0,
        prohibited_tool_event_count: 0,
        input_sha256: hashCanonicalJson(input),
        system_prompt_sha256: sha256(systemPrompt),
        user_prompt_sha256: sha256(userPrompt),
        raw_output_sha256: sha256(rawOutput),
        output_sha256: hashCanonicalJson(output),
        model_attestation: {
          basis: 'explicit_cli_model_argument_accepted_bridge_echo',
          independently_attested: false,
        },
      },
    };
  };
}

function inferFamily(text) {
  if (text.startsWith('I withdraw')) return 'retract';
  if (text.includes('new supported conclusion')) return 'derive';
  if (text.includes('now use this public evidence')) return 'adopt';
  return 'none';
}

function fakeAnalyzer(drawId, wrongCells) {
  return async ({ publicModelInput, modelRef, effort, timeoutMs, context }) => {
    const inferred = inferFamily(publicModelInput.learnerText);
    const wrong = wrongCells.has(`${drawId}|${context.job_id}`);
    const family = wrong ? (inferred === 'none' ? 'adopt' : 'none') : inferred;
    const benchmarkTransitionEvent = { family, evidence_span: publicModelInput.learnerText };
    const parsed = {
      classification: { turn: { summary: 'fixture' }, overall: { summary: 'fixture' } },
      learner_record: {},
      benchmark_transition: benchmarkTransitionEvent,
    };
    const systemPrompt = 'fixture analyzer system';
    const prompt = canonicalJson(publicModelInput);
    const outputSchema = { type: 'object' };
    const rawText = JSON.stringify(parsed);
    return {
      rawAnalysis: { systemPrompt, prompt, outputSchema, rawText, parsed },
      classification: parsed.classification,
      learnerRecordUpdate: parsed.learner_record,
      benchmarkTransitionEvent,
      call_metadata: {
        status: 'success',
        requested_model_ref: modelRef,
        resolved_model_ref: 'codex/gpt-5.6-terra',
        observed_model_ref: 'codex/gpt-5.6-terra',
        effort,
        timeout_ms: timeoutMs,
        attempts: 1,
        dispatch_count: 1,
        semantic_rerolls: 0,
        structured_output_reported: true,
        model_attestation_basis: 'explicit_cli_argument_accepted',
        model_independently_attested: false,
        stream_event_type_counts: {},
        stream_item_type_counts: {},
        structured_event_audit: { policy: 'strict_no_tools_allowlist', invalid_jsonl_line_count: 0 },
        invalid_stream_lines: 0,
        prohibited_tool_event_count: 0,
        input_sha256: hashCanonicalJson({ systemPrompt, prompt, outputSchema }),
        system_prompt_sha256: sha256(systemPrompt),
        prompt_sha256: sha256(prompt),
        output_schema_sha256: hashCanonicalJson(outputSchema),
        raw_output_sha256: sha256(rawText),
        parsed_output_sha256: hashCanonicalJson(parsed),
      },
    };
  };
}

async function executeFixture(wrong = []) {
  const plan = buildAdaptiveStateObservabilityReliabilityPlan(BENCHMARK, RELIABILITY, {
    label: 'fixture-reliability-v22',
  });
  const wrongCells = new Set(wrong);
  const result = await executeAdaptiveStateObservabilityReliability({
    plan,
    benchmarkConfig: BENCHMARK,
    reliabilityConfig: RELIABILITY,
    createDrawSeams: async ({ drawId }) => ({
      realizeTurn: fakeRealizer(),
      analyzePublicText: fakeAnalyzer(drawId, wrongCells),
    }),
    repoRoot: ROOT,
  });
  return { plan, result };
}

test('v2.2 config and plan freeze three complete 24-cell draw blocks', () => {
  assert.equal(validateAdaptiveStateObservabilityReliabilityConfig(RELIABILITY), true);
  const plan = buildAdaptiveStateObservabilityReliabilityPlan(BENCHMARK, RELIABILITY, {
    label: 'fixture-plan-v22',
  });
  assert.equal(validateAdaptiveStateObservabilityReliabilityPlan(plan, BENCHMARK, RELIABILITY), true);
  assert.equal(plan.jobs.length, 72);
  assert.equal(plan.child_plans.length, 3);
  assert.equal(plan.counts.total_cli_dispatches, 144);
  assert.equal(new Set(plan.jobs.map((row) => row.id)).size, 72);
  assert.deepEqual(plan.axes.draw_blocks, ['draw_01', 'draw_02', 'draw_03']);
  assert.equal(plan.pass_contract.minimum_exact_family_matches, 70);

  const mutated = structuredClone(plan);
  mutated.pass_contract.minimum_exact_family_matches = 69;
  mutated.content_sha256 = adaptiveStateObservabilityReliabilityPlanContentSha256(mutated);
  assert.throws(
    () => validateAdaptiveStateObservabilityReliabilityPlan(mutated, BENCHMARK, RELIABILITY),
    /invalid frozen plan envelope or contract/,
  );
});

test('complete injected reliability execution passes at 72/72 but remains non-authorizing', async () => {
  const { plan, result } = await executeFixture();
  assert.equal(validateAdaptiveStateObservabilityReliabilityResult(result, plan, BENCHMARK, RELIABILITY), true);
  assert.equal(result.cases.length, 72);
  assert.equal(result.call_accounting.dispatched, 144);
  assert.equal(result.exact_family_matches, 72);
  assert.equal(result.reliability_gate_passed, true);
  const report = buildAdaptiveStateObservabilityReliabilityReport({
    plan,
    result,
    benchmarkConfig: BENCHMARK,
    reliabilityConfig: RELIABILITY,
  });
  assert.equal(validateAdaptiveStateObservabilityReliabilityReport(report), true);
  assert.equal(report.status, 'pass');
  assert.equal(report.decision, 'injected_reliability_pass_non_authorizing');
  assert.equal(report.s1_retry_eligible, false);
});

test('one retained semantic miss passes the repeated-draw reliability thresholds', async () => {
  const failedCell = 'preflight__ravensmark__derive__codex_terra';
  const { plan, result } = await executeFixture([`draw_01|${failedCell}`]);
  assert.equal(result.exact_family_matches, 71);
  assert.equal(result.reliability_gate_passed, true);
  assert.deepEqual(result.recovery.by_base_cell[failedCell], { passed: 2, total: 3 });
  assert.equal(validateAdaptiveStateObservabilityReliabilityResult(result, plan, BENCHMARK, RELIABILITY), true);
});

test('only a paid-bound passing result authorizes the separately invoked S1 retry', async () => {
  const { plan, result } = await executeFixture(['draw_01|preflight__ravensmark__derive__codex_terra']);
  const digest = 'a'.repeat(64);
  result.execution_mode = 'paid_cli';
  result.execution_transaction = {
    run_id: 'paid-fixture-reliability-v22',
    run_plan_sha256: digest,
    reliability_hashes_sha256: digest,
    s1_relevant_hashes_sha256: digest,
    cli_fingerprints_sha256: digest,
  };
  result.content_sha256 = adaptiveStateObservabilityReliabilityResultContentSha256(result);
  assert.equal(validateAdaptiveStateObservabilityReliabilityResult(result, plan, BENCHMARK, RELIABILITY), true);
  const report = buildAdaptiveStateObservabilityReliabilityReport({
    plan,
    result,
    benchmarkConfig: BENCHMARK,
    reliabilityConfig: RELIABILITY,
  });
  assert.equal(report.status, 'pass');
  assert.equal(report.decision, 'authorize_separately_confirmed_full_s1_retry');
  assert.equal(report.s1_retry_eligible, true);
});

test('a sealed paid v2.2 pass is accepted as the current S1 reliability parent', async () => {
  const { plan, result } = await executeFixture(['draw_01|preflight__ravensmark__derive__codex_terra']);
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptive-reliability-v22-lineage-'));
  const benchmarkConfigPath = path.join(ROOT, 'config/adaptive-state-benchmark-v2.yaml');
  const reliabilityConfigPath = path.join(ROOT, 'config/adaptive-state-observability-reliability-v2.2.yaml');
  const s0Parent = {
    run_id: 'fixture-current-s0',
    plan_sha256: 'a'.repeat(64),
    seal_inventory_sha256: 'b'.repeat(64),
    config_sha256: 'c'.repeat(64),
  };
  const stoppedPreflightRunId = 'fixture-stopped-v21-preflight';
  try {
    const git = captureGitFingerprint({ repoRoot: ROOT });
    delete git.repoRoot;
    git.statusSha256 = sha256('');
    git.patchSha256 = sha256('');
    git.dirty = false;
    git.untracked = [];
    git.fingerprintSha256 = hashCanonicalJson({
      sha: git.sha,
      branch: git.branch,
      statusSha256: git.statusSha256,
      patchSha256: git.patchSha256,
      untracked: git.untracked,
    });
    const cliFingerprints = {
      codex: cliFingerprint('codex', { repoRoot: ROOT }),
      claude: cliFingerprint('claude', { repoRoot: ROOT }),
    };
    const reliabilityContract = adaptiveStateObservabilityReliabilityV22StaticExecutionContract({
      benchmarkConfig: BENCHMARK,
      benchmarkConfigPath,
      reliabilityConfig: RELIABILITY,
      reliabilityConfigPath,
      repoRoot: ROOT,
    });
    const s1Contract = adaptiveStateStage1StaticExecutionContract({
      config: BENCHMARK,
      configPath: benchmarkConfigPath,
      repoRoot: ROOT,
    });
    const runPlan = buildExperimentRunPlan({
      runId: plan.label,
      runner: 'scripts/execute-adaptive-state-observability-reliability-v22.js',
      provenance: { git },
      models: {
        codex_realizer: {
          requested: 'codex.gpt-5.6-terra',
          resolved: 'codex/gpt-5.6-terra',
          observed: null,
          allowedObservedModels: ['codex/gpt-5.6-terra'],
        },
        claude_realizer: {
          requested: 'claude-code.sonnet',
          resolved: 'claude-code/claude-sonnet-4-6',
          observed: null,
          allowedObservedModels: ['claude-code/claude-sonnet-4-6'],
        },
        public_turn_analyzer: {
          requested: 'codex.gpt-5.6-terra',
          resolved: 'codex/gpt-5.6-terra',
          observed: null,
          allowedObservedModels: ['codex/gpt-5.6-terra'],
        },
      },
      requiredObservedModelRoles: [],
      hashes: reliabilityContract,
      masterSeed: 20260712,
      jobs: plan.jobs,
      lineage: { parentRunId: stoppedPreflightRunId, resumeOf: null, supersedes: [] },
      intent: { observabilityReliability: plan },
      metadata: {
        stage: 's1_observability_reliability_gate',
        paid: true,
        claimEligible: false,
        expectedCliDispatches: 144,
        s0ParentRunId: s0Parent.run_id,
        s0ParentPlanSha256: s0Parent.plan_sha256,
        s0ParentSealInventorySha256: s0Parent.seal_inventory_sha256,
        s0ConfigSha256: s0Parent.config_sha256,
        diagnosesStoppedPreflightRunId: stoppedPreflightRunId,
        cliFingerprints,
        cliFingerprintsSha256: hashCanonicalJson(cliFingerprints),
        s1RelevantHashesSha256: hashCanonicalJson(s1Contract.hashes),
        reliabilityPlanSha256: plan.content_sha256,
      },
    });
    const created = createRunPlan(temporaryRoot, runPlan);
    result.execution_mode = 'paid_cli';
    result.execution_transaction = {
      run_id: runPlan.runId,
      run_plan_sha256: created.sha256,
      reliability_hashes_sha256: hashCanonicalJson(runPlan.hashes),
      s1_relevant_hashes_sha256: hashCanonicalJson(s1Contract.hashes),
      cli_fingerprints_sha256: hashCanonicalJson(cliFingerprints),
    };
    result.content_sha256 = adaptiveStateObservabilityReliabilityResultContentSha256(result);
    const report = buildAdaptiveStateObservabilityReliabilityReport({
      plan,
      result,
      benchmarkConfig: BENCHMARK,
      reliabilityConfig: RELIABILITY,
    });
    const callRows = adaptiveStateObservabilityReliabilityCallRows(result.draw_results);
    fs.writeFileSync(path.join(temporaryRoot, 'observability-reliability-plan.json'), canonicalJson(plan));
    fs.writeFileSync(path.join(temporaryRoot, 'observability-reliability-result.json'), canonicalJson(result));
    fs.writeFileSync(path.join(temporaryRoot, 'observability-reliability-report.json'), canonicalJson(report));
    fs.writeFileSync(
      path.join(temporaryRoot, 'observability-reliability-call-ledger.jsonl'),
      `${callRows.map((row) => canonicalJson(row)).join('\n')}\n`,
    );
    fs.writeFileSync(
      path.join(temporaryRoot, 'observability-reliability-cases.jsonl'),
      `${result.cases.map((row) => canonicalJson(row)).join('\n')}\n`,
    );
    appendRunEvent(temporaryRoot, { type: 'observability_reliability_started' });
    for (const [index, row] of callRows.entries()) {
      const callIndex = index + 1;
      for (const type of ['call_reached', 'call_dispatch_started', 'call_finished']) {
        appendRunEvent(temporaryRoot, {
          type,
          callId: row.id,
          callIndex,
          role: row.child_call.role,
          status: type === 'call_finished' ? 'success' : undefined,
          dispatchCount: type === 'call_finished' ? 1 : undefined,
        });
      }
      appendRunEvent(temporaryRoot, {
        type: 'observability_reliability_call_recorded',
        callId: row.id,
        callIndex,
        role: row.child_call.role,
        status: 'success',
        dispatchCount: 1,
      });
    }
    appendRunEvent(temporaryRoot, { type: 'observability_reliability_evaluated' });
    createRunSeal(temporaryRoot, {
      status: 'complete',
      metadata: {
        decision: report.decision,
        reliabilityPlanSha256: plan.content_sha256,
        reliabilityResultSha256: result.content_sha256,
        reliabilityReportSha256: report.content_sha256,
        executedCliDispatches: 144,
        exactFamilyMatches: result.exact_family_matches,
        s1RetryEligible: true,
      },
    });
    const verified = validateAdaptiveStateObservabilityReliabilityV22Parent({
      reliabilityRunDir: temporaryRoot,
      s0Parent,
      benchmarkConfig: BENCHMARK,
      benchmarkConfigPath,
      reliabilityConfig: RELIABILITY,
      reliabilityConfigPath,
      repoRoot: ROOT,
    });
    assert.equal(verified.run_id, plan.label);
    assert.equal(verified.decision, 'authorize_separately_confirmed_full_s1_retry');
    assert.equal(verified.s0_parent_run_id, s0Parent.run_id);
    assert.equal(verified.diagnoses_stopped_preflight_run_id, stoppedPreflightRunId);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('repeated failure in one base cell stops even when aggregate recovery is 70/72', async () => {
  const failedCell = 'preflight__ravensmark__derive__codex_terra';
  const { plan, result } = await executeFixture([`draw_01|${failedCell}`, `draw_02|${failedCell}`]);
  assert.equal(result.exact_family_matches, 70);
  assert.equal(result.gate_checks.overall_exact, true);
  assert.equal(result.gate_checks.every_base_cell, false);
  assert.equal(result.gate_checks.every_language_realizer, false);
  assert.equal(result.reliability_gate_passed, false);
  result.content_sha256 = adaptiveStateObservabilityReliabilityResultContentSha256(result);
  assert.equal(validateAdaptiveStateObservabilityReliabilityResult(result, plan, BENCHMARK, RELIABILITY), true);
});

test('protocol config threshold drift fails closed', () => {
  const mutated = structuredClone(RELIABILITY);
  mutated.pass_contract.minimum_matches_per_base_cell = 1;
  assert.throws(() => validateAdaptiveStateObservabilityReliabilityConfig(mutated), /protocol config drifted/);
});
