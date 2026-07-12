import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';

import {
  canonicalJson,
  hashCanonicalJson,
  hashFile,
  sha256,
  verifyExperimentRun,
} from '../experimentRunArtifacts.js';
import { loadWorld } from '../dramaticDerivation/world.js';
import { buildTutorStubStateObservation } from './tutorStubStateAdapter.js';
import {
  buildAdaptiveStateRepresentationsV2,
  buildAdaptiveStateCriticalPathPlan,
  validateAdaptiveStateCriticalPathPlan,
} from './stateBenchmarkV2.js';
import {
  adaptiveStateKernelTaskMetadata,
  adaptiveStateLearnerKernel,
  createAdaptiveStateKernelSession,
  loadAdaptiveStateWorldAdapters,
  materializeAdaptiveStateInitialTurn,
  materializeAdaptiveStateTransitionTurn,
  stepAdaptiveStateKernelSession,
} from './learnerKernels/index.js';
import {
  loadAdaptiveStateStage0Dataset,
  validateAdaptiveStateStage0DatasetContentSha256,
} from './stateBenchmarkStage0Executor.js';
import { validateAdaptiveStateStage0ReportContentSha256 } from './stateBenchmarkStage0Analysis.js';
import {
  adaptiveStateTransitionAtomicSurface,
  isolateAdaptiveStatePublicRealizerInput,
} from './stateBenchmarkPublicSurface.js';

export const ADAPTIVE_STATE_STAGE1_DATASET_V21_SCHEMA =
  'machinespirits.adaptive-state-stage1-dataset.v2.1';
export const ADAPTIVE_STATE_STAGE1_DIALOGUE_V21_SCHEMA =
  'machinespirits.adaptive-state-stage1-dialogue.v2.1';
export const ADAPTIVE_STATE_STAGE1_CALL_V21_SCHEMA =
  'machinespirits.adaptive-state-stage1-call.v2.1';

const EXPECTED_VERSION = '2.1';
const S0_REPORT_FILE = 'stage0-contract-report.json';
const S0_PLAN_FILE = 'critical-path-plan.json';
const S0_MANIFEST_FILE = 'dataset-manifest.json';
const FORBIDDEN_ANALYZER_INPUT_KEY =
  /(?:^|_)(?:future|target|oracle|hidden|private|answer_key|event_family|event_ids|required_realizer_output|proof_transition)(?:_|$)/iu;
const SHA256 = /^[0-9a-f]{64}$/u;

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function aggregateFileHash(paths, repoRoot) {
  return hashCanonicalJson(
    [...new Set(paths)].sort().map((file) => ({ path: file, sha256: hashFile(path.resolve(repoRoot, file)) })),
  );
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertNoForbiddenAnalyzerInput(value, location = 'analyzer_input') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_ANALYZER_INPUT_KEY.test(key)) {
      throw new Error(`stateBenchmarkStage1: forbidden analyzer input ${location}.${key}`);
    }
    assertNoForbiddenAnalyzerInput(child, `${location}.${key}`);
  }
}

function publicWorldForAnalyzer(world) {
  return {
    id: world.id,
    title: world.title,
    question: world.question,
    setting: world.setting,
    discipline: world.discipline,
    rules: clone(world.rules || []),
    background: clone(world.background || []),
  };
}

function emptyPriorPublicLearnerState() {
  return {
    adopted_premise_ids: [],
    voiced_derived_facts: [],
    prior_hypotheses: [],
    asserted_answers: [],
  };
}

function advancePriorPublicLearnerState(previous, analysis) {
  const next = clone(previous || emptyPriorPublicLearnerState());
  const accepted = analysis?.tutorLearnerDag?.accepted || {};
  const adopted = new Set(next.adopted_premise_ids || []);
  for (const premiseId of accepted.retract || []) adopted.delete(String(premiseId));
  for (const premiseId of accepted.adopt || []) adopted.add(String(premiseId));
  next.adopted_premise_ids = [...adopted].sort();
  const derived = new Map(
    (next.voiced_derived_facts || []).map((fact) => [hashCanonicalJson(fact), clone(fact)]),
  );
  for (const fact of accepted.derive || []) derived.set(hashCanonicalJson(fact), clone(fact));
  next.voiced_derived_facts = [...derived.values()];
  if (typeof accepted.hypothesis === 'string' && accepted.hypothesis.trim()) {
    next.prior_hypotheses = [...new Set([...(next.prior_hypotheses || []), accepted.hypothesis.trim()])];
  }
  if (typeof accepted.assertAnswer === 'string' && accepted.assertAnswer.trim()) {
    next.asserted_answers = [...new Set([...(next.asserted_answers || []), accepted.assertAnswer.trim()])];
  }
  return next;
}

function stagedEvidenceForAnalyzer(world, envelope, firstSeenByPremise, turn) {
  const releasedSurfaces = new Set(
    (envelope?.public_world_vocabulary?.released_evidence_surfaces || []).map((surface) => String(surface).trim()),
  );
  const rows = (world.premises || [])
    .filter((premise) => releasedSurfaces.has(String(premise.surface || '').trim()))
    .map((premise) => {
      if (!firstSeenByPremise.has(premise.id)) firstSeenByPremise.set(premise.id, Number(turn));
      return {
        premise: premise.id,
        turn: firstSeenByPremise.get(premise.id),
        via: 'kernel_public_projection',
        fact: clone(premise.fact),
        surface: adaptiveStateTransitionAtomicSurface({
          question: world.question,
          surface: premise.surface,
        }),
      };
    });
  if (rows.length !== releasedSurfaces.size) {
    throw new Error('stateBenchmarkStage1: public staged evidence could not be mapped without hidden state');
  }
  const premiseById = new Map((world.premises || []).map((premise) => [premise.id, premise]));
  const seen = new Set();
  for (const row of rows) {
    const premise = premiseById.get(row.premise);
    if (
      !row.premise ||
      seen.has(row.premise) ||
      !premise ||
      !Number.isInteger(row.turn) ||
      row.turn < 1 ||
      !row.surface ||
      hashCanonicalJson(row.fact) !== hashCanonicalJson(premise.fact)
    ) {
      throw new Error('stateBenchmarkStage1: invalid canonical public staged-evidence projection');
    }
    seen.add(row.premise);
  }
  return rows;
}

function currentStage0Hashes(config, repoRoot) {
  const script = 'scripts/execute-adaptive-state-benchmark-v2-s0.js';
  const executor = 'services/adaptiveTutor/stateBenchmarkStage0Executor.js';
  const analyzer = 'services/adaptiveTutor/stateBenchmarkStage0Analysis.js';
  const realizer = 'services/adaptiveTutor/stateBenchmarkDeterministicRealizer.js';
  const benchmark = 'services/adaptiveTutor/stateBenchmarkV2.js';
  const stateAdapter = 'services/adaptiveTutor/tutorStubStateAdapter.js';
  const fieldTrajectory = 'services/tutorStubFieldTrajectory.js';
  return {
    runner: aggregateFileHash([script, executor, benchmark], repoRoot),
    analyzer: aggregateFileHash([analyzer, stateAdapter, fieldTrajectory], repoRoot),
    policy: aggregateFileHash(
      config.critical_path.latent_generators.flatMap(
        (row) => adaptiveStateLearnerKernel(row.id).metadata.source_files,
      ),
      repoRoot,
    ),
    profile: hashCanonicalJson(config.complexity_cap),
    prompt: hashFile(path.resolve(repoRoot, realizer)),
    world: aggregateFileHash(config.critical_path.worlds.map((row) => row.source), repoRoot),
  };
}

/**
 * S1 is lineage-bound to a complete, current v2.1 S0 transaction. A merely
 * successful old S0 run is not enough after the paid call contract changes.
 */
