export const EVAL_LOG_READ_ROUTES = Object.freeze([
  '/logs/dates',
  '/logs/:date',
  '/logs/dialogue/:dialogueId',
  '/logs/:date/:index',
  '/logs-stats',
]);

/** Register dialogue-log projections, including the legacy interaction adapter. */
export function registerEvalLogReadRoutes(router, { storeFor, getDialogueLogService }) {
  const [datesPath, datePath, dialoguePath, indexedDialoguePath, statsPath] = EVAL_LOG_READ_ROUTES;

  router.get(datesPath, (_req, res) => {
    try {
      const dates = getDialogueLogService().listLogDates();
      res.json({ success: true, dates });
    } catch (error) {
      console.error('[EvalRoutes] List log dates error:', error);
      res.status(500).json({ error: 'Failed to list log dates' });
    }
  });

  router.get(datePath, (req, res) => {
    try {
      const { date } = req.params;
      const limit = parseInt(req.query.limit) || 10;
      const offset = parseInt(req.query.offset) || 0;
      const result = getDialogueLogService().getDialogues({ date, limit, offset });
      res.json({ success: true, ...result });
    } catch (error) {
      console.error('[EvalRoutes] Get dialogues error:', error);
      res.status(500).json({ error: 'Failed to get dialogues' });
    }
  });

  router.get(dialoguePath, (req, res) => {
    try {
      const { dialogueId } = req.params;
      if (dialogueId.startsWith('short-') || dialogueId.startsWith('long-')) {
        const interactionEval = storeFor(req).getInteractionEval(dialogueId);
        if (interactionEval) return res.json(interactionDialogueResponse(dialogueId, interactionEval));
      }

      const dialogue = getDialogueLogService().getDialogueById(dialogueId);
      if (!dialogue) return res.status(404).json({ error: 'Dialogue not found' });
      res.json({ success: true, dialogue, dialogueId });
    } catch (error) {
      console.error('[EvalRoutes] Get dialogue by ID error:', error);
      res.status(500).json({ error: 'Failed to get dialogue' });
    }
  });

  router.get(indexedDialoguePath, (req, res) => {
    try {
      const { date, index } = req.params;
      const dialogue = getDialogueLogService().getDialogueByIndex(date, parseInt(index));
      if (!dialogue) return res.status(404).json({ error: 'Dialogue not found' });
      res.json({ success: true, dialogue });
    } catch (error) {
      console.error('[EvalRoutes] Get dialogue error:', error);
      res.status(500).json({ error: 'Failed to get dialogue' });
    }
  });

  router.get(statsPath, (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const stats = getDialogueLogService().getLogStatistics({ startDate, endDate });
      res.json({ success: true, ...stats });
    } catch (error) {
      console.error('[EvalRoutes] Get log stats error:', error);
      res.status(500).json({ error: 'Failed to get log statistics' });
    }
  });
}

function interactionDialogueResponse(dialogueId, interactionEval) {
  const entries = [];
  let entryIndex = 0;
  for (const turn of interactionEval.turns || []) {
    const isLearner = turn.phase === 'learner';
    if (turn.internalDeliberation && turn.internalDeliberation.length > 0) {
      for (const deliberation of turn.internalDeliberation) {
        if (deliberation.role === 'ego') {
          entries.push({
            index: entryIndex++,
            action: isLearner ? 'learner_ego_thought' : 'tutor_ego_thought',
            agent: isLearner ? 'ego' : 'tutor_ego',
            phase: turn.phase,
            message: deliberation.content,
            timestamp: turn.timestamp,
          });
        } else if (deliberation.role === 'superego') {
          entries.push({
            index: entryIndex++,
            action: isLearner ? 'learner_superego_critique' : 'tutor_superego_critique',
            agent: isLearner ? 'superego' : 'tutor_superego',
            phase: turn.phase,
            message: deliberation.content,
            timestamp: turn.timestamp,
          });
        }
      }
    }
    entries.push({
      index: entryIndex++,
      action: isLearner ? 'learner_input' : 'tutor_response',
      agent: isLearner ? 'ego' : 'tutor_ego',
      phase: turn.phase,
      message: turn.externalMessage,
      timestamp: turn.timestamp,
      turnNumber: turn.turnNumber,
    });
  }

  const learnerTurns = (interactionEval.turns || []).filter((turn) => turn.phase === 'learner').length;
  return {
    success: true,
    dialogueId,
    dialogue: {
      dialogueId,
      entries,
      startTime: interactionEval.createdAt,
      isInteractionEval: true,
      scenarioName: interactionEval.scenarioName,
      personaId: interactionEval.personaId,
      judgeEvaluation: interactionEval.judgeEvaluation,
      summary: {
        totalTurns: interactionEval.turnCount,
        egoCount: learnerTurns,
        userCount: interactionEval.turnCount,
        superegoCount: 0,
        totalLatencyMs: interactionEval.latencyMs || 0,
        totalInputTokens: Math.floor((interactionEval.totalTokens || 0) / 2),
        totalOutputTokens: Math.ceil((interactionEval.totalTokens || 0) / 2),
        totalCost: 0,
      },
      sequenceDiagram: interactionEval.sequenceDiagram,
      formattedTranscript: interactionEval.formattedTranscript,
      isInteraction: true,
    },
  };
}
