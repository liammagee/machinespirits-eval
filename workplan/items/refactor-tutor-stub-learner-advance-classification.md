---
id: refactor-tutor-stub-learner-advance-classification
title: Refactor tutor-stub learner-advance classification
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: nine focused learner-advance and classification assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve score floors, no-op paths, accelerated movement labels, evidence use, agency, and reasons
branch: codex/refactor-tutor-stub-learner-advance-classification
claim_status: planned
depends_on:
  - refactor-tutor-stub-failed-classification
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubLearnerClassification.js
    - scripts/tutor-stub.js
    - tests/tutorStubLearnerClassification.test.js
  prs:
    - 384
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-failed-classification
tags:
  - refactoring
  - tutor-stub
  - classifier
  - learner-dag
milestone: evaluation-infrastructure
---

Fifty-loop run 11: move deterministic learner-advance classification
adjustments beside the failed-classification envelope.

Acceptance:

- Score floors, no-op/non-accelerated paths, pace/reasoning/move labels, evidence
  use, agency, and explanatory reasons remain exact.
- Learner-DAG inference, classifier invocation, runtime state, and effects remain
  in their current owners.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing acceleration thresholds, classification labels, scores, or model
  behavior.

Log:

- 2026-07-28 — Moved learner-advance classification adjustments beside the
  failed-classification envelope, reducing `scripts/tutor-stub.js` by 21 lines.
  Nine focused assertions, complete zero-skip hermetic parity, and all static
  and source-only gates pass.
- 2026-07-28 — Opened PR #384 against `main`; the benchmark hook correctly
  classified the deterministic classification slice as not response-generation
  relevant.
