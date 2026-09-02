/**
 * World frame: the nouns a world uses for its own story shape.
 *
 * The tutor-stub prompts and closing-word checks used to carry detective
 * words as fixed text ("Detective-story world", "culprit", "suspect",
 * "investigator"). A maths lesson world received the same words. This module
 * reads an optional `presentation.frame` block from the world YAML and gives
 * every site its nouns from there.
 *
 *   presentation:
 *     frame:
 *       kind: lesson            # inquiry (default) | lesson
 *       heading: Lesson world   # any field below may be overridden
 *       closing_words: [final answer, the answer is]
 *
 * Resolution is default-preserving: a world with no frame block resolves to
 * the inquiry defaults, whose strings are the exact text the sites carried
 * before this module existed. Frozen worlds therefore keep their prompts
 * byte-for-byte.
 */

export const TUTOR_STUB_WORLD_FRAME_INQUIRY = 'inquiry';
export const TUTOR_STUB_WORLD_FRAME_LESSON = 'lesson';
export const TUTOR_STUB_WORLD_FRAME_KINDS = Object.freeze([
  TUTOR_STUB_WORLD_FRAME_INQUIRY,
  TUTOR_STUB_WORLD_FRAME_LESSON,
]);

const FRAME_DEFAULTS = Object.freeze({
  [TUTOR_STUB_WORLD_FRAME_INQUIRY]: Object.freeze({
    kind: TUTOR_STUB_WORLD_FRAME_INQUIRY,
    // System-prompt section heading for the public world block.
    heading: 'Detective-story world',
    // "You are X in <frame_phrase>."
    frame_phrase: 'an established public inquiry',
    // The thing the dialogue works on: "solve the case", "close the case".
    task_noun: 'case',
    // How the tutor addresses the learner inside the scene.
    learner_noun: 'investigator',
    // "Play the <tutor_noun> guiding the learner ..."
    tutor_noun: 'tutor/investigator',
    // "You are an adaptive scene actor as well as <actor_phrase>."
    actor_phrase: 'an investigator',
    // First entry of the part list a turn instruction may cast the tutor as.
    fellow_phrase: 'fellow investigator',
    // "a legitimate <move_adjective> move", "another <move_adjective> branch".
    move_adjective: 'investigative',
    // One released piece of evidence.
    clue_noun: 'clue',
    // The settled conclusion.
    answer_noun: 'verdict',
    // A named candidate for the answer, singular and plural.
    candidate_noun: 'suspect',
    candidate_plural: 'suspects',
    // Words that mark a question or line as asking for, or giving, the final
    // answer. `null` keeps each site's own authored pattern.
    closing_words: null,
  }),
  [TUTOR_STUB_WORLD_FRAME_LESSON]: Object.freeze({
    kind: TUTOR_STUB_WORLD_FRAME_LESSON,
    heading: 'Lesson world',
    frame_phrase: 'an established public lesson',
    task_noun: 'problem',
    learner_noun: 'pupil',
    tutor_noun: 'teacher',
    actor_phrase: 'a teacher',
    fellow_phrase: 'fellow learner',
    move_adjective: 'learning',
    clue_noun: 'step',
    answer_noun: 'answer',
    candidate_noun: 'candidate answer',
    candidate_plural: 'candidate answers',
    closing_words: Object.freeze([
      'final answer',
      'the answer is',
      'the answer',
      'what is the sum',
      'what do they add up to',
      'add up to',
      'equal to',
      'equals',
    ]),
  }),
});

const STRING_FIELDS = Object.freeze([
  'heading',
  'frame_phrase',
  'task_noun',
  'learner_noun',
  'tutor_noun',
  'actor_phrase',
  'fellow_phrase',
  'move_adjective',
  'clue_noun',
  'answer_noun',
  'candidate_noun',
  'candidate_plural',
]);

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function declaredFrame(world) {
  const raw = world?.presentation?.frame ?? world?.frame ?? null;
  if (!raw) return null;
  if (typeof raw === 'string') return { kind: oneLine(raw) };
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw;
}

