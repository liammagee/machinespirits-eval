---
id: refactor-evaluation-store-export-log-readers
title: Extract evaluation exporters and dialogue-log readers
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-07
updated: 2026-08-07
branch: codex/refactor-evaluation-store-export-log-readers
verification: >-
  Direct projection and filesystem-reader tests plus facade regressions preserve
  JSON and CSV output, mutable and immutable dialogue-log lookup, package
  exports, and import-time bootstrap while complete hermetic and risk-coverage
  gates remain green.
claim_status: planned
depends_on:
  - refactor-evaluation-store-statistics-repository
links:
  notes:
    - docs/next-steps/2026-08-06-evaluation-store-boundary-inventory.md
  code:
    - services/evaluationStore.js
    - services/evaluationStore/exportRepository.js
    - services/evaluationStore/dialogueLogRepository.js
    - tests/evaluationStoreExportLogReaders.test.js
  items:
    - codebase-refactoring-program
    - refactor-evaluation-store-statistics-repository
tags:
  - refactoring
  - evaluation
  - export
  - dialogue-logs
  - provenance
  - maintainability
milestone: evaluation-infrastructure
---

Complete the final R4 step 6 repository family behind statistics and
projections. This slice owns JSON/CSV output and mutable/immutable dialogue-log
reads; run-manifest writing, connection hosting, and explicit application
startup remain later owners.

Acceptance:

- Move JSON and CSV export into one injected projection owner without a hidden
  database connection or static import cycle.
- Preserve the exact JSON shape and timestamp semantics plus the exact CSV
  header order, field mapping, null/boolean encoding, trace serialization,
  quote/comma/newline escaping, and header-only empty export.
- Move exact and legacy partial dialogue lookup plus immutable content-addressed
  lookup into one filesystem owner with the log root injected explicitly.
- Preserve missing/empty/malformed behavior, first partial-match selection,
  parsed-object return shapes, canonical pretty-JSON SHA-256 verification, and
  valid-but-unverified tamper results exactly.
- Preserve all 44 named exports, 41 default members, package paths, import-time
  bootstrap behavior, and production database/log isolation.
- Ratchet the facade below 350 lines, each extracted owner below 150 lines, and
  register both owners and their direct tests in hermetic and risk coverage.

Log:

- 2026-08-07 — Activated from refreshed `origin/main` at `53e1e989` after PR
  #527 merged. Baseline: `evaluationStore.js` is 512 lines; two exporters and
  two filesystem-backed dialogue-log readers remain embedded.
- 2026-08-07 — Reached review with JSON/CSV projection in a 112-line injected
  owner and mutable/immutable log lookup in a 56-line filesystem owner. The
  facade fell from 512 to 341 lines, removing 171 lines while retaining all 44
  named exports and 41 default members. Seven direct tests pin exact JSON and
  CSV contracts, dependency order, timestamp injection, escaping, empty output,
  exact/legacy lookup, malformed and missing inputs, first-match selection,
  canonical hash verification, and valid tampering.
- 2026-08-07 — Validation is complete: 129 focused store/provenance tests,
  root shards of 4,421 and 3,505 tests, and tutor-core's 137 tests pass with no
  failures or skips. Evaluation-store risk coverage passes at 97.80% lines,
  74.03% branches, and 97.97% functions; lint, format, manifest, workplan,
  boundary, diff, and zero-cycle gates are green. No model calls or production
  database/log writes were made. Run-manifest writing is the next bounded
  owner, followed by explicit application startup and connection lifecycle.