export function validateAdaptiveStateStage1Parent({
  parentRunDir,
  config,
  configPath,
  repoRoot = path.resolve('.'),
} = {}) {
  if (!parentRunDir) throw new Error('stateBenchmarkStage1: a sealed S0 parent run is required');
  const verification = verifyExperimentRun(parentRunDir);
  if (!verification.ok) {
    throw new Error(`stateBenchmarkStage1: S0 parent failed seal verification: ${verification.errors.join('; ')}`);
  }
  if (verification.seal?.status !== 'complete') {
    throw new Error('stateBenchmarkStage1: S0 parent must have a complete seal');
  }
  const executionPlan = verification.plan;
  if (
    executionPlan?.metadata?.stage !== 's0_contract' ||
    String(executionPlan?.metadata?.benchmarkVersion) !== EXPECTED_VERSION ||
    Number(executionPlan?.metadata?.expectedModelCalls) !== 0
  ) {
    throw new Error('stateBenchmarkStage1: S0 parent is not a zero-call benchmark v2.1 execution');
  }
  const resolvedConfigPath = path.resolve(configPath || path.join(repoRoot, 'config/adaptive-state-benchmark-v2.yaml'));
  const currentHashes = currentStage0Hashes(config, repoRoot);
  const hashMismatches = Object.entries(currentHashes)
    .filter(([kind, digest]) => executionPlan.hashes?.[kind] !== digest)
    .map(([kind]) => kind);
  if (executionPlan.hashes?.config !== hashFile(resolvedConfigPath)) hashMismatches.push('config');
  if (hashMismatches.length) {
    throw new Error(
      `stateBenchmarkStage1: S0 parent is stale against current v2.1 sources (${[...new Set(hashMismatches)].join(', ')})`,
    );
  }

  const criticalPlan = readJson(path.join(parentRunDir, S0_PLAN_FILE));
  validateAdaptiveStateCriticalPathPlan(criticalPlan);
  const currentPlan = buildAdaptiveStateCriticalPathPlan(config, {
    stage: 's0_contract',
    label: criticalPlan.label,
  });
  if (
    criticalPlan.version !== EXPECTED_VERSION ||
    criticalPlan.design_sha256 !== currentPlan.design_sha256 ||
    criticalPlan.config_sha256 !== currentPlan.config_sha256 ||
    hashCanonicalJson(criticalPlan.axes) !== hashCanonicalJson(currentPlan.axes) ||
    hashCanonicalJson(criticalPlan.counts) !== hashCanonicalJson(currentPlan.counts)
  ) {
    throw new Error('stateBenchmarkStage1: S0 parent does not match the frozen v2.1 matrix');
  }

  const datasetManifest = readJson(path.join(parentRunDir, S0_MANIFEST_FILE));
  const dataset = loadAdaptiveStateStage0Dataset(parentRunDir);
  validateAdaptiveStateStage0DatasetContentSha256(dataset);
  const report = readJson(path.join(parentRunDir, S0_REPORT_FILE));
  validateAdaptiveStateStage0ReportContentSha256(report);
  if (
    String(datasetManifest.version) !== EXPECTED_VERSION ||
    String(dataset.version) !== EXPECTED_VERSION ||
    String(report.version) !== EXPECTED_VERSION ||
    report.status !== 'pass' ||
    report.confirmation_eligible !== false ||
    report.s2_validity_verdict !== null ||
    report.provenance?.design_sha256 !== criticalPlan.design_sha256 ||
    report.content_sha256 !== verification.seal.metadata?.reportSha256 ||
    dataset.content_sha256 !== verification.seal.metadata?.datasetSha256
  ) {
    throw new Error('stateBenchmarkStage1: S0 parent artifacts do not prove a matching non-confirmatory pass');
  }
  return {
    run_id: executionPlan.runId,
    run_dir: path.resolve(parentRunDir),
    plan_sha256: verification.seal.planSha256,
    seal_inventory_sha256: verification.seal.inventorySha256,
    report_sha256: report.content_sha256,
    dataset_sha256: dataset.content_sha256,
    critical_path_design_sha256: criticalPlan.design_sha256,
    config_sha256: criticalPlan.config_sha256,
  };
}

function realizerInput(envelope, transcript, action, tutorText) {
  return isolateAdaptiveStatePublicRealizerInput({
    currentPublicActEnvelope: {
      ...clone(envelope.current_public_act_envelope),
      turn: Number(envelope.turn),
    },
    priorPublicTranscript: clone(transcript),
    currentAction: {
      action_type: action || 'initial_public_observation',
      tutor_text: String(tutorText || '').trim(),
    },
    publicWorldVocabulary: clone(envelope.public_world_vocabulary || {}),
  });
}

function publicTutorTurn(action, turn, question) {
  const text =
    action === 'diagnose_with_discriminating_question'
      ? `Which public evidence would most clearly discriminate your next step on this inquiry: ${question}`
      : action === 'minimal_hint'
        ? 'Use the smallest currently public clue that can move the proof forward.'
        : action === 'request_evidence'
          ? 'State the public evidence for your next inference, and connect it to the applicable rule.'
          : `State what the public evidence currently supports about this inquiry: ${question}`;
  return { turn, role: 'tutor', action_type: action || 'initial_public_observation', text };
}

function normalizedModelLabel(provider, model) {
  const rawModel = String(model || '').trim();
  if (!provider || !rawModel) return null;
  return rawModel.startsWith(`${provider}/`) ? rawModel : `${provider}/${rawModel}`;
}

function rawAnalyzerMetadata(result) {
  const supplied = result?.call_metadata || result?.callMetadata;
  if (!supplied) return null;
  const metadata = clone(supplied);
  const reported = metadata.model_attestation_basis;
  if (
    ['explicit_cli_model_argument_accepted_bridge_echo', 'explicit_cli_argument_accepted'].includes(reported)
  ) {
    metadata.bridge_reported_attestation_basis = reported;
    metadata.model_attestation_basis = 'explicit_cli_argument_accepted';
  }
  return metadata;
}

export function adaptiveStateAnalyzerCallMetadata(result) {
  return rawAnalyzerMetadata(result);
}

