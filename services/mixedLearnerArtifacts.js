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
  return {
    answer: answer || oneLine(raw),
    clue: clueSafelySignalsAnswer(candidateClue, answer) ? candidateClue : null,
    parsed: Boolean(parsed && answer),
  };
}

export function mixedLearnerAnalysisCacheKey(snapshot) {
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}
import { createHash } from 'node:crypto';
