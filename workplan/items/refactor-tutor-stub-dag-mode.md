---
id: refactor-tutor-stub-dag-mode
title: Refactor tutor-stub DAG mode normalization
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-08-04
verification: focused 11/11 DAG fixtures including three mode contracts plus full hermetic root and tutor-core zero-skip contracts preserve defaults, case folding, hyphen aliases, validation, and error wording; every static and source-only gate passes
branch: codex/refactor-tutor-stub-dag-mode
claim_status: planned
depends_on:
  - refactor-tutor-stub-model-selection
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubDagFeatures.js
    - scripts/tutor-stub.js
    - tests/tutorStubDagFeatures.test.js
  prs:
    - 373
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-model-selection
tags:
  - refactoring
  - tutor-stub
  - dag
milestone: evaluation-infrastructure
---

Fifty-loop run 3: move deterministic DAG-mode normalization beside the shared
DAG feature model, with the allowed-mode list injected from the CLI.

Acceptance:

- Default selection, trimming, case folding, hyphen aliases, membership
  validation, and error wording remain exact.
- Allowed-mode configuration, runtime DAG state, launch orchestration, and
  effects remain in their current owners.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing DAG modes, defaults, feature semantics, or runtime behavior.

Log:

- 2026-07-28 — Moved DAG-mode normalization beside the canonical DAG feature
  model, reducing the CLI by six lines. Eleven focused assertions and the
  complete zero-skip hermetic contract pass.
- 2026-07-28 — Opened PR #373 against `main`; the benchmark hook correctly
  classified the normalization-only slice as not response-generation relevant.
