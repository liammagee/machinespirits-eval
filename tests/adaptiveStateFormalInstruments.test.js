import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  A21_LATENT_GENERATOR_FAMILY,
  DAG_DROPOUT_LATENT_GENERATOR_FAMILY,
  FORMAL_STATE_BENCHMARK_DATASET_SCHEMA,
  FORMAL_STATE_BENCHMARK_LIMITATIONS,
  assertFormalStateBenchmarkRow,
  buildFormalStateBenchmarkDataset,
  buildFormalStateBenchmarkRows,
} from '../services/adaptiveTutor/formalStateBenchmark.js';
import { evaluateAdaptiveStateValidity } from '../services/adaptiveTutor/stateValidityMetrics.js';
import {
  ADAPTIVE_STATE_BENCHMARK_ROW_SCHEMA,
  ADAPTIVE_STATE_TARGET_HORIZON_SCHEMA,
} from '../services/adaptiveTutor/tutorStubStateAdapter.js';
import { verifyExperimentRun } from '../services/experimentRunArtifacts.js';
import { analyzeAdaptiveStateBenchmark } from '../scripts/analyze-adaptive-state-validity.js';
import { exportAdaptiveFormalStateBenchmark } from '../scripts/export-adaptive-formal-state-benchmark.js';

function withoutOracle(row) {
  return Object.fromEntries(Object.entries(row.representations).filter(([name]) => name !== 'oracle'));
}

test('formal state instruments emit a bounded deterministic canonical dataset', () => {
  const first = buildFormalStateBenchmarkDataset({ seed: 37 });
  const replay = buildFormalStateBenchmarkDataset({ seed: 37 });

  assert.deepEqual(replay, first);
  assert.equal(first.schema, FORMAL_STATE_BENCHMARK_DATASET_SCHEMA);
  assert.equal(first.bounded, true);
  assert.equal(first.rowCount, 12);
  assert.deepEqual(first.latentGeneratorFamilies, [A21_LATENT_GENERATOR_FAMILY, DAG_DROPOUT_LATENT_GENERATOR_FAMILY]);
  assert.equal(new Set(first.rows.map((row) => row.id)).size, first.rows.length);
  assert.ok(first.limitations.some((entry) => /not observations of human learners/iu.test(entry)));
  for (const row of first.rows) {
    assert.equal(row.schema, ADAPTIVE_STATE_BENCHMARK_ROW_SCHEMA);
    assert.equal(assertFormalStateBenchmarkRow(row), row);
    assert.deepEqual(row.target_horizon, {
      schema: ADAPTIVE_STATE_TARGET_HORIZON_SCHEMA,
      target: 'task_success_at_horizon',
      kind: 'immediate_next_observation',
      prediction_turn: row.turn,
      requested_turn: row.turn + 1,
      source_observation_turn: row.turn + 1,
      source_policy: 'exact_next_observation',
      prediction_relation: 'future',
      prediction_precedes_horizon: true,
      turn_offset: 1,
    });
  }
});

test('both latent families have independent dialogue and world groups with common inputs', () => {
  const rows = buildFormalStateBenchmarkRows({ seed: 41 });
  const families = new Map();
  const representationShape = Object.keys(rows[0].representations).sort();

  for (const row of rows) {
    const family = row.groups.latent_generator_family;
    if (!families.has(family)) families.set(family, { worlds: new Set(), dialogues: new Set() });
    families.get(family).worlds.add(row.groups.world);
    families.get(family).dialogues.add(row.groups.dialogue_id);
    assert.equal(row.groups.learner_source, `formal_latent:${family}`);
    assert.equal(row.groups.model_family, `deterministic:${family}`);
    assert.deepEqual(Object.keys(row.representations).sort(), representationShape);
    assert.equal(row.action.schema, 'adaptive-tutor.pedagogical-action.v2.0');
    assert.equal(typeof row.action.move_family, 'string');
    assert.equal(typeof row.action.task_id, 'string');
  }

  assert.deepEqual([...families.keys()].sort(), [A21_LATENT_GENERATOR_FAMILY, DAG_DROPOUT_LATENT_GENERATOR_FAMILY]);
  for (const groups of families.values()) {
    assert.equal(groups.worlds.size, 2);
    assert.equal(groups.dialogues.size, 2);
  }
  assert.equal(new Set(rows.map((row) => row.groups.dialogue_id)).size, 4);
  for (const world of new Set(rows.map((row) => row.groups.world))) {
    assert.equal(
      new Set(rows.filter((row) => row.groups.world === world).map((row) => row.groups.dialogue_id)).size,
      1,
    );
  }
});

