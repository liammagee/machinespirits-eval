// A17 §4 — the frozen speech-act vocabulary (decision D5).
//
// A CLOSED set. Per notes/design-a17-speech-act-lock-prototype.md §4 and §9,
// once the pre-registration is LOCKED, adding or removing a move is an
// append-only logged deviation — not a silent edit. The policy selects a move
// *type* (services/adaptiveTutor/graph.js#movePolicySelect); the ego *realises*
// it as natural language (emit-then-realise — auditable, not post-hoc
// classification). Grounded in the project's dialogue-acts lineage
// (corpus 03; TalkMoves / BiPed), per §4.

export const LOCK_PUZZLE_MOVES = Object.freeze([
  'elicit', // ask the learner to produce / commit to an answer or step
  'revoice', // restate the learner's contribution back, sharpened
  'counterexample', // present a case where the learner's rule fails
  'analogy', // map the problem onto a familiar structure
  'decompose', // break the task into a smaller sub-step
  'name-the-confusion', // explicitly state the suspected misconception
  'destabilise', // productively challenge a stated certainty
  'concede', // grant a partial point to lower defensiveness
  'raise-stakes', // add a consequence / why-it-matters frame
  'hand-back', // return agency: "you try the next one"
  'probe-belief', // ask *why* the learner thinks their answer holds
]);

export const isLockPuzzleMove = (s) => LOCK_PUZZLE_MOVES.includes(s);

// The per-misconception "sharp key" (§3.1). This map is consulted ONLY by the
// deterministic mock learner (services/adaptiveTutor/mockLLM.js#learnerProbe)
// to manufacture floor/ceiling discrimination in the hermetic smoke: under
// mock there is no real teaching, so the learner "resolves" iff the tutor has
// actually played the misconception's canonical counterexample move.
//
// The real paid run (task #4) NEVER consults this — there the learner LLM
// answers the probe panel from the real dialogue, and whether the tutor found
// the key is exactly what is unknown. Keeping the resolve rule here, beside
// the vocabulary it references, makes it one auditable place rather than a
// constant buried in a fixture (the §2 "structurally inspectable" posture).
//
//   keyMove        — playing this ⇒ the misconception's counterexample has
//                     been delivered (1/2 + 1/2 = 1, not 2/4 — the sharp key)
//   reinforceMove  — co-played with keyMove it makes the resolution stick
//                     immediately; alone it does nothing (a near-key distractor
//                     so the mock isn't single-token-trivial)
export const MISCONCEPTION_KEYS = Object.freeze({
  'fractions-unlike-denominator': Object.freeze({
    keyMove: 'counterexample',
    reinforceMove: 'name-the-confusion',
  }),
});

export default { LOCK_PUZZLE_MOVES, isLockPuzzleMove, MISCONCEPTION_KEYS };
