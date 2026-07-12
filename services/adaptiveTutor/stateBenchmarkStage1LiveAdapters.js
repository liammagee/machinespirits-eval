import { callAIWithCliBridge } from '../cliProviderBridge.js';
import { resolveModel } from '../evalConfigLoader.js';
import {
  extractTutorStubPublicLearnerAnalysis,
  postprocessTutorStubPublicLearnerAnalysis,
  splitTutorStubPublicLearnerAnalysis,
} from '../tutorStubPublicLearnerAnalysis.js';
import { callAdaptiveStateCliRealizer } from './stateBenchmarkCliRealizer.js';

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function modelLabel(provider, model) {
  return provider && model ? `${provider}/${model}` : null;
}

function prohibitedStreamActivity(response) {
  const violations = Object.entries({
    ...(response?.streamEventTypeCounts || {}),
    ...(response?.streamItemTypeCounts || {}),
  }).filter(
    ([type, count]) =>
      Number(count) > 0 && /(?:tool|command|shell|exec|file|web|browser|mcp)/iu.test(String(type)),
  );
  if (Number(response?.prohibitedToolEventCount || 0) !== 0) {
    violations.push(['structured_event_audit', response.prohibitedToolEventCount]);
  }
  if (
    response?.provider === 'codex' &&
    (response?.structuredEventAudit?.policy !== 'strict_no_tools_allowlist' ||
      Number(response?.structuredEventAudit?.invalid_jsonl_line_count || 0) !== 0)
  ) {
    violations.push(['codex_strict_allowlist_missing_or_invalid', 1]);
  }
  return violations;
}

function dispatchMetadata({ modelRef, resolved, effort, timeoutMs, dispatchCount }) {
  return {
    status: dispatchCount ? 'dispatched' : 'pre_dispatch',
    requested_model_ref: modelRef,
    resolved_provider: resolved?.provider || null,
    resolved_model: resolved?.model || null,
    resolved_model_ref: modelLabel(resolved?.provider, resolved?.model),
    effort,
    timeout_ms: Number(timeoutMs),
    attempts: dispatchCount,
    dispatch_count: dispatchCount,
    semantic_rerolls: 0,
    structured_output_reported: false,
    stream_event_type_counts: {},
    stream_item_type_counts: {},
    structured_event_audit: null,
    prohibited_tool_event_count: 0,
    invalid_stream_lines: 0,
  };
}

async function notify(callback, value) {
  if (typeof callback === 'function') await callback(clone(value));
}

/**
 * Testable live-seam factory for the S1 executor. The canonical paid runner
 * must use createAdaptiveStateStage1ProductionLiveSeams below; this injectable
 * surface can never bind an executor result to paid authority.
 */
