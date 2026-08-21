import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildTutorStubResistanceSemanticZeroCallFixtureResponse } from '../services/tutorStubResistanceSemanticAdjudication.js';
import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V2,
  buildTutorStubResistanceSemanticZeroCallFixtureResponseV2,
} from '../services/tutorStubResistanceSemanticAdjudicationV2.js';
import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_AGGREGATE_EVENT,
  TUTOR_STUB_RESISTANCE_SEMANTIC_JUDGE_EVENT,
  TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION,
  TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_V2,
  createLazyTutorStubResistanceSemanticAdjudicator,
  createTutorStubResistanceSemanticRuntime,
  loadTutorStubResistanceSemanticRegistration,
} from '../services/tutorStubResistanceSemanticRuntime.js';
import { auditTutorStubResistanceSemanticTrace } from '../services/tutorStubResistanceSemanticTraceAudit.js';
import {
  tutorStubResistanceActionRegisterTreatmentEligibility,
  tutorStubResistanceActionRegisterTriggerFromTurnRecord,
} from '../services/tutorStubResistanceActionRegisterStudy.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const corpus = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'config/tutor-stub-resistance-semantic-adjudication-development-corpus.v1.json')),
);
const binding = loadTutorStubResistanceSemanticRegistration();
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
};
const canonicalSha256 = (value) =>
  crypto
    .createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');

test('legacy host composition can hold the semantic adjudicator without loading its registration', async () => {
  let constructions = 0;
  const requestedRegistrationPaths = [];
  const adjudicate = createLazyTutorStubResistanceSemanticAdjudicator(
    { unused: true },
    {
      loadRegistration: (registrationPath) => {
        requestedRegistrationPaths.push(registrationPath);
        return binding;
      },
      createRuntime: () => {
        constructions += 1;
        return { adjudicateCandidate: async () => ({ ok: true }) };
      },
    },
  );
  assert.equal(constructions, 0);
  assert.deepEqual(requestedRegistrationPaths, []);
  assert.deepEqual(await adjudicate({}), { ok: true });
  assert.equal(constructions, 1);
  assert.deepEqual(requestedRegistrationPaths, [TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION]);
  assert.deepEqual(await adjudicate({}), { ok: true });
  assert.equal(constructions, 1);
});

function fixtureRuntime({
  invalidJudge = null,
  failedJudge = null,
  abortJudge = null,
  missingTelemetryJudge = null,
  highEffortJudge = null,
} = {}) {
  const events = [];
  const calls = [];
  const rawResponses = new Map();
  const corpusCase = corpus.cases.find((row) => row.case_id === 'historic-v7-live-raw');
  const runtime = createTutorStubResistanceSemanticRuntime({
    appendTraceEvent: (_trace, event) => events.push(event),
    resolveModel: (modelRef) => {
      const judge = binding.registration.measurement.judges.find((row) => row.modelRef === modelRef);
      return { provider: judge.provider, model: judge.model };
    },
    callPromptModel: async ({ prompt, resolved, role, effort, outputSchema }) => {
      const packet = JSON.parse(prompt);
      const judge = binding.registration.measurement.judges.find((row) => row.id === packet.judge.id);
      calls.push({ packet, resolved, role, effort, outputSchema });
      if (judge.id === abortJudge) {
        const error = new Error('cancelled by coordinator');
        error.name = 'AbortError';
        throw error;
      }
      if (judge.id === failedJudge) throw new Error('post-policy-retry transport exhausted');
      if (judge.id === invalidJudge) {
        const invalid = { text: '{', provider: judge.provider, model: judge.model };
        rawResponses.set(judge.id, invalid);
        return invalid;
      }
      const fixture = buildTutorStubResistanceSemanticZeroCallFixtureResponse({ corpusCase, judge });
      const response = {
        text: JSON.stringify({ ...fixture.modelOutput, case_id: packet.case_id }),
        provider: judge.provider,
        model: judge.model,
        effort: judge.id === highEffortJudge ? 'high' : 'low',
        structuredOutput: true,
        prohibitedToolEventCount: 0,
        prohibitedToolEventCountObserved: true,
        modelAttestationBasis: 'explicit_cli_model_argument_accepted_bridge_echo',
        modelIndependentlyAttested: false,
      };
      if (judge.id === missingTelemetryJudge) {
        delete response.prohibitedToolEventCount;
        response.prohibitedToolEventCountObserved = false;
      }
      rawResponses.set(judge.id, response);
      return response;
    },
    registrationBinding: binding,
  });
  const state = {
    history: [{ role: 'assistant', content: corpusCase.public_context[0].text }],
    trace: { filePath: '/tmp/zero-call.jsonl' },
    interim: null,
  };
  return { calls, corpusCase, events, rawResponses, runtime, state };
}

