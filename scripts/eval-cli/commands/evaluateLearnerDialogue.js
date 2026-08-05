export function createEvaluateLearnerDialogue(context) {
  const {
    LOGS_DIR,
    buildLearnerEvaluationPrompt,
    buildLearnerHolisticEvaluationPrompt,
    calculateLearnerOverallScore,
    callLearnerJudge,
    evaluationStore,
    extractLearnerTurnsFromTrace,
    fs,
    getLearnerScoreSignature,
    getScenario,
    judgeCli,
    learnerJudgeModel,
    path,
    toEvaluate,
    verbose,
  } = context;
  return async (workItem, index) => {
    const { result, needsTurnEval, needsHolisticEval } = workItem;
    const profileName = result.profileName || `${result.provider}/${result.model}`;
    const tag = `[${index + 1}/${toEvaluate.length}]`;

    // Load dialogue log file
    const logPath = path.join(LOGS_DIR, `${result.dialogueId}.json`);
    let dialogueLog;
    try {
      if (!fs.existsSync(logPath)) {
        console.log(`${tag} ${result.scenarioId} / ${profileName} ... SKIP (log file not found)`);
        return { ok: false };
      }
      dialogueLog = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
    } catch (e) {
      console.log(`${tag} ${result.scenarioId} / ${profileName} ... SKIP (${e.message})`);
      return { ok: false };
    }

    if (!dialogueLog.isMultiTurn) {
      console.log(`${tag} ${result.scenarioId} / ${profileName} ... SKIP (not multi-turn)`);
      return { ok: false };
    }

    const trace = dialogueLog.dialogueTrace || [];
    const learnerArch = dialogueLog.learnerArchitecture || 'unified';
    const isMultiAgent =
      learnerArch.includes('ego_superego') || learnerArch === 'multi_agent' || learnerArch.includes('psychodynamic');

    const learnerTurns = extractLearnerTurnsFromTrace(trace, isMultiAgent, dialogueLog.conversationHistory);

    if (learnerTurns.length === 0) {
      console.log(`${tag} ${result.scenarioId} / ${profileName} ... SKIP (no learner turns in trace)`);
      return { ok: false };
    }

    // Build a reconstructed turn array for the prompt builder
    // Interleave tutor suggestions and learner messages
    const reconstructedTurns = [];
    const turnResults = dialogueLog.turnResults || [];

    // Turn 0: initial tutor suggestion
    if (turnResults.length > 0) {
      const sug = turnResults[0].suggestions?.[0];
      reconstructedTurns.push({
        turnNumber: 0,
        phase: 'tutor',
        externalMessage: sug?.message || sug?.text || JSON.stringify(sug),
      });
    }

    // Subsequent turns: learner → tutor pairs
    for (let lt = 0; lt < learnerTurns.length; lt++) {
      reconstructedTurns.push({
        turnNumber: lt + 1,
        phase: 'learner',
        externalMessage: learnerTurns[lt].externalMessage,
        internalDeliberation: learnerTurns[lt].internalDeliberation,
      });

      // Add corresponding tutor response (if exists)
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

    // Get scenario info
    const scenario = getScenario(result.scenarioId);
    const scenarioName = scenario?.name || result.scenarioId;

    // Use learnerContext from the dialogue log as persona description
    const personaDescription = dialogueLog.learnerContext || 'No persona description available';

    let turnScores = result.learnerScores || {};
    let turnSucceeded = 0;
    let dialogueLearnerScore = result.learnerOverallScore ?? null;

    let holisticScores = result.learnerHolisticScores || null;
    let holisticOverallScore = result.learnerHolisticOverallScore ?? null;
    let holisticSummary = result.learnerHolisticSummary || null;

    if (!needsTurnEval && needsHolisticEval) {
      console.log(`${tag} ${result.scenarioId} / ${profileName} ... holistic-only (reusing learner turn scores)`);
    }

    if (needsTurnEval) {
      turnScores = {};

      // Score each learner turn
      for (let lt = 0; lt < learnerTurns.length; lt++) {
        // Find the learner turn's index in reconstructedTurns
        const targetIdx = reconstructedTurns.findIndex(
          (t) => t.phase === 'learner' && t.externalMessage === learnerTurns[lt].externalMessage,
        );

        if (targetIdx === -1) continue;

        const turnTag = `${tag} ${result.scenarioId} / ${profileName} learner-turn-${lt + 1}`;

        try {
          const prompt = buildLearnerEvaluationPrompt({
            turns: reconstructedTurns,
            targetTurnIndex: targetIdx,
            personaId: profileName,
            personaDescription,
            learnerArchitecture: isMultiAgent ? 'multi_agent' : 'unified',
            scenarioName,
            topic: result.scenarioId,
          });

          if (verbose) {
            console.log(`${turnTag} ... calling ${judgeCli}`);
          }

          const parsed = await callLearnerJudge(prompt);
          const turnOverall = calculateLearnerOverallScore(parsed.scores || {}, isMultiAgent);

          if (turnOverall == null) {
            const dimScores = Object.entries(parsed.scores || {})
              .map(([k, v]) => `${k}=${typeof v === 'object' ? v.score : v}`)
              .join(' ');
            console.log(`${turnTag} ... FAIL: scores out of range or missing (${dimScores})`);
            continue;
          }

          turnScores[lt] = {
            turnIndex: lt + 1,
            scores: parsed.scores,
            overallScore: turnOverall,
            summary: parsed.summary,
          };

          const dimScores = Object.entries(parsed.scores || {})
            .map(([k, v]) => `${k}=${typeof v === 'object' ? v.score : v}`)
            .join(' ');
          console.log(`${turnTag} ... ${turnOverall.toFixed(1)}  (${dimScores})`);

          if (verbose && parsed.summary) {
            console.log(`     Judge: ${parsed.summary}`);
          }

          turnSucceeded++;
        } catch (err) {
          const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
          console.log(`${turnTag} ... FAIL: ${msg}`);
          if (verbose) console.error(err);
        }
      }

      if (turnSucceeded > 0) {
        // Echo detection: if all turns produced identical score vectors, reject as echoed
        const turnEntries = Object.values(turnScores);
        if (turnEntries.length >= 2) {
          const signatures = turnEntries.map((ts) => {
            const scores = ts.scores || {};
            return getLearnerScoreSignature(scores);
          });
          const allIdentical = signatures.every((s) => s === signatures[0]);
          if (allIdentical) {
            console.log(
              `${tag} ${result.scenarioId} / ${profileName} ... SKIP: all ${turnEntries.length} turns produced identical scores (judge echoed example pattern)`,
            );
            return { ok: false };
          }
        }

        // Calculate dialogue-level learner score (average across turns)
        const turnOveralls = Object.values(turnScores).map((ts) => ts.overallScore);
        dialogueLearnerScore = turnOveralls.reduce((a, b) => a + b, 0) / turnOveralls.length;
      } else {
        return { ok: false };
      }
    }

    let holisticFailed = false;
    if (needsHolisticEval) {
      const holisticTag = `${tag} ${result.scenarioId} / ${profileName} learner-holistic`;
      try {
        const holisticPrompt = buildLearnerHolisticEvaluationPrompt({
          turns: reconstructedTurns,
          personaId: profileName,
          personaDescription,
          learnerArchitecture: isMultiAgent ? 'multi_agent' : 'unified',
          scenarioName,
          topic: result.scenarioId,
        });

        if (verbose) {
          console.log(`${holisticTag} ... calling ${judgeCli}`);
        }

        const parsedHolistic = await callLearnerJudge(holisticPrompt);
        holisticScores = parsedHolistic.scores || {};
        holisticOverallScore = calculateLearnerOverallScore(holisticScores, isMultiAgent);
        holisticSummary = parsedHolistic.summary || null;

        const holisticDimScores = Object.entries(holisticScores)
          .map(([k, v]) => `${k}=${typeof v === 'object' ? v.score : v}`)
          .join(' ');
        if (holisticOverallScore == null) {
          console.log(`${holisticTag} ... FAIL: scores out of range or missing (${holisticDimScores})`);
          holisticFailed = true;
        } else {
          console.log(`${holisticTag} ... ${holisticOverallScore.toFixed(1)}  (${holisticDimScores})`);
        }
        if (verbose && holisticSummary) {
          console.log(`     Judge: ${holisticSummary}`);
        }
      } catch (err) {
        const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
        console.log(`${holisticTag} ... FAIL: ${msg}`);
        if (verbose) console.error(err);
        holisticFailed = true;
      }
    }

    if (dialogueLearnerScore == null) {
      return { ok: false };
    }

    // Store in database on the evaluation_results row
    evaluationStore.updateResultLearnerScores(result.id, {
      scores: turnScores,
      overallScore: dialogueLearnerScore,
      judgeModel: result.learnerJudgeModel || learnerJudgeModel,
      holisticScores,
      holisticOverallScore,
      holisticSummary,
      holisticJudgeModel: holisticOverallScore != null ? learnerJudgeModel : result.learnerHolisticJudgeModel || null,
    });

    if (needsTurnEval) {
      console.log(`  → Dialogue learner score: ${dialogueLearnerScore.toFixed(1)} (${turnSucceeded} turns scored)`);
    } else {
      console.log(`  → Dialogue learner score: ${dialogueLearnerScore.toFixed(1)} (existing turn scores)`);
    }
    if (holisticOverallScore != null) {
      console.log(`  → Holistic learner score: ${holisticOverallScore.toFixed(1)}`);
    } else if (needsHolisticEval) {
      console.log('  → Holistic learner score: MISSING (judge failed; rerun to backfill)');
    }
    console.log('');

    return {
      ok: !holisticFailed || !needsHolisticEval,
      score: dialogueLearnerScore,
      holisticScore: holisticOverallScore,
    };
  };
}
