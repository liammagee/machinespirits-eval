/**
 * Minimal tests for multi-turn interaction scenarios.
 *
 * Uses a stub llmCall to verify that runInteraction:
 *  1. Produces the expected turn structure (learner → tutor → learner …)
 *  2. Respects maxTurns
 *  3. Records internal deliberation and outcomes
 *  4. Tracks token metrics across turns
 *
 * No real API calls — the stub returns canned responses shaped by the
 * agent role embedded in the prompt.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import interactionEngine from '../services/learnerTutorInteractionEngine.js';
import { runInteraction } from '../services/learnerTutorInteractionEngine.js';
const { INTERACTION_OUTCOMES } = interactionEngine;

// ---------------------------------------------------------------------------
// Stub llmCall — returns deterministic text per agent role
// ---------------------------------------------------------------------------

function createStubLlmCall() {
  const calls = [];

  async function stubLlmCall(model, systemPrompt, messages, options = {}) {
    calls.push({ model, systemPrompt: systemPrompt?.slice(0, 120), messages, options });

    // Token counts vary slightly per call so we can verify accumulation
    const inputTokens = 50 + calls.length;
    const outputTokens = 30 + calls.length;

    return {
      content: `Stub response #${calls.length} from ${model}`,
      usage: { inputTokens, outputTokens },
      latencyMs: 10,
    };
  }

  stubLlmCall.calls = calls;
  return stubLlmCall;
}

// ---------------------------------------------------------------------------
// Minimal scenario fixture — mirrors interaction-eval-scenarios.yaml shape
// ---------------------------------------------------------------------------

const MINIMAL_SCENARIO = {
  id: 'test_minimal',
  type: 'interaction',
  name: 'Minimal Test Scenario',
  turn_count: 2,
  topic: 'Testing multi-turn dialogue',
  learner: {
    persona: 'eager_novice',
    starting_state: {
      understanding: 'knows nothing',
      emotional_state: 'curious',
      opening_message: 'Hello, I want to learn about testing.',
    },
  },
  expected_dynamics: ['Tutor should respond helpfully'],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runInteraction (multi-turn)', () => {
  let stubLlm;

  beforeEach(() => {
    stubLlm = createStubLlmCall();
  });

  it('produces alternating learner/tutor turns starting with learner', async () => {
    const result = await runInteraction(
      {
        learnerId: 'test-learner-1',
        personaId: 'eager_novice',
        tutorProfile: 'budget',
        topic: MINIMAL_SCENARIO.topic,
        scenario: MINIMAL_SCENARIO,
      },
      stubLlm,
      { maxTurns: 2, observeInternals: true, learnerProfile: 'unified' },
    );

    assert.ok(
      result.turns.length >= 3,
      `expected ≥3 turns (initial learner + 2×tutor/learner pairs), got ${result.turns.length}`,
    );

    // Turn 0 should always be a learner message
    assert.strictEqual(result.turns[0].phase, 'learner', 'first turn should be learner');
    assert.ok(result.turns[0].externalMessage, 'first turn should have an external message');

    // Subsequent turns should alternate tutor → learner
    for (let i = 1; i < result.turns.length; i++) {
      const expectedPhase = i % 2 === 1 ? 'tutor' : 'learner';
      assert.strictEqual(
        result.turns[i].phase,
        expectedPhase,
        `turn ${i} should be ${expectedPhase}, got ${result.turns[i].phase}`,
      );
    }
  });

  it('respects maxTurns limit', async () => {
    const result = await runInteraction(
      {
        learnerId: 'test-learner-2',
        personaId: 'eager_novice',
        tutorProfile: 'budget',
        topic: MINIMAL_SCENARIO.topic,
        scenario: MINIMAL_SCENARIO,
      },
      stubLlm,
      { maxTurns: 1, learnerProfile: 'unified' },
    );

    // With maxTurns=1: initial learner (turn 0) + 1 tutor + 1 learner = 3 turns max
    const tutorTurns = result.turns.filter((t) => t.phase === 'tutor');
    assert.ok(tutorTurns.length <= 1, `expected ≤1 tutor turn with maxTurns=1, got ${tutorTurns.length}`);
  });

  it('accumulates token metrics across turns', async () => {
    const result = await runInteraction(
      {
        learnerId: 'test-learner-3',
        personaId: 'eager_novice',
        tutorProfile: 'budget',
        topic: MINIMAL_SCENARIO.topic,
        scenario: MINIMAL_SCENARIO,
      },
      stubLlm,
      { maxTurns: 2, learnerProfile: 'unified' },
    );

    const { metrics } = result;
    // Learner tokens are tracked via llmCall; tutor tokens via the tutor API call
    const totalIn = metrics.learnerInputTokens + metrics.tutorInputTokens;
    const totalOut = metrics.learnerOutputTokens + metrics.tutorOutputTokens;
    assert.ok(totalIn > 0 || metrics.totalInputTokens > 0, 'should have accumulated input tokens');
    assert.ok(totalOut > 0 || metrics.totalOutputTokens > 0, 'should have accumulated output tokens');
    assert.ok(metrics.totalLatencyMs >= 0, 'should have recorded latency');
    assert.strictEqual(metrics.turnCount, 2, 'turnCount should match maxTurns');
  });

  it('includes a summary with outcomes', async () => {
    const result = await runInteraction(
      {
        learnerId: 'test-learner-4',
        personaId: 'eager_novice',
        tutorProfile: 'budget',
        topic: MINIMAL_SCENARIO.topic,
        scenario: MINIMAL_SCENARIO,
      },
      stubLlm,
      { maxTurns: 2, learnerProfile: 'unified' },
    );

    assert.ok(result.summary, 'result should have a summary');
    assert.strictEqual(typeof result.summary.turnCount, 'number');
    assert.ok(Array.isArray(result.summary.uniqueOutcomes), 'uniqueOutcomes should be an array');
    assert.strictEqual(typeof result.summary.hadBreakthrough, 'boolean');
    assert.strictEqual(typeof result.summary.hadFrustration, 'boolean');
  });

  it('records writing pad snapshots (before/after)', async () => {
    const result = await runInteraction(
      {
        learnerId: 'test-learner-5',
        personaId: 'eager_novice',
        tutorProfile: 'budget',
        topic: MINIMAL_SCENARIO.topic,
        scenario: MINIMAL_SCENARIO,
      },
      stubLlm,
      { maxTurns: 1, learnerProfile: 'unified' },
    );

    assert.ok(result.writingPadSnapshots, 'should have writingPadSnapshots');
    assert.ok('before' in result.writingPadSnapshots.learner, 'learner should have before snapshot');
    assert.ok('after' in result.writingPadSnapshots.learner, 'learner should have after snapshot');
    assert.ok('before' in result.writingPadSnapshots.tutor, 'tutor should have before snapshot');
    assert.ok('after' in result.writingPadSnapshots.tutor, 'tutor should have after snapshot');
  });

  it('INTERACTION_OUTCOMES exports expected keys', () => {
    const expectedKeys = [
      'BREAKTHROUGH',
      'PRODUCTIVE_STRUGGLE',
      'MUTUAL_RECOGNITION',
      'FRUSTRATION',
      'DISENGAGEMENT',
      'SCAFFOLDING_NEEDED',
      'FADING_APPROPRIATE',
      'TRANSFORMATION',
    ];
    for (const key of expectedKeys) {
      assert.ok(key in INTERACTION_OUTCOMES, `INTERACTION_OUTCOMES should have ${key}`);
      assert.strictEqual(typeof INTERACTION_OUTCOMES[key], 'string');
    }
  });
});
