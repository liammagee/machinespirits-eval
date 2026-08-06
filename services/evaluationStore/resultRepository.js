import { createHash } from 'node:crypto';

function requireFunction(value, name) {
  if (typeof value !== 'function') throw new TypeError(`${name} must be a function`);
  return value;
}

/**
 * Own generation-result persistence around one migrated database connection.
 * Run lookup and rubric resolution stay injected to avoid static module cycles.
 */
export function createResultRepository(options = {}) {
  const { db, getTutorRubricVersion, getRun, expectedTestsForRun, now = () => Date.now() } = options;

  if (!db?.prepare) throw new TypeError('db must be a migrated better-sqlite3 connection');
  requireFunction(getTutorRubricVersion, 'getTutorRubricVersion');
  requireFunction(getRun, 'getRun');
  requireFunction(expectedTestsForRun, 'expectedTestsForRun');
  requireFunction(now, 'now');

  const nowIso = () => new Date(now()).toISOString();

  const GENERATION_PROVENANCE_COLUMNS = Object.freeze([
    'run_id',
    'scenario_id',
    'scenario_name',
    'scenario_type',
    'provider',
    'model',
    'profile_name',
    'hyperparameters',
    'prompt_id',
    'ego_model',
    'superego_model',
    'suggestions',
    'raw_response',
    'latency_ms',
    'input_tokens',
    'output_tokens',
    'cost',
    'dialogue_rounds',
    'deliberation_rounds',
    'api_calls',
    'dialogue_id',
    'attempt_index',
    'factor_recognition',
    'factor_multi_agent_tutor',
    'factor_multi_agent_learner',
    'learner_architecture',
    'scoring_method',
    'conversation_mode',
    'dialogue_content_hash',
    'config_hash',
    'tutor_ego_prompt_version',
    'tutor_superego_prompt_version',
    'learner_prompt_version',
    'prompt_content_hash',
    'learner_id',
    'id_construction_trace',
  ]);

  function parseJsonValue(value, fallback) {
    if (value == null || value === '') return fallback;
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  function serializeJsonValue(value, fallback) {
    if (typeof value === 'string') {
      try {
        JSON.parse(value);
        return value;
      } catch {
        return JSON.stringify(value);
      }
    }
    return JSON.stringify(value ?? fallback);
  }

  function booleanToDb(value) {
    return value == null ? null : value ? 1 : 0;
  }

  function normalizeAttemptIndex(value) {
    if (value == null || value === '') return null;
    const attemptIndex = Number(value);
    return Number.isInteger(attemptIndex) && attemptIndex >= 0 ? attemptIndex : null;
  }

  function generationProvenanceRecord(result, runId = result.runId) {
    const factors = result.factors || {};
    return {
      run_id: runId,
      scenario_id: result.scenarioId,
      scenario_name: result.scenarioName ?? null,
      scenario_type: result.scenarioType || 'suggestion',
      provider: result.provider,
      model: result.model,
      profile_name: result.profileName ?? null,
      hyperparameters: serializeJsonValue(result.hyperparameters, {}),
      prompt_id: result.promptId ?? null,
      ego_model: result.egoModel ?? null,
      superego_model: result.superegoModel ?? null,
      suggestions: serializeJsonValue(result.suggestions, []),
      raw_response: result.rawResponse ?? null,
      latency_ms: result.latencyMs ?? null,
      input_tokens: result.inputTokens ?? null,
      output_tokens: result.outputTokens ?? null,
      cost: result.cost ?? null,
      dialogue_rounds: result.dialogueRounds ?? null,
      deliberation_rounds: result.deliberationRounds ?? null,
      api_calls: result.apiCalls ?? null,
      dialogue_id: result.dialogueId ?? null,
      attempt_index: normalizeAttemptIndex(result.attemptIndex ?? result.runNum),
      factor_recognition: booleanToDb(result.factorRecognition ?? factors.recognition),
      factor_multi_agent_tutor: booleanToDb(result.factorMultiAgentTutor ?? factors.multi_agent_tutor),
      factor_multi_agent_learner: booleanToDb(result.factorMultiAgentLearner ?? factors.multi_agent_learner),
      learner_architecture: result.learnerArchitecture ?? null,
      scoring_method: result.scoringMethod ?? null,
      conversation_mode: result.conversationMode ?? null,
      dialogue_content_hash: result.dialogueContentHash ?? null,
      config_hash: result.configHash ?? null,
      tutor_ego_prompt_version: result.tutorEgoPromptVersion ?? null,
      tutor_superego_prompt_version: result.tutorSuperegoPromptVersion ?? null,
      learner_prompt_version: result.learnerPromptVersion ?? null,
      prompt_content_hash: result.promptContentHash ?? null,
      learner_id: result.learnerId ?? null,
      id_construction_trace:
        result.idConstructionTrace == null ? null : serializeJsonValue(result.idConstructionTrace, null),
    };
  }

  function generationProvenanceValues(result, runId = result.runId) {
    const record = generationProvenanceRecord(result, runId);
    return GENERATION_PROVENANCE_COLUMNS.map((column) => record[column]);
  }

  function parseGenerationProvenance(row) {
    const factorsPresent =
      row.factor_recognition != null || row.factor_multi_agent_tutor != null || row.factor_multi_agent_learner != null;
    const factors = factorsPresent
      ? {
          recognition: Boolean(row.factor_recognition),
          multi_agent_tutor: Boolean(row.factor_multi_agent_tutor),
          multi_agent_learner: Boolean(row.factor_multi_agent_learner),
        }
      : null;

    return {
      runId: row.run_id,
      scenarioId: row.scenario_id,
      scenarioName: row.scenario_name,
      scenarioType: row.scenario_type || 'suggestion',
      provider: row.provider,
      model: row.model,
      profileName: row.profile_name,
      hyperparameters: parseJsonValue(row.hyperparameters, {}),
      promptId: row.prompt_id,
      egoModel: row.ego_model,
      superegoModel: row.superego_model,
      suggestions: parseJsonValue(row.suggestions, []),
      rawResponse: row.raw_response ?? null,
      latencyMs: row.latency_ms,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      cost: row.cost,
      dialogueRounds: row.dialogue_rounds,
      deliberationRounds: row.deliberation_rounds ?? null,
      apiCalls: row.api_calls,
      dialogueId: row.dialogue_id,
      attemptIndex: normalizeAttemptIndex(row.attempt_index),
      factors,
      factorRecognition: factorsPresent ? row.factor_recognition : null,
      factorMultiAgentTutor: factorsPresent ? row.factor_multi_agent_tutor : null,
      factorMultiAgentLearner: factorsPresent ? row.factor_multi_agent_learner : null,
      learnerArchitecture: row.learner_architecture || null,
      scoringMethod: row.scoring_method || null,
      conversationMode: row.conversation_mode || null,
      dialogueContentHash: row.dialogue_content_hash || null,
      configHash: row.config_hash || null,
      tutorEgoPromptVersion: row.tutor_ego_prompt_version || null,
      tutorSuperegoPromptVersion: row.tutor_superego_prompt_version || null,
      learnerPromptVersion: row.learner_prompt_version || null,
      promptContentHash: row.prompt_content_hash || null,
      learnerId: row.learner_id || null,
      idConstructionTrace: parseJsonValue(row.id_construction_trace, null),
    };
  }

  function generationIdentity(result) {
    const attemptIndex = normalizeAttemptIndex(result.attemptIndex ?? result.runNum);
    const pair = `${result.profileName || ''}:${result.scenarioId || ''}`;
    if (attemptIndex != null) return `${pair}:attempt:${attemptIndex}`;
    if (result.dialogueId) return `${pair}:dialogue:${result.dialogueId}`;
    if (result.dialogueContentHash) return `${pair}:dialogue-hash:${result.dialogueContentHash}`;

    const legacyPayload = JSON.stringify({
      provider: result.provider || null,
      model: result.model || null,
      profileName: result.profileName || null,
      scenarioId: result.scenarioId || null,
      configHash: result.configHash || null,
      promptContentHash: result.promptContentHash || null,
      suggestions: result.suggestions || [],
      rawResponse: result.rawResponse || null,
    });
    return `${pair}:legacy:${createHash('sha256').update(legacyPayload).digest('hex')}`;
  }

  function uniqueGenerationResults(results) {
    const byIdentity = new Map();
    for (const result of results) {
      // Failed attempt rows are retry evidence, not completed generations. Keep
      // them in stored-row counts, but never let them satisfy run completion.
      if (result.success === false || result.success === 0) continue;
      const identity = generationIdentity(result);
      if (!byIdentity.has(identity)) byIdentity.set(identity, result);
    }
    return [...byIdentity.values()];
  }

  /**
   * Store an individual evaluation result
   *
   * @param {string} runId - The run ID
   * @param {Object} result - The evaluation result
   * @returns {number} Inserted row ID
   */
  function storeResult(runId, result) {
    const stmt = db.prepare(`
      INSERT INTO evaluation_results (
        ${GENERATION_PROVENANCE_COLUMNS.join(', ')},
        score_relevance, score_specificity, score_pedagogical,
        score_personalization, score_actionability, score_tone, overall_score, tutor_first_turn_score,
        base_score, recognition_score,
        passes_required, passes_forbidden, required_missing, forbidden_found,
        judge_model, evaluation_reasoning, scores_with_reasoning, success, error_message,
        created_at
      ) VALUES (
        ${GENERATION_PROVENANCE_COLUMNS.map(() => '?').join(', ')},
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?
      )
    `);

    const info = stmt.run(
      ...generationProvenanceValues(result, runId),
      result.scores?.relevance,
      result.scores?.specificity,
      result.scores?.pedagogical,
      result.scores?.personalization,
      result.scores?.actionability,
      result.scores?.tone,
      result.tutorFirstTurnScore ?? result.overallScore ?? null,
      result.tutorFirstTurnScore ?? result.overallScore ?? null, // tutor_first_turn_score (same value, synced)
      result.baseScore,
      result.recognitionScore,
      result.passesRequired ? 1 : 0,
      result.passesForbidden ? 1 : 0,
      JSON.stringify(result.requiredMissing || []),
      JSON.stringify(result.forbiddenFound || []),
      result.judgeModel,
      result.evaluationReasoning,
      result.scoresWithReasoning ? JSON.stringify(result.scoresWithReasoning) : null,
      result.success ? 1 : 0,
      result.errorMessage,
      nowIso(),
    );

    return info.lastInsertRowid;
  }

  /**
   * Get results for a run
   */
  function getResults(runId, options = {}) {
    const { scenarioId = null, provider = null, model = null, profileName = null } = options;

    let query = 'SELECT * FROM evaluation_results WHERE run_id = ?';
    const params = [runId];

    if (scenarioId) {
      query += ' AND scenario_id = ?';
      params.push(scenarioId);
    }

    if (provider) {
      query += ' AND provider = ?';
      params.push(provider);
    }

    if (model) {
      query += ' AND model = ?';
      params.push(model);
    }

    if (profileName) {
      query += ' AND profile_name = ?';
      params.push(profileName);
    }

    query += ' ORDER BY created_at';

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);

    return rows.map(parseResultRow);
  }
  /**
   * Parse a result row from the database
   */
  function parseResultRow(row) {
    // Parse scoresWithReasoning if available, otherwise build from numeric scores
    let scoresWithReasoning = null;
    if (row.scores_with_reasoning) {
      try {
        scoresWithReasoning = JSON.parse(row.scores_with_reasoning);
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Parse tutor_scores if available (Rubric 2.2+ per-turn scores)
    let tutorScoresJson = null;
    if (row.tutor_scores) {
      try {
        tutorScoresJson = JSON.parse(row.tutor_scores);
      } catch (e) {
        // Ignore
      }
    }

    // Build the scores object
    let scores = scoresWithReasoning;

    if (!scores && tutorScoresJson) {
      // If we have tutor_scores JSON (v2.2+), aggregate turn-level dimension scores
      // into a single dimensions object for legacy-compatible reporting.
      const turnIndices = Object.keys(tutorScoresJson);
      if (turnIndices.length > 0) {
        const dimensionSums = {};
        const dimensionCounts = {};

        for (const idx of turnIndices) {
          const turnData = tutorScoresJson[idx];
          const turnScores = turnData.scores || turnData; // Handle both wrapped and direct scores
          if (!turnScores) continue;

          for (const [dim, detail] of Object.entries(turnScores)) {
            // Skip non-score keys if we're looking at a turn object
            if (
              [
                'overallScore',
                'baseScore',
                'recognitionScore',
                'summary',
                'judgeInputHash',
                'judgeTimestamp',
                'judgeModel',
                'contentTurnId',
                'turnIndex',
              ].includes(dim)
            )
              continue;

            const val = typeof detail === 'number' ? detail : detail?.score;
            if (val != null) {
              dimensionSums[dim] = (dimensionSums[dim] || 0) + val;
              dimensionCounts[dim] = (dimensionCounts[dim] || 0) + 1;
            }
          }
        }

        const aggregated = {};
        for (const dim of Object.keys(dimensionSums)) {
          aggregated[dim] = dimensionSums[dim] / dimensionCounts[dim];
        }

        // If we found dimensions, use them
        if (Object.keys(aggregated).length > 0) {
          scores = aggregated;
        }
      }
    }

    // Fallback to legacy numeric columns if no structured scores found
    if (!scores) {
      const legacyScores = {
        relevance: row.score_relevance,
        specificity: row.score_specificity,
        pedagogical: row.score_pedagogical,
        personalization: row.score_personalization,
        actionability: row.score_actionability,
        tone: row.score_tone,
      };
      scores = Object.values(legacyScores).some((value) => value != null) ? legacyScores : null;
    }

    return {
      id: row.id,
      ...parseGenerationProvenance(row),
      scores,
      tutorFirstTurnScore: row.tutor_first_turn_score ?? row.overall_score ?? null,
      overallScore: row.tutor_first_turn_score ?? row.overall_score ?? null, // DEPRECATED alias
      scoringMethod: row.scoring_method || null,
      baseScore: row.base_score,
      recognitionScore: row.recognition_score,
      passesRequired: Boolean(row.passes_required),
      passesForbidden: Boolean(row.passes_forbidden),
      requiredMissing: JSON.parse(row.required_missing || '[]'),
      forbiddenFound: JSON.parse(row.forbidden_found || '[]'),
      judgeModel: row.judge_model,
      evaluationReasoning: row.evaluation_reasoning,
      success: Boolean(row.success),
      errorMessage: row.error_message,
      createdAt: row.created_at,
      learnerScores: row.learner_scores ? JSON.parse(row.learner_scores) : null,
      learnerOverallScore: row.learner_overall_score != null ? row.learner_overall_score : null,
      learnerJudgeModel: row.learner_judge_model || null,
      learnerHolisticScores: row.learner_holistic_scores ? JSON.parse(row.learner_holistic_scores) : null,
      learnerHolisticOverallScore:
        row.learner_holistic_overall_score != null ? row.learner_holistic_overall_score : null,
      learnerHolisticSummary: row.learner_holistic_summary || null,
      learnerHolisticJudgeModel: row.learner_holistic_judge_model || null,
      // Dialogue scoring columns
      tutorLastTurnScore: row.tutor_last_turn_score != null ? row.tutor_last_turn_score : null,
      tutorDevelopmentScore: row.tutor_development_score != null ? row.tutor_development_score : null,
      dialogueQualityScore: row.dialogue_quality_score != null ? row.dialogue_quality_score : null,
      dialogueQualityScores: row.dialogue_quality_scores ? JSON.parse(row.dialogue_quality_scores) : null,
      dialogueQualitySummary: row.dialogue_quality_summary || null,
      dialogueQualityJudgeModel: row.dialogue_quality_judge_model || null,
      dialogueQualityInternalScore:
        row.dialogue_quality_internal_score != null ? row.dialogue_quality_internal_score : null,
      dialogueQualityInternalScores: row.dialogue_quality_internal_scores
        ? JSON.parse(row.dialogue_quality_internal_scores)
        : null,
      dialogueQualityInternalSummary: row.dialogue_quality_internal_summary || null,
      tutorScores: row.tutor_scores ? JSON.parse(row.tutor_scores) : null,
      tutorOverallScore: row.tutor_overall_score != null ? row.tutor_overall_score : null,
      tutorHolisticScores: row.tutor_holistic_scores ? JSON.parse(row.tutor_holistic_scores) : null,
      tutorHolisticOverallScore: row.tutor_holistic_overall_score != null ? row.tutor_holistic_overall_score : null,
      tutorHolisticSummary: row.tutor_holistic_summary || null,
      tutorHolisticJudgeModel: row.tutor_holistic_judge_model || null,
      tutorCharismaScores: row.tutor_charisma_scores ? JSON.parse(row.tutor_charisma_scores) : null,
      tutorCharismaOverallScore: row.tutor_charisma_overall_score != null ? row.tutor_charisma_overall_score : null,
      tutorCharismaSummary: row.tutor_charisma_summary || null,
      tutorCharismaRubricVersion: row.tutor_charisma_rubric_version || null,
      tutorCharismaJudgeModel: row.tutor_charisma_judge_model || null,
      tutorRegisterScores: row.tutor_register_scores ? JSON.parse(row.tutor_register_scores) : null,
    };
  }
  /**
   * Store a new judgment row for an existing result (preserves judgment history).
   * Copies the original result's response data but adds new scores from a different judge.
   * This enables inter-judge reliability analysis.
   *
   * @param {Object} originalResult - The original result row (from getResults)
   * @param {Object} evaluation - The new evaluation scores
   * @returns {number} The new row ID
   */
  function storeRejudgment(originalResult, evaluation) {
    const stmt = db.prepare(`
      INSERT INTO evaluation_results (
        ${GENERATION_PROVENANCE_COLUMNS.join(', ')},
        score_relevance, score_specificity, score_pedagogical,
        score_personalization, score_actionability, score_tone, overall_score, tutor_first_turn_score,
        base_score, recognition_score,
        passes_required, passes_forbidden, required_missing, forbidden_found,
        judge_model, evaluation_reasoning, scores_with_reasoning, success, error_message,
        judge_latency_ms,
        tutor_rubric_version,
        created_at
      ) VALUES (
        ${GENERATION_PROVENANCE_COLUMNS.map(() => '?').join(', ')},
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?,
        ?,
        ?
      )
    `);

    const scores = evaluation.scores || {};
    const firstTurnScore = evaluation.tutorFirstTurnScore ?? evaluation.overallScore ?? null;

    const bindArgs = [
      ...generationProvenanceValues({ ...originalResult, scoringMethod: 'rubric' }),
      // New scores from the new judge
      scores.relevance?.score ?? scores.relevance ?? null,
      scores.specificity?.score ?? scores.specificity ?? null,
      scores.pedagogical?.score ?? scores.pedagogical ?? null,
      scores.personalization?.score ?? scores.personalization ?? null,
      scores.actionability?.score ?? scores.actionability ?? null,
      scores.tone?.score ?? scores.tone ?? null,
      firstTurnScore, // overall_score (deprecated)
      firstTurnScore, // tutor_first_turn_score
      evaluation.baseScore ?? null,
      evaluation.recognitionScore ?? null,
      evaluation.passesRequired ? 1 : 0,
      evaluation.passesForbidden ? 1 : 0,
      JSON.stringify(evaluation.requiredMissing || []),
      JSON.stringify(evaluation.forbiddenFound || []),
      evaluation.judgeModel || null,
      evaluation.summary || null,
      evaluation.scores ? JSON.stringify(evaluation.scores) : null,
      1, // success
      null, // error_message
      evaluation.judgeLatencyMs ?? null,
      getTutorRubricVersion(),
      nowIso(),
    ];
    const info = stmt.run(...bindArgs);

    return info.lastInsertRowid;
  }
  /**
   * Get a single result by its row ID.
   */
  function getResultById(id) {
    const stmt = db.prepare('SELECT * FROM evaluation_results WHERE id = ?');
    const row = stmt.get(id);
    if (!row) return null;
    return parseResultRow(row);
  }

  /**
   * Clone evaluation result rows into a derived run for rubric version comparison.
   *
   * Creates a new run record `{runId}_rubric-v{ver}` (if not already present),
   * then copies each target row with all generation columns preserved and all
   * score columns NULLed so they can be re-scored with the new rubric.
   *
   * @param {string} sourceRunId - The original run ID
   * @param {Array} sourceResults - Array of parsed result objects to clone
   * @param {string} rubricVersion - The target rubric version (e.g. "2.2")
   * @returns {{ derivedRunId: string, clonedIds: number[] }}
   */
  function cloneRowsForRubricVersion(sourceRunId, sourceResults, rubricVersion) {
    const derivedRunId = `${sourceRunId}_rubric-v${rubricVersion}`;

    // Ensure derived run record exists
    const existingRun = getRun(derivedRunId);
    if (!existingRun) {
      const sourceRun = getRun(sourceRunId);
      const createdAt = nowIso();
      const meta = {
        ...(sourceRun?.metadata || {}),
        sourceRunId,
        rubricVersion,
        derivedFrom: 'rubric-version-comparison',
      };
      db.prepare(
        `
        INSERT INTO evaluation_runs (
          id, created_at, description, total_scenarios, total_configurations, total_tests,
          metadata, status, git_commit, package_version
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'running', ?, ?)
      `,
      ).run(
        derivedRunId,
        createdAt,
        `Rubric v${rubricVersion} re-score of ${sourceRunId}`,
        sourceRun?.totalScenarios || 0,
        sourceRun?.totalConfigurations || 0,
        sourceRun?.totalTests || expectedTestsForRun(sourceRun),
        JSON.stringify(meta),
        sourceRun?.gitCommit || null,
        sourceRun?.packageVersion || null,
      );
    }

    // Check for existing clones by generation identity. Rejudged rows share the
    // same identity and must not be mistaken for independent attempts.
    const existingGenerations = new Set(getResults(derivedRunId).map(generationIdentity));

    const clonedIds = [];
    const insertStmt = db.prepare(`
      INSERT INTO evaluation_results (
        ${GENERATION_PROVENANCE_COLUMNS.join(', ')},
        success, error_message,
        created_at
      ) VALUES (
        ${GENERATION_PROVENANCE_COLUMNS.map(() => '?').join(', ')},
        ?, ?,
        ?
      )
    `);

    for (const r of sourceResults) {
      const identity = generationIdentity(r);
      if (existingGenerations.has(identity)) continue;

      const info = insertStmt.run(
        ...generationProvenanceValues(r, derivedRunId),
        r.success ? 1 : 0,
        r.errorMessage || null,
        nowIso(),
      );
      clonedIds.push(info.lastInsertRowid);
      existingGenerations.add(identity);
    }

    return { derivedRunId, clonedIds };
  }

  return Object.freeze({
    storeResult,
    getResults,
    getResultById,
    storeRejudgment,
    generationIdentity,
    uniqueGenerationResults,
    cloneRowsForRubricVersion,
    parseResultRow,
  });
}
