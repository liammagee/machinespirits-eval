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
const PRIMARY_SCREEN_PATH = path.join(ROOT, 'config', 'tutor-stub-campaigns', 'first-draft-working-screens-v6.yaml');
const SCREEN_PATH = path.join(ROOT, 'config', 'tutor-stub-campaigns', 'first-draft-working-screens-v7.yaml');
const V28_SCREEN_PATH = path.join(ROOT, 'config', 'tutor-stub-campaigns', 'first-draft-working-screens-v8.yaml');

function loadYaml(filePath) {
  return YAML.parse(fs.readFileSync(filePath, 'utf8'));
}

function fixture(tmp) {
  const manifest = loadYaml(MANIFEST_PATH);
  const screen = loadYaml(SCREEN_PATH);
  const primaryScreen = loadYaml(PRIMARY_SCREEN_PATH);
  const auditFixture = path.join(tmp, 'audit-fixture.json');
  fs.writeFileSync(auditFixture, '{}\n');
  screen.preflight.model_free_fixtures = [auditFixture];
  screen.artifacts.root = path.join(tmp, 'artifacts');
  const screenPath = path.join(tmp, 'working-screen.yaml');
  const primaryScreenPath = path.join(tmp, 'primary-working-screen.yaml');
  fs.writeFileSync(screenPath, YAML.stringify(screen));
  fs.writeFileSync(primaryScreenPath, YAML.stringify(primaryScreen));
  manifest.current.working_screen_config = screenPath;
  manifest.current.primary_working_screen_config = primaryScreenPath;
  manifest.current.campaign_version = 27;
  manifest.current.label = 'V27';
  manifest.current.working_iteration = 8;
  manifest.current.working_screen_id = 'first-draft-working-screens-v7';
  manifest.current.primary_working_screen_id = 'first-draft-working-screens-v6';
  manifest.current.required_confirmation_after_primary_pass = manifest.current.prior_version_confirmation;
  manifest.current.pre_model_attempts = manifest.current.prior_version_pre_model_attempts;
  manifest.current.working_history = manifest.current.prior_version_working_history;
  manifest.current.last_observation = manifest.current.prior_version_last_primary_observation;
  manifest.current.architectural_reset_from = manifest.current.v27_architectural_reset_from;
  manifest.current.required_confirmation_after_primary_pass.status = 'predeclared';
  manifest.current.required_confirmation_after_primary_pass.seed_status = 'reusable_non_held_out_development';
  manifest.versioning.current = 27;
  manifest.versioning.next = 28;
  manifest.seed_ledger.historical = manifest.seed_ledger.historical
    .filter((entry) => Number(entry.version) !== 27);
  manifest.seed_ledger.development = [
    { seed: 20261500, status: 'reusable_non_held_out_development', cell: 'marrick_v27_joint_performance', screen: 'first-draft-working-screens-v6' },
    { seed: 20261600, status: 'reusable_non_held_out_development', cell: 'tallow_answer_seeking', screen: 'first-draft-working-screens-v7' },
    { seed: 20261601, status: 'reusable_non_held_out_development', cell: 'ravensmark_affective_resistant', screen: 'first-draft-working-screens-v7' },
    { seed: 20261602, status: 'reusable_non_held_out_development', cell: 'larkspur_premature_closure', screen: 'first-draft-working-screens-v7' },
    { seed: 20261603, status: 'reusable_non_held_out_development', cell: 'foxtrot_diligent', screen: 'first-draft-working-screens-v7' },
  ];
  return { manifest, screen, screenPath, primaryScreen, primaryScreenPath };
}

function v28Fixture(tmp) {
  const manifest = loadYaml(MANIFEST_PATH);
  const screen = loadYaml(V28_SCREEN_PATH);
  const auditFixture = path.join(tmp, 'audit-fixture.json');
  fs.writeFileSync(auditFixture, '{}\n');
  screen.preflight.model_free_fixtures = [auditFixture];
  screen.artifacts.root = path.join(tmp, 'artifacts');
  const screenPath = path.join(tmp, 'v28-working-screen.yaml');
  fs.writeFileSync(screenPath, YAML.stringify(screen));
  manifest.current.working_screen_config = screenPath;
  manifest.current.primary_working_screen_config = screenPath;
  return { manifest, screen, screenPath };
}