test('production semantic runtime calls exactly two independent non-Luna judges and caches one aggregate', async () => {
  const value = fixtureRuntime();
  const first = await value.runtime.adjudicateCandidate({
    state: value.state,
    learnerText: value.corpusCase.source,
    turnNumber: 3,
  });
  const second = await value.runtime.adjudicateCandidate({
    state: value.state,
    learnerText: value.corpusCase.source,
    turnNumber: 3,
  });
  assert.deepEqual(second, first);
  assert.equal(first.aggregate.final_label, 'frame_refuser');
  assert.equal(value.calls.length, 2);
  assert.deepEqual(
    value.calls.map((call) => call.resolved),
    [
      { provider: 'codex', model: 'gpt-5.6-sol' },
      { provider: 'claude-code', model: 'claude-sonnet-5' },
    ],
  );
  assert.ok(value.calls.every((call) => call.effort === 'low'));
  assert.ok(value.calls.every((call) => call.outputSchema.properties.provenance === undefined));
  assert.equal(value.events.filter((event) => event.type === TUTOR_STUB_RESISTANCE_SEMANTIC_JUDGE_EVENT).length, 2);
  assert.equal(value.events.filter((event) => event.type === TUTOR_STUB_RESISTANCE_SEMANTIC_AGGREGATE_EVENT).length, 1);
  const judgeEvents = value.events.filter((event) => event.type === TUTOR_STUB_RESISTANCE_SEMANTIC_JUDGE_EVENT);
  assert.equal(new Set(judgeEvents.map((event) => event.independentRunId)).size, 2);
  assert.ok(judgeEvents.every((event) => event.structuredOutput === true));
  assert.ok(judgeEvents.every((event) => event.prohibitedToolEventCount === 0));
  assert.ok(judgeEvents.every((event) => event.systemPrompt && event.userPrompt));
  assert.ok(value.calls.every((call) => !call.packet.case_id.includes('initial')));
  assert.ok(value.calls.every((call) => !call.packet.case_id.includes('repair')));
  assert.ok(value.events.every((event) => event.candidateKind === undefined || event.candidateKind === 'initial'));
});

test('production semantic runtime selects the frozen quote-only v2 instrument without changing the v1 default', async () => {
  const bindingV2 = loadTutorStubResistanceSemanticRegistration(TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_V2);
  const corpusCase = corpus.cases.find((row) => row.case_id === 'historic-v7-live-raw');
  const calls = [];
  const events = [];
  const rawResponses = new Map();
  const runtime = createTutorStubResistanceSemanticRuntime({
    appendTraceEvent: (_trace, event) => events.push(event),
    resolveModel: (modelRef) => {
      const judge = bindingV2.registration.measurement.judges.find((row) => row.modelRef === modelRef);
      return { provider: judge.provider, model: judge.model };
    },
    callPromptModel: async ({ prompt, resolved, outputSchema }) => {
      const packet = JSON.parse(prompt);
      const judge = bindingV2.registration.measurement.judges.find((row) => row.id === packet.judge.id);
      const fixture = buildTutorStubResistanceSemanticZeroCallFixtureResponseV2({ corpusCase, judge });
      calls.push({ packet, outputSchema });
      const response = {
        text: JSON.stringify({ ...fixture.modelOutput, case_id: packet.case_id }),
        provider: resolved.provider,
        model: resolved.model,
        effort: 'low',
        structuredOutput: true,
        prohibitedToolEventCount: 0,
        prohibitedToolEventCountObserved: true,
        modelAttestationBasis: 'explicit_cli_model_argument_accepted_bridge_echo',
        modelIndependentlyAttested: false,
      };
      rawResponses.set(judge.id, response);
      return response;
    },
    registrationBinding: bindingV2,
  });
  const result = await runtime.adjudicateCandidate({
    state: {
      history: [{ role: 'assistant', content: corpusCase.public_context[0].text }],
      trace: { filePath: '/tmp/zero-call-v2.jsonl' },
      interim: null,
    },
    learnerText: corpusCase.source,
    turnNumber: 3,
  });
  assert.equal(result.observationSemantics, TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V2);
  assert.equal(result.aggregate.final_label, 'frame_refuser');
  assert.equal(result.judgeRecordCount, 2);
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.outputSchema.properties.judgment.properties.evidence_quotes));
  assert.ok(calls.every((call) => !call.outputSchema.properties.judgment.properties.evidence_spans));
  assert.equal(
    auditTutorStubResistanceSemanticTrace({
      events: semanticTrace({ corpusCase, events, rawResponses }),
      expectedCandidateCount: 1,
    }).measurementIndeterminate,
    false,
  );
});

