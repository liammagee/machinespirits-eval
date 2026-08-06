---
id: refactor-evaluation-store-application-lifecycle
title: Make evaluation-store startup and connection lifecycle explicit
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-07
updated: 2026-08-07
branch: codex/refactor-evaluation-store-application-lifecycle
verification: >-
  Hermetic package-import, explicit factory, standalone-host, mounted-poetics,
  shutdown-order, migration-script, facade, and repository regressions prove
  side-effect-free imports, ownership-aware close behavior, legacy lazy
  compatibility, and unchanged store results before the complete root and
  tutor-core gates run.
claim_status: planned
depends_on:
  - refactor-evaluation-store-run-manifest-writer
links:
  notes:
    - docs/next-steps/2026-08-06-evaluation-store-boundary-inventory.md
  code:
    - services/evaluationStore.js
    - services/evaluationStore/createEvaluationStore.js
    - services/evaluationStore/lifecycle.js
    - services/applicationShutdown.js
    - server.js
    - scripts/browse-poetics-scripts.js
    - scripts/grade-adaptive-dialogue.js
  items:
    - codebase-refactoring-program
    - refactor-evaluation-store-run-manifest-writer
tags:
  - refactoring
  - evaluation
  - sqlite
  - lifecycle
  - application-hosting
  - maintainability
milestone: evaluation-infrastructure
---

Begin the post-repository R4 host migration behind PR #529. This slice replaces
import-time SQLite bootstrap with an explicit, ownership-aware store factory and
wires the two mounted application hosts through deterministic startup/shutdown.
Direct dependency migration for the runner, adaptive runtime, CLI, and remaining
operational consumers stays in later cohort cards.

Acceptance:

- Importing the file facade, package root, eval routes, or evaluation runner
  creates no directory, database, schema, or open SQLite connection.
- Add one explicit factory that resolves paths, opens or accepts a connection,
  runs migrations, assembles every repository, and exposes idempotent close
  behavior that closes only an owned connection.
- Keep the legacy facade lazy on first operation, preserving all 44 named
  exports, 41 default members, package paths, result shapes, and database/log
  precedence without restoring import-time effects.
- Make standalone server startup acquire the default store before listening;
  make the poetics host wrap its existing SQLite connection rather than opening
  a second evaluation connection.
- Make application shutdown drain streams and tutor sessions before disposing
  the evaluation store and finally closing any host-owned database, including
  aggregate error behavior and idempotent repeated close.
- Replace the adaptive grader's migration-only facade import with an explicit
  migration on its own connection.
- Refresh the executable boundary inventory and package smoke to distinguish
  side-effect-free imports, explicit host startup, and the approved lazy
  compatibility remainder.
- Keep the facade below 170 lines, the factory below 240 lines, and lifecycle
  coordination below 120 lines; register direct tests in hermetic and risk
  coverage without touching production data or generated workplan views.

Log:

- 2026-08-07 — Activated as an explicitly stacked branch from PR #529 reviewed
  head `03879d75`. Baseline: importing the 261-line facade opens and migrates a
  module-scoped SQLite connection; standalone shutdown does not close it, while
  the poetics host opens a second connection to the same database.
- 2026-08-07 — Reached review with store assembly and owned/external connection
  semantics in a 194-line factory, default-store coordination in a 33-line
  lifecycle module, and the 44-named/41-default compatibility API in a passive
  103-line facade. Standalone startup now acquires the default store before
  listening; poetics wraps its existing connection; shutdown disposes the eval
  store before the host database; the adaptive grader migrates its own
  connection. The live/package facade inventory fell from 30 to 29 consumers.
- 2026-08-07 — Six direct lifecycle tests cover owned and supplied connections,
  idempotent close, closed-store rejection, default/lazy coordination, log-root
  precedence, poetics connection identity, and host source contracts. The 136
  focused persistence/lifecycle tests and 44 affected HTTP/desktop/poetics tests
  pass. Root shards pass 4,427 and 3,509 tests with no failures or skips; the
  tutor-core risk lane passes 137 tests. Evaluation-store risk coverage passes
  at 97.82% lines, 76.58% branches, and 97.33% functions. No model calls or
  shared production writes were made; five ignored worktree-local test DB/log
  artifacts were removed after direct route testing. Runner plus eval-CLI
  dependency injection is the next host-migration cohort.
- 2026-08-07 — Dependency PR #529 merged as `f637b398` while this slice was in
  validation. Its reviewed head is an ancestor of refreshed main, so this
  source-only change remains isolated and can rebase as one commit at handoff.
