---
id: refactor-tutor-stub-interim-learner-record
title: Refactor tutor-stub interim learner-record summary
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: 18 focused interim-presentation assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve turn fallback, adoption/retraction plurality, bounded derivations, hypothesis, answer, rejection, and empty handling
branch: codex/refactor-tutor-stub-interim-learner-record
claim_status: planned
depends_on:
  - refactor-tutor-stub-interim-dag-movement
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubInterimPresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubInterimPresentation.test.js
  prs:
    - 392
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-interim-dag-movement
tags:
  - refactoring
  - tutor-stub
  - interim-ui
  - learner-dag
milestone: evaluation-infrastructure
---

Fifty-loop run 18: move deterministic learner-record update summary projection
beside interim text compaction.

Acceptance:

- Turn fallback, adoption/retraction plurality, two-derivation bound,
  hypothesis, proposed answer, rejection plurality, and empty handling remain
  exact.
- Learner-record updates, fact rendering, runtime state, and effects remain in
  their current owners.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing accepted/rejected learner-DAG updates, facts, or animation panels.

Log:

- 2026-07-28 — Moved learner-record update summary projection beside interim
  text compaction, reducing `scripts/tutor-stub.js` by 16 lines. Eighteen
  focused assertions, complete zero-skip hermetic parity, and all
  static/source-only gates pass.
- 2026-07-28 — Opened PR #392 against `main`; the benchmark hook correctly
  classified the interim-projection slice as not response-generation relevant.
