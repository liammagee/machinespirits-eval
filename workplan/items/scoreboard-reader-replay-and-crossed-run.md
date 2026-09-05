---
id: scoreboard-reader-replay-and-crossed-run
title: Scoreboard reader replay and crossed run
status: done
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-09-04
updated: 2026-09-05
claim_status: killed
links:
  notes:
    - notes/2026-09-04-scoreboard-replay-prompt.md
    - notes/2026-09-05-scoreboard-replay-report.md
    - notes/2026-09-05-scoreboard-crossed-run-go.md
    - notes/2026-09-05-scoreboard-crossed-run-report.md
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
    - "§6.31; §6.24 to §6.30, §7.14"
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
  pass with 0 fails and 52 ratchet tests pass. 2026-09-05, later: Step 2 ran
  on the user's go and stopped on Kill 2 at 36 of 48 dialogues; Kill 1 also
  fired on those 36; no reader seat ran; the report names Sonnet 5 in every
  seat and says the second-model check did not run. 2026-09-05, 16:43 UTC:
  the world-102 rerun under the fixed reader stopped on Kill 2 again at 22 of
  24 dialogues started; Kill 1 fired on the 36 that stand; no reader seat ran;
  the report says so in its second-run section. 2026-09-05, 17:51 UTC: the
  user ruled that a hedge in the next sentence covers the sentence before it;
  the reader is changed in place, the stopped turn is a regression test, and
  the zero-call re-reads hold both Step 1 bars. 2026-09-05, 21:55 UTC: Step 2
  is done; 48 dialogues stand; the report names Sonnet 5 in the tutor,
  learner and analyzer seats and Luna in both reader seats, says the
  second-model check did not run, and reads Kill 1 FIRED and Kill 2 not
  fired. lint:all, npm test, test:ratchets and wp:source-check green on the
  branch at that point: 10,457 tests pass with 0 fails and 27 skipped."
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
- 2026-09-05: PR #1034 merged. The six-call tutor PR benchmark it owed ran on
  the merged code (commit ff9f865f, clean tree): 3 of 6 pass. Two zero-call
  checks say the fails are not from the PR. The candidates that passed 6 of 6
  at 12:11 UTC on eea76bdf pass again under the new code (re-audit, 0
  regressed), and every runtime edit in the PR is gated on the `board` or
  `board_blind` policy, which the benchmark does not run. The gate's record on
  earlier code is 0/6, 0/6, 4/6, 4/6, then 6/6 once. Report:
  `.git/machinespirits-reports/tutor-pr-benchmark/runs/pr-benchmark-2026-09-05T12-28-17-719Z/`.
  A paired base/head comparison (12 more calls) was not run.
- 2026-09-05: seat change withdrawn. This PR first moved the learner analysis
  seat to codex Luna in commands A, B and D. Before it merged, the user said go
  in another session (GO note commit cfa60412 on `claude/scoreboard-replay`)
  and command A went live at 12:36 UTC from commit 4b7a8362 with Sonnet 5 in
  the tutor, auto-learner and analysis seats. A live run is not patched, so the
  GO note here matches main again.
- 2026-09-05: block A watch note (world 101, `low_agency`, 12 dialogues of 8
  turns, done 12:45 UTC). Licence violations: 0. After-turn board audits: 96,
  no unread field. The pre-tutor board reads show five unread fields each; they
  belong to the tutor's own row for the turn it has not yet spoken, the
  expected marker, not a defect. Learner analysis: 2 of 96 turns unanalyzed
  (`board-r2` turn 8, `board_blind-r5` turn 3); the Sonnet 5 analysis seat
  returned `invalid_semantic_events` three times on each, the dialogue kept
  going with the warrant gate in observe mode, and the board reads those two
  learner turns from public text alone. The dialogue runner sealed the block
  `learner_analysis_incomplete` and exited 1; the matrix stopped before the
  second profile. The operator restarted the `overconfident` block at 12:51
  UTC into `world-101-overconfident`. The reader runner does not read the seal.
  Record for the seat table: Sonnet 5 in the analysis seat leaves about 2 in
  100 turns unanalyzed under the strict validator; Luna's §6.25 and §6.26
  record has none.
