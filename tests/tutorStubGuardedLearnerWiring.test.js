import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createTutorStubAutomatedLearnerGenerationRuntime } from '../services/tutorStubAutomatedLearnerGenerationRuntime.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readSource(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function buildRuntime({ env = {}, replies = [] } = {}) {
  const trace = [];
  const prompts = [];
  const queue = [...replies];
  const runtime = createTutorStubAutomatedLearnerGenerationRuntime({
    appendTraceEvent: (target, event) => {
      trace.push(event);
      if (Array.isArray(target)) target.push(event);
    },
    callPromptModel: async ({ prompt }) => {
      prompts.push(prompt);
      return { text: queue.shift() || '', provider: 'test', model: 'test' };
    },
    classificationFromCombinedAnalysis: () => null,
    env,
    extractCombinedLearnerAnalysis: async () => null,
    learnerProfileContract: () => null,
    learnerProfileIds: () => ['overconfident', 'low_agency'],
    learnerProfilePrompt: (id) => `profile:${id}`,
    negativeFloorRegisters: () => [],
  });
  return { runtime, trace, prompts };
}

function buildState() {
  return {
    trace: [],
    turns: [],
    history: [],
    world: null,
    interim: null,
    classifier: { enabled: false },
    learnerDag: { enabled: false },
  };
}

test('the guarded move menu is off unless the flag and the guarded profile are both present', () => {
  const off = buildRuntime().runtime;
  assert.equal(off.guardedLearnerActive('overconfident'), false);

  const wrongProfile = buildRuntime({ env: { TUTOR_STUB_GUARDED_LEARNER_MOVES: '1' } }).runtime;
  assert.equal(wrongProfile.guardedLearnerActive('low_agency'), false);
  assert.equal(wrongProfile.guardedLearnerActive('overconfident'), true);
});

test('a clean guarded draft passes the guard, is traced, and costs no extra model call', async () => {
  const { runtime, trace, prompts } = buildRuntime({
    env: { TUTOR_STUB_GUARDED_LEARNER_MOVES: '1' },
  });
  const state = buildState();
  const result = await runtime.enforceGuardedLearnerConcessionGuard({
    state,
    resolved: {},
    profile: 'overconfident',
    turnNumber: 1,
    generated: { text: 'The seal is fifteenth-century, and the weight reading does not touch that.' },
  });

  assert.equal(result.passed, true);
  assert.equal(result.repaired, false);
  assert.equal(result.move, 'over_claim');
  assert.equal(prompts.length, 0);
  const moveEvents = trace.filter((event) => event.type === 'guarded_learner_move');
  assert.equal(moveEvents.length, 1);
  assert.equal(moveEvents[0].move, 'over_claim');
  assert.deepEqual(
    trace.filter((event) => event.type === 'guarded_learner_guard_fired'),
    [],
  );
  assert.deepEqual(state.guardedLearnerMoves, ['over_claim']);
});

test('a permission-seeking draft fires the guard and is redrafted exactly once', async () => {
  const { runtime, trace, prompts } = buildRuntime({
    env: { TUTOR_STUB_GUARDED_LEARNER_MOVES: '1' },
    replies: ['The seal is fifteenth-century. Run the weight check before you argue otherwise.'],
  });
  const state = buildState();
  const result = await runtime.enforceGuardedLearnerConcessionGuard({
    state,
    resolved: {},
    profile: 'overconfident',
    turnNumber: 1,
    generated: { text: 'May I say the seal is fifteenth-century?' },
  });

  assert.equal(result.repaired, true);
  assert.equal(result.passed, true);
  assert.match(result.generated.text, /fifteenth-century/u);
  assert.equal(prompts.length, 1, 'one redraft, never two');
  assert.match(prompts[0], /does not ask to be allowed/u);

  const fired = trace.filter((event) => event.type === 'guarded_learner_guard_fired');
  assert.equal(fired.length, 1);
  assert.deepEqual(fired[0].reasons, ['permission_seeking']);
  const moveEvents = trace.filter((event) => event.type === 'guarded_learner_move');
  assert.equal(moveEvents.length, 1);
  assert.equal(moveEvents[0].repaired, true);
});

test('a redraft that still breaks the persona is recorded as failed rather than retried', async () => {
  const { runtime, trace, prompts } = buildRuntime({
    env: { TUTOR_STUB_GUARDED_LEARNER_MOVES: '1' },
    replies: ['May I still ask what you want me to write?'],
  });
  const state = buildState();
  const result = await runtime.enforceGuardedLearnerConcessionGuard({
    state,
    resolved: {},
    profile: 'overconfident',
    turnNumber: 1,
    generated: { text: 'May I say the seal is fifteenth-century?' },
  });

  assert.equal(result.passed, false);
  assert.equal(prompts.length, 1);
  const moveEvents = trace.filter((event) => event.type === 'guarded_learner_move');
  assert.equal(moveEvents[0].passed, false);
  assert.ok(moveEvents[0].reasons.includes('permission_seeking'));
});

test('the passive pole never reaches the guard even with the flag set', async () => {
  const { runtime, trace, prompts } = buildRuntime({
    env: { TUTOR_STUB_GUARDED_LEARNER_MOVES: '1' },
  });
  const state = buildState();
  const result = await runtime.enforceGuardedLearnerConcessionGuard({
    state,
    resolved: {},
    profile: 'low_agency',
    turnNumber: 1,
    generated: { text: 'May I write the ledger line now?' },
  });

  assert.equal(result.move, null);
  assert.equal(result.passed, null);
  assert.equal(result.repaired, false);
  assert.equal(prompts.length, 0);
  assert.deepEqual(trace, []);
  assert.equal(state.guardedLearnerMoves, undefined);
});

test('the recorded moves drive the next turn, so the cooldown and fold rules see history', async () => {
  const { runtime } = buildRuntime({ env: { TUTOR_STUB_GUARDED_LEARNER_MOVES: '1' } });
  const state = buildState();
  const moves = [];
  for (let turnNumber = 1; turnNumber <= 4; turnNumber += 1) {
    const result = await runtime.enforceGuardedLearnerConcessionGuard({
      state,
      resolved: {},
      profile: 'overconfident',
      turnNumber,
      generated: { text: `Turn ${turnNumber}: the seal is fifteenth-century and nothing shown moves that.` },
    });
    moves.push(result.move);
  }
  assert.deepEqual(moves, state.guardedLearnerMoves);
  assert.equal(moves.includes('full_concession'), false, 'no challenge has landed, so the learner cannot fold');
});

test('the guard runs before profile adherence, so the scored text is the guarded text', () => {
  const source = readSource('services/tutorStubTurnOrchestration.js');
  const guardIndex = source.indexOf('enforceGuardedLearnerConcessionGuard({');
  const adherenceIndex = source.indexOf('enforceAutomatedLearnerProfile({');
  assert.ok(guardIndex > 0 && adherenceIndex > 0);
  assert.ok(guardIndex < adherenceIndex, 'the deterministic guard must settle the draft first');
});
