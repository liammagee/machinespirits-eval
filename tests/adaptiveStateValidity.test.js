import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  createDifficultyAwareBelief,
  difficultyAwareBeliefFeatures,
} from '../services/adaptiveTutor/difficultyAwareBelief.js';
import {
  alignedScrambleTutorStubBelief,
  buildAdaptiveStateBenchmarkRow,
  buildTutorStubNextEventTargets,
  buildTutorStubStateObservation,
  buildTutorStubStateRepresentations,
  validateCommonLeanBaselineRepresentations,
} from '../services/adaptiveTutor/tutorStubStateAdapter.js';
import {
  buildStateValiditySplitManifest,
  evaluateAdaptiveStateValidity,
  pairedGroupBootstrapStateValidity,
  passesStateValidityUncertaintyGate,
  scoreStateValidityPredictions,
  verifyStateValiditySplitManifest,
} from '../services/adaptiveTutor/stateValidityMetrics.js';
import {
  appendRunEvent,
  buildExperimentRunPlan,
  createRunPlan,
  createRunSeal,
  hashCanonicalJson,
  verifyExperimentRun,
} from '../services/experimentRunArtifacts.js';
import {
  applyCrossDialoguePlacebos,
  exportAdaptiveStateBenchmark,
} from '../scripts/export-adaptive-state-benchmark.js';
import { analyzeAdaptiveStateBenchmark } from '../scripts/analyze-adaptive-state-validity.js';

function turnRecord({ turn = 1, coverage = 0.25, bottleneck = 'release_or_pacing_gap', agency = 'questioning' } = {}) {
  return {
    turn,
    learner: `Learner public evidence at turn ${turn}`,
    classification: {
      turn: {
        request_type: 'evidence_to_claim',
        discourse_move: 'claim',
        evidence_use: 'links_evidence_to_rule',
        epistemic_stance: 'tentative',
        affect: 'engaged',
        agency,
        scores: {
          conceptual_engagement: { score: 4 },
          epistemic_readiness: { score: 3 },
        },
      },
    },
    tutorLearnerDagModel: {
      assessment: {
        bestPathCoverage: coverage,
        bottleneck,
        finalSecretEntailed: coverage === 1,
        assertedSecret: coverage === 1,
      },
      metrics: { missingPremiseCount: coverage === 1 ? 0 : 2, groundedCount: turn },
    },
    tutorLearnerDagUpdate: {
      accepted: { adopt: [`edge-${turn}`], retract: [], derive: [] },
    },
    humanDiscourseFrame: {
      proofDebt: { status: 'none_open', counts: { open: 0, harmful: 0 } },
      scaffoldState: { status: 'active' },
      warrantPremiseAudit: { proofStatus: 'supported' },
    },
    registerSelection: { policy: 'field', selected_register: 'warm', state_policy: { secret: 'do not use' } },
    responseConfiguration: { action_family: 'answer_supply' },
    hiddenLearnerState: { actualMisconception: 'private answer key' },
  };
}

const task = {
  taskId: 'fixture-task',
  knowledgeComponent: 'evidence linkage',
  prerequisitePath: ['identify evidence'],
  itemDifficulty: 0.6,
  itemDiscrimination: 1.2,
};

test('policy-invariant observation excludes action, register, and hidden channels', () => {
  const first = buildTutorStubStateObservation({ turnRecord: turnRecord() });
  const altered = turnRecord();
  altered.registerSelection = { policy: 'negative', selected_register: 'face_threat' };
  altered.responseConfiguration = { action_family: 'worked_example' };
  altered.hiddenLearnerState = { actualMisconception: 'different private truth' };
  const second = buildTutorStubStateObservation({ turnRecord: altered });

  assert.deepEqual(first, second);
  assert.equal(first.provenance.policy_invariant, true);
  assert.equal(JSON.stringify(first).includes('face_threat'), false);
  assert.equal(JSON.stringify(first).includes('private answer key'), false);
  assert.equal(first.public_evidence[0].quote, 'Learner public evidence at turn 1');
});

test('lean baseline is difficulty-aware and uses public inputs only', () => {
  const observation = buildTutorStubStateObservation({ turnRecord: turnRecord() });
  const belief = createDifficultyAwareBelief({ task, observation });

  assert.equal(belief.schema, 'adaptive-tutor.difficulty-aware-belief.v1');
  assert.equal(belief.task.item_difficulty, 0.6);
  assert.equal(belief.task.item_discrimination, 1.2);
  assert.equal(belief.provenance.hidden_state_used, false);
  assert.ok(belief.learner.mastery >= 0 && belief.learner.mastery <= 1);
  assert.equal(belief.learner.last_public_evidence, 'Learner public evidence at turn 1');
  assert.match(belief.learner.last_public_evidence_id, /^t1-learner-[0-9a-f]{12}$/u);
  assert.equal(belief.learner.last_public_evidence_type, 'learner_action');
  assert.equal(belief.learner.last_public_evidence_source, 'public_learner_utterance');
  const features = difficultyAwareBeliefFeatures(belief);
  assert.equal(features.last_public_evidence, belief.learner.last_public_evidence);
  assert.equal(features.last_public_evidence_id, belief.learner.last_public_evidence_id);
});

