import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  TUTOR_STUB_RESISTANT_LEARNER_OBSERVATION_SEMANTICS_ENV,
  createTutorStubAutomatedLearnerGenerationRuntime,
} from '../services/tutorStubAutomatedLearnerGenerationRuntime.js';
import { createTutorStubTurnOrchestration } from '../services/tutorStubTurnOrchestration.js';
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
