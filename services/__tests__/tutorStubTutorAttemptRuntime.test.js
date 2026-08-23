import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { tutorStubCliPolicyRetryDecision } from '../tutorStubCliPolicyRetry.js';
import { createTutorStubTutorAttemptRuntime } from '../tutorStubTutorAttemptRuntime.js';

function turnFailure() {
  return Object.assign(new Error('codex CLI turn failed before producing an accepted response'), {
    code: 'CLI_PROVIDER_TURN_FAILED',
    provider: 'codex',
    audit: {
      policy: 'no_tools',
      prohibited_event_count: 0,
      prohibited_events: [],
      failure_event_count: 1,
      failure_events: [{ index: 2, event_type: 'turn.failed', item_type: null }],
    },
  });
}

function bindRuntime({ callAIWithCliBridge, trace, reservations }) {
  const bind = createTutorStubTutorAttemptRuntime({
    appendTraceEvent(target, event) {
      target.push(event);
    },
    auditTutorStubPrompt() {
      throw new Error('passthrough should not invoke the prompt audit');
    },
    auditTutorStubSpeakerPrivilege() {
      throw new Error('passthrough should not invoke the speaker audit');
    },
    callAI: async () => {
      throw new Error('CLI test should not use callAI');
    },
    callAIWithCliBridge,
    createConsoleTokenSink: () => null,
    isCliProvider: () => true,
    jsonClone: structuredClone,
    recoverTutorStubDuplicateInstructionLines: () => ({ applied: false, texts: [], removedLines: [] }),
    reserveProgram2ProviderBudget() {
      reservations.provider += 1;
    },
    reserveTutorStubMeteredModelCall() {
      reservations.metered += 1;
    },
    streamAI: async function* () {},
    tutorStubCliPolicyRetryDecision,
    waitTutorStubCliPolicyRetryDelay(delayMs) {
      reservations.delays.push(delayMs);
    },
  });
  return bind({
    actorialRealizationGuardEnabled: false,
    cliEffort: 'medium',
    closureGuardEnabled: false,
    effectiveSpeakerInstructionTexts: [],
    effectiveSpeakerSystemPrompt: 'Tutor system prompt',
    firstDraftContract: null,
    historyTurns: 4,
    leakGuardEnabled: true,
    maxTokens: 700,
    messageContext: {
      historyMode: 'full_public_replay',
      availableMessageCount: 1,
      replayedMessageCount: 1,
      userMessageCount: 0,
      assistantMessageCount: 1,
      activatedBy: 'test',
    },
    messages: [{ role: 'assistant', content: 'Check the public ledger.' }],
    passthrough: true,
    questionSupportGuardEnabled: true,
    repetitionGuardEnabled: true,
    resolved: { provider: 'codex', model: 'gpt-5.6-luna' },
    responseCompositionGuardEnabled: true,
    scaffoldGuardEnabled: true,
    signal: null,
    speakerPrivilegeAudit: null,
    stream: null,
    systemPrompt: 'Tutor system prompt',
    temperature: 0.1,
    trace,
    tutorTurn: 7,
  });
}

test('a failed Codex tutor-recovery turn gets one fresh metered retry', async () => {
  const trace = [];
  const reservations = { provider: 0, metered: 0, delays: [] };
  let calls = 0;
  const { invokeTutorAttempt } = bindRuntime({
    trace,
    reservations,
    async callAIWithCliBridge() {
      calls += 1;
      if (calls === 1) throw turnFailure();
      return {
        text: 'The exact public record is now preserved.',
        provider: 'codex',
        model: 'gpt-5.6-luna',
        latencyMs: 12,
        inputTokens: 40,
        outputTokens: 9,
        tokenUsageAvailable: true,
      };
    },
  });

  const response = await invokeTutorAttempt({
    attemptUserPrompt: 'Repair the rejected public tutor draft.',
    role: 'tutor_stub_tutor_recovery',
    repairAttempt: 1,
  });

  assert.equal(response.text, 'The exact public record is now preserved.');
  assert.equal(calls, 2);
  assert.deepEqual(reservations, { provider: 2, metered: 2, delays: [5000] });
  assert.equal(trace.filter((event) => event.type === 'model_call_error').length, 1);
  assert.equal(trace.filter((event) => event.type === 'cli_policy_retry_decision').length, 1);
  assert.equal(trace.filter((event) => event.type === 'model_call').length, 1);
  assert.ok(trace.every((event) => event.role === 'tutor_stub_tutor_recovery'));
  assert.equal(trace.find((event) => event.type === 'cli_policy_retry_decision').publicTranscriptChanged, false);
});

