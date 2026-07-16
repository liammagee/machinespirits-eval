import fs from 'node:fs';
import path from 'node:path';

import YAML from 'yaml';

import { loadTutorStubFirstDraftCampaign, validateTutorStubFirstDraftCampaign } from './tutorStubFirstDraftCampaign.js';

export const TUTOR_STUB_FIRST_DRAFT_OUTER_LOOP_SCHEMA = 'machinespirits.tutor-stub.first-draft-outer-loop.v1';

const REQUIRED_STATES = Object.freeze({
  awaiting_working_screen: { terminalScope: 'none', outcome: 'pending' },
  working_predeclared: { terminalScope: 'none', outcome: 'pending' },
  working_running: { terminalScope: 'none', outcome: 'pending' },
  working_passed: { terminalScope: 'none', outcome: 'pending' },
  acceptance_predeclared: { terminalScope: 'none', outcome: 'pending' },
  hard_cell_running: { terminalScope: 'none', outcome: 'pending' },
  remaining_cells_running: { terminalScope: 'none', outcome: 'pending' },
  accepted: { terminalScope: 'loop', outcome: 'success' },
  stagnated: { terminalScope: 'version', outcome: 'no_progress' },
  blocked_infrastructure: { terminalScope: 'loop', outcome: 'infrastructure' },
  retired_after_acceptance_failure: { terminalScope: 'version', outcome: 'acceptance_failure' },
});

const REQUIRED_TRANSITIONS = Object.freeze([
  ['awaiting_working_screen', 'working_predeclared'],
  ['working_predeclared', 'working_running'],
  ['working_running', 'working_predeclared'],
  ['working_running', 'working_passed'],
  ['working_running', 'stagnated'],
  ['working_running', 'blocked_infrastructure'],
  ['working_passed', 'acceptance_predeclared'],
  ['acceptance_predeclared', 'hard_cell_running'],
  ['acceptance_predeclared', 'blocked_infrastructure'],
  ['hard_cell_running', 'remaining_cells_running'],
  ['hard_cell_running', 'retired_after_acceptance_failure'],
  ['hard_cell_running', 'blocked_infrastructure'],
  ['remaining_cells_running', 'accepted'],
  ['remaining_cells_running', 'retired_after_acceptance_failure'],
  ['remaining_cells_running', 'blocked_infrastructure'],
  ['retired_after_acceptance_failure', 'working_predeclared'],
  ['stagnated', 'working_predeclared'],
]);

const REQUIRED_REVIEW_RESPONSIBILITIES = Object.freeze([
  'observe_evidence',
  'select_single_bounded_change',
  'generate_original_candidate',
  'deterministic_audit',
  'semantic_recognition_review',
  'verify_gates',
  'record_provenance',
]);

const V27_ITERATION_1_RESULT = Object.freeze({
  artifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-1/working-screen-result.json',
  runHead: '7fc926a2801f947da056b573a499933dccc71968',
  campaignValidationArtifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-1/campaign-validation.json',
  campaignValidationSha256: 'a7ade2ebce6d67dbfe9babb73bc52d2def9e396dca5b90d278b989e9c3677d07',
  resultSha256: '970cb051c9335f89ede51d8018002cb90017d42fdbefb79521a7747e6039d435',
  turns: Object.freeze([
    Object.freeze({
      turn: 4,
      path: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-1/marrick_v27_joint_performance/turn-4.json',
      sha256: '7b18f4e9ecfeb05e95cac828d99d8f76acccbb6773421602980c2b6ba4c1e828',
    }),
    Object.freeze({
      turn: 5,
      path: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-1/marrick_v27_joint_performance/turn-5.json',
      sha256: '2947ff1d15e921ad228ba7fbbcbaa6b936252d59c2a1766054d8326cfb50bf9f',
    }),
    Object.freeze({
      turn: 6,
      path: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-1/marrick_v27_joint_performance/turn-6.json',
      sha256: '3a5c1d8b57c9110f2bad39a5e78b2031ac8b108b2287315d418ae1bb6898d1b9',
    }),
  ]),
});

const V27_ITERATION_2_RESULT = Object.freeze({
  artifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-2/working-screen-result.json',
  runHead: 'bec13717719be76891bf5ece0c1ae94375cdea9a',
  configSha256: '4b71da924e17639a800012ed45f7682a1942eac25356bc7d9450715cc2638ea5',
  sourceTraceSha256: 'b6d98928d6042485895fe1e958044d6303f7c600512593876c6c1acd630f127a',
  campaignValidationArtifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-2/campaign-validation.json',
  campaignValidationSha256: '7eb96da004326ac21dc0844d23fbf95bb8209bde221e297f47870437946b842d',
  resultSha256: 'a5788cc7cd8aa68d1e540611b457f04d1590f1e3b5f5692663b7a04da186a4fb',
  turns: Object.freeze([
    Object.freeze({
      turn: 4,
      path: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-2/marrick_v27_joint_performance/turn-4.json',
      sha256: '1a9eb462a3d638e867d190fecc1ec2cedda434421196ebe896a389f2b6dcdc56',
    }),
    Object.freeze({
      turn: 5,
      path: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-2/marrick_v27_joint_performance/turn-5.json',
      sha256: 'c3e88048f0e0de30035c148c88b20a14ed9580afeb0b0dc9670fb0aac9f8042d',
    }),
    Object.freeze({
      turn: 6,
      path: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-2/marrick_v27_joint_performance/turn-6.json',
      sha256: '7257019859d7e62596672f651e34dea63d9d7889e69e3530ece092d60c9465ec',
    }),
  ]),
});

const V27_ITERATION_3_RESULT = Object.freeze({
  artifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-3/working-screen-result.json',
  runHead: 'f0df994d1912c3c8b6d6f1b9960b5ef05962f1a6',
  configSha256: 'eac765695c4e10a971cdf9ec95d4e83dd20ea48fdc281487541147e98f996568',
  sourceTraceSha256: 'b6d98928d6042485895fe1e958044d6303f7c600512593876c6c1acd630f127a',
  campaignValidationArtifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-3/campaign-validation.json',
  campaignValidationSha256: 'd758f789c558e687d60cd97272658f580a1e4bc07d02e07b4592690b1cd77b7d',
  resultSha256: '743a31ae5779930b02e488c6092069fc3a1872ac462af6acee8512f1abd43888',
  turns: Object.freeze([
    Object.freeze({
      turn: 4,
      path: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-3/marrick_v27_joint_performance/turn-4.json',
      sha256: '675d6a7794253e4c16b28ba0ec69625fef5ee26d790aac88496b4ca15422351f',
    }),
  ]),
});

