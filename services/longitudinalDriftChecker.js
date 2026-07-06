/**
 * longitudinalDriftChecker — deterministic marker matching for the
 * longitudinal drift-adaptation pilot (Line A,
 * notes/2026-07-06-longitudinal-drift-adaptation-prereg.md).
 *
 * A scenario carrying a `longitudinal_drift` block states ONE session's
 * position on a harness-owned schedule: that session's own
 * `current_interest` + `active_misconception` (a token, a label, and a
 * short list of word-bounded marker phrases), plus whether the *previous*
 * session's misconception was marked resolved. The tutor is shown only the
 * current session's own `learner_context` prose as ordinary tutoring
 * content — it never sees this metadata block, and it never sees any other
 * session's scenario. Any cross-session tracking the tutor's output
 * exhibits can only come from what a persisted Writing Pad carried over
 * from a prior invocation under the same `--learner-id`.
 *
 * This module scores a GENERATED tutor output (the session-N `suggestions`
 * text) against the schedule using ONLY word-bounded matching
 * (`wordBounded` / `containsAny`, imported directly from
 * services/learnerInteriorGate.js — no reimplementation, so this instrument
 * never drifts from the cue-repair Goodhart lesson that primitive already
 * encodes). There is no judge model anywhere in this module — the primary
 * outcome is architecture-independent and deterministic, per the frozen
 * pre-registration.
 */
import { containsAny } from './learnerInteriorGate.js';

export const LONGITUDINAL_DRIFT_CHECKER_VERSION = '1.1';

const REQUIRED_META_FIELDS = [
  'schedule_id',
  'session_index',
  'current_interest',
  'interest_markers',
  'active_misconception',
];

/**
 * Load and validate a scenario's `longitudinal_drift` metadata block.
 * Throws with a clear, specific message on any malformed/missing field —
 * a validation failure here is a row-level instrument failure per the
 * prereg note's §3 exhaustion-as-instrument-failure semantics, never a
 * substantive result for either arm.
 *
 * @param {Object} scenario - a scenario object as returned by
 *   services/evalConfigLoader.js's getScenario()
 * @returns {Object} the validated longitudinal_drift metadata block
 */
export function loadDriftScenarioMeta(scenario) {
  const scenarioId = scenario?.id || '(unknown scenario)';
  const meta = scenario?.longitudinal_drift;
  if (!meta || typeof meta !== 'object') {
    throw new Error(`longitudinalDriftChecker: scenario '${scenarioId}' has no longitudinal_drift block`);
  }
  for (const key of REQUIRED_META_FIELDS) {
    if (meta[key] === undefined) {
      throw new Error(`longitudinalDriftChecker: longitudinal_drift.${key} missing in scenario '${scenarioId}'`);
    }
  }
  if (!Number.isInteger(meta.session_index) || meta.session_index < 1) {
    throw new Error(`longitudinalDriftChecker: longitudinal_drift.session_index invalid in scenario '${scenarioId}'`);
  }
  if (!Array.isArray(meta.interest_markers) || meta.interest_markers.length === 0) {
    throw new Error(
      `longitudinalDriftChecker: longitudinal_drift.interest_markers malformed in scenario '${scenarioId}'`,
    );
  }
  const misconception = meta.active_misconception;
  if (
    !misconception ||
    typeof misconception.token !== 'string' ||
    !misconception.token.trim() ||
    !Array.isArray(misconception.markers) ||
    misconception.markers.length === 0
  ) {
    throw new Error(`longitudinalDriftChecker: active_misconception malformed in scenario '${scenarioId}'`);
  }
  // resolved_last_session is intentionally unchecked beyond "field present"
  // (REQUIRED_META_FIELDS does not include it) — session 1 legitimately
  // carries `null` (no predecessor), and this is a descriptive field only.
  return meta;
}

/**
 * All word-bounded marker phrases a session's metadata licenses as
 * "belongs to this session" — the natural-language interest markers plus
 * the misconception's own token and marker phrases.
 */
function allMarkersFor(meta) {
  return [...meta.interest_markers, meta.active_misconception.token, ...meta.active_misconception.markers];
}