test('lean inputs distinguish missing values from observed zero and observed average', () => {
  const missingRecord = turnRecord({ coverage: 0 });
  missingRecord.classification.turn.scores = {};
  delete missingRecord.tutorLearnerDagModel.assessment.bestPathCoverage;
  missingRecord.tutorLearnerDagModel.metrics = {};

  const observedRecord = turnRecord({ coverage: 0 });
  observedRecord.classification.turn.scores = {
    conceptual_engagement: { score: 0.5 },
    epistemic_readiness: { score: 0.5 },
  };
  observedRecord.tutorLearnerDagModel.metrics = {
    missingPremiseCount: 0,
    groundedCount: 0,
    voicedDerivedCount: 0,
  };
  observedRecord.tutorLearnerDagModel.assessment.unsupportedAssertionCount = 0;

  const missingObservation = buildTutorStubStateObservation({ turnRecord: missingRecord });
  const observedObservation = buildTutorStubStateObservation({ turnRecord: observedRecord });
  assert.equal(missingObservation.classifier.conceptual_score, observedObservation.classifier.conceptual_score);
  assert.equal(
    missingObservation.classifier.epistemic_readiness_score,
    observedObservation.classifier.epistemic_readiness_score,
  );
  assert.equal(missingObservation.dag.best_path_coverage, observedObservation.dag.best_path_coverage);
  assert.equal(missingObservation.dag.missing_premise_count, observedObservation.dag.missing_premise_count);
  assert.equal(missingObservation.missingness.classifier.conceptual_score, true);
  assert.equal(observedObservation.missingness.classifier.conceptual_score, false);
  assert.equal(missingObservation.missingness.classifier.epistemic_readiness_score, true);
  assert.equal(observedObservation.missingness.classifier.epistemic_readiness_score, false);
  assert.equal(missingObservation.missingness.dag.best_path_coverage, true);
  assert.equal(observedObservation.missingness.dag.best_path_coverage, false);
  assert.equal(missingObservation.missingness.dag.missing_premise_count, true);
  assert.equal(observedObservation.missingness.dag.missing_premise_count, false);

  const defaultDiscriminationTask = { ...task };
  delete defaultDiscriminationTask.itemDiscrimination;
  const observedDefaultTask = { ...defaultDiscriminationTask, itemDiscrimination: 1 };
  const missingLean = buildTutorStubStateRepresentations({
    observation: missingObservation,
    task: defaultDiscriminationTask,
  }).representations.lean.lean_baseline;
  const observedLean = buildTutorStubStateRepresentations({
    observation: observedObservation,
    task: observedDefaultTask,
  }).representations.lean.lean_baseline;
  assert.equal(missingLean.item_discrimination, observedLean.item_discrimination);
  assert.equal(missingLean.input_missingness.task.item_discrimination, true);
  assert.equal(observedLean.input_missingness.task.item_discrimination, false);
  assert.equal(missingLean.input_missingness.dag.best_path_coverage, true);
  assert.equal(observedLean.input_missingness.dag.best_path_coverage, false);
});

test('representation adapter emits baseline, full, ablation, placebo, and stale controls', () => {
  const observation = buildTutorStubStateObservation({ turnRecord: turnRecord() });
  const first = buildTutorStubStateRepresentations({ observation, task, scrambleSeed: 7 });
  const nextObservation = buildTutorStubStateObservation({
    turnRecord: turnRecord({ turn: 2, coverage: 0.5 }),
    previousObservation: observation,
  });
  const second = buildTutorStubStateRepresentations({
    observation: nextObservation,
    task,
    previousRepresentations: first.representations,
    scrambleSeed: 8,
  });

  for (const name of [
    'lean',
    'plan2_belief',
    'plan4_fields',
    'field_without_dynamics',
    'belief_without_affect',
    'belief_without_task_difficulty',
    'state_scramble',
    'shuffled_evidence_ids',
    'stale_state',
  ]) {
    assert.ok(Object.hasOwn(second.representations, name), name);
  }
  const leanBytes = JSON.stringify(second.representations.lean.lean_baseline);
  for (const [name, representation] of Object.entries(second.representations)) {
    if (name === 'lean') continue;
    assert.equal(JSON.stringify(representation.lean_baseline), leanBytes, name);
    assert.ok(Object.hasOwn(representation, 'additional_state'), name);
  }
  assert.equal(validateCommonLeanBaselineRepresentations(second.representations), true);
  assert.deepEqual(
    second.representations.stale_state.additional_state,
    first.representations.plan2_belief.additional_state,
  );
  assert.equal(Object.hasOwn(second.representations.field_without_dynamics.additional_state, 'dynamics'), false);
  assert.equal(
    Object.hasOwn(second.representations.belief_without_affect.additional_state.axes, 'affective_readiness'),
    false,
  );
  assert.equal(
    Object.hasOwn(second.representations.belief_without_task_difficulty.additional_state.task, 'item_difficulty'),
    false,
  );

  const tampered = structuredClone(second.representations);
  tampered.plan2_belief.lean_baseline.mastery = -1;
  assert.throws(
    () => validateCommonLeanBaselineRepresentations(tampered),
    /does not preserve the byte-equal lean baseline/u,
  );
});

