import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after, before } from 'node:test';
import yaml from 'yaml';

import { canonicalJson, hashCanonicalJson, sha256 } from '../services/experimentRunArtifacts.js';
import { buildAdaptiveStateCliRealizerSystemPrompt } from '../services/adaptiveTutor/stateBenchmarkCliRealizer.js';
import {
  adaptiveStateStage1DatasetContentSha256,
  executeAdaptiveStateStage1,
  validateAdaptiveStateStage1Parent,
} from '../services/adaptiveTutor/stateBenchmarkStage1Executor.js';
import {
  auditAdaptiveStateStage1Dataset,
  adaptiveStateStage1ReportContentSha256,
  adaptiveStateStage1SplitManifestContentSha256,
  buildAdaptiveStateStage1Report,
  buildAdaptiveStateStage1SplitManifest,
  validateAdaptiveStateStage1ReportContentSha256,
} from '../services/adaptiveTutor/stateBenchmarkStage1Analysis.js';
import { buildAdaptiveStateCriticalPathPlan } from '../services/adaptiveTutor/stateBenchmarkV2.js';
import {
  createAdaptiveStateStage1LiveSeams,
  createAdaptiveStateStage1ProductionLiveSeams,
} from '../services/adaptiveTutor/stateBenchmarkStage1LiveAdapters.js';
import { buildTutorStubStateObservation } from '../services/adaptiveTutor/tutorStubStateAdapter.js';
import { createTutorStubDagFactDropoutState } from '../services/tutorStubDagFactDropout.js';
import {
  applyTutorStubPublicLearnerRecordUpdate,
  buildTutorStubPublicLearnerAnalysisTurnRecord,
  createTutorStubPublicLearnerRecord,
  extractTutorStubPublicLearnerAnalysis,
  splitTutorStubPublicLearnerAnalysis,
} from '../services/tutorStubPublicLearnerAnalysis.js';
import { adaptiveStateStage1StaticExecutionContract } from '../scripts/execute-adaptive-state-benchmark-v2-s1.js';

const ROOT = path.resolve('.');
const CONFIG_PATH = path.join(ROOT, 'config', 'adaptive-state-benchmark-v2.yaml');

let temporaryRoot;
let config;
let plan;
let parent;
let completeDataset;
let capturedAnalyzerInputs;

function validAnalysis({ learnerRecord = {}, benchmarkTransition = null } = {}) {
  return {
    classification: {
      turn: {
        summary: 'The learner makes one public evidence move.',
        request_type: 'stepwise_support_request',
        discourse_move: 'evidence_adoption',
        evidence_use: 'cites_public_evidence',
        epistemic_stance: 'exploratory',
        affect: 'engaged',
        agency: 'attempting',
        scores: {
          conceptual_engagement: { score: 3, reason: 'Uses current public material.' },
          epistemic_readiness: { score: 3, reason: 'Keeps the inference provisional.' },
        },
        pedagogical_need: 'Connect the evidence to the next public rule.',
      },
      overall: {
        summary: 'The learner is accumulating public evidence.',
        trajectory: 'developing',
        recurring_pattern: 'evidence first',
        current_state: 'working from public clues',
        next_best_tutor_move: 'Ask for a warranted link.',
      },
    },
    learner_record: {
      human_discourse: { proof_status: 'provisional_scaffold' },
      notes: 'Fixture analyzer intentionally codes only adoption.',
      ...learnerRecord,
    },
    ...(benchmarkTransition ? { benchmark_transition: benchmarkTransition } : {}),
  };
}

function expectedCliLabel(modelRef) {
  if (modelRef === 'codex.gpt-5.6-terra') return 'codex/gpt-5.6-terra';
  if (modelRef === 'claude-code.sonnet') return 'claude-code/claude-sonnet-4-6';
  throw new Error(`unexpected model ref ${modelRef}`);
}

function createRealizer({ mutateMetadata = null, malformed = false, fail = null } = {}) {
  return async ({ modelRef, input, expectedEventIds, effort, timeoutMs, context }) => {
    const label = expectedCliLabel(modelRef);
    if (fail?.(context)) {
      const error = new Error('fixture realizer failure');
      error.callMetadata = {
        status: 'technical_failure',
        requested_model_ref: modelRef,
        resolved_model_ref: label,
        observed_model_ref: label,
        effort,
        timeout_ms: timeoutMs,
        attempts: 1,
        dispatch_count: 1,
        semantic_rerolls: 0,
        structured_output_reported: true,
      };
      error.raw_output = '{';
      throw error;
    }
    const event = input.currentPublicActEnvelope.events?.[0] || null;
    const output = {
      learner_text:
        input.currentPublicActEnvelope.event_family === 'retract'
          ? `I withdraw this public step: ${event?.evidence_surface || 'the unsupported hypothesis'}`
          : input.currentPublicActEnvelope.event_family === 'derive'
            ? 'I can state the supported inference from the public record.'
            : event?.evidence_surface
              ? `I can use this public evidence now: ${event.evidence_surface}`
              : 'I can state where the public inquiry currently stands.',
      realized_public_event_ids: [...expectedEventIds],
    };
    const rawOutput = JSON.stringify(output);
    const systemPrompt = buildAdaptiveStateCliRealizerSystemPrompt();
    const userPrompt = canonicalJson(input);
    const metadata = {
      status: 'success',
      requested_model_ref: modelRef,
      resolved_model_ref: label,
      observed_model_ref: label,
      effort,
      timeout_ms: timeoutMs,
      attempts: 1,
      dispatch_count: 1,
      semantic_rerolls: 0,
      structured_output_reported: true,
      stream_event_type_counts: {},
      stream_item_type_counts: {},
      structured_event_audit: label.startsWith('codex/')
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
    };
    if (mutateMetadata) mutateMetadata(metadata, context);
    return malformed
      ? {
          raw_output: rawOutput,
          call_artifacts: { system_prompt: systemPrompt, user_prompt: userPrompt },
          call_metadata: metadata,
        }
      : {
          output,
          raw_output: rawOutput,
          call_artifacts: { system_prompt: systemPrompt, user_prompt: userPrompt },
          call_metadata: metadata,
        };
  };
}

