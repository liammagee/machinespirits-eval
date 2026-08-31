import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildActionOutcomeMemory,
  planActionMemoryDemotions,
  scrambleActionOutcomeMemory,
} from '../services/adaptiveTutor/actionOutcomeMemory.js';
import { estimateLearnerStateBelief, selectPedagogicalAction } from '../services/adaptiveTutor/actionPolicy.js';
import { createScaffoldLifecycle } from '../services/adaptiveTutor/scaffoldLifecycle.js';
import { createTutorStubTypedActionPlanningRuntime } from '../services/tutorStubTypedActionPlanningRuntime.js';
import { reconcileTutorStubTypedActionWithWarrant } from '../services/tutorStubTurnOrchestration.js';
import { projectTutorStubResponsePolicyContext } from '../services/tutorStubResponsePolicyContext.js';
import { classificationFixture, dagModelFixture, tutorLearnerDagFixture } from './tutorStubRegisterPolicyFixtures.js';

const NOW = '2026-08-31T12:00:00.000Z';
const DAY = 24 * 60 * 60 * 1000;

function record(id, overrides = {}) {
  return {
    id,
    dialogueId: `dialogue-${id}`,
    contractId: `contract-${id}`,
    worldId: 'world-a',
    conditionId: 'stalled',
    contextKey: 'observer-v1|task-v1|support-1',
    actionType: 'request_evidence',
    decisionTurn: 2,
    observationTurn: 3,
    observedAt: '2026-08-30T12:00:00.000Z',
    recordedAt: '2026-08-30T12:00:00.000Z',
    supportLevel: 1,
    outcome: 'failure',
    status: 'closed',
    delivery: 'delivered',
    deliveredActionType: 'request_evidence',
    supersedes: [],
    ...overrides,
  };
}

function memory(rows, options = {}) {
  return buildActionOutcomeMemory(rows, { asOf: NOW, source: 'fixture-current', ...options });
}

function context(overrides = {}) {
  return {
    conditionId: 'stalled',
    contextKey: 'observer-v1|task-v1|support-1',
    worldId: 'world-a',
    dialogueId: 'evaluation-dialogue',
    asOf: NOW,
    supportLevel: 1,
    ...overrides,
  };
}

function policy(overrides = {}) {
  return {
    enabled: true,
    scope: 'exact_world',
    minObservations: 2,
    minDialogues: 2,
    successFloor: 0.5,
    penalty: 2,
    maxAgeMs: 7 * DAY,
    ...overrides,
  };
}

const CANDIDATES = [{ action_type: 'request_evidence' }, { action_type: 'explain_principle' }];

test('memory counts only closed, delivered, next-public-turn observations before the cutoff', () => {
  const rows = [
    record('failure'),
    record('success', { outcome: 'success' }),
    record('partial', { outcome: 'partial' }),
    record('inconclusive', { outcome: 'inconclusive' }),
    record('pending', { status: 'pending' }),
    record('displaced', { delivery: 'displaced', deliveredActionType: 'explain_principle' }),
    record('late', { observedAt: '2026-09-01T00:00:00.000Z' }),
    record('wrong-turn', { observationTurn: 4 }),
  ];
  const snapshot = memory(rows);
  const cell = snapshot.cells[0];

  assert.equal(snapshot.records.length, 4);
  assert.deepEqual(
    { success: cell.success, failure: cell.failure, partial: cell.partial, inconclusive: cell.inconclusive, n: cell.n },
    { success: 1, failure: 1, partial: 1, inconclusive: 1, n: 2 },
  );
  assert.deepEqual(snapshot.exclusions.map((row) => row.reason).sort(), [
    'after_cutoff',
    'not_closed',
    'not_next_public_turn',
    'unverified_or_displaced_delivery',
  ]);
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.records[0]));
});

test('supported low rates demote every candidate in the affected move family', () => {
  const snapshot = memory([record('a'), record('b')]);
  const plan = planActionMemoryDemotions(
    snapshot,
    context(),
    [{ action_type: 'request_evidence' }, { action_type: 'ask_strategy_choice' }, { action_type: 'explain_principle' }],
    policy(),
  );

  assert.equal(plan.disposition, 'demote');
  assert.equal(plan.reason, 'supported_low_rate');
  assert.deepEqual(plan.penalties, { request_evidence: 2, ask_strategy_choice: 2 });
  assert.equal(plan.families.find((row) => row.family === 'request_self_explanation').rate, 0);
});

