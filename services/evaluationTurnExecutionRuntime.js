/**
 * Shared generation and single-test execution behind evaluationRunner's
 * compatibility facade.
 */
export function createEvaluationTurnExecutionRuntime(dependencies = {}) {
  const {
    attachApiPayloadsToTrace,
    buildIdConstructionTraceFromTurnResults,
    captureApiCalls,
    collectPromptVersions,
    computeConfigHash,
    contentResolver,
    debugLog,
    evalConfigLoader,
    evaluateSuggestionWithSelectedJudge,
    flattenNumericScores,
    formatApiMessages,
    idDirectorEngine,
    memoryDynamicsService,
    mockGenerateResult,
    mockJudgeResult,
    resolveConfigModels,
    resolveEvalProfile,
    retryWithBackoff,
    rubricEvaluator,
    structureLearnerContext,
    tutorApi,
  } = dependencies;

  // Shared generation + evaluation helper
  // ---------------------------------------------------------------------------

  /**
   * Generate a tutor suggestion and evaluate it with the rubric.
   *
   * This is the single code path used by BOTH single-turn and multi-turn
   * evaluations. It encapsulates:
   *   1. retryWithBackoff → tutorApi.generateSuggestions
   *   2. rubricEvaluator.quickValidate
   *   3. rubricEvaluator.evaluateSuggestion (unless skipped)
   *
   * @param {Object} context - The learner context object (from tutorApi.buildContext)
   * @param {Object} resolvedConfig - Resolved config with provider, model, egoModel, etc.
   * @param {Object} turnMeta - Turn-level metadata for evaluation
   * @param {string} turnMeta.scenarioName - Human-readable scenario name
   * @param {string} turnMeta.description - Description for the rubric judge
   * @param {string} turnMeta.expectedBehavior - Expected tutor behavior
   * @param {string} turnMeta.learnerContext - Raw learner context string (for rubric)
   * @param {string[]} turnMeta.requiredElements - Required elements for validation
   * @param {string[]} turnMeta.forbiddenElements - Forbidden elements for validation
   * @param {Object} options - Evaluation options
   * @param {boolean} options.skipRubricEval
   * @param {string} options.outputSize
   * @param {string} options.superegoStrategy
   * @param {string} options.judgeOverride
   * @param {string} options.judgeCli
   * @param {string} options.judgeCliModel
   * @param {boolean} options.useDialogue
   * @param {number} options.maxRounds
   * @param {Function} options.log
   * @param {string} options.scenarioId - Used for debug logging
   * @returns {Promise<Object>} { genResult, suggestion, validation, rubricResult, turnScore }
   */
  async function generateAndEvaluateTurn(context, resolvedConfig, turnMeta, options = {}) {
    const {
      skipRubricEval = false,
      outputSize = 'normal',
      superegoStrategy = null,
      judgeOverride = null,
      judgeCli = null,
      judgeCliModel = null,
      useDialogue = false,
      maxRounds = 0,
      log = () => {},
      scenarioId = '',
      systemPromptExtension = null,
      superegoPromptExtension = null, // Dynamic disposition adjustments for superego
      learnerId = null, // For Writing Pad memory persistence
      dialecticalNegotiation = false, // Phase 2: AI-powered dialectical struggle
      threadNegotiationResolution = false, // A5: carry negotiated resolution into the delivered suggestion across revision rounds
      behavioralOverrides = null, // Quantitative params from superego self-reflection
      dryRun = false,
      captureApiPayloads = process.env.EVAL_CAPTURE_API_PAYLOADS !== 'false',
      conversationMode = 'single-prompt', // 'messages' for multi-turn message chains
      internalHistory = null, // Optional bounded ego/superego history as chat-style messages
      showMessages = false, // true for truncated, 'full' for untruncated API message display
    } = options;

    // Dry-run mode: return canned results without any API calls
    if (dryRun) {
      log('[dry-run] Generating mock suggestions (no API call)', 'info');
      const genResult = mockGenerateResult(resolvedConfig, turnMeta);
      const suggestion = genResult.suggestions?.[0];
      const validation = suggestion
        ? rubricEvaluator.quickValidate(suggestion, {
            requiredElements: turnMeta.requiredElements,
            requiredElementsAny: turnMeta.requiredElementsAny,
            forbiddenElements: turnMeta.forbiddenElements,
          })
        : { passesRequired: false, passesForbidden: true, requiredMissing: ['No suggestions generated'] };

      let rubricResult = null;
      let turnScore = null;
      let scoringMethod = 'skipped';
      if (!skipRubricEval && suggestion) {
        log('[dry-run] Generating mock judge scores (no API call)', 'info');
        // Seed must be stable across invocations so dry-runs are reproducible;
        // scenarioName embeds the turn index, keeping per-turn scores distinct.
        rubricResult = mockJudgeResult(resolvedConfig, `${scenarioId}:${turnMeta.scenarioName || ''}`);
        turnScore = rubricResult.overallScore;
        scoringMethod = 'rubric';
      }

      return { genResult, suggestion, validation, rubricResult, turnScore, scoringMethod };
    }

    // ── Id-director cells (cell 101/102): bypass tutor-core's generateSuggestions ──
    // tutor-core's profile registry doesn't know cell 101/102 — it would remap
    // them to a generic 'budget' profile (resolveEvalProfile, see line 215).
    // For cells with factors.id_director:true we route through the eval-repo
    // engine instead, which calls a back-stage "id" agent to author a fresh
    // ego system prompt each turn, then runs the ego against that prompt.
    // Returns the same result shape as tutorApi.generateSuggestions so the rest
    // of this function is unchanged.
    let idDirectorEvalProfile = null;
    // Look up by evalCellProfileName (preserved original) — resolvedConfig.profileName
    // has already been remapped to a tutor-core profile (e.g. 'budget') and won't
    // resolve in eval-repo's tutor-agents.yaml.
    const evalCellProfileName = resolvedConfig.evalCellProfileName || resolvedConfig.profileName;
    try {
      idDirectorEvalProfile = evalConfigLoader.getTutorProfile(evalCellProfileName);
    } catch {
      /* not an eval cell — fall through to default path */
    }
    const isIdDirectorCell = idDirectorEvalProfile?.factors?.id_director === true;

    let genResultRaw;
    let capturedApiRecords;

    if (isIdDirectorCell) {
      log('[id-director] dispatching to idDirectorEngine.generateIdDirectedSuggestion', 'info');
      const dispatched = await captureApiCalls(
        () =>
          retryWithBackoff(
            async () => {
              const result = await idDirectorEngine.generateIdDirectedSuggestion(
                context,
                resolvedConfig,
                idDirectorEvalProfile,
                {
                  previousPersona: 'FIRST_TURN',
                  consolidatedTrace: options.consolidatedTrace || null,
                },
              );
              if (
                !result.success &&
                result.error &&
                (result.error.includes('429') || result.error.toLowerCase().includes('rate limit'))
              ) {
                throw new Error(result.error);
              }
              return result;
            },
            { log },
          ),
        { enabled: captureApiPayloads || Boolean(showMessages) },
      );
      genResultRaw = dispatched.result;
      capturedApiRecords = dispatched.records;
    } else {
      // Generate suggestions via tutor API with retry logic
      // Note: retryWithBackoff handles thrown errors, but tutorApi.generateSuggestions()
      // catches its own errors and returns { success: false }. We need to also handle
      // 429 rate limit errors returned in the result (not thrown).
      const dispatched = await captureApiCalls(
        () =>
          retryWithBackoff(
            async () => {
              const result = await tutorApi.generateSuggestions(context, {
                provider: resolvedConfig.provider,
                model: resolvedConfig.model,
                egoModel: resolvedConfig.egoModel,
                superegoModel: resolvedConfig.superegoModel || null,
                disableSuperego: resolvedConfig.disableSuperego || false,
                profileName: resolvedConfig.profileName,
                hyperparameters: resolvedConfig.hyperparameters || {},
                superegoHyperparameters: resolvedConfig.superegoHyperparameters || null,
                trace: true,
                superegoStrategy,
                outputSize,
                useDialogue,
                maxRounds,
                systemPromptExtension,
                superegoPromptExtension, // Dynamic disposition adjustments for superego
                learnerId, // Activates Writing Pad three-layer memory
                dialecticalNegotiation, // Phase 2: AI-powered dialectical struggle
                threadNegotiationResolution, // A5: carry negotiated resolution into the delivered suggestion across revision rounds
                behavioralOverrides, // Quantitative params from superego self-reflection
                conversationMode, // 'messages' for multi-turn message chains
                internalHistory, // Optional internal ego/superego message transcript
              });
              // Re-throw 429 errors so retryWithBackoff can handle them
              if (
                !result.success &&
                result.error &&
                (result.error.includes('429') || result.error.toLowerCase().includes('rate limit'))
              ) {
                throw new Error(result.error);
              }
              return result;
            },
            { log },
          ),
        { enabled: captureApiPayloads || Boolean(showMessages) },
      );
      genResultRaw = dispatched.result;
      capturedApiRecords = dispatched.records;
    }

    const genResult = genResultRaw;

    // Display API messages if --show-messages is active
    if (showMessages && Array.isArray(capturedApiRecords) && capturedApiRecords.length > 0) {
      formatApiMessages(capturedApiRecords, { showMessages });
    }
    if (captureApiPayloads && Array.isArray(genResult?.dialogueTrace) && genResult.dialogueTrace.length > 0) {
      genResult.dialogueTrace = attachApiPayloadsToTrace(genResult.dialogueTrace, capturedApiRecords);
    }

    if (!genResult.success) {
      log(`Generation failed: ${genResult.error}`, 'error');
      return { genResult, suggestion: null, validation: null, rubricResult: null, turnScore: null };
    }

    const suggestionCount = genResult.suggestions?.length || 0;
    log(`Generated ${suggestionCount} suggestion(s) in ${genResult.metadata?.latencyMs}ms`, 'success');

    if (genResult.metadata?.dialogueRounds) {
      log(`Dialogue rounds: ${genResult.metadata.dialogueRounds}`, 'info');
    }

    // Quick validation (rule-based)
    log('Running validation checks...', 'info');
    const suggestion = genResult.suggestions?.[0];
    const validation = suggestion
      ? rubricEvaluator.quickValidate(suggestion, {
          requiredElements: turnMeta.requiredElements,
          requiredElementsAny: turnMeta.requiredElementsAny,
          forbiddenElements: turnMeta.forbiddenElements,
        })
      : { passesRequired: false, passesForbidden: true, requiredMissing: ['No suggestions generated'] };

    log(
      `Validation: required=${validation.passesRequired ? 'PASS' : 'FAIL'}, forbidden=${validation.passesForbidden ? 'PASS' : 'FAIL'}`,
      validation.passesRequired && validation.passesForbidden ? 'success' : 'warning',
    );

    let rubricResult = null;
    if (!skipRubricEval && suggestion) {
      log('Running AI rubric evaluation...', 'info');
      debugLog(`[evaluationRunner] Running rubric evaluation for ${scenarioId}...`);

      // Build dialogue context for the judge (if available from multi-turn)
      const dialogueContext =
        options.conversationHistory || options.dialogueTrace || options.consolidatedTrace
          ? {
              conversationHistory: options.conversationHistory || null,
              dialogueTrace: options.dialogueTrace || null,
              consolidatedTrace: options.consolidatedTrace || null,
            }
          : null;

      rubricResult = await evaluateSuggestionWithSelectedJudge(
        suggestion,
        {
          name: turnMeta.scenarioName,
          description: turnMeta.description,
          expectedBehavior: turnMeta.expectedBehavior,
          learnerContext: turnMeta.learnerContext,
          requiredElements: turnMeta.requiredElements,
          forbiddenElements: turnMeta.forbiddenElements,
        },
        { dialogueContext },
        { judgeOverride, judgeCli, judgeCliModel },
      );

      if (rubricResult) {
        debugLog(
          `[evaluationRunner] Rubric result: success=${rubricResult.success}, ` +
            `overallScore=${rubricResult.overallScore}, ` +
            `scoresCount=${Object.keys(rubricResult.scores || {}).length}, ` +
            `error=${rubricResult.error || 'none'}`,
        );
        if (rubricResult.success) {
          log(`Rubric evaluation complete: score=${rubricResult.overallScore?.toFixed(1)}`, 'success');
        } else {
          log(`Rubric evaluation failed: ${rubricResult.error || 'unknown error'}`, 'error');
        }
      }
    } else if (skipRubricEval) {
      log('Skipping AI rubric evaluation (fast mode)', 'info');
    } else if (!suggestion) {
      log('Skipping rubric evaluation (no suggestion generated)', 'warning');
    }

    // Calculate turn score
    let turnScore = null;
    let scoringMethod = null;
    if (rubricResult?.success) {
      turnScore = rubricResult.overallScore;
      scoringMethod = 'rubric';
    } else if (suggestion && rubricResult && !rubricResult.success) {
      // Judge API failed — do NOT silently produce a synthetic score.
      // Store null so downstream aggregation excludes this data point.
      turnScore = null;
      scoringMethod = 'judge_failed';
      log(
        `WARNING: Judge evaluation failed for ${scenarioId}; score stored as null (was: ${(validation.passesRequired ? 50 : 0) + (validation.passesForbidden ? 50 : 0)} from keyword fallback). Error: ${rubricResult.error || 'unknown'}`,
        'warning',
      );
    } else if (suggestion && !rubricResult) {
      // Rubric evaluation was skipped (skipRubricEval=true) — no score available
      turnScore = null;
      scoringMethod = 'skipped';
    }

    return { genResult, suggestion, validation, rubricResult, turnScore, scoringMethod };
  }

  /**
   * Run a single test (scenario + config combination)
   * Handles both single-turn and multi-turn scenarios
   */
  async function runSingleTest(scenario, config, options = {}) {
    const {
      _skipRubricEval = false,
      _outputSize = 'normal',
      verbose = false,
      onLog,
      _superegoStrategy = null,
      judgeOverride = null,
      judgeCli = null,
      judgeCliModel = null,
      _dryRun = false,
      checkpointState = null,
      learnerId = null, // A7 Longitudinal: external Writing Pad ID
    } = options;

    // Create a log function that calls both console and onLog callback
    const log = (message, level = 'info') => {
      if (verbose) console.log(message);
      if (onLog) onLog(message, level);
    };

    const fullScenario = evalConfigLoader.getScenario(scenario.id);
    if (!fullScenario) {
      throw new Error(`Scenario not found: ${scenario.id}`);
    }

    log(`Running scenario: ${scenario.name}`, 'info');

    // Check if this is a multi-turn scenario
    const isMultiTurn = evalConfigLoader.isMultiTurnScenario(scenario.id);

    let result;
    if (isMultiTurn) {
      log('Detected multi-turn scenario', 'info');
      result = await dependencies.runMultiTurnTest(scenario, config, fullScenario, {
        ...options,
        log,
        judgeOverride,
        judgeCli,
        judgeCliModel,
        checkpointState,
        liveApiReporter: options.liveApiReporter,
        learnerId,
      });
    } else {
      // Single-turn evaluation (original logic)
      result = await runSingleTurnTest(scenario, config, fullScenario, {
        ...options,
        log,
        judgeOverride,
        judgeCli,
        judgeCliModel,
        learnerId,
      });
    }

    // A7 Longitudinal — eager pad-layer consolidation on session end.
    // The recognition_moments table fills correctly during dialogue, but
    // tutor-core's autoConsolidateToUnconscious has a 7-day age gate aimed
    // at production background jobs. Eval sessions complete in minutes, so
    // moments would never settle into writing_pads.unconscious_state.
    // Calling runBackgroundMaintenance with minAge: 0 here makes the pad's
    // permanent_traces / total_recognition_moments counter visible to the
    // *next* session under the same learner_id — required for the A7
    // Phase 2 H3 "memory use" measurement and for any tutor logic that
    // queries pad state across sessions. Failures are non-fatal.
    if (learnerId) {
      try {
        const maint = memoryDynamicsService.runBackgroundMaintenance(learnerId, {
          consolidation: { minAge: 0, requireTransformative: false },
        });
        const consolidated = maint?.tasks?.consolidation?.consolidated ?? 0;
        if (consolidated > 0) {
          log(
            `[evaluationRunner] Consolidated ${consolidated} recognition moment(s) to unconscious for ${learnerId}`,
            'info',
          );
        }
      } catch (err) {
        log(`[evaluationRunner] Pad consolidation failed for ${learnerId}: ${err.message}`, 'warn');
      }
    }

    return result;
  }

  /**
   * Run a single-turn test
   */
  async function runSingleTurnTest(scenario, config, fullScenario, options = {}) {
    const {
      skipRubricEval = false,
      outputSize = 'normal',
      _verbose = false,
      log = () => {},
      superegoStrategy = null,
      judgeOverride = null,
      judgeCli = null,
      judgeCliModel = null,
      dryRun = false,
      showMessages = false,
      learnerId = null, // A7 Longitudinal: Writing Pad persistence + result row (generation wiring added for the Line A drift pilot)
    } = options;

    // Resolve model aliases through eval's providers.yaml
    const resolvedConfig = resolveConfigModels(config);

    // Build context with optional curriculum content
    log('Building learner context...', 'info');
    const curriculumContext = contentResolver.isConfigured()
      ? contentResolver.buildCurriculumContext(contentResolver.resolveScenarioContent(fullScenario))
      : null;
    if (curriculumContext) {
      log(`Curriculum context loaded (${curriculumContext.length} chars)`, 'info');
    }
    const structuredLearnerContext = structureLearnerContext(fullScenario.learner_context);
    const context = tutorApi.buildContext(structuredLearnerContext, curriculumContext);
    context.isNewUser = fullScenario.is_new_user;

    // Resolve profile: extract dialogue/recognition settings and remap to tutor-core profile.
    // Preserve the original eval-cell name (e.g. cell_101_id_director_charisma) on
    // resolvedConfig.evalCellProfileName so downstream code (specifically the
    // id-director dispatch in generateAndEvaluateTurn) can look up factors that
    // tutor-core's profile registry does not have.
    const profileResolution = resolveEvalProfile(resolvedConfig.profileName);
    const { useDialogue, maxRounds, recognitionMode } = profileResolution;
    resolvedConfig.evalCellProfileName = resolvedConfig.profileName;
    resolvedConfig.profileName = profileResolution.resolvedProfileName;

    // P1c Provenance: snapshot the fully-resolved config
    const configHash = computeConfigHash(resolvedConfig);

    // P2 Provenance: prompt version metadata
    const promptVersions = collectPromptVersions(config.profileName, resolvedConfig);

    // Log config info
    log(
      `Generating suggestions with profile: ${resolvedConfig.profileName} (dialogue=${useDialogue}, rounds=${maxRounds}, recognition=${recognitionMode})`,
      'info',
    );
    log(
      `Provider: ${resolvedConfig.provider || 'from profile'}, Model: ${resolvedConfig.model || 'from profile'}`,
      'info',
    );
    if (resolvedConfig.egoModel) {
      const egoLabel =
        typeof resolvedConfig.egoModel === 'object'
          ? `${resolvedConfig.egoModel.provider}.${resolvedConfig.egoModel.model}`
          : resolvedConfig.egoModel;
      log(`Ego model override: ${egoLabel}`, 'info');
    }

    // Use shared generation + evaluation helper
    const {
      genResult,
      _suggestion,
      validation,
      rubricResult,
      turnScore: tutorFirstTurnScore,
      scoringMethod,
    } = await generateAndEvaluateTurn(
      context,
      resolvedConfig,
      {
        scenarioName: fullScenario.name,
        description: fullScenario.description,
        expectedBehavior: fullScenario.expected_behavior,
        learnerContext: fullScenario.learner_context,
        requiredElements: fullScenario.required_elements,
        requiredElementsAny: fullScenario.required_elements_any,
        forbiddenElements: fullScenario.forbidden_elements,
      },
      {
        skipRubricEval,
        outputSize,
        superegoStrategy,
        judgeOverride,
        judgeCli,
        judgeCliModel,
        useDialogue,
        maxRounds,
        log,
        scenarioId: scenario.id,
        learnerId, // Writing Pad persistence — mirrors runMultiTurnTest (was result-row-only before the Line A longitudinal-drift pilot)
        dryRun,
        showMessages,
      },
    );

    if (!genResult.success) {
      return {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        scenarioType: fullScenario.type || 'suggestion',
        provider: resolvedConfig.provider || genResult.metadata?.provider,
        model: resolvedConfig.model || genResult.metadata?.model,
        profileName: config.profileName,
        egoModel: resolvedConfig.egoModel
          ? `${resolvedConfig.egoModel.provider}.${resolvedConfig.egoModel.model}`
          : null,
        superegoModel: resolvedConfig.superegoModel
          ? `${resolvedConfig.superegoModel.provider}.${resolvedConfig.superegoModel.model}`
          : null,
        success: false,
        errorMessage: genResult.error,
        latencyMs: genResult.metadata?.latencyMs,
        conversationMode: null,
      };
    }

    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      scenarioType: fullScenario.type || 'suggestion',
      provider: resolvedConfig.provider || genResult.metadata?.provider,
      model: resolvedConfig.model || genResult.metadata?.model,
      profileName: config.profileName,
      egoModel: resolvedConfig.egoModel ? `${resolvedConfig.egoModel.provider}.${resolvedConfig.egoModel.model}` : null,
      superegoModel: resolvedConfig.superegoModel
        ? `${resolvedConfig.superegoModel.provider}.${resolvedConfig.superegoModel.model}`
        : null,
      hyperparameters: resolvedConfig.hyperparameters || config.hyperparameters,
      suggestions: genResult.suggestions,
      success: true,
      latencyMs: genResult.metadata?.latencyMs,
      inputTokens: genResult.metadata?.inputTokens,
      outputTokens: genResult.metadata?.outputTokens,
      dialogueRounds: 1,
      deliberationRounds: genResult.metadata?.dialogueRounds || 0,
      apiCalls: genResult.metadata?.apiCalls,
      cost: genResult.metadata?.totalCost,
      dialogueId: genResult.metadata?.dialogueId,
      conversationMode: null,
      scores: flattenNumericScores(rubricResult?.scores),
      scoresWithReasoning:
        rubricResult?.scores && Object.keys(rubricResult.scores).length > 0 ? rubricResult.scores : null,
      tutorFirstTurnScore,
      scoringMethod,
      baseScore: rubricResult?.baseScore ?? null,
      recognitionScore: rubricResult?.recognitionScore ?? null,
      passesRequired: rubricResult?.passesRequired ?? validation.passesRequired,
      passesForbidden: rubricResult?.passesForbidden ?? validation.passesForbidden,
      requiredMissing: rubricResult?.requiredMissing || validation.requiredMissing,
      forbiddenFound: rubricResult?.forbiddenFound || validation.forbiddenFound,
      judgeModel: rubricResult?.judgeModel,
      evaluationReasoning: rubricResult?.summary,
      factors: resolvedConfig.factors || null,
      learnerArchitecture: resolvedConfig.learnerArchitecture || null,
      learnerId,
      configHash,
      ...promptVersions,
      idConstructionTrace: buildIdConstructionTraceFromTurnResults([
        {
          turnIndex: 0,
          idConstruction: genResult.metadata?.idConstruction || null,
          agencyReturnVerification: genResult.metadata?.agencyReturnVerification || null,
          agencyReturnRepaired: genResult.metadata?.agencyReturnRepaired === true,
          engagementState: genResult.metadata?.engagementState || null,
          suggestion: genResult.suggestions?.[0] || null,
        },
      ]),
      dialogueResult: {
        dialogueTrace: genResult.dialogueTrace,
        dialogueRounds: genResult.metadata?.dialogueRounds,
        converged: genResult.metadata?.converged,
        dialogueId: genResult.metadata?.dialogueId,
      },
    };
  }

  return { generateAndEvaluateTurn, runSingleTest };
}
