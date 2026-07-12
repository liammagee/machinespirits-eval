import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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
import {
  adaptiveStateObservabilityPreflightPlanContentSha256,
  adaptiveStateObservabilityPreflightResultContentSha256,
  buildAdaptiveStateObservabilityPreflightPlan,
  buildAdaptiveStateObservabilityPreflightReport,
  executeAdaptiveStateObservabilityPreflight,
  validateAdaptiveStateObservabilityPreflightPlan,
  validateAdaptiveStateObservabilityPreflightReport,
  validateAdaptiveStateObservabilityPreflightResult,
} from '../services/adaptiveTutor/stateObservabilityPreflight.js';
import { buildAdaptiveStateCliRealizerSystemPrompt } from '../services/adaptiveTutor/stateBenchmarkCliRealizer.js';
import {
  adaptiveStateStage1StaticExecutionContract,
  cliFingerprint,
} from '../services/adaptiveTutor/stateBenchmarkStage1Contracts.js';
import { validateAdaptiveStateObservabilityPreflightParent } from '../services/adaptiveTutor/stateObservabilityPreflightLineage.js';
import { adaptiveStateObservabilityPreflightStaticExecutionContract } from '../services/adaptiveTutor/stateObservabilityPreflightContracts.js';

const ROOT = path.resolve('.');
const CONFIG = yaml.parse(fs.readFileSync(path.join(ROOT, 'config/adaptive-state-benchmark-v2.yaml'), 'utf8'));

function label(modelRef) {
  return modelRef === 'codex.gpt-5.6-terra'
    ? 'codex/gpt-5.6-terra'
    : 'claude-code/claude-sonnet-4-6';
}

