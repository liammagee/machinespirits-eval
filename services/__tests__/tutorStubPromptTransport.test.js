import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { tutorStubCliPolicyRetryDecision } from '../tutorStubCliPolicyRetry.js';
import { createTutorStubPromptTransport } from '../tutorStubPromptTransport.js';

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

function transportWith(callAIWithCliBridge, counters, trace) {
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
  });
}

describe('tutor-stub prompt transport', () => {
  it('uses the shared CLI request path for a strict schema and preserves bridge provenance', async () => {
    const counters = { calls: 0, provider: 0, metered: 0, delays: [] };
    const trace = [];
    const schema = { type: 'object', properties: {}, additionalProperties: false };
    let bridgeRequest = null;
    const transport = transportWith(async (...args) => {
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
    }, counters, trace);

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

  it('delays and freshly meters an individual failed Codex turn before redispatch', async () => {
    const counters = { calls: 0, provider: 0, metered: 0, delays: [] };
    const trace = [];
    const transport = transportWith(async () => {
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
    }, counters, trace);

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
    const transport = transportWith(async () => {
      counters.calls += 1;
      throw failedTurnError();
    }, counters, trace);

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
});