function createAnalyzerText({ capture = null, mutateMetadata = null, fail = null } = {}) {
  return async ({
    publicModelInput,
    modelRef,
    effort,
    timeoutMs,
    parseMode,
    context,
  }) => {
    if (capture) capture.push(structuredClone(publicModelInput));
    if (fail?.(context)) {
      const error = new Error('fixture analyzer failure');
      error.callMetadata = {
        status: 'technical_failure',
        requested_model_ref: modelRef,
        resolved_model_ref: 'codex/gpt-5.6-terra',
        observed_model_ref: 'codex/gpt-5.6-terra',
        model_attestation_basis: 'explicit_cli_argument_accepted',
        model_independently_attested: false,
        effort,
        timeout_ms: timeoutMs,
        attempts: 1,
        dispatch_count: 1,
        semantic_rerolls: 0,
        structured_output_reported: true,
      };
      error.raw_output = '{';
      throw error;
    }
    const staged = publicModelInput.publicStagedEvidence;
    const voiced = staged.filter((row) => publicModelInput.learnerText.includes(row.surface));
    const learnerRecord = publicModelInput.learnerText.startsWith('I withdraw')
      ? { retract: voiced.length ? [voiced.at(-1).premise] : [] }
      : { adopt: voiced.length ? [voiced.at(-1).premise] : [] };
    const alreadyAdopted = new Set(publicModelInput.priorPublicLearnerState.adopted_premise_ids);
    const family = publicModelInput.learnerText.startsWith('I withdraw')
      ? 'retract'
      : publicModelInput.learnerText.includes('supported inference')
        ? 'derive'
        : voiced.some((row) => !alreadyAdopted.has(row.premise))
          ? 'adopt'
          : 'none';
    const payload = validAnalysis({
      learnerRecord,
      benchmarkTransition: {
        family,
        evidence_span: publicModelInput.learnerText,
      },
    });
    const rawAnalysis = await extractTutorStubPublicLearnerAnalysis({
      learnerText: publicModelInput.learnerText,
      topic: publicModelInput.topic,
      world: publicModelInput.world,
      tutorTurn: publicModelInput.tutorTurn,
      currentTutorText: publicModelInput.currentTutorText,
      publicTranscript: publicModelInput.publicTranscript,
      publicStagedEvidence: publicModelInput.publicStagedEvidence,
      priorPublicLearnerState: publicModelInput.priorPublicLearnerState,
      includeBenchmarkTransitionEvent: true,
      parseMode,
      promptContext: publicModelInput.promptContext,
      modelCallOptions: {
        requestedProvider: 'codex',
        requestedModel: modelRef,
        resolvedProvider: 'codex',
        resolvedModel: 'gpt-5.6-terra',
      },
      callModel: async () => ({
        text: JSON.stringify(payload),
        provider: 'codex',
        model: 'gpt-5.6-terra',
        modelAttestationBasis: 'explicit_cli_model_argument_accepted_bridge_echo',
        modelIndependentlyAttested: false,
        structuredOutput: true,
        latencyMs: 2,
        call_metadata: {
          requested_model_ref: modelRef,
          resolved_provider: 'codex',
          resolved_model: 'gpt-5.6-terra',
          observed_provider: 'codex',
          observed_model: 'gpt-5.6-terra',
          model_attestation_basis: 'explicit_cli_model_argument_accepted_bridge_echo',
          model_independently_attested: false,
          effort,
          timeout_ms: timeoutMs,
          attempts: 1,
          dispatch_count: 1,
          semantic_rerolls: 0,
          structured_output_reported: true,
        },
      }),
    });
    const split = splitTutorStubPublicLearnerAnalysis(rawAnalysis, {
      strict: true,
      includeBenchmarkTransitionEvent: true,
    });
    const result = {
      rawAnalysis,
      call_metadata: rawAnalysis.call_metadata,
      classification: split.classification,
      learnerRecordUpdate: split.learnerRecordUpdate,
      benchmarkTransitionEvent: split.benchmarkTransitionEvent,
    };
    result.call_metadata.stream_event_type_counts = {};
    result.call_metadata.stream_item_type_counts = {};
    result.call_metadata.structured_event_audit = {
      policy: 'strict_no_tools_allowlist',
      invalid_jsonl_line_count: 0,
    };
    result.call_metadata.prohibited_tool_event_count = 0;
    result.call_metadata.invalid_stream_lines = 0;
    if (mutateMetadata) mutateMetadata(result.call_metadata, context);
    return result;
  };
}

