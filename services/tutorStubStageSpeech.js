function replaceRoleGrammar(text, role, replacements) {
  return String(text || '')
    .replace(new RegExp(`\\bthe ${role} is\\b`, 'giu'), replacements.is)
    .replace(new RegExp(`\\bthe ${role} was\\b`, 'giu'), replacements.was)
    .replace(new RegExp(`\\bthe ${role} has\\b`, 'giu'), replacements.has)
    .replace(new RegExp(`\\bthe ${role} does\\b`, 'giu'), replacements.does)
    .replace(new RegExp(`\\bthe ${role}(?:'s|’s)\\b`, 'giu'), replacements.possessive)
    .replace(new RegExp(`\\bthe ${role}\\b`, 'giu'), replacements.other);
}

export function cleanTutorStubStageSpeech(text, { voice = 'learner' } = {}) {
  const tutorReplacements =
    voice === 'guide'
      ? { is: 'I am', was: 'I was', has: 'I have', does: 'I do', possessive: 'my', other: 'I' }
      : { is: 'you are', was: 'you were', has: 'you have', does: 'you do', possessive: 'your', other: 'you' };
  const learnerReplacements =
    voice === 'guide'
      ? { is: 'you are', was: 'you were', has: 'you have', does: 'you do', possessive: 'your', other: 'you' }
      : { is: 'I am', was: 'I was', has: 'I have', does: 'I do', possessive: 'my', other: 'me' };

  let cleaned = replaceRoleGrammar(text, 'tutor', tutorReplacements);
  cleaned = replaceRoleGrammar(cleaned, 'learner', learnerReplacements)
    .replace(/\b(?:this|the) tutoring dialogue\b/giu, 'this inquiry')
    .replace(/\b(?:this|the) dialogue\b/giu, 'this inquiry')
    .replace(/\bthe prompt\b/giu, voice === 'guide' ? 'what I asked' : 'what you asked')
    .trim();
  return cleaned
    .replace(/^your\b/u, 'Your')
    .replace(/^you\b/u, 'You')
    .replace(/^my\b/u, 'My');
}

export function latestQuestionFromText(text) {
  const value = String(text || '').trim();
  const questionMark = value.lastIndexOf('?');
  if (questionMark < 0) return '';
  const prefix = value.slice(0, questionMark);
  const boundary = Math.max(prefix.lastIndexOf('.'), prefix.lastIndexOf('!'), prefix.lastIndexOf('\n'));
  return `${prefix.slice(boundary + 1).trim()}?`;
}

export function cleanTutorStubClarificationSpeech(text, latestTutorMessage = '') {
  const sentences = String(text || '')
    .trim()
    .split(/(?<=[.!?])\s+/u);
  const pendingPattern = /\b(?:the tutor(?:'s|’s) question|your question|that question)\b.*\bpending\b/iu;
  const hadPendingMeta = sentences.some((sentence) => pendingPattern.test(sentence));
  const kept = sentences
    .filter((sentence) => !pendingPattern.test(sentence))
    .join(' ')
    .trim();
  const latestQuestion = hadPendingMeta ? latestQuestionFromText(latestTutorMessage) : '';
  const restoredQuestion = latestQuestion && !kept.includes(latestQuestion) ? `${kept} ${latestQuestion}`.trim() : kept;
  return cleanTutorStubStageSpeech(restoredQuestion, { voice: 'guide' });
}