- 2026-09-05: user ruling (chat, about 13:05 UTC) on the block A seal. The 2
  in 100 unanalyzed learner turns on the Sonnet 5 analysis seat are acceptable
  for the report. The seal `learner_analysis_incomplete` is not a stop for this
  run; the run continues to world 102 under the GO note as written, with no
  seat change. The report discloses, per block, the seal status and the
  unanalyzed turns with their dialogue and turn numbers.
- 2026-09-05: Step 2 ran on the user's "go" in the chat. Sonnet 5 in the
  tutor, learner and analyzer seats. World 101 ran both shapes, 24 dialogues,
  0 licence violations. World 102 ran the permission-seeking shape; the board
  reader read the board tutor as naming the answer with no right to close in
  two dialogues at turn 6, so Kill 2 fired and the matrix stopped. The two
  spans come from a defect in the reader's sentence splitter at a dash, not
  from the tutor's conduct; the fix is not in this PR. Kill 1 fired on the
  zero-call score over the 36 dialogues done: permission-seeking 0 of 12
  against 2 of 12, overconfident 2 of 6 against 3 of 6. No reader seat ran,
  so decision correctness and warranted shift share are unread. 990 paid
  calls of the 2,476 ceiling. Traces archived in the private repo. Report:
  `notes/2026-09-05-scoreboard-crossed-run-report.md`. The paper may state
  no verdict from this run.
- 2026-09-05: licence-audit tests for the Kill 2 defect, written in a
  second session as PR #1043 and landed after the fix (PR #1044 merged 14:43
  UTC with the fix and the field-level tests only). The two tutor turns the
  run stopped on (world 102, low_agency, board-r2 and board-r4, turn 6, exact
  text with the em-dash) must read no answer named and pass the licence
  audit; a control turn that names the answer (board_blind-r1, turn 8) must
  still fire the rule and the audit must still record it. The two test
  blocks now share one world 102 fixture. All pass with zero calls.
- 2026-09-05: splitter defect fixed in the board reader. The naming rule read
  each clause on its own after the splitter cut a sentence at a dash, so the
  clause before the dash lost the sentence's question mark or its hedge word
  ("not", "yet") and read as a commitment to the secret. Now the reader reads
  the question mark and the hedge on the whole sentence first, then looks for
  the naming clause inside it. A named answer under the new reader is always a
  named answer under the old one. Regression tests hold the two real turn-6
  sentences from the world 102 board dialogues (board-r2, board-r4), the real
  turn-8 naming from board_blind-r1 (still a naming), and one synthetic pair.
  Zero paid calls to check: (1) the Step 1 replay reads the same, both bars
  unchanged (562 of 678 shapes agree, 457 of 511 delivered moves show, same
  forced-card table); 17 tutor rows across the 726 sealed boards drop a false
  naming and no other field changes. (2) The 36 crossed-run dialogues
  re-audited offline: with the old reader the offline audit matches every one
  of the 284 recorded after-turn audits; with the fixed reader the two board
  violations in world 102 vanish, the three record-only marks in the blind
  arms stay (two namings at turn 8, one challenge mark at turn 2), and no new
  mark appears. Kill 2 fired on the reader, not the tutor. Report-only, no
  change: 64 of 1,949 test marks sit inside a question sentence cut at a
  dash, but there the clause before the dash is the act itself ("I open the
  badge log; what does this change?"), so that rule keeps the clause read.
  The rerun of world 102 (24 dialogues, about 650 calls) plus the reader
  seats (192 calls) waits on the user's word.
- 2026-09-05: world 102 ran again on the user's word "Do that" (15:52 UTC),
  under the board reader PR #1044 fixed (commit 06dd49db, clean tree, Sonnet 5
  in every seat). Permission-seeking cell: 12 dialogues, 0 licence violations,
  blind r1 failed at turn 3 on the tutor runtime's speaker-privilege guard, 4
  of 90 learner turns unread, seal `incomplete`. Overconfident cell, restarted
  in a sibling root: Kill 2 fired at board r6 turn 6 on the sentence "Half of
  that holds: Osprey's authorization plus their presence for the inspection
  does put them in a position to have cleared bay three"; the hedge "doesn't
  yet show" sits in the next sentence, which the reader does not read for the
  first. The matrix was stopped at 16:43 UTC with 10 dialogues started, 2 at
  turn 8. Kill 1 fired on the 36 dialogues that stand: permission-seeking 1 of
  12 against 1 of 12, overconfident 2 of 6 against 3 of 6. No reader seat ran.
  468 calls dispatched of the 960 ceiling; 1,459 of 3,436 for the study.
  Traces archived (private repo `3112690b2`). Report: the second-run section
  of `notes/2026-09-05-scoreboard-crossed-run-report.md`. Open question for
  the user: does a hedge in the next sentence count for the sentence before
  it? No third run without a new word.
