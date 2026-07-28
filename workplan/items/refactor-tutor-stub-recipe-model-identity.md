---
id: refactor-tutor-stub-recipe-model-identity
title: Refactor tutor-stub recipe model identity
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: focused 15/15 recipe fixtures including three model-identity contracts plus full hermetic root and tutor-core zero-skip contracts preserve URL sanitization, lazy route resolution, identity fields, and routing hashes; every static and source-only gate passes
branch: codex/refactor-tutor-stub-recipe-model-identity
claim_status: planned
depends_on:
  - refactor-tutor-stub-prompt-blocks
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubSessionRecipe.js
    - scripts/tutor-stub.js
    - tests/tutorStubSessionRecipe.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-prompt-blocks
tags:
  - refactoring
  - tutor-stub
  - provenance
milestone: evaluation-infrastructure
---

Third-loop run 9: move deterministic recipe model identity projection and safe
base-URL normalization beside session-recipe hashing, with live resolution
injected from the CLI.

Acceptance:

- Ref trimming, route fields, credential/query/fragment removal, null handling,
  lazy resolution, and routing hashes remain exact.
- Live provider resolution, CLI selection, runtime state, and effects remain in
  their current owners.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing model aliases, provider configuration, routing, or recipe schema.

Log:

- 2026-07-28 — Moved recipe model identity and safe base-URL projection beside
  canonical recipe hashing, reducing the CLI by 28 lines. Fifteen focused
  assertions and the complete zero-skip hermetic contract pass.