export function validateAdaptiveStateCallMetadata(metadata, frozen, role) {
  if (!metadata || typeof metadata !== 'object') {
    throw new Error(`stateBenchmarkStage1: ${role} call omitted model provenance`);
  }
  const resolved = metadata.resolved_model_ref || normalizedModelLabel(metadata.resolved_provider, metadata.resolved_model);
  const observed = metadata.observed_model_ref || normalizedModelLabel(metadata.observed_provider, metadata.observed_model);
  const requested = metadata.requested_model_ref;
  const effort = metadata.effort;
  const timeout = Number(metadata.timeout_ms);
  const analyzerHashes = [
    metadata.input_sha256,
    metadata.system_prompt_sha256,
    metadata.prompt_sha256,
    metadata.output_schema_sha256,
    metadata.raw_output_sha256,
    metadata.parsed_output_sha256,
  ];
  const analyzerContractInvalid =
    role === 'public_turn_analyzer' &&
    (metadata.structured_output_reported !== true ||
      metadata.model_attestation_basis !== frozen.model_attestation_basis ||
      metadata.model_independently_attested !== false ||
      analyzerHashes.some((digest) => !SHA256.test(String(digest || ''))));
  const realizerAttestationInvalid =
    role !== 'public_turn_analyzer' &&
    (metadata.model_attestation?.basis !== 'explicit_cli_model_argument_accepted_bridge_echo' ||
      metadata.model_attestation?.independently_attested !== false ||
      !SHA256.test(String(metadata.system_prompt_sha256 || '')) ||
      !SHA256.test(String(metadata.user_prompt_sha256 || '')) ||
      !SHA256.test(String(metadata.input_sha256 || '')) ||
      !SHA256.test(String(metadata.raw_output_sha256 || '')) ||
      !SHA256.test(String(metadata.output_sha256 || '')));
  const streamCounts = {
    ...(metadata.stream_event_type_counts || {}),
    ...(metadata.stream_item_type_counts || {}),
  };
  const streamAuditInvalid =
    !metadata.stream_event_type_counts ||
    !metadata.stream_item_type_counts ||
    Object.entries(streamCounts).some(
      ([type, count]) =>
        Number(count) > 0 && /(?:tool|command|shell|exec|file|web|browser|mcp)/iu.test(String(type)),
    );
  const structuredAudit = metadata.structured_event_audit;
  const structuredAuditInvalid =
    !structuredAudit ||
    Number(metadata.prohibited_tool_event_count) !== 0 ||
    Number(metadata.invalid_stream_lines) !== 0 ||
    (String(resolved || '').startsWith('codex/') && structuredAudit.policy !== 'strict_no_tools_allowlist') ||
    (String(resolved || '').startsWith('claude-code/') && structuredAudit.enforcement !== 'claude_tools_disabled');
  if (
    metadata.status !== 'success' ||
    requested !== frozen.model_ref ||
    resolved !== frozen.expected_cli_model_label ||
    observed !== frozen.expected_cli_model_label ||
    effort !== frozen.effort ||
    timeout !== Number(frozen.timeout_ms) ||
    Number(metadata.dispatch_count) !== 1 ||
    Number(metadata.attempts) !== 1 ||
    Number(metadata.semantic_rerolls) !== 0 ||
    Number(metadata.prohibited_tool_event_count) !== 0 ||
    metadata.structured_output_reported !== true ||
    analyzerContractInvalid ||
    realizerAttestationInvalid ||
    streamAuditInvalid ||
    structuredAuditInvalid
  ) {
    throw new Error(`stateBenchmarkStage1: observed model/call contract differs from plan for ${role}`);
  }
  return {
    requested_model_ref: requested,
    resolved_model_ref: resolved,
    observed_model_ref: observed,
    expected_cli_model_label: frozen.expected_cli_model_label,
    cli_argument_accepted: true,
    model_attestation_basis: frozen.model_attestation_basis,
    independently_attested: false,
    bridge_reported_attestation:
      role === 'public_turn_analyzer'
        ? {
            basis: metadata.bridge_reported_attestation_basis,
            independently_attested: metadata.model_independently_attested,
          }
        : clone(metadata.model_attestation),
    effort,
    timeout_ms: timeout,
    attempts: Number(metadata.attempts ?? 1),
    wrapper_attempts: 1,
    dispatch_count: 1,
    backend_request_count: 'unknown',
    backend_retries_observed: false,
    stream_event_type_counts: clone(metadata.stream_event_type_counts),
    stream_item_type_counts: clone(metadata.stream_item_type_counts),
    structured_event_audit: clone(metadata.structured_event_audit),
    prohibited_tool_event_count: Number(metadata.prohibited_tool_event_count),
    invalid_stream_lines: Number(metadata.invalid_stream_lines),
    semantic_rerolls: Number(metadata.semantic_rerolls),
    structured_output_reported: true,
    hashes:
      role === 'public_turn_analyzer'
        ? {
            input_sha256: metadata.input_sha256,
            system_prompt_sha256: metadata.system_prompt_sha256,
            prompt_sha256: metadata.prompt_sha256,
            output_schema_sha256: metadata.output_schema_sha256,
            raw_output_sha256: metadata.raw_output_sha256,
            parsed_output_sha256: metadata.parsed_output_sha256,
          }
          : {
              input_sha256: metadata.input_sha256,
              system_prompt_sha256: metadata.system_prompt_sha256,
              user_prompt_sha256: metadata.user_prompt_sha256,
              raw_output_sha256: metadata.raw_output_sha256,
              parsed_output_sha256: metadata.output_sha256,
            },
  };
}

function analyzerTurnRecord(result, turn, learnerText) {
  const supplied = result?.turnRecord || result?.turn_record;
  if (!supplied || typeof supplied !== 'object') {
    throw new Error('stateBenchmarkStage1: public analyzer omitted turnRecord');
  }
  if (!result.classification && !supplied.classification && !supplied.classifier) {
    throw new Error('stateBenchmarkStage1: public analyzer omitted classification');
  }
  if (!result.tutorLearnerDag && !supplied.tutorLearnerDagModel && !supplied.dag) {
    throw new Error('stateBenchmarkStage1: public analyzer omitted learner DAG');
  }
  return {
    ...clone(supplied),
    turn: Number(turn),
    learner: learnerText,
    learner_text: learnerText,
    classification: clone(supplied.classification || result.classification),
    tutorLearnerDagModel: clone(
      supplied.tutorLearnerDagModel || result.tutorLearnerDag?.model || result.tutorLearnerDag,
    ),
  };
}

function bootstrapObservation(job) {
  return buildTutorStubStateObservation({
    turnRecord: {
      turn: 0,
      learner: '',
      classification: { turn: {} },
      tutorLearnerDagModel: { turn: 0, assessment: {}, metrics: {} },
      tutorLearnerDagUpdate: { accepted: { adopt: [], retract: [], derive: [] } },
    },
    provenance: {
      source: 'adaptive_state_s1_unscored_bootstrap',
      source_dialogue_id: job.id,
      latent_pair_id: job.latent_pair_id,
      realizer_id: job.language_realizer.id,
    },
  });
}

function observationProvenance(job, turn) {
  return {
    source: 'live_public_text_analyzer',
    source_dialogue_id: job.id,
    latent_pair_id: job.latent_pair_id,
    realizer_id: job.language_realizer.id,
    benchmark_stratum: {
      world_id: job.world.id,
      generator_id: job.latent_generator.id,
      action_id: turn > 0 ? job.action_schedule[Math.min(turn - 1, job.action_schedule.length - 1)] : 'bootstrap',
      turn,
    },
  };
}

function observationFromAnalysis(result, record, priorObservation, priorRecords, job, turn) {
  const observation = result?.stateObservation
    ? clone(result.stateObservation)
    : buildTutorStubStateObservation({
        turnRecord: record,
        previousObservation: priorObservation,
        previousTurnRecords: priorRecords,
        provenance: observationProvenance(job, turn),
      });
  if (Number(observation?.turn) !== Number(turn) || String(observation?.learner_text || '') !== record.learner) {
    throw new Error('stateBenchmarkStage1: analyzer state observation does not match its public learner turn');
  }
  observation.provenance = {
    ...(clone(observation.provenance) || {}),
    ...observationProvenance(job, turn),
    kernel_derived_classifier: false,
  };
  if (!result?.benchmarkTransitionEvent) {
    throw new Error('stateBenchmarkStage1: analyzer omitted benchmark transition observation');
  }
  observation.benchmark_transition = clone(result.benchmarkTransitionEvent);
  return observation;
}

function publicObservationSummary(observation, realizedEventIds) {
  return {
    turn: observation.turn,
    learner_text: observation.learner_text,
    realized_public_event_ids: [...realizedEventIds],
    accepted_event_kinds: (observation.accepted_events || []).map((event) => String(event.kind || 'other')),
    benchmark_transition: clone(observation.benchmark_transition || null),
    dag: clone(observation.dag),
    classifier: clone(observation.classifier),
    human_discourse: clone(observation.human_discourse),
    axes: clone(observation.axes),
    runtime_field_trajectory: clone(observation.runtime_field_trajectory),
    provenance: clone(observation.provenance),
  };
}

function taskForAdapter(adapter) {
  return {
    ...adaptiveStateKernelTaskMetadata(adapter),
    provenance: {
      kind: 'frozen_world_topology_metadata',
      world_sha256: adapter.world_sha256,
      geometry: adapter.geometry,
    },
  };
}

function donorFor(dialogues, recipient) {
  const candidates = dialogues
    .filter(
      (row) =>
        row.job.world.id === recipient.job.world.id &&
        row.job.latent_generator.id === recipient.job.latent_generator.id &&
        row.job.language_realizer.id === recipient.job.language_realizer.id,
    )
    .sort((left, right) => left.job.repetition - right.job.repetition || left.job.id.localeCompare(right.job.id));
  const index = candidates.findIndex((row) => row.job.id === recipient.job.id);
  if (index < 0 || candidates.length < 2) {
    throw new Error(`stateBenchmarkStage1: no legal scramble donor for ${recipient.job.id}`);
  }
  const donor = candidates[(index + 1) % candidates.length];
  if (donor.job.seed === recipient.job.seed) {
    throw new Error(`stateBenchmarkStage1: cyclic scramble donor reused the recipient seed ${recipient.job.id}`);
  }
  return donor;
}

