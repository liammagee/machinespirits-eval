---
id: refactor-tutor-stub-next-release-row
title: Refactor tutor-stub next release row projection
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: 14 focused release-pacing assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve pending, exhausted, missing-world, normalized-number, trimmed-surface, fact, and release-source behavior
branch: codex/refactor-tutor-stub-next-release-row
claim_status: planned
depends_on:
  - refactor-tutor-stub-interim-dialogue-outlook
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubReleasePacing.js
    - scripts/tutor-stub.js
    - tests/tutorStubReleasePacing.test.js
  prs: []
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-interim-dialogue-outlook
tags:
  - refactoring
  - tutor-stub
  - release-pacing
  - projection
milestone: evaluation-infrastructure
---

Fifty-loop run 24: move next-release row projection into the release-pacing
service that owns the schedule snapshot.

Acceptance:

- Pending, exhausted, missing-world, number normalization, surface trimming,
  fact, and release-source behavior remain exact.
- Release scheduling, runtime state, and effects remain unchanged.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing release timing, pacing policy, or public evidence semantics.

Log:

- 2026-07-28 — Moved next-release row projection into the release-pacing
  service, reducing `scripts/tutor-stub.js` by 12 lines. Fourteen focused
  assertions, complete zero-skip hermetic parity, and all static/source-only
  gates pass.