export function createAdaptiveStateStage1LiveSeams({
  config,
  onReached = null,
  onDispatch = null,
  onFinished = null,
  signal = null,
  callCli = callAIWithCliBridge,
  resolveModelRef = resolveModel,
} = {}) {
  const analyzer = config?.paid_execution_contract?.public_turn_analyzer;
  if (!analyzer?.model_ref) throw new Error('stateBenchmarkStage1Live: frozen analyzer runtime is required');
  const resolvedAnalyzer = resolveModelRef(analyzer.model_ref, { forceReload: true });
  if (!resolvedAnalyzer?.provider || !resolvedAnalyzer?.model || resolvedAnalyzer.isConfigured !== true) {
    throw new Error(`stateBenchmarkStage1Live: analyzer model ${analyzer.model_ref} is not configured`);
  }
  if (modelLabel(resolvedAnalyzer.provider, resolvedAnalyzer.model) !== analyzer.expected_cli_model_label) {
    throw new Error('stateBenchmarkStage1Live: analyzer resolution differs from frozen expected CLI label');
  }

  const realizeTurn = async (request) => {
    await notify(onReached, {
      type: 'call_reached',
      role: request.role,
      context: request.context,
      callId: request.context?.call_id,
      callIndex: request.context?.call_index,
      requestedModelRef: request.modelRef,
    });
    try {
      const result = await callAdaptiveStateCliRealizer({
        ...request,
        signal,
        resolveModelRef,
        callCli: async (...args) => {
          await notify(onDispatch, {
            type: 'call_dispatch_started',
            role: request.role,
            context: request.context,
            callId: request.context?.call_id,
            callIndex: request.context?.call_index,
            requestedModelRef: request.modelRef,
          });
          return callCli(...args);
        },
      });
      await notify(onFinished, {
        type: 'call_finished',
        role: request.role,
        context: request.context,
        callId: request.context?.call_id,
        callIndex: request.context?.call_index,
        status: 'success',
        dispatchCount: result.call_metadata.dispatch_count,
      });
      return result;
    } catch (error) {
      await notify(onFinished, {
        type: 'call_finished',
        role: request.role,
        context: request.context,
        callId: request.context?.call_id,
        callIndex: request.context?.call_index,
        status: 'technical_failure',
        dispatchCount: Number(error.callMetadata?.dispatch_count || 0),
        error: error.message,
      });
      throw error;
    }
  };

  const analyzePublicText = async ({
    publicModelInput,
    modelRef,
    effort,
    timeoutMs,
    parseMode,
    context,
  }) => {
    await notify(onReached, {
      type: 'call_reached',
      role: 'public_turn_analyzer',
      context,
      callId: context?.call_id,
      callIndex: context?.call_index,
      requestedModelRef: modelRef,
    });
    let latestMetadata = dispatchMetadata({
      modelRef,
      resolved: resolvedAnalyzer,
      effort,
      timeoutMs,
      dispatchCount: 0,
    });
    try {
      if (signal?.aborted) {
        const error = new Error('stateBenchmarkStage1Live: analyzer aborted before CLI process dispatch');
        error.callMetadata = { ...latestMetadata, status: 'technical_failure' };
        throw error;
      }
      const rawAnalysis = await extractTutorStubPublicLearnerAnalysis({
        learnerText: publicModelInput.learnerText,
        topic: publicModelInput.topic,
        world: publicModelInput.world,
        tutorTurn: publicModelInput.tutorTurn,
        currentTutorText: publicModelInput.currentTutorText,
        publicTranscript: publicModelInput.publicTranscript,
        publicStagedEvidence: publicModelInput.publicStagedEvidence,
        priorPublicLearnerState: publicModelInput.priorPublicLearnerState,
        includeBenchmarkTransitionEvent: true,
        parseMode,
        promptContext: publicModelInput.promptContext,
        modelCallOptions: {
          requestedProvider: resolvedAnalyzer.provider,
          requestedModel: modelRef,
          resolvedProvider: resolvedAnalyzer.provider,
          resolvedModel: resolvedAnalyzer.model,
          modelRef,
          effort,
          timeoutMs: Number(timeoutMs),
          retries: 0,
        },
        callModel: async ({ systemPrompt, prompt, role, outputSchema }) => {
          if (signal?.aborted) {
            const error = new Error('stateBenchmarkStage1Live: analyzer aborted before CLI process dispatch');
            error.callMetadata = { ...latestMetadata, status: 'technical_failure' };
            throw error;
          }
          latestMetadata = dispatchMetadata({
            modelRef,
            resolved: resolvedAnalyzer,
            effort,
            timeoutMs,
            dispatchCount: 1,
          });
          try {
            await notify(onDispatch, {
              type: 'call_dispatch_started',
              role: 'public_turn_analyzer',
              context,
              callId: context?.call_id,
              callIndex: context?.call_index,
              requestedModelRef: modelRef,
            });
            const response = await callCli(
              { provider: resolvedAnalyzer.provider, model: resolvedAnalyzer.model },
              systemPrompt,
              prompt,
              role,
              {
                messageHistory: [],
                effort,
                timeoutMs: Number(timeoutMs),
                outputSchema,
                signal,
              },
            );
            const prohibited = prohibitedStreamActivity(response);
            if (prohibited.length) {
              throw new Error(
                `stateBenchmarkStage1Live: prohibited CLI stream activity ${prohibited
                  .map(([type, count]) => `${type}:${count}`)
                  .join(', ')}`,
              );
            }
            latestMetadata = {
              ...latestMetadata,
              status: 'success',
              observed_provider: response.provider || null,
              observed_model: response.model || null,
              observed_model_ref: modelLabel(response.provider, response.model),
              model_attestation_basis: response.modelAttestationBasis || null,
              model_independently_attested: response.modelIndependentlyAttested === true,
              structured_output_reported: response.structuredOutput === true,
              stream_event_type_counts: clone(response.streamEventTypeCounts || {}),
              stream_item_type_counts: clone(response.streamItemTypeCounts || {}),
              structured_event_audit: clone(response.structuredEventAudit || null),
              prohibited_tool_event_count: Number(response.prohibitedToolEventCount || 0),
              invalid_stream_lines: Number(response.invalidStreamLines || 0),
            };
            return { ...response, call_metadata: clone(latestMetadata) };
          } catch (error) {
            error.callMetadata = { ...latestMetadata, status: 'technical_failure' };
            if (typeof error.raw_output !== 'string') error.raw_output = null;
            throw error;
          }
        },
      });
      rawAnalysis.call_metadata.stream_event_type_counts = clone(
        rawAnalysis.callMetadata.injectedCallMetadata?.stream_event_type_counts || {},
      );
      rawAnalysis.call_metadata.stream_item_type_counts = clone(
        rawAnalysis.callMetadata.injectedCallMetadata?.stream_item_type_counts || {},
      );
      rawAnalysis.call_metadata.structured_event_audit = clone(
        rawAnalysis.callMetadata.injectedCallMetadata?.structured_event_audit || null,
      );
      rawAnalysis.call_metadata.prohibited_tool_event_count = Number(
        rawAnalysis.callMetadata.injectedCallMetadata?.prohibited_tool_event_count || 0,
      );
      rawAnalysis.call_metadata.invalid_stream_lines = Number(
        rawAnalysis.callMetadata.injectedCallMetadata?.invalid_stream_lines || 0,
      );
      const split = splitTutorStubPublicLearnerAnalysis(rawAnalysis, {
        strict: true,
        includeBenchmarkTransitionEvent: true,
      });
      const result = {
        rawAnalysis,
        call_metadata: rawAnalysis.call_metadata,
        classification: split.classification,
        learnerRecordUpdate: split.learnerRecordUpdate,
        benchmarkTransitionEvent: split.benchmarkTransitionEvent,
      };
      await notify(onFinished, {
        type: 'call_finished',
        role: 'public_turn_analyzer',
        context,
        callId: context?.call_id,
        callIndex: context?.call_index,
        status: 'success',
        dispatchCount: result.call_metadata.dispatch_count,
      });
      return result;
    } catch (error) {
      if (!error.callMetadata) error.callMetadata = { ...latestMetadata, status: 'technical_failure' };
      await notify(onFinished, {
        type: 'call_finished',
        role: 'public_turn_analyzer',
        context,
        callId: context?.call_id,
        callIndex: context?.call_index,
        status: 'technical_failure',
        dispatchCount: Number(error.callMetadata.dispatch_count || 0),
        error: error.message,
      });
      throw error;
    }
  };

  const postprocessPublicAnalysis = async ({
    analysis,
    publicModelInput,
    deterministicPostprocessorInput,
  }) =>
    postprocessTutorStubPublicLearnerAnalysis({
      rawAnalysis: analysis.rawAnalysis,
      learnerText: publicModelInput.learnerText,
      world: deterministicPostprocessorInput.world,
      tutorTurn: publicModelInput.tutorTurn,
      learnerRecord: deterministicPostprocessorInput.learnerRecord,
      dropout: deterministicPostprocessorInput.dropout,
      parseMode: analyzer.parse_mode,
      promptContext: publicModelInput.promptContext,
      previousObservation: deterministicPostprocessorInput.previousObservation,
      previousTurnRecords: deterministicPostprocessorInput.previousTurnRecords,
      publicStagedEvidence: publicModelInput.publicStagedEvidence,
      publicReleaseLedger: publicModelInput.publicReleaseLedger,
      includeBenchmarkTransitionEvent: true,
    });

  return { realizeTurn, analyzePublicText, postprocessPublicAnalysis };
}

/**
 * Canonical paid-runner entrypoint. Unlike the testable factory above, this
 * surface has no injectable resolver or CLI dispatch seam. The paid runner's
 * frozen source hash and lifecycle ledger therefore bind the real installed
 * resolver/bridge path rather than a caller-supplied substitute.
 */
export function createAdaptiveStateStage1ProductionLiveSeams(options = {}) {
  if ('callCli' in options || 'resolveModelRef' in options) {
    throw new Error('stateBenchmarkStage1Live: production seams do not accept injected CLI or resolver capabilities');
  }
  return createAdaptiveStateStage1LiveSeams({
    ...options,
    callCli: callAIWithCliBridge,
    resolveModelRef: resolveModel,
  });
}
