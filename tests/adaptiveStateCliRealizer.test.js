import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ADAPTIVE_STATE_CLI_REALIZER_CALL_SCHEMA,
  ADAPTIVE_STATE_CLI_REALIZER_OUTPUT_JSON_SCHEMA,
  buildAdaptiveStateCliRealizerInput,
  callAdaptiveStateCliRealizer,
  parseAdaptiveStateCliRealizerOutput,
  validateAdaptiveStateCliRealizerInput,
} from '../services/adaptiveTutor/stateBenchmarkCliRealizer.js';

function publicInput() {
  return buildAdaptiveStateCliRealizerInput({
    currentPublicActEnvelope: {
      event_family: 'adopt',
      event_ids: ['adopt:evidence_01'],
      events: [
        {
          event_id: 'adopt:evidence_01',
          kind: 'adopt',
          evidence_surface: 'A public clue was released.',
        },
      ],
      state_cues: { confidence: 'tentative' },
    },
    priorPublicTranscript: [{ turn: 1, role: 'learner', text: 'I am considering the public evidence.' }],
    currentAction: { action_type: 'minimal_hint' },
    publicWorldVocabulary: { question: 'What follows?', released_evidence_surfaces: ['A public clue was released.'] },
  });
}

test('CLI realizer input is an exact public-only envelope', () => {
  const input = publicInput();
  assert.equal(validateAdaptiveStateCliRealizerInput(input), true);
  assert.throws(
    () => validateAdaptiveStateCliRealizerInput({ ...input, futureTarget: 'derive' }),
    /input must contain exactly/u,
  );
  assert.throws(
    () =>
      validateAdaptiveStateCliRealizerInput({
        ...input,
        currentPublicActEnvelope: { ...input.currentPublicActEnvelope, oracle_distribution: { derive: 1 } },
      }),
    /forbidden input/u,
  );
  assert.throws(
    () => validateAdaptiveStateCliRealizerInput(input, { forbiddenValues: ['A public clue was released.'] }),
    /forbidden private value/u,
  );
});

test('CLI realizer output parser is strict and preserves exact harness-owned event ids', () => {
  const expectedEventIds = ['adopt:evidence_01'];
  const parsed = parseAdaptiveStateCliRealizerOutput(
    '{"learner_text":" I can use that clue. ","realized_public_event_ids":["adopt:evidence_01"]}',
    { expectedEventIds },
  );
  assert.deepEqual(parsed, {
    learner_text: 'I can use that clue.',
    realized_public_event_ids: expectedEventIds,
  });
  assert.throws(
    () =>
      parseAdaptiveStateCliRealizerOutput(
        '```json\n{"learner_text":"x","realized_public_event_ids":["adopt:evidence_01"]}\n```',
        { expectedEventIds },
      ),
    /not strict JSON/u,
  );
  assert.throws(
    () =>
      parseAdaptiveStateCliRealizerOutput(
        '{"learner_text":"x","realized_public_event_ids":["derive:inference_01"]}',
        { expectedEventIds },
      ),
    /differ from the harness-owned/u,
  );
  assert.throws(
    () =>
      parseAdaptiveStateCliRealizerOutput(
        '{"learner_text":"x","realized_public_event_ids":["adopt:evidence_01"],"explanation":"extra"}',
        { expectedEventIds },
      ),
    /must contain exactly/u,
  );
});

