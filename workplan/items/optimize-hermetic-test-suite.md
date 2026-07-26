---
id: optimize-hermetic-test-suite
title: Stabilize and accelerate the hermetic test suite
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-26
updated: 2026-07-26
verification: >-
  Stable exhaustive shards, split tutor-stub interactive coverage, diagnostic
  and natural-teardown gates, Node 20-compatible CI installation, and unique
  validation steps pass focused contracts plus the complete hermetic, lint,
  formatting, and source-only workplan checks.
branch: codex/test-suite-optimizations
depends_on:
  - make-inhoused-tests-and-coverage-first-class
  - refactor-pty-ci-lane
links:
  code:
    - scripts/run-hermetic-tests.js
    - tests/helpers/tutorStubInteractiveHarness.js
    - .github/workflows/test.yml
    - .github/workflows/validate.yml
  items:
    - codebase-refactoring-program
tags:
  - testing
  - ci
  - hermetic
  - performance
  - tutor-stub
milestone: evaluation-infrastructure
---

Follow-on optimization after the explicit manifest, sharded CI matrix, risk
coverage, and dedicated PTY lane landed. Preserve every test and retain Node 20
server/runtime coverage while reducing churn, imbalance, opaque failures, and
duplicate CI work.

Acceptance:

- Replace sorted-index sharding with deterministic path-stable assignment and
  prove order independence, exhaustiveness, exclusivity, and useful balance.
- Split the monolithic tutor-stub interactive suite into thematic worker files
  over a shared harness without changing assertions, skip contracts, or model
  isolation.
- Make root failures report their selected files and terminal exit state; keep
  matrix shards running after a sibling fails; add a focused natural-teardown
  lifecycle gate.
- Keep the Node 20 root matrix while preventing desktop-only Electron download
  work in non-desktop CI installation.
- Remove exact unit-test duplication from the companion validation workflow
  while retaining its unique content and paper smoke validators.
- Pass focused runner/workflow/interactive tests, the complete hermetic suite,
  lint, formatting, diff checks, and source-only workplan validation without
  model or API calls.

Log:

- 2026-07-26 — Activated from `origin/main` at `a577fa6a` after a current-suite
  audit found no irrelevant or duplicate test files, but identified five
  bounded execution optimizations: stable sharding, interactive-file
  decomposition, Node 20 install isolation, better diagnostics/teardown, and
  removal of companion-workflow duplication.
- 2026-07-26 — Implemented all five optimizations. Final hermetic root shards
  passed with 230 files / 3,867 tests and 254 files / 2,925 tests respectively,
  with zero failures or skips. Also passed the in-housed core suite, dedicated
  lifecycle/PTY coverage, risk-coverage floors, manifest and focused contracts,
  content and paper smoke validators, lint, cycle lint, formatting, diff checks,
  clean root and desktop lockfile installs, and source-only workplan validation.
  Moved to review for the pushed branch's hosted Node 20/22 CI confirmation.
