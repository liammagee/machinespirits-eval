---
id: refactor-tutor-stub-visible-model
title: Refactor tutor-stub visible model projection
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: 25 focused model-selection and recipe assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve visible provider, model, configuration, endpoint, API-key, and CLI-route metadata
branch: codex/refactor-tutor-stub-visible-model
claim_status: planned
depends_on:
  - refactor-tutor-stub-register-prior-loading
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubModelChoicePresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubModelChoicePresentation.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-register-prior-loading
tags:
  - refactoring
  - tutor-stub
  - models
milestone: evaluation-infrastructure
---

Fifty-loop run 5: move the deterministic visible-model metadata projection
beside model selection and bind it through the existing injected model.

Acceptance:

- Provider, model, configured status, key/endpoint metadata, and CLI-route flag
  remain exact.
- Provider resolution, runtime model state, launch orchestration, and effects
  remain in their current owners.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing model availability, provider configuration, or model selection.

Log:

- 2026-07-28 — Bound visible model metadata through the existing injected model
  selection service, reducing `scripts/tutor-stub.js` by 12 lines. Twenty-five
  focused assertions, the complete zero-skip hermetic suite, and all static and
  source-only gates pass.
