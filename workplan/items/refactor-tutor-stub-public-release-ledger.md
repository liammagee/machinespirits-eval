---
id: refactor-tutor-stub-public-release-ledger
title: Refactor tutor-stub public release ledger
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-08-04
verification: 8 focused public-evidence assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve row order, learner-visible field selection, and empty-input behavior
branch: codex/refactor-tutor-stub-public-release-ledger
claim_status: planned
depends_on:
  - refactor-tutor-stub-current-release-rows
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubPublicEvidence.js
    - scripts/tutor-stub.js
    - tests/tutorStubPublicEvidence.test.js
  prs:
    - 401
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-current-release-rows
tags:
  - refactoring
  - tutor-stub
  - public-evidence
  - ledger
milestone: evaluation-infrastructure
---

Fifty-loop run 27: move public release-ledger projection into the public-
evidence service.

Acceptance:

- Row order, learner-visible field selection, and empty-input behavior remain
  exact.
- Committed-row selection, runtime state, and effects remain unchanged.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing release timing, ledger contents, or public evidence semantics.

Log:

- 2026-07-28 — Moved public release-ledger projection into the public-evidence
  service, reducing `scripts/tutor-stub.js` by one line and removing the ledger
  shape from the CLI. Eight focused assertions, complete zero-skip hermetic
  parity, and all static/source-only gates pass.
- 2026-07-28 — Opened PR #401 against `main`. The benchmark hook reported the
  standing calibration warning: baseline already failed and all six saved
  responses remain identical (zero improved, zero regressed, zero model calls).
