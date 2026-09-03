import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  TUTOR_STUB_RESISTANT_LEARNER_OBSERVATION_SEMANTICS_ENV,
  createTutorStubAutomatedLearnerGenerationRuntime,
} from '../services/tutorStubAutomatedLearnerGenerationRuntime.js';
import { tutorStubBoredomUnreadableTurnIsPassedOver } from '../services/tutorStubBoredomActionRegisterProofDagStudy.js';
import {
  completeTutorStubResistanceManipulationValidation,
  createTutorStubTurnOrchestration,
} from '../services/tutorStubTurnOrchestration.js';
import {
  learnerProfileContract,
  learnerProfileIds,
  learnerProfilePrompt,
} from '../scripts/tutor-stub-learner-profile-contracts.js';

const ORCHESTRATION_SOURCE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'services',
  'tutorStubTurnOrchestration.js',
);

/** The smallest dependency set a passthrough turn actually reaches. */
function passthroughOrchestration(events, tutorText) {
  return createTutorStubTurnOrchestration({
    appendTraceEvent(_trace, event) {
      events.push(event);
    },
    appendTutorStubTurnFailureTraceRecords() {},
    assertTutorStubTurnAttemptCurrent() {},
    callTutor: async () => ({ text: tutorText, provider: 'test', model: 'test', usage: null }),
    createTutorStubLearnerResponseProvenance: () => ({ source: 'test' }),
    jsonClone: (value) => (value == null ? value : JSON.parse(JSON.stringify(value))),
    recordTutorStubTurnTiming: () => null,
    turnDebugId: (_state, turn) => `t${turn}`,
  });
}

test('turn orchestration rejects an empty learner turn before tutor dispatch', async () => {
  const events = [];
  const orchestration = createTutorStubTurnOrchestration({
    appendTraceEvent(_trace, event) {
      events.push(event);
    },
  });

  await assert.rejects(
    orchestration.runOneTurn('   ', { trace: null, turns: [] }),
    /empty learner turn: no tutor response can be generated without learner text/u,
  );
  assert.deepEqual(events, [{ type: 'empty_learner_turn_rejected', turn: 1 }]);
});

test('prospective-v9 orchestration stops measurement-indeterminate boredom before tutor output or repair', async () => {
  const events = [];
  let adjudications = 0;
  let tutorCalls = 0;
  const orchestration = createTutorStubTurnOrchestration({
    adjudicateTutorStubBoredomObservation: async () => {
      adjudications += 1;
      return {
        schema: 'machinespirits.tutor-stub.boredom-semantic-adjudication.v1',
        measurement_disposition: 'measurement_indeterminate',
        confidence: 0.62,
      };
    },
    appendTraceEvent(_trace, event) {
      events.push(event);
    },
    assertTutorStubTurnAttemptCurrent() {},
    callTutor: async () => {
      tutorCalls += 1;
      return { text: 'must not be called' };
    },
    createTutorStubLearnerResponseProvenance: () => ({ source: 'test' }),
    jsonClone: (value) => (value == null ? value : JSON.parse(JSON.stringify(value))),
    turnDebugId: (_state, turn) => `t${turn}`,
  });
  const state = {
    trace: null,
    turns: [],
    history: [],
    resistanceActionRegisterStudy: {
      enabled: true,
      dynamic_boredom_proof_dag: true,
      consumed: false,
      job_id: 'semantic-indeterminate-job',
      proof_dag_registration: { design: { observationSemantics: 'prospective_v9' } },
    },
  };
  await assert.rejects(
    orchestration.runOneTurn(
      'Fine. I could inspect the gauge, but I want to stop this task.',
      state,
      { turn: { discourse_move: 'question', evidence_use: 'none' } },
      { advance: { supportedMoveCount: 0 } },
      {},
    ),
    (error) =>
      error.code === 'TUTOR_STUB_BOREDOM_MEASUREMENT_INDETERMINATE' &&
      error.disposition === 'measurement_indeterminate_stop_no_repair_no_replacement',
  );
  assert.equal(adjudications, 1);
  assert.equal(tutorCalls, 0);
  assert.equal(events.filter((event) => event.type === 'boredom_semantic_adjudication').length, 1);
  assert.equal(events.filter((event) => event.type === 'boredom_semantic_measurement_indeterminate').length, 1);
  assert.equal(
    events.filter((event) => event.type === 'boredom_semantic_measurement_indeterminate_passed_over').length,
    0,
  );
});

