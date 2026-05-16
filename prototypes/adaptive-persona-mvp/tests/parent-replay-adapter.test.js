import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildParentReplayReport,
  renderParentReplayHtml,
  renderParentReplayMarkdown,
  replayParentTrace,
} from '../src/parentReplayAdapter.js';

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
  assert.equal(typeof replay.original.triggerAlignment.prototypeAcceptableMatch, 'boolean');
  assert.ok(replay.original.stateTrace[1].challengeState.signals.length > 0);

  const report = buildParentReplayReport({ replays: [replay], inputDescription: 'synthetic' });
  assert.equal(report.replayCount, 1);
  assert.equal(report.triggerAlignment.count, 1);
  assert.equal(report.triggerAlignment.parentExactRate, 1);
  assert.match(renderParentReplayMarkdown(report), /Parent Stack Replay Adapter/);
  assert.match(renderParentReplayHtml(report), /Parent Stack Replay Adapter/);
});
