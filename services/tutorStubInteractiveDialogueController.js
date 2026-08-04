export function createTutorStubInteractiveDialogueController(dependencies) {
  const {
    C,
    appendTraceEvent,
    applyTutorStubComprehensionRequest,
    applyTutorStubComprehensionResponse,
    assertTutorStubTurnAttemptCurrent,
    clearStatusLine,
    concurrentTerminal,
    detectTutorStubComprehensionRequest,
    discardPendingInteractiveAuto,
    emitOpeningPrompt,
    generateTutorClarification,
    generateTutorStubCurriculumTranslation,
    generateTutorStubTutorOutputTranslation,
    getActiveAutoRun,
    getActiveLearnerTurn,
    getClarificationInFlight,
    getPendingAutoRequest,
    getTranslationInFlight,
    isExiting,
    isProcessingTurn,
    latestTutorMessage,
    mixedLearnerPromptText,
    normalizeTutorStubCurriculumTranslationLevels,
    normalizeTutorStubTutorOutputTranslationLevels,
    oneLine,
    openingDebugId,
    pendingLearnerLines,
    printDirectorPreludeBeforeFirstTutor,
    printOpeningDebugLine,
    printTutorFeedbackRequest,
    printWithConcurrentTerminal,
    publishAcceptedTutorToVoice,
    renderTutorStubCurriculumTranslation,
    renderTutorStubTutorOutputTranslation,
    resetInteractiveState,
    resetMixedLearnerSuggestion,
    rl,
    sessionRuntime,
    setActiveAutoRun,
    setActiveLearnerTurn,
    setAwaitingAnotherScenario,
    setClarificationInFlight,
    setProcessingTurn,
    setTranslationInFlight,
    startMixedLearnerPrefetch,
    state,
    stateRunDebugId,
    stopInterimAnimation,
    tutorStubComprehensionSnapshot,
    tutorStubDirectorGuidanceSnapshot,
  } = dependencies;

  function promptIfIdle() {
    if (!isExiting()) concurrentTerminal.show();
  }

  async function runClarificationCommand(term = '', { duringTurn = false } = {}) {
    clearStatusLine();
    const latestTutor = latestTutorMessage(state);
    if (!latestTutor) {
      console.log(`${C.cyan}clarify >${C.reset} no tutor message is available yet`);
      console.log(
        `${C.dim}  start the dialogue first, then use /clarify [phrase] after tutor wording that needs explanation${C.reset}\n`,
      );
      appendTraceEvent(state.trace, {
        type: 'clarification_unavailable',
        reason: 'no_tutor_message',
        duringTurn,
      });
      return;
    }
    if (getClarificationInFlight()) {
      console.log(`${C.dim}clarification is already running; wait for it to finish, then try again${C.reset}\n`);
      appendTraceEvent(state.trace, {
        type: 'clarification_skipped',
        reason: 'already_in_flight',
        duringTurn,
      });
      return;
    }

    const clarificationAttempt = {
      id: `${stateRunDebugId(state)}:clarify:${Date.now()}`,
      abortController: new AbortController(),
      cancelledReason: null,
    };
    setClarificationInFlight(clarificationAttempt);
    const requestedTerm = String(term || '').trim();
    const comprehensionRequest = detectTutorStubComprehensionRequest({
      explicitTerm: requestedTerm,
      text: requestedTerm || 'Explain the latest tutor wording.',
      source: 'slash_explain',
      turn: state.turns.length,
    });
    applyTutorStubComprehensionRequest(state.comprehension, comprehensionRequest);
    resetMixedLearnerSuggestion('comprehension_request');
    appendTraceEvent(state.trace, {
      type: 'comprehension_request',
      source: 'slash_explain',
      turn: state.turns.length,
      terms: comprehensionRequest.terms,
      generic: comprehensionRequest.generic,
      text: comprehensionRequest.text,
      advancesLearnerDag: false,
      comprehensionState: tutorStubComprehensionSnapshot(state.comprehension, { turn: state.turns.length }),
    });
    appendTraceEvent(state.trace, {
      type: 'clarification_start',
      term: requestedTerm || null,
      duringTurn,
      turn: state.turns.length,
    });
    try {
      console.log(
        `${C.dim}clarifying${requestedTerm ? ` "${oneLine(requestedTerm, { max: 80 })}"` : ' latest tutor wording'}...${C.reset}`,
      );
      const response = await generateTutorClarification({
        state,
        term: requestedTerm,
        resolved: state.resolved,
        cliEffort: state.cliEffort,
        signal: clarificationAttempt.abortController.signal,
      });
      assertTutorStubTurnAttemptCurrent({
        signal: clarificationAttempt.abortController.signal,
        isCurrent: () => getClarificationInFlight() === clarificationAttempt,
      });
      printWithConcurrentTerminal(state, () => {
        clearStatusLine();
        console.log(`${C.cyan}clarify >${C.reset} ${response.text}\n`);
        if (duringTurn) {
          console.log(
            `${C.dim}tutor is still thinking; clarification used the latest completed tutor message${C.reset}\n`,
          );
        }
      });
      const comprehensionResponse = applyTutorStubComprehensionResponse(state.comprehension, {
        text: response.text,
        turn: state.turns.length,
        source: 'slash_explain',
        force: true,
        terms: comprehensionRequest.terms,
      });
      appendTraceEvent(state.trace, {
        type: 'comprehension_response',
        source: 'slash_explain',
        turn: state.turns.length,
        explainedTerms: comprehensionResponse.explainedTerms,
        advancesLearnerDag: false,
        comprehensionState: comprehensionResponse.snapshot,
      });
      appendTraceEvent(state.trace, {
        type: 'clarification_complete',
        term: requestedTerm || null,
        duringTurn,
        turn: state.turns.length,
        text: response.text,
        provider: response.provider,
        model: response.model,
        latencyMs: response.latencyMs,
        usage: response.usage,
      });
    } catch (err) {
      if (err?.name === 'AbortError' && clarificationAttempt.cancelledReason) {
        appendTraceEvent(state.trace, {
          type: 'clarification_discarded',
          clarificationId: clarificationAttempt.id,
          reason: clarificationAttempt.cancelledReason,
        });
        return;
      }
      printWithConcurrentTerminal(state, () => {
        clearStatusLine();
        console.log(`${C.red}clarify error:${C.reset} ${err.message}\n`);
      });
      appendTraceEvent(state.trace, {
        type: 'clarification_error',
        term: requestedTerm || null,
        duringTurn,
        turn: state.turns.length,
        error: err.message,
      });
    } finally {
      if (getClarificationInFlight() === clarificationAttempt) {
        setClarificationInFlight(null);
        if (!duringTurn) startMixedLearnerPrefetch('comprehension_state_changed');
      }
    }
  }

  async function runTutorOutputTranslationCommand(levelArgument = '', { duringTurn = false } = {}) {
    clearStatusLine();
    const sourceText = String(latestTutorMessage(state) || '').trim();
    if (!sourceText) {
      console.log(`${C.cyan}translate >${C.reset} no tutor message is available yet`);
      console.log(`${C.dim}  ask the tutor something first, then use /translate${C.reset}\n`);
      appendTraceEvent(state.trace, {
        type: 'tutor_output_translation_unavailable',
        reason: 'no_tutor_message',
        duringTurn,
        publicTranscriptChanged: false,
      });
      return;
    }
    let levels;
    try {
      levels = normalizeTutorStubTutorOutputTranslationLevels(levelArgument);
    } catch (error) {
      console.log(`${C.red}translate error:${C.reset} ${error.message}\n`);
      appendTraceEvent(state.trace, {
        type: 'tutor_output_translation_error',
        argument: levelArgument || null,
        duringTurn,
        error: error.message,
        publicTranscriptChanged: false,
      });
      return;
    }
    if (getTranslationInFlight()) {
      console.log(`${C.dim}translation is already running; wait for it to finish, then try again${C.reset}\n`);
      appendTraceEvent(state.trace, {
        type: 'tutor_output_translation_skipped',
        reason: 'already_in_flight',
        levels,
        duringTurn,
        publicTranscriptChanged: false,
      });
      return;
    }

    const attempt = {
      id: `${stateRunDebugId(state)}:translate:${Date.now()}`,
      abortController: new AbortController(),
      cancelledReason: null,
    };
    setTranslationInFlight(attempt);
    appendTraceEvent(state.trace, {
      type: 'tutor_output_translation_start',
      schema: 'machinespirits.tutor-stub.tutor-output-translation-request.v1',
      translationId: attempt.id,
      levels,
      duringTurn,
      publicTranscriptChanged: false,
    });
    try {
      console.log(
        `${C.dim}rewriting the latest tutor reply in ${levels.length === 1 ? levels[0] : 'basic through proficient'} English...${C.reset}`,
      );
      const response = await generateTutorStubTutorOutputTranslation({
        state,
        sourceText,
        levels,
        signal: attempt.abortController.signal,
      });
      assertTutorStubTurnAttemptCurrent({
        signal: attempt.abortController.signal,
        isCurrent: () => getTranslationInFlight() === attempt,
      });
      const rendered = renderTutorStubTutorOutputTranslation(response.translation);
      printWithConcurrentTerminal(state, () => {
        clearStatusLine();
        console.log(`${C.brightCyan}${C.bold}translate >${C.reset} latest tutor reply`);
        console.log(`${C.dim}  temporary wording view; the transcript and tutor state are unchanged${C.reset}\n`);
        console.log(`${rendered}\n`);
        if (duringTurn) {
          console.log(
            `${C.dim}tutor is still thinking; this rewrote the previous completed reply and did not change the pending turn${C.reset}\n`,
          );
        }
      });
      appendTraceEvent(state.trace, {
        type: 'tutor_output_translation_complete',
        schema: response.translation.schema,
        translationId: attempt.id,
        levels,
        duringTurn,
        translation: response.translation,
        provider: response.provider,
        model: response.model,
        latencyMs: response.latencyMs,
        usage: response.usage,
        publicTranscriptChanged: false,
      });
    } catch (error) {
      if (error?.name === 'AbortError' && attempt.cancelledReason) {
        appendTraceEvent(state.trace, {
          type: 'tutor_output_translation_discarded',
          translationId: attempt.id,
          reason: attempt.cancelledReason,
          publicTranscriptChanged: false,
        });
        return;
      }
      printWithConcurrentTerminal(state, () => {
        clearStatusLine();
        console.log(`${C.red}translate error:${C.reset} ${error.message}\n`);
      });
      appendTraceEvent(state.trace, {
        type: 'tutor_output_translation_error',
        translationId: attempt.id,
        levels,
        duringTurn,
        error: error.message,
        publicTranscriptChanged: false,
      });
    } finally {
      if (getTranslationInFlight() === attempt) setTranslationInFlight(null);
    }
  }

  async function runCurriculumTranslationCommand(levelArgument = '', { duringTurn = false } = {}) {
    const module = state.curriculum?.module || null;
    if (!module) return runTutorOutputTranslationCommand(levelArgument, { duringTurn });
    clearStatusLine();
    let levels;
    try {
      levels = normalizeTutorStubCurriculumTranslationLevels(levelArgument);
    } catch (error) {
      console.log(`${C.red}translate error:${C.reset} ${error.message}\n`);
      appendTraceEvent(state.trace, {
        type: 'curriculum_translation_error',
        moduleId: module.id,
        argument: levelArgument || null,
        duringTurn,
        error: error.message,
        publicTranscriptChanged: false,
      });
      return;
    }
    if (getTranslationInFlight()) {
      console.log(`${C.dim}translation is already running; wait for it to finish, then try again${C.reset}\n`);
      appendTraceEvent(state.trace, {
        type: 'curriculum_translation_skipped',
        reason: 'already_in_flight',
        moduleId: module.id,
        levels,
        duringTurn,
        publicTranscriptChanged: false,
      });
      return;
    }

    const attempt = {
      id: `${stateRunDebugId(state)}:translate:${Date.now()}`,
      abortController: new AbortController(),
      cancelledReason: null,
    };
    setTranslationInFlight(attempt);
    appendTraceEvent(state.trace, {
      type: 'curriculum_translation_start',
      schema: 'machinespirits.tutor-stub.curriculum-translation-request.v1',
      translationId: attempt.id,
      moduleId: module.id,
      moduleTitle: module.title,
      levels,
      duringTurn,
      publicTranscriptChanged: false,
    });
    try {
      console.log(
        `${C.dim}translating ${module.title} into ${levels.length === 1 ? levels[0] : 'basic through proficient'} English...${C.reset}`,
      );
      const response = await generateTutorStubCurriculumTranslation({
        state,
        levels,
        signal: attempt.abortController.signal,
      });
      assertTutorStubTurnAttemptCurrent({
        signal: attempt.abortController.signal,
        isCurrent: () => getTranslationInFlight() === attempt,
      });
      const rendered = renderTutorStubCurriculumTranslation(response.translation);
      printWithConcurrentTerminal(state, () => {
        clearStatusLine();
        console.log(`${C.brightCyan}${C.bold}translate >${C.reset} ${module.id} · ${module.title}`);
        console.log(
          `${C.dim}  wording changes only; the canonical curriculum and its checks remain authoritative${C.reset}\n`,
        );
        console.log(`${rendered}\n`);
        if (duringTurn) {
          console.log(
            `${C.dim}tutor is still thinking; this view used the active curriculum source and did not change the pending turn${C.reset}\n`,
          );
        }
      });
      appendTraceEvent(state.trace, {
        type: 'curriculum_translation_complete',
        schema: response.translation.schema,
        translationId: attempt.id,
        moduleId: module.id,
        levels,
        duringTurn,
        translation: response.translation,
        provider: response.provider,
        model: response.model,
        latencyMs: response.latencyMs,
        usage: response.usage,
        publicTranscriptChanged: false,
      });
    } catch (error) {
      if (error?.name === 'AbortError' && attempt.cancelledReason) {
        appendTraceEvent(state.trace, {
          type: 'curriculum_translation_discarded',
          translationId: attempt.id,
          moduleId: module.id,
          reason: attempt.cancelledReason,
          publicTranscriptChanged: false,
        });
        return;
      }
      printWithConcurrentTerminal(state, () => {
        clearStatusLine();
        console.log(`${C.red}translate error:${C.reset} ${error.message}\n`);
      });
      appendTraceEvent(state.trace, {
        type: 'curriculum_translation_error',
        translationId: attempt.id,
        moduleId: module.id,
        levels,
        duringTurn,
        error: error.message,
        publicTranscriptChanged: false,
      });
    } finally {
      if (getTranslationInFlight() === attempt) setTranslationInFlight(null);
    }
  }

  function printInteractiveTutorOpening(opening) {
    if (!opening || isExiting()) return false;
    printOpeningDebugLine(state);
    printDirectorPreludeBeforeFirstTutor(state, { reason: 'interactive_opening' });
    console.log(`${C.magenta}tutor >${C.reset} ${opening}\n`);
    publishAcceptedTutorToVoice({
      text: opening,
      turn: 0,
      turnId: openingDebugId(stateRunDebugId(state)),
      reason: 'accepted_tutor_opening',
    });
    printTutorFeedbackRequest({
      tutorTurn: 0,
      tutorTurnId: openingDebugId(stateRunDebugId(state)),
      kind: 'opening',
    });
    return true;
  }

  async function performInteractiveDialogueReset({ command = '/reset', duringTurn = false } = {}) {
    const learnerAttempt = getActiveLearnerTurn();
    const autoAttempt = getActiveAutoRun();
    const queuedAutoRequest = getPendingAutoRequest();
    const clarificationAttempt = getClarificationInFlight();
    const translationAttempt = getTranslationInFlight();
    const queuedLearnerLines = pendingLearnerLines.length;
    const interrupted = Boolean(
      learnerAttempt ||
      autoAttempt ||
      queuedAutoRequest ||
      clarificationAttempt ||
      translationAttempt ||
      duringTurn ||
      isProcessingTurn(),
    );

    stopInterimAnimation(state);
    discardPendingInteractiveAuto('dialogue_reset', { source: command });
    if (learnerAttempt) {
      learnerAttempt.cancelledReason = 'dialogue_reset';
      setActiveLearnerTurn(null);
      learnerAttempt.abortController?.abort();
    }
    if (autoAttempt) {
      autoAttempt.cancelledReason = 'dialogue_reset';
      setActiveAutoRun(null);
      autoAttempt.abortController?.abort();
    }
    if (clarificationAttempt) {
      clarificationAttempt.cancelledReason = 'dialogue_reset';
      setClarificationInFlight(null);
      clarificationAttempt.abortController.abort();
    }
    if (translationAttempt) {
      translationAttempt.cancelledReason = 'dialogue_reset';
      setTranslationInFlight(null);
      translationAttempt.abortController.abort();
    }
    setProcessingTurn(false);
    pendingLearnerLines.length = 0;
    setAwaitingAnotherScenario(false);
    resetMixedLearnerSuggestion('dialogue_reset');
    resetInteractiveState();

    if (state.interaction?.mode === 'auto') {
      state.interaction.mode = state.interaction.previousMode === 'coach' ? 'coach' : 'learner';
    }
    if (state.interaction) state.interaction.autoRunning = false;
    rl.setPrompt(mixedLearnerPromptText());

    appendTraceEvent(state.trace, {
      type: 'history_clear',
      reason: 'dialogue_reset',
      command,
      duringTurn,
      interrupted,
    });
    appendTraceEvent(state.trace, {
      type: 'interactive_dialogue_reset',
      command,
      interrupted,
      interruptedLearnerTurn: learnerAttempt
        ? {
            turn: learnerAttempt.turn,
            turnId: learnerAttempt.turnId,
            revision: learnerAttempt.revision,
            messageCount: learnerAttempt.fragments.length,
          }
        : null,
      interruptedAutoRunId: autoAttempt?.id || null,
      interruptedQueuedAutoRequestId: queuedAutoRequest?.id || null,
      interruptedClarificationId: clarificationAttempt?.id || null,
      interruptedTranslationId: translationAttempt?.id || null,
      interruptedCurriculumTranslationId: state.curriculum?.module ? translationAttempt?.id || null : null,
      queuedLearnerLinesDiscarded: queuedLearnerLines,
      directorGuidance: tutorStubDirectorGuidanceSnapshot(state.directorGuidance),
      preserved: ['scenario', 'learner_profile', 'settings', 'director_guidance'],
    });
    clearStatusLine();
    console.log(
      `${C.brightCyan}${C.bold}dialogue reset >${C.reset} ${
        interrupted ? 'unfinished work cancelled; ' : ''
      }starting this scenario again`,
    );
    console.log(
      `${C.dim}  previous turns discarded · learner profile, settings, and director request kept${C.reset}\n`,
    );
    const opening = await emitOpeningPrompt('reset');
    if (opening) startMixedLearnerPrefetch('reset_opening');
    return true;
  }

  function resetInteractiveDialogue(options = {}) {
    return sessionRuntime.reset({ reason: 'dialogue_reset', ...options });
  }

  return {
    performInteractiveDialogueReset,
    printInteractiveTutorOpening,
    promptIfIdle,
    resetInteractiveDialogue,
    runClarificationCommand,
    runCurriculumTranslationCommand,
    runTutorOutputTranslationCommand,
  };
}
