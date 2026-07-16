import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  assessTutorStubAcceptanceCell,
  expandTutorStubFirstDraftCampaign,
  summarizeTutorStubWorkingScreen,
  tutorStubFirstDraftGatePossibility,
  tutorStubFirstDraftIterationStopping,
  validateTutorStubFirstDraftCampaign,
} from '../services/tutorStubFirstDraftCampaign.js';

function workingConfig(tmp) {
  const trace = path.join(tmp, 'source.jsonl');
  const fixture = path.join(tmp, 'fixture.json');
  fs.writeFileSync(trace, '{}\n');
  fs.writeFileSync(fixture, '{}\n');
  return {
    schema: 'machinespirits.tutor-stub.first-draft-working-screen.v1',
    id: 'working-test',
    held_out: false,
    fixed_configuration: {
      draws_per_turn: 1,
      max_live_model_jobs: 3,
      semantic_adjudication: true,
      adjudicator_effort: 'low',
    },
    preflight: { model_free_fixtures: [fixture] },
    artifacts: { root: path.join(tmp, 'out') },
    matrix: [
      {
        id: 'hard',
        priority: 1,
        world: 'world_hard',
        learner_profile: 'answer_seeking',
        source_trace: trace,
        turns: [2, 3, 7, 10],
        development_seed: 81001,
        seed_status: 'reusable_non_held_out_development',
      },
      {
        id: 'next',
        priority: 2,
        world: 'world_next',
        learner_profile: 'answer_seeking',
        source_trace: trace,
        turns: [3, 4, 6, 7],
        development_seed: 81002,
        seed_status: 'reusable_non_held_out_development',
      },
    ],
    gates_per_cell: {
      required_originals_accepted: 3,
      required_turns: 4,
      maximum_safety_failures: 0,
      maximum_fallbacks: 0,
      minimum_mean_configuration_realization: 0.9,
      require_transcript_specific_uptake: true,
    },
  };
}

