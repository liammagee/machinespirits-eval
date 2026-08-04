---
id: refactor-tutor-stub-debug-line-printers
title: Refactor tutor-stub debug line printers
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-08-04
verification: 12 focused debug-identity assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve technical gating, turn/opening IDs, duplicate suppression, return values, and live color updates
branch: codex/refactor-tutor-stub-debug-line-printers
claim_status: planned
depends_on:
  - refactor-tutor-stub-current-debug-selection
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubDebugIdentity.js
    - scripts/tutor-stub.js
    - tests/tutorStubDebugIdentity.test.js
  prs:
    - 415
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-current-debug-selection
tags:
  - refactoring
  - tutor-stub
  - debug
  - presentation
milestone: evaluation-infrastructure
---

Fifty-loop run 41: centralize the technical turn/opening debug-line printers
behind injected output and live color adapters.

Acceptance:

- Technical gating, turn/opening IDs, duplicate suppression, return values, and
  live color updates remain exact.
- Console output, color-state ownership, concurrent-terminal orchestration,
  runtime state, and effects remain injected or in the CLI.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing debug settings, ID formats, terminal colors, or call timing.

Log:

- 2026-07-28 — Started the bounded debug-line-printer extraction.
- 2026-07-28 — Centralized the technical turn/opening debug-line printers
  behind injected output and live color adapters, reducing
  `scripts/tutor-stub.js` by twelve lines. Twelve focused assertions, complete
  zero-skip hermetic parity, and all static/source-only gates pass.
- 2026-07-28 — Opened PR #415 against `main`. The benchmark hook reported the
  standing calibration warning: baseline already failed and all six saved
  responses remain identical (zero improved, zero regressed, zero model calls).