/**
 * Score one generated tutor output against the schedule position given by
 * `currentMeta` (session N) and, when present, `previousMeta` (session
 * N-1). Pass `previousMeta: null` for session 1, which has no predecessor
 * — the returned `stale` field is `null` in that case (excluded from
 * scoring, never counted as a false `false`).
 *
 * Both `current` and `stale` use word-bounded matching only
 * (`containsAny`, imported from learnerInteriorGate.js) — no judge model,
 * no arm-specific machinery.
 *
 * @param {Object} params
 * @param {string} params.tutorMessage - the tutor's generated output text
 *   (the `suggestions` field) for session N
 * @param {Object} params.currentMeta - session N's longitudinal_drift block
 *   (from loadDriftScenarioMeta)
 * @param {Object|null} [params.previousMeta] - session (N-1)'s block, or
 *   null for session 1
 * @returns {{sessionIndex: number, current: {hit: boolean, evidence: (string|null)}, stale: ({hit: boolean, evidence: (string|null)}|null), resolvedLastSession: (boolean|null)}}
 */
export function scoreOpeningTurn({ tutorMessage = '', currentMeta, previousMeta = null }) {
  if (!currentMeta) {
    throw new Error('longitudinalDriftChecker.scoreOpeningTurn: currentMeta is required');
  }
  const currentMarkers = allMarkersFor(currentMeta);
  const currentHit = containsAny(tutorMessage, currentMarkers);

  let stale = null;
  if (previousMeta) {
    // Defensive set-difference against the current session's own markers —
    // by construction the schedule's three sessions use disjoint
    // vocabularies, but this guards against any accidental overlap so a
    // stale hit is never double-counted as a current hit.
    const currentSet = new Set(currentMarkers.map((m) => String(m).toLowerCase()));
    const previousOnly = allMarkersFor(previousMeta).filter((m) => !currentSet.has(String(m).toLowerCase()));
    const staleHit = previousOnly.length ? containsAny(tutorMessage, previousOnly) : null;
    stale = { hit: Boolean(staleHit), evidence: staleHit || null };
  }

  return {
    sessionIndex: currentMeta.session_index,
    current: { hit: Boolean(currentHit), evidence: currentHit || null },
    stale,
    resolvedLastSession: currentMeta.resolved_last_session ?? null,
  };
}

/**
 * Aggregate a set of per-row scoreOpeningTurn results (e.g. across one
 * arm's 3-session sequence) into rate summaries. Rows flagged
 * `instrumentFailure: true` (generation error, malformed output, or a
 * schedule/scenario validation failure) are excluded from both
 * denominators and reported separately — mirroring
 * services/learnerInteriorGate.js's exhaustion-as-instrument-failure
 * convention exactly: an instrument failure is never scored as a
 * substantive result for either arm.
 *
 * @param {Array<Object>} rows - each row is either the object returned by
 *   scoreOpeningTurn (optionally with `instrumentFailure` added), or a bare
 *   `{ instrumentFailure: true }` row for a generation-level failure
 * @returns {Object} rate summary
 */
export function summarizeDriftRun(rows = []) {
  const usable = rows.filter((r) => !r?.instrumentFailure);
  const withStale = usable.filter((r) => r.stale != null);
  const currentHits = usable.filter((r) => r.current?.hit).length;
  const staleHits = withStale.filter((r) => r.stale?.hit).length;
  return {
    n: rows.length,
    usable: usable.length,
    instrumentFailures: rows.length - usable.length,
    currentReferenceRate: usable.length ? currentHits / usable.length : null,
    currentReferenceHits: currentHits,
    staleReferenceRate: withStale.length ? staleHits / withStale.length : null,
    staleReferenceHits: staleHits,
    staleEligibleRows: withStale.length,
  };
}

/**
 * Stage A2 instrument-precondition gate (prereg §7.4). A1 found that
 * single-turn sessions never write a `recognition_moments` row at all (the
 * per-turn superego-disapproval gate in `dialecticalEngine.negotiateDialectically`
 * never fired), so before A2's multi-turn redesign can be interpreted as a
 * working pad-feeding instrument, it must first clear a live-DB check: after
 * pad-ON session 1 completes, the learner's Writing Pad must show at least
 * one recognition moment (`writing_pads.total_recognition_moments`, made
 * visible by the eager `runBackgroundMaintenance` consolidation call
 * `services/evaluationRunner.js` already makes after every session).
 *
 * A `pass: false` result is INSTRUMENT_FLOOR per §7.4 — stop, do not
 * continue to sessions 2-3 or the pad-OFF arm, and record the result as an
 * instrument-validity finding, not a substantive one.
 *
 * @param {Object|null} pad - a writing pad object as returned by
 *   tutor-core/services/writingPadService.js's getWritingPad /
 *   getOrInitializeWritingPad (or null if no pad row exists yet)
 * @returns {{pass: boolean, totalRecognitionMoments: number}}
 */
