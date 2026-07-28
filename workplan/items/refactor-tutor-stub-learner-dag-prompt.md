---
id: refactor-tutor-stub-learner-dag-prompt
title: Refactor tutor-stub learner-DAG prompt summary
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: five focused learner-DAG assertions including the live terminal contract, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve null fallback, bounded history, record fields, and JSON shape
branch: codex/refactor-tutor-stub-learner-dag-prompt
claim_status: planned
depends_on:
  - refactor-tutor-stub-register-prompt-vocabulary
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubLearnerDagPresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubLearnerDagPresentation.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-register-prompt-vocabulary
tags:
  - refactoring
  - tutor-stub
  - learner-dag
  - prompts
milestone: evaluation-infrastructure
---

Fifty-loop run 7: move deterministic learner-DAG prompt projection beside the
existing learner-DAG terminal projection.

Acceptance:

- Null fallback, metrics, assessment, memory reliability, bounded record
  history, answer candidates, and JSON shape remain exact.
- Learner-DAG construction, runtime state, prompt assembly, and effects remain
  in their current owners.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing learner-DAG inference, history limits, prompt content, or runtime
  behavior.

Log:

- 2026-07-28 — Moved the bounded learner-DAG prompt projection beside its
  terminal projection, reducing `scripts/tutor-stub.js` by 18 lines. Five
  focused assertions, complete zero-skip hermetic parity, and all static and
  source-only gates pass.
