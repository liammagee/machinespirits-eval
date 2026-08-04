import path from 'node:path';

export function createTutorStubLaunchRuntime(dependencies = {}) {
  const {
    args,
    root,
    env = process.env,
    argv = process.argv.slice(2),
    input = process.stdin,
    output = process.stdout,
    applyTutorStubRecipeOptions,
    latestTutorStubResumeSource,
    learnerProfileIds,
    normalizeTutorStubLaunchMode,
    normalizeTutorStubVoiceModel,
    normalizeTutorStubVoiceName,
    parseTutorStubRegisterPolicyStack,
    plainSettingName,
    readTutorStubLastSettings,
    readTutorStubSessionRecipe,
    resolveTutorModelSelection,
    resolveTutorStubLab,
    resolveTutorStubResumeSource,
    resolveWorldRef,
    tutorStubRememberedPolicyStack,
  } = dependencies;

  let loadedSessionRecipe = null;
  let loadedSessionRecipePath = null;
  let resolvedResumeSource = null;
  let loadedRecipeApplication = null;
  let resumeRecipeApplication = null;
  let selectedLabResolution = null;
  const resolvedLaunchOptionNames = new Set();

  const resolveWorkspacePath = (value) => (path.isAbsolute(value) ? value : path.join(root, value));

  function rawCommandLineOptionProvided(name) {
    const flag = `--${name}`;
    return argv.some((argument) => argument === flag || argument.startsWith(`${flag}=`));
  }

  function rawRecipeOptionProvided(name) {
    if (name === 'training-reuse') {
      return rawCommandLineOptionProvided('training-reuse') || rawCommandLineOptionProvided('no-training-reuse');
    }
    return rawCommandLineOptionProvided(name);
  }

  function commandLineOptionProvided(name) {
    return rawCommandLineOptionProvided(name) || resolvedLaunchOptionNames.has(name);
  }

  function applyTutorStubLabDefaults(id) {
    const base = resolveTutorStubLab(id);
    for (const [key, value] of Object.entries(base.cliOptions)) {
      if (key === 'lab' || rawCommandLineOptionProvided(key)) continue;
      args[key] = value;
      resolvedLaunchOptionNames.add(key);
    }
    args.lab = base.lab.id;
  }

  function prepareTutorStubLaunchConfiguration() {
    if (args.resume && args['resume-last']) {
      throw new Error('--resume and --resume-last are mutually exclusive; select one explicit resume source');
    }

    if (args.recipe) {
      loadedSessionRecipe = readTutorStubSessionRecipe(resolveWorkspacePath(args.recipe));
      loadedSessionRecipePath = loadedSessionRecipe.filePath;
      const explicitLab = rawCommandLineOptionProvided('lab') ? String(args.lab || '').trim() : '';
      const recipeLab = String(loadedSessionRecipe.config?.lab || '').trim();
      if (explicitLab && recipeLab && explicitLab !== recipeLab && !args['acknowledge-drift']) {
        throw new Error(
          `recipe lab drift: recipe selects ${recipeLab}, but --lab selects ${explicitLab}; rerun with --acknowledge-drift to inspect the effective lab configuration`,
        );
      }
    }

    const requestedLaunchMode = normalizeTutorStubLaunchMode(args['launch-mode'], { allowEmpty: true });
    const defaultLab = String(env.TUTOR_STUB_DEFAULT_LAB || '').trim();
    const defaultLabEligible = Boolean(
      defaultLab &&
      !args.lab &&
      !args.recipe &&
      !args.resume &&
      !args['resume-last'] &&
      !args.passthrough &&
      !args['auto-learner'] &&
      !args.curriculum &&
      !args.once &&
      !args['session-rpc'] &&
      !args['labelling-game'] &&
      requestedLaunchMode !== 'labelling-game',
    );
    const declaredLab = String(
      args.lab || loadedSessionRecipe?.config?.lab || (defaultLabEligible ? defaultLab : ''),
    ).trim();
    if (declaredLab) applyTutorStubLabDefaults(declaredLab);
    if (loadedSessionRecipe) {
      loadedRecipeApplication = applyTutorStubRecipeOptions(args, loadedSessionRecipe, {
        optionProvided: rawRecipeOptionProvided,
      });
      for (const key of loadedRecipeApplication.applied) resolvedLaunchOptionNames.add(key);
    }

    if (args.resume || args['resume-last']) {
      resolvedResumeSource = args.resume
        ? resolveTutorStubResumeSource(args.resume, {
            traceDir: resolveWorkspacePath(args['trace-dir']),
            cwd: root,
          })
        : latestTutorStubResumeSource({
            traceDir: resolveWorkspacePath(args['trace-dir']),
            cwd: root,
          });
      if (resolvedResumeSource && !loadedSessionRecipe) {
        const resumeLab = String(args.lab || resolvedResumeSource.recipe?.config?.lab || '').trim();
        if (resumeLab && !declaredLab) applyTutorStubLabDefaults(resumeLab);
        resumeRecipeApplication = applyTutorStubRecipeOptions(args, resolvedResumeSource.recipe, {
          optionProvided: rawRecipeOptionProvided,
        });
        for (const key of resumeRecipeApplication.applied) resolvedLaunchOptionNames.add(key);
      }
    }

    const resolvedLab = String(
      args.lab || loadedSessionRecipe?.config?.lab || resolvedResumeSource?.recipe?.config?.lab || '',
    ).trim();
    if (resolvedLab) selectedLabResolution = resolveTutorStubLab(resolvedLab, { overrides: args });
  }

  function resolvedTrainingReuseSource(rememberedSettings) {
    if (rawCommandLineOptionProvided('no-training-reuse')) return 'cli_opt_out';
    if (rawCommandLineOptionProvided('training-reuse')) return 'cli';
    if (env.TUTOR_STUB_TRAINING_REUSE !== undefined) return 'environment';
    if (loadedRecipeApplication?.applied?.includes('training-reuse')) return 'session_recipe';
    if (resumeRecipeApplication?.applied?.includes('training-reuse')) return 'resume_trace';
    if (rememberedSettings?.appliedFields?.includes('training_reuse')) return 'remembered_settings';
    if (resolvedLaunchOptionNames.has('training-reuse')) return 'resolved_launch_default';
    return 'repository_default';
  }

  function resolvedHumanSubjectClassSource() {
    if (rawCommandLineOptionProvided('human-subject-class')) return 'cli';
    if (env.TUTOR_STUB_HUMAN_SUBJECT_CLASS !== undefined) return 'environment';
    if (loadedRecipeApplication?.applied?.includes('human-subject-class')) return 'session_recipe';
    if (resumeRecipeApplication?.applied?.includes('human-subject-class')) return 'resume_trace';
    if (resolvedLaunchOptionNames.has('human-subject-class')) return 'resolved_launch_default';
    return 'repository_default';
  }

  function rememberedSettingExplicitSources() {
    const allModels = commandLineOptionProvided('all-models') || Boolean(env.TUTOR_STUB_ALL_MODELS);
    return {
      tutorInstance: commandLineOptionProvided('tutor') || Boolean(env.TUTOR_STUB_TUTOR),
      tuningMode: commandLineOptionProvided('tuning') || Boolean(env.TUTOR_STUB_TUNING),
      scenario: commandLineOptionProvided('world') || Boolean(env.TUTOR_STUB_WORLD),
      learnerProfile:
        commandLineOptionProvided('auto-learner-profile') ||
        commandLineOptionProvided('learner-character') ||
        Boolean(env.TUTOR_STUB_AUTO_LEARNER_PROFILE),
      allModelsRef: allModels,
      tutorModelRef: allModels || commandLineOptionProvided('model') || Boolean(env.TUTOR_STUB_MODEL),
      classifierModelRef:
        allModels || commandLineOptionProvided('classifier-model') || Boolean(env.TUTOR_STUB_CLASSIFIER_MODEL),
      learnerRecordModelRef:
        allModels || commandLineOptionProvided('learner-record-model') || Boolean(env.TUTOR_STUB_LEARNER_RECORD_MODEL),
      autoLearnerModelRef:
        allModels || commandLineOptionProvided('auto-learner-model') || Boolean(env.TUTOR_STUB_AUTO_LEARNER_MODEL),
      voiceModel: commandLineOptionProvided('voice-model') || Boolean(env.TUTOR_STUB_VOICE_MODEL),
      voiceName: commandLineOptionProvided('voice-name') || Boolean(env.TUTOR_STUB_VOICE_NAME),
      cliTheme: commandLineOptionProvided('theme') || Boolean(env.TUTOR_STUB_CLI_THEME),
      motion: commandLineOptionProvided('motion') || Boolean(env.TUTOR_STUB_MOTION),
      committeeEnabled:
        commandLineOptionProvided('committee') ||
        commandLineOptionProvided('no-committee') ||
        commandLineOptionProvided('point-of-action-arm') ||
        Boolean(env.TUTOR_STUB_POINT_OF_ACTION_ARM),
      engagementStanceTemperature:
        commandLineOptionProvided('register-temperature') || Boolean(env.TUTOR_STUB_REGISTER_TEMPERATURE),
      lightAdaptationEnabled:
        commandLineOptionProvided('light-adaptation') ||
        commandLineOptionProvided('no-light-adaptation') ||
        env.TUTOR_STUB_LIGHT_ADAPTATION !== undefined,
      trainingReuseEnabled:
        commandLineOptionProvided('training-reuse') ||
        commandLineOptionProvided('no-training-reuse') ||
        env.TUTOR_STUB_TRAINING_REUSE !== undefined,
      dagFactDropoutRate: commandLineOptionProvided('dag-fact-dropout') || Boolean(env.TUTOR_STUB_DAG_FACT_DROPOUT),
      releaseSpeed: commandLineOptionProvided('release-speed') || Boolean(env.TUTOR_STUB_RELEASE_SPEED),
      registerPolicy: commandLineOptionProvided('register-policy') || Boolean(env.TUTOR_STUB_REGISTER_POLICY),
      registerOverlayThreshold:
        commandLineOptionProvided('register-overlay-threshold') || Boolean(env.TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD),
    };
  }

  function applyRememberedInteractiveDefaults({ interactiveSessionEnabled }) {
    const filePath = resolveWorkspacePath(args['settings-file']);
    const ttyDefault = Boolean(input.isTTY && output.isTTY);
    const nonTtyOptIn = env.TUTOR_STUB_REMEMBER_SETTINGS === '1';
    const enabled = Boolean(interactiveSessionEnabled && !args['no-remember-settings'] && (ttyDefault || nonTtyOptIn));
    const config = {
      enabled,
      writeEnabled: Boolean(enabled && !args['dry-run']),
      filePath,
      status: enabled ? 'missing' : 'disabled',
      loadedAt: null,
      savedAt: null,
      appliedFields: [],
      skippedExplicitFields: [],
      restoredAllModelsOverrideRef: null,
      warning: null,
    };
    if (!enabled) return config;

    const read = readTutorStubLastSettings(filePath);
    config.status = read.status;
    config.warning = read.error;
    if (read.status !== 'loaded') return config;
    config.loadedAt = read.settings.updatedAt;
    const saved = read.settings;
    const explicit = rememberedSettingExplicitSources();

    if (explicit.tutorInstance) config.skippedExplicitFields.push('tutor_instance');
    else if (saved.tutorInstanceRef) {
      args.tutor = saved.tutorInstanceRef;
      config.appliedFields.push('tutor_instance');
    }

    if (explicit.tuningMode) config.skippedExplicitFields.push('tuning_mode');
    else if (saved.tuningMode) {
      args.tuning = saved.tuningMode;
      config.appliedFields.push('tuning_mode');
    }

    if (explicit.scenario) config.skippedExplicitFields.push('scenario');
    else if (saved.scenarioId) {
      try {
        args.world = resolveWorldRef(saved.scenarioId).filePath;
        config.appliedFields.push('scenario');
      } catch (error) {
        config.warning = `saved scenario ignored: ${error.message}`;
      }
    }

    if (explicit.learnerProfile) config.skippedExplicitFields.push('learner_profile');
    else if (saved.learnerProfileId || saved.learnerProfile) {
      if (saved.learnerProfileId && !learnerProfileIds().includes(saved.learnerProfileId)) {
        config.warning = [config.warning, `saved learner profile ignored: ${saved.learnerProfileId} is unavailable`]
          .filter(Boolean)
          .join('; ');
      } else {
        args['auto-learner-profile'] = saved.learnerProfileId || saved.learnerProfile;
        config.appliedFields.push('learner_profile');
      }
    }

    if (explicit.tutorModelRef) config.skippedExplicitFields.push('tutor_model');
    else {
      try {
        resolveTutorModelSelection(saved.tutorModelRef);
        args.model = saved.tutorModelRef;
        config.appliedFields.push('tutor_model');
      } catch (error) {
        config.warning = `saved tutor model ignored: ${error.message}`;
      }
    }

    const rememberedModelRoles = [
      ['classifierModelRef', 'classifier-model', 'learner_interpretation_model', explicit.classifierModelRef],
      ['learnerRecordModelRef', 'learner-record-model', 'learner_reasoning_model', explicit.learnerRecordModelRef],
      ['autoLearnerModelRef', 'auto-learner-model', 'learner_voice_model', explicit.autoLearnerModelRef],
    ];
    for (const [field, argument, applied, isExplicit] of rememberedModelRoles) {
      if (isExplicit) {
        config.skippedExplicitFields.push(applied);
        continue;
      }
      const savedRef = saved[field];
      if (!savedRef) continue;
      try {
        resolveTutorModelSelection(savedRef);
        args[argument] = savedRef;
        config.appliedFields.push(applied);
      } catch (error) {
        config.warning = [config.warning, `saved ${plainSettingName(applied)} ignored: ${error.message}`]
          .filter(Boolean)
          .join('; ');
      }
    }
    if (
      !explicit.allModelsRef &&
      saved.allModelsOverrideRef &&
      [saved.tutorModelRef, saved.classifierModelRef, saved.learnerRecordModelRef, saved.autoLearnerModelRef].every(
        (ref) => ref === saved.allModelsOverrideRef,
      )
    ) {
      config.restoredAllModelsOverrideRef = saved.allModelsOverrideRef;
    }

    if (explicit.voiceModel) config.skippedExplicitFields.push('realtime_voice_model');
    else if (saved.voiceModel) {
      try {
        args['voice-model'] = normalizeTutorStubVoiceModel(saved.voiceModel);
        config.appliedFields.push('realtime_voice_model');
      } catch (error) {
        config.warning = [config.warning, `saved Realtime voice model ignored: ${error.message}`]
          .filter(Boolean)
          .join('; ');
      }
    }

    if (explicit.voiceName) config.skippedExplicitFields.push('realtime_voice_name');
    else if (saved.voiceName) {
      try {
        args['voice-name'] = normalizeTutorStubVoiceName(saved.voiceName);
        config.appliedFields.push('realtime_voice_name');
      } catch (error) {
        config.warning = [config.warning, `saved Realtime voice name ignored: ${error.message}`]
          .filter(Boolean)
          .join('; ');
      }
    }

    const scalarSettings = [
      ['cliTheme', 'theme', 'terminal_theme', explicit.cliTheme, (value) => value],
      ['motion', 'motion', 'terminal_motion', explicit.motion, (value) => value],
      [
        'committeeEnabled',
        'point-of-action-arm',
        'committee_mode',
        explicit.committeeEnabled,
        (value) => (value ? 'committee' : ''),
      ],
      [
        'engagementStanceTemperature',
        'register-temperature',
        'engagement_stance_temperature',
        explicit.engagementStanceTemperature,
        String,
      ],
      ['lightAdaptationEnabled', 'light-adaptation', 'light_adaptation', explicit.lightAdaptationEnabled, Boolean],
      [
        'trainingReuseEnabled',
        'training-reuse',
        'training_reuse',
        explicit.trainingReuseEnabled,
        (value) => (value ? 'on' : 'off'),
      ],
      ['dagFactDropoutRate', 'dag-fact-dropout', 'dag_fact_dropout', explicit.dagFactDropoutRate, String],
      ['releaseSpeed', 'release-speed', 'clue_release_speed', explicit.releaseSpeed, String],
    ];
    for (const [field, argument, applied, isExplicit, normalize] of scalarSettings) {
      if (isExplicit) {
        config.skippedExplicitFields.push(applied);
        continue;
      }
      args[argument] = normalize(saved[field]);
      config.appliedFields.push(applied);
      if (field === 'lightAdaptationEnabled') args['no-light-adaptation'] = !saved[field];
    }

    try {
      const savedPolicyStack = tutorStubRememberedPolicyStack(saved);
      parseTutorStubRegisterPolicyStack(savedPolicyStack);
      if (!explicit.registerPolicy) {
        args['register-policy'] = savedPolicyStack;
        config.appliedFields.push('register_policy', 'register_overlays');
      } else {
        const requested = parseTutorStubRegisterPolicyStack(args['register-policy']);
        if (
          requested.primary === saved.registerPolicy &&
          requested.overlays.length === 0 &&
          saved.registerOverlays.length
        ) {
          args['register-policy'] = savedPolicyStack;
          config.appliedFields.push('register_overlays');
          config.skippedExplicitFields.push('register_policy');
        } else {
          config.skippedExplicitFields.push('register_policy', 'register_overlays');
        }
      }
    } catch (error) {
      config.warning = [config.warning, `saved register policy ignored: ${error.message}`].filter(Boolean).join('; ');
    }

    if (explicit.registerOverlayThreshold) config.skippedExplicitFields.push('register_overlay_threshold');
    else {
      args['register-overlay-threshold'] = String(saved.registerOverlayThreshold);
      config.appliedFields.push('register_overlay_threshold');
    }
    return config;
  }

  const informationalLaunchRequested = Boolean(
    args.help ||
    args['list-labs'] ||
    args.features ||
    args['list-worlds'] ||
    args['list-curriculum-modules'] ||
    args['list-tutors'] ||
    args['list-learner-profiles'],
  );
  if (!informationalLaunchRequested) prepareTutorStubLaunchConfiguration();

  return {
    applyRememberedInteractiveDefaults,
    commandLineOptionProvided,
    loadedRecipeApplication,
    loadedSessionRecipe,
    loadedSessionRecipePath,
    rawCommandLineOptionProvided,
    rememberedSettingExplicitSources,
    resumeRecipeApplication,
    resolvedHumanSubjectClassSource,
    resolvedResumeSource,
    resolvedTrainingReuseSource,
    resolveWorkspacePath,
    selectedLabResolution,
  };
}
