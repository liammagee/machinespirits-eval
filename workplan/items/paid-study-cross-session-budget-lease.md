---
id: paid-study-cross-session-budget-lease
title: Enforce one paid-study ceiling across concurrent sessions
status: active
type: infra
priority: P0
owner: unassigned
source: review
created: 2026-08-30
updated: 2026-08-30
verification: >-
  Offline multi-process tests prove two concurrent launchers for one declared
  study cannot both become active, every initial and recovery reservation draws
  from one durable study-wide ceiling, a sealed technical stop can hand the
  lease to a missing-only continuation, and rejection happens before any model
  call. The fix adds no approval hash, source pin, or re-authorization ceremony.
claim_status: methods
depends_on:
  - shared-paid-study-launch-contract
links:
  items:
    - shared-paid-study-launch-contract
    - frame-refuser-refusal-narrowing
  code:
    - services/paidStudyLaunchContract.js
    - tests/paidStudyLaunchContract.test.js
tags:
  - paid-study
  - spend-ceiling
  - concurrency
  - recovery
  - incident
---

The frame-refuser refusal-narrowing calibration exposed a real cross-session
budget defect on 2026-08-30. Two sessions admitted the same registered study
one minute apart under different create-once destination names. Each local
ledger correctly enforced 72 attempts, but there was no shared study lease or
aggregate ledger, so the two executions consumed 144 attempts against the
user's stated maximum of 72.

This is a runtime budget defect, not an authorization-document defect. Do not
respond with request hashes, code pins, re-signatures, or a new approval
ceremony. The existing design, GO note, create-once destination, and append-only
per-destination ledger remain useful; the missing rail is atomic ownership and
accounting across destinations and processes for the same declared study.

Acceptance:

- Give each registered paid study an explicit stable study identity and an
  atomic durable launch lease acquired before provider initialization. Two
  processes racing on the same study must not both become active.
- Count reservations from the initial launch and every permitted missing-only
  recovery against one durable study-wide attempt ceiling. A recovery may take
  over only from a sealed technical predecessor and must preserve completed and
  failed units exactly.
- Keep per-destination ledgers and artifacts create-once. The study ledger
  records links to them; it does not rewrite or hide historical attempts.
- Add a real multi-process race fixture: two launchers request the same study
  concurrently, exactly one acquires the lease, the other refuses before its
  first supplied fake provider call, and aggregate reservations cannot exceed
  the declared ceiling.
- Add a recovery fixture showing a sealed partial run hands off its remaining
  budget once, while a duplicate fresh launch and a second concurrent recovery
  are rejected before a supplied fake provider call.
- Preserve the three 2026-08-30 narrowing roots byte-for-byte as the incident
  record. Do not pool their measurements or retroactively relabel either as the
  uniquely authorized run.
