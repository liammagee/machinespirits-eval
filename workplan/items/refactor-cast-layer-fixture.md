---
id: refactor-cast-layer-fixture
title: Make cast-layer reader-quality scoring hermetic
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-24
updated: 2026-07-24
verification: >-
  A clean checkout executes the cast-layer reader-quality scorer against a
  tracked synthetic S0/S1/S2 matrix, preserves its conservative proof and
  branch-ordering assertions, removes the cast-layer-private-matrix skip, and
  passes focused plus full hermetic parity without production export writes.
branch: codex/refactor-cast-layer-fixture
depends_on:
  - refactor-required-run-manifest
  - refactor-dialogue-log-fixtures
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/193
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  items:
    - codebase-refactoring-program
tags:
  - testing
  - fixtures
  - cast-layer
  - dramatic-derivation
  - hermetic
  - refactoring
milestone: evaluation-infrastructure
---

Bounded R0.4 slice: replace only the cast-layer reader-quality test's ignored
matrix dependency. Do not change scorer semantics, production defaults,
historical exports, or any empirical claim.

Acceptance:

- Track a compact, explicitly synthetic S0/S1/S2 matrix under `tests/fixtures/`.
- Exercise no-cast, static-cast, and bounded-reinvention scoring branches while
  holding the proof outcome, release adherence, and public prose shape fixed.
- Keep test outputs in a temporary directory and never write production
  `exports/` paths.
- Pin the conservative boundary: cast/reinvention branch scores improve while
  the reader/dialogue proxy remains effectively flat.
- Remove the `cast-layer-private-matrix` allowed-skip entry and matching runner
  fixture once the clean-checkout test executes.
- Pass focused scorer/runner tests, the full hermetic root phase, lint,
  formatting, and workplan validation without model or API calls.

Log:

- 2026-07-24 — Activated from merged `main` at `a987b545` after PR #192 closed
  R0.3; scope is frozen to a test-only synthetic matrix, existing scorer
  invariants, and removal of the discharged skip-ledger entry.
- 2026-07-24 — Added one compact shared-prose matrix fixture that materializes
  the production S0/S1/S2 directory contract only inside a temporary test
  directory. All arms retain the same grounded seven-turn proof trajectory;
  S1 adds static cast state and S2 adds one proof-inert reinvention at turn 7.
- 2026-07-24 — Local proof is green: the focused scorer/runner phase passes
  13/13 with zero skips; the complete 453-file root manifest passes 6,633/6,633
  with zero skips; the unchanged tutor-core suite passes 133/133; and lint,
  formatting, and the 166-item workplan check pass. Moved to review pending the
  clean Node 20/22 CI matrix.
- 2026-07-24 — Closed after PR #193 merged with validation, lint, workplan,
  risk-coverage, and the clean Node 20/22 matrix green.
