---
id: refactor-token-budget-store-ownership
title: Give token-budget reporting explicit evaluation-store ownership
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-08
updated: 2026-08-08
branch: codex/refactor-token-budget-store-ownership
verification: >-
  Import safety, argument and child-run parity, database-free help and failed
  generation, injected versus owned-store disposal, deterministic report
  rendering, boundary inventory, hermetic, risk coverage, source, lint,
  formatting, manifest, and cycle gates prove token-budget reporting owns one
  bounded evaluation store without changing its experiment or report semantics.
claim_status: planned
depends_on:
  - refactor-operational-ingest-seed-store-ownership
links:
  notes:
    - docs/next-steps/2026-08-06-evaluation-store-boundary-inventory.md
  code:
    - services/evaluationStore/scriptContext.js
    - config/evaluation-store-boundary-inventory.json
    - scripts/test-token-budget.js
    - tests/evaluationScriptContext.test.js
    - tests/evaluationStoreBoundaryInventory.test.js
  items:
    - codebase-refactoring-program
    - refactor-operational-ingest-seed-store-ownership
tags:
  - refactoring
  - evaluation
  - operational-scripts
  - token-budget
  - dependency-injection
  - lifecycle
  - maintainability
milestone: evaluation-infrastructure
---

Remove the final small operational script from the legacy evaluation-store
facade before the separate prompt-lab macro migration. Child eval CLI processes
should continue to own generation; this process should acquire one bounded
store only when completed run IDs are available for report construction.

Acceptance:

- Remove the legacy evaluation-store facade and all top-level execution from
  `scripts/test-token-budget.js`.
- Export an import-safe, naturally completing `main()` plus testable argument,
  child-run, and report seams; direct execution must set `process.exitCode`
  only after disposal.
- Preserve the default model, budget levels, profiles, run count, parallelism,
  child `eval-cli run` arguments, run-ID extraction, truncation calculation,
  dose-response tables, effect-size observations, report naming, and CLI text.
- Keep help and zero-completion generation paths evaluation-store-free.
- Read all completed runs through one store; close a store created by the
  script on success or failure while preserving a host-owned injected store.
- Prove deterministic report output for camelCase and historical snake_case
  result fields without model calls or production database writes.
- Ratchet direct facade ownership from three to two live/package consumers,
  leaving only prompt-lab and the package compatibility entrypoint.
- Do not commit generated workplan views.

Log:

- 2026-08-08 — Activated from post-PR-#583 main `8742fdd3`. Baseline: the
  script executes and prints at import time, reads reports through the lazy
  facade, calls `process.exit(1)` on fatal errors, and is one of two remaining
  operational facade consumers.
- 2026-08-08 — Reached review with an import-safe CLI, preserved child-run
  arguments and report calculations, database-free help and zero-completion
  paths, and one bounded report store. Focused context/inventory tests pass
  28/28; the full hermetic suites pass 8,146/8,146 root and 137/137 tutor-core
  tests with no skips; all five risk-coverage groups pass (evaluation store:
  97.85% lines, 77.46% branches, 97.35% functions). Lint, formatting,
  source-only workplan, manifest, diff, and zero-cycle gates pass. The first
  sandboxed full run failed only because HTTP tests could not bind loopback;
  the authorized rerun was wholly green. No model call or production data
  write occurred; direct facade ownership is now two live/package consumers.
