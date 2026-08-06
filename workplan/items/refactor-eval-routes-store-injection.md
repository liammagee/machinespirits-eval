---
id: refactor-eval-routes-store-injection
title: Inject evaluation-store ownership into eval routes
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-07
updated: 2026-08-07
branch: codex/refactor-eval-routes-store-injection
verification: >-
  Request-local dependency, cross-host isolation, fail-closed binding,
  standalone/poetics lifecycle, API route, admission, import, boundary,
  hermetic, lint, and root regressions prove explicit host ownership without
  model calls, production writes, or generated workplan views.
claim_status: planned
depends_on:
  - refactor-adaptive-tutor-store-injection
links:
  notes:
    - docs/next-steps/2026-08-06-evaluation-store-boundary-inventory.md
  code:
    - routes/evalRoutes.js
    - services/evalSurfaces.js
    - server.js
    - scripts/browse-poetics-scripts.js
  items:
    - codebase-refactoring-program
    - refactor-adaptive-tutor-store-injection
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/539
tags:
  - refactoring
  - evaluation
  - routes
  - sqlite
  - dependency-injection
  - application-hosting
  - maintainability
milestone: evaluation-infrastructure
---

Complete the R4 application-runtime migration after PR #533. This cohort removes
the evaluation-store facade and runner namespace from the shared eval router,
binding both through the standalone or poetics Express application context while
leaving operational scripts and package compatibility for later cohorts.

Acceptance:

- Remove direct legacy-facade and runner-namespace imports from `evalRoutes`
  without changing its public route paths, response shapes, admissions, SSE
  cleanup, model-work ceilings, or prompt-read-only policy.
- Add a fail-closed host binder that places one supplied store and its matching
  store-bound runner in `app.locals`; allow explicit runner injection for tests.
- Resolve every persistence and runner call from the current request app so two
  hosts mounting the shared router cannot leak dependencies across one another.
- Bind standalone dependencies before `listen()` and poetics dependencies around
  its existing database connection; keep server and route imports side-effect
  free and preserve deterministic shutdown ownership.
- Migrate the API route regression to a hermetic explicitly owned store and
  close it naturally after the server drains.
- Ratchet direct facade consumers from 24 to 23 live/package and application
  runtime consumers from one to zero; register the dependency contract in the
  hermetic and risk manifests.
- Pass focused API, admission, lifecycle, desktop/poetics, complete root,
  tutor-core, risk-coverage, source, formatting, and static-cycle gates without
  model calls, shared production writes, or generated board changes.

Log:

- 2026-08-07 — Activated from refreshed main `fec495a6` after PR #533 merged as
  `39f8c29f`. Baseline: the 3,778-line shared router imports the facade and
  runner namespaces directly for 41 persistence and 10 orchestration calls;
  it is the sole remaining application-runtime facade consumer.
- 2026-08-07 — Implemented request-local route dependency resolution plus a
  shared host binder. Standalone and poetics now bind one store and matching
  runner explicitly; two-host identity, fail-closed, factory-runner, import,
  lifecycle, admission, and static-boundary tests pass. The facade inventory
  falls to 23 live/package consumers with zero application-runtime consumers.
- 2026-08-07 — Reached review with 90 route/host integration tests and the
  22-test API regression green. Full root shards pass 4,452 and 3,519 tests
  with zero failures or skips; all 137 tutor-core tests pass. Risk coverage
  remains green at 97.82% lines, 76.58% branches, and 97.33% functions for the
  evaluation-store group, alongside source, formatting, lint, boundary, and
  zero-cycle gates. No model calls, shared production writes, or generated
  workplan views occurred.
- 2026-08-07 — Opened PR #539 at `7d3c9bef`; the head matches origin and the PR
  is ready for review against current `main`.
