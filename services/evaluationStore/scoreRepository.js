function requireFunction(value, name) {
  if (typeof value !== 'function') throw new TypeError(`${name} must be a function`);
  return value;
}

/**
 * Own mutable evaluation-result scores and their append-only audit trail around
 * one migrated connection. Rubric versions remain injected configuration.
 */
export function createScoreRepository(options = {}) {
  const {
    db,
    getTutorRubricVersion,
    getLearnerRubricVersion,
    getDialogueRubricVersion,
    getDeliberationRubricVersion,
    getCharismaRubricVersion,
    now = () => Date.now(),
  } = options;

  if (!db?.prepare) throw new TypeError('db must be a migrated better-sqlite3 connection');
  requireFunction(getTutorRubricVersion, 'getTutorRubricVersion');
  requireFunction(getLearnerRubricVersion, 'getLearnerRubricVersion');
  requireFunction(getDialogueRubricVersion, 'getDialogueRubricVersion');
  requireFunction(getDeliberationRubricVersion, 'getDeliberationRubricVersion');
  requireFunction(getCharismaRubricVersion, 'getCharismaRubricVersion');
  requireFunction(now, 'now');

  const nowIso = () => new Date(now()).toISOString();

  // ── P0 Provenance: audit trail helpers ────────────────────────────────

  /**
   * Coerce a value to a string suitable for audit storage.
   * Objects/arrays are JSON-stringified; null/undefined stay null.
   */
  function stringifyAudit(val) {
    if (val === null || val === undefined) return null;
    return typeof val === 'object' ? JSON.stringify(val) : String(val);
  }

  /**
   * Capture before-state of columns about to be UPDATEd, then return a
   * function that—when called after the UPDATE—diffs and writes audit rows.
   *
   * @param {string|number} resultId - Row ID in evaluation_results
   * @param {string[]} columns - Column names being modified
   * @param {string} operation - Name of the calling function (audit label)
   * @param {{ judgeModel?: string, rubricVersion?: string }} [metadata]
   * @returns {() => void} Call this AFTER the UPDATE statement runs
   */
  function withAuditTrail(resultId, columns, operation, metadata = {}) {
    const colList = columns.map((c) => `"${c}"`).join(', ');
    const before = db.prepare(`SELECT ${colList} FROM evaluation_results WHERE id = ?`).get(resultId);

    return function recordAudit() {
      const after = db.prepare(`SELECT ${colList} FROM evaluation_results WHERE id = ?`).get(resultId);
      const auditStmt = db.prepare(`
        INSERT INTO score_audit (result_id, column_name, old_value, new_value, operation, judge_model, rubric_version)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const col of columns) {
        const oldVal = before?.[col];
        const newVal = after?.[col];
        if (stringifyAudit(oldVal) !== stringifyAudit(newVal)) {
          auditStmt.run(
            String(resultId),
            col,
            stringifyAudit(oldVal),
            stringifyAudit(newVal),
            operation,
            metadata.judgeModel || null,
            metadata.rubricVersion || null,
          );
        }
      }
    };
  }

  /**
   * Retrieve the full score audit trail for a single evaluation result.
   * @param {string|number} resultId
   * @returns {Array} Ordered audit entries
   */
  function getScoreAudit(resultId) {
    return db.prepare('SELECT * FROM score_audit WHERE result_id = ? ORDER BY timestamp').all(String(resultId));
  }

  /**
   * Retrieve all audit entries for results belonging to a run.
   * @param {string} runId
   * @returns {Array} Ordered audit entries
   */
  function getScoreAuditByRun(runId) {
    return db
      .prepare(
        `
      SELECT sa.* FROM score_audit sa
      JOIN evaluation_results er ON sa.result_id = CAST(er.id AS TEXT)
      WHERE er.run_id = ?
      ORDER BY sa.timestamp
    `,
      )
      .all(runId);
  }
  /**
   * Update score columns for an existing result row (for rejudging - overwrites history)
   * @deprecated Use storeRejudgment() to preserve judgment history for reliability analysis
   */
  function updateResultScores(resultId, evaluation) {
    const recordAudit = withAuditTrail(
      resultId,
      [
        'score_relevance',
        'score_specificity',
        'score_pedagogical',
        'score_personalization',
        'score_actionability',
        'score_tone',
        'overall_score',
        'tutor_first_turn_score',
        'judge_model',
        'tutor_rubric_version',
      ],
      'updateResultScores',
      { judgeModel: evaluation.judgeModel, rubricVersion: getTutorRubricVersion() },
    );

    const stmt = db.prepare(`
      UPDATE evaluation_results SET
        score_relevance = ?,
        score_specificity = ?,
        score_pedagogical = ?,
        score_personalization = ?,
        score_actionability = ?,
        score_tone = ?,
        overall_score = ?,
        tutor_first_turn_score = ?,
        base_score = ?,
        recognition_score = ?,
        passes_required = ?,
        passes_forbidden = ?,
        required_missing = ?,
        forbidden_found = ?,
        judge_model = ?,
        evaluation_reasoning = ?,
        scores_with_reasoning = ?,
        scoring_method = ?,
        judge_latency_ms = ?,
        tutor_rubric_version = ?
      WHERE id = ?
    `);

    const scores = evaluation.scores || {};
    stmt.run(
      scores.relevance?.score ?? scores.relevance ?? null,
      scores.specificity?.score ?? scores.specificity ?? null,
      scores.pedagogical?.score ?? scores.pedagogical ?? null,
      scores.personalization?.score ?? scores.personalization ?? null,
      scores.actionability?.score ?? scores.actionability ?? null,
      scores.tone?.score ?? scores.tone ?? null,
      evaluation.tutorFirstTurnScore ?? evaluation.overallScore ?? null, // overall_score (deprecated)
      evaluation.tutorFirstTurnScore ?? evaluation.overallScore ?? null, // tutor_first_turn_score
      evaluation.baseScore ?? null,
      evaluation.recognitionScore ?? null,
      evaluation.passesRequired ? 1 : 0,
      evaluation.passesForbidden ? 1 : 0,
      JSON.stringify(evaluation.requiredMissing || []),
      JSON.stringify(evaluation.forbiddenFound || []),
      evaluation.judgeModel || null,
      evaluation.summary || null,
      evaluation.scores ? JSON.stringify(evaluation.scores) : null,
      'rubric', // Only called on successful evaluations
      evaluation.judgeLatencyMs ?? null,
      getTutorRubricVersion(),
      resultId,
    );

    recordAudit();
  }

  /**
   * Update tutor last-turn score for a multi-turn dialogue result.
   * Sets tutor_last_turn_score and computes tutor_development_score = last - first.
   *
   * @param {number} resultId - The evaluation result row ID
   * @param {Object} evaluation - Evaluation data
   * @param {number} evaluation.tutorLastTurnScore - Tutor rubric score on last turn (0-100)
   * @param {string} [evaluation.judgeModel] - Judge model used
   * @param {number} [evaluation.judgeLatencyMs] - Judge latency
   */
  function updateTutorLastTurnScore(resultId, evaluation) {
    const recordAudit = withAuditTrail(
      resultId,
      ['tutor_last_turn_score', 'tutor_development_score'],
      'updateTutorLastTurnScore',
    );

    // Read existing tutor_first_turn_score to compute development delta
    const row = db
      .prepare('SELECT tutor_first_turn_score, overall_score FROM evaluation_results WHERE id = ?')
      .get(resultId);
    const firstTurnScore = row?.tutor_first_turn_score ?? row?.overall_score ?? null;
    const lastTurnScore = evaluation.tutorLastTurnScore ?? null;
    const developmentScore = firstTurnScore != null && lastTurnScore != null ? lastTurnScore - firstTurnScore : null;

    const stmt = db.prepare(`
      UPDATE evaluation_results SET
        tutor_last_turn_score = ?,
        tutor_development_score = ?
      WHERE id = ?
    `);
    stmt.run(lastTurnScore, developmentScore, resultId);

    recordAudit();
  }

  /**
   * Update dialogue quality score for a multi-turn dialogue result.
   *
   * @param {number} resultId - The evaluation result row ID
   * @param {Object} evaluation - Dialogue quality evaluation data
   * @param {number} evaluation.dialogueQualityScore - Overall dialogue quality (0-100)
   * @param {Object} [evaluation.dialogueQualityScores] - Per-dimension scores
   * @param {string} [evaluation.dialogueQualitySummary] - Judge narrative summary
   * @param {string} [evaluation.dialogueQualityJudgeModel] - Judge model used
   */
  function updateDialogueQualityScore(resultId, evaluation) {
    const recordAudit = withAuditTrail(
      resultId,
      [
        'dialogue_quality_score',
        'dialogue_quality_scores',
        'dialogue_quality_summary',
        'dialogue_quality_judge_model',
        'dialogue_rubric_version',
      ],
      'updateDialogueQualityScore',
      { judgeModel: evaluation.dialogueQualityJudgeModel, rubricVersion: getDialogueRubricVersion() },
    );

    const stmt = db.prepare(`
      UPDATE evaluation_results SET
        dialogue_quality_score = ?,
        dialogue_quality_scores = ?,
        dialogue_quality_summary = ?,
        dialogue_quality_judge_model = ?,
        dialogue_rubric_version = ?
      WHERE id = ?
    `);
    stmt.run(
      evaluation.dialogueQualityScore ?? null,
      evaluation.dialogueQualityScores ? JSON.stringify(evaluation.dialogueQualityScores) : null,
      evaluation.dialogueQualitySummary || null,
      evaluation.dialogueQualityJudgeModel || null,
      getDialogueRubricVersion(),
      resultId,
    );

    recordAudit();
  }

  /**
   * Update dialogue quality INTERNAL (full-trace) score for a multi-turn dialogue result.
   * This is the score from the full transcript including internal deliberation.
   *
   * @param {number} resultId - The evaluation result row ID
   * @param {Object} evaluation - Internal dialogue quality evaluation data
   * @param {number} evaluation.dialogueQualityInternalScore - Full-trace dialogue quality (0-100)
   * @param {Object} [evaluation.dialogueQualityInternalScores] - Per-dimension full-trace scores
   * @param {string} [evaluation.dialogueQualityInternalSummary] - Judge narrative summary
   */
  function updateDialogueQualityInternalScore(resultId, evaluation) {
    const recordAudit = withAuditTrail(
      resultId,
      [
        'dialogue_quality_internal_score',
        'dialogue_quality_internal_scores',
        'dialogue_quality_internal_summary',
        'dialogue_rubric_version',
      ],
      'updateDialogueQualityInternalScore',
      { rubricVersion: getDialogueRubricVersion() },
    );

    const stmt = db.prepare(`
      UPDATE evaluation_results SET
        dialogue_quality_internal_score = ?,
        dialogue_quality_internal_scores = ?,
        dialogue_quality_internal_summary = ?,
        dialogue_rubric_version = ?
      WHERE id = ?
    `);
    stmt.run(
      evaluation.dialogueQualityInternalScore ?? null,
      evaluation.dialogueQualityInternalScores ? JSON.stringify(evaluation.dialogueQualityInternalScores) : null,
      evaluation.dialogueQualityInternalSummary || null,
      getDialogueRubricVersion(),
      resultId,
    );

    recordAudit();
  }

  /**
   * Update tutor deliberation quality scores for a multi-turn dialogue result.
   * Only applicable to multi-agent tutor cells with a configured superego.
   *
   * @param {number} resultId - The evaluation result row ID
   * @param {Object} evaluation - Deliberation evaluation data
   * @param {Object} evaluation.deliberationScores - Per-dimension scores (JSON-serializable)
   * @param {number} evaluation.deliberationScore - Overall deliberation quality (0-100)
   * @param {string} [evaluation.deliberationSummary] - Judge narrative summary
   * @param {string} [evaluation.deliberationJudgeModel] - Judge model used
   */
  function updateTutorDeliberationScores(resultId, evaluation) {
    const recordAudit = withAuditTrail(
      resultId,
      [
        'tutor_deliberation_scores',
        'tutor_deliberation_score',
        'tutor_deliberation_summary',
        'tutor_deliberation_judge_model',
        'deliberation_rubric_version',
      ],
      'updateTutorDeliberationScores',
      { judgeModel: evaluation.deliberationJudgeModel, rubricVersion: getDeliberationRubricVersion() },
    );

    const stmt = db.prepare(`
      UPDATE evaluation_results SET
        tutor_deliberation_scores = ?,
        tutor_deliberation_score = ?,
        tutor_deliberation_summary = ?,
        tutor_deliberation_judge_model = ?,
        deliberation_rubric_version = ?
      WHERE id = ?
    `);
    stmt.run(
      evaluation.deliberationScores ? JSON.stringify(evaluation.deliberationScores) : null,
      evaluation.deliberationScore ?? null,
      evaluation.deliberationSummary || null,
      evaluation.deliberationJudgeModel || null,
      getDeliberationRubricVersion(),
      resultId,
    );

    recordAudit();
  }

  /**
   * Update learner deliberation quality scores for a multi-turn dialogue result.
   * Only applicable to ego_superego learner architecture cells.
   *
   * @param {number} resultId - The evaluation result row ID
   * @param {Object} evaluation - Deliberation evaluation data
   * @param {Object} evaluation.deliberationScores - Per-dimension scores (JSON-serializable)
   * @param {number} evaluation.deliberationScore - Overall deliberation quality (0-100)
   * @param {string} [evaluation.deliberationSummary] - Judge narrative summary
   * @param {string} [evaluation.deliberationJudgeModel] - Judge model used
   */
  function updateLearnerDeliberationScores(resultId, evaluation) {
    const recordAudit = withAuditTrail(
      resultId,
      [
        'learner_deliberation_scores',
        'learner_deliberation_score',
        'learner_deliberation_summary',
        'learner_deliberation_judge_model',
        'deliberation_rubric_version',
      ],
      'updateLearnerDeliberationScores',
      { judgeModel: evaluation.deliberationJudgeModel, rubricVersion: getDeliberationRubricVersion() },
    );

    const stmt = db.prepare(`
      UPDATE evaluation_results SET
        learner_deliberation_scores = ?,
        learner_deliberation_score = ?,
        learner_deliberation_summary = ?,
        learner_deliberation_judge_model = ?,
        deliberation_rubric_version = ?
      WHERE id = ?
    `);
    stmt.run(
      evaluation.deliberationScores ? JSON.stringify(evaluation.deliberationScores) : null,
      evaluation.deliberationScore ?? null,
      evaluation.deliberationSummary || null,
      evaluation.deliberationJudgeModel || null,
      getDeliberationRubricVersion(),
      resultId,
    );

    recordAudit();
  }

  /**
   * Update process measures extracted from dialogue logs.
   * These are non-rubric metrics computed by turnComparisonAnalyzer and dialogueTraceAnalyzer.
   *
   * @param {string} resultId - The evaluation result ID
   * @param {Object} metrics - Process measure data
   * @param {number} [metrics.adaptationIndex] - Tutor approach change 0-1
   * @param {number} [metrics.learnerGrowthIndex] - Learner sophistication evolution 0-1
   * @param {number} [metrics.bilateralTransformationIndex] - Average of adaptation + growth 0-1
   * @param {number} [metrics.incorporationRate] - Ego revision following superego feedback 0-1
   * @param {number} [metrics.dimensionConvergence] - Score variance reduction 0-1
   * @param {number} [metrics.transformationQuality] - Overall transformation quality 0-100
   */
  function updateProcessMeasures(resultId, metrics) {
    const recordAudit = withAuditTrail(
      resultId,
      [
        'adaptation_index',
        'learner_growth_index',
        'bilateral_transformation_index',
        'incorporation_rate',
        'dimension_convergence',
        'transformation_quality',
      ],
      'updateProcessMeasures',
    );

    const stmt = db.prepare(`
      UPDATE evaluation_results SET
        adaptation_index = ?,
        learner_growth_index = ?,
        bilateral_transformation_index = ?,
        incorporation_rate = ?,
        dimension_convergence = ?,
        transformation_quality = ?
      WHERE id = ?
    `);
    stmt.run(
      metrics.adaptationIndex ?? null,
      metrics.learnerGrowthIndex ?? null,
      metrics.bilateralTransformationIndex ?? null,
      metrics.incorporationRate ?? null,
      metrics.dimensionConvergence ?? null,
      metrics.transformationQuality ?? null,
      resultId,
    );

    recordAudit();
  }

  /**
   * Update learner-side evaluation scores on an evaluation_results row.
   *
   * @param {string} resultId - The evaluation result ID
   * @param {Object} evaluation - Learner evaluation data
   * @param {Object} evaluation.scores - Per-turn learner scores (JSON-serializable)
   * @param {number} evaluation.overallScore - Weighted average learner score (0-100)
   * @param {string} evaluation.judgeModel - Model used for judging
   * @param {Object} [evaluation.holisticScores] - Dialogue-level learner rubric scores
   * @param {number} [evaluation.holisticOverallScore] - Dialogue-level learner score (0-100)
   * @param {string} [evaluation.holisticSummary] - Judge summary for dialogue-level score
   * @param {string} [evaluation.holisticJudgeModel] - Model used for holistic learner judging
   */
  function updateResultLearnerScores(resultId, evaluation) {
    const recordAudit = withAuditTrail(
      resultId,
      [
        'learner_scores',
        'learner_overall_score',
        'learner_judge_model',
        'learner_holistic_scores',
        'learner_holistic_overall_score',
        'learner_holistic_summary',
        'learner_holistic_judge_model',
        'learner_rubric_version',
      ],
      'updateResultLearnerScores',
      { judgeModel: evaluation.judgeModel, rubricVersion: getLearnerRubricVersion() },
    );

    const stmt = db.prepare(`
      UPDATE evaluation_results SET
        learner_scores = ?,
        learner_overall_score = ?,
        learner_judge_model = ?,
        learner_holistic_scores = ?,
        learner_holistic_overall_score = ?,
        learner_holistic_summary = ?,
        learner_holistic_judge_model = ?,
        learner_rubric_version = ?
      WHERE id = ?
    `);

    stmt.run(
      JSON.stringify(evaluation.scores ?? null),
      evaluation.overallScore ?? null,
      evaluation.judgeModel || null,
      evaluation.holisticScores ? JSON.stringify(evaluation.holisticScores) : null,
      evaluation.holisticOverallScore ?? null,
      evaluation.holisticSummary || null,
      evaluation.holisticJudgeModel || null,
      getLearnerRubricVersion(),
      resultId,
    );

    recordAudit();
  }

  /**
   * Update per-turn tutor scores for a multi-turn dialogue result.
   * Stores per-turn JSON scores and computes aggregate metrics.
   *
   * @param {string} resultId - The evaluation result row ID
   * @param {Object} evaluation - Tutor scoring data
   * @param {Object} evaluation.tutorScores - Per-turn tutor scores: { "0": {scores, overallScore, summary}, ... }
   * @param {number} evaluation.tutorOverallScore - Average across all tutor turns (0-100)
   * @param {number} evaluation.tutorFirstTurnScore - Turn 0 score (0-100)
   * @param {number} evaluation.tutorLastTurnScore - Turn N score (0-100)
   * @param {number} evaluation.tutorDevelopmentScore - last - first delta
   * @param {string} [evaluation.judgeModel] - Judge model used
   * @param {number} [evaluation.judgeLatencyMs] - Total judge latency
   */
  function updateResultTutorScores(resultId, evaluation) {
    const recordAudit = withAuditTrail(
      resultId,
      [
        'tutor_scores',
        'tutor_overall_score',
        'tutor_first_turn_score',
        'tutor_last_turn_score',
        'tutor_development_score',
        'judge_model',
        'tutor_rubric_version',
      ],
      'updateResultTutorScores',
      { judgeModel: evaluation.judgeModel, rubricVersion: evaluation.rubricVersion || getTutorRubricVersion() },
    );

    const resolvedRubricVersion = evaluation.rubricVersion || getTutorRubricVersion();

    const stmt = db.prepare(`
      UPDATE evaluation_results SET
        tutor_scores = ?,
        tutor_overall_score = ?,
        tutor_first_turn_score = ?,
        overall_score = ?,
        tutor_last_turn_score = ?,
        tutor_development_score = ?,
        judge_model = COALESCE(?, judge_model),
        judge_latency_ms = COALESCE(?, judge_latency_ms),
        tutor_rubric_version = ?
      WHERE id = ?
    `);

    stmt.run(
      evaluation.tutorScores ? JSON.stringify(evaluation.tutorScores) : null,
      evaluation.tutorOverallScore ?? null,
      evaluation.tutorFirstTurnScore ?? null,
      evaluation.tutorFirstTurnScore ?? null, // overall_score (deprecated alias)
      evaluation.tutorLastTurnScore ?? null,
      evaluation.tutorDevelopmentScore ?? null,
      evaluation.judgeModel || null,
      evaluation.judgeLatencyMs ?? null,
      resolvedRubricVersion,
      resultId,
    );

    recordAudit();
  }

  /**
   * Update holistic tutor evaluation scores on an evaluation_results row.
   * Writes ONLY the 4 holistic tutor columns — no clobbering of per-turn tutor data.
   *
   * @param {string} resultId - The evaluation result ID
   * @param {Object} evaluation - Holistic tutor evaluation data
   * @param {Object} evaluation.holisticScores - Per-dimension holistic scores (JSON-serializable)
   * @param {number} evaluation.holisticOverallScore - Weighted overall (0-100)
   * @param {string} [evaluation.holisticSummary] - Judge narrative summary
   * @param {string} [evaluation.holisticJudgeModel] - Model used for holistic judging
   */
  /**
   * Persist charisma rubric scores for a single evaluation row.
   * Used by scripts/evaluate-charisma.js (cells 101/102 + any back-fill of
   * earlier cells for cross-rubric comparison).
   *
   * @param {string} resultId
   * @param {Object} evaluation
   * @param {Object} evaluation.charismaScores - per-dimension scores
   * @param {number} evaluation.charismaOverallScore - 0-100 weighted average
   * @param {string} [evaluation.charismaSummary] - judge's brief summary
   * @param {string} [evaluation.charismaJudgeModel] - judge model label
   */
  function updateResultTutorCharismaScores(resultId, evaluation) {
    const recordAudit = withAuditTrail(
      resultId,
      [
        'tutor_charisma_scores',
        'tutor_charisma_overall_score',
        'tutor_charisma_rubric_version',
        'tutor_charisma_judge_model',
      ],
      'updateResultTutorCharismaScores',
      {
        judgeModel: evaluation.charismaJudgeModel,
        rubricVersion: getCharismaRubricVersion(),
      },
    );

    const stmt = db.prepare(`
      UPDATE evaluation_results SET
        tutor_charisma_scores = ?,
        tutor_charisma_overall_score = ?,
        tutor_charisma_rubric_version = ?,
        tutor_charisma_judge_model = ?
      WHERE id = ?
    `);

    stmt.run(
      evaluation.charismaScores ? JSON.stringify(evaluation.charismaScores) : null,
      evaluation.charismaOverallScore ?? null,
      getCharismaRubricVersion(),
      evaluation.charismaJudgeModel || null,
      resultId,
    );

    recordAudit();
  }

  function updateResultTutorRegisterScore(resultId, evaluation) {
    const registerName = String(evaluation.register || '').trim();
    const sliceKey = String(evaluation.sliceKey || '').trim();
    if (!registerName) throw new Error('updateResultTutorRegisterScore requires evaluation.register');
    if (!sliceKey) throw new Error('updateResultTutorRegisterScore requires evaluation.sliceKey');

    const recordAudit = withAuditTrail(resultId, ['tutor_register_scores'], 'updateResultTutorRegisterScore', {
      judgeModel: evaluation.judgeModel,
      rubricVersion: evaluation.rubricVersion,
    });

    const current = db.prepare(`SELECT tutor_register_scores FROM evaluation_results WHERE id = ?`).get(resultId);
    let payload = {};
    if (current?.tutor_register_scores) {
      try {
        payload = JSON.parse(current.tutor_register_scores) || {};
      } catch {
        payload = {};
      }
    }

    payload[registerName] = payload[registerName] || {};
    payload[registerName][sliceKey] = {
      scores: evaluation.scores || null,
      overall: evaluation.overall ?? null,
      summary: evaluation.summary || null,
      rubric_version: evaluation.rubricVersion || null,
      rubric_path: evaluation.rubricPath || null,
      judge_model: evaluation.judgeModel || null,
      guardrail_adjustments: evaluation.guardrailAdjustments || [],
      slice_ref: evaluation.sliceRef || null,
      scored_at: evaluation.scoredAt || nowIso(),
    };

    const stmt = db.prepare(`UPDATE evaluation_results SET tutor_register_scores = ? WHERE id = ?`);
    stmt.run(JSON.stringify(payload), resultId);

    recordAudit();
  }

  // Backfill the id-director per-turn construction envelope onto an existing
  // row. Stored as JSON (array of { turn, construction, tutorText } records, or
  // the legacy single-turn shape). Used by id-director cells (101-109) and the
  // trap-pilot adapter (scripts/run-id-director-trap-pilot.js).
  function setIdConstructionTrace(resultId, trace) {
    const stmt = db.prepare(`UPDATE evaluation_results SET id_construction_trace = ? WHERE id = ?`);
    stmt.run(trace == null ? null : JSON.stringify(trace), resultId);
  }

  function updateResultTutorHolisticScores(resultId, evaluation) {
    const recordAudit = withAuditTrail(
      resultId,
      [
        'tutor_holistic_scores',
        'tutor_holistic_overall_score',
        'tutor_holistic_summary',
        'tutor_holistic_judge_model',
        'tutor_rubric_version',
      ],
      'updateResultTutorHolisticScores',
      { judgeModel: evaluation.holisticJudgeModel, rubricVersion: getTutorRubricVersion() },
    );

    const stmt = db.prepare(`
      UPDATE evaluation_results SET
        tutor_holistic_scores = ?,
        tutor_holistic_overall_score = ?,
        tutor_holistic_summary = ?,
        tutor_holistic_judge_model = ?,
        tutor_rubric_version = ?
      WHERE id = ?
    `);

    stmt.run(
      evaluation.holisticScores ? JSON.stringify(evaluation.holisticScores) : null,
      evaluation.holisticOverallScore ?? null,
      evaluation.holisticSummary || null,
      evaluation.holisticJudgeModel || null,
      getTutorRubricVersion(),
      resultId,
    );

    recordAudit();
  }

  return Object.freeze({
    getScoreAudit,
    getScoreAuditByRun,
    updateResultScores,
    updateTutorLastTurnScore,
    updateDialogueQualityScore,
    updateDialogueQualityInternalScore,
    updateTutorDeliberationScores,
    updateLearnerDeliberationScores,
    updateProcessMeasures,
    updateResultLearnerScores,
    updateResultTutorScores,
    updateResultTutorCharismaScores,
    updateResultTutorRegisterScore,
    setIdConstructionTrace,
    updateResultTutorHolisticScores,
  });
}
