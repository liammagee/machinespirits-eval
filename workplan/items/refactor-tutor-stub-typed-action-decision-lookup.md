---
id: refactor-tutor-stub-typed-action-decision-lookup
title: Refactor tutor-stub typed-action decision lookup
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-08-04
verification: 3 focused typed-action lookup assertions, synchronized hermetic manifest, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve modern, legacy, and register precedence, reference identity, invalid filtering, contract-ID requirement, and null fallback
branch: codex/refactor-tutor-stub-typed-action-decision-lookup
claim_status: planned
depends_on:
  - refactor-tutor-stub-director-guidance-restoration
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubTypedActionRestoration.js
    - scripts/tutor-stub.js
    - tests/tutorStubTypedActionRestoration.test.js
  prs:
    - 422
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-director-guidance-restoration
tags:
  - refactoring
  - tutor-stub
  - typed-action
  - compatibility
milestone: evaluation-infrastructure
---

Fifty-loop run 48: move legacy-compatible typed-action decision lookup from
saved turns into a focused restoration service.

Acceptance:

- Modern, legacy, and register-selection precedence, reference identity,
  invalid-candidate filtering, contract-ID requirement, and null fallback
  remain exact.
- Ledger reconstruction, lifecycle validation, trace loading, runtime state,
  and effects remain in the CLI.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing typed-action schemas, ledger restoration, lifecycle policy, or
  resume flow.

Log:

- 2026-07-28 — Started the bounded typed-action decision-lookup extraction.
- 2026-07-28 — Moved legacy-compatible typed-action decision lookup from saved
  turns into a focused restoration service, reducing `scripts/tutor-stub.js`
  by eight lines. Three focused assertions, synchronized hermetic inventory,
  complete zero-skip hermetic parity, and all static/source-only gates pass.
- 2026-07-28 — Opened PR #422 against `main`. The benchmark hook reported the
  standing calibration warning: baseline already failed and all six saved
  responses remain identical (zero improved, zero regressed, zero model calls).
