import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import yaml from 'yaml';

import {
  adaptiveStateCriticalPathSummary,
  buildAdaptiveStateCriticalPathPlan,
  buildAdaptiveStateRepresentationsV2,
  buildAdaptiveStateTargetsV2,
  validateAdaptiveStateBenchmarkV2Config,
  validateAdaptiveStateCriticalPathPlan,
} from '../services/adaptiveTutor/stateBenchmarkV2.js';
import { buildTutorStubStateObservation } from '../services/adaptiveTutor/tutorStubStateAdapter.js';
import { verifyExperimentRun } from '../services/experimentRunArtifacts.js';
import { renderAdaptiveStateCriticalPathMarkdown } from '../scripts/run-adaptive-state-benchmark-v2.js';

const ROOT = path.resolve('.');
const CONFIG_PATH = path.join(ROOT, 'config', 'adaptive-state-benchmark-v2.yaml');

function config() {
  return yaml.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('v2 config freezes the bounded independent axes and two primary targets', () => {
  const value = config();
  assert.doesNotThrow(() => validateAdaptiveStateBenchmarkV2Config(value));
  assert.equal(value.critical_path.worlds.length, 3);
  assert.equal(value.critical_path.latent_generators.length, 2);
  assert.equal(value.critical_path.language_realizers.length, 2);
  assert.deepEqual(
    value.targets.co_primary.map((row) => row.id),
    ['next_dag_event_family', 'next_proof_trajectory'],
  );
  assert.equal(new Set(value.critical_path.language_realizers.map((row) => row.model_family)).size, 2);
});

test('S0 builds a balanced free 3 x 2 x 2 x 2 contract matrix', () => {
  const plan = buildAdaptiveStateCriticalPathPlan(config(), { stage: 's0_contract', label: 's0-unit' });
  assert.doesNotThrow(() => validateAdaptiveStateCriticalPathPlan(plan));
  assert.deepEqual(plan.counts, {
    crossed_cells: 12,
    seeds_per_cell: 2,
    dialogue_jobs: 24,
    scored_transitions: 144,
    expected_model_calls: 0,
  });
  assert.equal(new Set(plan.jobs.map((job) => job.cell_id)).size, 12);
  assert.ok(
    [...new Set(plan.jobs.map((job) => job.cell_id))].every(
      (id) => plan.jobs.filter((job) => job.cell_id === id).length === 2,
    ),
  );
  assert.equal(plan.paid, false);
  assert.ok(plan.jobs.every((job) => job.bootstrap_public_observations === 1));

  for (const world of plan.axes.worlds) {
    for (const generator of plan.axes.latent_generators) {
      const block = plan.jobs.filter(
        (job) => job.world.id === world && job.latent_generator.id === generator,
      );
      assert.equal(new Set(block.map((job) => JSON.stringify(job.action_schedule))).size, 1);
      for (const job of block) {
        assert.ok(
          block.some(
            (candidate) =>
              candidate.id !== job.id &&
              candidate.language_realizer.id === job.language_realizer.id &&
              candidate.seed !== job.seed,
          ),
          `${job.id} needs a same-realizer different-seed scramble donor`,
        );
        const pairedRealizer = block.find(
          (candidate) =>
            candidate.id !== job.id &&
            candidate.repetition === job.repetition &&
            candidate.seed === job.seed,
        );
        assert.ok(pairedRealizer, `${job.id} needs a paired surface realizer`);
        assert.deepEqual(pairedRealizer.action_schedule, job.action_schedule);
      }
    }
  }
});

test('S1 crosses both language-model families without expanding policies, profiles, judges, or targets', () => {
  const plan = buildAdaptiveStateCriticalPathPlan(config(), { stage: 's1_technical_pilot' });
  const summary = adaptiveStateCriticalPathSummary(plan);
  assert.equal(summary.dialogues, 24);
  assert.equal(summary.transitions, 144);
  assert.equal(summary.modelCalls, 168);
  assert.deepEqual(plan.axes.realizers, ['codex_terra', 'claude_sonnet']);
  assert.equal(plan.complexity_cap.no_policy_sweep, true);
  assert.equal(plan.complexity_cap.no_profile_sweep, true);
  assert.equal(plan.complexity_cap.no_judge_model_sweep, true);
  assert.deepEqual(plan.co_primary_targets, ['next_dag_event_family', 'next_proof_trajectory']);
});

test('S2 is capped at six or eight per cell and produces the frozen call envelope', () => {
  assert.throws(
    () => buildAdaptiveStateCriticalPathPlan(config(), { stage: 's2_confirmation' }),
    /requires --per-cell 6 or 8/u,
  );
  assert.throws(
    () => buildAdaptiveStateCriticalPathPlan(config(), { stage: 's2_confirmation', confirmationPerCell: 10 }),
    /requires --per-cell 6 or 8/u,
  );
  const six = buildAdaptiveStateCriticalPathPlan(config(), {
    stage: 's2_confirmation',
    confirmationPerCell: 6,
  });
  const eight = buildAdaptiveStateCriticalPathPlan(config(), {
    stage: 's2_confirmation',
    confirmationPerCell: 8,
  });
  assert.deepEqual(six.counts, {
    crossed_cells: 12,
    seeds_per_cell: 6,
    dialogue_jobs: 72,
    scored_transitions: 432,
    expected_model_calls: 504,
  });
  assert.deepEqual(eight.counts, {
    crossed_cells: 12,
    seeds_per_cell: 8,
    dialogue_jobs: 96,
    scored_transitions: 576,
    expected_model_calls: 672,
  });
});

test('config validator rejects a confounded one-model-family design and complexity creep', () => {
  const aliased = clone(config());
  aliased.critical_path.language_realizers[1].model_family = aliased.critical_path.language_realizers[0].model_family;
  assert.throws(() => validateAdaptiveStateBenchmarkV2Config(aliased), /distinct declared model families/u);

  const expanded = clone(config());
  expanded.complexity_cap.no_policy_sweep = false;
  assert.throws(() => validateAdaptiveStateBenchmarkV2Config(expanded), /policy and judge sweeps/u);
});

test('plan validation detects semantic tampering and report states the planning-only boundary', () => {
  const plan = buildAdaptiveStateCriticalPathPlan(config(), { stage: 's1_technical_pilot', label: 'pilot-unit' });
  plan.jobs = plan.jobs.filter((job) => job.cell_id !== plan.jobs[0].cell_id);
  assert.throws(() => validateAdaptiveStateCriticalPathPlan(plan), /design hash does not match/u);

  const sourceDrift = buildAdaptiveStateCriticalPathPlan(config(), { stage: 's1_technical_pilot' });
  sourceDrift.jobs[0].world.source = '/tmp/not-a-world';
  assert.throws(() => validateAdaptiveStateCriticalPathPlan(sourceDrift), /design hash does not match/u);

  const callDrift = buildAdaptiveStateCriticalPathPlan(config(), { stage: 's1_technical_pilot' });
  callDrift.jobs[0].expected_model_calls = 999;
  assert.throws(() => validateAdaptiveStateCriticalPathPlan(callDrift), /design hash does not match/u);

  const valid = buildAdaptiveStateCriticalPathPlan(config(), { stage: 's0_contract', label: 'report-unit' });
  const markdown = renderAdaptiveStateCriticalPathMarkdown(valid);
  assert.match(markdown, /12 fully crossed/u);
  assert.match(markdown, /no tutor-policy sweep/u);
  assert.match(markdown, /does not execute a model/u);
});

test('v2 representation ladder consumes the exact shared runtime projection without local fact ids', () => {
  const firstTurn = {
    turn: 1,
    learner: 'I can use the public assay premise.',
    classification: {
      turn: {
        request_type: 'evidence_to_claim',
        discourse_move: 'evidence_adoption',
        evidence_use: 'cites_public_evidence',
        epistemic_stance: 'exploratory',
        agency: 'attempting',
        affect: 'engaged',
        scores: {
          conceptual_engagement: { score: 3 },
          epistemic_readiness: { score: 3 },
        },
      },
    },
    tutorLearnerDagModel: {
      assessment: { bottleneck: 'inference_gap', bestPathCoverage: 0.25 },
      metrics: { missingPremiseCount: 3, groundedCount: 1, voicedDerivedCount: 0 },
    },
    tutorLearnerDagUpdate: { accepted: { adopt: ['world_local_assay_id'] } },
  };
  const secondTurn = {
    ...clone(firstTurn),
    turn: 2,
    learner: 'That evidence supports the intermediate claim.',
    classification: {
      turn: {
        ...firstTurn.classification.turn,
        discourse_move: 'inference',
        evidence_use: 'links_evidence_to_rule',
        agency: 'self_correcting',
        scores: {
          conceptual_engagement: { score: 4 },
          epistemic_readiness: { score: 4 },
        },
      },
    },
    tutorLearnerDagModel: {
      assessment: { bottleneck: 'assertion_gap', bestPathCoverage: 0.6 },
      metrics: { missingPremiseCount: 1, groundedCount: 2, voicedDerivedCount: 1 },
    },
    tutorLearnerDagUpdate: { accepted: { derive: [['supports', 'assay', 'claim']] } },
  };
  const first = buildTutorStubStateObservation({
    turnRecord: firstTurn,
    provenance: {
      source_dialogue_id: 'dialogue-1',
      benchmark_stratum: { world_id: 'marrick', generator_id: 'durable_state', action_id: 'request_evidence' },
    },
  });
  const second = buildTutorStubStateObservation({
    turnRecord: secondTurn,
    previousObservation: first,
    previousTurnRecords: [firstTurn],
    provenance: {
      source_dialogue_id: 'dialogue-1',
      benchmark_stratum: { world_id: 'marrick', generator_id: 'durable_state', action_id: 'request_evidence' },
    },
  });
  const donor = buildTutorStubStateObservation({
    turnRecord: { ...clone(secondTurn), learner: 'A matched donor at the same prediction turn.' },
    previousTurnRecords: [firstTurn],
    provenance: {
      source_dialogue_id: 'dialogue-2',
      benchmark_stratum: { world_id: 'marrick', generator_id: 'durable_state', action_id: 'request_evidence' },
    },
  });
  assert.equal(second.runtime_field_trajectory.trajectory.pointCount, 2);
  assert.equal(second.runtime_field_trajectory.trajectory.dag.velocity, 4.7);

  const representations = buildAdaptiveStateRepresentationsV2({
    observation: second,
    previousObservation: first,
    task: {
      knowledge_component: 'public evidence to warrant',
      prerequisite_path: ['identify evidence', 'supply warrant'],
      item_difficulty: 0.5,
      item_discrimination: 1,
    },
    matchedDagDonorObservation: donor,
    matchedFieldDonorObservation: donor,
    oracleState: {
      schema: 'machinespirits.adaptive-state-oracle.v2',
      prediction_origin: { phase: 'before_transition_sampling', turn: 2 },
      kernel_provenance: {
        generator_id: 'durable_state',
        action_id: 'request_evidence',
        seed: 17,
        transition_kernel_sha256: 'a'.repeat(64),
      },
      distributions: {
        next_dag_event_family: { retract: 0, derive: 1, adopt: 0, none: 0 },
        next_proof_trajectory: { advance: 1, regress: 0, stall: 0 },
      },
    },
  });
  assert.deepEqual(Object.keys(representations), [
    'no_state',
    'lean_dag',
    'dag_trajectory',
    'field_trajectory',
    'dag_scramble',
    'dag_stale',
    'field_scramble',
    'field_stale',
    'oracle',
  ]);
  assert.doesNotMatch(JSON.stringify(representations.no_state), /assay|world_local/u);
  assert.doesNotMatch(JSON.stringify(representations.lean_dag), /world_local_assay_id/u);
  assert.equal(representations.lean_dag.additional_state.dag.event_kind_counts.derive, 1);
  assert.equal(representations.field_trajectory.additional_state.trajectory.field.velocity, 0.2);
  const expectedCommon = JSON.stringify(representations.no_state.common);
  for (const [name, representation] of Object.entries(representations)) {
    assert.equal(
      JSON.stringify(representation.common),
      expectedCommon,
      `${name} must preserve the recipient common input`,
    );
  }

  assert.throws(
    () =>
      buildAdaptiveStateRepresentationsV2({
        observation: second,
        previousObservation: first,
        task: {},
      }),
    /matched cross-dialogue donor is required/u,
  );
  const wrongStratumDonor = clone(donor);
  wrongStratumDonor.provenance.benchmark_stratum.action_id = 'minimal_hint';
  assert.throws(
    () =>
      buildAdaptiveStateRepresentationsV2({
        observation: second,
        previousObservation: first,
        matchedDagDonorObservation: wrongStratumDonor,
        matchedFieldDonorObservation: donor,
        task: {},
      }),
    /must match world, generator, action, and turn stratum/u,
  );

  assert.deepEqual(
    buildAdaptiveStateTargetsV2({
      currentObservation: first,
      nextObservation: second,
      proofTransition: {
        schema: 'machinespirits.adaptive-state-proof-transition.v2',
        normalization_denominator: 5,
        current: { turn: 1, raw_distance: 4, harmful_proof_debt: 0 },
        next: { turn: 2, raw_distance: 3, harmful_proof_debt: 0 },
        provenance: { world_id: 'marrick', world_sha256: 'b'.repeat(64), adapter_version: 'marrick-v1' },
      },
    }),
    { next_dag_event_family: 'derive', next_proof_trajectory: 'advance' },
  );
  assert.equal(
    buildAdaptiveStateTargetsV2({
      currentObservation: first,
      nextObservation: second,
      proofTransition: {
        schema: 'machinespirits.adaptive-state-proof-transition.v2',
        normalization_denominator: 5,
        current: { turn: 1, raw_distance: 3, harmful_proof_debt: 0 },
        next: { turn: 2, raw_distance: 3, harmful_proof_debt: 1 },
        provenance: { world_id: 'marrick', world_sha256: 'b'.repeat(64), adapter_version: 'marrick-v1' },
      },
    }).next_proof_trajectory,
    'regress',
  );
});

test('S0 planner writes a sealed immutable planning transaction without model calls', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptive-state-v2-plan-'));
  const label = 's0-transaction-unit';
  const runDir = path.join(root, label);
  try {
    execFileSync(
      process.execPath,
      [
        'scripts/run-adaptive-state-benchmark-v2.js',
        '--stage',
        's0_contract',
        '--label',
        label,
        '--out',
        root,
        '--run-seed',
        '1701',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const verification = verifyExperimentRun(runDir);
    assert.equal(verification.ok, true, verification.errors.join('\n'));
    const plan = JSON.parse(fs.readFileSync(path.join(runDir, 'run-plan.json'), 'utf8'));
    assert.equal(plan.randomization.masterSeed, 1701);
    assert.equal(plan.jobs.length, 24);
    assert.deepEqual(plan.requiredObservedModelRoles, []);
    assert.equal(plan.intent.criticalPath.counts.expected_model_calls, 0);
    const seal = JSON.parse(fs.readFileSync(path.join(runDir, 'run-seal.json'), 'utf8'));
    assert.equal(seal.status, 'planned');
    assert.equal(seal.metadata.executedModelCalls, 0);

    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          ['scripts/run-adaptive-state-benchmark-v2.js', '--stage', 's0_contract', '--label', label, '--out', root],
          { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' },
        ),
      /immutable run plan|Refusing to overwrite/u,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
