---
id: refactor-tutor-stub-interim-state-holder
title: Refactor tutor-stub interim state holder
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: 12 focused interim-presentation assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve initial shape, direct/nested resolution, precedence, and null handling
branch: codex/refactor-tutor-stub-interim-state-holder
claim_status: planned
depends_on:
  - refactor-tutor-stub-learner-advance-classification
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubInterimPresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubInterimPresentation.test.js
  prs:
    - 386
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-learner-advance-classification
tags:
  - refactoring
  - tutor-stub
  - interim-ui
milestone: evaluation-infrastructure
---

Fifty-loop run 12: move deterministic interim-state creation and holder
resolution beside the existing interim presentation primitives.

Acceptance:

- Initial shape, direct/nested holder resolution, direct-state precedence, and
  null handling remain exact.
- TTY checks, animation timers, runtime state, terminal writes, and effects
  remain in their current owners.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing animation availability, panel content, timing, or terminal behavior.

Log:

- 2026-07-28 — Moved interim-state creation and holder resolution beside the
  existing interim presentation primitives, reducing `scripts/tutor-stub.js`
  by 13 lines. Twelve focused assertions, complete zero-skip hermetic parity,
  and all static/source-only gates pass.
- 2026-07-28 — Opened PR #386 against `main`; the benchmark hook correctly
  classified the state-holder slice as not response-generation relevant.
