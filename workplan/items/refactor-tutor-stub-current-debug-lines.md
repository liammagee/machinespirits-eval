---
id: refactor-tutor-stub-current-debug-lines
title: Refactor tutor-stub current debug lines
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-08-04
verification: 13 focused debug-identity assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve line order, conditional turn rows, trace fallback, clipboard status, colors, and trailing newline
branch: codex/refactor-tutor-stub-current-debug-lines
claim_status: planned
depends_on:
  - refactor-tutor-stub-debug-line-printers
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubDebugIdentity.js
    - scripts/tutor-stub.js
    - tests/tutorStubDebugIdentity.test.js
  prs:
    - 416
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-debug-line-printers
tags:
  - refactoring
  - tutor-stub
  - debug
  - presentation
milestone: evaluation-infrastructure
---

Fifty-loop run 42: move the current debug-ID terminal line projection into the
debug-identity service.

Acceptance:

- Line order, conditional turn rows, trace fallback, clipboard status, colors,
  and trailing newline remain byte-exact.
- Clipboard access, terminal writes, runtime state, and effects remain in the
  CLI.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing clipboard behavior, debug-ID selection, or terminal copy.

Log:

- 2026-07-28 — Started the bounded current debug-line projection extraction.
- 2026-07-28 — Moved the current debug-ID terminal line projection into the
  debug-identity service, reducing `scripts/tutor-stub.js` by five lines.
  Thirteen focused assertions, complete zero-skip hermetic parity, and all
  static/source-only gates pass.
- 2026-07-28 — Opened PR #416 against `main`. The benchmark hook reported the
  standing calibration warning: baseline already failed and all six saved
  responses remain identical (zero improved, zero regressed, zero model calls).
