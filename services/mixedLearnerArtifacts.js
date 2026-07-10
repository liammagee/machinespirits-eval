function stripFence(text) {
  return String(text || '')
    .trim()
    .replace(/^```(?:json)?\s*/iu, '')
    .replace(/\s*```$/u, '')
    .trim();
}

function oneLine(value) {
  return String(value || '').replace(/\s+/gu, ' ').trim();
}

export function clueSafelySignalsAnswer(clue, answer) {
  const hint = oneLine(clue);
  const response = oneLine(answer);
  if (!hint || !response || hint === response || hint.length > 280) return false;
  const lowerHint = hint.toLowerCase();
  const lowerResponse = response.toLowerCase();
  if (lowerResponse.length >= 12 && lowerHint.includes(lowerResponse)) return false;
  return true;
}

export function mixedLearnerSuggestionMove(answer, declaredMove = '') {
  const response = oneLine(answer);
  if (/\?/u.test(response)) return 'ask_question';
  const normalized = oneLine(declaredMove).toLowerCase().replace(/[\s-]+/gu, '_');
  if (['ask', 'question', 'ask_question', 'clarify', 'request_clarification'].includes(normalized)) {
    return 'ask_question';
  }
  return 'respond';
}

export function profileSignalSafelyDescribesAnswer(profileSignal, answer) {
  const signal = oneLine(profileSignal);
  const response = oneLine(answer);
  if (!signal || signal.length > 320 || signal.toLowerCase() === response.toLowerCase()) return null;
  return signal;
}

export function parseMixedLearnerArtifacts(rawText) {
  const raw = stripFence(rawText);
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        parsed = JSON.parse(raw.slice(start, end + 1));
      } catch (_) {
        parsed = null;
      }
    }
  }

  const answer = oneLine(parsed?.answer || parsed?.learner_response || parsed?.response);
  const candidateClue = oneLine(parsed?.clue || parsed?.hint || parsed?.direction);
  const profileSignal = profileSignalSafelyDescribesAnswer(
    parsed?.profile_signal || parsed?.profileSignal || parsed?.profile_expression,
    answer,
  );
  return {
    answer: answer || oneLine(raw),
    clue: clueSafelySignalsAnswer(candidateClue, answer) ? candidateClue : null,
    move: mixedLearnerSuggestionMove(answer || raw, parsed?.move || parsed?.response_type || parsed?.kind),
    profileSignal,
    parsed: Boolean(parsed && answer),
  };
}

export function mixedLearnerAnalysisCacheKey(snapshot) {
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

export function invalidateMixedLearnerCache(mixedLearner, { preserveAnalysisCache = false } = {}) {
  const cachedAnalysis = mixedLearner?.analysisCache || null;
  const hadState = Boolean(
    mixedLearner?.pending || mixedLearner?.suggestion || mixedLearner?.error || cachedAnalysis,
  );
  const discardedTutorResponse = Boolean(
    cachedAnalysis &&
      !preserveAnalysisCache &&
      (cachedAnalysis.tutorPromise || cachedAnalysis.tutorResponse || cachedAnalysis.tutorStatus !== 'idle'),
  );

  mixedLearner?.artifactAbortController?.abort();
  if (mixedLearner) mixedLearner.artifactAbortController = null;

  if (cachedAnalysis && !preserveAnalysisCache) {
    cachedAnalysis.abortController?.abort();
    cachedAnalysis.status = 'discarded';
    cachedAnalysis.raw = null;
    cachedAnalysis.error = null;
    cachedAnalysis.promise = null;
    cachedAnalysis.tutorStatus = 'discarded';
    cachedAnalysis.tutorContextKey = null;
    cachedAnalysis.tutorPromise = null;
    cachedAnalysis.tutorResponse = null;
    cachedAnalysis.tutorError = null;
  }

  if (mixedLearner) {
    mixedLearner.seq = Number(mixedLearner.seq || 0) + 1;
    mixedLearner.pending = null;
    mixedLearner.suggestion = null;
    mixedLearner.error = null;
    if (!preserveAnalysisCache) mixedLearner.analysisCache = null;
  }

  return {
    cachedAnalysis,
    discardedAnalysis: Boolean(cachedAnalysis && !preserveAnalysisCache),
    discardedTutorResponse,
    hadState,
    preservedAnalysis: Boolean(cachedAnalysis && preserveAnalysisCache),
  };
}

export function refreshMixedLearnerPrompt(readlineInterface) {
  const hasBufferedInput = Boolean(String(readlineInterface.line || ''));
  if (!hasBufferedInput && Number.isFinite(readlineInterface.cursor)) readlineInterface.cursor = 0;
  readlineInterface.prompt(hasBufferedInput);
  return { hasBufferedInput, cursor: readlineInterface.cursor };
}
import { createHash } from 'node:crypto';
