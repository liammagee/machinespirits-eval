---
id: refactor-eval-routes-read-side-domains
title: Extract read-only evaluation domain routers
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-09
updated: 2026-08-09
branch: codex/refactor-eval-routes-read-side-domains
verification: >-
  An exact 50-route order ratchet and 69 focused assertions preserve all 30
  delegated non-metered GET contracts; both complete hermetic root shards, all
  137 tutor-core tests, all five risk-coverage groups, source, formatting,
  lint, manifest, and zero-cycle gates pass on current main.
claim_status: planned
depends_on:
  - refactor-tutor-stub-adapter-tail
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
    - docs/next-steps/2026-08-09-codebase-refactoring-reconciliation.md
  code:
    - routes/evalRoutes.js
    - routes/evalAnalysisReadRoutes.js
    - routes/evalConfigurationReadRoutes.js
    - routes/evalFileReadRoutes.js
    - routes/evalInteractionReadRoutes.js
    - routes/evalLogReadRoutes.js
    - routes/evalMonitoringReadRoutes.js
    - routes/evalReadRouteInventory.js
    - routes/evalRunReadRoutes.js
    - tests/evalReadRouteInventory.test.js
    - tests/api-routes.test.js
    - tests/evalLogRoutesDataRoot.test.js
    - tests/evalRoutesDependencyInjection.test.js
    - tests/evalRoutesImport.test.js
  items:
    - codebase-refactoring-program
    - refactor-eval-routes-store-injection
    - refactor-sse-lifecycle
    - bound-remaining-metered-eval-api-surfaces
tags:
  - refactoring
  - evaluation
  - routes
  - read-model
  - dependency-injection
  - maintainability
milestone: evaluation-infrastructure
---

Begin the post-R3 R4 continuation at the safest characterized evaluation seam.
The shared router is 3,802 lines and registers 50 endpoints. Prior work already
pins model-work admission, stream disposal, request-local store and runner
ownership, host isolation, authentication, and API behavior; all four existing
workplan cards that touch this router are done.

Acceptance:

- Move the 30 non-metered GET endpoints for configuration, run/result reads,
  dialogue logs, prompt reads, trajectories, documentation, monitoring,
  resume status, and interaction projections into cohesive domain registrars.
- Keep Codex sessions, every model-backed or metered route, all state-changing
  POST/DELETE handlers, SSE streams, recognition A/B evaluation, and admission
  middleware in the compatibility router for later independently gated work.
- Preserve the default router export, route and middleware order, lazy
  tutor-core loading, request-local dependency lookup, exact response/error
  contracts, path-safety checks, mount-prefix behavior, and shutdown ownership.
- Add an endpoint-inventory ratchet that proves exactly the intended read-only
  paths moved and prevents accidental loss, duplication, or method changes.
- Reduce `routes/evalRoutes.js` below 3,000 physical lines; keep each extracted
  production owner below 450 lines and introduce no static import cycle.
- Run focused API, authentication, log-root, dependency-injection, import,
  admission, lifecycle, and endpoint-inventory tests plus the complete root,
  tutor-core, risk-coverage, source, formatting, lint, manifest, and cycle
  gates without provider calls or production data writes.

Out of scope:

- Evaluation-runner, rubric, dramatic-derivation, browser, or auto-eval logic.
- URL, payload, authorization, admission, persistence, or empirical behavior
  changes.
- Generated workplan views.

Log:

- 2026-08-09 — Triaged by the post-PR-#602 reconciliation at `6396f219`.
  Baseline: 3,802 lines, 50 endpoints (38 GET, 11 POST, one DELETE), and a
  maximum route-handler complexity of 55. Twelve current test files reference
  the router or `/api/eval`; earlier host-injection closeout recorded 90
  route/host integration tests plus the 22-test API regression. This read-only
  extraction is preferred over the higher-risk runner, rubric, dramatic-role,
  and state-changing route families.
- 2026-08-09 — Activated from post-PR-#607 main `e7c29d1e` in an isolated
  worktree. Begin with an executable endpoint inventory before moving route
  handlers; generated workplan views remain out of scope.
- 2026-08-09 — Completed on rebased main `b4091496`. Eight bounded registrars
  now own the 30 non-metered GET endpoints while the compatibility router keeps
  all metered, streaming, Codex, and state-changing routes. The facade falls
  from 3,802 to 2,773 lines; the largest new owner is 214 lines. The exact
  50-route method/order contract, 69 focused assertions, both hermetic root
  shards, 137 tutor-core tests, five risk-coverage groups, source, formatting,
  lint, synchronized manifest, and zero-cycle gates pass without provider calls,
  production-data writes, or generated workplan-view changes.