async function postprocessAnalyzer({ analysis, publicModelInput, deterministicPostprocessorInput }) {
  const world = deterministicPostprocessorInput.world;
  const record =
    deterministicPostprocessorInput.learnerRecord || createTutorStubPublicLearnerRecord(world);
  const dropout =
    deterministicPostprocessorInput.dropout || createTutorStubDagFactDropoutState();
  const tutorLearnerDag = applyTutorStubPublicLearnerRecordUpdate({
    update: analysis.learnerRecordUpdate,
    world,
    record,
    dropout,
    tutorTurn: publicModelInput.tutorTurn,
    learnerText: publicModelInput.learnerText,
    publicStagedEvidence: publicModelInput.publicStagedEvidence,
    publicReleaseLedger: publicModelInput.publicReleaseLedger,
  });
  const turnRecord = buildTutorStubPublicLearnerAnalysisTurnRecord({
    learnerText: publicModelInput.learnerText,
    tutorTurn: publicModelInput.tutorTurn,
    classification: analysis.classification,
    tutorLearnerDag,
  });
  const stateObservation = buildTutorStubStateObservation({
    turnRecord,
    previousObservation: deterministicPostprocessorInput.previousObservation,
    previousTurnRecords: deterministicPostprocessorInput.previousTurnRecords,
    provenance: {
      model_input_public_only: true,
      deterministic_task_key_postprocessor: true,
    },
  });
  return {
    ...analysis,
    tutorLearnerDag,
    turnRecord,
    stateObservation,
    learnerRecord: record,
    dropout,
  };
}

before(async () => {
  temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptive-state-s1-'));
  const label = 'fresh-v21-stage0-parent';
  execFileSync(
    process.execPath,
    ['scripts/execute-adaptive-state-benchmark-v2-s0.js', '--out', temporaryRoot, '--label', label],
    { cwd: ROOT, encoding: 'utf8' },
  );
  config = yaml.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  parent = validateAdaptiveStateStage1Parent({
    parentRunDir: path.join(temporaryRoot, label),
    config,
    configPath: CONFIG_PATH,
    repoRoot: ROOT,
  });
  plan = buildAdaptiveStateCriticalPathPlan(config, {
    stage: 's1_technical_pilot',
    label: 'injected-s1-v21',
  });
  capturedAnalyzerInputs = [];
  completeDataset = await executeAdaptiveStateStage1({
    plan,
    config,
    parent,
    parentRunDir: parent.run_dir,
    configPath: CONFIG_PATH,
    realizeTurn: createRealizer(),
    analyzePublicText: createAnalyzerText({ capture: capturedAnalyzerInputs }),
    postprocessPublicAnalysis: postprocessAnalyzer,
    executionMode: 'injected_test',
    repoRoot: ROOT,
  });
});

after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));

test('S1 executes the exact serial 3-canary + 336-call matrix without claim eligibility', () => {
  assert.equal(completeDataset.dialogues.length, 24);
  assert.equal(completeDataset.rows.length, 144);
  assert.equal(completeDataset.model_call_count, 336);
  assert.equal(completeDataset.model_call_count_including_excluded_canaries, 339);
  assert.equal(completeDataset.scored_cli_dispatch_count, 336);
  assert.equal(completeDataset.total_cli_dispatch_count, 339);
  assert.equal(
    completeDataset.deprecated_model_call_count_alias_semantics,
    'cli_process_dispatches_not_backend_requests',
  );
  assert.equal(completeDataset.calls.length, 339);
  assert.equal(completeDataset.calls.filter((row) => row.matrix_scored_call).length, 336);
  assert.equal(completeDataset.calls.filter((row) => row.excluded_technical_canary).length, 3);
  assert.ok(completeDataset.calls.every((row) => row.claim_eligible === false && row.technical_pilot === true));
  assert.equal(completeDataset.call_accounting.planned, 339);
  assert.equal(completeDataset.call_accounting.dispatched, 339);
  assert.equal(completeDataset.call_accounting.failed, 0);
  assert.equal(completeDataset.content_sha256, adaptiveStateStage1DatasetContentSha256(completeDataset));
});

