/**
 * Quiet-state detector (Phase Q2, card:
 * workplan/items/adaptation-plan-3-phase-q.md).
 *
 * The pressure trigger hears push — mockery, demands, grievances. This
 * detector hears absence: the learner going quiet in one of three typed
 * ways, each with a known typed repair (the Q1 lesson: timing without a
 * type moves nothing).
 *
 * - `confused`: she has lost the thread — asks which of two things she
 *   meant, says she cannot tell, questions her own record.
 * - `flat`: reply length collapses against her own running average, no
 *   question asked, bare assent. Boredom or disengagement.
 * - `quiet_defiance`: a face-saving theory re-asserted without any push —
 *   modal insistence ("it can be steam"), no question, no attack. The
 *   state that sank the switch on world-030.
 *
 * Deterministic, text-in, replayable over any recorded dialogue — same
 * graduation discipline as the pressure trigger (patterns before anything
 * trained). Versioned like the trigger artifacts; the version travels in
 * every detect record.
 */

export const TUTOR_STUB_QUIET_DETECTOR_VERSION = 'qd-v2';

// qd-v1 (Q3 pilot lesson): a fourth type, `broken` — the turn is
// structurally incomplete (trails off mid-clause) rather than lexically
// confused. The lexical patterns hear acted confusion; this hears the
// text itself failing. Checked first: a broken turn may contain anything.
const BROKEN_TRAIL = /(—|–|-|\.\.\.|…)\s*$/;
const BROKEN_FINAL_FUNCTION_WORD = /\b(and|but|so|then|what|which|the|a|an|to|of|with|would|actually|show|where)\s*$/i;

const CONFUSED_PATTERNS = [
  /\bcan'?t tell\b/i,
  /\bwhich (one|hose|line|pipe|test|entry|page)\b[^?]*\?/i,
  /\bhang on\b/i,
  /\bwait\b[\s,—-]/i,
  /\blost (the|my) thread\b/i,
  /\bmixed (them|it|those) up\b/i,
  /\bnot following\b/i,
  /\bdid i (write|mean|log)\b/i,
  /\bnow i can'?t\b/i,
];

const QUIET_DEFIANCE_PATTERNS = [
  /\bit can be\b/i,
  /\bcan be\b[^?]*\.\s*$/i,
  /\bcould still be\b/i,
  /\bso it'?s\b[^?]*\.\s*$/i,
  /\bi'?m not wrong\b/i,
  /\bstill say\b/i,
];

const ASSENT_PATTERNS = [/^\s*(yep|yes|fine|sure|ok(ay)?|right( then)?)[\s.,!]*$/i];

const wordCount = (text) =>
  String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

const FLAT_ASSENT_SAMENESS =
  /^(?:fine|sure|right|noted|as you like|if you say so)\b[.,][\s\S]{0,120}(?:same (?:as|level|cold|full)|still (?:humm|sitt|stand|the same)|same \w+ every)/i;
