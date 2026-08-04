export function createTutorStubCommandRuntime(dependencies = {}) {
  const {
    C,
    DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
    DEFAULT_TUTOR_STUB_RELEASE_SPEED,
    STUB,
    TUTOR_STUB_CLI_MOTION_IDS,
    TUTOR_STUB_CLI_THEME_IDS,
    TUTOR_STUB_REGISTER_OVERLAY_POLICIES,
    TUTOR_STUB_REGISTER_POLICY_COMPOSITION_SCHEMA,
    acceptMixedLearnerSuggestion,
    answerCliDirectorQuestion,
    appendTraceEvent,
    applyAllRoleModelSelection,
    applyRoleModelSelection,
    applyTutorModelSelection,
    args,
    chooseAnotherScenario,
    chooseLiveNumericSetting,
    chooseLiveRoleModel,
    chooseLiveTutorModel,
    chooseWorkplanModule,
    clearStatusLine,
    collectGitActivity,
    collectGitHubMetrics,
    collectSourceMetrics,
    concurrentTerminal,
    configureCliPresentation,
    discardPendingInteractiveAuto,
    finalizeInteractive,
    forgetRememberedInteractiveSettings,
    formatTutorStubLabList,
    getCliPresentation,
    getTutorStubLab,
    handleCharacterCommand,
    handleCommitteeCommand,
    handleCurriculumModuleCommand,
    handleCurriculumNextCommand,
    handleDirectorGuidanceCommand,
    handleExplicitPerformanceDirectiveCommand,
    handleLightAdaptationCommand,
    handleMixedLearnerProfileCommand,
    handleProofDagCommand,
    handleRandomPerformanceCommand,
    handleResponseDetailsCommand,
    handleTrainingReuseSetting,
    handleTutorFeedbackCommand,
    handleTutorTuningCommand,
    handleVoiceCommand,
    isAwaitingAnotherScenario,
    latestTutorMessage,
    liveModelRoleDefinitions,
    liveSettingsPickerAvailable,
    mixedLearner,
    mixedLearnerPromptText,
    normalizeTutorStubCliMotion,
    normalizeTutorStubCliThemeId,
    normalizeTutorStubDagFactDropoutRate,
    normalizeTutorStubEngagementStanceTemperature,
    normalizeTutorStubRegisterOverlayThreshold,
    normalizeTutorStubReleaseSpeed,
    openLiveSettingsPanel,
    parseTutorStubRegisterPolicyStack,
    pauseInterimAnimation,
    persistCurrentInteractiveSettings,
    pickInitialTutorModelWithKeyboard,
    plainPolicyLabel,
    printCurrentDebugId,
    printCurrentTurnAnalysis,
    printCurriculumProgress,
    printDialogueCloseout,
    printDialogueSettings,
    printDirectorNotesIssuedSoFar,
    printExplanatoryDebugTurn,
    printFieldVisualization,
    printInteractionModeBanner,
    printInteractiveHelp,
    printInteractiveStatus,
    printLightweightDialogueField,
    printModelChoices,
    printTrainingReuseStatus,
    printTutorModelChoices,
    printTutorStubFeatureMap,
    printTutorStubReleaseNotes,
    queueCoachGuidance,
    registerTemperature,
    registerTemperatureApplies,
    renderReport,
    repriseLatestTutorUtterance,
    requestExit,
    resetInteractiveDialogue,
    resetMixedLearnerSuggestion,
    resumeInterimAnimation,
    rl,
    runClarificationCommand,
    runCurriculumTranslationCommand,
    runInteractiveAutoMode,
    runInteractiveDemo,
    setInteractionMode,
    setTutorStubReleaseSpeed,
    showMixedLearnerClue,
    showMixedLearnerSuggestion,
    startMixedLearnerPrefetch,
    state,
    stopInterimAnimation,
    stopVoiceBridge,
    tutorStubCliPresentationSnapshot,
    tutorStubCliThemeOptions,
    tutorStubCliThemePreview,
    tutorStubPublicMessagesForSpeaker,
    tutorStubRegisterPolicyStackId,
    writeCurrentTranscriptHtml,
  } = dependencies;

  async function handleDialogueSettings(argument = '', { duringTurn = false } = {}) {
    clearStatusLine();
    const parts = String(argument || '')
      .trim()
      .split(/\s+/u)
      .filter(Boolean);
    const temperatureNames = ['temp', 'temperature', 'stance-temp'];
    const dropoutNames = ['dropout', 'dag-dropout', 'dag-fact-dropout'];
    const releaseSpeedNames = ['release-speed', 'release_speed', 'pace', 'speed'];
    const lightAdaptationNames = ['light', 'light-adaptation', 'difficulty-shift'];
    const trainingReuseNames = ['training-reuse', 'training_reuse', 'data-reuse', 'data_use'];
    const modelNames = ['model', 'tutor-model'];
    const modelRoleAliases = {
      tutor: 'tutor',
      speaker: 'tutor',
      classifier: 'classifier',
      interpretation: 'classifier',
      assessment: 'classifier',
      reasoning: 'reasoning',
      tracker: 'reasoning',
      'learner-record': 'reasoning',
      learner: 'learner',
      'learner-voice': 'learner',
      auto: 'learner',
    };
    if (state.passthrough?.enabled && !parts.length) {
      console.log(`${C.cyan}passthrough settings >${C.reset}`);
      console.log(
        `${C.dim}  speaker model: ${state.modelRef} → ${state.resolved.provider}/${state.resolved.model}; effort ${state.cliEffort || 'provider default'}${C.reset}`,
      );
      printTrainingReuseStatus();
      console.log(
        `${C.dim}  use /settings model, /settings training-reuse on|off, /theme, or /motion; teaching-policy settings are bypassed${C.reset}\n`,
      );
      return;
    }
    if (
      state.passthrough?.enabled &&
      ![...modelNames, ...trainingReuseNames, 'theme', 'motion'].includes(String(parts[0] || '').toLowerCase())
    ) {
      console.log(
        `${C.dim}only the speaker model, training reuse, and terminal appearance are adjustable in passthrough mode; use /settings model, /settings training-reuse, /theme, or /motion${C.reset}\n`,
      );
      return;
    }
    if (!parts.length) {
      if (liveSettingsPickerAvailable() && !duringTurn) {
        await openLiveSettingsPanel();
      } else {
        printDialogueSettings();
        if (duringTurn && liveSettingsPickerAvailable()) {
          console.log(`${C.dim}  interactive editing is available after the current tutor turn completes${C.reset}\n`);
        }
      }
      return;
    }
    if (parts.length === 1 && modelNames.includes(parts[0].toLowerCase())) {
      if (liveSettingsPickerAvailable() && !duringTurn) await chooseLiveTutorModel();
      else printTutorModelChoices();
      return;
    }
    if (
      parts.length === 1 &&
      [...temperatureNames, ...dropoutNames, ...releaseSpeedNames].includes(parts[0].toLowerCase())
    ) {
      if (liveSettingsPickerAvailable() && !duringTurn) {
        const requested = parts[0].toLowerCase();
        await chooseLiveNumericSetting(
          temperatureNames.includes(requested)
            ? 'stance_temp'
            : releaseSpeedNames.includes(requested)
              ? 'release_speed'
              : 'dropout',
        );
      } else {
        printDialogueSettings();
      }
      return;
    }
    const setting = parts[0].toLowerCase();
    if (trainingReuseNames.includes(setting)) {
      if (parts.length > 2) {
        console.log(`${C.red}settings error:${C.reset} use /settings training-reuse on|off|status\n`);
        return;
      }
      handleTrainingReuseSetting(parts[1] || 'status');
      return;
    }
    if (lightAdaptationNames.includes(setting)) {
      if (parts.length > 2) {
        console.log(`${C.red}settings error:${C.reset} use /settings light, or /settings light on|off|status\n`);
        return;
      }
      handleLightAdaptationCommand(parts[1] || 'status', { duringTurn });
      return;
    }
    if (setting === 'theme') {
      if (parts.length === 1) {
        console.log(`${C.accent}${C.bold}themes >${C.reset} current ${getCliPresentation().themeLabel}`);
        console.log(`${C.dim}  choose ${TUTOR_STUB_CLI_THEME_IDS.join(' · ')}${C.reset}\n`);
        return;
      }
      try {
        const previous = getCliPresentation().themeId;
        args.theme = normalizeTutorStubCliThemeId(parts[1], { strict: true });
        configureCliPresentation({
          theme: args.theme,
          motion: getCliPresentation().requestedMotion,
          noColor: args['no-color'],
        });
        state.presentation = tutorStubCliPresentationSnapshot(getCliPresentation());
        rl.setPrompt(mixedLearnerPromptText());
        const remembered = persistCurrentInteractiveSettings('terminal_theme_changed');
        appendTraceEvent(state.trace, {
          type: 'terminal_presentation_changed',
          axis: 'theme',
          previous,
          current: getCliPresentation().themeId,
          presentation: state.presentation,
          duringTurn,
        });
        console.log(`${C.accent}${C.bold}settings >${C.reset} theme → ${getCliPresentation().themeLabel}`);
        console.log(
          `${C.dim}  ${tutorStubCliThemePreview(getCliPresentation())}${remembered ? ' · remembered' : ''}${C.reset}\n`,
        );
      } catch (error) {
        console.log(`${C.danger}settings error:${C.reset} ${error.message}\n`);
      }
      return;
    }
    if (setting === 'motion') {
      if (parts.length === 1) {
        console.log(
          `${C.accent2}${C.bold}motion >${C.reset} ${getCliPresentation().requestedMotion} selected · ${getCliPresentation().motion} active`,
        );
        console.log(`${C.dim}  choose ${TUTOR_STUB_CLI_MOTION_IDS.join(' · ')}${C.reset}\n`);
        return;
      }
      try {
        const previous = getCliPresentation().requestedMotion;
        args.motion = normalizeTutorStubCliMotion(parts[1], { strict: true });
        configureCliPresentation({
          theme: getCliPresentation().themeId,
          motion: args.motion,
          noColor: args['no-color'],
        });
        state.presentation = tutorStubCliPresentationSnapshot(getCliPresentation());
        const remembered = persistCurrentInteractiveSettings('terminal_motion_changed');
        appendTraceEvent(state.trace, {
          type: 'terminal_presentation_changed',
          axis: 'motion',
          previous,
          current: getCliPresentation().requestedMotion,
          resolved: getCliPresentation().motion,
          presentation: state.presentation,
          duringTurn,
        });
        console.log(
          `${C.accent2}${C.bold}settings >${C.reset} motion → ${getCliPresentation().requestedMotion} (${getCliPresentation().motion} here)`,
        );
        console.log(`${C.dim}  ${remembered ? 'remembered for next time' : 'applies to this session'}${C.reset}\n`);
      } catch (error) {
        console.log(`${C.danger}settings error:${C.reset} ${error.message}\n`);
      }
      return;
    }
    if (setting === 'models') {
      if (parts.length === 1) {
        printDialogueSettings();
        return;
      }
      const requestedRole = String(parts[1] || '').toLowerCase();
      const role = modelRoleAliases[requestedRole] || null;
      if (requestedRole !== 'all' && !role) {
        console.log(
          `${C.red}settings error:${C.reset} use /settings models all|tutor|classifier|reasoning|learner [provider.alias]\n`,
        );
        return;
      }
      if (parts.length === 2) {
        if (liveSettingsPickerAvailable() && !duringTurn) {
          if (requestedRole === 'all') {
            console.log(`${C.brightCyan}${C.bold}One model for all roles · choose with ↑/↓ and Enter${C.reset}`);
            const selection = await pickInitialTutorModelWithKeyboard(
              state.modelRouting?.allRolesOverrideRef || state.modelRef,
            );
            if (selection) await handleDialogueSettings(`models all ${selection.ref}`);
          } else {
            await chooseLiveRoleModel(role);
          }
        } else if (requestedRole === 'all') {
          printTutorModelChoices();
        } else {
          printModelChoices(role);
        }
        return;
      }
      if (parts.length !== 3) {
        console.log(
          `${C.red}settings error:${C.reset} use /settings models all|tutor|classifier|reasoning|learner <provider.alias>\n`,
        );
        return;
      }
      if (duringTurn) {
        console.log(`${C.dim}model routing is unchanged while a tutor turn is in progress${C.reset}`);
        console.log(`${C.dim}  change it after the response so each turn uses one stable route${C.reset}\n`);
        appendTraceEvent(state.trace, {
          type: 'role_model_change_rejected',
          reason: 'turn_in_progress',
          role: requestedRole,
          requested: parts[2],
          turn: state.turns.length + 1,
        });
        return;
      }
      const defaultRef = requestedRole === 'all' ? STUB.model : liveModelRoleDefinitions[role].defaultRef;
      const requestedRef = parts[2].toLowerCase() === 'default' ? defaultRef : parts[2];
      let selected;
      try {
        selected =
          requestedRole === 'all'
            ? applyAllRoleModelSelection(requestedRef, { source: 'live_settings' })
            : applyRoleModelSelection(role, requestedRef, { source: 'live_settings' });
      } catch (error) {
        console.log(`${C.red}settings error:${C.reset} ${error.message}\n`);
        return;
      }
      const label = requestedRole === 'all' ? 'all roles' : liveModelRoleDefinitions[role].label.toLowerCase();
      if (!selected.changed && state.modelRouting?.allRolesOverrideRef === requestedRef) {
        console.log(`${C.cyan}settings >${C.reset} ${label} already use ${selected.modelRef}\n`);
        return;
      }
      console.log(
        `${C.cyan}settings >${C.reset} ${label} → ${selected.modelRef}; applies from turn ${state.turns.length + 1}`,
      );
      console.log(`${C.dim}  resolved as ${selected.resolved.provider}/${selected.resolved.model}${C.reset}`);
      if (requestedRole === 'all') {
        console.log(
          `${C.dim}  tutor, interpretation, reasoning tracker, and learner voice now share this model${C.reset}`,
        );
      } else {
        console.log(`${C.dim}  other model roles keep their current selections${C.reset}`);
      }
      if (latestTutorMessage(state)) {
        startMixedLearnerPrefetch(`${requestedRole}_model_changed`);
        console.log(
          `${C.dim}  rebuilding any affected learner suggestion, analysis, and prefetched tutor reply${C.reset}`,
        );
      }
      console.log();
      return;
    }
    if (setting === 'forget' && parts.length === 1) {
      if (duringTurn) {
        console.log(`${C.dim}saved settings cannot be changed while the tutor is responding${C.reset}\n`);
        return;
      }
      const forgotten = forgetRememberedInteractiveSettings({ source: 'live_settings' });
      console.log(
        `${C.cyan}settings >${C.reset} ${forgotten.existed ? 'saved settings forgotten' : 'there were no saved settings'}`,
      );
      console.log(`${C.dim}  this conversation is unchanged; the next one starts from its launch settings${C.reset}\n`);
      return;
    }
    if (modelNames.includes(setting)) {
      if (parts.length !== 2) {
        console.log(`${C.red}settings error:${C.reset} use /settings model or /settings model <provider.alias>\n`);
        return;
      }
      if (duringTurn) {
        console.log(`${C.dim}tutor model is unchanged while a tutor turn is in progress${C.reset}`);
        console.log(`${C.dim}  change it after the response so the whole turn uses one model${C.reset}\n`);
        appendTraceEvent(state.trace, {
          type: 'tutor_model_change_rejected',
          reason: 'turn_in_progress',
          requested: parts[1],
          turn: state.turns.length + 1,
        });
        return;
      }
      const requestedRef = parts[1].toLowerCase() === 'default' ? STUB.model : parts[1];
      let selected;
      try {
        selected = applyTutorModelSelection(requestedRef, { source: 'live_settings' });
      } catch (error) {
        console.log(`${C.red}settings error:${C.reset} ${error.message}\n`);
        return;
      }
      if (!selected.changed) {
        console.log(`${C.cyan}settings >${C.reset} tutor model already ${selected.modelRef}\n`);
        return;
      }
      console.log(
        `${C.cyan}settings >${C.reset} tutor model ${selected.previousRef || 'previous'} → ${selected.modelRef}; applies from turn ${state.turns.length + 1}`,
      );
      console.log(`${C.dim}  resolved as ${selected.resolved.provider}/${selected.resolved.model}${C.reset}`);
      console.log(
        `${C.dim}  the new tutor model will continue replaying all ${
          tutorStubPublicMessagesForSpeaker(state.history, { speaker: 'tutor' }).length
        } earlier public messages before every later response${C.reset}`,
      );
      if (mixedLearner.enabled && latestTutorMessage(state)) {
        startMixedLearnerPrefetch('tutor_model_changed');
        console.log(`${C.dim}  rebuilding the learner suggestion, its analysis, and the next tutor response${C.reset}`);
      }
      console.log();
      return;
    }
    if (setting === 'policy' || setting === 'policies' || setting === 'overlay' || setting === 'overlays') {
      if (parts.length === 1) {
        printDialogueSettings();
        return;
      }
      if (duringTurn) {
        console.log(`${C.dim}teaching-style overrides cannot be changed while the tutor is responding${C.reset}`);
        console.log(`${C.dim}  change them afterward so the whole turn uses one set of settings${C.reset}\n`);
        appendTraceEvent(state.trace, {
          type: 'register_policy_composition_change_rejected',
          reason: 'turn_in_progress',
          requested: parts.slice(1),
          turn: state.turns.length + 1,
        });
        return;
      }
      const action = String(parts[1] || '').toLowerCase();
      let nextOverlays = [...(state.register?.overlays || [])];
      let nextThreshold = state.register?.overlayThreshold ?? DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD;
      try {
        if (action === 'add') {
          const overlay = String(parts[2] || '')
            .toLowerCase()
            .replace(/-/gu, '_');
          if (parts.length !== 3 || !TUTOR_STUB_REGISTER_OVERLAY_POLICIES.includes(overlay)) {
            throw new Error(`policy add expects ${TUTOR_STUB_REGISTER_OVERLAY_POLICIES.join(' or ')}`);
          }
          nextOverlays = [...new Set([...nextOverlays, overlay])];
        } else if (action === 'remove') {
          const overlay = String(parts[2] || '')
            .toLowerCase()
            .replace(/-/gu, '_');
          if (parts.length !== 3 || !TUTOR_STUB_REGISTER_OVERLAY_POLICIES.includes(overlay)) {
            throw new Error(`policy remove expects ${TUTOR_STUB_REGISTER_OVERLAY_POLICIES.join(' or ')}`);
          }
          nextOverlays = nextOverlays.filter((entry) => entry !== overlay);
        } else if (action === 'clear') {
          if (parts.length !== 2) throw new Error('policy clear takes no additional argument');
          nextOverlays = [];
        } else if (action === 'threshold') {
          if (parts.length !== 3) throw new Error('policy threshold expects one number from 0 to 1');
          nextThreshold = normalizeTutorStubRegisterOverlayThreshold(parts[2], {
            label: 'register overlay threshold',
          });
        } else {
          throw new Error('use policy add <state|field>, remove <state|field>, clear, or threshold <0-1>');
        }
        parseTutorStubRegisterPolicyStack(tutorStubRegisterPolicyStackId(state.register.policy, nextOverlays));
      } catch (error) {
        console.log(`${C.red}settings error:${C.reset} ${error.message}\n`);
        return;
      }
      const previous = {
        overlays: [...(state.register?.overlays || [])],
        threshold: state.register?.overlayThreshold ?? DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
      };
      const unchanged =
        previous.threshold === nextThreshold &&
        previous.overlays.length === nextOverlays.length &&
        previous.overlays.every((overlay, index) => overlay === nextOverlays[index]);
      if (unchanged) {
        console.log(
          `${C.cyan}settings >${C.reset} teaching approach is already ${tutorStubRegisterPolicyStackId(
            state.register.policy,
            state.register.overlays,
          )}; override sensitivity ${nextThreshold}\n`,
        );
        return;
      }
      state.register.overlays = nextOverlays;
      state.register.overlayThreshold = nextThreshold;
      const invalidated = resetMixedLearnerSuggestion('register_policy_composition_changed');
      const remembered = persistCurrentInteractiveSettings('register_policy_composition_changed');
      appendTraceEvent(state.trace, {
        type: 'register_policy_composition_changed',
        schema: TUTOR_STUB_REGISTER_POLICY_COMPOSITION_SCHEMA,
        primaryPolicy: state.register.policy,
        previous,
        overlays: nextOverlays,
        threshold: nextThreshold,
        policyStack: tutorStubRegisterPolicyStackId(state.register.policy, nextOverlays),
        effectiveTurn: state.turns.length + 1,
        rememberedAt: remembered?.updatedAt || null,
        cacheRefresh: {
          priorStateCleared: Boolean(invalidated?.hadState),
          analysisDiscarded: Boolean(invalidated?.discardedAnalysis),
          tutorResponseDiscarded: Boolean(invalidated?.discardedTutorResponse),
        },
      });
      console.log(
        `${C.cyan}settings >${C.reset} teaching approach ${tutorStubRegisterPolicyStackId(
          state.register.policy,
          nextOverlays,
        )}; override sensitivity ${nextThreshold}; applies from turn ${state.turns.length + 1}`,
      );
      console.log(
        `${C.dim}  the normal approach selects first; a strong turn or conversation change can override it${C.reset}`,
      );
      if (mixedLearner.enabled && latestTutorMessage(state)) {
        startMixedLearnerPrefetch('register_policy_composition_changed');
        console.log(`${C.dim}  rebuilding the learner suggestion, its analysis, and the next tutor response${C.reset}`);
      }
      console.log();
      return;
    }
    if (![...temperatureNames, ...dropoutNames, ...releaseSpeedNames].includes(setting) || parts.length !== 2) {
      console.log(
        `${C.red}settings error:${C.reset} use /settings, /settings model [provider.alias], /settings stance-temp <n>, /settings dropout <0-1>, /settings light on|off, /settings release-speed <0.5-2>, /settings policy add <state|field>, or /settings forget`,
      );
      console.log(
        `${C.dim}  examples: /settings model codex.gpt-5.6-luna | /settings temp 0.4 | /settings dropout 0.15 | /settings light off | /settings release-speed 1.5${C.reset}\n`,
      );
      return;
    }
    if (duringTurn) {
      console.log(`${C.dim}dialogue settings cannot be changed while the tutor is responding${C.reset}`);
      console.log(`${C.dim}  change them afterward so the whole turn uses one value${C.reset}\n`);
      appendTraceEvent(state.trace, {
        type: 'dialogue_setting_change_rejected',
        setting,
        reason: 'turn_in_progress',
        requested: parts[1],
        turn: state.turns.length + 1,
      });
      return;
    }

    if (dropoutNames.includes(setting)) {
      let nextRate;
      try {
        nextRate = normalizeTutorStubDagFactDropoutRate(parts[1], { label: 'evidence-memory dropout' });
      } catch (error) {
        console.log(`${C.red}settings error:${C.reset} ${error.message}\n`);
        return;
      }
      const previousRate = state.learnerDag.dropout.rate;
      if (nextRate === previousRate) {
        console.log(`${C.cyan}settings >${C.reset} evidence-memory dropout is already ${nextRate}\n`);
        return;
      }
      state.learnerDag.dropout.rate = nextRate;
      const invalidated = resetMixedLearnerSuggestion('dag_fact_dropout_changed');
      const remembered = persistCurrentInteractiveSettings('dag_fact_dropout_changed');
      appendTraceEvent(state.trace, {
        type: 'dag_fact_dropout_changed',
        schema: 'machinespirits.tutor-stub.dag-fact-dropout-change.v1',
        previous: previousRate,
        rate: nextRate,
        seed: state.learnerDag.dropout.seed,
        effectiveTurn: state.turns.length + 1,
        activeDroppedCount: Object.keys(state.learnerDag.dropout.activeDropped || {}).length,
        rememberedAt: remembered?.updatedAt || null,
        cacheRefresh: {
          priorStateCleared: Boolean(invalidated?.hadState),
          analysisDiscarded: Boolean(invalidated?.discardedAnalysis),
          tutorResponseDiscarded: Boolean(invalidated?.discardedTutorResponse),
        },
      });
      console.log(
        `${C.cyan}settings >${C.reset} evidence-memory dropout ${previousRate} → ${nextRate}; applies from turn ${state.turns.length + 1}`,
      );
      console.log(
        `${C.dim}  ${nextRate === 0 ? 'new forgetting is off; anything already forgotten can still be recalled in dialogue or reset with /reset' : 'previously understood evidence can now be temporarily forgotten at this per-turn rate'}${C.reset}`,
      );
      if (!state.learnerDag.enabled) {
        console.log(`${C.dim}  saved but inactive because learner evidence tracking is off${C.reset}`);
      }
      if (mixedLearner.enabled && latestTutorMessage(state)) {
        startMixedLearnerPrefetch('dag_fact_dropout_changed');
        console.log(`${C.dim}  rebuilding the learner suggestion, its analysis, and the next tutor response${C.reset}`);
      }
      console.log();
      return;
    }

    if (releaseSpeedNames.includes(setting)) {
      let nextSpeed;
      try {
        nextSpeed = normalizeTutorStubReleaseSpeed(parts[1], { label: 'clue release speed' });
      } catch (error) {
        console.log(`${C.red}settings error:${C.reset} ${error.message}\n`);
        return;
      }
      const previousSpeed = state.releasePacing?.baseSpeed ?? DEFAULT_TUTOR_STUB_RELEASE_SPEED;
      if (nextSpeed === previousSpeed) {
        console.log(`${C.cyan}settings >${C.reset} clue release speed is already ${nextSpeed}x\n`);
        return;
      }
      const releasePacing = setTutorStubReleaseSpeed({
        pacing: state.releasePacing,
        world: state.world,
        speed: nextSpeed,
        turn: state.turns.length + 1,
      });
      const invalidated = resetMixedLearnerSuggestion('release_speed_changed');
      const remembered = persistCurrentInteractiveSettings('release_speed_changed');
      appendTraceEvent(state.trace, {
        type: 'release_speed_changed',
        schema: 'machinespirits.tutor-stub.release-speed-change.v1',
        previous: previousSpeed,
        speed: nextSpeed,
        effectiveSpeed: releasePacing?.effectiveSpeed ?? nextSpeed,
        effectiveTurn: state.turns.length + 1,
        rememberedAt: remembered?.updatedAt || null,
        releasePacing,
        cacheRefresh: {
          priorStateCleared: Boolean(invalidated?.hadState),
          analysisDiscarded: Boolean(invalidated?.discardedAnalysis),
          tutorResponseDiscarded: Boolean(invalidated?.discardedTutorResponse),
        },
      });
      console.log(
        `${C.cyan}settings >${C.reset} clue release speed ${previousSpeed}x → ${nextSpeed}x; applies from turn ${state.turns.length + 1}`,
      );
      console.log(
        `${C.dim}  1x follows the authored schedule; the learner can still ask to move faster or slow down${C.reset}`,
      );
      if (mixedLearner.enabled && latestTutorMessage(state)) {
        startMixedLearnerPrefetch('release_speed_changed');
        console.log(`${C.dim}  rebuilding the learner suggestion, its analysis, and the next tutor response${C.reset}`);
      }
      console.log();
      return;
    }

    let nextTemperature;
    try {
      nextTemperature = normalizeTutorStubEngagementStanceTemperature(parts[1], {
        label: 'teaching-style range',
      });
    } catch (error) {
      console.log(`${C.red}settings error:${C.reset} ${error.message}\n`);
      return;
    }
    const previousTemperature = state.register?.temperature ?? registerTemperature;
    if (nextTemperature === previousTemperature) {
      console.log(`${C.cyan}settings >${C.reset} teaching-style range is already ${nextTemperature}\n`);
      return;
    }

    state.register.temperature = nextTemperature;
    const invalidated = resetMixedLearnerSuggestion('register_temperature_changed');
    const remembered = persistCurrentInteractiveSettings('register_temperature_changed');
    appendTraceEvent(state.trace, {
      type: 'register_temperature_changed',
      schema: 'machinespirits.tutor-stub.engagement-stance-temperature-change.v1',
      previous: previousTemperature,
      temperature: nextTemperature,
      policy: state.register.policy,
      active: registerTemperatureApplies(state.register.policy),
      scope: 'engagement_stance_and_actorial_part',
      effectiveTurn: state.turns.length + 1,
      rememberedAt: remembered?.updatedAt || null,
      cacheRefresh: {
        priorStateCleared: Boolean(invalidated?.hadState),
        analysisDiscarded: Boolean(invalidated?.discardedAnalysis),
        tutorResponseDiscarded: Boolean(invalidated?.discardedTutorResponse),
      },
    });
    console.log(
      `${C.cyan}settings >${C.reset} teaching-style range ${previousTemperature} → ${nextTemperature}; applies to style and part from turn ${state.turns.length + 1}`,
    );
    console.log(
      `${C.dim}  ${nextTemperature < previousTemperature ? 'the next style and part choices will be sharper' : 'the next style and part choices will be broader'}${C.reset}`,
    );
    if (!registerTemperatureApplies(state.register.policy)) {
      console.log(
        `${C.dim}  the current teaching approach, ${plainPolicyLabel(state.register.policy)}, does not use this setting${C.reset}`,
      );
    }
    if (mixedLearner.enabled && latestTutorMessage(state)) {
      startMixedLearnerPrefetch('register_temperature_changed');
      console.log(`${C.dim}  rebuilding the learner suggestion, its analysis, and the next tutor response${C.reset}`);
    }
    console.log();
  }

  function executeSlashCommand({ canonicalToken, token: invokedToken = canonicalToken, argument = '', context = {} }) {
    const duringTurn = Boolean(context.duringTurn);
    const command = canonicalToken;
    const commandArg = argument;
    const trimmed = [command, commandArg].filter(Boolean).join(' ');
    if (trimmed === '/quit' || trimmed === '/exit') {
      if (duringTurn) {
        discardPendingInteractiveAuto('exit_requested_during_turn', { source: invokedToken });
        stopInterimAnimation(state);
        concurrentTerminal.close();
        clearStatusLine();
        console.log(`${C.dim}exit requested; stopping this stub now${C.reset}`);
        void stopVoiceBridge('exit_requested_during_turn');
        resetMixedLearnerSuggestion('exit_requested_during_turn');
        finalizeInteractive('exit_requested_during_turn');
        process.exit(0);
      }
      requestExit('exit');
      return true;
    }
    if ((command === '/reset' || command === '/clear') && !commandArg) {
      return resetInteractiveDialogue({ command, duringTurn });
    }
    const pausedInterim = duringTurn ? pauseInterimAnimation(state) : false;
    let slashCommandFinished = false;
    const finishSlashCommand = ({ reprise = true } = {}) => {
      if (slashCommandFinished) return;
      slashCommandFinished = true;
      if (reprise) repriseLatestTutorUtterance(command, { duringTurn });
      if (pausedInterim || (duringTurn && state.interim?.active?.paused)) resumeInterimAnimation(state);
    };
    if (command === '/theme') {
      try {
        const requested = commandArg ? normalizeTutorStubCliThemeId(commandArg, { strict: true }) : null;
        if (requested) {
          const previous = getCliPresentation().themeId;
          args.theme = requested;
          configureCliPresentation({
            theme: requested,
            motion: getCliPresentation().requestedMotion,
            noColor: args['no-color'],
          });
          state.presentation = tutorStubCliPresentationSnapshot(getCliPresentation());
          rl.setPrompt(mixedLearnerPromptText());
          const remembered = persistCurrentInteractiveSettings('terminal_theme_changed');
          appendTraceEvent(state.trace, {
            type: 'terminal_presentation_changed',
            axis: 'theme',
            previous,
            current: requested,
            presentation: state.presentation,
            duringTurn,
          });
          console.log(
            `${C.accent}${C.bold}theme >${C.reset} ${getCliPresentation().themeLabel} · ${getCliPresentation().themeDescription}`,
          );
          console.log(`${C.dim}  ${tutorStubCliThemePreview(getCliPresentation())}${C.reset}`);
          console.log(`${C.dim}  ${remembered ? 'remembered for next time' : 'applies to this session'}${C.reset}\n`);
        } else {
          console.log(
            `${C.accent}${C.bold}themes >${C.reset} ${getCliPresentation().themeLabel} is active · /theme <name> switches instantly`,
          );
          for (const option of tutorStubCliThemeOptions()) {
            const marker =
              option.id === getCliPresentation().themeId ? `${C.success}◆${C.reset}` : `${C.border}◇${C.reset}`;
            console.log(
              `  ${marker} ${option.id.padEnd(13)} ${C.bold}${option.label}${C.reset} ${C.dim}— ${option.description}${C.reset}`,
            );
          }
          console.log(`${C.dim}  NO_COLOR and --no-color are always respected${C.reset}\n`);
        }
      } catch (error) {
        console.log(`${C.danger}theme error:${C.reset} ${error.message}\n`);
      }
      finishSlashCommand();
      return true;
    }
    if (command === '/motion') {
      try {
        const requested = commandArg ? normalizeTutorStubCliMotion(commandArg, { strict: true }) : null;
        if (requested) {
          const previous = getCliPresentation().requestedMotion;
          args.motion = requested;
          configureCliPresentation({
            theme: getCliPresentation().themeId,
            motion: requested,
            noColor: args['no-color'],
          });
          state.presentation = tutorStubCliPresentationSnapshot(getCliPresentation());
          const remembered = persistCurrentInteractiveSettings('terminal_motion_changed');
          appendTraceEvent(state.trace, {
            type: 'terminal_presentation_changed',
            axis: 'motion',
            previous,
            current: requested,
            resolved: getCliPresentation().motion,
            presentation: state.presentation,
            duringTurn,
          });
          console.log(
            `${C.accent2}${C.bold}motion >${C.reset} ${requested}${
              requested === getCliPresentation().motion ? '' : ` → ${getCliPresentation().motion} in this terminal`
            }`,
          );
          console.log(
            `${C.dim}  full is fluid · subtle is calm · off is still; auto respects TTY, CI, and reduced-motion signals${remembered ? ' · remembered' : ''}${C.reset}\n`,
          );
        } else {
          console.log(
            `${C.accent2}${C.bold}motion >${C.reset} ${getCliPresentation().requestedMotion} selected · ${getCliPresentation().motion} active`,
          );
          console.log(`${C.dim}  choose ${TUTOR_STUB_CLI_MOTION_IDS.join(' · ')}${C.reset}\n`);
        }
      } catch (error) {
        console.log(`${C.danger}motion error:${C.reset} ${error.message}\n`);
      }
      finishSlashCommand();
      return true;
    }
    if (command === '/committee') {
      handleCommitteeCommand(commandArg, { duringTurn });
      finishSlashCommand();
      return true;
    }
    if (command === '/details') {
      handleResponseDetailsCommand(commandArg, { duringTurn, source: '/details' });
      finishSlashCommand();
      return true;
    }
    if (command === '/random') {
      handleRandomPerformanceCommand(commandArg, { duringTurn });
      finishSlashCommand();
      return true;
    }
    if (command === '/light') {
      handleLightAdaptationCommand(commandArg, { duringTurn });
      finishSlashCommand();
      return true;
    }
    if (command === '/register' || command === '/character') {
      const barePerformanceControl = !String(commandArg || '').trim();
      const mappedCharacterArgument =
        command !== '/character'
          ? commandArg
          : invokedToken === '/tutor'
            ? ['tutor', commandArg].filter(Boolean).join(' ')
            : invokedToken === '/learner'
              ? ['learner', commandArg].filter(Boolean).join(' ')
              : commandArg;
      const result =
        command === '/character'
          ? handleCharacterCommand(mappedCharacterArgument, { duringTurn })
          : handleExplicitPerformanceDirectiveCommand('register', commandArg, { duringTurn });
      if (result && typeof result.then === 'function') {
        const promise = Promise.resolve(result).then(
          (outcome) => {
            finishSlashCommand({ reprise: !barePerformanceControl && outcome?.suppressReprise !== true });
            return outcome;
          },
          (error) => {
            finishSlashCommand();
            throw error;
          },
        );
        promise.tutorStubBlocksPrompt = !duringTurn;
        return promise;
      }
      finishSlashCommand({ reprise: !barePerformanceControl && result?.suppressReprise !== true });
      return result || true;
    }
    if (command === '/up' || command === '/down' || command === '/feedback') {
      const action =
        command === '/up'
          ? ['up', commandArg].filter(Boolean).join(' ')
          : command === '/down'
            ? ['down', commandArg].filter(Boolean).join(' ')
            : commandArg;
      handleTutorFeedbackCommand(action, { duringTurn });
      finishSlashCommand();
      return true;
    }
    if (command === '/tune') {
      handleTutorTuningCommand(commandArg);
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/help') {
      clearStatusLine();
      printInteractiveHelp(state);
      appendTraceEvent(state.trace, { type: 'interactive_help', turns: state.turns.length, duringTurn });
      if (duringTurn) console.log(`${C.dim}tutor is still thinking; slash commands remain available${C.reset}\n`);
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/status') {
      clearStatusLine();
      printInteractiveStatus();
      appendTraceEvent(state.trace, { type: 'interactive_status', turns: state.turns.length, duringTurn });
      finishSlashCommand();
      return true;
    }
    if (command === '/features') {
      clearStatusLine();
      printTutorStubFeatureMap(state);
      appendTraceEvent(state.trace, {
        type: 'interactive_feature_map',
        turns: state.turns.length,
        duringTurn,
        publicTranscriptChanged: false,
      });
      finishSlashCommand();
      return true;
    }
    if (command === '/lab') {
      clearStatusLine();
      const requested = commandArg.trim();
      const active = state.lab?.id ? getTutorStubLab(state.lab.id) : null;
      if (!requested) {
        console.log(
          `${C.brightCyan}${C.bold}lab >${C.reset} ${active ? `${active.id} · ${active.title}` : 'custom session (no named lab)'}`,
        );
        if (active) {
          console.log(
            `${C.dim}  ${active.audience} · ${active.maturity} · ${active.costClass} cost · ${active.summary}${C.reset}`,
          );
        }
        console.log(`${C.dim}  use /lab list to browse; changing labs requires an explicit relaunch${C.reset}\n`);
      } else if (requested === 'list') {
        console.log(`${C.brightCyan}${C.bold}capability labs${C.reset}`);
        console.log(formatTutorStubLabList());
        console.log('');
      } else {
        const selected = getTutorStubLab(requested);
        if (!selected) {
          console.log(`${C.red}lab error:${C.reset} unknown lab "${requested}"; use /lab list\n`);
        } else {
          console.log(`${C.brightCyan}${C.bold}${selected.title}${C.reset} · ${selected.id}`);
          console.log(
            `${C.dim}  ${selected.audience} · ${selected.maturity} · ${selected.costClass} cost · ${selected.summary}${C.reset}`,
          );
          const admissionFlags =
            selected.id === 'research_controls'
              ? ' --model-call-budget 120 --acknowledge-research-use'
              : selected.id === 'automated_eval'
                ? ' --model-call-budget 120'
                : '';
          console.log(`${C.dim}  relaunch: npm run tutor:stub -- --lab '${selected.id}'${admissionFlags}${C.reset}\n`);
        }
      }
      appendTraceEvent(state.trace, {
        type: 'interactive_lab_catalog',
        requested: requested || null,
        activeLabId: state.lab?.id || null,
        duringTurn,
        publicTranscriptChanged: false,
      });
      finishSlashCommand();
      return true;
    }
    if (command === '/release-notes') {
      clearStatusLine();
      try {
        const releaseNotes = printTutorStubReleaseNotes(commandArg);
        appendTraceEvent(state.trace, {
          type: 'release_notes_popup',
          duringTurn,
          hours: releaseNotes.hours,
          generatedAt: releaseNotes.generatedAt,
          windowStart: releaseNotes.windowStart,
          relevantCommitCount: releaseNotes.relevantCommitCount,
          through: releaseNotes.through
            ? {
                hash: releaseNotes.through.hash,
                shortHash: releaseNotes.through.shortHash,
                subject: releaseNotes.through.subject,
              }
            : null,
          groups: releaseNotes.groups.map((group) => ({
            id: group.id,
            title: group.title,
            commitCount: group.commits.length,
          })),
          publicTranscriptChanged: false,
        });
        if (duringTurn) {
          console.log(
            `${C.dim}tutor is still thinking; release notes reflect the latest completed Git state${C.reset}\n`,
          );
        }
      } catch (error) {
        console.log(`${C.red}release notes error:${C.reset} ${error.message}\n`);
        appendTraceEvent(state.trace, {
          type: 'release_notes_error',
          duringTurn,
          argument: commandArg,
          error: error.message,
          publicTranscriptChanged: false,
        });
      }
      finishSlashCommand();
      return true;
    }
    if (command === '/metrics') {
      clearStatusLine();
      try {
        if (commandArg) throw new Error('/metrics takes no arguments');
        const source = collectSourceMetrics();
        const gitActivity = collectGitActivity();
        const github = process.env.REPOSITORY_METRICS_GITHUB === '0' ? null : collectGitHubMetrics();
        console.log(`${renderReport({ source, gitActivity, github })}\n`);
        appendTraceEvent(state.trace, {
          type: 'repository_metrics_popup',
          duringTurn,
          repositoryFiles: source.repositoryFiles,
          sourceFiles: source.sourceFiles,
          skippedSourceFiles: source.skippedSourceFiles,
          lines: source.totals,
          git: {
            branch: gitActivity.branch,
            commitCount: gitActivity.commitCount,
            latestCommit: gitActivity.latest.sha,
          },
          github,
          publicTranscriptChanged: false,
        });
        if (duringTurn) {
          console.log(
            `${C.dim}tutor is still thinking; metrics reflect the current working tree and available GitHub state${C.reset}\n`,
          );
        }
      } catch (error) {
        console.log(`${C.red}metrics error:${C.reset} ${error.message}\n`);
        appendTraceEvent(state.trace, {
          type: 'repository_metrics_error',
          duringTurn,
          argument: commandArg || null,
          error: error.message,
          publicTranscriptChanged: false,
        });
      }
      finishSlashCommand();
      return true;
    }
    if (command === '/debug') {
      clearStatusLine();
      const parts = commandArg.toLowerCase().split(/\s+/u).filter(Boolean);
      const action = parts[0] || '';
      const requestedFormat = parts[1] || null;
      const validFormat = (value) => value === 'prose' || value === 'technical';
      if (!action) {
        const formatLabel = state.explanatoryDebug?.format === 'technical' ? 'technical details' : 'plain explanation';
        console.log(
          `${C.brightBlue}${C.bold}debug >${C.reset} ${state.explanatoryDebug?.enabled ? 'on' : 'off'} · ${
            formatLabel
          }`,
        );
        console.log(
          `${C.dim}  off shows only the dialogue and compact response line; /debug on adds a short plain explanation; /debug technical shows all diagnostic evidence once${C.reset}\n`,
        );
        finishSlashCommand();
        return true;
      }
      if (action === 'on' && parts.length <= 2 && (!requestedFormat || validFormat(requestedFormat))) {
        const format = requestedFormat || 'prose';
        state.explanatoryDebug.enabled = true;
        state.explanatoryDebug.format = format;
        appendTraceEvent(state.trace, {
          type: 'explanatory_debug_mode_changed',
          enabled: true,
          format,
          duringTurn,
          effectiveTurn: state.turns.length + 1,
        });
        console.log(
          `${C.brightBlue}${C.bold}debug >${C.reset} on · ${format === 'technical' ? 'technical details' : 'plain explanation'}`,
        );
        console.log(
          `${C.dim}  the ${duringTurn ? 'current' : 'next'} completed turn will show ${
            format === 'prose'
              ? 'a short model-written explanation'
              : 'the learner analysis, calculations, and teaching-style decision'
          }${C.reset}\n`,
        );
        finishSlashCommand();
        return true;
      }
      if (action === 'off' && parts.length === 1) {
        state.explanatoryDebug.enabled = false;
        appendTraceEvent(state.trace, {
          type: 'explanatory_debug_mode_changed',
          enabled: false,
          format: state.explanatoryDebug.format || 'prose',
          duringTurn,
          effectiveTurn: state.turns.length + 1,
        });
        console.log(`${C.brightBlue}${C.bold}debug >${C.reset} off`);
        console.log(
          `${C.dim}  automatic explanations stopped; the dialogue and compact response line remain; /debug show is still available${C.reset}\n`,
        );
        finishSlashCommand();
        return true;
      }
      const oneOffFormat =
        action === 'technical' && parts.length === 1
          ? 'technical'
          : action === 'prose' && parts.length === 1
            ? 'prose'
            : (action === 'show' || action === 'once') &&
                parts.length <= 2 &&
                (!requestedFormat || validFormat(requestedFormat))
              ? requestedFormat || 'prose'
              : null;
      if (oneOffFormat) {
        return printExplanatoryDebugTurn(state, { force: true, format: oneOffFormat }).finally(finishSlashCommand);
      }
      console.log(
        `${C.red}debug error:${C.reset} use /debug on [prose|technical], /debug off, /debug show [prose|technical], or /debug technical\n`,
      );
      finishSlashCommand();
      return true;
    }
    if (command === '/coach') {
      discardPendingInteractiveAuto('interaction_mode_changed', { source: invokedToken, announce: true });
      setInteractionMode('coach', { announce: !commandArg });
      if (commandArg) queueCoachGuidance(commandArg, { duringTurn });
      finishSlashCommand();
      return true;
    }
    if (command === '/demo') {
      const promise = runInteractiveDemo(commandArg, { duringTurn, source: 'slash' });
      finishSlashCommand();
      return promise;
    }
    if (command === '/auto') {
      const promise = runInteractiveAutoMode(commandArg, { duringTurn, source: invokedToken });
      finishSlashCommand();
      return promise;
    }
    if (command === '/mode') {
      const [requestedModeRaw = '', ...rest] = commandArg.split(/\s+/u).filter(Boolean);
      const requestedMode = requestedModeRaw.toLowerCase();
      const modeArgument = rest.join(' ');
      if (!requestedMode) {
        clearStatusLine();
        printInteractionModeBanner();
        finishSlashCommand();
        return true;
      }
      if (requestedMode === 'auto') {
        const promise = runInteractiveAutoMode(modeArgument, { duringTurn, source: invokedToken });
        finishSlashCommand();
        return promise;
      }
      if (requestedMode === 'coach') {
        discardPendingInteractiveAuto('interaction_mode_changed', { source: invokedToken, announce: true });
        setInteractionMode('coach', { announce: !modeArgument });
        if (modeArgument) queueCoachGuidance(modeArgument, { duringTurn });
        finishSlashCommand();
        return true;
      }
      if (requestedMode === 'learner' && !modeArgument) {
        discardPendingInteractiveAuto('interaction_mode_changed', { source: invokedToken, announce: true });
        setInteractionMode('learner');
        finishSlashCommand();
        return true;
      }
      clearStatusLine();
      console.log(`${C.red}mode error:${C.reset} use /mode learner, /mode coach [guidance], or /mode auto [turns]\n`);
      finishSlashCommand();
      return true;
    }
    if (command === '/scenario') {
      const promise = chooseAnotherScenario(commandArg, {
        reason: isAwaitingAnotherScenario() ? 'next_scenario_after_closure' : 'scenario_changed_by_user',
        duringTurn,
      }).finally(finishSlashCommand);
      promise.tutorStubBlocksPrompt = true;
      return promise;
    }
    if (command === '/board') {
      const promise = chooseWorkplanModule(commandArg, {
        reason: 'board_item_changed_by_user',
        duringTurn,
      }).finally(finishSlashCommand);
      promise.tutorStubBlocksPrompt = true;
      return promise;
    }
    if (command === '/module') {
      const result = handleCurriculumModuleCommand(commandArg, { duringTurn });
      finishSlashCommand({ reprise: false });
      return result;
    }
    if (command === '/next') {
      const result = handleCurriculumNextCommand(commandArg, { duringTurn });
      finishSlashCommand({ reprise: false });
      return result;
    }
    if (command === '/progress') {
      clearStatusLine();
      const progress = printCurriculumProgress();
      appendTraceEvent(state.trace, {
        type: 'curriculum_progress_popup',
        schema: 'machinespirits.tutor-stub.curriculum-progression.v1',
        moduleId: progress?.currentModule?.id || null,
        phase: progress?.currentPhase || null,
        duringTurn,
        publicTranscriptChanged: false,
        externalCompletionInferred: false,
      });
      finishSlashCommand({ reprise: false });
      return true;
    }
    if (command === '/proof') {
      const promise = handleProofDagCommand(commandArg, { duringTurn }).finally(finishSlashCommand);
      promise.tutorStubBlocksPrompt = !duringTurn;
      return promise;
    }
    if (command === '/settings') {
      const promise = handleDialogueSettings(commandArg, { duringTurn }).finally(finishSlashCommand);
      promise.tutorStubBlocksPrompt = !duringTurn && liveSettingsPickerAvailable();
      return promise;
    }
    if (command === '/transcript' || command === '/html') {
      clearStatusLine();
      const option = commandArg.toLowerCase();
      if (option && !['no-open', 'write'].includes(option)) {
        console.log(`${C.red}transcript error:${C.reset} use ${command} or ${command} no-open\n`);
      } else {
        writeCurrentTranscriptHtml({ launch: !option, duringTurn });
      }
      finishSlashCommand();
      return true;
    }
    if (command === '/voice') {
      const promise = handleVoiceCommand(commandArg, { source: 'slash' }).finally(finishSlashCommand);
      return promise;
    }
    if (command === '/meta') {
      const directorQuestion = commandArg.match(/^ask(?:\s+([\s\S]*))?$/iu);
      if (directorQuestion) {
        const promise = answerCliDirectorQuestion(directorQuestion[1] || '', {
          duringTurn,
          source: `${invokedToken} ask`,
        }).finally(finishSlashCommand);
        promise.tutorStubBlocksPrompt = !duringTurn;
        return promise;
      }
      const result = handleDirectorGuidanceCommand(commandArg, { duringTurn, source: invokedToken });
      finishSlashCommand({ reprise: false });
      return result || true;
    }
    if (command === '/director') {
      const directorQuestion = invokedToken !== '/notes' ? commandArg.match(/^ask(?:\s+([\s\S]*))?$/iu) : null;
      if (directorQuestion) {
        const promise = answerCliDirectorQuestion(directorQuestion[1] || '', {
          duringTurn,
          source: `${invokedToken} ask`,
        }).finally(finishSlashCommand);
        promise.tutorStubBlocksPrompt = !duringTurn;
        return promise;
      }
      if (commandArg && invokedToken !== '/notes') {
        const result = handleDirectorGuidanceCommand(commandArg, { duringTurn, source: invokedToken });
        finishSlashCommand({ reprise: false });
        return result || true;
      }
      clearStatusLine();
      if (commandArg) {
        console.log(`${C.red}director notes error:${C.reset} /notes takes no argument; use /meta <request>\n`);
      } else {
        const notes = printDirectorNotesIssuedSoFar(state);
        appendTraceEvent(state.trace, {
          type: 'director_notes_reprise',
          command,
          duringTurn,
          throughTurn: notes.throughTurn,
          openingIncluded: Boolean(notes.opening),
          releasedNoteCount: notes.releases.length,
          notes,
          publicTranscriptChanged: false,
        });
        if (duringTurn) {
          console.log(
            `${C.dim}tutor is still thinking; future and in-progress director notes remain withheld${C.reset}\n`,
          );
        }
      }
      finishSlashCommand();
      return true;
    }
    if (command === '/analysis' || command === '/a') {
      clearStatusLine();
      const analysisMode = commandArg.toLowerCase();
      const technical = ['technical', 'tech', 'evidence', 'debug'].includes(analysisMode);
      if (analysisMode && !technical) {
        console.log(`${C.red}unknown analysis mode:${C.reset} ${commandArg}`);
        console.log(`${C.dim}  use /analysis or /analysis technical${C.reset}\n`);
      } else {
        printCurrentTurnAnalysis(state, { technical });
      }
      appendTraceEvent(state.trace, {
        type: 'analysis_popup',
        turn: state.turns[state.turns.length - 1]?.turn || null,
        duringTurn,
        mode: technical ? 'technical' : 'plain',
      });
      if (duringTurn) console.log(`${C.dim}tutor is still thinking; showing the latest completed turn${C.reset}\n`);
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/field' || trimmed === '/f') {
      clearStatusLine();
      const field = printLightweightDialogueField(state);
      appendTraceEvent(state.trace, {
        type: 'field_popup',
        turn: state.turns[state.turns.length - 1]?.turn || null,
        duringTurn,
        field,
      });
      if (duringTurn) console.log(`${C.dim}tutor is still thinking; field excludes the in-progress turn${C.reset}\n`);
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/viz' || trimmed === '/v' || trimmed === '/visualization') {
      clearStatusLine();
      const viz = printFieldVisualization(state, { reason: duringTurn ? 'viz_during_turn' : 'viz' });
      appendTraceEvent(state.trace, {
        type: 'field_visualization_popup',
        turn: state.turns[state.turns.length - 1]?.turn || null,
        duringTurn,
        viz: viz
          ? {
              svg: viz.svgDisplayPath,
              json: viz.jsonDisplayPath,
              turnCount: viz.field.turnCount,
            }
          : null,
      });
      if (duringTurn)
        console.log(`${C.dim}tutor is still thinking; visualization excludes the in-progress turn${C.reset}\n`);
      finishSlashCommand();
      return true;
    }
    if (command === '/clarify' || command === '/explain' || command === '/c') {
      return runClarificationCommand(commandArg, { duringTurn }).finally(finishSlashCommand);
    }
    if (command === '/translate') {
      const curriculumView = Boolean(state.curriculum?.module);
      return runCurriculumTranslationCommand(commandArg, { duringTurn }).finally(() =>
        finishSlashCommand({ reprise: curriculumView }),
      );
    }
    if (trimmed === '/report' || trimmed === '/r') {
      clearStatusLine();
      const report = printDialogueCloseout(state, {
        reason: duringTurn ? 'report_during_turn' : 'report',
        trace: state.trace,
      });
      appendTraceEvent(state.trace, {
        type: 'closeout_report_popup',
        turn: state.turns[state.turns.length - 1]?.turn || null,
        duringTurn,
        report,
      });
      if (duringTurn)
        console.log(`${C.dim}tutor is still thinking; closeout excludes the in-progress turn${C.reset}\n`);
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/id' || trimmed === '/turn-id' || trimmed === '/debug-id') {
      clearStatusLine();
      const debug = printCurrentDebugId(state, { duringTurn });
      appendTraceEvent(state.trace, {
        type: 'debug_id_popup',
        turn: state.turns[state.turns.length - 1]?.turn || null,
        duringTurn,
        debug,
      });
      if (duringTurn)
        console.log(`${C.dim}tutor is still thinking; the in-progress trace may still be incomplete${C.reset}\n`);
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/suggest') {
      showMixedLearnerSuggestion({ duringTurn });
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_suggestion_popup',
        turn: mixedLearner.suggestion?.turn || state.turns.length + 1,
        duringTurn,
        ready: Boolean(mixedLearner.suggestion?.text),
        pending: Boolean(mixedLearner.pending),
      });
      finishSlashCommand();
      return true;
    }
    if (command === '/profile') {
      handleMixedLearnerProfileCommand(commandArg, { duringTurn });
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/clue' || trimmed === '/hint') {
      showMixedLearnerClue({ duringTurn });
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_clue_popup',
        turn: mixedLearner.suggestion?.turn || state.turns.length + 1,
        duringTurn,
        ready: Boolean(mixedLearner.suggestion?.clue),
        pending: Boolean(mixedLearner.pending),
      });
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/use' || trimmed === '/accept') {
      acceptMixedLearnerSuggestion({ duringTurn });
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/regen') {
      clearStatusLine();
      if (!mixedLearner.enabled) {
        console.log(`${C.dim}learner suggestions are off; start with --mixed-learner to use /regen${C.reset}\n`);
      } else if (duringTurn) {
        console.log(`${C.dim}tutor is still thinking; /regen is available after the tutor responds${C.reset}\n`);
      } else {
        startMixedLearnerPrefetch('regen', { force: true });
        console.log(`${C.dim}rebuilding the learner clue and suggestion${C.reset}\n`);
      }
      finishSlashCommand();
      return true;
    }
    clearStatusLine();
    console.log(`${C.red}unknown command:${C.reset} ${trimmed}${C.dim} · type / to browse or use /help${C.reset}\n`);
    appendTraceEvent(state.trace, { type: 'unknown_slash_command', command: trimmed, duringTurn });
    finishSlashCommand();
    return true;
  }

  return { executeSlashCommand, handleDialogueSettings };
}
