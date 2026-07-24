export const TUTOR_STUB_CLI_DIRECTOR_SCHEMA = 'machinespirits.tutor-stub.cli-director.v1';
export const TUTOR_STUB_CLI_DIRECTOR_MAX_QUESTION_LENGTH = 1_200;
export const TUTOR_STUB_CLI_DIRECTOR_MAX_REPLY_LENGTH = 3_000;

export const TUTOR_STUB_CLI_DIRECTOR_SYSTEM_PROMPT = [
  'You are the private CLI director for the Machine Spirits tutor-stub application.',
  'Answer the operator’s question about using the application, its current session, its slash commands, modes, settings, tutor characters, or learner profiles.',
  'Treat the supplied application context as authoritative. Give exact available commands and say when a requested capability is unavailable in the current session.',
  'Do not answer the inquiry’s subject-matter question, continue the dramatic scene, impersonate the speaking tutor, or infer concealed evidence, hidden proof state, future clues, or a concealed answer.',
  'A CLI-help answer is private operator assistance. It changes no setting unless the operator later runs the command you recommend.',
  'Be concise and practical. Prefer a short explanation followed by copyable commands when commands are useful.',
].join('\n');

function normalizedText(value) {
  const withoutControlCharacters = Array.from(String(value || ''), (character) => {
    const codePoint = character.codePointAt(0);
    return codePoint <= 8 ||
      codePoint === 11 ||
      codePoint === 12 ||
      (codePoint >= 14 && codePoint <= 31) ||
      codePoint === 127
      ? ' '
      : character;
  }).join('');
  return withoutControlCharacters.replace(/\s+/gu, ' ').trim();
}

export function normalizeTutorStubCliDirectorQuestion(value) {
  const question = normalizedText(value);
  if (!question) throw new Error('a CLI question is required after ask');
  if (question.length > TUTOR_STUB_CLI_DIRECTOR_MAX_QUESTION_LENGTH) {
    throw new Error(`CLI questions are limited to ${TUTOR_STUB_CLI_DIRECTOR_MAX_QUESTION_LENGTH} characters`);
  }
  return question;
}

export function buildTutorStubCliDirectorPrompt({ question, context = {} } = {}) {
  const normalizedQuestion = normalizeTutorStubCliDirectorQuestion(question);
  return [
    '# CLI director question',
    '',
    normalizedQuestion,
    '',
    '# Authoritative application context',
    '',
    JSON.stringify({
      schema: TUTOR_STUB_CLI_DIRECTOR_SCHEMA,
      ...structuredClone(context || {}),
    }),
    '',
    '# Response contract',
    '',
    '- Answer only the CLI/application question.',
    '- Use command names, profile ids, and character ids exactly as supplied.',
    '- Distinguish commands that merely explain a setup from commands that actually change it.',
    '- Do not claim that this answer itself changed the active session.',
    '- End once the operator has a clear route back to the current tutor interaction.',
  ].join('\n');
}

export function cleanTutorStubCliDirectorReply(value) {
  const text = String(value || '')
    .replace(/^```(?:text|markdown)?\s*/iu, '')
    .replace(/\s*```$/u, '')
    .replace(/^\s*(?:cli\s+)?director\s*>?\s*:?\s*/iu, '')
    .trim();
  return text.slice(0, TUTOR_STUB_CLI_DIRECTOR_MAX_REPLY_LENGTH).trim();
}