function fakeRealizer({ leakEventId = false, failAt = null } = {}) {
  let count = 0;
  return async ({ modelRef, input, expectedEventIds, effort, timeoutMs }) => {
    count += 1;
    if (count === failAt) {
      const error = new Error('fixture realizer failure');
      error.callMetadata = {
        requested_model_ref: modelRef,
        resolved_model_ref: label(modelRef),
        observed_model_ref: label(modelRef),
        dispatch_count: 1,
        attempts: 1,
        semantic_rerolls: 0,
      };
      throw error;
    }
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
      learner_text: leakEventId && expectedEventIds[0] ? `${learnerText} ${expectedEventIds[0]}` : learnerText,
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

function fakeAnalyzer({ wrongJob = null, capture = null } = {}) {
  return async ({ publicModelInput, modelRef, effort, timeoutMs, context }) => {
    if (capture) capture.push(structuredClone(publicModelInput));
    const inferred = inferFamily(publicModelInput.learnerText);
    const family = context.job_id === wrongJob ? (inferred === 'none' ? 'adopt' : 'none') : inferred;
    const benchmarkTransitionEvent = {
      family,
      evidence_span: publicModelInput.learnerText,
    };
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

test('preflight plan freezes the exact 3 x 4 x 2 matrix and 48 serial dispatches', () => {
  const plan = buildAdaptiveStateObservabilityPreflightPlan(CONFIG, { label: 'fixture-preflight' });
  assert.equal(validateAdaptiveStateObservabilityPreflightPlan(plan, CONFIG), true);
  assert.equal(plan.jobs.length, 24);
  assert.equal(plan.counts.total_cli_dispatches, 48);
  assert.deepEqual(plan.axes.event_families, ['none', 'adopt', 'derive', 'retract']);
  assert.equal(new Set(plan.jobs.map((job) => `${job.world.id}|${job.event_family}|${job.language_realizer.id}`)).size, 24);
  assert.ok(plan.jobs.every((job) => job.claim_eligible === false));

  for (const mutate of [
    (copy) => {
      copy.pass_contract.required_exact_family_matches = 23;
    },
    (copy) => {
      copy.jobs[0].id = 'mutated-job';
    },
    (copy) => {
      copy.jobs[0].expected_analyzer_dispatches = 0;
    },
    (copy) => {
      copy.jobs[0].language_realizer.model_ref = 'codex.gpt-5.5';
    },
  ]) {
    const copy = structuredClone(plan);
    mutate(copy);
    copy.content_sha256 = adaptiveStateObservabilityPreflightPlanContentSha256(copy);
    assert.throws(
      () => validateAdaptiveStateObservabilityPreflightPlan(copy, CONFIG),
      /pass contract|matrix cell|frozen config matrix/u,
    );
  }
});

test('paid preflight is explicitly locked and full S1 cannot bypass its parent', () => {
  const help = spawnSync(process.execPath, ['scripts/execute-adaptive-state-observability-preflight-v2.js', '--help'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /48 serial CLI dispatches/u);
  assert.match(help.stdout, /never launches the 339-dispatch S1 matrix automatically/u);

  const locked = spawnSync(process.execPath, ['scripts/execute-adaptive-state-observability-preflight-v2.js'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.notEqual(locked.status, 0);
  assert.match(locked.stderr, /Paid observability preflight is locked/u);

  const bypass = spawnSync(
    process.execPath,
    [
      'scripts/execute-adaptive-state-benchmark-v2-s1.js',
      '--confirm-paid-s1-v2.1',
      '--s0-parent',
      '/does-not-matter',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.notEqual(bypass.status, 0);
  assert.match(bypass.stderr, /--preflight-parent is required/u);
});

test('preflight executes 24 isolated public cases and passes only at 24/24', async () => {
  const plan = buildAdaptiveStateObservabilityPreflightPlan(CONFIG, { label: 'fixture-pass' });
  const captured = [];
  const result = await executeAdaptiveStateObservabilityPreflight({
    plan,
    config: CONFIG,
    realizeTurn: fakeRealizer(),
    analyzePublicText: fakeAnalyzer({ capture: captured }),
    repoRoot: ROOT,
  });
  assert.equal(validateAdaptiveStateObservabilityPreflightResult(result, plan, CONFIG), true);
  assert.equal(result.calls.length, 48);
  assert.equal(result.call_accounting.dispatched, 48);
  assert.equal(result.cases.length, 24);
  assert.equal(result.exact_family_matches, 24);
  assert.equal(result.all_cases_passed, true);
  assert.ok(result.calls.every((call) => call.claim_eligible === false));
  assert.equal(captured.length, 24);
  for (const input of captured) {
    assert.equal(Object.hasOwn(input, 'currentPublicActEnvelope'), false);
    assert.equal(Object.hasOwn(input, 'event_family'), false);
    assert.equal(Object.hasOwn(input, 'event_ids'), false);
    assert.doesNotMatch(JSON.stringify(input), /adopt:evidence_|derive:inference_|retract:evidence_/u);
  }
  const report = buildAdaptiveStateObservabilityPreflightReport({ plan, result, config: CONFIG });
  assert.equal(validateAdaptiveStateObservabilityPreflightReport(report), true);
  assert.equal(report.status, 'pass');
  assert.equal(report.decision, 'injected_preflight_pass_non_authorizing');
  assert.equal(report.s1_retry_eligible, false);
  assert.equal(report.s2_validity_verdict, null);
});

test('a complete but wrong-family matrix stops instead of authorizing S1', async () => {
  const plan = buildAdaptiveStateObservabilityPreflightPlan(CONFIG, { label: 'fixture-wrong-family' });
  const wrongJob = plan.jobs[7].id;
  const result = await executeAdaptiveStateObservabilityPreflight({
    plan,
    config: CONFIG,
    realizeTurn: fakeRealizer(),
    analyzePublicText: fakeAnalyzer({ wrongJob }),
    repoRoot: ROOT,
  });
  assert.equal(result.exact_family_matches, 23);
  assert.equal(result.all_cases_passed, false);
  const report = buildAdaptiveStateObservabilityPreflightReport({ plan, result, config: CONFIG });
  assert.equal(report.status, 'stop');
  assert.equal(report.decision, 'stop_and_repair_observability_preflight');
  assert.equal(report.s1_retry_eligible, false);
  assert.deepEqual(report.failures.map((row) => row.id), [wrongJob]);
});

test('a sealed passing preflight is a current-runtime S1 prerequisite', async () => {
  const plan = buildAdaptiveStateObservabilityPreflightPlan(CONFIG, { label: 'fixture-sealed-pass' });
  const result = await executeAdaptiveStateObservabilityPreflight({
    plan,
    config: CONFIG,
    realizeTurn: fakeRealizer(),
    analyzePublicText: fakeAnalyzer(),
    repoRoot: ROOT,
  });
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptive-observability-lineage-'));
  const cliFingerprints = {
    codex: cliFingerprint('codex', { repoRoot: ROOT }),
    claude: cliFingerprint('claude', { repoRoot: ROOT }),
  };
  const s1Contract = adaptiveStateStage1StaticExecutionContract({
    config: CONFIG,
    configPath: path.join(ROOT, 'config/adaptive-state-benchmark-v2.yaml'),
    repoRoot: ROOT,
  });
  const preflightContract = adaptiveStateObservabilityPreflightStaticExecutionContract({
    config: CONFIG,
    configPath: path.join(ROOT, 'config/adaptive-state-benchmark-v2.yaml'),
    repoRoot: ROOT,
  });
  const s0Parent = { run_id: 'fixture-s0', report_sha256: 'a'.repeat(64) };
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
    const runPlan = buildExperimentRunPlan({
      runId: plan.label,
      runner: 'scripts/execute-adaptive-state-observability-preflight-v2.js',
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
      hashes: preflightContract,
      masterSeed: 20260712,
      jobs: plan.jobs,
      lineage: { parentRunId: 'fixture-stopped-s1', resumeOf: null, supersedes: [] },
      intent: { observabilityPreflight: plan },
      metadata: {
        stage: 's1_observability_preflight',
        paid: true,
        claimEligible: false,
        expectedCliDispatches: 48,
        s0ParentRunId: s0Parent.run_id,
        diagnosesStoppedS1RunId: 'fixture-stopped-s1',
        cliFingerprints,
        cliFingerprintsSha256: hashCanonicalJson(cliFingerprints),
        s1RelevantHashesSha256: hashCanonicalJson(s1Contract.hashes),
        preflightPlanSha256: plan.content_sha256,
      },
    });
    const created = createRunPlan(temporaryRoot, runPlan);
    result.execution_mode = 'paid_cli';
    result.execution_transaction = {
      run_id: runPlan.runId,
      run_plan_sha256: created.sha256,
      preflight_hashes_sha256: hashCanonicalJson(runPlan.hashes),
      s1_relevant_hashes_sha256: hashCanonicalJson(s1Contract.hashes),
      cli_fingerprints_sha256: hashCanonicalJson(cliFingerprints),
    };
    result.content_sha256 = adaptiveStateObservabilityPreflightResultContentSha256(result);
    validateAdaptiveStateObservabilityPreflightResult(result, plan, CONFIG);
    const report = buildAdaptiveStateObservabilityPreflightReport({ plan, result, config: CONFIG });
    assert.equal(report.decision, 'authorize_full_s1_retry');
    assert.equal(report.s1_retry_eligible, true);
    fs.writeFileSync(path.join(temporaryRoot, 'observability-preflight-plan.json'), canonicalJson(plan));
    fs.writeFileSync(path.join(temporaryRoot, 'observability-preflight-result.json'), canonicalJson(result));
    fs.writeFileSync(path.join(temporaryRoot, 'observability-preflight-report.json'), canonicalJson(report));
    fs.writeFileSync(
      path.join(temporaryRoot, 'observability-preflight-call-ledger.jsonl'),
      `${result.calls.map((row) => canonicalJson(row)).join('\n')}\n`,
    );
    fs.writeFileSync(
      path.join(temporaryRoot, 'observability-preflight-cases.jsonl'),
      `${result.cases.map((row) => canonicalJson(row)).join('\n')}\n`,
    );
    appendRunEvent(temporaryRoot, { type: 'observability_preflight_started' });
    for (const [index, call] of result.calls.entries()) {
      const callIndex = index + 1;
      const context = { job_id: call.job_id };
      appendRunEvent(temporaryRoot, {
        type: 'call_reached',
        callId: call.id,
        callIndex,
        role: call.role,
        context,
      });
      appendRunEvent(temporaryRoot, {
        type: 'call_dispatch_started',
        callId: call.id,
        callIndex,
        role: call.role,
        context,
      });
      appendRunEvent(temporaryRoot, {
        type: 'call_finished',
        callId: call.id,
        callIndex,
        role: call.role,
        context,
        status: 'success',
        dispatchCount: 1,
      });
      appendRunEvent(temporaryRoot, {
        type: 'observability_preflight_call_recorded',
        callId: call.id,
        callIndex,
        role: call.role,
        status: 'success',
        jobId: call.job_id,
        dispatchCount: 1,
        callSha256: hashCanonicalJson(call),
      });
    }
    for (const [role, requested, observed] of [
      ['codex_realizer', 'codex.gpt-5.6-terra', 'codex/gpt-5.6-terra'],
      ['claude_realizer', 'claude-code.sonnet', 'claude-code/claude-sonnet-4-6'],
      ['public_turn_analyzer', 'codex.gpt-5.6-terra', 'codex/gpt-5.6-terra'],
    ]) {
      appendRunEvent(temporaryRoot, {
        type: 'model_observed',
        role,
        requested,
        resolved: observed,
        observed,
        independentlyAttested: false,
      });
    }
    appendRunEvent(temporaryRoot, { type: 'observability_preflight_evaluated' });
    createRunSeal(temporaryRoot, {
      status: 'complete',
      metadata: {
        decision: 'authorize_full_s1_retry',
        preflightPlanSha256: plan.content_sha256,
        preflightResultSha256: result.content_sha256,
        preflightReportSha256: report.content_sha256,
        executedCliDispatches: 48,
      },
    });
    const verified = validateAdaptiveStateObservabilityPreflightParent({
      preflightRunDir: temporaryRoot,
      s0Parent,
      config: CONFIG,
      configPath: path.join(ROOT, 'config/adaptive-state-benchmark-v2.yaml'),
      repoRoot: ROOT,
    });
    assert.equal(verified.run_id, plan.label);
    assert.equal(verified.decision, 'authorize_full_s1_retry');
    assert.equal(verified.diagnoses_stopped_s1_run_id, 'fixture-stopped-s1');
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('event-id leakage stops immediately and partial calls cannot form a report', async () => {
  const plan = buildAdaptiveStateObservabilityPreflightPlan(CONFIG, { label: 'fixture-leak' });
  await assert.rejects(
    executeAdaptiveStateObservabilityPreflight({
      plan,
      config: CONFIG,
      realizeTurn: fakeRealizer({ leakEventId: true }),
      analyzePublicText: fakeAnalyzer(),
      repoRoot: ROOT,
    }),
    (error) => {
      assert.match(error.message, /harness-owned public event id/u);
      assert.equal(error.preflightPartial.call_accounting.failed, 1);
      assert.equal(error.preflightPartial.completed_cases.length, 6);
      return true;
    },
  );
});

test('technical failure records exact partial accounting and never reuses a case', async () => {
  const plan = buildAdaptiveStateObservabilityPreflightPlan(CONFIG, { label: 'fixture-failure' });
  await assert.rejects(
    executeAdaptiveStateObservabilityPreflight({
      plan,
      config: CONFIG,
      realizeTurn: fakeRealizer({ failAt: 2 }),
      analyzePublicText: fakeAnalyzer(),
      repoRoot: ROOT,
    }),
    (error) => {
      assert.equal(error.preflightPartial.call_accounting.reached, 3);
      assert.equal(error.preflightPartial.call_accounting.dispatched, 3);
      assert.equal(error.preflightPartial.call_accounting.completed, 2);
      assert.equal(error.preflightPartial.call_accounting.failed, 1);
      assert.equal(error.preflightPartial.completed_cases.length, 1);
      assert.match(error.preflightPartial.disposition, /never_resume_same_label/u);
      return true;
    },
  );
});

test('result validator rejects a rehashed analyzer-input leak', async () => {
  const plan = buildAdaptiveStateObservabilityPreflightPlan(CONFIG, { label: 'fixture-mutation' });
  const result = await executeAdaptiveStateObservabilityPreflight({
    plan,
    config: CONFIG,
    realizeTurn: fakeRealizer(),
    analyzePublicText: fakeAnalyzer(),
    repoRoot: ROOT,
  });
  const mutated = structuredClone(result);
  const analyzerCall = mutated.calls.find((call) => call.role === 'public_turn_analyzer');
  analyzerCall.artifacts.public_input.event_family = 'adopt';
  analyzerCall.artifact_hashes.public_input_sha256 = hashCanonicalJson(analyzerCall.artifacts.public_input);
  const row = mutated.cases.find((item) => item.analyzer_call_id === analyzerCall.id);
  row.analyzer_input_sha256 = analyzerCall.artifact_hashes.public_input_sha256;
  mutated.content_sha256 = adaptiveStateObservabilityPreflightResultContentSha256(mutated);
  assert.throws(
    () => validateAdaptiveStateObservabilityPreflightResult(mutated),
    /analyzer input key set differs|forbidden analyzer input/u,
  );

  const nestedMutation = structuredClone(result);
  const nestedAnalyzerCall = nestedMutation.calls.find((call) => call.role === 'public_turn_analyzer');
  nestedAnalyzerCall.artifacts.public_input.world.secret = 'hidden fixture secret';
  nestedAnalyzerCall.artifact_hashes.public_input_sha256 = hashCanonicalJson(
    nestedAnalyzerCall.artifacts.public_input,
  );
  const nestedRow = nestedMutation.cases.find(
    (item) => item.analyzer_call_id === nestedAnalyzerCall.id,
  );
  nestedRow.analyzer_input_sha256 = nestedAnalyzerCall.artifact_hashes.public_input_sha256;
  nestedMutation.content_sha256 = adaptiveStateObservabilityPreflightResultContentSha256(nestedMutation);
  assert.throws(
    () => validateAdaptiveStateObservabilityPreflightResult(nestedMutation),
    /analyzer input nested public schema differs|forbidden analyzer input/u,
  );
});