test('next-event targets are owned by the public harness transition', () => {
  const first = buildTutorStubStateObservation({ turnRecord: turnRecord() });
  const secondTurn = turnRecord({ turn: 2, coverage: 0.75, bottleneck: 'assertion_gap', agency: 'steering' });
  secondTurn.learner = 'I choose the next edge because it connects the public evidence to the warrant.';
  const second = buildTutorStubStateObservation({
    turnRecord: secondTurn,
    previousObservation: first,
  });
  const final = buildTutorStubStateObservation({
    turnRecord: turnRecord({ turn: 3, coverage: 1, bottleneck: 'grounded_asserted_secret', agency: 'steering' }),
    previousObservation: second,
  });
  const targets = buildTutorStubNextEventTargets({
    currentObservation: first,
    nextObservation: second,
    horizonObservation: final,
    action: { expected_evidence: { success: ['learner-authored rationale'] } },
  });

  assert.equal(targets.next_error_family, 'assertion_gap');
  assert.equal(targets.targeted_feedback_uptake, 'uptake_observed');
  assert.equal(targets.learner_owned_next_move, 'owned');
  assert.equal(targets.task_success_at_horizon, 'success');
  assert.match(targets.next_evidence_edge, /edge-2/u);
  assert.equal(targets.dropout_repair, 'not_applicable');
  assert.equal(targets.diagnostic_resolves_ambiguity, 'not_applicable');
});

test('next-event targets do not credit generic progress as action-specific uptake', () => {
  const first = buildTutorStubStateObservation({ turnRecord: turnRecord() });
  const next = buildTutorStubStateObservation({
    turnRecord: turnRecord({ turn: 2, coverage: 0.75, agency: 'steering' }),
    previousObservation: first,
  });

  const noContract = buildTutorStubNextEventTargets({ currentObservation: first, nextObservation: next });
  assert.equal(noContract.targeted_feedback_uptake, 'inconclusive');

  const missingExpectedEvidence = buildTutorStubNextEventTargets({
    currentObservation: first,
    nextObservation: next,
    action: { expected_evidence: { success: ['learner-authored prediction'] } },
    dropoutRepair: { activePremiseIds: ['p1'], repairedPremiseIds: [] },
  });
  assert.equal(missingExpectedEvidence.targeted_feedback_uptake, 'no_observed_uptake');
  assert.equal(missingExpectedEvidence.dropout_repair, 'not_repaired');
});

test('benchmark row records grouped holdouts and feature provenance', () => {
  const first = buildTutorStubStateObservation({ turnRecord: turnRecord() });
  const second = buildTutorStubStateObservation({
    turnRecord: turnRecord({ turn: 2, coverage: 0.5 }),
    previousObservation: first,
  });
  const row = buildAdaptiveStateBenchmarkRow({
    id: 'fixture-dialogue-t1',
    groups: {
      dialogue_id: 'fixture-dialogue',
      world: 'world-a',
      scenario_family: 'proof-gap',
      latent_generator_family: 'formal-synthetic-kernel',
      learner_source: 'formal-synthetic',
      model_family: 'deterministic',
    },
    observation: first,
    task,
    nextObservation: second,
    scrambleSeed: 3,
  });

  assert.equal(row.schema, 'machinespirits.adaptive-state-benchmark-row.v1');
  assert.equal(row.groups.world, 'world-a');
  assert.equal(row.feature_provenance.policy_invariant, true);
  assert.equal(row.feature_provenance.hidden_state_used, false);
  assert.equal(row.targets.next_error_family, 'release_or_pacing_gap');
});

