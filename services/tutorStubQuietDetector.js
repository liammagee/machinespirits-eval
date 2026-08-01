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

export const TUTOR_STUB_QUIET_DETECTOR_VERSION = 'qd-v0';

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

  if (CONFUSED_PATTERNS.some((p) => p.test(s))) return { type: 'confused', features };
  if (QUIET_DEFIANCE_PATTERNS.some((p) => p.test(s)) && !features.hasQuestion) {
    return { type: 'quiet_defiance', features };
  }
  const collapsed = mean !== null && trailing.length >= 2 && words <= Math.max(2, mean * state.flatRatio);
  if ((collapsed || features.assent) && !features.hasQuestion && words <= 12) {
    return { type: 'flat', features };
  }
  return { type: null, features };
}