test('a registration that declares the pass-over disposition reads the next turn instead of stopping', async () => {
  const events = [];
  let adjudications = 0;
  let tutorCalls = 0;
  const orchestration = createTutorStubTurnOrchestration({
    adjudicateTutorStubBoredomObservation: async () => {
      adjudications += 1;
      return {
        schema: 'machinespirits.tutor-stub.boredom-semantic-adjudication.v1',
        measurement_disposition: 'measurement_indeterminate',
        confidence: 0.62,
      };
    },
    appendTraceEvent(_trace, event) {
      events.push(event);
    },
    appendTutorStubTurnFailureTraceRecords() {},
    assertTutorStubTurnAttemptCurrent() {},
    callTutor: async () => {
      tutorCalls += 1;
      return { text: 'So which record settles it — the log or the receipt?', provider: 'test', model: 'test' };
    },
    createTutorStubLearnerResponseProvenance: () => ({ source: 'test' }),
    jsonClone: (value) => (value == null ? value : JSON.parse(JSON.stringify(value))),
    recordTutorStubTurnTiming: () => null,
    turnDebugId: (_state, turn) => `t${turn}`,
  });
  const state = {
    trace: null,
    turns: [],
    history: [],
    resistanceActionRegisterStudy: {
      enabled: true,
      dynamic_boredom_proof_dag: true,
      consumed: false,
      job_id: 'semantic-pass-over-job',
      maximum_trigger_turn: 4,
      proof_dag_registration: {
        design: {
          observationSemantics: 'prospective_v9',
          freshPrefixGeneration: {
            maximumTriggerTurn: 4,
            unreadableTurnDisposition: 'pass_over_this_turn_and_read_the_next_one',
          },
        },
      },
    },
  };

  // The turn carries on past the guard into the rest of the machinery, which
  // this narrow stub does not supply. Only the guard is under test here, so
  // catch whatever comes later and assert on the code it is not.
  let raised = null;
  try {
    await orchestration.runOneTurn(
      'Fine. I could inspect the gauge, but I want to stop this task.',
      state,
      { turn: { discourse_move: 'question', evidence_use: 'none' } },
      { advance: { supportedMoveCount: 0 } },
      {},
    );
  } catch (error) {
    raised = error;
  }

  assert.equal(adjudications, 1);
  assert.notEqual(
    raised?.code,
    'TUTOR_STUB_BOREDOM_MEASUREMENT_INDETERMINATE',
    'an unreadable pre-treatment turn must no longer end the dialogue',
  );
  assert.equal(tutorCalls, 0, 'the guard is well before the tutor call, so nothing was spent proving this');
  const passedOver = events.filter((event) => event.type === 'boredom_semantic_measurement_indeterminate_passed_over');
  assert.equal(passedOver.length, 1);
  assert.equal(passedOver[0].disposition, 'measurement_indeterminate_turn_ineligible_read_next_turn');
  assert.equal(passedOver[0].code, 'TUTOR_STUB_BOREDOM_MEASUREMENT_INDETERMINATE_TURN_INELIGIBLE');
  assert.equal(passedOver[0].maximumTriggerTurn, 4, 'the report needs the window this turn was passed over inside');
  assert.equal(
    events.filter((event) => event.type === 'boredom_semantic_measurement_indeterminate').length,
    0,
    'the stop-the-dialogue event must not also fire',
  );
});

test('the pass-over disposition never reaches an outcome turn, because adjudication stops once consumed', async () => {
  const events = [];
  let adjudications = 0;
  const orchestration = createTutorStubTurnOrchestration({
    adjudicateTutorStubBoredomObservation: async () => {
      adjudications += 1;
      return { measurement_disposition: 'measurement_indeterminate' };
    },
    appendTraceEvent(_trace, event) {
      events.push(event);
    },
    appendTutorStubTurnFailureTraceRecords() {},
    assertTutorStubTurnAttemptCurrent() {},
    callTutor: async () => ({ text: 'Which record settles it?', provider: 'test', model: 'test' }),
    createTutorStubLearnerResponseProvenance: () => ({ source: 'test' }),
    jsonClone: (value) => (value == null ? value : JSON.parse(JSON.stringify(value))),
    recordTutorStubTurnTiming: () => null,
    turnDebugId: (_state, turn) => `t${turn}`,
  });

  await orchestration
    .runOneTurn(
      'I checked the log and the hose was dry, so the leak came later.',
      {
        trace: null,
        turns: [],
        history: [],
        resistanceActionRegisterStudy: {
          enabled: true,
          dynamic_boredom_proof_dag: true,
          consumed: true,
          job_id: 'semantic-consumed-job',
          maximum_trigger_turn: 4,
          proof_dag_registration: {
            design: {
              observationSemantics: 'prospective_v9',
              freshPrefixGeneration: {
                maximumTriggerTurn: 4,
                unreadableTurnDisposition: 'pass_over_this_turn_and_read_the_next_one',
              },
            },
          },
        },
      },
      { turn: { discourse_move: 'claim', evidence_use: 'cited' } },
      { advance: { supportedMoveCount: 1 } },
      {},
    )
    .catch(() => null);

  assert.equal(adjudications, 0, 'a consumed study never re-reads a turn, so no outcome turn can be passed over');
  assert.equal(
    events.filter((event) => String(event.type || '').startsWith('boredom_semantic_measurement_indeterminate')).length,
    0,
  );
});

