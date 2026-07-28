---
id: refactor-tutor-stub-current-release-rows
title: Refactor tutor-stub current release rows
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: 16 focused release-pacing assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve paced due rows, authored fallback, point-of-action suppression, release metadata, invalid turns, and missing-world behavior
branch: codex/refactor-tutor-stub-current-release-rows
claim_status: planned
depends_on:
  - refactor-tutor-stub-committed-release-rows
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
    - refactor-tutor-stub-committed-release-rows
tags:
  - refactoring
  - tutor-stub
  - release-pacing
  - public-evidence
milestone: evaluation-infrastructure
---

Fifty-loop run 26: move current-turn release-row selection into the
release-pacing service while keeping public projection explicit.

Acceptance:

- Paced due rows, authored fallback, point-of-action suppression, release
  metadata, invalid turns, and missing-world behavior remain exact.
- Release scheduling, public premise semantics, runtime state, and effects
  remain unchanged.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing release timing, point-of-action policy, or public evidence contents.

Log:

- 2026-07-28 — Moved current release-row selection into the release-pacing
  service, reducing `scripts/tutor-stub.js` by 30 lines. Sixteen focused
  assertions, complete zero-skip hermetic parity, and all static/source-only
  gates pass.
