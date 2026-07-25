---
id: refactor-paper-manifest-fixtures
title: Extract and fixture the paper-manifest validator core
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-25
updated: 2026-07-25
verification: >-
  An importable validator core returns exact exit 0/1 results against synthetic
  paper and SQLite fixtures; count drift, missing runs or required inputs, and
  broken deep references fail closed; CLI parity plus focused and hermetic gates
  pass without private evaluation data.
branch: codex/refactor-paper-manifest-fixtures
depends_on:
  - refactor-eval-profile-registry
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/227
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - scripts/validate-paper-manifest.js
    - config/paper-manifest.json
  items:
    - codebase-refactoring-program
tags:
  - refactoring
  - testing
  - paper
  - provenance
  - hermetic
milestone: evaluation-infrastructure
---

Bounded row 14 slice: separate paper-manifest validation from CLI process and
filesystem state, then characterize its integrity boundary with synthetic paper
and database fixtures.

Out of scope:

- Editing the canonical paper, empirical claims, manifest values, or run data.
- Rebuilding or publishing paper, atlas, or arc artifacts.
- Refactoring the separate provenance or message-chain validators.
- Running model-backed, paid, or private-data-dependent evaluation work.

Acceptance:

- The production validator is importable and accepts explicit manifest, paper,
  database, deep-check, and fix-status inputs without reading `process.argv`.
- The CLI remains a thin adapter and supports explicit manifest, paper, and
  database paths for hermetic invocation.
- Synthetic fixtures prove success and exact non-zero exit behavior for count
  drift, missing manifest entries or runs, missing required inputs, and broken
  deep paper references.
- Existing status repair behavior is preserved and tested without mutating the
  production database.
- Focused tests, the root manifest, full hermetic parity, lint, formatting,
  cycle, source-only workplan, and diff gates pass without model calls.

## Log

- 2026-07-25 — Activated from `origin/main` at `0834ead6` after PR #226 merged
  the canonical evaluation-profile registry. The current 728-line CLI owns
  argument parsing, filesystem access, SQLite queries, reporting counters,
  deep paper checks, and process exit behavior; no direct fixture tests were
  found.
- 2026-07-25 — Reduced the process-bound CLI to a 112-line adapter over 265-line
  manifest/database validation and 315-line deep-paper services. Added explicit
  `--manifest`, `--paper`, and `--db` fixture paths; missing required inputs now
  fail closed instead of producing a warning-only success.
- 2026-07-25 — Six focused tests pass for clean deep validation, score drift,
  missing runs and inputs, status repair, broken table/section references, and
  spawned CLI exit codes. Live old/new validation is exactly 73 pass, zero warn,
  zero fail. Final gates pass: 6,730/6,730 root tests and 137/137 core tests with
  zero skips, plus lint, formatting, zero cycles, manifest, source-only
  workplan, and diff checks.
- 2026-07-25 — Merged through PR #227 at `47f0e6ea` with every required CI
  check green.