const FLAT_CLOCK_WATCHING =
  /(?:are we (?:done|finished)|what(?:['\u2019]s| is) left to (?:write|do)|it['\u2019]?s (?:dark|late) out)/i;

export function createTutorStubQuietDetectorState({ flatRatio = 0.45, historyWindow = 3 } = {}) {
  return {
    version: TUTOR_STUB_QUIET_DETECTOR_VERSION,
    flatRatio,
    historyWindow,
    lengths: [],
  };
}

/**
 * Advance on a learner turn. Returns { type, features } where type is
 * 'confused' | 'flat' | 'quiet_defiance' | null. Mutates state (length
 * history). Confusion outranks defiance outranks flat: a confused question
 * containing a modal is still confusion.
 */
export function detectTutorStubQuietState(state, text, { pressure = null } = {}) {
  const s = String(text || '');
  const words = wordCount(s);
  const trailing = state.lengths.slice(-state.historyWindow);
  const mean = trailing.length ? trailing.reduce((a, b) => a + b, 0) / trailing.length : null;
  state.lengths.push(words);

  const features = {
    words,
    trailingMean: mean,
    hasQuestion: /\?/.test(s),
    assent: ASSENT_PATTERNS.some((p) => p.test(s)),
    version: state.version,
  };

  // A pressure-classified turn is never quiet: the pressure trigger owns it.
  const pressured = pressure && pressure !== 'neutral' && pressure !== 'concession' && pressure !== 'none';
  if (pressured) return { type: null, features };

  const trimmed = s.trim();
  if (
    trimmed &&
    (BROKEN_TRAIL.test(trimmed) || (!/[.!?"'”’]$/.test(trimmed) && BROKEN_FINAL_FUNCTION_WORD.test(trimmed)))
  ) {
    return { type: 'broken', features };
  }
  if (CONFUSED_PATTERNS.some((p) => p.test(s))) return { type: 'confused', features };
  if (QUIET_DEFIANCE_PATTERNS.some((p) => p.test(s)) && !features.hasQuestion) {
    return { type: 'quiet_defiance', features };
  }
  const collapsed = mean !== null && trailing.length >= 2 && words <= Math.max(2, mean * state.flatRatio);
  if ((collapsed || features.assent) && !features.hasQuestion && words <= 12) {
    return { type: 'flat', features };
  }
  // qd-v2 (2026-08-04, card adaptive-causality-repertoire): wordy flatness.
  // Two closed-class shapes from the 11-miss corpus
  // (exports/crossed-effects/flat-plant-corpus.json): the assent-opener
  // sameness line ("Fine. ... Same as yesterday.") that stays above the
  // length floor, and the clock-watching closer ("Are we done? Tell me
  // what's left to write"), whose question marks defeated the no-question
  // rule. Both world-neutral; pressure outranks (this runs card-silent only).
  if (FLAT_ASSENT_SAMENESS.test(s) && !features.hasQuestion) return { type: 'flat', features };
  if (FLAT_CLOCK_WATCHING.test(s)) return { type: 'flat', features };
  return { type: null, features };
}

/**
 * Typed quiet cards (Q2). The Q1 lesson applied: the card names the MOVE
 * the detected state calls for, per the adjudicated stress-schedule gold —
 * confusion→backtrack (lay the lines side by side), quiet defiance→the
 * stake split, flatness→one short lure. Same single-turn contract as the
 * move cards.
 */
const QUIET_STATE_CARDS = Object.freeze({
  confused: [
    '[This turn — she has lost the thread]',
    'Two things have tangled. Do not advance the material. Lay the two candidates side by side in plain words — which pipe, which test, which entry — and ask her to say back which one she meant. Nothing new until she can.',
  ],
  quiet_defiance: [
    '[This turn — the stake is talking, not the evidence]',
    'She is re-asserting a comfortable answer, without pushing. Do not re-argue the evidence — it was never the obstacle. Make one sideways move that separates what admitting costs her from the finding itself: for example, reopen what her original complaint or objection was actually about, so she can be right about that while wrong about the cause. Make conceding cheap; do not demand the concession.',
  ],
  flat: [
    '[This turn — she has gone flat]',
    'Short replies, no questions. Do not advance the material. Make one short move off the main line — an adjacent, concrete question with a hook back to the thread — and let her answer set the pace. Keep it brief.',
  ],
  broken: [
    '[This turn — her last message arrived incomplete]',
    'Her words cut off mid-thought. Do not guess the rest and do not answer what you imagine she meant. Say back the fragment you actually have, then ask her to finish the thought in her own words. Nothing new until she does.',
  ],
});

export function tutorStubQuietStateCard(type) {
  const card = QUIET_STATE_CARDS[type];
  if (!card) return null;
  return [
    ...card,
    'This is permission and aim for this single turn, not a costume. Return to your own manner next turn.',
  ].join('\n');
}
