---
id: refactor-tutor-stub-one-line-projection
title: Refactor tutor-stub one-line projection
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: focused 5/5 plus full hermetic root and tutor-core zero-skip contracts preserve whitespace, budget, truncation, and fallback bytes across every existing caller; every static and source-only gate passes
branch: codex/refactor-tutor-stub-one-line-projection
claim_status: planned
depends_on:
  - refactor-tutor-stub-response-leak-audit
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubTextProjection.js
    - scripts/tutor-stub.js
    - tests/tutorStubTextProjection.test.js
  prs:
    - 365
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-response-leak-audit
tags:
  - refactoring
  - tutor-stub
  - presentation
milestone: evaluation-infrastructure
---

Third-loop run 5: move the high-fan-in deterministic one-line text projection
out of the CLI without moving any caller-specific budget or effect.

Acceptance:

- Whitespace collapse, trimming, within-budget bytes, truncation, small budgets,
  and nullish fallback remain exact.
- Call-site budgets, menu/report assembly, terminal writes, state, and effects
  remain in their current owners.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing ellipsis style, text budgets, labels, menu layout, or report bytes.

Log:

- 2026-07-28 — Extracted the high-fan-in one-line projector and reduced the CLI
  by seven lines. Five focused assertions and the complete zero-skip hermetic
  contract pass.
