/**
 * Hand-coding of every trap turn against the four Narrative World Model
 * query types (arXiv:2607.05577 — "Narrative World Model: Narratology-Grounded
 * Writer Memory for Long-Form Fiction").
 *
 * NWM builds a typed temporal-state graph and asks four things of it:
 *
 *   who_knows_what   — which party holds a given fact right now
 *   when_learned     — at which turn that party came to hold it
 *   event_ordering   — the order the facts entered the story
 *   setup_payoff     — whether an earlier plant was later discharged
 *
 * A trap turn is coded with the query types the tutor MUST answer correctly to
 * pick the expected strategy shift. `revealedBy` names who does the disclosing:
 * `learner` (the learner surfaces something about themselves), `tutor` (the
 * tutor's own earlier turn is the object of the trap), or `both`.
 *
 * This is hand coding, not a derivation. Sources are the scenario definitions
 * in config/adaptive-trap-scenarios.yaml (v1 suite, cells 110/111/113) and
 * config/cross-suite-trap-scenarios.yaml (cross suite, cell 124): each entry's
 * `hidden`, `trigger_signal`, `failure_mode` and `success_criteria` fields.
 * `note` quotes the reveal the coding turns on.
 */

export const NWM_QUERY_TYPES = Object.freeze(['who_knows_what', 'when_learned', 'event_ordering', 'setup_payoff']);

export const TRAP_REVEAL_CODING = Object.freeze({
  // ── config/adaptive-trap-scenarios.yaml (cells 110 / 111 / 113) ──────────
  false_confusion_v1: {
    suite: 'v1',
    revealedBy: 'learner',
    queries: ['who_knows_what', 'when_learned', 'setup_payoff'],
    note: 'The learner already held the master–slave reading before turn 0; the turn-0 "I keep losing the thread" was performed, not acquired. Answering the trap needs the disclosure dated BEFORE the dialogue opened, which retro-reads turn 0 as the plant.',
  },
  polite_false_mastery_v1: {
    suite: 'v1',
    revealedBy: 'learner',
    queries: ['who_knows_what', 'when_learned'],
    note: 'The trap is a NON-reveal: "yes that makes sense" discloses nothing, so the tutor must record that no fact was transferred at turn 1. Nothing in the schema distinguishes "not learned" from "not yet written down".',
  },
  resistance_to_insight_v1: {
    suite: 'v1',
    revealedBy: 'learner',
    queries: ['who_knows_what', 'event_ordering'],
    note: "The objection presupposes and targets the tutor's turn-0 definition, so it must be ordered after it and read as a position rather than a gap.",
  },
  answer_seeking_to_productive_struggle_v1: {
    suite: 'v1',
    revealedBy: 'learner',
    queries: ['event_ordering', 'setup_payoff'],
    note: 'The signal is a repetition across turns 0 and 2 ("what\'s the right answer" → "just tell me the answer"), not the content of either turn alone.',
  },
  metaphor_boundary_case_v1: {
    suite: 'v1',
    revealedBy: 'tutor',
    queries: ['when_learned', 'setup_payoff', 'event_ordering'],
    note: 'The mirror figure was disclosed BY THE TUTOR at turn 1; the learner over-extends it at turn 2. The object of the trap is a tutor-side reveal — the one thing no channel records.',
  },
  affective_shutdown_v1: {
    suite: 'v1',
    revealedBy: 'learner',
    queries: ['who_knows_what', 'event_ordering'],
    note: 'Load accumulates across turns 0–1 and tips at turn 2; the state that matters is a trajectory, not the turn-2 utterance.',
  },
  repair_after_misrecognition_v1: {
    suite: 'v1',
    revealedBy: 'both',
    queries: ['who_knows_what', 'when_learned', 'event_ordering'],
    note: 'The tutor answered question X at turn 1; the learner had asked Y at turn 0. The trap is the tutor holding a fact it never actually received — precisely the mis-dated-belief case NWM is built to catch.',
  },
  sophistication_upgrade_v1: {
    suite: 'v1',
    revealedBy: 'learner',
    queries: ['who_knows_what', 'when_learned'],
    note: "The Brandom reading was held before turn 0 and understated there; the tutor must revise the date it assigned to the learner's knowledge, not just its level.",
  },

  // ── config/cross-suite-trap-scenarios.yaml (cell 124) ───────────────────
  cross_epistemic_resistance: {
    suite: 'cross',
    revealedBy: 'learner',
    queries: ['who_knows_what', 'event_ordering'],
    note: "The Popperian objection is a held position carried in from outside the dialogue, aimed at the tutor's prior account.",
  },
  cross_affective_shutdown: {
    suite: 'cross',
    revealedBy: 'learner',
    queries: ['who_knows_what', 'event_ordering'],
    note: 'Same trajectory shape as affective_shutdown_v1 — the tip is only readable against turns 0–1.',
  },
  cross_productive_deadlock: {
    suite: 'cross',
    revealedBy: 'both',
    queries: ['event_ordering', 'setup_payoff'],
    note: "The deadlock is constituted by the exchange, so the pivot needs both parties' prior commitments ordered against each other.",
  },
  cross_misconception_surfaces: {
    suite: 'cross',
    revealedBy: 'learner',
    queries: ['who_knows_what', 'when_learned'],
    note: 'A misconception surfaces at the trigger; whether it was newly formed or carried in decides between probing and correcting.',
  },
  cross_activity_avoidance: {
    suite: 'cross',
    revealedBy: 'learner',
    queries: ['event_ordering', 'setup_payoff'],
    note: 'Avoidance is a pattern over turns, echoing answer_seeking_to_productive_struggle_v1.',
  },
  cross_struggling_overload: {
    suite: 'cross',
    revealedBy: 'learner',
    queries: ['who_knows_what', 'event_ordering'],
    note: 'Overload is read off accumulated load, not the trigger utterance alone.',
  },
});

/** Coding for a scenario id, or null when the scenario is not hand-coded. */
export function codingFor(scenarioId) {
  return TRAP_REVEAL_CODING[scenarioId] || null;
}

/** Scenario ids requiring a given NWM query type. */
export function scenariosRequiring(queryType) {
  return Object.entries(TRAP_REVEAL_CODING)
    .filter(([, c]) => c.queries.includes(queryType))
    .map(([id]) => id);
}