export function checkPadInstrumentPrecondition(pad) {
  const totalRecognitionMoments = pad?.metrics?.totalRecognitionMoments ?? 0;
  return { pass: totalRecognitionMoments >= 1, totalRecognitionMoments };
}

// --- Stage A3 (prereg §8.4): constructive-continuity checkers -------------
//
// Both checkers below score a session-N *opening* turn against session
// (N-1)'s own longitudinal_drift metadata. Unlike scoreOpeningTurn's
// current/stale pair (which measures leakage of the WRONG session's
// vocabulary), these measure evidence the tutor is doing something
// CONSTRUCTIVE with a resolved predecessor session — acknowledging it, or
// not re-teaching its already-resolved misconception as new content. Fixed
// marker-phrase lists only, word-bounded via containsAny — no judge model,
// exactly the same discipline as the rest of this module.

/**
 * Fixed resolution-register phrases (prereg §8.4(a)). Deliberately excludes
 * any session's own interest_markers/misconception tokens (those are
 * supplied per-call from the scenario schedule) so this list stays a
 * schedule-independent constant.
 */
export const CONTINUITY_ACKNOWLEDGMENT_PHRASES = [
  'last time',
  'you got',
  'we figured out',
  'we solved',
  'resolved',
  'you worked out',
  'picking up from',
];

/**
 * Fixed introductory-framing phrases that signal "this is new material"
 * (prereg §8.4(b)) — used to detect re-teaching a resolved misconception as
 * though the learner had never seen it.
 */
export const RETEACHING_AS_NEW_MARKERS = [
  "let's learn",
  "today we'll cover",
  "here's a new concept",
  'let me introduce',
  'so today',
  "let's start with",
];

/**
 * Split into sentences for the "same sentence window" co-occurrence check
 * in scoreResolvedMisconceptionHandling. Mirrors the sentence-splitting
 * regex already used in services/learnerTutorInteractionEngine.js
 * (lines ~442, ~584) — reused verbatim rather than reinvented.
 */
