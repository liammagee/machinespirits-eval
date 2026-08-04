/**
 * Own the interactive terminal's mutable lifecycle and event loop.
 *
 * Tutoring policy stays in the injected controllers. This host owns only the
 * readline surface, prompt decoration, busy/queue state, and terminal startup
 * and shutdown sequencing.
 */
export function createTutorStubTerminalHost({
  C,
  ROOT,
  TUTOR_STUB_FEEDBACK_REASONS,
  autoLearnerProfile,
  autoLearnerResolved,
  createTutorStubConcurrentTerminal,
  createTutorStubInteractiveInputPresentation,
  createTutorStubLineSelection,
  groupedWorldEntries,
  humanDirectedRegisterPalette,
  input,
  learnerProfileContract,
  learnerProfileIds,
  learnerProfileSpeakerLabel,
  listTutorStubCurriculumModules,
  listTutorStubLabs,
  loadTutorStubCurriculum,
  mixedLearnerEnabled,
  mixedLearnerGhostText,
  oneLine,
  output,
  readline,
  renderMixedLearnerGhostText,
  state,
  tutorModelChoiceEntries,
  tutorStubCanonicalCommandToken,
  tutorStubCommandAvailable,
  tutorStubCommandSummary,
  tutorStubCommandTokens,
  tutorStubConfigurableActorialPartIds,
  tutorStubStaticCommandCompletions,
  automatedLearnerProfileId,
}) {
  const mixedLearner = {
    enabled: mixedLearnerEnabled,
    resolved: autoLearnerResolved,
    profile: autoLearnerProfile,
    defaultProfile: autoLearnerProfile,
    profileId: automatedLearnerProfileId(autoLearnerProfile),
    seq: 0,
    pending: null,
    suggestion: null,
    draftInsertion: null,
    error: null,
    artifactAbortController: null,
    analysisCache: null,
    readyAnnouncementProfileKey: null,
    promptHistory: [],
    cacheStats: {
      analysisStarted: 0,
      analysisHits: 0,
      analysisMisses: 0,
      tutorStarted: 0,
      tutorHits: 0,
      tutorMisses: 0,
      discarded: 0,
      errors: 0,
    },
  };

  let initialSetupStage = 'off';
  let processingTurn = false;
  let clarificationInFlight = null;
  let translationInFlight = null;
  let scenarioPickerActive = false;
  let awaitingAnotherScenario = false;
  let interactiveDemoRunning = false;
  let exiting = false;
  let finalized = false;
  const pendingLearnerLines = [];
  let activeLearnerTurn = null;
  let activeAutoRun = null;
  let pendingAutoRequest = null;
  let pendingAutoRequestSequence = 0;
  let resolveInteractive = null;
  const interactiveDone = new Promise((resolve) => {
    resolveInteractive = resolve;
  });

  const {
    mixedLearnerCompletionForLine,
    mixedLearnerProfilePresentation,
    mixedLearnerPromptText,
    printMixedLearnerProfilePresentation,
    slashCommandCompletionForLine,
    slashCommandPaletteForLine,
  } = createTutorStubInteractiveInputPresentation({
    C,
    ROOT,
    TUTOR_STUB_FEEDBACK_REASONS,
    groupedWorldEntries,
    humanDirectedRegisterPalette,
    isProcessingTurn: () => processingTurn,
    learnerProfileContract,
    learnerProfileIds,
    learnerProfileSpeakerLabel,
    listTutorStubCurriculumModules,
    listTutorStubLabs,
    loadTutorStubCurriculum,
    mixedLearner,
    oneLine,
    output,
    state,
    tutorModelChoiceEntries,
    tutorStubCanonicalCommandToken,
    tutorStubCommandAvailable,
    tutorStubCommandSummary,
    tutorStubCommandTokens,
    tutorStubConfigurableActorialPartIds,
    tutorStubStaticCommandCompletions,
  });

  const rl = readline.createInterface({
    input,
    output,
    prompt: mixedLearnerPromptText(),
    completer(line) {
      if (initialSetupStage === 'profile') {
        const raw = String(line || '');
        const normalized = raw.trim().toLowerCase().replace(/-/gu, '_');
        const candidates = ['list', 'stress', 'all', ...learnerProfileIds()];
        const matches = candidates.filter((candidate) => candidate.startsWith(normalized));
        return [matches.length ? matches : candidates, raw];
      }
      if (initialSetupStage === 'model') {
        const raw = String(line || '');
        const normalized = raw.trim().toLowerCase();
        const candidates = tutorModelChoiceEntries(state.modelRef).map((entry) => entry.ref);
        const matches = candidates.filter((candidate) => candidate.toLowerCase().startsWith(normalized));
        return [matches.length ? matches : candidates, raw];
      }
      const mixedCompletion = mixedLearnerCompletionForLine(line);
      if (mixedCompletion) return [[mixedCompletion], line];
      const completion = slashCommandCompletionForLine(line, { fallback: true });
      return [completion.candidates, completion.replacement];
    },
  });
  const lineSelection = createTutorStubLineSelection({ rl, output });
  const concurrentTerminal = createTutorStubConcurrentTerminal({
    rl,
    output,
    decorateLine: () => {
      lineSelection.decorateLine();
      renderMixedLearnerGhostText({
        rl,
        output,
        text: mixedLearnerGhostText({
          enabled: mixedLearner.enabled,
          suggestion: mixedLearner.suggestion,
          line: rl.line,
          processingTurn,
          interactionMode: state.interaction?.mode,
          interfaceBlocked:
            exiting ||
            initialSetupStage !== 'off' ||
            scenarioPickerActive ||
            awaitingAnotherScenario ||
            interactiveDemoRunning,
        }),
        style: (text) => `${C.dim}${text}${C.reset}`,
      });
    },
  });
  state.concurrentTerminal = concurrentTerminal;
  state.interim.concurrentTerminal = concurrentTerminal;

  const runtime = {
    mixedLearner,
    mixedLearnerCompletionForLine,
    mixedLearnerProfilePresentation,
    mixedLearnerPromptText,
    printMixedLearnerProfilePresentation,
    slashCommandCompletionForLine,
    slashCommandPaletteForLine,
    rl,
    lineSelection,
    concurrentTerminal,
    pendingLearnerLines,
    interactiveDone,
    resolveInteractive,
    getActiveAutoRun: () => activeAutoRun,
    getActiveLearnerTurn: () => activeLearnerTurn,
    getClarificationInFlight: () => clarificationInFlight,
    getPendingAutoRequest: () => pendingAutoRequest,
    getTranslationInFlight: () => translationInFlight,
    isAwaitingAnotherScenario: () => awaitingAnotherScenario,
    isExiting: () => exiting,
    isFinalized: () => finalized,
    isInteractiveDemoRunning: () => interactiveDemoRunning,
    isProcessingTurn: () => processingTurn,
    nextPendingAutoRequestSequence: () => {
      pendingAutoRequestSequence += 1;
      return pendingAutoRequestSequence;
    },
    setActiveAutoRun: (value) => {
      activeAutoRun = value;
    },
    setActiveLearnerTurn: (value) => {
      activeLearnerTurn = value;
    },
    setAwaitingAnotherScenario: (value) => {
      awaitingAnotherScenario = value;
    },
    setClarificationInFlight: (value) => {
      clarificationInFlight = value;
    },
    setExiting: (value) => {
      exiting = value;
    },
    setFinalized: (value) => {
      finalized = value;
    },
    setInitialSetupStage: (value) => {
      initialSetupStage = value;
    },
    setInteractiveDemoRunning: (value) => {
      interactiveDemoRunning = value;
    },
    setPendingAutoRequest: (value) => {
      pendingAutoRequest = value;
    },
    setProcessingTurn: (value) => {
      processingTurn = value;
    },
    setScenarioPickerActive: (value) => {
      scenarioPickerActive = value;
    },
    setTranslationInFlight: (value) => {
      translationInFlight = value;
    },
  };

  runtime.run = async function runTerminalEventLoop({
    appendTraceEvent,
    args,
    chooseAnotherScenario,
    emitKeypressEvents,
    emitOpeningPrompt,
    emitResumeHandoff,
    finalizeInteractive,
    fs,
    handleSlashCommand,
    handleTutorFeedbackCommand,
    handleVoiceCommand,
    instantExistingScenarioOpening,
    jsonClone,
    mixedDraftLearnerResponseProvenance,
    persistCurrentInteractiveSettings,
    printInteractiveTutorOpening,
    printInteractionModeBanner,
    promptIfIdle,
    requestExit,
    resumedDialogue,
    runInitialMixedLearnerSetup,
    runInteractiveDemo,
    runTutorStubSessionRpc,
    sessionRuntime,
    startInterimAnimation,
    startMixedLearnerPrefetch,
    stopInterimAnimation,
    stopVoiceBridge,
    tutorStubTurnFeedbackArrowRating,
    tutorStubTurnFeedbackEnvelope,
    tutorStubTurnFeedbackEscapeDismissal,
    voiceLaunchRequested,
  }) {
    const initialSetupCompleted = await runInitialMixedLearnerSetup();
    if (!initialSetupCompleted) {
      await interactiveDone;
      return;
    }
    persistCurrentInteractiveSettings(resumedDialogue ? 'resume_loaded' : 'session_ready');

    if (args['session-rpc']) {
      const rpcInput = fs.createReadStream('', { fd: 3, autoClose: false });
      const rpcOutput = fs.createWriteStream('', { fd: 4, autoClose: false });
      try {
        const opening = await emitOpeningPrompt('session_rpc_start', {
          display: false,
          realizer: 'deterministic',
          deterministicSource: 'session_rpc',
        });
        const resumeHandoff = opening ? null : emitResumeHandoff('session_rpc_start', { display: false });
        if ((opening || resumeHandoff) && sessionRuntime.status === 'active') {
          sessionRuntime.sync(opening ? 'opening_committed' : 'resume_handoff_committed');
        }
        await runTutorStubSessionRpc({ input: rpcInput, output: rpcOutput, runtime: sessionRuntime });
      } finally {
        if (sessionRuntime.status === 'active') await sessionRuntime.finalize('session_rpc_closed');
        rl.close();
        rpcInput.destroy();
        rpcOutput.end();
      }
      return;
    }

    let slashPaletteRefreshHandle = null;
    let onInteractiveKeypress = null;
    if (input.isTTY && output.isTTY) {
      emitKeypressEvents(input, rl);
      onInteractiveKeypress = (character, key) => {
        if (key?.name === 'tab') {
          const completion = mixedLearnerCompletionForLine(rl.line);
          if (completion && mixedLearner.suggestion?.text) {
            mixedLearner.draftInsertion = {
              insertedAt: new Date().toISOString(),
              lineBeforeInsertion: rl.line,
              completion,
              suggestion: jsonClone(mixedLearner.suggestion),
            };
            appendTraceEvent(state.trace, {
              type: 'mixed_learner_suggestion_inserted',
              turn: mixedLearner.suggestion.turn,
              turnId: mixedLearner.suggestion.turnId,
              requestId: mixedLearner.suggestion.requestId,
              inputMethod: 'tab_completion',
              publicTranscriptChanged: false,
            });
          }
        }
        const feedbackInterfaceBlocked = Boolean(
          exiting || initialSetupStage !== 'off' || scenarioPickerActive || awaitingAnotherScenario,
        );
        const pendingTutorFeedback = tutorStubTurnFeedbackEnvelope(state.turnFeedback);
        const escapeDismissesFeedback = tutorStubTurnFeedbackEscapeDismissal({
          line: rl.line,
          key,
          feedback: pendingTutorFeedback,
          interactiveMode: state.interaction?.mode,
          interfaceBlocked: feedbackInterfaceBlocked,
          selectionActive: lineSelection.snapshot().active,
        });
        if (escapeDismissesFeedback) {
          lineSelection.clear();
          handleTutorFeedbackCommand('off', { source: 'empty_prompt_escape' });
          promptIfIdle();
          return;
        }
        const arrowRating = tutorStubTurnFeedbackArrowRating({
          line: rl.line,
          key,
          feedback: pendingTutorFeedback,
          busy: processingTurn,
          interactiveMode: state.interaction?.mode,
          interfaceBlocked: feedbackInterfaceBlocked,
        });
        if (arrowRating) {
          lineSelection.clear();
          handleTutorFeedbackCommand(arrowRating, {
            source: key.name === 'right' ? 'empty_prompt_right_arrow' : 'empty_prompt_left_arrow',
          });
          promptIfIdle();
          return;
        }
        lineSelection.handleKeypress(character, key);
        if (slashPaletteRefreshHandle) clearImmediate(slashPaletteRefreshHandle);
        slashPaletteRefreshHandle = setImmediate(() => {
          slashPaletteRefreshHandle = null;
          if (exiting || initialSetupStage !== 'off') return;
          const paletteChanged = concurrentTerminal.setPalette(slashCommandPaletteForLine(rl.line));
          if (!paletteChanged) concurrentTerminal.show();
        });
      };
      input.on('keypress', onInteractiveKeypress);
    }

    printInteractionModeBanner({ detail: false });

    rl.on('line', (line) => {
      lineSelection.clear();
      concurrentTerminal.acceptLine();
      if (scenarioPickerActive) return;
      const trimmed = line.trim();
      const draftInsertion = mixedLearner.draftInsertion;
      mixedLearner.draftInsertion = null;
      const draftProvenance = trimmed ? mixedDraftLearnerResponseProvenance(draftInsertion, trimmed) : null;
      if (trimmed === '👍' || trimmed === '👎') {
        handleTutorFeedbackCommand(trimmed === '👍' ? 'up' : 'down', {
          duringTurn: processingTurn,
          source: 'emoji_line',
        });
        promptIfIdle();
        return;
      }
      if (awaitingAnotherScenario && !trimmed) {
        requestExit('dialogue_grounded_closure');
        return;
      }
      if (awaitingAnotherScenario && !trimmed.startsWith('/')) {
        const answer = trimmed.toLowerCase();
        if (['n', 'no', 'no thanks', 'quit', 'exit'].includes(answer)) {
          requestExit('dialogue_grounded_closure');
          return;
        }
        if (['y', 'yes', 'another', 'another scenario'].includes(answer)) {
          void chooseAnotherScenario('', { reason: 'next_scenario_after_closure' }).finally(() => {
            if (!exiting) promptIfIdle();
          });
          return;
        }
        console.log(`${C.dim}type y to choose another scenario, or press Enter to finish${C.reset}`);
        promptIfIdle();
        return;
      }
      if (!trimmed) {
        promptIfIdle();
        return;
      }
      const slashResult = handleSlashCommand(trimmed, { duringTurn: processingTurn });
      if (slashResult) {
        if (typeof slashResult.then === 'function') {
          if (!slashResult.tutorStubBlocksPrompt) promptIfIdle();
          void slashResult.finally(() => {
            promptIfIdle();
          });
        } else {
          promptIfIdle();
        }
        return;
      }
      sessionRuntime.step(trimmed, {
        kind: 'learner',
        context: { source: 'terminal', provenance: draftProvenance },
      });
      promptIfIdle();
    });

    rl.on('SIGINT', () => {
      stopInterimAnimation(state);
      console.log();
      requestExit('sigint');
    });

    rl.on('close', () => {
      exiting = true;
      stopInterimAnimation(state);
      void stopVoiceBridge('terminal_closed');
      if (slashPaletteRefreshHandle) clearImmediate(slashPaletteRefreshHandle);
      if (onInteractiveKeypress) input.removeListener('keypress', onInteractiveKeypress);
      concurrentTerminal.close();
      if (!finalized) finalizeInteractive('exit');
      resolveInteractive();
    });

    const deferOpeningForMixedPrelude = Boolean(mixedLearner.enabled && !instantExistingScenarioOpening);
    const opening = await emitOpeningPrompt('start', {
      display: !deferOpeningForMixedPrelude,
      realizer: instantExistingScenarioOpening ? 'deterministic' : null,
      deterministicSource: instantExistingScenarioOpening ? 'remembered_scenario_instant_opening' : null,
    });
    if (opening) {
      const openingPrefetch = startMixedLearnerPrefetch('opening', {
        refreshPrompt: !deferOpeningForMixedPrelude,
      });
      if (deferOpeningForMixedPrelude) {
        if (openingPrefetch) {
          startInterimAnimation(state, 'preparing scenario', { tutorTurn: state.turns.length + 1 });
          try {
            await openingPrefetch;
          } finally {
            stopInterimAnimation(state);
          }
        }
        printInteractiveTutorOpening(opening);
      }
    } else if (resumedDialogue) {
      const resumeHandoff = emitResumeHandoff('interactive_start');
      if (resumeHandoff) startMixedLearnerPrefetch('resume_handoff');
    }

    if (voiceLaunchRequested && !exiting) {
      await handleVoiceCommand('on', { source: 'launch_flag' });
    }

    if (args.demo && !exiting) {
      await runInteractiveDemo('', { source: 'launch_flag' });
    }

    promptIfIdle();
    await interactiveDone;
  };

  return runtime;
}
