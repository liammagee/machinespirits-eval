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
import { loadAdaptiveStateWorldAdapters } from '../services/adaptiveTutor/learnerKernels/index.js';

const ROOT = path.resolve('.');
const CONFIG = yaml.parse(fs.readFileSync(path.join(ROOT, 'config/adaptive-state-benchmark-v2.yaml'), 'utf8'));
const SEMANTIC_REGRESSIONS = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, 'tests/fixtures/adaptive-state-observability-5fda0824-v21.json'),
    'utf8',
  ),
);
const DERIVE_SEMANTIC_REGRESSIONS = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, 'tests/fixtures/adaptive-state-observability-8d6d2b22-v21.json'),
    'utf8',
  ),
);
const CONSTRUCT_AUDIT_FIXTURE = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, 'tests/fixtures/adaptive-state-observability-c0ccd5c9-v21.json'),
    'utf8',
  ),
);

function label(modelRef) {
  return modelRef === 'codex.gpt-5.6-terra'
    ? 'codex/gpt-5.6-terra'
    : 'claude-code/claude-sonnet-4-6';
}

function fakeRealizer({ leakEventId = false, failAt = null, capture = null } = {}) {
  let count = 0;
  return async ({ modelRef, input, expectedEventIds, effort, timeoutMs }) => {
    count += 1;
    if (capture) capture.push(structuredClone(input));
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
  const realizedInputs = [];
  const result = await executeAdaptiveStateObservabilityPreflight({
    plan,
    config: CONFIG,
    realizeTurn: fakeRealizer({ capture: realizedInputs }),
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
  assert.equal(realizedInputs.length, 24);
  for (const input of captured) {
    assert.equal(Object.hasOwn(input, 'currentPublicActEnvelope'), false);
    assert.equal(Object.hasOwn(input, 'event_family'), false);
    assert.equal(Object.hasOwn(input, 'event_ids'), false);
    assert.doesNotMatch(JSON.stringify(input), /adopt:evidence_|derive:inference_|retract:evidence_/u);
  }
  const adapters = new Map(
    loadAdaptiveStateWorldAdapters(CONFIG.critical_path.worlds, { repoRoot: ROOT }).map((adapter) => [
      adapter.id,
      adapter,
    ]),
  );
  for (const [index, job] of plan.jobs.entries()) {
    const analyzerInput = captured[index];
    const realizerInput = realizedInputs[index];
    if (job.event_family === 'none') {
      const prior = analyzerInput.priorPublicLearnerState;
      const proof = {
        heldPremiseIds: [...prior.adopted_premise_ids],
        releasedPremiseIds: [...prior.adopted_premise_ids],
        voicedDerivedFactKeys: prior.voiced_derived_facts.map((fact) => JSON.stringify(fact)),
        harmfulProofDebt: 0,
      };
      assert.equal(adapters.get(job.world.id).nextDerivableFact(proof), null, job.id);
      if (job.world.id === 'marrick') {
        assert.deepEqual(prior.voiced_derived_facts, [
          ['blankFrom', 'falseShilling', 'weirCrucible'],
          ['dieCutWith', 'falseShilling', 'wornBurin'],
        ]);
        assert.match(realizerInput.priorPublicTranscript[0].text, /already recorded the supported conclusion/iu);
      }
    }
    if (job.world.id === 'hethel' && job.event_family === 'adopt') {
      const atomic = realizerInput.currentPublicActEnvelope.events[0].evidence_surface;
      assert.match(atomic, /crown-bed mortar.*material trace/iu);
      assert.doesNotMatch(atomic, /fell because|causing the span to fall|sound arch|brought down/iu);
      assert.ok(realizerInput.publicWorldVocabulary.released_evidence_surfaces.includes(atomic));
      const staged = analyzerInput.publicStagedEvidence.find((row) => row.premise === 'p_surface');
      assert.equal(staged?.surface, atomic);
      assert.equal(analyzerInput.priorPublicLearnerState.adopted_premise_ids.includes('p_surface'), false);
    }
    if (job.world.id === 'ravensmark' && job.event_family === 'derive') {
      assert.deepEqual(analyzerInput.priorPublicLearnerState.adopted_premise_ids, ['p_mark', 'p_registry']);
      assert.deepEqual(analyzerInput.priorPublicLearnerState.voiced_derived_facts, []);
      assert.equal(analyzerInput.publicStagedEvidence.length, 2);
      assert.match(realizerInput.priorPublicTranscript[0].text, /dusk-seal[\s\S]+private-seal register/iu);
      assert.deepEqual(realizerInput.currentPublicActEnvelope.event_ids, ['derive:inference_03']);
      const proof = {
        heldPremiseIds: ['p_mark', 'p_registry'],
        releasedPremiseIds: ['p_mark', 'p_registry'],
        voicedDerivedFactKeys: [],
        harmfulProofDebt: 0,
      };
      assert.deepEqual(adapters.get(job.world.id).nextDerivableFact(proof), [
        'pressedSealFor',
        'gatePass',
        'elian',
      ]);
    }
  }
  const report = buildAdaptiveStateObservabilityPreflightReport({ plan, result, config: CONFIG });
  assert.equal(validateAdaptiveStateObservabilityPreflightReport(report), true);
  assert.equal(report.status, 'pass');
  assert.equal(report.decision, 'injected_preflight_pass_non_authorizing');
  assert.equal(report.s1_retry_eligible, false);
  assert.equal(report.s2_validity_verdict, null);
});

test('the five stopped-run outputs remain frozen semantic evidence rather than a runtime lookup', () => {
  assert.equal(
    SEMANTIC_REGRESSIONS.schema,
    'machinespirits.adaptive-state-observability-semantic-regression.v1',
  );
  assert.equal(
    SEMANTIC_REGRESSIONS.source.cases_file_sha256,
    '5c30eba3207b4df14f5ba76696bafb381a016d355dbc711c028f22fe2e07f28d',
  );
  assert.equal(
    hashCanonicalJson(SEMANTIC_REGRESSIONS),
    'b9d8cc3765952e1174026685dd31169e9320009bb400777ca0880a4c58f17e4b',
  );
  assert.equal(SEMANTIC_REGRESSIONS.cases.length, 5);
  assert.deepEqual(
    SEMANTIC_REGRESSIONS.cases.map((row) => row.semantic_expected_family),
    ['derive', 'derive', 'none', 'derive', 'derive'],
  );
  for (const row of SEMANTIC_REGRESSIONS.cases) {
    assert.equal(sha256(row.learner_text), row.learner_text_sha256);
    assert.ok(row.learner_text.includes(row.expected_evidence_span));
    assert.match(row.source_analyzer_input_sha256, /^[0-9a-f]{64}$/u);
  }
  const runtimeFiles = [
    ...fs
      .readdirSync(path.join(ROOT, 'services/adaptiveTutor'))
      .filter((file) => file.endsWith('.js'))
      .map((file) => `services/adaptiveTutor/${file}`),
    'services/tutorStubPublicLearnerAnalysis.js',
    'scripts/execute-adaptive-state-observability-preflight-v2.js',
    'scripts/execute-adaptive-state-benchmark-v2-s1.js',
  ];
  for (const file of runtimeFiles) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.doesNotMatch(source, /adaptive-state-observability-5fda0824|preflight__marrick__none/u);
  }
});

test('the two second-run derive failures stay frozen with clause-level semantic expectations', () => {
  assert.equal(
    DERIVE_SEMANTIC_REGRESSIONS.schema,
    'machinespirits.adaptive-state-observability-semantic-regression.v1',
  );
  assert.deepEqual(DERIVE_SEMANTIC_REGRESSIONS.source, {
    run_id: 'adaptive-state-v2-observability-preflight-8d6d2b22-v21',
    git_sha: '8d6d2b2214c923ec4c63b72c964fdeee4f0f47f7',
    call_ledger_file_sha256: '4e34d416a40a55363917ed14cdc0c0647a6dff91087d421c35c17f50f1916d53',
    cases_file_sha256: 'fb0cc09fc83974339457d1c4e834b6ef4d1615b42305b7c3771f59362f4cadcc',
    run_seal_file_sha256: '1b0c3141a65a3c524a05cd369d5e22887a206a120413a4cf789f2986b3e9952b',
    seal_inventory_sha256: '47b710c6201d7d93c1d1d60747fd75ee35abbb3276662d223a6114fedd38bf0b',
    report_content_sha256: 'b89390acca11a6d7a73977c1dc71406529d3ee7c7f6a83e5630a2bbebfd69b05',
    result_content_sha256: 'eca6ad06cdc19b40a0a2b727d30f5b0288c315185614b7f109a1fe541a29af15',
  });
  assert.equal(
    hashCanonicalJson(DERIVE_SEMANTIC_REGRESSIONS),
    '053ee83dcf59ca8df6436756d38fec5fd44dc26bc47f07e87c4c380a7741f6ff',
  );
  assert.deepEqual(
    DERIVE_SEMANTIC_REGRESSIONS.cases.map((row) => row.semantic_expected_family),
    ['none', 'derive'],
  );
  assert.deepEqual(DERIVE_SEMANTIC_REGRESSIONS.cases[0].harness_target_fact, [
    'blankFrom',
    'falseShilling',
    'weirCrucible',
  ]);
  assert.equal(DERIVE_SEMANTIC_REGRESSIONS.cases[0].semantic_fact_in_source_text, null);
  assert.deepEqual(DERIVE_SEMANTIC_REGRESSIONS.cases[1].harness_target_fact, [
    'materialSealAtIssue',
    'gatePass',
    'duskSeal',
  ]);
  assert.deepEqual(
    DERIVE_SEMANTIC_REGRESSIONS.cases[1].semantic_fact_in_source_text,
    DERIVE_SEMANTIC_REGRESSIONS.cases[1].harness_target_fact,
  );
  for (const row of DERIVE_SEMANTIC_REGRESSIONS.cases) {
    assert.equal(sha256(row.learner_text), row.learner_text_sha256);
    assert.ok(row.learner_text.includes(row.semantic_evidence_span));
    assert.equal(row.analyzer_public_input.learnerText, row.learner_text);
    assert.equal(hashCanonicalJson(row.analyzer_public_input), row.source_analyzer_input_sha256);
    assert.match(row.source_realizer_input_sha256, /^[0-9a-f]{64}$/u);
    assert.match(row.source_realizer_output_sha256, /^[0-9a-f]{64}$/u);
    assert.match(row.source_parsed_analyzer_output_sha256, /^[0-9a-f]{64}$/u);
  }
  const runtimeFiles = [
    ...fs
      .readdirSync(path.join(ROOT, 'services/adaptiveTutor'))
      .filter((file) => file.endsWith('.js'))
      .map((file) => `services/adaptiveTutor/${file}`),
    'services/tutorStubPublicLearnerAnalysis.js',
    'scripts/execute-adaptive-state-observability-preflight-v2.js',
    'scripts/execute-adaptive-state-benchmark-v2-s1.js',
  ];
  for (const file of runtimeFiles) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.doesNotMatch(
      source,
      /adaptive-state-observability-8d6d2b22|preflight__marrick__derive__codex_terra|preflight__ravensmark__derive__claude_sonnet/u,
    );
  }
});

