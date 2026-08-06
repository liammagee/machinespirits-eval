---
id: refactor-evaluation-store-result-repository
title: Extract the evaluation-store result repository
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-06
updated: 2026-08-06
branch: codex/refactor-evaluation-store-result-repository
verification: >-
  Direct in-memory repository tests and facade round trips preserve generation
  provenance, row parsing and filtering, historical rejudgments, attempt-aware
  identity, rubric-version cloning, package exports, and import-time bootstrap
  while complete hermetic and risk-coverage gates remain green.
claim_status: planned
depends_on:
  - refactor-evaluation-store-run-repository
links:
  notes:
    - docs/next-steps/2026-08-06-evaluation-store-boundary-inventory.md
  code:
    - services/evaluationStore.js
    - services/evaluationStore/resultRepository.js
    - tests/evaluationStoreResultRepository.test.js
  items:
    - codebase-refactoring-program
    - refactor-evaluation-store-run-repository
tags:
  - refactoring
  - evaluation
  - persistence
  - provenance
  - sqlite
  - maintainability
milestone: evaluation-infrastructure
---

Continue R4 step 6 behind the reviewed run aggregate. This slice owns generated
result rows and their immutable generation provenance; score mutations and audit
history, statistics, interaction CRUD, exporters, dialogue-log readers, and host
startup remain later owners.

Acceptance:

- Move result insertion, row parsing/filtering, lookup, generation identity and
  de-duplication, historical rejudgment insertion, and rubric-version cloning
  into one repository bound to the migrated connection.
- Keep rubric-version resolution, run lookup, expected-test accounting, and the
  clock as explicit injected boundaries; introduce no static import cycle or
  hidden second connection.
- Preserve every current generation/provenance column, legacy JSON fallback,
  tutor-score aggregation fallback, repeated-attempt identity, rejudgment
  semantics, derived-run metadata, and idempotent clone behavior exactly.
- Keep score UPDATE operations and score-audit recording in the facade for the
  next bounded repository so result insertion and mutable judgment stay
  separately reviewable.
- Preserve all 44 named exports, 41 default members, package paths, import-time
  bootstrap behavior, and production database/log isolation.
- Ratchet the facade below 1,900 lines and the result repository below 650
  lines; add the repository and direct tests to hermetic and risk coverage.

Log:

- 2026-08-06 — Activated in a separate worktree from PR #520 reviewed head
  `3b45c24b`. Baseline: `evaluationStore.js` is 2,452 lines; result provenance,
  parsing/filtering, rejudgment insertion, and rubric cloning remain embedded.
  Score UPDATE and audit methods are explicitly deferred to the following
  repository rather than creating another unbounded persistence module.
- 2026-08-06 — The first implementation pass is gate-complete on the stacked
  head: a 628-line result repository removes 582 lines from the facade, taking
  it to 1,870 while retaining all 44 named and 41 default exports. Eighty
  focused tests, complete root shards (4,394 plus 3,494), and tutor-core's 137
  tests pass with zero failures/skips. Evaluation-store risk coverage passes at
  85.64% lines, 69.43% branches, and 83.9% functions; lint, format, manifest,
  workplan, boundary, diff, and zero-cycle gates are green.
- 2026-08-06 — PR #520 merged and the uncommitted child rebased without
  conflict onto refreshed `origin/main` at `8a664d9b`. The post-rebase focused,
  package-boundary, manifest, workplan, formatting, lint, diff, and zero-cycle
  gates remain green, so this child has reached review independently.
