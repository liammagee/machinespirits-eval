import assert from 'node:assert/strict';
import test from 'node:test';

import { createTutorStubTurnOrchestration } from '../services/tutorStubTurnOrchestration.js';

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
