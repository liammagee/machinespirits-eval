#!/usr/bin/env node

// Part 1b of the frozen v2.4 contract (PLAN_4_0/2026-07-13-adaptive-state-decomposition-and-voi-protocol-v2.4.md;
// machine mirror config/adaptive-state-instrument-v2.4.yaml): the active-sensing value-of-information study.
//
// Zero model calls end to end. Directional only: nothing here can rescue, reinterpret, exclude, or promote any
// row of any stopped run; `winner: null` and `do_not_optimize_policy` remain operative; S2 remains prohibited.
// A `graduate` verdict changes what may be *designed*, never what may be *run*.
//
// Frozen analyses:
//   B1 per-action information gain — exact Bayes filter (services/adaptiveTutor/latentKernelFilter.js) run along
//      the checksum-verified restore of the sealed v2.3 S0 exact-channel trajectories; at every scored transition
//      the expected one-step posterior-entropy reduction (bits) over latent state for each kernel-supported action.
//   B2 info-optimal schedule arm — one fresh zero-call dataset (label `adaptive-state-v24-voi-schedule`), same
//      matrix and dialogue shape as S0, deterministic renderers only, action chosen greedily to maximize expected
//      information gain (ties broken by the fixed schedule's slot action), sealed with the run-artifact machinery.
//   B3 channel-capacity read — the exact-filter posterior as predictor of both co-primary targets on each arm,
//      against each arm's own no_state baseline (class-prior and schedule-only comparators reported descriptively;
//      Part 1a showed the pilot's no_state is schedule-overfit, but the frozen verdict rule binds on no_state).
//   B4 estimator read — the pilot's fixed-head lean_dag refit (1x penalty) on the VOI arm, leave-one-world-out.
//   B5 info/pedagogy trade-off — proof-progress trajectories under the two schedules (descriptive).
//
// Sequencing: Part 1a's report must exist (and is read only for its classification label) before any Part 1b
// result is computed or inspected.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import yaml from 'yaml';

import {
  appendRunEvent,
  assertExperimentRun,
  buildExperimentRunPlan,
  canonicalJson,
  captureGitFingerprint,
  createRunPlan,
  createRunSeal,
  hashCanonicalJson,
  hashFile,
  sha256,
  verifyExperimentRun,
} from '../services/experimentRunArtifacts.js';
import {
  bootstrapMetric,
  predictionLosses,
  validateAdaptiveStateCanonicalPilotPredictions,
  validateAdaptiveStateCanonicalPilotReport,
} from '../services/adaptiveTutor/stateBenchmarkCanonicalPilot.js';
import {
  adaptiveStateStage0PredictionMetrics,
  buildAdaptiveStateOutOfFoldStateBlindBaselines,
  fitAdaptiveStateStage0Head,
  predictAdaptiveStateStage0Head,
  predictAdaptiveStateUniformBaseline,
  validateAdaptiveStateStage0ReportContentSha256,
  validateAdaptiveStateStage0SplitManifestContentSha256,
} from '../services/adaptiveTutor/stateBenchmarkStage0Analysis.js';
import { loadAdaptiveStateStage0Dataset } from '../services/adaptiveTutor/stateBenchmarkStage0Executor.js';
import {
  buildAdaptiveStateRepresentationsV2,
  buildAdaptiveStateTargetsV2,
} from '../services/adaptiveTutor/stateBenchmarkV2.js';
import {
  assertAdaptiveStateSemanticFidelity,
  realizeAdaptiveStateStage0LearnerTurn,
} from '../services/adaptiveTutor/stateBenchmarkDeterministicRealizer.js';
import {
  createAdaptiveStateExactObserver,
  observeAdaptiveStateExactPublicEvent,
} from '../services/adaptiveTutor/stateBenchmarkExactObserver.js';
import { buildTutorStubStateObservation } from '../services/adaptiveTutor/tutorStubStateAdapter.js';
import {
  CANONICAL_BENCHMARK_ACTION_TYPES,
  adaptiveStateKernelTaskMetadata,
  adaptiveStateLearnerKernel,
  createAdaptiveStateKernelSession,
  loadAdaptiveStateWorldAdapters,
  stepAdaptiveStateKernelSession,
} from '../services/adaptiveTutor/learnerKernels/index.js';
import { loadWorld } from '../services/dramaticDerivation/world.js';
import {
  adaptiveStatePublicObservationProjection,
  expectedLatentKernelInformationGainBits,
  forwardLatentKernelBelief,
  latentKernelBeliefEntropyBits,
  latentKernelStateKey,
  pointMassLatentKernelBelief,
  predictLatentKernelFilter,
  updateLatentKernelFilter,
} from '../services/adaptiveTutor/latentKernelFilter.js';

const SCRIPT = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT), '..');
const FILTER_MODULE = path.join(ROOT, 'services', 'adaptiveTutor', 'latentKernelFilter.js');

export const ADAPTIVE_STATE_VOI_STUDY_REPORT_SCHEMA = 'machinespirits.adaptive-state-voi-study-report.v2.4';
export const ADAPTIVE_STATE_VOI_DATASET_SCHEMA = 'machinespirits.adaptive-state-voi-schedule-dataset.v2.4';
export const ADAPTIVE_STATE_VOI_DIALOGUE_SCHEMA = 'machinespirits.adaptive-state-voi-dialogue.v2.4';
export const ADAPTIVE_STATE_VOI_VERDICT_SCHEMA = 'machinespirits.adaptive-state-voi-verdict.v2.4';

const INSTRUMENT_SCHEMA = 'machinespirits.adaptive-state-instrument-config.v2.4';
const EVIDENCE_MANIFEST_SCHEMA = 'machinespirits.adaptive-tutor-evidence-manifest.v1';
const BENCHMARK_ROW_SCHEMA = 'machinespirits.adaptive-state-benchmark-row.v2';
const TARGET_LABELS = Object.freeze({
  next_dag_event_family: Object.freeze(['retract', 'derive', 'adopt', 'none']),
  next_proof_trajectory: Object.freeze(['advance', 'regress', 'stall']),
});
const TARGETS = Object.freeze(Object.keys(TARGET_LABELS));
const VERDICT_TOKENS = Object.freeze([
  'graduate_active_sensing_to_paid',
  'close_sensor_program_on_substrate',
  'inconclusive_data_starved',
]);
const CONFIDENCE_LEVEL = 0.95;
const REUSE_MAX_PROBABILITY_DELTA = 1e-6;
const TIE_EPSILON = 1e-12;
const ORACLE_MATCH_TOLERANCE = 1e-12;

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function stable(values) {
  return [...values].sort((left, right) => String(left).localeCompare(String(right)));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function round(value, digits = 6) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : value;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + Number(value), 0) / values.length : null;
}

/**
 * Frozen v2.4 Part 1b contract assertion — fail closed on any drift between this implementation
 * and the machine mirror (config/adaptive-state-instrument-v2.4.yaml).
 */
export function assertAdaptiveStateV24VoiContract(instrumentConfig) {
  if (instrumentConfig?.schema !== INSTRUMENT_SCHEMA || String(instrumentConfig?.version) !== '2.4') {
    throw new Error('voi study: instrument config is not the frozen v2.4 machine mirror');
  }
  const expectedPart1b = {
    filter: 'exact_bayes_over_kernel_latent_state',
    filter_fixed_point_check: 'filter_prior_at_true_state_reproduces_kernel_oracle',
    analyses: [
      'per_action_information_gain',
      'info_optimal_schedule_arm_generation',
      'channel_capacity_read_per_schedule',
      'lean_estimator_refit_on_voi_arm',
      'info_pedagogy_tradeoff_descriptive',
    ],
    voi_arm: {
      label: 'adaptive-state-v24-voi-schedule',
      dialogues: 24,
      matrix: 'same_as_s0',
      renderers: 'deterministic_only',
      action_choice: 'greedy_expected_entropy_reduction_ties_to_fixed_schedule',
    },
    margins: {
      log_loss_nats: 0.05,
      brier: 0.02,
      action_information_floor_bits: 0.1,
      action_information_world_floor: 2,
      entropy_reduction_floor_bits_at_horizon: 0.1,
    },
    verdicts: [...VERDICT_TOKENS],
    inconclusive_requires_1a_label: 'data_starved',
    sequencing: '1a_report_written_before_any_1b_inspection',
    graduate_authorizes: 'design_only_new_prospective_contract_required_for_any_paid_run',
  };
  if (hashCanonicalJson(instrumentConfig.part_1b_voi) !== hashCanonicalJson(expectedPart1b)) {
    throw new Error('voi study: part_1b_voi drifted from the frozen v2.4 contract');
  }
  const expectedBootstrap = {
    clusters: 'latent_pair_id',
    resamples: 5000,
    seed: 20260713,
    refit_inside_resamples: false,
  };
  if (hashCanonicalJson(instrumentConfig.data_provenance?.bootstrap) !== hashCanonicalJson(expectedBootstrap)) {
    throw new Error('voi study: bootstrap contract drifted from the frozen v2.4 contract');
  }
  if (instrumentConfig.data_provenance?.new_run_label_prefix !== 'adaptive-state-v24-') {
    throw new Error('voi study: new-run label prefix drifted from the frozen v2.4 contract');
  }
  return {
    part_1b: clone(instrumentConfig.part_1b_voi),
    bootstrap: clone(instrumentConfig.data_provenance.bootstrap),
    label_prefix: instrumentConfig.data_provenance.new_run_label_prefix,
  };
}

function armPassesMargins(armContrasts, margins) {
  return TARGETS.every(
    (target) =>
      armContrasts[target].log_loss.point_delta >= margins.log_loss_nats &&
      armContrasts[target].brier_score.point_delta >= margins.brier,
  );
}

function armFailsMarginsOnBothTargets(armContrasts, margins) {
  return TARGETS.every(
    (target) =>
      !(
        armContrasts[target].log_loss.point_delta >= margins.log_loss_nats &&
        armContrasts[target].brier_score.point_delta >= margins.brier
      ),
  );
}

function ciSpansLine(confidenceInterval, line) {
  return Number(confidenceInterval.lower) <= line && line <= Number(confidenceInterval.upper);
}

/**
 * Frozen three-way verdict rule (protocol Part 1b), applied exactly as written:
 *
 * 1. `graduate_active_sensing_to_paid` — B3 on the info-optimal arm beats the arm's no-state
 *    baseline by >= 0.05 log-loss nats and >= 0.02 Brier on both targets where the fixed arm's B3
 *    equivalent did not (i.e. active scheduling flips the channel-capacity verdict), AND B1 shows
 *    >= 0.10 bits expected gain for at least one action in >= 2 worlds for each kernel.
 * 2. `close_sensor_program_on_substrate` — terminal posterior entropy over latent state on the
 *    info-optimal arm remains within 0.10 bits of the prior at horizon (entropy reduction below
 *    the floor), OR B3 fails the margins on both targets on both arms while the oracle passes.
 * 3. `inconclusive_data_starved` — only if Part 1a returned `data_starved` AND the
 *    cluster-bootstrap intervals for the B3 contrasts span both cut lines (every arm x target:
 *    the log-loss CI straddles 0.05 and the Brier CI straddles 0.02).
 *
 * The clauses are evaluated in the frozen order and the first match is emitted. If no clause
 * matches (a configuration the frozen rule does not name — e.g. B3 passes decisively on BOTH
 * arms, so scheduling flips nothing and nothing failed), the verdict defaults conservatively
 * against further sensor spend to `close_sensor_program_on_substrate`, flagged
 * `none_matched_conservative_default`, mirroring the Part 1a ambiguity default. The default
 * never overrides a literal match and never grants `graduate` authority.
 */