test('a tutor-recovery retry is bounded to two delayed redispatches', async () => {
  const trace = [];
  const reservations = { provider: 0, metered: 0, delays: [] };
  let calls = 0;
  const { invokeTutorAttempt } = bindRuntime({
    trace,
    reservations,
    async callAIWithCliBridge() {
      calls += 1;
      throw turnFailure();
    },
  });

  await assert.rejects(
    invokeTutorAttempt({
      attemptUserPrompt: 'Repair the rejected public tutor draft.',
      role: 'tutor_stub_tutor_recovery',
      repairAttempt: 1,
    }),
    /turn failed/u,
  );

  assert.equal(calls, 3);
  assert.deepEqual(reservations, { provider: 3, metered: 3, delays: [5000, 15000] });
  assert.equal(trace.filter((event) => event.type === 'model_call_error').length, 3);
  assert.equal(trace.filter((event) => event.type === 'cli_policy_retry_decision').length, 2);
  assert.equal(trace.at(-1).cliPolicyViolation.reason, 'call_retry_limit_reached');
});

test('a frozen tutor attempt replays without a provider call or reservation', async (t) => {
  const sourceTrace = [];
  const sourceReservations = { provider: 0, metered: 0, delays: [] };
  const source = bindRuntime({
    trace: sourceTrace,
    reservations: sourceReservations,
    async callAIWithCliBridge() {
      return {
        text: 'The preserved tutor response.',
        provider: 'codex',
        model: 'gpt-5.6-luna',
        latencyMs: 12,
        inputTokens: 40,
        outputTokens: 9,
        tokenUsageAvailable: true,
      };
    },
  });
  await source.invokeTutorAttempt({
    attemptUserPrompt: 'Continue from the preserved prefix.',
    role: 'tutor_stub_tutor',
  });
  const sourceCall = sourceTrace.find((event) => event.type === 'model_call');
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-tutor-replay-'));
  const replayPath = path.join(temporaryDirectory, 'replay.json');
  fs.writeFileSync(
    replayPath,
    `${JSON.stringify({
      schema: 'machinespirits.tutor-stub.frozen-model-call-prefix-replay.v1',
      entries: [sourceCall],
    })}\n`,
  );
  const previousReplayPath = process.env.TUTOR_STUB_FROZEN_MODEL_CALL_REPLAY_PATH;
  process.env.TUTOR_STUB_FROZEN_MODEL_CALL_REPLAY_PATH = replayPath;
  t.after(() => {
    if (previousReplayPath === undefined) delete process.env.TUTOR_STUB_FROZEN_MODEL_CALL_REPLAY_PATH;
    else process.env.TUTOR_STUB_FROZEN_MODEL_CALL_REPLAY_PATH = previousReplayPath;
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  const replayTrace = [];
  const replayReservations = { provider: 0, metered: 0, delays: [] };
  const replay = bindRuntime({
    trace: replayTrace,
    reservations: replayReservations,
    async callAIWithCliBridge() {
      throw new Error('frozen tutor attempt must not call the provider');
    },
  });
  const response = await replay.invokeTutorAttempt({
    attemptUserPrompt: 'Continue from the preserved prefix.',
    role: 'tutor_stub_tutor',
  });

  assert.equal(response.text, 'The preserved tutor response.');
  assert.deepEqual(replayReservations, { provider: 0, metered: 0, delays: [] });
  assert.equal(replayTrace.filter((event) => event.type === 'model_call_replayed_from_frozen_prefix').length, 1);
});
