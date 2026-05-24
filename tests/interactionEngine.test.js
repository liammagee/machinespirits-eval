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

  it('passes hidden learner reframe events into the next tutor uptake prompt', async () => {
    const calls = [];
    async function llmCall(model, systemPrompt, messages, options = {}) {
      calls.push({ model, systemPrompt, messages, options });
      const user = messages?.[0]?.content || '';
      if (options.agentRole === 'learner_superego') {
        return { content: 'Keep the public wording concrete; name the old frame and replacement.', usage: {} };
      }
      if (options.agentRole === 'learner_ego' && /Produce your final response/.test(user)) {
        return {
          content:
            'FINAL:\nI thought the decimal was the proof. The problem was treating the decimal as proof by itself. Better frame: the equation has to do the proof work.',
          usage: {},
        };
      }
      if (options.agentRole === 'learner_ego' && /opening message/.test(user)) {
        return { content: 'FINAL:\nI thought the decimal was the proof.', usage: {} };
      }
      if (options.agentRole === 'learner_ego') {
        return { content: 'I thought the decimal was the proof.', usage: {} };
      }
      if (options.agentRole === 'tutor_superego') {
        return {
          content:
            'FEEDBACK: Check whether the tutor takes up the learner frame.\nUPTAKE_CHECK: Revise toward the new proof frame.\nKEEP_OR_CHANGE: revise lightly',
          usage: {},
        };
      }
      if (options.agentRole === 'tutor_ego' && /Your initial tutor response was/.test(systemPrompt)) {
        return {
          content:
            'PRIVATE_DECISION: revise to test the learner reframe.\nFINAL:\nUse that new frame: let the equation, not the decimal, carry the proof. What would the equation need to show first?',
          usage: {},
        };
      }
      if (options.agentRole === 'tutor_ego') {
        return { content: 'Check what the decimal can and cannot prove.', usage: {} };
      }
      return { content: 'stub', usage: {} };
    }

    const directorPlan = {
      opening_speaker: 'learner',
      tutor_adaptation_policy: 'uptake',
      interventions: [
        {
          after_turn: 1,
          timing: 'before_learner',
          cue_kind: 'learner_revisit_earlier_wording',
          revisit_policy: 'reframe',
          revisit_anchor: 'opening',
          instruction: 'An earlier learner line returns to the table.',
        },
      ],
    };

    const result = await runInteraction(
      {
        learnerId: 'test-learner-adaptation',
        personaId: 'eager_novice',
        tutorProfile: 'recognition',
        topic: 'Irrationality proof',
        scenario: {
          name: 'Tutor adaptation test',
          learnerStartState: 'The learner treats a decimal as proof.',
          directorPlan,
        },
      },
      llmCall,
      {
        maxTurns: 2,
        forceMaxTurns: true,
        observeInternals: true,
        learnerProfile: 'ego_superego',
        directorPlan,
      },
    );

    const reframeTurn = result.turns.find((turn) => turn.phase === 'learner' && turn.learnerReframeEvent);
    assert.ok(reframeTurn, 'expected learner turn to carry hidden reframe event');
    assert.equal(reframeTurn.learnerReframeEvent.cuePolicy, 'reframe');

    const tutorUseTurn = result.turns.find((turn) => turn.phase === 'tutor' && turn.learnerReframeEventUsed);
    assert.ok(tutorUseTurn, 'expected following tutor turn to consume hidden reframe event');
    assert.match(tutorUseTurn.externalMessage, /Use that new frame/);

    const tutorSuperegoPrompts = calls
      .filter((call) => call.options.agentRole === 'tutor_superego')
      .map((call) => call.systemPrompt);
    assert.ok(
      tutorSuperegoPrompts.some((prompt) => /Tutor-private learner reframe event/.test(prompt)),
      'tutor superego should see private reframe state',
    );
    assert.ok(
      tutorSuperegoPrompts.some((prompt) => /UPTAKE_CHECK/.test(prompt)),
      'tutor superego should be asked to evaluate uptake',
    );

    const tutorAdjudicationPrompts = calls
      .filter(
        (call) => call.options.agentRole === 'tutor_ego' && /Your initial tutor response was/.test(call.systemPrompt),
      )
      .map((call) => call.systemPrompt);
    assert.ok(
      tutorAdjudicationPrompts.some((prompt) => /must make one tutor adaptation move legible/.test(prompt)),
      'tutor ego adjudication should choose an uptake move',
    );
  });

  it('passes learner reversal pressure into the tutor ego/superego peripeteia prompt', async () => {
    const calls = [];
    async function llmCall(model, systemPrompt, messages, options = {}) {
      calls.push({ model, systemPrompt, messages, options });
      const user = messages?.[0]?.content || '';
      if (options.agentRole === 'learner_superego') {
        return { content: 'Keep the resistance visible; do not fake understanding.', usage: {} };
      }
      if (options.agentRole === 'learner_ego' && /Produce your final response/.test(user)) {
        return { content: "FINAL:\nBut that still doesn't make sense; I don't see why the old route works.", usage: {} };
      }
      if (options.agentRole === 'learner_ego' && /opening message/.test(user)) {
        return { content: 'FINAL:\nI think loose means no gravity.', usage: {} };
      }
      if (options.agentRole === 'learner_ego') {
        return { content: "But that still doesn't make sense; I don't see why the old route works.", usage: {} };
      }
      if (options.agentRole === 'tutor_superego') {
        return {
          content:
            'FEEDBACK: The draft repeats the old move.\nPERIPETEIA_CHECK: Switch route and lower the load.\nKEEP_OR_CHANGE: revise substantially',
          usage: {},
        };
      }
      if (options.agentRole === 'tutor_ego' && /Your initial tutor response was/.test(systemPrompt)) {
        return {
          content:
            'PRIVATE_DECISION: revise because the learner is resisting the route.\nFINAL:\nLet us back up and try a different route: draw the string first, then test what force remains.',
          usage: {},
        };
      }
      if (options.agentRole === 'tutor_ego') {
        return { content: 'Check the list again and write the force name.', usage: {} };
      }
      return { content: 'stub', usage: {} };
    }

    const directorPlan = {
      opening_speaker: 'learner',
      tutor_adaptation_policy: 'peripeteia',
    };

    const result = await runInteraction(
      {
        learnerId: 'test-learner-peripeteia',
        personaId: 'eager_novice',
        tutorProfile: 'recognition',
        topic: 'Gravity and loose strings',
        scenario: {
          name: 'Tutor peripeteia test',
          learnerStartState: 'The learner treats loose as no gravity.',
          directorPlan,
        },
      },
      llmCall,
      {
        maxTurns: 2,
        forceMaxTurns: true,
        observeInternals: true,
        learnerProfile: 'ego_superego',
        directorPlan,
      },
    );

    const pressureTurn = result.turns.find((turn) => turn.phase === 'learner' && turn.learnerReversalEvent);
    assert.ok(pressureTurn, 'expected learner turn to carry hidden reversal-pressure event');
    assert.match(pressureTurn.learnerReversalEvent.triggerType, /breakdown|resistance/);

    const tutorUseTurn = result.turns.find((turn) => turn.phase === 'tutor' && turn.learnerReversalEventUsed);
    assert.ok(tutorUseTurn, 'expected following tutor turn to consume hidden reversal event');
    assert.match(tutorUseTurn.externalMessage, /different route/);

    const tutorSuperegoPrompts = calls
      .filter((call) => call.options.agentRole === 'tutor_superego')
      .map((call) => call.systemPrompt);
    assert.ok(
      tutorSuperegoPrompts.some((prompt) => /Tutor-private peripeteia event/.test(prompt)),
      'tutor superego should see private peripeteia state',
    );
    assert.ok(
      tutorSuperegoPrompts.some((prompt) => /PERIPETEIA_CHECK/.test(prompt)),
      'tutor superego should evaluate adaptive mechanism invention',
    );
    assert.ok(
      tutorSuperegoPrompts.some((prompt) => /REGISTER_CHECK/.test(prompt)),
      'tutor superego should evaluate whether the register serves the mechanism',
    );
    assert.ok(
      tutorSuperegoPrompts.some((prompt) => /cheerful reassurance or informal coaching/.test(prompt)),
      'tutor superego should catch over-cheery default habits',
    );

    const tutorAdjudicationPrompts = calls
      .filter(
        (call) => call.options.agentRole === 'tutor_ego' && /Your initial tutor response was/.test(call.systemPrompt),
      )
      .map((call) => call.systemPrompt);
    assert.ok(
      tutorAdjudicationPrompts.some((prompt) => /adaptive learning mechanism legible/.test(prompt)),
      'tutor ego adjudication should force the adaptive mechanism after internal review',
    );
    assert.ok(
      tutorAdjudicationPrompts.some((prompt) => /affective register/.test(prompt)),
      'tutor ego adjudication should allow register shift as an adaptive mechanism',
    );
  });

  it('passes learner pressure into routine-control prompts without peripeteia checks', async () => {
    const calls = [];
    async function llmCall(model, systemPrompt, messages, options = {}) {
      calls.push({ model, systemPrompt, messages, options });
      const user = messages?.[0]?.content || '';
      if (options.agentRole === 'learner_superego') {
        return { content: 'Keep the resistance visible; do not fake understanding.', usage: {} };
      }
      if (options.agentRole === 'learner_ego' && /Produce your final response/.test(user)) {
        return { content: "FINAL:\nBut that still doesn't make sense; I don't see why the old route works.", usage: {} };
      }
      if (options.agentRole === 'learner_ego' && /opening message/.test(user)) {
        return { content: 'FINAL:\nI think loose means no gravity.', usage: {} };
      }
      if (options.agentRole === 'learner_ego') {
        return { content: "But that still doesn't make sense; I don't see why the old route works.", usage: {} };
      }
      if (options.agentRole === 'tutor_superego') {
        return {
          content:
            'FEEDBACK: The draft preserves the route.\nROUTINE_CHECK: It stays on the same worked example.\nKEEP_OR_CHANGE: keep as-is',
          usage: {},
        };
      }
      if (options.agentRole === 'tutor_ego' && /Your initial tutor response was/.test(systemPrompt)) {
        return {
          content:
            'PRIVATE_DECISION: keep the routine branch on the same route.\nFINAL:\nKeep using the same list. Write the force name, then answer the next worksheet item.',
          usage: {},
        };
      }
      if (options.agentRole === 'tutor_ego') {
        return { content: 'Check the list again and write the force name.', usage: {} };
      }
      return { content: 'stub', usage: {} };
    }

    const directorPlan = {
      opening_speaker: 'learner',
      tutor_adaptation_policy: 'routine',
    };

    const result = await runInteraction(
      {
        learnerId: 'test-learner-routine',
        personaId: 'eager_novice',
        tutorProfile: 'recognition',
        topic: 'Gravity and loose strings',
        scenario: {
          name: 'Routine negative-control test',
          learnerStartState: 'The learner treats loose as no gravity.',
          directorPlan,
        },
      },
      llmCall,
      {
        maxTurns: 2,
        forceMaxTurns: true,
        observeInternals: true,
        learnerProfile: 'ego_superego',
        directorPlan,
      },
    );

    const tutorUseTurn = result.turns.find((turn) => turn.phase === 'tutor' && turn.learnerReversalEventUsed);
    assert.ok(tutorUseTurn, 'expected routine branch to receive hidden pressure event');
    assert.match(tutorUseTurn.externalMessage, /Keep using the same list/);

    const tutorSuperegoPrompts = calls
      .filter((call) => call.options.agentRole === 'tutor_superego')
      .map((call) => call.systemPrompt);
    assert.ok(
      tutorSuperegoPrompts.some((prompt) => /Tutor-private routine-control event/.test(prompt)),
      'routine superego should see pressure as a negative-control event',
    );
    assert.ok(
      tutorSuperegoPrompts.some((prompt) => /ROUTINE_CHECK/.test(prompt)),
      'routine superego should evaluate routine-control fidelity',
    );
    assert.ok(
      tutorSuperegoPrompts.every((prompt) => !/PERIPETEIA_CHECK/.test(prompt)),
      'routine branch must not ask for peripeteia checks',
    );
  });
});
