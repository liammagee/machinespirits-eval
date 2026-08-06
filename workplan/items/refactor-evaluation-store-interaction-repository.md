---
id: refactor-evaluation-store-interaction-repository
title: Extract interaction-evaluation persistence
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-06
updated: 2026-08-06
branch: codex/refactor-evaluation-store-interaction-repository
verification: >-
  Direct in-memory repository tests and facade regressions preserve full
  interaction round trips, compact and run-scoped projections, latest-record
  lookup, learner-score updates, defaults and judge-score precedence, package
  exports, and import-time bootstrap while complete hermetic and risk-coverage
  gates remain green.
claim_status: planned
depends_on:
  - refactor-evaluation-store-score-repository
links:
  notes:
    - docs/next-steps/2026-08-06-evaluation-store-boundary-inventory.md
  code:
    - services/evaluationStore.js
    - services/evaluationStore/interactionRepository.js
    - tests/evaluationStoreInteractionRepository.test.js
  items:
    - codebase-refactoring-program
    - refactor-evaluation-store-score-repository
tags:
  - refactoring
  - evaluation
  - interaction
  - persistence
  - sqlite
  - maintainability
milestone: evaluation-infrastructure
---

Continue R4 step 6 behind mutable result-score persistence. This slice owns the
legacy `interaction_evaluations` table's insert, lookup, list projections, and
learner-score update; statistics, exporters, dialogue-log readers, and host
startup remain later owners.

Acceptance:

- Move all six interaction-evaluation operations into one repository bound to
  the migrated connection, with no hidden connection or static import cycle.
- Preserve the full detail projection, compact global projection, historical
  run-scoped projection, chronological/latest ordering, scenario filtering,
  limit behavior, defaults, JSON shapes, and three-level judge-score precedence
  exactly.
- Preserve learner per-turn and holistic score mutation without clobbering
  interaction, outcome, or judge data. Characterize the existing learner-only
  compatibility columns without expanding the schema in this refactor; the
  symmetric current scoring axes remain on `evaluation_results`.
- Preserve all 44 named exports, 41 default members, package paths, import-time
  bootstrap behavior, and production database/log isolation.
- Ratchet the facade below 975 lines and the interaction repository below 225
  lines; add the repository and direct tests to hermetic and risk coverage.

Log:

- 2026-08-06 — Activated in a separate worktree from PR #525 reviewed head
  `b379ffa1`. Baseline: `evaluationStore.js` is 1,214 lines; six interaction
  operations and two duplicate full-row projections remain embedded, with only
  incidental deletion coverage through the facade.
- 2026-08-06 — Reached review with the six operations in a 214-line injected
  repository. The unchanged facade surface is 961 lines, 253 fewer than the
  stacked baseline, while retaining all 44 named exports and 41 default
  members. Five direct tests pin complete JSON and memory round trips, compact
  and run-scoped projections, ordering/filtering/latest lookup, learner-score
  non-clobbering, defaults, and judge-score precedence.
- 2026-08-06 — Validation is complete: 142 focused store/provenance tests,
  root shards of 4,399 and 3,499 tests, and tutor-core's 137 tests pass with no
  failures or skips. Evaluation-store risk coverage passes at 94.53% lines,
  69.43% branches, and 92.91% functions; lint, format, manifest, workplan,
  boundary, diff, and zero-cycle gates are green. No model calls or production
  database/log writes were made. Statistics and projections form the next
  bounded repository family.
- 2026-08-06 — After PR #525 merged, rebased the staged slice without conflict
  onto refreshed `origin/main` at `a410c982`, including the generated-board
  refresh and PR #523. Post-rebase source, behavioral, and static gates are
  rerun before publication.
