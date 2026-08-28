---
id: adaptive-tutor-canonical-kernel-contract
title: Declare the canonical adaptive-tutor kernel and adapter boundaries
status: triaged
type: infra
priority: P1
owner: unassigned
source: review
created: 2026-08-28
updated: 2026-08-28
verification: The current closed-loop adaptive kernel and each tutor-stub,
  derivation, and curriculum surface have one documented state-to-action-to-
  guard-to-realization-to-outcome contract; the stale canonical-plan claim is
  reconciled; focused seam tests prove adapters do not fork policy semantics.
claim_status: methods
links:
  notes:
    - ADAPTIVE-TUTOR-ACTIVE-PLAN.md
    - PLAN_4_0/2026-07-11-adaptive-tutor-implementation-plan.md
    - notes/2026-08-03-adaptive-causality-living-log.md
  code:
    - services/adaptiveTutor/graph.js
    - services/adaptiveTutor/actionPolicy.js
    - services/adaptiveTutor/interventionLedger.js
    - services/adaptiveTutor/outcomeObserver.js
    - services/adaptiveTutor/tutorStubActionAdapter.js
  items:
    - adaptive-curriculum-memory-controller
    - adaptive-eval-resume-and-shared-budget-scope
    - tutor-stub-unified-session-surface
tags:
  - adaptive-tutor
  - architecture
  - integration
  - methods
---

Turn the presently strongest closed-loop implementation into the explicit
kernel contract for adaptive tutoring. Treat tutor-stub, dramatic derivation,
and curriculum work as adapters or experimental surfaces around that contract,
not as separate policy engines.

## Acceptance

- Name the canonical kernel and its stable state, action, guard, realization,
  observation, and ledger interfaces.
- Reconcile or retire the self-declared canonical status in
  `ADAPTIVE-TUTOR-ACTIVE-PLAN.md` against the later Plan 2 implementation and
  adaptive-causality living log.
- Map every active surface to the kernel contract and identify any intentional
  experimental divergence explicitly.
- Add focused contract coverage at the seams where surface-specific adapters
  could otherwise fork policy, guard, or outcome semantics.
- Preserve historical cells and results unchanged; this is zero-call
  architecture and methods work, not new efficacy evidence.
