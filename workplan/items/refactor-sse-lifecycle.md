---
id: refactor-sse-lifecycle
title: Wire evaluation SSE streams into graceful application shutdown
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-25
updated: 2026-07-25
verification: >-
  A production stream registry preserves the existing timeout, warning, and
  restart event contracts; the shared eval-surface lifecycle hook is invoked by
  standalone, Scriptorium, and desktop shutdown paths; focused tests prove all
  tracked streams close, timers release, and the process exits naturally.
claim_status: planned
branch: codex/refactor-sse-lifecycle
depends_on:
  - refactor-log-route-data-root
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/evaluationStreamRegistry.js
    - routes/evalRoutes.js
    - services/evalSurfaces.js
    - services/applicationShutdown.js
    - desktop/server-entry.mjs
    - tests/evaluationStreamRegistry.test.js
    - tests/applicationShutdown.test.js
  items:
    - codebase-refactoring-program
    - refactor-log-route-data-root
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/235
tags:
  - refactoring
  - testing
  - routes
  - sse
  - lifecycle
milestone: evaluation-infrastructure
---

Bounded row 18 slice: turn the evaluation router's intention-shaped stream
cleanup export into a production shutdown responsibility with direct lifecycle
coverage.

Out of scope:

- Changing SSE event names, payloads, headers, endpoint behavior, or timeouts.
- Splitting the broader evaluation router or altering route/auth/mount order.
- Redesigning general application shutdown, tutor-process cleanup, or database
  lifecycle.
- Reading or modifying private evaluation logs, databases, or paper evidence.

Acceptance:

- Every existing evaluation stream registration and unregistration site uses
  one testable process-wide registry without changing its external behavior.
- The shared eval-surface mounter exposes exactly one cleanup hook to its host;
  standalone and Scriptorium signal handling plus desktop parent shutdown invoke
  that hook before process termination.
- Cleanup sends the existing `Server restarting` error event, ends every open
  response, clears keep-alive and maximum-duration timers, and is idempotent.
- Focused lifecycle/import/route tests, desktop parity, the root manifest, full
  hermetic parity, lint, formatting, cycles, source-only workplan, and diff
  gates pass without model calls.

## Log

- 2026-07-25 — Activated from `origin/main` at `3530a690` after PR #233 merged
  row 17 with all checks green. Baseline inspection confirmed that all five
  registration/unregistration paths share the router-local map and exported
  `cleanupAllStreams()`, but standalone, Scriptorium, and desktop shutdown do
  not call it.
- 2026-07-25 — Extracted the tracker into a dependency-free registry while
  retaining the route facade and exact restart, timeout, warning, duration, and
  interactive 30-minute timeout contracts. The shared mounter now gives every
  eval host one cleanup hook, and desktop parent shutdown invokes the same hook.
- 2026-07-25 — A live SSE test exposed an idle-socket race in the existing
  general shutdown order: idle connections were reaped before the stream
  response ended. Shutdown now stops admission, drains streams, then reaps
  newly idle connections; the live response closes in about 16 ms under a
  250 ms guard.
- 2026-07-25 — Review parity is green: lifecycle tests 10/10, hermetic root
  shards 2,351/2,351 and 4,413/4,413 with zero skips, tutor-core 137/137, and
  Electron-ABI desktop tests 32/32. Lint, formatting, manifest, zero-cycle,
  workplan source-only, and diff gates pass with no model calls.
- 2026-07-25 — Merged through PR #235 as `e5d9f047`; the initial 18-row queue
  is complete. The next slice starts from refreshed hotspot evidence rather
  than extending the merged branch.