test('aligned scramble moves evidence with probability mass instead of creating an inconsistent placebo', () => {
  const belief = {
    axes: { proof: 0.2, release: 0.8 },
    hypotheses: [
      { id: 'a', probability: 0.8, evidence: ['evidence-a'], evidence_ids: ['obs-a'] },
      { id: 'b', probability: 0.2, evidence: ['evidence-b'], evidence_ids: ['obs-b'] },
    ],
  };
  const scrambled = alignedScrambleTutorStubBelief(belief, 1);
  const dominant = scrambled.hypotheses[0];
  assert.equal(dominant.id, 'b');
  assert.equal(dominant.probability, 0.8);
  assert.deepEqual(dominant.evidence, ['evidence-a']);
  assert.deepEqual(dominant.evidence_ids, ['obs-a']);
  assert.deepEqual(Object.values(scrambled.axes).sort(), Object.values(belief.axes).sort());
});

test('export placebo permutation breaks dialogue alignment while preserving one-to-one state marginals', () => {
  const rows = ['a', 'b', 'c', 'd'].map((id, index) => ({
    id,
    groups: { dialogue_id: `dialogue-${id}` },
    representations: {
      lean: { lean_baseline: { sample: id } },
      plan2_belief: {
        lean_baseline: { sample: id },
        additional_state: {
          hypotheses: { signal: index },
          evidence: { signal: { supporting_ids: [`obs-${id}`], supporting: [`text-${id}`] } },
        },
      },
      state_scramble: { lean_baseline: { sample: id }, additional_state: {} },
      shuffled_evidence_ids: { lean_baseline: { sample: id }, additional_state: {} },
    },
    feature_provenance: {},
  }));
  const originalStates = rows.map((row) => JSON.stringify(row.representations.plan2_belief.additional_state)).sort();

  applyCrossDialoguePlacebos(rows, 17);

  assert.deepEqual(
    rows.map((row) => JSON.stringify(row.representations.state_scramble.additional_state)).sort(),
    originalStates,
  );
  for (const row of rows) {
    assert.equal(validateCommonLeanBaselineRepresentations(row.representations), true);
    assert.notEqual(row.feature_provenance.placebos.donor_dialogue_id, row.groups.dialogue_id);
    assert.notDeepEqual(
      row.representations.state_scramble.additional_state,
      row.representations.plan2_belief.additional_state,
    );
    assert.notDeepEqual(
      row.representations.shuffled_evidence_ids.additional_state.evidence.signal.supporting_ids,
      row.representations.plan2_belief.additional_state.evidence.signal.supporting_ids,
    );
    assert.deepEqual(
      row.representations.shuffled_evidence_ids.additional_state.evidence.signal.supporting,
      row.representations.plan2_belief.additional_state.evidence.signal.supporting,
    );
  }
});

test('export placebo permutation handles unequal dialogue-group sizes for the default formal seed', () => {
  const dialogueIds = ['a', 'a', 'a', 'a', 'b', 'b', 'b', 'b', 'c', 'c', 'd', 'd'];
  const rows = dialogueIds.map((dialogueId, index) => ({
    id: `sample-${index}`,
    groups: { dialogue_id: `dialogue-${dialogueId}` },
    representations: {
      plan2_belief: {
        hypotheses: { signal: index },
        evidence: { signal: { supporting_ids: [`obs-${index}`], supporting: [`text-${index}`] } },
      },
      state_scramble: {},
      shuffled_evidence_ids: {},
    },
    feature_provenance: {},
  }));
  const originalStates = rows.map((row) => JSON.stringify(row.representations.plan2_belief)).sort();

  applyCrossDialoguePlacebos(rows, 20260711);

  assert.deepEqual(rows.map((row) => JSON.stringify(row.representations.state_scramble)).sort(), originalStates);
  assert.equal(new Set(rows.map((row) => row.feature_provenance.placebos.state_scramble_donor_id)).size, rows.length);
  for (const row of rows) {
    assert.notEqual(row.feature_provenance.placebos.donor_dialogue_id, row.groups.dialogue_id);
    assert.equal(row.feature_provenance.placebos.algorithm, 'sha256_ranked_cross_dialogue_perfect_matching_v1');
  }
});

test('metric fixture computes normalized log loss, multiclass Brier, calibration bins, and abstention', () => {
  const metrics = scoreStateValidityPredictions(
    [
      { truth: 'a', probabilities: { a: 0.8, b: 0.2 } },
      { truth: 'b', probabilities: { a: 0.3, b: 0.7 } },
    ],
    ['a', 'b'],
  );
  assert.equal(metrics.top1Accuracy, 1);
  assert.ok(Math.abs(metrics.logLoss - (-Math.log(0.8) - Math.log(0.7)) / 2) < 1e-12);
  assert.ok(Math.abs(metrics.brierScore - 0.13) < 1e-12);
  assert.equal(
    metrics.calibrationBins.reduce((sum, bin) => sum + bin.n, 0),
    2,
  );
  assert.equal(metrics.abstention.find((row) => row.threshold === 0.8).n, 1);
});

