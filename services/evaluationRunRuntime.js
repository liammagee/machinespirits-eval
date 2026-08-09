const FACTORIAL_CELLS = Object.freeze([
  'cell_1_base_single_unified',
  'cell_2_base_single_psycho',
  'cell_3_base_multi_unified',
  'cell_4_base_multi_psycho',
  'cell_5_recog_single_unified',
  'cell_6_recog_single_psycho',
  'cell_7_recog_multi_unified',
  'cell_8_recog_multi_psycho',
]);

/**
 * Own complete evaluation-run orchestration around an already constructed
 * single-test runtime. Generation and scoring remain in their existing owners.
 */
export function createEvaluationRunRuntime(dependencies) {
  const {
    CLAUDE_CLI_CONTEXT_ISOLATION,
    DEFAULT_PARALLELISM,
    LiveApiReporter,
    ProgressLogger,
    REQUEST_DELAY_MS,
    SUPPORTED_JUDGE_CLIS,
    StreamingReporter,
    applyScenarioFilter,
    contentResolver,
    currentIsoTimestamp = () => new Date().toISOString(),
    environment = process.env,
    evalConfigLoader,
    evaluationStore,
    formatProgress,
    getDefaultCliJudgeModelOverride,
    getGitCommitHash,
    getProgressLogPath,
    isTransientEvaluationError,
    monitoringService,
    now = Date.now,
    output = console,
    packageVersion,
    processId = process.pid,
    runSingleTest,
    setLiveQuiet,
    setQuietMode,
    sleep,
    warnIfWeakStackDefault,
  } = dependencies;

  async function runEvaluation(options = {}) {
    const normalized = normalizeRunOptions(options, DEFAULT_PARALLELISM);
    const judge = resolveJudge(normalized, SUPPORTED_JUDGE_CLIS, getDefaultCliJudgeModelOverride);
    const log = normalized.verbose ? output.log : () => {};

    setQuietMode(true);
    const liveApiReporter = installLiveReporter(normalized.liveApi);
    configureContent();

    const plan = resolveRunPlan(normalized);
    warnIfWeakStackDefault(plan.targetConfigs);
    logPlan(log, normalized, plan);

    const runContext = createRunContext(normalized, judge, plan);
    const execution = createExecutionState(normalized, judge, plan, runContext, liveApiReporter, log);
    await processQueue(execution.allTests, normalized.parallelism, (test) => executeTest(execution, test));
    return finalizeRun(execution);
  }

  function installLiveReporter(liveApi) {
    if (!liveApi) return null;
    const reporter = new LiveApiReporter();
    reporter.install();
    setLiveQuiet(true);
    return reporter;
  }

  function configureContent() {
    if (environment.EVAL_CONTENT_PATH || environment.EVAL_SCENARIOS_FILE) {
      output.log('[evaluationRunner] Domain overrides detected:');
      if (environment.EVAL_CONTENT_PATH) output.log(`  EVAL_CONTENT_PATH = ${environment.EVAL_CONTENT_PATH}`);
      if (environment.EVAL_SCENARIOS_FILE) output.log(`  EVAL_SCENARIOS_FILE = ${environment.EVAL_SCENARIOS_FILE}`);
    }

    const contentConfig = evalConfigLoader.getContentConfig();
    if (!contentConfig?.content_package_path) return;
    contentResolver.configure({
      contentPackagePath: contentConfig.content_package_path,
      maxLectureChars: contentConfig.max_lecture_chars,
      includeSpeakerNotes: contentConfig.include_speaker_notes,
    });
    if (contentResolver.isConfigured()) {
      output.log(`[evaluationRunner] Content: ${contentConfig.content_package_path}`);
    } else {
      output.warn('[evaluationRunner] Content path set but directory not found — using fallback curriculum');
    }
  }

  function resolveRunPlan(options) {
    const targetScenarios = resolveTargetScenarios(options);
    const { targetConfigs, overrides } = resolveTargetConfigurations(options);
    return { targetScenarios, targetConfigs, overrides };
  }

  function resolveTargetScenarios({ scenarios, scenarioFilter }) {
    const allScenarios = evalConfigLoader.listScenarios();
    let targetScenarios =
      scenarios === 'all' ? allScenarios : allScenarios.filter((scenario) => scenarios.includes(scenario.id));
    if (scenarioFilter) targetScenarios = applyScenarioFilter(targetScenarios, scenarioFilter);
    if (targetScenarios.length === 0) throw new Error('No scenarios to run');
    return targetScenarios;
  }

  function resolveTargetConfigurations(options) {
    let targetConfigs = selectConfigurations(options.configurations);
    const yamlOverrides = evalConfigLoader.getTutorModelOverrides();
    const overrides = resolveModelOverrides(options, yamlOverrides);
    targetConfigs = applyModelOverrides(targetConfigs, overrides);
    if (targetConfigs.length === 0) throw new Error('No configurations to test');
    return { targetConfigs, overrides };
  }

  function selectConfigurations(configurations) {
    if (configurations === 'all') return evalConfigLoader.listConfigurations();
    if (configurations === 'factorial') return FACTORIAL_CELLS.map(configurationForProfile);
    if (configurations === 'profiles') {
      return evalConfigLoader.listTutorProfiles().map((profile) => configurationForProfile(profile.name));
    }
    if (!Array.isArray(configurations)) return [];
    return configurations.map((configuration) =>
      typeof configuration === 'string' ? configurationForProfile(configuration) : configuration,
    );
  }

  function resolveModelOverrides(options, yamlOverrides) {
    return {
      modelOverride: options.modelOverride || yamlOverrides.modelOverride,
      tutorModelOverride: options.tutorModelOverride || null,
      egoModelOverride: options.egoModelOverride || yamlOverrides.egoModelOverride,
      superegoModelOverride: options.superegoModelOverride || yamlOverrides.superegoModelOverride,
      learnerModelOverride: options.learnerModelOverride || null,
      learnerEgoModelOverride: options.learnerEgoModelOverride || null,
      learnerSuperegoModelOverride: options.learnerSuperegoModelOverride || null,
      maxTokensOverride: options.maxTokensOverride || null,
    };
  }

  function applyModelOverrides(configurations, overrides) {
    let targetConfigs = configurations;
    for (const [key, value] of Object.entries(overrides)) {
      if (value) targetConfigs = targetConfigs.map((configuration) => ({ ...configuration, [key]: value }));
    }
    return targetConfigs;
  }

  function logPlan(log, options, plan) {
    log(`\nStarting evaluation:`);
    log(`  Scenarios: ${plan.targetScenarios.length}`);
    log(`  Configurations: ${plan.targetConfigs.length}`);
    log(`  Runs per config: ${options.runsPerConfig}`);
    log(`  Total tests: ${plan.targetScenarios.length * plan.targetConfigs.length * options.runsPerConfig}`);
  }

  function createRunContext(options, judge, plan) {
    const { targetConfigs, targetScenarios } = plan;
    const totalTests = targetScenarios.length * targetConfigs.length * options.runsPerConfig;
    const description =
      options.description || `Evaluation: ${targetConfigs.length} configs x ${targetScenarios.length} scenarios`;
    const run = evaluationStore.createRun({
      description,
      totalScenarios: targetScenarios.length,
      totalConfigurations: targetConfigs.length,
      metadata: buildRunMetadata(options, judge, plan),
    });
    evaluationStore.updateRun(run.id, { status: 'running', totalTests });

    const profileNames = targetConfigs.map(profileSummaryLabel);
    const scenarioNames = targetScenarios.map(scenarioName);
    const progressLogPath = getProgressLogPath(run.id);
    output.log(`\nRun ID: ${run.id} (use 'watch ${run.id}' to monitor)`);
    output.log(`Progress log: ${progressLogPath}\n`);

    const progressLogger = new ProgressLogger(run.id);
    const reporter = new StreamingReporter({
      totalTests,
      totalScenarios: targetScenarios.length,
      profiles: profileNames,
      scenarios: scenarioNames,
    });
    progressLogger.runStart({
      totalTests,
      totalScenarios: targetScenarios.length,
      totalConfigurations: targetConfigs.length,
      scenarios: scenarioNames,
      profiles: profileNames,
      description: options.description || run.description,
    });
    monitoringService.startSession(run.id, {
      userId: 'eval-runner',
      profileName: `${targetConfigs.length} configs`,
      modelId: 'evaluation-batch',
    });
    return { run, totalTests, profileNames, scenarioNames, progressLogPath, progressLogger, reporter };
  }

  function buildRunMetadata(options, judge, plan) {
    const { overrides } = plan;
    return {
      runsPerConfig: options.runsPerConfig,
      skipRubricEval: options.skipRubricEval,
      judgeOverride: options.judgeOverride || null,
      judgeCli: judge.effectiveCliJudge || null,
      judgeCliModel: judge.effectiveCliJudgeModel || null,
      modelOverride: overrides.modelOverride || null,
      tutorModelOverride: overrides.tutorModelOverride || null,
      egoModelOverride: overrides.egoModelOverride || null,
      superegoModelOverride: overrides.superegoModelOverride || null,
      learnerModelOverride: overrides.learnerModelOverride || null,
      learnerEgoModelOverride: overrides.learnerEgoModelOverride || null,
      learnerSuperegoModelOverride: overrides.learnerSuperegoModelOverride || null,
      threadNegotiationResolution: options.explicitThreadNegotiationResolution || null,
      maxTokensOverride: options.maxTokensOverride || null,
      dryRun: options.dryRun || false,
      scenarioIds: plan.targetScenarios.map((scenario) => scenario.id),
      profileNames: plan.targetConfigs.map((configuration) => configuration.profileName).filter(Boolean),
      scenariosFile: environment.EVAL_SCENARIOS_FILE || null,
      contentPath: environment.EVAL_CONTENT_PATH || null,
      packageVersion,
      gitCommit: getGitCommitHash(),
      claudeCliContextIsolation: CLAUDE_CLI_CONTEXT_ISOLATION,
      ...(options.admissionPlan ? { admissionPlan: JSON.parse(JSON.stringify(options.admissionPlan)) } : {}),
      pid: processId,
    };
  }

  function createExecutionState(options, judge, plan, runContext, liveApiReporter, log) {
    const scenarioProgress = new Map();
    for (const scenario of plan.targetScenarios) {
      scenarioProgress.set(scenario.id, {
        total: plan.targetConfigs.length * options.runsPerConfig,
        completed: 0,
        scores: [],
        scenarioName: scenarioName(scenario),
      });
    }
    const allTests = [];
    for (const scenario of plan.targetScenarios) {
      for (const config of plan.targetConfigs) {
        for (let runNum = 0; runNum < options.runsPerConfig; runNum++) {
          allTests.push({ config, scenario, runNum });
        }
      }
    }
    log(`\nRunning ${allTests.length} tests with parallelism=${options.parallelism}...\n`);
    return {
      ...runContext,
      ...plan,
      allTests,
      completedScenarios: 0,
      completedTests: 0,
      judge,
      liveApiReporter,
      log,
      options,
      results: [],
      runStartTime: now(),
      scenarioProgress,
    };
  }

  async function processQueue(queue, workerCount, processItem) {
    const items = [...queue];
    let index = 0;
    async function worker() {
      while (index < items.length) {
        const itemIndex = index++;
        await processItem(items[itemIndex]);
        await sleep(REQUEST_DELAY_MS);
      }
    }
    const workers = Array.from({ length: Math.min(workerCount, items.length) }, () => worker());
    await Promise.all(workers);
  }

  async function executeTest(state, { config, scenario, runNum }) {
    const profileName = testProfileLabel(config);
    const runTest = () => executeTestBody(state, { config, scenario, runNum, profileName });
    if (state.liveApiReporter) {
      await state.liveApiReporter.withConversation({ profileName, scenarioId: scenario.id }, runTest);
    } else {
      await runTest();
    }
  }

  async function executeTestBody(state, test) {
    const { config, scenario, runNum, profileName } = test;
    state.progressLogger.testStart({
      scenarioId: scenario.id,
      scenarioName: scenarioName(scenario),
      profileName,
    });
    try {
      const result = {
        ...(await runSingleTest(scenario, config, singleTestOptions(state, runNum))),
        attemptIndex: runNum,
      };
      recordSuccess(state, test, result);
    } catch (error) {
      recordFailure(state, test, error);
    }
  }

  function singleTestOptions(state, runNum) {
    const { options, judge, run, liveApiReporter } = state;
    return {
      skipRubricEval: options.skipRubricEval,
      verbose: options.verbose,
      judgeOverride: options.judgeOverride,
      judgeCli: judge.effectiveCliJudge,
      judgeCliModel: judge.effectiveCliJudgeModel,
      dryRun: options.dryRun,
      transcriptMode: options.transcriptMode,
      showMessages: options.showMessages,
      runId: run.id,
      runNum,
      liveApiReporter,
      learnerId: options.explicitLearnerId,
      threadNegotiationResolution: options.explicitThreadNegotiationResolution,
      externalEgoExtension: options.externalEgoExtension,
    };
  }

  function recordSuccess(state, test, result) {
    const { scenario, profileName } = test;
    evaluationStore.storeResult(state.run.id, result);
    state.results.push(result);
    state.completedTests += 1;
    state.progressLogger.testComplete({
      scenarioId: scenario.id,
      scenarioName: scenarioName(scenario),
      profileName,
      success: result.success,
      overallScore: result.tutorFirstTurnScore,
      baseScore: result.baseScore ?? null,
      recognitionScore: result.recognitionScore ?? null,
      latencyMs: result.latencyMs,
      completedCount: state.completedTests,
      totalTests: state.totalTests,
    });
    state.reporter.onTestComplete({ ...result, profileName, scenarioName: scenarioName(scenario) });
    state.log(
      `  ${formatProgress(state.completedTests, state.totalTests, state.runStartTime)} ${profileName} / ${scenario.id}: ${result.success ? `score=${result.tutorFirstTurnScore?.toFixed(1)}` : 'FAILED'}`,
    );
    monitoringService.recordEvent(state.run.id, {
      type: 'evaluation_test',
      inputTokens: result.inputTokens || 0,
      outputTokens: result.outputTokens || 0,
      latencyMs: result.latencyMs || 0,
      round: state.completedTests,
      approved: result.success,
    });
    recordScenarioProgress(state, scenario, result.tutorFirstTurnScore);
  }

  function recordFailure(state, test, error) {
    const { config, scenario, runNum, profileName } = test;
    state.completedTests += 1;
    state.log(
      `  ${formatProgress(state.completedTests, state.totalTests, state.runStartTime)} ${profileName} / ${scenario.id}: ERROR - ${error.message}`,
    );
    const errorMessage = error.message || '';
    if (!isTransientEvaluationError(errorMessage)) storePermanentFailure(state, { config, scenario, runNum }, error);
    else state.log(`  [SKIPPED] Transient error, not storing empty row (resumable): ${errorMessage.substring(0, 100)}`);

    state.progressLogger.testError({
      scenarioId: scenario.id,
      scenarioName: scenarioName(scenario),
      profileName,
      errorMessage: error.message,
      completedCount: state.completedTests,
      totalTests: state.totalTests,
    });
    state.reporter.onTestError({ scenarioName: scenarioName(scenario), profileName, errorMessage: error.message });
    monitoringService.recordEvent(state.run.id, {
      type: 'evaluation_error',
      round: state.completedTests,
      error: error.message,
    });
    recordScenarioProgress(state, scenario, null);
  }

  function storePermanentFailure(state, { config, scenario, runNum }, error) {
    const failedResult = {
      scenarioId: scenario.id,
      scenarioName: scenarioName(scenario),
      profileName: config.profileName,
      provider: config.provider || config.ego?.provider || 'unknown',
      model: config.model || config.ego?.model || 'unknown',
      egoModel: formatAgentModel(config.egoModel, config.ego),
      superegoModel: formatAgentModel(config.superegoModel, config.superego),
      factors: config.factors || null,
      learnerArchitecture: config.learnerArchitecture || null,
      attemptIndex: runNum,
      success: false,
      errorMessage: error.message,
    };
    try {
      evaluationStore.storeResult(state.run.id, failedResult);
      state.results.push(failedResult);
    } catch (storeError) {
      state.log(`  [WARNING] Failed to store error result: ${storeError.message}`);
    }
  }

  function recordScenarioProgress(state, scenario, score) {
    const progress = state.scenarioProgress.get(scenario.id);
    progress.completed += 1;
    if (score != null) progress.scores.push(score);
    if (progress.completed < progress.total) return;
    state.completedScenarios += 1;
    const avgScore =
      progress.scores.length > 0
        ? progress.scores.reduce((left, right) => left + right, 0) / progress.scores.length
        : null;
    const event = {
      scenarioId: scenario.id,
      scenarioName: progress.scenarioName,
      profileNames: state.profileNames,
      avgScore,
      completedScenarios: state.completedScenarios,
      totalScenarios: state.targetScenarios.length,
    };
    state.progressLogger.scenarioComplete(event);
    state.reporter.onScenarioComplete({
      scenarioName: event.scenarioName,
      avgScore,
      completedScenarios: event.completedScenarios,
      totalScenarios: event.totalScenarios,
    });
  }

  function finalizeRun(state) {
    setQuietMode(false);
    if (state.liveApiReporter) {
      state.liveApiReporter.uninstall();
      setLiveQuiet(false);
    }
    const durationMs = now() - state.runStartTime;
    const successfulTests = state.results.filter((result) => result.success).length;
    const failedTests = state.completedTests - successfulTests;
    const completion = { totalTests: state.completedTests, successfulTests, failedTests, durationMs };
    state.progressLogger.runComplete(completion);
    state.reporter.onRunComplete(completion);
    evaluationStore.updateRun(state.run.id, { status: 'completed', completedAt: currentIsoTimestamp() });
    monitoringService.endSession(state.run.id);
    return {
      runId: state.run.id,
      totalTests: state.totalTests,
      successfulTests,
      failedTests,
      stats: evaluationStore.getRunStats(state.run.id),
      scenarioStats: evaluationStore.getScenarioStats(state.run.id),
      progressLogPath: state.progressLogPath,
    };
  }

  return Object.freeze({ runEvaluation });
}