function rowFor(dialogue, donor, transitionIndex, version) {
  const turn = transitionIndex + 1;
  const currentObservation = dialogue.observations[turn];
  const nextObservation = dialogue.observations[turn + 1];
  const previousObservation = dialogue.observations[turn - 1];
  const donorObservation = donor.observations[turn];
  const transition = dialogue.transitions[transitionIndex];
  // The label owner is the frozen transition harness, never the public-text
  // analyzer. Analyzer disagreement is retained descriptively below and may
  // not rewrite, drop, or exclude a transition.
  const targets = clone(transition.targets);
  const analyzerEventFamily = String(nextObservation.benchmark_transition?.family || '');
  if (!['retract', 'derive', 'adopt', 'none'].includes(analyzerEventFamily)) {
    throw new Error('stateBenchmarkStage1: next observation lacks a valid explicit benchmark transition family');
  }
  const analyzerEventFamilies = [analyzerEventFamily];
  return {
    schema: 'machinespirits.adaptive-state-benchmark-row.v2',
    version,
    id: `${dialogue.job.id}__predict_t${turn}`,
    stage: 's1_technical_pilot',
    turn,
    groups: {
      dialogue_id: dialogue.job.id,
      latent_pair_id: dialogue.job.latent_pair_id,
      cell_id: dialogue.job.cell_id,
      world_id: dialogue.job.world.id,
      generator_id: dialogue.job.latent_generator.id,
      realizer_id: dialogue.job.language_realizer.id,
      repetition: dialogue.job.repetition,
      seed: dialogue.job.seed,
    },
    action: {
      schema: 'machinespirits.adaptive-state-common-action.v2',
      id: dialogue.job.action_schedule[transitionIndex],
      action_type: dialogue.job.action_schedule[transitionIndex],
    },
    representations: buildAdaptiveStateRepresentationsV2({
      observation: currentObservation,
      task: dialogue.task,
      previousObservation,
      matchedDagDonorObservation: donorObservation,
      matchedFieldDonorObservation: donorObservation,
      oracleState: transition.oracle_before_sample,
    }),
    targets,
    proof_transition: clone(transition.proof_transition),
    descriptive_analyzer_alignment: {
      analyzer_next_event_families: analyzerEventFamilies,
      analyzer_next_event_family: analyzerEventFamily,
      harness_next_event_family: targets.next_dag_event_family,
      agrees: analyzerEventFamily === targets.next_dag_event_family,
      label_owner: 'frozen_transition_harness',
      exclusion_permitted: false,
    },
    controls: {
      scramble_donor_dialogue_id: donor.job.id,
      scramble_donor_seed: donor.job.seed,
      scramble_donor_turn: turn,
      stale_observation_turn: previousObservation.turn,
    },
    provenance: {
      prediction_origin: 'after_learner_observation_before_frozen_action',
      observation_source: 'live_public_text_analyzer',
      oracle_captured_before_sampling:
        transition.audit_sequence[0] === 'oracle_captured_before_transition_sampling',
      transition_plan_sha256: transition.plan_sha256,
      world_sha256: dialogue.adapter.world_sha256,
      transition_kernel_sha256: transition.oracle_before_sample.kernel_provenance.transition_kernel_sha256,
      learner_realizer_model_ref: dialogue.job.language_realizer.model_ref,
      analyzer_model_ref: dialogue.analyzerModelRef,
      kernel_derived_classifier: false,
      cli_process_dispatches_for_realized_dialogue: 14,
    },
  };
}

function worldLocalIds(config, repoRoot) {
  return config.critical_path.worlds.flatMap((row) => {
    const raw = yaml.parse(fs.readFileSync(path.resolve(repoRoot, row.source), 'utf8'));
    return (raw.premises || []).map((premise) => premise.id);
  });
}

function datasetContent(dataset) {
  const content = { ...dataset };
  delete content.content_sha256;
  return content;
}

export function adaptiveStateStage1DatasetContentSha256(dataset) {
  return hashCanonicalJson(datasetContent(dataset));
}

export function validateAdaptiveStateStage1DatasetContentSha256(dataset) {
  if (dataset?.content_sha256 !== adaptiveStateStage1DatasetContentSha256(dataset)) {
    throw new Error('stateBenchmarkStage1: dataset content SHA-256 mismatch');
  }
  return true;
}

function createCallBudget(plan) {
  const cap = {
    scored_realizer: Number(plan.counts.expected_learner_realizer_calls),
    scored_analyzer: Number(plan.counts.expected_public_turn_analyzer_calls),
    canary_realizer: Number(plan.counts.excluded_provider_canary_calls),
    canary_analyzer: Number(plan.counts.excluded_analyzer_schema_canary_calls),
  };
  const used = Object.fromEntries(Object.keys(cap).map((key) => [key, 0]));
  return {
    consume(kind) {
      used[kind] += 1;
      if (used[kind] > cap[kind]) throw new Error(`stateBenchmarkStage1: ${kind} call cap exceeded`);
    },
    assertExact() {
      const mismatches = Object.keys(cap).filter((key) => used[key] !== cap[key]);
      if (mismatches.length) throw new Error(`stateBenchmarkStage1: exact call counts not met (${mismatches.join(', ')})`);
    },
    snapshot() {
      return { cap: { ...cap }, used: { ...used } };
    },
  };
}

function frozenRealizerRuntime(config, realizer) {
  const runtime = config.paid_execution_contract.realizer_runtime?.[realizer.id];
  if (!runtime) throw new Error(`stateBenchmarkStage1: no frozen runtime for ${realizer.id}`);
  return { model_ref: realizer.model_ref, ...clone(runtime) };
}

function frozenAnalyzerRuntime(config) {
  return clone(config.paid_execution_contract.public_turn_analyzer);
}

function callRecord({ index, role, claimEligible, canary, jobId, turn, frozen, metadata }) {
  return {
    schema: ADAPTIVE_STATE_STAGE1_CALL_V21_SCHEMA,
    version: EXPECTED_VERSION,
    id: `s1-call-${String(index).padStart(4, '0')}`,
    role,
    status: 'success',
    claim_eligible: claimEligible,
    canary: canary || null,
    job_id: jobId || null,
    turn: turn ?? null,
    provenance: validateAdaptiveStateCallMetadata(metadata, frozen, role),
    call_metadata: clone(metadata),
  };
}

function failureCallRecord({ index, role, claimEligible, canary, jobId, turn, frozen, metadata, error }) {
  const dispatchCount = Number(metadata?.dispatch_count);
  if (![0, 1].includes(dispatchCount)) {
    throw new Error(`stateBenchmarkStage1: ${role} failure omitted exact dispatch_count`);
  }
  return {
    schema: ADAPTIVE_STATE_STAGE1_CALL_V21_SCHEMA,
    version: EXPECTED_VERSION,
    id: `s1-call-${String(index).padStart(4, '0')}`,
    role,
    status: 'technical_failure',
    claim_eligible: claimEligible,
    canary: canary || null,
    job_id: jobId || null,
    turn: turn ?? null,
    provenance: {
      planned_model_ref: frozen.model_ref,
      planned_cli_model_label: frozen.expected_cli_model_label,
      requested_model_ref: metadata?.requested_model_ref || null,
      resolved_model_ref:
        metadata?.resolved_model_ref || normalizedModelLabel(metadata?.resolved_provider, metadata?.resolved_model),
      observed_model_ref:
        metadata?.observed_model_ref || normalizedModelLabel(metadata?.observed_provider, metadata?.observed_model),
      expected_cli_model_label: frozen.expected_cli_model_label,
      cli_argument_accepted:
        (metadata?.resolved_model_ref || normalizedModelLabel(metadata?.resolved_provider, metadata?.resolved_model)) ===
        frozen.expected_cli_model_label,
      model_attestation_basis:
        metadata?.model_attestation_basis || metadata?.model_attestation?.basis || null,
      independently_attested:
        metadata?.model_independently_attested === true || metadata?.model_attestation?.independently_attested === true,
      dispatch_count: dispatchCount,
      attempts: Number(metadata?.attempts ?? dispatchCount),
      wrapper_attempts: Number(metadata?.attempts ?? dispatchCount),
      semantic_rerolls: Number(metadata?.semantic_rerolls ?? 0),
      backend_request_count: 'unknown',
      backend_retries_observed: false,
    },
    call_metadata: clone(metadata || {}),
    error: String(error?.message || error || 'technical failure'),
  };
}

