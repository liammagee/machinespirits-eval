---
id: refactor-tutor-stub-turn-attempt-guard
title: Refactor tutor-stub turn-attempt guard
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: 3 focused turn-attempt assertions, synchronized hermetic manifest, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve error identity, signal precedence, callback short-circuiting, call count, and no-op behavior
branch: codex/refactor-tutor-stub-turn-attempt-guard
claim_status: planned
depends_on:
  - refactor-tutor-stub-current-debug-reporter
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubTurnAttempt.js
    - scripts/tutor-stub.js
    - tests/tutorStubTurnAttempt.test.js
  prs:
    - 418
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-current-debug-reporter
tags:
  - refactoring
  - tutor-stub
  - cancellation
  - lifecycle
milestone: evaluation-infrastructure
---

Fifty-loop run 44: move tutor-turn supersession error/currentness guards into a
focused service.

Acceptance:

- Default/custom error identity, signal precedence, callback short-circuiting,
  callback call count, and no-op behavior remain exact.
- Abort-controller creation, cancellation timing, runtime state, and effects
  remain in the CLI.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing cancellation policy, abort-controller ownership, or turn flow.

Log:

- 2026-07-28 — Started the bounded turn-attempt guard extraction.
- 2026-07-28 — Moved tutor-turn supersession error/currentness guards into a
  focused service, reducing `scripts/tutor-stub.js` by twelve lines. Lint
  removed an obsolete constructor import before a clean complete rerun; three
  focused assertions, synchronized hermetic inventory, zero-skip hermetic
  parity, and all static/source-only gates pass.
- 2026-07-28 — Opened PR #418 against `main`. The benchmark hook reported the
  standing calibration warning: baseline already failed and all six saved
  responses remain identical (zero improved, zero regressed, zero model calls).
