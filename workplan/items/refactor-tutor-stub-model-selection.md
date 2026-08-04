---
id: refactor-tutor-stub-model-selection
title: Refactor tutor-stub model selection
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-08-04
verification: focused 9/9 model-choice fixtures including byte-exact live CLI blocks plus full hermetic root and tutor-core zero-skip contracts preserve unsupported aliases, catalogue construction, availability checks, and error wording; every static and source-only gate passes
branch: codex/refactor-tutor-stub-model-selection
claim_status: planned
depends_on:
  - refactor-tutor-stub-cli-parsing
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubModelChoicePresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubModelChoicePresentation.test.js
  prs:
    - 372
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-cli-parsing
tags:
  - refactoring
  - tutor-stub
  - models
milestone: evaluation-infrastructure
---

Fifty-loop run 2: move deterministic model-reference validation, catalogue
binding, and availability resolution beside the existing model-choice model,
with provider/config operations injected from the CLI.

Acceptance:

- Unsupported alias matching, actionable errors, configured-provider checks,
  requirement precedence, returned selection shape, and catalogue order remain
  exact.
- Provider definitions, environment configuration, runtime state, slash
  dispatch, and effects remain in their current owners.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing model aliases, provider availability, routing, or defaults.

Log:

- 2026-07-28 — Bound validation, catalogue construction, and availability
  resolution into the model-choice model, reducing the CLI by 27 lines. Nine
  focused assertions and the complete zero-skip hermetic contract pass.
- 2026-07-28 — Opened PR #372 against `main`; the benchmark hook correctly
  classified the selection-only slice as not response-generation relevant.
