import path from 'node:path';

/**
 * Render launch-time diagnostics and validate provider availability.
 *
 * This boundary is intentionally side-effectful: it owns the historical
 * --show-prompt, --write-recipe, and --dry-run behavior while returning the
 * two recipe-provenance values required by the live session runtime.
 */
export function runTutorStubLaunchPresentation({ launchApplicationContext, sessionApplicationContext, ...runtime }) {
  const {
    C,
    ROOT,
    TUTOR_STUB_DIAGNOSTIC_COLLECTION_MODE,
    TUTOR_STUB_LIGHT_ADAPTATION_SCHEMA,
    TUTOR_STUB_SESSION_RUNTIME_SCHEMA,
    TUTOR_STUB_SESSION_RUNTIME_VERSION,
    allModelsOverride,
    args,
    autoLearnerEnabled,
    autoLearnerProviderConfig,
    autoLearnerResolved,
    autoSafetyTurns,
    autoStopOnGrounded,
    autoTurns,
    automatedLearnerProfileId,
    capabilitySnapshot,
    classifierEnabled,
    classifierProviderConfig,
    classifierResolved,
    cliEffort,
    cliPresentation,
    closeoutReportEnabled,
    combinedLearnerAnalysisEnabled,
    continuousDynamicalSystemRegisterSelectionEnabled,
    continuousEmpiricalDynamicalSystemRegisterSelectionEnabled,
    continuousUnsafeRegisterAnchorsEnabled,
    curriculumBundle,
    curriculumRuntime,
    dagFactDropoutConfig,
    dialogueClosureConfig,
    directorContext,
    dynamicalSystemRegisterSelectionEnabled,
    effectiveTemperature,
    effectiveTopic,
    empiricalDynamicalSystemRegisterSelectionEnabled,
    experimentConfig,
    explanatoryDebugConfig,
    fieldRegisterSelectionEnabled,
    fieldVisualizationEnabled,
    firstMessage,
    historyTurns,
    humanDiscourseConfig,
    humanDiscoursePreviewFrame,
    initialMixedLearnerSetupEnabled,
    initialScenarioPickerConfig,
    initialTutorCharacter,
    interactiveRoleModes,
    interimAnimationEnabled,
    isCliProvider,
    learnerAnalysisEvidenceUseRubric,
    learnerAnalysisPromptProfile,
    learnerDagPreflightConfig,
    learnerModelRequired,
    learnerRecordProviderConfig,
    learnerRecordResolved,
    learningSummaryReportConfig,
    lightAdaptationEnabled,
    lightAdaptationThreshold,
    loadedSessionRecipe,
    loopMode,
    maxTokens,
    memorySummaryEnabled,
    mixedLearnerEnabled,
    mixedLearnerRequested,
    mixedLearnerStartupPrompts,
    mixedTutorPrefetchPolicy,
    multipleChoiceEnabled,
    negativeRegisterSelectionEnabled,
    openingConfig,
    output,
    passthroughConfig,
    pointOfActionArm,
    promptArchitecture,
    providerConfig,
    providerSupportsEventStreaming,
    providerSupportsStreaming,
    randomRegisterSelectionEnabled,
    recipeDrift,
    registerEmpiricalPrior,
    registerOverlayThreshold,
    registerPalette,
    registerPolicy,
    registerPolicyOverlays,
    registerPolicyStack,
    registerSelectionEnabled,
    registerTemperature,
    releasePacingConfig,
    rememberedSettingsConfig,
    resolveWorkspacePath,
    resolved,
    responseDetailsConfig,
    resumeCandidate,
    resumeDrift,
    resumeRequested,
    selectedLabMetadata,
    sessionRecipe,
    stateRegisterSelectionEnabled,
    streamEnabled,
    systemPrompt,
    temperature,
    traceDir,
    traceEnabled,
    trainingReuseConfig,
    trajectoryRegisterSelectionEnabled,
    tuning,
    turnFeedbackConfig,
    tutorInstance,
    tutorLearnerDagEnabled,
    tutorStreamState,
    tutorStubCliPresentationSnapshot,
    tutorStubTuningSnapshot,
    typedActionConfig,
    visibleAutoLearnerModel,
    visibleClassifierConfig,
    visibleLearnerRecordModel,
    visibleModel,
    voiceLaunchRequested,
    voiceModel,
    voiceName,
    worldBundle,
    writeTutorStubSessionRecipe,
  } = { ...launchApplicationContext, ...sessionApplicationContext, ...runtime };
  let { loadedSessionRecipePath } = runtime;

  const loadedRecipeProvenance = loadedSessionRecipe
    ? {
        source: path.relative(ROOT, loadedSessionRecipe.filePath),
        drift: recipeDrift,
        driftAcknowledged: Boolean(args['acknowledge-drift'] && !recipeDrift?.ok),
      }
    : null;
  if (args['write-recipe']) {
    loadedSessionRecipePath = writeTutorStubSessionRecipe({
      recipe: sessionRecipe,
      filePath: resolveWorkspacePath(args['write-recipe']),
    });
  }

  if (args['show-prompt']) {
    console.log(`${C.dim}--- system prompt ---${C.reset}`);
    console.log(systemPrompt);
    console.log(`${C.dim}--- end system prompt ---${C.reset}\n`);
  }

  if (args['dry-run']) {
    console.log(
      JSON.stringify(
        {
          modelRef: args.model,
          resolved: visibleModel,
          tutorInstance: {
            id: tutorInstance.id,
            title: tutorInstance.title,
            requestedRef: args.tutor,
            activeRef: tuning.activeRef,
            sourceVersion: tutorInstance.sourceVersion,
            rolePromptPath: path.relative(ROOT, tutorInstance.rolePromptPath),
            rolePromptHash: tutorInstance.rolePromptHash,
            policyPack: tutorInstance.policyPack,
            modelDefaults: tutorInstance.modelDefaults,
          },
          tuning: tutorStubTuningSnapshot(tuning),
          allModelsOverride,
          voice: {
            schema: 'machinespirits.tutor-stub.voice-runtime.v1',
            launchRequested: voiceLaunchRequested,
            model: voiceModel,
            voice: voiceName,
            transcriptionModel: 'gpt-realtime-whisper',
            apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
            automaticRealtimeResponses: false,
            authority: 'existing_cli_analysis_dag_register_guard_pipeline',
          },
          rememberedSettings: rememberedSettingsConfig,
          trainingReuse: trainingReuseConfig,
          lab: selectedLabMetadata,
          sessionRecipe,
          recipeFile: loadedSessionRecipePath ? path.relative(ROOT, loadedSessionRecipePath) : null,
          recipeSource: loadedRecipeProvenance,
          resume: resumeCandidate
            ? {
                source: path.relative(ROOT, resumeCandidate.filePath),
                runId: resumeCandidate.runId,
                turns: resumeCandidate.turns.length,
                migration: resumeCandidate.migration,
                drift: resumeDrift,
                driftAcknowledged: Boolean(args['acknowledge-drift'] && !resumeDrift?.ok),
              }
            : { requested: resumeRequested, found: false },
          passthrough: passthroughConfig,
          capabilities: capabilitySnapshot,
          sessionRuntime: {
            schema: TUTOR_STUB_SESSION_RUNTIME_SCHEMA,
            version: TUTOR_STUB_SESSION_RUNTIME_VERSION,
            lifecycle: ['create', 'load', 'resume', 'step', 'reset', 'finalize'],
            stateIsolation: 'per_runtime_instance',
            commandHandlers: 'registry_owned',
            traceEvents: 'versioned_session_event_envelopes',
          },
          topic: effectiveTopic,
          curriculum: curriculumBundle
            ? {
                id: curriculumBundle.curriculum.id,
                title: curriculumBundle.curriculum.title,
                sourceRef: curriculumBundle.sourceRef,
                sourceHash: curriculumBundle.curriculum.source?.source_hash || null,
                moduleId: curriculumBundle.module.id,
                moduleTitle: curriculumBundle.module.title,
                mode: 'public_reflective_non_dag',
                completionAuthority: curriculumRuntime.completionAuthority,
              }
            : null,
          world: worldBundle
            ? {
                id: worldBundle.world.id,
                title: worldBundle.world.title,
                file: path.relative(ROOT, worldBundle.filePath),
                dag: args.dag,
              }
            : null,
          scenarioPicker: initialScenarioPickerConfig,
          humanDiscourse: humanDiscourseConfig,
          humanDiscoursePreviewFrame,
          comprehensionSideState: {
            enabled: true,
            schema: 'machinespirits.tutor-stub.comprehension-side-state.v1',
            sources: ['learner_turn', 'slash_explain'],
            advancesLearnerDag: false,
          },
          dagFactDropout: dagFactDropoutConfig,
          releasePacing: releasePacingConfig,
          loopExecution: {
            mode: loopMode,
            fixedPublicSafeQuarantine: loopMode === TUTOR_STUB_DIAGNOSTIC_COLLECTION_MODE,
            recoverableFailurePolicy:
              loopMode === TUTOR_STUB_DIAGNOSTIC_COLLECTION_MODE
                ? 'rollback_turn_state_commit_mechanical_quarantine_and_continue'
                : 'fail_fast',
          },
          experiment: experimentConfig,
          typedPedagogicalActions: typedActionConfig,
          responseConfiguration: {
            schema: 'machinespirits.tutor-stub.response-configuration.v3',
            primaryStanceField: 'engagement_stance',
            independentAxes: [
              'engagement_stance',
              'action_family',
              'addressee_profile',
              'lexical_accessibility',
              'scene_immersion',
              'actorial_part',
            ],
            temperatureScope: 'engagement_stance_and_actorial_part',
            transcriptVisibilityAudit: true,
          },
          randomPerformance: {
            available: registerSelectionEnabled,
            enabled: false,
            slashCommand: '/random',
            scope: ['engagement_stance', 'actorial_part'],
            assessmentInfluence: false,
            preservedControls: ['action_family', 'evidence_release', 'dialogue_closure', 'response_safety'],
          },
          lightAdaptation: {
            schema: TUTOR_STUB_LIGHT_ADAPTATION_SCHEMA,
            available: registerSelectionEnabled,
            enabled: lightAdaptationEnabled,
            threshold: lightAdaptationThreshold,
            slashCommand: '/light on|off|status',
            settingsCommand: '/settings light on|off|status',
            defaultScope: 'adaptive_interactive_sessions',
            rememberedPreference: true,
            trigger: 'continued_learner_confusion_or_frustration',
            scope: ['engagement_stance', 'actorial_part'],
            selectionMethod: 'seeded_uniform_excluding_previous',
            preservedControls: [
              'action_family',
              'authored_evidence_source',
              'evidence_release',
              'dialogue_closure',
              'response_safety',
            ],
          },
          performanceDirectives: {
            available: registerSelectionEnabled,
            sessionOnly: true,
            register: null,
            character: initialTutorCharacter,
            slashCommands: ['/register', '/character'],
            precedence: 'light_adaptation_then_explicit_axis_then_random_axis_then_adaptive_policy',
          },
          promptArchitecture,
          learnerAnalysisPromptProfile,
          learnerAnalysisEvidenceUseRubric,
          directorContext,
          temperature: effectiveTemperature,
          requestedTemperature: temperature,
          cliEffort: cliEffort || null,
          classifier: visibleClassifierConfig,
          tutorLearnerDag: tutorLearnerDagEnabled
            ? {
                modelRef: args['learner-record-model'],
                resolved: visibleLearnerRecordModel,
                combinedClassifier: combinedLearnerAnalysisEnabled,
                preflight: learnerDagPreflightConfig,
                multiPremiseAdvance: {
                  enabled: true,
                  schema: 'machinespirits.tutor-stub.learner-advance.v1',
                  validation: 'staged_public_evidence_and_public_rules',
                  downstream: [
                    'classification',
                    'field',
                    'trajectory',
                    'register',
                    'response_configuration',
                    'reports',
                  ],
                },
              }
            : { enabled: false, requested: Boolean(args['tutor-learner-dag']) },
          autoLearner: autoLearnerEnabled
            ? {
                enabled: true,
                modelRef: args['auto-learner-model'],
                resolved: visibleAutoLearnerModel,
                maxTurns: autoTurns ?? 'until-grounded',
                untilGrounded: autoTurns === null,
                safetyTurns: autoTurns === null ? autoSafetyTurns : null,
                stopOnGrounded: autoStopOnGrounded,
                profileId: automatedLearnerProfileId(args['auto-learner-profile']),
                profile: args['auto-learner-profile'],
              }
            : { enabled: false },
          mixedLearner: mixedLearnerEnabled
            ? {
                enabled: true,
                modelRef: args['auto-learner-model'],
                resolved: visibleAutoLearnerModel,
                profileId: automatedLearnerProfileId(args['auto-learner-profile']),
                profile: args['auto-learner-profile'],
                clue: '/clue or /hint',
                accept: 'Tab on an empty learner prompt, /use, or /accept',
                inspect: '/suggest',
                regenerate: '/regen',
                tutorPrefetchPolicy: mixedTutorPrefetchPolicy,
                profilePresentation: {
                  promptLabel: true,
                  intendedPattern: true,
                  visibleExpression: 'profile_signal',
                  readyAnnouncement: 'once_per_profile',
                  firstTutorOrdering: 'ready_profile_then_director_then_tutor',
                  initialPicker: {
                    enabled: initialMixedLearnerSetupEnabled,
                    defaultProfileId: automatedLearnerProfileId(args['auto-learner-profile']) || 'custom',
                    keyboardMenu: true,
                    navigation: ['up', 'down', 'enter'],
                    nonTtyFallback: 'typed_profile_id',
                  },
                },
                startupPrompts: mixedLearnerStartupPrompts,
              }
            : { enabled: false, requested: mixedLearnerRequested },
          interactiveRoleModes,
          turnFeedback: turnFeedbackConfig,
          responseDetails: responseDetailsConfig,
          explanatoryDebug: explanatoryDebugConfig,
          learningSummaryReport: learningSummaryReportConfig,
          registerSelection: registerSelectionEnabled
            ? {
                enabled: true,
                palette: registerPalette,
                policy: registerPolicyStack.id,
                primaryPolicy: registerPolicy,
                overlayPolicies: registerPolicyOverlays,
                overlayThreshold: registerOverlayThreshold,
                temperature: registerTemperature,
                engagementStanceTemperature: registerTemperature,
                temperatureScope: 'engagement_stance_and_actorial_part',
                combinedLearnerAnalysis: combinedLearnerAnalysisEnabled,
                localFieldPolicy: fieldRegisterSelectionEnabled,
                localTrajectoryPolicy: trajectoryRegisterSelectionEnabled,
                localDynamicalSystemPolicy: dynamicalSystemRegisterSelectionEnabled,
                localEmpiricalDynamicalSystemPolicy: empiricalDynamicalSystemRegisterSelectionEnabled,
                localContinuousDynamicalSystemPolicy: continuousDynamicalSystemRegisterSelectionEnabled,
                localContinuousEmpiricalDynamicalSystemPolicy:
                  continuousEmpiricalDynamicalSystemRegisterSelectionEnabled,
                continuousUnsafeRegisterAnchors: continuousUnsafeRegisterAnchorsEnabled,
                localStatePolicy: stateRegisterSelectionEnabled,
                random: randomRegisterSelectionEnabled,
                negative: negativeRegisterSelectionEnabled,
                empiricalPrior: {
                  status: registerEmpiricalPrior.status,
                  path: registerEmpiricalPrior.filePath ? path.relative(ROOT, registerEmpiricalPrior.filePath) : null,
                  observationCount: registerEmpiricalPrior.prior?.source?.observationCount ?? null,
                },
              }
            : { enabled: false },
          pointOfAction: pointOfActionArm
            ? {
                enabled: true,
                arm: pointOfActionArm,
                detectorVersion: 'step4-frozen-2026-07-14.v1',
                opportunityProtocol: args['point-of-action-opportunity-protocol'] || null,
                eligibleTurns: [3, 24],
                triggerPriority: ['stagnant_repeat', 'warrant_skip'],
                committee:
                  pointOfActionArm === 'committee'
                    ? {
                        model: args['committee-mini-model'],
                        spanInterface: args['committee-span-interface'],
                        fallbackPolicy: args['committee-fallback-policy'],
                        control: '/committee on|off|status',
                      }
                    : null,
              }
            : { enabled: false },
          maxTokens,
          historyTurns,
          speakerHistory: {
            mode: 'full_public_replay',
            perspectives: ['tutor', 'learner'],
            roles: ['system', 'user', 'assistant'],
            directApiTransport: 'native_messages',
            cliTransport: 'flattened_at_bridge_boundary',
            automatedLearnerBudgetFallback: {
              enabled: true,
              trigger: 'prompt_audit_budget_violation',
              mode: 'budget_window_public_replay',
              recentTurns: historyTurns,
              publicOnly: true,
            },
          },
          memorySummary: {
            enabled: memorySummaryEnabled,
            rawRecentTurns: historyTurns,
            publicSummary: memorySummaryEnabled,
            scope: 'auxiliary_analysis_prompts',
          },
          trace: traceEnabled
            ? {
                enabled: true,
                dir: path.relative(ROOT, traceDir),
              }
            : { enabled: false },
          stream: {
            enabled: streamEnabled,
            tutor: tutorStreamState,
            tutorLive: tutorStreamState === 'live',
            tutorGuardedAfterAudit: tutorStreamState === 'guarded_after_audit',
            classifier:
              streamEnabled && classifierResolved
                ? providerSupportsStreaming(classifierResolved) || providerSupportsEventStreaming(classifierResolved)
                : false,
            learnerAnalysis:
              streamEnabled && learnerRecordResolved
                ? providerSupportsStreaming(learnerRecordResolved) ||
                  providerSupportsEventStreaming(learnerRecordResolved)
                : false,
          },
          opening: openingConfig,
          closeoutReport: { enabled: closeoutReportEnabled },
          dialogueClosure: dialogueClosureConfig,
          multipleChoice: { enabled: multipleChoiceEnabled },
          interimAnimation: {
            enabled: interimAnimationEnabled,
            activeInThisTerminal: Boolean(interimAnimationEnabled && output.isTTY && cliPresentation.motion !== 'off'),
          },
          presentation: tutorStubCliPresentationSnapshot(cliPresentation),
          fieldVisualization: {
            enabled: fieldVisualizationEnabled,
            dir: path.relative(ROOT, traceDir),
            automaticAfterTurns: fieldVisualizationEnabled,
            slashCommand: '/viz',
          },
          resumeLast: resumeRequested
            ? resumeCandidate
              ? {
                  source: path.relative(ROOT, resumeCandidate.filePath),
                  turns: resumeCandidate.turns.length,
                  world: resumeCandidate.metadata?.world || null,
                }
              : { requested: true, found: false, traceDir: path.relative(ROOT, traceDir) }
            : { requested: false },
          systemPrompt,
          firstMessage: firstMessage || null,
        },
        null,
        2,
      ),
    );
    return { completed: true, loadedRecipeProvenance, loadedSessionRecipePath };
  }

  if (!resolved.isConfigured && !isCliProvider(resolved.provider)) {
    const envName = providerConfig.api_key_env || 'provider API key';
    throw new Error(`${args.model} is not configured. Set ${envName} or choose a CLI-backed model.`);
  }
  if (
    classifierEnabled &&
    !combinedLearnerAnalysisEnabled &&
    !classifierResolved.isConfigured &&
    !isCliProvider(classifierResolved.provider)
  ) {
    const envName = classifierProviderConfig.api_key_env || 'provider API key';
    throw new Error(`${args['classifier-model']} is not configured. Set ${envName} or choose a CLI-backed classifier.`);
  }
  if (tutorLearnerDagEnabled && !learnerRecordResolved.isConfigured && !isCliProvider(learnerRecordResolved.provider)) {
    const envName = learnerRecordProviderConfig.api_key_env || 'provider API key';
    throw new Error(
      `${args['learner-record-model']} is not configured. Set ${envName} or choose a CLI-backed learner-record model.`,
    );
  }
  if (learnerModelRequired && !autoLearnerResolved.isConfigured && !isCliProvider(autoLearnerResolved.provider)) {
    const envName = autoLearnerProviderConfig.api_key_env || 'provider API key';
    throw new Error(
      `${args['auto-learner-model']} is not configured. Set ${envName} or choose a CLI-backed automated learner model.`,
    );
  }

  return { completed: false, loadedRecipeProvenance, loadedSessionRecipePath };
}
