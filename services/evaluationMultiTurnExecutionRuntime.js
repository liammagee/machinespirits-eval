/**
 * Multi-turn evaluation coordinator behind evaluationRunner's compatibility
 * facade. Setup, between-turn adaptation, transcript presentation, and final
 * result projection remain separate bounded owners.
 */
export function createEvaluationMultiTurnExecutionRuntime(dependencies = {}) {
  const {
    DESUB_DRIFT_CLASSIFIER_MODEL,
    DESUB_SEMANTIC_RELEASE_JUDGE,
    _bridge3CouplingCosine,
    advanceBetweenTurnAdaptation,
    analyzeLearnerTrajectory,
    buildDriftCorrectionContext,
    buildInteriorCharacterSheet,
    buildMessageChain,
    buildMultiTurnContext,
    buildResistanceSignalRetryContext,
    callDriftClassifierJudge,
    checkContentConditionSemantic,
    checkGrounding,
    classifyLearnerDraft,
    completeMultiTurnEvaluation,
    countTutorWork,
    dialogueEngine,
    driftGateMaxAttempts,
    evaluateLearnerDraft,
    evaluateResistanceSignalTarget,
    evaluationStore,
    extractTurnSuperegoAssessment,
    flattenConversationHistory,
    flattenNumericScores,
    formatLearnerActionForTranscript,
    generateAndEvaluateTurn,
    generateLearnerResponse,
    generatePhase1Reflection,
    joinContextBlocks,
    prepareMultiTurnEvaluation,
    projectLearnerDeliberationTrace,
    promptRewriter,
    resistanceSignalGateMaxAttempts,
    shouldGateDynamicResistanceTurn,
    structureLearnerContext,
    tutorApi,
    writeCheckpoint,
  } = dependencies;

  async function runMultiTurnTest(scenario, config, fullScenario, options = {}) {
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
      transcriptMode = false,
      runId = null,
      runNum = 0,
      showMessages = false,
      checkpointState = null,
      liveApiReporter: liveReporter = null,
      learnerId: explicitLearnerId = null, // A7 Longitudinal: pre-empts the synthetic ID
      threadNegotiationResolution: explicitThreadNegotiationResolution = false, // A5 CLI --thread-negotiation-resolution override
      externalEgoExtension = null, // approach A (#3): opt-in cross-session memory narrative, prepended to fullEgoExtension below
    } = options;

    log(`[evaluationRunner] Running multi-turn scenario: ${scenario.id}`);

    const prepared = prepareMultiTurnEvaluation({
      checkpointState,
      config,
      dryRun,
      explicitLearnerId,
      explicitThreadNegotiationResolution,
      fullScenario,
      judgeCli,
      judgeCliModel,
      judgeOverride,
      log,
      outputSize,
      runId,
      runNum,
      scenario,
      showMessages,
      skipRubricEval,
      superegoStrategy,
      transcriptMode,
    });
    fullScenario = prepared.fullScenario;
    const {
      activeTutorRubricVersion,
      configHash,
      consolidatedTrace,
      conversationHistory,
      conversationMode,
      curriculumContext,
      desubEnabled,
      desubInterior,
      dialogueId,
      flushTranscript,
      intersubjectiveEnabled,
      isEgoSuperegoLearner,
      isLLMLearner,
      learnerId,
      otherEgoBidirectional,
      otherEgoProfilingEnabled,
      priorSuperegoAssessments,
      promptErosionEnabled,
      promptRewritingEnabled,
      promptRewritingStrategy,
      promptVersions,
      quantitativeDispositionEnabled,
      rawProfile,
      rejectionBudget,
      resolvedConfig,
      sharedTurnOptions,
      startTurnIdx,
      strategyPlanningEnabled,
      superegoDispositionRewriting,
      threadNegotiationResolution,
      totalTurnCount,
      transcriptPath,
      turnResults,
      turns,
    } = prepared;
    let {
      behavioralOverrides,
      desubContentConditionMet,
      desubContentEvidence,
      desubTutorWork,
      learnerProfileOfTutor,
      previousSuggestion,
      sessionEvolution,
      strategyPlan,
      superegoEvolution,
      totalApiCalls,
      totalCost,
      totalDeliberationRounds,
      totalInputTokens,
      totalLatencyMs,
      totalOutputTokens,
      totalRejections,
      tutorProfileOfLearner,
    } = prepared;

    for (let turnIdx = startTurnIdx; turnIdx < totalTurnCount; turnIdx++) {
      // Update live reporter with current turn index
      if (liveReporter) liveReporter.setTurnIdx(turnIdx);

      const isInitialTurn = turnIdx === 0;
      const turnDef = isInitialTurn ? null : turns[turnIdx - 1];

      log(
        `[evaluationRunner] Turn ${turnIdx}/${totalTurnCount - 1}${isInitialTurn ? ' (initial)' : ` (${turnDef.id})`}`,
        'info',
      );

      // Update run metadata with current turn progress for `runs` command
      if (runId) {
        evaluationStore.updateRun(runId, {
          metadata: {
            turnProgress: {
              current: turnIdx + 1,
              total: totalTurnCount,
              scenarioId: scenario.id,
            },
          },
        });
      }

      // Show learner action in transcript mode (for follow-up turns)
      // Skip for LLM learner — the LLM-generated response replaces the YAML action
      if (!isInitialTurn && dialogueEngine.isTranscriptMode() && !isLLMLearner) {
        dialogueEngine.transcript('LEARNER ACTION', formatLearnerActionForTranscript(turnDef));
      }

      // Build context for this turn
      let contextStr;
      if (isInitialTurn) {
        contextStr = fullScenario.learner_context;
      } else {
        // Add previous turn to conversation history
        // For LLM learner, omit the YAML learner_action — the LLM message is the action
        conversationHistory.push({
          turnIndex: turnIdx - 1,
          turnId: turnIdx === 1 ? 'initial' : turns[turnIdx - 2]?.id,
          suggestion: previousSuggestion,
          learnerAction: isLLMLearner ? undefined : turnDef.learner_action,
          learnerMessage: turnDef.action_details?.message,
        });

        // Build learner trajectory assessment from accumulated turn data
        const learnerTrajectory = analyzeLearnerTrajectory(turnResults, conversationHistory);

        contextStr = buildMultiTurnContext({
          originalContext: fullScenario.learner_context,
          conversationHistory,
          currentTurn: turnDef,
          previousSuggestion,
          priorSuperegoAssessments,
          learnerTrajectory,
          conversationMode,
        });
      }

      // D3 Bridge 1 — two-pass reflection-as-input.
      // For cells with `two_pass_reflection: true`, run a Phase-1 ego call now
      // to produce a brief plain-text noticing, then prepend it to contextStr
      // so the standard Phase-2 dialectical loop reads the reflection as
      // *content in its user message* rather than as a system-prompt directive.
      // Hypothesis: LLMs follow concrete recent-context tokens better than
      // abstract meta-instructions; if so, message↔reflection coupling rises.
      let _phase1ReflectionApplied = false;
      if (rawProfile?.two_pass_reflection) {
        const learnerMessageForReflection = isInitialTurn ? null : turnDef?.action_details?.message || null;
        const reflection = await generatePhase1Reflection({
          contextStr,
          learnerMessage: learnerMessageForReflection,
          modelAlias: `${rawProfile.ego.provider}.${rawProfile.ego.model}`,
          log,
        });
        if (reflection) {
          // Prepend as a structured block. Goes BEFORE the existing context
          // so the model encounters it first when reading top-down.
          contextStr = `### Tutor's Prior Reflection On This Turn\n\n${reflection}\n\n---\n\n` + (contextStr || '');
          _phase1ReflectionApplied = true;
        }
      }

      const structuredContextStr = structureLearnerContext(contextStr);
      // Build message chain for message mode (from accumulated conversation history)
      const turnMessageHistory =
        conversationMode === 'messages' && conversationHistory.length > 0
          ? buildMessageChain(conversationHistory)
          : null;
      const context = tutorApi.buildContext(structuredContextStr, curriculumContext, null, turnMessageHistory);
      context.isNewUser = isInitialTurn ? fullScenario.is_new_user : false;

      // Build turn-specific rubric metadata
      const turnMeta = {
        scenarioName: isInitialTurn ? fullScenario.name : `${fullScenario.name} - Turn ${turnIdx}`,
        description: isInitialTurn
          ? fullScenario.description
          : isLLMLearner
            ? `Turn ${turnIdx}: LLM learner response`
            : `Turn: ${turnDef.learner_action}`,
        expectedBehavior: isInitialTurn ? fullScenario.expected_behavior : turnDef.expected_behavior,
        learnerContext: contextStr,
        requiredElements: isInitialTurn ? fullScenario.required_elements || [] : turnDef.required_elements || [],
        requiredElementsAny: isInitialTurn
          ? fullScenario.required_elements_any || []
          : turnDef.required_elements_any || [],
        forbiddenElements: isInitialTurn ? fullScenario.forbidden_elements || [] : turnDef.forbidden_elements || [],
      };

      // Build the ego prompt extension: erosion frame + session evolution (reflections)
      let fullEgoExtension = sessionEvolution;
      if (promptErosionEnabled && turnIdx > 0) {
        const erosionFrame = promptRewriter.buildPromptErosionFrame(turnIdx, rawProfile);
        if (erosionFrame) {
          // Erosion frame goes BEFORE reflections, so the model sees authority calibration first
          fullEgoExtension = erosionFrame + (sessionEvolution ? '\n\n' + sessionEvolution : '');
          log(
            `[evaluationRunner] Prompt erosion frame applied for turn ${turnIdx} (rate=${rawProfile.prompt_rewriting?.prompt_erosion?.rate ?? 0.2})`,
            'info',
          );
        }
      }

      // Append other-ego profile and strategy plan to ego extension
      // Injection order: erosion frame → self-reflection → other-ego profile → strategy plan
      if (otherEgoProfilingEnabled && tutorProfileOfLearner) {
        const profileBlock = promptRewriter.formatProfileForInjection(tutorProfileOfLearner, 'learner');
        fullEgoExtension = (fullEgoExtension ? fullEgoExtension + '\n\n' : '') + profileBlock;
      }
      if (strategyPlanningEnabled && strategyPlan) {
        fullEgoExtension = (fullEgoExtension ? fullEgoExtension + '\n\n' : '') + strategyPlan;
      }
      // Approach A (#3): opt-in external ego extension (e.g. accumulated cross-session
      // memory narrative). Prepended so the tutor sees learner context first; the eval
      // layer builds it and passes it in, keeping tutor-core import-clean of the eval layer.
      if (externalEgoExtension) {
        fullEgoExtension = externalEgoExtension + (fullEgoExtension ? '\n\n' + fullEgoExtension : '');
      }

      // Build the superego prompt extension: erosion frame + superego evolution (reflections)
      let fullSuperegoExtension = superegoEvolution;
      if (promptErosionEnabled && turnIdx > 0 && superegoEvolution) {
        const erosionFrame = promptRewriter.buildPromptErosionFrame(turnIdx, rawProfile);
        if (erosionFrame) {
          fullSuperegoExtension = erosionFrame + '\n\n' + superegoEvolution;
        }
      }

      // Call the SAME generation+evaluation code path as single-turn
      // Pass dialogue context so the judge can see the full exchange
      // When rejection budget is exhausted, also skip outer superego review loop (maxRounds: 0)
      const budgetExhausted = rejectionBudget !== null && totalRejections >= rejectionBudget;
      const turnOptions = {
        ...sharedTurnOptions,
        ...(fullEgoExtension ? { systemPromptExtension: fullEgoExtension } : {}),
        ...(fullSuperegoExtension ? { superegoPromptExtension: fullSuperegoExtension } : {}),
        ...(behavioralOverrides ? { behavioralOverrides } : {}),
        ...(budgetExhausted ? { maxRounds: 0 } : {}),
        conversationHistory: conversationHistory.length > 0 ? conversationHistory : null,
        consolidatedTrace: consolidatedTrace.length > 0 ? consolidatedTrace : null,
      };
      // D3 Bridge 3 — best-of-N selection.
      // For cells with `best_of_n: K` (default behaviour when unset = single
      // call as in cells 40/97/98/99), run K parallel invocations of the full
      // dialectical-loop pipeline and select the candidate with highest
      // reasoning↔message coupling cosine. Search through generation space;
      // the model doesn't need to *learn* coupling, we just *keep* the
      // best-coupled draft.
      //
      // Note on state side-effects: each candidate goes through tutorApi's
      // generateSuggestions which does its own writing-pad updates. We accept
      // that K invocations write K writing-pad histories; only the selected
      // candidate's downstream effects propagate to the *next turn's* state
      // (because we use only the selected candidate's genResult/suggestion).
      // The pad ends up a bit noisier than cell 40's single-history pad, but
      // this is intrinsic to the Bridge-3 search architecture and acceptable
      // for the verdict question (does best-of-N selection bridge the gap?).
      const bestOfN = rawProfile?.best_of_n;
      let genResult, suggestion, validation, rubricResult, turnScore, scoringMethod;
      if (bestOfN && bestOfN >= 2) {
        const candidates = [];
        for (let k = 0; k < bestOfN; k++) {
          const result = await generateAndEvaluateTurn(context, resolvedConfig, turnMeta, turnOptions);
          if (result?.genResult?.success) {
            // Extract reasoning + message text for coupling scoring
            const sug = result.suggestion;
            const reasoningText = sug?.reasoning || '';
            const messageText = sug?.message || '';
            const couplingScore = _bridge3CouplingCosine(reasoningText, messageText);
            candidates.push({ ...result, couplingScore, k });
            log(`[bridge3] candidate ${k + 1}/${bestOfN}: coupling=${couplingScore.toFixed(3)}`, 'info');
          } else {
            // Failed candidate — skip; if all fail, we'll throw below
            candidates.push({ genResult: result?.genResult, couplingScore: -1, k });
          }
        }
        // Pick the winning candidate by coupling cosine
        candidates.sort((a, b) => b.couplingScore - a.couplingScore);
        const winner = candidates.find((c) => c.couplingScore >= 0);
        if (!winner) {
          ({ genResult, suggestion, validation, rubricResult, turnScore, scoringMethod } = candidates[0]);
        } else {
          ({ genResult, suggestion, validation, rubricResult, turnScore, scoringMethod } = winner);
          log(
            `[bridge3] selected k=${winner.k + 1} with coupling=${winner.couplingScore.toFixed(3)} (range: ${candidates[candidates.length - 1].couplingScore.toFixed(3)} – ${candidates[0].couplingScore.toFixed(3)})`,
            'info',
          );
        }
      } else {
        ({ genResult, suggestion, validation, rubricResult, turnScore, scoringMethod } = await generateAndEvaluateTurn(
          context,
          resolvedConfig,
          turnMeta,
          turnOptions,
        ));
      }

      if (!genResult.success) {
        const turnId = isInitialTurn ? 'initial' : turnDef.id;
        throw new Error(
          `Multi-turn scenario ${scenario.id}: Turn ${turnIdx} (${turnId}) failed to generate suggestions: ${genResult.error || 'unknown error'}`,
        );
      }

      // Accumulate dialogue traces
      if (genResult.dialogueTrace && genResult.dialogueTrace.length > 0) {
        // Insert user turn action entry before each turn (except initial)
        // For dynamic learner (ego_superego), skip the scripted action label —
        // the learner's LLM-generated response is already in the trace via
        // learner_ego_initial / learner_superego / learner/final_output entries.
        if (!isInitialTurn && !isLLMLearner) {
          const histEntry = conversationHistory[conversationHistory.length - 1];
          consolidatedTrace.push({
            agent: 'learner',
            action: 'turn_action',
            turnIndex: turnIdx,
            contextSummary: histEntry?.learnerMessage || `${histEntry?.learnerAction || 'Action'}`,
            detail: `Learner: ${histEntry?.learnerAction}`,
            timestamp: new Date().toISOString(),
          });
        }
        consolidatedTrace.push(...genResult.dialogueTrace);

        // Attach inputMessages to tutor trace entries (symmetric with learner deliberation entries)
        for (let i = consolidatedTrace.length - genResult.dialogueTrace.length; i < consolidatedTrace.length; i++) {
          const entry = consolidatedTrace[i];
          if (
            entry.agent === 'ego' &&
            (entry.action === 'generate' || entry.action === 'revise' || entry.action === 'incorporate-feedback')
          ) {
            entry.inputMessages = turnMessageHistory || null;
          } else if (entry.agent === 'superego' && entry.action === 'review') {
            entry.inputMessages = null; // superego uses single-prompt, not message chains
          }
        }

        // Add final delivery marker for multi-agent mode
        const hasSuperego = genResult.dialogueTrace.some((entry) => entry.agent === 'superego');
        if (hasSuperego) {
          const suggCount = genResult.suggestions?.length || 0;
          consolidatedTrace.push({
            agent: 'tutor',
            action: 'final_output',
            turnIndex: turnIdx,
            from: 'ego',
            to: 'tutor',
            direction: 'response',
            suggestionCount: suggCount,
            contextSummary: `Delivered ${suggCount} suggestion${suggCount !== 1 ? 's' : ''}`,
            detail: `Turn ${turnIdx + 1} complete`,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Flush transcript: ego/superego exchange for this turn
      flushTranscript();

      // Accumulate cross-turn superego memory from this turn's trace
      if (genResult.dialogueTrace && genResult.dialogueTrace.length > 0) {
        const assessment = extractTurnSuperegoAssessment(turnIdx, genResult.dialogueTrace);
        if (assessment) {
          priorSuperegoAssessments.push(assessment);
        }
      }

      // Track rejection budget across turns: count superego rejections in this turn's trace
      if (rejectionBudget !== null && genResult.dialogueTrace) {
        const turnRejections = genResult.dialogueTrace.filter(
          (entry) => entry.agent === 'superego' && entry.action === 'review' && entry.approved === false,
        ).length;
        totalRejections += turnRejections;

        if (totalRejections >= rejectionBudget) {
          // Budget exhausted: force approve-only mode for remaining turns
          behavioralOverrides = { ...(behavioralOverrides || {}), max_rejections: 0 };
          log(
            `[evaluationRunner] Rejection budget exhausted (${totalRejections}/${rejectionBudget}): forcing approve-only for remaining turns`,
            'info',
          );
          consolidatedTrace.push({
            agent: 'rejection_budget',
            action: 'exhausted',
            turnIndex: turnIdx,
            contextSummary: `Budget exhausted: ${totalRejections}/${rejectionBudget} rejections used`,
            detail: `Total rejections across ${turnIdx + 1} turns: ${totalRejections}. Remaining turns will auto-approve.`,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Collect per-turn result
      turnResults.push({
        turnIndex: turnIdx,
        turnId: isInitialTurn ? 'initial' : turnDef.id,
        learnerAction: isInitialTurn || isLLMLearner ? undefined : turnDef.learner_action,
        learnerMessage: isInitialTurn ? undefined : turnDef.action_details?.message, // Include generated learner message for growth tracking
        expectedBehavior: turnMeta.expectedBehavior,
        suggestion,
        learnerDeliberation: turnDef?._learnerDeliberation || null,
        learnerEmotionalState: turnDef?._learnerEmotionalState || null,
        learnerMessageGenerated: !!turnDef?._learnerDeliberation,
        learnerOriginalMessage: turnDef?._originalMessage || null,
        learnerResistanceSignalGate: turnDef?._learnerResistanceSignalGate || null,
        idConstruction: genResult.metadata?.idConstruction || null,
        agencyReturnVerification: genResult.metadata?.agencyReturnVerification || null,
        agencyReturnRepaired: genResult.metadata?.agencyReturnRepaired === true,
        engagementState: genResult.metadata?.engagementState || null,
        scores: flattenNumericScores(rubricResult?.scores),
        scoresWithReasoning:
          rubricResult?.scores && Object.keys(rubricResult.scores).length > 0 ? rubricResult.scores : null,
        judgeModel: rubricResult?.judgeModel || null,
        evaluationReasoning: rubricResult?.summary || null,
        rubricVersion: activeTutorRubricVersion,
        turnScore,
        scoringMethod,
        passesRequired: rubricResult?.passesRequired ?? validation.passesRequired,
        passesForbidden: rubricResult?.passesForbidden ?? validation.passesForbidden,
        requiredMissing: validation.requiredMissing,
        forbiddenFound: validation.forbiddenFound,
        minAcceptableScore: (!isInitialTurn ? turnDef.min_acceptable_score : null) || fullScenario.min_acceptable_score,
      });

      // Aggregate metrics
      totalLatencyMs += genResult.metadata?.latencyMs || 0;
      totalInputTokens += genResult.metadata?.inputTokens || 0;
      totalOutputTokens += genResult.metadata?.outputTokens || 0;
      totalApiCalls += genResult.metadata?.apiCalls || 0;
      totalCost += genResult.metadata?.totalCost || 0;
      totalDeliberationRounds += genResult.metadata?.dialogueRounds || 0;

      // Update for next iteration
      previousSuggestion = suggestion;

      ({
        behavioralOverrides,
        learnerProfileOfTutor,
        sessionEvolution,
        strategyPlan,
        superegoEvolution,
        tutorProfileOfLearner,
      } = await advanceBetweenTurnAdaptation({
        behavioralOverrides,
        consolidatedTrace,
        conversationHistory,
        intersubjectiveEnabled,
        learnerProfileOfTutor,
        log,
        otherEgoBidirectional,
        otherEgoProfilingEnabled,
        priorSuperegoAssessments,
        promptRewritingEnabled,
        promptRewritingStrategy,
        quantitativeDispositionEnabled,
        rawProfile,
        sessionEvolution,
        strategyPlan,
        strategyPlanningEnabled,
        superegoDispositionRewriting,
        superegoEvolution,
        totalTurnCount,
        turnIdx,
        turnResults,
        tutorProfileOfLearner,
      }));

      // Flush transcript: reflections (self-reflection, disposition, profiling, etc.)
      flushTranscript();

      // Generate LLM learner response for next turn.
      // Both architectures go through generateLearnerResponse():
      //   - ego_superego: ego → superego → ego_revision deliberation chain
      //   - unified (messages mode): single-agent LLM call
      // In single-prompt mode, unified learners use the YAML turn messages directly.
      if (isLLMLearner && turnIdx < totalTurnCount - 1) {
        const nextTurnDef = turns[turnIdx]; // turnIdx is 0-based into the loop; turns[turnIdx] is the next follow-up turn
        if (nextTurnDef) {
          const bidirectionalProfileContext =
            otherEgoBidirectional && learnerProfileOfTutor
              ? promptRewriter.formatProfileForInjection(learnerProfileOfTutor, 'tutor')
              : null;
          // De-substitution: the interior is the learner's character sheet on
          // every turn, and the content condition updates from this tutor turn.
          if (desubEnabled) {
            desubTutorWork += countTutorWork({
              tutorMessages: [suggestion?.message || suggestion?.title || ''],
              interior: desubInterior,
            });
            if (!desubContentConditionMet) {
              const condition = await checkContentConditionSemantic({
                tutorMessage: suggestion?.message || suggestion?.title || '',
                interior: desubInterior,
                callJudge: callDriftClassifierJudge,
                judgeModel: DESUB_SEMANTIC_RELEASE_JUDGE,
              });
              if (condition.met) {
                desubContentConditionMet = true;
                desubContentEvidence = `[${condition.source}] ${condition.evidence}`;
              }
            }
            consolidatedTrace.push({
              agent: 'learner_content_condition',
              action: desubContentConditionMet ? 'met' : 'not_met',
              turnIndex: turnIdx + 1,
              contextSummary: desubContentEvidence || 'blocking element not yet released',
              detail: JSON.stringify({ met: desubContentConditionMet, evidence: desubContentEvidence }),
              timestamp: new Date().toISOString(),
            });
          }
          const baseLearnerProfileContext = desubEnabled
            ? joinContextBlocks(bidirectionalProfileContext, buildInteriorCharacterSheet(desubInterior))
            : bidirectionalProfileContext;
          const resistanceGateEnabled = shouldGateDynamicResistanceTurn(fullScenario, nextTurnDef, turnIdx);
          const resistanceGateMaxAttempts = resistanceGateEnabled ? resistanceSignalGateMaxAttempts(fullScenario) : 1;
          const learnerAttemptUsage = { inputTokens: 0, outputTokens: 0, apiCalls: 0 };
          const resistanceGateAttempts = [];
          let resistanceGateResult = null;
          let learnerResponse = null;

          for (let attempt = 1; attempt <= resistanceGateMaxAttempts; attempt += 1) {
            const retryContext =
              resistanceGateEnabled && resistanceGateResult?.matched === false
                ? buildResistanceSignalRetryContext({
                    targetSignal: fullScenario.resistance_signal_target,
                    previousMessage: learnerResponse?.message || '',
                    attempt,
                  })
                : null;

            learnerResponse = await generateLearnerResponse({
              tutorMessage: suggestion?.message || suggestion?.title || '',
              topic: fullScenario.topic || fullScenario.name || '',
              conversationHistory: flattenConversationHistory(conversationHistory),
              learnerProfile: resolvedConfig.learnerArchitecture,
              personaId: fullScenario.learner_persona || 'eager_novice',
              modelOverride:
                config.learnerModelOverride || resolvedConfig.learnerModelOverride || config.modelOverride || null,
              egoModelOverride: config.learnerEgoModelOverride || null,
              superegoModelOverride: config.learnerSuperegoModelOverride || null,
              profileContext: joinContextBlocks(baseLearnerProfileContext, retryContext),
              conversationMode,
            });

            learnerAttemptUsage.inputTokens += learnerResponse.tokenUsage?.inputTokens || 0;
            learnerAttemptUsage.outputTokens += learnerResponse.tokenUsage?.outputTokens || 0;
            learnerAttemptUsage.apiCalls += learnerResponse.tokenUsage?.apiCalls || 0;

            if (!resistanceGateEnabled) break;

            resistanceGateResult = evaluateResistanceSignalTarget({
              message: learnerResponse.message,
              targetSignal: fullScenario.resistance_signal_target,
            });
            resistanceGateAttempts.push({
              attempt,
              matched: resistanceGateResult.matched,
              targetSignal: resistanceGateResult.targetSignal,
              observedSignal: resistanceGateResult.observedSignal,
              evidence: resistanceGateResult.evidence,
              questionCount: resistanceGateResult.questionCount,
              message: learnerResponse.message,
            });

            if (resistanceGateResult.matched || attempt >= resistanceGateMaxAttempts) break;

            log(
              `[evaluationRunner] Resistance signal gate retry ${attempt}/${resistanceGateMaxAttempts}: expected ${fullScenario.resistance_signal_target}, observed ${resistanceGateResult.observedSignal || 'none'}`,
              'warning',
            );
          }

          if (resistanceGateEnabled) {
            nextTurnDef._learnerResistanceSignalGate = {
              enabled: true,
              targetSignal: fullScenario.resistance_signal_target,
              matched: resistanceGateResult?.matched === true,
              observedSignal: resistanceGateResult?.observedSignal || '',
              evidence: resistanceGateResult?.evidence || '',
              attempts: resistanceGateAttempts,
              maxAttempts: resistanceGateMaxAttempts,
            };
            consolidatedTrace.push({
              agent: 'learner_resistance_gate',
              action: resistanceGateResult?.matched ? 'accepted' : 'target_not_witnessed',
              turnIndex: turnIdx + 1,
              contextSummary: resistanceGateResult?.matched
                ? `Matched ${fullScenario.resistance_signal_target}`
                : `Did not match ${fullScenario.resistance_signal_target}`,
              detail: JSON.stringify(nextTurnDef._learnerResistanceSignalGate),
              timestamp: new Date().toISOString(),
            });
          }

          // De-substitution drift gate: hold the learner in character. Evaluate
          // the accepted draft; on violation, regenerate with a corrective
          // injection (dynamic-system-prompt channel) up to the gate budget.
          // Exhaustion is instrument failure — the message is never replaced.
          if (desubEnabled) {
            const driftMaxAttempts = driftGateMaxAttempts(fullScenario);
            const driftAttempts = [];
            let driftVerdict = evaluateLearnerDraft({
              message: learnerResponse.message,
              interior: desubInterior,
              contentConditionMet: desubContentConditionMet,
              turnIndex: turnIdx + 1,
              tutorWorkCount: desubTutorWork,
            });
            // Iteration 1: sonnet-class subtle-drift check when the lexical
            // fast-path passes on a later turn (the drift the word lists miss).
            if (driftVerdict.ok && turnIdx >= 1) {
              const classified = await classifyLearnerDraft({
                message: learnerResponse.message,
                interior: desubInterior,
                contentConditionMet: desubContentConditionMet,
                callJudge: callDriftClassifierJudge,
                judgeModel: DESUB_DRIFT_CLASSIFIER_MODEL,
              });
              if (classified && !classified.ok) driftVerdict = classified;
            }
            driftAttempts.push({ attempt: 1, ...driftVerdict, message: learnerResponse.message });
            let driftAttempt = 1;
            while (!driftVerdict.ok && driftAttempt < driftMaxAttempts) {
              driftAttempt += 1;
              const correction = buildDriftCorrectionContext({
                violation: driftVerdict.violation,
                interior: desubInterior,
                attempt: driftAttempt,
              });
              learnerResponse = await generateLearnerResponse({
                tutorMessage: suggestion?.message || suggestion?.title || '',
                topic: fullScenario.topic || fullScenario.name || '',
                conversationHistory: flattenConversationHistory(conversationHistory),
                learnerProfile: resolvedConfig.learnerArchitecture,
                personaId: fullScenario.learner_persona || 'eager_novice',
                modelOverride:
                  config.learnerModelOverride || resolvedConfig.learnerModelOverride || config.modelOverride || null,
                egoModelOverride: config.learnerEgoModelOverride || null,
                superegoModelOverride: config.learnerSuperegoModelOverride || null,
                profileContext: joinContextBlocks(baseLearnerProfileContext, correction),
                conversationMode,
              });
              learnerAttemptUsage.inputTokens += learnerResponse.tokenUsage?.inputTokens || 0;
              learnerAttemptUsage.outputTokens += learnerResponse.tokenUsage?.outputTokens || 0;
              learnerAttemptUsage.apiCalls += learnerResponse.tokenUsage?.apiCalls || 0;
              driftVerdict = evaluateLearnerDraft({
                message: learnerResponse.message,
                interior: desubInterior,
                contentConditionMet: desubContentConditionMet,
                turnIndex: turnIdx + 1,
                tutorWorkCount: desubTutorWork,
              });
              // Iteration 1: on the final attempt a lexical violation can be
              // rescued by the classifier (arbiter of last resort) — fewer
              // false-positive exhaustions from brittle word lists.
              if (!driftVerdict.ok && driftAttempt >= driftMaxAttempts) {
                const classified = await classifyLearnerDraft({
                  message: learnerResponse.message,
                  interior: desubInterior,
                  contentConditionMet: desubContentConditionMet,
                  callJudge: callDriftClassifierJudge,
                  judgeModel: DESUB_DRIFT_CLASSIFIER_MODEL,
                });
                if (classified?.ok) driftVerdict = classified;
              }
              driftAttempts.push({ attempt: driftAttempt, ...driftVerdict, message: learnerResponse.message });
              if (!driftVerdict.ok) {
                log(
                  `[evaluationRunner] Drift gate retry ${driftAttempt}/${driftMaxAttempts}: ${driftVerdict.violation}`,
                  'warning',
                );
              }
            }
            const grounding = checkGrounding({ learnerMessage: learnerResponse.message, interior: desubInterior });
            nextTurnDef._learnerDriftGate = {
              enabled: true,
              accepted: driftVerdict.ok,
              instrument_failure: !driftVerdict.ok,
              violation: driftVerdict.ok ? null : driftVerdict.violation,
              contentConditionMet: desubContentConditionMet,
              attempts: driftAttempts,
              maxAttempts: driftMaxAttempts,
            };
            nextTurnDef._learnerGrounding = grounding;
            consolidatedTrace.push({
              agent: 'learner_drift_gate',
              action: driftVerdict.ok ? 'accepted' : 'violation_uncorrected',
              turnIndex: turnIdx + 1,
              contextSummary: driftVerdict.ok
                ? `In character (${driftVerdict.evidence})`
                : `Instrument failure: ${driftVerdict.violation}`,
              detail: JSON.stringify(nextTurnDef._learnerDriftGate),
              timestamp: new Date().toISOString(),
            });
            consolidatedTrace.push({
              agent: 'learner_grounding',
              action: grounding.grounded ? 'grounded' : 'not_grounded',
              turnIndex: turnIdx + 1,
              contextSummary: grounding.grounded
                ? `Grounded: cited ${grounding.citedElement}, "${grounding.conclusionEvidence}"`
                : 'Target conclusion not grounded',
              detail: JSON.stringify(grounding),
              timestamp: new Date().toISOString(),
            });
          }

          // Override YAML message with LLM-generated one
          nextTurnDef._originalMessage = nextTurnDef.action_details?.message;
          nextTurnDef.action_details = nextTurnDef.action_details || {};
          nextTurnDef.action_details.message = learnerResponse.message;
          nextTurnDef._learnerDeliberation = learnerResponse.internalDeliberation;
          nextTurnDef._learnerEmotionalState = learnerResponse.emotionalState;

          // Track learner LLM costs
          totalInputTokens += learnerAttemptUsage.inputTokens;
          totalOutputTokens += learnerAttemptUsage.outputTokens;
          totalApiCalls += learnerAttemptUsage.apiCalls;

          // Add learner deliberation to consolidated trace.
          // ego_superego: multiple deliberation entries (ego_initial, superego, ego_revision)
          // unified: single deliberation entry (unified_learner)
          // Both produce a learner/final_output trace entry for symmetric transcript rendering.
          consolidatedTrace.push(
            ...projectLearnerDeliberationTrace({
              internalDeliberation: learnerResponse.internalDeliberation,
              finalMessage: learnerResponse.message,
              turnIndex: turnIdx + 1,
            }),
          );

          const archLabel = isEgoSuperegoLearner ? 'ego_superego' : 'unified';
          log(
            `[evaluationRunner] Generated LLM learner response (${archLabel}): "${learnerResponse.message.substring(0, 80)}..."`,
            'info',
          );

          // Flush transcript: learner deliberation
          flushTranscript();
        }
      }

      // Write mid-dialogue checkpoint after each completed turn
      if (runId) {
        writeCheckpoint(runId, scenario.id, config.profileName, {
          attemptIndex: runNum,
          lastCompletedTurn: turnIdx,
          totalTurns: totalTurnCount,
          dialogueId,
          learnerId,
          threadNegotiationResolution, // A5: preserve this session's arm across resume-after-kill
          turns,
          turnResults,
          conversationHistory,
          consolidatedTrace,
          priorSuperegoAssessments,
          previousSuggestion,
          sessionEvolution,
          superegoEvolution,
          behavioralOverrides,
          tutorProfileOfLearner,
          learnerProfileOfTutor,
          strategyPlan,
          totalRejections,
          totalLatencyMs,
          totalInputTokens,
          totalOutputTokens,
          totalApiCalls,
          totalCost,
          totalDeliberationRounds,
        });
      }
    }

    return completeMultiTurnEvaluation({
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
    });
  }

  /**
   * Resume an incomplete evaluation run, re-running only the missing tests.
   *
   * @param {Object} options
   * @param {string} options.runId - The run ID to resume
   * @param {number} [options.parallelism] - Parallel worker count
   * @param {boolean} [options.verbose] - Enable verbose output
   * @returns {Promise<Object>} Evaluation results (same shape as runEvaluation)
   */

  return { runMultiTurnTest };
}
