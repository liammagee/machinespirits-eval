export const EVAL_ANALYSIS_READ_ROUTES = Object.freeze(['/compare-runs/:runId1/:runId2', '/trends']);

export function registerEvalAnalysisReadRoutes(router, { storeFor }) {
  const [compareRunsPath, trendsPath] = EVAL_ANALYSIS_READ_ROUTES;

  router.get(compareRunsPath, (req, res) => {
    try {
      const { runId1, runId2 } = req.params;
      const results1 = storeFor(req).getResults(runId1);
      const results2 = storeFor(req).getResults(runId2);
      if (!results1 || results1.length === 0) return res.status(404).json({ error: `Run ${runId1} not found` });
      if (!results2 || results2.length === 0) return res.status(404).json({ error: `Run ${runId2} not found` });

      const avg1 = calculateRunAverages(results1);
      const avg2 = calculateRunAverages(results2);
      const deltas = {
        tutorFirstTurnScore:
          avg2.tutorFirstTurnScore != null && avg1.tutorFirstTurnScore != null
            ? avg2.tutorFirstTurnScore - avg1.tutorFirstTurnScore
            : null,
        dimensions: {},
      };
      for (const dimension of Object.keys(avg1.dimensions)) {
        deltas.dimensions[dimension] =
          avg1.dimensions[dimension] != null && avg2.dimensions[dimension] != null
            ? avg2.dimensions[dimension] - avg1.dimensions[dimension]
            : null;
      }
      res.json({
        success: true,
        run1: { id: runId1, ...avg1 },
        run2: { id: runId2, ...avg2 },
        deltas,
        improved: deltas.tutorFirstTurnScore != null && deltas.tutorFirstTurnScore > 0,
      });
    } catch (error) {
      console.error('[EvalRoutes] Compare runs error:', error);
      res.status(500).json({ error: 'Failed to compare runs', details: error.message });
    }
  });

  router.get(trendsPath, (req, res) => {
    try {
      const { profile } = req.query;
      const limit = parseInt(req.query.limit) || 50;
      const runs = storeFor(req).listRuns({ limit: limit * 3 });
      const allResults = [];
      const dimensions = ['relevance', 'specificity', 'pedagogical', 'personalization', 'actionability', 'tone'];

      for (const run of runs) {
        const results = storeFor(req).getResults(run.id);
        let runType = run.metadata?.runType || 'eval';
        if (runType === 'eval' && run.description) {
          const description = run.description.toLowerCase();
          if (description.includes('matrix')) runType = 'matrix';
          else if (description.includes('auto-improve')) runType = 'auto';
          else if (description.includes('compare')) runType = 'compare';
          else if (description.includes('quick')) runType = 'quick';
        }

        for (const result of results) {
          if (profile && result.profileName !== profile) continue;
          const dimensionScores = {};
          for (const dimension of dimensions) {
            dimensionScores[dimension] = extractNumericScore(result.scores?.[dimension]);
          }
          allResults.push({
            runId: run.id,
            resultId: result.id,
            createdAt: result.createdAt || run.createdAt,
            description: run.description,
            runType,
            profileName: result.profileName,
            scenarioName: result.scenarioName,
            tutorFirstTurnScore: extractNumericScore(result.tutorFirstTurnScore),
            dimensions: dimensionScores,
            testCount: results.length,
            profiles: [result.profileName].filter(Boolean),
          });
        }
      }

      allResults.sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
      res.json({
        success: true,
        profile: profile || 'all',
        trends: allResults.slice(-limit),
        totalResults: allResults.length,
      });
    } catch (error) {
      console.error('[EvalRoutes] Get trends error:', error);
      res.status(500).json({ error: 'Failed to get trends', details: error.message });
    }
  });
}

function calculateRunAverages(results) {
  const dimensions = ['relevance', 'specificity', 'pedagogical', 'personalization', 'actionability', 'tone'];
  const dimensionScores = Object.fromEntries(dimensions.map((dimension) => [dimension, []]));
  let totalScore = 0;
  let scoreCount = 0;
  for (const result of results) {
    if (result.tutor_first_turn_score != null) {
      totalScore += result.tutor_first_turn_score;
      scoreCount += 1;
    }
    for (const dimension of dimensions) {
      const score = result[`score_${dimension}`];
      if (score != null) dimensionScores[dimension].push(score);
    }
  }
  const dimensionAverages = {};
  for (const dimension of dimensions) {
    const scores = dimensionScores[dimension];
    dimensionAverages[dimension] =
      scores.length > 0 ? scores.reduce((left, right) => left + right, 0) / scores.length : null;
  }
  return {
    tutorFirstTurnScore: scoreCount > 0 ? totalScore / scoreCount : null,
    dimensions: dimensionAverages,
    testCount: results.length,
    successCount: results.filter((result) => result.success).length,
  };
}

function extractNumericScore(scoreValue) {
  if (scoreValue == null) return null;
  if (typeof scoreValue === 'number') return isNaN(scoreValue) ? null : scoreValue;
  if (typeof scoreValue === 'object' && scoreValue.score != null) {
    const score = scoreValue.score;
    return typeof score === 'number' && !isNaN(score) ? score : null;
  }
  return null;
}
