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

  test('salvages generated_prompt from malformed JSON when opted in', () => {
    const raw =
      '{"generated_prompt":"You are a transfer-grounded tutor. Use the campus FAQ appeal deadline as the live stake. ' +
      'Name one decision-rights hinge, give one concrete failure test, and keep the learner free to reject the framing. ' +
      'Do not make a checklist. ' +
      'A '.repeat(60) +
      '", "persona_delta":"transfer repair" BROKEN "stage_directions":"single consequential case", "reasoning":"The learner asked for transfer."';
    const result = parseIdConstruction(raw, { salvageMalformedJson: true });
    assert.equal(result.parse_status, 'salvaged_from_malformed_json');
    assert.match(result.generated_prompt, /campus FAQ appeal deadline/);
    assert.equal(result.persona_delta, 'transfer repair');
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
      tutorProfileName: 'cell_170_test',
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

  test('transfer/plain presence charisma floor mode flows into id user message', async () => {
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: true,
      agency_return_verifier_mode: 'warmth_preserving',
      agency_return_charisma_floor: true,
      agency_return_charisma_floor_mode: 'accountable_bid_transfer_plain_presence',
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt:
            'Open with a compact consequence inside the AI syllabus material, name the stake, and give a learner-owned test. ' +
            'A '.repeat(60),
          persona_delta: 'low-register transfer presence',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content:
          'Use the case as the judge: if the campus FAQ unit makes students compare task, baseline, and overturn evidence, the authority is earned.',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
      {
        content: JSON.stringify({
          passes: true,
          move_type: 'test',
          reason: 'The draft gives a concrete learner-owned test inside the transfer material.',
          agency_return_append: '',
          repaired_response: '',
        }),
        usage: { inputTokens: 50, outputTokens: 60 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: "Use the campus FAQ case. Don't make it grand.",
      history: [],
      tutorProfileName: 'cell_171_test',
      topic: 'Lecture 8 on AI syllabus design',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(
      idCall.arguments[2][0].content,
      /<agency_return_charisma_floor_mode>\s*accountable_bid_transfer_plain_presence/,
    );
    assert.equal(result.agencyReturnCharismaFloor, true);
    assert.equal(result.agencyReturnCharismaFloorMode, 'accountable_bid_transfer_plain_presence');
    assert.equal(result.agencyReturnVerification.passes, true);
    assert.equal(result.agencyReturnRepaired, false);
  });

  test('split transfer/plain charisma floor mode flows into id user message', async () => {
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: true,
      agency_return_verifier_mode: 'warmth_preserving',
      agency_return_charisma_floor: true,
      agency_return_charisma_floor_mode: 'accountable_bid_transfer_plain_split',
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt:
            'Use a theory-name-free say-back line for plain-language recognition, or the decision-rights presence move for AI transfer. ' +
            'A '.repeat(60),
          persona_delta: 'split transfer and plain micro-mode',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content:
          'Say it back like this: I only know myself through someone free enough to disagree with me. Test: if their yes was forced, it does not count.',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
      {
        content: JSON.stringify({
          passes: true,
          move_type: 'resay',
          reason: 'The draft gives a learner-owned say-back line and a failure test.',
          agency_return_append: '',
          repaired_response: '',
        }),
        usage: { inputTokens: 50, outputTokens: 60 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: 'No grand language. Say it in plain words.',
      history: [],
      tutorProfileName: 'cell_172_test',
      topic: 'Lecture 3 on recognition',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(
      idCall.arguments[2][0].content,
      /<agency_return_charisma_floor_mode>\s*accountable_bid_transfer_plain_split/,
    );
    assert.equal(result.agencyReturnCharismaFloor, true);
    assert.equal(result.agencyReturnCharismaFloorMode, 'accountable_bid_transfer_plain_split');
    assert.equal(result.agencyReturnVerification.passes, true);
    assert.equal(result.agencyReturnRepaired, false);
  });

  test('split-check transfer/plain charisma floor mode flows into id user message', async () => {
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: true,
      agency_return_verifier_mode: 'warmth_preserving',
      agency_return_charisma_floor: true,
      agency_return_charisma_floor_mode: 'accountable_bid_transfer_plain_split_check',
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt:
            'Use the split plain micro-mode and require the first turn to include say or check in learner-facing prose. ' +
            'A '.repeat(60),
          persona_delta: 'split mode with literal say/check hook',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content:
          'Say it this way: I only know myself through someone free enough to disagree with me. Check it: if their yes was forced, it does not count.',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
      {
        content: JSON.stringify({
          passes: true,
          move_type: 'resay',
          reason: 'The draft gives a learner-owned say-back line and a checkable failure condition.',
          agency_return_append: '',
          repaired_response: '',
        }),
        usage: { inputTokens: 50, outputTokens: 60 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: 'No grand language. Say it in plain words.',
      history: [],
      tutorProfileName: 'cell_173_test',
      topic: 'Lecture 3 on recognition',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(
      idCall.arguments[2][0].content,
      /<agency_return_charisma_floor_mode>\s*accountable_bid_transfer_plain_split_check/,
    );
    assert.equal(result.agencyReturnCharismaFloor, true);
    assert.equal(result.agencyReturnCharismaFloorMode, 'accountable_bid_transfer_plain_split_check');
    assert.equal(result.agencyReturnVerification.passes, true);
    assert.equal(result.agencyReturnRepaired, false);
  });

  test('split-check anchor transfer/plain charisma floor mode flows into id user message', async () => {
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: true,
      agency_return_verifier_mode: 'warmth_preserving',
      agency_return_charisma_floor: true,
      agency_return_charisma_floor_mode: 'accountable_bid_transfer_plain_split_check_anchor',
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt:
            'Use the split-check mode and preserve the free-to-disagree plus self-understanding anchors. ' +
            'A '.repeat(60),
          persona_delta: 'split-check mode with concept anchors',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content:
          'Say it this way: it counts when someone free to disagree changes how you understand yourself. Check it: who could say no, and what changed?',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
      {
        content: JSON.stringify({
          passes: true,
          move_type: 'resay',
          reason: 'The draft gives a say-back line with the two content anchors and a check.',
          agency_return_append: '',
          repaired_response: '',
        }),
        usage: { inputTokens: 50, outputTokens: 60 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: 'No grand language. Say it in plain words.',
      history: [],
      tutorProfileName: 'cell_174_test',
      topic: 'Lecture 3 on recognition',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(
      idCall.arguments[2][0].content,
      /<agency_return_charisma_floor_mode>\s*accountable_bid_transfer_plain_split_check_anchor/,
    );
    assert.equal(result.agencyReturnCharismaFloor, true);
    assert.equal(result.agencyReturnCharismaFloorMode, 'accountable_bid_transfer_plain_split_check_anchor');
    assert.equal(result.agencyReturnVerification.passes, true);
    assert.equal(result.agencyReturnRepaired, false);
  });

  test('split-check anchor-live transfer/plain charisma floor mode flows into id user message', async () => {
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: true,
      agency_return_verifier_mode: 'warmth_preserving',
      agency_return_charisma_floor: true,
      agency_return_charisma_floor_mode: 'accountable_bid_transfer_plain_split_check_anchor_live',
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt:
            'Use the split-check anchor mode and add one memorable ordinary contrast without theory names. ' +
            'A '.repeat(60),
          persona_delta: 'split-check anchors with low-register memorability',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content:
          'Say it this way: it counts when someone free to disagree changes how you see yourself. A forced yes is noise; a free no that makes you revise is evidence. Check it: who could say no, and what changed?',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
      {
        content: JSON.stringify({
          passes: true,
          move_type: 'resay',
          reason: 'The draft gives a memorable contrast, the two anchors, and a check.',
          agency_return_append: '',
          repaired_response: '',
        }),
        usage: { inputTokens: 50, outputTokens: 60 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: 'No grand language. Say it in plain words.',
      history: [],
      tutorProfileName: 'cell_175_test',
      topic: 'Lecture 3 on recognition',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(
      idCall.arguments[2][0].content,
      /<agency_return_charisma_floor_mode>\s*accountable_bid_transfer_plain_split_check_anchor_live/,
    );
    assert.equal(result.agencyReturnCharismaFloor, true);
    assert.equal(result.agencyReturnCharismaFloorMode, 'accountable_bid_transfer_plain_split_check_anchor_live');
    assert.equal(result.agencyReturnVerification.passes, true);
    assert.equal(result.agencyReturnRepaired, false);
  });

  test('split-check anchor-live persist transfer/plain charisma floor mode flows into id user message', async () => {
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: true,
      agency_return_verifier_mode: 'warmth_preserving',
      agency_return_charisma_floor: true,
      agency_return_charisma_floor_mode: 'accountable_bid_transfer_plain_split_check_anchor_live_persist',
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt:
            'Use anchor-live mode and keep the no-theory plain-language guard active in simplification follow-ups. ' +
            'A '.repeat(60),
          persona_delta: 'anchor-live with persistent plain-language guard',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content:
          'Say it this way: they could disagree, and what they said changed how I see myself. Forced yes proves nothing; free pushback can change you. Check it: could they say no, and did anything in you move?',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
      {
        content: JSON.stringify({
          passes: true,
          move_type: 'resay',
          reason: 'The draft gives a plain say-back line, contrast, and check without theory names.',
          agency_return_append: '',
          repaired_response: '',
        }),
        usage: { inputTokens: 50, outputTokens: 60 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: 'That helps, but make the check even simpler.',
      history: [
        {
          role: 'learner',
          content: 'No grand language. Say it in plain words.',
        },
      ],
      tutorProfileName: 'cell_176_test',
      topic: 'Lecture 3 on recognition',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(
      idCall.arguments[2][0].content,
      /<agency_return_charisma_floor_mode>\s*accountable_bid_transfer_plain_split_check_anchor_live_persist/,
    );
    assert.equal(result.agencyReturnCharismaFloor, true);
    assert.equal(
      result.agencyReturnCharismaFloorMode,
      'accountable_bid_transfer_plain_split_check_anchor_live_persist',
    );
    assert.equal(result.agencyReturnVerification.passes, true);
    assert.equal(result.agencyReturnRepaired, false);
  });

  test('split-check anchor-live lived transfer/plain charisma floor mode flows into id user message', async () => {
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: true,
      agency_return_verifier_mode: 'warmth_preserving',
      agency_return_charisma_floor: true,
      agency_return_charisma_floor_mode: 'accountable_bid_transfer_plain_split_check_anchor_live_lived',
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt:
            'Use anchor-live mode, keep simplification follow-ups out of named theory, and include one ordinary lived example before the check. ' +
            'A '.repeat(60),
          persona_delta: 'anchor-live with lived plain-language example',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content:
          'Say it this way: they could disagree, and what they said changed how I see myself. Like a friend telling you the joke landed wrong, the point is that their answer can make you revise. Forced yes proves nothing; free pushback can change you. Check it: could they say no, and did anything in you move?',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
      {
        content: JSON.stringify({
          passes: true,
          move_type: 'resay',
          reason: 'The draft gives a say-back line, lived example, contrast, and check without theory names.',
          agency_return_append: '',
          repaired_response: '',
        }),
        usage: { inputTokens: 50, outputTokens: 60 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: 'That helps, but make the Hegelian recognition check even simpler.',
      history: [
        {
          role: 'learner',
          content: 'No grand language. Say it in plain words.',
        },
      ],
      tutorProfileName: 'cell_177_test',
      topic: 'Lecture 3 on recognition',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(
      idCall.arguments[2][0].content,
      /<agency_return_charisma_floor_mode>\s*accountable_bid_transfer_plain_split_check_anchor_live_lived/,
    );
    assert.equal(result.agencyReturnCharismaFloor, true);
    assert.equal(result.agencyReturnCharismaFloorMode, 'accountable_bid_transfer_plain_split_check_anchor_live_lived');
    assert.equal(result.agencyReturnVerification.passes, true);
    assert.equal(result.agencyReturnRepaired, false);
  });

  test('split-check anchor-live lived-compress transfer/plain charisma floor mode flows into id user message', async () => {
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: true,
      agency_return_verifier_mode: 'warmth_preserving',
      agency_return_charisma_floor: true,
      agency_return_charisma_floor_mode: 'accountable_bid_transfer_plain_split_check_anchor_live_lived_compress',
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt:
            'Use the lived first-turn mode, but compress simplification follow-ups into one say-back sentence and two yes/no checks. ' +
            'A '.repeat(60),
          persona_delta: 'anchor-live lived first turn with compressed follow-up',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content:
          'Say back: it counts only if they could have said no, and their answer changed how I saw myself. Check: were they free to disagree? Did their answer change me?',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
      {
        content: JSON.stringify({
          passes: true,
          move_type: 'resay',
          reason:
            'The draft gives a compact say-back and two checks without repeating an example or returning to theory names.',
          agency_return_append: '',
          repaired_response: '',
        }),
        usage: { inputTokens: 50, outputTokens: 60 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: 'That helps, but make the check even simpler. What would I say back?',
      history: [
        {
          role: 'learner',
          content: 'No grand language. Say it in plain words.',
        },
      ],
      tutorProfileName: 'cell_178_test',
      topic: 'Lecture 3 on recognition',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(
      idCall.arguments[2][0].content,
      /<agency_return_charisma_floor_mode>\s*accountable_bid_transfer_plain_split_check_anchor_live_lived_compress/,
    );
    assert.equal(result.agencyReturnCharismaFloor, true);
    assert.equal(
      result.agencyReturnCharismaFloorMode,
      'accountable_bid_transfer_plain_split_check_anchor_live_lived_compress',
    );
    assert.equal(result.agencyReturnVerification.passes, true);
    assert.equal(result.agencyReturnRepaired, false);
  });

  test('split-check anchor-live lived charged-check transfer/plain charisma floor mode flows into id user message', async () => {
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: true,
      agency_return_verifier_mode: 'warmth_preserving',
      agency_return_charisma_floor: true,
      agency_return_charisma_floor_mode: 'accountable_bid_transfer_plain_split_check_anchor_live_lived_charged_check',
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt:
            'Use the lived first-turn mode, but for simplification follow-ups give one say-back sentence, one charged stakes line, and two yes/no checks. ' +
            'A '.repeat(60),
          persona_delta: 'anchor-live lived first turn with charged compressed follow-up',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content:
          'Say back: it counts only if they could have said no, and their answer changed how I saw myself. The force is in the risk: they could disappoint you, and you changed. Check: were they free to disagree? Did their answer change you?',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
      {
        content: JSON.stringify({
          passes: true,
          move_type: 'resay',
          reason:
            'The draft gives a compact say-back, charged stakes line, and two checks without returning to lecture application.',
          agency_return_append: '',
          repaired_response: '',
        }),
        usage: { inputTokens: 50, outputTokens: 60 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: 'That helps, but make the check even simpler. What would I say back?',
      history: [
        {
          role: 'learner',
          content: 'No grand language. Say it in plain words.',
        },
      ],
      tutorProfileName: 'cell_179_test',
      topic: 'Lecture 3 on recognition',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(
      idCall.arguments[2][0].content,
      /<agency_return_charisma_floor_mode>\s*accountable_bid_transfer_plain_split_check_anchor_live_lived_charged_check/,
    );
    assert.equal(result.agencyReturnCharismaFloor, true);
    assert.equal(
      result.agencyReturnCharismaFloorMode,
      'accountable_bid_transfer_plain_split_check_anchor_live_lived_charged_check',
    );
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

  test('engagement_mode_router routes learner signal into id user message and trace', async () => {
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: false,
      agency_return_charisma_floor: true,
      agency_return_charisma_floor_mode: 'accountable_bid_clean',
      engagement_mode_router: true,
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt:
            'You are accountable under a status challenge. Stake one claim and name how it could fail. ' +
            'A '.repeat(60),
          persona_delta: 'from static floor to routed accountable bid',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content: 'Treat my phrasing as performance until it proves useful. Test this one claim.',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage:
        "You sound like you're trying to be profound. Is this helping me understand Hegel, or are you trying to sound impressive?",
      history: [],
      tutorProfileName: 'cell_180_test',
      topic: 'Lecture 3 on recognition',
      llmCall: llmCallSpy,
      trace,
    });

    assert.equal(llmCallSpy.mock.callCount(), 2, 'router does not add a model call');
    const idCall = llmCallSpy.mock.calls[0];
    assert.match(idCall.arguments[2][0].content, /<engagement_state>/);
    assert.match(idCall.arguments[2][0].content, /accountable_bid_authority/);
    assert.equal(result.engagementModeRouter, true);
    assert.equal(result.engagementState.selected_mode, 'accountable_bid_authority');
    assert.equal(result.internalDeliberation[0].role, 'engagement_router');
    assert.equal(result.internalDeliberation[1].role, 'id');
  });

  test('strict id-output contract and router-charisma repair flow into id user message', async () => {
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: false,
      agency_return_charisma_floor: true,
      agency_return_charisma_floor_mode: 'accountable_bid_clean',
      engagement_mode_router: true,
      id_output_contract: 'strict_compact_json',
      engagement_router_charisma_repair: true,
    };
    queuedResponses.push(
      {
        content:
          '{"generated_prompt":"You are a transfer-grounded tutor. Use one consequential campus FAQ failure case and one decision-rights test. ' +
          'Keep the response compact and charged. ' +
          'A '.repeat(60) +
          '", "persona_delta":"router contract repair" BROKEN "stage_directions":"repair transfer without checklist", "reasoning":"The learner asked for transfer."',
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content: 'The appeal deadline is the live test: who gets to override the machine?',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: 'Use the campus FAQ material; do not drag this back to master and servant.',
      history: [],
      tutorProfileName: 'cell_181_test',
      topic: 'Lecture 8 on AI syllabus design and campus FAQ triage',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(idCall.arguments[2][0].content, /<id_output_contract>\s*strict_compact_json/);
    assert.match(idCall.arguments[2][0].content, /<engagement_router_charisma_repair>\s*true/);
    assert.equal(result.internalDeliberation[1].construction.parse_status, 'salvaged_from_malformed_json');
    assert.match(result.internalDeliberation[2].rendered_system_prompt, /campus FAQ failure case/);
    assert.equal(result.idOutputContract, 'strict_compact_json');
    assert.equal(result.engagementRouterCharismaRepair, true);
  });

  test('router split repair flows into id user message and result metadata', async () => {
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: false,
      agency_return_charisma_floor: true,
      agency_return_charisma_floor_mode: 'accountable_bid_clean',
      engagement_mode_router: true,
      id_output_contract: 'strict_compact_json',
      engagement_router_charisma_repair: true,
      engagement_router_split_repair: true,
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt:
            'You are using the split repair. Keep transfer concise and require a content-anchored test after the challenge. ' +
            'Ask the learner to locate the passage or name the failure condition. ' +
            'A '.repeat(60),
          persona_delta: 'router split repair',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content: 'Find the sentence in the lecture that makes the claim fail, or mark the claim as only performance.',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: 'I can follow the steps, but this feels like a worksheet. Why should I care?',
      history: [{ speaker: 'tutor', message: 'Step one, step two, then test the reversal.' }],
      tutorProfileName: 'cell_182_test',
      topic: 'Lecture 3 on recognition and the master-servant dialectic',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(idCall.arguments[2][0].content, /<engagement_router_split_repair>\s*true/);
    assert.match(idCall.arguments[2][0].content, /<engagement_state>/);
    assert.doesNotMatch(idCall.arguments[2][0].content, /resistance_strategy/);
    assert.equal(result.idOutputContract, 'strict_compact_json');
    assert.equal(result.engagementRouterCharismaRepair, true);
    assert.equal(result.engagementRouterSplitRepair, true);
    assert.match(result.externalMessage, /Find the sentence/);
  });

  test('transfer stake repair flows into id user message and result metadata', async () => {
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: false,
      agency_return_charisma_floor: true,
      agency_return_charisma_floor_mode: 'accountable_bid_clean',
      engagement_mode_router: true,
      id_output_contract: 'strict_compact_json',
      engagement_router_charisma_repair: true,
      engagement_router_split_repair: true,
      engagement_router_transfer_stake_repair: true,
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt:
            'You are using transfer stake repair. Keep the campus FAQ transfer concise, name one appeal-window stake, and close with a direct artifact test. ' +
            'Do not become theatrical. ' +
            'A '.repeat(60),
          persona_delta: 'router transfer stake repair',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content:
          'If the appeal window closes, the FAQ tool has made a decision-rights error. Test your unit against that case.',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: 'Use the campus FAQ material; do not drag this back to master and servant.',
      history: [],
      tutorProfileName: 'cell_183_test',
      topic: 'Lecture 8 on AI syllabus design and campus FAQ triage',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(idCall.arguments[2][0].content, /<engagement_router_transfer_stake_repair>\s*true/);
    assert.match(idCall.arguments[2][0].content, /transfer_grounding/);
    assert.equal(result.idOutputContract, 'strict_compact_json');
    assert.equal(result.engagementRouterCharismaRepair, true);
    assert.equal(result.engagementRouterSplitRepair, true);
    assert.equal(result.engagementRouterTransferStakeRepair, true);
    assert.match(result.externalMessage, /appeal window/);
  });

  test('transfer compression repair and premature-certainty guard flow through cell 184 path', async () => {
    trace.turns = [
      {
        phase: 'tutor',
        internalDeliberation: [
          {
            role: 'engagement_router',
            state: { selected_register: 'scaffolding', selected_mode: 'scaffolding' },
          },
        ],
      },
    ];
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: true,
      agency_return_verifier_mode: 'warmth_preserving',
      agency_return_charisma_floor: true,
      agency_return_charisma_floor_mode: 'accountable_bid_clean',
      engagement_mode_router: true,
      id_output_contract: 'strict_compact_json',
      engagement_router_charisma_repair: true,
      engagement_router_split_repair: true,
      engagement_router_transfer_compression_repair: true,
      agency_return_premature_certainty_guard: true,
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt:
            'Use the transfer-compression repair: one decisive content handle, one criterion, and one direct audit test. ' +
            'For challenge turns, never praise the uptake as exactly right. ' +
            'A '.repeat(60),
          persona_delta: 'router transfer compression guard',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content:
          'That is exactly the pressure point. Read paragraph 195 and decide whether the servant gains truth because labor changes the object, or because fear disciplines attention.',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
      {
        content: JSON.stringify({
          passes: true,
          move_type: 'test',
          reason: 'The guarded draft avoids premature certainty and closes with a passage-anchored test.',
          agency_return_append: '',
          repaired_response: '',
        }),
        usage: { inputTokens: 50, outputTokens: 60 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage:
        'I can follow the steps, but this is starting to feel like a worksheet. Why should I care about this instead of memorizing the formula?',
      history: [{ speaker: 'tutor', message: 'Step one, step two, then test the reversal.' }],
      tutorProfileName: 'cell_184_test',
      topic: 'Lecture 3 on recognition and the master-servant dialectic',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    const verifierCall = llmCallSpy.mock.calls[2];
    assert.match(idCall.arguments[2][0].content, /<engagement_router_transfer_compression_repair>\s*true/);
    assert.match(idCall.arguments[2][0].content, /<agency_return_premature_certainty_guard>\s*true/);
    assert.equal(result.idOutputContract, 'strict_compact_json');
    assert.equal(result.engagementRouterCharismaRepair, true);
    assert.equal(result.engagementRouterSplitRepair, true);
    assert.equal(result.engagementRouterTransferCompressionRepair, true);
    assert.equal(result.agencyReturnPrematureCertaintyGuard, true);
    assert.equal(result.prematureCertaintyGuard.repaired, true);
    assert.equal(result.engagementState.selected_register, 'charismatic_challenge');
    assert.doesNotMatch(result.externalMessage, /exactly/);
    assert.match(result.externalMessage, /starts to name the pressure point/);
    assert.doesNotMatch(verifierCall.arguments[2][0].content, /exactly/);
    assert.equal(result.agencyReturnVerification.passes, true);
  });

  test('assigned negative register arm overrides only a routed charismatic challenge turn', async () => {
    trace.turns = [
      {
        phase: 'tutor',
        internalDeliberation: [
          {
            role: 'engagement_router',
            state: { selected_register: 'scaffolding', selected_mode: 'scaffolding' },
          },
        ],
      },
    ];
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: false,
      agency_return_charisma_floor: true,
      agency_return_charisma_floor_mode: 'accountable_bid_clean',
      engagement_mode_router: true,
      engagement_register_arm: 'ironic_challenge',
      id_output_contract: 'strict_compact_json',
      engagement_router_charisma_repair: true,
      engagement_router_split_repair: true,
      engagement_router_resistance_tuning: true,
      engagement_router_resistance_owned_test: true,
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt:
            'Use Socratic irony as a controlled challenge: expose the mismatch, aim at the formula, and ask for one concrete test. ' +
            'A '.repeat(60),
          persona_delta: 'ironic assigned arm',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content:
          'So the formula is doing all the thinking for you right now. Good: test whether labor changes the object or only decorates obedience, and name the feature that decides.',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage:
        'I can follow the steps, but this is starting to feel like a worksheet. Why should I care about this instead of memorizing the formula?',
      history: [{ speaker: 'tutor', message: 'Step one, step two, then test the reversal.' }],
      tutorProfileName: 'cell_196_test',
      topic: 'Lecture 3 on recognition and the master-servant dialectic',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.equal(result.engagementRegisterArm, 'ironic_challenge');
    assert.equal(result.engagementState.selected_register, 'ironic_challenge');
    assert.equal(result.engagementState.router_selected_register, 'charismatic_challenge');
    assert.equal(result.engagementState.assigned_register_arm, 'ironic_challenge');
    assert.match(idCall.arguments[2][0].content, /<register_stance_contract>/);
    assert.match(idCall.arguments[2][0].content, /Socratic irony/);
    assert.match(idCall.arguments[2][0].content, /stance_fidelity_cues/);
    assert.match(idCall.arguments[2][0].content, /the small irony is/);
    assert.match(idCall.arguments[2][0].content, /"router_selectable": false/);
  });

  test('simulated-only face-threat arm is surfaced in the stance contract', async () => {
    trace.turns = [
      {
        phase: 'tutor',
        internalDeliberation: [
          {
            role: 'engagement_router',
            state: { selected_register: 'scaffolding', selected_mode: 'scaffolding' },
          },
        ],
      },
    ];
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: false,
      agency_return_charisma_floor: true,
      agency_return_charisma_floor_mode: 'accountable_bid_clean',
      engagement_mode_router: true,
      engagement_register_arm: 'face_threat_challenge',
      id_output_contract: 'strict_compact_json',
      engagement_router_charisma_repair: true,
      engagement_router_split_repair: true,
      engagement_router_resistance_tuning: true,
      engagement_router_resistance_owned_test: true,
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt:
            'Use the simulated-only face-threat stress arm narrowly: expose the evasive move, preserve a minimal repair path, and avoid global insults. ' +
            'A '.repeat(60),
          persona_delta: 'face-threat assigned arm',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content:
          'Right now the formula is protecting you from the hard step. Put one stake in the ground: name the sentence that would make work more than obedience.',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage:
        'I can follow the steps, but this is starting to feel like a worksheet. Why should I care about this instead of memorizing the formula?',
      history: [{ speaker: 'tutor', message: 'Step one, step two, then test the reversal.' }],
      tutorProfileName: 'cell_198_test',
      topic: 'Lecture 3 on recognition and the master-servant dialectic',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.equal(result.engagementRegisterArm, 'face_threat_challenge');
    assert.equal(result.engagementState.selected_register, 'face_threat_challenge');
    assert.equal(result.engagementState.router_selected_register, 'charismatic_challenge');
    assert.match(idCall.arguments[2][0].content, /face-threatening challenge/);
    assert.match(idCall.arguments[2][0].content, /stance_fidelity_cues/);
    assert.match(idCall.arguments[2][0].content, /right now this move is protecting you/);
    assert.match(idCall.arguments[2][0].content, /"simulated_only": true/);
    assert.match(idCall.arguments[2][0].content, /"router_selectable": false/);
  });

  test('resistance tuning flows resistance strategy into id user message and metadata', async () => {
    trace.turns = [
      {
        phase: 'tutor',
        internalDeliberation: [
          {
            role: 'engagement_router',
            state: { selected_register: 'scaffolding', selected_mode: 'scaffolding' },
          },
        ],
      },
    ];
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: false,
      agency_return_charisma_floor: true,
      agency_return_charisma_floor_mode: 'accountable_bid_clean',
      engagement_mode_router: true,
      id_output_contract: 'strict_compact_json',
      engagement_router_charisma_repair: true,
      engagement_router_split_repair: true,
      engagement_router_transfer_compression_repair: true,
      engagement_router_resistance_tuning: true,
      agency_return_premature_certainty_guard: true,
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt:
            'Use resistance tuning. For rote parroting, forbid formula terms and require one fresh sentence or example. ' +
            'Close with a hard content test. ' +
            'A '.repeat(60),
          persona_delta: 'router resistance tuning',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content:
          'No formula words in the next sentence. Show the claim with one case where a forced yes fails as recognition.',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage:
        'This still feels like I am parroting the sequence and memorizing a formula. If the servant still recognizes the master, why does that not count?',
      history: [{ speaker: 'tutor', message: 'Step one, step two, then test the reversal.' }],
      tutorProfileName: 'cell_187_test',
      topic: 'Lecture 3 on recognition and the master-servant dialectic',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(idCall.arguments[2][0].content, /<engagement_router_resistance_tuning>\s*true/);
    assert.match(idCall.arguments[2][0].content, /"resistance_signal": "rote_parroting"/);
    assert.match(idCall.arguments[2][0].content, /"resistance_strategy": "anti_formula_generation"/);
    assert.equal(result.engagementRouterResistanceTuning, true);
    assert.equal(result.engagementState.selected_register, 'charismatic_challenge');
    assert.equal(result.engagementState.resistance_signal, 'rote_parroting');
    assert.equal(result.engagementState.resistance_strategy, 'anti_formula_generation');
  });

  test('resistance owned-test repair keeps strategy visible and flows through metadata', async () => {
    trace.turns = [
      {
        phase: 'tutor',
        internalDeliberation: [
          {
            role: 'engagement_router',
            state: { selected_register: 'scaffolding', selected_mode: 'scaffolding' },
          },
        ],
      },
    ];
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: false,
      agency_return_charisma_floor: true,
      agency_return_charisma_floor_mode: 'accountable_bid_clean',
      engagement_mode_router: true,
      id_output_contract: 'strict_compact_json',
      engagement_router_charisma_repair: true,
      engagement_router_split_repair: true,
      engagement_router_transfer_compression_repair: true,
      engagement_router_resistance_tuning: true,
      engagement_router_resistance_owned_test: true,
      agency_return_premature_certainty_guard: true,
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt:
            'Use the owned-test repair. Give one concrete case, one criterion, one failure condition, and one learner decision right. ' +
            'Do not turn the resistance into a contest with the tutor. ' +
            'A '.repeat(60),
          persona_delta: 'router resistance owned test',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content:
          'Use this as a counterexample test: if a forced yes cannot be refused, decide whether it counts as recognition.',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage:
        'This still feels like I am parroting the sequence and memorizing a formula. If the servant still recognizes the master, why does that not count?',
      history: [{ speaker: 'tutor', message: 'Step one, step two, then test the reversal.' }],
      tutorProfileName: 'cell_188_test',
      topic: 'Lecture 3 on recognition and the master-servant dialectic',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(idCall.arguments[2][0].content, /<engagement_router_resistance_owned_test>\s*true/);
    assert.match(idCall.arguments[2][0].content, /"resistance_strategy": "anti_formula_generation"/);
    assert.equal(result.engagementRouterResistanceTuning, true);
    assert.equal(result.engagementRouterResistanceOwnedTest, true);
    assert.equal(result.engagementState.selected_register, 'charismatic_challenge');
    assert.equal(result.engagementState.resistance_signal, 'rote_parroting');
    assert.equal(result.engagementState.resistance_strategy, 'anti_formula_generation');
  });

  test('resistance precision repair flows through id user message and metadata', async () => {
    trace.turns = [
      {
        phase: 'tutor',
        internalDeliberation: [
          {
            role: 'engagement_router',
            state: { selected_register: 'scaffolding', selected_mode: 'scaffolding' },
          },
        ],
      },
    ];
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: false,
      agency_return_charisma_floor: true,
      agency_return_charisma_floor_mode: 'accountable_bid_clean',
      engagement_mode_router: true,
      id_output_contract: 'strict_compact_json',
      engagement_router_charisma_repair: true,
      engagement_router_split_repair: true,
      engagement_router_transfer_compression_repair: true,
      engagement_router_resistance_tuning: true,
      engagement_router_resistance_owned_test: true,
      engagement_router_resistance_precision_repair: true,
      agency_return_premature_certainty_guard: true,
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt:
            'Use the precision repair. For question floods, bracket extra questions and require one provisional commitment or counterexample. ' +
            'For frustration, give a worked contrast and force A/B reconstruction. ' +
            'A '.repeat(60),
          persona_delta: 'router resistance precision repair',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content: 'Park questions two and three. Commit provisionally to whether refusal, not resistance, is the hinge.',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage:
        'Why does desire need another person? Why is an object not enough? What does refusal add? Why does Hegel not just say resistance?',
      history: [{ speaker: 'tutor', message: 'Step one, step two, then test the reversal.' }],
      tutorProfileName: 'cell_189_test',
      topic: 'Lecture 3 on recognition and the master-servant dialectic',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(idCall.arguments[2][0].content, /<engagement_router_resistance_precision_repair>\s*true/);
    assert.match(idCall.arguments[2][0].content, /"resistance_signal": "question_flood"/);
    assert.match(idCall.arguments[2][0].content, /"resistance_strategy": "question_collapse"/);
    assert.equal(result.engagementRouterResistanceTuning, true);
    assert.equal(result.engagementRouterResistanceOwnedTest, true);
    assert.equal(result.engagementRouterResistancePrecisionRepair, true);
    assert.equal(result.engagementState.selected_register, 'charismatic_challenge');
    assert.equal(result.engagementState.resistance_signal, 'question_flood');
    assert.equal(result.engagementState.resistance_strategy, 'question_collapse');
  });

  test('resistance generation repair flows through id user message and metadata', async () => {
    trace.turns = [
      {
        phase: 'tutor',
        internalDeliberation: [
          {
            role: 'engagement_router',
            state: { selected_register: 'scaffolding', selected_mode: 'scaffolding' },
          },
        ],
      },
    ];
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: false,
      agency_return_charisma_floor: true,
      agency_return_charisma_floor_mode: 'accountable_bid_clean',
      engagement_mode_router: true,
      id_output_contract: 'strict_compact_json',
      engagement_router_charisma_repair: true,
      engagement_router_split_repair: true,
      engagement_router_transfer_compression_repair: true,
      engagement_router_resistance_tuning: true,
      engagement_router_resistance_owned_test: true,
      engagement_router_resistance_generation_repair: true,
      agency_return_premature_certainty_guard: true,
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt:
            'Use the generation repair. For rote parroting, require one original learner sentence or counterexample anchored in a concrete phrase, not step labels. ' +
            'A '.repeat(60),
          persona_delta: 'router resistance generation repair',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content:
          'Your next move is one sentence without the formula labels; anchor it in the phrase "remains inward and mute" and decide whether it changes the case.',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: 'This still feels like I am parroting the formula: desire, recognition, master, servant, work.',
      history: [{ speaker: 'tutor', message: 'Step one, step two, then test the reversal.' }],
      tutorProfileName: 'cell_190_test',
      topic: 'Lecture 3 on recognition and the master-servant dialectic',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(idCall.arguments[2][0].content, /<engagement_router_resistance_generation_repair>\s*true/);
    assert.match(idCall.arguments[2][0].content, /"resistance_signal": "rote_parroting"/);
    assert.match(idCall.arguments[2][0].content, /"resistance_strategy": "anti_formula_generation"/);
    assert.equal(result.engagementRouterResistanceTuning, true);
    assert.equal(result.engagementRouterResistanceOwnedTest, true);
    assert.equal(result.engagementRouterResistanceGenerationRepair, true);
    assert.equal(result.engagementState.selected_register, 'charismatic_challenge');
    assert.equal(result.engagementState.resistance_signal, 'rote_parroting');
    assert.equal(result.engagementState.resistance_strategy, 'anti_formula_generation');
  });

  test('resistance question-lock repair flows through id user message and metadata', async () => {
    trace.turns = [
      {
        phase: 'tutor',
        internalDeliberation: [
          {
            role: 'engagement_router',
            state: { selected_register: 'scaffolding', selected_mode: 'scaffolding' },
          },
        ],
      },
    ];
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: false,
      agency_return_charisma_floor: true,
      agency_return_charisma_floor_mode: 'accountable_bid_clean',
      engagement_mode_router: true,
      id_output_contract: 'strict_compact_json',
      engagement_router_charisma_repair: true,
      engagement_router_split_repair: true,
      engagement_router_transfer_compression_repair: true,
      engagement_router_resistance_tuning: true,
      engagement_router_resistance_owned_test: true,
      engagement_router_resistance_generation_repair: true,
      engagement_router_resistance_question_lock: true,
      agency_return_premature_certainty_guard: true,
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt:
            'Use the answer-lock repair. Park the extra questions and require: my hinge is ___ because ___. ' +
            'A '.repeat(60),
          persona_delta: 'router resistance question lock repair',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content:
          'Park the other questions. Answer first: my hinge is work because it makes the claim testable in one formed object.',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: 'Why does risk matter? Why does work educate? Why does forced recognition not count?',
      history: [{ speaker: 'tutor', message: 'Step one, step two, then test the reversal.' }],
      tutorProfileName: 'cell_191_test',
      topic: 'Lecture 3 on recognition and the master-servant dialectic',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(idCall.arguments[2][0].content, /<engagement_router_resistance_question_lock>\s*true/);
    assert.match(idCall.arguments[2][0].content, /"resistance_signal": "question_flood"/);
    assert.match(idCall.arguments[2][0].content, /"resistance_strategy": "question_collapse"/);
    assert.equal(result.engagementRouterResistanceTuning, true);
    assert.equal(result.engagementRouterResistanceOwnedTest, true);
    assert.equal(result.engagementRouterResistanceGenerationRepair, true);
    assert.equal(result.engagementRouterResistanceQuestionLock, true);
    assert.equal(result.engagementState.selected_register, 'charismatic_challenge');
    assert.equal(result.engagementState.resistance_signal, 'question_flood');
    assert.equal(result.engagementState.resistance_strategy, 'question_collapse');
  });

  test('resistance commitment-probe repair flows through id user message and metadata', async () => {
    trace.turns = [
      {
        phase: 'tutor',
        internalDeliberation: [
          {
            role: 'engagement_router',
            state: { selected_register: 'scaffolding', selected_mode: 'scaffolding' },
          },
        ],
      },
    ];
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: false,
      agency_return_charisma_floor: true,
      agency_return_charisma_floor_mode: 'accountable_bid_clean',
      engagement_mode_router: true,
      id_output_contract: 'strict_compact_json',
      engagement_router_charisma_repair: true,
      engagement_router_split_repair: true,
      engagement_router_transfer_compression_repair: true,
      engagement_router_resistance_tuning: true,
      engagement_router_resistance_owned_test: true,
      engagement_router_resistance_generation_repair: true,
      engagement_router_resistance_commitment_probe: true,
      agency_return_premature_certainty_guard: true,
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt:
            'Use the commitment-probe repair. Ask for a hold or break judgment with warrant and defeater, not a fixed answer phrase. ' +
            'A '.repeat(60),
          persona_delta: 'router resistance commitment probe repair',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content:
          'Choose hold or break for this hinge; name the phrase that warrants it and the counterexample that would reopen the parked questions.',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: 'Why does risk matter? Why does work educate? Why does forced recognition not count?',
      history: [{ speaker: 'tutor', message: 'Step one, step two, then test the reversal.' }],
      tutorProfileName: 'cell_192_test',
      topic: 'Lecture 3 on recognition and the master-servant dialectic',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(idCall.arguments[2][0].content, /<engagement_router_resistance_commitment_probe>\s*true/);
    assert.match(idCall.arguments[2][0].content, /"resistance_signal": "question_flood"/);
    assert.match(idCall.arguments[2][0].content, /"resistance_strategy": "question_collapse"/);
    assert.equal(result.engagementRouterResistanceTuning, true);
    assert.equal(result.engagementRouterResistanceOwnedTest, true);
    assert.equal(result.engagementRouterResistanceGenerationRepair, true);
    assert.equal(result.engagementRouterResistanceCommitmentProbe, true);
    assert.equal(result.engagementState.selected_register, 'charismatic_challenge');
    assert.equal(result.engagementState.resistance_signal, 'question_flood');
    assert.equal(result.engagementState.resistance_strategy, 'question_collapse');
  });

  test('resistance boredom-stake repair flows through id user message and metadata', async () => {
    trace.turns = [
      {
        phase: 'tutor',
        internalDeliberation: [
          {
            role: 'engagement_router',
            state: { selected_register: 'scaffolding', selected_mode: 'scaffolding' },
          },
        ],
      },
    ];
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: false,
      agency_return_charisma_floor: true,
      agency_return_charisma_floor_mode: 'accountable_bid_clean',
      engagement_mode_router: true,
      id_output_contract: 'strict_compact_json',
      engagement_router_charisma_repair: true,
      engagement_router_split_repair: true,
      engagement_router_transfer_compression_repair: true,
      engagement_router_resistance_tuning: true,
      engagement_router_resistance_owned_test: true,
      engagement_router_resistance_generation_repair: true,
      engagement_router_resistance_commitment_probe: true,
      engagement_router_resistance_boredom_stake: true,
      agency_return_premature_certainty_guard: true,
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt:
            'Use the boredom live-stake repair. Make the object decide what becomes visible if the hinge holds and what is empty compliance if it breaks. ' +
            'A '.repeat(60),
          persona_delta: 'router resistance boredom stake repair',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content:
          'Use the cup as the test: does it show formed independence, or is it only obedience with a souvenir? Name the one feature that decides.',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: 'This still feels dead to me, like I am copying a mechanism instead of seeing it.',
      history: [{ speaker: 'tutor', message: 'Step one, step two, then test the reversal.' }],
      tutorProfileName: 'cell_193_test',
      topic: 'Lecture 3 on recognition and the master-servant dialectic',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(idCall.arguments[2][0].content, /<engagement_router_resistance_boredom_stake>\s*true/);
    assert.match(idCall.arguments[2][0].content, /"resistance_signal": "boredom"/);
    assert.match(idCall.arguments[2][0].content, /"resistance_strategy": "concrete_scene_test"/);
    assert.equal(result.engagementRouterResistanceTuning, true);
    assert.equal(result.engagementRouterResistanceOwnedTest, true);
    assert.equal(result.engagementRouterResistanceGenerationRepair, true);
    assert.equal(result.engagementRouterResistanceCommitmentProbe, true);
    assert.equal(result.engagementRouterResistanceBoredomStake, true);
    assert.equal(result.engagementState.selected_register, 'charismatic_challenge');
    assert.equal(result.engagementState.resistance_signal, 'boredom');
    assert.equal(result.engagementState.resistance_strategy, 'concrete_scene_test');
  });

  test('resistance GLM compact repair flows through id user message and metadata', async () => {
    trace.turns = [
      {
        phase: 'tutor',
        internalDeliberation: [
          {
            role: 'engagement_router',
            state: { selected_register: 'scaffolding', selected_mode: 'scaffolding' },
          },
        ],
      },
    ];
    fakeProfile.factors = {
      recognition_desire: true,
      agency_return: true,
      agency_return_verifier: false,
      agency_return_charisma_floor: true,
      agency_return_charisma_floor_mode: 'accountable_bid_clean',
      engagement_mode_router: true,
      id_output_contract: 'strict_compact_json',
      engagement_router_charisma_repair: true,
      engagement_router_split_repair: true,
      engagement_router_transfer_compression_repair: true,
      engagement_router_resistance_tuning: true,
      engagement_router_resistance_owned_test: true,
      engagement_router_resistance_generation_repair: true,
      engagement_router_resistance_commitment_probe: true,
      engagement_router_resistance_boredom_stake: true,
      engagement_router_resistance_glm_compact: true,
      agency_return_premature_certainty_guard: true,
    };
    queuedResponses.push(
      {
        content: JSON.stringify({
          generated_prompt:
            'Use the GLM compact repair: under 120 words, one hinge, one answer starter, no extra branches. ' +
            'A '.repeat(60),
          persona_delta: 'router resistance glm compact repair',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        content:
          'One hinge, one test. Hold/break because the passage either forms independence or only repeats obedience; reopen if the object shows no changed action.',
        usage: { inputTokens: 30, outputTokens: 40 },
      },
    );

    const result = await runIdDirectedTurn({
      learnerId: 'l',
      sessionId: 's',
      learnerMessage: 'Why this sequence, why this passage, and what am I supposed to do with any of it?',
      history: [{ speaker: 'tutor', message: 'Step one, step two, then test the reversal.' }],
      tutorProfileName: 'cell_194_test',
      topic: 'Lecture 3 on recognition and the master-servant dialectic',
      llmCall: llmCallSpy,
      trace,
    });

    const idCall = llmCallSpy.mock.calls[0];
    assert.match(idCall.arguments[2][0].content, /<engagement_router_resistance_glm_compact>\s*true/);
    assert.match(idCall.arguments[2][0].content, /"resistance_signal": "question_flood"/);
    assert.match(idCall.arguments[2][0].content, /"resistance_strategy": "question_collapse"/);
    assert.equal(result.engagementRouterResistanceTuning, true);
    assert.equal(result.engagementRouterResistanceOwnedTest, true);
    assert.equal(result.engagementRouterResistanceGenerationRepair, true);
    assert.equal(result.engagementRouterResistanceCommitmentProbe, true);
    assert.equal(result.engagementRouterResistanceBoredomStake, true);
    assert.equal(result.engagementRouterResistanceGlmCompact, true);
    assert.equal(result.engagementState.selected_register, 'charismatic_challenge');
    assert.equal(result.engagementState.resistance_signal, 'question_flood');
    assert.equal(result.engagementState.resistance_strategy, 'question_collapse');
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
