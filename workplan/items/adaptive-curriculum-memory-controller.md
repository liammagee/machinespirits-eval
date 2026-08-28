---
id: adaptive-curriculum-memory-controller
title: Evidence-anchored memory and curriculum adaptation controller
status: active
type: research
priority: P2
owner: claude
source: review
created: 2026-07-11
updated: 2026-08-27
verification: "A versioned evidence-anchored memory and task controller reuses the archived task/mastery scaffolds, passes stale/contradictory/irrelevant-memory controls, and improves independent work or transfer rather than assisted closure alone on held-out worlds."
claim_status: planned
depends_on:
  - tutor-stub-multiworld-policy-replication
  - tutor-stub-transition-reward-model
links:
  notes:
    - PLAN_4_0/2026-07-11-adaptive-tutor-implementation-plan.md
  items:
    - layered-task-session-adaptation
tags:
  - adaptive-tutor
  - memory
  - curriculum
  - transfer
milestone: adaptive-tutor-evidence-v1
---

Implement Phase 6 only after within-dialogue adaptation and cautious learned
ranking pass. Memory entries require evidence, validity, supersession,
contradiction, and retrieval reasons; stale memory must be an explicit control.

## Log

- 2026-08-27: Reopened for reexamination on operator instruction. The card
  was blocked on a killed prerequisite (the learned transition-ranking
  model), and the reexamination question is whether the controller needs
  that prerequisite at all. What we now know cuts both ways: adaptivity
  gains come from new signal the model cannot infer, not from re-encoding
  what it already infers; the delivered-move studies show value lives in
  machinery that issues the right move at a detected moment, not in a
  learned layer; and the Writing Pad already records intervention use but
  never the outcome (see `writing-pad-intervention-outcomes`). First step
  is zero-call: rewrite this card's design against the current evidence —
  what signal a cross-dialogue memory would add, what would count as the
  stale/contradictory-memory control, and what endpoint would show
  unassisted improvement — before any build or run.
