/**
 * Finalize a completed multi-turn evaluation without owning the turn loop.
 */
export function createEvaluationMultiTurnCompletionRuntime(dependencies = {}) {
  const {
    TRACE_SCHEMA_VERSION,
    buildIdConstructionTraceFromTurnResults,
    chalk,
    createHash,
    deleteCheckpoint,
    dialogueTraceAnalyzer,
    evalConfigLoader,
    evaluationStore,
    evaluateSuggestionWithSelectedJudge,
    formatTranscript,
    fs,
    logsDir: LOGS_DIR,
    path,
    rubricEvaluator,
    turnComparisonAnalyzer,
  } = dependencies;

  async function completeMultiTurnEvaluation(state) {
    const {
      activeTutorRubricVersion,
      checkpointState,
      config,
      configHash,
      consolidatedTrace,
      conversationHistory,
      conversationMode,
      dialogueId,
      fullScenario,
      judgeCli,
      judgeCliModel,
      judgeOverride,
      learnerId,
      log,
      promptVersions,
      resolvedConfig,
      runId,
      runNum,
      scenario,
      skipRubricEval,
      totalApiCalls,
      totalCost,
      totalDeliberationRounds,
      totalInputTokens,
      totalLatencyMs,
      totalOutputTokens,
      transcriptMode,
      transcriptPath,
      turnResults,
    } = state;

    // Print closing separator for live chat transcript
    if (consolidatedTrace.length > 0) {
      console.log(chalk.dim('─'.repeat(60)));
    }

    // Multi-turn loop completed successfully — clean up checkpoint
    if (runId) {
      deleteCheckpoint(runId, scenario.id, config.profileName, runNum);
      // Legacy checkpoints predate attempt-aware filenames. When one was used
      // as the fallback for this attempt, remove that exact legacy file too.
      if (checkpointState && !Number.isInteger(checkpointState.attemptIndex)) {
        deleteCheckpoint(runId, scenario.id, config.profileName);
      }
    }

    // Clear turn progress from run metadata now that all turns are complete
    if (runId) {
      evaluationStore.updateRun(runId, {
        metadata: { turnProgress: null },
      });
    }

    // Write complete transcript file at end (for post-hoc viewing)
    if (transcriptMode && transcriptPath) {
      const fullTranscript = formatTranscript(consolidatedTrace, {
        detail: 'play',
        scenarioName: fullScenario.name || scenario.id,
        profileName: config.profileName,
        totalTurns: turnResults.length,
      });
      fs.writeFileSync(transcriptPath, fullTranscript);
      log(`[evaluationRunner] Transcript written: ${transcriptPath}`, 'info');
    }

    // 5. Aggregate scores across turns
    const validTurnScores = turnResults.map((turn) => turn.turnScore).filter((score) => Number.isFinite(score));
    const tutorFirstTurnScore =
      validTurnScores.length > 0 ? validTurnScores.reduce((sum, s) => sum + s, 0) / validTurnScores.length : null;

    // Aggregate per-dimension scores across turns, using YAML-driven dimension keys
    const allDimKeys = Object.keys(evalConfigLoader.getRubricDimensions());
    const aggregateDimensions = {};
    for (const dim of allDimKeys) {
      const dimScores = turnResults.map((turn) => turn.scores?.[dim]).filter((score) => Number.isFinite(score));
      if (dimScores.length > 0) {
        aggregateDimensions[dim] = dimScores.reduce((sum, s) => sum + s, 0) / dimScores.length;
      }
    }

    const baseScore = rubricEvaluator.calculateBaseScore(aggregateDimensions);
    const recognitionScore = rubricEvaluator.calculateRecognitionScore(aggregateDimensions);

    const allTurnsPassed = turnResults.every((t) => {
      if (!Number.isFinite(t.turnScore)) return false;
      const threshold = t.minAcceptableScore || fullScenario.min_acceptable_score || 0;
      return t.turnScore >= threshold;
    });

    // 5b. Holistic dialogue evaluation — score the full transcript as a single unit
    let holisticDialogueScore = null;
    if (!skipRubricEval && consolidatedTrace.length > 0 && turnResults.length > 1) {
      log('[evaluationRunner] Running holistic dialogue evaluation on full transcript...', 'info');
      try {
        // Use the last turn's suggestion as the focal point, with full dialogue context
        const lastSuggestion = turnResults[turnResults.length - 1]?.suggestion;
        if (lastSuggestion) {
          const holisticResult = await evaluateSuggestionWithSelectedJudge(
            lastSuggestion,
            {
              name: `${fullScenario.name} (holistic dialogue)`,
              description: `Holistic evaluation of ${turnResults.length}-turn dialogue. Score the overall quality of the tutoring interaction, not just this final response.`,
              expectedBehavior: fullScenario.expected_behavior,
              learnerContext: fullScenario.learner_context,
              requiredElements: fullScenario.required_elements || [],
              forbiddenElements: fullScenario.forbidden_elements || [],
            },
            {
              dialogueContext: {
                conversationHistory,
                consolidatedTrace,
              },
            },
            { judgeOverride, judgeCli, judgeCliModel },
          );

          if (holisticResult?.success) {
            holisticDialogueScore = {
              overallScore: holisticResult.overallScore,
              baseScore: holisticResult.baseScore,
              recognitionScore: holisticResult.recognitionScore,
              scores: holisticResult.scores,
              summary: holisticResult.summary,
              judgeModel: holisticResult.judgeModel,
            };
            log(`[evaluationRunner] Holistic dialogue score: ${holisticResult.overallScore?.toFixed(1)}`, 'success');
          } else {
            log(
              `[evaluationRunner] Holistic dialogue evaluation failed: ${holisticResult?.error || 'unknown'}`,
              'warning',
            );
          }
        }
      } catch (error) {
        log(`[evaluationRunner] Holistic dialogue evaluation error: ${error.message}`, 'warning');
      }
    }

    // 5c. Analyze bilateral transformation (tutor + learner evolution)
    const turnProgressionAnalysis = turnComparisonAnalyzer.analyzeTurnProgression(turnResults, {
      rubricVersion: activeTutorRubricVersion,
    });
    const markerDefinitions = fullScenario.transformation_markers || fullScenario.transformationMarkers || null;
    const transformationMarkerAnalysis = markerDefinitions
      ? turnComparisonAnalyzer.analyzeTransformationMarkers(turnResults, markerDefinitions)
      : null;
    const dialogueTraceReport = dialogueTraceAnalyzer.generateTransformationReport(consolidatedTrace, turnResults);

    log(`[evaluationRunner] Bilateral transformation analysis:`, 'info');
    log(`  - Tutor adaptation index: ${turnProgressionAnalysis.adaptationIndex?.toFixed(2) ?? 'N/A'}`, 'info');
    log(`  - Learner growth index: ${turnProgressionAnalysis.learnerGrowthIndex?.toFixed(2) ?? 'N/A'}`, 'info');
    log(`  - Bilateral balance: ${dialogueTraceReport.bilateralMetrics.bilateralBalance?.toFixed(2) ?? 'N/A'}`, 'info');
    if (dialogueTraceReport.bilateralMetrics.summary) {
      log(`  - ${dialogueTraceReport.bilateralMetrics.summary}`, 'info');
    }

    const transcriptTurns = turnResults.map((t, idx) => ({
      turnIndex: Number.isInteger(t.turnIndex) ? t.turnIndex : idx,
      turnId: t.turnId,
      suggestion: t.suggestion || t.suggestions?.[0] || null,
      suggestions: t.suggestion ? [t.suggestion] : t.suggestions || [],
      learnerAction: t.learnerAction,
      learnerMessage: t.learnerMessage,
    }));
    const transcripts = rubricEvaluator.buildTranscriptArtifacts({
      turns: transcriptTurns,
      dialogueTrace: consolidatedTrace,
      learnerContext: fullScenario.learner_context,
    });

    // 6. Write consolidated dialogue log
    const consolidatedDialogue = {
      traceSchemaVersion: TRACE_SCHEMA_VERSION,
      tutorRubricVersion: activeTutorRubricVersion,
      suggestions: turnResults[turnResults.length - 1]?.suggestion
        ? [turnResults[turnResults.length - 1].suggestion]
        : [],
      dialogueTrace: consolidatedTrace,
      converged: false,
      rounds: totalDeliberationRounds,
      conversationTurns: turnResults.length,
      metrics: {
        totalLatencyMs,
        totalInputTokens,
        totalOutputTokens,
        totalCost,
        apiCalls: totalApiCalls,
      },
      dialogueId,
      profileName: resolvedConfig.profileName,
      provider: resolvedConfig.provider,
      model: resolvedConfig.model,
      learnerContext: fullScenario.learner_context,
      isMultiTurn: true,
      learnerArchitecture: resolvedConfig.learnerArchitecture || 'unified',
      transcripts,
      totalTurns: turnResults.length,
      turnResults: turnResults.map((t) => {
        const turnContent = JSON.stringify({
          turnIndex: t.turnIndex,
          suggestion: t.suggestion ? [t.suggestion] : [],
          turnId: t.turnId,
        });
        const contentTurnId = createHash('sha256')
          .update(dialogueId + ':' + t.turnIndex + ':' + turnContent)
          .digest('hex')
          .slice(0, 16);
        return {
          turnIndex: t.turnIndex,
          turnId: t.turnId,
          contentTurnId,
          suggestions: t.suggestion ? [t.suggestion] : [],
          learnerAction: t.learnerAction,
          learnerMessage: t.learnerMessage,
          learnerMessageGenerated: t.learnerMessageGenerated,
          learnerResistanceSignalGate: t.learnerResistanceSignalGate,
        };
      }),
      // Conversation mode audit trail
      conversationMode,
      conversationHistory,
      // Holistic dialogue evaluation
      holisticDialogueScore,
      // Bilateral transformation analysis
      transformationAnalysis: {
        turnProgression: turnProgressionAnalysis,
        markerAnalysis: transformationMarkerAnalysis,
        dialogueTraceReport: dialogueTraceReport,
      },
    };

    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    const logContent = JSON.stringify(consolidatedDialogue, null, 2);
    const dialogueContentHash = createHash('sha256').update(logContent).digest('hex');

    // Phase 3a: Content-addressable log storage
    // Hash-named file = immutable evidence snapshot (write-once)
    // DialogueId-named file = working copy (may be updated with holistic scores later)
    const hashPath = path.join(LOGS_DIR, `${dialogueContentHash}.json`);
    const dialoguePath = path.join(LOGS_DIR, `${dialogueId}.json`);
    fs.writeFileSync(hashPath, logContent);
    fs.writeFileSync(dialoguePath, logContent);

    log(
      `[evaluationRunner] Multi-turn complete: ${turnResults.length} turns, avgScore=${tutorFirstTurnScore?.toFixed(1)}`,
    );

    // Aggregate requiredMissing/forbiddenFound from all turns
    const requiredMissing = [...new Set(turnResults.flatMap((t) => t.requiredMissing || []))];
    const forbiddenFound = [...new Set(turnResults.flatMap((t) => t.forbiddenFound || []))];

    // 7. Return result
    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      scenarioType: fullScenario.type || 'suggestion',
      isMultiTurn: true,
      totalTurns: turnResults.length,
      provider: resolvedConfig.provider,
      model: resolvedConfig.model,
      profileName: config.profileName,
      egoModel: resolvedConfig.egoModel ? `${resolvedConfig.egoModel.provider}.${resolvedConfig.egoModel.model}` : null,
      superegoModel: resolvedConfig.superegoModel
        ? `${resolvedConfig.superegoModel.provider}.${resolvedConfig.superegoModel.model}`
        : null,
      hyperparameters: resolvedConfig.hyperparameters || config.hyperparameters,
      suggestions: turnResults.map((t) => t.suggestion).filter(Boolean),
      success: true,
      latencyMs: totalLatencyMs,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      apiCalls: totalApiCalls,
      cost: totalCost,
      dialogueId,
      dialogueRounds: turnResults.length,
      deliberationRounds: totalDeliberationRounds,
      idConstructionTrace: buildIdConstructionTraceFromTurnResults(turnResults),
      scores: Object.keys(aggregateDimensions).length > 0 ? aggregateDimensions : null,
      scoresWithReasoning:
        Object.keys(aggregateDimensions).length > 0
          ? Object.fromEntries(
              Object.entries(aggregateDimensions).map(([key, value]) => [key, { score: value, reasoning: null }]),
            )
          : null,
      tutorFirstTurnScore,
      scoringMethod: turnResults.some((t) => t.scoringMethod === 'judge_failed')
        ? 'partial_judge_failure'
        : turnResults.every((t) => t.scoringMethod === 'rubric')
          ? 'rubric'
          : 'mixed',
      baseScore,
      recognitionScore,
      turnResults,
      allTurnsPassed,
      passesRequired: turnResults.every((t) => t.passesRequired),
      passesForbidden: turnResults.every((t) => t.passesForbidden),
      requiredMissing,
      forbiddenFound,
      judgeModel: turnResults.find((turn) => turn.judgeModel)?.judgeModel || holisticDialogueScore?.judgeModel || null,
      evaluationReasoning:
        holisticDialogueScore?.summary ||
        turnResults.find((turn) => turn.evaluationReasoning)?.evaluationReasoning ||
        null,
      factors: resolvedConfig.factors || null,
      learnerArchitecture: resolvedConfig.learnerArchitecture || null,
      learnerId,
      conversationMode,
      dialogueContentHash,
      configHash,
      ...promptVersions,
      // Holistic dialogue evaluation (full transcript scored as single unit)
      holisticDialogueScore,
      // Bilateral transformation metrics
      transformationMetrics: {
        tutorAdaptationIndex: turnProgressionAnalysis.adaptationIndex,
        learnerGrowthIndex: turnProgressionAnalysis.learnerGrowthIndex,
        bilateralTransformationIndex: turnProgressionAnalysis.bilateralTransformationIndex,
        framingEvolution: turnProgressionAnalysis.framingEvolution,
        dimensionConvergence: turnProgressionAnalysis.dimensionConvergence,
        markerAnalysis: transformationMarkerAnalysis,
        bilateralMetrics: dialogueTraceReport.bilateralMetrics,
        superegoMetrics: dialogueTraceReport.superegoMetrics,
        transformationQuality: dialogueTraceReport.overallAssessment?.transformationQuality ?? null,
      },
    };
  }

  return { completeMultiTurnEvaluation };
}
