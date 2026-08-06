import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createTutorStubTurnOrchestration } from '../services/tutorStubTurnOrchestration.js';

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
