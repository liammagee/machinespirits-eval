---
id: refactor-tutor-stub-register-state-restoration
title: Refactor tutor-stub register state restoration
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: 4 focused register-restoration assertions, synchronized hermetic manifest, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve disabled no-op, filtering, replacement, efficacy attachment, sorting, cloning, empty reset, restored count, and current selection
branch: codex/refactor-tutor-stub-register-state-restoration
claim_status: planned
depends_on:
  - refactor-tutor-stub-turn-attempt-guard
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubRegisterStateRestoration.js
    - scripts/tutor-stub.js
    - tests/tutorStubRegisterStateRestoration.test.js
  prs: []
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-turn-attempt-guard
tags:
  - refactoring
  - tutor-stub
  - register
  - persistence
milestone: evaluation-infrastructure
---

Fifty-loop run 45: move register-state restoration from saved turns into a
focused service.

Acceptance:

- Disabled no-op, invalid filtering, duplicate replacement, efficacy
  attachment/non-overwrite, sorting, cloning, empty reset, restored count, and
  current selection remain exact.
- Trace loading, state creation, persistence, runtime sequencing, and effects
  remain in the CLI.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing register selection, efficacy scoring, trace schema, or resume flow.

Log:

- 2026-07-28 — Started the bounded register-state restoration extraction.
- 2026-07-28 — Moved register-state restoration from saved turns into a
  focused service, reducing `scripts/tutor-stub.js` by twenty-one lines. Four
  focused assertions, synchronized hermetic inventory, complete zero-skip
  hermetic parity, and all static/source-only gates pass.
