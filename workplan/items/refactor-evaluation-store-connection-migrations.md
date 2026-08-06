---
id: refactor-evaluation-store-connection-migrations
title: Extract the evaluation-store connection and migration owners
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-06
updated: 2026-08-06
branch: codex/refactor-evaluation-store-connection-migrations
verification: >-
  Hermetic fresh, repeated, and legacy-schema tests prove database path
  precedence, missing-parent creation, WAL mode, schema/index parity,
  evaluator-model rename, score backfill, and unchanged import-time facade and
  package behavior while all existing store round trips remain green.
claim_status: planned
depends_on:
  - refactor-evaluation-store-boundary-inventory
links:
  notes:
    - docs/next-steps/2026-08-06-evaluation-store-boundary-inventory.md
  code:
    - services/evaluationStore.js
    - services/evaluationStore/connection.js
    - services/evaluationStore/migrations.js
    - tests/evaluationStoreConnectionMigrations.test.js
  items:
    - codebase-refactoring-program
    - refactor-evaluation-store-boundary-inventory
tags:
  - refactoring
  - evaluation
  - persistence
  - sqlite
  - maintainability
milestone: evaluation-infrastructure
---

Begin R4 step 6 behind the characterized compatibility facade. This slice owns
only connection/path/WAL setup and the complete idempotent schema migration;
repositories and host startup migration remain later cards.

Acceptance:

- Move database-path resolution, missing-parent creation, SQLite open, and WAL
  selection into a dependency-free connection owner.
- Move the complete current schema, index, legacy-rename, backfill, and
  interaction-table migration sequence into one explicit idempotent runner.
- Keep `services/evaluationStore.js` as the sole import-time bootstrap owner and
  preserve all 44 named exports, 41 default members, package paths, and consumer
  behavior characterized by the predecessor card.
- Pin fresh install, second-run idempotence, legacy evaluator-model rename,
  first-turn-score backfill, source ownership, and module-size ceilings.
- Preserve database rows, schema names, migration ordering/error behavior, and
  tutor/learner data symmetry. Do not migrate application hosts or touch
  production databases/logs in this slice.

Log:

- 2026-08-06 — Activated as a stacked branch from PR #518's reviewed head
  `5ebd9f07`. Baseline: import-time connection/WAL setup and 449 lines of schema
  migration are embedded in the 3,437-line facade; the target is explicit
  connection and migration owners below 500 lines while facade imports and
  initialization timing remain unchanged.
- 2026-08-06 — Reached review with a 21-line connection owner and 466-line
  migration owner; `evaluationStore.js` fell from 3,437 to 2,979 lines (458
  lines, 13.4%) while retaining all 44 named and 41 default exports plus the
  same import-time open/migrate sequence. Fresh, repeated, and legacy schemas,
  WAL/path behavior, package identity, provenance round trips, and bilateral
  score storage pass 90 focused tests. Complete root shards passed 4,389 plus
  3,489 tests and tutor-core passed 137, all with zero failures/skips. Risk
  coverage now includes both extracted owners and passes at 82.95% lines,
  67.81% branches, and 76.7% functions. Lint, format, manifest, workplan, diff,
  and zero-cycle gates are green; no production data or model endpoint was
  touched.
- 2026-08-06 — Rebased without conflict onto refreshed `origin/main` at
  `4f94b98f` after PR #518 merged. The merged Node 20 compatibility repair is
  inherited, and the repository extraction remains isolated to this branch.
