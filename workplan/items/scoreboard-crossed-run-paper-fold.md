---
id: scoreboard-crossed-run-paper-fold
title: Fold the scoreboard Phase 0 and Phase 1 results into the paper
status: done
type: paper
priority: P1
owner: claude
source: manual
created: 2026-09-05
updated: 2026-09-05
claim_status: killed
branch: claude/recovery-prompt-premise-id
verification: >-
  Paper v3.0.307 carries a new §6.31 that reports the Phase 0 replay and the
  Phase 1 crossed run from the two sealed report notes, with a revision-history
  entry. Every number in the section traces to a report note. The claim audit
  passes. The plan note and the plan-line card stay in step at the new version.
links:
  items:
    - scoreboard-reader-replay-and-crossed-run
    - one-adaptive-tutor-plan-line
  paper:
    - docs/research/paper-full-2.0.md#631-one-public-score-for-every-learner-shape-the-board-reads-the-shapes-on-sealed-archives-holds-the-live-tutor-inside-its-licence-and-does-not-move-either-shapes-channel-pre-registered-gate-arc-development-tier
  notes:
    - notes/2026-09-05-scoreboard-replay-report.md
    - notes/2026-09-05-scoreboard-crossed-run-report.md
    - notes/2026-09-05-scoreboard-crossed-run-go.md
    - notes/2026-09-04-adaptive-tutor-plan.md
---

**What this is.**

The Phase 5 card for the first fold of the plan in
`notes/2026-09-04-adaptive-tutor-plan.md`: one card per fold. It takes the
Phase 0 report and the Phase 1 report and puts them in the paper. No new
study, no rescoring, no learner claim, no abstract change.

**What landed.**

- A new results section, §6.31, after §6.30. It reports Phase 0 (the board
  reader over 726 sealed dialogues, zero calls, both bars met pooled, the
  held-out pairwise bar missed by one dialogue) and Phase 1 (48 dialogues,
  two shapes, board tutor against blind tutor, Kill 1 fired, Kill 2 not
  fired, 0 unlicensed board-tutor moves against 3 for the blind tutor). It
  ends with the standing status paragraph and the provenance list.
- The section is new rather than an extension of one earlier section because
  the result spans §6.24 to §6.30 and has its own registered endpoints and
  kill rules. The paper gives each such arc its own section.
- Version 3.0.306 to 3.0.307 with an Appendix F entry dated 2026-09-05.
- Not in this fold: the framing folds the blueprint lists for §3, §7.12,
  §7.16, Appendix E, the `/theory` surface and the build guide. Those are
  theory additions, not results of this run, and each gets its own Phase 5
  card when the user opens it.

**Log.**

- 2026-09-05: opened and closed in one session on the user's word ("close
  the card and update the paper"). Section written from the two report notes
  and the GO note. Four facts corrected against the source before splice:
  the ten field names read from the reader's field list; the human seat
  points at §8.1 and the IRB-gated pilot; the model-bound rule is quoted, not
  cited to a section the paper does not have; the per-run call split is
  dropped because the report gives the first run as 990 calls where the
  ledger total implies 991.
- 2026-09-05: a claim audit of the drafted section found three more items,
  and all three are fixed. The sealed dialogue count reads 726, from
  `summary.json` and the replay report; the earlier 729 counted three
  quiet-card boards that hold no dialogue, and the crossed-run report note
  carries the same correction. `withdrawn` is a value of the debt field, so
  it is out of the entitlement list. The licence list now names the rights
  the reader records, and the section says that the runtime gates only the
  challenge right and the close right, which is what
  `services/tutorStubScoreboardPolicy.js` audits.
