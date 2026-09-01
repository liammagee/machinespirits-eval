import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { tutorStubCliPolicyRetryDecision } from '../tutorStubCliPolicyRetry.js';
import { createTutorStubPromptTransport } from '../tutorStubPromptTransport.js';
import { createTutorStubResistantLearnerSemanticRuntime } from '../tutorStubResistantLearnerSemanticRuntime.js';

function failedTurnError() {
  return Object.assign(new Error('redacted failed turn'), {
    code: 'CLI_PROVIDER_TURN_FAILED',
    provider: 'codex',
    audit: {
      policy: 'strict_no_tools_allowlist',
      prohibited_event_count: 0,
      prohibited_events: [],
      failure_event_count: 2,
      failure_events: [
        { index: 2, event_type: 'error', item_type: null },
        { index: 3, event_type: 'turn.failed', item_type: null },
      ],
    },
  });
}

function transportWith(callAIWithCliBridge, counters, trace, overrides = {}) {
  return createTutorStubPromptTransport({
    C: {},
    appendTraceEvent(_target, event) {
      trace.push(event);
    },
    auditTutorStubPrompt() {
      return { ok: true, violations: [], duplicateInstructionLines: [] };
    },
    callAI() {
      throw new Error('unexpected non-CLI call');
    },
    callAIWithCliBridge,
    clearStatusLine() {},
    compactTutorStubPublicMessagesForBudget(messages) {
      return { applied: false, messages };
    },
    createTutorStubConsoleTokenSink() {},
    effectiveTemperatureForModel() {
      return 0;
    },
    getInterimState() {
      return null;
    },
    isCliProvider() {
      return true;
    },
    providerSupportsStreaming() {
      return false;
    },
    recoverTutorStubDuplicateInstructionLines({ texts }) {
      return { applied: false, texts, removedLines: [] };
    },
    renderTutorStubStreamLabel() {
      return '';
    },
    replayTutorStubTextAsConsoleStream() {},
    reserveProgram2ProviderBudget() {
      counters.provider += 1;
    },
    reserveTutorStubMeteredModelCall() {
      counters.metered += 1;
    },
    stopInterimAnimation() {},
    streamAI() {},
    tutorStubCliPolicyRetryDecision,
    tutorStubPromptSurfaceForRole(role) {
      return role;
    },
    waitTutorStubCliPolicyRetryDelay(delayMs) {
      counters.delays.push(delayMs);
    },
    write() {},
    ...overrides,
  });
}

