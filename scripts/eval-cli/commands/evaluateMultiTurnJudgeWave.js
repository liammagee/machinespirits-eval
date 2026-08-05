export async function runMultiTurnJudgeWave(state, context) {
  const {
    result,
    tag,
    scenarioId,
    profileName,
    scenario,
    turnResults,
    dialogueTrace,
    totalTurns,
    transcriptTurns,
    learnerCtx,
    transcriptArtifacts,
    scenarioContext,
    dimensionMap,
    learnerTurns,
    reconstructedTurns,
    isMultiAgent,
    personaDescription,
    scenarioNameForLearner,
    learnerTurnTargets,
    dqPromptParams,
  } = state;
  const {
    buildBatchedLearnerPrompt,
    buildBatchedPerTurnTutorPrompt,
    buildDialogueQualityPrompt,
    buildLearnerDeliberationPrompt,
    buildLearnerEvaluationPrompt,
    buildLearnerHolisticEvaluationPrompt,
    buildPerTurnTutorEvaluationPrompt,
    buildTutorDeliberationPrompt,
    buildTutorHolisticEvaluationPrompt,
    calculateBaseScore,
    calculateDeliberationScore,
    calculateDialogueQualityScore,
    calculateLearnerOverallScore,
    calculateOverallScore,
    calculateRecognitionScore,
    calculateTutorHolisticScore,
    callClaudeJudge,
    createHash,
    hasTutorSuperego,
    skipDeliberation,
    tutorOnly,
    verbose,
  } = context;
  // ════════════════════════════════════════════
  // Wave 1: All independent judge calls (concurrent)
  // ════════════════════════════════════════════

  // Per-turn tutor scoring: batch N turns into 1 subprocess when possible
  const tutorPromises = [];

  // Helper: normalize a single turn's parsed scores
  function normalizeTutorTurnResult(turnIndex, parsed, judgeInputHash) {
    const normalizedScores = {};
    for (const [key, value] of Object.entries(parsed.scores || {})) {
      const normalizedKey = dimensionMap[key] || key;
      if (typeof value === 'object' && value !== null) {
        normalizedScores[normalizedKey] = { score: value.score, reasoning: value.reasoning };
      } else if (typeof value === 'number') {
        normalizedScores[normalizedKey] = { score: value, reasoning: null };
      }
    }
    const overallScore =
      Object.keys(normalizedScores).length > 0 ? calculateOverallScore(normalizedScores) : parsed.overall_score;

    return {
      turnIndex,
      success: true,
      scores: normalizedScores,
      overallScore,
      baseScore: calculateBaseScore(normalizedScores),
      recognitionScore: calculateRecognitionScore(normalizedScores),
      summary: parsed.summary,
      judgeInputHash,
      judgeTimestamp: new Date().toISOString(),
    };
  }

  if (totalTurns > 1) {
    // Multi-turn: attempt batched prompt (N turns → 1 subprocess)
    tutorPromises.push(
      (async () => {
        try {
          const batchedPrompt = buildBatchedPerTurnTutorPrompt({
            turnResults,
            dialogueTrace,
            scenario: scenarioContext,
            learnerContext: learnerCtx,
          });
          if (!batchedPrompt) return { batched: true, results: [] };

          const judgeInputHash = createHash('sha256').update(batchedPrompt).digest('hex');
          if (verbose) console.log(`${tag}   tutor-batch (${totalTurns} turns) ... calling claude`);
          const parsed = await callClaudeJudge(batchedPrompt);

          if (!Array.isArray(parsed.turns)) {
            throw new Error('Batched response missing "turns" array');
          }

          const results = parsed.turns.map((turnData) => {
            return normalizeTutorTurnResult(turnData.turn_index, turnData, judgeInputHash);
          });

          return { batched: true, success: true, results };
        } catch (err) {
          const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
          console.log(`${tag}   tutor-batch ... FAIL (falling back to per-turn): ${msg}`);
          if (verbose) console.error(err);
          return { batched: true, success: false };
        }
      })(),
    );
  } else {
    // Single-turn: use individual prompt (no batching benefit)
    tutorPromises.push(
      (async () => {
        const turnIndex = 0;
        const turnTag = `${tag}   tutor-turn-${turnIndex}`;
        try {
          const prompt = buildPerTurnTutorEvaluationPrompt({
            turnResults,
            dialogueTrace,
            targetTurnIndex: turnIndex,
            scenario: scenarioContext,
            learnerContext: learnerCtx,
          });

          if (!prompt) {
            if (verbose) console.log(`${turnTag} ... SKIP (no suggestion)`);
            return { turnIndex, skipped: true };
          }

          const judgeInputHash = createHash('sha256').update(prompt).digest('hex');
          if (verbose) console.log(`${turnTag} ... calling claude`);
          const parsed = await callClaudeJudge(prompt);
          return normalizeTutorTurnResult(turnIndex, parsed, judgeInputHash);
        } catch (err) {
          const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
          console.log(`${turnTag} ... FAIL: ${msg}`);
          if (verbose) console.error(err);
          return { turnIndex, success: false };
        }
      })(),
    );
  }

  // Per-turn learner scoring: batch M turns into 1 subprocess when possible
  const learnerPromises = [];

  // Helper: normalize a single learner turn result
  function normalizeLearnerTurnResult(lt, parsed, judgeInputHash) {
    const turnOverall = calculateLearnerOverallScore(parsed.scores || {}, isMultiAgent);
    return {
      lt,
      success: true,
      turnIndex: lt + 1,
      scores: parsed.scores,
      overallScore: turnOverall,
      summary: parsed.summary,
      judgeInputHash,
      judgeTimestamp: new Date().toISOString(),
    };
  }

  if (learnerTurnTargets.length > 1) {
    // Multi-turn: attempt batched prompt (M turns → 1 subprocess)
    learnerPromises.push(
      (async () => {
        try {
          const batchedPrompt = buildBatchedLearnerPrompt({
            turns: reconstructedTurns,
            learnerTurnTargets,
            personaId: profileName,
            personaDescription,
            learnerArchitecture: isMultiAgent ? 'multi_agent' : 'unified',
            scenarioName: scenarioNameForLearner,
            topic: scenarioId,
          });
          if (!batchedPrompt) return { batched: true, results: [] };

          const judgeInputHash = createHash('sha256').update(batchedPrompt).digest('hex');
          if (verbose) console.log(`${tag}   learner-batch (${learnerTurnTargets.length} turns) ... calling claude`);
          const parsed = await callClaudeJudge(batchedPrompt);

          if (!Array.isArray(parsed.turns)) {
            throw new Error('Batched response missing "turns" array');
          }

          const results = parsed.turns.map((turnData, i) => {
            const lt = turnData.learner_turn_index ?? i;
            return normalizeLearnerTurnResult(lt, turnData, judgeInputHash);
          });

          return { batched: true, success: true, results };
        } catch (err) {
          const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
          console.log(`${tag}   learner-batch ... FAIL (falling back to per-turn): ${msg}`);
          if (verbose) console.error(err);
          return { batched: true, success: false };
        }
      })(),
    );
  } else {
    // Single learner turn or no turns: use individual prompt
    for (const { lt, targetIdx } of learnerTurnTargets) {
      learnerPromises.push(
        (async () => {
          const turnTag = `${tag}   learner-turn-${lt}`;
          try {
            const prompt = buildLearnerEvaluationPrompt({
              turns: reconstructedTurns,
              targetTurnIndex: targetIdx,
              personaId: profileName,
              personaDescription,
              learnerArchitecture: isMultiAgent ? 'multi_agent' : 'unified',
              scenarioName: scenarioNameForLearner,
              topic: scenarioId,
            });

            const judgeInputHash = createHash('sha256').update(prompt).digest('hex');
            if (verbose) console.log(`${turnTag} ... calling claude`);
            const parsed = await callClaudeJudge(prompt);
            return normalizeLearnerTurnResult(lt, parsed, judgeInputHash);
          } catch (err) {
            const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
            console.log(`${turnTag} ... FAIL: ${msg}`);
            if (verbose) console.error(err);
            return { lt, success: false };
          }
        })(),
      );
    }
  }

  // Dialogue quality promises (DgP + DgI)
  const dgpPromise = dqPromptParams
    ? (async () => {
        try {
          const publicPrompt = buildDialogueQualityPrompt({ ...dqPromptParams, transcriptMode: 'public' });
          const judgeInputHash = createHash('sha256').update(publicPrompt).digest('hex');
          const publicParsed = await callClaudeJudge(publicPrompt);
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
              ? calculateDialogueQualityScore(publicScores)
              : publicParsed.overall_score;
          return {
            success: true,
            scores: publicScores,
            score,
            summary: publicParsed.summary,
            judgeInputHash,
            judgeTimestamp: new Date().toISOString(),
          };
        } catch (err) {
          const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
          console.log(`${tag}   dialogue-quality(public) ... FAIL: ${msg}`);
          if (verbose) console.error(err);
          return { success: false };
        }
      })()
    : Promise.resolve(null);

  const dgiPromise = dqPromptParams
    ? (async () => {
        try {
          const fullPrompt = buildDialogueQualityPrompt({ ...dqPromptParams, transcriptMode: 'full' });
          const judgeInputHash = createHash('sha256').update(fullPrompt).digest('hex');
          const fullParsed = await callClaudeJudge(fullPrompt);
          const fullScores = {};
          for (const [key, value] of Object.entries(fullParsed.scores || {})) {
            if (typeof value === 'object' && value !== null) {
              fullScores[key] = { score: value.score, reasoning: value.reasoning };
            } else if (typeof value === 'number') {
              fullScores[key] = { score: value, reasoning: null };
            }
          }
          const score =
            Object.keys(fullScores).length > 0 ? calculateDialogueQualityScore(fullScores) : fullParsed.overall_score;
          return {
            success: true,
            scores: fullScores,
            score,
            summary: fullParsed.summary,
            judgeInputHash,
            judgeTimestamp: new Date().toISOString(),
          };
        } catch (err) {
          const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
          console.log(`${tag}   dialogue-quality(full) ... FAIL: ${msg}`);
          if (verbose) console.error(err);
          return { success: false };
        }
      })()
    : Promise.resolve(null);

  // Deliberation quality promises (tutor + learner, multi-agent only)
  const hasTutorDelib = !skipDeliberation && !tutorOnly && hasTutorSuperego(dialogueTrace);
  const hasLearnerDelib = !skipDeliberation && !tutorOnly && isMultiAgent;
  const deliberationPromptParams = {
    turns: transcriptTurns,
    dialogueTrace,
    scenarioName: scenario.name || scenarioId,
    scenarioDescription: scenario.description,
    learnerContext: learnerCtx,
  };

  const tutorDelibPromise = hasTutorDelib
    ? (async () => {
        const delibTag = `${tag}   tutor-deliberation`;
        try {
          const prompt = buildTutorDeliberationPrompt(deliberationPromptParams);
          const judgeInputHash = createHash('sha256').update(prompt).digest('hex');
          if (verbose) console.log(`${delibTag} ... calling claude`);
          const parsed = await callClaudeJudge(prompt);
          const scores = parsed.scores || {};
          const score = Object.keys(scores).length > 0 ? calculateDeliberationScore(scores) : parsed.overall_score;
          return {
            success: true,
            scores,
            score,
            summary: parsed.summary,
            judgeInputHash,
            judgeTimestamp: new Date().toISOString(),
          };
        } catch (err) {
          const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
          console.log(`${delibTag} ... FAIL: ${msg}`);
          if (verbose) console.error(err);
          return { success: false };
        }
      })()
    : Promise.resolve(null);

  const learnerDelibPromise = hasLearnerDelib
    ? (async () => {
        const delibTag = `${tag}   learner-deliberation`;
        try {
          const prompt = buildLearnerDeliberationPrompt(deliberationPromptParams);
          const judgeInputHash = createHash('sha256').update(prompt).digest('hex');
          if (verbose) console.log(`${delibTag} ... calling claude`);
          const parsed = await callClaudeJudge(prompt);
          const scores = parsed.scores || {};
          const score = Object.keys(scores).length > 0 ? calculateDeliberationScore(scores) : parsed.overall_score;
          return {
            success: true,
            scores,
            score,
            summary: parsed.summary,
            judgeInputHash,
            judgeTimestamp: new Date().toISOString(),
          };
        } catch (err) {
          const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
          console.log(`${delibTag} ... FAIL: ${msg}`);
          if (verbose) console.error(err);
          return { success: false };
        }
      })()
    : Promise.resolve(null);

  // Holistic promises (no dependency on per-turn scores — use totalTurns gate)
  const tutorHolisticPromise =
    totalTurns > 1 && !tutorOnly
      ? (async () => {
          const holisticTutorTag = `${tag}   tutor-holistic`;
          const hasRecognition = result.factors?.recognition || profileName.includes('recog');
          try {
            const holisticPrompt = buildTutorHolisticEvaluationPrompt({
              turns: transcriptTurns,
              dialogueTrace,
              scenarioName: scenario.name || scenarioId,
              scenarioDescription: scenario.description,
              learnerContext: learnerCtx,
              hasRecognition,
              transcriptArtifacts,
            });

            const judgeInputHash = createHash('sha256').update(holisticPrompt).digest('hex');
            if (verbose) console.log(`${holisticTutorTag} ... calling claude`);
            const parsedHolistic = await callClaudeJudge(holisticPrompt);
            const holisticScores = parsedHolistic.scores || {};
            const score = calculateTutorHolisticScore(holisticScores, hasRecognition);

            return {
              success: true,
              score,
              holisticScores,
              summary: parsedHolistic.summary,
              judgeInputHash,
              judgeTimestamp: new Date().toISOString(),
            };
          } catch (err) {
            const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
            console.log(`${holisticTutorTag} ... FAIL: ${msg}`);
            if (verbose) console.error(err);
            return { success: false };
          }
        })()
      : Promise.resolve(null);

  const learnerHolisticPromise =
    !tutorOnly && learnerTurns.length > 0
      ? (async () => {
          const holisticTag = `${tag}   learner-holistic`;
          try {
            const holisticPrompt = buildLearnerHolisticEvaluationPrompt({
              turns: reconstructedTurns,
              personaId: profileName,
              personaDescription,
              learnerArchitecture: isMultiAgent ? 'multi_agent' : 'unified',
              scenarioName: scenarioNameForLearner,
              topic: scenarioId,
            });

            const judgeInputHash = createHash('sha256').update(holisticPrompt).digest('hex');
            if (verbose) console.log(`${holisticTag} ... calling claude`);
            const parsedHolistic = await callClaudeJudge(holisticPrompt);
            const holisticScores = parsedHolistic.scores || {};
            const holisticOverallScore = calculateLearnerOverallScore(holisticScores, isMultiAgent);

            return {
              success: true,
              score: holisticOverallScore,
              holisticScores,
              summary: parsedHolistic.summary,
              judgeInputHash,
              judgeTimestamp: new Date().toISOString(),
            };
          } catch (err) {
            const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
            console.log(`${holisticTag} ... FAIL: ${msg}`);
            if (verbose) console.error(err);
            return { success: false };
          }
        })()
      : Promise.resolve(null);

  // Fire all independent judge calls concurrently (single wave)
  const [
    tutorSettled,
    learnerSettled,
    dgpResult,
    dgiResult,
    tutorDelibResult,
    learnerDelibResult,
    tutorHolisticResult,
    learnerHolisticResult,
  ] = await Promise.all([
    Promise.allSettled(tutorPromises),
    Promise.allSettled(learnerPromises),
    dgpPromise,
    dgiPromise,
    tutorDelibPromise,
    learnerDelibPromise,
    tutorHolisticPromise,
    learnerHolisticPromise,
  ]);

  return {
    tutorSettled,
    learnerSettled,
    dgpResult,
    dgiResult,
    tutorDelibResult,
    learnerDelibResult,
    tutorHolisticResult,
    learnerHolisticResult,
    normalizeTutorTurnResult,
    normalizeLearnerTurnResult,
  };
}
