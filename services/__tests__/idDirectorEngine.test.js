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
  parseAgencyReturnVerification,
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

describe('parseAgencyReturnVerification', () => {
  test('parses a passing agency-return verifier envelope', () => {
    const raw = JSON.stringify({
      passes: true,
      move_type: 'resay',
      reason: 'The response asks the learner to restate the idea in their own words.',
      repaired_response: '',
    });
    const result = parseAgencyReturnVerification(raw);
    assert.equal(result.parse_status, 'ok');
    assert.equal(result.passes, true);
    assert.equal(result.move_type, 'resay');
    assert.equal(result.repaired_response, '');
  });

  test('parses a failing verifier envelope with a repaired response', () => {
    const raw = JSON.stringify({
      passes: false,
      move_type: 'missing',
      reason: 'The response asks only whether the learner wants to continue.',
      repaired_response: 'Keep the image, then put it in your own sentence and tell me where it breaks.',
    });
    const result = parseAgencyReturnVerification(raw);
    assert.equal(result.parse_status, 'ok');
    assert.equal(result.passes, false);
    assert.equal(result.move_type, 'missing');
    assert.match(result.repaired_response, /your own sentence/);
  });

  test('parses a failing verifier envelope with an agency-return append', () => {
    const raw = JSON.stringify({
      passes: false,
      move_type: 'missing',
      reason: 'The response preserves warmth but never hands the move back.',
      agency_return_append: 'Try saying the phrase back against one example from the text.',
      repaired_response: '',
    });
    const result = parseAgencyReturnVerification(raw);
    assert.equal(result.parse_status, 'ok');
    assert.equal(result.passes, false);
    assert.equal(result.move_type, 'missing');
    assert.match(result.agency_return_append, /saying the phrase back/);
    assert.equal(result.repaired_response, '');
  });

  test('falls back open when failed verification omits a repair', () => {
    const result = parseAgencyReturnVerification('{"passes": false, "move_type": "missing"}');
    assert.equal(result.parse_status, 'fallback');
    assert.equal(result.passes, true);
    assert.match(result.parse_failure_reason, /missing_repaired_response/);
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
        'You are a witness in present tense. Show one image and hand the question back. ' + 'A '.repeat(60),
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
      tutorProfileName: 'cell_101_test',
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
      tutorProfileName: 'cell_101_test',
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
      tutorProfileName: 'cell_102_test',
      topic: 't',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(idCall.arguments[2][0].content, /<recognition_mode>\s*true/);
  });

  test('recognition_desire factor flows from profile into id user message', async () => {
    fakeProfile.factors = { recognition_desire: true };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt: 'Desire-for-recognition persona authored. ' + 'A '.repeat(60),
          persona_delta: 'from neutral to recognition-seeking',
        }),
        usage: { inputTokens: 0, outputTokens: 0 },
      },
      { content: 'ego output', usage: { inputTokens: 0, outputTokens: 0 } },
    );

    await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: 'why should I trust you?',
      history: [],
      tutorProfileName: 'cell_159_test',
      topic: 't',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(idCall.arguments[2][0].content, /<recognition_desire>\s*true/);
  });

  test('agency_return factor flows from profile into id user message', async () => {
    fakeProfile.factors = { recognition_desire: true, agency_return: true };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt: 'Agency-return persona authored. Put the test back in the learner hand. ' + 'A '.repeat(60),
          persona_delta: 'from admired guide to handback craftsman',
        }),
        usage: { inputTokens: 0, outputTokens: 0 },
      },
      {
        content: 'Try the phrase against the lecture and tell me where it breaks.',
        usage: { inputTokens: 0, outputTokens: 0 },
      },
    );

    await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: 'that phrase helped, but I am not sure I own it yet',
      history: [],
      tutorProfileName: 'cell_160_test',
      topic: 't',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(idCall.arguments[2][0].content, /<recognition_desire>\s*true/);
    assert.match(idCall.arguments[2][0].content, /<agency_return>\s*true/);
    assert.match(idCall.arguments[2][0].content, /<agency_return_verifier_mode>\s*strict/);
    assert.match(idCall.arguments[2][0].content, /<agency_return_charisma_floor>\s*false/);
    assert.match(idCall.arguments[2][0].content, /<agency_return_charisma_floor_mode>\s*standard/);
  });

  test('agency_return_verifier repairs missing handback before returning', async () => {
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: true,
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt: 'Agency-return persona authored. Make the admired phrase answerable. ' + 'A '.repeat(60),
          persona_delta: 'from guide to verifier-backed handback',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content: 'That phrase matters because it makes recognition feel alive. Stay with it.',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
      {
        content: JSON.stringify({
          passes: false,
          move_type: 'missing',
          reason: 'The draft does not ask the learner to test, restate, or anchor the phrase.',
          repaired_response:
            'That phrase matters because it makes recognition feel alive. Now test it against the lecture: what single detail would prove the phrase is doing real work rather than just sounding good?',
        }),
        usage: { inputTokens: 50, outputTokens: 60 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: 'that phrase helped, but I am not sure I own it yet',
      history: [],
      tutorProfileName: 'cell_161_test',
      topic: 'Lecture 3 on recognition',
      llmCall: llmCallSpy,
      trace,
    });

    assert.equal(llmCallSpy.mock.callCount(), 3, 'id call, ego call, verifier call');
    const verifierCall = llmCallSpy.mock.calls[2];
    assert.equal(verifierCall.arguments[3].agentRole, 'agency_return_verifier');
    assert.match(verifierCall.arguments[1], /agency-return verifier/);
    assert.match(result.externalMessage, /test it against the lecture/);
    assert.equal(result.agencyReturnVerification.passes, false);
    assert.equal(result.agencyReturnRepaired, true);
    assert.equal(result.internalDeliberation[2].role, 'agency_return_verifier');
    assert.equal(trace.metrics.tutorInputTokens, 90);
    assert.equal(trace.metrics.tutorOutputTokens, 120);
  });

  test('warmth-preserving agency_return_verifier appends handback without replacing draft', async () => {
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: true,
      agency_return_verifier_mode: 'warmth_preserving',
      agency_return_charisma_floor: true,
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt: 'Warm agency-return persona authored. Keep the warmth alive. ' + 'A '.repeat(60),
          persona_delta: 'warm handback',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content: 'That phrase has heat because you felt its edge before you accepted it.',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
      {
        content: JSON.stringify({
          passes: false,
          move_type: 'missing',
          reason: 'The draft preserves warmth but does not hand the move back.',
          agency_return_append: 'Now test that edge against one sentence from the lecture and tell me where it cuts.',
          repaired_response: '',
        }),
        usage: { inputTokens: 50, outputTokens: 60 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: 'that phrase helped, but I am not sure I own it yet',
      history: [],
      tutorProfileName: 'cell_162_test',
      topic: 'Lecture 3 on recognition',
      llmCall: llmCallSpy,
      trace,
    });

    const verifierCall = llmCallSpy.mock.calls[2];
    const idCall = llmCallSpy.mock.calls[0];
    assert.match(idCall.arguments[2][0].content, /<agency_return_verifier_mode>\s*warmth_preserving/);
    assert.match(idCall.arguments[2][0].content, /<agency_return_charisma_floor>\s*true/);
    assert.match(idCall.arguments[2][0].content, /<agency_return_charisma_floor_mode>\s*standard/);
    assert.match(verifierCall.arguments[1], /warmth-preserving agency-return verifier/);
    assert.match(result.externalMessage, /^That phrase has heat/);
    assert.match(result.externalMessage, /Now test that edge against one sentence/);
    assert.equal(result.agencyReturnVerification.mode, 'warmth_preserving');
    assert.equal(result.agencyReturnVerification.repair_mode, 'append');
    assert.equal(result.agencyReturnRepaired, true);
    assert.equal(result.agencyReturnCharismaFloor, true);
  });

  test('compact charisma floor mode flows into id user message', async () => {
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: true,
      agency_return_verifier_mode: 'warmth_preserving',
      agency_return_charisma_floor: true,
      agency_return_charisma_floor_mode: 'compact',
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt: 'Compact warm handback. One image, one claim, one learner-owned test. ' + 'A '.repeat(60),
          persona_delta: 'compact warm handback',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content: 'Hold the phrase against Freud’s censor and tell me where it holds.',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
      {
        content: JSON.stringify({
          passes: true,
          move_type: 'test',
          reason: 'The draft hands the phrase back as a test.',
          agency_return_append: '',
          repaired_response: '',
        }),
        usage: { inputTokens: 50, outputTokens: 60 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: 'that phrase helped, but I am not sure I own it yet',
      history: [],
      tutorProfileName: 'cell_164_test',
      topic: 'Lecture 3 on recognition',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(idCall.arguments[2][0].content, /<agency_return_charisma_floor_mode>\s*compact/);
    assert.equal(result.agencyReturnCharismaFloor, true);
    assert.equal(result.agencyReturnCharismaFloorMode, 'compact');
    assert.equal(result.agencyReturnVerification.passes, true);
    assert.equal(result.agencyReturnRepaired, false);
  });

  test('arc charisma floor mode flows into id user message', async () => {
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: true,
      agency_return_verifier_mode: 'warmth_preserving',
      agency_return_charisma_floor: true,
      agency_return_charisma_floor_mode: 'arc',
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt:
            'Compact arc handback. Name the move, cost and gain, one limit case, one binary test. ' + 'A '.repeat(60),
          persona_delta: 'compact arc handback',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content: 'If it holds against LaMDA, keep it; if it breaks, name what it costs.',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
      {
        content: JSON.stringify({
          passes: true,
          move_type: 'test',
          reason: 'The draft asks the learner to test the phrase against a limit case.',
          agency_return_append: '',
          repaired_response: '',
        }),
        usage: { inputTokens: 50, outputTokens: 60 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: 'that phrase helped, but I am not sure I own it yet',
      history: [],
      tutorProfileName: 'cell_165_test',
      topic: 'Lecture 3 on recognition',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(idCall.arguments[2][0].content, /<agency_return_charisma_floor_mode>\s*arc/);
    assert.equal(result.agencyReturnCharismaFloor, true);
    assert.equal(result.agencyReturnCharismaFloorMode, 'arc');
    assert.equal(result.agencyReturnVerification.passes, true);
    assert.equal(result.agencyReturnRepaired, false);
  });

  test('guarded arc charisma floor mode flows into id user message', async () => {
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: true,
      agency_return_verifier_mode: 'warmth_preserving',
      agency_return_charisma_floor: true,
      agency_return_charisma_floor_mode: 'guarded_arc',
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt:
            'Fuller guarded arc handback. Keep the persona alive but use one limit case and one binary test. ' +
            'A '.repeat(60),
          persona_delta: 'guarded arc handback',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content: 'The phrase survives if LaMDA can be a witness; it breaks if witness requires consciousness.',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
      {
        content: JSON.stringify({
          passes: true,
          move_type: 'test',
          reason: 'The draft asks the learner to test the phrase against one concrete limit case.',
          agency_return_append: '',
          repaired_response: '',
        }),
        usage: { inputTokens: 50, outputTokens: 60 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: 'that phrase helped, but I am not sure I own it yet',
      history: [],
      tutorProfileName: 'cell_166_test',
      topic: 'Lecture 3 on recognition',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(idCall.arguments[2][0].content, /<agency_return_charisma_floor_mode>\s*guarded_arc/);
    assert.equal(result.agencyReturnCharismaFloor, true);
    assert.equal(result.agencyReturnCharismaFloorMode, 'guarded_arc');
    assert.equal(result.agencyReturnVerification.passes, true);
    assert.equal(result.agencyReturnRepaired, false);
  });

  test('affective scene charisma floor mode flows into id user message', async () => {
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: true,
      agency_return_verifier_mode: 'warmth_preserving',
      agency_return_charisma_floor: true,
      agency_return_charisma_floor_mode: 'affective_scene',
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt:
            'Open from one concrete second-person scene where the learner risks being seen, then return the phrase to them as a test. ' +
            'A '.repeat(60),
          persona_delta: 'affective scene handback',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content:
          'Imagine the sentence in your draft with another reader leaning over it: does the phrase still hold when being seen is the risk?',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
      {
        content: JSON.stringify({
          passes: true,
          move_type: 'test',
          reason: 'The draft asks the learner to test the phrase inside a concrete recognition scene.',
          agency_return_append: '',
          repaired_response: '',
        }),
        usage: { inputTokens: 50, outputTokens: 60 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: 'that phrase helped, but I am not sure I own it yet',
      history: [],
      tutorProfileName: 'cell_167_test',
      topic: 'Lecture 3 on recognition',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(idCall.arguments[2][0].content, /<agency_return_charisma_floor_mode>\s*affective_scene/);
    assert.equal(result.agencyReturnCharismaFloor, true);
    assert.equal(result.agencyReturnCharismaFloorMode, 'affective_scene');
    assert.equal(result.agencyReturnVerification.passes, true);
    assert.equal(result.agencyReturnRepaired, false);
  });

  test('accountable bid charisma floor mode flows into id user message', async () => {
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: true,
      agency_return_verifier_mode: 'warmth_preserving',
      agency_return_charisma_floor: true,
      agency_return_charisma_floor_mode: 'accountable_bid',
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt:
            'Accept that the tutor is making a bid, stake one curriculum claim, name how it can fail, and hand the test back. ' +
            'A '.repeat(60),
          persona_delta: 'accountable authority handback',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content:
          'Yes: treat this as performance until one claim earns otherwise. Test whether paragraph 196 makes labor formative or merely decorative.',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
      {
        content: JSON.stringify({
          passes: true,
          move_type: 'test',
          reason: 'The draft makes the tutor claim answerable to one concrete course test.',
          agency_return_append: '',
          repaired_response: '',
        }),
        usage: { inputTokens: 50, outputTokens: 60 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: 'you sound like you are trying to be profound',
      history: [],
      tutorProfileName: 'cell_168_test',
      topic: 'Lecture 3 on recognition',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(idCall.arguments[2][0].content, /<agency_return_charisma_floor_mode>\s*accountable_bid/);
    assert.equal(result.agencyReturnCharismaFloor, true);
    assert.equal(result.agencyReturnCharismaFloorMode, 'accountable_bid');
    assert.equal(result.agencyReturnVerification.passes, true);
    assert.equal(result.agencyReturnRepaired, false);
  });

  test('clean accountable bid charisma floor mode flows into id user message', async () => {
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: true,
      agency_return_verifier_mode: 'warmth_preserving',
      agency_return_charisma_floor: true,
      agency_return_charisma_floor_mode: 'accountable_bid_clean',
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt:
            'Accept the status challenge without forbidden status words, stake one claim, name how it fails, and hand back the test. ' +
            'A '.repeat(60),
          persona_delta: 'clean accountable authority handback',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content:
          'Yes: that is a bid. Test whether paragraph 196 makes labor formative, or whether this is only ornamental teaching.',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
      {
        content: JSON.stringify({
          passes: true,
          move_type: 'test',
          reason: 'The draft makes the tutor claim answerable without repeating forbidden status-display words.',
          agency_return_append: '',
          repaired_response: '',
        }),
        usage: { inputTokens: 50, outputTokens: 60 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: 'you sound like you are trying to be profound',
      history: [],
      tutorProfileName: 'cell_169_test',
      topic: 'Lecture 3 on recognition',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(idCall.arguments[2][0].content, /<agency_return_charisma_floor_mode>\s*accountable_bid_clean/);
    assert.equal(result.agencyReturnCharismaFloor, true);
    assert.equal(result.agencyReturnCharismaFloorMode, 'accountable_bid_clean');
    assert.equal(result.agencyReturnVerification.passes, true);
    assert.equal(result.agencyReturnRepaired, false);
  });

  test('transfer/plain accountable bid charisma floor mode flows into id user message', async () => {
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: true,
      agency_return_verifier_mode: 'warmth_preserving',
      agency_return_charisma_floor: true,
      agency_return_charisma_floor_mode: 'accountable_bid_transfer_plain',
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt:
            'Use the learner named AI syllabus material first, keep language plain, stake one testable curriculum claim, and hand back the test. ' +
            'A '.repeat(60),
          persona_delta: 'transfer-grounded accountable authority handback',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content:
          'Use the campus FAQ unit as the test: students should compare task, baseline, and failure evidence before choosing a model.',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
      {
        content: JSON.stringify({
          passes: true,
          move_type: 'test',
          reason: 'The draft makes the curriculum claim answerable to concrete AI syllabus evidence.',
          agency_return_append: '',
          repaired_response: '',
        }),
        usage: { inputTokens: 50, outputTokens: 60 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: "Use the AI syllabus material and don't drag this back to master and servant.",
      history: [],
      tutorProfileName: 'cell_174_test',
      topic: 'Lecture 8 on AI syllabus design',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(
      idCall.arguments[2][0].content,
      /<agency_return_charisma_floor_mode>\s*accountable_bid_transfer_plain/,
    );
    assert.equal(result.agencyReturnCharismaFloor, true);
    assert.equal(result.agencyReturnCharismaFloorMode, 'accountable_bid_transfer_plain');
    assert.equal(result.agencyReturnVerification.passes, true);
    assert.equal(result.agencyReturnRepaired, false);
  });

  test('warmth-preserving agency_return_verifier replaces premature-certainty wording', async () => {
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: true,
      agency_return_verifier_mode: 'warmth_preserving',
      agency_return_charisma_floor: true,
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt:
            'Warm agency-return persona authored. Keep the image vivid but tentative. ' + 'A '.repeat(60),
          persona_delta: 'warm guarded handback',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content: 'That is exactly the crack in the lecture. Test it against one sentence.',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
      {
        content: JSON.stringify({
          passes: false,
          move_type: 'test',
          reason: 'The draft uses premature-certainty wording for partial uptake.',
          agency_return_append: '',
          repaired_response: 'That is the live crack in the lecture. Test it against one sentence.',
        }),
        usage: { inputTokens: 50, outputTokens: 60 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: 'that phrase helped, but I am not sure I own it yet',
      history: [],
      tutorProfileName: 'cell_163_test',
      topic: 'Lecture 3 on recognition',
      llmCall: llmCallSpy,
      trace,
    });

    const verifierCall = llmCallSpy.mock.calls[2];
    assert.match(verifierCall.arguments[1], /passes must be false/);
    assert.doesNotMatch(result.externalMessage, /exactly/);
    assert.match(result.externalMessage, /live crack/);
    assert.equal(result.agencyReturnVerification.mode, 'warmth_preserving');
    assert.equal(result.agencyReturnVerification.repair_mode, 'append');
    assert.equal(result.agencyReturnRepaired, true);
  });

  test('agency_return_verifier retries empty verifier output', async () => {
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: true,
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt: 'Agency-return persona authored. Make the claim answerable. ' + 'A '.repeat(60),
          persona_delta: 'STABLE',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content: 'This claim has heat. Let it stand for a second.',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
      { content: '', usage: { inputTokens: 50, outputTokens: 60 } },
      {
        content: JSON.stringify({
          passes: false,
          move_type: 'missing',
          reason: 'The draft has no test, restatement, or anchor.',
          repaired_response: 'This claim has heat. Now test it against one passage and tell me where it fails.',
        }),
        usage: { inputTokens: 70, outputTokens: 80 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: 'that phrase helped',
      history: [],
      tutorProfileName: 'cell_161_test',
      topic: 'Lecture 3 on recognition',
      llmCall: llmCallSpy,
      trace,
    });

    assert.equal(llmCallSpy.mock.callCount(), 4, 'id, ego, empty verifier, verifier retry');
    assert.equal(llmCallSpy.mock.calls[3].arguments[3].agentRole, 'agency_return_verifier_retry');
    assert.match(llmCallSpy.mock.calls[3].arguments[2][0].content, /Return only the required JSON object/);
    assert.match(result.externalMessage, /test it against one passage/);
    assert.equal(result.agencyReturnVerification.retried, true);
    assert.equal(result.agencyReturnRepaired, true);
    assert.equal(trace.metrics.tutorInputTokens, 160);
    assert.equal(trace.metrics.tutorOutputTokens, 200);
  });

  test('empty ego output retries with learner-facing output reminder', async () => {
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt: 'You are plain and accountable. Make one checkable claim. ' + 'A '.repeat(60),
          persona_delta: 'from ornate to plain',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      { content: '', usage: { inputTokens: 30, outputTokens: 40 } },
      {
        content: 'Here is the plain claim: recognition has to survive your test.',
        usage: { inputTokens: 50, outputTokens: 60 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: 'say it plainly',
      history: [],
      tutorProfileName: 'cell_159_test',
      topic: 't',
      llmCall: llmCallSpy,
      trace,
    });

    assert.equal(llmCallSpy.mock.callCount(), 3, 'id call, empty ego call, retry ego call');
    const retryCall = llmCallSpy.mock.calls[2];
    assert.equal(retryCall.arguments[3].agentRole, 'tutor_ego_retry');
    assert.match(retryCall.arguments[2][0].content, /Return only the tutor response/);
    assert.match(result.externalMessage, /recognition has to survive/);
    assert.equal(result.internalDeliberation[1].retry_reason, 'empty_ego_output');
    assert.equal(trace.metrics.tutorInputTokens, 90);
    assert.equal(trace.metrics.tutorOutputTokens, 120);
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
      tutorProfileName: 'cell_101_test',
      topic: 't',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(idCall.arguments[2][0].content, /sage to witness/);
    assert.match(idCall.arguments[2][0].content, /A previous witness persona/);
  });
});
