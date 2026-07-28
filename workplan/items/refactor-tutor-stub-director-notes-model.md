---
id: refactor-tutor-stub-director-notes-model
title: Refactor tutor-stub director notes model
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: focused 7/7 including byte-exact live Marrick fixtures plus full hermetic root and tutor-core zero-skip contracts preserve opening withholding and issued scene notes; every static and source-only gate passes
branch: codex/refactor-tutor-stub-director-notes-model
claim_status: planned
depends_on:
  - refactor-tutor-stub-generous-fallback
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubDirectorPresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubDirectorPresentation.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-generous-fallback
tags:
  - refactoring
  - tutor-stub
  - director
milestone: evaluation-infrastructure
---

Third-loop run 7: move deterministic issued-director-note state projection
beside its existing terminal presentation, injecting the CLI-owned release-row
selector and clone operation.

Acceptance:

- Opening issuance/withholding, through-turn count, director-only filtering,
  trimming, cloning, schema, order, and live terminal bytes remain exact.
- Opening/release effects, traces, terminal writes, slash dispatch, and state
  ownership remain unchanged.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing which director notes are issued or when they become public.

Log:

- 2026-07-28 — Bound the director-notes state model to the CLI-owned release
  selector and clone operation, reducing the CLI by 15 lines. Seven focused
  assertions and the complete zero-skip hermetic contract pass.