test('only a registration that declares the pass-over disposition gets it', () => {
  const withDisposition = (unreadableTurnDisposition) => ({
    proof_dag_registration: { design: { freshPrefixGeneration: { unreadableTurnDisposition } } },
  });

  assert.equal(
    tutorStubBoredomUnreadableTurnIsPassedOver(withDisposition('pass_over_this_turn_and_read_the_next_one')),
    true,
  );
  assert.equal(
    tutorStubBoredomUnreadableTurnIsPassedOver({}),
    false,
    'a v4 registration carries no such field and keeps the original stop',
  );
  assert.equal(tutorStubBoredomUnreadableTurnIsPassedOver(null), false);
  assert.equal(
    tutorStubBoredomUnreadableTurnIsPassedOver(withDisposition('stop_the_whole_dialogue')),
    false,
    'any other declared value is not the pass-over disposition',
  );
  assert.equal(
    tutorStubBoredomUnreadableTurnIsPassedOver({
      registration: {
        design: { freshPrefixGeneration: { unreadableTurnDisposition: 'pass_over_this_turn_and_read_the_next_one' } },
      },
    }),
    false,
    'the boredom study reads proof_dag_registration, not the resistance registration slot',
  );
});

test('a completed turn stamps what the reply did, just before the turn closes', async () => {
  const events = [];
  const orchestration = passthroughOrchestration(
    events,
    'Fair — plain words. The entry says the hose stayed dry. Go and check it, then tell me.',
  );

  await orchestration.runOneTurn('Stop the invoice-speak. What did the entry say about the hose?', {
    trace: null,
    turns: [],
    history: [],
    passthrough: { enabled: true },
  });

  const types = events.map((event) => event.type);
  assert.equal(types.at(-2), 'tutor_reply_features');
  assert.equal(types.at(-1), 'turn_complete');

  const stamp = events.at(-2);
  assert.equal(stamp.turnId, 't1');
  assert.equal(stamp.turn, 1);
  assert.equal(stamp.acts.restate, true);
  assert.equal(stamp.acts.cite, true);
  assert.equal(stamp.acts.assign, true);
  assert.equal(stamp.authority, 'record');
  // Her word came back, which is only visible because the learner turn was
  // passed alongside the reply.
  assert.ok(stamp.counts.learnerEcho.shared >= 1);
});

test('the stamp records the reply and nothing about what was ordered', async () => {
  const events = [];
  const orchestration = passthroughOrchestration(events, 'The ledger says otherwise.');
  await orchestration.runOneTurn('It was dry.', {
    trace: null,
    turns: [],
    history: [],
    passthrough: { enabled: true },
    // Present in the state and deliberately not consulted: if any of it
    // reached the stamp, a figure would separate because the card was copied
    // into the features, not because the replies differ.
    mannerSwitch: { forcedCard: 'mockery', dose: 3 },
  });

  const stamp = events.find((event) => event.type === 'tutor_reply_features');
  assert.ok(stamp);
  assert.deepEqual(
    Object.keys(stamp).filter((key) => /card|state|dose|pressure|manner|quiet/iu.test(key)),
    [],
  );
  assert.ok(!JSON.stringify(stamp).includes('mockery'));
});

test('every turn-completion path stamps the reply, including the ones no unit test drives', () => {
  // The analyzed and quarantine paths need dozens of collaborators to run, so
  // their coverage is structural: a `turn_complete` that is not immediately
  // preceded by the stamp is a path whose replies would silently go
  // unmeasured — the exact failure the direct import was chosen to avoid.
  const lines = fs.readFileSync(ORCHESTRATION_SOURCE, 'utf8').split('\n');
  const completions = lines
    .map((line, index) => (line.includes("type: 'turn_complete'") ? index : -1))
    .filter((index) => index >= 0);

  assert.equal(completions.length, 3, 'expected three turn-completion paths');
  for (const index of completions) {
    const preceding = lines.slice(Math.max(0, index - 3), index).join('\n');
    assert.ok(
      preceding.includes('recordTutorStubReplyFeatures('),
      `turn_complete at line ${index + 1} is not preceded by a reply-feature stamp`,
    );
  }
});