function callAccounting(ledger, plan) {
  const jobsByRealizer = new Map();
  for (const job of plan.jobs) {
    jobsByRealizer.set(
      job.language_realizer.id,
      (jobsByRealizer.get(job.language_realizer.id) || 0) + Number(job.expected_learner_realizer_calls),
    );
  }
  const roles = {
    'technical_pilot_matrix:codex_realizer': {
      planned: jobsByRealizer.get('codex_terra') || 0,
      reached: 0,
      dispatched: 0,
      completed: 0,
      failed: 0,
    },
    'technical_pilot_matrix:claude_realizer': {
      planned: jobsByRealizer.get('claude_sonnet') || 0,
      reached: 0,
      dispatched: 0,
      completed: 0,
      failed: 0,
    },
    'technical_pilot_matrix:public_turn_analyzer': {
      planned: Number(plan.counts.expected_public_turn_analyzer_calls),
      reached: 0,
      dispatched: 0,
      completed: 0,
      failed: 0,
    },
    'excluded_canary:codex_realizer': { planned: 1, reached: 0, dispatched: 0, completed: 0, failed: 0 },
    'excluded_canary:claude_realizer': { planned: 1, reached: 0, dispatched: 0, completed: 0, failed: 0 },
    'excluded_canary:public_turn_analyzer': {
      planned: 1,
      reached: 0,
      dispatched: 0,
      completed: 0,
      failed: 0,
    },
  };
  for (const row of ledger) {
    const bucket = row.excluded_technical_canary ? 'excluded_canary' : 'technical_pilot_matrix';
    const key = `${bucket}:${row.role}`;
    const summary = roles[key];
    if (!summary) throw new Error(`stateBenchmarkStage1: unknown call-accounting bucket ${key}`);
    summary.reached += 1;
    summary.dispatched += Number(row.provenance?.dispatch_count || 0);
    summary.completed += row.status === 'success' ? 1 : 0;
    summary.failed += row.status === 'technical_failure' ? 1 : 0;
    roles[key] = summary;
  }
  return {
    planned:
      Number(plan.counts.expected_cli_process_dispatches) +
      Number(plan.counts.excluded_technical_canary_calls),
    reached: ledger.length,
    dispatched: ledger.reduce((sum, row) => sum + Number(row.provenance?.dispatch_count || 0), 0),
    completed: ledger.filter((row) => row.status === 'success').length,
    failed: ledger.filter((row) => row.status === 'technical_failure').length,
    by_role_and_scope: roles,
  };
}

async function notify(onCall, record) {
  if (typeof onCall === 'function') await onCall(clone(record));
}

async function runRealizerCall({
  realizeTurn,
  budget,
  ledger,
  kind,
  realizer,
  frozen,
  input,
  expectedEventIds,
  context,
  onCall,
}) {
  budget.consume(kind);
  const role = realizer.id === 'codex_terra' ? 'codex_realizer' : 'claude_realizer';
  const callIndex = ledger.length + 1;
  const callContext = {
    ...clone(context),
    call_id: `s1-call-${String(callIndex).padStart(4, '0')}`,
    call_index: callIndex,
  };
  let result;
  let record;
  try {
    result = await realizeTurn({
      modelRef: realizer.model_ref,
      input: clone(input),
      expectedEventIds: [...expectedEventIds],
      effort: frozen.effort,
      timeoutMs: Number(frozen.timeout_ms),
      role,
      context: callContext,
    });
    if (
      !result?.output ||
      typeof result.raw_output !== 'string' ||
      typeof result.call_artifacts?.system_prompt !== 'string' ||
      typeof result.call_artifacts?.user_prompt !== 'string'
    ) {
      throw Object.assign(new Error('stateBenchmarkStage1: realizer omitted reconstructible output artifacts'), {
        callMetadata: result?.call_metadata,
        raw_output: result?.raw_output,
        callArtifacts: result?.call_artifacts,
      });
    }
    record = callRecord({
      index: ledger.length + 1,
      role,
      claimEligible: false,
      canary: context.canary || null,
      jobId: context.job_id,
      turn: context.turn,
      frozen,
      metadata: result.call_metadata,
    });
    record.technical_pilot = true;
    record.matrix_scored_call = kind === 'scored_realizer';
    record.excluded_technical_canary = kind === 'canary_realizer';
    record.realizer_artifacts = {
      public_input: clone(input),
      system_prompt: result.call_artifacts.system_prompt,
      user_prompt: result.call_artifacts.user_prompt,
      raw_output: result.raw_output,
      parsed_output: clone(result.output),
    };
    record.artifact_hashes = {
      public_input_sha256: hashCanonicalJson(input),
      system_prompt_sha256: sha256(result.call_artifacts.system_prompt),
      user_prompt_sha256: sha256(result.call_artifacts.user_prompt),
      raw_output_sha256: sha256(result.raw_output),
      parsed_output_sha256: hashCanonicalJson(result.output),
    };
    if (
      record.artifact_hashes.public_input_sha256 !== result.call_metadata?.input_sha256 ||
      record.artifact_hashes.system_prompt_sha256 !== result.call_metadata?.system_prompt_sha256 ||
      record.artifact_hashes.user_prompt_sha256 !== result.call_metadata?.user_prompt_sha256 ||
      result.call_artifacts.user_prompt !== canonicalJson(input) ||
      record.artifact_hashes.raw_output_sha256 !== result.call_metadata?.raw_output_sha256 ||
      record.artifact_hashes.parsed_output_sha256 !== result.call_metadata?.output_sha256
    ) {
      throw Object.assign(new Error('stateBenchmarkStage1: realizer artifact hashes do not match call provenance'), {
        callMetadata: result.call_metadata,
        raw_output: result.raw_output,
        callArtifacts: result.call_artifacts,
      });
    }
  } catch (error) {
    const failed = failureCallRecord({
      index: ledger.length + 1,
      role,
      claimEligible: false,
      canary: context.canary || null,
      jobId: context.job_id,
      turn: context.turn,
      frozen,
      metadata: error.callMetadata || result?.call_metadata,
      error,
    });
    failed.technical_pilot = true;
    failed.matrix_scored_call = kind === 'scored_realizer';
    failed.excluded_technical_canary = kind === 'canary_realizer';
    failed.realizer_artifacts = {
      public_input: clone(input),
      system_prompt:
        error.callArtifacts?.system_prompt ?? result?.call_artifacts?.system_prompt ?? null,
      user_prompt: error.callArtifacts?.user_prompt ?? result?.call_artifacts?.user_prompt ?? null,
      raw_output: error.raw_output ?? result?.raw_output ?? null,
      parsed_output: clone(result?.output),
    };
    failed.artifact_hashes = {
      public_input_sha256: hashCanonicalJson(input),
      system_prompt_sha256:
        typeof failed.realizer_artifacts.system_prompt === 'string'
          ? sha256(failed.realizer_artifacts.system_prompt)
          : null,
      user_prompt_sha256:
        typeof failed.realizer_artifacts.user_prompt === 'string'
          ? sha256(failed.realizer_artifacts.user_prompt)
          : null,
      raw_output_sha256:
        typeof failed.realizer_artifacts.raw_output === 'string'
          ? sha256(failed.realizer_artifacts.raw_output)
          : null,
      parsed_output_sha256:
        failed.realizer_artifacts.parsed_output === undefined
          ? null
          : hashCanonicalJson(failed.realizer_artifacts.parsed_output),
    };
    ledger.push(failed);
    await notify(onCall, failed);
    throw error;
  }
  ledger.push(record);
  await notify(onCall, record);
  return result.output;
}

