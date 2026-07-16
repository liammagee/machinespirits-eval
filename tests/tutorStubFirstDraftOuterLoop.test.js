import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import YAML from 'yaml';

import {
  summarizeTutorStubFirstDraftOuterLoop,
  validateTutorStubFirstDraftOuterLoop,
} from '../services/tutorStubFirstDraftOuterLoop.js';
import {
  TUTOR_STUB_JOINT_PERFORMANCE_AUDIT_SCHEMA,
  TUTOR_STUB_JOINT_PERFORMANCE_COMPOSITION_SCHEMA,
  TUTOR_STUB_JOINT_PERFORMANCE_FIRST_DRAFT_SCHEMA,
} from '../services/tutorStubJointPerformanceFirstDraft.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = path.join(ROOT, 'config', 'tutor-stub-campaigns', 'first-draft-outer-loop-v1.yaml');
const SCREEN_PATH = path.join(ROOT, 'config', 'tutor-stub-campaigns', 'first-draft-working-screens-v6.yaml');

function loadYaml(filePath) {
  return YAML.parse(fs.readFileSync(filePath, 'utf8'));
}

function fixture(tmp) {
  const manifest = loadYaml(MANIFEST_PATH);
  const screen = loadYaml(SCREEN_PATH);
  const trace = path.join(tmp, 'v23-source.jsonl');
  const auditFixture = path.join(tmp, 'audit-fixture.json');
  fs.writeFileSync(trace, '{}\n');
  fs.writeFileSync(auditFixture, '{}\n');
  screen.matrix[0].source_trace = trace;
  screen.preflight.model_free_fixtures = [auditFixture];
  screen.artifacts.root = path.join(tmp, 'artifacts');
  const screenPath = path.join(tmp, 'working-screen.yaml');
  fs.writeFileSync(screenPath, YAML.stringify(screen));
  manifest.current.working_screen_config = screenPath;
  return { manifest, screen, screenPath };
}

