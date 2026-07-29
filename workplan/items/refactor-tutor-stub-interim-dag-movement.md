---
id: refactor-tutor-stub-interim-dag-movement
title: Refactor tutor-stub interim DAG movement summary
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: 17 focused interim-presentation assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve feature deltas, direction/plurality, turn selection, conclusion states, and no-movement fallback
branch: codex/refactor-tutor-stub-interim-dag-movement
claim_status: planned
depends_on:
  - refactor-tutor-stub-interim-register-summary
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubInterimPresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubInterimPresentation.test.js
  prs:
    - 391
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-interim-register-summary
tags:
  - refactoring
  - tutor-stub
  - interim-ui
  - learner-dag
milestone: evaluation-infrastructure
---

Fifty-loop run 17: move deterministic learner-DAG movement summary projection
beside the interim number and history primitives it uses.

Acceptance:

- Feature deltas, direction/plurality, previous-turn selection, conclusion
  states, and the no-movement fallback remain exact.
- DAG feature construction, runtime state, and effects remain in their current
  owners.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing DAG progress features, learner history, or animation panels.

Log:

- 2026-07-28 — Moved learner-DAG movement summary projection beside interim
  number/history primitives, reducing `scripts/tutor-stub.js` by 35 lines.
  Static lint caught and removed the now-obsolete CLI lookup alias; 17 focused
  assertions, complete zero-skip hermetic parity, and all static/source-only
  gates pass.
- 2026-07-28 — Opened PR #391 against `main`; the benchmark hook correctly
  classified the interim-projection slice as not response-generation relevant.
