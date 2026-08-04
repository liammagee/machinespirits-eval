export function createTutorStubPromptTransport(dependencies) {
  const {
    C,
    appendTraceEvent,
    auditTutorStubPrompt,
    callAI,
    callAIWithCliBridge,
    clearStatusLine,
    compactTutorStubPublicMessagesForBudget,
    createTutorStubConsoleTokenSink,
    effectiveTemperatureForModel,
    getInterimState,
    isCliProvider,
    providerSupportsStreaming,
    recoverTutorStubDuplicateInstructionLines,
    renderTutorStubStreamLabel,
    replayTutorStubTextAsConsoleStream,
    reserveProgram2ProviderBudget,
    reserveTutorStubMeteredModelCall,
    stopInterimAnimation,
    streamAI,
    tutorStubCliPolicyRetryDecision,
    tutorStubPromptSurfaceForRole,
    write,
  } = dependencies;

  async function callPromptModel({
    prompt: promptInput,
    messageHistory = [],
    resolved,
    systemPrompt: systemPromptInput,
    role,
    maxTokens = 700,
    trace = null,
    stream = null,
    cliEffort = null,
    turn = null,
    signal = null,
    historyTurns = null,
  }) {
    let prompt = promptInput;
    let systemPrompt = systemPromptInput;
    const startedAt = new Date().toISOString();
    const shouldStream = Boolean(stream?.enabled && !stream?.deferOutput && providerSupportsStreaming(resolved));
    let publicMessageHistory = (Array.isArray(messageHistory) ? messageHistory : []).map((message) => ({
      role: message?.role === 'assistant' ? 'assistant' : 'user',
      content: String(message?.content || ''),
    }));
    let promptAudit = auditTutorStubPrompt({
      surface: tutorStubPromptSurfaceForRole(role),
      systemPrompt,
      userPrompt: prompt,
      messageHistory: publicMessageHistory,
    });
    const budgetViolationCodes = new Set(['character_budget_exceeded', 'approximate_token_budget_exceeded']);
    const hasBudgetViolation = promptAudit.violations.some((violation) => budgetViolationCodes.has(violation.code));
    if (role === 'tutor_stub_auto_learner' && hasBudgetViolation && historyTurns !== null) {
      const originalAudit = promptAudit;
      const nonHistoryText = [systemPrompt, prompt].filter(Boolean).join('\n\n');
      const historyBoundaryChars = nonHistoryText ? 2 : 0;
      const compaction = compactTutorStubPublicMessagesForBudget(publicMessageHistory, {
        maxHistoryChars: Math.max(0, originalAudit.budget.maxChars - nonHistoryText.length - historyBoundaryChars),
        recentTurns: historyTurns,
      });
      if (compaction.applied) {
        publicMessageHistory = compaction.messages;
        const recoveredAudit = auditTutorStubPrompt({
          surface: tutorStubPromptSurfaceForRole(role),
          systemPrompt,
          userPrompt: prompt,
          messageHistory: publicMessageHistory,
        });
        const budgetRecovered = recoveredAudit.violations.every(
          (violation) => !budgetViolationCodes.has(violation.code),
        );
        appendTraceEvent(trace, {
          type: 'prompt_audit_recovery',
          role,
          turn,
          recovery: {
            applied: budgetRecovered,
            method: 'budget_window_public_history',
            historyMode: compaction.historyMode,
            availableMessageCount: compaction.availableMessageCount,
            replayedMessageCount: compaction.replayedMessageCount,
            omittedMessageCount: compaction.omittedMessageCount,
            originalHistoryChars: compaction.originalChars,
            replayedHistoryChars: compaction.replayedChars,
            recentTurns: compaction.recentTurns,
            maxHistoryChars: compaction.maxHistoryChars,
            originalViolations: originalAudit.violations,
          },
          audit: recoveredAudit,
        });
        if (budgetRecovered) {
          promptAudit = {
            ...recoveredAudit,
            recovery: {
              applied: true,
              method: 'budget_window_public_history',
              omittedMessageCount: compaction.omittedMessageCount,
            },
          };
        }
      }
    }
    // Backport of the Phase 5b Amendment-1 pinned-runtime patch
    // (committee-runtime-main-reconciliation): endgame dialogue naturally
    // repeats the verdict sentence across prompt sections, and a duplicate-only
    // audit failure is recoverable by deduplication — exactly as
    // invokeTutorAttempt already recovers — instead of a fatal that kills a
    // nearly-complete dialogue.
    const duplicateOnlyPromptFailure =
      !promptAudit.ok &&
      promptAudit.duplicateInstructionLines?.length > 0 &&
      promptAudit.violations.every((violation) => violation.code === 'duplicate_instruction_lines');
    if (duplicateOnlyPromptFailure) {
      const originalAudit = promptAudit;
      const recovery = recoverTutorStubDuplicateInstructionLines({
        texts: [systemPrompt, prompt],
        duplicateInstructionLines: originalAudit.duplicateInstructionLines,
      });
      [systemPrompt, prompt] = recovery.texts;
      const recoveredAudit = auditTutorStubPrompt({
        surface: tutorStubPromptSurfaceForRole(role),
        systemPrompt,
        userPrompt: prompt,
        messageHistory: publicMessageHistory,
      });
      appendTraceEvent(trace, {
        type: 'prompt_audit_recovery',
        role,
        turn,
        recovery: {
          applied: recovery.applied && recoveredAudit.ok,
          method: 'deduplicate_exact_instruction_lines',
          originalDuplicateInstructionLines: originalAudit.duplicateInstructionLines,
          removedPromptLineCount: recovery.removedLines.length,
        },
        audit: recoveredAudit,
      });
      if (recoveredAudit.ok) promptAudit = { ...recoveredAudit, recovery: { applied: true } };
    }
    const requestMessages = [...publicMessageHistory, { role: 'user', content: prompt }];
    if (!promptAudit.ok) {
      appendTraceEvent(trace, {
        type: 'prompt_audit_failed',
        role,
        turn,
        audit: promptAudit,
      });
      throw new Error(
        `Prompt audit failed for ${role}: ${promptAudit.violations.map((violation) => violation.code).join(', ')}`,
      );
    }
    reserveProgram2ProviderBudget({ maxTokens, trace, role, turn });
    reserveTutorStubMeteredModelCall({ trace, role, turn });
    try {
      let response;
      if (isCliProvider(resolved.provider)) {
        const onEvent =
          resolved.provider === 'codex'
            ? (event) => {
                const item = event?.item || {};
                appendTraceEvent(trace, {
                  type: 'cli_stream_event',
                  role,
                  turn,
                  eventType: event?.type || 'unknown',
                  itemType: item?.type || null,
                });
                if (!stream?.enabled) return;
                const active = getInterimState(stream?.interim)?.active;
                if (!active) return;
                const phase =
                  event?.type === 'thread.started'
                    ? 'starting Codex'
                    : event?.type === 'turn.started'
                      ? 'model working'
                      : event?.type === 'item.started' && item?.type
                        ? item.type.replaceAll('_', ' ')
                        : event?.type === 'item.completed' && item?.type === 'agent_message'
                          ? 'finalizing result'
                          : null;
                if (phase) active.phase = `${active.basePhase || active.phase} · ${phase}`;
              }
            : null;
        const result = await callAIWithCliBridge(
          { provider: resolved.provider, model: resolved.model },
          systemPrompt,
          prompt,
          role,
          { messageHistory: publicMessageHistory, effort: cliEffort, onEvent, signal },
        );
        response = {
          text: result.text,
          provider: result.provider,
          model: result.model,
          latencyMs: result.latencyMs,
          usage: {
            inputTokens: result.inputTokens || 0,
            outputTokens: result.outputTokens || 0,
            totalTokens: (result.inputTokens || 0) + (result.outputTokens || 0),
            cost: result.cost || 0,
          },
          effort: result.effort || result.reasoningEffort || null,
          reasoningEffort: result.reasoningEffort || result.effort || null,
          tokenUsageAvailable: result.tokenUsageAvailable,
          streamedEvents: result.streamedEvents || 0,
          invalidStreamLines: result.invalidStreamLines || 0,
          outputSource: result.outputSource || null,
        };
      } else if (shouldStream) {
        const temperature = effectiveTemperatureForModel(resolved, 0.1);
        const sink = createConsoleTokenSink(role, stream?.interim);
        let final = null;
        for await (const chunk of streamAI({
          provider: resolved.provider,
          model: resolved.model,
          systemPrompt,
          messages: requestMessages,
          preset: 'socratic',
          config: { temperature, maxTokens },
        })) {
          if (chunk.type === 'text_delta') {
            sink.write(chunk.content);
          } else if (chunk.type === 'done') {
            final = chunk;
          }
        }
        const streamed = sink.finish();
        response = {
          text: final?.content || '',
          provider: final?.provider || resolved.provider,
          model: final?.model || resolved.model,
          latencyMs: final?.latencyMs || 0,
          usage: final?.usage || null,
          streamed,
        };
      } else {
        const temperature = effectiveTemperatureForModel(resolved, 0.1);
        const result = await callAI({
          provider: resolved.provider,
          model: resolved.model,
          systemPrompt,
          messages: requestMessages,
          preset: 'socratic',
          config: { temperature, maxTokens },
        });
        response = {
          text: result.content,
          provider: result.provider,
          model: result.model,
          latencyMs: result.latencyMs,
          usage: result.usage,
        };
      }

      response.promptSnapshot = {
        systemPrompt,
        userPrompt: prompt,
        messageHistory: publicMessageHistory,
        role,
        promptAudit,
      };
      appendTraceEvent(trace, {
        type: 'model_call',
        role,
        turn,
        startedAt,
        provider: response.provider,
        model: response.model,
        request: {
          systemPrompt,
          prompt,
          messageHistory: publicMessageHistory,
          messages: requestMessages,
          maxTokens,
          cliEffort,
          promptAudit,
        },
        response: {
          text: response.text,
          latencyMs: response.latencyMs,
          usage: response.usage,
          streamed: Boolean(response.streamed),
          effort: response.effort || response.reasoningEffort || null,
          streamedEvents: response.streamedEvents || 0,
          invalidStreamLines: response.invalidStreamLines || 0,
          outputSource: response.outputSource || null,
        },
      });
      response.promptAudit = promptAudit;
      return response;
    } catch (err) {
      appendTraceEvent(trace, {
        type: err?.name === 'AbortError' ? 'model_call_aborted' : 'model_call_error',
        role,
        turn,
        startedAt,
        provider: resolved.provider,
        model: resolved.model,
        request: {
          systemPrompt,
          prompt,
          messageHistory: publicMessageHistory,
          messages: requestMessages,
          maxTokens,
          promptAudit,
        },
        error: err.message,
        ...(err?.code === 'CLI_PROVIDER_POLICY_VIOLATION'
          ? { cliPolicyViolation: tutorStubCliPolicyRetryDecision(err, { alreadyUsed: true }) }
          : {}),
      });
      throw err;
    }
  }

  function streamLabel(role) {
    return renderTutorStubStreamLabel(role, C);
  }

  function createConsoleTokenSink(role, interim = null) {
    return createTutorStubConsoleTokenSink({
      role,
      interim,
      resolveInterimState: getInterimState,
      stopInterimAnimation,
      clearStatusLine,
      write: write,
      renderLabel: streamLabel,
    });
  }

  function replayTextAsConsoleStream(role, text, stream = null) {
    return replayTutorStubTextAsConsoleStream(role, text, stream, { createSink: createConsoleTokenSink });
  }

  function printTutorResponse(response, stream = null) {
    if (response.guardedStreamReplay) {
      response.streamed = replayTextAsConsoleStream('tutor_stub_tutor', response.text, stream);
      return;
    }
    if (!response.streamed) {
      console.log(`${C.brightMagenta}${C.bold}tutor >${C.reset} ${response.text.trim()}`);
    }
  }

  return {
    callPromptModel,
    createConsoleTokenSink,
    printTutorResponse,
  };
}
