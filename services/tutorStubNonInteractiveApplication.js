/** Run automated or single-message launch modes before a terminal is created. */
export async function runTutorStubNonInteractiveApplication({
  launchApplicationContext,
  sessionApplicationContext,
  ...runtime
}) {
  const {
    C,
    analyzeLearnerTurn,
    appendTraceEvent,
    appendTutorStubTurnFailureTraceRecords,
    args,
    autoLearnerEnabled,
    autoLearnerResolved,
    autoSafetyTurns,
    autoStopOnGrounded,
    autoTurns,
    automaticTechnicalDetailsEnabled,
    buildTutorInterimContext,
    classifierEnabled,
    cliEffort,
    closeoutReportEnabled,
    createTutorStubLearnerResponseProvenance,
    directorContext,
    firstMessage,
    openingEnabled,
    printDialogueCloseout,
    printDirectorPreludeBeforeFirstTutor,
    printExplanatoryDebugTurn,
    printResponseDetails,
    printTutorDagSnapshot,
    printTutorResponse,
    registerPalette,
    registerSelectionEnabled,
    runAutomatedLearnerDialogue,
    runOneTurn,
    saveTranscript,
    startInterimAnimation,
    state,
    stopInterimAnimation,
    traceDisplayPath,
    tutorLearnerDagEnabled,
    tutorStubComprehensionSnapshot,
    tutorStubDagFactDropoutSnapshot,
    tutorStubRegisterPolicyStackId,
    visibleAutoLearnerModel,
    visibleClassifierConfig,
    visibleLearnerRecordModel,
    visibleModel,
    worldBundle,
    writeFieldVisualization,
    writeFinalLearningSummary,
  } = { ...launchApplicationContext, ...sessionApplicationContext, ...runtime };

  if (autoLearnerEnabled) {
    const result = await runAutomatedLearnerDialogue({
      state,
      firstMessage,
      openingEnabled,
      autoLearnerResolved,
      autoLearnerProfile: args['auto-learner-profile'],
      autoTurns,
      autoSafetyTurns,
      autoStopOnGrounded,
      cliEffort,
    });
    appendTraceEvent(state.trace, { type: 'run_end', reason: result.reason, turns: state.turns.length });
    appendTutorStubTurnFailureTraceRecords(state, { sealed: true });
    if (args.save) {
      saveTranscript(args.save, {
        ...visibleModel,
        classifier: classifierEnabled ? visibleClassifierConfig : null,
        tutorLearnerDag: tutorLearnerDagEnabled ? visibleLearnerRecordModel : null,
        dagFactDropout: tutorStubDagFactDropoutSnapshot(state.learnerDag.dropout),
        autoLearner: {
          enabled: true,
          modelRef: args['auto-learner-model'],
          resolved: visibleAutoLearnerModel,
          maxTurns: autoTurns ?? 'until-grounded',
          untilGrounded: autoTurns === null,
          safetyTurns: autoTurns === null ? autoSafetyTurns : null,
          stopOnGrounded: autoStopOnGrounded,
          profile: args['auto-learner-profile'],
        },
        registerSelection: registerSelectionEnabled
          ? {
              enabled: true,
              palette: registerPalette,
              policy: tutorStubRegisterPolicyStackId(state.register.policy, state.register.overlays),
              primaryPolicy: state.register.policy,
              overlayPolicies: state.register.overlays,
              overlayThreshold: state.register.overlayThreshold,
              temperature: state.register.temperature,
              history: state.register.history,
            }
          : null,
        dialogueClosure: state.dialogueClosure,
        comprehension: tutorStubComprehensionSnapshot(state.comprehension, { turn: state.turns.length + 1 }),
        directorContext,
        trace: traceDisplayPath(state.trace),
        fieldVisualization: state.fieldViz?.lastWrite || null,
        world: worldBundle ? { id: worldBundle.world.id, title: worldBundle.world.title, dag: args.dag } : null,
        turns: state.turns,
      });
    }
    if (closeoutReportEnabled) {
      const report = printDialogueCloseout(state, { reason: result.reason, trace: state.trace });
      appendTraceEvent(state.trace, { type: 'closeout_report', reason: result.reason, report });
    }
    try {
      writeFinalLearningSummary(result.reason);
    } catch (error) {
      console.log(`${C.red}learning summary error:${C.reset} ${error.message}\n`);
      appendTraceEvent(state.trace, { type: 'learning_summary_error', reason: result.reason, error: error.message });
    }
    return true;
  }

  if (firstMessage) {
    const startedAtMs = Date.now();
    const analysisStartedAtMs = Date.now();
    const analysis = state.passthrough?.enabled
      ? {
          classification: null,
          tutorLearnerDag: null,
          registerSelection: null,
          previousRegisterEfficacy: null,
        }
      : await analyzeLearnerTurn(firstMessage, state);
    const analysisCompletedAtMs = Date.now();
    const { classification, tutorLearnerDag, registerSelection, previousRegisterEfficacy } = analysis;
    startInterimAnimation(
      state,
      state.passthrough?.enabled ? 'calling speaker' : 'calling tutor',
      state.passthrough?.enabled
        ? { learnerText: firstMessage, tutorTurn: 1 }
        : buildTutorInterimContext({
            learnerText: firstMessage,
            state,
            classification,
            tutorLearnerDag,
            registerSelection,
            previousRegisterEfficacy,
          }),
    );
    let response;
    const tutorStartedAtMs = Date.now();
    try {
      response = await runOneTurn(
        firstMessage,
        state,
        classification,
        tutorLearnerDag,
        registerSelection,
        previousRegisterEfficacy,
        null,
        {
          learnerResponseProvenance: createTutorStubLearnerResponseProvenance({
            authorship: 'human',
            origin: 'launch_first_message',
            inputMethod: 'command_line_argument',
            humanInLoop: true,
          }),
          turnTiming: {
            startedAtMs,
            analysisStartedAtMs,
            analysisCompletedAtMs,
            tutorStartedAtMs,
            analysisSource: state.passthrough?.enabled ? 'disabled' : 'foreground',
            tutorSource: 'foreground',
          },
        },
      );
    } finally {
      stopInterimAnimation(state);
    }
    if (automaticTechnicalDetailsEnabled(state)) printTutorDagSnapshot(response.dagSnapshot);
    printResponseDetails(response, state);
    if (!state.passthrough?.enabled) {
      printDirectorPreludeBeforeFirstTutor(state, { reason: 'first_message_response' });
    }
    printTutorResponse(response, state.stream);
    await printExplanatoryDebugTurn(state);
    writeFieldVisualization(state, { reason: 'once' });
    appendTraceEvent(state.trace, { type: 'run_end', reason: 'once', turns: state.turns.length });
    appendTutorStubTurnFailureTraceRecords(state, { sealed: true });
    if (args.save) {
      saveTranscript(args.save, {
        ...visibleModel,
        classifier: classifierEnabled ? visibleClassifierConfig : null,
        tutorLearnerDag: tutorLearnerDagEnabled ? visibleLearnerRecordModel : null,
        dagFactDropout: tutorStubDagFactDropoutSnapshot(state.learnerDag.dropout),
        registerSelection: registerSelectionEnabled
          ? {
              enabled: true,
              palette: registerPalette,
              policy: tutorStubRegisterPolicyStackId(state.register.policy, state.register.overlays),
              primaryPolicy: state.register.policy,
              overlayPolicies: state.register.overlays,
              overlayThreshold: state.register.overlayThreshold,
              temperature: state.register.temperature,
              history: state.register.history,
            }
          : null,
        dialogueClosure: state.dialogueClosure,
        comprehension: tutorStubComprehensionSnapshot(state.comprehension, { turn: state.turns.length + 1 }),
        directorContext,
        trace: traceDisplayPath(state.trace),
        fieldVisualization: state.fieldViz?.lastWrite || null,
        world: worldBundle ? { id: worldBundle.world.id, title: worldBundle.world.title, dag: args.dag } : null,
        turns: state.turns,
      });
    }
    if (closeoutReportEnabled) {
      const report = printDialogueCloseout(state, { reason: 'once', trace: state.trace });
      appendTraceEvent(state.trace, { type: 'closeout_report', reason: 'once', report });
    }
    try {
      writeFinalLearningSummary('once');
    } catch (error) {
      console.log(`${C.red}learning summary error:${C.reset} ${error.message}\n`);
      appendTraceEvent(state.trace, { type: 'learning_summary_error', reason: 'once', error: error.message });
    }
    return true;
  }

  return false;
}