async function runAnalyzerCall({
  analyzePublicText,
  budget,
  ledger,
  kind,
  frozen,
  publicModelInput,
  context,
  onCall,
}) {
  budget.consume(kind);
  assertNoForbiddenAnalyzerInput(publicModelInput);
  const callIndex = ledger.length + 1;
  const callContext = {
    ...clone(context),
    call_id: `s1-call-${String(callIndex).padStart(4, '0')}`,
    call_index: callIndex,
  };
  let result;
  let record;
  try {
    result = await analyzePublicText({
      publicModelInput: clone(publicModelInput),
      modelRef: frozen.model_ref,
      effort: frozen.effort,
      timeoutMs: Number(frozen.timeout_ms),
      parseMode: frozen.parse_mode,
      context: callContext,
    });
    const metadata = rawAnalyzerMetadata(result);
    record = callRecord({
      index: ledger.length + 1,
      role: 'public_turn_analyzer',
      claimEligible: false,
      canary: context.canary || null,
      jobId: context.job_id,
      turn: context.turn,
      frozen,
      metadata,
    });
    record.technical_pilot = true;
    record.matrix_scored_call = kind === 'scored_analyzer';
    record.excluded_technical_canary = kind === 'canary_analyzer';
    record.public_model_input = clone(publicModelInput);
    record.public_model_input_sha256 = hashCanonicalJson(publicModelInput);
    record.analyzer_artifacts = {
      system_prompt: result?.rawAnalysis?.systemPrompt || null,
      prompt: result?.rawAnalysis?.prompt || null,
      raw_output: result?.rawAnalysis?.rawText ?? null,
      parsed_output: clone(result?.rawAnalysis?.parsed),
      output_schema: clone(result?.rawAnalysis?.outputSchema),
      learner_record_update: clone(result?.learnerRecordUpdate),
      deterministic_update: null,
    };
    const artifactHashes = {
      public_model_input_sha256: record.public_model_input_sha256,
      system_prompt_sha256: result?.rawAnalysis?.systemPrompt
        ? sha256(result.rawAnalysis.systemPrompt)
        : null,
      prompt_sha256: result?.rawAnalysis?.prompt ? sha256(result.rawAnalysis.prompt) : null,
      output_schema_sha256: result?.rawAnalysis?.outputSchema
        ? hashCanonicalJson(result.rawAnalysis.outputSchema)
        : null,
      raw_output_sha256:
        typeof result?.rawAnalysis?.rawText === 'string' ? sha256(result.rawAnalysis.rawText) : null,
      parsed_output_sha256: result?.rawAnalysis?.parsed
        ? hashCanonicalJson(result.rawAnalysis.parsed)
        : null,
      model_input_envelope_sha256:
        result?.rawAnalysis?.systemPrompt && result?.rawAnalysis?.prompt && result?.rawAnalysis?.outputSchema
          ? hashCanonicalJson({
              systemPrompt: result.rawAnalysis.systemPrompt,
              prompt: result.rawAnalysis.prompt,
              outputSchema: result.rawAnalysis.outputSchema,
            })
          : null,
      learner_record_update_sha256: hashCanonicalJson(result?.learnerRecordUpdate),
    };
    if (
      !record.analyzer_artifacts.system_prompt ||
      !record.analyzer_artifacts.prompt ||
      typeof record.analyzer_artifacts.raw_output !== 'string' ||
      !record.analyzer_artifacts.parsed_output ||
      Object.values(artifactHashes).some((digest) => !SHA256.test(String(digest || '')))
    ) {
      throw Object.assign(new Error('stateBenchmarkStage1: analyzer omitted reconstructible call artifacts'), {
        callMetadata: metadata,
      });
    }
    if (
      artifactHashes.system_prompt_sha256 !== metadata.system_prompt_sha256 ||
      artifactHashes.prompt_sha256 !== metadata.prompt_sha256 ||
      artifactHashes.output_schema_sha256 !== metadata.output_schema_sha256 ||
      artifactHashes.raw_output_sha256 !== metadata.raw_output_sha256 ||
      artifactHashes.parsed_output_sha256 !== metadata.parsed_output_sha256 ||
      artifactHashes.model_input_envelope_sha256 !== metadata.input_sha256
    ) {
      throw Object.assign(new Error('stateBenchmarkStage1: analyzer artifact hashes do not match call provenance'), {
        callMetadata: metadata,
      });
    }
    record.artifact_hashes = artifactHashes;
    if (!result?.classification || !result?.learnerRecordUpdate || !result?.benchmarkTransitionEvent) {
      throw Object.assign(new Error('stateBenchmarkStage1: analyzer omitted strict parsed public analysis'), {
        callMetadata: metadata,
      });
    }
  } catch (error) {
    const failed = failureCallRecord({
      index: ledger.length + 1,
      role: 'public_turn_analyzer',
      claimEligible: false,
      canary: context.canary || null,
      jobId: context.job_id,
      turn: context.turn,
      frozen,
      metadata: error.callMetadata || result?.call_metadata,
      error,
    });
    failed.technical_pilot = true;
    failed.matrix_scored_call = kind === 'scored_analyzer';
    failed.excluded_technical_canary = kind === 'canary_analyzer';
    failed.public_model_input = clone(publicModelInput);
    failed.public_model_input_sha256 = hashCanonicalJson(publicModelInput);
    failed.analyzer_artifacts = {
      system_prompt:
        result?.rawAnalysis?.systemPrompt || error.analysisArtifacts?.systemPrompt || null,
      prompt: result?.rawAnalysis?.prompt || error.analysisArtifacts?.prompt || null,
      raw_output:
        result?.rawAnalysis?.rawText ?? error.analysisArtifacts?.rawText ?? error.raw_output ?? null,
      parsed_output: clone(result?.rawAnalysis?.parsed ?? error.analysisArtifacts?.parsed),
      output_schema: clone(
        result?.rawAnalysis?.outputSchema ?? error.analysisArtifacts?.outputSchema,
      ),
      learner_record_update: clone(result?.learnerRecordUpdate),
      deterministic_update: null,
    };
    failed.artifact_hashes = {
      public_model_input_sha256: failed.public_model_input_sha256,
      system_prompt_sha256:
        typeof failed.analyzer_artifacts.system_prompt === 'string'
          ? sha256(failed.analyzer_artifacts.system_prompt)
          : null,
      prompt_sha256:
        typeof failed.analyzer_artifacts.prompt === 'string'
          ? sha256(failed.analyzer_artifacts.prompt)
          : null,
      output_schema_sha256: failed.analyzer_artifacts.output_schema
        ? hashCanonicalJson(failed.analyzer_artifacts.output_schema)
        : null,
      raw_output_sha256:
        typeof failed.analyzer_artifacts.raw_output === 'string'
          ? sha256(failed.analyzer_artifacts.raw_output)
          : null,
      parsed_output_sha256: failed.analyzer_artifacts.parsed_output
        ? hashCanonicalJson(failed.analyzer_artifacts.parsed_output)
        : null,
      learner_record_update_sha256: failed.analyzer_artifacts.learner_record_update
        ? hashCanonicalJson(failed.analyzer_artifacts.learner_record_update)
        : null,
      deterministic_update_sha256: null,
    };
    ledger.push(failed);
    await notify(onCall, failed);
    throw error;
  }
  ledger.push(record);
  return { modelResult: result, callRecord: record };
}

async function finalizeAnalyzerPostprocess({ modelCall, processed, postprocessorProvenance, onCall }) {
  const record = modelCall.callRecord;
  record.postprocessor_status = 'success';
  record.deterministic_postprocessor_provenance = clone(postprocessorProvenance);
  record.analyzer_artifacts.deterministic_update = {
    accepted: clone(processed?.tutorLearnerDag?.accepted || null),
    rejected: clone(processed?.tutorLearnerDag?.rejected || []),
  };
  record.artifact_hashes.deterministic_update_sha256 = hashCanonicalJson(
    record.analyzer_artifacts.deterministic_update,
  );
  await notify(onCall, record);
  return processed;
}

async function failAnalyzerPostprocess({ modelCall, error, postprocessorProvenance, onCall }) {
  const record = modelCall.callRecord;
  record.postprocessor_status = 'technical_failure';
  record.postprocessor_error = String(error?.message || error);
  record.deterministic_postprocessor_provenance = clone(postprocessorProvenance);
  await notify(onCall, record);
  throw error;
}

