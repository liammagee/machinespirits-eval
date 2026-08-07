---
id: refactor-evaluation-store-statistics-repository
title: Extract evaluation statistics and projections
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-06
updated: 2026-08-06
branch: codex/refactor-evaluation-store-statistics-repository
verification: >-
  Direct in-memory repository tests and facade regressions preserve run and
  scenario aggregates, transient-failure reconstruction, configuration
  comparison, factorial score projection, package exports, and import-time
  bootstrap while complete hermetic and risk-coverage gates remain green.
claim_status: planned
depends_on:
  - refactor-evaluation-store-interaction-repository
links:
  notes:
    - docs/next-steps/2026-08-06-evaluation-store-boundary-inventory.md
  code:
    - services/evaluationStore.js
    - services/evaluationStore/statisticsRepository.js
    - tests/evaluationStoreStatisticsRepository.test.js
  items:
    - codebase-refactoring-program
    - refactor-evaluation-store-interaction-repository
    - refactor-evaluation-store-export-log-readers
    - repair-evaluation-config-comparison-missing-side-winner
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/527
tags:
  - refactoring
  - evaluation
  - statistics
  - projections
  - sqlite
  - maintainability
milestone: evaluation-infrastructure
---

Continue R4 step 6 behind interaction persistence. This slice owns read-only
evaluation aggregates and analysis projections; JSON/CSV exporters, dialogue-log
readers, manifest hosting, and explicit startup remain later owners.

Acceptance:

- Move run aggregates, scenario aggregates, configuration comparison,
  factorial-cell projection, and their transient-failure inference into one
  repository bound to the migrated connection.
- Keep result/run readers, progress-log access, generation deduplication,
  scenario/profile lookup, and model resolution as explicit injected
  boundaries; introduce no hidden connection or static import cycle.
- Preserve dynamic-dimension averages, score fallbacks, success and validation
  denominators, token/latency totals, ordering, run-plan inference, override
  precedence, latest error reporting, score-column whitelisting, and all
  existing missing-side comparison behavior exactly.
- Preserve all 44 named exports, 41 default members, package paths, import-time
  bootstrap behavior, and production database/log isolation.
- Ratchet the facade below 525 lines and the statistics repository below 475
  lines; add the repository and direct tests to hermetic and risk coverage.

Log:

- 2026-08-06 — Activated from refreshed `origin/main` at `9166554c` after PR
  #526 merged. Baseline: `evaluationStore.js` is 961 lines; four public
  projections plus transient plan/log reconstruction remain embedded.
- 2026-08-06 — Direct characterization exposed a legacy comparison edge case:
  a scenario present only in configuration 2 has a negative numeric difference
  but is labelled `tie` because winner selection compares against `undefined`.
  This refactor pins the behavior; a separate repair card owns any semantic
  correction.
- 2026-08-06 — Reached review with the four projections and transient-plan
  reconstruction in a 460-line injected repository. The unchanged facade
  surface fell from 961 to 512 lines, removing 449 lines while preserving all
  44 named exports and 41 default members. Five direct tests pin run/scenario
  aggregates, dynamic dimensions, transient failure recovery, configuration
  comparison, factorial projection, score whitelisting, and facade ownership.
- 2026-08-06 — Validation is complete: 152 focused store/provenance tests,
  root shards of 4,414 and 3,505 tests, and tutor-core's 137 tests pass with no
  failures or skips. Evaluation-store risk coverage passes at 96.61% lines,
  72.62% branches, and 96.43% functions; lint, format, manifest, workplan,
  boundary, diff, and zero-cycle gates are green. No model calls or production
  database/log writes were made. Exporters and dialogue-log readers form the
  next bounded ownership family after this child lands.
- 2026-08-07 — PR #527 merged as `28fcf27e`; all ten GitHub checks passed and
  the serialized board refresh landed as `53e1e989`. Statistics and projections
  are closed; exporter and dialogue-log ownership is the active child.
