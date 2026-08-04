export function createTutorStubSessionStateRuntime(dependencies = {}) {
  const {
    C,
    DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
    DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
    DEFAULT_TUTOR_STUB_RELEASE_SPEED,
    ROOT,
    STUB,
    appendTraceEvent,
    args,
    clearStatusLine,
    clearTutorStubLastSettings,
    curriculumBundle,
    getCliPresentation,
    jsonClone,
    path,
    state,
    tutorStubCurriculumPublicProjection,
    voiceModel,
    voiceName,
    writeTutorStubLastSettings,
  } = dependencies;

  function sessionRuntimeStateSnapshot() {
    const publicMessages = state.history.map((message) => ({
      role: message.role,
      content: String(message.content || ''),
    }));
    const expectedOpeningMessageCount = state.turns.length * 2 + (state.resumeHandoff ? 2 : 1);
    const opening =
      publicMessages.length === expectedOpeningMessageCount && publicMessages[0]?.role === 'assistant'
        ? jsonClone(publicMessages[0])
        : null;
    return {
      capabilityMode: state.capabilities.mode,
      worldId: state.world?.id || null,
      curriculumModuleId: state.curriculum?.module?.id || null,
      curriculumModuleTitle: state.curriculum?.module?.title || null,
      topic: state.curriculum?.module?.title || state.world?.title || state.topic,
      curriculumProgress:
        curriculumBundle && state.curriculum?.runtime
          ? tutorStubCurriculumPublicProjection(curriculumBundle, state.curriculum.runtime)
          : null,
      interactionMode: state.interaction?.mode || null,
      turnCount: state.turns.length,
      publicMessageCount: state.history.length,
      opening,
      resumeHandoff: state.resumeHandoff ? jsonClone(state.resumeHandoff) : null,
      publicMessages,
      dialogueClosurePhase: state.dialogueClosure?.phase || null,
      learnerProfileId: state.learnerProfileId || null,
      tutorInstanceRef: state.tuning?.activeRef || state.tutorInstance?.id || null,
      committeeEnabled: state.committee?.enabled === true,
      committeeModel: state.committee?.miniModel || null,
    };
  }

  function recordSessionRuntimeEvent(event) {
    appendTraceEvent(state.trace, {
      type: event.traceEvent || 'session_runtime_event',
      sessionRuntimeSchema: event.schema,
      sessionId: event.sessionId,
      sequence: event.sequence,
      runtimeEvent: event.event,
      runtimeStatus: event.status,
      runtimeRevision: event.revision,
      at: event.at,
      details: event.details,
      publicTranscriptChanged: false,
    });
  }

  function rejectUnavailableSessionCommand({ token, reasons, capabilityMode, context }) {
    clearStatusLine();
    console.log(
      `${C.dim}${token} is unavailable in this ${capabilityMode} session${
        reasons.length ? `: ${reasons.join('; ')}` : ''
      }; use /help for the active command surface${C.reset}\n`,
    );
    appendTraceEvent(state.trace, {
      type: state.passthrough?.enabled ? 'passthrough_command_rejected' : 'command_capability_rejected',
      command: token,
      capabilityMode,
      reasons,
      duringTurn: Boolean(context?.duringTurn),
      publicTranscriptChanged: false,
    });
    return true;
  }

  function handleUnknownSessionCommand({ input: commandInput, context }) {
    clearStatusLine();
    console.log(
      `${C.red}unknown command:${C.reset} ${commandInput}${C.dim} · type / to browse or use /help${C.reset}\n`,
    );
    appendTraceEvent(state.trace, {
      type: 'unknown_slash_command',
      command: commandInput,
      duringTurn: Boolean(context?.duringTurn),
    });
    return true;
  }

  function currentRememberedSettingsSnapshot() {
    return {
      scenarioId: state.world?.id || null,
      learnerProfileId: state.learnerProfileId || null,
      learnerProfile: state.learnerProfileId ? null : state.learnerProfile || null,
      tutorInstanceRef: state.tutorInstance.id,
      tuningMode: state.tuning.mode,
      tutorModelRef: state.modelRef,
      classifierModelRef: state.classifier?.modelRef || args['classifier-model'],
      learnerRecordModelRef: state.learnerDag?.modelRef || args['learner-record-model'],
      autoLearnerModelRef: state.autoLearner?.modelRef || args['auto-learner-model'],
      allModelsOverrideRef: state.modelRouting?.allRolesOverrideRef || null,
      voiceModel: state.voice?.model || voiceModel,
      voiceName: state.voice?.voice || voiceName,
      cliTheme: getCliPresentation().themeId,
      motion: getCliPresentation().requestedMotion,
      committeeEnabled: state.committee?.enabled === true,
      lightAdaptationEnabled: state.lightAdaptation?.enabled === true,
      trainingReuseEnabled: state.trainingReuse?.requested === 'on',
      engagementStanceTemperature: state.register?.temperature ?? DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
      dagFactDropoutRate: state.learnerDag?.dropout?.rate ?? DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
      releaseSpeed: state.releasePacing?.baseSpeed ?? DEFAULT_TUTOR_STUB_RELEASE_SPEED,
      registerPolicy: state.register?.policy || STUB.registerPolicy,
      registerOverlays: [...(state.register?.overlays || [])],
      registerOverlayThreshold: state.register?.overlayThreshold ?? DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
    };
  }

  function persistCurrentInteractiveSettings(reason, overrides = {}) {
    if (!state.rememberedSettings?.writeEnabled) return null;
    try {
      const saved = writeTutorStubLastSettings(state.rememberedSettings.filePath, {
        ...currentRememberedSettingsSnapshot(),
        ...overrides,
      });
      state.rememberedSettings.status = 'saved';
      state.rememberedSettings.savedAt = saved.updatedAt;
      state.rememberedSettings.warning = null;
      appendTraceEvent(state.trace, {
        type: 'interactive_settings_remembered',
        schema: saved.schema,
        reason,
        file: path.relative(ROOT, state.rememberedSettings.filePath),
        savedAt: saved.updatedAt,
        settings: saved,
      });
      return saved;
    } catch (error) {
      state.rememberedSettings.status = 'write_error';
      state.rememberedSettings.warning = error.message;
      appendTraceEvent(state.trace, {
        type: 'interactive_settings_remember_error',
        reason,
        file: path.relative(ROOT, state.rememberedSettings.filePath),
        error: error.message,
      });
      return null;
    }
  }

  function forgetRememberedInteractiveSettings({ source = 'settings' } = {}) {
    const result = clearTutorStubLastSettings(state.rememberedSettings.filePath);
    state.rememberedSettings.enabled = false;
    state.rememberedSettings.writeEnabled = false;
    state.rememberedSettings.status = 'forgotten';
    state.rememberedSettings.savedAt = null;
    appendTraceEvent(state.trace, {
      type: 'interactive_settings_forgotten',
      source,
      file: path.relative(ROOT, state.rememberedSettings.filePath),
      existed: result.existed,
      currentSessionChanged: false,
    });
    return result;
  }

  return {
    forgetRememberedInteractiveSettings,
    handleUnknownSessionCommand,
    persistCurrentInteractiveSettings,
    recordSessionRuntimeEvent,
    rejectUnavailableSessionCommand,
    sessionRuntimeStateSnapshot,
  };
}
