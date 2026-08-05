export function createEvaluateOneResult(context) {
  const {
    LOGS_DIR,
    buildEvaluationPrompt,
    calculateBaseScore,
    calculateOverallScore,
    calculateRecognitionScore,
    callSelectedCliJudgeText,
    effectiveJudgeModel,
    evaluationStore,
    fs,
    getScenario,
    judgeCli,
    judgeCliEffort,
    judgeModelLabel,
    multiturnOnly,
    path,
    restoreTurn0,
    verbose,
  } = context;
  return async function evaluateOneResult(result, tag) {
    const startTime = Date.now();
    const scenarioId = result.scenarioId;
    const profileName = result.profileName || `${result.provider}/${result.model}`;

    const scenario = getScenario(scenarioId);
    if (!scenario) {
      console.log(`${tag} ${scenarioId} / ${profileName} ... SKIP (scenario not found)`);
      return null;
    }

    const suggestion = restoreTurn0
      ? result.suggestions?.[0]
      : result.dialogueId && result.suggestions?.length > 1
        ? result.suggestions[result.suggestions.length - 1]
        : result.suggestions?.[0];
    if (!suggestion) {
      console.log(`${tag} ${scenarioId} / ${profileName} ... SKIP (no suggestion)`);
      return null;
    }

    // Load dialogue log for multi-turn context (if available)
    let dialogueContext = null;
    const dialogueId = result.dialogueId;
    if (dialogueId) {
      const logPath = path.join(LOGS_DIR, `${dialogueId}.json`);
      try {
        if (fs.existsSync(logPath)) {
          const dialogueLog = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
          if (dialogueLog.isMultiTurn && dialogueLog.dialogueTrace?.length > 0) {
            dialogueContext = {
              consolidatedTrace: dialogueLog.dialogueTrace,
              conversationHistory: (dialogueLog.turnResults || []).map((t, i) => ({
                turnIndex: i,
                turnId: t.turnId,
                suggestion: t.suggestions?.[0],
                learnerAction: t.learnerAction,
                learnerMessage: t.learnerMessage,
              })),
            };
            if (verbose) {
              console.log(`${tag}   loaded dialogue transcript (${dialogueLog.dialogueTrace.length} trace entries)`);
            }
          }
        }
      } catch (e) {
        if (verbose) console.log(`${tag}   could not load dialogue log: ${e.message}`);
      }
    }

    const prompt = buildEvaluationPrompt(
      suggestion,
      {
        name: scenario.name,
        description: scenario.description,
        expectedBehavior: scenario.expected_behavior,
        learnerContext: scenario.learner_context,
        requiredElements: scenario.required_elements,
        forbiddenElements: scenario.forbidden_elements,
      },
      { dialogueContext },
    );

    if (verbose) {
      console.log(`${tag} ${scenarioId} / ${profileName} ... calling ${judgeCli}`);
    }
    const stdout = await callSelectedCliJudgeText(
      judgeCli,
      effectiveJudgeModel,
      prompt,
      'eval-cli-tutor-evaluation',
      judgeCliEffort,
    );

    let jsonStr = stdout.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    } else {
      const firstBrace = jsonStr.indexOf('{');
      const lastBrace = jsonStr.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
      }
    }

    const parsed = JSON.parse(jsonStr);

    const dimensionMap = {
      relevance: 'relevance',
      specificity: 'specificity',
      pedagogical_soundness: 'pedagogical',
      pedagogical: 'pedagogical',
      personalization: 'personalization',
      actionability: 'actionability',
      tone: 'tone',
    };

    const normalizedScores = {};
    for (const [key, value] of Object.entries(parsed.scores || {})) {
      const normalizedKey = dimensionMap[key] || key;
      if (typeof value === 'object' && value !== null) {
        normalizedScores[normalizedKey] = { score: value.score, reasoning: value.reasoning };
      } else if (typeof value === 'number') {
        normalizedScores[normalizedKey] = { score: value, reasoning: null };
      }
    }

    const tutorFirstTurnScore =
      Object.keys(normalizedScores).length > 0 ? calculateOverallScore(normalizedScores) : parsed.overall_score;
    const baseScore = calculateBaseScore(normalizedScores);
    const recognitionScore = calculateRecognitionScore(normalizedScores);

    const judgeLatencyMs = Date.now() - startTime;
    const evaluation = {
      scores: normalizedScores,
      tutorFirstTurnScore,
      baseScore,
      recognitionScore,
      passesRequired: parsed.validation?.passes_required ?? true,
      passesForbidden: parsed.validation?.passes_forbidden ?? true,
      requiredMissing: parsed.validation?.required_missing || [],
      forbiddenFound: parsed.validation?.forbidden_found || [],
      summary: parsed.summary,
      judgeModel: judgeModelLabel,
      judgeLatencyMs,
    };

    if (restoreTurn0) {
      // --restore-turn0: re-score suggestions[0] and write to tutor_first_turn_score
      evaluationStore.updateResultScores(result.id, evaluation);
    } else if (multiturnOnly) {
      // --multiturn-only: write ONLY tutor_last_turn_score, preserving the original tutor_first_turn_score (Turn 0)
      evaluationStore.updateTutorLastTurnScore(result.id, { tutorLastTurnScore: evaluation.tutorFirstTurnScore });
    } else {
      evaluationStore.updateResultScores(result.id, evaluation);

      // For single-turn results, also populate the tutor_scores/tutor_overall_score/tutor_last_turn_score
      // columns so that downstream queries (TuH fallback, runs display) see consistent data.
      evaluationStore.updateResultTutorScores(result.id, {
        tutorScores: {
          0: { scores: normalizedScores, overallScore: tutorFirstTurnScore, summary: parsed.summary },
        },
        tutorOverallScore: tutorFirstTurnScore,
        tutorFirstTurnScore,
        tutorLastTurnScore: tutorFirstTurnScore,
        tutorDevelopmentScore: 0,
      });
    }

    // Score line
    const dimScores = Object.entries(normalizedScores)
      .map(([k, v]) => `${k}=${v.score}`)
      .join(' ');
    console.log(`${tag} ${scenarioId} / ${profileName} ... ${tutorFirstTurnScore.toFixed(1)}  (${dimScores})`);

    if (verbose) {
      // Truncated suggestion excerpt
      const suggText =
        typeof suggestion === 'string'
          ? suggestion
          : suggestion.message || suggestion.text || suggestion.content || JSON.stringify(suggestion);
      const truncSugg =
        suggText.length > 200 ? suggText.slice(0, 200).replace(/\n/g, ' ') + '...' : suggText.replace(/\n/g, ' ');
      console.log(`     Suggestion: ${truncSugg}`);

      // Judge summary
      if (parsed.summary) {
        const truncSummary =
          parsed.summary.length > 300
            ? parsed.summary.slice(0, 300).replace(/\n/g, ' ') + '...'
            : parsed.summary.replace(/\n/g, ' ');
        console.log(`     Judge: ${truncSummary}`);
      }
      console.log('');
    }

    return tutorFirstTurnScore;
  };
}