/**
 * Report authoring defects in a world's `presentation.frame` block. Returns
 * an array of plain-language messages; empty when the block is valid or
 * absent. Used by the world lint; `resolveTutorStubWorldFrame` stays
 * tolerant so a defective block degrades to the inquiry defaults.
 */
export function validateTutorStubWorldFrame(world) {
  const raw = world?.presentation?.frame ?? world?.frame;
  if (raw === undefined || raw === null) return [];
  const issues = [];
  const block = typeof raw === 'string' ? { kind: raw } : raw;
  if (!block || typeof block !== 'object' || Array.isArray(block)) {
    return ['presentation.frame must be an object or a kind string'];
  }
  if (block.kind !== undefined && !TUTOR_STUB_WORLD_FRAME_KINDS.includes(oneLine(block.kind))) {
    issues.push(`presentation.frame.kind must be one of ${TUTOR_STUB_WORLD_FRAME_KINDS.join(', ')}`);
  }
  for (const field of STRING_FIELDS) {
    if (block[field] !== undefined && !oneLine(block[field])) {
      issues.push(`presentation.frame.${field} must be a non-empty string when supplied`);
    }
  }
  if (block.closing_words !== undefined) {
    if (!Array.isArray(block.closing_words) || !block.closing_words.length) {
      issues.push('presentation.frame.closing_words must be a non-empty list when supplied');
    } else if (block.closing_words.some((word) => !oneLine(word))) {
      issues.push('presentation.frame.closing_words entries must be non-empty strings');
    }
  }
  for (const key of Object.keys(block)) {
    if (key !== 'kind' && key !== 'closing_words' && !STRING_FIELDS.includes(key)) {
      issues.push(`presentation.frame.${key} is not a known frame field`);
    }
  }
  return issues;
}

/**
 * Resolve the frame nouns for a world. Missing world, missing block, or an
 * unknown kind all resolve to the inquiry defaults.
 */
export function resolveTutorStubWorldFrame(world = null) {
  const block = declaredFrame(world);
  const kind = TUTOR_STUB_WORLD_FRAME_KINDS.includes(oneLine(block?.kind))
    ? oneLine(block.kind)
    : TUTOR_STUB_WORLD_FRAME_INQUIRY;
  const base = FRAME_DEFAULTS[kind];
  if (!block) return base;
  const resolved = { ...base, kind };
  for (const field of STRING_FIELDS) {
    const value = oneLine(block[field]);
    if (value) resolved[field] = value;
  }
  if (Array.isArray(block.closing_words)) {
    const words = block.closing_words.map(oneLine).filter(Boolean);
    if (words.length) resolved.closing_words = Object.freeze(words);
  }
  return Object.freeze(resolved);
}

export function tutorStubWorldFrameIsLesson(world = null) {
  return resolveTutorStubWorldFrame(world).kind === TUTOR_STUB_WORLD_FRAME_LESSON;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/**
 * Build a closing-word pattern from a list of words or phrases. Each entry
 * is matched as a whole word or phrase, case-insensitively.
 */
export function buildTutorStubClosingPattern(words) {
  const list = (Array.isArray(words) ? words : []).map(oneLine).filter(Boolean);
  if (!list.length) return null;
  return new RegExp(`\\b(?:${list.map(escapeRegExp).join('|')})\\b`, 'iu');
}

/**
 * The closing-word pattern for a world. When the world (or an explicit
 * `closingWords` list) supplies words, they replace `fallback`; otherwise
 * the site's authored default pattern is returned unchanged.
 */
export function tutorStubWorldClosingPattern(world = null, fallback = null, { closingWords = null } = {}) {
  const explicit = buildTutorStubClosingPattern(closingWords);
  if (explicit) return explicit;
  const frame = resolveTutorStubWorldFrame(world);
  return buildTutorStubClosingPattern(frame.closing_words) || fallback;
}

/**
 * The serialisable part of a frame that a public-context projection may
 * carry across a request boundary. Returns null for a plain inquiry world so
 * existing projections stay byte-identical.
 */
export function tutorStubWorldFrameProjection(world = null) {
  const block = declaredFrame(world);
  if (!block) return null;
  const resolved = resolveTutorStubWorldFrame(world);
  return { ...resolved, closing_words: resolved.closing_words ? [...resolved.closing_words] : null };
}