test('lazy semantic composition fails closed on a registration that drifts from requested v2 semantics', async () => {
  const adjudicate = createLazyTutorStubResistanceSemanticAdjudicator(
    {},
    {
      observationSemantics: TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V2,
      loadRegistration: () => loadTutorStubResistanceSemanticRegistration(),
      createRuntime: () => {
        throw new Error('drifted registration must not construct the runtime');
      },
    },
  );
  await assert.rejects(adjudicate({}), /registration observation semantics drifted/u);
});

test('model-visible semantic case identity is opaque to repair status while trace metadata retains it', async () => {
  const value = fixtureRuntime();
  await value.runtime.adjudicateCandidate({
    state: value.state,
    learnerText: `${value.corpusCase.source} I remain explicit.`,
    turnNumber: 3,
    candidateKind: 'learner-repair-1',
  });
  assert.equal(value.calls.length, 2);
  for (const call of value.calls) {
    assert.match(call.packet.case_id, /^semantic-case-[0-9a-f]{64}$/u);
    assert.equal(JSON.stringify(call.packet).includes('learner-repair-1'), false);
  }
  assert.ok(
    value.events
      .filter((event) => event.type === TUTOR_STUB_RESISTANCE_SEMANTIC_JUDGE_EVENT)
      .every((event) => event.candidateKind === 'learner-repair-1'),
  );
});

function semanticTrace(value) {
  const rows = [{ type: 'tutor_opening', text: value.corpusCase.public_context[0].text }];
  for (const event of value.events.filter((row) => row.type === TUTOR_STUB_RESISTANCE_SEMANTIC_JUDGE_EVENT)) {
    const attempt = event.transportCompleted
      ? {
          type: 'model_call',
          role: event.role,
          turn: event.turn,
          provider: event.observedProvider,
          model: event.observedModel,
          request: {
            systemPrompt: event.systemPrompt,
            prompt: event.userPrompt,
            cliEffort: event.expectedEffort,
            outputSchema: event.outputSchema,
          },
          response: {
            text: value.rawResponses.get(event.judgeId)?.text,
            effort: event.observedEffort,
            structuredOutput: event.structuredOutput,
            prohibitedToolEventCount: event.prohibitedToolEventCount,
            prohibitedToolEventCountObserved: event.prohibitedToolEventCountObserved,
            modelAttestationBasis: event.modelAttestationBasis,
            modelIndependentlyAttested: event.modelIndependentlyAttested,
          },
        }
      : {
          type: 'model_call_error',
          role: event.role,
          turn: event.turn,
          provider: event.expectedProvider,
          model: event.expectedModel,
          request: {
            systemPrompt: event.systemPrompt,
            prompt: event.userPrompt,
            cliEffort: event.expectedEffort,
            outputSchema: event.outputSchema,
          },
          error: event.invalidReason,
        };
    rows.push(
      { type: 'model_call_budget_reserved', role: event.role, turn: event.turn, admission: { reserved: true } },
      attempt,
      event,
    );
  }
  rows.push(
    value.events.find((row) => row.type === TUTOR_STUB_RESISTANCE_SEMANTIC_AGGREGATE_EVENT),
    { type: 'resistance_action_register_outcome_learner_turn', turn: 3 },
  );
  return rows;
}

