---
id: refactor-tutor-stub-technical-debug-print-gate
title: Refactor tutor-stub technical debug print gate
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: 10 focused debug-identity assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve disabled/enabled dispatch, state and callback identity, call count, and return values
branch: codex/refactor-tutor-stub-technical-debug-print-gate
claim_status: planned
depends_on:
  - refactor-tutor-stub-debug-id-line
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubDebugIdentity.js
    - scripts/tutor-stub.js
    - tests/tutorStubDebugIdentity.test.js
  prs: []
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-debug-id-line
tags:
  - refactoring
  - tutor-stub
  - debug
  - presentation
milestone: evaluation-infrastructure
---

Fifty-loop run 39: move the automatic technical-details print gate behind an
injected state-aware printer in the debug-identity service.

Acceptance:

- Disabled and enabled gate results, state identity, render callback identity,
  and print-call count remain exact.
- Concurrent-terminal printing, broader debug rendering, runtime state, and
  effects remain injected or in the CLI.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing debug settings, formats, terminal concurrency, or rendered content.

Log:

- 2026-07-28 — Started the bounded technical debug print-gate extraction.
- 2026-07-28 — Moved the automatic technical-details print gate behind an
  injected state-aware printer in the debug-identity service, reducing
  `scripts/tutor-stub.js` by one line. Ten focused assertions, complete
  zero-skip hermetic parity, and all static/source-only gates pass.
