---
id: propagate-tutor-session-identity
title: Propagate tutor session identity into recognition events
status: done
type: infra
priority: P2
owner: codex
source: review
created: 2026-09-03
updated: 2026-09-03
branch: codex/propagate-tutor-session-identity
verification: "A real dialogue session identifier reaches both dialectical-negotiation and Writing-Pad recognition events, persisted events can be traced back to their dialogue without cross-session collision, and tutor/learner trace attribution stays symmetric and backward compatible."
claim_status: planned
links:
  notes:
    - tutor-core/services/tutorDialogueEngine.js
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/998
tags:
  - tutor-core
  - provenance
  - recognition
  - symmetry
---

Two live tutor-dialogue paths still persist recognition-related events with
`sessionId: null`. The inline TODOs date the missing work to a future phase, but
no live board item owns it. This weakens provenance and can make cross-session
Writing-Pad analysis ambiguous.

Before implementation, map the public dialogue identifier through both call
paths and decide how legacy null rows are read. Mirror any attribution change
on tutor and learner traces where the data structures are intended to be
symmetric. This is not part of the maintenance PR because the identifier is a
behavioral persistence contract, not a mechanical cleanup.

## Progress

- 2026-09-03: Threaded each public `dialogueId` through normal, retry, and
  quick-generation recognition writes; added exact-session and legacy-null
  reads; and aligned latest-session tutor/learner flow analysis. Hermetic
  tutor-core tests, lint, formatting, manifest synchronization, and workplan
  validation pass. PR #998 merged as `96d5d7f8`; card closed.