export function evaluateAdaptiveStateVoiVerdict({
  part1aLabel,
  margins,
  b3,
  b1MaxGainBits,
  entropyVoi,
  oraclePasses,
} = {}) {
  for (const arm of ['fixed', 'voi']) {
    for (const target of TARGETS) {
      for (const metric of ['log_loss', 'brier_score']) {
        const row = b3?.[arm]?.[target]?.[metric];
        if (
          !row ||
          !Number.isFinite(Number(row.point_delta)) ||
          !Number.isFinite(Number(row.confidence_interval?.lower)) ||
          !Number.isFinite(Number(row.confidence_interval?.upper))
        ) {
          throw new Error(`voi verdict: missing B3 contrast ${arm}/${target}/${metric}`);
        }
      }
    }
  }
  if (!margins || !(margins.log_loss_nats > 0) || !(margins.brier > 0)) {
    throw new Error('voi verdict: frozen margins are required');
  }
  const voiPasses = armPassesMargins(b3.voi, margins);
  const fixedPasses = armPassesMargins(b3.fixed, margins);
  const perKernel = {};
  for (const [kernel, worlds] of Object.entries(b1MaxGainBits || {})) {
    const qualifyingWorldsByAction = {};
    for (const [world, actions] of Object.entries(worlds)) {
      for (const [action, bits] of Object.entries(actions)) {
        if (Number(bits) >= margins.action_information_floor_bits) {
          (qualifyingWorldsByAction[action] = qualifyingWorldsByAction[action] || []).push(world);
        }
      }
    }
    const qualifyingActions = Object.fromEntries(
      Object.entries(qualifyingWorldsByAction)
        .filter(([, qualifyingWorlds]) => qualifyingWorlds.length >= margins.action_information_world_floor)
        .map(([action, qualifyingWorlds]) => [action, stable(qualifyingWorlds)]),
    );
    perKernel[kernel] = { qualifying_actions: qualifyingActions, passed: Object.keys(qualifyingActions).length > 0 };
  }
  const kernelIds = Object.keys(perKernel);
  const b1Floor = kernelIds.length > 0 && kernelIds.every((kernel) => perKernel[kernel].passed);
  const graduate = {
    voi_arm_passes_margins: voiPasses,
    fixed_arm_passes_margins: fixedPasses,
    scheduling_flips_capacity_verdict: voiPasses && !fixedPasses,
    action_information_floor: { passed: b1Floor, per_kernel: perKernel },
    passed: voiPasses && !fixedPasses && b1Floor,
  };
  const meanReduction = Number(entropyVoi?.mean_reduction_bits);
  if (!Number.isFinite(meanReduction)) throw new Error('voi verdict: VOI-arm entropy reduction is required');
  const entropyClause = {
    mean_prior_bits_at_horizon: Number(entropyVoi.mean_prior_bits_at_horizon),
    mean_posterior_bits_at_horizon: Number(entropyVoi.mean_posterior_bits_at_horizon),
    mean_reduction_bits: meanReduction,
    floor_bits: margins.entropy_reduction_floor_bits_at_horizon,
    passed: meanReduction < margins.entropy_reduction_floor_bits_at_horizon,
  };
  const b3FailureClause = {
    fixed_arm_fails_margins_on_both_targets: armFailsMarginsOnBothTargets(b3.fixed, margins),
    voi_arm_fails_margins_on_both_targets: armFailsMarginsOnBothTargets(b3.voi, margins),
    oracle_passes_fixed_arm: oraclePasses?.fixed === true,
    oracle_passes_voi_arm: oraclePasses?.voi === true,
  };
  b3FailureClause.passed =
    b3FailureClause.fixed_arm_fails_margins_on_both_targets &&
    b3FailureClause.voi_arm_fails_margins_on_both_targets &&
    b3FailureClause.oracle_passes_fixed_arm &&
    b3FailureClause.oracle_passes_voi_arm;
  const close = {
    entropy: entropyClause,
    b3_failure: b3FailureClause,
    passed: entropyClause.passed || b3FailureClause.passed,
  };
  const ciSpans = {};
  for (const arm of ['fixed', 'voi']) {
    ciSpans[arm] = {};
    for (const target of TARGETS) {
      ciSpans[arm][target] = {
        log_loss_spans_cut_line: ciSpansLine(b3[arm][target].log_loss.confidence_interval, margins.log_loss_nats),
        brier_spans_cut_line: ciSpansLine(b3[arm][target].brier_score.confidence_interval, margins.brier),
      };
    }
  }
  const allSpan = ['fixed', 'voi'].every((arm) =>
    TARGETS.every(
      (target) => ciSpans[arm][target].log_loss_spans_cut_line && ciSpans[arm][target].brier_spans_cut_line,
    ),
  );
  const inconclusive = {
    part_1a_label: part1aLabel,
    requires_1a_label: 'data_starved',
    ci_spans: ciSpans,
    all_b3_contrast_cis_span_cut_lines: allSpan,
    passed: part1aLabel === 'data_starved' && allSpan,
  };
  let token;
  let matchedClause;
  const notes = [];
  if (graduate.passed) {
    token = 'graduate_active_sensing_to_paid';
    matchedClause = 'graduate';
  } else if (close.passed) {
    token = 'close_sensor_program_on_substrate';
    matchedClause = close.entropy.passed ? 'close_entropy_floor' : 'close_b3_failure_both_arms';
  } else if (inconclusive.passed) {
    token = 'inconclusive_data_starved';
    matchedClause = 'inconclusive';
  } else {
    token = 'close_sensor_program_on_substrate';
    matchedClause = 'none_matched_conservative_default';
    notes.push(
      'No frozen clause matched literally (the measured configuration is one the frozen rule does not name). ' +
        'The verdict defaults conservatively against further sensor spend, mirroring the Part 1a ambiguity default. ' +
        'The default grants no graduate authority and asserts no channel-concealment claim; read the clause numbers, ' +
        'not the token gloss, for the boundary finding.',
    );
  }
  return {
    schema: ADAPTIVE_STATE_VOI_VERDICT_SCHEMA,
    token,
    matched_clause: matchedClause,
    margins: clone(margins),
    clauses: { graduate, close, inconclusive },
    notes,
  };
}

function verifyRestoredArchive({ runDir, manifestPath, role }) {
  const manifest = readJson(manifestPath);
  if (manifest.schema !== EVIDENCE_MANIFEST_SCHEMA) {
    throw new Error(`voi study: unsupported evidence manifest schema for ${role}`);
  }
  const verification = verifyExperimentRun(runDir);
  if (!verification.ok) {
    throw new Error(`voi study: restored ${role} run failed verification:\n- ${verification.errors.join('\n- ')}`);
  }
  if (verification.plan.runId !== manifest.runId) {
    throw new Error(`voi study: restored ${role} run id does not match the pinned evidence manifest`);
  }
  const sealSha256 = sha256(fs.readFileSync(path.join(runDir, 'run-seal.json')));
  if (sealSha256 !== manifest.source?.sealSha256) {
    throw new Error(`voi study: restored ${role} seal does not match the pinned evidence manifest`);
  }
  return {
    run_id: manifest.runId,
    manifest_path: path.relative(ROOT, manifestPath),
    archive_sha256: manifest.archive?.sha256,
    seal_sha256: sealSha256,
    verified: true,
  };
}

function assertOracleDistributionsEqual(actual, expected, context) {
  for (const target of TARGETS) {
    for (const label of TARGET_LABELS[target]) {
      const difference = Math.abs(Number(actual[target][label]) - Number(expected[target][label]));
      if (!(difference <= ORACLE_MATCH_TOLERANCE)) {
        throw new Error(`voi study: filter fixed-point violated at ${context} (${target}/${label}, |d|=${difference})`);
      }
    }
  }
}

/**
 * Run the exact filter along one latent trajectory. `pickAction` receives the per-action gain
 * table for the current belief and returns `{ action, basis }`; `seal` (optional) is the sealed
 * dialogue record to replay-verify against (plan hash, selected branch, harness targets).
 */
function runFilterAlongTrajectory({ kernel, adapter, seed, scoredTransitions, pickAction, seal = null }) {
  let session = createAdaptiveStateKernelSession({ adapter, kernel, seed });
  let belief = pointMassLatentKernelBelief(session.state);
  const steps = [];
  const fallbacks = [];
  for (let index = 0; index < scoredTransitions; index += 1) {
    const predictionTurn = index + 1;
    const transitionSeed = seed * 100 + predictionTurn;
    const beliefEntropyBefore = latentKernelBeliefEntropyBits(belief);
    const gains = {};
    const illegalActions = [];
    for (const actionType of CANONICAL_BENCHMARK_ACTION_TYPES) {
      try {
        gains[actionType] = expectedLatentKernelInformationGainBits({
          kernel,
          adapter,
          belief,
          action: actionType,
          turn: predictionTurn,
          seed: transitionSeed,
        });
      } catch (error) {
        illegalActions.push({ action: actionType, error: String(error?.message || error) });
      }
    }
    if (!Object.keys(gains).length) {
      throw new Error(`voi study: no legal action at ${adapter.id}/${kernel.id}/seed=${seed}/turn=${predictionTurn}`);
    }
    const picked = pickAction({ index, predictionTurn, belief, gains, illegalActions });
    if (picked.basis === 'fallback_fixed_schedule' || illegalActions.length) {
      fallbacks.push({
        world_id: adapter.id,
        generator_id: kernel.id,
        seed,
        prediction_turn: predictionTurn,
        action: picked.action,
        basis: picked.basis,
        illegal_actions: illegalActions,
      });
    }
    const prediction = predictLatentKernelFilter({
      kernel,
      adapter,
      belief,
      action: picked.action,
      turn: predictionTurn,
      seed: transitionSeed,
    });
    const stepped = stepAdaptiveStateKernelSession({ session, action: picked.action, predictionTurn });
    const transition = stepped.transition;
    if (seal) {
      const audit = seal.transition_audit[index];
      if (
        transition.plan_sha256 !== audit.plan_sha256 ||
        transition.selected_branch_id !== audit.selected_branch_id ||
        JSON.stringify(transition.targets) !== JSON.stringify(seal.target_sequence[index])
      ) {
        throw new Error(`voi study: sealed S0 replay mismatch at ${seal.id} turn ${predictionTurn}`);
      }
    }
    // Mandated fixed-point check, live on every transition where the belief is a point mass on
    // the true kernel state: the filter forecast must equal the kernel's own oracle exactly.
    if (belief.states.length === 1 && belief.states[0].key === latentKernelStateKey(session.state)) {
      assertOracleDistributionsEqual(
        prediction.target_distributions,
        transition.oracle_before_sample.distributions,
        `${adapter.id}/${kernel.id}/seed=${seed}/turn=${predictionTurn}`,
      );
    }
    const observation = adaptiveStatePublicObservationProjection({
      adapter,
      event: transition.event,
      nextState: transition.next_state,
    });
    const updated = updateLatentKernelFilter({
      kernel,
      adapter,
      belief,
      action: picked.action,
      observation,
      turn: predictionTurn,
      seed: transitionSeed,
    });
    steps.push({
      prediction_turn: predictionTurn,
      action: picked.action,
      basis: picked.basis,
      belief_entropy_bits_before: beliefEntropyBefore,
      gains,
      illegal_actions: illegalActions,
      filter_target_distributions: clone(prediction.target_distributions),
      transition,
      observation,
      observation_probability: updated.observation_probability,
      posterior_entropy_bits: latentKernelBeliefEntropyBits(updated.belief),
    });
    belief = updated.belief;
    session = stepped.next_session;
  }
  let prior = pointMassLatentKernelBelief(kernel.initialize({ adapter, seed }));
  const priorTrace = [];
  for (const step of steps) {
    prior = forwardLatentKernelBelief({
      kernel,
      adapter,
      belief: prior,
      action: step.action,
      turn: step.prediction_turn,
      seed: seed * 100 + step.prediction_turn,
    });
    priorTrace.push(latentKernelBeliefEntropyBits(prior));
  }
  const posteriorAtHorizon = steps.at(-1).posterior_entropy_bits;
  const priorAtHorizon = priorTrace.at(-1);
  return {
    steps,
    fallbacks,
    entropy: {
      posterior_bits_at_horizon: posteriorAtHorizon,
      prior_only_bits_at_horizon: priorAtHorizon,
      reduction_bits: priorAtHorizon - posteriorAtHorizon,
      prior_only_trace_bits: priorTrace,
      posterior_trace_bits: steps.map((step) => step.posterior_entropy_bits),
    },
  };
}

// ---------------------------------------------------------------------------------------------
// B2 — info-optimal schedule arm generation (zero-call, deterministic renderers, sealed).
// ---------------------------------------------------------------------------------------------

