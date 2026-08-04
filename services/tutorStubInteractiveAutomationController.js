export function createTutorStubInteractiveAutomationController(dependencies) {
  const {
    C,
    DEFAULT_INTERACTIVE_DEMO_TURNS,
    MAX_INTERACTIVE_DEMO_TURNS,
    ROOT,
    appendTraceEvent,
    args,
    assertTutorStubTurnAttemptCurrent,
    autoLearnerProviderConfig,
    autoLearnerResolved,
    autoSafetyTurns,
    autoStopOnGrounded,
    clearStatusLine,
    clearTutorStubTurnFeedbackTarget,
    cliEffort,
    getActiveAutoRun,
    getActiveLearnerTurn,
    getPendingAutoRequest,
    interactionModeLabel,
    isAwaitingAnotherScenario,
    isCliProvider,
    isExiting,
    isInteractiveDemoRunning,
    isProcessingTurn,
    latestTutorMessage,
    mixedLearner,
    mixedLearnerPromptText,
    nextPendingAutoRequestSequence,
    offerAnotherScenario,
    openingEnabled,
    path,
    pendingLearnerLines,
    printCurrentTurnAnalysis,
    printDialogueCloseout,
    printWithConcurrentTerminal,
    resetMixedLearnerSuggestion,
    rl,
    runAutomatedLearnerDialogue,
    setActiveAutoRun,
    setInteractionMode,
    setInteractiveDemoRunning,
    setPendingAutoRequest,
    setProcessingTurn,
    state,
    stateRunDebugId,
    tutorStubRegisterPolicyStackId,
    tutorStubTurnFeedbackEnvelope,
    writeCurrentTranscriptHtml,
  } = dependencies;

  function parseInteractiveAutoTurns(value) {
    const raw = String(value || '')
      .trim()
      .toLowerCase();
    if (!raw || ['until-grounded', 'grounded', 'all'].includes(raw)) return null;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isInteger(parsed) || parsed <= 0 || String(parsed) !== raw) {
      throw new Error('auto expects a positive turn count or until-grounded');
    }
    return parsed;
  }

  function parseInteractiveDemoTurns(value) {
    const raw = String(value || '').trim();
    if (!raw) return DEFAULT_INTERACTIVE_DEMO_TURNS;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isInteger(parsed) || parsed <= 0 || String(parsed) !== raw) {
      throw new Error(`demo expects a whole-number turn count from 1 to ${MAX_INTERACTIVE_DEMO_TURNS}`);
    }
    if (parsed > MAX_INTERACTIVE_DEMO_TURNS) {
      throw new Error(`demo is capped at ${MAX_INTERACTIVE_DEMO_TURNS} turns; use /auto for a longer run`);
    }
    return parsed;
  }

  async function runInteractiveDemo(argument = '', { duringTurn = false, source = 'slash' } = {}) {
    clearStatusLine();
    if (state.passthrough?.enabled) {
      console.log(
        `${C.dim}the guided harness demonstration is unavailable in passthrough mode because the harness is intentionally bypassed${C.reset}\n`,
      );
      return { started: false, reason: 'passthrough' };
    }
    if (duringTurn || isProcessingTurn() || isInteractiveDemoRunning()) {
      console.log(
        `${C.dim}demonstration not started; run /demo again after the current tutor response completes${C.reset}\n`,
      );
      return { started: false, reason: 'busy' };
    }
    if (!latestTutorMessage(state)) {
      console.log(`${C.dim}the demonstration needs a visible tutor opening; use /reset, then /demo${C.reset}\n`);
      return { started: false, reason: 'no_tutor_message' };
    }

    let requestedTurns;
    try {
      requestedTurns = parseInteractiveDemoTurns(argument);
    } catch (error) {
      console.log(`${C.red}demo error:${C.reset} ${error.message}\n`);
      return { started: false, reason: 'invalid_turn_count' };
    }

    const startingTurns = state.turns.length;
    const policy = tutorStubRegisterPolicyStackId(state.register?.policy, state.register?.overlays);
    const enabledMechanisms = [
      state.classifier?.enabled ? 'learner interpretation' : null,
      state.learnerDag?.enabled ? 'reasoning-map tracking' : null,
      state.register?.enabled ? 'adaptive teaching style and character' : null,
      state.dag ? 'authored evidence DAG' : null,
      'response checks',
      'trace and report evidence',
    ].filter(Boolean);
    const disabledCoreMechanisms = [
      !state.classifier?.enabled ? 'learner interpretation' : null,
      !state.learnerDag?.enabled ? 'reasoning-map tracking' : null,
      !state.register?.enabled ? 'adaptive teaching style' : null,
      !state.dag ? 'authored evidence DAG' : null,
    ].filter(Boolean);

    setInteractiveDemoRunning(true);
    appendTraceEvent(state.trace, {
      type: 'interactive_harness_demo_started',
      schema: 'machinespirits.tutor-stub.interactive-harness-demo.v1',
      source,
      requestedTurns,
      startingTurns,
      worldId: state.world?.id || null,
      learnerProfileId: mixedLearner.profileId || state.learnerProfileId || null,
      tutorRef: state.tuning?.activeRef || null,
      policy,
      enabledMechanisms,
      publicTranscriptChanged: false,
    });

    console.log(
      `${C.brightCyan}${C.bold}╭─ guided harness demonstration${C.reset} ${C.dim}· ${requestedTurns} live turn${requestedTurns === 1 ? '' : 's'}${C.reset}`,
    );
    console.log(`${C.cyan}│  1 · dialogue${C.reset}       the automated learner and tutor continue the public scene`);
    console.log(
      `${C.cyan}│  2 · interpretation${C.reset} the harness reads progress and chooses the next teaching action`,
    );
    console.log(
      `${C.cyan}│  3 · evidence${C.reset}       the transcript, prompts, settings, analysis, and replay are preserved`,
    );
    console.log(
      `${C.cyan}╰─ configuration${C.reset}   ${state.world?.title || state.topic} · ${state.tuning?.activeRef || state.tutorInstance?.id || 'tutor'} · ${mixedLearner.profileId || state.learnerProfileId || 'learner'} · ${policy}`,
    );
    console.log(`${C.dim}  active: ${enabledMechanisms.join(' · ')}${C.reset}`);
    if (disabledCoreMechanisms.length) {
      console.log(
        `${C.yellow}  limited tour:${C.reset} ${disabledCoreMechanisms.join(', ')} ${disabledCoreMechanisms.length === 1 ? 'is' : 'are'} off in this session`,
      );
    }
    console.log(`${C.dim}  commands remain live while the models work; /reset cancels safely${C.reset}\n`);

    let transcript = null;
    let report = null;
    let demoError = null;
    try {
      const autoOutcome = await runInteractiveAutoMode(String(requestedTurns), { duringTurn: false });
      if (autoOutcome?.reason === 'cancelled') {
        appendTraceEvent(state.trace, {
          type: 'interactive_harness_demo_cancelled',
          schema: 'machinespirits.tutor-stub.interactive-harness-demo.v1',
          source,
          requestedTurns,
          startingTurns,
          endingTurns: state.turns.length,
          reason: autoOutcome.cancelledReason || 'cancelled',
          publicTranscriptChanged: false,
        });
        console.log(
          `${C.yellow}${C.bold}demonstration cancelled >${C.reset} ${autoOutcome.cancelledReason || 'control returned'}\n`,
        );
        return { started: true, reason: 'cancelled' };
      }
      if (autoOutcome?.reason === 'error') throw new Error(autoOutcome.error || 'automated demonstration failed');
      if (autoOutcome?.started === false) throw new Error('automated demonstration could not start');
      const completedTurns = Math.max(0, state.turns.length - startingTurns);

      console.log(`${C.brightCyan}${C.bold}demo readout · learner interpretation${C.reset}`);
      if (state.turns.length) printCurrentTurnAnalysis(state, { technical: false });
      else console.log(`${C.dim}  no tutor turn completed, so there is no learner interpretation to show${C.reset}\n`);

      console.log(`${C.brightCyan}${C.bold}demo readout · inspectable evidence${C.reset}`);
      transcript = writeCurrentTranscriptHtml({ launch: true, duringTurn: false });
      report = printDialogueCloseout(state, { reason: 'interactive_demo', trace: state.trace });

      appendTraceEvent(state.trace, {
        type: 'interactive_harness_demo_completed',
        schema: 'machinespirits.tutor-stub.interactive-harness-demo.v1',
        source,
        requestedTurns,
        startingTurns,
        completedTurns,
        endingTurns: state.turns.length,
        transcript: transcript?.filePath ? path.relative(ROOT, transcript.filePath) : null,
        transcriptLaunched: Boolean(transcript?.launched),
        reportAvailable: Boolean(report),
        closurePhase: state.dialogueClosure?.phase || null,
        publicTranscriptChanged: false,
      });

      console.log(
        `${C.brightGreen}${C.bold}demonstration complete >${C.reset} ${completedTurns} new turn${completedTurns === 1 ? '' : 's'} · control returned`,
      );
      console.log(
        `${C.dim}  ${
          state.dialogueClosure?.phase === 'closed'
            ? 'the inquiry reached closure; choose another scenario or finish the session'
            : 'continue as the learner, use ←/→ to rate the latest tutor response, inspect /analysis technical, or run /demo again'
        }${C.reset}\n`,
      );
      return { started: true, completedTurns, transcript, report };
    } catch (error) {
      demoError = error;
      appendTraceEvent(state.trace, {
        type: 'interactive_harness_demo_failed',
        schema: 'machinespirits.tutor-stub.interactive-harness-demo.v1',
        source,
        requestedTurns,
        startingTurns,
        endingTurns: state.turns.length,
        error: error.message,
        publicTranscriptChanged: false,
      });
      console.log(`${C.red}demo error:${C.reset} ${error.message}\n`);
      return { started: true, reason: 'failed', error: error.message };
    } finally {
      setInteractiveDemoRunning(false);
      if (demoError && state.interaction?.mode === 'auto') {
        setInteractionMode(state.interaction.previousMode === 'coach' ? 'coach' : 'learner', { announce: false });
      }
    }
  }

  function interactiveAutoTurnLabel(requestedTurns) {
    return requestedTurns === null
      ? `until grounded · safety cap ${autoSafetyTurns}`
      : `${requestedTurns} turn${requestedTurns === 1 ? '' : 's'}`;
  }

  function discardPendingInteractiveAuto(reason, { source = null, announce = false } = {}) {
    const pending = getPendingAutoRequest();
    if (!pending) return null;
    setPendingAutoRequest(null);
    appendTraceEvent(state.trace, {
      type: 'interactive_auto_queue_discarded',
      requestId: pending.id,
      reason,
      source: source || pending.source,
      afterTurn: pending.afterTurn,
      requestedTurns: pending.requestedTurns,
      publicTranscriptChanged: false,
    });
    if (announce) {
      console.log(
        `${C.dim}queued auto handoff cancelled · ${String(reason || 'cancelled').replaceAll('_', ' ')}${C.reset}\n`,
      );
    }
    return pending;
  }

  function queuePendingInteractiveAuto({ argument = '', requestedTurns = null, source = '/auto' } = {}) {
    const previous = getPendingAutoRequest();
    const queuedLearnerLinesDiscarded = pendingLearnerLines.length;
    pendingLearnerLines.length = 0;
    const pending = {
      id: `${stateRunDebugId(state)}:auto-queue:${nextPendingAutoRequestSequence()}`,
      argument: String(argument || '').trim(),
      requestedTurns,
      source,
      afterTurn: getActiveLearnerTurn()?.turn || state.turns.length + 1,
      queuedAt: new Date().toISOString(),
    };
    setPendingAutoRequest(pending);
    appendTraceEvent(state.trace, {
      type: 'interactive_auto_queued',
      requestId: pending.id,
      source,
      afterTurn: pending.afterTurn,
      requestedTurns,
      safetyTurns: autoSafetyTurns,
      replacedRequestId: previous?.id || null,
      queuedLearnerLinesDiscarded,
      publicTranscriptChanged: false,
    });
    console.log(
      `${C.brightBlue}${C.bold}auto queued >${C.reset} starts after tutor turn ${pending.afterTurn} · ${interactiveAutoTurnLabel(
        requestedTurns,
      )}`,
    );
    if (previous) console.log(`${C.dim}  replaced the earlier queued auto request${C.reset}`);
    if (queuedLearnerLinesDiscarded) {
      console.log(
        `${C.dim}  discarded ${queuedLearnerLinesDiscarded} queued manual learner turn${queuedLearnerLinesDiscarded === 1 ? '' : 's'} because auto now owns the handoff${C.reset}`,
      );
    }
    console.log(`${C.dim}  /mode learner, /mode coach, /reset, or /quit cancels this handoff${C.reset}\n`);
    return { started: false, queued: true, reason: 'queued', requestId: pending.id };
  }

  function startPendingInteractiveAuto({ afterTurn, reason = 'tutor_response_completed' } = {}) {
    const pending = getPendingAutoRequest();
    if (!pending) return false;
    setPendingAutoRequest(null);
    appendTraceEvent(state.trace, {
      type: 'interactive_auto_queue_started',
      requestId: pending.id,
      source: pending.source,
      afterTurn: afterTurn || pending.afterTurn,
      requestedTurns: pending.requestedTurns,
      reason,
      publicTranscriptChanged: false,
    });
    void runInteractiveAutoMode(pending.argument, {
      duringTurn: false,
      source: pending.source,
      queuedRequestId: pending.id,
    });
    return true;
  }

  async function runInteractiveAutoMode(
    argument = '',
    { duringTurn = false, source = '/auto', queuedRequestId = null } = {},
  ) {
    clearStatusLine();
    let requestedTurns;
    try {
      requestedTurns = parseInteractiveAutoTurns(argument);
    } catch (error) {
      console.log(`${C.red}auto mode error:${C.reset} ${error.message}\n`);
      return { started: false, reason: 'invalid_turn_count', error: error.message };
    }
    const activeAutoLearnerResolved = state.autoLearner?.resolved || autoLearnerResolved;
    const activeAutoLearnerProviderConfig = state.autoLearner?.providerConfig || autoLearnerProviderConfig;
    if (!activeAutoLearnerResolved?.isConfigured && !isCliProvider(activeAutoLearnerResolved?.provider)) {
      const envName = activeAutoLearnerProviderConfig?.api_key_env || 'provider API key';
      console.log(
        `${C.red}auto mode error:${C.reset} ${args['auto-learner-model']} is not configured; set ${envName}\n`,
      );
      return { started: false, reason: 'model_not_configured' };
    }
    if (getActiveAutoRun()) {
      console.log(`${C.dim}automation is already running; wait for learner mode to resume or use /reset${C.reset}\n`);
      return { started: false, reason: 'already_running' };
    }
    if (duringTurn || isProcessingTurn()) {
      if (getActiveLearnerTurn()) return queuePendingInteractiveAuto({ argument, requestedTurns, source });
      console.log(`${C.dim}auto mode did not start; run /auto again after the current work completes${C.reset}\n`);
      return { started: false, reason: 'busy' };
    }
    resetMixedLearnerSuggestion('interactive_auto_started');
    const pendingFeedback = tutorStubTurnFeedbackEnvelope(state.turnFeedback);
    clearTutorStubTurnFeedbackTarget(state.turnFeedback);
    if (pendingFeedback.requested) {
      appendTraceEvent(state.trace, {
        type: 'tutor_turn_feedback_cancelled',
        reason: 'automated_learner_handoff',
        feedback: pendingFeedback,
        publicTranscriptChanged: false,
      });
    }
    setInteractionMode('auto', { announce: false });
    state.interaction.autoRunning = true;
    setProcessingTurn(true);
    const active = {
      id: `${stateRunDebugId(state)}:auto:${Date.now()}`,
      abortController: new AbortController(),
      cancelledReason: null,
    };
    setActiveAutoRun(active);
    const isCurrent = () => !isExiting() && getActiveAutoRun() === active && !active.abortController.signal.aborted;
    const capLabel = interactiveAutoTurnLabel(requestedTurns);
    console.log(
      `${C.dim}╭─${C.reset} ${interactionModeLabel()} ${C.dim}mode · ${capLabel} · profile ${mixedLearner.profileId || 'custom'}${C.reset}`,
    );
    console.log(`${C.dim}╰─ tutor and learner now continue from the public transcript${C.reset}\n`);
    appendTraceEvent(state.trace, {
      type: 'interactive_auto_handoff',
      turn: state.turns.length + 1,
      maxTurns: requestedTurns,
      safetyTurns: autoSafetyTurns,
      profileId: mixedLearner.profileId,
      source,
      queuedRequestId,
    });
    try {
      const result = await runAutomatedLearnerDialogue({
        state,
        firstMessage: '',
        openingEnabled,
        autoLearnerResolved: activeAutoLearnerResolved,
        autoLearnerProfile: mixedLearner.profile,
        autoTurns: requestedTurns,
        autoSafetyTurns,
        autoStopOnGrounded,
        cliEffort,
        signal: active.abortController.signal,
        isCurrent,
      });
      assertTutorStubTurnAttemptCurrent({ signal: active.abortController.signal, isCurrent });
      if (result.reason === 'auto_grounded_closure' || state.dialogueClosure?.phase === 'closed') {
        printWithConcurrentTerminal(state, () =>
          console.log(`${C.brightGreen}${C.bold}automation complete >${C.reset} grounded closure reached\n`),
        );
        offerAnotherScenario('interactive_auto_grounded_closure');
        return { started: true, reason: result.reason, result };
      }
      const returnMode = state.interaction.previousMode === 'coach' ? 'coach' : 'learner';
      setInteractionMode(returnMode, { announce: false });
      printWithConcurrentTerminal(state, () => {
        console.log(`${C.brightBlue}${C.bold}automation paused >${C.reset} ${result.reason.replaceAll('_', ' ')}`);
        console.log(
          `${C.dim}  ${state.turns.length} total completed turn${state.turns.length === 1 ? '' : 's'}; use /auto to continue${C.reset}\n`,
        );
      });
      return { started: true, reason: result.reason, result };
    } catch (error) {
      if (error?.name === 'AbortError' && active.cancelledReason) {
        appendTraceEvent(state.trace, {
          type: 'interactive_auto_discarded',
          autoRunId: active.id,
          reason: active.cancelledReason,
        });
        return { started: true, reason: 'cancelled', cancelledReason: active.cancelledReason };
      }
      setInteractionMode(state.interaction.previousMode === 'coach' ? 'coach' : 'learner', { announce: false });
      printWithConcurrentTerminal(state, () => console.log(`${C.red}auto mode error:${C.reset} ${error.message}\n`));
      appendTraceEvent(state.trace, { type: 'interactive_auto_error', error: error.message });
      return { started: true, reason: 'error', error: error.message };
    } finally {
      if (getActiveAutoRun() === active) {
        setActiveAutoRun(null);
        state.interaction.autoRunning = false;
        setProcessingTurn(false);
        if (!isExiting()) {
          rl.setPrompt(
            isAwaitingAnotherScenario()
              ? `${C.brightCyan}${C.bold}another scenario? [y/N] >${C.reset} `
              : mixedLearnerPromptText(),
          );
        }
      }
    }
  }

  return {
    discardPendingInteractiveAuto,
    queuePendingInteractiveAuto,
    runInteractiveAutoMode,
    runInteractiveDemo,
    startPendingInteractiveAuto,
  };
}
