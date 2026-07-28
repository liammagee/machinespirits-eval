import assert from 'node:assert/strict';
import test from 'node:test';

import { createTutorStubTutorTurnPipeline } from '../services/tutorStubTutorTurnPipeline.js';

function messageContext(history = []) {
  return {
    messages: history,
    historyMode: 'full_public_replay',
    availableMessageCount: history.length,
    replayedMessageCount: history.length,
    userMessageCount: history.filter((message) => message.role === 'user').length,
    assistantMessageCount: history.filter((message) => message.role === 'assistant').length,
    activatedBy: 'test',
  };
}

function pipelineDependencies(overrides = {}) {
  return {
    appendTraceEvent(trace, event) {
      if (Array.isArray(trace)) trace.push(event);
    },
    callAI: async () => ({
      content: 'Direct response',
      provider: 'openai',
      model: 'test-direct',
      latencyMs: 12,
      usage: { inputTokens: 4, outputTokens: 2, totalTokens: 6 },
    }),
    callAIWithCliBridge: async () => ({
      text: 'CLI response',
      provider: 'codex',
      model: 'test-cli',
      latencyMs: 14,
      inputTokens: 5,
      outputTokens: 3,
      effort: 'medium',
      tokenUsageAvailable: true,
    }),
    createConsoleTokenSink: () => ({
      write() {},
      finish: () => true,
    }),
    isCliProvider: () => false,
    providerSupportsStreaming: () => false,
    reconcileTutorStubPointOfActionHandoffEligibility: () => null,
    reserveProgram2ProviderBudget() {},
    reserveTutorStubMeteredModelCall() {},
    streamAI: async function* () {
      yield { type: 'done', content: 'Stream response', provider: 'openai', model: 'test-stream' };
    },
    tutorMessageContext(_state, history) {
      return messageContext(history);
    },
    ...overrides,
  };
}

function passthroughRequest(overrides = {}) {
  return {
    learnerText: 'What follows from that?',
    history: [{ role: 'assistant', content: 'Consider the first premise.' }],
    state: null,
    systemPrompt: 'Tutor system prompt',
    resolved: { provider: 'openai', model: 'test-direct' },
    temperature: 0.3,
    maxTokens: 400,
    historyTurns: 8,
    passthrough: true,
    ...overrides,
  };
}

test('direct passthrough preserves public replay, request metadata, and model-call tracing', async () => {
  const trace = [];
  let request = null;
  const callTutor = createTutorStubTutorTurnPipeline(
    pipelineDependencies({
      callAI: async (value) => {
        request = value;
        return {
          content: 'Direct response',
          provider: 'openai',
          model: 'test-direct',
          latencyMs: 12,
          usage: { inputTokens: 4, outputTokens: 2, totalTokens: 6 },
        };
      },
    }),
  );

  const response = await callTutor(passthroughRequest({ trace }));

  assert.equal(response.text, 'Direct response');
  assert.equal(response.passthrough, true);
  assert.equal(response.guardCallId, '1:1');
  assert.deepEqual(request.messages, [
    { role: 'assistant', content: 'Consider the first premise.' },
    { role: 'user', content: 'What follows from that?' },
  ]);
  assert.equal(response.promptSnapshot.config.passthrough, true);
  assert.equal(response.promptSnapshot.config.replayedMessageCount, 1);
  assert.equal(trace.at(-1).type, 'model_call');
  assert.equal(trace.at(-1).response.text, 'Direct response');
});

test('CLI passthrough preserves role history, effort, and token metadata', async () => {
  let bridgeArguments = null;
  const signal = new AbortController().signal;
  const callTutor = createTutorStubTutorTurnPipeline(
    pipelineDependencies({
      isCliProvider: () => true,
      callAIWithCliBridge: async (...args) => {
        bridgeArguments = args;
        return {
          text: 'CLI response',
          provider: 'codex',
          model: 'test-cli',
          latencyMs: 14,
          inputTokens: 5,
          outputTokens: 3,
          effort: 'medium',
          tokenUsageAvailable: true,
        };
      },
    }),
  );

  const response = await callTutor(
    passthroughRequest({
      resolved: { provider: 'codex', model: 'test-cli' },
      cliEffort: 'medium',
      signal,
    }),
  );

  assert.equal(response.text, 'CLI response');
  assert.equal(response.effort, 'medium');
  assert.equal(response.usage.totalTokens, 8);
  assert.deepEqual(bridgeArguments[4].messageHistory, [{ role: 'assistant', content: 'Consider the first premise.' }]);
  assert.equal(bridgeArguments[4].effort, 'medium');
  assert.equal(bridgeArguments[4].signal, signal);
});

test('streaming passthrough uses the injected token sink and returns final stream metadata', async () => {
  const written = [];
  let finishCalls = 0;
  const callTutor = createTutorStubTutorTurnPipeline(
    pipelineDependencies({
      providerSupportsStreaming: () => true,
      createConsoleTokenSink: () => ({
        write(token) {
          written.push(token);
        },
        finish() {
          finishCalls += 1;
          return true;
        },
      }),
      streamAI: async function* () {
        yield { type: 'text_delta', content: 'Stream ' };
        yield { type: 'text_delta', content: 'response' };
        yield {
          type: 'done',
          content: 'Stream response',
          provider: 'openai',
          model: 'test-stream',
          latencyMs: 18,
          usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
        };
      },
    }),
  );

  const response = await callTutor(
    passthroughRequest({
      stream: { enabled: true, interim: null },
      resolved: { provider: 'openai', model: 'test-stream' },
    }),
  );

  assert.deepEqual(written, ['Stream ', 'response']);
  assert.equal(finishCalls, 1);
  assert.equal(response.text, 'Stream response');
  assert.equal(response.streamed, true);
  assert.equal(response.generatedWithStreaming, true);
  assert.equal(response.bufferedStream, false);
});
