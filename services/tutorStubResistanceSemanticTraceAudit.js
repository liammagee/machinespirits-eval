import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA,
  TUTOR_STUB_RESISTANCE_SEMANTIC_RESPONSE_SCHEMA,
  adjudicateTutorStubResistanceSemanticJudges,
  tutorStubResistanceSemanticPromptSha256,
  tutorStubResistanceSemanticSha256,
  wrapTutorStubResistanceSemanticModelOutput,
} from './tutorStubResistanceSemanticAdjudication.js';
import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_AGGREGATE_EVENT,
  TUTOR_STUB_RESISTANCE_SEMANTIC_JUDGE_EVENT,
  TUTOR_STUB_RESISTANCE_SEMANTIC_SYSTEM_PROMPT,
  loadTutorStubResistanceSemanticRegistration,
  validateTutorStubResistanceSemanticRuntimeResult,
} from './tutorStubResistanceSemanticRuntime.js';

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
  const binding = loadTutorStubResistanceSemanticRegistration();
  const judges = new Map(binding.registration.measurement.judges.map((judge) => [judge.id, judge]));
  const judgeEvents = events.filter((event) => event.type === TUTOR_STUB_RESISTANCE_SEMANTIC_JUDGE_EVENT);
  const modelCalls = events.filter(
    (event) => event.type === 'model_call' && String(event.role || '').startsWith('tutor_stub_resistance_semantic_'),
  );
  const modelErrors = events.filter(
    (event) =>
      event.type === 'model_call_error' && String(event.role || '').startsWith('tutor_stub_resistance_semantic_'),
  );
  const aggregates = events.filter((event) => event.type === TUTOR_STUB_RESISTANCE_SEMANTIC_AGGREGATE_EVENT);
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
      let rebuiltRecord = null;
      let rawResponseRebuildFailed = false;
      if (matchingModelCalls.length === 1) {
        try {
          const modelOutput = JSON.parse(String(matchingModelCalls[0].response?.text || ''));
          if (modelOutput?.schema !== TUTOR_STUB_RESISTANCE_SEMANTIC_RESPONSE_SCHEMA) {
            throw new Error('semantic judge model output schema mismatch');
          }
          rebuiltRecord = wrapTutorStubResistanceSemanticModelOutput({
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
        exactJson(matchedCall.request?.outputSchema, TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA) &&
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
            exactJson(error.request?.outputSchema, TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA) &&
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
        !exactJson(event.outputSchema, TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA) ||
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
          event.registrationSha256 !== binding.sha256 ||
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
    const recomputed = adjudicateTutorStubResistanceSemanticJudges({
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
  if (
    modelCalls.some(
      (call) =>
        judgeEvents.filter(
          (event) =>
            event.role === call.role &&
            Number(event.turn) === Number(call.turn) &&
            event.systemPrompt === call.request?.systemPrompt &&
            event.userPrompt === call.request?.prompt,
        ).length !== 1,
    )
  ) {
    throw new Error('semantic trace contains an extra, missing, or unpaired semantic judge model call');
  }
  const indeterminate = aggregates.filter((event) => event.aggregate?.status === 'measurement_indeterminate');
  return {
    valid: true,
    candidateCount: aggregates.length,
    judgeEventCount: judgeEvents.length,
    measurementIndeterminate: indeterminate.length > 0,
    fisherAnalysisWithheld: indeterminate.length > 0,
  };
}

export default { auditTutorStubResistanceSemanticTrace };
