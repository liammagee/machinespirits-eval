---
id: refactor-tutor-stub-interim-objective-summary
title: Refactor tutor-stub interim objective summary
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: 19 focused interim-presentation assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve activation, bottleneck/target precedence, register fallback, clue plurality, text bounds, and null handling
branch: codex/refactor-tutor-stub-interim-objective-summary
claim_status: planned
depends_on:
  - refactor-tutor-stub-interim-learner-record
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubInterimPresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubInterimPresentation.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-interim-learner-record
tags:
  - refactoring
  - tutor-stub
  - interim-ui
  - objectives
milestone: evaluation-infrastructure
---

Fifty-loop run 19: move deterministic pending objective summary projection
beside interim bottleneck and compaction primitives.

Acceptance:

- Activation, bottleneck/target precedence, register fallback, clue plurality,
  text bounds, and null handling remain exact.
- Release-row computation, classification, register selection, runtime state,
  and effects remain in their current owners.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing objective selection, release pacing, or animation panels.

Log:

- 2026-07-28 — Moved pending objective summary projection beside interim
  bottleneck/compaction primitives, reducing `scripts/tutor-stub.js` by 23
  lines. Nineteen focused assertions, complete zero-skip hermetic parity, and
  all static/source-only gates pass.
