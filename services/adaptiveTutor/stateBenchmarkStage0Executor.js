import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';

import { hashCanonicalJson, hashFile } from '../experimentRunArtifacts.js';
import { loadWorld } from '../dramaticDerivation/world.js';
import { buildTutorStubStateObservation } from './tutorStubStateAdapter.js';
import {
  buildAdaptiveStateRepresentationsV2,
  buildAdaptiveStateTargetsV2,
  validateAdaptiveStateCriticalPathPlan,
} from './stateBenchmarkV2.js';
import {
  assertAdaptiveStateSemanticFidelity,
  realizeAdaptiveStateStage0LearnerTurn,
} from './stateBenchmarkDeterministicRealizer.js';
import {
  createAdaptiveStateExactObserver,
  observeAdaptiveStateExactPublicEvent,
} from './stateBenchmarkExactObserver.js';
import {
  adaptiveStateKernelTaskMetadata,
  adaptiveStateLearnerKernel,
  createAdaptiveStateKernelSession,
  loadAdaptiveStateWorldAdapters,
  stepAdaptiveStateKernelSession,
} from './learnerKernels/index.js';

export const ADAPTIVE_STATE_STAGE0_DATASET_V2_SCHEMA = 'machinespirits.adaptive-state-stage0-dataset.v2';
export const ADAPTIVE_STATE_BENCHMARK_ROW_V2_SCHEMA = 'machinespirits.adaptive-state-benchmark-row.v2';
export const ADAPTIVE_STATE_STAGE0_DIALOGUE_V2_SCHEMA = 'machinespirits.adaptive-state-stage0-dialogue.v2';
export const ADAPTIVE_STATE_STAGE0_ANALYZER_SOURCE_FILES = Object.freeze([
  'services/adaptiveTutor/stateBenchmarkStage0Analysis.js',
  'services/adaptiveTutor/tutorStubStateAdapter.js',
  'services/adaptiveTutor/stateBenchmarkExactObserver.js',
  'services/tutorStubPublicLearnerAnalysis.js',
  'services/tutorStubDagFactDropout.js',
  'services/tutorStubFieldTrajectory.js',
]);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
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

function benchmarkStratum(job, turn) {
  return {
    world_id: job.world.id,
    generator_id: job.latent_generator.id,
    action_id: job.action_schedule[turn - 1],
    turn,
  };
}

function observationProvenance(job, turn) {
  return {
    source: 'adaptive_state_stage0_exact_public_event_projection',
    kernel_derived_classifier: false,
    source_dialogue_id: job.id,
    latent_pair_id: job.latent_pair_id,
    realizer_id: job.language_realizer.id,
    benchmark_stratum:
      turn >= 1 && turn <= job.scored_transitions
        ? benchmarkStratum(job, turn)
        : {
            world_id: job.world.id,
            generator_id: job.latent_generator.id,
            action_id: turn === 0 ? 'bootstrap_public_observation' : 'terminal_observation',
            turn,
          },
  };
}

function inputForRealizer(envelope, transcript, action) {
  return {
    currentPublicActEnvelope: {
      ...clone(envelope.current_public_act_envelope),
      turn: Number(envelope.turn),
    },
    priorPublicTranscript: clone(transcript),
    currentAction: action ? { action_type: action } : null,
    publicWorldVocabulary: clone(envelope.public_world_vocabulary || {}),
  };
}

function publicObservationSummary(observation, realizedEventIds, semanticFidelity) {
  return {
    turn: observation.turn,
    learner_text: observation.learner_text,
    realized_public_event_ids: [...realizedEventIds],
    semantic_fidelity: clone(semanticFidelity),
    dag: clone(observation.dag),
    classifier: clone(observation.classifier),
    human_discourse: clone(observation.human_discourse),
    axes: clone(observation.axes),
    runtime_field_trajectory: clone(observation.runtime_field_trajectory),
    provenance: clone(observation.provenance),
  };
}