test('partial and inconclusive records never create binary support', () => {
  const snapshot = memory([
    record('partial', { outcome: 'partial' }),
    record('inconclusive', { outcome: 'inconclusive' }),
  ]);
  const plan = planActionMemoryDemotions(snapshot, context(), CANDIDATES, policy());
  const family = plan.families.find((row) => row.family === 'request_self_explanation');

  assert.equal(plan.disposition, 'abstain');
  assert.equal(family.reason, 'low_support');
  assert.deepEqual(
    { n: family.n, partial: family.partial, inconclusive: family.inconclusive },
    { n: 0, partial: 1, inconclusive: 1 },
  );
});

test('measurement disagreement is retained and stops the affected lookup instead of becoming missing data', () => {
  const snapshot = memory([record('a'), record('b'), record('uncertain', { outcome: 'measurement_indeterminate' })]);
  assert.equal(snapshot.records.length, 3);
  assert.equal(snapshot.cells[0].measurement_indeterminate, 1);
  assert.equal(
    planActionMemoryDemotions(snapshot, context(), CANDIDATES, policy()).reason,
    'measurement_indeterminate',
  );
});

test('minimum support counts independent dialogues rather than repeated turns', () => {
  const snapshot = memory([
    record('turn-1', { dialogueId: 'same-dialogue', contractId: 'c1' }),
    record('turn-2', { dialogueId: 'same-dialogue', contractId: 'c2' }),
  ]);
  const plan = planActionMemoryDemotions(snapshot, context(), CANDIDATES, policy());
  const family = plan.families.find((row) => row.family === 'request_self_explanation');

  assert.equal(family.n, 2);
  assert.equal(family.dialogues, 1);
  assert.equal(family.reason, 'low_support');
  assert.deepEqual(plan.penalties, {});
});

test('stale records abstain instead of carrying an imperative beyond its evidence window', () => {
  const snapshot = memory([
    record('old-a', { observedAt: '2026-07-01T00:00:00.000Z' }),
    record('old-b', { observedAt: '2026-07-02T00:00:00.000Z' }),
  ]);
  const plan = planActionMemoryDemotions(snapshot, context(), CANDIDATES, policy({ maxAgeMs: 14 * DAY }));

  assert.equal(plan.disposition, 'abstain');
  assert.equal(plan.reason, 'stale_memory');
  assert.deepEqual(plan.penalties, {});
});

test('duplicate observations do not inflate support and contradictions force abstention', () => {
  const duplicate = record('duplicate', { dialogueId: 'dialogue-a', contractId: 'contract-a' });
  const duplicated = memory([duplicate, { ...duplicate, id: 'duplicate-copy' }]);
  assert.equal(duplicated.records.length, 1);
  assert.equal(duplicated.cells[0].n, 1);
  assert.equal(duplicated.exclusions[0].reason, 'duplicate');

  const contradicted = memory([
    record('original', { dialogueId: 'dialogue-c', contractId: 'contract-c', outcome: 'success' }),
    record('conflict', { dialogueId: 'dialogue-c', contractId: 'contract-c', outcome: 'failure' }),
  ]);
  const plan = planActionMemoryDemotions(contradicted, context(), CANDIDATES, policy());
  assert.equal(contradicted.records.length, 0);
  assert.equal(contradicted.conflicts.length, 2);
  assert.equal(plan.reason, 'contradictory_records');
});

test('explicit supersession can correct one intervention without preferring an attractive outcome', () => {
  const original = record('original', { dialogueId: 'dialogue-c', contractId: 'contract-c', outcome: 'success' });
  const correction = record('correction', {
    dialogueId: 'dialogue-c',
    contractId: 'contract-c',
    outcome: 'failure',
    supersedes: ['original'],
    recordedAt: '2026-08-31T11:00:00.000Z',
  });
  const snapshot = memory([original, correction]);

  assert.equal(snapshot.conflicts.length, 0);
  assert.equal(snapshot.records[0].id, 'correction');
  assert.equal(snapshot.records[0].outcome, 'failure');
  assert.deepEqual(snapshot.exclusions, [{ id: 'original', reason: 'superseded' }]);
});

