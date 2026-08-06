/**
 * Persistence owner for learner-tutor interaction evaluations.
 *
 * The repository is bound to the already-open, already-migrated evaluation
 * database. It deliberately keeps the facade's existing projections distinct:
 * listInteractionEvals is a compact index, getInteractionEval and
 * getInteractionEvalByRunId expose the full record, and
 * listInteractionEvalsByRunId retains its historical run-scoped shape.
 */
export function createInteractionRepository({ db }) {
  if (!db) throw new Error('createInteractionRepository requires db');

  function parseInteractionDetail(row) {
    if (!row) return null;

    return {
      evalId: row.id,
      runId: row.run_id,
      scenarioId: row.scenario_id,
      scenarioName: row.scenario_name,
      evalType: row.eval_type,
      learnerProfile: row.learner_profile,
      tutorProfile: row.tutor_profile,
      personaId: row.persona_id,
      learnerAgents: JSON.parse(row.learner_agents || '[]'),
      turnCount: row.turn_count,
      turns: JSON.parse(row.turns || '[]'),
      sequenceDiagram: row.sequence_diagram,
      formattedTranscript: row.formatted_transcript,
      learnerMemoryBefore: JSON.parse(row.learner_memory_before || 'null'),
      learnerMemoryAfter: JSON.parse(row.learner_memory_after || 'null'),
      tutorMemoryBefore: JSON.parse(row.tutor_memory_before || 'null'),
      tutorMemoryAfter: JSON.parse(row.tutor_memory_after || 'null'),
      totalTokens: row.total_tokens,
      learnerTokens: row.learner_tokens,
      tutorTokens: row.tutor_tokens,
      latencyMs: row.latency_ms,
      finalLearnerState: row.final_learner_state,
      finalUnderstanding: row.final_understanding,
      uniqueOutcomes: JSON.parse(row.unique_outcomes || '[]'),
      judgeOverallScore: row.judge_overall_score,
      judgeEvaluation: JSON.parse(row.judge_evaluation || 'null'),
      learnerScores: JSON.parse(row.learner_scores || 'null'),
      learnerOverallScore: row.learner_overall_score,
      learnerJudgeModel: row.learner_judge_model,
      learnerHolisticScores: JSON.parse(row.learner_holistic_scores || 'null'),
      learnerHolisticOverallScore: row.learner_holistic_overall_score,
      learnerHolisticSummary: row.learner_holistic_summary,
      learnerHolisticJudgeModel: row.learner_holistic_judge_model,
      createdAt: row.created_at,
    };
  }

  function parseInteractionSummary(row) {
    return {
      evalId: row.id,
      runId: row.run_id,
      scenarioId: row.scenario_id,
      scenarioName: row.scenario_name,
      evalType: row.eval_type,
      learnerProfile: row.learner_profile,
      tutorProfile: row.tutor_profile,
      personaId: row.persona_id,
      turnCount: row.turn_count,
      totalTokens: row.total_tokens,
      latencyMs: row.latency_ms,
      finalLearnerState: row.final_learner_state,
      finalUnderstanding: row.final_understanding,
      judgeOverallScore: row.judge_overall_score,
      createdAt: row.created_at,
    };
  }

  function parseRunInteraction(row) {
    return {
      evalId: row.id,
      runId: row.run_id,
      scenarioId: row.scenario_id,
      scenarioName: row.scenario_name,
      evalType: row.eval_type,
      learnerProfile: row.learner_profile,
      tutorProfile: row.tutor_profile,
      personaId: row.persona_id,
      learnerAgents: JSON.parse(row.learner_agents || '[]'),
      turnCount: row.turn_count,
      turns: JSON.parse(row.turns || '[]'),
      formattedTranscript: row.formatted_transcript,
      totalTokens: row.total_tokens,
      finalLearnerState: row.final_learner_state,
      finalUnderstanding: row.final_understanding,
      judgeOverallScore: row.judge_overall_score,
      learnerScores: JSON.parse(row.learner_scores || 'null'),
      learnerOverallScore: row.learner_overall_score,
      learnerJudgeModel: row.learner_judge_model,
      learnerHolisticScores: JSON.parse(row.learner_holistic_scores || 'null'),
      learnerHolisticOverallScore: row.learner_holistic_overall_score,
      learnerHolisticSummary: row.learner_holistic_summary,
      learnerHolisticJudgeModel: row.learner_holistic_judge_model,
      createdAt: row.created_at,
    };
  }

  function storeInteractionEval(evalData) {
    const stmt = db.prepare(`
      INSERT INTO interaction_evaluations (
        id, run_id, scenario_id, scenario_name, eval_type,
        learner_profile, tutor_profile, persona_id, learner_agents,
        turn_count, turns, sequence_diagram, formatted_transcript,
        learner_memory_before, learner_memory_after, tutor_memory_before, tutor_memory_after,
        total_tokens, learner_tokens, tutor_tokens, latency_ms,
        final_learner_state, final_understanding, unique_outcomes,
        judge_overall_score, judge_evaluation
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      evalData.evalId,
      evalData.runId || null,
      evalData.scenarioId,
      evalData.scenarioName,
      evalData.type || 'short_term',
      evalData.learnerProfile || null,
      evalData.tutorProfile || 'default',
      evalData.personaId || null,
      JSON.stringify(evalData.learnerAgents || []),
      evalData.metrics?.turnCount || evalData.interaction?.turns?.length || 0,
      JSON.stringify(evalData.interaction?.turns || []),
      evalData.sequenceDiagram || null,
      evalData.formattedTranscript || null,
      JSON.stringify(evalData.interaction?.writingPadSnapshots?.learner?.before || null),
      JSON.stringify(evalData.interaction?.writingPadSnapshots?.learner?.after || null),
      JSON.stringify(evalData.interaction?.writingPadSnapshots?.tutor?.before || null),
      JSON.stringify(evalData.interaction?.writingPadSnapshots?.tutor?.after || null),
      evalData.metrics?.totalTokens || 0,
      evalData.metrics?.learnerTokens || 0,
      evalData.metrics?.tutorTokens || 0,
      evalData.metrics?.totalLatencyMs || 0,
      evalData.interaction?.summary?.learnerFinalState || null,
      evalData.interaction?.summary?.learnerFinalUnderstanding || null,
      JSON.stringify(evalData.interaction?.summary?.uniqueOutcomes || []),
      evalData.judgeEvaluation?.overall_assessment?.score ??
        evalData.judgeEvaluation?.narrative_summary?.overall_quality ??
        evalData.judgeEvaluation?.overall_score ??
        null,
      JSON.stringify(evalData.judgeEvaluation || null),
    );

    return evalData.evalId;
  }

  function listInteractionEvals(options = {}) {
    const { limit = 50, scenarioId = null } = options;
    const sql = `
      SELECT * FROM interaction_evaluations
      ${scenarioId ? 'WHERE scenario_id = ?' : ''}
      ORDER BY created_at DESC
      LIMIT ?
    `;
    const stmt = db.prepare(sql);
    const rows = scenarioId ? stmt.all(scenarioId, limit) : stmt.all(limit);
    return rows.map(parseInteractionSummary);
  }

  function getInteractionEval(evalId) {
    const row = db.prepare('SELECT * FROM interaction_evaluations WHERE id = ?').get(evalId);
    return parseInteractionDetail(row);
  }

  function getInteractionEvalByRunId(runId) {
    const row = db
      .prepare('SELECT * FROM interaction_evaluations WHERE run_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(runId);
    return parseInteractionDetail(row);
  }

  function listInteractionEvalsByRunId(runId) {
    const rows = db.prepare('SELECT * FROM interaction_evaluations WHERE run_id = ? ORDER BY created_at').all(runId);
    return rows.map(parseRunInteraction);
  }

  function updateInteractionLearnerScores(evalId, evaluation) {
    const stmt = db.prepare(`
      UPDATE interaction_evaluations
      SET learner_scores = ?,
          learner_overall_score = ?,
          learner_judge_model = ?,
          learner_holistic_scores = ?,
          learner_holistic_overall_score = ?,
          learner_holistic_summary = ?,
          learner_holistic_judge_model = ?
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
      evalId,
    );
  }

  return {
    getInteractionEval,
    getInteractionEvalByRunId,
    listInteractionEvals,
    listInteractionEvalsByRunId,
    storeInteractionEval,
    updateInteractionLearnerScores,
  };
}
