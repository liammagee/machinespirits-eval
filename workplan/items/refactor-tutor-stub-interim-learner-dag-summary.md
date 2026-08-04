---
id: refactor-tutor-stub-interim-learner-dag-summary
title: Refactor tutor-stub interim learner-DAG summary
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-08-04
verification: 14 focused interim-presentation assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve model precedence, turn/count fields, missing-premise fallback, bottleneck copy, and null handling
branch: codex/refactor-tutor-stub-interim-learner-dag-summary
claim_status: planned
depends_on:
  - refactor-tutor-stub-previous-learner-dag
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubInterimPresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubInterimPresentation.test.js
  prs:
    - 388
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-previous-learner-dag
tags:
  - refactoring
  - tutor-stub
  - interim-ui
  - learner-dag
milestone: evaluation-infrastructure
---

Fifty-loop run 14: move deterministic pending learner-DAG summary projection
beside the interim vocabulary it uses.

Acceptance:

- Model precedence, turn/count fields, missing-premise fallback, bottleneck
  copy, and null handling remain exact.
- Learner-DAG inference, context assembly, runtime state, and effects remain in
  their current owners.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing learner-DAG metrics, bottleneck labels, or animation panels.

Log:

- 2026-07-28 — Moved pending learner-DAG summary projection beside the interim
  vocabulary it uses, reducing `scripts/tutor-stub.js` by 14 lines. Fourteen
  focused assertions, complete zero-skip hermetic parity, and all static and
  source-only gates pass.
- 2026-07-28 — Opened PR #388 against `main`; the benchmark hook correctly
  classified the interim-projection slice as not response-generation relevant.
