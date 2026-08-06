---
id: refactor-evaluation-store-boundary-inventory
title: Characterize the evaluation-store facade and bootstrap boundary
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-06
updated: 2026-08-06
branch: codex/refactor-evaluation-store-boundary-inventory
verification: >-
  An exact tracked-consumer and export inventory, hermetic import-time database
  bootstrap test, and package-export root/direct-subpath smoke preserve the
  current evaluationStore facade contract before persistence modules move.
claim_status: planned
depends_on:
  - refactor-eval-cli-scoring-commands
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
    - docs/next-steps/2026-08-06-evaluation-store-boundary-inventory.md
  code:
    - services/evaluationStore.js
    - config/evaluation-store-boundary-inventory.json
    - scripts/audit-evaluation-store-boundary.js
    - tests/evaluationStoreBoundaryInventory.test.js
  items:
    - codebase-refactoring-program
    - refactor-eval-cli-scoring-commands
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/518
tags:
  - refactoring
  - evaluation
  - persistence
  - packaging
  - maintainability
milestone: evaluation-infrastructure
---

Complete R4 step 5 before splitting persistence. This is a characterization
slice: it records the existing boundary without moving database behavior or
changing any consumer.

Acceptance:

- Inventory every tracked direct consumer, including the package entrypoint,
  application runtime, operational scripts, archived one-offs, and tests.
- Ratchet the named and default facade exports plus the package root namespace
  and wildcard service subpath.
- Prove hermetically that importing the facade still creates the database
  parent, opens WAL, and installs the current table set.
- Prove the package root and direct service subpath resolve to the same module
  contract under an isolated database and logs directory.
- Classify import-time dependencies and define the ordered persistence split
  and host migration plan without modifying empirical behavior or production
  data.

Log:

- 2026-08-06 — Activated from `origin/main` at `ee802740` after PR #517 merged
  the scoring-command extraction. Baseline: `services/evaluationStore.js` is
  3,437 lines; 48 tracked files directly reference it, comprising 30 live or
  package consumers, four archived one-offs, and fourteen tests. Import opens
  and migrates SQLite immediately, while the package exposes both a root
  namespace and `./services/*` subpaths.
- 2026-08-06 — Reached review with an exact consumer/import-mode and 44-named/
  41-default export ratchet, a hermetic WAL/schema bootstrap characterization,
  root/direct-subpath package binding parity, and an ordered persistence/host
  migration plan. The new characterization test brings the tracked total to 49
  without changing the 30 live/package callers. Eighty-five focused store tests
  passed; complete root shards passed 4,389 plus 3,484 tests and tutor-core
  passed 137, all with zero failures/skips. Lint, formatting, manifest,
  workplan-source, diff, and zero-cycle gates are green. No production store
  code, database/log data, or model endpoint was touched.
- 2026-08-06 — Published the reviewed characterization as PR #518 from commit
  `1a0bc12c`; the PR names this card explicitly and classifies ref impact as
  N/A.
