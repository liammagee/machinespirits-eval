---
id: refactor-tutor-stub-model-temperature
title: Refactor tutor-stub model temperature policy
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: focused 3/3 model-temperature fixtures plus full hermetic root and tutor-core zero-skip contracts preserve fixed OpenAI GPT-5 temperature and requested-temperature pass-through; every static and source-only gate passes
branch: codex/refactor-tutor-stub-model-temperature
claim_status: planned
depends_on:
  - refactor-tutor-stub-recipe-model-identity
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubModelTemperature.js
    - scripts/tutor-stub.js
    - tests/tutorStubModelTemperature.test.js
  prs:
    - 370
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-recipe-model-identity
tags:
  - refactoring
  - tutor-stub
  - models
milestone: evaluation-infrastructure
---

Third-loop run 10: move the deterministic model-temperature compatibility
policy into a dependency-free service.

Acceptance:

- OpenAI GPT-5 family matching and its fixed temperature remain exact.
- All other providers/model families preserve the requested temperature.
- Provider selection, runtime state, model calls, and effects remain in their
  current owners.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing configured model aliases, temperature defaults, or provider calls.

Log:

- 2026-07-28 — Moved model-temperature compatibility policy into a
  dependency-free service, reducing the CLI by 10 lines. Three focused
  assertions and the complete zero-skip hermetic contract pass.
- 2026-07-28 — The required strong benchmark produced one of six fresh
  candidate quality passes and retained the standing calibration warning;
  zero-call same-response re-audit found zero regressions and zero safety
  changes. Recorded on PR #370.