test('condition scramble preserves support and marginal outcomes while moving associations', () => {
  const rows = [
    record('stalled-a'),
    record('stalled-b'),
    record('moving-a', { conditionId: 'moving', outcome: 'success' }),
    record('moving-b', { conditionId: 'moving', outcome: 'success' }),
  ];
  const current = memory(rows);
  const scrambled = scrambleActionOutcomeMemory(
    current,
    { stalled: 'moving', moving: 'stalled' },
    { source: 'fixture-scrambled' },
  );
  const total = (snapshot, key) => snapshot.cells.reduce((sum, cell) => sum + cell[key], 0);

  for (const key of ['success', 'failure', 'partial', 'inconclusive', 'n']) {
    assert.equal(total(scrambled, key), total(current, key));
  }
  assert.equal(planActionMemoryDemotions(current, context(), CANDIDATES, policy()).disposition, 'demote');
  assert.equal(planActionMemoryDemotions(scrambled, context(), CANDIDATES, policy()).disposition, 'abstain');
  assert.deepEqual(scrambled.control, { type: 'condition_scramble', source: 'fixture-current' });
});

test('held-out pooling forbids evaluation-world leakage and reports cross-world disagreement', () => {
  const pooled = memory([
    record('a1', { worldId: 'world-a', dialogueId: 'a1' }),
    record('a2', { worldId: 'world-a', dialogueId: 'a2' }),
    record('b1', { worldId: 'world-b', dialogueId: 'b1' }),
    record('b2', { worldId: 'world-b', dialogueId: 'b2' }),
  ]);
  const heldOut = policy({ scope: 'held_out_world', minWorlds: 2 });

  assert.equal(
    planActionMemoryDemotions(pooled, context({ worldId: 'world-c' }), CANDIDATES, heldOut).disposition,
    'demote',
  );
  assert.equal(
    planActionMemoryDemotions(pooled, context({ worldId: 'world-a' }), CANDIDATES, heldOut).reason,
    'evaluation_world_in_memory',
  );

  const disagreement = memory([
    record('a-fail', { worldId: 'world-a', dialogueId: 'a-fail' }),
    record('a-fail-2', { worldId: 'world-a', dialogueId: 'a-fail-2' }),
    record('b-success', { worldId: 'world-b', dialogueId: 'b-success', outcome: 'success' }),
    record('b-success-2', { worldId: 'world-b', dialogueId: 'b-success-2', outcome: 'success' }),
  ]);
  const plan = planActionMemoryDemotions(disagreement, context({ worldId: 'world-c' }), CANDIDATES, heldOut);
  assert.equal(plan.disposition, 'abstain');
  assert.equal(plan.families.find((row) => row.family === 'request_self_explanation').reason, 'world_disagreement');
});

test('excluded worlds and current-dialogue records cannot cross the evaluation boundary', () => {
  const snapshot = memory([record('training'), record('heldout', { worldId: 'world-c' })], {
    excludedWorldIds: ['world-c'],
  });
  assert.deepEqual(snapshot.exclusions, [{ id: 'heldout', reason: 'excluded_world' }]);
  assert.equal(
    planActionMemoryDemotions(snapshot, context({ dialogueId: 'dialogue-training' }), CANDIDATES, policy()).reason,
    'current_dialogue_in_memory',
  );
});

test('future corrections cannot retroactively alter the pre-decision evidence view', () => {
  const original = record('original', { dialogueId: 'd', contractId: 'c', outcome: 'success' });
  const futureCorrection = record('correction', {
    dialogueId: 'd',
    contractId: 'c',
    supersedes: ['original'],
    recordedAt: '2026-09-01T00:00:00.000Z',
  });
  const snapshot = memory([original, futureCorrection]);
  assert.equal(snapshot.records[0].outcome, 'success');
  assert.deepEqual(snapshot.exclusions, [{ id: 'correction', reason: 'recorded_after_cutoff' }]);
  assert.equal(
    planActionMemoryDemotions(memory([original], { asOf: '2026-09-01T00:00:00.000Z' }), context(), CANDIDATES, policy())
      .reason,
    'future_snapshot',
  );
  const badImport = structuredClone(snapshot);
  badImport.records[0].recordedAt = '2026-09-01T00:00:00.000Z';
  assert.equal(planActionMemoryDemotions(badImport, context(), CANDIDATES, policy()).reason, 'invalid_record_timing');
});

test('irrelevant conditions, incompatible support, and unseen worlds abstain with no fallback', () => {
  const snapshot = memory([record('a'), record('b')]);
  for (const changed of [
    { conditionId: 'different-condition' },
    { contextKey: 'different-observer' },
    { supportLevel: 2 },
    { worldId: 'never-observed-world' },
  ]) {
    const plan = planActionMemoryDemotions(snapshot, context(changed), CANDIDATES, policy());
    assert.equal(plan.reason, 'no_matching_records');
    assert.deepEqual(plan.penalties, {});
  }
  const pooled = planActionMemoryDemotions(
    snapshot,
    context({ worldId: 'world-c' }),
    CANDIDATES,
    policy({ scope: 'held_out_world', minWorlds: 2 }),
  );
  assert.equal(pooled.families.find((row) => row.family === 'request_self_explanation').reason, 'low_world_support');
});