test('outer-loop manifest validates the predeclared V27 iteration-3 joint-performance screen', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-loop-'));
  try {
    const { manifest } = fixture(tmp);
    const validation = validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp });
    assert.equal(validation.valid, true);
    assert.equal(validation.currentVersion, 27);
    assert.equal(validation.currentState, 'working_predeclared');
    assert.equal(validation.workingIteration, 3);
    assert.equal(validation.terminalScope, 'none');
    assert.equal(validation.outcome, 'pending');
    assert.equal(validation.acceptancePredeclared, false);
    assert.deepEqual(validation.workingScreen.turns, [4, 5, 6, 9]);
    assert.equal(validation.workingScreen.developmentSeed, 20261500);
    assert.equal(validation.workingScreen.jointPerformanceGeneration, true);
    assert.equal(
      validation.workingScreen.jointPerformanceSchema,
      TUTOR_STUB_JOINT_PERFORMANCE_FIRST_DRAFT_SCHEMA,
    );
    assert.equal(
      validation.workingScreen.jointPerformanceCompositionSchema,
      TUTOR_STUB_JOINT_PERFORMANCE_COMPOSITION_SCHEMA,
    );
    assert.equal(
      validation.workingScreen.jointPerformanceAuditSchema,
      TUTOR_STUB_JOINT_PERFORMANCE_AUDIT_SCHEMA,
    );
    assert.deepEqual(validation.seedCounts, {
      historical: 19,
      development: 1,
      heldOut: 0,
      reserve: 0,
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('outer-loop status exposes only the predeclared V27 working transition and makes no model call', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-status-'));
  try {
    const { manifest } = fixture(tmp);
    const status = summarizeTutorStubFirstDraftOuterLoop({ manifest, root: tmp });
    assert.equal(status.makesModelCalls, false);
    assert.equal(status.label, 'V27');
    assert.equal(status.workingIteration, 3);
    assert.equal(status.heldOutMatrixStatus, 'not_predeclared');
    assert.deepEqual(status.developmentSeeds, [
      {
        seed: 20261500,
        cell: 'marrick_v27_joint_performance',
        status: 'reusable_non_held_out_development',
      },
    ]);
    assert.deepEqual(
      status.next.map((transition) => transition.state),
      ['working_running'],
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('V27 preserves exact V26 terminal provenance and retires all V26 labels', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-v26-evidence-'));
  try {
    const { manifest } = fixture(tmp);
    const reset = manifest.current.architectural_reset_from;
    assert.equal(reset.version, 26);
    assert.equal(reset.terminal_state, 'stagnated');
    assert.equal(reset.final_iteration, 3);
    assert.equal(reset.result_artifact, '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v5/iteration-3/working-screen-result.json');
    assert.equal(reset.development_seed, 20261400);
    assert.equal(reset.seed_disposition, 'consumed_development_retired_after_stagnation');
    assert.equal(reset.run_head, '6f41a8d602539d7811342a218d8213a49e737146');
    assert.equal(reset.provenance.working_screen_config_sha256, '35193154149780818e5aa684dc980c2d6f017166928bd123134c7fc8d7fd4802');
    assert.equal(reset.provenance.source_trace_sha256, 'b6d98928d6042485895fe1e958044d6303f7c600512593876c6c1acd630f127a');
    assert.equal(reset.provenance.campaign_validation_sha256, '60d2288e07e5b48170fd719a94d26dabba8556a1e112ef63cd273c5953801891');
    assert.equal(reset.provenance.turn_artifact_sha256, '69f8a539863ff40b6f86a0f76a3244045fd1d51d28ec824efa6f385459f0fc1a');
    assert.equal(reset.provenance.result_sha256, '2643b16921017de46573bd4d92ae08dc8a7e7303b07ff094dc798a239b61e1ae');
    assert.deepEqual(reset.completed_turns, [4]);
    assert.deepEqual(reset.unstarted_turns, [5, 6, 9]);
    assert.equal(reset.strict_originals_accepted, 0);
    assert.equal(reset.valid_structured_outputs, 1);
    assert.equal(reset.structured_slot_ownership_passes, 0);
    assert.equal(reset.exact_source_occurrence_passes, 1);
    assert.equal(reset.mean_configuration_realization, 1);
    assert.equal(reset.mean_original_latency_ms, 8930);
    assert.deepEqual(reset.token_usage, { input: 17578, output: 246, total: 17824 });
    assert.equal(reset.stopping_reason, 'predeclared_final_frontier_attempt_failed');
    assert.deepEqual(reset.retired_unstarted_confirmation_seeds, [20261401, 20261402, 20261403, 20261404]);
    assert.match(reset.reset_reason, /joint semantic unit.*PERFORMANCE ENTRY and RESPONSE/isu);

    const retired = new Map(
      manifest.seed_ledger.historical
        .filter((entry) => entry.version === 26)
        .map((entry) => [entry.seed, entry.status]),
    );
    assert.deepEqual([...retired], [
      [20261400, 'consumed_development_retired_after_stagnation'],
      [20261401, 'retired_unstarted_due_to_stagnation'],
      [20261402, 'retired_unstarted_due_to_stagnation'],
      [20261403, 'retired_unstarted_due_to_stagnation'],
      [20261404, 'retired_unstarted_due_to_stagnation'],
    ]);
    assert.equal(manifest.current.last_observation.version, 27);
    assert.equal(manifest.current.last_observation.working_iteration, 2);
    assert.equal(manifest.current.working_history.length, 2);
    assert.equal(manifest.current.acceptance_config, null);
    assert.equal(manifest.current.required_confirmation_after_primary_pass.seed_status, 'not_reserved');
    assert.equal(JSON.stringify(manifest).includes('20261600'), false);
    assert.equal(validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }).valid, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('V27 preserves the exact iteration-1 result and iteration-2 speaking-prompt change', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-v27-i1-'));
  try {
    const { manifest, screen } = fixture(tmp);
    const observation = manifest.current.working_history[0];
    assert.equal(observation.result_artifact, '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-1/working-screen-result.json');
    assert.equal(observation.run_head, '7fc926a2801f947da056b573a499933dccc71968');
    assert.equal(observation.provenance.campaign_validation_artifact, '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-1/campaign-validation.json');
    assert.equal(observation.provenance.campaign_validation_sha256, 'a7ade2ebce6d67dbfe9babb73bc52d2def9e396dca5b90d278b989e9c3677d07');
    assert.equal(observation.provenance.result_sha256, '970cb051c9335f89ede51d8018002cb90017d42fdbefb79521a7747e6039d435');
    assert.deepEqual(
      observation.provenance.turn_artifacts.map(({ turn, sha256 }) => ({ turn, sha256 })),
      [
        { turn: 4, sha256: '7b18f4e9ecfeb05e95cac828d99d8f76acccbb6773421602980c2b6ba4c1e828' },
        { turn: 5, sha256: '2947ff1d15e921ad228ba7fbbcbaa6b936252d59c2a1766054d8326cfb50bf9f' },
        { turn: 6, sha256: '3a5c1d8b57c9110f2bad39a5e78b2031ac8b108b2287315d418ae1bb6898d1b9' },
      ],
    );
    assert.deepEqual(observation.completed_turns, [4, 5, 6]);
    assert.deepEqual(observation.unstarted_turns, [9]);
    assert.equal(observation.original_candidates_accepted, 2);
    assert.equal(observation.original_candidates_completed, 3);
    assert.equal(observation.original_candidate_acceptance_rate, 0.6666667);
    assert.equal(observation.mean_configuration_realization, 0.6666667);
    assert.equal(observation.final_safety_failures, 0);
    assert.equal(observation.mechanical_repairs, 0);
    assert.equal(observation.model_rewrites, 0);
    assert.equal(observation.deterministic_fallbacks, 0);
    assert.equal(observation.semantic_recognition_corrections, 0);
    assert.equal(observation.mean_original_latency_ms, 8143.6667);
    assert.deepEqual(observation.dominant_failure_clusters, [
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
    ]);
    assert.deepEqual(observation.comparison, {
      comparison_available: false,
      measurable_improvement: null,
      consecutive_without_improvement: 0,
      stop: false,
      reason: 'first_measured_iteration',
    });
    assert.equal(manifest.seed_ledger.development[0].seed, 20261500);
    assert.equal(manifest.seed_ledger.development[0].status, 'reusable_non_held_out_development');
    assert.deepEqual(screen.change_log.iteration_2, {
      status: 'predeclared',
      bounded_change_owner: 'speaking_prompt',
      target_failure_clusters: [
        'jointPerformanceGenerationAudit:slot_exceeds_word_target',
        'jointPerformanceGenerationPrompt:v2_axis_ownership_conflict',
      ],
      speaking_changes: ['three_word_drafting_cushion', 'compiled_v2_axis_ownership_compatibility'],
      compiled_v2_axis_ownership_compatibility: {
        registry_field: 'joint_performance_stance_contract',
        loader: 'getJointPerformanceStanceContract',
        host_plan_instruction_field: 'slots.performance.stance_instruction',
        host_plan_source_field: 'slots.performance.stance_instruction_source',
        permitted_instruction_sources: ['stance_definition', 'safe_fallback'],
        performance_response_owns: ['advocate_testability', 'action_neutral_stance_distinction'],
        performance_forbids: ['concrete_check_or_move'],
        handoff_owns: ['concrete_check_or_move'],
      },
      recovery_change: 'none',
      audit_recognition_change: 'none',
    });
    assert.equal(validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }).valid, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('V27 preserves the exact improved iteration-2 result before iteration 3', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-v27-i2-'));
  try {
    const { manifest } = fixture(tmp);
    const observation = manifest.current.working_history[1];
    assert.deepEqual(manifest.current.last_observation, observation);
    assert.equal(observation.result_artifact, '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-2/working-screen-result.json');
    assert.equal(observation.run_head, 'bec13717719be76891bf5ece0c1ae94375cdea9a');
    assert.equal(observation.run_head_provenance, 'launch_log_timeline_confirmed');
    assert.equal(observation.run_head_artifact_embedded, false);
    assert.equal(observation.provenance.working_screen_config_sha256, '4b71da924e17639a800012ed45f7682a1942eac25356bc7d9450715cc2638ea5');
    assert.equal(observation.provenance.source_trace_sha256, 'b6d98928d6042485895fe1e958044d6303f7c600512593876c6c1acd630f127a');
    assert.equal(observation.provenance.campaign_validation_sha256, '7eb96da004326ac21dc0844d23fbf95bb8209bde221e297f47870437946b842d');
    assert.equal(observation.provenance.result_sha256, 'a5788cc7cd8aa68d1e540611b457f04d1590f1e3b5f5692663b7a04da186a4fb');
    assert.deepEqual(
      observation.provenance.turn_artifacts.map(({ turn, sha256 }) => ({ turn, sha256 })),
      [
        { turn: 4, sha256: '1a9eb462a3d638e867d190fecc1ec2cedda434421196ebe896a389f2b6dcdc56' },
        { turn: 5, sha256: 'c3e88048f0e0de30035c148c88b20a14ed9580afeb0b0dc9670fb0aac9f8042d' },
        { turn: 6, sha256: '7257019859d7e62596672f651e34dea63d9d7889e69e3530ece092d60c9465ec' },
      ],
    );
    assert.deepEqual(observation.completed_turns, [4, 5, 6]);
    assert.deepEqual(observation.unstarted_turns, [9]);
    assert.equal(observation.original_candidates_accepted, 2);
    assert.equal(observation.original_candidates_completed, 3);
    assert.equal(observation.original_candidate_acceptance_rate, 0.6666666666666666);
    assert.equal(observation.mean_configuration_realization, 0.9443333333333334);
    assert.equal(observation.valid_joint_performance_outputs, 3);
    assert.equal(observation.joint_performance_output_failures, 0);
    assert.equal(observation.joint_performance_ownership_passes, 2);
    assert.equal(observation.joint_performance_ownership_failures, 1);
    assert.equal(observation.exact_host_source_occurrence_passes, 3);
    assert.equal(observation.exact_host_source_occurrence_failures, 0);
    assert.equal(observation.final_safety_failures, 0);
    assert.equal(observation.mechanical_repairs, 0);
    assert.equal(observation.model_rewrites, 0);
    assert.equal(observation.deterministic_fallbacks, 0);
    assert.equal(observation.semantic_recognition_corrections, 0);
    assert.equal(observation.mean_original_latency_ms, 8973.666666666666);
    assert.deepEqual(observation.token_usage, { input: 50101, output: 724, total: 50825 });
    assert.deepEqual(observation.dominant_failure_clusters, [
      { cluster: 'actorialRealizationAudit:missing_selected_actorial_part', count: 1 },
      { cluster: 'jointPerformanceAudit:axis_not_realized_in_owner:actorial_part', count: 1 },
    ]);
    assert.deepEqual(observation.comparison, {
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
    });
    assert.equal(validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }).valid, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('V27 iteration 3 predeclares only typed composite-part audit recognition', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-v27-i3-'));
  try {
    const { manifest, screen } = fixture(tmp);
    assert.deepEqual(screen.change_log.iteration_3, {
      status: 'predeclared',
      bounded_change_owner: 'audit_recognition',
      target_failure_clusters: [
        'actorialRealizationAudit:missing_selected_actorial_part',
        'jointPerformanceAudit:axis_not_realized_in_owner:actorial_part',
      ],
      speaking_changes: [],
      recovery_changes: [],
      audit_recognition_changes: ['typed_composite_part_ownership'],
      phrase_level_recognition_changes: [],
      typed_composite_part_ownership: {
        joint_audit_field: 'compositePartOwnership',
        mode: 'delegated_complement',
        contract_schema_constant: 'TUTOR_STUB_COMPOSITE_PART_OWNERSHIP_SCHEMA',
        audit_schema_constant: 'TUTOR_STUB_COMPOSITE_PART_OWNERSHIP_AUDIT_SCHEMA',
        requirements: {
          performance_initiation: { owner: 'performance', slots: ['performance_entry'], required: true },
          performance_action_absent: {
            owner: 'performance',
            slots: ['performance_entry', 'performance_response'],
            required: true,
          },
          handoff_relevant_delegated_complement: {
            owner: 'handoff',
            slots: ['handoff'],
            required: true,
          },
          handoff_selected_action: { owner: 'handoff', slots: ['handoff'], required: true },
        },
        excluded_span_reporting: {
          field: 'excluded_span_ids',
          require_host_source_excluded: true,
          source_owner: 'host',
        },
        linkage_reporting: {
          field: 'linkage.shared_content_tokens',
          require_nonempty: true,
        },
        delivery_gates_changed: false,
      },
    });
    assert.match(screen.change_log.speaking_prompt, /Iteration 3 makes no speaking-prompt change/iu);
    assert.match(screen.change_log.recovery_only, /unchanged in iteration 3/iu);
    assert.match(screen.change_log.audit_recognition_only, /changes only deterministic audit recognition/iu);
    assert.equal(manifest.seed_ledger.development[0].seed, 20261500);
    assert.equal(manifest.seed_ledger.development[0].status, 'reusable_non_held_out_development');
    assert.equal(validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }).valid, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('outer-loop validator fails closed on V27 history, iteration-2 evidence, or iteration-3 scope drift', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-v27-i1-drift-'));
  try {
    const mutations = [
      ({ manifest }) => { manifest.current.working_iteration = 2; },
      ({ manifest }) => { manifest.current.working_history = []; },
      ({ manifest }) => { manifest.current.last_observation.provenance.result_sha256 = 'wrong'; },
      ({ manifest }) => { manifest.current.last_observation.run_head_provenance = 'artifact_embedded'; },
      ({ manifest }) => { manifest.current.last_observation.unstarted_turns = []; },
      ({ manifest }) => { manifest.current.last_observation.original_candidates_accepted = 3; },
      ({ manifest }) => { manifest.current.last_observation.mean_configuration_realization = 1; },
      ({ manifest }) => { manifest.current.last_observation.final_safety_failures = 1; },
      ({ manifest }) => { manifest.current.last_observation.dominant_failure_clusters[0].cluster = 'other'; },
      ({ manifest }) => { manifest.current.last_observation.comparison.stop = true; },
      ({ manifest }) => { manifest.seed_ledger.development[0].status = 'consumed_and_not_reusable'; },
      ({ screen }) => { screen.change_log.iteration_3.speaking_changes = ['changed']; },
      ({ screen }) => { screen.change_log.iteration_3.recovery_changes = ['changed']; },
      ({ screen }) => { screen.change_log.iteration_3.target_failure_clusters.push('unrelated'); },
      ({ screen }) => { screen.change_log.iteration_3.phrase_level_recognition_changes = ['widen_regex']; },
      ({ screen }) => { screen.change_log.iteration_3.typed_composite_part_ownership.requirements.performance_initiation.owner = 'handoff'; },
      ({ screen }) => { screen.change_log.iteration_3.typed_composite_part_ownership.requirements.handoff_relevant_delegated_complement.required = false; },
      ({ screen }) => { screen.change_log.iteration_3.typed_composite_part_ownership.excluded_span_reporting.require_host_source_excluded = false; },
      ({ screen }) => { screen.change_log.iteration_3.typed_composite_part_ownership.linkage_reporting.require_nonempty = false; },
      ({ screen }) => { screen.change_log.iteration_3.typed_composite_part_ownership.delivery_gates_changed = true; },
    ];
    for (const mutate of mutations) {
      const item = fixture(tmp);
      mutate(item);
      fs.writeFileSync(item.screenPath, YAML.stringify(item.screen));
      assert.throws(
        () => validateTutorStubFirstDraftOuterLoop({ manifest: item.manifest, root: tmp }),
        /V27|working iteration|working history|last working observation|last observation|development seed|conservative|recovery|audit-recognition/iu,
      );
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('outer-loop validator rejects version jumps and missing Vn to Vn+1 discipline', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-version-'));
  try {
    const { manifest } = fixture(tmp);
    manifest.versioning.next = 29;
    assert.throws(() => validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }), /versioning next must be 28/u);
    manifest.versioning.next = 28;
    manifest.versioning.examples[1].to = 29;
    assert.throws(
      () => validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }),
      /version example must increment by one/u,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('outer-loop validator rejects held-out seeds before acceptance predeclaration', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-seed-'));
  try {
    const { manifest } = fixture(tmp);
    manifest.seed_ledger.held_out.entries.push({ seed: 20261510, status: 'unconsumed_held_out' });
    assert.throws(
      () => validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }),
      /held-out and reserve seeds must remain empty/u,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('outer-loop validator binds only fresh V27 development label 20261500', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-development-seed-'));
  try {
    const { manifest } = fixture(tmp);
    manifest.seed_ledger.development[0].status = 'consumed_and_not_reusable';
    assert.throws(
      () => validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }),
      /development seed 20261500 has unsupported status consumed_and_not_reusable/u,
    );

    const duplicate = fixture(tmp);
    duplicate.manifest.seed_ledger.development.push({
      seed: 20261501,
      status: 'reusable_non_held_out_development',
      cell: 'another',
    });
    assert.throws(
      () => validateTutorStubFirstDraftOuterLoop({ manifest: duplicate.manifest, root: tmp }),
      /V27 must predeclare only development seed 20261500/u,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('outer-loop validator keeps V27 at four strict originals and full configuration realization', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-gate-'));
  try {
    const { manifest, screen, screenPath } = fixture(tmp);
    screen.gates_per_cell.required_originals_accepted = 3;
    fs.writeFileSync(screenPath, YAML.stringify(screen));
    assert.throws(
      () => validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }),
      /working screen required originals must be 4/u,
    );
    screen.gates_per_cell.required_originals_accepted = 4;
    screen.gates_per_cell.minimum_mean_configuration_realization = 0.9;
    fs.writeFileSync(screenPath, YAML.stringify(screen));
    assert.throws(
      () => validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }),
      /working screen configuration realization must be 1/u,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('outer-loop validator fails closed on V27 joint flag, schema, and gate drift', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-joint-'));
  try {
    const mutations = [
      (screen) => { screen.fixed_configuration.joint_performance_generation = false; },
      (screen) => { delete screen.fixed_configuration.joint_performance_schema; },
      (screen) => { delete screen.fixed_configuration.joint_performance_composition_schema; },
      (screen) => { delete screen.fixed_configuration.joint_performance_audit_schema; },
      (screen) => { delete screen.gates_per_cell.require_joint_performance_output; },
      (screen) => { delete screen.gates_per_cell.require_joint_performance_ownership; },
      (screen) => { delete screen.gates_per_cell.require_exact_host_source_occurrences; },
    ];
    for (const mutate of mutations) {
      const { manifest, screen, screenPath } = fixture(tmp);
      mutate(screen);
      fs.writeFileSync(screenPath, YAML.stringify(screen));
      assert.throws(
        () => validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }),
        /joint-performance|joint performance|V27 joint-performance/iu,
      );
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('outer-loop validator preserves the V26-to-V27 architectural transition', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-reset-'));
  try {
    for (const mutate of [
      (manifest) => { manifest.current.architectural_reset_from.version = 25; },
      (manifest) => { manifest.current.architectural_reset_from.terminal_state = 'accepted'; },
      (manifest) => { manifest.current.architectural_reset_from.provenance.result_sha256 = 'wrong'; },
      (manifest) => { manifest.current.required_confirmation_after_primary_pass.seed_status = 'reserved'; },
      (manifest) => { manifest.current.working_history.push({ working_iteration: 1 }); },
    ]) {
      const { manifest } = fixture(tmp);
      mutate(manifest);
      assert.throws(
        () => validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }),
        /V27|V26 terminal|working history|confirmation seed/iu,
      );
    }
    const { manifest } = fixture(tmp);
    const resetTransition = manifest.state_machine.transitions.find(
      (transition) => transition.from === 'stagnated' && transition.to === 'working_predeclared',
    );
    assert.equal(resetTransition.version_action, 'increment_by_one');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('tracked V6 screen applies the V27 joint-performance plan to four Marrick turns', () => {
  const screen = loadYaml(SCREEN_PATH);
  assert.equal(screen.id, 'first-draft-working-screens-v6');
  assert.equal(screen.held_out, false);
  assert.equal(screen.fixed_configuration.original_only, true);
  assert.equal(screen.fixed_configuration.draws_per_turn, 1);
  assert.equal(screen.fixed_configuration.joint_performance_generation, true);
  assert.equal(screen.fixed_configuration.structured_generation, undefined);
  assert.equal(screen.fixed_configuration.joint_performance_schema, TUTOR_STUB_JOINT_PERFORMANCE_FIRST_DRAFT_SCHEMA);
  assert.equal(screen.fixed_configuration.joint_performance_composition_schema, TUTOR_STUB_JOINT_PERFORMANCE_COMPOSITION_SCHEMA);
  assert.equal(screen.fixed_configuration.joint_performance_audit_schema, TUTOR_STUB_JOINT_PERFORMANCE_AUDIT_SCHEMA);
  assert.equal(screen.matrix.length, 1);
  assert.deepEqual(screen.matrix[0].turns, [4, 5, 6, 9]);
  assert.equal(screen.matrix[0].development_seed, 20261500);
  assert.equal(screen.gates_per_cell.required_originals_accepted, 4);
  assert.equal(screen.gates_per_cell.minimum_mean_configuration_realization, 1);
  assert.equal(screen.gates_per_cell.configuration_realization_enforcement, 'gate');
  assert.equal(screen.gates_per_cell.maximum_safety_failures, 0);
  assert.equal(screen.gates_per_cell.maximum_fallbacks, 0);
  assert.equal(screen.gates_per_cell.require_transcript_specific_uptake, true);
  assert.equal(screen.gates_per_cell.require_joint_performance_output, true);
  assert.equal(screen.gates_per_cell.require_joint_performance_ownership, true);
  assert.equal(screen.gates_per_cell.require_exact_host_source_occurrences, true);
  assert.match(screen.preflight.focused_tests, /tutorStubJointPerformanceFirstDraft\.test\.js/u);
  assert.match(screen.preflight.focused_tests, /tutorStubV27JointPerformanceCalibration\.test\.js/u);
  assert.match(screen.preflight.focused_tests, /tutorStubTypedCompositeAdvocateCalibration\.test\.js/u);
  assert.equal(
    screen.preflight.model_free_fixtures.includes(
      'tests/fixtures/tutor-stub-typed-composite-advocate.json',
    ),
    false,
  );
  assert.match(screen.change_log.structured_contract, /PERFORMANCE object.*ENTRY and RESPONSE/isu);
  assert.match(screen.change_log.speaking_prompt, /Iteration 3 makes no speaking-prompt change/iu);
  assert.match(screen.change_log.recovery_only, /unchanged in iteration 3/iu);
  assert.match(screen.change_log.audit_recognition_only, /changes only deterministic audit recognition/iu);
  assert.deepEqual(screen.change_log.iteration_2, {
    status: 'predeclared',
    bounded_change_owner: 'speaking_prompt',
    target_failure_clusters: [
      'jointPerformanceGenerationAudit:slot_exceeds_word_target',
      'jointPerformanceGenerationPrompt:v2_axis_ownership_conflict',
  ],
    speaking_changes: ['three_word_drafting_cushion', 'compiled_v2_axis_ownership_compatibility'],
    compiled_v2_axis_ownership_compatibility: {
      registry_field: 'joint_performance_stance_contract',
      loader: 'getJointPerformanceStanceContract',
      host_plan_instruction_field: 'slots.performance.stance_instruction',
      host_plan_source_field: 'slots.performance.stance_instruction_source',
      permitted_instruction_sources: ['stance_definition', 'safe_fallback'],
      performance_response_owns: ['advocate_testability', 'action_neutral_stance_distinction'],
      performance_forbids: ['concrete_check_or_move'],
      handoff_owns: ['concrete_check_or_move'],
    },
    recovery_change: 'none',
    audit_recognition_change: 'none',
  });
  assert.equal(screen.change_log.iteration_3.bounded_change_owner, 'audit_recognition');
  assert.deepEqual(screen.change_log.iteration_3.speaking_changes, []);
  assert.deepEqual(screen.change_log.iteration_3.recovery_changes, []);
  assert.deepEqual(screen.change_log.iteration_3.audit_recognition_changes, [
    'typed_composite_part_ownership',
  ]);
  assert.equal(
    screen.change_log.iteration_3.typed_composite_part_ownership.mode,
    'delegated_complement',
  );
});