test('public analyzer sees only prior completed exchanges and currently staged evidence', () => {
  const matrixInputs = capturedAnalyzerInputs.filter((row) => row.promptContext.technical_canary !== true);
  assert.equal(matrixInputs.length, 168);
  for (const input of matrixInputs) {
    assert.deepEqual(Object.keys(input.publicTranscript[0] || {}).sort(),
      input.publicTranscript.length ? ['learner', 'turn', 'tutor'] : []);
    assert.equal(input.publicTranscript.length, input.turn - 1);
    assert.ok(input.publicTranscript.every((row) => row.turn < input.turn));
    assert.ok(input.publicTranscript.every((row) => row.learner !== input.learnerText || row.turn !== input.turn));
    assert.equal(Object.hasOwn(input, 'currentPublicActEnvelope'), false);
    assert.equal(Object.hasOwn(input, 'event_ids'), false);
    assert.equal(Object.hasOwn(input, 'proof_transition'), false);
    assert.deepEqual(Object.keys(input.priorPublicLearnerState).sort(), [
      'adopted_premise_ids',
      'asserted_answers',
      'prior_hypotheses',
      'voiced_derived_facts',
    ]);
    assert.doesNotMatch(
      JSON.stringify(input.priorPublicLearnerState),
      /event_family|event_ids|proof_transition|target|oracle|hidden|private|answer_key/iu,
    );
    assert.equal(Object.hasOwn(input.world, 'secret'), false);
    assert.equal(Object.hasOwn(input.world, 'proofPaths'), false);
    assert.deepEqual(input.publicReleaseLedger, input.publicStagedEvidence);
    assert.ok(
      input.publicStagedEvidence.every(
        (row) =>
          row.premise &&
          Number.isInteger(row.turn) &&
          row.via === 'kernel_public_projection' &&
          row.surface &&
          Array.isArray(row.fact),
      ),
    );
  }
  const turn3 = matrixInputs.find((row) => row.turn === 3);
  assert.equal(turn3.publicTranscript.length, 2);
  assert.equal(turn3.currentTutorText, '');
  const callsByJobTurn = new Map(
    completeDataset.calls
      .filter((row) => row.matrix_scored_call)
      .map((row) => [`${row.job_id}:${row.turn}:${row.role}`, row]),
  );
  for (const analyzer of completeDataset.calls.filter(
    (row) => row.matrix_scored_call && row.role === 'public_turn_analyzer',
  )) {
    const realizer = callsByJobTurn.get(
      `${analyzer.job_id}:${analyzer.turn}:${
        analyzer.job_id.includes('codex_terra') ? 'codex_realizer' : 'claude_realizer'
      }`,
    );
    const visibleTutor =
      analyzer.turn === 1
        ? analyzer.public_model_input.currentTutorText
        : analyzer.public_model_input.publicTranscript.at(-1).tutor;
    assert.equal(realizer.realizer_artifacts.public_input.currentAction.tutor_text, visibleTutor);
  }
  const promptCall = completeDataset.calls.find((row) => {
    if (row.role !== 'public_turn_analyzer' || row.turn !== 3 || !row.matrix_scored_call) return false;
    const input = row.public_model_input;
    return new Set([
      input.publicTranscript[0].learner,
      input.publicTranscript[0].tutor,
      input.publicTranscript[1].learner,
      input.publicTranscript[1].tutor,
      input.learnerText,
    ]).size === 5;
  });
  assert.ok(promptCall, 'turn-3 fixture needs five distinguishable chronological utterances');
  const [first, second] = promptCall.public_model_input.publicTranscript;
  const prompt = promptCall.analyzer_artifacts.prompt;
  const positions = [
    prompt.indexOf(first.learner),
    prompt.indexOf(first.tutor),
    prompt.indexOf(second.learner),
    prompt.indexOf(second.tutor),
    prompt.lastIndexOf(promptCall.public_model_input.learnerText),
  ];
  assert.ok(positions.every((value) => value >= 0));
  assert.deepEqual([...positions].sort((left, right) => left - right), positions);
  assert.doesNotMatch(prompt, /Immediately preceding public tutor turn/u);
});

test('harness labels survive descriptive analyzer disagreement and paired realizers keep identical targets', () => {
  const simulatedDisagreement = structuredClone(completeDataset.rows[0]);
  const frozenTarget = structuredClone(simulatedDisagreement.targets);
  simulatedDisagreement.descriptive_analyzer_alignment.analyzer_next_event_family =
    frozenTarget.next_dag_event_family === 'none' ? 'adopt' : 'none';
  simulatedDisagreement.descriptive_analyzer_alignment.agrees = false;
  assert.deepEqual(simulatedDisagreement.targets, frozenTarget);
  const dialogueById = new Map(completeDataset.dialogues.map((row) => [row.id, row]));
  for (const row of completeDataset.rows) {
    assert.deepEqual(row.targets, dialogueById.get(row.groups.dialogue_id).target_sequence[row.turn - 1]);
  }
  const byPair = new Map();
  for (const dialogue of completeDataset.dialogues) {
    const values = byPair.get(dialogue.latent_pair_id) || [];
    values.push(dialogue);
    byPair.set(dialogue.latent_pair_id, values);
  }
  assert.equal(byPair.size, 12);
  for (const pair of byPair.values()) {
    assert.equal(pair.length, 2);
    assert.deepEqual(pair[0].target_sequence, pair[1].target_sequence);
  }
});

