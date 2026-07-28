import { factKey } from './dramaticDerivation/chainer.js';
import { splitTutorStubPublicWords } from './tutorStubPublicText.js';

export function formatTutorStubFact(fact) {
  if (!Array.isArray(fact) || fact.length === 0) return String(fact || '');
  const [relation, ...argumentsList] = fact;
  return `${relation}(${argumentsList.join(', ')})`;
}

export function tutorStubSplitSymbolWords(value) {
  return splitTutorStubPublicWords(value);
}

export function tutorStubTextTokens(text) {
  return new Set(tutorStubSplitSymbolWords(text));
}

export function tutorStubTokenRegex(token) {
  return new RegExp(`\\b${String(token || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'iu');
}

export function tutorStubTextContainsToken(text, token) {
  return tutorStubTokenRegex(token).test(String(text || ''));
}

export function tutorStubFactMatches(left, right) {
  return factKey(left) === factKey(right);
}
