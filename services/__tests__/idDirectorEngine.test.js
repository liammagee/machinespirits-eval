/**
 * Unit tests for services/idDirectorEngine.js.
 *
 * Uses the engine's __setDeps / __resetDeps escape hatch rather than
 * mock.module, since mock.module is gated behind --experimental-test-module-mocks
 * and the existing project test command does not enable that flag.
 *
 * Verifies:
 *   1. parseIdConstruction handles well-formed, fenced, and malformed input.
 *   2. extractPreviousPersona reads the most recent tutor turn's id
 *      deliberation entry from the trace, or returns FIRST_TURN.
 *   3. runIdDirectedTurn calls llmCall twice (id then ego), splices the id's
 *      generated_prompt into the ego's system parameter verbatim, emits two
 *      trace entries with the right role labels, increments token counts on
 *      the trace metrics, and returns the standard runTutorTurn shape.
 *   4. Malformed id output triggers the fallback path: ego still gets called
 *      with the fallback prompt, parse_status = 'fallback'.
 */

import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseIdConstruction,
  extractPreviousPersona,
  runIdDirectedTurn,
  __setDeps,
  __resetDeps,
} from '../idDirectorEngine.js';

// ─── parseIdConstruction ─────────────────────────────────────────────────────
describe('parseIdConstruction', () => {
  test('parses a well-formed JSON envelope', () => {
    const raw = JSON.stringify({
      generated_prompt:
        'You are a quiet witness who has read the Phaedrus closely. Speak in present tense and concrete particulars. End by handing the question back to the learner.',
      persona_delta: 'from peer to witness',
      stage_directions: 'image-led; one scene only',
      reasoning: 'Learner asked for an example; one image carries the contrast better than a list.',
    });
    const result = parseIdConstruction(raw);
    assert.equal(result.parse_status, 'ok');
    assert.match(result.generated_prompt, /Phaedrus/);
    assert.equal(result.persona_delta, 'from peer to witness');
  });

  test('strips markdown code fence and parses', () => {
    const inner = JSON.stringify({
      generated_prompt: 'You are a fellow-traveller. ' + 'A '.repeat(60),
      persona_delta: 'STABLE',
      stage_directions: '',
      reasoning: 'Continuity warranted; learner is mid-thought.',
    });
    const raw = '```json\n' + inner + '\n```';
    const result = parseIdConstruction(raw);
    assert.equal(result.parse_status, 'ok');
    assert.equal(result.persona_delta, 'STABLE');
  });

  test('falls back when JSON is malformed', () => {
    const result = parseIdConstruction('not json at all { just text }');
    assert.equal(result.parse_status, 'fallback');
    assert.match(result.parse_failure_reason, /json_parse_error/);
    assert.ok(result.generated_prompt.length > 50, 'fallback prompt is non-trivial');
  });

  test('falls back when generated_prompt is missing or too short', () => {
    const raw = JSON.stringify({ generated_prompt: 'short' });
    const result = parseIdConstruction(raw);
    assert.equal(result.parse_status, 'fallback');
    assert.equal(result.parse_failure_reason, 'parse_succeeded_but_invalid_shape');
  });

  test('falls back on empty input', () => {
    const result = parseIdConstruction('');
    assert.equal(result.parse_status, 'fallback');
    assert.equal(result.parse_failure_reason, 'empty_or_non_string_response');
  });
});

// ─── extractPreviousPersona ──────────────────────────────────────────────────
describe('extractPreviousPersona', () => {
  test('returns FIRST_TURN on empty trace', () => {
    assert.equal(extractPreviousPersona(null), 'FIRST_TURN');
    assert.equal(extractPreviousPersona({}), 'FIRST_TURN');
    assert.equal(extractPreviousPersona({ turns: [] }), 'FIRST_TURN');
  });

  test('returns FIRST_TURN when no tutor turns yet', () => {
    const trace = {
      turns: [{ phase: 'learner', internalDeliberation: [] }],
    };
    assert.equal(extractPreviousPersona(trace), 'FIRST_TURN');
  });

  test('returns the most recent id construction summary', () => {
    const trace = {
      turns: [
        { phase: 'learner', internalDeliberation: [] },
        {
          phase: 'tutor',
          internalDeliberation: [
            {
              role: 'id',
              construction: {
                generated_prompt: 'You are a sage who has read the Phaedrus.'.repeat(5),
                persona_delta: 'sage register',
                reasoning: 'Learner curious about memory.',
              },
            },
            { role: 'ego', content: 'ego output' },
          ],
        },
        { phase: 'learner', internalDeliberation: [] },
      ],
    };
    const out = extractPreviousPersona(trace);
    assert.match(out, /sage register/);
    assert.match(out, /Phaedrus/);
  });
});

