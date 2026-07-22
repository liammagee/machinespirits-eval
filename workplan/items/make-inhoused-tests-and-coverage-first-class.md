---
id: make-inhoused-tests-and-coverage-first-class
title: Make in-housed tutor-core tests and coverage first-class
status: triaged
type: infra
priority: P1
owner: unassigned
source: review
created: 2026-07-22
updated: 2026-07-22
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
    - .github/workflows/ci.yml
tags:
  - testing
  - coverage
  - tutor-core
  - ci
milestone: evaluation-infrastructure
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