async function runTechnicalCanaries({
  plan,
  config,
  adapters,
  worlds,
  realizeTurn,
  analyzePublicText,
  postprocessPublicAnalysis,
  budget,
  ledger,
  onCall,
}) {
  const seeds = config.paid_execution_contract.technical_canaries.seeds;
  for (const [index, realizer] of config.critical_path.language_realizers.entries()) {
    const adapter = adapters.get(config.critical_path.worlds[index].id);
    const kernel = adaptiveStateLearnerKernel(config.critical_path.latent_generators[index].id);
    const session = createAdaptiveStateKernelSession({ adapter, kernel, seed: seeds[index] });
    const first = stepAdaptiveStateKernelSession({
      session,
      action: config.critical_path.action_schedule[0],
      predictionTurn: 1,
    });
    const second = stepAdaptiveStateKernelSession({
      session: first.next_session,
      action: config.critical_path.action_schedule[1],
      predictionTurn: 2,
    });
    const envelope = second.transition.public_envelope;
    if (
      second.transition.event.kind !== 'adopt' ||
      envelope.required_realizer_output.realized_public_event_ids.length !== 1
    ) {
      throw new Error('stateBenchmarkStage1: provider canary must exercise one non-empty adopt event');
    }
    await runRealizerCall({
      realizeTurn,
      budget,
      ledger,
      kind: 'canary_realizer',
      realizer,
      frozen: frozenRealizerRuntime(config, realizer),
      input: realizerInput(
        envelope,
        [],
        config.critical_path.action_schedule[1],
        publicTutorTurn(
          config.critical_path.action_schedule[1],
          2,
          worlds.get(config.critical_path.worlds[index].id).question,
        ).text,
      ),
      expectedEventIds: envelope.required_realizer_output.realized_public_event_ids,
      context: { canary: 'provider_realizer_schema', canary_seed: seeds[index], turn: 1 },
      onCall,
    });
  }
  const firstWorld = config.critical_path.worlds[0];
  const publicWorld = publicWorldForAnalyzer(worlds.get(firstWorld.id));
  const canaryPremise = worlds.get(firstWorld.id).premises[0];
  const stagedCanary = {
    premise: canaryPremise.id,
    turn: 1,
    via: 'technical_canary_public_projection',
    surface: canaryPremise.surface,
    fact: clone(canaryPremise.fact),
  };
  const analyzerText = `I adopt this public evidence for my record: ${canaryPremise.surface}`;
  const analyzerModelCall = await runAnalyzerCall({
    analyzePublicText,
    budget,
    ledger,
    kind: 'canary_analyzer',
    frozen: frozenAnalyzerRuntime(config),
    publicModelInput: {
      learnerText: analyzerText,
      turn: 1,
      topic: worlds.get(firstWorld.id).question,
      world: publicWorld,
      publicStagedEvidence: [stagedCanary],
      publicReleaseLedger: [stagedCanary],
      tutorTurn: 1,
      currentTutorText: publicTutorTurn(null, 1, worlds.get(firstWorld.id).question).text,
      publicTranscript: [],
      priorPublicLearnerState: emptyPriorPublicLearnerState(),
      promptContext: {
        benchmark: 'adaptive_state_v2.1',
        world_id: firstWorld.id,
        technical_canary: true,
      },
    },
    context: { canary: 'public_turn_analyzer_json_contract', canary_seed: seeds[2], turn: 1 },
    onCall,
  });
  const postprocessorProvenance = {
    world_id: firstWorld.id,
    world_sha256: adapters.get(firstWorld.id).world_sha256,
    boundary: 'deterministic_task_key_postprocessor_after_model_return',
  };
  let analyzerCanary;
  try {
    const processed = await postprocessPublicAnalysis({
      analysis: analyzerModelCall.modelResult,
      publicModelInput: analyzerModelCall.callRecord.public_model_input,
      deterministicPostprocessorInput: {
        world: worlds.get(firstWorld.id),
        learnerRecord: null,
        dropout: null,
        previousObservation: null,
        previousTurnRecords: [],
      },
    });
    analyzerCanary = await finalizeAnalyzerPostprocess({
      modelCall: analyzerModelCall,
      processed,
      postprocessorProvenance,
      onCall,
    });
  } catch (error) {
    await failAnalyzerPostprocess({
      modelCall: analyzerModelCall,
      error,
      postprocessorProvenance,
      onCall,
    });
  }
  if (!analyzerCanary.tutorLearnerDag?.accepted?.adopt?.includes(canaryPremise.id)) {
    throw new Error('stateBenchmarkStage1: analyzer canary did not apply its one staged public premise');
  }
  if (analyzerCanary.benchmarkTransitionEvent?.family !== 'adopt') {
    throw new Error('stateBenchmarkStage1: analyzer canary did not classify its explicit adoption transition');
  }
  if (ledger.length !== Number(plan.counts.excluded_technical_canary_calls)) {
    throw new Error('stateBenchmarkStage1: technical canaries did not use exactly three excluded calls');
  }
}

async function runDialogue({
  job,
  adapter,
  world,
  config,
  realizeTurn,
  analyzePublicText,
  postprocessPublicAnalysis,
  budget,
  ledger,
  onCall,
}) {
  let session = createAdaptiveStateKernelSession({
    adapter,
    kernel: adaptiveStateLearnerKernel(job.latent_generator.id),
    seed: job.seed,
  });
  const observations = [bootstrapObservation(job)];
  const analyzerRecords = [];
  const realizedEventIds = [[]];
  const transitions = [];
  let publicHistory = [];
  let pendingLearner = null;
  let learnerRecord = null;
  let analysisDropout = null;
  let priorPublicLearnerState = emptyPriorPublicLearnerState();
  const firstSeenByPremise = new Map();
  const publicWorld = publicWorldForAnalyzer(world);
  const realizerRuntime = frozenRealizerRuntime(config, job.language_realizer);
  const analyzerRuntime = frozenAnalyzerRuntime(config);

  const realizeAndAnalyze = async ({ envelope, action, turn, transition = null }) => {
    const tutorTurn = publicTutorTurn(action, turn, world.question);
    const realizerHistory = [
      ...publicHistory.flatMap((row) => [
        { turn: row.turn, role: 'learner', text: row.learner },
        { turn: row.turn, role: 'tutor', text: row.tutor },
      ]),
      ...(pendingLearner
        ? [{ turn: turn - 1, role: 'learner', text: pendingLearner }]
        : []),
    ];
    const output = await runRealizerCall({
      realizeTurn,
      budget,
      ledger,
      kind: 'scored_realizer',
      realizer: job.language_realizer,
      frozen: realizerRuntime,
      input: realizerInput(envelope, realizerHistory, action, tutorTurn.text),
      expectedEventIds: envelope.required_realizer_output.realized_public_event_ids,
      context: { job_id: job.id, latent_pair_id: job.latent_pair_id, turn },
      onCall,
    });
    const realized = transition
      ? materializeAdaptiveStateTransitionTurn({ session, transition, realizerResult: output })
      : materializeAdaptiveStateInitialTurn(session, output);
    const analyzerHistory = pendingLearner
      ? [
          ...publicHistory,
          { turn: turn - 1, learner: pendingLearner, tutor: tutorTurn.text },
        ]
      : publicHistory;
    const publicStagedEvidence = stagedEvidenceForAnalyzer(world, envelope, firstSeenByPremise, turn);
    const publicModelInput = {
      learnerText: realized.realizer_output.learner_text,
      turn,
      topic: world.question,
      world: publicWorld,
      publicStagedEvidence,
      publicReleaseLedger: clone(publicStagedEvidence),
      tutorTurn: turn,
      currentTutorText: turn === 1 ? tutorTurn.text : '',
      publicTranscript: clone(analyzerHistory),
      priorPublicLearnerState: clone(priorPublicLearnerState),
      promptContext: {
        benchmark: 'adaptive_state_v2.1',
        world_id: job.world.id,
        proof_geometry: job.world.geometry,
      },
    };
    const deterministicPostprocessorInput = {
      world,
      learnerRecord,
      dropout: analysisDropout,
      previousObservation: observations.at(-1),
      previousTurnRecords: analyzerRecords,
    };
    const analyzerModelCall = await runAnalyzerCall({
      analyzePublicText,
      budget,
      ledger,
      kind: 'scored_analyzer',
      frozen: analyzerRuntime,
      publicModelInput,
      context: { job_id: job.id, latent_pair_id: job.latent_pair_id, turn },
      onCall,
    });
    const postprocessorProvenance = {
      world_id: job.world.id,
      world_sha256: adapter.world_sha256,
      boundary: 'deterministic_task_key_postprocessor_after_model_return',
    };
    let analysis;
    try {
      const processed = await postprocessPublicAnalysis({
        analysis: analyzerModelCall.modelResult,
        publicModelInput: analyzerModelCall.callRecord.public_model_input,
        deterministicPostprocessorInput,
      });
      analysis = await finalizeAnalyzerPostprocess({
        modelCall: analyzerModelCall,
        processed,
        postprocessorProvenance,
        onCall,
      });
    } catch (error) {
      await failAnalyzerPostprocess({
        modelCall: analyzerModelCall,
        error,
        postprocessorProvenance,
        onCall,
      });
    }
    const record = analyzerTurnRecord(analysis, turn, realized.realizer_output.learner_text);
    const observation = observationFromAnalysis(
      analysis,
      record,
      observations.at(-1),
      analyzerRecords,
      job,
      turn,
    );
    analyzerRecords.push(record);
    observations.push(observation);
    realizedEventIds.push(realized.realizer_output.realized_public_event_ids);
    analysisDropout = analysis.dropout || analysisDropout;
    learnerRecord = analysis.learnerRecord || learnerRecord;
    priorPublicLearnerState = advancePriorPublicLearnerState(priorPublicLearnerState, analysis);
    publicHistory = analyzerHistory;
    pendingLearner = realized.realizer_output.learner_text;
  };

  await realizeAndAnalyze({ envelope: session.initial_public_envelope, action: null, turn: 1 });
  for (const [index, action] of job.action_schedule.entries()) {
    const predictionTurn = index + 1;
    const stepped = stepAdaptiveStateKernelSession({ session, action, predictionTurn });
    await realizeAndAnalyze({
      envelope: stepped.transition.public_envelope,
      action,
      turn: predictionTurn + 1,
      transition: stepped.transition,
    });
    transitions.push(stepped.transition);
    session = stepped.next_session;
  }
  return {
    job,
    adapter,
    task: taskForAdapter(adapter),
    observations,
    transitions,
    analyzerModelRef: analyzerRuntime.model_ref,
    public: {
      schema: ADAPTIVE_STATE_STAGE1_DIALOGUE_V21_SCHEMA,
      version: EXPECTED_VERSION,
      id: job.id,
      latent_pair_id: job.latent_pair_id,
      cell_id: job.cell_id,
      world_id: job.world.id,
      generator_id: job.latent_generator.id,
      realizer_id: job.language_realizer.id,
      repetition: job.repetition,
      seed: job.seed,
      action_schedule: [...job.action_schedule],
      bootstrap_public_observations: job.bootstrap_public_observations,
      learner_turns: job.learner_turns,
      scored_transitions: job.scored_transitions,
      learner_realizer_calls: 7,
      public_turn_analyzer_calls: 7,
      cli_process_dispatches: 14,
      observation_source: 'live_public_text_analyzer',
      kernel_derived_classifier: false,
      observations: observations.map((observation, index) =>
        publicObservationSummary(observation, realizedEventIds[index] || []),
      ),
      target_sequence: transitions.map((transition) => clone(transition.targets)),
      transition_audit: transitions.map((transition) => ({
        prediction_turn: transition.prediction_turn,
        realized_turn: transition.realized_turn,
        plan_sha256: transition.plan_sha256,
        selected_branch_id: transition.selected_branch_id,
        audit_sequence: [...transition.audit_sequence],
      })),
    },
  };
}

