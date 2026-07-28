---
id: refactor-tutor-stub-debug-id-line
title: Refactor tutor-stub debug ID line
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: 9 focused debug-identity assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve missing IDs, first-print formatting, duplicate suppression, labels, colors, return values, and printed-ID state
branch: codex/refactor-tutor-stub-debug-id-line
claim_status: planned
depends_on:
  - refactor-tutor-stub-technical-debug-predicate
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
    - refactor-tutor-stub-technical-debug-predicate
tags:
  - refactoring
  - tutor-stub
  - debug
  - presentation
milestone: evaluation-infrastructure
---

Fifty-loop run 38: move debug-ID de-duplication and line formatting behind an
injected writer in the debug-identity service.

Acceptance:

- Missing IDs, first-print formatting, duplicate suppression, default/custom
  labels, colors, return values, and printed-ID state remain exact.
- Console writing, broader debug printing, clipboard operations, runtime state,
  and effects remain injected or in the CLI.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing debug-ID formats, terminal colors, printing, or clipboard behavior.

Log:

- 2026-07-28 — Started the bounded debug-ID line extraction.
- 2026-07-28 — Moved debug-ID de-duplication and line formatting behind an
  injected writer in the debug-identity service, reducing
  `scripts/tutor-stub.js` by two lines. Nine focused assertions, complete
  zero-skip hermetic parity, and all static/source-only gates pass.