test('registered action/register production enforcement preserves the third learner analysis without a terminal tutor reply', async () => {
  const events = [];
  let tutorCalls = 0;
  let precomputedAnalyses = 0;
  let outcomeAnalyses = 0;
  const finalRawAnalysis = {
    classification: {
      turn: {
        request_type: 'bounded_test_response',
        discourse_move: 'evidence_adoption',
        evidence_use: 'links_evidence_to_rule',
        epistemic_stance: 'grounded',
        agency: 'attempting',
      },
    },
    dagPreflight: { publicOnly: true, contentSha256: 'final-t3-preflight' },
  };
  const generationRuntime = createTutorStubAutomatedLearnerGenerationRuntime({
    appendTraceEvent(_trace, event) {
      events.push(event);
    },
    callPromptModel() {
      throw new Error('zero-call orchestration regression');
    },
    classificationFromCombinedAnalysis: (raw) => raw.classification,
    env: {},
    extractCombinedLearnerAnalysis: async ({ learnerText, tutorTurn, preflightSource }) => {
      precomputedAnalyses += 1;
      assert.equal(learnerText, 'The bounded public comparison is testable without granting the wider frame.');
      assert.equal(tutorTurn, 3);
      assert.equal(preflightSource, 'registered_final_learner_outcome');
      return finalRawAnalysis;
    },
    learnerProfileContract,
    learnerProfileIds,
    learnerProfilePrompt,
    negativeFloorRegisters: [],
  });
  const orchestration = createTutorStubTurnOrchestration({
    C: { brightBlue: '', bold: '', reset: '' },
    analyzeLearnerTurn: async (_learnerText, _state, { precomputedRaw }) => {
      outcomeAnalyses += 1;
      assert.equal(precomputedRaw, finalRawAnalysis);
      return {
        classification: { turn: { discourse_move: 'evidence_adoption' } },
        tutorLearnerDag: { model: { metrics: { missingPremiseCount: 2, groundedCount: 7 } } },
        previousRegisterEfficacy: null,
      };
    },
    appendTraceEvent(_trace, event) {
      events.push(event);
    },
    assertTutorStubTurnAttemptCurrent() {},
    automatedLearnerProfileId: generationRuntime.automatedLearnerProfileId,
    callTutor: async () => {
      tutorCalls += 1;
      return { text: 'must not be called' };
    },
    createTutorStubLearnerResponseProvenance: (value) => value,
    enforceAutomatedLearnerProfile: generationRuntime.enforceAutomatedLearnerProfile,
    enforceGuardedLearnerConcessionGuard: generationRuntime.enforceGuardedLearnerConcessionGuard,
    generateAutomatedLearnerTurn: async () => ({
      text: 'The bounded public comparison is testable without granting the wider frame.',
      provider: 'test',
      model: 'test',
      latencyMs: 0,
      usage: null,
    }),
    jsonClone: (value) => (value == null ? value : JSON.parse(JSON.stringify(value))),
    learnerProfileSpeakerLabel: () => 'learner',
    printTurnDebugLine() {},
    printWithConcurrentTerminal: (state, action) => action(state),
    startInterimAnimation() {},
    stopInterimAnimation() {},
    turnDebugId: (_state, turn) => `t${turn}`,
  });
  const state = {
    trace: null,
    turns: [
      {
        turn: 1,
        learner:
          'I reject your demand that we choose a matter or term on your framing, and I will not supply evidence or an answer under it.',
        tutor: 'Try the bounded public comparison once.',
        classification: {
          turn: {
            request_type: 'authority_refusal_or_status_challenge',
            discourse_move: 'challenge',
            evidence_use: 'none',
            epistemic_stance: 'resistant',
            agency: 'steering',
          },
        },
      },
      {
        turn: 2,
        learner:
          'I reject your question as the governing test, and I will not name a hand or supply evidence under it.',
        tutor: 'Apply only the local distinction to the public marks.',
        classification: {
          turn: {
            request_type: 'authority_refusal_or_status_challenge',
            discourse_move: 'challenge',
            evidence_use: 'none',
            epistemic_stance: 'resistant',
            agency: 'steering',
          },
        },
      },
    ],
    history: [{ role: 'assistant', content: 'Test one bounded distinction in the public record.' }],
    interim: null,
    classifier: { enabled: true },
    learnerDag: { enabled: true },
    register: { policy: 'field' },
    world: {},
    resistanceActionRegisterStudy: {
      enabled: true,
      final_learner_without_tutor_reply: true,
      outcome_horizon_learner_turns: 2,
      job_id: 'job-1',
      batch_id: 'batch_A',
      prefix_id: 'prefix-1',
    },
  };

  const result = await orchestration.runAutomatedLearnerDialogue({
    state,
    openingEnabled: false,
    autoLearnerResolved: { provider: 'test', model: 'test' },
    autoLearnerProfile: 'frame_refuser',
    autoTurns: 3,
    autoSafetyTurns: 3,
    autoStopOnGrounded: false,
  });

  assert.equal(result.reason, 'registered_outcome_horizon_complete');
  assert.equal(tutorCalls, 0);
  assert.equal(precomputedAnalyses, 1);
  assert.equal(outcomeAnalyses, 1);
  assert.equal(
    events.some((event) => event.type === 'auto_learner_profile_adherence'),
    false,
    'the final analysis must survive after the profile recurrence requirement is already satisfied',
  );
  assert.equal(state.history.at(-1).role, 'user');
  const outcome = events.find((event) => event.type === 'resistance_action_register_outcome_learner_turn');
  assert.equal(outcome.turn, 3);
  assert.equal(outcome.horizonIndex, 2);
  assert.equal(outcome.classification.turn.discourse_move, 'evidence_adoption');
  assert.deepEqual(outcome.tutorLearnerDag.model.metrics, { missingPremiseCount: 2, groundedCount: 7 });
  assert.equal(outcome.tutorReplyGenerated, false);
  assert.equal(Object.hasOwn(outcome, 'triggerTurn'), false);
  assert.equal(Object.hasOwn(outcome, 'triggerLearnerSha256'), false);
  assert.equal(events.at(-1).type, 'auto_learner_run_end');
});

