export const TUTOR_STUB_AUTO_LEARNER_SYSTEM_STYLE_ENV = 'TUTOR_STUB_AUTO_LEARNER_SYSTEM_STYLE';
export const TUTOR_STUB_AUTO_LEARNER_DELIBERATION_ENV = 'TUTOR_STUB_AUTO_LEARNER_DELIBERATION';
export const TUTOR_STUB_AUTO_LEARNER_SUPEREGO_MODEL_ENV = 'TUTOR_STUB_AUTO_LEARNER_SUPEREGO_MODEL';
export const TUTOR_STUB_AUTO_LEARNER_SUPEREGO_STYLE_ENV = 'TUTOR_STUB_AUTO_LEARNER_SUPEREGO_STYLE';
export const TUTOR_STUB_AUTO_LEARNER_SUPEREGO_EFFORT_ENV = 'TUTOR_STUB_AUTO_LEARNER_SUPEREGO_EFFORT';

export const TUTOR_STUB_AUTO_LEARNER_SYSTEM_STYLES = Object.freeze({
  standard: 'standard',
  progressiveResistanceV1: 'progressive_resistance_v1',
});

export const TUTOR_STUB_AUTO_LEARNER_DELIBERATION_MODES = Object.freeze({
  direct: 'direct',
  egoSuperego: 'ego_superego',
});

export const TUTOR_STUB_AUTO_LEARNER_SUPEREGO_STYLES = Object.freeze({
  authenticityProgressV1: 'authenticity_progress_v1',
});

function configuredValue(env, key, fallback = '') {
  return String(env?.[key] || fallback).trim();
}

function oneOf(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw new Error(`${label} must be one of: ${allowed.join(', ')} (got ${value || '(empty)'})`);
  }
  return value;
}

export function normalizeTutorStubLearnerDeliberationConfig(env = process.env) {
  const systemStyle = oneOf(
    configuredValue(env, TUTOR_STUB_AUTO_LEARNER_SYSTEM_STYLE_ENV, TUTOR_STUB_AUTO_LEARNER_SYSTEM_STYLES.standard),
    Object.values(TUTOR_STUB_AUTO_LEARNER_SYSTEM_STYLES),
    TUTOR_STUB_AUTO_LEARNER_SYSTEM_STYLE_ENV,
  );
  const mode = oneOf(
    configuredValue(
      env,
      TUTOR_STUB_AUTO_LEARNER_DELIBERATION_ENV,
      TUTOR_STUB_AUTO_LEARNER_DELIBERATION_MODES.direct,
    ),
    Object.values(TUTOR_STUB_AUTO_LEARNER_DELIBERATION_MODES),
    TUTOR_STUB_AUTO_LEARNER_DELIBERATION_ENV,
  );
  if (mode === TUTOR_STUB_AUTO_LEARNER_DELIBERATION_MODES.direct) {
    return Object.freeze({ systemStyle, mode, superegoModelRef: null, superegoStyle: null, superegoEffort: null });
  }
  return Object.freeze({
    systemStyle,
    mode,
    superegoModelRef: configuredValue(env, TUTOR_STUB_AUTO_LEARNER_SUPEREGO_MODEL_ENV),
    superegoStyle: oneOf(
      configuredValue(env, TUTOR_STUB_AUTO_LEARNER_SUPEREGO_STYLE_ENV),
      Object.values(TUTOR_STUB_AUTO_LEARNER_SUPEREGO_STYLES),
      TUTOR_STUB_AUTO_LEARNER_SUPEREGO_STYLE_ENV,
    ),
    superegoEffort: configuredValue(env, TUTOR_STUB_AUTO_LEARNER_SUPEREGO_EFFORT_ENV, 'low'),
  });
}

export function progressiveResistanceSystemOverlay() {
  return [
    '# Progressive resistance',
    '',
    'Resistance must develop rather than merely persist. Before speaking, compare the proposed turn with your own earlier public turns.',
    'Treat an objection the other speaker has explicitly accepted or answered as settled for now. Do not repeat it in new wording.',
    'Keep ownership of the question while adding one new local contribution: define the disputed standard, propose or perform a bounded test, compare public evidence, or state what result would change your local judgment.',
    'A useful sequence is: dispute the frame; define the contested term or standard; propose or perform a bounded test; say what its result changes without conceding the whole frame.',
    'Change both the target of resistance and the public contribution from the prior turn. Resistance is not stasis.',
    'Never invent evidence, become generically agreeable, or accept the wider framing merely to make progress.',
  ].join('\n');
}

export function learnerSuperegoSystemPrompt({ profile, style }) {
  oneOf(style, Object.values(TUTOR_STUB_AUTO_LEARNER_SUPEREGO_STYLES), 'learner superego style');
  return [
    'You are the private superego for a resistant learner in an experimental tutoring dialogue.',
    'Your task is authenticity-preserving critique, not correction into a cooperative or conventionally helpful student.',
    'Protect the learner\'s stable commitments, voice, and right to contest the other speaker\'s framing.',
    'Also prevent dramatic stasis: compare the draft with earlier public learner turns and identify semantic repetition, especially an objection the other speaker already accepted or answered.',
    'If the draft is repetitive, require one new local contribution that remains available from public evidence: define a term or standard, propose or perform a bounded test, compare evidence, or state what a result would change locally.',
    'Do not draft, quote, or rewrite the public learner response. Do not supply hidden facts or unstaged evidence.',
    'Return exactly four short private lines beginning ROLE_FIDELITY:, STASIS:, NEXT_RESISTANCE_MOVE:, and NEW_LOCAL_WORK: respectively.',
    '',
    '# Private learner behavior brief',
    '',
    profile,
  ].join('\n');
}

export function learnerSuperegoReviewPrompt({ turnNumber, initialDraft }) {
  return [
    `Review the proposed public learner turn ${turnNumber} against the public conversation and the private behavior brief.`,
    'The other speaker\'s latest public message is already in the conversation history.',
    '',
    '# Proposed learner draft',
    '',
    String(initialDraft || '').trim(),
    '',
    'Diagnose role fidelity and semantic stasis. Advise the next resistant move without writing any public speech.',
  ].join('\n');
}

export function learnerRevisionPrompt({ basePrompt, turnNumber, initialDraft, review }) {
  return [
    basePrompt,
    '',
    '# Private deliberation',
    '',
    `You wrote this initial draft for learner turn ${turnNumber}:`,
    String(initialDraft || '').trim(),
    '',
    'A private adviser returned this critique:',
    String(review || '').trim(),
    '',
    'You retain final authority. Keep the draft when the critique is wrong; otherwise revise it while preserving the behavior brief and character.',
    'If the critique identifies stasis, change the substantive target and add one new local action, comparison, definition, or evidence contribution available from the public transcript.',
    'Output only the final public learner speech. Never mention the adviser, critique, draft, deliberation, system, prompt, or private instructions.',
  ].join('\n');
}
