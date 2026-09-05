---
id: one-adaptive-tutor-plan-line
title: One adaptive tutor plan line
status: triaged
type: research
priority: P1
owner: human
source: manual
created: 2026-09-04
updated: 2026-09-05
claim_status: planned
links:
  notes:
    - notes/2026-09-04-adaptive-tutor-plan.md
    - notes/2026-09-04-theoretical-blueprint.md
    - notes/2026-09-04-scoreboard-replay-prompt.md
    - notes/2026-09-05-scoreboard-replay-report.md
    - notes/2026-09-05-scoreboard-crossed-run-go.md
    - notes/2026-09-05-scoreboard-crossed-run-report.md
  paper:
    - "§3, §7.12, §7.16, Appendix E"
  items:
    - scoreboard-reader-replay-and-crossed-run
    - a1-human-learner-validation
    - pedagogical-figure-ontology
verification: Each phase of notes/2026-09-04-adaptive-tutor-plan.md has its own
  card before any paid call, each card names its endpoint and kill rule, and
  each closed phase is folded into the existing paper section the plan names,
  with a version bump. The plan note and the blueprint note stay in step with
  the paper at every bump.
---

**What this is.**

The line card for the plan in `notes/2026-09-04-adaptive-tutor-plan.md`,
which builds on `notes/2026-09-04-theoretical-blueprint.md`. It holds the
gate record: which phase is open, what its report said, and what the result
lets the paper say.

**Phases and gates.**

| phase | what | card | gate |
|---|---|---|---|
| 0 | board reader over sealed archives, zero calls | `scoreboard-reader-replay-and-crossed-run` | two fixed endpoints |
| 1 | one crossed run, two shapes, board tutor against blind tutor | same card | opens on Phase 0 PASS |
| 2 | one tutor, all five shapes plus the cooperative learner | to be written | opens on Phase 1 PASS |
| 3 | transfer: unseen worlds, second stack, author cross | to be written | opens on Phase 2 PASS |
| 4 | the human seat | `a1-human-learner-validation` | IRB approval; does not wait on Phase 3 |
| 5 | paper and surfaces | one card per fold | each phase report |

**Rules carried by every phase card.**

Zero-call work first. One schema as the only contract between lanes. The
three sorting questions of the blueprint at triage. Reuse before rebuild; no
numbered copies. Spend ceilings, attended runs, no resampling, no
self-judging, indeterminate means stop. No approval bound to a commit or a
digest. Results are conduct claims until Phase 4.

**Gate record.**

- 2026-09-04: plan written; Phase 0 card open; no call made.
- 2026-09-05: Phase 0 PASS on the two pooled bars with zero calls; the
  held-out half missed the pairwise bar by one dialogue
  (`notes/2026-09-05-scoreboard-replay-report.md`). Phase 1 open and
  prepared: cast preflight PASS, GO note written
  (`notes/2026-09-05-scoreboard-crossed-run-go.md`), no paid call made.
- 2026-09-05: Phase 1 ran and stopped on its defect rule at 36 of 48
  dialogues; its outcome rule also fired on the dialogues done. No reader seat
  ran. The board reader's sentence splitter breaks at a dash; that defect
  needs a fix and a zero-call re-read of the Phase 0 counts before Phase 2 is
  written. Phase 2 does not open. Report:
  `notes/2026-09-05-scoreboard-crossed-run-report.md`.
- 2026-09-05: Phase 1 ran again for world 102 under the fixed reader and
  stopped on its defect rule a second time, at 22 of 24 dialogues started. This
  time the sentence was read whole; the hedge that would clear it sits in the
  next sentence. Its outcome rule fired on the 36 dialogues that stand. No
  reader seat ran. Phase 2 does not open. The next step needs a ruling on the
  reader's hedge scope and a new word. Report: the second-run section of
  `notes/2026-09-05-scoreboard-crossed-run-report.md`.
- 2026-09-05: the user ruled that a hedge in the next sentence covers the
  sentence before it. The Phase 0 reader is changed in place under that rule,
  and the Phase 0 counts hold with zero calls (both bars unchanged). Under
  the ruled reader the stopped turn of the second Phase 1 run passes the
  licence audit, so the board tutor in that run made no unlicensed move.
  Phase 2 does not open. A third run of world 102 waits on a new word.
- 2026-09-05: the third run of the world-102 overconfident cell ran to the
  end on the user's word of 19:06 UTC, with no stop, and the reader seats ran
  over the 48 dialogues (Luna, 192 calls, 0 failed). Phase 1 is done. Kill 1
  FIRED on the 48: the board tutor is not above the blind tutor on either
  shape's channel (1 of 12 against 1 of 12; 5 of 12 against 6 of 12). Kill 2
  did not fire: the board tutor made no move outside its licence in its 192
  audited turns. Endpoint 2 went one way on each shape (98% against 88%, with
  no challenge from either tutor; 47% against 53%). The result is a conduct
  claim: the board held the tutor inside its licence while the outcome
  measure did not move. Sonnet 5 held the tutor, learner and analyzer seats
  and Luna the reader seats; the second-model check did not run. Phase 2 does
  not open. Report: the third-run section of
  `notes/2026-09-05-scoreboard-crossed-run-report.md`.
