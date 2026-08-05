export function prepareMultiTurnEvaluation(result, tag, context) {
  const {
    LOGS_DIR,
    buildDialogueFullTranscript,
    buildDialoguePublicTranscript,
    createHash,
    evaluationStore,
    extractLearnerTurnsFromTrace,
    fs,
    judgeModelLabel,
    path,
    resolveEvaluationScenarioAndDialogueLog,
    tutorOnly,
    verbose,
  } = context;

  const startTime = Date.now();
  const scenarioId = result.scenarioId;
  const profileName = result.profileName || `${result.provider}/${result.model}`;
  const judgeModel = judgeModelLabel;

  const resolved = resolveEvaluationScenarioAndDialogueLog(result);
  const scenario = resolved.scenario;
  if (!scenario) {
    console.log(`${tag} ${scenarioId} / ${profileName} ... SKIP (scenario not found)`);
    return null;
  }

  // Load dialogue log
  const dialogueId = result.dialogueId;
  const dialogueLog = resolved.dialogueLog || evaluationStore.loadDialogueLog(dialogueId);
  if (!dialogueLog) {
    console.log(`${tag} ${scenarioId} / ${profileName} ... SKIP (dialogue log not found)`);
    return null;
  }

  // P0 Provenance: verify dialogue log integrity
  if (result.dialogueContentHash) {
    const logPath = path.join(LOGS_DIR, `${dialogueId}.json`);
    try {
      const logContent = fs.readFileSync(logPath, 'utf8');
      const loadedHash = createHash('sha256').update(logContent).digest('hex');
      if (loadedHash !== result.dialogueContentHash) {
        console.error(
          `[PROVENANCE] Hash mismatch for ${dialogueId}: expected ${result.dialogueContentHash.slice(0, 12)}..., got ${loadedHash.slice(0, 12)}...`,
        );
      }
    } catch {
      // File loaded via fallback path — skip hash check
    }
  }

  if (!dialogueLog.isMultiTurn) {
    console.log(`${tag} ${scenarioId} / ${profileName} ... SKIP (not multi-turn)`);
    return null;
  }

  const turnResults = dialogueLog.turnResults || [];
  const dialogueTrace = dialogueLog.dialogueTrace || [];
  const totalTurns = turnResults.length;

  if (totalTurns === 0) {
    console.log(`${tag} ${scenarioId} / ${profileName} ... SKIP (no turns)`);
    return null;
  }

  console.log(`${tag} ${scenarioId} / ${profileName} ... per-turn scoring (${totalTurns} turns)`);

  // ── Print transcripts ──
  const transcriptTurns = turnResults.map((t, idx) => ({
    turnIndex: idx,
    turnId: t.turnId,
    suggestion: t.suggestions?.[0],
    learnerAction: t.learnerAction,
    learnerMessage: t.learnerMessage,
  }));
  const learnerCtx = dialogueLog.learnerContext || null;
  const transcriptArtifacts = dialogueLog.transcripts || null;

  const publicTranscript = buildDialoguePublicTranscript(
    transcriptTurns,
    dialogueTrace,
    learnerCtx,
    transcriptArtifacts,
  );
  console.log(`──── Public Transcript (${totalTurns} turns) ────────────────`);
  console.log(publicTranscript);

  if (verbose) {
    const fullTranscript = buildDialogueFullTranscript(transcriptTurns, dialogueTrace, learnerCtx, transcriptArtifacts);
    console.log(`──── Full Transcript (with internals) ──────────`);
    console.log(fullTranscript);
  }

  console.log(`─────────────────────────────────────────────────`);

  const scenarioContext = {
    name: scenario.name,
    description: scenario.description,
    expectedBehavior: scenario.expected_behavior,
    learnerContext: scenario.learner_context,
    requiredElements: scenario.required_elements,
    forbiddenElements: scenario.forbidden_elements,
  };

  const dimensionMap = {
    relevance: 'relevance',
    specificity: 'specificity',
    pedagogical_soundness: 'pedagogical',
    pedagogical: 'pedagogical',
    personalization: 'personalization',
    actionability: 'actionability',
    tone: 'tone',
  };

  // ── Prepare learner data for parallel scoring ──
  let learnerTurns = [];
  const reconstructedTurns = [];
  let isMultiAgent = false;
  let personaDescription = '';
  let scenarioNameForLearner = '';
  const learnerTurnTargets = []; // [{lt, targetIdx}]

  if (!tutorOnly) {
    const learnerArch = dialogueLog.learnerArchitecture || 'unified';
    isMultiAgent =
      learnerArch.includes('ego_superego') || learnerArch === 'multi_agent' || learnerArch.includes('psychodynamic');
    personaDescription = dialogueLog.learnerContext || 'No persona description available';
    scenarioNameForLearner = scenario.name || scenarioId;

    // Build reconstructed turns for learner prompt builder
    const trace = dialogueLog.dialogueTrace || [];
    learnerTurns = extractLearnerTurnsFromTrace(trace, isMultiAgent, dialogueLog.conversationHistory);

    // Interleave learner turns with tutor turns
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

    // Pre-compute target indices for learner turn scoring
    for (let lt = 0; lt < learnerTurns.length; lt++) {
      const targetIdx = reconstructedTurns.findIndex(
        (t) => t.phase === 'learner' && t.externalMessage === learnerTurns[lt].externalMessage,
      );
      if (targetIdx !== -1) {
        learnerTurnTargets.push({ lt, targetIdx });
      }
    }
  }

  // ── Prepare dialogue quality prompt params ──
  const dqPromptParams = !tutorOnly
    ? {
        turns: transcriptTurns,
        dialogueTrace,
        scenarioName: scenario.name,
        scenarioDescription: scenario.description,
        topic: scenario.topic || scenario.name,
        turnCount: totalTurns,
        learnerContext: learnerCtx,
        transcriptArtifacts,
      }
    : null;

  return {
    result,
    tag,
    startTime,
    scenarioId,
    profileName,
    judgeModel,
    scenario,
    dialogueId,
    dialogueLog,
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
  };
}
