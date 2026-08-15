/**
 * Registered endpoint 5 of the guarded pilot: defensive speech acts per turn,
 * report-only.
 *
 * The counts come from the LIVE semantic-event extraction the warrant gate
 * already records on every decision, not from the frozen presence readers. The
 * frozen readers answer under a response schema minted before contract v3.3, so
 * they cannot name `learner_overclaim_assertion`, `learner_evidence_dismissal`
 * or `learner_evidence_demand`; a defensive turn would be pushed onto the
 * nearest old act. The live extractor names all three, and it is the same
 * extraction the gate itself acted on, so the counts and the gate agree by
 * construction.
 *
 * Fail-closed: a turn whose extraction is missing, off-schema, or not accepted
 * is counted as unmeasured and named. A report that cannot see a turn must say
 * so rather than report a zero.
 */

import {
  ADAPTIVE_WARRANT_SEMANTIC_DEFENDED_OVERCLAIM_LABEL,
  ADAPTIVE_WARRANT_SEMANTIC_DEFENSIVE_SPEECH_ACTS,
  ADAPTIVE_WARRANT_SEMANTIC_VALIDATION_SCHEMA,
} from './adaptiveWarrantSemanticEvents.js';

export const ADAPTIVE_WARRANT_DEFENSIVE_ACT_COUNT_SCHEMA =
  'machinespirits.adaptation-refinement.defensive-act-counts.v1';

// The live signal counts an event when the validator accepted it outright or
// left it uncertain. Endpoint 5 uses the same rule, so the counts describe the
// events the gate saw.
export const ADAPTIVE_WARRANT_DEFENSIVE_ACT_COUNTED_STATUSES = Object.freeze(['accepted', 'uncertain']);

// A turn whose envelope came back `uncertain` still reached the gate, and the
// gate acted on its accepted events, so the report reads it too. `invalid`
// means a broken envelope or a rejected event, and that turn is named as
// unmeasured rather than counted as a zero.
export const ADAPTIVE_WARRANT_DEFENSIVE_ACT_MEASURABLE_EXTRACTION_STATUSES = Object.freeze(['accepted', 'uncertain']);

function emptyActCounts() {
  return Object.fromEntries(ADAPTIVE_WARRANT_SEMANTIC_DEFENSIVE_SPEECH_ACTS.map((act) => [act, 0]));
}

function addCounts(target, source) {
  for (const act of ADAPTIVE_WARRANT_SEMANTIC_DEFENSIVE_SPEECH_ACTS) target[act] += source[act];
  return target;
}

/**
 * Count one turn. `decision` is a stored `tutor_warrant_gate_decision` payload
 * or the extraction it carries.
 */
export function countAdaptiveWarrantDefensiveActsForTurn(decision, { turn = null } = {}) {
  const source = decision?.semantic_event_extraction || (Array.isArray(decision?.events) ? decision : null);
  const resolvedTurn = turn ?? decision?.source_turn ?? decision?.turn ?? null;
  if (!source) {
    return { turn: resolvedTurn, measured: false, reason: 'no_semantic_event_extraction', counts: emptyActCounts() };
  }
  if (source.schema !== ADAPTIVE_WARRANT_SEMANTIC_VALIDATION_SCHEMA) {
    return {
      turn: resolvedTurn,
      measured: false,
      reason: 'extraction_schema_predates_v3.3',
      observed_schema: source.schema || null,
      counts: emptyActCounts(),
    };
  }
  if (!ADAPTIVE_WARRANT_DEFENSIVE_ACT_MEASURABLE_EXTRACTION_STATUSES.includes(source.extraction_status)) {
    return {
      turn: resolvedTurn,
      measured: false,
      reason: `extraction_status_${source.extraction_status || 'missing'}`,
      counts: emptyActCounts(),
    };
  }
  const counts = emptyActCounts();
  let dropped = 0;
  for (const event of source.events || []) {
    if (!ADAPTIVE_WARRANT_SEMANTIC_DEFENSIVE_SPEECH_ACTS.includes(event?.speech_act)) continue;
    if (!ADAPTIVE_WARRANT_DEFENSIVE_ACT_COUNTED_STATUSES.includes(event?.validation?.status)) {
      dropped += 1;
      continue;
    }
    counts[event.speech_act] += 1;
  }
  const signalLabels = decision?.learner_signal?.labels || [];
  return {
    turn: resolvedTurn,
    measured: true,
    counts,
    extraction_status: source.extraction_status,
    total: Object.values(counts).reduce((sum, value) => sum + value, 0),
    rejected_defensive_events: dropped,
    defended_overclaim_signal: signalLabels.includes(ADAPTIVE_WARRANT_SEMANTIC_DEFENDED_OVERCLAIM_LABEL),
  };
}

/**
 * Count a whole dialogue. `decisions` are the stored gate decisions in turn
 * order.
 */
export function countAdaptiveWarrantDefensiveActs({ decisions = [], dialogueId = null } = {}) {
  const turns = decisions.map((decision, index) =>
    countAdaptiveWarrantDefensiveActsForTurn(decision, { turn: decision?.turn ?? index + 1 }),
  );
  const measured = turns.filter((row) => row.measured);
  const totals = measured.reduce((target, row) => addCounts(target, row.counts), emptyActCounts());
  return {
    schema: ADAPTIVE_WARRANT_DEFENSIVE_ACT_COUNT_SCHEMA,
    source: 'live_warrant_gate_semantic_event_extraction',
    report_only: true,
    dialogue_id: dialogueId,
    turn_count: turns.length,
    measured_turn_count: measured.length,
    unmeasured_turns: turns
      .filter((row) => !row.measured)
      .map((row) => ({ turn: row.turn, reason: row.reason, observed_schema: row.observed_schema || null })),
    totals,
    total: Object.values(totals).reduce((sum, value) => sum + value, 0),
    defended_overclaim_signal_turns: measured.filter((row) => row.defended_overclaim_signal).map((row) => row.turn),
    turns,
  };
}

/** Roll several dialogues into one report-only table. */
export function summarizeAdaptiveWarrantDefensiveActs(dialogues = []) {
  const totals = dialogues.reduce((target, row) => addCounts(target, row.totals), emptyActCounts());
  const unmeasured = dialogues.reduce((sum, row) => sum + row.unmeasured_turns.length, 0);
  return {
    schema: ADAPTIVE_WARRANT_DEFENSIVE_ACT_COUNT_SCHEMA,
    source: 'live_warrant_gate_semantic_event_extraction',
    report_only: true,
    dialogue_count: dialogues.length,
    turn_count: dialogues.reduce((sum, row) => sum + row.turn_count, 0),
    measured_turn_count: dialogues.reduce((sum, row) => sum + row.measured_turn_count, 0),
    unmeasured_turn_count: unmeasured,
    complete: unmeasured === 0,
    totals,
    total: Object.values(totals).reduce((sum, value) => sum + value, 0),
    dialogues,
  };
}
