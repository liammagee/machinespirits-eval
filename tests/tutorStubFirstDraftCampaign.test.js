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
  tutorStubStrictOriginalCandidateAccepted,
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

function acceptanceGateConfig(turns = 10) {
  return {
    fixed_configuration: { turns },
    strict_delivery_gates_per_cell: {
      final_delivery_audit_failures: 0,
      maximum_deterministic_fallback_turns: 1,
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
      minimum_accounted_turn_rate: 1,
      minimum_aggregate_original_candidate_acceptance_rate: 0.7,
      minimum_cell_original_candidate_acceptance_rate: 0.6,
      maximum_aggregate_model_rewrite_rate: 0.3,
      maximum_model_rewrite_turns_per_cell: 4,
      maximum_total_deterministic_fallback_turns: 2,
      require_all_four_cells: true,
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

test('working screen can report aggregate non-actorial realization without making it a delivery-development veto', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-configuration-report-'));
  try {
    const config = workingConfig(tmp);
    config.gates_per_cell.configuration_realization_enforcement = 'report_only';
    const plan = expandTutorStubFirstDraftCampaign({ config, root: tmp, iteration: 1 });
    const reports = [2, 3, 7, 10].map((turn, index) => ({
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
              responseConfigurationAudit: { realization_rate: index === 3 ? 0.5 : 1 },
            },
          },
        },
      ],
    }));
    const summary = summarizeTutorStubWorkingScreen({ cell: plan.cells[0], reports, config });
    assert.equal(summary.meanConfigurationRealization, 0.875);
    assert.equal(summary.configurationRealizationEnforcement, 'report_only');
    assert.equal(summary.possibility.configurationRealization.passed, false);
    assert.equal(summary.possibility.possible, true);
    assert.equal(summary.gates.configurationRealization, true);
    assert.equal(summary.status, 'pass');
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

test('development stopping counts configuration realization improvement without conflating semantic corrections', () => {
  const previous = {
    completedTurns: 1,
    originalCandidatesAccepted: 1,
    meanConfigurationRealization: 0.667,
    semanticRecognitionCorrections: 0,
    stopping: { consecutiveWithoutImprovement: 1 },
  };
  const configurationImproved = tutorStubFirstDraftIterationStopping({
    current: {
      completedTurns: 1,
      originalCandidatesAccepted: 1,
      meanConfigurationRealization: 0.833,
      semanticRecognitionCorrections: 0,
    },
    previous,
  });
  assert.equal(configurationImproved.measurableImprovement, true);
  assert.equal(configurationImproved.configurationRealizationImproved, true);
  assert.equal(configurationImproved.consecutiveWithoutImprovement, 0);

  const recognitionOnly = tutorStubFirstDraftIterationStopping({
    current: {
      completedTurns: 1,
      originalCandidatesAccepted: 1,
      meanConfigurationRealization: 0.667,
      semanticRecognitionCorrections: 1,
    },
    previous,
  });
  assert.equal(recognitionOnly.measurableImprovement, false);
  assert.equal(recognitionOnly.configurationRealizationImproved, false);
  assert.equal(recognitionOnly.semanticRecognitionCorrections, 1);
  assert.equal(recognitionOnly.consecutiveWithoutImprovement, 2);
  assert.equal(recognitionOnly.stop, true);
});

test('development stopping does not reward an early-stopped survivor rate', () => {
  const previous = {
    completedTurns: 4,
    originalCandidatesAccepted: 3,
    meanConfigurationRealization: 0.91675,
    safetyFailures: 0,
    deterministicFallbacks: 0,
    stopping: { consecutiveWithoutImprovement: 0 },
  };
  const current = tutorStubFirstDraftIterationStopping({
    current: {
      completedTurns: 2,
      originalCandidatesAccepted: 2,
      meanConfigurationRealization: 0.9165,
      safetyFailures: 0,
      deterministicFallbacks: 0,
    },
    previous,
  });

  assert.equal(current.comparableCompletion, false);
  assert.equal(current.measurableImprovement, false);
  assert.equal(current.consecutiveWithoutImprovement, 1);
  assert.equal(current.stop, false);
});

test('a predeclared final frontier attempt stops when the full working screen does not pass', () => {
  const result = tutorStubFirstDraftIterationStopping({
    current: {
      completedTurns: 3,
      originalCandidatesAccepted: 3,
      meanConfigurationRealization: 1,
      workingScreenPassed: false,
    },
    previous: {
      completedTurns: 2,
      originalCandidatesAccepted: 1,
      meanConfigurationRealization: 0.833,
      stopping: { consecutiveWithoutImprovement: 1 },
    },
    requireWorkingScreenPass: true,
  });

  assert.equal(result.measurableImprovement, true);
  assert.equal(result.stop, true);
  assert.equal(result.reason, 'predeclared_final_frontier_attempt_failed');
});

test('acceptance assessment keeps original, repair, fallback, safety, and latency separate', () => {
  const report = {
    rows: [
      {
        status: 'ok',
        turnCount: 4,
        guardAccounting: {
          turns: 4,
          accountedTurns: 4,
          originalCandidateAcceptedTurns: 4,
          strictOriginalCandidateAcceptedTurns: 3,
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
  const config = acceptanceGateConfig(4);
  config.first_draft_gates.minimum_cell_original_candidate_acceptance_rate = 0.75;
  const assessment = assessTutorStubAcceptanceCell(report, config);
  assert.equal(assessment.status, 'pass');
  assert.equal(assessment.observed.originalCandidateAcceptanceRate, 0.75);
  assert.equal(assessment.observed.originalCandidateDeliveryRate, 1);
  assert.equal(assessment.observed.accountedTurnRate, 1);
  assert.equal(assessment.observed.mechanicalRepairs, 1);
  assert.equal(assessment.observed.modelRewrites, 0);
  assert.equal(assessment.observed.deterministicFallbacks, 0);
  assert.equal(assessment.observed.finalSafetyFailures, 0);
  assert.equal(assessment.observed.meanOriginalLatencyMs, 100);
  assert.equal(assessment.observed.meanTotalTutorLatencyMs, 125);
});

test('acceptance first-draft gate uses strict originals while preserving ordinary original delivery', () => {
  const config = acceptanceGateConfig(4);
  config.first_draft_gates.minimum_cell_original_candidate_acceptance_rate = 0.75;
  const report = {
    rows: [
      {
        status: 'ok',
        turnCount: 4,
        guardAccounting: {
          turns: 4,
          accountedTurns: 4,
          originalCandidateAcceptedTurns: 4,
          strictOriginalCandidateAcceptedTurns: 2,
        },
        characterAdaptation: {
          hostVisibleTurns: 4,
          hostPartCounts: { examiner: 2, advocate: 2 },
        },
        responseConfigurationVisibility: { mean_realization_rate: 1 },
      },
    ],
    aggregates: { errorCount: 0 },
  };
  const assessment = assessTutorStubAcceptanceCell(report, config);
  assert.equal(assessment.observed.originalCandidatesDelivered, 4);
  assert.equal(assessment.observed.strictOriginalCandidatesAccepted, 2);
  assert.equal(assessment.gates.originalAcceptance, false);
  assert.equal(assessment.status, 'fail');
});

test('strict original accounting requires original delivery and selected part/tactic realization', () => {
  const strictOriginal = {
    finalDelivery: { source: 'original_candidate' },
    originalCandidate: { audits: { actorialRealizationAudit: { ok: true } } },
  };
  assert.equal(tutorStubStrictOriginalCandidateAccepted(strictOriginal), true);
  assert.equal(
    tutorStubStrictOriginalCandidateAccepted({
      ...strictOriginal,
      originalCandidate: { audits: { actorialRealizationAudit: { ok: false } } },
    }),
    false,
  );
  assert.equal(
    tutorStubStrictOriginalCandidateAccepted({
      ...strictOriginal,
      finalDelivery: { source: 'policy_repair_candidate' },
    }),
    false,
  );
});

test('acceptance requires the declared turn horizon and complete guard accounting', () => {
  const config = acceptanceGateConfig(4);
  const baseRow = {
    status: 'ok',
    turnCount: 4,
    guardAccounting: {
      turns: 4,
      accountedTurns: 4,
      originalCandidateAcceptedTurns: 4,
      strictOriginalCandidateAcceptedTurns: 4,
    },
    characterAdaptation: {
      hostVisibleTurns: 4,
      hostPartCounts: { examiner: 2, advocate: 2 },
    },
    responseConfigurationVisibility: { mean_realization_rate: 1 },
  };
  const short = assessTutorStubAcceptanceCell(
    { rows: [{ ...baseRow, turnCount: 3 }], aggregates: { errorCount: 0 } },
    config,
  );
  assert.equal(short.gates.complete, false);
  assert.equal(short.status, 'fail');

  const unaccounted = assessTutorStubAcceptanceCell(
    {
      rows: [
        {
          ...baseRow,
          guardAccounting: { ...baseRow.guardAccounting, accountedTurns: 3 },
        },
      ],
      aggregates: { errorCount: 0 },
    },
    config,
  );
  assert.equal(unaccounted.observed.accountedTurnRate, 0.75);
  assert.equal(unaccounted.gates.accountedTurns, false);
  assert.equal(unaccounted.status, 'fail');
});

test('acceptance expansion freezes explicit palette and safety-turn controls', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-acceptance-'));
  try {
    const config = {
      ...acceptanceGateConfig(10),
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

test('acceptance validation fails closed when a required strict or first-draft gate is omitted', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-acceptance-gates-'));
  try {
    const base = {
      ...acceptanceGateConfig(10),
      schema: 'machinespirits.tutor-stub.first-draft-generalization-plan.v1',
      id: 'acceptance-gate-test',
      fixed_configuration: {
        ...acceptanceGateConfig(10).fixed_configuration,
        safety_turns: 80,
        register_palette: 'all',
      },
      artifacts: { live_root: path.join(tmp, 'live') },
      matrix: [
        ['hard', 1, 'answer_seeking', 92001],
        ['second', 2, 'diligent', 92002],
        ['third', 3, 'premature_closure', 92003],
        ['fourth', 4, 'low_trust_skeptic', 92004],
      ].map(([id, priority, learner_profile, seed]) => ({
        id,
        priority,
        world: `world_${id}`,
        learner_profile,
        seed,
      })),
      change_control: { maximum_concurrent_cells: 3, hardest_cell_first: true },
    };

    const missingStrict = structuredClone(base);
    delete missingStrict.strict_delivery_gates_per_cell.minimum_mean_configuration_realization;
    assert.throws(
      () => validateTutorStubFirstDraftCampaign({ config: missingStrict, root: tmp }),
      /minimum mean configuration realization must be a number between 0 and 1/u,
    );

    const missingFirstDraft = structuredClone(base);
    delete missingFirstDraft.first_draft_gates.minimum_accounted_turn_rate;
    assert.throws(
      () => validateTutorStubFirstDraftCampaign({ config: missingFirstDraft, root: tmp }),
      /minimum accounted turn rate must be a number between 0 and 1/u,
    );

    const missingAllCells = structuredClone(base);
    delete missingAllCells.first_draft_gates.require_all_four_cells;
    assert.throws(
      () => validateTutorStubFirstDraftCampaign({ config: missingAllCells, root: tmp }),
      /acceptance must require all four cells/u,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
