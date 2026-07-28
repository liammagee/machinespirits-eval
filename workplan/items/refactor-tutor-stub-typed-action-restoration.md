---
id: refactor-tutor-stub-typed-action-restoration
title: Refactor tutor-stub typed-action restoration
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: 7 focused typed-action restoration assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve disabled/empty states, clear boundary, event/turn precedence, closed dominance, cloning, pending/provenance/lifecycle failures, state updates, and summary fields
branch: codex/refactor-tutor-stub-typed-action-restoration
claim_status: planned
depends_on:
  - refactor-tutor-stub-typed-action-decision-lookup
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubTypedActionRestoration.js
    - scripts/tutor-stub.js
    - tests/tutorStubTypedActionRestoration.test.js
  prs: []
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-typed-action-decision-lookup
tags:
  - refactoring
  - tutor-stub
  - typed-action
  - persistence
milestone: evaluation-infrastructure
---

Fifty-loop run 49: move typed-action ledger and scaffold-lifecycle restoration
into the focused restoration service.

Acceptance:

- Disabled/empty states, history-clear boundary, event/turn precedence, closed
  record dominance, cloning, single-pending enforcement, provenance checks,
  lifecycle synthesis/validation, mismatch failures, state updates, and summary
  fields remain exact.
- Trace loading, state creation, persistence, runtime sequencing, and live
  typed-action effects remain in the CLI.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing typed-action schemas, intervention policy, lifecycle transitions,
  or resume flow.

Log:

- 2026-07-28 — Started the bounded typed-action restoration extraction.
- 2026-07-28 — Moved typed-action ledger and scaffold-lifecycle restoration
  into the focused restoration service, reducing `scripts/tutor-stub.js` by
  one hundred eight lines. Seven focused assertions, complete zero-skip
  hermetic parity, and all static/source-only gates pass.
