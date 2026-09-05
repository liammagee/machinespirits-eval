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
verification: "Launched 2026-09-04 on the user's chat GO. Two attempts at dialogue 01 discarded (32 calls): a harness defect (PR #1025) and an Opus 5 analysis-seat validator failure. Registration amended in place on 2026-09-05: analysis seat back to Luna, seed 736 replaced by 748. Relaunched under a fresh chat GO."
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

