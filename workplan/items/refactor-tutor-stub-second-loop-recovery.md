---
id: refactor-tutor-stub-second-loop-recovery
title: Recover tutor-stub second refactor loop onto main
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: the eight reviewed missing slices replay cleanly onto current main; full hermetic root and tutor-core contracts pass with zero skips, together with source-only workplan, manifest, lint, format, cycle, refs, syntax, commit-link, and diff gates
branch: codex/refactor-tutor-stub-second-loop-recovery
claim_status: planned
depends_on:
  - refactor-tutor-stub-guard-spans
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - scripts/tutor-stub.js
    - services/tutorStubGuardSpanProjection.js
    - services/tutorStubGuardAttemptProjection.js
    - services/tutorStubScaffoldState.js
    - services/tutorStubSideArcState.js
    - services/tutorStubWarrantPremiseAudit.js
    - services/tutorStubStrictDagAuditState.js
    - services/tutorStubDagFactDropout.js
    - services/tutorStubDagSnapshotPresentation.js
  prs:
    - 352
    - 353
    - 354
    - 355
    - 356
    - 357
    - 358
    - 359
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-repair-spans
    - refactor-tutor-stub-guard-attempt-envelope
    - refactor-tutor-stub-scaffold-state
    - refactor-tutor-stub-side-arc-state
    - refactor-tutor-stub-warrant-audit-projection
    - refactor-tutor-stub-strict-dag-audit
    - refactor-tutor-stub-dag-memory-reliability
    - refactor-tutor-stub-dag-snapshot-model
tags:
  - refactoring
  - tutor-stub
  - recovery
  - git
milestone: evaluation-infrastructure
---

PRs #352–#359 were reviewed and marked merged, but their feature-branch bases
meant the commits never became ancestors of `origin/main`. Preserve the
reviewed changes without reopening their implementation scope.

Acceptance:

- Replay only the missing reviewed implementation and reciprocal workplan-link
  commits onto current `origin/main`.
- Preserve runtime bytes, public APIs, test fixtures, generated workplan views,
  and unrelated concurrent work.
- Prove the resulting aggregate with the complete hermetic and static contract
  before using it as the base of another refactor loop.

Log:

- 2026-07-28 — Confirmed `origin/main` at `54a9accc` contains PRs #349–#351,
  while none of the implementation tips for #352–#359 are ancestors. Replayed
  the exact 16 reviewed commits without conflict; no generated board view was
  changed.
- 2026-07-28 — The complete hermetic root and tutor-core contracts pass with
  zero skips on the recovered aggregate.