test('a recent observation cannot launder old observations into support', () => {
  const snapshot = memory([record('old', { observedAt: '2026-07-01T00:00:00.000Z' }), record('fresh')]);
  const plan = planActionMemoryDemotions(snapshot, context(), CANDIDATES, policy());
  const family = plan.families.find((row) => row.family === 'request_self_explanation');
  assert.equal(family.n, 1);
  assert.equal(family.staleRecords, 1);
  assert.equal(family.reason, 'low_support');
});

test('reused evidence ids and non-permutations fail rather than changing support silently', () => {
  assert.throws(
    () =>
      memory([record('same-id'), record('same-id', { dialogueId: 'other-dialogue', contractId: 'other-contract' })]),
    /id reused across interventions/u,
  );
  const snapshot = memory([record('a'), record('b', { conditionId: 'moving' })]);
  assert.throws(
    () => scrambleActionOutcomeMemory(snapshot, { stalled: 'moving', moving: 'moving' }, { source: 'bad' }),
    /bijection/u,
  );
  assert.throws(
    () => scrambleActionOutcomeMemory(snapshot, { stalled: 'invented', moving: 'stalled' }, { source: 'bad' }),
    /bijection/u,
  );
});

test('policy thresholds have no defaults and invalid action identities fail loud', () => {
  const snapshot = memory([record('a'), record('b')]);
  assert.throws(
    () => planActionMemoryDemotions(snapshot, context(), CANDIDATES, { enabled: true, scope: 'exact_world' }),
    /positive minObservations/u,
  );
  for (const actionType of ['misspelled-action', 'toString', 'constructor', '__proto__']) {
    assert.throws(
      () => planActionMemoryDemotions(snapshot, context(), [{ action_type: actionType }], policy()),
      /unknown action type/u,
    );
    const invalid = memory([record('invalid', { actionType, deliveredActionType: actionType })]);
    assert.equal(invalid.records.length, 0);
    assert.equal(invalid.exclusions[0].reason, 'unknown_action_type');
  }
  assert.equal(planActionMemoryDemotions(snapshot, context(), CANDIDATES, { enabled: false }).reason, 'disabled');
});

test('empty penalties preserve the full selection and negative penalties cannot promote an action', () => {
  const input = {
    stateBelief: estimateLearnerStateBelief({
      dialogue: [{ role: 'learner', content: "I don't get why that works." }],
    }),
  };
  const baseline = selectPedagogicalAction(input);
  assert.deepEqual(selectPedagogicalAction({ ...input, config: { actionUtilityPenalties: {} } }), baseline);
  assert.throws(
    () => selectPedagogicalAction({ ...input, config: { actionUtilityPenalties: { minimal_hint: -1 } } }),
    /nonnegative penalties/u,
  );
  for (const actionType of ['typo', 'toString', 'constructor', '__proto__']) {
    assert.throws(
      () => selectPedagogicalAction({ ...input, config: { actionUtilityPenalties: { [actionType]: 1 } } }),
      /known actions/u,
    );
  }
});

test('mandatory diagnostic and prerequisite escalation survive even overwhelming memory penalties', () => {
  const diagnostic = {
    stateBelief: estimateLearnerStateBelief({
      dialogue: [{ role: 'learner', content: "I don't get why that works." }],
    }),
    config: { actionUtilityPenalties: { diagnose_with_discriminating_question: 1000 } },
  };
  assert.equal(selectPedagogicalAction(diagnostic).selectedAction.action_type, 'diagnose_with_discriminating_question');
  const interventionLedger = [
    {
      status: 'closed',
      outcome: 'inconclusive',
      action_type: 'minimal_hint',
      hypothesis_ids: ['missing_prerequisite', 'low_confidence'],
    },
  ];
  const stateBelief = estimateLearnerStateBelief({
    dialogue: [
      {
        role: 'learner',
        content:
          'The small hint is still not enough; I need the prerequisite idea before I can apply it to a similar problem.',
      },
    ],
    interventionLedger,
  });
  assert.equal(
    selectPedagogicalAction({
      stateBelief,
      interventionLedger,
      config: { actionUtilityPenalties: { explain_principle: 1000 } },
    }).selectedAction.action_type,
    'explain_principle',
  );
});

