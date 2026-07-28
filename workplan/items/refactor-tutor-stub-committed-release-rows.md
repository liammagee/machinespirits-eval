---
id: refactor-tutor-stub-committed-release-rows
title: Refactor tutor-stub committed release rows
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: 15 focused release-pacing assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve pacing schedules, turn bounds, public projection, legacy fallback, and missing-world behavior
branch: codex/refactor-tutor-stub-committed-release-rows
claim_status: planned
depends_on:
  - refactor-tutor-stub-next-release-row
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
    - refactor-tutor-stub-next-release-row
tags:
  - refactoring
  - tutor-stub
  - release-pacing
  - public-evidence
milestone: evaluation-infrastructure
---

Fifty-loop run 25: move committed release-row selection into the release-pacing
service while keeping legacy fallback and public projection dependencies
explicit.

Acceptance:

- Pacing schedules, release-turn bounds, public projection, legacy no-pacing
  fallback, and missing-world behavior remain exact.
- Release scheduling, public premise semantics, runtime state, and effects
  remain unchanged.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing release timing, pacing policy, or public evidence contents.

Log:

- 2026-07-28 — Moved committed release-row selection into the release-pacing
  service, reducing `scripts/tutor-stub.js` by 15 lines. Fifteen focused
  assertions, complete zero-skip hermetic parity, and all static/source-only
  gates pass.