test('zero-call trace audit binds both judge calls to one packet and reproduces the aggregate', async () => {
  const value = fixtureRuntime();
  await value.runtime.adjudicateCandidate({
    state: value.state,
    learnerText: value.corpusCase.source,
    turnNumber: 3,
  });
  const trace = semanticTrace(value);
  assert.deepEqual(auditTutorStubResistanceSemanticTrace({ events: trace, expectedCandidateCount: 1 }), {
    valid: true,
    candidateCount: 1,
    judgeEventCount: 2,
    measurementIndeterminate: false,
    fisherAnalysisWithheld: false,
  });

  const changedSecondSource = structuredClone(trace);
  const secondJudge = changedSecondSource.find(
    (event) => event.type === TUTOR_STUB_RESISTANCE_SEMANTIC_JUDGE_EVENT && event.judgeId === 'semantic_judge_b',
  );
  const secondCall = changedSecondSource.find(
    (event) => event.type === 'model_call' && event.role === secondJudge.role,
  );
  const prompt = JSON.parse(secondJudge.userPrompt);
  prompt.utterance.text += ' changed';
  secondJudge.userPrompt = JSON.stringify(prompt);
  secondJudge.userPromptSha256 = crypto.createHash('sha256').update(secondJudge.userPrompt).digest('hex');
  secondCall.request.prompt = secondJudge.userPrompt;
  assert.throws(
    () => auditTutorStubResistanceSemanticTrace({ events: changedSecondSource, expectedCandidateCount: 1 }),
    /one exact candidate packet|prompt, route, schema/u,
  );

  const changedAggregate = structuredClone(trace);
  const aggregate = changedAggregate.find((event) => event.type === TUTOR_STUB_RESISTANCE_SEMANTIC_AGGREGATE_EVENT);
  aggregate.aggregate.final_label = 'neither';
  aggregate.aggregate.judgment.final_label = 'neither';
  aggregate.aggregateSha256 = canonicalSha256(aggregate.aggregate);
  assert.throws(
    () => auditTutorStubResistanceSemanticTrace({ events: changedAggregate, expectedCandidateCount: 1 }),
    /reproduce from its exact persisted/u,
  );

  const extraCall = structuredClone(trace);
  const extraModelCall = structuredClone(extraCall.find((event) => event.type === 'model_call'));
  extraCall.splice(1, 0, {
    type: 'model_call_budget_reserved',
    role: extraModelCall.role,
    turn: extraModelCall.turn,
    admission: { reserved: true },
  });
  extraCall.splice(2, 0, extraModelCall);
  assert.throws(
    () => auditTutorStubResistanceSemanticTrace({ events: extraCall, expectedCandidateCount: 1 }),
    /extra, missing, or unpaired|prompt, route, schema|independence envelope/u,
  );

  const alternateError = structuredClone(trace);
  const firstCall = alternateError.find((event) => event.type === 'model_call');
  const extraReservation = {
    type: 'model_call_budget_reserved',
    role: firstCall.role,
    turn: firstCall.turn,
    admission: { reserved: true },
  };
  const extraError = {
    ...structuredClone(firstCall),
    type: 'model_call_error',
    request: { ...structuredClone(firstCall.request), prompt: `${firstCall.request.prompt} changed` },
    error: 'synthetic alternate prompt error',
  };
  delete extraError.response;
  alternateError.splice(1, 0, extraReservation, extraError);
  assert.throws(
    () => auditTutorStubResistanceSemanticTrace({ events: alternateError, expectedCandidateCount: 1 }),
    /extra, missing, or unpaired/u,
  );

  const aborted = structuredClone(trace);
  const abortCall = aborted.find((event) => event.type === 'model_call');
  const abortReservation = {
    type: 'model_call_budget_reserved',
    role: abortCall.role,
    turn: abortCall.turn,
    admission: { reserved: true },
  };
  const abortEvent = { ...structuredClone(abortCall), type: 'model_call_aborted', error: 'cancelled' };
  delete abortEvent.response;
  aborted.splice(1, 0, abortReservation, abortEvent);
  assert.throws(
    () => auditTutorStubResistanceSemanticTrace({ events: aborted, expectedCandidateCount: 1 }),
    /independence envelope|extra, missing, or unpaired/u,
  );

  const substitutedRecord = structuredClone(trace);
  const substitutedJudges = substitutedRecord.filter(
    (event) => event.type === TUTOR_STUB_RESISTANCE_SEMANTIC_JUDGE_EVENT,
  );
  substitutedJudges[1].record = structuredClone(substitutedJudges[0].record);
  assert.throws(
    () => auditTutorStubResistanceSemanticTrace({ events: substitutedRecord, expectedCandidateCount: 1 }),
    /prompt, route, schema, tool, or independence envelope/u,
  );

  const discardedValidRaw = structuredClone(trace);
  const discardedJudge = discardedValidRaw.find((event) => event.type === TUTOR_STUB_RESISTANCE_SEMANTIC_JUDGE_EVENT);
  discardedJudge.record = null;
  discardedJudge.validModelEnvelope = false;
  discardedJudge.invalidReason = 'discarded valid raw response';
  assert.throws(
    () => auditTutorStubResistanceSemanticTrace({ events: discardedValidRaw, expectedCandidateCount: 1 }),
    /prompt, route, schema, tool, or independence envelope/u,
  );
});