test('a discretionary preferred action after an unsuccessful diagnostic can actually be demoted', () => {
  const stateBelief = estimateLearnerStateBelief({
    dialogue: [{ role: 'learner', content: "I don't get why that works." }],
    turnIndex: 1,
  });
  const interventionLedger = [
    {
      status: 'closed',
      outcome: 'inconclusive',
      action_type: 'diagnose_with_discriminating_question',
      hypothesis_ids: ['missing_prerequisite', 'low_confidence'],
    },
  ];
  const baseline = selectPedagogicalAction({ stateBelief, interventionLedger });
  const changed = selectPedagogicalAction({
    stateBelief,
    interventionLedger,
    config: { actionUtilityPenalties: { minimal_hint: 2 } },
  });

  assert.equal(baseline.selectedAction.action_type, 'minimal_hint');
  assert.notEqual(changed.selectedAction.action_type, 'minimal_hint');
  const hint = changed.candidateActions.find((row) => row.action_type === 'minimal_hint');
  if (hint) assert.equal(hint.action_memory_penalty, 2);
});

function runtimeInput({ supportLevel = 1 } = {}) {
  const classification = classificationFixture();
  const turns = [1, 2].map((turn) => ({
    turn,
    learner: "I don't get why that works.",
    tutor: 'Which public clue would you check?',
    classification,
    tutorLearnerDagModel: dagModelFixture({ turn }),
  }));
  return {
    state: {
      turns,
      world: { id: 'world-a' },
      register: { enabled: false, history: [] },
      typedActions: {
        enabled: true,
        ledger: [],
        scaffoldLifecycle: { ...createScaffoldLifecycle(), phase: 'support' },
        config: {
          task: {
            taskId: 'task-v1',
            knowledgeComponent: 'public-reasoning',
            prerequisitePath: [],
            itemDifficulty: 0.5,
          },
          supportLevel,
        },
      },
    },
    learnerText: "I don't get why that works.",
    stateObservation: {
      schema: 'mock-public-observation',
      axes: {
        proof: 0.4,
        release: 0.4,
        ownership: 0.4,
        conceptual_mastery: 0.4,
        metacognitive_accuracy: 0.4,
        affective_readiness: 0.4,
      },
    },
    turn: 3,
    classification,
    tutorLearnerDag: tutorLearnerDagFixture(dagModelFixture({ turn: 3 })),
    registerSelection: { selected_register: 'precise', engagement_stance: 'precise', turn: 3 },
  };
}

function runPlanner(input, controller = null) {
  const events = [];
  const runtime = createTutorStubTypedActionPlanningRuntime({
    C: {},
    answerTermForWorld: () => '',
    appendTraceEvent: (_trace, event) => events.push(event),
    buildTutorDagSnapshot: () => ({}),
    currentReleaseRows: () => [],
    explicitPerformanceActorialPartSelection: () => null,
    explicitPerformanceDirectiveValue: () => null,
    jsonClone: structuredClone,
    policySamplingContext: () => ({}),
    randomPerformanceActorialPartSelection: () => null,
    registerTemperatureApplies: () => false,
    stateRunDebugId: () => 'evaluation-dialogue',
    writeLine() {},
    now: () => NOW,
    actionOutcomeMemory: controller,
  });
  return { result: runtime.planTypedAction(input), events, runtime };
}

function controller(snapshot, overrides = {}) {
  return {
    snapshot,
    contextKey: 'observer-v1|task-v1|support-1',
    // These are synthetic test settings, not proposed scientific thresholds.
    condition: { id: 'stalled', stagnationAtLeast: 0.5, fieldVelocityAtMost: 0.01, dagVelocityAtMost: 0.01 },
    policy: policy(),
    ...overrides,
  };
}

