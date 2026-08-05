/**
 * Resolve the launch-time application context shared by every tutor-stub host.
 *
 * This boundary owns CLI compatibility checks and immutable run settings. It
 * may normalize the supplied args object, matching the historical entrypoint.
 */
export async function createTutorStubLaunchApplicationContext({
  C,
  DEFAULT_INTERACTIVE_COMMITTEE_FALLBACK_POLICY,
  MAX_TUTOR_STUB_RELEASE_SPEED,
  MIN_TUTOR_STUB_RELEASE_SPEED,
  ROOT,
  SCAFFOLD_LIFECYCLE_SCHEMA,
  STUB,
  TUTOR_STUB_DAG_FACT_DROPOUT_SCHEMA,
  TUTOR_TYPED_ACTION_CONFIG_SCHEMA,
  applyRememberedInteractiveDefaults,
  args,
  assertSupportedModelRefs,
  buildDirectorInitialContext,
  commaSeparatedStrings,
  commandLineOptionProvided,
  configureCliPresentation,
  createTutorStubCurriculumRuntime,
  input,
  normalizeDagMode,
  normalizeTutorStubCliMotion,
  normalizeTutorStubCliThemeId,
  normalizeTutorStubDagFactDropoutRate,
  normalizeTutorStubDagFactDropoutSeed,
  normalizeTutorStubEngagementStanceTemperature,
  normalizeTutorStubLightAdaptationThreshold,
  normalizeTutorStubLoopMode,
  normalizeTutorStubPointOfActionArm,
  normalizeTutorStubPointOfActionOpportunityProtocol,
  normalizeTutorStubReleaseSpeed,
  normalizeTutorStubTuningMode,
  normalizeTutorStubVoiceModel,
  normalizeTutorStubVoiceName,
  output,
  parseAutoTurns,
  parseNumber,
  parseOptionalBoundedInt,
  parsePositiveInt,
  pickInitialScenarioWithKeyboard,
  positionals,
  rememberedSettingExplicitSources,
  resolveAutomatedLearnerProfile,
  resolveTutorStubTutorInstance,
  resolveWorldRef,
  resumeRequested,
  tutorStubCurriculumBundle,
}) {
  const explicitPointOfActionArm =
    commandLineOptionProvided('point-of-action-arm') || Boolean(process.env.TUTOR_STUB_POINT_OF_ACTION_ARM);
  if (args.committee && args['no-committee']) {
    throw new Error('--committee and --no-committee cannot be used together');
  }
  if (
    args.committee &&
    explicitPointOfActionArm &&
    normalizeTutorStubPointOfActionArm(args['point-of-action-arm']) !== 'committee'
  ) {
    throw new Error('--committee conflicts with the explicit --point-of-action-arm value');
  }
  if (args['no-committee'] && explicitPointOfActionArm) {
    throw new Error('--no-committee conflicts with --point-of-action-arm');
  }
  if (args.committee) args['point-of-action-arm'] = 'committee';
  if (args['no-committee']) args['point-of-action-arm'] = '';

  const passthroughEnabled = Boolean(args.passthrough);
  const observedAuditsEnabled = Boolean(args['observe-audits']);
  if (observedAuditsEnabled && !passthroughEnabled) {
    throw new Error(
      '--observe-audits requires --passthrough: a guarded run already records these audits as enforced guard results',
    );
  }
  if (passthroughEnabled) {
    args.dag = false;
    args['tutor-learner-dag'] = false;
    args['no-classifier'] = true;
    args['no-register-selection'] = true;
    args['typed-actions'] = false;
    args['point-of-action-arm'] = '';
    if (!commandLineOptionProvided('auto-learner')) args['auto-learner'] = false;
    args['mixed-learner'] = false;
    args['mixed-mode'] = false;
    args['no-memory-summary'] = true;
    args['multiple-choice'] = false;
    args['no-opening'] = true;
    args['no-closeout-report'] = true;
    args['no-turn-feedback'] = true;
    args['no-interim-animation'] = true;
    args['field-viz'] = false;
    args.tuning = 'off';
  }

  let tutorInstance = resolveTutorStubTutorInstance(args.tutor);
  let tuningMode = normalizeTutorStubTuningMode(args.tuning);
  if (!commandLineOptionProvided('model') && !process.env.TUTOR_STUB_MODEL && tutorInstance.modelDefaults.tutor) {
    args.model = tutorInstance.modelDefaults.tutor;
  }
  if (
    !commandLineOptionProvided('classifier-model') &&
    !process.env.TUTOR_STUB_CLASSIFIER_MODEL &&
    tutorInstance.modelDefaults.interpretation
  ) {
    args['classifier-model'] = tutorInstance.modelDefaults.interpretation;
  }
  if (
    !commandLineOptionProvided('learner-record-model') &&
    !process.env.TUTOR_STUB_LEARNER_RECORD_MODEL &&
    tutorInstance.modelDefaults.interpretation
  ) {
    args['learner-record-model'] = tutorInstance.modelDefaults.interpretation;
  }
  if (
    !commandLineOptionProvided('auto-learner-model') &&
    !process.env.TUTOR_STUB_AUTO_LEARNER_MODEL &&
    tutorInstance.modelDefaults.learner
  ) {
    args['auto-learner-model'] = tutorInstance.modelDefaults.learner;
  }

  let allModelsOverrideRef = String(args['all-models'] || '').trim() || null;
  if (allModelsOverrideRef) {
    args.model = allModelsOverrideRef;
    args['classifier-model'] = allModelsOverrideRef;
    args['learner-record-model'] = allModelsOverrideRef;
    args['auto-learner-model'] = allModelsOverrideRef;
  }
  if (commandLineOptionProvided('learner-character')) {
    if (
      commandLineOptionProvided('auto-learner-profile') &&
      String(args['auto-learner-profile']).trim() !== String(args['learner-character']).trim()
    ) {
      throw new Error('--learner-character conflicts with --auto-learner-profile');
    }
    args['auto-learner-profile'] = args['learner-character'];
  }
  const interactiveSessionIntent = Boolean(!args['auto-learner'] && !args.once && !positionals.join(' ').trim());
  const explicitRememberedSources = rememberedSettingExplicitSources();
  const rememberedSettings = applyRememberedInteractiveDefaults({
    interactiveSessionEnabled: interactiveSessionIntent,
  });
  if (
    interactiveSessionIntent &&
    !passthroughEnabled &&
    !explicitRememberedSources.committeeEnabled &&
    !rememberedSettings.appliedFields.includes('committee_mode')
  ) {
    args['point-of-action-arm'] = 'committee';
  }
  const committeeFallbackPolicyExplicit =
    commandLineOptionProvided('committee-fallback-policy') || Boolean(process.env.TUTOR_STUB_COMMITTEE_FALLBACK_POLICY);
  if ((args.committee || (interactiveSessionIntent && !passthroughEnabled)) && !committeeFallbackPolicyExplicit) {
    args['committee-fallback-policy'] = DEFAULT_INTERACTIVE_COMMITTEE_FALLBACK_POLICY;
  }
  args['committee-fallback-policy'] = String(args['committee-fallback-policy'] || '')
    .trim()
    .toLowerCase();
  if (!['v1', 'v2', 'cue_blind'].includes(args['committee-fallback-policy'])) {
    throw new Error('--committee-fallback-policy must be v1, v2, or cue_blind');
  }
  args['committee-span-interface'] = String(args['committee-span-interface'] || '')
    .trim()
    .toLowerCase();
  if (!['v1', 'v2'].includes(args['committee-span-interface'])) {
    throw new Error('--committee-span-interface must be v1 or v2');
  }
  const pointOfActionOpportunityProtocol = normalizeTutorStubPointOfActionOpportunityProtocol(
    args['point-of-action-opportunity-protocol'],
  );
  args['point-of-action-opportunity-protocol'] = pointOfActionOpportunityProtocol || '';
  if (
    pointOfActionOpportunityProtocol &&
    normalizeTutorStubPointOfActionArm(args['point-of-action-arm']) !== 'committee'
  ) {
    throw new Error('--point-of-action-opportunity-protocol requires --point-of-action-arm committee');
  }
  if (args.module && !args.curriculum) {
    throw new Error('--module requires --curriculum <workplan|path>');
  }
  let curriculumBundle = null;
  let curriculumRuntime = null;
  if (args.curriculum) {
    if (args.system) throw new Error('--curriculum cannot be combined with --system because --system replaces it');
    if (args.dag || args['tutor-learner-dag']) {
      throw new Error(
        'A canonical curriculum module is not a proof DAG. Remove --dag/--tutor-learner-dag, or hand-author and validate a dramatic-derivation world for this module.',
      );
    }
    if (commandLineOptionProvided('world') && !['none', 'off', 'false'].includes(String(args.world).toLowerCase())) {
      throw new Error(
        '--curriculum cannot be combined with an active --world; use the curriculum module or a separately authored world',
      );
    }
    curriculumBundle = tutorStubCurriculumBundle(args.curriculum, args.module, { root: ROOT });
    curriculumRuntime = createTutorStubCurriculumRuntime(curriculumBundle, { moduleId: curriculumBundle.module.id });
    args.world = 'none';
  }
  args.theme = normalizeTutorStubCliThemeId(args.theme, { strict: true });
  args.motion = normalizeTutorStubCliMotion(args.motion, { strict: true });
  configureCliPresentation({
    theme: args.theme,
    motion: args.motion,
    noColor: args['no-color'],
  });
  tutorInstance = resolveTutorStubTutorInstance(args.tutor);
  tuningMode = normalizeTutorStubTuningMode(args.tuning);
  if (!allModelsOverrideRef && rememberedSettings.restoredAllModelsOverrideRef) {
    allModelsOverrideRef = rememberedSettings.restoredAllModelsOverrideRef;
  }
  const allModelsOverride = allModelsOverrideRef
    ? {
        schema: 'machinespirits.tutor-stub.all-models-override.v1',
        modelRef: allModelsOverrideRef,
        source:
          rememberedSettings.restoredAllModelsOverrideRef === allModelsOverrideRef
            ? 'remembered_settings'
            : commandLineOptionProvided('all-models')
              ? 'cli'
              : 'environment',
        precedence: 'overrides_all_role_specific_model_settings',
        roles: ['tutor', 'classifier', 'learner_dag_analysis', 'automated_or_mixed_learner'],
      }
    : null;
  args['auto-learner-profile'] = resolveAutomatedLearnerProfile(args['auto-learner-profile']);

  const temperature = parseNumber(args.temperature, '--temperature', { min: 0, max: 2 });
  const voiceModel = normalizeTutorStubVoiceModel(args['voice-model']);
  const voiceName = normalizeTutorStubVoiceName(args['voice-name']);
  const voiceLaunchRequested = Boolean(args.voice);
  const registerTemperature = normalizeTutorStubEngagementStanceTemperature(args['register-temperature'], {
    label: '--register-temperature',
  });
  const lightAdaptationCliOptIn = commandLineOptionProvided('light-adaptation') && Boolean(args['light-adaptation']);
  const lightAdaptationCliOptOut =
    commandLineOptionProvided('no-light-adaptation') && Boolean(args['no-light-adaptation']);
  if (lightAdaptationCliOptIn && lightAdaptationCliOptOut) {
    throw new Error('--light-adaptation cannot be combined with --no-light-adaptation');
  }
  const lightAdaptationRemembered = rememberedSettings.appliedFields.includes('light_adaptation');
  const lightAdaptationRequested = lightAdaptationCliOptOut
    ? false
    : lightAdaptationCliOptIn
      ? true
      : lightAdaptationRemembered
        ? Boolean(args['light-adaptation'])
        : process.env.TUTOR_STUB_LIGHT_ADAPTATION !== undefined
          ? STUB.lightAdaptation
          : interactiveSessionIntent && !passthroughEnabled;
  const lightAdaptationAvailable = Boolean(!passthroughEnabled && !args['no-register-selection']);
  const lightAdaptationEnabled = Boolean(lightAdaptationRequested && lightAdaptationAvailable);
  args['light-adaptation'] = lightAdaptationEnabled;
  args['no-light-adaptation'] = !lightAdaptationEnabled;
  const lightAdaptationThreshold = normalizeTutorStubLightAdaptationThreshold(args['light-adaptation-threshold']);
  const lightAdaptationExplicitOptIn = lightAdaptationCliOptIn || process.env.TUTOR_STUB_LIGHT_ADAPTATION === '1';
  if (lightAdaptationExplicitOptIn && passthroughEnabled) {
    throw new Error('--light-adaptation is unavailable in --passthrough because learner assessment is disabled');
  }
  if (lightAdaptationExplicitOptIn && args['no-register-selection']) {
    throw new Error('--light-adaptation requires teaching-style selection; remove --no-register-selection');
  }
  const dagFactDropoutRate = normalizeTutorStubDagFactDropoutRate(args['dag-fact-dropout'], {
    label: '--dag-fact-dropout',
  });
  const dagFactDropoutSeed = normalizeTutorStubDagFactDropoutSeed(args['dag-fact-dropout-seed'], {
    label: '--dag-fact-dropout-seed',
  });
  const releaseSpeed = normalizeTutorStubReleaseSpeed(args['release-speed'], {
    label: '--release-speed',
  });
  const loopMode = normalizeTutorStubLoopMode(args['loop-mode'], { label: '--loop-mode' });
  const openingRealizer = String(args['opening-realizer'] || 'model')
    .trim()
    .toLowerCase();
  if (!['model', 'deterministic'].includes(openingRealizer)) {
    throw new Error('--opening-realizer must be model or deterministic');
  }
  const experimentRunSeed = normalizeTutorStubDagFactDropoutSeed(args['run-seed'], {
    label: '--run-seed',
  });
  const experimentRepeat = parsePositiveInt(args['eval-repeat'], '--eval-repeat');
  const typedActionsEnabled = Boolean(args['typed-actions']);
  const typedActionSupportLevel = parseOptionalBoundedInt(
    args['typed-action-support-level'],
    '--typed-action-support-level',
    { min: 0, max: 3 },
  );
  const typedActionTask = {
    taskId: String(args['typed-action-task-id'] || '').trim(),
    knowledgeComponent: String(args['typed-action-knowledge-component'] || '').trim(),
    prerequisitePath: commaSeparatedStrings(args['typed-action-prerequisites']),
    itemDifficulty: parseNumber(args['typed-action-item-difficulty'], '--typed-action-item-difficulty', {
      min: 0,
      max: 1,
    }),
  };
  if (typedActionsEnabled && (!typedActionTask.taskId || !typedActionTask.knowledgeComponent)) {
    throw new Error('--typed-actions requires non-empty task id and knowledge component');
  }
  const typedActionConfig = {
    schema: TUTOR_TYPED_ACTION_CONFIG_SCHEMA,
    enabled: typedActionsEnabled,
    defaultOff: true,
    policyMode: 'closed_loop',
    decisionTiming: 'after_current_public_learner_observation_before_tutor_output',
    outcomeHorizon: 'next_public_learner_observation',
    selectionMethod: 'deterministic_closed_loop_argmax',
    selectionProbability: 1,
    scaffoldLifecycle: {
      enabled: typedActionsEnabled,
      schema: SCAFFOLD_LIFECYCLE_SCHEMA,
      phases: ['diagnose', 'support', 'observe_uptake', 'fade', 'independent_work', 'transfer', 'recover'],
      drivenBy: ['typed_action_decision', 'closed_public_outcome'],
    },
    supportLevel: typedActionSupportLevel,
    task: typedActionTask,
  };
  const dagFactDropoutConfig = {
    schema: TUTOR_STUB_DAG_FACT_DROPOUT_SCHEMA,
    rate: dagFactDropoutRate,
    seed: dagFactDropoutSeed,
    enabled: dagFactDropoutRate > 0,
    graceTurns: 2,
    maxConcurrent: 2,
    eligibleFacts: 'adopted_public_premises_only',
    backgroundFactsImmune: true,
    visibility: 'conduct',
  };
  const releasePacingConfig = {
    schema: 'machinespirits.tutor-stub.release-pacing.v1',
    baseSpeed: releaseSpeed,
    adaptive: true,
    range: [MIN_TUTOR_STUB_RELEASE_SPEED, MAX_TUTOR_STUB_RELEASE_SPEED],
    directLearnerRequests: true,
    maxReleaseBatchesPerTutorTurn: 1,
  };
  const maxTokens = parsePositiveInt(args['max-tokens'], '--max-tokens');
  const historyTurns = parsePositiveInt(args['history-turns'], '--history-turns');
  const memorySummaryEnabled = Boolean(STUB.memorySummary && !args['no-memory-summary']);
  const autoLearnerEnabled = Boolean(args['auto-learner']);
  const mixedLearnerRequested = Boolean(args['mixed-learner'] || args['mixed-mode']);
  const mixedLearnerEnabled = Boolean(mixedLearnerRequested && !autoLearnerEnabled);
  const interactiveSessionEnabled = interactiveSessionIntent;
  const turnFeedbackEnabled = Boolean(
    STUB.turnFeedback && !args['no-turn-feedback'] && interactiveSessionEnabled && !autoLearnerEnabled,
  );
  const responseDetailsEnabled = Boolean(STUB.responseDetails && !args['no-response-details']);
  const learnerSuggestionEnabled = Boolean(
    !passthroughEnabled && (autoLearnerEnabled || mixedLearnerEnabled || interactiveSessionEnabled),
  );
  const learnerModelRequired = Boolean(learnerSuggestionEnabled || autoLearnerEnabled);
  const autoTurns = parseAutoTurns(args['auto-turns']);
  const autoSafetyTurns = parsePositiveInt(args['auto-safety-turns'], '--auto-safety-turns');
  const autoStopOnGrounded = !args['no-auto-stop-on-grounded'];
  if (autoLearnerEnabled && autoTurns === null && !autoStopOnGrounded) {
    throw new Error(
      '--auto-turns until-grounded requires grounded-closure stopping; remove --no-auto-stop-on-grounded',
    );
  }
  const launchWorldBundle = resolveWorldRef(args.world);
  const rememberedScenarioAvailable = rememberedSettings.appliedFields.includes('scenario');
  const existingScenarioAvailable = Boolean(explicitRememberedSources.scenario || rememberedScenarioAvailable);
  const initialScenarioPickerEnabled = Boolean(
    interactiveSessionEnabled &&
    STUB.opening &&
    !args['no-opening'] &&
    !resumeRequested &&
    launchWorldBundle &&
    !existingScenarioAvailable,
  );
  const initialScenarioKeyboardMenuActive = Boolean(
    initialScenarioPickerEnabled &&
    !args['dry-run'] &&
    input.isTTY &&
    output.isTTY &&
    typeof input.setRawMode === 'function',
  );
  let initialScenarioSelection = null;
  if (initialScenarioKeyboardMenuActive) {
    const defaultScenarioId = launchWorldBundle.world.id;
    console.log(`${C.cyan}Pick a scenario${C.reset}`);
    console.log(
      `${C.dim}  ↑/↓ scroll · Enter select · highlighted scenario described below · Esc quit · ${defaultScenarioId} selected by default${C.reset}`,
    );
    const selection = await pickInitialScenarioWithKeyboard(args.world);
    if (!selection) {
      console.log(`${C.dim}scenario picker cancelled${C.reset}`);
      return null;
    }
    args.world = selection.filePath;
    initialScenarioSelection = {
      scenarioId: selection.id,
      title: selection.title,
      defaultScenarioId,
      usedDefault: selection.id === defaultScenarioId,
      selectionMethod: 'keyboard_menu',
    };
    console.log(`${C.cyan}scenario >${C.reset} ${selection.id} — ${selection.title}\n`);
  }
  const worldBundle = resolveWorldRef(args.world);
  const directorContext = buildDirectorInitialContext(worldBundle?.world || null);
  const effectiveTopic =
    curriculumBundle && args.topic === STUB.topic
      ? curriculumBundle.module.title
      : worldBundle && args.topic === STUB.topic
        ? worldBundle.world.title
        : args.topic;
  const dagMode = normalizeDagMode(args['dag-mode']);
  const pointOfActionArm = normalizeTutorStubPointOfActionArm(args['point-of-action-arm']);
  const multipleChoiceEnabled = Boolean(args['multiple-choice']);
  assertSupportedModelRefs({
    '--model': args.model,
    '--classifier-model': args['classifier-model'],
    '--learner-record-model': args['learner-record-model'],
    '--auto-learner-model': args['auto-learner-model'],
  });

  return {
    allModelsOverride,
    allModelsOverrideRef,
    autoLearnerEnabled,
    autoSafetyTurns,
    autoStopOnGrounded,
    autoTurns,
    curriculumBundle,
    curriculumRuntime,
    dagFactDropoutConfig,
    dagFactDropoutRate,
    dagFactDropoutSeed,
    dagMode,
    directorContext,
    effectiveTopic,
    existingScenarioAvailable,
    experimentRepeat,
    experimentRunSeed,
    explicitRememberedSources,
    historyTurns,
    initialScenarioKeyboardMenuActive,
    initialScenarioPickerEnabled,
    initialScenarioSelection,
    interactiveSessionEnabled,
    interactiveSessionIntent,
    launchWorldBundle,
    learnerModelRequired,
    learnerSuggestionEnabled,
    lightAdaptationEnabled,
    lightAdaptationThreshold,
    loopMode,
    maxTokens,
    memorySummaryEnabled,
    mixedLearnerEnabled,
    mixedLearnerRequested,
    multipleChoiceEnabled,
    observedAuditsEnabled,
    openingRealizer,
    passthroughEnabled,
    pointOfActionArm,
    registerTemperature,
    releasePacingConfig,
    releaseSpeed,
    rememberedScenarioAvailable,
    rememberedSettings,
    responseDetailsEnabled,
    temperature,
    tuningMode,
    turnFeedbackEnabled,
    tutorInstance,
    typedActionConfig,
    typedActionSupportLevel,
    typedActionTask,
    voiceLaunchRequested,
    voiceModel,
    voiceName,
    worldBundle,
  };
}
