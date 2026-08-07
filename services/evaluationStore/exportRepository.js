const CSV_HEADERS = [
  'scenario_id',
  'scenario_name',
  'provider',
  'model',
  'tutor_first_turn_score',
  'relevance',
  'specificity',
  'pedagogical',
  'personalization',
  'actionability',
  'tone',
  'latency_ms',
  'input_tokens',
  'output_tokens',
  'passes_required',
  'passes_forbidden',
  'success',
  'attempt_index',
  'profile_name',
  'prompt_id',
  'ego_model',
  'superego_model',
  'factor_recognition',
  'factor_multi_agent_tutor',
  'factor_multi_agent_learner',
  'learner_architecture',
  'learner_id',
  'conversation_mode',
  'dialogue_id',
  'dialogue_content_hash',
  'config_hash',
  'tutor_ego_prompt_version',
  'tutor_superego_prompt_version',
  'learner_prompt_version',
  'prompt_content_hash',
  'id_construction_trace',
  'raw_response',
];

function escapeCsvField(value) {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export function createExportRepository({ getRun, getResults, getRunStats, getScenarioStats, now = () => new Date() }) {
  function exportToJson(runId) {
    const run = getRun(runId);
    const results = getResults(runId);
    const stats = getRunStats(runId);
    const scenarioStats = getScenarioStats(runId);

    return {
      run,
      stats,
      scenarioStats,
      results,
      exportedAt: now().toISOString(),
    };
  }

  function exportToCsv(runId) {
    const results = getResults(runId);
    const rows = results.map((result) => [
      result.scenarioId,
      result.scenarioName,
      result.provider,
      result.model,
      result.tutorFirstTurnScore,
      result.scores?.relevance,
      result.scores?.specificity,
      result.scores?.pedagogical,
      result.scores?.personalization,
      result.scores?.actionability,
      result.scores?.tone,
      result.latencyMs,
      result.inputTokens,
      result.outputTokens,
      result.passesRequired ? 1 : 0,
      result.passesForbidden ? 1 : 0,
      result.success ? 1 : 0,
      result.attemptIndex,
      result.profileName,
      result.promptId,
      result.egoModel,
      result.superegoModel,
      result.factors?.recognition == null ? null : result.factors.recognition ? 1 : 0,
      result.factors?.multi_agent_tutor == null ? null : result.factors.multi_agent_tutor ? 1 : 0,
      result.factors?.multi_agent_learner == null ? null : result.factors.multi_agent_learner ? 1 : 0,
      result.learnerArchitecture,
      result.learnerId,
      result.conversationMode,
      result.dialogueId,
      result.dialogueContentHash,
      result.configHash,
      result.tutorEgoPromptVersion,
      result.tutorSuperegoPromptVersion,
      result.learnerPromptVersion,
      result.promptContentHash,
      result.idConstructionTrace == null ? null : JSON.stringify(result.idConstructionTrace),
      result.rawResponse,
    ]);

    return [CSV_HEADERS.join(','), ...rows.map((row) => row.map(escapeCsvField).join(','))].join('\n');
  }

  return Object.freeze({ exportToJson, exportToCsv });
}
