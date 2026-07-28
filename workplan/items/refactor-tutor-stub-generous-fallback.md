---
id: refactor-tutor-stub-generous-fallback
title: Refactor tutor-stub generous-inference fallback
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: focused 14/14 plus full hermetic root and tutor-core zero-skip contracts preserve due, latest, and no-evidence fallback bytes; every static and source-only gate passes
branch: codex/refactor-tutor-stub-generous-fallback
claim_status: planned
depends_on:
  - refactor-tutor-stub-one-line-projection
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubGenerousInference.js
    - services/tutorStubTextProjection.js
    - scripts/tutor-stub.js
    - services/__tests__/tutorStubGenerousInference.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-one-line-projection
tags:
  - refactoring
  - tutor-stub
  - pedagogy
milestone: evaluation-infrastructure
---

Third-loop run 6: colocate the deterministic accepted-inference fallback with
the generous-inference policy and shared one-line projection.

Acceptance:

- First due clue, latest clue, no-evidence, ordering, truncation, and exact
  public response bytes remain unchanged.
- Inference detection, generation, state mutation, and effects stay in their
  current owners.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing what qualifies as generous inference or when fallback runs.

Log:

- 2026-07-28 — Colocated the fallback with the generous-inference policy and
  reduced the CLI by 18 lines. Fourteen focused assertions and the complete
  zero-skip hermetic contract pass.
