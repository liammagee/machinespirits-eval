---
id: refactor-tutor-stub-fact-matching
title: Refactor tutor-stub fact matching
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: focused 5/5 plus full hermetic root and tutor-core zero-skip contracts preserve symbolic formatting, normalization, regex safety, and canonical fact equality; every static and source-only gate passes
branch: codex/refactor-tutor-stub-fact-matching
claim_status: planned
depends_on:
  - refactor-tutor-stub-debug-identifiers
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubFactModel.js
    - scripts/tutor-stub.js
    - tests/tutorStubFactModel.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-debug-identifiers
tags:
  - refactoring
  - tutor-stub
  - proof-dag
milestone: evaluation-infrastructure
---

Third-loop run 2: move fact formatting, public-word tokenization, whole-token
matching, and canonical fact equality into one reusable model.

Acceptance:

- Symbolic tuple/scalar formatting, camel/separator/possessive normalization,
  regex escaping, word boundaries, case folding, and fact-key equality remain
  exact.
- Premise selection, entailment, leak classification, state, and effects stay
  in their current owners.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing proof semantics, token thresholds, stopwords, or leak policy.

Log:

- 2026-07-28 — Extracted the reusable fact/token model and reduced the CLI by
  20 lines. Five focused assertions and the complete zero-skip hermetic
  contract pass.
