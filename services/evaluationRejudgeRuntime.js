/**
 * Rejudgment scoring and orchestration behind evaluationRunner compatibility facade.
 */
export function createEvaluationRejudgeRuntime(dependencies = {}) {
  const {
    DEFAULT_PARALLELISM,
    REQUEST_DELAY_MS,
    SUPPORTED_JUDGE_CLIS,
    buildBatchedLearnerPrompt,
    buildLearnerEvaluationPrompt,
    buildLearnerHolisticEvaluationPrompt,
    calculateLearnerOverallScore,
    callCliJudge,
    createHash,
    evaluationStore,
    extractLearnerTurnsFromTrace,
    getCliJudgeModelLabel,
    getDefaultCliJudgeModelOverride,
    normalizeCliJudgeEvaluation,
    resolveRejudgeScenarioAndDialogueLog,
    retryWithBackoff,
    rubricEvaluator,
    sleep,
  } = dependencies;

  async function scoreMultiTurnRejudgment(rowId, result, dialogueLog, opts) {
    const {
      judgeCli,
      judgeModel,
      effectiveCliJudgeModel,
      judgeCliEffort,
      judgeOverrideObj,
      log,
      skipLearner,
      skipDeliberation,
    } = opts;

    const resolved = resolveRejudgeScenarioAndDialogueLog(result, dialogueLog);
    const fullScenario = resolved.scenario;
    dialogueLog = resolved.dialogueLog || dialogueLog;
    if (!fullScenario) return;

    const turnResults = dialogueLog.turnResults || [];
    const dialogueTrace = dialogueLog.dialogueTrace || [];
    const totalTurns = turnResults.length;
    const scenarioId = result.scenarioId;
    const profileName = result.profileName || `${result.provider}/${result.model}`;

    if (totalTurns === 0) return;

    // ── Shared judge call helper (returns parsed JSON) ──
    async function callJudge(prompt) {
      if (judgeCli) {
        return await callCliJudge(prompt, judgeCli, effectiveCliJudgeModel, judgeCliEffort);
      } else {
        // Use rubricEvaluator's API-based judge: callJudgeModel returns raw text, parseJudgeResponse parses it
        const responseText = await rubricEvaluator.callJudgeModel(prompt, judgeOverrideObj);
        return rubricEvaluator.parseJudgeResponse(responseText);
      }
    }

    // ── Learner data prep ──
    const isMultiAgent = rubricEvaluator.isEgoSuperegoLearner(dialogueTrace);
    const personaDescription = dialogueLog.learnerContext || 'No persona description available';
    const scenarioNameForLearner = fullScenario.name || scenarioId;
    const learnerCtx = dialogueLog.learnerContext || null;
    const transcriptArtifacts = dialogueLog.transcripts || null;

    const learnerTurns = extractLearnerTurnsFromTrace(dialogueTrace, isMultiAgent, dialogueLog.conversationHistory);

    // Build reconstructed turns for learner prompt builder
    const reconstructedTurns = [];
    for (let lt = 0; lt < learnerTurns.length; lt++) {
      reconstructedTurns.push({
        turnNumber: lt + 1,
        phase: 'learner',
        externalMessage: learnerTurns[lt].externalMessage,
        internalDeliberation: learnerTurns[lt].internalDeliberation,
      });
      const tutorTurn = turnResults[lt + 1];
      if (tutorTurn) {
        const sug = tutorTurn.suggestions?.[0];
        reconstructedTurns.push({
          turnNumber: lt + 1,
          phase: 'tutor',
          externalMessage: sug?.message || sug?.text || JSON.stringify(sug),
        });
      }
    }

    // Pre-compute learner turn target indices
    const learnerTurnTargets = [];
    for (let lt = 0; lt < learnerTurns.length; lt++) {
      const targetIdx = reconstructedTurns.findIndex(
        (t) => t.phase === 'learner' && t.externalMessage === learnerTurns[lt].externalMessage,
      );
      if (targetIdx !== -1) {
        learnerTurnTargets.push({ lt, targetIdx });
      }
    }

    // ── Build transcript turns (shared by dialogue + holistic prompts) ──
    const transcriptTurns = turnResults.map((t, idx) => ({
      turnIndex: idx,
      turnId: t.turnId,
      suggestion: t.suggestions?.[0],
      learnerAction: t.learnerAction,
      learnerMessage: t.learnerMessage,
    }));

    // ── Parallel scoring phases ──
    const promises = [];
    const phaseLabels = [];

    // Phase 0: Per-turn tutor scoring
    if (totalTurns > 0) {
      promises.push(
        (async () => {
          try {
            const scenarioContext = {
              name: fullScenario.name,
              description: fullScenario.description,
              expectedBehavior: fullScenario.expected_behavior,
              learnerContext: fullScenario.learner_context,
              requiredElements: fullScenario.required_elements,
              forbiddenElements: fullScenario.forbidden_elements,
            };
            const learnerCtxForTutor = dialogueLog.learnerContext || null;

            // Normalize a single turn's parsed scores. Provenance fields
            // (judgeInputHash, judgeTimestamp, contentTurnId) are required for
            // paper2.provenance.judge_input_hashes audit and to keep
            // re-judgments machine-verifiable; missing them silently degrades
            // provenance over time.
            function normalizeTutorTurnResult(turnIndex, parsed, judgeInputHash, contentTurnId) {
              const normalizedScores = {};
              for (const [key, value] of Object.entries(parsed.scores || {})) {
                if (typeof value === 'object' && value !== null) {
                  normalizedScores[key] = { score: value.score, reasoning: value.reasoning };
                } else if (typeof value === 'number') {
                  normalizedScores[key] = { score: value, reasoning: null };
                }
              }
              const overallScore =
                Object.keys(normalizedScores).length > 0
                  ? rubricEvaluator.calculateOverallScore(normalizedScores)
                  : parsed.overall_score;
              return {
                turnIndex,
                scores: normalizedScores,
                overallScore,
                baseScore:
                  Object.keys(normalizedScores).length > 0
                    ? rubricEvaluator.calculateBaseScore(normalizedScores)
                    : null,
                recognitionScore:
                  Object.keys(normalizedScores).length > 0
                    ? rubricEvaluator.calculateRecognitionScore(normalizedScores)
                    : null,
                summary: parsed.summary,
                judgeInputHash: judgeInputHash || null,
                judgeTimestamp: new Date().toISOString(),
                contentTurnId: contentTurnId || null,
              };
            }

            const tutorTurnScores = {};

            // Attempt batched scoring first for multi-turn
            if (totalTurns > 1) {
              try {
                const batchedPrompt = rubricEvaluator.buildBatchedPerTurnTutorPrompt({
                  turnResults,
                  dialogueTrace,
                  scenario: scenarioContext,
                  learnerContext: learnerCtxForTutor,
                });
                if (batchedPrompt) {
                  // Hash the batched prompt once; every per-turn result that
                  // came out of this batched call shares the same input hash.
                  const batchedHash = createHash('sha256').update(batchedPrompt).digest('hex');
                  const parsed = await retryWithBackoff(async () => callJudge(batchedPrompt), {});
                  if (Array.isArray(parsed.turns)) {
                    for (const turnData of parsed.turns) {
                      const tIdx = turnData.turn_index;
                      const ctid = turnResults[tIdx]?.contentTurnId || null;
                      const r = normalizeTutorTurnResult(tIdx, turnData, batchedHash, ctid);
                      tutorTurnScores[r.turnIndex] = {
                        scores: r.scores,
                        overallScore: r.overallScore,
                        baseScore: r.baseScore,
                        recognitionScore: r.recognitionScore,
                        summary: r.summary,
                        judgeInputHash: r.judgeInputHash,
                        judgeTimestamp: r.judgeTimestamp,
                        judgeModel,
                        contentTurnId: r.contentTurnId,
                      };
                    }
                  }
                }
              } catch (batchErr) {
                log(`    tutor-per-turn batch FAIL (falling back): ${batchErr.message}`);
              }
            }

            // Fallback: score missing turns individually (all turns if batch failed, or just gaps)
            const missingTurns = [];
            for (let i = 0; i < totalTurns; i++) {
              if (!tutorTurnScores[i]) missingTurns.push(i);
            }
            if (missingTurns.length > 0) {
              if (Object.keys(tutorTurnScores).length > 0) {
                log(
                  `    tutor-per-turn batch partial: got ${Object.keys(tutorTurnScores).length}/${totalTurns} turns, filling gaps [${missingTurns.join(',')}]`,
                );
              }
              for (const i of missingTurns) {
                try {
                  const prompt = rubricEvaluator.buildPerTurnTutorEvaluationPrompt({
                    turnResults,
                    dialogueTrace,
                    targetTurnIndex: i,
                    scenario: scenarioContext,
                    learnerContext: learnerCtxForTutor,
                  });
                  if (!prompt) continue;
                  const turnHash = createHash('sha256').update(prompt).digest('hex');
                  const parsed = await retryWithBackoff(async () => callJudge(prompt), {});
                  const ctid = turnResults[i]?.contentTurnId || null;
                  const r = normalizeTutorTurnResult(i, parsed, turnHash, ctid);
                  tutorTurnScores[r.turnIndex] = {
                    scores: r.scores,
                    overallScore: r.overallScore,
                    baseScore: r.baseScore,
                    recognitionScore: r.recognitionScore,
                    summary: r.summary,
                    judgeInputHash: r.judgeInputHash,
                    judgeTimestamp: r.judgeTimestamp,
                    judgeModel,
                    contentTurnId: r.contentTurnId,
                  };
                } catch (turnErr) {
                  log(`    tutor-turn-${i} FAIL: ${turnErr.message}`);
                }
              }
            }

            if (Object.keys(tutorTurnScores).length === 0) {
              return { phase: 'tutor-per-turn', success: false };
            }

            // Aggregate scores
            const overalls = Object.values(tutorTurnScores).map((s) => s.overallScore);
            const tutorOverall = overalls.reduce((a, b) => a + b, 0) / overalls.length;
            const tutorFirst = tutorTurnScores[0]?.overallScore ?? null;
            const lastTurnIdx = Math.max(...Object.keys(tutorTurnScores).map(Number));
            const tutorLast = tutorTurnScores[lastTurnIdx]?.overallScore ?? null;
            const tutorDevelopment = tutorFirst != null && tutorLast != null ? tutorLast - tutorFirst : null;

            evaluationStore.updateResultTutorScores(rowId, {
              tutorScores: tutorTurnScores,
              tutorOverallScore: tutorOverall,
              tutorFirstTurnScore: tutorFirst,
              tutorLastTurnScore: tutorLast,
              tutorDevelopmentScore: tutorDevelopment,
              judgeModel,
            });

            log(
              `    tutor-per-turn: ${Object.keys(tutorTurnScores).length} turns, first=${tutorFirst?.toFixed(1)} last=${tutorLast?.toFixed(1)} dev=${tutorDevelopment?.toFixed(1)}`,
            );
            return { phase: 'tutor-per-turn', success: true, score: tutorOverall };
          } catch (err) {
            log(`    tutor-per-turn scoring FAIL: ${err.message}`);
            return { phase: 'tutor-per-turn', success: false };
          }
        })(),
      );
      phaseLabels.push('tutor-per-turn');
    }

    // Phase 1: Per-turn learner scoring
    if (!skipLearner && learnerTurnTargets.length > 0) {
      promises.push(
        (async () => {
          try {
            const learnerTurnScores = {};

            if (learnerTurnTargets.length > 1) {
              // Attempt batched prompt first
              const batchedPrompt = buildBatchedLearnerPrompt({
                turns: reconstructedTurns,
                learnerTurnTargets,
                personaId: profileName,
                personaDescription,
                learnerArchitecture: isMultiAgent ? 'multi_agent' : 'unified',
                scenarioName: scenarioNameForLearner,
                topic: scenarioId,
              });
              if (batchedPrompt) {
                const parsed = await retryWithBackoff(async () => callJudge(batchedPrompt), {});
                if (Array.isArray(parsed.turns)) {
                  for (const turnData of parsed.turns) {
                    const lt = turnData.learner_turn_index ?? 0;
                    const turnOverall = calculateLearnerOverallScore(turnData.scores || {}, isMultiAgent);
                    learnerTurnScores[lt] = { scores: turnData.scores, overallScore: turnOverall };
                  }
                }
              }
            }

            // Fallback: score missing turns individually (all turns if batch failed, or just gaps)
            const missingLearnerTurns = learnerTurnTargets.filter(({ lt }) => !learnerTurnScores[lt]);
            if (missingLearnerTurns.length > 0) {
              if (Object.keys(learnerTurnScores).length > 0) {
                log(
                  `    learner-per-turn batch partial: got ${Object.keys(learnerTurnScores).length}/${learnerTurnTargets.length} turns, filling gaps [${missingLearnerTurns.map((t) => t.lt).join(',')}]`,
                );
              }
              for (const { lt, targetIdx } of missingLearnerTurns) {
                const prompt = buildLearnerEvaluationPrompt({
                  turns: reconstructedTurns,
                  targetTurnIndex: targetIdx,
                  personaId: profileName,
                  personaDescription,
                  learnerArchitecture: isMultiAgent ? 'multi_agent' : 'unified',
                  scenarioName: scenarioNameForLearner,
                  topic: scenarioId,
                });
                const parsed = await retryWithBackoff(async () => callJudge(prompt), {});
                const turnOverall = calculateLearnerOverallScore(parsed.scores || {}, isMultiAgent);
                learnerTurnScores[lt] = { scores: parsed.scores, overallScore: turnOverall };
              }
            }

            // Learner holistic
            let holisticResult = null;
            if (learnerTurns.length > 0) {
              const holisticPrompt = buildLearnerHolisticEvaluationPrompt({
                turns: reconstructedTurns,
                personaId: profileName,
                personaDescription,
                learnerArchitecture: isMultiAgent ? 'multi_agent' : 'unified',
                scenarioName: scenarioNameForLearner,
                topic: scenarioId,
              });
              const parsedHolistic = await retryWithBackoff(async () => callJudge(holisticPrompt), {});
              const holisticScores = parsedHolistic.scores || {};
              holisticResult = {
                holisticScores,
                holisticOverallScore: calculateLearnerOverallScore(holisticScores, isMultiAgent),
                holisticSummary: parsedHolistic.summary || null,
              };
            }

            // Echo detection: reject identical score vectors across turns
            const ltEntries = Object.values(learnerTurnScores);
            if (ltEntries.length >= 2) {
              const sigs = ltEntries.map((ts) =>
                Object.keys(ts.scores || {})
                  .sort()
                  .map((k) => `${k}=${typeof ts.scores[k] === 'object' ? ts.scores[k].score : ts.scores[k]}`)
                  .join(','),
              );
              if (sigs.every((s) => s === sigs[0])) {
                log(`    learner SKIP: all ${ltEntries.length} turns have identical scores (echoed example)`);
                return { phase: 'learner', success: false };
              }
            }

            // Write to DB
            const learnerAvg =
              Object.keys(learnerTurnScores).length > 0
                ? Object.values(learnerTurnScores).reduce((a, b) => a + b.overallScore, 0) /
                  Object.values(learnerTurnScores).length
                : null;

            const updateData = {
              scores: learnerTurnScores,
              overallScore: learnerAvg,
              judgeModel,
            };
            if (holisticResult) {
              updateData.holisticScores = holisticResult.holisticScores;
              updateData.holisticOverallScore = holisticResult.holisticOverallScore;
              updateData.holisticSummary = holisticResult.holisticSummary;
              updateData.holisticJudgeModel = judgeModel;
            }
            evaluationStore.updateResultLearnerScores(rowId, updateData);

            log(
              `    learner: avg=${learnerAvg?.toFixed(1) ?? '?'}${holisticResult ? ` holistic=${holisticResult.holisticOverallScore?.toFixed(1) ?? '?'}` : ''}`,
            );
            return { phase: 'learner', success: true, score: learnerAvg };
          } catch (err) {
            log(`    learner scoring FAIL: ${err.message}`);
            return { phase: 'learner', success: false };
          }
        })(),
      );
      phaseLabels.push('learner');
    }

    // Phase 2: Dialogue quality (public)
    if (!skipLearner) {
      const dqPromptParams = {
        turns: transcriptTurns,
        dialogueTrace,
        scenarioName: fullScenario.name,
        scenarioDescription: fullScenario.description,
        topic: fullScenario.topic || fullScenario.name,
        turnCount: totalTurns,
        learnerContext: learnerCtx,
        transcriptArtifacts,
      };

      promises.push(
        (async () => {
          try {
            const publicPrompt = rubricEvaluator.buildDialogueQualityPrompt({
              ...dqPromptParams,
              transcriptMode: 'public',
            });
            const publicParsed = await retryWithBackoff(async () => callJudge(publicPrompt), {});
            const publicScores = {};
            for (const [key, value] of Object.entries(publicParsed.scores || {})) {
              if (typeof value === 'object' && value !== null) {
                publicScores[key] = { score: value.score, reasoning: value.reasoning };
              } else if (typeof value === 'number') {
                publicScores[key] = { score: value, reasoning: null };
              }
            }
            const score =
              Object.keys(publicScores).length > 0
                ? rubricEvaluator.calculateDialogueQualityScore(publicScores)
                : publicParsed.overall_score;

            evaluationStore.updateDialogueQualityScore(rowId, {
              dialogueQualityScore: score,
              dialogueQualityScores: publicScores,
              dialogueQualitySummary: publicParsed.summary || null,
              dialogueQualityJudgeModel: judgeModel,
            });
            log(`    dialogue-quality(public)=${score?.toFixed(1)}`);
            return { phase: 'dgp', success: true, score };
          } catch (err) {
            log(`    dialogue-quality(public) FAIL: ${err.message}`);
            return { phase: 'dgp', success: false };
          }
        })(),
      );
      phaseLabels.push('dgp');

      // Phase 3: Dialogue quality (internal)
      promises.push(
        (async () => {
          try {
            const fullPrompt = rubricEvaluator.buildDialogueQualityPrompt({
              ...dqPromptParams,
              transcriptMode: 'full',
            });
            const fullParsed = await retryWithBackoff(async () => callJudge(fullPrompt), {});
            const fullScores = {};
            for (const [key, value] of Object.entries(fullParsed.scores || {})) {
              if (typeof value === 'object' && value !== null) {
                fullScores[key] = { score: value.score, reasoning: value.reasoning };
              } else if (typeof value === 'number') {
                fullScores[key] = { score: value, reasoning: null };
              }
            }
            const score =
              Object.keys(fullScores).length > 0
                ? rubricEvaluator.calculateDialogueQualityScore(fullScores)
                : fullParsed.overall_score;

            evaluationStore.updateDialogueQualityInternalScore(rowId, {
              dialogueQualityInternalScore: score,
              dialogueQualityInternalScores: fullScores,
              dialogueQualityInternalSummary: fullParsed.summary || null,
            });
            log(`    dialogue-quality(full)=${score?.toFixed(1)}`);
            return { phase: 'dgi', success: true, score };
          } catch (err) {
            log(`    dialogue-quality(full) FAIL: ${err.message}`);
            return { phase: 'dgi', success: false };
          }
        })(),
      );
      phaseLabels.push('dgi');
    }

    // Phase 4: Tutor holistic (only for multi-turn)
    if (!skipLearner && totalTurns > 1) {
      promises.push(
        (async () => {
          try {
            const hasRecognition = result.factorRecognition || profileName.includes('recog');
            const holisticPrompt = rubricEvaluator.buildTutorHolisticEvaluationPrompt({
              turns: transcriptTurns,
              dialogueTrace,
              scenarioName: fullScenario.name || scenarioId,
              scenarioDescription: fullScenario.description,
              learnerContext: learnerCtx,
              hasRecognition,
              transcriptArtifacts,
            });
            const parsedHolistic = await retryWithBackoff(async () => callJudge(holisticPrompt), {});
            const holisticScores = parsedHolistic.scores || {};
            const score = rubricEvaluator.calculateTutorHolisticScore(holisticScores, hasRecognition);

            evaluationStore.updateResultTutorHolisticScores(rowId, {
              holisticScores,
              holisticOverallScore: score,
              holisticSummary: parsedHolistic.summary || null,
              holisticJudgeModel: judgeModel,
            });
            log(`    tutor-holistic=${score?.toFixed(1)}`);
            return { phase: 'tutor-holistic', success: true, score };
          } catch (err) {
            log(`    tutor-holistic FAIL: ${err.message}`);
            return { phase: 'tutor-holistic', success: false };
          }
        })(),
      );
      phaseLabels.push('tutor-holistic');
    }

    // Phase 5: Tutor deliberation (gated by hasTutorSuperego)
    if (!skipDeliberation && rubricEvaluator.hasTutorSuperego(dialogueTrace)) {
      const deliberationParams = {
        turns: transcriptTurns,
        dialogueTrace,
        scenarioName: fullScenario.name || scenarioId,
        scenarioDescription: fullScenario.description,
        learnerContext: learnerCtx,
      };
      promises.push(
        (async () => {
          try {
            const prompt = rubricEvaluator.buildTutorDeliberationPrompt(deliberationParams);
            const parsed = await retryWithBackoff(async () => callJudge(prompt), {});
            const scores = parsed.scores || {};
            const score =
              Object.keys(scores).length > 0
                ? rubricEvaluator.calculateDeliberationScore(scores)
                : parsed.overall_score;

            evaluationStore.updateTutorDeliberationScores(rowId, {
              deliberationScores: scores,
              deliberationScore: score,
              deliberationSummary: parsed.summary || null,
              deliberationJudgeModel: judgeModel,
            });
            log(`    tutor-deliberation=${score?.toFixed(1)}`);
            return { phase: 'tutor-delib', success: true, score };
          } catch (err) {
            log(`    tutor-deliberation FAIL: ${err.message}`);
            return { phase: 'tutor-delib', success: false };
          }
        })(),
      );
      phaseLabels.push('tutor-delib');
    }

    // Phase 6: Learner deliberation (gated by isMultiAgent)
    if (!skipDeliberation && isMultiAgent) {
      const deliberationParams = {
        turns: transcriptTurns,
        dialogueTrace,
        scenarioName: fullScenario.name || scenarioId,
        scenarioDescription: fullScenario.description,
        learnerContext: learnerCtx,
      };
      promises.push(
        (async () => {
          try {
            const prompt = rubricEvaluator.buildLearnerDeliberationPrompt(deliberationParams);
            const parsed = await retryWithBackoff(async () => callJudge(prompt), {});
            const scores = parsed.scores || {};
            const score =
              Object.keys(scores).length > 0
                ? rubricEvaluator.calculateDeliberationScore(scores)
                : parsed.overall_score;

            evaluationStore.updateLearnerDeliberationScores(rowId, {
              deliberationScores: scores,
              deliberationScore: score,
              deliberationSummary: parsed.summary || null,
              deliberationJudgeModel: judgeModel,
            });
            log(`    learner-deliberation=${score?.toFixed(1)}`);
            return { phase: 'learner-delib', success: true, score };
          } catch (err) {
            log(`    learner-deliberation FAIL: ${err.message}`);
            return { phase: 'learner-delib', success: false };
          }
        })(),
      );
      phaseLabels.push('learner-delib');
    }

    // Phase 7: Process measures (no judge call, just extract from dialogue log)
    const tm = dialogueLog.transformationMetrics;
    if (tm) {
      evaluationStore.updateProcessMeasures(rowId, {
        adaptationIndex: tm.tutorAdaptationIndex ?? null,
        learnerGrowthIndex: tm.learnerGrowthIndex ?? null,
        bilateralTransformationIndex: tm.bilateralTransformationIndex ?? null,
        incorporationRate: tm.superegoMetrics?.incorporationRate ?? null,
        dimensionConvergence: tm.dimensionConvergence ?? null,
        transformationQuality: tm.transformationQuality ?? null,
      });
    }

    // Wait for all judge phases
    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  /**
   * Re-judge all results in an existing run without regenerating tutor responses.
   *
   * By default, creates NEW rows preserving judgment history (for inter-judge reliability).
   * Use --overwrite to replace existing scores instead.
   *
   * @param {string} runId - The run to rejudge
   * @param {Object} options
   * @param {string} [options.judgeOverride] - Override judge model (e.g. 'openrouter.nemotron')
   * @param {string} [options.judgeCli] - CLI judge backend ('claude', 'gemini', 'codex')
   * @param {string} [options.judgeCliModel] - Optional CLI judge model override
   * @param {string} [options.judgeCliEffort] - Optional CLI reasoning-effort override
   * @param {boolean} [options.verbose] - Show per-result progress
   * @param {string} [options.scenarioFilter] - Only rejudge results for this scenario ID
   * @param {number} [options.parallelism] - Concurrent judge calls (default 3)
   * @param {boolean} [options.overwrite] - If true, update existing rows instead of creating new ones
   * @param {boolean} [options.skipLearner] - Skip learner, dialogue, and holistic scoring (tutor-only rejudge)
   * @param {boolean} [options.skipDeliberation] - Skip deliberation scoring
   * @returns {Promise<Object>} Summary stats
   */
  async function rejudgeRun(runId, options = {}) {
    const {
      judgeOverride = null,
      judgeCli = null,
      judgeCliModel = null,
      judgeCliEffort = null,
      verbose = false,
      scenarioFilter = null,
      parallelism = DEFAULT_PARALLELISM,
      overwrite = false,
      skipLearner = false,
      skipDeliberation = false,
      limit = null,
      sourceJudge = null,
    } = options;

    const log = verbose ? console.log : () => {};

    const run = evaluationStore.getRun(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);

    if (judgeOverride && judgeCli) {
      throw new Error('Use either judgeOverride or judgeCli, not both');
    }
    if (judgeCli && !SUPPORTED_JUDGE_CLIS.has(String(judgeCli).toLowerCase())) {
      throw new Error(`Unsupported judge CLI: ${judgeCli}`);
    }

    let results = evaluationStore.getResults(runId, {
      scenarioId: scenarioFilter || null,
    });

    // Skip results that have no suggestions (errors / failed generation)
    results = results.filter((r) => r.success && r.suggestions?.length > 0);

    // Filter by source judge if specified (e.g. only rejudge rows originally scored by Sonnet)
    if (sourceJudge) {
      const before = results.length;
      results = results.filter((r) => r.judgeModel && r.judgeModel.includes(sourceJudge));
      console.log(`  Source judge filter: "${sourceJudge}" → ${results.length} of ${before} rows`);
    }

    if (results.length === 0) {
      throw new Error('No successful results with suggestions found to rejudge');
    }

    // Resolve the target judge label — used for dedup (resume mode) AND overwrite safety
    let targetJudgeLabel = null;
    const effectiveCliJudgeModel = judgeCli ? judgeCliModel || getDefaultCliJudgeModelOverride(judgeCli) : null;
    try {
      if (judgeCli) {
        targetJudgeLabel = getCliJudgeModelLabel(judgeCli, effectiveCliJudgeModel, judgeCliEffort);
      } else {
        const judge = rubricEvaluator.getAvailableJudge(
          judgeOverride ? { judgeOverride: { model: judgeOverride } } : {},
        );
        targetJudgeLabel = rubricEvaluator.normalizeJudgeLabel(judge.provider, judge.model);
      }
    } catch {
      // If we can't resolve, skip the cross-call dedup (fall back to within-call dedup only)
    }

    // Helper: check whether a row has complete multi-turn scores (all scoring phases done)
    function hasCompleteScores(r) {
      // Parse suggestions if stored as JSON string
      let suggs = r.suggestions;
      if (typeof suggs === 'string') {
        try {
          suggs = JSON.parse(suggs);
        } catch {
          suggs = [];
        }
      }
      // Single-turn: just needs tutor_first_turn_score
      const isMultiTurn = r.dialogueId && ((Array.isArray(suggs) && suggs.length > 1) || r.dialogueRounds > 1);
      if (!isMultiTurn) return r.tutorFirstTurnScore != null;
      // Multi-turn: needs per-turn tutor scores + first-turn + last-turn + dialogue quality + learner
      return (
        r.tutorScores != null &&
        r.tutorFirstTurnScore != null &&
        r.tutorLastTurnScore != null &&
        r.dialogueQualityScore != null &&
        r.dialogueQualityScores != null &&
        r.learnerOverallScore != null
      );
    }

    // Build a map of exact generation identities → existing rows judged by the target judge.
    // In resume mode (default, no --overwrite): skip rows with COMPLETE scores.
    // Rows with incomplete scores (e.g. pre-fix single-shot only) are re-processed.
    // IMPORTANT: Must scan ALL rows in the run, not just source-filtered `results`,
    // because the target judge's rows won't be in `results` when sourceJudge differs.
    const existingRowsByTarget = new Map(); // generation identity → row
    const allRowsById = new Map(); // id → row (for target row lookup in safety guard)
    if (targetJudgeLabel) {
      const allRunRows = evaluationStore.getResults(runId, {
        scenarioId: scenarioFilter || null,
      });
      for (const r of allRunRows) {
        allRowsById.set(r.id, r);
        if (r.judgeModel === targetJudgeLabel) {
          existingRowsByTarget.set(evaluationStore.generationIdentity(r), r);
        }
      }
    }

    // Deduplicate exact generations, not response text. Identical prose in two
    // scenario/transcript contexts is two distinct reliability items.
    const seenGenerations = new Set();
    const uniqueResults = [];
    let skippedComplete = 0;
    let resumeIncomplete = 0;
    for (const r of results) {
      const identity = evaluationStore.generationIdentity(r);
      if (seenGenerations.has(identity)) continue;
      seenGenerations.add(identity);
      // Check if the target judge already scored this exact generation.
      const existing = existingRowsByTarget.get(identity);
      if (existing) {
        if (hasCompleteScores(existing)) {
          skippedComplete++;
          continue; // Fully scored — skip
        }
        // Incomplete scores — re-process with overwrite behavior on that row
        r._overwriteRowId = existing.id;
        resumeIncomplete++;
      }
      uniqueResults.push(r);
    }

    const _skipped = results.length - uniqueResults.length - resumeIncomplete;
    results = uniqueResults;

    // Apply --limit if specified
    if (limit != null && limit > 0 && results.length > limit) {
      console.log(`  Limiting to ${limit} of ${results.length} eligible results`);
      results = results.slice(0, limit);
    }

    console.log(
      `\nRejudging ${results.length} unique results from run ${runId}${skippedComplete > 0 ? ` (skipping ${skippedComplete} already complete)` : ''}${resumeIncomplete > 0 ? ` (resuming ${resumeIncomplete} incomplete)` : ''}`,
    );
    if (judgeOverride) console.log(`  Judge override: ${judgeOverride}`);
    if (judgeCli)
      console.log(`  Judge CLI: ${judgeCli}${effectiveCliJudgeModel ? ` (${effectiveCliJudgeModel})` : ''}`);
    if (scenarioFilter) console.log(`  Scenario filter: ${scenarioFilter}`);

    // Capture old scores for before/after comparison
    const oldScores = results.map((r) => r.tutorFirstTurnScore).filter((s) => s != null);
    const oldAvg = oldScores.length > 0 ? oldScores.reduce((a, b) => a + b, 0) / oldScores.length : null;

    let completed = 0;
    let succeeded = 0;
    let failed = 0;
    const newScores = [];

    // Build judge override object if provided
    // rubricEvaluator expects { judgeOverride: { model: "..." } }
    const judgeOverrideObj = judgeOverride ? { judgeOverride: { model: judgeOverride } } : {};

    // Reset usage accumulator for cost tracking
    rubricEvaluator.resetUsageAccumulator();

    // Parallel worker pool (same pattern as main eval loop)
    const items = [...results];
    let index = 0;

    async function worker() {
      while (index < items.length) {
        const i = index++;
        const result = items[i];

        try {
          const resolved = resolveRejudgeScenarioAndDialogueLog(result);
          const fullScenario = resolved.scenario;
          const dialogueLog = resolved.dialogueLog;
          if (!fullScenario) {
            throw new Error(`Scenario not found: ${result.scenarioId}`);
          }

          const suggestion =
            result.dialogueId && result.suggestions.length > 1
              ? result.suggestions[result.suggestions.length - 1]
              : result.suggestions[0];

          // Load dialogue context for multi-turn results
          let dialogueContext = null;
          if (dialogueLog?.isMultiTurn && dialogueLog.dialogueTrace?.length > 0) {
            dialogueContext = {
              consolidatedTrace: dialogueLog.dialogueTrace,
              conversationHistory: (dialogueLog.turnResults || []).map((t, ti) => ({
                turnIndex: ti,
                turnId: t.turnId,
                suggestion: t.suggestions?.[0],
                learnerAction: t.learnerAction,
                learnerMessage: t.learnerMessage,
              })),
            };
          }

          const scenarioContext = {
            name: fullScenario.name,
            description: fullScenario.description,
            expectedBehavior: fullScenario.expected_behavior,
            learnerContext: fullScenario.learner_context,
            requiredElements: fullScenario.required_elements,
            forbiddenElements: fullScenario.forbidden_elements,
          };

          const evaluation = judgeCli
            ? await retryWithBackoff(async () => {
                const prompt = rubricEvaluator.buildEvaluationPrompt(suggestion, scenarioContext, { dialogueContext });
                const startTime = Date.now();
                const parsed = await callCliJudge(prompt, judgeCli, effectiveCliJudgeModel, judgeCliEffort);
                return normalizeCliJudgeEvaluation(
                  parsed,
                  getCliJudgeModelLabel(judgeCli, effectiveCliJudgeModel, judgeCliEffort),
                  Date.now() - startTime,
                );
              }, {})
            : await retryWithBackoff(
                () =>
                  rubricEvaluator.evaluateSuggestion(
                    suggestion,
                    scenarioContext,
                    { dialogueContext },
                    judgeOverrideObj,
                  ),
                {},
              );

          if (evaluation.success) {
            // Map evaluationTimeMs → judgeLatencyMs for DB storage
            evaluation.judgeLatencyMs = evaluation.evaluationTimeMs ?? null;
            let rowId;
            let modeLabel;
            if (overwrite || result._overwriteRowId) {
              // Update in place: explicit --overwrite, or resuming an incomplete row
              const targetId = result._overwriteRowId || result.id;
              // SAFETY: never overwrite a row belonging to a different judge
              // Use allRowsById (all run rows) — `results` is source-filtered and won't contain target judge rows
              const targetRow = result._overwriteRowId ? allRowsById.get(targetId) || result : result;
              if (targetJudgeLabel && targetRow.judgeModel && targetRow.judgeModel !== targetJudgeLabel) {
                // Row belongs to a different judge — create new row instead of overwriting
                rowId = evaluationStore.storeRejudgment(result, evaluation);
                modeLabel = `added — refused to overwrite ${targetRow.judgeModel} row`;
              } else {
                evaluationStore.updateResultScores(targetId, evaluation);
                rowId = targetId;
                modeLabel = result._overwriteRowId ? 'resumed' : 'replaced';
              }
            } else {
              // Create new row (preserves history for reliability analysis)
              rowId = evaluationStore.storeRejudgment(result, evaluation);
              modeLabel = 'added';
            }
            succeeded++;
            if (evaluation.overallScore != null) newScores.push(evaluation.overallScore);
            // Always print one line per row so the user can see progress
            const sourceLabel = result.judgeModel || 'source';
            console.log(
              `  [${completed + 1}/${results.length}] ${result.scenarioId} / ${result.profileName}: ${evaluation.overallScore?.toFixed(1)} (${modeLabel}, ${sourceLabel}: ${result.tutorFirstTurnScore?.toFixed(1) ?? '--'})`,
            );

            // Multi-turn: score learner, dialogue, holistic, deliberation
            if (result.dialogueId && dialogueLog?.isMultiTurn) {
              const judgeModelLabel = judgeCli
                ? getCliJudgeModelLabel(judgeCli, effectiveCliJudgeModel, judgeCliEffort)
                : evaluation.judgeModel || null;
              try {
                await scoreMultiTurnRejudgment(rowId, result, dialogueLog, {
                  judgeCli,
                  judgeModel: judgeModelLabel,
                  effectiveCliJudgeModel,
                  judgeCliEffort,
                  judgeOverrideObj,
                  log,
                  skipLearner,
                  skipDeliberation,
                });
              } catch (mtErr) {
                log(`    multi-turn scoring error: ${mtErr.message}`);
              }
            }
          } else {
            failed++;
            console.log(
              `  [${completed + 1}/${results.length}] ${result.scenarioId} / ${result.profileName}: JUDGE FAILED - ${evaluation.error}`,
            );
          }
        } catch (error) {
          failed++;
          console.log(
            `  [${completed + 1}/${results.length}] ${result.scenarioId} / ${result.profileName}: ERROR - ${error.message}`,
          );
        }

        completed++;
        await sleep(REQUEST_DELAY_MS);
      }
    }

    const workers = Array.from({ length: Math.min(parallelism, items.length) }, () => worker());
    await Promise.all(workers);

    const newAvg = newScores.length > 0 ? newScores.reduce((a, b) => a + b, 0) / newScores.length : null;
    const usage = rubricEvaluator.getUsageAccumulator();

    return {
      runId,
      total: results.length,
      succeeded,
      failed,
      oldAvgScore: oldAvg,
      newAvgScore: newAvg,
      scoreDelta: oldAvg != null && newAvg != null ? newAvg - oldAvg : null,
      usage,
    };
  }

  return { rejudgeRun };
}