/** Execute S1 through injected one-call seams. This function never imports a provider bridge. */
export async function executeAdaptiveStateStage1({
  plan,
  config,
  parent = null,
  parentRunDir,
  configPath = null,
  realizeTurn,
  analyzePublicText,
  postprocessPublicAnalysis,
  onCall = null,
  repoRoot = path.resolve('.'),
} = {}) {
  validateAdaptiveStateCriticalPathPlan(plan);
  if (
    plan.stage !== 's1_technical_pilot' ||
    plan.paid !== true ||
    plan.version !== EXPECTED_VERSION ||
    plan.counts.expected_cli_process_dispatches !== 336
  ) {
    throw new Error('stateBenchmarkStage1: executor accepts only the frozen 336-call v2.1 S1 plan');
  }
  const verifiedParent = validateAdaptiveStateStage1Parent({
    parentRunDir,
    config,
    configPath: configPath || path.join(repoRoot, 'config/adaptive-state-benchmark-v2.yaml'),
    repoRoot,
  });
  if (
    verifiedParent.config_sha256 !== plan.config_sha256 ||
    (parent && hashCanonicalJson(parent) !== hashCanonicalJson(verifiedParent))
  ) {
    throw new Error('stateBenchmarkStage1: freshly sealed matching S0 parent lineage is required');
  }
  if (
    typeof realizeTurn !== 'function' ||
    typeof analyzePublicText !== 'function' ||
    typeof postprocessPublicAnalysis !== 'function'
  ) {
    throw new Error(
      'stateBenchmarkStage1: realizeTurn, public-only analyzePublicText, and deterministic postprocessPublicAnalysis seams are required',
    );
  }
  const adapters = new Map(
    loadAdaptiveStateWorldAdapters(config.critical_path.worlds, { repoRoot }).map((adapter) => [adapter.id, adapter]),
  );
  const worlds = new Map(
    config.critical_path.worlds.map((row) => [row.id, loadWorld(path.resolve(repoRoot, row.source))]),
  );
  const budget = createCallBudget(plan);
  const ledger = [];
  const internalDialogues = [];
  try {
    await runTechnicalCanaries({
      plan,
      config,
      adapters,
      worlds,
      realizeTurn,
      analyzePublicText,
      postprocessPublicAnalysis,
      budget,
      ledger,
      onCall,
    });
    // Deliberately serial. Any exception stops the entire stage; there is no
    // dialogue retry, output repair, fallback model, or semantic reroll.
    for (const job of plan.jobs) {
      const adapter = adapters.get(job.world.id);
      const world = worlds.get(job.world.id);
      if (!adapter || !world) throw new Error(`stateBenchmarkStage1: missing world ${job.world.id}`);
      internalDialogues.push(
        await runDialogue({
          job,
          adapter,
          world,
          config,
          realizeTurn,
          analyzePublicText,
          postprocessPublicAnalysis,
          budget,
          ledger,
          onCall,
        }),
      );
    }
  } catch (error) {
    error.message = `stateBenchmarkStage1: paid stage stopped: ${error.message}`;
    error.stage1Partial = {
      call_accounting: callAccounting(ledger, plan),
      calls: clone(ledger),
      budget: budget.snapshot(),
      completed_dialogues: internalDialogues.map((row) => row.job.id),
    };
    throw error;
  }
  budget.assertExact();
  const rows = internalDialogues.flatMap((dialogue) => {
    const donor = donorFor(internalDialogues, dialogue);
    return dialogue.transitions.map((_transition, index) => rowFor(dialogue, donor, index, plan.version));
  });
  const counts = budget.snapshot();
  const accounting = callAccounting(ledger, plan);
  const scoredDispatched = ledger
    .filter((row) => row.matrix_scored_call)
    .reduce((sum, row) => sum + Number(row.provenance.dispatch_count), 0);
  const canaryDispatched = ledger
    .filter((row) => row.excluded_technical_canary)
    .reduce((sum, row) => sum + Number(row.provenance.dispatch_count), 0);
  const dataset = {
    schema: ADAPTIVE_STATE_STAGE1_DATASET_V21_SCHEMA,
    version: EXPECTED_VERSION,
    stage: 's1_technical_pilot',
    confirmation_eligible: false,
    s2_validity_verdict: null,
    design_sha256: plan.design_sha256,
    config_sha256: plan.config_sha256,
    parent: clone(verifiedParent),
    model_call_count: scoredDispatched,
    model_call_count_including_excluded_canaries: scoredDispatched + canaryDispatched,
    deprecated_model_call_count_alias_semantics: 'cli_process_dispatches_not_backend_requests',
    model_call_count_semantics: 'cli_process_dispatches_not_backend_requests',
    scored_cli_dispatch_count: scoredDispatched,
    total_cli_dispatch_count: scoredDispatched + canaryDispatched,
    backend_request_count: 'unknown',
    backend_retries_observed: false,
    learner_realizer_call_count: counts.used.scored_realizer,
    public_turn_analyzer_call_count: counts.used.scored_analyzer,
    excluded_technical_canary_call_count: counts.used.canary_realizer + counts.used.canary_analyzer,
    execution_order: 'serial_dialogues_and_turns',
    semantic_rerolls: 0,
    execution_mode: 'unsealed_injected_execution',
    execution_transaction: null,
    call_accounting: accounting,
    world_local_fact_ids: worldLocalIds(config, repoRoot),
    calls: ledger,
    dialogues: internalDialogues.map((dialogue) => dialogue.public),
    rows,
  };
  dataset.content_sha256 = adaptiveStateStage1DatasetContentSha256(dataset);
  return dataset;
}
