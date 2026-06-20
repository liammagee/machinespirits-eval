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
import {
  buildAnchoredRevisitCue,
  buildLearnerReversalEvent,
  buildTutorAffectiveAdaptationContext,
  runInteraction,
} from '../services/learnerTutorInteractionEngine.js';
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

function promptSurface(callOrSystemPrompt, messages = []) {
  if (typeof callOrSystemPrompt === 'object' && callOrSystemPrompt) {
    return promptSurface(callOrSystemPrompt.systemPrompt, callOrSystemPrompt.messages);
  }
  return [callOrSystemPrompt || '', ...(messages || []).map((message) => message?.content || '')].join('\n\n');
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
  it('anchors reframe cues with an ordered public revoice before new casework', () => {
    const anchoredCue = buildAnchoredRevisitCue(
      {
        cue_kind: 'learner_revisit_earlier_wording',
        revisit_policy: 'reframe',
        revisit_anchor: 'opening',
        instruction: 'An earlier learner line returns to the table.',
      },
      [
        {
          role: 'learner',
          content: 'I was treating the audit table as the whole answer.',
        },
      ],
    );

    assert.equal(anchoredCue.revisit_policy, 'reframe');
    assert.match(anchoredCue.instruction, /next public reply starts by revoicing that wording/i);
    assert.match(anchoredCue.instruction, /before applying the new artifact or case/i);
  });

  it('treats director learner-pressure cues as reversal events even when wording is understated', () => {
    const event = buildLearnerReversalEvent({
      learnerMessage: 'I can put the label there.',
      conversationHistory: [{ role: 'tutor', content: 'Use the same label check and write it in the box.' }],
      directorCue: {
        cue_kind: 'learner_reversal_pressure',
        instruction: 'The marked answer and the remaining task now sit under visible pressure.',
        reversal_trigger_type: 'misfit',
      },
      turnNumber: 2,
    });

    assert.ok(event);
    assert.equal(event.source, 'director_reversal_pressure_cue');
    assert.equal(event.triggerType, 'misfit');
    assert.equal(event.confidence, 0.9);
    assert.match(event.directorCue, /visible pressure/);
  });

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

  it('emits onTurn after each appended public turn with the current trace prefix', async () => {
    const seen = [];
    const result = await runInteraction(
      {
        learnerId: 'test-learner-on-turn',
        personaId: 'eager_novice',
        tutorProfile: 'budget',
        topic: MINIMAL_SCENARIO.topic,
        scenario: MINIMAL_SCENARIO,
      },
      stubLlm,
      {
        maxTurns: 1,
        learnerProfile: 'unified',
        onTurn: ({ turn, trace }) => {
          seen.push({
            phase: turn.phase,
            turnNumber: turn.turnNumber,
            traceLength: trace.turns.length,
            sameTurn: trace.turns.at(-1) === turn,
          });
        },
      },
    );

    assert.deepEqual(
      seen.map((turn) => turn.phase),
      ['learner', 'tutor', 'learner'],
    );
    assert.deepEqual(
      seen.map((turn) => turn.turnNumber),
      [0, 1, 1],
    );
    assert.deepEqual(
      seen.map((turn) => turn.traceLength),
      [1, 2, 3],
    );
    assert.ok(
      seen.every((turn) => turn.sameTurn),
      'each callback sees the latest appended turn',
    );
    assert.equal(result.turns.length, seen.length);
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
      if (
        options.agentRole === 'tutor_ego' &&
        /Your initial tutor response was/.test(promptSurface(systemPrompt, messages))
      ) {
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
      .map((call) => promptSurface(call));
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
        (call) => call.options.agentRole === 'tutor_ego' && /Your initial tutor response was/.test(promptSurface(call)),
      )
      .map((call) => promptSurface(call));
    assert.ok(
      tutorAdjudicationPrompts.some((prompt) => /must make one tutor adaptation move legible/.test(prompt)),
      'tutor ego adjudication should choose an uptake move',
    );
  });

  it('keeps the tutor ego/superego system prompt static and routes dynamic context to the user message', async () => {
    // Mirror of the learner-side guard in learnerTutorInteractionEngine.test.js: under
    // the default prompt split, the persistent-worker system prompt per role must be
    // byte-stable (so role:model:effort:hash(systemPrompt) reuses a worker across turns),
    // with turn-specific context in the user message. The existing tutor tests read
    // through promptSurface() (system+user merged), so they cannot catch a regression
    // that folds dynamic context back into the system prompt — this test pins placement.
    const previous = process.env.DRAMA_STATIC_DYNAMIC_PROMPTS;
    delete process.env.DRAMA_STATIC_DYNAMIC_PROMPTS; // default: split on

    const calls = [];
    async function llmCall(model, systemPrompt, messages, options = {}) {
      calls.push({ model, systemPrompt, messages, options });
      const user = messages?.[0]?.content || '';
      if (options.agentRole === 'learner_superego') {
        return { content: 'Keep the question genuine.', usage: {} };
      }
      if (options.agentRole === 'learner_ego') {
        return { content: 'FINAL:\nI think I follow so far.', usage: {} };
      }
      if (options.agentRole === 'tutor_superego') {
        return { content: 'FEEDBACK: Reasonable draft.\nKEEP_OR_CHANGE: keep as-is', usage: {} };
      }
      if (options.agentRole === 'tutor_ego' && /Your initial tutor response was/.test(user)) {
        return { content: 'PRIVATE_DECISION: keep.\nFINAL:\nLet us check the next step together.', usage: {} };
      }
      if (options.agentRole === 'tutor_ego') {
        return { content: 'Let us check the next step together.', usage: {} };
      }
      return { content: 'stub', usage: {} };
    }

    try {
      await runInteraction(
        {
          learnerId: 'test-tutor-prompt-split',
          personaId: 'eager_novice',
          tutorProfile: 'recognition',
          topic: 'Irrationality proof',
          scenario: { name: 'Tutor prompt-split test', learnerStartState: 'The learner is unsure.' },
        },
        llmCall,
        { maxTurns: 2, forceMaxTurns: true, observeInternals: true, learnerProfile: 'ego_superego' },
      );
    } finally {
      if (previous === undefined) {
        delete process.env.DRAMA_STATIC_DYNAMIC_PROMPTS;
      } else {
        process.env.DRAMA_STATIC_DYNAMIC_PROMPTS = previous;
      }
    }

    const tutorEgoCalls = calls.filter((c) => c.options.agentRole === 'tutor_ego');
    const tutorSuperegoCalls = calls.filter((c) => c.options.agentRole === 'tutor_superego');
    assert.ok(tutorEgoCalls.length >= 2, 'expected initial + adjudication tutor_ego calls');
    assert.ok(tutorSuperegoCalls.length >= 1, 'expected a tutor_superego call');

    // (1) Worker-key stability: every same-role tutor system prompt is byte-identical.
    // A regression that re-embeds dynamic context in the system prompt breaks this —
    // the exact Slice-2 worker-reuse failure the promptSurface()-based tests miss.
    assert.equal(
      new Set(tutorEgoCalls.map((c) => c.systemPrompt)).size,
      1,
      'all tutor_ego system prompts must be byte-identical under split mode',
    );
    assert.equal(
      new Set(tutorSuperegoCalls.map((c) => c.systemPrompt)).size,
      1,
      'all tutor_superego system prompts must be byte-identical under split mode',
    );

    // (2) Placement: turn-specific content is in the user message, not the system prompt.
    const adjudication = tutorEgoCalls.find((c) => /Your initial tutor response was/.test(c.messages[0].content));
    assert.ok(adjudication, 'expected a tutor_ego adjudication call carrying the draft in its user message');
    assert.doesNotMatch(adjudication.systemPrompt, /Your initial tutor response was/);

    const superego = tutorSuperegoCalls[0];
    assert.match(superego.messages[0].content, /The tutor's DRAFT response/);
    assert.doesNotMatch(superego.systemPrompt, /The tutor's DRAFT response/);

    // (3) Split mode is genuinely active (static tail present), so the assertions above
    // are testing the split path rather than passing vacuously in fallback mode.
    assert.match(adjudication.systemPrompt, /Prompt-split runtime contract/);
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
        return {
          content: "FINAL:\nBut that still doesn't make sense; I don't see why the old route works.",
          usage: {},
        };
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
      if (
        options.agentRole === 'tutor_ego' &&
        /Your initial tutor response was/.test(promptSurface(systemPrompt, messages))
      ) {
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
      .map((call) => promptSurface(call));
    assert.ok(
      tutorSuperegoPrompts.some((prompt) => /Tutor-private peripeteia event/.test(prompt)),
      'tutor superego should see private peripeteia state',
    );
    assert.ok(
      tutorSuperegoPrompts.some((prompt) => /PERIPETEIA_CHECK/.test(prompt)),
      'tutor superego should evaluate adaptive mechanism invention',
    );
    assert.ok(
      tutorSuperegoPrompts.some((prompt) => /MECHANISM_ROUTE/.test(prompt)),
      'tutor superego should name old and new routes for peripeteia',
    );
    assert.ok(
      tutorSuperegoPrompts.some((prompt) => /FAILED_HABIT/.test(prompt)),
      'tutor superego should name the failed teaching habit',
    );
    assert.ok(
      tutorSuperegoPrompts.some((prompt) => /PUBLIC_DEVICE_CHECK/.test(prompt)),
      'tutor superego should check that the private route becomes a public device',
    );
    assert.ok(
      tutorSuperegoPrompts.some((prompt) => /PUBLIC_ACTION_GATE/.test(prompt)),
      'tutor superego should require a concrete learner action gate',
    );
    assert.ok(
      tutorSuperegoPrompts.some((prompt) => /MECHANISM_QUALITY_CHECK/.test(prompt)),
      'tutor superego should evaluate whether the new device is fitted and usable',
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
        (call) => call.options.agentRole === 'tutor_ego' && /Your initial tutor response was/.test(promptSurface(call)),
      )
      .map((call) => promptSurface(call));
    assert.ok(
      tutorAdjudicationPrompts.some((prompt) => /adaptive learning mechanism legible/.test(prompt)),
      'tutor ego adjudication should force the adaptive mechanism after internal review',
    );
    assert.ok(
      tutorAdjudicationPrompts.some((prompt) => /ADAPTIVE_MECHANISM: old route -> new route/.test(prompt)),
      'tutor ego adjudication should require a private route-change verdict',
    );
    assert.ok(
      tutorAdjudicationPrompts.some((prompt) => /PUBLIC_ACTION_GATE: exact learner action/.test(prompt)),
      'tutor ego adjudication should require a concrete public action gate',
    );
    assert.ok(
      tutorAdjudicationPrompts.some(
        (prompt) => /stock-taking contrast/.test(prompt) && /new public device/.test(prompt),
      ),
      'tutor ego adjudication should force a public contrast plus new device',
    );
    assert.ok(
      tutorAdjudicationPrompts.some((prompt) => /pressure-to-device fit/.test(prompt)),
      'tutor ego adjudication should force fit between the learner pressure and the device',
    );
    assert.ok(
      tutorAdjudicationPrompts.some((prompt) => /affective register/.test(prompt)),
      'tutor ego adjudication should allow register shift as an adaptive mechanism',
    );
  });

  it('builds affective adaptation context from procedural route changes', () => {
    const context = buildTutorAffectiveAdaptationContext({
      policy: 'procedural_sensitive',
      contract: 'Track stance separately from procedure.',
      routeChange: { from: 'single metric', to: 'claim-evidence audit gate' },
      learnerReversalEvent: { triggerType: 'resistance' },
    });

    assert.match(context, /whether or not a procedural route change/u);
    assert.match(context, /single metric -> claim-evidence audit gate/u);
    assert.match(context, /stricter evidence gate = respectful firmness/u);
    assert.match(context, /Current learner pressure cue: resistance/u);
  });

  it('passes affective adaptation into tutor prompts without requiring procedural adaptation', async () => {
    const calls = [];
    async function llmCall(model, systemPrompt, messages, options = {}) {
      calls.push({ model, systemPrompt, messages, options });
      const user = messages?.[0]?.content || '';
      if (options.agentRole === 'learner_superego') {
        return { content: 'Stay defensive but do not invent a breakthrough.', usage: {} };
      }
      if (options.agentRole === 'learner_ego' && /opening message/.test(user)) {
        return { content: 'FINAL:\nI trust the headline score because the table says 94%.', usage: {} };
      }
      if (options.agentRole === 'learner_ego' && /Produce your final response/.test(user)) {
        return { content: 'FINAL:\nFine, but I still think the score should be enough.', usage: {} };
      }
      if (options.agentRole === 'learner_ego') {
        return { content: 'I trust the headline score because the table says 94%.', usage: {} };
      }
      if (options.agentRole === 'tutor_superego') {
        return {
          content:
            'FEEDBACK: The draft keeps the evidence gate.\nAFFECT_CHECK: PARTIAL - it has not named the status pressure.\nREQUIRED_REWRITE: keep the same evidence standard but use respectful firmness.\nKEEP_OR_CHANGE: revise lightly',
          usage: {},
        };
      }
      if (
        options.agentRole === 'tutor_ego' &&
        /Your initial tutor response was/.test(promptSurface(systemPrompt, messages))
      ) {
        return {
          content:
            'PRIVATE_DECISION: revise lightly; AFFECTIVE_STANCE: defensiveness -> respectful firmness.\nFINAL:\nKeep the claim on the table. Before I sign off, point to the one row that makes the 94% usable beyond this sample.',
          usage: {},
        };
      }
      if (options.agentRole === 'tutor_ego') {
        return { content: 'Point to the row that makes the 94% usable beyond this sample.', usage: {} };
      }
      return { content: 'stub', usage: {} };
    }

    const directorPlan = {
      opening_speaker: 'learner',
      tutor_adaptation_policy: 'none',
      affective_adaptation_policy: 'procedural_sensitive',
      affective_adaptation_contract: 'Track learner stance separately from procedural route changes.',
    };

    const result = await runInteraction(
      {
        learnerId: 'test-learner-affect',
        personaId: 'resistant_learner',
        tutorProfile: 'recognition',
        topic: 'AI model evaluation',
        scenario: {
          name: 'Affective adaptation test',
          learnerStartState: 'The learner treats a headline metric as sufficient.',
          directorPlan,
        },
      },
      llmCall,
      {
        maxTurns: 1,
        forceMaxTurns: true,
        observeInternals: true,
        learnerProfile: 'ego_superego',
        directorPlan,
      },
    );

    const tutorTurn = result.turns.find((turn) => turn.phase === 'tutor');
    assert.ok(tutorTurn, 'expected a tutor turn');
    assert.equal(tutorTurn.learnerReversalEventUsed, null);
    assert.match(tutorTurn.externalMessage, /Before I sign off/u);

    const tutorPrompts = calls
      .filter((call) => call.options.agentRole === 'tutor_ego' || call.options.agentRole === 'tutor_superego')
      .map((call) => promptSurface(call))
      .join('\n');
    assert.match(tutorPrompts, /Tutor-private affective adaptation layer/u);
    assert.match(tutorPrompts, /AFFECT_CHECK/u);
    assert.match(tutorPrompts, /AFFECTIVE_STANCE/u);
    assert.doesNotMatch(tutorPrompts, /Because a peripeteia event is present/u);
    const tutorSuperegoPrompts = calls
      .filter((call) => call.options.agentRole === 'tutor_superego')
      .map((call) => promptSurface(call));
    assert.ok(
      tutorSuperegoPrompts.every((prompt) => !/PERIPETEIA_CHECK/.test(prompt)),
      'affective-only turn should not request a peripeteia check',
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
        return {
          content: "FINAL:\nBut that still doesn't make sense; I don't see why the old route works.",
          usage: {},
        };
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
      if (
        options.agentRole === 'tutor_ego' &&
        /Your initial tutor response was/.test(promptSurface(systemPrompt, messages))
      ) {
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
      .map((call) => promptSurface(call));
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