function runDialogue(job, adapter, world) {
  const kernel = adaptiveStateLearnerKernel(job.latent_generator.id);
  let session = createAdaptiveStateKernelSession({ adapter, kernel, seed: job.seed });
  const exactObserver = createAdaptiveStateExactObserver(world);
  const initialEnvelope = kernel.initialPublicEnvelope({ adapter, state: session.state, turn: 1 });
  const bootstrapRecord = observeAdaptiveStateExactPublicEvent({
    observer: exactObserver,
    envelope: initialEnvelope,
    learnerText: '',
    turn: 0,
  }).turn_record;
  const bootstrapObservation = buildTutorStubStateObservation({
    turnRecord: bootstrapRecord,
    provenance: observationProvenance(job, 0),
  });

  const transcript = [];
  const initialRealized = realizeAdaptiveStateStage0LearnerTurn({
    realizerId: job.language_realizer.id,
    ...inputForRealizer(initialEnvelope, transcript, null),
  });
  const semanticFidelity = [
    null,
    assertAdaptiveStateSemanticFidelity({
      currentPublicActEnvelope: inputForRealizer(initialEnvelope, transcript, null).currentPublicActEnvelope,
      output: initialRealized,
    }),
  ];
  transcript.push({ turn: 1, role: 'learner', text: initialRealized.learner_text });
  const firstRecord = observeAdaptiveStateExactPublicEvent({
    observer: exactObserver,
    envelope: initialEnvelope,
    learnerText: initialRealized.learner_text,
    turn: 1,
  }).turn_record;
  const turnRecords = [bootstrapRecord, firstRecord];
  const observations = [bootstrapObservation];
  observations.push(
    buildTutorStubStateObservation({
      turnRecord: firstRecord,
      previousObservation: bootstrapObservation,
      previousTurnRecords: [bootstrapRecord],
      provenance: observationProvenance(job, 1),
    }),
  );
  const realizedEventIds = [[], initialRealized.realized_public_event_ids];
  const transitions = [];
  for (let index = 0; index < job.action_schedule.length; index += 1) {
    const predictionTurn = index + 1;
    const action = job.action_schedule[index];
    const stepped = stepAdaptiveStateKernelSession({ session, action, predictionTurn });
    const transition = stepped.transition;
    const realized = realizeAdaptiveStateStage0LearnerTurn({
      realizerId: job.language_realizer.id,
      ...inputForRealizer(transition.public_envelope, transcript, action),
    });
    semanticFidelity.push(
      assertAdaptiveStateSemanticFidelity({
        currentPublicActEnvelope: {
          ...clone(transition.public_envelope.current_public_act_envelope),
          turn: Number(transition.public_envelope.turn),
        },
        output: realized,
      }),
    );
    const expectedIds = transition.public_envelope.required_realizer_output.realized_public_event_ids;
    if (JSON.stringify(realized.realized_public_event_ids) !== JSON.stringify(expectedIds)) {
      throw new Error(
        `stateBenchmarkStage0: realizer changed the semantic event in ${job.id} turn ${predictionTurn + 1}`,
      );
    }
    transcript.push({ turn: predictionTurn + 1, role: 'learner', text: realized.learner_text });
    const record = observeAdaptiveStateExactPublicEvent({
      observer: exactObserver,
      envelope: transition.public_envelope,
      turn: predictionTurn + 1,
      learnerText: realized.learner_text,
    }).turn_record;
    const priorRecords = [...turnRecords];
    const previousObservation = observations.at(-1);
    turnRecords.push(record);
    observations.push(
      buildTutorStubStateObservation({
        turnRecord: record,
        previousObservation,
        previousTurnRecords: priorRecords,
        provenance: observationProvenance(job, predictionTurn + 1),
      }),
    );
    realizedEventIds.push(realized.realized_public_event_ids);
    transitions.push(transition);
    session = stepped.next_session;
  }
  return {
    job,
    adapter,
    task: taskForAdapter(adapter),
    observations,
    transitions,
    public: {
      schema: ADAPTIVE_STATE_STAGE0_DIALOGUE_V2_SCHEMA,
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
      deterministic_realizer_calls: job.learner_turns,
      model_calls: 0,
      observations: observations.map((observation, index) =>
        publicObservationSummary(observation, realizedEventIds[index] || [], semanticFidelity[index]),
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

function donorFor(dialogues, recipient) {
  const candidates = dialogues
    .filter(
      (row) =>
        row.job.id !== recipient.job.id &&
        row.job.world.id === recipient.job.world.id &&
        row.job.latent_generator.id === recipient.job.latent_generator.id &&
        row.job.language_realizer.id === recipient.job.language_realizer.id &&
        row.job.seed !== recipient.job.seed,
    )
    .sort((left, right) => left.job.repetition - right.job.repetition || left.job.id.localeCompare(right.job.id));
  if (!candidates.length) throw new Error(`stateBenchmarkStage0: no different-seed donor for ${recipient.job.id}`);
  return candidates[0];
}

function rowFor(dialogue, donor, transitionIndex, version) {
  const turn = transitionIndex + 1;
  const currentObservation = dialogue.observations[turn];
  const nextObservation = dialogue.observations[turn + 1];
  const previousObservation = dialogue.observations[turn - 1];
  const donorObservation = donor.observations[turn];
  const transition = dialogue.transitions[transitionIndex];
  const targets = buildAdaptiveStateTargetsV2({
    currentObservation,
    nextObservation,
    proofTransition: transition.proof_transition,
  });
  if (JSON.stringify(targets) !== JSON.stringify(transition.targets)) {
    throw new Error(`stateBenchmarkStage0: target harness mismatch in ${dialogue.job.id} turn ${turn}`);
  }
  const representations = buildAdaptiveStateRepresentationsV2({
    observation: currentObservation,
    task: dialogue.task,
    previousObservation,
    matchedDagDonorObservation: donorObservation,
    matchedFieldDonorObservation: donorObservation,
    oracleState: transition.oracle_before_sample,
  });
  return {
    schema: ADAPTIVE_STATE_BENCHMARK_ROW_V2_SCHEMA,
    version,
    id: `${dialogue.job.id}__predict_t${turn}`,
    stage: 's0_contract',
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
    representations,
    targets,
    proof_transition: clone(transition.proof_transition),
    controls: {
      scramble_donor_dialogue_id: donor.job.id,
      scramble_donor_seed: donor.job.seed,
      scramble_donor_turn: turn,
      stale_observation_turn: previousObservation.turn,
    },
    provenance: {
      prediction_origin: 'after_learner_observation_before_frozen_action',
      oracle_captured_before_sampling: transition.audit_sequence[0] === 'oracle_captured_before_transition_sampling',
      transition_plan_sha256: transition.plan_sha256,
      world_sha256: dialogue.adapter.world_sha256,
      transition_kernel_sha256: transition.oracle_before_sample.kernel_provenance.transition_kernel_sha256,
      deterministic_realizer: dialogue.job.language_realizer.model_ref,
      model_calls: 0,
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

export function adaptiveStateStage0DatasetContentSha256(dataset) {
  return hashCanonicalJson(datasetContent(dataset));
}

export function validateAdaptiveStateStage0DatasetContentSha256(dataset) {
  if (dataset?.content_sha256 !== adaptiveStateStage0DatasetContentSha256(dataset)) {
    throw new Error('stateBenchmarkStage0: dataset content SHA-256 mismatch');
  }
  return true;
}

function readJsonLines(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`stateBenchmarkStage0: invalid JSONL at ${filePath}:${index + 1}: ${error.message}`);
      }
    });
}

function artifactPath(runDir, descriptor) {
  const filePath = path.resolve(runDir, descriptor.path);
  const relative = path.relative(path.resolve(runDir), filePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('stateBenchmarkStage0: dataset artifact path escapes the run directory');
  }
  if (hashFile(filePath) !== descriptor.sha256) {
    throw new Error(`stateBenchmarkStage0: dataset artifact hash mismatch for ${descriptor.path}`);
  }
  return filePath;
}

/** Reconstruct and checksum-verify the analyzer input from sealed artifacts. */
export function loadAdaptiveStateStage0Dataset(runDir) {
  const root = path.resolve(runDir);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'dataset-manifest.json'), 'utf8'));
  if (manifest.schema !== 'machinespirits.adaptive-state-stage0-dataset-manifest.v2') {
    throw new Error('stateBenchmarkStage0: unsupported dataset manifest schema');
  }
  const dialogues = readJsonLines(artifactPath(root, manifest.files.dialogues_jsonl));
  const rows = readJsonLines(artifactPath(root, manifest.files.benchmark_rows_jsonl));
  const dataset = {
    schema: manifest.dataset_schema,
    version: manifest.dataset_version,
    stage: manifest.stage,
    confirmation_eligible: manifest.confirmation_eligible,
    design_sha256: manifest.design_sha256,
    config_sha256: manifest.config_sha256,
    model_call_count: manifest.model_calls,
    deterministic_realizer_call_count: manifest.deterministic_realizer_calls,
    world_local_fact_ids: [...(manifest.audit_world_local_fact_ids || [])],
    dialogues,
    rows,
    content_sha256: manifest.dataset_content_sha256,
  };
  validateAdaptiveStateStage0DatasetContentSha256(dataset);
  return dataset;
}

