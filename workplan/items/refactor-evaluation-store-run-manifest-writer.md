---
id: refactor-evaluation-store-run-manifest-writer
title: Extract evaluation run-manifest writing
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-07
updated: 2026-08-07
branch: codex/refactor-evaluation-store-run-manifest-writer
verification: >-
  Direct temporary-filesystem and in-memory database tests plus run-completion
  and facade regressions preserve manifest paths, shapes, provenance, failure
  tolerance, package exports, and import-time bootstrap while complete hermetic
  and risk-coverage gates remain green.
claim_status: planned
depends_on:
  - refactor-evaluation-store-export-log-readers
links:
  notes:
    - docs/next-steps/2026-08-06-evaluation-store-boundary-inventory.md
  code:
    - services/evaluationStore.js
    - services/evaluationStore/runManifestWriter.js
    - tests/evaluationStoreRunManifestWriter.test.js
  items:
    - codebase-refactoring-program
    - refactor-evaluation-store-export-log-readers
tags:
  - refactoring
  - evaluation
  - provenance
  - manifests
  - filesystem
  - maintainability
milestone: evaluation-infrastructure
---

Continue the post-repository R4 persistence runway behind PR #528. This slice
owns the completion-time provenance manifest only; import-time database
bootstrap, application-host connection lifecycle, and consumer migration remain
the next architectural phase.

Acceptance:

- Move run-manifest construction, rubric-version lookup, directory creation,
  and pretty-JSON writing into one injected owner without a hidden connection
  or static import cycle.
- Preserve the exact manifest path and shape, row keys and null fallbacks,
  generation and expected-test counts, sorted unique profile/scenario/judge and
  rubric lists, last-seen configuration hashes, and completion metadata.
- Preserve the inner rubric-query fallback and outer non-fatal write contract:
  manifest failure must never block run completion and the writer returns no
  new public result.
- Keep the run repository dependent only on the injected writer function and
  preserve completion invocation timing and arguments.
- Preserve all 44 named exports, 41 default members, package paths, import-time
  bootstrap behavior, and production database/log isolation.
- Ratchet the facade below 265 lines and the manifest writer below 150 lines;
  register the owner and direct tests in hermetic and risk coverage.

Log:

- 2026-08-07 — Activated as a stacked branch from PR #528 reviewed head
  `69666c20`. Baseline: `evaluationStore.js` is 341 lines and still embeds the
  sole completion-time manifest filesystem write plus direct rubric-version SQL.
- 2026-08-07 — Reached review with manifest projection, rubric lookup, directory
  ownership, and best-effort pretty-JSON persistence in one 87-line injected
  writer. The facade fell from 341 to 261 lines while retaining all 44 named
  exports and 41 default members. Four direct tests pin the exact manifest bytes,
  sorted indexes, last-seen configuration hashes, rubric-query compatibility,
  and non-fatal directory/write failures.
- 2026-08-07 — Validation is complete: 133 focused store/provenance tests, root
  shards of 4,421 and 3,509 tests, and tutor-core's 137 tests pass with no
  failures or skips. Evaluation-store risk coverage passes at 97.92% lines,
  75.14% branches, and 98% functions; lint, format, manifest, workplan,
  boundary, diff, and zero-cycle gates are green. No model calls or production
  database/log writes were made. Explicit application startup and connection
  lifecycle migration is the next bounded phase after this stacked slice lands.
