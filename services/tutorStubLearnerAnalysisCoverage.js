export const TUTOR_STUB_LEARNER_ANALYSIS_MAX_RETRIES = 2;
export const TUTOR_STUB_LEARNER_ANALYSIS_INCOMPLETE_STATUS = 'learner_analysis_incomplete';

const RETRYABLE_STRICT_ANALYSIS_FAILURES = new Set([
  'invalid_semantic_events',
  'invalid_analysis_schema',
  'empty_analysis_output',
  'analysis_model_call_failed',
]);

export async function dispatchTutorStubLearnerAnalysisWithRetries({
  dispatch,
  appendAttempt,
  turn,
  maxRetries = TUTOR_STUB_LEARNER_ANALYSIS_MAX_RETRIES,
} = {}) {
  if (typeof dispatch !== 'function') throw new Error('learner-analysis retry dispatch requires a function');
  for (let attemptIndex = 1; attemptIndex <= maxRetries + 1; attemptIndex += 1) {
    try {
      const result = await dispatch();
      appendAttempt?.({ attemptIndex, status: 'analyzed', failureCode: null, turn });
      return result;
    } catch (error) {
      const failureCode = String(error?.code || 'analysis_model_call_failed');
      appendAttempt?.({ attemptIndex, status: 'failed', failureCode, turn });
      if (
        error?.name === 'AbortError' ||
        !RETRYABLE_STRICT_ANALYSIS_FAILURES.has(failureCode) ||
        attemptIndex > maxRetries
      ) {
        throw error;
      }
    }
  }
  throw new Error('learner-analysis retry loop exhausted without a result');
}

export function summarizeTutorStubLearnerAnalysisCoverage(events = []) {
  const publicTurns = events
    .filter((event) => event?.type === 'turn_complete' && event.turnRecord)
    .map((event) => Number(event.turnRecord.turn))
    .filter(Number.isFinite);
  const analyzedTurns = new Set(
    events
      .filter(
        (event) =>
          event?.type === 'turn_complete' &&
          event.turnRecord?.classification?.combined === true &&
          !event.turnRecord.classification.error,
      )
      .map((event) => Number(event.turnRecord.turn)),
  );
  const unanalyzedTurns = [...new Set(publicTurns.filter((turn) => !analyzedTurns.has(turn)))].sort(
    (left, right) => left - right,
  );
  const uniquePublicTurns = [...new Set(publicTurns)].sort((left, right) => left - right);
  const analyzedCount = uniquePublicTurns.length - unanalyzedTurns.length;
  return {
    publicTurns: uniquePublicTurns,
    analyzedTurns: uniquePublicTurns.filter((turn) => analyzedTurns.has(turn)),
    unanalyzedTurns,
    coverage: uniquePublicTurns.length ? Number((analyzedCount / uniquePublicTurns.length).toFixed(6)) : 1,
  };
}

export function resolveTutorStubLearnerAnalysisSealDisposition(dialogues = []) {
  const unanalyzed = dialogues.flatMap((dialogue) =>
    (dialogue.coverage?.unanalyzedTurns || []).map((turn) => ({ jobId: dialogue.jobId || null, turn })),
  );
  const publicTurnCount = dialogues.reduce((sum, dialogue) => sum + dialogue.coverage.publicTurns.length, 0);
  const analyzedTurnCount = dialogues.reduce((sum, dialogue) => sum + dialogue.coverage.analyzedTurns.length, 0);
  return {
    status: unanalyzed.length ? TUTOR_STUB_LEARNER_ANALYSIS_INCOMPLETE_STATUS : 'complete',
    publicTurnCount,
    analyzedTurnCount,
    coverage: publicTurnCount ? Number((analyzedTurnCount / publicTurnCount).toFixed(6)) : 1,
    unanalyzed,
  };
}