test('latent state is confined to the upper-bound oracle representation', () => {
  const rows = buildFormalStateBenchmarkRows({ seed: 43 });
  for (const row of rows) {
    const publicFeatures = JSON.stringify(withoutOracle(row));
    for (const forbiddenKey of [
      'learner_state_before',
      'learnerStateBefore',
      'misconception',
      'proofProgress',
      'dependencyOwned',
      'activeDropped',
      'dropout_state_before',
    ]) {
      assert.equal(publicFeatures.includes(`"${forbiddenKey}"`), false, `${row.id}: ${forbiddenKey}`);
    }
    assert.equal(row.representations.oracle.additional_state.upper_bound_only, true);
    assert.equal(row.feature_provenance.hidden_state_used, true);
    assert.equal(row.feature_provenance.non_oracle_hidden_state_used, false);
    assert.deepEqual(row.feature_provenance.limitations, [...FORMAL_STATE_BENCHMARK_LIMITATIONS]);
  }

  const a21 = rows.find((row) => row.groups.latent_generator_family === A21_LATENT_GENERATOR_FAMILY);
  const dropout = rows.find((row) => row.groups.latent_generator_family === DAG_DROPOUT_LATENT_GENERATOR_FAMILY);
  assert.ok(a21.representations.oracle.additional_state.learner_state_before.misconception);
  assert.equal(
    Object.keys(dropout.representations.oracle.additional_state.dropout_state_before.activeDropped).length,
    1,
  );

  const leaked = structuredClone(rows[0]);
  leaked.representations.lean.latent_state_before = { misconception: 'private' };
  assert.throws(() => assertFormalStateBenchmarkRow(leaked), /latent field leaked outside oracle/iu);
});

test('prediction-origin features are invariant to future transition and action choice', () => {
  const rows = buildFormalStateBenchmarkRows({ seed: 47 });
  for (const world of [
    'formal_a21_hethel_unreleased',
    'formal_a21_hethel_echoed',
    'formal_dropout_assay',
    'formal_dropout_ledger',
  ]) {
    const counterfactuals = rows.filter((row) => row.groups.world === world);
    assert.equal(counterfactuals.length >= 2, true);
    for (const row of counterfactuals.slice(1)) {
      assert.deepEqual(row.representations, counterfactuals[0].representations, world);
    }
    if (counterfactuals[0].groups.latent_generator_family === DAG_DROPOUT_LATENT_GENERATOR_FAMILY) {
      assert.equal(new Set(counterfactuals.map((row) => JSON.stringify(row.action))).size, 1);
    } else {
      assert.equal(new Set(counterfactuals.map((row) => row.action.formal_action_id)).size >= 2, true);
    }
    assert.equal(new Set(counterfactuals.map((row) => JSON.stringify(row.targets))).size >= 2, true);
  }
});

test('dropout repair labels come only from exact active-drop and readoption events', () => {
  const rows = buildFormalStateBenchmarkRows({ seed: 53 }).filter(
    (row) => row.groups.latent_generator_family === DAG_DROPOUT_LATENT_GENERATOR_FAMILY,
  );
  for (const world of ['formal_dropout_assay', 'formal_dropout_ledger']) {
    const repair = rows.find((row) => row.groups.world === world && row.targets.dropout_repair === 'repaired');
    const noRepair = rows.find((row) => row.groups.world === world && row.targets.dropout_repair === 'not_repaired');
    const premiseId = repair.action.target_premise_id;

    assert.deepEqual(repair.action, noRepair.action);
    assert.equal(repair.action.formal_action_id, 'PROMPT_READOPTION');
    assert.equal(repair.action.action_type, 'request_evidence');
    assert.doesNotMatch(JSON.stringify(repair.action), /WITHHOLD|NOT_REPAIRED|DROPPED_PREMISE/iu);
    assert.deepEqual(
      new Set([repair.groups.counterfactual_branch, noRepair.groups.counterfactual_branch]),
      new Set(['latent_transition_a', 'latent_transition_b']),
    );
    assert.equal(repair.targets.dropout_repair, 'repaired');
    assert.equal(repair.targets.next_evidence_edge, `adopt:${premiseId}`);
    assert.equal(repair.targets.learner_owned_next_move, 'owned');
    assert.equal(noRepair.targets.dropout_repair, 'not_repaired');
    assert.equal(noRepair.targets.next_evidence_edge, 'none');
    assert.equal(noRepair.targets.learner_owned_next_move, 'not_owned');
    assert.deepEqual(repair.representations.oracle.additional_state, noRepair.representations.oracle.additional_state);
    assert.equal(repair.feature_provenance.action_invariant_across_outcome_branches, true);
    assert.equal(noRepair.feature_provenance.action_invariant_across_outcome_branches, true);
  }
});

