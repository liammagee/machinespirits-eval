export function createTutorStubLearningSummaryRuntime(dependencies = {}) {
  const {
    C,
    ROOT,
    TUTOR_STUB_LEARNING_SUMMARY_HTML_SCHEMA,
    appendTraceEvent,
    args,
    buildDialogueLearningSummary,
    launchTutorStubTranscriptHtml,
    learningSummaryReportConfig,
    listTutorStubTuningCandidates,
    output,
    path,
    state,
    traceDir,
    traceDisplayPath,
    tutorStubRegisterPolicyStackId,
    tutorStubTuningSnapshot,
    writeTutorStubLearningSummaryHtml,
  } = dependencies;

  function writeFinalLearningSummary(reason) {
    if (!learningSummaryReportConfig.enabled) return null;
    if (!state.turns.length) return null;
    const summary = buildDialogueLearningSummary(state, { reason, trace: traceDisplayPath(state.trace) });
    summary.session = {
      learnerProfile: args['auto-learner-profile'] || null,
      tutorInstanceId: state.tutorInstance.id,
      tutorInstanceTitle: state.tutorInstance.title,
      tutorRef: state.tuning.activeRef,
      tutorModelRef: state.modelRef,
      tutorProvider: state.resolved.provider,
      tutorModel: state.resolved.model,
      registerPolicy: tutorStubRegisterPolicyStackId(state.register?.policy, state.register?.overlays),
      engagementStanceTemperature: state.register?.temperature ?? null,
      dagMode: state.dagMode,
    };
    summary.tuning = {
      ...tutorStubTuningSnapshot(state.tuning),
      candidates: listTutorStubTuningCandidates(state.tuning),
      promotionPolicy: 'candidate -> canary -> helpful replay validation -> stable promotion',
    };
    const filePath = path.join(traceDir, `${state.debugRunId}-learning-summary.html`);
    const absolute = writeTutorStubLearningSummaryHtml({ summary, filePath });
    const shouldLaunch = Boolean(output.isTTY && process.env.TUTOR_STUB_SUMMARY_OPEN !== '0');
    let launchResult = null;
    if (shouldLaunch) launchResult = launchTutorStubTranscriptHtml(absolute);
    const displayPath = path.relative(ROOT, absolute);
    console.log(`${C.brightGreen}${C.bold}learning summary >${C.reset} ${displayPath}`);
    console.log(
      `${C.dim}  ${shouldLaunch ? 'opened in the default browser' : 'written; browser launch is available in an interactive terminal'} · ${summary.turnCount} completed turn${summary.turnCount === 1 ? '' : 's'}${C.reset}\n`,
    );
    appendTraceEvent(state.trace, {
      type: 'learning_summary_html',
      schema: TUTOR_STUB_LEARNING_SUMMARY_HTML_SCHEMA,
      reason,
      filePath: displayPath,
      turns: summary.turnCount,
      learnerResponseProvenance: summary.learnerResponseProvenance,
      trainingReuse: summary.trainingReuse,
      natural: summary.completion.natural,
      launched: Boolean(launchResult),
    });
    return { filePath: absolute, launched: Boolean(launchResult), summary };
  }

  return Object.freeze({ writeFinalLearningSummary });
}

