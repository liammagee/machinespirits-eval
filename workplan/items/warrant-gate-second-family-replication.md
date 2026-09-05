---
id: warrant-gate-second-family-replication
title: "Replicate the passive warrant-gate main block on a second model family"
status: active
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-09-04
updated: 2026-09-04
branch: claude/warrant-gate-second-family-replication
verification: "Zero-call setup only so far: card, registration, manifest, plain launcher, dry run and tests. No paid call has run. The paid block waits on the user writing GO in chat; no GO note is needed."
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

- [ ] Registration and manifest fix worlds, conditions, seeds 736-747, seats,
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
