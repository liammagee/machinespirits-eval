---
id: refactor-tutor-stub-technical-debug-predicate
title: Refactor tutor-stub technical debug predicate
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: 8 focused debug-identity assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve missing state, disabled debug, missing and non-technical formats, and enabled technical behavior
branch: codex/refactor-tutor-stub-technical-debug-predicate
claim_status: planned
depends_on:
  - refactor-tutor-stub-state-debug-identity
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
    - refactor-tutor-stub-state-debug-identity
tags:
  - refactoring
  - tutor-stub
  - debug
  - configuration
milestone: evaluation-infrastructure
---

Fifty-loop run 37: move the automatic technical-details predicate into the
debug-identity service.

Acceptance:

- Missing state, disabled debug, missing/non-technical format, and enabled
  technical behavior remain exact.
- Debug printing, clipboard operations, runtime state, and effects remain in
  the CLI.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing debug settings, formats, printing, or clipboard behavior.

Log:

- 2026-07-28 — Moved the automatic technical-details predicate into the
  debug-identity service, reducing `scripts/tutor-stub.js` by three lines.
  Eight focused assertions, complete zero-skip hermetic parity, and all
  static/source-only gates pass.
