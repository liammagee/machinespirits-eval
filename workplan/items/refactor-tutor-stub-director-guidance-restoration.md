---
id: refactor-tutor-stub-director-guidance-restoration
title: Refactor tutor-stub director guidance restoration
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: 15 focused command/director assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve latest-snapshot precedence, clear boundary, cloning, empty reset, restored flag, revision, and active status
branch: codex/refactor-tutor-stub-director-guidance-restoration
claim_status: planned
depends_on:
  - refactor-tutor-stub-comprehension-restoration
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubDirectorGuidance.js
    - scripts/tutor-stub.js
    - tests/tutorStubCommandRegistry.test.js
  prs:
    - 421
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-comprehension-restoration
tags:
  - refactoring
  - tutor-stub
  - director
  - persistence
milestone: evaluation-infrastructure
---

Fifty-loop run 47: move director-guidance restoration after history-clear
boundaries into the director-guidance service.

Acceptance:

- Latest-snapshot precedence, last-clear boundary, cloning, empty reset,
  restored flag, revision, and active status remain exact.
- Trace loading, state creation, persistence, runtime sequencing, and effects
  remain in the CLI.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing guidance setting/clearing, history-clear semantics, or resume flow.

Log:

- 2026-07-28 — Started the bounded director-guidance restoration extraction.
- 2026-07-28 — Moved director-guidance restoration after history-clear
  boundaries into the director-guidance service, reducing
  `scripts/tutor-stub.js` by sixteen lines. Fifteen focused assertions,
  complete zero-skip hermetic parity, and all static/source-only gates pass.
- 2026-07-28 — Opened PR #421 against `main`. The benchmark hook reported the
  standing calibration warning: baseline already failed and all six saved
  responses remain identical (zero improved, zero regressed, zero model calls).
