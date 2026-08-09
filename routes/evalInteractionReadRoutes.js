export const EVAL_INTERACTION_READ_ROUTES = Object.freeze([
  '/interactions',
  '/interactions/:evalId',
  '/interactions/:evalId/diagram',
  '/interactions/:evalId/transcript',
]);

export function registerEvalInteractionReadRoutes(router, { storeFor }) {
  const [interactionsPath, interactionPath, diagramPath, transcriptPath] = EVAL_INTERACTION_READ_ROUTES;

  router.get(interactionsPath, (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const scenarioId = req.query.scenarioId || null;
      const evaluations = storeFor(req).listInteractionEvals({ limit, scenarioId });
      res.json({ success: true, evals: evaluations, count: evaluations.length });
    } catch (error) {
      console.error('[EvalRoutes] List interactions error:', error);
      res.status(500).json({ error: 'Failed to list interaction evaluations' });
    }
  });

  router.get(interactionPath, (req, res) => {
    try {
      const evaluation = storeFor(req).getInteractionEval(req.params.evalId);
      if (!evaluation) return res.status(404).json({ error: 'Interaction evaluation not found' });
      res.json({ success: true, ...evaluation });
    } catch (error) {
      console.error('[EvalRoutes] Get interaction error:', error);
      res.status(500).json({ error: 'Failed to get interaction evaluation' });
    }
  });

  router.get(diagramPath, (req, res) => {
    try {
      const evaluation = storeFor(req).getInteractionEval(req.params.evalId);
      if (!evaluation) return res.status(404).json({ error: 'Interaction evaluation not found' });
      res.type('text/plain').send(evaluation.sequenceDiagram || 'No diagram available');
    } catch (error) {
      console.error('[EvalRoutes] Get diagram error:', error);
      res.status(500).json({ error: 'Failed to get diagram' });
    }
  });

  router.get(transcriptPath, (req, res) => {
    try {
      const evaluation = storeFor(req).getInteractionEval(req.params.evalId);
      if (!evaluation) return res.status(404).json({ error: 'Interaction evaluation not found' });
      res.type('text/plain').send(evaluation.formattedTranscript || 'No transcript available');
    } catch (error) {
      console.error('[EvalRoutes] Get transcript error:', error);
      res.status(500).json({ error: 'Failed to get transcript' });
    }
  });
}
