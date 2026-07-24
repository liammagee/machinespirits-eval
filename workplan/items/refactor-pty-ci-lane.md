---
id: refactor-pty-ci-lane
title: Gate concurrent tutor-stub PTY behavior in CI
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-24
updated: 2026-07-24
verification: >-
  A dedicated Ubuntu Node 22 job opts the existing concurrent tutor-stub PTY
  assertion back in under CI, runs the hermetic interactive suite without
  forced exit, terminates deterministically, and passes alongside the unchanged
  Node 20/22 root matrix and its explicit parallel-run skip ledger.
branch: codex/refactor-pty-ci-lane
depends_on:
  - refactor-required-run-manifest
  - refactor-cast-layer-fixture
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  items:
    - codebase-refactoring-program
tags:
  - testing
  - ci
  - pty
  - loopback
  - tutor-stub
  - hermetic
  - refactoring
milestone: evaluation-infrastructure
---

Bounded R0.5 slice: execute the one timing-sensitive tutor-stub concurrency
assertion that the parallel CI matrix currently skips. Do not alter tutor-stub
runtime semantics, terminal rendering, model routing, or Windows support.

Acceptance:

- Preserve the concurrent PTY assertion's semantics and deterministic fake
  Codex adapter; only its prompt barrier, host gating, and bounded timing budget
  may change.
- Add a named Ubuntu CI gate that opts the assertion in explicitly.
- Run the interactive test file through the hermetic runner without forced exit
  so leaked PTYs, subprocesses, servers, or timers fail the lane.
- Preserve the parallel root matrix's declared timing-isolation skip and the
  existing intentional Windows PTY skip.
- Pin the package command, workflow job, and opt-in contract in a root test.
- Pass the dedicated PTY command, focused runner tests, the full hermetic suite,
  lint, formatting, and workplan validation without model or API calls.

Log:

- 2026-07-24 — Activated from merged `main` at `6c3d2f7a` after PR #193 closed
  R0.4. Scope is frozen to one existing concurrency assertion, a dedicated
  Linux CI job, bounded shared-runner timing, and natural teardown.
- 2026-07-24 — The first dedicated run reproduced the old false green: the
  harness waited for `calling auto learner`, which disappears when terminal
  motion is off, so its partial `/sta` input was never entered. Replaced that
  animation dependency with the stable editable `auto >` prompt shown after
  automation starts; the semantic ordering assertion remains `/sta` before the
  learner result and `/status` after completion.
- 2026-07-24 — Local proof is green: the CI-opted-in assertion passes 1/1; the
  dedicated natural-teardown interactive lane passes 36/36 with zero skips;
  its runner/workflow contract passes 12/12; and the full CI-semantic root phase
  completes 6,634 tests with 6,633 passes plus exactly the one declared
  parallel-run PTY skip, followed by 133/133 tutor-core tests. Lint, formatting,
  diff checks, and the 167-item workplan check pass. Moved to review pending the
  clean GitHub lane.
