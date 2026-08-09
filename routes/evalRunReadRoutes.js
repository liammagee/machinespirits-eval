export const EVAL_RUN_READ_ROUTES = Object.freeze([
  '/runs',
  '/runs-incomplete',
  '/runs/:runId',
  '/runs/:runId/report',
  '/runs/:runId/resume-status',
]);

function isRunNotFound(error) {
  return /Run not found/i.test(error?.message || '');
}

export function registerEvalRunListReadRoutes(router, { storeFor }) {
  const [runsPath, incompleteRunsPath] = EVAL_RUN_READ_ROUTES;

  router.get(runsPath, (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const runs = storeFor(req).listRuns({ limit });
      const interactionEvals = storeFor(req).listInteractionEvals({ limit });
      const interactionRuns = interactionEvals.map((evaluation) => ({
        id: evaluation.evalId,
        description: evaluation.scenarioName || 'Interaction Evaluation',
        status: 'completed',
        createdAt: evaluation.createdAt,
        totalScenarios: 1,
        totalTests: evaluation.turnCount || 1,
        type: 'interaction',
        metadata: JSON.stringify({
          runType: 'interaction',
          profiles: [evaluation.tutorProfile || 'default'],
          scenarioNames: [evaluation.scenarioName],
          learnerProfile: evaluation.learnerProfile,
          personaId: evaluation.personaId,
        }),
      }));
      const allRuns = [...runs, ...interactionRuns]
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
        .slice(0, limit);
      res.json({ success: true, runs: allRuns });
    } catch (error) {
      console.error('[EvalRoutes] List runs error:', error);
      res.status(500).json({ error: 'Failed to list runs' });
    }
  });

  router.get(incompleteRunsPath, (req, res) => {
    try {
      const olderThanMinutes = parseInt(req.query.olderThanMinutes) || 30;
      const runs = storeFor(req).findIncompleteRuns({ olderThanMinutes });
      res.json({ success: true, runs, found: runs.length });
    } catch (error) {
      console.error('[EvalRoutes] Find incomplete runs error:', error);
      res.status(500).json({ error: 'Failed to find incomplete runs' });
    }
  });
}

export function registerEvalRunDetailReadRoutes(router, { storeFor, runnerFor }) {
  const [, , runPath, reportPath] = EVAL_RUN_READ_ROUTES;

  router.get(runPath, (req, res) => {
    try {
      const { runId } = req.params;
      if (runId.startsWith('short-') || runId.startsWith('long-')) {
        const evalData = storeFor(req).getInteractionEval(runId);
        if (!evalData) return res.status(404).json({ error: 'Interaction evaluation not found' });
        return res.json(interactionRunResponse(evalData));
      }

      const result = runnerFor(req).getRunResults(runId);
      const runMetadata = result.run?.metadata
        ? typeof result.run.metadata === 'string'
          ? JSON.parse(result.run.metadata)
          : result.run.metadata
        : {};

      if (runMetadata.runType === 'interaction') {
        const interactionEval = storeFor(req).getInteractionEvalByRunId(runId);
        if (interactionEval) {
          return res.json({
            ...interactionRunResponse(interactionEval),
            run: result.run,
            description: result.run?.description || interactionEval.scenarioName,
            metadata: runMetadata,
          });
        }
      }

      const scenarioNames = [...new Set((result.results || []).map((row) => row.scenarioName).filter(Boolean))].sort();
      res.json({
        success: true,
        ...result,
        status: result.run?.status,
        description: result.run?.description,
        scenarioNames,
      });
    } catch (error) {
      if (isRunNotFound(error)) {
        return res.status(404).json({ error: 'Run not found', code: 'run_not_found', details: error.message });
      }
      console.error('[EvalRoutes] Get run error:', error);
      res.status(500).json({ error: 'Failed to get run results', details: error.message });
    }
  });

  router.get(reportPath, (req, res) => {
    try {
      const report = runnerFor(req).generateReport(req.params.runId);
      if (req.accepts('text/plain')) res.type('text/plain').send(report);
      else res.json({ success: true, report });
    } catch (error) {
      if (isRunNotFound(error)) {
        return res.status(404).json({ error: 'Run not found', code: 'run_not_found', details: error.message });
      }
      console.error('[EvalRoutes] Get report error:', error);
      res.status(500).json({ error: 'Failed to generate report', details: error.message });
    }
  });
}