test('registered action/register final candidate receives the one prospective-v4 repair before outcome persistence', async () => {
  const events = [];
  let repairCalls = 0;
  let tutorCalls = 0;
  const initialCandidate = 'I will answer the bounded question as asked.';
  const repairedCandidate =
    'I reject your authority to set this test, and I will not supply evidence or an answer under it.';
  const analysisFor = (learnerText) => ({
    classification: {
      turn:
        learnerText === repairedCandidate
          ? {
              request_type: 'authority_refusal_or_status_challenge',
              discourse_move: 'challenge',
              evidence_use: 'none',
              epistemic_stance: 'resistant',
              agency: 'steering',
            }
          : {
              request_type: 'bounded_test_response',
              discourse_move: 'evidence_adoption',
              evidence_use: 'links_evidence_to_rule',
              epistemic_stance: 'grounded',
              agency: 'attempting',
            },
    },
    dagPreflight: { publicOnly: true, contentSha256: `final-${learnerText.length}` },
  });
  const generationRuntime = createTutorStubAutomatedLearnerGenerationRuntime({
    appendTraceEvent(_trace, event) {
      events.push(event);
    },
    callPromptModel: async () => {
      repairCalls += 1;
      return { text: repairedCandidate, provider: 'test', model: 'test', latencyMs: 0, usage: null };
    },
    classificationFromCombinedAnalysis: (raw) => raw.classification,
    env: { [TUTOR_STUB_RESISTANT_LEARNER_OBSERVATION_SEMANTICS_ENV]: 'prospective_v4' },
    extractCombinedLearnerAnalysis: async ({ learnerText, tutorTurn }) => {
      assert.equal(tutorTurn, 3);
      return analysisFor(learnerText);
    },
    learnerProfileContract,
    learnerProfileIds,
    learnerProfilePrompt,
    negativeFloorRegisters: [],
  });
  const orchestration = createTutorStubTurnOrchestration({
    C: { brightBlue: '', bold: '', reset: '' },
    analyzeLearnerTurn: async (learnerText, _state, { precomputedRaw }) => {
      assert.equal(learnerText, repairedCandidate);
      assert.deepEqual(precomputedRaw, analysisFor(repairedCandidate));
      return {
        classification: precomputedRaw.classification,
        tutorLearnerDag: { model: { metrics: { missingPremiseCount: 6, groundedCount: 4 } } },
        previousRegisterEfficacy: null,
      };
    },
    appendTraceEvent(_trace, event) {
      events.push(event);
    },
    assertTutorStubTurnAttemptCurrent() {},
    automatedLearnerProfileId: generationRuntime.automatedLearnerProfileId,
    callTutor: async () => {
      tutorCalls += 1;
      return { text: 'must not be called' };
    },
    createTutorStubLearnerResponseProvenance: (value) => value,
    enforceAutomatedLearnerProfile: generationRuntime.enforceAutomatedLearnerProfile,
    enforceGuardedLearnerConcessionGuard: generationRuntime.enforceGuardedLearnerConcessionGuard,
    generateAutomatedLearnerTurn: async () => ({
      text: initialCandidate,
      provider: 'test',
      model: 'test',
      latencyMs: 0,
      usage: null,
    }),
    jsonClone: (value) => (value == null ? value : JSON.parse(JSON.stringify(value))),
    learnerProfileSpeakerLabel: () => 'learner',
    printTurnDebugLine() {},
    printWithConcurrentTerminal: (state, action) => action(state),
    startInterimAnimation() {},
    stopInterimAnimation() {},
    turnDebugId: (_state, turn) => `t${turn}`,
  });
  const state = {
    trace: null,
    turns: [
      {
        turn: 1,
        learner: 'I reject your authority to set this question, and I will not supply evidence or an answer under it.',
        tutor: 'Try the bounded public comparison once.',
        classification: analysisFor(repairedCandidate).classification,
      },
      {
        turn: 2,
        learner: 'I can compare the two public accounts on that bounded distinction.',
        tutor: 'Apply only the local distinction to the public marks.',
        classification: analysisFor(initialCandidate).classification,
      },
    ],
    history: [{ role: 'assistant', content: 'Test one bounded distinction in the public record.' }],
    interim: null,
    classifier: { enabled: true },
    learnerDag: { enabled: true },
    register: { policy: 'field' },
    world: {},
    resistanceActionRegisterStudy: {
      enabled: true,
      final_learner_without_tutor_reply: true,
      outcome_horizon_learner_turns: 2,
      job_id: 'job-final-repair',
      batch_id: 'batch_A',
      prefix_id: 'prefix-1',
    },
  };

  const result = await orchestration.runAutomatedLearnerDialogue({
    state,
    openingEnabled: false,
    autoLearnerResolved: { provider: 'test', model: 'test' },
    autoLearnerProfile: 'frame_refuser',
    autoTurns: 3,
    autoSafetyTurns: 3,
    autoStopOnGrounded: false,
  });

  assert.equal(result.reason, 'registered_outcome_horizon_complete');
  assert.equal(repairCalls, 1);
  assert.equal(tutorCalls, 0);
  assert.equal(state.history.at(-1).content, repairedCandidate);
  assert.deepEqual(
    events
      .filter((event) => event.type === 'auto_learner_profile_repair_admission')
      .map((event) => ({
        turn: event.turn,
        admitted: event.admitted,
        usedBefore: event.usedBefore,
        usedAfter: event.usedAfter,
        candidateKind: event.candidateKind,
      })),
    [
      {
        turn: 3,
        admitted: true,
        usedBefore: 0,
        usedAfter: 1,
        candidateKind: 'registered_post_trigger_horizon',
      },
    ],
  );
  assert.equal(events.filter((event) => event.type === 'auto_learner_profile_repair_requested').length, 1);
  assert.deepEqual(
    events
      .filter((event) => event.type === 'auto_learner_profile_adherence')
      .map((event) => ({ turn: event.turn, passed: event.passed, repairAttempts: event.repairAttempts })),
    [{ turn: 3, passed: true, repairAttempts: 1 }],
  );
  assert.equal(
    events.some((event) => event.type === 'auto_learner_profile_adherence_exhausted'),
    false,
  );
  const outcome = events.find((event) => event.type === 'resistance_action_register_outcome_learner_turn');
  assert.equal(outcome.learnerText, repairedCandidate);
  assert.equal(outcome.tutorReplyGenerated, false);
});

