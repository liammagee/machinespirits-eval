---
id: refactor-tutor-stub-interim-learner-summary
title: Refactor tutor-stub interim learner summary
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: 15 focused interim-presentation assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve labels, score bands, need precedence, compaction limits, raw fallback, and null handling
branch: codex/refactor-tutor-stub-interim-learner-summary
claim_status: planned
depends_on:
  - refactor-tutor-stub-interim-learner-dag-summary
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubInterimPresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubInterimPresentation.test.js
  prs:
    - 389
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-interim-learner-dag-summary
tags:
  - refactoring
  - tutor-stub
  - interim-ui
  - classifier
milestone: evaluation-infrastructure
---

Fifty-loop run 15: move deterministic pending learner summary projection
beside the interim score bands and text compaction it uses.

Acceptance:

- Discourse labels, score bands, need precedence, compaction limits, raw learner
  fallback, and null handling remain exact.
- Classification, context assembly, runtime state, and effects remain in their
  current owners.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing classifier scores, interim labels, or animation panels.

Log:

- 2026-07-28 — Moved pending learner summary projection beside interim score
  bands and compaction, reducing `scripts/tutor-stub.js` by 15 lines. The
  focused fixture now pins the existing 2/5 `developing` label and 62-character
  need limit; 15 focused assertions, complete zero-skip hermetic parity, and all
  static/source-only gates pass.
- 2026-07-28 — Opened PR #389 against `main`; the benchmark hook correctly
  classified the interim-projection slice as not response-generation relevant.