- 2026-09-05: user ruling (chat, 17:51 UTC) on the hedge scope: "Yes, a hedge
  in the next sentence covers the sentence before it." The board reader now
  skips a sentence when a hedge word stands in the sentence right after it. A
  question mark in the next sentence does not count, because most tutor turns
  end with a question. A hedge two sentences on does not count. The stopped
  turn (board r6, turn 6) is a regression test and passes the licence audit;
  three more tests hold the two edges. Zero paid calls to check: (1) the Step
  1 replay reads the same, both bars unchanged (562 of 678 shapes agree, 457
  of 511 delivered moves show, same forced-card table); 33 tutor rows in 31 of
  the 726 sealed boards drop a naming and no other field changes. Of the 33,
  24 were closures with the right (12 at the last turn) and 9 were without.
  In 12 the next sentence rules out the other suspect ("Kite did it. Runa did
  not."); in 7 the next sentence uses the verb "open". Neither kill rule reads
  a tutor naming with the right, so the dropped closures move no kill. (2)
  The 58 crossed-run dialogues re-audited offline, 418 after-turn audits: the
  old reader matches every recorded audit except the two fires PR #1044
  dissolved; the ruled reader also dissolves the board-r6 fire; the three
  record-only marks in the blind arms stay; no new mark; the board arm has
  zero violations. The change touches one reader function and no design
  file, so the GO stands. A third run of world 102 (about 330 calls, then the
  reader seats at 192) waits on the user's word.
- 2026-09-05: the user's word at 19:06 UTC ("push the private repo commit,
  do the check and lets continue") covered the third run of the world-102
  overconfident cell and then the reader seats. The cell ran 19:44 to 19:54
  UTC from commit 3daafac7, clean tree: 12 of 12 dialogues to turn 8, 317
  calls, 0 licence violations, 0 model call errors, 0 unread learner turns,
  seal complete. 48 dialogues stand (47 to turn 8; the world-102 blind r1
  permission-seeking dialogue stands with two turns). The reader command's
  dry run found that packets carried the dialogue id, which names the profile
  and the policy; fixed in place with a regression test (32da9e4b) before any
  reader call. Command C then ran 20:14 to 21:54 UTC at 33da0aed, clean
  tree: 192 of 192 Luna calls returned, 0 failed. Zero-call score on the 48:
  Kill 1 FIRED (permission-seeking 1 of 12 against 1 of 12; overconfident 5
  of 12 against 6 of 12); Kill 2 not fired; no indeterminate cell; no
  self-judging. Decision correctness 98% against 88% on the permission-seeking
  shape with zero challenges from either tutor, 47% against 53% on the
  overconfident shape; warranted shift share 2% against 12% and 52% against
  52%; the board's challenge field and the readers' read of a delivered
  challenge agree in 18% to 46% of cases, the board's being the narrow read.
  Study total 1,968 calls of 3,436. Archive: private repo `b4498b0ef`,
  pushed. The second-model check (commands D to F) did not run. Step 2 is
  done and reads FAIL on its outcome rule; Phase 2 does not open. Report:
  the third-run section of `notes/2026-09-05-scoreboard-crossed-run-report.md`.
- 2026-09-05: card closed on the user's word ("close the card and update the
  paper"). The Phase 0 and Phase 1 results are folded into the paper as a new
  §6.31 at v3.0.307, with a revision-history entry, on the card
  `scoreboard-crossed-run-paper-fold`. The registered claim reads killed: the
  board tutor did not move either shape's channel above the blind tutor. The
  one recorded effect, 0 unlicensed moves in 192 audited board-tutor turns
  against 3 for the blind tutor, is a conduct fact on this stack and is
  reported as that. The second-model check did not run and is not owed for a
  null. Step 3, the human seat, is not started. Phase 2 does not open.