export function registerEvalRunResumeStatusReadRoute(router, { storeFor, evalConfigLoader }) {
  const resumeStatusPath = EVAL_RUN_READ_ROUTES[4];
  router.get(resumeStatusPath, (req, res) => {
    try {
      const { runId } = req.params;
      const run = storeFor(req).getRun(runId);
      if (!run) return res.status(404).json({ error: 'Run not found' });

      const metadata = run.metadata || {};
      const profiles = req.query.profiles
        ? req.query.profiles.split(',')
        : metadata.profileNames || metadata.profiles || [];
      const scenariosParam = req.query.scenarios || metadata.scenarioIds || metadata.scenarios || 'all';
      if (profiles.length === 0) {
        return res.status(400).json({
          error: 'Profiles not specified',
          hint: 'Provide profiles as query param or ensure run metadata contains profiles',
        });
      }

      const allScenarios = evalConfigLoader.listScenarios();
      const scenarios =
        scenariosParam === 'all'
          ? allScenarios
          : allScenarios.filter((scenario) => scenariosParam.includes(scenario.id));
      const status = storeFor(req).getIncompleteTests(runId, profiles, scenarios);
      res.json({
        success: true,
        ...status,
        runMetadata: {
          description: run.description,
          createdAt: run.createdAt,
          totalScenarios: run.totalScenarios,
          totalConfigurations: run.totalConfigurations,
        },
      });
    } catch (error) {
      console.error('[EvalRoutes] Resume status error:', error);
      res.status(500).json({ error: 'Failed to get resume status', details: error.message });
    }
  });
}

function interactionRunResponse(evalData) {
  return {
    success: true,
    type: 'interaction',
    run: {
      id: evalData.evalId,
      description: evalData.scenarioName || 'Interaction Evaluation',
      status: 'completed',
      createdAt: evalData.createdAt,
    },
    stats: { totalTests: 1, avgScore: evalData.judgeOverallScore },
    results: [
      {
        scenarioId: evalData.scenarioId,
        scenarioName: evalData.scenarioName,
        profileName: evalData.tutorProfile || 'default',
        tutorProfile: evalData.tutorProfile || 'default',
        model: `${evalData.turnCount} turns`,
        passed: evalData.judgeOverallScore >= 3,
        tutorFirstTurnScore: evalData.judgeOverallScore,
        tutor_first_turn_score: evalData.judgeOverallScore,
        inputTokens: evalData.learnerTokens || 0,
        outputTokens: evalData.tutorTokens || 0,
        latencyMs: evalData.latencyMs || 0,
        latency_ms: evalData.latencyMs || 0,
        isInteraction: true,
        interactionEvalId: evalData.evalId,
        dialogueId: evalData.evalId,
        judgeEvaluation: evalData.judgeEvaluation,
      },
    ],
    interaction: {
      evalId: evalData.evalId,
      scenarioName: evalData.scenarioName,
      turnCount: evalData.turnCount,
      turns: evalData.turns,
      sequenceDiagram: evalData.sequenceDiagram,
      formattedTranscript: evalData.formattedTranscript,
      totalTokens: evalData.totalTokens,
      learnerTokens: evalData.learnerTokens,
      tutorTokens: evalData.tutorTokens,
      latencyMs: evalData.latencyMs,
      judgeOverallScore: evalData.judgeOverallScore,
      judgeEvaluation: evalData.judgeEvaluation,
    },
    status: 'completed',
    description: evalData.scenarioName,
    scenarioNames: [evalData.scenarioName],
  };
}
