export function delimitTutorStubPrompt(start, content, end) {
  return [start, content, end].filter(Boolean).join('\n');
}

export function replaceDelimitedTutorStubPrompt(text, start, content, end) {
  const from = text.indexOf(start);
  const to = text.indexOf(end, from + start.length);
  if (from < 0 || to < 0) return `${text}\n\n${delimitTutorStubPrompt(start, content, end)}`;
  return `${text.slice(0, from)}${delimitTutorStubPrompt(start, content, end)}${text.slice(to + end.length)}`;
}

export const TUTOR_STUB_CONDITIONAL_QUESTION_GOAL =
  'Goal: Help the learner make one small conceptual move. Prefer concrete examples and, when the compiled turn contract permits, one focused question over explanation dumps.';
export const TUTOR_STUB_CONDITIONAL_QUESTION_RULE =
  '- Ask at most one main question when the compiled turn contract permits one; ask none when its handoff forbids questions.';
export const TUTOR_STUB_CONDITIONAL_HANDOFF_RULE =
  "- When the compiled handoff permits a question, end with one light prompt for the learner's natural next thought; otherwise end declaratively. Do not require a full proof step unless their leap is unsafe or case-closing.";

const LEGACY_TUTOR_STUB_STANDING_RULES = Object.freeze([
  [
    'Goal: Help the learner make one small conceptual move. Prefer questions and concrete examples over explanation dumps.',
    TUTOR_STUB_CONDITIONAL_QUESTION_GOAL,
  ],
  ['- Ask at most one main question per turn.', TUTOR_STUB_CONDITIONAL_QUESTION_RULE],
  [
    "- End with one light prompt for the learner's natural next thought; do not require a full proof step unless their leap is unsafe or case-closing.",
    TUTOR_STUB_CONDITIONAL_HANDOFF_RULE,
  ],
]);

/**
 * Frozen first-draft fixtures preserve their public dialogue and world prompt,
 * but standing tutor policy must follow the current compiled handoff contract.
 * Migrate only exact legacy lines so every other frozen byte remains stable.
 */
export function refreshTutorStubStandingQuestionRules(systemPrompt) {
  return LEGACY_TUTOR_STUB_STANDING_RULES.reduce(
    (prompt, [legacy, current]) => prompt.replace(legacy, current),
    String(systemPrompt || ''),
  );
}

export function createTutorStubPromptBlockModel({ worldLedgerTerm, worldFlavourPhrase } = {}) {
  const ledgerTerm = typeof worldLedgerTerm === 'function' ? worldLedgerTerm : () => 'record';
  const flavourPhrase = typeof worldFlavourPhrase === 'function' ? worldFlavourPhrase : () => 'the public scene';

  function responseChoiceModeRules({ multipleChoice, world = null }) {
    return multipleChoice
      ? [
          "- Multiple-choice mode is on. When it would help, you may present 2-4 short lettered choices for the learner's next move.",
          '- Multiple-choice options must be public evidence-shaped moves, not answers. Do not include the concealed answer, unstaged evidence, predicate/function notation, premise ids, rule ids, or route labels.',
          `- In story mode, each option should be a plain ${ledgerTerm(world)} line shape drawn from the staged evidence. Keep ${flavourPhrase(world)} but avoid long menus.`,
          '- End by asking the learner to choose one option or write their own evidence claim.',
        ]
      : [
          '- Do not default to multiple choice. A tutor-only question-support instruction may still authorize one bounded choice when uncertainty shows that an open prompt is not answerable enough.',
          '- If no question-support override applies and the learner seems unsure, put a directional hint into the discourse before asking; never ask them to invent a record, source, name, or fact that has not entered the public scene.',
          '- When talking through options, collapse them to one live issue: what changed, what remains unsafe, or what the learner now thinks follows.',
          TUTOR_STUB_CONDITIONAL_HANDOFF_RULE,
        ];
  }

  return Object.freeze({ responseChoiceModeRules });
}
