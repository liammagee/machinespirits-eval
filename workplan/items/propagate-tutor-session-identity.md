---
id: propagate-tutor-session-identity
title: Propagate tutor session identity into recognition events
status: triaged
type: infra
priority: P2
owner: unassigned
source: review
created: 2026-09-03
updated: 2026-09-03
verification: "A real dialogue session identifier reaches both dialectical-negotiation and Writing-Pad recognition events, persisted events can be traced back to their dialogue without cross-session collision, and tutor/learner trace attribution stays symmetric and backward compatible."
claim_status: planned
links:
  notes:
    - tutor-core/services/tutorDialogueEngine.js
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