function rotateSchedule(schedule, offset) {
  const shift = ((offset % schedule.length) + schedule.length) % schedule.length;
  return [...schedule.slice(shift), ...schedule.slice(0, shift)];
}

function voiLatentSeed(label, worldId, generatorId, repetition) {
  const digest = sha256(`${label}|${worldId}|${generatorId}|r${repetition}|latent-seed`);
  return Number.parseInt(digest.slice(0, 10), 16);
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
    source: 'adaptive_state_v24_voi_exact_public_event_projection',
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

/** Realize one VOI dialogue (deterministic renderer + exact observer) over a shared latent trajectory. */
function realizeVoiDialogue({ job, adapter, world, kernel, trajectory }) {
  const session = createAdaptiveStateKernelSession({ adapter, kernel, seed: job.seed });
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
  for (const [index, step] of trajectory.steps.entries()) {
    const predictionTurn = index + 1;
    const transition = step.transition;
    const realized = realizeAdaptiveStateStage0LearnerTurn({
      realizerId: job.language_realizer.id,
      ...inputForRealizer(transition.public_envelope, transcript, step.action),
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
      throw new Error(`voi study: realizer changed the semantic event in ${job.id} turn ${predictionTurn + 1}`);
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
  }
  return {
    job,
    adapter,
    task: taskForAdapter(adapter),
    observations,
    trajectory,
    public: {
      schema: ADAPTIVE_STATE_VOI_DIALOGUE_SCHEMA,
      id: job.id,
      latent_pair_id: job.latent_pair_id,
      cell_id: job.cell_id,
      world_id: job.world.id,
      generator_id: job.latent_generator.id,
      realizer_id: job.language_realizer.id,
      repetition: job.repetition,
      seed: job.seed,
      action_schedule: [...job.action_schedule],
      fixed_action_schedule: [...job.fixed_action_schedule],
      action_choice: trajectory.steps.map((step) => ({
        prediction_turn: step.prediction_turn,
        action: step.action,
        basis: step.basis,
        expected_gain_bits: Object.fromEntries(
          Object.entries(step.gains).map(([action, gain]) => [action, round(gain.expected_gain_bits, 12)]),
        ),
      })),
      bootstrap_public_observations: job.bootstrap_public_observations,
      learner_turns: job.learner_turns,
      scored_transitions: job.scored_transitions,
      deterministic_realizer_calls: job.learner_turns,
      model_calls: 0,
      observations: observations.map((observation, index) =>
        publicObservationSummary(observation, realizedEventIds[index] || [], semanticFidelity[index]),
      ),
      target_sequence: trajectory.steps.map((step) => clone(step.transition.targets)),
      transition_audit: trajectory.steps.map((step) => ({
        prediction_turn: step.transition.prediction_turn,
        realized_turn: step.transition.realized_turn,
        plan_sha256: step.transition.plan_sha256,
        selected_branch_id: step.transition.selected_branch_id,
        audit_sequence: [...step.transition.audit_sequence],
      })),
      entropy: {
        posterior_bits_at_horizon: trajectory.entropy.posterior_bits_at_horizon,
        prior_only_bits_at_horizon: trajectory.entropy.prior_only_bits_at_horizon,
        reduction_bits: trajectory.entropy.reduction_bits,
      },
    },
  };
}

function voiDonorFor(dialogues, recipient, turn) {
  const action = recipient.job.action_schedule[turn - 1];
  const strict = dialogues
    .filter(
      (row) =>
        row.job.id !== recipient.job.id &&
        row.job.world.id === recipient.job.world.id &&
        row.job.latent_generator.id === recipient.job.latent_generator.id &&
        row.job.language_realizer.id === recipient.job.language_realizer.id &&
        row.job.seed !== recipient.job.seed &&
        row.job.action_schedule[turn - 1] === action,
    )
    .sort((left, right) => left.job.repetition - right.job.repetition || left.job.id.localeCompare(right.job.id));
  if (strict.length) return { donor: strict[0], state_identical: false, basis: 'different_seed_same_action' };
  const paired = dialogues.find(
    (row) =>
      row.job.id !== recipient.job.id &&
      row.job.latent_pair_id === recipient.job.latent_pair_id &&
      row.job.language_realizer.id !== recipient.job.language_realizer.id,
  );
  if (!paired) throw new Error(`voi study: no scramble donor for ${recipient.job.id} turn ${turn}`);
  // The paired renderer shares the latent trajectory (same seed and realized schedule), so this
  // donor is state-identical. Recorded as such: VOI-arm scramble controls are structural filler
  // for the canonical representation builder, not analyzed controls (none of B1-B5 reads them).
  return { donor: paired, state_identical: true, basis: 'paired_renderer_state_identical' };
}

function voiRowFor(dialogue, dialogues, transitionIndex) {
  const turn = transitionIndex + 1;
  const currentObservation = dialogue.observations[turn];
  const nextObservation = dialogue.observations[turn + 1];
  const previousObservation = dialogue.observations[turn - 1];
  const { donor, state_identical: stateIdentical, basis } = voiDonorFor(dialogues, dialogue, turn);
  const donorObservation = donor.observations[turn];
  const step = dialogue.trajectory.steps[transitionIndex];
  const transition = step.transition;
  const targets = buildAdaptiveStateTargetsV2({
    currentObservation,
    nextObservation,
    proofTransition: transition.proof_transition,
  });
  if (JSON.stringify(targets) !== JSON.stringify(transition.targets)) {
    throw new Error(`voi study: target harness mismatch in ${dialogue.job.id} turn ${turn}`);
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
    schema: BENCHMARK_ROW_SCHEMA,
    version: '2.4-voi',
    id: `${dialogue.job.id}__predict_t${turn}`,
    stage: 'v24_voi_schedule',
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
    action_choice_basis: step.basis,
    representations,
    targets,
    proof_transition: clone(transition.proof_transition),
    controls: {
      scramble_donor_dialogue_id: donor.job.id,
      scramble_donor_seed: donor.job.seed,
      scramble_donor_turn: turn,
      scramble_donor_basis: basis,
      scramble_donor_state_identical: stateIdentical,
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

function buildVoiJobs({ config, label }) {
  const critical = config.critical_path;
  const realizers = critical.deterministic_realizers;
  const schedule = critical.action_schedule;
  const jobs = [];
  let latentPairIndex = 0;
  for (const world of critical.worlds) {
    for (const generator of critical.latent_generators) {
      for (let repetition = 1; repetition <= 2; repetition += 1) {
        const seed = voiLatentSeed(label, world.id, generator.id, repetition);
        const fixedActionSchedule = rotateSchedule(schedule, latentPairIndex);
        const orderedRealizers = rotateSchedule(realizers, latentPairIndex + repetition - 1);
        for (const realizer of orderedRealizers) {
          const cellId = `${world.id}__${generator.id}__${realizer.id}`;
          jobs.push({
            id: `v24_voi__${cellId}__r${repetition}`,
            stage: 'v24_voi_schedule',
            cell_id: cellId,
            latent_pair_id: `v24_voi__${world.id}__${generator.id}__r${repetition}`,
            world: { ...world },
            latent_generator: { ...generator },
            language_realizer: { ...realizer },
            repetition,
            seed,
            fixed_action_schedule: fixedActionSchedule,
            action_schedule: null, // realized greedy schedule, filled after simulation
            bootstrap_public_observations: Number(critical.dialogue.bootstrap_public_observations),
            learner_turns: Number(critical.dialogue.learner_turns),
            scored_transitions: Number(critical.dialogue.scored_transitions),
            expected_model_calls: 0,
          });
        }
      }
      latentPairIndex += 1;
    }
  }
  return jobs;
}

function greedyActionPicker(fixedSchedule) {
  return ({ index, gains }) => {
    const fixedAction = fixedSchedule[index];
    const candidates = Object.entries(gains).map(([action, gain]) => ({ action, bits: gain.expected_gain_bits }));
    if (!candidates.length) return { action: fixedAction, basis: 'fallback_fixed_schedule' };
    const best = Math.max(...candidates.map((row) => row.bits));
    const tied = candidates.filter((row) => best - row.bits <= TIE_EPSILON);
    if (tied.length === 1) return { action: tied[0].action, basis: 'greedy' };
    if (tied.some((row) => row.action === fixedAction)) return { action: fixedAction, basis: 'tie_fixed_schedule' };
    return {
      action: [...tied].sort((left, right) => left.action.localeCompare(right.action))[0].action,
      basis: 'tie_lexicographic',
    };
  };
}

function generateVoiArm({ config, label, adapters, worlds }) {
  const jobs = buildVoiJobs({ config, label });
  const trajectories = new Map();
  const fallbacks = [];
  for (const job of jobs) {
    if (trajectories.has(job.latent_pair_id)) continue;
    const adapter = adapters.get(job.world.id);
    const kernel = adaptiveStateLearnerKernel(job.latent_generator.id);
    const trajectory = runFilterAlongTrajectory({
      kernel,
      adapter,
      seed: job.seed,
      scoredTransitions: job.scored_transitions,
      pickAction: greedyActionPicker(job.fixed_action_schedule),
    });
    fallbacks.push(...trajectory.fallbacks);
    trajectories.set(job.latent_pair_id, trajectory);
  }
  for (const job of jobs) {
    job.action_schedule = trajectories.get(job.latent_pair_id).steps.map((step) => step.action);
  }
  const dialogues = jobs.map((job) =>
    realizeVoiDialogue({
      job,
      adapter: adapters.get(job.world.id),
      world: worlds.get(job.world.id),
      kernel: adaptiveStateLearnerKernel(job.latent_generator.id),
      trajectory: trajectories.get(job.latent_pair_id),
    }),
  );
  const rows = dialogues.flatMap((dialogue) =>
    dialogue.trajectory.steps.map((_step, index) => voiRowFor(dialogue, dialogues, index)),
  );
  const dataset = {
    schema: ADAPTIVE_STATE_VOI_DATASET_SCHEMA,
    version: '2.4',
    stage: 'v24_voi_schedule',
    label,
    confirmation_eligible: false,
    action_choice: 'greedy_expected_entropy_reduction_ties_to_fixed_schedule',
    model_call_count: 0,
    deterministic_realizer_call_count: dialogues.reduce((sum, dialogue) => sum + dialogue.public.learner_turns, 0),
    dialogues: dialogues.map((dialogue) => dialogue.public),
    rows,
    fallback_count: fallbacks.length,
    fallbacks,
  };
  dataset.content_sha256 = hashCanonicalJson(
    (() => {
      const content = { ...dataset };
      delete content.content_sha256;
      return content;
    })(),
  );
  return { jobs, trajectories, dialogues, dataset, fallbacks };
}

function writeExclusive(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  try {
    fs.writeFileSync(filePath, content, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error(`voi study: refusing to overwrite frozen artifact at ${filePath}`);
    throw error;
  }
  return { path: filePath, bytes: Buffer.byteLength(content), sha256: sha256(content) };
}

function jsonl(rows) {
  return rows.map((row) => canonicalJson(row)).join('\n') + '\n';
}

function aggregateFileHash(paths) {
  return hashCanonicalJson(
    [...new Set(paths)].sort().map((file) => ({ path: file, sha256: hashFile(path.resolve(ROOT, file)) })),
  );
}

function sealVoiRun({ runDir, label, generation, config, configPath, instrumentConfigPath, s0Archive, replayPassed }) {
  const git = captureGitFingerprint({ repoRoot: ROOT });
  delete git.repoRoot;
  const plan = buildExperimentRunPlan({
    runId: label,
    runner: path.relative(ROOT, SCRIPT),
    provenance: { git },
    models: {
      learner_realizer: {
        requested: 'deterministic-stage0-crossed-set',
        resolved: 'deterministic-stage0-crossed-set',
        observed: null,
        allowedObservedModels: generation.jobs.map((job) => job.language_realizer.model_ref),
      },
    },
    requiredObservedModelRoles: [],
    hashes: {
      runner: aggregateFileHash([
        path.relative(ROOT, SCRIPT),
        path.relative(ROOT, FILTER_MODULE),
        'services/adaptiveTutor/stateBenchmarkV2.js',
        'services/adaptiveTutor/stateBenchmarkDeterministicRealizer.js',
        'services/adaptiveTutor/stateBenchmarkExactObserver.js',
        'services/adaptiveTutor/tutorStubStateAdapter.js',
      ]),
      analyzer: aggregateFileHash([
        'services/adaptiveTutor/stateBenchmarkStage0Analysis.js',
        'services/adaptiveTutor/stateBenchmarkCanonicalPilot.js',
        path.relative(ROOT, FILTER_MODULE),
      ]),
      policy: aggregateFileHash(
        config.critical_path.latent_generators.flatMap(
          (row) => adaptiveStateLearnerKernel(row.id).metadata.source_files,
        ),
      ),
      profile: hashCanonicalJson(config.complexity_cap),
      prompt: hashFile(path.join(ROOT, 'services', 'adaptiveTutor', 'stateBenchmarkDeterministicRealizer.js')),
      world: aggregateFileHash(config.critical_path.worlds.map((row) => row.source)),
      config: hashFile(configPath),
      instrument: hashFile(instrumentConfigPath),
    },
    masterSeed: label,
    jobs: generation.jobs,
    lineage: { parentRunId: null, resumeOf: null, supersedes: [] },
    intent: {
      protocol: 'PLAN_4_0/2026-07-13-adaptive-state-decomposition-and-voi-protocol-v2.4.md (Part 1b, B2)',
      claimBoundary:
        'Directional zero-call info-optimal schedule arm. It cannot rescue or reinterpret any stopped row, name a sensor winner, open policy optimization, authorize S2 or Phase 6B, or ground any efficacy or human-learning claim.',
      executionBoundary: 'Zero model calls. Deterministic renderers and exact kernel enumeration only.',
      fixedScheduleArmRunId: s0Archive.run_id,
    },
    metadata: {
      stage: 'v24_voi_schedule',
      paid: false,
      expectedModelCalls: 0,
      benchmarkSchema: config.schema,
      benchmarkVersion: config.version,
      instrumentVersion: '2.4',
      labelPrefixContract: 'adaptive-state-v24-',
      actionChoice: 'greedy_expected_entropy_reduction_ties_to_fixed_schedule',
    },
  });
  createRunPlan(runDir, plan);
  appendRunEvent(runDir, {
    type: 'voi_generation_started',
    dialogueJobs: generation.jobs.length,
    scoredTransitions: generation.dataset.rows.length,
    expectedModelCalls: 0,
  });
  const dialoguesFile = writeExclusive(path.join(runDir, 'dialogues.jsonl'), jsonl(generation.dataset.dialogues));
  const rowsFile = writeExclusive(path.join(runDir, 'benchmark-rows.jsonl'), jsonl(generation.dataset.rows));
  const traceFile = writeExclusive(
    path.join(runDir, 'voi-schedule-trace.json'),
    canonicalJson(
      {
        schema: 'machinespirits.adaptive-state-voi-schedule-trace.v2.4',
        label,
        action_choice: generation.dataset.action_choice,
        fallback_count: generation.fallbacks.length,
        fallbacks: generation.fallbacks,
        dialogues: generation.dataset.dialogues.map((dialogue) => ({
          id: dialogue.id,
          latent_pair_id: dialogue.latent_pair_id,
          seed: dialogue.seed,
          fixed_action_schedule: dialogue.fixed_action_schedule,
          action_schedule: dialogue.action_schedule,
          action_choice: dialogue.action_choice,
          entropy: dialogue.entropy,
        })),
      },
      { space: 2, trailingNewline: true },
    ),
  );
  writeExclusive(
    path.join(runDir, 'replay.json'),
    canonicalJson(
      {
        schema: 'machinespirits.adaptive-state-voi-replay.v2.4',
        passed: replayPassed,
        dataset_content_sha256: generation.dataset.content_sha256,
      },
      { space: 2, trailingNewline: true },
    ),
  );
  const manifest = {
    schema: 'machinespirits.adaptive-state-voi-dataset-manifest.v2.4',
    version: '2.4',
    stage: 'v24_voi_schedule',
    label,
    confirmation_eligible: false,
    dataset_schema: generation.dataset.schema,
    dataset_content_sha256: generation.dataset.content_sha256,
    dialogues: generation.dataset.dialogues.length,
    scored_transitions: generation.dataset.rows.length,
    model_calls: 0,
    deterministic_realizer_calls: generation.dataset.deterministic_realizer_call_count,
    fallback_count: generation.fallbacks.length,
    files: {
      dialogues_jsonl: { path: 'dialogues.jsonl', sha256: dialoguesFile.sha256, bytes: dialoguesFile.bytes },
      benchmark_rows_jsonl: { path: 'benchmark-rows.jsonl', sha256: rowsFile.sha256, bytes: rowsFile.bytes },
      voi_schedule_trace: { path: 'voi-schedule-trace.json', sha256: traceFile.sha256, bytes: traceFile.bytes },
    },
  };
  writeExclusive(
    path.join(runDir, 'dataset-manifest.json'),
    canonicalJson(manifest, { space: 2, trailingNewline: true }),
  );
  appendRunEvent(runDir, {
    type: 'voi_generation_completed',
    datasetSha256: generation.dataset.content_sha256,
    replayPassed,
    fallbackCount: generation.fallbacks.length,
    executedModelCalls: 0,
  });
  createRunSeal(runDir, {
    status: 'complete',
    metadata: {
      stage: 'v24_voi_schedule',
      datasetSha256: generation.dataset.content_sha256,
      fallbackCount: generation.fallbacks.length,
      executedModelCalls: 0,
    },
  });
  const verified = assertExperimentRun(runDir);
  return { plan, manifest, verified, sealSha256: sha256(fs.readFileSync(path.join(runDir, 'run-seal.json'))) };
}

// ---------------------------------------------------------------------------------------------
// B3/B4 — heads, baselines, and paired-contrast machinery (pilot helpers reused).
// ---------------------------------------------------------------------------------------------

function worldTransferFolds(rows) {
  const levels = stable(new Set(rows.map((row) => String(row.groups.world_id))));
  return levels.map((level) => ({
    id: `world_transfer=${level}`,
    level,
    train_ids: rows.filter((row) => String(row.groups.world_id) !== level).map((row) => row.id),
    test_ids: rows.filter((row) => String(row.groups.world_id) === level).map((row) => row.id),
  }));
}

function headOptionsFor(baseConfig, { representation, target }) {
  const contract = baseConfig.analysis.fixed_head_contract;
  return {
    representation,
    target,
    labels: TARGET_LABELS[target],
    lambda: contract.regularization.lambda,
    regularizationScaling: contract.regularization.scaling,
    learningRate: contract.solver.learning_rate,
    maximumIterations: contract.solver.maximum_iterations,
    convergenceTolerance: contract.solver.convergence_tolerance,
    convergenceCriterion: contract.solver.convergence_criterion,
    probabilityClip: contract.probability_clip,
  };
}

function fitFoldedPredictions({ folds, byId, baseConfig, representation, target }) {
  const models = [];
  const predictions = new Map();
  for (const fold of folds) {
    const training = fold.train_ids.map((id) => byId.get(id));
    const testing = fold.test_ids.map((id) => byId.get(id));
    if (training.some((row) => !row) || testing.some((row) => !row)) {
      throw new Error(`voi study: fold ${fold.id} references an unknown row`);
    }
    const model = fitAdaptiveStateStage0Head(training, headOptionsFor(baseConfig, { representation, target }));
    models.push({
      fold: fold.id,
      level: fold.level,
      converged: model.converged,
      iterations: model.iterations,
      features: model.encoder.featureNames.length,
    });
    for (const prediction of predictAdaptiveStateStage0Head(model, testing)) predictions.set(prediction.id, prediction);
  }
  if (predictions.size !== byId.size) {
    throw new Error('voi study: leave-one-world-out folds did not predict every row exactly once');
  }
  return { models, predictions };
}

function scheduleOnlyRows(rows) {
  return rows.map((row) => ({
    id: row.id,
    turn: Number(row.turn),
    action: clone(row.action),
    groups: clone(row.groups),
    targets: clone(row.targets),
    representations: {
      schedule_only: { schedule: { turn_index: Number(row.turn), world_id: String(row.groups.world_id) } },
    },
  }));
}

function comparisonBlock({ scopeRows, candidateById, baselineById, labels, bootstrap, material }) {
  const deltasByCluster = { log_loss: new Map(), brier_score: new Map() };
  for (const row of scopeRows) {
    const candidate = candidateById.get(row.id);
    const baseline = baselineById.get(row.id);
    if (!candidate || !baseline) throw new Error(`voi study: missing paired prediction for ${row.id}`);
    const candidateLosses = predictionLosses(candidate, labels);
    const baselineLosses = predictionLosses(baseline, labels);
    for (const metric of ['log_loss', 'brier_score']) {
      const values = deltasByCluster[metric].get(row.groups.latent_pair_id) || [];
      values.push(baselineLosses[metric] - candidateLosses[metric]);
      deltasByCluster[metric].set(row.groups.latent_pair_id, values);
    }
  }
  const metrics = {};
  for (const metric of ['log_loss', 'brier_score']) {
    metrics[metric] = bootstrapMetric(deltasByCluster[metric], {
      iterations: bootstrap.resamples,
      seed: bootstrap.seed,
      confidenceLevel: CONFIDENCE_LEVEL,
      material: `${material}|${metric}`,
    });
  }
  return {
    groups: new Set(scopeRows.map((row) => row.groups.latent_pair_id)).size,
    predictions: scopeRows.length,
    metrics,
  };
}

function pointDeltas({ scopeRows, candidateById, baselineById, labels }) {
  const totals = { log_loss: 0, brier_score: 0 };
  for (const row of scopeRows) {
    const candidateLosses = predictionLosses(candidateById.get(row.id), labels);
    const baselineLosses = predictionLosses(baselineById.get(row.id), labels);
    totals.log_loss += baselineLosses.log_loss - candidateLosses.log_loss;
    totals.brier_score += baselineLosses.brier_score - candidateLosses.brier_score;
  }
  return {
    log_loss: totals.log_loss / scopeRows.length,
    brier_score: totals.brier_score / scopeRows.length,
    predictions: scopeRows.length,
  };
}

function oraclePredictionsById(rows, target) {
  return new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        truth: String(row.targets[target]),
        probabilities: clone(row.representations.oracle.additional_state.distributions[target]),
      },
    ]),
  );
}

function absoluteMetrics(rows, byId, labels) {
  return adaptiveStateStage0PredictionMetrics(
    rows.map((row) => byId.get(row.id)),
    labels,
  );
}

function maxProbabilityDelta(mineById, otherById, labels) {
  let maximum = 0;
  for (const [id, mine] of mineById) {
    const other = otherById.get(id);
    if (!other) throw new Error(`voi study: paired predictions missing row ${id}`);
    for (const label of labels) {
      maximum = Math.max(maximum, Math.abs(Number(mine.probabilities[label]) - Number(other.probabilities[label])));
    }
  }
  return maximum;
}

/** Compute the full B3 read for one arm: filter posterior vs the arm's own baselines. */
function armChannelCapacityRead({
  armId,
  rows,
  folds,
  splitManifestForBaselines,
  baseConfig,
  filterPredictionsByTarget,
  bootstrap,
  pilotNoStateByTarget = null,
}) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const scheduleById = new Map(scheduleOnlyRows(rows).map((row) => [row.id, row]));
  const read = { arm: armId, targets: {}, oracle_instrument: {}, models: [] };
  let oraclePasses = true;
  for (const target of TARGETS) {
    const labels = TARGET_LABELS[target];
    const filterById = filterPredictionsByTarget[target];
    let noStateById;
    let noStateReuseDelta = null;
    if (pilotNoStateByTarget) {
      noStateById = pilotNoStateByTarget[target];
      const refit = fitFoldedPredictions({ folds, byId, baseConfig, representation: 'no_state', target });
      read.models.push(...refit.models.map((model) => ({ arm: armId, target, representation: 'no_state', ...model })));
      noStateReuseDelta = maxProbabilityDelta(refit.predictions, noStateById, labels);
      if (noStateReuseDelta > REUSE_MAX_PROBABILITY_DELTA) {
        throw new Error(`voi study: ${armId} no_state refit does not reproduce the sealed pilot predictions`);
      }
    } else {
      const refit = fitFoldedPredictions({ folds, byId, baseConfig, representation: 'no_state', target });
      read.models.push(...refit.models.map((model) => ({ arm: armId, target, representation: 'no_state', ...model })));
      noStateById = refit.predictions;
    }
    const scheduleFit = fitFoldedPredictions({
      folds,
      byId: scheduleById,
      baseConfig,
      representation: 'schedule_only',
      target,
    });
    read.models.push(
      ...scheduleFit.models.map((model) => ({ arm: armId, target, representation: 'schedule_only', ...model })),
    );
    const stateBlind = buildAdaptiveStateOutOfFoldStateBlindBaselines(rows, splitManifestForBaselines, {
      laneId: 'world_transfer',
      target,
      labels,
      contract: baseConfig.analysis.state_blind_baseline_contract,
    });
    const classPriorById = new Map(stateBlind.class_prior.predictions.map((row) => [row.id, row]));
    const uniformById = new Map(
      predictAdaptiveStateUniformBaseline(rows, {
        target,
        labels,
        contract: baseConfig.analysis.state_blind_baseline_contract,
      }).map((row) => [row.id, row]),
    );
    const oracleById = oraclePredictionsById(rows, target);
    const filterOracleAgreement = maxProbabilityDelta(filterById, oracleById, labels);
    const absolute = {
      filter_posterior: absoluteMetrics(rows, filterById, labels),
      oracle: absoluteMetrics(rows, oracleById, labels),
      no_state: absoluteMetrics(rows, noStateById, labels),
      class_prior: absoluteMetrics(rows, classPriorById, labels),
      schedule_only: absoluteMetrics(rows, scheduleFit.predictions, labels),
      uniform: absoluteMetrics(rows, uniformById, labels),
    };
    const contrasts = {
      filter_vs_no_state: comparisonBlock({
        scopeRows: rows,
        candidateById: filterById,
        baselineById: noStateById,
        labels,
        bootstrap,
        material: `1b|b3|${armId}|filter|vs=no_state|${target}|pooled`,
      }),
      filter_vs_class_prior: comparisonBlock({
        scopeRows: rows,
        candidateById: filterById,
        baselineById: classPriorById,
        labels,
        bootstrap,
        material: `1b|b3|${armId}|filter|vs=class_prior|${target}|pooled`,
      }),
      filter_vs_schedule_only: comparisonBlock({
        scopeRows: rows,
        candidateById: filterById,
        baselineById: scheduleFit.predictions,
        labels,
        bootstrap,
        material: `1b|b3|${armId}|filter|vs=schedule_only|${target}|pooled`,
      }),
    };
    const perWorld = {};
    for (const world of stable(new Set(rows.map((row) => row.groups.world_id)))) {
      perWorld[world] = pointDeltas({
        scopeRows: rows.filter((row) => row.groups.world_id === world),
        candidateById: filterById,
        baselineById: noStateById,
        labels,
      });
    }
    const oracleBeats = {};
    for (const [baselineId, baselineById] of [
      ['no_state', noStateById],
      ['class_prior', classPriorById],
      ['uniform', uniformById],
    ]) {
      const deltas = pointDeltas({ scopeRows: rows, candidateById: oracleById, baselineById, labels });
      oracleBeats[baselineId] = deltas.log_loss > 0 && deltas.brier_score > 0;
    }
    const targetOraclePasses = Object.values(oracleBeats).every(Boolean);
    oraclePasses &&= targetOraclePasses;
    read.oracle_instrument[target] = {
      oracle_beats_each_state_blind_baseline_on_both_metrics: oracleBeats,
      passed: targetOraclePasses,
    };
    read.targets[target] = {
      absolute,
      contrasts,
      per_world_filter_vs_no_state_point_deltas: perWorld,
      filter_oracle_max_probability_delta: filterOracleAgreement,
      no_state_reuse_max_probability_delta: noStateReuseDelta,
    };
  }
  read.oracle_passes = oraclePasses;
  return read;
}

// ---------------------------------------------------------------------------------------------
// Report rendering.
// ---------------------------------------------------------------------------------------------

function fmt(value, digits = 4) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : 'n/a';
}

function metricCell(block, metric) {
  const row = block.metrics[metric];
  return `${fmt(row.point_delta)} [${fmt(row.confidence_interval.lower)}, ${fmt(row.confidence_interval.upper)}]`;
}

function renderMarkdown(report) {
  const { worlds, generators, actions } = report.coverage;
  const lines = [
    '# Adaptive-state v2.4 Part 1b — active-sensing value-of-information study',
    '',
    `Verdict: **\`${report.verdict.token}\`** (matched clause: \`${report.verdict.matched_clause}\`)`,
    '',
    `> ${report.claim_boundary}`,
    '',
    'Zero model calls. Directional only: nothing in this report rescues, reinterprets, excludes, or promotes any',
    'row of any stopped run; `winner: null` and `do_not_optimize_policy` remain operative; S2 remains prohibited.',
    'A `graduate` verdict would change what may be designed, never what may be run.',
    '',
    '## Provenance',
    '',
    `- Fixed-schedule arm: \`${report.provenance.restored_archives.s0.run_id}\` (archive sha256 \`${report.provenance.restored_archives.s0.archive_sha256}\`), checksum-verified restore`,
    `- Pilot comparator: \`${report.provenance.restored_archives.pilot.run_id}\` (archive sha256 \`${report.provenance.restored_archives.pilot.archive_sha256}\`), checksum-verified restore; read only, never re-scored`,
    `- Part 1a report: \`${report.provenance.part_1a_report.path}\` (content sha256 \`${report.provenance.part_1a_report.content_sha256}\`), classification \`${report.provenance.part_1a_report.classification_label}\` — the frozen sequencing rule (1a before any 1b inspection) is satisfied`,
    `- Info-optimal arm: \`${report.provenance.voi_run.label}\` sealed at \`${report.provenance.voi_run.run_dir}\` (dataset sha256 \`${report.provenance.voi_run.dataset_content_sha256}\`, seal sha256 \`${report.provenance.voi_run.seal_sha256}\`)`,
    `- Git commit: \`${report.provenance.git.sha}\`${report.provenance.git.dirty ? ' (dirty worktree)' : ''}`,
    `- Model calls: ${report.model_calls}`,
    '',
    '## Verdict clauses (frozen rule, applied as written)',
    '',
    `- graduate_active_sensing_to_paid: ${report.verdict.clauses.graduate.passed ? 'MATCHED' : 'not matched'} — VOI arm passes margins: ${report.verdict.clauses.graduate.voi_arm_passes_margins}; fixed arm passes margins: ${report.verdict.clauses.graduate.fixed_arm_passes_margins}; scheduling flips capacity verdict: ${report.verdict.clauses.graduate.scheduling_flips_capacity_verdict}; B1 action-information floor (>= ${report.verdict.margins.action_information_floor_bits} bits in >= ${report.verdict.margins.action_information_world_floor} worlds per kernel): ${report.verdict.clauses.graduate.action_information_floor.passed}`,
    `- close_sensor_program_on_substrate: ${report.verdict.clauses.close.passed ? 'MATCHED' : 'not matched'} — VOI-arm entropy reduction at horizon ${fmt(report.verdict.clauses.close.entropy.mean_reduction_bits)} bits vs floor ${report.verdict.clauses.close.entropy.floor_bits} (clause ${report.verdict.clauses.close.entropy.passed ? 'fires' : 'does not fire'}); B3-fails-on-both-arms-while-oracle-passes: ${report.verdict.clauses.close.b3_failure.passed}`,
    `- inconclusive_data_starved: ${report.verdict.clauses.inconclusive.passed ? 'MATCHED' : 'not matched'} — 1a label \`${report.verdict.clauses.inconclusive.part_1a_label}\`; all B3 contrast CIs span both cut lines: ${report.verdict.clauses.inconclusive.all_b3_contrast_cis_span_cut_lines}`,
    ...report.verdict.notes.map((note) => `- note: ${note}`),
    '',
    '## B1 — per-action information gain along the sealed S0 trajectories (bits)',
    '',
    'Expected one-step posterior-entropy reduction over latent state, exact filter, per kernel-supported action,',
    'summarized over the scored transitions of each world x kernel (12 unique latent trajectories, 72 transitions;',
    'realizer pairs share latent trajectories and are deduplicated).',
    '',
    '| World | Kernel | Action | Max gain | Median gain | Transitions >= floor |',
    '|---|---|---|---:|---:|---:|',
  ];
  for (const world of worlds) {
    for (const generator of generators) {
      for (const action of actions) {
        const summary = report.b1_information_gain.summary[world]?.[generator]?.[action];
        if (!summary) continue;
        lines.push(
          `| ${world} | ${generator} | ${action} | ${fmt(summary.max_gain_bits)} | ${fmt(summary.median_gain_bits)} | ${summary.transitions_at_or_above_floor}/${summary.transitions} |`,
        );
      }
    }
  }
  lines.push(
    '',
    '## B2 — info-optimal schedule arm',
    '',
    `- Label: \`${report.b2_voi_arm.label}\`; ${report.b2_voi_arm.dialogues} dialogues, ${report.b2_voi_arm.scored_transitions} scored transitions, ${report.b2_voi_arm.deterministic_realizer_calls} deterministic realizer calls, 0 model calls`,
    `- Greedy action basis counts: ${Object.entries(report.b2_voi_arm.action_basis_counts)
      .map(([basis, count]) => `${basis}=${count}`)
      .join(', ')}`,
    `- Fallback-to-fixed-schedule events (adapter could not legally produce the greedy pick): ${report.b2_voi_arm.fallback_count}`,
    `- Deterministic replay: ${report.b2_voi_arm.replay_passed ? 'pass' : 'fail'}`,
    '',
    '| World | Kernel | Realized greedy schedules (per repetition) |',
    '|---|---|---|',
  );
  for (const world of worlds) {
    for (const generator of generators) {
      const schedules = report.b2_voi_arm.schedules_by_cell[`${world}__${generator}`] || [];
      lines.push(
        `| ${world} | ${generator} | ${schedules.map((row) => `r${row.repetition}: ${row.schedule.join(' > ')}`).join('<br>')} |`,
      );
    }
  }
  lines.push('', '## B3 — channel-capacity read per schedule (filter posterior as predictor)', '');
  for (const armId of ['fixed', 'voi']) {
    const arm = report.b3_channel_capacity[armId];
    lines.push(
      `### ${armId === 'fixed' ? 'Fixed-schedule arm (sealed S0)' : 'Info-optimal arm (VOI)'}`,
      '',
      '| Predictor | Target | Log-loss | Brier | ECE |',
      '|---|---|---:|---:|---:|',
    );
    for (const target of TARGETS) {
      for (const predictor of ['uniform', 'class_prior', 'schedule_only', 'no_state', 'filter_posterior', 'oracle']) {
        const row = arm.targets[target].absolute[predictor];
        lines.push(`| ${predictor} | ${target} | ${fmt(row.log_loss)} | ${fmt(row.brier_score)} | ${fmt(row.ece)} |`);
      }
    }
    lines.push('', '| Contrast | Target | Log-loss delta [95% CI] | Brier delta [95% CI] |', '|---|---|---:|---:|');
    for (const target of TARGETS) {
      for (const [label, key] of [
        ['filter vs no_state (verdict-binding)', 'filter_vs_no_state'],
        ['filter vs class_prior (descriptive)', 'filter_vs_class_prior'],
        ['filter vs schedule_only (descriptive)', 'filter_vs_schedule_only'],
      ]) {
        const block = arm.targets[target].contrasts[key];
        lines.push(`| ${label} | ${target} | ${metricCell(block, 'log_loss')} | ${metricCell(block, 'brier_score')} |`);
      }
    }
    lines.push(
      '',
      `- Filter posterior vs kernel oracle agreement: max |dp| = ${Math.max(
        ...TARGETS.map((target) => arm.targets[target].filter_oracle_max_probability_delta),
      ).toExponential(2)} (the exact filter tracks the true latent state on this arm)`,
      `- Oracle instrument (beats no_state, class prior, uniform on both metrics): ${arm.oracle_passes ? 'pass' : 'fail'}`,
      '',
    );
  }
  lines.push(
    '### Arm contrast (descriptive, unpaired: VOI minus fixed, filter-vs-no_state point deltas)',
    '',
    '| Target | Log-loss delta difference | Brier delta difference |',
    '|---|---:|---:|',
  );
  for (const target of TARGETS) {
    const row = report.b3_channel_capacity.arm_contrast[target];
    lines.push(`| ${target} | ${fmt(row.log_loss)} | ${fmt(row.brier_score)} |`);
  }
  lines.push(
    '',
    '## B4 — lean_dag estimator refit on the VOI arm (1x penalty, leave-one-world-out)',
    '',
    '| Arm | Target | lean_dag vs no_state log-loss delta [95% CI] | Brier delta [95% CI] |',
    '|---|---|---:|---:|',
  );
  for (const target of TARGETS) {
    const sealed = report.b4_estimator_read.fixed_arm_sealed_pilot[target];
    lines.push(
      `| fixed (sealed pilot) | ${target} | ${fmt(sealed.log_loss.point_delta)} [${fmt(sealed.log_loss.confidence_interval.lower)}, ${fmt(sealed.log_loss.confidence_interval.upper)}] | ${fmt(sealed.brier_score.point_delta)} [${fmt(sealed.brier_score.confidence_interval.lower)}, ${fmt(sealed.brier_score.confidence_interval.upper)}] |`,
    );
    const voi = report.b4_estimator_read.voi_arm[target].pooled;
    lines.push(`| voi (refit) | ${target} | ${metricCell(voi, 'log_loss')} | ${metricCell(voi, 'brier_score')} |`);
  }
  lines.push(
    '',
    `Scheduling alone rescues the lean estimator (voi lean_dag beats voi no_state by >= ${report.verdict.margins.log_loss_nats} nats and >= ${report.verdict.margins.brier} Brier on both targets): **${report.b4_estimator_read.scheduling_rescues_lean_estimator}**`,
    '',
    '## B5 — info/pedagogy trade-off (descriptive proof-progress trajectories)',
    '',
    '| Arm | World | Kernel | Start distance | Final distance (mean) | Final harmful debt (mean) | Advance/regress/stall counts |',
    '|---|---|---|---:|---:|---:|---|',
  );
  for (const armId of ['fixed', 'voi']) {
    for (const world of worlds) {
      for (const generator of generators) {
        const row = report.b5_info_pedagogy[armId]?.[world]?.[generator];
        if (!row) continue;
        lines.push(
          `| ${armId} | ${world} | ${generator} | ${fmt(row.start_raw_distance, 2)} | ${fmt(row.final_raw_distance_mean, 2)} | ${fmt(row.final_harmful_debt_mean, 2)} | ${row.trajectory_counts.advance}/${row.trajectory_counts.regress}/${row.trajectory_counts.stall} |`,
        );
      }
    }
  }
  lines.push(
    '',
    '## Latent-state entropy at horizon (bits)',
    '',
    '| Arm | Mean prior-only at horizon | Mean posterior at horizon | Mean reduction | Min reduction | Max reduction |',
    '|---|---:|---:|---:|---:|---:|',
  );
  for (const armId of ['fixed', 'voi']) {
    const row = report.entropy[armId];
    lines.push(
      `| ${armId} | ${fmt(row.mean_prior_bits_at_horizon)} | ${fmt(row.mean_posterior_bits_at_horizon)} | ${fmt(row.mean_reduction_bits)} | ${fmt(row.min_reduction_bits)} | ${fmt(row.max_reduction_bits)} |`,
    );
  }
  lines.push('', '## Reading', '', report.reading, '', `Report content SHA-256: \`${report.content_sha256}\``, '');
  return lines.join('\n');
}

function buildReading({ verdict, b3, b1Summary, entropy, b4Rescued, part1aLabel }) {
  const sentences = [];
  const fixedDeltas = TARGETS.map(
    (target) => b3.fixed.targets[target].contrasts.filter_vs_no_state.metrics.log_loss.point_delta,
  );
  const voiDeltas = TARGETS.map(
    (target) => b3.voi.targets[target].contrasts.filter_vs_no_state.metrics.log_loss.point_delta,
  );
  const voiPasses = verdict.clauses.graduate.voi_arm_passes_margins;
  const fixedPasses = verdict.clauses.graduate.fixed_arm_passes_margins;
  const bothReduce =
    entropy.voi.mean_reduction_bits >= verdict.margins.entropy_reduction_floor_bits_at_horizon &&
    entropy.fixed.mean_reduction_bits >= verdict.margins.entropy_reduction_floor_bits_at_horizon;
  sentences.push(
    `The exact dynamics-aware filter reproduces the kernel oracle on both arms (fixed-point check passed at every scored transition), and as a predictor its edge over each arm's own no_state baseline is ${fixedDeltas.map((value) => fmt(value)).join('/')} pooled log-loss nats on the fixed schedule and ${voiDeltas.map((value) => fmt(value)).join('/')} on the info-optimal schedule (targets ${TARGETS.join(' / ')}).`,
  );
  sentences.push(
    bothReduce
      ? `The public channel is not the bottleneck under either schedule: with kernel dynamics and the per-dialogue seed, the terminal posterior over latent state sits at ${fmt(entropy.voi.mean_posterior_bits_at_horizon)} bits on the VOI arm against a predict-only prior of ${fmt(entropy.voi.mean_prior_bits_at_horizon)} bits at horizon (${fmt(entropy.voi.mean_reduction_bits)} bits of reduction; fixed arm ${fmt(entropy.fixed.mean_reduction_bits)} bits).`
      : `The public channel resolves little of the latent state: terminal posterior ${fmt(entropy.voi.mean_posterior_bits_at_horizon)} bits on the VOI arm against a predict-only prior of ${fmt(entropy.voi.mean_prior_bits_at_horizon)} bits at horizon (${fmt(entropy.voi.mean_reduction_bits)} bits of reduction; fixed arm ${fmt(entropy.fixed.mean_reduction_bits)} bits).`,
  );
  const capacityClause =
    voiPasses && fixedPasses
      ? "greedy info-optimal scheduling does not change the capacity verdict: both arms clear the frozen margins, so the graduate clause's flip condition fails"
      : voiPasses && !fixedPasses
        ? 'the info-optimal arm clears the frozen margins where the fixed arm does not'
        : !voiPasses && fixedPasses
          ? 'the fixed arm clears the frozen margins but the info-optimal arm does not'
          : 'neither arm clears the frozen margins';
  sentences.push(
    `Action choice does control how much uncertainty each turn generates (B1 max per-action gains reach ${fmt(b1Summary.max_gain_bits)} bits, median ${fmt(b1Summary.median_gain_bits)}), and ${capacityClause}.`,
  );
  sentences.push(
    b4Rescued
      ? 'Scheduling alone does rescue the lean estimator on the VOI arm (B4), so the estimator-side failure is schedule-sensitive.'
      : `Scheduling alone does not rescue the lean estimator: refit at the pilot's own penalty on the VOI arm, lean_dag still fails its margins against the arm's no_state (B4), consistent with Part 1a's \`${part1aLabel}\` label — the v2.3 stop was estimator data-starvation, not channel concealment or schedule choice.`,
  );
  sentences.push(
    verdict.matched_clause === 'none_matched_conservative_default'
      ? `No frozen clause matched literally (the rule does not name the measured configuration); the verdict defaults conservatively against further sensor spend to close_sensor_program_on_substrate.${
          voiPasses && fixedPasses && bothReduce
            ? ' The boundary finding to report is transparency, not concealment: a dynamics-aware reader already extracts the full latent signal under the fixed schedule, so no schedule change adds channel capacity on this substrate — the remaining gap is estimator-side (1a label above).'
            : ' Read the clause numbers above for the boundary finding.'
        }`
      : `The frozen rule resolves to ${verdict.token} via the ${verdict.matched_clause} clause.`,
  );
  return sentences.join(' ');
}

function usage() {
  return `Usage: node scripts/run-adaptive-state-voi-v24.js --s0-run DIR --pilot-run DIR [options]

Part 1b (active-sensing VOI study) of the frozen v2.4 contract. Zero model calls.
Reads ONLY checksum-verified restores of the sealed v2.3 archives (restore with
scripts/restore-adaptive-run.js, verify with scripts/verify-experiment-run.js), requires the
Part 1a report to already exist (frozen sequencing), generates and seals the
adaptive-state-v24-voi-schedule arm, and writes exports/adaptive-state-v24/voi-study-report.{json,md}.

Options:
  --s0-run <dir>             Restored sealed S0 exact-channel run (required)
  --pilot-run <dir>          Restored sealed canonical-pilot run (required)
  --out <dir>                Reports + sealed VOI run root. Default: exports/adaptive-state-v24
  --label <id>               VOI arm run label. Default: adaptive-state-v24-voi-schedule
  --base-config <path>       Default: config/adaptive-state-benchmark-v2.yaml
  --instrument-config <path> Default: config/adaptive-state-instrument-v2.4.yaml
  --help                     Show this help
`;
}

function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      's0-run': { type: 'string' },
      'pilot-run': { type: 'string' },
      out: { type: 'string', default: path.join(ROOT, 'exports', 'adaptive-state-v24') },
      label: { type: 'string', default: 'adaptive-state-v24-voi-schedule' },
      'base-config': { type: 'string', default: path.join(ROOT, 'config', 'adaptive-state-benchmark-v2.yaml') },
      'instrument-config': {
        type: 'string',
        default: path.join(ROOT, 'config', 'adaptive-state-instrument-v2.4.yaml'),
      },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help || !values['s0-run'] || !values['pilot-run']) {
    process.stdout.write(usage());
    if (!values.help) process.exitCode = 1;
    return;
  }
  const s0RunDir = path.resolve(values['s0-run']);
  const pilotRunDir = path.resolve(values['pilot-run']);
  const looseRoot = path.join(ROOT, 'exports', 'adaptive-state-benchmark-v2');
  for (const dir of [s0RunDir, pilotRunDir]) {
    if (!path.relative(looseRoot, dir).startsWith('..')) {
      throw new Error(`voi study: ${dir} is the loose worktree copy; analyses must read a checksum-verified restore`);
    }
  }
  const label = String(values.label);
  const instrumentConfigPath = path.resolve(values['instrument-config']);
  const baseConfigPath = path.resolve(values['base-config']);
  const instrumentConfig = yaml.parse(fs.readFileSync(instrumentConfigPath, 'utf8'));
  const contract = assertAdaptiveStateV24VoiContract(instrumentConfig);
  if (!label.startsWith(contract.label_prefix)) {
    throw new Error(`voi study: run label must carry the frozen prefix ${contract.label_prefix}`);
  }
  const baseConfig = yaml.parse(fs.readFileSync(baseConfigPath, 'utf8'));
  const bootstrap = contract.bootstrap;
  const margins = contract.part_1b.margins;

  const outDir = path.resolve(values.out);
  const voiRunDir = path.join(outDir, label);
  if (fs.existsSync(voiRunDir)) {
    throw new Error(`voi study: run label directory already exists (never reuse a run label): ${voiRunDir}`);
  }

  // Frozen sequencing: Part 1a's report must be written before any Part 1b result is computed.
  const part1aPath = path.join(outDir, 'decomposition-audit-report.json');
  if (!fs.existsSync(part1aPath)) {
    throw new Error('voi study: Part 1a report is missing — the frozen sequencing rule forbids running 1b first');
  }
  const part1aReport = readJson(part1aPath);
  const part1aContent = { ...part1aReport };
  delete part1aContent.content_sha256;
  if (part1aReport.content_sha256 !== hashCanonicalJson(part1aContent)) {
    throw new Error('voi study: Part 1a report content SHA-256 mismatch');
  }
  const part1aLabel = part1aReport.classification?.label;
  if (!['data_starved', 'world_confounded', 'representation_carries_nothing'].includes(part1aLabel)) {
    throw new Error('voi study: Part 1a report carries no frozen classification label');
  }

  const archives = {
    s0: verifyRestoredArchive({
      runDir: s0RunDir,
      manifestPath: path.resolve(ROOT, instrumentConfig.data_provenance.fixed_schedule_arm.manifest),
      role: 'S0',
    }),
    pilot: verifyRestoredArchive({
      runDir: pilotRunDir,
      manifestPath: path.resolve(ROOT, instrumentConfig.data_provenance.pilot_comparator.manifest),
      role: 'pilot',
    }),
  };
  process.stderr.write(`verified restored archives: ${archives.s0.run_id}, ${archives.pilot.run_id}\n`);

  const dataset = loadAdaptiveStateStage0Dataset(s0RunDir);
  if (dataset.model_call_count !== 0) throw new Error('voi study: S0 dataset reports nonzero model calls');
  const splitManifest = readJson(path.join(s0RunDir, 'split-manifest.json'));
  validateAdaptiveStateStage0SplitManifestContentSha256(splitManifest);
  const s0Report = readJson(path.join(s0RunDir, 'stage0-contract-report.json'));
  validateAdaptiveStateStage0ReportContentSha256(s0Report);
  if (s0Report.status !== 'pass' || s0Report.provenance.dataset_sha256 !== dataset.content_sha256) {
    throw new Error('voi study: restored S0 report is not the sealed pass over this dataset');
  }
  const pilotPredictions = readJson(path.join(pilotRunDir, 'canonical-pilot-predictions.json'));
  validateAdaptiveStateCanonicalPilotPredictions(pilotPredictions);
  const pilotReport = readJson(path.join(pilotRunDir, 'canonical-pilot-report.json'));
  validateAdaptiveStateCanonicalPilotReport(pilotReport);
  if (pilotReport.decision !== 'do_not_run_canonical_s2') {
    throw new Error('voi study: restored pilot is not the sealed v2.3 stop');
  }
  if (pilotReport.provenance.parent_dataset_sha256 !== dataset.content_sha256) {
    throw new Error('voi study: pilot comparator was not fit on the restored S0 dataset');
  }

  const adapters = new Map(
    loadAdaptiveStateWorldAdapters(baseConfig.critical_path.worlds, { repoRoot: ROOT }).map((adapter) => [
      adapter.id,
      adapter,
    ]),
  );
  const worlds = new Map(
    baseConfig.critical_path.worlds.map((row) => [row.id, loadWorld(path.resolve(ROOT, row.source))]),
  );
  const worldIds = stable(new Set(dataset.rows.map((row) => row.groups.world_id)));
  const generatorIds = stable(new Set(dataset.rows.map((row) => row.groups.generator_id)));

  // -------------------------------------------------------------------------------------------
  // B1 — exact filter along the sealed S0 trajectories (replay-verified), all action families.
  // -------------------------------------------------------------------------------------------
  process.stderr.write('B1: running the exact filter along the sealed S0 trajectories\n');
  const b1Table = [];
  const fixedFilterByTarget = Object.fromEntries(TARGETS.map((target) => [target, new Map()]));
  const fixedEntropyByPair = new Map();
  const fixedTrajectoriesByPair = new Map();
  for (const dialogue of dataset.dialogues) {
    const adapter = adapters.get(dialogue.world_id);
    const kernel = adaptiveStateLearnerKernel(dialogue.generator_id);
    const trajectory = runFilterAlongTrajectory({
      kernel,
      adapter,
      seed: dialogue.seed,
      scoredTransitions: dialogue.scored_transitions,
      pickAction: ({ index }) => ({ action: dialogue.action_schedule[index], basis: 'sealed_schedule' }),
      seal: dialogue,
    });
    for (const [index, step] of trajectory.steps.entries()) {
      const rowId = `${dialogue.id}__predict_t${index + 1}`;
      for (const target of TARGETS) {
        fixedFilterByTarget[target].set(rowId, {
          id: rowId,
          truth: String(step.transition.targets[target]),
          probabilities: clone(step.filter_target_distributions[target]),
        });
      }
    }
    const existing = fixedTrajectoriesByPair.get(dialogue.latent_pair_id);
    if (existing) {
      // Realizer pairs share the latent trajectory: gains must be identical.
      for (const [index, step] of trajectory.steps.entries()) {
        for (const action of Object.keys(step.gains)) {
          const difference = Math.abs(
            step.gains[action].expected_gain_bits - existing.steps[index].gains[action].expected_gain_bits,
          );
          if (difference > 1e-12) throw new Error(`voi study: realizer-paired B1 gains diverge at ${dialogue.id}`);
        }
      }
      continue;
    }
    fixedTrajectoriesByPair.set(dialogue.latent_pair_id, trajectory);
    fixedEntropyByPair.set(dialogue.latent_pair_id, trajectory.entropy);
    for (const step of trajectory.steps) {
      b1Table.push({
        latent_pair_id: dialogue.latent_pair_id,
        world_id: dialogue.world_id,
        generator_id: dialogue.generator_id,
        seed: dialogue.seed,
        prediction_turn: step.prediction_turn,
        scheduled_action: step.action,
        belief_entropy_bits_before: round(step.belief_entropy_bits_before, 12),
        gains: Object.fromEntries(
          Object.entries(step.gains).map(([action, gain]) => [
            action,
            {
              expected_gain_bits: round(gain.expected_gain_bits, 12),
              prior_entropy_bits: round(gain.prior_entropy_bits, 12),
              expected_posterior_entropy_bits: round(gain.expected_posterior_entropy_bits, 12),
              observation_count: gain.observation_count,
              next_state_count: gain.next_state_count,
            },
          ]),
        ),
      });
    }
  }
  const b1Summary = {};
  const b1MaxGainBits = {};
  for (const world of worldIds) {
    b1Summary[world] = {};
    for (const generator of generatorIds) {
      b1Summary[world][generator] = {};
      const rows = b1Table.filter((row) => row.world_id === world && row.generator_id === generator);
      for (const action of CANONICAL_BENCHMARK_ACTION_TYPES) {
        const gains = rows.filter((row) => row.gains[action]).map((row) => row.gains[action].expected_gain_bits);
        if (!gains.length) continue;
        b1Summary[world][generator][action] = {
          transitions: gains.length,
          max_gain_bits: round(Math.max(...gains), 6),
          median_gain_bits: round(median(gains), 6),
          mean_gain_bits: round(mean(gains), 6),
          transitions_at_or_above_floor: gains.filter((value) => value >= margins.action_information_floor_bits).length,
        };
        b1MaxGainBits[generator] = b1MaxGainBits[generator] || {};
        b1MaxGainBits[generator][world] = b1MaxGainBits[generator][world] || {};
        b1MaxGainBits[generator][world][action] = Math.max(...gains);
      }
    }
  }

  // -------------------------------------------------------------------------------------------
  // B2 — generate and seal the info-optimal schedule arm (fresh label-derived seeds).
  // -------------------------------------------------------------------------------------------
  process.stderr.write('B2: generating the info-optimal schedule arm\n');
  const generation = generateVoiArm({ config: baseConfig, label, adapters, worlds });
  const regenerated = generateVoiArm({ config: baseConfig, label, adapters, worlds });
  const replayPassed = generation.dataset.content_sha256 === regenerated.dataset.content_sha256;
  if (!replayPassed) throw new Error('voi study: VOI arm deterministic replay failed');
  if (generation.dataset.dialogues.length !== contract.part_1b.voi_arm.dialogues) {
    throw new Error('voi study: VOI arm dialogue count differs from the frozen contract');
  }
  const sealed = sealVoiRun({
    runDir: voiRunDir,
    label,
    generation,
    config: baseConfig,
    configPath: baseConfigPath,
    instrumentConfigPath,
    s0Archive: archives.s0,
    replayPassed,
  });
  process.stderr.write(`B2: sealed ${label} (${sealed.verified.inventory.length} artifacts)\n`);
  const voiRows = generation.dataset.rows;
  const voiFilterByTarget = Object.fromEntries(TARGETS.map((target) => [target, new Map()]));
  for (const dialogue of generation.dialogues) {
    for (const [index, step] of dialogue.trajectory.steps.entries()) {
      const rowId = `${dialogue.job.id}__predict_t${index + 1}`;
      for (const target of TARGETS) {
        voiFilterByTarget[target].set(rowId, {
          id: rowId,
          truth: String(step.transition.targets[target]),
          probabilities: clone(step.filter_target_distributions[target]),
        });
      }
    }
  }
  const actionBasisCounts = {};
  for (const dialogue of generation.dataset.dialogues) {
    for (const choice of dialogue.action_choice) {
      actionBasisCounts[choice.basis] = (actionBasisCounts[choice.basis] || 0) + 1;
    }
  }
  const schedulesByCell = {};
  for (const world of worldIds) {
    for (const generator of generatorIds) {
      schedulesByCell[`${world}__${generator}`] = generation.dataset.dialogues
        .filter(
          (dialogue) =>
            dialogue.world_id === world &&
            dialogue.generator_id === generator &&
            dialogue.realizer_id === 'canonical_template',
        )
        .sort((left, right) => left.repetition - right.repetition)
        .map((dialogue) => ({ repetition: dialogue.repetition, schedule: dialogue.action_schedule }));
    }
  }

  // -------------------------------------------------------------------------------------------
  // B3 — channel-capacity read per schedule.
  // -------------------------------------------------------------------------------------------
  process.stderr.write('B3: channel-capacity read (fixed arm)\n');
  const pilotNoStateByTarget = {};
  for (const target of TARGETS) {
    pilotNoStateByTarget[target] = new Map();
    for (const row of pilotPredictions.rows) {
      if (row.lane === 'world_transfer' && row.target === target && row.representation === 'no_state') {
        pilotNoStateByTarget[target].set(row.id, row);
      }
    }
    if (pilotNoStateByTarget[target].size !== dataset.rows.length) {
      throw new Error(`voi study: pilot no_state predictions incomplete for ${target}`);
    }
  }
  const s0WorldLane = splitManifest.lanes.find((lane) => lane.id === 'world_transfer');
  if (!s0WorldLane) throw new Error('voi study: sealed S0 split manifest is missing the world lane');
  const fixedRead = armChannelCapacityRead({
    armId: 'fixed',
    rows: dataset.rows,
    folds: s0WorldLane.folds,
    splitManifestForBaselines: splitManifest,
    baseConfig,
    filterPredictionsByTarget: fixedFilterByTarget,
    bootstrap,
    pilotNoStateByTarget,
  });
  process.stderr.write('B3: channel-capacity read (voi arm)\n');
  const voiFolds = worldTransferFolds(voiRows);
  const voiSplitManifestForBaselines = { lanes: [{ id: 'world_transfer', folds: voiFolds }] };
  const voiRead = armChannelCapacityRead({
    armId: 'voi',
    rows: voiRows,
    folds: voiFolds,
    splitManifestForBaselines: voiSplitManifestForBaselines,
    baseConfig,
    filterPredictionsByTarget: voiFilterByTarget,
    bootstrap,
  });
  const armContrast = {};
  for (const target of TARGETS) {
    armContrast[target] = {
      log_loss:
        voiRead.targets[target].contrasts.filter_vs_no_state.metrics.log_loss.point_delta -
        fixedRead.targets[target].contrasts.filter_vs_no_state.metrics.log_loss.point_delta,
      brier_score:
        voiRead.targets[target].contrasts.filter_vs_no_state.metrics.brier_score.point_delta -
        fixedRead.targets[target].contrasts.filter_vs_no_state.metrics.brier_score.point_delta,
      basis: 'descriptive_unpaired_difference_of_point_deltas',
    };
  }

  // -------------------------------------------------------------------------------------------
  // B4 — lean_dag refit on the VOI arm (1x penalty), against the arm's own no_state.
  // -------------------------------------------------------------------------------------------
  process.stderr.write('B4: lean_dag refit on the voi arm\n');
  const voiById = new Map(voiRows.map((row) => [row.id, row]));
  const b4 = { voi_arm: {}, fixed_arm_sealed_pilot: {}, models: [] };
  for (const target of TARGETS) {
    const labels = TARGET_LABELS[target];
    const leanFit = fitFoldedPredictions({
      folds: voiFolds,
      byId: voiById,
      baseConfig,
      representation: 'lean_dag',
      target,
    });
    b4.models.push(...leanFit.models.map((model) => ({ target, representation: 'lean_dag', ...model })));
    const noStateFit = fitFoldedPredictions({
      folds: voiFolds,
      byId: voiById,
      baseConfig,
      representation: 'no_state',
      target,
    });
    const pooled = comparisonBlock({
      scopeRows: voiRows,
      candidateById: leanFit.predictions,
      baselineById: noStateFit.predictions,
      labels,
      bootstrap,
      material: `1b|b4|voi|lean_dag|vs=no_state|${target}|pooled`,
    });
    const perWorld = {};
    for (const world of worldIds) {
      perWorld[world] = pointDeltas({
        scopeRows: voiRows.filter((row) => row.groups.world_id === world),
        candidateById: leanFit.predictions,
        baselineById: noStateFit.predictions,
        labels,
      });
    }
    b4.voi_arm[target] = {
      pooled,
      per_world_point_deltas: perWorld,
      absolute: {
        lean_dag: absoluteMetrics(voiRows, leanFit.predictions, labels),
        no_state: absoluteMetrics(voiRows, noStateFit.predictions, labels),
      },
    };
    const sealedComparison = pilotReport.comparisons.find(
      (row) =>
        row.lane === 'world_transfer' &&
        row.level === 'pooled' &&
        row.target === target &&
        row.candidate === 'lean_dag' &&
        row.baseline === 'no_state',
    );
    if (!sealedComparison) throw new Error(`voi study: pilot report is missing sealed lean_dag/${target} comparison`);
    b4.fixed_arm_sealed_pilot[target] = clone(sealedComparison.metrics);
  }
  b4.scheduling_rescues_lean_estimator = TARGETS.every(
    (target) =>
      b4.voi_arm[target].pooled.metrics.log_loss.point_delta >= margins.log_loss_nats &&
      b4.voi_arm[target].pooled.metrics.brier_score.point_delta >= margins.brier,
  );

  // -------------------------------------------------------------------------------------------
  // B5 — descriptive proof-progress trajectories per arm x world x kernel.
  // -------------------------------------------------------------------------------------------
  const b5 = {};
  for (const [armId, rows] of [
    ['fixed', dataset.rows],
    ['voi', voiRows],
  ]) {
    b5[armId] = {};
    for (const world of worldIds) {
      b5[armId][world] = {};
      for (const generator of generatorIds) {
        const scope = rows.filter((row) => row.groups.world_id === world && row.groups.generator_id === generator);
        if (!scope.length) continue;
        const byTurn = {};
        for (let turn = 1; turn <= 6; turn += 1) {
          const turnRows = scope.filter((row) => row.turn === turn);
          byTurn[turn] = {
            mean_raw_distance_before: round(mean(turnRows.map((row) => row.proof_transition.current.raw_distance)), 4),
            mean_raw_distance_after: round(mean(turnRows.map((row) => row.proof_transition.next.raw_distance)), 4),
            mean_harmful_debt_after: round(
              mean(turnRows.map((row) => row.proof_transition.next.harmful_proof_debt)),
              4,
            ),
          };
        }
        const finals = scope.filter((row) => row.turn === 6);
        const counts = { advance: 0, regress: 0, stall: 0 };
        for (const row of scope) counts[row.targets.next_proof_trajectory] += 1;
        b5[armId][world][generator] = {
          rows: scope.length,
          start_raw_distance: scope.find((row) => row.turn === 1).proof_transition.current.raw_distance,
          final_raw_distance_mean: round(mean(finals.map((row) => row.proof_transition.next.raw_distance)), 4),
          final_harmful_debt_mean: round(mean(finals.map((row) => row.proof_transition.next.harmful_proof_debt)), 4),
          trajectory_counts: counts,
          by_turn: byTurn,
        };
      }
    }
  }

  // -------------------------------------------------------------------------------------------
  // Entropy summaries + frozen verdict.
  // -------------------------------------------------------------------------------------------
  const entropySummary = {};
  for (const [armId, entropies] of [
    ['fixed', [...fixedEntropyByPair.values()]],
    ['voi', [...generation.trajectories.values()].map((trajectory) => trajectory.entropy)],
  ]) {
    const reductions = entropies.map((row) => row.reduction_bits);
    entropySummary[armId] = {
      latent_trajectories: entropies.length,
      mean_prior_bits_at_horizon: round(mean(entropies.map((row) => row.prior_only_bits_at_horizon)), 6),
      mean_posterior_bits_at_horizon: round(mean(entropies.map((row) => row.posterior_bits_at_horizon)), 6),
      mean_reduction_bits: round(mean(reductions), 6),
      min_reduction_bits: round(Math.min(...reductions), 6),
      max_reduction_bits: round(Math.max(...reductions), 6),
      per_trajectory: entropies.map((row, index) => ({
        index,
        prior_only_bits_at_horizon: round(row.prior_only_bits_at_horizon, 6),
        posterior_bits_at_horizon: round(row.posterior_bits_at_horizon, 6),
        reduction_bits: round(row.reduction_bits, 6),
      })),
    };
  }
  const b3ForVerdict = {
    fixed: Object.fromEntries(
      TARGETS.map((target) => [target, clone(fixedRead.targets[target].contrasts.filter_vs_no_state.metrics)]),
    ),
    voi: Object.fromEntries(
      TARGETS.map((target) => [target, clone(voiRead.targets[target].contrasts.filter_vs_no_state.metrics)]),
    ),
  };
  const verdict = evaluateAdaptiveStateVoiVerdict({
    part1aLabel,
    margins,
    b3: b3ForVerdict,
    b1MaxGainBits,
    entropyVoi: entropySummary.voi,
    oraclePasses: { fixed: fixedRead.oracle_passes, voi: voiRead.oracle_passes },
  });

  // -------------------------------------------------------------------------------------------
  // Report.
  // -------------------------------------------------------------------------------------------
  const git = captureGitFingerprint({ repoRoot: ROOT });
  const allGains = b1Table.flatMap((row) => Object.values(row.gains).map((gain) => gain.expected_gain_bits));
  const report = {
    schema: ADAPTIVE_STATE_VOI_STUDY_REPORT_SCHEMA,
    version: '2.4',
    stage: 'part_1b_voi',
    status: 'complete',
    model_calls: 0,
    claim_boundary: instrumentConfig.claim_boundary,
    rescue_authority:
      'none — directional only; winner: null and do_not_optimize_policy remain operative; S2 prohibited; graduate would authorize design only, under a new prospective contract',
    verdict,
    provenance: {
      git: { sha: git.sha, dirty: git.dirty, untracked: git.untracked.length },
      protocol_doc: instrumentConfig.protocol_doc,
      instrument_config: { path: path.relative(ROOT, instrumentConfigPath), sha256: hashFile(instrumentConfigPath) },
      base_config: { path: path.relative(ROOT, baseConfigPath), sha256: hashFile(baseConfigPath) },
      analyzer: {
        script: path.relative(ROOT, SCRIPT),
        script_sha256: hashFile(SCRIPT),
        filter_module: path.relative(ROOT, FILTER_MODULE),
        filter_module_sha256: hashFile(FILTER_MODULE),
      },
      part_1a_report: {
        path: path.relative(ROOT, part1aPath),
        content_sha256: part1aReport.content_sha256,
        classification_label: part1aLabel,
        sequencing: contract.part_1b.sequencing,
      },
      restored_archives: {
        s0: { ...archives.s0, dataset_content_sha256: dataset.content_sha256 },
        pilot: {
          ...archives.pilot,
          predictions_sha256: pilotPredictions.content_sha256,
          report_sha256: pilotReport.content_sha256,
        },
      },
      voi_run: {
        label,
        run_dir: path.relative(ROOT, voiRunDir),
        dataset_content_sha256: generation.dataset.content_sha256,
        seal_sha256: sealed.sealSha256,
        artifacts: sealed.verified.inventory.length,
      },
      bootstrap: { ...clone(bootstrap), confidence_level: CONFIDENCE_LEVEL },
    },
    coverage: {
      targets: [...TARGETS],
      worlds: worldIds,
      generators: generatorIds,
      actions: [...CANONICAL_BENCHMARK_ACTION_TYPES],
      fixed_arm: { dialogues: dataset.dialogues.length, scored_transitions: dataset.rows.length },
      voi_arm: { dialogues: generation.dataset.dialogues.length, scored_transitions: voiRows.length },
      latent_pair_clusters_per_arm: new Set(dataset.rows.map((row) => row.groups.latent_pair_id)).size,
    },
    b1_information_gain: {
      definition:
        'Expected one-step posterior-entropy reduction over latent kernel state (bits): H(next-state prior) - E_obs[H(next-state posterior)], exact filter from the deterministic per-dialogue initial state (point-mass prior; the S0 executor initializes kernel state deterministically from the dialogue seed).',
      floor_bits: margins.action_information_floor_bits,
      summary: b1Summary,
      max_gain_bits_by_kernel_world_action: clone(b1MaxGainBits),
      table: b1Table,
    },
    b2_voi_arm: {
      label,
      dialogues: generation.dataset.dialogues.length,
      scored_transitions: voiRows.length,
      deterministic_realizer_calls: generation.dataset.deterministic_realizer_call_count,
      model_calls: 0,
      action_basis_counts: actionBasisCounts,
      fallback_count: generation.fallbacks.length,
      fallbacks: generation.fallbacks,
      replay_passed: replayPassed,
      schedules_by_cell: schedulesByCell,
      scramble_donor_state_identical_rows: voiRows.filter((row) => row.controls.scramble_donor_state_identical).length,
    },
    b3_channel_capacity: {
      note: 'Filter posterior as predictor of both co-primary targets on each arm, against the arm’s own no_state baseline (frozen verdict binding). Part 1a showed the pilot’s no_state is schedule-overfit; class_prior and schedule_only columns are included descriptively for reading, but the frozen rule binds on no_state as written.',
      fixed: fixedRead,
      voi: voiRead,
      arm_contrast: armContrast,
    },
    b4_estimator_read: b4,
    b5_info_pedagogy: b5,
    entropy: entropySummary,
    b1_overall: {
      max_gain_bits: round(Math.max(...allGains), 6),
      median_gain_bits: round(median(allGains), 6),
    },
  };
  report.reading = buildReading({
    verdict,
    b3: { fixed: fixedRead, voi: voiRead },
    b1Summary: report.b1_overall,
    entropy: entropySummary,
    b4Rescued: b4.scheduling_rescues_lean_estimator,
    part1aLabel,
  });
  report.content_sha256 = hashCanonicalJson(
    (() => {
      const content = { ...report };
      delete content.content_sha256;
      return content;
    })(),
  );

  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'voi-study-report.json');
  const mdPath = path.join(outDir, 'voi-study-report.md');
  const jsonBytes = canonicalJson(report, { space: 2, trailingNewline: true });
  fs.writeFileSync(jsonPath, jsonBytes);
  const mdBytes = renderMarkdown(report);
  fs.writeFileSync(mdPath, mdBytes);

  process.stdout.write(`verdict: ${verdict.token} (${verdict.matched_clause})\n`);
  for (const target of TARGETS) {
    process.stdout.write(
      `B3 filter vs no_state (${target}): fixed ${fmt(b3ForVerdict.fixed[target].log_loss.point_delta)} nats / voi ${fmt(
        b3ForVerdict.voi[target].log_loss.point_delta,
      )} nats\n`,
    );
  }
  process.stdout.write(
    `entropy at horizon (voi): prior ${fmt(entropySummary.voi.mean_prior_bits_at_horizon)} bits, posterior ${fmt(
      entropySummary.voi.mean_posterior_bits_at_horizon,
    )} bits\n`,
  );
  process.stdout.write(`fallback-to-fixed-schedule events: ${generation.fallbacks.length}\n`);
  process.stdout.write(`${path.relative(ROOT, jsonPath)} sha256 ${sha256(jsonBytes)}\n`);
  process.stdout.write(`${path.relative(ROOT, mdPath)} sha256 ${sha256(mdBytes)}\n`);
  process.stdout.write('model calls: 0\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT) {
  try {
    main();
  } catch (error) {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  }
}
