---
id: refactor-tutor-stub-register-prior-loading
title: Refactor tutor-stub register prior loading
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-08-04
verification: 27 focused assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate pass while preserving opt-outs, path resolution, schemas, deployment statuses, and errors
branch: codex/refactor-tutor-stub-register-prior-loading
claim_status: scope-bound
depends_on:
  - refactor-tutor-stub-dag-mode
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubRegisterEmpiricalPrior.js
    - scripts/tutor-stub.js
    - tests/tutorStubRegisterEmpiricalPrior.test.js
  prs:
    - 374
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-dag-mode
tags:
  - refactoring
  - tutor-stub
  - registers
milestone: evaluation-infrastructure
---

Fifty-loop run 4: move deterministic empirical register-prior path resolution,
schema validation, and deployment-status classification into an injected model.

Acceptance:

- Opt-out aliases, explicit/auto paths, policy activation, missing files,
  v1/v2 schemas, eligibility statuses, and errors remain exact.
- Policy selection, runtime register state, filesystem location, and effects
  remain in their current owners.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing prior contents, eligibility policy, filesystem paths, or sampling.

Log:

- 2026-07-28 — Extracted injected empirical-prior path resolution and loading,
  reducing `scripts/tutor-stub.js` by 22 lines. Twenty-seven focused assertions,
  the complete zero-skip hermetic suite, and all static/source-only gates pass.
- 2026-07-28 — Opened PR #374 against `main`; the benchmark hook correctly
  classified the loading-only slice as not response-generation relevant.