test('cyclic same-stratum scramble donors are different-seed and balanced', () => {
  const donorUses = new Map();
  for (const row of completeDataset.rows) {
    assert.notEqual(row.controls.scramble_donor_dialogue_id, row.groups.dialogue_id);
    assert.notEqual(row.controls.scramble_donor_seed, row.groups.seed);
    donorUses.set(
      row.controls.scramble_donor_dialogue_id,
      (donorUses.get(row.controls.scramble_donor_dialogue_id) || 0) + 1,
    );
  }
  assert.equal(donorUses.size, 24);
  assert.ok([...donorUses.values()].every((count) => count === 6));
});

test('S1 evaluator passes structural machinery but keeps injected execution non-promotable', () => {
  const expectedPublicKeys = [
    'currentTutorText',
    'learnerText',
    'priorPublicLearnerState',
    'promptContext',
    'publicReleaseLedger',
    'publicStagedEvidence',
    'publicTranscript',
    'topic',
    'turn',
    'tutorTurn',
    'world',
  ].sort();
  for (const call of completeDataset.calls.filter((row) => row.role === 'public_turn_analyzer')) {
    assert.deepEqual(Object.keys(call.public_model_input).sort(), expectedPublicKeys);
  }
  const observedFamilies = new Set(
    completeDataset.dialogues.flatMap((dialogue) =>
      dialogue.observations.slice(1).map((observation) => observation.benchmark_transition.family),
    ),
  );
  assert.deepEqual([...observedFamilies].sort(), ['adopt', 'derive', 'none', 'retract']);
  const audit = auditAdaptiveStateStage1Dataset(completeDataset, plan, config, { repoRoot: ROOT });
  assert.equal(audit.controls.passed, true, JSON.stringify(audit.controls.by_generator, null, 2));
  assert.deepEqual(audit.failures, []);
  assert.equal(audit.passed, true);
  assert.equal(audit.matrix.independent_latent_clusters, 12);
  assert.equal(audit.public_analyzer_event_family_recovery.passed, true);
  assert.ok(audit.public_analyzer_event_family_recovery.overall >= 0.8);
  assert.ok(
    Object.values(audit.public_analyzer_event_family_recovery.by_generator).every((rate) => rate >= 0.65),
  );
  assert.ok(
    Object.values(audit.public_analyzer_event_family_recovery.by_realizer).every((rate) => rate >= 0.65),
  );
  const splitManifest = buildAdaptiveStateStage1SplitManifest(completeDataset.rows, config);
  assert.equal(splitManifest.cluster_key, 'groups.latent_pair_id');
  const report = buildAdaptiveStateStage1Report({
    dataset: completeDataset,
    plan,
    config,
    splitManifest,
    repoRoot: ROOT,
  });
  assert.doesNotThrow(() => validateAdaptiveStateStage1ReportContentSha256(report));
  assert.equal(report.status, 'test_only');
  assert.equal(report.confirmation_eligible, false);
  assert.equal(report.s2_validity_verdict, null);
  assert.equal(report.decision, 'mock_verification_only_no_promotion');
  assert.ok(report.stop_reasons.includes('non_paid_test_execution'));
  assert.equal(report.baseline_sanity.passed, true);
  for (const instrument of Object.values(report.instrument)) {
    assert.equal(instrument.oracle_beats_all_state_blind_baselines_on_both_metrics, true);
  }
  assert.deepEqual(report.protocol.target_contracts, config.targets.co_primary);
});

test('S1 evaluator rejects mutated reconstructible call artifacts', () => {
  const mutated = structuredClone(completeDataset);
  const call = mutated.calls.find((row) => row.role === 'public_turn_analyzer');
  call.analyzer_artifacts.raw_output += ' ';
  const audit = auditAdaptiveStateStage1Dataset(mutated, plan, config, { repoRoot: ROOT });
  assert.equal(audit.passed, false);
  assert.ok(audit.failures.includes('analyzer_artifact_hash'));
});

test('S1 structural audit rejects incomplete representations, non-oracle leakage, and stale reconstruction drift', () => {
  const incomplete = structuredClone(completeDataset);
  delete incomplete.rows[0].representations.field_stale;
  assert.ok(
    auditAdaptiveStateStage1Dataset(incomplete, plan, config, { repoRoot: ROOT }).failures.includes(
      'representation_set_incomplete',
    ),
  );

  const leaked = structuredClone(completeDataset);
  leaked.rows[0].representations.lean_dag.additional_state.leaked = leaked.world_local_fact_ids[0];
  assert.ok(
    auditAdaptiveStateStage1Dataset(leaked, plan, config, { repoRoot: ROOT }).failures.includes(
      'non_oracle_leakage',
    ),
  );

  const stale = structuredClone(completeDataset);
  stale.rows[0].representations.dag_stale.additional_state.dag.status = 'mutated';
  const staleAudit = auditAdaptiveStateStage1Dataset(stale, plan, config, { repoRoot: ROOT });
  assert.ok(staleAudit.failures.includes('representation_control_reconstruction_mismatch'));
  assert.ok(staleAudit.representations.reconstruction_mismatch_count > 0);
});