test('typed runtime is unchanged with memory disabled and keeps all memory material out of prompt projection', () => {
  const snapshot = memory([record('a'), record('b')], { source: 'PRIVATE_MEMORY_SENTINEL' });
  const baseline = runPlanner(runtimeInput());
  const disabled = runPlanner(runtimeInput(), controller(snapshot, { policy: policy({ enabled: false }) }));
  assert.deepEqual(disabled.result, baseline.result);
  assert.deepEqual(disabled.events, baseline.events);
  const replayInput = baseline.result.decision.decision_provenance.selection_input;
  const replay = selectPedagogicalAction(replayInput);
  assert.equal(replay.selectedAction.action_type, baseline.result.decision.chosen_action.action_type);
  assert.equal(baseline.result.decision.decision_provenance.memory_observation.observed, true);
  assert.ok(
    replayInput.interventionLedger.every((record) => record.contract_id !== baseline.result.decision.contract_id),
  );

  const active = runPlanner(runtimeInput(), controller(snapshot));
  const audit = active.events.find((event) => event.type === 'tutor_action_outcome_memory');
  assert.ok(audit);
  assert.equal(audit.memory.detector.detected, true);
  assert.equal(audit.memory.source, 'PRIVATE_MEMORY_SENTINEL');
  const prompt = projectTutorStubResponsePolicyContext(active.result.registerSelection);
  assert.doesNotMatch(
    prompt,
    /PRIVATE_MEMORY_SENTINEL|observer-v1|action_memory_penalty|supported_low_rate|successFloor|selection_input|memory_observation/u,
  );
  assert.equal(active.result.decision.chosen_action.support_level, 1);
  assert.equal(active.result.decision.chosen_action.task_id, 'task-v1');
  assert.equal(active.result.decision.chosen_action.register, baseline.result.decision.chosen_action.register);
});

test('typed runtime demotes a family only at the detected condition and with support held fixed', () => {
  const baseline = runPlanner(runtimeInput());
  const actionType = baseline.result.decision.chosen_action.action_type;
  const snapshot = memory([
    record('a', { actionType, deliveredActionType: actionType }),
    record('b', { actionType, deliveredActionType: actionType }),
  ]);
  const active = runPlanner(runtimeInput(), controller(snapshot));
  const audit = active.events.find((event) => event.type === 'tutor_action_outcome_memory');
  assert.equal(audit.memory.disposition, 'demote');
  assert.equal(audit.changed, true);
  assert.notEqual(active.result.decision.chosen_action.move_family, baseline.result.decision.chosen_action.move_family);
  assert.ok(
    active.result.decision.decision_provenance.scaffold_lifecycle_gate.allowed_move_families.includes(
      active.result.decision.chosen_action.move_family,
    ),
  );

  const unfixed = runPlanner(runtimeInput({ supportLevel: null }), controller(snapshot));
  assert.equal(
    unfixed.events.find((event) => event.type === 'tutor_action_outcome_memory').memory.reason,
    'support_not_fixed',
  );
  const input = runtimeInput();
  input.state.turns = [];
  const coldStart = runPlanner(input, controller(snapshot));
  assert.equal(
    coldStart.events.find((event) => event.type === 'tutor_action_outcome_memory').memory.reason,
    'condition_not_detected',
  );
});

test('next-turn closure credits the selected action and a later warrant override cancels that credit', () => {
  const baseline = runPlanner(runtimeInput());
  const actionType = baseline.result.decision.chosen_action.action_type;
  const snapshot = memory([
    record('a', { actionType, deliveredActionType: actionType }),
    record('b', { actionType, deliveredActionType: actionType }),
  ]);
  const normalInput = runtimeInput();
  const normal = runPlanner(normalInput, controller(snapshot));
  const outcome = normal.runtime.closePriorTypedAction({
    state: normalInput.state,
    learnerText: 'I choose the mark because it supports the public rule.',
    turn: 4,
  });
  assert.equal(outcome.contract_id, normal.result.decision.contract_id);
  assert.equal(outcome.closed_record.action_type, normal.result.decision.chosen_action.action_type);
  assert.notEqual(outcome.closed_record.action_type, actionType);
  assert.equal(snapshot.records.length, 2, 'a resolved dialogue never writes itself into the supplied snapshot');

  const displacedInput = runtimeInput();
  const displaced = runPlanner(displacedInput, controller(snapshot));
  const result = reconcileTutorStubTypedActionWithWarrant({
    state: displacedInput.state,
    typedAction: displaced.result,
    warrantFinalAuthority: { desired_action_family: 'test_warrant', optional_configuration_displaced: true },
    appendTrace: (_trace, event) => displaced.events.push(event),
  });
  assert.equal(result.displaced, true);
  assert.equal(displacedInput.state.typedActions.ledger[0].status, 'cancelled_before_delivery');
  assert.equal(
    displaced.runtime.closePriorTypedAction({
      state: displacedInput.state,
      learnerText: 'I choose the mark because it supports the public rule.',
      turn: 4,
    }),
    null,
  );
  assert.ok(displaced.events.some((event) => event.type === 'tutor_typed_action_decision_displaced'));
});
