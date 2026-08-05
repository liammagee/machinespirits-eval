export async function persistMultiTurnEvaluation(state, wave, context) {
  const {
    result,
    tag,
    startTime,
    scenarioId,
    profileName,
    judgeModel,
    dialogueLog,
    turnResults,
    dialogueTrace,
    totalTurns,
    learnerCtx,
    scenarioContext,
    reconstructedTurns,
    isMultiAgent,
    personaDescription,
    scenarioNameForLearner,
    learnerTurnTargets,
  } = state;
  const {
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
  } = wave;
  const {
    buildLearnerEvaluationPrompt,
    buildPerTurnTutorEvaluationPrompt,
    callClaudeJudge,
    createHash,
    evaluationStore,
    tutorOnly,
    verbose,
  } = context;
  // ── P0 Provenance: build contentTurnId map from dialogue log ──
  const turnContentIds = {};
  for (const tr of turnResults) {
    if (tr.contentTurnId) {
      turnContentIds[tr.turnIndex ?? turnResults.indexOf(tr)] = tr.contentTurnId;
    }
  }

  // ── Process tutor per-turn results ──
  const tutorTurnScores = {};
  let needsTutorFallback = false;

  // Helper: store a single tutor turn result
  function storeTutorTurnResult(r) {
    if (!r || r.skipped || !r.success) return;
    tutorTurnScores[r.turnIndex] = {
      scores: r.scores,
      overallScore: r.overallScore,
      baseScore: r.baseScore,
      recognitionScore: r.recognitionScore,
      summary: r.summary,
      judgeInputHash: r.judgeInputHash,
      judgeTimestamp: r.judgeTimestamp,
      judgeModel,
      contentTurnId: turnContentIds[r.turnIndex] || null,
    };
    const dimScores = Object.entries(r.scores)
      .map(([k, v]) => `${k}=${v.score}`)
      .join(' ');
    console.log(`${tag}   tutor-turn-${r.turnIndex} ... ${r.overallScore.toFixed(1)}  (${dimScores})`);
  }

  for (const settled of tutorSettled) {
    const r = settled.status === 'fulfilled' ? settled.value : null;
    if (!r) continue;
    if (r.batched) {
      // Batched result: contains array of individual turn results
      if (r.success && r.results) {
        for (const turnResult of r.results) {
          storeTutorTurnResult(turnResult);
        }
      } else {
        // Batch failed — need fallback to individual per-turn calls
        needsTutorFallback = true;
      }
    } else {
      // Individual turn result (single-turn case)
      storeTutorTurnResult(r);
    }
  }

  // Fallback: if batched call failed or returned partial results, fill gaps individually
  const missingTutorTurns = [];
  for (let i = 0; i < totalTurns; i++) {
    if (!tutorTurnScores[i]) missingTutorTurns.push(i);
  }
  if (needsTutorFallback || missingTutorTurns.length > 0) {
    if (!needsTutorFallback && missingTutorTurns.length > 0) {
      console.log(
        `${tag}   tutor-batch partial: got ${Object.keys(tutorTurnScores).length}/${totalTurns} turns, filling gaps [${missingTutorTurns.join(',')}]`,
      );
    } else {
      console.log(`${tag}   tutor-batch fallback: retrying ${totalTurns} turns individually`);
    }
    const fallbackPromises = [];
    for (const turnIndex of needsTutorFallback ? Array.from({ length: totalTurns }, (_, i) => i) : missingTutorTurns) {
      fallbackPromises.push(
        (async () => {
          const turnTag = `${tag}   tutor-turn-${turnIndex}`;
          try {
            const prompt = buildPerTurnTutorEvaluationPrompt({
              turnResults,
              dialogueTrace,
              targetTurnIndex: turnIndex,
              scenario: scenarioContext,
              learnerContext: learnerCtx,
            });
            if (!prompt) return { turnIndex, skipped: true };

            const judgeInputHash = createHash('sha256').update(prompt).digest('hex');
            if (verbose) console.log(`${turnTag} ... calling claude (fallback)`);
            const parsed = await callClaudeJudge(prompt);
            return normalizeTutorTurnResult(turnIndex, parsed, judgeInputHash);
          } catch (err) {
            const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
            console.log(`${turnTag} ... FAIL: ${msg}`);
            return { turnIndex, success: false };
          }
        })(),
      );
    }
    const fallbackSettled = await Promise.allSettled(fallbackPromises);
    for (const settled of fallbackSettled) {
      const r = settled.status === 'fulfilled' ? settled.value : null;
      storeTutorTurnResult(r);
    }
  }

  // ── Process learner per-turn results ──
  const learnerTurnScores = {};
  let needsLearnerFallback = false;

  function storeLearnerTurnResult(r) {
    if (!r || !r.success) return;
    if (r.overallScore == null) {
      const dimScores = Object.entries(r.scores || {})
        .map(([k, v]) => `${k}=${typeof v === 'object' ? v.score : v}`)
        .join(' ');
      console.log(`${tag}   learner-turn-${r.lt} ... FAIL: scores out of range (${dimScores})`);
      return;
    }
    learnerTurnScores[r.lt] = {
      turnIndex: r.turnIndex,
      scores: r.scores,
      overallScore: r.overallScore,
      summary: r.summary,
      judgeInputHash: r.judgeInputHash,
      judgeTimestamp: r.judgeTimestamp,
      judgeModel,
    };
    const dimScores = Object.entries(r.scores || {})
      .map(([k, v]) => `${k}=${typeof v === 'object' ? v.score : v}`)
      .join(' ');
    console.log(`${tag}   learner-turn-${r.lt} ... ${r.overallScore.toFixed(1)}  (${dimScores})`);
  }

  for (const settled of learnerSettled) {
    const r = settled.status === 'fulfilled' ? settled.value : null;
    if (!r) continue;
    if (r.batched) {
      if (r.success && r.results) {
        for (const turnResult of r.results) {
          storeLearnerTurnResult(turnResult);
        }
      } else {
        needsLearnerFallback = true;
      }
    } else {
      storeLearnerTurnResult(r);
    }
  }

  // Fallback: if batched learner call failed or returned partial results, fill gaps
  const missingLearnerTurns = learnerTurnTargets.filter(({ lt }) => !learnerTurnScores[lt]);
  if (needsLearnerFallback || missingLearnerTurns.length > 0) {
    const targetsToRetry = needsLearnerFallback ? learnerTurnTargets : missingLearnerTurns;
    if (!needsLearnerFallback && missingLearnerTurns.length > 0) {
      console.log(
        `${tag}   learner-batch partial: got ${Object.keys(learnerTurnScores).length}/${learnerTurnTargets.length} turns, filling gaps [${missingLearnerTurns.map((t) => t.lt).join(',')}]`,
      );
    } else {
      console.log(`${tag}   learner-batch fallback: retrying ${learnerTurnTargets.length} turns individually`);
    }
    const fallbackPromises = targetsToRetry.map(({ lt, targetIdx }) => {
      return (async () => {
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
          if (verbose) console.log(`${turnTag} ... calling claude (fallback)`);
          const parsed = await callClaudeJudge(prompt);
          return normalizeLearnerTurnResult(lt, parsed, judgeInputHash);
        } catch (err) {
          const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
          console.log(`${turnTag} ... FAIL: ${msg}`);
          return { lt, success: false };
        }
      })();
    });
    const fallbackSettled = await Promise.allSettled(fallbackPromises);
    for (const settled of fallbackSettled) {
      const r = settled.status === 'fulfilled' ? settled.value : null;
      storeLearnerTurnResult(r);
    }
  }

  // ── Process Wave 1: dialogue quality ──
  let dgpScore = null;
  let dgiScore = null;
  if (dgpResult?.success) {
    dgpScore = dgpResult.score;
    evaluationStore.updateDialogueQualityScore(result.id, {
      dialogueQualityScore: dgpScore,
      dialogueQualityScores: dgpResult.scores,
      dialogueQualitySummary: dgpResult.summary || null,
      dialogueQualityJudgeModel: judgeModel,
    });
    console.log(`${tag}   dialogue-quality(public)=${dgpScore.toFixed(1)}`);
  }
  if (dgiResult?.success) {
    dgiScore = dgiResult.score;
    evaluationStore.updateDialogueQualityInternalScore(result.id, {
      dialogueQualityInternalScore: dgiScore,
      dialogueQualityInternalScores: dgiResult.scores,
      dialogueQualityInternalSummary: dgiResult.summary || null,
    });
    console.log(`${tag}   dialogue-quality(full)=${dgiScore.toFixed(1)}`);
  }

  // ── Process Wave 1: deliberation quality ──
  let tutorDelibScore = null;
  let learnerDelibScore = null;
  if (tutorDelibResult?.success) {
    tutorDelibScore = tutorDelibResult.score;
    evaluationStore.updateTutorDeliberationScores(result.id, {
      deliberationScores: tutorDelibResult.scores,
      deliberationScore: tutorDelibScore,
      deliberationSummary: tutorDelibResult.summary || null,
      deliberationJudgeModel: judgeModel,
    });
    console.log(`${tag}   tutor-deliberation=${tutorDelibScore.toFixed(1)}`);
  }
  if (learnerDelibResult?.success) {
    learnerDelibScore = learnerDelibResult.score;
    evaluationStore.updateLearnerDeliberationScores(result.id, {
      deliberationScores: learnerDelibResult.scores,
      deliberationScore: learnerDelibScore,
      deliberationSummary: learnerDelibResult.summary || null,
      deliberationJudgeModel: judgeModel,
    });
    console.log(`${tag}   learner-deliberation=${learnerDelibScore.toFixed(1)}`);
  }

  // ── Aggregate tutor scores ──
  const tutorTurnOveralls = Object.values(tutorTurnScores).map((s) => s.overallScore);
  if (tutorTurnOveralls.length === 0) {
    console.log(`${tag} ${scenarioId} / ${profileName} ... NO tutor turns scored`);
    return null;
  }

  const tutorOverall = tutorTurnOveralls.reduce((a, b) => a + b, 0) / tutorTurnOveralls.length;
  const tutorFirst = tutorTurnScores[0]?.overallScore ?? null;
  const lastTurnIdx = Math.max(...Object.keys(tutorTurnScores).map(Number));
  const tutorLast = tutorTurnScores[lastTurnIdx]?.overallScore ?? null;
  const tutorDevelopment = tutorFirst != null && tutorLast != null ? tutorLast - tutorFirst : null;

  // Also write the first turn's per-dimension scores to the legacy dimension columns
  const firstTurnScores = tutorTurnScores[0]?.scores || {};
  evaluationStore.updateResultTutorScores(result.id, {
    tutorScores: tutorTurnScores,
    tutorOverallScore: tutorOverall,
    tutorFirstTurnScore: tutorFirst,
    tutorLastTurnScore: tutorLast,
    tutorDevelopmentScore: tutorDevelopment,
    judgeModel: judgeModel,
    judgeLatencyMs: Date.now() - startTime,
  });

  // Also update the per-dimension columns from the first turn for backward compat
  if (Object.keys(firstTurnScores).length > 0) {
    const firstTurnEval = {
      scores: firstTurnScores,
      tutorFirstTurnScore: tutorFirst,
      baseScore: tutorTurnScores[0]?.baseScore ?? null,
      recognitionScore: tutorTurnScores[0]?.recognitionScore ?? null,
      passesRequired: true,
      passesForbidden: true,
      requiredMissing: [],
      forbiddenFound: [],
      summary: tutorTurnScores[0]?.summary || null,
      judgeModel: judgeModel,
      judgeLatencyMs: Date.now() - startTime,
    };
    evaluationStore.updateResultScores(result.id, firstTurnEval);
    // Re-apply the per-turn tutor scores (updateResultScores may have overwritten some fields)
    evaluationStore.updateResultTutorScores(result.id, {
      tutorScores: tutorTurnScores,
      tutorOverallScore: tutorOverall,
      tutorFirstTurnScore: tutorFirst,
      tutorLastTurnScore: tutorLast,
      tutorDevelopmentScore: tutorDevelopment,
    });
  }

  let tutorHolistic = null;
  let learnerAvg = null;
  let learnerHolistic = null;

  // ── Process holistic results ──
  if (tutorHolisticResult?.success) {
    tutorHolistic = tutorHolisticResult.score;
    evaluationStore.updateResultTutorHolisticScores(result.id, {
      holisticScores: tutorHolisticResult.holisticScores,
      holisticOverallScore: tutorHolistic,
      holisticSummary: tutorHolisticResult.summary || null,
      holisticJudgeModel: judgeModel,
    });
    console.log(`${tag}   tutor-holistic ... ${tutorHolistic.toFixed(1)}`);
  }

  // ── Process learner holistic + per-turn DB write ──
  if (!tutorOnly) {
    // Echo detection: reject identical score vectors across turns
    const learnerEntries = Object.values(learnerTurnScores);
    if (learnerEntries.length >= 2) {
      const sigs = learnerEntries.map((ts) =>
        Object.keys(ts.scores || {})
          .sort()
          .map((k) => `${k}=${typeof ts.scores[k] === 'object' ? ts.scores[k].score : ts.scores[k]}`)
          .join(','),
      );
      if (sigs.every((s) => s === sigs[0])) {
        console.log(
          `${tag}   WARN: all ${learnerEntries.length} learner turns have identical scores — likely echoed example pattern; skipping learner storage`,
        );
        // Clear turn scores so they don't get stored
        for (const k of Object.keys(learnerTurnScores)) delete learnerTurnScores[k];
      }
    }

    learnerAvg =
      Object.keys(learnerTurnScores).length > 0
        ? Object.values(learnerTurnScores).reduce((a, b) => a + b.overallScore, 0) /
          Object.values(learnerTurnScores).length
        : null;

    if (learnerHolisticResult?.success) {
      learnerHolistic = learnerHolisticResult.score;
      evaluationStore.updateResultLearnerScores(result.id, {
        scores: learnerTurnScores,
        overallScore: learnerAvg,
        judgeModel: judgeModel,
        holisticScores: learnerHolisticResult.holisticScores,
        holisticOverallScore: learnerHolistic,
        holisticSummary: learnerHolisticResult.summary || null,
        holisticJudgeModel: judgeModel,
      });
      console.log(`${tag}   learner-holistic ... ${learnerHolistic.toFixed(1)}`);
    } else if (Object.keys(learnerTurnScores).length > 0) {
      // Fallback: write per-turn learner scores even if holistic failed
      evaluationStore.updateResultLearnerScores(result.id, {
        scores: learnerTurnScores,
        overallScore: learnerAvg,
        judgeModel: judgeModel,
      });
    }
  }

  // ── Process Measures (extract from dialogue log, store in DB) ──
  const tm = dialogueLog.transformationMetrics;
  if (tm) {
    evaluationStore.updateProcessMeasures(result.id, {
      adaptationIndex: tm.tutorAdaptationIndex ?? null,
      learnerGrowthIndex: tm.learnerGrowthIndex ?? null,
      bilateralTransformationIndex: tm.bilateralTransformationIndex ?? null,
      incorporationRate: tm.superegoMetrics?.incorporationRate ?? null,
      dimensionConvergence: tm.dimensionConvergence ?? null,
      transformationQuality: tm.transformationQuality ?? null,
    });
  }

  // ── Summary ──
  const tutorHolisticPart = tutorHolistic != null ? ` holistic=${tutorHolistic.toFixed(1)}` : '';
  const learnerPart =
    learnerAvg != null
      ? `  learner: avg=${learnerAvg.toFixed(1)}${learnerHolistic != null ? ` holistic=${learnerHolistic.toFixed(1)}` : ''}`
      : '';
  const dgPart = dgpScore != null ? `  DgP=${dgpScore.toFixed(1)}` : '';
  const dgiPart = dgiScore != null ? ` DgI=${dgiScore.toFixed(1)}` : '';
  const delibPart =
    tutorDelibScore != null || learnerDelibScore != null
      ? `  delib: ${tutorDelibScore != null ? `T=${tutorDelibScore.toFixed(1)}` : ''}${learnerDelibScore != null ? ` L=${learnerDelibScore.toFixed(1)}` : ''}`
      : '';
  const overallPart = learnerAvg != null ? `  overall=${((tutorOverall + learnerAvg) / 2).toFixed(1)}` : '';

  console.log(
    `${tag} ${scenarioId} / ${profileName} ... tutor: avg=${tutorOverall.toFixed(1)}${tutorHolisticPart} first=${tutorFirst?.toFixed(1)} last=${tutorLast?.toFixed(1)} Δ=${tutorDevelopment != null ? (tutorDevelopment >= 0 ? '+' : '') + tutorDevelopment.toFixed(1) : '?'}${learnerPart}${dgPart}${dgiPart}${delibPart}${overallPart}`,
  );

  return tutorOverall;
}
