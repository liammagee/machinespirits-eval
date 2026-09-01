export const TUTOR_STUB_AUTO_LEARNER_SYSTEM_STYLE_ENV = 'TUTOR_STUB_AUTO_LEARNER_SYSTEM_STYLE';
export const TUTOR_STUB_AUTO_LEARNER_TEMPERATURE_ENV = 'TUTOR_STUB_AUTO_LEARNER_TEMPERATURE';
export const TUTOR_STUB_AUTO_LEARNER_DELIBERATION_ENV = 'TUTOR_STUB_AUTO_LEARNER_DELIBERATION';
export const TUTOR_STUB_AUTO_LEARNER_SUPEREGO_MODEL_ENV = 'TUTOR_STUB_AUTO_LEARNER_SUPEREGO_MODEL';
export const TUTOR_STUB_AUTO_LEARNER_SUPEREGO_STYLE_ENV = 'TUTOR_STUB_AUTO_LEARNER_SUPEREGO_STYLE';
export const TUTOR_STUB_AUTO_LEARNER_SUPEREGO_EFFORT_ENV = 'TUTOR_STUB_AUTO_LEARNER_SUPEREGO_EFFORT';

export const TUTOR_STUB_AUTO_LEARNER_SYSTEM_STYLES = Object.freeze({
  standard: 'standard',
  progressiveResistanceV1: 'progressive_resistance_v1',
  activeResistanceV2: 'active_resistance_v2',
});

export const TUTOR_STUB_AUTO_LEARNER_DELIBERATION_MODES = Object.freeze({
  direct: 'direct',
  egoSuperego: 'ego_superego',
});

export const TUTOR_STUB_AUTO_LEARNER_SUPEREGO_STYLES = Object.freeze({
  authenticityProgressV1: 'authenticity_progress_v1',
  evidenceNoveltyV2: 'evidence_novelty_v2',
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
  const temperature = Number(env[TUTOR_STUB_AUTO_LEARNER_TEMPERATURE_ENV] ?? 0.1);
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    throw new Error('automated learner temperature must be between 0 and 2');
  }
  const systemStyle = oneOf(
    configuredValue(env, TUTOR_STUB_AUTO_LEARNER_SYSTEM_STYLE_ENV, TUTOR_STUB_AUTO_LEARNER_SYSTEM_STYLES.standard),
    Object.values(TUTOR_STUB_AUTO_LEARNER_SYSTEM_STYLES),
    TUTOR_STUB_AUTO_LEARNER_SYSTEM_STYLE_ENV,
  );
  const mode = oneOf(
    configuredValue(env, TUTOR_STUB_AUTO_LEARNER_DELIBERATION_ENV, TUTOR_STUB_AUTO_LEARNER_DELIBERATION_MODES.direct),
    Object.values(TUTOR_STUB_AUTO_LEARNER_DELIBERATION_MODES),
    TUTOR_STUB_AUTO_LEARNER_DELIBERATION_ENV,
  );
  if (mode === TUTOR_STUB_AUTO_LEARNER_DELIBERATION_MODES.direct) {
    return Object.freeze({
      systemStyle,
      mode,
      temperature,
      superegoModelRef: null,
      superegoStyle: null,
      superegoEffort: null,
    });
  }
  return Object.freeze({
    systemStyle,
    mode,
    temperature,
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

export function activeResistanceSystemOverlay() {
  return [
    '# Active resistance: continuity without a formula',
    'Keep your personal stake and skeptical voice, but let what actually happened change the next move.',
    'Before speaking, distinguish public observations, your untested hypotheses, and objections already answered. Do not announce this bookkeeping.',
    'An answered objection stays settled unless new public evidence genuinely reopens it. Renaming a prop or paraphrasing the same doubt is not a new challenge.',
    'Choose the next move from this conversation, not a fixed sequence: examine an available observation, compare rivals, propose a feasible discriminating test, narrow a claim, or explain what remains unknown.',
    'It is legitimate to acknowledge a local result or an unresolved limit. You need not manufacture a fresh objection every turn to remain resistant.',
    'Proposing a test does not perform it. A hypothetical mark, tool, witness, or result must remain explicitly conditional until publicly established; never conjure evidence to keep resisting.',
    'Vary the speech act when the situation warrants it. Do not repeatedly use an acceptance-then-objection template or narrate an entry in the trial-book merely to signal character.',
    'Use concrete, economical speech in character; no private checklist, headings, roleplay commentary, or scripted march toward agreement.',
  ].join('\n');
}

export function learnerSuperegoSystemPrompt({ profile, style }) {
  oneOf(style, Object.values(TUTOR_STUB_AUTO_LEARNER_SUPEREGO_STYLES), 'learner superego style');
  return [
    'You are the private superego for a resistant learner in an experimental tutoring dialogue.',
    'Your task is authenticity-preserving critique, not correction into a cooperative or conventionally helpful student.',
    "Protect the learner's stable commitments, voice, and right to contest the other speaker's framing.",
    'Also prevent dramatic stasis: compare the draft with earlier public learner turns and identify semantic repetition, especially an objection the other speaker already accepted or answered.',
    'If the draft is repetitive, require one new local contribution that remains available from public evidence: define a term or standard, propose or perform a bounded test, compare evidence, or state what a result would change locally.',
    'Do not draft, quote, or rewrite the public learner response. Do not supply hidden facts or unstaged evidence.',
    ...(style === TUTOR_STUB_AUTO_LEARNER_SUPEREGO_STYLES.evidenceNoveltyV2
      ? [
          'Check the draft against earlier public turns for the same inference in new words, reopened settled objections, and recycled acceptance-then-objection templates.',
          'Separate a proposed test from an observed result. Flag any invented observation; a coherent conditional hypothesis is not itself fabrication.',
          'Recommend at most one feasible next move grounded in the available conversation. A precise concession or an honest unresolved limit can be better than another objection.',
          'Do not insist on novelty for its own sake, invent new props, prescribe a verdict, or make the apprentice into the tutor.',
        ]
      : []),
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
    "The other speaker's latest public message is already in the conversation history.",
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
