import assert from 'node:assert/strict';
import test from 'node:test';

import { createTutorStubSessionOrchestration } from '../services/tutorStubSessionOrchestration.js';
import { createTutorStubSessionStateRuntime } from '../services/tutorStubSessionStateRuntime.js';
import { createTutorStubTraceRuntime } from '../services/tutorStubTraceRuntime.js';

const colors = new Proxy({}, { get: () => '' });

test('trace runtime retains dependency-free clone and disabled-budget contracts', () => {
  const runtime = createTutorStubTraceRuntime({
    program2ProviderBudget: null,
    selectedLabModelCallBudget: null,
  });
  const source = { nested: { value: 3 } };
  const clone = runtime.jsonClone(source);
  clone.nested.value = 4;

  assert.equal(source.nested.value, 3);
  assert.equal(runtime.reserveProgram2ProviderBudget({ maxTokens: 12 }), null);
  assert.equal(runtime.reserveTutorStubMeteredModelCall(), null);
});

test('trace runtime reads a model-call budget installed after startup', () => {
  const reservations = [];
  let budget = null;
  const runtime = createTutorStubTraceRuntime({
    getSelectedLabModelCallBudget: () => budget,
  });

  budget = {
    reserve(input) {
      reservations.push(input);
      return { used: reservations.length };
    },
  };

  assert.deepEqual(runtime.reserveTutorStubMeteredModelCall({ role: 'tutor', turn: 2 }), { used: 1 });
  assert.deepEqual(reservations, [{ role: 'tutor', turn: 2 }]);
});

test('session-state runtime snapshots the public session without private machinery', () => {
  const state = {
    capabilities: { mode: 'normal' },
    history: [{ role: 'assistant', content: 'Opening' }],
    turns: [],
    world: { id: 'world_1', title: 'World one' },
    topic: 'Fallback topic',
    interaction: { mode: 'learner' },
    dialogueClosure: { phase: 'open' },
    tuning: { activeRef: 'default' },
    tutorInstance: { id: 'stub' },
    committee: { enabled: false, miniModel: null },
    resumeHandoff: null,
  };
  const runtime = createTutorStubSessionStateRuntime({
    curriculumBundle: null,
    jsonClone: structuredClone,
    state,
  });

  assert.deepEqual(runtime.sessionRuntimeStateSnapshot(), {
    capabilityMode: 'normal',
    worldId: 'world_1',
    curriculumModuleId: null,
    curriculumModuleTitle: null,
    topic: 'World one',
    curriculumProgress: null,
    interactionMode: 'learner',
    turnCount: 0,
    publicMessageCount: 1,
    opening: { role: 'assistant', content: 'Opening' },
    resumeHandoff: null,
    publicMessages: [{ role: 'assistant', content: 'Opening' }],
    dialogueClosurePhase: 'open',
    learnerProfileId: null,
    tutorInstanceRef: 'default',
    committeeEnabled: false,
    committeeModel: null,
  });
});

test('session orchestration rejects scenario changes during a tutor turn', async () => {
  const runtime = createTutorStubSessionOrchestration({
    C: colors,
    clearStatusLine() {},
    isProcessingTurn() {
      return true;
    },
  });

  assert.equal(await runtime.chooseAnotherScenario('', { duringTurn: true }), false);
});
