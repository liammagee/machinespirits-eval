---
id: scoreboard-reader-replay-and-crossed-run
title: Scoreboard reader replay and crossed run
status: active
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-09-04
updated: 2026-09-05
claim_status: planned
links:
  notes:
    - notes/2026-09-04-scoreboard-replay-prompt.md
    - notes/2026-09-05-scoreboard-replay-report.md
    - notes/2026-09-05-scoreboard-crossed-run-go.md
    - notes/2026-09-04-adaptive-tutor-plan.md
    - notes/2026-09-04-theoretical-blueprint.md
  code:
    - services/tutorStubScoreboard.js
    - services/tutorStubScoreboardShapes.js
    - services/tutorStubScoreboardPolicy.js
    - services/tutorStubScoreboardLearnerCast.js
    - services/tutorStubScoreboardCrossedReaders.js
    - scripts/replay-scoreboard.js
    - scripts/analyze-figure-lattice-scoreboard.js
    - scripts/preflight-scoreboard-learner-cast.js
    - scripts/run-scoreboard-crossed-readers.js
  paper:
    - "§6.24 to §6.30, §7.14"
  items:
    - one-adaptive-tutor-plan-line
    - a1-human-learner-validation
    - adaptive-warrant-public-obligation-ledger-and-inquiry-termin
    - frame-refuser-narrowing-construct-redesign
    - adaptive-causality-crossed-effects
    - figure-lattice-falsifier
verification: "Step 1 report note states PASS or FAIL against the two
  pre-declared bars: shape agreement at or above 0.8 pooled and 0.7 pairwise,
  and delivered moves visible on the board at or above 0.8, over the sealed 6.24
  to 6.30 archives with zero model calls. Step 2 runs only on PASS: a
  48-dialogue crossed run report names the model in every seat and whether the
  second-model check ran, and reads the two kill rules. Step 3, the human seat,
  is not in this card. lint:all, npm test, test:ratchets and wp:source-check
  pass. 2026-09-05: Step 1 report says PASS on the two pooled bars; the
  held-out half misses the pairwise bar by one dialogue. Cast preflight PASS
  with zero calls. Step 2 GO note written; no paid call made. lint:all, npm
  test, test:ratchets and wp:source-check green on the branch: 10,375 tests
  pass with 0 fails and 52 ratchet tests pass."
---

**What this is.**

Phases 0 and 1 of `notes/2026-09-04-adaptive-tutor-plan.md`. The brief for
the session that does the work is `notes/2026-09-04-scoreboard-replay-prompt.md`.
Copy it whole into a fresh session; do not paraphrase it.

The board is one row per turn: what each party has claimed, earned,
challenged, named, offered and been granted, keyed to proof-DAG node ids.
The prompt fixes the schema, the shape rules and the two endpoints before
anyone looks at a board.

**Step 1, zero calls.**

Build the board reader from the instruments the prompt lists, replay it over
the sealed §6.25 to §6.30 archives in the private repo, and test two fixed
predictions: shapes separate (0.8 pooled, 0.7 pairwise) and delivered moves
show (0.8). Report note: `notes/<date>-scoreboard-replay-report.md`, first
line PASS or FAIL. The §6.24 dialogues are gone; only that line's hold and
form-state exports survive, and they serve one secondary check.

**Step 2, one paid run, opens on PASS only.**

48 dialogues: the permission-seeking and overconfident learners against a
tutor that reads the board and the same tutor with the board hidden.
Launched through the QA-matrix runner, not the retired launchers. Model
seats Sonnet 5 or codex Luna, then one small pair on Opus 5 or codex Sol
under the model-bound rule. GO note in the house shape; provenance recorded,
never bound. Report note: `notes/<date>-scoreboard-crossed-run-report.md`.

**Not in this card.**

Step 3, the human seat, stays on `a1-human-learner-validation` and stays
gated on IRB approval. The paper fold-in is its own card after the reports
are read.

**Gate record.**

- 2026-09-05: Step 1 replayed over the sealed §6.25 to §6.30 archives with
  zero model calls. PASS on the two pooled bars. The held-out half missed the
  pairwise bar by one dialogue. Report:
  `notes/2026-09-05-scoreboard-replay-report.md`.
- 2026-09-05: Step 2 prepared. Board policy `board` and blind policy
  `board_blind` in the response-policy runtime; the runtime writes a
  `scoreboard_licence_violation` event and stops the dialogue when the board
  tutor moves without the right. Cast preflight PASS with zero calls
  (`node scripts/preflight-scoreboard-learner-cast.js`). Reader runner and
  scorer built and tested with zero calls. GO note:
  `notes/2026-09-05-scoreboard-crossed-run-go.md`. No paid call made. The run
  waits on the user's word "go" in the chat.