// ─── runIdDirectedTurn ───────────────────────────────────────────────────────
describe('runIdDirectedTurn', () => {
  let queuedResponses;
  let llmCallSpy;
  let trace;
  let fakeProfile;
  const fakeEgoConfig = {
    model: 'fake/ego-model',
    provider: 'fake',
    prompt: '(unused — id authors fresh ego prompt each turn)',
    hyperparameters: { temperature: 0.6, max_tokens: 4000 },
  };
  const fakeIdConfig = {
    model: 'fake/id-model',
    provider: 'fake',
    prompt: 'YOU ARE THE ID DIRECTOR (mocked static prompt)',
    hyperparameters: { temperature: 0.4, max_tokens: 4000 },
  };

  beforeEach(() => {
    queuedResponses = [];
    llmCallSpy = mock.fn(async () => {
      if (queuedResponses.length === 0) {
        throw new Error('test bug: llmCall invoked more times than queued responses');
      }
      return queuedResponses.shift();
    });
    trace = {
      turns: [],
      metrics: { tutorInputTokens: 0, tutorOutputTokens: 0 },
    };
    fakeProfile = { recognition_mode: false };
    __setDeps({
      tutorConfig: {
        getActiveProfile: () => fakeProfile,
        getAgentConfig: (role) => (role === 'ego' ? fakeEgoConfig : fakeIdConfig),
        getProviderConfig: () => ({ default_model: 'fake/default-model' }),
      },
      tutorWritingPad: {
        buildNarrativeSummary: () => '(test memory: none)',
      },
    });
  });

  afterEach(() => {
    __resetDeps();
  });

  test('happy path: id authors prompt, ego executes against it', async () => {
    const idJson = JSON.stringify({
      generated_prompt:
        'You are a witness in present tense. Show one image and hand the question back. ' +
        'A '.repeat(60),
      persona_delta: 'from neutral to witness',
      stage_directions: 'image-led',
      reasoning: 'Learner asked for an example.',
    });
    queuedResponses.push(
      {
        content: idJson,
        usage: { inputTokens: 100, outputTokens: 200 },
        model: 'fake/id-model',
        provider: 'fake',
      },
      {
        content:
          'A scribe sits at the margin. The reed dries. The wax cools. So — which kind of remembering does the bard have?',
        usage: { inputTokens: 150, outputTokens: 80 },
        model: 'fake/ego-model',
        provider: 'fake',
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'learner-1',
      sessionId: 'sess-1',
      learnerMessage: 'Different kind of remembering — like what?',
      history: [{ role: 'learner', content: 'Why did Plato think writing weakens memory?' }],
      tutorProfileName: 'cell_100_test',
      topic: 'Course 601, Lecture 1: Stylus, Wax, and the First Externalized Memory.',
      llmCall: llmCallSpy,
      trace,
    });

    assert.equal(llmCallSpy.mock.callCount(), 2, 'llmCall invoked twice (id, then ego)');

    const [idCall, egoCall] = llmCallSpy.mock.calls;
    assert.equal(idCall.arguments[0], 'fake/id-model');
    assert.equal(idCall.arguments[1], fakeIdConfig.prompt);
    assert.match(idCall.arguments[2][0].content, /<recognition_mode>\s*false/);

    assert.equal(egoCall.arguments[0], 'fake/ego-model');
    assert.match(
      egoCall.arguments[1],
      /witness in present tense/,
      "ego's system prompt is the id's generated_prompt verbatim",
    );
    assert.equal(egoCall.arguments[2][0].content, 'Different kind of remembering — like what?');

    assert.match(result.externalMessage, /scribe/);
    assert.equal(result.strategy, 'id_directed');
    assert.equal(result.internalDeliberation.length, 2);
    assert.equal(result.internalDeliberation[0].role, 'id');
    assert.equal(result.internalDeliberation[1].role, 'ego');
    assert.equal(result.internalDeliberation[0].construction.parse_status, 'ok');
    assert.equal(
      result.internalDeliberation[1].rendered_system_prompt,
      result.internalDeliberation[0].construction.generated_prompt,
    );

    assert.equal(trace.metrics.tutorInputTokens, 250);
    assert.equal(trace.metrics.tutorOutputTokens, 280);
  });

  test('malformed id output triggers fallback; ego still runs', async () => {
    queuedResponses.push(
      { content: 'I refuse to follow the JSON contract.', usage: { inputTokens: 50, outputTokens: 20 } },
      { content: 'Fallback ego output.', usage: { inputTokens: 80, outputTokens: 40 } },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'learner-1',
      sessionId: 'sess-1',
      learnerMessage: 'Tell me more.',
      history: [],
      tutorProfileName: 'cell_100_test',
      topic: 'topic',
      llmCall: llmCallSpy,
      trace,
    });

    assert.equal(result.internalDeliberation[0].construction.parse_status, 'fallback');
    assert.equal(llmCallSpy.mock.callCount(), 2, 'ego is called even when id output is malformed');
    assert.match(result.externalMessage, /Fallback ego output/);
    assert.match(
      result.internalDeliberation[1].rendered_system_prompt,
      /attentive tutor with a definite voice/,
      'ego received the fallback generated_prompt',
    );
  });

  test('recognition_mode flag flows from profile into id user message', async () => {
    fakeProfile.recognition_mode = true;
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt: 'Recognition-flavored persona authored. ' + 'A '.repeat(60),
          persona_delta: 'STABLE',
        }),
        usage: { inputTokens: 0, outputTokens: 0 },
      },
      { content: 'ego output', usage: { inputTokens: 0, outputTokens: 0 } },
    );

    await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: 'hi',
      history: [],
      tutorProfileName: 'cell_101_test',
      topic: 't',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(idCall.arguments[2][0].content, /<recognition_mode>\s*true/);
  });

  test('previous persona is extracted from a populated trace', async () => {
    trace.turns = [
      {
        phase: 'tutor',
        internalDeliberation: [
          {
            role: 'id',
            construction: {
              generated_prompt: 'A previous witness persona authored on a prior turn. '.repeat(5),
              persona_delta: 'sage to witness',
              reasoning: 'Earlier opening.',
            },
          },
        ],
      },
    ];

    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt: 'Next persona. ' + 'A '.repeat(60),
          persona_delta: 'STABLE',
        }),
        usage: { inputTokens: 0, outputTokens: 0 },
      },
      { content: 'output', usage: { inputTokens: 0, outputTokens: 0 } },
    );

    await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: 'continue',
      history: [],
      tutorProfileName: 'cell_100_test',
      topic: 't',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(idCall.arguments[2][0].content, /sage to witness/);
    assert.match(idCall.arguments[2][0].content, /A previous witness persona/);
  });
});
