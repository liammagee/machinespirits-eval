---
id: make-inhoused-tests-and-coverage-first-class
title: Make in-housed tutor-core tests and coverage first-class
status: active
type: infra
priority: P1
owner: codex
source: review
created: 2026-07-22
updated: 2026-07-24
verification: A clean root install runs root and in-housed tutor-core suites
  hermetically, reports coverage for critical services/routes, fails on agreed
  risk-based floors, and exposes leaked handles without relying globally on
  forced process exit.
claim_status: planned
depends_on: []
links:
  code:
    - scripts/run-hermetic-tests.js
    - tutor-core/package.json
    - .github/workflows/test.yml
tags:
  - testing
  - coverage
  - tutor-core
  - ci
milestone: evaluation-infrastructure
branch: codex/make-inhoused-tests-and-coverage-first-class
---

The root hermetic runner discovers only root `services/__tests__` and `tests`,
so the in-housed tutor-core suite is outside the default gate. Its standalone
test command currently depends on an unavailable Vitest install. There is no
repository-wide coverage command or CI floor, and the root runner's global
`--test-force-exit` can conceal leaked handles.

Acceptance:

- Provide one clean-install root command that runs root and in-housed core
  tests against isolated DB/log paths; keep intentionally experimental suites
  explicitly named and documented.
- Remove obsolete external tutor-core installation from CI after proving the
  in-housed dependency path, and use reproducible lockfile installation.
- Produce machine-readable and human-readable coverage, beginning with stores,
  authentication/admin routes, evaluator provenance, and browser save state.
- Introduce ratcheted risk-based floors rather than an arbitrary global number.
- Remove `--test-force-exit` by fixing leaked handles, or scope/document any
  remaining exception with a regression test.

Log:

- 2026-07-24 — Activated on `codex/make-inhoused-tests-and-coverage-first-class` from merged `origin/main`; initial audit targets root/core test discovery, dependency topology, coverage seams, and forced-exit handle masking.
- 2026-07-24 — Began the first integration slice: the root hermetic command now orchestrates the root Node phase and all ten in-housed Vitest files, CI uses the lockfile with no published tutor-core install, and a separate natural-teardown root command exposes handle debt. The newly visible core baseline found and fixed an import-time DB isolation defect; core now passes 10/10 files and 133/133 tests. Coverage reports and risk-based floors remain open, so the card stays active.