test('CLI realizer makes one schema-constrained call and records honest provenance', async () => {
  const calls = [];
  const ticks = [1000, 1100, 1200];
  const result = await callAdaptiveStateCliRealizer({
    modelRef: 'codex.gpt-5.6-terra',
    input: publicInput(),
    expectedEventIds: ['adopt:evidence_01'],
    effort: 'low',
    timeoutMs: 12_000,
    context: { callId: 'call-1', jobId: 'job-1', turn: 2 },
    resolveModelRef: () => ({
      provider: 'codex',
      model: 'gpt-5.6-terra',
      isConfigured: true,
    }),
    callCli: async (...args) => {
      calls.push(args);
      return {
        text: '{"learner_text":"I can use that clue.","realized_public_event_ids":["adopt:evidence_01"]}',
        provider: 'codex',
        model: 'gpt-5.6-terra',
        latencyMs: 177,
        structuredOutput: true,
        modelAttestationBasis: 'explicit_cli_model_argument_accepted_bridge_echo',
        modelIndependentlyAttested: false,
      };
    },
    clock: () => ticks.shift(),
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0][0], { provider: 'codex', model: 'gpt-5.6-terra' });
  assert.equal(calls[0][3], 'adaptive_state_learner_realizer');
  assert.equal(calls[0][4].effort, 'low');
  assert.equal(calls[0][4].timeoutMs, 12_000);
  assert.deepEqual(calls[0][4].outputSchema, ADAPTIVE_STATE_CLI_REALIZER_OUTPUT_JSON_SCHEMA);
  assert.equal(result.schema, ADAPTIVE_STATE_CLI_REALIZER_CALL_SCHEMA);
  assert.equal(
    result.raw_output,
    '{"learner_text":"I can use that clue.","realized_public_event_ids":["adopt:evidence_01"]}',
  );
  assert.equal(result.call_metadata.status, 'success');
  assert.equal(result.call_metadata.requested_model_ref, 'codex.gpt-5.6-terra');
  assert.equal(result.call_metadata.resolved_model_ref, 'codex/gpt-5.6-terra');
  assert.equal(result.call_metadata.observed_model_ref, 'codex/gpt-5.6-terra');
  assert.deepEqual(result.call_metadata.model_attestation, {
    basis: 'explicit_cli_model_argument_accepted_bridge_echo',
    independently_attested: false,
  });
  assert.equal(result.call_metadata.attempts, 1);
  assert.equal(result.call_metadata.dispatch_count, 1);
  assert.equal(result.call_metadata.dispatched_at_ms, 1100);
  assert.equal(result.call_metadata.semantic_rerolls, 0);
  assert.match(result.call_metadata.input_sha256, /^[0-9a-f]{64}$/u);
  assert.match(result.call_metadata.system_prompt_sha256, /^[0-9a-f]{64}$/u);
  assert.match(result.call_metadata.user_prompt_sha256, /^[0-9a-f]{64}$/u);
  assert.match(result.call_metadata.raw_output_sha256, /^[0-9a-f]{64}$/u);
  assert.match(result.call_metadata.output_sha256, /^[0-9a-f]{64}$/u);
  assert.equal(result.call_artifacts.system_prompt, calls[0][1]);
  assert.equal(result.call_artifacts.user_prompt, calls[0][2]);
});

test('CLI realizer fails once with attached call metadata and never retries or repairs', async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      callAdaptiveStateCliRealizer({
        modelRef: 'claude-code.sonnet',
        input: publicInput(),
        expectedEventIds: ['adopt:evidence_01'],
        effort: 'low',
        timeoutMs: 12_000,
        resolveModelRef: () => ({
          provider: 'claude-code',
          model: 'claude-sonnet-4-6',
          isConfigured: true,
        }),
        callCli: async () => {
          calls += 1;
          return {
            text: '```json\n{}\n```',
            provider: 'claude-code',
            model: 'claude-sonnet-4-6',
            structuredOutput: true,
          };
        },
        clock: () => 1000,
      }),
    (error) => {
      assert.match(error.message, /not strict JSON/u);
      assert.equal(error.callMetadata.status, 'technical_failure');
      assert.equal(error.callMetadata.attempts, 1);
      assert.equal(error.callMetadata.dispatch_count, 1);
      assert.equal(error.callMetadata.semantic_rerolls, 0);
      assert.equal(error.raw_output, '```json\n{}\n```');
      assert.match(error.callMetadata.raw_output_sha256, /^[0-9a-f]{64}$/u);
      return true;
    },
  );
  assert.equal(calls, 1);
});

