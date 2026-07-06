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

export const LONGITUDINAL_DRIFT_CHECKER_VERSION = '1.0';

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