test('outer-loop manifest validates the predeclared V27 cross-world confirmation screen', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-loop-'));
  try {
    const { manifest } = fixture(tmp);
    const validation = validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp });
    assert.equal(validation.valid, true);
    assert.equal(validation.currentVersion, 27);
    assert.equal(validation.currentState, 'working_predeclared');
    assert.equal(validation.workingIteration, 8);
    assert.equal(validation.terminalScope, 'none');
    assert.equal(validation.outcome, 'pending');
    assert.equal(validation.acceptancePredeclared, false);
    assert.deepEqual(validation.workingScreen.turns, [5]);
    assert.equal(validation.workingScreen.developmentSeed, 20261600);
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
      development: 5,
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
    assert.equal(status.workingIteration, 8);
    assert.equal(status.heldOutMatrixStatus, 'not_predeclared');
    assert.deepEqual(status.developmentSeeds.map(({ seed }) => seed), [
      20261500, 20261600, 20261601, 20261602, 20261603,
    ]);
    assert.deepEqual(
      status.next.map((transition) => transition.state),
      ['working_running'],
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('outer-loop manifest advances honestly to the predeclared V28 structural screen', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-v28-'));
  try {
    const { manifest } = v28Fixture(tmp);
    const validation = validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp });
    assert.equal(validation.valid, true);
    assert.equal(validation.currentVersion, 28);
    assert.equal(validation.currentState, 'working_predeclared');
    assert.equal(validation.workingIteration, 1);
    assert.equal(validation.workingScreen.id, 'first-draft-working-screens-v8');
    assert.equal(validation.workingScreen.v28StructuralScreen, true);
    assert.equal(validation.workingScreen.jointPerformanceGeneration, true);
    assert.equal(validation.workingScreen.adjudicationPolicy, 'deterministic_only');
    assert.equal(validation.workingScreen.preflightReady, false);
    assert.equal(validation.workingScreen.preflightBlockers.length, 1);
    assert.equal(
      validation.workingScreen.preflightBlockers[0].cellId,
      'ravensmark_affective_resistant',
    );
    assert.equal(
      validation.workingScreen.preflightBlockers[0].sources[0].averageSentenceWords,
      36,
    );
    assert.equal(validation.workingScreen.gates.requireSourceSurfaceAccessibility, true);
    assert.deepEqual(validation.workingScreen.cells.map(({ id, developmentSeed }) => ({
      id, developmentSeed,
    })), [
      { id: 'tallow_answer_seeking', developmentSeed: 20261800 },
      { id: 'ravensmark_affective_resistant', developmentSeed: 20261801 },
      { id: 'larkspur_premature_closure', developmentSeed: 20261802 },
      { id: 'foxtrot_diligent', developmentSeed: 20261803 },
    ]);
    assert.deepEqual(validation.seedCounts, {
      historical: 24,
      development: 4,
      heldOut: 0,
      reserve: 0,
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('V28 preserves the failed V27 confirmation and its exact seed dispositions', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-v28-provenance-'));
  try {
    const { manifest } = v28Fixture(tmp);
    const advance = manifest.current.version_advance_from;
    assert.equal(advance.version, 27);
    assert.equal(advance.final_iteration, 8);
    assert.equal(advance.result_artifact, '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v7/iteration-8/working-screen-result.json');
    assert.equal(advance.provenance.result_sha256, '05783cc988308539b05a6934dfbf7654dba79dc7513bb04b1efdcbfb1539e355');
    assert.equal(advance.provenance.turn_artifact_sha256, '5a5bc1c05a39ad306ecfe6e8db23e8ab549dc2e93462deba0c920479d6ce8a93');
    assert.equal(advance.strict_originals_accepted, 0);
    assert.equal(advance.mean_configuration_realization, 0.833);
    assert.equal(advance.final_safety_failures, 0);
    assert.equal(advance.transcript_specific_uptake_failures, 1);
    assert.equal(advance.joint_performance_ownership_failures, 1);
    assert.deepEqual(advance.seed_dispositions, [
      { seed: 20261500, status: 'consumed_development_retired_on_version_advance' },
      { seed: 20261600, status: 'consumed_development_retired_on_version_advance' },
      { seed: 20261601, status: 'retired_unstarted_due_to_version_advance' },
      { seed: 20261602, status: 'retired_unstarted_due_to_version_advance' },
      { seed: 20261603, status: 'retired_unstarted_due_to_version_advance' },
    ]);
    const everySeed = [
      ...manifest.seed_ledger.historical,
      ...manifest.seed_ledger.development,
      ...manifest.seed_ledger.held_out.entries,
      ...manifest.seed_ledger.reserve.entries,
    ].map(({ seed }) => Number(seed));
    assert.equal(everySeed.some((seed) => seed >= 20261700 && seed <= 20261799), false);
    assert.equal(validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }).valid, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('V28 change control separates structural generation from recognition and leaves strict recovery unchanged', () => {
  const screen = loadYaml(V28_SCREEN_PATH);
  assert.deepEqual(screen.change_control.speaking_prompt_progression_changes, [
    'typed_handoff_contract',
    'cross_slot_progression',
    'typed_turn_focus_relation',
  ]);
  assert.deepEqual(screen.change_control.deterministic_host_changes, [
    'colon_safe_due_source_renderer',
    'due_source_action_referent_alignment',
  ]);
  assert.deepEqual(screen.change_control.audit_recognition_changes, [
    'shared_writable_request_classifier',
  ]);
  for (const field of ['recovery_changes', 'transport_changes', 'safety_changes']) {
    assert.deepEqual(screen.change_control[field], [], field);
  }
  assert.deepEqual(screen.change_control.semantic_adjudication_changes, [
    'explicit_deterministic_only_working_screen',
  ]);
  assert.deepEqual(screen.change_control.gate_changes, [
    'per_draw_structural_target_activation',
    'source_renderer_mode_activation',
    'due_source_action_alignment_visibility',
    'source_turn_lexical_accessibility_visibility',
    'authored_source_sentence_accessibility',
    'deterministic_only_adjudication_policy',
    'clean_worktree_provenance_gate',
  ]);
  assert.deepEqual(screen.change_control.delivery_audit_changes, [
    'turn_progression_audit_is_a_strict_delivery_gate',
    'due_source_action_alignment_is_a_joint_ownership_gate',
  ]);
  assert.equal(screen.fixed_configuration.adjudication_policy, 'deterministic_only');
  assert.equal(screen.fixed_configuration.semantic_adjudication, false);
  assert.equal(screen.gates_per_cell.require_structural_target_activation, true);
  assert.equal(screen.gates_per_cell.require_source_surface_accessibility, true);
  assert.equal(screen.gates_per_cell.require_deterministic_only_audit, true);
  assert.equal(screen.gates_per_cell.maximum_semantic_adjudicator_calls, 0);
  assert.equal(screen.execution.require_clean_worktree, true);
  assert.deepEqual(screen.structural_debt_targets.items, [
    'host_source_renderer',
    'handoff_contract_and_cross_slot_progression',
    'typed_due_source_action_referent',
    'typed_turn_focus_relation',
  ]);
  assert.match(screen.preflight.focused_tests, /tutorStubDueSourceRenderer\.test\.js/u);
  assert.match(screen.preflight.focused_tests, /tutorStubLiveFirstDraftAudit\.test\.js/u);
  assert.match(screen.preflight.focused_tests, /tutorStubTurnProgressionContract\.test\.js/u);
  assert.match(screen.preflight.focused_tests, /tutorStubWorldScaffold\.test\.js/u);
  assert.match(screen.preflight.focused_tests, /tutorStubV27ConfirmationRegression\.test\.js/u);
  assert.deepEqual(screen.preflight.structural_regression_fixtures, [
    'tests/fixtures/tutor-stub-first-draft/tallow-answer-seeking-v27-i8-turn5.json',
  ]);
});

test('V28 validator fails closed on result, seed, or structural change-control drift', () => {
  const cases = [
    {
      name: 'result hash',
      mutate: ({ manifest }) => { manifest.current.version_advance_from.provenance.result_sha256 = 'drift'; },
      pattern: /result hash/iu,
    },
    {
      name: 'retired seed disposition',
      mutate: ({ manifest }) => {
        manifest.seed_ledger.historical.find((entry) => entry.seed === 20261601).status = 'reusable_non_held_out_development';
      },
      pattern: /V27 seed 20261601/iu,
    },
    {
      name: 'forbidden 202617 reservation',
      mutate: ({ manifest }) => {
        manifest.seed_ledger.historical.push({ version: 28, seed: 20261700, status: 'reserved' });
      },
      pattern: /202617xx/iu,
    },
    {
      name: 'recovery change',
      mutate: ({ screen, screenPath }) => {
        screen.change_control.recovery_changes.push('rewrite');
        fs.writeFileSync(screenPath, YAML.stringify(screen));
      },
      pattern: /V28 change control/iu,
    },
    {
      name: 'clean worktree requirement',
      mutate: ({ screen, screenPath }) => {
        screen.execution.require_clean_worktree = false;
        fs.writeFileSync(screenPath, YAML.stringify(screen));
      },
      pattern: /clean worktree/iu,
    },
  ];
  for (const entry of cases) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-v28-drift-'));
    try {
      const state = v28Fixture(tmp);
      entry.mutate(state);
      assert.throws(
        () => validateTutorStubFirstDraftOuterLoop({ manifest: state.manifest, root: tmp }),
        entry.pattern,
        entry.name,
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
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
    assert.equal(manifest.current.last_observation.working_iteration, 7);
    assert.equal(manifest.current.working_history.length, 7);
    assert.equal(manifest.current.acceptance_config, null);
    assert.equal(manifest.current.required_confirmation_after_primary_pass.seed_status, 'reusable_non_held_out_development');
    assert.equal(JSON.stringify(manifest).includes('20261600'), true);
    assert.equal(validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }).valid, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('V27 preserves the exact iteration-1 result and iteration-2 speaking-prompt change', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-v27-i1-'));
  try {
    const { manifest, primaryScreen: screen } = fixture(tmp);
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
    assert.equal(manifest.current.last_observation.working_iteration, 7);
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

test('V27 preserves the iteration-3 typed composite-part audit-recognition predeclaration', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-v27-i3-'));
  try {
    const { manifest, primaryScreen: screen } = fixture(tmp);
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
    assert.equal(manifest.seed_ledger.development[0].seed, 20261500);
    assert.equal(manifest.seed_ledger.development[0].status, 'reusable_non_held_out_development');
    assert.equal(validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }).valid, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('V27 preserves the exact failed iteration-3 result and provenance before iteration 4', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-v27-i3-result-'));
  try {
    const { manifest } = fixture(tmp);
    const observation = manifest.current.working_history[2];
    assert.equal(manifest.current.last_observation.working_iteration, 7);
    assert.equal(observation.result_artifact, '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-3/working-screen-result.json');
    assert.equal(observation.run_head, 'f0df994d1912c3c8b6d6f1b9960b5ef05962f1a6');
    assert.equal(observation.run_head_provenance, 'launch_log_confirmed');
    assert.equal(observation.run_head_artifact_embedded, false);
    assert.equal(observation.provenance.working_screen_config_sha256, 'eac765695c4e10a971cdf9ec95d4e83dd20ea48fdc281487541147e98f996568');
    assert.equal(observation.provenance.source_trace_sha256, 'b6d98928d6042485895fe1e958044d6303f7c600512593876c6c1acd630f127a');
    assert.equal(observation.provenance.campaign_validation_sha256, 'd758f789c558e687d60cd97272658f580a1e4bc07d02e07b4592690b1cd77b7d');
    assert.equal(observation.provenance.result_sha256, '743a31ae5779930b02e488c6092069fc3a1872ac462af6acee8512f1abd43888');
    assert.deepEqual(
      observation.provenance.turn_artifacts.map(({ turn, sha256 }) => ({ turn, sha256 })),
      [{ turn: 4, sha256: '675d6a7794253e4c16b28ba0ec69625fef5ee26d790aac88496b4ca15422351f' }],
    );
    assert.deepEqual(observation.completed_turns, [4]);
    assert.deepEqual(observation.unstarted_turns, [5, 6, 9]);
    assert.equal(observation.original_candidates_accepted, 0);
    assert.equal(observation.original_candidates_completed, 1);
    assert.equal(observation.original_candidate_acceptance_rate, 0);
    assert.equal(observation.mean_configuration_realization, 0);
    assert.equal(observation.maximum_possible_originals_accepted, 3);
    assert.equal(observation.maximum_possible_configuration_realization, 0.75);
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
      assert.equal(observation[field], 0, field);
    }
    assert.equal(observation.joint_performance_model_outputs, 1);
    assert.equal(observation.valid_joint_performance_outputs, 0);
    assert.equal(observation.joint_performance_output_failures, 1);
    assert.equal(observation.joint_performance_ownership_passes, 0);
    assert.equal(observation.joint_performance_ownership_failures, 1);
    assert.equal(observation.exact_host_source_occurrence_passes, 0);
    assert.equal(observation.exact_host_source_occurrence_failures, 1);
    assert.equal(observation.mean_original_latency_ms, 9932);
    assert.equal(observation.mean_total_tutor_latency_ms, 9932);
    assert.deepEqual(observation.token_usage, { input: 15906, output: 281, total: 16187 });
    assert.deepEqual(observation.dominant_failure_clusters, [
      { cluster: 'jointPerformanceGenerationAudit:slot_has_outer_whitespace', count: 1 },
    ]);
    assert.deepEqual(observation.comparison, {
      comparison_available: true,
      compared_to_iteration: 2,
      comparable_completion: false,
      measurable_improvement: false,
      configuration_realization_improved: false,
      semantic_recognition_corrections: 0,
      consecutive_without_improvement: 1,
      stop: false,
      reason: 'no_improvement',
    });
    assert.equal(validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }).valid, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('V27 preserves the iteration-4 transport-only outer-whitespace predeclaration', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-v27-i4-'));
  try {
    const { manifest, primaryScreen: screen } = fixture(tmp);
    assert.deepEqual(screen.change_log.iteration_4, {
      status: 'predeclared',
      bounded_change_owner: 'transport',
      target_failure_clusters: ['jointPerformanceGenerationAudit:slot_has_outer_whitespace'],
      speaking_changes: [],
      recovery_changes: [],
      audit_recognition_changes: [],
      transport_changes: ['trim_outer_slot_whitespace'],
      outer_slot_whitespace_canonicalization: {
        input_scope: 'decoded_model_owned_slot_strings',
        slot_ids: ['uptake', 'performance.entry', 'performance.response', 'handoff'],
        operation: 'trim_outer_whitespace_only',
        preserve_internal_whitespace: true,
        preserve_semantic_content: true,
        preserve_raw_model_output: true,
        preserve_original_candidate_provenance: true,
        reporting: {
          field: 'transportCanonicalization',
          applied_field: 'applied',
          canonicalized_slot_ids_field: 'canonicalized_slot_ids',
          classification: 'transport_canonicalization',
          separate_from: [
            'mechanical_repair',
            'model_rewrite',
            'deterministic_fallback',
            'semantic_recognition_correction',
            'configuration_realization',
          ],
        },
        unchanged_contracts: {
          safety_audits: true,
          semantic_audits: true,
          response_configuration_audit: true,
          source_ownership_audit: true,
          strict_delivery_gates: true,
        },
      },
    });
    assert.equal(manifest.seed_ledger.development[0].seed, 20261500);
    assert.equal(manifest.seed_ledger.development[0].status, 'reusable_non_held_out_development');
    assert.equal(validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }).valid, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('V27 preserves the exact iteration-4 result and provenance before iteration 5', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-v27-i4-result-'));
  try {
    const { manifest } = fixture(tmp);
    const observation = manifest.current.working_history[3];
    assert.equal(manifest.current.last_observation.working_iteration, 7);
    assert.equal(observation.result_artifact, '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-4/working-screen-result.json');
    assert.equal(observation.run_head, 'd048ec273e3a4a4618f51b7b0c999d20542ea14f');
    assert.equal(observation.run_head_provenance, 'launch_log_confirmed');
    assert.equal(observation.run_head_artifact_embedded, false);
    assert.equal(observation.provenance.working_screen_config_sha256, '287169e63d296f311e422933e94af582057716f04f9a8a3ed20a1f7686e5cc38');
    assert.equal(observation.provenance.source_trace_sha256, 'b6d98928d6042485895fe1e958044d6303f7c600512593876c6c1acd630f127a');
    assert.equal(observation.provenance.campaign_validation_sha256, '7d36c45d8c3c4a2afc849658674de57c30632f5c282bf1e7621b1582b14a2bcd');
    assert.equal(observation.provenance.result_sha256, 'c90dd4a8e785988f7b1d10b888ca9f6a158acc057f6d9f1b853865568ebe1169');
    assert.deepEqual(
      observation.provenance.turn_artifacts.map(({ turn, sha256 }) => ({ turn, sha256 })),
      [
        { turn: 4, sha256: '469ae92726049f9669754f1f05ff34a26d79d2f995e1429b08138c40dfc461aa' },
        { turn: 5, sha256: 'b00e043b931efdedaf1c466e76d8888a2fdf29b70e38036f09478fd489339043' },
        { turn: 6, sha256: '32fd864d79e18eea5d2cb75ab4ee788192852c8126336a617ab2909e1e8110ee' },
        { turn: 9, sha256: '8d804c6cf7c1d458bf97032e76788c57aaa969d18b0f2745cd7ffa5c1cf1b974' },
      ],
    );
    assert.deepEqual(observation.completed_turns, [4, 5, 6, 9]);
    assert.deepEqual(observation.unstarted_turns, []);
    assert.equal(observation.original_candidates_accepted, 3);
    assert.equal(observation.original_candidates_completed, 4);
    assert.equal(observation.original_candidate_acceptance_rate, 0.75);
    assert.equal(observation.mean_configuration_realization, 0.91675);
    assert.equal(observation.maximum_possible_originals_accepted, 3);
    assert.equal(observation.maximum_possible_configuration_realization, 0.91675);
    for (const field of [
      'final_safety_failures',
      'transcript_specific_uptake_failures',
      'mechanical_repairs',
      'model_rewrites',
      'deterministic_fallbacks',
      'semantic_adjudicator_calls',
      'semantic_adjudicator_errors',
      'semantic_recognition_corrections',
      'transport_normalized_outputs',
      'transport_normalization_count',
    ]) {
      assert.equal(observation[field], 0, field);
    }
    assert.deepEqual(observation.transport_normalizations, []);
    assert.equal(observation.joint_performance_model_outputs, 4);
    assert.equal(observation.valid_joint_performance_outputs, 4);
    assert.equal(observation.joint_performance_output_failures, 0);
    assert.equal(observation.joint_performance_ownership_passes, 3);
    assert.equal(observation.joint_performance_ownership_failures, 1);
    assert.equal(observation.exact_host_source_occurrence_passes, 4);
    assert.equal(observation.exact_host_source_occurrence_failures, 0);
    assert.equal(observation.mean_original_latency_ms, 11007.25);
    assert.equal(observation.mean_total_tutor_latency_ms, 11007.25);
    assert.deepEqual(observation.per_turn_latency_and_tokens, [
      { turn: 4, latency_ms: 10435, input_tokens: 17715, output_tokens: 317, total_tokens: 18032 },
      { turn: 5, latency_ms: 9377, input_tokens: 15980, output_tokens: 285, total_tokens: 16265 },
      { turn: 6, latency_ms: 11111, input_tokens: 17987, output_tokens: 374, total_tokens: 18361 },
      { turn: 9, latency_ms: 13106, input_tokens: 18827, output_tokens: 246, total_tokens: 19073 },
    ]);
    assert.deepEqual(observation.token_usage, { input: 70509, output: 1222, total: 71731 });
    assert.deepEqual(observation.dominant_failure_clusters, [
      { cluster: 'actorialRealizationAudit:missing_selected_performance_tactic', count: 1 },
      { cluster: 'jointPerformanceAudit:axis_not_realized_in_owner:actorial_performance', count: 1 },
      { cluster: 'jointPerformanceAudit:axis_not_realized_in_owner:engagement_stance', count: 1 },
    ]);
    assert.deepEqual(observation.comparison, {
      comparison_available: true,
      compared_to_iteration: 3,
      comparable_completion: true,
      measurable_improvement: true,
      configuration_realization_improved: true,
      original_candidates_accepted_delta: 3,
      original_candidate_acceptance_rate_delta: 0.75,
      mean_configuration_realization_delta: 0.91675,
      valid_joint_performance_outputs_delta: 4,
      joint_performance_output_failures_delta: -1,
      joint_performance_ownership_passes_delta: 3,
      joint_performance_ownership_failures_delta: 0,
      exact_host_source_occurrence_passes_delta: 4,
      exact_host_source_occurrence_failures_delta: -1,
      mean_original_latency_ms_delta: 1075.25,
      semantic_recognition_corrections: 0,
      transport_normalization_count: 0,
      consecutive_without_improvement: 0,
      stop: false,
      reason: 'improved',
    });
    assert.equal(validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }).valid, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('V27 iteration 5 predeclares only typed public-judgment-falter recognition', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-v27-i5-'));
  try {
    const { manifest, primaryScreen: screen } = fixture(tmp);
    assert.equal(screen.change_log.iteration_5.bounded_change_owner, 'audit_recognition');
    assert.deepEqual(screen.change_log.iteration_5.target_failure_clusters, [
      'actorialRealizationAudit:missing_selected_performance_tactic',
      'jointPerformanceAudit:axis_not_realized_in_owner:actorial_performance',
      'jointPerformanceAudit:axis_not_realized_in_owner:engagement_stance',
    ]);
    assert.deepEqual(screen.change_log.iteration_5.speaking_changes, []);
    assert.deepEqual(screen.change_log.iteration_5.recovery_changes, []);
    assert.deepEqual(screen.change_log.iteration_5.transport_changes, []);
    assert.deepEqual(screen.change_log.iteration_5.semantic_adjudication_changes, []);
    assert.deepEqual(screen.change_log.iteration_5.audit_recognition_changes, [
      'typed_public_judgment_falter_recognition',
    ]);
    assert.deepEqual(screen.change_log.iteration_5.phrase_level_recognition_changes, []);
    const recognition = screen.change_log.iteration_5.typed_public_judgment_falter_recognition;
    assert.equal(recognition.performance_contract.complete, true);
    assert.equal(recognition.performance_contract.selected_tactic, 'dramatic_counterpressure');
    assert.equal(recognition.selected_part_visibility.required, true);
    assert.equal(recognition.local_pressure_target_overlap.segment, 'performance_response');
    assert.equal(recognition.local_pressure_target_overlap.minimum_content_tokens, 2);
    assert.equal(recognition.exact_contrary_source.surface_match, 'exact');
    assert.equal(recognition.exact_contrary_source.owner, 'host');
    assert.equal(recognition.exact_contrary_source.excluded_from_performance_spans, true);
    assert.equal(recognition.terminal_handoff.segment, 'handoff');
    assert.equal(recognition.terminal_handoff.terminal_question, true);
    assert.deepEqual(recognition.judgment_construction.category_extension, ['judgment', 'judgement']);
    assert.deepEqual(recognition.recognized_outputs, {
      actorial_performance: 'dramatic_counterpressure',
      engagement_stance: 'charismatic',
    });
    assert.equal(recognition.charismatic_visibility_reuse.independent_lexical_shortcut, false);
    assert.deepEqual(recognition.unchanged_contracts, {
      generation: true,
      recovery: true,
      transport: true,
      safety_audits: true,
      semantic_adjudication: true,
      response_configuration_audit: true,
      source_ownership_audit: true,
      configuration_realization: true,
      strict_delivery_gates: true,
    });
    assert.equal(manifest.seed_ledger.development[0].seed, 20261500);
    assert.equal(manifest.seed_ledger.development[0].status, 'reusable_non_held_out_development');
    assert.equal(validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }).valid, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('V27 preserves the exact iteration-5 result and provenance in history', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-v27-i5-result-'));
  try {
    const { manifest } = fixture(tmp);
    const observation = manifest.current.working_history[4];
    assert.equal(observation.working_iteration, 5);
    assert.equal(observation.result_artifact, '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-5/working-screen-result.json');
    assert.equal(observation.run_head, '965a5708d5acc37a79e51b9f5c813b32336106d2');
    assert.equal(observation.provenance.working_screen_config_sha256, '236dbc2b5b9f708a127c73b889b467450b1fc7ad0939e912fdac6533fb5f5c0f');
    assert.equal(observation.provenance.campaign_validation_sha256, 'a8807ed6052423eae32332a614f23655ea511a30ddc2219e29c14d08dfe341fd');
    assert.equal(observation.provenance.result_sha256, '5dc24a93500b90c291b8a749095ff67824f5f18e70cb66d0d9797972d202f709');
    assert.deepEqual(observation.provenance.turn_artifacts.map(({ turn, sha256 }) => ({ turn, sha256 })), [
      { turn: 4, sha256: 'c3a444ac33a7cb2ae5e13cf06edbeca350e21be2ce9e3b186e3d9002d007c67b' },
    ]);
    assert.deepEqual(observation.completed_turns, [4]);
    assert.deepEqual(observation.unstarted_turns, [5, 6, 9]);
    assert.equal(observation.original_candidates_accepted, 0);
    assert.equal(observation.original_candidates_completed, 1);
    assert.equal(observation.mean_configuration_realization, 1);
    for (const field of [
      'final_safety_failures', 'mechanical_repairs', 'model_rewrites', 'deterministic_fallbacks',
      'semantic_adjudicator_calls', 'semantic_adjudicator_errors', 'semantic_recognition_corrections',
      'transport_normalized_outputs', 'transport_normalization_count',
    ]) assert.equal(observation[field], 0, field);
    assert.equal(observation.valid_joint_performance_outputs, 1);
    assert.equal(observation.joint_performance_ownership_failures, 1);
    assert.equal(observation.exact_host_source_occurrence_passes, 1);
    assert.equal(observation.mean_original_latency_ms, 8122);
    assert.deepEqual(observation.per_turn_latency_and_tokens, [
      { turn: 4, latency_ms: 8122, input_tokens: 17717, output_tokens: 149, total_tokens: 17866 },
    ]);
    assert.deepEqual(observation.token_usage, { input: 17717, output: 149, total: 17866 });
    assert.deepEqual(observation.dominant_failure_clusters, [
      { cluster: 'jointPerformanceAudit:axis_not_realized_in_owner:scene_immersion', count: 1 },
    ]);
    assert.equal(observation.comparison.compared_to_iteration, 4);
    assert.equal(observation.comparison.measurable_improvement, false);
    assert.equal(observation.comparison.consecutive_without_improvement, 1);
    assert.equal(observation.comparison.stop, false);
    assert.equal(observation.comparison.reason, 'no_improvement');
    assert.equal(validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }).valid, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('V27 iteration 6 predeclares only world-general terminal-s scene morphology', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-v27-i6-'));
  try {
    const { manifest, primaryScreen: screen } = fixture(tmp);
    const iteration = screen.change_log.iteration_6;
    assert.equal(iteration.bounded_change_owner, 'audit_recognition');
    assert.deepEqual(iteration.target_failure_clusters, [
      'jointPerformanceAudit:axis_not_realized_in_owner:scene_immersion',
    ]);
    assert.deepEqual(iteration.speaking_changes, []);
    assert.deepEqual(iteration.recovery_changes, []);
    assert.deepEqual(iteration.transport_changes, []);
    assert.deepEqual(iteration.semantic_adjudication_changes, []);
    assert.deepEqual(iteration.audit_recognition_changes, ['world_general_scene_lexicon_number_morphology']);
    assert.deepEqual(iteration.phrase_level_recognition_changes, []);
    const recognition = iteration.world_general_scene_lexicon_number_morphology;
    assert.equal(recognition.axis, 'scene_immersion');
    assert.equal(recognition.lexicon_source, 'public_world_surfaces');
    assert.equal(recognition.audited_segment, 'performance');
    assert.equal(recognition.token_match.mode, 'exact_or_regular_terminal_s_number_pair');
    assert.equal(recognition.token_match.full_token_boundary_required, true);
    assert.equal(recognition.token_match.bidirectional, true);
    assert.deepEqual(recognition.token_match.allowed_inflection, { suffix: 's', operation: 'add_or_remove_once' });
    assert.equal(recognition.token_match.forbidden_expansions.fuzzy_edit_distance, true);
    assert.equal(recognition.token_match.forbidden_expansions.substring_match, true);
    assert.equal(recognition.counting.minimum_scene_terms_changed, false);
    assert.equal(recognition.unchanged_contracts.scene_immersion_threshold, true);
    assert.equal(recognition.unchanged_contracts.strict_delivery_gates, true);
    assert.equal(manifest.seed_ledger.development[0].status, 'reusable_non_held_out_development');
    assert.equal(validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }).valid, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('V27 preserves the exact iteration-6 result and provenance before iteration 7', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-v27-i6-result-'));
  try {
    const { manifest } = fixture(tmp);
    const observation = manifest.current.working_history[5];
    assert.equal(manifest.current.last_observation.working_iteration, 7);
    assert.equal(observation.result_artifact, '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-6/working-screen-result.json');
    assert.equal(observation.run_head, '1e6ae86ee407ea06258cfc9d013e2eaec5d8bf3a');
    assert.equal(observation.provenance.working_screen_config_sha256, 'bc58477b3f3982c742f9d1a18505a956e56726762bfa2645ee80251fd964d928');
    assert.equal(observation.provenance.campaign_validation_sha256, '8f4b6aed9dced0bde19b9b4200937b56623a9aa9f62365d54e21ea75f934abbf');
    assert.equal(observation.provenance.result_sha256, 'd5fb716abac48df6eba0a2561513d05f954e994108e5074eca3a4781d2d24a3d');
    assert.deepEqual(observation.provenance.turn_artifacts.map(({ turn, sha256 }) => ({ turn, sha256 })), [
      { turn: 4, sha256: 'fa3aa342375afd87ecc3be64e78283bc826800bfc3e7b645c1fca8eee2d27087' },
      { turn: 5, sha256: '19f82a57250fe47d8c9cb861fbc2331927b54c19a44c980d2593e78bad8f1c4d' },
      { turn: 6, sha256: '97fdeb6d9856b75ea80e006d9969d790b3434aaf21b090ead9aaa848c767e6eb' },
      { turn: 9, sha256: '841b6a2ab228de92f0e70bd78469c2d2bf9918564d9c77828813706d50cd0510' },
    ]);
    assert.deepEqual(observation.completed_turns, [4, 5, 6, 9]);
    assert.deepEqual(observation.unstarted_turns, []);
    assert.equal(observation.original_candidates_accepted, 3);
    assert.equal(observation.original_candidates_completed, 4);
    assert.equal(observation.original_candidate_acceptance_rate, 0.75);
    assert.equal(observation.mean_configuration_realization, 0.95825);
    assert.equal(observation.transcript_specific_uptake_failures, 1);
    for (const field of [
      'final_safety_failures', 'mechanical_repairs', 'model_rewrites', 'deterministic_fallbacks',
      'semantic_adjudicator_calls', 'semantic_adjudicator_errors', 'semantic_recognition_corrections',
      'transport_normalized_outputs', 'transport_normalization_count',
    ]) assert.equal(observation[field], 0, field);
    assert.equal(observation.valid_joint_performance_outputs, 4);
    assert.equal(observation.joint_performance_ownership_passes, 3);
    assert.equal(observation.joint_performance_ownership_failures, 1);
    assert.equal(observation.exact_host_source_occurrence_passes, 4);
    assert.equal(observation.mean_original_latency_ms, 9004.75);
    assert.deepEqual(observation.per_turn_latency_and_tokens, [
      { turn: 4, latency_ms: 8885, input_tokens: 15904, output_tokens: 252, total_tokens: 16156 },
      { turn: 5, latency_ms: 9952, input_tokens: 15978, output_tokens: 353, total_tokens: 16331 },
      { turn: 6, latency_ms: 8302, input_tokens: 18199, output_tokens: 226, total_tokens: 18425 },
      { turn: 9, latency_ms: 8880, input_tokens: 16808, output_tokens: 285, total_tokens: 17093 },
    ]);
    assert.deepEqual(observation.token_usage, { input: 66889, output: 1116, total: 68005 });
    assert.deepEqual(observation.dominant_failure_clusters, [
      { cluster: 'actorialRealizationAudit:missing_selected_performance_tactic', count: 1 },
      { cluster: 'jointPerformanceAudit:axis_not_realized_in_owner:actorial_performance', count: 1 },
      { cluster: 'jointPerformanceAudit:axis_not_realized_in_owner:engagement_stance', count: 1 },
      { cluster: 'responseCompositionAudit:verbatim_learner_echo', count: 1 },
    ]);
    assert.equal(observation.comparison.compared_to_iteration, 5);
    assert.equal(observation.comparison.measurable_improvement, true);
    assert.equal(observation.comparison.configuration_realization_improved, false);
    assert.equal(observation.comparison.consecutive_without_improvement, 0);
    assert.equal(observation.comparison.stop, false);
    assert.equal(observation.comparison.reason, 'improved');
    assert.equal(validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }).valid, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('V27 preserves the exact iteration-7 passing result and provenance before confirmation', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-v27-i7-result-'));
  try {
    const { manifest } = fixture(tmp);
    const observation = manifest.current.working_history[6];
    assert.deepEqual(manifest.current.last_observation, observation);
    assert.equal(observation.status, 'pass');
    assert.equal(observation.result_artifact, '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-7/working-screen-result.json');
    assert.equal(observation.run_head, '20f9cb414a6ef0a225f7e0c0f22674ddffd812f7');
    assert.equal(observation.provenance.working_screen_config_sha256, 'ef2789b1eed46e8759f9e04bc9f29cc005d2ed49d1909cbfde6630f412a4109e');
    assert.equal(observation.provenance.source_trace_sha256, 'b6d98928d6042485895fe1e958044d6303f7c600512593876c6c1acd630f127a');
    assert.equal(observation.provenance.campaign_validation_sha256, '083af907162898723acac9aadbb79093500b9f124734dc42f24363be65b604ee');
    assert.equal(observation.provenance.result_sha256, 'd4b26cf326b8b1b2336e7b7b84762cfcc7ef14ac86500bbba49b5f9da43c31a6');
    assert.deepEqual(observation.provenance.turn_artifacts.map(({ turn, sha256 }) => ({ turn, sha256 })), [
      { turn: 4, sha256: '0b4cc362375600648e85e432cb7526a7bd7ef28f15a8e7d747523c77bb51fa29' },
      { turn: 5, sha256: 'b282db8cab2c44f33188544bd58056317bfe50cf7274014b6a8c5d77c319344a' },
      { turn: 6, sha256: 'b1b0108408c17ba2d28db2d6eefde7bb099a97f2a6d5e094fdcc89618b3bcd24' },
      { turn: 9, sha256: 'c2e82605fa1e1d9d015d91d647f1ace7b326cf06703aff1d31f27268b176de30' },
    ]);
    assert.deepEqual(observation.completed_turns, [4, 5, 6, 9]);
    assert.deepEqual(observation.unstarted_turns, []);
    assert.equal(observation.original_candidates_accepted, 4);
    assert.equal(observation.original_candidate_acceptance_rate, 1);
    assert.equal(observation.mean_configuration_realization, 1);
    assert.equal(observation.valid_joint_performance_outputs, 4);
    assert.equal(observation.joint_performance_ownership_passes, 4);
    assert.equal(observation.exact_host_source_occurrence_passes, 4);
    for (const field of [
      'final_safety_failures', 'transcript_specific_uptake_failures', 'mechanical_repairs',
      'model_rewrites', 'deterministic_fallbacks', 'semantic_adjudicator_calls',
      'semantic_adjudicator_errors', 'semantic_recognition_corrections',
      'transport_normalized_outputs', 'transport_normalization_count',
    ]) assert.equal(observation[field], 0, field);
    assert.equal(observation.mean_original_latency_ms, 8157);
    assert.equal(observation.mean_total_tutor_latency_ms, 8157);
    assert.deepEqual(observation.token_usage, { input: 68702, output: 982, total: 69684 });
    assert.deepEqual(observation.dominant_failure_clusters, []);
    assert.deepEqual(observation.comparison, {
      comparison_available: true,
      compared_to_iteration: 6,
      comparable_completion: true,
      measurable_improvement: true,
      configuration_realization_improved: true,
      original_candidates_accepted_delta: 1,
      original_candidate_acceptance_rate_delta: 0.25,
      mean_configuration_realization_delta: 0.04175,
      valid_joint_performance_outputs_delta: 0,
      joint_performance_output_failures_delta: 0,
      joint_performance_ownership_passes_delta: 1,
      joint_performance_ownership_failures_delta: -1,
      exact_host_source_occurrence_passes_delta: 0,
      exact_host_source_occurrence_failures_delta: 0,
      mean_original_latency_ms_delta: -847.75,
      semantic_recognition_corrections: 0,
      transport_normalization_count: 0,
      consecutive_without_improvement: 0,
      stop: false,
      reason: 'improved',
    });
    assert.equal(validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }).valid, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('V27 iteration 7 predeclares only the two adjudicated typed recognitions', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-v27-i7-'));
  try {
    const { manifest, primaryScreen: screen } = fixture(tmp);
    const iteration = screen.change_log.iteration_7;
    assert.equal(iteration.bounded_change_owner, 'audit_recognition');
    assert.deepEqual(iteration.target_failure_clusters, [
      'responseCompositionAudit:verbatim_learner_echo',
      'actorialRealizationAudit:missing_selected_performance_tactic',
      'jointPerformanceAudit:axis_not_realized_in_owner:actorial_performance',
      'jointPerformanceAudit:axis_not_realized_in_owner:engagement_stance',
    ]);
    assert.deepEqual(iteration.speaking_changes, []);
    assert.deepEqual(iteration.recovery_changes, []);
    assert.deepEqual(iteration.transport_changes, []);
    assert.deepEqual(iteration.semantic_adjudication_changes, []);
    assert.deepEqual(iteration.audit_recognition_changes, [
      'requested_entry_answer_recognition',
      'public_judgment_meets_contrary_evidence_recognition',
    ]);
    assert.deepEqual(iteration.phrase_level_recognition_changes, []);
    const requested = iteration.requested_entry_answer_recognition;
    assert.equal(requested.request_contract.explicit_writable_entry_request, true);
    assert.equal(requested.request_contract.permitted_prefix, 'Write:');
    assert.equal(requested.request_contract.answer_scope, 'licensed_pre_turn_limit');
    assert.equal(requested.candidate_contract.owner, 'uptake');
    assert.equal(requested.candidate_contract.form, 'declarative');
    assert.equal(requested.candidate_contract.question_forbidden, true);
    assert.equal(requested.candidate_contract.meta_commentary_forbidden, true);
    assert.equal(requested.ordinary_echo_behavior.remains_hard_failure, true);
    assert.equal(requested.ordinary_echo_behavior.question_recast_without_contract_fails, true);
    const judgment = iteration.public_judgment_meets_contrary_evidence_recognition;
    assert.equal(judgment.performance_contract.complete, true);
    assert.equal(judgment.performance_contract.selected_tactic, 'dramatic_counterpressure');
    assert.equal(judgment.selected_part_visibility.required, true);
    assert.equal(judgment.same_owned_sentence.required, true);
    assert.deepEqual(judgment.same_owned_sentence.judgment_nouns, ['claim', 'judgment', 'judgement']);
    assert.deepEqual(judgment.same_owned_sentence.opposition_predicates, ['fails against']);
    assert.equal(judgment.local_pressure_target_overlap.minimum_content_tokens, 2);
    assert.equal(judgment.contrary_anchor_overlap.minimum_content_tokens, 2);
    assert.equal(judgment.exact_contrary_source.surface_match, 'exact');
    assert.equal(judgment.exact_contrary_source.excluded_from_performance_spans, true);
    assert.equal(judgment.terminal_handoff.terminal_question, true);
    assert.equal(judgment.charismatic_visibility_reuse.independent_lexical_shortcut, false);
    assert.deepEqual(judgment.unchanged_contracts, {
      generation: true,
      recovery: true,
      transport: true,
      safety_audits: true,
      semantic_adjudication: true,
      response_configuration_audit: true,
      source_ownership_audit: true,
      configuration_realization: true,
      strict_delivery_gates: true,
    });
    assert.equal(manifest.seed_ledger.development[0].status, 'reusable_non_held_out_development');
    assert.equal(validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }).valid, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('outer-loop validator fails closed on V27 result, confirmation, or open-debt drift', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-v27-i1-drift-'));
  try {
    const mutations = [
      ({ manifest }) => { manifest.current.working_iteration = 7; },
      ({ manifest }) => { manifest.current.working_history = []; },
      ({ manifest }) => { manifest.current.last_observation.provenance.result_sha256 = 'wrong'; },
      ({ manifest }) => { manifest.current.last_observation.run_head_provenance = 'artifact_embedded'; },
      ({ manifest }) => { manifest.current.last_observation.unstarted_turns = [9]; },
      ({ manifest }) => { manifest.current.last_observation.original_candidates_accepted = 3; },
      ({ manifest }) => { manifest.current.last_observation.mean_configuration_realization = 0.9; },
      ({ manifest }) => { manifest.current.last_observation.final_safety_failures = 1; },
      ({ manifest }) => { manifest.current.last_observation.dominant_failure_clusters.push({ cluster: 'other', count: 1 }); },
      ({ manifest }) => { manifest.current.last_observation.comparison.stop = true; },
      ({ manifest }) => { manifest.seed_ledger.development[0].status = 'consumed_and_not_reusable'; },
      ({ primaryScreen }) => { primaryScreen.change_log.iteration_7.speaking_changes = ['changed']; },
      ({ primaryScreen }) => { primaryScreen.change_log.iteration_7.requested_entry_answer_recognition.candidate_contract.form = 'any'; },
      ({ screen }) => { screen.fixed_configuration.draws_per_turn = 3; },
      ({ screen }) => { screen.matrix[0].source_trace_sha256 = 'wrong'; },
      ({ screen }) => { screen.matrix[0].prefix_integrity.verified_prior_turns = [1, 2, 3]; },
      ({ screen }) => { screen.matrix[0].prefix_integrity.target_bundle.request_model = 'wrong'; },
      ({ screen }) => { screen.execution.hard_cell = 'foxtrot_diligent'; },
      ({ screen }) => { screen.execution.maximum_concurrent_remaining_cells = 4; },
      ({ screen }) => { screen.execution.forbid_duplicate_active_or_completed_cells = false; },
      ({ screen }) => { screen.change_control.speaking_changes = ['changed']; },
      ({ screen }) => { screen.gates_per_cell.minimum_mean_configuration_realization = 0.9; },
      ({ screen }) => { screen.gates_per_cell.maximum_mechanical_repairs = 1; },
      ({ screen }) => { screen.open_qualitative_debt.status = 'resolved'; },
      ({ manifest }) => { manifest.current.required_confirmation_after_primary_pass.open_qualitative_debt.items.pop(); },
    ];
    for (const mutate of mutations) {
      const item = fixture(tmp);
      mutate(item);
      fs.writeFileSync(item.screenPath, YAML.stringify(item.screen));
      fs.writeFileSync(item.primaryScreenPath, YAML.stringify(item.primaryScreen));
      assert.throws(
        () => validateTutorStubFirstDraftOuterLoop({ manifest: item.manifest, root: tmp }),
        /V27|working iteration|working history|last working observation|last observation|development seed|trace|prefix|target bundle|draw|execution|hard cell|concurren|duplicate|change control|configuration|repair|qualitative debt|contract/iu,
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

test('outer-loop validator binds the primary and four fresh confirmation development seeds', () => {
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
      seed: 20261604,
      status: 'reusable_non_held_out_development',
      cell: 'another',
      screen: 'first-draft-working-screens-v7',
    });
    assert.throws(
      () => validateTutorStubFirstDraftOuterLoop({ manifest: duplicate.manifest, root: tmp }),
      /V27 must preserve the primary development seed plus four confirmation seeds/u,
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
  const screen = loadYaml(PRIMARY_SCREEN_PATH);
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
  assert.match(screen.change_log.speaking_prompt, /Iteration 7 makes no speaking-prompt change/iu);
  assert.match(screen.change_log.recovery_only, /unchanged in iteration 7/iu);
  assert.match(screen.change_log.audit_recognition_only, /two typed deterministic recognitions/iu);
  assert.match(screen.change_log.transport_only, /Iteration 7 makes no transport change/iu);
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
  assert.equal(screen.change_log.iteration_4.bounded_change_owner, 'transport');
  assert.deepEqual(screen.change_log.iteration_4.speaking_changes, []);
  assert.deepEqual(screen.change_log.iteration_4.recovery_changes, []);
  assert.deepEqual(screen.change_log.iteration_4.audit_recognition_changes, []);
  assert.deepEqual(screen.change_log.iteration_4.transport_changes, ['trim_outer_slot_whitespace']);
  assert.equal(
    screen.change_log.iteration_4.outer_slot_whitespace_canonicalization.operation,
    'trim_outer_whitespace_only',
  );
  assert.equal(
    screen.change_log.iteration_4.outer_slot_whitespace_canonicalization.reporting.classification,
    'transport_canonicalization',
  );
  assert.equal(screen.change_log.iteration_5.bounded_change_owner, 'audit_recognition');
  assert.deepEqual(screen.change_log.iteration_5.speaking_changes, []);
  assert.deepEqual(screen.change_log.iteration_5.recovery_changes, []);
  assert.deepEqual(screen.change_log.iteration_5.transport_changes, []);
  assert.deepEqual(screen.change_log.iteration_5.semantic_adjudication_changes, []);
  assert.deepEqual(screen.change_log.iteration_5.audit_recognition_changes, [
    'typed_public_judgment_falter_recognition',
  ]);
  assert.equal(
    screen.change_log.iteration_5.typed_public_judgment_falter_recognition.local_pressure_target_overlap.minimum_content_tokens,
    2,
  );
  assert.equal(screen.change_log.iteration_6.bounded_change_owner, 'audit_recognition');
  assert.deepEqual(screen.change_log.iteration_6.target_failure_clusters, [
    'jointPerformanceAudit:axis_not_realized_in_owner:scene_immersion',
  ]);
  assert.deepEqual(screen.change_log.iteration_6.speaking_changes, []);
  assert.deepEqual(screen.change_log.iteration_6.recovery_changes, []);
  assert.deepEqual(screen.change_log.iteration_6.transport_changes, []);
  assert.deepEqual(screen.change_log.iteration_6.semantic_adjudication_changes, []);
  assert.deepEqual(screen.change_log.iteration_6.audit_recognition_changes, [
    'world_general_scene_lexicon_number_morphology',
  ]);
  assert.deepEqual(screen.change_log.iteration_6.phrase_level_recognition_changes, []);
  const recognition = screen.change_log.iteration_6.world_general_scene_lexicon_number_morphology;
  assert.equal(recognition.axis, 'scene_immersion');
  assert.equal(recognition.lexicon_source, 'public_world_surfaces');
  assert.equal(recognition.audited_segment, 'performance');
  assert.equal(recognition.token_match.mode, 'exact_or_regular_terminal_s_number_pair');
  assert.equal(recognition.token_match.full_token_boundary_required, true);
  assert.equal(recognition.token_match.bidirectional, true);
  assert.deepEqual(recognition.token_match.allowed_inflection, {
    suffix: 's',
    operation: 'add_or_remove_once',
  });
  assert.equal(recognition.counting.minimum_scene_terms_changed, false);
  assert.equal(recognition.unchanged_contracts.scene_immersion_threshold, true);
  assert.equal(recognition.unchanged_contracts.strict_delivery_gates, true);
  assert.equal(screen.change_log.iteration_7.bounded_change_owner, 'audit_recognition');
  assert.deepEqual(screen.change_log.iteration_7.speaking_changes, []);
  assert.deepEqual(screen.change_log.iteration_7.recovery_changes, []);
  assert.deepEqual(screen.change_log.iteration_7.transport_changes, []);
  assert.deepEqual(screen.change_log.iteration_7.semantic_adjudication_changes, []);
  assert.deepEqual(screen.change_log.iteration_7.audit_recognition_changes, [
    'requested_entry_answer_recognition',
    'public_judgment_meets_contrary_evidence_recognition',
  ]);
});

test('tracked V7 screen predeclares exact uncontaminated cross-world confirmation', () => {
  const screen = loadYaml(SCREEN_PATH);
  assert.equal(screen.id, 'first-draft-working-screens-v7');
  assert.equal(screen.held_out, false);
  assert.equal(screen.fixed_configuration.original_only, true);
  assert.equal(screen.fixed_configuration.draws_per_turn, 4);
  assert.equal(screen.fixed_configuration.max_live_model_jobs, 3);
  assert.deepEqual(screen.matrix.map((cell) => ({
    id: cell.id,
    turns: cell.turns,
    seed: cell.development_seed,
    trace: cell.source_trace_sha256,
    prior: cell.prefix_integrity.verified_prior_turns,
  })), [
    { id: 'tallow_answer_seeking', turns: [5], seed: 20261600, trace: '5ffe6180107ef050565108d4c8341d750e47c4712450dc5b789da9a3b02b202d', prior: [1, 2, 3, 4] },
    { id: 'ravensmark_affective_resistant', turns: [5], seed: 20261601, trace: 'f3435a216646758cb27e71ae86597b63eddcd104bc49514df5573b8d25baff92', prior: [1, 2, 3, 4] },
    { id: 'larkspur_premature_closure', turns: [2], seed: 20261602, trace: '307e77091962297b25832499a5c311eb133b84919ad1688485c9fcb9f21bd820', prior: [1] },
    { id: 'foxtrot_diligent', turns: [4], seed: 20261603, trace: 'cbdf897ccd592d9ed7bf3d79b135079a2eb121a8f1291a6b7450c36c8fe773da', prior: [1, 2, 3] },
  ]);
  assert.deepEqual(screen.execution, {
    hardest_cell_first: true,
    hard_cell: 'tallow_answer_seeking',
    hard_cell_must_pass_before_remaining: true,
    remaining_cells_execution: 'concurrent',
    maximum_concurrent_remaining_cells: 3,
    one_job_per_cell: true,
    forbid_duplicate_active_or_completed_cells: true,
    complete_all_cells_after_hard_cell_passes: true,
    stop_cell_when_gate_mathematically_impossible: true,
    preserve_unstarted_seeds_as_unconsumed: true,
    require_exact_target_bundle_binding: true,
  });
  assert.equal(screen.gates_per_cell.required_originals_accepted, 4);
  assert.equal(screen.gates_per_cell.required_prefixes, 1);
  assert.equal(screen.gates_per_cell.required_draws_per_prefix, 4);
  assert.equal(screen.gates_per_cell.minimum_mean_configuration_realization, 1);
  for (const field of [
    'maximum_safety_failures', 'maximum_mechanical_repairs', 'maximum_model_rewrites',
    'maximum_fallbacks', 'maximum_semantic_recognition_corrections',
    'maximum_transport_normalizations',
  ]) assert.equal(screen.gates_per_cell[field], 0, field);
  assert.deepEqual(screen.change_control, {
    implementation_change_from_v27_iteration_7: 'none',
    speaking_changes: [],
    audit_recognition_changes: [],
    recovery_changes: [],
    transport_changes: [],
    safety_changes: [],
    semantic_adjudication_changes: [],
    gate_changes: [],
  });
  assert.deepEqual(screen.open_qualitative_debt.items, [
    'host_source_renderer',
    'handoff_contract_and_cross_slot_progression',
    'typed_due_source_action_referent',
    'typed_turn_focus_relation',
  ]);
  assert.equal(screen.open_qualitative_debt.status, 'open_debt');
  assert.match(screen.open_qualitative_debt.consequence, /cannot terminate.*final acceptance/isu);
  assert.deepEqual(screen.matrix.map((cell) => cell.prefix_integrity.target_bundle), [
    { turn_id: '2026-07-16T07-03-36-147Z:t005', world: 'world_025_tallow_street', learner_profile: 'answer_seeking', request_model: 'gpt-5.6-terra', request_effort: 'low' },
    { turn_id: '2026-07-16T04-44-58-444Z:t005', world: 'world_009_ravensmark', learner_profile: 'affective_resistant', request_model: 'gpt-5.6-terra', request_effort: 'low' },
    { turn_id: '2026-07-16T05-50-54-527Z:t002', world: 'world_028_larkspur_fridge', learner_profile: 'premature_closure', request_model: 'gpt-5.6-terra', request_effort: 'low' },
    { turn_id: '2026-07-16T05-56-49-920Z:t004', world: 'world_022_foxtrot_jukebox', learner_profile: 'diligent', request_model: 'gpt-5.6-terra', request_effort: 'low' },
  ]);
});