test('S1 structural audit enforces exact matrix roles, analyzer postprocessing, and target nondegeneracy', () => {
  const badRole = structuredClone(completeDataset);
  badRole.calls.find((call) => call.matrix_scored_call && call.role === 'codex_realizer').role = 'claude_realizer';
  assert.ok(
    auditAdaptiveStateStage1Dataset(badRole, plan, config, { repoRoot: ROOT }).failures.includes(
      'matrix_call_role_count',
    ),
  );

  const unfinished = structuredClone(completeDataset);
  unfinished.calls.find((call) => call.role === 'public_turn_analyzer').postprocessor_status = 'technical_failure';
  assert.ok(
    auditAdaptiveStateStage1Dataset(unfinished, plan, config, { repoRoot: ROOT }).failures.includes(
      'analyzer_postprocessor_incomplete',
    ),
  );

  const degenerate = structuredClone(completeDataset);
  for (const row of degenerate.rows) {
    if (row.groups.generator_id === plan.axes.latent_generators[0]) {
      row.targets.next_proof_trajectory = 'stall';
    }
  }
  assert.ok(
    auditAdaptiveStateStage1Dataset(degenerate, plan, config, { repoRoot: ROOT }).failures.includes(
      'target_degenerate_within_axis',
    ),
  );
});

test('S1 blocks the fixed-eight confirmation prerequisite when analyzer event-family recovery is too weak', () => {
  const weak = structuredClone(completeDataset);
  for (const row of weak.rows) row.descriptive_analyzer_alignment.agrees = false;
  const audit = auditAdaptiveStateStage1Dataset(weak, plan, config, { repoRoot: ROOT });
  assert.equal(audit.public_analyzer_event_family_recovery.passed, false);
  assert.ok(audit.failures.includes('public_analyzer_event_family_recovery_below_floor'));
});

test('S1 report rejects a rehashed train/test leak instead of trusting opaque split hashes', () => {
  const splitManifest = buildAdaptiveStateStage1SplitManifest(completeDataset.rows, config);
  const leaky = structuredClone(splitManifest);
  leaky.lanes[0].folds[0].train_ids.push(leaky.lanes[0].folds[0].test_ids[0]);
  leaky.content_sha256 = adaptiveStateStage1SplitManifestContentSha256(leaky);
  assert.throws(
    () =>
      buildAdaptiveStateStage1Report({
        dataset: completeDataset,
        plan,
        config,
        splitManifest: leaky,
        repoRoot: ROOT,
      }),
    /leaks, duplicates, or omits rows/u,
  );
});

test('S1 report validator rejects rehashed target-vocabulary drift', () => {
  const splitManifest = buildAdaptiveStateStage1SplitManifest(completeDataset.rows, config);
  const report = buildAdaptiveStateStage1Report({
    dataset: completeDataset,
    plan,
    config,
    splitManifest,
    repoRoot: ROOT,
  });
  report.protocol.target_contracts[0].labels.reverse();
  report.content_sha256 = adaptiveStateStage1ReportContentSha256(report);
  assert.throws(
    () => validateAdaptiveStateStage1ReportContentSha256(report),
    /report contract differs/u,
  );
});

test('a canary model mismatch stops before the matrix with exactly one failed dispatched ledger row', async () => {
  const realizer = createRealizer({
    mutateMetadata(metadata, context) {
      if (context.canary) metadata.observed_model_ref = 'codex/wrong-model';
    },
  });
  await assert.rejects(
    executeAdaptiveStateStage1({
      plan,
      config,
      parent,
      parentRunDir: parent.run_dir,
      configPath: CONFIG_PATH,
      realizeTurn: realizer,
      analyzePublicText: createAnalyzerText(),
      postprocessPublicAnalysis: postprocessAnalyzer,
      repoRoot: ROOT,
    }),
    (error) => {
      assert.match(error.message, /paid stage stopped/u);
      assert.equal(error.stage1Partial.calls.length, 1);
      assert.equal(error.stage1Partial.calls[0].status, 'technical_failure');
      assert.equal(error.stage1Partial.calls[0].provenance.dispatch_count, 1);
      assert.equal(error.stage1Partial.call_accounting.planned, 339);
      assert.equal(error.stage1Partial.call_accounting.reached, 1);
      assert.equal(error.stage1Partial.completed_dialogues.length, 0);
      return true;
    },
  );
});

