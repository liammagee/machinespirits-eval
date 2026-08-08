/**
 * Read-only statistics and projection owner for evaluation results.
 *
 * Transient placeholders are reconstructed from the run plan and progress log
 * so failed generations that never produced a database row remain visible in
 * run- and scenario-level summaries.
 */
export function createStatisticsRepository({
  db,
  getResults,
  getRun,
  readProgressLog,
  uniqueGenerationResults,
  getScenario,
  getTutorProfile,
  resolveModel,
}) {
  if (!db) throw new Error('createStatisticsRepository requires db');
  for (const [name, dependency] of Object.entries({
    getResults,
    getRun,
    readProgressLog,
    uniqueGenerationResults,
    getScenario,
    getTutorProfile,
    resolveModel,
  })) {
    if (typeof dependency !== 'function') {
      throw new Error(`createStatisticsRepository requires ${name}`);
    }
  }

  function safeResolveModel(ref) {
    if (!ref) return null;
    try {
      return resolveModel(ref);
    } catch {
      return null;
    }
  }

  function inferScenarioName(scenarioId, progressEvents = []) {
    for (let i = progressEvents.length - 1; i >= 0; i--) {
      const event = progressEvents[i];
      if (event?.scenarioId === scenarioId && event?.scenarioName) {
        return event.scenarioName;
      }
    }

    return getScenario(scenarioId)?.name || scenarioId;
  }

  function inferPlannedConfigSummary(profileName, metadata = {}) {
    const profile = profileName ? getTutorProfile(profileName) : null;
    const egoRef =
      profile?.ego?.provider && profile?.ego?.model ? `${profile.ego.provider}.${profile.ego.model}` : null;
    const superegoRef =
      profile?.superego?.provider && profile?.superego?.model
        ? `${profile.superego.provider}.${profile.superego.model}`
        : null;
    const egoResolved = safeResolveModel(egoRef);

    const inferred = {
      provider: egoResolved?.provider || profile?.ego?.resolvedProvider || profile?.ego?.provider || null,
      model: egoResolved?.model || profile?.ego?.resolvedModel || profile?.ego?.model || null,
      egoModel: egoRef,
      superegoModel: superegoRef,
    };

    if (metadata.modelOverride) {
      const resolved = safeResolveModel(metadata.modelOverride);
      if (resolved) {
        inferred.provider = resolved.provider;
        inferred.model = resolved.model;
      }
      inferred.egoModel = metadata.modelOverride;
      if (inferred.superegoModel) inferred.superegoModel = metadata.modelOverride;
    }

    if (metadata.tutorModelOverride) {
      const resolved = safeResolveModel(metadata.tutorModelOverride);
      if (resolved) {
        inferred.provider = resolved.provider;
        inferred.model = resolved.model;
      }
      inferred.egoModel = metadata.tutorModelOverride;
      if (inferred.superegoModel) inferred.superegoModel = metadata.tutorModelOverride;
    }

    if (metadata.egoModelOverride) {
      const resolved = safeResolveModel(metadata.egoModelOverride);
      if (resolved) {
        inferred.provider = resolved.provider;
        inferred.model = resolved.model;
      }
      inferred.egoModel = metadata.egoModelOverride;
    }

    if (metadata.superegoModelOverride && inferred.superegoModel) {
      inferred.superegoModel = metadata.superegoModelOverride;
    }

    return inferred;
  }

  function buildTransientPlaceholderMap(runId, existingResults = null) {
    const run = getRun(runId);
    if (!run || run.status !== 'completed') return new Map();

    const metadata = run.metadata || {};
    const progressEvents = readProgressLog(runId);
    const runStartProfiles = progressEvents.flatMap((event) =>
      event?.eventType === 'run_start' && Array.isArray(event.profiles) ? event.profiles : [],
    );
    const progressScenarioIds = progressEvents.map((event) => event?.scenarioId).filter(Boolean);
    const profileNames = [
      ...new Set(
        [...(metadata.profileNames || []), ...runStartProfiles].filter((value) => typeof value === 'string' && value),
      ),
    ];
    const scenarioIds = [
      ...new Set(
        [...(metadata.scenarioIds || []), ...progressScenarioIds].filter((value) => typeof value === 'string' && value),
      ),
    ];
    const runsPerConfig = Number(metadata.runsPerConfig) || 1;
    const results = existingResults || getResults(runId);

    if (profileNames.length === 0 || scenarioIds.length === 0) return new Map();

    const storedCounts = new Map();
    for (const result of uniqueGenerationResults(results)) {
      const key = `${result.scenarioId}|${result.profileName}`;
      storedCounts.set(key, (storedCounts.get(key) || 0) + 1);
    }

    const lastErrorByKey = new Map();
    for (const event of progressEvents) {
      if (event?.eventType !== 'test_error' || !event?.scenarioId || !event?.profileName) continue;
      const key = `${event.scenarioId}|${event.profileName}`;
      lastErrorByKey.set(key, event.errorMessage || null);
    }

    const placeholders = new Map();
    for (const scenarioId of scenarioIds) {
      const scenarioName = inferScenarioName(scenarioId, progressEvents);
      for (const profileName of profileNames) {
        const key = `${scenarioId}|${profileName}`;
        const storedCount = storedCounts.get(key) || 0;
        const transientFailedTests = Math.max(0, runsPerConfig - storedCount);
        if (transientFailedTests === 0) continue;

        const inferredConfig = inferPlannedConfigSummary(profileName, metadata);
        placeholders.set(key, {
          scenarioId,
          scenarioName,
          profileName,
          ...inferredConfig,
          transientFailedTests,
          lastErrorMessage: lastErrorByKey.get(key) || null,
        });
      }
    }

    return placeholders;
  }

  function getRunStats(runId) {
    const results = getResults(runId);
    const transientPlaceholders = buildTransientPlaceholderMap(runId, results);
    if (results.length === 0 && transientPlaceholders.size === 0) return [];

    const groups = {};

    for (const result of results) {
      const key = `${result.provider}|${result.model}|${result.profileName}`;
      if (!groups[key]) {
        groups[key] = createRunStatsGroup(result);
      }

      const group = groups[key];
      group.storedTests++;
      if (result.success) {
        group.successfulTests++;
        if (result.tutorFirstTurnScore != null) group.scores.push(result.tutorFirstTurnScore);
        if (result.baseScore != null) group.baseScores.push(result.baseScore);
        if (result.recognitionScore != null) group.recognitionScores.push(result.recognitionScore);
        if (result.latencyMs != null) group.latencies.push(result.latencyMs);
        group.inputTokens += result.inputTokens || 0;
        group.outputTokens += result.outputTokens || 0;
        if (result.passesRequired) group.passesRequired++;
        if (result.passesForbidden) group.passesForbidden++;

        if (result.scores) {
          for (const [dimension, score] of Object.entries(result.scores)) {
            const numericScore = typeof score === 'number' ? score : score?.score;
            if (Number.isFinite(numericScore)) {
              group.dimensionSums[dimension] = (group.dimensionSums[dimension] || 0) + numericScore;
              group.dimensionCounts[dimension] = (group.dimensionCounts[dimension] || 0) + 1;
            }
          }
        }
      }
    }

    for (const placeholder of transientPlaceholders.values()) {
      const key = `${placeholder.provider}|${placeholder.model}|${placeholder.profileName}`;
      if (!groups[key]) {
        groups[key] = createRunStatsGroup(placeholder);
      }

      const group = groups[key];
      group.transientFailedTests += placeholder.transientFailedTests;
      if (placeholder.lastErrorMessage) group.lastErrorMessage = placeholder.lastErrorMessage;
    }

    return Object.values(groups)
      .map(projectRunStatsGroup)
      .sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0));
  }

  function createRunStatsGroup(source) {
    return {
      provider: source.provider,
      model: source.model,
      profileName: source.profileName,
      egoModel: source.egoModel,
      superegoModel: source.superegoModel,
      storedTests: 0,
      transientFailedTests: 0,
      successfulTests: 0,
      scores: [],
      baseScores: [],
      recognitionScores: [],
      latencies: [],
      inputTokens: 0,
      outputTokens: 0,
      passesRequired: 0,
      passesForbidden: 0,
      dimensionSums: {},
      dimensionCounts: {},
      lastErrorMessage: null,
    };
  }

  function projectRunStatsGroup(group) {
    const avgScore = group.scores.length > 0 ? average(group.scores) : null;
    const totalTests = group.storedTests + group.transientFailedTests;
    const dimensions = {};
    for (const dimension of Object.keys(group.dimensionSums)) {
      dimensions[dimension] = group.dimensionSums[dimension] / group.dimensionCounts[dimension];
    }

    return {
      provider: group.provider,
      model: group.model,
      profileName: group.profileName,
      egoModel: group.egoModel,
      superegoModel: group.superegoModel,
      totalTests,
      storedTests: group.storedTests,
      successfulTests: group.successfulTests,
      transientFailedTests: group.transientFailedTests,
      successRate: totalTests > 0 ? group.successfulTests / totalTests : 0,
      avgScore,
      avgBaseScore: group.baseScores.length > 0 ? average(group.baseScores) : null,
      avgRecognitionScore: group.recognitionScores.length > 0 ? average(group.recognitionScores) : null,
      dimensions,
      avgLatencyMs: group.latencies.length > 0 ? average(group.latencies) : null,
      totalInputTokens: group.inputTokens,
      totalOutputTokens: group.outputTokens,
      passesRequired: group.passesRequired,
      passesForbidden: group.passesForbidden,
      validationPassRate: totalTests > 0 ? (group.passesRequired + group.passesForbidden) / (totalTests * 2) : 0,
      lastErrorMessage: group.lastErrorMessage,
    };
  }

  function average(values) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function getScenarioStats(runId) {
    const rows = db
      .prepare(
        `SELECT
          scenario_id,
          scenario_name,
          provider,
          model,
          profile_name,
          ego_model,
          superego_model,
          AVG(COALESCE(tutor_first_turn_score, overall_score)) as avg_score,
          AVG(base_score) as avg_base_score,
          AVG(recognition_score) as avg_recognition_score,
          AVG(latency_ms) as avg_latency,
          SUM(CASE WHEN passes_required = 1 AND passes_forbidden = 1 THEN 1 ELSE 0 END) as passes_validation,
          COUNT(*) as runs
        FROM evaluation_results
        WHERE run_id = ?
        GROUP BY scenario_id, provider, model, profile_name
        ORDER BY scenario_id, avg_score DESC`,
      )
      .all(runId);
    const transientPlaceholders = buildTransientPlaceholderMap(runId);
    if (rows.length === 0 && transientPlaceholders.size === 0) return [];

    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.scenario_id]) {
        grouped[row.scenario_id] = {
          scenarioId: row.scenario_id,
          scenarioName: row.scenario_name,
          configurations: [],
        };
      }
      grouped[row.scenario_id].configurations.push({
        provider: row.provider,
        model: row.model,
        profileName: row.profile_name,
        egoModel: row.ego_model,
        superegoModel: row.superego_model,
        avgScore: row.avg_score,
        avgBaseScore: row.avg_base_score,
        avgRecognitionScore: row.avg_recognition_score,
        avgLatencyMs: row.avg_latency,
        passesValidation: row.passes_validation === row.runs,
        storedRuns: row.runs,
        transientFailedRuns: 0,
        runs: row.runs,
        lastErrorMessage: null,
      });
    }

    for (const placeholder of transientPlaceholders.values()) {
      if (!grouped[placeholder.scenarioId]) {
        grouped[placeholder.scenarioId] = {
          scenarioId: placeholder.scenarioId,
          scenarioName: placeholder.scenarioName,
          configurations: [],
        };
      }

      let existingConfig = grouped[placeholder.scenarioId].configurations.find(
        (config) =>
          config.provider === placeholder.provider &&
          config.model === placeholder.model &&
          config.profileName === placeholder.profileName,
      );

      if (!existingConfig) {
        existingConfig = {
          provider: placeholder.provider,
          model: placeholder.model,
          profileName: placeholder.profileName,
          egoModel: placeholder.egoModel,
          superegoModel: placeholder.superegoModel,
          avgScore: null,
          avgBaseScore: null,
          avgRecognitionScore: null,
          avgLatencyMs: null,
          passesValidation: false,
          storedRuns: 0,
          transientFailedRuns: 0,
          runs: 0,
          lastErrorMessage: null,
        };
        grouped[placeholder.scenarioId].configurations.push(existingConfig);
      }

      existingConfig.transientFailedRuns += placeholder.transientFailedTests;
      existingConfig.runs += placeholder.transientFailedTests;
      existingConfig.passesValidation = false;
      if (placeholder.lastErrorMessage) existingConfig.lastErrorMessage = placeholder.lastErrorMessage;
    }

    return Object.values(grouped);
  }

  function compareConfigs(runId, config1, config2) {
    const getConfigResults = (provider, model) =>
      db
        .prepare(
          `SELECT
            scenario_id,
            AVG(COALESCE(tutor_first_turn_score, overall_score)) as avg_score,
            AVG(score_relevance) as relevance,
            AVG(score_specificity) as specificity,
            AVG(score_pedagogical) as pedagogical,
            AVG(score_personalization) as personalization,
            AVG(score_actionability) as actionability,
            AVG(score_tone) as tone,
            AVG(latency_ms) as latency,
            SUM(CASE WHEN passes_required = 1 AND passes_forbidden = 1 THEN 1 ELSE 0 END) * 1.0 / COUNT(*) as pass_rate
          FROM evaluation_results
          WHERE run_id = ? AND provider = ? AND model = ?
          GROUP BY scenario_id`,
        )
        .all(runId, provider, model);

    const results1 = getConfigResults(config1.provider, config1.model);
    const results2 = getConfigResults(config2.provider, config2.model);
    const comparison = [];
    const scenarios = new Set([...results1.map((row) => row.scenario_id), ...results2.map((row) => row.scenario_id)]);

    for (const scenarioId of scenarios) {
      const result1 = results1.find((row) => row.scenario_id === scenarioId);
      const result2 = results2.find((row) => row.scenario_id === scenarioId);
      const config1Score = result1?.avg_score ?? null;
      const config2Score = result2?.avg_score ?? null;
      const hasCompletePair = config1Score !== null && config2Score !== null;
      comparison.push({
        scenarioId,
        config1Score,
        config2Score,
        difference: hasCompletePair ? config1Score - config2Score : null,
        winner: hasCompletePair
          ? config1Score > config2Score
            ? 'config1'
            : config2Score > config1Score
              ? 'config2'
              : 'tie'
          : null,
      });
    }

    return {
      comparison,
      overall: {
        config1Wins: comparison.filter((entry) => entry.winner === 'config1').length,
        config2Wins: comparison.filter((entry) => entry.winner === 'config2').length,
        ties: comparison.filter((entry) => entry.winner === 'tie').length,
        incomplete: comparison.filter((entry) => entry.winner === null).length,
        config1AvgScore: results1.reduce((sum, row) => sum + row.avg_score, 0) / (results1.length || 1),
        config2AvgScore: results2.reduce((sum, row) => sum + row.avg_score, 0) / (results2.length || 1),
      },
    };
  }

  function getFactorialCellData(runId, options = {}) {
    const { scoreColumn = 'tutor_first_turn_score' } = options;
    const validColumns = ['tutor_first_turn_score', 'overall_score', 'base_score', 'recognition_score'];
    const column = validColumns.includes(scoreColumn) ? scoreColumn : 'tutor_first_turn_score';
    const rows = db
      .prepare(
        `SELECT factor_recognition, factor_multi_agent_tutor, factor_multi_agent_learner, ${column} as score
         FROM evaluation_results
         WHERE run_id = ? AND factor_recognition IS NOT NULL AND ${column} IS NOT NULL AND success = 1`,
      )
      .all(runId);
    const cells = {};

    for (const row of rows) {
      const key = `r${row.factor_recognition}_t${row.factor_multi_agent_tutor}_l${row.factor_multi_agent_learner}`;
      if (!cells[key]) cells[key] = [];
      cells[key].push(row.score);
    }

    return cells;
  }

  return {
    compareConfigs,
    getFactorialCellData,
    getRunStats,
    getScenarioStats,
  };
}