test('paired bootstrap resamples whole groups and is byte-reproducible under a fixed seed', () => {
  const pairedRows = [
    {
      id: 'dialogue-a:t1',
      groupId: 'dialogue-a',
      lean: { logLoss: 1, brierScore: 0.5, top1Accuracy: 0 },
      candidate: { logLoss: 0.5, brierScore: 0.2, top1Accuracy: 1 },
    },
    {
      id: 'dialogue-a:t2',
      groupId: 'dialogue-a',
      lean: { logLoss: 0.8, brierScore: 0.4, top1Accuracy: 0 },
      candidate: { logLoss: 0.4, brierScore: 0.2, top1Accuracy: 1 },
    },
    {
      id: 'dialogue-b:t1',
      groupId: 'dialogue-b',
      lean: { logLoss: 0.6, brierScore: 0.3, top1Accuracy: 1 },
      candidate: { logLoss: 0.3, brierScore: 0.1, top1Accuracy: 1 },
    },
    {
      id: 'dialogue-b:t2',
      groupId: 'dialogue-b',
      lean: { logLoss: 0.4, brierScore: 0.2, top1Accuracy: 1 },
      candidate: { logLoss: 0.2, brierScore: 0.1, top1Accuracy: 1 },
    },
  ];
  const options = {
    iterations: 500,
    seed: 17,
    confidenceLevel: 0.95,
    groupKey: 'dialogue_id',
    namespace: 'hand-fixture',
  };
  const first = pairedGroupBootstrapStateValidity(pairedRows, options);
  const replay = pairedGroupBootstrapStateValidity(pairedRows, options);

  assert.deepEqual(replay, first);
  assert.equal(first.samplingUnit, 'whole_group');
  assert.equal(first.groupCount, 2);
  assert.equal(first.pairedPredictionCount, 4);
  assert.ok(Math.abs(first.metrics.logLoss.pointDelta - 0.35) < 1e-12);
  assert.ok(Math.abs(first.metrics.brierScore.pointDelta - 0.2) < 1e-12);
  assert.ok(Math.abs(first.metrics.top1Accuracy.pointDelta - 0.5) < 1e-12);
  assert.equal(first.metrics.logLoss.probabilityOfImprovement, 1);
  assert.ok(Math.abs(first.metrics.logLoss.confidenceInterval.lower - 0.25) < 1e-12);
  assert.ok(Math.abs(first.metrics.logLoss.confidenceInterval.upper - 0.45) < 1e-12);
  assert.equal(passesStateValidityUncertaintyGate(first, 0.95), true);
  assert.equal(passesStateValidityUncertaintyGate({ ...first, groupCount: 1 }, 0.95), false);
});

test('uncertainty gate rejects a positive point estimate whose paired interval crosses zero', () => {
  const weakPointEstimate = {
    metrics: {
      logLoss: {
        pointDelta: 0.1,
        confidenceInterval: { lower: -0.05, upper: 0.25 },
        probabilityOfImprovement: 0.8,
      },
      brierScore: {
        pointDelta: 0.04,
        confidenceInterval: { lower: -0.01, upper: 0.09 },
        probabilityOfImprovement: 0.9,
      },
    },
  };
  assert.ok(weakPointEstimate.metrics.logLoss.pointDelta > 0);
  assert.ok(weakPointEstimate.metrics.brierScore.pointDelta > 0);
  assert.equal(passesStateValidityUncertaintyGate(weakPointEstimate, 0.95), false);
});

function syntheticValidityRows() {
  const rows = [];
  const transitionKernels = {
    a21_durable_state_transition_kernel: 'services/dramaticDerivation/a21/learnerSimulator.js',
    dag_fact_dropout_memory_instrument: 'services/tutorStubDagFactDropout.js',
  };
  for (const world of ['w1', 'w2', 'w3', 'w4']) {
    for (const latentGeneratorFamily of Object.keys(transitionKernels)) {
      for (const learnerSource of ['learner-a', 'learner-b']) {
        for (const modelFamily of ['model-a', 'model-b']) {
          for (const label of ['gap-a', 'gap-b']) {
            const id = `${world}-${latentGeneratorFamily}-${learnerSource}-${modelFamily}-${label}`;
            const leanBaseline = { constant: 1 };
            const augment = (additionalState) => ({
              lean_baseline: structuredClone(leanBaseline),
              additional_state: additionalState,
            });
            rows.push({
              id,
              groups: {
                dialogue_id: id,
                world,
                scenario_family: label,
                latent_generator_family: latentGeneratorFamily,
                learner_source: learnerSource,
                model_family: modelFamily,
              },
              action: { move_family: 'diagnose_elicit' },
              targets: { next_error_family: label },
              representations: {
                lean: { lean_baseline: structuredClone(leanBaseline) },
                plan2_belief: augment({ public_signal: label }),
                state_scramble: augment({ public_signal: Number(id.charCodeAt(0)) % 2 ? 'x' : 'y' }),
                shuffled_evidence_ids: augment({ public_signal: 'shuffled' }),
                stale_state: augment({ public_signal: 'stale' }),
              },
              feature_provenance: {
                policy_invariant: true,
                transition_kernel: transitionKernels[latentGeneratorFamily],
              },
            });
          }
        }
      }
    }
  }
  return rows;
}