export function buildAdaptiveStateStage0Dataset({ plan, config, repoRoot = path.resolve('.') } = {}) {
  validateAdaptiveStateCriticalPathPlan(plan);
  if (plan.stage !== 's0_contract' || plan.paid || plan.counts.expected_model_calls !== 0) {
    throw new Error('stateBenchmarkStage0: executor accepts only the frozen zero-call S0 plan');
  }
  const adapters = new Map(
    loadAdaptiveStateWorldAdapters(config.critical_path.worlds, { repoRoot }).map((adapter) => [adapter.id, adapter]),
  );
  const worlds = new Map(
    config.critical_path.worlds.map((row) => [row.id, loadWorld(path.resolve(repoRoot, row.source))]),
  );
  const internalDialogues = plan.jobs.map((job) => {
    const adapter = adapters.get(job.world.id);
    if (!adapter) throw new Error(`stateBenchmarkStage0: missing world adapter ${job.world.id}`);
    const world = worlds.get(job.world.id);
    if (!world) throw new Error(`stateBenchmarkStage0: missing world ${job.world.id}`);
    return runDialogue(job, adapter, world);
  });
  const rows = internalDialogues.flatMap((dialogue) => {
    const donor = donorFor(internalDialogues, dialogue);
    return dialogue.transitions.map((_transition, index) => rowFor(dialogue, donor, index, plan.version));
  });
  const dataset = {
    schema: ADAPTIVE_STATE_STAGE0_DATASET_V2_SCHEMA,
    version: plan.version,
    stage: 's0_contract',
    confirmation_eligible: false,
    design_sha256: plan.design_sha256,
    config_sha256: plan.config_sha256,
    model_call_count: 0,
    deterministic_realizer_call_count: internalDialogues.reduce(
      (sum, dialogue) => sum + dialogue.public.deterministic_realizer_calls,
      0,
    ),
    world_local_fact_ids: worldLocalIds(config, repoRoot),
    dialogues: internalDialogues.map((dialogue) => dialogue.public),
    rows,
  };
  dataset.content_sha256 = adaptiveStateStage0DatasetContentSha256(dataset);
  return dataset;
}