test('trace audit preserves typed invalid-return, provenance, and transport indeterminacy without treating them as corruption', async () => {
  for (const options of [
    { invalidJudge: 'semantic_judge_b' },
    { failedJudge: 'semantic_judge_b' },
    { highEffortJudge: 'semantic_judge_b' },
    { missingTelemetryJudge: 'semantic_judge_a' },
  ]) {
    const value = fixtureRuntime(options);
    await value.runtime.adjudicateCandidate({
      state: value.state,
      learnerText: value.corpusCase.source,
      turnNumber: 3,
    });
    const trace = semanticTrace(value);
    const audited = auditTutorStubResistanceSemanticTrace({ events: trace, expectedCandidateCount: 1 });
    assert.equal(audited.measurementIndeterminate, true);
    assert.equal(audited.fisherAnalysisWithheld, true);

    if (options.invalidJudge || options.failedJudge) {
      const tampered = structuredClone(trace);
      const failed = tampered.find(
        (event) => event.type === TUTOR_STUB_RESISTANCE_SEMANTIC_JUDGE_EVENT && event.validModelEnvelope === false,
      );
      failed.invalidReason = '';
      assert.throws(
        () => auditTutorStubResistanceSemanticTrace({ events: tampered, expectedCandidateCount: 1 }),
        /prompt, route, schema, tool, or independence envelope/u,
      );
    }
  }
});

test('one invalid returned model envelope yields terminal measurement indeterminate without an internal rerun', async () => {
  const value = fixtureRuntime({ invalidJudge: 'semantic_judge_b' });
  const result = await value.runtime.adjudicateCandidate({
    state: value.state,
    learnerText: value.corpusCase.source,
    turnNumber: 3,
  });
  assert.equal(value.calls.length, 2);
  assert.equal(result.aggregate.status, 'measurement_indeterminate');
  assert.equal(result.aggregate.repair_allowed, false);
  assert.equal(result.aggregate.judge_rerun_allowed, false);
  assert.equal(result.aggregate.unit_rerun_allowed, false);
  assert.equal(result.judgeRecordCount, 1);
});

test('one exhausted judge transport is persisted and terminally indeterminate without recalling completed judges', async () => {
  const value = fixtureRuntime({ failedJudge: 'semantic_judge_b' });
  const result = await value.runtime.adjudicateCandidate({
    state: value.state,
    learnerText: value.corpusCase.source,
    turnNumber: 3,
  });
  assert.equal(value.calls.length, 2);
  assert.equal(result.aggregate.status, 'measurement_indeterminate');
  assert.equal(result.aggregate.repair_allowed, false);
  assert.equal(result.aggregate.judge_rerun_allowed, false);
  assert.equal(result.aggregate.unit_rerun_allowed, false);
  assert.equal(result.judgeRecordCount, 1);
  const events = value.events.filter((event) => event.type === TUTOR_STUB_RESISTANCE_SEMANTIC_JUDGE_EVENT);
  assert.equal(events.length, 2);
  assert.equal(events[0].validModelEnvelope, true);
  assert.equal(events[1].transportCompleted, false);
  assert.match(events[1].invalidReason, /post-policy-retry transport exhausted/);
});

test('an abort propagates immediately and never starts the second semantic judge', async () => {
  const value = fixtureRuntime({ abortJudge: 'semantic_judge_a' });
  await assert.rejects(
    value.runtime.adjudicateCandidate({
      state: value.state,
      learnerText: value.corpusCase.source,
      turnNumber: 3,
    }),
    (error) => error.name === 'AbortError',
  );
  assert.equal(value.calls.length, 1);
  assert.equal(value.events.length, 0);
});

