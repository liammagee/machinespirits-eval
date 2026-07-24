---
id: refactor-rubric-parser-tests
title: Test the production rubric response parser directly
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-24
updated: 2026-07-24
verification: >-
  The rubric evaluator suite imports production parseJudgeResponse directly,
  contains no copied parser or temporary generated module, and passes its
  malformed-response corpus against the complete v2.1 and v2.2 tutor dimension
  sets with focused plus full hermetic parity.
branch: codex/refactor-rubric-parser-tests
depends_on:
  - refactor-required-run-manifest
  - refactor-pty-ci-lane
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  items:
    - codebase-refactoring-program
tags:
  - testing
  - rubric
  - parser
  - json
  - hermetic
  - refactoring
milestone: evaluation-infrastructure
---

Bounded R0.6 slice: replace the rubric evaluator test's hand-copied JSON parser
with the production export. Do not change parser semantics, scoring behavior,
rubric definitions, provider calls, retry policy, or historical scores.

Acceptance:

- Import `parseJudgeResponse` from `services/rubricEvaluator.js` and remove the
  copied parser, copied repair helpers, temporary-module writes, and stale
  commentary that claims the production function is private.
- Preserve the existing clean JSON, fenced JSON, preamble/postamble, trailing
  comma, unescaped quote, regex rescue, rejection, and full-response cases.
- Load the tracked v2.1 and v2.2 tutor rubrics through production loaders and
  pin their exact 14- and eight-dimension shapes.
- Run trailing-comma recovery across every dimension in both versions.
- Run last-resort regex recovery with each version selected through the same
  production rubric override used by scoring.
- Pass focused rubric tests, the full hermetic suite, lint, formatting, and
  workplan validation without model or API calls.

Log:

- 2026-07-24 — Activated from merged `main` at `c5a92afb` after PR #194 closed
  R0.5. The existing test was confirmed to generate and import its own parser
  module with a stale ten-dimension rescue list even though production already
  exports `parseJudgeResponse`.
- 2026-07-24 — Removed the copied parser and temporary filesystem module. The
  suite now imports production parsing plus the production rubric override,
  exercises all 14 v2.1 and eight v2.2 dimensions, and passes 58/58 focused
  assertions with zero skips.
- 2026-07-24 — Review gate passed without model or API calls: `npm test`
  completed 6,635/6,635 root tests and 133/133 tutor-core tests with zero
  failures or skips; lint, Prettier, and the 168-item workplan check also pass.
- 2026-07-24 — Fast-forwarded the uncommitted slice onto `58a18156` after PR
  #195 landed. Re-ran the 58/58 focused parser suite, lint, Prettier, the
  expanded 169-item workplan check, and the full `npm test` sequence; every
  gate remains green with zero full-suite failures or skips.
