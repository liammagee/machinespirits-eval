/**
 * Resume orchestration behind evaluationRunner compatibility facade.
 */
export function createEvaluationResumeRuntime(dependencies = {}) {
  const {
    DEFAULT_PARALLELISM,
    ProgressLogger,
    REQUEST_DELAY_MS,
    StreamingReporter,
    contentResolver,
    evalConfigLoader,
    evaluationStore,
    formatProgress,
    getProgressLogPath,
    isPidAlive,
    isTransientEvaluationError,
    listCheckpoints,
    monitoringService,
    runSingleTest,
    setQuietMode,
    sleep,
  } = dependencies;

  async function resumeEvaluation(options = {}) {
    const {
      runId,
      parallelism = DEFAULT_PARALLELISM,
      verbose = false,
      force = false, // Skip the "already running" check
    } = options;

    const log = verbose ? console.log : () => {};

    // 1. Load the run and validate it exists
    const run = evaluationStore.getRun(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    // 1b. Check if another process is already running this evaluation
    const existingPid = run.metadata?.pid;
    if (existingPid && existingPid !== process.pid && !force) {
      const isAlive = isPidAlive(existingPid);
      if (isAlive) {
        throw new Error(
          `Run ${runId} is already being processed by pid ${existingPid}. ` +
            `Use --force to override (may cause duplicates).`,
        );
      }
    }

    // 2. Extract metadata
    const metadata = run.metadata || {};
    const runsPerConfig = metadata.runsPerConfig || 1;
    const skipRubricEval = metadata.skipRubricEval || false;
    const dryRun = metadata.dryRun || false;
    const modelOverride = metadata.modelOverride || null;
    const tutorModelOverride = metadata.tutorModelOverride || null;
    const egoModelOverride = metadata.egoModelOverride || null;
    const superegoModelOverride = metadata.superegoModelOverride || null;
    const learnerModelOverride = metadata.learnerModelOverride || null;
    const learnerEgoModelOverride = metadata.learnerEgoModelOverride || null;
    const learnerSuperegoModelOverride = metadata.learnerSuperegoModelOverride || null;
    // A5: run-wide threading arm (set once at `run` time, see runEvaluation's metadata
    // block below). Re-applied per test below so a test resumed from scratch (no
    // checkpoint yet written, e.g. killed before its first turn completed) still gets
    // the correct arm instead of silently falling back to threading-off. Any
    // already-checkpointed test overrides this with its own checkpointed value
    // (see the cs?.threadNegotiationResolution ?? ... precedence in runMultiTurnTest).
    const threadNegotiationResolution = metadata.threadNegotiationResolution || null;

    // 3. Get existing results for completion checking
    const existingResults = evaluationStore.getResults(runId);

    // 4. Reconstruct scenarios - prefer metadata (complete list), fall back to inferring from results
    const allScenarios = evalConfigLoader.listScenarios();
    let scenarioIds;
    if (metadata.scenarioIds && metadata.scenarioIds.length > 0) {
      // Use stored scenario list (includes scenarios that haven't started yet)
      scenarioIds = metadata.scenarioIds;
    } else {
      // Legacy: infer from existing results (may miss unstarted scenarios)
      scenarioIds = [...new Set(existingResults.map((r) => r.scenarioId).filter(Boolean))];
    }
    const targetScenarios = allScenarios.filter((s) => scenarioIds.includes(s.id));

    if (targetScenarios.length === 0) {
      throw new Error(`No matching scenarios found for run ${runId}`);
    }

    // 5. Reconstruct profiles - prefer metadata, fall back to inferring from results
    let profileNames;
    if (metadata.profileNames && metadata.profileNames.length > 0) {
      // Use stored profile list
      profileNames = metadata.profileNames;
    } else {
      // Legacy: infer from existing results
      profileNames = [...new Set(existingResults.map((r) => r.profileName).filter(Boolean))];
    }

    if (profileNames.length === 0) {
      throw new Error(`No profiles found for run ${runId} — cannot determine what to resume`);
    }

    let targetConfigs = profileNames.map((name) => ({
      provider: null,
      model: null,
      profileName: name,
      label: name,
    }));

    // 6. Re-apply model overrides if present in metadata
    if (modelOverride) {
      targetConfigs = targetConfigs.map((c) => ({ ...c, modelOverride }));
    }
    if (tutorModelOverride) {
      targetConfigs = targetConfigs.map((c) => ({ ...c, tutorModelOverride }));
    }
    if (egoModelOverride) {
      targetConfigs = targetConfigs.map((c) => ({ ...c, egoModelOverride }));
    }
    if (superegoModelOverride) {
      targetConfigs = targetConfigs.map((c) => ({ ...c, superegoModelOverride }));
    }
    if (learnerModelOverride) {
      targetConfigs = targetConfigs.map((c) => ({ ...c, learnerModelOverride }));
    }
    if (learnerEgoModelOverride) {
      targetConfigs = targetConfigs.map((c) => ({ ...c, learnerEgoModelOverride }));
    }
    if (learnerSuperegoModelOverride) {
      targetConfigs = targetConfigs.map((c) => ({ ...c, learnerSuperegoModelOverride }));
    }

    // 6. Resolve missing repetitions through the store's attempt-aware contract.
    // Rejudgments share a generation identity and cannot satisfy extra attempts.
    const incomplete = evaluationStore.getIncompleteTests(runId, profileNames, targetScenarios, { runsPerConfig });
    const configByName = new Map(targetConfigs.map((config) => [config.profileName, config]));
    const scenarioById = new Map(targetScenarios.map((scenario) => [scenario.id, scenario]));
    const remainingTests = incomplete.remainingTests.map((test) => ({
      config: configByName.get(test.profile),
      scenario: scenarioById.get(test.scenarioId),
      runNum: test.attemptIndex,
    }));

    // Scan for mid-dialogue checkpoints
    const checkpoints = listCheckpoints(runId);
    let checkpointCount = 0;
    if (checkpoints.length > 0) {
      const checkpointMap = new Map();
      for (const cp of checkpoints) {
        const pair = `${cp.profileName}:${cp.scenarioId}`;
        const key = Number.isInteger(cp.attemptIndex) ? `${pair}:${cp.attemptIndex}` : pair;
        checkpointMap.set(key, cp);
      }
      for (const test of remainingTests) {
        const pair = `${test.config.profileName}:${test.scenario.id}`;
        const exactKey = `${pair}:${test.runNum}`;
        const cp = checkpointMap.get(exactKey) || checkpointMap.get(pair);
        if (cp) {
          test.checkpointState = cp;
          checkpointMap.delete(exactKey);
          checkpointMap.delete(pair);
          checkpointCount++;
        }
      }
    }

    if (remainingTests.length === 0) {
      console.log(`\nRun ${runId}: all tests completed (${runsPerConfig} reps each). Nothing to resume.`);
      return {
        runId,
        totalTests: 0,
        successfulTests: 0,
        stats: evaluationStore.getRunStats(runId),
        scenarioStats: evaluationStore.getScenarioStats(runId),
        progressLogPath: getProgressLogPath(runId),
        resumed: true,
        alreadyComplete: true,
      };
    }

    // 7. Set run status to 'running' and update PID
    evaluationStore.updateRun(runId, { status: 'running', metadata: { pid: process.pid } });

    const totalRemainingTests = remainingTests.length;
    const _totalExpectedTests = targetScenarios.length * targetConfigs.length * runsPerConfig;

    console.log(`\nResuming run: ${runId}`);
    console.log(`  Previously completed: ${existingResults.length} tests`);
    console.log(`  Remaining: ${totalRemainingTests} tests`);
    if (checkpointCount > 0) console.log(`  Mid-dialogue checkpoints: ${checkpointCount} (will resume mid-turn)`);
    console.log(`  Profiles: ${profileNames.join(', ')}`);
    console.log(`  Scenarios: ${targetScenarios.length}`);
    if (modelOverride) console.log(`  Model override: ${modelOverride}`);
    if (tutorModelOverride) console.log(`  Tutor model override: ${tutorModelOverride}`);
    if (egoModelOverride) console.log(`  Ego model override: ${egoModelOverride}`);
    if (superegoModelOverride) console.log(`  Superego model override: ${superegoModelOverride}`);
    if (learnerModelOverride) console.log(`  Learner model override: ${learnerModelOverride}`);
    if (learnerEgoModelOverride) console.log(`  Learner ego model override: ${learnerEgoModelOverride}`);
    if (learnerSuperegoModelOverride) console.log(`  Learner superego model override: ${learnerSuperegoModelOverride}`);

    // Initialize content resolver (same as runEvaluation)
    const contentConfig = evalConfigLoader.getContentConfig();
    if (contentConfig?.content_package_path) {
      contentResolver.configure({
        contentPackagePath: contentConfig.content_package_path,
        maxLectureChars: contentConfig.max_lecture_chars,
        includeSpeakerNotes: contentConfig.include_speaker_notes,
      });
    }

    // 8. Set up progress logger and streaming reporter (appends to existing JSONL)
    const progressLogPath = getProgressLogPath(runId);
    console.log(`Progress log: ${progressLogPath}\n`);

    const progressLogger = new ProgressLogger(runId);
    const scenarioNames = targetScenarios.map((s) => s.name || s.id);
    const reporter = new StreamingReporter({
      totalTests: totalRemainingTests,
      totalScenarios: targetScenarios.length,
      profiles: profileNames,
      scenarios: scenarioNames,
    });

    progressLogger.runStart({
      totalTests: totalRemainingTests,
      totalScenarios: targetScenarios.length,
      totalConfigurations: targetConfigs.length,
      scenarios: scenarioNames,
      profiles: profileNames,
      description: `Resumed: ${totalRemainingTests} remaining tests`,
    });

    // Register with monitoring
    monitoringService.startSession(runId, {
      userId: 'eval-runner-resume',
      profileName: `${targetConfigs.length} configs`,
      modelId: 'evaluation-batch',
    });

    const results = [];
    let completedTests = 0;

    // Scenario completion tracking
    const scenarioProgress = new Map();
    for (const scenario of targetScenarios) {
      const testsForScenario = remainingTests.filter((t) => t.scenario.id === scenario.id).length;
      scenarioProgress.set(scenario.id, {
        total: testsForScenario,
        completed: 0,
        scores: [],
        scenarioName: scenario.name || scenario.id,
      });
    }
    let completedScenarios = 0;

    // 9. Reuse the same parallel worker pool pattern
    async function processQueue(queue, workerCount, processItem) {
      const items = [...queue];
      let index = 0;

      async function worker() {
        while (index < items.length) {
          const i = index++;
          await processItem(items[i]);
          await sleep(REQUEST_DELAY_MS);
        }
      }

      const workers = Array.from({ length: Math.min(workerCount, items.length) }, () => worker());
      await Promise.all(workers);
    }

    // Suppress tutor-core verbose dialogue output during eval runs
    setQuietMode(true);

    log(`\nRunning ${totalRemainingTests} remaining tests with parallelism=${parallelism}...\n`);

    const runStartTime = Date.now();

    await processQueue(remainingTests, parallelism, async ({ config, scenario, runNum, checkpointState }) => {
      const profileLabel = config.label || config.profileName || '';

      progressLogger.testStart({
        scenarioId: scenario.id,
        scenarioName: scenario.name || scenario.id,
        profileName: profileLabel,
      });

      try {
        const result = {
          ...(await runSingleTest(scenario, config, {
            skipRubricEval,
            dryRun,
            verbose,
            runId,
            runNum,
            checkpointState: checkpointState || null,
            threadNegotiationResolution: threadNegotiationResolution ?? false, // A5: resume-safety (see metadata extraction above)
          })),
          attemptIndex: runNum,
        };

        evaluationStore.storeResult(runId, result);
        results.push(result);
        completedTests++;

        progressLogger.testComplete({
          scenarioId: scenario.id,
          scenarioName: scenario.name || scenario.id,
          profileName: profileLabel,
          success: result.success,
          overallScore: result.tutorFirstTurnScore,
          baseScore: result.baseScore ?? null,
          recognitionScore: result.recognitionScore ?? null,
          latencyMs: result.latencyMs,
          completedCount: completedTests,
          totalTests: totalRemainingTests,
        });

        reporter.onTestComplete({
          ...result,
          profileName: profileLabel,
          scenarioName: scenario.name || scenario.id,
        });

        log(
          `  ${formatProgress(completedTests, totalRemainingTests, runStartTime)} ${profileLabel} / ${scenario.id}: ${result.success ? `score=${result.tutorFirstTurnScore?.toFixed(1)}` : 'FAILED'}`,
        );

        monitoringService.recordEvent(runId, {
          type: 'evaluation_test',
          inputTokens: result.inputTokens || 0,
          outputTokens: result.outputTokens || 0,
          latencyMs: result.latencyMs || 0,
          round: completedTests,
          approved: result.success,
        });

        // Track scenario completion
        const sp = scenarioProgress.get(scenario.id);
        sp.completed++;
        if (result.tutorFirstTurnScore != null) sp.scores.push(result.tutorFirstTurnScore);
        if (sp.completed >= sp.total) {
          completedScenarios++;
          const avgScore = sp.scores.length > 0 ? sp.scores.reduce((a, b) => a + b, 0) / sp.scores.length : null;
          progressLogger.scenarioComplete({
            scenarioId: scenario.id,
            scenarioName: sp.scenarioName,
            profileNames,
            avgScore,
            completedScenarios,
            totalScenarios: targetScenarios.length,
          });
          reporter.onScenarioComplete({
            scenarioName: sp.scenarioName,
            avgScore,
            completedScenarios,
            totalScenarios: targetScenarios.length,
          });
        }
      } catch (error) {
        completedTests++;
        log(
          `  ${formatProgress(completedTests, totalRemainingTests, runStartTime)} ${profileLabel} / ${scenario.id}: ERROR - ${error.message}`,
        );

        // Only store failed results for permanent errors — skip transient/retriable ones
        const errMsg = error.message || '';
        const isTransient = isTransientEvaluationError(errMsg);

        if (!isTransient) {
          const failedResult = {
            scenarioId: scenario.id,
            scenarioName: scenario.name || scenario.id,
            profileName: config.profileName,
            provider: config.provider || config.ego?.provider || 'unknown',
            model: config.model || config.ego?.model || 'unknown',
            egoModel: config.egoModel
              ? `${config.egoModel.provider}.${config.egoModel.model}`
              : config.ego
                ? `${config.ego.provider}.${config.ego.model}`
                : null,
            superegoModel: config.superegoModel
              ? `${config.superegoModel.provider}.${config.superegoModel.model}`
              : config.superego
                ? `${config.superego.provider}.${config.superego.model}`
                : null,
            factors: config.factors || null,
            learnerArchitecture: config.learnerArchitecture || null,
            attemptIndex: runNum,
            success: false,
            errorMessage: error.message,
          };
          try {
            evaluationStore.storeResult(runId, failedResult);
            results.push(failedResult);
          } catch (storeErr) {
            log(`  [WARNING] Failed to store error result: ${storeErr.message}`);
          }
        } else {
          log(`  [SKIPPED] Transient error, not storing empty row (resumable): ${errMsg.substring(0, 100)}`);
        }

        progressLogger.testError({
          scenarioId: scenario.id,
          scenarioName: scenario.name || scenario.id,
          profileName: profileLabel,
          errorMessage: error.message,
          completedCount: completedTests,
          totalTests: totalRemainingTests,
        });

        reporter.onTestError({
          scenarioName: scenario.name || scenario.id,
          profileName: profileLabel,
          errorMessage: error.message,
        });

        monitoringService.recordEvent(runId, {
          type: 'evaluation_error',
          round: completedTests,
          error: error.message,
        });

        // Track scenario completion even on error
        const sp = scenarioProgress.get(scenario.id);
        sp.completed++;
        if (sp.completed >= sp.total) {
          completedScenarios++;
          const avgScore = sp.scores.length > 0 ? sp.scores.reduce((a, b) => a + b, 0) / sp.scores.length : null;
          progressLogger.scenarioComplete({
            scenarioId: scenario.id,
            scenarioName: sp.scenarioName,
            profileNames,
            avgScore,
            completedScenarios,
            totalScenarios: targetScenarios.length,
          });
          reporter.onScenarioComplete({
            scenarioName: sp.scenarioName,
            avgScore,
            completedScenarios,
            totalScenarios: targetScenarios.length,
          });
        }
      }
    });

    // Restore tutor-core output
    setQuietMode(false);

    const durationMs = Date.now() - runStartTime;
    const successfulTests = results.filter((r) => r.success).length;
    const failedTests = completedTests - successfulTests;

    progressLogger.runComplete({ totalTests: completedTests, successfulTests, failedTests, durationMs });
    reporter.onRunComplete({ totalTests: completedTests, successfulTests, failedTests, durationMs });

    // 10. Mark run as completed (keep original totalTests to show expected vs actual)
    const allResults = evaluationStore.getResults(runId);
    evaluationStore.updateRun(runId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
    });

    monitoringService.endSession(runId);

    const stats = evaluationStore.getRunStats(runId);
    const scenarioStats = evaluationStore.getScenarioStats(runId);

    return {
      runId,
      totalTests: run.totalTests,
      completedTests: allResults.length,
      successfulTests,
      failedTests: allResults.filter((r) => !r.success).length,
      resumedTests: totalRemainingTests,
      stats,
      scenarioStats,
      progressLogPath,
      resumed: true,
    };
  }

  return { resumeEvaluation };
}