test('missing tool telemetry or observed high effort invalidates the pair instead of being coerced', async () => {
  for (const options of [{ missingTelemetryJudge: 'semantic_judge_a' }, { highEffortJudge: 'semantic_judge_b' }]) {
    const value = fixtureRuntime(options);
    const result = await value.runtime.adjudicateCandidate({
      state: value.state,
      learnerText: value.corpusCase.source,
      turnNumber: 3,
    });
    assert.equal(result.aggregate.status, 'measurement_indeterminate');
    assert.ok(result.aggregate.reasons.includes('invalid_schema_span_or_provenance'));
  }
});

test('semantic treatment eligibility rejects stale bindings while keeping safety separate from classification', async () => {
  const value = fixtureRuntime();
  const result = await value.runtime.adjudicateCandidate({
    state: value.state,
    learnerText: value.corpusCase.source,
    turnNumber: 3,
  });
  const runtime = {
    registration: {
      design: { trigger: { observationSemantics: 'prospective_frame_resistance_semantic_v1' } },
    },
    profile: 'frame_refuser',
    consumed: false,
    current_semantic_adjudication: result,
  };
  const eligible = (semantic = result, learnerText = value.corpusCase.source, classification = null) =>
    tutorStubResistanceActionRegisterTreatmentEligibility({
      runtime: { ...runtime, current_semantic_adjudication: semantic },
      learnerText,
      classification,
      tutorLearnerDag: null,
      turnNumber: 3,
      expectedPublicContext: result.publicContext,
    });
  assert.equal(eligible().eligible, true);
  for (const mutate of [
    (semantic) => (semantic.turn = 2),
    (semantic) => (semantic.registrationSha256 = '0'.repeat(64)),
    (semantic) => (semantic.packetSha256 = '0'.repeat(64)),
    (semantic) => (semantic.aggregateSha256 = '0'.repeat(64)),
  ]) {
    const semantic = structuredClone(result);
    mutate(semantic);
    assert.equal(eligible(semantic).eligible, false);
  }
  assert.equal(eligible(result, `${value.corpusCase.source} changed`).eligible, false);
  const replacedContext = structuredClone(result);
  replacedContext.publicContext = [{ role: 'assistant', text: 'A different public question.' }];
  replacedContext.publicContextSha256 = canonicalSha256(replacedContext.publicContext);
  replacedContext.packetSha256 = canonicalSha256({
    case_id: replacedContext.caseId,
    public_context: replacedContext.publicContext,
    utterance: value.corpusCase.source,
  });
  replacedContext.packetKey = canonicalSha256({
    caseId: replacedContext.caseId,
    publicContext: replacedContext.publicContext,
    source: value.corpusCase.source,
  });
  assert.equal(eligible(replacedContext).eligible, false);
  const weakenedBoundary = structuredClone(result);
  weakenedBoundary.aggregate.unit_rerun_allowed = true;
  weakenedBoundary.aggregateSha256 = canonicalSha256(weakenedBoundary.aggregate);
  assert.equal(eligible(weakenedBoundary).eligible, false);
  const protectedResult = eligible(result, value.corpusCase.source, { turn: { affect: 'shame' } });
  assert.equal(protectedResult.eligible, false);
  assert.ok(protectedResult.reasons.includes('protected_affect'));
  assert.equal(protectedResult.semantic_authority.semantic_label, 'frame_refuser');
  assert.equal(protectedResult.semantic_authority.safety_signal_can_recode_semantic_positive, false);

  for (const classification of [
    { turn: { affect: 'shame' } },
    { turn: { pedagogical_need: 'plain_language_request' } },
  ]) {
    const replayed = tutorStubResistanceActionRegisterTriggerFromTurnRecord(
      {
        turn: 3,
        learner: value.corpusCase.source,
        classification,
        resistanceSemanticAdjudication: result,
        tutorLearnerDagModel: null,
      },
      'frame_refuser',
      'prospective_frame_resistance_semantic_v1',
      result.publicContext,
    );
    assert.equal(replayed.eligible, false);
    assert.equal(replayed.shadow.resistance_kind, 'frame_refuser');
    assert.equal(replayed.timing.canVetoSemanticClassification, false);
  }
});
