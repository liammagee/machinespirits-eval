---
id: refactor-v-series-fixtures
title: Make V-series validator fixtures repo-relative
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-24
updated: 2026-07-24
verification: >-
  On a clean checkout, all 41 previously host-path-gated first-draft outer-loop
  and campaign cases execute against deterministic repo-relative fixtures;
  historical hashes and verdicts remain byte-identical, the related skip-ledger
  entries disappear, and focused plus hermetic CI passes.
branch: codex/refactor-v-series-fixtures
depends_on:
  - refactor-required-run-manifest
  - tutor-stub-first-draft-series
  - adaptive-eval-immutable-provenance
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/188
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  items:
    - codebase-refactoring-program
    - tutor-stub-first-draft-series
    - adaptive-eval-immutable-provenance
tags:
  - testing
  - fixtures
  - tutor-stub
  - provenance
  - refactoring
milestone: evaluation-infrastructure
---

Bounded R0.2 slice: replace only the machine-specific V17-V53 first-draft
outer-loop and campaign fixture dependency. Do not change validator semantics,
historical artifacts, expected verdicts, or the closed empirical claims.

Acceptance:

- Replace the absolute host artifact root with an explicit configurable,
  repo-relative fixture root.
- Track or deterministically generate the minimum synthetic/derived fixtures
  needed by the 32 outer-loop and 9 campaign cases.
- Freeze equality against the historical hashes, verdicts, and provenance
  fields already asserted by the closed series.
- Make the 41 cases execute in a clean checkout without ambient private data.
- Remove only the V-series and campaign skip-ledger entries discharged here.
- Pass focused tests, full hermetic root/core tests, lint, formatting, workplan
  validation, and the Node 20/22 CI matrix without model/API calls.

Log:

- 2026-07-24 — Activated from merged PR #182 at `8cd11351`; dependencies on
  the closed first-draft series, immutable-provenance card, and required-run
  manifest are explicit before fixture extraction begins.
- 2026-07-24 — Replaced the four machine-local traces consumed by the validator
  suite with 458 KB of repo-owned single-turn fixtures plus a hash-bound source
  manifest. All four bundles are byte-identical to fresh sealed-trace extraction
  and retain the original source SHA-256 provenance.
- 2026-07-24 — Local proof is green: the 41 formerly gated cases now execute
  with zero skips; the focused three-file hermetic phase passes 112/112; the
  full hermetic run passes 6,574 root assertions plus 133/133 tutor-core tests;
  lint and fixture-integrity checks pass. Moved to review pending clean Node
  20/22 CI.
- 2026-07-24 — Closed after PR #188 merged with the clean Node 20/22 matrix
  green; the merged branch and worktree were removed after ancestry and
  clean-worktree checks.
