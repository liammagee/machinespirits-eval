/** Build the model, prompt, capability, and presentation context for one run. */
export function createTutorStubSessionApplicationContext({
  CURRICULUM_PHASE_PROMPT_END,
  CURRICULUM_PHASE_PROMPT_START,
  DEFAULT_INTERACTIVE_DEMO_TURNS,
  DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
  DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
  DEFAULT_TUTOR_STUB_RELEASE_SPEED,
  MAX_INTERACTIVE_DEMO_TURNS,
  MAX_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
  MAX_TUTOR_STUB_RELEASE_SPEED,
  MIN_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
  MIN_TUTOR_STUB_RELEASE_SPEED,
  ROOT,
  STUB,
  TUTOR_STUB_FEEDBACK_REASONS,
  TUTOR_STUB_LEARNER_DAG_PREFLIGHT_SCHEMA,
  TUTOR_STUB_LEARNER_RESPONSE_PROVENANCE_SCHEMA,
  TUTOR_STUB_OPENING_REQUIREMENTS,
  TUTOR_STUB_SESSION_RUNTIME_SCHEMA,
  args,
  assertTutorStubCapabilityCompatibility,
  assertTutorStubResumeCompatibility,
  auditTutorStubPrompt,
  auditTutorStubSpeakerPrivilege,
  autoLearnerEnabled,
  autoSafetyTurns,
  autoStopOnGrounded,
  autoTurns,
  automatedLearnerProfileId,
  buildHumanDiscourseFrame,
  buildHumanDiscourseRunConfig,
  buildRegisterPalette,
  buildTutorDesireDag,
  buildTutorStubOpeningFrame,
  buildTutorStubSessionRecipe,
  compareTutorStubResumeRecipe,
  createTutorStubDialogueClosureLifecycle,
  createTutorStubTuningRuntime,
  curriculumBundle,
  curriculumRuntime,
  dagFactDropoutRate,
  dagFactDropoutSeed,
  dagMode,
  delimitedPrompt,
  effectiveTemperatureForModel,
  effectiveTopic,
  existingScenarioAvailable,
  experimentRepeat,
  experimentRunSeed,
  explicitRememberedSources,
  fs,
  getProviderConfig,
  hashCanonicalJson,
  initialScenarioKeyboardMenuActive,
  initialScenarioPickerEnabled,
  initialScenarioSelection,
  interactiveSessionEnabled,
  interactiveSessionIntent,
  launchWorldBundle,
  learnerModelRequired,
  lightAdaptationEnabled,
  loadRegisterEmpiricalPrior,
  loadSystemPrompt,
  loadedRecipeApplication,
  loadedSessionRecipe,
  mixedLearnerEnabled,
  multipleChoiceEnabled,
  normalizeCliEffort,
  normalizeTutorStubEvidenceUseRubric,
  normalizeTutorStubHumanSubjectClass,
  normalizeTutorStubPublicLearnerAnalysisPromptProfile,
  normalizeTutorStubRegisterOverlayThreshold,
  normalizeTutorStubTrainingReuseSetting,
  observedAuditsEnabled,
  openingRealizer,
  parseTutorStubRegisterPolicyStack,
  passthroughEnabled,
  path,
  pointOfActionArm,
  positionals,
  providerSupportsEventStreaming,
  providerSupportsStreaming,
  rawCommandLineOptionProvided,
  registerTemperature,
  registerTemperatureApplies,
  releaseSpeed,
  rememberedScenarioAvailable,
  rememberedSettings,
  resolveModel,
  resolveTutorStubCapabilities,
  resolveTutorStubCharacterChoice,
  resolveTutorStubTrainingReuse,
  resolveWorkspacePath,
  resolvedHumanSubjectClassSource,
  resolvedResumeSource,
  resolvedTrainingReuseSource,
  responseDetailsEnabled,
  resumeRecipeApplication,
  resumeRequested,
  selectedLabAdmission,
  selectedLabResolution,
  temperature,
  tuningMode,
  turnFeedbackEnabled,
  tutorInstance,
  tutorStubCurriculumPrivatePrompt,
  tutorStubLabTraceMetadata,
  tutorStubPointOfActionStandingBook,
  tutorStubPromptArchitecture,
  tutorStubRecipeModelIdentity,
  tutorStubTuningPrompt,
  tutorStubTutorInstancePrompt,
  visibleResolvedModel,
  voiceLaunchRequested,
  worldBundle,
}) {
  let systemPrompt = loadSystemPrompt({
    worldBundle,
    curriculumBundle,
    dag: args.dag,
    topic: effectiveTopic,
    multipleChoice: multipleChoiceEnabled,
  });
  const tuning = createTutorStubTuningRuntime({
    instance: tutorInstance,
    mode: tuningMode,
    dir: args['tuning-dir'],
    write: !args['dry-run'],
  });
  systemPrompt = `${systemPrompt}\n\n${tutorStubTutorInstancePrompt(tutorInstance)}`;
  const reviewedTutorMemory = tutorStubTuningPrompt(tuning);
  if (reviewedTutorMemory) systemPrompt = `${systemPrompt}\n\n${reviewedTutorMemory}`;
  if (args['prompt-book-context']) {
    const promptBookText = fs.readFileSync(path.resolve(args['prompt-book-context']), 'utf8');
    systemPrompt = `${systemPrompt}\n\n[Prompt book — your durable role memory from prior performances. Honour its notes as craft guidance; it never overrides world rules or the release schedule.]\n${promptBookText}\n[End prompt book]`;
    console.log(`[greenroom] prompt book injected: ${promptBookText.length} chars from ${args['prompt-book-context']}`);
  }
  if (pointOfActionArm === 'standing_book') {
    const standingBook = tutorStubPointOfActionStandingBook();
    systemPrompt = `${systemPrompt}\n\n${standingBook}`;
    console.log(`[step4] standing point-of-action book injected: ${standingBook.length} chars`);
  }
  if (curriculumBundle && curriculumRuntime) {
    systemPrompt = `${systemPrompt}\n\n${delimitedPrompt(
      CURRICULUM_PHASE_PROMPT_START,
      tutorStubCurriculumPrivatePrompt(curriculumBundle, curriculumRuntime),
      CURRICULUM_PHASE_PROMPT_END,
    )}`;
  }
  const promptArchitecture = tutorStubPromptArchitecture({
    dagEnabled: Boolean(args.dag && worldBundle),
  });
  promptArchitecture.audit.baseSystem = auditTutorStubPrompt({
    surface: 'tutor_system',
    systemPrompt,
    instructionTexts: [systemPrompt],
  });
  promptArchitecture.audit.baseSpeakerPrivilege = auditTutorStubSpeakerPrivilege({
    world: args.dag ? worldBundle?.world || null : null,
    tutorTurn: 0,
    systemPrompt,
  });
  if (!promptArchitecture.audit.baseSystem.ok) {
    throw new Error(
      `Base prompt audit failed: ${promptArchitecture.audit.baseSystem.violations
        .map((violation) => violation.code)
        .join(', ')}`,
    );
  }
  if (!promptArchitecture.audit.baseSpeakerPrivilege.ok) {
    throw new Error(
      `Base speaking-tutor prompt crossed the private-planner boundary: ${promptArchitecture.audit.baseSpeakerPrivilege.issues
        .map((issue) => `${issue.code}:${issue.source}`)
        .join(', ')}`,
    );
  }
  const tutorDag = args.dag && worldBundle ? buildTutorDesireDag(worldBundle.world) : null;
  const resolved = resolveModel(args.model);
  const providerConfig = getProviderConfig(resolved.provider);
  const autoLearnerResolved = learnerModelRequired ? resolveModel(args['auto-learner-model']) : null;
  const autoLearnerProviderConfig = autoLearnerResolved ? getProviderConfig(autoLearnerResolved.provider) : null;
  const classifierEnabled = !args['no-classifier'];
  const tutorLearnerDagEnabled = Boolean(args['tutor-learner-dag'] && worldBundle);
  const humanDiscourseConfig = buildHumanDiscourseRunConfig({
    dagMode,
    dagEnabled: args.dag,
    tutorLearnerDagEnabled,
  });
  const humanDiscoursePreviewFrame = buildHumanDiscourseFrame({
    state: {
      world: worldBundle?.world || null,
      dag: args.dag,
      dagMode,
      humanDiscourse: humanDiscourseConfig,
      turns: [],
    },
    tutorTurn: 1,
    tutorLearnerDag: null,
    classification: null,
    learnerText: '',
  });
  const combinedLearnerAnalysisEnabled = Boolean(classifierEnabled && tutorLearnerDagEnabled);
  const registerPolicyStack = parseTutorStubRegisterPolicyStack(args['register-policy']);
  const registerPolicy = registerPolicyStack.primary;
  const registerPolicyOverlays = registerPolicyStack.overlays;
  const registerOverlayThreshold = normalizeTutorStubRegisterOverlayThreshold(args['register-overlay-threshold'], {
    label: '--register-overlay-threshold',
  });
  const experimentConfig = {
    schema: 'machinespirits.tutor-stub.experiment-identity.v1',
    runSeed: experimentRunSeed,
    profile: automatedLearnerProfileId(args['auto-learner-profile']) || 'custom',
    policy: registerPolicy,
    repeat: experimentRepeat,
    jobId: String(args['eval-job-id'] || '').trim() || null,
    dagFactDropoutSeed,
    independentSeeds: true,
  };
  const registerEmpiricalPrior = loadRegisterEmpiricalPrior(args['register-empirical-prior'], {
    policy: registerPolicy,
  });
  const registerPaletteMode =
    registerPolicy === 'negative' ? 'negative' : args['safe-registers'] ? 'safe' : args['register-palette'];
  const registerPalette = buildRegisterPalette(registerPaletteMode);
  const randomRegisterSelectionEnabled = registerPolicy === 'random';
  const negativeRegisterSelectionEnabled = registerPolicy === 'negative';
  const fieldRegisterSelectionEnabled = registerPolicy === 'field';
  const trajectoryRegisterSelectionEnabled = registerPolicy === 'trajectory';
  const dynamicalSystemRegisterSelectionEnabled = registerPolicy === 'dynamical_system';
  const empiricalDynamicalSystemRegisterSelectionEnabled = registerPolicy === 'empirical_dynamical_system';
  const continuousDynamicalSystemRegisterSelectionEnabled = registerPolicy === 'continuous_dynamical_system';
  const continuousEmpiricalDynamicalSystemRegisterSelectionEnabled =
    registerPolicy === 'continuous_empirical_dynamical_system';
  const continuousRegisterSelectionEnabled = Boolean(
    continuousDynamicalSystemRegisterSelectionEnabled || continuousEmpiricalDynamicalSystemRegisterSelectionEnabled,
  );
  const continuousUnsafeRegisterAnchorsEnabled = Boolean(
    continuousRegisterSelectionEnabled &&
    !args['safe-registers'] &&
    /(^|,)(all|simulated|negative|negative-floor|ironic|sarcastic|face_threat)(,|$)/iu.test(
      String(args['register-palette'] || ''),
    ),
  );
  const stateRegisterSelectionEnabled = registerPolicy === 'state';
  const registerSelectionEnabled = Boolean(
    !args['no-register-selection'] &&
    registerPalette.length &&
    (combinedLearnerAnalysisEnabled ||
      randomRegisterSelectionEnabled ||
      negativeRegisterSelectionEnabled ||
      lightAdaptationEnabled),
  );
  const requestedTutorCharacter = resolveTutorStubCharacterChoice(args['tutor-character']);
  const initialTutorCharacter =
    requestedTutorCharacter.raw && !requestedTutorCharacter.clearing ? requestedTutorCharacter.id : null;
  if (initialTutorCharacter && !requestedTutorCharacter.options.includes(initialTutorCharacter)) {
    throw new Error(`--tutor-character must be one of ${requestedTutorCharacter.options.join(', ')}, or auto`);
  }
  if (initialTutorCharacter && !registerSelectionEnabled) {
    throw new Error(
      '--tutor-character requires adaptive delivery; remove --no-register-selection and enable learner analysis',
    );
  }
  const classifierResolved =
    classifierEnabled && !combinedLearnerAnalysisEnabled ? resolveModel(args['classifier-model']) : null;
  const classifierProviderConfig = classifierResolved ? getProviderConfig(classifierResolved.provider) : null;
  const learnerRecordResolved = tutorLearnerDagEnabled ? resolveModel(args['learner-record-model']) : null;
  const learnerRecordProviderConfig = learnerRecordResolved ? getProviderConfig(learnerRecordResolved.provider) : null;
  const firstMessage = args.once || positionals.join(' ').trim() || '';
  if (
    rawCommandLineOptionProvided('training-reuse') &&
    rawCommandLineOptionProvided('no-training-reuse') &&
    args['no-training-reuse']
  ) {
    throw new Error('--training-reuse cannot be combined with --no-training-reuse');
  }
  const requestedTrainingReuse = args['no-training-reuse']
    ? 'off'
    : normalizeTutorStubTrainingReuseSetting(args['training-reuse'], { label: '--training-reuse' });
  const humanSubjectClass = normalizeTutorStubHumanSubjectClass(args['human-subject-class'], {
    label: '--human-subject-class',
  });
  const trainingReuseConfig = resolveTutorStubTrainingReuse({
    requested: requestedTrainingReuse,
    source: resolvedTrainingReuseSource(rememberedSettings),
    humanSubjectClass,
    humanSubjectClassSource: resolvedHumanSubjectClassSource(),
    humanInputExpected: Boolean(interactiveSessionIntent || firstMessage),
  });
  args['training-reuse'] = trainingReuseConfig.requested;
  args['human-subject-class'] = trainingReuseConfig.declaredHumanSubjectClass;
  const visibleModel = visibleResolvedModel(resolved, providerConfig);
  const visibleAutoLearnerModel = autoLearnerResolved
    ? visibleResolvedModel(autoLearnerResolved, autoLearnerProviderConfig)
    : null;
  const visibleClassifierModel = classifierResolved
    ? visibleResolvedModel(classifierResolved, classifierProviderConfig)
    : null;
  const visibleLearnerRecordModel = learnerRecordResolved
    ? visibleResolvedModel(learnerRecordResolved, learnerRecordProviderConfig)
    : null;
  const visibleClassifierConfig = classifierEnabled
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
    : { enabled: false };
  const effectiveTemperature = effectiveTemperatureForModel(resolved, temperature);
  const traceEnabled = !args['no-trace'];
  const traceDir = resolveWorkspacePath(args['trace-dir']);
  const streamEnabled = Boolean(STUB.stream && !args['no-stream']);
  const interimAnimationEnabled = Boolean(STUB.interimAnimation && !args['no-interim-animation']);
  const fieldVisualizationEnabled = Boolean(args['field-viz']);
  const openingEnabled = Boolean(STUB.opening && !args['no-opening']);
  const openingFramePreview = buildTutorStubOpeningFrame({
    world: worldBundle?.world || null,
    openingEvidence: worldBundle
      ? worldBundle.world.releaseSchedule
          .filter((entry) => Number(entry.turn) === 1)
          .map((entry) => ({
            premise: entry.premise,
            via: entry.via,
            surface: worldBundle.world.premiseById.get(entry.premise)?.surface || '',
          }))
      : [],
  });
  const closeoutReportEnabled = Boolean(STUB.closeoutReport && !args['no-closeout-report']);
  const dialogueClosureConfig = createTutorStubDialogueClosureLifecycle({
    enabled: Boolean(
      args.dag && worldBundle && (!autoLearnerEnabled || (tutorLearnerDagEnabled && autoStopOnGrounded)),
    ),
    allowCheckIn: Boolean(!autoLearnerEnabled && !firstMessage),
    allowAuthoredDagClosure: Boolean(!autoLearnerEnabled),
  });
  const cliEffort = normalizeCliEffort(args['cli-effort']);
  const learnerAnalysisPromptProfile = normalizeTutorStubPublicLearnerAnalysisPromptProfile(
    args['learner-analysis-prompt-profile'],
  );
  const learnerAnalysisEvidenceUseRubric = normalizeTutorStubEvidenceUseRubric(
    args['learner-analysis-evidence-use-rubric'],
  );
  const mixedTutorPrefetchPolicy = String(args['mixed-tutor-prefetch-policy'] || 'always')
    .trim()
    .toLowerCase();
  if (!['always', 'analysis_only'].includes(mixedTutorPrefetchPolicy)) {
    throw new Error('--mixed-tutor-prefetch-policy must be always or analysis_only');
  }
  const tutorStreamState = !streamEnabled
    ? 'off'
    : providerSupportsEventStreaming(resolved)
      ? 'cli_events'
      : !providerSupportsStreaming(resolved)
        ? 'unavailable_cli_buffered'
        : args.dag && worldBundle
          ? 'guarded_after_audit'
          : interactiveSessionEnabled
            ? 'buffered_for_concurrent_input'
            : 'live';
  const resumeCandidate = resolvedResumeSource;
  const rememberedDialogueSettingsAvailable = rememberedSettings.status === 'loaded';
  const initialProfilePromptEnabled = Boolean(
    mixedLearnerEnabled &&
    !explicitRememberedSources.learnerProfile &&
    !rememberedSettings.appliedFields.includes('learner_profile'),
  );
  const initialTemperaturePromptEnabled = Boolean(
    registerSelectionEnabled &&
    registerTemperatureApplies(registerPolicy) &&
    !rememberedDialogueSettingsAvailable &&
    !explicitRememberedSources.engagementStanceTemperature,
  );
  const initialDropoutPromptEnabled = Boolean(
    tutorLearnerDagEnabled && !rememberedDialogueSettingsAvailable && !explicitRememberedSources.dagFactDropoutRate,
  );
  const initialReleaseSpeedPromptEnabled = Boolean(
    worldBundle && !rememberedDialogueSettingsAvailable && !explicitRememberedSources.releaseSpeed,
  );
  const initialMixedLearnerSetupEnabled = Boolean(
    mixedLearnerEnabled &&
    openingEnabled &&
    !firstMessage &&
    !resumeCandidate &&
    (initialProfilePromptEnabled ||
      initialTemperaturePromptEnabled ||
      initialDropoutPromptEnabled ||
      initialReleaseSpeedPromptEnabled),
  );
  const instantExistingScenarioOpening = Boolean(
    interactiveSessionEnabled &&
    openingEnabled &&
    !firstMessage &&
    !resumeRequested &&
    rememberedScenarioAvailable &&
    rememberedDialogueSettingsAvailable &&
    !initialMixedLearnerSetupEnabled,
  );
  const startupOpeningRealizer =
    openingFramePreview.realization === 'authored_world_opening'
      ? 'authored_world_opening'
      : instantExistingScenarioOpening
        ? 'deterministic'
        : openingRealizer;
  const openingConfig = {
    enabled: openingEnabled,
    printedByDefault: Boolean(openingEnabled && !firstMessage),
    schema: openingFramePreview.schema,
    realization:
      startupOpeningRealizer === 'authored_world_opening'
        ? startupOpeningRealizer
        : startupOpeningRealizer === 'model'
          ? 'speaking_tutor_model'
          : instantExistingScenarioOpening
            ? 'remembered_scenario_instant_opening'
            : 'world_grounded_deterministic',
    speakingModelRef: startupOpeningRealizer === 'model' ? args.model : null,
    authoredTextAvailable: Boolean(openingFramePreview.authoredText),
    requirements: TUTOR_STUB_OPENING_REQUIREMENTS,
    safetyAudit: true,
    fallback: 'world_grounded_safe_fallback',
    startup: {
      mode: instantExistingScenarioOpening ? 'instant_existing_scenario' : 'normal',
      restoredScenario: rememberedScenarioAvailable,
      blocksOnOpeningModel: startupOpeningRealizer === 'model',
      blocksOnMixedPrefetch: Boolean(mixedLearnerEnabled && !instantExistingScenarioOpening),
    },
  };
  const initialScenarioPickerConfig = {
    enabled: initialScenarioPickerEnabled,
    defaultScenarioId: launchWorldBundle?.world?.id || null,
    selectedScenarioId: worldBundle?.world?.id || null,
    keyboardMenu: true,
    activeInThisTerminal: initialScenarioKeyboardMenuActive,
    navigation: ['up', 'down', 'pageup', 'pagedown', 'home', 'end', 'enter'],
    descriptionFields: ['question', 'setting', 'discipline'],
    nonTtyFallback: '--world',
    selection: initialScenarioSelection,
    reason: initialScenarioPickerEnabled
      ? 'no_saved_or_explicit_scenario'
      : existingScenarioAvailable
        ? 'existing_scenario_restored_or_explicit'
        : resumeRequested
          ? 'resume_requested'
          : 'not_interactive_opening',
  };
  const mixedLearnerStartupPrompts = {
    enabled: initialMixedLearnerSetupEnabled,
    order: [
      ...(initialProfilePromptEnabled ? ['learner_profile'] : []),
      ...(initialTemperaturePromptEnabled ? ['engagement_stance_temperature'] : []),
      ...(initialDropoutPromptEnabled ? ['dag_fact_dropout'] : []),
      ...(initialReleaseSpeedPromptEnabled ? ['clue_release_speed'] : []),
    ],
    tutorModel: {
      enabled: false,
      firstRunSelection: false,
      default: args.model,
      recommended: STUB.model,
      liveCommand: '/settings model <provider.alias>',
    },
    engagementStanceTemperature: {
      enabled: initialTemperaturePromptEnabled,
      default: registerTemperature,
      recommended: DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
      range: [MIN_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE, MAX_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE],
    },
    dagFactDropout: {
      enabled: initialDropoutPromptEnabled,
      default: dagFactDropoutRate,
      recommended: DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
      range: [0, 1],
      seed: dagFactDropoutSeed,
    },
    clueReleaseSpeed: {
      enabled: initialReleaseSpeedPromptEnabled,
      default: releaseSpeed,
      recommended: DEFAULT_TUTOR_STUB_RELEASE_SPEED,
      range: [MIN_TUTOR_STUB_RELEASE_SPEED, MAX_TUTOR_STUB_RELEASE_SPEED],
      adaptive: true,
    },
  };
  const interactiveRoleModes = {
    enabled: Boolean(interactiveSessionEnabled && !passthroughEnabled),
    default: 'learner',
    modes: ['learner', 'coach', 'auto'],
    commands: {
      learner: ['/mode learner'],
      coach: ['/mode coach [guidance]', '/coach [guidance]'],
      auto: ['/mode auto [turns]', '/auto [turns]'],
      demo: ['/demo [turns]'],
      status: '/status',
    },
    coach: {
      private: true,
      appliesTo: 'next_tutor_turn',
      publicTranscriptChanged: false,
      evidenceAndSafetyGuardsRemainActive: true,
    },
    auto: {
      modelRef: args['auto-learner-model'],
      resolved: visibleAutoLearnerModel,
      profileId: automatedLearnerProfileId(args['auto-learner-profile']),
      defaultTurns: autoTurns ?? 'until-grounded',
      safetyTurns: autoSafetyTurns,
      stopOnGrounded: autoStopOnGrounded,
    },
    demo: {
      launchRequested: Boolean(args.demo),
      command: '/demo [turns]',
      defaultTurns: DEFAULT_INTERACTIVE_DEMO_TURNS,
      maxTurns: MAX_INTERACTIVE_DEMO_TURNS,
      sequence: ['bounded_live_dialogue', 'plain_analysis', 'transcript_html', 'compact_outcome_report'],
      returnsControl: true,
    },
    concurrentCommandSurface: {
      enabled: interactiveSessionEnabled,
      activityLine: 'above_prompt',
      inputLine: 'persistent_bottom_line',
      acceptsCommandsDuringTutorTurn: true,
      acceptsCommandsDuringAutoMode: true,
      streamingDisplay: 'buffered_while_command_line_is_live',
    },
    compoundLearnerTurns: {
      schema: 'machinespirits.tutor-stub.compound-learner-turn.v1',
      enabled: interactiveSessionEnabled,
      boundary: 'until_tutor_response_is_displayed',
      additionalMessages: 'abort_or_invalidate_then_regenerate',
      tracePreservesTypedMessages: true,
      analysisAndTutorView: 'one_compound_learner_turn',
    },
    learnerResponseProvenance: {
      schema: TUTOR_STUB_LEARNER_RESPONSE_PROVENANCE_SCHEMA,
      categories: ['human', 'ai', 'hybrid', 'unknown'],
      recordedOn: ['learner_message_fragment', 'completed_turn', 'trace_event', 'html_transcript', 'learning_summary'],
      humanSources: ['terminal', 'voice_transcription', 'command_line_argument'],
      aiSources: ['automated_learner', 'mixed_suggestion_accepted'],
      hybridSource: 'mixed_suggestion_edited',
      compoundAggregation: true,
    },
  };
  const turnFeedbackConfig = {
    schema: 'machinespirits.tutor-stub.turn-feedback-config.v1',
    enabled: turnFeedbackEnabled,
    defaultOn: true,
    optional: true,
    scope: 'human_learner_mode',
    ratings: ['up', 'down'],
    commands: ['/up [reason]', '/down [reason] [comment]', '/feedback up|down|clear|on|off'],
    reasons: Object.keys(TUTOR_STUB_FEEDBACK_REASONS),
    keyboardShortcuts: {
      scope: 'empty_input_line_with_pending_rating',
      immediate: true,
      leftArrow: 'down',
      rightArrow: 'up',
      escape: 'disable_for_session',
    },
    learnerMessageField: 'tutorFeedback',
    automatedLearner: 'disabled',
    tutorSelfAssessment: true,
    liveAdaptation: {
      horizon: 'next_tutor_response_only',
      private: true,
      observableChangeAudited: true,
      safetyPrecedence: true,
    },
    learningRecord: {
      schema: 'machinespirits.tutor-stub.feedback-observation.v1',
      joinsRatedResponseToLearnerReplyAndNextTutorOutcome: true,
      separatesSubjectiveHelpfulnessFromObjectiveProgress: true,
      causalClaim: false,
    },
  };
  const responseDetailsConfig = {
    schema: 'machinespirits.tutor-stub.response-details.v1',
    enabled: responseDetailsEnabled,
    defaultOn: true,
    scope: 'terminal_session',
    order: 'before_tutor_speech',
    timingSchema: 'machinespirits.tutor-stub.turn-timing.v1',
    timingScope: 'foreground_wait_from_accepted_learner_input',
    command: '/details on|off|status',
    launchFlag: '--no-response-details',
    environment: 'TUTOR_STUB_RESPONSE_DETAILS=0',
    publicTranscriptChanged: false,
  };
  const explanatoryDebugConfig = {
    enabledByDefault: false,
    defaultFormat: 'prose',
    command: '/debug on [prose|technical]|off|show [prose|technical]|technical',
    prose: {
      generatedBy: 'llm',
      targetWords: '45-80',
      maxSentences: 3,
    },
    technicalSections: ['learner_analysis', 'field_calculations', 'register_consequence'],
    automaticAfterCompletedTurn: true,
  };
  const learningSummaryReportConfig = {
    enabled: Boolean(!passthroughEnabled && (autoLearnerEnabled || firstMessage || interactiveSessionEnabled)),
    automaticOnConversationEnd: true,
    requiresCompletedTurn: true,
    format: 'html',
    publicEvidenceOnly: true,
    launchInInteractiveTty: process.env.TUTOR_STUB_SUMMARY_OPEN !== '0',
  };
  const rememberedSettingsConfig = {
    enabled: rememberedSettings.enabled,
    writeEnabled: Boolean(rememberedSettings.writeEnabled && !passthroughEnabled),
    file: path.relative(ROOT, rememberedSettings.filePath),
    status: rememberedSettings.status,
    loadedAt: rememberedSettings.loadedAt,
    appliedFields: [...rememberedSettings.appliedFields],
    skippedExplicitFields: [...rememberedSettings.skippedExplicitFields],
    warning: rememberedSettings.warning,
    scope: 'human_interactive_sessions_only',
    precedence: 'explicit_cli_or_environment_then_remembered_then_repository_default',
  };
  const learnerDagPreflightConfig = {
    schema: TUTOR_STUB_LEARNER_DAG_PREFLIGHT_SCHEMA,
    enabled: tutorLearnerDagEnabled,
    timing: 'before_first_learner_analysis_model_call',
    inputs: ['prior_public_learner_record', 'committed_public_evidence', 'public_rules'],
    output: ['eligible_public_premise_ids', 'possible_next_derivations'],
    semanticMapping: 'analysis_model_maps_free_text_to_candidate_updates',
    commitAuthority: 'deterministic_postprocessor_after_model',
  };
  const passthroughConfig = {
    schema: 'machinespirits.tutor-stub.passthrough.v1',
    enabled: passthroughEnabled,
    modelCallsPerTurn: passthroughEnabled ? 1 : null,
    requestSurface: passthroughEnabled ? ['system_setup', 'full_public_history', 'latest_learner_message'] : null,
    observedAudits: observedAuditsEnabled,
    bypassed: passthroughEnabled
      ? [
          'learner_classifier',
          'learner_dag',
          'register_selection',
          'human_discourse_scaffold',
          'response_composition',
          'response_checks_and_repair',
          'release_planner',
          'dialogue_closure',
          'mixed_prefetch',
          'tutor_feedback',
          'learning_summary',
        ]
      : [],
  };
  const capabilitySnapshot = resolveTutorStubCapabilities({
    passthrough: passthroughEnabled,
    interactive: interactiveSessionEnabled,
    world: Boolean(worldBundle),
    curriculum: Boolean(curriculumBundle),
    dag: Boolean(args.dag && worldBundle),
    learnerDag: tutorLearnerDagEnabled,
    classifier: classifierEnabled,
    registerSelection: registerSelectionEnabled,
    mixedLearner: mixedLearnerEnabled,
    autoLearner: autoLearnerEnabled,
    demo: Boolean(args.demo),
    turnFeedback: turnFeedbackEnabled,
    tuning: tuningMode !== 'off',
    voice: voiceLaunchRequested,
    trace: traceEnabled,
    fieldVisualization: fieldVisualizationEnabled,
    learningSummary: learningSummaryReportConfig.enabled,
    responseChecks: !passthroughEnabled,
  });
  assertTutorStubCapabilityCompatibility(capabilitySnapshot);
  const selectedLabMetadata = selectedLabResolution
    ? {
        ...tutorStubLabTraceMetadata(selectedLabResolution),
        resolvedCapabilities: [...capabilitySnapshot.active],
        admission: selectedLabAdmission,
      }
    : null;
  const sessionRecipe = buildTutorStubSessionRecipe({
    args,
    lab: selectedLabResolution?.lab?.id || null,
    identity: {
      schema: TUTOR_STUB_SESSION_RUNTIME_SCHEMA,
      world: worldBundle?.world?.id ? { id: worldBundle.world.id } : curriculumBundle ? { id: null } : null,
      prompt: {
        systemPromptHash: hashCanonicalJson({ systemPrompt }),
        tutorRolePromptHash: tutorInstance.rolePromptHash,
      },
      tutor: {
        ref: tuning.activeRef,
        rolePromptHash: tutorInstance.rolePromptHash,
      },
      models: {
        tutor: tutorStubRecipeModelIdentity(args.model, visibleModel),
        classifier: tutorStubRecipeModelIdentity(args['classifier-model'], visibleClassifierModel),
        reasoning: tutorStubRecipeModelIdentity(args['learner-record-model'], visibleLearnerRecordModel),
        learner: tutorStubRecipeModelIdentity(args['auto-learner-model'], visibleAutoLearnerModel),
      },
    },
  });
  const recipeDrift = loadedSessionRecipe
    ? compareTutorStubResumeRecipe(loadedSessionRecipe, sessionRecipe, {
        extraDrift: (loadedRecipeApplication?.explicitOverrides || []).map((entry) => ({
          ...entry,
          axis: `option.${entry.axis}`,
        })),
      })
    : null;
  if (recipeDrift) {
    assertTutorStubResumeCompatibility(recipeDrift, {
      acknowledgeDrift: args['acknowledge-drift'],
      context: 'recipe',
    });
  }
  const resumeDrift = resumeCandidate
    ? compareTutorStubResumeRecipe(resumeCandidate.recipe, sessionRecipe, {
        extraDrift: (resumeRecipeApplication?.explicitOverrides || []).map((entry) => ({
          ...entry,
          axis: `option.${entry.axis}`,
        })),
      })
    : null;
  if (resumeDrift) {
    assertTutorStubResumeCompatibility(resumeDrift, { acknowledgeDrift: args['acknowledge-drift'] });
  }

  return {
    autoLearnerProviderConfig,
    autoLearnerResolved,
    capabilitySnapshot,
    classifierEnabled,
    classifierProviderConfig,
    classifierResolved,
    cliEffort,
    closeoutReportEnabled,
    combinedLearnerAnalysisEnabled,
    continuousDynamicalSystemRegisterSelectionEnabled,
    continuousEmpiricalDynamicalSystemRegisterSelectionEnabled,
    continuousRegisterSelectionEnabled,
    continuousUnsafeRegisterAnchorsEnabled,
    dialogueClosureConfig,
    dynamicalSystemRegisterSelectionEnabled,
    effectiveTemperature,
    empiricalDynamicalSystemRegisterSelectionEnabled,
    experimentConfig,
    explanatoryDebugConfig,
    fieldRegisterSelectionEnabled,
    fieldVisualizationEnabled,
    firstMessage,
    humanDiscourseConfig,
    humanDiscoursePreviewFrame,
    initialDropoutPromptEnabled,
    initialMixedLearnerSetupEnabled,
    initialProfilePromptEnabled,
    initialReleaseSpeedPromptEnabled,
    initialScenarioPickerConfig,
    initialTemperaturePromptEnabled,
    initialTutorCharacter,
    instantExistingScenarioOpening,
    interactiveRoleModes,
    interimAnimationEnabled,
    learnerAnalysisEvidenceUseRubric,
    learnerAnalysisPromptProfile,
    learnerDagPreflightConfig,
    learnerRecordProviderConfig,
    learnerRecordResolved,
    learningSummaryReportConfig,
    mixedLearnerStartupPrompts,
    mixedTutorPrefetchPolicy,
    negativeRegisterSelectionEnabled,
    openingConfig,
    openingEnabled,
    passthroughConfig,
    promptArchitecture,
    providerConfig,
    randomRegisterSelectionEnabled,
    recipeDrift,
    registerEmpiricalPrior,
    registerOverlayThreshold,
    registerPalette,
    registerPolicy,
    registerPolicyOverlays,
    registerPolicyStack,
    registerSelectionEnabled,
    rememberedSettingsConfig,
    resolved,
    responseDetailsConfig,
    resumeCandidate,
    resumeDrift,
    selectedLabMetadata,
    sessionRecipe,
    stateRegisterSelectionEnabled,
    streamEnabled,
    systemPrompt,
    traceDir,
    traceEnabled,
    trainingReuseConfig,
    trajectoryRegisterSelectionEnabled,
    tuning,
    turnFeedbackConfig,
    tutorDag,
    tutorLearnerDagEnabled,
    tutorStreamState,
    visibleAutoLearnerModel,
    visibleClassifierConfig,
    visibleClassifierModel,
    visibleLearnerRecordModel,
    visibleModel,
  };
}