test('fresh confirmation ends exactly two learner turns after a dynamic turn-2 trigger without a terminal tutor call', async () => {
  const events = [];
  let tutorCalls = 0;
  const generated = {
    text: 'I will test the bounded public mark without granting the wider frame.',
    provider: 'codex',
    model: 'gpt-5.6-luna',
    latencyMs: 0,
    usage: null,
  };
  const precomputedRaw = {
    dagPreflight: { computedBeforeModelCall: true, publicOnly: true, turn: 4, contentSha256: 'a'.repeat(64) },
  };
  const orchestration = createTutorStubTurnOrchestration({
    C: { brightBlue: '', bold: '', reset: '' },
    analyzeLearnerTurn: async (_text, _state, options) => {
      assert.equal(options.precomputedRaw, precomputedRaw);
      return {
        classification: { turn: { discourse_move: 'evidence_adoption' } },
        tutorLearnerDag: { model: { metrics: { missingPremiseCount: 3, groundedCount: 6 } } },
        previousRegisterEfficacy: null,
      };
    },
    appendTraceEvent(_trace, event) {
      events.push(event);
    },
    assertTutorStubTurnAttemptCurrent() {},
    automatedLearnerProfileId: () => 'frame_refuser',
    callTutor: async () => {
      tutorCalls += 1;
      return { text: 'must not be called' };
    },
    createTutorStubLearnerResponseProvenance: (value) => value,
    enforceAutomatedLearnerProfile: async () => ({
      generated,
      precomputedRaw,
      repaired: false,
      passed: true,
    }),
    enforceGuardedLearnerConcessionGuard: async ({ generated: candidate }) => ({ generated: candidate }),
    generateAutomatedLearnerTurn: async () => generated,
    jsonClone: (value) => (value == null ? value : JSON.parse(JSON.stringify(value))),
    learnerProfileSpeakerLabel: () => 'learner',
    printTurnDebugLine() {},
    printWithConcurrentTerminal: (state, action) => action(state),
    startInterimAnimation() {},
    stopInterimAnimation() {},
    turnDebugId: (_state, turn) => `t${turn}`,
  });
  const state = {
    trace: null,
    turns: [{ turn: 1 }, { turn: 2 }, { turn: 3 }],
    history: [{ role: 'assistant', content: 'Opening' }],
    interim: null,
    classifier: { enabled: true },
    learnerDag: { enabled: true },
    register: { policy: 'field' },
    world: {},
    resistanceActionRegisterStudy: {
      enabled: true,
      dynamic_confirmation: true,
      consumed: true,
      trigger_turn: 2,
      trigger_learner_sha256: 'b'.repeat(64),
      maximum_trigger_turn: 2,
      final_learner_without_tutor_reply: true,
      outcome_horizon_learner_turns: 2,
      job_id: 'confirmation-job',
      batch_id: 'block_01',
      prefix_id: null,
    },
  };
  const result = await orchestration.runAutomatedLearnerDialogue({
    state,
    openingEnabled: false,
    autoLearnerResolved: { provider: 'codex', model: 'gpt-5.6-luna' },
    autoLearnerProfile: 'frame_refuser',
    autoTurns: 4,
    autoSafetyTurns: 4,
    autoStopOnGrounded: false,
  });
  assert.equal(result.reason, 'registered_outcome_horizon_complete');
  assert.equal(tutorCalls, 0);
  const outcome = events.find((event) => event.type === 'resistance_action_register_outcome_learner_turn');
  assert.equal(outcome.turn, 4);
  assert.equal(outcome.triggerTurn, 2);
  assert.equal(outcome.triggerLearnerSha256, 'b'.repeat(64));
  assert.equal(outcome.tutorReplyGenerated, false);
});

