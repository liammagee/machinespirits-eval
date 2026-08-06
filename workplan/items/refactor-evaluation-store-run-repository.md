---
id: refactor-evaluation-store-run-repository
title: Extract the evaluation-store run repository
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-06
updated: 2026-08-06
branch: codex/refactor-evaluation-store-run-repository
verification: >-
  Direct in-memory repository tests and facade round trips preserve run CRUD,
  enriched listing, completion and resume accounting, stale-process recovery,
  four-table aggregate deletion, package exports, and the import-time facade
  while complete hermetic and risk-coverage gates remain green.
claim_status: planned
depends_on:
  - refactor-evaluation-store-connection-migrations
links:
  notes:
    - docs/next-steps/2026-08-06-evaluation-store-boundary-inventory.md
  code:
    - services/evaluationStore.js
    - services/evaluationStore/runRepository.js
    - tests/evaluationStoreRunRepository.test.js
  items:
    - codebase-refactoring-program
    - refactor-evaluation-store-connection-migrations
tags:
  - refactoring
  - evaluation
  - persistence
  - sqlite
  - maintainability
milestone: evaluation-infrastructure
---

Continue R4 step 6 behind the merged connection/migration owners. This slice
extracts the run aggregate without moving result parsing/scoring, statistics,
interaction CRUD, generic exporters, dialogue-log readers, or application-host
startup.

Acceptance:

- Move run create/get/update/list, completion, stale-run discovery/recovery,
  attempt-aware incomplete-test accounting, and aggregate deletion into one
  explicit repository bound to the migrated connection.
- Keep result reads, generation identity, process liveness, and run-manifest
  writing as explicit injected boundaries so no static import cycle or hidden
  second connection is introduced.
- Preserve the enriched `listRuns` projection, primary-judge counting,
  tutor/learner metric symmetry, model fingerprinting, and live duration rules.
- Preserve completion de-duplication, repeated-attempt accounting, partial-run
  manifests, live-PID protection, and failed-empty-run behavior exactly.
- Preserve `deleteRun` as one transaction across score audit, result,
  interaction-evaluation, and run rows, with direct count assertions.
- Preserve all 44 named exports, 41 default members, package paths, import-time
  bootstrap behavior, and production database/log isolation.
- Ratchet the facade below 2,500 lines and the run repository below 550 lines;
  add the repository and its direct tests to hermetic and risk coverage.

Log:

- 2026-08-06 — Activated from refreshed `origin/main` at `b83c7612` after PR
  #519 merged. Baseline: `evaluationStore.js` is 2,979 lines; run lifecycle,
  enriched listing, completion/recovery/resume, and aggregate deletion remain
  embedded in the facade. The cross-table delete transaction moves with the
  run aggregate; result/statistics and interaction CRUD remain later families.
- 2026-08-06 — Reached review with a 475-line run repository and a 2,452-line
  facade, removing 527 lines while retaining all 44 named and 41 default
  exports. Direct repository and store regressions passed 83 tests; complete
  root shards passed 4,394 plus 3,489 tests and tutor-core passed 137, all with
  zero failures/skips. Risk coverage passes at 85.35% lines, 68.67% branches,
  and 82.88% functions for the evaluation-store group. Lint, format, manifest,
  source-only workplan, diff, and zero-cycle gates are green; no production
  database, dialogue log, or model endpoint was touched.
