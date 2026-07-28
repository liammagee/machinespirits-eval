---
id: refactor-tutor-stub-guard-spans
title: Refactor tutor-stub guard spans
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: focused 26/26; hermetic root 7431/7431 across 546 files and tutor-core 137/137, zero skips; source-only workplan, manifest, lint, format, cycle, refs, syntax, and diff gates pass
branch: codex/refactor-tutor-stub-guard-spans
claim_status: planned
depends_on:
  - refactor-tutor-stub-register-palette
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubGuardSpanProjection.js
    - scripts/tutor-stub.js
    - tests/tutorStubGuardSpanProjection.test.js
    - tests/tutorStubGuardAccounting.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-register-palette
tags:
  - refactoring
  - tutor-stub
  - guard
  - projection
milestone: evaluation-infrastructure
---

Second-loop run 2: move deterministic guard-span projection into a
dependency-free owner, with already-evaluated issue rows injected. Retain guard
evaluation, repair, accounting, runtime state, and effects in existing owners.

Acceptance:

- Literal matches, closure-question fallback, insertion points,
  whole-candidate fallback, UTF-16 offsets, de-duplication, and sorting remain
  exact.
- Candidate text and issue-row inputs remain unchanged.
- The CLI strictly shrinks while evaluation, repair, accounting, state, and
  effects stay in their current owners.
- Focused/full hermetic, manifest, lint, formatting, cycle, source-only
  workplan, syntax, ref-status, and diff gates pass.

Out of scope:

- Changing guard findings, repair behavior, accounting schemas, candidate
  selection, or model behavior.

Log:

- 2026-07-28 — Activated from PR #350's reviewed head at `f44dbe41`; the
  24,816-line CLI still owned deterministic guard-span projection.
- 2026-07-28 — Extracted the 93-line dependency-free guard-span projector and
  pinned literal matches, closure fallback, insertion points, whole-candidate
  fallback, sorting, and de-duplication directly. The CLI shrank by 89 lines;
  26 focused, 7,431 root, and 137 tutor-core assertions pass with zero skips,
  together with every static and source-only gate.
