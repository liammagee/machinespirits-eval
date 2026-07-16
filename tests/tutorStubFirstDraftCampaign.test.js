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
    fixed_configuration: { draws_per_turn: 1, max_live_model_jobs: 3 },
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
            audits: { responseCompositionAudit: { ok: index !== 3 } },
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
    assert.equal(summary.status, 'fail', 'the required transcript-specific uptake gate remains strict');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
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