test('split manifests are a semantic contract over sample ids, folds, and claim-grade policy', () => {
  const rows = syntheticValidityRows();
  const manifest = buildStateValiditySplitManifest(rows);

  assert.deepEqual(verifyStateValiditySplitManifest(rows, manifest), manifest);

  const staleSamples = structuredClone(manifest);
  staleSamples.sampleIds.pop();
  assert.throws(() => verifyStateValiditySplitManifest(rows, staleSamples), /sampleIds do not match benchmark rows/u);

  const staleFold = structuredClone(manifest);
  staleFold.folds[0].testIds.pop();
  assert.throws(() => verifyStateValiditySplitManifest(rows, staleFold), /folds do not match benchmark rows/u);

  const unsupported = structuredClone(manifest);
  unsupported.method = 'random_row_split';
  assert.throws(() => verifyStateValiditySplitManifest(rows, unsupported), /unsupported split manifest method/u);

  const weakenedGate = structuredClone(manifest);
  weakenedGate.gatePolicy.minimumBootstrapIterations = 1;
  weakenedGate.gatePolicy.minimumConfidenceLevel = 0.5;
  weakenedGate.gatePolicy.minimumImprovementProbability = 0.5;
  weakenedGate.gatePolicy.maximumExpectedCalibrationError = 0.9;
  assert.throws(
    () => verifyStateValiditySplitManifest(rows, weakenedGate),
    /gatePolicy is incomplete or non-canonical/u,
  );
});

test('grouped holdouts keep capacity fixed and expose incremental value over lean', () => {
  const rows = syntheticValidityRows();
  const splitManifest = buildStateValiditySplitManifest(rows);
  const report = evaluateAdaptiveStateValidity(rows, {
    k: 3,
    bootstrap: { iterations: 2000, seed: 29 },
  });
  const lean = report.representations.lean.targets.next_error_family.aggregate;
  const signal = report.representations.plan2_belief.targets.next_error_family.aggregate;

  assert.ok(signal.logLoss < lean.logLoss);
  assert.ok(signal.brierScore < lean.brierScore);
  assert.ok(signal.top1Accuracy >= 0.75, 'scenario-family holdout is deliberately harder than world/source holdouts');
  assert.ok(report.incrementalValueOverLean.next_error_family.plan2_belief.deltaLogLoss > 0);
  const uncertainty = report.incrementalValueOverLean.next_error_family.plan2_belief.pairedBootstrap.metrics;
  assert.ok(uncertainty.logLoss.confidenceInterval.lower > 0);
  assert.ok(uncertainty.brierScore.confidenceInterval.lower > 0);
  assert.equal(report.uncertainty.groupKey, 'dialogue_id');
  assert.equal(report.uncertainty.iterations, 2000);
  assert.equal(report.analysisProtocolGrade, 'claim_grade_settings');
  assert.equal(report.sensorGate.status, 'synthetic_instrument_only');
  assert.equal(report.sensorGate.engineeringDecision, 'sensor_candidate_passes_synthetic_gate');
  assert.equal(
    report.sensorGate.representations
      .find((row) => row.representation === 'plan2_belief')
      .improvements.find((row) => row.target === 'next_error_family').placeboPassed,
    true,
  );
  assert.equal(report.splitManifestSha256, hashCanonicalJson(splitManifest));
  assert.equal(report.foldsSha256, hashCanonicalJson(splitManifest.folds));
  assert.notEqual(report.splitManifestSha256, report.foldsSha256);
});

test('sensor gate cannot pass when the candidate behaves like its state-scramble placebo', () => {
  const rows = syntheticValidityRows().map((row) => ({
    ...row,
    representations: {
      ...row.representations,
      state_scramble: JSON.parse(JSON.stringify(row.representations.plan2_belief)),
    },
  }));
  const report = evaluateAdaptiveStateValidity(rows, { k: 3 });

  assert.equal(report.sensorGate.status, 'not_passed');
  assert.equal(
    report.sensorGate.representations
      .find((row) => row.representation === 'plan2_belief')
      .improvements.find((row) => row.target === 'next_error_family').placeboPassed,
    false,
  );
});

