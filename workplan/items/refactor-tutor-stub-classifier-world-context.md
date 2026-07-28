---
id: refactor-tutor-stub-classifier-world-context
title: Refactor tutor-stub classifier world context
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: five focused learner-classifier assertions including the live terminal contract, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve fallback, public fields, optional discipline, setting trimming, and hidden-DAG disclosure
branch: codex/refactor-tutor-stub-classifier-world-context
claim_status: planned
depends_on:
  - refactor-tutor-stub-register-history-prompt
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubLearnerClassificationPresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubLearnerClassificationPresentation.test.js
  prs:
    - 381
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-register-history-prompt
tags:
  - refactoring
  - tutor-stub
  - classifier
  - prompts
milestone: evaluation-infrastructure
---

Fifty-loop run 9: move deterministic public world-context projection beside
the learner-classifier terminal projection.

Acceptance:

- No-world fallback, public identifiers, discipline, question, trimmed setting,
  and the hidden-DAG disclosure remain exact.
- Classifier prompt assembly, runtime state, model calls, and effects remain in
  their current owners.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing classifier prompt content, world data, DAG disclosure, or model
  behavior.

Log:

- 2026-07-28 — Moved public classifier world-context projection beside the
  classifier terminal projection, reducing `scripts/tutor-stub.js` by 10 lines.
  Five focused assertions, complete zero-skip hermetic parity, and all static
  and source-only gates pass.
- 2026-07-28 — Opened PR #381 against `main`; the benchmark hook correctly
  classified the data-projection slice as not response-generation relevant.
