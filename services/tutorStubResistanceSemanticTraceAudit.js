import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { recordFileDigest } from './recordedFileDigest.js';
import {
  tutorStubResistanceSemanticPromptSha256,
  tutorStubResistanceSemanticSha256,
} from './tutorStubResistanceSemanticAdjudication.js';
import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_AGGREGATE_EVENT,
  TUTOR_STUB_RESISTANCE_SEMANTIC_JUDGE_EVENT,
  TUTOR_STUB_RESISTANCE_SEMANTIC_SYSTEM_PROMPT,
  loadTutorStubResistanceSemanticRegistration,
  tutorStubResistanceSemanticRuntimeInstrument,
  validateTutorStubResistanceSemanticRuntimeResult,
} from './tutorStubResistanceSemanticRuntime.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function exactJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function publicContextByTurn(events, maximumRows = 4) {
  const contexts = new Map();
  const history = [];
  const opening = events.find((event) => event.type === 'tutor_opening')?.text;
  if (opening) history.push({ role: 'assistant', text: String(opening) });
  const completed = events
    .filter((event) => event.type === 'turn_complete' && event.turnRecord)
    .sort((left, right) => Number(left.turn) - Number(right.turn));
  for (const event of completed) {
    contexts.set(Number(event.turn), history.slice(-maximumRows));
    history.push(
      { role: 'learner', text: String(event.turnRecord.learner || '') },
      { role: 'assistant', text: String(event.turnRecord.tutor || '') },
    );
  }
  const outcome = events.find((event) => event.type === 'resistance_action_register_outcome_learner_turn');
  if (outcome) contexts.set(Number(outcome.turn), history.slice(-maximumRows));
  return contexts;
}