function normalizeRunOptions(options, defaultParallelism) {
  return {
    scenarios: 'all',
    configurations: 'all',
    runsPerConfig: 1,
    parallelism: defaultParallelism,
    skipRubricEval: false,
    judgeOverride: null,
    judgeCli: null,
    judgeCliModel: null,
    description: null,
    verbose: false,
    scenarioFilter: null,
    modelOverride: null,
    tutorModelOverride: null,
    egoModelOverride: null,
    superegoModelOverride: null,
    learnerModelOverride: null,
    learnerEgoModelOverride: null,
    learnerSuperegoModelOverride: null,
    dryRun: false,
    transcriptMode: false,
    maxTokensOverride: null,
    showMessages: false,
    liveApi: false,
    explicitLearnerId: options.learnerId ?? null,
    explicitThreadNegotiationResolution: options.threadNegotiationResolution ?? false,
    externalEgoExtension: null,
    admissionPlan: null,
    ...options,
  };
}

function resolveJudge(options, supportedJudgeClis, getDefaultCliJudgeModelOverride) {
  if (options.judgeOverride && options.judgeCli) throw new Error('Use either judgeOverride or judgeCli, not both');
  if (options.judgeCli && !supportedJudgeClis.has(String(options.judgeCli).toLowerCase())) {
    throw new Error(`Unsupported judge CLI: ${options.judgeCli}`);
  }
  const effectiveCliJudge = options.judgeCli ? String(options.judgeCli).toLowerCase() : null;
  return {
    effectiveCliJudge,
    effectiveCliJudgeModel: effectiveCliJudge
      ? options.judgeCliModel || getDefaultCliJudgeModelOverride(effectiveCliJudge)
      : null,
  };
}

function configurationForProfile(profileName) {
  return { provider: null, model: null, profileName, label: profileName };
}

function profileSummaryLabel(configuration) {
  return configuration.label || configuration.profileName || `${configuration.provider}/${configuration.model}`;
}

function testProfileLabel(configuration) {
  return configuration.label || configuration.profileName || '';
}

function scenarioName(scenario) {
  return scenario.name || scenario.id;
}

function formatAgentModel(primary, fallback) {
  if (primary) return `${primary.provider}.${primary.model}`;
  if (fallback) return `${fallback.provider}.${fallback.model}`;
  return null;
}
