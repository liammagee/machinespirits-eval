---
id: refactor-tutor-stub-previous-learner-dag
title: Refactor tutor-stub previous learner-DAG lookup
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: 13 focused interim-presentation assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve immediate preceding-turn selection, current-turn exclusion, undefined-model behavior, unbounded lookup, and empty state
branch: codex/refactor-tutor-stub-previous-learner-dag
claim_status: planned
depends_on:
  - refactor-tutor-stub-interim-state-holder
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubInterimPresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubInterimPresentation.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-interim-state-holder
tags:
  - refactoring
  - tutor-stub
  - interim-ui
  - learner-dag
milestone: evaluation-infrastructure
---

Fifty-loop run 13: move deterministic previous learner-DAG lookup beside the
interim projections that consume it.

Acceptance:

- Immediate preceding-turn selection, current-turn exclusion, undefined-model
  behavior, unbounded lookup, and empty state remain exact.
- DAG construction, interim summaries, runtime state, and effects remain in
  their current owners.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing learner-DAG history, turn numbering, or interim summary content.

Log:

- 2026-07-28 — Moved previous learner-DAG lookup beside interim projections,
  reducing `scripts/tutor-stub.js` by five lines. The first focused fixture
  exposed and now pins the existing immediate-predecessor/undefined-model
  contract; 13 focused assertions, complete zero-skip hermetic parity, and all
  static/source-only gates pass.
