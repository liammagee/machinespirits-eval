import { getAudienceRegisterDefinitions, getLexicalAccessibilityDefinitions } from './engagementRegisterRegistry.js';

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function tutorStubResponseSentences(text) {
  const sentences = oneLine(text)
    .split(/(?<=[.!?])\s+|(?<=[.!?][”"'’])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  return sentences.length ? sentences : oneLine(text) ? [oneLine(text)] : [];
}

export function tutorStubResponseWords(text) {
  return oneLine(text).match(/[\p{L}\p{N}'-]+/gu) || [];
}

export function tutorStubSentenceBudgetVisible(actualAverage, authoredMaximum) {
  const maximum = Number(authoredMaximum);
  if (!Number.isFinite(maximum)) return true;
  // Sentence segmentation and short scenic fragments make a hard one-word
  // cliff too brittle for a transcript-visibility heuristic. Preserve the
  // authored target while allowing a ten-percent measurement margin; prose
  // that is materially denser still fails the axis.
  const tolerance = Math.max(1, maximum * 0.1);
  return Number(actualAverage) <= maximum + tolerance;
}

/**
 * Measure a public surface against the same sentence-density budgets used by
 * the response-configuration audit. This is intentionally narrower than the
 * full lexical audit: callers can use it for immutable authored SOURCE spans
 * without letting surrounding adaptive-host prose conceal an over-dense clue.
 */
export function measureTutorStubSurfaceSentenceAccessibility({
  text = '',
  audienceRegister = null,
  lexicalAccessibility = null,
} = {}) {
  const words = tutorStubResponseWords(text);
  const sentences = tutorStubResponseSentences(text);
  const sentenceWordCounts = sentences.map((sentence) => tutorStubResponseWords(sentence).length);
  const averageSentenceWords = Number((words.length / Math.max(1, sentences.length)).toFixed(2));
  const audienceDefinition = getAudienceRegisterDefinitions()[audienceRegister] || {};
  const lexicalDefinition = getLexicalAccessibilityDefinitions()[lexicalAccessibility] || {};
  const audienceMaximum = Number(audienceDefinition.max_average_sentence_words);
  const lexicalMaximum = Number(lexicalDefinition.max_average_sentence_words);
  const audienceVisible = tutorStubSentenceBudgetVisible(averageSentenceWords, audienceMaximum);
  const lexicalVisible = tutorStubSentenceBudgetVisible(averageSentenceWords, lexicalMaximum);
  return {
    text: oneLine(text),
    wordCount: words.length,
    sentenceCount: sentences.length,
    sentenceWordCounts,
    averageSentenceWords,
    maxSentenceWords: Math.max(0, ...sentenceWordCounts),
    audienceRegister,
    audienceMaximum: Number.isFinite(audienceMaximum) ? audienceMaximum : null,
    lexicalAccessibility,
    lexicalMaximum: Number.isFinite(lexicalMaximum) ? lexicalMaximum : null,
    measurementTolerance: 0.1,
    audienceVisible,
    lexicalVisible,
    ok:
      words.length > 0 &&
      sentences.length > 0 &&
      Number.isFinite(audienceMaximum) &&
      Number.isFinite(lexicalMaximum) &&
      audienceVisible &&
      lexicalVisible,
  };
}