test('fresh confirmation fails substantively before a third learner call when no trigger exists by turn 2', async () => {
  const events = [];
  let learnerCalls = 0;
  const orchestration = createTutorStubTurnOrchestration({
    appendTraceEvent(_trace, event) {
      events.push(event);
    },
    assertTutorStubTurnAttemptCurrent() {},
    automatedLearnerProfileId: () => 'frame_refuser',
    learnerProfileSpeakerLabel: () => 'learner',
    generateAutomatedLearnerTurn: async () => {
      learnerCalls += 1;
      return { text: 'must not be called' };
    },
    turnDebugId: (_state, turn) => `t${turn}`,
  });
  const state = {
    trace: null,
    turns: [{ turn: 1 }, { turn: 2 }],
    history: [{ role: 'assistant', content: 'Opening' }],
    resistanceActionRegisterStudy: {
      enabled: true,
      dynamic_confirmation: true,
      consumed: false,
      maximum_trigger_turn: 2,
      final_learner_without_tutor_reply: true,
      outcome_horizon_learner_turns: 2,
    },
  };
  await assert.rejects(
    orchestration.runAutomatedLearnerDialogue({
      state,
      openingEnabled: false,
      autoLearnerResolved: { provider: 'codex', model: 'gpt-5.6-luna' },
      autoLearnerProfile: 'frame_refuser',
      autoTurns: 4,
      autoSafetyTurns: 4,
      autoStopOnGrounded: false,
    }),
    (error) =>
      error.code === 'TUTOR_STUB_RESISTANCE_ACTION_REGISTER_CONFIRMATION_TRIGGER_MISSING' &&
      error.substantiveStudyFailure === true,
  );
  assert.equal(learnerCalls, 0);
  assert.deepEqual(
    events.filter((event) => event.type === 'resistance_action_register_confirmation_substantive_failure'),
    [
      {
        type: 'resistance_action_register_confirmation_substantive_failure',
        turn: 3,
        code: 'TUTOR_STUB_RESISTANCE_ACTION_REGISTER_CONFIRMATION_TRIGGER_MISSING',
        disposition: 'substantive_registered_failure_stop_no_replacement',
        publicTranscriptChanged: false,
      },
    ],
  );
});

