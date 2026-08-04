export function createTutorStubLiveSettingsController(dependencies) {
  const {
    C,
    DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
    DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
    DEFAULT_TUTOR_STUB_RELEASE_SPEED,
    MAX_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    MAX_TUTOR_STUB_RELEASE_SPEED,
    MIN_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    MIN_TUTOR_STUB_RELEASE_SPEED,
    TUTOR_STUB_CLI_MOTION_IDS,
    TUTOR_STUB_CLI_THEME_IDS,
    appendTraceEvent,
    args,
    configureCliPresentation,
    displayDiagnosticLabel,
    explicitPerformanceDirectiveValue,
    getCliPresentation,
    getCommandRuntime,
    isExiting,
    liveModelRoleDefinitions,
    liveModelRoleRef,
    liveModelRoleSnapshot,
    mixedLearnerPromptText,
    normalizeTutorStubTrainingReuseSetting,
    performanceTemperatureScope,
    persistCurrentInteractiveSettings,
    pickInitialTutorModelWithKeyboard,
    pickLiveNumericSettingWithKeyboard,
    pickLiveSettingsActionWithKeyboard,
    plainPolicyLabel,
    projectTutorStubDialogueSettingsLines,
    projectTutorStubModelChoiceLines,
    projectTutorStubTrainingReuseStatusLines,
    registerTemperature,
    resolveTutorStubTrainingReuse,
    rl,
    state,
    tutorModelChoiceEntries,
    tutorStubDagFactDropoutSnapshot,
    tutorStubPublicMessagesForSpeaker,
    tutorStubRegisterPolicyStackId,
    tutorStubReleasePacingSnapshot,
    tutorStubTrainingReuseLabel,
  } = dependencies;

  function trainingReuseStatusLines(prefix = 'training reuse') {
    const reuse = state.trainingReuse;
    return projectTutorStubTrainingReuseStatusLines({
      prefix,
      label: tutorStubTrainingReuseLabel(reuse),
      requested: reuse.requested,
      humanSubjectLabel: displayDiagnosticLabel(reuse.humanSubjectClass),
      sourceLabel: displayDiagnosticLabel(reuse.source),
      failClosed: reuse.failClosed,
      status: reuse.status,
      colors: C,
    });
  }

  function printTrainingReuseStatus(prefix = 'training reuse') {
    const lines = trainingReuseStatusLines(prefix);
    for (const line of lines) {
      console.log(line);
    }
  }

  function handleTrainingReuseSetting(value = 'status', { source = 'live_settings' } = {}) {
    const action = String(value || 'status')
      .trim()
      .toLowerCase();
    if (action === 'status') {
      console.log(`${C.cyan}training reuse >${C.reset}`);
      printTrainingReuseStatus('current session');
      console.log();
      return true;
    }
    let requested;
    try {
      requested = normalizeTutorStubTrainingReuseSetting(action, { label: 'training reuse' });
    } catch (error) {
      console.log(`${C.red}settings error:${C.reset} ${error.message}; use on, off, or status\n`);
      return false;
    }
    const previous = state.trainingReuse;
    state.trainingReuse = resolveTutorStubTrainingReuse({
      requested,
      source,
      humanSubjectClass: previous.declaredHumanSubjectClass,
      humanSubjectClassSource: previous.humanSubjectClassSource,
      humanInputExpected: previous.humanInputExpected,
    });
    args['training-reuse'] = state.trainingReuse.requested;
    const remembered = persistCurrentInteractiveSettings('training_reuse_changed');
    appendTraceEvent(state.trace, {
      type: 'training_reuse_changed',
      previous,
      trainingReuse: state.trainingReuse,
      rememberedAt: remembered?.updatedAt || null,
      source,
      publicTranscriptChanged: false,
    });
    console.log(`${C.cyan}training reuse >${C.reset} ${tutorStubTrainingReuseLabel(state.trainingReuse)}`);
    printTrainingReuseStatus('current session');
    console.log();
    return true;
  }

  function printDialogueSettings() {
    const explicitRegister = explicitPerformanceDirectiveValue(state, 'register');
    const explicitCharacter = explicitPerformanceDirectiveValue(state, 'character');
    const temperatureSelection = performanceTemperatureScope({
      policy: state.register?.policy,
      explicitRegister,
      explicitCharacter,
      randomStance: state.randomPerformance?.enabled === true && !explicitRegister,
      randomCharacter: state.randomPerformance?.enabled === true && !explicitCharacter,
    });
    const randomPerformanceAxes = [!explicitRegister ? 'style' : null, !explicitCharacter ? 'character' : null].filter(
      Boolean,
    );
    const modelRoles = Object.keys(liveModelRoleDefinitions).map(liveModelRoleSnapshot);
    const dropout = tutorStubDagFactDropoutSnapshot(state.learnerDag?.dropout);
    const pace = tutorStubReleasePacingSnapshot(state.releasePacing, state.world);
    const lines = projectTutorStubDialogueSettingsLines({
      settings: {
        allRolesOverrideRef: state.modelRouting?.allRolesOverrideRef,
        modelRoles,
        classifierCombined: state.classifier?.combined,
        tutorEffort: state.cliEffort,
        appearance: {
          themeLabel: getCliPresentation().themeLabel,
          requestedMotion: getCliPresentation().requestedMotion,
          motion: getCliPresentation().motion,
        },
        committee: {
          enabled: state.committee?.enabled,
          miniModel: state.committee?.miniModel,
          fallbackPolicy: state.committee?.fallbackPolicy,
        },
        publicMessageCount: tutorStubPublicMessagesForSpeaker(state.history, { speaker: 'tutor' }).length,
        teaching: {
          policyLabel: plainPolicyLabel(state.register?.policy),
          policyStackId: tutorStubRegisterPolicyStackId(state.register?.policy, state.register?.overlays),
          overlays: state.register?.overlays,
          overlayThreshold: state.register?.overlayThreshold ?? DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
          styleRange: state.register?.temperature ?? registerTemperature,
          temperatureSelection: {
            applied: temperatureSelection.applied,
            scope: temperatureSelection.scope,
            scopeLabel: displayDiagnosticLabel(temperatureSelection.scope),
          },
          randomPerformance: {
            enabled: state.randomPerformance?.enabled,
            axes: randomPerformanceAxes,
          },
          lightAdaptation: {
            enabled: state.lightAdaptation?.enabled,
            threshold: state.lightAdaptation?.threshold,
          },
          directedPerformance: {
            register: explicitRegister,
            character: explicitCharacter,
          },
        },
        dropout,
        releasePacing: {
          baseSpeed: pace?.baseSpeed ?? DEFAULT_TUTOR_STUB_RELEASE_SPEED,
          effectiveSpeed: pace?.effectiveSpeed ?? DEFAULT_TUTOR_STUB_RELEASE_SPEED,
          direction: pace?.direction || 'steady',
        },
        rememberedSettings: {
          enabled: state.rememberedSettings?.enabled,
          status: state.rememberedSettings?.status || 'disabled',
        },
      },
      trainingReuseLines: trainingReuseStatusLines(),
      colors: C,
    });
    for (const line of lines) {
      console.log(line);
    }
  }

  function printModelChoices(role = 'tutor') {
    const definition = liveModelRoleDefinitions[role];
    const currentRef = liveModelRoleRef(role);
    const entries = tutorModelChoiceEntries(currentRef);
    const lines = projectTutorStubModelChoiceLines({ definition, currentRef, entries, colors: C });
    for (const line of lines) {
      console.log(line);
    }
  }

  function printTutorModelChoices() {
    printModelChoices('tutor');
  }

  async function chooseLiveTutorModel() {
    console.log(`${C.brightCyan}${C.bold}Tutor model · choose with ↑/↓ and Enter${C.reset}`);
    const selection = await pickInitialTutorModelWithKeyboard(state.modelRef);
    if (!selection) return false;
    await handleDialogueSettings(`model ${selection.ref}`);
    return true;
  }

  async function chooseLiveRoleModel(role) {
    const definition = liveModelRoleDefinitions[role];
    console.log(`${C.brightCyan}${C.bold}${definition.label} · choose with ↑/↓ and Enter${C.reset}`);
    const selection = await pickInitialTutorModelWithKeyboard(liveModelRoleRef(role));
    if (!selection) return false;
    await handleDialogueSettings(`models ${definition.setting} ${selection.ref}`);
    return true;
  }

  async function pickLiveNumericSettingValue(setting, value = undefined) {
    if (setting === 'stance_temp') {
      return pickLiveNumericSettingWithKeyboard({
        label: 'Teaching-style range',
        value: value ?? state.register?.temperature ?? registerTemperature,
        min: MIN_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
        max: MAX_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
        step: 0.05,
        coarseStep: 0.25,
        recommended: DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
        explanation: 'Lower values concentrate the strongest style; higher values retain more alternative signals.',
      });
    }
    if (setting === 'dropout') {
      return pickLiveNumericSettingWithKeyboard({
        label: 'Evidence-memory dropout',
        value: value ?? state.learnerDag?.dropout?.rate ?? DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
        min: 0,
        max: 1,
        step: 0.05,
        coarseStep: 0.1,
        recommended: DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
        explanation: 'Zero keeps understood evidence reliable; higher values simulate recoverable forgetting.',
      });
    }
    if (setting === 'release_speed') {
      return pickLiveNumericSettingWithKeyboard({
        label: 'Clue release speed',
        value: value ?? state.releasePacing?.baseSpeed ?? DEFAULT_TUTOR_STUB_RELEASE_SPEED,
        min: MIN_TUTOR_STUB_RELEASE_SPEED,
        max: MAX_TUTOR_STUB_RELEASE_SPEED,
        step: 0.05,
        coarseStep: 0.25,
        recommended: DEFAULT_TUTOR_STUB_RELEASE_SPEED,
        explanation: 'One follows the authored schedule; lower slows new clues and higher brings them forward.',
      });
    }
    return pickLiveNumericSettingWithKeyboard({
      label: 'Override sensitivity',
      value: value ?? state.register?.overlayThreshold ?? DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
      min: 0,
      max: 1,
      step: 0.05,
      coarseStep: 0.1,
      recommended: DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
      explanation: 'Lower values react more often; higher values wait for a stronger conversational change.',
    });
  }

  async function chooseLiveNumericSetting(setting) {
    const next = await pickLiveNumericSettingValue(setting);
    if (next === null) return false;
    const command =
      setting === 'stance_temp'
        ? `stance-temp ${next}`
        : setting === 'dropout'
          ? `dropout ${next}`
          : setting === 'release_speed'
            ? `release-speed ${next}`
            : `policy threshold ${next}`;
    await handleDialogueSettings(command);
    return true;
  }

  function createLiveSettingsDraft() {
    return {
      allModelsOverrideRef: state.modelRouting?.allRolesOverrideRef || null,
      tutorModelRef: state.modelRef,
      classifierModelRef: liveModelRoleRef('classifier'),
      reasoningModelRef: liveModelRoleRef('reasoning'),
      learnerModelRef: liveModelRoleRef('learner'),
      theme: state.presentation?.theme || getCliPresentation().themeId,
      motion: state.presentation?.motion || getCliPresentation().requestedMotion,
      temperature: state.register?.temperature ?? registerTemperature,
      dropoutRate: state.learnerDag?.dropout?.rate ?? DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
      releaseSpeed: state.releasePacing?.baseSpeed ?? DEFAULT_TUTOR_STUB_RELEASE_SPEED,
      lightAdaptationEnabled: state.lightAdaptation?.enabled === true,
      trainingReuseEnabled: state.trainingReuse?.requested === 'on',
      overlays: [...(state.register?.overlays || [])],
      overlayThreshold: state.register?.overlayThreshold ?? DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
      forgetSavedSettings: false,
    };
  }

  function liveSettingsDraftChangeIds(draft) {
    const currentOverlays = state.register?.overlays || [];
    const changes = [];
    if (
      draft.allModelsOverrideRef &&
      [draft.tutorModelRef, draft.classifierModelRef, draft.reasoningModelRef, draft.learnerModelRef].every(
        (ref) => ref === draft.allModelsOverrideRef,
      ) &&
      draft.allModelsOverrideRef !== state.modelRouting?.allRolesOverrideRef
    ) {
      changes.push('all_models');
    } else {
      if (draft.tutorModelRef !== state.modelRef) changes.push('tutor_model');
      if (draft.classifierModelRef !== liveModelRoleRef('classifier')) changes.push('classifier_model');
      if (draft.reasoningModelRef !== liveModelRoleRef('reasoning')) changes.push('reasoning_model');
      if (draft.learnerModelRef !== liveModelRoleRef('learner')) changes.push('learner_model');
    }
    if (draft.temperature !== (state.register?.temperature ?? registerTemperature)) changes.push('stance_temp');
    if (draft.theme !== (state.presentation?.theme || getCliPresentation().themeId)) changes.push('theme');
    if (draft.motion !== (state.presentation?.motion || getCliPresentation().requestedMotion)) changes.push('motion');
    if (draft.dropoutRate !== (state.learnerDag?.dropout?.rate ?? DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE)) {
      changes.push('dropout');
    }
    if (draft.releaseSpeed !== (state.releasePacing?.baseSpeed ?? DEFAULT_TUTOR_STUB_RELEASE_SPEED)) {
      changes.push('release_speed');
    }
    if (draft.lightAdaptationEnabled !== (state.lightAdaptation?.enabled === true)) {
      changes.push('light_adaptation');
    }
    if (draft.trainingReuseEnabled !== (state.trainingReuse?.requested === 'on')) {
      changes.push('training_reuse');
    }
    if (
      currentOverlays.length !== draft.overlays.length ||
      currentOverlays.some((overlay) => !draft.overlays.includes(overlay))
    ) {
      changes.push('overlays');
    }
    if (
      draft.overlayThreshold !== (state.register?.overlayThreshold ?? DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD)
    ) {
      changes.push('overlay_threshold');
    }
    if (draft.forgetSavedSettings) changes.push('forget');
    return changes;
  }

  async function applyLiveSettingsDraft(draft) {
    const changes = liveSettingsDraftChangeIds(draft);
    if (changes.includes('all_models')) {
      await handleDialogueSettings(`models all ${draft.allModelsOverrideRef}`);
    } else {
      if (changes.includes('tutor_model')) await handleDialogueSettings(`models tutor ${draft.tutorModelRef}`);
      if (changes.includes('classifier_model')) {
        await handleDialogueSettings(`models classifier ${draft.classifierModelRef}`);
      }
      if (changes.includes('reasoning_model')) {
        await handleDialogueSettings(`models reasoning ${draft.reasoningModelRef}`);
      }
      if (changes.includes('learner_model')) await handleDialogueSettings(`models learner ${draft.learnerModelRef}`);
    }
    if (changes.includes('stance_temp')) await handleDialogueSettings(`stance-temp ${draft.temperature}`);
    if (changes.includes('theme')) await handleDialogueSettings(`theme ${draft.theme}`);
    if (changes.includes('motion')) await handleDialogueSettings(`motion ${draft.motion}`);
    if (changes.includes('dropout')) await handleDialogueSettings(`dropout ${draft.dropoutRate}`);
    if (changes.includes('release_speed')) await handleDialogueSettings(`release-speed ${draft.releaseSpeed}`);
    if (changes.includes('light_adaptation')) {
      await handleDialogueSettings(`light ${draft.lightAdaptationEnabled ? 'on' : 'off'}`);
    }
    if (changes.includes('training_reuse')) {
      await handleDialogueSettings(`training-reuse ${draft.trainingReuseEnabled ? 'on' : 'off'}`);
    }
    if (changes.includes('overlays')) {
      const currentOverlays = [...(state.register?.overlays || [])];
      for (const overlay of currentOverlays.filter((entry) => !draft.overlays.includes(entry))) {
        await handleDialogueSettings(`policy remove ${overlay}`);
      }
      for (const overlay of draft.overlays.filter((entry) => !currentOverlays.includes(entry))) {
        await handleDialogueSettings(`policy add ${overlay}`);
      }
    }
    if (changes.includes('overlay_threshold')) {
      await handleDialogueSettings(`policy threshold ${draft.overlayThreshold}`);
    }
    if (changes.includes('forget')) await handleDialogueSettings('forget');
    return changes;
  }

  async function openLiveSettingsPanel() {
    const draft = createLiveSettingsDraft();
    appendTraceEvent(state.trace, {
      type: 'settings_panel_opened',
      turn: state.turns.length + 1,
      modelRef: state.modelRef,
      policyStack: tutorStubRegisterPolicyStackId(state.register?.policy, state.register?.overlays),
    });
    let selectedIndex = 0;
    let reason = 'cancelled';
    let changedSettings = [];
    while (!isExiting()) {
      const action = await pickLiveSettingsActionWithKeyboard(selectedIndex, draft);
      if (!action) {
        reason = 'cancelled';
        changedSettings = liveSettingsDraftChangeIds(draft);
        break;
      }
      selectedIndex = action.index;
      if (action.id === 'done') {
        changedSettings = await applyLiveSettingsDraft(draft);
        reason = changedSettings.length ? 'applied' : 'unchanged';
        break;
      }
      appendTraceEvent(state.trace, {
        type: 'settings_panel_action_selected',
        action: action.id,
        turn: state.turns.length + 1,
      });
      if (
        action.id === 'all_models' ||
        action.id === 'tutor_model' ||
        action.id === 'classifier_model' ||
        action.id === 'reasoning_model' ||
        action.id === 'learner_model'
      ) {
        const role =
          action.id === 'all_models'
            ? 'all'
            : action.id === 'tutor_model'
              ? 'tutor'
              : action.id === 'classifier_model'
                ? 'classifier'
                : action.id === 'reasoning_model'
                  ? 'reasoning'
                  : 'learner';
        const label = role === 'all' ? 'One model for all roles' : liveModelRoleDefinitions[role].label;
        const currentRef =
          role === 'all'
            ? draft.allModelsOverrideRef || draft.tutorModelRef
            : role === 'tutor'
              ? draft.tutorModelRef
              : role === 'classifier'
                ? draft.classifierModelRef
                : role === 'reasoning'
                  ? draft.reasoningModelRef
                  : draft.learnerModelRef;
        console.log(`${C.brightCyan}${C.bold}${label} · choose with ↑/↓ and Enter${C.reset}`);
        console.log(`${C.dim}  Esc back · saved only when you choose Done${C.reset}`);
        const selection = await pickInitialTutorModelWithKeyboard(currentRef);
        if (selection && role === 'all') {
          draft.allModelsOverrideRef = selection.ref;
          draft.tutorModelRef = selection.ref;
          draft.classifierModelRef = selection.ref;
          draft.reasoningModelRef = selection.ref;
          draft.learnerModelRef = selection.ref;
        } else if (selection) {
          draft.allModelsOverrideRef = null;
          if (role === 'tutor') draft.tutorModelRef = selection.ref;
          else if (role === 'classifier') draft.classifierModelRef = selection.ref;
          else if (role === 'reasoning') draft.reasoningModelRef = selection.ref;
          else draft.learnerModelRef = selection.ref;
        }
      } else if (
        action.id === 'stance_temp' ||
        action.id === 'dropout' ||
        action.id === 'release_speed' ||
        action.id === 'overlay_threshold'
      ) {
        const draftValue =
          action.id === 'stance_temp'
            ? draft.temperature
            : action.id === 'dropout'
              ? draft.dropoutRate
              : action.id === 'release_speed'
                ? draft.releaseSpeed
                : draft.overlayThreshold;
        const next = await pickLiveNumericSettingValue(action.id, draftValue);
        if (next !== null) {
          if (action.id === 'stance_temp') draft.temperature = next;
          else if (action.id === 'dropout') draft.dropoutRate = next;
          else if (action.id === 'release_speed') draft.releaseSpeed = next;
          else draft.overlayThreshold = next;
        }
      } else if (action.id === 'theme') {
        const current = TUTOR_STUB_CLI_THEME_IDS.indexOf(draft.theme);
        draft.theme = TUTOR_STUB_CLI_THEME_IDS[(current + 1) % TUTOR_STUB_CLI_THEME_IDS.length];
        configureCliPresentation({
          theme: draft.theme,
          motion: draft.motion,
          noColor: args['no-color'],
        });
        rl.setPrompt(mixedLearnerPromptText());
      } else if (action.id === 'motion') {
        const current = TUTOR_STUB_CLI_MOTION_IDS.indexOf(draft.motion);
        draft.motion = TUTOR_STUB_CLI_MOTION_IDS[(current + 1) % TUTOR_STUB_CLI_MOTION_IDS.length];
        configureCliPresentation({
          theme: draft.theme,
          motion: draft.motion,
          noColor: args['no-color'],
        });
      } else if (action.id === 'state_overlay' || action.id === 'field_overlay') {
        const overlay = action.id === 'state_overlay' ? 'state' : 'field';
        draft.overlays = draft.overlays.includes(overlay)
          ? draft.overlays.filter((entry) => entry !== overlay)
          : [...draft.overlays, overlay];
      } else if (action.id === 'light_adaptation') {
        draft.lightAdaptationEnabled = !draft.lightAdaptationEnabled;
      } else if (action.id === 'training_reuse') {
        draft.trainingReuseEnabled = !draft.trainingReuseEnabled;
      } else if (action.id === 'forget') {
        draft.forgetSavedSettings = !draft.forgetSavedSettings;
      }
    }
    appendTraceEvent(state.trace, {
      type: 'settings_panel_closed',
      reason,
      changedSettings,
      changesDiscarded: reason === 'cancelled' ? changedSettings : [],
      turn: state.turns.length + 1,
      modelRef: state.modelRef,
      policyStack: tutorStubRegisterPolicyStackId(state.register?.policy, state.register?.overlays),
    });
    if (reason === 'cancelled') {
      configureCliPresentation({
        theme: state.presentation?.theme || args.theme,
        motion: state.presentation?.motion || args.motion,
        noColor: args['no-color'],
      });
      rl.setPrompt(mixedLearnerPromptText());
      console.log(
        `${C.dim}settings cancelled · ${changedSettings.length ? 'unsaved changes discarded' : 'nothing changed'}${C.reset}\n`,
      );
    } else {
      console.log(
        `${C.dim}${reason === 'applied' ? 'settings applied' : 'settings unchanged'} · returning to dialogue${C.reset}\n`,
      );
    }
  }

  function handleDialogueSettings(...parameters) {
    return getCommandRuntime().handleDialogueSettings(...parameters);
  }

  return {
    chooseLiveNumericSetting,
    chooseLiveRoleModel,
    chooseLiveTutorModel,
    handleDialogueSettings,
    handleTrainingReuseSetting,
    openLiveSettingsPanel,
    printDialogueSettings,
    printModelChoices,
    printTrainingReuseStatus,
    printTutorModelChoices,
  };
}