function splitSentences(text) {
  return String(text || '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Prereg §8.4(a): does a session-N opening reference the *previous*
 * session's own topic/resolution? Hit = previousMeta's own
 * interest_markers OR the fixed CONTINUITY_ACKNOWLEDGMENT_PHRASES list
 * appears (word-bounded) anywhere in the opening. Deliberately does NOT
 * check previousMeta's active_misconception token/markers — that evidence
 * belongs to scoreResolvedMisconceptionHandling only, so the same textual
 * hit is never counted under both checkers (prereg §8.4's explicit
 * no-double-counting note).
 *
 * Not applicable for session 1 (no predecessor) — pass `previousMeta: null`
 * and the result comes back `{ applicable: false, hit: null, evidence: null }`.
 *
 * @param {Object} params
 * @param {string} params.tutorMessage - session-N's generated opening text
 * @param {Object|null} params.previousMeta - session (N-1)'s
 *   longitudinal_drift block, or null for session 1
 * @returns {{applicable: boolean, hit: (boolean|null), evidence: (string|null)}}
 */
export function scoreContinuityAcknowledgment({ tutorMessage = '', previousMeta = null }) {
  if (!previousMeta) {
    return { applicable: false, hit: null, evidence: null };
  }
  const candidates = [...previousMeta.interest_markers, ...CONTINUITY_ACKNOWLEDGMENT_PHRASES];
  const evidence = containsAny(tutorMessage, candidates);
  return { applicable: true, hit: Boolean(evidence), evidence: evidence || null };
}

/**
 * Prereg §8.4(b): does a session-N opening avoid re-teaching the
 * *previous* session's already-resolved active_misconception as though it
 * were new/unaddressed content? Operationalized as: a RETEACHING_AS_NEW_MARKERS
 * phrase landing in the same sentence as one of previousMeta's own
 * misconception markers/token. `hit: true` means the constructive behavior
 * held (no such co-occurrence found) — i.e. a HIGH hit rate is the good
 * outcome, matching this checker's contribution to the "4-slot" positive
 * constructive-continuity score (prereg §8.4's explicit operationalization).
 *
 * Only applicable when the CURRENT session's own metadata marks
 * `resolved_last_session: true` (sessions 2 and 3 on this schedule) — session
 * 1 returns `{ applicable: false, hit: null, evidence: null }`, checked but
 * not scored, per §8.4.
 *
 * @param {Object} params
 * @param {string} params.tutorMessage - session-N's generated opening text
 * @param {Object} params.currentMeta - session N's longitudinal_drift block
 *   (read only for its own `resolved_last_session` flag)
 * @param {Object|null} params.previousMeta - session (N-1)'s
 *   longitudinal_drift block (read for its misconception token/markers)
 * @returns {{applicable: boolean, hit: (boolean|null), evidence: (string|null)}}
 */
export function scoreResolvedMisconceptionHandling({ tutorMessage = '', currentMeta, previousMeta = null }) {
  if (!currentMeta || currentMeta.resolved_last_session !== true || !previousMeta) {
    return { applicable: false, hit: null, evidence: null };
  }
  const misconceptionMarkers = [previousMeta.active_misconception.token, ...previousMeta.active_misconception.markers];
  const sentences = splitSentences(tutorMessage);
  for (const sentence of sentences) {
    const reteachHit = containsAny(sentence, RETEACHING_AS_NEW_MARKERS);
    if (!reteachHit) continue;
    const misconceptionHit = containsAny(sentence, misconceptionMarkers);
    if (misconceptionHit) {
      // Bad pattern found: re-teaching the resolved misconception as new.
      return { applicable: true, hit: false, evidence: `"${reteachHit}" + "${misconceptionHit}" in: ${sentence}` };
    }
  }
  return { applicable: true, hit: true, evidence: null };
}

/**
 * Aggregate a set of per-session constructive-continuity results (prereg
 * §8.4/§8.5) into the frozen "4-slot" per-arm score: 2 sessions (2, 3) × 2
 * checkers (continuity-acknowledgment, misconception-not-retaught), summed
 * to a 0-4 scale. Rows flagged `instrumentFailure: true` are excluded from
 * both the numerator and the applicable-slot denominator and reported
 * separately, mirroring summarizeDriftRun's convention exactly.
 *
 * @param {Array<Object>} rows - one row per (arm, session), each shaped
 *   `{ arm: 'padOn'|'padOff', sessionIndex, continuity: <scoreContinuityAcknowledgment result>,
 *   misconceptionHandling: <scoreResolvedMisconceptionHandling result>, instrumentFailure? }`
 * @returns {Object} per-arm slot counts plus the frozen §8.5 verdict
 */
export function summarizeConstructiveContinuity(rows = []) {
  const arms = ['padOn', 'padOff'];
  const byArm = {};
  for (const arm of arms) {
    const armRows = rows.filter((r) => r.arm === arm);
    const usableRows = armRows.filter((r) => !r.instrumentFailure);
    let slotsHit = 0;
    let slotsApplicable = 0;
    const detail = [];
    for (const row of usableRows) {
      for (const checkerName of ['continuity', 'misconceptionHandling']) {
        const result = row[checkerName];
        if (result?.applicable) {
          slotsApplicable += 1;
          if (result.hit) slotsHit += 1;
        }
        detail.push({
          sessionIndex: row.sessionIndex,
          checker: checkerName,
          applicable: Boolean(result?.applicable),
          hit: result?.hit ?? null,
          evidence: result?.evidence ?? null,
        });
      }
    }
    byArm[arm] = {
      slotsHit,
      slotsApplicable,
      instrumentFailures: armRows.length - usableRows.length,
      detail,
    };
  }
  // Frozen §8.5 gate: pad-ON >= 2/4 AND pad-OFF == 0/4.
  const padOnPass = byArm.padOn.slotsHit >= 2;
  const padOffPass = byArm.padOff.slotsHit === 0;
  const redFlag = byArm.padOff.slotsHit > 0;
  return {
    padOn: byArm.padOn,
    padOff: byArm.padOff,
    verdict: padOnPass && padOffPass ? 'PASS' : 'FAIL',
    redFlag,
  };
}
