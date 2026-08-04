export function createTutorStubClarificationTranslationRuntime({
  CLARIFIER_SYSTEM_PROMPT,
  TUTOR_STUB_CURRICULUM_TRANSLATOR_SYSTEM_PROMPT,
  TUTOR_STUB_TUTOR_OUTPUT_TRANSLATOR_SYSTEM_PROMPT,
  buildTutorStubCurriculumTranslationPrompt,
  buildTutorStubTutorOutputTranslationPrompt,
  callPromptModel,
  cleanTutorStubClarificationSpeech,
  compactPublicTranscriptForPrompt,
  latestTutorMessage,
  parseTutorStubCurriculumTranslation,
  parseTutorStubTutorOutputTranslation,
  publicWorldSummary,
  tutorStubComprehensionPrompt,
}) {
  function buildTutorClarificationPrompt({ state, term = '' }) {
    const latestTutor = latestTutorMessage(state);
    const requestedTerm = String(term || '').trim();
    const comprehensionContext = tutorStubComprehensionPrompt(state.comprehension, {
      turn: state.turns.length,
    });
    return [
      '# Public scene',
      '',
      publicWorldSummary(state.world),
      '',
      '# Public transcript',
      '',
      compactPublicTranscriptForPrompt(state, state.historyTurns, { includeAnalysis: false }),
      '',
      '# Latest line to clarify',
      '',
      latestTutor || '(No tutor message is available yet.)',
      '',
      '# Learner clarification request',
      '',
      requestedTerm
        ? `Explain this term or phrase from the line above: "${requestedTerm}".`
        : 'No term was supplied. Pick up to three likely confusing words or phrases from the latest tutor message and explain them.',
      comprehensionContext || null,
      '',
      '# Output rules',
      '',
      '- Use only public wording already in the transcript.',
      '- Do not add new evidence, new suspects, hidden conclusions, or next proof steps.',
      '- Prefer one short paragraph, or at most three bullets.',
      '- If the requested term is not in the latest tutor message or public transcript, say so briefly and ask which phrase the learner means.',
      '- If the latest line ended with a question, explain the wording and then restate that live question directly. Never say that a tutor question is "pending".',
    ]
      .filter((line) => line !== null)
      .join('\n');
  }

  function cleanClarificationReply(text, latestTutor = '') {
    const cleaned = String(text || '')
      .replace(/^```(?:text|markdown)?/iu, '')
      .replace(/```$/u, '')
      .replace(/^\s*(clarify|clarification|explain|explanation)\s*:\s*/iu, '')
      .trim();
    return cleanTutorStubClarificationSpeech(cleaned, latestTutor);
  }

  async function generateTutorClarification({ state, term = '', resolved, cliEffort = null, signal = null }) {
    const raw = await callPromptModel({
      prompt: buildTutorClarificationPrompt({ state, term }),
      resolved,
      systemPrompt: CLARIFIER_SYSTEM_PROMPT,
      role: 'tutor_stub_clarifier',
      maxTokens: 500,
      trace: state.trace,
      stream: { enabled: false },
      cliEffort,
      turn: state.turns.length,
      signal,
    });
    return {
      ...raw,
      text: cleanClarificationReply(raw.text, latestTutorMessage(state)),
    };
  }

  async function generateTutorStubCurriculumTranslation({ state, levels, signal = null }) {
    const request = buildTutorStubCurriculumTranslationPrompt({
      module: state.curriculum?.module,
      levels,
    });
    const requestedMaxTokens = levels.length === 1 ? 1_600 : 3_800;
    const raw = await callPromptModel({
      prompt: request.prompt,
      resolved: state.resolved,
      systemPrompt: TUTOR_STUB_CURRICULUM_TRANSLATOR_SYSTEM_PROMPT,
      role: 'tutor_stub_curriculum_translator',
      maxTokens: Math.min(Number(state.maxTokens) || requestedMaxTokens, requestedMaxTokens),
      trace: state.trace,
      stream: { enabled: false },
      cliEffort: state.cliEffort,
      turn: state.turns.length,
      signal,
    });
    return {
      ...raw,
      translation: parseTutorStubCurriculumTranslation(raw.text, {
        module: state.curriculum.module,
        levels,
      }),
    };
  }

  async function generateTutorStubTutorOutputTranslation({ state, sourceText, levels, signal = null }) {
    const request = buildTutorStubTutorOutputTranslationPrompt({ text: sourceText, levels });
    const requestedMaxTokens = levels.length === 1 ? 900 : 2_400;
    const raw = await callPromptModel({
      prompt: request.prompt,
      resolved: state.resolved,
      systemPrompt: TUTOR_STUB_TUTOR_OUTPUT_TRANSLATOR_SYSTEM_PROMPT,
      role: 'tutor_stub_turn_translator',
      maxTokens: Math.min(Number(state.maxTokens) || requestedMaxTokens, requestedMaxTokens),
      trace: state.trace,
      stream: { enabled: false },
      cliEffort: state.cliEffort,
      turn: state.turns.length,
      signal,
    });
    return {
      ...raw,
      translation: parseTutorStubTutorOutputTranslation(raw.text, {
        sourceText: request.sourceText,
        levels,
      }),
    };
  }

  return {
    generateTutorClarification,
    generateTutorStubCurriculumTranslation,
    generateTutorStubTutorOutputTranslation,
  };
}
