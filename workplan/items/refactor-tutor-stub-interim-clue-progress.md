---
id: refactor-tutor-stub-interim-clue-progress
title: Refactor tutor-stub interim clue progress summary
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: 22 focused interim-presentation assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve supplied snapshots, lazy construction, release timing, exhausted scheduling, and null handling
branch: codex/refactor-tutor-stub-interim-clue-progress
claim_status: planned
depends_on:
  - refactor-tutor-stub-interim-evidence-timing
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubInterimPresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubInterimPresentation.test.js
  prs:
    - 396
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-interim-evidence-timing
tags:
  - refactoring
  - tutor-stub
  - interim-ui
  - clue-progress
milestone: evaluation-infrastructure
---

Fifty-loop run 22: move deterministic interim clue-progress summary projection
beside the other interim UI projections.

Acceptance:

- Supplied snapshots, lazy snapshot construction, release timing, exhausted
  scheduling, and null handling remain exact.
- DAG snapshot construction, runtime state, and effects remain in their current
  owners.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing DAG construction, release scheduling, or animation panels.

Log:

- 2026-07-28 — Moved clue-progress summary projection beside the other interim
  UI projections, reducing `scripts/tutor-stub.js` by six lines. Twenty-two
  focused assertions, complete zero-skip hermetic parity, and all
  static/source-only gates pass.
- 2026-07-28 — Opened PR #396 against `main`; the benchmark hook correctly
  classified the interim-projection slice as not response-generation relevant.