function requiredString(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function integer(value, label, { minimum = 0 } = {}) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${label} must be an integer >= ${minimum}`);
  }
  return parsed;
}

function absolute(root, value) {
  const normalized = requiredString(value, 'path');
  return path.isAbsolute(normalized) ? normalized : path.join(root, normalized);
}

function expect(value, expected, label) {
  if (value !== expected) throw new Error(`${label} must be ${JSON.stringify(expected)}`);
}

function expectJson(value, expected, label) {
  if (JSON.stringify(value) !== JSON.stringify(expected)) {
    throw new Error(`${label} must preserve the exact predeclared value`);
  }
}

function validateV27Iteration1Observation(observation, label) {
  expect(observation?.version, 27, `${label} version`);
  expect(observation?.working_iteration, 1, `${label} working iteration`);
  expect(observation?.status, 'fail', `${label} status`);
  expect(observation?.result_artifact, V27_ITERATION_1_RESULT.artifact, `${label} result artifact`);
  expect(observation?.development_seed, 20261500, `${label} development seed`);
  expect(
    observation?.seed_disposition,
    'reusable_non_held_out_development',
    `${label} seed disposition`,
  );
  expect(observation?.run_head, V27_ITERATION_1_RESULT.runHead, `${label} run HEAD`);
  expect(
    observation?.provenance?.campaign_validation_artifact,
    V27_ITERATION_1_RESULT.campaignValidationArtifact,
    `${label} campaign validation artifact`,
  );
  expect(
    observation?.provenance?.campaign_validation_sha256,
    V27_ITERATION_1_RESULT.campaignValidationSha256,
    `${label} campaign validation hash`,
  );
  expect(
    observation?.provenance?.result_sha256,
    V27_ITERATION_1_RESULT.resultSha256,
    `${label} result hash`,
  );
  expectJson(
    observation?.provenance?.turn_artifacts,
    V27_ITERATION_1_RESULT.turns,
    `${label} turn provenance`,
  );
  expectJson(observation?.completed_turns, [4, 5, 6], `${label} completed turns`);
  expectJson(observation?.unstarted_turns, [9], `${label} unstarted turns`);
  expect(observation?.original_candidates_accepted, 2, `${label} accepted originals`);
  expect(observation?.original_candidates_completed, 3, `${label} completed originals`);
  expect(observation?.original_candidate_acceptance_rate, 0.6666667, `${label} acceptance rate`);
  expect(observation?.mean_configuration_realization, 0.6666667, `${label} configuration realization`);
  for (const field of [
    'final_safety_failures',
    'transcript_specific_uptake_failures',
    'mechanical_repairs',
    'model_rewrites',
    'deterministic_fallbacks',
    'semantic_adjudicator_calls',
    'semantic_recognition_corrections',
  ]) {
    expect(observation?.[field], 0, `${label} ${field}`);
  }
  expect(observation?.joint_performance_model_outputs, 3, `${label} joint outputs`);
  expect(observation?.valid_joint_performance_outputs, 2, `${label} valid joint outputs`);
  expect(observation?.joint_performance_output_failures, 1, `${label} joint output failures`);
  expect(observation?.joint_performance_ownership_passes, 2, `${label} ownership passes`);
  expect(observation?.joint_performance_ownership_failures, 1, `${label} ownership failures`);
  expect(observation?.exact_host_source_occurrence_passes, 2, `${label} host source passes`);
  expect(observation?.exact_host_source_occurrence_failures, 1, `${label} host source failures`);
  expect(observation?.mean_original_latency_ms, 8143.6667, `${label} mean original latency`);
  expect(observation?.mean_total_tutor_latency_ms, 8143.6667, `${label} mean total latency`);
  expectJson(
    observation?.dominant_failure_clusters,
    [
      {
        cluster: 'jointPerformanceGenerationAudit:slot_exceeds_word_target',
        count: 1,
        evidence: 'observed_hard_failure',
      },
      {
        cluster: 'jointPerformanceGenerationPrompt:v2_axis_ownership_conflict',
        count: 2,
        evidence: 'post_audit_counterfactual_contract_review',
        manifestations: [
          'advocate_testability_delegated_to_handoff',
          'stance_contract_assigns_concrete_check_to_performance',
        ],
      },
    ],
    `${label} dominant failure cluster`,
  );
  expect(observation?.comparison?.comparison_available, false, `${label} comparison availability`);
  expect(observation?.comparison?.measurable_improvement, null, `${label} measurable improvement`);
  expect(observation?.comparison?.consecutive_without_improvement, 0, `${label} stagnation count`);
  expect(observation?.comparison?.stop, false, `${label} stop decision`);
  expect(observation?.comparison?.reason, 'first_measured_iteration', `${label} stop reason`);
}

function validateV27Iteration2Observation(observation, label) {
  expect(observation?.version, 27, `${label} version`);
  expect(observation?.working_iteration, 2, `${label} working iteration`);
  expect(observation?.status, 'fail', `${label} status`);
  expect(observation?.result_artifact, V27_ITERATION_2_RESULT.artifact, `${label} result artifact`);
  expect(observation?.development_seed, 20261500, `${label} development seed`);
  expect(
    observation?.seed_disposition,
    'reusable_non_held_out_development',
    `${label} seed disposition`,
  );
  expect(observation?.run_head, V27_ITERATION_2_RESULT.runHead, `${label} run HEAD`);
  expect(
    observation?.run_head_provenance,
    'launch_log_timeline_confirmed',
    `${label} run HEAD provenance`,
  );
  expect(observation?.run_head_artifact_embedded, false, `${label} artifact run HEAD flag`);
  expect(
    observation?.provenance?.working_screen_config_sha256,
    V27_ITERATION_2_RESULT.configSha256,
    `${label} config hash`,
  );
  expect(
    observation?.provenance?.source_trace_sha256,
    V27_ITERATION_2_RESULT.sourceTraceSha256,
    `${label} source trace hash`,
  );
  expect(
    observation?.provenance?.campaign_validation_artifact,
    V27_ITERATION_2_RESULT.campaignValidationArtifact,
    `${label} campaign validation artifact`,
  );
  expect(
    observation?.provenance?.campaign_validation_sha256,
    V27_ITERATION_2_RESULT.campaignValidationSha256,
    `${label} campaign validation hash`,
  );
  expect(
    observation?.provenance?.result_sha256,
    V27_ITERATION_2_RESULT.resultSha256,
    `${label} result hash`,
  );
  expectJson(
    observation?.provenance?.turn_artifacts,
    V27_ITERATION_2_RESULT.turns,
    `${label} turn provenance`,
  );
  expectJson(observation?.completed_turns, [4, 5, 6], `${label} completed turns`);
  expectJson(observation?.unstarted_turns, [9], `${label} unstarted turns`);
  expect(observation?.original_candidates_accepted, 2, `${label} accepted originals`);
  expect(observation?.original_candidates_completed, 3, `${label} completed originals`);
  expect(
    observation?.original_candidate_acceptance_rate,
    0.6666666666666666,
    `${label} acceptance rate`,
  );
  expect(
    observation?.mean_configuration_realization,
    0.9443333333333334,
    `${label} configuration realization`,
  );
  expect(observation?.maximum_possible_originals_accepted, 3, `${label} maximum accepted`);
  expect(
    observation?.maximum_possible_configuration_realization,
    0.95825,
    `${label} maximum configuration realization`,
  );
  for (const field of [
    'final_safety_failures',
    'transcript_specific_uptake_failures',
    'mechanical_repairs',
    'model_rewrites',
    'deterministic_fallbacks',
    'semantic_adjudicator_calls',
    'semantic_adjudicator_errors',
    'semantic_recognition_corrections',
  ]) {
    expect(observation?.[field], 0, `${label} ${field}`);
  }
  expect(observation?.joint_performance_model_outputs, 3, `${label} joint outputs`);
  expect(observation?.valid_joint_performance_outputs, 3, `${label} valid joint outputs`);
  expect(observation?.joint_performance_output_failures, 0, `${label} joint output failures`);
  expect(observation?.joint_performance_ownership_passes, 2, `${label} ownership passes`);
  expect(observation?.joint_performance_ownership_failures, 1, `${label} ownership failures`);
  expect(observation?.exact_host_source_occurrence_passes, 3, `${label} host source passes`);
  expect(observation?.exact_host_source_occurrence_failures, 0, `${label} host source failures`);
  expect(observation?.mean_original_latency_ms, 8973.666666666666, `${label} mean original latency`);
  expect(observation?.mean_total_tutor_latency_ms, 8973.666666666666, `${label} mean total latency`);
  expectJson(observation?.token_usage, { input: 50101, output: 724, total: 50825 }, `${label} token usage`);
  expectJson(
    observation?.dominant_failure_clusters,
    [
      { cluster: 'actorialRealizationAudit:missing_selected_actorial_part', count: 1 },
      { cluster: 'jointPerformanceAudit:axis_not_realized_in_owner:actorial_part', count: 1 },
    ],
    `${label} dominant failure clusters`,
  );
  expectJson(
    observation?.comparison,
    {
      comparison_available: true,
      compared_to_iteration: 1,
      comparable_completion: true,
      measurable_improvement: true,
      configuration_realization_improved: true,
      original_candidates_accepted_delta: 0,
      original_candidate_acceptance_rate_delta: 0,
      mean_configuration_realization_delta: 0.27766666666666673,
      valid_joint_performance_outputs_delta: 1,
      joint_performance_output_failures_delta: -1,
      joint_performance_ownership_passes_delta: 0,
      joint_performance_ownership_failures_delta: 0,
      exact_host_source_occurrence_passes_delta: 1,
      exact_host_source_occurrence_failures_delta: -1,
      mean_original_latency_ms_delta: 830,
      consecutive_without_improvement: 0,
      stop: false,
      reason: 'improved',
    },
    `${label} comparison`,
  );
}

function validateV27Iteration3Observation(observation, label) {
  expect(observation?.version, 27, `${label} version`);
  expect(observation?.working_iteration, 3, `${label} working iteration`);
  expect(observation?.status, 'fail', `${label} status`);
  expect(observation?.result_artifact, V27_ITERATION_3_RESULT.artifact, `${label} result artifact`);
  expect(observation?.development_seed, 20261500, `${label} development seed`);
  expect(
    observation?.seed_disposition,
    'reusable_non_held_out_development',
    `${label} seed disposition`,
  );
  expect(observation?.run_head, V27_ITERATION_3_RESULT.runHead, `${label} run HEAD`);
  expect(observation?.run_head_provenance, 'launch_log_confirmed', `${label} run HEAD provenance`);
  expect(observation?.run_head_artifact_embedded, false, `${label} artifact run HEAD flag`);
  expect(
    observation?.provenance?.working_screen_config_sha256,
    V27_ITERATION_3_RESULT.configSha256,
    `${label} config hash`,
  );
  expect(
    observation?.provenance?.source_trace_sha256,
    V27_ITERATION_3_RESULT.sourceTraceSha256,
    `${label} source trace hash`,
  );
  expect(
    observation?.provenance?.campaign_validation_artifact,
    V27_ITERATION_3_RESULT.campaignValidationArtifact,
    `${label} campaign validation artifact`,
  );
  expect(
    observation?.provenance?.campaign_validation_sha256,
    V27_ITERATION_3_RESULT.campaignValidationSha256,
    `${label} campaign validation hash`,
  );
  expect(
    observation?.provenance?.result_sha256,
    V27_ITERATION_3_RESULT.resultSha256,
    `${label} result hash`,
  );
  expectJson(
    observation?.provenance?.turn_artifacts,
    V27_ITERATION_3_RESULT.turns,
    `${label} turn provenance`,
  );
  expectJson(observation?.completed_turns, [4], `${label} completed turns`);
  expectJson(observation?.unstarted_turns, [5, 6, 9], `${label} unstarted turns`);
  expect(observation?.original_candidates_accepted, 0, `${label} accepted originals`);
  expect(observation?.original_candidates_completed, 1, `${label} completed originals`);
  expect(observation?.original_candidate_acceptance_rate, 0, `${label} acceptance rate`);
  expect(observation?.mean_configuration_realization, 0, `${label} configuration realization`);
  expect(observation?.maximum_possible_originals_accepted, 3, `${label} maximum accepted`);
  expect(
    observation?.maximum_possible_configuration_realization,
    0.75,
    `${label} maximum configuration realization`,
  );
  for (const field of [
    'final_safety_failures',
    'transcript_specific_uptake_failures',
    'mechanical_repairs',
    'model_rewrites',
    'deterministic_fallbacks',
    'semantic_adjudicator_calls',
    'semantic_adjudicator_errors',
    'semantic_recognition_corrections',
  ]) {
    expect(observation?.[field], 0, `${label} ${field}`);
  }
  expect(observation?.joint_performance_model_outputs, 1, `${label} joint outputs`);
  expect(observation?.valid_joint_performance_outputs, 0, `${label} valid joint outputs`);
  expect(observation?.joint_performance_output_failures, 1, `${label} joint output failures`);
  expect(observation?.joint_performance_ownership_passes, 0, `${label} ownership passes`);
  expect(observation?.joint_performance_ownership_failures, 1, `${label} ownership failures`);
  expect(observation?.exact_host_source_occurrence_passes, 0, `${label} host source passes`);
  expect(observation?.exact_host_source_occurrence_failures, 1, `${label} host source failures`);
  expect(observation?.mean_original_latency_ms, 9932, `${label} mean original latency`);
  expect(observation?.mean_total_tutor_latency_ms, 9932, `${label} mean total latency`);
  expectJson(observation?.token_usage, { input: 15906, output: 281, total: 16187 }, `${label} token usage`);
  expectJson(
    observation?.dominant_failure_clusters,
    [{ cluster: 'jointPerformanceGenerationAudit:slot_has_outer_whitespace', count: 1 }],
    `${label} dominant failure clusters`,
  );
  expectJson(
    observation?.comparison,
    {
      comparison_available: true,
      compared_to_iteration: 2,
      comparable_completion: false,
      measurable_improvement: false,
      configuration_realization_improved: false,
      semantic_recognition_corrections: 0,
      consecutive_without_improvement: 1,
      stop: false,
      reason: 'no_improvement',
    },
    `${label} comparison`,
  );
}

function validateStateMachine(manifest) {
  const states = manifest.state_machine?.states || {};
  for (const [id, requirement] of Object.entries(REQUIRED_STATES)) {
    const state = states[id];
    if (!state) throw new Error(`state machine is missing ${id}`);
    expect(state.terminal_scope, requirement.terminalScope, `${id} terminal scope`);
    expect(state.outcome, requirement.outcome, `${id} outcome`);
  }

  const currentState = requiredString(manifest.current?.state, 'current state');
  if (!states[currentState]) throw new Error(`current state is not declared: ${currentState}`);

  const transitions = Array.isArray(manifest.state_machine?.transitions) ? manifest.state_machine.transitions : [];
  const pairs = new Set();
  for (const transition of transitions) {
    const from = requiredString(transition.from, 'transition from');
    const to = requiredString(transition.to, 'transition to');
    if (!states[from] || !states[to]) throw new Error(`transition references an unknown state: ${from} -> ${to}`);
    requiredString(transition.when, `${from} -> ${to} condition`);
    const key = `${from}|${to}`;
    if (pairs.has(key)) throw new Error(`duplicate transition ${from} -> ${to}`);
    pairs.add(key);
  }
  for (const [from, to] of REQUIRED_TRANSITIONS) {
    if (!pairs.has(`${from}|${to}`)) throw new Error(`state machine is missing transition ${from} -> ${to}`);
  }

  const advance = transitions.find(
    (transition) => transition.from === 'retired_after_acceptance_failure' && transition.to === 'working_predeclared',
  );
  expect(advance?.version_action, 'increment_by_one', 'retired-version transition action');
  const reset = transitions.find(
    (transition) => transition.from === 'stagnated' && transition.to === 'working_predeclared',
  );
  expect(reset?.version_action, 'increment_by_one', 'stagnated-version transition action');

  return { states, transitions, currentState };
}

function validateVersioning(manifest) {
  const currentVersion = integer(manifest.current?.campaign_version, 'current campaign version', { minimum: 1 });
  expect(manifest.current?.label, `V${currentVersion}`, 'current version label');
  expect(manifest.versioning?.current, currentVersion, 'versioning current');
  expect(manifest.versioning?.next, currentVersion + 1, 'versioning next');
  expect(manifest.versioning?.increment, 1, 'version increment');
  expect(manifest.versioning?.unbounded, true, 'unbounded version progression');
  expect(manifest.versioning?.acceptance_version_immutable_after_first_paid_call, true, 'acceptance immutability');
  expect(manifest.versioning?.tuning_after_observation_retires_entire_version, true, 'version retirement rule');

  const examples = Array.isArray(manifest.versioning?.examples) ? manifest.versioning.examples : [];
  if (examples.length < 3) throw new Error('versioning must show at least three Vn -> Vn+1 examples');
  for (const example of examples) {
    const from = integer(example.from, 'version example from', { minimum: 1 });
    const to = integer(example.to, 'version example to', { minimum: 1 });
    if (to !== from + 1) throw new Error(`version example must increment by one: V${from} -> V${to}`);
  }
  return currentVersion;
}

function validateReviewRoles(manifest) {
  const roles = Array.isArray(manifest.inner_review_roles) ? manifest.inner_review_roles : [];
  if (!roles.length) throw new Error('inner review roles are required');
  const ids = new Set();
  const responsibilities = new Set();
  for (const role of roles) {
    const id = requiredString(role.id, 'inner review role id');
    if (ids.has(id)) throw new Error(`duplicate inner review role ${id}`);
    ids.add(id);
    requiredString(role.authority, `${id} authority`);
    const owned = Array.isArray(role.responsibilities) ? role.responsibilities : [];
    if (!owned.length) throw new Error(`${id} must own at least one responsibility`);
    for (const responsibility of owned) responsibilities.add(requiredString(responsibility, `${id} responsibility`));
  }
  for (const responsibility of REQUIRED_REVIEW_RESPONSIBILITIES) {
    if (!responsibilities.has(responsibility)) {
      throw new Error(`inner review roles do not assign ${responsibility}`);
    }
  }
  return roles;
}

function validateSeedLedger(manifest) {
  expect(manifest.seed_rules?.global_ledger_required, true, 'global seed ledger requirement');
  expect(manifest.seed_rules?.same_seed_retry_only_before_any_candidate_or_result, true, 'same-seed retry rule');
  expect(manifest.seed_rules?.tuning_retires_active_unstarted_and_reserve_seeds, true, 'seed retirement rule');
  expect(manifest.seed_rules?.fresh_acceptance_seeds_predeclared_before_paid_calls, true, 'seed predeclaration rule');

  const ledger = manifest.seed_ledger || {};
  const development = Array.isArray(ledger.development) ? ledger.development : [];
  if (!development.length) throw new Error('development seed ledger is empty');
  const historical = Array.isArray(ledger.historical) ? ledger.historical : [];
  const heldOut = Array.isArray(ledger.held_out?.entries) ? ledger.held_out.entries : [];
  const reserves = Array.isArray(ledger.reserve?.entries) ? ledger.reserve.entries : [];
  const seen = new Set();
  for (const entry of [...historical, ...development, ...heldOut, ...reserves]) {
    const seed = integer(entry.seed, 'seed ledger entry', { minimum: 1 });
    if (seen.has(seed)) throw new Error(`seed appears more than once in the ledger: ${seed}`);
    seen.add(seed);
    requiredString(entry.status, `seed ${seed} status`);
  }
  const developmentStatuses = new Set([
    'reusable_non_held_out_development',
    'consumed_development_reusable',
    'consumed_development_retired_after_stagnation',
    'retired_unstarted_due_to_stagnation',
  ]);
  for (const entry of development) {
    if (!developmentStatuses.has(entry.status)) {
      throw new Error(`development seed ${entry.seed} has unsupported status ${entry.status}`);
    }
  }

  if (['working_predeclared', 'stagnated'].includes(manifest.current?.state)) {
    expect(manifest.current?.acceptance_config, null, 'acceptance config before working-screen pass');
    expect(ledger.held_out?.status, 'not_predeclared', 'held-out seed status before working-screen pass');
    expect(ledger.reserve?.status, 'not_predeclared', 'reserve seed status before working-screen pass');
    if (heldOut.length || reserves.length) {
      throw new Error('held-out and reserve seeds must remain empty until acceptance is predeclared');
    }
  }
  if (manifest.current?.state === 'stagnated') {
    const reusable = development.filter((entry) =>
      ['reusable_non_held_out_development', 'consumed_development_reusable'].includes(entry.status),
    );
    if (reusable.length) {
      throw new Error('stagnated version must retire every development and confirmation seed');
    }
  }
  return { development, historical, heldOut, reserves };
}

function validateWorkingScreen(manifest, { root }) {
  const configPath = absolute(root, manifest.current?.working_screen_config);
  if (!fs.existsSync(configPath)) throw new Error(`working screen config is missing: ${configPath}`);
  const loaded = loadTutorStubFirstDraftCampaign(configPath, { root });
  const validation = validateTutorStubFirstDraftCampaign({ config: loaded.config, root });
  if (validation.kind !== 'working_screen') throw new Error('outer loop working config is not a working screen');

  const config = loaded.config;
  expect(config.id, manifest.current?.working_screen_id, 'working screen id');
  expect(config.held_out, false, 'working screen held-out flag');
  expect(config.fixed_configuration?.original_only, true, 'working screen original-only mode');
  expect(config.fixed_configuration?.draws_per_turn, 1, 'working screen draws per turn');
  expect(config.fixed_configuration?.concurrency, 1, 'working screen concurrency');
  if (config.fixed_configuration?.structured_generation === true) {
    expect(config.gates_per_cell?.require_structured_output, true, 'structured output gate');
    expect(config.gates_per_cell?.require_structured_slot_ownership, true, 'structured slot ownership gate');
    expect(config.gates_per_cell?.require_exact_source_once, true, 'exact source once gate');
  }
  if (config.fixed_configuration?.joint_performance_generation === true) {
    expect(
      config.gates_per_cell?.require_joint_performance_output,
      true,
      'joint-performance output gate',
    );
    expect(
      config.gates_per_cell?.require_joint_performance_ownership,
      true,
      'joint-performance ownership gate',
    );
    expect(
      config.gates_per_cell?.require_exact_host_source_occurrences,
      true,
      'exact host source occurrences gate',
    );
  }
  expect(config.gates_per_cell?.required_turns, 4, 'working screen required turns');
  expect(config.gates_per_cell?.required_originals_accepted, 4, 'working screen required originals');
  expect(config.gates_per_cell?.minimum_mean_configuration_realization, 1, 'working screen configuration realization');
  expect(config.gates_per_cell?.configuration_realization_enforcement, 'gate', 'configuration realization enforcement');
  expect(config.gates_per_cell?.maximum_safety_failures, 0, 'working screen safety failures');
  expect(config.gates_per_cell?.maximum_fallbacks, 0, 'working screen fallbacks');
  expect(config.gates_per_cell?.require_transcript_specific_uptake, true, 'working screen uptake gate');
  const finalFrontierAttemptIteration = config.stopping?.final_frontier_attempt_iteration;
  if (finalFrontierAttemptIteration != null) {
    integer(finalFrontierAttemptIteration, 'final-frontier attempt iteration', { minimum: 1 });
    expect(
      config.stopping?.stop_if_final_frontier_attempt_fails,
      true,
      'failed final-frontier attempt stop',
    );
  }
  if (config.matrix.length !== 1) throw new Error('working screen must contain exactly one focused cell');

  const cell = config.matrix[0];
  const ledgerEntry = (manifest.seed_ledger?.development || []).find(
    (entry) => Number(entry.seed) === Number(cell.development_seed),
  );
  if (!ledgerEntry) throw new Error(`working seed ${cell.development_seed} is absent from the outer-loop ledger`);
  expect(ledgerEntry.cell, cell.id, `working seed ${cell.development_seed} cell binding`);

  return {
    configPath,
    id: config.id,
    cell: cell.id,
    turns: cell.turns.map(Number),
    developmentSeed: Number(cell.development_seed),
    finalFrontierAttemptIteration:
      finalFrontierAttemptIteration == null ? null : Number(finalFrontierAttemptIteration),
    stopIfFinalFrontierAttemptFails:
      config.stopping?.stop_if_final_frontier_attempt_fails === true,
    jointPerformanceGeneration:
      config.fixed_configuration?.joint_performance_generation === true,
    jointPerformanceSchema:
      config.fixed_configuration?.joint_performance_schema || null,
    jointPerformanceCompositionSchema:
      config.fixed_configuration?.joint_performance_composition_schema || null,
    jointPerformanceAuditSchema:
      config.fixed_configuration?.joint_performance_audit_schema || null,
    iteration2Change: config.change_log?.iteration_2 || null,
    iteration3Change: config.change_log?.iteration_3 || null,
    iteration4Change: config.change_log?.iteration_4 || null,
    gates: {
      requiredOriginalsAccepted: 4,
      requiredTurns: 4,
      minimumMeanConfigurationRealization: 1,
      maximumSafetyFailures: 0,
      maximumFallbacks: 0,
      requireTranscriptSpecificUptake: true,
      requireStructuredOutput: config.fixed_configuration?.structured_generation === true,
      requireStructuredSlotOwnership: config.fixed_configuration?.structured_generation === true,
      requireExactSourceOnce: config.fixed_configuration?.structured_generation === true,
      requireJointPerformanceOutput:
        config.gates_per_cell?.require_joint_performance_output === true,
      requireJointPerformanceOwnership:
        config.gates_per_cell?.require_joint_performance_ownership === true,
      requireExactHostSourceOccurrences:
        config.gates_per_cell?.require_exact_host_source_occurrences === true,
    },
  };
}

export function loadTutorStubFirstDraftOuterLoop(manifestPath, { root = process.cwd() } = {}) {
  const resolvedPath = absolute(root, manifestPath);
  const manifest = YAML.parse(fs.readFileSync(resolvedPath, 'utf8')) || {};
  return { manifest, manifestPath: resolvedPath, root: path.resolve(root) };
}

export function validateTutorStubFirstDraftOuterLoop({ manifest, root = process.cwd() } = {}) {
  expect(manifest?.schema, TUTOR_STUB_FIRST_DRAFT_OUTER_LOOP_SCHEMA, 'outer-loop schema');
  const id = requiredString(manifest.id, 'outer-loop id');
  const currentVersion = validateVersioning(manifest);
  const state = validateStateMachine(manifest);
  const workingIteration = integer(manifest.current?.working_iteration, 'working iteration', { minimum: 1 });
  if (state.currentState === 'working_predeclared' && workingIteration > 1) {
    expect(manifest.current?.last_observation?.version, currentVersion, 'last working observation version');
    expect(
      manifest.current?.last_observation?.working_iteration,
      workingIteration - 1,
      'last working observation iteration',
    );
    const comparison = manifest.current?.last_observation?.comparison || {};
    if (comparison.reason === 'first_measured_iteration') {
      expect(comparison.comparison_available, false, 'first working comparison availability');
      expect(comparison.measurable_improvement, null, 'first working measurable improvement');
    } else if (typeof comparison.measurable_improvement !== 'boolean') {
      throw new Error('last working observation must record whether improvement was measurable');
    }
    integer(
      manifest.current?.last_observation?.comparison?.consecutive_without_improvement,
      'consecutive working iterations without improvement',
    );
  }
  if (state.currentState === 'stagnated') {
    expect(manifest.current?.last_observation?.version, currentVersion, 'terminal observation version');
    expect(
      manifest.current?.last_observation?.working_iteration,
      workingIteration,
      'terminal observation iteration',
    );
    expect(manifest.current?.last_observation?.status, 'stagnated', 'terminal observation status');
    expect(
      manifest.current?.last_observation?.comparison?.consecutive_without_improvement,
      2,
      'terminal consecutive iterations without improvement',
    );
    expect(manifest.current?.last_observation?.comparison?.stop, true, 'terminal stop decision');
    expect(
      manifest.current?.last_observation?.comparison?.reason,
      'predeclared_final_frontier_attempt_failed',
      'terminal stopping reason',
    );
    expect(
      manifest.current?.last_observation?.terminal_action?.v27_status,
      'not_activated_or_predeclared',
      'V27 activation status',
    );
    expect(
      manifest.current?.required_confirmation_after_primary_pass?.status,
      'retired_unstarted_due_to_stagnation',
      'cross-world confirmation status',
    );
  }
  const roles = validateReviewRoles(manifest);
  const seeds = validateSeedLedger(manifest);
  const workingScreen = validateWorkingScreen(manifest, { root });

  if (currentVersion === 27) {
    expect(state.currentState, 'working_predeclared', 'V27 current state');
    expect(workingIteration, 4, 'V27 working iteration');
    const workingHistory = manifest.current?.working_history || [];
    if (workingHistory.length !== 3) {
      throw new Error('V27 working history must preserve exactly iterations 1, 2, and 3 before iteration 4');
    }
    validateV27Iteration1Observation(workingHistory[0], 'V27 working history iteration 1');
    validateV27Iteration2Observation(workingHistory[1], 'V27 working history iteration 2');
    validateV27Iteration3Observation(workingHistory[2], 'V27 working history iteration 3');
    validateV27Iteration3Observation(manifest.current?.last_observation, 'V27 last observation');
    expectJson(
      manifest.current?.last_observation,
      workingHistory[2],
      'V27 last observation and working history',
    );
    expect(manifest.current?.architectural_reset_from?.version, 26, 'V27 reset source version');
    expect(
      manifest.current?.architectural_reset_from?.terminal_state,
      'stagnated',
      'V27 reset source state',
    );
    expect(manifest.current?.architectural_reset_from?.final_iteration, 3, 'V26 final iteration');
    expect(
      manifest.current?.architectural_reset_from?.provenance?.result_sha256,
      '2643b16921017de46573bd4d92ae08dc8a7e7303b07ff094dc798a239b61e1ae',
      'V26 terminal result hash',
    );
    expect(
      manifest.current?.required_confirmation_after_primary_pass?.status,
      'planned_not_predeclared',
      'V27 confirmation status',
    );
    expect(
      manifest.current?.required_confirmation_after_primary_pass?.seed_status,
      'not_reserved',
      'V27 confirmation seed status',
    );
    expect(workingScreen.jointPerformanceGeneration, true, 'V27 joint-performance generation');
    expect(workingScreen.iteration2Change?.status, 'predeclared', 'V27 iteration 2 change status');
    expect(
      workingScreen.iteration2Change?.bounded_change_owner,
      'speaking_prompt',
      'V27 iteration 2 bounded change owner',
    );
    expectJson(
      workingScreen.iteration2Change?.target_failure_clusters,
      [
        'jointPerformanceGenerationAudit:slot_exceeds_word_target',
        'jointPerformanceGenerationPrompt:v2_axis_ownership_conflict',
      ],
      'V27 iteration 2 target clusters',
    );
    expectJson(
      workingScreen.iteration2Change?.speaking_changes,
      ['three_word_drafting_cushion', 'compiled_v2_axis_ownership_compatibility'],
      'V27 iteration 2 speaking changes',
    );
    expectJson(
      workingScreen.iteration2Change?.compiled_v2_axis_ownership_compatibility?.permitted_instruction_sources,
      ['stance_definition', 'safe_fallback'],
      'V27 iteration 2 stance instruction sources',
    );
    expect(
      workingScreen.iteration2Change?.compiled_v2_axis_ownership_compatibility?.registry_field,
      'joint_performance_stance_contract',
      'V27 iteration 2 stance registry field',
    );
    expect(
      workingScreen.iteration2Change?.compiled_v2_axis_ownership_compatibility?.loader,
      'getJointPerformanceStanceContract',
      'V27 iteration 2 stance contract loader',
    );
    expect(
      workingScreen.iteration2Change?.compiled_v2_axis_ownership_compatibility?.host_plan_instruction_field,
      'slots.performance.stance_instruction',
      'V27 iteration 2 host-plan stance field',
    );
    expect(
      workingScreen.iteration2Change?.compiled_v2_axis_ownership_compatibility?.host_plan_source_field,
      'slots.performance.stance_instruction_source',
      'V27 iteration 2 host-plan stance source field',
    );
    expectJson(
      workingScreen.iteration2Change?.compiled_v2_axis_ownership_compatibility?.performance_response_owns,
      ['advocate_testability', 'action_neutral_stance_distinction'],
      'V27 iteration 2 performance-response ownership',
    );
    expectJson(
      workingScreen.iteration2Change?.compiled_v2_axis_ownership_compatibility?.performance_forbids,
      ['concrete_check_or_move'],
      'V27 iteration 2 performance exclusions',
    );
    expectJson(
      workingScreen.iteration2Change?.compiled_v2_axis_ownership_compatibility?.handoff_owns,
      ['concrete_check_or_move'],
      'V27 iteration 2 handoff ownership',
    );
    expect(workingScreen.iteration2Change?.recovery_change, 'none', 'V27 iteration 2 recovery change');
    expect(
      workingScreen.iteration2Change?.audit_recognition_change,
      'none',
      'V27 iteration 2 audit-recognition change',
    );
    expect(workingScreen.iteration3Change?.status, 'predeclared', 'V27 iteration 3 change status');
    expect(
      workingScreen.iteration3Change?.bounded_change_owner,
      'audit_recognition',
      'V27 iteration 3 bounded change owner',
    );
    expectJson(
      workingScreen.iteration3Change?.target_failure_clusters,
      [
        'actorialRealizationAudit:missing_selected_actorial_part',
        'jointPerformanceAudit:axis_not_realized_in_owner:actorial_part',
      ],
      'V27 iteration 3 target clusters',
    );
    expectJson(workingScreen.iteration3Change?.speaking_changes, [], 'V27 iteration 3 speaking changes');
    expectJson(workingScreen.iteration3Change?.recovery_changes, [], 'V27 iteration 3 recovery changes');
    expectJson(
      workingScreen.iteration3Change?.audit_recognition_changes,
      ['typed_composite_part_ownership'],
      'V27 iteration 3 audit-recognition changes',
    );
    expectJson(
      workingScreen.iteration3Change?.phrase_level_recognition_changes,
      [],
      'V27 iteration 3 phrase-level recognition changes',
    );
    const composite = workingScreen.iteration3Change?.typed_composite_part_ownership || {};
    expect(composite.joint_audit_field, 'compositePartOwnership', 'V27 iteration 3 joint audit field');
    expect(composite.mode, 'delegated_complement', 'V27 iteration 3 composite mode');
    expect(
      composite.contract_schema_constant,
      'TUTOR_STUB_COMPOSITE_PART_OWNERSHIP_SCHEMA',
      'V27 iteration 3 composite contract schema',
    );
    expect(
      composite.audit_schema_constant,
      'TUTOR_STUB_COMPOSITE_PART_OWNERSHIP_AUDIT_SCHEMA',
      'V27 iteration 3 composite audit schema',
    );
    const expectedRequirements = {
      performance_initiation: { owner: 'performance', slots: ['performance_entry'], required: true },
      performance_action_absent: {
        owner: 'performance',
        slots: ['performance_entry', 'performance_response'],
        required: true,
      },
      handoff_relevant_delegated_complement: { owner: 'handoff', slots: ['handoff'], required: true },
      handoff_selected_action: { owner: 'handoff', slots: ['handoff'], required: true },
    };
    expectJson(composite.requirements, expectedRequirements, 'V27 iteration 3 composite requirements');
    expect(
      composite.excluded_span_reporting?.field,
      'excluded_span_ids',
      'V27 iteration 3 excluded-span report field',
    );
    expect(
      composite.excluded_span_reporting?.require_host_source_excluded,
      true,
      'V27 iteration 3 host source exclusion',
    );
    expect(
      composite.excluded_span_reporting?.source_owner,
      'host',
      'V27 iteration 3 source owner',
    );
    expect(
      composite.linkage_reporting?.field,
      'linkage.shared_content_tokens',
      'V27 iteration 3 linkage report field',
    );
    expect(
      composite.linkage_reporting?.require_nonempty,
      true,
      'V27 iteration 3 relevant complement linkage',
    );
    expect(composite.delivery_gates_changed, false, 'V27 iteration 3 delivery gate change');
    expect(workingScreen.iteration4Change?.status, 'predeclared', 'V27 iteration 4 change status');
    expect(
      workingScreen.iteration4Change?.bounded_change_owner,
      'transport',
      'V27 iteration 4 bounded change owner',
    );
    expectJson(
      workingScreen.iteration4Change?.target_failure_clusters,
      ['jointPerformanceGenerationAudit:slot_has_outer_whitespace'],
      'V27 iteration 4 target clusters',
    );
    expectJson(workingScreen.iteration4Change?.speaking_changes, [], 'V27 iteration 4 speaking changes');
    expectJson(workingScreen.iteration4Change?.recovery_changes, [], 'V27 iteration 4 recovery changes');
    expectJson(
      workingScreen.iteration4Change?.audit_recognition_changes,
      [],
      'V27 iteration 4 audit-recognition changes',
    );
    expectJson(
      workingScreen.iteration4Change?.transport_changes,
      ['trim_outer_slot_whitespace'],
      'V27 iteration 4 transport changes',
    );
    const transport = workingScreen.iteration4Change?.outer_slot_whitespace_canonicalization || {};
    expect(transport.input_scope, 'decoded_model_owned_slot_strings', 'V27 iteration 4 transport input');
    expectJson(
      transport.slot_ids,
      ['uptake', 'performance.entry', 'performance.response', 'handoff'],
      'V27 iteration 4 transport slots',
    );
    expect(transport.operation, 'trim_outer_whitespace_only', 'V27 iteration 4 transport operation');
    expect(transport.preserve_internal_whitespace, true, 'V27 iteration 4 internal whitespace');
    expect(transport.preserve_semantic_content, true, 'V27 iteration 4 semantic content');
    expect(transport.preserve_raw_model_output, true, 'V27 iteration 4 raw output');
    expect(transport.preserve_original_candidate_provenance, true, 'V27 iteration 4 candidate provenance');
    expect(transport.reporting?.field, 'transportCanonicalization', 'V27 iteration 4 report field');
    expect(transport.reporting?.applied_field, 'applied', 'V27 iteration 4 applied report');
    expect(
      transport.reporting?.canonicalized_slot_ids_field,
      'canonicalized_slot_ids',
      'V27 iteration 4 slot report',
    );
    expect(
      transport.reporting?.classification,
      'transport_canonicalization',
      'V27 iteration 4 report classification',
    );
    expectJson(
      transport.reporting?.separate_from,
      [
        'mechanical_repair',
        'model_rewrite',
        'deterministic_fallback',
        'semantic_recognition_correction',
        'configuration_realization',
      ],
      'V27 iteration 4 separate accounting',
    );
    expectJson(
      transport.unchanged_contracts,
      {
        safety_audits: true,
        semantic_audits: true,
        response_configuration_audit: true,
        source_ownership_audit: true,
        strict_delivery_gates: true,
      },
      'V27 iteration 4 unchanged contracts',
    );
    if (seeds.development.length !== 1 || Number(seeds.development[0]?.seed) !== 20261500) {
      throw new Error('V27 must predeclare only development seed 20261500');
    }
    expect(
      seeds.development[0]?.status,
      'reusable_non_held_out_development',
      'V27 development seed status',
    );
    const retiredV26Statuses = new Map([
      [20261400, 'consumed_development_retired_after_stagnation'],
      [20261401, 'retired_unstarted_due_to_stagnation'],
      [20261402, 'retired_unstarted_due_to_stagnation'],
      [20261403, 'retired_unstarted_due_to_stagnation'],
      [20261404, 'retired_unstarted_due_to_stagnation'],
    ]);
    for (const [seed, status] of retiredV26Statuses) {
      const retired = seeds.historical.find((entry) => Number(entry.seed) === seed);
      if (!retired || retired.status !== status) {
        throw new Error(`V27 history must preserve retired V26 seed ${seed}`);
      }
    }
  }

  if (state.currentState === 'stagnated') {
    expect(
      workingScreen.finalFrontierAttemptIteration,
      workingIteration,
      'terminal final-frontier attempt iteration',
    );
    expect(
      workingScreen.stopIfFinalFrontierAttemptFails,
      true,
      'terminal failed final-frontier stop',
    );
    expect(
      manifest.current?.last_observation?.final_frontier_attempt?.outcome,
      'failed',
      'terminal final-frontier outcome',
    );
    expect(
      manifest.current?.last_observation?.final_frontier_attempt?.speaking_change,
      'none',
      'terminal final-frontier speaking change',
    );
    expect(
      manifest.current?.last_observation?.final_frontier_attempt?.recovery_change,
      'none',
      'terminal final-frontier recovery change',
    );
    expect(
      manifest.current?.last_observation?.final_frontier_attempt?.audit_recognition_change,
      'none',
      'terminal final-frontier audit-recognition change',
    );
  }

  const iterationAuthority =
    manifest.current?.last_observation?.[`iteration_${workingIteration}_authority`];
  if (iterationAuthority?.attempt === 'final_frontier_attempt') {
    expect(
      workingScreen.finalFrontierAttemptIteration,
      workingIteration,
      'working-screen final-frontier attempt iteration',
    );
    expect(
      workingScreen.stopIfFinalFrontierAttemptFails,
      true,
      'working-screen failed final-frontier stop',
    );
    expect(iterationAuthority.speaking_change, 'none', 'final-frontier speaking change');
    expect(iterationAuthority.recovery_change, 'none', 'final-frontier recovery change');
    expect(
      iterationAuthority.audit_recognition_change,
      'none',
      'final-frontier audit-recognition change',
    );
  }

  expect(manifest.stop_policy?.stagnation?.maximum_consecutive_iterations_without_improvement, 2, 'stagnation limit');
  expect(manifest.stop_policy?.stagnation?.terminal_state, 'stagnated', 'stagnation terminal state');
  expect(manifest.stop_policy?.success?.terminal_state, 'accepted', 'success terminal state');
  expect(
    manifest.stop_policy?.infrastructure?.terminal_state,
    'blocked_infrastructure',
    'infrastructure terminal state',
  );
  expect(
    manifest.stop_policy?.acceptance_failure?.terminal_state,
    'retired_after_acceptance_failure',
    'acceptance-failure state',
  );
  if (
    !(manifest.stop_policy?.stagnation?.measurable_improvement_order || []).includes(
      'higher mean configuration realization',
    )
  ) {
    throw new Error('stagnation policy must count higher mean configuration realization as improvement');
  }

  return {
    schema: TUTOR_STUB_FIRST_DRAFT_OUTER_LOOP_SCHEMA,
    id,
    valid: true,
    currentVersion,
    currentState: state.currentState,
    workingIteration,
    terminalScope: state.states[state.currentState].terminal_scope,
    outcome: state.states[state.currentState].outcome,
    acceptancePredeclared: Boolean(manifest.current.acceptance_config),
    roles: roles.map((role) => role.id),
    seedCounts: {
      historical: seeds.historical.length,
      development: seeds.development.length,
      heldOut: seeds.heldOut.length,
      reserve: seeds.reserves.length,
    },
    workingScreen,
  };
}

export function summarizeTutorStubFirstDraftOuterLoop({ manifest, root = process.cwd() } = {}) {
  const validation = validateTutorStubFirstDraftOuterLoop({ manifest, root });
  const states = manifest.state_machine.states;
  const next = manifest.state_machine.transitions
    .filter((transition) => transition.from === validation.currentState)
    .map((transition) => ({
      state: transition.to,
      terminalScope: states[transition.to].terminal_scope,
      when: transition.when,
      versionAction: transition.version_action || 'none',
    }));
  return {
    ...validation,
    generatedAt: new Date().toISOString(),
    makesModelCalls: false,
    label: manifest.current.label,
    workingIteration: Number(manifest.current.working_iteration || 1),
    heldOutMatrixStatus: manifest.seed_ledger.held_out.status,
    reserveSeedStatus: manifest.seed_ledger.reserve.status,
    developmentSeeds: manifest.seed_ledger.development.map((entry) => ({
      seed: Number(entry.seed),
      cell: entry.cell,
      status: entry.status,
    })),
    next,
  };
}
