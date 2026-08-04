---
id: refactor-tutor-stub-comprehension-restoration
title: Refactor tutor-stub comprehension restoration
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-08-04
verification: 11 focused comprehension-state assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve event precedence, schema filtering, turn fallback, after-tutor/state precedence, cloning, empty-state creation, restored flag, and term count
branch: codex/refactor-tutor-stub-comprehension-restoration
claim_status: planned
depends_on:
  - refactor-tutor-stub-register-state-restoration
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubComprehensionState.js
    - scripts/tutor-stub.js
    - services/__tests__/tutorStubComprehensionState.test.js
  prs:
    - 420
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-register-state-restoration
tags:
  - refactoring
  - tutor-stub
  - comprehension
  - persistence
milestone: evaluation-infrastructure
---

Fifty-loop run 46: move comprehension-state restoration from saved events and
turns into the comprehension-state service.

Acceptance:

- Latest valid event precedence, schema filtering, turn fallback,
  after-tutor/state precedence, cloning, empty-state creation, restored flag,
  and term count remain exact.
- Trace loading, state creation, persistence, runtime sequencing, and effects
  remain in the CLI.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing comprehension detection, state schema, trace schema, or resume flow.

Log:

- 2026-07-28 — Started the bounded comprehension-restoration extraction.
- 2026-07-28 — Moved comprehension-state restoration from saved events and
  turns into the comprehension-state service, reducing
  `scripts/tutor-stub.js` by eighteen lines. Eleven focused assertions,
  complete zero-skip hermetic parity, and all static/source-only gates pass.
- 2026-07-28 — Opened PR #420 against `main`. The benchmark hook reported the
  standing calibration warning: baseline already failed and all six saved
  responses remain identical (zero improved, zero regressed, zero model calls).