test('a resumed automated dialogue treats auto-turns as the total horizon', async () => {
  const events = [];
  let learnerCalls = 0;
  let tutorCalls = 0;
  const orchestration = createTutorStubTurnOrchestration({
    C: { brightBlue: '', bold: '', reset: '' },
    analyzeLearnerTurn: async () => ({
      classification: null,
      tutorLearnerDag: null,
      registerSelection: null,
      previousRegisterEfficacy: null,
    }),
    appendTraceEvent(_trace, event) {
      events.push(event);
    },
    appendTutorStubTurnFailureTraceRecords() {},
    assertTutorStubTurnAttemptCurrent() {},
    automatedLearnerProfileId: () => 'bored',
    automaticTechnicalDetailsEnabled: () => false,
    buildTutorInterimContext: () => ({}),
    createTutorStubLearnerResponseProvenance: (value) => value,
    enforceAutomatedLearnerProfile: async ({ generated }) => ({ generated, repaired: false, passed: true }),
    enforceGuardedLearnerConcessionGuard: async ({ generated }) => ({ generated }),
    generateAutomatedLearnerTurn: async () => {
      learnerCalls += 1;
      return { text: `learner-${learnerCalls}`, provider: 'test', model: 'test' };
    },
    jsonClone: (value) => (value == null ? value : JSON.parse(JSON.stringify(value))),
    learnerProfileSpeakerLabel: () => 'learner',
    printExplanatoryDebugTurn: async () => {},
    printDirectorPreludeBeforeFirstTutor() {},
    printResponseDetails() {},
    printTutorDagSnapshot() {},
    printTutorResponse() {},
    printTurnDebugLine() {},
    printWithConcurrentTerminal: (_state, action) => action(),
    recordTutorStubReplyFeatures() {},
    runOneTurn: undefined,
    startInterimAnimation() {},
    stopInterimAnimation() {},
    turnDebugId: (_state, turn) => `t${turn}`,
    writeFieldVisualization() {},
    callTutor: async () => {
      tutorCalls += 1;
      return { text: `tutor-${tutorCalls}`, provider: 'test', model: 'test', usage: null };
    },
    recordTutorStubTurnTiming: () => null,
  });
  const state = {
    trace: null,
    turns: Array.from({ length: 6 }, (_, index) => ({
      turn: index + 1,
      learner: `old-learner-${index + 1}`,
      tutor: `old-tutor-${index + 1}`,
    })),
    history: [{ role: 'assistant', content: 'Opening' }],
    interim: null,
    classifier: { enabled: false },
    learnerDag: { enabled: false },
    loopMode: 'strict',
    passthrough: { enabled: true },
    register: { policy: 'bland' },
    world: {},
  };

  const result = await orchestration.runAutomatedLearnerDialogue({
    state,
    openingEnabled: true,
    autoLearnerResolved: { provider: 'test', model: 'test' },
    autoLearnerProfile: 'bored',
    autoTurns: 8,
    autoSafetyTurns: 8,
    autoStopOnGrounded: false,
    turnHorizonMode: 'total',
  });

  assert.equal(result.reason, 'auto_turn_cap');
  assert.equal(result.turns, 8);
  assert.equal(learnerCalls, 2);
  assert.equal(tutorCalls, 2);
  assert.equal(events.find((event) => event.type === 'auto_learner_run_start').resumedCompletedTurns, 6);
});

test('manipulation validation judges the intervention once and stops without a learner outcome', async () => {
  const events = [];
  const state = {
    trace: null,
    turns: [{ turn: 1, learner: 'I reject that test.', tutor: 'Use only this bounded distinction.' }],
    resistanceActionRegisterStudy: {
      manipulation_validation: true,
      consumed: true,
      trigger_turn: 1,
      maximum_trigger_turn: 2,
    },
  };
  let calls = 0;
  const result = await completeTutorStubResistanceManipulationValidation({
    state,
    turnNumber: 1,
    appendTraceEvent(_trace, event) {
      events.push(event);
    },
    async adjudicateTutorStubResistanceInterventionFidelity(values) {
      calls += 1;
      assert.equal(values.intervention, 'Use only this bounded distinction.');
      return { fidelity: { status: 'determinate' } };
    },
  });
  assert.equal(result.complete, true);
  assert.equal(calls, 1);
  assert.deepEqual(state.resistanceActionRegisterStudy.fidelity, { status: 'determinate' });
  assert.equal(events.length, 0);
});

test('manipulation validation retains a missing trigger as substantive rather than replacing it', async () => {
  const events = [];
  const state = {
    trace: null,
    turns: [{ turn: 2, learner: 'I can inspect the mark.', tutor: 'Inspect it.' }],
    resistanceActionRegisterStudy: {
      manipulation_validation: true,
      consumed: false,
      maximum_trigger_turn: 2,
    },
  };
  await assert.rejects(
    completeTutorStubResistanceManipulationValidation({
      state,
      turnNumber: 2,
      appendTraceEvent(_trace, event) {
        events.push(event);
      },
    }),
    (error) =>
      error.code === 'TUTOR_STUB_RESISTANCE_MANIPULATION_VALIDATION_TRIGGER_MISSING' &&
      error.substantiveStudyFailure === true,
  );
  assert.equal(events[0].disposition, 'substantive_registered_failure_retain_no_replacement');
});

test('manipulation validation continues after a non-trigger first turn', async () => {
  const state = {
    trace: null,
    turns: [{ turn: 1, learner: 'I can inspect the mark.', tutor: 'Inspect it.' }],
    resistanceActionRegisterStudy: {
      manipulation_validation: true,
      consumed: false,
      maximum_trigger_turn: 2,
    },
  };
  const result = await completeTutorStubResistanceManipulationValidation({
    state,
    turnNumber: 1,
    appendTraceEvent() {},
  });
  assert.deepEqual(result, { active: true, complete: false });
});
