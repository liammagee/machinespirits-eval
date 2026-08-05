export function createEvaluateHolisticDialogues(context) {
  const {
    LOGS_DIR,
    buildEvaluationPrompt,
    calculateBaseScore,
    calculateOverallScore,
    calculateRecognitionScore,
    callClaudeJudge,
    fs,
    getScenario,
    judgeModelLabel,
    path,
    verbose,
  } = context;
  return async function evaluateHolisticDialogues(evaluatedResults) {
    // Group results by dialogueId to find multi-turn dialogues
    const dialogueGroups = new Map();
    for (const result of evaluatedResults) {
      if (result.dialogueId) {
        if (!dialogueGroups.has(result.dialogueId)) {
          dialogueGroups.set(result.dialogueId, []);
        }
        dialogueGroups.get(result.dialogueId).push(result);
      }
    }

    // Filter to multi-turn dialogues (2+ results sharing a dialogueId)
    const multiTurnDialogues = [...dialogueGroups.entries()].filter(([, results]) => results.length > 1);
    if (multiTurnDialogues.length === 0) return;

    console.log(`\n${'─'.repeat(50)}`);
    console.log(`  HOLISTIC DIALOGUE EVALUATION (${multiTurnDialogues.length} dialogue(s))`);
    console.log(`${'─'.repeat(50)}\n`);

    for (const [dialogueId, results] of multiTurnDialogues) {
      const logPath = path.join(LOGS_DIR, `${dialogueId}.json`);
      let dialogueLog;
      try {
        if (!fs.existsSync(logPath)) {
          console.log(`  ${dialogueId} ... SKIP (dialogue log not found)`);
          continue;
        }
        dialogueLog = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
      } catch (e) {
        console.log(`  ${dialogueId} ... SKIP (could not load: ${e.message})`);
        continue;
      }

      if (!dialogueLog.isMultiTurn || !dialogueLog.dialogueTrace?.length) {
        console.log(`  ${dialogueId} ... SKIP (not multi-turn or no trace)`);
        continue;
      }

      // Build context from the dialogue log
      const consolidatedTrace = dialogueLog.dialogueTrace;
      const conversationHistory = (dialogueLog.turnResults || []).map((t, i) => ({
        turnIndex: i,
        turnId: t.turnId,
        suggestion: t.suggestions?.[0],
        learnerAction: t.learnerAction,
        learnerMessage: t.learnerMessage,
      }));

      // Use the last turn's suggestion as the focal point
      const lastResult = results[results.length - 1];
      const lastSuggestion = lastResult.suggestions?.[0];
      if (!lastSuggestion) {
        console.log(`  ${dialogueId} ... SKIP (no suggestion on last turn)`);
        continue;
      }

      const scenarioId = lastResult.scenarioId;
      const scenario = getScenario(scenarioId);
      if (!scenario) {
        console.log(`  ${dialogueId} ... SKIP (scenario ${scenarioId} not found)`);
        continue;
      }

      const prompt = buildEvaluationPrompt(
        lastSuggestion,
        {
          name: `${scenario.name} (holistic dialogue)`,
          description: `Holistic evaluation of ${results.length}-turn dialogue. Score the overall quality of the tutoring interaction across all turns, not just this final response.`,
          expectedBehavior: scenario.expected_behavior,
          learnerContext: scenario.learner_context,
          requiredElements: scenario.required_elements,
          forbiddenElements: scenario.forbidden_elements,
        },
        {
          dialogueContext: { conversationHistory, consolidatedTrace },
        },
      );

      try {
        const parsed = await callClaudeJudge(prompt);

        const normalizedScores = {};
        const dimensionMap = {
          relevance: 'relevance',
          specificity: 'specificity',
          pedagogical_soundness: 'pedagogical',
          pedagogical: 'pedagogical',
          personalization: 'personalization',
          actionability: 'actionability',
          tone: 'tone',
        };
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
        const baseScore = calculateBaseScore(normalizedScores);
        const recognitionScore = calculateRecognitionScore(normalizedScores);

        const holisticScore = {
          overallScore,
          baseScore,
          recognitionScore,
          scores: normalizedScores,
          summary: parsed.summary,
          judgeModel: judgeModelLabel,
        };

        // Save to dialogue log
        dialogueLog.holisticDialogueScore = holisticScore;
        fs.writeFileSync(logPath, JSON.stringify(dialogueLog, null, 2));

        const profileName = lastResult.profileName || `${lastResult.provider}/${lastResult.model}`;
        const formattedBase = baseScore == null ? '--' : baseScore.toFixed(1);
        const formattedRecognition = recognitionScore == null ? '--' : recognitionScore.toFixed(1);
        console.log(
          `  ${scenarioId} / ${profileName} ... holistic=${overallScore.toFixed(1)} (base=${formattedBase} recog=${formattedRecognition})`,
        );
        if (verbose && parsed.summary) {
          const truncSummary =
            parsed.summary.length > 300
              ? parsed.summary.slice(0, 300).replace(/\n/g, ' ') + '...'
              : parsed.summary.replace(/\n/g, ' ');
          console.log(`     Judge: ${truncSummary}\n`);
        }
      } catch (err) {
        const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
        console.log(`  ${dialogueId} ... FAIL: ${msg}`);
      }
    }
  };
}
