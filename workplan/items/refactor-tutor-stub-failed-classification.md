---
id: refactor-tutor-stub-failed-classification
title: Refactor tutor-stub failed classification fallback
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: eight focused classification assertions including the live terminal contract, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve conservative turn/overall fallbacks, route metadata, latency, usage, and fresh defaults
branch: codex/refactor-tutor-stub-failed-classification
claim_status: planned
depends_on:
  - refactor-tutor-stub-classifier-world-context
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubLearnerClassification.js
    - scripts/tutor-stub.js
    - tests/tutorStubLearnerClassification.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-classifier-world-context
tags:
  - refactoring
  - tutor-stub
  - classifier
milestone: evaluation-infrastructure
---

Fifty-loop run 10: move deterministic failed-classifier fallback construction
into an effect-free learner-classification service.

Acceptance:

- Conservative turn/overall fallbacks, route metadata, latency, supplied usage,
  and fresh zero-usage defaults remain exact.
- Classifier invocation, error handling, runtime state, and effects remain in
  their current owners.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing classifier failure policy, wording, retry behavior, or model calls.

Log:

- 2026-07-28 — Moved failed-classifier fallback construction into an
  effect-free service, reducing `scripts/tutor-stub.js` by 27 lines. Eight
  focused assertions, complete zero-skip hermetic parity, and all static and
  source-only gates pass.