export function createTutorStubSessionOrchestration(dependencies = {}) {
  const {
    C,
    DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
    ROOT,
    TUTOR_STUB_FEEDBACK_REASONS,
    TUTOR_STUB_OPENING_REQUIREMENTS,
    TUTOR_STUB_TRANSCRIPT_HTML_SCHEMA,
    acknowledgeTutorStubOpeningRelease,
    appendTraceEvent,
    args,
    autoLearnerResolved,
    autoSafetyTurns,
    autoStopOnGrounded,
    autoTurns,
    buildMixedLearnerArtifactsPrompt,
    buildTutorOpening,
    buildTutorStubResumeHandoff,
    classifierEnabled,
    clearStatusLine,
    closeoutReportEnabled,
    combinedLearnerAnalysisEnabled,
    concurrentTerminal,
    continuousUnsafeRegisterAnchorsEnabled,
    createLearnerDagState,
    createScaffoldLifecycle,
    createTutorStubComprehensionState,
    createTutorStubReleasePacingState,
    createTutorStubTurnFeedbackState,
    dagFactDropoutRate,
    dialogueClosureConfig,
    directorContext,
    directorNotesIssuedSoFar,
    entrypointPath,
    finalizeInteractive,
    getCliPresentation,
    input,
    isAwaitingAnotherScenario,
    isExiting,
    isProcessingTurn,
    jsonClone,
    launchTutorStubTranscriptHtml,
    learnerRecordResolved,
    learningSummaryReportConfig,
    listTutorStubTuningCandidates,
    liveModelRoleDefinitions,
    liveModelRoleSnapshot,
    loadedSessionRecipePath,
    mixedLearner,
    mixedLearnerArtifactsSystemPrompt,
    mixedLearnerProfilePresentation,
    mixedLearnerPromptText,
    openingDebugId,
    openingEnabled,
    output,
    path,
    persistCurrentInteractiveSettings,
    pickInitialScenarioWithKeyboard,
    pickWorkplanModuleWithKeyboard,
    printCurriculumModules,
    printInteractiveTutorOpening,
    redactTraceSecrets,
    registerEmpiricalPrior,
    registerOverlayThreshold,
    registerPalette,
    registerPolicy,
    registerPolicyOverlays,
    registerSelectionEnabled,
    registerTemperature,
    releaseSpeed,
    rememberedSettings,
    resetMixedLearnerSuggestion,
    resolveInteractive,
    resolveWorldRef,
    resumedDialogue,
    rl,
    setAwaitingAnotherScenario,
    setExiting,
    setInitialSetupStage,
    setScenarioPickerActive,
    spawnSync,
    state,
    stateRunDebugId,
    stopInterimAnimation,
    summarizeTutorStubLearnerResponseProvenance,
    traceDir,
    traceDisplayPath,
    tutorLearnerDagEnabled,
    tutorStubCliPresentationSnapshot,
    tutorStubComprehensionSnapshot,
    tutorStubCurriculumBundle,
    tutorStubDagFactDropoutSnapshot,
    tutorStubDirectorGuidanceSnapshot,
    tutorStubExactRelaunchCommand,
    tutorStubPublicMessagesForSpeaker,
    tutorStubRegisterPolicyStackId,
    tutorStubReleasePacingSnapshot,
    tutorStubTuningPrompt,
    tutorStubTuningSnapshot,
    tutorStubTurnFeedbackEnvelope,
    tutorStubTurnFeedbackLabel,
    typedActionConfig,
    visibleAutoLearnerModel,
    visibleClassifierConfig,
    visibleLearnerRecordModel,
    visibleModel,
    voiceRuntimeSnapshot,
    worldBundle,
    writeTutorStubTranscriptHtml,
  } = dependencies;

  function transcriptPayload() {
    return {
      ...visibleModel,
      tutorInstance: {
        id: state.tutorInstance.id,
        title: state.tutorInstance.title,
        activeRef: state.tuning.activeRef,
        rolePromptHash: state.tutorInstance.rolePromptHash,
      },
      tuning: {
        ...tutorStubTuningSnapshot(state.tuning),
        candidates: listTutorStubTuningCandidates(state.tuning),
      },
      modelRouting: {
        allRolesOverrideRef: state.modelRouting?.allRolesOverrideRef || null,
        roles: Object.fromEntries(
          Object.keys(liveModelRoleDefinitions).map((role) => [role, liveModelRoleSnapshot(role)]),
        ),
      },
      voice: voiceRuntimeSnapshot(),
      classifier: classifierEnabled ? visibleClassifierConfig : null,
      tutorLearnerDag: tutorLearnerDagEnabled ? visibleLearnerRecordModel : null,
      dagFactDropout: tutorStubDagFactDropoutSnapshot(state.learnerDag.dropout),
      releasePacing: tutorStubReleasePacingSnapshot(state.releasePacing, state.world),
      openingRealization: jsonClone(state.openingRealization),
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
      randomPerformance: jsonClone(state.randomPerformance),
      lightAdaptation: jsonClone(state.lightAdaptation),
      trainingReuse: jsonClone(state.trainingReuse),
      performanceDirectives: jsonClone(state.performanceDirectives),
      dialogueClosure: state.dialogueClosure,
      comprehension: tutorStubComprehensionSnapshot(state.comprehension, { turn: state.turns.length + 1 }),
      interaction: jsonClone(state.interaction),
      turnFeedback: jsonClone(state.turnFeedback),
      responseDetails: jsonClone(state.responseDetails),
      explanatoryDebug: jsonClone(state.explanatoryDebug),
      coach: jsonClone(state.coach),
      directorGuidance: tutorStubDirectorGuidanceSnapshot(state.directorGuidance),
      directorContext,
      trace: traceDisplayPath(state.trace),
      lab: jsonClone(state.lab),
      sessionRecipe: jsonClone(state.sessionRecipe),
      fieldVisualization: state.fieldViz?.lastWrite || null,
      world: worldBundle ? { id: worldBundle.world.id, title: worldBundle.world.title, dag: args.dag } : null,
      turns: state.turns,
    };
  }

  function currentTranscriptHtmlSnapshot() {
    const opening = state.history?.[0]?.role === 'assistant' ? state.history[0].content : null;
    const dropout = tutorStubDagFactDropoutSnapshot(state.learnerDag?.dropout);
    const learnerProfile = mixedLearnerProfilePresentation(mixedLearner.suggestion);
    const learnerMode = mixedLearner.enabled ? 'mixed' : 'human';
    const interactionMode = state.interaction?.mode || 'learner';
    const learnerPromptHistory = mixedLearner.enabled ? jsonClone(mixedLearner.promptHistory) : [];
    const nextLearnerTurn = state.turns.length + 1;
    const tutorPromptTurns = state.turns
      .filter((turn) => turn.prompts?.tutor)
      .map((turn) => ({
        turn: turn.turn,
        turnId: turn.turnId,
        ...jsonClone(turn.prompts.tutor),
      }));
    const relaunchCommand = state.trace?.enabled
      ? tutorStubExactRelaunchCommand({ resume: path.relative(ROOT, state.trace.filePath) })
      : loadedSessionRecipePath
        ? tutorStubExactRelaunchCommand({ recipePath: path.relative(ROOT, loadedSessionRecipePath) })
        : null;

    return redactTraceSecrets({
      schema: TUTOR_STUB_TRANSCRIPT_HTML_SCHEMA,
      generatedAt: new Date().toISOString(),
      runId: state.debugRunId,
      title: state.world?.title || state.topic || 'Tutor Stub Transcript',
      directorContext: jsonClone(state.directorContext),
      directorNotes: directorNotesIssuedSoFar(state),
      directorGuidance: tutorStubDirectorGuidanceSnapshot(state.directorGuidance),
      opening,
      history: jsonClone(state.history),
      turns: jsonClone(state.turns),
      settings: {
        presentation: tutorStubCliPresentationSnapshot(getCliPresentation()),
        responseDetails: jsonClone(state.responseDetails),
        allModelsOverride: state.modelRouting?.allRolesOverrideRef
          ? {
              schema: 'machinespirits.tutor-stub.all-models-override.v1',
              modelRef: state.modelRouting.allRolesOverrideRef,
              roles: Object.keys(liveModelRoleDefinitions),
            }
          : null,
        modelRouting: {
          schema: state.modelRouting?.schema || 'machinespirits.tutor-stub.model-routing.v1',
          allRolesOverrideRef: state.modelRouting?.allRolesOverrideRef || null,
          roles: Object.fromEntries(
            Object.keys(liveModelRoleDefinitions).map((role) => [role, liveModelRoleSnapshot(role)]),
          ),
        },
        voice: voiceRuntimeSnapshot(),
        run: {
          id: state.debugRunId,
          completedTurns: state.turns.length,
          mode: interactionMode,
          learnerMode,
        },
        lab: jsonClone(state.lab),
        recipe: {
          schema: state.sessionRecipe.schema,
          version: state.sessionRecipe.version,
          configHash: state.sessionRecipe.configHash,
          sourceRecipe: loadedSessionRecipePath ? path.relative(ROOT, loadedSessionRecipePath) : null,
          sourceRecipeDrift: jsonClone(state.recipeSource?.drift || null),
          sourceRecipeDriftAcknowledged: Boolean(state.recipeSource?.driftAcknowledged),
          resumeSource: state.resume?.source ? path.relative(ROOT, state.resume.source) : null,
          resumeDrift: jsonClone(state.resume?.drift || null),
          driftAcknowledged: Boolean(state.resume?.driftAcknowledged),
          relaunchCommand,
        },
        world: state.world
          ? {
              id: state.world.id,
              title: state.world.title,
              discipline: state.world.discipline || null,
              question: state.world.question || state.world.publicQuestion || null,
            }
          : {
              id: null,
              title: state.topic,
              discipline: null,
              question: null,
            },
        tutor: {
          instanceId: state.tutorInstance.id,
          instanceTitle: state.tutorInstance.title,
          activeRef: state.tuning.activeRef,
          sourceVersion: state.tutorInstance.sourceVersion,
          rolePromptPath: path.relative(ROOT, state.tutorInstance.rolePromptPath),
          rolePromptHash: state.tutorInstance.rolePromptHash,
          policyPack: jsonClone(state.tutorInstance.policyPack),
          modelRef: state.modelRef,
          provider: state.resolved.provider,
          model: state.resolved.model,
          temperature: state.temperature,
          maxTokens: state.maxTokens,
          cliEffort: state.cliEffort || null,
        },
        classifier: {
          enabled: classifierEnabled,
          combinedWithLearnerDag: combinedLearnerAnalysisEnabled,
          modelRef: args['classifier-model'],
          activeModelRef: classifierEnabled
            ? combinedLearnerAnalysisEnabled
              ? args['learner-record-model']
              : args['classifier-model']
            : null,
          provider: liveModelRoleSnapshot('classifier').resolved.provider,
          model: liveModelRoleSnapshot('classifier').resolved.model,
        },
        learnerRecord: {
          enabled: tutorLearnerDagEnabled,
          modelRef: args['learner-record-model'],
          provider: visibleLearnerRecordModel?.provider || null,
          model: visibleLearnerRecordModel?.model || null,
        },
        learner: {
          mode: learnerMode,
          profileId: mixedLearner.enabled ? learnerProfile.id : null,
          profileName: mixedLearner.enabled ? learnerProfile.name : null,
          profilePattern: mixedLearner.enabled ? learnerProfile.pattern : null,
          modelRef: args['auto-learner-model'],
          provider: visibleAutoLearnerModel?.provider || null,
          model: visibleAutoLearnerModel?.model || null,
        },
        coach: {
          mode: interactionMode === 'coach',
          pending: jsonClone(state.coach?.pending || []),
          applied: jsonClone(state.coach?.history || []),
          publicTranscriptChanged: false,
        },
        directorGuidance: tutorStubDirectorGuidanceSnapshot(state.directorGuidance),
        turnFeedback: {
          enabled: Boolean(state.turnFeedback?.enabled),
          optional: true,
          pending: tutorStubTurnFeedbackLabel(tutorStubTurnFeedbackEnvelope(state.turnFeedback)),
          completedRatings: jsonClone(state.turnFeedback?.history || []),
          automatedLearner: 'disabled',
          typedReasons: Object.keys(TUTOR_STUB_FEEDBACK_REASONS),
        },
        tuning: {
          ...tutorStubTuningSnapshot(state.tuning),
          candidates: listTutorStubTuningCandidates(state.tuning),
          rawCommentsEnterPrompt: false,
          promotionGate: 'approve_to_canary_then_validate_helpful_then_promote',
        },
        automation: {
          available: Boolean(autoLearnerResolved),
          running: Boolean(state.interaction?.autoRunning),
          modelRef: args['auto-learner-model'],
          provider: visibleAutoLearnerModel?.provider || null,
          model: visibleAutoLearnerModel?.model || null,
          profileId: mixedLearner.profileId || 'custom',
          defaultTurns: autoTurns ?? 'until-grounded',
          safetyTurns: autoSafetyTurns,
          stopOnGrounded: autoStopOnGrounded,
        },
        learnerResponseProvenance: summarizeTutorStubLearnerResponseProvenance(state.turns),
        trainingReuse: jsonClone(state.trainingReuse),
        dag: {
          tutorDagEnabled: Boolean(state.dag),
          learnerDagEnabled: tutorLearnerDagEnabled,
          interpretation: state.dagMode,
          discoursePhase: state.humanDiscourse?.phase || null,
          generousInference: Boolean(state.humanDiscourse?.behaviorChange),
        },
        dagFactDropout: dropout,
        releasePacing: tutorStubReleasePacingSnapshot(state.releasePacing, state.world),
        register: {
          enabled: state.register?.enabled || false,
          policy: tutorStubRegisterPolicyStackId(state.register?.policy, state.register?.overlays),
          primaryPolicy: state.register?.policy || null,
          overlayPolicies: state.register?.overlays || [],
          overlayThreshold: state.register?.overlayThreshold ?? null,
          palette: state.register?.palette || [],
          engagementStanceTemperature: state.register?.temperature ?? null,
          temperatureScope: 'engagement_stance_and_actorial_part',
          current: state.register?.current || null,
          empiricalPriorStatus: state.register?.empiricalPriorStatus || null,
        },
        randomPerformance: jsonClone(state.randomPerformance),
        lightAdaptation: jsonClone(state.lightAdaptation),
        performanceDirectives: jsonClone(state.performanceDirectives),
        rememberedDefaults: {
          enabled: Boolean(state.rememberedSettings?.enabled),
          status: state.rememberedSettings?.status || 'disabled',
          file: path.relative(ROOT, state.rememberedSettings?.filePath || rememberedSettings.filePath),
          loadedAt: state.rememberedSettings?.loadedAt || null,
          savedAt: state.rememberedSettings?.savedAt || null,
          appliedFields: state.rememberedSettings?.appliedFields || [],
          scope: 'human_interactive_sessions_only',
        },
        dialogue: {
          memorySummary: Boolean(state.memory?.enabled),
          rawHistoryTurns: state.historyTurns,
          tutorMessageHistory: {
            mode: state.tutorContext?.historyMode || 'full_public_replay',
            activatedBy: state.tutorContext?.activatedBy || 'session_start',
            activatedAtTurn: state.tutorContext?.activatedAtTurn ?? null,
            publicMessageCount: tutorStubPublicMessagesForSpeaker(state.history, { speaker: 'tutor' }).length,
          },
          multipleChoice: state.multipleChoice,
          opening: {
            enabled: openingEnabled,
            realization: jsonClone(state.openingRealization),
            requirements: TUTOR_STUB_OPENING_REQUIREMENTS,
          },
          closeoutReport: closeoutReportEnabled,
          closure: jsonClone(state.dialogueClosure),
        },
        output: {
          stream: state.stream?.enabled || false,
          trace: state.trace?.enabled ? traceDisplayPath(state.trace) : 'off',
          fieldVisualization: state.fieldViz?.enabled || false,
          explanatoryDebug: jsonClone(state.explanatoryDebug),
          learningSummary: {
            enabled: learningSummaryReportConfig.enabled,
            automaticOnConclusion: learningSummaryReportConfig.enabled,
            requiresCompletedTurn: true,
            publicEvidenceOnly: true,
            launchInInteractiveTty: process.env.TUTOR_STUB_SUMMARY_OPEN !== '0',
          },
          concurrentCommands: {
            enabled: concurrentTerminal.enabled,
            activityLine: 'above_prompt',
            inputLine: 'persistent_bottom_line',
            acceptsDuringAutoMode: true,
          },
        },
      },
      prompts: {
        tutor: {
          baseSystemPrompt: state.systemPrompt,
          namedInstance: {
            id: state.tutorInstance.id,
            title: state.tutorInstance.title,
            activeRef: state.tuning.activeRef,
            rolePrompt: state.tutorInstance.rolePrompt,
            rolePromptHash: state.tutorInstance.rolePromptHash,
            reviewedMemory: tutorStubTuningPrompt(state.tuning),
          },
          turns: tutorPromptTurns,
        },
        learner: {
          mode: learnerMode,
          interactionMode,
          activeSystemPrompt: mixedLearner.enabled
            ? mixedLearnerArtifactsSystemPrompt(mixedLearner.profile)
            : 'Human learner input is active; no learner model system prompt is used.',
          nextUserPrompt: mixedLearner.enabled
            ? buildMixedLearnerArtifactsPrompt({
                state,
                profile: mixedLearner.profile,
                turnNumber: nextLearnerTurn,
              })
            : 'Human learner input is active; no learner model user prompt is used.',
          history: learnerPromptHistory,
        },
      },
    });
  }

  function writeCurrentTranscriptHtml({ launch = true, duringTurn = false } = {}) {
    const filePath = path.join(traceDir, `${state.debugRunId}-transcript.html`);
    const absolute = writeTutorStubTranscriptHtml({
      snapshot: currentTranscriptHtmlSnapshot(),
      filePath,
    });
    const shouldLaunch = launch && process.env.TUTOR_STUB_TRANSCRIPT_OPEN !== '0';
    let launchResult = null;
    if (shouldLaunch) launchResult = launchTutorStubTranscriptHtml(absolute);
    const displayPath = path.relative(ROOT, absolute);
    console.log(`${C.cyan}transcript HTML >${C.reset} ${displayPath}`);
    console.log(
      `${C.dim}  ${shouldLaunch ? 'opened in the default browser' : 'written without opening'}; ${state.turns.length} completed turn${state.turns.length === 1 ? '' : 's'}${duringTurn ? '; the in-progress turn is excluded' : ''}${C.reset}\n`,
    );
    appendTraceEvent(state.trace, {
      type: 'transcript_html_snapshot',
      schema: TUTOR_STUB_TRANSCRIPT_HTML_SCHEMA,
      filePath: displayPath,
      turns: state.turns.length,
      duringTurn,
      launched: Boolean(launchResult),
    });
    return { filePath: absolute, launched: Boolean(launchResult) };
  }

  function relaunchArgumentsForScenario(filePath) {
    const current = process.argv.slice(2);
    const next = [];
    const replacedValueOptions = new Set([
      '--all-models',
      '--world',
      '--auto-learner-profile',
      '--model',
      '--classifier-model',
      '--learner-record-model',
      '--auto-learner-model',
      '--register-temperature',
      '--dag-fact-dropout',
      '--release-speed',
      '--register-policy',
      '--register-overlay-threshold',
    ]);
    for (let index = 0; index < current.length; index += 1) {
      const argument = current[index];
      if (argument === '--resume-last') continue;
      if (replacedValueOptions.has(argument)) {
        index += 1;
        continue;
      }
      if ([...replacedValueOptions].some((option) => argument.startsWith(`${option}=`))) continue;
      next.push(argument);
    }
    const modelArguments = state.modelRouting?.allRolesOverrideRef
      ? ['--all-models', state.modelRouting.allRolesOverrideRef]
      : [
          '--model',
          state.modelRef,
          '--classifier-model',
          args['classifier-model'],
          '--learner-record-model',
          args['learner-record-model'],
          '--auto-learner-model',
          args['auto-learner-model'],
        ];
    next.push(
      '--world',
      filePath,
      '--auto-learner-profile',
      state.learnerProfileId || state.learnerProfile,
      ...modelArguments,
      '--register-temperature',
      String(state.register?.temperature ?? registerTemperature),
      '--dag-fact-dropout',
      String(state.learnerDag?.dropout?.rate ?? dagFactDropoutRate),
      '--release-speed',
      String(state.releasePacing?.baseSpeed ?? releaseSpeed),
      '--register-policy',
      tutorStubRegisterPolicyStackId(state.register?.policy, state.register?.overlays),
      '--register-overlay-threshold',
      String(state.register?.overlayThreshold ?? registerOverlayThreshold),
    );
    return next;
  }

  function relaunchWithScenario(selection, reason = 'scenario_changed') {
    const scenarioId = selection?.id || selection?.world?.id;
    const title = selection?.title || selection?.world?.title;
    const filePath = selection?.filePath;
    if (!scenarioId || !filePath) throw new Error('scenario selection is incomplete');
    persistCurrentInteractiveSettings('scenario_selected', { scenarioId });
    appendTraceEvent(state.trace, {
      type: 'next_scenario_selected',
      reason,
      previousScenarioId: state.world?.id || null,
      scenarioId,
      title,
      file: path.relative(ROOT, filePath),
    });
    setAwaitingAnotherScenario(false);
    setExiting(true);
    stopInterimAnimation(state);
    concurrentTerminal.close();
    resetMixedLearnerSuggestion(reason);
    finalizeInteractive(reason);
    rl.close();
    console.log(`${C.brightGreen}${C.bold}next scenario >${C.reset} ${scenarioId} — ${title}`);
    console.log(`${C.dim}  starting a fresh inquiry with your learner profile and dialogue settings${C.reset}\n`);
    const child = spawnSync(process.execPath, [entrypointPath, ...relaunchArgumentsForScenario(filePath)], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
    });
    if (child.error) {
      console.log(`${C.red}scenario launch error:${C.reset} ${child.error.message}`);
      process.exitCode = 1;
    } else if (child.signal) {
      process.exitCode = 1;
    } else {
      process.exitCode = child.status ?? 0;
    }
    resolveInteractive();
  }

  function relaunchArgumentsForWorkplanModule(moduleId) {
    const current = process.argv.slice(2);
    const next = [];
    const replacedValueOptions = new Set([
      '--all-models',
      '--world',
      '--curriculum',
      '--module',
      '--system',
      '--auto-learner-profile',
      '--model',
      '--classifier-model',
      '--learner-record-model',
      '--auto-learner-model',
      '--register-temperature',
      '--dag-fact-dropout',
      '--release-speed',
      '--register-policy',
      '--register-overlay-threshold',
    ]);
    const removedBooleanOptions = new Set([
      '--resume-last',
      '--dag',
      '--tutor-learner-dag',
      '--list-curriculum-modules',
    ]);
    for (let index = 0; index < current.length; index += 1) {
      const argument = current[index];
      if ([...removedBooleanOptions].some((option) => argument === option || argument.startsWith(`${option}=`))) {
        continue;
      }
      if (replacedValueOptions.has(argument)) {
        index += 1;
        continue;
      }
      if ([...replacedValueOptions].some((option) => argument.startsWith(`${option}=`))) continue;
      next.push(argument);
    }
    const modelArguments = state.modelRouting?.allRolesOverrideRef
      ? ['--all-models', state.modelRouting.allRolesOverrideRef]
      : [
          '--model',
          state.modelRef,
          '--classifier-model',
          args['classifier-model'],
          '--learner-record-model',
          args['learner-record-model'],
          '--auto-learner-model',
          args['auto-learner-model'],
        ];
    next.push(
      '--curriculum',
      'workplan',
      '--module',
      moduleId,
      '--auto-learner-profile',
      state.learnerProfileId || state.learnerProfile,
      ...modelArguments,
      '--register-temperature',
      String(state.register?.temperature ?? registerTemperature),
      '--dag-fact-dropout',
      String(state.learnerDag?.dropout?.rate ?? dagFactDropoutRate),
      '--release-speed',
      String(state.releasePacing?.baseSpeed ?? releaseSpeed),
      '--register-policy',
      tutorStubRegisterPolicyStackId(state.register?.policy, state.register?.overlays),
      '--register-overlay-threshold',
      String(state.register?.overlayThreshold ?? registerOverlayThreshold),
    );
    return next;
  }

  function relaunchWithWorkplanModule(selection, reason = 'board_item_changed') {
    const moduleId = selection?.id || selection?.module?.id;
    const title = selection?.title || selection?.module?.title;
    if (!moduleId || !title) throw new Error('workplan selection is incomplete');
    appendTraceEvent(state.trace, {
      type: 'next_curriculum_module_selected',
      reason,
      sourceRef: 'workplan:live',
      previousCurriculumModuleId: state.curriculum?.module?.id || null,
      previousScenarioId: state.world?.id || null,
      moduleId,
      title,
    });
    setAwaitingAnotherScenario(false);
    setExiting(true);
    stopInterimAnimation(state);
    concurrentTerminal.close();
    resetMixedLearnerSuggestion(reason);
    finalizeInteractive(reason);
    rl.close();
    console.log(`${C.brightGreen}${C.bold}next board item >${C.reset} ${moduleId} — ${title}`);
    console.log(
      `${C.dim}  starting a fresh reflective inquiry from the live workplan with your learner profile and dialogue settings${C.reset}\n`,
    );
    const child = spawnSync(process.execPath, [entrypointPath, ...relaunchArgumentsForWorkplanModule(moduleId)], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
    });
    if (child.error) {
      console.log(`${C.red}board launch error:${C.reset} ${child.error.message}`);
      process.exitCode = 1;
    } else if (child.signal) {
      process.exitCode = 1;
    } else {
      process.exitCode = child.status ?? 0;
    }
    resolveInteractive();
  }

  async function chooseAnotherScenario(argument = '', { reason = 'scenario_changed', duringTurn = false } = {}) {
    clearStatusLine();
    if (duringTurn || isProcessingTurn()) {
      console.log(
        `${C.dim}scenario change not started; run /scenario again after the current tutor response completes${C.reset}\n`,
      );
      return false;
    }
    let selection = null;
    const requested = String(argument || '').trim();
    if (requested) {
      try {
        const bundle = resolveWorldRef(requested);
        selection = {
          id: bundle.world.id,
          title: bundle.world.title,
          filePath: bundle.filePath,
          world: bundle.world,
        };
      } catch (error) {
        console.log(`${C.red}scenario error:${C.reset} ${error.message}\n`);
        return false;
      }
    } else if (input.isTTY && output.isTTY && typeof input.setRawMode === 'function') {
      setScenarioPickerActive(true);
      setInitialSetupStage('scenario');
      console.log(`${C.cyan}Pick another scenario${C.reset}`);
      console.log(`${C.dim}  ↑/↓ scroll · Enter select · highlighted scenario described below · Esc return${C.reset}`);
      try {
        selection = await pickInitialScenarioWithKeyboard(state.world?.id || args.world);
      } finally {
        setScenarioPickerActive(false);
        setInitialSetupStage('off');
      }
      if (!selection) {
        rl.setPrompt(
          isAwaitingAnotherScenario()
            ? `${C.brightCyan}${C.bold}another scenario? [y/N] >${C.reset} `
            : mixedLearnerPromptText(),
        );
        console.log(`${C.dim}scenario picker closed; the current inquiry is unchanged${C.reset}\n`);
        return false;
      }
    } else {
      console.log(`${C.cyan}scenario >${C.reset} type /scenario <id> to start another inquiry`);
      console.log(`${C.dim}  run with --list-worlds outside the dialogue to browse scenario ids${C.reset}\n`);
      return false;
    }
    relaunchWithScenario(selection, reason);
    return true;
  }

  async function chooseWorkplanModule(argument = '', { reason = 'board_item_changed', duringTurn = false } = {}) {
    clearStatusLine();
    if (duringTurn || isProcessingTurn()) {
      console.log(
        `${C.dim}board change not started; run /board again after the current tutor response completes${C.reset}\n`,
      );
      return false;
    }
    let selection = null;
    const requested = String(argument || '').trim();
    if (requested) {
      try {
        const selected = tutorStubCurriculumBundle('workplan', requested, { root: ROOT });
        selection = {
          id: selected.module.id,
          title: selected.module.title,
          module: selected.module,
        };
      } catch (error) {
        console.log(`${C.red}board error:${C.reset} ${error.message}\n`);
        return false;
      }
    } else if (input.isTTY && output.isTTY && typeof input.setRawMode === 'function') {
      setScenarioPickerActive(true);
      setInitialSetupStage('board');
      console.log(`${C.cyan}Pick a workplan item${C.reset}`);
      console.log(
        `${C.dim}  ↑/↓ scroll · Enter select · highlighted card described below · Esc return · reads workplan/items live${C.reset}`,
      );
      try {
        selection = await pickWorkplanModuleWithKeyboard(state.curriculum?.module?.id || '');
      } catch (error) {
        console.log(`${C.red}board error:${C.reset} ${error.message}\n`);
        return false;
      } finally {
        setScenarioPickerActive(false);
        setInitialSetupStage('off');
      }
      if (!selection) {
        rl.setPrompt(
          isAwaitingAnotherScenario()
            ? `${C.brightCyan}${C.bold}another scenario? [y/N] >${C.reset} `
            : mixedLearnerPromptText(),
        );
        console.log(`${C.dim}board picker closed; the current inquiry is unchanged${C.reset}\n`);
        return false;
      }
    } else {
      printCurriculumModules('workplan');
      console.log(`${C.cyan}board >${C.reset} type /board <item-id> to start a reflective inquiry\n`);
      return false;
    }
    relaunchWithWorkplanModule(selection, reason);
    return true;
  }

  function emitResumeHandoff(reason = 'start', { display = true } = {}) {
    if (!resumedDialogue || state.resumeHandoff || !state.turns.length) return state.resumeHandoff?.text || null;
    const handoff = buildTutorStubResumeHandoff({ world: state.world, turns: state.turns });
    if (!handoff) return null;
    state.resumeHandoff = handoff;
    state.history.push({ role: 'assistant', content: handoff.text });
    appendTraceEvent(state.trace, {
      type: 'tutor_resume_handoff',
      reason,
      ...handoff,
    });
    if (display && !isExiting()) {
      console.log(`${C.magenta}tutor >${C.reset} ${handoff.text}\n`);
    }
    return handoff.text;
  }

  async function emitOpeningPrompt(
    reason = 'start',
    { display = true, signal = null, realizer = null, deterministicSource = null } = {},
  ) {
    if (!openingEnabled || state.history.length) return null;
    const openingRealization = await buildTutorOpening(state, {
      signal,
      ...(realizer ? { realizer } : {}),
      ...(deterministicSource ? { deterministicSource } : {}),
    });
    const opening = openingRealization.text;
    state.openingRealization = openingRealization;
    state.history.push({ role: 'assistant', content: opening });
    acknowledgeTutorStubOpeningRelease({ pacing: state.releasePacing, world: state.world });
    const turnId = openingDebugId(stateRunDebugId(state));
    appendTraceEvent(state.trace, {
      type: 'tutor_opening',
      turnId,
      reason,
      text: opening,
      realization: openingRealization,
    });
    if (display) printInteractiveTutorOpening(opening);
    return opening;
  }

  function resetInteractiveState() {
    const currentRegisterTemperature =
      state.register?.temperature ?? registerTemperature ?? DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE;
    const currentRegisterOverlays = [...(state.register?.overlays || registerPolicyOverlays)];
    const currentRegisterOverlayThreshold =
      state.register?.overlayThreshold ?? registerOverlayThreshold ?? DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD;
    const currentDagFactDropout = tutorStubDagFactDropoutSnapshot(state.learnerDag?.dropout);
    const currentReleaseSpeed = state.releasePacing?.baseSpeed ?? releaseSpeed;
    state.history = [];
    state.turns = [];
    state.openingRealization = null;
    state.resumeHandoff = null;
    state.coach = { pending: [], history: [] };
    state.turnFeedback = createTutorStubTurnFeedbackState({ enabled: state.turnFeedback?.enabled !== false });
    mixedLearner.promptHistory = [];
    state.printedDebugIds = new Set();
    state.directorOpeningPresented = false;
    state.tutorContext = {
      schema: 'machinespirits.tutor-stub.tutor-context-policy.v2',
      historyMode: 'full_public_replay',
      activatedBy: 'dialogue_reset',
      activatedAtTurn: null,
      modelRef: state.modelRef,
    };
    state.dialogueClosure = { ...dialogueClosureConfig };
    state.learnerDag = createLearnerDagState({
      enabled: tutorLearnerDagEnabled,
      modelRef: args['learner-record-model'],
      resolved: learnerRecordResolved,
      world: worldBundle?.world || null,
      dropout: {
        rate: currentDagFactDropout.rate,
        seed: currentDagFactDropout.seed,
        graceTurns: currentDagFactDropout.graceTurns,
        maxConcurrent: currentDagFactDropout.maxConcurrent,
      },
    });
    state.comprehension = createTutorStubComprehensionState();
    state.releasePacing = createTutorStubReleasePacingState({
      world: state.world,
      speed: currentReleaseSpeed,
    });
    state.typedActions = {
      enabled: state.typedActions?.enabled || false,
      config: state.typedActions?.config || typedActionConfig,
      ledger: [],
      currentDecision: null,
      scaffoldLifecycle: createScaffoldLifecycle(),
    };
    if (state.fieldViz) state.fieldViz.lastWrite = null;
    state.register = {
      enabled: registerSelectionEnabled,
      palette: registerPalette,
      policy: registerPolicy,
      overlays: currentRegisterOverlays,
      overlayThreshold: currentRegisterOverlayThreshold,
      temperature: currentRegisterTemperature,
      continuousUnsafe: continuousUnsafeRegisterAnchorsEnabled,
      empiricalPrior: registerEmpiricalPrior.prior,
      empiricalPriorStatus: registerEmpiricalPrior.status,
      empiricalPriorPath: registerEmpiricalPrior.filePath,
      current: null,
      history: [],
    };
  }

  return {
    chooseAnotherScenario,
    chooseWorkplanModule,
    emitOpeningPrompt,
    emitResumeHandoff,
    resetInteractiveState,
    transcriptPayload,
    writeCurrentTranscriptHtml,
  };
}