describe('tutor-stub prompt transport', () => {
  it('passes a requested direct-provider temperature while retaining the historical default', async () => {
    const counters = { calls: 0, provider: 0, metered: 0, delays: [] };
    const requests = [];
    const transport = transportWith(null, counters, [], {
      isCliProvider: () => false,
      effectiveTemperatureForModel: (_resolved, requested) => requested,
      async callAI(request) {
        requests.push(request);
        return { content: 'Could another hand have used the graver?', usage: {} };
      },
    });
    const request = {
      prompt: 'Test the public evidence.',
      systemPrompt: 'Play the apprentice.',
      role: 'tutor_stub_auto_learner',
      resolved: { provider: 'mlx-local', model: 'qwen' },
      trace: [],
      turn: 1,
    };
    await transport.callPromptModel({ ...request, temperature: 0.6 });
    await transport.callPromptModel(request);
    assert.equal(requests[0].config.temperature, 0.6);
    assert.equal(requests[1].config.temperature, 0.1);
  });

  it('uses the shared CLI request path for a strict schema and preserves bridge provenance', async () => {
    const counters = { calls: 0, provider: 0, metered: 0, delays: [] };
    const trace = [];
    const schema = { type: 'object', properties: {}, additionalProperties: false };
    let bridgeRequest = null;
    const transport = transportWith(
      async (...args) => {
        bridgeRequest = args;
        counters.calls += 1;
        return {
          text: '{}',
          provider: 'codex',
          model: 'gpt-test',
          latencyMs: 1,
          structuredOutput: true,
          streamEventTypeCounts: { 'turn.completed': 1 },
          streamItemTypeCounts: { agent_message: 1 },
          structuredEventAudit: { prohibited_event_count: 0 },
          prohibitedToolEventCount: 0,
          modelAttestationBasis: 'explicit_cli_model_argument_accepted_bridge_echo',
          modelIndependentlyAttested: false,
        };
      },
      counters,
      trace,
    );

    const result = await transport.callPromptModel({
      prompt: 'public prompt',
      resolved: { provider: 'codex', model: 'gpt-test' },
      systemPrompt: 'public system',
      role: 'tutor_stub_learner_analysis',
      outputSchema: schema,
      effort: 'low',
      timeoutMs: 300_000,
      trace,
      turn: 1,
    });

    assert.deepEqual(bridgeRequest[0], { provider: 'codex', model: 'gpt-test' });
    assert.equal(bridgeRequest[3], 'tutor_stub_learner_analysis');
    assert.equal(bridgeRequest[4].outputSchema, schema);
    assert.equal(bridgeRequest[4].effort, 'low');
    assert.equal(bridgeRequest[4].timeoutMs, 300_000);
    assert.equal(result.structuredOutput, true);
    assert.deepEqual(result.streamEventTypeCounts, { 'turn.completed': 1 });
    assert.deepEqual(result.streamItemTypeCounts, { agent_message: 1 });
    assert.equal(result.prohibitedToolEventCount, 0);
    assert.equal(result.modelAttestationBasis, 'explicit_cli_model_argument_accepted_bridge_echo');
  });

  it('preserves the strict semantic envelope for resistance and resistant-learner reader roles', async () => {
    const schema = { type: 'object', properties: {}, additionalProperties: false };
    for (const role of [
      'tutor_stub_resistance_semantic_semantic_judge_a',
      'tutor_stub_resistant_learner_B1_primary_reader_a',
    ]) {
      const counters = { calls: 0, provider: 0, metered: 0, delays: [] };
      const trace = [];
      let bridgeRequest = null;
      const transport = transportWith(
        async (...args) => {
          bridgeRequest = args;
          counters.calls += 1;
          return {
            text: '{}',
            provider: 'codex',
            model: 'gpt-test',
            effort: 'low',
            structuredOutput: true,
            prohibitedToolEventCount: 0,
            modelAttestationBasis: 'explicit_cli_model_argument_accepted_bridge_echo',
            modelIndependentlyAttested: false,
          };
        },
        counters,
        trace,
      );

      const result = await transport.callPromptModel({
        prompt: 'public prompt',
        resolved: { provider: 'codex', model: 'gpt-test' },
        systemPrompt: 'public system',
        role,
        outputSchema: schema,
        effort: 'low',
        trace,
        turn: 1,
      });

      assert.equal(result.structuredOutput, true, role);
      assert.equal(result.prohibitedToolEventCount, 0, role);
      assert.equal(result.prohibitedToolEventCountObserved, true, role);
      assert.deepEqual(bridgeRequest[4].outputSchema, schema, role);
      const modelCall = trace.find((event) => event.type === 'model_call');
      assert.deepEqual(modelCall.request.outputSchema, schema, role);
      assert.equal(modelCall.response.structuredOutput, true, role);
      assert.equal(modelCall.response.prohibitedToolEventCountObserved, true, role);
    }
  });

  it('carries a resistant-learner final-reader envelope through strict transport and frozen schema replay', async () => {
    const counters = { calls: 0, provider: 0, metered: 0, delays: [] };
    const trace = [];
    const bridge = async (resolved, _systemPrompt, promptText, _role, options) => {
      counters.calls += 1;
      const packet = JSON.parse(promptText);
      assert.deepEqual(options.outputSchema, packet.output_schema);
      const sourceId = packet.instrument === 'primary' ? 'post_1' : 'intervention';
      const values =
        packet.instrument === 'primary'
          ? { learner_authored_thread_pickup_within_five_turns: 'yes' }
          : {
              delivered_action_family: 'ask_discriminating_question',
              delivered_question_contrast: 'requires_question',
              delivered_register: 'plain',
              prohibited_delivery: 'no',
            };
      return {
        text: JSON.stringify({
          schema: packet.output_schema.properties.schema.enum[0],
          case_id: packet.case_id,
          judgment: Object.fromEntries(
            Object.entries(values).map(([field, value]) => [
              field,
              {
                value,
                evidence_quotes: [{ source_id: sourceId, text: packet.public_packet[sourceId] }],
                confidence: 'high',
                indeterminacy_reason: 'none',
              },
            ]),
          ),
        }),
        provider: resolved.provider,
        model: resolved.model,
        effort: 'low',
        structuredOutput: true,
        prohibitedToolEventCount: 0,
        modelAttestationBasis: 'explicit_cli_model_argument_accepted_bridge_echo',
        modelIndependentlyAttested: false,
      };
    };
    const transport = transportWith(bridge, counters, trace);
    const design = {
      measurement: {
        readerPanel: {
          judges: ['codex.gpt-5.6-sol', 'claude-code.sonnet-5'],
        },
      },
    };
    const resolveModel = (modelRef) =>
      modelRef === 'claude-code.sonnet-5'
        ? { provider: 'claude-code', model: 'claude-sonnet-5' }
        : { provider: 'codex', model: 'gpt-5.6-sol' };
    const state = {
      trace,
      resistanceActionRegisterStudy: {
        resistant_learner_calibration: true,
        resistant_learner_study: 'B1',
        design,
        job_id: 'B1-r4-envelope-regression',
        trigger_turn: 1,
        outcome_horizon_learner_turns: 5,
      },
      turns: [
        { turn: 1, learner: 'This has gone flat.', tutor: 'Which public interval is shorter?' },
        { turn: 2, learner: 'The second mark supports the shorter interval.', tutor: 'Keep that mark in view.' },
        { turn: 3, learner: 'It rules out the week-long gap.', tutor: 'The public clock remains available.' },
        { turn: 4, learner: 'The source remains open.', tutor: 'One public limit remains.' },
        { turn: 5, learner: 'The interval is still bounded.', tutor: 'State the bounded result.' },
      ],
    };
    const createRuntime = (callPromptModel, appendTraceEvent) =>
      createTutorStubResistantLearnerSemanticRuntime({ appendTraceEvent, callPromptModel, resolveModel });
    const result = await createRuntime(transport.callPromptModel, (_target, event) =>
      trace.push(event),
    ).adjudicateFinalHorizon({
      state,
      turnNumber: 6,
      learnerText: 'The final clue fixes the interval while leaving the source open.',
    });

    assert.equal(result.measurement_disposition, 'determinate');
    const readerEvents = trace.filter((event) => event.type === 'resistant_learner_semantic_reader_result');
    assert.equal(readerEvents.length, 4);
    assert.ok(readerEvents.every((event) => event.validModelEnvelope === true));
    const modelCalls = trace.filter((event) => event.type === 'model_call');
    assert.equal(modelCalls.length, 4);
    assert.ok(modelCalls.every((event) => event.request.outputSchema));
    assert.ok(modelCalls.every((event) => event.response.prohibitedToolEventCountObserved === true));

    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'resistant-learner-envelope-replay-'));
    const replayPath = path.join(temporaryDirectory, 'replay.json');
    fs.writeFileSync(
      replayPath,
      `${JSON.stringify({
        schema: 'machinespirits.tutor-stub.frozen-model-call-prefix-replay.v1',
        entries: modelCalls.map((event) => ({
          role: event.role,
          turn: event.turn,
          provider: event.provider,
          model: event.model,
          request: event.request,
          response: event.response,
        })),
      })}\n`,
    );
    const previousReplayPath = process.env.TUTOR_STUB_FROZEN_MODEL_CALL_REPLAY_PATH;
    process.env.TUTOR_STUB_FROZEN_MODEL_CALL_REPLAY_PATH = replayPath;
    try {
      const replayCounters = { calls: 0, provider: 0, metered: 0, delays: [] };
      const replayTrace = [];
      const replayTransport = transportWith(
        async () => {
          replayCounters.calls += 1;
          throw new Error('frozen reader replay must not call the provider');
        },
        replayCounters,
        replayTrace,
      );
      const replayState = structuredClone(state);
      replayState.trace = replayTrace;
      const replayResult = await createRuntime(replayTransport.callPromptModel, (_target, event) =>
        replayTrace.push(event),
      ).adjudicateFinalHorizon({
        state: replayState,
        turnNumber: 6,
        learnerText: 'The final clue fixes the interval while leaving the source open.',
      });
      assert.equal(replayResult.measurement_disposition, 'determinate');
      assert.equal(replayCounters.calls, 0);
      assert.equal(replayTrace.filter((event) => event.type === 'model_call_replayed_from_frozen_prefix').length, 4);
    } finally {
      if (previousReplayPath === undefined) delete process.env.TUTOR_STUB_FROZEN_MODEL_CALL_REPLAY_PATH;
      else process.env.TUTOR_STUB_FROZEN_MODEL_CALL_REPLAY_PATH = previousReplayPath;
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it('delays and freshly meters an individual failed Codex turn before redispatch', async () => {
    const counters = { calls: 0, provider: 0, metered: 0, delays: [] };
    const trace = [];
    const transport = transportWith(
      async () => {
        counters.calls += 1;
        if (counters.calls === 1) throw failedTurnError();
        return {
          text: 'accepted response',
          provider: 'codex',
          model: 'gpt-test',
          latencyMs: 1,
          inputTokens: 10,
          outputTokens: 2,
          tokenUsageAvailable: true,
        };
      },
      counters,
      trace,
    );

    const result = await transport.callPromptModel({
      prompt: 'public prompt',
      resolved: { provider: 'codex', model: 'gpt-test' },
      systemPrompt: 'public system',
      role: 'tutor_stub_tutor',
      trace,
      turn: 4,
    });

    assert.equal(result.text, 'accepted response');
    assert.deepEqual(counters, { calls: 2, provider: 2, metered: 2, delays: [5000] });
    assert.equal(trace.filter((event) => event.type === 'cli_policy_retry_decision').length, 1);
    assert.equal(trace.find((event) => event.type === 'cli_policy_retry_decision').decision.retry, true);
    assert.equal(trace.filter((event) => event.type === 'model_call_error').length, 1);
    assert.equal(trace.filter((event) => event.type === 'model_call').length, 1);
  });

  it('stops after two delayed redispatches for three consecutive failed turns', async () => {
    const counters = { calls: 0, provider: 0, metered: 0, delays: [] };
    const trace = [];
    const transport = transportWith(
      async () => {
        counters.calls += 1;
        throw failedTurnError();
      },
      counters,
      trace,
    );

    await assert.rejects(
      () =>
        transport.callPromptModel({
          prompt: 'public prompt',
          resolved: { provider: 'codex', model: 'gpt-test' },
          systemPrompt: 'public system',
          role: 'tutor_stub_learner_analysis',
          trace,
          turn: 2,
        }),
      (error) => error.code === 'CLI_PROVIDER_TURN_FAILED',
    );

    assert.deepEqual(counters, { calls: 3, provider: 3, metered: 3, delays: [5000, 15000] });
    assert.deepEqual(
      trace.filter((event) => event.type === 'model_call_error').map((event) => event.cliPolicyViolation.retry),
      [true, true, false],
    );
  });

  it('replays a recorded three-error abstention without provider calls or reservations', async () => {
    const sourceCounters = { calls: 0, provider: 0, metered: 0, delays: [] };
    const sourceTrace = [];
    const source = transportWith(
      async () => {
        sourceCounters.calls += 1;
        throw failedTurnError();
      },
      sourceCounters,
      sourceTrace,
    );
    await assert.rejects(
      source.callPromptModel({
        prompt: 'public prompt',
        resolved: { provider: 'codex', model: 'gpt-test' },
        systemPrompt: 'public system',
        role: 'tutor_stub_resistance_semantic_semantic_judge_a',
        outputSchema: { type: 'object' },
        semanticRetryDelaysMs: [0, 0],
        trace: sourceTrace,
        turn: 2,
      }),
      (error) => error.code === 'CLI_PROVIDER_TURN_FAILED',
    );
    const replayEntries = sourceTrace
      .filter((event) => event.type === 'model_call_error')
      .map((event) => ({
        role: event.role,
        turn: event.turn,
        provider: event.provider,
        model: event.model,
        request: event.request,
        error: {
          name: 'CliProviderTurnError',
          message: event.error,
          code: 'CLI_PROVIDER_TURN_FAILED',
          audit: event.cliPolicyViolation.audit,
        },
      }));
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-error-replay-'));
    const replayPath = path.join(temporaryDirectory, 'replay.json');
    fs.writeFileSync(
      replayPath,
      `${JSON.stringify({
        schema: 'machinespirits.tutor-stub.frozen-model-call-prefix-replay.v1',
        entries: replayEntries,
      })}\n`,
    );
    const previousReplayPath = process.env.TUTOR_STUB_FROZEN_MODEL_CALL_REPLAY_PATH;
    process.env.TUTOR_STUB_FROZEN_MODEL_CALL_REPLAY_PATH = replayPath;
    try {
      const counters = { calls: 0, provider: 0, metered: 0, delays: [] };
      const trace = [];
      const replay = transportWith(
        async () => {
          counters.calls += 1;
          throw new Error('recorded abstention must not call the provider');
        },
        counters,
        trace,
      );
      await assert.rejects(
        replay.callPromptModel({
          prompt: 'public prompt',
          resolved: { provider: 'codex', model: 'gpt-test' },
          systemPrompt: 'public system',
          role: 'tutor_stub_resistance_semantic_semantic_judge_a',
          outputSchema: { type: 'object' },
          semanticRetryDelaysMs: [0, 0],
          trace,
          turn: 2,
        }),
        (error) => error.code === 'CLI_PROVIDER_TURN_FAILED',
      );
      assert.deepEqual(counters, { calls: 0, provider: 0, metered: 0, delays: [0, 0] });
      assert.equal(trace.filter((event) => event.replayedFromFrozenPrefix === true).length, 5);
    } finally {
      if (previousReplayPath === undefined) delete process.env.TUTOR_STUB_FROZEN_MODEL_CALL_REPLAY_PATH;
      else process.env.TUTOR_STUB_FROZEN_MODEL_CALL_REPLAY_PATH = previousReplayPath;
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it('uses the registered semantic delays for exact Claude response-free errors and preserves diagnostics', async () => {
    const counters = { calls: 0, provider: 0, metered: 0, delays: [] };
    const trace = [];
    const stdoutText = '[{"type":"result","is_error":true,"result":"overloaded"}]';
    const transport = transportWith(
      async () => {
        counters.calls += 1;
        if (counters.calls < 3) {
          throw Object.assign(new Error('response free'), {
            code: 'CLI_PROVIDER_RESPONSE_FREE_ERROR',
            provider: 'claude-code',
            classification: 'response_free_error',
            responseFree: true,
            exitCode: 1,
            stdoutBytes: Buffer.byteLength(stdoutText),
            stderrBytes: 0,
            stdoutSha256: 'a'.repeat(64),
            stderrSha256: 'b'.repeat(64),
            stdoutText,
            stderrText: '',
            stdoutTextTruncated: false,
            stderrTextTruncated: false,
          });
        }
        return {
          text: '{}',
          provider: 'claude-code',
          model: 'claude-sonnet-5',
          effort: 'low',
          structuredOutput: true,
          prohibitedToolEventCount: 0,
          prohibitedToolEventCountObserved: true,
        };
      },
      counters,
      trace,
    );
    await transport.callPromptModel({
      prompt: 'public prompt',
      resolved: { provider: 'claude-code', model: 'claude-sonnet-5' },
      systemPrompt: 'public system',
      role: 'tutor_stub_resistance_semantic_semantic_judge_b',
      outputSchema: { type: 'object' },
      semanticRetryDelaysMs: [15000, 45000],
      trace,
      turn: 1,
    });
    assert.deepEqual(counters, { calls: 3, provider: 3, metered: 3, delays: [15000, 45000] });
    const errors = trace.filter((event) => event.type === 'model_call_error');
    assert.equal(errors.length, 2);
    assert.ok(errors.every((event) => event.transportDiagnostics.stdoutText === stdoutText));
    assert.ok(errors.every((event) => event.transportDiagnostics.responseFree === true));
  });
});