test('an analyzer failure stops the first dialogue and records the dispatched failure exactly once', async () => {
  await assert.rejects(
    executeAdaptiveStateStage1({
      plan,
      config,
      parent,
      parentRunDir: parent.run_dir,
      configPath: CONFIG_PATH,
      realizeTurn: createRealizer(),
      analyzePublicText: createAnalyzerText({ fail: (context) => Boolean(context.job_id) }),
      postprocessPublicAnalysis: postprocessAnalyzer,
      repoRoot: ROOT,
    }),
    (error) => {
      const partial = error.stage1Partial;
      assert.equal(partial.calls.length, 5);
      assert.equal(partial.calls.filter((row) => row.status === 'technical_failure').length, 1);
      assert.equal(partial.calls.at(-1).role, 'public_turn_analyzer');
      assert.equal(partial.calls.at(-1).provenance.dispatch_count, 1);
      assert.equal(partial.call_accounting.dispatched, 5);
      assert.equal(partial.completed_dialogues.length, 0);
      return true;
    },
  );
});

test('post-dispatch malformed realizer wrapper is still one failed ledger call', async () => {
  await assert.rejects(
    executeAdaptiveStateStage1({
      plan,
      config,
      parent,
      parentRunDir: parent.run_dir,
      configPath: CONFIG_PATH,
      realizeTurn: createRealizer({ malformed: true }),
      analyzePublicText: createAnalyzerText(),
      postprocessPublicAnalysis: postprocessAnalyzer,
      repoRoot: ROOT,
    }),
    (error) => {
      assert.equal(error.stage1Partial.calls.length, 1);
      assert.equal(error.stage1Partial.calls[0].status, 'technical_failure');
      assert.equal(error.stage1Partial.calls[0].provenance.dispatch_count, 1);
      assert.equal(typeof error.stage1Partial.calls[0].realizer_artifacts.system_prompt, 'string');
      assert.equal(typeof error.stage1Partial.calls[0].realizer_artifacts.user_prompt, 'string');
      assert.match(error.stage1Partial.calls[0].artifact_hashes.raw_output_sha256, /^[0-9a-f]{64}$/u);
      return true;
    },
  );
});

test('public model seam has no capability reference to full authored world or deterministic learner state', async () => {
  let boundaryChecked = false;
  await assert.rejects(
    executeAdaptiveStateStage1({
      plan,
      config,
      parent,
      parentRunDir: parent.run_dir,
      configPath: CONFIG_PATH,
      realizeTurn: createRealizer(),
      analyzePublicText: async (request) => {
        boundaryChecked = true;
        assert.equal(Object.hasOwn(request, 'deterministicPostprocessorInput'), false);
        assert.equal(Object.hasOwn(request.publicModelInput.world, 'secret'), false);
        assert.equal(Object.hasOwn(request.publicModelInput.world, 'proofPaths'), false);
        assert.equal(Object.hasOwn(request.publicModelInput.world, 'premises'), false);
        const error = new Error('sentinel boundary stop');
        error.callMetadata = {
          status: 'technical_failure',
          requested_model_ref: request.modelRef,
          resolved_model_ref: 'codex/gpt-5.6-terra',
          observed_model_ref: null,
          effort: request.effort,
          timeout_ms: request.timeoutMs,
          attempts: 0,
          dispatch_count: 0,
          semantic_rerolls: 0,
          structured_output_reported: false,
        };
        throw error;
      },
      postprocessPublicAnalysis: () => {
        throw new Error('postprocessor must not run after model-stage failure');
      },
      repoRoot: ROOT,
    }),
    /sentinel boundary stop/u,
  );
  assert.equal(boundaryChecked, true);
});

test('stale or non-v2.1 S0 parent and analyzer model mismatch are rejected', async () => {
  assert.throws(
    () =>
      validateAdaptiveStateStage1Parent({
        parentRunDir: parent.run_dir,
        config: { ...config, version: '2.0' },
        configPath: CONFIG_PATH,
        repoRoot: ROOT,
      }),
    /stale|v2\.1|version/u,
  );
  await assert.rejects(
    executeAdaptiveStateStage1({
      plan,
      config,
      parent,
      parentRunDir: parent.run_dir,
      configPath: CONFIG_PATH,
      realizeTurn: createRealizer(),
      analyzePublicText: createAnalyzerText({
        mutateMetadata(metadata, context) {
          if (context.canary) metadata.observed_model_ref = 'codex/not-terra';
        },
      }),
      postprocessPublicAnalysis: postprocessAnalyzer,
      repoRoot: ROOT,
    }),
    /observed model\/call contract differs/u,
  );
});

test('pure S1 executor imports no provider bridge or live analyzer implementation', () => {
  const source = fs.readFileSync(
    path.join(ROOT, 'services/adaptiveTutor/stateBenchmarkStage1Executor.js'),
    'utf8',
  );
  assert.doesNotMatch(source, /cliProviderBridge|stateBenchmarkCliRealizer|tutorStubPublicLearnerAnalysis/u);
});

