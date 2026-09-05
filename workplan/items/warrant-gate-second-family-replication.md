---
id: warrant-gate-second-family-replication
title: "Replicate the passive warrant-gate main block on a second model family"
status: active
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-09-04
updated: 2026-09-05
branch: claude/warrant-gate-second-family-replication
verification: "Launched 2026-09-04 on the user's chat GO. Two attempts at dialogue 01 discarded (32 calls): a harness defect (PR #1025) and an Opus 5 analysis-seat validator failure. Registration amended in place on 2026-09-05: analysis seat back to Luna, seed 736 replaced by 748. Relaunched under a fresh chat GO. Stopped again at dialogue 02 (quote rule, PR #1033) and at dialogue 35 (final-authority check, PR #1047) and at dialogue 43 (registered 30-attempt cap, four codex CLI hangs) and at dialogue 53 (unspecified target with a named identifier, validator unchanged; its retake failed too and the user dropped it, fourth amendment). Generation complete 71/71 in r6, 568 cases, 1,136 reader batches planned. Reader loop died before its first call on a lifecycle-method defect (fixed, tests moved onto the real budget adapter); awaiting GO for recovery relaunch."
claim_status: planned
links:
  notes:
    - docs/adaptation-refinement/warrant-gate-second-family-replication.md
    - docs/adaptation-refinement/outcome-study-a1/second-family-replication-manifest.json
    - docs/adaptation-refinement/relay/096-reviewer-reregistration-outcome-main-block.md
  items:
    - adaptive-warrant-outcome-study
tags: [warrant-gate, replication, tutor-stub, opus, codex-sol, model-bound]
---

# Replicate the passive warrant-gate main block on a second model family

Paper §6.25 reports the one large positive of the gate arc: 19/24 gated
dialogues broke deference against 10/24 bare and 11/24 standing-permission,
and gated decision correctness ran 87.5% against 64.8% and 68.3%. One model
(codex Luna) held every seat, including both readers. This card runs the same
72-dialogue block once more with Opus 5 in the tutor and learner seats and
codex Sol in the two reader seats, on twelve fresh seeds. Design and gates are
in the registration linked above; nothing else changes.

## Acceptance

- [ ] Registration and manifest fix worlds, conditions, seeds 737-748, seats,
  endpoints, bars, stopping rules and the call ceiling; both reach `main`.
- [ ] Plain launcher dry-runs at zero calls from a clean checkout and its
  focused tests pass.
- [ ] User writes GO in chat; the launcher records the words as given. No GO
  note.
- [ ] 72/72 dialogues complete and 576 cases assemble with both readers
  contract-valid, or the first non-recoverable failure is preserved without
  rerunning valid outputs.
- [ ] Score report applies the registered bars; §6.25 gains one paragraph
  stating whether the effect held on the second family.

## Log

- 2026-09-04: Opened after the two-to-four-week review. The passive gate
  result is the only positive in the window large enough to replicate at an
  affordable size. Setup is zero-call: this card, the registration, the
  manifest, the launcher, tests and a dry run. No paid call has run.
- 2026-09-04: User wrote GO in chat. Launched. Dialogue 01 died at its first
  model call: the tutor-stub child closed attempts without persisting the
  response (rule of 2026-09-03 never applied to the child). Fixed in PR
  #1025 with a regression test. Relaunched under recovery on the fix.
- 2026-09-05: The retake of dialogue 01 ran 8 turns and 30 calls but turn 4
  stayed unread: Opus 5 in the analysis seat returned target `unspecified`
  with a named public identifier in 3 of 3 tries, which the strict validator
  rejects. Quarantined, run stopped. User ruling in chat: Luna in the
  analysis seat, amend and GO. Registration, manifest, launcher seat, seed
  ledger and tests amended in place; seed 736 burned, 748 replaces it.
  Relaunched fresh (no recovery: the discarded dialogue used a different
  analysis seat).
- 2026-09-05: Dialogue 01 completed with all turns read. Dialogue 02 was
  quarantined: the Opus 5 learner wrote `*and*` on turn 6 and Luna quoted the
  clause without the marks in 3 of 3 tries, so the strict validator rejected
  every event as not literal. Fix in place, same class as the 2026-08-16
  case-fold ruling: the quote rule now ignores emphasis marks, offsets stay
  in the original text, uniqueness stays. Regression test on the real turn.
  Registration amended (second amendment). Awaiting the user's word to
  relaunch under recovery with dialogue 02's one retake.
