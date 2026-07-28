---
id: refactor-tutor-stub-current-debug-reporter
title: Refactor tutor-stub current debug reporter
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: 14 focused debug-identity assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve the clipboard envelope and payload, line writes, selected IDs, and public return shape
branch: codex/refactor-tutor-stub-current-debug-reporter
claim_status: planned
depends_on:
  - refactor-tutor-stub-current-debug-lines
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubDebugIdentity.js
    - scripts/tutor-stub.js
    - tests/tutorStubDebugIdentity.test.js
  prs:
    - 417
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-current-debug-lines
tags:
  - refactoring
  - tutor-stub
  - debug
  - orchestration
milestone: evaluation-infrastructure
---

Fifty-loop run 43: move current debug-report orchestration behind injected
clipboard and terminal adapters.

Acceptance:

- Clipboard envelope and payload, line writes, selected IDs, and public return
  shape remain exact.
- Clipboard implementation, console implementation, live color state, runtime
  state, and effects remain injected by the CLI.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing clipboard behavior, debug selection, terminal copy, or command flow.

Log:

- 2026-07-28 — Started the bounded current debug-reporter extraction.
- 2026-07-28 — Moved current debug-report orchestration behind injected
  clipboard and terminal adapters, reducing `scripts/tutor-stub.js` by fifteen
  lines. A lint-detected unused binding was removed before a complete clean
  rerun; fourteen focused assertions, zero-skip hermetic parity, and all
  static/source-only gates pass.
- 2026-07-28 — Opened PR #417 against `main`. The benchmark hook reported the
  standing calibration warning: baseline already failed and all six saved
  responses remain identical (zero improved, zero regressed, zero model calls).