test('distinct prompt personas do not satisfy the independent latent-generator gate', () => {
  const rows = syntheticValidityRows().map((row) => ({
    ...row,
    groups: { ...row.groups, latent_generator_family: 'prompt_persona_shared_generator' },
  }));
  const report = evaluateAdaptiveStateValidity(rows, { k: 3 });

  assert.equal(report.sensorGate.status, 'not_passed');
  assert.equal(report.sensorGate.engineeringDecision, 'do_not_optimize_policy');
  assert.equal(
    report.sensorGate.representations
      .find((row) => row.representation === 'plan2_belief')
      .improvements.find((row) => row.target === 'next_error_family').latentGeneratorLevels,
    0,
  );
});

test('unregistered latent-generator claims fail closed', () => {
  const rows = syntheticValidityRows();
  rows[0].groups.latent_generator_family = 'invented-independent-simulator';

  assert.throws(() => evaluateAdaptiveStateValidity(rows), /claims unregistered latent generator/u);
});

test('learner-source and model-family aliases do not satisfy independent holdout evidence', () => {
  const rows = syntheticValidityRows().map((row) => ({
    ...row,
    groups: {
      ...row.groups,
      learner_source: `formal_latent:${row.groups.latent_generator_family}`,
      model_family: `deterministic:${row.groups.latent_generator_family}`,
    },
  }));
  const report = evaluateAdaptiveStateValidity(rows, { k: 3 });
  const target = report.sensorGate.representations
    .find((row) => row.representation === 'plan2_belief')
    .improvements.find((row) => row.target === 'next_error_family');

  assert.equal(report.sensorGate.status, 'not_passed');
  assert.equal(report.sensorGate.independentAxisCoverage.learnerSource.crossed, false);
  assert.equal(report.sensorGate.independentAxisCoverage.modelFamily.crossed, false);
  assert.equal(target.independentHoldoutPassed, false);
});

test('weaker bootstrap CLI settings are exploratory and cannot produce a passing verdict', () => {
  const report = evaluateAdaptiveStateValidity(syntheticValidityRows(), {
    k: 3,
    bootstrap: {
      iterations: 50,
      confidenceLevel: 0.8,
      minimumImprovementProbability: 0.5,
    },
  });

  assert.equal(report.analysisProtocolGrade, 'exploratory_settings');
  assert.equal(report.sensorGate.claimGradeSettings.passed, false);
  assert.equal(report.sensorGate.status, 'not_passed');
  assert.equal(report.sensorGate.engineeringDecision, 'exploratory_settings_do_not_optimize_policy');
});

test('claim-grade sensor gate enforces the preregistered held-out calibration threshold', () => {
  const report = evaluateAdaptiveStateValidity(syntheticValidityRows(), {
    k: 3,
    gatePolicy: { maximumExpectedCalibrationError: 0 },
  });
  const target = report.sensorGate.representations
    .find((row) => row.representation === 'plan2_belief')
    .improvements.find((row) => row.target === 'next_error_family');

  assert.equal(report.analysisProtocolGrade, 'claim_grade_settings');
  assert.ok(target.calibration.expectedCalibrationError > 0);
  assert.equal(target.calibrationPassed, false);
  assert.equal(report.sensorGate.status, 'not_passed');
});

test('common-support and dialogue-group firewalls fail closed', () => {
  const rows = syntheticValidityRows();
  delete rows[0].representations.plan2_belief;
  assert.throws(() => evaluateAdaptiveStateValidity(rows), /missing representation plan2_belief/u);

  const crossed = syntheticValidityRows();
  crossed[1].groups.dialogue_id = crossed[0].groups.dialogue_id;
  assert.throws(() => evaluateAdaptiveStateValidity(crossed), /crosses grouped holdout identities/u);

  const baselineDrift = syntheticValidityRows();
  baselineDrift[0].representations.plan2_belief.lean_baseline.constant = 2;
  assert.throws(() => evaluateAdaptiveStateValidity(baselineDrift), /byte-equal lean baseline/u);
});

function fixtureHashes() {
  return Object.fromEntries(
    ['runner', 'analyzer', 'policy', 'profile', 'prompt', 'world', 'config'].map((kind) => [
      kind,
      hashCanonicalJson({ kind }),
    ]),
  );
}