- 2026-09-05: User merged PR #1033 and wrote GO. Relaunched under recovery
  into `-2026-09-05-r2`. Dialogues 02 to 34 completed with every turn read.
  Ten codex CLI timeouts or failed turns healed on retry inside the three
  tries. Ledger 970 of 3,360 calls at 34 of 72.
- 2026-09-05: Dialogue 35 (world 102, gated, seed 742) quarantined at turn
  5; run stopped as recoverable. The learner's wording comment put the turn
  on the instructional_meta plane, where the builder keeps the repair
  family over the gate override (first-family design). The final-authority
  check from PR #654, added after the first family ran, threw on the
  mismatch. Fixed in place: the check now records the hold as
  `applied: false` with a named reason and throws on every other plane.
  Regression test on the real turn-5 shape. Registration amended (third
  amendment). Awaiting the user's word to relaunch under recovery with
  dialogue 35's one retake.
- 2026-09-05: User merged PR #1047 and wrote GO. Relaunched under recovery
  into `-2026-09-05-r3` on the merge commit. Dialogue 35's retake and
  dialogues 36 to 42 completed with every turn read; the deferral branch
  from the fix never fired. Six codex CLI hangs healed on retry.
- 2026-09-05: Dialogue 43 (world 101, gated, seed 744) quarantined under the
  registered 30-attempt cap; run stopped as recoverable. Four codex CLI
  hangs on the Luna analysis seat (turns 1, 2, 8, 8; each the full 300 s,
  against about 20 s for a good call) plus two tutor recovery calls used
  the six spare attempts, so the turn-8 tutor call could not be reserved.
  All 8 learner turns were read. No code defect. Ledger 1,191 of 3,360 at
  42 of 72. Awaiting the user's word to relaunch under recovery with
  dialogue 43's one retake.
- 2026-09-05: User wrote GO. Relaunched under recovery into
  `-2026-09-05-r4` on the same commit; dialogue 43's one retake running.
- 2026-09-05: Dialogues 43 (retake) to 52 completed with every turn read;
  one codex CLI hang healed on retry. Dialogue 53 (world 102, gated, seed
  745) quarantined at turn 7; run stopped as recoverable. Luna set the
  target to `unspecified` and listed WF-11 as a public identifier in 3 of
  3 reads; the registered validator rejects that pair. Spans literal, no
  call errors, 26 calls. Same pair cost retries in dialogues 10, 21, 28 and
  47 and quarantined dialogue 01 on Opus. Two paths put to the user: retake
  under the unchanged validator, or a fourth amendment (drop identifiers on
  an unspecified target with a note). Ledger 1,474 of 3,360 at 52 of 72.
- 2026-09-05: User wrote GO. Relaunched under recovery into
  `-2026-09-05-r5` on d454ad4c (main had moved; no change on this
  launcher's path); validator unchanged; dialogue 53's one retake running.
- 2026-09-05: Dialogue 53's retake failed at turn 4 (two reads over the
  240-character span limit, one the same unspecified-plus-WF-11 pair) and
  five tutor recovery calls took it to the 30-call cap before the turn-8
  tutor call; child sealed incomplete. Ledger 1,504 of 3,360. Three paths
  put to the user; ruling in chat: drop 53 and continue. Fourth amendment:
  the launcher now enforces the one-retake rail at recovery (a dialogue
  past it is recorded as dropped and skipped) and derives every downstream
  count from the completed dialogues: 71 dialogues, gated 23, 568 cases,
  1,136 reads. Bias on R1 runs against the gate. Regression test added.
- 2026-09-05: User merged PR #1057 and wrote GO. Relaunched under recovery
  into `-2026-09-05-r6` on 83a96239. Dialogues 54 to 72 completed with
  every turn read and no call errors; 71 of 71 complete, 53 dropped.
  Gated overrides applied on every checked dialogue, no hold recorded.
  Dialogue 66 reached the 30-call cap and sealed complete. Case extraction
  568, reader plan 1,136 batches. Ledger 1,997 of 3,360.
- 2026-09-05: The reader loop died on its first batch before any codex Sol
  call: `reservation.fail is not a function`. The loop called the attempt
  lifecycle on the reservation record; the budget adapter keeps it on
  itself. Technical, no model call, one ledger slot burned and released.
  Fixed in place; the reader tests now run on the real budget adapter over
  a real shared ledger and fail on the old loop. Awaiting the user's word
  to relaunch under recovery; the reader phase resumes at batch 1.