test('campaign validation expands one original-only command per frozen turn without model calls', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-campaign-'));
  try {
    const config = workingConfig(tmp);
    const validation = validateTutorStubFirstDraftCampaign({ config, root: tmp });
    assert.equal(validation.kind, 'working_screen');
    const plan = expandTutorStubFirstDraftCampaign({ config, root: tmp, iteration: 2 });
    assert.equal(plan.cells.length, 2);
    assert.deepEqual(
      plan.cells.map((cell) => cell.id),
      ['hard', 'next'],
    );
    assert.equal(plan.cells[0].commands.length, 4);
    for (const command of plan.cells.flatMap((cell) => cell.commands)) {
      assert.ok(command.argv.includes('--original-only'));
      assert.ok(command.argv.includes('--development-seed'));
      assert.ok(command.argv.includes('--semantic-adjudication'));
      assert.ok(command.argv.includes('--adjudicator-effort'));
      assert.ok(!command.argv.includes('--dry-run'));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('working gate becomes impossible after two rejected originals and leaves later turns unneeded', () => {
  assert.deepEqual(tutorStubFirstDraftGatePossibility({ accepted: 0, completed: 2, total: 4, required: 3 }), {
    accepted: 0,
    completed: 2,
    remaining: 2,
    required: 3,
    maximumPossibleAccepted: 2,
    possible: false,
    passed: false,
  });
  assert.equal(tutorStubFirstDraftGatePossibility({ accepted: 2, completed: 3, total: 4, required: 3 }).possible, true);
});

test('working summary counts original acceptance, safety, uptake, and latency without recovery', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-summary-'));
  try {
    const config = workingConfig(tmp);
    const plan = expandTutorStubFirstDraftCampaign({ config, root: tmp, iteration: 1 });
    const reports = [2, 3, 7, 10].map((turn, index) => ({
      results: [
        {
          turn,
          latencyMs: 100 + index,
          audit: {
            ok: index !== 3,
            safetyFailure: false,
            hardFailureClusters: index === 3 ? ['response_composition:missing_learner_uptake'] : [],
            audits: {
              responseCompositionAudit: { ok: index !== 3 },
              actorialRealizationAudit: { ok: index !== 3 },
              responseConfigurationAudit: { realization_rate: index === 3 ? 0.5 : 1 },
            },
          },
        },
      ],
    }));
    const summary = summarizeTutorStubWorkingScreen({ cell: plan.cells[0], reports, config });
    assert.equal(summary.originalCandidatesAccepted, 3);
    assert.equal(summary.mechanicalRepairs, 0);
    assert.equal(summary.modelRewrites, 0);
    assert.equal(summary.deterministicFallbacks, 0);
    assert.equal(summary.safetyFailures, 0);
    assert.equal(summary.meanConfigurationRealization, 0.875);
    assert.equal(summary.gates.configurationRealization, false);
    assert.equal(summary.status, 'fail', 'the required transcript-specific uptake gate remains strict');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('working screen cannot pass when full configuration realization becomes mathematically impossible', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-configuration-'));
  try {
    const config = workingConfig(tmp);
    const plan = expandTutorStubFirstDraftCampaign({ config, root: tmp, iteration: 1 });
    const reports = [2, 3].map((turn) => ({
      results: [
        {
          turn,
          latencyMs: 100,
          audit: {
            ok: true,
            safetyFailure: false,
            hardFailureClusters: [],
            audits: {
              responseCompositionAudit: { ok: true },
              actorialRealizationAudit: { ok: true },
              responseConfigurationAudit: { realization_rate: 0.5 },
            },
          },
        },
      ],
    }));
    const summary = summarizeTutorStubWorkingScreen({ cell: plan.cells[0], reports, config });
    assert.equal(summary.possibility.originalAcceptance.possible, true);
    assert.equal(summary.possibility.configurationRealization.maximumPossibleMean, 0.75);
    assert.equal(summary.possibility.possible, false);
    assert.equal(summary.status, 'fail');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('working screen clusters every rejected original including unresolved advisory performance misses', () => {
  const reports = [
    {
      results: [
        {
          turn: 2,
          candidate: 'Public candidate one.',
          latencyMs: 10,
          deterministicAudit: { ok: false },
          audit: {
            ok: false,
            safetyFailure: false,
            failureClusters: ['actorialRealizationAudit:missing_selected_performance_tactic'],
            hardFailureClusters: [],
            audits: { responseConfigurationAudit: { realization_rate: 5 / 6 } },
          },
          semanticAdjudication: { called: true, adjudication: { recognized: false }, latencyMs: 5 },
        },
      ],
    },
    {
      results: [
        {
          turn: 3,
          candidate: 'Public candidate two.',
          latencyMs: 10,
          deterministicAudit: { ok: false },
          audit: {
            ok: false,
            safetyFailure: false,
            failureClusters: ['actorialRealizationAudit:missing_selected_performance_tactic'],
            hardFailureClusters: ['actorial_realization:missing_selected_performance_tactic'],
            audits: { responseConfigurationAudit: { realization_rate: 4 / 6 } },
          },
          semanticAdjudication: { called: false, latencyMs: 0 },
        },
      ],
    },
  ];
  const summary = summarizeTutorStubWorkingScreen({
    cell: { id: 'hard', world: 'world', learnerProfile: 'answer_seeking', seed: 1, turns: [2, 3, 4, 5] },
    reports,
    config: {
      gates_per_cell: {
        required_turns: 4,
        required_originals_accepted: 3,
        minimum_mean_configuration_realization: 0.9,
        maximum_safety_failures: 0,
        require_transcript_specific_uptake: false,
      },
    },
  });

  assert.deepEqual(summary.dominantFailureClusters, [
    { cluster: 'actorialRealizationAudit:missing_selected_performance_tactic', count: 2 },
  ]);
});

test('development stopping gate halts only after two consecutive non-improving iterations', () => {
  const first = tutorStubFirstDraftIterationStopping({
    current: { completedTurns: 8, originalCandidatesAccepted: 4 },
    previous: null,
  });
  assert.equal(first.stop, false);
  assert.equal(first.consecutiveWithoutImprovement, 0);

  const second = tutorStubFirstDraftIterationStopping({
    current: { completedTurns: 8, originalCandidatesAccepted: 4 },
    previous: {
      completedTurns: 8,
      originalCandidatesAccepted: 4,
      stopping: first,
    },
  });
  assert.equal(second.stop, false);
  assert.equal(second.consecutiveWithoutImprovement, 1);

  const third = tutorStubFirstDraftIterationStopping({
    current: { completedTurns: 8, originalCandidatesAccepted: 4 },
    previous: {
      completedTurns: 8,
      originalCandidatesAccepted: 4,
      stopping: second,
    },
  });
  assert.equal(third.stop, true);
  assert.equal(third.consecutiveWithoutImprovement, 2);

  const improved = tutorStubFirstDraftIterationStopping({
    current: { completedTurns: 8, originalCandidatesAccepted: 5 },
    previous: {
      completedTurns: 8,
      originalCandidatesAccepted: 4,
      stopping: second,
    },
  });
  assert.equal(improved.stop, false);
  assert.equal(improved.consecutiveWithoutImprovement, 0);
});

test('acceptance assessment keeps original, repair, fallback, safety, and latency separate', () => {
  const report = {
    rows: [
      {
        status: 'ok',
        turnCount: 4,
        guardAccounting: {
          originalCandidateAcceptedTurns: 3,
          mechanicalRepairTurns: 1,
          modelRepairTurns: 0,
          deterministicFallbackTurns: 0,
          finalDeliveryAuditFailures: 0,
          totalOriginalCandidateLatencyMs: 400,
          totalTutorGenerationLatencyMs: 500,
        },
        characterAdaptation: {
          hostVisibleTurns: 4,
          hostPartCounts: { examiner: 2, advocate: 2 },
          metaPerformanceTurns: 0,
          roleStageDirectionTurns: 0,
          sourceReplacementTurns: 0,
          duplicateClueDeliveryTurns: 0,
        },
        responseConfigurationVisibility: { mean_realization_rate: 1 },
        diagnosticCollection: { quarantineCount: 0 },
        errorCount: 0,
      },
    ],
    aggregates: { errorCount: 0 },
  };
  const config = {
    strict_delivery_gates_per_cell: {
      final_delivery_audit_failures: 0,
      maximum_deterministic_fallback_turns: 0,
      error_count: 0,
      quarantine_count: 0,
      meta_performance_turns: 0,
      role_stage_direction_turns: 0,
      source_replacement_turns: 0,
      duplicate_clue_delivery_turns: 0,
      minimum_host_visibility_rate: 1,
      minimum_mean_configuration_realization: 0.9,
      minimum_distinct_host_parts: 2,
    },
    first_draft_gates: {
      minimum_cell_original_candidate_acceptance_rate: 0.75,
      maximum_model_rewrite_turns_per_cell: 1,
    },
  };
  const assessment = assessTutorStubAcceptanceCell(report, config);
  assert.equal(assessment.status, 'pass');
  assert.equal(assessment.observed.originalCandidateAcceptanceRate, 0.75);
  assert.equal(assessment.observed.mechanicalRepairs, 1);
  assert.equal(assessment.observed.modelRewrites, 0);
  assert.equal(assessment.observed.deterministicFallbacks, 0);
  assert.equal(assessment.observed.finalSafetyFailures, 0);
  assert.equal(assessment.observed.meanOriginalLatencyMs, 100);
  assert.equal(assessment.observed.meanTotalTutorLatencyMs, 125);
});

test('acceptance expansion freezes explicit palette and safety-turn controls', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-acceptance-'));
  try {
    const config = {
      schema: 'machinespirits.tutor-stub.first-draft-generalization-plan.v1',
      id: 'acceptance-test',
      fixed_configuration: {
        mode: 'strict',
        turns: 10,
        safety_turns: 80,
        policy: 'continuous_dynamical_system',
        register_palette: 'all',
        dag_mode: 'defeasible_human_scaffold',
        register_temperature: 0.15,
        register_overlay_threshold: 0.7,
        dag_fact_dropout: 0,
        dag_fact_dropout_seed: 1,
        release_speed: 1,
        tutor_model: 'codex.gpt-5.6-terra',
        analysis_model: 'codex.gpt-5.6-sol',
        learner_model: 'codex.gpt-5.6-terra',
        cli_effort: 'low',
        max_tokens: 4096,
        history_turns: 4,
      },
      artifacts: { live_root: path.join(tmp, 'live') },
      matrix: [
        ['hard', 1, 'answer_seeking', 91001],
        ['second', 2, 'diligent', 91002],
        ['third', 3, 'premature_closure', 91003],
        ['fourth', 4, 'low_trust_skeptic', 91004],
      ].map(([id, priority, learner_profile, seed]) => ({
        id,
        priority,
        world: `world_${id}`,
        learner_profile,
        seed,
      })),
      first_draft_gates: { require_all_four_cells: true },
      change_control: { maximum_concurrent_cells: 3, hardest_cell_first: true },
    };
    const plan = expandTutorStubFirstDraftCampaign({ config, root: tmp });
    const hard = plan.cells[0].argv;

    assert.deepEqual(hard.slice(hard.indexOf('--register-palette'), hard.indexOf('--register-palette') + 2), [
      '--register-palette',
      'all',
    ]);
    assert.deepEqual(hard.slice(hard.indexOf('--safety-turns'), hard.indexOf('--safety-turns') + 2), [
      '--safety-turns',
      '80',
    ]);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