test('CLI realizer rejects any structured Codex tool or command event', async () => {
  await assert.rejects(
    () =>
      callAdaptiveStateCliRealizer({
        modelRef: 'codex.gpt-5.6-terra',
        input: publicInput(),
        expectedEventIds: ['adopt:evidence_01'],
        effort: 'low',
        timeoutMs: 12_000,
        resolveModelRef: () => ({ provider: 'codex', model: 'gpt-5.6-terra', isConfigured: true }),
        callCli: async () => ({
          text: '{"learner_text":"I can use that clue.","realized_public_event_ids":["adopt:evidence_01"]}',
          provider: 'codex',
          model: 'gpt-5.6-terra',
          structuredOutput: true,
          modelAttestationBasis: 'explicit_cli_model_argument_accepted_bridge_echo',
          modelIndependentlyAttested: false,
          streamEventTypeCounts: { 'item.started': 1 },
          streamItemTypeCounts: { command_execution: 1 },
          structuredEventAudit: {
            event_type_counts: { 'item.started': 1 },
            item_type_counts: { command_execution: 1 },
            prohibited_event_count: 1,
            prohibited_events: [{ index: 0, event_type: 'item.started', item_type: 'command_execution' }],
          },
          prohibitedToolEventCount: 1,
        }),
        clock: () => 1000,
      }),
    (error) => {
      assert.match(error.message, /prohibited CLI stream activity|prohibited tool event/u);
      assert.equal(error.callMetadata.dispatch_count, 1);
      assert.equal(error.callMetadata.prohibited_tool_event_count, 1);
      return true;
    },
  );
});

test('CLI realizer requires explicit non-config effort and timeout before dispatch', async () => {
  let calls = 0;
  const base = {
    modelRef: 'codex.gpt-5.6-terra',
    input: publicInput(),
    expectedEventIds: ['adopt:evidence_01'],
    resolveModelRef: () => ({ provider: 'codex', model: 'gpt-5.6-terra', isConfigured: true }),
    callCli: async () => {
      calls += 1;
      throw new Error('must not dispatch');
    },
    clock: () => 1000,
  };
  await assert.rejects(
    () => callAdaptiveStateCliRealizer({ ...base, effort: 'config', timeoutMs: 1000 }),
    (error) => {
      assert.match(error.message, /effort/u);
      assert.equal(error.callMetadata.attempts, 0);
      assert.equal(error.callMetadata.dispatch_count, 0);
      return true;
    },
  );
  await assert.rejects(
    () => callAdaptiveStateCliRealizer({ ...base, effort: 'low', timeoutMs: 0 }),
    (error) => {
      assert.match(error.message, /timeoutMs/u);
      assert.equal(error.callMetadata.attempts, 0);
      assert.equal(error.callMetadata.dispatch_count, 0);
      return true;
    },
  );
  assert.equal(calls, 0);
});

test('CLI realizer aborts before dispatch with reconstructible prompts and dispatch_count zero', async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(
    () =>
      callAdaptiveStateCliRealizer({
        modelRef: 'codex.gpt-5.6-terra',
        input: publicInput(),
        expectedEventIds: ['adopt:evidence_01'],
        effort: 'low',
        timeoutMs: 12_000,
        signal: controller.signal,
        resolveModelRef: () => ({ provider: 'codex', model: 'gpt-5.6-terra', isConfigured: true }),
        callCli: async () => {
          calls += 1;
          throw new Error('must not dispatch');
        },
        clock: () => 1000,
      }),
    (error) => {
      assert.match(error.message, /aborted before CLI process dispatch/u);
      assert.equal(error.callMetadata.dispatch_count, 0);
      assert.equal(error.callMetadata.attempts, 0);
      assert.equal(typeof error.callArtifacts.system_prompt, 'string');
      assert.equal(typeof error.callArtifacts.user_prompt, 'string');
      return true;
    },
  );
  assert.equal(calls, 0);
});
