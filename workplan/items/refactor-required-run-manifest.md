---
id: refactor-required-run-manifest
title: Make required test discovery and skips explicit
status: active
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-24
updated: 2026-07-24
verification: >-
  The hermetic root and in-housed tutor-core phases validate a checked-in exact
  file manifest, report selected file/test/skip counts and skip reasons, reject
  an unexpected skip or zero-test required phase, and pass focused runner tests
  plus the clean Node 20/22 CI matrix.
branch: codex/refactor-required-run-manifest
depends_on:
  - make-inhoused-tests-and-coverage-first-class
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  items:
    - codebase-refactoring-program
tags:
  - testing
  - ci
  - hermetic
  - refactoring
milestone: evaluation-infrastructure
---

Bounded R0.1 slice only: make the tests the hermetic runner promises to execute,
and every currently intentional skip, machine-readable. Do not add the V-series,
dialogue-log, cast-layer, PTY, or model-CLI fixtures owned by later slices.

Acceptance:

- Root and tutor-core test-file discovery exactly match a checked-in manifest.
- The nested deterministic-failure test remains an explicit non-runnable
  fixture exclusion rather than disappearing from discovery silently.
- Each phase reports selected files, executed tests, skips, and named skip
  reasons.
- A required phase with zero tests, a missing/extra test file, or an undeclared
  skip exits nonzero with actionable diagnostics.
- Existing optional skips remain declared with an owner and removal slice.
- Focused runner tests, formatting, lint, workplan checks, and hermetic CI pass;
  no production database/log path or paid model is touched.

Log:

- 2026-07-24 — Started from merged PR #179 at `2cb22482`; scope frozen to the
  manifest/ledger contract so later fixture-removal slices remain independent.
- 2026-07-24 — Rebased onto PR #180 at `1f060aeb`; the manifest correctly
  rejected its newly added `labellingSaveQueue.test.js` until the file was
  explicitly registered, then the focused two-file phase passed 16/16.
- 2026-07-24 — Rebased through current `main` at `c815393c`; regenerated both
  board views from item sources and explicitly registered the newly landed
  `labellingCoderArtifacts.test.js` and `refGovernance.test.js` files.
- 2026-07-24 — Current-base local proof: root selected 450 files and passed
  6,573/6,574 tests with one test skip plus three named suite skips, all four
  ledger-matched; tutor-core selected 10 files and passed 133/133 with no skips.
