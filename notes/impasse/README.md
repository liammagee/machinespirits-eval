# Impasse program — Phase I: candidate-episode extraction

Phase I of the communicative-impasse program (sanctioned 2026-07-17; context: `PLAN_4_0/2026-07-17-continue-or-fold.md`, "Forward doors"). Extracts candidate communicative-impasse episodes from the user's own interactive tutor-stub sessions and produces a labeling sheet for human annotation. **Pure text/heuristic analysis — zero model calls were made.**

## Sources

- `.tutor-stub-traces/*.jsonl` (34 jsonl traces at extraction time).
- Session classification from the first line (`run_start` metadata): `metadata.autoLearner.enabled == true` → auto (**excluded**, 7 sessions); `metadata.mixedLearner.enabled == true` → mixed (**included, flagged**, 2 sessions); otherwise human interactive (**included**, 25 sessions).
- In-scope sessions: **27** (25 human + 2 mixed), **166** completed turns (`turn_complete` events): 127 human + 39 mixed — matching the corpus described in the sanctioning doc (25 human sessions / 127 human turns / 2 mixed sessions).
- Turn texts from `turnRecord.learner` / `turnRecord.tutor`; DAG side-state from `turnRecord.tutorLearnerDagModel.assessment` (`bestPathCoverage`, `bottleneck`, `finalSecretEntailed`); interactive commands from `analysis_popup`, `unknown_slash_command`, `interactive_help`, `field_visualization_popup` events; session endings from `run_end`, `closeout_report`, and trailing event type; resume chains from `resume_loaded`.

## Heuristics and fire counts

| # | Heuristic | Unit | Fires |
|---|-----------|------|-------|
| 1 | Learner clarification markers (spec list + apostrophe-normalized + observed variants: "don't get it", "I mean" self-repair, "you haven't shown", "read it back", "how could I know") | turns | 9 |
| 2 | Interactive command usage (`/analysis` popup, `/help`, unknown slash commands, `/field`; no `/clarify` or `/explain` events exist in these traces) | events | 11 (5 anchored to in-session turns; 6 in 0-turn inspection-resume sessions, noted in the abandoned list) |
| 3 | Learner restatement (Jaccard > 0.5 on content words vs own previous 3 turns; both turns ≥ 3 content words) | turns | 11 |
| 4 | Tutor re-gloss (same test on tutor responses) | turns | 3 |
| 5 | Stagnation (`bestPathCoverage` unchanged ≥ 3 consecutive turns) | runs | 32 |
| 6 | Comprehension side-state pressure | — | 0 — **field absent**: no `turnRecord.comprehension` (or any comprehension-named field) exists anywhere in these traces; heuristic inapplicable to this schema version |
| 7 | Abrupt exit (≥ 2 turns, last turn not grounded closure) | sessions | 10 |
| aux | Tutor deterministic-fallback line (leak audit replaced the tutor's reply with a canned sentence; recorded, **not** used for ranking) | turns | 8 |

Notes: h6's nearest in-schema analogs (`classification.turn.request_type == conceptual_clarity_request`, `registerSelection.risk_flags`) were deliberately NOT used as Phase I selectors — they are stub-computed signals, and Phase II tests exactly those signals as detectors against the human labels; selecting on them would contaminate that test. h5 (also stub-computed, per the Phase I spec) is the one sanctioned exception; treat pure-h5 episodes accordingly when interpreting Phase II results on that signal.

## Episode construction

Turn-level signals (h1–h4) within ≤ 1 intervening turn are merged into one episode; h5 stagnation runs and the h7 session-end anchor attach to overlapping episodes or stand alone. Episodes are ranked by the number of **distinct** core heuristics fired (h1–h5, h7), descending, then chronologically. Excerpts show up to 4 exchanges, windowed to cover the densest stretch of turn-level signals (clarification turns weighted double, one exchange of preceding context where it fits), truncated at ~400 chars; the JSON sidecar carries untruncated text.

## Counts

- Sessions scanned: 34 jsonl traces → 27 in scope (25 human, 2 mixed), 7 auto excluded.
- Candidate episodes emitted: **29** — all on the labeling sheet (cap 60 not reached).
- Abandoned sessions listed (0–1 turns): 15 (includes six inspection-only resumes of the 2026-07-06 21:26 session, two crashed/killed launches, and single-shot `--once` runs).

## Files

- `2026-07-17-phase1-episodes.json` — machine sidecar (all kept episodes, untruncated excerpts + follow-ups, per-turn signal attribution, session-end info, abandoned-session list).
- `2026-07-17-phase1-labeling-sheet.md` — human labeling sheet (label vocabulary in header).

## Next step (Phase II)

Once the sheet is annotated, Phase II tests the stub's own computed signals — `classification.turn` (request_type / discourse_move / epistemic_stance / agency), `registerSelection.risk_flags`, DAG `assessment` (bottleneck, coverage deltas), register efficacy — as impasse *detectors* against these human labels: per-signal precision/recall on the labeled episodes, with the h5 caveat above.
