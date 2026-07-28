---
id: refactor-tutor-stub-cli-parsing
title: Refactor tutor-stub CLI parsing
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: focused 6/6 CLI parsing fixtures plus full hermetic root and tutor-core zero-skip contracts preserve coercion, bounds, auto-turn aliases, lists, and error wording; every static and source-only gate passes
branch: codex/refactor-tutor-stub-cli-parsing
claim_status: planned
depends_on:
  - refactor-tutor-stub-model-temperature
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubCliParsing.js
    - scripts/tutor-stub.js
    - tests/tutorStubCliParsing.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-model-temperature
tags:
  - refactoring
  - tutor-stub
  - cli
milestone: evaluation-infrastructure
---

Fifty-loop run 1: move deterministic number, positive-integer,
optional-bounded-integer, comma-list, and auto-turn parsing into a
dependency-free service.

Acceptance:

- Coercion, inclusive bounds, null handling, `parseInt` compatibility,
  unbounded auto-turn aliases, list order, and error wording remain exact.
- Argument ownership, defaults, launch orchestration, state, and effects remain
  in their current owners.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing CLI flags, defaults, validation policy, or help text.

Log:

- 2026-07-28 — Moved deterministic CLI parsing into a dependency-free service,
  reducing the CLI by 34 lines. Six focused assertions and the complete
  zero-skip hermetic contract pass.