function writeSealedAutoEvalSource(root, { runId, world, profile, model, target }) {
  const source = path.join(root, runId);
  const plan = buildExperimentRunPlan({
    runId,
    runner: 'fixture-auto-eval',
    provenance: {
      git: {
        sha: '0123456789abcdef',
        branch: 'test',
        dirty: false,
        fingerprintSha256: hashCanonicalJson({ clean: true }),
      },
    },
    models: { learner: { requested: `mock/${model}`, resolved: `mock/${model}`, observed: `mock/${model}` } },
    requiredObservedModelRoles: [],
    hashes: fixtureHashes(),
    masterSeed: 11,
    jobs: [{ id: `${runId}-job` }],
  });
  createRunPlan(source, plan);
  appendRunEvent(source, { type: 'run_started' });
  const traceDir = path.join(source, 'traces');
  fs.mkdirSync(traceDir, { recursive: true });
  const first = turnRecord({ turn: 1, coverage: 0.2, bottleneck: 'release_or_pacing_gap' });
  first.learner = target === 'assertion_gap' ? 'I need to connect the evidence.' : 'Can you just tell me?';
  const second = turnRecord({ turn: 2, coverage: 0.45, bottleneck: target, agency: 'steering' });
  fs.writeFileSync(
    path.join(traceDir, 'dialogue.jsonl'),
    `${[
      { type: 'run_start', metadata: { worldId: world } },
      { type: 'turn_complete', turnRecord: first },
      { type: 'turn_complete', turnRecord: second },
    ]
      .map(JSON.stringify)
      .join('\n')}\n`,
  );
  fs.writeFileSync(
    path.join(source, 'auto-eval-fixture.json'),
    `${JSON.stringify({
      schema: 'machinespirits.tutor-stub.auto-eval.v1',
      config: { world, autoLearnerProfileId: profile, dagMode: `family-${target}` },
      results: [],
    })}\n`,
  );
  appendRunEvent(source, { type: 'run_completed' });
  createRunSeal(source);
  return source;
}

test('sealed sources export and analyze through byte-verifiable offline transactions', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptive-state-export-'));
  try {
    const sources = [];
    let index = 0;
    for (const world of ['w1', 'w2']) {
      for (const profile of ['p1', 'p2']) {
        for (const model of ['m1', 'm2']) {
          for (const target of ['assertion_gap', 'premature_assertion']) {
            index += 1;
            sources.push(
              writeSealedAutoEvalSource(root, {
                runId: `source-${index}`,
                world,
                profile,
                model,
                target,
              }),
            );
          }
        }
      }
    }
    const configPath = path.join(root, 'benchmark.yaml');
    const tasksPath = path.join(root, 'tasks.yaml');
    fs.writeFileSync(
      configPath,
      [
        'schema: machinespirits.adaptive-state-benchmark-config.v1',
        'claim_boundary: fixture only',
        'fixed_horizon_turns: 2',
        'prediction_origin:',
        '  id: after_learner_observation_before_tutor_action',
        'forbidden_keys: [hiddenLearnerState, hidden_state, actualMisconception, answer_key, expected_label]',
        'splits:',
        '  method: leave_one_group_level_out',
        '  atomic_unit: dialogue_id',
        '  group_axes: [world, scenario_family, latent_generator_family, learner_source, model_family]',
        '',
      ].join('\n'),
    );
    fs.writeFileSync(
      tasksPath,
      [
        'schema: machinespirits.adaptive-state-task-metadata.v1',
        'worlds:',
        '  w1: &task',
        '    task_id: fixture-task',
        '    knowledge_component: evidence linkage',
        '    prerequisite_path: [identify evidence]',
        '    item_difficulty: 0.5',
        '    item_discrimination: 1.0',
        '  w2: *task',
        '',
      ].join('\n'),
    );

    const exported = exportAdaptiveStateBenchmark({
      sourceDirs: sources,
      outDir: path.join(root, 'benchmark-export'),
      configPath,
      taskMetadataPath: tasksPath,
      runSeed: 19,
    });
    assert.equal(exported.rows.length, 16);
    assert.equal(verifyExperimentRun(exported.output).ok, true);
    assert.ok(exported.splitManifest.folds.length >= 8);

    const analyzed = analyzeAdaptiveStateBenchmark({
      benchmarkDir: exported.output,
      outDir: path.join(root, 'benchmark-analysis'),
      targets: ['next_error_family'],
      k: 3,
      runSeed: 23,
    });
    assert.equal(verifyExperimentRun(analyzed.output).ok, true);
    assert.equal(analyzed.report.rowCount, 16);
    assert.equal(analyzed.report.uncertainty.method, 'paired_group_bootstrap');
    assert.equal(analyzed.report.splitManifestSha256, hashCanonicalJson(exported.splitManifest));
    assert.equal(analyzed.report.foldsSha256, hashCanonicalJson(exported.splitManifest.folds));
    assert.ok(fs.existsSync(path.join(analyzed.output, 'state-validity-report.md')));
    assert.match(fs.readFileSync(path.join(analyzed.output, 'state-validity-report.md'), 'utf8'), /P\(improve\)/u);
    assert.equal(analyzed.verification.plan.lineage.parentRunId, exported.verification.plan.runId);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