test('A21 rows name the existing transition kernel and separate deterministic renderer', () => {
  const rows = buildFormalStateBenchmarkRows({ seed: 59 }).filter(
    (row) => row.groups.latent_generator_family === A21_LATENT_GENERATOR_FAMILY,
  );
  const release = rows.find(
    (row) => row.groups.world === 'formal_a21_hethel_unreleased' && row.action.formal_action_id === 'B_RELEASE_P_POINT',
  );
  const diagnostic = rows.find(
    (row) => row.groups.world === 'formal_a21_hethel_unreleased' && row.action.formal_action_id === 'A_DIAG_CONFLICT',
  );

  assert.equal(release.feature_provenance.transition_kernel, 'services/dramaticDerivation/a21/learnerSimulator.js');
  assert.match(release.feature_provenance.language_renderer, /renderDeterministicLearnerText/u);
  assert.equal(release.targets.next_evidence_edge, 'adopt:p_point');
  assert.equal(release.targets.learner_owned_next_move, 'owned');
  assert.equal(diagnostic.targets.next_evidence_edge, 'none');
  assert.equal(diagnostic.targets.learner_owned_next_move, 'not_owned');
});

test('formal rows run through the ordinary offline validity analyzer without a claim promotion', () => {
  const report = evaluateAdaptiveStateValidity(buildFormalStateBenchmarkRows({ seed: 61 }), {
    targets: ['dropout_repair', 'next_error_family'],
    k: 1,
    bootstrap: { iterations: 50, seed: 61 },
  });

  assert.equal(report.rowCount, 12);
  assert.equal(report.representations.lean.kind, 'baseline');
  assert.equal(report.representations.field_without_dynamics.kind, 'ablation');
  assert.equal(report.representations.state_scramble.kind, 'placebo');
  assert.equal(report.representations.oracle.kind, 'upper_bound');
  assert.match(report.sensorGate.claimBoundary, /not evidence of human learning or policy efficacy/iu);
});

test('formal instruments export and analyze as sealed reproducible transactions', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptive-formal-state-export-'));
  try {
    const exported = exportAdaptiveFormalStateBenchmark({
      outDir: path.join(root, 'export'),
    });
    assert.equal(exported.rows.length, 12);
    assert.equal(exported.verification.ok, true);
    assert.equal(verifyExperimentRun(exported.output).ok, true);
    assert.deepEqual(exported.verification.plan.intent.latentGeneratorFamilies, [
      A21_LATENT_GENERATOR_FAMILY,
      DAG_DROPOUT_LATENT_GENERATOR_FAMILY,
    ]);

    const analyzed = analyzeAdaptiveStateBenchmark({
      benchmarkDir: exported.output,
      outDir: path.join(root, 'analysis'),
      k: 1,
      bootstrapIterations: 50,
      runSeed: 71,
    });
    assert.equal(analyzed.verification.ok, true);
    assert.notEqual(analyzed.report.sensorGate.status, 'human_validated');
    assert.match(analyzed.report.sensorGate.claimBoundary, /not evidence of human learning or policy efficacy/iu);
    assert.ok(
      analyzed.report.sensorGate.representations.some((representation) =>
        representation.improvements.some((improvement) => improvement.evaluable === false),
      ),
    );
    assert.match(fs.readFileSync(path.join(analyzed.output, 'state-validity-report.md'), 'utf8'), /not evaluable/iu);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