export function auditTutorStubResistanceSemanticTrace({ events, expectedCandidateCount = null } = {}) {
  const judgeEvents = events.filter((event) => event.type === TUTOR_STUB_RESISTANCE_SEMANTIC_JUDGE_EVENT);
  const modelCalls = events.filter(
    (event) => event.type === 'model_call' && String(event.role || '').startsWith('tutor_stub_resistance_semantic_'),
  );
  const modelErrors = events.filter(
    (event) =>
      event.type === 'model_call_error' && String(event.role || '').startsWith('tutor_stub_resistance_semantic_'),
  );
  const modelAborts = events.filter(
    (event) =>
      event.type === 'model_call_aborted' && String(event.role || '').startsWith('tutor_stub_resistance_semantic_'),
  );
  const reservations = events.filter(
    (event) =>
      event.type === 'model_call_budget_reserved' &&
      String(event.role || '').startsWith('tutor_stub_resistance_semantic_'),
  );
  const attempts = [...modelCalls, ...modelErrors, ...modelAborts];
  const aggregates = events.filter((event) => event.type === TUTOR_STUB_RESISTANCE_SEMANTIC_AGGREGATE_EVENT);
  const registrationPaths = new Set(
    [...judgeEvents, ...aggregates].map((event) => event.registrationPath).filter(Boolean),
  );
  if (registrationPaths.size > 1) throw new Error('semantic trace mixes frozen registrations');
  const binding = loadTutorStubResistanceSemanticRegistration([...registrationPaths][0]);
  // Every event names the one frozen registration checked above. The digest each
  // event carried when it was written is recorded here, not refused.
  const digestRecords = [
    ...new Set([...judgeEvents, ...aggregates].map((event) => event.registrationSha256).filter(Boolean)),
  ].map((recordedSha256) =>
    recordFileDigest({
      root: ROOT,
      filePath: binding.path,
      recordedSha256,
      label: 'semantic registration named by the trace events',
    }),
  );
  const instrument = tutorStubResistanceSemanticRuntimeInstrument(binding);
  const judges = new Map(binding.registration.measurement.judges.map((judge) => [judge.id, judge]));
  if (expectedCandidateCount !== null && aggregates.length !== expectedCandidateCount) {
    throw new Error(`semantic trace requires exactly ${expectedCandidateCount} candidate aggregates`);
  }
  if (judgeEvents.length !== aggregates.length * 2) {
    throw new Error('semantic trace requires exactly two judge events per candidate aggregate');
  }
  const contextByTurn = publicContextByTurn(events);
  const seenRunIds = new Set();
  const seenCases = new Set();
  for (const aggregate of aggregates) {
    if (seenCases.has(aggregate.caseId)) throw new Error('semantic trace repeats a candidate case id');
    seenCases.add(aggregate.caseId);
    const candidates = judgeEvents.filter((event) => event.caseId === aggregate.caseId);
    if (candidates.length !== 2 || new Set(candidates.map((event) => event.judgeId)).size !== 2) {
      throw new Error('semantic candidate lacks its exact independent judge pair');
    }
    const expectedContext = contextByTurn.get(Number(aggregate.turn));
    const parsedPrompts = new Map();
    for (const event of candidates) {
      const judge = judges.get(event.judgeId);
      const prompt = JSON.parse(String(event.userPrompt || ''));
      parsedPrompts.set(event.judgeId, prompt);
      const matchingModelCalls = modelCalls.filter(
        (call) =>
          call.role === event.role &&
          Number(call.turn) === Number(event.turn) &&
          call.request?.systemPrompt === event.systemPrompt &&
          call.request?.prompt === event.userPrompt,
      );
      const matchingModelErrors = modelErrors.filter(
        (error) =>
          error.role === event.role &&
          Number(error.turn) === Number(event.turn) &&
          error.provider === event.expectedProvider &&
          error.model === event.expectedModel &&
          error.request?.systemPrompt === event.systemPrompt &&
          error.request?.prompt === event.userPrompt,
      );
      const matchingModelAborts = modelAborts.filter(
        (aborted) =>
          aborted.role === event.role &&
          Number(aborted.turn) === Number(event.turn) &&
          aborted.provider === event.expectedProvider &&
          aborted.model === event.expectedModel &&
          aborted.request?.systemPrompt === event.systemPrompt &&
          aborted.request?.prompt === event.userPrompt,
      );
      const matchingAttempts = matchingModelCalls.length + matchingModelErrors.length + matchingModelAborts.length;
      let rebuiltRecord = null;
      let rawResponseRebuildFailed = false;
      if (matchingModelCalls.length === 1) {
        try {
          const modelOutput = JSON.parse(String(matchingModelCalls[0].response?.text || ''));
          if (modelOutput?.schema !== instrument.responseSchema) {
            throw new Error('semantic judge model output schema mismatch');
          }
          rebuiltRecord = instrument.wrapModelOutput({
            modelOutput,
            prompt,
            judge,
            observedProvider: matchingModelCalls[0].provider,
            observedModel: matchingModelCalls[0].model,
            observedEffort: matchingModelCalls[0].response?.effort,
            independentRunId: event.independentRunId,
            structuredOutput: matchingModelCalls[0].response?.structuredOutput,
            prohibitedToolEvents: matchingModelCalls[0].response?.prohibitedToolEventCountObserved
              ? matchingModelCalls[0].response?.prohibitedToolEventCount
              : null,
            modelAttestationBasis: matchingModelCalls[0].response?.modelAttestationBasis,
            modelIndependentlyAttested: matchingModelCalls[0].response?.modelIndependentlyAttested,
          });
        } catch {
          rawResponseRebuildFailed = true;
        }
      }
      const returnedRecordEnvelope =
        event.transportCompleted === true &&
        event.validModelEnvelope === true &&
        event.record !== null &&
        rebuiltRecord !== null &&
        exactJson(event.record, rebuiltRecord);
      const invalidReturnedEnvelope =
        event.transportCompleted === true &&
        event.validModelEnvelope === false &&
        event.record === null &&
        rawResponseRebuildFailed &&
        Boolean(String(event.invalidReason || '').trim());
      const exhaustedTransportEnvelope =
        event.transportCompleted === false &&
        event.validModelEnvelope === false &&
        event.record === null &&
        Boolean(String(event.invalidReason || '').trim());
      const matchedCall = matchingModelCalls[0];
      const validSuccessfulCallEnvelope =
        matchingModelCalls.length === 1 &&
        matchedCall.provider === event.observedProvider &&
        matchedCall.model === event.observedModel &&
        exactJson(matchedCall.request?.outputSchema, instrument.outputSchema) &&
        matchedCall.request?.cliEffort === judge?.effort &&
        matchedCall.response?.effort === event.observedEffort &&
        matchedCall.response?.structuredOutput === event.structuredOutput &&
        matchedCall.response?.prohibitedToolEventCountObserved === event.prohibitedToolEventCountObserved &&
        matchedCall.response?.prohibitedToolEventCount === event.prohibitedToolEventCount &&
        matchedCall.response?.modelAttestationBasis === event.modelAttestationBasis &&
        matchedCall.response?.modelIndependentlyAttested === event.modelIndependentlyAttested;
      const validFailedTransportEnvelope =
        matchingModelCalls.length === 0 &&
        matchingModelErrors.length >= 1 &&
        matchingModelErrors.some((error) => error.error === event.invalidReason) &&
        matchingModelErrors.every(
          (error) =>
            exactJson(error.request?.outputSchema, instrument.outputSchema) &&
            error.request?.cliEffort === judge?.effort,
        ) &&
        event.observedProvider === null &&
        event.observedModel === null &&
        event.observedEffort === null &&
        event.structuredOutput === false &&
        event.prohibitedToolEventCountObserved === false &&
        event.prohibitedToolEventCount === null &&
        event.modelAttestationBasis === null &&
        event.modelIndependentlyAttested === false;
      if (
        !judge ||
        matchingAttempts < 1 ||
        matchingAttempts > 3 ||
        matchingModelAborts.length !== 0 ||
        event.turn !== aggregate.turn ||
        event.candidateKind !== aggregate.candidateKind ||
        event.role !== `tutor_stub_resistance_semantic_${judge.id}` ||
        event.expectedProvider !== judge.provider ||
        event.expectedModel !== judge.model ||
        event.expectedEffort !== judge.effort ||
        event.systemPrompt !== TUTOR_STUB_RESISTANCE_SEMANTIC_SYSTEM_PROMPT ||
        event.systemPromptSha256 !== tutorStubResistanceSemanticSha256(TUTOR_STUB_RESISTANCE_SEMANTIC_SYSTEM_PROMPT) ||
        event.userPromptSha256 !== tutorStubResistanceSemanticSha256(event.userPrompt) ||
        event.promptSha256 !== tutorStubResistanceSemanticPromptSha256(prompt) ||
        event.packetSha256 !== prompt.packet_sha256 ||
        !exactJson(event.outputSchema, instrument.outputSchema) ||
        !(
          (returnedRecordEnvelope && validSuccessfulCallEnvelope) ||
          (invalidReturnedEnvelope && validSuccessfulCallEnvelope) ||
          (exhaustedTransportEnvelope && validFailedTransportEnvelope)
        ) ||
        seenRunIds.has(event.independentRunId)
      ) {
        throw new Error('semantic judge event violates its prompt, route, schema, tool, or independence envelope');
      }
      seenRunIds.add(event.independentRunId);
    }
    const prompts = Object.fromEntries(parsedPrompts);
    const promptRows = [...parsedPrompts.values()];
    const source = promptRows[0]?.utterance?.text;
    const packetSha256 = promptRows[0]?.packet_sha256;
    if (
      promptRows.some(
        (prompt) =>
          prompt.case_id !== aggregate.caseId ||
          prompt.utterance?.text !== source ||
          !exactJson(prompt.public_context, expectedContext) ||
          prompt.packet_sha256 !== packetSha256,
      ) ||
      candidates.some(
        (event) =>
          event.registrationPath !== binding.path ||
          event.packetSha256 !== packetSha256 ||
          event.sourceSha256 !== tutorStubResistanceSemanticSha256(source),
      )
    ) {
      throw new Error('semantic judge pair does not bind one exact candidate packet and frozen registration');
    }
    const validation = validateTutorStubResistanceSemanticRuntimeResult({
      result: aggregate,
      learnerText: source,
      turnNumber: Number(aggregate.turn),
      registrationBinding: binding,
      expectedPublicContext: expectedContext,
      requireDeterminate: false,
    });
    if (
      !validation.valid ||
      aggregate.judgeRecordCount !== candidates.filter((event) => event.record !== null).length ||
      candidates.some((event) => !exactJson(JSON.parse(event.userPrompt).public_context, expectedContext))
    ) {
      throw new Error('semantic aggregate does not bind the exact preceding public context');
    }
    const recomputed = instrument.adjudicate({
      source,
      publicContext: expectedContext,
      caseId: aggregate.caseId,
      responses: candidates.map((event) => event.record).filter(Boolean),
      registration: binding.registration,
      prompts,
      advisorySignals: aggregate.aggregate?.advisory_signals || [],
    });
    if (!exactJson(recomputed, aggregate.aggregate)) {
      throw new Error('semantic aggregate does not reproduce from its exact persisted independent judge pair');
    }
    const lastJudgeIndex = Math.max(...candidates.map((event) => events.indexOf(event)));
    if (events.indexOf(aggregate) <= lastJudgeIndex) throw new Error('semantic aggregate precedes a judge result');
  }
  const attemptBinding = (attempt) =>
    judgeEvents.filter(
      (event) =>
        event.role === attempt.role &&
        Number(event.turn) === Number(attempt.turn) &&
        event.expectedProvider === attempt.provider &&
        event.expectedModel === attempt.model &&
        event.systemPrompt === attempt.request?.systemPrompt &&
        event.userPrompt === attempt.request?.prompt,
    ).length;
  const countByRoleTurn = (rows) =>
    rows.reduce((counts, row) => {
      const key = `${String(row.role)}:${Number(row.turn)}`;
      counts.set(key, (counts.get(key) || 0) + 1);
      return counts;
    }, new Map());
  const reserved = countByRoleTurn(reservations);
  const attempted = countByRoleTurn(attempts);
  const exactReservations =
    reserved.size === attempted.size && [...reserved].every(([key, count]) => attempted.get(key) === count);
  if (
    attempts.some((attempt) => attemptBinding(attempt) !== 1) ||
    reservations.length !== attempts.length ||
    !exactReservations
  ) {
    throw new Error('semantic trace contains an extra, missing, or unpaired semantic judge attempt or reservation');
  }
  const indeterminate = aggregates.filter((event) => event.aggregate?.status === 'measurement_indeterminate');
  return {
    valid: true,
    digestRecords,
    candidateCount: aggregates.length,
    judgeEventCount: judgeEvents.length,
    measurementIndeterminate: indeterminate.length > 0,
    fisherAnalysisWithheld: indeterminate.length > 0,
  };
}

export default { auditTutorStubResistanceSemanticTrace };
