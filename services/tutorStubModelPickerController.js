export function createTutorStubModelPickerController(dependencies = {}) {
  const {
    C,
    DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
    DEFAULT_TUTOR_STUB_RELEASE_SPEED,
    STUB,
    appendTraceEvent,
    args,
    classifierEnabled,
    clearLine,
    combinedLearnerAnalysisEnabled,
    cursorTo,
    displayDiagnosticLabel,
    effectiveTemperatureForModel,
    emitKeypressEvents,
    explicitPerformanceDirectiveValue,
    getActorialPartDefinitions,
    getEngagementStanceDefinitions,
    getProviderConfig,
    getCliPresentation,
    humanDirectedRegisterPalette,
    input,
    isCliProvider,
    learnerProfileContract,
    learnerProfileIds,
    learnerProfilePickerPresentation,
    learnerProfileSuiteIds,
    learnerSuggestionEnabled,
    mixedLearner,
    moveCursor,
    oneLine,
    output,
    persistCurrentInteractiveSettings,
    registerTemperature,
    resetMixedLearnerSuggestion,
    resolveModel,
    resolveTutorModelSelection,
    resolveTutorStubTrainingReuse,
    state,
    tutorModelChoiceEntries,
    tutorStubCliThemeOptions,
    tutorStubConfigurableActorialPartIds,
    tutorStubDagFactDropoutSnapshot,
    tutorStubPublicMessagesForSpeaker,
    tutorStubTrainingReuseLabel,
    visibleResolvedModel,
  } = dependencies;
  let { visibleClassifierModel, visibleLearnerRecordModel } = dependencies;

  function assignModelBinding(name, value) {
    dependencies.setModelBinding(name, value);
    return value;
  }

  function applyTutorModelSelection(
    modelRef,
    { source = 'settings', usedDefault = false, deferEffects = false, preserveAllOverride = false } = {},
  ) {
    const selection = resolveTutorModelSelection(modelRef);
    const previousRef = state.modelRef;
    const previousResolved = state.resolved;
    state.modelRef = selection.modelRef;
    state.resolved = selection.resolved;
    state.temperature = effectiveTemperatureForModel(selection.resolved, state.requestedTemperature);
    args.model = selection.modelRef;
    assignModelBinding('visibleModel', visibleResolvedModel(selection.resolved, selection.providerConfig));
    const changed = previousRef !== selection.modelRef || previousResolved.model !== selection.resolved.model;
    if (changed && !preserveAllOverride) state.modelRouting.allRolesOverrideRef = null;
    const contextReplayRecorded = Boolean(changed && source !== 'initial_settings' && state.history.length > 0);
    if (contextReplayRecorded) {
      state.tutorContext = {
        ...state.tutorContext,
        modelRef: selection.modelRef,
      };
    }
    const invalidated = changed && !deferEffects ? resetMixedLearnerSuggestion('tutor_model_changed') : null;
    const remembered = changed && !deferEffects ? persistCurrentInteractiveSettings('tutor_model_changed') : null;
    appendTraceEvent(state.trace, {
      type: source === 'initial_settings' ? 'mixed_learner_initial_tutor_model_selected' : 'tutor_model_changed',
      schema: 'machinespirits.tutor-stub.tutor-model-selection.v1',
      source,
      previousRef,
      modelRef: selection.modelRef,
      provider: selection.resolved.provider,
      model: selection.resolved.model,
      cli: isCliProvider(selection.resolved.provider),
      usedDefault,
      changed,
      rememberedAt: remembered?.updatedAt || null,
      effectiveTurn: state.turns.length + 1,
      contextReplay: contextReplayRecorded
        ? {
            schema: 'machinespirits.tutor-stub.tutor-context-replay.v2',
            historyMode: state.tutorContext.historyMode,
            publicMessageCount: tutorStubPublicMessagesForSpeaker(state.history, { speaker: 'tutor' }).length,
            includesRoles: ['user', 'assistant'],
            persistence: 'every_subsequent_tutor_call_in_this_dialogue',
            alreadyActive: true,
          }
        : null,
      cacheRefresh: invalidated
        ? {
            priorStateCleared: Boolean(invalidated.hadState),
            analysisDiscarded: Boolean(invalidated.discardedAnalysis),
            tutorResponseDiscarded: Boolean(invalidated.discardedTutorResponse),
          }
        : null,
    });
    return { ...selection, previousRef, changed, invalidated };
  }

  const liveModelRoleDefinitions = {
    tutor: {
      label: 'Tutor voice',
      setting: 'tutor',
      defaultRef: STUB.model,
    },
    classifier: {
      label: 'Learner interpretation',
      setting: 'classifier',
      defaultRef: STUB.classifierModel,
    },
    reasoning: {
      label: 'Learner reasoning tracker',
      setting: 'reasoning',
      defaultRef: STUB.learnerRecordModel,
    },
    learner: {
      label: 'Learner voice',
      setting: 'learner',
      defaultRef: STUB.autoLearnerModel,
    },
  };

  function liveModelRoleRef(role) {
    if (role === 'tutor') return state.modelRef;
    if (role === 'classifier') return state.classifier?.modelRef || args['classifier-model'];
    if (role === 'reasoning') return state.learnerDag?.modelRef || args['learner-record-model'];
    if (role === 'learner') return state.autoLearner?.modelRef || args['auto-learner-model'];
    throw new Error(`unknown model role: ${role}`);
  }

  function liveModelRoleSnapshot(role) {
    const modelRef = liveModelRoleRef(role);
    const resolvedRole =
      role === 'tutor'
        ? state.resolved
        : role === 'classifier'
          ? state.classifier?.resolved || resolveModel(modelRef)
          : role === 'reasoning'
            ? state.learnerDag?.resolved || resolveModel(modelRef)
            : state.autoLearner?.resolved || resolveModel(modelRef);
    const providerConfigRole = getProviderConfig(resolvedRole.provider);
    return {
      role,
      label: liveModelRoleDefinitions[role].label,
      modelRef,
      resolved: visibleResolvedModel(resolvedRole, providerConfigRole),
      active:
        role === 'tutor' ||
        (role === 'classifier' && state.classifier?.enabled && !state.classifier?.combined) ||
        (role === 'reasoning' && state.learnerDag?.enabled) ||
        (role === 'learner' && learnerSuggestionEnabled),
      combinedOwner: role === 'reasoning' && Boolean(state.classifier?.enabled && state.classifier?.combined),
    };
  }

  function refreshVisibleClassifierConfig() {
    assignModelBinding(
      'visibleClassifierConfig',
      classifierEnabled
        ? combinedLearnerAnalysisEnabled
          ? {
              combined: true,
              classifierModelRef: args['classifier-model'],
              modelRef: args['learner-record-model'],
              resolved: visibleLearnerRecordModel,
            }
          : {
              modelRef: args['classifier-model'],
              resolved: visibleClassifierModel,
            }
        : { enabled: false },
    );
  }

  function applyRoleModelSelection(
    role,
    modelRef,
    { source = 'live_settings', deferEffects = false, preserveAllOverride = false } = {},
  ) {
    if (role === 'tutor') {
      return applyTutorModelSelection(modelRef, {
        source,
        deferEffects,
        preserveAllOverride,
      });
    }
    const selection = resolveTutorModelSelection(modelRef);
    const previousRef = liveModelRoleRef(role);
    const changed = previousRef !== selection.modelRef;
    if (role === 'classifier') {
      args['classifier-model'] = selection.modelRef;
      state.classifier.modelRef = selection.modelRef;
      state.classifier.resolved = selection.resolved;
      assignModelBinding('classifierResolved', selection.resolved);
      assignModelBinding('classifierProviderConfig', selection.providerConfig);
      visibleClassifierModel = assignModelBinding(
        'visibleClassifierModel',
        visibleResolvedModel(selection.resolved, selection.providerConfig),
      );
    } else if (role === 'reasoning') {
      args['learner-record-model'] = selection.modelRef;
      state.learnerDag.modelRef = selection.modelRef;
      state.learnerDag.resolved = selection.resolved;
      assignModelBinding('learnerRecordResolved', selection.resolved);
      assignModelBinding('learnerRecordProviderConfig', selection.providerConfig);
      visibleLearnerRecordModel = assignModelBinding(
        'visibleLearnerRecordModel',
        visibleResolvedModel(selection.resolved, selection.providerConfig),
      );
    } else if (role === 'learner') {
      args['auto-learner-model'] = selection.modelRef;
      state.autoLearner = {
        modelRef: selection.modelRef,
        resolved: selection.resolved,
        providerConfig: selection.providerConfig,
      };
      mixedLearner.resolved = selection.resolved;
      assignModelBinding('autoLearnerResolved', selection.resolved);
      assignModelBinding('autoLearnerProviderConfig', selection.providerConfig);
      assignModelBinding('visibleAutoLearnerModel', visibleResolvedModel(selection.resolved, selection.providerConfig));
    } else {
      throw new Error(`unknown model role: ${role}`);
    }
    refreshVisibleClassifierConfig();
    if (changed && !preserveAllOverride) state.modelRouting.allRolesOverrideRef = null;
    const invalidated = changed && !deferEffects ? resetMixedLearnerSuggestion(`${role}_model_changed`) : null;
    const remembered = changed && !deferEffects ? persistCurrentInteractiveSettings(`${role}_model_changed`) : null;
    appendTraceEvent(state.trace, {
      type: 'role_model_changed',
      schema: 'machinespirits.tutor-stub.role-model-selection.v1',
      source,
      role,
      previousRef,
      modelRef: selection.modelRef,
      provider: selection.resolved.provider,
      model: selection.resolved.model,
      changed,
      effectiveTurn: state.turns.length + 1,
      rememberedAt: remembered?.updatedAt || null,
      cacheRefresh: invalidated
        ? {
            priorStateCleared: Boolean(invalidated.hadState),
            analysisDiscarded: Boolean(invalidated.discardedAnalysis),
            tutorResponseDiscarded: Boolean(invalidated.discardedTutorResponse),
          }
        : null,
    });
    return { ...selection, previousRef, changed, invalidated };
  }

  function applyAllRoleModelSelection(modelRef, { source = 'live_settings' } = {}) {
    const selection = resolveTutorModelSelection(modelRef);
    const previousOverrideRef = state.modelRouting.allRolesOverrideRef;
    state.modelRouting.allRolesOverrideRef = selection.modelRef;
    const results = Object.keys(liveModelRoleDefinitions).map((role) =>
      applyRoleModelSelection(role, selection.modelRef, {
        source: `${source}_all_roles`,
        deferEffects: true,
        preserveAllOverride: true,
      }),
    );
    const changed = results.some((result) => result.changed) || previousOverrideRef !== selection.modelRef;
    const invalidated = changed ? resetMixedLearnerSuggestion('all_role_models_changed') : null;
    const remembered = changed ? persistCurrentInteractiveSettings('all_role_models_changed') : null;
    appendTraceEvent(state.trace, {
      type: 'all_role_models_changed',
      schema: 'machinespirits.tutor-stub.all-models-override.v1',
      source,
      modelRef: selection.modelRef,
      changed,
      effectiveTurn: state.turns.length + 1,
      roles: Object.keys(liveModelRoleDefinitions),
      rememberedAt: remembered?.updatedAt || null,
      cacheRefresh: invalidated
        ? {
            priorStateCleared: Boolean(invalidated.hadState),
            analysisDiscarded: Boolean(invalidated.discardedAnalysis),
            tutorResponseDiscarded: Boolean(invalidated.discardedTutorResponse),
          }
        : null,
    });
    return { ...selection, changed, results, invalidated };
  }

  async function pickInitialTutorModelWithKeyboard(defaultRef) {
    const entries = tutorModelChoiceEntries(defaultRef);
    if (!entries.length) return null;
    let selectedIndex = Math.max(
      0,
      entries.findIndex((entry) => entry.ref === defaultRef),
    );
    const viewportHeight = Math.min(entries.length, Math.max(4, Math.min(8, Number(output.rows || 24) - 7)));
    let viewportStart = Math.max(0, Math.min(selectedIndex, entries.length - viewportHeight));
    let renderedLineCount = 0;
    const keepVisible = () => {
      if (selectedIndex < viewportStart) viewportStart = selectedIndex;
      if (selectedIndex >= viewportStart + viewportHeight) viewportStart = selectedIndex - viewportHeight + 1;
    };
    const clearMenu = () => {
      if (!renderedLineCount) return;
      moveCursor(output, 0, -renderedLineCount);
      for (let index = 0; index < renderedLineCount; index += 1) {
        cursorTo(output, 0);
        clearLine(output, 0);
        if (index < renderedLineCount - 1) moveCursor(output, 0, 1);
      }
      if (renderedLineCount > 1) moveCursor(output, 0, -(renderedLineCount - 1));
      renderedLineCount = 0;
    };
    const render = () => {
      keepVisible();
      clearMenu();
      const width = Math.max(60, Math.min(Number(output.columns || 100), 140));
      const visible = entries.slice(viewportStart, viewportStart + viewportHeight);
      const selected = entries[selectedIndex];
      const lines = [
        `${C.dim}${viewportStart > 0 ? `  ↑ ${viewportStart} more` : '  '}${C.reset}`,
        ...visible.map((entry, offset) => {
          const active = viewportStart + offset === selectedIndex;
          const plain = `${active ? '›' : ' '} ${entry.ref.padEnd(32)} ${oneLine(entry.model, { max: width - 38 })}`;
          return active ? `${C.cyan}${C.bold}${plain}${C.reset}` : plain;
        }),
        `${C.dim}${viewportStart + viewportHeight < entries.length ? `  ↓ ${entries.length - viewportStart - viewportHeight} more` : '  '}${C.reset}`,
        `${C.brightYellow}${C.bold}  uses >${C.reset} ${selected.provider} → ${selected.model} · ${selected.access}`,
      ];
      for (const line of lines) output.write(`${line}\n`);
      renderedLineCount = lines.length;
    };
    emitKeypressEvents(input);
    const priorListeners = input.listeners('keypress');
    for (const listener of priorListeners) input.removeListener('keypress', listener);
    const wasRaw = Boolean(input.isRaw);
    if (!wasRaw) input.setRawMode(true);
    return new Promise((resolve) => {
      const finish = (selection) => {
        input.removeListener('keypress', onKeypress);
        for (const listener of priorListeners) input.on('keypress', listener);
        if (!wasRaw) input.setRawMode(false);
        clearMenu();
        resolve(selection);
      };
      const move = (delta) => {
        selectedIndex = (selectedIndex + delta + entries.length) % entries.length;
        render();
      };
      const onKeypress = (character, key = {}) => {
        if ((key.ctrl && key.name === 'c') || key.name === 'escape') return finish(null);
        if (key.name === 'up' || character === 'k') return move(-1);
        if (key.name === 'down' || character === 'j') return move(1);
        if (key.name === 'pageup') return move(-viewportHeight);
        if (key.name === 'pagedown') return move(viewportHeight);
        if (key.name === 'home') {
          selectedIndex = 0;
          render();
          return;
        }
        if (key.name === 'end') {
          selectedIndex = entries.length - 1;
          render();
          return;
        }
        if (key.name === 'return' || key.name === 'enter') finish(entries[selectedIndex]);
      };
      input.on('keypress', onKeypress);
      input.resume();
      render();
    });
  }

  function liveSettingsPickerAvailable() {
    return Boolean(input.isTTY && output.isTTY && typeof input.setRawMode === 'function');
  }

  async function pickLiveSettingsActionWithKeyboard(defaultIndex = 0, draft = null) {
    const dropout = tutorStubDagFactDropoutSnapshot(state.learnerDag?.dropout);
    const overlays = new Set(draft?.overlays || state.register?.overlays || []);
    const draftTrainingReuseEnabled = draft?.trainingReuseEnabled ?? state.trainingReuse?.requested === 'on';
    const draftTrainingReuse = resolveTutorStubTrainingReuse({
      requested: draftTrainingReuseEnabled ? 'on' : 'off',
      source: 'settings_panel_preview',
      humanSubjectClass: state.trainingReuse?.declaredHumanSubjectClass,
      humanSubjectClassSource: state.trainingReuse?.humanSubjectClassSource,
      humanInputExpected: state.trainingReuse?.humanInputExpected,
    });
    const entries = [
      {
        id: 'all_models',
        label: 'One model for all roles',
        value: draft?.allModelsOverrideRef || 'off · roles selected separately',
        description: 'Choose one model for tutor voice, learner interpretation, reasoning, and learner voice.',
      },
      {
        id: 'tutor_model',
        label: 'Tutor voice',
        value: draft?.tutorModelRef || state.modelRef,
        description: 'Choose the model that writes the public tutor response.',
      },
      {
        id: 'classifier_model',
        label: 'Learner interpretation',
        value: `${draft?.classifierModelRef || liveModelRoleRef('classifier')}${
          state.classifier?.combined ? ' · combined/inactive' : state.classifier?.enabled ? '' : ' · inactive'
        }`,
        description: state.classifier?.combined
          ? 'Saved separately, but the reasoning tracker currently performs this interpretation in its combined call.'
          : 'Choose the model that classifies what the learner just said.',
      },
      {
        id: 'reasoning_model',
        label: 'Reasoning tracker',
        value: `${draft?.reasoningModelRef || liveModelRoleRef('reasoning')}${
          state.learnerDag?.enabled ? ' · includes interpretation' : ' · inactive'
        }`,
        description: 'Choose the model that maps the learner turn onto the public reasoning record.',
      },
      {
        id: 'learner_model',
        label: 'Learner voice',
        value: `${draft?.learnerModelRef || liveModelRoleRef('learner')}${
          learnerSuggestionEnabled ? '' : ' · inactive'
        }`,
        description: 'Choose the model that writes automated turns and mixed-mode learner suggestions.',
      },
      {
        id: 'theme',
        label: 'Terminal theme',
        value: tutorStubCliThemeOptions().find((option) => option.id === (draft?.theme || getCliPresentation().themeId))
          ?.label,
        description: 'Cycle a live color preview. No-color terminals keep the same hierarchy without color.',
      },
      {
        id: 'motion',
        label: 'Terminal motion',
        value: draft?.motion || getCliPresentation().requestedMotion,
        description: 'Choose full, subtle, automatic, or still progress motion.',
      },
      {
        id: 'stance_temp',
        label: 'Teaching-style range',
        value: String(draft?.temperature ?? state.register?.temperature ?? registerTemperature),
        description: 'Lower concentrates the strongest teaching style; higher mixes in more alternatives.',
      },
      {
        id: 'dropout',
        label: 'Evidence-memory dropout',
        value: `${draft?.dropoutRate ?? dropout.rate}${state.learnerDag?.enabled ? '' : ' · inactive'}`,
        description:
          'Set the chance that previously understood evidence is temporarily forgotten and can be recovered.',
      },
      {
        id: 'release_speed',
        label: 'Clue release speed',
        value: `${draft?.releaseSpeed ?? state.releasePacing?.baseSpeed ?? DEFAULT_TUTOR_STUB_RELEASE_SPEED}x`,
        description:
          'Set the baseline pace for new clues. The dialogue can still speed up or slow down when the learner asks.',
      },
      {
        id: 'light_adaptation',
        label: 'Difficulty shift',
        value: `${(draft?.lightAdaptationEnabled ?? state.lightAdaptation?.enabled === true) ? 'on' : 'off'}${
          state.register?.enabled ? '' : ' · inactive'
        }`,
        description:
          'After repeated confusion or frustration, make a replayable shift in tutor style and host character.',
      },
      {
        id: 'training_reuse',
        label: 'Training reuse',
        value: `${draftTrainingReuseEnabled ? 'on' : 'off'} · ${tutorStubTrainingReuseLabel(draftTrainingReuse)}`,
        description:
          'Allow owner-authored or mixed dialogue to be reviewed as a future training candidate, or opt it out.',
      },
      {
        id: 'state_overlay',
        label: 'Turn-change override',
        value: overlays.has('state') ? 'on' : 'off',
        description: 'Let a strong change in the latest learner turn alter the teaching style immediately.',
      },
      {
        id: 'field_overlay',
        label: 'Conversation override',
        value: overlays.has('field') ? 'on' : 'off',
        description: 'Let a strong change in the conversation as a whole alter the teaching style.',
      },
      {
        id: 'overlay_threshold',
        label: 'Override sensitivity',
        value: String(
          draft?.overlayThreshold ?? state.register?.overlayThreshold ?? DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
        ),
        description: 'Lower values react more often; higher values wait for a clearer change.',
      },
      {
        id: 'forget',
        label: 'Forget saved settings',
        value: draft?.forgetSavedSettings
          ? 'yes · apply on Done'
          : state.rememberedSettings?.enabled
            ? 'no · remembering on'
            : 'no · nothing saved',
        description: 'Choose whether Done should forget saved defaults; Escape leaves them untouched.',
      },
      {
        id: 'done',
        label: 'Done — apply and return',
        value: 'press Enter',
        description: 'Apply every pending change and return to the current learner or coach prompt.',
      },
    ];
    let selectedIndex = Math.max(0, Math.min(Number(defaultIndex) || 0, entries.length - 1));
    let renderedLineCount = 0;
    const clearMenu = () => {
      if (!renderedLineCount) return;
      moveCursor(output, 0, -renderedLineCount);
      for (let index = 0; index < renderedLineCount; index += 1) {
        cursorTo(output, 0);
        clearLine(output, 0);
        if (index < renderedLineCount - 1) moveCursor(output, 0, 1);
      }
      if (renderedLineCount > 1) moveCursor(output, 0, -(renderedLineCount - 1));
      renderedLineCount = 0;
    };
    const render = () => {
      clearMenu();
      const width = Math.max(68, Math.min(Number(output.columns || 100), 140));
      const valueWidth = Math.max(16, Math.min(38, Math.floor(width * 0.34)));
      const selected = entries[selectedIndex];
      const entryLines = entries.flatMap((entry, index) => {
        const active = index === selectedIndex;
        const value = oneLine(entry.value, { max: valueWidth }).padEnd(valueWidth);
        const plain = `${active ? '›' : ' '} ${entry.label.padEnd(21)} ${value}`;
        const row = active
          ? `${entry.id === 'done' ? C.brightGreen : C.cyan}${C.bold}${plain}${C.reset}`
          : entry.id === 'done'
            ? `${C.green}${plain}${C.reset}`
            : `${C.dim}${plain}${C.reset}`;
        return entry.id === 'done'
          ? [`${C.dim}  ${'─'.repeat(Math.max(24, Math.min(width - 4, 64)))}${C.reset}`, row]
          : [row];
      });
      const lines = [
        `${C.brightCyan}${C.bold}Settings · choose what to change${C.reset}`,
        `${C.dim}  ↑/↓ move · Enter edit or toggle · Esc discard changes and return${C.reset}`,
        ...entryLines,
        `${C.brightYellow}${C.bold}  about >${C.reset} ${oneLine(selected.description, {
          max: Math.max(44, width - 11),
        })}`,
      ];
      for (const line of lines) output.write(`${line}\n`);
      renderedLineCount = lines.length;
    };
    emitKeypressEvents(input);
    const priorListeners = input.listeners('keypress');
    for (const listener of priorListeners) input.removeListener('keypress', listener);
    const wasRaw = Boolean(input.isRaw);
    if (!wasRaw) input.setRawMode(true);
    return new Promise((resolve) => {
      const finish = (selection) => {
        input.removeListener('keypress', onKeypress);
        for (const listener of priorListeners) input.on('keypress', listener);
        if (!wasRaw) input.setRawMode(false);
        clearMenu();
        resolve(selection);
      };
      const move = (delta) => {
        selectedIndex = (selectedIndex + delta + entries.length) % entries.length;
        render();
      };
      const onKeypress = (character, key = {}) => {
        if ((key.ctrl && key.name === 'c') || key.name === 'escape') return finish(null);
        if (key.name === 'up' || character === 'k') return move(-1);
        if (key.name === 'down' || character === 'j') return move(1);
        if (key.name === 'home') {
          selectedIndex = 0;
          render();
          return;
        }
        if (key.name === 'end') {
          selectedIndex = entries.length - 1;
          render();
          return;
        }
        if (key.name === 'return' || key.name === 'enter') {
          finish({ ...entries[selectedIndex], index: selectedIndex });
        }
      };
      input.on('keypress', onKeypress);
      input.resume();
      render();
    });
  }

  async function pickLiveNumericSettingWithKeyboard({
    label,
    value,
    min,
    max,
    step,
    coarseStep,
    recommended,
    explanation,
  }) {
    let selected = Number(value);
    let renderedLineCount = 0;
    const precision = Math.max(
      String(step).split('.')[1]?.length || 0,
      String(coarseStep).split('.')[1]?.length || 0,
      2,
    );
    const normalize = (next) => Number(Math.max(min, Math.min(max, next)).toFixed(precision));
    const clearMenu = () => {
      if (!renderedLineCount) return;
      moveCursor(output, 0, -renderedLineCount);
      for (let index = 0; index < renderedLineCount; index += 1) {
        cursorTo(output, 0);
        clearLine(output, 0);
        if (index < renderedLineCount - 1) moveCursor(output, 0, 1);
      }
      if (renderedLineCount > 1) moveCursor(output, 0, -(renderedLineCount - 1));
      renderedLineCount = 0;
    };
    const render = () => {
      clearMenu();
      const width = Math.max(68, Math.min(Number(output.columns || 100), 140));
      const barWidth = Math.max(18, Math.min(36, width - 42));
      const position = Math.round(((selected - min) / Math.max(max - min, Number.EPSILON)) * barWidth);
      const bar = `${'━'.repeat(position)}●${'─'.repeat(Math.max(0, barWidth - position))}`;
      const lines = [
        `${C.brightCyan}${C.bold}${label}${C.reset}`,
        `${C.cyan}${C.bold}  ${bar}  ${selected}${C.reset}`,
        `${C.dim}  range ${min}–${max} · ←/→ ${step} · PgUp/PgDn ${coarseStep} · R recommended ${recommended}${C.reset}`,
        `${C.brightYellow}${C.bold}  effect >${C.reset} ${oneLine(explanation, { max: Math.max(44, width - 12) })}`,
        `${C.dim}  Enter keep · Esc back · saved only when you choose Done${C.reset}`,
      ];
      for (const line of lines) output.write(`${line}\n`);
      renderedLineCount = lines.length;
    };
    emitKeypressEvents(input);
    const priorListeners = input.listeners('keypress');
    for (const listener of priorListeners) input.removeListener('keypress', listener);
    const wasRaw = Boolean(input.isRaw);
    if (!wasRaw) input.setRawMode(true);
    return new Promise((resolve) => {
      const finish = (next) => {
        input.removeListener('keypress', onKeypress);
        for (const listener of priorListeners) input.on('keypress', listener);
        if (!wasRaw) input.setRawMode(false);
        clearMenu();
        resolve(next);
      };
      const adjust = (delta) => {
        selected = normalize(selected + delta);
        render();
      };
      const onKeypress = (character, key = {}) => {
        if ((key.ctrl && key.name === 'c') || key.name === 'escape') return finish(null);
        if (key.name === 'left' || key.name === 'down' || character === 'h' || character === 'j') {
          return adjust(-step);
        }
        if (key.name === 'right' || key.name === 'up' || character === 'l' || character === 'k') {
          return adjust(step);
        }
        if (key.name === 'pageup') return adjust(coarseStep);
        if (key.name === 'pagedown') return adjust(-coarseStep);
        if (String(character || '').toLowerCase() === 'r') {
          selected = normalize(recommended);
          render();
          return;
        }
        if (key.name === 'return' || key.name === 'enter') finish(selected);
      };
      input.on('keypress', onKeypress);
      input.resume();
      render();
    });
  }

  async function pickInitialMixedLearnerProfileWithKeyboard(defaultProfileId) {
    const coreIds = new Set(learnerProfileSuiteIds('core'));
    const entries = learnerProfileIds().map((id) => {
      const contract = learnerProfileContract(id);
      const presentation = learnerProfilePickerPresentation(id);
      return {
        id,
        label: contract?.intent?.shortName || id,
        group: presentation?.group || (coreIds.has(id) ? 'core' : 'stress probe'),
        description: presentation?.description || contract?.behaviorContract?.stableFailure?.description || '',
        voice: presentation?.voice || contract?.publicVoice?.signature || '',
        nearestNeighbor: presentation?.nearestNeighbor || null,
        contrast: presentation?.contrast || null,
      };
    });
    if (!mixedLearner.profileId) {
      entries.unshift({
        id: null,
        label: 'Custom launch profile',
        group: 'custom',
        description: oneLine(mixedLearner.profile, { max: 180 }),
        voice: 'Uses the custom launch prompt without a named public voice contract.',
        nearestNeighbor: null,
        contrast: null,
      });
    }
    let selectedIndex = Math.max(
      0,
      entries.findIndex((entry) => (entry.id || 'custom') === defaultProfileId),
    );
    const viewportHeight = Math.min(
      entries.length,
      Math.max(4, Math.min(8, Math.max(4, Number(output.rows || 24) - 8))),
    );
    let viewportStart = Math.max(0, Math.min(selectedIndex, entries.length - viewportHeight));
    let renderedLineCount = 0;

    const keepSelectionVisible = () => {
      if (selectedIndex < viewportStart) viewportStart = selectedIndex;
      if (selectedIndex >= viewportStart + viewportHeight) {
        viewportStart = selectedIndex - viewportHeight + 1;
      }
    };
    const clearRenderedMenu = () => {
      if (!renderedLineCount) return;
      moveCursor(output, 0, -renderedLineCount);
      for (let index = 0; index < renderedLineCount; index += 1) {
        cursorTo(output, 0);
        clearLine(output, 0);
        if (index < renderedLineCount - 1) moveCursor(output, 0, 1);
      }
      if (renderedLineCount > 1) moveCursor(output, 0, -(renderedLineCount - 1));
      renderedLineCount = 0;
    };
    const renderMenu = () => {
      keepSelectionVisible();
      clearRenderedMenu();
      const width = Math.max(48, Math.min(Number(output.columns || 100), 140));
      const visible = entries.slice(viewportStart, viewportStart + viewportHeight);
      const selectedEntry = entries[selectedIndex];
      const descriptionWidth = Math.max(32, width - 11);
      const lines = [
        `${C.dim}${viewportStart > 0 ? `  ↑ ${viewportStart} more` : '  '}${C.reset}`,
        ...visible.map((entry, visibleIndex) => {
          const absoluteIndex = viewportStart + visibleIndex;
          const selected = absoluteIndex === selectedIndex;
          const id = entry.id || 'custom';
          const plain = `${selected ? '›' : ' '} ${id.padEnd(24)} ${oneLine(entry.label, {
            max: Math.max(12, width - 38),
          })} [${entry.group}]`;
          return selected ? `${C.cyan}${C.bold}${plain}${C.reset}` : plain;
        }),
        `${C.dim}${
          viewportStart + viewportHeight < entries.length
            ? `  ↓ ${entries.length - viewportStart - viewportHeight} more`
            : '  '
        }${C.reset}`,
        `${C.brightYellow}${C.bold}  pattern >${C.reset} ${oneLine(selectedEntry.description, {
          max: descriptionWidth,
        })}`,
        `${C.cyan}${C.bold}  sounds >${C.reset} ${oneLine(selectedEntry.voice, { max: descriptionWidth })}`,
        selectedEntry.nearestNeighbor && selectedEntry.contrast
          ? `${C.dim}  differs > from ${selectedEntry.nearestNeighbor}: ${oneLine(selectedEntry.contrast, {
              max: Math.max(24, width - selectedEntry.nearestNeighbor.length - 20),
            })}${C.reset}`
          : `${C.dim}  differs > baseline for ordinary partial reasoning and repair${C.reset}`,
      ];
      for (const line of lines) output.write(`${line}\n`);
      renderedLineCount = lines.length;
    };

    emitKeypressEvents(input);
    const priorKeypressListeners = input.listeners('keypress');
    for (const listener of priorKeypressListeners) input.removeListener('keypress', listener);
    const wasRaw = Boolean(input.isRaw);
    if (!wasRaw) input.setRawMode(true);

    return new Promise((resolve) => {
      const finish = (selection) => {
        input.removeListener('keypress', onKeypress);
        for (const listener of priorKeypressListeners) input.on('keypress', listener);
        if (!wasRaw) input.setRawMode(false);
        clearRenderedMenu();
        resolve(selection);
      };
      const moveSelection = (delta) => {
        selectedIndex = (selectedIndex + delta + entries.length) % entries.length;
        renderMenu();
      };
      const onKeypress = (character, key = {}) => {
        if ((key.ctrl && key.name === 'c') || key.name === 'escape') {
          finish(null);
          return;
        }
        if (key.name === 'up' || character === 'k') {
          moveSelection(-1);
          return;
        }
        if (key.name === 'down' || character === 'j') {
          moveSelection(1);
          return;
        }
        if (key.name === 'pageup') {
          moveSelection(-viewportHeight);
          return;
        }
        if (key.name === 'pagedown') {
          moveSelection(viewportHeight);
          return;
        }
        if (key.name === 'home') {
          selectedIndex = 0;
          renderMenu();
          return;
        }
        if (key.name === 'end') {
          selectedIndex = entries.length - 1;
          renderMenu();
          return;
        }
        if (key.name === 'return' || key.name === 'enter') finish(entries[selectedIndex]);
      };
      input.on('keypress', onKeypress);
      input.resume();
      renderMenu();
    });
  }

  async function pickLiveTutorRegisterWithKeyboard(defaultRegisterId = 'auto') {
    const definitions = getEngagementStanceDefinitions();
    const palette = humanDirectedRegisterPalette();
    const entries = [
      {
        id: 'auto',
        label: 'Adaptive selection',
        group: 'automatic',
        signature: 'The conversation chooses how the tutor sounds on each turn.',
        contrast: 'Character remains independent: it controls what the tutor does in the scene.',
      },
      ...palette
        .filter((id) => definitions[id]?.simulated_only !== true)
        .map((id) => ({
          id,
          label: displayDiagnosticLabel(id),
          group: definitions[id]?.router_selectable === true ? 'adaptive-core' : 'full-range',
          signature: oneLine(definitions[id]?.public_signature || definitions[id]?.stance_contract, { max: 220 }),
          contrast: oneLine(definitions[id]?.contrast, { max: 220 }),
        })),
    ];
    let selectedIndex = Math.max(
      0,
      entries.findIndex((entry) => entry.id === (defaultRegisterId || 'auto')),
    );
    const viewportHeight = Math.min(entries.length, Math.max(4, Math.min(8, Number(output.rows || 24) - 9)));
    let viewportStart = Math.max(0, Math.min(selectedIndex, entries.length - viewportHeight));
    let renderedLineCount = 0;
    const keepVisible = () => {
      if (selectedIndex < viewportStart) viewportStart = selectedIndex;
      if (selectedIndex >= viewportStart + viewportHeight) viewportStart = selectedIndex - viewportHeight + 1;
    };
    const clearMenu = () => {
      if (!renderedLineCount) return;
      moveCursor(output, 0, -renderedLineCount);
      for (let index = 0; index < renderedLineCount; index += 1) {
        cursorTo(output, 0);
        clearLine(output, 0);
        if (index < renderedLineCount - 1) moveCursor(output, 0, 1);
      }
      if (renderedLineCount > 1) moveCursor(output, 0, -(renderedLineCount - 1));
      renderedLineCount = 0;
    };
    const render = () => {
      keepVisible();
      clearMenu();
      const width = Math.max(60, Math.min(Number(output.columns || 100), 140));
      const visible = entries.slice(viewportStart, viewportStart + viewportHeight);
      const selected = entries[selectedIndex];
      const lines = [
        `${C.dim}${viewportStart > 0 ? `  ↑ ${viewportStart} more` : '  '}${C.reset}`,
        ...visible.map((entry, offset) => {
          const active = viewportStart + offset === selectedIndex;
          const plain = `${active ? '›' : ' '} ${entry.id.padEnd(16)} ${oneLine(entry.label, {
            max: Math.max(12, width - 38),
          })} [${entry.group}]`;
          return active ? `${C.brightMagenta}${C.bold}${plain}${C.reset}` : plain;
        }),
        `${C.dim}${
          viewportStart + viewportHeight < entries.length
            ? `  ↓ ${entries.length - viewportStart - viewportHeight} more`
            : '  '
        }${C.reset}`,
        `${C.brightYellow}${C.bold}  sounds >${C.reset} ${oneLine(selected.signature, {
          max: Math.max(36, width - 13),
        })}`,
        `${C.dim}  differs > ${oneLine(selected.contrast, { max: Math.max(34, width - 13) })}${C.reset}`,
        `${C.dim}  register changes voice; tutor character changes the repeated public action${C.reset}`,
      ];
      for (const line of lines) output.write(`${line}\n`);
      renderedLineCount = lines.length;
    };
    emitKeypressEvents(input);
    const priorListeners = input.listeners('keypress');
    for (const listener of priorListeners) input.removeListener('keypress', listener);
    const wasRaw = Boolean(input.isRaw);
    if (!wasRaw) input.setRawMode(true);
    return new Promise((resolve) => {
      const finish = (selection) => {
        input.removeListener('keypress', onKeypress);
        for (const listener of priorListeners) input.on('keypress', listener);
        if (!wasRaw) input.setRawMode(false);
        clearMenu();
        resolve(selection);
      };
      const move = (delta) => {
        selectedIndex = (selectedIndex + delta + entries.length) % entries.length;
        render();
      };
      const onKeypress = (character, key = {}) => {
        if ((key.ctrl && key.name === 'c') || key.name === 'escape') return finish(null);
        if (key.name === 'up' || character === 'k') return move(-1);
        if (key.name === 'down' || character === 'j') return move(1);
        if (key.name === 'pageup') return move(-viewportHeight);
        if (key.name === 'pagedown') return move(viewportHeight);
        if (key.name === 'home') {
          selectedIndex = 0;
          render();
          return;
        }
        if (key.name === 'end') {
          selectedIndex = entries.length - 1;
          render();
          return;
        }
        if (key.name === 'return' || key.name === 'enter') finish(entries[selectedIndex]);
      };
      input.on('keypress', onKeypress);
      input.resume();
      render();
    });
  }

  async function pickLiveTutorCharacterWithKeyboard(defaultCharacterId = 'auto') {
    const definitions = getActorialPartDefinitions();
    const entries = [
      {
        id: 'auto',
        label: 'Adaptive selection',
        group: 'automatic',
        signature:
          'Return character choice to light adaptation, random performance, or the configured teaching policy.',
        contrast: 'Register remains independent: it controls how that action sounds.',
      },
      ...tutorStubConfigurableActorialPartIds().map((id) => ({
        id,
        label: definitions[id]?.label || displayDiagnosticLabel(id),
        group: 'full-range',
        signature: oneLine(definitions[id]?.public_signature || definitions[id]?.contract, { max: 220 }),
        contrast: oneLine(definitions[id]?.contrast, { max: 220 }),
      })),
    ];
    let selectedIndex = Math.max(
      0,
      entries.findIndex((entry) => entry.id === (defaultCharacterId || 'auto')),
    );
    const viewportHeight = Math.min(entries.length, Math.max(4, Math.min(8, Number(output.rows || 24) - 7)));
    let viewportStart = Math.max(0, Math.min(selectedIndex, entries.length - viewportHeight));
    let renderedLineCount = 0;
    const keepVisible = () => {
      if (selectedIndex < viewportStart) viewportStart = selectedIndex;
      if (selectedIndex >= viewportStart + viewportHeight) viewportStart = selectedIndex - viewportHeight + 1;
    };
    const clearMenu = () => {
      if (!renderedLineCount) return;
      moveCursor(output, 0, -renderedLineCount);
      for (let index = 0; index < renderedLineCount; index += 1) {
        cursorTo(output, 0);
        clearLine(output, 0);
        if (index < renderedLineCount - 1) moveCursor(output, 0, 1);
      }
      if (renderedLineCount > 1) moveCursor(output, 0, -(renderedLineCount - 1));
      renderedLineCount = 0;
    };
    const render = () => {
      keepVisible();
      clearMenu();
      const width = Math.max(60, Math.min(Number(output.columns || 100), 140));
      const visible = entries.slice(viewportStart, viewportStart + viewportHeight);
      const selected = entries[selectedIndex];
      const lines = [
        `${C.dim}${viewportStart > 0 ? `  ↑ ${viewportStart} more` : '  '}${C.reset}`,
        ...visible.map((entry, offset) => {
          const active = viewportStart + offset === selectedIndex;
          const plain = `${active ? '›' : ' '} ${entry.id.padEnd(24)} ${oneLine(entry.label, {
            max: Math.max(12, width - 42),
          })} [${entry.group}]`;
          return active ? `${C.brightMagenta}${C.bold}${plain}${C.reset}` : plain;
        }),
        `${C.dim}${
          viewportStart + viewportHeight < entries.length
            ? `  ↓ ${entries.length - viewportStart - viewportHeight} more`
            : '  '
        }${C.reset}`,
        `${C.brightYellow}${C.bold}  does >${C.reset} ${oneLine(selected.signature, { max: Math.max(36, width - 11) })}`,
        `${C.dim}  differs > ${oneLine(selected.contrast, { max: Math.max(34, width - 13) })}${C.reset}`,
        `${C.dim}  character changes the repeated public action; register changes its voice${C.reset}`,
      ];
      for (const line of lines) output.write(`${line}\n`);
      renderedLineCount = lines.length;
    };
    emitKeypressEvents(input);
    const priorListeners = input.listeners('keypress');
    for (const listener of priorListeners) input.removeListener('keypress', listener);
    const wasRaw = Boolean(input.isRaw);
    if (!wasRaw) input.setRawMode(true);
    return new Promise((resolve) => {
      const finish = (selection) => {
        input.removeListener('keypress', onKeypress);
        for (const listener of priorListeners) input.on('keypress', listener);
        if (!wasRaw) input.setRawMode(false);
        clearMenu();
        resolve(selection);
      };
      const move = (delta) => {
        selectedIndex = (selectedIndex + delta + entries.length) % entries.length;
        render();
      };
      const onKeypress = (character, key = {}) => {
        if ((key.ctrl && key.name === 'c') || key.name === 'escape') return finish(null);
        if (key.name === 'up' || character === 'k') return move(-1);
        if (key.name === 'down' || character === 'j') return move(1);
        if (key.name === 'pageup') return move(-viewportHeight);
        if (key.name === 'pagedown') return move(viewportHeight);
        if (key.name === 'home') {
          selectedIndex = 0;
          render();
          return;
        }
        if (key.name === 'end') {
          selectedIndex = entries.length - 1;
          render();
          return;
        }
        if (key.name === 'return' || key.name === 'enter') finish(entries[selectedIndex]);
      };
      input.on('keypress', onKeypress);
      input.resume();
      render();
    });
  }

  async function pickLiveCharacterTargetWithKeyboard(defaultTarget = 'learner') {
    const learnerCharacter = mixedLearner.enabled
      ? mixedLearner.profileId || 'custom'
      : state.autoLearner?.enabled
        ? state.autoLearner.profileId || 'custom'
        : 'human learner';
    const tutorCharacter = state.register?.enabled
      ? explicitPerformanceDirectiveValue(state, 'character') || 'auto'
      : 'adaptive delivery off';
    const entries = [
      {
        id: 'learner',
        label: 'Learner',
        value: learnerCharacter,
        description: 'Choose the visible learner behavior profile used by mixed drafting.',
      },
      {
        id: 'tutor',
        label: 'Tutor',
        value: tutorCharacter,
        description: 'Choose the in-scene host part used to realize subsequent tutor turns.',
      },
    ];
    let selectedIndex = Math.max(
      0,
      entries.findIndex((entry) => entry.id === defaultTarget),
    );
    let renderedLineCount = 0;
    const clearMenu = () => {
      if (!renderedLineCount) return;
      moveCursor(output, 0, -renderedLineCount);
      for (let index = 0; index < renderedLineCount; index += 1) {
        cursorTo(output, 0);
        clearLine(output, 0);
        if (index < renderedLineCount - 1) moveCursor(output, 0, 1);
      }
      if (renderedLineCount > 1) moveCursor(output, 0, -(renderedLineCount - 1));
      renderedLineCount = 0;
    };
    const render = () => {
      clearMenu();
      const width = Math.max(56, Math.min(Number(output.columns || 100), 140));
      const selected = entries[selectedIndex];
      const lines = [
        `${C.brightCyan}${C.bold}Character · choose learner or tutor${C.reset}`,
        `${C.dim}  ↑/↓ move · Enter choose · Esc return${C.reset}`,
        ...entries.map((entry, index) => {
          const active = index === selectedIndex;
          const plain = `${active ? '›' : ' '} ${entry.label.padEnd(10)} ${oneLine(entry.value, {
            max: Math.max(18, width - 19),
          })}`;
          if (!active) return `${C.dim}${plain}${C.reset}`;
          const color = entry.id === 'learner' ? C.cyan : C.brightMagenta;
          return `${color}${C.bold}${plain}${C.reset}`;
        }),
        `${C.brightYellow}${C.bold}  about >${C.reset} ${oneLine(selected.description, {
          max: Math.max(38, width - 11),
        })}`,
      ];
      for (const line of lines) output.write(`${line}\n`);
      renderedLineCount = lines.length;
    };
    emitKeypressEvents(input);
    const priorListeners = input.listeners('keypress');
    for (const listener of priorListeners) input.removeListener('keypress', listener);
    const wasRaw = Boolean(input.isRaw);
    if (!wasRaw) input.setRawMode(true);
    return new Promise((resolve) => {
      const finish = (selection) => {
        input.removeListener('keypress', onKeypress);
        for (const listener of priorListeners) input.on('keypress', listener);
        if (!wasRaw) input.setRawMode(false);
        clearMenu();
        resolve(selection);
      };
      const move = (delta) => {
        selectedIndex = (selectedIndex + delta + entries.length) % entries.length;
        render();
      };
      const onKeypress = (character, key = {}) => {
        if ((key.ctrl && key.name === 'c') || key.name === 'escape') return finish(null);
        if (key.name === 'up' || character === 'k') return move(-1);
        if (key.name === 'down' || character === 'j') return move(1);
        if (key.name === 'home') {
          selectedIndex = 0;
          render();
          return;
        }
        if (key.name === 'end') {
          selectedIndex = entries.length - 1;
          render();
          return;
        }
        if (key.name === 'return' || key.name === 'enter') finish(entries[selectedIndex]);
      };
      input.on('keypress', onKeypress);
      input.resume();
      render();
    });
  }

  return Object.freeze({
    liveModelRoleDefinitions,
    applyTutorModelSelection,
    liveModelRoleRef,
    liveModelRoleSnapshot,
    refreshVisibleClassifierConfig,
    applyRoleModelSelection,
    applyAllRoleModelSelection,
    pickInitialTutorModelWithKeyboard,
    liveSettingsPickerAvailable,
    pickLiveSettingsActionWithKeyboard,
    pickLiveNumericSettingWithKeyboard,
    pickInitialMixedLearnerProfileWithKeyboard,
    pickLiveTutorRegisterWithKeyboard,
    pickLiveTutorCharacterWithKeyboard,
    pickLiveCharacterTargetWithKeyboard,
  });
}
