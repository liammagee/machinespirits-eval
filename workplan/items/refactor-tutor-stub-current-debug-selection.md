---
id: refactor-tutor-stub-current-debug-selection
title: Refactor tutor-stub current debug selection
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-08-04
verification: 11 focused debug-identity assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve run, opening, completed-turn, active-turn, selected-ID, trace-path, and displayed last-turn precedence
branch: codex/refactor-tutor-stub-current-debug-selection
claim_status: planned
depends_on:
  - refactor-tutor-stub-technical-debug-print-gate
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubDebugIdentity.js
    - scripts/tutor-stub.js
    - tests/tutorStubDebugIdentity.test.js
  prs:
    - 414
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-technical-debug-print-gate
tags:
  - refactoring
  - tutor-stub
  - debug
  - projection
milestone: evaluation-infrastructure
---

Fifty-loop run 40: move current debug-ID selection into a pure debug-identity
projection.

Acceptance:

- Run, opening, completed-turn, active-turn, selected-ID, trace-path, and
  displayed last-turn precedence remain exact.
- Clipboard access, clipboard text formatting, terminal writes, runtime state,
  and effects remain in the CLI.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing debug-ID formats, clipboard behavior, or terminal copy.

Log:

- 2026-07-28 — Started the bounded current debug-selection extraction.
- 2026-07-28 — Moved current debug-ID selection into a pure debug-identity
  projection, reducing `scripts/tutor-stub.js` by three lines. Eleven focused
  assertions, complete zero-skip hermetic parity, and all static/source-only
  gates pass.
- 2026-07-28 — Opened PR #414 against `main`. The benchmark hook reported the
  standing calibration warning: baseline already failed and all six saved
  responses remain identical (zero improved, zero regressed, zero model calls).
