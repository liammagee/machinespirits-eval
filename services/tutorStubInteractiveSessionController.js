import { createTutorStubInteractiveDirectorController } from './tutorStubInteractiveDirectorController.js';

export function createTutorStubInteractiveSessionController(dependencies) {
  const {
    C,
    CURRICULUM_MODULE_PROMPT_END,
    CURRICULUM_MODULE_PROMPT_START,
    CURRICULUM_PHASE_PROMPT_END,
    CURRICULUM_PHASE_PROMPT_START,
    advanceTutorStubCurriculumRuntime,
    appendTraceEvent,
    appendTutorStubTurnFailureTraceRecords,
    args,
    clearStatusLine,
    closeoutReportEnabled,
    concurrentTerminal,
    curriculumBundle,
    discardPendingInteractiveAuto,
    displayDiagnosticLabel,
    explicitPerformanceDirectiveValue,
    getActiveAutoRun,
    getActiveLearnerTurn,
    getClarificationInFlight,
    getCliPresentation,
    getPendingAutoRequest,
    getTranslationInFlight,
    isAwaitingAnotherScenario,
    isExiting,
    isFinalized,
    isProcessingTurn,
    jsonClone,
    latestTutorMessage,
    listTutorStubTuningCandidates,
    liveModelRoleRef,
    mixedLearner,
    mixedLearnerProfilePresentation,
    mixedLearnerPromptText,
    oneLine,
    pendingLearnerLines,
    plainPolicyLabel,
    printDialogueCloseout,
    projectTutorStubCurriculumProgressLines,
    projectTutorStubInteractionModeBannerLines,
    projectTutorStubInteractionModeLabel,
    projectTutorStubSessionStatusLines,
    promptIfIdle,
    renderTutorStubCurriculumModule,
    replaceDelimitedPrompt,
    resetMixedLearnerSuggestion,
    resolveInteractive,
    rl,
    saveTranscript,
    selectTutorStubCurriculumModule,
    selectTutorStubCurriculumRuntimeModule,
    sessionRuntime,
    setActiveAutoRun,
    setAwaitingAnotherScenario,
    setClarificationInFlight,
    setExiting,
    setFinalized,
    setTranslationInFlight,
    startMixedLearnerPrefetch,
    state,
    stopInterimAnimation,
    stopVoiceBridge,
    summarizeTutorStubLearnerResponseProvenance,
    transcriptPayload,
    tutorStubCurriculumPrivatePrompt,
    tutorStubCurriculumPublicProjection,
    tutorStubDagFactDropoutSnapshot,
    tutorStubRegisterPolicyStackId,
    tutorStubReleasePacingSnapshot,
    tutorStubTuningSnapshot,
    tutorStubTurnFeedbackEnvelope,
    tutorStubTurnFeedbackLabel,
    writeFinalLearningSummary,
  } = dependencies;

  function performInteractiveFinalize(reason) {
    if (isFinalized()) return;
    setFinalized(true);
    appendTraceEvent(state.trace, {
      type: 'tutor_tuning_session_closed',
      reason,
      tuning: tutorStubTuningSnapshot(state.tuning),
      candidates: listTutorStubTuningCandidates(state.tuning),
      publicTranscriptChanged: false,
    });
    appendTraceEvent(state.trace, {
      type: 'run_end',
      reason,
      turns: state.turns.length,
      mixedLearnerCache: { ...mixedLearner.cacheStats },
      learnerResponseProvenance: summarizeTutorStubLearnerResponseProvenance(state.turns),
      trainingReuse: jsonClone(state.trainingReuse),
    });
    appendTutorStubTurnFailureTraceRecords(state, { sealed: true });
    if (closeoutReportEnabled) {
      const report = printDialogueCloseout(state, { reason, trace: state.trace });
      appendTraceEvent(state.trace, { type: 'closeout_report', reason, report });
    }
    if (args.save) {
      saveTranscript(args.save, transcriptPayload());
    }
    try {
      writeFinalLearningSummary(reason);
    } catch (error) {
      console.log(`${C.red}learning summary error:${C.reset} ${error.message}\n`);
      appendTraceEvent(state.trace, { type: 'learning_summary_error', reason, error: error.message });
    }
  }

  function finalizeInteractive(reason) {
    return sessionRuntime.finalize(reason);
  }

  function requestExit(reason) {
    setExiting(true);
    discardPendingInteractiveAuto(reason, { source: 'session_exit' });
    const activeLearnerTurn = getActiveLearnerTurn();
    const activeAutoRun = getActiveAutoRun();
    const clarificationInFlight = getClarificationInFlight();
    const translationInFlight = getTranslationInFlight();
    activeLearnerTurn?.abortController?.abort();
    if (activeAutoRun) activeAutoRun.cancelledReason = reason;
    activeAutoRun?.abortController?.abort();
    setActiveAutoRun(null);
    if (clarificationInFlight) clarificationInFlight.cancelledReason = reason;
    clarificationInFlight?.abortController?.abort();
    setClarificationInFlight(null);
    if (translationInFlight) translationInFlight.cancelledReason = reason;
    translationInFlight?.abortController?.abort();
    setTranslationInFlight(null);
    stopInterimAnimation(state);
    void stopVoiceBridge(reason);
    concurrentTerminal.close();
    resetMixedLearnerSuggestion(reason);
    finalizeInteractive(reason);
    rl.close();
    resolveInteractive();
  }

  function refreshCurriculumPrompt() {
    if (!curriculumBundle || !state.curriculum?.runtime) return;
    curriculumBundle.prompt = renderTutorStubCurriculumModule(curriculumBundle, curriculumBundle.module);
    state.systemPrompt = replaceDelimitedPrompt(
      state.systemPrompt,
      CURRICULUM_MODULE_PROMPT_START,
      curriculumBundle.prompt,
      CURRICULUM_MODULE_PROMPT_END,
    );
    state.systemPrompt = replaceDelimitedPrompt(
      state.systemPrompt,
      CURRICULUM_PHASE_PROMPT_START,
      tutorStubCurriculumPrivatePrompt(curriculumBundle, state.curriculum.runtime),
      CURRICULUM_PHASE_PROMPT_END,
    );
  }

  function curriculumProgressSnapshot() {
    return curriculumBundle && state.curriculum?.runtime
      ? tutorStubCurriculumPublicProjection(curriculumBundle, state.curriculum.runtime)
      : null;
  }

  function printCurriculumProgress() {
    const progress = curriculumProgressSnapshot();
    for (const line of projectTutorStubCurriculumProgressLines(progress, { colors: C })) console.log(line);
    return progress;
  }

  function activateCurriculumModule(moduleId, { allowDirectEntry = false, source = '/module' } = {}) {
    if (!curriculumBundle || !state.curriculum?.runtime) return { selected: false, reason: 'no_curriculum' };
    const module = selectTutorStubCurriculumModule(curriculumBundle, moduleId);
    const outcome = selectTutorStubCurriculumRuntimeModule(
      state.curriculum.runtime,
      curriculumBundle.curriculum,
      module.id,
      { allowDirectEntry },
    );
    if (!outcome.selected) return outcome;
    const previousModuleId = state.curriculum.module?.id || null;
    curriculumBundle.module = module;
    state.curriculum.module = module;
    state.topic = module.title;
    refreshCurriculumPrompt();
    appendTraceEvent(state.trace, {
      type: 'curriculum_module_activated',
      schema: 'machinespirits.tutor-stub.curriculum-progression.v1',
      source,
      previousModuleId,
      moduleId: module.id,
      phase: state.curriculum.runtime.currentPhase,
      directEntry: outcome.directEntry,
      publicTranscriptChanged: false,
      externalCompletionInferred: false,
    });
    return { ...outcome, module };
  }

  function handleCurriculumModuleCommand(argument = '', { duringTurn = false } = {}) {
    clearStatusLine();
    const requested = String(argument || '').trim();
    if (!requested) {
      printCurriculumProgress();
      console.log(`${C.dim}  choose an available module with /module <id>${C.reset}\n`);
      return true;
    }
    if (duringTurn || isProcessingTurn()) {
      console.log(
        `${C.dim}module change not started; run /module again after the current tutor response completes${C.reset}\n`,
      );
      return false;
    }
    try {
      const outcome = activateCurriculumModule(requested);
      if (!outcome.selected) {
        console.log(
          `${C.yellow}module locked:${C.reset} complete ${outcome.missing.join(', ')} in this session, or start that module directly in a fresh session\n`,
        );
        return false;
      }
      console.log(`${C.brightGreen}${C.bold}module >${C.reset} ${outcome.module.id} — ${outcome.module.title}`);
      console.log(
        `${C.dim}  ${state.curriculum.runtime.currentPhase.replaceAll('_', ' ')} phase · public history retained${C.reset}\n`,
      );
      return true;
    } catch (error) {
      console.log(`${C.red}module error:${C.reset} ${error.message}\n`);
      return false;
    }
  }

  function handleCurriculumNextCommand(argument = '', { duringTurn = false } = {}) {
    clearStatusLine();
    if (duringTurn || isProcessingTurn()) {
      console.log(`${C.dim}curriculum progression waits for the current tutor response to complete${C.reset}\n`);
      return false;
    }
    const decision =
      String(argument || '')
        .trim()
        .toLowerCase() || null;
    let outcome;
    try {
      outcome = advanceTutorStubCurriculumRuntime(state.curriculum.runtime, {
        decision,
        actor: 'human_operator',
      });
    } catch (error) {
      console.log(`${C.red}next error:${C.reset} ${error.message}; use /next, /next pass, or /next revise\n`);
      return false;
    }
    if (!outcome.advanced) {
      const message =
        outcome.reason === 'evidence_required'
          ? 'respond to the current course task before advancing'
          : 'record an explicit decision with /next pass or /next revise';
      console.log(`${C.yellow}next >${C.reset} ${message}\n`);
      return false;
    }
    appendTraceEvent(state.trace, {
      type: 'curriculum_phase_advanced',
      schema: 'machinespirits.tutor-stub.curriculum-progression.v1',
      moduleId: outcome.moduleId || state.curriculum.module.id,
      outcome: outcome.outcome,
      phase: outcome.phase,
      decision,
      decisionActor: decision ? 'human_operator' : null,
      publicTranscriptChanged: false,
      externalCompletionInferred: false,
    });
    if (outcome.outcome === 'module_mastered') {
      const progress = curriculumProgressSnapshot();
      const next = progress.modules.find(
        (module) => module.id !== outcome.moduleId && module.available && module.status !== 'mastered',
      );
      if (next) {
        const selected = activateCurriculumModule(next.id, { source: '/next' });
        console.log(`${C.brightGreen}${C.bold}module mastered >${C.reset} ${outcome.moduleId}`);
        console.log(`${C.cyan}next module >${C.reset} ${selected.module.id} — ${selected.module.title}\n`);
      } else {
        refreshCurriculumPrompt();
        console.log(
          `${C.brightGreen}${C.bold}course complete >${C.reset} all available modules have explicit transfer passes\n`,
        );
      }
      return true;
    }
    refreshCurriculumPrompt();
    console.log(
      `${C.brightGreen}${C.bold}next phase >${C.reset} ${state.curriculum.runtime.currentPhase.replaceAll('_', ' ')}`,
    );
    if (outcome.outcome === 'revision_requested') {
      console.log(
        `${C.dim}  the existing public evidence is retained; the tutor returns to a bounded scaffold${C.reset}`,
      );
    }
    console.log('');
    return true;
  }

  function offerAnotherScenario(reason = 'dialogue_grounded_closure') {
    if (isAwaitingAnotherScenario() || isExiting()) return;
    pendingLearnerLines.length = 0;
    resetMixedLearnerSuggestion(reason);
    finalizeInteractive(reason);
    setAwaitingAnotherScenario(true);
    rl.setPrompt(`${C.brightCyan}${C.bold}another scenario? [y/N] >${C.reset} `);
    console.log(`${C.brightGreen}${C.bold}scenario complete >${C.reset} would you like to do another scenario?`);
    console.log(
      `${C.dim}  y opens the scenario picker · Enter or n ends the session · /report revisits this inquiry${C.reset}\n`,
    );
    promptIfIdle();
  }

  function interactionModeLabel() {
    return projectTutorStubInteractionModeLabel({
      mode: state.interaction?.mode || 'learner',
      mixedEnabled: mixedLearner.enabled,
      colors: C,
    });
  }

  function printInteractionModeBanner({ detail = true } = {}) {
    for (const line of projectTutorStubInteractionModeBannerLines({
      mode: state.interaction?.mode || 'learner',
      mixedEnabled: mixedLearner.enabled,
      detail,
      colors: C,
    }))
      console.log(line);
  }

  function setInteractionMode(mode, { announce = true } = {}) {
    const normalized = String(mode || '')
      .trim()
      .toLowerCase();
    if (!['learner', 'coach', 'auto'].includes(normalized)) {
      throw new Error('mode must be learner, coach, or auto');
    }
    const previous = state.interaction.mode;
    if (normalized !== 'auto') state.interaction.previousMode = normalized;
    state.interaction.mode = normalized;
    rl.setPrompt(mixedLearnerPromptText());
    appendTraceEvent(state.trace, {
      type: 'interactive_mode_changed',
      previous,
      mode: normalized,
      turn: state.turns.length + 1,
    });
    if (announce) printInteractionModeBanner();
  }

  function printInteractiveStatus() {
    if (state.passthrough?.enabled) {
      for (const line of projectTutorStubSessionStatusLines({
        status: {
          surface: 'passthrough',
          turn: state.turns.length + 1,
          model: { ref: state.modelRef, provider: state.resolved.provider, model: state.resolved.model },
          setup: state.world ? `${state.world.id} — ${state.world.title}` : state.topic,
          publicMessageCount: state.history.length,
          appearance: getCliPresentation(),
          voice: state.voice,
        },
        colors: C,
      }))
        console.log(line);
      return;
    }
    const dropout = tutorStubDagFactDropoutSnapshot(state.learnerDag?.dropout);
    const releasePacing = tutorStubReleasePacingSnapshot(state.releasePacing, state.world);
    const profile = mixedLearnerProfilePresentation(mixedLearner.suggestion);
    const policy = tutorStubRegisterPolicyStackId(state.register?.policy, state.register?.overlays);
    const directedRegister = explicitPerformanceDirectiveValue(state, 'register');
    const directedCharacter = explicitPerformanceDirectiveValue(state, 'character');
    const directorDirection = state.directorGuidance?.active || null;
    const randomPerformanceAxes = [!directedRegister ? 'style' : null, !directedCharacter ? 'character' : null].filter(
      Boolean,
    );
    const closure = state.dialogueClosure?.phase || 'open';
    const coachPending = state.coach?.pending?.length || 0;
    const suggestion = mixedLearner.enabled
      ? mixedLearner.suggestion?.text
        ? 'ready'
        : mixedLearner.pending
          ? 'warming'
          : 'idle'
      : 'off';
    const modelRouting = state.modelRouting?.allRolesOverrideRef
      ? { allRolesOverrideRef: state.modelRouting.allRolesOverrideRef }
      : {
          allRolesOverrideRef: null,
          classifierRef: liveModelRoleRef('classifier'),
          reasoningRef: liveModelRoleRef('reasoning'),
          learnerRef: liveModelRoleRef('learner'),
        };
    for (const line of projectTutorStubSessionStatusLines({
      status: {
        surface: 'normal',
        modeLabel: interactionModeLabel(),
        turn: state.turns.length + 1,
        learner: { id: profile.id, name: profile.name, suggestion },
        tutor: { ref: state.tuning?.activeRef || state.tutorInstance?.ref || 'unpartitioned' },
        model: { ref: state.modelRef, provider: state.resolved.provider, model: state.resolved.model },
        modelRouting,
        committee: state.committee,
        voice: state.voice,
        teaching: {
          approachLabel: plainPolicyLabel(state.register?.policy),
          policyId: policy,
          styleRange: state.register?.temperature,
          dropoutRate: dropout.rate,
          baseSpeed: releasePacing?.baseSpeed ?? 1,
          effectiveSpeed: releasePacing?.effectiveSpeed ?? 1,
        },
        randomPerformance: { enabled: state.randomPerformance?.enabled, axes: randomPerformanceAxes },
        lightAdaptation: state.lightAdaptation,
        directedPerformance: { register: directedRegister, character: directedCharacter },
        directorRequest: directorDirection
          ? {
              text: oneLine(directorDirection.text, { max: 120 }),
              effectiveFromTurn: directorDirection.effectiveFromTurn,
            }
          : null,
        conversation: {
          closureLabel: displayDiagnosticLabel(closure),
          coachPending,
          coachUsed: state.coach?.history?.length || 0,
        },
        autoHandoff: { pending: getPendingAutoRequest(), running: state.interaction?.autoRunning },
        turnFeedback: {
          enabled: state.turnFeedback?.enabled,
          label: state.turnFeedback?.enabled
            ? tutorStubTurnFeedbackLabel(tutorStubTurnFeedbackEnvelope(state.turnFeedback))
            : null,
        },
        responseDetails: state.responseDetails,
        tuning: {
          mode: state.tuning?.mode,
          stableVersion: state.tuning?.manifest?.stableVersion ?? state.tutorInstance?.sourceVersion ?? 1,
          canaryVersion: state.tuning?.manifest?.canaryVersion,
          sessionCandidateCount: state.tuning?.sessionCandidateIds?.length || 0,
        },
        appearance: getCliPresentation(),
        explanatoryDebug: state.explanatoryDebug,
      },
      colors: C,
    }))
      console.log(line);
  }

  const { answerCliDirectorQuestion, handleDirectorGuidanceCommand, handleProofDagCommand } =
    createTutorStubInteractiveDirectorController(dependencies);

  function queueCoachGuidance(text, { duringTurn = false } = {}) {
    const guidance = String(text || '').trim();
    if (!guidance) {
      setInteractionMode('coach');
      return null;
    }
    const notBeforeTurn = state.turns.length + (duringTurn || isProcessingTurn() ? 2 : 1);
    const entry = {
      id: `coach-${String((state.coach?.pending?.length || 0) + (state.coach?.history?.length || 0) + 1).padStart(3, '0')}`,
      text: guidance,
      createdAt: new Date().toISOString(),
      notBeforeTurn,
    };
    state.coach.pending.push(entry);
    if (!duringTurn && !isProcessingTurn()) {
      resetMixedLearnerSuggestion('coach_guidance_added');
    }
    appendTraceEvent(state.trace, {
      type: 'coach_guidance_queued',
      guidance: entry,
      duringTurn: Boolean(duringTurn || isProcessingTurn()),
      publicTranscriptChanged: false,
    });
    clearStatusLine();
    console.log(`${C.brightYellow}${C.bold}coach queued >${C.reset} ${guidance}`);
    console.log(
      `${C.dim}  private; applies to tutor turn ${notBeforeTurn}${duringTurn || isProcessingTurn() ? ' after the response already in flight' : ''}${C.reset}`,
    );
    if (mixedLearner.enabled && !duringTurn && !isProcessingTurn() && latestTutorMessage(state)) {
      startMixedLearnerPrefetch('coach_guidance_added');
      console.log(`${C.dim}  rebuilding the learner suggestion and next tutor response with this guidance${C.reset}`);
    }
    console.log();
    return entry;
  }

  return {
    answerCliDirectorQuestion,
    finalizeInteractive,
    handleCurriculumModuleCommand,
    handleCurriculumNextCommand,
    handleDirectorGuidanceCommand,
    handleProofDagCommand,
    interactionModeLabel,
    offerAnotherScenario,
    performInteractiveFinalize,
    printCurriculumProgress,
    printInteractionModeBanner,
    printInteractiveStatus,
    queueCoachGuidance,
    requestExit,
    setInteractionMode,
  };
}