test('the third-run Ravensmark failure stays frozen as construct-audit evidence, not a runtime lookup', () => {
  assert.equal(
    CONSTRUCT_AUDIT_FIXTURE.schema,
    'machinespirits.adaptive-state-observability-construct-audit-fixture.v1',
  );
  assert.deepEqual(CONSTRUCT_AUDIT_FIXTURE.source, {
    run_id: 'adaptive-state-v2-observability-preflight-c0ccd5c9-v21',
    git_sha: 'c0ccd5c920313445c678881b1f947f673803d00a',
    call_ledger_file_sha256: '29c604482a8a544df79fea9caf6b753ee11a23cc76badbf41937c1fdc4b02a99',
    cases_file_sha256: 'ea1697cb968da9efe38ce095075fb55b7559e7a2238c191718028afdb714c0bd',
    run_seal_file_sha256: 'df611f90eb3846b08890f51680653579a706d61cb378fc329ea00e458f1b82ac',
    seal_plan_sha256: 'cdd7f90b6510ec7ce3a03dee5025eef906e02ca902cb4fa4388eefee50095bf2',
    seal_inventory_sha256: '2d780e26732fedc53c191e7346852a98487bb80ee1ba7ac7625e6bdb17d8b573',
    report_content_sha256: 'f00768748f653f1033b62525ae3f5d036784febc82655ade57bd735f6d701dbe',
    result_content_sha256: '4da22737620396f35d882c0b258b768da35273993193260831c1b151801c6f68',
  });
  const row = CONSTRUCT_AUDIT_FIXTURE.case;
  assert.equal(row.intended_family, 'derive');
  assert.equal(row.observed_family, 'none');
  assert.equal(sha256(row.learner_text), row.learner_text_sha256);
  assert.equal(hashCanonicalJson(row.realizer_output), row.realizer_artifact_hashes.parsed_output_sha256);
  assert.equal(
    hashCanonicalJson(row.analyzer_parsed_output),
    row.analyzer_artifact_hashes.parsed_output_sha256,
  );
  assert.deepEqual(row.public_construct.released_premise_fact, ['sealMarkOf', 'gatePass', 'duskSeal']);
  assert.equal(row.public_construct.structural_support_rule.id, 'R1_scope');
  assert.deepEqual(row.public_construct.harness_target_fact, [
    'materialSealAtIssue',
    'gatePass',
    'duskSeal',
  ]);
  assert.equal(
    row.public_construct.audit_disposition,
    'insufficiently_separable_for_event_family_gate_retarget_to_next_relational_fact',
  );
  const runtimeFiles = [
    ...fs
      .readdirSync(path.join(ROOT, 'services/adaptiveTutor'))
      .filter((file) => file.endsWith('.js'))
      .map((file) => `services/adaptiveTutor/${file}`),
    'services/tutorStubPublicLearnerAnalysis.js',
    'scripts/execute-adaptive-state-observability-preflight-v2.js',
    'scripts/execute-adaptive-state-benchmark-v2-s1.js',
  ];
  for (const file of runtimeFiles) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.doesNotMatch(
      source,
      /adaptive-state-observability-preflight-c0ccd5c9|preflight__ravensmark__derive__claude_sonnet/u,
    );
  }
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
