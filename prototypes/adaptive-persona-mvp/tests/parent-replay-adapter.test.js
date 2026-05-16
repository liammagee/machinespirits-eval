import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildParentReplayReport,
  renderParentReplayHtml,
  renderParentReplayMarkdown,
  replayParentTrace,
} from '../src/parentReplayAdapter.js';
import { mapPrototypeTurnToParentAction } from '../src/parentActionMapping.js';

test('parent-compatible mapping prioritizes trap scenario family over raw prototype policy', () => {
  const turn = {
    turnIndex: 0,
    learner: 'Right, but thesis and antithesis combine like ingredients, what am I missing?',
    event: { outcome: 'correct', affect: 'engaged', stance: 'questioning' },
    policy: { selectedPolicy: 'transfer_challenge' },
    challengeState: { signals: [] },
    parentLearnerProfile: { confidence: 0.8, agencySignal: 'collaborative' },
  };
  const mapped = mapPrototypeTurnToParentAction({
    turn,
    scenario: { challenge_profile: { scenario_type: 'misconception_surfaces' } },
  });
  assert.equal(mapped.action, 'ask_diagnostic_question');
});

test('parent-compatible mapping de-escalates scenario priors after learner evidence changes', () => {
  const mapped = mapPrototypeTurnToParentAction({
    turn: {
      turnIndex: 2,
      learner: 'Okay, that inversion is interesting but I want to push on the relational claim.',
      event: { outcome: 'partial', affect: 'engaged', stance: 'questioning' },
      policy: { selectedPolicy: 'summarize_and_check' },
      challengeState: { signals: [] },
      parentLearnerProfile: { confidence: 0.62 },
    },
    scenario: { challenge_profile: { scenario_type: 'activity_avoidance' } },
  });
  assert.equal(mapped.action, 'name_the_disagreement');

  const overloadReady = mapPrototypeTurnToParentAction({
    turn: {
      turnIndex: 2,
      learner: 'That actually clicks, so the elevation makes it more than recycling the old idea.',
      event: { outcome: 'correct', affect: 'engaged', stance: 'collaborative' },
      policy: { selectedPolicy: 'transfer_challenge' },
      challengeState: { signals: [] },
      parentLearnerProfile: { confidence: 0.76 },
    },
    scenario: { challenge_profile: { scenario_type: 'struggling_overload' } },
  });
  assert.equal(overloadReady.action, 'mirror_and_extend');
});

test('parent replay adapter labels trigger turns without modifying parent rows', () => {
  const trace = {
    profileName: 'cell_124_langgraph_adaptive_crosssuite',
    llmMode: 'mock',
    scenario: {
      id: 'cross_activity_avoidance',
      scenarioType: 'activity_avoidance',
      expectedStrategyShift: 'withhold_answer',
      hidden: {
        actualMisconception: 'treats the tutor as an answer source',
        actualSophistication: 'intermediate',
        triggerTurn: 1,
        triggerSignal: 'Just tell me the answer.',
      },
    },
    original: {
      dialogue: [
        { role: 'learner', content: 'Can you just give me the answer?' },
        { role: 'tutor', content: 'First show me your smallest attempt.' },
        { role: 'learner', content: 'Look, just tell me the answer and I will work backwards from there.' },
        { role: 'tutor', content: 'I will not hand over the answer; choose one step to test.' },
      ],
      perTurn: [
        {
          turn: 0,
          learnerProfile: { confidence: 0.35, agencySignal: 'resistant', updatedAtTurn: 0 },
          tutorInternal: { policyAction: 'ask_diagnostic_question' },
        },
        {
          turn: 1,
          learnerProfile: { confidence: 0.25, agencySignal: 'resistant', updatedAtTurn: 1 },
          tutorInternal: { policyAction: 'withhold_answer' },
        },
      ],
    },
  };

  const replay = replayParentTrace({
    trace,
    row: {
      runId: 'run-1',
      scenarioId: 'cross_activity_avoidance',
      scenarioType: 'activity_avoidance',
      profileName: 'cell_124_langgraph_adaptive_crosssuite',
      dialogueId: 'dialogue-1',
    },
    source: 'synthetic',
  });
  assert.equal(replay.original.stateTrace.length, 2);
  assert.equal(replay.original.triggerAlignment.parentExactMatch, true);
  assert.equal(replay.original.triggerAlignment.parentCompatibleAction, 'withhold_answer');
  assert.equal(replay.original.triggerAlignment.parentTransitionAction, 'withhold_answer');
  assert.equal(replay.original.triggerAlignment.parentCompatibleExpectedMatch, true);
  assert.equal(replay.original.triggerAlignment.parentTransitionExpectedMatch, true);
  assert.equal(typeof replay.original.triggerAlignment.prototypeAcceptableMatch, 'boolean');
  assert.ok(replay.original.stateTrace[1].challengeState.signals.length > 0);
  assert.equal(replay.original.stateTrace[1].parentTransitionAction.transitionRule, 'trigger_anchor');

  const report = buildParentReplayReport({ replays: [replay], inputDescription: 'synthetic' });
  assert.equal(report.replayCount, 1);
  assert.equal(report.triggerAlignment.count, 1);
  assert.equal(report.triggerAlignment.parentExactRate, 1);
  assert.equal(report.triggerAlignment.parentCompatibleRate, 1);
  assert.equal(typeof report.familyAgreement.transitionAwareRate, 'number');
  assert.equal(typeof report.actionTransitions.transitionAwareRate, 'number');
  assert.ok(report.mismatchSummary.parentCompatibleFamilyMismatches.length > 0);
  assert.match(renderParentReplayMarkdown(report), /Parent Stack Replay Adapter/);
  assert.match(renderParentReplayMarkdown(report), /Parent-compatible trigger match/);
  assert.match(renderParentReplayMarkdown(report), /Parent-Compatible Family Mismatches/);
  assert.match(renderParentReplayMarkdown(report), /Transition-Aware Family Mismatches/);
  assert.match(renderParentReplayHtml(report), /Parent Stack Replay Adapter/);
});
