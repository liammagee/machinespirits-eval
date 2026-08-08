---
id: refactor-operational-ingest-seed-store-ownership
title: Give pilot ingestion and seed data explicit evaluation-store ownership
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-08
updated: 2026-08-08
branch: codex/refactor-operational-ingest-seed-store-ownership
verification: >-
  Lifecycle, help and empty-data admission, pilot helper, seed persistence,
  database-path isolation, boundary inventory, hermetic root and tutor-core,
  risk coverage, source, lint, formatting, manifest, and cycle gates prove both
  scripts own and close their evaluation stores without changing persisted
  pilot or seed payloads.
claim_status: planned
depends_on:
  - refactor-operational-run-store-ownership
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/583
  notes:
    - docs/next-steps/2026-08-06-evaluation-store-boundary-inventory.md
  code:
    - services/evaluationStore/scriptContext.js
    - services/evaluationDataPaths.js
    - config/evaluation-store-boundary-inventory.json
    - scripts/ingest-pilot-sessions.js
    - scripts/seed-db.js
    - tests/evaluationScriptContext.test.js
    - tests/evaluationStoreBoundaryInventory.test.js
    - tests/pilot.test.js
  items:
    - codebase-refactoring-program
    - refactor-operational-run-store-ownership
tags:
  - refactoring
  - evaluation
  - operational-scripts
  - pilot
  - seed-data
  - dependency-injection
  - lifecycle
  - maintainability
milestone: evaluation-infrastructure
---

Continue the operational-script host migration with the two small write-bearing
utilities left after the run launchers. Pilot ingestion currently combines the
lazy facade with an extra unowned SQLite connection, while seed setup executes
through the facade at module import time. Each invocation should instead own
one bounded evaluation store and expose a composable entrypoint.

Acceptance:

- Remove the legacy evaluation-store facade from both scripts and remove pilot
  ingestion's extra raw evaluation-database connection.
- Export naturally completing `main()` entrypoints; help and empty-pilot paths
  must return before opening an evaluation store, and direct execution must set
  `process.exitCode` only after disposal.
- Use one explicit store for ingestion idempotency, run creation/lookup, result
  persistence, and run completion; preserve session filtering, force/dry-run
  behavior, transcript shape, profile lookup, payload fields, and CLI output.
- Preserve the seed run shape, eight factorial rows, representative score
  construction, completion status, and exploratory CLI hints.
- Close stores created by either script on success and failure while preserving
  injected host-owned stores for tests and composition.
- Keep dialogue-log output aligned with the same injected environment and data
  root selected by the evaluation store.
- Prove database-free admission, bounded disposal, isolated seed persistence,
  pilot helper parity, and ratchet direct facade consumers from five to three
  live/package and operational scripts from four to two.
- Do not make model calls, write production data, or commit generated workplan
  views.

Log:

- 2026-08-08 — Activated from post-PR-#581 main `7562e0a3`; PR #580 carries
  the out-of-order review closeout separately. Baseline: both scripts import
  the lazy facade, pilot ingestion also opens a second SQLite connection at
  import time, and the inventory records five live/package consumers including
  four operational scripts.
- 2026-08-08 — Migrated both utilities to bounded, injectable stores and
  naturally completing entrypoints. Pilot help and empty-session admission are
  evaluation-store-free; ingestion reuses its owned store for idempotency and
  writes logs under the same injected data root; seed setup preserves eight
  distinct factorial rows. Focused lifecycle/path/inventory tests pass 32/32,
  pilot tests pass 39/39, the hermetic root and tutor-core suites pass
  8,137/8,137 and 137/137 with no skips, and risk coverage passes all five
  groups (evaluation store: 97.85% lines, 77.46% branches, 97.35% functions).
  Lint, formatting, source-only workplan, manifest, diff, and zero-cycle gates
  pass. The initial sandboxed risk run's sole loopback `EPERM` passed on the
  authorized rerun. No model call or production data write occurred; direct
  facade ownership is now three live/package consumers including two
  operational scripts.
- 2026-08-08 — PR #583 merged as `14b47be2`; the generated workplan views were
  refreshed on `main` at `8742fdd3`. All declared verification was green, so
  this ownership slice is done.
