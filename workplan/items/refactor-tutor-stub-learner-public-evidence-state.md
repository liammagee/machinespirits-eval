---
id: refactor-tutor-stub-learner-public-evidence-state
title: Refactor tutor-stub learner public evidence state
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: 9 focused public-evidence assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve staged-evidence and release-ledger aliases, shared-reference behavior, and empty-input behavior
branch: codex/refactor-tutor-stub-learner-public-evidence-state
claim_status: planned
depends_on:
  - refactor-tutor-stub-public-release-ledger
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubPublicEvidence.js
    - scripts/tutor-stub.js
    - tests/tutorStubPublicEvidence.test.js
  prs:
    - 402
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-public-release-ledger
tags:
  - refactoring
  - tutor-stub
  - public-evidence
  - learner-dag
milestone: evaluation-infrastructure
---

Fifty-loop run 28: move the learner public-evidence state envelope into the
public-evidence service.

Acceptance:

- Staged-evidence and release-ledger aliases, shared-reference behavior, and
  empty-input behavior remain exact.
- Committed-row selection, learner-DAG inference, runtime state, and effects
  remain unchanged.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing release rows, learner-DAG inputs, or public evidence semantics.

Log:

- 2026-07-28 — Moved the learner public-evidence state envelope into the
  public-evidence service, reducing `scripts/tutor-stub.js` by three lines.
  Nine focused assertions, complete zero-skip hermetic parity, and all
  static/source-only gates pass.
- 2026-07-28 — Opened PR #402 against `main`. The benchmark hook reported the
  standing calibration warning: baseline already failed and all six saved
  responses remain identical (zero improved, zero regressed, zero model calls).