test('paid runner is locked before parent, CLI fingerprinting, or any dispatch', () => {
  const help = execFileSync(process.execPath, ['scripts/execute-adaptive-state-benchmark-v2-s1.js', '--help'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.match(help, /336 matrix dispatches plus three excluded canaries/u);
  const blocked = spawnSync(process.execPath, ['scripts/execute-adaptive-state-benchmark-v2-s1.js'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /Paid S1 is locked/u);
  const contract = adaptiveStateStage1StaticExecutionContract({ config, configPath: CONFIG_PATH });
  assert.equal(contract.call_contract.scored_cli_dispatches, 336);
  assert.equal(contract.call_contract.excluded_technical_canary_cli_dispatches, 3);
  assert.equal(contract.call_contract.backend_request_count, 'unknown');
  assert.throws(
    () =>
      createAdaptiveStateStage1ProductionLiveSeams({
        config,
        callCli: async () => ({ text: '{}' }),
      }),
    /production seams do not accept injected/u,
  );
});

test('live seams propagate abort before dispatch and emit a finished zero-dispatch lifecycle event', async () => {
  const controller = new AbortController();
  controller.abort();
  const lifecycle = [];
  let dispatched = false;
  const seams = createAdaptiveStateStage1LiveSeams({
    config,
    signal: controller.signal,
    resolveModelRef: () => ({ provider: 'codex', model: 'gpt-5.6-terra', isConfigured: true }),
    callCli: async () => {
      dispatched = true;
      throw new Error('must not dispatch');
    },
    onReached: (event) => lifecycle.push(event),
    onDispatch: (event) => lifecycle.push(event),
    onFinished: (event) => lifecycle.push(event),
  });
  const publicModelInput = capturedAnalyzerInputs.find(
    (row) => row.promptContext.technical_canary !== true && row.turn === 1,
  );
  await assert.rejects(
    () =>
      seams.analyzePublicText({
        publicModelInput,
        modelRef: 'codex.gpt-5.6-terra',
        effort: 'low',
        timeoutMs: 300_000,
        parseMode: 'strict_benchmark',
        context: { call_id: 'abort-call', call_index: 1 },
      }),
    /aborted before CLI process dispatch/u,
  );
  assert.equal(dispatched, false);
  assert.deepEqual(lifecycle.map((event) => event.type), ['call_reached', 'call_finished']);
  assert.equal(lifecycle.at(-1).dispatchCount, 0);
});

test('live analyzer adapter preserves strict stream audit and rejects any prohibited event', async () => {
  const lifecycle = [];
  const publicModelInput = capturedAnalyzerInputs.find(
    (row) => row.promptContext.technical_canary !== true && row.turn === 1,
  );
  const responseFor = (prohibited = 0) => ({
    text: JSON.stringify(
      validAnalysis({
        learnerRecord: {},
        benchmarkTransition: {
          family: 'none',
          evidence_span: publicModelInput.learnerText,
        },
      }),
    ),
    provider: 'codex',
    model: 'gpt-5.6-terra',
    structuredOutput: true,
    modelAttestationBasis: 'explicit_cli_model_argument_accepted_bridge_echo',
    modelIndependentlyAttested: false,
    streamEventTypeCounts: { 'thread.started': 1, 'turn.completed': 1 },
    streamItemTypeCounts: { agent_message: 1 },
    invalidStreamLines: 0,
    structuredEventAudit: {
      policy: 'strict_no_tools_allowlist',
      invalid_jsonl_line_count: 0,
      prohibited_event_count: prohibited,
    },
    prohibitedToolEventCount: prohibited,
  });
  const seams = createAdaptiveStateStage1LiveSeams({
    config,
    resolveModelRef: () => ({
      provider: 'codex',
      model: 'gpt-5.6-terra',
      isConfigured: true,
    }),
    callCli: async () => responseFor(0),
    onReached: async (event) => lifecycle.push(event),
    onDispatch: async (event) => lifecycle.push(event),
    onFinished: async (event) => lifecycle.push(event),
  });
  const result = await seams.analyzePublicText({
    publicModelInput,
    modelRef: 'codex.gpt-5.6-terra',
    effort: 'low',
    timeoutMs: 300000,
    parseMode: 'strict_benchmark',
    context: { call_id: 's1-call-0003', call_index: 3 },
  });
  assert.equal(result.call_metadata.prohibited_tool_event_count, 0);
  assert.deepEqual(
    lifecycle.map((event) => [event.type, event.callId]),
    [
      ['call_reached', 's1-call-0003'],
      ['call_dispatch_started', 's1-call-0003'],
      ['call_finished', 's1-call-0003'],
    ],
  );

  const blocked = createAdaptiveStateStage1LiveSeams({
    config,
    resolveModelRef: () => ({ provider: 'codex', model: 'gpt-5.6-terra', isConfigured: true }),
    callCli: async () => responseFor(1),
  });
  await assert.rejects(
    blocked.analyzePublicText({
      publicModelInput,
      modelRef: 'codex.gpt-5.6-terra',
      effort: 'low',
      timeoutMs: 300000,
      parseMode: 'strict_benchmark',
      context: { call_id: 's1-call-0003', call_index: 3 },
    }),
    (error) => {
      assert.equal(error.callMetadata.dispatch_count, 1);
      assert.match(error.message, /prohibited CLI stream activity/u);
      return true;
    },
  );
});
