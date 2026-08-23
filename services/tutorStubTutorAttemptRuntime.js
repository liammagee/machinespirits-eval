import fs from 'node:fs';

function loadFrozenTutorAttemptReplay() {
  const replayPath = String(process.env.TUTOR_STUB_FROZEN_MODEL_CALL_REPLAY_PATH || '').trim();
  if (!replayPath) return null;
  const replay = JSON.parse(fs.readFileSync(replayPath, 'utf8'));
  if (
    replay?.schema !== 'machinespirits.tutor-stub.frozen-model-call-prefix-replay.v1' ||
    !Array.isArray(replay.entries) ||
    replay.entries.length === 0
  ) {
    throw new Error('frozen model-call replay file is invalid');
  }
  return {
    path: replayPath,
    entries: replay.entries.filter((entry) => /^tutor_stub_tutor(?:_|$)/u.test(String(entry?.role || ''))),
    index: 0,
  };
}

function sameJson(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

/**
 * Owns one tutor model-call attempt: prompt/privilege auditing, duplicate-line
 * recovery, provider dispatch, streaming, budget reservations, and the traced
 * response envelope. The tutor-turn pipeline retains sequencing and decides
 * what to do with the resulting candidate.
 */
export function createTutorStubTutorAttemptRuntime(dependencies = {}) {
  const {
    appendTraceEvent,
    auditTutorStubPrompt,
    auditTutorStubSpeakerPrivilege,
    callAI,
    callAIWithCliBridge,
    createConsoleTokenSink,
    isCliProvider,
    jsonClone,
    recoverTutorStubDuplicateInstructionLines,
    reserveProgram2ProviderBudget,
    reserveTutorStubMeteredModelCall,
    streamAI,
    tutorStubCliPolicyRetryDecision,
    waitTutorStubCliPolicyRetryDelay,
  } = dependencies;
  const frozenTutorReplay = loadFrozenTutorAttemptReplay();

  return function bindTutorStubTutorAttemptRuntime(context = {}) {
    const {
      actorialRealizationGuardEnabled,
      cliEffort,
      closureGuardEnabled,
      effectiveSpeakerInstructionTexts,
      effectiveSpeakerSystemPrompt,
      firstDraftContract,
      historyTurns,
      leakGuardEnabled,
      maxTokens,
      messageContext,
      passthrough,
      questionSupportGuardEnabled,
      repetitionGuardEnabled,
      resolved,
      responseCompositionGuardEnabled,
      scaffoldGuardEnabled,
      signal,
      speakerPrivilegeAudit,
      stream,
      systemPrompt,
      temperature,
      trace,
      tutorTurn,
      world,
      dag,
    } = context;
    const messages = context.messages || [];
    let modelCallSequence = 0;

    function nextTutorGuardCallId() {
      return `${tutorTurn}:${++modelCallSequence}`;
    }

    async function invokeTutorAttempt({
      attemptUserPrompt,
      role,
      streamMode = 'none',
      repairAttempt = 0,
      systemPromptOverride = null,
      instructionTextsOverride = null,
      privilegeAdvisoryOverride = null,
    }) {
      const instructionTexts =
        instructionTextsOverride || (passthrough ? [systemPrompt] : effectiveSpeakerInstructionTexts);
      let attemptSystemPrompt = systemPromptOverride || effectiveSpeakerSystemPrompt;
      let effectiveAttemptUserPrompt = attemptUserPrompt;
      let effectiveInstructionTexts = instructionTexts;
      let attemptSpeakerPrivilegeAudit = speakerPrivilegeAudit;
      if (!passthrough && (systemPromptOverride || instructionTextsOverride)) {
        attemptSpeakerPrivilegeAudit = auditTutorStubSpeakerPrivilege({
          world: dag ? world : null,
          tutorTurn,
          systemPrompt: attemptSystemPrompt,
          privateAdvisory:
            privilegeAdvisoryOverride === null
              ? effectiveInstructionTexts.slice(1).join('\n\n')
              : privilegeAdvisoryOverride,
        });
        appendTraceEvent(trace, {
          type: 'tutor_speaker_privilege_audit',
          role,
          turn: tutorTurn,
          repairAttempt,
          audit: attemptSpeakerPrivilegeAudit,
        });
        if (!attemptSpeakerPrivilegeAudit.ok) {
          const error = new Error(
            `Tutor recovery prompt crossed the private-planner boundary: ${attemptSpeakerPrivilegeAudit.issues
              .map((issue) => `${issue.code}:${issue.source}`)
              .join(', ')}`,
          );
          error.code = 'TUTOR_RECOVERY_SPEAKER_PRIVILEGE_FAILED';
          error.speakerPrivilegeAudit = attemptSpeakerPrivilegeAudit;
          throw error;
        }
      }
      let promptAudit = passthrough
        ? {
            schema: 'machinespirits.tutor-stub.prompt-audit.v1',
            surface: 'tutor_turn_passthrough',
            ok: true,
            bypassed: true,
            reason: 'preserve_exact_system_history_and_user_payload',
            violations: [],
            duplicateInstructionLines: [],
          }
        : auditTutorStubPrompt({
            surface: 'tutor_turn',
            systemPrompt: attemptSystemPrompt,
            userPrompt: effectiveAttemptUserPrompt,
            messageHistory: messages,
            instructionTexts: effectiveInstructionTexts,
          });
      const duplicateOnlyFailure =
        !passthrough &&
        !promptAudit.ok &&
        promptAudit.duplicateInstructionLines?.length > 0 &&
        promptAudit.violations.every((violation) => violation.code === 'duplicate_instruction_lines');
      if (duplicateOnlyFailure) {
        const originalAudit = promptAudit;
        const actualPromptRecovery = recoverTutorStubDuplicateInstructionLines({
          texts: [attemptSystemPrompt, effectiveAttemptUserPrompt],
          duplicateInstructionLines: originalAudit.duplicateInstructionLines,
        });
        const instructionRecovery = recoverTutorStubDuplicateInstructionLines({
          texts: effectiveInstructionTexts,
          duplicateInstructionLines: originalAudit.duplicateInstructionLines,
        });
        [attemptSystemPrompt, effectiveAttemptUserPrompt] = actualPromptRecovery.texts;
        effectiveInstructionTexts = instructionRecovery.texts;
        const recoveredAudit = auditTutorStubPrompt({
          surface: 'tutor_turn',
          systemPrompt: attemptSystemPrompt,
          userPrompt: effectiveAttemptUserPrompt,
          messageHistory: messages,
          instructionTexts: effectiveInstructionTexts,
        });
        const recovery = {
          applied: actualPromptRecovery.applied && instructionRecovery.applied && recoveredAudit.ok,
          method: 'deduplicate_exact_instruction_lines',
          originalDuplicateInstructionLines: originalAudit.duplicateInstructionLines,
          removedPromptLineCount: actualPromptRecovery.removedLines.length,
          removedInstructionLineCount: instructionRecovery.removedLines.length,
        };
        promptAudit = { ...recoveredAudit, recovery };
        appendTraceEvent(trace, {
          type: 'prompt_audit_recovery',
          role,
          turn: tutorTurn,
          repairAttempt,
          recovery,
          audit: promptAudit,
        });
      }
      if (!promptAudit.ok) {
        appendTraceEvent(trace, {
          type: 'prompt_audit_failed',
          role,
          turn: tutorTurn,
          repairAttempt,
          audit: promptAudit,
        });
        const error = new Error(
          `Tutor prompt audit failed: ${promptAudit.violations.map((violation) => violation.code).join(', ')}${
            promptAudit.duplicateInstructionLines?.length
              ? `; repeated instruction: ${promptAudit.duplicateInstructionLines[0].line}`
              : ''
          }`,
        );
        error.code = 'TUTOR_PROMPT_AUDIT_FAILED';
        error.promptAudit = promptAudit;
        throw error;
      }
      const request = {
        systemPrompt: attemptSystemPrompt,
        messages: [...messages, { role: 'user', content: effectiveAttemptUserPrompt }],
        config: {
          temperature,
          maxTokens,
          historyTurns,
          leakGuard: leakGuardEnabled,
          scaffoldGuard: scaffoldGuardEnabled,
          questionSupportGuard: questionSupportGuardEnabled,
          actorialRealizationGuard: actorialRealizationGuardEnabled,
          responseCompositionGuard: responseCompositionGuardEnabled,
          repetitionGuard: repetitionGuardEnabled,
          closureGuard: closureGuardEnabled,
          repairAttempt,
          messageHistoryMode: messageContext.historyMode,
          availableMessageCount: messageContext.availableMessageCount,
          replayedMessageCount: messageContext.replayedMessageCount,
          replayedUserMessageCount: messageContext.userMessageCount,
          replayedAssistantMessageCount: messageContext.assistantMessageCount,
          contextActivatedBy: messageContext.activatedBy,
          firstDraftContractSchema: firstDraftContract?.schema || null,
          firstDraftCompatibilityDecisions: firstDraftContract?.compatibility?.decisions || [],
          passthrough,
          promptAudit,
          speakerPrivilegeAudit: attemptSpeakerPrivilegeAudit,
        },
      };
      if (cliEffort) request.config.cliEffort = cliEffort;
      const useStreamingApi = streamMode === 'live' || streamMode === 'buffered';
      function reserveTutorAttemptBudget() {
        reserveProgram2ProviderBudget({ maxTokens, trace, role, turn: tutorTurn });
        reserveTutorStubMeteredModelCall({ trace, role, turn: tutorTurn });
      }
      let startedAt = null;
      let response;
      if (frozenTutorReplay && frozenTutorReplay.index < frozenTutorReplay.entries.length) {
        const entry = frozenTutorReplay.entries[frozenTutorReplay.index];
        const matches =
          entry.role === role &&
          entry.turn === tutorTurn &&
          entry.provider === resolved.provider &&
          entry.model === resolved.model &&
          sameJson(entry.request, request);
        if (!matches) {
          throw new Error(
            `frozen tutor-attempt replay drift at entry ${frozenTutorReplay.index + 1}: expected ${entry.role} turn ${entry.turn}, received ${role} turn ${tutorTurn}`,
          );
        }
        frozenTutorReplay.index += 1;
        response = {
          ...entry.response,
          provider: entry.provider,
          model: entry.model,
          reasoningEffort: entry.response?.effort || null,
        };
        appendTraceEvent(trace, {
          type: 'model_call_replayed_from_frozen_prefix',
          role,
          turn: tutorTurn,
          replayPath: frozenTutorReplay.path,
          replayEntry: frozenTutorReplay.index,
          provider: entry.provider,
          model: entry.model,
          publicTranscriptChanged: false,
        });
      } else if (isCliProvider(resolved.provider)) {
        async function dispatchCliTutorAttempt({ cliPolicyRetryCount = 0 } = {}) {
          startedAt = new Date().toISOString();
          reserveTutorAttemptBudget();
          try {
            const result = await callAIWithCliBridge(
              { provider: resolved.provider, model: resolved.model },
              attemptSystemPrompt,
              effectiveAttemptUserPrompt,
              role,
              { messageHistory: messages, effort: cliEffort, signal },
            );
            return {
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
            };
          } catch (err) {
            const retryDecision = tutorStubCliPolicyRetryDecision(err, { retryCount: cliPolicyRetryCount });
            appendTraceEvent(trace, {
              type: err?.name === 'AbortError' ? 'model_call_aborted' : 'model_call_error',
              role,
              turn: tutorTurn,
              startedAt,
              provider: resolved.provider,
              model: resolved.model,
              request,
              error: err.message,
              ...(err?.code === 'CLI_PROVIDER_POLICY_VIOLATION' || err?.code === 'CLI_PROVIDER_TURN_FAILED'
                ? { cliPolicyViolation: retryDecision }
                : {}),
            });
            err.tutorAttemptModelCallErrorTraced = true;
            if (retryDecision.retry) {
              appendTraceEvent(trace, {
                type: 'cli_policy_retry_decision',
                role,
                turn: tutorTurn,
                decision: retryDecision,
                publicTranscriptChanged: false,
              });
              await waitTutorStubCliPolicyRetryDelay(retryDecision.delay_ms, { signal });
              return dispatchCliTutorAttempt({ cliPolicyRetryCount: cliPolicyRetryCount + 1 });
            }
            throw err;
          }
        }
        response = await dispatchCliTutorAttempt();
      } else {
        startedAt = new Date().toISOString();
        reserveTutorAttemptBudget();
      }
      if (!isCliProvider(resolved.provider) && useStreamingApi) {
        const sink = streamMode === 'live' ? createConsoleTokenSink(role, stream?.interim) : null;
        let final = null;
        for await (const chunk of streamAI({
          provider: resolved.provider,
          model: resolved.model,
          systemPrompt: attemptSystemPrompt,
          messages: request.messages,
          preset: 'socratic',
          config: { temperature, maxTokens },
        })) {
          if (chunk.type === 'text_delta') {
            if (sink) sink.write(chunk.content);
          } else if (chunk.type === 'done') {
            final = chunk;
          }
        }
        const streamed = sink ? sink.finish() : false;
        response = {
          text: final?.content || '',
          provider: final?.provider || resolved.provider,
          model: final?.model || resolved.model,
          latencyMs: final?.latencyMs || 0,
          usage: final?.usage || null,
          streamed,
          generatedWithStreaming: true,
          bufferedStream: streamMode === 'buffered',
        };
      } else if (!isCliProvider(resolved.provider)) {
        const result = await callAI({
          provider: resolved.provider,
          model: resolved.model,
          systemPrompt: attemptSystemPrompt,
          messages: request.messages,
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

      response.guardCallId = nextTutorGuardCallId();
      response.guardRole = role;
      response.firstDraftContract = firstDraftContract ? jsonClone(firstDraftContract) : null;
      response.promptSnapshot = {
        systemPrompt: attemptSystemPrompt,
        userPrompt: effectiveAttemptUserPrompt,
        messageHistory: messages,
        role,
        repairAttempt,
        config: request.config,
        promptAudit,
        speakerPrivilegeAudit: attemptSpeakerPrivilegeAudit,
        firstDraftContract: response.firstDraftContract,
      };
      appendTraceEvent(trace, {
        type: 'model_call',
        role,
        turn: tutorTurn,
        startedAt,
        provider: response.provider,
        model: response.model,
        request,
        response: {
          text: response.text,
          latencyMs: response.latencyMs,
          usage: response.usage,
          tokenUsageAvailable: response.tokenUsageAvailable,
          streamed: Boolean(response.streamed),
          effort: response.effort || response.reasoningEffort || null,
        },
      });
      return response;
    }

    return { invokeTutorAttempt, nextTutorGuardCallId };
  };
}
